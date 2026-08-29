"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { cn } from "@/lib/cn";

/**
 * Jump anywhere. ⌘K.
 *
 * Ordered by *when*, not alphabetically, and that is the whole point. A rep
 * does not think "the meeting beginning with C" — they think "the one after
 * lunch", or "the call where they asked about the rollout". So results group
 * into Today, Upcoming and Past, and every row hangs a clock time in a gutter,
 * the same gutter the time rail uses on the dashboard. The palette is the rail,
 * searchable.
 *
 * The index arrives in one request the first time it opens. A rep has tens of
 * meetings rather than thousands, so filtering locally beats a debounced round
 * trip that can never feel instant.
 */

type MeetingHit = {
  id: string;
  title: string;
  company: string | null;
  domain: string | null;
  at: string;
  status: string;
};

type AccountHit = { id: string; company: string; domain: string | null; meetings: number };

type MeetingRow = {
  kind: "meeting";
  key: string;
  href: string;
  label: string;
  sub: string;
  at: Date;
  status: string;
};
type AccountRow = { kind: "account"; key: string; href: string; label: string; sub: string };
type Row = MeetingRow | AccountRow;

type Group = { heading: string; rows: Row[] };

/** Meetings the rep still has to walk into read differently from ones behind them. */
function bucketOf(at: Date, now: Date): "today" | "upcoming" | "past" {
  const sameDay =
    at.getFullYear() === now.getFullYear() &&
    at.getMonth() === now.getMonth() &&
    at.getDate() === now.getDate();
  if (sameDay) return "today";
  return at.getTime() > now.getTime() ? "upcoming" : "past";
}

const clock = (d: Date) =>
  d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
const day = (d: Date) => d.toLocaleDateString([], { day: "2-digit", month: "short" });

