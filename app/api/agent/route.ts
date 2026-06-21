// Agent Core HTTP entrypoint. Surfaces POST here after resolving the user.
// Body: { query: string, role?: string, sessionId?: string } OR { messages: ModelMessage[] }
// Headers: x-org-id, x-principal-id, x-surface (set by the surface adapter).
// `role` (or the x-role header) selects an answer persona — see lib/agent/roles.ts.

import type { ModelMessage } from "ai"
import { runAgent } from "../../../lib/agent/core"
import { log } from "../../../lib/log"
import type { ToolContext } from "../../../lib/mcp/tools"

export const runtime = "nodejs"
export const maxDuration = 60

export async function POST(req: Request) {
	const ctx: ToolContext = {
		orgId: req.headers.get("x-org-id") ?? process.env.DEFAULT_ORG_ID ?? "demo-org",
		principalId: req.headers.get("x-principal-id") ?? undefined,
		surface: req.headers.get("x-surface") ?? "web",
	}

	let body: { query?: string; messages?: ModelMessage[]; role?: string; sessionId?: string }
	try {
		body = await req.json()
	} catch {
		return Response.json({ error: "Invalid JSON body" }, { status: 400 })
	}
	if (!body.query && !body.messages?.length) {
		return Response.json({ error: "Provide `query` or `messages`." }, { status: 400 })
	}

	const role = body.role ?? req.headers.get("x-role") ?? undefined
	const session = body.sessionId ? { id: body.sessionId, principalId: ctx.principalId } : undefined
	log.info("agent", `query from surface=${ctx.surface} org=${ctx.orgId} role=${role ?? "default"}: ${body.query ?? "(messages)"}`)
	const result = runAgent({ ctx, query: body.query, messages: body.messages, role, session })
	return result.toTextStreamResponse()
}
