"use client"

/**
 * Context Window — public research-stage landing page.
 *
 * A standalone editorial page that follows the monopo-saigon design language
 * (see /new_design.md) adapted to a dark canvas: Roobert→Inter, sharp 0px
 * corners with 75px full-pill buttons, a single iridescent chromatic gesture
 * (sage → amber → oxblood) that lives only in atmospheric media, whisper-weight
 * display type, and patient cubic-bezier(0.19,1,0.22,1) motion.
 *
 * Self-contained on purpose — it does not import or modify the existing app.
 */

import { useState, useEffect } from "react"
import Link from "next/link"
import { Inter, Fraunces } from "next/font/google"
import { motion, useReducedMotion, AnimatePresence } from "framer-motion"

// Body / UI — clean geometric-humanist sans (the Roobert substitute).
const inter = Inter({ subsets: ["latin"], variable: "--cwl-font" })
// Display — a characterful editorial serif, used only for large headlines so
// titles read as a different voice from the sans subtitles and body.
const fraunces = Fraunces({
  subsets: ["latin"],
  weight: ["300", "400"],
  style: ["normal", "italic"],
  variable: "--cwl-serif",
})

const EASE = [0.19, 1, 0.22, 1] as const
const APPLY = "/apply"

/* -------------------------------------------------------------------------- */
/*  Reveal — patient fade + rise, honoring reduced-motion                     */
/* -------------------------------------------------------------------------- */

function Reveal({
  children,
  delay = 0,
  className,
}: {
  children: React.ReactNode
  delay?: number
  className?: string
}) {
  const reduce = useReducedMotion()
  return (
    <motion.div
      className={className}
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: 26 }}
      whileInView={reduce ? { opacity: 1 } : { opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-70px" }}
      transition={{ duration: 1, ease: EASE, delay }}
    >
      {children}
    </motion.div>
  )
}

/* -------------------------------------------------------------------------- */
/*  Small building blocks                                                     */
/* -------------------------------------------------------------------------- */

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <span className="block text-[11px] font-normal uppercase tracking-[0.24em] text-white/40">
      {children}
    </span>
  )
}

function GhostPill({
  href,
  children,
  variant = "outline",
}: {
  href: string
  children: React.ReactNode
  variant?: "outline" | "invert"
}) {
  const base =
    "inline-flex items-center justify-center rounded-[75px] px-8 py-[13px] text-[15px] font-normal transition-all duration-700"
  const styles =
    variant === "invert"
      ? "border border-white/30 text-white hover:bg-white hover:text-black"
      : "border border-white/20 text-white/90 hover:border-white/60"
  return (
    <Link href={href} className={`${base} ${styles}`} style={{ transitionTimingFunction: "cubic-bezier(0.19,1,0.22,1)" }}>
      {children}
    </Link>
  )
}

/* -------------------------------------------------------------------------- */
/*  Interactive thought-experiment card                                       */
/* -------------------------------------------------------------------------- */

function Question({
  index,
  question,
  reflection,
}: {
  index: string
  question: string
  reflection: string
}) {
  const [open, setOpen] = useState(false)
  return (
    <button
      type="button"
      onClick={() => setOpen((v) => !v)}
      className="group block w-full border-t border-white/12 py-9 text-left transition-colors duration-500 hover:border-white/40"
    >
      <div className="flex items-start gap-6">
        <span className="mt-1 shrink-0 text-[11px] uppercase tracking-[0.24em] text-white/30 tabular-nums">
          {index}
        </span>
        <div className="flex-1">
          <p className="text-[clamp(1.35rem,3.2vw,2.15rem)] font-light leading-[1.2] tracking-[-0.01em] text-white">
            {question}
          </p>
          <AnimatePresence initial={false}>
            {open && (
              <motion.p
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.7, ease: EASE }}
                className="overflow-hidden text-[17px] font-normal leading-[1.55] text-white/55"
              >
                <span className="mt-5 block max-w-[46ch]">{reflection}</span>
              </motion.p>
            )}
          </AnimatePresence>
        </div>
        <span
          className="mt-2 shrink-0 text-white/30 transition-transform duration-500 group-hover:text-white/70"
          style={{ transform: open ? "rotate(45deg)" : "rotate(0deg)" }}
          aria-hidden
        >
          +
        </span>
      </div>
    </button>
  )
}

