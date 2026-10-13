/**
 * Rebuild the embedding index from the source records.
 *
 * Chunking decides what retrieval can find, so changing it makes every existing
 * chunk stale — the text is still there but sliced the old way, which is why a
 * chunking improvement does nothing until this runs. Everything here is
 * regenerated from the durable rows (transcripts, summaries, briefs, workspace
 * documents), so it is safe to run repeatedly and safe to interrupt: each
 * source is replaced atomically by `indexDocument` and the rest are untouched.
 *
 *   npm run reindex
 */
import "dotenv/config";
import { eq } from "drizzle-orm";

import { db, sqlClient } from "@/db";
import {
  accounts,
  meetingBriefs,
  meetingSummaries,
  meetings,
  transcripts,
  workspaceDocuments,
} from "@/db/schema";
import { indexDocument } from "@/lib/retrieval";
import { workspaceIdForAccount } from "@/lib/workspace";

/** Meeting-derived sources all need the same account, workspace and labels. */
async function contextFor(meetingId: string) {
  const meeting = await db.query.meetings.findFirst({ where: eq(meetings.id, meetingId) });
  if (!meeting) return null;
  const account = await db.query.accounts.findFirst({ where: eq(accounts.id, meeting.accountId) });
  if (!account) return null;
  return {
    meeting,
    accountId: account.id,
    workspaceId: await workspaceIdForAccount(account.id),
    day: meeting.scheduledAt.toISOString().slice(0, 10),
    base: {
      meetingId: meeting.id,
      meetingTitle: meeting.title,
      scheduledAt: meeting.scheduledAt.toISOString(),
    },
  };
}

async function main() {
  const only = process.argv[2];
  const wanted = (kind: string) => !only || only === kind;
  let sources = 0;
  let chunks = 0;
  const failures: string[] = [];

  const run = async (label: string, fn: () => Promise<number>) => {
    try {
      chunks += await fn();
      sources += 1;
    } catch (error) {
      // One unreadable source must not abandon the rest of the index.
      failures.push(`${label}: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  if (wanted("workspace_doc")) {
    const docs = await db.select().from(workspaceDocuments);
    for (const doc of docs) {
      await run(`workspace_doc ${doc.id}`, () =>
        indexDocument({
          workspaceId: doc.workspaceId,
          accountId: null,
          sourceType: "workspace_doc",
          sourceId: doc.id,
          content: `${doc.title}\n\n${doc.content}`,
          meta: { kind: doc.kind, label: doc.title },
        }),
      );
    }
    console.log(`  workspace documents  ${docs.length}`);
  }

  if (wanted("transcript")) {
    const rows = await db.select().from(transcripts);
    for (const row of rows) {
      const context = await contextFor(row.meetingId);
      if (!context) continue;
      await run(`transcript ${row.id}`, () =>
        indexDocument({
          workspaceId: context.workspaceId,
          accountId: context.accountId,
          sourceType: "transcript",
          sourceId: row.id,
          content: row.rawText,
          meta: { ...context.base, label: `Transcript — ${context.day}` },
        }),
      );
    }
    console.log(`  transcripts          ${rows.length}`);
  }

  if (wanted("summary")) {
    const rows = await db.select().from(meetingSummaries);
    for (const row of rows) {
      const context = await contextFor(row.meetingId);
      if (!context) continue;
      await run(`summary ${row.id}`, () =>
        indexDocument({
          workspaceId: context.workspaceId,
          accountId: context.accountId,
          sourceType: "summary",
          sourceId: row.id,
          content: row.content,
          meta: { ...context.base, label: `Summary — ${context.day}` },
        }),
      );
    }
    console.log(`  summaries            ${rows.length}`);
  }

  if (wanted("brief")) {
    const rows = await db.select().from(meetingBriefs);
    for (const row of rows) {
      const context = await contextFor(row.meetingId);
      if (!context) continue;
      await run(`brief ${row.id}`, () =>
        indexDocument({
          workspaceId: context.workspaceId,
          accountId: context.accountId,
          sourceType: "brief",
          sourceId: row.id,
          content: row.content,
          meta: { ...context.base, label: `Brief — ${context.day}` },
        }),
      );
    }
    console.log(`  briefs               ${rows.length}`);
  }

  console.log(`\nReindexed ${sources} sources into ${chunks} chunks.`);
  if (failures.length) {
    console.error(`\n${failures.length} source(s) failed:`);
    for (const failure of failures) console.error(`  ${failure}`);
    process.exitCode = 1;
  }
}

main()
  .catch((error) => {
    console.error("Reindex failed:", error);
    process.exitCode = 1;
  })
  .finally(() => sqlClient.end());
