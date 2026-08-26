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

function render(event: NotifyEvent): { title: string; lines: string[] } {
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

async function toSlack(event: NotifyEvent): Promise<boolean> {
  const url = env().SLACK_WEBHOOK_URL;
  if (!url) return false;

  const { title, lines } = render(event);
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    // `text` is the notification body on a phone, so it has to stand alone —
    // a blocks-only payload pushes a silent "This content can't be displayed".
    body: JSON.stringify({
      text: `${title}: ${lines[0].replace(/\*/g, "")}`,
      blocks: [
        { type: "header", text: { type: "plain_text", text: title } },
        { type: "section", text: { type: "mrkdwn", text: lines.join("\n") } },
      ],
    }),
    signal: AbortSignal.timeout(5000),
  });

  if (!response.ok) throw new Error(`Slack webhook ${response.status}`);
  return true;
}

async function toEmail(event: NotifyEvent): Promise<boolean> {
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
    const results = await Promise.allSettled([toSlack(event), toEmail(event)]);
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
