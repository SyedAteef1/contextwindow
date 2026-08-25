/**
 * The two call shapes every agent uses, across both providers.
 *
 * `runText`       — prose out (briefs, summaries, chat answers).
 * `runStructured` — a validated object out (intent signals, follow-up drafts).
 *
 * On Anthropic these use adaptive thinking, effort, and schema-constrained
 * output. On GLM those parameters do not exist, so the same guarantees are
 * reconstructed from the primitives the compatibility layer does support:
 * structured output becomes a forced tool call validated against the same Zod
 * schema, and web search becomes a client-side tool. Callers see no difference.
 */
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";

import { env } from "@/lib/env";
import {
  WEB_SEARCH_TOOL,
  WEB_SEARCH_TOOL_NAME,
  formatSearchResults,
  webSearch,
  type SearchRecency,
} from "@/lib/search";

const RECENCY_VALUES: SearchRecency[] = [
  "noLimit",
  "oneYear",
  "oneMonth",
  "oneWeek",
  "oneDay",
];
import { capabilities, llmClient, modelId, provider } from "./providers";

export { capabilities, llmClient, modelId, provider, resetLlmClient } from "./providers";

export type Effort = "low" | "medium" | "high" | "xhigh" | "max";

export type Citation = { title: string; url: string };

export type RunOptions = {
  system: string;
  messages: Anthropic.MessageParam[];
  maxTokens?: number;
  effort?: Effort;
  /** Ask for web search. How it is provided depends on the provider. */
  webSearch?: boolean;
  /** Cache the system prefix where the provider supports it. */
  cacheSystem?: boolean;
};

export type TextResult = {
  text: string;
  citations: Citation[];
  usage: { inputTokens: number; outputTokens: number };
  stopReason: string | null;
};

/** Anthropic's current hosted search tool. Dynamic filtering is built in. */
const HOSTED_WEB_SEARCH: Anthropic.WebSearchTool20260209 = {
  type: "web_search_20260209",
  name: "web_search",
  max_uses: 8,
};

/** How many client-side tool round trips a single turn may take. */
const MAX_TOOL_ITERATIONS = 8;

function systemParam(system: string, cache: boolean): Anthropic.MessageCreateParams["system"] {
  if (!cache || !capabilities().promptCaching) return system;
  return [{ type: "text", text: system, cache_control: { type: "ephemeral" } }];
}

/** Parameters that only exist on Anthropic, omitted entirely elsewhere. */
function tuningParams(effort: Effort | undefined) {
  const caps = capabilities();
  const params: Record<string, unknown> = {};
  if (caps.adaptiveThinking) params.thinking = { type: "adaptive" };
  if (caps.effort) params.output_config = { effort: effort ?? env().ANTHROPIC_EFFORT };
  return params;
}

function joinText(content: Anthropic.ContentBlock[]): string {
  return content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("")
    .trim();
}

/** Sources Anthropic consulted, from server-tool results and inline citations. */
function collectHostedCitations(content: Anthropic.ContentBlock[]): Citation[] {
  const seen = new Map<string, string>();

  for (const block of content) {
    if (block.type === "web_search_tool_result") {
      const results = block.content;
      // On error `content` is a single object rather than a list of results.
      if (Array.isArray(results)) {
        for (const result of results) {
          if (result.type === "web_search_result" && result.url) {
            seen.set(result.url, result.title || result.url);
          }
        }
      }
      continue;
    }

    if (block.type === "text") {
      for (const citation of block.citations ?? []) {
        if ("url" in citation && typeof citation.url === "string" && citation.url) {
          const title =
            ("title" in citation && typeof citation.title === "string" && citation.title) ||
            citation.url;
          seen.set(citation.url, title);
        }
      }
    }
  }

  return [...seen.entries()].map(([url, title]) => ({ title, url }));
}

// --------------------------------------------------------------------------
// Text
// --------------------------------------------------------------------------

export async function runText(options: RunOptions): Promise<TextResult> {
  return provider() === "glm" ? runTextWithClientTools(options) : runTextOnAnthropic(options);
}

/**
 * Anthropic path.
 *
 * Streams, because briefs and summaries are long enough to risk an HTTP
 * timeout. A turn using server tools can stop with `pause_turn`; it is resumed
 * rather than returned truncated.
 */
