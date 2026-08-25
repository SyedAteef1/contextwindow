/**
 * The fast lane: a second model, used only where latency is the constraint.
 *
 * Mid-call answers and post-call summaries are different jobs. A summary
 * generates hundreds of tokens and nobody minds waiting forty seconds. An
 * answer on the rep's screen is useless the moment the conversation moves on,
 * which is roughly a second.
 *
 * So this is a deliberately minimal client — OpenAI-compatible chat
 * completions over plain fetch, streaming, no tools, no structured output. It
 * exists to put the first words on screen quickly and nothing else. Everything
 * else keeps using the main provider.
 *
 * These providers are OpenAI-compatible rather than Anthropic-compatible,
 * which is why this does not reuse the SDK path in `./index.ts`.
 */
import { ConfigurationError, env } from "@/lib/env";

export type FastResult = {
  text: string;
  /** Milliseconds to the first token — what the rep actually perceives. */
  firstTokenMs: number | null;
  totalMs: number;
  model: string;
  /** False when the fast lane was unavailable and the caller should fall back. */
  ok: boolean;
};

export function fastLaneEnabled(): boolean {
  return env().FAST_LLM_PROVIDER !== "none";
}

/** Base URL and key for the configured provider, with explicit overrides winning. */
export function fastLaneTarget(): { baseUrl: string | null; apiKey: string | null } {
  const config = env();
  const presets: Record<string, { baseUrl: string; apiKey?: string }> = {
    cerebras: { baseUrl: config.CEREBRAS_BASE_URL, apiKey: config.CEREBRAS_API_KEY },
    openrouter: { baseUrl: config.OPENROUTER_BASE_URL, apiKey: config.OPENROUTER_API_KEY },
  };
  const preset = presets[config.FAST_LLM_PROVIDER];

  return {
    baseUrl: config.FAST_LLM_BASE_URL ?? preset?.baseUrl ?? null,
    apiKey: config.FAST_LLM_API_KEY ?? preset?.apiKey ?? null,
  };
}

/** Why the fast lane is off, phrased for whoever has to fix it. */
export function fastLaneUnavailableReason(): string | null {
  const config = env();
  if (config.FAST_LLM_PROVIDER === "none") {
    return "FAST_LLM_PROVIDER is `none`; live answers use the main model.";
  }

  const { baseUrl, apiKey } = fastLaneTarget();
  if (!baseUrl) {
    return `FAST_LLM_PROVIDER=${config.FAST_LLM_PROVIDER} requires FAST_LLM_BASE_URL.`;
  }
  if (!apiKey) {
    const expected =
      config.FAST_LLM_PROVIDER === "cerebras"
        ? "CEREBRAS_API_KEY"
        : config.FAST_LLM_PROVIDER === "openrouter"
          ? "OPENROUTER_API_KEY"
          : "FAST_LLM_API_KEY";
    return `FAST_LLM_PROVIDER=${config.FAST_LLM_PROVIDER} requires ${expected}.`;
  }
  return null;
}

type StreamChunk = {
  choices?: { delta?: { content?: string }; finish_reason?: string | null }[];
};

/**
 * One short completion, streamed.
 *
 * Streaming is not for progressive rendering here — it is how we measure and
 * minimise time-to-first-token, which is the number that decides whether an
 * answer lands while the question is still live.
 */
export async function runFast(options: {
  system: string;
  prompt: string;
  maxTokens?: number;
  /** Called with each token as it arrives, for streaming to the browser. */
  onToken?: (token: string) => void;
}): Promise<FastResult> {
  const config = env();
  const started = Date.now();

  const { baseUrl, apiKey } = fastLaneTarget();
  if (!baseUrl || !apiKey) {
    throw new ConfigurationError(fastLaneUnavailableReason() ?? "Fast lane is not configured.");
  }

  // A stale answer is worse than none, so the request is abandoned rather than
  // allowed to arrive after the conversation has moved on.
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), config.FAST_LLM_TIMEOUT_MS);

  try {
    const body: Record<string, unknown> = {
      model: config.FAST_LLM_MODEL,
      stream: true,
      max_completion_tokens: options.maxTokens ?? 220,
      // Low temperature: this answers from supplied context, it does not
      // brainstorm, and variance mid-call is a liability.
      temperature: 0.2,
      messages: [
        { role: "system", content: options.system },
        { role: "user", content: options.prompt },
      ],
    };

    // OpenRouter routes to whichever upstream it likes unless told otherwise.
    // Pinning it is how you get a specific model on specific hardware — and
    // fallbacks are off, because silently landing on a slow provider defeats
    // the entire point of this lane.
    if (config.FAST_LLM_PROVIDER === "openrouter" && config.OPENROUTER_PROVIDER_ORDER) {
      body.provider = {
        order: config.OPENROUTER_PROVIDER_ORDER.split(",").map((name) => name.trim()),
        allow_fallbacks: false,
      };
    }

    // Reasoning is pure latency for this job, but some endpoints refuse to run
    // without it, so ask for the least they will accept rather than none.
    if (config.FAST_LLM_REASONING_EFFORT === "none") {
      body.reasoning = { enabled: false };
    } else {
      body.reasoning = { effort: config.FAST_LLM_REASONING_EFFORT };
    }

    const response = await fetch(`${baseUrl.replace(/\/+$/, "")}/chat/completions`, {
      method: "POST",
      signal: abort.signal,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        // OpenRouter attributes traffic with these; harmless elsewhere.
        "HTTP-Referer": config.APP_URL,
        "X-Title": "Context Window",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok || !response.body) {
      throw new Error(
        `Fast lane (${config.FAST_LLM_PROVIDER}) failed (${response.status}): ${await response.text()}`,
      );
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let text = "";
    let firstTokenMs: number | null = null;

    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      // The last element may be a partial line; hold it for the next read.
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data:")) continue;

        const payload = trimmed.slice(5).trim();
        if (payload === "[DONE]") continue;

        let chunk: StreamChunk;
        try {
          chunk = JSON.parse(payload);
        } catch {
          continue; // a keep-alive or a split frame
        }

        const token = chunk.choices?.[0]?.delta?.content;
        if (token) {
          if (firstTokenMs === null) firstTokenMs = Date.now() - started;
          text += token;
          options.onToken?.(token);
        }
      }
    }

    return {
      text: text.trim(),
      firstTokenMs,
      totalMs: Date.now() - started,
      model: config.FAST_LLM_MODEL,
      ok: true,
    };
  } finally {
    clearTimeout(timer);
  }
}

/** Confirm the configured model actually exists on the account. */
export async function listFastModels(): Promise<string[]> {
  const { baseUrl, apiKey } = fastLaneTarget();
  if (!baseUrl || !apiKey) {
    throw new ConfigurationError(fastLaneUnavailableReason() ?? "Fast lane is not configured.");
  }

  const response = await fetch(`${baseUrl.replace(/\/+$/, "")}/models`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!response.ok) {
    throw new Error(`Could not list models (${response.status}): ${await response.text()}`);
  }

  const data = (await response.json()) as { data?: { id: string }[] };
  return (data.data ?? []).map((model) => model.id);
}
