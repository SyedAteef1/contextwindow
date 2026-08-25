/**
 * Fallback transcription.
 *
 * Only used when the bot provider hands back a recording rather than text
 * (MeetingBot does; Attendee doesn't). Both providers are usage-billed per
 * minute with no standing cost, which is why they're the fallback of choice.
 */
import { ConfigurationError, env } from "./env";
import type { SpeakerSegment } from "@/db/schema";

export type TranscriptionResult = {
  segments: SpeakerSegment[];
  provider: string;
  durationSeconds: number | null;
};

/** Deepgram and AssemblyAI both label speakers by index, not by name. */
function speakerLabel(index: number | string | undefined | null): string {
  if (index === undefined || index === null) return "Unknown speaker";
  return typeof index === "number" ? `Speaker ${index + 1}` : String(index);
}

async function transcribeWithDeepgram(recordingUrl: string): Promise<TranscriptionResult> {
  const apiKey = env().DEEPGRAM_API_KEY;
  if (!apiKey) {
    throw new ConfigurationError("TRANSCRIPTION_PROVIDER=deepgram requires DEEPGRAM_API_KEY.");
  }

  const params = new URLSearchParams({
    model: "nova-3",
    diarize: "true",
    punctuate: "true",
    utterances: "true",
    smart_format: "true",
  });

  const response = await fetch(`https://api.deepgram.com/v1/listen?${params.toString()}`, {
    method: "POST",
    headers: { Authorization: `Token ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ url: recordingUrl }),
  });

  if (!response.ok) {
    throw new Error(`Deepgram transcription failed (${response.status}): ${await response.text()}`);
  }

  const data = (await response.json()) as {
    metadata?: { duration?: number };
    results?: {
      utterances?: { speaker?: number; start: number; end: number; transcript: string }[];
    };
  };

  const utterances = data.results?.utterances ?? [];
  const segments: SpeakerSegment[] = utterances
    .filter((utterance) => utterance.transcript?.trim())
    .map((utterance) => ({
      speakerName: speakerLabel(utterance.speaker),
      speakerUuid: null,
      speakerIsHost: false,
      timestampMs: Math.round(utterance.start * 1000),
      durationMs: Math.round((utterance.end - utterance.start) * 1000),
      text: utterance.transcript.trim(),
    }));

  return {
    segments,
    provider: "deepgram",
    durationSeconds: data.metadata?.duration ? Math.round(data.metadata.duration) : null,
  };
}

/** AssemblyAI is submit-then-poll rather than synchronous. */
async function transcribeWithAssemblyAI(recordingUrl: string): Promise<TranscriptionResult> {
  const apiKey = env().ASSEMBLYAI_API_KEY;
  if (!apiKey) {
    throw new ConfigurationError("TRANSCRIPTION_PROVIDER=assemblyai requires ASSEMBLYAI_API_KEY.");
  }

  const headers = { authorization: apiKey, "content-type": "application/json" };

  const submit = await fetch("https://api.assemblyai.com/v2/transcript", {
    method: "POST",
    headers,
    body: JSON.stringify({ audio_url: recordingUrl, speaker_labels: true }),
  });
  if (!submit.ok) {
    throw new Error(`AssemblyAI submit failed (${submit.status}): ${await submit.text()}`);
  }
  const { id } = (await submit.json()) as { id: string };

  // A one-hour call typically completes well inside this window.
  const deadline = Date.now() + 20 * 60_000;
  while (Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 5_000));

    const poll = await fetch(`https://api.assemblyai.com/v2/transcript/${id}`, { headers });
    if (!poll.ok) {
      throw new Error(`AssemblyAI poll failed (${poll.status}): ${await poll.text()}`);
    }

    const data = (await poll.json()) as {
      status: string;
      error?: string;
      audio_duration?: number;
      utterances?: { speaker?: string; start: number; end: number; text: string }[];
    };

    if (data.status === "error") {
      throw new Error(`AssemblyAI transcription failed: ${data.error ?? "unknown error"}`);
    }
    if (data.status !== "completed") continue;

    const segments: SpeakerSegment[] = (data.utterances ?? [])
      .filter((utterance) => utterance.text?.trim())
      .map((utterance) => ({
        speakerName: speakerLabel(utterance.speaker),
        speakerUuid: null,
        speakerIsHost: false,
        timestampMs: utterance.start,
        durationMs: utterance.end - utterance.start,
        text: utterance.text.trim(),
      }));

    return {
      segments,
      provider: "assemblyai",
      durationSeconds: data.audio_duration ?? null,
    };
  }

  throw new Error(`AssemblyAI transcription ${id} did not complete within 20 minutes.`);
}

export async function transcribeRecording(recordingUrl: string): Promise<TranscriptionResult> {
  switch (env().TRANSCRIPTION_PROVIDER) {
    case "deepgram":
      return transcribeWithDeepgram(recordingUrl);
    case "assemblyai":
      return transcribeWithAssemblyAI(recordingUrl);
    default:
      throw new ConfigurationError(
        "This bot provider returns a recording rather than a transcript. Set TRANSCRIPTION_PROVIDER to `deepgram` or `assemblyai`.",
      );
  }
}
