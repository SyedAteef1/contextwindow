/**
 * Free-tier metering.
 *
 * The counter is checked before a meeting is processed and incremented only
 * after processing succeeds, so a crashed run doesn't burn a rep's quota.
 */
import { and, eq, lt, sql } from "drizzle-orm";

import { db } from "@/db";
import { usage } from "@/db/schema";
import { env } from "./env";

/** Midnight UTC on the first of the current month. */
export function currentPeriodStart(now: Date = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

export type UsageState = {
  userId: string;
  used: number;
  limit: number;
  remaining: number;
  overLimit: boolean;
  periodStart: Date;
};

/** Fetch the meter for a rep, creating it and rolling the period as needed. */
export async function getUsage(userId: string): Promise<UsageState> {
  const period = currentPeriodStart();

  await db
    .insert(usage)
    .values({
      userId,
      meetingsProcessedThisMonth: 0,
      freeTierLimit: env().FREE_TIER_MEETING_LIMIT,
      periodStart: period,
    })
    .onConflictDoNothing({ target: usage.userId });

  // A stored period older than this month means the month rolled over.
  await db
    .update(usage)
    .set({ meetingsProcessedThisMonth: 0, periodStart: period, updatedAt: new Date() })
    .where(and(eq(usage.userId, userId), lt(usage.periodStart, period)));

  const row = await db.query.usage.findFirst({ where: eq(usage.userId, userId) });
  if (!row) throw new Error(`Failed to initialise usage row for user ${userId}`);

  const used = row.meetingsProcessedThisMonth;
  const limit = row.freeTierLimit;
  return {
    userId,
    used,
    limit,
    remaining: Math.max(0, limit - used),
    overLimit: used >= limit,
    periodStart: row.periodStart,
  };
}

/** True when this rep still has free-tier headroom this month. */
export async function canProcessMeeting(userId: string): Promise<UsageState> {
  return getUsage(userId);
}

/**
 * Record one processed meeting.
 *
 * The increment is a single SQL statement so two webhooks arriving at once
 * can't read-modify-write over each other.
 */
export async function incrementUsage(userId: string): Promise<UsageState> {
  await getUsage(userId); // ensures the row exists and the period is current

  await db
    .update(usage)
    .set({
      meetingsProcessedThisMonth: sql`${usage.meetingsProcessedThisMonth} + 1`,
      updatedAt: new Date(),
    })
    .where(eq(usage.userId, userId));

  return getUsage(userId);
}

/** Raise (or lower) a rep's cap — the hook an upgrade flow would call. */
export async function setFreeTierLimit(userId: string, limit: number): Promise<UsageState> {
  await getUsage(userId);
  await db
    .update(usage)
    .set({ freeTierLimit: limit, updatedAt: new Date() })
    .where(eq(usage.userId, userId));
  return getUsage(userId);
}
