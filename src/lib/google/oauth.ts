/**
 * Google OAuth 2.0, spoken directly over HTTP.
 *
 * The `googleapis` package is ~50MB and mostly codegen we would never call.
 * The three endpoints we need — authorize, token exchange, refresh — are a few
 * dozen lines each, so we talk to them directly and keep the bundle small.
 */
import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { authEvents, oauthCredentials, users, workspaces } from "@/db/schema";
import { decrypt, encrypt } from "@/lib/crypto";
import { isConsumerDomain } from "@/lib/google/calendar";
import { env, requireEnv } from "@/lib/env";
import { notify } from "@/lib/notify";

const AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const USERINFO_ENDPOINT = "https://www.googleapis.com/oauth2/v3/userinfo";

/**
 * `calendar.events` (read + write) is required: we read upcoming meetings and
 * write the approved follow-up back. Everything else is identity.
 */
export const GOOGLE_SCOPES = [
  "openid",
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/userinfo.profile",
  "https://www.googleapis.com/auth/calendar.events",
  // Send-only. We never read the rep's mail; the recap goes out from their
  // own address so replies reach a human, not us.
  "https://www.googleapis.com/auth/gmail.send",
] as const;

export type GoogleTokens = {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: Date;
  scopes: string[];
};

export type GoogleProfile = {
  sub: string;
  email: string;
  name?: string;
  picture?: string;
};

export function buildAuthorizationUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: requireEnv("GOOGLE_CLIENT_ID"),
    redirect_uri: env().GOOGLE_REDIRECT_URI,
    response_type: "code",
    scope: GOOGLE_SCOPES.join(" "),
    // `offline` + `consent` is what actually returns a refresh token. Without
    // `prompt=consent` Google omits it on every login after the first, and the
    // background calendar sync silently stops working days later.
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state,
  });
  return `${AUTH_ENDPOINT}?${params.toString()}`;
}

export async function exchangeCodeForTokens(code: string): Promise<GoogleTokens> {
  const response = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: requireEnv("GOOGLE_CLIENT_ID"),
      client_secret: requireEnv("GOOGLE_CLIENT_SECRET"),
      redirect_uri: env().GOOGLE_REDIRECT_URI,
      grant_type: "authorization_code",
    }),
  });

  if (!response.ok) {
    throw new Error(`Google token exchange failed (${response.status}): ${await response.text()}`);
  }

  const data = (await response.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
    scope?: string;
  };

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token ?? null,
    expiresAt: new Date(Date.now() + data.expires_in * 1000),
    scopes: data.scope?.split(" ") ?? [...GOOGLE_SCOPES],
  };
}

export async function fetchProfile(accessToken: string): Promise<GoogleProfile> {
  const response = await fetch(USERINFO_ENDPOINT, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) {
    throw new Error(`Google userinfo failed (${response.status}): ${await response.text()}`);
  }
  return (await response.json()) as GoogleProfile;
}

async function refreshAccessToken(refreshToken: string): Promise<GoogleTokens> {
  const response = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: requireEnv("GOOGLE_CLIENT_ID"),
      client_secret: requireEnv("GOOGLE_CLIENT_SECRET"),
      grant_type: "refresh_token",
    }),
  });

  if (!response.ok) {
    throw new Error(`Google token refresh failed (${response.status}): ${await response.text()}`);
  }

  const data = (await response.json()) as {
    access_token: string;
    expires_in: number;
    scope?: string;
  };

  return {
    // A refresh response never re-issues the refresh token; the caller keeps it.
    accessToken: data.access_token,
    refreshToken: null,
    expiresAt: new Date(Date.now() + data.expires_in * 1000),
    scopes: data.scope?.split(" ") ?? [...GOOGLE_SCOPES],
  };
}

