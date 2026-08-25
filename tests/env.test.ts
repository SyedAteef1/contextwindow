/**
 * The OAuth redirect URI has to agree with APP_URL.
 *
 * When they drift, Google returns `redirect_uri_mismatch`, which reads like a
 * console misconfiguration and sends you looking in the wrong place. It cost a
 * deployment once already: APP_URL was overridden for production while the
 * redirect URI kept a hardcoded localhost default.
 */
import { afterEach, describe, expect, it, vi } from "vitest";

async function loadEnv(overrides: Record<string, string | undefined>) {
  vi.resetModules();
  const previous = { ...process.env };
  for (const [key, value] of Object.entries(overrides)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  const loaded = await import("@/lib/env");
  const result = loaded.env();
  process.env = previous;
  return result;
}

afterEach(() => vi.resetModules());

describe("GOOGLE_REDIRECT_URI", () => {
  it("derives from APP_URL when unset", async () => {
    const env = await loadEnv({
      APP_URL: "https://sales.contextwindowhq.com",
      GOOGLE_REDIRECT_URI: undefined,
    });
    expect(env.GOOGLE_REDIRECT_URI).toBe(
      "https://sales.contextwindowhq.com/api/auth/google/callback",
    );
  });

  it("does not double the slash when APP_URL has a trailing one", async () => {
    const env = await loadEnv({
      APP_URL: "https://sales.contextwindowhq.com/",
      GOOGLE_REDIRECT_URI: undefined,
    });
    expect(env.GOOGLE_REDIRECT_URI).toBe(
      "https://sales.contextwindowhq.com/api/auth/google/callback",
    );
  });

  it("still honours an explicit value", async () => {
    const env = await loadEnv({
      APP_URL: "https://sales.contextwindowhq.com",
      GOOGLE_REDIRECT_URI: "https://other.example.com/api/auth/google/callback",
    });
    expect(env.GOOGLE_REDIRECT_URI).toBe("https://other.example.com/api/auth/google/callback");
  });

  it("never points at localhost once APP_URL is a real origin", async () => {
    const env = await loadEnv({
      APP_URL: "https://sales.contextwindowhq.com",
      GOOGLE_REDIRECT_URI: undefined,
    });
    expect(env.GOOGLE_REDIRECT_URI).not.toContain("localhost");
  });
});
