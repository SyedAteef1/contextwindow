// Step 2 of Google login: verify state, exchange the code, read the user's email/name from the
// id_token, find-or-create their identity (auto-approve domain or pending→Slack), set a session.
import { NextResponse } from "next/server";
import { upsertLoginIdentity } from "../../../../../lib/auth/approval";
import { setSession } from "../../../../../lib/auth/session";
import { log } from "../../../../../lib/log";
import { getPostHogClient } from "../../../../../lib/posthog-server";

export const runtime = "nodejs";
const APP_URL = process.env.APP_URL ?? "https://localhost:3000";
const REDIRECT_URI = `${APP_URL}/api/auth/google/callback`;

type IdTokenClaims = { sub: string; email?: string; name?: string };

function decodeIdToken(jwt: string): IdTokenClaims {
  const payload = jwt.split(".")[1];
  return JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
}

const fail = (reason: string) => NextResponse.redirect(new URL(`/login?error=${reason}`, APP_URL));

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const cookieState = req.headers.get("cookie")?.match(/(?:^|;\s*)g_state=([^;]+)/)?.[1];
  if (!code || !state || state !== cookieState) return fail("state");

  try {
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID ?? "",
        client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
        redirect_uri: REDIRECT_URI,
        grant_type: "authorization_code",
      }),
    });
    const tok = (await tokenRes.json()) as { id_token?: string; error?: string; error_description?: string };
    if (!tok.id_token) {
      log.error("auth", `google token exchange failed: ${tok.error} ${tok.error_description ?? ""}`);
      return fail("token");
    }

    const claims = decodeIdToken(tok.id_token);
    if (!claims.email) return fail("noemail");

    const row = await upsertLoginIdentity({ surface: "google", surfaceUserId: claims.sub, email: claims.email, displayName: claims.name });
    await setSession(row.principalId);

    const isNew = Date.now() - row.createdAt.getTime() < 10_000;
    const ph = getPostHogClient();
    ph.identify({ distinctId: row.principalId, properties: { email: claims.email, name: claims.name } });
    ph.capture({
      distinctId: row.principalId,
      event: isNew ? "user_signed_up" : "user_signed_in",
      properties: { email: claims.email, auth_provider: "google", approval_status: row.status },
    });

    return NextResponse.redirect(new URL(row.status === "approved" ? "/app" : "/pending", APP_URL));
  } catch (err) {
    log.error("auth", "google callback error", err instanceof Error ? err.message : err);
    return fail("server");
  }
}
