import "dotenv/config";
import { desc, eq, sql } from "drizzle-orm";

import { db, sqlClient } from "@/db";
import { accounts, authEvents, meetings, usage, users } from "@/db/schema";

/**
 * Who signed up, who is active, and what everyone has used.
 *
 * A read-only command rather than an admin page: an admin surface is another
 * authenticated route to get wrong, and this answers the same questions without
 * adding one. Run with `npm run stats`.
 */
function bar(used: number, limit: number): string {
  const width = 20;
  const filled = Math.min(width, Math.round((used / Math.max(1, limit)) * width));
  return "█".repeat(filled) + "·".repeat(Math.max(0, width - filled));
}

async function main() {
  const rows = await db
    .select({
      email: users.email,
      name: users.name,
      joined: users.createdAt,
      lastSync: users.lastCalendarSyncAt,
      used: sql<number>`coalesce(${usage.meetingsProcessedThisMonth}, 0)::int`,
      limit: sql<number>`coalesce(${usage.freeTierLimit}, 0)::int`,
      accountCount: sql<number>`(select count(*)::int from ${accounts} where ${accounts.ownerUserId} = ${users.id})`,
      meetingCount: sql<number>`(select count(*)::int from ${meetings} where ${meetings.ownerUserId} = ${users.id})`,
      logins: sql<number>`(select count(*)::int from ${authEvents} where ${authEvents.userId} = ${users.id} and ${authEvents.event} = 'signed_in')`,
      lastSeen: sql<Date | null>`(select max(${authEvents.createdAt}) from ${authEvents} where ${authEvents.userId} = ${users.id})`,
    })
    .from(users)
    .leftJoin(usage, eq(usage.userId, users.id))
    .orderBy(desc(users.createdAt));

  const day = (value: Date | null) =>
    value ? new Date(value).toISOString().slice(0, 10) : "—";

  console.log(`\n  ${rows.length} user${rows.length === 1 ? "" : "s"}\n`);
  for (const row of rows) {
    const over = row.used >= row.limit && row.limit > 0;
    console.log(`  ${row.email}${row.name ? `  (${row.name})` : ""}`);
    console.log(
      `    joined ${day(row.joined)}   last seen ${day(row.lastSeen)}   logins ${row.logins}`,
    );
    console.log(
      `    meetings ${String(row.used).padStart(3)} / ${row.limit}  ${bar(row.used, row.limit)}${
        over ? "  OVER LIMIT" : ""
      }`,
    );
    console.log(
      `    ${row.accountCount} account${row.accountCount === 1 ? "" : "s"}, ${row.meetingCount} meeting${row.meetingCount === 1 ? "" : "s"} tracked, last sync ${day(row.lastSync)}\n`,
    );
  }

  const signups = await db
    .select({
      day: sql<string>`to_char(${authEvents.createdAt}, 'YYYY-MM-DD')`,
      count: sql<number>`count(*)::int`,
    })
    .from(authEvents)
    .where(eq(authEvents.event, "signed_up"))
    .groupBy(sql`1`)
    .orderBy(desc(sql`1`))
    .limit(14);

  if (signups.length) {
    console.log("  Sign-ups\n");
    for (const s of signups) console.log(`    ${s.day}  ${"▪".repeat(s.count)} ${s.count}`);
    console.log();
  } else {
    console.log("  No sign-ups recorded yet.\n");
    console.log("  Note: auth events start from the deploy that added them, so");
    console.log("  users who signed in before that have none.\n");
  }

  await sqlClient.end();
}

main();
