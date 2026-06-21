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
import { composeSystemPrompt, resolveRole } from "./roles"

export const SYSTEM_PROMPT = `You are Context Window — a company's brain. You live invisibly inside the tools the team already uses.

Your job:
- ANSWER: when asked anything about how the company works (decisions, policies, people, procedures), call search_memory FIRST, then answer ONLY from what you find. Always cite the source documents.
- ESCALATE: if search_memory returns nothing relevant, DO NOT guess and DO NOT apologize vaguely. Call escalate_to_owner with the user's exact question, then relay its returned message to the asker verbatim. Escalating is the CORRECT behavior when the brain is empty — never fabricate an answer.
- CAPTURE: when you learn something durable and new, call add_memory so the brain stays current.
- ACT: to perform a real procedure, use the company's skills (list_skills) — high-impact steps require human approval; never bypass a gate.

Be concise and concrete. Prefer the structured memory over guessing. Surface provenance.`

// Log the assistant reply to episodic memory and, once enough turns have piled up, fire the
// summariser (distill episodic → semantic). Best-effort: never let logging break a reply.
async function afterAnswer(ctx: ToolContext, session: { id: string; principalId?: string }, text: string) {
	try {
		const { recordEpisode, countUnconsolidated } = await import("../memory/episodic")
		if (text.trim()) {
			await recordEpisode({ orgId: ctx.orgId, sessionId: session.id, role: "assistant", content: text, surface: ctx.surface })
		}
		const { CONSOLIDATE_THRESHOLD, consolidateEpisodes } = await import("../memory/consolidate")
		const pending = await countUnconsolidated(ctx.orgId)
		if (pending >= CONSOLIDATE_THRESHOLD) {
			// Don't block the reply on consolidation; let it run and just log failures.
			void consolidateEpisodes(ctx.orgId).catch((err) =>
				log.warn("agent", `consolidation failed: ${err instanceof Error ? err.message : err}`),
			)
		}
	} catch (err) {
		log.warn("agent", `episodic logging failed: ${err instanceof Error ? err.message : err}`)
	}
}

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
	/**
	 * When set, the turn is logged to EPISODIC memory: prior turns in the session are loaded
	 * as chat history (the "current chat history" → working-memory box), the user query and the
	 * assistant reply are appended to the log, and consolidation is triggered opportunistically.
	 */
	session?: { id: string; principalId?: string }
	/** Named persona (lib/agent/roles.ts) that shapes tone/scope/output. Defaults to "default". */
	role?: string
	/** Full system-prompt override. Wins over `role`; use for one-off custom prompts. */
	system?: string
}

export function runAgent({ ctx, messages, query, session, role, system }: AgentInput) {
	const systemPrompt = system ?? composeSystemPrompt(SYSTEM_PROMPT, resolveRole(role))
	// Build the full (multi-step) tool loop without streaming, so tool-capable-but-
	// non-streaming models work. Errors are logged and degraded to a safe message.
	const answer: Promise<string> = (async () => {
		let msgs: ModelMessage[] = messages ?? [{ role: "user", content: query ?? "" }]

		// Episodic wiring: load prior history into working memory, then log this user turn.
		if (session && !messages && query) {
			const { recentEpisodes, recordEpisode } = await import("../memory/episodic")
			try {
				const history = await recentEpisodes(ctx.orgId, session.id, 10)
				msgs = [
					...history.map((h) => ({
						role: h.role === "assistant" ? ("assistant" as const) : ("user" as const),
						content: h.content,
					})),
					{ role: "user", content: query },
				]
				await recordEpisode({
					orgId: ctx.orgId,
					sessionId: session.id,
					role: "user",
					content: query,
					principalId: session.principalId,
					surface: ctx.surface,
				})
			} catch (err) {
				log.warn("agent", `episodic history load failed: ${err instanceof Error ? err.message : err}`)
			}
		}

		try {
			const r = await generateText({
				model: chatModel(),
				system: systemPrompt,
				messages: msgs,
				tools: buildTools(ctx),
				stopWhen: stepCountIs(8),
			})
			if (session) await afterAnswer(ctx, session, r.text)
			return r.text
		} catch (error) {
			log.error("agent", "LLM error", error instanceof Error ? error.message : error)
			return ""
		}
	})()

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
