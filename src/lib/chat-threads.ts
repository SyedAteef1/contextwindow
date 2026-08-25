/**
 * Saved chat conversations, per account.
 *
 * Ownership always travels through the account: a thread is reachable only by
 * the rep who owns the account it belongs to, checked at the query rather than
 * trusted from the caller.
 */
import { and, asc, desc, eq } from "drizzle-orm";

import { db } from "@/db";
import { accounts, chatMessages, chatThreads, type ChatMessageSource } from "@/db/schema";

/** How much history the model is given. Older turns stay readable on screen. */
const HISTORY_TURNS = 20;

/**
 * A title from the opening question.
 *
 * Trimmed at a word boundary so it reads as a phrase rather than a truncation,
 * which is the difference between a scannable sidebar and a column of ellipses.
 */
export function titleFromQuestion(question: string): string {
  const cleaned = question.trim().replace(/\s+/g, " ");
  if (cleaned.length <= 48) return cleaned;
  const cut = cleaned.slice(0, 48);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > 24 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}

export async function listThreads(userId: string, accountId: string) {
  return db
    .select({
      id: chatThreads.id,
      title: chatThreads.title,
      lastMessageAt: chatThreads.lastMessageAt,
    })
    .from(chatThreads)
    .innerJoin(accounts, eq(accounts.id, chatThreads.accountId))
    .where(and(eq(chatThreads.accountId, accountId), eq(accounts.ownerUserId, userId)))
    .orderBy(desc(chatThreads.lastMessageAt));
}

/** A thread with its messages, or null when it is not this rep's to read. */
export async function loadThread(userId: string, threadId: string) {
  const [thread] = await db
    .select({
      id: chatThreads.id,
      accountId: chatThreads.accountId,
      title: chatThreads.title,
    })
    .from(chatThreads)
    .innerJoin(accounts, eq(accounts.id, chatThreads.accountId))
    .where(and(eq(chatThreads.id, threadId), eq(accounts.ownerUserId, userId)))
    .limit(1);
  if (!thread) return null;

  const messages = await db
    .select()
    .from(chatMessages)
    .where(eq(chatMessages.threadId, thread.id))
    .orderBy(asc(chatMessages.createdAt));

  return { ...thread, messages };
}

export async function createThread(input: {
  accountId: string;
  ownerUserId: string;
  title: string;
}) {
  const [thread] = await db.insert(chatThreads).values(input).returning();
  return thread;
}

export async function appendMessage(input: {
  threadId: string;
  role: "user" | "assistant";
  content: string;
  sources?: ChatMessageSource[];
}) {
  const [message] = await db
    .insert(chatMessages)
    .values({
      threadId: input.threadId,
      role: input.role,
      content: input.content,
      sources: input.sources ?? null,
    })
    .returning();

  // Sorts the sidebar by activity rather than by creation.
  await db
    .update(chatThreads)
    .set({ lastMessageAt: new Date(), updatedAt: new Date() })
    .where(eq(chatThreads.id, input.threadId));

  return message;
}

/** Prior turns for the model, oldest first and bounded. */
export async function historyForModel(threadId: string) {
  const rows = await db
    .select({ role: chatMessages.role, content: chatMessages.content })
    .from(chatMessages)
    .where(eq(chatMessages.threadId, threadId))
    .orderBy(desc(chatMessages.createdAt))
    .limit(HISTORY_TURNS);
  return rows.reverse();
}
