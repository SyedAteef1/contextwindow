import type { Citation } from "@/db/schema";
import { Eyebrow } from "./ui";

/**
 * The domain, which is most of what tells a rep whether to trust a line.
 *
 * A title alone ("Cobalt expands into Europe") reads the same whether it came
 * from the FT or from a content farm. The host is the cheapest possible signal
 * of credibility, so it is shown next to every source rather than hidden behind
 * the link.
 */
function hostOf(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

/**
 * Sources for a brief, numbered.
 *
 * Numbered rather than bulleted because the model refers to results by index
 * while it works, so the numbering here matches the order it saw them in.
 * Duplicates are collapsed: one article cited three times is one source.
 */
export function SourceList({ citations }: { citations: Citation[] }) {
  const seen = new Set<string>();
  const unique = citations.filter((citation) => {
    if (!citation.url || seen.has(citation.url)) return false;
    seen.add(citation.url);
    return true;
  });

  if (unique.length === 0) return null;

  return (
    <div className="mt-6 border-t border-rule-soft pt-4">
      <div className="flex items-baseline justify-between gap-3">
        <Eyebrow>Sources</Eyebrow>
        <span className="font-mono text-[10px] tabular-nums text-faint">
          {unique.length} cited
        </span>
      </div>

      <ol className="mt-2.5 space-y-px">
        {unique.map((citation, index) => {
          const host = hostOf(citation.url);
          return (
            <li key={citation.url}>
              <a
                href={citation.url}
                target="_blank"
                rel="noopener noreferrer nofollow"
                className="group -mx-2 flex items-baseline gap-2.5 rounded px-2 py-1 transition-colors hover:bg-sunken/60"
              >
                <span className="w-5 shrink-0 pt-px text-right font-mono text-[10px] tabular-nums text-faint">
                  {index + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[12.5px] leading-snug text-muted group-hover:text-ink">
                    {citation.title || citation.url}
                  </span>
                  {host && (
                    <span className="mt-0.5 block font-mono text-[10.5px] text-faint">{host}</span>
                  )}
                </span>
              </a>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
