/** The rep's meetings, newest first, with brief/summary presence flags. */
import { NextResponse } from "next/server";
import { desc, eq, sql } from "drizzle-orm";

import { db } from "@/db";
import { accounts, meetingBriefs, meetingSummaries, meetings } from "@/db/schema";
import { handler, requireUser } from "@/lib/api";

export const GET = handler(async (request: Request) => {
  const user = await requireUser();
  const limit = Math.min(Number(new URL(request.url).searchParams.get("limit") ?? 100), 200);

  const rows = await db
    .select({
      id: meetings.id,
      title: meetings.title,
      scheduledAt: meetings.scheduledAt,
      endsAt: meetings.endsAt,
      status: meetings.status,
      meetingUrl: meetings.meetingUrl,
      botState: meetings.botState,
      errorMessage: meetings.errorMessage,
      accountId: accounts.id,
      companyName: accounts.companyName,
      domain: accounts.domain,
      dealStage: accounts.dealStage,
      hasBrief: sql<boolean>`${meetingBriefs.id} is not null`,
      hasSummary: sql<boolean>`${meetingSummaries.id} is not null`,
    })
    .from(meetings)
    .innerJoin(accounts, eq(accounts.id, meetings.accountId))
    .leftJoin(meetingBriefs, eq(meetingBriefs.meetingId, meetings.id))
    .leftJoin(meetingSummaries, eq(meetingSummaries.meetingId, meetings.id))
    .where(eq(meetings.ownerUserId, user.id))
    .orderBy(desc(meetings.scheduledAt))
    .limit(limit);

  return NextResponse.json({ meetings: rows });
});
