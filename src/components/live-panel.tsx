"use client";

import { useCallback, useEffect, useState } from "react";

import { Eyebrow, LiveDot, Pill } from "./ui";

type LiveAnswer = {
  id: string;
  question: string;
  answer: string | null;
  status: "heard" | "answering" | "answered" | "skipped";
  skippedReason?: string | null;
  askedBy: string | null;
  latencyMs: number | null;
  via: string | null;
  createdAt: string;
};

/**
 * Answers appearing while the call is happening.
 *
 * Newest first, because a rep glances at this mid-sentence and should not have
 * to scan. The latency is shown deliberately: if answers stop landing inside a
 * second they have stopped being useful, and that should be visible.
 */
export function LivePanel({ meetingId, live }: { meetingId: string; live: boolean }) {
  const [answers, setAnswers] = useState<LiveAnswer[]>([]);
  const [connected, setConnected] = useState(false);

  /**
   * Merge new answers, newest first.
   *
   * The updater must stay pure: React invokes it more than once in development
   * to surface exactly this kind of bug. Deduplicating against a ref mutated
   * inside the updater meant the second invocation filtered everything out and
   * returned an empty list — so the panel stayed on its empty state while the
   * data was arriving perfectly. Dedupe against `current` instead.
   */
  const add = useCallback((incoming: LiveAnswer[]) => {
    setAnswers((current) => {
      // Each utterance is published twice — once on hearing it, once when the
      // answer resolves — so merge by id rather than appending.
      const byId = new Map(current.map((item) => [item.id, item]));
      for (const item of incoming) byId.set(item.id, item);

      return [...byId.values()].sort(
        (a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt),
      );
    });
  }, []);

  useEffect(() => {
    const source = new EventSource(`/api/meetings/${meetingId}/live`);

    source.addEventListener("open", () => setConnected(true));
    source.addEventListener("backlog", (event) => {
      setConnected(true);
      add(JSON.parse((event as MessageEvent).data) as LiveAnswer[]);
    });
    source.addEventListener("answer", (event) => {
      add([JSON.parse((event as MessageEvent).data) as LiveAnswer]);
    });
    // EventSource reconnects on its own; just reflect the state.
    source.addEventListener("error", () => setConnected(false));

    return () => source.close();
  }, [meetingId, add]);

  return (
    <section className="rounded-lg border border-rule bg-surface">
      <div className="flex items-center justify-between border-b border-rule-soft px-5 py-3.5">
        <div className="flex items-center gap-2.5">
          <Eyebrow>Answers on this call</Eyebrow>
          {live && <Pill tone="live"><LiveDot />Live</Pill>}
        </div>
        <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-faint">
          {connected ? "connected" : "reconnecting…"}
        </span>
      </div>

      <div className="max-h-[26rem] overflow-y-auto px-5 py-4">
        {answers.length === 0 ? (
          <p className="py-6 text-center text-[13.5px] text-muted">
            {live
              ? "Listening. Everything said on the call appears here, and questions get an answer attached."
              : "Nothing was asked on this call, or it hasn't started yet."}
          </p>
        ) : (
          <ol className="space-y-5">
            {answers.map((item) => (
              <li key={item.id} className="rise">
                <p className="text-[13px] text-muted">
                  <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-faint">
                    {item.askedBy ?? "Someone"} said
                  </span>
                  <br />
                  {item.question}
                </p>

                {item.status === "answering" && (
                  <p className="pulse-live mt-1.5 border-l-2 border-signal pl-3 font-mono text-[11px] uppercase tracking-[0.12em] text-signal">
                    Answering…
                  </p>
                )}

                {item.status === "answered" && item.answer && (
                  <p className="mt-1.5 border-l-2 border-signal pl-3 text-[14.5px] leading-relaxed text-ink">
                    {item.answer}
                  </p>
                )}

                {item.status === "skipped" && (
                  <p className="mt-1.5 border-l-2 border-rule pl-3 text-[12.5px] italic text-faint">
                    Nothing worth putting on screen
                    {item.skippedReason ? ` — ${item.skippedReason}` : ""}.
                  </p>
                )}

                {/*
                  * Where the answer came from, stated plainly. A cached answer
                  * is ~200x faster than a generated one, and the difference is
                  * worth seeing — both to trust the fast ones and to notice
                  * when the cache is missing questions it should cover.
                  */}
                {item.latencyMs !== null && item.status !== "answering" && (
                  <p className="mt-2 flex items-center gap-2">
                    {item.via === "cache" ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-live-soft px-2 py-[2px] font-mono text-[9.5px] font-medium uppercase tracking-[0.1em] text-live">
                        ⚡ Ready before the call
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-sunken px-2 py-[2px] font-mono text-[9.5px] font-medium uppercase tracking-[0.1em] text-muted">
                        Generated live
                      </span>
                    )}
                    <span className="font-mono text-[9.5px] uppercase tracking-[0.1em] text-faint">
                      {item.latencyMs} ms
                    </span>
                  </p>
                )}
              </li>
            ))}
          </ol>
        )}
      </div>
    </section>
  );
}
