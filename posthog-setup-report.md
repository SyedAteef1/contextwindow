<wizard-report>
# PostHog post-wizard report

The wizard has completed a deep integration of PostHog analytics into Context Window. Client-side tracking is initialised via `instrumentation-client.ts` (Next.js 15.3+ convention) with a reverse proxy through `/ingest` to bypass ad-blockers. Server-side tracking uses `lib/posthog-server.ts` (`posthog-node`) and fires from three API routes. Users are identified on both client and server at the point of login/signup, ensuring cross-domain event correlation. Error tracking (`captureException`) is wired into the demo form error path and integration sync failures.

| Event | Description | File |
|---|---|---|
| `demo_cta_clicked` | User clicks any 'Book a Demo' or 'Request Founding Access' CTA on the landing page | `app/page.tsx` |
| `demo_requested` | User successfully submits the demo request form | `app/apply/page.tsx` |
| `demo_request_failed` | The demo request form submission fails | `app/apply/page.tsx` |
| `demo_lead_captured` | Server confirms a demo lead was stored (Slack and/or DB) | `app/api/apply/route.ts` |
| `user_signed_in` | Returning user completes Google OAuth | `app/api/auth/google/callback/route.ts` |
| `user_signed_up` | New user authenticates via Google for the first time | `app/api/auth/google/callback/route.ts` |
| `integration_connect_clicked` | User clicks Connect for a provider on the integrations page | `components/integrations-view.tsx` |
| `integration_connected` | Server confirms an OAuth integration token was stored | `app/api/connect/[provider]/callback/route.ts` |
| `integration_synced` | User triggers a manual sync and it succeeds | `components/integrations-view.tsx` |
| `integration_disconnected` | User disconnects a previously connected integration | `components/integrations-view.tsx` |

## Next steps

We've built some insights and a dashboard for you to keep an eye on user behavior, based on the events we just instrumented:

- **Dashboard**: [Analytics basics (wizard)](https://us.posthog.com/project/479506/dashboard/1740641)
- **Insight 1**: [Demo CTA clicks by location (wizard)](https://us.posthog.com/project/479506/insights/Z24RJU0s) — Which landing page section drives the most demo clicks
- **Insight 2**: [Demo conversion funnel (wizard)](https://us.posthog.com/project/479506/insights/BZQa7DTY) — CTA click → form submitted → server-side lead captured
- **Insight 3**: [New user signups vs sign-ins (wizard)](https://us.posthog.com/project/479506/insights/EfUaHtUz) — Daily new registrations vs returning sign-ins
- **Insight 4**: [Integration activations over time (wizard)](https://us.posthog.com/project/479506/insights/vnHf6KQC) — Connect clicks vs successful OAuth connections
- **Insight 5**: [Integration engagement (wizard)](https://us.posthog.com/project/479506/insights/U5Kq94E5) — Connected / synced / disconnected actions per day

## Verify before merging

- [ ] Run a full production build (`pnpm build`) and fix any lint or type errors introduced by the generated code.
- [ ] Run the test suite — call sites that were rewritten or instrumented may need updated mocks or fixtures.
- [ ] Add `NEXT_PUBLIC_POSTHOG_KEY`, `NEXT_PUBLIC_POSTHOG_HOST`, `NEXT_PUBLIC_POSTHOG_UI_HOST`, and `POSTHOG_API_HOST` to `.env.example` and any bootstrap scripts so collaborators know what to set.
- [ ] Wire source-map upload (`posthog-cli sourcemap` or equivalent) into CI so production stack traces de-minify in PostHog error tracking.
- [ ] Confirm the returning-visitor path also calls `identify` — the current implementation identifies on every Google OAuth callback, which covers both new and returning users. Verify this holds if you add other auth surfaces (e.g. magic links).

### Agent skill

We've left an agent skill folder in your project at `.claude/skills/integration-nextjs-app-router/`. You can use this context for further agent development when using Claude Code. This will help ensure the model provides the most up-to-date approaches for integrating PostHog.

</wizard-report>
