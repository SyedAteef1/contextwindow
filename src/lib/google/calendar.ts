/**
 * Google Calendar, over plain REST.
 *
 * Two jobs: find upcoming *external* meetings, and write an approved follow-up
 * back to the rep's calendar.
 */
import { ConfigurationError } from "@/lib/env";
import { serviceDisabledMessage } from "./service-errors";

const CALENDAR_API = "https://www.googleapis.com/calendar/v3";

export type CalendarEventAttendee = {
  email?: string;
  displayName?: string;
  organizer?: boolean;
  self?: boolean;
  responseStatus?: string;
  resource?: boolean;
};

export type CalendarEvent = {
  id: string;
  status?: string;
  summary?: string;
  description?: string;
  location?: string;
  hangoutLink?: string;
  htmlLink?: string;
  start?: { dateTime?: string; date?: string; timeZone?: string };
  end?: { dateTime?: string; date?: string; timeZone?: string };
  attendees?: CalendarEventAttendee[];
  organizer?: { email?: string; self?: boolean };
  conferenceData?: {
    entryPoints?: { entryPointType?: string; uri?: string }[];
  };
};

async function calendarFetch<T>(
  accessToken: string,
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const response = await fetch(`${CALENDAR_API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });

  if (!response.ok) {
    const body = await response.text();
    const disabled = serviceDisabledMessage(body);
    if (disabled) throw new ConfigurationError(disabled);
    throw new Error(
      `Google Calendar ${init.method ?? "GET"} ${path} failed (${response.status}): ${body}`,
    );
  }
  return (await response.json()) as T;
}

/**
 * Upcoming events on the primary calendar, recurrences already expanded.
 * Pages until exhausted so a busy fortnight isn't silently truncated.
 */
export async function listUpcomingEvents(
  accessToken: string,
  options: { timeMin: Date; timeMax: Date; maxPages?: number },
): Promise<CalendarEvent[]> {
  const events: CalendarEvent[] = [];
  let pageToken: string | undefined;
  const maxPages = options.maxPages ?? 10;

  for (let page = 0; page < maxPages; page++) {
    const params = new URLSearchParams({
      timeMin: options.timeMin.toISOString(),
      timeMax: options.timeMax.toISOString(),
      singleEvents: "true",
      orderBy: "startTime",
      maxResults: "250",
    });
    if (pageToken) params.set("pageToken", pageToken);

    const data = await calendarFetch<{ items?: CalendarEvent[]; nextPageToken?: string }>(
      accessToken,
      `/calendars/primary/events?${params.toString()}`,
    );

    events.push(...(data.items ?? []));
    if (!data.nextPageToken) break;
    pageToken = data.nextPageToken;
  }

  return events;
}

const MEETING_URL_PATTERNS: RegExp[] = [
  /https:\/\/meet\.google\.com\/[a-z-]+/i,
  /https:\/\/[\w.-]*zoom\.us\/j\/\d+(?:\?[^\s<>"]*)?/i,
  /https:\/\/teams\.microsoft\.com\/l\/meetup-join\/[^\s<>"]+/i,
  /https:\/\/teams\.live\.com\/meet\/[^\s<>"]+/i,
];

/**
 * The joinable URL for an event, if there is one.
 *
 * `hangoutLink` and `conferenceData` are the reliable sources; scanning the
 * location and description is the fallback for meetings pasted in by hand.
 */
export function extractMeetingUrl(event: CalendarEvent): string | null {
  if (event.hangoutLink) return event.hangoutLink;

  const videoEntry = event.conferenceData?.entryPoints?.find(
    (entry) => entry.entryPointType === "video" && entry.uri,
  );
  if (videoEntry?.uri) return videoEntry.uri;

  for (const haystack of [event.location, event.description]) {
    if (!haystack) continue;
    for (const pattern of MEETING_URL_PATTERNS) {
      const match = haystack.match(pattern);
      if (match) return match[0];
    }
  }
  return null;
}

function domainOf(email: string | undefined | null): string | null {
  if (!email) return null;
  const domain = email.split("@")[1];
  return domain ? domain.toLowerCase() : null;
}

/**
 * Free mail providers are never a company: a gmail.com attendee is an
 * individual, not an account we should be researching as an organisation.
 */
const CONSUMER_DOMAINS = new Set([
  "gmail.com",
  "googlemail.com",
  "outlook.com",
  "hotmail.com",
  "live.com",
  "yahoo.com",
  "icloud.com",
  "me.com",
  "proton.me",
  "protonmail.com",
  "aol.com",
]);

export function isConsumerDomain(domain: string): boolean {
  return CONSUMER_DOMAINS.has(domain.toLowerCase());
}

export type ExternalMeetingInfo = {
  external: true;
  /** The domain we treat as the account, or null when everyone is on free mail. */
  accountDomain: string | null;
  attendees: {
    email: string;
    displayName: string | null;
    organizer: boolean;
    self: boolean;
    responseStatus: string | null;
    external: boolean;
  }[];
};

/**
 * Classify an event as external, i.e. at least one human attendee outside the
 * rep's own email domain. Rooms and resources are ignored.
 */
export function classifyExternalMeeting(
  event: CalendarEvent,
  userDomain: string,
  userEmail: string,
): ExternalMeetingInfo | null {
  const home = userDomain.toLowerCase();
  const attendees = (event.attendees ?? []).filter((a) => a.email && !a.resource);

  // A solo hold or a self-only event is not a sales call.
  if (attendees.length < 2) return null;

  const mapped = attendees.map((a) => {
    const email = a.email!.toLowerCase();
    return {
      email,
      displayName: a.displayName ?? null,
      organizer: Boolean(a.organizer),
      self: Boolean(a.self) || email === userEmail.toLowerCase(),
      responseStatus: a.responseStatus ?? null,
      external: domainOf(email) !== home,
    };
  });

  const externals = mapped.filter((a) => a.external);
  if (externals.length === 0) return null;

  // Prefer a corporate domain; several externals from one company is the norm.
  const counts = new Map<string, number>();
  for (const attendee of externals) {
    const domain = domainOf(attendee.email);
    if (!domain || isConsumerDomain(domain)) continue;
    counts.set(domain, (counts.get(domain) ?? 0) + 1);
  }

  const accountDomain =
    [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ??
    domainOf(externals[0].email);

  return { external: true, accountDomain, attendees: mapped };
}

/** Company-ish name from a domain: "acme-corp.io" -> "Acme Corp". */
export function companyNameFromDomain(domain: string): string {
  const base = domain.split(".")[0] ?? domain;
  return base
    .split(/[-_]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export type CreateEventInput = {
  summary: string;
  description?: string;
  start: Date;
  end: Date;
  attendeeEmails: string[];
  addGoogleMeet?: boolean;
};

/** Creates the follow-up event. Only ever called after an explicit approval. */
export async function createCalendarEvent(
  accessToken: string,
  input: CreateEventInput,
): Promise<CalendarEvent> {
  const body: Record<string, unknown> = {
    summary: input.summary,
    description: input.description,
    start: { dateTime: input.start.toISOString() },
    end: { dateTime: input.end.toISOString() },
    attendees: input.attendeeEmails.map((email) => ({ email })),
  };

  const params = new URLSearchParams({ sendUpdates: "all" });
  if (input.addGoogleMeet !== false) {
    body.conferenceData = {
      createRequest: {
        // Google requires a caller-supplied idempotency key here.
        requestId: crypto.randomUUID(),
        conferenceSolutionKey: { type: "hangoutsMeet" },
      },
    };
    params.set("conferenceDataVersion", "1");
  }

  return calendarFetch<CalendarEvent>(
    accessToken,
    `/calendars/primary/events?${params.toString()}`,
    { method: "POST", body: JSON.stringify(body) },
  );
}

/** Start/end as real Dates. All-day events have no `dateTime` and are skipped. */
export function eventWindow(event: CalendarEvent): { start: Date; end: Date | null } | null {
  const startIso = event.start?.dateTime;
  if (!startIso) return null;
  const endIso = event.end?.dateTime;
  return { start: new Date(startIso), end: endIso ? new Date(endIso) : null };
}
