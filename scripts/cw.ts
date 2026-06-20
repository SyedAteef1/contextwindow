#!/usr/bin/env bun
// Context Window CLI. Runs the company brain from the terminal using the AWS Bedrock
// credentials in the environment (loaded from .env by Bun). It will NEVER use any other
// AWS account — see lib/llm.ts strict credential policy.
//
//   bun run cw doctor                         check env + creds + db + embeddings
//   bun run cw ingest "<text>" --title T      capture knowledge
//   bun run cw search "<query>" [--tag g]     hybrid search the memory graph
//   bun run cw ask "<question>"               ask the agent (needs valid Bedrock creds)
//   bun run cw connect <provider>             add a connection
//   bun run cw connections                    list connections
//   bun run cw whoami                         show org + Bedrock auth status

import { desc, eq } from "drizzle-orm"
import { getDb } from "../db"
import { connections } from "../db/schema"
import { runAgent } from "../lib/agent/core"
import { listOpenEscalations, resolveEscalation, sweepEscalations } from "../lib/escalation/engine"
import { newId } from "../lib/ids"
import { BEDROCK_MODEL_ID, hasBedrockCreds } from "../lib/llm"
import { ingestDocument } from "../lib/memory/ingest"
import { searchMemories } from "../lib/memory/search"

const ORG = process.env.DEFAULT_ORG_ID ?? "demo-org"
const argv = process.argv.slice(2)
const cmd = argv[0]
const rest = argv.slice(1)
const flag = (n: string) => {
	const i = rest.indexOf(`--${n}`)
	return i >= 0 ? rest[i + 1] : undefined
}
const positional = rest.filter((a, i) => !a.startsWith("--") && !rest[i - 1]?.startsWith("--"))
const region = process.env.BEDROCK_AWS_REGION ?? "ap-south-1"

