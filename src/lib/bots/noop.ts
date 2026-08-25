/**
 * A provider that does nothing.
 *
 * Lets the whole pipeline run in local development and in tests without any bot
 * infrastructure: meetings are detected and briefed, and transcripts are
 * uploaded by hand through the manual transcript endpoint.
 */
import type {
  BotProvider,
  BotStatus,
  FetchedTranscript,
  ScheduleBotInput,
  ScheduledBot,
} from "./types";

export class NoopProvider implements BotProvider {
  readonly name = "noop";
  readonly providesTranscription = false;

  async scheduleBot(input: ScheduleBotInput): Promise<ScheduledBot> {
    const when = input.joinAt ? input.joinAt.toISOString() : "immediately";
    console.info(`[noop bot] would join ${input.meetingUrl} ${when} as "${input.botName}"`);
    return {
      botId: `noop_${Buffer.from(input.meetingUrl).toString("base64url").slice(0, 16)}`,
      state: "scheduled",
      joinAt: input.joinAt ?? new Date(),
    };
  }

  async getStatus(botId: string): Promise<BotStatus> {
    return {
      botId,
      state: "scheduled",
      rawState: "noop",
      transcriptReady: false,
      recordingUrl: null,
    };
  }

  async fetchTranscript(): Promise<FetchedTranscript> {
    throw new Error(
      "BOT_PROVIDER=noop does not record meetings. Upload a transcript via POST /api/meetings/{id}/transcript instead.",
    );
  }

  async cancelBot(): Promise<void> {}

  async fetchRecordingUrl(): Promise<string | null> {
    return null;
  }
}
