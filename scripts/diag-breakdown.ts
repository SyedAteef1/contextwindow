import "dotenv/config";
import { eq } from "drizzle-orm";
import { db, sqlClient } from "@/db";
import { meetings } from "@/db/schema";
import { embedQuery } from "@/lib/embeddings";
import { findPrecomputedAnswer } from "@/agents/precompute";
import { clearLiveContext } from "@/agents/live";
import { runFast } from "@/lib/llm/fast";

async function main() {
  const meetingId = process.argv[2];
  const question = process.argv[3] ?? "Who founded the company and when?";
  clearLiveContext();

  const meeting = await db.query.meetings.findFirst({ where: eq(meetings.id, meetingId) });
  if (!meeting) throw new Error("no meeting");

  console.log(`\n  question: "${question}"\n`);

  let t = Date.now();
  await db.query.meetings.findFirst({ where: eq(meetings.id, meetingId) });
  const dbMs = Date.now() - t;

  t = Date.now();
  await embedQuery(question);
  const embedMs = Date.now() - t;

  t = Date.now();
  const hit = await findPrecomputedAnswer(meeting.accountId, question);
  const cacheMs = Date.now() - t;

  let modelMs = 0, ttftMs: number | null = null;
  if (!hit) {
    t = Date.now();
    const r = await runFast({
      system: "You sit beside a sales rep on a live call. Answer in under 60 words, plain sentences.",
      prompt: `The buyer asked: ${question}`,
      maxTokens: 220,
    });
    modelMs = Date.now() - t;
    ttftMs = r.firstTokenMs;
  }

  const total = dbMs + embedMs + cacheMs + modelMs;
  const bar = (ms: number) => "█".repeat(Math.max(0, Math.round((ms / total) * 40)));
  console.log(`  ${"meeting lookup (db)".padEnd(24)} ${String(dbMs).padStart(6)}ms ${bar(dbMs)}`);
  console.log(`  ${"embed the question".padEnd(24)} ${String(embedMs).padStart(6)}ms ${bar(embedMs)}`);
  console.log(`  ${"cache vector search".padEnd(24)} ${String(cacheMs).padStart(6)}ms ${bar(cacheMs)}`);
  if (!hit) {
    console.log(`  ${"MODEL CALL".padEnd(24)} ${String(modelMs).padStart(6)}ms ${bar(modelMs)}`);
    console.log(`  ${"  └ to first token".padEnd(24)} ${String(ttftMs ?? "-").padStart(6)}ms`);
  } else {
    console.log(`  ${"CACHE HIT — no model".padEnd(24)} ${"0".padStart(6)}ms`);
  }
  console.log(`  ${"".padEnd(24)} ${"------".padStart(6)}`);
  console.log(`  ${"total".padEnd(24)} ${String(total).padStart(6)}ms`);
}
main().catch((e) => console.error("ERROR:", e.message)).finally(() => sqlClient.end());
