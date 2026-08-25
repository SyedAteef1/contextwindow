/**
 * Indexing and retrieval for the chat agent.
 *
 * Every function here takes an `accountId` and every query filters on it. That
 * is the whole isolation story: retrieval is scoped in the WHERE clause, not by
 * hoping the model behaves.
 */
import { and, cosineDistance, desc, eq, gt, gte, isNull, lte, or, sql } from "drizzle-orm";

import { db } from "@/db";
import { embeddings, playbookSnippets, type PlaybookAudience, type SourceType } from "@/db/schema";
import {
  chunkText,
  chunkTranscript,
  embedForIndex,
  embedForSearch,
  sparseEnabled,
  toSparseLiteral,
} from "./embeddings";
import { env } from "./env";

export type IndexInput = {
  /** The selling company. Required: every chunk belongs to one. */
  workspaceId: string;
  /**
   * The prospect this chunk is about, when it is about one. Null for the
   * seller's own material — product, pricing, positioning — which belongs to
   * the workspace and should surface for every account.
   */
  accountId?: string | null;
  sourceType: SourceType;
  sourceId: string;
  content: string;
  meta?: Record<string, unknown>;
};

/**
 * Chunk, embed, and store one source document.
 *
 * Re-indexing the same source replaces its chunks, so regenerating a summary
 * doesn't leave the previous version's text retrievable.
 */
export async function indexDocument(input: IndexInput): Promise<number> {
  // Transcripts split on speaker turns; everything else is prose.
  const chunks =
    input.sourceType === "transcript" ? chunkTranscript(input.content) : chunkText(input.content);
  if (chunks.length === 0) return 0;

  const vectors = await embedForIndex(chunks.map((chunk) => chunk.content));

  await db
    .delete(embeddings)
    .where(
      and(
        eq(embeddings.sourceType, input.sourceType),
        eq(embeddings.sourceId, input.sourceId),
      ),
    );

  await db.insert(embeddings).values(
    chunks.map((chunk, i) => ({
      workspaceId: input.workspaceId,
      accountId: input.accountId ?? null,
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      chunkIndex: chunk.index,
      content: chunk.content,
      vector: vectors[i].dense,
      sparseVector: vectors[i].sparse ? toSparseLiteral(vectors[i].sparse) : null,
      meta: input.meta ?? null,
    })),
  );

  return chunks.length;
}

/**
 * The relevance floor, which is scale-dependent on the provider.
 *
 * Semantic embeddings (voyage, glm) put a genuinely related chunk comfortably
 * above 0.15.
 * The lexical `hash` provider scores on a different scale entirely — a natural
 * question like "what happened with pricing per seat" only reaches ~0.12
 * against a matching chunk, because the filler words dilute the query vector
 * and near-misses ("seat" vs "per-seat") share no bucket. Applying the semantic
 * floor there silently returns nothing for reasonable questions.
 */
function defaultMinSimilarity(): number {
  return env().EMBEDDING_PROVIDER === "hash" ? 0.05 : 0.15;
}

export type RetrievedChunk = {
  id: string;
  sourceType: SourceType;
  sourceId: string;
  chunkIndex: number;
  content: string;
  similarity: number;
  meta: Record<string, unknown> | null;
};

export type RetrievalScope = {
  /** The prospect's own history. */
  accountId: string;
  /**
   * The seller's material, searched alongside it.
   *
   * Passing this is what lets "what do we usually offer at this stage" work:
   * without it retrieval can only see what was said *to* this buyer, which is
   * half of what a rep needs mid-call.
   */
  workspaceId?: string | null;
};

/**
 * Top-k chunks for a query, across one account and its workspace.
 *
 * `minSimilarity` keeps unrelated chunks out of the prompt: on a question
 * neither the account history nor the workspace can answer, it is better to
 * retrieve nothing and let the agent say so than to hand it the least-bad
 * match.
 */
