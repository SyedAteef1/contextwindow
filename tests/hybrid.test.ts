/**
 * Hybrid retrieval against real Postgres + pgvector.
 *
 * The point of adding sparse vectors is the case dense embeddings are weakest
 * at: a rare exact token. These tests construct exactly that situation — a
 * chunk that is semantically unrelated to the query but shares the literal term
 * — and assert that fusion surfaces it while dense-only retrieval does not.
 */
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { sql } from "drizzle-orm";

const embedForIndex = vi.fn();
const embedForSearch = vi.fn();
const sparseEnabled = vi.fn(() => true);

vi.mock("@/lib/embeddings", async () => {
  const actual = await vi.importActual<typeof import("@/lib/embeddings")>("@/lib/embeddings");
  return {
    ...actual,
    embedForIndex,
    embedForSearch,
    sparseEnabled,
  };
});

const { db, sqlClient } = await import("@/db");
const { accounts, users, workspaces } = await import("@/db/schema");
const { indexDocument, retrieveForAccount } = await import("@/lib/retrieval");

const DIM = 1024;

/** A unit vector pointing along one axis — similarity is then fully controlled. */
function axisVector(axis: number): number[] {
  const vector = new Array<number>(DIM).fill(0);
  vector[axis] = 1;
  return vector;
}

/** Blend two axes so a chunk can be "somewhat" similar to a query. */
function blend(axisA: number, axisB: number, weight: number): number[] {
  const vector = new Array<number>(DIM).fill(0);
  vector[axisA] = Math.sqrt(1 - weight);
  vector[axisB] = Math.sqrt(weight);
  return vector;
}

async function seedAccount() {
  const [rep] = await db
    .insert(users)
    .values({ email: "rep@northstar.io", emailDomain: "northstar.io" })
    .returning();
  const [workspace] = await db
    .insert(workspaces)
    .values({ name: "Northstar", domain: "northstar.io" })
    .returning();
  const [account] = await db
    .insert(accounts)
    .values({
      ownerUserId: rep.id,
      workspaceId: workspace.id,
      companyName: "Cobalt",
      domain: "cobalt.io",
    })
    .returning();
  return account;
}

beforeEach(async () => {
  embedForIndex.mockReset();
  embedForSearch.mockReset();
  sparseEnabled.mockReturnValue(true);
  await db.execute(sql`truncate table ${users}, ${workspaces} restart identity cascade`);
});

afterAll(async () => {
  await sqlClient.end();
});

describe("hybrid retrieval", () => {
  it("surfaces an exact-token match that dense retrieval alone would miss", async () => {
    const account = await seedAccount();

    // Two documents. The first is semantically close to the query but never
    // mentions the term. The second is semantically distant and does.
    const semanticallyClose = "They discussed the commercial terms at some length.";
    const exactTokenMatch = "The auditor asked specifically about SOC 2 Type II.";

    // Token 4242 stands in for the rare term "SOC 2".
    embedForIndex.mockResolvedValueOnce([
      { dense: blend(0, 1, 0.1), sparse: { indices: [7], values: [0.8] } },
    ]);
    await indexDocument({
      workspaceId: account.workspaceId!,
      accountId: account.id,
      sourceType: "summary",
      sourceId: crypto.randomUUID(),
      content: semanticallyClose,
    });

    embedForIndex.mockResolvedValueOnce([
      { dense: axisVector(500), sparse: { indices: [4242], values: [0.95] } },
    ]);
    await indexDocument({
      workspaceId: account.workspaceId!,
      accountId: account.id,
      sourceType: "transcript",
      sourceId: crypto.randomUUID(),
      content: exactTokenMatch,
    });

    // The query leans semantically toward the first document, but its lexical
    // weight is entirely on the rare term.
    embedForSearch.mockResolvedValue({
      dense: axisVector(0),
      sparse: { indices: [4242], values: [1] },
    });

    const hybrid = await retrieveForAccount(account.id, "what was said about SOC 2?", { topK: 2 });
    expect(hybrid.map((chunk) => chunk.content)).toContain(exactTokenMatch);

    // With sparse switched off, the same query returns only the dense match —
    // which is the gap hybrid exists to close.
    sparseEnabled.mockReturnValue(false);
    embedForSearch.mockResolvedValue({ dense: axisVector(0), sparse: null });

    const denseOnly = await retrieveForAccount(account.id, "what was said about SOC 2?", {
      topK: 2,
    });
    expect(denseOnly.map((chunk) => chunk.content)).not.toContain(exactTokenMatch);
  });

  it("persists the sparse vector alongside the dense one", async () => {
    const account = await seedAccount();

    embedForIndex.mockResolvedValue([
      { dense: axisVector(3), sparse: { indices: [0, 9], values: [0.5, 0.25] } },
    ]);
    await indexDocument({
      workspaceId: account.workspaceId!,
      accountId: account.id,
      sourceType: "brief",
      sourceId: crypto.randomUUID(),
      content: "A brief.",
    });

    const rows = await db.execute<{ sparse_vector: string | null }>(
      sql`select sparse_vector::text from embeddings limit 1`,
    );
    // 1-based indices, and the vocabulary width carried through.
    expect([...rows][0].sparse_vector).toBe("{1:0.5,10:0.25}/250002");
  });

  it("stores no sparse vector when hybrid is unavailable", async () => {
    const account = await seedAccount();
    sparseEnabled.mockReturnValue(false);

    embedForIndex.mockResolvedValue([{ dense: axisVector(3), sparse: null }]);
    await indexDocument({
      workspaceId: account.workspaceId!,
      accountId: account.id,
      sourceType: "brief",
      sourceId: crypto.randomUUID(),
      content: "A brief.",
    });

    const rows = await db.execute<{ sparse_vector: string | null }>(
      sql`select sparse_vector::text from embeddings limit 1`,
    );
    expect([...rows][0].sparse_vector).toBeNull();
  });

  it("keeps sparse results inside the account boundary", async () => {
    const account = await seedAccount();
    const [other] = await db
      .insert(accounts)
      .values({
        ownerUserId: account.ownerUserId,
        companyName: "Meridian",
        domain: "meridian.org",
      })
      .returning();

    // The other account holds the only chunk with the rare term.
    embedForIndex.mockResolvedValue([
      { dense: axisVector(500), sparse: { indices: [4242], values: [0.95] } },
    ]);
    await indexDocument({
      workspaceId: other.workspaceId!,
      accountId: other.id,
      sourceType: "transcript",
      sourceId: crypto.randomUUID(),
      content: "Meridian mentioned SOC 2.",
    });

    embedForSearch.mockResolvedValue({
      dense: axisVector(0),
      sparse: { indices: [4242], values: [1] },
    });

    // A perfect lexical match must still not cross the account filter.
    const results = await retrieveForAccount(account.id, "SOC 2", { topK: 5 });
    expect(results).toHaveLength(0);
  });
});
