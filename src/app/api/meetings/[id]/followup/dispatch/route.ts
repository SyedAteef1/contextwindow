/**
 * The one click at the end of a call.
 *
 * Sends the recap email and books the follow-up meeting in a single request,
 * because asking a rep to approve the same call's output twice is how follow-ups
 * stop happening. Both halves are drafted by the wrap-up agent; neither leaves
 * the building until this route is called.
 *
 * Ordering matters. The email goes first and is committed before the calendar
 * is touched, so a calendar failure can never make us re-send an email that has
 * already reached the customer. Each half reports its own outcome.
 */
import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db";
import { followupEmails, followupProposals } from "@/db/schema";
import { badRequest, handler, readJson, requireOwnedMeeting, requireUser } from "@/lib/api";
import { createCalendarEvent } from "@/lib/google/calendar";
import { sendEmail } from "@/lib/google/gmail";
import { getAccessTokenForUser } from "@/lib/google/oauth";

/** The rep can edit either draft before dispatching, or skip either half. */
const bodySchema = z.object({
  sendEmail: z.boolean().default(true),
  scheduleMeeting: z.boolean().default(true),
  email: z
    .object({
      subject: z.string().min(1).optional(),
      body: z.string().min(1).optional(),
      recipients: z.array(z.email()).min(1).optional(),
    })
    .optional(),
  meeting: z
    .object({
      title: z.string().min(1).optional(),
      agenda: z.string().min(1).optional(),
      startIso: z.string().datetime({ offset: true }).optional(),
      durationMinutes: z.number().int().min(15).max(240).optional(),
      attendeeEmails: z.array(z.email()).optional(),
    })
    .optional(),
});

export const POST = handler(
  async (request: Request, context: { params: Promise<{ id: string }> }) => {
    const user = await requireUser();
    const { id } = await context.params;
    const meeting = await requireOwnedMeeting(user.id, id);
    const body = await readJson(request, (value) => bodySchema.parse(value ?? {}));

    const [emailDraft, proposal] = await Promise.all([
      db.query.followupEmails.findFirst({ where: eq(followupEmails.meetingId, meeting.id) }),
      db.query.followupProposals.findFirst({
        where: eq(followupProposals.meetingId, meeting.id),
      }),
    ]);

    const wantsEmail = body.sendEmail && emailDraft?.status === "pending";
    const wantsMeeting = body.scheduleMeeting && proposal?.status === "pending";

    if (!wantsEmail && !wantsMeeting) {
      throw badRequest("Nothing left to dispatch for this meeting.");
    }

    // One token for both calls; fetching it up front means a stale-credential
    // failure happens before anything has been sent.
    const accessToken = await getAccessTokenForUser(user.id);

    let sentEmail: { id: string; threadId: string; recipients: string[] } | null = null;

    if (wantsEmail && emailDraft) {
      const subject = body.email?.subject ?? emailDraft.subject;
      const text = body.email?.body ?? emailDraft.body;
      const recipients = body.email?.recipients ?? emailDraft.recipients ?? [];
      if (recipients.length === 0) throw badRequest("The recap has no recipients.");

      // Claim the draft before sending. If two clicks race, the loser sees no
      // rows updated and never reaches Gmail.
      const [claimed] = await db
        .update(followupEmails)
        .set({ status: "approved", subject, body: text, recipients, updatedAt: new Date() })
        .where(
          and(eq(followupEmails.id, emailDraft.id), eq(followupEmails.status, "pending")),
        )
        .returning();
      if (!claimed) throw badRequest("This recap was already sent.");

      try {
        const message = await sendEmail(accessToken, { to: recipients, subject, body: text });
        await db
          .update(followupEmails)
          .set({
            sentAt: new Date(),
            sentByUserId: user.id,
            gmailMessageId: message.id,
            gmailThreadId: message.threadId,
            updatedAt: new Date(),
          })
          .where(eq(followupEmails.id, emailDraft.id));
        sentEmail = { id: message.id, threadId: message.threadId, recipients };
      } catch (error) {
        // Nothing went out, so hand the draft back rather than stranding it in
        // a state the rep cannot retry from.
        await db
          .update(followupEmails)
          .set({ status: "pending", updatedAt: new Date() })
          .where(eq(followupEmails.id, emailDraft.id));
        throw error;
      }
    }

    let calendarEvent: { id: string; htmlLink: string | null } | null = null;

    if (wantsMeeting && proposal) {
      const start = body.meeting?.startIso
        ? new Date(body.meeting.startIso)
        : proposal.proposedStart;
      const end = body.meeting?.durationMinutes
        ? new Date(start.getTime() + body.meeting.durationMinutes * 60_000)
        : new Date(
            start.getTime() + (proposal.proposedEnd.getTime() - proposal.proposedStart.getTime()),
          );
      if (end <= start) throw badRequest("Follow-up must end after it starts.");

      const title = body.meeting?.title ?? proposal.title;
      const agenda = body.meeting?.agenda ?? proposal.agenda;
      const attendeeEmails = body.meeting?.attendeeEmails ?? proposal.attendeeEmails ?? [];

      const [claimed] = await db
        .update(followupProposals)
        .set({ status: "approved", updatedAt: new Date() })
        .where(
          and(eq(followupProposals.id, proposal.id), eq(followupProposals.status, "pending")),
        )
        .returning();
      if (!claimed) throw badRequest("This follow-up was already actioned.");

      try {
        const event = await createCalendarEvent(accessToken, {
          summary: title,
          description: agenda,
          start,
          end,
          attendeeEmails,
        });
        await db
          .update(followupProposals)
          .set({
            title,
            agenda,
            proposedStart: start,
            proposedEnd: end,
            attendeeEmails,
            approvedAt: new Date(),
            approvedByUserId: user.id,
            createdCalendarEventId: event.id,
            updatedAt: new Date(),
          })
          .where(eq(followupProposals.id, proposal.id));
        calendarEvent = { id: event.id, htmlLink: event.htmlLink ?? null };
      } catch (error) {
        await db
          .update(followupProposals)
          .set({ status: "pending", updatedAt: new Date() })
          .where(eq(followupProposals.id, proposal.id));
        // The email may already be away; say so rather than implying a clean
        // failure the rep can simply retry.
        if (sentEmail) {
          return NextResponse.json(
            {
              email: sentEmail,
              calendarEvent: null,
              error: `The recap was sent, but the follow-up meeting could not be created: ${
                error instanceof Error ? error.message : "unknown error"
              }`,
            },
            { status: 207 },
          );
        }
        throw error;
      }
    }

    return NextResponse.json({ email: sentEmail, calendarEvent });
  },
);
