// Minimal signed-cookie session (no auth library). The cookie holds the principalId + an
// expiry, HMAC-signed so it can't be forged. Used to keep a Google/dev login logged in.

import { cookies } from "next/headers"
import { createHmac, timingSafeEqual } from "node:crypto"

const COOKIE = "cw_session"
const SECRET = process.env.SESSION_SECRET || process.env.SLACK_SIGNING_SECRET || "dev-insecure-secret-change-me"
const MAX_AGE = 60 * 60 * 24 * 30 // 30 days (seconds)

function sign(value: string): string {
	const mac = createHmac("sha256", SECRET).update(value).digest("base64url")
	return `${value}.${mac}`
}

function unsign(signed: string): string | null {
	const i = signed.lastIndexOf(".")
	if (i < 0) return null
	const value = signed.slice(0, i)
	const got = Buffer.from(signed.slice(i + 1))
	const want = Buffer.from(createHmac("sha256", SECRET).update(value).digest("base64url"))
	if (got.length === want.length && timingSafeEqual(got, want)) return value
	return null
}

export async function setSession(principalId: string) {
	const payload = `${principalId}|${Date.now() + MAX_AGE * 1000}`
	const jar = await cookies()
	jar.set(COOKIE, sign(payload), { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: MAX_AGE })
}

export async function getSessionPrincipal(): Promise<string | null> {
	const raw = (await cookies()).get(COOKIE)?.value
	if (!raw) return null
	const value = unsign(raw)
	if (!value) return null
	const [principalId, expStr] = value.split("|")
	if (!principalId || Number(expStr) < Date.now()) return null
	return principalId
}

export async function clearSession() {
	const jar = await cookies()
	jar.delete(COOKIE)
}
