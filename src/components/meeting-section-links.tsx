import Link from "next/link";

import { cn } from "@/lib/cn";

export type MeetingSection = { id: string; label: string };

/**
 * The parts of the open call, as a third level under it in the sidebar.
 *
 * Each is a real page rather than an anchor into a long one, so the link is a
 * link: the server knows which section is showing, the back button works, and
 * a link to a transcript opens a transcript. That also means no client state
 * and no scroll observer — which section is current is simply what the URL
 * says.
 */
export function MeetingSectionLinks({
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
  if (sections.length === 0) return null;

  return (
    <ul className={cn("ml-3 flex flex-col gap-px border-l border-rule-soft", className)}>
      {sections.map((section) => (
        <li key={section.id}>
          <Link
            href={`/meetings/${meetingId}?view=${section.id}`}
            aria-current={active === section.id ? "page" : undefined}
            className={cn(
              "block rounded py-1 pl-3 pr-2 text-[12px] transition-colors duration-150 ease-out",
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
  );
}
