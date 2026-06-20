// Agent Core — one brain, many faces. Every surface (Claude, Slack, web, email) calls
// this. It resolves into a permission-scoped tool loop over the SAME tool registry the
// MCP server exposes, so behavior is identical everywhere.
//
// NOTE: several Bedrock models (Mistral, Llama) support tool use only in NON-streaming
// mode. So the agent runs the full tool loop via generateText and exposes a stream-shaped
// result (textStream / toTextStreamResponse) for back-compat with the existing callers.

import { type ModelMessage, generateText, stepCountIs, tool } from "ai"
import { chatModel } from "../llm"
import { log } from "../log"
import { TOOLS, type ToolContext } from "../mcp/tools"

export const SYSTEM_PROMPT = `You are Context Window — a company's brain. You live invisibly inside the tools the team already uses.

Your job:
- ANSWER: when asked anything about how the company works (decisions, policies, people, procedures), call search_memory FIRST, then answer ONLY from what you find. Always cite the source documents.
- ESCALATE: if search_memory returns nothing relevant, DO NOT guess and DO NOT apologize vaguely. Call escalate_to_owner with the user's exact question, then relay its returned message to the asker verbatim. Escalating is the CORRECT behavior when the brain is empty — never fabricate an answer.
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

	// Run the full (multi-step) tool loop without streaming, so tool-capable-but-
	// non-streaming models work. Errors are logged and degraded to a safe message.
	const answer: Promise<string> = generateText({
		model: chatModel(),
		system: SYSTEM_PROMPT,
		messages: msgs,
		tools: buildTools(ctx),
		stopWhen: stepCountIs(8),
	})
		.then((r) => r.text)
		.catch((error) => {
			log.error("agent", "LLM error", error instanceof Error ? error.message : error)
			return ""
		})

	return {
		/** Resolves to the final answer text. */
		text: answer,
		/** Stream-shaped view (yields the full answer once) for back-compat. */
		get textStream() {
			return (async function* () {
				yield await answer
			})()
		},
		/** Plain-text streaming HTTP response (single chunk). */
		toTextStreamResponse() {
			const stream = new ReadableStream<Uint8Array>({
				async start(controller) {
					controller.enqueue(new TextEncoder().encode(await answer))
					controller.close()
				},
			})
			return new Response(stream, { headers: { "content-type": "text/plain; charset=utf-8" } })
		},
	}
}
