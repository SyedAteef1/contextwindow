/**
 * Workspace-scoped retrieval.
 *
 * The point of the migration: the seller's own material can be embedded at all,
 * surfaces for every prospect, and does not leak between workspaces.
 */
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";

const { db, sqlClient } = await import("@/db");
const { accounts, users, workspaces } = await import("@/db/schema");
const { indexDocument, retrieveForAccount } = await import("@/lib/retrieval");

beforeEach(async () => {
  await db.execute(sql`truncate table ${workspaces} restart identity cascade`);
  await db.execute(sql`truncate table ${users} restart identity cascade`);
});

afterAll(async () => {
  await sqlClient.end();
});

async function seedWorkspace(domain: string) {
  const [workspace] = await db
    .insert(workspaces)
    .values({ name: domain.split(".")[0], domain })
    .returning();
  const [rep] = await db
    .insert(users)
    .values({ email: `rep@${domain}`, emailDomain: domain, workspaceId: workspace.id })
    .returning();
  const [account] = await db
    .insert(accounts)
    .values({
      ownerUserId: rep.id,
      workspaceId: workspace.id,
      companyName: "Cobalt Systems",
      domain: `cobalt-${domain}`,
    })
    .returning();
  return { workspace, rep, account };
}

describe("workspace retrieval", () => {
  it("finds the seller's own material with no account attached", async () => {
    const { workspace, account } = await seedWorkspace("northstar.io");

    // The kind of chunk that could not exist before: about us, not about them.
    await indexDocument({
      workspaceId: workspace.id,
      accountId: null,
      sourceType: "workspace_doc",
      sourceId: crypto.randomUUID(),
      content:
        "Pricing. Northstar is priced per seat on annual contracts. Discounts above fifty seats are approved by the VP of Sales, never by the rep on the call.",
    });

    const hits = await retrieveForAccount(
      { accountId: account.id, workspaceId: workspace.id },
      "how is our pricing structured and who approves a discount",
    );

    expect(hits.length).toBeGreaterThan(0);
    expect(hits.map((h) => h.content).join(" ")).toContain("per seat");
  });

  it("returns account history and workspace material together", async () => {
    const { workspace, account } = await seedWorkspace("northstar.io");

    await indexDocument({
      workspaceId: workspace.id,
      accountId: account.id,
      sourceType: "transcript",
      sourceId: crypto.randomUUID(),
      content: "Dana said the migration cannot start before their fiscal year closes in October.",
    });
    await indexDocument({
      workspaceId: workspace.id,
      accountId: null,
      sourceType: "workspace_doc",
      sourceId: crypto.randomUUID(),
      content: "A migration is scoped by our onboarding team and typically takes three weeks.",
    });

    const hits = await retrieveForAccount(
      { accountId: account.id, workspaceId: workspace.id },
      "migration timing",
    );
    const kinds = new Set(hits.map((h) => h.sourceType));
    expect(kinds.has("transcript")).toBe(true);
    expect(kinds.has("workspace_doc")).toBe(true);
  });

  it("never leaks one workspace's material into another", async () => {
    const mine = await seedWorkspace("northstar.io");
    const theirs = await seedWorkspace("rival.io");

    await indexDocument({
      workspaceId: theirs.workspace.id,
      accountId: null,
      sourceType: "workspace_doc",
      sourceId: crypto.randomUUID(),
      content: "Rival prices per seat on annual contracts with volume discounts above fifty.",
    });

    const hits = await retrieveForAccount(
      { accountId: mine.account.id, workspaceId: mine.workspace.id },
      "how is our pricing structured",
    );
    expect(hits).toHaveLength(0);
  });

  it("still isolates by account when no workspace is given", async () => {
    const { workspace, account } = await seedWorkspace("northstar.io");
    await indexDocument({
      workspaceId: workspace.id,
      accountId: null,
      sourceType: "workspace_doc",
      sourceId: crypto.randomUUID(),
      content: "Northstar is priced per seat on annual contracts.",
    });

    // The old single-argument form: account only, workspace material invisible.
    const hits = await retrieveForAccount(account.id, "how is our pricing structured");
    expect(hits).toHaveLength(0);
  });
});

