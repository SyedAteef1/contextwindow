/**
 * Provider-compatibility tests.
 *
 * The SDK is mocked so the request *shape* can be asserted without a key for
 * either vendor. What matters here is that Anthropic-only parameters never
 * reach GLM's compatibility endpoint, and that the guarantees those parameters
 * provide are reconstructed correctly when they are absent.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

const constructorCalls: Record<string, unknown>[] = [];
const createMock = vi.fn();
const parseMock = vi.fn();
const streamMock = vi.fn();

vi.mock("@anthropic-ai/sdk", () => {
  class MockAnthropic {
    messages = { create: createMock, parse: parseMock, stream: streamMock };
    constructor(options: Record<string, unknown>) {
      constructorCalls.push(options);
    }
  }
  return { default: MockAnthropic };
});

vi.mock("@anthropic-ai/sdk/helpers/zod", () => ({
  zodOutputFormat: (schema: unknown) => ({ type: "json_schema", schema }),
}));

const { runStructured, runText, capabilities, modelId, llmClient, resetLlmClient } =
  await import("@/lib/llm");
const { resetEnvCache } = await import("@/lib/env");

const SCHEMA = z.object({
  verdict: z.enum(["yes", "no"]),
  reason: z.string(),
  score: z.number(),
});

/** Pin the search backend, so a test never inherits one from the environment. */
function useSearch(backend: "serper" | "zai") {
  process.env.SEARCH_PROVIDER = backend;
  if (backend === "serper") process.env.SERPER_API_KEY = "serper-test-key";
  else delete process.env.SERPER_API_KEY;
  resetEnvCache();
}

function useProvider(name: "anthropic" | "glm") {
  process.env.LLM_PROVIDER = name;
  if (name === "glm") {
    process.env.GLM_API_KEY = "glm-test-key";
    process.env.GLM_MODEL = "glm-5.3";
  } else {
    process.env.ANTHROPIC_API_KEY = "sk-ant-test";
    process.env.ANTHROPIC_MODEL = "claude-sonnet-5";
  }
  resetEnvCache();
  resetLlmClient();
}

const originalEnv = { ...process.env };

beforeEach(() => {
  constructorCalls.length = 0;
  createMock.mockReset();
  parseMock.mockReset();
  streamMock.mockReset();
});

afterEach(() => {
  process.env = { ...originalEnv };
  resetEnvCache();
  resetLlmClient();
  vi.unstubAllGlobals();
});

describe("provider capabilities", () => {
  it("marks Anthropic-only features as unavailable on GLM", () => {
    useProvider("glm");
    expect(capabilities()).toEqual({
      adaptiveThinking: false,
      effort: false,
      nativeStructuredOutput: false,
      hostedWebSearch: false,
      promptCaching: false,
    });
    expect(modelId()).toBe("glm-5.3");
  });

  it("keeps them available on Anthropic", () => {
    useProvider("anthropic");
    expect(capabilities().nativeStructuredOutput).toBe(true);
    expect(modelId()).toBe("claude-sonnet-5");
  });
});

describe("client construction", () => {
  it("authenticates GLM with a bearer token against the compatible endpoint", () => {
    useProvider("glm");
    llmClient();

    const options = constructorCalls.at(-1)!;
    // GLM rejects `x-api-key`; the SDK's `authToken` is what sends Bearer.
    expect(options.authToken).toBe("glm-test-key");
    expect(options.apiKey).toBeUndefined();
    expect(options.baseURL).toBe("https://api.z.ai/api/anthropic");
  });

  it("authenticates Anthropic with an api key and no base URL override", () => {
    useProvider("anthropic");
    llmClient();

    const options = constructorCalls.at(-1)!;
    expect(options.apiKey).toBe("sk-ant-test");
    expect(options.baseURL).toBeUndefined();
  });

  it("raises a configuration error when the GLM key is missing", () => {
    process.env.LLM_PROVIDER = "glm";
    delete process.env.GLM_API_KEY;
    resetEnvCache();
    resetLlmClient();

    expect(() => llmClient()).toThrow(/GLM_API_KEY/);
  });
});

