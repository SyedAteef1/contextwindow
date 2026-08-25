/** Shared output helpers for the try-* scripts. */
import { env } from "@/lib/env";
import { capabilities, modelId, provider } from "@/lib/llm";
import { embeddingStatus } from "@/lib/embeddings";

const BAR = "─".repeat(72);

export function heading(title: string): void {
  console.log(`\n${BAR}\n  ${title}\n${BAR}`);
}

export function field(label: string, value: unknown): void {
  console.log(`  ${label.padEnd(22)} ${String(value)}`);
}

export function body(text: string): void {
  console.log(`\n${text.split("\n").map((line) => `  ${line}`).join("\n")}\n`);
}

/** Print the active configuration, so a surprising result is explainable. */
export function printConfig(): void {
  heading("Configuration");
  const caps = capabilities();
  const embeddings = embeddingStatus();

  field("LLM provider", provider());
  field("Model", modelId());
  field("Structured output", caps.nativeStructuredOutput ? "native" : "forced tool call");
  field("Web search", caps.hostedWebSearch ? "hosted (Anthropic)" : "client-side (GLM)");
  field("Embedding provider", embeddings.provider);
  field("Embedding model", embeddings.model ?? "n/a — hash provider ignores it");
  field("Embedding dims", embeddings.dimensions);
  field(
    "Hybrid retrieval",
    embeddings.hybrid
      ? "on (dense + sparse)"
      : `off — ${embeddings.hybridBlockedBy ?? "dense only"}`,
  );
  field("Database", env().DATABASE_URL.replace(/:[^:@/]+@/, ":****@"));
}

/**
 * Turn a missing key into instructions rather than a stack trace — this is the
 * expected state on a fresh checkout, not a bug.
 */
export function explainFailure(error: unknown): never {
  const message = error instanceof Error ? error.message : String(error);

  if (/GLM_API_KEY|ANTHROPIC_API_KEY/.test(message)) {
    heading("Not configured yet");
    console.log(`  ${message}\n`);
    console.log("  Add ONE of these to .env, then run this again:\n");
    console.log("    LLM_PROVIDER=anthropic");
    console.log("    ANTHROPIC_API_KEY=sk-ant-...\n");
    console.log("  or\n");
    console.log("    LLM_PROVIDER=glm");
    console.log("    GLM_API_KEY=...            # https://z.ai/manage-apikey/apikey-list\n");
    process.exit(1);
  }

  heading("Failed");
  console.error(`  ${message}\n`);
  if (error instanceof Error && error.stack) {
    console.error(error.stack.split("\n").slice(1, 5).join("\n"));
  }
  process.exit(1);
}
