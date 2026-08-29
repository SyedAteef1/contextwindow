import type { ReactNode } from "react";

import Link from "next/link";
import { ArrowRight, CalendarDays } from "lucide-react";

import { redirect } from "next/navigation";

import { DemoForm } from "@/components/marketing/demo-form";
import { Pricing } from "@/components/marketing/pricing";
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
 * Colour carries argument here rather than decoration, on the tokens defined in
 * `globals.css`: emerald is the answer landing and the deal moving, cobalt is
 * where an answer came from, amber is a live risk. Everything else is obsidian
 * and slate, so the three that are coloured are the three the eye finds.
 *
 * The copy states numbers rather than adjectives, and every number here is one
 * the code actually holds itself to — the 350ms utterance delay and the half
 * second that follows from it are `src/agents/live.ts`, the two-model split is
 * `src/lib/llm/fast.ts`. Nothing on this page claims a capability the repo does
 * not have; live sharing is marked as the beta it is.
 *
 * The previous version is kept at `/classic`.
 */
export const metadata = {
  title: "Context Window",
};

const NAV = [
  { label: "How it works", href: "#how" },
  { label: "vs. note-takers", href: "#compare" },
  { label: "Live sharing", href: "#share" },
  { label: "Pricing", href: "#pricing" },
];

function Cta({
  children,
  variant = "solid",
  href = "#demo",
}: {
  children: ReactNode;
  variant?: "solid" | "ghost";
  href?: string;
}) {
  if (variant === "ghost") {
    return (
      <a
        href={href}
        className="inline-flex items-center gap-2 rounded border border-rule px-5 py-3 text-sm font-medium text-ink-soft transition-[transform,border-color,color] duration-150 ease-out hover:border-muted/40 hover:text-ink active:scale-[0.97]"
      >
        {children}
      </a>
    );
  }
  /* Cobalt, not emerald. A button is structure — it is the same object on
     every page — and green is kept for the moments the product is actually
     doing something. `cobalt-deep` rather than `cobalt` because a 14px label
     needs 4.5:1 and the lighter blue gives 3.7. */
  return (
    <a
      href={href}
      className="group inline-flex items-center gap-2 rounded bg-cobalt-deep px-5 py-3 text-sm font-semibold text-ink shadow-[0_0_28px_-10px_var(--color-cobalt)] transition-[transform,box-shadow] duration-150 ease-out hover:shadow-[0_0_36px_-8px_var(--color-cobalt)] active:scale-[0.97]"
    >
      {children}
      <ArrowRight className="size-4 transition-transform duration-150 ease-out group-hover:translate-x-0.5" />
    </a>
  );
}

function Eyebrow({ children }: { children: string }) {
  return (
    <p className="text-xs font-semibold uppercase tracking-widest text-muted">{children}</p>
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
  body: ReactNode;
  children: ReactNode;
}) {
  return (
    <article className="flex flex-col justify-between gap-8 rounded border border-rule bg-surface p-8 transition-colors duration-150 ease-out hover:border-muted/25">
      <div className="flex flex-col gap-3">
        <div className="flex items-baseline gap-3">
          <span className="font-mono text-xs tabular-nums text-cobalt">{index}</span>
          <Eyebrow>{kicker}</Eyebrow>
        </div>
        <h3 className="text-xl font-medium leading-tight tracking-tight text-ink">{claim}</h3>
        <p className="text-sm leading-relaxed text-muted">{body}</p>
      </div>
      <div className="overflow-hidden rounded border border-rule bg-ground">{children}</div>
    </article>
  );
}

/**
 * The comparison.
 *
 * Rows are moments in a deal rather than feature names, because the argument
 * is about *when* a tool helps rather than what it has. Read down the last
 * column and the only row anyone else fills is the one that happens after the
 * deal is already decided.
 */
