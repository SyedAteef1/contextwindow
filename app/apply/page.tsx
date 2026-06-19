"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, CheckCircle2, Loader2, X, CalendarCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useRouter } from "next/navigation";

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
        body: JSON.stringify({ ...form, source: "book-a-demo" }),
      });
      const data = await res.json();
      if (!res.ok || data.success === false) throw new Error(data.error || "Submission failed");
      setSubmitted(true);
    } catch (err) {
      setTopError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const fieldClass = (k: string) =>
    `bg-white/5 border-white/10 text-white placeholder:text-white/25 ${errors[k] ? "border-red-500/60 focus-visible:ring-red-500/30" : ""}`;

  const freeEmailHint =
    form.email.includes("@") && FREE_EMAIL.includes(form.email.split("@")[1]?.toLowerCase()) ? "Tip: a work email gets you a faster response." : "";

  return (
    <main className="relative min-h-screen w-full overflow-hidden text-white font-sans selection:bg-[#4ade80]/30 flex items-center justify-center p-4">
      {/* Background Video */}
      <div className="fixed inset-0 w-full h-full z-0 pointer-events-none">
        <video autoPlay loop muted playsInline className="w-full h-full object-cover">
          <source src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260315_073750_51473149-4350-4920-ae24-c8214286f323.mp4" type="video/mp4" />
        </video>
        <div className="absolute inset-0 bg-black/85 backdrop-blur-[2px]" />
      </div>

      {/* Close Button */}
      <button
        onClick={() => router.push("/")}
        aria-label="Close"
        className="fixed top-6 right-6 z-50 w-10 h-10 liquid-glass rounded-full flex items-center justify-center hover:scale-105 transition-transform"
      >
        <X className="w-5 h-5 text-white/80" />
      </button>

      <div className="relative z-10 w-full max-w-xl mx-auto my-12">
        <div className="liquid-glass-strong rounded-[2.5rem] p-8 sm:p-10 border border-white/10 shadow-2xl">
          <AnimatePresence mode="wait">
            {!submitted ? (
              <motion.form
                key="form"
                onSubmit={handleSubmit}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6"
              >
                <div className="text-center space-y-3">
                  <div className="w-14 h-14 rounded-2xl bg-[#4ade80]/10 border border-[#4ade80]/20 flex items-center justify-center mx-auto shadow-[0_0_30px_rgba(74,222,128,0.12)]">
                    <CalendarCheck className="w-7 h-7 text-[#4ade80]" />
                  </div>
                  <h1 className="text-3xl font-medium tracking-tight">Book a demo</h1>
                  <p className="text-sm text-white/55 max-w-sm mx-auto">
                    See Context Window read your Slack and answer your team&apos;s questions. We&apos;ll reach out to schedule a 20-minute walkthrough.
                  </p>
                </div>

                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="name" className="text-white/80">Full name <span className="text-[#4ade80]">*</span></Label>
                    <Input id="name" name="name" value={form.name} onChange={update} placeholder="Emma Crown" className={fieldClass("name")} />
                    {errors.name && <p className="text-xs text-red-400">{errors.name}</p>}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="email" className="text-white/80">Work email <span className="text-[#4ade80]">*</span></Label>
                      <Input id="email" name="email" type="email" value={form.email} onChange={update} placeholder="emma@company.com" className={fieldClass("email")} />
                      {errors.email ? <p className="text-xs text-red-400">{errors.email}</p> : freeEmailHint && <p className="text-xs text-white/40">{freeEmailHint}</p>}
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="company" className="text-white/80">Company <span className="text-[#4ade80]">*</span></Label>
                      <Input id="company" name="company" value={form.company} onChange={update} placeholder="Acme Inc." className={fieldClass("company")} />
                      {errors.company && <p className="text-xs text-red-400">{errors.company}</p>}
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="phone" className="text-white/80">Phone number <span className="text-[#4ade80]">*</span></Label>
                    <Input id="phone" name="phone" type="tel" inputMode="tel" value={form.phone} onChange={update} placeholder="+1 555 123 4567" className={fieldClass("phone")} />
                    {errors.phone ? <p className="text-xs text-red-400">{errors.phone}</p> : <p className="text-xs text-white/40">Include your country code so we can reach you.</p>}
                  </div>

                  <div className="space-y-2">
                    <Label className="text-white/80">Team size</Label>
                    <div className="flex flex-wrap gap-2">
                      {TEAM_SIZES.map((t) => (
                        <button
                          key={t}
                          type="button"
                          onClick={() => setForm((p) => ({ ...p, teamSize: p.teamSize === t ? "" : t }))}
                          className={`px-4 py-2 rounded-full text-sm font-medium border transition ${
                            form.teamSize === t
                              ? "bg-[#4ade80]/15 border-[#4ade80]/40 text-[#86efac]"
                              : "bg-white/5 border-white/10 text-white/70 hover:bg-white/10"
                          }`}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="message" className="text-white/80">Anything you&apos;d like us to show? <span className="text-white/30">(optional)</span></Label>
                    <Textarea id="message" name="message" value={form.message} onChange={update} rows={3} placeholder="e.g. how it handles our Slack + CRM, or data staying in our own AWS." className="bg-white/5 border-white/10 text-white placeholder:text-white/25 resize-none" />
                  </div>
                </div>

                {topError && <div className="text-red-400 text-sm bg-red-950/20 p-3 rounded-lg border border-red-950/30">{topError}</div>}

                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full bg-[#4ade80] text-black hover:bg-[#4ade80]/90 rounded-full py-6 font-bold text-base shadow-[0_0_30px_rgba(74,222,128,0.2)] hover:scale-[1.01] transition-transform disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Sending…</>
                  ) : (
                    <>Request demo <ArrowRight className="ml-2 w-5 h-5" /></>
                  )}
                </Button>

                <p className="text-center text-[11px] text-white/35">
                  No spam. We&apos;ll only use your details to schedule and follow up on your demo.
                </p>
              </motion.form>
            ) : (
              <motion.div
                key="success"
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex flex-col items-center justify-center text-center py-10 space-y-6"
              >
                <div className="w-20 h-20 bg-[#4ade80]/15 rounded-full flex items-center justify-center shadow-[0_0_40px_rgba(74,222,128,0.2)]">
                  <CheckCircle2 className="w-10 h-10 text-[#4ade80]" />
                </div>
                <h2 className="text-3xl font-medium tracking-tight">You&apos;re on the list</h2>
                <p className="text-white/60 text-base max-w-md mx-auto">
                  Thanks{form.name ? `, ${form.name.split(" ")[0]}` : ""} — we&apos;ve got your request. Someone from Context Window will reach out shortly to schedule your demo.
                </p>
                <Button
                  onClick={() => router.push("/")}
                  className="bg-white/10 hover:bg-white/20 text-white rounded-full border border-white/10 px-8 py-2 mt-2"
                >
                  Back to home
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="text-center mt-6 text-white/40 text-xs font-mono tracking-wide">
          CONTEXT WINDOW // BOOK A DEMO
        </div>
      </div>
    </main>
  );
}
