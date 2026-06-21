"use client";

// The brain search bar on /app. Two modes:
//   Ask    → the agent answers with sources (and escalates if the brain is empty)
//   Search → raw matching memories, no LLM (instant)
// A role picker shapes the Ask answer (engineer / exec / support / …). Posts to the
// session-gated /api/app/ask, so it always runs as the signed-in, approved user.

import { useState } from "react";
import { DEFAULT_ROLE, listRoles } from "@/lib/agent/roles";

type SearchHit = { memory: string; similarity: number; sources: { title: string | null; url: string | null }[] };

export function BrainSearch() {
  const roles = listRoles();
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<"ask" | "search">("ask");
  const [role, setRole] = useState(DEFAULT_ROLE);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [answer, setAnswer] = useState<string | null>(null);
  const [hits, setHits] = useState<SearchHit[] | null>(null);

  async function run() {
    const q = query.trim();
    if (!q || loading) return;
    setLoading(true);
    setError(null);
    setAnswer(null);
    setHits(null);
    try {
      const res = await fetch("/api/app/ask", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ query: q, mode, role }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong.");
      } else if (data.mode === "search") {
        setHits(data.results as SearchHit[]);
      } else {
        setAnswer(data.answer as string);
      }
    } catch {
      setError("Network error — please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="liquid-glass rounded-3xl p-6 sm:p-7">
      {/* Mode toggle */}
      <div className="flex items-center gap-2 mb-4">
        {(["ask", "search"] as const).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`text-xs font-semibold px-3 py-1.5 rounded-full transition-colors ${
              mode === m ? "bg-[#4ade80] text-black" : "bg-white/5 text-white/60 hover:text-white"
            }`}
          >
            {m === "ask" ? "Ask the brain" : "Search memory"}
          </button>
        ))}
        {mode === "ask" && (
          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="ml-auto text-xs bg-white/5 border border-white/10 rounded-full px-3 py-1.5 text-white/80 outline-none"
            title="Answer style"
          >
            {roles.map((r) => (
              <option key={r.id} value={r.id} className="bg-[#0a1f14]">
                {r.label}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Input */}
      <div className="flex items-end gap-3">
        <textarea
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) run();
          }}
          rows={2}
          placeholder={mode === "ask" ? "Ask anything about how the company works…" : "Search the company memory…"}
          className="flex-1 resize-none bg-black/30 border border-white/10 rounded-2xl px-4 py-3 text-sm text-white placeholder:text-white/30 outline-none focus:border-[#4ade80]/40"
        />
        <button
          onClick={run}
          disabled={loading || !query.trim()}
          className="shrink-0 bg-[#4ade80] text-black font-semibold rounded-2xl px-5 py-3 text-sm hover:bg-[#4ade80]/90 transition disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {loading ? "…" : mode === "ask" ? "Ask" : "Search"}
        </button>
      </div>
      <p className="text-[11px] text-white/30 mt-2">⌘/Ctrl + Enter to submit</p>

      {/* Results */}
      {error && <div className="mt-5 text-sm text-red-300 bg-red-500/10 border border-red-500/20 rounded-2xl px-4 py-3">{error}</div>}

      {answer && (
        <div className="mt-5 text-sm text-white/85 whitespace-pre-wrap leading-relaxed bg-black/20 border border-white/10 rounded-2xl px-4 py-4">
          {answer}
        </div>
      )}

      {hits && (
        <div className="mt-5 space-y-3">
          {hits.length === 0 && <p className="text-sm text-white/40">No memories matched yet — try Ask, which can escalate to the right person.</p>}
          {hits.map((h, i) => (
            <div key={i} className="bg-black/20 border border-white/10 rounded-2xl px-4 py-3">
              <p className="text-sm text-white/85">{h.memory}</p>
              <p className="text-[11px] text-white/35 mt-1.5">
                {(h.similarity * 100).toFixed(0)}% match
                {h.sources.length > 0 && <> · {h.sources.map((s) => s.title || s.url || "source").join(", ")}</>}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
