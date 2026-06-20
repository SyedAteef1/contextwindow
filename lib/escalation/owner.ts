// Owner resolution — "who should we ask?" — the expertise graph, lite.
// Tier 1 PERSON: the author of the nearest on-topic memories (excluding the asker).
// Tier 2 TEAM: the team that owns the topic (never a dead end).
// Also builds the time-based backup ladder (`thenTo`): person → team → lead → CTO.

import { searchMemories } from "../memory/search"
import { CTO_PRINCIPAL, teamForTopic, type Team } from "./teams"

const OWNER_SIM_THRESHOLD = 0.5
export const DEFAULT_AFTER_MINUTES = Number(process.env.CW_ESCALATE_AFTER_MINUTES ?? 120)

export type LadderHop = { tier: "person" | "team" | "backup"; routedTo: string; afterMinutes: number }

export type Resolution = {
	tier: "person" | "team"
	ownerPrincipalId: string | null
	ownerTeam: string | null
	routedTo: string
	reason: string
	thenTo: LadderHop[]
}

export async function resolveOwner(orgId: string, question: string, askerPrincipalId?: string | null): Promise<Resolution> {
	const results = await searchMemories({ orgId, query: question, limit: 5 })
	const team = teamForTopic(question)

	// TIER 1 — PERSON: most frequent author among on-topic, attributed memories (not the asker).
	const counts = new Map<string, { n: number; bestSim: number }>()
	for (const r of results) {
		const a = r.authorPrincipalId
		if (!a || r.similarity < OWNER_SIM_THRESHOLD) continue
		if (askerPrincipalId && a === askerPrincipalId) continue // can't ask someone their own question
		const c = counts.get(a) ?? { n: 0, bestSim: 0 }
		c.n += 1
		c.bestSim = Math.max(c.bestSim, r.similarity)
		counts.set(a, c)
	}
	if (counts.size > 0) {
		const owner = [...counts.entries()].sort((a, b) => b[1].n - a[1].n || b[1].bestSim - a[1].bestSim)[0][0]
		return {
			tier: "person",
			ownerPrincipalId: owner,
			ownerTeam: null,
			routedTo: owner,
			reason: `author of ${counts.get(owner)?.n} top memories on this topic`,
			thenTo: backupLadder(team, askerPrincipalId, { includeTeam: true }),
		}
	}

	// TIER 2 — TEAM (never a dead end).
	return {
		tier: "team",
		ownerPrincipalId: null,
		ownerTeam: team.team,
		routedTo: team.teamChannel,
		reason: `no memory author; routed to team ${team.team}`,
		thenTo: backupLadder(team, askerPrincipalId, { includeTeam: false }),
	}
}

/** The remaining hops if the current target doesn't reply in time. Skips the asker. */
function backupLadder(team: Team, asker: string | null | undefined, opts: { includeTeam: boolean }): LadderHop[] {
	const hops: LadderHop[] = []
	if (opts.includeTeam) hops.push({ tier: "team", routedTo: team.teamChannel, afterMinutes: DEFAULT_AFTER_MINUTES })
	if (team.leadPrincipalId !== asker) hops.push({ tier: "backup", routedTo: team.leadPrincipalId, afterMinutes: DEFAULT_AFTER_MINUTES })
	if (CTO_PRINCIPAL !== asker && CTO_PRINCIPAL !== team.leadPrincipalId) hops.push({ tier: "backup", routedTo: CTO_PRINCIPAL, afterMinutes: DEFAULT_AFTER_MINUTES })
	return hops
}
