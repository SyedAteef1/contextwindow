/** Pure logic: no database, no network. */
import { afterEach, describe, expect, it, vi } from "vitest";

import { chunkText, chunkTranscript } from "@/lib/embeddings";
import {
  classifyExternalMeeting,
  companyNameFromDomain,
  extractMeetingUrl,
  isConsumerDomain,
  type CalendarEvent,
} from "@/lib/google/calendar";
import { resolveDeliverableType, renderTranscript } from "@/agents/wrapup";
import { currentPeriodStart } from "@/lib/usage";
import { mapAttendeeState } from "@/lib/bots/attendee";
import { decrypt, encrypt, timingSafeEqualString } from "@/lib/crypto";
import { ConfigurationError, requireEnv, resetEnvCache } from "@/lib/env";
import { signalStrength, nodeState, relativeDay, trimCompanyPrefix } from "@/lib/format";

describe("chunkText", () => {
  it("returns a single chunk for short text", () => {
    expect(chunkText("Short transcript.")).toEqual([{ index: 0, content: "Short transcript." }]);
  });

  it("returns nothing for empty input", () => {
    expect(chunkText("   \n  ")).toEqual([]);
  });

  it("splits long text into overlapping chunks that cover the whole input", () => {
    const paragraph = "The buyer raised a migration concern. ".repeat(200);
    const chunks = chunkText(paragraph, { size: 500, overlap: 50 });

    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.map((c) => c.index)).toEqual(chunks.map((_, i) => i));
    // Overlap means the joined chunks are longer than the source, never shorter.
    const joined = chunks.map((c) => c.content).join("");
    expect(joined.length).toBeGreaterThanOrEqual(paragraph.trim().length * 0.95);
  });

  it("prefers a sentence boundary over a hard cut", () => {
    const text = `${"a".repeat(180)}. ${"b".repeat(180)}. ${"c".repeat(180)}.`;
    const chunks = chunkText(text, { size: 200, overlap: 0 });
    expect(chunks[0].content.endsWith(".")).toBe(true);
  });
});

describe("chunkTranscript", () => {
  const call = [
    "Priya Raman: We can't sign anything without a current SOC 2 Type II report.",
    "Sam Okonkwo: We have Type II, renewed in March. I can share it under NDA today.",
    "Priya Raman: Today would be good. That's the gate for me.",
    "Sam Okonkwo: Understood. What does the rest of your process look like?",
    "Marcus Webb: Security review takes about two weeks, then it goes to the board.",
  ].join("\n");

  it("never splits a speaker turn across chunks", () => {
    const chunks = chunkTranscript(call, { size: 120 });
    for (const chunk of chunks) {
      for (const line of chunk.content.split("\n")) {
        // Every line must still begin with a speaker, i.e. no severed turn.
        expect(line).toMatch(/^[A-Z][^:]*: /);
      }
    }
  });

  it("keeps every turn, and repeats one across the boundary for context", () => {
    const chunks = chunkTranscript(call, { size: 120 });
    expect(chunks.length).toBeGreaterThan(1);

    const seen = chunks.flatMap((c) => c.content.split("\n"));
    for (const turn of call.split("\n")) expect(seen).toContain(turn);

    // A question and its answer must not be separated with nothing in common.
    for (let i = 1; i < chunks.length; i++) {
      const previous = chunks[i - 1].content.split("\n");
      const current = chunks[i].content.split("\n");
      expect(current[0]).toBe(previous[previous.length - 1]);
    }
  });

  it("falls back to prose chunking when there are no speaker labels", () => {
    const prose = "There are no speakers here, just a wall of text about pricing.";
    expect(chunkTranscript(prose)).toEqual([{ index: 0, content: prose }]);
  });

  it("keeps a single over-long turn rather than dropping it", () => {
    const long = "Dana Whitfield: " + "the migration took nine months ".repeat(20);
    const chunks = chunkTranscript(long, { size: 100 });
    expect(chunks.map((c) => c.content).join("")).toContain("nine months");
  });
});

