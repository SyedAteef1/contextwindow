/**
 * The live path: every utterance reaches the rep's screen, and the ones that
 * are questions get an answer attached.
 *
 * Two publishes per utterance, deliberately. The first lands ~350ms after the
 * speaker stops and simply says "heard this" — that is what tells the rep the
 * system is working. The answer follows a second or two later and updates the
 * same row in place. Waiting to publish once would leave the panel silent for
 * the entire generation, which reads as broken.
 *
 * Runs inside the webhook, so it never throws: losing a live answer is a
 * nuisance, losing the webhook would cost the transcript.
 */
import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { liveAnswers, meetings, type LiveStatus } from "@/db/schema";
import { answerLiveQuestion, isLikelyQuestion } from "@/agents/live";
import { publishLiveEvent } from "@/lib/live-bus";

/** Attendee's `transcript.update` data payload. */
type TranscriptUpdate = {
  speaker_name?: string;
  timestamp_ms?: number;
  transcription?: { transcript?: string } | string | null;
};

export type LiveOutcome = {
  handled: boolean;
  status?: LiveStatus;
  reason?: string;
  latencyMs?: number;
  firstTokenMs?: number | null;
  via?: string;
};

export async function handleLiveUtterance(
  botId: string,
  data: Record<string, unknown>,
): Promise<LiveOutcome> {
  const update = data as TranscriptUpdate;
  const text =
    typeof update.transcription === "string"
      ? update.transcription
      : (update.transcription?.transcript ?? "");

  if (!text.trim()) return { handled: false, reason: "empty utterance" };

  const meeting = await db.query.meetings.findFirst({ where: eq(meetings.botId, botId) });
  if (!meeting) return { handled: false, reason: "unknown bot" };

  const askedAtMs = update.timestamp_ms ?? Date.now();
  const speaker = update.speaker_name ?? null;
  const question = text.trim();

  // Statements never reach the panel. The rep is looking at this mid-call and
  // a running transcript of their own conversation is noise — only a question
  // and its answer are worth the glance.
  if (!isLikelyQuestion(question)) {
    return { handled: false, reason: "statement" };
  }

  // Show the question the moment it is heard. Everything below takes seconds;
  // this does not, and it is what tells the rep the system is working.
  const [row] = await db
    .insert(liveAnswers)
    .values({
      meetingId: meeting.id,
      question,
      answer: null,
      status: "answering",
      askedBy: speaker,
      askedAtMs,
    })
    .onConflictDoUpdate({
      target: [liveAnswers.meetingId, liveAnswers.askedAtMs],
      set: { question },
    })
    .returning();

  const base = {
    meetingId: meeting.id,
    id: row.id,
    question,
    askedBy: speaker,
    createdAt: row.createdAt.toISOString(),
  };

  await publishLiveEvent({
    ...base,
    answer: null,
    status: "answering",
    latencyMs: null,
    via: null,
  });

  try {
    const result = await answerLiveQuestion({
      meetingId: meeting.id,
      utterance: question,
      speaker,
      askedAtMs,
    });

    const status: LiveStatus = result.answered && result.answer ? "answered" : "skipped";

    await db
      .update(liveAnswers)
      .set({
        answer: result.answer ?? null,
        status,
        skippedReason: result.skippedReason ?? null,
        latencyMs: result.latencyMs,
        via: result.via ?? null,
      })
      .where(and(eq(liveAnswers.id, row.id)));

    await publishLiveEvent({
      ...base,
      answer: result.answer ?? null,
      status,
      latencyMs: result.latencyMs,
      via: result.via ?? null,
      skippedReason: result.skippedReason ?? null,
    });

    return {
      handled: true,
      status,
      latencyMs: result.latencyMs,
      firstTokenMs: result.firstTokenMs,
      via: result.via,
    };
  } catch (error) {
    const reason = error instanceof Error ? error.message : "failed";
    console.error("Live answer failed:", error);

    await db
      .update(liveAnswers)
      .set({ status: "skipped", skippedReason: reason })
      .where(eq(liveAnswers.id, row.id));

    await publishLiveEvent({
      ...base,
      answer: null,
      status: "skipped",
      latencyMs: null,
      via: null,
      skippedReason: reason,
    });

    return { handled: false, reason };
  }
}
