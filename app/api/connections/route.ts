// Connections status + disconnect. Connecting itself happens via the real OAuth flow at
// /api/connect/<provider> (redirect) → /api/connect/<provider>/callback. There is no
// fake "connect" here — a provider is only "connected" if a real token is stored.

import { and, desc, eq } from "drizzle-orm"
import { getDb } from "../../../db"
import { connections } from "../../../db/schema"
import { ALL_PROVIDERS, CONNECTORS, isConfigured } from "../../../lib/connectors/registry"
import { log } from "../../../lib/log"

export const runtime = "nodejs"

const orgOf = (req: Request) => req.headers.get("x-org-id") ?? process.env.DEFAULT_ORG_ID ?? "demo-org"

export async function GET(req: Request) {
	const db = await getDb()
	const orgId = orgOf(req)
	const rows = await db
		.select({
			id: connections.id,
			provider: connections.provider,
			email: connections.email,
			createdAt: connections.createdAt,
		})
		.from(connections)
		.where(eq(connections.orgId, orgId))
		.orderBy(desc(connections.createdAt))

	const byProvider = new Map(rows.map((r) => [r.provider, r]))
	const providers = ALL_PROVIDERS.map((p) => {
		const cfg = CONNECTORS[p]
		const conn = byProvider.get(p)
		return {
			id: p,
			label: cfg.label,
			configured: isConfigured(p), // client id/secret present in env
			needsSubdomain: Boolean(cfg.needsSubdomain),
			connected: Boolean(conn),
			connectionId: conn?.id ?? null,
		}
	})

	return Response.json({ providers, connections: rows })
}

export async function DELETE(req: Request) {
	const id = new URL(req.url).searchParams.get("id")
	if (!id) return Response.json({ error: "Missing id" }, { status: 400 })
	const db = await getDb()
	await db.delete(connections).where(and(eq(connections.id, id), eq(connections.orgId, orgOf(req))))
	log.info("connections", `disconnected ${id}`)
	return Response.json({ ok: true })
}
