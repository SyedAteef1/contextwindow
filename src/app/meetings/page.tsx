import Link from "next/link";

import { Page, PageHead } from "@/components/chrome";
import { MeetingsSidebar } from "@/components/meetings-sidebar";
import { SyncButton } from "@/components/sync-button";
import { TimeRail } from "@/components/time-rail";
import { TimezoneSync } from "@/components/timezone-sync";
import { EmptyRail } from "@/components/empty-rail";
import { Pill } from "@/components/ui";
import {
  currentUser,
  listMeetingsForRail,
  listMeetingsSplit,
  meetingCounts,
  pendingFollowups,
  unreadBriefs,
} from "@/lib/queries";
import { clockTime, relativeDay, shortDate, trimCompanyPrefix } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function MeetingsPage() {
  const user = await currentUser();
  const [railMeetings, split, counts, followups, freshBriefs] = await Promise.all([
    listMeetingsForRail(user.id),
    listMeetingsSplit(user.id),
    meetingCounts(user.id),
    pendingFollowups(user.id),
    unreadBriefs(user.id),
  ]);

  const now = new Date();
  // The rail reads top-down through the day, so flip the newest-first query.
  const ordered = [...railMeetings].reverse();

  return (
    <Page current="meetings" sidebar={<MeetingsSidebar companies={split.companies} />}>
      {/* Renders nothing; tells the server which zone to group days in. */}
      <TimezoneSync current={user.timezone} />
      <PageHead
        eyebrow={`Signed in as ${user.email}`}
        title="Your calls"
        meta={
          counts.total > 0 ? (
            <span>
              {counts.upcoming} upcoming
              {counts.needsAttention > 0 && (
                <>
                  {" · "}
                  <span className="text-flag">{counts.needsAttention} need attention</span>
                </>
              )}
            </span>
          ) : null
        }
        action={ordered.length > 0 ? <SyncButton /> : null}
      />

      {freshBriefs.length > 0 && (
        <section className="mb-6 rounded-lg border border-rule bg-surface px-5 py-4">
          <div className="mb-3 flex items-center gap-2.5">
            <p className="eyebrow">
              {freshBriefs.length === 1 ? "New brief" : `${freshBriefs.length} new briefs`}
            </p>
            <span className="h-px flex-1 bg-rule-soft" aria-hidden />
          </div>
          <ul className="space-y-2">
            {freshBriefs.map((brief) => (
              <li key={brief.meetingId}>
                <Link
                  href={`/meetings/${brief.meetingId}`}
                  className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 text-[13.5px] text-ink hover:underline"
                >
                  <span>
                    <span className="font-semibold">{brief.companyName}</span>
                    {" — "}
                    {trimCompanyPrefix(brief.title, brief.companyName, brief.domain)}
                  </span>
                  <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted">
                    Call {relativeDay(brief.scheduledAt)} at {clockTime(brief.scheduledAt)} · read →
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {followups.length > 0 && (
        <section className="mb-9 rounded-lg border border-signal/25 bg-signal/[0.07] px-5 py-4">
          <div className="mb-3 flex items-center gap-2.5">
            <p className="eyebrow !text-signal">Waiting on you</p>
            <span className="h-px flex-1 bg-signal/20" aria-hidden />
          </div>
          <ul className="space-y-2">
            {followups.map((followup) => (
              <li key={followup.id}>
                <Link
                  href={`/meetings/${followup.meetingId}#followup`}
                  className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 text-[13.5px] text-ink hover:underline"
                >
                  <span>
                    <span className="font-semibold">{followup.companyName}</span>
                    {" — "}
                    {trimCompanyPrefix(followup.title, followup.companyName, followup.domain)}
                  </span>
                  <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-signal">
                    Proposed {shortDate(followup.proposedStart)} · review →
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {ordered.length === 0 ? (
        <EmptyRail domain={user.emailDomain} />
      ) : (
        <TimeRail meetings={ordered} now={now} timeZone={user.timezone} />
      )}

      {ordered.length > 0 && (
        <p className="mt-10 flex items-center gap-2 text-[12.5px] text-faint">
          <Pill tone="quiet">How it works</Pill>
          A notetaker joins each call, then the transcript becomes a summary and buying signals.
        </p>
      )}
    </Page>
  );
}
