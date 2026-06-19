#!/usr/bin/env bun
// Stdio MCP entrypoint — point Claude Desktop / Cursor at this to talk to the company brain.
//   command: "bun", args: ["scripts/mcp-stdio.ts"], cwd: <this project>
// Requires DATABASE_URL, OPENAI_API_KEY (embeddings), ANTHROPIC_API_KEY (extraction).

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
import { createMcpServer } from "../lib/mcp/server"

const orgId = process.env.DEFAULT_ORG_ID ?? "demo-org"
const server = createMcpServer({ orgId, surface: "claude" })
await server.connect(new StdioServerTransport())
