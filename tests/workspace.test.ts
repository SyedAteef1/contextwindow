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
