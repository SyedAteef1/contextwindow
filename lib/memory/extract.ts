// Memory extraction: distill atomic, durable facts from raw content using Bedrock Claude.
// These become `memories` rows — the structured, queryable layer above raw chunks.

import { generateObject } from "ai"
import { z } from "zod"
import { chatModel, cheapChatModel } from "../llm"
import { log } from "../log"

const FactsSchema = z.object({
	facts: z
		.array(
			z.object({
				memory: z.string().describe("One atomic, self-contained fact, decision, or procedure step."),
				isInference: z.boolean().describe("True if inferred rather than stated verbatim."),
			}),
		)
		.describe("Durable facts worth remembering. Skip pleasantries and transient chatter."),
})

export type ExtractedFact = { memory: string; isInference: boolean }

// Offline fallback when the LLM is unavailable (e.g. Bedrock creds missing/expired):
// split content into sentence-sized memories so the brain stays searchable.
function naiveExtract(content: string): ExtractedFact[] {
	return content
		.split(/(?<=[.!?])\s+|\n+/)
		.map((s) => s.trim())
		.filter((s) => s.length >= 20)
		.slice(0, 50)
		.map((memory) => ({ memory, isInference: false }))
}

export async function extractFacts(
	content: string,
	context?: string,
	opts?: { cheap?: boolean },
): Promise<ExtractedFact[]> {
	const trimmed = content.slice(0, 24000)
	try {
		const { object } = await generateObject({
			model: opts?.cheap ? cheapChatModel() : chatModel(),
			schema: FactsSchema,
			system:
				"You are building a company brain. Extract durable, reusable knowledge: how the company " +
				"operates, decisions, policies, procedures, ownership, and exceptions. Each fact must be " +
				"atomic and self-contained (resolve pronouns, include the subject). Ignore greetings and noise.",
			prompt: `${context ? `Context: ${context}\n\n` : ""}Content:\n${trimmed}`,
		})
		log.info("extract", `extracted ${object.facts.length} facts (Bedrock)`)
		return object.facts
	} catch (err) {
		const facts = naiveExtract(trimmed)
		log.warn(
			"extract",
			`Bedrock extraction failed (${err instanceof Error ? err.message : err}); using local fallback → ${facts.length} facts`,
		)
		return facts
	}
}
