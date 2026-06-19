// Slack routing: events → ingest (sensor) or answer (actuator, answer-only).
// Answer-only means the bot replies ONLY to @mentions, /ask, and DMs — never unprompted.

import { and, eq } from "drizzle-orm"
import { getDb } from "../../db"
import { identities } from "../../db/schema"
import { runAgent } from "../agent/core"
import { newId } from "../ids"
import { log } from "../log"
import { ingestDocument } from "../memory/ingest"
import { redact } from "../redact"
import { slackConnForTeam, slackPostMessage, slackUserName, stripMention } from "./client"

/** Map a Slack user to an internal principal (create on first sight). */
async function resolveIdentity(orgId: string, token: string, slackUserId: string): Promise<string> {
	const db = await getDb()
	const [existing] = await db
		.select({ principalId: identities.principalId })
		.from(identities)
		.where(and(eq(identities.surface, "slack"), eq(identities.surfaceUserId, slackUserId)))
		.limit(1)
	if (existing) return existing.principalId

	const principalId = `slack:${slackUserId}`
	const displayName = await slackUserName(token, slackUserId)
	await db.insert(identities).values({
		id: newId("idn"),
		orgId,
		principalId,
		surface: "slack",
		surfaceUserId: slackUserId,
		displayName: displayName ?? null,
	})
	return principalId
}

async function answer(
	orgId: string,
	token: string,
	channel: string,
	threadTs: string | undefined,
	slackUserId: string,
	question: string,
) {
	const q = question.trim()
	if (!q) return
	const principalId = await resolveIdentity(orgId, token, slackUserId)
	log.info("slack", `answering for ${principalId} in ${channel}: ${q}`)
	try {
		const result = runAgent({ ctx: { orgId, principalId, surface: "slack" }, query: q })
		let text = ""
		for await (const chunk of result.textStream) text += chunk
		await slackPostMessage(token, channel, text.trim() || "I don't know that yet.", threadTs)
	} catch (err) {
		log.error("slack", "answer failed", err instanceof Error ? err.message : err)
		await slackPostMessage(token, channel, "I don't know that yet.", threadTs)
	}
}

async function ingestMessage(orgId: string, channel: string, text: string) {
	const clean = redact(text)
	if (clean.trim().length < 20) return // skip trivia/acks
	await ingestDocument({
		orgId,
		userId: "slack",
		content: clean,
		title: `#${channel}`,
		type: "slack",
		source: "slack",
		containerTag: `slack:${channel}`, // each channel → its own space
	})
}

type SlackEvent = {
	type: string
	subtype?: string
	bot_id?: string
	text?: string
	user?: string
	channel: string
	channel_type?: string
	ts?: string
	thread_ts?: string
}

export async function handleEventCallback(body: { team_id?: string; event?: SlackEvent }) {
	const event = body.event
	if (!event) return
	const conn = await slackConnForTeam(body.team_id)
	if (!conn?.accessToken) {
		log.warn("slack", "no bot token for team — connect Slack first")
		return
	}
	const { orgId, accessToken: token } = conn

	if (event.type === "app_mention") {
		await answer(orgId, token, event.channel, event.thread_ts ?? event.ts, event.user ?? "", stripMention(event.text ?? ""))
		return
	}
	if (event.type === "message") {
		if (event.bot_id || event.subtype || !event.text || !event.user) return // ignore bot/system/edits
		if (event.channel_type === "im") {
			await answer(orgId, token, event.channel, undefined, event.user, event.text) // DM = private ask
		} else {
			await ingestMessage(orgId, event.channel, event.text) // channel message = sensor
		}
	}
}

export async function handleSlashCommand(params: Record<string, string>) {
	const conn = await slackConnForTeam(params.team_id)
	if (!conn?.accessToken) return
	await answer(conn.orgId, conn.accessToken, params.channel_id, undefined, params.user_id, params.text ?? "")
}
