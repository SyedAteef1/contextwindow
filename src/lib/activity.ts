/**
 * Recording what a rep did.
 *
 * Two rules, and both are about staying out of the way.
 *
 * It never fails the thing it is observing. A rep approving a follow-up must
 * not see an error because a log insert deadlocked, so every failure here is
 * caught and printed and the request carries on. The work already happened;
 * the record of it is strictly less important than the work.
 *
 * And it never waits. Callers do not await `track` — the person who triggered
 * it is waiting on a response, and no audit row is worth a slower page.
 *
 * What it holds is bounded on purpose: a user, a verb, a subject and a time,
 * plus a little non-identifying detail. No IP, no fingerprint, no page URL —
 * the same promise the privacy policy already makes about sign-ins, and none of
 * those answer the question this table exists for.
 */
import { and, desc, eq, gte } from "drizzle-orm";

import { db } from "@/db";
import { activityEvents } from "@/db/schema";

export type ActivityAction =
  | "calendar_synced"
  | "brief_generated"
  | "brief_opened"
  | "transcript_uploaded"
  | "chat_asked"
  | "followup_approved"
  | "followup_rejected"
  | "recap_sent"
  | "upgrade_requested";

export type ActivityInput = {
  userId: string;
  action: ActivityAction;
  subjectType?: "meeting" | "account" | "workspace";
  subjectId?: string;
  detail?: Record<string, string | number | boolean>;
};

/** Fire and forget. Never awaited, never throws into the caller. */
export function track(input: ActivityInput): void {
  void (async () => {
    try {
      await db.insert(activityEvents).values({
        userId: input.userId,
        action: input.action,
        subjectType: input.subjectType ?? null,
        subjectId: input.subjectId ?? null,
        detail: input.detail ?? null,
      });
    } catch (error) {
      console.error(`Failed to record activity (${input.action}):`, error);
    }
  })();
}

/**
 * The same insert, awaited.
 *
 * For a caller that is already inside a transaction or a script and wants the
 * row to exist before it moves on. Still swallows its own failure.
 */
export async function trackNow(input: ActivityInput): Promise<void> {
  try {
    await db.insert(activityEvents).values({
      userId: input.userId,
      action: input.action,
      subjectType: input.subjectType ?? null,
      subjectId: input.subjectId ?? null,
      detail: input.detail ?? null,
    });
  } catch (error) {
    console.error(`Failed to record activity (${input.action}):`, error);
  }
}

/** One rep's trail, most recent first. */
export async function recentActivity(userId: string, limit = 50) {
  return db
    .select()
    .from(activityEvents)
    .where(eq(activityEvents.userId, userId))
    .orderBy(desc(activityEvents.createdAt))
    .limit(limit);
}

/** Everything since a point in time, for the whole deployment. */
export async function activitySince(since: Date, limit = 500) {
  return db
    .select()
    .from(activityEvents)
    .where(gte(activityEvents.createdAt, since))
    .orderBy(desc(activityEvents.createdAt))
    .limit(limit);
}

/** Whether a rep has done anything at all lately — the churn question. */
export async function lastActiveAt(userId: string): Promise<Date | null> {
  const [row] = await db
    .select({ at: activityEvents.createdAt })
    .from(activityEvents)
    .where(and(eq(activityEvents.userId, userId)))
    .orderBy(desc(activityEvents.createdAt))
    .limit(1);
  return row?.at ?? null;
}
