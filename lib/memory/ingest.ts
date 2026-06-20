// Ingest pipeline: content -> document -> chunks(+embeddings) -> memories(reconciled).
// Reconciliation is the moat: new facts are versioned against existing ones
// (duplicate / update / fresh) so the brain stays current instead of accumulating noise.

import { createHash } from "node:crypto"
import { and, cosineDistance, eq, gt, isNull, or, sql } from "drizzle-orm"
import { getDb } from "../../db"
import { chunks, documents, memories, memoryDocumentSources, spaces } from "../../db/schema"
import { newId } from "../ids"
import { log } from "../log"
import { chunkText } from "./chunk"
import { embedText, embedTexts, EMBEDDING_MODEL } from "./embeddings"
import { extractFacts } from "./extract"

// Two facts closer than DUP are the same memory; between UPDATE and DUP, the new one
// supersedes the old (a version bump); below UPDATE it is genuinely new knowledge.
const DUP_THRESHOLD = 0.95
const UPDATE_THRESHOLD = 0.86

const sha = (s: string) => createHash("sha256").update(s).digest("hex")

export async function ensureSpace(orgId: string, ownerId: string, containerTag: string) {
	const db = await getDb()
	const [existing] = await db
		.select()
		.from(spaces)
		.where(and(eq(spaces.orgId, orgId), eq(spaces.containerTag, containerTag)))
		.limit(1)
	if (existing) return existing
	const [created] = await db
		.insert(spaces)
		.values({ id: newId("space"), orgId, ownerId, name: containerTag, containerTag })
		.returning()
	return created
}

export type IngestInput = {
	orgId: string
	userId: string
	content: string
	title?: string
	url?: string
	source?: string
	type?: (typeof documents.$inferInsert)["type"]
	containerTag?: string
	connectionId?: string
	/** Whose knowledge this is (the expertise/escalation owner signal). NOT defaulted to userId. */
	authorPrincipalId?: string
}

export async function ingestDocument(input: IngestInput) {
	const db = await getDb()
	const { orgId, userId } = input
	const containerTag = input.containerTag ?? "default"
	const contentHash = sha(`${orgId}:${input.content}`)
	log.info("ingest", `ingesting "${input.title ?? "(untitled)"}" for org=${orgId} tag=${containerTag}`)

	// Dedupe: identical content for this org is a no-op.
	const [dupe] = await db
		.select({ id: documents.id })
		.from(documents)
		.where(and(eq(documents.orgId, orgId), eq(documents.contentHash, contentHash)))
		.limit(1)
	if (dupe) return { documentId: dupe.id, deduped: true, memoryIds: [] as string[] }

	const space = await ensureSpace(orgId, userId, containerTag)
	const docId = newId("doc")

	await db.insert(documents).values({
		id: docId,
		orgId,
		userId,
		contentHash,
		title: input.title ?? null,
		content: input.content,
		url: input.url ?? null,
		source: input.source ?? null,
		type: input.type ?? "text",
		status: "chunking",
		connectionId: input.connectionId ?? null,
		authorPrincipalId: input.authorPrincipalId ?? null,
	})

	// Chunk + embed + store.
	const pieces = chunkText(input.content)
	if (pieces.length) {
		const vectors = await embedTexts(pieces)
		await db.insert(chunks).values(
			pieces.map((content, i) => ({
				id: newId("chunk"),
				documentId: docId,
				content,
				position: i,
				embedding: vectors[i],
				embeddingModel: EMBEDDING_MODEL,
			})),
		)
	}

	// Extract durable facts -> reconcile into the memory graph.
	const facts = await extractFacts(input.content, input.title)
	const memoryIds: string[] = []
	for (const fact of facts) {
		const id = await reconcileMemory({
			orgId,
			userId,
			spaceId: space.id,
			text: fact.memory,
			isInference: fact.isInference,
			sourceDocumentId: docId,
			authorPrincipalId: input.authorPrincipalId,
		})
		memoryIds.push(id)
	}

	await db
		.update(documents)
		.set({ status: "done", chunkCount: pieces.length, updatedAt: new Date() })
		.where(eq(documents.id, docId))

	log.info("ingest", `done doc=${docId} chunks=${pieces.length} memories=${memoryIds.length}`)
	return { documentId: docId, deduped: false, memoryIds }
}

type ReconcileInput = {
	orgId: string
	userId: string
	spaceId: string
	text: string
	isInference: boolean
	sourceDocumentId: string
	authorPrincipalId?: string
}

/** Version a new fact against the most similar existing latest memory in its space. */
export async function reconcileMemory(input: ReconcileInput): Promise<string> {
	const db = await getDb()
	const embedding = await embedText(input.text)
	const now = new Date()
	// Order by raw distance ascending so the HNSW index is used.
	const distance = cosineDistance(memories.memoryEmbedding, embedding)
	const similarity = sql<number>`1 - (${distance})`

	const [top] = await db
		.select({
			id: memories.id,
			version: memories.version,
			rootMemoryId: memories.rootMemoryId,
			relations: memories.memoryRelations,
			similarity,
		})
		.from(memories)
		.where(
			and(
				eq(memories.spaceId, input.spaceId),
				eq(memories.isLatest, true),
				eq(memories.isForgotten, false),
				or(isNull(memories.forgetAfter), gt(memories.forgetAfter, now)),
			),
		)
		.orderBy(distance)
		.limit(1)

	// Duplicate — reinforce the existing memory's source count, no new row.
	if (top && top.similarity >= DUP_THRESHOLD) {
		await db
			.update(memories)
			.set({
				sourceCount: sql`${memories.sourceCount} + 1`,
				// Claim previously-anonymous knowledge for this author without clobbering an existing one.
				authorPrincipalId: sql`coalesce(${memories.authorPrincipalId}, ${input.authorPrincipalId ?? null})`,
				updatedAt: now,
			})
			.where(eq(memories.id, top.id))
		await linkSource(top.id, input.sourceDocumentId)
		return top.id
	}

	const id = newId("mem")

	// Update — the new fact supersedes the old one (contradiction / refinement).
	if (top && top.similarity >= UPDATE_THRESHOLD) {
		const rootId = top.rootMemoryId ?? top.id
		await db.update(memories).set({ isLatest: false, updatedAt: now }).where(eq(memories.id, top.id))
		await db.insert(memories).values({
			id,
			memory: input.text,
			spaceId: input.spaceId,
			orgId: input.orgId,
			userId: input.userId,
			version: top.version + 1,
			isLatest: true,
			parentMemoryId: top.id,
			rootMemoryId: rootId,
			memoryRelations: { [top.id]: "updates" },
			isInference: input.isInference,
			authorPrincipalId: input.authorPrincipalId ?? null,
			memoryEmbedding: embedding,
			memoryEmbeddingModel: EMBEDDING_MODEL,
		})
		await linkSource(id, input.sourceDocumentId)
		return id
	}

	// Fresh knowledge.
	await db.insert(memories).values({
		id,
		memory: input.text,
		spaceId: input.spaceId,
		orgId: input.orgId,
		userId: input.userId,
		isInference: input.isInference,
		authorPrincipalId: input.authorPrincipalId ?? null,
		memoryEmbedding: embedding,
		memoryEmbeddingModel: EMBEDDING_MODEL,
	})
	await linkSource(id, input.sourceDocumentId)
	return id
}

async function linkSource(memoryId: string, documentId: string) {
	const db = await getDb()
	await db.insert(memoryDocumentSources).values({ memoryId, documentId }).onConflictDoNothing()
}