async function runTextOnAnthropic(options: RunOptions): Promise<TextResult> {
  const config = env();
  const messages: Anthropic.MessageParam[] = [...options.messages];

  const content: Anthropic.ContentBlock[] = [];
  let inputTokens = 0;
  let outputTokens = 0;
  let stopReason: string | null = null;

  const maxRestarts = config.ANTHROPIC_MAX_PAUSE_RESTARTS;
  for (let attempt = 0; attempt <= maxRestarts; attempt++) {
    const stream = llmClient().messages.stream({
      model: modelId(),
      max_tokens: options.maxTokens ?? config.ANTHROPIC_MAX_TOKENS,
      system: systemParam(options.system, options.cacheSystem ?? false),
      messages,
      ...tuningParams(options.effort),
      ...(options.webSearch ? { tools: [HOSTED_WEB_SEARCH] } : {}),
    });

    const message = await stream.finalMessage();
    content.push(...message.content);
    inputTokens += message.usage.input_tokens;
    outputTokens += message.usage.output_tokens;
    stopReason = message.stop_reason;

    if (message.stop_reason !== "pause_turn") break;

    messages.push({ role: "assistant", content: message.content });
    if (attempt === maxRestarts) {
      throw new Error(
        `Turn still paused after ${maxRestarts} resumes; refusing to return a truncated result.`,
      );
    }
  }

  if (stopReason === "refusal") {
    throw new Error("The model declined this request (stop_reason: refusal).");
  }

  return {
    text: joinText(content),
    citations: collectHostedCitations(content),
    usage: { inputTokens, outputTokens },
    stopReason,
  };
}

/**
 * GLM path: a manual tool loop.
 *
 * Search runs here rather than on the provider's side, so citations are
 * collected from the results we fetched — which makes them exactly the sources
 * the model was shown.
 */
async function runTextWithClientTools(options: RunOptions): Promise<TextResult> {
  const config = env();
  const messages: Anthropic.MessageParam[] = [...options.messages];
  const citations = new Map<string, string>();

  let inputTokens = 0;
  let outputTokens = 0;
  let stopReason: string | null = null;
  let finalText = "";

  const tools = options.webSearch ? [WEB_SEARCH_TOOL] : undefined;

  for (let iteration = 0; iteration < MAX_TOOL_ITERATIONS; iteration++) {
    const message = await llmClient().messages.create({
      model: modelId(),
      max_tokens: options.maxTokens ?? config.ANTHROPIC_MAX_TOKENS,
      system: systemParam(options.system, options.cacheSystem ?? false),
      messages,
      ...(tools ? { tools } : {}),
    });

    inputTokens += message.usage.input_tokens;
    outputTokens += message.usage.output_tokens;
    stopReason = message.stop_reason;

    if (message.stop_reason === "refusal") {
      throw new Error("The model declined this request (stop_reason: refusal).");
    }

    const toolUses = message.content.filter(
      (block): block is Anthropic.ToolUseBlock => block.type === "tool_use",
    );

    if (toolUses.length === 0) {
      finalText = joinText(message.content);
      break;
    }

    messages.push({ role: "assistant", content: message.content });

    // Run every requested search concurrently, then return all results in a
    // single user turn — splitting them teaches the model to stop batching.
    const results = await Promise.all(
      toolUses.map(async (toolUse): Promise<Anthropic.ToolResultBlockParam> => {
        if (toolUse.name !== WEB_SEARCH_TOOL_NAME) {
          return {
            type: "tool_result",
            tool_use_id: toolUse.id,
            content: `Unknown tool "${toolUse.name}".`,
            is_error: true,
          };
        }

        const input = toolUse.input as { query?: string; recency?: string };
        if (!input?.query) {
          return {
            type: "tool_result",
            tool_use_id: toolUse.id,
            content: "The `query` field is required.",
            is_error: true,
          };
        }

        try {
          // The model supplies `recency` as free text; anything outside the
          // enum is treated as no restriction rather than passed through.
          const recency = RECENCY_VALUES.includes(input.recency as SearchRecency)
            ? (input.recency as SearchRecency)
            : undefined;
          const found = await webSearch(input.query, { recency });
          for (const result of found) {
            if (result.link) citations.set(result.link, result.title || result.link);
          }
          return {
            type: "tool_result",
            tool_use_id: toolUse.id,
            content: formatSearchResults(found),
          };
        } catch (error) {
          // A failed search must not abort the turn — the model can carry on
          // and say what it could not verify, which is what the prompt asks.
          return {
            type: "tool_result",
            tool_use_id: toolUse.id,
            content: `Search failed: ${error instanceof Error ? error.message : String(error)}`,
            is_error: true,
          };
        }
      }),
    );

    messages.push({ role: "user", content: results });
  }

  if (!finalText && stopReason === "tool_use") {
    throw new Error(
      `The model was still calling tools after ${MAX_TOOL_ITERATIONS} rounds; refusing to return a partial result.`,
    );
  }

  return {
    text: finalText,
    citations: [...citations.entries()].map(([url, title]) => ({ title, url })),
    usage: { inputTokens, outputTokens },
    stopReason,
  };
}

