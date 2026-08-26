import type { ReactNode } from "react";

import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { LatencyChart } from "@/components/marketing/latency-chart";
import { Wordmark } from "@/components/marketing/wordmark";
import { WaveField } from "@/components/originkit/ui/hero-31/wave-field";

export const dynamic = "force-dynamic";

/**
 * The enterprise positioning, on the existing page.
 *
 * A copy test, not a second product page. Every component, colour, border and
 * spacing value is lifted from `/` unchanged so the only variable is the words —
 * which is the point: if this reads better, it is the positioning doing it and
 * not a nicer layout.
 *
 * Deliberately not linked from anywhere and excluded from search. Some of the
 * claims below describe capabilities the product does not have yet (see the
 * note in the repo), so this must not be reachable by a customer.
 */
export const metadata = {
  title: "Context Window — buyer intelligence",
  robots: { index: false, follow: false },
};

const NAV = [
  { label: "How it works", href: "#how" },
  { label: "Speed", href: "#speed" },
  { label: "Beta", href: "#beta" },
];

function Cta({ children = "Run a free prospect analysis" }: { children?: string }) {
  return (
    <Link
      href="/api/auth/google/start"
      className="group inline-flex items-center gap-2 rounded bg-white px-5 py-3 text-sm font-medium text-zinc-950 transition-transform duration-150 ease-out active:scale-[0.97]"
    >
      {children}
      <ArrowRight className="size-4 transition-transform duration-150 ease-out group-hover:translate-x-0.5" />
    </Link>
  );
}

function Eyebrow({ children }: { children: string }) {
  return (
    <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500">{children}</p>
  );
}

function Cell({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <article
      className={`flex flex-col justify-between gap-8 rounded border border-white/10 bg-zinc-900/50 p-8 transition-colors duration-150 ease-out hover:border-white/20 ${className}`}
    >
      {children}
    </article>
  );
}

function CellText({ kicker, title, body }: { kicker: string; title: string; body: string }) {
  return (
    <div className="flex flex-col gap-3">
      <Eyebrow>{kicker}</Eyebrow>
      <h3 className="text-xl font-medium leading-tight tracking-tight text-white">{title}</h3>
      <p className="text-sm leading-relaxed text-zinc-400">{body}</p>
    </div>
  );
}

function Panel({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-hidden rounded border border-white/10 bg-zinc-950">{children}</div>
  );
}

