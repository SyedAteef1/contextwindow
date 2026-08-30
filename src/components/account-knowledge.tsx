"use client";

import { useState } from "react";

import { Eyebrow, Pill } from "./ui";
import { cn } from "@/lib/cn";

type Doc = {
  id: string;
  title: string;
  content: string;
  kind: string;
  updatedAt?: string;
};

const KINDS = [
  { value: "other", label: "Note" },
  { value: "product", label: "Product" },
  { value: "pricing", label: "Pricing" },
  { value: "positioning", label: "Positioning" },
  { value: "case_study", label: "Case study" },
  { value: "objection", label: "Objection" },
] as const;

/**
 * What you know about this company, in your own words.
 *
 * Calls produce most of an account's knowledge, but not all of it: how their
 * procurement works, who actually decides, what a colleague heard at a
 * conference. None of that is on a recording, and without somewhere to put it
 * the assistant answers confidently from half the picture.
 *
 * Saved notes are chunked and embedded exactly like a transcript, so they are
 * retrieved the same way and cited the same way — the difference is only where
 * they came from.
 */
export function AccountKnowledge({
  accountId = null,
  companyName,
  initial,
}: {
  /** Null for the seller's own material, which applies to every account. */
  accountId?: string | null;
  companyName: string;
  initial: Doc[];
}) {
  const [docs, setDocs] = useState<Doc[]>(initial);
  const [editing, setEditing] = useState<Doc | null>(null);
  const [composing, setComposing] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [kind, setKind] = useState<string>("other");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function open(doc?: Doc) {
    setEditing(doc ?? null);
    setTitle(doc?.title ?? "");
    setContent(doc?.content ?? "");
    setKind(doc?.kind ?? "other");
    setError(null);
    setComposing(true);
  }

  function close() {
    setComposing(false);
    setEditing(null);
    setTitle("");
    setContent("");
    setKind("other");
  }

  async function save() {
    if (!title.trim() || !content.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/knowledge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: editing?.id, accountId, title, content, kind }),
      });
      if (!response.ok) {
        const detail = await response.json().catch(() => null);
        throw new Error(detail?.error ?? "Could not save that note");
      }
      const { document } = await response.json();
      setDocs((current) => {
        const without = current.filter((doc) => doc.id !== document.id);
        return [...without, document].sort((a, b) => a.title.localeCompare(b.title));
      });
      close();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save that note");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    // Optimistic: the row goes now and comes back only if the server refuses.
    const previous = docs;
    setDocs((current) => current.filter((doc) => doc.id !== id));
    try {
      const response = await fetch(`/api/knowledge/${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error();
    } catch {
      setDocs(previous);
      setError("Could not delete that note");
    }
  }

  return (
    <section className="rounded-lg border border-rule bg-surface">
      <div className="flex items-center justify-between gap-3 border-b border-rule-soft px-5 py-3.5">
        <div className="flex min-w-0 items-center gap-2.5">
          <Eyebrow>What we know about {companyName}</Eyebrow>
          {docs.length > 0 && <Pill tone="quiet">{docs.length}</Pill>}
        </div>
        {!composing && (
          <button
            type="button"
            onClick={() => open()}
            className="shrink-0 rounded-md border border-rule px-3 py-1.5 text-[12.5px] text-ink transition-colors hover:border-faint"
          >
            Add a note
          </button>
        )}
      </div>

      {composing && (
        <div className="border-b border-rule-soft px-5 py-4">
          <div className="flex flex-col gap-2.5">
            <div className="flex gap-2">
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="What is this about? e.g. How their procurement works"
                className="min-w-0 flex-1 rounded border border-rule bg-sunken px-3 py-2 text-[13.5px] text-ink outline-none placeholder:text-faint focus:border-faint"
              />
              <select
                value={kind}
                onChange={(event) => setKind(event.target.value)}
                className="shrink-0 rounded border border-rule bg-sunken px-2 py-2 text-[12.5px] text-ink outline-none focus:border-faint"
              >
                {KINDS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <textarea
              value={content}
              onChange={(event) => setContent(event.target.value)}
              rows={6}
              placeholder={`Anything that is true about ${companyName} but was never said on a recorded call — who really decides, how their security review runs, what a competitor told them.`}
              className="w-full resize-y rounded border border-rule bg-sunken px-3 py-2 text-[13.5px] leading-relaxed text-ink outline-none placeholder:text-faint focus:border-faint"
            />

            {error && <p className="text-[12.5px] text-flag">{error}</p>}

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={close}
                className="rounded-md px-3 py-1.5 text-[12.5px] text-muted transition-colors hover:text-ink"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={save}
                disabled={busy || !title.trim() || !content.trim()}
                className="rounded-md bg-ink px-3.5 py-2 text-[12.5px] font-medium text-ground transition-colors hover:bg-ink-soft disabled:opacity-40"
              >
                {busy ? "Saving…" : editing ? "Save changes" : "Save note"}
              </button>
            </div>
          </div>
        </div>
      )}

      {docs.length === 0 && !composing ? (
        <p className="px-5 py-6 text-[13px] leading-relaxed text-muted">
          Nothing filed yet. Notes added here are searched during a call alongside the
          transcripts, so anything true about {companyName} that never made it onto a
          recording belongs here.
        </p>
      ) : (
        <ul className="divide-y divide-rule-soft">
          {docs.map((doc) => (
            <li key={doc.id} className="group px-5 py-3.5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="flex items-center gap-2 text-[13.5px] font-medium text-ink">
                    <span className="truncate">{doc.title}</span>
                    <span className="shrink-0 font-mono text-[9.5px] uppercase tracking-[0.1em] text-faint">
                      {KINDS.find((option) => option.value === doc.kind)?.label ?? doc.kind}
                    </span>
                  </p>
                  <p className="mt-1 line-clamp-2 text-[12.5px] leading-relaxed text-muted">
                    {doc.content}
                  </p>
                </div>
                <div
                  className={cn(
                    "flex shrink-0 gap-1 opacity-0 transition-opacity",
                    "group-hover:opacity-100 focus-within:opacity-100",
                  )}
                >
                  <button
                    type="button"
                    onClick={() => open(doc)}
                    className="rounded px-2 py-1 text-[11.5px] text-muted transition-colors hover:text-ink"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(doc.id)}
                    className="rounded px-2 py-1 text-[11.5px] text-muted transition-colors hover:text-flag"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
