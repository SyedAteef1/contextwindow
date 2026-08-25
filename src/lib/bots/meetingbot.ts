/**
 * MeetingBot adapter — github.com/meetingbot/meetingbot.
 *
 * Built against the repository's tRPC/OpenAPI router
 * (`src/server/src/server/api/routers/bots.ts`), which exposes:
 *   POST   /bots               create
 *   GET    /bots/{id}          status
 *   GET    /bots/{id}/recording  -> { recordingUrl }
 *   DELETE /bots/{id}          delete
 *
 * Note what is *not* there: a transcript endpoint. MeetingBot records and hands
 * back an audio/video URL; turning that into text is the caller's job. So this
 * adapter reports `providesTranscription: false` and `fetchTranscript` routes
 * through the external transcription service. Configure
 * `TRANSCRIPTION_PROVIDER` before selecting this provider.
 */
import { ConfigurationError, env, requireEnv } from "@/lib/env";
import { transcribeRecording } from "@/lib/transcription";
import {
  segmentsToRawText,
  type BotProvider,
  type BotState,
  type BotStatus,
  type FetchedTranscript,
  type ScheduleBotInput,
  type ScheduledBot,
} from "./types";

/** MeetingBot's `status` enum, mapped onto ours. */
const STATE_MAP: Record<string, BotState> = {
  READY_TO_DEPLOY: "scheduled",
  DEPLOYING: "joining",
  JOINING_CALL: "joining",
  IN_WAITING_ROOM: "waiting_room",
  IN_CALL: "recording",
  CALL_ENDED: "post_processing",
  DONE: "ended",
  FATAL: "failed",
};

export function mapMeetingBotState(raw: string | undefined | null): BotState {
  if (!raw) return "unknown";
  return STATE_MAP[raw] ?? "unknown";
}

type MeetingBotRecord = {
  id: number;
  status?: string;
  recording?: string | null;
  startTime?: string;
};

function platformFor(meetingUrl: string): "zoom" | "teams" | "google" | undefined {
  if (/zoom\.us/i.test(meetingUrl)) return "zoom";
  if (/teams\.(microsoft|live)\.com/i.test(meetingUrl)) return "teams";
  if (/meet\.google\.com/i.test(meetingUrl)) return "google";
  return undefined;
}

export class MeetingBotProvider implements BotProvider {
  readonly name = "meetingbot";
  readonly providesTranscription = false;

  private get baseUrl(): string {
    const url = env().MEETINGBOT_BASE_URL;
    if (!url) {
      throw new ConfigurationError(
        "BOT_PROVIDER=meetingbot requires MEETINGBOT_BASE_URL to be set.",
      );
    }
    return url.replace(/\/+$/, "");
  }

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const response = await fetch(`${this.baseUrl}/api${path}`, {
      ...init,
      headers: {
        "x-api-key": requireEnv("MEETINGBOT_API_KEY"),
        "Content-Type": "application/json",
        ...(init.headers ?? {}),
      },
    });

    if (!response.ok) {
      throw new Error(
        `MeetingBot ${init.method ?? "GET"} ${path} failed (${response.status}): ${await response.text()}`,
      );
    }
    const text = await response.text();
    return (text ? JSON.parse(text) : undefined) as T;
  }

  async scheduleBot(input: ScheduleBotInput): Promise<ScheduledBot> {
    // MeetingBot always needs concrete times, so "now" becomes now.
    const startTime = input.joinAt ?? new Date();
    const endTime = input.endsAt ?? new Date(startTime.getTime() + 60 * 60_000);

    const bot = await this.request<MeetingBotRecord>("/bots", {
      method: "POST",
      body: JSON.stringify({
        botDisplayName: input.botName,
        meetingTitle: input.meetingTitle ?? "Sales call",
        meetingInfo: {
          meetingUrl: input.meetingUrl,
          platform: platformFor(input.meetingUrl),
        },
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
        callbackUrl: input.webhookUrl,
      }),
    });

    return {
      botId: String(bot.id),
      state: mapMeetingBotState(bot.status),
      joinAt: bot.startTime ? new Date(bot.startTime) : startTime,
    };
  }

  async getStatus(botId: string): Promise<BotStatus> {
    const bot = await this.request<MeetingBotRecord>(`/bots/${botId}`);
    const state = mapMeetingBotState(bot.status);
    const recording = await this.recordingUrl(botId);

    return {
      botId,
      state,
      rawState: bot.status ?? "unknown",
      // "Ready" here means a recording exists to transcribe.
      transcriptReady: state === "ended" && Boolean(recording),
      recordingUrl: recording,
    };
  }

  private async recordingUrl(botId: string): Promise<string | null> {
    try {
      const result = await this.request<{ recordingUrl: string | null }>(
        `/bots/${botId}/recording`,
      );
      return result?.recordingUrl ?? null;
    } catch {
      return null;
    }
  }

  async fetchTranscript(botId: string): Promise<FetchedTranscript> {
    const recording = await this.recordingUrl(botId);
    if (!recording) {
      throw new Error(
        `MeetingBot bot ${botId} has no recording URL yet; cannot transcribe.`,
      );
    }

    const result = await transcribeRecording(recording);
    return {
      segments: result.segments,
      rawText: segmentsToRawText(result.segments),
      source: `meetingbot+${result.provider}`,
      durationSeconds: result.durationSeconds,
    };
  }

  /** MeetingBot exposes no recording retrieval endpoint. */
  async fetchRecordingUrl(): Promise<string | null> {
    return null;
  }

  async cancelBot(botId: string): Promise<void> {
    try {
      await this.request<void>(`/bots/${botId}`, { method: "DELETE" });
    } catch (error) {
      console.warn(`MeetingBot cancelBot(${botId}) was refused:`, error);
    }
  }
}
