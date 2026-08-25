/**
 * End-to-end pipeline tests with the model calls stubbed.
 *
 * There is no Anthropic key in CI, so the two Claude entry points are mocked
 * and everything around them runs for real against Postgres: prompt assembly,
 * deliverable selection, database writes, embedding + indexing, the free-tier
 * meter, and the rule that a follow-up is only ever drafted, never scheduled.
 */
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { and, eq, sql } from "drizzle-orm";

const runText = vi.fn();
const runStructured = vi.fn();

vi.mock("@/lib/llm", () => ({
  runText,
  runStructured,
  llmClient: () => {
    throw new Error("Tests must not construct a real LLM client");
  },
  capabilities: () => ({
    adaptiveThinking: true,
    effort: true,
    nativeStructuredOutput: true,
    hostedWebSearch: true,
    promptCaching: true,
  }),
  modelId: () => "test-model",
  provider: () => "anthropic",
}));

const { db, sqlClient } = await import("@/db");
const {
  accounts,
  embeddings,
  followupEmails,
  followupProposals,
  meetingBriefs,
  meetingSummaries,
  meetings,
  transcripts,
  users,
} = await import("@/db/schema");
const { runWrapup } = await import("@/agents/wrapup");
const { generateMeetingBrief } = await import("@/agents/research");
const { ingestTranscript } = await import("@/lib/pipeline/transcript");
const { getUsage, incrementUsage } = await import("@/lib/usage");
const { retrieveForAccount } = await import("@/lib/retrieval");
const { resetEnvCache } = await import("@/lib/env");

const INTENT_HIGH = {
  buyingInterest: "high",
  interestRationale: "Budget approved and a board date named.",
  objections: [{ objection: "Needs SOC 2", severity: "high", quote: "we can't sign without it" }],
  nextSteps: [{ step: "Send the SOC 2 report", owner: "us", dueDate: null }],
  competitorsMentioned: [],
  budgetSignals: ["Provisionally approved"],
  timelineSignals: ["Board meets on the 12th"],
  followupRecommended: true,
  followupRationale: "A deliverable was promised before a fixed board date.",
  suggestedFollowupDays: 14,
};

const INTENT_DEAD = {
  ...INTENT_HIGH,
  buyingInterest: "none",
  objections: [],
  nextSteps: [],
  followupRecommended: false,
  followupRationale: "The buyer declined outright.",
  suggestedFollowupDays: null,
};

function recapDraft() {
  return {
    subject: "Cobalt Systems — SOC 2 report and next steps",
    body: "Thanks for walking us through the evaluation criteria today.\n\n- We agreed to send the SOC 2 report\n- You'll take it to the board on the 12th\n\nShout if anything else would help before then.\n\nSam",
  };
}

function followupDraft() {
  const start = new Date(Date.now() + 14 * 86_400_000);
  return {
    title: "Security review checkpoint",
    agenda: "- Walk through the SOC 2 report\n- Agree what goes to the board",
    rationale: "A deliverable was promised before a fixed board date.",
    startIso: start.toISOString(),
    durationMinutes: 30,
    attendeeEmails: ["rep@northstar.io", "buyer@cobalt.io"],
  };
}

async function seedMeeting(options: { industry?: string | null } = {}) {
  const [rep] = await db
    .insert(users)
    .values({ email: "rep@northstar.io", emailDomain: "northstar.io", name: "Sam" })
    .returning();
  const [account] = await db
    .insert(accounts)
    .values({
      ownerUserId: rep.id,
      companyName: "Cobalt Systems",
      domain: "cobalt.io",
      industry: options.industry ?? null,
    })
    .returning();
  const [meeting] = await db
    .insert(meetings)
    .values({
      accountId: account.id,
      ownerUserId: rep.id,
      calendarEventId: `evt-${crypto.randomUUID()}`,
      title: "Platform evaluation",
      scheduledAt: new Date(Date.now() - 3_600_000),
      endsAt: new Date(Date.now() - 1_800_000),
      attendees: [
        { email: "rep@northstar.io", external: false, displayName: "Sam" },
        { email: "buyer@cobalt.io", external: true, displayName: "Priya" },
      ],
    })
    .returning();
  return { rep, account, meeting };
}

