/**
 * The approval gate.
 *
 * This is the only place in the codebase that writes to Google Calendar. The
 * wrap-up agent drafts; nothing is created until a rep posts here.
 */
import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db";
import { followupProposals } from "@/db/schema";
import { badRequest, handler, notFound, readJson, requireOwnedAccount, requireUser } from "@/lib/api";
import { createCalendarEvent } from "@/lib/google/calendar";
import { getAccessTokenForUser } from "@/lib/google/oauth";

/** The rep can adjust the draft before approving; edits are optional. */
const bodySchema = z
  .object({
    title: z.string().min(1).optional(),
    agenda: z.string().min(1).optional(),
    startIso: z.string().datetime({ offset: true }).optional(),
    durationMinutes: z.number().int().min(15).max(240).optional(),
    attendeeEmails: z.array(z.email()).optional(),
  })
  .default({});

export const POST = handler(
  async (request: Request, context: { params: Promise<{ id: string }> }) => {
    const user = await requireUser();
    const { id } = await context.params;

    const proposal = await db.query.followupProposals.findFirst({
      where: eq(followupProposals.id, id),
    });
    if (!proposal) throw notFound("Follow-up proposal not found");

    // Ownership travels through the account, not the proposal.
    await requireOwnedAccount(user.id, proposal.accountId);

    if (proposal.status === "approved") {
      throw badRequest("This follow-up has already been approved.");
    }
    if (proposal.status === "rejected") {
      throw badRequest("This follow-up was rejected; draft a new one instead.");
    }

    const body = await readJson(request, (value) => bodySchema.parse(value ?? {}));

    const start = body.startIso ? new Date(body.startIso) : proposal.proposedStart;
    const end = body.durationMinutes
      ? new Date(start.getTime() + body.durationMinutes * 60_000)
      : new Date(start.getTime() + (proposal.proposedEnd.getTime() - proposal.proposedStart.getTime()));

    if (end <= start) throw badRequest("Follow-up must end after it starts.");

    const title = body.title ?? proposal.title;
    const agenda = body.agenda ?? proposal.agenda;
    const attendeeEmails = body.attendeeEmails ?? proposal.attendeeEmails ?? [];

    const accessToken = await getAccessTokenForUser(user.id);
    const event = await createCalendarEvent(accessToken, {
      summary: title,
      description: agenda,
      start,
      end,
      attendeeEmails,
    });

    const [updated] = await db
      .update(followupProposals)
      .set({
        title,
        agenda,
        proposedStart: start,
        proposedEnd: end,
        attendeeEmails,
        status: "approved",
        approvedAt: new Date(),
        approvedByUserId: user.id,
        createdCalendarEventId: event.id,
        updatedAt: new Date(),
      })
      // Guard against a double-click racing itself into two calendar events.
      .where(
        and(eq(followupProposals.id, proposal.id), eq(followupProposals.status, "pending")),
      )
      .returning();

    if (!updated) throw badRequest("This follow-up was already actioned.");

    return NextResponse.json({
      proposal: updated,
      calendarEvent: { id: event.id, htmlLink: event.htmlLink ?? null },
    });
  },
);
