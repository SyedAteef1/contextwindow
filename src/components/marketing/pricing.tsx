import Link from "next/link";
import { Check } from "lucide-react";

import { cn } from "@/lib/cn";

/**
 * Pricing.
 *
 * ─── CHANGE THE PRICE HERE ────────────────────────────────────────────────
 * Nothing else in the codebase knows what this costs: there is no billing
 * integration, and by design. Upgrading is a conversation — every team gets
 * our engineers for setup — so "Request the bot" posts to `demo_requests` and
 * a human flips `workspaces.plan` to `pro` afterwards.
 *
 * `FREE_BRIEFS` must match the `brief_limit` default in the schema, which is
 * what the running meter actually enforces.
 *
 * This is a server component. It was a client one, for a monthly/yearly toggle
 * that fired confetti — which cost three client dependencies to imply a
 * self-serve checkout that does not exist. The split it now describes is not a
 * quantity of meetings but a difference in kind: research is free, and the bot
 * in the room is what you pay for.
 */
const MONTHLY = 39;
const FREE_BRIEFS = 25;

const PLANS = [
  {
    name: "Free",
    price: "$0",
    unit: "forever",
    description: "Research before every call. Nothing installed, no bot in the room.",
    cta: "Connect your calendar",
    href: "/api/auth/google/start",
    features: [
      "Calendar synced automatically — no links to paste",
      "A cited brief on every external meeting",
      "In your inbox days before you dial in",
      "How each attendee decides, and what they fear",
      `${FREE_BRIEFS} briefs a month`,
    ],
  },
  {
    name: "Pro",
    price: `$${MONTHLY}`,
    unit: "/user/mo",
    description: "The bot in the room, and the answer while the buyer is still talking.",
    cta: "Request the bot",
    href: "#demo",
    highlighted: true,
    features: [
      "Everything in Free",
      "Notetaker joins every external call",
      "Live answers on your screen in under a second",
      "Hesitation and objection alerts as they happen",
      "Summary and follow-up drafted, one click to send",
      "Live sharing with your engineer · private beta",
    ],
  },
];

export function Pricing() {
  return (
    <section id="pricing" className="border-t border-rule py-24 lg:py-32">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-2xl flex-col gap-3 text-center">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted">Pricing</p>
          <h2 className="text-4xl font-semibold leading-tight tracking-tighter text-ink sm:text-5xl">
            The research is free. Pay for the room.
          </h2>
          <p className="text-base leading-relaxed text-muted">
            Connect a calendar and briefs start arriving — no card, no bot in anyone&rsquo;s
            meeting, nothing to install. You pay when you want us in the call with you.
          </p>
        </div>

        <div className="mx-auto mt-14 grid max-w-4xl grid-cols-1 gap-6 md:grid-cols-2">
          {PLANS.map((plan) => (
            <div
              key={plan.name}
              className={cn(
                "flex flex-col rounded border p-8 transition-colors duration-150 ease-out",
                plan.highlighted
                  ? "border-cobalt/40 bg-surface hover:border-cobalt/60"
                  : "border-rule bg-surface hover:border-muted/25",
              )}
            >
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-base font-semibold tracking-tight text-ink">{plan.name}</h3>
                {plan.highlighted && (
                  <span className="rounded border border-live/30 bg-live/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-widest text-live">
                    The live part
                  </span>
                )}
              </div>

              <p className="mt-2 text-sm leading-relaxed text-muted">{plan.description}</p>

              <div className="mt-6 flex items-baseline gap-1.5">
                <span className="text-4xl font-semibold tracking-tighter tabular-nums text-ink">
                  {plan.price}
                </span>
                <span className="text-xs text-faint">{plan.unit}</span>
              </div>

              <ul className="mt-8 flex flex-1 flex-col gap-3 border-t border-dashed border-rule pt-6">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex gap-2.5">
                    <Check
                      className={cn(
                        "mt-0.5 size-3.5 shrink-0",
                        plan.highlighted ? "text-cobalt-bright" : "text-faint",
                      )}
                    />
                    <span className="text-sm leading-snug text-ink-soft">{feature}</span>
                  </li>
                ))}
              </ul>

              <Link
                href={plan.href}
                className={cn(
                  "mt-8 inline-flex items-center justify-center rounded px-5 py-3 text-sm transition-[transform,border-color,box-shadow] duration-150 ease-out active:scale-[0.97]",
                  plan.highlighted
                    ? "bg-cobalt-deep font-semibold text-ink shadow-[0_0_28px_-10px_var(--color-cobalt)] hover:shadow-[0_0_36px_-8px_var(--color-cobalt)]"
                    : "border border-rule font-medium text-ink-soft hover:border-muted/40 hover:text-ink",
                )}
              >
                {plan.cta}
              </Link>
            </div>
          ))}
        </div>

        <p className="mx-auto mt-8 max-w-xl text-center text-xs leading-relaxed text-faint">
          Billing is not switched on yet — Pro is what it will cost. Every team gets our engineers
          for setup, which is why we onboard a handful a month rather than opening a checkout.
        </p>
      </div>
    </section>
  );
}