// --------------------------------------------------------------------------
// Structured
// --------------------------------------------------------------------------

export type StructuredOptions<T extends z.ZodType> = Omit<RunOptions, "webSearch"> & {
  schema: T;
};

/**
 * One structured turn, validated against `schema` before the caller sees it.
 *
 * Anthropic constrains the response format natively. GLM has no equivalent on
 * the compatibility endpoint — its own JSON mode lives on a different API and
 * only promises *valid JSON*, not JSON matching a schema — so a forced tool
 * call does the work instead. Either way the result is parsed through the same
 * Zod schema, so a malformed response is an error rather than bad data.
 */
export async function runStructured<T extends z.ZodType>(
  options: StructuredOptions<T>,
): Promise<z.infer<T>> {
  return capabilities().nativeStructuredOutput
    ? runStructuredNative(options)
    : runStructuredViaTool(options);
}

async function runStructuredNative<T extends z.ZodType>(
  options: StructuredOptions<T>,
): Promise<z.infer<T>> {
  const config = env();

  const response = await llmClient().messages.parse({
    model: modelId(),
    max_tokens: options.maxTokens ?? config.ANTHROPIC_MAX_TOKENS,
    system: systemParam(options.system, options.cacheSystem ?? false),
    messages: options.messages,
    ...tuningParams(options.effort),
    output_config: {
      ...(capabilities().effort ? { effort: options.effort ?? config.ANTHROPIC_EFFORT } : {}),
      format: zodOutputFormat(options.schema),
    },
  });

  if (response.stop_reason === "refusal") {
    throw new Error("The model declined this request (stop_reason: refusal).");
  }
  if (!response.parsed_output) {
    throw new Error("The model returned no parseable structured output.");
  }
  return response.parsed_output as z.infer<T>;
}

const RESULT_TOOL_NAME = "emit_result";

async function runStructuredViaTool<T extends z.ZodType>(
  options: StructuredOptions<T>,
): Promise<z.infer<T>> {
  const config = env();

  const jsonSchema = z.toJSONSchema(options.schema, { io: "output" }) as Record<string, unknown>;
  // `$schema` is meaningful to JSON Schema tooling but not to the tool API.
  delete jsonSchema.$schema;

  const response = await llmClient().messages.create({
    model: modelId(),
    max_tokens: options.maxTokens ?? config.ANTHROPIC_MAX_TOKENS,
    system: systemParam(options.system, options.cacheSystem ?? false),
    messages: options.messages,
    tools: [
      {
        name: RESULT_TOOL_NAME,
        description: "Return the result. Call this exactly once, with every required field filled in.",
        input_schema: jsonSchema as Anthropic.Tool["input_schema"],
      },
    ],
    // Forcing the tool is what turns "please reply as JSON" into a guarantee
    // that a structured payload comes back at all.
    tool_choice: { type: "tool", name: RESULT_TOOL_NAME },
  });

  if (response.stop_reason === "refusal") {
    throw new Error("The model declined this request (stop_reason: refusal).");
  }

  const toolUse = response.content.find(
    (block): block is Anthropic.ToolUseBlock =>
      block.type === "tool_use" && block.name === RESULT_TOOL_NAME,
  );
  if (!toolUse) {
    throw new Error(
      `The model returned no ${RESULT_TOOL_NAME} tool call (stop_reason: ${response.stop_reason}).`,
    );
  }

  const parsed = options.schema.safeParse(toolUse.input);
  if (!parsed.success) {
    throw new Error(
      `The model's structured output did not match the schema: ${z.prettifyError(parsed.error)}`,
    );
  }
  return parsed.data as z.infer<T>;
}
