# Context Window — System Design (the brain's behavior)

> `ARCHITECTURE.md` covers the *storage substrate* (ported from supermemory).
> This doc covers the *behavior* layer we're building on top: how the brain decides to
> answer, escalate, brief, and alert — across roles and integrations.

## Core principle: one pipeline, many triggers

Everything the brain does is **"run an Inquiry on someone's behalf."** Only the trigger differs.

| User-facing thing | = an Inquiry triggered by |
|---|---|
| Answering a Slack question | a person, *now* |
| The morning "today" briefing | a *schedule* |
| "⚠️ Acme renewal is slipping" | an *event / rule* |
| Asking @Sam because it's unsure | a *low-confidence inquiry* spawning a new one |

```
        TRIGGERS:  ask(now)   schedule   event/rule
                        │
                        ▼
                   ┌──────────┐   Inquiry { question, onBehalfOf{principal,role,clearance}, trigger }
                   │ INQUIRY  │
                   └────┬─────┘
                        ▼
            retrieve (scoped to permissions + tuned to role)
                        ▼
                ╔═══════════════╗
                ║ CONFIDENCE    ║   = the agent choosing a tool (no separate engine)
                ║ GATE          ║
                ╚═══╤═══════╤═══╝
            confident│       │ unsure / gap
                     ▼       ▼
                 ANSWER   ESCALATE → find owner → ask them → capture reply → re-answer
                     │       │        (next time: instant, no human pinged)
                     ▼       ▼
                 DELIVER: Slack reply · DM briefing · alert
```

The "confidence gate" is **not** new control flow — the agent gets an `escalate_to_owner`
tool and is told *"if you can't answer from memory, escalate instead of guessing."*

## The 6 pillars (what roles + integrations force us to design for)

1. **Identity Graph** — one person ↔ many surfaces (Slack `@sammy` = GitHub `sam` = `sam@co`). → `identities.principalId` groups them.
2. **Permission / Visibility** — every memory is scoped; every asker has clearance. An engineer must not learn a salary from a private channel. → `spaces.visibility` + role.
3. **Typed ingestion** — one normalized shape, but keep source specifics (a PR's `status`, a ticket's `severity`). This is what makes it *code-aware*. → `documents.metadata`.
4. **Expertise / Ownership Graph** — who knows what, from authorship across all sources. Powers escalation routing. → `authorPrincipalId`.
5. **Role Profiles** — same memory, served differently (CEO: money/risk; engineer: the diff). → `identities.roles`.
6. **Freshness & Versioning** — current vs stale; supersede on conflict, forget when expired. → memory versioning (already built).

## Integration map (each is sensor + trigger source)

| Integration | Ingests | Trigger events | Authorship → expertise | Default visibility |
|---|---|---|---|---|
| Slack | messages, threads | new msg, @mention | message author | channel (public/private/DM) |
| **GitHub** | PRs, issues, READMEs | PR merged/opened | **PR author** (+ shipped-vs-branch) | repo (public/private) |
| Notion / Drive | docs, pages | doc updated | doc owner | workspace ACL |
| Gmail | emails | new email | sender | private to participants |
| Calendar | events | meeting soon / date passed | organizer | attendees |
| CRM | deals, contacts | stage change | deal owner | sales |
| Zendesk | tickets | created / Nx repeat | assignee | support |
| PagerDuty | incidents | incident fired | on-call | eng/ops |

All integrations set `authorPrincipalId` on what they ingest → the expertise graph fills in automatically.

## Role map (how serving adapts)

| Role | Asks about | Briefing pulls | Clearance | Tuning |
|---|---|---|---|---|
| Founder/CEO | decisions, strategy | leadership, CRM, calendar, incidents, releases | all | money · risk · people |
| CTO/Eng | architecture, ownership, shipped status | PRs, incidents, blockers | eng + most | technical, with the PR |
| Sales | demo flow, pricing, what's shipped | deal changes, follow-ups | sales (not eng-private) | customer-friendly |
| Customer Success | "when ships X", known issues | tickets, churn, ship dates | support + customer data | date + caveat |
| PM | feature requests, decisions | request clusters, roadmap | product | aggregated + decision log |
| HR/Finance/Legal | policies, contracts, comp | domain status | own domain only | exact, sourced |

## Schema footprint (forward-compatible, minimal)

The supermemory port already reserves: `metadata` jsonb everywhere, `spaces.visibility`,
`identities.roles[]`, full memory versioning/forgetting, `memoryDocumentSources` provenance.
**We add only:**
- `authorPrincipalId` (indexed) on `documents` + `memories` — the expertise/ownership signal.
- `escalations` table + `escalationStatus` enum — the loop's state.

## Build order (each is a demo-able milestone)

1. **Escalation Loop** ← *first.* Schema (above) → `escalate_to_owner` tool → owner resolution (expertise-lite) → resolve handler → CLI test on AWS RDS. Slack-ready by design.
2. **Slack live** — real messages in; escalation Half-A posts to owners, Half-B fires on their reply.
3. **GitHub** — best expertise signal + code-awareness.
4. **Proactive engine** — scheduled "today" briefings (role-aware) + event/rule alerts.
5. Other connectors (Notion/Drive/CRM/Zendesk/PagerDuty) — all feed expertise + triggers.
6. Permissions enforcement, audit log, then the skills/ACT runtime.

## Escalation Loop — concrete (build #1)

**Route to a `principalId` (a person/team), never a raw Slack id** — so identity/expertise/
permissions apply and CLI-now → Slack-later is just a different delivery surface.

### The 3-tier resolution ladder (CTO-approved)
1. **A person** — the author of the nearest memories on the topic (the expertise graph, lite).
2. **The team** — if no clear person, map the topic → the owning team (e.g. API/webhooks → Engineering)
   and ask the team (its channel / lead). *Never a dead end.*
3. **A backup (time-based)** — if no reply within `escalateAfterMinutes`, escalate up the chain
   (team lead → CTO). Modeled on supermemory's `Escalation { afterMinutes, to, thenTo }`.

Every hop is written to an **audit log** (who asked whom, when, resolved) — ported from
supermemory's `runtime/audit.ts`.

### The two halves
- **Half A (ASK):** agent can't answer → calls `escalate_to_owner(topic, question)` → resolve via the
  ladder above → `createPending()` (idempotent — don't double-ask) → ping owner → tell asker
  "asked @Owner, I'll follow up." → audit `escalate`.
- **Half B (RESOLVE):** owner replies → `ingestDocument(reply, author=owner)` → memory → mark resolved
  → re-run the question → answer the asker → audit `resolved`. Forever after: instant from memory.

### Reused from supermemory (`company-brain/`)
`runtime/approvals.ts` (`createPending`, idempotent inbox) · `mcp-server.ts` (`list_pending`/`approve`
tools → our `cw pending`/`cw resolve`) · `pipeline/schema.ts` (`Escalation` time-chain) ·
`runtime/audit.ts` (append-only trail) · `Provenance{source,quote}` (cite every answer).

### Known limitation (model, not engine)
Mistral Large on Bedrock does multi-step tool-calling unreliably: it reliably calls
`escalate_to_owner` when `search_memory` is empty, but on a *near-but-insufficient* memory it
sometimes emits the tool call as prose text instead of invoking it (so the escalation doesn't
fire). The engine + owner resolution are correct (verified directly). This resolves on switching
the LLM to Claude (blocked today by the India Bedrock-Marketplace credit-card rule).

### CLI test (no Slack needed)
`cw ask …` → escalates; `cw pending` (the inbox); `cw resolve <id> "answer"` → captures + re-answers;
ask again → instant from memory.
