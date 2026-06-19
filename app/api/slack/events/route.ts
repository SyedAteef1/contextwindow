// Slack endpoint: Events API (sensor + @mention), URL verification, and the /ask slash
// command. Verifies the request signature, acks within 3s, and processes work in the
// background via `after()`.

import { after } from "next/server"
import { handleEventCallback, handleSlashCommand } from "../../../../lib/slack/handle"
import { log } from "../../../../lib/log"
import { verifySlackSignature } from "../../../../lib/slack/verify"

export const runtime = "nodejs"

const SIGNING = process.env.SLACK_SIGNING_SECRET ?? ""
const seen = new Set<string>() // per-process event dedup (Slack retries)

export async function POST(req: Request) {
	const raw = await req.text()

	if (!SIGNING) {
		log.error("slack", "SLACK_SIGNING_SECRET not set — cannot verify requests")
		return new Response("not configured", { status: 500 })
	}
	const ok = verifySlackSignature(
		raw,
		req.headers.get("x-slack-request-timestamp"),
		req.headers.get("x-slack-signature"),
		SIGNING,
	)
	if (!ok) return new Response("bad signature", { status: 401 })

	const contentType = req.headers.get("content-type") ?? ""

	// Events API (JSON)
	if (contentType.includes("application/json")) {
		const body = JSON.parse(raw)
		if (body.type === "url_verification") return Response.json({ challenge: body.challenge })
		if (body.type === "event_callback") {
			if (req.headers.get("x-slack-retry-num")) return new Response("ok") // ignore retries
			const id = body.event_id as string | undefined
			if (id && seen.has(id)) return new Response("ok")
			if (id) {
				seen.add(id)
				if (seen.size > 5000) seen.clear()
			}
			after(handleEventCallback(body)) // process after acking
			return new Response("ok")
		}
		return new Response("ok")
	}

	// Slash command (/ask) — form-encoded
	const params = Object.fromEntries(new URLSearchParams(raw))
	if (params.command) {
		after(handleSlashCommand(params))
		return Response.json({ response_type: "ephemeral", text: "Thinking… I'll reply here in a moment." })
	}

	return new Response("ok")
}
