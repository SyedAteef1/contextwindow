/**
 * Session cookie: a signed JWT holding just the user id and email.
 *
 * Deliberately not a database-backed session — one signed cookie keeps every
 * request stateless, which is what makes the app cheap to run on serverless.
 */
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

import { env } from "./env";

export const SESSION_COOKIE = "si_session";

export type SessionPayload = {
  userId: string;
  email: string;
};

function secretKey(): Uint8Array {
  return new TextEncoder().encode(env().SESSION_SECRET);
}

export async function createSessionToken(payload: SessionPayload): Promise<string> {
  const ttlHours = env().SESSION_TTL_HOURS;
  return new SignJWT({ email: payload.email })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.userId)
    .setIssuedAt()
    .setExpirationTime(`${ttlHours}h`)
    .sign(secretKey());
}

export async function verifySessionToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey(), { algorithms: ["HS256"] });
    if (!payload.sub || typeof payload.email !== "string") return null;
    return { userId: payload.sub, email: payload.email };
  } catch {
    return null;
  }
}

export async function setSessionCookie(payload: SessionPayload): Promise<void> {
  const token = await createSessionToken(payload);
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: env().NODE_ENV === "production",
    path: "/",
    maxAge: env().SESSION_TTL_HOURS * 3600,
    // Shared across the apex and the app subdomain, so the public site can
    // tell a signed-in visitor from a stranger and send them onward.
    ...(env().COOKIE_DOMAIN ? { domain: env().COOKIE_DOMAIN } : {}),
  });
}

export async function clearSessionCookie(): Promise<void> {
  const store = await cookies();
  // Deleted with the same scope it was set with: a delete that omits the
  // domain removes a host-only cookie that is not the one signing them in,
  // and the shared one survives — so logging out appears to do nothing.
  const domain = env().COOKIE_DOMAIN;
  if (domain) store.set(SESSION_COOKIE, "", { path: "/", domain, maxAge: 0 });
  else store.delete(SESSION_COOKIE);
}

export async function readSession(): Promise<SessionPayload | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}
