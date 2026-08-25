/**
 * Serper — Google results over a plain REST call.
 *
 * Chosen over the model provider's own search because it returns Google's
 * index rather than a provider-specific one, and because it exposes the
 * knowledge panel and answer box. For company research those two carry most of
 * the value: founding date, headquarters, size and industry arrive as facts
 * rather than as sentences a model has to infer from prose.
 */
import { ConfigurationError, env } from "@/lib/env";
import type { SearchOptions, SearchResult } from "./types";

const SERPER_API = "https://google.serper.dev/search";

/**
 * Data brokers, dropped before the model ever sees them.
 *
 * Researching the people on a call means searching their names, and a name
 * query reliably surfaces people-search sites: home addresses, phone numbers,
 * ages, relatives. That material is worthless for selling and actively harmful
 * to put in front of a rep — it is scraped personal data about a private
 * individual, and quoting it in a brief would be indefensible. Blocking the
 * category is easier to reason about than hoping the prompt declines it.
 */
const BLOCKED_HOSTS = [
  "whitepages.com",
  "truepeoplesearch.com",
  "beenverified.com",
  "thatsthem.com",
  "fastbackgroundcheck.com",
  "spokeo.com",
  "radaris.com",
  "peoplefinders.com",
  "intelius.com",
  "instantcheckmate.com",
  "usphonebook.com",
  "clustrmaps.com",
  "email-format.com",
  "rocketreach.co",
  "zoominfo.com",
  "signalhire.com",
];

function isBlocked(link: string): boolean {
  try {
    const host = new URL(link).hostname.replace(/^www\./, "").toLowerCase();
    return BLOCKED_HOSTS.some((blocked) => host === blocked || host.endsWith(`.${blocked}`));
  } catch {
    // An unparseable link cannot be cited anyway.
    return true;
  }
}

/** Serper takes Google's `tbs` recency codes. */
const RECENCY: Record<string, string | undefined> = {
  noLimit: undefined,
  oneYear: "qdr:y",
  oneMonth: "qdr:m",
  oneWeek: "qdr:w",
  oneDay: "qdr:d",
};

type SerperOrganic = { title?: string; link?: string; snippet?: string; date?: string };
type SerperResponse = {
  organic?: SerperOrganic[];
  answerBox?: { title?: string; answer?: string; snippet?: string; link?: string };
  knowledgeGraph?: {
    title?: string;
    type?: string;
    website?: string;
    description?: string;
    descriptionLink?: string;
    attributes?: Record<string, string>;
  };
};

export async function serperSearch(
  query: string,
  options: SearchOptions = {},
): Promise<SearchResult[]> {
  const config = env();
  if (!config.SERPER_API_KEY) {
    throw new ConfigurationError("Web search via Serper requires SERPER_API_KEY.");
  }

  const tbs = RECENCY[options.recency ?? "noLimit"];
  const response = await fetch(SERPER_API, {
    method: "POST",
    headers: { "X-API-KEY": config.SERPER_API_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({
      q: query,
      num: options.count ?? 10,
      ...(tbs ? { tbs } : {}),
    }),
  });

  if (!response.ok) {
    throw new Error(`Serper search failed (${response.status}): ${await response.text()}`);
  }

  return toResults((await response.json()) as SerperResponse);
}

/**
 * Flatten Serper's response into plain results.
 *
 * The knowledge panel and answer box come first because they are the most
 * reliable things on the page — a model reading top-down should meet the
 * structured facts before it meets ten snippets of marketing copy.
 */
export function toResults(data: SerperResponse): SearchResult[] {
  const results: SearchResult[] = [];

  const graph = data.knowledgeGraph;
  if (graph?.title) {
    const attributes = Object.entries(graph.attributes ?? {})
      .map(([key, value]) => `${key}: ${value}`)
      .join(" · ");
    const content = [graph.type, graph.description, attributes].filter(Boolean).join("\n");
    if (content) {
      results.push({
        title: `${graph.title} — knowledge panel`,
        link: graph.website ?? graph.descriptionLink ?? "",
        content,
        source: "Google Knowledge Graph",
      });
    }
  }

  const box = data.answerBox;
  const answer = box?.answer ?? box?.snippet;
  if (answer) {
    results.push({
      title: box?.title ?? "Featured answer",
      link: box?.link ?? "",
      content: answer,
      source: "Google answer box",
    });
  }

  for (const item of data.organic ?? []) {
    if (!item.link || !item.title) continue;
    if (isBlocked(item.link)) continue;
    results.push({
      title: item.title,
      link: item.link,
      content: item.snippet ?? "",
      publishDate: item.date,
    });
  }

  return results;
}