const COMPARISON: { moment: string; recorders: string; ri: string; ours: string }[] = [
  {
    moment: "Before the call",
    recorders: "Nothing",
    ri: "Deal history, if a manager pulls it",
    ours: "Who they are and how they decide, in four seconds",
  },
  {
    moment: "The buyer asks something hard",
    recorders: "Records it",
    ri: "Records it",
    ours: "The answer, on your screen, in under a second",
  },
  {
    moment: "After the call",
    recorders: "A transcript, and a summary",
    ri: "A coaching scorecard for your VP",
    ours: "CRM updated, follow-up drafted, one click to send",
  },
  {
    moment: "Who it actually helps",
    recorders: "Whoever reads notes",
    ri: "Your manager, on Friday",
    ours: "You, mid-sentence, on Tuesday",
  },
];

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
    <div className="min-h-screen bg-ground text-ink selection:bg-cobalt/30 selection:text-ink">
      {/* --- Nav ------------------------------------------------------------ */}
      <header className="sticky top-0 z-50 border-b border-rule bg-ground/70 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link href="/plain" className="transition-opacity hover:opacity-80" aria-label="Context Window">
            <Wordmark />
          </Link>

          <nav className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-1 md:flex">
            {NAV.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="rounded px-3 py-2 text-sm text-muted transition-colors duration-150 ease-out hover:bg-surface hover:text-ink"
              >
                {item.label}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-1">
            <Link
              href="/api/auth/google/start"
              className="hidden rounded px-3 py-2 text-sm text-muted transition-colors hover:text-ink sm:block"
            >
              Sign in
            </Link>
            <a
              href="#demo"
              className="rounded bg-cobalt-deep px-4 py-2 text-sm font-semibold text-ink transition-transform duration-150 ease-out active:scale-[0.97]"
            >
              See a live demo
            </a>
          </div>
        </div>
      </header>

      {/* --- Hero ----------------------------------------------------------- */}
      <section className="relative isolate overflow-hidden">
        <div aria-hidden className="absolute inset-0 opacity-[0.13]">
          <WaveField bgColor="#08090c" color="#3b82f6" />
        </div>
        {/* Cobalt and emerald, blurred and held at a tenth — depth from light. */}
        <div aria-hidden className="hero-glow" />
        <div
          aria-hidden
          className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-b from-transparent to-ground"
        />

        <div className="relative mx-auto w-full max-w-7xl px-4 pb-20 pt-10 sm:px-6 lg:px-8 lg:pb-24 lg:pt-14">
          <div className="grid items-center gap-16 lg:grid-cols-2 lg:gap-20">
            <div className="flex flex-col gap-6">
              <div className="inline-flex w-fit items-center gap-2 rounded border border-rule bg-surface/80 px-3 py-1">
                <span className="size-1.5 rounded-full bg-cobalt" />
                <span className="text-xs uppercase tracking-widest text-muted">
                  The live-call cheat code
                </span>
              </div>

              <div className="flex flex-col gap-4">
                <h1 className="text-5xl font-semibold leading-none tracking-tighter text-ink sm:text-6xl lg:text-7xl">
                  Note-takers record the meeting.
                  <br />
                  <span className="text-faint">We help you crack the deal live.</span>
                </h1>
                <p className="max-w-2xl text-base leading-relaxed text-muted">
                  Context Window sits in your live Google Meet, searches your company&rsquo;s
                  technical docs in milliseconds, and feeds you the exact answers you need to
                  close the deal on the spot.
                </p>
              </div>

              <div className="flex flex-col gap-2.5">
                <div className="flex flex-wrap items-center gap-3">
                  <Cta href="#demo">See a live demo</Cta>
                  <Cta variant="ghost" href="#how">
                    See how it works
                  </Cta>
                </div>
                <p className="text-xs text-faint">No CRM integration required to test.</p>
              </div>

              {errorMessage && (
                <p className="w-fit rounded border border-flag/25 bg-flag/10 px-4 py-2 text-sm text-flag">
                  {errorMessage}
                </p>
              )}
            </div>

            {/* The awkward moment the copy names, and what replaces it. */}
            <div className="rail-dark relative">
              <div className="relative pb-10">
                <span className="rail-stamp font-mono text-xs text-faint">Before</span>
                <span className="rail-dot" aria-hidden />
                <p className="text-sm leading-relaxed text-muted">
                  A three-line cheat sheet on the buyer.
                  <span className="text-ink-soft"> Decides slowly. Fears a bad rollout.</span>
                </p>
              </div>

              <div className="relative">
                <span className="rail-stamp font-mono text-xs text-volt">Live</span>
                <span className="rail-dot" data-live="true" aria-hidden />
                <div className="relative rounded border border-rule bg-surface p-2">
                  <div className="overflow-hidden rounded border border-rule bg-ground">
                    <div className="flex items-center gap-2 border-b border-rule px-4 py-3">
                      <span className="size-2 rounded-full bg-rule" />
                      <span className="size-2 rounded-full bg-rule" />
                      <span className="size-2 rounded-full bg-rule" />
                      <span className="ml-2 text-xs text-faint">Cobalt Systems</span>
                      <span className="ml-auto flex items-center gap-2">
                        <span className="size-1.5 animate-pulse rounded-full bg-volt" />
                        <span className="text-xs uppercase tracking-widest text-volt">
                          Live
                        </span>
                      </span>
                    </div>

                    <div className="flex flex-col gap-6 p-6">
                      <div className="flex flex-col gap-2">
                        <div className="flex flex-wrap items-center gap-3">
                          <p className="text-xs uppercase tracking-widest text-faint">
                            The buyer just asked
                          </p>
                          {/* Amber, not red: the rep has to keep talking through it. */}
                          <span className="rounded border border-signal/30 bg-signal/10 px-1.5 py-px text-[9px] font-semibold uppercase tracking-[0.14em] text-signal">
                            Hesitation detected
                          </span>
                        </div>
                        <p className="text-base leading-snug text-ink">
                          Our last vendor promised six weeks and took nine months. What is the
                          real number?
                        </p>
                      </div>

                      <div className="flex flex-col gap-3 rounded border border-volt/25 bg-volt/[0.06] p-4">
                        <div className="flex items-center gap-3">
                          <span className="text-xs font-semibold uppercase tracking-widest text-volt">
                            Say this
                          </span>
                          <span className="pulse-ring ml-auto rounded-full border border-volt/30 bg-volt/10 px-2 py-0.5 font-mono text-[10px] tabular-nums text-volt">
                            0.8s
                          </span>
                        </div>
                        <p className="text-sm leading-relaxed text-ink-soft">
                          Three weeks for a team this size. And it runs in parallel — their
                          current system stays live until they choose to switch, so the date is
                          theirs, not ours.
                        </p>

                        <p className="flex flex-wrap items-center gap-2 border-t border-dashed border-volt/20 pt-3">
                          {/* Where it came from is structure, so it is cobalt. */}
                          <span className="rounded border border-cobalt/50 px-1.5 py-px text-[9px] font-semibold uppercase tracking-[0.14em] text-cobalt-bright">
                            From your docs
                          </span>
                          <span className="font-mono text-[10px] text-faint">
                            Meridian rollout · 3 weeks · June
                          </span>
                        </p>
                      </div>

                      <div className="flex items-center gap-3 border-t border-dashed border-rule pt-4">
                        <span className="text-xs uppercase tracking-widest text-faint">
                          What the rep didn&rsquo;t say
                        </span>
                        <span className="text-xs text-muted">
                          &ldquo;Let me check and get back to you.&rdquo;
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="relative mt-10">
                <span className="rail-stamp font-mono text-xs text-faint">After</span>
                <span className="rail-dot" aria-hidden />
                <p className="text-sm leading-relaxed text-muted">
                  <span className="text-ink-soft">The CRM is already updated.</span> The follow-up
                  is written. The rep just clicks approve.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* --- The problem ----------------------------------------------------- */}
      <section className="border-t border-rule py-24 lg:py-32">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex max-w-4xl flex-col gap-10">
            <h2 className="text-4xl font-semibold leading-[1.05] tracking-tighter text-ink sm:text-5xl lg:text-6xl">
              Transcripts are for managers.
              <br />
              <span className="text-faint">Answers are for closers.</span>
            </h2>

            <div className="flex max-w-2xl flex-col gap-5 text-base leading-relaxed text-muted">
              <p>
                Most sales AI just records the call so your boss can tell you why you lost the
                deal on Friday. That doesn&rsquo;t help you on Tuesday.
              </p>
              <p className="text-ink-soft">
                When a technical buyer asks a hard question, you have two choices:
              </p>

              <ol className="flex flex-col gap-3">
                {[
                  "Guess the answer and look stupid.",
                  "Say “I’ll check with engineering,” and kill the momentum.",
                ].map((choice, index) => (
                  <li key={choice} className="flex items-start gap-3">
                    <span className="mt-px font-mono text-xs tabular-nums text-faint">
                      {index + 1}
                    </span>
                    <span className="text-ink-soft">{choice}</span>
                  </li>
                ))}
              </ol>

              <p className="border-l border-cobalt/50 pl-5 text-xl font-medium tracking-tight text-ink">
                We built a third option.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* --- Three phases ----------------------------------------------------- */}
      <section id="how" className="border-t border-rule py-24 lg:py-32">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-16">
            <div className="flex max-w-2xl flex-col gap-3">
              <Eyebrow>How it works</Eyebrow>
              <h2 className="text-4xl font-semibold leading-tight tracking-tighter text-ink sm:text-5xl">
                How to hack a live sales call.
              </h2>
            </div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
              <Phase
                index="01"
                kicker="Before the call"
                claim="Zero prep. Just book the meeting."
                body={
                  <>
                    Stop researching prospects by hand. Context Window syncs securely with your
                    calendar and profiles the attendees on its own — the cheat sheet is in your
                    inbox days before you dial in. Impatient? Skip the small talk. Cautious? Lead
                    with the ROI data.
                  </>
                }
              >
                <div className="flex flex-col gap-3 p-5">
                  {/* Says where this came from, so the reader works out that
                      they did nothing to get it. */}
                  <div className="flex items-center gap-2 border-b border-rule-soft pb-3">
                    <CalendarDays className="size-3 shrink-0 text-cobalt-bright" aria-hidden />
                    <span className="font-mono text-[10px] tracking-wide text-faint">
                      Synced from 2:00 PM meeting invite
                    </span>
                  </div>
                  {[
                    ["Decides", "Wants a business case, not a demo"],
                    ["Fears", "Being blamed if it fails"],
                    ["Open with", "A result, not a feature"],
                  ].map(([label, value]) => (
                    <div key={label} className="flex items-start gap-3">
                      <span className="w-24 shrink-0 font-mono text-xs uppercase tracking-widest text-faint">
                        {label}
                      </span>
                      <span className="min-w-0 text-sm text-ink-soft">{value}</span>
                    </div>
                  ))}
                </div>
              </Phase>

              <Phase
                index="02"
                kicker="During the call"
                claim="Get the answer before they finish the question."
                body={
                  <>
                    You&rsquo;re on the Meet. The buyer asks about your API rate limits. We hear
                    it, search your docs and past winning calls in the background, and flash the
                    answer on your screen in 800 milliseconds. You look like a genius.
                  </>
                }
              >
                <div className="flex flex-col gap-2 p-4">
                  <p className="pb-1 text-sm leading-relaxed text-muted">
                    &ldquo;Does this replace Salesforce, or sit on top of it?&rdquo;
                  </p>
                  <div className="flex flex-col gap-2 rounded border border-volt/25 bg-volt/[0.06] px-3 py-2.5">
                    <span className="text-xs font-semibold uppercase tracking-widest text-volt">
                      Say this
                    </span>
                    <span className="text-sm leading-relaxed text-ink-soft">
                      On top. Nothing gets ripped out — it writes into the fields your team
                      already uses.
                    </span>
                  </div>
                </div>
              </Phase>

              <Phase
                index="03"
                kicker="After the call"
                claim="Close the tab. You&rsquo;re done."
                body={
                  <>
                    The call ends and the CRM is updated, the pricing you actually discussed is
                    in a proposal, and the follow-up is drafted. No dashboard to learn. No data
                    entry.
                  </>
                }
              >
                <div className="flex flex-col gap-3 p-5">
                  {[
                    ["Stage", "Discovery → Evaluation"],
                    ["Next step", "Security review · Thu"],
                    ["Follow-up", "Drafted · needs approval"],
                  ].map(([label, value]) => (
                    <div key={label} className="flex items-start gap-3">
                      <span className="w-24 shrink-0 font-mono text-xs uppercase tracking-widest text-faint">
                        {label}
                      </span>
                      <span className="min-w-0 text-sm text-ink-soft">{value}</span>
                    </div>
                  ))}
                </div>
              </Phase>
            </div>
          </div>
        </div>
      </section>

      {/* --- The comparison --------------------------------------------------- */}
      <section id="compare" className="border-t border-rule py-24 lg:py-32">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-12">
            <div className="flex max-w-3xl flex-col gap-4">
              <Eyebrow>vs. the note-takers</Eyebrow>
              <h2 className="text-4xl font-semibold leading-tight tracking-tighter text-ink sm:text-5xl">
                Everyone else shows up after the call.
              </h2>
              <p className="max-w-2xl text-base leading-relaxed text-muted">
                Otter and Fireflies just record the call. Gong and Chorus give you analysis
                afterwards. None of them help you in the actual moment. We sit in the live meet
                and feed you the exact answers you need to crack the deal.
              </p>
            </div>

            {/* Scrolls inside itself on a phone rather than widening the page. */}
            <div className="overflow-x-auto rounded border border-rule">
              <table className="w-full min-w-[46rem] border-collapse text-left">
                <thead>
                  <tr className="border-b border-rule bg-surface">
                    <th className="p-4 text-xs font-medium uppercase tracking-widest text-faint">
                      The moment
                    </th>
                    <th className="p-4 text-xs font-medium uppercase tracking-widest text-faint">
                      Otter, Fireflies
                    </th>
                    <th className="p-4 text-xs font-medium uppercase tracking-widest text-faint">
                      Gong, Chorus
                    </th>
                    <th className="p-4 text-xs font-semibold uppercase tracking-widest text-cobalt-bright">
                      Context Window
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {COMPARISON.map((row) => (
                    <tr key={row.moment} className="border-b border-rule-soft last:border-b-0">
                      <td className="p-4 align-top text-sm font-medium text-ink">{row.moment}</td>
                      <td className="p-4 align-top text-sm text-faint">{row.recorders}</td>
                      <td className="p-4 align-top text-sm text-faint">{row.ri}</td>
                      <td className="bg-cobalt/[0.06] p-4 align-top text-sm text-ink-soft">
                        {row.ours}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p className="max-w-2xl text-base leading-relaxed text-ink-soft">
              Read down the last column. It is the only one that helps you while the deal is
              still winnable.
            </p>
          </div>
        </div>
      </section>

      {/* --- Live sharing ------------------------------------------------------ */}
      <section id="share" className="border-t border-rule py-24 lg:py-32">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-12 lg:grid-cols-[1.1fr_1fr] lg:gap-16">
            <div className="flex flex-col gap-5">
              <div className="flex items-center gap-3">
                <Eyebrow>Live sharing</Eyebrow>
                {/* Amber, because it is a caveat rather than a feature. */}
                <span className="rounded border border-signal/30 bg-signal/10 px-1.5 py-px text-[9px] font-semibold uppercase tracking-[0.14em] text-signal">
                  Private beta
                </span>
              </div>

              <h2 className="text-4xl font-semibold leading-tight tracking-tighter text-ink sm:text-5xl">
                Bring your engineer without booking their calendar.
              </h2>

              <div className="flex flex-col gap-5 text-base leading-relaxed text-muted">
                <p>
                  Your solutions engineer does not have 45 minutes for a discovery call. They
                  have 45 seconds for the one question only they can answer.
                </p>
                <p>
                  Send them a live link. They watch the transcript as it happens and see the
                  answer we surfaced — and when we get it wrong, they type the real one. It lands
                  on your screen mid-sentence.
                </p>
                <p className="text-ink-soft">
                  No second bot in the room. Nothing on their calendar. The buyer just sees a rep
                  who knows their stuff.
                </p>
              </div>

              <p className="text-sm text-faint">
                Rolling out to design partners now. Ask for it when you book the demo.
              </p>
            </div>

            {/* The link, as the person on the other end sees it. */}
            <div className="rounded border border-rule bg-surface p-2">
              <div className="overflow-hidden rounded border border-rule bg-ground">
                <div className="flex items-center gap-2 border-b border-rule px-4 py-3">
                  <span className="text-xs text-faint">Watching · Cobalt Systems</span>
                  <span className="ml-auto flex items-center gap-2">
                    <span className="size-1.5 animate-pulse rounded-full bg-volt" />
                    <span className="text-xs uppercase tracking-widest text-volt">Live</span>
                  </span>
                </div>

                <div className="flex flex-col gap-4 p-5">
                  <div className="flex flex-col gap-1.5">
                    <span className="font-mono text-[10px] uppercase tracking-widest text-faint">
                      14:22 · Buyer
                    </span>
                    <p className="text-sm leading-relaxed text-ink-soft">
                      What happens to our data if we churn?
                    </p>
                  </div>

                  <div className="flex flex-col gap-2 rounded border border-volt/25 bg-volt/[0.06] p-3">
                    <span className="text-xs font-semibold uppercase tracking-widest text-volt">
                      We suggested
                    </span>
                    <p className="text-sm leading-relaxed text-ink-soft">
                      Full export on request, in the same schema you imported.
                    </p>
                  </div>

                  <div className="flex flex-col gap-2 rounded border border-cobalt/50 bg-cobalt/10 p-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold uppercase tracking-widest text-cobalt-bright">
                        Priya · Solutions
                      </span>
                      <span className="ml-auto font-mono text-[10px] text-faint">typing…</span>
                    </div>
                    <p className="text-sm leading-relaxed text-ink-soft">
                      Say 30 days, not &ldquo;on request&rdquo; — it&rsquo;s in their MSA and
                      their legal team will check.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* --- Not a wrapper ------------------------------------------------------ */}
      <section id="moat" className="border-t border-rule py-24 lg:py-32">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-12">
            <div className="flex max-w-3xl flex-col gap-5">
              <Eyebrow>Under the hood</Eyebrow>
              <h2 className="text-4xl font-semibold leading-tight tracking-tighter text-ink sm:text-5xl">
                Not a ChatGPT wrapper.
              </h2>

              <div className="flex flex-col gap-5 text-base leading-relaxed text-muted">
                <p>
                  Most sales AI is a transcript pasted into a prompt box. Here is what actually
                  happens when your buyer asks something hard.
                </p>
                <p className="text-ink-soft">
                  Their words reach us about 350 milliseconds after they stop talking. That
                  leaves roughly half a second before an answer is worthless.
                </p>
                <p>
                  So we throw out statements before any model runs — most of what people say is
                  not a question, and skipping it costs nothing. Your account context is already
                  in memory, loaded when the call started. And two models do two jobs: one takes
                  forty seconds to write your follow-up, the other exists only to put the first
                  word on your screen.
                </p>
                <p className="border-l border-cobalt/50 pl-5 text-ink-soft">
                  If it cannot make it in time, it shows you nothing. An answer you read out loud
                  and get wrong is worse than no answer at all.
                </p>
                <p>
                  Built for technical founders and sales teams who care about being right.
                </p>
              </div>
            </div>

            {/* One dot each, in the colour that claim belongs to. */}
            <div className="grid grid-cols-1 gap-px overflow-hidden rounded border border-rule bg-rule sm:grid-cols-3">
              {[
                [
                  "Two models, not one",
                  "Forty seconds for the follow-up. Under a second for the answer.",
                  "bg-volt",
                ],
                [
                  "It shuts up when unsure",
                  "No answer beats a wrong one you repeat to the buyer.",
                  "bg-signal",
                ],
                [
                  "Every answer names its source",
                  "Your docs, your past calls. You can see where it came from before you say it.",
                  "bg-cobalt",
                ],
              ].map(([title, body, dot]) => (
                <div key={title} className="flex flex-col gap-2 bg-ground p-6">
                  <p className="flex items-center gap-2.5 text-sm font-medium text-ink">
                    <span className={`size-1.5 shrink-0 rounded-full ${dot}`} aria-hidden />
                    {title}
                  </p>
                  <p className="text-sm leading-relaxed text-muted">{body}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <Pricing />

      {/* --- Request access ------------------------------------------------------ */}
      <section id="demo" className="border-t border-rule py-24 lg:py-32">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto grid max-w-5xl gap-12 lg:grid-cols-[1fr_1.1fr] lg:gap-16">
            <div className="flex flex-col gap-4">
              <Eyebrow>Request enterprise access</Eyebrow>
              <h2 className="text-4xl font-semibold leading-tight tracking-tighter text-ink sm:text-5xl">
                See it on one of your own calls.
              </h2>
              <p className="text-base leading-relaxed text-muted">
                We take a handful of teams a month, because each one gets our engineers in the
                room for setup — your docs, your tickets, your past calls. That is what makes the
                answers yours instead of generic.
              </p>
              <p className="text-base leading-relaxed text-muted">
                Tell us where deals stall. We will show you the exact moment this would have
                saved one.
              </p>
            </div>

            <div className="rounded border border-rule bg-surface p-6 sm:p-8">
              <DemoForm source={ref} />
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-rule py-10">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 sm:px-6 lg:px-8 sm:flex-row sm:items-center sm:justify-between">
          <Wordmark />
          <nav className="flex items-center gap-5">
            <Link href="/privacy" className="text-xs text-faint transition-colors hover:text-muted">
              Privacy
            </Link>
            <Link href="/terms" className="text-xs text-faint transition-colors hover:text-muted">
              Terms
            </Link>
            <a
              href="mailto:hello@contextwindowhq.com"
              className="text-xs text-faint transition-colors hover:text-muted"
            >
              Contact
            </a>
          </nav>
        </div>
      </footer>
    </div>
  );
}
