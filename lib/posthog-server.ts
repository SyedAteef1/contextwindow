import { PostHog } from "posthog-node"

let client: PostHog | null = null

export function getPostHogClient(): PostHog {
  if (!client) {
    client = new PostHog(process.env.NEXT_PUBLIC_POSTHOG_KEY!, {
      host: process.env.POSTHOG_API_HOST,
      flushAt: 1,
      flushInterval: 0,
    })
  }
  return client
}
