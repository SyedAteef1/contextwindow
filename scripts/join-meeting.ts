/**
 * Send a bot into a real meeting, right now.
 *
 *   npm run join -- "https://meet.google.com/abc-defg-hij"
 *   npm run join -- "https://zoom.us/j/123456789?pwd=..." --in 5
 *
 * Bypasses the calendar entirely: creates a meeting row for the URL, schedules
 * a bot against it, then polls until the bot joins so you can watch it happen.
 *
 * Needs a real provider — the mock joins nothing. Once the call ends, the
 * provider posts a webhook and the transcript and wrap-up follow, which is only
 * reachable if APP_URL is HTTPS (see the README on tunnels).
 */
import "dotenv/config";
import { and, eq } from "drizzle-orm";

import { db, sqlClient } from "@/db";
import { accounts, meetings } from "@/db/schema";
import { botProvider } from "@/lib/bots";
import { botWebhookUrl, describeWebhook } from "@/lib/bots/webhook-url";
import { env } from "@/lib/env";
import { companyNameFromDomain } from "@/lib/google/calendar";
import { explainFailure, field, heading } from "./_harness";

const POLL_SECONDS = 10;
const POLL_ATTEMPTS = 20;

function parseArgs(argv: string[]) {
  const url = argv.find((arg) => /^https?:\/\//.test(arg));
  const inIndex = argv.indexOf("--in");
  // Default is "now". `--in N` schedules instead, which costs the provider's
  // lead time but joins on the exact second — what the calendar pipeline uses.
  const minutes = inIndex >= 0 ? Number(argv[inIndex + 1]) : null;
  return { url, minutes: minutes !== null && Number.isFinite(minutes) ? minutes : null };
}

function platformOf(url: string): string {
  if (/meet\.google\.com/i.test(url)) return "Google Meet";
  if (/zoom\.us/i.test(url)) return "Zoom";
  if (/teams\.(microsoft|live)\.com/i.test(url)) return "Microsoft Teams";
  return "unknown — Attendee supports Zoom, Google Meet, and Teams";
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
  const { url, minutes } = parseArgs(process.argv.slice(2));
  const config = env();
  const provider = botProvider();

  if (!url) {
    heading("Usage");
    console.log('  npm run join -- "https://meet.google.com/abc-defg-hij"        # joins now');
    console.log('  npm run join -- "https://zoom.us/j/123456789?pwd=xyz" --in 5   # in 5 min\n');
    return;
  }

  heading("Sending a bot to a live meeting");
  field("Meeting URL", url);
  field("Platform", platformOf(url));
  field("Provider", provider.name);
  field("Bot name", config.BOT_DISPLAY_NAME);

  if (provider.name === "mock" || provider.name === "noop") {
    console.log(`\n  BOT_PROVIDER=${provider.name} does not join real meetings.\n`);
    console.log("  To actually join one:");
    console.log("    1. Get an API key at https://app.attendee.dev (5 hours free)");
    console.log("    2. Set BOT_PROVIDER=attendee and ATTENDEE_API_KEY in .env");
    console.log("    3. For the transcript to come back, APP_URL must be HTTPS —");
    console.log("       run `cloudflared tunnel --url http://localhost:3000` and set");
    console.log("       APP_URL to the address it prints.\n");
    return;
  }

  field("Webhook", describeWebhook());

  if (!botWebhookUrl()) {
    console.log("\n  Warning: no webhook will be registered.");
    console.log("  The bot will still join and record — but nothing will tell this app");
    console.log("  the call ended, so no transcript or summary will appear.\n");
  }

  // Park ad-hoc joins under one account so they don't pollute real ones.
  const rep = await db.query.users.findFirst();
  if (!rep) throw new Error("No user exists. Run `npm run db:seed` first.");

  const domain = "adhoc.test";
  let account = await db.query.accounts.findFirst({
    where: and(eq(accounts.ownerUserId, rep.id), eq(accounts.domain, domain)),
  });
  if (!account) {
    [account] = await db
      .insert(accounts)
      .values({
        ownerUserId: rep.id,
        companyName: companyNameFromDomain(domain),
        domain,
        industry: null,
      })
      .returning();
  }

  const joinAt = minutes === null ? null : new Date(Date.now() + minutes * 60_000);
  const startsAt = joinAt ?? new Date();
  const [meeting] = await db
    .insert(meetings)
    .values({
      accountId: account.id,
      ownerUserId: rep.id,
      title: `Ad-hoc join — ${platformOf(url)}`,
      scheduledAt: startsAt,
      endsAt: new Date(startsAt.getTime() + 60 * 60_000),
      calendarEventId: `adhoc-${Date.now()}`,
      meetingUrl: url,
      status: "detected",
      attendees: [],
    })
    .returning();

  const scheduled = await provider.scheduleBot({
    meetingUrl: url,
    joinAt,
    botName: config.BOT_DISPLAY_NAME,
    metadata: { meetingId: meeting.id, accountId: account.id },
    deduplicationKey: `meeting:${meeting.id}`,
    webhookUrl: botWebhookUrl(),
    audioWebsocketUrl: env().AUDIO_BRIDGE_URL,
    audioSampleRate: env().AUDIO_SAMPLE_RATE,
    meetingTitle: meeting.title ?? undefined,
    endsAt: meeting.endsAt ?? undefined,
  });

  await db
    .update(meetings)
    .set({ botId: scheduled.botId, botState: scheduled.state, status: "bot_scheduled" })
    .where(eq(meetings.id, meeting.id));

  heading("Bot scheduled");
  field("Bot id", scheduled.botId);
  field("Mode", joinAt ? `scheduled for ${joinAt.toISOString()}` : "joining now");
  field(
    "Expect it in",
    joinAt
      ? `${minutes} minute${minutes === 1 ? "" : "s"}`
      : "~30-60s while the browser container starts",
  );

  console.log("\n  Two things to expect in the meeting:");
  console.log(`    · a participant called "${config.BOT_DISPLAY_NAME}" will ask to join`);
  console.log("    · on Google Meet someone usually has to admit it from the waiting room\n");
  console.log("  Everyone on the call is being recorded. Tell them — in many places");
  console.log("  that is a legal requirement, not a courtesy.\n");

  heading("Watching");
  let last = "";
  for (let attempt = 0; attempt < POLL_ATTEMPTS; attempt++) {
    await sleep(POLL_SECONDS * 1000);

    let status;
    try {
      status = await provider.getStatus(scheduled.botId);
    } catch (error) {
      console.log(`  poll failed: ${error instanceof Error ? error.message : String(error)}`);
      continue;
    }

    if (status.rawState !== last) {
      const stamp = new Date().toISOString().slice(11, 19);
      console.log(`  ${stamp}  ${status.rawState}  (→ ${status.state})`);
      last = status.rawState;
    }

    if (status.state === "ended" || status.state === "failed") {
      heading(status.state === "ended" ? "Call ended" : "Bot failed");
      if (status.state === "ended") {
        console.log("  The provider will post the end-of-call webhook now, and the");
        console.log("  transcript and wrap-up follow from there.\n");
        console.log(`  Watch: http://localhost:3001/meetings/${meeting.id}\n`);
      }
      return;
    }
  }

  heading("Still running");
  console.log(`  The bot is in state "${last}" after ${(POLL_ATTEMPTS * POLL_SECONDS) / 60} minutes.`);
  console.log("  That is normal for a real call — leave it, and check the meeting page");
  console.log(`  when you are done: http://localhost:3001/meetings/${meeting.id}\n`);
}

main().catch(explainFailure).finally(() => sqlClient.end());
