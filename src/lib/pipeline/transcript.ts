/**
 * Transcript ingestion — the back of the pipeline.
 *
 * Store the transcript, index it for chat, then run the wrap-up agent. Called
 * from the bot webhook, from the status-poll fallback, and from the manual
 * upload route.
 */
import { eq } from "drizzle-orm";

import { db } from "@/db";
import { meetings, transcripts, type SpeakerSegment } from "@/db/schema";
import { botProvider, segmentsToRawText } from "@/lib/bots";
import { indexDocument } from "@/lib/retrieval";
import { canProcessMeeting } from "@/lib/usage";
import { runWrapup } from "@/agents/wrapup";

export type IngestResult = {
  meetingId: string;
  transcriptId: string;
  chunksIndexed: number;
  wrapupRan: boolean;
  summaryId: string | null;
  followupProposalId: string | null;
  skippedReason: string | null;
};

/** Label used when the chat agent cites this transcript. */
function transcriptLabel(scheduledAt: Date): string {
  return `Transcript — ${scheduledAt.toISOString().slice(0, 10)}`;
}

/**
 * Store a transcript and process it.
 *
 * Idempotent on `meetingId`: re-ingesting replaces the stored transcript and
 * re-indexes it rather than accumulating duplicates.
 */
export async function ingestTranscript(input: {
  meetingId: string;
  segments: SpeakerSegment[];
  rawText?: string;
  source: string;
  durationSeconds?: number | null;
  /** Skip the wrap-up agent; used when only storing partial live text. */
  processImmediately?: boolean;
}): Promise<IngestResult> {
  const meeting = await db.query.meetings.findFirst({
    where: eq(meetings.id, input.meetingId),
  });
  if (!meeting) throw new Error(`Meeting ${input.meetingId} not found`);

  const rawText = input.rawText ?? segmentsToRawText(input.segments);
  if (!rawText.trim()) {
    throw new Error(`Refusing to store an empty transcript for meeting ${meeting.id}`);
  }

  const [transcript] = await db
    .insert(transcripts)
    .values({
      meetingId: meeting.id,
      rawText,
      speakerSegments: input.segments,
      source: input.source,
      durationSeconds: input.durationSeconds ?? null,
    })
    .onConflictDoUpdate({
      target: transcripts.meetingId,
      set: {
        rawText,
        speakerSegments: input.segments,
        source: input.source,
        durationSeconds: input.durationSeconds ?? null,
        updatedAt: new Date(),
      },
    })
    .returning();

  await db
    .update(meetings)
    .set({ status: "transcribed", updatedAt: new Date() })
    .where(eq(meetings.id, meeting.id));

  const chunksIndexed = await indexDocument({
    accountId: meeting.accountId,
    sourceType: "transcript",
    sourceId: transcript.id,
    content: rawText,
    meta: {
      meetingId: meeting.id,
      meetingTitle: meeting.title,
      scheduledAt: meeting.scheduledAt.toISOString(),
      label: transcriptLabel(meeting.scheduledAt),
    },
  });

  const base: IngestResult = {
    meetingId: meeting.id,
    transcriptId: transcript.id,
    chunksIndexed,
    wrapupRan: false,
    summaryId: null,
    followupProposalId: null,
    skippedReason: null,
  };

  if (input.processImmediately === false) return base;

  // The free-tier gate: store and index regardless (the rep's data is theirs),
  // but don't spend model tokens on a summary they're over the limit for.
  const quota = await canProcessMeeting(meeting.ownerUserId);
  if (quota.overLimit) {
    await db
      .update(meetings)
      .set({ status: "skipped_quota", updatedAt: new Date() })
      .where(eq(meetings.id, meeting.id));
    return {
      ...base,
      skippedReason: `Free tier limit reached (${quota.used}/${quota.limit} meetings this month).`,
    };
  }

  try {
    const wrapup = await runWrapup(meeting.id);
    return {
      ...base,
      wrapupRan: true,
      summaryId: wrapup.summaryId,
      followupProposalId: wrapup.followupProposalId,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await db
      .update(meetings)
      .set({ status: "failed", errorMessage: message, updatedAt: new Date() })
      .where(eq(meetings.id, meeting.id));
    throw error;
  }
}

/**
 * Pull a finished meeting's transcript from the bot provider and ingest it.
 *
 * Returns null when the bot isn't ours or the meeting has already been
 * processed — both are normal for an at-least-once webhook.
 */
export async function pullTranscriptForBot(botId: string): Promise<IngestResult | null> {
  const meeting = await db.query.meetings.findFirst({ where: eq(meetings.botId, botId) });
  if (!meeting) {
    console.warn(`Bot ${botId} has no matching meeting; ignoring.`);
    return null;
  }
  if (meeting.status === "processed") return null;

  const transcript = await botProvider().fetchTranscript(botId);
  if (!transcript.rawText.trim()) {
    // A meeting where nobody spoke, or where the bot never got permission.
    await db
      .update(meetings)
      .set({
        status: "failed",
        errorMessage: "Bot returned an empty transcript.",
        updatedAt: new Date(),
      })
      .where(eq(meetings.id, meeting.id));
    return null;
  }

  return ingestTranscript({
    meetingId: meeting.id,
    segments: transcript.segments,
    rawText: transcript.rawText,
    source: transcript.source,
    durationSeconds: transcript.durationSeconds,
  });
}
