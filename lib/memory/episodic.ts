// Episodic memory — the raw, dated conversation/event log (bottom-right of the memory
// architecture). Every agent turn is appended here verbatim. Two ways it feeds working
// memory: (1) recentEpisodes() = chronological chat history for the prompt; (2)
// recallEpisodes() = RAG top-k over past turns/events. A separate summariser
// (lib/memory/consolidate.ts) later distills these into durable facts in `memories`.

import { and, cosineDistance, desc, eq, sql } from "drizzle-orm"
import { getDb } from "../../db"
import { episodes } from "../../db/schema"
import { newId } from "../ids"
import { log } from "../log"
import { embedText, EMBEDDING_MODEL } from "./embeddings"

export type EpisodeRole = (typeof episodes.$inferInsert)["role"]

export type RecordEpisodeInput = {
	orgId: string
	sessionId: string
	role: EpisodeRole
	content: string
	principalId?: string | null
	surface?: string | null
	metadata?: Record<string, unknown>
}

/** Append one turn/event to the episodic log (embedded for later RAG-over-history). */
export async function recordEpisode(input: RecordEpisodeInput): Promise<string | null> {
	const content = input.content.trim()
	if (!content) return null // never log empty turns
	const db = await getDb()
	// Embedding is best-effort: a logging path must never throw into the agent loop.
	let embedding: number[] | null = null
	try {
		embedding = await embedText(content)
	} catch (err) {
		log.warn("episodic", `embed failed, storing without vector: ${err instanceof Error ? err.message : err}`)
	}
	const id = newId("epi")
	await db.insert(episodes).values({
		id,
		orgId: input.orgId,
		sessionId: input.sessionId,
		principalId: input.principalId ?? null,
		surface: input.surface ?? null,
		role: input.role,
		content,
		embedding,
		embeddingModel: embedding ? EMBEDDING_MODEL : null,
		metadata: input.metadata ?? null,
	})
	return id
}

export type RecalledEpisode = {
	id: string
	role: EpisodeRole
	content: string
	principalId: string | null
	similarity: number
	createdAt: Date
}

/** RAG top-k over past turns/events (optionally scoped to one session). */
export async function recallEpisodes(opts: {
	orgId: string
	query: string
	limit?: number
	sessionId?: string
	threshold?: number
}): Promise<RecalledEpisode[]> {
	const db = await getDb()
	const limit = opts.limit ?? 6
	const threshold = opts.threshold ?? 0.25
	const embedding = await embedText(opts.query)
	const distance = cosineDistance(episodes.embedding, embedding)
	const similarity = sql<number>`1 - (${distance})`
	const where = opts.sessionId
		? and(eq(episodes.orgId, opts.orgId), eq(episodes.sessionId, opts.sessionId))
		: eq(episodes.orgId, opts.orgId)

	const rows = await db
		.select({
			id: episodes.id,
			role: episodes.role,
			content: episodes.content,
			principalId: episodes.principalId,
			createdAt: episodes.createdAt,
			similarity,
		})
		.from(episodes)
		.where(where)
		.orderBy(distance)
		.limit(limit)
	return rows.filter((r) => r.similarity >= threshold)
}

/** Most recent turns in a session, oldest-first (the "current chat history" box). */
export async function recentEpisodes(orgId: string, sessionId: string, limit = 10) {
	const db = await getDb()
	const rows = await db
		.select({ role: episodes.role, content: episodes.content, principalId: episodes.principalId, createdAt: episodes.createdAt })
		.from(episodes)
		.where(and(eq(episodes.orgId, orgId), eq(episodes.sessionId, sessionId)))
		.orderBy(desc(episodes.createdAt))
		.limit(limit)
	return rows.reverse()
}

/** How many episodes are waiting to be consolidated (org-wide, or for one session). */
export async function countUnconsolidated(orgId: string, sessionId?: string): Promise<number> {
	const db = await getDb()
	const where = sessionId
		? and(eq(episodes.orgId, orgId), eq(episodes.consolidated, false), eq(episodes.sessionId, sessionId))
		: and(eq(episodes.orgId, orgId), eq(episodes.consolidated, false))
	const [row] = await db.select({ n: sql<number>`count(*)::int` }).from(episodes).where(where)
	return row?.n ?? 0
}
