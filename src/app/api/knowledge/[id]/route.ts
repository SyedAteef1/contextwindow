/** Removing a document, and the embeddings that were made from it. */
import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { workspaceDocuments } from "@/db/schema";
import { badRequest, handler, notFound, requireUser } from "@/lib/api";
import { deleteWorkspaceDocument } from "@/lib/workspace-docs";

export const DELETE = handler(
  async (_request: Request, context: { params: Promise<{ id: string }> }) => {
    const user = await requireUser();
    if (!user.workspaceId) throw badRequest("No workspace for this account.");
    const { id } = await context.params;

    // Scoped to the caller's workspace, so an id guessed from elsewhere
    // deletes nothing.
    const doc = await db.query.workspaceDocuments.findFirst({
      where: and(
        eq(workspaceDocuments.id, id),
        eq(workspaceDocuments.workspaceId, user.workspaceId),
      ),
    });
    if (!doc) throw notFound("That document doesn't exist.");

    await deleteWorkspaceDocument(id);
    return NextResponse.json({ ok: true });
  },
);
