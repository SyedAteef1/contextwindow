"use client"

/**
 * Context Window Finance — for US solo search fund operators: a scanned PDF
 * CIM and IRS Form 1120-S turned into a 4-tab Excel operating model, $250
 * per deal.
 *
 * Served at finance.contextwindowhq.com via the host rewrite in next.config.ts
 * (and at /finance on any host). Shares the design language of the research
 * landing page (app/page.tsx): dark canvas, Inter + Fraunces, sharp corners
 * with full-pill buttons, one iridescent gesture, patient motion.
 *
 * Self-contained on purpose — it does not import or modify the rest of the app.
 */

import { useState, useEffect } from "react"
import Link from "next/link"
import { Inter, Fraunces } from "next/font/google"
import { motion, useReducedMotion, AnimatePresence } from "framer-motion"

const inter = Inter({ subsets: ["latin"], variable: "--cwl-font" })
const fraunces = Fraunces({
  subsets: ["latin"],
  weight: ["300", "400"],
  style: ["normal", "italic"],
  variable: "--cwl-serif",
})

const EASE = [0.19, 1, 0.22, 1] as const
// Every CTA lands here until a dedicated booking link exists.
const BOOK = "/apply"

const NAV = [
  ["The problem", "#problem"],
  ["What you get", "#model"],
  ["How it works", "#how"],
  ["FAQ", "#faq"],
] as const

/* -------------------------------------------------------------------------- */
/*  Building blocks                                                           */
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
    "inline-flex items-center justify-center rounded-[75px] px-8 py-[13px] text-center text-[15px] font-normal transition-all duration-700"
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

function Faq({ index, question, answer }: { index: string; question: string; answer: string }) {
  const [open, setOpen] = useState(false)
  return (
    <button
      type="button"
      onClick={() => setOpen((v) => !v)}
      aria-expanded={open}
      className="group block w-full border-t border-white/12 py-8 text-left transition-colors duration-500 hover:border-white/40"
    >
      <div className="flex items-start gap-6">
        <span className="mt-1 shrink-0 text-[11px] uppercase tracking-[0.24em] text-white/30 tabular-nums">
          {index}
        </span>
        <div className="flex-1">
          <p className="text-[clamp(1.2rem,2.6vw,1.7rem)] font-light leading-[1.25] tracking-[-0.01em] text-white">
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
                <span className="mt-5 block max-w-[58ch]">{answer}</span>
              </motion.p>
            )}
          </AnimatePresence>
        </div>
        <span
          className="mt-1 shrink-0 text-white/30 transition-transform duration-500 group-hover:text-white/70"
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
/*  Copy                                                                      */
/* -------------------------------------------------------------------------- */

const INPUTS = [
  {
    k: "The scanned PDF CIM",
    v: "The one the broker sent — photographed pages, skewed tables, no selectable text. Send it as it is.",
  },
  {
    k: "IRS Form 1120-S",
    v: "The seller's S-corporation returns, scanned or digital, for the years you were given.",
  },
]

const TABS = [
  {
    k: "Historical P&L",
    v: "Revenue, cost of goods and operating expenses by year, keyed in from the CIM and the 1120-S so you don't have to.",
  },
  {
    k: "Balance sheet",
    v: "Assets, liabilities and equity by year from Schedule L of the return.",
  },
  {
    k: "Adjusted EBITDA",
    v: "The seller's add-backs laid out line by line, from reported income to the number the CIM is asking you to believe.",
  },
  {
    k: "Projections",
    v: "A forward operating case built on the historicals, with the assumptions in cells you can change.",
  },
]

const STEPS = [
  {
    k: "Send the two documents.",
    v: "The scanned CIM and the 1120-S returns. Nothing to reformat, nothing to retype first.",
  },
  {
    k: "We build the model.",
    v: "The numbers come off the scanned pages and the form lines and into a structured workbook. Where the CIM and the tax return disagree, you see both.",
  },
  {
    k: "You get one Excel file.",
    v: "Four tabs, a normal .xlsx. Open it, change the assumptions, and start asking questions about the business.",
  },
  {
    k: "Pay for that deal.",
    v: "$250, once, for that CIM. No subscription to cancel when the search goes quiet.",
  },
]

