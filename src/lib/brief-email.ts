/**
 * The pre-call brief, delivered by email.
 *
 * A brief that only exists in a tab is a brief nobody reads. This puts it in
 * the rep's inbox the moment it is written, which is usually days before the
 * call and long before they would think to go looking.
 *
 * It goes to the rep and nobody else. The product's rule that nothing reaches a
 * customer without a human pressing send is untouched: this is a notification
 * to yourself, sent from your own mailbox, and no attendee is ever a recipient.
 */
import { and, eq, isNull } from "drizzle-orm";

import { db } from "@/db";
import { accounts, meetingBriefs, meetings, users } from "@/db/schema";
import { env } from "@/lib/env";
import { sendEmail } from "@/lib/google/gmail";
import { getAccessTokenForUser } from "@/lib/google/oauth";

/**
 * Markdown, flattened for mail.
 *
 * The Gmail renderer understands blank-line paragraphs and `- ` bullets, so the
 * job here is only to strip what it does not: heading hashes, bold markers, and
 * inline link syntax. Headings become their own short line, which reads as a
 * section break without needing HTML.
 */
export function briefToPlainText(markdown: string): string {
  return markdown
    .split("\n")
    .map((line) => {
      const heading = line.match(/^\s{0,3}#{1,6}\s+(.*)$/);
      if (heading) return heading[1].trim().toUpperCase();
      return line
        .replace(/^\s{0,3}[*+]\s+/, "- ")
        .replace(/\*\*(.+?)\*\*/g, "$1")
        .replace(/(?<!\w)\*(?!\s)(.+?)(?<!\s)\*(?!\w)/g, "$1")
        .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1 ($2)")
        .trimEnd();
    })
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Local date and time, in the rep's own words rather than an ISO string. */
function whenLine(scheduledAt: Date): string {
  return scheduledAt.toLocaleString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  });
}

export type BriefEmailResult =
  | { sent: true; messageId: string }
  | { sent: false; reason: string };

/**
 * Email the brief for one meeting, once.
 *
 * Returns rather than throws on every path a caller cannot act on: this runs
 * inside brief generation, and a mail failure must not cost the rep the brief.
 */
export async function sendBriefEmail(meetingId: string): Promise<BriefEmailResult> {
  if (!env().BRIEF_EMAIL_ENABLED) return { sent: false, reason: "disabled" };

  const meeting = await db.query.meetings.findFirst({ where: eq(meetings.id, meetingId) });
  if (!meeting) return { sent: false, reason: "meeting not found" };

  const [brief, account, owner] = await Promise.all([
    db.query.meetingBriefs.findFirst({ where: eq(meetingBriefs.meetingId, meetingId) }),
    db.query.accounts.findFirst({ where: eq(accounts.id, meeting.accountId) }),
    db.query.users.findFirst({ where: eq(users.id, meeting.ownerUserId) }),
  ]);
  if (!brief) return { sent: false, reason: "no brief" };
  if (!owner) return { sent: false, reason: "no owner" };
  if (brief.emailedAt) return { sent: false, reason: "already emailed" };

  const company = account?.companyName ?? "this account";
  const externals = (meeting.attendees ?? []).filter((attendee) => attendee.external);

  const body = [
    `Your brief for ${company} is ready.`,
    ``,
    `${meeting.title ?? "Meeting"} — ${whenLine(meeting.scheduledAt)}`,
    externals.length
      ? `In the room: ${externals.map((a) => a.displayName || a.email).join(", ")}`
      : null,
    ``,
    briefToPlainText(brief.content),
    brief.citations?.length
      ? [``, `SOURCES`, ...brief.citations.map((c, i) => `${i + 1}. ${c.title} — ${c.url}`)].join(
          "\n",
        )
      : null,
    ``,
    `Open it: ${env().APP_URL.replace(/\/+$/, "")}/meetings/${meeting.id}`,
  ]
    .filter((line) => line !== null)
    .join("\n");

  // Claimed before sending, so two callers racing cannot both email it.
  const [claimed] = await db
    .update(meetingBriefs)
    .set({ emailedAt: new Date() })
    .where(and(eq(meetingBriefs.id, brief.id), isNull(meetingBriefs.emailedAt)))
    .returning();
  if (!claimed) return { sent: false, reason: "already emailed" };

  try {
    const accessToken = await getAccessTokenForUser(owner.id);
    const message = await sendEmail(accessToken, {
      to: [owner.email],
      subject: `Brief — ${company}, ${whenLine(meeting.scheduledAt)}`,
      body,
    });
    return { sent: true, messageId: message.id };
  } catch (error) {
    // Hand the claim back so a retry is possible rather than silently lost.
    await db
      .update(meetingBriefs)
      .set({ emailedAt: null })
      .where(eq(meetingBriefs.id, brief.id));
    throw error;
  }
}
