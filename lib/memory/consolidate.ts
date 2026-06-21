// The Summariser Agent (bottom of the memory architecture). Episodic logs accumulate raw
// turns; once enough pile up, a CHEAP model distills them into durable facts that flow into
// the semantic store (`memories`) through the existing ingest/reconcile pipeline. This is
// what makes the brain "learn once": transient conversation crystallizes into knowledge.
//
// Lazy + idempotent, exactly like the escalation sweep: no scheduler required. A future cron
// calls consolidateEpisodes() unchanged.

import { and, asc, eq, inArray } from "drizzle-orm"
import { getDb } from "../../db"
import { episodes } from "../../db/schema"
import { audit } from "../escalation/engine"
import { log } from "../log"
import { ingestDocument } from "./ingest"

// Consolidate once this many unconsolidated episodes have piled up (the diagram's
// "only consolidate after # new chats"). Override with CW_CONSOLIDATE_THRESHOLD.
export const CONSOLIDATE_THRESHOLD = Number(process.env.CW_CONSOLIDATE_THRESHOLD ?? 6)
// Don't distill more than this many episodes in a single pass (cost guard).
const MAX_BATCH = Number(process.env.CW_CONSOLIDATE_BATCH ?? 50)

export type ConsolidateResult =
	| { ran: false; pending: number; threshold: number }
	| { ran: true; consolidated: number; memoryIds: string[]; documentId: string | null }

/**
 * Distill unconsolidated episodes into semantic memory.
 * @param force run even if below threshold (e.g. end-of-session flush).
 */
export async function consolidateEpisodes(
	orgId: string,
	opts: { sessionId?: string; force?: boolean } = {},
): Promise<ConsolidateResult> {
	const db = await getDb()
	const where = opts.sessionId
		? and(eq(episodes.orgId, orgId), eq(episodes.consolidated, false), eq(episodes.sessionId, opts.sessionId))
		: and(eq(episodes.orgId, orgId), eq(episodes.consolidated, false))

	// Pull the oldest unconsolidated turns first (FIFO).
	const batch = await db
		.select({
			id: episodes.id,
			role: episodes.role,
			content: episodes.content,
			principalId: episodes.principalId,
			createdAt: episodes.createdAt,
		})
		.from(episodes)
		.where(where)
		.orderBy(asc(episodes.createdAt))
		.limit(MAX_BATCH)

	if (batch.length === 0 || (!opts.force && batch.length < CONSOLIDATE_THRESHOLD)) {
		return { ran: false, pending: batch.length, threshold: CONSOLIDATE_THRESHOLD }
	}

	// Build a readable transcript; extractFacts (run with the cheap model) does the distilling.
	const transcript = batch
		.map((e) => {
			const who = e.role === "user" ? e.principalId ?? "user" : e.role
			return `${who}: ${e.content}`
		})
		.join("\n")

	// Author the resulting facts to the most frequent human participant (attribution that
	// also powers escalation owner-resolution). Falls back to null (org-wide knowledge).
	const author = mostFrequentPrincipal(batch)

	const ingest = await ingestDocument({
		orgId,
		userId: "consolidation",
		content: transcript,
		title: `consolidated:${opts.sessionId ?? "org"}:${batch[0].createdAt.toISOString().slice(0, 10)}`,
		source: "consolidation",
		containerTag: "episodic",
		authorPrincipalId: author ?? undefined,
		useCheapModel: true,
	})

	// Mark the batch consolidated (idempotent: a concurrent pass just re-marks).
	const ids = batch.map((e) => e.id)
	await db
		.update(episodes)
		.set({ consolidated: true, consolidatedAt: new Date(), consolidationMemoryIds: ingest.memoryIds })
		.where(inArray(episodes.id, ids))

	await audit(orgId, "consolidate", {
		sessionId: opts.sessionId ?? null,
		episodes: ids.length,
		memoryIds: ingest.memoryIds,
		documentId: ingest.documentId,
		deduped: ingest.deduped,
	})
	log.info("consolidate", `org=${orgId} episodes=${ids.length} → memories=${ingest.memoryIds.length}`)

	return { ran: true, consolidated: ids.length, memoryIds: ingest.memoryIds, documentId: ingest.documentId }
}

function mostFrequentPrincipal(batch: { role: string; principalId: string | null }[]): string | null {
	const counts = new Map<string, number>()
	for (const e of batch) {
		if (e.role === "user" && e.principalId) counts.set(e.principalId, (counts.get(e.principalId) ?? 0) + 1)
	}
	let best: string | null = null
	let bestN = 0
	for (const [p, n] of counts) {
		if (n > bestN) {
			best = p
			bestN = n
		}
	}
	return best
}