/* -------------------------------------------------------------------------- */
/*  Page                                                                      */
/* -------------------------------------------------------------------------- */

export default function LandingPage() {
  // Fade a dark blurred background into the header once the page starts scrolling.
  const [scrolled, setScrolled] = useState(false)
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24)
    onScroll()
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  const explorations = [
    {
      title: "Organizational Understanding",
      body: "Can a system form a genuine model of how a company works — not its org chart, but its actual logic?",
    },
    {
      title: "Organizational Memory",
      body: "What would it take for what a company learns to outlast the people who learned it?",
    },
    {
      title: "Decision Intelligence",
      body: "If every decision carried its reasoning with it, how would the next decision change?",
    },
    {
      title: "Pattern Discovery",
      body: "What could a company learn about itself from patterns no single person is positioned to see?",
    },
    {
      title: "Context-Aware Systems",
      body: "What if your tools understood the situation you were in — not just the query you typed?",
    },
    {
      title: "External + Internal Knowledge",
      body: "How should what a company knows about itself meet what is true about the world outside it?",
    },
    {
      title: "Evidence-Based Reasoning",
      body: "Can an answer always show its work — every claim traced back to where it came from?",
    },
  ]

  const beliefs = [
    {
      k: "Understanding is infrastructure.",
      v: "The most valuable thing a company owns is its accumulated judgment. It is also the one thing nothing is built to keep.",
    },
    {
      k: "Context is the real bottleneck.",
      v: "Not talent. Not tooling. The hours spent reconstructing what is already known are the most expensive hours in any company.",
    },
    {
      k: "Memory should not depend on people staying.",
      v: "When someone leaves, the company should keep what it learned from them — not lose a piece of itself.",
    },
    {
      k: "An answer without its reasoning is a rumor.",
      v: "Trust does not come from confidence. It comes from being able to see why.",
    },
    {
      k: "This should feel invisible.",
      v: "Understanding should not be a place you visit. It should be present wherever the work already happens.",
    },
  ]

  return (
    <main className={`${inter.variable} ${fraunces.variable} cwl-root relative min-h-screen bg-black text-white`}>
      {/* Scoped styles — namespaced, cannot collide with the existing app. */}
      <style>{`
        .cwl-root { font-family: var(--cwl-font), ui-sans-serif, system-ui, -apple-system, sans-serif; -webkit-font-smoothing: antialiased; }
        .cwl-display { font-family: var(--cwl-serif), Georgia, 'Times New Roman', serif; font-optical-sizing: auto; }
        .cwl-display-i { font-family: var(--cwl-serif), Georgia, serif; font-style: italic; }
        .cwl-iri { position: absolute; inset: -30% -10% auto -10%; height: 130%; filter: blur(90px); opacity: 0.9; pointer-events: none; }
        .cwl-blob { position: absolute; border-radius: 50%; mix-blend-mode: screen; }
        @keyframes cwlDrift1 { 0%,100% { transform: translate(0,0) scale(1); } 50% { transform: translate(8%, 6%) scale(1.12); } }
        @keyframes cwlDrift2 { 0%,100% { transform: translate(0,0) scale(1.05); } 50% { transform: translate(-9%, -5%) scale(0.95); } }
        @keyframes cwlDrift3 { 0%,100% { transform: translate(0,0) scale(1); } 50% { transform: translate(5%, -8%) scale(1.1); } }
        @keyframes cwlSpin { to { transform: rotate(360deg); } }
        .cwl-b1 { animation: cwlDrift1 18s ease-in-out infinite; }
        .cwl-b2 { animation: cwlDrift2 22s ease-in-out infinite; }
        .cwl-b3 { animation: cwlDrift3 26s ease-in-out infinite; }
        .cwl-badge { animation: cwlSpin 18s linear infinite; }
        @media (prefers-reduced-motion: reduce) {
          .cwl-b1, .cwl-b2, .cwl-b3, .cwl-badge { animation: none; }
        }
      `}</style>

      {/* ------------------------------------------------------------------ */}
      {/*  Navigation                                                         */}
      {/* ------------------------------------------------------------------ */}
      <header
        className={`fixed inset-x-0 top-0 z-50 border-b transition-colors duration-500 ${
          scrolled
            ? "border-white/10 bg-black/70 backdrop-blur-xl"
            : "border-transparent bg-transparent"
        }`}
      >
        <div className="mx-auto flex h-[60px] max-w-[1080px] items-center justify-between px-5 md:h-[66px] md:px-6">
          {/* Wordmark lockup — "Context Window \ HQ". */}
          <Link href="/landing" className="flex items-baseline text-[16px] tracking-[-0.02em] md:text-[17px]">
            <span className="font-semibold text-white">Context&nbsp;Window</span>
            <span className="font-normal text-white/45">&nbsp;\&nbsp;HQ</span>
          </Link>

          <nav className="hidden items-center gap-9 md:flex">
            {[
              ["The problem", "#problem"],
              ["Exploring", "#exploring"],
              ["Beliefs", "#beliefs"],
              ["Partners", "#partners"],
            ].map(([label, href]) => (
              <a
                key={href}
                href={href}
                className="text-[13px] text-white/55 transition-colors duration-500 hover:text-white"
              >
                {label}
              </a>
            ))}
          </nav>

          {/* Compact on mobile so it never overpowers the wordmark. */}
          <Link
            href={APPLY}
            className="inline-flex items-center justify-center rounded-[75px] border border-white/25 px-3.5 py-1.5 text-[13px] font-normal text-white/90 transition-all duration-500 hover:border-white/60 md:px-7 md:py-[11px] md:text-[15px]"
            style={{ transitionTimingFunction: "cubic-bezier(0.19,1,0.22,1)" }}
          >
            <span className="md:hidden">Talk</span>
            <span className="hidden md:inline">Start a conversation</span>
          </Link>
        </div>
      </header>

      {/* ------------------------------------------------------------------ */}
      {/*  Hero                                                               */}
      {/* ------------------------------------------------------------------ */}
      <section className="relative flex min-h-screen items-center overflow-hidden">
        {/* The single chromatic gesture — atmospheric iridescent media only. */}
        <div className="cwl-iri" aria-hidden>
          <div
            className="cwl-blob cwl-b1"
            style={{ width: "55vw", height: "55vw", left: "-6%", top: "8%", background: "radial-gradient(circle, rgba(160,224,171,0.55), transparent 62%)" }}
          />
          <div
            className="cwl-blob cwl-b2"
            style={{ width: "48vw", height: "48vw", left: "30%", top: "0%", background: "radial-gradient(circle, rgba(255,172,46,0.45), transparent 60%)" }}
          />
          <div
            className="cwl-blob cwl-b3"
            style={{ width: "52vw", height: "52vw", left: "52%", top: "18%", background: "radial-gradient(circle, rgba(165,45,37,0.5), transparent 60%)" }}
          />
        </div>
        {/* Legibility wash — keeps text calm over the light. */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/55 to-black" aria-hidden />

        <div className="relative mx-auto w-full max-w-[1080px] px-6 pt-28">
          <Reveal>
            <Eyebrow>An enterprise research company</Eyebrow>
          </Reveal>
          <Reveal delay={0.08}>
            <h1 className="cwl-display mt-8 max-w-[15ch] text-[clamp(2.9rem,8vw,7rem)] font-light leading-[1.0] tracking-[-0.02em] text-balance">
              Your company knows more than anyone in it.
            </h1>
          </Reveal>
          <Reveal delay={0.16}>
            <p className="mt-9 max-w-[52ch] text-[clamp(1.05rem,2vw,1.35rem)] font-normal leading-[1.5] text-white/60">
              The reasoning behind your most important decisions is real, and it
              is quietly disappearing. Context Window is a study of what happens
              when an organization can finally understand itself.
            </p>
          </Reveal>
          <Reveal delay={0.24}>
            <div className="mt-11 flex flex-col items-start gap-5 sm:flex-row sm:items-center sm:gap-4">
              <GhostPill href={APPLY} variant="invert">
                Start a conversation
              </GhostPill>
              <a
                href="#problem"
                className="pl-8 text-[15px] text-white/55 transition-colors duration-500 hover:text-white sm:pl-0"
              >
                Read the thesis&nbsp;↓
              </a>
            </div>
          </Reveal>
        </div>

        {/* Rotating scroll badge — the system's one typographic ornament. */}
        <div className="pointer-events-none absolute bottom-8 left-6 hidden md:block" aria-hidden>
          <svg width="92" height="92" viewBox="0 0 92 92" className="cwl-badge">
            <defs>
              <path id="cwlcircle" d="M46,46 m-33,0 a33,33 0 1,1 66,0 a33,33 0 1,1 -66,0" />
            </defs>
            <text className="fill-white/40 text-[8.5px] uppercase tracking-[0.28em]">
              <textPath href="#cwlcircle" startOffset="0%">
                understanding · not information · understanding ·
              </textPath>
            </text>
          </svg>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/*  The Problem — storytelling                                         */}
      {/* ------------------------------------------------------------------ */}
      <section id="problem" className="mx-auto max-w-[1080px] px-6 py-32 md:py-44">
        <Reveal>
          <Eyebrow>The problem</Eyebrow>
        </Reveal>
        <Reveal delay={0.06}>
          <h2 className="cwl-display mt-8 max-w-[18ch] text-[clamp(2.1rem,5.2vw,3.9rem)] font-light leading-[1.05] tracking-[-0.015em] text-balance">
            A decision, two years later.
          </h2>
        </Reveal>

        <div className="mt-14 grid gap-16 md:grid-cols-[1fr_1.1fr] md:gap-24">
          <Reveal delay={0.1}>
            <div className="space-y-6 text-[18px] leading-[1.6] text-white/70">
              <p>
                Someone made a decision two years ago. A hard one. It shaped the
                roadmap, the hires, the direction everything took afterward.
              </p>
              <p>
                Ask why it was made today, and you get fragments. A
                half-remembered meeting. A thread nobody can find. Three people
                who each recall a different version. The one who actually knew
                has since left.
              </p>
            </div>
          </Reveal>
          <Reveal delay={0.16}>
            <div className="space-y-6 text-[18px] leading-[1.6] text-white/70">
              <p>The decision is still with you. The reasoning is gone.</p>
              <p>
                This happens quietly, every week, in every organization. Not
                because the information was never captured — most of it was. It
                was captured everywhere, by everything, and understood by
                nothing.
              </p>
              <p className="cwl-display-i text-[clamp(1.5rem,3.4vw,2.3rem)] font-light leading-[1.25] text-white">
                You are not short on data. You are short on memory.
              </p>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/*  Why existing software isn't enough                                 */}
      {/* ------------------------------------------------------------------ */}
      <section className="border-y border-white/10 bg-white/[0.015]">
        <div className="mx-auto max-w-[1080px] px-6 py-32 md:py-44">
          <Reveal>
            <Eyebrow>Why the tools you have aren&apos;t enough</Eyebrow>
          </Reveal>
          <Reveal delay={0.06}>
            <h2 className="cwl-display mt-8 max-w-[20ch] text-[clamp(2.1rem,5.2vw,3.9rem)] font-light leading-[1.05] tracking-[-0.015em] text-balance">
              Storing something is not the same as understanding it.
            </h2>
          </Reveal>

          <Reveal delay={0.12}>
            <div className="mt-14 max-w-[62ch] space-y-6 text-[18px] leading-[1.6] text-white/70">
              <p>Your tools are very good at holding things.</p>
              <p>
                Conversations sit in one place. Documents in another. Work in a
                third. Each system keeps a faithful record of what was said,
                written and done.
              </p>
              <p>
                But a record is not an understanding. A transcript doesn&apos;t
                know which meeting changed the company&apos;s mind. A folder of
                documents can&apos;t tell you which assumption everything else
                depends on. Search can return a thousand results and still not
                answer the only question that matters: why.
              </p>
              <p>
                Understanding isn&apos;t something you retrieve. It&apos;s
                something that has to be built — continuously, from everything,
                as it happens.
              </p>
            </div>
          </Reveal>

          <Reveal delay={0.18}>
            <div className="mt-16 grid gap-px border border-white/12 bg-white/12 sm:grid-cols-3">
              {[
                ["Information", "tells you what was said."],
                ["Understanding", "tells you what it meant."],
                ["Context", "tells you why it still matters."],
              ].map(([k, v]) => (
                <div key={k} className="bg-black px-8 py-12">
                  <p className="text-[13px] uppercase tracking-[0.18em] text-white/45">{k}</p>
                  <p className="mt-4 text-[19px] font-light leading-[1.35] text-white/85">{v}</p>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/*  The Vision                                                         */}
      {/* ------------------------------------------------------------------ */}
      <section className="mx-auto max-w-[1080px] px-6 py-32 md:py-48">
        <Reveal>
          <Eyebrow>The vision</Eyebrow>
        </Reveal>
        <Reveal delay={0.06}>
          <h2 className="cwl-display mt-8 max-w-[15ch] text-[clamp(2.6rem,6.8vw,5.4rem)] font-light leading-[0.98] tracking-[-0.02em] text-balance">
            A company that remembers itself.
          </h2>
        </Reveal>

        <div className="mt-16 grid gap-16 md:grid-cols-2 md:gap-24">
          <Reveal delay={0.1}>
            <div className="space-y-6 text-[18px] leading-[1.6] text-white/70">
              <p>
                Imagine an organization that never loses the reason behind a
                decision. Where the lessons of one team are quietly available to
                the next. Where the thinking of the people who came before
                doesn&apos;t leave when they do.
              </p>
              <p className="cwl-display-i text-[clamp(1.5rem,3.4vw,2.1rem)] font-light leading-[1.35] text-white">
                Not a place you search. A place that understands.
              </p>
            </div>
          </Reveal>
          <Reveal delay={0.16}>
            <div className="space-y-6 text-[18px] leading-[1.6] text-white/70">
              <p>
                New people would arrive into context instead of confusion.
                Leaders would decide with the full weight of everything the
                company has already learned. The same mistake would be harder to
                make twice.
              </p>
              <p>
                We think this is where enterprise software is going. From systems
                that store what happened, to systems that understand what it
                means.
              </p>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/*  What we're exploring                                               */}
      {/* ------------------------------------------------------------------ */}
      <section id="exploring" className="border-t border-white/10">
        <div className="mx-auto max-w-[1080px] px-6 py-32 md:py-44">
          <Reveal>
            <Eyebrow>What we&apos;re exploring</Eyebrow>
          </Reveal>
          <Reveal delay={0.06}>
            <p className="mt-8 max-w-[48ch] text-[clamp(1.4rem,3.2vw,2.15rem)] font-light leading-[1.25] tracking-[-0.01em] text-white/90">
              These are open questions, not finished answers — directions we are
              investigating alongside our design partners.
            </p>
          </Reveal>

          <div className="mt-16">
            {explorations.map((e, i) => (
              <Reveal key={e.title} delay={Math.min(i * 0.05, 0.3)}>
                <div className="grid gap-4 border-t border-white/12 py-9 md:grid-cols-[0.9fr_1.1fr] md:gap-10">
                  <h3 className="text-[clamp(1.15rem,2.4vw,1.5rem)] font-normal leading-[1.2] tracking-[-0.01em] text-white">
                    {e.title}
                  </h3>
                  <p className="max-w-[52ch] text-[17px] leading-[1.55] text-white/55">
                    {e.body}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/*  Interactive thought experiment                                     */}
      {/* ------------------------------------------------------------------ */}
      <section className="border-t border-white/10 bg-white/[0.015]">
        <div className="mx-auto max-w-[860px] px-6 py-32 md:py-44">
          <Reveal>
            <Eyebrow>Three questions</Eyebrow>
          </Reveal>
          <Reveal delay={0.06}>
            <h2 className="cwl-display mt-8 max-w-[20ch] text-[clamp(2rem,4.8vw,3.2rem)] font-light leading-[1.08] tracking-[-0.015em] text-balance">
              Answer them honestly. Most companies can&apos;t.
            </h2>
          </Reveal>

          <div className="mt-12">
            <Question
              index="01"
              question="Why was your last important decision made?"
              reflection="If the answer lives in one person's memory, it was never really the company's decision. It was theirs."
            />
            <Question
              index="02"
              question="Could someone who joined today explain that decision in two years?"
              reflection="If not, the reasoning was never kept. Only the outcome was — and outcomes without reasons are how mistakes repeat."
            />
            <Question
              index="03"
              question="What has your company learned this month?"
              reflection="Something, certainly. The harder question is where that learning now lives — and whether anyone can reach it when it counts."
            />
            <div className="border-t border-white/12" />
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/*  Philosophy                                                         */}
      {/* ------------------------------------------------------------------ */}
      <section id="beliefs" className="mx-auto max-w-[1080px] px-6 py-32 md:py-44">
        <Reveal>
          <Eyebrow>What we believe</Eyebrow>
        </Reveal>
        <Reveal delay={0.06}>
          <h2 className="cwl-display mt-8 max-w-[16ch] text-[clamp(2.1rem,5.2vw,3.9rem)] font-light leading-[1.05] tracking-[-0.015em] text-balance">
            The beliefs underneath the work.
          </h2>
        </Reveal>

        <div className="mt-16 space-y-0">
          {beliefs.map((b, i) => (
            <Reveal key={b.k} delay={Math.min(i * 0.06, 0.3)}>
              <div className="grid gap-4 border-t border-white/12 py-10 md:grid-cols-[1fr_1fr] md:gap-16">
                <h3 className="text-[clamp(1.3rem,2.8vw,1.9rem)] font-light leading-[1.2] tracking-[-0.01em] text-white">
                  {b.k}
                </h3>
                <p className="max-w-[52ch] self-center text-[17px] leading-[1.6] text-white/60">
                  {b.v}
                </p>
              </div>
            </Reveal>
          ))}
          <div className="border-t border-white/12" />
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/*  Research program / design partners                                 */}
      {/* ------------------------------------------------------------------ */}
      <section id="partners" className="border-t border-white/10 bg-white/[0.015]">
        <div className="mx-auto max-w-[1080px] px-6 py-32 md:py-44">
          <div className="grid gap-16 md:grid-cols-[0.8fr_1.2fr] md:gap-24">
            <Reveal>
              <div>
                <Eyebrow>Where we are</Eyebrow>
                <h2 className="cwl-display mt-8 text-[clamp(2rem,4.8vw,3.4rem)] font-light leading-[1.02] tracking-[-0.015em] text-balance">
                  Research &amp; Design Partner Program.
                </h2>
              </div>
            </Reveal>
            <Reveal delay={0.1}>
              <div className="space-y-6 text-[18px] leading-[1.6] text-white/70">
                <p>
                  Context Window is early, and deliberately so. We are not
                  selling a product. We are working closely with a small number
                  of founders and enterprise teams to understand how
                  organizations actually learn, decide and forget — and what it
                  would take to change that.
                </p>
                <p>
                  Design partners shape the direction of the work. In return,
                  they get an early hand in defining a category we believe will
                  matter for a long time.
                </p>
                <p className="text-white/90">We take on partners carefully, and few at a time.</p>
                <div className="pt-4">
                  <GhostPill href={APPLY} variant="invert">
                    Apply to be a design partner
                  </GhostPill>
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/*  Founder story                                                      */}
      {/* ------------------------------------------------------------------ */}
      <section className="mx-auto max-w-[820px] px-6 py-32 md:py-44">
        <Reveal>
          <Eyebrow>Why we&apos;re doing this</Eyebrow>
        </Reveal>
        <Reveal delay={0.08}>
          <div className="mt-12 space-y-7 text-[clamp(1.15rem,2.2vw,1.4rem)] font-light leading-[1.5] tracking-[-0.01em] text-white/80">
            <p>I&apos;ve spent years watching capable companies relearn things they already knew.</p>
            <p>
              The pattern was always the same. The knowledge existed — in
              someone&apos;s head, in a thread, in a meeting six months ago. It
              just wasn&apos;t reachable at the moment it mattered. So the work
              got redone. The decision got remade. The person who left took a
              piece of the company with them, and nobody noticed until they
              needed it.
            </p>
            <p>
              It stopped looking like a knowledge problem and started looking
              like a memory problem. Not information a company lacks —
              understanding it can&apos;t hold on to.
            </p>
            <p>
              Context Window is an attempt to take that seriously. Not another
              place to put things. A way for an organization to understand
              itself.
            </p>
            <p className="text-white">
              We don&apos;t think anyone has built this yet. We&apos;d like to
              find out if it can be.
            </p>
          </div>
        </Reveal>
        <Reveal delay={0.14}>
          <p className="mt-12 text-[13px] uppercase tracking-[0.22em] text-white/40">
            — The founders of Context Window
          </p>
        </Reveal>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/*  Final CTA                                                          */}
      {/* ------------------------------------------------------------------ */}
      <section className="relative overflow-hidden border-t border-white/10">
        <div className="cwl-iri" style={{ opacity: 0.35 }} aria-hidden>
          <div
            className="cwl-blob cwl-b2"
            style={{ width: "50vw", height: "50vw", left: "20%", top: "10%", background: "radial-gradient(circle, rgba(255,172,46,0.4), transparent 60%)" }}
          />
          <div
            className="cwl-blob cwl-b3"
            style={{ width: "46vw", height: "46vw", left: "48%", top: "0%", background: "radial-gradient(circle, rgba(165,45,37,0.45), transparent 60%)" }}
          />
        </div>
        <div className="absolute inset-0 bg-gradient-to-b from-black via-black/70 to-black" aria-hidden />
        <div className="relative mx-auto max-w-[1080px] px-6 py-40 md:py-56">
          <Reveal>
            <h2 className="cwl-display max-w-[18ch] text-[clamp(2.6rem,6.8vw,5.6rem)] font-light leading-[1.0] tracking-[-0.02em] text-balance">
              If this is a problem you feel, we should talk.
            </h2>
          </Reveal>
          <Reveal delay={0.1}>
            <p className="mt-9 max-w-[50ch] text-[clamp(1.05rem,2vw,1.3rem)] leading-[1.5] text-white/60">
              We&apos;re looking for founders, executives and researchers who
              think about this too — and want a hand in defining what comes next.
            </p>
          </Reveal>
          <Reveal delay={0.18}>
            <div className="mt-11 flex flex-wrap items-center gap-4">
              <GhostPill href={APPLY} variant="invert">
                Start a conversation
              </GhostPill>
              <span className="text-[13px] uppercase tracking-[0.22em] text-white/35">
                Research &amp; Design Partner Program · 2026
              </span>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/*  Footer                                                             */}
      {/* ------------------------------------------------------------------ */}
      <footer className="border-t border-white/10">
        <div className="mx-auto flex max-w-[1080px] flex-col gap-8 px-6 py-14 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-[15px] font-medium text-white">
              Context Window <span className="font-normal text-white/45">\ HQ</span>
            </p>
            <p className="mt-2 text-[13px] text-white/40">An enterprise research company.</p>
          </div>
          <nav className="flex flex-wrap gap-x-8 gap-y-3">
            {[
              ["The problem", "#problem"],
              ["Exploring", "#exploring"],
              ["Beliefs", "#beliefs"],
              ["Partners", "#partners"],
              ["Start a conversation", APPLY],
            ].map(([label, href]) => (
              <a
                key={label}
                href={href}
                className="text-[13px] text-white/45 transition-colors duration-500 hover:text-white"
              >
                {label}
              </a>
            ))}
          </nav>
        </div>
      </footer>
    </main>
  )
}
