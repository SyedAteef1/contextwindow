/**
 * Embedding model handling.
 *
 * The prefix and truncation rules are the ones worth pinning down: both fail
 * silently. A missing query prefix still produces a valid, normalised vector —
 * just one in the wrong region of the space — and an un-normalised Matryoshka
 * truncation still inserts cleanly while quietly distorting cosine distance.
 */
import { describe, expect, it } from "vitest";

import { specFor, truncateToDimension, EMBEDDING_MODELS } from "@/lib/embeddings/models";
import { applyPrefix } from "@/lib/embeddings/providers";
import { toSparseLiteral, DEFAULT_SPARSE_DIMENSIONS } from "@/lib/embeddings/sparse";
import { chunkText } from "@/lib/embeddings/chunking";

describe("model registry", () => {
  it("records the verified specs for each model", () => {
    expect(specFor("bge-m3").nativeDim).toBe(1024);
    expect(specFor("bge-m3").sparse).toBe(true);
    expect(specFor("qwen3-embedding-8b").nativeDim).toBe(4096);
    expect(specFor("qwen3-embedding-8b").maxContextTokens).toBe(32768);
    expect(specFor("snowflake-arctic-embed-l-v2.0").mrlFloor).toBe(256);
    expect(specFor("nomic-embed-text-v2-moe").nativeDim).toBe(768);
  });

  it("is the only model claiming sparse output", () => {
    const sparseModels = Object.values(EMBEDDING_MODELS)
      .filter((spec) => spec.sparse)
      .map((spec) => spec.id);
    expect(sparseModels).toEqual(["bge-m3"]);
  });

  it("resolves ids as serving runtimes decorate them", () => {
    // Ollama tags, HuggingFace org prefixes, quantisation suffixes.
    expect(specFor("bge-m3:latest").nativeDim).toBe(1024);
    expect(specFor("BAAI/bge-m3").nativeDim).toBe(1024);
    expect(specFor("nomic-ai/nomic-embed-text-v2-moe:f16").nativeDim).toBe(768);
  });

  it("falls back safely for an unknown model", () => {
    const spec = specFor("some-private-model");
    expect(spec.queryPrefix).toBe("");
    expect(spec.nativeDim).toBe(0);
  });
});

describe("asymmetric prefixes", () => {
  it("prefixes only the query for Arctic and Qwen3", () => {
    expect(applyPrefix("what did they say", "query", "snowflake-arctic-embed-l-v2.0")).toBe(
      "query: what did they say",
    );
    expect(applyPrefix("the transcript", "document", "snowflake-arctic-embed-l-v2.0")).toBe(
      "the transcript",
    );

    const qwenQuery = applyPrefix("what did they say", "query", "qwen3-embedding-8b");
    expect(qwenQuery).toMatch(/^Instruct: .+\nQuery:what did they say$/);
    expect(applyPrefix("the transcript", "document", "qwen3-embedding-8b")).toBe("the transcript");
  });

  it("prefixes both sides for Nomic, which requires it", () => {
    expect(applyPrefix("pricing", "query", "nomic-embed-text-v2-moe")).toBe(
      "search_query: pricing",
    );
    expect(applyPrefix("pricing", "document", "nomic-embed-text-v2-moe")).toBe(
      "search_document: pricing",
    );
  });

  it("leaves BGE-M3 untouched, which dropped the instruction requirement", () => {
    expect(applyPrefix("pricing", "query", "bge-m3")).toBe("pricing");
    expect(applyPrefix("pricing", "document", "bge-m3")).toBe("pricing");
  });
});

describe("Matryoshka truncation", () => {
  it("keeps the leading dimensions and re-normalises to unit length", () => {
    const vector = [3, 4, 12, 0];
    const truncated = truncateToDimension(vector, 2);

    expect(truncated).toHaveLength(2);
    // [3,4] has norm 5, so it becomes [0.6, 0.8].
    expect(truncated[0]).toBeCloseTo(0.6, 10);
    expect(truncated[1]).toBeCloseTo(0.8, 10);

    const norm = Math.hypot(...truncated);
    expect(norm).toBeCloseTo(1, 10);
  });

  it("is a no-op when the requested width is not smaller", () => {
    const vector = [0.6, 0.8];
    expect(truncateToDimension(vector, 2)).toBe(vector);
    expect(truncateToDimension(vector, 8)).toBe(vector);
  });

  it("does not divide by zero on an all-zero vector", () => {
    expect(truncateToDimension([0, 0, 0, 0], 2)).toEqual([0, 0]);
  });
});

describe("sparse literals", () => {
  it("renders pgvector's sparsevec format with 1-based indices", () => {
    // Token ids are 0-based; pgvector indexes sparsevec from 1.
    const literal = toSparseLiteral({ indices: [0, 5, 100], values: [0.5, 0.25, 0.125] }, 1000);
    expect(literal).toBe("{1:0.5,6:0.25,101:0.125}/1000");
  });

  it("renders an empty vector rather than invalid syntax", () => {
    expect(toSparseLiteral({ indices: [], values: [] }, 500)).toBe("{}/500");
  });

  it("defaults to the XLM-RoBERTa vocabulary width BGE-M3 uses", () => {
    expect(DEFAULT_SPARSE_DIMENSIONS).toBe(250_002);
    expect(toSparseLiteral({ indices: [1], values: [1] })).toContain("/250002");
  });
});

describe("chunking still holds after the module split", () => {
  it("returns a single chunk for short text", () => {
    expect(chunkText("Short.")).toEqual([{ index: 0, content: "Short." }]);
  });

  it("splits long text with contiguous indices", () => {
    const chunks = chunkText("The buyer raised a concern. ".repeat(200), { size: 500, overlap: 50 });
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.map((c) => c.index)).toEqual(chunks.map((_, i) => i));
  });
});
