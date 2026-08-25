import "dotenv/config";
import { sqlClient } from "@/db";
import { answerLiveQuestion, clearLiveContext } from "@/agents/live";

async function main() {
  const meetingId = process.argv[2];
  clearLiveContext();
  const qs = [
    "What's this going to cost us?",          // near-exact cache question
    "Where is our data stored?",              // exact cache question
    "How long does implementation take?",     // close paraphrase
    "Who founded the company and when?",      // genuine miss -> model
  ];
  for (const q of qs) {
    const r = await answerLiveQuestion({
      meetingId, utterance: q, speaker: "Buyer",
      askedAtMs: Date.now() + Math.floor(Math.random() * 100000),
    });
    const sim = r.cacheSimilarity ? ` sim=${r.cacheSimilarity.toFixed(3)}` : "";
    console.log(`  ${String(r.latencyMs).padStart(6)}ms  via=${(r.via ?? "-").padEnd(5)}${sim}  "${q}"`);
  }
}
main().catch((e) => console.error("ERROR:", e.message)).finally(() => sqlClient.end());
