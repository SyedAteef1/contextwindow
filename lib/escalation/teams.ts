// Tier-2 routing: map a topic to the team that owns it. v1 is a config map (no DB table) —
// "never a dead end" only needs a default, and a `teams` table is premature until teams are
// self-serve. `CW_CTO_PRINCIPAL` is the final backup in the ladder. Edit AREAS to match the
// real org; the principalIds/channels here are placeholders to be replaced when Slack is live.

export type Team = { team: string; teamChannel: string; leadPrincipalId: string }

const AREAS: { match: RegExp; team: Team }[] = [
	{ match: /\b(deploy|release|infra|infrastructure|kubernetes|k8s|aws|server|on-?call|incident|webhook|api|backend)\b/i, team: { team: "platform", teamChannel: "#platform", leadPrincipalId: "platform-lead" } },
	{ match: /\b(billing|invoice|stripe|refund|payment|pricing|charge)\b/i, team: { team: "finance", teamChannel: "#finance", leadPrincipalId: "finance-lead" } },
	{ match: /\b(sale|sales|deal|crm|prospect|quota|pipeline|demo)\b/i, team: { team: "sales", teamChannel: "#sales", leadPrincipalId: "sales-lead" } },
	{ match: /\b(support|ticket|customer|churn|onboarding)\b/i, team: { team: "support", teamChannel: "#support", leadPrincipalId: "support-lead" } },
	{ match: /\b(hire|hiring|offer|candidate|payroll|pto|leave|\bhr\b)\b/i, team: { team: "people", teamChannel: "#people", leadPrincipalId: "people-lead" } },
]

export const CTO_PRINCIPAL = process.env.CW_CTO_PRINCIPAL ?? "cto"

const DEFAULT_TEAM: Team = { team: "general", teamChannel: "#general", leadPrincipalId: CTO_PRINCIPAL }

export function teamForTopic(text: string): Team {
	return AREAS.find((a) => a.match.test(text))?.team ?? DEFAULT_TEAM
}
