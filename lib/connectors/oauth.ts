// Small OAuth2 helpers shared by all connectors.

import { createHash, randomBytes } from "node:crypto"

export function randomToken(bytes = 32): string {
	return randomBytes(bytes).toString("base64url")
}

/** PKCE (S256) pair. */
export function pkce() {
	const verifier = randomToken(48)
	const challenge = createHash("sha256").update(verifier).digest("base64url")
	return { verifier, challenge }
}

export async function postForm(
	url: string,
	params: Record<string, string>,
	headers: Record<string, string> = {},
): Promise<Record<string, unknown>> {
	const res = await fetch(url, {
		method: "POST",
		headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json", ...headers },
		body: new URLSearchParams(params).toString(),
	})
	const text = await res.text()
	const json = safeJson(text)
	if (!res.ok) throw new Error(`token exchange ${res.status}: ${text.slice(0, 300)}`)
	return json
}

export async function postJson(
	url: string,
	body: unknown,
	headers: Record<string, string> = {},
): Promise<Record<string, unknown>> {
	const res = await fetch(url, {
		method: "POST",
		headers: { "content-type": "application/json", accept: "application/json", ...headers },
		body: JSON.stringify(body),
	})
	const text = await res.text()
	const json = safeJson(text)
	if (!res.ok) throw new Error(`token exchange ${res.status}: ${text.slice(0, 300)}`)
	return json
}

// Returns parsed JSON (object OR array depending on the endpoint), hence `any`.
// biome-ignore lint/suspicious/noExplicitAny: provider responses vary in shape
export async function getJson(url: string, accessToken: string, headers: Record<string, string> = {}): Promise<any> {
	const res = await fetch(url, { headers: { authorization: `Bearer ${accessToken}`, accept: "application/json", ...headers } })
	const text = await res.text()
	if (!res.ok) throw new Error(`api ${res.status}: ${text.slice(0, 200)}`)
	return safeJson(text)
}

function safeJson(text: string): Record<string, unknown> {
	try {
		return JSON.parse(text)
	} catch {
		return { _raw: text }
	}
}

/** seconds-from-now → Date, or null. */
export function expiryFrom(expiresIn: unknown): Date | null {
	const n = typeof expiresIn === "number" ? expiresIn : Number(expiresIn)
	return Number.isFinite(n) && n > 0 ? new Date(Date.now() + n * 1000) : null
}
