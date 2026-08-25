/**
 * Attendee adapter — github.com/attendee-labs/attendee.
 *
 * The default provider: it transcribes natively (closed captions for free, or a
 * third-party provider you configure), and it schedules bots itself via
 * `join_at`, which is what lets this app run without a minute-resolution cron.
 *
 * API verified against the published OpenAPI document at
 * https://docs.attendee.dev/api-reference/openapi.json.
 */
import { env, requireEnv } from "@/lib/env";
import type { SpeakerSegment } from "@/db/schema";
import {
  segmentsToRawText,
  type BotProvider,
  type BotState,
  type BotStatus,
  type FetchedTranscript,
  type ScheduleBotInput,
  type ScheduledBot,
} from "./types";

/** Attendee's `BotStateEnum`, mapped onto ours. */
const STATE_MAP: Record<string, BotState> = {
  scheduled: "scheduled",
  staged: "scheduled",
  ready: "joining",
  joining: "joining",
  joining_breakout_room: "joining",
  leaving_breakout_room: "joining",
  waiting_room: "waiting_room",
  joined_not_recording: "recording",
  joined_recording: "recording",
  joined_recording_paused: "recording",
  joined_recording_permission_denied: "recording",
  leaving: "leaving",
  post_processing: "post_processing",
  ended: "ended",
  data_deleted: "ended",
  fatal_error: "failed",
};

export function mapAttendeeState(raw: string | undefined | null): BotState {
  if (!raw) return "unknown";
  return STATE_MAP[raw] ?? "unknown";
}

type AttendeeBot = {
  id: string;
  state?: string;
  join_at?: string;
  meeting_url?: string;
  transcription_state?: string;
  recording_state?: string;
};

type AttendeeUtterance = {
  speaker_name: string;
  speaker_uuid?: string | null;
  speaker_is_host?: boolean;
  timestamp_ms: number;
  duration_ms: number;
  // Documented as `{transcript, words}`; older payloads use a bare string.
  transcription: { transcript?: string } | string | null;
};

/** Attendee needs ~2 minutes to allocate resources for a scheduled bot. */
const MIN_LEAD_MS = 2 * 60_000;

export class AttendeeProvider implements BotProvider {
  readonly name = "attendee";
  readonly providesTranscription = true;

  private get baseUrl(): string {
    return env().ATTENDEE_BASE_URL.replace(/\/+$/, "");
  }

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers: {
        Authorization: `Token ${requireEnv("ATTENDEE_API_KEY")}`,
        "Content-Type": "application/json",
        ...(init.headers ?? {}),
      },
    });

    if (!response.ok) {
      throw new Error(
        `Attendee ${init.method ?? "GET"} ${path} failed (${response.status}): ${await response.text()}`,
      );
    }
    // DELETE returns an empty body.
    if (response.status === 204) return undefined as T;
    const text = await response.text();
    return (text ? JSON.parse(text) : undefined) as T;
  }

  async scheduleBot(input: ScheduleBotInput): Promise<ScheduledBot> {
    const body: Record<string, unknown> = {
      meeting_url: input.meetingUrl,
      bot_name: input.botName,
      metadata: input.metadata,
      // We transcribe the call rather than watch it, so video is storage we
      // never read: mp4 runs about 13.8 MiB per minute against roughly 1 for
      // mp3. Audio-only also drops the bot's CPU request substantially, which
      // is what makes many concurrent bots affordable.
      recording_settings: { format: "mp3" },
    };

    // Omitting `join_at` tells Attendee to join now. Sending one always costs
    // the lead time, because a scheduled bot waits for its appointed second.
    let joinAt: Date | null = null;
    if (input.joinAt) {
      const earliest = new Date(Date.now() + MIN_LEAD_MS);
      joinAt = input.joinAt.getTime() < earliest.getTime() ? earliest : input.joinAt;
      body.join_at = joinAt.toISOString();
    }
    if (input.deduplicationKey) body.deduplication_key = input.deduplicationKey;

    // Streaming raw audio out means we own endpointing, rather than waiting on
    // the meeting platform to decide a caption is final.
    if (input.audioWebsocketUrl) {
      body.websocket_settings = {
        audio: {
          url: input.audioWebsocketUrl,
          sample_rate: input.audioSampleRate ?? 16000,
        },
      };
    }
    if (input.webhookUrl) {
      body.webhooks = [
        {
          url: input.webhookUrl,
          // State changes drive our pipeline; transcript updates let us store
          // partial text if a meeting ends abnormally.
          triggers: ["bot.state_change", "transcript.update"],
        },
      ];
    }

    const bot = await this.request<AttendeeBot>("/api/v1/bots", {
      method: "POST",
      body: JSON.stringify(body),
    });

    return {
      botId: bot.id,
      state: mapAttendeeState(bot.state),
      joinAt: bot.join_at ? new Date(bot.join_at) : joinAt,
    };
  }

  async getStatus(botId: string): Promise<BotStatus> {
    const bot = await this.request<AttendeeBot>(`/api/v1/bots/${botId}`);
    return {
      botId: bot.id,
      state: mapAttendeeState(bot.state),
      rawState: bot.state ?? "unknown",
      transcriptReady: bot.transcription_state === "complete",
      recordingUrl: null,
    };
  }

  async fetchTranscript(botId: string): Promise<FetchedTranscript> {
    const utterances = await this.request<AttendeeUtterance[]>(
      `/api/v1/bots/${botId}/transcript`,
    );

    const segments: SpeakerSegment[] = (utterances ?? [])
      .map((utterance) => ({
        speakerName: utterance.speaker_name,
        speakerUuid: utterance.speaker_uuid ?? null,
        speakerIsHost: Boolean(utterance.speaker_is_host),
        timestampMs: utterance.timestamp_ms,
        durationMs: utterance.duration_ms,
        text:
          typeof utterance.transcription === "string"
            ? utterance.transcription
            : (utterance.transcription?.transcript ?? ""),
      }))
      .filter((segment) => segment.text.trim())
      // Attendee returns utterances in completion order, not call order.
      .sort((a, b) => a.timestampMs - b.timestampMs);

    const last = segments.at(-1);
    return {
      segments,
      rawText: segmentsToRawText(segments),
      source: "attendee",
      durationSeconds: last ? Math.round((last.timestampMs + last.durationMs) / 1000) : null,
    };
  }

  /**
   * Attendee returns a short-lived S3 URL, and 404s until the recording has
   * finished uploading — which is normal for a call that just ended, not an
   * error worth surfacing.
   */
  async fetchRecordingUrl(botId: string): Promise<string | null> {
    const response = await fetch(`${this.baseUrl}/api/v1/bots/${botId}/recording`, {
      headers: { Authorization: `Token ${requireEnv("ATTENDEE_API_KEY")}` },
    });
    if (response.status === 404) return null;
    if (!response.ok) {
      throw new Error(
        `Attendee GET /api/v1/bots/${botId}/recording failed (${response.status}): ${await response.text()}`,
      );
    }
    const data = (await response.json()) as { url?: string | null };
    return data.url ?? null;
  }

  async cancelBot(botId: string): Promise<void> {
    try {
      await this.request<void>(`/api/v1/bots/${botId}`, { method: "DELETE" });
    } catch (error) {
      // Only bots still in `scheduled` can be deleted; anything else is
      // already past the point where cancelling means something.
      console.warn(`Attendee cancelBot(${botId}) was refused:`, error);
    }
  }
}
