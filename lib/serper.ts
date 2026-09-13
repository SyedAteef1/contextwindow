// Serper (google.serper.dev) — the search layer behind the instant brief preview.
//
// We only ever read public search results: organic snippets and news. Nothing is
// posted, no session is used, and a missing SERPER_API_KEY degrades to "no preview"
// rather than an error the visitor sees.

import { isPersonalInbox } from "./free-mail"
import { log } from "./log"

const ENDPOINT = "https://google.serper.dev"

export type SearchHit = {
	title: string
	link: string
	snippet: string
	date?: string
}

export const hasSerper = Boolean(process.env.SERPER_API_KEY?.trim())

async function call(path: "/search" | "/news", q: string, num: number): Promise<SearchHit[]> {
	const key = process.env.SERPER_API_KEY?.trim()
	if (!key) return []
	try {
		const res = await fetch(`${ENDPOINT}${path}`, {
			method: "POST",
			headers: { "X-API-KEY": key, "Content-Type": "application/json" },
			body: JSON.stringify({ q, num }),
			// Never let a slow search hold the request open.
			signal: AbortSignal.timeout(8000),
		})
		if (!res.ok) {
			log.warn("serper", `${path} returned ${res.status}`)
			return []
		}
		const data = (await res.json()) as {
			organic?: { title?: string; link?: string; snippet?: string; date?: string }[]
			news?: { title?: string; link?: string; snippet?: string; date?: string }[]
		}
		const rows = path === "/news" ? (data.news ?? []) : (data.organic ?? [])
		return rows
			.filter((r) => r.link && r.title)
			.map((r) => ({
				title: (r.title ?? "").slice(0, 200),
				link: r.link as string,
				snippet: (r.snippet ?? "").slice(0, 500),
				date: r.date,
			}))
	} catch (err) {
		log.warn("serper", `${path} failed: ${err instanceof Error ? err.message : err}`)
		return []
	}
}

/**
 * Normalise "acme.com", "https://acme.com/x" or "dana@acme.com" down to a usable
 * subject. A personal inbox is flagged rather than resolved — its domain names a
 * mail provider, not the company we were asked about.
 */
export function readSubject(input: string): { subject: string; domain?: string; personal?: boolean } {
	const raw = input.trim()
	if (isPersonalInbox(raw)) return { subject: raw, personal: true }
	if (raw.includes("@") && !raw.includes(" ")) {
		const domain = raw.split("@").pop()?.toLowerCase()
		if (domain?.includes(".")) return { subject: domain, domain }
	}
	const urlish = raw.match(/^(?:https?:\/\/)?([a-z0-9-]+(?:\.[a-z0-9-]+)+)(?:\/|$)/i)
	if (urlish) return { subject: urlish[1].toLowerCase(), domain: urlish[1].toLowerCase() }
	return { subject: raw }
}

/**
 * Three passes over public search: what the company is, what changed lately, and
 * who is visible there. Returns a de-duplicated, numbered evidence list.
 */
export async function gatherEvidence(input: string): Promise<SearchHit[]> {
	const { subject, domain } = readSubject(input)
	const label = domain ? `${subject} company` : subject

	const [profile, news, people] = await Promise.all([
		call("/search", label, 6),
		call("/news", subject, 5),
		call("/search", `${subject} leadership OR "head of" OR hiring`, 5),
	])

	const seen = new Set<string>()
	const merged: SearchHit[] = []
	for (const hit of [...profile, ...news, ...people]) {
		if (seen.has(hit.link)) continue
		seen.add(hit.link)
		merged.push(hit)
	}
	return merged.slice(0, 14)
}
