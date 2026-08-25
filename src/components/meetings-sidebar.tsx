import Link from "next/link";

import { LocalTime } from "./local-time";
import { cn } from "@/lib/cn";
import { trimCompanyPrefix } from "@/lib/format";
import type { listMeetingsForRail } from "@/lib/queries";

type Row = Awaited<ReturnType<typeof listMeetingsForRail>>[number];

/**
 * Every call, always reachable.
 *
 * A rep moves between calls constantly — checking what was promised on one
 * while preparing for the next — and a full-page list means two navigations for
 * every switch. The sidebar makes the whole calendar the navigation, so opening
 * a meeting never loses the others.
 *
 * Split at now rather than sorted flat: what is coming is a to-do list and what
 * has happened is a record, and they are read for different reasons.
 */
const STATUS_LABEL: Partial<Record<Row["status"], string>> = {
  brief_ready: "Brief",
  bot_scheduled: "Bot set",
  recording: "Live",
  transcribed: "Transcript",
  processed: "Summary",
  skipped_quota: "Over limit",
  failed: "Failed",
  cancelled: "Cancelled",
};

function statusTone(status: Row["status"]): string {
  if (status === "recording") return "text-live";
  if (status === "failed" || status === "skipped_quota") return "text-flag";
  if (status === "processed" || status === "transcribed") return "text-muted";
  return "text-signal";
}

function Item({ row, active }: { row: Row; active: boolean }) {
  const label = STATUS_LABEL[row.status];

  return (
    <li>
      <Link
        href={`/meetings/${row.id}`}
        aria-current={active ? "page" : undefined}
        className={cn(
          "block rounded px-2.5 py-2 transition-colors duration-150 ease-out",
          active ? "bg-surface" : "hover:bg-surface/60",
        )}
      >
        <span className="flex items-baseline justify-between gap-2">
          <span
            className={cn(
              "truncate text-[13px] font-medium",
              active ? "text-ink" : "text-ink-soft",
            )}
          >
            {row.companyName}
          </span>
          {row.status === "recording" && (
            <span className="pulse-live size-1.5 shrink-0 rounded-full bg-live" aria-hidden />
          )}
        </span>
        {/* Calendar titles usually repeat the company ("Cobalt — kickoff"),
            which would print it twice in a two-line row. */}
        <span className="mt-0.5 block truncate text-[12px] text-muted">
          {trimCompanyPrefix(row.title, row.companyName)}
        </span>
        <span className="mt-1 flex items-center gap-2">
          {/* Rendered client-side: formatting a date on the server pins it to
              the server's zone and then mismatches on hydration. */}
          <LocalTime
            value={row.scheduledAt}
            className="font-mono text-[10px] tabular-nums text-faint"
          />
          {label && (
            <span
              className={cn(
                "font-mono text-[9.5px] uppercase tracking-[0.1em]",
                statusTone(row.status),
              )}
            >
              {label}
            </span>
          )}
        </span>
      </Link>
    </li>
  );
}

function Group({
  heading,
  rows,
  activeId,
}: {
  heading: string;
  rows: Row[];
  activeId?: string;
}) {
  if (rows.length === 0) return null;
  return (
    <div className="flex flex-col gap-1.5">
      <p className="px-2.5 font-mono text-[9.5px] uppercase tracking-[0.14em] text-faint">
        {heading} · {rows.length}
      </p>
      <ul className="flex flex-col gap-px">
        {rows.map((row) => (
          <Item key={row.id} row={row} active={row.id === activeId} />
        ))}
      </ul>
    </div>
  );
}

export function MeetingsSidebar({
  upcoming,
  past,
  activeId,
}: {
  upcoming: Row[];
  past: Row[];
  activeId?: string;
}) {
  const total = upcoming.length + past.length;

  return (
    <aside className="hidden w-64 shrink-0 border-r border-rule lg:block">
      <div className="sticky top-[57px] flex max-h-[calc(100dvh-57px)] flex-col gap-5 overflow-y-auto px-3 py-5">
        <Link
          href="/meetings"
          className={cn(
            "rounded border border-rule px-2.5 py-2 text-[12.5px] transition-colors duration-150 ease-out hover:border-faint",
            activeId ? "text-muted" : "bg-surface text-ink",
          )}
        >
          All calls
        </Link>

        {total === 0 ? (
          <p className="px-2.5 text-[12px] leading-relaxed text-faint">
            Nothing on the calendar yet. External calls appear here once the sync finds them.
          </p>
        ) : (
          <>
            <Group heading="Upcoming" rows={upcoming} activeId={activeId} />
            <Group heading="Past" rows={past} activeId={activeId} />
          </>
        )}
      </div>
    </aside>
  );
}
