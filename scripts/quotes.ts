/**
 * The quote queue. `npm run quotes [--all]`
 *
 * Who has asked what Pro costs and not been answered. Open requests first,
 * because an unanswered one is the only kind that needs anything from you.
 */
import "dotenv/config";
import { desc, eq } from "drizzle-orm";

import { db, sqlClient } from "@/db";
import { quoteRequests, users, workspaces } from "@/db/schema";

async function main() {
  const all = process.argv.includes("--all");

  const rows = await db
    .select({
      id: quoteRequests.id,
      seats: quoteRequests.seats,
      note: quoteRequests.note,
      status: quoteRequests.status,
      at: quoteRequests.createdAt,
      company: workspaces.name,
      website: workspaces.website,
      plan: workspaces.plan,
      email: users.email,
    })
    .from(quoteRequests)
    .innerJoin(workspaces, eq(workspaces.id, quoteRequests.workspaceId))
    .innerJoin(users, eq(users.id, quoteRequests.userId))
    .orderBy(desc(quoteRequests.createdAt))
    .limit(200);

  const shown = all ? rows : rows.filter((row) => row.status === "requested");

  if (shown.length === 0) {
    console.log(all ? "\nNo quote requests yet.\n" : "\nNothing waiting on a price.\n");
    await sqlClient.end();
    return;
  }

  console.log(`\n${shown.length} ${all ? "request(s)" : "waiting on a price"}\n`);
  for (const row of shown) {
    const waited = Math.floor((Date.now() - row.at.getTime()) / 86_400_000);
    console.log(`  ${row.company}${row.website ? `  ${row.website}` : ""}`);
    console.log(
      `    ${row.email}` +
        (row.seats ? `  ·  ${row.seats} seats` : "") +
        `  ·  on ${row.plan}` +
        `  ·  ${waited === 0 ? "today" : `${waited}d ago`}` +
        (row.status !== "requested" ? `  ·  ${row.status}` : ""),
    );
    if (row.note) console.log(`    "${row.note}"`);
    console.log("");
  }

  console.log("  Mark one quoted:");
  console.log(
    `    docker exec sales-intel-pg psql -U sales -d sales_intel -c "update quote_requests set status='quoted', quoted_at=now() where id='<id>'"\n`,
  );

  await sqlClient.end();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
