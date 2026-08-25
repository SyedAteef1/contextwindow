# Sales Intel

An AI sales intelligence platform. A rep connects their Google Calendar; before
every external call the system researches the company and the people in the
room and writes a brief; a notetaker joins the call; afterwards the transcript
becomes a summary, a set of buying signals, and — with a human approval click —
a follow-up meeting on the calendar. Everything is stored per account, so the
rep can chat with an agent about the full history of that relationship.

One Next.js app. UI and API in the same codebase, one deploy target, one type
system shared end to end.

---

## What it does

| # | Feature | Where it lives |
|---|---|---|
| 1 | Google OAuth + calendar connection; detects external meetings | `src/lib/google/`, `src/lib/pipeline/calendar-sync.ts` |
| 2 | Meeting bot joins and records; transcript stored | `src/lib/bots/`, `src/app/api/webhooks/bot/` |
| 3 | Research agent — pre-call brief, web-searched and cited | `src/agents/research.ts` |
| 4 | Wrap-up agent — summary, intent signals, follow-up draft | `src/agents/wrapup.ts` |
| 5 | Chat agent — RAG over one account's history | `src/agents/chat.ts` |
| 6 | Free-tier meeting cap | `src/lib/usage.ts` |

**Not built yet — Phase 2:** a real-time in-call agent (live transcript analysis
while the meeting is happening). Deliberately out of scope. Also excluded on
purpose: third-party data enrichment (Clearbit, BuiltWith and friends cost money
per lookup and should wait for revenue) and any fine-tuning — the sales playbook
is prompt-based, stored as plain rows in `playbook_snippets` and retrieved into
agent prompts.

---

## Quick start

Requires Node 20+, Docker (for Postgres), and nothing else to see it working.

```bash
npm install

# Postgres 16 with pgvector, on 5433 so it won't fight a local Postgres
docker run -d --name sales-intel-pg \
  -e POSTGRES_USER=sales -e POSTGRES_PASSWORD=sales -e POSTGRES_DB=sales_intel \
  -p 5433:5432 pgvector/pgvector:pg16

cp .env.example .env         # the defaults already point at that container
npm run db:migrate
npm run db:seed              # two accounts, three meetings, a processed call
npm run dev
```

Then open `http://localhost:3000/api/dev/login` — it signs you in as the seeded
rep without Google. (That route refuses to run in production.)

The defaults are chosen so this works with **no API keys at all**:
`BOT_PROVIDER=noop` and `EMBEDDING_PROVIDER=hash`. You can click through the
whole product, paste a transcript, and query the chat. To get real agent output,
add `ANTHROPIC_API_KEY`.

```bash
npm test          # 53 tests: pure logic + integration against real pgvector
npm run typecheck
npm run build
```

The integration tests need a database. They read `.env.test`, which should point
at a *separate* database from your dev one — they truncate between tests:

```bash
docker exec sales-intel-pg psql -U sales -d postgres -c "CREATE DATABASE sales_intel_test;"
echo "DATABASE_URL=postgres://sales:sales@localhost:5433/sales_intel_test" > .env.test
DATABASE_URL=postgres://sales:sales@localhost:5433/sales_intel_test npm run db:migrate
```

---

## How it fits together

```
Google Calendar
      │  poll (cron, every 15 min)
      ▼
 calendar-sync ──► accounts / contacts / meetings
      │
      ├──► bot provider .scheduleBot(join_at)      ── the bot joins by itself
      │
      └──► research agent ──► meeting_briefs ──┐
                                                │
   bot webhook (bot.state_change: ended)        ├──► embeddings (per account)
      │                                         │
      ▼                                         │
 pull transcript ──► transcripts ───────────────┤
      │                                         │
      └──► wrap-up agent ──► meeting_summaries ─┘
                          ──► intent_signals
                          ──► followup_proposals ──► [rep approves] ──► Calendar
                                                         ▲
                                                   nothing is created
                                                   before this click
```

The chat agent reads `embeddings` filtered by `account_id`, plus
`playbook_snippets`, and answers from that alone.

