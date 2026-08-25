/**
 * A bot that pretends.
 *
 * Attendee needs an API key and — because bot webhooks must be HTTPS — a
 * publicly reachable host, which localhost is not. That combination means the
 * post-call chain (bot ends → webhook → transcript pull → wrap-up) is the one
 * part of the product hardest to exercise while developing it.
 *
 * This provider closes that gap: it accepts a scheduled bot, reports itself as
 * finished, and returns a canned diarised transcript. Every downstream step
 * then runs for real against the real database. It is a development tool, not
 * a stub for tests — the tests mock at a different level.
 */
import type { SpeakerSegment } from "@/db/schema";
import {
  segmentsToRawText,
  type BotProvider,
  type BotStatus,
  type FetchedTranscript,
  type ScheduleBotInput,
  type ScheduledBot,
} from "./types";

/**
 * A short discovery call with the shape a wrap-up should have opinions about:
 * a real objection, a stated timeline, an unclear budget, and one commitment.
 */
const SCRIPT: [string, string][] = [
  ["Sam Okonkwo", "Thanks for making time. I know you've been evaluating for a while — where are you up to?"],
  ["Dana Whitfield", "We've narrowed it to two. Honestly, you're the more expensive one, so I want to understand what we'd be paying for."],
  ["Sam Okonkwo", "That's fair. What's the other option doing well?"],
  ["Dana Whitfield", "Their onboarding is faster. They quoted three weeks; you quoted eight."],
  ["Sam Okonkwo", "Eight is the number if you want the historical data migrated. Three weeks gets you a running system with no history. Which matters more to you?"],
  ["Dana Whitfield", "…that's a better question than I expected. The history matters. Our reporting is all year-over-year."],
  ["Sam Okonkwo", "Then the comparison isn't three versus eight, it's three-plus-a-gap versus eight."],
  ["Dana Whitfield", "I'll need that in writing to take to Priya. She's the one who signs."],
  ["Sam Okonkwo", "I'll send a one-pager comparing both timelines with the data-migration scope called out. When does Priya need it?"],
  ["Dana Whitfield", "We meet Thursday fortnight. Before then."],
  ["Sam Okonkwo", "You'll have it this week. Is budget settled, or does that meeting decide it?"],
  ["Dana Whitfield", "That meeting decides it. I'd rather not quote a number until I've seen your one-pager."],
  ["Sam Okonkwo", "Understood. Anything else likely to come up in that room?"],
  ["Dana Whitfield", "Security will ask about data residency. We're EU-only."],
  ["Sam Okonkwo", "I'll include the residency position in the same document."],
];

export class MockBotProvider implements BotProvider {
  readonly name = "mock";
  readonly providesTranscription = true;

  async scheduleBot(input: ScheduleBotInput): Promise<ScheduledBot> {
    const when = input.joinAt ? input.joinAt.toISOString() : "immediately";
    console.info(`[mock bot] joining ${input.meetingUrl} ${when} as "${input.botName}"`);
    // Deterministic from the meeting so repeat runs address the same bot.
    const suffix = input.deduplicationKey ?? input.meetingUrl;
    return {
      botId: `mock_${Buffer.from(suffix).toString("base64url").slice(0, 20)}`,
      state: "scheduled",
      joinAt: input.joinAt ?? new Date(),
    };
  }

  async getStatus(botId: string): Promise<BotStatus> {
    // Always finished, so a status poll can drive the pipeline immediately.
    return {
      botId,
      state: "ended",
      rawState: "ended",
      transcriptReady: true,
      recordingUrl: null,
    };
  }

  async fetchTranscript(): Promise<FetchedTranscript> {
    const segments: SpeakerSegment[] = SCRIPT.map(([speaker, text], index) => ({
      speakerName: speaker,
      speakerUuid: null,
      speakerIsHost: speaker === "Sam Okonkwo",
      // Roughly a minute per turn, so timestamps look like a real call.
      timestampMs: index * 62_000,
      durationMs: 12_000,
      text,
    }));

    return {
      segments,
      rawText: segmentsToRawText(segments),
      source: "mock",
      durationSeconds: SCRIPT.length * 62,
    };
  }

  async fetchRecordingUrl(): Promise<string | null> {
    return null;
  }

  async cancelBot(botId: string): Promise<void> {
    console.info(`[mock bot] cancelled ${botId}`);
  }
}
