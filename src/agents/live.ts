/**
 * Live in-call question answering.
 *
 * The whole design follows from one number: an utterance reaches us ~350ms
 * after the speaker stops, and a rep can only use an answer that lands while
 * the question is still hanging in the air. That gives roughly half a second.
 *
 * Three things are done to fit it, and each costs something:
 *
 *  1. A heuristic decides what *might* be a question before any model is
 *     called. Most utterances are statements, and skipping them costs 0ms.
 *  2. Account context is loaded once when the call starts and held in memory.
 *     Retrieval per question would blow the budget on its own.
 *  3. The answer is short, and the model is told to bail with SKIP rather than
 *     produce something. Output length is most of the latency.
 *
 * What this is not: the wrap-up agent. It does not summarise, it does not
 * retrieve, and it never writes to the account history.
 */
import { and, desc, eq } from "drizzle-orm";

import { db } from "@/db";
import { accounts, liveAnswers, meetingBriefs, meetings, users } from "@/db/schema";
import { runText } from "@/lib/llm";
import { fastLaneEnabled, runFast } from "@/lib/llm/fast";
import { formatPlaybook, loadPlaybookSnippets } from "@/lib/retrieval";
import { findPrecomputedAnswer } from "./precompute";

/** Answers longer than this are unreadable mid-call. */
const MAX_ANSWER_TOKENS = 220;

/** The model returns this verbatim when an utterance isn't worth answering. */
const SKIP = "SKIP";

export const LIVE_SYSTEM = `You sit beside a sales rep during a live call. Someone has just said something, and you put a useful answer on the rep's screen while it is still being discussed.

You are writing for someone mid-conversation who cannot read a paragraph. Be brief enough to glance at.

## Answer, by default

If it is a question of any kind — about the product, pricing, security, timelines, implementation, the company, or even how the call is going — answer it. Being useful matters more than being cautious.

Reply with exactly \`${SKIP}\` only when there is genuinely nothing to respond to:
- a pure statement with no question in it ("I'm just testing this out.")
- a fragment too broken to interpret ("to report?")
- a question the rep asked the buyer, not the other way round

When in doubt, answer. An honest "that isn't in this account's history, say you'll confirm" is useful. Silence is not.

## How to answer

- Lead with the answer in one short sentence. At most two more of substance.
- Under 60 words. No preamble, no "great question", no sign-off.
- Ground it in the context provided where you can.
- When the context does not settle it, say so and tell the rep what to do: "Not in this account's history — say you'll confirm and follow up."
- Never invent a number, a date, a commitment, or a capability. A wrong price said out loud on a live call is expensive. Say "don't quote a number" instead.
- For a conversational opener ("can you hear me?", "how's it going?"), reply with one short, natural thing the rep could actually say.

## Format

Plain sentences. No markdown, no headings, no bullets — this is read at a glance.`;

/**
 * A cheap first pass over the utterance.
 *
 * Deliberately generous: a false positive costs one model call, a false
 * negative means the rep gets nothing. Real questions in speech often lack a
 * question mark, which is why the leading-word check matters more than "?".
 */
export function isLikelyQuestion(text: string): boolean {
  const trimmed = text.trim();
  // Too short to carry a question; "ok?" is not worth a round trip.
  if (trimmed.length < 8) return false;

  if (trimmed.includes("?")) return true;

  const opener =
    /^(what|how|why|when|where|who|which|can|could|would|will|do|does|did|is|are|was|were|should|have|has|any|tell me|walk me|explain|talk me)\b/i;
  if (opener.test(trimmed)) return true;

  // Mid-sentence asks that rarely carry a question mark in captions.
  return /\b(do you|can you|could you|are you|is it|what about|how about|what's the|whats the)\b/i.test(
    trimmed,
  );
}

type LiveContext = { text: string; loadedAt: number };

/**
 * Per-meeting context cache.
 *
 * Held in module scope, so it survives between webhook deliveries within one
 * server process. A cache miss costs a database round trip, not a failure —
 * and a call is short enough that this never needs eviction beyond a TTL.
 */
const contextCache = new Map<string, LiveContext>();
const CONTEXT_TTL_MS = 90 * 60_000;

export function clearLiveContext(meetingId?: string): void {
  if (meetingId) contextCache.delete(meetingId);
  else contextCache.clear();
}

/**
 * Everything the answerer is allowed to know, assembled once per call.
 *
 * The pre-call brief and the playbook are the two things that actually answer
 * mid-call questions, and both are already written before the call starts —
 * which is what makes the sub-second budget possible.
 */
