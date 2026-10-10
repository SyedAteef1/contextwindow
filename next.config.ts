import type { NextConfig } from "next"

const nextConfig: NextConfig = {
	// Heavy native/wasm packages used by the Context Window engine must load at runtime
	// on the server, not be bundled.
	serverExternalPackages: ["@huggingface/transformers", "@electric-sql/pglite"],

	// Reverse-proxy PostHog analytics through our own domain (/ingest) so ad-blockers
	// don't drop events (the afterFiles entries). Matches NEXT_PUBLIC_POSTHOG_HOST=/ingest in instrumentation-client.ts.
	async rewrites() {
		return {
			// The search-fund page (app/finance) is the homepage of finance.contextwindowhq.com.
			// beforeFiles so it wins over app/page.tsx, which owns "/" on every other host.
			beforeFiles: [
				{
					source: "/",
					has: [{ type: "host", value: "finance\\.(?:contextwindowhq\\.com|localhost)(?::\\d+)?" }],
					destination: "/finance",
				},
			],
			afterFiles: [
				{ source: "/ingest/static/:path*", destination: "https://us-assets.i.posthog.com/static/:path*" },
				{ source: "/ingest/array/:path*", destination: "https://us-assets.i.posthog.com/array/:path*" },
				{ source: "/ingest/:path*", destination: "https://us.i.posthog.com/:path*" },
			],
			fallback: [],
		}
	},
	// PostHog's API uses trailing-slash-sensitive routes; don't let Next redirect them.
	skipTrailingSlashRedirect: true,
}

export default nextConfig
