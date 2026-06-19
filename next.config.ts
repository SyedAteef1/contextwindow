import type { NextConfig } from "next"

const nextConfig: NextConfig = {
	// Heavy native/wasm packages used by the Context Window engine must load at runtime
	// on the server, not be bundled.
	serverExternalPackages: ["@huggingface/transformers", "@electric-sql/pglite"],
}

export default nextConfig
