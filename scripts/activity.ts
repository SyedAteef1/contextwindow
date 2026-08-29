/**
 * Read the activity log. `npm run activity [days] [email]`
 *
 * Two questions it exists to answer, both hard to get from the database by
 * hand: what has this deployment been doing lately, and which reps have gone
 * quiet. The second is the one that matters before a renewal.
 */
import "dotenv/config";
import { desc, eq, gte } from "drizzle-orm";

import { db, sqlClient } from "@/db";
import { activityEvents, users } from "@/db/schema";

const VERB: Record<string, string> = {
  calendar_synced: "synced their calendar",
  brief_generated: "got a brief",
  brief_opened: "opened a brief",
  transcript_uploaded: "uploaded a transcript",
  chat_asked: "asked the account chat",
  followup_approved: "approved a follow-up",
  followup_rejected: "rejected a follow-up",
  recap_sent: "sent a recap",
  upgrade_requested: "asked about upgrading",
};

async function main() {
  const days = Number(process.argv[2] ?? 7);
  const email = process.argv[3];
  const since = new Date(Date.now() - days * 86_400_000);

  const rows = await db
    .select({
      at: activityEvents.createdAt,
      action: activityEvents.action,
      detail: activityEvents.detail,
      email: users.email,
    })
    .from(activityEvents)
    .innerJoin(users, eq(users.id, activityEvents.userId))
    .where(gte(activityEvents.createdAt, since))
    .orderBy(desc(activityEvents.createdAt))
    .limit(400);

  const filtered = email ? rows.filter((r) => r.email === email) : rows;

  if (filtered.length === 0) {
    console.log(`Nothing recorded in the last ${days} days${email ? ` for ${email}` : ""}.`);
    await sqlClient.end();
    return;
  }

  // Who is active, before the detail. This is the churn question, and it reads
  // better as a leaderboard than as a stream.
  const perUser = new Map<string, { count: number; last: Date }>();
  for (const row of filtered) {
    const seen = perUser.get(row.email);
    if (!seen) perUser.set(row.email, { count: 1, last: row.at });
    else seen.count += 1;
  }

  console.log(`\nLast ${days} days — ${filtered.length} events, ${perUser.size} people\n`);
  for (const [who, stat] of [...perUser].sort((a, b) => b[1].count - a[1].count)) {
    const quietDays = Math.floor((Date.now() - stat.last.getTime()) / 86_400_000);
    const quiet = quietDays >= 3 ? `  ← quiet ${quietDays}d` : "";
    console.log(`  ${String(stat.count).padStart(4)}  ${who}${quiet}`);
  }

  console.log("");
  for (const row of filtered.slice(0, 60)) {
    const when = row.at.toISOString().slice(0, 16).replace("T", " ");
    const detail = row.detail
      ? "  " + Object.entries(row.detail).map(([k, v]) => `${k}=${v}`).join(" ")
      : "";
    console.log(`  ${when}  ${row.email.padEnd(28)} ${VERB[row.action] ?? row.action}${detail}`);
  }
  console.log("");

  await sqlClient.end();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
