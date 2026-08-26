/**
 * The seller's own material, indexed.
 *
 * Saved and embedded at workspace scope with no account, which is what makes it
 * surface for every prospect rather than one. Retrieval treats these chunks
 * exactly like call history — the difference is only what they are about.
 */
import { and, eq, isNull } from "drizzle-orm";

import { db } from "@/db";
import { workspaceDocuments, type WorkspaceDocument } from "@/db/schema";
import { indexDocument, removeSourceFromIndex } from "@/lib/retrieval";

export async function saveWorkspaceDocument(input: {
  workspaceId: string;
  /** Set to file this against one company; omit for material about the seller. */
  accountId?: string | null;
  title: string;
  content: string;
  kind?: WorkspaceDocument["kind"];
  id?: string;
}): Promise<{ document: WorkspaceDocument; chunksIndexed: number }> {
  const [document] = input.id
    ? await db
        .update(workspaceDocuments)
        .set({
          title: input.title,
          content: input.content,
          kind: input.kind ?? "other",
          accountId: input.accountId ?? null,
          updatedAt: new Date(),
        })
        .where(eq(workspaceDocuments.id, input.id))
        .returning()
    : await db
        .insert(workspaceDocuments)
        .values({
          workspaceId: input.workspaceId,
          accountId: input.accountId ?? null,
          title: input.title,
          content: input.content,
          kind: input.kind ?? "other",
        })
        .returning();

  // Best-effort, like every other indexing path: the document is saved and
  // editable whether or not the embedder is reachable.
  let chunksIndexed = 0;
  try {
    chunksIndexed = await indexDocument({
      workspaceId: input.workspaceId,
      // Indexed against the account when it has one, which is what puts it in
      // scope for that company only rather than for every prospect.
      accountId: input.accountId ?? null,
      sourceType: "workspace_doc",
      sourceId: document.id,
      content: `${document.title}\n\n${document.content}`,
      meta: { kind: document.kind, label: document.title },
    });
  } catch (error) {
    console.error(`Indexing workspace document ${document.id} failed:`, error);
  }

  return { document, chunksIndexed };
}

/** The seller's own material: everything not filed against a company. */
export async function listWorkspaceDocuments(workspaceId: string) {
  return db
    .select()
    .from(workspaceDocuments)
    .where(
      and(eq(workspaceDocuments.workspaceId, workspaceId), isNull(workspaceDocuments.accountId)),
    )
    .orderBy(workspaceDocuments.title);
}

/** What this rep knows about one company, filed by hand rather than from a call. */
export async function listAccountDocuments(accountId: string) {
  return db
    .select()
    .from(workspaceDocuments)
    .where(eq(workspaceDocuments.accountId, accountId))
    .orderBy(workspaceDocuments.title);
}

export async function deleteWorkspaceDocument(id: string) {
  const [row] = await db
    .delete(workspaceDocuments)
    .where(eq(workspaceDocuments.id, id))
    .returning();
  // The chunks would otherwise stay retrievable after the document is gone.
  if (row) await removeSourceFromIndex("workspace_doc", row.id);
  return row ?? null;
}
