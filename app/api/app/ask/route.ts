// Browser-facing brain search/ask — SESSION-GATED (unlike /api/agent which is header-based
// for server-to-server surfaces). Only an approved, logged-in identity can query, and the
// query always runs as THAT principal (so episodic memory + attribution are correct).
//
// POST body: { query: string, mode?: "ask" | "search", role?: string }
//   ask    → runs the agent (searches memory, answers with sources, escalates if empty)
//   search → returns the raw matching memories (no LLM)

import { runAgent } from "../../../../lib/agent/core";
import { getIdentityByPrincipal } from "../../../../lib/auth/approval";
import { getSessionPrincipal } from "../../../../lib/auth/session";
import { searchMemories } from "../../../../lib/memory/search";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  // Gate: must be logged in AND approved.
  const principal = await getSessionPrincipal();
  if (!principal) return Response.json({ error: "Not signed in." }, { status: 401 });
  const identity = await getIdentityByPrincipal(principal);
  if (!identity) return Response.json({ error: "Unknown identity." }, { status: 401 });
  if (identity.status !== "approved") return Response.json({ error: "Awaiting approval." }, { status: 403 });

  let body: { query?: string; mode?: string; role?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const query = (body.query ?? "").trim();
  if (!query) return Response.json({ error: "Ask a question." }, { status: 400 });
  if (query.length > 2000) return Response.json({ error: "Question is too long." }, { status: 400 });

  const orgId = identity.orgId;

  // SEARCH mode: raw memory hits, no LLM (fast, always works).
  if (body.mode === "search") {
    const results = await searchMemories({ orgId, query, limit: 8 });
    return Response.json({
      mode: "search",
      results: results.map((r) => ({
        memory: r.memory,
        similarity: r.similarity,
        sources: r.sources.map((s) => ({ title: s.title, url: s.url })),
      })),
    });
  }

  // ASK mode: full agent loop, logged to this user's episodic memory.
  const answer = await runAgent({
    ctx: { orgId, principalId: identity.principalId, surface: "web" },
    query,
    role: body.role,
    session: { id: `web:${identity.principalId}`, principalId: identity.principalId },
  }).text;

  return Response.json({ mode: "ask", answer: answer || "I couldn't generate an answer right now. Please try again." });
}
