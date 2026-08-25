"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Button } from "./ui";

/** Runs the research agent on demand. Web search takes a while; say so. */
export function BriefButton({
  meetingId,
  hasBrief,
}: {
  meetingId: string;
  hasBrief: boolean;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/meetings/${meetingId}/brief`, { method: "POST" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? data.detail ?? "Research failed");
      startTransition(() => router.refresh());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Research failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <Button onClick={run} disabled={busy} variant={hasBrief ? "secondary" : "primary"}>
        {busy ? "Researching…" : hasBrief ? "Research again" : "Research this company"}
      </Button>
      {busy && (
        <p className="mt-2 text-[12.5px] text-faint">
          Searching the web and checking sources. This takes up to a minute.
        </p>
      )}
      {error && <p className="mt-2 max-w-sm text-[12.5px] text-flag">{error}</p>}
    </div>
  );
}
