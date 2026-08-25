/** Completes the Google OAuth flow and signs the rep in. */
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { handler } from "@/lib/api";
import { env } from "@/lib/env";
import {
  exchangeCodeForTokens,
  fetchProfile,
  upsertUserAndCredentials,
} from "@/lib/google/oauth";
import { setSessionCookie } from "@/lib/session";
import { OAUTH_STATE_COOKIE } from "../start/route";

function failureRedirect(reason: string): NextResponse {
  const url = new URL("/", env().APP_URL);
  url.searchParams.set("auth_error", reason);
  return NextResponse.redirect(url);
}

export const GET = handler(async (request: Request) => {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  if (error) return failureRedirect(error);
  if (!code || !state) return failureRedirect("missing_code");

  const store = await cookies();
  const expectedState = store.get(OAUTH_STATE_COOKIE)?.value;
  store.delete(OAUTH_STATE_COOKIE);

  if (!expectedState || expectedState !== state) {
    return failureRedirect("state_mismatch");
  }

  const tokens = await exchangeCodeForTokens(code);
  const profile = await fetchProfile(tokens.accessToken);

  if (!profile.email) return failureRedirect("no_email");

  const { userId, email } = await upsertUserAndCredentials(profile, tokens);
  await setSessionCookie({ userId, email });

  // Land on the dashboard; the first calendar sync is triggered from there.
  return NextResponse.redirect(new URL("/meetings?connected=1", env().APP_URL));
});
