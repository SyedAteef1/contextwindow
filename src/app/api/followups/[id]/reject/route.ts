/** Dismiss a drafted follow-up. Nothing external happens. */
import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { followupProposals } from "@/db/schema";
import { badRequest, handler, notFound, requireOwnedAccount, requireUser } from "@/lib/api";
import { track } from "@/lib/activity";

export const POST = handler(
  async (_request: Request, context: { params: Promise<{ id: string }> }) => {
    const user = await requireUser();
    const { id } = await context.params;

    const proposal = await db.query.followupProposals.findFirst({
      where: eq(followupProposals.id, id),
    });
    if (!proposal) throw notFound("Follow-up proposal not found");
    await requireOwnedAccount(user.id, proposal.accountId);

    const [updated] = await db
      .update(followupProposals)
      .set({ status: "rejected", updatedAt: new Date() })
      .where(and(eq(followupProposals.id, proposal.id), eq(followupProposals.status, "pending")))
      .returning();

    if (!updated) throw badRequest("This follow-up was already actioned.");
    track({
      userId: user.id,
      action: "followup_rejected",
      subjectType: "meeting",
      subjectId: updated.meetingId,
    });

    return NextResponse.json({ proposal: updated });
  },
);