### Why there is almost no background job

The obvious design polls every minute to dispatch bots ten minutes before each
call. This one doesn't, because it doesn't need to:

- **Bots schedule themselves.** Attendee accepts a `join_at` and joins on time.
  We hand it the time at detection and forget about it.
- **Transcripts arrive by webhook**, not by polling.

That leaves calendar sync as the only recurring job, and it tolerates a
15-minute cadence comfortably. The consequence is that this runs on free
serverless hosting rather than a machine that has to stay awake.

---

## Data model

The eight tables from the brief, under their given names: `accounts`,
`contacts`, `meetings`, `transcripts`, `meeting_briefs`, `meeting_summaries`,
`embeddings`, `usage`. Plus `playbook_snippets`.

Four more exist because the described features need them:

- **`users` / `oauth_credentials`** — the brief starts at "Google OAuth login",
  which needs somewhere to put the rep and their refresh token. Both tokens are
  AES-256-GCM encrypted at rest.
- **`followup_proposals`** — a drafted follow-up has to survive between the
  agent writing it and the rep approving it. This row *is* the approval gate.
- **`webhook_deliveries`** — bot webhooks are at-least-once, so deliveries are
  deduplicated on the provider's idempotency key.

`usage` also carries a `period_start`, which is what makes
"meetings_processed_this_month" mean anything: the counter resets when the
stored period predates the current calendar month.

**Account isolation** is enforced in SQL, not by prompting. `embeddings.account_id`
is `NOT NULL` and every retrieval query filters on it — see
`retrieveForAccount()` in `src/lib/retrieval.ts`. There is an integration test
that indexes distinguishing text under two accounts and asserts that a query
matching one never returns rows from the other.

---

## Cost at low volume

Assumptions: **20 meetings/month, 45 minutes each (15 hours of calls)**, one rep,
Claude Sonnet 5 at standard pricing ($3/$15 per MTok), `us-east-1`.

| Line item | Choice | Monthly |
|---|---|---|
| App hosting | Vercel Hobby | **$0** |
| Scheduled sync | GitHub Actions (free tier) | **$0** |
| Database | Supabase or Neon free tier (both ship pgvector) | **$0** |
| Embeddings | self-hosted open weights, or Voyage at ~$0.01 | **~$0** |
| Meeting bot | Attendee hosted — 5 h free, then $0.50/h → 10 billable hours | **~$5.00** |
| Claude API | ~$0.17 per meeting in tokens (see below) | **~$3.40** |
| Claude web search | billed per search, brief uses ≤ 8 | *verify current rate* |
| Embeddings | Voyage `voyage-3.5-lite`, ~240K tokens | **< $0.01** |
| Transcription | Attendee closed captions | **$0** |
| | | **≈ $8–10/month** |

Per-meeting model cost, measured against the prompt sizes this repo actually
sends (input × $3/MTok + output × $15/MTok):

| Call | Input | Output | Cost |
|---|---|---|---|
| Research brief | ~15K | ~1.5K | $0.068 |
| Summary | ~9K | ~1.2K | $0.045 |
| Intent extraction | ~9K | ~0.8K | $0.039 |
| Follow-up draft | ~3K | ~0.5K | $0.017 |
| **Per meeting** | | | **~$0.17** |
| Chat question | ~5K | ~0.5K | $0.023 each |

Prompt caching is on for the long, stable system prompts, so repeat calls come
in under these figures. Web search is billed separately per search — check the
current rate, it is the largest single variable in the brief's cost.

### Scaling up, and when self-hosting starts to win

| Volume | Attendee hosted | Attendee self-hosted (EC2 `t4g.medium` + 30GB gp3) |
|---|---|---|
| 15 h/month | ~$5 | ~$27 |
| 75 h/month (100 meetings) | ~$35 | ~$27 |
| 150 h/month | ~$73 | ~$27 (until you need a second instance) |

