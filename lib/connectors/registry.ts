// Connector registry — REAL OAuth2 + data sync for every provider. Each config reads its
// client id/secret from the environment; until those are set the provider shows
// "Setup required" in the UI (never a fake "Connected"). `sync` pulls real data via the
// provider API and feeds it into the memory engine.

import { ingestDocument } from "../memory/ingest"
import { redact } from "../redact"
import { expiryFrom, getJson, postForm, postJson } from "./oauth"

export type Provider =
	| "slack" | "notion" | "github" | "google-drive" | "gmail" | "onedrive" | "zendesk" | "pagerduty"

export type TokenSet = {
	accessToken: string
	refreshToken?: string | null
	expiresAt?: Date | null
	scope?: string | null
	email?: string | null
	metadata?: Record<string, unknown>
}

type AuthCtx = { clientId: string; redirectUri: string; state: string; challenge?: string; subdomain?: string }
type ExchangeCtx = { clientId: string; clientSecret: string; code: string; redirectUri: string; verifier?: string; subdomain?: string }
type SyncCtx = { accessToken: string; orgId: string; userId: string; containerTag: string; metadata?: Record<string, unknown> }

export type ConnectorConfig = {
	id: Provider
	label: string
	envClientId: string
	envClientSecret: string
	usePKCE?: boolean
	needsSubdomain?: boolean
	docType: Parameters<typeof ingestDocument>[0]["type"]
	authorizeUrl: (ctx: AuthCtx) => string
	exchange: (ctx: ExchangeCtx) => Promise<TokenSet>
	refresh?: (ctx: { clientId: string; clientSecret: string; refreshToken: string }) => Promise<TokenSet>
	sync: (ctx: SyncCtx) => Promise<{ docs: number }>
}

const SYNC_CAP = 25 // keep first-sync bounded

export function clientCreds(p: Provider) {
	const c = CONNECTORS[p]
	return {
		clientId: process.env[c.envClientId]?.trim(),
		clientSecret: process.env[c.envClientSecret]?.trim(),
	}
}

export function isConfigured(p: Provider): boolean {
	const { clientId, clientSecret } = clientCreds(p)
	return Boolean(clientId && clientSecret)
}

const q = (params: Record<string, string>) => new URLSearchParams(params).toString()

// --- GitHub --------------------------------------------------------------
const github: ConnectorConfig = {
	id: "github",
	label: "GitHub",
	envClientId: "GITHUB_CLIENT_ID",
	envClientSecret: "GITHUB_CLIENT_SECRET",
	docType: "text",
	authorizeUrl: ({ clientId, redirectUri, state }) =>
		`https://github.com/login/oauth/authorize?${q({ client_id: clientId, redirect_uri: redirectUri, scope: "repo read:user", state })}`,
	exchange: async ({ clientId, clientSecret, code, redirectUri }) => {
		const j = await postForm("https://github.com/login/oauth/access_token", {
			client_id: clientId, client_secret: clientSecret, code, redirect_uri: redirectUri,
		})
		return { accessToken: String(j.access_token), scope: (j.scope as string) ?? null }
	},
	sync: async ({ accessToken, orgId, userId, containerTag }) => {
		const repos = (await getJson("https://api.github.com/user/repos?per_page=25&sort=updated", accessToken, {
			"user-agent": "context-window", "x-github-api-version": "2022-11-28",
		})) as Array<{ full_name: string; description?: string }>
		let docs = 0
		for (const repo of repos.slice(0, SYNC_CAP)) {
			try {
				const readme = (await getJson(`https://api.github.com/repos/${repo.full_name}/readme`, accessToken, {
					"user-agent": "context-window", accept: "application/vnd.github.raw+json",
				})) as { _raw?: string; content?: string }
				const content = readme._raw ?? (readme.content ? Buffer.from(readme.content, "base64").toString("utf8") : "")
				if (!content) continue
				await ingestDocument({ orgId, userId, content, title: `${repo.full_name} README`, type: "text", source: "github", containerTag, url: `https://github.com/${repo.full_name}` })
				docs++
			} catch { /* repo without readme */ }
		}
		return { docs }
	},
}

