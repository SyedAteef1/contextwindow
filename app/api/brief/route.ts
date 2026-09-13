// Instant brief preview — the fast half of the two-speed promise.
//
// Public search (Serper) → Claude writes a short, cited first pass → returned to
// the landing page while the visitor waits. The reviewed brief still goes out by
// email after a human reads it; this endpoint never claims otherwise.
//
// Everything here is best-effort: no key, no LLM, no search results, or a model
// wobble all return 200-with-nothing so the request itself is never lost.

import { NextResponse } from "next/server"
import { generateObject } from "ai"
import { z } from "zod"
import { chatModel } from "@/lib/llm"
import { gatherEvidence, hasSerper, readSubject } from "@/lib/serper"
import { log } from "@/lib/log"

export const runtime = "nodejs"
export const maxDuration = 60

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** Is a model actually configured? chatModel() throws when credentials are absent. */
function modelReady(): boolean {
	try {
		chatModel()
		return true
	} catch {
		return false
	}
}

// This endpoint costs money per call and needs no auth, so it is capped three
// ways: per IP, per requesting email, and globally per day. In-memory, so the
// counters reset on deploy and are per-instance — fine at this volume.
const HOUR = 60 * 60 * 1000
const DAY = 24 * HOUR
const PER_IP_PER_HOUR = 4
const PER_EMAIL_PER_DAY = 5
const GLOBAL_PER_DAY = 200

type Bucket = { count: number; resetAt: number }
const byIp = new Map<string, Bucket>()
const byEmail = new Map<string, Bucket>()
let global: Bucket = { count: 0, resetAt: Date.now() + DAY }

function take(store: Map<string, Bucket>, key: string, limit: number, window: number): boolean {
	const now = Date.now()
	const existing = store.get(key)
	if (!existing || now > existing.resetAt) {
		store.set(key, { count: 1, resetAt: now + window })
		return true
	}
	if (existing.count >= limit) return false
	existing.count += 1
	return true
}

// Keep the maps from growing without bound on a long-lived instance.
function sweep() {
	const now = Date.now()
	for (const [k, v] of byIp) if (now > v.resetAt) byIp.delete(k)
	for (const [k, v] of byEmail) if (now > v.resetAt) byEmail.delete(k)
}

const briefSchema = z.object({
	company: z.string().describe("The company's name as it writes it, or the input if unclear."),
	summary: z
		.string()
		.describe("What the company does and anything that changed recently. 2-3 sentences. Cite with [n]."),
	people: z
		.string()
		.describe("Who is visible there and what they own, if the sources show it. Empty string if not."),
	recent: z.string().describe("Anything recent and public that changes the conversation. Empty string if none."),
	gaps: z.array(z.string()).describe("What the public sources did NOT show. Be specific and honest."),
	usedSources: z.array(z.number()).describe("1-based indexes of the sources actually cited above."),
})

const SYSTEM = `You write the first pass of a pre-call research brief for a salesperson.

Rules, in order of importance:
1. Every factual claim must come from the numbered sources given to you. Cite inline as [1], [2].
2. If the sources do not support something, do not write it. Never guess a headcount, a funding round, a job title, or a customer.
3. Say plainly what you could not find, in "gaps". A short honest brief beats a long invented one.
4. No adjectives about the company being exciting, innovative or fast-growing. Flat, factual, useful.
5. You do NOT know what the reader sells, so never write about fit, positioning, or what to lead with. That is a person's job later.
6. British-neutral plain English, short sentences, no marketing voice.`

export async function POST(req: Request) {
	let body: { email?: string; target?: string }
	try {
		body = await req.json()
	} catch {
		return NextResponse.json({ ok: false, reason: "bad_request" }, { status: 400 })
	}

	const email = (body.email ?? "").trim().slice(0, 200)
	const target = (body.target ?? "").trim().slice(0, 200)
	if (!EMAIL_RE.test(email) || target.length < 2) {
		return NextResponse.json({ ok: false, reason: "bad_request" }, { status: 400 })
	}

	// A personal inbox names no company; say so instead of researching Gmail.
	if (readSubject(target).personal) {
		return NextResponse.json({ ok: false, reason: "personal_inbox" })
	}

	// No search or no model means no preview — the emailed brief still happens.
	if (!hasSerper || !modelReady()) {
		return NextResponse.json({ ok: false, reason: "preview_unavailable" })
	}

	sweep()
	const now = Date.now()
	if (now > global.resetAt) global = { count: 0, resetAt: now + DAY }
	const ip =
		req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
		req.headers.get("x-real-ip")?.trim() ||
		"unknown"

	if (global.count >= GLOBAL_PER_DAY) return NextResponse.json({ ok: false, reason: "rate_limited" })
	if (!take(byIp, ip, PER_IP_PER_HOUR, HOUR)) return NextResponse.json({ ok: false, reason: "rate_limited" })
	if (!take(byEmail, email.toLowerCase(), PER_EMAIL_PER_DAY, DAY))
		return NextResponse.json({ ok: false, reason: "rate_limited" })
	global.count += 1

	const evidence = await gatherEvidence(target)
	if (evidence.length === 0) {
		return NextResponse.json({ ok: false, reason: "nothing_found", subject: readSubject(target).subject })
	}

	const numbered = evidence
		.map((h, i) => `[${i + 1}] ${h.title}${h.date ? ` (${h.date})` : ""}\n${h.link}\n${h.snippet}`)
		.join("\n\n")

	try {
		const { object } = await generateObject({
			model: chatModel(),
			schema: briefSchema,
			system: SYSTEM,
			prompt: `The salesperson is meeting: ${target}\n\nPublic search results:\n\n${numbered}`,
		})

		// Only hand back sources the model actually leaned on, renumbered to match.
		const used = [...new Set(object.usedSources)]
			.filter((n) => Number.isInteger(n) && n >= 1 && n <= evidence.length)
			.slice(0, 8)
		const sources = (used.length ? used : evidence.slice(0, 4).map((_, i) => i + 1)).map((n) => ({
			n,
			title: evidence[n - 1].title,
			url: evidence[n - 1].link,
		}))

		log.info("brief", `preview written for "${target}" from ${evidence.length} results`)
		return NextResponse.json({
			ok: true,
			brief: {
				company: object.company,
				summary: object.summary,
				people: object.people,
				recent: object.recent,
				gaps: object.gaps.slice(0, 4),
				sources,
			},
		})
	} catch (err) {
		log.warn("brief", `preview failed: ${err instanceof Error ? err.message : err}`)
		return NextResponse.json({ ok: false, reason: "preview_failed" })
	}
}