Self-hosting is a flat ~$27/month and stops making sense below roughly 55 hours
of calls a month. **At MVP volume, the hosted bot is about five times cheaper
than the EC2 instance you would run it on** — so start hosted, and move to
self-hosted once call volume passes ~55 h/month. Switching is a change to
`BOT_PROVIDER` and `ATTENDEE_BASE_URL`, not a change to any pipeline code.

Against a **$100 AWS credit**: with the hosted bot and free-tier database, this
architecture spends **nothing on AWS at all**. If you self-host the bot on
`t4g.medium`, $100 buys roughly 3.7 months.

---

## Configuration

Everything is in `.env` — see `.env.example` for the annotated list. The ones
that change behaviour most:

| Variable | Default | Notes |
|---|---|---|
| `LLM_PROVIDER` | `anthropic` | or `glm` for Z.ai's GLM models |
| `ANTHROPIC_MODEL` | `claude-sonnet-5` | `claude-opus-5` is a drop-in upgrade |
| `GLM_MODEL` | `glm-5.3` | used when `LLM_PROVIDER=glm` |
| `BOT_PROVIDER` | `attendee` | `mock` for local development, `meetingbot`, or `noop` |
| `EMBEDDING_PROVIDER` | `hash` | `local` for open-weight models; **never ship `hash`** |
| `EMBEDDING_MODEL` | `bge-m3` | see the embeddings table below |
| `HYBRID_SEARCH` | `false` | dense + sparse fusion; BGE-M3 only |
| `FREE_TIER_MEETING_LIMIT` | `5` | per account, per calendar month |
| `BOT_JOIN_LEAD_MINUTES` | `10` | how early the bot joins |

### Running on GLM instead of Claude

Z.ai serves GLM through an Anthropic-compatible endpoint, so the same
`@anthropic-ai/sdk` client talks to both — set `LLM_PROVIDER=glm` and
`GLM_API_KEY`, and every agent works unchanged.

It is not a pure base-URL swap, though. The compatibility layer covers the core
Messages contract — messages, streaming, tool use — and not the newer
Anthropic-specific surface. `src/lib/llm/providers.ts` holds a capability table
that keeps unsupported parameters off a GLM request, and the guarantees they
provided are rebuilt from primitives that do exist:

| Feature | Anthropic | GLM |
|---|---|---|
| Adaptive thinking, `effort` | native | omitted |
| Structured output | `output_config.format` | forced tool call, validated against the same Zod schema |
| Web search | hosted `web_search_20260209` | client-side tool backed by Z.ai's Web Search API |
| Prompt caching | `cache_control` | omitted |

The structured-output difference is the one worth understanding. GLM's own JSON
mode (`response_format: {type: "json_object"}`) lives on its native API, not the
compatible one, and promises only *valid JSON* — not JSON matching your schema.
A forced tool call carries the schema, and the result is parsed through Zod
either way, so a malformed response is an error rather than bad data.

### Testing the agents

Three harnesses run the real agents against the real database and print what
came back:

```bash
npm run try:bot         # schedule a bot → webhook → transcript → wrap-up
npm run try:meeting     # transcript → summary + buying signals + follow-up draft
npm run try:research    # company + attendees → cited brief (makes live web searches)
```

Each prints the active configuration first, so a surprising result is
explainable. `try:meeting` and `try:research` write to the database and count
against the free tier — the output is visible in the UI afterwards.

#### The bot, locally

Bot webhooks must be HTTPS, and localhost cannot receive one, so with a real
provider the post-call half of the pipeline is awkward to exercise while
developing. `BOT_PROVIDER=mock` closes that gap: it accepts a scheduled bot,
reports itself finished, and returns a canned diarised transcript. Everything
downstream — the webhook endpoint, its shared-secret check, the idempotency
record, the state mapping, transcript storage, indexing, and the wrap-up — then
runs for real.

`npm run try:bot` drives all three stages and posts a genuine
Attendee-shaped `bot.state_change` payload at the running app.

