/**
 * Answering the call's questions before the call.
 *
 * The live agent's problem is that generating an answer costs 700-1,600ms and
 * varies unpredictably, while a rep needs it inside a second. But the questions
 * a buyer asks mid-call are mostly the same ones every time — pricing,
 * security, SSO, integrations, timeline, support — and the material needed to
 * answer them (the brief, the playbook, the account record) exists *before* the
 * call starts.
 *
 * So the answer is written in advance and looked up by vector match at ~5ms.
 * The model stays in the loop only for genuine surprises.
 *
 * Runs after the pre-call brief, when latency does not matter at all.
 */
import { and, cosineDistance, desc, eq, gt, sql } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db";
import { accounts, meetingBriefs, meetings, precomputedAnswers, users } from "@/db/schema";
import { runStructured } from "@/lib/llm";
import { embedDocuments, embedQuery } from "@/lib/embeddings";
import { env } from "@/lib/env";
import { formatPlaybook, loadPlaybookSnippets } from "@/lib/retrieval";

/**
 * The topics buyers actually raise, seeded rather than left to the model.
 *
 * Without a list the model drifts toward whatever the brief emphasised, and
 * misses the boring universals that get asked on every call.
 */
const TOPICS = [
  "pricing and commercial terms",
  "security, compliance and certifications",
  "SSO and identity",
  "data residency and privacy",
  "integrations and API",
  "implementation timeline and migration",
  "support and SLAs",
  "who else uses this / references",
  "contract terms and procurement",
  "product capabilities and limits",
] as const;

const faqSchema = z.object({
  answers: z
    .array(
      z.object({
        question: z.string().describe("Phrased the way a buyer would actually say it out loud."),
        answer: z.string().describe("Under 60 words, plain sentences, for a rep to glance at."),
        topic: z.string(),
      }),
    )
    .default([]),
});

export const PRECOMPUTE_SYSTEM = `You prepare a sales rep for the questions a buyer will ask on an upcoming call, writing the answers in advance so they can be shown instantly mid-call.

## What to produce

For each topic given, write the one or two questions a buyer is most likely to ask out loud, and the answer the rep should have on screen.

Phrase questions the way people actually speak — "what's this going to cost us?" rather than "What is the pricing structure?". They will be matched against live speech, so natural phrasing matters more than polish.

## Answering rules — these matter more than coverage

- Ground every answer in the context provided. The brief, the playbook and the account record are all you know.
- Where the context does not settle it, say so and tell the rep what to do: "Not in this account's history — say you'll confirm and follow up." That is a *useful* precomputed answer and you should write plenty of them.
- Never invent a number, a date, a certification, a customer name, or a capability. These are shown mid-call and may be read aloud; a wrong figure is expensive and hard to walk back.
- Under 60 words each. No preamble, no markdown, no bullets.
- Skip a topic entirely rather than padding it with something generic.

Better to return twelve honest answers than thirty confident-sounding ones.`;

export type PrecomputeResult = {
  accountId: string;
  generated: number;
  topics: string[];
};

/**
 * Generate and store the answer cache for a meeting's account.
 *
 * Replaces any previous set for the account — a regenerated brief means the
 * old answers were grounded in stale context.
 */
export async function precomputeAnswers(meetingId: string): Promise<PrecomputeResult> {
  const meeting = await db.query.meetings.findFirst({ where: eq(meetings.id, meetingId) });
  if (!meeting) throw new Error(`Meeting ${meetingId} not found`);

  const [account, brief, owner] = await Promise.all([
    db.query.accounts.findFirst({ where: eq(accounts.id, meeting.accountId) }),
    db.query.meetingBriefs.findFirst({ where: eq(meetingBriefs.meetingId, meetingId) }),
    db.query.users.findFirst({ where: eq(users.id, meeting.ownerUserId) }),
  ]);
  if (!account) throw new Error(`Account ${meeting.accountId} not found`);

  const playbook = owner
    ? formatPlaybook(
        await loadPlaybookSnippets({
          ownerUserId: owner.id,
          accountId: account.id,
          audience: "chat",
          industry: account.industry,
        }),
      )
    : "";

  const context = [
    `## The account`,
    `Company: ${account.companyName} (${account.domain})`,
    account.industry ? `Industry: ${account.industry}` : null,
    `Deal stage: ${account.dealStage}`,
    brief ? `\n## Pre-call brief\n${brief.content}` : null,
    playbook ? `\n## Our sales playbook\n${playbook}` : null,
    ``,
    `## Topics to cover`,
    TOPICS.map((topic) => `- ${topic}`).join("\n"),
  ]
    .filter(Boolean)
    .join("\n");

  const result = await runStructured({
    system: PRECOMPUTE_SYSTEM,
    schema: faqSchema,
    messages: [{ role: "user", content: context }],
    // No latency pressure here, so spend the effort on quality.
    maxTokens: 8000,
  });

  const entries = result.answers.filter((entry) => entry.question.trim() && entry.answer.trim());
  if (entries.length === 0) {
    return { accountId: account.id, generated: 0, topics: [] };
  }

  // Match on the question, since that is what live speech resembles.
  const vectors = await embedDocuments(entries.map((entry) => entry.question));

  await db.delete(precomputedAnswers).where(eq(precomputedAnswers.accountId, account.id));
  await db
    .insert(precomputedAnswers)
    .values(
      entries.map((entry, index) => ({
        accountId: account.id,
        meetingId: meeting.id,
        question: entry.question.trim(),
        answer: entry.answer.trim(),
        topic: entry.topic,
        vector: vectors[index],
      })),
    )
    .onConflictDoNothing({
      target: [precomputedAnswers.accountId, precomputedAnswers.question],
    });

  return {
    accountId: account.id,
    generated: entries.length,
    topics: [...new Set(entries.map((entry) => entry.topic))],
  };
}

export type CacheHit = {
  question: string;
  answer: string;
  topic: string | null;
  similarity: number;
};

/**
 * Look for a precomputed answer close enough to serve.
 *
 * The threshold is the whole risk surface. Too low and a question about
 * pricing gets answered with the security response — worse than no answer,
 * because the rep may read it out. Default is deliberately conservative;
 * a miss just falls through to the model.
 */
export async function findPrecomputedAnswer(
  accountId: string,
  question: string,
  minSimilarity = env().PRECOMPUTED_MIN_SIMILARITY,
): Promise<CacheHit | null> {
  const queryVector = await embedQuery(question);
  const similarity = sql<number>`1 - (${cosineDistance(precomputedAnswers.vector, queryVector)})`;

  const [row] = await db
    .select({
      question: precomputedAnswers.question,
      answer: precomputedAnswers.answer,
      topic: precomputedAnswers.topic,
      similarity,
    })
    .from(precomputedAnswers)
    .where(
      and(
        // The isolation boundary, same as every other retrieval path.
        eq(precomputedAnswers.accountId, accountId),
        gt(similarity, minSimilarity),
      ),
    )
    .orderBy((t) => desc(t.similarity))
    .limit(1);

  return row ?? null;
}

/** What the cache holds for an account, for the UI and for diagnostics. */
export async function listPrecomputedAnswers(accountId: string) {
  return db
    .select({
      question: precomputedAnswers.question,
      answer: precomputedAnswers.answer,
      topic: precomputedAnswers.topic,
    })
    .from(precomputedAnswers)
    .where(eq(precomputedAnswers.accountId, accountId))
    .orderBy(precomputedAnswers.topic);
}
