"use client";

import { useEffect, useState } from "react";

import { cn } from "@/lib/cn";

export type MeetingSection = { id: string; label: string };

/**
 * Jump between the parts of a call.
 *
 * A processed meeting carries five or six distinct things — a brief, the
 * recording, the transcript, what was decided, what to do next — and stacked
 * down one page they read as an undifferentiated wall. This names them and
 * makes each reachable in a click, which is most of what "clear" means here.
 *
 * Sections are passed in rather than assumed, because which ones exist depends
 * on how far the call has got: an upcoming meeting has a brief and nothing
 * else, and offering a link to an empty transcript is worse than not offering
 * one.
 */
export function MeetingNav({ sections }: { sections: MeetingSection[] }) {
  const [active, setActive] = useState(sections[0]?.id ?? "");

  useEffect(() => {
    if (sections.length === 0) return;

    // rootMargin pulls the trigger line to just under the sticky nav, so a
    // section counts as current when its heading reaches the nav rather than
    // when it touches the top of the window.
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (visible) setActive(visible.target.id);
      },
      { rootMargin: "-88px 0px -55% 0px", threshold: 0 },
    );

    for (const section of sections) {
      const element = document.getElementById(section.id);
      if (element) observer.observe(element);
    }
    return () => observer.disconnect();
  }, [sections]);

  if (sections.length < 2) return null;

  return (
    <nav
      aria-label="Sections of this call"
      className="sticky top-[57px] z-10 -mx-6 mb-8 border-b border-rule bg-ground/85 px-6 backdrop-blur"
    >
      <ul className="flex gap-1 overflow-x-auto py-2">
        {sections.map((section) => (
          <li key={section.id}>
            <a
              href={`#${section.id}`}
              aria-current={active === section.id ? "true" : undefined}
              className={cn(
                "block whitespace-nowrap rounded px-3 py-1.5 text-[12.5px] transition-colors",
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
    </nav>
  );
}