// --- Notion --------------------------------------------------------------
const notion: ConnectorConfig = {
	id: "notion",
	label: "Notion",
	envClientId: "NOTION_CLIENT_ID",
	envClientSecret: "NOTION_CLIENT_SECRET",
	docType: "notion_doc",
	authorizeUrl: ({ clientId, redirectUri, state }) =>
		`https://api.notion.com/v1/oauth/authorize?${q({ client_id: clientId, redirect_uri: redirectUri, response_type: "code", owner: "user", state })}`,
	exchange: async ({ clientId, clientSecret, code, redirectUri }) => {
		const basic = Buffer.from(`${clientId}:${clientSecret}`).toString("base64")
		const j = await postJson("https://api.notion.com/v1/oauth/token", { grant_type: "authorization_code", code, redirect_uri: redirectUri }, { authorization: `Basic ${basic}` })
		return { accessToken: String(j.access_token), metadata: { workspace: j.workspace_name } }
	},
	sync: async ({ accessToken, orgId, userId, containerTag }) => {
		const hdr = { "notion-version": "2022-06-28" }
		const search = (await postJson("https://api.notion.com/v1/search", { filter: { property: "object", value: "page" }, page_size: SYNC_CAP }, { authorization: `Bearer ${accessToken}`, ...hdr })) as { results?: Array<{ id: string; url?: string; properties?: Record<string, unknown> }> }
		let docs = 0
		for (const page of (search.results ?? []).slice(0, SYNC_CAP)) {
			try {
				const blocks = (await getJson(`https://api.notion.com/v1/blocks/${page.id}/children?page_size=100`, accessToken, hdr)) as { results?: Array<Record<string, unknown>> }
				const text = extractNotionText(blocks.results ?? [])
				const title = notionTitle(page.properties) || "Notion page"
				if (!text.trim()) continue
				await ingestDocument({ orgId, userId, content: text, title, type: "notion_doc", source: "notion", containerTag, url: page.url })
				docs++
			} catch { /* skip */ }
		}
		return { docs }
	},
}

// --- Slack ---------------------------------------------------------------
const slack: ConnectorConfig = {
	id: "slack",
	label: "Slack",
	envClientId: "SLACK_CLIENT_ID",
	envClientSecret: "SLACK_CLIENT_SECRET",
	docType: "slack",
	authorizeUrl: ({ clientId, redirectUri, state }) =>
		`https://slack.com/oauth/v2/authorize?${q({ client_id: clientId, redirect_uri: redirectUri, scope: "channels:read,channels:history,groups:read,groups:history,im:history,mpim:history,app_mentions:read,chat:write,commands,users:read", state })}`,
	exchange: async ({ clientId, clientSecret, code, redirectUri }) => {
		const j = await postForm("https://slack.com/api/oauth.v2.access", { client_id: clientId, client_secret: clientSecret, code, redirect_uri: redirectUri })
		if (!j.ok) throw new Error(`slack oauth: ${j.error}`)
		return { accessToken: String(j.access_token), metadata: { team: j.team } }
	},
	sync: async ({ accessToken, orgId, userId }) => {
		const oldest = String(Math.floor((Date.now() - 90 * 86400_000) / 1000)) // last 90 days
		const list = (await getJson(`https://slack.com/api/conversations.list?types=public_channel&limit=${SYNC_CAP}`, accessToken)) as { channels?: Array<{ id: string; name: string }> }
		let docs = 0
		for (const ch of (list.channels ?? []).slice(0, SYNC_CAP)) {
			try {
				const hist = (await getJson(`https://slack.com/api/conversations.history?channel=${ch.id}&limit=100&oldest=${oldest}`, accessToken)) as { messages?: Array<{ text?: string; ts?: string; reply_count?: number }> }
				const parts: string[] = []
				for (const m of (hist.messages ?? []).reverse()) {
					if (m.text) parts.push(m.text)
					// Walk thread replies.
					if (m.reply_count && m.ts) {
						const rep = (await getJson(`https://slack.com/api/conversations.replies?channel=${ch.id}&ts=${m.ts}&limit=50`, accessToken)) as { messages?: Array<{ text?: string }> }
						for (const r of (rep.messages ?? []).slice(1)) if (r.text) parts.push(`  ↳ ${r.text}`)
					}
				}
				const text = redact(parts.filter(Boolean).join("\n"))
				if (!text.trim()) continue
				// Each channel → its own space.
				await ingestDocument({ orgId, userId, content: text, title: `#${ch.name}`, type: "slack", source: "slack", containerTag: `slack:${ch.name}` })
				docs++
			} catch { /* skip private/forbidden */ }
		}
		return { docs }
	},
}

