/**
 * Read the demo requests.
 *
 * There is no inbox for these yet, so without this they accumulate somewhere
 * nobody looks — which is worse than not collecting them. Marking one handled
 * keeps the list to what still needs a reply.
 *
 *   npm run inbox              list everything unhandled
 *   npm run inbox -- --all     include the ones already handled
 *   npm run inbox -- <id>      mark one handled
 */
import "dotenv/config";
import { desc, eq, isNull } from "drizzle-orm";

import { db, sqlClient } from "@/db";
import { demoRequests } from "@/db/schema";

async function main() {
  const arg = process.argv[2];

  if (arg && arg !== "--all") {
    const [row] = await db
      .update(demoRequests)
      .set({ handledAt: new Date() })
      .where(eq(demoRequests.id, arg))
      .returning();
    console.log(row ? `Marked handled: ${row.name} · ${row.company}` : `No request ${arg}`);
    return;
  }

  const rows = await db
    .select()
    .from(demoRequests)
    .where(arg === "--all" ? undefined : isNull(demoRequests.handledAt))
    .orderBy(desc(demoRequests.createdAt));

  if (rows.length === 0) {
    console.log("Nothing waiting.");
    return;
  }

  for (const row of rows) {
    const when = row.createdAt.toISOString().slice(0, 16).replace("T", " ");
    console.log(`\n${row.handledAt ? "·" : "→"} ${row.name} · ${row.company}`);
    console.log(`  ${row.email}${row.teamSize ? `  ·  ${row.teamSize}` : ""}`);
    if (row.message) console.log(`  "${row.message}"`);
    console.log(`  ${when}${row.source ? `  ·  via ${row.source}` : ""}  ·  ${row.id}`);
  }
  console.log(`\n${rows.length} request${rows.length === 1 ? "" : "s"}.`);
}

main()
  .catch((error) => {
    console.error("Failed:", error);
    process.exitCode = 1;
  })
  .finally(() => sqlClient.end());
