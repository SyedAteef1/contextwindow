/**
 * Database connection.
 *
 * postgres.js over a small pool. In dev the client is stashed on `globalThis`
 * so Next's hot reload doesn't open a new pool on every edit.
 */
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { env } from "@/lib/env";
import * as schema from "./schema";

const globalForDb = globalThis as unknown as {
  __salesIntelSql?: ReturnType<typeof postgres>;
};

function createClient() {
  return postgres(env().DATABASE_URL, {
    // Serverless functions are short-lived; a big pool just exhausts Postgres.
    max: env().NODE_ENV === "production" ? 5 : 3,
    idle_timeout: 20,
    connect_timeout: 15,
    prepare: false, // required for transaction-mode poolers (Supabase, pgBouncer)
    // NOTICEs (truncate cascades, "already exists" on IF NOT EXISTS) are not
    // problems; real failures arrive as errors.
    onnotice: () => {},
  });
}

export const sqlClient = globalForDb.__salesIntelSql ?? createClient();
if (env().NODE_ENV !== "production") globalForDb.__salesIntelSql = sqlClient;

export const db = drizzle(sqlClient, { schema });
export { schema };
export type Db = typeof db;