describe("classifyExternalMeeting", () => {
  const base: CalendarEvent = {
    id: "evt",
    start: { dateTime: "2026-03-01T10:00:00Z" },
    end: { dateTime: "2026-03-01T10:30:00Z" },
  };

  it("treats a same-domain meeting as internal", () => {
    const result = classifyExternalMeeting(
      { ...base, attendees: [{ email: "a@acme.com" }, { email: "b@acme.com" }] },
      "acme.com",
      "a@acme.com",
    );
    expect(result).toBeNull();
  });

  it("detects an external attendee and picks their domain as the account", () => {
    const result = classifyExternalMeeting(
      {
        ...base,
        attendees: [
          { email: "rep@acme.com", self: true },
          { email: "priya@cobalt.io" },
          { email: "marcus@cobalt.io" },
        ],
      },
      "acme.com",
      "rep@acme.com",
    );
    expect(result?.accountDomain).toBe("cobalt.io");
    expect(result?.attendees.filter((a) => a.external)).toHaveLength(2);
  });

  it("ignores rooms and resources", () => {
    const result = classifyExternalMeeting(
      {
        ...base,
        attendees: [
          { email: "rep@acme.com", self: true },
          { email: "room-4@acme.com", resource: true },
        ],
      },
      "acme.com",
      "rep@acme.com",
    );
    expect(result).toBeNull();
  });

  it("treats another free-mail attendee as external when the rep is on free mail too", () => {
    // Two gmail.com addresses are not colleagues. Classifying by domain would
    // call this internal and silently drop every meeting a solo seller books.
    const result = classifyExternalMeeting(
      {
        ...base,
        attendees: [{ email: "rep@gmail.com", self: true }, { email: "buyer@gmail.com" }],
      },
      "gmail.com",
      "rep@gmail.com",
    );
    expect(result).not.toBeNull();
    expect(result?.attendees.filter((a) => a.external)).toHaveLength(1);
  });

  it("still ignores a free-mail rep's own solo hold", () => {
    const result = classifyExternalMeeting(
      { ...base, attendees: [{ email: "rep@gmail.com", self: true }] },
      "gmail.com",
      "rep@gmail.com",
    );
    expect(result).toBeNull();
  });

  it("does not treat a solo hold as a sales call", () => {
    const result = classifyExternalMeeting(
      { ...base, attendees: [{ email: "rep@acme.com", self: true }] },
      "acme.com",
      "rep@acme.com",
    );
    expect(result).toBeNull();
  });

  it("prefers a corporate domain over a free mail one", () => {
    const result = classifyExternalMeeting(
      {
        ...base,
        attendees: [
          { email: "rep@acme.com", self: true },
          { email: "someone@gmail.com" },
          { email: "buyer@cobalt.io" },
        ],
      },
      "acme.com",
      "rep@acme.com",
    );
    expect(result?.accountDomain).toBe("cobalt.io");
  });

  it("knows the common consumer domains", () => {
    expect(isConsumerDomain("gmail.com")).toBe(true);
    expect(isConsumerDomain("cobalt.io")).toBe(false);
  });
});

describe("extractMeetingUrl", () => {
  it("prefers hangoutLink", () => {
    expect(
      extractMeetingUrl({ id: "e", hangoutLink: "https://meet.google.com/abc-defg-hij" }),
    ).toBe("https://meet.google.com/abc-defg-hij");
  });

  it("reads conferenceData video entry points", () => {
    expect(
      extractMeetingUrl({
        id: "e",
        conferenceData: {
          entryPoints: [
            { entryPointType: "phone", uri: "tel:+441234" },
            { entryPointType: "video", uri: "https://zoom.us/j/999" },
          ],
        },
      }),
    ).toBe("https://zoom.us/j/999");
  });

  it("falls back to scanning the description", () => {
    expect(
      extractMeetingUrl({
        id: "e",
        description: "Join here: https://acme.zoom.us/j/123456789?pwd=xyz see you then",
      }),
    ).toContain("zoom.us/j/123456789");
  });

  it("returns null when there is no joinable link", () => {
    expect(extractMeetingUrl({ id: "e", description: "Meeting room 4" })).toBeNull();
  });
});

describe("companyNameFromDomain", () => {
  it("title-cases and splits on separators", () => {
    expect(companyNameFromDomain("cobalt-systems.io")).toBe("Cobalt Systems");
    expect(companyNameFromDomain("meridianhealth.org")).toBe("Meridianhealth");
  });
});

describe("resolveDeliverableType", () => {
  it("honours an explicit account preference above everything", () => {
    expect(
      resolveDeliverableType({
        accountPreference: "timeline",
        industry: "Banking",
        userDefault: "plain_summary",
      }),
    ).toBe("timeline");
  });

  it("uses formal minutes for regulated industries", () => {
    expect(
      resolveDeliverableType({
        accountPreference: null,
        industry: "Financial Services",
        userDefault: "plain_summary",
      }),
    ).toBe("meeting_minutes");
    expect(
      resolveDeliverableType({
        accountPreference: null,
        industry: "Healthcare",
        userDefault: "plain_summary",
      }),
    ).toBe("meeting_minutes");
  });

  it("uses a timeline for staged-evaluation industries", () => {
    expect(
      resolveDeliverableType({
        accountPreference: null,
        industry: "Manufacturing software",
        userDefault: "plain_summary",
      }),
    ).toBe("timeline");
  });

  it("falls back to the rep's default when the industry says nothing", () => {
    expect(
      resolveDeliverableType({
        accountPreference: null,
        industry: "Pet grooming",
        userDefault: "plain_summary",
      }),
    ).toBe("plain_summary");
  });
});

