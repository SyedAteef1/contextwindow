/**
 * Envelope encryption for OAuth tokens at rest.
 *
 * A refresh token is a long-lived key to a rep's calendar; a database dump
 * should not hand it over in plaintext. AES-256-GCM with a random IV per value
 * and the auth tag stored alongside.
 */
import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";

import { env } from "./env";

const ALGORITHM = "aes-256-gcm";
const IV_BYTES = 12;
const TAG_BYTES = 16;
/** Fixed salt: the secret is the entropy source, not the salt. */
const KEY_SALT = "sales-intel/oauth-token/v1";

let cachedKey: Buffer | null = null;

function key(): Buffer {
  if (!cachedKey) {
    const secret = process.env.ENCRYPTION_KEY ?? env().SESSION_SECRET;
    cachedKey = scryptSync(secret, KEY_SALT, 32);
  }
  return cachedKey;
}

/** Returns `base64(iv || ciphertext || authTag)`. */
export function encrypt(plaintext: string): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key(), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return Buffer.concat([iv, ciphertext, cipher.getAuthTag()]).toString("base64");
}

export function decrypt(payload: string): string {
  const raw = Buffer.from(payload, "base64");
  if (raw.length <= IV_BYTES + TAG_BYTES) {
    throw new Error("Ciphertext is too short to be valid");
  }
  const iv = raw.subarray(0, IV_BYTES);
  const tag = raw.subarray(raw.length - TAG_BYTES);
  const ciphertext = raw.subarray(IV_BYTES, raw.length - TAG_BYTES);

  const decipher = createDecipheriv(ALGORITHM, key(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}

/** Constant-time compare for shared secrets (webhook + cron guards). */
export function timingSafeEqualString(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}