describe("runText on GLM", () => {
  it("sends no Anthropic-only parameters", async () => {
    useProvider("glm");
    createMock.mockResolvedValue({
      content: [{ type: "text", text: "A brief." }],
      usage: { input_tokens: 10, output_tokens: 5 },
      stop_reason: "end_turn",
    });

    await runText({
      system: "You are helpful.",
      messages: [{ role: "user", content: "Hello" }],
      cacheSystem: true,
      effort: "high",
    });

    const params = createMock.mock.calls[0][0];
    expect(params.model).toBe("glm-5.3");
    expect(params.thinking).toBeUndefined();
    expect(params.output_config).toBeUndefined();
    // Prompt caching is Anthropic-only, so the system prompt stays a plain
    // string rather than a block carrying cache_control.
    expect(typeof params.system).toBe("string");
  });

  it("runs web search as a client-side tool and cites what it found", async () => {
    useProvider("glm");
    useSearch("zai");

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        search_result: [
          {
            title: "Cobalt raises Series B",
            link: "https://example.com/cobalt-series-b",
            content: "Cobalt Systems announced a Series B in January.",
            media: "TechPress",
            publish_date: "2026-01-15",
          },
        ],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    createMock
      .mockResolvedValueOnce({
        content: [
          { type: "tool_use", id: "tu_1", name: "web_search", input: { query: "Cobalt Systems funding" } },
        ],
        usage: { input_tokens: 20, output_tokens: 10 },
        stop_reason: "tool_use",
      })
      .mockResolvedValueOnce({
        content: [{ type: "text", text: "Cobalt raised a Series B in January." }],
        usage: { input_tokens: 30, output_tokens: 12 },
        stop_reason: "end_turn",
      });

    const result = await runText({
      system: "Research this company.",
      messages: [{ role: "user", content: "Research Cobalt Systems" }],
      webSearch: true,
    });

    expect(result.text).toContain("Series B");
    // Citations come from the results we actually fetched, so they are exactly
    // the sources the model saw.
    expect(result.citations).toEqual([
      { title: "Cobalt raises Series B", url: "https://example.com/cobalt-series-b" },
    ]);
    // Usage is accumulated across the whole loop, not just the last call.
    expect(result.usage.inputTokens).toBe(50);

    // The search hit GLM's native REST surface, not the compatible endpoint.
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.z.ai/api/paas/v4/web_search");
    expect(JSON.parse(init.body).search_query).toBe("Cobalt Systems funding");

    // The tool result was fed back in a single user turn.
    const secondCall = createMock.mock.calls[1][0];
    const toolTurn = secondCall.messages.at(-1);
    expect(toolTurn.role).toBe("user");
    expect(toolTurn.content[0].type).toBe("tool_result");
    expect(toolTurn.content[0].tool_use_id).toBe("tu_1");
  });

  it("routes search through Serper when that backend is selected", async () => {
    useProvider("glm");
    useSearch("serper");

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        knowledgeGraph: {
          title: "Cobalt Systems",
          type: "Software company",
          website: "https://cobalt.io",
          attributes: { Founded: "2019" },
        },
        organic: [
          {
            title: "Cobalt raises Series B",
            link: "https://example.com/cobalt-series-b",
            snippet: "Cobalt Systems announced a Series B in January.",
            date: "2026-01-15",
          },
        ],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    createMock
      .mockResolvedValueOnce({
        content: [
          { type: "tool_use", id: "tu_1", name: "web_search", input: { query: "Cobalt Systems funding" } },
        ],
        usage: { input_tokens: 20, output_tokens: 10 },
        stop_reason: "tool_use",
      })
      .mockResolvedValueOnce({
        content: [{ type: "text", text: "Cobalt raised a Series B in January." }],
        usage: { input_tokens: 30, output_tokens: 12 },
        stop_reason: "end_turn",
      });

    const result = await runText({
      system: "Research this company.",
      messages: [{ role: "user", content: "Research Cobalt Systems" }],
      webSearch: true,
    });

    // Serper, not the model provider's own search surface.
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://google.serper.dev/search");
    expect(init.headers["X-API-KEY"]).toBe("serper-test-key");
    expect(JSON.parse(init.body).q).toBe("Cobalt Systems funding");

    // The knowledge panel is cited alongside the article, so structured facts
    // are attributable rather than appearing from nowhere.
    expect(result.citations).toEqual([
      { title: "Cobalt Systems — knowledge panel", url: "https://cobalt.io" },
      { title: "Cobalt raises Series B", url: "https://example.com/cobalt-series-b" },
    ]);
  });

  it("keeps going when a search fails rather than aborting the brief", async () => {
    useProvider("glm");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 500, text: async () => "upstream down" }),
    );

    createMock
      .mockResolvedValueOnce({
        content: [{ type: "tool_use", id: "tu_1", name: "web_search", input: { query: "x" } }],
        usage: { input_tokens: 5, output_tokens: 5 },
        stop_reason: "tool_use",
      })
      .mockResolvedValueOnce({
        content: [{ type: "text", text: "No public information found." }],
        usage: { input_tokens: 5, output_tokens: 5 },
        stop_reason: "end_turn",
      });

    const result = await runText({
      system: "Research.",
      messages: [{ role: "user", content: "Research" }],
      webSearch: true,
    });

    expect(result.text).toContain("No public information found");
    const toolResult = createMock.mock.calls[1][0].messages.at(-1).content[0];
    expect(toolResult.is_error).toBe(true);
    expect(toolResult.content).toContain("Search failed");
  });
});

