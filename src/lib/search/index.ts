/**
 * Web search, as a client-side tool.
 *
 * Anthropic's `web_search_*` runs on Anthropic's servers and does not exist
 * behind Z.ai's compatibility layer, so with GLM the model cannot search for
 * itself. Search therefore becomes an ordinary tool: the model asks, we run the
 * query, we hand results back. That indirection is what lets the backend change
 * without the research agent noticing.
 */
import type Anthropic from "@anthropic-ai/sdk";

import { env } from "@/lib/env";
import { serperSearch } from "./serper";
import type { SearchOptions, SearchResult } from "./types";
import { zaiSearch } from "./zai";

export type { SearchResult, SearchRecency, SearchOptions } from "./types";

export const WEB_SEARCH_TOOL_NAME = "web_search";

/** Described to the model in the same terms as the hosted tool it replaces. */
export const WEB_SEARCH_TOOL: Anthropic.Tool = {
  name: WEB_SEARCH_TOOL_NAME,
  description:
    "Search the web for current information. Returns titles, URLs, publication dates, and summaries. Use it to verify claims before stating them, and search more than once when a question has several parts.",
  input_schema: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description: "The search query. Be specific; prefer a company's own domain when relevant.",
      },
      recency: {
        type: "string",
        enum: ["noLimit", "oneYear", "oneMonth", "oneWeek", "oneDay"],
        description: "Restrict results by age. Use `noLimit` unless recency matters.",
      },
    },
    required: ["query"],
    additionalProperties: false,
  },
};

/**
 * Which backend runs a query.
 *
 * Serper when it has a key, because Google's index and its knowledge panel are
 * better for company research than any provider-bundled search. Z.ai otherwise,
 * so a deployment without a Serper key still produces briefs rather than
 * failing.
 */
export function searchProvider(): "serper" | "zai" {
  const configured = env().SEARCH_PROVIDER;
  if (configured !== "auto") return configured;
  return env().SERPER_API_KEY ? "serper" : "zai";
}

export async function webSearch(
  query: string,
  options: SearchOptions = {},
): Promise<SearchResult[]> {
  return searchProvider() === "serper"
    ? serperSearch(query, options)
    : zaiSearch(query, options);
}

/** Render results for the model, numbered so it can cite them by index. */
export function formatSearchResults(results: SearchResult[]): string {
  if (results.length === 0) return "No results found for that query.";

  return results
    .map((result, index) => {
      const date = result.publishDate ? ` (${result.publishDate})` : "";
      const source = result.source ? ` — ${result.source}` : "";
      // Long bodies would swamp the context; enough to judge relevance and to
      // quote a fact from is all this needs to be.
      const body = result.content.slice(0, 1200);
      return `[${index + 1}] ${result.title}${source}${date}\n${result.link}\n${body}`;
    })
    .join("\n\n");
}