// --- Google (Drive + Gmail share OAuth) ----------------------------------
function googleAuthUrl(scope: string) {
	return ({ clientId, redirectUri, state }: AuthCtx) =>
		`https://accounts.google.com/o/oauth2/v2/auth?${q({ client_id: clientId, redirect_uri: redirectUri, response_type: "code", access_type: "offline", prompt: "consent", scope, state })}`
}
async function googleExchange({ clientId, clientSecret, code, redirectUri }: ExchangeCtx): Promise<TokenSet> {
	const j = await postForm("https://oauth2.googleapis.com/token", { client_id: clientId, client_secret: clientSecret, code, redirect_uri: redirectUri, grant_type: "authorization_code" })
	return { accessToken: String(j.access_token), refreshToken: (j.refresh_token as string) ?? null, expiresAt: expiryFrom(j.expires_in) }
}
async function googleRefresh({ clientId, clientSecret, refreshToken }: { clientId: string; clientSecret: string; refreshToken: string }): Promise<TokenSet> {
	const j = await postForm("https://oauth2.googleapis.com/token", { client_id: clientId, client_secret: clientSecret, refresh_token: refreshToken, grant_type: "refresh_token" })
	return { accessToken: String(j.access_token), refreshToken, expiresAt: expiryFrom(j.expires_in) }
}

const googleDrive: ConnectorConfig = {
	id: "google-drive",
	label: "Google Drive",
	envClientId: "GOOGLE_CLIENT_ID",
	envClientSecret: "GOOGLE_CLIENT_SECRET",
	docType: "google_doc",
	authorizeUrl: googleAuthUrl("https://www.googleapis.com/auth/drive.readonly"),
	exchange: googleExchange,
	refresh: googleRefresh,
	sync: async ({ accessToken, orgId, userId, containerTag }) => {
		const list = (await getJson(`https://www.googleapis.com/drive/v3/files?${q({ q: "mimeType='application/vnd.google-apps.document'", pageSize: String(SYNC_CAP), fields: "files(id,name,webViewLink)" })}`, accessToken)) as { files?: Array<{ id: string; name: string; webViewLink?: string }> }
		let docs = 0
		for (const f of list.files ?? []) {
			try {
				const res = await fetch(`https://www.googleapis.com/drive/v3/files/${f.id}/export?mimeType=text/plain`, { headers: { authorization: `Bearer ${accessToken}` } })
				const content = await res.text()
				if (!res.ok || !content.trim()) continue
				await ingestDocument({ orgId, userId, content, title: f.name, type: "google_doc", source: "google-drive", containerTag, url: f.webViewLink })
				docs++
			} catch { /* skip */ }
		}
		return { docs }
	},
}

