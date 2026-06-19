// Lightweight semantic-ish chunker: split on paragraph boundaries, then pack into
// ~target-sized chunks with a small overlap. Good enough to start; replace with a
// token-aware splitter later.

const TARGET = 1200 // approx chars per chunk
const OVERLAP = 150

export function chunkText(text: string): string[] {
	const clean = text.replace(/\r\n/g, "\n").trim()
	if (!clean) return []
	const paras = clean.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean)

	const chunks: string[] = []
	let buf = ""
	for (const para of paras) {
		if (buf && buf.length + para.length + 2 > TARGET) {
			chunks.push(buf)
			buf = buf.slice(Math.max(0, buf.length - OVERLAP))
		}
		buf = buf ? `${buf}\n\n${para}` : para
	}
	if (buf.trim()) chunks.push(buf.trim())

	// Hard-split any oversized single paragraph.
	return chunks.flatMap((c) =>
		c.length <= TARGET * 1.5
			? [c]
			: (c.match(new RegExp(`[\\s\\S]{1,${TARGET}}`, "g")) ?? [c]),
	)
}
