/**
 * Research agent — the pre-call brief.
 *
 * Runs when a new external meeting is detected. Uses Claude with server-side
 * web search, writes to `meeting_briefs`, and indexes the result so the brief
 * is retrievable by the chat agent from the moment it exists.
 */
import { eq } from "drizzle-orm";

import { db } from "@/db";
import {
  accounts,
  contacts as contactsTable,
  meetingBriefs,
  meetings,
  users,
  type Citation,
} from "@/db/schema";
import { runText } from "@/lib/llm";
import { formatPlaybook, indexDocument, loadPlaybookSnippets } from "@/lib/retrieval";
import { RESEARCH_SYSTEM } from "./prompts";
import { sendBriefEmail } from "@/lib/brief-email";
import { precomputeAnswers } from "./precompute";

export type BriefResult = {
  briefId: string;
  content: string;
  citations: Citation[];
  chunksIndexed: number;
  /** Answers written ahead of the call, for instant mid-call lookup. */
  precomputed: number;
};

/**
 * Build the user turn.
 *
 * Everything volatile lives here rather than in the system prompt, so the
 * cached system prefix stays byte-identical across meetings.
 */
function buildResearchRequest(input: {
  companyName: string;
  domain: string;
  industry: string | null;
  dealStage: string;
  meetingTitle: string | null;
  scheduledAt: Date;
  externalAttendees: { email: string; displayName: string | null }[];
  knownContacts: { name: string | null; role: string | null; email: string }[];
  playbook: string;
}): string {
  const lines: string[] = [];

  lines.push(`Research this company and these people for an upcoming sales call.`);
  lines.push("");
  lines.push(`## The call`);
  lines.push(`- Company: ${input.companyName}`);
  lines.push(`- Website domain: ${input.domain}`);
  if (input.industry) lines.push(`- Industry (as recorded in our CRM): ${input.industry}`);
  lines.push(`- Deal stage (as recorded in our CRM): ${input.dealStage}`);
  if (input.meetingTitle) lines.push(`- Calendar title: ${input.meetingTitle}`);
  lines.push(`- Scheduled: ${input.scheduledAt.toISOString()}`);

  lines.push("");
  lines.push(`## People on the invite (external)`);
  if (input.externalAttendees.length === 0) {
    lines.push(`- None recorded.`);
  } else {
    for (const attendee of input.externalAttendees) {
      const name = attendee.displayName ? `${attendee.displayName} <${attendee.email}>` : attendee.email;
      lines.push(`- ${name}`);
    }
  }

  if (input.knownContacts.length > 0) {
    lines.push("");
    lines.push(`## What our CRM already holds on these people`);
    lines.push(
      `Treat this as prior context we recorded, not as verified fact. Confirm it before relying on it.`,
    );
    for (const contact of input.knownContacts) {
      const parts = [contact.name ?? contact.email];
      if (contact.role) parts.push(contact.role);
      lines.push(`- ${parts.join(" — ")}`);
    }
  }

  if (input.playbook) {
    lines.push("");
    lines.push(`## Our sales playbook (what we care about qualifying)`);
    lines.push(input.playbook);
  }

  lines.push("");
  lines.push(
    `Search the web for what you can verify, then write the brief. Where you find nothing, say so rather than filling the space.`,
  );

  return lines.join("\n");
}

/**
 * Generate and store the brief for a meeting.
 *
 * The free-tier check happens in the pipeline before this is called, not here,
 * so that a manual "regenerate brief" from the UI is never blocked by a meter
 * the rep already paid against for this meeting.
 */
