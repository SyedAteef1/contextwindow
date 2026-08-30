/**
 * The seller's own profile.
 *
 * What was captured at sign-up, made correctable afterwards. Write-only context
 * is worse than none: this steers every brief, and if the scrape came back with
 * a cookie banner instead of a value proposition there was previously no way to
 * find that out, let alone fix it.
 *
 * `rescrape` re-reads the site on demand, because a company's positioning
 * changes more often than anyone remembers to update a text box.
 */
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { db } from "@/db";
import { workspaceDocuments, workspaces } from "@/db/schema";
import { badRequest, handler, requireUser } from "@/lib/api";
import { indexDocument } from "@/lib/retrieval";
import { normaliseUrl, scrapeCompanySite } from "@/lib/scrape";

export const maxDuration = 60;

export const PATCH = handler(async (request: Request) => {
  const user = await requireUser();
  if (!user.workspaceId) throw badRequest("No workspace for this account.");
  const workspaceId = user.workspaceId;

  const body = (await request.json().catch(() => null)) as {
    website?: string;
    description?: string;
    idealCustomer?: string;
    rescrape?: boolean;
  } | null;

  const patch: Record<string, unknown> = { updatedAt: new Date() };

  if (body?.website !== undefined) {
    const raw = body.website.trim();
    if (raw) {
      const url = normaliseUrl(raw);
      if (!url) throw badRequest("That doesn't look like a website address.");
      patch.website = url.toString();
    } else {
      patch.website = null;
    }
  }
  if (body?.description !== undefined) patch.description = body.description.trim() || null;
  if (body?.idealCustomer !== undefined) patch.idealCustomer = body.idealCustomer.trim() || null;

  const [workspace] = await db
    .update(workspaces)
    .set(patch)
    .where(eq(workspaces.id, workspaceId))
    .returning();
  if (!workspace) throw badRequest("No workspace for this account.");

  let scraped = false;
  if (body?.rescrape && workspace.website) {
    const site = await scrapeCompanySite(workspace.website);
    if (!site) {
      throw badRequest(
        "Couldn't read that site — it may block automated readers. Paste the important part below instead.",
      );
    }

    const [doc] = await db
      .insert(workspaceDocuments)
      .values({
        workspaceId,
        accountId: null,
        title: site.title ?? `${workspace.name} — website`,
        content: site.text,
        kind: "positioning",
      })
      .returning();

    await db
      .update(workspaces)
      .set({ description: site.text.slice(0, 2000), updatedAt: new Date() })
      .where(eq(workspaces.id, workspaceId));

    try {
      await indexDocument({
        workspaceId,
        accountId: null,
        sourceType: "workspace_doc",
        sourceId: doc.id,
        content: site.text,
      });
    } catch (error) {
      console.error("Indexing the re-read site failed:", error);
    }
    scraped = true;
  }

  return NextResponse.json({ ok: true, scraped });
});
