// POST /api/connections/sync  { id }  → pull real data from the connected provider.

import { syncConnection } from "../../../../lib/connectors/sync"

export const runtime = "nodejs"
export const maxDuration = 300

const orgOf = (req: Request) => req.headers.get("x-org-id") ?? process.env.DEFAULT_ORG_ID ?? "demo-org"

export async function POST(req: Request) {
	let body: { id?: string }
	try {
		body = await req.json()
	} catch {
		return Response.json({ error: "Invalid JSON" }, { status: 400 })
	}
	if (!body.id) return Response.json({ error: "Missing connection id" }, { status: 400 })
	try {
		const res = await syncConnection(orgOf(req), body.id)
		return Response.json(res)
	} catch (err) {
		return Response.json({ error: err instanceof Error ? err.message : "sync failed" }, { status: 500 })
	}
}
