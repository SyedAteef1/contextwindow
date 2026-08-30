"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "./ui";

/**
 * What the assistant believes about the company doing the selling.
 *
 * This is the context every brief is written against, so it is shown rather
 * than merely stored — including the raw text read off the website, which is
 * the part most likely to be wrong. A scrape that came back with a cookie
 * banner is invisible until you can see it, and then it is obvious.
 */
export function WorkspaceProfile({
  website,
  description,
  idealCustomer,
}: {
  website: string | null;
  description: string | null;
  idealCustomer: string | null;
}) {
  const router = useRouter();
  const [form, setForm] = useState({
    website: website ?? "",
    description: description ?? "",
    idealCustomer: idealCustomer ?? "",
  });
  const [state, setState] = useState<"idle" | "saving" | "reading" | "saved">("idle");
  const [error, setError] = useState<string | null>(null);

  async function submit(rescrape: boolean) {
    setState(rescrape ? "reading" : "saving");
    setError(null);
    try {
      const response = await fetch("/api/workspace", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, rescrape }),
      });
      if (!response.ok) {
        const detail = await response.json().catch(() => null);
        throw new Error(detail?.error ?? "Could not save that.");
      }
      setState("saved");
      router.refresh();
    } catch (caught) {
      setState("idle");
      setError(caught instanceof Error ? caught.message : "Could not save that.");
    }
  }

  const field =
    "w-full rounded border border-rule bg-sunken/60 px-3.5 py-2.5 text-[13.5px] text-ink outline-none transition-colors placeholder:text-faint focus:border-cobalt/60";
  const busy = state === "saving" || state === "reading";

  return (
    <div className="flex flex-col gap-6">
      <Row
        label="Website"
        hint="Read once at sign-up. Re-read it whenever your positioning changes."
      >
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={form.website}
            onChange={(e) => setForm({ ...form, website: e.target.value })}
            placeholder="acme.com"
            className={`${field} sm:max-w-xs`}
          />
          <Button
            variant="secondary"
            onClick={() => submit(true)}
            disabled={busy || !form.website.trim()}
          >
            {state === "reading" ? "Reading…" : "Re-read site"}
          </Button>
        </div>
      </Row>

      <Row
        label="What we sell"
        hint="Taken from your website. Correct it if the scrape grabbed the wrong thing — this is what the model reads."
      >
        <textarea
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          rows={7}
          placeholder="We sell…"
          className={`${field} resize-y font-mono text-[12.5px] leading-relaxed`}
        />
      </Row>

      <Row
        label="Who we're looking for"
        hint="The thing a website never says plainly. Briefs judge each buyer against it and say where they don't fit."
      >
        <textarea
          value={form.idealCustomer}
          onChange={(e) => setForm({ ...form, idealCustomer: e.target.value })}
          rows={3}
          placeholder="Series B fintechs in the US, 50–500 people. We win when compliance is the bottleneck."
          className={`${field} resize-y`}
        />
      </Row>

      {error && (
        <p className="rounded border border-flag/25 bg-flag/10 px-3.5 py-2.5 text-[13px] text-flag">
          {error}
        </p>
      )}

      <div className="flex items-center gap-4 border-t border-rule-soft pt-5">
        <Button onClick={() => submit(false)} disabled={busy}>
          {state === "saving" ? "Saving…" : "Save changes"}
        </Button>
        {state === "saved" && <span className="text-[13px] text-live">Saved</span>}
      </div>
    </div>
  );
}

/**
 * One setting: what it is on the left, the control on the right.
 *
 * The pattern every serious settings screen uses, because it lets someone scan
 * the labels alone to find what they came for and never read a hint they did
 * not need.
 */
function Row({
  label,
  hint,
  children,
}: {
  label: string;
  hint: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-[13rem_minmax(0,1fr)] sm:gap-8">
      <div>
        <p className="text-[13.5px] font-medium text-ink">{label}</p>
        <p className="mt-1 text-[12.5px] leading-relaxed text-faint">{hint}</p>
      </div>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
