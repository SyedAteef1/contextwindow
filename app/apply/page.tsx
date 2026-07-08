"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, Check, Loader2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Inter, Fraunces } from "next/font/google";
import posthog from "posthog-js";

const inter = Inter({ subsets: ["latin"], variable: "--cwl-font" });
const fraunces = Fraunces({
  subsets: ["latin"],
  weight: ["300", "400"],
  style: ["normal", "italic"],
  variable: "--cwl-serif",
});

const TEAM_SIZES = ["1–10", "11–50", "51–200", "200+"];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Generic personal-inbox domains we nudge away from (still allowed, just a soft hint).
const FREE_EMAIL = ["gmail.com", "yahoo.com", "hotmail.com", "outlook.com", "icloud.com", "proton.me"];

export default function ApplyPage() {
  const router = useRouter();
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [topError, setTopError] = useState("");

  const [form, setForm] = useState({
    name: "",
    email: "",
    company: "",
    phone: "",
    teamSize: "",
    message: "",
  });

  const update = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm((p) => ({ ...p, [e.target.name]: e.target.value }));
    if (errors[e.target.name]) setErrors((p) => ({ ...p, [e.target.name]: "" }));
  };

  const validate = () => {
    const next: Record<string, string> = {};
    if (!form.name.trim()) next.name = "Please enter your name.";
    if (!form.email.trim()) next.email = "Work email is required.";
    else if (!EMAIL_RE.test(form.email.trim())) next.email = "Enter a valid email address.";
    if (!form.company.trim()) next.company = "Company is required.";
    const digits = form.phone.replace(/[^\d]/g, "");
    if (!form.phone.trim()) next.phone = "Phone number is required.";
    else if (digits.length < 7 || digits.length > 15) next.phone = "Enter a valid phone number (with country code).";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTopError("");
    if (!validate()) return;
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, source: "design-partner" }),
      });
      const data = await res.json();
      if (!res.ok || data.success === false) throw new Error(data.error || "Submission failed");
      posthog.identify(form.email, { name: form.name, company: form.company });
      posthog.capture("demo_requested", {
        company: form.company,
        team_size: form.teamSize,
        source: "design-partner",
      });
      setSubmitted(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Something went wrong. Please try again.";
      posthog.capture("demo_request_failed", { error: message });
      posthog.captureException(err);
      setTopError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const inputClass = (k: string) =>
    `w-full rounded-none border bg-white/[0.03] px-4 py-3 text-[15px] text-white placeholder:text-white/25 outline-none transition-colors duration-300 focus:border-white/45 ${
      errors[k] ? "border-red-400/60 focus:border-red-400/60" : "border-white/14"
    }`;

  const freeEmailHint =
    form.email.includes("@") && FREE_EMAIL.includes(form.email.split("@")[1]?.toLowerCase())
      ? "A work email gets you a faster response."
      : "";

  return (
    <main
      className={`${inter.variable} ${fraunces.variable} cwa-root relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-black p-4 text-white`}
    >
      <style>{`
        .cwa-root { font-family: var(--cwl-font), ui-sans-serif, system-ui, -apple-system, sans-serif; -webkit-font-smoothing: antialiased; }
        .cwa-display { font-family: var(--cwl-serif), Georgia, 'Times New Roman', serif; font-optical-sizing: auto; }
        .cwa-iri { position: absolute; inset: -20% -10%; filter: blur(100px); opacity: 0.5; pointer-events: none; }
        .cwa-blob { position: absolute; border-radius: 50%; mix-blend-mode: screen; }
        @keyframes cwaDriftA { 0%,100% { transform: translate(0,0) scale(1); } 50% { transform: translate(6%, 5%) scale(1.1); } }
        @keyframes cwaDriftB { 0%,100% { transform: translate(0,0) scale(1.05); } 50% { transform: translate(-7%, -4%) scale(0.95); } }
        .cwa-a { animation: cwaDriftA 22s ease-in-out infinite; }
        .cwa-b { animation: cwaDriftB 26s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) { .cwa-a, .cwa-b { animation: none; } }
      `}</style>

      {/* Atmospheric iridescent glow — the one chromatic gesture, kept dim. */}
      <div className="cwa-iri" aria-hidden>
        <div
          className="cwa-blob cwa-a"
          style={{ width: "42vw", height: "42vw", left: "-4%", top: "0%", background: "radial-gradient(circle, rgba(160,224,171,0.45), transparent 62%)" }}
        />
        <div
          className="cwa-blob cwa-b"
          style={{ width: "40vw", height: "40vw", left: "58%", top: "30%", background: "radial-gradient(circle, rgba(165,45,37,0.5), transparent 62%)" }}
        />
      </div>
      <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/80 to-black" aria-hidden />

      {/* Close */}
      <button
        onClick={() => router.push("/landing")}
        aria-label="Close"
        className="fixed right-5 top-5 z-50 flex h-10 w-10 items-center justify-center rounded-full border border-white/15 text-white/70 transition-colors duration-300 hover:border-white/40 hover:text-white"
      >
        <X className="h-4 w-4" />
      </button>

      <div className="relative z-10 mx-auto my-12 w-full max-w-[560px]">
        {/* Brand lockup */}
        <Link href="/landing" className="mb-8 flex items-baseline justify-center text-[15px] tracking-[-0.02em]">
          <span className="font-semibold text-white">Context&nbsp;Window</span>
          <span className="font-normal text-white/45">&nbsp;\&nbsp;HQ</span>
        </Link>

        <div className="border border-white/12 bg-white/[0.02] p-7 backdrop-blur-xl sm:p-10">
          <AnimatePresence mode="wait">
            {!submitted ? (
              <motion.form
                key="form"
                onSubmit={handleSubmit}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.6, ease: [0.19, 1, 0.22, 1] }}
                className="space-y-8"
              >
                <div className="space-y-4">
                  <p className="text-[11px] uppercase tracking-[0.24em] text-white/40">
                    Research &amp; Design Partner Program
                  </p>
                  <h1 className="cwa-display text-[clamp(2rem,6vw,2.9rem)] font-light leading-[1.02] tracking-[-0.02em]">
                    Start a conversation.
                  </h1>
                  <p className="max-w-md text-[15px] leading-[1.55] text-white/55">
                    We work with a small number of founders and enterprise teams as
                    design partners. Tell us a little about you, and we&apos;ll be in
                    touch.
                  </p>
                </div>

                <div className="space-y-5">
                  <div className="space-y-1.5">
                    <label htmlFor="name" className="block text-[12px] uppercase tracking-[0.14em] text-white/50">
                      Full name <span className="text-white/35">*</span>
                    </label>
                    <input id="name" name="name" value={form.name} onChange={update} placeholder="Emma Crown" className={inputClass("name")} />
                    {errors.name && <p className="text-xs text-red-400">{errors.name}</p>}
                  </div>

                  <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <label htmlFor="email" className="block text-[12px] uppercase tracking-[0.14em] text-white/50">
                        Work email <span className="text-white/35">*</span>
                      </label>
                      <input id="email" name="email" type="email" value={form.email} onChange={update} placeholder="emma@company.com" className={inputClass("email")} />
                      {errors.email ? (
                        <p className="text-xs text-red-400">{errors.email}</p>
                      ) : (
                        freeEmailHint && <p className="text-xs text-white/40">{freeEmailHint}</p>
                      )}
                    </div>
                    <div className="space-y-1.5">
                      <label htmlFor="company" className="block text-[12px] uppercase tracking-[0.14em] text-white/50">
                        Company <span className="text-white/35">*</span>
                      </label>
                      <input id="company" name="company" value={form.company} onChange={update} placeholder="Acme Inc." className={inputClass("company")} />
                      {errors.company && <p className="text-xs text-red-400">{errors.company}</p>}
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label htmlFor="phone" className="block text-[12px] uppercase tracking-[0.14em] text-white/50">
                      Phone number <span className="text-white/35">*</span>
                    </label>
                    <input id="phone" name="phone" type="tel" inputMode="tel" value={form.phone} onChange={update} placeholder="+1 555 123 4567" className={inputClass("phone")} />
                    {errors.phone ? (
                      <p className="text-xs text-red-400">{errors.phone}</p>
                    ) : (
                      <p className="text-xs text-white/40">Include your country code so we can reach you.</p>
                    )}
                  </div>

                  <div className="space-y-2.5">
                    <label className="block text-[12px] uppercase tracking-[0.14em] text-white/50">Team size</label>
                    <div className="flex flex-wrap gap-2.5">
                      {TEAM_SIZES.map((t) => (
                        <button
                          key={t}
                          type="button"
                          onClick={() => setForm((p) => ({ ...p, teamSize: p.teamSize === t ? "" : t }))}
                          className={`rounded-[75px] border px-5 py-2 text-[14px] transition-colors duration-300 ${
                            form.teamSize === t
                              ? "border-white/70 bg-white/10 text-white"
                              : "border-white/15 text-white/60 hover:border-white/40 hover:text-white"
                          }`}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label htmlFor="message" className="block text-[12px] uppercase tracking-[0.14em] text-white/50">
                      What makes context hard to hold onto for your team? <span className="text-white/30">(optional)</span>
                    </label>
                    <textarea
                      id="message"
                      name="message"
                      value={form.message}
                      onChange={update}
                      rows={3}
                      placeholder="e.g. decisions lose their reasoning, or knowledge leaves when people do."
                      className="w-full resize-none rounded-none border border-white/14 bg-white/[0.03] px-4 py-3 text-[15px] text-white placeholder:text-white/25 outline-none transition-colors duration-300 focus:border-white/45"
                    />
                  </div>
                </div>

                {topError && (
                  <div className="rounded-none border border-red-500/30 bg-red-950/20 p-3 text-sm text-red-400">{topError}</div>
                )}

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex w-full items-center justify-center gap-2 rounded-[75px] bg-white py-4 text-[15px] font-medium text-black transition-all duration-300 hover:bg-white/90 disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" /> Sending…
                    </>
                  ) : (
                    <>
                      Request a conversation <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </button>

                <p className="text-center text-[11px] leading-relaxed text-white/35">
                  No spam. We&apos;ll only use your details to follow up on your note.
                </p>
              </motion.form>
            ) : (
              <motion.div
                key="success"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, ease: [0.19, 1, 0.22, 1] }}
                className="flex flex-col items-center justify-center space-y-6 py-10 text-center"
              >
                <div className="flex h-16 w-16 items-center justify-center rounded-full border border-white/20">
                  <Check className="h-7 w-7 text-white" />
                </div>
                <h2 className="cwa-display text-[clamp(1.9rem,5vw,2.6rem)] font-light tracking-[-0.02em]">
                  Thank you.
                </h2>
                <p className="max-w-md text-[15px] leading-[1.6] text-white/60">
                  We&apos;ve got your note{form.name ? `, ${form.name.split(" ")[0]}` : ""}. Someone from
                  Context Window HQ will reach out shortly.
                </p>
                <Link
                  href="/landing"
                  className="mt-2 inline-flex items-center justify-center rounded-[75px] border border-white/25 px-7 py-3 text-[14px] text-white/90 transition-colors duration-300 hover:border-white/60"
                >
                  Back to home
                </Link>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="mt-6 text-center text-[11px] uppercase tracking-[0.24em] text-white/30">
          Context Window HQ · Research &amp; Design Partner Program
        </div>
      </div>
    </main>
  );
}
