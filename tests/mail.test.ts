/**
 * The email template.
 *
 * Mail clients are unforgiving and untestable in CI, so what is asserted here
 * is the part that is actually checkable: that markdown becomes the right
 * blocks, and that nothing a customer's name could contain escapes into markup.
 */
import { describe, expect, it } from "vitest";

import { markdownToBlocks, renderEmail } from "@/lib/mail/template";

describe("markdownToBlocks", () => {
  it("turns headings, paragraphs and bullets into blocks", () => {
    const blocks = markdownToBlocks(
      ["# Where this stands", "", "They cleared security.", "", "- Send the number", "- Book the call"].join("\n"),
    );
    expect(blocks).toEqual([
      { type: "heading", text: "Where this stands" },
      { type: "paragraph", text: "They cleared security." },
      { type: "bullets", items: ["Send the number", "Book the call"] },
    ]);
  });

  it("treats a lone bold line as a section label", () => {
    // The agents write section labels this way rather than with hashes.
    expect(markdownToBlocks("**What they told us**")).toEqual([
      { type: "heading", text: "What they told us" },
    ]);
  });

  it("joins wrapped lines into one paragraph", () => {
    const blocks = markdownToBlocks("They cannot sign\nwithout a report.");
    expect(blocks).toEqual([
      { type: "paragraph", text: "They cannot sign without a report." },
    ]);
  });
});

describe("renderEmail", () => {
  it("escapes markup in content", () => {
    const html = renderEmail({
      title: "Acme <script>alert(1)</script>",
      blocks: [{ type: "paragraph", text: "5 > 3 & rising" }],
    });
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("5 &gt; 3 &amp; rising");
  });

  it("keeps bold and links as real markup", () => {
    const html = renderEmail({
      title: "Brief",
      blocks: [{ type: "paragraph", text: "**Three** open [promises](https://example.com/x)" }],
    });
    expect(html).toContain("<strong");
    expect(html).toContain('href="https://example.com/x"');
  });

  it("does not turn a javascript: url into a link", () => {
    const html = renderEmail({
      title: "Brief",
      // Only http(s) is matched, so this stays inert text.
      blocks: [{ type: "paragraph", text: "[click](javascript:alert(1))" }],
    });
    // It stays as inert text, so the string is still present — what matters is
    // that it never reaches an href.
    expect(html).not.toMatch(/href="javascript:/i);
    expect(html).toContain("[click](javascript:alert(1))");
  });

  it("includes the preheader and the action", () => {
    const html = renderEmail({
      title: "Brief",
      preheader: "Everything we know",
      blocks: [],
      action: { label: "Open the brief", url: "https://app.example.com/m/1" },
    });
    expect(html).toContain("Everything we know");
    expect(html).toContain("Open the brief");
    expect(html).toContain('href="https://app.example.com/m/1"');
  });
});
