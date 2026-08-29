/**
 * Calendar sync — the front of the pipeline.
 *
 * Polls a rep's calendar, decides which events are external sales calls, and
 * for each new one: creates the account and contacts, schedules the bot, and
 * kicks off the pre-call brief.
 *
 * Bots are *scheduled*, not dispatched: we hand the provider a `join_at` and it
 * joins on time by itself. That is what lets this app run on a cheap hourly
 * cron instead of a minute-resolution worker.
 */
import { and, eq, gte, inArray, ne } from "drizzle-orm";

import { db } from "@/db";
import {
  accounts,
  contacts as contactsTable,
  meetings,
  oauthCredentials,
  users,
  type MeetingAttendee,
  type MeetingStatus,
} from "@/db/schema";
import { botProvider } from "@/lib/bots";
import { botWebhookUrl } from "@/lib/bots/webhook-url";
import { env } from "@/lib/env";
import {
  classifyExternalMeeting,
  companyNameFromDomain,
  eventWindow,
  extractMeetingUrl,
  listUpcomingEvents,
  type CalendarEvent,
} from "@/lib/google/calendar";
import { getAccessTokenForUser } from "@/lib/google/oauth";
import { botEntitlement, canGenerateBrief, incrementBriefUsage } from "@/lib/usage";
import { generateMeetingBrief } from "@/agents/research";

export type SyncResult = {
  userId: string;
  eventsScanned: number;
  externalMeetings: number;
  created: number;
  updated: number;
  cancelled: number;
  botsScheduled: number;
  briefsGenerated: number;
  quotaSkipped: number;
  errors: string[];
};

/** Statuses where re-running the pipeline would be pointless or destructive. */
const SETTLED_STATUSES: MeetingStatus[] = ["transcribed", "processed", "cancelled"];

/**
 * Find or create the account for a domain.
 *
 * Accounts are keyed on `(ownerUserId, domain)`: one company, one account, no
 * matter how many meetings or contacts arrive from it.
 */
async function upsertAccount(input: {
  ownerUserId: string;
  domain: string;
}): Promise<{ id: string; companyName: string }> {
  const existing = await db.query.accounts.findFirst({
    where: and(eq(accounts.ownerUserId, input.ownerUserId), eq(accounts.domain, input.domain)),
  });
  if (existing) return { id: existing.id, companyName: existing.companyName };

  // The account inherits the rep's workspace, so the company's own material —
  // pricing, security answers, case studies — is in scope for it from the
  // first meeting rather than only after someone re-indexes.
  const owner = await db.query.users.findFirst({ where: eq(users.id, input.ownerUserId) });

  const [created] = await db
    .insert(accounts)
    .values({
      ownerUserId: input.ownerUserId,
      workspaceId: owner?.workspaceId ?? null,
      companyName: companyNameFromDomain(input.domain),
      domain: input.domain,
    })
    .onConflictDoUpdate({
      target: [accounts.ownerUserId, accounts.domain],
      set: { updatedAt: new Date() },
    })
    .returning();

  return { id: created.id, companyName: created.companyName };
}

/** Record external attendees as contacts, without clobbering enriched rows. */
async function upsertContacts(accountId: string, attendees: MeetingAttendee[]): Promise<void> {
  const externals = attendees.filter((attendee) => attendee.external);
  if (externals.length === 0) return;

  await db
    .insert(contactsTable)
    .values(
      externals.map((attendee) => ({
        accountId,
        email: attendee.email,
        name: attendee.displayName ?? null,
      })),
    )
    // A contact we already know may have a role and decision-maker flag set by
    // hand; a calendar invite must not overwrite that with nulls.
    .onConflictDoNothing({ target: [contactsTable.accountId, contactsTable.email] });
}

async function scheduleBotForMeeting(meetingId: string): Promise<boolean> {
  const meeting = await db.query.meetings.findFirst({ where: eq(meetings.id, meetingId) });
  if (!meeting?.meetingUrl || meeting.botId) return false;

  const joinAt = new Date(
    meeting.scheduledAt.getTime() - env().BOT_JOIN_LEAD_MINUTES * 60_000,
  );

  const scheduled = await botProvider().scheduleBot({
    meetingUrl: meeting.meetingUrl,
    joinAt,
    botName: env().BOT_DISPLAY_NAME,
    metadata: { meetingId: meeting.id, accountId: meeting.accountId },
    // Keyed on our meeting id so a retried sync can't create a second bot.
    deduplicationKey: `meeting:${meeting.id}`,
    webhookUrl: botWebhookUrl(),
    audioWebsocketUrl: env().AUDIO_BRIDGE_URL,
    audioSampleRate: env().AUDIO_SAMPLE_RATE,
    meetingTitle: meeting.title ?? undefined,
    endsAt: meeting.endsAt ?? undefined,
  });

  await db
    .update(meetings)
    .set({
      botId: scheduled.botId,
      botState: scheduled.state,
      status: "bot_scheduled",
      updatedAt: new Date(),
    })
    .where(eq(meetings.id, meeting.id));

  return true;
}

