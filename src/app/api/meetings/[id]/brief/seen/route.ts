/**
 * Marks a brief as delivered.
 *
 * The rep opening the meeting is the moment the notification has done its job,
 * so this is what clears the "new brief" indicator.
 */
import { NextResponse } from "next/server";
import { eq, isNull, and } from "drizzle-orm";

import { db } from "@/db";
import { meetingBriefs } from "@/db/schema";
import { handler, requireOwnedMeeting, requireUser } from "@/lib/api";

export const POST = handler(
  async (_request: Request, context: { params: Promise<{ id: string }> }) => {
    const user = await requireUser();
    const { id } = await context.params;
    const meeting = await requireOwnedMeeting(user.id, id);

    // Only the first view counts; a re-read must not move the timestamp.
    await db
      .update(meetingBriefs)
      .set({ notifiedAt: new Date() })
      .where(
        and(eq(meetingBriefs.meetingId, meeting.id), isNull(meetingBriefs.notifiedAt)),
      );

    return NextResponse.json({ ok: true });
  },
);
