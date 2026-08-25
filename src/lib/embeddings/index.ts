/**
 * Public embedding surface.
 *
 * Queries and documents go through different functions on purpose: most of the
 * models worth using are asymmetric, and routing both through one call is how
 * that distinction gets lost.
 */
import { env } from "@/lib/env";
import { embed } from "./providers";
import { embedSparse, sparseEnabled, sparseUnavailableReason, type SparseVector } from "./sparse";

export {
  chunkText,
  chunkTranscript,
  CHUNK_CHARS,
  CHUNK_OVERLAP_CHARS,
  TRANSCRIPT_CHUNK_CHARS,
  type Chunk,
} from "./chunking";
export {
  EMBEDDING_MODELS,
  specFor,
  truncateToDimension,
  type EmbeddingModelSpec,
} from "./models";
export {
  DEFAULT_SPARSE_DIMENSIONS,
  embedSparse,
  sparseEnabled,
  sparseUnavailableReason,
  toSparseLiteral,
  type SparseVector,
} from "./sparse";
export { applyPrefix, type EncodeKind } from "./providers";

/** Embed content destined for storage. */
export async function embedDocuments(texts: string[]): Promise<number[][]> {
  return embed(texts, "document");
}

/** Embed a search query, with whatever query-side prefix the model expects. */
export async function embedQuery(text: string): Promise<number[]> {
  const [vector] = await embed([text], "query");
  return vector;
}

export type DocumentEmbedding = {
  dense: number[];
  /** Present only when hybrid retrieval is fully configured. */
  sparse: SparseVector | null;
};

/**
 * Embed documents for indexing, including lexical weights when available.
 *
 * Dense and sparse come from one model in one pass, so asking for both costs
 * roughly one extra request rather than a second model.
 */
export async function embedForIndex(texts: string[]): Promise<DocumentEmbedding[]> {
  if (texts.length === 0) return [];

  const dense = await embed(texts, "document");
  if (!sparseEnabled()) {
    return dense.map((vector) => ({ dense: vector, sparse: null }));
  }

  const sparse = await embedSparse(texts, "document");
  return dense.map((vector, index) => ({ dense: vector, sparse: sparse[index] ?? null }));
}

export type QueryEmbedding = {
  dense: number[];
  sparse: SparseVector | null;
};

export async function embedForSearch(text: string): Promise<QueryEmbedding> {
  const [dense] = await embed([text], "query");
  if (!sparseEnabled()) return { dense, sparse: null };

  const [sparse] = await embedSparse([text], "query");
  return { dense, sparse: sparse ?? null };
}

/** Everything the UI or a health check needs to describe the current setup. */
export function embeddingStatus() {
  const config = env();
  const usesModel = config.EMBEDDING_PROVIDER !== "hash";
  return {
    provider: config.EMBEDDING_PROVIDER,
    // The hash provider ignores EMBEDDING_MODEL entirely; reporting one anyway
    // reads as though it is in use.
    model: usesModel ? config.EMBEDDING_MODEL : null,
    dimensions: config.EMBEDDING_DIM,
    hybrid: sparseEnabled(),
    /** Why hybrid is off, when it is. */
    hybridBlockedBy: sparseEnabled() ? null : sparseUnavailableReason(),
  };
}