/** Sync one rep's calendar. Errors on one meeting never abort the others. */
export async function syncUserCalendar(userId: string): Promise<SyncResult> {
  const result: SyncResult = {
    userId,
    eventsScanned: 0,
    externalMeetings: 0,
    created: 0,
    updated: 0,
    cancelled: 0,
    botsScheduled: 0,
    briefsGenerated: 0,
    quotaSkipped: 0,
    errors: [],
  };

  const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
  if (!user) throw new Error(`User ${userId} not found`);

  const accessToken = await getAccessTokenForUser(userId);
  const now = new Date();
  const timeMax = new Date(now.getTime() + env().CALENDAR_LOOKAHEAD_DAYS * 86_400_000);

  const events = await listUpcomingEvents(accessToken, { timeMin: now, timeMax });
  result.eventsScanned = events.length;

  const seenEventIds: string[] = [];

  for (const event of events) {
    try {
      const handled = await processEvent({ event, user, result });
      if (handled) seenEventIds.push(event.id);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      result.errors.push(`event ${event.id}: ${message}`);
    }
  }

  result.cancelled = await cancelDisappearedMeetings(userId, seenEventIds, now);

  await db
    .update(users)
    .set({ lastCalendarSyncAt: new Date(), updatedAt: new Date() })
    .where(eq(users.id, userId));

  return result;
}

async function processEvent(input: {
  event: CalendarEvent;
  user: { id: string; email: string; emailDomain: string };
  result: SyncResult;
}): Promise<boolean> {
  const { event, user, result } = input;

  if (event.status === "cancelled") return false;

  const window = eventWindow(event);
  if (!window) return false; // all-day events aren't calls

  const classification = classifyExternalMeeting(event, user.emailDomain, user.email);
  if (!classification || !classification.accountDomain) return false;

  result.externalMeetings += 1;

  const account = await upsertAccount({
    ownerUserId: user.id,
    domain: classification.accountDomain,
  });
  await upsertContacts(account.id, classification.attendees);

  const existing = await db.query.meetings.findFirst({
    where: and(eq(meetings.ownerUserId, user.id), eq(meetings.calendarEventId, event.id)),
  });

  const meetingUrl = extractMeetingUrl(event);
  const shared = {
    title: event.summary ?? null,
    scheduledAt: window.start,
    endsAt: window.end,
    meetingUrl,
    attendees: classification.attendees,
  };

  if (existing) {
    // Don't rewind a meeting that has already been recorded or processed.
    if (SETTLED_STATUSES.includes(existing.status)) return true;

    await db
      .update(meetings)
      .set({ ...shared, updatedAt: new Date() })
      .where(eq(meetings.id, existing.id));
    result.updated += 1;

    await advanceMeeting({ meetingId: existing.id, ownerUserId: user.id, result });
    return true;
  }

  const [created] = await db
    .insert(meetings)
    .values({
      accountId: account.id,
      ownerUserId: user.id,
      calendarEventId: event.id,
      status: "detected",
      ...shared,
    })
    .returning();

  result.created += 1;
  await advanceMeeting({ meetingId: created.id, ownerUserId: user.id, result });
  return true;
}

/**
 * Move a detected meeting forward: write the brief, then schedule the bot.
 *
 * The order is the product.
 *
 * The brief runs first and runs for everyone, because it is what the free plan
 * *is* — connect a calendar and research starts arriving, with nothing to
 * install and no bot in anyone's meeting. The bot is the part that costs real
 * money to run (recording, transcription, a live model held to half a second),
 * so it is what an upgrade buys.
 *
 * These used to be gated together behind one meter, which meant a rep who ran
 * out stopped receiving research as well — the free tier looked broken rather
 * than free.
 */
