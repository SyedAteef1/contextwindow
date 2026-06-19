// Local embeddings via Transformers.js (no cloud creds required — your AWS/Bedrock IAM
// only permits Anthropic models, which have no embedding endpoint). Model is downloaded
// once to the HF cache, then runs fully offline. 384-dim, normalized (cosine == dot).

import { log } from "../log"

export const EMBEDDING_MODEL = "Xenova/all-MiniLM-L6-v2"
export const EMBEDDING_DIM = 384

// biome-ignore lint/suspicious/noExplicitAny: transformers pipeline type is dynamic
let extractorPromise: Promise<any> | null = null

async function getExtractor() {
	if (!extractorPromise) {
		log.info("embeddings", `loading model ${EMBEDDING_MODEL} (first run downloads weights)…`)
		extractorPromise = import("@huggingface/transformers").then(async ({ pipeline }) => {
			const ex = await pipeline("feature-extraction", EMBEDDING_MODEL)
			log.info("embeddings", "model ready")
			return ex
		})
	}
	return extractorPromise
}

export async function embedText(value: string): Promise<number[]> {
	const extractor = await getExtractor()
	const output = await extractor(value, { pooling: "mean", normalize: true })
	return Array.from(output.data as Float32Array)
}

export async function embedTexts(values: string[]): Promise<number[][]> {
	if (values.length === 0) return []
	const extractor = await getExtractor()
	const output = await extractor(values, { pooling: "mean", normalize: true })
	const list = output.tolist() as number[][]
	log.info("embeddings", `embedded ${values.length} texts`)
	return list
}
