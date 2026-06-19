// HTTP MCP endpoint (stateless JSON-RPC over POST). Spec-compliant single-JSON
// responses — enough for remote MCP clients and the Slack/web surfaces. For local
// Claude/Cursor use the stdio entry (scripts/mcp-stdio.ts).
//
// Identity comes from headers (set by the surface adapter after it resolves the user):
//   x-org-id, x-principal-id, x-surface

import { z } from "zod"
import { toolByName, TOOLS, type ToolContext } from "../../../lib/mcp/tools"

export const runtime = "nodejs"

const PROTOCOL_VERSION = "2025-06-18"

type RpcReq = { jsonrpc: "2.0"; id?: string | number | null; method: string; params?: unknown }
type RpcRes = { jsonrpc: "2.0"; id: string | number | null; result?: unknown; error?: { code: number; message: string } }

function ctxFromHeaders(req: Request): ToolContext {
	return {
		orgId: req.headers.get("x-org-id") ?? process.env.DEFAULT_ORG_ID ?? "demo-org",
		principalId: req.headers.get("x-principal-id") ?? undefined,
		surface: req.headers.get("x-surface") ?? "http",
	}
}

async function dispatch(rpc: RpcReq, ctx: ToolContext): Promise<RpcRes | null> {
	const id = rpc.id ?? null
	// Notifications have no id and expect no response.
	if (rpc.id === undefined && rpc.method.startsWith("notifications/")) return null

	try {
		switch (rpc.method) {
			case "initialize":
				return {
					jsonrpc: "2.0",
					id,
					result: {
						protocolVersion: PROTOCOL_VERSION,
						capabilities: { tools: {} },
						serverInfo: { name: "context-window", version: "0.1.0" },
					},
				}
			case "ping":
				return { jsonrpc: "2.0", id, result: {} }
			case "tools/list":
				return {
					jsonrpc: "2.0",
					id,
					result: {
						tools: TOOLS.map((t) => ({
							name: t.name,
							description: t.description,
							inputSchema: z.toJSONSchema(t.schema),
						})),
					},
				}
			case "tools/call": {
				const params = rpc.params as { name: string; arguments?: unknown }
				const tool = toolByName.get(params.name)
				if (!tool) return { jsonrpc: "2.0", id, error: { code: -32602, message: `Unknown tool: ${params.name}` } }
				const args = tool.schema.parse(params.arguments ?? {})
				const text = await tool.handler(args, ctx)
				return { jsonrpc: "2.0", id, result: { content: [{ type: "text", text }] } }
			}
			default:
				return { jsonrpc: "2.0", id, error: { code: -32601, message: `Method not found: ${rpc.method}` } }
		}
	} catch (err) {
		return { jsonrpc: "2.0", id, error: { code: -32603, message: err instanceof Error ? err.message : "Internal error" } }
	}
}

export async function POST(req: Request) {
	const ctx = ctxFromHeaders(req)
	let body: unknown
	try {
		body = await req.json()
	} catch {
		return Response.json({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } }, { status: 400 })
	}

	const batch = Array.isArray(body)
	const reqs = (batch ? body : [body]) as RpcReq[]
	const responses = (await Promise.all(reqs.map((r) => dispatch(r, ctx)))).filter(Boolean) as RpcRes[]

	if (responses.length === 0) return new Response(null, { status: 202 })
	return Response.json(batch ? responses : responses[0])
}

export function GET() {
	return new Response("MCP endpoint — use POST (JSON-RPC). For stdio use scripts/mcp-stdio.ts.", { status: 405 })
}