export async function retrieveForAccount(
  scope: string | RetrievalScope,
  query: string,
  options: {
    topK?: number;
    minSimilarity?: number;
    sourceTypes?: SourceType[];
    /**
     * Widen each hit to its neighbouring chunks from the same source. Costs one
     * extra query and makes answers markedly less clipped, so it is on by
     * default; the live in-call lane turns it off to protect latency.
     */
    expandNeighbours?: boolean;
    /** Weight recent calls above old ones at equal relevance. On by default. */
    recencyBias?: boolean;
  } = {},
): Promise<RetrievedChunk[]> {
  // A bare string stays valid so every existing call site keeps working; it
  // simply searches the account alone, as it always did.
  const accountId = typeof scope === "string" ? scope : scope.accountId;
  const workspaceId = typeof scope === "string" ? null : (scope.workspaceId ?? null);
  const topK = options.topK ?? env().RETRIEVAL_TOP_K;
  const minSimilarity = options.minSimilarity ?? defaultMinSimilarity();

  const embedded = await embedForSearch(query);

  const dense = await denseSearch({ accountId, workspaceId }, embedded.dense, {
    topK,
    minSimilarity,
    sourceTypes: options.sourceTypes,
    // Fusion needs a deeper candidate pool than it returns.
    limit: embedded.sparse ? topK * 3 : topK,
  });

  if (!embedded.sparse || !sparseEnabled()) {
    // Similarity is the ranking score on this path.
    const ranked = dense.map((chunk) => ({ chunk, score: chunk.similarity }));
    return finish(ranked, topK, options);
  }

  const sparse = await sparseSearch({ accountId, workspaceId }, toSparseLiteral(embedded.sparse), {
    limit: topK * 3,
    sourceTypes: options.sourceTypes,
  });

  return finish(fuseByReciprocalRank(dense, sparse), topK, options);
}

/** A chunk plus whatever score the ranking that produced it assigned. */
type Ranked = { chunk: RetrievedChunk; score: number };

/**
 * Everything that happens after ranking: weight by age, cut to topK, widen.
 *
 * Both paths hand their own score in — similarity for dense-only, the fused
 * score for hybrid — so recency multiplies the real ranking signal rather than
 * a position. Position would make this useless: rank 1 scores half of rank 0,
 * and a boost capped at 15% could never express "these are equally relevant,
 * prefer the newer one", which is the entire intent.
 *
 * Kept separate from the rankings themselves so the two paths cannot drift.
 */
async function finish(
  ranked: Ranked[],
  topK: number,
  options: { expandNeighbours?: boolean; recencyBias?: boolean },
): Promise<RetrievedChunk[]> {
  if (ranked.length === 0) return [];

  const weighted =
    options.recencyBias === false
      ? ranked
      : ranked.map((r) => ({ ...r, score: r.score * recencyMultiplier(r.chunk) }));

  const hits = [...weighted]
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
    .map((r) => r.chunk);

  if (options.expandNeighbours === false) return hits;
  return expandWithNeighbours(hits);
}

/**
 * Pull the chunks either side of each hit and stitch them in.
 *
 * Small chunks retrieve precisely and read badly: the winning chunk often ends
 * mid-exchange, and the sentence that gives it meaning sits in the neighbour.
 * One query fetches those neighbours, and each hit's content is replaced by the
 * stitched passage — the hit keeps its own rank and similarity, so precision is
 * unaffected and only the text handed to the model gets wider.
 */
async function expandWithNeighbours(hits: RetrievedChunk[]): Promise<RetrievedChunk[]> {
  const wanted = hits.map((hit) => ({
    sourceId: hit.sourceId,
    from: Math.max(hit.chunkIndex - 1, 0),
    to: hit.chunkIndex + 1,
  }));

  const rows = await db
    .select({
      sourceId: embeddings.sourceId,
      chunkIndex: embeddings.chunkIndex,
      content: embeddings.content,
    })
    .from(embeddings)
    .where(
      or(
        ...wanted.map((w) =>
          and(
            eq(embeddings.sourceId, w.sourceId),
            gte(embeddings.chunkIndex, w.from),
            lte(embeddings.chunkIndex, w.to),
          ),
        ),
      ),
    );

  const bySource = new Map<string, Map<number, string>>();
  for (const row of rows) {
    if (!bySource.has(row.sourceId)) bySource.set(row.sourceId, new Map());
    bySource.get(row.sourceId)!.set(row.chunkIndex, row.content);
  }

  return hits.map((hit) => {
    const neighbours = bySource.get(hit.sourceId);
    if (!neighbours) return hit;

    const parts: string[] = [];
    for (let i = hit.chunkIndex - 1; i <= hit.chunkIndex + 1; i++) {
      const content = neighbours.get(i);
      if (!content) continue;
      // Chunks overlap by design, so a neighbour usually repeats the edge of
      // its sibling. Drop the neighbour when it is already contained.
      if (parts.some((part) => part.includes(content))) continue;
      parts.push(content);
    }

    const stitched = parts.join("\n");
    return stitched.length > hit.content.length ? { ...hit, content: stitched } : hit;
  });
}