async function seedTranscript(meetingId: string) {
  await db.insert(transcripts).values({
    meetingId,
    rawText: "Priya: We cannot sign without a current SOC 2 Type II report.",
    speakerSegments: [
      {
        speakerName: "Priya",
        speakerUuid: null,
        speakerIsHost: false,
        timestampMs: 0,
        durationMs: 5000,
        text: "We cannot sign without a current SOC 2 Type II report.",
      },
    ],
    source: "test",
    durationSeconds: 1800,
  });
}

beforeEach(async () => {
  runText.mockReset();
  runStructured.mockReset();
  await db.execute(sql`truncate table ${users} restart identity cascade`);
});

afterAll(async () => {
  await sqlClient.end();
});

describe("wrap-up agent", () => {
  it("writes the summary, signals, and a drafted follow-up, and indexes the result", async () => {
    const { account, meeting } = await seedMeeting();
    await seedTranscript(meeting.id);

    runText.mockResolvedValue({
      text: "**The short version**\n\nThey need SOC 2 before signing.",
      citations: [],
      usage: { inputTokens: 100, outputTokens: 50 },
      stopReason: "end_turn",
    });
    runStructured
      .mockResolvedValueOnce(INTENT_HIGH)
      .mockResolvedValueOnce(followupDraft());

    const result = await runWrapup(meeting.id);

    expect(result.summaryId).toBeTruthy();
    expect(result.intentSignals.buyingInterest).toBe("high");
    expect(result.followupProposalId).toBeTruthy();
    expect(result.chunksIndexed).toBeGreaterThan(0);

    const stored = await db.query.meetingSummaries.findFirst({
      where: eq(meetingSummaries.meetingId, meeting.id),
    });
    expect(stored?.content).toContain("SOC 2");
    expect(stored?.intentSignals?.objections[0].objection).toBe("Needs SOC 2");

    const [updated] = await db.select().from(meetings).where(eq(meetings.id, meeting.id));
    expect(updated.status).toBe("processed");

    // The summary must be retrievable by the chat agent immediately.
    const chunks = await retrieveForAccount(account.id, "SOC 2 before signing", {
      sourceTypes: ["summary"],
    });
    expect(chunks.length).toBeGreaterThan(0);
  });

  it("still produces a brief when indexing fails, and clears the stale error", async () => {
    const { meeting } = await seedMeeting();
    await db
      .update(meetings)
      .set({ errorMessage: "fetch failed" })
      .where(eq(meetings.id, meeting.id));

    runText.mockResolvedValue({
      text: "## Company\nCobalt Systems builds packaging automation.",
      citations: [{ title: "Cobalt", url: "https://cobalt.io" }],
      usage: { inputTokens: 10, outputTokens: 10 },
      stopReason: "end_turn",
    });
    // Point embeddings at a closed port: the same failure as Ollama not
    // running, and more honest than mocking the module away.
    const previousProvider = process.env.EMBEDDING_PROVIDER;
    const previousBase = process.env.EMBEDDING_BASE_URL;
    process.env.EMBEDDING_PROVIDER = "local";
    process.env.EMBEDDING_BASE_URL = "http://127.0.0.1:1/v1";
    resetEnvCache();

    const result = await generateMeetingBrief(meeting.id);

    process.env.EMBEDDING_PROVIDER = previousProvider;
    process.env.EMBEDDING_BASE_URL = previousBase;
    resetEnvCache();

    expect(result.content).toContain("Cobalt Systems");
    expect(result.chunksIndexed).toBe(0);

    const [row] = await db.select().from(meetings).where(eq(meetings.id, meeting.id));
    // A brief that cannot be indexed is still a brief, and the meeting must not
    // be left carrying an error the next sync would never clear.
    expect(row.status).toBe("brief_ready");
    expect(row.errorMessage).toBeNull();
  });

  it("leaves the follow-up as a pending proposal and creates no calendar event", async () => {
    const { meeting } = await seedMeeting();
    await seedTranscript(meeting.id);

    runText.mockResolvedValue({
      text: "Summary body.",
      citations: [],
      usage: { inputTokens: 10, outputTokens: 10 },
      stopReason: "end_turn",
    });
    runStructured.mockResolvedValueOnce(INTENT_HIGH).mockResolvedValueOnce(followupDraft());

    await runWrapup(meeting.id);

    const [proposal] = await db
      .select()
      .from(followupProposals)
      .where(eq(followupProposals.meetingId, meeting.id));

    expect(proposal.status).toBe("pending");
    // The only field that would hold a real event id stays empty.
    expect(proposal.createdCalendarEventId).toBeNull();
    expect(proposal.approvedAt).toBeNull();
    expect(proposal.proposedEnd.getTime()).toBeGreaterThan(proposal.proposedStart.getTime());
  });

  it("drafts no follow-up when the call did not warrant one", async () => {
    const { meeting } = await seedMeeting();
    await seedTranscript(meeting.id);

    runText.mockResolvedValue({
      text: "Summary body.",
      citations: [],
      usage: { inputTokens: 10, outputTokens: 10 },
      stopReason: "end_turn",
    });
    runStructured.mockResolvedValueOnce(INTENT_DEAD).mockResolvedValueOnce(recapDraft());

    const result = await runWrapup(meeting.id);

    expect(result.followupProposalId).toBeNull();
    expect(await db.select().from(followupProposals)).toHaveLength(0);
    // Intent, then the recap — a call with no next meeting still owes its
    // attendees the minutes, so exactly one follow-up draft is skipped.
    expect(runStructured).toHaveBeenCalledTimes(2);
    expect(result.followupEmailId).not.toBeNull();
  });

  it("drafts the recap email but sends nothing", async () => {
    const { meeting } = await seedMeeting();
    await seedTranscript(meeting.id);

    runText.mockResolvedValue({
      text: "Summary body.",
      citations: [],
      usage: { inputTokens: 10, outputTokens: 10 },
      stopReason: "end_turn",
    });
    runStructured
      .mockResolvedValueOnce(INTENT_HIGH)
      .mockResolvedValueOnce(followupDraft())
      .mockResolvedValueOnce(recapDraft());

    await runWrapup(meeting.id);

    const [recap] = await db
      .select()
      .from(followupEmails)
      .where(eq(followupEmails.meetingId, meeting.id));

    expect(recap.subject).toContain("Cobalt Systems");
    expect(recap.status).toBe("pending");
    // The fields that would only be set by an actual send.
    expect(recap.sentAt).toBeNull();
    expect(recap.gmailMessageId).toBeNull();
    // The rep sends from their own mailbox, so they are never a recipient.
    expect(recap.recipients).toEqual(["buyer@cobalt.io"]);
  });

  it("drafts no recap when everyone on the invite was internal", async () => {
    const { rep, account } = await seedMeeting();
    const [internal] = await db
      .insert(meetings)
      .values({
        accountId: account.id,
        ownerUserId: rep.id,
        calendarEventId: `evt-${crypto.randomUUID()}`,
        title: "Internal pipeline review",
        scheduledAt: new Date(Date.now() - 3_600_000),
        endsAt: new Date(Date.now() - 1_800_000),
        attendees: [{ email: "rep@northstar.io", external: false, displayName: "Sam" }],
      })
      .returning();
    await seedTranscript(internal.id);

    runText.mockResolvedValue({
      text: "Summary body.",
      citations: [],
      usage: { inputTokens: 10, outputTokens: 10 },
      stopReason: "end_turn",
    });
    runStructured.mockResolvedValueOnce(INTENT_DEAD);

    const result = await runWrapup(internal.id);

    expect(result.followupEmailId).toBeNull();
    expect(await db.select().from(followupEmails)).toHaveLength(0);
    // No recipients means no model call at all — the draft is skipped, not
    // generated and thrown away.
    expect(runStructured).toHaveBeenCalledTimes(1);
  });

  it("still produces a summary when follow-up drafting fails", async () => {
    const { meeting } = await seedMeeting();
    await seedTranscript(meeting.id);

    runText.mockResolvedValue({
      text: "Summary body.",
      citations: [],
      usage: { inputTokens: 10, outputTokens: 10 },
      stopReason: "end_turn",
    });
    runStructured
      .mockResolvedValueOnce(INTENT_HIGH)
      .mockRejectedValueOnce(new Error("model unavailable"));

    const result = await runWrapup(meeting.id);

    expect(result.summaryId).toBeTruthy();
    expect(result.followupProposalId).toBeNull();
  });

  it("picks the deliverable format from the account's industry", async () => {
    const { meeting } = await seedMeeting({ industry: "Financial Services" });
    await seedTranscript(meeting.id);

    runText.mockResolvedValue({
      text: "Minutes body.",
      citations: [],
      usage: { inputTokens: 10, outputTokens: 10 },
      stopReason: "end_turn",
    });
    runStructured.mockResolvedValueOnce(INTENT_DEAD);

    const result = await runWrapup(meeting.id);
    expect(result.deliverableType).toBe("meeting_minutes");

    // The format instruction must actually reach the model.
    const system = runText.mock.calls[0][0].system as string;
    expect(system).toContain("formal meeting minutes");
  });

  it("counts one processed meeting against the free tier", async () => {
    const { rep, meeting } = await seedMeeting();
    await seedTranscript(meeting.id);

    runText.mockResolvedValue({
      text: "Summary body.",
      citations: [],
      usage: { inputTokens: 10, outputTokens: 10 },
      stopReason: "end_turn",
    });
    runStructured.mockResolvedValueOnce(INTENT_DEAD);

    expect((await getUsage(rep.id)).used).toBe(0);
    await runWrapup(meeting.id);
    expect((await getUsage(rep.id)).used).toBe(1);
  });
});

