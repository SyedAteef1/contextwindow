/**
 * Research agent — the pre-call brief.
 *
 * Runs when a new external meeting is detected. Uses Claude with server-side
 * web search, writes to `meeting_briefs`, and indexes the result so the brief
 * is retrievable by the chat agent from the moment it exists.
 */
import { eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db";
import {
  accounts,
  contacts as contactsTable,
  meetingBriefs,
  meetings,
  users,
  workspaces,
  type Citation,
} from "@/db/schema";
import { runStructured, runText } from "@/lib/llm";
import { formatPlaybook, indexDocument, loadPlaybookSnippets } from "@/lib/retrieval";
import { workspaceIdForAccount } from "@/lib/workspace";
import { RESEARCH_SYSTEM } from "./prompts";
import { sendBriefEmail } from "@/lib/brief-email";
import { trackNow } from "@/lib/activity";
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
  /** Who the *seller* is, in their own words. Read off their website at sign-up. */
  seller?: { name: string; sells: string | null; idealCustomer: string | null } | null;
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

  if (input.seller && (input.seller.sells || input.seller.idealCustomer)) {
    lines.push("");
    lines.push(`## Who we are (the seller)`);
    lines.push(`We are ${input.seller.name}.`);
    if (input.seller.sells) {
      lines.push("");
      lines.push(`What we sell, from our own website:`);
      lines.push(input.seller.sells);
    }
    if (input.seller.idealCustomer) {
      lines.push("");
      lines.push(`Who we are looking for: ${input.seller.idealCustomer}`);
      lines.push(
        `Judge this buyer against that. Say plainly where they do not fit — a brief that flatters a bad prospect costs the rep the call.`,
      );
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

  // The seller's own context, gathered once at sign-up. Loaded here rather
  // than threaded through every caller: a brief is worth less without it, and
  // no caller should be able to forget it.
  const sellerWorkspace = await db.query.workspaces.findFirst({
    where: eq(workspaces.id, await workspaceIdForAccount(account.id)),
  });

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
    seller: sellerWorkspace
      ? {
          name: sellerWorkspace.name,
          sells: sellerWorkspace.description,
          idealCustomer: sellerWorkspace.idealCustomer,
        }
      : null,
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

  const facts = await extractFacts(result.text, account.companyName);

  const [brief] = await db
    .insert(meetingBriefs)
    .values({
      meetingId: meeting.id,
      content: result.text,
      citations: result.citations,
      facts,
    })
    .onConflictDoUpdate({
      target: meetingBriefs.meetingId,
      set: {
        content: result.text,
        citations: result.citations,
        facts,
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
      workspaceId: await workspaceIdForAccount(account.id),
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

  /*
   * Awaited, unlike the routes.
   *
   * `track` is fire-and-forget because an HTTP handler has a person waiting on
   * it. This is a background job that already took seconds, so one awaited
   * insert costs nothing — and an insert still in flight after the job returns
   * holds a row lock on `users` that will deadlock against anything taking an
   * exclusive lock, which is exactly how this surfaced in the tests.
   */
  await trackNow({
    userId: meeting.ownerUserId,
    action: "brief_generated",
    subjectType: "meeting",
    subjectId: meeting.id,
    detail: { citations: result.citations.length, chunks: chunksIndexed },
  });

  return {
    briefId: brief.id,
    content: result.text,
    citations: result.citations,
    chunksIndexed,
    precomputed,
  };
}

/** What a rep scans in the two minutes before a call. */
const FACTS_SCHEMA = z.object({
  facts: z
    .array(
      z.object({
        /** One or two words. It is a column header, not a sentence. */
        label: z.string(),
        /** Short enough to read at a glance — a figure, a place, a stage. */
        value: z.string(),
      }),
    )
    .max(6),
});

/**
 * Lift the scannable facts out of a brief that has already been written.
 *
 * Run against our own prose rather than the web: it costs one cheap call, it
 * cannot contradict the paragraphs underneath it, and there is nothing to
 * verify because everything it can say is already cited above.
 *
 * Never throws. A brief without a fact strip is a brief; a brief that failed to
 * save because a summariser hiccuped is nothing.
 */
async function extractFacts(
  content: string,
  companyName: string,
): Promise<{ label: string; value: string }[] | null> {
  try {
    const result = await runStructured({
      schema: FACTS_SCHEMA,
      system:
        "You pull the few facts a salesperson scans before a call. Use only what the brief states. " +
        "Prefer: what they do, where they are, stage or size, money raised, who decides, the one risk. " +
        "Labels are one or two words. Values are short — a figure, a place, a phrase, never a sentence. " +
        "Omit anything the brief does not say rather than guessing.",
      messages: [
        { role: "user", content: `Brief on ${companyName}:\n\n${content}` },
      ],
      maxTokens: 500,
    });
    const facts = result.facts
      .filter((fact) => fact.label.trim() && fact.value.trim())
      .slice(0, 6);
    return facts.length > 0 ? facts : null;
  } catch (error) {
    console.error(`Extracting facts for ${companyName} failed:`, error);
    return null;
  }
}
