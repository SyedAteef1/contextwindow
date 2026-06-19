"use client"

// Integrations console — REAL OAuth. A provider is only "Connected" when a real token is
// stored (via /api/connect/<provider> → callback). Providers without client creds in .env
// show "Setup required". Connected providers can Sync (pull data) and Disconnect.

import { Loader, RefreshCw } from "lucide-react"
import { type ReactNode, useCallback, useEffect, useState } from "react"
import {
	Gmail,
	GenericConnector,
	GitHub,
	GoogleDrive,
	McpIcon,
	Notion,
	OneDrive,
	Slack,
} from "@/components/integration-icons"
import { cn } from "@/lib/utils"

type Provider =
	| "slack" | "gmail" | "notion" | "google-drive" | "onedrive" | "github" | "zendesk" | "pagerduty"

type ProviderStatus = {
	id: Provider
	label: string
	configured: boolean
	needsSubdomain: boolean
	connected: boolean
	connectionId: string | null
}

const META: Record<Provider, { tagline: string; icon: ReactNode; group: string }> = {
	slack: { tagline: "Capture threads and answer in-channel", icon: <Slack className="size-6" />, group: "Communication" },
	gmail: { tagline: "Pull knowledge out of email", icon: <Gmail className="size-6" />, group: "Communication" },
	notion: { tagline: "Import pages and databases", icon: <Notion className="size-6" />, group: "Docs & Files" },
	"google-drive": { tagline: "Index docs, slides, and sheets", icon: <GoogleDrive className="size-6" />, group: "Docs & Files" },
	onedrive: { tagline: "Bring in Office documents", icon: <OneDrive className="size-6" />, group: "Docs & Files" },
	github: { tagline: "Runbooks, issues, and READMEs", icon: <GitHub className="size-6" />, group: "Docs & Files" },
	zendesk: { tagline: "Learn from support tickets", icon: <GenericConnector className="size-6 text-fg-faint" />, group: "Support & Incidents" },
	pagerduty: { tagline: "Incident patterns and responses", icon: <GenericConnector className="size-6 text-fg-faint" />, group: "Support & Incidents" },
}
const GROUPS = ["Communication", "Docs & Files", "Support & Incidents"]

export function IntegrationsView() {
	const [providers, setProviders] = useState<ProviderStatus[]>([])
	const [loading, setLoading] = useState(true)
	const [busy, setBusy] = useState<Provider | null>(null)
	const [banner, setBanner] = useState<{ kind: "ok" | "err"; text: string } | null>(null)

	const load = useCallback(async () => {
		setLoading(true)
		try {
			const res = await fetch("/api/connections")
			const data = (await res.json()) as { providers: ProviderStatus[] }
			setProviders(data.providers ?? [])
		} finally {
			setLoading(false)
		}
	}, [])

	useEffect(() => {
		void load()
		// Surface ?connected=/?error= from the OAuth callback.
		const sp = new URLSearchParams(window.location.search)
		if (sp.get("connected")) setBanner({ kind: "ok", text: `Connected ${sp.get("connected")} ✓` })
		else if (sp.get("error")) setBanner({ kind: "err", text: `Connection failed: ${sp.get("error")}` })
		if (sp.get("connected") || sp.get("error")) window.history.replaceState({}, "", "/integrations")
	}, [load])

	const connect = (p: ProviderStatus) => {
		let url = `/api/connect/${p.id}`
		if (p.needsSubdomain) {
			const sub = window.prompt(`Enter your ${p.label} subdomain (e.g. "acme" for acme.zendesk.com):`)
			if (!sub) return
			url += `?subdomain=${encodeURIComponent(sub)}`
		}
		window.location.href = url // real OAuth redirect to the provider
	}

	const disconnect = async (p: ProviderStatus) => {
		if (!p.connectionId) return
		setBusy(p.id)
		try {
			await fetch(`/api/connections?id=${p.connectionId}`, { method: "DELETE" })
			await load()
		} finally {
			setBusy(null)
		}
	}

	const sync = async (p: ProviderStatus) => {
		if (!p.connectionId) return
		setBusy(p.id)
		setBanner(null)
		try {
			const res = await fetch("/api/connections/sync", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ id: p.connectionId }),
			})
			const data = await res.json()
			setBanner(
				res.ok
					? { kind: "ok", text: `${p.label}: synced ${data.docs} documents` }
					: { kind: "err", text: `${p.label} sync failed: ${data.error}` },
			)
		} finally {
			setBusy(null)
		}
	}

	return (
		<div className="mx-auto w-full max-w-5xl px-6 py-10">
			<header className="mb-6 flex items-center justify-between">
				<div>
					<h1 className="text-fg-primary text-2xl font-semibold">Integrations</h1>
					<p className="text-fg-faint text-sm mt-1">
						Connect a source and the brain learns from it — and can answer right inside it.
					</p>
				</div>
				<button
					type="button"
					onClick={() => void load()}
					className="flex items-center gap-2 rounded-lg border border-surface-border bg-surface-card px-3 py-2 text-sm text-fg-muted hover:border-brand-accent/50 transition-colors"
				>
					<RefreshCw className={loading ? "size-4 animate-spin" : "size-4"} />
					Refresh
				</button>
			</header>

			{banner ? (
				<div
					className={cn(
						"mb-6 rounded-lg px-4 py-2.5 text-sm border",
						banner.kind === "ok"
							? "border-brand-accent/40 bg-brand-accent/10 text-brand-accent"
							: "border-red-500/40 bg-red-500/10 text-red-400",
					)}
				>
					{banner.text}
				</div>
			) : null}

			{GROUPS.map((group) => (
				<section key={group} className="mb-10">
					<h2 className="text-fg-subtle text-xs font-semibold uppercase tracking-wider mb-3">{group}</h2>
					<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
						{providers
							.filter((p) => META[p.id]?.group === group)
							.map((p) => (
								<ProviderCard
									key={p.id}
									p={p}
									busy={busy === p.id}
									onConnect={() => connect(p)}
									onDisconnect={() => void disconnect(p)}
									onSync={() => void sync(p)}
								/>
							))}
					</div>
				</section>
			))}

			<section className="mb-4">
				<h2 className="text-fg-subtle text-xs font-semibold uppercase tracking-wider mb-3">Agent surface</h2>
				<div className="rounded-xl border border-surface-border bg-surface-card p-4 flex items-start gap-3">
					<McpIcon className="size-6 text-brand-accent mt-0.5" />
					<div>
						<h3 className="text-fg-primary text-sm font-medium">MCP endpoint</h3>
						<p className="text-fg-faint text-xs mt-0.5">
							Available to Claude / Cursor over MCP. stdio: <code className="text-fg-muted">bun run mcp</code> · HTTP:{" "}
							<code className="text-fg-muted">POST /api/mcp</code>
						</p>
					</div>
				</div>
			</section>
		</div>
	)
}

