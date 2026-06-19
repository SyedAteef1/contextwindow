"use client"

// Context Window dashboard — Overview · Integrations · Ask. Lives alongside the existing
// app at /dashboard. Talks to the ported engine (/api/agent, /api/connections, /api/mcp).

import { Boxes, MessageSquare, Send, Sparkles } from "lucide-react"
import { useState } from "react"
import { IntegrationsView } from "@/components/integrations-view"

type Tab = "overview" | "integrations" | "ask"

export default function DashboardPage() {
	const [tab, setTab] = useState<Tab>("overview")
	return (
		<div className="min-h-screen bg-surface-base text-fg-primary">
			<div className="mx-auto w-full max-w-5xl px-6 py-8">
				<header className="flex items-center gap-2 text-brand-accent text-sm font-medium">
					<Sparkles className="size-4" /> Context Window
				</header>
				<nav className="mt-6 flex gap-1 border-b border-surface-border">
					{(["overview", "integrations", "ask"] as Tab[]).map((t) => (
						<button
							key={t}
							type="button"
							onClick={() => setTab(t)}
							className={`px-4 py-2 text-sm capitalize border-b-2 -mb-px transition-colors ${
								tab === t
									? "border-brand-accent text-fg-primary"
									: "border-transparent text-fg-faint hover:text-fg-muted"
							}`}
						>
							{t}
						</button>
					))}
				</nav>

				<div className="mt-6">
					{tab === "overview" ? <Overview onGo={setTab} /> : null}
					{tab === "ask" ? <Ask /> : null}
				</div>
			</div>

			{tab === "integrations" ? <IntegrationsView /> : null}
		</div>
	)
}

function Overview({ onGo }: { onGo: (t: Tab) => void }) {
	return (
		<div>
			<h1 className="text-fg-primary text-3xl font-semibold">The invisible company brain.</h1>
			<p className="text-fg-faint mt-2 max-w-xl">
				It learns from every tool your team uses and answers right where work happens.
			</p>
			<div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-8">
				<button
					type="button"
					onClick={() => onGo("integrations")}
					className="text-left rounded-xl border border-surface-border bg-surface-card p-5 hover:border-brand-accent/50 transition-colors"
				>
					<Boxes className="size-6 text-brand-accent" />
					<h2 className="text-fg-primary text-lg font-medium mt-3">Integrations</h2>
					<p className="text-fg-faint text-sm mt-1">Connect Slack, GitHub, Notion, Drive and more.</p>
				</button>
				<button
					type="button"
					onClick={() => onGo("ask")}
					className="text-left rounded-xl border border-surface-border bg-surface-card p-5 hover:border-brand-accent/50 transition-colors"
				>
					<MessageSquare className="size-6 text-brand-accent" />
					<h2 className="text-fg-primary text-lg font-medium mt-3">Ask the brain</h2>
					<p className="text-fg-faint text-sm mt-1">Query everything the company knows, with sources.</p>
				</button>
			</div>
			<div className="mt-6 rounded-xl border border-surface-border bg-surface-card p-4 text-xs text-fg-faint">
				MCP endpoint for Claude / Cursor — HTTP: <code className="text-fg-muted">POST /api/mcp</code> · stdio:{" "}
				<code className="text-fg-muted">bun run mcp</code>
			</div>
		</div>
	)
}

function Ask() {
	const [q, setQ] = useState("")
	const [answer, setAnswer] = useState("")
	const [loading, setLoading] = useState(false)

	const ask = async () => {
		if (!q.trim() || loading) return
		setLoading(true)
		setAnswer("")
		try {
			const res = await fetch("/api/agent", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ query: q }),
			})
			if (!res.body) {
				setAnswer(`(${res.status}) ${await res.text()}`)
				return
			}
			const reader = res.body.getReader()
			const decoder = new TextDecoder()
			let acc = ""
			while (true) {
				const { value, done } = await reader.read()
				if (done) break
				acc += decoder.decode(value, { stream: true })
				setAnswer(acc)
			}
			if (!acc.trim()) setAnswer("I don't know that yet.")
		} catch (err) {
			setAnswer(`Error: ${err instanceof Error ? err.message : String(err)}`)
		} finally {
			setLoading(false)
		}
	}

	return (
		<div>
			<div className="flex gap-2">
				<input
					value={q}
					onChange={(e) => setQ(e.target.value)}
					onKeyDown={(e) => e.key === "Enter" && ask()}
					placeholder="Ask anything about how the company works…"
					className="flex-1 rounded-lg border border-surface-border bg-surface-card px-4 py-2.5 text-sm text-fg-primary placeholder:text-fg-faint outline-none focus:border-brand-accent/60"
				/>
				<button
					type="button"
					onClick={ask}
					disabled={loading}
					className="rounded-lg bg-brand-accent text-[#04130a] font-medium px-4 py-2.5 text-sm hover:bg-brand-accent-soft disabled:opacity-50 flex items-center gap-2"
				>
					<Send className="size-4" /> {loading ? "Thinking…" : "Ask"}
				</button>
			</div>
			{answer ? (
				<div className="mt-4 rounded-xl border border-surface-border bg-surface-card p-4 text-sm text-fg-secondary whitespace-pre-wrap leading-relaxed">
					{answer}
				</div>
			) : (
				<p className="mt-4 text-xs text-fg-faint">
					Answers come from connected sources (needs a valid Bedrock token). Try connecting a source first.
				</p>
			)}
		</div>
	)
}