describe("renderTranscript", () => {
  it("renders diarised segments with timestamps", () => {
    const rendered = renderTranscript({
      rawText: "ignored",
      speakerSegments: [
        { speakerName: "Priya", timestampMs: 0, text: "Hello" },
        { speakerName: "Alex", timestampMs: 65_000, text: "Hi there" },
      ],
    });
    expect(rendered).toBe("[00:00] Priya: Hello\n[01:05] Alex: Hi there");
  });

  it("falls back to raw text when there is no diarisation", () => {
    expect(renderTranscript({ rawText: "just words", speakerSegments: null })).toBe("just words");
  });
});

describe("currentPeriodStart", () => {
  it("is midnight UTC on the first of the month", () => {
    const period = currentPeriodStart(new Date("2026-03-17T13:45:00Z"));
    expect(period.toISOString()).toBe("2026-03-01T00:00:00.000Z");
  });
});

describe("mapAttendeeState", () => {
  it("maps every recording variant onto `recording`", () => {
    expect(mapAttendeeState("joined_recording")).toBe("recording");
    expect(mapAttendeeState("joined_recording_paused")).toBe("recording");
    expect(mapAttendeeState("joined_not_recording")).toBe("recording");
  });

  it("maps terminal states", () => {
    expect(mapAttendeeState("ended")).toBe("ended");
    expect(mapAttendeeState("fatal_error")).toBe("failed");
  });

  it("does not guess at unknown states", () => {
    expect(mapAttendeeState("something_new")).toBe("unknown");
    expect(mapAttendeeState(null)).toBe("unknown");
  });
});

describe("token encryption", () => {
  it("round-trips a refresh token", () => {
    const token = "1//0gRefreshTokenValue-with_symbols.123";
    expect(decrypt(encrypt(token))).toBe(token);
  });

  it("produces a different ciphertext each time", () => {
    expect(encrypt("same")).not.toBe(encrypt("same"));
  });

  it("rejects tampered ciphertext rather than returning garbage", () => {
    const encrypted = encrypt("secret");
    const bytes = Buffer.from(encrypted, "base64");
    bytes[bytes.length - 1] ^= 0xff; // break the auth tag
    expect(() => decrypt(bytes.toString("base64"))).toThrow();
  });

  it("compares shared secrets without leaking length via early exit", () => {
    expect(timingSafeEqualString("abc", "abc")).toBe(true);
    expect(timingSafeEqualString("abc", "abd")).toBe(false);
    expect(timingSafeEqualString("abc", "abcd")).toBe(false);
  });
});

describe("display helpers", () => {
  it("maps buying interest onto meter segments", () => {
    expect(signalStrength("high")).toBe(4);
    expect(signalStrength("none")).toBe(0);
    expect(signalStrength(null)).toBe(0);
  });

  it("derives rail node state from meeting status", () => {
    expect(nodeState("recording")).toBe("live");
    expect(nodeState("processed")).toBe("done");
    expect(nodeState("skipped_quota")).toBe("blocked");
    expect(nodeState("detected")).toBe("pending");
  });
});

describe("relativeDay", () => {
  const now = new Date("2026-08-21T01:53:00");

  it("counts calendar days, not elapsed hours", () => {
    // 1.5 elapsed days, but two calendar days back — the bug this replaced
    // rounded this to "yesterday".
    expect(relativeDay(new Date("2026-08-19T14:00:00"), now)).toBe("2 days ago");
  });

  it("names the immediate neighbours", () => {
    expect(relativeDay(new Date("2026-08-21T23:00:00"), now)).toBe("today");
    expect(relativeDay(new Date("2026-08-22T09:00:00"), now)).toBe("tomorrow");
    expect(relativeDay(new Date("2026-08-20T09:00:00"), now)).toBe("yesterday");
  });

  it("counts further out in both directions", () => {
    expect(relativeDay(new Date("2026-08-28T09:00:00"), now)).toBe("in 7 days");
    expect(relativeDay(new Date("2026-08-14T09:00:00"), now)).toBe("7 days ago");
  });
});