async function loadContext(meetingId: string): Promise<string> {
  const cached = contextCache.get(meetingId);
  if (cached && Date.now() - cached.loadedAt < CONTEXT_TTL_MS) return cached.text;

  const meeting = await db.query.meetings.findFirst({ where: eq(meetings.id, meetingId) });
  if (!meeting) throw new Error(`Meeting ${meetingId} not found`);

  const [account, brief, owner] = await Promise.all([
    db.query.accounts.findFirst({ where: eq(accounts.id, meeting.accountId) }),
    db.query.meetingBriefs.findFirst({ where: eq(meetingBriefs.meetingId, meetingId) }),
    db.query.users.findFirst({ where: eq(users.id, meeting.ownerUserId) }),
  ]);

  const playbook = owner
    ? formatPlaybook(
        await loadPlaybookSnippets({
          ownerUserId: owner.id,
          accountId: meeting.accountId,
          audience: "chat",
          industry: account?.industry ?? null,
        }),
      )
    : "";

  const text = [
    `## The account`,
    `Company: ${account?.companyName ?? "unknown"} (${account?.domain ?? "unknown"})`,
    account?.industry ? `Industry: ${account.industry}` : null,
    `Deal stage: ${account?.dealStage ?? "unknown"}`,
    brief ? `\n## Pre-call brief\n${brief.content}` : null,
    playbook ? `\n## Our sales playbook\n${playbook}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  contextCache.set(meetingId, { text, loadedAt: Date.now() });
  return text;
}

export type LiveAnswerResult = {
  answered: boolean;
  question: string;
  answer: string | null;
  latencyMs: number;
  /** Milliseconds to the first token — what the rep perceives. */
  firstTokenMs?: number | null;
  /** Which lane produced this, so slow answers are attributable. */
  via?: "cache" | "fast" | "main";
  /** Similarity to the precomputed question, when served from cache. */
  cacheSimilarity?: number;
  skippedReason?: string;
};

/**
 * Answer one utterance, or decide not to.
 *
 * Returns rather than throws on the uninteresting paths, because this runs
 * inside a webhook that must stay fast and must never fail the delivery.
 */
export async function answerLiveQuestion(input: {
  meetingId: string;
  utterance: string;
  speaker?: string | null;
  askedAtMs?: number | null;
  /** Stream tokens onward as they arrive, for the browser. */
  onToken?: (token: string) => void;
}): Promise<LiveAnswerResult> {
  const started = Date.now();
  const question = input.utterance.trim();

  if (!isLikelyQuestion(question)) {
    return {
      answered: false,
      question,
      answer: null,
      latencyMs: Date.now() - started,
      skippedReason: "not question-shaped",
    };
  }

  // The cache first, always. A hit is ~5ms and never varies; generating is
  // 700-1,600ms and varies by more than 2x. Most mid-call questions are the
  // predictable ones, so this is the common path, not the optimisation.
  const meeting = await db.query.meetings.findFirst({ where: eq(meetings.id, input.meetingId) });
  if (meeting) {
    const hit = await findPrecomputedAnswer(meeting.accountId, question);
    if (hit) {
      return {
        answered: true,
        question,
        answer: hit.answer,
        latencyMs: Date.now() - started,
        firstTokenMs: null,
        via: "cache",
        cacheSimilarity: hit.similarity,
      };
    }
  }

  const context = await loadContext(input.meetingId);
  const prompt = [
    context,
    ``,
    `## They just said`,
    input.speaker ? `${input.speaker}: ${question}` : question,
    ``,
    `Answer it for the rep's screen, or reply ${SKIP}.`,
  ].join("\n");

  let answer = "";
  let firstTokenMs: number | null = null;
  let via: "fast" | "main" = "main";

  if (fastLaneEnabled()) {
    try {
      const fast = await runFast({
        system: LIVE_SYSTEM,
        prompt,
        maxTokens: MAX_ANSWER_TOKENS,
        onToken: input.onToken,
      });
      answer = fast.text;
      firstTokenMs = fast.firstTokenMs;
      via = "fast";
    } catch (error) {
      // The fast lane is an optimisation, not a dependency. If it times out or
      // is misconfigured, fall back rather than leave the rep with nothing.
      console.warn("Fast lane failed; falling back to the main model:", error);
    }
  }

  if (!answer) {
    const result = await runText({
      system: LIVE_SYSTEM,
      messages: [{ role: "user", content: prompt }],
      // Short output is most of the latency budget.
      maxTokens: MAX_ANSWER_TOKENS,
      effort: "low",
      // The system prompt and account context are identical for every question
      // in a call, so caching them is exactly the right shape here.
      cacheSystem: true,
    });
    answer = result.text.trim();
  }

  answer = answer.trim();
  const latencyMs = Date.now() - started;

  if (!answer || answer.toUpperCase().startsWith(SKIP)) {
    return {
      answered: false,
      question,
      answer: null,
      latencyMs,
      firstTokenMs,
      via,
      skippedReason: "model declined to answer",
    };
  }

  return { answered: true, question, answer, latencyMs, firstTokenMs, via };
}

/** Answers so far for a meeting, oldest first, for the live panel. */
export async function listLiveAnswers(meetingId: string) {
  const rows = await db
    .select()
    .from(liveAnswers)
    .where(eq(liveAnswers.meetingId, meetingId))
    .orderBy(desc(liveAnswers.createdAt))
    .limit(50);
  return rows.reverse();
}

/** Whether a meeting is currently being recorded — drives the live UI. */
export async function isMeetingLive(meetingId: string, ownerUserId: string): Promise<boolean> {
  const meeting = await db.query.meetings.findFirst({
    where: and(eq(meetings.id, meetingId), eq(meetings.ownerUserId, ownerUserId)),
  });
  return meeting?.status === "recording";
}
