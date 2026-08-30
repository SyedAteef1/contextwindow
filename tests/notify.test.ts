/**
 * Where a notification lands.
 *
 * Two rooms with different jobs: registrations go where a human answers them,
 * sign-ins go to a log. Getting the routing wrong is quiet rather than loud —
 * the message posts successfully, just into the wrong channel — so the
 * destination is worth asserting rather than eyeballing.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const SIGNUPS = "C0BTGRQN6E9";
const USER_LOG = "C0BTGRS7FQD";

/** Captures what would have been posted, per Slack channel. */
function captureSlack() {
  const posts: { channel: string; body: Record<string, unknown> }[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body ?? "{}"));
      if (String(url).includes("chat.postMessage")) posts.push({ channel: body.channel, body });
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }),
  );
  return posts;
}

async function loadNotify(overrides: Record<string, string | undefined>) {
  vi.resetModules();
  for (const [key, value] of Object.entries(overrides)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  return import("@/lib/notify");
}

/** notify() is fire-and-forget, so the assertion has to let its tasks drain. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 20));

const original = { ...process.env };

beforeEach(() => {
  process.env.SLACK_BOT_TOKEN = "xoxb-test";
  process.env.SLACK_CHANNEL_ID = SIGNUPS;
  process.env.SLACK_USER_LOG_CHANNEL_ID = USER_LOG;
  delete process.env.SLACK_WEBHOOK_URL;
  delete process.env.NOTIFY_EMAIL;
});

afterEach(() => {
  vi.unstubAllGlobals();
  process.env = { ...original };
  vi.resetModules();
});

describe("notification routing", () => {
  it("sends a sign-in to the log channel, not the signups channel", async () => {
    const posts = captureSlack();
    const { notify } = await loadNotify({});

    notify({
      kind: "signin",
      email: "rep@northstar.io",
      name: "Dana",
      domain: "northstar.io",
      at: new Date("2026-08-30T09:15:00Z"),
      isNewUser: false,
    });
    await settle();

    expect(posts).toHaveLength(1);
    expect(posts[0].channel).toBe(USER_LOG);
  });

  it("sends a sign-up to the signups channel", async () => {
    const posts = captureSlack();
    const { notify } = await loadNotify({});

    notify({ kind: "signup", email: "rep@northstar.io", name: "Dana", domain: "northstar.io" });
    await settle();

    expect(posts).toHaveLength(1);
    expect(posts[0].channel).toBe(SIGNUPS);
  });

  it("stamps the sign-in with a date Slack renders locally", async () => {
    const posts = captureSlack();
    const { notify } = await loadNotify({});

    const at = new Date("2026-08-30T09:15:00Z");
    notify({
      kind: "signin",
      email: "rep@northstar.io",
      domain: "northstar.io",
      at,
      isNewUser: true,
    });
    await settle();

    const text = JSON.stringify(posts[0].body);
    // The token renders in each reader's timezone; the fallback after the pipe
    // is what shows where it cannot be expanded, so both must be present.
    expect(text).toContain(`<!date^${Math.floor(at.getTime() / 1000)}^`);
    expect(text).toContain(at.toISOString());
    // A first sign-in is titled as such, and still only goes to the log — the
    // separate signup event is what reaches the room people watch.
    expect(text).toContain("First sign-in");
    expect(posts[0].channel).toBe(USER_LOG);
  });

  it("never mentions anyone in the log channel", async () => {
    const posts = captureSlack();
    const { notify } = await loadNotify({ SLACK_MENTION: "U012345" });

    notify({
      kind: "signin",
      email: "rep@northstar.io",
      domain: "northstar.io",
      at: new Date(),
      isNewUser: false,
    });
    notify({ kind: "signup", email: "rep@northstar.io", domain: "northstar.io" });
    await settle();

    const log = posts.find((p) => p.channel === USER_LOG)!;
    const signup = posts.find((p) => p.channel === SIGNUPS)!;
    expect(JSON.stringify(log.body)).not.toContain("U012345");
    // The arrival still pings, because that one is meant to interrupt someone.
    expect(JSON.stringify(signup.body)).toContain("<@U012345>");
  });

  it("falls back to the signups channel when no log channel is set", async () => {
    const posts = captureSlack();
    const { notify } = await loadNotify({ SLACK_USER_LOG_CHANNEL_ID: undefined });

    notify({
      kind: "signin",
      email: "rep@northstar.io",
      domain: "northstar.io",
      at: new Date(),
      isNewUser: false,
    });
    await settle();

    // A noisy single channel beats a silent audit trail.
    expect(posts[0].channel).toBe(SIGNUPS);
  });
});
