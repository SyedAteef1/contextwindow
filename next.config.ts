import type { NextConfig } from "next"

const nextConfig: NextConfig = {
	// Heavy native/wasm packages used by the Context Window engine must load at runtime
	// on the server, not be bundled.
	serverExternalPackages: ["@huggingface/transformers", "@electric-sql/pglite"],

	// Reverse-proxy PostHog analytics through our own domain (/ingest) so ad-blockers
	// don't drop events. Matches NEXT_PUBLIC_POSTHOG_HOST=/ingest in instrumentation-client.ts.
	async rewrites() {
		return [
			{ source: "/ingest/static/:path*", destination: "https://us-assets.i.posthog.com/static/:path*" },
			{ source: "/ingest/array/:path*", destination: "https://us-assets.i.posthog.com/array/:path*" },
			{ source: "/ingest/:path*", destination: "https://us.i.posthog.com/:path*" },
		]
	},
	// PostHog's API uses trailing-slash-sensitive routes; don't let Next redirect them.
	skipTrailingSlashRedirect: true,
}

export default nextConfig
