/**
 * Gmail, over plain REST.
 *
 * One job: send the recap a rep has approved, from the rep's own mailbox, so it
 * lands in their sent items and the customer's reply threads back to a human.
 * Nothing in here drafts or decides — it delivers what a rep already signed off.
 */
import { ConfigurationError } from "@/lib/env";
import { serviceDisabledMessage } from "./service-errors";

const GMAIL_API = "https://gmail.googleapis.com/gmail/v1";

export type SentMessage = { id: string; threadId: string };

/**
 * Gmail wants the whole RFC 2822 message base64url-encoded, and rejects the
 * standard base64 alphabet.
 */
function base64Url(input: string): string {
  return Buffer.from(input, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/**
 * Headers are ASCII-only, so anything outside it — a company name with an
 * accent, a smart quote the model produced — has to be encoded word by
 * RFC 2047 or the subject arrives as mojibake.
 */
function encodeHeader(value: string): string {
  if (/^[\x20-\x7E]*$/.test(value)) return value;
  return `=?UTF-8?B?${Buffer.from(value, "utf8").toString("base64")}?=`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * The drafts are plain text with blank-line paragraphs and `- ` bullets. This
 * renders that to restrained HTML so the mail looks written rather than
 * generated — no colour, no branding, nothing a rep would be embarrassed by.
 */
export function bodyToHtml(body: string): string {
  const blocks = body.trim().split(/\n{2,}/);
  const html = blocks
    .map((block) => {
      const lines = block.split("\n").map((line) => line.trim());
      if (lines.every((line) => /^[-*]\s+/.test(line))) {
        const items = lines
          .map((line) => `<li>${escapeHtml(line.replace(/^[-*]\s+/, ""))}</li>`)
          .join("");
        return `<ul style="margin:0 0 16px;padding-left:20px">${items}</ul>`;
      }
      return `<p style="margin:0 0 16px">${escapeHtml(block).replace(/\n/g, "<br>")}</p>`;
    })
    .join("");

  return `<div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:#1a1a1a">${html}</div>`;
}

export type SendEmailInput = {
  to: string[];
  subject: string;
  /** Plain text. Always sent, and all some clients will render. */
  body: string;
  /** The HTML alternative. Derived from `body` when not supplied. */
  html?: string;
  cc?: string[];
  /** Set to keep the recap in an existing Gmail thread. */
  threadId?: string;
};

/**
 * Send as the authenticated user.
 *
 * Sent multipart/alternative: some corporate mail clients still strip HTML, and
 * a recap that arrives blank is worse than one that arrives plain.
 */
export async function sendEmail(
  accessToken: string,
  input: SendEmailInput,
): Promise<SentMessage> {
  if (input.to.length === 0) throw new Error("Cannot send a recap with no recipients");

  const boundary = `b${crypto.randomUUID().replace(/-/g, "")}`;
  const headers = [
    `To: ${input.to.join(", ")}`,
    input.cc?.length ? `Cc: ${input.cc.join(", ")}` : null,
    `Subject: ${encodeHeader(input.subject)}`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
  ].filter(Boolean);

  const message = [
    ...headers,
    "",
    `--${boundary}`,
    "Content-Type: text/plain; charset=UTF-8",
    "",
    input.body.trim(),
    "",
    `--${boundary}`,
    "Content-Type: text/html; charset=UTF-8",
    "",
    input.html ?? bodyToHtml(input.body),
    "",
    `--${boundary}--`,
  ].join("\r\n");

  const response = await fetch(`${GMAIL_API}/users/me/messages/send`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      raw: base64Url(message),
      ...(input.threadId ? { threadId: input.threadId } : {}),
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    const disabled = serviceDisabledMessage(body);
    if (disabled) throw new ConfigurationError(disabled);
    throw new Error(`Gmail send failed (${response.status}): ${body}`);
  }

  const data = (await response.json()) as { id: string; threadId: string };
  return { id: data.id, threadId: data.threadId };
}
