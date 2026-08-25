/**
 * Chat agent — question answering over one account's own history.
 *
 * Retrieval is filtered by `accountId` in SQL, so the model is only ever shown
 * material from the account being asked about. The prompt then forbids
 * answering from anything else.
 */
import { eq } from "drizzle-orm";
import type Anthropic from "@anthropic-ai/sdk";

import { db } from "@/db";
import { accounts, users } from "@/db/schema";
import { capabilities, llmClient, modelId, runText } from "@/lib/llm";
import { env } from "@/lib/env";
import {
  formatPlaybook,
  loadPlaybookSnippets,
  retrieveForAccount,
  type RetrievedChunk,
} from "@/lib/retrieval";
import { CHAT_SYSTEM } from "./prompts";

export type ChatTurn = { role: "user" | "assistant"; content: string };

export type ChatSource = {
  label: string;
  sourceType: RetrievedChunk["sourceType"];
  sourceId: string;
  similarity: number;
};

/** Human-readable label the model cites, e.g. `[Transcript — 2026-03-12]`. */
function labelFor(chunk: RetrievedChunk): string {
  const meta = chunk.meta ?? {};
  if (typeof meta.label === "string" && meta.label) return meta.label;

  const date =
    typeof meta.scheduledAt === "string" ? meta.scheduledAt.slice(0, 10) : "date unknown";
  const kind =
    chunk.sourceType === "transcript"
      ? "Transcript"
      : chunk.sourceType === "brief"
        ? "Brief"
        : chunk.sourceType === "summary"
          ? "Summary"
          : "Playbook";
  return `${kind} — ${date}`;
}

/**
 * Assemble the retrieved context.
 *
 * Chunks from the same source are grouped under one label so the model doesn't
 * cite the same call five different ways.
 */
function buildContextBlock(chunks: RetrievedChunk[], playbook: string): string {
  if (chunks.length === 0 && !playbook) {
    return "No material has been indexed for this account yet.";
  }

  const grouped = new Map<string, { label: string; parts: string[] }>();
  for (const chunk of chunks) {
    const label = labelFor(chunk);
    const entry = grouped.get(chunk.sourceId) ?? { label, parts: [] };
    entry.parts.push(chunk.content.trim());
    grouped.set(chunk.sourceId, entry);
  }

  const sections = [...grouped.values()].map(
    (entry) => `### [${entry.label}]\n${entry.parts.join("\n\n…\n\n")}`,
  );

  if (playbook) sections.push(`### [Playbook]\n${playbook}`);
  return sections.join("\n\n---\n\n");
}

function summariseSources(chunks: RetrievedChunk[]): ChatSource[] {
  const best = new Map<string, ChatSource>();
  for (const chunk of chunks) {
    const existing = best.get(chunk.sourceId);
    if (!existing || chunk.similarity > existing.similarity) {
      best.set(chunk.sourceId, {
        label: labelFor(chunk),
        sourceType: chunk.sourceType,
        sourceId: chunk.sourceId,
        similarity: chunk.similarity,
      });
    }
  }
  return [...best.values()].sort((a, b) => b.similarity - a.similarity);
}

type PreparedChat = {
  system: string;
  messages: Anthropic.MessageParam[];
  sources: ChatSource[];
};

/**
 * Retrieve, then assemble the request. Shared by the buffered and streaming
 * entry points so both see exactly the same context.
 */
