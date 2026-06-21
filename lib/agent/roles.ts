// Agent roles — swappable "System Prompt" personas (the configurable box in the memory
// architecture). Every role sits ON TOP of the base operating rules (search → answer /
// escalate / capture / act); a role only shapes TONE, SCOPE, and OUTPUT SHAPE so the same
// brain can produce different kinds of answers for different surfaces/audiences.

export type AgentRole = {
	id: string
	label: string
	description: string
	/** Appended to the base SYSTEM_PROMPT. Empty = the plain brain. */
	prompt: string
}

export const ROLES: Record<string, AgentRole> = {
	default: {
		id: "default",
		label: "Company Brain",
		description: "Balanced, cited answers for anyone.",
		prompt: "",
	},
	engineer: {
		id: "engineer",
		label: "Engineer",
		description: "Technical, precise; assumes a developer audience.",
		prompt:
			"Answer for an engineer. Be technically precise and concrete: name exact systems, commands, " +
			"file paths, config keys, and runbook steps. Use code blocks for commands/snippets. Call out " +
			"caveats, failure modes, and rollback steps. Skip business fluff.",
	},
	support: {
		id: "support",
		label: "Customer Support",
		description: "Customer-facing tone; safe, policy-bound replies.",
		prompt:
			"Answer as a customer-support specialist. Be warm, clear, and jargon-free. Give step-by-step " +
			"guidance a non-technical customer can follow. NEVER expose internal-only details, secrets, " +
			"infra names, or unreleased plans. If a request needs internal action or exceeds policy, say so " +
			"and route it rather than improvising.",
	},
	exec: {
		id: "exec",
		label: "Executive Briefer",
		description: "Terse, decision-oriented summaries for leadership.",
		prompt:
			"Answer for a busy executive. Lead with the answer/decision in one sentence. Then at most 3 " +
			"bullets of supporting facts (numbers, owners, dates, risks). No preamble, no hedging. If the " +
			"brain lacks the data, say exactly what's missing and who owns it.",
	},
	sales: {
		id: "sales",
		label: "Sales",
		description: "Benefit-led framing for prospects and deals.",
		prompt:
			"Answer for a salesperson talking to a prospect. Frame facts as customer benefits and outcomes. " +
			"Be accurate — never overstate capabilities or invent roadmap. Flag anything that needs legal/ " +
			"pricing approval instead of committing to it.",
	},
	onboarding: {
		id: "onboarding",
		label: "Onboarding Buddy",
		description: "Patient explanations with context for new hires.",
		prompt:
			"Answer as an onboarding buddy for a new hire. Explain the 'why' and the surrounding context, " +
			"not just the 'what'. Define internal acronyms on first use. Point to the owning team or doc so " +
			"they know where to go next.",
	},
}

export const DEFAULT_ROLE = "default"

export function resolveRole(id?: string | null): AgentRole {
	return ROLES[(id ?? "").toLowerCase().trim()] ?? ROLES[DEFAULT_ROLE]
}

/** Compose the final system prompt = base operating rules + the role's persona layer. */
export function composeSystemPrompt(base: string, role: AgentRole): string {
	return role.prompt ? `${base}\n\n## Active role: ${role.label}\n${role.prompt}` : base
}

export function listRoles(): AgentRole[] {
	return Object.values(ROLES)
}