async function main() {
	switch (cmd) {
		case "doctor": {
			const dbMode = process.env.DATABASE_URL?.startsWith("postgres")
				? "Postgres (DATABASE_URL)"
				: `PGlite (${process.env.PGLITE_DIR ?? ".pgdata"})`
			console.log("Context Window — doctor")
			console.log(`  org:            ${ORG}`)
			console.log(`  db:             ${dbMode}`)
			console.log(`  bedrock creds:  ${hasBedrockCreds ? "present (env)" : "MISSING"}`)
			console.log(`  bedrock region: ${region}`)
			console.log(`  bedrock model:  ${BEDROCK_MODEL_ID}`)
			process.stdout.write("  db connect:     ")
			await getDb()
			console.log("ok (migrated)")
			process.stdout.write("  embeddings:     ")
			const { embedText } = await import("../lib/memory/embeddings")
			const v = await embedText("hello world")
			console.log(`ok (${v.length}-dim)`)
			console.log(
				hasBedrockCreds
					? "  → Bedrock creds found. If 'ask' returns Forbidden, the token is expired — refresh it."
					: "  → No Bedrock creds; 'ask' and LLM extraction are disabled (ingest/search still work).",
			)
			break
		}

		case "ingest": {
			const content = positional.join(" ").trim()
			if (!content) return fail('ingest needs text: cw ingest "<text>" --title T')
			const res = await ingestDocument({
				orgId: ORG,
				userId: "cli",
				content,
				title: flag("title"),
				containerTag: flag("tag"),
				source: "cli",
				authorPrincipalId: flag("author"),
			})
			console.log(res)
			break
		}

		case "search": {
			const query = positional.join(" ").trim()
			if (!query) return fail('search needs a query: cw search "<query>"')
			const results = await searchMemories({
				orgId: ORG,
				query,
				containerTag: flag("tag"),
				limit: flag("limit") ? Number(flag("limit")) : 8,
			})
			if (results.length === 0) console.log("(no results)")
			for (const [i, r] of results.entries()) {
				const src = r.sources.map((s) => s.title || s.url || s.documentId).join(", ") || "—"
				console.log(`${i + 1}. (${r.similarity.toFixed(3)}) ${r.memory}\n   source: ${src}`)
			}
			break
		}

		case "ask": {
			const query = positional.join(" ").trim()
			if (!query) return fail('ask needs a question: cw ask "<question>"')
			if (!hasBedrockCreds) return fail("No Bedrock credentials in env — cannot run the agent.")
			try {
				const result = runAgent({ ctx: { orgId: ORG, surface: "cli" }, query })
				for await (const chunk of result.textStream) process.stdout.write(chunk)
				process.stdout.write("\n")
			} catch (err) {
				const msg = err instanceof Error ? err.message : String(err)
				return fail(`Agent failed: ${msg}\n(If 'Forbidden', the Bedrock token is expired — refresh AWS_BEARER_TOKEN_BEDROCK.)`)
			}
			break
		}

		case "connect": {
			const provider = positional[0]
			if (!provider) return fail("connect needs a provider: cw connect slack")
			const db = await getDb()
			const [c] = await db
				.insert(connections)
				.values({ id: newId("conn"), orgId: ORG, userId: "cli", provider: provider as never, metadata: {} })
				.returning({ id: connections.id, provider: connections.provider })
			console.log("connected:", c)
			break
		}

		case "connections": {
			const db = await getDb()
			const rows = await db
				.select({ id: connections.id, provider: connections.provider, createdAt: connections.createdAt })
				.from(connections)
				.where(eq(connections.orgId, ORG))
				.orderBy(desc(connections.createdAt))
			if (rows.length === 0) console.log("(none)")
			for (const r of rows) console.log(`- ${r.provider}  ${r.id}  ${r.createdAt.toISOString()}`)
			break
		}

		case "whoami":
			console.log({ org: ORG, surface: "cli", bedrock: { creds: hasBedrockCreds, region, model: BEDROCK_MODEL_ID } })
			break

		case "pending": {
			await sweepEscalations(ORG) // lazy time-based backup on every list
			const rows = await listOpenEscalations(ORG)
			if (rows.length === 0) console.log("(no open escalations)")
			for (const e of rows) {
				const due = e.escalateAfter ? e.escalateAfter.toISOString() : "—"
				console.log(`${e.id}  [${e.status}/${e.tier}] → ${e.routedTo}  due:${due}\n   Q: "${e.question}"`)
			}
			break
		}

		case "resolve": {
			const id = positional[0]
			const answer = positional.slice(1).join(" ").trim()
			if (!id || !answer) return fail('resolve needs: cw resolve <esc_id> "<answer>" [--by <principal>]')
			const res = await resolveEscalation(ORG, id, answer, flag("by"))
			if (res.alreadyClosed) {
				console.log("(escalation already closed)")
				break
			}
			console.log("captured memory:", res.memoryId)
			console.log("re-answer to asker:\n" + res.reAnswer)
			break
		}

		case "escalations": {
			if (positional[0] === "sweep") {
				const n = await sweepEscalations(ORG)
				console.log(`${n} escalation(s) bumped`)
			} else {
				console.log("usage: cw escalations sweep")
			}
			break
		}

		default:
			console.log(
				"Context Window CLI\n" +
					"  cw doctor\n" +
					'  cw ingest "<text>" [--title T] [--tag G] [--author P]\n' +
					'  cw search "<query>" [--tag G] [--limit N]\n' +
					'  cw ask "<question>"\n' +
					'  cw pending                          list open escalations\n' +
					'  cw resolve <esc_id> "<answer>" [--by P]   answer an escalation\n' +
					"  cw escalations sweep                run the time-based backup pass\n" +
					"  cw connect <provider>\n" +
					"  cw connections\n" +
					"  cw whoami",
			)
	}
	process.exit(0)
}

function fail(msg: string) {
	console.error(`error: ${msg}`)
	process.exit(1)
}

main().catch((err) => fail(err instanceof Error ? err.message : String(err)))
