/**
 * Saved conversations.
 *
 * The rules worth pinning are ownership and ordering: a thread must be
 * unreachable by anyone but the rep who owns its account, and the sidebar must
 * sort by activity, because a conversation you replied to this morning belongs
 * above one you opened last week.
 */
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";

const { db, sqlClient } = await import("@/db");
const { accounts, users } = await import("@/db/schema");
const {
  appendMessage,
  createThread,
  historyForModel,
  listThreads,
  loadThread,
  titleFromQuestion,
} = await import("@/lib/chat-threads");

beforeEach(async () => {
  await db.execute(sql`truncate table ${users} restart identity cascade`);
});

afterAll(async () => {
  await sqlClient.end();
});

async function seedRep(email: string) {
  const [rep] = await db
    .insert(users)
    .values({ email, emailDomain: email.split("@")[1], name: email.split("@")[0] })
    .returning();
  const [account] = await db
    .insert(accounts)
    .values({ ownerUserId: rep.id, companyName: "Cobalt Systems", domain: `${email}.cobalt.io` })
    .returning();
  return { rep, account };
}

describe("thread titles", () => {
  it("keeps a short question as-is", () => {
    expect(titleFromQuestion("What are they worried about?")).toBe(
      "What are they worried about?",
    );
  });

  it("trims a long question at a word boundary, not mid-word", () => {
    const title = titleFromQuestion(
      "What did we promise them about the migration timeline and the security review",
    );
    expect(title.length).toBeLessThanOrEqual(49);
    expect(title.endsWith("…")).toBe(true);
    // The cut must not leave half a word before the ellipsis.
    expect(title.replace("…", "").trimEnd()).not.toMatch(/\s\w{1,2}$/);
  });

  it("collapses whitespace so a pasted question does not break the sidebar", () => {
    expect(titleFromQuestion("  what   about\n\nthe   budget ")).toBe("what about the budget");
  });
});

describe("threads", () => {
  it("stores messages and returns them oldest first", async () => {
    const { rep, account } = await seedRep("rep@northstar.io");
    const thread = await createThread({
      accountId: account.id,
      ownerUserId: rep.id,
      title: "Budget",
    });

    await appendMessage({ threadId: thread.id, role: "user", content: "What is the budget?" });
    await appendMessage({
      threadId: thread.id,
      role: "assistant",
      content: "They said 40k.",
      sources: [{ label: "Call — 12 Aug", sourceType: "transcript", sourceId: "x", similarity: 0.8 }],
    });

    const loaded = await loadThread(rep.id, thread.id);
    expect(loaded?.messages.map((m) => m.role)).toEqual(["user", "assistant"]);
    expect(loaded?.messages[1].sources?.[0].label).toBe("Call — 12 Aug");
  });

  it("hides a thread from a rep who does not own the account", async () => {
    const mine = await seedRep("rep@northstar.io");
    const theirs = await seedRep("other@rival.io");
    const thread = await createThread({
      accountId: mine.account.id,
      ownerUserId: mine.rep.id,
      title: "Private",
    });

    expect(await loadThread(mine.rep.id, thread.id)).not.toBeNull();
    // Knowing the id is not enough; ownership travels through the account.
    expect(await loadThread(theirs.rep.id, thread.id)).toBeNull();
    expect(await listThreads(theirs.rep.id, mine.account.id)).toHaveLength(0);
  });

  it("sorts the sidebar by most recent activity, not by creation", async () => {
    const { rep, account } = await seedRep("rep@northstar.io");
    const older = await createThread({
      accountId: account.id,
      ownerUserId: rep.id,
      title: "Opened first",
    });
    const newer = await createThread({
      accountId: account.id,
      ownerUserId: rep.id,
      title: "Opened second",
    });

    // Replying to the older conversation should lift it to the top.
    await appendMessage({ threadId: older.id, role: "user", content: "still going" });

    const threads = await listThreads(rep.id, account.id);
    expect(threads.map((t) => t.id)).toEqual([older.id, newer.id]);
    expect(newer.id).not.toBe(older.id);
  });

  it("gives the model history oldest first", async () => {
    const { rep, account } = await seedRep("rep@northstar.io");
    const thread = await createThread({
      accountId: account.id,
      ownerUserId: rep.id,
      title: "T",
    });
    for (const text of ["one", "two", "three"]) {
      await appendMessage({ threadId: thread.id, role: "user", content: text });
    }
    expect((await historyForModel(thread.id)).map((m) => m.content)).toEqual([
      "one",
      "two",
      "three",
    ]);
  });
});
