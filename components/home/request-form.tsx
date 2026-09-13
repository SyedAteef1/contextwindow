"use client";

/**
 * "Request a brief" — two fields, two speeds.
 *
 * On submit the lead is filed to the leads Slack channel via /api/apply (same
 * intake /apply uses, tagged source "brief-request"), and /api/brief writes an
 * instant first pass from public search so the visitor gets something back
 * while they are still on the page. The reviewed brief — the fit, the opening,
 * the questions — still comes by email after a person reads it.
 *
 * The preview is strictly a bonus: if search, the model, or the rate limit says
 * no, the request has still been filed and the visitor sees the confirmation.
 */

import { useEffect, useState } from "react";
import posthog from "posthog-js";
import { isPersonalInbox } from "@/lib/free-mail";
import styles from "@/app/cosmos.module.css";

const INBOX = "hello@contextwindowhq.com";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const STAGES = ["Searching public sources", "Reading what we found", "Writing the first pass"];

type Brief = {
  company: string;
  summary: string;
  people: string;
  recent: string;
  gaps: string[];
  sources: { n: number; title: string; url: string }[];
};

export default function RequestForm() {
  const [email, setEmail] = useState("");
  const [target, setTarget] = useState("");
  const [errors, setErrors] = useState<{ email?: string; target?: string }>({});
  const [phase, setPhase] = useState<"form" | "working" | "done">("form");
  const [stage, setStage] = useState(0);
  const [preview, setPreview] = useState<Brief | null>(null);

  // Walk the progress list while the request is in flight. The stages are the
  // real ones, so this is a readout rather than a fake loader.
  useEffect(() => {
    if (phase !== "working") return;
    const id = setInterval(() => setStage((s) => Math.min(s + 1, STAGES.length - 1)), 3500);
    return () => clearInterval(id);
  }, [phase]);

  const validate = () => {
    const next: { email?: string; target?: string } = {};
    if (!email.trim()) next.email = "We need somewhere to send the brief.";
    else if (!EMAIL_RE.test(email.trim())) next.email = "That email doesn't look right.";
    if (!target.trim()) next.target = "Who are you meeting?";
    else if (isPersonalInbox(target))
      next.target = "That's a personal inbox, so there's no company behind it. Give us the company name or website.";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    const who = target.trim();
    const to = email.trim();
    setStage(0);
    setPhase("working");

    // File the lead first — this is the part that must not be lost.
    const filed = fetch("/api/apply", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "",
        email: to,
        company: who,
        phone: "",
        teamSize: "",
        message: `Meeting with: ${who}`,
        source: "brief-request",
      }),
    }).catch(() => null);

    try {
      const res = await fetch("/api/brief", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: to, target: who }),
      });
      const data = await res.json().catch(() => ({ ok: false }));
      if (data?.ok && data.brief) setPreview(data.brief as Brief);
    } catch {
      // No preview; the emailed brief is unaffected.
    }

    const lead = await filed;
    try {
      posthog.identify(to, { company: who });
      posthog.capture("brief_requested", { company: who, source: "brief-request", filed: Boolean(lead?.ok) });
    } catch {
      /* analytics must never block a request */
    }
    setPhase("done");
  };

  if (phase === "working") {
    return (
      <div className={styles.form}>
        <div className={styles.work}>
          {STAGES.map((label, i) => (
            <div
              key={label}
              className={`${styles.workStage} ${i === stage ? styles.workStageOn : ""} ${
                i < stage ? styles.workStageDone : ""
              }`}
            >
              <span className={styles.workDot} />
              {label}
            </div>
          ))}
          <p className={styles.workNote}>This takes about half a minute. Your request is already in.</p>
        </div>
      </div>
    );
  }

  if (phase === "done") {
    return (
      <div className={styles.form}>
        {preview ? (
          <div>
            <div className={styles.previewLabel}>
              <span>First pass · written just now from public sources</span>
              <span>Not yet read by a person</span>
            </div>

            <p className={styles.previewCompany}>{preview.company}</p>

            <div className={styles.block}>
              <div className={styles.blockLabel}>The company</div>
              <p className={styles.blockBody}>{preview.summary}</p>
            </div>

            {preview.people && (
              <div className={styles.block}>
                <div className={styles.blockLabel}>Who&apos;s visible there</div>
                <p className={styles.blockBody}>{preview.people}</p>
              </div>
            )}

            {preview.recent && (
              <div className={styles.block}>
                <div className={styles.blockLabel}>Recent</div>
                <p className={styles.blockBody}>{preview.recent}</p>
              </div>
            )}

            {preview.gaps.length > 0 && (
              <div className={styles.block}>
                <div className={styles.blockLabel}>What we couldn&apos;t find</div>
                <ul className={styles.gapList}>
                  {preview.gaps.map((g) => (
                    <li key={g}>{g}</li>
                  ))}
                </ul>
              </div>
            )}

            {preview.sources.length > 0 && (
              <div className={styles.block}>
                <div className={styles.blockLabel}>Sources</div>
                <div className={styles.srcList}>
                  {preview.sources.map((s) => (
                    <a key={s.url} href={s.url} target="_blank" rel="noopener noreferrer nofollow">
                      <span className={styles.srcNum}>[{s.n}]</span>
                      <span>{s.title}</span>
                    </a>
                  ))}
                </div>
              </div>
            )}

            <p className={styles.previewNote}>
              That&apos;s the half a machine can do. The rest — why this might be a fit, what to lead
              with, and the questions to be ready for — needs to know what you sell, so a person writes
              it. It lands at {email.trim()} before your call.
            </p>
          </div>
        ) : (
          <div className={styles.done}>
            <p className={styles.doneTitle}>We&apos;ve got it.</p>
            <div className={styles.kv}>
              <span className={styles.kvKey}>Researching</span>
              <span className={styles.kvVal}>{target.trim()}</span>
              <span className={styles.kvKey}>Sending to</span>
              <span className={styles.kvVal}>{email.trim()}</span>
            </div>
            <p className={styles.doneBody}>
              It lands before your call. If the call is today, reply to our email and say so.
            </p>
          </div>
        )}

        <div className={styles.formFoot}>
          <button
            type="button"
            className={styles.textBtn}
            onClick={() => {
              setEmail("");
              setTarget("");
              setPreview(null);
              setPhase("form");
            }}
          >
            Request another
          </button>
        </div>
      </div>
    );
  }

  return (
    <form className={styles.form} onSubmit={submit} noValidate>
      <div className={styles.row2}>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="cw-email">
            Your work email
          </label>
          <input
            id="cw-email"
            name="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (errors.email) setErrors((p) => ({ ...p, email: undefined }));
            }}
            className={`${styles.input} ${errors.email ? styles.inputBad : ""}`}
            placeholder="you@company.com"
          />
          {errors.email && <p className={styles.fieldNote}>{errors.email}</p>}
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="cw-target">
            Who you&apos;re meeting
          </label>
          <input
            id="cw-target"
            name="target"
            value={target}
            onChange={(e) => {
              setTarget(e.target.value);
              if (errors.target) setErrors((p) => ({ ...p, target: undefined }));
            }}
            className={`${styles.input} ${errors.target ? styles.inputBad : ""}`}
            placeholder="Company, website, or their email"
          />
          {errors.target && <p className={styles.fieldNote}>{errors.target}</p>}
        </div>
      </div>

      <div className={styles.formFoot}>
        <button type="submit" className={`${styles.btn} ${styles.btnPrimary}`}>
          Get my brief
        </button>
        <span className={styles.formNote}>
          A first pass appears here in seconds. The full brief follows by email. <a href={`mailto:${INBOX}`}>{INBOX}</a>
        </span>
      </div>
    </form>
  );
}