describe("trimCompanyPrefix", () => {
  it("drops a leading company name and its separator", () => {
    expect(trimCompanyPrefix("Cobalt Systems — platform evaluation", "Cobalt Systems")).toBe(
      "platform evaluation",
    );
    expect(trimCompanyPrefix("Cobalt Systems: kickoff", "Cobalt Systems")).toBe("kickoff");
    expect(trimCompanyPrefix("Cobalt Systems - QBR", "Cobalt Systems")).toBe("QBR");
  });

  it("is case-insensitive about the prefix", () => {
    expect(trimCompanyPrefix("COBALT SYSTEMS — sync", "Cobalt Systems")).toBe("sync");
  });

  it("leaves unrelated titles alone", () => {
    expect(trimCompanyPrefix("Quarterly review", "Cobalt Systems")).toBe("Quarterly review");
  });

  it("strips an abbreviated company name when a separator follows", () => {
    expect(
      trimCompanyPrefix("Cobalt — security review checkpoint", "Cobalt Systems"),
    ).toBe("security review checkpoint");
  });

  it("does not strip a leading word that is part of the sentence", () => {
    expect(trimCompanyPrefix("Cobalt migration plan review", "Cobalt Systems")).toBe(
      "Cobalt migration plan review",
    );
  });

  it("keeps the title when it is only the company name", () => {
    expect(trimCompanyPrefix("Cobalt Systems", "Cobalt Systems")).toBe("Cobalt Systems");
  });

  it("handles a missing title", () => {
    expect(trimCompanyPrefix(null, "Cobalt Systems")).toBe("Untitled meeting");
  });

  it("strips the company from trailing brackets", () => {
    expect(trimCompanyPrefix("Daily stand up [syncrocore]", "Syncrocore")).toBe("Daily stand up");
    expect(trimCompanyPrefix("Kickoff (Cobalt Systems)", "Cobalt Systems")).toBe("Kickoff");
    expect(trimCompanyPrefix("<Cobalt>partnership", "Cobalt Systems")).toBe("partnership");
  });

  it("strips the company from the end behind a separator", () => {
    expect(trimCompanyPrefix("Quarterly review — Cobalt Systems", "Cobalt Systems")).toBe(
      "Quarterly review",
    );
    expect(trimCompanyPrefix("Kickoff | Cobalt", "Cobalt Systems")).toBe("Kickoff");
  });

  it("matches the domain label when the calendar uses the handle", () => {
    expect(
      trimCompanyPrefix("Daily stand up [syncrocore]", "Syncro Core", "syncrocore.com"),
    ).toBe("Daily stand up");
  });

  it("ignores a legal suffix the organiser left off", () => {
    expect(trimCompanyPrefix("Cobalt Systems — QBR", "Cobalt Systems Ltd")).toBe("QBR");
  });

  it("keeps a trailing word that is not behind a separator", () => {
    expect(trimCompanyPrefix("Renewal Cobalt", "Cobalt Systems")).toBe("Renewal Cobalt");
  });

  it("never returns an empty title", () => {
    expect(trimCompanyPrefix("[Cobalt Systems]", "Cobalt Systems")).toBe("[Cobalt Systems]");
    expect(trimCompanyPrefix("Cobalt Systems —", "Cobalt Systems")).toBe("Cobalt Systems —");
  });
});

describe("requireEnv", () => {
  const previous = process.env.VOYAGE_API_KEY;

  afterEach(() => {
    if (previous === undefined) delete process.env.VOYAGE_API_KEY;
    else process.env.VOYAGE_API_KEY = previous;
    resetEnvCache();
  });

  it("raises a ConfigurationError naming the missing variable", () => {
    delete process.env.VOYAGE_API_KEY;
    resetEnvCache();

    expect(() => requireEnv("VOYAGE_API_KEY")).toThrow(ConfigurationError);
    // The message has to name the variable — the person reading it is the one
    // who can set it.
    expect(() => requireEnv("VOYAGE_API_KEY")).toThrow(/VOYAGE_API_KEY/);
  });

  it("returns the value when it is set", () => {
    process.env.VOYAGE_API_KEY = "pa-test";
    resetEnvCache();

    expect(requireEnv("VOYAGE_API_KEY")).toBe("pa-test");
  });
});

