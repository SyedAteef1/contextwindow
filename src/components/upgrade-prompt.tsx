"use client";

import { useState } from "react";

import { Eyebrow } from "@/components/ui";

/**
 * The moment the free plan runs out of usefulness.
 *
 * Shown beside a brief the research covered but the bot is not attending —
 * days before a call the rep is about to walk into alone, which is when wanting
 * a notetaker in the room is a feeling rather than a pitch.
 *
 * It used to link out to the marketing page's pricing section, which threw a
 * signed-in rep back onto a sales site to read a number they could have been
 * told in place. Now the request happens here: seats, an optional sentence, and
 * a human replies with a price. That is deliberate rather than lazy — every
 * team gets engineers for setup, so what it costs depends on what they connect,
 * and a checkout would be quoting before anyone asked what they need.
 *
 * Cobalt, not amber and not emerald. Nothing has gone wrong — the free plan did
 * exactly what it promises — and this is a commercial offer rather than the
 * product doing its trick.
 */
export function UpgradePrompt({
  companyName,
  alreadyRequested = false,
}: {
  companyName?: string | null;
  /** True when this workspace has an open request, so we do not ask twice. */
  alreadyRequested?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [seats, setSeats] = useState("");
  const [note, setNote] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent">(
    alreadyRequested ? "sent" : "idle",
  );
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (state === "sending") return;
    setState("sending");
    setError(null);
    try {
      const response = await fetch("/api/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ seats, note }),
      });
      if (!response.ok) {
        const detail = await response.json().catch(() => null);
        throw new Error(detail?.error ?? "Could not send that. Try again.");
      }
      setState("sent");
    } catch (caught) {
      setState("idle");
      setError(caught instanceof Error ? caught.message : "Could not send that. Try again.");
    }
  }

  if (state === "sent") {
    return (
      <div className="rounded-lg border border-cobalt/35 bg-cobalt/[0.06] px-5 py-4">
        <Eyebrow>Quote requested</Eyebrow>
        <p className="mt-1.5 text-[13.5px] leading-relaxed text-ink-soft">
          We&rsquo;ll send pricing within one working day, from a person rather than a sequence.
          Nothing changes on your account until you say yes.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-cobalt/35 bg-cobalt/[0.06] px-5 py-4">
      <div className="flex flex-wrap items-center gap-2.5">
        <Eyebrow>You&rsquo;re on Free</Eyebrow>
        <span className="rounded border border-rule bg-surface px-1.5 py-px font-mono text-[9.5px] uppercase tracking-[0.12em] text-muted">
          Research only
        </span>
      </div>

      <p className="mt-1.5 text-[13.5px] leading-relaxed text-ink-soft">
        The brief is done. The notetaker is not joining
        {companyName ? ` ${companyName}` : " this call"} — that is what Pro adds: a bot in the
        room, answers on your screen while the buyer is still talking, and the follow-up drafted
        before you close the tab.
      </p>

      {!open ? (
        <div className="mt-3.5 flex flex-wrap items-center gap-4">
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="inline-flex items-center rounded bg-cobalt-deep px-4 py-2 text-[13px] font-semibold text-ink transition-transform duration-150 ease-out active:scale-[0.97]"
          >
            Request a quote
          </button>
          <span className="text-[12.5px] text-faint">
            No card. We reply with a price and what setup involves.
          </span>
        </div>
      ) : (
        <form onSubmit={submit} className="mt-4 flex flex-col gap-3 border-t border-cobalt/20 pt-4">
          <div className="flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1.5">
              <span className="font-mono text-[9.5px] uppercase tracking-[0.14em] text-faint">
                How many reps?
              </span>
              <input
                value={seats}
                onChange={(e) => setSeats(e.target.value)}
                inputMode="numeric"
                placeholder="8"
                className="w-24 rounded border border-rule bg-sunken/60 px-3 py-2 text-[13.5px] text-ink outline-none transition-colors placeholder:text-faint focus:border-cobalt/60"
              />
            </label>
            <label className="flex min-w-[14rem] flex-1 flex-col gap-1.5">
              <span className="font-mono text-[9.5px] uppercase tracking-[0.14em] text-faint">
                Anything we should know? <span className="normal-case tracking-normal">(optional)</span>
              </span>
              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="We run everything through Zoom, and security reviews us first."
                className="w-full rounded border border-rule bg-sunken/60 px-3 py-2 text-[13.5px] text-ink outline-none transition-colors placeholder:text-faint focus:border-cobalt/60"
              />
            </label>
          </div>

          {error && <p className="text-[12.5px] text-flag">{error}</p>}

          <div className="flex items-center gap-4">
            <button
              type="submit"
              disabled={state === "sending"}
              className="inline-flex items-center rounded bg-cobalt-deep px-4 py-2 text-[13px] font-semibold text-ink transition-transform duration-150 ease-out active:scale-[0.97] disabled:opacity-60"
            >
              {state === "sending" ? "Sending…" : "Send request"}
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-[12.5px] text-muted underline underline-offset-4 transition-colors hover:text-ink"
            >
              Not now
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
