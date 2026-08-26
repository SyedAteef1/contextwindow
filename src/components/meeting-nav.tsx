import Link from "next/link";

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
  meetingId,
  sections,
  active,
  className,
}: {
  meetingId: string;
  sections: MeetingSection[];
  active?: string;
  className?: string;
}) {
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
            <Link
              href={`/meetings/${meetingId}?view=${section.id}`}
              aria-current={active === section.id ? "page" : undefined}
              className={cn(
                "block whitespace-nowrap rounded px-3 py-1.5 text-[12.5px] transition-colors",
                active === section.id
                  ? "bg-surface text-ink"
                  : "text-muted hover:bg-surface/60 hover:text-ink",
              )}
            >
              {section.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
