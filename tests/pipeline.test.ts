/**
 * Integration tests against a real Postgres + pgvector database.
 *
 * These cover the properties that would be expensive to get wrong: that
 * retrieval never crosses an account boundary, that the free-tier meter counts
 * correctly under concurrency, and that transcript ingestion is idempotent.
 */
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { and, eq, sql } from "drizzle-orm";

import { db, sqlClient } from "@/db";
import {
  accounts,
  embeddings,
  meetings,
  transcripts,
  usage,
  users,
  type SpeakerSegment,
} from "@/db/schema";
import { indexDocument, loadPlaybookSnippets, retrieveForAccount } from "@/lib/retrieval";
import { canProcessMeeting, currentPeriodStart, getUsage, incrementUsage, setFreeTierLimit } from "@/lib/usage";

async function resetDatabase() {
  // Cascades through every dependent table.
  await db.execute(sql`truncate table ${users} restart identity cascade`);
}

async function makeRep(email = "rep@northstar.io") {
  const [rep] = await db
    .insert(users)
    .values({ email, emailDomain: email.split("@")[1], name: "Test Rep" })
    .returning();
  return rep;
}

async function makeAccount(ownerUserId: string, companyName: string, domain: string) {
  const [account] = await db
    .insert(accounts)
    .values({ ownerUserId, companyName, domain })
    .returning();
  return account;
}

async function makeMeeting(accountId: string, ownerUserId: string, eventId: string) {
  const [meeting] = await db
    .insert(meetings)
    .values({
      accountId,
      ownerUserId,
      calendarEventId: eventId,
      title: "Test call",
      scheduledAt: new Date(),
    })
    .returning();
  return meeting;
}

beforeEach(resetDatabase);
afterAll(async () => {
  await sqlClient.end();
});

