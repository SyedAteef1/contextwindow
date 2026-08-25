/**
 * Delivering live answers to the browser.
 *
 * The webhook that produces an answer and the SSE connection that displays it
 * are different requests, and in production different processes. Postgres
 * LISTEN/NOTIFY carries events between them — we already run Postgres, so this
 * needs no Redis and no WebSocket server.
 *
 * NOTIFY payloads are capped at 8000 bytes, which a one-sentence answer is
 * comfortably inside; anything larger is truncated deliberately rather than
 * silently failing to deliver.
 */
import postgres from "postgres";

import { env } from "./env";
import { sqlClient } from "@/db";

const CHANNEL = "live_answers";
const MAX_PAYLOAD_BYTES = 7000;

export type LiveEvent = {
  meetingId: string;
  /** Stable across the lifecycle, so the panel updates a row in place. */
  id: string;
  question: string;
  answer: string | null;
  status: "heard" | "answering" | "answered" | "skipped";
  askedBy: string | null;
  latencyMs: number | null;
  via: string | null;
  createdAt: string;
  /**
   * Why nothing was answered.
   *
   * Surfaced rather than swallowed: a rep watching an empty panel cannot tell
   * "heard you, nothing useful to add" from "broken", and those need very
   * different reactions mid-call.
   */
  skippedReason?: string | null;
};

export async function publishLiveEvent(event: LiveEvent): Promise<void> {
  let payload = JSON.stringify(event);

  if (Buffer.byteLength(payload) > MAX_PAYLOAD_BYTES) {
    // Better a trimmed answer on screen than a dropped notification.
    payload = JSON.stringify({
      ...event,
      answer: event.answer ? `${event.answer.slice(0, 900)}…` : null,
    });
  }

  await sqlClient.notify(CHANNEL, payload);
}

/**
 * Subscribe to live answers for one meeting.
 *
 * Opens its own connection: `LISTEN` occupies a session for as long as it is
 * held, so borrowing one from the shared pool would starve normal queries.
 * The returned function closes it.
 */
export async function subscribeLiveAnswers(
  meetingId: string,
  onEvent: (event: LiveEvent) => void,
): Promise<() => Promise<void>> {
  const client = postgres(env().DATABASE_URL, {
    max: 1,
    prepare: false,
    onnotice: () => {},
  });

  await client.listen(CHANNEL, (payload) => {
    try {
      const event = JSON.parse(payload) as LiveEvent;
      // One connection carries every meeting's events; filter to this one.
      if (event.meetingId === meetingId) onEvent(event);
    } catch {
      // A malformed payload must not kill the subscription.
    }
  });

  return async () => {
    await client.end({ timeout: 5 });
  };
}
