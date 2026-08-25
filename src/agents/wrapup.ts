/**
 * Wrap-up agent — runs when a transcript lands.
 *
 * Three steps, in order:
 *   1. Summarise into the deliverable format this account expects.
 *   2. Extract structured intent signals.
 *   3. If the signals warrant it, draft a follow-up meeting.
 *   4. Draft the recap email — always, because every call earns its minutes
 *      even when it earns no second meeting.
 *
 * Steps 3 and 4 stop at a draft. The calendar event is created and the email is
 * sent by the dispatch route, on an explicit human click, never here.
 */
import { eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db";
import {
  accounts,
  followupEmails,
  followupProposals,
  meetingSummaries,
  meetings,
  transcripts,
  users,
  type DeliverableType,
  type IntentSignals,
} from "@/db/schema";
import { runStructured, runText } from "@/lib/llm";
import { formatPlaybook, indexDocument, loadPlaybookSnippets } from "@/lib/retrieval";
import { workspaceIdForAccount } from "@/lib/workspace";
import { incrementUsage } from "@/lib/usage";
import {
  FOLLOWUP_EMAIL_SYSTEM,
  FOLLOWUP_SYSTEM,
  INTENT_SYSTEM,
  WRAPUP_SUMMARY_SYSTEM,
  deliverableInstruction,
} from "./prompts";

// --------------------------------------------------------------------------
// Deliverable format
// --------------------------------------------------------------------------

/**
 * Industries whose buyers expect a formal record of the call. Matched as
 * substrings so "Financial Services" and "Health Tech" both land.
 */
const MINUTES_INDUSTRIES = [
  "financ",
  "bank",
  "insur",
  "health",
  "medic",
  "pharma",
  "legal",
  "law",
  "government",
  "public sector",
  "defen",
  "energy",
  "utilit",
];

/** Industries that run long, staged evaluations where sequence matters. */
const TIMELINE_INDUSTRIES = [
  "manufactur",
  "construct",
  "logistic",
  "supply chain",
  "aerospace",
  "automotive",
  "telecom",
];

/**
 * Resolve the summary format: explicit account preference wins, then an
 * industry heuristic, then the rep's own default.
 */
export function resolveDeliverableType(input: {
  accountPreference: DeliverableType | null;
  industry: string | null;
  userDefault: DeliverableType;
}): DeliverableType {
  if (input.accountPreference) return input.accountPreference;

  const industry = input.industry?.toLowerCase() ?? "";
  if (industry) {
    if (MINUTES_INDUSTRIES.some((needle) => industry.includes(needle))) return "meeting_minutes";
    if (TIMELINE_INDUSTRIES.some((needle) => industry.includes(needle))) return "timeline";
  }
  return input.userDefault;
}

// --------------------------------------------------------------------------
// Structured schemas
// --------------------------------------------------------------------------

/**
 * Optional-and-nullable, defaulting to null.
 *
 * `.nullable()` alone permits null but not a *missing* field. Anthropic
 * enforces the schema server-side so every field comes back, but GLM's
 * forced-tool-call path simply omits fields it considers inapplicable — and a
 * schema mismatch there throws away an otherwise good summary. Semantically
 * "absent" and "null" mean the same thing for all of these, so accept both.
 */
const absent = <T extends z.ZodType>(schema: T) => schema.nullish().default(null);

export const intentSchema = z.object({
  buyingInterest: z.enum(["high", "medium", "low", "none"]),
  interestRationale: z.string().describe("One or two sentences citing what in the call drove this rating."),
  objections: z
    .array(
      z.object({
        objection: z.string(),
        severity: z.enum(["high", "medium", "low"]),
        quote: absent(z.string()).describe("Verbatim quote from the transcript, or null."),
      }),
    )
    .default([]),
  nextSteps: z
    .array(
      z.object({
        step: z.string(),
        owner: z.enum(["us", "them", "both"]),
        dueDate: absent(z.string()).describe("ISO date if one was stated, else null."),
      }),
    )
    .default([]),
  competitorsMentioned: z.array(z.string()).default([]),
  budgetSignals: z.array(z.string()).default([]),
  timelineSignals: z.array(z.string()).default([]),
  followupRecommended: z.boolean(),
  followupRationale: z.string(),
  suggestedFollowupDays: absent(z.number().int()).describe(
    "Days from now for the follow-up, or null if none is recommended.",
  ),
});

export const followupSchema = z.object({
  title: z.string(),
  agenda: z.string().describe("Markdown bullets, drawn from what the call left open."),
  rationale: z.string(),
  startIso: z.string().describe("ISO 8601 datetime with timezone offset."),
  durationMinutes: z.number().int().min(15).max(120),
  attendeeEmails: z.array(z.string()).default([]),
});

export const followupEmailSchema = z.object({
  subject: z.string().describe("Findable in six weeks: names the company and the substance."),
  body: z.string().describe("Plain text. Blank lines between paragraphs, '- ' for bullets."),
});

// --------------------------------------------------------------------------
// Transcript rendering
// --------------------------------------------------------------------------

function formatTimestamp(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

/**
 * Render the transcript for the model.
 *
 * Prefers diarised segments — speaker attribution is most of what makes a
 * summary useful — and falls back to raw text when the bot gave us no
 * speaker information.
 */
export function renderTranscript(transcript: {
  rawText: string;
  speakerSegments: { speakerName: string; timestampMs: number; text: string }[] | null;
}): string {
  const segments = transcript.speakerSegments;
  if (!segments?.length) return transcript.rawText.trim();

  return segments
    .filter((segment) => segment.text?.trim())
    .map(
      (segment) =>
        `[${formatTimestamp(segment.timestampMs)}] ${segment.speakerName}: ${segment.text.trim()}`,
    )
    .join("\n");
}

// --------------------------------------------------------------------------
// The pipeline
// --------------------------------------------------------------------------

export type WrapupResult = {
  summaryId: string;
  content: string;
  deliverableType: DeliverableType;
  intentSignals: IntentSignals;
  followupProposalId: string | null;
  followupEmailId: string | null;
  chunksIndexed: number;
};

export async function runWrapup(meetingId: string): Promise<WrapupResult> {
  const meeting = await db.query.meetings.findFirst({ where: eq(meetings.id, meetingId) });
  if (!meeting) throw new Error(`Meeting ${meetingId} not found`);

  const transcript = await db.query.transcripts.findFirst({
    where: eq(transcripts.meetingId, meetingId),
  });
  if (!transcript) throw new Error(`No transcript stored for meeting ${meetingId}`);

  const account = await db.query.accounts.findFirst({ where: eq(accounts.id, meeting.accountId) });
  if (!account) throw new Error(`Account ${meeting.accountId} not found`);

  const owner = await db.query.users.findFirst({ where: eq(users.id, meeting.ownerUserId) });
  if (!owner) throw new Error(`Owner ${meeting.ownerUserId} not found`);

  const transcriptText = renderTranscript(transcript);
  if (!transcriptText.trim()) {
    throw new Error(`Transcript for meeting ${meetingId} is empty`);
  }

  const deliverableType = resolveDeliverableType({
    accountPreference: account.deliverablePreference,
    industry: account.industry,
    userDefault: owner.defaultDeliverableType,
  });

  const playbook = formatPlaybook(
    await loadPlaybookSnippets({
      ownerUserId: owner.id,
      accountId: account.id,
      audience: "wrapup",
      industry: account.industry,
    }),
  );

  const meetingContext = [
    `Company: ${account.companyName} (${account.domain})`,
    account.industry ? `Industry: ${account.industry}` : null,
    `Deal stage: ${account.dealStage}`,
    meeting.title ? `Meeting: ${meeting.title}` : null,
    `Date: ${meeting.scheduledAt.toISOString()}`,
    `Rep: ${owner.name ?? owner.email}`,
  ]
    .filter(Boolean)
    .join("\n");

  // --- Step 1: the deliverable -------------------------------------------
  const summary = await runText({
    system: `${WRAPUP_SUMMARY_SYSTEM}\n${deliverableInstruction(deliverableType)}`,
    messages: [
      {
        role: "user",
        content: [
          `## Call context`,
          meetingContext,
          playbook ? `\n## Our sales playbook\n${playbook}` : "",
          `\n## Transcript`,
          transcriptText,
        ]
          .filter(Boolean)
          .join("\n"),
      },
    ],
  });

  if (!summary.text.trim()) throw new Error("Wrap-up agent returned an empty summary");

  // --- Step 2: intent signals --------------------------------------------
  const intentSignals = (await runStructured({
    system: INTENT_SYSTEM,
    schema: intentSchema,
    messages: [
      {
        role: "user",
        content: [`## Call context`, meetingContext, `\n## Transcript`, transcriptText].join("\n"),
      },
    ],
  })) as IntentSignals;

  const [summaryRow] = await db
    .insert(meetingSummaries)
    .values({
      meetingId: meeting.id,
      content: summary.text,
      intentSignals,
      deliverableType,
    })
    .onConflictDoUpdate({
      target: meetingSummaries.meetingId,
      set: {
        content: summary.text,
        intentSignals,
        deliverableType,
        generatedAt: new Date(),
      },
    })
    .returning();

  const chunksIndexed = await indexDocument({
    workspaceId: await workspaceIdForAccount(account.id),
    accountId: account.id,
    sourceType: "summary",
    sourceId: summaryRow.id,
    content: summary.text,
    meta: {
      meetingId: meeting.id,
      meetingTitle: meeting.title,
      scheduledAt: meeting.scheduledAt.toISOString(),
      label: `Summary — ${meeting.scheduledAt.toISOString().slice(0, 10)}`,
    },
  });

  // --- Step 3: the follow-up draft ---------------------------------------
  let followupProposalId: string | null = null;
  if (intentSignals.followupRecommended) {
    followupProposalId = await draftFollowup({
      meetingId: meeting.id,
      accountId: account.id,
      meetingContext,
      summaryText: summary.text,
      intentSignals,
      attendeeEmails: (meeting.attendees ?? []).map((attendee) => attendee.email),
      meetingEndedAt: meeting.endsAt ?? meeting.scheduledAt,
    });
  }

  // --- Step 4: the recap email -------------------------------------------
  // Unconditional: a call that warrants no second meeting still owes the
  // attendees their minutes.
  const proposal = followupProposalId
    ? await db.query.followupProposals.findFirst({
        where: eq(followupProposals.id, followupProposalId),
      })
    : null;

  const followupEmailId = await draftRecapEmail({
    meetingId: meeting.id,
    accountId: account.id,
    meetingContext,
    summaryText: summary.text,
    intentSignals,
    repFirstName: (owner.name ?? owner.email).split(/[\s@.]/)[0],
    // The rep sends from their own mailbox, so they are never a recipient.
    recipients: (meeting.attendees ?? [])
      .filter((attendee) => !attendee.self && attendee.email !== owner.email)
      .map((attendee) => attendee.email),
    proposal: proposal
      ? {
          title: proposal.title,
          agenda: proposal.agenda,
          proposedStart: proposal.proposedStart,
        }
      : null,
  });

  await db
    .update(meetings)
    .set({ status: "processed", updatedAt: new Date() })
    .where(eq(meetings.id, meeting.id));

  // Only meter a meeting once its processing actually succeeded.
  await incrementUsage(owner.id);

  return {
    summaryId: summaryRow.id,
    content: summary.text,
    deliverableType,
    intentSignals,
    followupProposalId,
    followupEmailId,
    chunksIndexed,
  };
}

/**
 * Draft a follow-up and park it as `pending`.
 *
 * A drafting failure must not fail the wrap-up: the summary and intent are the
 * valuable part, and the rep can always schedule by hand.
 */
async function draftFollowup(input: {
  meetingId: string;
  accountId: string;
  meetingContext: string;
  summaryText: string;
  intentSignals: IntentSignals;
  attendeeEmails: string[];
  meetingEndedAt: Date;
}): Promise<string | null> {
  try {
    const suggestedDays = input.intentSignals.suggestedFollowupDays ?? 7;
    const anchor = new Date(input.meetingEndedAt.getTime() + suggestedDays * 86_400_000);

    const draft = await runStructured({
      system: FOLLOWUP_SYSTEM,
      schema: followupSchema,
      messages: [
        {
          role: "user",
          content: [
            `## Call context`,
            input.meetingContext,
            ``,
            `## Current time`,
            new Date().toISOString(),
            ``,
            `## Suggested timing`,
            `The intent extraction suggested roughly ${suggestedDays} days out, i.e. around ${anchor.toISOString()}. Adjust if the call implied something different.`,
            ``,
            `## People on the original invite`,
            input.attendeeEmails.length ? input.attendeeEmails.join(", ") : "None recorded.",
            ``,
            `## What the call left open`,
            `Reason a follow-up is warranted: ${input.intentSignals.followupRationale}`,
            `Next steps committed to: ${
              input.intentSignals.nextSteps.length
                ? input.intentSignals.nextSteps
                    .map((step) => `${step.step} (owner: ${step.owner})`)
                    .join("; ")
                : "none recorded"
            }`,
            `Open objections: ${
              input.intentSignals.objections.length
                ? input.intentSignals.objections.map((o) => o.objection).join("; ")
                : "none recorded"
            }`,
            ``,
            `## Call summary`,
            input.summaryText,
          ].join("\n"),
        },
      ],
    });

    const start = new Date(draft.startIso);
    if (Number.isNaN(start.getTime())) {
      throw new Error(`Follow-up draft returned an unparseable start time: ${draft.startIso}`);
    }
    const end = new Date(start.getTime() + draft.durationMinutes * 60_000);

    const [proposal] = await db
      .insert(followupProposals)
      .values({
        meetingId: input.meetingId,
        accountId: input.accountId,
        title: draft.title,
        agenda: draft.agenda,
        rationale: draft.rationale,
        proposedStart: start,
        proposedEnd: end,
        // Fall back to the original invite list if the model proposed nobody.
        attendeeEmails: draft.attendeeEmails.length ? draft.attendeeEmails : input.attendeeEmails,
        status: "pending",
      })
      .returning();

    return proposal.id;
  } catch (error) {
    console.error(`Follow-up drafting failed for meeting ${input.meetingId}:`, error);
    return null;
  }
}

/**
 * Draft the recap email and park it as `pending`.
 *
 * Like the follow-up draft, a failure here must not fail the wrap-up — the
 * summary and the intent signals are the durable value, and a rep can always
 * write the email themselves.
 *
 * The intent signals go in as *steering only*. They shape which objection gets
 * addressed and which next step gets confirmed; the prompt forbids repeating
 * them, because a customer must never read their own buying-interest score.
 */
async function draftRecapEmail(input: {
  meetingId: string;
  accountId: string;
  meetingContext: string;
  summaryText: string;
  intentSignals: IntentSignals;
  repFirstName: string;
  recipients: string[];
  proposal: { title: string; agenda: string; proposedStart: Date } | null;
}): Promise<string | null> {
  // With nobody to send to there is nothing to draft. The summary still stands.
  if (input.recipients.length === 0) return null;

  try {
    const { intentSignals } = input;
    const draft = await runStructured({
      system: FOLLOWUP_EMAIL_SYSTEM,
      schema: followupEmailSchema,
      messages: [
        {
          role: "user",
          content: [
            `## Call context`,
            input.meetingContext,
            `Rep's first name (sign off with this): ${input.repFirstName}`,
            `Recipients: ${input.recipients.join(", ")}`,
            ``,
            `## What was covered`,
            input.summaryText,
            ``,
            `## Steering — internal only, never repeat any of this in the email`,
            `Objections to address: ${
              intentSignals.objections.length
                ? intentSignals.objections
                    .map((item) => `${item.objection} (${item.severity})`)
                    .join("; ")
                : "none raised"
            }`,
            `Next steps to confirm: ${
              intentSignals.nextSteps.length
                ? intentSignals.nextSteps
                    .map(
                      (step) =>
                        `${step.step} (owner: ${step.owner}${step.dueDate ? `, due ${step.dueDate}` : ""})`,
                    )
                    .join("; ")
                : "none committed to"
            }`,
            ``,
            `## Proposed next meeting`,
            input.proposal
              ? `"${input.proposal.title}" around ${input.proposal.proposedStart.toISOString()}. Purpose: ${input.proposal.agenda}`
              : `None. Do not offer or imply another meeting.`,
          ].join("\n"),
        },
      ],
    });

    const [row] = await db
      .insert(followupEmails)
      .values({
        meetingId: input.meetingId,
        accountId: input.accountId,
        subject: draft.subject,
        body: draft.body,
        recipients: input.recipients,
      })
      // Re-processing a meeting replaces the draft, but never a sent email.
      .onConflictDoUpdate({
        target: followupEmails.meetingId,
        set: {
          subject: draft.subject,
          body: draft.body,
          recipients: input.recipients,
          updatedAt: new Date(),
        },
        setWhere: eq(followupEmails.status, "pending"),
      })
      .returning();

    return row?.id ?? null;
  } catch (error) {
    console.warn(`Recap email draft failed for meeting ${input.meetingId}:`, error);
    return null;
  }
}
