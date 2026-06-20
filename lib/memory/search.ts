// Hybrid retrieval over the memory graph. Vector search across `memories` (the
// structured layer) with keyword fallback, scoped to latest + non-forgotten,
// returned WITH provenance (which documents the memory came from).

import { and, cosineDistance, eq, gt, ilike, inArray, isNull, or, sql } from "drizzle-orm"
import { getDb } from "../../db"
import { documents, memories, memoryDocumentSources } from "../../db/schema"
import { log } from "../log"
import { embedText } from "./embeddings"

export type SearchResult = {
	id: string
	memory: string
	similarity: number
	version: number
	authorPrincipalId: string | null
	sources: { documentId: string; title: string | null; url: string | null }[]
}

export type SearchOptions = {
	orgId: string
	query: string
	containerTag?: string
	limit?: number
	threshold?: number // minimum cosine similarity (0..1)
}

export async function searchMemories(opts: SearchOptions): Promise<SearchResult[]> {
	const db = await getDb()
	const limit = opts.limit ?? 10
	const threshold = opts.threshold ?? 0.25
	const now = new Date()

	log.info("search", `q="${opts.query}" org=${opts.orgId}`)
	const embedding = await embedText(opts.query)
	// Order by raw cosine DISTANCE ascending so the HNSW index is used; expose similarity
	// (1 - distance) for thresholding/output.
	const distance = cosineDistance(memories.memoryEmbedding, embedding)
	const similarity = sql<number>`1 - (${distance})`

	const liveFilter = and(
		eq(memories.orgId, opts.orgId),
		eq(memories.isLatest, true),
		eq(memories.isForgotten, false),
		or(isNull(memories.forgetAfter), gt(memories.forgetAfter, now)),
	)

	const rows = await db
		.select({
			id: memories.id,
			memory: memories.memory,
			version: memories.version,
			authorPrincipalId: memories.authorPrincipalId,
			similarity,
		})
		.from(memories)
		.where(liveFilter)
		.orderBy(distance)
		.limit(limit * 3)

	// Keyword pass merged in (catches exact terms vectors miss).
	const kw = await db
		.select({ id: memories.id, memory: memories.memory, version: memories.version, authorPrincipalId: memories.authorPrincipalId })
		.from(memories)
		.where(and(liveFilter, ilike(memories.memory, `%${opts.query}%`)))
		.limit(limit)

	const byId = new Map<string, { id: string; memory: string; version: number; authorPrincipalId: string | null; similarity: number }>()
	for (const r of rows) if (r.similarity >= threshold) byId.set(r.id, r)
	for (const r of kw) if (!byId.has(r.id)) byId.set(r.id, { ...r, similarity: threshold })

	const top = [...byId.values()].sort((a, b) => b.similarity - a.similarity).slice(0, limit)
	if (top.length === 0) return []

	// Attach provenance.
	const sources = await db
		.select({
			memoryId: memoryDocumentSources.memoryId,
			documentId: documents.id,
			title: documents.title,
			url: documents.url,
		})
		.from(memoryDocumentSources)
		.innerJoin(documents, eq(memoryDocumentSources.documentId, documents.id))
		.where(inArray(memoryDocumentSources.memoryId, top.map((t) => t.id)))

	const srcByMem = new Map<string, SearchResult["sources"]>()
	for (const s of sources) {
		const list = srcByMem.get(s.memoryId) ?? []
		list.push({ documentId: s.documentId, title: s.title, url: s.url })
		srcByMem.set(s.memoryId, list)
	}

	log.info("search", `returning ${top.length} results`)
	return top.map((t) => ({
		id: t.id,
		memory: t.memory,
		similarity: t.similarity,
		version: t.version,
		authorPrincipalId: t.authorPrincipalId,
		sources: srcByMem.get(t.id) ?? [],
	}))
}
