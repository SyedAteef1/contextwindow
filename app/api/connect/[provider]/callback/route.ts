// Step 2 of OAuth: provider redirects back here with ?code & ?state. We verify state,
// exchange the code for real tokens, store the connection, then bounce to /integrations.

import { and, eq } from "drizzle-orm"
import { getDb } from "../../../../../db"
import { connections, oauthStates } from "../../../../../db/schema"
import { clientCreds, CONNECTORS, type Provider } from "../../../../../lib/connectors/registry"
import { newId } from "../../../../../lib/ids"
import { log } from "../../../../../lib/log"
import { getPostHogClient } from "../../../../../lib/posthog-server"

export const runtime = "nodejs"

const APP_URL = process.env.APP_URL ?? "http://localhost:3000"
const back = (qs: string) => Response.redirect(`${APP_URL}/integrations?${qs}`, 302)

export async function GET(req: Request, { params }: { params: Promise<{ provider: string }> }) {
	const { provider } = await params
	const cfg = CONNECTORS[provider as Provider]
	if (!cfg) return Response.json({ error: `Unknown provider: ${provider}` }, { status: 404 })

	const url = new URL(req.url)
	const code = url.searchParams.get("code")
	const state = url.searchParams.get("state")
	const oauthError = url.searchParams.get("error")
	if (oauthError) return back(`error=${encodeURIComponent(oauthError)}`)
	if (!code || !state) return back("error=missing_code_or_state")

	const db = await getDb()
	const [row] = await db.select().from(oauthStates).where(eq(oauthStates.state, state)).limit(1)
	if (!row || row.provider !== cfg.id) return back("error=invalid_state")
	await db.delete(oauthStates).where(eq(oauthStates.state, state))
	if (row.expiresAt.getTime() < Date.now()) return back("error=state_expired")

	try {
		const { clientId, clientSecret } = clientCreds(cfg.id)
		const redirectUri = `${APP_URL}/api/connect/${cfg.id}/callback`
		const tokens = await cfg.exchange({
			clientId: clientId as string,
			clientSecret: clientSecret as string,
			code,
			redirectUri,
			verifier: row.codeVerifier ?? undefined,
			subdomain: row.subdomain ?? undefined,
		})

		// Upsert: one connection per (org, provider).
		const [existing] = await db
			.select({ id: connections.id })
			.from(connections)
			.where(and(eq(connections.orgId, row.orgId), eq(connections.provider, cfg.id)))
			.limit(1)

		const metadata = { ...(tokens.metadata ?? {}), ...(row.subdomain ? { subdomain: row.subdomain } : {}) }
		if (existing) {
			await db.update(connections).set({
				accessToken: tokens.accessToken,
				refreshToken: tokens.refreshToken ?? null,
				expiresAt: tokens.expiresAt ?? null,
				email: tokens.email ?? null,
				metadata,
			}).where(eq(connections.id, existing.id))
		} else {
			await db.insert(connections).values({
				id: newId("conn"),
				orgId: row.orgId,
				userId: row.userId,
				provider: cfg.id,
				accessToken: tokens.accessToken,
				refreshToken: tokens.refreshToken ?? null,
				expiresAt: tokens.expiresAt ?? null,
				email: tokens.email ?? null,
				metadata,
			})
		}

		log.info("connect", `connected ${cfg.id} org=${row.orgId} (real token stored)`)
		const ph = getPostHogClient();
		ph.capture({
			distinctId: row.userId ?? row.orgId,
			event: "integration_connected",
			properties: { provider: cfg.id, org_id: row.orgId, is_reconnect: !!existing },
		});
		return back(`connected=${cfg.id}`)
	} catch (err) {
		const msg = err instanceof Error ? err.message : String(err)
		log.error("connect", `callback failed for ${cfg.id}: ${msg}`)
		return back(`error=${encodeURIComponent(msg.slice(0, 120))}`)
	}
}