describe("retrieval quality", () => {
  it("finds one exchange inside a long call rather than the whole call", async () => {
    const { workspace, account } = await seedWorkspace("northstar.io");

    // A full-length call covering three unrelated subjects. Chunked as one
    // blob its embedding is close to all of them and precise about none.
    const call = [
      "Priya Raman: Thanks for making time. Reporting takes days when it should take minutes, and that is really what started all of this for us internally.",
      "Sam Okonkwo: That is a common place to start. How many people would actually be on the new system day to day?",
      "Priya Raman: Around a hundred and twenty across sales and customer success, and probably more once next year's hiring plan lands.",
      "Sam Okonkwo: And who else needs to be comfortable with the decision besides yourself?",
      "Priya Raman: Marcus in finance, and security will certainly have a view on it. I own the evaluation but I do not sign anything.",
      "Dana Whitfield: Before we go any further I want to raise something. Is SAML SSO available today? We run Okta and everything we buy has to sit behind it.",
      "Sam Okonkwo: SAML SSO ships in Q4, and importantly it is included at your tier rather than priced as a separate line item.",
      "Dana Whitfield: Included is the part I care about. The last vendor we looked at wanted twelve thousand a year just for that one feature.",
      "Sam Okonkwo: That is a fairly common pattern in this market and it is one of the things we deliberately do differently.",
      "Marcus Webb: Separately, and I would rather say this now than at the end, we cannot sign anything without a current SOC 2 Type II report.",
      "Sam Okonkwo: We have Type II, renewed in March, and I can share it under NDA today if that helps you move.",
      "Marcus Webb: Today would be good. Our last audit flagged vendor management so this is a genuine gate for me rather than a preference.",
    ].join("\n");

    await indexDocument({
      workspaceId: workspace.id,
      accountId: account.id,
      sourceType: "transcript",
      sourceId: crypto.randomUUID(),
      content: call,
    });

    // Asserted without expansion: the claim here is about what the *index*
    // isolates. Expansion deliberately widens a hit again, and on a short call
    // with few chunks that legitimately rebuilds most of it.
    const hits = await retrieveForAccount(
      { accountId: account.id, workspaceId: workspace.id },
      "SSO Okta available tier",
      { expandNeighbours: false },
    );

    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0].content).toContain("SSO");
    // The point of small chunks: the winning passage is the SSO exchange, not
    // the entire call with the seat count and the SOC 2 gate attached.
    expect(hits[0].content).not.toContain("SOC 2 Type II report");
  });

  it("widens a hit to its neighbouring chunks", async () => {
    const { workspace, account } = await seedWorkspace("northstar.io");
    const call = [
      "Priya Raman: Can you put the parallel run in writing?",
      "Sam Okonkwo: Yes, I will send a migration outline this week.",
      "Dana Whitfield: That matters because the last vendor overran by months.",
      "Sam Okonkwo: Understood, the existing system stays authoritative.",
    ].join("\n");

    await indexDocument({
      workspaceId: workspace.id,
      accountId: account.id,
      sourceType: "transcript",
      sourceId: crypto.randomUUID(),
      content: call,
    });

    const wide = await retrieveForAccount(
      { accountId: account.id, workspaceId: workspace.id },
      "migration outline writing",
    );
    const narrow = await retrieveForAccount(
      { accountId: account.id, workspaceId: workspace.id },
      "migration outline writing",
      { expandNeighbours: false },
    );

    expect(wide.length).toBeGreaterThan(0);
    expect(wide[0].content.length).toBeGreaterThanOrEqual(narrow[0].content.length);
    // Ranking is unaffected — only the text handed to the model gets wider.
    expect(wide[0].id).toBe(narrow[0].id);
  });

  it("prefers a recent call over an old one saying the same thing", async () => {
    const { workspace, account } = await seedWorkspace("northstar.io");
    const claim = "Sam Okonkwo: The discount needs approval from the VP of Sales.";

    const old = new Date();
    old.setDate(old.getDate() - 400);
    const recent = new Date();
    recent.setDate(recent.getDate() - 2);

    for (const [when, id] of [[old, "old"], [recent, "recent"]] as const) {
      await indexDocument({
        workspaceId: workspace.id,
        accountId: account.id,
        sourceType: "summary",
        sourceId: crypto.randomUUID(),
        content: claim,
        meta: { scheduledAt: when.toISOString(), label: id },
      });
    }

    const hits = await retrieveForAccount(
      { accountId: account.id, workspaceId: workspace.id },
      "who approves the discount",
    );
    expect(hits.length).toBeGreaterThan(1);
    expect(hits[0].meta?.label).toBe("recent");
  });
});
