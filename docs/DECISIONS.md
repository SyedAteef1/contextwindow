# Architecture decisions

Where this build diverges from the original brief, and why.

---

## 1. One Next.js app, not FastAPI + a separate frontend

**Brief said:** FastAPI or Node/Express for the backend, Next.js on Vercel for
the frontend.

**Built:** a single Next.js app — route handlers are the API, server components
read the database directly.

One repo, one package manager, one type system shared between client and
server, one deploy. The types in `src/db/schema.ts` are the same types the UI
renders, so a column rename is a compile error rather than a runtime surprise.
A split stack would have bought nothing here: there is no CPU-bound work and no
Python-only library in the pipeline.

---

## 2. Attendee, not MeetingBot

**Brief said:** prefer MeetingBot, since it ships Terraform for AWS and that
minimises setup.

**Built:** Attendee as the default, with MeetingBot behind the same interface.

Three findings changed the recommendation.

**MeetingBot has no transcript endpoint.** Its API router exposes
`POST /bots`, `GET /bots/{id}`, `GET /bots/{id}/recording` → `{ recordingUrl }`,
and `DELETE /bots/{id}`. It records; turning audio into text is the caller's
job. Attendee transcribes natively — free via the meeting platform's own closed
captions, or through Deepgram/AssemblyAI/others if you want higher quality.
Choosing MeetingBot means adding a paid transcription vendor to do what
Attendee does for nothing.

**The Terraform is not cheap to run.** MeetingBot's stack is a VPC, an
Application Load Balancer, an ECS cluster, RDS, and S3, with bot task
definitions at 4 vCPU / 16 GB each. The ALB alone is around $16/month before a
single bot runs. Attendee self-hosts as one Docker image (Django + Postgres +
Redis) on a single instance.

**At MVP volume, neither should be self-hosted.** Attendee's hosted tier is 5
hours free then $0.50/hour. Fifteen hours of calls a month costs about $5 —
roughly a fifth of the ~$27/month EC2 instance you would otherwise run. Self-
hosting overtakes it around 55 hours/month.

The brief's own condition was "prefer it *if the Terraform applies cleanly*".
It was not applied — there are no AWS credentials in this environment and no
`terraform` binary — so that condition was never met, and the decision was made
on the API surface and the cost model instead.

Both providers are implemented against their real APIs (`src/lib/bots/`), so
this is a config change, not a rewrite. Attendee's client was written against
its published OpenAPI document; MeetingBot's against its tRPC/OpenAPI router in
the repository.

Also worth noting: the brief points at `github.com/attendee-dev/attendee`, which
does not exist. The project lives at **`github.com/attendee-labs/attendee`**.

---

## 3. Calendar sync is the only recurring job

**Brief said:** "When a meeting is 10 minutes out, trigger the bot to join."

Read literally that needs a minute-resolution worker. It doesn't, because
Attendee accepts a `join_at` timestamp and joins on time by itself, and posts a
webhook when the call ends. So the bot is scheduled once, at detection, and the
only thing left on a timer is noticing new calendar events.

That single change is what lets the whole system run on free serverless hosting
instead of an always-on machine.

---

## 4. Cron runs from GitHub Actions, not Vercel

Vercel's Hobby plan **caps cron jobs at once per day** — a more frequent
expression fails at deploy time, not at runtime. A daily sync is too coarse: a
meeting booked at 09:00 for 14:00 would never get a bot or a brief.

Rather than pay $20/month for Vercel Pro purely for a scheduler, a GitHub
Actions workflow calls the same endpoint every 15 minutes for free
(`.github/workflows/sync-calendar.yml`). The daily `vercel.json` cron stays as a
backstop, because GitHub delays scheduled runs under load and disables them on
public repos after 60 days without commits.

---

## 5. GLM runs through the Anthropic SDK, but not by base URL alone

Z.ai is the one provider offering an Anthropic-compatible endpoint, so
`LLM_PROVIDER=glm` keeps `@anthropic-ai/sdk` and changes only the base URL, the
auth header, and the model id. GLM authenticates with `Authorization: Bearer`,
which is the SDK's `authToken` option — `apiKey` sends `x-api-key` and is
rejected.

What the compatibility layer covers is the **core Messages contract**: messages,
streaming, and tool use. It does not cover the newer Anthropic-specific
surface, and sending those parameters anyway would fail the request. So
`src/lib/llm/providers.ts` carries a capability table, and the two call shapes
branch on it:

- **Adaptive thinking and `effort`** are omitted entirely on GLM.
- **Structured output.** Anthropic constrains the response with
  `output_config.format`. GLM has no equivalent here — its JSON mode lives on
  the native API and guarantees only *valid JSON*, not schema conformance. A
  forced tool call (`tool_choice: {type: "tool"}`) carries the JSON Schema
  instead, generated from the same Zod schema with `z.toJSONSchema()`. Both
  paths validate through Zod before returning, so a bad response is an error
  rather than silently wrong data.
- **Web search.** Anthropic's `web_search_20260209` runs on Anthropic's servers
  and does not exist behind the shim. GLM has its own Web Search API on the
  native REST host, so search becomes an ordinary client-side tool with a
  bounded execution loop. A side benefit: citations are collected from the
  results we fetched, so they are exactly the sources the model was shown.
