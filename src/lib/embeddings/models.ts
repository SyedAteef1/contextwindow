/**
 * Embedding model registry.
 *
 * Every field here was read off the model card, because these are exactly the
 * details that fail silently. Three of the four models below use an
 * **asymmetric** encoding: the query gets a prefix the document does not. Omit
 * it and nothing errors — retrieval just gets quietly worse, which is the worst
 * kind of bug to own in a RAG system.
 */

export type EmbeddingModelSpec = {
  /** Identifier as the serving runtime knows it. */
  id: string;
  label: string;
  /** Native output width before any Matryoshka truncation. */
  nativeDim: number;
  /** Smallest dimension the model was trained to tolerate, if MRL-capable. */
  mrlFloor: number | null;
  maxContextTokens: number | null;
  /** Prepended to search queries only. */
  queryPrefix: string;
  /** Prepended to stored documents only. */
  documentPrefix: string;
  /** True when the model also emits lexical (sparse) weights. */
  sparse: boolean;
  notes: string;
};

/**
 * Qwen3 is instruction-aware; the task description shapes the query embedding.
 * The model card puts the gain at 1–5%, and recommends English instructions.
 */
export const QWEN3_RETRIEVAL_TASK =
  "Given a sales question, retrieve passages from this customer account's call history that answer it";

export const EMBEDDING_MODELS: Record<string, EmbeddingModelSpec> = {
  "bge-m3": {
    id: "bge-m3",
    label: "BAAI BGE-M3",
    nativeDim: 1024,
    mrlFloor: null,
    maxContextTokens: 8192,
    // BGE-M3 dropped the instruction requirement earlier BGE versions had.
    queryPrefix: "",
    documentPrefix: "",
    sparse: true,
    notes:
      "The only model here that emits lexical weights alongside dense vectors, which is what makes hybrid retrieval possible. 8k context suits whole transcripts.",
  },
  "qwen3-embedding-8b": {
    id: "qwen3-embedding-8b",
    label: "Qwen3-Embedding-8B",
    nativeDim: 4096,
    mrlFloor: 32,
    maxContextTokens: 32768,
    queryPrefix: `Instruct: ${QWEN3_RETRIEVAL_TASK}\nQuery:`,
    documentPrefix: "",
    sparse: false,
    notes:
      "Highest ceiling and by far the longest context, at 4096 dimensions and 8B parameters — the heaviest to serve. Truncate with MRL if storage matters.",
  },
  "snowflake-arctic-embed-l-v2.0": {
    id: "snowflake-arctic-embed-l-v2.0",
    label: "Snowflake Arctic-Embed-L-v2.0",
    nativeDim: 1024,
    mrlFloor: 256,
    maxContextTokens: 8192,
    queryPrefix: "query: ",
    documentPrefix: "",
    sparse: false,
    notes:
      "Built on the BGE-M3 backbone. Designed for compression: 1024 → 256 costs under 3% retrieval quality.",
  },
  "nomic-embed-text-v2-moe": {
    id: "nomic-embed-text-v2-moe",
    label: "Nomic Embed v2 (MoE)",
    nativeDim: 768,
    mrlFloor: 256,
    maxContextTokens: 512,
    // Nomic is the strictest: both sides are prefixed, and the model card is
    // explicit that the prefix is required rather than advisory.
    queryPrefix: "search_query: ",
    documentPrefix: "search_document: ",
    sparse: false,
    notes:
      "Mixture-of-experts, so it activates a fraction of its parameters — the cheapest of the four to run. Narrowest native width at 768.",
  },
};

/** Vendor-hosted models, which the registry also has to describe. */
export const VOYAGE_SPEC: EmbeddingModelSpec = {
  id: "voyage-3.5-lite",
  label: "Voyage 3.5 Lite",
  nativeDim: 1024,
  mrlFloor: 256,
  maxContextTokens: 32000,
  // Voyage takes `input_type` as a parameter rather than a text prefix.
  queryPrefix: "",
  documentPrefix: "",
  sparse: false,
  notes: "Hosted. Asymmetry is expressed via the input_type parameter, not a prefix.",
};

/**
 * Look up a model, falling back to a neutral spec for one we don't know.
 *
 * An unknown model is not an error — you may be serving something local we
 * have no card for — but it does mean no prefixes are applied, so it is worth
 * adding an entry above rather than relying on this.
 */
export function specFor(modelId: string): EmbeddingModelSpec {
  const key = modelId.toLowerCase();

  const direct = EMBEDDING_MODELS[key];
  if (direct) return direct;

  // Serving runtimes decorate ids: `bge-m3:latest`, `BAAI/bge-m3`, `:f16`.
  const normalised = key.split("/").pop()?.split(":")[0] ?? key;
  const byBase = EMBEDDING_MODELS[normalised];
  if (byBase) return byBase;

  if (key.startsWith("voyage")) return { ...VOYAGE_SPEC, id: modelId };

  return {
    id: modelId,
    label: modelId,
    nativeDim: 0, // unknown — the runtime dimension check will catch a mismatch
    mrlFloor: null,
    maxContextTokens: null,
    queryPrefix: "",
    documentPrefix: "",
    sparse: false,
    notes: "Not in the registry; no prefixes applied. Add an entry to enable them.",
  };
}

/**
 * Truncate to `dim` and re-normalise.
 *
 * Matryoshka models put the most information in the leading dimensions, so a
 * prefix of the vector is still meaningful — but only after re-normalising to
 * unit length, otherwise cosine distance is computed against vectors of
 * inconsistent magnitude.
 */
export function truncateToDimension(vector: number[], dim: number): number[] {
  if (dim >= vector.length) return vector;

  const head = vector.slice(0, dim);
  const norm = Math.hypot(...head);
  return norm === 0 ? head : head.map((value) => value / norm);
}
