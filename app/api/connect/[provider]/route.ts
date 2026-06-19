// Step 1 of OAuth: build the authorize URL and redirect the user to the provider.
// GET /api/connect/<provider>            (?subdomain=acme for Zendesk)

import { getDb } from "../../../../db"
import { oauthStates } from "../../../../db/schema"
import { clientCreds, CONNECTORS, isConfigured, type Provider } from "../../../../lib/connectors/registry"
import { pkce, randomToken } from "../../../../lib/connectors/oauth"
import { log } from "../../../../lib/log"

export const runtime = "nodejs"

const APP_URL = process.env.APP_URL ?? "http://localhost:3000"

export async function GET(req: Request, { params }: { params: Promise<{ provider: string }> }) {
	const { provider } = await params
	const cfg = CONNECTORS[provider as Provider]
	if (!cfg) return Response.json({ error: `Unknown provider: ${provider}` }, { status: 404 })

	if (!isConfigured(cfg.id)) {
		return Response.json(
			{ error: `${cfg.label} is not configured. Set ${cfg.envClientId} and ${cfg.envClientSecret} in .env (see CONNECTORS.md).` },
			{ status: 412 },
		)
	}

	const url = new URL(req.url)
	const subdomain = url.searchParams.get("subdomain") ?? undefined
	if (cfg.needsSubdomain && !subdomain) {
		return Response.json({ error: `${cfg.label} requires ?subdomain=<your-subdomain>` }, { status: 400 })
	}

	const orgId = req.headers.get("x-org-id") ?? process.env.DEFAULT_ORG_ID ?? "demo-org"
	const userId = req.headers.get("x-principal-id") ?? "web"
	const state = randomToken(24)
	const challenge = cfg.usePKCE ? pkce() : undefined

	const db = await getDb()
	await db.insert(oauthStates).values({
		state,
		provider: cfg.id,
		orgId,
		userId,
		codeVerifier: challenge?.verifier ?? null,
		subdomain: subdomain ?? null,
		redirectTo: "/integrations",
		expiresAt: new Date(Date.now() + 10 * 60 * 1000),
	})

	const { clientId } = clientCreds(cfg.id)
	const redirectUri = `${APP_URL}/api/connect/${cfg.id}/callback`
	const authorizeUrl = cfg.authorizeUrl({ clientId: clientId as string, redirectUri, state, challenge: challenge?.challenge, subdomain })

	log.info("connect", `authorize ${cfg.id} org=${orgId}`)
	return Response.redirect(authorizeUrl, 302)
}
