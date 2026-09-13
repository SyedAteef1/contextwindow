import type { Metadata } from "next";
import Link from "next/link";
import { Fraunces } from "next/font/google";
import styles from "./cosmos.module.css";
import RequestForm from "@/components/home/request-form";

// One face for the whole page — a high-contrast serif with optical sizing,
// used at weight 350 for display copy (the Cosmos signature) and 400 for body.
const cosmos = Fraunces({
  subsets: ["latin"],
  style: ["normal", "italic"],
  // SOFT/WONK dialled to 0 in CSS below — straight, didone-ish letterforms
  // rather than Fraunces' default wonky ones. opsz tracks the size.
  axes: ["SOFT", "WONK", "opsz"],
  variable: "--cw-cosmos",
  display: "swap",
});

const INBOX = "hello@contextwindowhq.com";

export const metadata: Metadata = {
  title: "Context Window — a research brief before every sales call",
  description:
    "Forward a meeting invite and get a one-page brief on the people you're about to sell to, with every claim sourced. Free while we're early.",
  openGraph: {
    title: "Context Window — a research brief before every sales call",
    description:
      "Forward a meeting invite and get a one-page brief on the people you're about to sell to, with every claim sourced. Free while we're early.",
    url: "https://contextwindowhq.com/",
    siteName: "Context Window",
    type: "website",
  },
  alternates: { canonical: "https://contextwindowhq.com/" },
};

/** The mark: a single dot — the inverse of the eight-dot cluster. */
function DotMark() {
  return (
    <svg className={styles.dots} width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <circle cx="9" cy="9" r="3.4" fill="#0d0d0d" />
    </svg>
  );
}

const STEPS = [
  {
    n: "01",
    t: "Forward the invite",
    b: (
      <>
        Send any external sales meeting to{" "}
        <a href={`mailto:${INBOX}`} className={styles.inlineLink}>
          {INBOX}
        </a>
        , ideally a day ahead.
      </>
    ),
  },
  {
    n: "02",
    t: "We research the room",
    b: <>The company, the people, and what changed recently — matched against what you sell.</>,
  },
  {
    n: "03",
    t: "Read it before the call",
    b: (
      <>
        One page in your inbox. Every fact links to where it came from, so you can check it before you
        repeat it.
      </>
    ),
  },
];

const BRIEF_ITEMS = [
  { title: "The company", body: "What they do, and what changed recently." },
  { title: "Who's in the room", body: "Roles, tenure, what they own." },
  {
    title: "Why this might be a fit",
    body: "Something specific about them, matched to something specific about you.",
  },
  { title: "Be ready for", body: "The three hardest questions they're likely to ask." },
  { title: "Worth asking them", body: "Three questions that reveal whether the deal is real." },
  { title: "An honest read", body: "Including when we think it isn't a fit." },
];

const BE_READY_FOR = [
  "How long does rollout take for a team our size?",
  "Can our current system stay live during the switch?",
  "What happens to our data if we leave?",
];

const WORTH_ASKING = [
  "What made you start looking at this now?",
  "Who else needs to agree before this moves?",
  "What would make you decide not to do it?",
];

const FAQS = [
  { q: "Is it really free?", a: "Yes, while we're early. We ask for feedback after your call instead." },
  { q: "Do you need my calendar or email?", a: "No. You send us the meetings you choose, one at a time." },
  {
    q: "Where does the information come from?",
    a: "Public sources — company websites, press releases, job posts, and professional profiles. Each claim in the brief lists its source.",
  },
  {
    q: "Does anything join my meeting?",
    a: "No. If you want help during the call itself, ask us. That's a separate product and a small beta.",
  },
  {
    q: "What if you can't find much about them?",
    a: "We tell you that instead of padding the page. A short honest brief beats a long invented one.",
  },
  {
    q: "How far ahead should I send the invite?",
    a: "A day or more. Send it anyway if it's sooner and we'll tell you if we can make it.",
  },
];