export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);
  const [index, setIndex] = useState<{ meetings: MeetingHit[]; accounts: AccountHit[] } | null>(null);
  const [loading, setLoading] = useState(false);
  const [navigating, startNavigation] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const indexRef = useRef(false);
  const loadingRef = useRef(false);

  /** Fetched once, then kept, so every reopen is instant. */
  const loadIndex = useCallback(() => {
    if (indexRef.current || loadingRef.current) return;
    loadingRef.current = true;
    setLoading(true);
    fetch("/api/palette")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data) return;
        indexRef.current = true;
        setIndex(data);
      })
      .catch(() => undefined)
      .finally(() => {
        loadingRef.current = false;
        setLoading(false);
      });
  }, []);

  const openPalette = useCallback(() => {
    setQuery("");
    setCursor(0);
    setOpen(true);
    loadIndex();
  }, [loadIndex]);

  // ⌘K anywhere, Escape to leave. Bound on the document so it works no matter
  // which pane has focus.
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        if (open) setOpen(false);
        else openPalette();
      }
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
    // Re-bound when `open` flips. Cheaper and plainer than mirroring state
    // into a ref, which cannot be written during render anyway.
  }, [open, openPalette]);

  const groups = useMemo<Group[]>(() => {
    if (!index) return [];
    const now = new Date();
    const q = query.trim().toLowerCase();
    const matches = (...fields: (string | null | undefined)[]) =>
      !q || fields.some((f) => f?.toLowerCase().includes(q));

    const buckets: Record<"today" | "upcoming" | "past", MeetingRow[]> = {
      today: [],
      upcoming: [],
      past: [],
    };

    for (const m of index.meetings) {
      if (!matches(m.title, m.company, m.domain)) continue;
      const at = new Date(m.at);
      buckets[bucketOf(at, now)].push({
        kind: "meeting",
        key: `m-${m.id}`,
        href: `/meetings/${m.id}`,
        label: m.title,
        sub: m.company ?? m.domain ?? "",
        at,
        status: m.status,
      });
    }

    // Today reads forwards — the next call is the one you want. History reads
    // backwards, most recent first.
    buckets.today.sort((a, b) => a.at.getTime() - b.at.getTime());
    buckets.upcoming.sort((a, b) => a.at.getTime() - b.at.getTime());
    buckets.past.sort((a, b) => b.at.getTime() - a.at.getTime());

    const accountRows: AccountRow[] = index.accounts
      .filter((a) => matches(a.company, a.domain))
      .map((a) => ({
        kind: "account",
        key: `a-${a.id}`,
        href: `/accounts/${a.id}`,
        label: a.company,
        sub: a.meetings === 1 ? "1 call" : `${a.meetings} calls`,
      }));

    return [
      { heading: "Today", rows: buckets.today },
      { heading: "Upcoming", rows: buckets.upcoming },
      { heading: "Past", rows: buckets.past.slice(0, 8) },
      { heading: "Accounts", rows: accountRows.slice(0, 6) },
    ].filter((g) => g.rows.length > 0);
  }, [index, query]);

  const flat = useMemo(() => groups.flatMap((g) => g.rows), [groups]);

  const go = useCallback(
    (row: Row | undefined) => {
      if (!row) return;
      startNavigation(() => {
        router.push(row.href);
        setOpen(false);
      });
    },
    [router],
  );

  function onInputKey(event: React.KeyboardEvent) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setCursor((c) => Math.min(c + 1, flat.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setCursor((c) => Math.max(c - 1, 0));
    } else if (event.key === "Enter") {
      event.preventDefault();
      go(flat[cursor]);
    }
  }

  // Keep the highlighted row in view when arrowing past the fold.
  useEffect(() => {
    listRef.current
      ?.querySelector('[data-active="true"]')
      ?.scrollIntoView({ block: "nearest" });
  }, [cursor]);

  if (!open) return null;

  let running = -1;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center px-4 pt-[12vh]"
      role="dialog"
      aria-modal="true"
      aria-label="Jump to a call or account"
    >
      <button
        type="button"
        aria-label="Close"
        onClick={() => setOpen(false)}
        className="absolute inset-0 cursor-default bg-ground/80 backdrop-blur-sm motion-safe:animate-[fade-in_120ms_ease-out]"
      />

      <div className="relative w-full max-w-xl overflow-hidden rounded-xl border border-rule bg-surface shadow-[0_24px_80px_-24px_rgba(0,0,0,0.9)] motion-safe:animate-[palette-in_140ms_cubic-bezier(0.2,0.7,0.3,1)]">
        {/* The frame states what the ordering is, because the ordering is the
            feature: this list is a clock, not an alphabet. */}
        {navigating && (
          <span
            aria-hidden
            className="absolute inset-x-0 top-0 h-0.5 origin-left bg-cobalt motion-safe:animate-[palette-load_600ms_ease-out_forwards]"
          />
        )}

        <div className="flex items-center gap-3 border-b border-rule px-4">
          <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-faint">
            {clock(new Date())}
          </span>
          <input
            ref={inputRef}
            autoFocus
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setCursor(0);
            }}
            onKeyDown={onInputKey}
            placeholder={navigating ? "Opening…" : "Jump to a call or account"}
            className="min-w-0 flex-1 bg-transparent py-4 text-[15px] text-ink outline-none placeholder:text-faint"
            aria-label="Search calls and accounts"
          />
          <kbd className="rounded border border-rule px-1.5 py-0.5 font-mono text-[10px] text-faint">
            esc
          </kbd>
        </div>

        <div ref={listRef} className="max-h-[52vh] overflow-y-auto py-2">
          {loading && !index && (
            <div className="px-4 py-2" aria-busy="true" aria-label="Loading your calls">
              {["w-40", "w-52", "w-32", "w-44", "w-36"].map((w, i) => (
                <div key={i} className="flex items-center gap-3 py-2">
                  <span className="shimmer h-2.5 w-11 shrink-0 rounded bg-rule/70" />
                  <span className={`shimmer h-3 rounded bg-rule/70 ${w}`} />
                </div>
              ))}
            </div>
          )}

          {index && flat.length === 0 && (
            <p className="px-4 py-6 text-center text-[13px] text-muted">
              Nothing matches &ldquo;{query}&rdquo;.
            </p>
          )}

          {groups.map((group) => (
            <div key={group.heading} className="mb-1 last:mb-0">
              <p className="px-4 pb-1 pt-2 font-mono text-[9.5px] uppercase tracking-[0.14em] text-faint">
                {group.heading}
              </p>
              <ul>
                {group.rows.map((row) => {
                  running += 1;
                  const active = running === cursor;
                  const position = running;
                  return (
                    <li key={row.key}>
                      <button
                        type="button"
                        data-active={active}
                        onMouseEnter={() => setCursor(position)}
                        onClick={() => go(row)}
                        className={cn(
                          "flex w-full items-baseline gap-3 px-4 py-2 text-left transition-colors",
                          active ? "bg-sunken" : "hover:bg-sunken/60",
                        )}
                      >
                        {/* The gutter is the rail's gutter: when it happens,
                            hung to the left of what it is. */}
                        <span className="w-11 shrink-0 text-right font-mono text-[10.5px] tabular-nums text-faint">
                          {row.kind === "meeting"
                            ? group.heading === "Today"
                              ? clock(row.at)
                              : day(row.at)
                            : "—"}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-[13.5px] text-ink-soft">
                          {row.label}
                        </span>
                        {row.sub && (
                          <span className="shrink-0 text-[11.5px] text-faint">{row.sub}</span>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-4 border-t border-rule px-4 py-2 font-mono text-[10px] text-faint">
          <span>↑↓ move</span>
          <span>↵ open</span>
          <span className="ml-auto">⌘K anywhere</span>
        </div>
      </div>
    </div>
  );
}
