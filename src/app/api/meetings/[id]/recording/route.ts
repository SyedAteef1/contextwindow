/**
 * A playable link to the call recording.
 *
 * Providers hand back short-lived signed URLs, so this mints a fresh one each
 * time the rep opens the meeting rather than storing a link that expires
 * somewhere between testing and use. The recording itself lives in the bucket
 * configured on the bot provider; nothing is proxied through here.
 */
import { NextResponse } from "next/server";

import { handler, notFound, requireOwnedMeeting, requireUser } from "@/lib/api";
import { botProvider } from "@/lib/bots";

export const GET = handler(
  async (_request: Request, context: { params: Promise<{ id: string }> }) => {
    const user = await requireUser();
    const { id } = await context.params;
    const meeting = await requireOwnedMeeting(user.id, id);

    if (!meeting.botId) throw notFound("No bot was sent to this meeting");

    // Null rather than 404: a call that ended a minute ago is still uploading,
    // and the interface should say "not ready" rather than "not found".
    const url = await botProvider().fetchRecordingUrl(meeting.botId);
    return NextResponse.json({ url });
  },
);
