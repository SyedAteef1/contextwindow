/**
 * Lexical (sparse) vectors, for hybrid retrieval.
 *
 * Dense vectors are strong on meaning and weak on rare exact tokens — a product
 * code, a person's surname, "SOC 2". Sparse vectors are the reverse. BGE-M3 is
 * the one model in the registry that emits both from a single pass, which is
 * what makes hybrid retrieval cheap enough to bother with here.
 *
 * Sparse output is not part of the OpenAI embeddings shape, so it needs a
 * server that exposes it (Text Embeddings Inference's `/embed_sparse`, or
 * Infinity). Without `EMBEDDING_SPARSE_URL` set, retrieval stays dense-only.
 */
import { ConfigurationError, env } from "@/lib/env";
import { applyPrefix, type EncodeKind } from "./providers";
import { specFor } from "./models";

/** BGE-M3 rides on XLM-RoBERTa's vocabulary. */
export const DEFAULT_SPARSE_DIMENSIONS = 250_002;

export type SparseVector = { indices: number[]; values: number[] };

export function sparseEnabled(): boolean {
  const config = env();
  return (
    config.HYBRID_SEARCH &&
    Boolean(config.EMBEDDING_SPARSE_URL) &&
    specFor(config.EMBEDDING_MODEL).sparse
  );
}

/** Explain precisely which of the three preconditions is unmet. */
export function sparseUnavailableReason(): string | null {
  const config = env();
  if (!config.HYBRID_SEARCH) return "HYBRID_SEARCH is off.";
  if (!config.EMBEDDING_SPARSE_URL) {
    return "EMBEDDING_SPARSE_URL is not set; no endpoint serves lexical weights.";
  }
  if (!specFor(config.EMBEDDING_MODEL).sparse) {
    return `${config.EMBEDDING_MODEL} does not produce sparse weights — only BGE-M3 does.`;
  }
  return null;
}

type SparseResponseEntry =
  | { index: number; value: number }[]
  | { indices: number[]; values: number[] };

/**
 * Keep only the heaviest terms.
 *
 * pgvector's `sparsevec` allows at most 1000 non-zero elements, and the long
 * tail of near-zero weights costs storage without moving the ranking.
 */
function keepTopTerms(vector: SparseVector, limit: number): SparseVector {
  if (vector.indices.length <= limit) return vector;

  const ranked = vector.indices
    .map((index, position) => ({ index, value: vector.values[position] }))
    .sort((a, b) => Math.abs(b.value) - Math.abs(a.value))
    .slice(0, limit)
    // pgvector requires indices in ascending order.
    .sort((a, b) => a.index - b.index);

  return {
    indices: ranked.map((entry) => entry.index),
    values: ranked.map((entry) => entry.value),
  };
}

function normaliseEntry(entry: SparseResponseEntry): SparseVector {
  if (Array.isArray(entry)) {
    const sorted = [...entry].sort((a, b) => a.index - b.index);
    return {
      indices: sorted.map((item) => item.index),
      values: sorted.map((item) => item.value),
    };
  }
  return { indices: entry.indices, values: entry.values };
}

export async function embedSparse(texts: string[], kind: EncodeKind): Promise<SparseVector[]> {
  if (texts.length === 0) return [];

  const config = env();
  const url = config.EMBEDDING_SPARSE_URL;
  if (!url) {
    throw new ConfigurationError(
      "Sparse embeddings require EMBEDDING_SPARSE_URL (for example a Text Embeddings Inference server's /embed_sparse).",
    );
  }

  const inputs = texts.map((text) => applyPrefix(text, kind, config.EMBEDDING_MODEL));

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(config.EMBEDDING_API_KEY ? { Authorization: `Bearer ${config.EMBEDDING_API_KEY}` } : {}),
    },
    body: JSON.stringify({ inputs }),
  });

  if (!response.ok) {
    throw new Error(`Sparse embeddings failed (${response.status}): ${await response.text()}`);
  }

  const data = (await response.json()) as SparseResponseEntry[];
  return data.map((entry) => keepTopTerms(normaliseEntry(entry), config.SPARSE_MAX_TERMS));
}

/**
 * Render as a pgvector `sparsevec` literal: `{index:value,...}/dimensions`.
 *
 * pgvector indexes sparsevec from 1, whereas token ids are 0-based, so every
 * index is shifted by one on the way in and back on the way out.
 */
export function toSparseLiteral(
  vector: SparseVector,
  dimensions = DEFAULT_SPARSE_DIMENSIONS,
): string {
  if (vector.indices.length === 0) {
    // An all-zero sparsevec is valid and simply matches nothing.
    return `{}/${dimensions}`;
  }

  const pairs = vector.indices
    .map((index, position) => `${index + 1}:${vector.values[position]}`)
    .join(",");
  return `{${pairs}}/${dimensions}`;
}
