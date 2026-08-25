/** Accounts for the signed-in rep, with a little roll-up for the list view. */
import { NextResponse } from "next/server";
import { desc, eq, sql } from "drizzle-orm";

import { db } from "@/db";
import { accounts, meetings } from "@/db/schema";
import { handler, requireUser } from "@/lib/api";

export const GET = handler(async () => {
  const user = await requireUser();

  const rows = await db
    .select({
      id: accounts.id,
      companyName: accounts.companyName,
      domain: accounts.domain,
      industry: accounts.industry,
      dealStage: accounts.dealStage,
      createdAt: accounts.createdAt,
      meetingCount: sql<number>`count(distinct ${meetings.id})::int`,
      lastMeetingAt: sql<Date | null>`max(${meetings.scheduledAt})`,
    })
    .from(accounts)
    .leftJoin(meetings, eq(meetings.accountId, accounts.id))
    .where(eq(accounts.ownerUserId, user.id))
    .groupBy(accounts.id)
    .orderBy(desc(sql`max(${meetings.scheduledAt})`), desc(accounts.createdAt));

  return NextResponse.json({ accounts: rows });
});
