import type { ReactNode } from "react";

import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { Wordmark } from "@/components/marketing/wordmark";
import { WaveField } from "@/components/originkit/ui/hero-31/wave-field";

export const dynamic = "force-dynamic";

/**
 * The "interceptor" positioning, on the existing page.
 *
 * Third copy test. Same components and spacing as `/` and `/alt`, so the only
 * variable is still the words.
 *
 * The phase numbering here is not decoration: the copy is explicitly a sequence
 * — before, during, after one meeting — so the numerals carry order the reader
 * needs. On a page where the three blocks were parallel rather than sequential
 * they would be noise.
 *
 * Not linked and noindex: it claims capabilities the product does not have.
 */
export const metadata = {
  title: "Context Window — intercept",
  robots: { index: false, follow: false },
};

const NAV = [
  { label: "Execution layer", href: "#layer" },
  { label: "Architecture", href: "#moat" },
  { label: "Access", href: "#access" },
];

function Cta({
  children,
  variant = "solid",
  href = "#access",
}: {
  children: ReactNode;
  variant?: "solid" | "ghost";
  href?: string;
}) {
  if (variant === "ghost") {
    return (
      <a
        href={href}
        className="inline-flex items-center gap-2 rounded border border-white/10 px-5 py-3 text-sm font-medium text-zinc-300 transition-[transform,border-color] duration-150 ease-out hover:border-white/20 active:scale-[0.97]"
      >
        {children}
      </a>
    );
  }
  return (
    <a
      href={href}
      className="group inline-flex items-center gap-2 rounded bg-white px-5 py-3 text-sm font-medium text-zinc-950 transition-transform duration-150 ease-out active:scale-[0.97]"
    >
      {children}
      <ArrowRight className="size-4 transition-transform duration-150 ease-out group-hover:translate-x-0.5" />
    </a>
  );
}

function Eyebrow({ children }: { children: string }) {
  return (
    <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500">{children}</p>
  );
}

/** One phase of the execution layer. The numeral is the ordering, not a bullet. */
function Phase({
  index,
  kicker,
  claim,
  body,
  children,
}: {
  index: string;
  kicker: string;
  claim: string;
  body: string;
  children: ReactNode;
}) {
  return (
    <article className="flex flex-col justify-between gap-8 rounded border border-white/10 bg-zinc-900/50 p-8 transition-colors duration-150 ease-out hover:border-white/20">
      <div className="flex flex-col gap-3">
        <div className="flex items-baseline gap-3">
          <span className="font-mono text-xs tabular-nums text-amber-400">{index}</span>
          <Eyebrow>{kicker}</Eyebrow>
        </div>
        <h3 className="text-xl font-medium leading-tight tracking-tight text-white">{claim}</h3>
        <p className="text-sm leading-relaxed text-zinc-400">{body}</p>
      </div>
      <div className="overflow-hidden rounded border border-white/10 bg-zinc-950">{children}</div>
    </article>
  );
}

