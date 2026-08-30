/**
 * "Tell me what Pro costs."
 *
 * A request rather than a checkout, because the price depends on what a team
 * connects and every one of them gets engineers for setup. Quoting before
 * anyone has asked what they need would be guessing out loud.
 *
 * One open request per workspace. Pressing the button twice is an anxious rep,
 * not two teams, and a queue full of duplicates makes the real ones harder to
 * see — so a second press updates the first rather than adding to it.
 */
import { NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";

import { db } from "@/db";
import { quoteRequests, workspaces } from "@/db/schema";
import { badRequest, handler, requireUser } from "@/lib/api";
import { track } from "@/lib/activity";
import { notify } from "@/lib/notify";
import { planForUser } from "@/lib/usage";

export const POST = handler(async (request: Request) => {
  const user = await requireUser();
  if (!user.workspaceId) throw badRequest("No workspace for this account.");
  const workspaceId = user.workspaceId;

  const body = (await request.json().catch(() => null)) as {
    seats?: number | string;
    note?: string;
  } | null;

  const seatsRaw = Number(body?.seats);
  const seats = Number.isFinite(seatsRaw) && seatsRaw > 0 ? Math.min(Math.round(seatsRaw), 10_000) : null;
  const note = body?.note?.trim().slice(0, 2000) || null;

  const [workspace] = await db
    .select()
    .from(workspaces)
    .where(eq(workspaces.id, workspaceId))
    .limit(1);
  if (!workspace) throw badRequest("No workspace for this account.");

  const [open] = await db
    .select()
    .from(quoteRequests)
    .where(and(eq(quoteRequests.workspaceId, workspaceId), eq(quoteRequests.status, "requested")))
    .orderBy(desc(quoteRequests.createdAt))
    .limit(1);

  const [saved] = open
    ? await db
        .update(quoteRequests)
        .set({ seats, note, userId: user.id })
        .where(eq(quoteRequests.id, open.id))
        .returning()
    : await db
        .insert(quoteRequests)
        .values({ workspaceId, userId: user.id, seats, note })
        .returning();

  track({
    userId: user.id,
    action: "upgrade_requested",
    subjectType: "workspace",
    subjectId: workspaceId,
    detail: seats ? { seats } : {},
  });

  // Only the first time. A rep amending their seat count is not news.
  if (!open) {
    notify({
      kind: "quote_request",
      email: user.email,
      company: workspace.name,
      seats,
      note,
      plan: await planForUser(user.id),
    });
  }

  return NextResponse.json({ request: saved });
});
