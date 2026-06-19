// Agent Core — one brain, many faces. Every surface (Claude, Slack, web, email) calls
// this. It resolves into a permission-scoped tool loop over the SAME tool registry the
// MCP server exposes, so behavior is identical everywhere.

import { type ModelMessage, stepCountIs, streamText, tool } from "ai"
import { chatModel } from "../llm"
import { log } from "../log"
import { TOOLS, type ToolContext } from "../mcp/tools"

export const SYSTEM_PROMPT = `You are Context Window — a company's brain. You live invisibly inside the tools the team already uses.

Your job:
- ANSWER: when asked anything about how the company works (decisions, policies, people, procedures), call search_memory FIRST, then answer ONLY from what you find. Always cite the source documents. If the brain has nothing relevant, say so plainly — never invent.
- CAPTURE: when you learn something durable and new, call add_memory so the brain stays current.
- ACT: to perform a real procedure, use the company's skills (list_skills) — high-impact steps require human approval; never bypass a gate.

Be concise and concrete. Prefer the structured memory over guessing. Surface provenance.`

function buildTools(ctx: ToolContext) {
	const entries = TOOLS.map((t) => [
		t.name,
		tool({
			description: t.description,
			inputSchema: t.schema,
			execute: async (args: unknown) => t.handler(args as never, ctx),
		}),
	])
	return Object.fromEntries(entries)
}

export type AgentInput = {
	ctx: ToolContext
	messages?: ModelMessage[]
	query?: string
}

export function runAgent({ ctx, messages, query }: AgentInput) {
	const msgs: ModelMessage[] = messages ?? [{ role: "user", content: query ?? "" }]
	return streamText({
		model: chatModel(),
		system: SYSTEM_PROMPT,
		messages: msgs,
		tools: buildTools(ctx),
		stopWhen: stepCountIs(8),
		onError: ({ error }) =>
			log.error("agent", "LLM error", error instanceof Error ? error.message : error),
	})
}