const FAQS = [
  {
    q: "Who is this for?",
    a: "Solo search fund operators in the United States — one person running a search, looking at many small businesses, with no analyst to hand the spreadsheet work to.",
  },
  {
    q: "What do I need to send?",
    a: "Two things: the CIM as a PDF, and the seller's IRS Form 1120-S returns. That's all the model is built from.",
  },
  {
    q: "My CIM is a scan. Does that matter?",
    a: "No. That is the case this is built for — pages with no selectable text, tables you can't copy out of, numbers you would otherwise retype by hand.",
  },
  {
    q: "What exactly do I get back?",
    a: "One Excel workbook with four tabs: historical P&L, balance sheet, adjusted EBITDA and projections. It is a working file, not a PDF report.",
  },
  {
    q: "Is this a quality of earnings report?",
    a: "No. It is not a QoE, an audit, or tax or accounting advice. It gets the seller's numbers into a model so you can decide whether the deal deserves that spend.",
  },
  {
    q: "How are my documents handled?",
    a: "A CIM reaches you under an NDA, and we treat it that way. Your documents are never used to train models.",
  },
  {
    q: "What does it cost?",
    a: "$250 per deal. One CIM, one model. No subscription, no seat licence, no minimum.",
  },
]

/* -------------------------------------------------------------------------- */
/*  Page                                                                      */
/* -------------------------------------------------------------------------- */

