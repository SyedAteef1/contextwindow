/**
 * Read queries for server components.
 *
 * Server components talk to the database directly rather than fetching the
 * app's own API — one less network hop, and the ownership filter is right here
 * in the WHERE clause where it can be seen.
 */
import { and, desc, eq, gte, isNull, sql } from "drizzle-orm";
import { redirect } from "next/navigation";

import { db } from "@/db";
import {
  accounts,
  contacts,
  followupEmails,
  followupProposals,
  meetingBriefs,
  meetingSummaries,
  meetings,
  transcripts,
  users,
  type User,
} from "@/db/schema";
import { readSession } from "./session";
import { getUsage } from "./usage";

/** The signed-in rep, or a redirect to the sign-in page. */
export async function currentUser(): Promise<User> {
  const session = await readSession();
  if (!session) redirect("/");

  const user = await db.query.users.findFirst({ where: eq(users.id, session.userId) });
  if (!user) redirect("/");
  return user;
}

/** Null instead of a redirect — for pages that render either way. */
export async function maybeCurrentUser(): Promise<User | null> {
  const session = await readSession();
  if (!session) return null;
  return (await db.query.users.findFirst({ where: eq(users.id, session.userId) })) ?? null;
}

export async function listMeetingsForRail(userId: string) {
  const rows = await db
    .select({
      id: meetings.id,
      title: meetings.title,
      scheduledAt: meetings.scheduledAt,
      status: meetings.status,
      attendees: meetings.attendees,
      companyName: accounts.companyName,
      domain: accounts.domain,
      dealStage: accounts.dealStage,
      briefId: meetingBriefs.id,
      briefNotifiedAt: meetingBriefs.notifiedAt,
      summaryId: meetingSummaries.id,
      intentSignals: meetingSummaries.intentSignals,
    })
    .from(meetings)
    .innerJoin(accounts, eq(accounts.id, meetings.accountId))
    .leftJoin(meetingBriefs, eq(meetingBriefs.meetingId, meetings.id))
    .leftJoin(meetingSummaries, eq(meetingSummaries.meetingId, meetings.id))
    .where(eq(meetings.ownerUserId, userId))
    .orderBy(desc(meetings.scheduledAt))
    .limit(120);

  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    scheduledAt: row.scheduledAt.toISOString(),
    status: row.status,
    companyName: row.companyName,
    domain: row.domain,
    dealStage: row.dealStage,
    hasBrief: Boolean(row.briefId),
    briefUnread: Boolean(row.briefId) && !row.briefNotifiedAt,
    hasSummary: Boolean(row.summaryId),
    buyingInterest: row.intentSignals?.buyingInterest ?? null,
    attendeeCount: row.attendees?.length ?? 0,
  }));
}

/**
 * The rail, split at now.
 *
 * Done here rather than in the sidebar because the clock is an impure input and
 * a component must not read one during render — the same reason
 * `loadMeetingDetail` resolves `isPast` before returning.
 */
export async function listMeetingsSplit(userId: string) {
  const rows = await listMeetingsForRail(userId);
  const now = Date.now();
  const at = (row: (typeof rows)[number]) => Date.parse(row.scheduledAt);
  return {
    rows,
    upcoming: rows.filter((row) => at(row) >= now).sort((a, b) => at(a) - at(b)),
    past: rows.filter((row) => at(row) < now).sort((a, b) => at(b) - at(a)),
  };
}

export async function meetingCounts(userId: string) {
  const [row] = await db
    .select({
      // `now()` rather than a bound JS Date: postgres.js cannot serialise a raw
      // Date interpolated into a sql`` fragment, and the database's clock is
      // the right one to compare against anyway.
      upcoming: sql<number>`count(*) filter (where ${meetings.scheduledAt} >= now())::int`,
      needsAttention: sql<number>`count(*) filter (where ${meetings.status} in ('failed','skipped_quota'))::int`,
      total: sql<number>`count(*)::int`,
    })
    .from(meetings)
    .where(eq(meetings.ownerUserId, userId));

  return row ?? { upcoming: 0, needsAttention: 0, total: 0 };
}

