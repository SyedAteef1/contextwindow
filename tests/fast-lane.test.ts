/**
 * The fast lane's reasoning setting.
 *
 * This is pinned by a test because getting it wrong is invisible: at `low`
 * effort `openai/gpt-oss-120b` spent 15.6 seconds reasoning before its first
 * content token, blew the 4s timeout every time, and `answerLiveQuestion`
 * quietly fell back to the main model. The lane looked configured and
 * contributed nothing. At `minimal` the same call answers in ~400ms.
 */
import { afterEach, describe, expect, it, vi } from "vitest";

const { resetEnvCache } = await import("@/lib/env");

async function bodySentBy(effort?: string) {
  if (effort === undefined) delete process.env.FAST_LLM_REASONING_EFFORT;
  else process.env.FAST_LLM_REASONING_EFFORT = effort;
  process.env.FAST_LLM_PROVIDER = "openrouter";
  process.env.OPENROUTER_API_KEY = "or-test";
  process.env.FAST_LLM_MODEL = "openai/gpt-oss-120b";
  resetEnvCache();

  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    body: null,
    json: async () => ({ choices: [{ message: { content: "ok" } }] }),
    text: async () => "",
  });
  vi.stubGlobal("fetch", fetchMock);

  const { runFast } = await import("@/lib/llm/fast");
  await runFast({ system: "s", prompt: "p", maxTokens: 50 }).catch(() => {});
  const call = fetchMock.mock.calls[0];
  return call ? JSON.parse(call[1].body) : null;
}

afterEach(() => {
  delete process.env.FAST_LLM_REASONING_EFFORT;
  resetEnvCache();
  vi.unstubAllGlobals();
});

describe("fast lane reasoning", () => {
  it("defaults to minimal rather than low", async () => {
    const body = await bodySentBy(undefined);
    expect(body?.reasoning).toEqual({ effort: "minimal" });
  });

  it("honours an explicit effort", async () => {
    const body = await bodySentBy("high");
    expect(body?.reasoning).toEqual({ effort: "high" });
  });

  it("disables reasoning outright when asked", async () => {
    const body = await bodySentBy("none");
    expect(body?.reasoning).toEqual({ enabled: false });
  });

  it("pins the provider and forbids fallbacks so latency is predictable", async () => {
    process.env.OPENROUTER_PROVIDER_ORDER = "Cerebras";
    const body = await bodySentBy(undefined);
    expect(body?.provider).toEqual({ order: ["Cerebras"], allow_fallbacks: false });
    delete process.env.OPENROUTER_PROVIDER_ORDER;
  });
});
