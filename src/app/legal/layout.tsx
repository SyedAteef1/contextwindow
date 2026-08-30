import type { ReactNode } from "react";
import Link from "next/link";

import { Wordmark } from "@/components/marketing/wordmark";

/**
 * Chrome for the legal pages.
 *
 * Shared by `/privacy` and `/terms`, which Google's OAuth verification requires
 * to be reachable, on the app's own domain, and specific about what each scope
 * is used for — a generic template is one of the more common rejection reasons.
 *
 * Set on the same palette as the landing page rather than the usual unstyled
 * legal boilerplate: a policy that looks like it belongs to the product reads
 * as something the company wrote, not something it downloaded.
 */
export default function LegalLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-ground text-ink">
      <header className="border-b border-rule">
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between px-4 sm:px-6">
          <Link href="/" className="transition-opacity hover:opacity-80" aria-label="Context Window">
            <Wordmark />
          </Link>
          <nav className="flex items-center gap-1">
            {[
              { label: "Privacy", href: "/privacy" },
              { label: "Terms", href: "/terms" },
            ].map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded px-3 py-2 text-sm text-muted transition-colors hover:bg-surface hover:text-ink"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:py-24">{children}</main>

      <footer className="border-t border-rule py-10">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-4 sm:px-6">
          <Wordmark />
          <Link href="/" className="font-mono text-xs text-faint hover:text-muted">
            contextwindowhq.com
          </Link>
        </div>
      </footer>
    </div>
  );
}
