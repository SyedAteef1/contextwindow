/**
 * The meeting-bot provider interface.
 *
 * Attendee and MeetingBot disagree on almost everything — id types, state
 * names, whether transcription exists at all — so the rest of the app talks to
 * this interface and never to a vendor directly. Swapping providers is a change
 * to `BOT_PROVIDER`, not a change to the pipeline.
 */
import type { SpeakerSegment } from "@/db/schema";

/** Normalised bot lifecycle, mapped from each provider's own vocabulary. */
export type BotState =
  | "scheduled" // created, waiting for its join time
  | "joining"
  | "waiting_room"
  | "recording"
  | "leaving"
  | "post_processing"
  | "ended" // finished; transcript should be retrievable
  | "failed"
  | "unknown";

/** Terminal states — nothing more will happen without a new bot. */
export const TERMINAL_BOT_STATES: ReadonlySet<BotState> = new Set(["ended", "failed"]);

export type ScheduleBotInput = {
  meetingUrl: string;
  /**
   * When the bot should join, or `null` to join immediately.
   *
   * These are genuinely different modes, not the same call with a nearer time.
   * A *scheduled* bot needs a couple of minutes of lead so the provider can
   * allocate resources in advance and then join exactly on the second — which
   * is what a calendar-driven pipeline wants. An *immediate* bot skips the
   * wait and starts allocating right now, which is what a human running a
   * command wants.
   */
  joinAt: Date | null;
  botName: string;
  /** Echoed back on webhooks so we can find our meeting again. */
  metadata: Record<string, string>;
  /** Stops a retry from putting two bots in the same meeting. */
  deduplicationKey?: string;
  /** HTTPS endpoint for state and transcript events. */
  webhookUrl?: string;
  meetingTitle?: string;
  /** Only used by providers that need an explicit end time. */
  endsAt?: Date;
  /** WebSocket to stream raw meeting audio to, when running our own STT. */
  audioWebsocketUrl?: string;
  audioSampleRate?: number;
};

export type ScheduledBot = {
  botId: string;
  state: BotState;
  joinAt: Date | null;
};

export type BotStatus = {
  botId: string;
  state: BotState;
  /** Provider's own state string, kept for display and debugging. */
  rawState: string;
  transcriptReady: boolean;
  recordingUrl: string | null;
};

export type FetchedTranscript = {
  segments: SpeakerSegment[];
  rawText: string;
  /** How the text was produced — useful when debugging a bad summary. */
  source: string;
  durationSeconds: number | null;
};

export interface BotProvider {
  readonly name: string;
  /** True when the provider transcribes for us; false means we must do it ourselves. */
  readonly providesTranscription: boolean;

  scheduleBot(input: ScheduleBotInput): Promise<ScheduledBot>;
  getStatus(botId: string): Promise<BotStatus>;
  fetchTranscript(botId: string): Promise<FetchedTranscript>;
  /** Cancel a bot that has not joined yet. Safe to call when already gone. */
  cancelBot(botId: string): Promise<void>;
  /**
   * A playable URL for the recording, or null if there isn't one yet.
   *
   * Deliberately fetched on demand rather than stored: providers hand back
   * short-lived signed URLs, and a persisted one is a link that works in
   * testing and is expired by the time a rep clicks it.
   */
  fetchRecordingUrl(botId: string): Promise<string | null>;
}

/** Flatten diarised segments into the plain text stored on `transcripts.rawText`. */
export function segmentsToRawText(segments: SpeakerSegment[]): string {
  return segments
    .filter((segment) => segment.text?.trim())
    .map((segment) => `${segment.speakerName}: ${segment.text.trim()}`)
    .join("\n");
}