async function prepare(input: {
  accountId: string;
  question: string;
  history?: ChatTurn[];
  topK?: number;
}): Promise<PreparedChat> {
  const account = await db.query.accounts.findFirst({ where: eq(accounts.id, input.accountId) });
  if (!account) throw new Error(`Account ${input.accountId} not found`);

  const owner = await db.query.users.findFirst({ where: eq(users.id, account.ownerUserId) });

  // Retrieve against the question plus recent turns, so a follow-up like
  // "what about pricing?" still carries the subject of the conversation.
  const recent = (input.history ?? []).slice(-4).map((turn) => turn.content);
  const retrievalQuery = [...recent, input.question].join("\n");

  const chunks = await retrieveForAccount(input.accountId, retrievalQuery, {
    topK: input.topK ?? env().RETRIEVAL_TOP_K,
  });

  const playbook = owner
    ? formatPlaybook(
        await loadPlaybookSnippets({
          ownerUserId: owner.id,
          accountId: account.id,
          audience: "chat",
          industry: account.industry,
        }),
      )
    : "";

  const accountHeader = [
    `You are answering questions about this account:`,
    `- Company: ${account.companyName} (${account.domain})`,
    account.industry ? `- Industry: ${account.industry}` : null,
    `- Deal stage: ${account.dealStage}`,
  ]
    .filter(Boolean)
    .join("\n");

  const contextTurn = [
    accountHeader,
    ``,
    `## Retrieved context from this account's history`,
    buildContextBlock(chunks, playbook),
  ].join("\n");

  const messages: Anthropic.MessageParam[] = [];
  for (const turn of input.history ?? []) {
    messages.push({ role: turn.role, content: turn.content });
  }
  messages.push({ role: "user", content: `${contextTurn}\n\n## Question\n${input.question}` });

  return { system: CHAT_SYSTEM, messages, sources: summariseSources(chunks) };
}

export type ChatAnswer = { answer: string; sources: ChatSource[] };

/** Buffered answer — used by tests and any non-streaming caller. */
export async function answerAccountQuestion(input: {
  accountId: string;
  question: string;
  history?: ChatTurn[];
  topK?: number;
}): Promise<ChatAnswer> {
  const prepared = await prepare(input);
  const result = await runText({
    system: prepared.system,
    messages: prepared.messages,
    // Chat answers are short; a lower effort keeps them fast and cheap.
    effort: "medium",
    maxTokens: 4000,
    cacheSystem: true,
  });
  return { answer: result.text, sources: prepared.sources };
}

/**
 * Streaming answer for the chat UI.
 *
 * Emits newline-delimited JSON: one `sources` event first so the UI can show
 * what it is drawing on, then `delta` events, then `done`.
 */
export async function streamAccountAnswer(input: {
  accountId: string;
  question: string;
  history?: ChatTurn[];
  topK?: number;
  /**
   * Called once the answer is complete, before `done` reaches the browser.
   *
   * Persisting belongs to the caller, but only this function knows when the
   * text is finished — and accumulating deltas a second time in the route would
   * mean two places could disagree about what the answer was.
   */
  onComplete?: (result: { answer: string; sources: ChatSource[] }) => Promise<void>;
}): Promise<ReadableStream<Uint8Array>> {
  const prepared = await prepare(input);
  const encoder = new TextEncoder();

  const caps = capabilities();
  const stream = llmClient().messages.stream({
    model: modelId(),
    max_tokens: 4000,
    system: caps.promptCaching
      ? [{ type: "text", text: prepared.system, cache_control: { type: "ephemeral" } }]
      : prepared.system,
    messages: prepared.messages,
    // Adaptive thinking and effort are Anthropic-only; sending them to GLM's
    // compatibility endpoint would be rejected.
    ...(caps.adaptiveThinking ? { thinking: { type: "adaptive" as const } } : {}),
    ...(caps.effort ? { output_config: { effort: "medium" as const } } : {}),
  });

  return new ReadableStream({
    async start(controller) {
      const send = (event: Record<string, unknown>) =>
        controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));

      try {
        send({ type: "sources", sources: prepared.sources });

        let answer = "";
        for await (const event of stream) {
          if (
            event.type === "content_block_delta" &&
            event.delta.type === "text_delta" &&
            event.delta.text
          ) {
            answer += event.delta.text;
            send({ type: "delta", text: event.delta.text });
          }
        }

        const final = await stream.finalMessage();
        if (final.stop_reason === "refusal") {
          send({ type: "error", message: "The model declined to answer this question." });
        }

        if (input.onComplete && answer.trim()) {
          try {
            await input.onComplete({ answer, sources: prepared.sources });
          } catch (error) {
            // The answer is already on screen; failing to file it must not turn
            // a good response into an error the rep sees.
            console.error("Persisting the chat answer failed:", error);
          }
        }

        send({ type: "done" });
      } catch (error) {
        send({
          type: "error",
          message: error instanceof Error ? error.message : "Chat failed unexpectedly.",
        });
      } finally {
        controller.close();
      }
    },
    cancel() {
      stream.abort();
    },
  });
}