export async function upsertUserAndCredentials(
  profile: GoogleProfile,
  tokens: GoogleTokens,
): Promise<{ userId: string; email: string; isNewUser: boolean }> {
  const emailDomain = profile.email.split("@")[1]?.toLowerCase() ?? "";

  // Checked before the upsert, because afterwards there is no way to tell a
  // first sign-up from a returning login — the row exists either way.
  const priorUser = await db.query.users.findFirst({
    where: eq(users.email, profile.email.toLowerCase()),
  });
  const isNewUser = !priorUser;

  /*
   * The workspace, derived rather than created by hand.
   *
   * Everyone at the same email domain lands in the same one, so the second rep
   * from a company inherits its material instead of starting empty. Consumer
   * domains would collapse every gmail user into one shared workspace, so those
   * get their own keyed on the full address.
   */
  const workspaceDomain = isConsumerDomain(emailDomain)
    ? profile.email.toLowerCase()
    : emailDomain;
  const [workspace] = await db
    .insert(workspaces)
    .values({
      domain: workspaceDomain,
      name: workspaceDomain.split(".")[0].replace(/^./, (c) => c.toUpperCase()),
    })
    .onConflictDoUpdate({ target: workspaces.domain, set: { updatedAt: new Date() } })
    .returning();

  const [user] = await db
    .insert(users)
    .values({
      email: profile.email.toLowerCase(),
      name: profile.name ?? null,
      pictureUrl: profile.picture ?? null,
      googleSub: profile.sub,
      emailDomain,
      workspaceId: workspace.id,
    })
    .onConflictDoUpdate({
      target: users.email,
      set: {
        name: profile.name ?? null,
        pictureUrl: profile.picture ?? null,
        googleSub: profile.sub,
        emailDomain,
        workspaceId: workspace.id,
        updatedAt: new Date(),
      },
    })
    .returning();

  // On a repeat login Google may omit the refresh token; keep the stored one
    // rather than overwriting it with null.
  const existing = await db.query.oauthCredentials.findFirst({
    where: and(eq(oauthCredentials.userId, user.id), eq(oauthCredentials.provider, "google")),
  });

  const refreshEncrypted = tokens.refreshToken
    ? encrypt(tokens.refreshToken)
    : (existing?.refreshTokenEncrypted ?? null);

  await db
    .insert(oauthCredentials)
    .values({
      userId: user.id,
      provider: "google",
      accessTokenEncrypted: encrypt(tokens.accessToken),
      refreshTokenEncrypted: refreshEncrypted,
      expiresAt: tokens.expiresAt,
      scopes: tokens.scopes,
    })
    .onConflictDoUpdate({
      target: [oauthCredentials.userId, oauthCredentials.provider],
      set: {
        accessTokenEncrypted: encrypt(tokens.accessToken),
        refreshTokenEncrypted: refreshEncrypted,
        expiresAt: tokens.expiresAt,
        scopes: tokens.scopes,
        updatedAt: new Date(),
      },
    });

  // Recorded after the credentials are stored, so an event only exists for a
  // sign-in that actually completed. Failing to log must never fail the login.
  try {
    await db
      .insert(authEvents)
      .values({ userId: user.id, event: isNewUser ? "signed_up" : "signed_in" });

    // Every sign-in, including the first, so the log is a complete record of
    // who was here and when rather than a record of who was new.
    notify({
      kind: "signin",
      email: user.email,
      name: user.name,
      domain: emailDomain,
      at: new Date(),
      isNewUser,
    });

    // And again, separately, the first time. A returning rep is a log line; a
    // registration is news, and it goes where news gets answered.
    if (isNewUser) {
      notify({
        kind: "signup",
        email: user.email,
        name: user.name,
        domain: emailDomain,
      });
    }
  } catch (error) {
    console.error("Failed to record the auth event:", error);
  }

  return { userId: user.id, email: user.email, isNewUser };
}

/** 60s of slack so a token doesn't expire mid-request. */
const EXPIRY_SKEW_MS = 60_000;

/**
 * Returns a usable Google access token for a user, refreshing and re-persisting
 * it when the stored one has expired.
 */
export async function getAccessTokenForUser(userId: string): Promise<string> {
  const credential = await db.query.oauthCredentials.findFirst({
    where: and(eq(oauthCredentials.userId, userId), eq(oauthCredentials.provider, "google")),
  });

  if (!credential) {
    throw new Error(`No Google credentials stored for user ${userId}. Reconnect the calendar.`);
  }

  const stillValid =
    credential.expiresAt && credential.expiresAt.getTime() - EXPIRY_SKEW_MS > Date.now();
  if (stillValid) {
    return decrypt(credential.accessTokenEncrypted);
  }

  if (!credential.refreshTokenEncrypted) {
    throw new Error(
      `Google access token for user ${userId} expired and no refresh token is stored. Reconnect the calendar.`,
    );
  }

  const refreshed = await refreshAccessToken(decrypt(credential.refreshTokenEncrypted));
  await db
    .update(oauthCredentials)
    .set({
      accessTokenEncrypted: encrypt(refreshed.accessToken),
      expiresAt: refreshed.expiresAt,
      updatedAt: new Date(),
    })
    .where(eq(oauthCredentials.id, credential.id));

  return refreshed.accessToken;
}