export default function FinancePage() {
  // Fade a dark blurred background into the header once the page starts scrolling.
  const [scrolled, setScrolled] = useState(false)
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24)
    onScroll()
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

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
        .cwl-b1 { animation: cwlDrift1 18s ease-in-out infinite; }
        .cwl-b2 { animation: cwlDrift2 22s ease-in-out infinite; }
        .cwl-b3 { animation: cwlDrift3 26s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) {
          .cwl-b1, .cwl-b2, .cwl-b3 { animation: none; }
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
          <a href="#top" className="flex items-baseline text-[16px] tracking-[-0.02em] md:text-[17px]">
            <span className="font-semibold text-white">Context&nbsp;Window</span>
            <span className="font-normal text-white/45">&nbsp;\&nbsp;Finance</span>
          </a>

          <nav className="hidden items-center gap-9 md:flex">
            {NAV.map(([label, href]) => (
              <a
                key={href}
                href={href}
                className="text-[13px] text-white/55 transition-colors duration-500 hover:text-white"
              >
                {label}
              </a>
            ))}
          </nav>

          <Link
            href={BOOK}
            className="inline-flex items-center justify-center rounded-[75px] border border-white/25 px-3.5 py-1.5 text-[13px] font-normal text-white/90 transition-all duration-500 hover:border-white/60 md:px-7 md:py-[11px] md:text-[15px]"
            style={{ transitionTimingFunction: "cubic-bezier(0.19,1,0.22,1)" }}
          >
            <span className="md:hidden">$250 / deal</span>
            <span className="hidden md:inline">Model a deal — $250</span>
          </Link>
        </div>
      </header>

      {/* ------------------------------------------------------------------ */}
      {/*  Hero                                                               */}
      {/* ------------------------------------------------------------------ */}
      <section id="top" className="relative flex min-h-screen items-center overflow-hidden">
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

        <div className="relative mx-auto w-full max-w-[1080px] px-6 pb-20 pt-28">
          <Reveal>
            <Eyebrow>For solo search fund operators · United States</Eyebrow>
          </Reveal>
          <Reveal delay={0.08}>
            <h1 className="cwl-display mt-8 max-w-[17ch] text-[clamp(2.7rem,7.4vw,6.4rem)] font-light leading-[1.0] tracking-[-0.02em] text-balance">
              Stop spending your weekends typing a CIM into Excel.
            </h1>
          </Reveal>
          <Reveal delay={0.16}>
            <p className="mt-9 max-w-[54ch] text-[clamp(1.05rem,2vw,1.35rem)] font-normal leading-[1.5] text-white/60">
              Send the scanned PDF CIM and the seller&apos;s IRS Form 1120-S. Get
              back a 4-tab Excel operating model, with the data entry already
              done. $250 per deal.
            </p>
          </Reveal>
          <Reveal delay={0.24}>
            <div className="mt-11 flex flex-col items-start gap-5 sm:flex-row sm:items-center sm:gap-6">
              <GhostPill href={BOOK} variant="invert">
                Model your next deal — $250
              </GhostPill>
              <a
                href="#model"
                className="pl-8 text-[15px] text-white/55 transition-colors duration-500 hover:text-white sm:pl-0"
              >
                See the four tabs&nbsp;↓
              </a>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/*  The problem                                                        */}
      {/* ------------------------------------------------------------------ */}
      <section id="problem" className="mx-auto max-w-[1080px] px-6 py-32 md:py-44">
        <Reveal>
          <Eyebrow>The problem</Eyebrow>
        </Reveal>
        <Reveal delay={0.06}>
          <h2 className="cwl-display mt-8 max-w-[18ch] text-[clamp(2.1rem,5.2vw,3.9rem)] font-light leading-[1.05] tracking-[-0.015em] text-balance">
            You are the analyst. And the associate. And the partner.
          </h2>
        </Reveal>

        <div className="mt-14 grid gap-16 md:grid-cols-[1fr_1.1fr] md:gap-24">
          <Reveal delay={0.1}>
            <div className="space-y-6 text-[18px] leading-[1.6] text-white/70">
              <p>
                The CIM lands on a Friday. It is a scan — sixty photographed
                pages, tables you can&apos;t copy out of. The tax returns are
                images of Form 1120-S.
              </p>
              <p>
                So Saturday goes to retyping. Revenue by year. Officer
                compensation. Depreciation. Every add-back the broker listed.
                One cell at a time, checking each against the page.
              </p>
            </div>
          </Reveal>
          <Reveal delay={0.16}>
            <div className="space-y-6 text-[18px] leading-[1.6] text-white/70">
              <p>
                By Sunday night you have a spreadsheet and no opinion. The hours
                went into the keyboard, not into the business.
              </p>
              <p>
                And most of these deals you will pass on. The next CIM arrives,
                and the weekend goes the same way.
              </p>
              <p className="cwl-display-i text-[clamp(1.5rem,3.4vw,2.3rem)] font-light leading-[1.25] text-white">
                You set out to buy a company, not to do data entry.
              </p>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/*  What you send, what you get                                        */}
      {/* ------------------------------------------------------------------ */}
      <section id="model" className="border-y border-white/10 bg-white/[0.015]">
        <div className="mx-auto max-w-[1080px] px-6 py-32 md:py-44">
          <Reveal>
            <Eyebrow>What you get</Eyebrow>
          </Reveal>
          <Reveal delay={0.06}>
            <h2 className="cwl-display mt-8 max-w-[20ch] text-[clamp(2.1rem,5.2vw,3.9rem)] font-light leading-[1.05] tracking-[-0.015em] text-balance">
              Two documents in. One Excel operating model out.
            </h2>
          </Reveal>

          <Reveal delay={0.1}>
            <p className="mt-20 text-[13px] uppercase tracking-[0.18em] text-white/45">You send</p>
            <div className="mt-6 grid gap-px border border-white/12 bg-white/12 sm:grid-cols-2">
              {INPUTS.map((d) => (
                <div key={d.k} className="bg-black px-8 py-10">
                  <p className="text-[21px] font-light leading-[1.3] text-white">{d.k}</p>
                  <p className="mt-3 max-w-[44ch] text-[16px] leading-[1.55] text-white/55">{d.v}</p>
                </div>
              ))}
            </div>
          </Reveal>

          <Reveal delay={0.1}>
            <p className="mt-16 text-[13px] uppercase tracking-[0.18em] text-white/45">
              You get back — a 4-tab .xlsx
            </p>
          </Reveal>
          <div className="mt-6">
            {TABS.map((t, i) => (
              <Reveal key={t.k} delay={Math.min(i * 0.05, 0.3)}>
                <div className="grid gap-3 border-t border-white/12 py-8 md:grid-cols-[auto_0.8fr_1.2fr] md:gap-10">
                  <span className="text-[11px] uppercase tracking-[0.24em] text-white/30 tabular-nums md:mt-2">
                    Tab 0{i + 1}
                  </span>
                  <h3 className="text-[clamp(1.15rem,2.4vw,1.5rem)] font-normal leading-[1.2] tracking-[-0.01em] text-white">
                    {t.k}
                  </h3>
                  <p className="max-w-[52ch] text-[17px] leading-[1.55] text-white/55">{t.v}</p>
                </div>
              </Reveal>
            ))}
            <div className="border-t border-white/12" />
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/*  How it works + pricing                                             */}
      {/* ------------------------------------------------------------------ */}
      <section id="how" className="mx-auto max-w-[1080px] px-6 py-32 md:py-44">
        <Reveal>
          <Eyebrow>How it works</Eyebrow>
        </Reveal>
        <Reveal delay={0.06}>
          <h2 className="cwl-display mt-8 max-w-[18ch] text-[clamp(2.1rem,5.2vw,3.9rem)] font-light leading-[1.05] tracking-[-0.015em] text-balance">
            Pay per deal. Not per month.
          </h2>
        </Reveal>

        <div className="mt-16">
          {STEPS.map((s, i) => (
            <Reveal key={s.k} delay={Math.min(i * 0.06, 0.3)}>
              <div className="grid gap-3 border-t border-white/12 py-10 md:grid-cols-[auto_1fr_1fr] md:gap-12">
                <span className="text-[11px] uppercase tracking-[0.24em] text-white/30 tabular-nums md:mt-3">
                  0{i + 1}
                </span>
                <h3 className="text-[clamp(1.3rem,2.8vw,1.9rem)] font-light leading-[1.2] tracking-[-0.01em] text-white">
                  {s.k}
                </h3>
                <p className="max-w-[52ch] self-center text-[17px] leading-[1.6] text-white/60">{s.v}</p>
              </div>
            </Reveal>
          ))}
          <div className="border-t border-white/12" />
        </div>

        <Reveal delay={0.1}>
          <div className="mt-16 grid gap-10 border border-white/12 px-8 py-10 md:grid-cols-[auto_1fr_auto] md:items-center md:gap-14">
            <div>
              <p className="text-[13px] uppercase tracking-[0.18em] text-white/45">Pay per deal</p>
              <p className="cwl-display mt-4 text-[clamp(2.6rem,5.4vw,3.8rem)] font-light leading-none tracking-[-0.02em] text-white">
                $250
              </p>
            </div>
            <p className="max-w-[44ch] text-[17px] leading-[1.55] text-white/60">
              One CIM, one 4-tab operating model. No subscription, no seat
              licence, no minimum — you pay when there is a deal worth modeling.
            </p>
            <GhostPill href={BOOK} variant="invert">
              Model a deal
            </GhostPill>
          </div>
        </Reveal>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/*  FAQ                                                                */}
      {/* ------------------------------------------------------------------ */}
      <section id="faq" className="border-t border-white/10 bg-white/[0.015]">
        <div className="mx-auto max-w-[860px] px-6 py-32 md:py-44">
          <Reveal>
            <Eyebrow>FAQ</Eyebrow>
          </Reveal>
          <Reveal delay={0.06}>
            <h2 className="cwl-display mt-8 max-w-[20ch] text-[clamp(2rem,4.8vw,3.2rem)] font-light leading-[1.08] tracking-[-0.015em] text-balance">
              What searchers ask before sending the first CIM.
            </h2>
          </Reveal>

          <div className="mt-12">
            {FAQS.map((f, i) => (
              <Faq key={f.q} index={`0${i + 1}`} question={f.q} answer={f.a} />
            ))}
            <div className="border-t border-white/12" />
          </div>
        </div>
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
            <h2 className="cwl-display max-w-[16ch] text-[clamp(2.6rem,6.8vw,5.6rem)] font-light leading-[1.0] tracking-[-0.02em] text-balance">
              Get your weekend back.
            </h2>
          </Reveal>
          <Reveal delay={0.1}>
            <p className="mt-9 max-w-[50ch] text-[clamp(1.05rem,2vw,1.3rem)] leading-[1.5] text-white/60">
              Send the next CIM and the 1120-S to us instead of to your Saturday.
              Open the model on Monday and start with the questions.
            </p>
          </Reveal>
          <Reveal delay={0.18}>
            <div className="mt-11 flex flex-wrap items-center gap-4">
              <GhostPill href={BOOK} variant="invert">
                Model your next deal — $250
              </GhostPill>
              <span className="text-[13px] uppercase tracking-[0.22em] text-white/35">
                Scanned CIM + Form 1120-S → 4-tab Excel
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
              Context Window <span className="font-normal text-white/45">\ Finance</span>
            </p>
            <p className="mt-2 text-[13px] text-white/40">
              CIM to Excel operating model, for solo searchers. © 2026 Context Window HQ
            </p>
          </div>
          <nav className="flex flex-wrap gap-x-8 gap-y-3">
            {[...NAV, ["Model a deal", BOOK] as const].map(([label, href]) => (
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