describe("retrieval isolation", () => {
  it("never returns another account's chunks, even for a matching query", async () => {
    const rep = await makeRep();
    const cobalt = await makeAccount(rep.id, "Cobalt Systems", "cobalt.io");
    const meridian = await makeAccount(rep.id, "Meridian Health", "meridian.org");

    await indexDocument({
      accountId: cobalt.id,
      sourceType: "transcript",
      sourceId: crypto.randomUUID(),
      content:
        "Marcus said they cannot sign without a current SOC 2 Type II report. Finance is worried about the migration timeline after a nine month overrun.",
    });
    await indexDocument({
      accountId: meridian.id,
      sourceType: "transcript",
      sourceId: crypto.randomUUID(),
      content: "Dr Farrow asked about HIPAA compliance and outpatient clinic scheduling.",
    });

    const query = "What did they say about SOC 2 and the migration timeline?";

    const fromCobalt = await retrieveForAccount(cobalt.id, query);
    const fromMeridian = await retrieveForAccount(meridian.id, query);

    // The Cobalt material is a strong match for this query...
    expect(fromCobalt.length).toBeGreaterThan(0);
    expect(fromCobalt[0].content).toContain("SOC 2");

    // ...and it must not surface under Meridian no matter how well it matches.
    for (const chunk of fromMeridian) {
      expect(chunk.content).not.toContain("SOC 2");
    }
    const cobaltIds = new Set(fromCobalt.map((chunk) => chunk.id));
    expect(fromMeridian.filter((chunk) => cobaltIds.has(chunk.id))).toHaveLength(0);
  });

  it("returns nothing rather than a weak match when the account has no history", async () => {
    const rep = await makeRep();
    const empty = await makeAccount(rep.id, "Empty Co", "empty.com");
    expect(await retrieveForAccount(empty.id, "anything at all")).toHaveLength(0);
  });

  it("ranks the more relevant chunk first", async () => {
    const rep = await makeRep();
    const account = await makeAccount(rep.id, "Cobalt", "cobalt.io");

    await indexDocument({
      accountId: account.id,
      sourceType: "summary",
      sourceId: crypto.randomUUID(),
      content: "Pricing was discussed at length; they pushed back on the per-seat model.",
    });
    await indexDocument({
      accountId: account.id,
      sourceType: "brief",
      sourceId: crypto.randomUUID(),
      content: "The company builds industrial monitoring software for manufacturers.",
    });

    // Ranking is the assertion here, so read past the relevance floor.
    const results = await retrieveForAccount(account.id, "they pushed back on pricing", {
      minSimilarity: -1,
    });
    expect(results[0].content).toContain("per-seat");
    expect(results[1].content).toContain("industrial monitoring");
  });

  it("keeps a plain question above the relevance floor on the dev provider", async () => {
    const rep = await makeRep();
    const account = await makeAccount(rep.id, "Cobalt", "cobalt.io");

    await indexDocument({
      accountId: account.id,
      sourceType: "summary",
      sourceId: crypto.randomUUID(),
      content: "Pricing was discussed at length; they pushed back on the per-seat model.",
    });

    // The floor is provider-relative; a natural question must still retrieve.
    const results = await retrieveForAccount(account.id, "what happened with pricing per seat");
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].content).toContain("per-seat");
  });

  it("replaces a source's chunks on re-index rather than accumulating them", async () => {
    const rep = await makeRep();
    const account = await makeAccount(rep.id, "Cobalt", "cobalt.io");
    const sourceId = crypto.randomUUID();

    await indexDocument({
      accountId: account.id,
      sourceType: "summary",
      sourceId,
      content: "First version of the summary mentioning apples.",
    });
    await indexDocument({
      accountId: account.id,
      sourceType: "summary",
      sourceId,
      content: "Second version of the summary mentioning oranges.",
    });

    const stored = await db
      .select()
      .from(embeddings)
      .where(and(eq(embeddings.sourceId, sourceId), eq(embeddings.sourceType, "summary")));

    expect(stored).toHaveLength(1);
    expect(stored[0].content).toContain("oranges");
    // The superseded text must no longer be retrievable.
    const results = await retrieveForAccount(account.id, "apples");
    expect(results.every((chunk) => !chunk.content.includes("apples"))).toBe(true);
  });

  it("scopes chunks by source type when asked", async () => {
    const rep = await makeRep();
    const account = await makeAccount(rep.id, "Cobalt", "cobalt.io");

    await indexDocument({
      accountId: account.id,
      sourceType: "transcript",
      sourceId: crypto.randomUUID(),
      content: "Transcript content about pricing negotiations.",
    });
    await indexDocument({
      accountId: account.id,
      sourceType: "brief",
      sourceId: crypto.randomUUID(),
      content: "Brief content about pricing research.",
    });

    const onlyBriefs = await retrieveForAccount(account.id, "pricing", {
      sourceTypes: ["brief"],
    });
    expect(onlyBriefs.length).toBeGreaterThan(0);
    expect(onlyBriefs.every((chunk) => chunk.sourceType === "brief")).toBe(true);
  });
});

