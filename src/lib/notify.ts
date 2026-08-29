/**
 * Tell someone when a person arrives.
 *
 * A sign-up or a demo request that only lands in a table is a sign-up nobody
 * answers. The gap between "they were interested" and "you replied" is the
 * whole conversion, and checking a database by hand does not close it.
 *
 * Two channels, both optional, both best-effort. Slack is the one to reach for
 * first: an incoming webhook is a single URL, needs no OAuth and no app review,
 * and lands on a phone in seconds. Email is there for a deployment with no
 * Slack, and needs the SMTP sender configured.
 *
 * Nothing here is allowed to fail the request that triggered it. Someone
 * signing up must not see an error because a webhook was down, so every failure
 * is logged and swallowed — the row is already written either way.
 */
import { env } from "@/lib/env";

export type NotifyEvent =
  | {
      /**
       * Every sign-in, including the first.
       *
       * Deliberately separate from `signup`: a new user produces both, one for
       * the log and one for the room where arrivals get answered. The log is
       * the record of who was here and when; the signups channel is news.
       */
      kind: "signin";
      email: string;
      name?: string | null;
      domain: string;
      at: Date;
      isNewUser: boolean;
    }
  | {
      kind: "signup";
      email: string;
      name?: string | null;
      domain: string;
    }
  | {
      kind: "demo_request";
      name: string;
      email: string;
      company: string;
      teamSize?: string | null;
      message?: string | null;
      source?: string | null;
    };

/**
 * A timestamp Slack renders in each reader's own timezone.
 *
 * A log line stamped in UTC makes every reader do the arithmetic, and they get
 * it wrong. Slack's date token does it for them; the text after the pipe is
 * what shows anywhere the token cannot be expanded, so it has to stand alone.
 */
function slackDate(at: Date): string {
  const unix = Math.floor(at.getTime() / 1000);
  return `<!date^${unix}^{date_short_pretty} at {time}|${at.toISOString()}>`;
}

function render(event: NotifyEvent): { title: string; lines: string[] } {
  if (event.kind === "signin") {
    return {
      title: event.isNewUser ? "First sign-in" : "Signed in",
      lines: [
        `*${event.name ?? event.email}*`,
        event.name ? event.email : "",
        `Domain: ${event.domain}`,
        slackDate(event.at),
      ].filter(Boolean),
    };
  }
  if (event.kind === "signup") {
    return {
      title: "New sign-up",
      lines: [
        `*${event.name ?? event.email}*`,
        event.name ? event.email : "",
        `Domain: ${event.domain}`,
      ].filter(Boolean),
    };
  }
  return {
    title: "Demo requested",
    lines: [
      `*${event.name}* — ${event.company}`,
      event.email,
      event.teamSize ? `Team: ${event.teamSize}` : "",
      event.message ? `\n> ${event.message}` : "",
      event.source ? `via ${event.source}` : "",
    ].filter(Boolean),
  };
}

/**
 * Which channel this event belongs in.
 *
 * Sign-ins go to their own room and fall back to the main one only if no log
 * channel is configured — better a noisy single channel than a silent audit
 * trail. Everything else is an arrival someone has to answer.
 */
function channelFor(event: NotifyEvent): string | undefined {
  if (event.kind === "signin") {
    return env().SLACK_USER_LOG_CHANNEL_ID || env().SLACK_CHANNEL_ID;
  }
  return env().SLACK_CHANNEL_ID;
}

/**
 * Who to tag.
 *
 * A message in a channel nobody has open is not a notification. `<@U…>` pings a
 * person; `<!here>` and `<!channel>` ping a room. Slack only treats these as
 * mentions inside the message body, so the tag has to be in the text rather
 * than in a header block.
 */
function mention(event: NotifyEvent): string {
  // A log is read when someone goes looking. Pinging a human for every sign-in
  // trains them to mute the room, which costs the alerts that do matter.
  if (event.kind === "signin") return "";
  const raw = env().SLACK_MENTION?.trim();
  if (!raw) return "";
  if (raw === "!here" || raw === "!channel") return `<${raw}> `;
  // Accept a bare id or one already wrapped, so either form pasted from Slack
  // does the right thing.
  const id = raw.replace(/^<@|>$/g, "");
  return `<@${id}> `;
}

