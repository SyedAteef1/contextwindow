/** App shell: a thin masthead and the page container. */
import Link from "next/link";

import { Mark } from "@/components/marketing/wordmark";
import { LogoutButton } from "./logout-button";
import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

function NavLink({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <Link
      href={href}
      className={cn(
        "relative py-1 font-mono text-[10px] uppercase tracking-[0.14em] transition-colors",
        active ? "text-ink" : "text-faint hover:text-ink-soft",
      )}
    >
      {label}
      {active && <span className="absolute -bottom-px left-0 h-px w-full bg-signal" />}
    </Link>
  );
}

export function Masthead({ current }: { current?: "meetings" | "accounts" }) {
  return (
    <header className="sticky top-0 z-20 border-b border-rule bg-ground/85 backdrop-blur-sm">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-3.5">
        <Link href="/meetings" className="group flex items-center gap-2.5">
          {/* Same mark as the marketing page: signing in should not feel
              like arriving at a different product. */}
          <Mark className="size-4 text-muted" />
          <span className="font-display text-[15px] font-bold tracking-[-0.02em] text-ink">
            Context&nbsp;Window
          </span>
          <span className="h-[9px] w-px bg-rule" aria-hidden />
          <span className="font-mono text-[9.5px] uppercase tracking-[0.16em] text-faint">
            Call intelligence
          </span>
        </Link>

        <nav className="flex items-center gap-6">
          <NavLink href="/meetings" label="Meetings" active={current === "meetings"} />
          <NavLink href="/accounts" label="Accounts" active={current === "accounts"} />
          <span className="ml-2 border-l border-rule pl-6">
            <LogoutButton />
          </span>
        </nav>
      </div>
    </header>
  );
}

export function Page({
  children,
  current,
  className,
  sidebar,
}: {
  children: ReactNode;
  current?: "meetings" | "accounts";
  className?: string;
  /** Persistent navigation down the left. Collapses away below `lg`. */
  sidebar?: ReactNode;
}) {
  if (!sidebar) {
    return (
      <div className="min-h-dvh">
        <Masthead current={current} />
        <main className={cn("mx-auto max-w-5xl px-6 pt-9 pb-24", className)}>{children}</main>
      </div>
    );
  }

  return (
    <div className="min-h-dvh">
      <Masthead current={current} />
      <div className="flex">
        {sidebar}
        <main className={cn("min-w-0 flex-1 px-6 pt-9 pb-24", className)}>
          <div className="mx-auto max-w-4xl">{children}</div>
        </main>
      </div>
    </div>
  );
}

/** Page title block: an eyebrow, a heading, and an optional action. */
export function PageHead({
  eyebrow,
  title,
  meta,
  action,
}: {
  eyebrow: string;
  title: string;
  meta?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="mb-9 flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="eyebrow mb-2">{eyebrow}</p>
        <h1 className="font-display text-[30px] font-bold tracking-[-0.028em] text-ink">
          {title}
        </h1>
        {meta && <div className="mt-2 text-[13.5px] text-muted">{meta}</div>}
      </div>
      {action}
    </div>
  );
}
