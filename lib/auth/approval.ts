// Onboarding/access approval. A login (Google/dev) finds-or-creates an identity; if the
// email is on the allowed company domain it's auto-approved, otherwise it's left pending and
// an Approve/Deny card is posted to Slack. The card's buttons hit /api/slack/interactions.

import { and, eq } from "drizzle-orm"
import { getDb } from "../../db"
import { identities } from "../../db/schema"
import { newId } from "../ids"
import { log } from "../log"
import { slackPostMessage } from "../slack/client"

const ORG = process.env.DEFAULT_ORG_ID ?? "demo-org"
// Auto-approve emails on this domain. Blank/unset = no auto-approve (every login needs Slack approval).
const ALLOWED_DOMAIN = (process.env.AUTH_ALLOWED_DOMAIN ?? "").trim().toLowerCase()
// Dedicated approvals channel (separate from demo leads). Invite the bot to it.
const APPROVALS_CHANNEL = process.env.SLACK_APPROVALS_CHANNEL ?? "C0BBY65C2DU"
// Optional: a Slack user id to @-mention on each request, e.g. SLACK_APPROVER=U0ABC123.
const APPROVER_TAG = process.env.SLACK_APPROVER ? `<@${process.env.SLACK_APPROVER}> ` : ""

export type IdentityRow = typeof identities.$inferSelect

/** Find-or-create a login identity; apply domain auto-approve; post a Slack card if pending. */
export async function upsertLoginIdentity(opts: {
	surface: string
	surfaceUserId: string
	email: string
	displayName?: string | null
}): Promise<IdentityRow> {
	const db = await getDb()
	const email = opts.email.trim().toLowerCase()

	const [existing] = await db
		.select()
		.from(identities)
		.where(and(eq(identities.surface, opts.surface), eq(identities.surfaceUserId, opts.surfaceUserId)))
		.limit(1)
	if (existing) return existing // already onboarded — keep whatever status it has

	const domainOk = ALLOWED_DOMAIN ? email.endsWith(`@${ALLOWED_DOMAIN}`) : false
	const status = domainOk ? "approved" : "pending"
	const principalId = `${opts.surface}:${opts.surfaceUserId}`

	const [row] = await db
		.insert(identities)
		.values({
			id: newId("idn"),
			orgId: ORG,
			principalId,
			surface: opts.surface,
			surfaceUserId: opts.surfaceUserId,
			email,
			displayName: opts.displayName ?? null,
			status,
			approvedBy: domainOk ? "auto:domain" : null,
			approvedAt: domainOk ? new Date() : null,
		})
		.returning()

	log.info("auth", `login identity ${principalId} (${email}) → ${status}`)
	if (!domainOk) await postApprovalCard(row)
	return row
}

async function postApprovalCard(row: IdentityRow) {
	const token = process.env.SLACK_BOT_TOKEN
	if (!token) {
		log.warn("auth", "SLACK_BOT_TOKEN missing — cannot post approval card")
		return
	}
	const name = row.displayName || row.email || row.principalId
	const blocks = [
		{ type: "header", text: { type: "plain_text", text: "👤 New access request", emoji: true } },
		{
			type: "section",
			fields: [
				{ type: "mrkdwn", text: `*Name*\n${name}` },
				{ type: "mrkdwn", text: `*Email*\n${row.email ?? "—"}` },
			],
		},
		{
			type: "actions",
			elements: [
				{ type: "button", style: "primary", text: { type: "plain_text", text: "✓ Approve", emoji: true }, action_id: "approve_identity", value: row.id },
				{ type: "button", style: "danger", text: { type: "plain_text", text: "✗ Deny", emoji: true }, action_id: "deny_identity", value: row.id },
			],
		},
	]
	const res = await slackPostMessage(token, APPROVALS_CHANNEL, `${APPROVER_TAG}New access request: ${name} (${row.email})`, undefined, blocks)
	if (!res.ok) log.error("auth", `approval card post failed: ${res.error}`)
}

/** Approve/deny an identity (from the Slack button). */
export async function decideIdentity(id: string, decision: "approved" | "denied", approver: string): Promise<IdentityRow | null> {
	const db = await getDb()
	const [row] = await db
		.update(identities)
		.set({ status: decision, approvedBy: approver, approvedAt: new Date() })
		.where(eq(identities.id, id))
		.returning()
	return row ?? null
}

export async function getIdentityByPrincipal(principalId: string): Promise<IdentityRow | null> {
	const db = await getDb()
	const [row] = await db.select().from(identities).where(eq(identities.principalId, principalId)).limit(1)
	return row ?? null
}
