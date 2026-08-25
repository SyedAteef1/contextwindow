# Deployment

Target: **Vercel (app) + Supabase or Neon (database) + Attendee hosted (bot)**.
At MVP volume that costs about $8–10/month, none of it on AWS. See the README
for the cost breakdown and for when self-hosting the bot starts to pay off.

Work through these in order — later steps need values produced by earlier ones.

---

## 1. Database

Any Postgres 16+ with `pgvector`. Supabase and Neon both qualify on their free
tiers.

```sql
create extension if not exists vector;
```

Take the **pooled / transaction-mode** connection string. The app already sets
`prepare: false`, which is what makes pgBouncer-style poolers work.

Apply the schema from your machine:

```bash
DATABASE_URL="postgres://…" npm run db:migrate
```

The first migration creates the extension too, so a fresh database needs
nothing else.

> Supabase's free tier pauses a project after 7 days of inactivity. For a demo
> that's fine; for anything a customer touches, use Neon (which autosuspends and
> wakes on connection) or a paid tier.

---

## 2. Google Cloud

1. Create a project and **enable the Google Calendar API**.
2. Configure the OAuth consent screen. While the app is unverified, only
   accounts listed under **Audience → Test users** can sign in.
3. Create an **OAuth 2.0 Client ID** of type *Web application*.
4. Authorised redirect URIs — add both:
   - `http://localhost:3000/api/auth/google/callback`
   - `https://your-app.vercel.app/api/auth/google/callback`

Scopes requested by the app:

| Scope | Why |
|---|---|
| `openid`, `userinfo.email`, `userinfo.profile` | identify the rep; the email domain is what makes an attendee "external" |
| `calendar.events` | read upcoming meetings, and write the approved follow-up |

`calendar.events` is read **and** write. `calendar.readonly` is not enough —
approving a follow-up creates an event.

> Google treats calendar access as a sensitive scope. Verification is required
> before users outside your test list can connect. Start the process early; it
> is not fast.

---

## 3. Attendee (the meeting bot)

**Hosted** — the cheaper option at low volume:

1. Sign up at `https://app.attendee.dev`.
2. Create an API key.
3. Set `ATTENDEE_BASE_URL=https://app.attendee.dev` and `ATTENDEE_API_KEY=…`.

**Self-hosted** — flat cost, worth it above ~55 hours of calls a month. Attendee
is a Django app in a single Docker image needing Postgres and Redis; see
`github.com/attendee-labs/attendee`. A `t4g.medium` (2 vCPU / 4 GB) handles a
small number of concurrent bots — each bot drives a headless browser, so memory
is the binding constraint, not CPU. Point `ATTENDEE_BASE_URL` at your instance.

For higher-quality transcription than the meeting platform's own closed
captions, add a Deepgram or AssemblyAI key in Attendee's own
**Settings → Credentials** — that is Attendee calling the provider, and it is
separate from this app's `TRANSCRIPTION_PROVIDER`, which is only used when the
bot returns audio instead of text (i.e. MeetingBot).

---

## 4. Deploy to Vercel

```bash
npm i -g vercel
vercel link
vercel --prod
```

Set these in **Project → Settings → Environment Variables**:

| Variable | Value |
|---|---|
| `APP_URL` | `https://your-app.vercel.app` — must be https, bot webhooks require it |
| `SESSION_SECRET` | `openssl rand -base64 32` |
| `ENCRYPTION_KEY` | `openssl rand -base64 32` — separate from the session secret |
| `DATABASE_URL` | pooled connection string from step 1 |
| `ANTHROPIC_API_KEY` | from the Anthropic console |
| `ANTHROPIC_MODEL` | `claude-sonnet-5` |
| `EMBEDDING_PROVIDER` | `voyage` |
| `VOYAGE_API_KEY` | from Voyage AI |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | from step 2 |
| `GOOGLE_REDIRECT_URI` | `https://your-app.vercel.app/api/auth/google/callback` |
| `BOT_PROVIDER` | `attendee` |
| `ATTENDEE_BASE_URL` / `ATTENDEE_API_KEY` | from step 3 |
| `WEBHOOK_SECRET` | `openssl rand -hex 24` |
| `CRON_SECRET` | `openssl rand -hex 24` |
| `FREE_TIER_MEETING_LIMIT` | `5` |

Do **not** leave `EMBEDDING_PROVIDER=hash` in production — it has no semantic
understanding and the chat agent will miss obvious matches.

---

## 5. The bot webhook

Nothing to configure by hand: bots are created with a `webhooks` entry pointing
at

