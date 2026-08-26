/**
 * The time rail.
 *
 * A rep's day is a column of meetings, so the layout is literally that: a spine
 * with each call as a node on it and a dashed NOW line cutting across. Position
 * carries meaning — above the line the call has happened and there is a summary
 * to read; below it there is a brief to read before it starts.
 */
import { Fragment } from "react";
import Link from "next/link";

import { Pill, LiveDot, SignalMeter } from "./ui";
import { clockTime, dayKey, dayLabel, nodeState, statusLabel, trimCompanyPrefix } from "@/lib/format";
import type { DealStage, MeetingStatus } from "@/db/schema";

export type RailMeeting = {
  id: string;
  title: string | null;
  scheduledAt: string;
  status: MeetingStatus;
  companyName: string;
  domain: string;
  dealStage: DealStage;
  hasBrief: boolean;
  hasSummary: boolean;
  briefUnread?: boolean;
  buyingInterest?: string | null;
  attendeeCount?: number;
};

/** Status pill tone, chosen so colour only ever appears when it means something. */
function statusTone(status: MeetingStatus) {
  if (status === "recording") return "live" as const;
  if (status === "failed" || status === "skipped_quota") return "flag" as const;
  if (status === "brief_ready" || status === "processed") return "neutral" as const;
  return "quiet" as const;
}

function MeetingNode({
  meeting,
  timeZone,
}: {
  meeting: RailMeeting;
  timeZone?: string | null;
}) {
  const state = nodeState(meeting.status);
  const isPast = meeting.hasSummary || meeting.status === "processed";

  return (
    <li className="rail-node" data-state={state}>
      <time className="rail-time" dateTime={meeting.scheduledAt}>
        {clockTime(meeting.scheduledAt, timeZone)}
      </time>

      <Link
        href={`/meetings/${meeting.id}`}
        className="group block rounded-lg border border-rule bg-surface px-4 py-3.5 transition-all hover:border-faint hover:shadow-[0_1px_0_theme(colors.rule)]"
      >
        <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
          <div className="min-w-0">
            <h3 className="font-display text-[15px] font-semibold tracking-[-0.015em] text-ink">
              {meeting.companyName}
            </h3>
            <p className="mt-0.5 truncate text-[13.5px] text-muted">
              {trimCompanyPrefix(meeting.title, meeting.companyName, meeting.domain)}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {meeting.briefUnread && <Pill tone="signal">New brief</Pill>}
            <Pill tone={statusTone(meeting.status)}>
              {meeting.status === "recording" && <LiveDot />}
              {statusLabel(meeting.status)}
            </Pill>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-rule-soft pt-2.5">
          <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-faint">
            {meeting.domain}
          </span>

          {typeof meeting.attendeeCount === "number" && meeting.attendeeCount > 0 && (
            <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-faint">
              {meeting.attendeeCount} attending
            </span>
          )}

          {isPast && meeting.buyingInterest && <SignalMeter interest={meeting.buyingInterest} />}

          {/* What's actually readable right now — the reason to click through. */}
          <span className="ml-auto font-mono text-[10px] uppercase tracking-[0.1em] text-ink transition-colors group-hover:text-signal">
            {meeting.hasSummary
              ? "Read summary →"
              : meeting.hasBrief
                ? "Read brief →"
                : "Open →"}
          </span>
        </div>
      </Link>
    </li>
  );
}

function NowMarker({ at }: { at: Date }) {
  return (
    <li className="rail-now" aria-label={`Current time ${clockTime(at)}`}>
      <span className="font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-signal">
        Now {clockTime(at)}
      </span>
    </li>
  );
}

/**
 * Group meetings by calendar day, then drop the NOW marker into today's group
 * at the point the current time falls.
 */
export function TimeRail({
  meetings,
  now,
  timeZone,
}: {
  meetings: RailMeeting[];
  now: Date;
  /** The reader's zone. Without it the server groups by its own, which is UTC. */
  timeZone?: string | null;
}) {
  const days = new Map<string, RailMeeting[]>();
  for (const meeting of meetings) {
    const key = dayKey(meeting.scheduledAt, timeZone);
    days.set(key, [...(days.get(key) ?? []), meeting]);
  }

  const todayKey = dayKey(now, timeZone);

  return (
    <div className="space-y-10">
      {[...days.entries()].map(([key, dayMeetings], dayIndex) => {
        const isToday = key === todayKey;
        // Meetings are ordered ascending within a day; find the boundary.
        const nowIndex = isToday
          ? dayMeetings.findIndex((meeting) => new Date(meeting.scheduledAt) > now)
          : -1;

        return (
          <section key={key} className="rise" style={{ animationDelay: `${dayIndex * 55}ms` }}>
            <div className="mb-3.5 flex items-baseline gap-3">
              <h2 className="font-display text-[13px] font-bold uppercase tracking-[0.08em] text-ink">
                {dayLabel(key, timeZone)}
              </h2>
              <span className="h-px flex-1 bg-rule" aria-hidden />
              <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-faint">
                {dayMeetings.length} {dayMeetings.length === 1 ? "call" : "calls"}
              </span>
            </div>

            <ul className="rail space-y-2.5">
              {dayMeetings.map((meeting, index) => (
                <Fragment key={meeting.id}>
                  {index === nowIndex && <NowMarker at={now} />}
                  <MeetingNode meeting={meeting} timeZone={timeZone} />
                </Fragment>
              ))}
              {/* Every call today is already behind us. */}
              {isToday && nowIndex === -1 && <NowMarker at={now} />}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
