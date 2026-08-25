/**
 * One web result, in the shape the model reads.
 *
 * Deliberately provider-neutral: the research agent should not be able to tell
 * which search backend produced a brief, so swapping one for another never
 * changes the prompt or the citation handling.
 */
export type SearchResult = {
  title: string;
  link: string;
  /** A snippet or summary. Never a full page body — that would swamp context. */
  content: string;
  /** Where the result came from, when the provider says. */
  source?: string;
  publishDate?: string;
};

/** How old a result may be. `noLimit` unless recency genuinely matters. */
export type SearchRecency = "noLimit" | "oneYear" | "oneMonth" | "oneWeek" | "oneDay";

export type SearchOptions = { recency?: SearchRecency; count?: number };
