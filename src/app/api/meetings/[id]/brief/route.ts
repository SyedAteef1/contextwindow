/** Generate (or regenerate) the pre-call brief for a meeting, on demand. */
import { NextResponse } from "next/server";

import { generateMeetingBrief } from "@/agents/research";
import { handler, requireOwnedMeeting, requireUser } from "@/lib/api";

// Web search plus a long generation; well past the default serverless budget.
export const maxDuration = 300;

export const POST = handler(
  async (_request: Request, context: { params: Promise<{ id: string }> }) => {
    const user = await requireUser();
    const { id } = await context.params;
    const meeting = await requireOwnedMeeting(user.id, id);

    const brief = await generateMeetingBrief(meeting.id);
    return NextResponse.json({ brief });
  },
);
