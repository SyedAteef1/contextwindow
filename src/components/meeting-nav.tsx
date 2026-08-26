"use client";

import { useEffect, useState } from "react";

import { cn } from "@/lib/cn";
import type { MeetingSection } from "./meeting-section-links";

/**
 * The parts of a call, for viewports with no sidebar.
 *
 * Above `lg` this navigation lives in the sidebar under the call it belongs to,
 * which is where it reads as part of the same tree. Below `lg` the sidebar is
 * hidden entirely, so the sections would otherwise be unreachable — this is
 * that fallback and nothing more.
 */
export function MeetingNav({
  sections,
  className,
}: {
  sections: MeetingSection[];
  className?: string;
}) {
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
      className={cn(
        "sticky top-[57px] z-10 -mx-6 mb-8 border-b border-rule bg-ground/85 px-6 backdrop-blur",
        className,
      )}
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