describe("mock bot provider", () => {
  it("returns a diarised transcript the wrap-up can actually use", async () => {
    const { MockBotProvider } = await import("@/lib/bots/mock");
    const provider = new MockBotProvider();

    const transcript = await provider.fetchTranscript();

    expect(transcript.segments.length).toBeGreaterThan(5);
    expect(transcript.rawText).toContain(":");
    expect(transcript.source).toBe("mock");

    // Timestamps must increase, or the wrap-up's ordering is meaningless.
    const timestamps = transcript.segments.map((segment) => segment.timestampMs);
    expect([...timestamps].sort((a, b) => a - b)).toEqual(timestamps);

    // More than one speaker, otherwise there is nothing to attribute.
    expect(new Set(transcript.segments.map((s) => s.speakerName)).size).toBeGreaterThan(1);
    expect(transcript.segments.every((segment) => segment.text.trim().length > 0)).toBe(true);
  });

  it("reports itself finished so the pipeline can run immediately", async () => {
    const { MockBotProvider } = await import("@/lib/bots/mock");
    const provider = new MockBotProvider();

    const scheduled = await provider.scheduleBot({
      meetingUrl: "https://meet.google.com/abc-defg-hij",
      joinAt: new Date("2026-09-01T10:00:00Z"),
      botName: "Notetaker",
      metadata: {},
      deduplicationKey: "meeting:abc",
    });
    expect(scheduled.botId).toMatch(/^mock_/);

    const status = await provider.getStatus(scheduled.botId);
    expect(status.state).toBe("ended");
    expect(status.transcriptReady).toBe(true);
  });

  it("derives a stable bot id from the deduplication key", async () => {
    const { MockBotProvider } = await import("@/lib/bots/mock");
    const provider = new MockBotProvider();
    const input = {
      meetingUrl: "https://meet.google.com/x",
      joinAt: new Date(),
      botName: "N",
      metadata: {},
      deduplicationKey: "meeting:stable",
    };
    // A retried schedule must address the same bot, not create a second one.
    const first = await provider.scheduleBot(input);
    const second = await provider.scheduleBot(input);
    expect(first.botId).toBe(second.botId);
  });
});

describe("bot webhook URL", () => {
  const original = { ...process.env };

  afterEach(() => {
    process.env = { ...original };
    resetEnvCache();
  });

  async function url() {
    const { botWebhookUrl } = await import("@/lib/bots/webhook-url");
    return botWebhookUrl();
  }

  it("registers no webhook for a plain localhost dev server", async () => {
    process.env.APP_URL = "http://localhost:3000";
    delete process.env.WEBHOOK_BASE_URL;
    resetEnvCache();
    // Hosted providers reject non-HTTPS, so registering one would just fail.
    expect(await url()).toBeUndefined();
  });

  it("registers one for an HTTPS app URL, carrying the secret", async () => {
    process.env.APP_URL = "https://app.example.com";
    process.env.WEBHOOK_SECRET = "s3cret";
    delete process.env.WEBHOOK_BASE_URL;
    resetEnvCache();

    expect(await url()).toBe("https://app.example.com/api/webhooks/bot?secret=s3cret");
  });

  it("honours an explicit override even over http, for self-hosted Attendee", async () => {
    // A container cannot resolve `localhost` to the host, and a self-hosted
    // Attendee can have REQUIRE_HTTPS_WEBHOOKS turned off.
    process.env.APP_URL = "http://localhost:3001";
    process.env.WEBHOOK_BASE_URL = "http://host.docker.internal:3001";
    process.env.WEBHOOK_SECRET = "s3cret";
    resetEnvCache();

    expect(await url()).toBe(
      "http://host.docker.internal:3001/api/webhooks/bot?secret=s3cret",
    );
  });

  it("escapes a secret containing URL-significant characters", async () => {
    process.env.APP_URL = "https://app.example.com";
    process.env.WEBHOOK_SECRET = "a&b=c d";
    delete process.env.WEBHOOK_BASE_URL;
    resetEnvCache();

    const value = await url();
    expect(value).toContain("secret=a%26b%3Dc%20d");
    // The separator must survive, or the query string is unparseable.
    expect(value?.split("?")[1]?.startsWith("secret=")).toBe(true);
  });

  it("does not double up slashes when the origin has a trailing one", async () => {
    process.env.WEBHOOK_BASE_URL = "http://host.docker.internal:3001/";
    resetEnvCache();
    expect(await url()).toContain("internal:3001/api/webhooks/bot");
  });
});

