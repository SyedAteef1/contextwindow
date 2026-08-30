/** Small presentational pieces shared across pages. */
import Link from "next/link";
import type { ReactNode } from "react";

import { cn } from "@/lib/cn";
import { signalStrength } from "@/lib/format";

/** Buying interest as four segments. The only place amber is used for strength. */
export function SignalMeter({
  interest,
  showLabel = true,
}: {
  interest: string | null | undefined;
  showLabel?: boolean;
}) {
  const filled = signalStrength(interest);
  const label = interest ?? "none";

  return (
    <span className="inline-flex items-center gap-2">
      <span
        className="meter"
        role="img"
        aria-label={`Buying interest: ${label}`}
      >
        {[0, 1, 2, 3].map((index) => (
          <span key={index} data-on={index < filled} />
        ))}
      </span>
      {showLabel && (
        <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted">
          {label}
        </span>
      )}
    </span>
  );
}

type Tone = "neutral" | "signal" | "flag" | "live" | "quiet";

const TONE_CLASS: Record<Tone, string> = {
  neutral: "border-rule bg-surface text-ink-soft",
  signal: "border-transparent bg-signal/10 text-signal",
  flag: "border-transparent bg-flag/10 text-flag",
  live: "border-transparent bg-live/10 text-live",
  quiet: "border-transparent bg-sunken text-muted",
};

export function Pill({
  children,
  tone = "neutral",
  className,
}: {
  children: ReactNode;
  tone?: Tone;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-[3px]",
        "font-mono text-[10px] font-medium uppercase tracking-[0.1em] whitespace-nowrap",
        TONE_CLASS[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function LiveDot() {
  return <span className="pulse-live inline-block h-1.5 w-1.5 rounded-full bg-live" />;
}

export function Eyebrow({ children }: { children: ReactNode }) {
  return <p className="eyebrow">{children}</p>;
}

export function Card({
  children,
  className,
  as: Tag = "div",
}: {
  children: ReactNode;
  className?: string;
  as?: "div" | "section" | "article";
}) {
  return (
    <Tag className={cn("rounded-lg border border-rule bg-surface", className)}>{children}</Tag>
  );
}

/** An empty state is an invitation to act, so it always names the next step. */
export function Empty({
  title,
  children,
  action,
}: {
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-lg border border-dashed border-rule bg-surface/60 px-6 py-10 text-center">
      <p className="font-display text-[15px] font-semibold text-ink">{title}</p>
      {children && <p className="mx-auto mt-1.5 max-w-md text-[13.5px] text-muted">{children}</p>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}

export function Button({
  children,
  variant = "primary",
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
}) {
  const styles = {
    primary: "bg-ink text-ground hover:bg-ink-soft",
    secondary: "border border-rule bg-surface text-ink hover:bg-sunken",
    ghost: "text-muted hover:text-ink hover:bg-sunken",
    danger: "border border-rule bg-surface text-flag hover:bg-flag/10",
  }[variant];

  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-1.5 rounded-md px-3.5 py-2",
        "text-[13px] font-medium transition-colors",
        "disabled:cursor-not-allowed disabled:opacity-50",
        styles,
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export function BackLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-faint transition-colors hover:text-ink"
    >
      <span aria-hidden>←</span>
      {children}
    </Link>
  );
}
