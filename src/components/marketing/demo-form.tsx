"use client";

import { useState } from "react";
import { ArrowRight } from "lucide-react";

type State = "idle" | "sending" | "sent" | "error";

const TEAM_SIZES = ["1–10 reps", "11–50 reps", "51–200 reps", "200+ reps"];

/**
 * Ask for a demo.
 *
 * The page used to send a stranger straight to a Google consent screen, which
 * asks an enterprise buyer to grant calendar access to a product they have not
 * seen yet. Nobody does that. This asks for the five things a first
 * conversation actually needs and nothing else — every extra field costs
 * completions, and team size is the only one here that is not strictly
 * identity, kept because it decides who takes the call.
 */
export function DemoForm({ source }: { source?: string }) {
  const [state, setState] = useState<State>("idle");
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (state === "sending") return;

    const form = new FormData(event.currentTarget);
    setState("sending");
    setError(null);

    try {
      const response = await fetch("/api/demo-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.get("name"),
          email: form.get("email"),
          company: form.get("company"),
          teamSize: form.get("teamSize"),
          message: form.get("message"),
          website: form.get("website"), // honeypot
          source,
        }),
      });
      if (!response.ok) {
        const detail = await response.json().catch(() => null);
        throw new Error(detail?.error ?? "Something went wrong. Try again.");
      }
      setState("sent");
    } catch (caught) {
      setState("error");
      setError(caught instanceof Error ? caught.message : "Something went wrong. Try again.");
    }
  }

  if (state === "sent") {
    return (
      <div className="flex flex-col items-center gap-3 rounded border border-volt/25 bg-volt/[0.06] px-8 py-10 text-center">
        <p className="text-lg font-medium text-ink">Request received.</p>
        <p className="max-w-sm text-sm leading-relaxed text-muted">
          We read every one of these ourselves. Expect a reply within one working day, from a person
          rather than a sequence.
        </p>
      </div>
    );
  }

  const input =
    "w-full rounded border border-rule bg-sunken/60 px-3.5 py-2.5 text-sm text-ink outline-none transition-colors placeholder:text-faint focus:border-volt/50";
  const label = "text-xs font-medium uppercase tracking-widest text-muted";

  return (
    <form onSubmit={submit} className="flex w-full flex-col gap-4 text-left">
      {/* Hidden from people and from screen readers: only a bot fills this. */}
      <div aria-hidden className="absolute left-[-9999px] h-0 w-0 overflow-hidden">
        <label htmlFor="website">Website</label>
        <input id="website" name="website" type="text" tabIndex={-1} autoComplete="off" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="name" className={label}>
            Name
          </label>
          <input id="name" name="name" required maxLength={120} className={input} placeholder="Dana Whitfield" />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="email" className={label}>
            Work email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            maxLength={200}
            className={input}
            placeholder="dana@company.com"
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="company" className={label}>
            Company
          </label>
          <input id="company" name="company" required maxLength={160} className={input} placeholder="Cobalt Systems" />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="teamSize" className={label}>
            Sales team
          </label>
          <select id="teamSize" name="teamSize" className={input} defaultValue="">
            <option value="" disabled>
              How many reps?
            </option>
            {TEAM_SIZES.map((size) => (
              <option key={size} value={size} className="bg-ground">
                {size}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="message" className={label}>
          What are you trying to fix? <span className="text-faint">(optional)</span>
        </label>
        <textarea
          id="message"
          name="message"
          rows={3}
          maxLength={2000}
          className={`${input} resize-y`}
          placeholder="Where deals are stalling, or what your reps keep getting stuck on."
        />
      </div>

      {error && (
        <p className="rounded border border-flag/25 bg-flag/10 px-3.5 py-2.5 text-sm text-flag">
          {error}
        </p>
      )}

      <div className="flex flex-col gap-2.5 pt-1">
        <button
          type="submit"
          disabled={state === "sending"}
          className="group inline-flex w-fit items-center gap-2 rounded bg-volt px-5 py-3 text-sm font-semibold text-ground shadow-[0_0_28px_-8px_var(--color-volt)] transition-[transform,box-shadow] duration-150 ease-out hover:shadow-[0_0_36px_-6px_var(--color-volt)] active:scale-[0.97] disabled:opacity-50 disabled:shadow-none"
        >
          {state === "sending" ? "Sending…" : "Request a demo"}
          {state !== "sending" && (
            <ArrowRight className="size-4 transition-transform duration-150 ease-out group-hover:translate-x-0.5" />
          )}
        </button>
        <p className="text-xs text-faint">
          No calendar access, no card, nothing installed. A conversation first.
        </p>
      </div>
    </form>
  );
}