describe("free-tier metering", () => {
  it("creates the meter on first read with the configured limit", async () => {
    const rep = await makeRep();

    const state = await getUsage(rep.id);
    expect(state.used).toBe(0);
    expect(state.limit).toBe(5);
    expect(state.overLimit).toBe(false);
  });

  it("blocks once the limit is reached and not before", async () => {
    const rep = await makeRep();

    for (let i = 0; i < 4; i++) await incrementUsage(rep.id);
    expect((await canProcessMeeting(rep.id)).overLimit).toBe(false);

    await incrementUsage(rep.id);
    const blocked = await canProcessMeeting(rep.id);
    expect(blocked.used).toBe(5);
    expect(blocked.overLimit).toBe(true);
    expect(blocked.remaining).toBe(0);
  });

  it("counts every increment when they land concurrently", async () => {
    const rep = await makeRep();
    await getUsage(rep.id);

    // Two webhooks arriving at once must not read-modify-write over each other.
    await Promise.all(Array.from({ length: 5 }, () => incrementUsage(rep.id)));

    expect((await getUsage(rep.id)).used).toBe(5);
  });

  it("resets the counter when the stored period predates this month", async () => {
    const rep = await makeRep();

    await incrementUsage(rep.id);
    await incrementUsage(rep.id);
    expect((await getUsage(rep.id)).used).toBe(2);

    // Backdate the period as though the month rolled over.
    await db
      .update(usage)
      .set({ periodStart: new Date("2020-01-01T00:00:00Z") })
      .where(eq(usage.userId, rep.id));

    const rolled = await getUsage(rep.id);
    expect(rolled.used).toBe(0);
    expect(rolled.periodStart.getTime()).toBe(currentPeriodStart().getTime());
  });

  it("respects a raised limit", async () => {
    const rep = await makeRep();

    for (let i = 0; i < 5; i++) await incrementUsage(rep.id);
    expect((await getUsage(rep.id)).overLimit).toBe(true);

    await setFreeTierLimit(rep.id, 20);
    expect((await getUsage(rep.id)).overLimit).toBe(false);
  });

  it("meters each rep separately", async () => {
    const one = await makeRep("one@northstar.io");
    const two = await makeRep("two@northstar.io");

    await incrementUsage(one.id);
    await incrementUsage(one.id);

    expect((await getUsage(one.id)).used).toBe(2);
    expect((await getUsage(two.id)).used).toBe(0);
  });

  it("counts every company a rep meets against the same allowance", async () => {
    const rep = await makeRep();
    const a = await makeAccount(rep.id, "A", "a.com");
    const b = await makeAccount(rep.id, "B", "b.com");

    // Three meetings across two prospects is three against the rep's five.
    // Metered per account this read 2 and 1 against separate allowances, which
    // is why the free tier could never be exhausted.
    await incrementUsage(rep.id);
    await incrementUsage(rep.id);
    await incrementUsage(rep.id);

    const state = await getUsage(rep.id);
    expect(state.used).toBe(3);
    expect(state.remaining).toBe(2);
    expect(a.id).not.toBe(b.id);
  });
});

describe("transcript storage", () => {
  const segments: SpeakerSegment[] = [
    { speakerName: "Priya", speakerUuid: null, speakerIsHost: false, timestampMs: 0, durationMs: 1000, text: "Hello" },
  ];

  it("upserts on meeting id rather than creating duplicates", async () => {
    const rep = await makeRep();
    const account = await makeAccount(rep.id, "Cobalt", "cobalt.io");
    const meeting = await makeMeeting(account.id, rep.id, "evt-1");

    for (const text of ["first version", "second version"]) {
      await db
        .insert(transcripts)
        .values({ meetingId: meeting.id, rawText: text, speakerSegments: segments, source: "test" })
        .onConflictDoUpdate({
          target: transcripts.meetingId,
          set: { rawText: text, updatedAt: new Date() },
        });
    }

    const stored = await db.select().from(transcripts).where(eq(transcripts.meetingId, meeting.id));
    expect(stored).toHaveLength(1);
    expect(stored[0].rawText).toBe("second version");
  });
});

describe("playbook retrieval", () => {
  it("returns global snippets and this account's, filtered by audience", async () => {
    const rep = await makeRep();
    const account = await makeAccount(rep.id, "Cobalt", "cobalt.io");
    const other = await makeAccount(rep.id, "Other", "other.com");

    await db.insert(db._.fullSchema.playbookSnippets).values([
      { ownerUserId: rep.id, title: "Global wrapup", content: "g", appliesTo: ["wrapup"] },
      { ownerUserId: rep.id, title: "Global chat only", content: "c", appliesTo: ["chat"] },
      { ownerUserId: rep.id, title: "Everywhere", content: "e", appliesTo: null },
      { ownerUserId: rep.id, accountId: account.id, title: "Cobalt only", content: "x", appliesTo: ["wrapup"] },
      { ownerUserId: rep.id, accountId: other.id, title: "Other only", content: "y", appliesTo: ["wrapup"] },
    ]);

    const forWrapup = await loadPlaybookSnippets({
      ownerUserId: rep.id,
      accountId: account.id,
      audience: "wrapup",
    });
    const titles = forWrapup.map((snippet) => snippet.title);

    expect(titles).toContain("Global wrapup");
    expect(titles).toContain("Everywhere");
    expect(titles).toContain("Cobalt only");
    expect(titles).not.toContain("Global chat only");
    expect(titles).not.toContain("Other only");
  });
});
