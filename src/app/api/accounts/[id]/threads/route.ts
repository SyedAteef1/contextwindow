/**
 * The conversations saved against one account.
 *
 * Listing is all this needs to do — threads are created by asking the first
 * question, not by pressing "new", so an empty thread can never exist.
 */
import { NextResponse } from "next/server";

import { handler, requireOwnedAccount, requireUser } from "@/lib/api";
import { listThreads } from "@/lib/chat-threads";

export const GET = handler(
  async (_request: Request, context: { params: Promise<{ id: string }> }) => {
    const user = await requireUser();
    const { id } = await context.params;
    await requireOwnedAccount(user.id, id);
    return NextResponse.json({ threads: await listThreads(user.id, id) });
  },
);
