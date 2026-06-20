// Thin Slack Web API client + helpers to resolve the bot token and the owning org.

import { and, eq } from "drizzle-orm"
import { getDb } from "../../db"
import { connections } from "../../db/schema"

type SlackConn = { orgId: string; accessToken: string | null; metadata: unknown }

/** Find the Slack connection for a given team (workspace); fall back to the default org. */
export async function slackConnForTeam(teamId?: string): Promise<SlackConn | null> {
	const db = await getDb()
	const rows = await db
		.select({ orgId: connections.orgId, accessToken: connections.accessToken, metadata: connections.metadata })
		.from(connections)
		.where(eq(connections.provider, "slack"))
	if (teamId) {
		const m = rows.find((r) => (r.metadata as { team?: { id?: string } })?.team?.id === teamId)
		if (m) return m
	}
	return rows[0] ?? null
}

export async function slackPostMessage(token: string, channel: string, text: string, threadTs?: string, blocks?: unknown[]) {
	const res = await fetch("https://slack.com/api/chat.postMessage", {
		method: "POST",
		headers: { authorization: `Bearer ${token}`, "content-type": "application/json; charset=utf-8" },
		// `text` is the notification fallback; `blocks` (if given) render the rich layout.
		body: JSON.stringify({ channel, text, blocks, thread_ts: threadTs, unfurl_links: false }),
	})
	return res.json() as Promise<{ ok: boolean; error?: string }>
}

export async function slackUserName(token: string, userId: string): Promise<string | undefined> {
	try {
		const res = await fetch(`https://slack.com/api/users.info?user=${userId}`, {
			headers: { authorization: `Bearer ${token}` },
		})
		const j = (await res.json()) as { ok: boolean; user?: { real_name?: string; name?: string } }
		return j.user?.real_name ?? j.user?.name
	} catch {
		return undefined
	}
}

/** Strip a leading <@BOTID> mention from app_mention text. */
export function stripMention(text: string): string {
	return text.replace(/<@[A-Z0-9]+>/g, "").trim()
}
