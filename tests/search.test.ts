/**
 * Serper's response shape, flattened.
 *
 * The ordering here is the part worth pinning: a model reading top-down should
 * meet the knowledge panel and the answer box before ten snippets of marketing
 * copy, because those are the parts that carry checkable facts.
 */
import { describe, expect, it } from "vitest";

const { toResults } = await import("@/lib/search/serper");
const { formatSearchResults } = await import("@/lib/search");

describe("Serper result mapping", () => {
  it("puts the knowledge panel first, with its attributes", () => {
    const results = toResults({
      knowledgeGraph: {
        title: "Cobalt Systems",
        type: "Software company",
        website: "https://cobalt.io",
        description: "Cobalt builds infrastructure tooling.",
        attributes: { Founded: "2019", Headquarters: "Berlin" },
      },
      organic: [{ title: "Cobalt raises Series B", link: "https://news.example/1", snippet: "…" }],
    });

    expect(results[0].title).toContain("knowledge panel");
    expect(results[0].content).toContain("Founded: 2019");
    expect(results[0].content).toContain("Headquarters: Berlin");
    expect(results[0].link).toBe("https://cobalt.io");
    expect(results[1].title).toBe("Cobalt raises Series B");
  });

  it("promotes the answer box above organic results", () => {
    const results = toResults({
      answerBox: { title: "Employees", answer: "About 240", link: "https://example.com" },
      organic: [{ title: "Homepage", link: "https://cobalt.io", snippet: "…" }],
    });
    expect(results[0].content).toBe("About 240");
    expect(results[1].title).toBe("Homepage");
  });

  it("carries publication dates through so recency is visible", () => {
    const results = toResults({
      organic: [
        { title: "Old post", link: "https://example.com/a", snippet: "…", date: "12 Jan 2023" },
      ],
    });
    expect(results[0].publishDate).toBe("12 Jan 2023");
    expect(formatSearchResults(results)).toContain("(12 Jan 2023)");
  });

  it("drops entries with no link rather than citing nothing", () => {
    const results = toResults({
      organic: [
        { title: "No link", snippet: "…" },
        { title: "Fine", link: "https://example.com", snippet: "…" },
      ],
    });
    expect(results).toHaveLength(1);
    expect(results[0].title).toBe("Fine");
  });

  it("drops people-search sites, which are noise and scraped personal data", () => {
    const results = toResults({
      organic: [
        { title: "Lewis Anderson, Age 51", link: "https://www.truepeoplesearch.com/find/x", snippet: "…" },
        { title: "Lewis Anderson Phone", link: "https://www.whitepages.com/name/x", snippet: "…" },
        { title: "Cobalt on LinkedIn", link: "https://www.linkedin.com/company/cobalt", snippet: "…" },
      ],
    });
    expect(results).toHaveLength(1);
    expect(results[0].link).toContain("linkedin.com");
  });

  it("blocks subdomains of a blocked host too", () => {
    const results = toResults({
      organic: [{ title: "x", link: "https://api.spokeo.com/a", snippet: "…" }],
    });
    expect(results).toHaveLength(0);
  });

  it("says so plainly when a query found nothing", () => {
    expect(formatSearchResults([])).toBe("No results found for that query.");
  });

  it("truncates long bodies so one result cannot swamp the context", () => {
    const formatted = formatSearchResults([
      { title: "Long", link: "https://example.com", content: "x".repeat(5000) },
    ]);
    expect(formatted.length).toBeLessThan(1500);
  });
});