```
https://your-app.vercel.app/api/webhooks/bot?secret=<WEBHOOK_SECRET>
```

subscribed to `bot.state_change` and `transcript.update`.

Attendee does not sign webhook payloads, so the shared secret in the query
string is the authentication — the URL is the credential. Rotating
`WEBHOOK_SECRET` invalidates bots already scheduled with the old URL, so rotate
between calls, not during a busy day.

Deliveries are at-least-once and are deduplicated on `idempotency_key` in
`webhook_deliveries`.

---

## 6. The scheduler

Two pieces, because Vercel's Hobby plan only permits **daily** cron jobs.

**`vercel.json`** already declares a daily sync at 06:00 UTC. That deploys as-is
on Hobby and acts as the backstop.

**`.github/workflows/sync-calendar.yml`** runs the real 15-minute cadence for
free. Add two repository secrets under *Settings → Secrets and variables →
Actions*:

- `APP_URL` — `https://your-app.vercel.app`
- `CRON_SECRET` — the same value as in Vercel

Trigger it once by hand from the Actions tab to confirm it returns HTTP 200.

If you are on Vercel **Pro**, delete the workflow and change `vercel.json` to
`*/15 * * * *` instead.

**On the EC2 host** neither applies: `docker-compose.prod.yml` runs a `scheduler`
service that calls the sync endpoint every 15 minutes from inside the compose
network. That cadence is the one that matters — a rep can book a meeting for
this afternoon, and a brief that arrives tomorrow is worthless. Re-running the
sync is cheap because it skips any meeting that already has a brief.

---

## 7. Verify

1. Visit the app and connect Google Calendar. Grant the calendar scope.
2. Put a meeting on your calendar 20+ minutes out with an attendee at a
   different domain, and a Google Meet or Zoom link.
3. Run the GitHub Action by hand — or press **Check calendar now** in the UI.
4. The meeting appears on the rail with a brief within a minute or two.
5. Check Attendee's dashboard: a bot should be `scheduled` with the right
   `join_at`.
6. After the call, the transcript, summary, signals, and a drafted follow-up
   appear. Approving it creates the calendar event.

To test the wrap-up without holding a real meeting: open any past meeting and
paste a transcript into **Add the transcript**. The full pipeline runs on it.

---

## Operational notes

**Function duration.** Research and wrap-up set `maxDuration = 300`. Vercel's
Hobby plan caps functions well below that — check the current limit for your
plan. If a brief times out, the meeting keeps `errorMessage` and the rep can
retry with **Research again**; nothing is lost.

**Refresh tokens.** Google only returns one when `access_type=offline` and
`prompt=consent` are both sent, which this app does. If a rep's sync starts
failing with "no refresh token is stored", have them disconnect the app at
`myaccount.google.com/permissions` and sign in again.

**Free-tier resets** happen on the 1st of each month, evaluated lazily on the
next read of the meter rather than by a scheduled job.

**Cost control.** The largest variable is Claude web search in the research
agent, capped at 8 searches per brief via `WEB_SEARCH_TOOL.max_uses`. Lower it
to cut the cost of a brief.


## Launch checklist

In order. Steps 1–3 are the ones that block everything else.

**1. AWS credentials.** `scripts/deploy-aws.sh` reads `ACCESS_KEY` and
`SECRET_KEY` from `.env`, and they must belong to the account that owns the
instance and the recordings bucket — **598886663292**, which is not the account
your local `aws` profiles resolve to. The script now fails immediately with a
clear message rather than deploying into the wrong place.

**2. DNS.** Point an A record at the instance:

```
sales.contextwindowhq.com.   A   <instance public IP>
```

This is a hard blocker for bots. Providers refuse plain-http webhooks, so
without a hostname there is no TLS, and without TLS no transcript ever arrives.

**3. Deploy.** Pass the domain and the bot backend explicitly:

```
DEPLOY_DOMAIN=sales.contextwindowhq.com \
DEPLOY_BOT_PROVIDER=attendee \
  ./scripts/deploy-aws.sh
```

`DEPLOY_BOT_PROVIDER` defaults to `noop`; leave it there until Attendee is
actually running on the host, so the app refuses to send bots rather than
failing on every meeting.

**4. Google OAuth.** Add the deployed redirect URI in the Cloud console:

```
https://sales.contextwindowhq.com/api/auth/google/callback
```

**5. Re-consent, which is easy to miss.** Sending the recap email needs the
`gmail.send` scope, and it was added after the first sign-in. Existing
credentials do not have it, and the send fails with a 403 that reads like a bug.
Every rep must sign out and sign in again once. New users are unaffected.

