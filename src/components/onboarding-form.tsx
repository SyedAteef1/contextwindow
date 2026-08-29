"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";

/**
 * The one question worth interrupting a new rep for.
 *
 * Their website, because a single URL yields the positioning, the product
 * language and often the customer list — everything a first brief needs to
 * sound like it came from their company rather than from nowhere. The second
 * field is optional and is there for the thing a website never says plainly:
 * who they actually want to sell to.
 *
 * Skipping is allowed and says so. A gate that cannot be skipped is a gate
 * people abandon, and we would rather have the account than the answer.
 */
export function OnboardingForm({ companyName }: { companyName: string }) {
  const router = useRouter();
  const [website, setWebsite] = useState("");
  const [idealCustomer, setIdealCustomer] = useState("");
  const [state, setState] = useState<"idle" | "reading" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (state === "reading") return;
    setState("reading");
    setError(null);

    try {
      const response = await fetch("/api/workspace/onboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ website, idealCustomer }),
      });
      if (!response.ok) {
        const detail = await response.json().catch(() => null);
        throw new Error(detail?.error ?? "That didn't work. Try again.");
      }
      router.push("/meetings");
      router.refresh();
    } catch (caught) {
      setState("error");
      setError(caught instanceof Error ? caught.message : "That didn't work. Try again.");
    }
  }

  async function skip() {
    setState("reading");
    await fetch("/api/workspace/onboard", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    }).catch(() => undefined);
    router.push("/meetings");
    router.refresh();
  }

  const field =
    "w-full rounded border border-rule bg-sunken/60 px-3.5 py-2.5 text-[14px] text-ink outline-none transition-colors placeholder:text-faint focus:border-cobalt/60";

  return (
    <form onSubmit={submit} className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <label htmlFor="website" className="text-[13px] font-medium text-ink">
          Your company&rsquo;s website
        </label>
        <input
          id="website"
          value={website}
          onChange={(e) => setWebsite(e.target.value)}
          placeholder="acme.com"
          autoComplete="url"
          autoFocus
          className={field}
        />
        <p className="text-[12.5px] leading-relaxed text-faint">
          We read it once to learn how {companyName} describes itself — what you sell, how you
          position it, who you name as customers. Every brief is written against that.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="icp" className="text-[13px] font-medium text-ink">
          Who are you trying to sell to? <span className="text-faint">(optional)</span>
        </label>
        <textarea
          id="icp"
          value={idealCustomer}
          onChange={(e) => setIdealCustomer(e.target.value)}
          rows={3}
          placeholder="Series B fintechs in the US, 50–500 people. We win when compliance is the bottleneck."
          className={`${field} resize-y`}
        />
        <p className="text-[12.5px] leading-relaxed text-faint">
          The thing a website never says plainly. It steers research towards the signals you care
          about instead of generic company facts.
        </p>
      </div>

      {error && (
        <p className="rounded border border-flag/25 bg-flag/10 px-3.5 py-2.5 text-[13px] text-flag">
          {error}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-4">
        <button
          type="submit"
          disabled={state === "reading"}
          className="group inline-flex items-center gap-2 rounded bg-cobalt-deep px-5 py-3 text-sm font-semibold text-ink transition-transform duration-150 ease-out active:scale-[0.97] disabled:opacity-60"
        >
          {state === "reading" ? "Reading your site…" : "Continue"}
          {state !== "reading" && (
            <ArrowRight className="size-4 transition-transform duration-150 ease-out group-hover:translate-x-0.5" />
          )}
        </button>
        <button
          type="button"
          onClick={skip}
          disabled={state === "reading"}
          className="text-[13px] text-muted underline underline-offset-4 transition-colors hover:text-ink disabled:opacity-60"
        >
          Skip for now
        </button>
      </div>
    </form>
  );
}
