/**
 * Sending mail, from whichever address the deployment is configured to use.
 *
 * Two providers, and the difference is who the message appears to be from.
 * `gmail` sends through the rep's own OAuth grant: a reply reaches a human, the
 * message lands in their Sent folder, and deliverability is Google's problem.
 * `smtp` sends from a company address, which is what a notification from the
 * product should look like — nobody wants a system email arriving as though a
 * colleague typed it.
 *
 * The rule that nothing reaches a customer without a human pressing send is not
 * affected by either: that is enforced where recipients are chosen, not here.
 */
import { env, requireEnv } from "@/lib/env";
import { sendEmail as sendViaGmail } from "@/lib/google/gmail";
import { getAccessTokenForUser } from "@/lib/google/oauth";

export type OutboundEmail = {
  to: string[];
  cc?: string[];
  subject: string;
  /** Plain text. Always sent, and the only thing some clients will show. */
  text: string;
  /** Optional HTML alternative. */
  html?: string;
  /** Gmail only: keeps a reply on the same thread. */
  threadId?: string;
};

export type SentMessage = { id: string; threadId?: string };

/**
 * Send as the product.
 *
 * `userId` is still required because the gmail path needs the rep's grant;
 * under smtp it is unused, which is deliberate — switching providers must not
 * mean rewriting every call site.
 */
export async function sendMail(userId: string, message: OutboundEmail): Promise<SentMessage> {
  if (message.to.length === 0) throw new Error("Cannot send an email with no recipients");

  if (env().MAIL_PROVIDER === "smtp") return sendViaSmtp(message);

  const accessToken = await getAccessTokenForUser(userId);
  return sendViaGmail(accessToken, {
    to: message.to,
    cc: message.cc,
    subject: message.subject,
    body: message.text,
    html: message.html,
    threadId: message.threadId,
  });
}

/** Built once: a pool holds the TLS connection open across sends. */
let transport: import("nodemailer").Transporter | null = null;

async function smtpTransport() {
  if (transport) return transport;

  const host = requireEnv("SMTP_HOST");
  const user = requireEnv("SMTP_USER");
  const pass = requireEnv("SMTP_PASSWORD");
  const port = env().SMTP_PORT;

  const nodemailer = await import("nodemailer");
  transport = nodemailer.createTransport({
    host,
    port,
    // 465 is implicit TLS; 587 upgrades with STARTTLS. Derived from the port
    // unless the deployment says otherwise, because getting this wrong fails
    // with a timeout rather than a message that explains itself.
    secure: env().SMTP_SECURE ?? port === 465,
    auth: { user, pass },
    pool: true,
    maxConnections: 3,
  });
  return transport;
}

async function sendViaSmtp(message: OutboundEmail): Promise<SentMessage> {
  const from = requireEnv("MAIL_FROM");
  const mailer = await smtpTransport();

  const info = await mailer.sendMail({
    from,
    to: message.to,
    cc: message.cc,
    replyTo: env().MAIL_REPLY_TO || undefined,
    subject: message.subject,
    text: message.text,
    html: message.html,
  });

  // SMTP has no thread id; the message id is what the provider will log against.
  return { id: info.messageId };
}

/**
 * Whether outbound mail can actually be sent right now.
 *
 * Checked before claiming a row for sending, so a misconfigured deployment
 * fails loudly at startup rather than silently swallowing every brief.
 */
export function mailConfigured(): boolean {
  if (env().MAIL_PROVIDER !== "smtp") return true;
  const config = env();
  return Boolean(config.SMTP_HOST && config.SMTP_USER && config.SMTP_PASSWORD && config.MAIL_FROM);
}
