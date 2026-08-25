/**
 * Exercise the meeting-bot path end to end.
 *
 *   npm run try:bot                # next upcoming meeting
 *   npm run try:bot -- <meetingId>
 *
 * Three stages, matching what happens in production:
 *   1. schedule the bot (real call to whichever provider is configured)
 *   2. deliver a `bot.state_change` webhook to the running app
 *   3. the app pulls the transcript and runs the wrap-up
 *
 * Stage 2 posts to the local server rather than waiting for the provider,
 * because bot webhooks must be HTTPS and localhost cannot receive one. The
 * endpoint, the signature check, the idempotency record, the state mapping and
 * everything downstream are the real thing.
 */
import "dotenv/config";
import { asc, eq, gte } from "drizzle-orm";

import { db, sqlClient } from "@/db";
import { accounts, meetings } from "@/db/schema";
import { botProvider } from "@/lib/bots";
import { describeWebhook } from "@/lib/bots/webhook-url";
import { env } from "@/lib/env";
import { field, heading, explainFailure } from "./_harness";

const APP = process.env.APP_URL ?? "http://localhost:3001";

async function pickMeeting(explicitId?: string) {
  if (explicitId) {
    const meeting = await db.query.meetings.findFirst({ where: eq(meetings.id, explicitId) });
    if (!meeting) throw new Error(`No meeting with id ${explicitId}`);
    return meeting;
  }

  const [upcoming] = await db
    .select()
    .from(meetings)
    .where(gte(meetings.scheduledAt, new Date()))
    .orderBy(asc(meetings.scheduledAt))
    .limit(1);
  if (upcoming) return upcoming;

  const [any] = await db.select().from(meetings).orderBy(asc(meetings.scheduledAt)).limit(1);
  if (!any) throw new Error("No meetings. Run `npm run db:seed` first.");
  return any;
}

async function main() {
  const config = env();
  const provider = botProvider();

  heading("Bot configuration");
  field("Provider", provider.name);
  field("Transcribes natively", provider.providesTranscription ? "yes" : "no — needs Deepgram/AssemblyAI");
  field("Join lead", `${config.BOT_JOIN_LEAD_MINUTES} min before start`);
  field("App URL", config.APP_URL);
  field("Webhook", describeWebhook());

  if (provider.name === "noop") {
    heading("Nothing to do");
    console.log("  BOT_PROVIDER=noop schedules nothing and records nothing.\n");
    console.log("  Set BOT_PROVIDER=mock in .env to simulate a full call locally,");
    console.log("  or BOT_PROVIDER=attendee with ATTENDEE_API_KEY to use the real thing.\n");
    return;
  }

  const meeting = await pickMeeting(process.argv[2]);
  const account = await db.query.accounts.findFirst({ where: eq(accounts.id, meeting.accountId) });

  heading("1. Schedule the bot");
  field("Meeting", meeting.title ?? "(untitled)");
  field("Account", `${account?.companyName}`);
  field("Meeting URL", meeting.meetingUrl ?? "none — a bot cannot join without one");

  if (!meeting.meetingUrl) {
    throw new Error("This meeting has no joinable URL, so no bot can be scheduled for it.");
  }

  const joinAt = new Date(
    meeting.scheduledAt.getTime() - config.BOT_JOIN_LEAD_MINUTES * 60_000,
  );
  const scheduled = await provider.scheduleBot({
    meetingUrl: meeting.meetingUrl,
    joinAt,
    botName: config.BOT_DISPLAY_NAME,
    metadata: { meetingId: meeting.id, accountId: meeting.accountId },
    deduplicationKey: `meeting:${meeting.id}`,
    meetingTitle: meeting.title ?? undefined,
    endsAt: meeting.endsAt ?? undefined,
  });

  field("Bot id", scheduled.botId);
  field("State", scheduled.state);
  field("Joins at", scheduled.joinAt?.toISOString() ?? "unknown");

  // Record the bot, but don't rewind a meeting that has already been through
  // the pipeline — a repeat run would otherwise leave it stuck at
  // `bot_scheduled` once the webhook is deduplicated.
  const alreadyProcessed = meeting.status === "processed";
  await db
    .update(meetings)
    .set({
      botId: scheduled.botId,
      botState: scheduled.state,
      ...(alreadyProcessed ? {} : { status: "bot_scheduled" as const }),
    })
    .where(eq(meetings.id, meeting.id));

  if (alreadyProcessed) {
    console.log("\n  Note: this meeting was already processed. The webhook below will be");
    console.log("  deduplicated, which is the correct at-least-once behaviour.");
  }

  const status = await provider.getStatus(scheduled.botId);
  heading("2. Bot status");
  field("Reported state", `${status.rawState} → ${status.state}`);
  field("Transcript ready", status.transcriptReady ? "yes" : "not yet");

  if (status.state !== "ended") {
    console.log("\n  The bot has not finished. With a real provider it joins at the scheduled");
    console.log("  time and posts a webhook when the call ends — nothing more to do here.\n");
    return;
  }

  heading("3. Deliver the end-of-call webhook");
  const url = `${APP}/api/webhooks/bot?secret=${encodeURIComponent(config.WEBHOOK_SECRET)}`;
  console.log(`  POST ${url.replace(/secret=[^&]*/, "secret=****")}\n`);

  const payload = {
    // Same shape Attendee sends.
    idempotency_key: `try-bot-${scheduled.botId}-${meeting.id}`,
    bot_id: scheduled.botId,
    bot_metadata: { meetingId: meeting.id },
    trigger: "bot.state_change",
    data: { old_state: "joined_recording", new_state: "ended", created_at: new Date().toISOString() },
  };

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch {
    throw new Error(`Could not reach ${APP}. Is the dev server running? (npm run dev)`);
  }

  const result = (await response.json()) as Record<string, unknown>;

  if (!response.ok) {
    heading("Webhook rejected");
    field("Status", response.status);
    console.log(`\n  ${JSON.stringify(result, null, 2)}\n`);
    if (response.status === 500) {
      console.log("  The webhook was accepted but processing failed — most often because");
      console.log("  the wrap-up needs an LLM key. Add one and run this again.\n");
    }
    return;
  }

  heading("Result");
  field("HTTP", response.status);
  if (result.deduplicated) {
    console.log("\n  Already processed — the idempotency record stopped a repeat run.");
    console.log("  That is the correct behaviour for at-least-once delivery.\n");
  } else {
    console.log(`\n${JSON.stringify(result, null, 2)}\n`);
  }
  console.log(`  View it: ${APP}/meetings/${meeting.id}\n`);
}

main().catch(explainFailure).finally(() => sqlClient.end());
