import Link from "next/link";

import { LocalTime } from "./local-time";
import { cn } from "@/lib/cn";
import { MeetingSectionLinks, type MeetingSection } from "./meeting-section-links";
import { trimCompanyPrefix } from "@/lib/format";
import type { CompanyGroup, MeetingRailRow } from "@/lib/queries";

type Row = MeetingRailRow;

/**
 * Every call, grouped by who it is with.
 *
 * A rep moves between calls constantly — checking what was promised on one
 * while preparing for the next — and a full-page list means two navigations for
 * every switch. The sidebar makes the whole calendar the navigation.
 *
 * Grouped by company rather than listed flat, because a rep thinks in accounts:
 * "where are we with Cobalt" comes before "what is at 10:30". Five calls with
 * one customer printed flat repeat the company name five times and leave the
 * eye to reassemble the grouping on every render.
 *
 * Collapsing uses native `<details>`, so this stays a server component: no
 * hydration, no client state, and keyboard and screen-reader behaviour come for
 * free. The open/closed default is computed on the server from which company
 * you are currently looking at.
 */
/**
 * Status as a dot, with the words kept for the tooltip and the screen reader.
 *
 * A column of uppercase red FAILED beside every call read as an app in
 * trouble, and shouted loudest about the meetings that mattered least. The
 * information is worth one 6px mark: colour carries the state, the title
 * attribute carries the detail, and the eye is left free for the names.
 */
const STATUS_LABEL: Partial<Record<Row["status"], string>> = {
  detected: "Found on your calendar",
  brief_pending: "Researching",
  brief_ready: "Brief ready",
  bot_scheduled: "Notetaker booked",
  recording: "Recording now",
  transcribed: "Writing the summary",
  processed: "Summary ready",
  skipped_quota: "Over the free limit",
  bot_requires_upgrade: "Brief only — no notetaker",
  failed: "Needs attention",
  cancelled: "Cancelled",
};

/** Four states worth telling apart at a glance, and nothing finer. */
function statusDot(status: Row["status"]): string {
  if (status === "recording") return "bg-live";
  if (status === "failed") return "bg-flag";
  if (status === "skipped_quota") return "bg-signal";
  if (status === "processed" || status === "transcribed" || status === "brief_ready")
    return "bg-muted";
  // Scheduled, researching, or waiting on a plan: present, not yet resolved.
  return "bg-rule";
}

/**
 * One call.
 *
 * The company name is deliberately absent — it is the heading directly above,
 * and repeating it is the flat list's problem. What is left is the part that
 * distinguishes this call from the others with the same customer.
 */
function Item({
  row,
  active,
  sections,
  activeView,
}: {
  row: Row;
  active: boolean;
  /** The parts of this call, shown beneath it while it is the one open. */
  sections?: MeetingSection[];
  /** Which section is showing, so the sidebar can mark it. */
  activeView?: string;
}) {
  const label = STATUS_LABEL[row.status];

  return (
    <li>
      <Link
        href={`/meetings/${row.id}`}
        aria-current={active ? "page" : undefined}
        className={cn(
          "block rounded py-1.5 pl-4 pr-2 transition-colors duration-150 ease-out",
          active ? "bg-surface" : "hover:bg-surface/60",
        )}
      >
        <span className="flex items-baseline justify-between gap-2">
          <span
            className={cn(
              "truncate text-[12.5px]",
              active ? "font-medium text-ink" : "text-ink-soft",
            )}
          >
            {trimCompanyPrefix(row.title, row.companyName, row.domain)}
          </span>
          {row.status === "recording" && (
            <span className="pulse-live size-1.5 shrink-0 rounded-full bg-live" aria-hidden />
          )}
        </span>
        <span className="mt-0.5 flex items-center gap-2">
          {/* Rendered client-side: formatting a date on the server pins it to
              the server's zone and then mismatches on hydration. */}
          <LocalTime
            value={row.scheduledAt}
            className="font-mono text-[10px] tabular-nums text-faint"
          />
          {label && (
            <span
              title={label}
              className={cn("size-1.5 shrink-0 rounded-full", statusDot(row.status))}
            >
              <span className="sr-only">{label}</span>
            </span>
          )}
        </span>
      </Link>

      {active && sections && sections.length > 0 && (
        <MeetingSectionLinks
          meetingId={row.id}
          sections={sections}
          active={activeView}
          className="mb-1 mt-0.5"
        />
      )}
    </li>
  );
}

