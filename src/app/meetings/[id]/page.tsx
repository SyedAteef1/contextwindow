import Link from "next/link";
import { notFound } from "next/navigation";

import { BriefButton } from "@/components/brief-button";
import { Page } from "@/components/chrome";
import { RecordingPlayer } from "@/components/recording-player";
import { WrapupDispatch } from "@/components/wrapup-dispatch";
import { LivePanel } from "@/components/live-panel";
import { MarkBriefSeen } from "@/components/mark-brief-seen";
import { SourceList } from "@/components/source-list";
import { Markdown } from "@/components/markdown";
import { TranscriptUpload } from "@/components/transcript-upload";
import { BackLink, Card, Empty, Eyebrow, LiveDot, Pill, SignalMeter } from "@/components/ui";
import {
  clockTime,
  dealStageLabel,
  durationLabel,
  relativeDay,
  shortDate,
  statusLabel,
  trimCompanyPrefix,
} from "@/lib/format";
import { MeetingsSidebar } from "@/components/meetings-sidebar";
import { currentUser, listMeetingsSplit, loadMeetingDetail } from "@/lib/queries";
import { listLiveAnswers } from "@/agents/live";

export const dynamic = "force-dynamic";

const DELIVERABLE_LABEL = {
  meeting_minutes: "Meeting minutes",
  timeline: "Timeline",
  plain_summary: "Summary",
} as const;

