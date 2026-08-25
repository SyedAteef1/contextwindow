/** Splitting long documents into embeddable pieces. */

export type Chunk = { index: number; content: string };

/**
 * Prose chunk size.
 *
 * Deliberately small. A chunk is the unit of retrieval, so a large one is a
 * blurred one: embed 3000 characters covering pricing, security and timelines
 * and the resulting vector is close to all three and precise about none. At
 * ~1400 characters a chunk is usually about a single thing, which is what makes
 * "what did we promise about SSO" land on the exchange rather than the call.
 *
 * Precision costs context, and the answer to that is `expandNeighbours` at read
 * time rather than a bigger window at write time — retrieve narrowly, then
 * widen around the hit.
 */
export const CHUNK_CHARS = 1400;
export const CHUNK_OVERLAP_CHARS = 200;

/** Transcript windows run smaller still: one exchange is the useful unit. */
export const TRANSCRIPT_CHUNK_CHARS = 1100;

/**
 * Split text into overlapping chunks, preferring a paragraph or sentence
 * boundary near the end of each window so chunks don't sever mid-thought.
 */
export function chunkText(
  text: string,
  { size = CHUNK_CHARS, overlap = CHUNK_OVERLAP_CHARS } = {},
): Chunk[] {
  const clean = text.replace(/\r\n/g, "\n").trim();
  if (!clean) return [];
  if (clean.length <= size) return [{ index: 0, content: clean }];

  const chunks: Chunk[] = [];
  let start = 0;
  let index = 0;

  while (start < clean.length) {
    let end = Math.min(start + size, clean.length);

    if (end < clean.length) {
      // Look for a clean break in the last quarter of the window.
      const windowStart = start + Math.floor(size * 0.75);
      const candidates = [
        clean.lastIndexOf("\n\n", end),
        clean.lastIndexOf("\n", end),
        clean.lastIndexOf(". ", end),
      ].filter((position) => position > windowStart);
      if (candidates.length) end = Math.max(...candidates) + 1;
    }

    const content = clean.slice(start, end).trim();
    if (content) chunks.push({ index: index++, content });

    if (end >= clean.length) break;
    start = Math.max(end - overlap, start + 1);
  }

  return chunks;
}

/** `Speaker: text` — the shape every transcript is stored in. */
const TURN = /^([A-Z][^:\n]{0,60}):\s/;

/**
 * Chunk a transcript on speaker turns.
 *
 * A turn is never split, because half a sentence attributed to the wrong person
 * is worse than no chunk at all — the model will quote it. Turns are packed
 * into windows instead, and each window repeats the previous turn so a question
 * and its answer are never separated by a boundary. That overlap is the point:
 * "Can you put that in writing?" is meaningless without the sentence before it.
 *
 * Falls back to prose chunking for anything not in speaker form, so a pasted
 * transcript with no speaker labels still indexes.
 */
export function chunkTranscript(
  text: string,
  { size = TRANSCRIPT_CHUNK_CHARS } = {},
): Chunk[] {
  const clean = text.replace(/\r\n/g, "\n").trim();
  if (!clean) return [];

  // Group lines into turns: a line starting a new speaker opens one, and
  // continuation lines belong to whoever is currently speaking.
  const turns: string[] = [];
  for (const line of clean.split("\n")) {
    if (!line.trim()) continue;
    if (TURN.test(line) || turns.length === 0) turns.push(line.trim());
    else turns[turns.length - 1] += "\n" + line.trim();
  }

  // Not actually a transcript — no speaker ever changed.
  if (turns.length < 2) return chunkText(clean, { size });

  const chunks: Chunk[] = [];
  let current: string[] = [];
  let index = 0;

  const flush = () => {
    if (current.length === 0) return;
    chunks.push({ index: index++, content: current.join("\n") });
    // Carry the last turn forward so the next window opens mid-conversation.
    current = current.length > 1 ? [current[current.length - 1]] : [];
  };

  for (const turn of turns) {
    const projected = [...current, turn].join("\n").length;
    // Flush before adding, unless the window is only the carried-over turn —
    // a single long turn has to be allowed to exceed the target.
    if (projected > size && current.length > 1) flush();
    current.push(turn);
  }
  if (current.length) chunks.push({ index: index++, content: current.join("\n") });

  return chunks;
}
