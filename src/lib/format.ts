/**
 * Display formatting shared across the UI.
 *
 * Every formatter pins an explicit locale. Left to the runtime default, the
 * server (Node, often UTC and en-US) and the browser disagree on the rendered
 * string and React reports a hydration mismatch. The locale is fixed here; the
 * *timezone* is deliberately not, because a rep should see their own local time
 * — which is why time-bearing elements render through `<LocalTime>`.
 */
import type { DealStage, MeetingStatus } from "@/db/schema";

/** Fixed so server and client produce byte-identical strings. */
const LOCALE = "en-GB";

export function clockTime(date: Date | string, timeZone?: string | null): string {
  const value = typeof date === "string" ? new Date(date) : date;
  return value.toLocaleTimeString(LOCALE, {
    timeZone: timeZone || undefined,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

/** Date and time together, e.g. "2 Sept 2026, 10:00". */
export function dateTime(date: Date | string): string {
  const value = typeof date === "string" ? new Date(date) : date;
  return `${shortDate(value)}, ${clockTime(value)}`;
}

/**
 * The calendar day a meeting falls on, in the reader's timezone.
 *
 * `YYYY-MM-DD`, which sorts lexically and is unambiguous. This has to agree
 * with the clock time shown beside it: the server runs in UTC, so grouping by
 * its own idea of the date files an 04:00 call under the previous day and
 * prints 04:00 next to it, which is what makes a list look shuffled.
 */
export function dayKey(date: Date | string, timeZone?: string | null): string {
  const value = typeof date === "string" ? new Date(date) : date;
  // en-CA is ISO-ordered, so this is a date key rather than a formatted date.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timeZone || undefined,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(value);
}

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;

export function dayLabel(date: Date | string, timeZone?: string | null): string {
  // A bare `YYYY-MM-DD` is already the calendar date we want to name, so it is
  // formatted in UTC rather than converted again. Round-tripping it through a
  // timestamp would shift the date in zones beyond UTC+12.
  const isKey = typeof date === "string" && DATE_KEY.test(date);
  const value = isKey ? new Date(`${date}T00:00:00Z`) : typeof date === "string" ? new Date(date) : date;
  const zone = isKey ? "UTC" : timeZone || undefined;
  const key = isKey ? date : dayKey(value, timeZone);

  // "Today" is relative to the reader too, not to the server.
  const now = new Date();
  if (key === dayKey(now, timeZone)) return "Today";
  if (key === dayKey(new Date(now.getTime() + 86_400_000), timeZone)) return "Tomorrow";
  if (key === dayKey(new Date(now.getTime() - 86_400_000), timeZone)) return "Yesterday";

  return value.toLocaleDateString(LOCALE, {
    timeZone: zone,
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

export function shortDate(date: Date | string): string {
  const value = typeof date === "string" ? new Date(date) : date;
  return value.toLocaleDateString(LOCALE, { day: "numeric", month: "short", year: "numeric" });
}

/**
 * Distance in *calendar days*, not elapsed hours.
 *
 * Rounding elapsed time gets this wrong at the edges: a meeting two days ago at
 * 14:00, read at 01:53, is 1.5 elapsed days and rounds to "yesterday".
 */
export function relativeDay(date: Date | string, now: Date = new Date()): string {
  const value = typeof date === "string" ? new Date(date) : date;

  const startOfDay = (d: Date) => Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
  const days = Math.round((startOfDay(value) - startOfDay(now)) / 86_400_000);

  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  if (days === -1) return "yesterday";
  return days > 0 ? `in ${days} days` : `${Math.abs(days)} days ago`;
}

/**
 * Drop a leading company-name prefix from a calendar title.
 *
 * Reps name events "Cobalt Systems — platform evaluation", and the company is
 * already the heading, so rendering both reads as a stutter.
 */
export function trimCompanyPrefix(
  title: string | null,
  companyName: string,
  domain?: string | null,
): string {
  if (!title) return "Untitled meeting";

  const normalised = title.trim();
  const full = companyName.trim();
  if (!full) return normalised;

  // Who the call is with is the heading above it, so the title only has to say
  // what the call *is*. Organisers put the company anywhere: in front
  // ("Cobalt — kickoff"), in brackets ("Daily stand up [syncrocore]"), or on the
  // end ("Kickoff | Cobalt"). All three read as repetition in a grouped list.
  const needles = new Set<string>();
  const add = (value: string | null | undefined) => {
    const cleaned = value?.trim().toLowerCase();
    if (cleaned) needles.add(cleaned);
  };
  add(full);
  // The domain label catches the common case where the calendar uses the
  // handle ("syncrocore") and the account carries the prettified name.
  add(domain?.split(".")[0]);
  // Whole words only, to protect a distinct word that merely starts the same.
  add(full.replace(/\s+(inc|llc|ltd|limited|corp|co|gmbh|plc|group)\.?$/i, ""));
  // Organisers abbreviate: "Cobalt Systems" becomes "Cobalt — kickoff". Safe to
  // include because every rule below needs a separator or brackets around it,
  // so "Cobalt migration plan" keeps its subject.
  add(full.split(/\s+/)[0]);

  const SEPARATORS = "—–\\-:|·/,";
  const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const alternatives = [...needles]
    .sort((a, b) => b.length - a.length) // longest first, so "Cobalt Systems" wins over "Cobalt"
    .map(escape)
    .join("|");

  let result = normalised;

  // 1. A bracketed group that is nothing but the company.
  result = result.replace(
    new RegExp(`[\\[({<]\\s*(?:${alternatives})\\s*[\\])}>]`, "gi"),
    " ",
  );
  // 2. Leading company, with or without a separator after it.
  result = result.replace(
    new RegExp(`^\\s*(?:${alternatives})\\s*[${SEPARATORS}]\\s*`, "i"),
    "",
  );
  // 3. Trailing company, but only behind a separator — otherwise "Renewal
  //    Cobalt" and "Cobalt migration plan" lose a real word.
  result = result.replace(
    new RegExp(`\\s*[${SEPARATORS}]\\s*(?:${alternatives})\\s*$`, "i"),
    "",
  );
  // 4. Whatever the removals left behind: stray brackets, doubled separators,
  //    and the leading or trailing punctuation now hanging off the ends.
  result = result
    .replace(/[[({<]\s*[\])}>]/g, " ")
    .replace(new RegExp(`\\s*[${SEPARATORS}]\\s*[${SEPARATORS}]\\s*`, "g"), " — ")
    .replace(new RegExp(`^[\\s${SEPARATORS}]+`), "")
    .replace(new RegExp(`[\\s${SEPARATORS}]+$`), "")
    .replace(/\s{2,}/g, " ")
    .trim();

  // A title that was *only* the company name keeps it: an empty row is worse
  // than a repeated one.
  if (!result) return normalised;

  // The short form is accepted only with a separator, which rules 2 and 3
  // already enforce, so anything surviving here is genuinely the subject.
  return result;
}

/** Rail node appearance, derived from where the meeting is in its lifecycle. */
export function nodeState(status: MeetingStatus): "done" | "live" | "pending" | "blocked" {
  switch (status) {
    case "processed":
    case "transcribed":
      return "done";
    case "recording":
      return "live";
    case "skipped_quota":
    case "failed":
    case "cancelled":
      return "blocked";
    default:
      return "pending";
  }
}

/** Short, plain-language status. Says what happened, not what the enum is called. */
export function statusLabel(status: MeetingStatus): string {
  const labels: Record<MeetingStatus, string> = {
    detected: "Found on calendar",
    brief_pending: "Researching",
    brief_ready: "Brief ready",
    bot_scheduled: "Notetaker booked",
    recording: "Recording",
    transcribed: "Writing summary",
    processed: "Summary ready",
    skipped_quota: "Over free limit",
    failed: "Needs attention",
    cancelled: "Cancelled",
  };
  return labels[status];
}

export function dealStageLabel(stage: DealStage): string {
  const labels: Record<DealStage, string> = {
    discovery: "Discovery",
    qualification: "Qualification",
    proposal: "Proposal",
    negotiation: "Negotiation",
    closed_won: "Closed won",
    closed_lost: "Closed lost",
  };
  return labels[stage];
}

/** Buying interest as a 0-4 meter reading. */
export function signalStrength(interest: string | undefined | null): number {
  switch (interest) {
    case "high":
      return 4;
    case "medium":
      return 3;
    case "low":
      return 2;
    default:
      return 0;
  }
}

export function durationLabel(seconds: number | null | undefined): string | null {
  if (!seconds) return null;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m`;
}
