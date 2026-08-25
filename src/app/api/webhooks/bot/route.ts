/**
 * Bot provider webhook.
 *
 * Attendee posts `{idempotency_key, bot_id, bot_metadata, trigger, data}`. We
 * dedupe on the idempotency key, track state changes, and pull the transcript
 * once the bot reaches a terminal state.
 */
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { db } from "@/db";
import { meetings, webhookDeliveries } from "@/db/schema";
import { handler } from "@/lib/api";
import { mapAttendeeState } from "@/lib/bots/attendee";
import { timingSafeEqualString } from "@/lib/crypto";
import { env } from "@/lib/env";
import { pullTranscriptForBot } from "@/lib/pipeline/transcript";
import { handleLiveUtterance } from "@/lib/pipeline/live";

// Transcript pull plus the whole wrap-up pipeline runs inside this request.
export const maxDuration = 300;

type WebhookBody = {
  idempotency_key?: string;
  bot_id?: string;
  bot_metadata?: Record<string, string>;
  trigger?: string;
  data?: Record<string, unknown>;
};

export const POST = handler(async (request: Request) => {
  // Attendee webhooks carry no signature, so the shared secret rides in the
  // query string of a URL only we and the provider know.
  const provided = new URL(request.url).searchParams.get("secret") ?? "";
  if (!timingSafeEqualString(provided, env().WEBHOOK_SECRET)) {
    return NextResponse.json({ error: "Invalid webhook secret" }, { status: 401 });
  }

  const body = (await request.json()) as WebhookBody;
  const botId = body.bot_id;
  if (!botId) {
    return NextResponse.json({ error: "Missing bot_id" }, { status: 400 });
  }

  // At-least-once delivery: a duplicate is a success, not an error.
  if (body.idempotency_key) {
    const [inserted] = await db
      .insert(webhookDeliveries)
      .values({
        provider: env().BOT_PROVIDER,
        idempotencyKey: body.idempotency_key,
        trigger: body.trigger ?? null,
        botId,
        payload: body as Record<string, unknown>,
      })
      .onConflictDoNothing({
        target: [webhookDeliveries.provider, webhookDeliveries.idempotencyKey],
      })
      .returning();

    if (!inserted) return NextResponse.json({ ok: true, deduplicated: true });
  }

  if (body.trigger === "transcript.update") {
    // The live path. Attendee delivers an utterance ~350ms after the speaker
    // stops, which is the whole reason a mid-call answer is possible at all.
    const result = await handleLiveUtterance(botId, body.data ?? {});
    return NextResponse.json({ ok: true, live: result });
  }

  if (body.trigger !== "bot.state_change") {
    // Participant events are informational here.
    return NextResponse.json({ ok: true, ignored: body.trigger ?? null });
  }

  const newState = String((body.data as { new_state?: string } | undefined)?.new_state ?? "");
  const mapped = mapAttendeeState(newState);

  const meeting = await db.query.meetings.findFirst({ where: eq(meetings.botId, botId) });
  if (!meeting) {
    return NextResponse.json({ ok: true, ignored: "unknown bot" });
  }

  await db
    .update(meetings)
    .set({
      botState: newState,
      // Don't downgrade a meeting that is already transcribed or processed.
      status:
        mapped === "recording" && meeting.status === "bot_scheduled"
          ? "recording"
          : meeting.status,
      updatedAt: new Date(),
    })
    .where(eq(meetings.id, meeting.id));

  if (mapped === "failed") {
    await db
      .update(meetings)
      .set({
        status: "failed",
        errorMessage: `Bot reported ${newState}`,
        updatedAt: new Date(),
      })
      .where(eq(meetings.id, meeting.id));
    return NextResponse.json({ ok: true, state: newState });
  }

  if (mapped !== "ended") {
    return NextResponse.json({ ok: true, state: newState });
  }

  // The call is over — pull the transcript and run the wrap-up.
  try {
    const result = await pullTranscriptForBot(botId);
    return NextResponse.json({ ok: true, state: newState, result });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Transcript processing failed for bot ${botId}:`, error);
    // 500 so the provider retries; the idempotency row is already written, so
    // guard against a retry being deduplicated into a no-op.
    await db
      .delete(webhookDeliveries)
      .where(eq(webhookDeliveries.idempotencyKey, body.idempotency_key ?? "__none__"));
    return NextResponse.json({ error: "Processing failed", detail: message }, { status: 500 });
  }
});
