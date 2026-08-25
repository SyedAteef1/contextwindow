/** One meeting with everything attached to it. */
import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";

import { db } from "@/db";
import {
  accounts,
  followupProposals,
  meetingBriefs,
  meetingSummaries,
  transcripts,
} from "@/db/schema";
import { handler, requireOwnedMeeting, requireUser } from "@/lib/api";

export const GET = handler(
  async (_request: Request, context: { params: Promise<{ id: string }> }) => {
    const user = await requireUser();
    const { id } = await context.params;
    const meeting = await requireOwnedMeeting(user.id, id);

    const [account, brief, summary, transcript, proposals] = await Promise.all([
      db.query.accounts.findFirst({ where: eq(accounts.id, meeting.accountId) }),
      db.query.meetingBriefs.findFirst({ where: eq(meetingBriefs.meetingId, meeting.id) }),
      db.query.meetingSummaries.findFirst({ where: eq(meetingSummaries.meetingId, meeting.id) }),
      db.query.transcripts.findFirst({ where: eq(transcripts.meetingId, meeting.id) }),
      db
        .select()
        .from(followupProposals)
        .where(eq(followupProposals.meetingId, meeting.id))
        .orderBy(desc(followupProposals.createdAt)),
    ]);

    return NextResponse.json({
      meeting,
      account,
      brief: brief ?? null,
      summary: summary ?? null,
      transcript: transcript
        ? {
            id: transcript.id,
            source: transcript.source,
            durationSeconds: transcript.durationSeconds,
            segmentCount: transcript.speakerSegments?.length ?? 0,
            rawText: transcript.rawText,
          }
        : null,
      followupProposals: proposals,
    });
  },
);
