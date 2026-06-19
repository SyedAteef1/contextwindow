// Verify Slack request signatures (v0 HMAC-SHA256 over `v0:timestamp:rawBody`).
// Rejects requests older than 5 minutes (replay protection).

import { createHmac, timingSafeEqual } from "node:crypto"

export function verifySlackSignature(
	rawBody: string,
	timestamp: string | null,
	signature: string | null,
	signingSecret: string,
): boolean {
	if (!timestamp || !signature || !signingSecret) return false
	const age = Math.abs(Date.now() / 1000 - Number(timestamp))
	if (!Number.isFinite(age) || age > 300) return false

	const expected = `v0=${createHmac("sha256", signingSecret).update(`v0:${timestamp}:${rawBody}`).digest("hex")}`
	try {
		return timingSafeEqual(Buffer.from(expected), Buffer.from(signature))
	} catch {
		return false
	}
}
