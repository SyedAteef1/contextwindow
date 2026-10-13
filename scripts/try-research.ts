/**
 * Run the research agent on a real meeting and print the brief it produced.
 *
 *   npm run try:research             # uses the next upcoming external meeting
 *   npm run try:research -- <id>     # a specific meeting id
 *
 * This is the pre-call half: company and attendees in, a cited brief out. It
 * makes real web searches, so it is the slowest and most expensive call in the
 * product — and the one where the grounding rules matter most.
 */
import "dotenv/config";
import { asc, eq, gte } from "drizzle-orm";

import { db, sqlClient } from "@/db";
import { accounts, meetings } from "@/db/schema";
import { generateMeetingBrief } from "@/agents/research";
import { provider } from "@/lib/llm";
import { searchProvider, webSearch } from "@/lib/search";
import { body, explainFailure, field, heading, printConfig } from "./_harness";

/**
 * Check search before spending a model call on it.
 *
 * On GLM the Web Search API is billed separately from the LLM, so a working
 * chat key does not imply working search. Finding that out after a 35-second
 * generation — and paying for it — is a poor way to learn.
 */
async function checkSearch(): Promise<void> {
  if (provider() !== "glm") return;

  heading("Pre-flight: web search");
  const backend = searchProvider();
  const label = backend === "serper" ? "Serper (Google)" : "Z.ai Web Search";
  try {
    const results = await webSearch("test", { count: 1 });
    field(label, `reachable (${results.length} result${results.length === 1 ? "" : "s"})`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    field(label, "UNAVAILABLE");

    if (/1113|Insufficient balance|recharge/i.test(message)) {
      console.log("\n  Z.ai bills the Web Search API separately from the LLM, and this");
      console.log("  account has no balance for it. A coding-plan subscription covers");
      console.log("  chat only.\n");
      console.log("  Either:");
      console.log("    · add balance at https://z.ai — search is the cheap part, or");
      console.log("    · set LLM_PROVIDER=anthropic with ANTHROPIC_API_KEY, whose hosted");
      console.log("      web search is included in the request rather than billed apart.\n");
      console.log("  Continuing anyway. The brief will be honest about what it could not");
      console.log("  verify rather than inventing facts — which is worth seeing once.\n");
    } else {
      console.log(`\n  ${message}\n`);
    }
  }
}

async function pickMeeting(explicitId?: string) {
  if (explicitId) {
    const meeting = await db.query.meetings.findFirst({ where: eq(meetings.id, explicitId) });
    if (!meeting) throw new Error(`No meeting with id ${explicitId}`);
    return meeting;
  }

  const [upcoming] = await db
    .select()
    .from(meetings)
    .where(gte(meetings.scheduledAt, new Date()))
    .orderBy(asc(meetings.scheduledAt))
    .limit(1);

  if (upcoming) return upcoming;

  // Nothing upcoming is fine — research works on any meeting.
  const [any] = await db.select().from(meetings).orderBy(asc(meetings.scheduledAt)).limit(1);
  if (!any) throw new Error("No meetings at all. Run `npm run db:seed` first.");
  return any;
}

async function main() {
  printConfig();

  const meeting = await pickMeeting(process.argv[2]);
  const account = await db.query.accounts.findFirst({ where: eq(accounts.id, meeting.accountId) });
  const externals = (meeting.attendees ?? []).filter((attendee) => attendee.external);

  heading("Input");
  field("Meeting", meeting.title ?? "(untitled)");
  field("Company", `${account?.companyName} (${account?.domain})`);
  field("Scheduled", meeting.scheduledAt.toISOString());
  field("External attendees", externals.length ? externals.map((a) => a.email).join(", ") : "none");

  await checkSearch();

  console.log("\n  Researching. This makes live web searches and can take a minute…");
  const started = Date.now();
  const result = await generateMeetingBrief(meeting.id);
  const seconds = ((Date.now() - started) / 1000).toFixed(1);

  heading("Brief");
  body(result.content);

  heading("Sources");
  if (result.citations.length === 0) {
    console.log("  None returned. Check the brief says so rather than asserting unsourced facts.");
  } else {
    for (const citation of result.citations) {
      console.log(`  · ${citation.title}\n    ${citation.url}`);
    }
  }

  heading("Done");
  field("Elapsed", `${seconds}s`);
  field("Citations", result.citations.length);
  field("Chunks indexed", result.chunksIndexed);
  console.log(`\n  View it: http://localhost:3001/meetings/${meeting.id}\n`);
  console.log("  Worth checking: does every factual claim trace to a source above,");
  console.log("  and does it say \"no public information found\" where it found nothing?\n");
}

main().catch(explainFailure).finally(() => sqlClient.end());
