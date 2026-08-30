/**
 * Saving what the team knows.
 *
 * One route for both kinds of document, because they are the same row: a null
 * `accountId` is the seller's own material — what we sell, how it is priced,
 * how we handle an objection — and a set one belongs to a single prospect.
 * Retrieval already unions the two, so splitting the write path would have
 * bought nothing but a second thing to keep in step.
 *
 * This did not exist. `AccountKnowledge` has been posting to a 404 since it was
 * written, which is why nothing anyone typed into it was ever saved.
 */
import { NextResponse } from "next/server";

import { badRequest, handler, requireOwnedAccount, requireUser } from "@/lib/api";
import { saveWorkspaceDocument } from "@/lib/workspace-docs";
import type { workspaceDocuments } from "@/db/schema";

type Kind = typeof workspaceDocuments.$inferSelect.kind;

const KINDS: Kind[] = ["product", "pricing", "positioning", "case_study", "objection", "other"];

export const maxDuration = 60;

export const POST = handler(async (request: Request) => {
  const user = await requireUser();
  if (!user.workspaceId) throw badRequest("No workspace for this account.");

  const body = (await request.json().catch(() => null)) as {
    id?: string;
    accountId?: string | null;
    title?: string;
    content?: string;
    kind?: string;
  } | null;

  const title = body?.title?.trim();
  const content = body?.content?.trim();
  if (!title) throw badRequest("Give it a title so it can be found later.");
  if (!content) throw badRequest("There's nothing to save yet.");

  // Ownership is checked here rather than trusted from the body: an accountId
  // arrives from the browser, and filing a note against someone else's account
  // would put it into their retrieval.
  if (body?.accountId) await requireOwnedAccount(user.id, body.accountId);

  const kind = (KINDS as string[]).includes(body?.kind ?? "") ? (body!.kind as Kind) : "other";

  const { document, chunksIndexed } = await saveWorkspaceDocument({
    workspaceId: user.workspaceId,
    accountId: body?.accountId ?? null,
    title,
    content,
    kind,
    id: body?.id,
  });

  return NextResponse.json({ document, chunksIndexed });
});
