/**
 * Asking Google to tell us when a calendar changes.
 *
 * The scheduler polls every five minutes, which is fine for a meeting booked
 * next Tuesday and wrong for one booked for this afternoon: the rep watches an
 * empty dashboard and concludes it does not work. A watch channel closes that
 * gap to seconds — Google POSTs the moment an event is created, moved or
 * deleted, and we sync that one rep straight away.
 *
 * Google requires the receiving domain to be verified before it will open a
 * channel, so this fails loudly with the reason rather than silently degrading:
 * a deployment that quietly falls back to polling looks identical to one where
 * this works, right up until someone asks why briefs are late.
 */
import { randomUUID } from "node:crypto";
import { and, eq, lt } from "drizzle-orm";

import { db } from "@/db";
import { calendarChannels } from "@/db/schema";
import { env } from "@/lib/env";
import { getAccessTokenForUser } from "@/lib/google/oauth";

const CALENDAR_API = "https://www.googleapis.com/calendar/v3";

/** Google caps a calendar channel at about a week; renew well before that. */
const RENEW_WITHIN_MS = 24 * 60 * 60 * 1000;

/** Where Google should POST. Must be https and on a domain Google has verified. */
function receiverUrl(): string {
  const base = (env().WEBHOOK_BASE_URL || env().APP_URL).replace(/\/+$/, "");
  return `${base}/api/webhooks/calendar`;
}

type WatchResponse = { id: string; resourceId: string; expiration?: string };

/**
 * Open a channel for one rep, replacing any they already have.
 *
 * Replacing rather than adding: two channels on the same calendar means two
 * notifications for every change and two syncs racing each other.
 */
export async function startCalendarWatch(userId: string): Promise<{ expiresAt: Date } | null> {
  const receiver = receiverUrl();
  if (!receiver.startsWith("https://")) {
    console.warn(`Calendar watch skipped: ${receiver} is not https, which Google requires.`);
    return null;
  }

  await stopCalendarWatch(userId);

  const accessToken = await getAccessTokenForUser(userId);
  const channelId = randomUUID();
  // Echoed back on every notification, so a POST from anywhere else is refused.
  const token = `${userId}:${env().WEBHOOK_SECRET}`;

  const response = await fetch(`${CALENDAR_API}/calendars/primary/events/watch`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ id: channelId, type: "web_hook", address: receiver, token }),
  });

  if (!response.ok) {
    const body = await response.text();
    // The overwhelmingly common cause, and the message Google returns for it is
    // not obvious, so say the actual fix.
    if (body.includes("WebhookCallbackUrlNoDomainVerification") || body.includes("unauthorizedWebhookCallbackChannel")) {
      throw new Error(
        `Google will not send calendar notifications to ${receiver} until that domain is verified. ` +
          `Verify it in Search Console, then add it under APIs & Services → Domain verification.`,
      );
    }
    throw new Error(`Opening a calendar watch failed (${response.status}): ${body}`);
  }

  const data = (await response.json()) as WatchResponse;
  // Google returns the expiry in milliseconds since the epoch, as a string.
  const expiresAt = data.expiration
    ? new Date(Number(data.expiration))
    : new Date(Date.now() + 6 * 24 * 60 * 60 * 1000);

  await db.insert(calendarChannels).values({
    userId,
    channelId: data.id ?? channelId,
    resourceId: data.resourceId,
    token,
    expiresAt,
  });

  return { expiresAt };
}

/** Close any channels this rep has, and forget them. */
export async function stopCalendarWatch(userId: string): Promise<void> {
  const existing = await db
    .select()
    .from(calendarChannels)
    .where(eq(calendarChannels.userId, userId));
  if (existing.length === 0) return;

  for (const channel of existing) {
    try {
      const accessToken = await getAccessTokenForUser(userId);
      await fetch(`${CALENDAR_API}/channels/stop`, {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ id: channel.channelId, resourceId: channel.resourceId }),
      });
    } catch (error) {
      // A channel we cannot stop expires on its own within the week. Failing to
      // close it must not stop us opening a working one.
      console.error(`Stopping calendar channel ${channel.channelId} failed:`, error);
    }
  }

  await db.delete(calendarChannels).where(eq(calendarChannels.userId, userId));
}

/** Match an incoming notification to the rep it belongs to. */
export async function channelOwner(
  channelId: string,
  token: string,
): Promise<{ userId: string } | null> {
  const [channel] = await db
    .select()
    .from(calendarChannels)
    .where(and(eq(calendarChannels.channelId, channelId), eq(calendarChannels.token, token)))
    .limit(1);
  return channel ? { userId: channel.userId } : null;
}

/**
 * Renew anything close to expiry. Called from the scheduler.
 *
 * A channel that lapses is silent rather than loud — notifications simply stop
 * — so this runs on the same tick as the poll, and the poll is what covers the
 * gap if a renewal fails.
 */
export async function renewExpiringWatches(): Promise<{ renewed: number; failed: number }> {
  const due = await db
    .select()
    .from(calendarChannels)
    .where(lt(calendarChannels.expiresAt, new Date(Date.now() + RENEW_WITHIN_MS)));

  let renewed = 0;
  let failed = 0;
  for (const channel of due) {
    try {
      await startCalendarWatch(channel.userId);
      renewed += 1;
    } catch (error) {
      failed += 1;
      console.error(`Renewing the calendar watch for ${channel.userId} failed:`, error);
    }
  }
  return { renewed, failed };
}