/** A labelled run of calls inside one company, shown only when both kinds exist. */
function Section({
  label,
  rows,
  activeId,
  sections,
  activeView,
}: {
  label: string;
  rows: Row[];
  activeId?: string;
  sections?: MeetingSection[];
  activeView?: string;
}) {
  if (rows.length === 0) return null;
  return (
    <>
      <li className="mt-1.5 first:mt-0">
        <span className="block pl-4 font-mono text-[9px] uppercase tracking-[0.14em] text-faint">
          {label}
        </span>
      </li>
      {rows.map((row) => (
        <Item
          key={row.id}
          row={row}
          active={row.id === activeId}
          sections={row.id === activeId ? sections : undefined}
          activeView={activeView}
        />
      ))}
    </>
  );
}

function Company({
  group,
  activeId,
  sections,
  activeView,
}: {
  group: CompanyGroup;
  activeId?: string;
  sections?: MeetingSection[];
  activeView?: string;
}) {
  const holdsActive =
    activeId !== undefined &&
    [...group.upcoming, ...group.past].some((row) => row.id === activeId);

  // Open where the rep is already looking, where something is being recorded,
  // or where a call is coming up. A company whose history is closed is one
  // there is nothing to do about right now.
  const open = holdsActive || group.live || group.upcoming.length > 0;

  // Both runs get a label only when the split is real; a company with only
  // past calls does not need the word "Past" over every one of them.
  const showLabels = group.upcoming.length > 0 && group.past.length > 0;

  return (
    <details open={open} className="group/company">
      <summary
        className={cn(
          "flex cursor-pointer list-none items-center gap-2 rounded px-2.5 py-1.5",
          "transition-colors duration-150 ease-out hover:bg-surface/60",
          "[&::-webkit-details-marker]:hidden",
        )}
      >
        <svg
          viewBox="0 0 12 12"
          aria-hidden
          className="size-2.5 shrink-0 text-faint transition-transform duration-150 ease-out group-open/company:rotate-90"
        >
          <path d="M4 2.5 L8 6 L4 9.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
        </svg>

        <span
          className={cn(
            "min-w-0 flex-1 truncate text-[13px] font-medium",
            holdsActive ? "text-ink" : "text-ink-soft",
          )}
        >
          {group.companyName}
        </span>

        {group.live ? (
          <span className="pulse-live size-1.5 shrink-0 rounded-full bg-live" aria-hidden />
        ) : group.unread > 0 ? (
          <span
            className="shrink-0 font-mono text-[9.5px] uppercase tracking-[0.1em] text-signal"
            title={`${group.unread} unread brief${group.unread > 1 ? "s" : ""}`}
          >
            New
          </span>
        ) : null}

        <span className="shrink-0 font-mono text-[10px] tabular-nums text-faint">
          {group.total}
        </span>
      </summary>

      <ul className="mt-0.5 flex flex-col gap-px border-l border-rule-soft pb-1 ml-3.5">
        {showLabels ? (
          <>
            <Section
              label="Upcoming"
              rows={group.upcoming}
              activeId={activeId}
              sections={sections}
              activeView={activeView}
            />
            <Section
              label="Past"
              rows={group.past}
              activeId={activeId}
              sections={sections}
              activeView={activeView}
            />
          </>
        ) : (
          [...group.upcoming, ...group.past].map((row) => (
            <Item
              key={row.id}
              row={row}
              active={row.id === activeId}
              sections={row.id === activeId ? sections : undefined}
              activeView={activeView}
            />
          ))
        )}
      </ul>
    </details>
  );
}

export function MeetingsSidebar({
  companies,
  activeId,
  activeSections,
  activeView,
}: {
  companies: CompanyGroup[];
  activeId?: string;
  /** The parts of the open call, listed under it. */
  activeSections?: MeetingSection[];
  /** Which section of the open call is showing. */
  activeView?: string;
}) {
  const calls = companies.reduce((total, group) => total + group.total, 0);

  return (
    <aside className="hidden w-64 shrink-0 border-r border-rule lg:block">
      <div className="sticky top-[57px] flex max-h-[calc(100dvh-57px)] flex-col gap-4 overflow-y-auto px-3 py-5">
        <Link
          href="/meetings"
          className={cn(
            "rounded border border-rule px-2.5 py-2 text-[12.5px] transition-colors duration-150 ease-out hover:border-faint",
            activeId ? "text-muted" : "bg-surface text-ink",
          )}
        >
          All calls
        </Link>

        {companies.length === 0 ? (
          <p className="px-2.5 text-[12px] leading-relaxed text-faint">
            Nothing on the calendar yet. External calls appear here once the sync finds them.
          </p>
        ) : (
          <div className="flex flex-col gap-1.5">
            <p className="px-2.5 font-mono text-[9.5px] uppercase tracking-[0.14em] text-faint">
              Companies · {companies.length}
              <span className="text-faint/60"> · {calls} calls</span>
            </p>
            <div className="flex flex-col gap-px">
              {companies.map((group) => (
                <Company
                  key={group.accountId}
                  group={group}
                  activeId={activeId}
                  sections={activeSections}
                  activeView={activeView}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