describe("runStructured on GLM", () => {
  it("forces a tool call and returns the validated object", async () => {
    useProvider("glm");
    createMock.mockResolvedValue({
      content: [
        {
          type: "tool_use",
          id: "tu_1",
          name: "emit_result",
          input: { verdict: "yes", reason: "Because.", score: 0.9 },
        },
      ],
      usage: { input_tokens: 10, output_tokens: 5 },
      stop_reason: "tool_use",
    });

    const result = await runStructured({
      system: "Extract.",
      messages: [{ role: "user", content: "Go" }],
      schema: SCHEMA,
    });

    expect(result).toEqual({ verdict: "yes", reason: "Because.", score: 0.9 });

    const params = createMock.mock.calls[0][0];
    expect(params.tool_choice).toEqual({ type: "tool", name: "emit_result" });
    expect(params.tools[0].input_schema.type).toBe("object");
    // `$schema` is JSON Schema tooling metadata and is not valid here.
    expect(params.tools[0].input_schema.$schema).toBeUndefined();
    expect(Object.keys(params.tools[0].input_schema.properties)).toEqual([
      "verdict",
      "reason",
      "score",
    ]);
  });

  it("rejects a response that does not match the schema", async () => {
    useProvider("glm");
    createMock.mockResolvedValue({
      content: [
        {
          type: "tool_use",
          id: "tu_1",
          name: "emit_result",
          // `verdict` is not in the enum and `score` is the wrong type.
          input: { verdict: "maybe", reason: "Unsure.", score: "high" },
        },
      ],
      usage: { input_tokens: 10, output_tokens: 5 },
      stop_reason: "tool_use",
    });

    await expect(
      runStructured({ system: "Extract.", messages: [{ role: "user", content: "Go" }], schema: SCHEMA }),
    ).rejects.toThrow(/did not match the schema/);
  });

  it("errors clearly when the model answers in prose instead of calling the tool", async () => {
    useProvider("glm");
    createMock.mockResolvedValue({
      content: [{ type: "text", text: "Sure, the verdict is yes." }],
      usage: { input_tokens: 10, output_tokens: 5 },
      stop_reason: "end_turn",
    });

    await expect(
      runStructured({ system: "Extract.", messages: [{ role: "user", content: "Go" }], schema: SCHEMA }),
    ).rejects.toThrow(/no emit_result tool call/);
  });
});

describe("runStructured on Anthropic", () => {
  it("uses the native schema-constrained path", async () => {
    useProvider("anthropic");
    parseMock.mockResolvedValue({
      parsed_output: { verdict: "no", reason: "Nope.", score: 0.1 },
      stop_reason: "end_turn",
    });

    const result = await runStructured({
      system: "Extract.",
      messages: [{ role: "user", content: "Go" }],
      schema: SCHEMA,
    });

    expect(result.verdict).toBe("no");
    // Native path — no tool call involved.
    expect(createMock).not.toHaveBeenCalled();

    const params = parseMock.mock.calls[0][0];
    expect(params.output_config.format).toBeDefined();
    expect(params.thinking).toEqual({ type: "adaptive" });
  });
});
