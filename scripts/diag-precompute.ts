import "dotenv/config";
import { sqlClient } from "@/db";
import { precomputeAnswers, listPrecomputedAnswers } from "@/agents/precompute";

async function main() {
  const meetingId = process.argv[2];
  const t0 = Date.now();
  const r = await precomputeAnswers(meetingId);
  console.log(`  generated ${r.generated} answers in ${((Date.now()-t0)/1000).toFixed(1)}s`);
  console.log(`  topics: ${r.topics.join(", ")}\n`);
  for (const a of (await listPrecomputedAnswers(r.accountId)).slice(0, 6)) {
    console.log(`  Q: ${a.question}`);
    console.log(`  A: ${a.answer.slice(0, 120)}\n`);
  }
}
main().catch((e) => console.error("ERROR:", e.message)).finally(() => sqlClient.end());
