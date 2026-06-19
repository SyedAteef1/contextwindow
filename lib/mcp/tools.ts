// Single source of truth for the brain's tools. Both the MCP server (stdio + HTTP)
// and the Agent Core consume this registry, so every surface exposes identical
// capabilities. Define a capability once here; it shows up everywhere.

import { eq } from "drizzle-orm"
import { z } from "zod"
import { getDb } from "../../db"
import { skills } from "../../db/schema"
import { ingestDocument } from "../memory/ingest"
import { searchMemories } from "../memory/search"

export type ToolContext = {
	orgId: string
	principalId?: string
	surface: string // "claude" | "slack" | "web" | ...
}

export type ToolDef = {
	name: string
	description: string
	schema: z.ZodTypeAny
	handler: (args: unknown, ctx: ToolContext) => Promise<string>
}

// Preserves per-tool arg typing inside the handler while erasing to a uniform ToolDef.
function defineTool<S extends z.ZodTypeAny>(def: {
	name: string
	description: string
	schema: S
	handler: (args: z.infer<S>, ctx: ToolContext) => Promise<string>
}): ToolDef {
	return def as unknown as ToolDef
}

const searchMemory = defineTool({
	name: "search_memory",
	description:
		"Search the company brain for relevant knowledge. Returns the most relevant memories " +
		"WITH their source documents (provenance). Use this to answer any question about how the " +
		"company operates, decisions, policies, people, or procedures.",
	schema: z.object({
		query: z.string().describe("What you want to know."),
		containerTag: z.string().optional().describe("Restrict to a space/project."),
		limit: z.number().int().min(1).max(25).optional(),
	}),
	handler: async (args, ctx) => {
		const results = await searchMemories({
			orgId: ctx.orgId,
			query: args.query,
			containerTag: args.containerTag,
			limit: args.limit ?? 8,
		})
		if (results.length === 0) return "No relevant memories found."
		return results
			.map((r, i) => {
				const src = r.sources.map((s) => s.title || s.url || s.documentId).join(", ") || "—"
				return `${i + 1}. (${r.similarity.toFixed(2)}) ${r.memory}\n   source: ${src}`
			})
			.join("\n")
	},
})

const addMemory = defineTool({
	name: "add_memory",
	description:
		"Capture new knowledge into the company brain. Content is chunked, embedded, and distilled " +
		"into memories that are versioned against existing ones (updates supersede, duplicates merge).",
	schema: z.object({
		content: z.string().describe("The content to remember."),
		title: z.string().optional(),
		containerTag: z.string().optional(),
	}),
	handler: async (args, ctx) => {
		const res = await ingestDocument({
			orgId: ctx.orgId,
			userId: ctx.principalId ?? "system",
			content: args.content,
			title: args.title,
			containerTag: args.containerTag,
			source: ctx.surface,
		})
		if (res.deduped) return "Already known (duplicate content) — nothing added."
		return `Captured. document=${res.documentId}, memories=${res.memoryIds.length}`
	},
})

const listSkills = defineTool({
	name: "list_skills",
	description:
		"List the company's executable skills (compiled procedures). Each skill encodes steps, " +
		"decisions, and which actions require human approval before an agent may act.",
	schema: z.object({}),
	handler: async (_args, ctx) => {
		const db = await getDb()
		const rows = await db
			.select({ id: skills.id, name: skills.name, description: skills.description })
			.from(skills)
			.where(eq(skills.orgId, ctx.orgId))
		if (rows.length === 0) return "No skills compiled yet."
		return rows.map((s) => `- ${s.name} (${s.id}): ${s.description ?? ""}`).join("\n")
	},
})

const whoAmI = defineTool({
	name: "who_am_i",
	description: "Return the authenticated principal and surface this agent is acting on behalf of.",
	schema: z.object({}),
	handler: async (_args, ctx) =>
		JSON.stringify({ orgId: ctx.orgId, principalId: ctx.principalId ?? null, surface: ctx.surface }),
})

export const TOOLS: ToolDef[] = [searchMemory, addMemory, listSkills, whoAmI]
export const toolByName = new Map(TOOLS.map((t) => [t.name, t]))
