"use client";

import { useEffect, useMemo, useRef, useState } from "react";

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

/** Highlight the matched run without dangerouslySetInnerHTML. */
function Highlighted({ text, query }: { text: string; query: string }) {
  if (!query.trim()) return <>{text}</>;

  const needle = query.trim().toLowerCase();
  const parts: React.ReactNode[] = [];
  let cursor = 0;

  for (;;) {
    const at = text.toLowerCase().indexOf(needle, cursor);
    if (at === -1) break;
    if (at > cursor) parts.push(text.slice(cursor, at));
    parts.push(
      <mark key={at} className="rounded-sm bg-signal/20 px-0.5 text-ink">
        {text.slice(at, at + needle.length)}
      </mark>,
    );
    cursor = at + needle.length;
  }
  parts.push(text.slice(cursor));
  return <>{parts}</>;
}

/**
 * The recording and the transcript, as two sections that stay in step.
 *
 * They are presented separately because they are read for different reasons —
 * you play a recording, you search a transcript — and burying the transcript
 * under the player made it look like a detail of the recording rather than the
 * record of the call. But they remain one component, because the transcript's
 * real job is to be the index into the recording: clicking a line seeks the
 * player to that moment, and the line under the playhead stays highlighted as
 * it runs. That only works if the seek can reach the media element.
 */
export function CallPlayback({
  meetingId,
  segments,
  rawText,
  meta,
}: {
  meetingId: string;
  segments: SpeakerSegment[] | null;
  /** Shown when the bot returned text with no speaker breakdown. */
  rawText?: string | null;
  /** Source and duration, shown against the transcript heading. */
  meta?: string;
}) {
  const [state, setState] = useState<State>({ kind: "loading" });
  const [activeIndex, setActiveIndex] = useState(-1);
  const [query, setQuery] = useState("");
  const [speaker, setSpeaker] = useState<string>("");
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

  const speakers = useMemo(
    () => [...new Set((segments ?? []).map((s) => s.speakerName).filter(Boolean))],
    [segments],
  );

  const visible = useMemo(() => {
    const all = (segments ?? []).map((segment, index) => ({ segment, index }));
    const needle = query.trim().toLowerCase();
    return all.filter(
      ({ segment }) =>
        (!speaker || segment.speakerName === speaker) &&
        (!needle || segment.text.toLowerCase().includes(needle)),
    );
  }, [segments, query, speaker]);

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

  const plainText = useMemo(() => {
    if (segments?.length) {
      return segments
        .map((s) => `[${stamp(s.timestampMs)}] ${s.speakerName}: ${s.text}`)
        .join("\n");
    }
    return rawText ?? "";
  }, [segments, rawText]);

  const hasSegments = Boolean(segments && segments.length > 0);
  const playable = state.kind === "ready";

  return (
    <>
      {/* --- Recording ---------------------------------------------------- */}
      <section id="recording" className="scroll-mt-24">
        <div className="mb-3.5 flex items-baseline gap-3">
          <h2 className="font-display text-[13px] font-bold uppercase tracking-[0.08em] text-ink">
            Recording
          </h2>
          <span className="h-px flex-1 bg-rule" aria-hidden />
          {hasSegments && playable && (
            <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-faint">
              Click any line below to jump
            </span>
          )}
        </div>

        <div className="rounded-lg border border-rule bg-surface px-5 py-4">
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
              <>
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
                <p className="mt-2.5 text-[12px] text-faint">
                  Audio only — this call was recorded before video capture was switched on.
                </p>
              </>
            ))}

          {state.kind === "pending" && (
            <p className="text-[13.5px] text-muted">
              Still uploading. It appears here once the bot has finished writing it out.
            </p>
          )}
          {state.kind === "error" && <p className="text-[13.5px] text-flag">{state.message}</p>}
        </div>
      </section>

      {/* --- Transcript --------------------------------------------------- */}
      <section id="transcript" className="scroll-mt-24">
        <div className="mb-3.5 flex items-baseline gap-3">
          <h2 className="font-display text-[13px] font-bold uppercase tracking-[0.08em] text-ink">
            Full transcript
          </h2>
          <span className="h-px flex-1 bg-rule" aria-hidden />
          {meta && (
            <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-faint">
              {meta}
            </span>
          )}
        </div>

        <div className="overflow-hidden rounded-lg border border-rule bg-surface">
          {hasSegments && (
            <div className="flex flex-wrap items-center gap-2 border-b border-rule-soft px-4 py-3">
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search what was said…"
                className="min-w-0 flex-1 rounded border border-rule bg-sunken px-3 py-1.5 text-[13px] text-ink outline-none placeholder:text-faint focus:border-faint"
              />
              {speakers.length > 1 && (
                <select
                  value={speaker}
                  onChange={(event) => setSpeaker(event.target.value)}
                  className="shrink-0 rounded border border-rule bg-sunken px-2 py-1.5 text-[12.5px] text-ink outline-none focus:border-faint"
                >
                  <option value="">Everyone</option>
                  {speakers.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
              )}
              <button
                type="button"
                onClick={() => void navigator.clipboard?.writeText(plainText)}
                className="shrink-0 rounded border border-rule px-2.5 py-1.5 text-[12.5px] text-muted transition-colors hover:border-faint hover:text-ink"
              >
                Copy
              </button>
            </div>
          )}

          {hasSegments ? (
            <>
              {visible.length === 0 ? (
                <p className="px-5 py-6 text-[13px] text-muted">
                  Nothing in this call matches “{query}”.
                </p>
              ) : (
                <div className="max-h-[40rem] overflow-y-auto px-2 py-2">
                  <ol>
                    {visible.map(({ segment, index }) => {
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
                                <Highlighted text={segment.text} query={query} />
                              </span>
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ol>
                </div>
              )}

              <div className="border-t border-rule-soft px-4 py-2.5 font-mono text-[10px] uppercase tracking-[0.12em] text-faint">
                {query || speaker
                  ? `${visible.length} of ${segments!.length} lines`
                  : `${segments!.length} lines · ${speakers.length} ${
                      speakers.length === 1 ? "speaker" : "speakers"
                    }`}
              </div>
            </>
          ) : rawText ? (
            <div className="max-h-[40rem] overflow-y-auto px-5 py-4">
              {/* No speaker breakdown — usually an uploaded transcript. */}
              <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-ink-soft">
                {rawText}
              </p>
            </div>
          ) : null}
        </div>
      </section>
    </>
  );
}
