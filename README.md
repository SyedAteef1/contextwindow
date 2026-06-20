# Context Window — the Company Brain

An invisible "brain" for a company. It quietly reads the tools a team already uses (Slack,
Claude/MCP, CRM, email), distills everything into a **living memory** that stays current,
and serves back **answers with sources** — inside the same tools. No new app to adopt.

This repo is **two things in one Next.js app**:
1. **The marketing site** — the landing page + "Book a demo" lead form (`app/page.tsx`, `app/apply`).
2. **The brain backend** — ingest → memory → search → answer, exposed over a CLI, HTTP API, Slack, and MCP.

> Deeper design notes live in [`ARCHITECTURE.md`](./ARCHITECTURE.md). Connector OAuth setup is
> in [`CONNECTORS.md`](./CONNECTORS.md). The product vision / use-cases are in [`FEATURES.md`](./FEATURES.md).

---

## How it works (the data flow)

```
                 INGEST                              ASK
  text / Slack msg                          "what did we decide about X?"
        │                                            │
        ▼                                            ▼
  redact secrets                              runAgent (lib/agent/core.ts)
        │                                            │  tool loop (non-streaming)
        ▼                                            ▼
  chunk → embed (local MiniLM, 384-d)         search_memory tool
        │                                            │
        ▼                                            ▼
  extract durable facts (LLM)                 hybrid vector search (pgvector)
        │                                            │
        ▼                                            ▼
  reconcile into memory graph                 answer with sources (never invents)
  (dedupe / version / forget)
        │
        ▼
  Postgres + pgvector  (AWS RDS)
```

**The moat** isn't the search — it's `reconcileMemory()` in `lib/memory/ingest.ts`: when a new
fact duplicates an old one it reinforces it; when it conflicts it **supersedes** (versions) it;
stale facts are **forgotten**. That's what keeps the brain *current* instead of a pile of old messages.

---

## Codebase map (what each part does, and why)

| Path | What / why |
|---|---|
| **`app/page.tsx`** | The marketing landing page (hero, connectors marquee, live Slack demo, pricing, FAQ). |
| **`app/apply/`** | "Book a demo" lead form → posts to `app/api/apply` → saved in MongoDB (`models/Registration.ts`). |
| **`app/integrations/`** | UI to connect data sources (OAuth). Connect flow redirects here. |
| **`app/api/agent/`** | HTTP entry to the brain — calls `runAgent`, streams back the answer. |
| **`app/api/slack/`** | Slack Events + `/ask` endpoint. Verifies signature, ingests channel msgs, answers @mentions/DMs. |
| **`app/api/connect/`** · **`connections/`** | OAuth start/callback for each connector + the "Sync" trigger. |
| **`app/api/mcp/`** | MCP over HTTP (so Claude/agents can use the brain as tools). |
| **`lib/memory/`** | The engine: `ingest.ts` (pipeline + reconcile = the moat), `embeddings.ts` (local model), `extract.ts` (LLM facts), `search.ts` (hybrid retrieval), `chunk.ts`. |
| **`lib/agent/core.ts`** | The one agent loop every surface calls. Non-streaming tool use (Bedrock-model compatible). |
| **`lib/llm.ts`** | The LLM provider (AWS Bedrock, strict env-only credentials). |
| **`lib/mcp/`** | Tool registry (`search_memory`, `add_memory`, …) + transport-agnostic MCP server. |
| **`lib/connectors/`** | `registry.ts` (each provider's OAuth + sync), `oauth.ts`, `sync.ts`. |
| **`lib/slack/`** | `handle.ts` (route events → ingest/answer), `client.ts`, `verify.ts` (signature). |
| **`lib/redact.ts`** | Strips secrets before anything is stored. |
| **`db/`** | `schema.ts` (Drizzle tables), `index.ts` (connects to Postgres, or local PGlite fallback), `migrations/`. |
| **`models/Registration.ts`** | Mongoose model for demo-form leads (separate from the brain DB). |
| **`scripts/`** | `cw.ts` (CLI: `search` / `ask` / `doctor`), `ingest.ts` (push text into the brain), `mcp-stdio.ts`. |
| **`components/`** | Landing-page UI (`connector-marquee`, `sales-demo`, `integration-icons`, `ui/*`). |

---

## Current status

**✅ Working**
- Storage on **AWS RDS PostgreSQL + pgvector** (falls back to embedded PGlite if `DATABASE_URL` is unset).
- Ingest pipeline: chunk → **local embeddings** → **LLM fact extraction** → reconcile into the memory graph.
- Hybrid **search** and the **answer agent** (cites sources, refuses to invent).
- LLM via **AWS Bedrock** (currently `mistral.mistral-large-2402-v1:0` — see note below).
- Marketing site + "Book a demo" form.

**⏳ Not done yet**
- **Slack live ingestion** — connectors are built; needs OAuth connect + a public tunnel for events.
- **MongoDB** for leads — code is ready, but the configured Atlas cluster is currently unreachable.
- Proactive "today" briefings; MCP over HTTP (stdio works today).

> **LLM note:** Anthropic Claude on Bedrock requires an AWS Marketplace subscription, which on
> **Indian (AISPL) accounts needs a credit card**. Mistral/Llama don't, so we run **Mistral Large**
> for now. Switch back to Claude by setting `BEDROCK_MODEL_ID` once a card is on the AWS account.

---

## Running it

```bash
pnpm install            # install deps (this repo uses pnpm)

pnpm dev2               # run the site at https://localhost:3000 (self-signed HTTPS)

# Test the brain from the CLI (uses bun to run the TS scripts):
bun scripts/ingest.ts "Refunds over \$500 need VP approval." --title "Refund policy"
bun scripts/cw.ts search "what's the refund rule"
bun scripts/cw.ts ask    "do refunds need approval?"
```

## Environment

Copy `.env.example` → `.env` and fill in what you need. The essentials:

| Var | For |
|---|---|
| `DATABASE_URL` | AWS RDS Postgres+pgvector (omit → uses local PGlite) |
| `AWS_BEARER_TOKEN_BEDROCK` + `BEDROCK_AWS_REGION` + `BEDROCK_MODEL_ID` | the LLM |
| `SLACK_CLIENT_ID` / `SLACK_CLIENT_SECRET` / `SLACK_SIGNING_SECRET` | Slack |
| `MONGODB_URI` | demo-form leads (separate from the brain) |

Embeddings run **locally** — no key needed. Connector OAuth keys (Notion/Google/etc.) are optional.
