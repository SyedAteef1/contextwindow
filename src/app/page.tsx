import type { ReactNode } from "react";

import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, Check } from "lucide-react";

import { LatencyChart } from "@/components/marketing/latency-chart";
import { Mark, Wordmark } from "@/components/marketing/wordmark";
import { Pricing } from "@/components/marketing/pricing";
import { WaveField } from "@/components/originkit/ui/hero-31/wave-field";
import { maybeCurrentUser } from "@/lib/queries";

export const dynamic = "force-dynamic";

const AUTH_ERRORS: Record<string, string> = {
  state_mismatch: "That sign-in link expired. Try again.",
  missing_code: "Google didn't send back an authorisation code. Try again.",
  no_email: "We need access to your email address to identify your account.",
  access_denied: "Sign-in was cancelled.",
};

const NAV = [
  { label: "How it works", href: "#how" },
  { label: "Speed", href: "#speed" },
  { label: "Pricing", href: "#pricing" },
];

/** Primary action. Scales on press, so it answers a finger as well as a cursor. */
function Connect({ children = "Connect your calendar" }: { children?: string }) {
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

/**
 * One bento cell.
 *
 * Text on top, a framed piece of the real interface underneath — the same
 * arrangement as the hero, repeated at cell scale. `justify-between` lets cells
 * of different heights sit in one row with their panels aligned to the bottom
 * rather than floating at whatever height their copy ended.
 */
function Cell({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <article
      className={`flex flex-col justify-between gap-8 rounded border border-white/10 bg-zinc-900/50 p-8 transition-colors duration-150 ease-out hover:border-white/20 ${className}`}
    >
      {children}
    </article>
  );
}

function CellText({
  kicker,
  title,
  body,
}: {
  kicker: string;
  title: string;
  body: string;
}) {
  return (
    <div className="flex flex-col gap-3">
      <Eyebrow>{kicker}</Eyebrow>
      <h3 className="text-xl font-medium leading-tight tracking-tight text-white">{title}</h3>
      <p className="text-sm leading-relaxed text-zinc-400">{body}</p>
    </div>
  );
}

/** The inset frame a piece of product UI sits in, inside a cell. */
function Panel({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-hidden rounded border border-white/10 bg-zinc-950">{children}</div>
  );
}

/**
 * The landing page.
 *
 * Dark throughout, on zinc rather than a flat grey, with depth carried by 1px
 * borders and radial light instead of shadow — a drop shadow on a near-black
 * ground is invisible, so light is the only thing left to build with.
 *
 * The WebGL dot field from hero-31 survives, but as texture at 15% over near
 * black. At full strength it was the loudest thing on the page and nothing set
 * over it could win.
 */
export default async function LandingPage({
  searchParams,
}: {
  searchParams: Promise<{ auth_error?: string }>;
}) {
  const user = await maybeCurrentUser();
  if (user) redirect("/meetings");

  const { auth_error: authError } = await searchParams;
  const errorMessage = authError
    ? (AUTH_ERRORS[authError] ?? "Sign-in didn't complete. Try again.")
    : null;

  return (
    <div className="min-h-screen bg-zinc-950 text-white selection:bg-cyan-500/30">
      {/* --- Nav: part of the hero, not a slab on top of it ----------------- */}
      <header className="sticky top-0 z-50 border-b border-white/10 bg-zinc-950/70 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link
            href="/"
            className="transition-opacity duration-150 ease-out hover:opacity-80"
            aria-label="Context Window home"
          >
            <Wordmark />
          </Link>

          {/* Centred on wide screens so the bar reads as three balanced parts
              rather than a wordmark with everything else crowded right. */}
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
              href="/api/auth/google/start"
              className="rounded bg-white px-4 py-2 text-sm font-medium text-zinc-950 transition-transform duration-150 ease-out active:scale-[0.97]"
            >
              Connect calendar
            </Link>
          </div>
        </div>
      </header>

      {/* --- Hero ----------------------------------------------------------- */}
      <section className="relative isolate overflow-hidden">
        {/* Texture first, then light. Neither is content; both are aria-hidden. */}
        <div aria-hidden className="absolute inset-0 opacity-[0.15]">
          <WaveField bgColor="#09090b" color="#2563eb" />
        </div>
        <div
          aria-hidden
          className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-b from-transparent to-zinc-950"
        />

        <div className="relative mx-auto w-full max-w-7xl px-4 py-20 sm:px-6 lg:px-8 lg:py-28">
          <div className="grid items-center gap-16 lg:grid-cols-2 lg:gap-20">
            {/* Left: one column read top to bottom, CTA where the eye lands. */}
            <div className="flex flex-col gap-6">
              <div className="inline-flex w-fit items-center gap-2 rounded border border-white/10 bg-white/5 px-3 py-1">
                <span className="size-1.5 rounded-full bg-emerald-400" />
                <span className="text-xs text-zinc-400">Answers in ~400ms, mid-call</span>
              </div>

              <div className="flex flex-col gap-4">
                <h1 className="text-5xl font-semibold leading-none tracking-tighter text-white sm:text-6xl lg:text-7xl xl:text-8xl">
                  Never take a sales call cold.
                </h1>
                <p className="max-w-2xl text-base leading-relaxed text-zinc-400">
                  Connect your calendar. Every external call is researched before it happens,
                  answered while it runs, and written up the moment it ends — with every claim
                  linked to where it came from.
                </p>
              </div>

              <div className="flex flex-col gap-3">
                <div className="flex flex-wrap items-center gap-3">
                  <Connect />
                  <a
                    href="#how"
                    className="inline-flex items-center gap-2 rounded border border-white/10 px-5 py-3 text-sm font-medium text-zinc-300 transition-[transform,border-color] duration-150 ease-out hover:border-white/20 active:scale-[0.97]"
                  >
                    See how it works
                  </a>
                </div>
                <p className="text-sm text-zinc-500">
                  Five meetings free every month. No card required.
                </p>
              </div>

              {errorMessage && (
                <p className="w-fit rounded border border-red-500/20 bg-red-500/10 px-4 py-2 text-sm text-red-300">
                  {errorMessage}
                </p>
              )}
            </div>

            {/* Right: the product, pinned to the timeline it belongs to. The
                rail is the one motif here that could not have been drawn for
                any other product — this one is entirely about time around a
                single meeting. */}
            <div className="rail-dark relative">
              <div className="relative pb-10">
                <span className="rail-stamp font-mono text-xs text-zinc-600">− 1 day</span>
                <span className="rail-dot" aria-hidden />
                <p className="text-sm leading-relaxed text-zinc-400">
                  The brief pulls in every call you have had with Cobalt.
                  <span className="text-zinc-300"> Three open promises, one still unresolved.</span>
                </p>
              </div>

              <div className="relative">
                <span className="rail-stamp font-mono text-xs text-emerald-400">00:00</span>
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
                        Last time you said you would check whether SSO was in scope. Where did
                        that land?
                      </p>
                    </div>

                    <div className="flex flex-col gap-3 rounded border border-amber-500/20 bg-amber-500/5 p-4">
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-semibold uppercase tracking-widest text-amber-400">
                          Ready before the call
                        </span>
                        <span className="ml-auto font-mono text-xs tabular-nums text-zinc-500">
                          4 ms
                        </span>
                      </div>
                      <p className="text-sm leading-relaxed text-zinc-300">
                        On 12 August you said SSO ships in Q4 and is included at their tier.
                        Nothing has changed since.
                      </p>

                      {/* Provenance, not just latency. An answer a rep is about
                          to say out loud has to show where it came from — this
                          one is recall, and the call it was recalled from is
                          named. */}
                      <p className="flex flex-wrap items-center gap-2 border-t border-dashed border-amber-500/20 pt-3">
                        <span className="rounded border border-amber-500/30 px-1.5 py-px text-[9px] font-semibold uppercase tracking-[0.14em] text-amber-400/90">
                          From memory
                        </span>
                        <span className="font-mono text-[10px] text-zinc-600">
                          Platform evaluation · 12 Aug
                        </span>
                      </p>
                    </div>

                    <div className="flex items-center gap-3 border-t border-dashed border-white/10 pt-4">
                      <span className="text-xs uppercase tracking-widest text-zinc-600">
                        Interest
                      </span>
                      <span className="flex gap-1">
                        {[true, true, true, false].map((on, index) => (
                          <span
                            key={index}
                            className={`h-3 w-1 rounded-[2px] ${on ? "bg-amber-400" : "bg-zinc-800"}`}
                          />
                        ))}
                      </span>
                      <span className="text-xs text-zinc-500">medium · 1 objection</span>
                    </div>
                  </div>
                </div>
                </div>
              </div>

              <div className="relative mt-10">
                <span className="rail-stamp font-mono text-xs text-zinc-600">+ 2 min</span>
                <span className="rail-dot" aria-hidden />
                <p className="text-sm leading-relaxed text-zinc-400">
                  <span className="text-zinc-300">The recap restates it in writing</span>, so it
                  stops being something either side has to remember.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* --- The old way ---------------------------------------------------- */}
      <section className="border-t border-white/10 py-20 lg:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto flex max-w-2xl flex-col gap-3 text-center">
            <Eyebrow>The old way</Eyebrow>
            <p className="text-2xl font-medium leading-tight tracking-tight text-zinc-200 sm:text-3xl">
              You block half an hour to skim their site and dig through an old thread for what you
              promised. Then the call ends, and the follow-up sits unwritten until Thursday.
            </p>
          </div>
        </div>
      </section>

      {/* --- Features: a bento, every cell showing the product ------------ */}
      <section id="how" className="border-t border-white/10 py-24 lg:py-32">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-16">
            <div className="flex max-w-2xl flex-col gap-3">
              <Eyebrow>How it works</Eyebrow>
              <h2 className="text-4xl font-semibold leading-tight tracking-tighter text-white sm:text-5xl">
                Before, during, and after every call.
              </h2>
            </div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
              {/* Wide: the brief, with its sources showing. */}
              <Cell className="lg:col-span-2">
                <CellText
                  kicker="Before the call"
                  title="Research starts the moment it is booked."
                  body="Not the morning of — when it lands on your calendar. Every line links to its source, and what we could not verify is marked as unverified rather than filled in."
                />
                <Panel>
                  <div className="flex flex-col gap-3 p-5">
                    {[
                      ["Raised a Series B in January", "techcrunch.com"],
                      ["Migration blocked until October", "Call · 12 Aug"],
                      ["Head of Security joined in May", "linkedin.com"],
                    ].map(([claim, source], index) => (
                      <div key={claim} className="flex items-start gap-3">
                        <span className="mt-0.5 font-mono text-xs tabular-nums text-zinc-600">
                          {index + 1}
                        </span>
                        <span className="flex min-w-0 flex-col gap-0.5">
                          <span className="truncate text-sm text-zinc-200">{claim}</span>
                          <span className="font-mono text-xs text-zinc-600">{source}</span>
                        </span>
                      </div>
                    ))}
                  </div>
                </Panel>
              </Cell>

              {/* Narrow: the two answer paths, side by side. */}
              <Cell>
                <CellText
                  kicker="During the call"
                  title="Answers land while the question is in the air."
                  body="Likely questions are answered the day before, so a match returns in milliseconds. Anything unanticipated is written live and labelled."
                />
                <Panel>
                  <div className="flex flex-col gap-2 p-4">
                    <div className="flex items-center justify-between gap-3 rounded border border-amber-500/20 bg-amber-500/5 px-3 py-2.5">
                      <span className="text-xs font-semibold uppercase tracking-widest text-amber-400">
                        Ready before
                      </span>
                      <span className="font-mono text-xs tabular-nums text-zinc-500">5 ms</span>
                    </div>
                    <div className="flex items-center justify-between gap-3 rounded border border-white/10 px-3 py-2.5">
                      <span className="text-xs font-semibold uppercase tracking-widest text-zinc-500">
                        Generated live
                      </span>
                      <span className="font-mono text-xs tabular-nums text-zinc-500">412 ms</span>
                    </div>
                  </div>
                </Panel>
              </Cell>

              {/* Narrow: the account answering a question about itself. */}
              <Cell>
                <CellText
                  kicker="Account memory"
                  title="Ask an account what it told you six weeks ago."
                  body="Briefs, transcripts and signals file themselves under the company they belong to. Answers come from that account's own calls."
                />
                <Panel>
                  <div className="flex flex-col gap-3 p-5">
                    <p className="text-sm text-zinc-500">
                      What did they say about the migration?
                    </p>
                    <p className="border-t border-dashed border-white/10 pt-3 text-sm leading-relaxed text-zinc-300">
                      On 12 August, Dana said it cannot start before their fiscal year closes in
                      October.
                    </p>
                    <p className="text-xs uppercase tracking-widest text-zinc-600">
                      Platform evaluation · 12 Aug
                    </p>
                  </div>
                </Panel>
              </Cell>

              {/* Wide: the one click that ends the call. */}
              <Cell className="lg:col-span-2">
                <CellText
                  kicker="After the call"
                  title="The recap and the next meeting, already written."
                  body="Minutes, next steps and a follow-up invite are drafted two minutes after the call ends. Read them, change what you want, send both with one press."
                />
                <Panel>
                  <div className="flex flex-col gap-4 p-5">
                    <div className="flex flex-col gap-1">
                      <p className="text-sm font-medium text-white">
                        Cobalt Systems — SOC 2 and next steps
                      </p>
                      <p className="font-mono text-xs text-zinc-600">to dana@cobalt.io</p>
                    </div>
                    <div className="flex flex-col gap-1 border-t border-dashed border-white/10 pt-3">
                      <p className="text-sm font-medium text-white">Security review checkpoint</p>
                      <p className="font-mono text-xs text-zinc-600">Thu 4 Sep · 30 min</p>
                    </div>
                    <span className="w-fit rounded bg-white px-4 py-2 text-sm font-medium text-zinc-950">
                      Send recap and book follow-up
                    </span>
                  </div>
                </Panel>
              </Cell>
            </div>
          </div>
        </div>
      </section>

      {/* --- The proof ------------------------------------------------------ */}
      <div id="speed">
        <LatencyChart />
      </div>

      {/* --- Objection ------------------------------------------------------ */}
      <section className="border-t border-white/10 py-24 lg:py-32">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto flex max-w-2xl flex-col gap-3 text-center">
            <Eyebrow>Nothing sends itself</Eyebrow>
            <h2 className="text-3xl font-semibold leading-tight tracking-tighter text-white sm:text-4xl">
              Nothing reaches a customer until you press send.
            </h2>
            <p className="text-base leading-relaxed text-zinc-400">
              The recap and the invite sit as drafts you can rewrite, and the email goes from your
              own address — so replies come back to you, not to a tool.
            </p>
          </div>
        </div>
      </section>

      {/* --- Pricing -------------------------------------------------------- */}
      <div id="pricing">
        <Pricing />
      </div>

      {/* --- Close ---------------------------------------------------------- */}
      <section className="relative isolate overflow-hidden border-t border-white/10 py-24 lg:py-32">
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto flex max-w-2xl flex-col items-center gap-6 text-center">
            <h2 className="text-4xl font-semibold leading-none tracking-tighter text-white sm:text-5xl">
              Your next call is already on the calendar.
            </h2>
            <p className="max-w-xl text-base leading-relaxed text-zinc-400">
              Connect it, and the next external meeting on it gets a brief.
            </p>
            <div className="flex flex-col items-center gap-3">
              <Connect />
              <p className="text-sm text-zinc-500">
                Five meetings free every month. No card required.
              </p>
            </div>
            <ul className="mt-4 flex flex-wrap justify-center gap-x-6 gap-y-2">
              {["Cited research", "Nothing sends itself", "Your own mailbox"].map((item) => (
                <li key={item} className="flex items-center gap-2 text-sm text-zinc-500">
                  <Check className="size-3.5 text-zinc-600" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/*
        Footer.

        Every link here points at something that exists — the three section
        anchors and the sign-in route. Privacy and Terms are deliberately absent
        rather than stubbed: Google's OAuth verification requires a reachable
        privacy policy, and a link to a 404 fails that review while also being
        the kind of thing a careful buyer checks.
      */}
      <footer className="border-t border-white/10 bg-zinc-950">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-12 py-16 lg:flex-row lg:justify-between">
            <div className="flex max-w-sm flex-col gap-4">
              <Wordmark />
              <p className="text-sm leading-relaxed text-zinc-400">
                Research before the call, answers during it, and a written record after — every
                claim traceable to where it came from.
              </p>
              <a
                href="https://contextwindowhq.com"
                className="w-fit font-mono text-xs text-zinc-600 transition-colors duration-150 ease-out hover:text-zinc-400"
              >
                contextwindowhq.com
              </a>
            </div>

            <div className="grid grid-cols-2 gap-12 sm:gap-16">
              <div className="flex flex-col gap-4">
                <p className="text-xs font-semibold uppercase tracking-widest text-zinc-600">
                  Product
                </p>
                <ul className="flex flex-col gap-3">
                  {NAV.map((item) => (
                    <li key={item.href}>
                      <a
                        href={item.href}
                        className="text-sm text-zinc-400 transition-colors duration-150 ease-out hover:text-white"
                      >
                        {item.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="flex flex-col gap-4">
                <p className="text-xs font-semibold uppercase tracking-widest text-zinc-600">
                  Get started
                </p>
                <ul className="flex flex-col gap-3">
                  <li>
                    <Link
                      href="/api/auth/google/start"
                      className="text-sm text-zinc-400 transition-colors duration-150 ease-out hover:text-white"
                    >
                      Connect your calendar
                    </Link>
                  </li>
                  <li>
                    <Link
                      href="/api/auth/google/start"
                      className="text-sm text-zinc-400 transition-colors duration-150 ease-out hover:text-white"
                    >
                      Sign in
                    </Link>
                  </li>
                  <li>
                    <span className="text-sm text-zinc-600">Five meetings free</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-4 border-t border-white/10 py-8 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-zinc-600">
              © {new Date().getFullYear()} Context Window. All rights reserved.
            </p>
            <p className="flex items-center gap-2 text-xs uppercase tracking-widest text-zinc-600">
              <Mark className="size-3 text-zinc-700" />
              Briefed before · Answered during · Written after
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
