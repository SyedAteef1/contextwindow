# Context Window — Architecture

> The invisible company brain. It lives in the background of every tool a company already
> uses (Slack, Claude, sales tools, email), **collects** knowledge from each, and **serves**
> answers + proactive "today" briefings back into those same tools. No destination app.
>
> This project reuses the hard, proven substrate from the `supermemory` engine
> (storage + retrieval + memory-graph + MCP) and adds the new product layers on top.

---

## The three planes

```
┌──────────────────────────────────────────────────────────────────────────┐
│  SURFACE PLANE  — each integration is BIDIRECTIONAL (sensor + actuator)     │
│  Slack   Claude/MCP   Sales(CRM)   Email   Web                             │
│   ▲│        ▲│           ▲│          ▲│      ▲│                             │
│   │▼ collect/serve via one normalized AgentEvent contract                   │
└───┼────────────────────────────────────────────────────────────────────────┘
    │
┌───▼──────────────────────────────────────────────────────────────────────┐
│  AGENT CORE  (apps/web → here: app/api/agent)                              │
│   identity resolve → permission scope → router (ANSWER | ACT) → tool loop   │
│   + PROACTIVE engine (scheduled "today headers", triggers)                  │
└───┬──────────────────────────────────────────────────────────────────────┘
    │ MCP + in-process calls
┌───▼──────────────────────────────────────────────────────────────────────┐
│  KNOWLEDGE PLANE  (ported from supermemory)                                │
│   Connectors → Ingest → Memory graph (versioning/contradiction/forgetting) │
│              → Hybrid search → Skills (SKILL.md) → Safe runtime + audit     │
└────────────────────────────────────────────────────────────────────────────┘
```

Two operating modes, **one path**:
- **ANSWER (read)** — grounded retrieval over the memory graph + skills, always with provenance.
- **ACT (write)** — drive a compiled skill through the safe runtime; high-blast-radius steps block at an approval gate.
- **A "today header" is just a query the brain asks itself on someone's behalf** — reactive and proactive share the same Agent Core path.

---

## What we ported from `supermemory` (the crucial substrate)

### Storage — Postgres + pgvector, Drizzle ORM
Faithful port of `packages/validation/schemas.ts`. Core tables (`db/schema.ts`):

| Table | Role | Crucial columns |
|---|---|---|
| `documents` | raw ingested content | `contentHash` (dedupe), `status` pipeline, `summaryEmbedding` |
| `chunks` | semantic chunks | `embedding` vector, `position`; `embeddingNew` for model migration |
| `memories` | distilled facts (**the moat**) | `version`, `isLatest`, `parentMemoryId`, `rootMemoryId`, `memoryRelations` (updates/extends/derives), `isForgotten`, `forgetAfter`, `forgetReason`, `memoryEmbedding` |
| `spaces` | containers / projects | `visibility`, `containerTag` |
| `memory_document_sources` | memory → source provenance | `relevanceScore` |
| `connections` | OAuth integrations | `provider`, tokens, `containerTags` |

New-layer tables we add (the product): `identities` (surface user → principal), `skills` (compiled procedures), `audit_log`.

**The moat is not the search algorithm — it is memory versioning + contradiction handling + temporal forgetting.** That is exactly the part the research papers don't solve and what keeps the brain *current*.

### Memory management (keep-it-current)
- **Versioning**: a new memory that supersedes an old one sets the old `isLatest=false`, links via `parentMemoryId`/`rootMemoryId`, increments `version`.
- **Contradiction**: on ingest, search for similar existing memories; if the new fact conflicts, supersede (relation `updates`); if it adds, relate (`extends`).
- **Forgetting**: `forgetAfter` (scheduled expiry) + `isForgotten` (immediate) + `forgetReason`. Search excludes forgotten / expired by default.

### Retrieval — hybrid
Vector (pgvector cosine) over `memories.memoryEmbedding` + `chunks.embedding`, combined with keyword match, thresholded (`chunkThreshold` / `documentThreshold`), returned **with provenance**. Cosine logic ported from `packages/lib/similarity.ts` (embeddings normalized → cosine == dot product).

### MCP — make the agent compatible with every integration
Supermemory's MCP server (`apps/mcp`, Cloudflare Durable Objects) and `company-brain/mcp-server.ts` (stdio) both use `@modelcontextprotocol/sdk`. The tool wiring, auth logic, and backend client are **100% portable**; only session persistence was Cloudflare-specific. We expose the same tools from a **transport-agnostic factory** (`lib/mcp/server.ts`) with two entrypoints:
- **stdio** (`scripts/mcp-stdio.ts`) — works in Claude Desktop / Cursor today (our first slice).
- **HTTP** (`app/api/mcp/route.ts`) — for remote clients and the Slack/web surfaces later.

---

## Portability decisions vs. supermemory

| supermemory (Cloudflare-first) | Context Window (portable) |
|---|---|
| Cloudflare Workers + Hono | Next.js route handlers (Node runtime) |
| Hyperdrive → Postgres | plain Postgres + pgvector (`postgres` driver) |
| Cloudflare AI embeddings | provider-agnostic `Embedder` (default OpenAI `text-embedding-3-small`, 1536-d) |
| Cloudflare Workflows (async) | start synchronous; add a queue later |
| Durable Objects (MCP session) | stateless HTTP transport / stdio |
| Better Auth + org/user | `identities` table mapping surface users → principals |

---

## Build order
1. ✅ Storage schema (ported)
2. ⏳ Memory engine (embeddings → ingest → hybrid search)
3. ⏳ MCP server (stdio first — the chosen first slice)
4. ⏳ Agent Core route (ANSWER path, then ACT)
5. ⏳ Proactive engine ("today headers")
6. ⏳ Surface adapters (Slack, etc.) → all call the one Agent Core
7. ⏳ Dashboard
