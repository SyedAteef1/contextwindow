/**
 * Manual transcript ingestion.
 *
 * The escape hatch that makes the product usable without any bot
 * infrastructure: paste a transcript and the whole wrap-up pipeline runs. Also
 * how `BOT_PROVIDER=noop` is meant to be driven in local development.
 */
import { NextResponse } from "next/server";
import { z } from "zod";

import { handler, readJson, requireOwnedMeeting, requireUser } from "@/lib/api";
import { ingestTranscript } from "@/lib/pipeline/transcript";
import type { SpeakerSegment } from "@/db/schema";

export const maxDuration = 300;

const segmentSchema = z.object({
  speakerName: z.string().min(1),
  timestampMs: z.number().int().nonnegative(),
  durationMs: z.number().int().nonnegative().default(0),
  text: z.string().min(1),
  speakerUuid: z.string().nullable().optional(),
  speakerIsHost: z.boolean().optional(),
});

const bodySchema = z
  .object({
    rawText: z.string().min(1).optional(),
    segments: z.array(segmentSchema).optional(),
    source: z.string().default("manual"),
    durationSeconds: z.number().int().nonnegative().nullable().optional(),
  })
  .refine((value) => value.rawText || value.segments?.length, {
    message: "Provide either `rawText` or a non-empty `segments` array",
  });

/**
 * Turn pasted text into segments.
 *
 * Recognises the common `Name: what they said` transcript convention so pasted
 * text still carries speaker attribution, which is most of what makes a summary
 * useful. Lines without that shape are attributed to the previous speaker.
 */
function parsePlainTranscript(rawText: string): SpeakerSegment[] {
  const speakerLine = /^\s*([A-Z][\w .'-]{0,60}?)\s*:\s*(.+)$/;
  const segments: SpeakerSegment[] = [];
  let currentSpeaker = "Unknown speaker";

  for (const line of rawText.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const match = trimmed.match(speakerLine);
    if (match) {
      currentSpeaker = match[1].trim();
      segments.push({
        speakerName: currentSpeaker,
        speakerUuid: null,
        speakerIsHost: false,
        // No real timing information in pasted text; keep the order only.
        timestampMs: segments.length * 1000,
        durationMs: 0,
        text: match[2].trim(),
      });
      continue;
    }

    const previous = segments.at(-1);
    if (previous) {
      previous.text = `${previous.text} ${trimmed}`;
    } else {
      segments.push({
        speakerName: currentSpeaker,
        speakerUuid: null,
        speakerIsHost: false,
        timestampMs: 0,
        durationMs: 0,
        text: trimmed,
      });
    }
  }

  return segments;
}

export const POST = handler(
  async (request: Request, context: { params: Promise<{ id: string }> }) => {
    const user = await requireUser();
    const { id } = await context.params;
    const meeting = await requireOwnedMeeting(user.id, id);

    const body = await readJson(request, (value) => bodySchema.parse(value));

    const segments: SpeakerSegment[] =
      body.segments?.map((segment) => ({
        speakerName: segment.speakerName,
        speakerUuid: segment.speakerUuid ?? null,
        speakerIsHost: segment.speakerIsHost ?? false,
        timestampMs: segment.timestampMs,
        durationMs: segment.durationMs,
        text: segment.text,
      })) ?? parsePlainTranscript(body.rawText!);

    const result = await ingestTranscript({
      meetingId: meeting.id,
      segments,
      rawText: body.rawText,
      source: body.source,
      durationSeconds: body.durationSeconds ?? null,
    });

    return NextResponse.json(result, { status: result.skippedReason ? 402 : 200 });
  },
);
