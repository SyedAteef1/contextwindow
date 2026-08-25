"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";

/**
 * Sign out.
 *
 * The route is POST-only on purpose — a GET logout can be triggered by any
 * image tag or prefetch on a page the rep visits, which would sign them out at
 * random. That means this cannot be a plain link.
 */
export function LogoutButton() {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);

  return (
    <button
      type="button"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          await fetch("/api/auth/logout", { method: "POST" });
          startTransition(() => {
            router.replace("/");
            router.refresh();
          });
        } finally {
          setBusy(false);
        }
      }}
      className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-faint transition-colors hover:text-ink disabled:opacity-50"
    >
      <LogOut className="size-3" aria-hidden />
      {busy ? "Signing out…" : "Sign out"}
    </button>
  );
}
