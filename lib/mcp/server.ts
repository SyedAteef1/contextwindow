// Transport-agnostic MCP server factory. Wraps the shared tool registry so the same
// capabilities are served over stdio (Claude Desktop / Cursor) and HTTP (remote clients).

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import type { z } from "zod"
import { TOOLS, type ToolContext } from "./tools"

export function createMcpServer(ctx: ToolContext): McpServer {
	const server = new McpServer({ name: "context-window", version: "0.1.0" })
	for (const tool of TOOLS) {
		server.registerTool(
			tool.name,
			{
				description: tool.description,
				// SDK wants a ZodRawShape; our schemas are z.object(...).
				inputSchema: (tool.schema as z.ZodObject<z.ZodRawShape>).shape,
			},
			async (args: unknown) => {
				const text = await tool.handler(args, ctx)
				return { content: [{ type: "text" as const, text }] }
			},
		)
	}
	return server
}
