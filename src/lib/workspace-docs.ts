/**
 * The seller's own material, indexed.
 *
 * Saved and embedded at workspace scope with no account, which is what makes it
 * surface for every prospect rather than one. Retrieval treats these chunks
 * exactly like call history — the difference is only what they are about.
 */
import { eq } from "drizzle-orm";

import { db } from "@/db";
import { workspaceDocuments, type WorkspaceDocument } from "@/db/schema";
import { indexDocument } from "@/lib/retrieval";

export async function saveWorkspaceDocument(input: {
  workspaceId: string;
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
          updatedAt: new Date(),
        })
        .where(eq(workspaceDocuments.id, input.id))
        .returning()
    : await db
        .insert(workspaceDocuments)
        .values({
          workspaceId: input.workspaceId,
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
      accountId: null,
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

export async function listWorkspaceDocuments(workspaceId: string) {
  return db
    .select()
    .from(workspaceDocuments)
    .where(eq(workspaceDocuments.workspaceId, workspaceId));
}