describe("intent schema resilience", () => {
  /**
   * GLM's forced-tool-call path omits fields it considers inapplicable, where
   * Anthropic's server-side enforcement always returns them. A whole summary
   * must not be discarded over a missing optional field — this is the exact
   * payload that failed against a one-line real transcript.
   */
  it("accepts a payload with every optional field omitted", async () => {
    const { intentSchema } = await import("@/agents/wrapup");

    const parsed = intentSchema.parse({
      buyingInterest: "none",
      interestRationale: "Too short to judge.",
      followupRecommended: false,
      followupRationale: "Nothing to follow up on.",
    });

    expect(parsed.suggestedFollowupDays).toBeNull();
    expect(parsed.objections).toEqual([]);
    expect(parsed.nextSteps).toEqual([]);
    expect(parsed.competitorsMentioned).toEqual([]);
    expect(parsed.budgetSignals).toEqual([]);
    expect(parsed.timelineSignals).toEqual([]);
  });

  it("normalises absent nested fields to null", async () => {
    const { intentSchema } = await import("@/agents/wrapup");

    const parsed = intentSchema.parse({
      buyingInterest: "low",
      interestRationale: "Some engagement.",
      objections: [{ objection: "Too expensive", severity: "high" }],
      nextSteps: [{ step: "Send pricing", owner: "us" }],
      followupRecommended: false,
      followupRationale: "None needed.",
    });

    expect(parsed.objections[0].quote).toBeNull();
    expect(parsed.nextSteps[0].dueDate).toBeNull();
  });

  it("still rejects a genuinely wrong value", async () => {
    const { intentSchema } = await import("@/agents/wrapup");

    // Leniency is for *absent* optional fields, not for bad data.
    expect(() =>
      intentSchema.parse({
        buyingInterest: "enthusiastic",
        interestRationale: "x",
        followupRecommended: false,
        followupRationale: "y",
      }),
    ).toThrow();

    expect(() =>
      intentSchema.parse({
        buyingInterest: "high",
        followupRecommended: false,
        followupRationale: "y",
      }),
    ).toThrow();
  });

  it("defaults an omitted attendee list on the follow-up draft", async () => {
    const { followupSchema } = await import("@/agents/wrapup");

    const parsed = followupSchema.parse({
      title: "Follow-up",
      agenda: "- Review",
      rationale: "Because.",
      startIso: "2026-09-01T10:00:00Z",
      durationMinutes: 30,
    });
    expect(parsed.attendeeEmails).toEqual([]);
  });
});

describe("immediate vs scheduled joins", () => {
  /**
   * These are different modes at the provider, not the same call with a nearer
   * time. Sending `join_at` always costs the lead time, because a scheduled bot
   * waits for its appointed second; omitting it starts allocation immediately.
   */
  it("omits join_at entirely when joining now", async () => {
    const calls: { url: string; body: Record<string, unknown> }[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init: RequestInit) => {
        calls.push({ url, body: JSON.parse(String(init.body)) });
        return {
          ok: true,
          status: 201,
          text: async () => JSON.stringify({ id: "bot_x", state: "joining" }),
        };
      }),
    );
    process.env.ATTENDEE_API_KEY = "k";
    resetEnvCache();

    const { AttendeeProvider } = await import("@/lib/bots/attendee");
    await new AttendeeProvider().scheduleBot({
      meetingUrl: "https://meet.google.com/a",
      joinAt: null,
      botName: "N",
      metadata: {},
    });

    expect(calls[0].body).not.toHaveProperty("join_at");
    vi.unstubAllGlobals();
  });

  it("sends join_at, floored to the provider's minimum lead, when scheduling", async () => {
    const calls: Record<string, unknown>[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init: RequestInit) => {
        calls.push(JSON.parse(String(init.body)));
        return {
          ok: true,
          status: 201,
          text: async () => JSON.stringify({ id: "bot_x", state: "scheduled" }),
        };
      }),
    );
    process.env.ATTENDEE_API_KEY = "k";
    resetEnvCache();

    const { AttendeeProvider } = await import("@/lib/bots/attendee");
    // A time in the past must be pushed forward, not rejected by the provider.
    await new AttendeeProvider().scheduleBot({
      meetingUrl: "https://meet.google.com/a",
      joinAt: new Date(Date.now() - 60_000),
      botName: "N",
      metadata: {},
    });

    const sent = new Date(String(calls[0].join_at)).getTime();
    expect(sent).toBeGreaterThan(Date.now() + 60_000);
    vi.unstubAllGlobals();
  });
});

describe("live question detection", () => {
  /**
   * The heuristic runs before any model call, so it decides what is worth
   * spending the latency budget on. Deliberately generous: a false positive
   * costs one fast call, a false negative means the rep gets nothing.
   */
  it("catches questions that carry no question mark", async () => {
    const { isLikelyQuestion } = await import("@/agents/live");
    // Captions frequently omit punctuation entirely.
    expect(isLikelyQuestion("what does implementation look like")).toBe(true);
    expect(isLikelyQuestion("can you support SSO")).toBe(true);
    expect(isLikelyQuestion("do you have a SOC 2 report")).toBe(true);
    expect(isLikelyQuestion("tell me about your pricing")).toBe(true);
    expect(isLikelyQuestion("so what about data residency")).toBe(true);
  });

  it("catches explicit questions", async () => {
    const { isLikelyQuestion } = await import("@/agents/live");
    expect(isLikelyQuestion("And the timeline on that?")).toBe(true);
  });

  it("ignores statements and filler", async () => {
    const { isLikelyQuestion } = await import("@/agents/live");
    expect(isLikelyQuestion("We use Salesforce internally.")).toBe(false);
    expect(isLikelyQuestion("Yeah, exactly.")).toBe(false);
    expect(isLikelyQuestion("ok")).toBe(false);
    expect(isLikelyQuestion("")).toBe(false);
    // Too short to be worth a round trip even though it ends in a mark.
    expect(isLikelyQuestion("right?")).toBe(false);
  });
});

