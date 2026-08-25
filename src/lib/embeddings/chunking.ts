/** Splitting long documents into embeddable pieces. */

export type Chunk = { index: number; content: string };

export const CHUNK_CHARS = 3200;
export const CHUNK_OVERLAP_CHARS = 320;

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
