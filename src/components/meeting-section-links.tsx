"use client";

import { useEffect, useState } from "react";

import { cn } from "@/lib/cn";

export type MeetingSection = { id: string; label: string };

/**
 * The parts of the open call, as a third level under it in the sidebar.
 *
 * The sidebar already answers "which company, which call"; this answers "which
 * part of it", in the same place and the same shape. Putting it anywhere else —
 * a bar across the top of the page, say — means the navigation for a call lives
 * apart from the navigation to it, and the page has to carry a second row of
 * controls it did not need.
 *
 * Client-side only for the highlight: the links themselves are anchors and work
 * without it.
 */
export function MeetingSectionLinks({
  sections,
  className,
}: {
  sections: MeetingSection[];
  className?: string;
}) {
  const [active, setActive] = useState(sections[0]?.id ?? "");

  useEffect(() => {
    if (sections.length === 0) return;

    // rootMargin pulls the trigger line below the masthead, so a section counts
    // as current when its heading reaches the top of the readable area rather
    // than when it touches the top of the window.
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (visible) setActive(visible.target.id);
      },
      { rootMargin: "-80px 0px -55% 0px", threshold: 0 },
    );

    for (const section of sections) {
      const element = document.getElementById(section.id);
      if (element) observer.observe(element);
    }
    return () => observer.disconnect();
  }, [sections]);

  if (sections.length === 0) return null;

  return (
    <ul className={cn("ml-3 flex flex-col gap-px border-l border-rule-soft", className)}>
      {sections.map((section) => (
        <li key={section.id}>
          <a
            href={`#${section.id}`}
            aria-current={active === section.id ? "true" : undefined}
            className={cn(
              "block rounded py-1 pl-3 pr-2 text-[12px] transition-colors duration-150 ease-out",
              active === section.id
                ? "bg-surface text-ink"
                : "text-muted hover:bg-surface/60 hover:text-ink",
            )}
          >
            {section.label}
          </a>
        </li>
      ))}
    </ul>
  );
}
