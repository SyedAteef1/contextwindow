import { config } from "dotenv";

config({ path: ".env.test", quiet: true });
config({ path: ".env", quiet: true });

// The search backend must not depend on whether the developer running the
// suite happens to have a Serper key in .env: `auto` would then pick a
// different provider on their machine than in CI. Individual tests opt in.
process.env.SEARCH_PROVIDER = "zai";
delete process.env.SERPER_API_KEY;

// Tests must never reach a paid embedding vendor.
process.env.EMBEDDING_PROVIDER = "hash";
process.env.EMBEDDING_DIM = process.env.EMBEDDING_DIM ?? "1024";