**6. Attendee.** Bots dispatched from the deployed backend need Attendee on the
same host, reachable at `http://host.docker.internal:8000`, with the
one-container-per-bot launcher from `deploy/attendee/docker-compose.bots.yaml`.

**7. Verify.** Section 7 below, then book a real external meeting and watch a
brief appear within 15 minutes.

---

## Recordings

Bots are asked for **mp3**, not the mp4 default. We transcribe the call rather
than watch it, so video is storage we never read — roughly 13.8 MiB per minute
against about 1 for audio — and audio-only also cuts the bot's CPU request,
which is what makes concurrency affordable.

The recording lives in the bot provider's bucket, not ours. Attendee returns a
short-lived signed URL from `GET /api/v1/bots/{id}/recording`, and the meeting
page mints a fresh one per view rather than storing a link that expires between
testing and use.

Attendee ships pointed at MinIO for local development. To store recordings in
the real bucket, set these in **Attendee's** `.env` and restart it:

```
AWS_RECORDING_STORAGE_BUCKET_NAME=sales-intel-recordings-598886663292
AWS_ACCESS_KEY_ID=<a key with s3:PutObject/GetObject on that bucket>
AWS_SECRET_ACCESS_KEY=<...>
AWS_DEFAULT_REGION=ap-south-1
```

and **delete the `AWS_ENDPOINT_URL` line** — while it is present every upload
goes to MinIO regardless of the bucket name, which is the failure mode that
looks like "S3 is configured but empty".

The bucket already exists with private ACLs, AES256 encryption and a 90-day
lifecycle rule. Recordings are not deleted when a meeting is deleted from the
app; the lifecycle rule is what bounds storage.

---

## Running more than one bot at a time

Attendee's default launch method runs every bot inside the shared Celery worker
process. Three concurrent bots took that worker to 961% CPU and a fourth never
left `joining` — which looks like a waiting-room problem from the outside and
is not one. Select a different method with `LAUNCH_BOT_METHOD`:

| Mode | Isolation | Needs |
| --- | --- | --- |
| `celery` (implicit default) | none — all bots share one process | nothing |
| `docker-compose-multi-host` | one container per bot, own CPU/memory cap | Docker socket |
| `kubernetes` | one pod per bot, cluster-autoscaled | a cluster |

Use `docker-compose-multi-host`: a container per bot with a hard concurrency
cap, auto-removed on exit, without running a cluster.
`deploy/attendee/docker-compose.bots.yaml` is the override — copy it next to
`dev.docker-compose.yaml` and start with both:

```
docker compose -f dev.docker-compose.yaml -f docker-compose.bots.yaml up -d
```

Linux only. The launcher gives bot containers `network_mode: host`, which Docker
Desktop for macOS does not support.

### Sizing

`BOT_CPU_REQUEST` defaults to **4** cores per bot, but that is a
recording-video-at-1080p number. Attendee's own test fixtures show the intended
per-workload tuning, and ours is the cheapest row:

| Workload | CPU request |
| --- | --- |
| Meet, audio **and** video | 8 |
| Zoom, audio and video | 6 |
| **Meet, audio only** | **2** |

We transcribe rather than watch, so audio-only is all we need. Two cores is
still a *peak* figure — joining a call is spiky, steady-state audio capture is
not — so schedule on a smaller request and let bots burst into a limit. See
`docs/SCALING.md` for the fleet arithmetic.

| Instance | vCPU / RAM | Concurrent bots | ap-south-1 on-demand |
| --- | --- | --- | --- |
| `m7i-flex.large` (current) | 2 / 8 | 1 | ~$74/mo |
| `c7i.2xlarge` | 8 / 16 | ~5 | ~$261/mo |
| `c7i.4xlarge` | 16 / 32 | ~12 | ~$521/mo |

**x86 only.** Graviton looks like an easy ~45% saving and is not one yet:
Attendee's `Dockerfile.arm64` pins Chrome 134, which predates Google's
linux-arm64 build, so it fails to build. Google now does publish an arm64 Chrome
deb (151+), but Chrome-for-Testing still ships **no linux-arm64 chromedriver**,
so the arm64 path needs a driver story before it is real. Revisit later; do not
put a launch on it.

### Locally

The local worker image is `linux/amd64` on an arm64 Mac, so bots run under
emulation — that is the other half of the CPU exhaustion, and it makes local CPU
numbers useless for capacity planning. Measure on x86. Keep local testing to one
or two bots.
