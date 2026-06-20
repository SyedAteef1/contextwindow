// The escalation loop engine. Ports supermemory/company-brain patterns to Postgres:
//   createPending()    — idempotent "ask the owner" inbox (one open per topic)
//   resolveEscalation()— capture the owner's reply as a memory + re-answer the asker
//   sweepEscalations() — lazy, idempotent time-based backup (no scheduler needed yet)
//   audit()            — append every hop to the existing audit_log table

import { and, eq, inArray, isNotNull, lte } from "drizzle-orm"
import { getDb } from "../../db"
import { auditLog, escalations } from "../../db/schema"
import { newId } from "../ids"
import { log } from "../log"
import { ingestDocument } from "../memory/ingest"
import { resolveOwner, type LadderHop } from "./owner"

const OPEN_STATES = ["open", "escalated"] as const

/** Crude exact-ish key for "the same question". Semantic dedup is a later upgrade. */
export function normalizeTopic(q: string): string {
	return q.toLowerCase().trim().replace(/\s+/g, " ").replace(/[?.!,;:]+$/g, "")
}

export async function audit(
	orgId: string,
	kind: string,
	payload: Record<string, unknown>,
	who?: { principalId?: string | null; surface?: string },
) {
	const db = await getDb()
	await db.insert(auditLog).values({
		id: newId("audit"),
		orgId,
		principalId: who?.principalId ?? null,
		surface: who?.surface ?? null,
		kind,
		payload,
	})
}

export type CreatePendingInput = {
	orgId: string
	question: string
	askerPrincipalId?: string | null
	surface: string
	askerThreadRef?: string | null
}

/** ASK (Half A): resolve the owner, record an open escalation (idempotent), audit. */
export async function createPending(input: CreatePendingInput) {
	const db = await getDb()
	const topic = normalizeTopic(input.question)

	const findOpen = () =>
		db.select().from(escalations)
			.where(and(eq(escalations.orgId, input.orgId), eq(escalations.topic, topic), inArray(escalations.status, [...OPEN_STATES])))
			.limit(1)

	const [existing] = await findOpen()
	if (existing) {
		await audit(input.orgId, "escalate_dedup", { escalationId: existing.id, topic }, { principalId: input.askerPrincipalId, surface: input.surface })
		return { created: false, escalation: existing }
	}

	const res = await resolveOwner(input.orgId, input.question, input.askerPrincipalId)
	const first = res.thenTo[0]
	const escalateAfter = first ? new Date(Date.now() + first.afterMinutes * 60_000) : null

	try {
		const [row] = await db.insert(escalations).values({
			id: newId("esc"),
			orgId: input.orgId,
			topic,
			question: input.question,
			askerPrincipalId: input.askerPrincipalId ?? null,
			askerSurface: input.surface,
			askerThreadRef: input.askerThreadRef ?? null,
			tier: res.tier,
			ownerPrincipalId: res.ownerPrincipalId,
			ownerTeam: res.ownerTeam,
			routedTo: res.routedTo,
			reason: res.reason,
			escalateAfter,
			thenTo: res.thenTo,
			surface: input.surface,
		}).returning()
		await audit(input.orgId, "escalate", { escalationId: row.id, tier: row.tier, routedTo: row.routedTo, reason: row.reason }, { principalId: input.askerPrincipalId, surface: input.surface })
		return { created: true, escalation: row }
	} catch (err) {
		// Lost a race on the partial-unique index → return the now-open row.
		const [row] = await findOpen()
		if (row) return { created: false, escalation: row }
		throw err
	}
}

