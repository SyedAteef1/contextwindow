/**
 * Z.ai's Web Search API — the fallback backend.
 *
 * Kept because it needs no key beyond the one GLM already uses, which makes it
 * the path of least resistance when Serper is not configured. It lives on the
 * native REST surface (`/web_search`), a different host and auth scheme from
 * the Anthropic-compatible endpoint the model itself is called through.
 */
import { ConfigurationError, env } from "@/lib/env";
import type { SearchOptions, SearchResult } from "./types";

type ZaiResult = {
  title: string;
  link: string;
  content: string;
  media?: string;
  publish_date?: string;
};

export async function zaiSearch(
  query: string,
  options: SearchOptions = {},
): Promise<SearchResult[]> {
  const config = env();
  if (!config.GLM_API_KEY) {
    throw new ConfigurationError("Web search via Z.ai requires GLM_API_KEY.");
  }

  const response = await fetch(`${config.GLM_API_BASE_URL.replace(/\/+$/, "")}/web_search`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.GLM_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      search_engine: config.GLM_SEARCH_ENGINE,
      search_query: query,
      count: options.count ?? 10,
      search_recency_filter: options.recency ?? "noLimit",
    }),
  });

  if (!response.ok) {
    throw new Error(`Z.ai web search failed (${response.status}): ${await response.text()}`);
  }

  const data = (await response.json()) as { search_result?: ZaiResult[] };
  return (data.search_result ?? []).map((result) => ({
    title: result.title,
    link: result.link,
    content: result.content,
    source: result.media,
    publishDate: result.publish_date,
  }));
}
