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
import { workspaces } from "@/db/schema";
import { badRequest, handler, requireUser } from "@/lib/api";
import { normaliseUrl } from "@/lib/scrape";
import { ingestCompanyWebsite } from "@/lib/company-profile";
import { syncUserCalendar } from "@/lib/pipeline/calendar-sync";
import { startCalendarWatch } from "@/lib/google/calendar-watch";


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

  // One read, understood rather than stored raw. Awaited because the rep is
  // watching a spinner they expect: this is the ten seconds that decides
  // whether their first brief sounds like their company or like nobody's.
  let scraped = false;
  if (url) {
    const result = await ingestCompanyWebsite({
      workspaceId: workspace.id,
      name: workspace.name,
      url: url.toString(),
    });
    scraped = result.scraped;
  }

  /*
   * The first sync, started here rather than waited for.
   *
   * The scheduler already polls every five minutes, so a calendar is never
   * stale — but a brand new rep would spend those five minutes looking at an
   * empty dashboard wondering whether anything worked, which is the worst
   * possible first impression of a product whose whole claim is that it
   * arrives before you ask.
   *
   * Not awaited, because it fetches a calendar and can write briefs: that is
   * tens of seconds, and nobody should sit on a spinner for it. The dashboard
   * knows how to show that a first sync is running.
   */
  void syncUserCalendar(user.id).catch((error) => {
    console.error(`First calendar sync for ${user.id} failed:`, error);
  });

  /*
   * And ask Google to tell us about changes from here on, so a call booked
   * this afternoon is researched in seconds rather than at the next poll.
   *
   * Not fatal if it fails. Google refuses to open a channel until the
   * receiving domain is verified, and a deployment without that should still
   * work — five minutes late — rather than refuse to onboard anyone.
   */
  void startCalendarWatch(user.id).catch((error) => {
    console.error(`Opening a calendar watch for ${user.id} failed:`, error);
  });

  return NextResponse.json({ ok: true, scraped });
});