export default async function MeetingPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  const { id } = await params;
  // Fetched together: the sidebar is on every meeting page, so serialising
  // these would add a round trip to each navigation.
  const [detail, rail] = await Promise.all([
    loadMeetingDetail(user.id, id),
    listMeetingsSplit(user.id),
  ]);
  if (!detail) notFound();

  const { meeting, account, brief, summary, transcript, proposals, recapEmail, isPast } =
    detail;
  const liveAnswerCount = (await listLiveAnswers(meeting.id)).length;
  const signals = summary?.intentSignals ?? null;

  return (
    <Page current="meetings" sidebar={<MeetingsSidebar upcoming={rail.upcoming} past={rail.past} activeId={id} />}>
      <BackLink href="/meetings">All calls</BackLink>

      {/* --- Header ------------------------------------------------------- */}
      <div className="mt-5 mb-8 border-b border-rule pb-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <Link
              href={`/accounts/${account.id}`}
              className="font-display text-[28px] font-bold tracking-[-0.028em] text-ink hover:underline"
            >
              {account.companyName}
            </Link>
            <p className="mt-1.5 text-[15px] text-ink-soft">
              {trimCompanyPrefix(meeting.title, account.companyName)}
            </p>
            <p className="mt-2.5 font-mono text-[11px] uppercase tracking-[0.1em] text-faint">
              {shortDate(meeting.scheduledAt)} · {clockTime(meeting.scheduledAt)} ·{" "}
              {relativeDay(meeting.scheduledAt)}
            </p>
          </div>

          <div className="flex flex-col items-end gap-2">
            <Pill tone={meeting.status === "recording" ? "live" : "neutral"}>
              {meeting.status === "recording" && <LiveDot />}
              {statusLabel(meeting.status)}
            </Pill>
            <Pill tone="quiet">{dealStageLabel(account.dealStage)}</Pill>
          </div>
        </div>

        {meeting.errorMessage && (
          <p className="mt-4 rounded-md border border-flag/25 bg-flag-soft px-3.5 py-2.5 text-[13px] text-flag">
            {meeting.errorMessage}
          </p>
        )}

        {meeting.attendees && meeting.attendees.length > 0 && (
          <div className="mt-5">
            <Eyebrow>On the invite</Eyebrow>
            <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1.5">
              {meeting.attendees.map((attendee) => (
                <li key={attendee.email} className="text-[13px]">
                  <span className={attendee.external ? "text-ink" : "text-faint"}>
                    {attendee.displayName ?? attendee.email}
                  </span>
                  {attendee.external && (
                    <span className="ml-1.5 font-mono text-[9.5px] uppercase tracking-[0.1em] text-signal">
                      external
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="space-y-9">
        {/* --- Live answers: first while the call is happening ------------- */}
        {(meeting.status === "recording" || liveAnswerCount > 0) && (
          <LivePanel meetingId={meeting.id} live={meeting.status === "recording"} />
        )}

        {/* --- After the call: the only thing here needing a decision ----- */}
        {(proposals.length > 0 || recapEmail) && (
          <section>
            <WrapupDispatch
              meetingId={meeting.id}
              email={
                recapEmail
                  ? {
                      id: recapEmail.id,
                      subject: recapEmail.subject,
                      body: recapEmail.body,
                      recipients: recapEmail.recipients ?? [],
                      status: recapEmail.status,
                      sentAt: recapEmail.sentAt?.toISOString() ?? null,
                      gmailThreadId: recapEmail.gmailThreadId,
                    }
                  : null
              }
              proposal={
                proposals[0]
                  ? {
                      id: proposals[0].id,
                      title: proposals[0].title,
                      agenda: proposals[0].agenda,
                      rationale: proposals[0].rationale,
                      proposedStart: proposals[0].proposedStart.toISOString(),
                      proposedEnd: proposals[0].proposedEnd.toISOString(),
                      attendeeEmails: proposals[0].attendeeEmails,
                      status: proposals[0].status,
                    }
                  : null
              }
            />
          </section>
        )}

        {/* --- The recording ---------------------------------------------- */}
        {meeting.botId &&
          (meeting.status === "transcribed" || meeting.status === "processed") && (
            <RecordingPlayer meetingId={meeting.id} />
          )}

        {/* --- Buying signals ---------------------------------------------- */}
        {signals && (
          <section>
            <SectionHead label="What the call signalled" />
            <Card className="px-5 py-4">
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-rule-soft pb-4">
                <div>
                  <Eyebrow>Buying interest</Eyebrow>
                  <div className="mt-2">
                    <SignalMeter interest={signals.buyingInterest} />
                  </div>
                </div>
                <p className="max-w-md text-[13.5px] text-muted">{signals.interestRationale}</p>
              </div>

              <div className="grid gap-6 pt-4 sm:grid-cols-2">
                <div>
                  <Eyebrow>Objections raised</Eyebrow>
                  {signals.objections.length === 0 ? (
                    <p className="mt-2 text-[13.5px] text-faint">None recorded.</p>
                  ) : (
                    <ul className="mt-2 space-y-2.5">
                      {signals.objections.map((objection, index) => (
                        <li key={index} className="text-[13.5px]">
                          <span className="text-ink">{objection.objection}</span>
                          <span className="ml-2 font-mono text-[9.5px] uppercase tracking-[0.1em] text-flag">
                            {objection.severity}
                          </span>
                          {objection.quote && (
                            <p className="mt-1 border-l-2 border-rule pl-2.5 text-[12.5px] italic text-muted">
                              “{objection.quote}”
                            </p>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div>
                  <Eyebrow>Next steps committed to</Eyebrow>
                  {signals.nextSteps.length === 0 ? (
                    <p className="mt-2 text-[13.5px] text-faint">None recorded.</p>
                  ) : (
                    <ul className="mt-2 space-y-2">
                      {signals.nextSteps.map((step, index) => (
                        <li key={index} className="text-[13.5px] text-ink">
                          {step.step}
                          <span className="ml-2 font-mono text-[9.5px] uppercase tracking-[0.1em] text-faint">
                            {step.owner === "us" ? "ours" : step.owner === "them" ? "theirs" : "shared"}
                            {step.dueDate ? ` · ${step.dueDate}` : ""}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>

              {(signals.competitorsMentioned.length > 0 ||
                signals.budgetSignals.length > 0 ||
                signals.timelineSignals.length > 0) && (
                <div className="mt-5 flex flex-wrap gap-x-6 gap-y-3 border-t border-rule-soft pt-4">
                  <SignalList label="Competitors" items={signals.competitorsMentioned} />
                  <SignalList label="Budget" items={signals.budgetSignals} />
                  <SignalList label="Timing" items={signals.timelineSignals} />
                </div>
              )}
            </Card>
          </section>
        )}

        {/* --- Summary ------------------------------------------------------ */}
        {summary && (
          <section>
            <SectionHead
              label={DELIVERABLE_LABEL[summary.deliverableType]}
              aside={`Written ${shortDate(summary.generatedAt)}`}
            />
            <Card className="px-6 py-5">
              <Markdown>{summary.content}</Markdown>
            </Card>
          </section>
        )}

        {/* --- Pre-call brief ----------------------------------------------- */}
        <section>
          <SectionHead
            label="Pre-call brief"
            aside={brief ? `Researched ${shortDate(brief.generatedAt)}` : undefined}
          />
          {brief ? (
            <Card className="px-6 py-5">
              <MarkBriefSeen meetingId={meeting.id} />
              <Markdown>{brief.content}</Markdown>

              {brief.citations && <SourceList citations={brief.citations} />}

              <div className="mt-6 border-t border-rule-soft pt-4">
                <BriefButton meetingId={meeting.id} hasBrief />
              </div>
            </Card>
          ) : (
            <Empty
              title="No brief yet"
              action={<BriefButton meetingId={meeting.id} hasBrief={false} />}
            >
              Research {account.companyName} and everyone on the invite, citing only what can be
              verified.
            </Empty>
          )}
        </section>

        {/* --- Transcript ---------------------------------------------------- */}
        <section>
          <SectionHead
            label="Transcript"
            aside={
              transcript
                ? [transcript.source, durationLabel(transcript.durationSeconds)]
                    .filter(Boolean)
                    .join(" · ")
                : undefined
            }
          />
          {transcript ? (
            <Card as="article" className="overflow-hidden">
              <details className="group">
                <summary className="cursor-pointer list-none px-5 py-3.5 font-mono text-[10px] uppercase tracking-[0.12em] text-muted transition-colors hover:text-ink">
                  <span className="group-open:hidden">Show full transcript</span>
                  <span className="hidden group-open:inline">Hide full transcript</span>
                </summary>
                <div className="max-h-[28rem] overflow-y-auto border-t border-rule-soft px-5 py-4">
                  {transcript.speakerSegments && transcript.speakerSegments.length > 0 ? (
                    <ol className="space-y-2.5">
                      {transcript.speakerSegments.map((segment, index) => (
                        <li key={index} className="grid grid-cols-[3rem_1fr] gap-3 text-[13px]">
                          <span className="pt-px font-mono text-[10.5px] tabular-nums text-faint">
                            {Math.floor(segment.timestampMs / 60000)
                              .toString()
                              .padStart(2, "0")}
                            :
                            {Math.floor((segment.timestampMs % 60000) / 1000)
                              .toString()
                              .padStart(2, "0")}
                          </span>
                          <span>
                            <span className="font-mono text-[10.5px] uppercase tracking-[0.08em] text-ink">
                              {segment.speakerName}
                            </span>
                            <span className="mt-0.5 block text-ink-soft">{segment.text}</span>
                          </span>
                        </li>
                      ))}
                    </ol>
                  ) : (
                    <pre className="whitespace-pre-wrap font-mono text-[12.5px] leading-relaxed text-ink-soft">
                      {transcript.rawText}
                    </pre>
                  )}
                </div>
              </details>
            </Card>
          ) : isPast ? (
            <TranscriptUpload meetingId={meeting.id} />
          ) : (
            <Empty title="The call hasn't happened yet">
              A notetaker joins automatically. Once the call ends, the transcript and summary land
              here.
            </Empty>
          )}
        </section>
      </div>
    </Page>
  );
}

function SectionHead({ label, aside }: { label: string; aside?: string }) {
  return (
    <div className="mb-3.5 flex items-baseline gap-3">
      <h2 className="font-display text-[13px] font-bold uppercase tracking-[0.08em] text-ink">
        {label}
      </h2>
      <span className="h-px flex-1 bg-rule" aria-hidden />
      {aside && (
        <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-faint">{aside}</span>
      )}
    </div>
  );
}

function SignalList({ label, items }: { label: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div className="min-w-[10rem] flex-1">
      <Eyebrow>{label}</Eyebrow>
      <ul className="mt-1.5 space-y-1">
        {items.map((item, index) => (
          <li key={index} className="text-[13px] text-ink-soft">
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