/** Cosine-distance search over the dense column. */
async function denseSearch(
  scope: { accountId: string; workspaceId: string | null },
  queryVector: number[],
  options: {
    topK: number;
    minSimilarity: number;
    sourceTypes?: SourceType[];
    limit: number;
  },
): Promise<RetrievedChunk[]> {
  const similarity = sql<number>`1 - (${cosineDistance(embeddings.vector, queryVector)})`;

  const rows = await db
    .select({
      id: embeddings.id,
      sourceType: embeddings.sourceType,
      sourceId: embeddings.sourceId,
      chunkIndex: embeddings.chunkIndex,
      content: embeddings.content,
      meta: embeddings.meta,
      similarity,
    })
    .from(embeddings)
    .where(
      and(
        // The isolation boundary: this prospect's chunks, plus the seller's own
        // material, which carries no account and belongs to everyone in the
        // workspace. Another account's chunks match neither.
        scope.workspaceId
          ? or(
              eq(embeddings.accountId, scope.accountId),
              and(isNull(embeddings.accountId), eq(embeddings.workspaceId, scope.workspaceId)),
            )
          : eq(embeddings.accountId, scope.accountId),
        gt(similarity, options.minSimilarity),
        options.sourceTypes?.length
          ? or(...options.sourceTypes.map((type) => eq(embeddings.sourceType, type)))
          : undefined,
      ),
    )
    .orderBy((t) => desc(t.similarity))
    .limit(options.limit);

  return rows as RetrievedChunk[];
}

/**
 * Inner-product search over the lexical column.
 *
 * Raw SQL because Drizzle has no `sparsevec` operators. `<#>` returns the
 * negated inner product, so ascending order is best-first — and the account
 * filter is bound as a parameter, exactly as in the dense path.
 */
async function sparseSearch(
  scope: { accountId: string; workspaceId: string | null },
  querySparse: string,
  options: { limit: number; sourceTypes?: SourceType[] },
): Promise<RetrievedChunk[]> {
  const typeFilter = options.sourceTypes?.length
    ? sql`and source_type in (${sql.join(
        options.sourceTypes.map((type) => sql`${type}`),
        sql`, `,
      )})`
    : sql``;

  const rows = await db.execute<{
    id: string;
    source_type: SourceType;
    source_id: string;
    chunk_index: number;
    content: string;
    meta: Record<string, unknown> | null;
    score: number;
  }>(sql`
    select id,
           source_type,
           source_id,
           chunk_index,
           content,
           meta,
           (sparse_vector <#> ${querySparse}::sparsevec) * -1 as score
      from embeddings
     where ${
       scope.workspaceId
         ? sql`(account_id = ${scope.accountId} or (account_id is null and workspace_id = ${scope.workspaceId}))`
         : sql`account_id = ${scope.accountId}`
     }
       and sparse_vector is not null
       ${typeFilter}
     order by sparse_vector <#> ${querySparse}::sparsevec
     limit ${options.limit}
  `);

  return [...rows].map((row) => ({
    id: row.id,
    sourceType: row.source_type,
    sourceId: row.source_id,
    chunkIndex: row.chunk_index,
    content: row.content,
    meta: row.meta,
    similarity: Number(row.score),
  }));
}

/**
 * Reciprocal rank fusion.
 *
 * Dense cosine similarity and sparse inner product live on different scales, so
 * adding them directly would let whichever happens to produce larger numbers
 * dominate. RRF throws the magnitudes away and combines *ranks*, which needs no
 * per-corpus tuning — the reason it is the standard choice for this.
 */
