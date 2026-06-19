#!/usr/bin/env bun
// Quick ingest CLI for testing the engine end-to-end.
//   bun scripts/ingest.ts "Refunds over $500 require VP approval." --title "Refund policy"
//   echo "..." | bun scripts/ingest.ts --title "Slack thread"

import { ingestDocument } from "../lib/memory/ingest"

const args = process.argv.slice(2)
const flag = (n: string) => {
	const i = args.indexOf(`--${n}`)
	return i >= 0 ? args[i + 1] : undefined
}
const positional = args.filter((a, i) => !a.startsWith("--") && !args[i - 1]?.startsWith("--"))

let content = positional.join(" ").trim()
if (!content && !process.stdin.isTTY) content = await new Response(Bun.stdin.stream()).text()
if (!content) {
	console.error('Usage: bun scripts/ingest.ts "<content>" [--title T] [--tag default]')
	process.exit(1)
}

const res = await ingestDocument({
	orgId: process.env.DEFAULT_ORG_ID ?? "demo-org",
	userId: "cli",
	content,
	title: flag("title"),
	containerTag: flag("tag"),
	source: "cli",
})
console.log(res)
process.exit(0)