export default function Home() {
  return (
    <main className={`${cosmos.variable} ${styles.root}`}>
      {/* ===== NAV ===== */}
      <header className={styles.nav}>
        <Link href="/" className={styles.navPill}>
          <DotMark />
          Context Window
        </Link>
      </header>

      {/* ===== HERO ===== */}
      <section className={`${styles.wrap} ${styles.hero}`}>
        <span className={styles.eyebrow}>Context Window</span>
        <h1 className={styles.display}>Know who you&apos;re selling to before you dial in.</h1>
        <p className={styles.heroSub}>
          Forward us the invite for your next sales call. We send back a one-page brief on the company
          and the people in the room — what they likely need, what they&apos;ll push back on, and what to
          lead with. Every claim shows its source.
        </p>
        <div className={styles.btnRow}>
          <a href="#request" className={`${styles.btn} ${styles.btnPrimary}`}>
            Request a free brief
          </a>
          <a href="#sample" className={`${styles.btn} ${styles.btnSecondary}`}>
            Read the sample brief
          </a>
        </div>
        <p className={styles.heroFine}>
          Free while we&apos;re early. Nothing to install, no calendar access, no bot in your meeting.
        </p>
      </section>

      {/* ===== THE PROBLEM ===== */}
      <section className={`${styles.wrap} ${styles.section}`}>
        <p className={`${styles.statement} ${styles.statementCentred}`}>
          You have four calls this week and a product to build. So you skim their site, join the call,
          and find out what they care about while you&apos;re already talking.
        </p>
      </section>

      {/* ===== HOW IT WORKS ===== */}
      <section className={`${styles.wrap} ${styles.section}`} id="how">
        <h2 className={styles.h2}>How it works</h2>
        <p className={styles.lede}>
          You don&apos;t install anything or share your calendar. You send us one meeting at a time.
        </p>
        <div className={styles.grid3}>
          {STEPS.map((s) => (
            <div className={styles.step} key={s.n}>
              <span className={styles.stepNum}>{s.n}</span>
              <h3 className={styles.stepTitle}>{s.t}</h3>
              <p className={styles.stepBody}>{s.b}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ===== WHAT'S IN A BRIEF ===== */}
      <section className={`${styles.wrap} ${styles.section}`} id="brief">
        <h2 className={styles.h2}>What&apos;s in a brief</h2>
        <div className={styles.grid3}>
          {BRIEF_ITEMS.map((item) => (
            <div className={styles.card} key={item.title}>
              <span className={styles.cardLabel}>{item.title}</span>
              <p className={styles.cardBody}>{item.body}</p>
            </div>
          ))}
          <div className={`${styles.card} ${styles.cardWide}`}>
            <span className={styles.cardLabel}>Sources</span>
            <p className={styles.cardBody}>For every factual claim.</p>
          </div>
        </div>
      </section>

      {/* ===== SAMPLE BRIEF ===== */}
      <section className={`${styles.wrap} ${styles.section}`} id="sample">
        <article className={styles.sheet}>
          <div className={styles.sheetHead}>
            <h2 className={styles.sheetTitle}>Brief — Northfield Logistics · Thursday</h2>
            <span className={styles.sheetMeta}>Sample</span>
          </div>

          <div className={styles.sheetBody}>
            <div className={styles.sheetCol}>
              <div className={styles.block}>
                <div className={styles.blockLabel}>The company</div>
                <p className={styles.blockBody}>
                  Mid-sized freight and logistics operator, roughly 300 people. Announced a new regional
                  hub last quarter, which adds volume to the routing system they currently run in-house.
                  <span className={styles.cite}>1</span>
                </p>
              </div>

              <div className={styles.block}>
                <div className={styles.blockLabel}>Who&apos;s in the room</div>
                <p className={styles.blockBody}>
                  Dana Reyes, VP of Engineering. Eight months in the role, previously at a larger freight
                  company. Owns the decision to replace the in-house system.
                  <span className={styles.cite}>2</span>
                </p>
              </div>

              <div className={styles.block}>
                <div className={styles.blockLabel}>Why this might be a fit</div>
                <p className={styles.blockBody}>
                  Their careers page lists three open integration engineer roles, so the team is
                  stretched. Migration effort will weigh more heavily than feature depth.
                  <span className={styles.cite}>3</span>
                  <span className={styles.read}>Our read, not a fact.</span>
                </p>
              </div>

              <div className={styles.block}>
                <div className={styles.blockLabel}>What to lead with</div>
                <p className={styles.blockBody}>
                  Open with a migration that ran in parallel with the old system, not a product tour.
                  Closest customer story: <span className={styles.slot}>[your most similar customer]</span>.
                  <span className={styles.read}>Our read, not a fact.</span>
                </p>
              </div>
            </div>

            <div className={styles.sheetCol}>
              <div className={styles.block}>
                <div className={styles.blockLabel}>Be ready for</div>
                <ol className={styles.qList}>
                  {BE_READY_FOR.map((q, i) => (
                    <li key={q}>
                      <span className={styles.qNum}>{i + 1}</span>
                      <span>&ldquo;{q}&rdquo;</span>
                    </li>
                  ))}
                </ol>
              </div>

              <div className={styles.block}>
                <div className={styles.blockLabel}>Worth asking them</div>
                <ol className={styles.qList}>
                  {WORTH_ASKING.map((q, i) => (
                    <li key={q}>
                      <span className={styles.qNum}>{i + 1}</span>
                      <span>{q}</span>
                    </li>
                  ))}
                </ol>
              </div>

              <div className={styles.block}>
                <div className={styles.blockLabel}>Honest read</div>
                <p className={styles.blockBody}>
                  Worth a call. The timing is real, but the decision likely involves their operations
                  lead too.
                </p>
              </div>

              <div className={styles.block}>
                <div className={styles.blockLabel}>Sources</div>
                <div className={styles.sourceList}>
                  <span>[1] Northfield press release</span>
                  <span>[2] Public professional profile</span>
                  <span>[3] Northfield careers page</span>
                </div>
              </div>
            </div>
          </div>
        </article>
        <p className={styles.caption}>Northfield Logistics is a made-up company used for this example.</p>
      </section>

      {/* ===== WHY NOT JUST ASK CHATGPT ===== */}
      <section className={`${styles.wrap} ${styles.section}`}>
        <div className={styles.split}>
          <h2 className={styles.h2}>Why not just ask ChatGPT</h2>
          <div className={styles.prose}>
            <p>You can, and you should — it&apos;ll tell you what the company does.</p>
            <p>
              It won&apos;t know what you sell, which of your customers looks most like them, which
              objection you lose deals to, or that their last vendor took nine months to deliver. We learn
              your side once. After that, every brief is written for your deal rather than about their
              company.
            </p>
          </div>
        </div>
      </section>

      {/* ===== WE'RE EARLY ===== */}
      <section className={`${styles.wrap} ${styles.section}`}>
        <div className={styles.split}>
          <h2 className={styles.h2}>We&apos;re early</h2>
          <div className={styles.prose}>
            <p>
              A person reads every brief before it&apos;s sent. That&apos;s the point, not a limitation. We
              take a few teams at a time.
            </p>
            <p>
              In exchange for the brief being free, we ask for two minutes after your call: what you used,
              and what was missing.
            </p>
          </div>
        </div>
      </section>

      {/* ===== REQUEST A BRIEF ===== */}
      <section className={`${styles.wrap} ${styles.section}`} id="request">
        <div className={styles.formWrap}>
          <h2 className={styles.h2}>Request a brief</h2>
          <p className={styles.lede}>No invite handy? Tell us about the call instead.</p>
          <RequestForm />
        </div>
      </section>

      {/* ===== QUESTIONS ===== */}
      <section className={`${styles.wrap} ${styles.section}`} id="faq">
        <h2 className={styles.h2}>Questions</h2>
        <div className={styles.qaList}>
          {FAQS.map((f) => (
            <div className={styles.qa} key={f.q}>
              <h3 className={styles.qaQ}>{f.q}</h3>
              <p className={styles.qaA}>{f.a}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ===== FOOTER ===== */}
      <footer className={styles.footer}>
        <div className={`${styles.wrap} ${styles.footerInner}`}>
          <span>Context Window</span>
          <span className={styles.footerLinks}>
            <span>Privacy</span>
            <span>Terms</span>
            <a href={`mailto:${INBOX}`}>{INBOX}</a>
          </span>
        </div>
      </footer>
    </main>
  );
}