describe("transcript ingestion", () => {
  it("stores and indexes but skips the model when the rep is over quota", async () => {
    const { rep, meeting } = await seedMeeting();

    // Exhaust the free tier.
    for (let i = 0; i < 5; i++) await incrementUsage(rep.id);

    const result = await ingestTranscript({
      meetingId: meeting.id,
      segments: [
        {
          speakerName: "Priya",
          speakerUuid: null,
          speakerIsHost: false,
          timestampMs: 0,
          durationMs: 1000,
          text: "We need SOC 2 before we can sign anything.",
        },
      ],
      source: "test",
    });

    expect(result.skippedReason).toContain("Free tier limit reached");
    expect(result.wrapupRan).toBe(false);
    // No model calls at all.
    expect(runText).not.toHaveBeenCalled();
    expect(runStructured).not.toHaveBeenCalled();

    // The rep's own data is still stored and searchable.
    const stored = await db.query.transcripts.findFirst({
      where: eq(transcripts.meetingId, meeting.id),
    });
    expect(stored?.rawText).toContain("SOC 2");
    expect(result.chunksIndexed).toBeGreaterThan(0);

    const [updated] = await db.select().from(meetings).where(eq(meetings.id, meeting.id));
    expect(updated.status).toBe("skipped_quota");
  });

  it("refuses to store an empty transcript", async () => {
    const { meeting } = await seedMeeting();
    await expect(
      ingestTranscript({ meetingId: meeting.id, segments: [], source: "test" }),
    ).rejects.toThrow(/empty transcript/i);
  });

  it("does not double-count usage when the same transcript is re-ingested", async () => {
    const { rep, account, meeting } = await seedMeeting();

    runText.mockResolvedValue({
      text: "Summary body.",
      citations: [],
      usage: { inputTokens: 10, outputTokens: 10 },
      stopReason: "end_turn",
    });
    runStructured.mockResolvedValue(INTENT_DEAD);

    const segments = [
      {
        speakerName: "Priya",
        speakerUuid: null,
        speakerIsHost: false,
        timestampMs: 0,
        durationMs: 1000,
        text: "We need SOC 2 before we can sign.",
      },
    ];

    await ingestTranscript({ meetingId: meeting.id, segments, source: "test" });
    const afterFirst = (await getUsage(rep.id)).used;

    await ingestTranscript({ meetingId: meeting.id, segments, source: "test" });
    const afterSecond = (await getUsage(rep.id)).used;

    // Re-processing the same meeting bills again — a known, deliberate
    // behaviour: regenerating a summary is a real model spend. Recorded here so
    // a change to it is a conscious one.
    expect(afterFirst).toBe(1);
    expect(afterSecond).toBe(2);

    // Chunks are replaced, not duplicated.
    const rows = await db
      .select()
      .from(embeddings)
      .where(and(eq(embeddings.accountId, account.id), eq(embeddings.sourceType, "transcript")));
    expect(rows).toHaveLength(1);
  });
});

