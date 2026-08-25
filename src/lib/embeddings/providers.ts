/**
 * Embedding backends.
 *
 * The vector side is deliberately independent of `LLM_PROVIDER`: whoever serves
 * the chat model has no bearing on what produces the vectors, and the strongest
 * options here are open weights you run yourself.
 *
 *  - `local`  — any OpenAI-compatible server (Ollama, TEI, Infinity, vLLM).
 *  - `voyage` — hosted, asymmetry via `input_type` rather than a text prefix.
 *  - `glm`    — Zhipu embedding-3, on the legacy BigModel host.
 *  - `hash`   — deterministic, offline, no semantic understanding.
 */
import { createHash } from "node:crypto";

import { ConfigurationError, env } from "@/lib/env";
import { specFor, truncateToDimension } from "./models";

export type EncodeKind = "document" | "query";

/** How many inputs a single request may carry, per backend. */
const VOYAGE_BATCH_SIZE = 128;
const GLM_BATCH_SIZE = 64;
const LOCAL_BATCH_SIZE = 32;

/**
 * Apply the model's asymmetric prefix.
 *
 * This is the single easiest thing to get wrong in a local embedding setup, and
 * it fails silently: with no prefix the vectors are still valid, still
 * normalised, and simply land in the wrong part of the space.
 */
export function applyPrefix(text: string, kind: EncodeKind, modelId: string): string {
  const spec = specFor(modelId);
  const prefix = kind === "query" ? spec.queryPrefix : spec.documentPrefix;
  return prefix ? `${prefix}${text}` : text;
}

/**
 * Any OpenAI-compatible `/embeddings` endpoint.
 *
 * One provider covers every way of serving the open-weight models, because they
 * all speak this shape. Ollama is the least-effort option; TEI and Infinity add
 * sparse output for BGE-M3.
 */
async function embedWithLocal(texts: string[], kind: EncodeKind): Promise<number[][]> {
  const config = env();
  const endpoint = `${config.EMBEDDING_BASE_URL.replace(/\/+$/, "")}/embeddings`;
  const vectors: number[][] = [];

  for (let offset = 0; offset < texts.length; offset += LOCAL_BATCH_SIZE) {
    const batch = texts
      .slice(offset, offset + LOCAL_BATCH_SIZE)
      .map((text) => applyPrefix(text, kind, config.EMBEDDING_MODEL));

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // Ollama ignores auth; TEI and vLLM may require it.
        ...(config.EMBEDDING_API_KEY
          ? { Authorization: `Bearer ${config.EMBEDDING_API_KEY}` }
          : {}),
      },
      body: JSON.stringify({ model: config.EMBEDDING_MODEL, input: batch }),
    });

    if (!response.ok) {
      throw new Error(
        `Local embeddings failed (${response.status}) at ${endpoint}: ${await response.text()}`,
      );
    }

    const data = (await response.json()) as {
      data: { index: number; embedding: number[] }[];
    };
    const ordered = [...data.data].sort((a, b) => a.index - b.index);
    vectors.push(...ordered.map((item) => item.embedding));
  }

  return vectors;
}

async function embedWithVoyage(texts: string[], kind: EncodeKind): Promise<number[][]> {
  const config = env();
  if (!config.VOYAGE_API_KEY) {
    throw new ConfigurationError("EMBEDDING_PROVIDER=voyage requires VOYAGE_API_KEY to be set.");
  }

  const vectors: number[][] = [];

  for (let offset = 0; offset < texts.length; offset += VOYAGE_BATCH_SIZE) {
    const batch = texts.slice(offset, offset + VOYAGE_BATCH_SIZE);
    const response = await fetch("https://api.voyageai.com/v1/embeddings", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.VOYAGE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        input: batch,
        model: config.EMBEDDING_MODEL,
        input_type: kind,
        output_dimension: config.EMBEDDING_DIM,
      }),
    });

    if (!response.ok) {
      throw new Error(`Voyage embeddings failed (${response.status}): ${await response.text()}`);
    }

    const data = (await response.json()) as {
      data: { index: number; embedding: number[] }[];
    };
    const ordered = [...data.data].sort((a, b) => a.index - b.index);
    vectors.push(...ordered.map((item) => item.embedding));
  }

  return vectors;
}

/**
 * Zhipu `embedding-3`.
 *
 * Note the host: GLM's embeddings are not on `api.z.ai` — that platform
 * documents chat, vision, image, video, audio, tokenizer and OCR, and no
 * embeddings endpoint. `embedding-3` lives on the legacy BigModel platform.
 */
