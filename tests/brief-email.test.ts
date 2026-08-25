/**
 * Delivering the brief.
 *
 * The rules worth pinning: it goes to the rep and to nobody else, it is sent
 * once, and a failed send stays retryable rather than being recorded as
 * delivered.
 */
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { eq, sql } from "drizzle-orm";

const sendEmail = vi.fn();
vi.mock("@/lib/google/gmail", () => ({ sendEmail, bodyToHtml: (s: string) => s }));
vi.mock("@/lib/google/oauth", () => ({ getAccessTokenForUser: async () => "token" }));

const { db, sqlClient } = await import("@/db");
const { accounts, meetingBriefs, meetings, users, workspaces } = await import("@/db/schema");
const { sendBriefEmail, briefToPlainText } = await import("@/lib/brief-email");

beforeEach(async () => {
  sendEmail.mockReset();
  sendEmail.mockResolvedValue({ id: "msg_1", threadId: "thr_1" });
  await db.execute(sql`truncate table ${users}, ${workspaces} restart identity cascade`);
});

afterAll(async () => {
  await sqlClient.end();
});

async function seed() {
  const [rep] = await db
    .insert(users)
    .values({ email: "rep@northstar.io", emailDomain: "northstar.io", name: "Sam" })
    .returning();
  const [account] = await db
    .insert(accounts)
    .values({ ownerUserId: rep.id, companyName: "Cobalt Systems", domain: "cobalt.io" })
    .returning();
  const [meeting] = await db
    .insert(meetings)
    .values({
      accountId: account.id,
      ownerUserId: rep.id,
      calendarEventId: `evt-${crypto.randomUUID()}`,
      title: "Platform evaluation",
      scheduledAt: new Date("2026-09-04T13:00:00Z"),
      attendees: [
        { email: "rep@northstar.io", external: false, displayName: "Sam" },
        { email: "dana@cobalt.io", external: true, displayName: "Dana Whitfield" },
      ],
    })
    .returning();
  const [brief] = await db
    .insert(meetingBriefs)
    .values({
      meetingId: meeting.id,
      content: "## Company\n\n**Cobalt** builds packaging automation.\n\n- Series B in January",
      citations: [{ title: "Cobalt — Newsroom", url: "https://cobalt.io/news" }],
    })
    .returning();
  return { rep, account, meeting, brief };
}

describe("brief email", () => {
  it("sends to the rep and never to an attendee", async () => {
    const { rep, meeting } = await seed();

    const result = await sendBriefEmail(meeting.id);

    expect(result.sent).toBe(true);
    const [, payload] = sendEmail.mock.calls[0];
    // The buyer is on the invite but must never receive the rep's own brief.
    expect(payload.to).toEqual([rep.email]);
    expect(JSON.stringify(payload)).not.toContain("dana@cobalt.io");
  });

  it("includes the sources so a claim can be checked", async () => {
    const { meeting } = await seed();
    await sendBriefEmail(meeting.id);
    const [, payload] = sendEmail.mock.calls[0];
    expect(payload.body).toContain("https://cobalt.io/news");
    expect(payload.subject).toContain("Cobalt Systems");
  });

  it("sends once, however many times it is called", async () => {
    const { meeting } = await seed();
    expect((await sendBriefEmail(meeting.id)).sent).toBe(true);
    const second = await sendBriefEmail(meeting.id);
    expect(second).toEqual({ sent: false, reason: "already emailed" });
    expect(sendEmail).toHaveBeenCalledTimes(1);
  });

  it("stays retryable when the send fails", async () => {
    const { meeting } = await seed();
    sendEmail.mockRejectedValueOnce(new Error("gmail down"));

    await expect(sendBriefEmail(meeting.id)).rejects.toThrow("gmail down");

    // A failed send must not look like a delivered one.
    const [row] = await db
      .select()
      .from(meetingBriefs)
      .where(eq(meetingBriefs.meetingId, meeting.id));
    expect(row.emailedAt).toBeNull();

    sendEmail.mockResolvedValue({ id: "msg_2", threadId: "t" });
    expect((await sendBriefEmail(meeting.id)).sent).toBe(true);
  });
});

describe("markdown flattened for mail", () => {
  it("turns headings into plain section lines", () => {
    expect(briefToPlainText("## Company snapshot\n\nText")).toBe("COMPANY SNAPSHOT\n\nText");
  });

  it("drops bold and keeps bullets", () => {
    expect(briefToPlainText("**Cobalt** ships\n* one\n* two")).toBe("Cobalt ships\n- one\n- two");
  });

  it("keeps a link's destination rather than hiding it behind text", () => {
    expect(briefToPlainText("See [the news](https://cobalt.io/news)")).toBe(
      "See the news (https://cobalt.io/news)",
    );
  });
});
