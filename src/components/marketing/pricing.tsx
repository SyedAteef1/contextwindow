"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import NumberFlow from "@number-flow/react";
import confetti from "canvas-confetti";
import { Check, Star } from "lucide-react";
import { motion } from "motion/react";

import { cn } from "@/lib/cn";

/**
 * Pricing.
 *
 * ─── CHANGE THE PRICE HERE ────────────────────────────────────────────────
 * Nothing else in the codebase knows what this costs: there is no billing
 * integration yet, so these two numbers are the whole of it. `FREE_MEETINGS`
 * must match FREE_TIER_MEETING_LIMIT in src/lib/env.ts, which is what the
 * running meter actually enforces.
 */
const MONTHLY = 39;
const YEARLY = 32; // billed annually, ~18% off
const FREE_MEETINGS = 5;

const PLANS = [
  {
    name: "Free",
    monthly: 0,
    yearly: 0,
    description: "Enough to see whether it earns its place.",
    cta: "Connect your calendar",
    features: [
      `${FREE_MEETINGS} meetings a month`,
      "Cited pre-call briefs",
      "Live answers during the call",
      "Recap email and follow-up drafts",
      "Chat with any account's history",
    ],
  },
  {
    name: "Pro",
    monthly: MONTHLY,
    yearly: YEARLY,
    description: "For a rep whose calendar is the job.",
    cta: "Start free, upgrade later",
    highlighted: true,
    features: [
      "Unlimited meetings",
      "Everything in Free",
      "Priority research before every call",
      "Full account history, no cap",
      "Email support",
    ],
  },
];

export function Pricing() {
  const [yearly, setYearly] = useState(false);
  const toggleRef = useRef<HTMLDivElement>(null);

  /** A small reward for finding the cheaper option. Fires only on the way in. */
  function choose(next: boolean) {
    setYearly(next);
    if (!next || !toggleRef.current) return;

    // Respect a reader who has asked the interface to sit still.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const box = toggleRef.current.getBoundingClientRect();
    confetti({
      particleCount: 40,
      spread: 60,
      startVelocity: 22,
      gravity: 0.9,
      scalar: 0.7,
      ticks: 120,
      colors: ["#b45309", "#047857", "#10151c"],
      origin: {
        x: (box.left + box.width / 2) / window.innerWidth,
        y: (box.top + box.height / 2) / window.innerHeight,
      },
    });
  }

  return (
    <section className="border-t border-white/10 py-24 lg:py-32">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-2xl flex-col gap-3 text-center">
          <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500">Pricing</p>
          <h2 className="text-4xl font-semibold leading-tight tracking-tighter text-white sm:text-5xl">
            Start free. Pay when it is doing the work.
          </h2>
          <p className="text-base leading-relaxed text-zinc-400">
            Five meetings a month, free, with nothing held back. No card until you decide it is
            worth paying for.
          </p>
        </div>

      {/* --- Billing period ------------------------------------------------ */}
      <div className="mt-12 flex justify-center">
        <div
          ref={toggleRef}
          className="relative flex items-center rounded border border-white/10 bg-zinc-900/50 p-1"
        >
          {[
            { label: "Monthly", value: false },
            { label: "Yearly", value: true },
          ].map((option) => (
            <button
              key={option.label}
              type="button"
              onClick={() => choose(option.value)}
              className={cn(
                "relative rounded px-4 py-1.5 text-sm font-medium transition-colors duration-150 ease-out",
                yearly === option.value ? "text-zinc-950" : "text-zinc-400 hover:text-white",
              )}
            >
              {yearly === option.value && (
                <motion.span
                  layoutId="billing-pill"
                  className="absolute inset-0 rounded bg-white"
                  transition={{ type: "spring", bounce: 0.2, duration: 0.5 }}
                />
              )}
              <span className="relative">{option.label}</span>
            </button>
          ))}
        </div>
      </div>
      <p className="mt-3 text-center text-xs uppercase tracking-widest text-zinc-600">
        Yearly saves about 18%
      </p>

      {/* --- Plans --------------------------------------------------------- */}
      <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-2">
        {PLANS.map((plan) => (
          <div
            key={plan.name}
            className={cn(
              "flex flex-col rounded border p-8 transition-colors duration-150 ease-out",
              plan.highlighted
                ? "border-amber-500/25 bg-zinc-900/50 hover:border-amber-500/40"
                : "border-white/10 bg-zinc-900/50 hover:border-white/20",
            )}
          >
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-base font-semibold tracking-tight text-white">
                {plan.name}
              </h3>
              {plan.highlighted && (
                <span className="inline-flex items-center gap-1.5 rounded border border-amber-500/20 bg-amber-500/10 px-2.5 py-1 text-xs font-semibold uppercase tracking-widest text-amber-400">
                  <Star className="size-3 fill-current" />
                  Most useful
                </span>
              )}
            </div>

            <p className="mt-2 text-sm leading-relaxed text-zinc-400">{plan.description}</p>

            <div className="mt-6 flex items-baseline gap-1.5">
              <span className="text-4xl font-semibold tracking-tighter text-white">
                $
                <NumberFlow value={yearly ? plan.yearly : plan.monthly} className="tabular-nums" />
              </span>
              <span className="text-xs text-zinc-600">
                {plan.monthly === 0 ? "forever" : yearly ? "/user/mo, billed yearly" : "/user/mo"}
              </span>
            </div>

            <ul className="mt-8 flex flex-1 flex-col gap-3 border-t border-dashed border-white/10 pt-6">
              {plan.features.map((feature) => (
                <li key={feature} className="flex gap-2.5">
                  <Check
                    className={cn(
                      "mt-0.5 size-3.5 shrink-0",
                      plan.highlighted ? "text-amber-400" : "text-zinc-500",
                    )}
                  />
                  <span className="text-sm leading-snug text-zinc-300">{feature}</span>
                </li>
              ))}
            </ul>

            <Link
              href="/api/auth/google/start"
              className={cn(
                "mt-8 inline-flex items-center justify-center rounded px-5 py-3 text-sm font-medium transition-[transform,border-color,background-color] duration-150 ease-out active:scale-[0.97]",
                plan.highlighted
                  ? "bg-white text-zinc-950"
                  : "border border-white/10 text-zinc-200 hover:border-white/20",
              )}
            >
              {plan.cta}
            </Link>
          </div>
        ))}
      </div>

      <p className="mt-8 text-center text-xs leading-relaxed text-zinc-600">
        Billing is not switched on yet. Everything is free while we are in beta — Pro pricing is
        what it will cost when it is.
      </p>
      </div>
    </section>
  );
}