async function embedWithGlm(texts: string[]): Promise<number[][]> {
  const config = env();
  const apiKey = config.GLM_EMBEDDING_API_KEY ?? config.GLM_API_KEY;
  if (!apiKey) {
    throw new ConfigurationError(
      "EMBEDDING_PROVIDER=glm requires GLM_EMBEDDING_API_KEY (or GLM_API_KEY). GLM embeddings are served from open.bigmodel.cn, not api.z.ai.",
    );
  }

  const endpoint = `${config.GLM_EMBEDDING_BASE_URL.replace(/\/+$/, "")}/embeddings`;
  const vectors: number[][] = [];

  for (let offset = 0; offset < texts.length; offset += GLM_BATCH_SIZE) {
    const batch = texts.slice(offset, offset + GLM_BATCH_SIZE);
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: config.GLM_EMBEDDING_MODEL,
        input: batch,
        dimensions: config.EMBEDDING_DIM,
      }),
    });

    if (!response.ok) {
      throw new Error(`GLM embeddings failed (${response.status}): ${await response.text()}`);
    }

    const data = (await response.json()) as {
      data: { index: number; embedding: number[] }[];
    };
    const ordered = [...data.data].sort((a, b) => a.index - b.index);
    vectors.push(...ordered.map((item) => item.embedding));
  }

  return vectors;
}

const TOKEN_PATTERN = /[a-z0-9][a-z0-9'-]*/g;

function tokenize(text: string): string[] {
  return text.toLowerCase().match(TOKEN_PATTERN) ?? [];
}

/** Stable bucket for a token, derived from a hash so it never shifts. */
function bucketFor(token: string, dim: number): number {
  return createHash("sha1").update(token).digest().readUInt32BE(0) % dim;
}

/**
 * Deterministic offline embedding: hashed bag of words, sub-linear term
 * weighting, L2-normalised so cosine distance behaves.
 */
function embedWithHash(texts: string[], dim: number): number[][] {
  return texts.map((text) => {
    const vector = new Array<number>(dim).fill(0);
    const counts = new Map<string, number>();

    for (const token of tokenize(text)) {
      counts.set(token, (counts.get(token) ?? 0) + 1);
    }
    for (const [token, count] of counts) {
      vector[bucketFor(token, dim)] += 1 + Math.log(count);
    }

    const norm = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
    if (norm === 0) {
      // A symbol-only chunk: a zero vector makes cosine distance undefined, so
      // anchor it to a fixed direction instead.
      vector[0] = 1;
      return vector;
    }
    return vector.map((value) => value / norm);
  });
}

/**
 * Guard against a silent dimension mismatch.
 *
 * The pgvector column has a fixed width. A model returning something else would
 * otherwise fail deep inside an insert with an opaque error, or — worse for a
 * Matryoshka model — be accepted at the wrong width and quietly ruin recall.
 */
function reconcileDimension(vectors: number[][], expected: number, modelId: string): number[][] {
  if (vectors.length === 0) return vectors;

  const actual = vectors[0].length;
  if (actual === expected) return vectors;

  const spec = specFor(modelId);
  if (actual > expected && spec.mrlFloor !== null && expected >= spec.mrlFloor) {
    // Matryoshka: a prefix of the vector is trained to stand alone.
    return vectors.map((vector) => truncateToDimension(vector, expected));
  }

  const remedy =
    actual > expected
      ? spec.mrlFloor === null
        ? `${spec.label} does not support Matryoshka truncation, so it cannot be shortened safely.`
        : `${spec.label} can be truncated no lower than ${spec.mrlFloor}.`
      : `${spec.label} outputs only ${actual} dimensions, which cannot be widened.`;

  throw new ConfigurationError(
    `EMBEDDING_DIM is ${expected} but ${modelId} returned ${actual}-dimension vectors. ${remedy} ` +
      `Set EMBEDDING_DIM to ${actual}, regenerate the migration so the pgvector column matches, and re-index.`,
  );
}

export async function embed(texts: string[], kind: EncodeKind): Promise<number[][]> {
  if (texts.length === 0) return [];
  const config = env();

  let vectors: number[][];
  switch (config.EMBEDDING_PROVIDER) {
    case "local":
      vectors = await embedWithLocal(texts, kind);
      break;
    case "voyage":
      vectors = await embedWithVoyage(texts, kind);
      break;
    case "glm":
      vectors = await embedWithGlm(texts);
      break;
    default:
      vectors = embedWithHash(texts, config.EMBEDDING_DIM);
  }

  return reconcileDimension(vectors, config.EMBEDDING_DIM, config.EMBEDDING_MODEL);
}
