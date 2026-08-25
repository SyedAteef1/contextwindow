/** Provider selection. One place decides which bot backend is in play. */
import { env } from "@/lib/env";
import { AttendeeProvider } from "./attendee";
import { MeetingBotProvider } from "./meetingbot";
import { MockBotProvider } from "./mock";
import { NoopProvider } from "./noop";
import type { BotProvider } from "./types";

let cached: BotProvider | null = null;

export function botProvider(): BotProvider {
  if (cached && cached.name === env().BOT_PROVIDER) return cached;

  switch (env().BOT_PROVIDER) {
    case "attendee":
      cached = new AttendeeProvider();
      break;
    case "meetingbot":
      cached = new MeetingBotProvider();
      break;
    case "mock":
      cached = new MockBotProvider();
      break;
    case "noop":
      cached = new NoopProvider();
      break;
  }
  return cached!;
}

/** Test seam: force a provider for the duration of a test. */
export function __setBotProvider(provider: BotProvider | null): void {
  cached = provider;
}

export * from "./types";
