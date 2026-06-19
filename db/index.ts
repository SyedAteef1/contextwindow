// Database client. Zero-setup by default: an embedded PGlite (Postgres + pgvector) under
// ./.pgdata, auto-migrated on first use. Set DATABASE_URL to a real Postgres to override.
// Use `await getDb()` everywhere — it ensures the connection (and migrations) are ready.

import { join } from "node:path"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import { log } from "../lib/log"
import * as schema from "./schema"

export type DB = PostgresJsDatabase<typeof schema>

let dbPromise: Promise<DB> | null = null

export function getDb(): Promise<DB> {
	if (!dbPromise) dbPromise = init()
	return dbPromise
}

async function init(): Promise<DB> {
	const url = process.env.DATABASE_URL

	if (url && url.startsWith("postgres")) {
		const { drizzle } = await import("drizzle-orm/postgres-js")
		const postgres = (await import("postgres")).default
		const client = postgres(url, { prepare: false })
		log.info("db", `using Postgres ${url.replace(/:\/\/[^@]*@/, "://***@")}`)
		return drizzle(client, { schema })
	}

	// Embedded PGlite default.
	const dir = process.env.PGLITE_DIR ?? join(process.cwd(), ".pgdata")
	const { PGlite } = await import("@electric-sql/pglite")
	const { vector } = await import("@electric-sql/pglite/vector")
	const { drizzle } = await import("drizzle-orm/pglite")
	const { migrate } = await import("drizzle-orm/pglite/migrator")

	const client = new PGlite(dir, { extensions: { vector } })
	const d = drizzle(client, { schema }) as unknown as DB
	await migrate(d as never, { migrationsFolder: join(process.cwd(), "db", "migrations") })
	log.info("db", `using embedded PGlite at ${dir} (migrated)`)
	return d
}

export { schema }