function fuseByReciprocalRank(dense: RetrievedChunk[], sparse: RetrievedChunk[]): Ranked[] {
  const k = env().HYBRID_RRF_K;
  const scores = new Map<string, number>();
  const chunks = new Map<string, RetrievedChunk>();

  for (const list of [dense, sparse]) {
    list.forEach((chunk, rank) => {
      scores.set(chunk.id, (scores.get(chunk.id) ?? 0) + 1 / (k + rank + 1));
      // Keep the dense record, whose `similarity` is the interpretable one.
      if (!chunks.has(chunk.id)) chunks.set(chunk.id, chunk);
    });
  }

  return [...scores.entries()]
    .filter(([id]) => chunks.has(id))
    .map(([id, score]) => ({ chunk: chunks.get(id)!, score }));
}

/** Six months to decay from 1.15 to 1.0. Enough to break ties, not to bury. */
const RECENCY_HALFLIFE_DAYS = 180;
const RECENCY_MAX_BOOST = 0.15;

/**
 * A gentle thumb on the scale for recent calls.
 *
 * What someone committed to last week usually matters more than the same
 * sentence from six months ago, and at equal relevance the newer chunk should
 * win. The boost is capped at 15% precisely because it must not outrank a
 * genuinely better match — this breaks ties, it does not re-rank.
 *
 * Workspace material carries no date and is never penalised: pricing policy is
 * not stale because it was written a year ago.
 */
function recencyMultiplier(chunk: RetrievedChunk): number {
  const raw = chunk.meta?.scheduledAt;
  if (typeof raw !== "string") return 1;
  const when = Date.parse(raw);
  if (Number.isNaN(when)) return 1;

  const ageDays = Math.max(0, (Date.now() - when) / 86_400_000);
  return 1 + RECENCY_MAX_BOOST * Math.exp(-ageDays / RECENCY_HALFLIFE_DAYS);
}

/** Drop everything indexed for one source (e.g. when a meeting is deleted). */
export async function removeSourceFromIndex(
  sourceType: SourceType,
  sourceId: string,
): Promise<void> {
  await db
    .delete(embeddings)
    .where(and(eq(embeddings.sourceType, sourceType), eq(embeddings.sourceId, sourceId)));
}

/**
 * Playbook snippets for an agent, newest first.
 *
 * Retrieved by plain predicate rather than by vector: a playbook is small,
 * hand-curated, and should be included in full when it applies — not ranked.
 */
export async function loadPlaybookSnippets(options: {
  ownerUserId: string;
  accountId?: string | null;
  audience: PlaybookAudience;
  industry?: string | null;
  limit?: number;
}): Promise<{ title: string; content: string }[]> {
  const rows = await db
    .select({
      title: playbookSnippets.title,
      content: playbookSnippets.content,
      appliesTo: playbookSnippets.appliesTo,
      industry: playbookSnippets.industry,
      createdAt: playbookSnippets.createdAt,
    })
    .from(playbookSnippets)
    .where(
      and(
        eq(playbookSnippets.ownerUserId, options.ownerUserId),
        eq(playbookSnippets.isActive, true),
        // Global snippets plus ones scoped to this account.
        options.accountId
          ? or(
              isNull(playbookSnippets.accountId),
              eq(playbookSnippets.accountId, options.accountId),
            )
          : isNull(playbookSnippets.accountId),
      ),
    )
    .orderBy(desc(playbookSnippets.createdAt))
    .limit(options.limit ?? 25);

  return rows
    .filter((row) => {
      // `appliesTo: null` means "every agent".
      if (row.appliesTo && !row.appliesTo.includes(options.audience)) return false;
      // An industry-tagged snippet only applies to that industry.
      if (row.industry && options.industry && row.industry !== options.industry) return false;
      if (row.industry && !options.industry) return false;
      return true;
    })
    .map(({ title, content }) => ({ title, content }));
}

/** Render snippets for injection into a system prompt. */
export function formatPlaybook(snippets: { title: string; content: string }[]): string {
  if (snippets.length === 0) return "";
  return snippets
    .map((snippet) => `### ${snippet.title}\n${snippet.content.trim()}`)
    .join("\n\n");
}
