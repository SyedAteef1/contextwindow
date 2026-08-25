"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Button, Eyebrow, Pill } from "./ui";
import { LocalTime } from "./local-time";
import { Markdown } from "./markdown";

/** Local datetime string for `<input type="datetime-local">`. */
function toLocalInput(iso: string): string {
  const date = new Date(iso);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

export type RecapEmailView = {
  id: string;
  subject: string;
  body: string;
  recipients: string[];
  status: "pending" | "approved" | "rejected" | "expired";
  sentAt: string | null;
  gmailThreadId: string | null;
};

export type FollowupMeetingView = {
  id: string;
  title: string;
  agenda: string;
  rationale: string | null;
  proposedStart: string;
  proposedEnd: string;
  attendeeEmails: string[] | null;
  status: "pending" | "approved" | "rejected" | "expired";
};

/**
 * The end of the call, in one decision.
 *
 * Both halves — the recap that goes to the buyer and the meeting that goes on
 * the calendar — are drafted before the rep arrives here, and both go out on a
 * single press. Two separate approvals is how follow-ups quietly stop
 * happening; the whole point is that this costs one click.
 *
 * Each half can still be edited, or switched off. What cannot happen is
 * anything leaving without a press: the drafts sit as `pending` until then, and
 * the footer copy says so.
 */
export function WrapupDispatch({
  meetingId,
  email,
  proposal,
}: {
  meetingId: string;
  email: RecapEmailView | null;
  proposal: FollowupMeetingView | null;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  const emailPending = email?.status === "pending";
  const meetingPending = proposal?.status === "pending";

  const [sendEmail, setSendEmail] = useState(true);
  const [scheduleMeeting, setScheduleMeeting] = useState(true);
  const [editing, setEditing] = useState(false);

  const [subject, setSubject] = useState(email?.subject ?? "");
  const [body, setBody] = useState(email?.body ?? "");
  const [title, setTitle] = useState(proposal?.title ?? "");
  const [agenda, setAgenda] = useState(proposal?.agenda ?? "");
  const [startLocal, setStartLocal] = useState(
    proposal ? toLocalInput(proposal.proposedStart) : "",
  );
  const [durationMinutes, setDurationMinutes] = useState(
    proposal
      ? Math.max(
          15,
          Math.round(
            (new Date(proposal.proposedEnd).getTime() -
              new Date(proposal.proposedStart).getTime()) /
              60_000,
          ),
        )
      : 30,
  );

  const [busy, setBusy] = useState<"dispatch" | "dismiss" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);

  const willEmail = emailPending && sendEmail;
  const willSchedule = meetingPending && scheduleMeeting;

  async function dispatch() {
    setBusy("dispatch");
    setError(null);
    setWarning(null);
    try {
      const response = await fetch(`/api/meetings/${meetingId}/followup/dispatch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sendEmail: willEmail,
          scheduleMeeting: willSchedule,
          email: willEmail ? { subject, body } : undefined,
          meeting: willSchedule
            ? {
                title,
                agenda,
                startIso: new Date(startLocal).toISOString(),
                durationMinutes,
              }
            : undefined,
        }),
      });
      const data = await response.json();
      // 207: the recap went out but the calendar half failed. Saying "failed"
      // here would be a lie the rep might act on by re-sending.
      if (response.status === 207) setWarning(data.error);
      else if (!response.ok) throw new Error(data.error ?? "Could not send this follow-up");
      startTransition(() => router.refresh());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not send this follow-up");
    } finally {
      setBusy(null);
    }
  }

  async function dismiss() {
    if (!proposal) return;
    setBusy("dismiss");
    setError(null);
    try {
      const response = await fetch(`/api/followups/${proposal.id}/reject`, { method: "POST" });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error ?? "Could not dismiss this follow-up");
      }
      startTransition(() => router.refresh());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not dismiss this follow-up");
    } finally {
      setBusy(null);
    }
  }

  // --- Settled states -----------------------------------------------------

  const emailSent = email?.status === "approved";
  const meetingBooked = proposal?.status === "approved";

  if (!emailPending && !meetingPending) {
    if (!emailSent && !meetingBooked) {
      if (!email && !proposal) return null;
      return (
        <div className="rounded-lg border border-rule bg-sunken/50 px-5 py-4">
          <Eyebrow>Follow-up dismissed</Eyebrow>
          <p className="mt-1.5 text-[13.5px] text-muted">
            Nothing was sent and no event was created.
          </p>
        </div>
      );
    }
    return (
      <div className="rounded-lg border border-rule bg-surface px-5 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <Eyebrow>Follow-up complete</Eyebrow>
            <div className="mt-1.5 space-y-1">
              {emailSent && (
                <p className="text-[13.5px] text-ink">
                  Recap sent to {email!.recipients.length}{" "}
                  {email!.recipients.length === 1 ? "person" : "people"}
                  {email!.sentAt && (
                    <>
                      {" · "}
                      <LocalTime value={email!.sentAt} />
                    </>
                  )}
                </p>
              )}
              {meetingBooked && (
                <p className="text-[13.5px] text-ink">
                  {proposal!.title} — <LocalTime value={proposal!.proposedStart} />
                </p>
              )}
            </div>
          </div>
          <Pill tone="live">Done</Pill>
        </div>
      </div>
    );
  }

  // --- The decision -------------------------------------------------------

  const actionLabel =
    willEmail && willSchedule
      ? "Send recap and book follow-up"
      : willEmail
        ? "Send recap"
        : willSchedule
          ? "Book follow-up"
          : "Nothing selected";

  return (
    <div
      id="followup"
      className="scroll-mt-24 rounded-lg border border-signal/30 bg-surface shadow-[0_1px_0_rgba(180,83,9,0.08)]"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-rule-soft px-5 py-3.5">
        <div className="flex items-center gap-2.5">
          <Eyebrow>After the call</Eyebrow>
          <Pill tone="signal">Needs your approval</Pill>
        </div>
        <button
          type="button"
          onClick={() => setEditing((value) => !value)}
          className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted transition-colors hover:text-ink"
        >
          {editing ? "Done editing" : "Edit before sending"}
        </button>
      </div>

      {/* --- The recap email ------------------------------------------------ */}
      {emailPending && email && (
        <section className="border-b border-rule-soft px-5 py-4">
          <label className="flex items-start gap-2.5">
            <input
              type="checkbox"
              checked={sendEmail}
              onChange={(event) => setSendEmail(event.target.checked)}
              className="mt-1 accent-signal"
            />
            <span className="flex-1">
              <span className="eyebrow">Recap email</span>
              <span className="mt-0.5 block font-mono text-[11.5px] text-muted">
                to {email.recipients.join(", ")}
              </span>
            </span>
          </label>

          <div className={sendEmail ? "mt-3" : "mt-3 opacity-40"}>
            {editing ? (
              <div className="space-y-3">
                <label className="block">
                  <span className="eyebrow">Subject</span>
                  <input
                    value={subject}
                    onChange={(event) => setSubject(event.target.value)}
                    disabled={!sendEmail}
                    className="mt-1.5 w-full rounded-md border border-rule bg-surface px-3 py-2 text-[14px] text-ink"
                  />
                </label>
                <label className="block">
                  <span className="eyebrow">Body</span>
                  <textarea
                    value={body}
                    onChange={(event) => setBody(event.target.value)}
                    disabled={!sendEmail}
                    rows={12}
                    className="mt-1.5 w-full rounded-md border border-rule bg-surface px-3 py-2 text-[14px] leading-relaxed text-ink"
                  />
                </label>
              </div>
            ) : (
              <>
                <p className="font-display text-[15px] font-semibold tracking-[-0.015em] text-ink">
                  {subject}
                </p>
                <p className="mt-2 whitespace-pre-wrap text-[13.5px] leading-relaxed text-muted">
                  {body}
                </p>
              </>
            )}
          </div>
        </section>
      )}

      {/* --- The follow-up meeting ------------------------------------------ */}
      {meetingPending && proposal && (
        <section className="px-5 py-4">
          <label className="flex items-start gap-2.5">
            <input
              type="checkbox"
              checked={scheduleMeeting}
              onChange={(event) => setScheduleMeeting(event.target.checked)}
              className="mt-1 accent-signal"
            />
            <span className="flex-1">
              <span className="eyebrow">Follow-up meeting</span>
              <span className="mt-0.5 block font-mono text-[11.5px] text-muted">
                <LocalTime value={new Date(startLocal).toISOString()} /> · {durationMinutes} min
              </span>
            </span>
          </label>

          <div className={scheduleMeeting ? "mt-3" : "mt-3 opacity-40"}>
            {editing ? (
              <div className="space-y-3">
                <label className="block">
                  <span className="eyebrow">Title</span>
                  <input
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    disabled={!scheduleMeeting}
                    className="mt-1.5 w-full rounded-md border border-rule bg-surface px-3 py-2 text-[14px] text-ink"
                  />
                </label>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block">
                    <span className="eyebrow">Starts</span>
                    <input
                      type="datetime-local"
                      value={startLocal}
                      onChange={(event) => setStartLocal(event.target.value)}
                      disabled={!scheduleMeeting}
                      className="mt-1.5 w-full rounded-md border border-rule bg-surface px-3 py-2 font-mono text-[13px] text-ink"
                    />
                  </label>
                  <label className="block">
                    <span className="eyebrow">Length</span>
                    <select
                      value={durationMinutes}
                      onChange={(event) => setDurationMinutes(Number(event.target.value))}
                      disabled={!scheduleMeeting}
                      className="mt-1.5 w-full rounded-md border border-rule bg-surface px-3 py-2 text-[14px] text-ink"
                    >
                      {[15, 30, 45, 60, 90].map((minutes) => (
                        <option key={minutes} value={minutes}>
                          {minutes} minutes
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <label className="block">
                  <span className="eyebrow">Agenda</span>
                  <textarea
                    value={agenda}
                    onChange={(event) => setAgenda(event.target.value)}
                    disabled={!scheduleMeeting}
                    rows={6}
                    className="mt-1.5 w-full rounded-md border border-rule bg-surface px-3 py-2 text-[14px] leading-relaxed text-ink"
                  />
                </label>
              </div>
            ) : (
              <>
                <p className="font-display text-[15px] font-semibold tracking-[-0.015em] text-ink">
                  {title}
                </p>
                {proposal.rationale && (
                  <p className="mt-2 border-l-2 border-rule pl-3 text-[13px] text-muted">
                    {proposal.rationale}
                  </p>
                )}
                <Markdown className="mt-2.5">{agenda}</Markdown>
              </>
            )}
          </div>
        </section>
      )}

      <div className="flex flex-wrap items-center gap-3 border-t border-rule-soft px-5 py-3.5">
        <Button onClick={dispatch} disabled={busy !== null || (!willEmail && !willSchedule)}>
          {busy === "dispatch" ? "Sending…" : actionLabel}
        </Button>
        {meetingPending && (
          <Button variant="danger" onClick={dismiss} disabled={busy !== null}>
            {busy === "dismiss" ? "Dismissing…" : "Dismiss"}
          </Button>
        )}
        <p className="text-[12.5px] text-faint">
          Nothing reaches the customer until you press this.
        </p>
      </div>

      {warning && (
        <p className="border-t border-rule-soft px-5 py-3 text-[13px] text-signal">{warning}</p>
      )}
      {error && (
        <p className="border-t border-rule-soft px-5 py-3 text-[13px] text-flag">{error}</p>
      )}
    </div>
  );
}
