"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Button } from "./ui";

/** Pulls the rep's calendar on demand rather than waiting for the next cron run. */
export function SyncButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function sync() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/sync", { method: "POST" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Calendar sync failed");
      startTransition(() => router.refresh());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Calendar sync failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="text-right">
      <Button onClick={sync} disabled={busy || pending} variant="secondary">
        {busy || pending ? "Checking calendar…" : "Check calendar now"}
      </Button>
      {error && <p className="mt-2 max-w-xs text-[12.5px] text-flag">{error}</p>}
    </div>
  );
}
