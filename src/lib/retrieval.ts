/**
 * Indexing and retrieval for the chat agent.
 *
 * Every function here takes an `accountId` and every query filters on it. That
 * is the whole isolation story: retrieval is scoped in the WHERE clause, not by
 * hoping the model behaves.
 */
import { and, cosineDistance, desc, eq, gt, isNull, or, sql } from "drizzle-orm";

import { db } from "@/db";
import { embeddings, playbookSnippets, type PlaybookAudience, type SourceType } from "@/db/schema";
import {
  chunkText,
  embedForIndex,
  embedForSearch,
  sparseEnabled,
  toSparseLiteral,
} from "./embeddings";
import { env } from "./env";

export type IndexInput = {
  accountId: string;
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
  const chunks = chunkText(input.content);
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
      accountId: input.accountId,
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

/**
 * Top-k chunks for a query within one account.
 *
 * `minSimilarity` keeps unrelated chunks out of the prompt: on a question the
 * account history simply can't answer, it is better to retrieve nothing and let
 * the agent say so than to hand it the least-bad match.
 */
export async function retrieveForAccount(
  accountId: string,
  query: string,
  options: { topK?: number; minSimilarity?: number; sourceTypes?: SourceType[] } = {},
): Promise<RetrievedChunk[]> {
  const topK = options.topK ?? env().RETRIEVAL_TOP_K;
  const minSimilarity = options.minSimilarity ?? defaultMinSimilarity();

  const embedded = await embedForSearch(query);

  const dense = await denseSearch(accountId, embedded.dense, {
    topK,
    minSimilarity,
    sourceTypes: options.sourceTypes,
    // Fusion needs a deeper candidate pool than it returns.
    limit: embedded.sparse ? topK * 3 : topK,
  });

  if (!embedded.sparse || !sparseEnabled()) return dense;

  const sparse = await sparseSearch(accountId, toSparseLiteral(embedded.sparse), {
    limit: topK * 3,
    sourceTypes: options.sourceTypes,
  });

  return fuseByReciprocalRank(dense, sparse, topK);
}

/** Cosine-distance search over the dense column. */
async function denseSearch(
  accountId: string,
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
        // The isolation boundary.
        eq(embeddings.accountId, accountId),
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
  accountId: string,
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
     where account_id = ${accountId}
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
function fuseByReciprocalRank(
  dense: RetrievedChunk[],
  sparse: RetrievedChunk[],
  topK: number,
): RetrievedChunk[] {
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
    .sort((a, b) => b[1] - a[1])
    .slice(0, topK)
    .map(([id]) => chunks.get(id)!)
    .filter(Boolean);
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
