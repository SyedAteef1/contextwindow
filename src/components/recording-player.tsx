"use client";

import { useEffect, useState } from "react";

import { Eyebrow } from "./ui";

type State =
  | { kind: "loading" }
  | { kind: "ready"; url: string }
  | { kind: "pending" }
  | { kind: "error"; message: string };

/**
 * The call recording.
 *
 * The link is minted per view because it expires, so this fetches on mount
 * rather than receiving a URL as a prop. A call that has just ended is still
 * uploading — that is the `pending` state, and it is not an error.
 */
export function RecordingPlayer({ meetingId }: { meetingId: string }) {
  const [state, setState] = useState<State>({ kind: "loading" });

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
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

  // Nothing useful to say while the request is in flight, and a spinner for a
  // sub-second fetch is worse than nothing.
  if (state.kind === "loading") return null;

  return (
    <section className="rounded-lg border border-rule bg-surface px-5 py-4">
      <Eyebrow>Recording</Eyebrow>
      {state.kind === "ready" && (
        <audio controls preload="none" src={state.url} className="mt-3 w-full">
          Your browser cannot play this recording.
        </audio>
      )}
      {state.kind === "pending" && (
        <p className="mt-2 text-[13.5px] text-muted">
          Still uploading. It appears here once the bot has finished writing it out.
        </p>
      )}
      {state.kind === "error" && <p className="mt-2 text-[13.5px] text-flag">{state.message}</p>}
    </section>
  );
}
