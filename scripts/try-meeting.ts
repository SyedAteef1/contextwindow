/**
 * Run the wrap-up agent on a real transcript and print what it produced.
 *
 *   npm run try:meeting              # uses the seeded processed call
 *   npm run try:meeting -- <id>      # a specific meeting id
 *
 * This is the post-call half of the product: transcript in, deliverable +
 * buying signals + a drafted follow-up out. It writes to the database, so the
 * result is visible in the UI afterwards.
 */
import "dotenv/config";
import { desc, eq } from "drizzle-orm";

import { db, sqlClient } from "@/db";
import { accounts, meetings, transcripts } from "@/db/schema";
import { runWrapup } from "@/agents/wrapup";
import { getUsage } from "@/lib/usage";
import { body, explainFailure, field, heading, printConfig } from "./_harness";

async function pickMeeting(explicitId?: string) {
  if (explicitId) {
    const meeting = await db.query.meetings.findFirst({ where: eq(meetings.id, explicitId) });
    if (!meeting) throw new Error(`No meeting with id ${explicitId}`);
    return meeting;
  }

  // Any meeting that has a transcript — that is all the wrap-up needs.
  const [row] = await db
    .select({ meeting: meetings })
    .from(meetings)
    .innerJoin(transcripts, eq(transcripts.meetingId, meetings.id))
    .orderBy(desc(meetings.scheduledAt))
    .limit(1);

  if (!row) {
    throw new Error(
      "No meeting has a transcript. Run `npm run db:seed`, or paste one into a meeting in the UI.",
    );
  }
  return row.meeting;
}

async function main() {
  printConfig();

  const meeting = await pickMeeting(process.argv[2]);
  const account = await db.query.accounts.findFirst({ where: eq(accounts.id, meeting.accountId) });
  const transcript = await db.query.transcripts.findFirst({
    where: eq(transcripts.meetingId, meeting.id),
  });

  heading("Input");
  field("Meeting", meeting.title ?? "(untitled)");
  field("Account", `${account?.companyName} (${account?.domain})`);
  field("Industry", account?.industry ?? "not set");
  field("Transcript", `${transcript?.speakerSegments?.length ?? 0} turns, ${transcript?.rawText.length ?? 0} chars`);

  const before = await getUsage(meeting.accountId);
  field("Free tier", `${before.used}/${before.limit} used`);
  if (before.overLimit) {
    console.log("\n  Over the free-tier cap — the wrap-up would be skipped in the pipeline.\n");
  }

  console.log("\n  Running the wrap-up agent (summary → intent → follow-up draft)…");
  const started = Date.now();
  const result = await runWrapup(meeting.id);
  const seconds = ((Date.now() - started) / 1000).toFixed(1);

  heading(`Deliverable — ${result.deliverableType}`);
  body(result.content);

  const signals = result.intentSignals;
  heading("Buying signals");
  field("Interest", signals.buyingInterest);
  field("Rationale", signals.interestRationale);
  field("Follow-up warranted", signals.followupRecommended ? "yes" : "no");

  if (signals.objections.length) {
    console.log("\n  Objections:");
    for (const objection of signals.objections) {
      console.log(`    · [${objection.severity}] ${objection.objection}`);
      if (objection.quote) console.log(`        “${objection.quote}”`);
    }
  }
  if (signals.nextSteps.length) {
    console.log("\n  Next steps:");
    for (const step of signals.nextSteps) {
      console.log(`    · (${step.owner}) ${step.step}${step.dueDate ? ` — ${step.dueDate}` : ""}`);
    }
  }
  for (const [label, items] of [
    ["Competitors", signals.competitorsMentioned],
    ["Budget", signals.budgetSignals],
    ["Timing", signals.timelineSignals],
  ] as const) {
    if (items.length) console.log(`\n  ${label}: ${items.join(" · ")}`);
  }

  heading("Follow-up");
  if (result.followupProposalId) {
    const proposal = await db.query.followupProposals.findFirst({
      where: (table, { eq: equals }) => equals(table.id, result.followupProposalId!),
    });
    field("Status", `${proposal?.status} — no calendar event created`);
    field("Title", proposal?.title);
    field("Proposed", proposal?.proposedStart.toISOString());
    field("Invitees", (proposal?.attendeeEmails ?? []).join(", ") || "none");
    console.log("\n  Agenda:");
    body(proposal?.agenda ?? "");
    console.log("  Approve it in the UI to create the event — nothing is sent before that.");
  } else {
    console.log("  None drafted. The call did not warrant one.");
  }

  const after = await getUsage(meeting.accountId);
  heading("Done");
  field("Elapsed", `${seconds}s`);
  field("Chunks indexed", result.chunksIndexed);
  field("Free tier", `${after.used}/${after.limit} used`);
  console.log(`\n  View it: http://localhost:3001/meetings/${meeting.id}\n`);
}

main().catch(explainFailure).finally(() => sqlClient.end());