export default function EdgeLandingPage() {
  return (
    <div className="min-h-screen bg-zinc-950 text-white selection:bg-cyan-500/30">
      {/* --- Nav ------------------------------------------------------------ */}
      <header className="sticky top-0 z-50 border-b border-white/10 bg-zinc-950/70 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link href="/edge" className="transition-opacity hover:opacity-80" aria-label="Context Window">
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
              className="hidden rounded px-3 py-2 text-sm text-zinc-400 transition-colors hover:text-white sm:block"
            >
              Sign in
            </Link>
            <a
              href="#access"
              className="rounded bg-white px-4 py-2 text-sm font-medium text-zinc-950 transition-transform duration-150 ease-out active:scale-[0.97]"
            >
              Request access
            </a>
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
                <span className="text-xs text-zinc-400">
                  The end of the &ldquo;I&rsquo;ll get back to you&rdquo; era
                </span>
              </div>

              <div className="flex flex-col gap-4">
                <h1 className="text-5xl font-semibold leading-none tracking-tighter text-white sm:text-6xl lg:text-7xl">
                  AI note-takers record your lost deals.{" "}
                  <span className="text-zinc-500">We intercept them.</span>
                </h1>
                <p className="max-w-2xl text-base leading-relaxed text-zinc-400">
                  Gong and Fireflies wait until the meeting ends to tell your manager why you lost.
                  Context Window operates at the edge — processing live audio, behavioural cues and
                  your company&rsquo;s entire technical graph in 800ms — to feed your reps the
                  winning pivot while the mic is still hot.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <Cta>Arm your sales team</Cta>
                <Cta variant="ghost" href="#moat">
                  View the edge architecture
                </Cta>
              </div>
            </div>

            {/* The interception itself: the buyer's question, and the answer
                arriving from the engineering graph before they finish it. */}
            <div className="rail-dark relative">
              <div className="relative pb-10">
                <span className="rail-stamp font-mono text-xs text-zinc-600">− 4 s</span>
                <span className="rail-dot" aria-hidden />
                <p className="text-sm leading-relaxed text-zinc-400">
                  Behavioural blueprint synthesised.
                  <span className="text-zinc-300"> Risk-averse. Opens on proof, not vision.</span>
                </p>
              </div>

              <div className="relative">
                <span className="rail-stamp font-mono text-xs text-emerald-400">LIVE</span>
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
                          Intercepting
                        </span>
                      </span>
                    </div>

                    <div className="flex flex-col gap-6 p-6">
                      <div className="flex flex-col gap-2">
                        <p className="text-xs uppercase tracking-widest text-zinc-600">
                          Buyer · technical
                        </p>
                        <p className="text-base leading-snug text-white">
                          Does your ingestion handle out-of-order events, or do we need to dedupe
                          upstream?
                        </p>
                      </div>

                      <div className="flex flex-col gap-3 rounded border border-amber-500/20 bg-amber-500/5 p-4">
                        <div className="flex items-center gap-3">
                          <span className="text-xs font-semibold uppercase tracking-widest text-amber-400">
                            Answer ready
                          </span>
                          <span className="ml-auto font-mono text-xs tabular-nums text-zinc-500">
                            780 ms
                          </span>
                        </div>
                        <p className="text-sm leading-relaxed text-zinc-300">
                          Idempotent by event key since v2.4. Out-of-order is handled at the sink,
                          no upstream dedupe required.
                        </p>

                        <p className="flex flex-wrap items-center gap-2 border-t border-dashed border-amber-500/20 pt-3">
                          <span className="rounded border border-amber-500/30 px-1.5 py-px text-[9px] font-semibold uppercase tracking-[0.14em] text-amber-400/90">
                            From the graph
                          </span>
                          <span className="font-mono text-[10px] text-zinc-600">
                            commit 4f21a9c · ticket #8812
                          </span>
                        </p>
                      </div>

                      <div className="flex items-center gap-3 border-t border-dashed border-white/10 pt-4">
                        <span className="text-xs uppercase tracking-widest text-zinc-600">
                          Rep said
                        </span>
                        <span className="text-xs text-zinc-500">
                          nothing yet — answer landed first
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="relative mt-10">
                <span className="rail-stamp font-mono text-xs text-zinc-600">+ 0 s</span>
                <span className="rail-dot" aria-hidden />
                <p className="text-sm leading-relaxed text-zinc-400">
                  <span className="text-zinc-300">Agents execute on call end.</span> CRM written,
                  proposal generated, follow-up drafted.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* --- Manifesto ------------------------------------------------------- */}
      <section className="border-t border-white/10 py-24 lg:py-32">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex max-w-4xl flex-col gap-10">
            <h2 className="text-4xl font-semibold leading-[1.05] tracking-tighter text-white sm:text-5xl lg:text-6xl">
              Transcripts don&rsquo;t close deals.
              <br />
              <span className="text-zinc-500">Real-time omniscience does.</span>
            </h2>

            <div className="flex max-w-2xl flex-col gap-5 text-base leading-relaxed text-zinc-400">
              <p>
                The modern B2B sales process is broken. Your account executives go into live
                firefights armed with nothing but a slide deck. When a technical buyer asks a hard
                question, momentum dies the second your rep says,{" "}
                <span className="text-zinc-300">
                  &ldquo;great question, let me check with engineering and get back to you.&rdquo;
                </span>
              </p>
              <p className="border-l border-white/10 pl-5 text-zinc-300">
                We don&rsquo;t build dashboards. We don&rsquo;t do post-call summaries. We built an
                active organisational reasoning engine that sits in the room with you.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* --- The execution layer --------------------------------------------- */}
      <section id="layer" className="border-t border-white/10 py-24 lg:py-32">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-16">
            <div className="flex max-w-2xl flex-col gap-3">
              <Eyebrow>The execution layer</Eyebrow>
              <h2 className="text-4xl font-semibold leading-tight tracking-tighter text-white sm:text-5xl">
                Three phases. One meeting.
              </h2>
            </div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
              <Phase
                index="01"
                kicker="Pre-call"
                claim="We know them before they join the waiting room."
                body="Drop in a LinkedIn URL. In four seconds the engine bypasses standard data brokers, synthesises their digital footprint and generates a behavioural blueprint — decision framework, risk tolerance, and the angle to open on."
              >
                <div className="flex flex-col gap-3 p-5">
                  {[
                    ["Framework", "Consensus-driven, needs proof"],
                    ["Risk", "Rollout failure, not spend"],
                    ["Open on", "A reference, not a roadmap"],
                  ].map(([label, value]) => (
                    <div key={label} className="flex items-start gap-3">
                      <span className="w-24 shrink-0 font-mono text-xs uppercase tracking-widest text-zinc-600">
                        {label}
                      </span>
                      <span className="min-w-0 text-sm text-zinc-200">{value}</span>
                    </div>
                  ))}
                </div>
              </Phase>

              <Phase
                index="02"
                kicker="Live meeting"
                claim="Don't wait for the transcript. Hack the live call."
                body="As the buyer speaks, edge-streaming infrastructure listens. A hyper-specific technical question triggers a search across your GitHub commits, Zendesk tickets and roadmap, and projects the answer before the sentence finishes."
              >
                <div className="flex flex-col gap-2 p-4">
                  <div className="flex items-center justify-between gap-3 rounded border border-amber-500/20 bg-amber-500/5 px-3 py-2.5">
                    <span className="text-xs font-semibold uppercase tracking-widest text-amber-400">
                      Graph hit
                    </span>
                    <span className="font-mono text-xs tabular-nums text-zinc-500">780 ms</span>
                  </div>
                  <div className="flex items-center justify-between gap-3 rounded border border-white/10 px-3 py-2.5">
                    <span className="text-xs font-semibold uppercase tracking-widest text-zinc-500">
                      Behavioural shift
                    </span>
                    <span className="font-mono text-xs tabular-nums text-zinc-500">340 ms</span>
                  </div>
                </div>
              </Phase>

              <Phase
                index="03"
                kicker="Post-call"
                claim="We don't draft summaries. We execute workflows."
                body="Summaries are for spectators. Terminal agents push the CRM updates, generate a pricing proposal from the live context of the call, and draft the follow-up. Your rep clicks approve and moves to the next deal."
              >
                <div className="flex flex-col gap-3 p-5">
                  {[
                    ["Salesforce", "stage → Negotiation"],
                    ["Proposal", "generated · 120 seats"],
                    ["Follow-up", "drafted · awaiting approve"],
                  ].map(([label, value]) => (
                    <div key={label} className="flex items-start gap-3">
                      <span className="w-24 shrink-0 font-mono text-xs uppercase tracking-widest text-zinc-600">
                        {label}
                      </span>
                      <span className="min-w-0 text-sm text-zinc-200">{value}</span>
                    </div>
                  ))}
                </div>
              </Phase>
            </div>
          </div>
        </div>
      </section>

      {/* --- The moat --------------------------------------------------------- */}
      <section id="moat" className="border-t border-white/10 py-24 lg:py-32">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-12">
            <div className="flex max-w-3xl flex-col gap-4">
              <Eyebrow>The moat</Eyebrow>
              <h2 className="text-4xl font-semibold leading-tight tracking-tighter text-white sm:text-5xl">
                Built on heavy compute. Not API wrappers.
              </h2>
              <p className="max-w-2xl text-base leading-relaxed text-zinc-400">
                Most sales AI is a ChatGPT wrapper strapped to a transcription API. Context Window
                is an enterprise context brain: custom vision-language models, deep multi-agent
                orchestration and edge-RAG, processing engineering context and behavioural signals
                at zero latency.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-px overflow-hidden rounded border border-white/10 bg-white/10 sm:grid-cols-3">
              {[
                ["Edge-RAG", "Hybrid dense and lexical retrieval, fused by rank, served from the edge."],
                ["Multi-agent", "Research, live answer and execution agents, orchestrated per call."],
                ["Sub-second", "800ms from spoken question to projected answer."],
              ].map(([title, body]) => (
                <div key={title} className="flex flex-col gap-2 bg-zinc-950 p-6">
                  <p className="text-sm font-medium text-white">{title}</p>
                  <p className="text-sm leading-relaxed text-zinc-500">{body}</p>
                </div>
              ))}
            </div>

            <p className="text-2xl font-medium leading-tight tracking-tight text-zinc-200 sm:text-3xl">
              This isn&rsquo;t an app. It&rsquo;s an unfair advantage.
            </p>
          </div>
        </div>
      </section>

      {/* --- Access ----------------------------------------------------------- */}
      <section id="access" className="border-t border-white/10 py-24 lg:py-32">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto flex max-w-2xl flex-col items-center gap-6 text-center">
            <div className="flex flex-col gap-3">
              <Eyebrow>Restricted access</Eyebrow>
              <h2 className="text-4xl font-semibold leading-tight tracking-tighter text-white sm:text-5xl">
                Compute is limited. Access is restricted.
              </h2>
              <p className="text-base leading-relaxed text-zinc-400">
                The sub-second processing required to run live-meeting intelligence means we cannot
                offer open signups. We are onboarding exactly five new enterprise revenue teams this
                month.
              </p>
              <p className="text-base leading-relaxed text-zinc-300">
                If your team is ready to stop taking notes and start dominating live negotiations,
                submit your architecture for review.
              </p>
            </div>
            <Cta href="/api/auth/google/start">Request enterprise access</Cta>
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
