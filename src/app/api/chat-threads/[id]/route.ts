/**
 * One saved conversation: read it back, rename it, or delete it.
 *
 * Ownership is checked by `loadThread`, which joins through the account, so a
 * thread id guessed from elsewhere resolves to nothing rather than to someone
 * else's conversation.
 */
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db";
import { chatThreads } from "@/db/schema";
import { handler, notFound, readJson, requireUser } from "@/lib/api";
import { loadThread } from "@/lib/chat-threads";

export const GET = handler(
  async (_request: Request, context: { params: Promise<{ id: string }> }) => {
    const user = await requireUser();
    const { id } = await context.params;
    const thread = await loadThread(user.id, id);
    if (!thread) throw notFound("Conversation not found");
    return NextResponse.json({ thread });
  },
);

const patchSchema = z.object({ title: z.string().min(1).max(120) });

export const PATCH = handler(
  async (request: Request, context: { params: Promise<{ id: string }> }) => {
    const user = await requireUser();
    const { id } = await context.params;
    const thread = await loadThread(user.id, id);
    if (!thread) throw notFound("Conversation not found");

    const { title } = await readJson(request, (value) => patchSchema.parse(value));
    const [updated] = await db
      .update(chatThreads)
      .set({ title, updatedAt: new Date() })
      .where(eq(chatThreads.id, thread.id))
      .returning();
    return NextResponse.json({ thread: updated });
  },
);

export const DELETE = handler(
  async (_request: Request, context: { params: Promise<{ id: string }> }) => {
    const user = await requireUser();
    const { id } = await context.params;
    const thread = await loadThread(user.id, id);
    if (!thread) throw notFound("Conversation not found");

    // Messages cascade with the thread.
    await db.delete(chatThreads).where(eq(chatThreads.id, thread.id));
    return NextResponse.json({ deleted: true });
  },
);