To use the real thing, set `BOT_PROVIDER=attendee` with an `ATTENDEE_API_KEY`
and an HTTPS `APP_URL`. For a real bot against a local server, put a tunnel in
front of it (`cloudflared tunnel --url http://localhost:3000`) and set `APP_URL`
to the tunnel's HTTPS address — the webhook is only registered when `APP_URL`
is HTTPS.

### Embeddings

The vector side is independent of `LLM_PROVIDER` — whoever serves the chat model
has no bearing on what produces the vectors. `EMBEDDING_PROVIDER=local` speaks
the OpenAI `/embeddings` shape, so one provider covers Ollama, Text Embeddings
Inference, Infinity, vLLM, and LM Studio.

Four open-weight models are in the registry, each picked for a different reason:

| Model | Dim | Max ctx | Query prefix | Why you'd pick it |
|---|---|---|---|---|
| **BGE-M3** | 1024 | 8k | none | The only one emitting lexical weights alongside dense vectors — required for hybrid retrieval |
| **Qwen3-Embedding-8B** | 4096 (MRL ≥32) | 32k | `Instruct: …\nQuery:` | Highest precision and by far the longest context; also the heaviest to serve |
| **Arctic-Embed-L-v2.0** | 1024 (MRL ≥256) | 8k | `query: ` | Compression-friendly: 1024 → 256 costs under 3% quality |
| **Nomic Embed v2 (MoE)** | 768 (MRL ≥256) | 512 | `search_query: ` | Mixture-of-experts, so cheapest to run; documents need `search_document: ` too |

**The prefixes matter and are applied for you.** Three of the four encode
queries and documents differently, and getting it wrong doesn't raise an
error — the vectors are still valid and normalised, they just land in the wrong
part of the space and recall quietly drops. `src/lib/embeddings/models.ts` holds
the verified spec for each; `applyPrefix` is what puts it on.

**Dimensions are checked, not assumed.** `EMBEDDING_DIM` has to match both the
model's output and the pgvector column. If a model returns something wider and
supports Matryoshka truncation, the vector is truncated *and re-normalised*
(un-normalised truncation distorts cosine distance). Anything else fails at
request time with the exact remedy, rather than corrupting the index.

Changing `EMBEDDING_DIM` means a new migration for the `vector(N)` column and a
full re-index — the stored vectors are not convertible.

#### Hybrid dense + sparse

Dense embeddings are strong on meaning and weak on rare exact tokens — a
product code, a surname, "SOC 2". Sparse lexical vectors are the reverse. BGE-M3
emits both from a single pass, so hybrid costs roughly one extra request rather
than a second model.

Turning it on needs three things, and the code says which one is missing:

1. `EMBEDDING_MODEL=bge-m3` — no other model here produces sparse weights.
2. `EMBEDDING_SPARSE_URL` — Ollama serves dense only; use TEI's `/embed_sparse`
   or Infinity.
3. `HYBRID_SEARCH=true`.

Results are combined with **reciprocal rank fusion** rather than by adding
scores. Cosine similarity and sparse inner product are on different scales, so
summing them lets whichever produces larger numbers dominate; RRF discards
magnitudes and combines ranks, which needs no per-corpus tuning.

Sparse vectors are stored in a `sparsevec(250002)` column — pgvector caps these
at 1000 non-zero elements, so only the `SPARSE_MAX_TERMS` heaviest weights are
kept. The long tail costs storage without moving the ranking.

#### On `EMBEDDING_PROVIDER=hash`

The default. A deterministic bag-of-words projection with no network call — it
makes the whole retrieval pipeline runnable and testable with no vendor key or
local model, and it produces real lexical similarity. It has **no semantic
understanding**: it will not connect "pricing" to "cost". Development only.

The relevance floor in `retrieveForAccount` is provider-aware for this reason —
the providers score on different scales, and applying the semantic threshold to
lexical scores silently returns nothing for reasonable questions.

---

## Deployment

See [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) for the full walkthrough:
Vercel, the database, Google OAuth setup and scopes, Attendee, the webhook, and
the cron. [`docs/DECISIONS.md`](docs/DECISIONS.md) records the architectural
choices and why the stack ended up different from the original brief.