const gmail: ConnectorConfig = {
	id: "gmail",
	label: "Gmail",
	envClientId: "GOOGLE_CLIENT_ID",
	envClientSecret: "GOOGLE_CLIENT_SECRET",
	docType: "email",
	authorizeUrl: googleAuthUrl("https://www.googleapis.com/auth/gmail.readonly"),
	exchange: googleExchange,
	refresh: googleRefresh,
	sync: async ({ accessToken, orgId, userId, containerTag }) => {
		const list = (await getJson(`https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=${SYNC_CAP}`, accessToken)) as { messages?: Array<{ id: string }> }
		let docs = 0
		for (const m of list.messages ?? []) {
			try {
				const msg = (await getJson(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${m.id}?format=full`, accessToken)) as { snippet?: string; payload?: { headers?: Array<{ name: string; value: string }> } }
				const subject = msg.payload?.headers?.find((h) => h.name.toLowerCase() === "subject")?.value ?? "Email"
				const content = msg.snippet ?? ""
				if (!content.trim()) continue
				await ingestDocument({ orgId, userId, content, title: subject, type: "email", source: "gmail", containerTag })
				docs++
			} catch { /* skip */ }
		}
		return { docs }
	},
}

// --- Microsoft OneDrive --------------------------------------------------
const onedrive: ConnectorConfig = {
	id: "onedrive",
	label: "OneDrive",
	envClientId: "MICROSOFT_CLIENT_ID",
	envClientSecret: "MICROSOFT_CLIENT_SECRET",
	docType: "onedrive",
	authorizeUrl: ({ clientId, redirectUri, state }) =>
		`https://login.microsoftonline.com/common/oauth2/v2.0/authorize?${q({ client_id: clientId, redirect_uri: redirectUri, response_type: "code", scope: "Files.Read offline_access User.Read", state })}`,
	exchange: async ({ clientId, clientSecret, code, redirectUri }) => {
		const j = await postForm("https://login.microsoftonline.com/common/oauth2/v2.0/token", { client_id: clientId, client_secret: clientSecret, code, redirect_uri: redirectUri, grant_type: "authorization_code" })
		return { accessToken: String(j.access_token), refreshToken: (j.refresh_token as string) ?? null, expiresAt: expiryFrom(j.expires_in) }
	},
	refresh: async ({ clientId, clientSecret, refreshToken }) => {
		const j = await postForm("https://login.microsoftonline.com/common/oauth2/v2.0/token", { client_id: clientId, client_secret: clientSecret, refresh_token: refreshToken, grant_type: "refresh_token" })
		return { accessToken: String(j.access_token), refreshToken: (j.refresh_token as string) ?? refreshToken, expiresAt: expiryFrom(j.expires_in) }
	},
	sync: async ({ accessToken, orgId, userId, containerTag }) => {
		const list = (await getJson("https://graph.microsoft.com/v1.0/me/drive/root/children?$top=" + SYNC_CAP, accessToken)) as { value?: Array<{ id: string; name: string; file?: { mimeType?: string }; webUrl?: string }> }
		let docs = 0
		for (const f of (list.value ?? []).filter((x) => x.file && /text|markdown|json/.test(x.file.mimeType ?? ""))) {
			try {
				const res = await fetch(`https://graph.microsoft.com/v1.0/me/drive/items/${f.id}/content`, { headers: { authorization: `Bearer ${accessToken}` } })
				const content = await res.text()
				if (!res.ok || !content.trim()) continue
				await ingestDocument({ orgId, userId, content, title: f.name, type: "onedrive", source: "onedrive", containerTag, url: f.webUrl })
				docs++
			} catch { /* skip */ }
		}
		return { docs }
	},
}

// --- Zendesk (per-subdomain) ---------------------------------------------
const zendesk: ConnectorConfig = {
	id: "zendesk",
	label: "Zendesk",
	envClientId: "ZENDESK_CLIENT_ID",
	envClientSecret: "ZENDESK_CLIENT_SECRET",
	needsSubdomain: true,
	docType: "ticket",
	authorizeUrl: ({ clientId, redirectUri, state, subdomain }) =>
		`https://${subdomain}.zendesk.com/oauth/authorizations/new?${q({ response_type: "code", client_id: clientId, redirect_uri: redirectUri, scope: "read", state })}`,
	exchange: async ({ clientId, clientSecret, code, redirectUri, subdomain }) => {
		const j = await postForm(`https://${subdomain}.zendesk.com/oauth/tokens`, { grant_type: "authorization_code", code, client_id: clientId, client_secret: clientSecret, redirect_uri: redirectUri, scope: "read" })
		return { accessToken: String(j.access_token), metadata: { subdomain } }
	},
	sync: async ({ accessToken, orgId, userId, containerTag, metadata }) => {
		const subdomain = String(metadata?.subdomain ?? "")
		const j = (await getJson(`https://${subdomain}.zendesk.com/api/v2/tickets.json?per_page=${SYNC_CAP}`, accessToken)) as { tickets?: Array<{ id: number; subject?: string; description?: string; url?: string }> }
		let docs = 0
		for (const t of j.tickets ?? []) {
			if (!t.description?.trim()) continue
			await ingestDocument({ orgId, userId, content: `${t.subject ?? ""}\n\n${t.description}`, title: t.subject ?? `Ticket #${t.id}`, type: "ticket", source: "zendesk", containerTag })
			docs++
		}
		return { docs }
	},
}

// --- PagerDuty -----------------------------------------------------------
const pagerduty: ConnectorConfig = {
	id: "pagerduty",
	label: "PagerDuty",
	envClientId: "PAGERDUTY_CLIENT_ID",
	envClientSecret: "PAGERDUTY_CLIENT_SECRET",
	docType: "ticket",
	authorizeUrl: ({ clientId, redirectUri, state }) =>
		`https://identity.pagerduty.com/oauth/authorize?${q({ client_id: clientId, redirect_uri: redirectUri, response_type: "code", scope: "read" })}&state=${state}`,
	exchange: async ({ clientId, clientSecret, code, redirectUri }) => {
		const j = await postForm("https://identity.pagerduty.com/oauth/token", { grant_type: "authorization_code", code, client_id: clientId, client_secret: clientSecret, redirect_uri: redirectUri })
		return { accessToken: String(j.access_token), refreshToken: (j.refresh_token as string) ?? null, expiresAt: expiryFrom(j.expires_in) }
	},
	sync: async ({ accessToken, orgId, userId, containerTag }) => {
		const j = (await getJson(`https://api.pagerduty.com/incidents?limit=${SYNC_CAP}&sort_by=created_at:desc`, accessToken)) as { incidents?: Array<{ id: string; title?: string; description?: string; html_url?: string }> }
		let docs = 0
		for (const inc of j.incidents ?? []) {
			const content = inc.description ?? inc.title ?? ""
			if (!content.trim()) continue
			await ingestDocument({ orgId, userId, content, title: inc.title ?? `Incident ${inc.id}`, type: "ticket", source: "pagerduty", containerTag, url: inc.html_url })
			docs++
		}
		return { docs }
	},
}

export const CONNECTORS: Record<Provider, ConnectorConfig> = {
	slack, notion, github, "google-drive": googleDrive, gmail, onedrive, zendesk, pagerduty,
}

export const ALL_PROVIDERS = Object.keys(CONNECTORS) as Provider[]

// --- helpers -------------------------------------------------------------
function notionTitle(props?: Record<string, unknown>): string {
	if (!props) return ""
	for (const v of Object.values(props)) {
		const t = (v as { title?: Array<{ plain_text?: string }> })?.title
		if (Array.isArray(t)) return t.map((x) => x.plain_text ?? "").join("")
	}
	return ""
}
function extractNotionText(blocks: Array<Record<string, unknown>>): string {
	const lines: string[] = []
	for (const b of blocks) {
		const type = b.type as string
		const data = b[type] as { rich_text?: Array<{ plain_text?: string }> } | undefined
		const rt = data?.rich_text
		if (Array.isArray(rt)) lines.push(rt.map((x) => x.plain_text ?? "").join(""))
	}
	return lines.filter(Boolean).join("\n")
}
