/**
 * The command palette's index.
 *
 * One request, everything the palette can jump to. Fetched once when the
 * palette first opens rather than on every keystroke: a rep has tens of
 * meetings, not thousands, so the whole index fits in a single response and
 * filtering it locally is instant in a way a debounced round trip never is.
 */
import { NextResponse } from "next/server";

import { handler, requireUser } from "@/lib/api";
import { listAccounts, listMeetingsForRail } from "@/lib/queries";

export const dynamic = "force-dynamic";

export const GET = handler(async () => {
  const user = await requireUser();
  const [meetings, accounts] = await Promise.all([
    listMeetingsForRail(user.id),
    listAccounts(user.id),
  ]);

  return NextResponse.json({
    meetings: meetings.map((m) => ({
      id: m.id,
      title: m.title,
      company: m.companyName,
      domain: m.domain,
      at: m.scheduledAt,
      status: m.status,
    })),
    accounts: accounts.map((a) => ({
      id: a.id,
      company: a.companyName,
      domain: a.domain,
      meetings: a.meetingCount,
    })),
  });
});
