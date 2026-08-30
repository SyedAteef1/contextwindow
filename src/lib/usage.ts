/**
 * Free-tier metering.
 *
 * The counter is checked before a meeting is processed and incremented only
 * after processing succeeds, so a crashed run doesn't burn a rep's quota.
 */
import { and, eq, lt, sql } from "drizzle-orm";

import { db } from "@/db";
import { quoteRequests, usage, users, workspaces } from "@/db/schema";
import { env } from "./env";

export type Plan = "free" | "pro";

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
  /** Briefs are free; this meter only exists so the bill cannot run away. */
  briefsUsed: number;
  briefLimit: number;
  briefsExhausted: boolean;
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
    .set({
      meetingsProcessedThisMonth: 0,
      briefsThisMonth: 0,
      periodStart: period,
      updatedAt: new Date(),
    })
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
    briefsUsed: row.briefsThisMonth,
    briefLimit: row.briefLimit,
    briefsExhausted: row.briefsThisMonth >= row.briefLimit,
  };
}

/**
 * What this rep's company is entitled to.
 *
 * Read through the workspace rather than the user: a sales team buys together,
 * so the second rep at a company that has already upgraded should not have to
 * buy it again. A rep with no workspace row cannot happen — the OAuth upsert
 * creates one — but the fallback keeps a missing row cheap rather than fatal.
 */
export async function planForUser(userId: string): Promise<Plan> {
  const row = await db
    .select({ plan: workspaces.plan })
    .from(users)
    .innerJoin(workspaces, eq(users.workspaceId, workspaces.id))
    .where(eq(users.id, userId))
    .limit(1);
  return row[0]?.plan ?? "free";
}

/**
 * Whether a bot may be sent to this rep's call.
 *
 * Two different refusals, and the caller has to tell them apart: `free` means
 * the plan does not include a notetaker at all, `quota` means it does and the
 * month is spent. One is an offer, the other is a limit.
 */
export async function botEntitlement(
  userId: string,
): Promise<{ allowed: true } | { allowed: false; reason: "free" | "quota" }> {
  if ((await planForUser(userId)) === "free") return { allowed: false, reason: "free" };
  const quota = await getUsage(userId);
  return quota.overLimit ? { allowed: false, reason: "quota" } : { allowed: true };
}

/** Whether another brief may be written this month. */
export async function canGenerateBrief(userId: string): Promise<boolean> {
  const state = await getUsage(userId);
  return !state.briefsExhausted;
}

/** Record one brief written. Same single-statement increment as the meter above. */
export async function incrementBriefUsage(userId: string): Promise<UsageState> {
  await getUsage(userId);
  await db
    .update(usage)
    .set({
      briefsThisMonth: sql`${usage.briefsThisMonth} + 1`,
      updatedAt: new Date(),
    })
    .where(eq(usage.userId, userId));
  return getUsage(userId);
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

/**
 * Whether this workspace is already waiting on a price.
 *
 * Asked by every surface that shows the upgrade prompt, so a rep who requested
 * a quote on Monday is not asked again on Tuesday by a different screen.
 */
export async function hasOpenQuoteRequest(userId: string): Promise<boolean> {
  const rows = await db
    .select({ id: quoteRequests.id })
    .from(users)
    .innerJoin(quoteRequests, eq(quoteRequests.workspaceId, users.workspaceId))
    .where(and(eq(users.id, userId), eq(quoteRequests.status, "requested")))
    .limit(1);
  return rows.length > 0;
}