function payload(event: NotifyEvent) {
  const { title, lines } = render(event);
  const tag = mention(event);
  const body = `${tag}${lines.join("\n")}`;
  return {
    // `text` is what a phone shows on the lock screen, so it has to stand
    // alone — a blocks-only payload pushes a silent "this content can't be
    // displayed".
    text: `${title}: ${lines[0].replace(/\*/g, "")}`,
    blocks: [
      { type: "header", text: { type: "plain_text", text: title } },
      { type: "section", text: { type: "mrkdwn", text: body } },
    ],
  };
}

/**
 * Post with the bot token, into a channel chosen by id.
 *
 * Preferred over a webhook because the channel is configuration rather than
 * something baked into a URL. Slack answers 200 with `ok: false` for its own
 * errors, so the body has to be read — `not_in_channel` means the bot was never
 * invited, which is the usual first failure.
 */
async function toSlackChannel(event: NotifyEvent): Promise<boolean> {
  const token = env().SLACK_BOT_TOKEN;
  const channel = channelFor(event);
  if (!token || !channel) return false;

  const response = await fetch("https://slack.com/api/chat.postMessage", {
    method: "POST",
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ channel, ...payload(event) }),
    signal: AbortSignal.timeout(5000),
  });

  const result = (await response.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
  if (!result?.ok) {
    throw new Error(
      `Slack chat.postMessage failed: ${result?.error ?? response.status}` +
        (result?.error === "not_in_channel"
          ? " — invite the bot to the channel with /invite"
          : ""),
    );
  }
  return true;
}

async function toSlackWebhook(event: NotifyEvent): Promise<boolean> {
  // A webhook cannot choose a channel, so a sign-in sent through one lands in
  // the room meant for arrivals. The log is a bot-token feature or nothing.
  if (event.kind === "signin") return false;
  const url = env().SLACK_WEBHOOK_URL;
  // The bot token path already delivered it; a webhook as well would double up.
  if (!url || (env().SLACK_BOT_TOKEN && env().SLACK_CHANNEL_ID)) return false;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload(event)),
    signal: AbortSignal.timeout(5000),
  });

  if (!response.ok) throw new Error(`Slack webhook ${response.status}`);
  return true;
}

async function toEmail(event: NotifyEvent): Promise<boolean> {
  // Mailing a human on every sign-in is how an inbox rule gets written.
  if (event.kind === "signin") return false;
  const to = env().NOTIFY_EMAIL;
  if (!to) return false;

  // Imported lazily: the mail module pulls in nodemailer, and a deployment
  // notifying only through Slack should not pay for that at startup.
  const { sendMail, mailConfigured } = await import("@/lib/mail");
  if (!mailConfigured()) return false;

  const { title, lines } = render(event);
  const text = lines.join("\n").replace(/\*/g, "");

  const { renderEmail, markdownToBlocks } = await import("@/lib/mail/template");
  await sendMail("", {
    to: [to],
    subject: `${title} — ${event.kind === "signup" ? event.domain : event.company}`,
    text,
    html: renderEmail({ eyebrow: "Context Window", title, blocks: markdownToBlocks(text) }),
  });
  return true;
}

/**
 * Fire and forget.
 *
 * Callers do not await this: the person who triggered it is waiting on a
 * response, and a notification is never worth a slower page.
 */
export function notify(event: NotifyEvent): void {
  void (async () => {
    const results = await Promise.allSettled([
      toSlackChannel(event),
      toSlackWebhook(event),
      toEmail(event),
    ]);
    const delivered = results.some((r) => r.status === "fulfilled" && r.value);

    for (const result of results) {
      if (result.status === "rejected") console.error("Notification failed:", result.reason);
    }
    // The container log is the last resort, so a deployment with neither
    // channel configured still leaves a trace of who turned up.
    if (!delivered) {
      const { title, lines } = render(event);
      console.log(`[notify] ${title}: ${lines.join(" · ").replace(/\*/g, "")}`);
    }
  })();
}