/** Everything the meeting detail page renders, in one round of queries. */
export async function loadMeetingDetail(userId: string, meetingId: string) {
  const meeting = await db.query.meetings.findFirst({
    where: and(eq(meetings.id, meetingId), eq(meetings.ownerUserId, userId)),
  });
  if (!meeting) return null;

  const [account, brief, summary, transcript, proposals, recapEmail] = await Promise.all([
    db.query.accounts.findFirst({ where: eq(accounts.id, meeting.accountId) }),
    db.query.meetingBriefs.findFirst({ where: eq(meetingBriefs.meetingId, meeting.id) }),
    db.query.meetingSummaries.findFirst({ where: eq(meetingSummaries.meetingId, meeting.id) }),
    db.query.transcripts.findFirst({ where: eq(transcripts.meetingId, meeting.id) }),
    db
      .select()
      .from(followupProposals)
      .where(eq(followupProposals.meetingId, meeting.id))
      .orderBy(desc(followupProposals.createdAt)),
    db.query.followupEmails.findFirst({ where: eq(followupEmails.meetingId, meeting.id) }),
  ]);

  return {
    meeting,
    account: account!,
    brief,
    summary,
    transcript,
    proposals,
    recapEmail,
    // Resolved here rather than during render: the clock is an impure input,
    // and a server component's render must not depend on one.
    isPast: meeting.scheduledAt.getTime() < Date.now(),
  };
}

export async function listAccounts(userId: string) {
  const rows = await db
    .select({
      id: accounts.id,
      companyName: accounts.companyName,
      domain: accounts.domain,
      industry: accounts.industry,
      dealStage: accounts.dealStage,
      meetingCount: sql<number>`count(distinct ${meetings.id})::int`,
      lastMeetingAt: sql<Date | null>`max(${meetings.scheduledAt})`,
      nextMeetingAt: sql<Date | null>`min(${meetings.scheduledAt}) filter (where ${meetings.scheduledAt} >= now())`,
    })
    .from(accounts)
    .leftJoin(meetings, eq(meetings.accountId, accounts.id))
    .where(eq(accounts.ownerUserId, userId))
    .groupBy(accounts.id)
    .orderBy(desc(sql`max(${meetings.scheduledAt})`), desc(accounts.createdAt));

  return rows;
}

export async function loadAccountDetail(userId: string, accountId: string) {
  const account = await db.query.accounts.findFirst({
    where: and(eq(accounts.id, accountId), eq(accounts.ownerUserId, userId)),
  });
  if (!account) return null;

  const [accountContacts, history, quota] = await Promise.all([
    db.select().from(contacts).where(eq(contacts.accountId, account.id)),
    db
      .select({
        id: meetings.id,
        title: meetings.title,
        scheduledAt: meetings.scheduledAt,
        status: meetings.status,
        summaryId: meetingSummaries.id,
        intentSignals: meetingSummaries.intentSignals,
      })
      .from(meetings)
      .leftJoin(meetingSummaries, eq(meetingSummaries.meetingId, meetings.id))
      .where(eq(meetings.accountId, account.id))
      .orderBy(desc(meetings.scheduledAt)),
    getUsage(account.id),
  ]);

  return { account, contacts: accountContacts, history, usage: quota };
}

/** Follow-ups still waiting on a decision, across every account. */
export async function pendingFollowups(userId: string) {
  return db
    .select({
      id: followupProposals.id,
      title: followupProposals.title,
      proposedStart: followupProposals.proposedStart,
      companyName: accounts.companyName,
      meetingId: followupProposals.meetingId,
    })
    .from(followupProposals)
    .innerJoin(accounts, eq(accounts.id, followupProposals.accountId))
    .where(
      and(eq(accounts.ownerUserId, userId), eq(followupProposals.status, "pending")),
    )
    .orderBy(followupProposals.proposedStart);
}

/**
 * Briefs written but not yet opened, for calls that haven't happened.
 *
 * This is the in-app notification: the research agent finishes in the
 * background, and this is how the rep finds out.
 */
export async function unreadBriefs(userId: string) {
  return db
    .select({
      meetingId: meetings.id,
      title: meetings.title,
      scheduledAt: meetings.scheduledAt,
      companyName: accounts.companyName,
    })
    .from(meetingBriefs)
    .innerJoin(meetings, eq(meetings.id, meetingBriefs.meetingId))
    .innerJoin(accounts, eq(accounts.id, meetings.accountId))
    .where(
      and(
        eq(meetings.ownerUserId, userId),
        isNull(meetingBriefs.notifiedAt),
        sql`${meetings.scheduledAt} >= now()`,
      ),
    )
    .orderBy(meetings.scheduledAt);
}

/** Meetings starting soon that still have no brief — the thing a rep needs now. */
export async function unbriefedSoon(userId: string) {
  const now = new Date();
  return db
    .select({ id: meetings.id })
    .from(meetings)
    .leftJoin(meetingBriefs, eq(meetingBriefs.meetingId, meetings.id))
    .where(
      and(
        eq(meetings.ownerUserId, userId),
        gte(meetings.scheduledAt, now),
        sql`${meetingBriefs.id} is null`,
      ),
    );
}
