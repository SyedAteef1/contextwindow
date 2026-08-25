/**
 * LLM provider selection and capability flags.
 *
 * Z.ai exposes GLM through an Anthropic-compatible endpoint, so the same
 * `@anthropic-ai/sdk` client talks to both — only the base URL, the auth header,
 * and the model id change.
 *
 * What does *not* carry across is the newer, Anthropic-specific surface:
 * adaptive thinking, `output_config` (effort and schema-constrained output),
 * the hosted web-search tool, and `cache_control`. The compatibility layer
 * covers the core Messages contract — messages, streaming, and tool use — so
 * those are the primitives everything here is built on. This table is what
 * keeps unsupported parameters off a GLM request instead of letting the
 * endpoint reject them.
 */
import Anthropic from "@anthropic-ai/sdk";

import { ConfigurationError, env } from "@/lib/env";

export type LlmProvider = "anthropic" | "glm";

export type ProviderCapabilities = {
  /** `thinking: { type: "adaptive" }` */
  adaptiveThinking: boolean;
  /** `output_config: { effort }` */
  effort: boolean;
  /** `output_config: { format }` — schema-constrained responses. */
  nativeStructuredOutput: boolean;
  /** Anthropic-hosted `web_search_*` server tool. */
  hostedWebSearch: boolean;
  /** `cache_control: { type: "ephemeral" }` on system blocks. */
  promptCaching: boolean;
};

const CAPABILITIES: Record<LlmProvider, ProviderCapabilities> = {
  anthropic: {
    adaptiveThinking: true,
    effort: true,
    nativeStructuredOutput: true,
    hostedWebSearch: true,
    promptCaching: true,
  },
  glm: {
    // Everything below is Anthropic-specific and is not part of the
    // compatibility contract. Structured output is obtained through a forced
    // tool call instead, and search through GLM's own Web Search API.
    adaptiveThinking: false,
    effort: false,
    nativeStructuredOutput: false,
    hostedWebSearch: false,
    promptCaching: false,
  },
};

export function provider(): LlmProvider {
  return env().LLM_PROVIDER;
}

export function capabilities(): ProviderCapabilities {
  return CAPABILITIES[provider()];
}

/** The model id for the active provider. */
export function modelId(): string {
  const config = env();
  return config.LLM_PROVIDER === "glm" ? config.GLM_MODEL : config.ANTHROPIC_MODEL;
}

let cached: { key: string; client: Anthropic } | null = null;

/**
 * The SDK client for the active provider.
 *
 * GLM authenticates with `Authorization: Bearer`, which is what the SDK's
 * `authToken` option sends — `apiKey` would send `x-api-key` and be rejected.
 */
export function llmClient(): Anthropic {
  const config = env();
  const key = `${config.LLM_PROVIDER}:${config.GLM_BASE_URL}`;
  if (cached?.key === key) return cached.client;

  let client: Anthropic;
  if (config.LLM_PROVIDER === "glm") {
    if (!config.GLM_API_KEY) {
      throw new ConfigurationError(
        "LLM_PROVIDER=glm requires GLM_API_KEY. Create one at https://z.ai/manage-apikey/apikey-list.",
      );
    }
    client = new Anthropic({
      baseURL: config.GLM_BASE_URL,
      authToken: config.GLM_API_KEY,
    });
  } else {
    if (!config.ANTHROPIC_API_KEY) {
      throw new ConfigurationError(
        "LLM_PROVIDER=anthropic requires ANTHROPIC_API_KEY. Add it to your environment — see .env.example.",
      );
    }
    client = new Anthropic({ apiKey: config.ANTHROPIC_API_KEY });
  }

  cached = { key, client };
  return client;
}

/** Test seam: drop the memoised client so a provider switch takes effect. */
export function resetLlmClient(): void {
  cached = null;
}
