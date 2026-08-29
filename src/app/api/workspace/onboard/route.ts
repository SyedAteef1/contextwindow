/**
 * Sign-up's one question, answered.
 *
 * Takes the seller's website, reads it, and turns it into workspace context
 * every brief is then written against. The scrape is awaited rather than
 * queued: it takes a couple of seconds, the rep is watching a spinner they
 * expect, and a background job here would mean their first brief is written
 * before their own positioning exists.
 *
 * A failed scrape does not fail onboarding. A site behind Cloudflare or built
 * entirely in JavaScript is common, and refusing to let someone in because we
 * could not read their marketing page would be absurd — the URL is saved, they
 * continue, and they can paste anything important by hand later.
 */
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { db } from "@/db";
import { workspaceDocuments, workspaces } from "@/db/schema";
import { badRequest, handler, requireUser } from "@/lib/api";
import { normaliseUrl, scrapeCompanySite } from "@/lib/scrape";
import { indexDocument } from "@/lib/retrieval";

export const maxDuration = 60;

export const POST = handler(async (request: Request) => {
  const user = await requireUser();
  const body = (await request.json().catch(() => null)) as {
    website?: string;
    idealCustomer?: string;
  } | null;

  if (!user.workspaceId) throw badRequest("No workspace for this account.");

  const raw = (body?.website ?? "").trim();
  const url = raw ? normaliseUrl(raw) : null;
  if (raw && !url) {
    throw badRequest("That doesn't look like a website address. Try something like acme.com");
  }

  const workspaceId = user.workspaceId;

  const [workspace] = await db
    .update(workspaces)
    .set({
      website: url?.toString() ?? null,
      idealCustomer: body?.idealCustomer?.trim() || null,
      onboardedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(workspaces.id, workspaceId))
    .returning();

  if (!workspace) throw badRequest("No workspace for this account.");

  let scraped = false;
  if (url) {
    const site = await scrapeCompanySite(url.toString());
    if (site) {
      // Stored with a null accountId, which is what marks it as the seller's
      // own material — retrieval unions that with per-account documents, so it
      // reaches every brief without being attached to any one prospect.
      const [doc] = await db
        .insert(workspaceDocuments)
        .values({
          workspaceId: workspace.id,
          accountId: null,
          title: site.title ?? `${workspace.name} — website`,
          content: site.text,
          kind: "positioning",
        })
        .returning();

      await db
        .update(workspaces)
        .set({ description: site.text.slice(0, 2000), updatedAt: new Date() })
        .where(eq(workspaces.id, workspace.id));

      try {
        await indexDocument({
          workspaceId: workspace.id,
          accountId: null,
          sourceType: "workspace_doc",
          sourceId: doc.id,
          content: site.text,
        });
      } catch (error) {
        // Indexing can fail on a missing embedding provider; the document is
        // stored either way and a reindex will pick it up.
        console.error("Indexing the scraped site failed:", error);
      }
      scraped = true;
    }
  }

  return NextResponse.json({ ok: true, scraped });
});
