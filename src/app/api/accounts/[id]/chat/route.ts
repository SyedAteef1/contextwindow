/**
 * Chat with the account's history.
 *
 * Streams newline-delimited JSON: a `sources` event, then `delta` events, then
 * `done`. Ownership is checked before retrieval, so a rep can only ever query
 * an account that is theirs.
 */
import { z } from "zod";

import { streamAccountAnswer } from "@/agents/chat";
import { handler, notFound, readJson, requireOwnedAccount, requireUser } from "@/lib/api";
import {
  appendMessage,
  createThread,
  historyForModel,
  loadThread,
  titleFromQuestion,
} from "@/lib/chat-threads";

const bodySchema = z.object({
  question: z.string().min(1, "Question cannot be empty").max(4000),
  /** Continue a saved conversation. Omitted, a new one is opened. */
  threadId: z.uuid().optional(),
});

export const POST = handler(
  async (request: Request, context: { params: Promise<{ id: string }> }) => {
    const user = await requireUser();
    const { id } = await context.params;
    const account = await requireOwnedAccount(user.id, id);

    const body = await readJson(request, (value) => bodySchema.parse(value));

    // Continue the named thread, or open one titled from this first question.
    let threadId = body.threadId;
    if (threadId) {
      const existing = await loadThread(user.id, threadId);
      if (!existing || existing.accountId !== account.id) {
        throw notFound("Conversation not found");
      }
    } else {
      const created = await createThread({
        accountId: account.id,
        ownerUserId: user.id,
        title: titleFromQuestion(body.question),
      });
      threadId = created.id;
    }

    // History comes from the thread rather than the request, so it cannot be
    // rewritten by the caller and survives a refresh.
    const history = await historyForModel(threadId);
    await appendMessage({ threadId, role: "user", content: body.question });

    const stream = await streamAccountAnswer({
      accountId: account.id,
      question: body.question,
      history,
      onComplete: async ({ answer, sources }) => {
        await appendMessage({ threadId, role: "assistant", content: answer, sources });
      },
    });

    return new Response(stream, {
      headers: {
        // Lets the browser attach a brand-new conversation to the sidebar
        // without waiting for the answer to finish.
        "X-Thread-Id": threadId,
        "Content-Type": "application/x-ndjson; charset=utf-8",
        "Cache-Control": "no-store",
        // Streaming through a proxy that buffers would defeat the point.
        "X-Accel-Buffering": "no",
      },
    });
  },
);