describe("fast lane configuration", () => {
  const original = { ...process.env };
  afterEach(() => {
    process.env = { ...original };
    resetEnvCache();
  });

  it("is off by default, and says so", async () => {
    delete process.env.FAST_LLM_PROVIDER;
    resetEnvCache();
    const { fastLaneEnabled, fastLaneUnavailableReason } = await import("@/lib/llm/fast");
    expect(fastLaneEnabled()).toBe(false);
    expect(fastLaneUnavailableReason()).toMatch(/FAST_LLM_PROVIDER/);
  });

  it("names the missing key when a provider is chosen without one", async () => {
    process.env.FAST_LLM_PROVIDER = "cerebras";
    delete process.env.CEREBRAS_API_KEY;
    resetEnvCache();
    const { fastLaneEnabled, fastLaneUnavailableReason } = await import("@/lib/llm/fast");
    expect(fastLaneEnabled()).toBe(true);
    expect(fastLaneUnavailableReason()).toMatch(/CEREBRAS_API_KEY/);
  });

  it("parses a streamed OpenAI-shaped response and times the first token", async () => {
    process.env.FAST_LLM_PROVIDER = "cerebras";
    process.env.CEREBRAS_API_KEY = "csk-test";
    resetEnvCache();

    const frames = [
      'data: {"choices":[{"delta":{"content":"Our SLA "}}]}\n\n',
      'data: {"choices":[{"delta":{"content":"is 99.9%."}}]}\n\n',
      "data: [DONE]\n\n",
    ];
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        status: 200,
        body: new ReadableStream({
          start(controller) {
            const encoder = new TextEncoder();
            for (const frame of frames) controller.enqueue(encoder.encode(frame));
            controller.close();
          },
        }),
      })),
    );

    const { runFast } = await import("@/lib/llm/fast");
    const tokens: string[] = [];
    const result = await runFast({
      system: "s",
      prompt: "p",
      onToken: (t) => tokens.push(t),
    });

    expect(result.text).toBe("Our SLA is 99.9%.");
    expect(tokens).toEqual(["Our SLA ", "is 99.9%."]);
    expect(result.firstTokenMs).not.toBeNull();
    expect(result.ok).toBe(true);
    vi.unstubAllGlobals();
  });

  it("survives keep-alive frames and split JSON without dropping tokens", async () => {
    process.env.FAST_LLM_PROVIDER = "cerebras";
    process.env.CEREBRAS_API_KEY = "csk-test";
    resetEnvCache();

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        status: 200,
        body: new ReadableStream({
          start(controller) {
            const encoder = new TextEncoder();
            controller.enqueue(encoder.encode(": keep-alive\n\n"));
            // A frame split across two reads must not be lost.
            controller.enqueue(encoder.encode('data: {"choices":[{"delta":{"con'));
            controller.enqueue(encoder.encode('tent":"hello"}}]}\n\n'));
            controller.close();
          },
        }),
      })),
    );

    const { runFast } = await import("@/lib/llm/fast");
    expect((await runFast({ system: "s", prompt: "p" })).text).toBe("hello");
    vi.unstubAllGlobals();
  });
});

describe("live answer timestamps", () => {
  /**
   * Attendee sends `timestamp_ms` as epoch milliseconds, not an offset into
   * the call. That overflows a 32-bit integer, and it only showed up against a
   * real meeting because the fixtures used small offsets.
   */
  it("keeps epoch-millisecond precision, well past int32", () => {
    const realTimestamp = 1787342309441; // taken from an actual utterance
    expect(realTimestamp).toBeGreaterThan(2_147_483_647);
    // Still exact as a JS number, which is what the bigint column stores.
    expect(Number.isSafeInteger(realTimestamp)).toBe(true);
    expect(Number(String(realTimestamp))).toBe(realTimestamp);
  });
});