export default function AltLandingPage() {
  return (
    <div className="min-h-screen bg-zinc-950 text-white selection:bg-cyan-500/30">
      {/* --- Nav ------------------------------------------------------------ */}
      <header className="sticky top-0 z-50 border-b border-white/10 bg-zinc-950/70 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link
            href="/alt"
            className="transition-opacity duration-150 ease-out hover:opacity-80"
            aria-label="Context Window home"
          >
            <Wordmark />
          </Link>

          <nav className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-1 md:flex">
            {NAV.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="rounded px-3 py-2 text-sm text-zinc-400 transition-colors duration-150 ease-out hover:bg-white/5 hover:text-white"
              >
                {item.label}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-1">
            <Link
              href="/api/auth/google/start"
              className="hidden rounded px-3 py-2 text-sm text-zinc-400 transition-colors duration-150 ease-out hover:text-white sm:block"
            >
              Sign in
            </Link>
            <Link
              href="#beta"
              className="rounded bg-white px-4 py-2 text-sm font-medium text-zinc-950 transition-transform duration-150 ease-out active:scale-[0.97]"
            >
              Apply for beta
            </Link>
          </div>
        </div>
      </header>

      {/* --- Hero ----------------------------------------------------------- */}
      <section className="relative isolate overflow-hidden">
        <div aria-hidden className="absolute inset-0 opacity-[0.15]">
          <WaveField bgColor="#09090b" color="#2563eb" />
        </div>
        <div
          aria-hidden
          className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-b from-transparent to-zinc-950"
        />

        <div className="relative mx-auto w-full max-w-7xl px-4 py-20 sm:px-6 lg:px-8 lg:py-28">
          <div className="grid items-center gap-16 lg:grid-cols-2 lg:gap-20">
            <div className="flex flex-col gap-6">
              <div className="inline-flex w-fit items-center gap-2 rounded border border-white/10 bg-white/5 px-3 py-1">
                <span className="size-1.5 rounded-full bg-emerald-400" />
                <span className="text-xs text-zinc-400">Real-time buyer intelligence</span>
              </div>

              <div className="flex flex-col gap-4">
                <h1 className="text-5xl font-semibold leading-none tracking-tighter text-white sm:text-6xl lg:text-7xl xl:text-8xl">
                  Stop coaching after the deal is lost.
                </h1>
                <p className="max-w-2xl text-base leading-relaxed text-zinc-400">
                  Standard conversational AI just transcribes the call. Context Window actively
                  analyses buyer behaviour in real time, feeding your account executives the exact
                  objections and pivots they need to win the room — while the meeting is still
                  happening.
                </p>
              </div>

              <div className="flex flex-col gap-3">
                <div className="flex flex-wrap items-center gap-3">
                  <Cta />
                  <a
                    href="#how"
                    className="inline-flex items-center gap-2 rounded border border-white/10 px-5 py-3 text-sm font-medium text-zinc-300 transition-[transform,border-color] duration-150 ease-out hover:border-white/20 active:scale-[0.97]"
                  >
                    See how it works
                  </a>
                </div>
                <p className="text-sm text-zinc-500">
                  Get a pre-call buyer profile in 60 seconds.
                </p>
              </div>
            </div>

            {/* The same rail and panel, showing a live coaching prompt rather
                than a recalled fact — the positioning changed, so what the
                product is caught doing has to change with it. */}
            <div className="rail-dark relative">
              <div className="relative pb-10">
                <span className="rail-stamp font-mono text-xs text-zinc-600">− 1 day</span>
                <span className="rail-dot" aria-hidden />
                <p className="text-sm leading-relaxed text-zinc-400">
                  A behavioural profile of everyone on the invite.
                  <span className="text-zinc-300"> Dana decides on risk, not price.</span>
                </p>
              </div>

              <div className="relative">
                <span className="rail-stamp font-mono text-xs text-emerald-400">14:12</span>
                <span className="rail-dot" data-live="true" aria-hidden />
                <div className="relative rounded border border-white/10 bg-zinc-900/50 p-2">
                  <div className="overflow-hidden rounded border border-white/10 bg-zinc-950">
                    <div className="flex items-center gap-2 border-b border-white/10 px-4 py-3">
                      <span className="size-2 rounded-full bg-zinc-700" />
                      <span className="size-2 rounded-full bg-zinc-700" />
                      <span className="size-2 rounded-full bg-zinc-700" />
                      <span className="ml-2 text-xs text-zinc-500">Cobalt Systems</span>
                      <span className="ml-auto flex items-center gap-2">
                        <span className="size-1.5 animate-pulse rounded-full bg-emerald-400" />
                        <span className="text-xs uppercase tracking-widest text-emerald-400">
                          Live
                        </span>
                      </span>
                    </div>

                    <div className="flex flex-col gap-6 p-6">
                      <div className="flex flex-col gap-2">
                        <p className="text-xs uppercase tracking-widest text-zinc-600">
                          Dana Whitfield · 14:12
                        </p>
                        <p className="text-base leading-snug text-white">
                          That timeline is… well, we would need to look at it internally first.
                        </p>
                      </div>

                      <div className="flex flex-col gap-3 rounded border border-amber-500/20 bg-amber-500/5 p-4">
                        <div className="flex items-center gap-3">
                          <span className="text-xs font-semibold uppercase tracking-widest text-amber-400">
                            Pivot now
                          </span>
                          <span className="ml-auto font-mono text-xs tabular-nums text-zinc-500">
                            340 ms
                          </span>
                        </div>
                        <p className="text-sm leading-relaxed text-zinc-300">
                          Hedging on timeline, not budget. Name the parallel-run migration before
                          she takes this to committee.
                        </p>

                        <p className="flex flex-wrap items-center gap-2 border-t border-dashed border-amber-500/20 pt-3">
                          <span className="rounded border border-amber-500/30 px-1.5 py-px text-[9px] font-semibold uppercase tracking-[0.14em] text-amber-400/90">
                            Masked objection
                          </span>
                          <span className="font-mono text-[10px] text-zinc-600">
                            Pace down 22% · hedging language
                          </span>
                        </p>
                      </div>

                      <div className="flex items-center gap-3 border-t border-dashed border-white/10 pt-4">
                        <span className="text-xs uppercase tracking-widest text-zinc-600">
                          Engagement
                        </span>
                        <span className="flex gap-1">
                          {[true, true, false, false].map((on, index) => (
                            <span
                              key={index}
                              className={`h-3 w-1 rounded-[2px] ${on ? "bg-amber-400" : "bg-zinc-800"}`}
                            />
                          ))}
                        </span>
                        <span className="text-xs text-zinc-500">falling · 1 masked objection</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="relative mt-10">
                <span className="rail-stamp font-mono text-xs text-zinc-600">+ 2 min</span>
                <span className="rail-dot" aria-hidden />
                <p className="text-sm leading-relaxed text-zinc-400">
                  <span className="text-zinc-300">The CRM is already updated</span>, so the rep
                  never opens a form to record what just happened.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* --- The core problem ----------------------------------------------- */}
      <section className="border-t border-white/10 py-20 lg:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-12">
            <div className="mx-auto flex max-w-2xl flex-col gap-3 text-center">
              <Eyebrow>The core problem</Eyebrow>
              <p className="text-2xl font-medium leading-tight tracking-tight text-zinc-200 sm:text-3xl">
                Coaching after the call doesn&rsquo;t save the deal.
              </p>
              <p className="text-base leading-relaxed text-zinc-400">
                Sales leaders spend thousands on AI that generates transcripts and post-call
                summaries. When a rep misses a drop in the buyer&rsquo;s tone on a live call, a
                transcript tomorrow will not help them today.
              </p>
            </div>

            {/* The comparison, as a two-column table on a real border rather
                than tinted panels — the ground already carries the contrast. */}
            <div className="mx-auto w-full max-w-4xl overflow-x-auto">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="w-1/2 px-4 py-4 text-xs font-semibold uppercase tracking-widest text-zinc-500">
                      Passive AI
                    </th>
                    <th className="w-1/2 px-4 py-4 text-xs font-semibold uppercase tracking-widest text-white">
                      Context Window
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    [
                      "Logs the call for a manager to review later.",
                      "Coaches the rep live, in the moment.",
                    ],
                    [
                      "Summarises what was said.",
                      "Analyses how it was said — tone, pacing, sentiment.",
                    ],
                    [
                      "Reps go in guessing the buyer's style.",
                      "Reps get a behavioural profile before the call starts.",
                    ],
                  ].map(([before, after]) => (
                    <tr key={before} className="border-b border-white/5">
                      <td className="px-4 py-5 align-top text-sm leading-relaxed text-zinc-500">
                        {before}
                      </td>
                      <td className="px-4 py-5 align-top text-sm leading-relaxed text-zinc-200">
                        {after}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      {/* --- How it works ---------------------------------------------------- */}
      <section id="how" className="border-t border-white/10 py-24 lg:py-32">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-16">
            <div className="flex max-w-2xl flex-col gap-3">
              <Eyebrow>How it works</Eyebrow>
              <h2 className="text-4xl font-semibold leading-tight tracking-tighter text-white sm:text-5xl">
                Intelligence at every stage of the meeting lifecycle.
              </h2>
            </div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
              <Cell className="lg:col-span-2">
                <CellText
                  kicker="Pre-call"
                  title="Buyer alignment profiling."
                  body="Never walk into a meeting blind. Drop in a prospect's LinkedIn URL and the engine generates a behavioural playbook on the DISC framework — how they decide, what risk they fear, and how to structure the opening."
                />
                <Panel>
                  <div className="flex flex-col gap-3 p-5">
                    {[
                      ["Dominance", "Decides fast, resents detail"],
                      ["Risk posture", "Fears rollout failure, not price"],
                      ["Open with", "Outcome first, method second"],
                    ].map(([label, value]) => (
                      <div key={label} className="flex items-start gap-3">
                        <span className="w-28 shrink-0 font-mono text-xs uppercase tracking-widest text-zinc-600">
                          {label}
                        </span>
                        <span className="min-w-0 text-sm text-zinc-200">{value}</span>
                      </div>
                    ))}
                  </div>
                </Panel>
              </Cell>

              <Cell>
                <CellText
                  kicker="During the call"
                  title="Live deal navigation."
                  body="Sub-second edge infrastructure listens to the unsaid. Micro-shifts in vocal tone and pacing surface a buyer losing interest or masking an objection, and push an actionable pivot to the rep's screen."
                />
                <Panel>
                  <div className="flex flex-col gap-2 p-4">
                    <div className="flex items-center justify-between gap-3 rounded border border-amber-500/20 bg-amber-500/5 px-3 py-2.5">
                      <span className="text-xs font-semibold uppercase tracking-widest text-amber-400">
                        Masked objection
                      </span>
                      <span className="font-mono text-xs tabular-nums text-zinc-500">340 ms</span>
                    </div>
                    <div className="flex items-center justify-between gap-3 rounded border border-white/10 px-3 py-2.5">
                      <span className="text-xs font-semibold uppercase tracking-widest text-zinc-500">
                        Engagement drop
                      </span>
                      <span className="font-mono text-xs tabular-nums text-zinc-500">412 ms</span>
                    </div>
                  </div>
                </Panel>
              </Cell>

              <Cell>
                <CellText
                  kicker="Deal velocity"
                  title="Every signal, attached to the account."
                  body="Objections, commitments and engagement scores file themselves under the company they belong to, so a forecast review reads from evidence rather than from memory."
                />
                <Panel>
                  <div className="flex flex-col gap-3 p-5">
                    <p className="text-sm text-zinc-500">
                      What is actually blocking Cobalt?
                    </p>
                    <p className="border-t border-dashed border-white/10 pt-3 text-sm leading-relaxed text-zinc-300">
                      Rollout risk, twice. Raised on 12 August and hedged again on 22 August — never
                      price.
                    </p>
                    <p className="text-xs uppercase tracking-widest text-zinc-600">
                      2 calls · 1 unresolved
                    </p>
                  </div>
                </Panel>
              </Cell>

              <Cell className="lg:col-span-2">
                <CellText
                  kicker="Post-call"
                  title="Zero-friction CRM updates."
                  body="Your reps should be selling, not doing data entry. We bypass the dashboard entirely and push the intelligence, the field updates and the next steps straight into HubSpot or Salesforce."
                />
                <Panel>
                  <div className="flex flex-col gap-4 p-5">
                    <div className="flex flex-col gap-1">
                      <p className="text-sm font-medium text-white">
                        Cobalt Systems — stage moved to Negotiation
                      </p>
                      <p className="font-mono text-xs text-zinc-600">Salesforce · 2 fields updated</p>
                    </div>
                    <div className="flex flex-col gap-1 border-t border-dashed border-white/10 pt-3">
                      <p className="text-sm font-medium text-white">Next step logged</p>
                      <p className="font-mono text-xs text-zinc-600">
                        Security checkpoint · Thu 4 Sep
                      </p>
                    </div>
                    <span className="w-fit rounded bg-white px-4 py-2 text-sm font-medium text-zinc-950">
                      Pushed automatically
                    </span>
                  </div>
                </Panel>
              </Cell>
            </div>
          </div>
        </div>
      </section>

      {/* --- The proof ------------------------------------------------------- */}
      <div id="speed">
        <LatencyChart />
      </div>

      {/* --- Close ----------------------------------------------------------- */}
      <section id="beta" className="border-t border-white/10 py-24 lg:py-32">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto flex max-w-2xl flex-col items-center gap-6 text-center">
            <div className="flex flex-col gap-3">
              <Eyebrow>Private beta</Eyebrow>
              <h2 className="text-4xl font-semibold leading-tight tracking-tighter text-white sm:text-5xl">
                Give your reps an unfair advantage.
              </h2>
              <p className="text-base leading-relaxed text-zinc-400">
                We are opening the private beta to a small group of high-velocity B2B sales teams.
                If your team relies on post-call transcripts to fix in-call mistakes, it is time to
                upgrade the intelligence layer.
              </p>
            </div>
            <Cta>Apply for the private beta</Cta>
          </div>
        </div>
      </section>

      <footer className="border-t border-white/10 py-10">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <Wordmark />
          <p className="font-mono text-xs text-zinc-600">Copy test · not linked publicly</p>
        </div>
      </footer>
    </div>
  );
}