function ProviderCard({
	p,
	busy,
	onConnect,
	onDisconnect,
	onSync,
}: {
	p: ProviderStatus
	busy: boolean
	onConnect: () => void
	onDisconnect: () => void
	onSync: () => void
}) {
	const meta = META[p.id]
	const status = !p.configured ? "Setup required" : p.connected ? "Connected" : "Not connected"
	const statusClass = !p.configured
		? "bg-amber-500/10 text-amber-400"
		: p.connected
			? "bg-brand-accent/10 text-brand-accent"
			: "bg-fg-faint/10 text-fg-faint"

	return (
		<div className="bg-surface-card relative rounded-xl p-4 pt-12 border border-surface-border">
			<div className="absolute top-2 right-2 opacity-80">{meta.icon}</div>
			<h3 className="text-fg-primary text-sm font-medium">{p.label}</h3>
			<p className="text-fg-faint text-xs leading-relaxed mt-0.5">{meta.tagline}</p>
			<span className={cn("inline-block mt-2 text-[10px] font-medium px-1.5 py-0.5 rounded-full", statusClass)}>
				{busy ? "Working…" : status}
			</span>

			<div className="mt-3 flex items-center gap-2">
				{!p.configured ? (
					<span className="text-[11px] text-fg-faint">Set creds in .env — see CONNECTORS.md</span>
				) : p.connected ? (
					<>
						<button
							type="button"
							disabled={busy}
							onClick={onSync}
							className="text-xs rounded-md bg-brand-accent/15 text-brand-accent px-2.5 py-1 hover:bg-brand-accent/25 disabled:opacity-50"
						>
							{busy ? <Loader className="size-3 animate-spin inline" /> : "Sync"}
						</button>
						<button
							type="button"
							disabled={busy}
							onClick={onDisconnect}
							className="text-xs rounded-md border border-surface-border text-fg-muted px-2.5 py-1 hover:border-red-500/40 hover:text-red-400 disabled:opacity-50"
						>
							Disconnect
						</button>
					</>
				) : (
					<button
						type="button"
						disabled={busy}
						onClick={onConnect}
						className="text-xs rounded-md bg-brand-accent text-[#04130a] font-medium px-3 py-1 hover:bg-brand-accent-soft disabled:opacity-50"
					>
						Connect
					</button>
				)}
			</div>
		</div>
	)
}
