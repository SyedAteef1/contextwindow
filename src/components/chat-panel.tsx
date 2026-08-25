"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { Eyebrow, Pill } from "./ui";
import { Markdown } from "./markdown";
import { cn } from "@/lib/cn";

type Source = { label: string; sourceType: string; sourceId: string; similarity: number };
type Turn = { role: "user" | "assistant"; content: string; sources?: Source[] };
type Thread = { id: string; title: string; lastMessageAt: string };

/** "3d" reads faster than a date in a narrow column, and never needs the year. */
function shortAge(iso: string): string {
  const elapsed = Date.now() - Date.parse(iso);
  const minutes = Math.round(elapsed / 60_000);
  if (minutes < 1) return "now";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.round(hours / 24);
  return days < 7 ? `${days}d` : `${Math.round(days / 7)}w`;
}

/**
 * Ask questions about one account, across saved conversations.
 *
 * Threads are stored rather than held in the browser, so a line of enquiry
 * survives a refresh and a rep can keep "what did we promise them" apart from
 * "why did this stall". A thread is created by asking the first question, never
 * by pressing a button — an empty conversation in the list is just clutter.
 */
export function ChatPanel({
  accountId,
  companyName,
  hasHistory,
}: {
  accountId: string;
  companyName: string;
  hasHistory: boolean;
}) {
  const [threads, setThreads] = useState<Thread[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [question, setQuestion] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const refreshThreads = useCallback(async () => {
    try {
      const response = await fetch(`/api/accounts/${accountId}/threads`);
      if (!response.ok) return;
      const data = await response.json();
      setThreads(data.threads ?? []);
    } catch {
      // The sidebar is navigation, not content: failing to load it must not
      // stop the rep asking a question.
    }
  }, [accountId]);

  useEffect(() => {
    // Fetched inline rather than by calling `refreshThreads`, so the state
    // update happens after an await and cannot cascade renders. The flag stops
    // a late response from a previous account overwriting this one's list.
    let ignore = false;
    (async () => {
      try {
        const response = await fetch(`/api/accounts/${accountId}/threads`);
        if (!response.ok) return;
        const data = await response.json();
        if (!ignore) setThreads(data.threads ?? []);
      } catch {
        // Navigation only; a rep can still ask without the list.
      }
    })();
    return () => {
      ignore = true;
    };
  }, [accountId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [turns, streaming]);

  async function openThread(threadId: string) {
    if (streaming) return;
    setActiveId(threadId);
    setError(null);
    try {
      const response = await fetch(`/api/chat-threads/${threadId}`);
      if (!response.ok) throw new Error("Could not open that conversation");
      const data = await response.json();
      setTurns(
        (data.thread.messages ?? []).map(
          (message: { role: Turn["role"]; content: string; sources?: Source[] }) => ({
            role: message.role,
            content: message.content,
            sources: message.sources ?? undefined,
          }),
        ),
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not open that conversation");
    }
  }

  function startNew() {
    if (streaming) return;
    setActiveId(null);
    setTurns([]);
    setError(null);
  }

  async function removeThread(threadId: string) {
    try {
      await fetch(`/api/chat-threads/${threadId}`, { method: "DELETE" });
      if (threadId === activeId) startNew();
      refreshThreads();
    } catch {
      setError("Could not delete that conversation");
    }
  }

  async function ask(text: string) {
    const trimmed = text.trim();
    if (!trimmed || streaming) return;

    setTurns((current) => [
      ...current,
      { role: "user", content: trimmed },
      { role: "assistant", content: "" },
    ]);
    setQuestion("");
    setStreaming(true);
    setError(null);

    try {
      const response = await fetch(`/api/accounts/${accountId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // History lives on the server now, so only the question travels.
        body: JSON.stringify({ question: trimmed, threadId: activeId ?? undefined }),
      });

      if (!response.ok || !response.body) {
        const detail = await response.json().catch(() => null);
        throw new Error(detail?.error ?? "Could not reach the assistant");
      }

      // A new conversation announces its id in a header, so the sidebar can
      // adopt it while the answer is still streaming.
      const newThreadId = response.headers.get("X-Thread-Id");
      if (newThreadId && !activeId) setActiveId(newThreadId);

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      // NDJSON: events are newline-delimited, so hold a partial line over reads.
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.trim()) continue;
          const event = JSON.parse(line) as
            | { type: "sources"; sources: Source[] }
            | { type: "delta"; text: string }
            | { type: "error"; message: string }
            | { type: "done" };

          setTurns((current) => {
            const next = [...current];
            const last = next[next.length - 1];
            if (last?.role !== "assistant") return current;

            if (event.type === "sources") next[next.length - 1] = { ...last, sources: event.sources };
            if (event.type === "delta")
              next[next.length - 1] = { ...last, content: last.content + event.text };
            return next;
          });

          if (event.type === "error") setError(event.message);
        }
      }
      refreshThreads();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not reach the assistant");
      // Drop the empty assistant turn so the thread doesn't show a blank reply.
      setTurns((current) =>
        current[current.length - 1]?.content === "" ? current.slice(0, -1) : current,
      );
    } finally {
      setStreaming(false);
    }
  }

  const starters = [
    "What are they worried about?",
    "What did we promise them?",
    "How has their interest changed?",
  ];

  return (
    <div className="flex h-[34rem] overflow-hidden rounded-lg border border-rule bg-surface">
      {/* --- Conversations ------------------------------------------------- */}
      <aside className="hidden w-52 shrink-0 flex-col border-r border-rule-soft bg-sunken/40 sm:flex">
        <div className="border-b border-rule-soft px-3 py-3">
          <button
            type="button"
            onClick={startNew}
            disabled={streaming}
            className="w-full rounded-md border border-rule bg-surface px-3 py-2 text-left text-[13px] text-ink transition-colors hover:border-faint disabled:opacity-50"
          >
            New conversation
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-2 py-2">
          {threads.length === 0 ? (
            <p className="px-2 py-3 text-[12px] leading-relaxed text-faint">
              Ask something and it is saved here.
            </p>
          ) : (
            <ul className="space-y-px">
              {threads.map((thread) => (
                <li key={thread.id} className="group relative">
                  <button
                    type="button"
                    onClick={() => openThread(thread.id)}
                    className={cn(
                      "w-full rounded px-2 py-2 pr-7 text-left transition-colors",
                      thread.id === activeId ? "bg-surface" : "hover:bg-surface/70",
                    )}
                  >
                    <span
                      className={cn(
                        "block truncate text-[12.5px] leading-snug",
                        thread.id === activeId ? "text-ink" : "text-muted",
                      )}
                    >
                      {thread.title}
                    </span>
                    <span className="mt-0.5 block font-mono text-[10px] text-faint">
                      {shortAge(thread.lastMessageAt)}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => removeThread(thread.id)}
                    aria-label={`Delete ${thread.title}`}
                    className="absolute right-1.5 top-2 rounded px-1 font-mono text-[11px] text-faint opacity-0 transition-opacity hover:text-flag focus-visible:opacity-100 group-hover:opacity-100"
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </aside>

      {/* --- The conversation ---------------------------------------------- */}
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center justify-between gap-3 border-b border-rule-soft px-5 py-3.5">
          <div className="flex min-w-0 items-center gap-2.5">
            <Eyebrow>Ask about {companyName}</Eyebrow>
            {streaming && <Pill tone="quiet">Thinking</Pill>}
          </div>

          {/* The sidebar is too costly on a phone, so threads move into a picker. */}
          <div className="flex items-center gap-2 sm:hidden">
            <select
              value={activeId ?? ""}
              onChange={(event) =>
                event.target.value ? openThread(event.target.value) : startNew()
              }
              className="max-w-[9rem] rounded border border-rule bg-surface px-2 py-1 text-[12px] text-ink"
            >
              <option value="">New conversation</option>
              {threads.map((thread) => (
                <option key={thread.id} value={thread.id}>
                  {thread.title}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div ref={scrollRef} className="flex-1 space-y-5 overflow-y-auto px-5 py-5">
          {turns.length === 0 && (
            <div className="pt-6 text-center">
              <p className="text-[13.5px] text-muted">
                {hasHistory
                  ? `Answers come only from this account's calls, briefs, and summaries.`
                  : `Nothing is indexed for ${companyName} yet. Process a call first and the answers will have something to draw on.`}
              </p>
              {hasHistory && (
                <div className="mt-4 flex flex-wrap justify-center gap-2">
                  {starters.map((starter) => (
                    <button
                      key={starter}
                      type="button"
                      onClick={() => ask(starter)}
                      className="rounded-full border border-rule px-3 py-1.5 text-[12.5px] text-muted transition-colors hover:border-faint hover:text-ink"
                    >
                      {starter}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {turns.map((turn, index) => (
            <div key={index} className={cn(turn.role === "user" && "flex justify-end")}>
              {turn.role === "user" ? (
                <p className="max-w-[85%] rounded-lg rounded-br-sm bg-ink px-3.5 py-2 text-[13.5px] text-ground">
                  {turn.content}
                </p>
              ) : (
                <div className="max-w-[92%]">
                  {turn.sources && turn.sources.length > 0 && (
                    <div className="mb-2 flex flex-wrap gap-1.5">
                      {turn.sources.map((source) => (
                        <Pill key={source.sourceId} tone="quiet">
                          {source.label}
                        </Pill>
                      ))}
                    </div>
                  )}
                  {turn.content ? (
                    <Markdown>{turn.content}</Markdown>
                  ) : (
                    <span className="pulse-live font-mono text-[11px] uppercase tracking-[0.12em] text-faint">
                      Reading the account history…
                    </span>
                  )}
                </div>
              )}
            </div>
          ))}

          {error && <p className="text-[13px] text-flag">{error}</p>}
        </div>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            ask(question);
          }}
          className="flex items-center gap-2 border-t border-rule-soft px-4 py-3"
        >
          <input
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            placeholder="Ask anything about this account…"
            disabled={streaming}
            className="flex-1 bg-transparent px-1 py-1.5 text-[14px] text-ink outline-none placeholder:text-faint disabled:opacity-60"
          />
          <button
            type="submit"
            disabled={streaming || !question.trim()}
            className="rounded-md bg-ink px-3.5 py-2 text-[13px] font-medium text-ground transition-colors hover:bg-ink-soft disabled:opacity-40"
          >
            Ask
          </button>
        </form>
      </div>
    </div>
  );
}
