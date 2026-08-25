/**
 * The recap is the only thing this product sends to a customer, so the parts
 * that decide how it *arrives* are worth pinning down: header encoding, and the
 * plain-text-to-HTML rendering.
 */
import { describe, expect, it } from "vitest";

const { bodyToHtml } = await import("@/lib/google/gmail");

describe("recap email rendering", () => {
  it("renders blank-line paragraphs as separate paragraphs", () => {
    const html = bodyToHtml("First para.\n\nSecond para.");
    expect(html.match(/<p /g)).toHaveLength(2);
    expect(html).toContain("First para.");
    expect(html).toContain("Second para.");
  });

  it("renders a run of dashes as a list, not a paragraph of dashes", () => {
    const html = bodyToHtml("Next steps:\n\n- Send the report\n- Book the review");
    expect(html).toContain("<ul");
    expect(html.match(/<li>/g)).toHaveLength(2);
    expect(html).toContain("<li>Send the report</li>");
    // The bullet character itself must not survive into the item text.
    expect(html).not.toContain("<li>- ");
  });

  it("keeps single newlines inside a paragraph as line breaks", () => {
    expect(bodyToHtml("Line one\nLine two")).toContain("Line one<br>Line two");
  });

  it("escapes markup so a transcript quote cannot inject HTML", () => {
    const html = bodyToHtml('They said "<script>alert(1)</script>" on the call.');
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("does not mistake a mid-paragraph dash for a list", () => {
    const html = bodyToHtml("We agreed - broadly - on the timeline.");
    expect(html).not.toContain("<ul");
  });
});

describe("disabled Google APIs", () => {
  it("names the API and the page that enables it", async () => {
    const { serviceDisabledMessage } = await import("@/lib/google/service-errors");
    const body = JSON.stringify({
      error: {
        code: 403,
        details: [
          {
            reason: "SERVICE_DISABLED",
            metadata: {
              serviceTitle: "Google Calendar API",
              activationUrl: "https://console.developers.google.com/apis/api/calendar-json",
            },
          },
        ],
      },
    });
    const message = serviceDisabledMessage(body);
    expect(message).toContain("Google Calendar API is not enabled");
    expect(message).toContain("https://console.developers.google.com/apis/api/calendar-json");
  });

  it("ignores unrelated failures so real errors keep their detail", async () => {
    const { serviceDisabledMessage } = await import("@/lib/google/service-errors");
    expect(serviceDisabledMessage('{"error":{"code":401,"message":"Invalid Credentials"}}')).toBeNull();
  });

  it("still says something useful when the body is not JSON", async () => {
    const { serviceDisabledMessage } = await import("@/lib/google/service-errors");
    expect(serviceDisabledMessage("SERVICE_DISABLED but not json")).toContain("not enabled");
  });
});