export async function generateMeetingBrief(meetingId: string): Promise<BriefResult> {
  const meeting = await db.query.meetings.findFirst({ where: eq(meetings.id, meetingId) });
  if (!meeting) throw new Error(`Meeting ${meetingId} not found`);

  const account = await db.query.accounts.findFirst({ where: eq(accounts.id, meeting.accountId) });
  if (!account) throw new Error(`Account ${meeting.accountId} not found`);

  const owner = await db.query.users.findFirst({ where: eq(users.id, meeting.ownerUserId) });
  if (!owner) throw new Error(`Owner ${meeting.ownerUserId} not found`);

  const knownContacts = await db
    .select({
      name: contactsTable.name,
      role: contactsTable.role,
      email: contactsTable.email,
    })
    .from(contactsTable)
    .where(eq(contactsTable.accountId, account.id));

  const externalAttendees = (meeting.attendees ?? [])
    .filter((attendee) => attendee.external)
    .map((attendee) => ({ email: attendee.email, displayName: attendee.displayName ?? null }));

  const playbook = formatPlaybook(
    await loadPlaybookSnippets({
      ownerUserId: owner.id,
      accountId: account.id,
      audience: "research",
      industry: account.industry,
    }),
  );

  const prompt = buildResearchRequest({
    companyName: account.companyName,
    domain: account.domain,
    industry: account.industry,
    dealStage: account.dealStage,
    meetingTitle: meeting.title,
    scheduledAt: meeting.scheduledAt,
    externalAttendees,
    knownContacts,
    playbook,
  });

  const result = await runText({
    system: RESEARCH_SYSTEM,
    messages: [{ role: "user", content: prompt }],
    // Anthropic serves this with its hosted search tool; GLM with a
    // client-side tool backed by Z.ai's Web Search API. Same prompt either way.
    webSearch: true,
    // The system prompt is long and identical on every call — worth caching.
    cacheSystem: true,
  });

  if (!result.text.trim()) {
    throw new Error("Research agent returned an empty brief");
  }

  const [brief] = await db
    .insert(meetingBriefs)
    .values({
      meetingId: meeting.id,
      content: result.text,
      citations: result.citations,
    })
    .onConflictDoUpdate({
      target: meetingBriefs.meetingId,
      set: {
        content: result.text,
        citations: result.citations,
        generatedAt: new Date(),
        // A regenerated brief has not been delivered yet.
        notifiedAt: null,
      },
    })
    .returning();

  // Indexing is best-effort, for the same reason precomputing is below: the
  // brief is already written and already useful. Letting an embedding outage
  // throw here would abort *after* the save, leaving a meeting that has a brief
  // and an error at once — and because a brief exists, the sync would skip it
  // forever rather than retrying. Degrade to an unindexed brief instead.
  let chunksIndexed = 0;
  try {
    chunksIndexed = await indexDocument({
      accountId: account.id,
      sourceType: "brief",
      sourceId: brief.id,
      content: result.text,
      meta: {
        meetingId: meeting.id,
        meetingTitle: meeting.title,
        scheduledAt: meeting.scheduledAt.toISOString(),
        label: `Brief — ${meeting.scheduledAt.toISOString().slice(0, 10)}`,
      },
    });
  } catch (error) {
    console.error(`Indexing the brief for meeting ${meeting.id} failed:`, error);
  }

  await db
    .update(meetings)
    // The brief succeeded, so any error from a previous attempt is stale and
    // must not keep showing on the meeting.
    .set({ status: "brief_ready", errorMessage: null, updatedAt: new Date() })
    .where(eq(meetings.id, meeting.id));

  // Now that the brief exists, write the answers the buyer is likely to ask
  // for. This is the moment there is no latency pressure, which is exactly why
  // it happens here rather than mid-call.
  let precomputed = 0;
  try {
    precomputed = (await precomputeAnswers(meeting.id)).generated;
  } catch (error) {
    // A brief without a cache is still a good brief; the live agent falls back
    // to generating on demand.
    console.error(`Precomputing answers failed for meeting ${meeting.id}:`, error);
  }

  // Best-effort, like indexing above: the brief exists and is useful whether or
  // not the mail goes out, and a Gmail outage must not fail research.
  try {
    const delivery = await sendBriefEmail(meeting.id);
    if (!delivery.sent && delivery.reason !== "disabled" && delivery.reason !== "already emailed") {
      console.warn(`Brief email skipped for meeting ${meeting.id}: ${delivery.reason}`);
    }
  } catch (error) {
    console.error(`Emailing the brief for meeting ${meeting.id} failed:`, error);
  }

  return {
    briefId: brief.id,
    content: result.text,
    citations: result.citations,
    chunksIndexed,
    precomputed,
  };
}
