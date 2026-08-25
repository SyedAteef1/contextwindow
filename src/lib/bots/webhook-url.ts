/**
 * The URL bot providers post call events back to.
 *
 * Attendee has no request signing, so the shared secret rides in the query
 * string: the URL itself is the credential.
 */
import { env } from "@/lib/env";

export function botWebhookUrl(): string | undefined {
  const config = env();

  // An explicit override is a deliberate choice — a tunnel, or a self-hosted
  // Attendee that has REQUIRE_HTTPS_WEBHOOKS turned off. Trust it as given.
  const origin = config.WEBHOOK_BASE_URL ?? config.APP_URL;

  // Without an override, hosted providers reject anything but HTTPS, so a
  // plain localhost dev server simply gets no webhook registered.
  if (!config.WEBHOOK_BASE_URL && !origin.startsWith("https://")) return undefined;

  return `${origin.replace(/\/+$/, "")}/api/webhooks/bot?secret=${encodeURIComponent(
    config.WEBHOOK_SECRET,
  )}`;
}

/** Human-readable explanation for the harnesses. */
export function describeWebhook(): string {
  const config = env();
  const url = botWebhookUrl();
  if (url) {
    return `${url.replace(/secret=[^&]*/, "secret=****")}${
      config.WEBHOOK_BASE_URL ? " (via WEBHOOK_BASE_URL)" : ""
    }`;
  }
  return "not registered — APP_URL is not HTTPS and WEBHOOK_BASE_URL is unset";
}
