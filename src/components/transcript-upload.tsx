"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Button, Eyebrow } from "./ui";

/**
 * Paste a transcript to run the wrap-up.
 *
 * The escape hatch that makes the product work before any bot is wired up, and
 * the recovery path when a bot fails to join.
 */
export function TranscriptUpload({ meetingId }: { meetingId: string }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function submit() {
    if (!text.trim()) return;
    setBusy(true);
    setError(null);
    setNotice(null);

    try {
      const response = await fetch(`/api/meetings/${meetingId}/transcript`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rawText: text, source: "pasted" }),
      });
      const data = await response.json();

      if (response.status === 402) {
        // Stored and indexed, but the summary was skipped on quota.
        setNotice(data.skippedReason ?? "Free tier limit reached for this account.");
        startTransition(() => router.refresh());
        return;
      }
      if (!response.ok) throw new Error(data.error ?? data.detail ?? "Could not process transcript");

      setText("");
      startTransition(() => router.refresh());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not process transcript");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-lg border border-dashed border-rule bg-surface px-5 py-4">
      <Eyebrow>Add the transcript</Eyebrow>
      <p className="mt-1.5 text-[13.5px] text-muted">
        Paste the call transcript and the summary, buying signals, and follow-up draft are
        generated from it. Lines like <code className="font-mono text-[12px]">Priya: …</code> keep
        speaker attribution.
      </p>

      <textarea
        value={text}
        onChange={(event) => setText(event.target.value)}
        rows={8}
        placeholder={"Speaker name: what they said\nOther speaker: what they said next"}
        className="mt-3 w-full rounded-md border border-rule bg-ground/40 px-3 py-2.5 font-mono text-[12.5px] leading-relaxed text-ink placeholder:text-faint"
      />

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <Button onClick={submit} disabled={busy || !text.trim()}>
          {busy ? "Writing summary…" : "Process transcript"}
        </Button>
        <span className="text-[12.5px] text-faint">
          This counts as one processed meeting against the free tier.
        </span>
      </div>

      {notice && <p className="mt-3 text-[13px] text-signal">{notice}</p>}
      {error && <p className="mt-3 text-[13px] text-flag">{error}</p>}
    </div>
  );
}
