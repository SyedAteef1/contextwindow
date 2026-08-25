/**
 * Applies pending SQL migrations. Run with `npm run db:migrate`.
 *
 * Deliberately separate from the app's connection pool: it opens a single
 * connection, migrates, and exits, so it is safe to run from CI or a one-off
 * container without leaving a pool behind.
 */
import "dotenv/config";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");

  const client = postgres(url, { max: 1, prepare: false });
  try {
    await migrate(drizzle(client), { migrationsFolder: "./src/db/migrations" });
    console.log("Migrations applied.");
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error("Migration failed:", error);
  process.exit(1);
});
