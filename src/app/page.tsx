import type { ReactNode } from "react";

import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { redirect } from "next/navigation";

import { DemoForm } from "@/components/marketing/demo-form";
import { Wordmark } from "@/components/marketing/wordmark";
import { WaveField } from "@/components/originkit/ui/hero-31/wave-field";
import { maybeCurrentUser } from "@/lib/queries";

export const dynamic = "force-dynamic";

const AUTH_ERRORS: Record<string, string> = {
  state_mismatch: "That sign-in link expired. Try again.",
  missing_code: "Google didn't send back an authorisation code. Try again.",
  no_email: "We need access to your email address to identify your account.",
  access_denied: "Sign-in was cancelled.",
};

/**
 * The landing page.
 *
 * Every call to action asks for a demo rather than for calendar access. An
 * enterprise buyer will not hand a product they have never seen a scope that
 * reads their calendar and sends mail as them — the consent screen was the
 * wrong second step, and asking for it first cost the conversation. Signing in
 * stays available for people who already have an account.
 *
 * The previous version is kept at `/classic`.
 */
export const metadata = {
  title: "Context Window",
};

const NAV = [
  { label: "How it works", href: "#how" },
  { label: "Why it's different", href: "#moat" },
  { label: "Request a demo", href: "#demo" },
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

/** One phase. The numeral carries order the reader needs, not decoration. */
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

export default async function LandingPage({
  searchParams,
}: {
  searchParams: Promise<{ auth_error?: string; ref?: string }>;
}) {
  const user = await maybeCurrentUser();
  if (user) redirect("/meetings");

  const { auth_error: authError, ref } = await searchParams;
  const errorMessage = authError
    ? (AUTH_ERRORS[authError] ?? "Sign-in didn't complete. Try again.")
    : null;

  return (
    <div className="min-h-screen bg-zinc-950 text-white selection:bg-cyan-500/30">
      {/* --- Nav ------------------------------------------------------------ */}
      <header className="sticky top-0 z-50 border-b border-white/10 bg-zinc-950/70 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link href="/plain" className="transition-opacity hover:opacity-80" aria-label="Context Window">
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
              href="#demo"
              className="rounded bg-white px-4 py-2 text-sm font-medium text-zinc-950 transition-transform duration-150 ease-out active:scale-[0.97]"
            >
              Request a demo
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

        <div className="relative mx-auto w-full max-w-7xl px-4 pb-20 pt-10 sm:px-6 lg:px-8 lg:pb-24 lg:pt-14">
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
                  AI note-takers tell you why you lost.{" "}
                  <span className="text-zinc-500">We help you win.</span>
                </h1>
                <p className="max-w-2xl text-base leading-relaxed text-zinc-400">
                  Standard sales AI waits until the meeting ends to summarise what happened. Context
                  Window sits in the live meeting with your reps, instantly feeding them the exact
                  answers and coaching they need while the buyer is still speaking.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <Cta href="#demo">Request a demo</Cta>
                <Cta variant="ghost" href="#how">
                  See how it works
                </Cta>
              </div>

              {errorMessage && (
                <p className="w-fit rounded border border-red-500/20 bg-red-500/10 px-4 py-2 text-sm text-red-300">
                  {errorMessage}
                </p>
              )}
            </div>

            {/* The awkward moment the copy names, and what replaces it. */}
            <div className="rail-dark relative">
              <div className="relative pb-10">
                <span className="rail-stamp font-mono text-xs text-zinc-600">Before</span>
                <span className="rail-dot" aria-hidden />
                <p className="text-sm leading-relaxed text-zinc-400">
                  A three-line cheat sheet on the buyer.
                  <span className="text-zinc-300"> Decides slowly. Fears a bad rollout.</span>
                </p>
              </div>

              <div className="relative">
                <span className="rail-stamp font-mono text-xs text-emerald-400">Live</span>
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
                          The buyer just asked
                        </p>
                        <p className="text-base leading-snug text-white">
                          Our last vendor promised six weeks and took nine months. What is the
                          real number?
                        </p>
                      </div>

                      <div className="flex flex-col gap-3 rounded border border-amber-500/20 bg-amber-500/5 p-4">
                        <div className="flex items-center gap-3">
                          <span className="text-xs font-semibold uppercase tracking-widest text-amber-400">
                            Say this
                          </span>
                          <span className="ml-auto font-mono text-xs tabular-nums text-zinc-500">
                            0.8s
                          </span>
                        </div>
                        <p className="text-sm leading-relaxed text-zinc-300">
                          Three weeks for a team this size. And it runs in parallel — their
                          current system stays live until they choose to switch, so the date is
                          theirs, not ours.
                        </p>

                        <p className="flex flex-wrap items-center gap-2 border-t border-dashed border-amber-500/20 pt-3">
                          <span className="rounded border border-amber-500/30 px-1.5 py-px text-[9px] font-semibold uppercase tracking-[0.14em] text-amber-400/90">
                            From your docs
                          </span>
                          <span className="font-mono text-[10px] text-zinc-600">
                            Meridian rollout · 3 weeks · June
                          </span>
                        </p>
                      </div>

                      <div className="flex items-center gap-3 border-t border-dashed border-white/10 pt-4">
                        <span className="text-xs uppercase tracking-widest text-zinc-600">
                          What the rep didn&rsquo;t say
                        </span>
                        <span className="text-xs text-zinc-500">
                          &ldquo;Let me check and get back to you.&rdquo;
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="relative mt-10">
                <span className="rail-stamp font-mono text-xs text-zinc-600">After</span>
                <span className="rail-dot" aria-hidden />
                <p className="text-sm leading-relaxed text-zinc-400">
                  <span className="text-zinc-300">The CRM is already updated.</span> The follow-up
                  is written. The rep just clicks approve.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* --- The problem ----------------------------------------------------- */}
      <section className="border-t border-white/10 py-24 lg:py-32">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex max-w-4xl flex-col gap-10">
            <h2 className="text-4xl font-semibold leading-[1.05] tracking-tighter text-white sm:text-5xl lg:text-6xl">
              Transcripts don&rsquo;t close deals.
              <br />
              <span className="text-zinc-500">Live answers do.</span>
            </h2>

            <div className="flex max-w-2xl flex-col gap-5 text-base leading-relaxed text-zinc-400">
              <p>
                The biggest deal-killer in B2B sales is hesitation. A buyer asks a tough technical
                question, your rep doesn&rsquo;t know the answer, and they have to say,{" "}
                <span className="text-zinc-300">
                  &ldquo;great question, let me check with my team and get back to you.&rdquo;
                </span>
              </p>
              <p className="text-xl font-medium tracking-tight text-white">Momentum dies.</p>
              <p className="border-l border-white/10 pl-5 text-zinc-300">
                We fix that. We don&rsquo;t just record your calls — we connect your company&rsquo;s
                knowledge directly to your rep&rsquo;s screen during the live meeting.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* --- Three phases ----------------------------------------------------- */}
      <section id="how" className="border-t border-white/10 py-24 lg:py-32">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-16">
            <div className="flex max-w-2xl flex-col gap-3">
              <Eyebrow>How it works</Eyebrow>
              <h2 className="text-4xl font-semibold leading-tight tracking-tighter text-white sm:text-5xl">
                Three phases. One meeting.
              </h2>
            </div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
              <Phase
                index="01"
                kicker="Pre-call · instant prep"
                claim="Know exactly who you are talking to."
                body="Drop in a LinkedIn URL before the meeting. In four seconds your rep gets a three-bullet cheat sheet: how the buyer makes decisions, what risks they fear, and how to open the pitch."
              >
                <div className="flex flex-col gap-3 p-5">
                  {[
                    ["Decides", "Wants a business case, not a demo"],
                    ["Fears", "Being blamed if it fails"],
                    ["Open with", "A result, not a feature"],
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
                kicker="Live meeting · the whisper"
                claim="Never get stumped by a hard question again."
                body="While the buyer is speaking, Context Window listens. A difficult question triggers a search of your past winning calls, product docs and support tickets, and the answer lands on your rep's screen before the buyer finishes the sentence."
              >
                <div className="flex flex-col gap-2 p-4">
                  <p className="pb-1 text-sm leading-relaxed text-zinc-400">
                    &ldquo;Does this replace Salesforce, or sit on top of it?&rdquo;
                  </p>
                  <div className="flex flex-col gap-2 rounded border border-amber-500/20 bg-amber-500/5 px-3 py-2.5">
                    <span className="text-xs font-semibold uppercase tracking-widest text-amber-400">
                      Say this
                    </span>
                    <span className="text-sm leading-relaxed text-zinc-300">
                      On top. Nothing gets ripped out — it writes into the fields your team
                      already uses.
                    </span>
                  </div>
                </div>
              </Phase>

              <Phase
                index="03"
                kicker="Post-call · zero admin"
                claim="Selling, not data entry."
                body="The second the meeting ends, Context Window updates Salesforce, builds a pricing proposal from what was actually discussed, and drafts the follow-up email. Your rep clicks approve and moves to the next deal."
              >
                <div className="flex flex-col gap-3 p-5">
                  {[
                    ["Stage", "Discovery → Evaluation"],
                    ["Next step", "Security review · Thu"],
                    ["Follow-up", "Drafted · needs approval"],
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

      {/* --- Why it's different ----------------------------------------------- */}
      <section id="moat" className="border-t border-white/10 py-24 lg:py-32">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-12">
            <div className="flex max-w-3xl flex-col gap-4">
              <Eyebrow>Why it&rsquo;s different</Eyebrow>
              <h2 className="text-4xl font-semibold leading-tight tracking-tighter text-white sm:text-5xl">
                The smartest teammate in the room.
              </h2>
              <p className="max-w-2xl text-base leading-relaxed text-zinc-400">
                We don&rsquo;t just plug a transcript into ChatGPT. Context Window acts as your
                company&rsquo;s active brain. We securely connect to the tools your team already
                uses — Slack, Jira, Zendesk and your product wiki — so your sales team has the right
                answer exactly when it matters.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-px overflow-hidden rounded border border-white/10 bg-white/10 sm:grid-cols-3">
              {[
                ["Reads your tools", "Slack, Jira, Zendesk and your product wiki — not just the call."],
                ["Answers in under a second", "Fast enough to use mid-sentence, not after the meeting."],
                ["Shows its source", "Every answer names where it came from, so the rep can trust it."],
              ].map(([title, body]) => (
                <div key={title} className="flex flex-col gap-2 bg-zinc-950 p-6">
                  <p className="text-sm font-medium text-white">{title}</p>
                  <p className="text-sm leading-relaxed text-zinc-500">{body}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* --- Request a demo ------------------------------------------------------ */}
      <section id="demo" className="border-t border-white/10 py-24 lg:py-32">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto grid max-w-5xl gap-12 lg:grid-cols-[1fr_1.1fr] lg:gap-16">
            <div className="flex flex-col gap-4">
              <Eyebrow>Request a demo</Eyebrow>
              <h2 className="text-4xl font-semibold leading-tight tracking-tighter text-white sm:text-5xl">
                See it on one of your own calls.
              </h2>
              <p className="text-base leading-relaxed text-zinc-400">
                We onboard a small number of teams each month, because each one gets our engineers
                in the room for setup — connecting your docs, your tickets and your past calls so
                the answers are actually yours.
              </p>
              <p className="text-base leading-relaxed text-zinc-400">
                Tell us where deals are stalling and we will show you the moment it would have
                helped.
              </p>
            </div>

            <div className="rounded border border-white/10 bg-zinc-900/50 p-6 sm:p-8">
              <DemoForm source={ref} />
            </div>
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
