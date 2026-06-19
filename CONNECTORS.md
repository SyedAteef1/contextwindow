# Connectors — real OAuth setup

Connecting is a **real OAuth flow**. A provider only shows **Connected** once a real access
token is stored. Until you register an app and add its client id/secret to `.env`, the card
shows **Setup required** (it is never faked).

For every provider, register the app in that provider's developer console and set the
**redirect/callback URL** to:

```
http://localhost:3000/api/connect/<provider>/callback
```

(Use your real domain instead of `localhost:3000` in production — set `APP_URL` to match.)

`<provider>` is one of: `github`, `notion`, `slack`, `google-drive`, `gmail`, `onedrive`,
`zendesk`, `pagerduty`.

Then put the credentials in `.env` and restart `bun run dev2`.

| Provider | Where to register | Redirect URL | `.env` keys |
|---|---|---|---|
| **GitHub** | github.com → Settings → Developer settings → **OAuth Apps** | `/api/connect/github/callback` | `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` |
| **Notion** | notion.so/my-integrations → **Public integration** | `/api/connect/notion/callback` | `NOTION_CLIENT_ID`, `NOTION_CLIENT_SECRET` |
| **Slack** | api.slack.com/apps → Create App → **OAuth & Permissions** (bot scopes: `channels:read,channels:history,groups:read,groups:history`) | `/api/connect/slack/callback` | `SLACK_CLIENT_ID`, `SLACK_CLIENT_SECRET` |
| **Google Drive** | console.cloud.google.com → APIs & Services → Credentials → **OAuth client (Web)** + enable Drive API | `/api/connect/google-drive/callback` | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` |
| **Gmail** | same Google project + enable Gmail API | `/api/connect/gmail/callback` | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` |
| **OneDrive** | portal.azure.com → App registrations → **Redirect URI (Web)**, add `Files.Read offline_access User.Read` | `/api/connect/onedrive/callback` | `MICROSOFT_CLIENT_ID`, `MICROSOFT_CLIENT_SECRET` |
| **Zendesk** | `https://<sub>.zendesk.com/admin` → Apps & integrations → **OAuth Clients** | `/api/connect/zendesk/callback` | `ZENDESK_CLIENT_ID`, `ZENDESK_CLIENT_SECRET` (you'll be asked for the subdomain on connect) |
| **PagerDuty** | PagerDuty → Integrations → **App Registration** (OAuth) | `/api/connect/pagerduty/callback` | `PAGERDUTY_CLIENT_ID`, `PAGERDUTY_CLIENT_SECRET` |

## What happens on Connect
1. Click **Connect** → browser redirects to the provider's real authorize page.
2. You approve → provider redirects to `/api/connect/<provider>/callback?code=…`.
3. We exchange the code for a real access token (+ refresh token where supported) and store it.
4. The card flips to **Connected**. Click **Sync** to pull real data into the brain
   (READMEs, Notion pages, Slack history, Drive docs, Gmail, OneDrive files, Zendesk
   tickets, PagerDuty incidents) — then it's searchable via `cw search` / the agent.

> Google/Microsoft require enabling the relevant API and (for sensitive scopes) may show an
> "unverified app" screen during development — that's expected until you verify the app.

## Slack — full setup (real-time + answer bot)

Beyond OAuth, Slack needs event + command wiring so the bot can read messages and answer.
In api.slack.com/apps → your app:

1. **Basic Information → App Credentials** → copy **Signing Secret** → `SLACK_SIGNING_SECRET` in `.env`.
2. **OAuth & Permissions → Bot Token Scopes**: `channels:read channels:history groups:read groups:history im:history mpim:history app_mentions:read chat:write commands users:read` (the Connect flow already requests these).
3. **Event Subscriptions** → enable → Request URL: `http://localhost:3000/api/slack/events`
   (Slack will call it once for `url_verification` — it must be reachable; for local use a tunnel like ngrok). Subscribe to bot events: `app_mention`, `message.channels`, `message.im`.
4. **Slash Commands** → Create `/ask` → Request URL: `http://localhost:3000/api/slack/events`.
5. Reinstall the app to the workspace, then **invite the bot** to channels you want it to read/answer in.

How it behaves (answer-only, all defaults):
- Reads messages in channels it's invited to → ingests into a per-channel space (`slack:<channel>`), secrets redacted.
- Answers **only** when `@mentioned`, sent a **DM**, or via **`/ask`** — threaded reply with sources.
- On a miss (or no Bedrock token) it replies "I don't know that yet."

> Local note: Slack must reach your URL. Run a tunnel (`ngrok http 3000`) and use the public
> URL for the Event/Command/redirect URLs (and set `APP_URL` to it).

## Quick test (GitHub — least setup)
1. Create a GitHub OAuth App, callback `http://localhost:3000/api/connect/github/callback`.
2. Put client id/secret in `.env`, restart `bun run dev2`.
3. Open `/integrations` → GitHub now shows **Connect** → click → approve → **Connected**.
4. Click **Sync** → READMEs ingest → `bun run cw search "<something in your repos>"`.
