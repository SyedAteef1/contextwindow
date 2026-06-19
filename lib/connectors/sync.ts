// Run a connection's data sync: refresh the token if needed, then pull real data via the
// provider API into the memory engine.

import { and, eq } from "drizzle-orm"
import { getDb } from "../../db"
import { connections } from "../../db/schema"
import { log } from "../log"
import { clientCreds, CONNECTORS, type Provider } from "./registry"

export async function syncConnection(orgId: string, connectionId: string): Promise<{ docs: number; provider: Provider }> {
	const db = await getDb()
	const [conn] = await db
		.select()
		.from(connections)
		.where(and(eq(connections.id, connectionId), eq(connections.orgId, orgId)))
		.limit(1)
	if (!conn) throw new Error("connection not found")

	const cfg = CONNECTORS[conn.provider as Provider]
	if (!cfg) throw new Error(`unknown provider ${conn.provider}`)
	if (!conn.accessToken) throw new Error("connection has no access token — reconnect")

	let accessToken = conn.accessToken
	// Refresh if expiring within 60s and we can.
	if (conn.expiresAt && conn.expiresAt.getTime() < Date.now() + 60_000 && conn.refreshToken && cfg.refresh) {
		const { clientId, clientSecret } = clientCreds(cfg.id)
		const t = await cfg.refresh({ clientId: clientId as string, clientSecret: clientSecret as string, refreshToken: conn.refreshToken })
		accessToken = t.accessToken
		await db
			.update(connections)
			.set({ accessToken: t.accessToken, refreshToken: t.refreshToken ?? conn.refreshToken, expiresAt: t.expiresAt ?? null })
			.where(eq(connections.id, conn.id))
		log.info("sync", `refreshed ${cfg.id} token`)
	}

	log.info("sync", `syncing ${cfg.id} org=${orgId}…`)
	const res = await cfg.sync({
		accessToken,
		orgId,
		userId: conn.userId,
		containerTag: cfg.id,
		metadata: (conn.metadata as Record<string, unknown>) ?? undefined,
	})
	log.info("sync", `${cfg.id} synced ${res.docs} docs`)
	return { docs: res.docs, provider: cfg.id }
}
