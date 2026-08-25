/** One account, with its contacts, meeting history, and quota state. */
import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";

import { db } from "@/db";
import { contacts, meetings } from "@/db/schema";
import { handler, requireOwnedAccount, requireUser } from "@/lib/api";
import { getUsage } from "@/lib/usage";

export const GET = handler(
  async (_request: Request, context: { params: Promise<{ id: string }> }) => {
    const user = await requireUser();
    const { id } = await context.params;
    const account = await requireOwnedAccount(user.id, id);

    const [accountContacts, accountMeetings, quota] = await Promise.all([
      db.select().from(contacts).where(eq(contacts.accountId, account.id)),
      db
        .select({
          id: meetings.id,
          title: meetings.title,
          scheduledAt: meetings.scheduledAt,
          status: meetings.status,
        })
        .from(meetings)
        .where(eq(meetings.accountId, account.id))
        .orderBy(desc(meetings.scheduledAt)),
      getUsage(account.id),
    ]);

    return NextResponse.json({
      account,
      contacts: accountContacts,
      meetings: accountMeetings,
      usage: quota,
    });
  },
);