describe("fast lane provider targeting", () => {
  const original = { ...process.env };
  afterEach(() => {
    process.env = { ...original };
    resetEnvCache();
  });

  it("resolves the preset base URL and key per provider", async () => {
    process.env.FAST_LLM_PROVIDER = "openrouter";
    process.env.OPENROUTER_API_KEY = "sk-or-test";
    resetEnvCache();

    const { fastLaneTarget } = await import("@/lib/llm/fast");
    expect(fastLaneTarget()).toEqual({
      baseUrl: "https://openrouter.ai/api/v1",
      apiKey: "sk-or-test",
    });
  });

  it("lets an explicit override win over the preset", async () => {
    process.env.FAST_LLM_PROVIDER = "cerebras";
    process.env.CEREBRAS_API_KEY = "csk-preset";
    process.env.FAST_LLM_BASE_URL = "http://localhost:8080/v1";
    process.env.FAST_LLM_API_KEY = "local-key";
    resetEnvCache();

    const { fastLaneTarget } = await import("@/lib/llm/fast");
    // Any OpenAI-compatible server — vLLM, Ollama, LM Studio — works this way.
    expect(fastLaneTarget()).toEqual({
      baseUrl: "http://localhost:8080/v1",
      apiKey: "local-key",
    });
  });

  it("names the provider-specific key that is missing", async () => {
    process.env.FAST_LLM_PROVIDER = "openrouter";
    delete process.env.OPENROUTER_API_KEY;
    delete process.env.FAST_LLM_API_KEY;
    resetEnvCache();

    const { fastLaneUnavailableReason } = await import("@/lib/llm/fast");
    expect(fastLaneUnavailableReason()).toMatch(/OPENROUTER_API_KEY/);
  });

  it("pins the upstream provider on OpenRouter when asked", async () => {
    process.env.FAST_LLM_PROVIDER = "openrouter";
    process.env.OPENROUTER_API_KEY = "sk-or-test";
    process.env.FAST_LLM_MODEL = "z-ai/glm-4.7";
    process.env.OPENROUTER_PROVIDER_ORDER = "Cerebras, Together";
    resetEnvCache();

    let sent: Record<string, unknown> = {};
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init: RequestInit) => {
        sent = JSON.parse(String(init.body));
        return {
          ok: true,
          status: 200,
          body: new ReadableStream({
            start(c) {
              c.enqueue(new TextEncoder().encode('data: {"choices":[{"delta":{"content":"hi"}}]}\n\n'));
              c.close();
            },
          }),
        };
      }),
    );

    const { runFast } = await import("@/lib/llm/fast");
    await runFast({ system: "s", prompt: "p" });

    // Pinning is what puts the model on the hardware you chose. Fallbacks are
    // off deliberately: silently landing on a slow provider would defeat the
    // entire point of a latency-optimised lane.
    expect(sent.provider).toEqual({ order: ["Cerebras", "Together"], allow_fallbacks: false });
    expect(sent.model).toBe("z-ai/glm-4.7");
    vi.unstubAllGlobals();
  });

  it("omits provider routing for non-OpenRouter providers", async () => {
    process.env.FAST_LLM_PROVIDER = "cerebras";
    process.env.CEREBRAS_API_KEY = "csk-test";
    process.env.OPENROUTER_PROVIDER_ORDER = "Cerebras";
    resetEnvCache();

    let sent: Record<string, unknown> = {};
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init: RequestInit) => {
        sent = JSON.parse(String(init.body));
        return {
          ok: true,
          status: 200,
          body: new ReadableStream({
            start(c) {
              c.enqueue(new TextEncoder().encode('data: {"choices":[{"delta":{"content":"hi"}}]}\n\n'));
              c.close();
            },
          }),
        };
      }),
    );

    const { runFast } = await import("@/lib/llm/fast");
    await runFast({ system: "s", prompt: "p" });
    expect(sent.provider).toBeUndefined();
    vi.unstubAllGlobals();
  });
});

describe("audio bridge wiring", () => {
  const original = { ...process.env };
  afterEach(() => {
    process.env = { ...original };
    resetEnvCache();
    vi.unstubAllGlobals();
  });

  async function createBot() {
    let sent: Record<string, unknown> = {};
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init: RequestInit) => {
        sent = JSON.parse(String(init.body));
        return {
          ok: true,
          status: 201,
          text: async () => JSON.stringify({ id: "bot_x", state: "joining" }),
        };
      }),
    );
    const { AttendeeProvider } = await import("@/lib/bots/attendee");
    await new AttendeeProvider().scheduleBot({
      meetingUrl: "https://meet.google.com/a",
      joinAt: null,
      botName: "N",
      metadata: {},
      audioWebsocketUrl: process.env.AUDIO_BRIDGE_URL,
      audioSampleRate: 16000,
    });
    return sent;
  }

  it("asks for raw audio when a bridge is configured", async () => {
    process.env.ATTENDEE_API_KEY = "k";
    process.env.AUDIO_BRIDGE_URL = "ws://host.docker.internal:3002";
    resetEnvCache();

    const sent = await createBot();
    expect(sent.websocket_settings).toEqual({
      audio: { url: "ws://host.docker.internal:3002", sample_rate: 16000 },
    });
  });

  it("leaves the platform's own captions in place when no bridge is set", async () => {
    process.env.ATTENDEE_API_KEY = "k";
    delete process.env.AUDIO_BRIDGE_URL;
    resetEnvCache();

    const sent = await createBot();
    // Without this key Attendee transcribes from closed captions, which is
    // free and needs no second service.
    expect(sent.websocket_settings).toBeUndefined();
  });
});
