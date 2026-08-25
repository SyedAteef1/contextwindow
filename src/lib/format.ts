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

export function clockTime(date: Date | string): string {
  const value = typeof date === "string" ? new Date(date) : date;
  return value.toLocaleTimeString(LOCALE, {
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

export function dayLabel(date: Date | string): string {
  const value = typeof date === "string" ? new Date(date) : date;
  const today = new Date();
  const tomorrow = new Date(today.getTime() + 86_400_000);

  const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  if (sameDay(value, today)) return "Today";
  if (sameDay(value, tomorrow)) return "Tomorrow";

  return value.toLocaleDateString(LOCALE, {
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
export function trimCompanyPrefix(title: string | null, companyName: string): string {
  if (!title) return "Untitled meeting";

  const normalised = title.trim();
  const full = companyName.trim();
  if (!full) return normalised;

  // Agents abbreviate: an account called "Cobalt Systems" gets titles beginning
  // "Cobalt — ...". Try the full name first, then the leading word, but only
  // accept the short form when a separator follows it — otherwise "Cobalt
  // migration plan" would lose its subject.
  const separator = /^\s*[—–\-:|·]\s*/;
  const candidates: { prefix: string; requireSeparator: boolean }[] = [
    { prefix: full, requireSeparator: false },
  ];
  const firstWord = full.split(/\s+/)[0];
  if (firstWord && firstWord.toLowerCase() !== full.toLowerCase()) {
    candidates.push({ prefix: firstWord, requireSeparator: true });
  }

  for (const { prefix, requireSeparator } of candidates) {
    if (!normalised.toLowerCase().startsWith(prefix.toLowerCase())) continue;

    const rest = normalised.slice(prefix.length);
    if (requireSeparator && !separator.test(rest)) continue;

    const remainder = rest.replace(separator, "").trim();
    // A title that is *only* the company name stays as it is.
    if (remainder) return remainder;
  }

  return normalised;
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