/** RESOLVE (Half B): capture reply → memory → mark resolved → re-answer the asker. */
export async function resolveEscalation(orgId: string, escalationId: string, answerText: string, resolverPrincipalId?: string) {
	const db = await getDb()
	const [esc] = await db.select().from(escalations).where(and(eq(escalations.id, escalationId), eq(escalations.orgId, orgId))).limit(1)
	if (!esc) throw new Error(`no such escalation: ${escalationId}`)
	if (!OPEN_STATES.includes(esc.status as (typeof OPEN_STATES)[number])) {
		return { alreadyClosed: true, escalation: esc, memoryId: esc.resultingMemoryId, reAnswer: esc.answerText ?? "" }
	}

	// (a) capture the reply as a memory authored by the OWNER (so it carries authorPrincipalId).
	const author = resolverPrincipalId ?? esc.ownerPrincipalId ?? esc.routedTo
	const ingest = await ingestDocument({
		orgId,
		userId: "escalation",
		authorPrincipalId: author,
		content: `Q: ${esc.question}\nA: ${answerText}`,
		title: `escalation:${esc.topic}`,
		source: esc.surface,
		containerTag: "escalations",
	})

	// (b) mark resolved + link the captured memory.
	await db.update(escalations).set({
		status: "resolved",
		answerText,
		resolvedByPrincipalId: resolverPrincipalId ?? null,
		resultingMemoryId: ingest.memoryIds[0] ?? null,
		escalateAfter: null,
		thenTo: [],
		updatedAt: new Date(),
	}).where(eq(escalations.id, escalationId))
	await audit(orgId, "resolved", { escalationId, memoryId: ingest.memoryIds[0] ?? null, deduped: ingest.deduped }, { principalId: resolverPrincipalId, surface: esc.askerSurface })

	// (c) re-run the original question now that memory has the answer. Dynamic import avoids a cycle.
	let reAnswer = ""
	try {
		const { runAgent } = await import("../agent/core")
		reAnswer = await runAgent({ ctx: { orgId, surface: esc.askerSurface }, query: esc.question }).text
	} catch (err) {
		log.error("escalation", "re-answer failed", err instanceof Error ? err.message : err)
	}
	if (!reAnswer.trim()) {
		reAnswer = answerText // never leave the asker with nothing
		await audit(orgId, "resolve_reanswer_miss", { escalationId }, { surface: esc.askerSurface })
	}
	return { escalation: esc, memoryId: ingest.memoryIds[0] ?? null, reAnswer }
}

/** Lazy time-based BACKUP. Safe at any cadence (idempotent); a future cron calls this unchanged. */
export async function sweepEscalations(orgId: string, now = new Date()): Promise<number> {
	const db = await getDb()
	const due = await db.select().from(escalations).where(and(
		eq(escalations.orgId, orgId),
		inArray(escalations.status, [...OPEN_STATES]),
		isNotNull(escalations.escalateAfter),
		lte(escalations.escalateAfter, now),
	))

	let bumped = 0
	for (const esc of due) {
		const queue = [...((esc.thenTo as LadderHop[] | null) ?? [])]
		if (queue.length === 0) {
			// Exhausted the ladder → terminal. CAS so we don't expire a row a human just resolved.
			const done = await db.update(escalations).set({ status: "expired", escalateAfter: null, updatedAt: now })
				.where(and(eq(escalations.id, esc.id), inArray(escalations.status, [...OPEN_STATES]))).returning({ id: escalations.id })
			if (done.length) await audit(orgId, "expired", { escalationId: esc.id })
			continue
		}
		const next = queue.shift() as LadderHop
		const nextAfter = queue.length ? new Date(now.getTime() + queue[0].afterMinutes * 60_000) : null
		const done = await db.update(escalations).set({
			status: "escalated",
			tier: next.tier,
			routedTo: next.routedTo,
			reason: `timeout → escalated to ${next.routedTo}`,
			thenTo: queue,
			escalateAfter: nextAfter,
			updatedAt: now,
		}).where(and(eq(escalations.id, esc.id), inArray(escalations.status, [...OPEN_STATES]))).returning({ id: escalations.id })
		if (done.length) {
			bumped += 1
			await audit(orgId, "escalate_bump", { escalationId: esc.id, toTier: next.tier, routedTo: next.routedTo })
		}
	}
	return bumped
}

/** Open escalations for an org (most recent first). */
export async function listOpenEscalations(orgId: string) {
	const db = await getDb()
	return db.select().from(escalations)
		.where(and(eq(escalations.orgId, orgId), inArray(escalations.status, [...OPEN_STATES])))
		.orderBy(escalations.createdAt)
}