async function advanceMeeting(input: {
  meetingId: string;
  ownerUserId: string;
  result: SyncResult;
}): Promise<void> {
  const { meetingId, ownerUserId, result } = input;

  // --- The brief. Free, but bounded. -------------------------------------
  // Don't pay for a second brief on a meeting that already has one.
  const brief = await db.query.meetingBriefs.findFirst({
    where: (table, { eq: equals }) => equals(table.meetingId, meetingId),
  });

  if (!brief) {
    if (await canGenerateBrief(ownerUserId)) {
      try {
        await generateMeetingBrief(meetingId);
        await incrementBriefUsage(ownerUserId);
        result.briefsGenerated += 1;
      } catch (error) {
        await recordBriefFailure(meetingId, error, result);
      }
    } else {
      // The ceiling sits far above a working rep's calendar, so reaching it
      // means something is looping rather than that someone is selling hard.
      result.errors.push(`meeting ${meetingId}: monthly brief ceiling reached`);
    }
  }

  // --- The bot. What `pro` buys. -----------------------------------------
  // The meter belongs to the rep. Metering the account instead gave every
  // prospect company its own free tier.
  const entitlement = await botEntitlement(ownerUserId);
  if (!entitlement.allowed) {
    const status = entitlement.reason === "free" ? "bot_requires_upgrade" : "skipped_quota";
    await db
      .update(meetings)
      .set({ status, updatedAt: new Date() })
      .where(and(eq(meetings.id, meetingId), ne(meetings.status, status)));
    if (entitlement.reason === "quota") result.quotaSkipped += 1;
    return;
  }

  try {
    if (await scheduleBotForMeeting(meetingId)) result.botsScheduled += 1;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    result.errors.push(`meeting ${meetingId}: bot scheduling failed — ${message}`);
  }
}

/** A brief that failed is recorded on the meeting, not just in the run log. */
async function recordBriefFailure(
  meetingId: string,
  error: unknown,
  result: SyncResult,
): Promise<void> {
  const message = error instanceof Error ? error.message : String(error);
  result.errors.push(`meeting ${meetingId}: brief generation failed — ${message}`);
  await db
    .update(meetings)
    .set({ errorMessage: message, updatedAt: new Date() })
    .where(eq(meetings.id, meetingId));
}

/**
 * Mark future meetings that vanished from the calendar as cancelled, and cancel
 * their bots so we don't send one into a meeting nobody is attending.
 */
async function cancelDisappearedMeetings(
  userId: string,
  seenEventIds: string[],
  now: Date,
): Promise<number> {
  const upcoming = await db
    .select({ id: meetings.id, botId: meetings.botId, calendarEventId: meetings.calendarEventId })
    .from(meetings)
    .where(
      and(
        eq(meetings.ownerUserId, userId),
        gte(meetings.scheduledAt, now),
        // Anything already recorded or processed is history, not a plan.
        inArray(meetings.status, ["detected", "brief_pending", "brief_ready", "bot_scheduled"]),
      ),
    );

  const seen = new Set(seenEventIds);
  const vanished = upcoming.filter((meeting) => !seen.has(meeting.calendarEventId));

  for (const meeting of vanished) {
    if (meeting.botId) {
      await botProvider().cancelBot(meeting.botId);
    }
    await db
      .update(meetings)
      .set({ status: "cancelled", updatedAt: new Date() })
      .where(eq(meetings.id, meeting.id));
  }

  return vanished.length;
}

/**
 * Sync every connected rep. Used by the cron route.
 *
 * One rep's broken credentials must not stop the others from syncing, so each
 * failure is captured into that rep's own result rather than thrown.
 */
export async function syncAllCalendars(): Promise<SyncResult[]> {
  const connected = await db
    .selectDistinct({ id: users.id })
    .from(users)
    .innerJoin(oauthCredentials, eq(oauthCredentials.userId, users.id))
    .where(eq(oauthCredentials.provider, "google"));

  const results: SyncResult[] = [];
  for (const { id } of connected) {
    try {
      results.push(await syncUserCalendar(id));
    } catch (error) {
      results.push({
        userId: id,
        eventsScanned: 0,
        externalMeetings: 0,
        created: 0,
        updated: 0,
        cancelled: 0,
        botsScheduled: 0,
        briefsGenerated: 0,
        quotaSkipped: 0,
        errors: [error instanceof Error ? error.message : String(error)],
      });
    }
  }
  return results;
}
