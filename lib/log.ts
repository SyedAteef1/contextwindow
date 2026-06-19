// Unified logger. Writes to BOTH the console and ./out.log so everything you run
// (dev server, ingest, MCP, agent, API routes) lands in one place.
//   tail -f out.log
// `bun run dev2` also tees Next's own stdout/stderr into out.log.

import { appendFileSync } from "node:fs"
import { join } from "node:path"

const LOG_FILE = join(process.cwd(), "out.log")

type Level = "info" | "warn" | "error"

function write(level: Level, scope: string, msg: string, meta?: unknown) {
	const ts = new Date().toISOString()
	const metaStr = meta === undefined ? "" : ` ${safe(meta)}`
	const line = `${ts} ${level.toUpperCase().padEnd(5)} [${scope}] ${msg}${metaStr}`
	// Console (also captured by dev2's tee).
	const sink = level === "error" ? console.error : level === "warn" ? console.warn : console.log
	sink(line)
	// File (best-effort; never throw from logging). Under `dev2` the tee already writes
	// the console output to out.log, so we skip the direct append to avoid duplicates.
	if (process.env.CW_TEE === "1") return
	try {
		appendFileSync(LOG_FILE, `${line}\n`)
	} catch {
		/* ignore */
	}
}

function safe(meta: unknown): string {
	if (typeof meta === "string") return meta
	try {
		return JSON.stringify(meta)
	} catch {
		return String(meta)
	}
}

export const log = {
	info: (scope: string, msg: string, meta?: unknown) => write("info", scope, msg, meta),
	warn: (scope: string, msg: string, meta?: unknown) => write("warn", scope, msg, meta),
	error: (scope: string, msg: string, meta?: unknown) => write("error", scope, msg, meta),
}