- **Prompt caching** is omitted; GLM's context caching works differently.

Callers see none of this — `runText` takes `webSearch: true` and
`runStructured` takes a Zod schema, on either provider.

---

## 6. Embeddings are open weights, served locally, and separate from the LLM

Neither Anthropic nor Z.ai's international platform exposes an embeddings
endpoint on the API this app otherwise talks to, and the strongest models
available are open weights anyway. So the vector side is chosen independently of
`LLM_PROVIDER`, and `EMBEDDING_PROVIDER=local` speaks the OpenAI `/embeddings`
shape — one provider covering Ollama, TEI, Infinity, vLLM, and LM Studio.

Four models are registered, each for a distinct reason: **BGE-M3** because it is
the only one emitting lexical weights alongside dense vectors, which is what
makes hybrid retrieval affordable; **Qwen3-Embedding-8B** for maximum precision
and a 32k context; **Arctic-Embed-L-v2.0** and **Nomic Embed v2** for cheap
local execution with Matryoshka compression.

Two things about this are easy to get wrong, and both fail silently, so both are
handled in code rather than left to configuration:

**Asymmetric prefixes.** Three of the four encode queries differently from
documents — `query: `, `search_query: `, or a full `Instruct: …\nQuery:` block,
with Nomic also requiring `search_document: ` on the document side. Omit the
prefix and nothing errors: the vector is still valid and still normalised, it
just sits in the wrong region of the space and recall drops. The verified spec
for each model lives in `src/lib/embeddings/models.ts` and is applied
automatically.

**Truncation without re-normalisation.** Matryoshka models concentrate
information in the leading dimensions, so a prefix of the vector stands alone —
but only after re-normalising to unit length. Truncating without that step
leaves vectors of inconsistent magnitude and distorts cosine distance, again
with no error. `truncateToDimension` does both.

A dimension that cannot be reconciled is a hard failure with the specific
remedy, not a silent insert.

`hash` remains the default for development: a deterministic bag-of-words
projection with no network call, so the whole pipeline is testable with no model
server. It has no semantic understanding and is not for production.

GLM embeddings exist as a provider but are the weakest option. Z.ai's
international platform documents chat, vision, image, video, audio, tokenizer
and OCR — and no embeddings endpoint. `embedding-3` is on the legacy BigModel
host, a different base URL and possibly a different key, and calls against the
global host have been reported to fail with "unknown model". Running GLM for
chat does not oblige you to run it for vectors.

---

## 7. Hybrid retrieval fuses ranks, not scores

Dense embeddings are weakest exactly where lexical search is strongest: a rare
exact token like a product code, a surname, or "SOC 2". BGE-M3 emits dense and
sparse from one pass, so hybrid costs about one extra request rather than a
second model.

Results are combined with **reciprocal rank fusion**. Adding the scores directly
would be wrong — cosine similarity and sparse inner product are on different
scales, so whichever produces larger numbers would dominate regardless of
relevance. RRF discards magnitudes and combines ranks, which needs no
per-corpus tuning. BGE-M3's own card suggests weighted score fusion, but that
requires normalising each space first; RRF avoids the problem rather than
solving it.

Sparse vectors live in a `sparsevec(250002)` column — the XLM-RoBERTa vocabulary
BGE-M3 rides on. pgvector caps sparsevec at 1000 non-zero elements, so only the
heaviest `SPARSE_MAX_TERMS` weights are stored; the long tail costs storage
without moving the ranking. Note that pgvector indexes sparsevec from 1 while
token ids are 0-based, so indices are shifted on the way in.

The sparse query path is raw SQL, because Drizzle has no sparsevec operators —
but the `account_id` filter is still a bound parameter, so account isolation
holds identically on both paths. There is a test asserting that a *perfect*
lexical match in another account is still not returned.

## 8. Direct Google OAuth rather than an auth library

The app needs a Google **refresh token** to read the calendar in the background
and to write the approved follow-up. Auth.js can be made to surrender one, but
it fights you: the interesting part is `access_type=offline` plus
`prompt=consent`, without which Google omits the refresh token on every login
after the first and the background sync quietly stops working days later.

Three endpoints, written directly (`src/lib/google/oauth.ts`), plus a signed
JWT session cookie. No `googleapis` package either — it is roughly 50 MB of
codegen for three REST calls we can make with `fetch`.

---

## 9. The free-tier gate sits in the pipeline, not in the agents

The brief puts the cap in front of steps 2–4. That check lives in
`advanceMeeting()` and in `ingestTranscript()` rather than inside each agent, so
that:

- a rep can always regenerate a brief by hand for a meeting already counted;
- a transcript is still **stored and indexed** when over quota — the rep's data
  is theirs — while the model spend is what gets skipped;
- the counter increments only after processing *succeeds*, so a crashed run
  doesn't burn quota.

---

## 10. Nothing reaches Google Calendar except through the approval route

`createCalendarEvent` is called from exactly one place:
`POST /api/followups/[id]/approve`. The wrap-up agent writes a
`followup_proposals` row and stops. The UI says so in plain words, and the
status update is guarded on `status = 'pending'` so a double-click cannot
create two events.