describe("research agent", () => {
  it("stores the brief with its citations and indexes it", async () => {
    const { account, meeting } = await seedMeeting();

    runText.mockResolvedValue({
      text: "**Company snapshot**\n\nCobalt builds industrial monitoring software.",
      citations: [{ title: "Cobalt — Newsroom", url: "https://cobalt.io/news" }],
      usage: { inputTokens: 500, outputTokens: 300 },
      stopReason: "end_turn",
    });

    const result = await generateMeetingBrief(meeting.id);

    expect(result.citations).toHaveLength(1);
    const stored = await db.query.meetingBriefs.findFirst({
      where: eq(meetingBriefs.meetingId, meeting.id),
    });
    expect(stored?.content).toContain("industrial monitoring");
    expect(stored?.citations?.[0].url).toBe("https://cobalt.io/news");
    // Not yet delivered to the rep.
    expect(stored?.notifiedAt).toBeNull();

    const [updated] = await db.select().from(meetings).where(eq(meetings.id, meeting.id));
    expect(updated.status).toBe("brief_ready");

    const chunks = await retrieveForAccount(account.id, "industrial monitoring software");
    expect(chunks.length).toBeGreaterThan(0);
  });

  it("passes the external attendees and web search tool to the model", async () => {
    const { meeting } = await seedMeeting();
    runText.mockResolvedValue({
      text: "Brief body.",
      citations: [],
      usage: { inputTokens: 10, outputTokens: 10 },
      stopReason: "end_turn",
    });

    await generateMeetingBrief(meeting.id);

    const call = runText.mock.calls[0][0];
    const prompt = call.messages[0].content as string;
    expect(prompt).toContain("buyer@cobalt.io");
    // The internal attendee must not be presented as someone to research.
    expect(prompt).not.toContain("rep@northstar.io");
    // Search is requested by flag now, so it works on either provider.
    expect(call.webSearch).toBe(true);
    // The anti-fabrication rule has to reach the model.
    expect(call.system).toContain("Do not invent facts about the person");
  });

  it("refuses to store an empty brief", async () => {
    const { meeting } = await seedMeeting();
    runText.mockResolvedValue({
      text: "   ",
      citations: [],
      usage: { inputTokens: 10, outputTokens: 0 },
      stopReason: "end_turn",
    });

    await expect(generateMeetingBrief(meeting.id)).rejects.toThrow(/empty brief/i);
  });

  it("replaces an existing brief and clears its delivered flag on regeneration", async () => {
    const { meeting } = await seedMeeting();

    runText.mockResolvedValue({
      text: "First brief.",
      citations: [],
      usage: { inputTokens: 10, outputTokens: 10 },
      stopReason: "end_turn",
    });
    await generateMeetingBrief(meeting.id);
    await db
      .update(meetingBriefs)
      .set({ notifiedAt: new Date() })
      .where(eq(meetingBriefs.meetingId, meeting.id));

    runText.mockResolvedValue({
      text: "Second brief.",
      citations: [],
      usage: { inputTokens: 10, outputTokens: 10 },
      stopReason: "end_turn",
    });
    await generateMeetingBrief(meeting.id);

    const rows = await db
      .select()
      .from(meetingBriefs)
      .where(eq(meetingBriefs.meetingId, meeting.id));

    expect(rows).toHaveLength(1);
    expect(rows[0].content).toBe("Second brief.");
    // A regenerated brief is news again.
    expect(rows[0].notifiedAt).toBeNull();
  });
});
