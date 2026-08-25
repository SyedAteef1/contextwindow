/** Begins the Google OAuth flow. */
import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { buildAuthorizationUrl } from "@/lib/google/oauth";
import { env } from "@/lib/env";
import { handler } from "@/lib/api";

export const OAUTH_STATE_COOKIE = "si_oauth_state";

export const GET = handler(async () => {
  // CSRF guard: the callback must present the same state we issued here.
  const state = randomBytes(24).toString("base64url");

  const store = await cookies();
  store.set(OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: "lax",
    secure: env().NODE_ENV === "production",
    path: "/",
    maxAge: 600,
  });

  return NextResponse.redirect(buildAuthorizationUrl(state));
});
