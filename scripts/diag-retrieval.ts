import "dotenv/config";
import { sql } from "drizzle-orm";
import { db, sqlClient } from "@/db";
import { users, accounts } from "@/db/schema";
import { indexDocument, retrieveForAccount } from "@/lib/retrieval";

async function main() {
  await db.execute(sql`truncate table ${users} restart identity cascade`);
  const [rep] = await db.insert(users).values({ email: "d@x.com", emailDomain: "x.com" }).returning();
  const [acct] = await db.insert(accounts).values({ ownerUserId: rep.id, companyName: "C", domain: "c.io" }).returning();

  await indexDocument({ accountId: acct.id, sourceType: "summary", sourceId: crypto.randomUUID(),
    content: "Pricing was discussed at length; they pushed back on the per-seat model." });
  await indexDocument({ accountId: acct.id, sourceType: "brief", sourceId: crypto.randomUUID(),
    content: "The company builds industrial monitoring software for manufacturers." });

  for (const q of [
    "what happened with pricing per seat",
    "pricing",
    "they pushed back on pricing",
    "per-seat pricing model",
    "industrial monitoring software",
  ]) {
    const r = await retrieveForAccount(acct.id, q, { minSimilarity: -1 });
    console.log(`\nQ: "${q}"`);
    for (const c of r) console.log(`   sim=${c.similarity.toFixed(4)} [${c.sourceType}] ${c.content.slice(0,55)}…`);
  }
}
main().catch(e => {console.error(e); process.exitCode=1;}).finally(() => sqlClient.end());
