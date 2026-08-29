import type { ReactNode } from "react";

/**
 * The dashboard before a calendar has been checked.
 *
 * A dashed box saying "nothing here" abandons the person reading it, and a
 * blurred fake screenshot is a lie about data that does not exist. So this
 * draws the real thing empty: the spine, the NOW line, and three nodes for the
 * three moments a call actually has. The rail is the product's one motif, and
 * an unpopulated rail says *what will arrive and in what order* far more
 * plainly than a sentence could.
 *
 * Nodes are hollow because nothing has happened yet. The one CTA is the only
 * lit thing on the screen.
 */
export function EmptyRail({
  domain,
  action,
}: {
  /** The rep's own domain, so "external" means something concrete. */
  domain: string;
  action: ReactNode;
}) {
  const moments: { stamp: string; title: string; body: string }[] = [
    {
      stamp: "Before",
      title: "A brief lands in your inbox",
      body: `Once a call with someone outside ${domain} appears on your calendar, we research the company and the people on the invite — days ahead, without being asked.`,
    },
    {
      stamp: "Live",
      title: "Answers while the buyer is still talking",
      body: "A hard question triggers a search of your own docs and past calls. The answer reaches your screen in under a second, with its source attached.",
    },
    {
      stamp: "After",
      title: "The follow-up is already drafted",
      body: "The summary, the buying signals and the next step are written the moment the call ends. You approve rather than type.",
    },
  ];

  return (
    <div className="py-2">
      <div className="rail-dark relative">
        {moments.map((moment, i) => (
          <div key={moment.stamp} className={i === moments.length - 1 ? "relative" : "relative pb-9"}>
            <span className="rail-stamp font-mono text-[11px] uppercase tracking-[0.1em] text-faint">
              {moment.stamp}
            </span>
            {/* Hollow: this moment has not happened for anyone yet. */}
            <span className="rail-dot" aria-hidden />
            <p className="text-[14.5px] font-medium text-ink-soft">{moment.title}</p>
            <p className="mt-1 max-w-lg text-[13.5px] leading-relaxed text-muted">{moment.body}</p>
          </div>
        ))}
      </div>

      {/* The line the rail is missing, and the button that draws it. */}
      <div className="mt-10 flex flex-wrap items-center gap-x-4 gap-y-3 border-t border-dashed border-rule pt-7">
        {action}
        <p className="text-[13px] text-faint">
          Internal-only meetings are skipped. Nothing joins a call until you are on Pro.
        </p>
      </div>
    </div>
  );
}
