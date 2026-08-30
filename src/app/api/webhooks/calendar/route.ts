/**
 * Google telling us a calendar changed.
 *
 * Arrives within seconds of an event being created, moved or deleted, which is
 * the difference between a brief that is ready when the rep looks and one that
 * turns up five minutes later. The scheduler still polls: a channel can lapse
 * or a notification can be dropped, and the poll is what makes those a delay
 * rather than a silence.
 *
 * Answers 200 immediately and syncs afterwards. Google retries anything that is
 * slow or non-2xx, and a sync takes tens of seconds because it writes briefs —
 * holding the response open would earn us duplicate notifications for work
 * already underway.
 */
import { NextResponse } from "next/server";

import { channelOwner } from "@/lib/google/calendar-watch";
import { syncUserCalendar } from "@/lib/pipeline/calendar-sync";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(request: Request) {
  const channelId = request.headers.get("x-goog-channel-id");
  const token = request.headers.get("x-goog-channel-token");
  const state = request.headers.get("x-goog-resource-state");

  // Sent once when the channel opens. Nothing has changed yet.
  if (state === "sync") return new NextResponse(null, { status: 200 });

  if (!channelId || !token) return new NextResponse(null, { status: 400 });

  // The token is ours and secret, so a POST that cannot produce it is not from
  // a channel we opened. Answering 200 either way denies an attacker a way to
  // discover which channel ids exist.
  const owner = await channelOwner(channelId, token);
  if (!owner) return new NextResponse(null, { status: 200 });

  void syncUserCalendar(owner.userId).catch((error) => {
    console.error(`Push-triggered sync for ${owner.userId} failed:`, error);
  });

  return new NextResponse(null, { status: 200 });
}
