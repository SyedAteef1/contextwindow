// Client-side instrumentation — runs once before React hydrates (Next.js 15.3+ convention).
// We use it to boot PostHog product analytics for the landing page. If no project key is
// configured it stays a no-op, so local/dev builds without the env var work unchanged.
import posthog from "posthog-js"

const KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY
// Reverse-proxied through /ingest (see next.config.ts rewrites) so ad-blockers don't drop events.
const HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "/ingest"
const UI_HOST = process.env.NEXT_PUBLIC_POSTHOG_UI_HOST ?? "https://us.posthog.com"

if (KEY) {
  posthog.init(KEY, {
    api_host: HOST,
    ui_host: UI_HOST,
    // `defaults` opts into PostHog's current recommended behavior, which includes
    // automatic pageview + pageleave capture (incl. SPA history changes).
    defaults: "2026-01-30",
    capture_exceptions: true,
    person_profiles: "identified_only",
    // Session replay. The recorder.js script and snapshot uploads go through the SAME
    // /ingest reverse proxy (api_host), so ad-blockers can't drop them. Recording still
    // also has to be toggled ON in PostHog → Settings → Project → Session Replay.
    disable_session_recording: false,
    session_recording: {
      maskAllInputs: true, // privacy: never capture typed input values
      maskTextSelector: "[data-ph-mask]", // opt-in masking for sensitive text
    },
  })
}
// Note: `defaults: "2025-05-24"` already auto-captures pageviews on App Router history
// changes, so we deliberately don't add an onRouterTransitionStart hook (it would double-count).
