import "dotenv/config";
import { embedQuery } from "@/lib/embeddings";
import { runFast, fastLaneEnabled } from "@/lib/llm/fast";
import { sqlClient } from "@/db";

async function time<T>(label: string, fn: () => Promise<T>): Promise<T | null> {
  const t = Date.now();
  try {
    const out = await fn();
    console.log(`  ${label.padEnd(28)} ${String(Date.now() - t).padStart(6)}ms`);
    return out;
  } catch (error) {
    console.log(`  ${label.padEnd(28)} FAILED  ${error instanceof Error ? error.message.slice(0, 90) : ""}`);
    return null;
  }
}

async function main() {
  const q = "What is your SOC 2 status and can you share the report?";
  console.log(`\n  question: "${q}"`);
  console.log(`  fast lane enabled: ${fastLaneEnabled()}\n`);

  await time("embed query (cache lookup)", () => embedQuery(q));
  await time("embed query (2nd, warm)", () => embedQuery(q));

  let firstToken: number | null = null;
  const started = Date.now();
  await time("fast lane, full answer", async () =>
    runFast({
      system: "Answer in one short sentence. No preamble.",
      prompt: q,
      maxTokens: 120,
      onToken: () => {
        if (firstToken === null) firstToken = Date.now() - started;
      },
    }),
  );
  if (firstToken !== null) console.log(`  ${"fast lane, first token".padEnd(28)} ${String(firstToken).padStart(6)}ms`);
  await sqlClient.end();
}
main();
