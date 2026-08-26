"use client";

import { useEffect, useRef, useState } from "react";

import { Eyebrow, Pill } from "./ui";
import { cn } from "@/lib/cn";
import type { SpeakerSegment } from "@/db/schema";

type State =
  | { kind: "loading" }
  | { kind: "ready"; url: string }
  | { kind: "pending" }
  | { kind: "error"; message: string };

function stamp(ms: number): string {
  const total = Math.floor(ms / 1000);
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
}

/** Playing a video in an <audio> tag gives sound and no picture, silently. */
function isVideo(url: string): boolean {
  return /\.(mp4|webm|mov)(\?|$)/i.test(url);
}

/**
 * The recording and its transcript, kept in step.
 *
 * These were two separate blocks — a player, and a transcript folded away
 * behind a disclosure — which meant the useful thing was impossible: you could
 * read what was said, or hear it, but not find the moment where a promise was
 * made. Now the transcript is the index into the recording. Clicking a line
 * jumps the player to it, and the line under the playhead stays highlighted as
 * it runs.
 *
 * One component rather than two because the seek has to reach the media
 * element, and threading a ref between siblings through the server page would
 * mean making the page a client component to do it.
 */
export function CallPlayback({
  meetingId,
  segments,
  rawText,
}: {
  meetingId: string;
  segments: SpeakerSegment[] | null;
  /** Shown when the bot returned text with no speaker breakdown. */
  rawText?: string | null;
}) {
  const [state, setState] = useState<State>({ kind: "loading" });
  const [activeIndex, setActiveIndex] = useState(-1);
  const mediaRef = useRef<HTMLVideoElement | HTMLAudioElement>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // Minted per view because it expires, so it cannot be a prop.
        const response = await fetch(`/api/meetings/${meetingId}/recording`);
        const data = await response.json();
        if (cancelled) return;
        if (!response.ok) {
          setState({ kind: "error", message: data.error ?? "Could not load the recording" });
          return;
        }
        setState(data.url ? { kind: "ready", url: data.url } : { kind: "pending" });
      } catch {
        if (!cancelled) setState({ kind: "error", message: "Could not load the recording" });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [meetingId]);

  function seekTo(ms: number) {
    const media = mediaRef.current;
    if (!media) return;
    media.currentTime = ms / 1000;
    // Playing on click is the point: the click means "let me hear this".
    void media.play().catch(() => {});
  }

  function onTimeUpdate() {
    const media = mediaRef.current;
    if (!media || !segments?.length) return;
    const nowMs = media.currentTime * 1000;
    // Walk backwards: the active segment is the last one that has started.
    let index = -1;
    for (let i = segments.length - 1; i >= 0; i--) {
      if (segments[i].timestampMs <= nowMs) {
        index = i;
        break;
      }
    }
    if (index !== activeIndex) setActiveIndex(index);
  }

  const hasSegments = Boolean(segments && segments.length > 0);
  const playable = state.kind === "ready";

  return (
    <section className="overflow-hidden rounded-lg border border-rule bg-surface">
      <div className="flex items-center justify-between gap-3 border-b border-rule-soft px-5 py-3.5">
        <Eyebrow>Recording</Eyebrow>
        {hasSegments && playable && (
          <Pill tone="quiet">Click a line to jump there</Pill>
        )}
      </div>

      <div className="px-5 py-4">
        {state.kind === "loading" && (
          <div className="h-1 w-24 animate-pulse rounded bg-rule" aria-hidden />
        )}

        {state.kind === "ready" &&
          (isVideo(state.url) ? (
            <video
              ref={mediaRef as React.RefObject<HTMLVideoElement>}
              controls
              preload="metadata"
              src={state.url}
              onTimeUpdate={onTimeUpdate}
              className="w-full rounded border border-rule bg-black"
            >
              Your browser cannot play this recording.
            </video>
          ) : (
            <audio
              ref={mediaRef as React.RefObject<HTMLAudioElement>}
              controls
              preload="metadata"
              src={state.url}
              onTimeUpdate={onTimeUpdate}
              className="w-full"
            >
              Your browser cannot play this recording.
            </audio>
          ))}

        {state.kind === "pending" && (
          <p className="text-[13.5px] text-muted">
            Still uploading. It appears here once the bot has finished writing it out.
          </p>
        )}
        {state.kind === "error" && <p className="text-[13.5px] text-flag">{state.message}</p>}
      </div>

      {/* --- Transcript ------------------------------------------------------ */}
      {hasSegments ? (
        <div className="border-t border-rule-soft">
          <div className="max-h-[30rem] overflow-y-auto px-2 py-2">
            <ol>
              {segments!.map((segment, index) => {
                const active = index === activeIndex;
                return (
                  <li key={index}>
                    <button
                      type="button"
                      onClick={() => seekTo(segment.timestampMs)}
                      disabled={!playable}
                      className={cn(
                        "grid w-full grid-cols-[3.25rem_1fr] gap-3 rounded px-3 py-2 text-left transition-colors",
                        active ? "bg-sunken" : "hover:bg-sunken/60",
                        !playable && "cursor-default",
                      )}
                    >
                      <span
                        className={cn(
                          "pt-px font-mono text-[10.5px] tabular-nums",
                          active ? "text-signal" : "text-faint",
                        )}
                      >
                        {stamp(segment.timestampMs)}
                      </span>
                      <span className="min-w-0">
                        <span
                          className={cn(
                            "block text-[11px] font-medium uppercase tracking-[0.08em]",
                            active ? "text-ink" : "text-muted",
                          )}
                        >
                          {segment.speakerName}
                        </span>
                        <span
                          className={cn(
                            "mt-0.5 block text-[13px] leading-relaxed",
                            active ? "text-ink" : "text-ink-soft",
                          )}
                        >
                          {segment.text}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>
          </div>
        </div>
      ) : rawText ? (
        <div className="border-t border-rule-soft">
          <div className="max-h-[30rem] overflow-y-auto px-5 py-4">
            <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-ink-soft">
              {rawText}
            </p>
          </div>
        </div>
      ) : null}
    </section>
  );
}
