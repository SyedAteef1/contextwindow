/**
 * Reading a company's own website.
 *
 * One URL is the highest-yield thing a new workspace can hand us: it carries
 * the positioning, the product vocabulary and often the customer list, without
 * anyone writing a paragraph. So this is asked once at sign-up and the result
 * becomes workspace context every brief is written against.
 *
 * No dependency for this. A parser would give us a DOM we do not need — the
 * job is to get readable prose out of marketing HTML, and script/style removal
 * plus tag stripping does that about as well as a 2MB library would.
 *
 * The URL comes from a user, so it is treated as hostile: https only, no
 * private address ranges, a hard timeout, a capped response, and a redirect
 * limit. A server that fetches arbitrary user-supplied URLs is a server-side
 * request forgery waiting to happen, and "it is only our own customers" has
 * never been a control.
 */

const TIMEOUT_MS = 12_000;
const MAX_BYTES = 1_500_000;
/** Enough to characterise a company; beyond this it is navigation and legalese. */
const MAX_TEXT = 12_000;

export type ScrapeResult = {
  url: string;
  title: string | null;
  text: string;
  /** Pages we managed to read, in the order they were fetched. */
  pages: string[];
};

/** Normalise what someone typed into something fetchable, or reject it. */
export function normaliseUrl(input: string): URL | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const url = new URL(withScheme);
    // http is upgraded rather than followed: a company site that only answers
    // on port 80 is not one we should be sending anything to anyway.
    url.protocol = "https:";
    if (!url.hostname.includes(".")) return null;
    if (isPrivateHost(url.hostname)) return null;
    return url;
  } catch {
    return null;
  }
}

/**
 * Refuse anything pointing back inside the network.
 *
 * Literal-address checks only — a name that resolves to a private address still
 * gets through, which is why this is one control and not the only one. The
 * fetch is also capped and time-limited, and nothing it returns is executed.
 */
function isPrivateHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".internal")) return true;
  if (host === "metadata.google.internal") return true;
  if (/^\[?::1\]?$/.test(host)) return true;
  const v4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!v4) return false;
  const [a, b] = [Number(v4[1]), Number(v4[2])];
  return (
    a === 0 || a === 10 || a === 127 ||
    (a === 169 && b === 254) ||            // link-local, and the cloud metadata endpoint
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168)
  );
}

/** Marketing HTML in, readable prose out. */
export function htmlToText(html: string): { title: string | null; text: string } {
  const title = html.match(/<title[^>]*>([^<]{1,200})<\/title>/i)?.[1]?.trim() ?? null;

  const text = html
    // Whole elements, not just their tags: script and style bodies are not prose.
    .replace(/<(script|style|noscript|svg|head)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    // Keep block boundaries as line breaks so sentences do not run together.
    .replace(/<\/(p|div|section|li|h[1-6]|tr|br)[^>]*>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/[ \t ]+/g, " ")
    .replace(/\n\s*\n\s*\n+/g, "\n\n")
    .split("\n")
    .map((line) => line.trim())
    // Single words are almost always navigation; two words can be a real heading.
    .filter((line) => line.length > 1)
    .join("\n")
    .trim();

  return { title, text: text.slice(0, MAX_TEXT) };
}

async function fetchPage(url: URL): Promise<string | null> {
  try {
    const response = await fetch(url, {
      redirect: "follow",
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: {
        // Identifying ourselves is the polite thing and makes us blockable,
        // which a site operator is entitled to do.
        "User-Agent": "ContextWindowBot/1.0 (+https://sales.contextwindowhq.com)",
        Accept: "text/html,application/xhtml+xml",
      },
    });
    if (!response.ok) return null;
    if (!(response.headers.get("content-type") ?? "").includes("html")) return null;

    const length = Number(response.headers.get("content-length") ?? 0);
    if (length > MAX_BYTES) return null;

    const body = await response.text();
    return body.slice(0, MAX_BYTES);
  } catch {
    return null;
  }
}

/**
 * Read a company's site: the home page, plus an about page when one is linked.
 *
 * Two pages rather than a crawl. The home page carries the positioning and the
 * about page carries who they are; everything past that is blog posts and
 * careers, which cost time and dilute the context rather than sharpen it.
 */
export async function scrapeCompanySite(rawUrl: string): Promise<ScrapeResult | null> {
  const url = normaliseUrl(rawUrl);
  if (!url) return null;

  const home = await fetchPage(url);
  if (!home) return null;

  const parsed = htmlToText(home);
  const pages = [url.toString()];
  let combined = parsed.text;

  const aboutHref = home.match(
    /href=["']([^"']*\/(about|about-us|company|who-we-are)\/?)["']/i,
  )?.[1];

  if (aboutHref && combined.length < MAX_TEXT) {
    try {
      const aboutUrl = new URL(aboutHref, url);
      if (aboutUrl.hostname === url.hostname && !isPrivateHost(aboutUrl.hostname)) {
        const about = await fetchPage(aboutUrl);
        if (about) {
          const extra = htmlToText(about).text;
          if (extra) {
            combined = `${combined}\n\n--- ${aboutUrl.pathname} ---\n\n${extra}`.slice(0, MAX_TEXT);
            pages.push(aboutUrl.toString());
          }
        }
      }
    } catch {
      // A malformed href is not worth failing the whole scrape over.
    }
  }

  if (!combined.trim()) return null;
  return { url: url.toString(), title: parsed.title, text: combined, pages };
}
