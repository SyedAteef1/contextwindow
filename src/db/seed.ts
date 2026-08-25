/**
 * Seed a demonstrable account.
 *
 * Populates one rep with two companies, a completed call (transcript, summary,
 * intent signals, a pending follow-up) and two upcoming calls with briefs — then
 * indexes everything so the chat agent has real material to retrieve.
 *
 * Written straight to the database rather than through the agents, so the demo
 * works with no Anthropic, Google, or bot credentials. Run: `npm run db:seed`.
 */
import "dotenv/config";
import { eq } from "drizzle-orm";

import { db, sqlClient } from "./index";
import {
  accounts,
  contacts,
  followupProposals,
  meetingBriefs,
  meetingSummaries,
  meetings,
  playbookSnippets,
  transcripts,
  usage,
  users,
  type IntentSignals,
  type SpeakerSegment,
} from "./schema";
import { indexDocument } from "@/lib/retrieval";

const REP_EMAIL = "rep@northstar.io";

function at(dayOffset: number, hour: number, minute = 0): Date {
  const date = new Date();
  date.setDate(date.getDate() + dayOffset);
  date.setHours(hour, minute, 0, 0);
  return date;
}

const TRANSCRIPT_TURNS: [string, string][] = [
  ["Priya Raman", "Thanks for making the time. Before we start — how much did Dan brief you on where we've got to internally?"],
  ["Alex Chen", "He said you'd shortlisted three vendors and we were one of them. Beyond that, not much."],
  ["Priya Raman", "That's about right. We're replacing a system that's been in place seven years. The finance team is the blocker, not us."],
  ["Alex Chen", "What's their objection?"],
  ["Priya Raman", "Two things. The migration window, and the fact that the last vendor promised eight weeks and took nine months. There's scar tissue."],
  ["Alex Chen", "That's fair. For a dataset your size we'd normally run the migration in parallel — your existing system stays live until you cut over. Nobody's forced onto a deadline."],
  ["Priya Raman", "Parallel would help. Can you put that in writing? Marcus will ask."],
  ["Alex Chen", "Yes. I'll send a migration plan with the parallel-run detail this week."],
  ["Marcus Webb", "Sorry, joining late. Priya, did you cover the SOC 2 question?"],
  ["Priya Raman", "Not yet."],
  ["Marcus Webb", "We can't sign anything without a current SOC 2 Type II report. Our last audit flagged vendor management."],
  ["Alex Chen", "We have Type II, renewed in March. I can share it under NDA today."],
  ["Marcus Webb", "Today would be good. That's the gate for me."],
  ["Alex Chen", "Understood. What does the rest of your process look like after that?"],
  ["Marcus Webb", "Security review takes about two weeks. Then it goes to the board — they meet on the 12th of next month. If we miss that, it's another month."],
  ["Priya Raman", "Which is why we're trying to move now rather than in Q3."],
  ["Alex Chen", "Then let's work backwards from the 12th. If security starts this week you'd clear it with room to spare."],
  ["Marcus Webb", "Budget's provisionally approved at the number Dan discussed, assuming the security piece lands."],
  ["Alex Chen", "Good. So: migration plan and SOC 2 report from me this week, security review starts, and we reconvene before the board date."],
  ["Priya Raman", "That works. Send the SOC 2 to Marcus directly."],
];

const INTENT: IntentSignals = {
  buyingInterest: "high",
  interestRationale:
    "Budget is provisionally approved, a board date is named, and the buyer volunteered their internal approval sequence unprompted. Two concrete signals plus a stated timeline.",
  objections: [
    {
      objection: "Finance distrusts vendor migration timelines after a previous nine-month overrun.",
      severity: "high",
      quote: "the last vendor promised eight weeks and took nine months. There's scar tissue.",
    },
    {
      objection: "Cannot sign without a current SOC 2 Type II report; flagged in their last audit.",
      severity: "high",
      quote: "We can't sign anything without a current SOC 2 Type II report.",
    },
  ],
  nextSteps: [
    { step: "Send the migration plan covering the parallel-run approach", owner: "us", dueDate: null },
    { step: "Share the SOC 2 Type II report with Marcus under NDA", owner: "us", dueDate: null },
    { step: "Begin the two-week security review", owner: "them", dueDate: null },
  ],
  competitorsMentioned: ["Two other shortlisted vendors, unnamed"],
  budgetSignals: ["Provisionally approved at the figure previously discussed, contingent on security sign-off"],
  timelineSignals: ["Board meets on the 12th of next month", "Security review takes roughly two weeks"],
  followupRecommended: true,
  followupRationale:
    "Two deliverables were promised and a two-week security review has to complete before a fixed board date. A checkpoint before that date is what keeps the deal on this cycle.",
  suggestedFollowupDays: 14,
};

const SUMMARY = `**The short version**

Cobalt Systems is replacing a seven-year-old system and we're one of three shortlisted. The buyers want to move; finance and security are the gates. Budget is provisionally approved and there is a hard board date on the 12th of next month.

**What they told us**

Priya owns the evaluation and is not the obstacle — finance is. The scepticism is specific rather than general: a previous vendor quoted eight weeks and delivered in nine months, and that history now shapes how any migration commitment is read. Marcus, joining late, named a firm gate: no signature without a current SOC 2 Type II report, following an audit finding on vendor management. Their sequence is security review (about two weeks), then board approval on the 12th.

**What we told them**

Alex offered a parallel-run migration — their existing system stays live until cutover — which directly answers the timeline objection rather than arguing with it. Priya asked for that in writing, which is a good sign. Alex confirmed a Type II report renewed in March and offered to share it same-day under NDA.

**Where it stands**

Strong. The buyer volunteered their approval path and their budget position without being asked, which is what genuine intent looks like. The risk is not desire, it's the calendar: if the security review doesn't start this week, the board date slips a month.

**Next steps**

- Send the migration plan with the parallel-run detail — ours, this week
- Share the SOC 2 Type II report with Marcus under NDA — ours, today
- Begin the two-week security review — theirs
- Reconvene before the board meeting on the 12th — shared`;

const BRIEF_COBALT = `**Company snapshot**

Cobalt Systems builds industrial monitoring software for mid-market manufacturers. They sell to plant operations teams rather than IT, which usually means procurement runs through operations budgets and security review is a gate rather than a formality.

**Recent signals**

- Announced a Series B in January; the release named "platform modernisation" as a use of funds. (Company newsroom)
- Job postings in the last quarter skew toward platform and data engineering rather than feature work, consistent with a replacement project rather than an expansion. (Company careers page)

**Who you're meeting**

*Priya Raman* — Listed as Director of Platform Operations on the company site. Her public writing focuses on migration risk and phased rollouts.

*Marcus Webb* — No public information found beyond the calendar invite. Treat his role as unconfirmed.

**Why this call, likely**

Likely, based on the funding announcement and the hiring pattern: this is a replacement evaluation with budget already allocated, rather than exploratory research. Labelled as inference — nothing published states this directly.

**Questions worth asking**

- What did the previous system fail at specifically, rather than in general?
- Who has to sign off besides the people on this call, and in what order?
- Is there a date you're working backwards from?
- What would make you rule a vendor out early?

**Watch-outs**

Their Series B release emphasised a partnership with a systems integrator. Worth establishing early whether that integrator has a preferred vendor in this category.`;

const BRIEF_MERIDIAN = `**Company snapshot**

Meridian Health operates outpatient clinics across three states. As a healthcare provider they are subject to HIPAA, which shapes both what they can adopt and how long adoption takes.

**Recent signals**

- No verifiable recent announcements found. Their newsroom has not been updated in over a year.

**Who you're meeting**

*Dr. Elena Farrow* — Named as Chief Medical Informatics Officer on the clinic network's leadership page.

*Tom Brennan* — No public information found on anyone by that name at Meridian Health. Do not assume a role.

**Why this call, likely**

Likely, based only on the attendee mix — a clinical informatics lead plus an unidentified second attendee — that this is an early evaluation rather than a procurement conversation. Labelled as inference; the research found nothing to confirm it.

**Questions worth asking**

- Who owns the decision between clinical and IT leadership?
- What does your security review process look like, and how long does it usually take?
- Are you replacing something, or is this net new?

**Watch-outs**

No public information was found on their current vendor landscape or on recent procurement activity. Go in expecting to learn rather than to position.`;

async function main() {
  console.log("Seeding…");

  const [rep] = await db
    .insert(users)
    .values({
      email: REP_EMAIL,
      name: "Sam Okonkwo",
      emailDomain: "northstar.io",
      defaultDeliverableType: "plain_summary",
    })
    .onConflictDoUpdate({ target: users.email, set: { updatedAt: new Date() } })
    .returning();

  // Idempotent: wipe this rep's demo data so re-seeding is safe.
  await db.delete(accounts).where(eq(accounts.ownerUserId, rep.id));
  await db.delete(playbookSnippets).where(eq(playbookSnippets.ownerUserId, rep.id));

  const [cobalt] = await db
    .insert(accounts)
    .values({
      ownerUserId: rep.id,
      companyName: "Cobalt Systems",
      domain: "cobaltsystems.com",
      industry: "Manufacturing software",
      dealStage: "proposal",
    })
    .returning();

  const [meridian] = await db
    .insert(accounts)
    .values({
      ownerUserId: rep.id,
      companyName: "Meridian Health",
      domain: "meridianhealth.org",
      industry: "Healthcare",
      dealStage: "discovery",
    })
    .returning();

  await db.insert(contacts).values([
    {
      accountId: cobalt.id,
      name: "Priya Raman",
      role: "Director of Platform Operations",
      email: "priya@cobaltsystems.com",
      isDecisionMaker: true,
    },
    {
      accountId: cobalt.id,
      name: "Marcus Webb",
      role: "Finance",
      email: "marcus@cobaltsystems.com",
      isDecisionMaker: true,
    },
    {
      accountId: meridian.id,
      name: "Dr. Elena Farrow",
      role: "Chief Medical Informatics Officer",
      email: "efarrow@meridianhealth.org",
      isDecisionMaker: true,
    },
  ]);

    // One meter, belonging to the rep — not one per company they sell to.
    await db
      .insert(usage)
      .values({ userId: rep.id, meetingsProcessedThisMonth: 1, freeTierLimit: 5 });

  // --- The completed call -------------------------------------------------
  const [pastMeeting] = await db
    .insert(meetings)
    .values({
      accountId: cobalt.id,
      ownerUserId: rep.id,
      title: "Cobalt Systems — platform evaluation",
      scheduledAt: at(-2, 14, 0),
      endsAt: at(-2, 14, 45),
      calendarEventId: "seed-cobalt-past",
      meetingUrl: "https://meet.google.com/seed-cobalt",
      status: "processed",
      attendees: [
        { email: REP_EMAIL, displayName: "Sam Okonkwo", self: true, organizer: true, external: false },
        { email: "priya@cobaltsystems.com", displayName: "Priya Raman", external: true },
        { email: "marcus@cobaltsystems.com", displayName: "Marcus Webb", external: true },
      ],
    })
    .returning();

  const segments: SpeakerSegment[] = TRANSCRIPT_TURNS.map(([speaker, text], index) => ({
    speakerName: speaker,
    speakerUuid: null,
    speakerIsHost: speaker === "Sam Okonkwo",
    timestampMs: index * 78_000,
    durationMs: 14_000,
    text,
  }));

  const rawText = segments.map((s) => `${s.speakerName}: ${s.text}`).join("\n");

  const [transcript] = await db
    .insert(transcripts)
    .values({
      meetingId: pastMeeting.id,
      rawText,
      speakerSegments: segments,
      source: "seed",
      durationSeconds: 45 * 60,
    })
    .returning();

  const [summary] = await db
    .insert(meetingSummaries)
    .values({
      meetingId: pastMeeting.id,
      content: SUMMARY,
      intentSignals: INTENT,
      deliverableType: "plain_summary",
    })
    .returning();

  const [pastBrief] = await db
    .insert(meetingBriefs)
    .values({
      meetingId: pastMeeting.id,
      content: BRIEF_COBALT,
      citations: [
        { title: "Cobalt Systems — Newsroom", url: "https://www.cobaltsystems.com/news" },
        { title: "Cobalt Systems — Careers", url: "https://www.cobaltsystems.com/careers" },
      ],
      notifiedAt: at(-3, 9, 0),
    })
    .returning();

  await db.insert(followupProposals).values({
    meetingId: pastMeeting.id,
    accountId: cobalt.id,
    title: "Cobalt — security review checkpoint before the board",
    agenda: `- Walk through the migration plan, focusing on the parallel-run window\n- Confirm the SOC 2 Type II review is complete and nothing is outstanding\n- Agree what goes in front of the board on the 12th\n- Identify anyone else who needs to see the material first`,
    rationale:
      "Two deliverables were promised on the last call and a two-week security review has to finish before a fixed board date. This checkpoint is what keeps the deal on this cycle rather than slipping a month.",
    proposedStart: at(12, 10, 0),
    proposedEnd: at(12, 10, 30),
    attendeeEmails: [REP_EMAIL, "priya@cobaltsystems.com", "marcus@cobaltsystems.com"],
    status: "pending",
  });

  // --- Upcoming calls -----------------------------------------------------
  const [upcomingCobalt] = await db
    .insert(meetings)
    .values({
      accountId: cobalt.id,
      ownerUserId: rep.id,
      title: "Cobalt Systems — migration plan walkthrough",
      scheduledAt: at(0, new Date().getHours() + 2, 0),
      endsAt: at(0, new Date().getHours() + 3, 0),
      calendarEventId: "seed-cobalt-upcoming",
      meetingUrl: "https://meet.google.com/seed-cobalt-2",
      status: "brief_ready",
      botId: "bot_seedCobalt",
      botState: "scheduled",
      attendees: [
        { email: REP_EMAIL, displayName: "Sam Okonkwo", self: true, organizer: true, external: false },
        { email: "priya@cobaltsystems.com", displayName: "Priya Raman", external: true },
      ],
    })
    .returning();

  const [upcomingBrief] = await db
    .insert(meetingBriefs)
    .values({
      meetingId: upcomingCobalt.id,
      content: BRIEF_COBALT,
      citations: [{ title: "Cobalt Systems — Newsroom", url: "https://www.cobaltsystems.com/news" }],
    })
    .returning();

  const [meridianMeeting] = await db
    .insert(meetings)
    .values({
      accountId: meridian.id,
      ownerUserId: rep.id,
      title: "Meridian Health — intro call",
      scheduledAt: at(1, 11, 30),
      endsAt: at(1, 12, 0),
      calendarEventId: "seed-meridian",
      meetingUrl: "https://meet.google.com/seed-meridian",
      status: "brief_ready",
      attendees: [
        { email: REP_EMAIL, displayName: "Sam Okonkwo", self: true, organizer: true, external: false },
        { email: "efarrow@meridianhealth.org", displayName: "Dr. Elena Farrow", external: true },
        { email: "tbrennan@meridianhealth.org", displayName: "Tom Brennan", external: true },
      ],
    })
    .returning();

  const [meridianBrief] = await db
    .insert(meetingBriefs)
    .values({
      meetingId: meridianMeeting.id,
      content: BRIEF_MERIDIAN,
      citations: [
        { title: "Meridian Health — Leadership", url: "https://www.meridianhealth.org/leadership" },
      ],
    })
    .returning();

  // --- Playbook -----------------------------------------------------------
  await db.insert(playbookSnippets).values([
    {
      ownerUserId: rep.id,
      title: "What we qualify on",
      content:
        "Every deal needs four things established before we forecast it: a named economic buyer, a written security path, a date the customer is working backwards from, and confirmation that budget exists for this fiscal period rather than the next one.",
      appliesTo: ["research", "wrapup", "chat"],
    },
    {
      ownerUserId: rep.id,
      title: "How we handle migration objections",
      content:
        "Never argue with a bad migration experience. Acknowledge it, then remove the risk structurally: offer a parallel run where the existing system stays live until the customer chooses to cut over. Put the parallel-run commitment in writing the same week it is raised.",
      appliesTo: ["wrapup", "chat"],
    },
  ]);

  // --- Index everything so the chat agent has something to retrieve --------
  let chunks = 0;
  chunks += await indexDocument({
    accountId: cobalt.id,
    sourceType: "transcript",
    sourceId: transcript.id,
    content: rawText,
    meta: { meetingId: pastMeeting.id, scheduledAt: pastMeeting.scheduledAt.toISOString(), label: `Transcript — ${pastMeeting.scheduledAt.toISOString().slice(0, 10)}` },
  });
  chunks += await indexDocument({
    accountId: cobalt.id,
    sourceType: "summary",
    sourceId: summary.id,
    content: SUMMARY,
    meta: { meetingId: pastMeeting.id, scheduledAt: pastMeeting.scheduledAt.toISOString(), label: `Summary — ${pastMeeting.scheduledAt.toISOString().slice(0, 10)}` },
  });
  for (const [brief, accountId, meeting] of [
    [pastBrief, cobalt.id, pastMeeting],
    [upcomingBrief, cobalt.id, upcomingCobalt],
    [meridianBrief, meridian.id, meridianMeeting],
  ] as const) {
    chunks += await indexDocument({
      accountId,
      sourceType: "brief",
      sourceId: brief.id,
      content: brief.content,
      meta: { meetingId: meeting.id, scheduledAt: meeting.scheduledAt.toISOString(), label: `Brief — ${meeting.scheduledAt.toISOString().slice(0, 10)}` },
    });
  }

  console.log(`Seeded ${rep.email}: 2 accounts, 3 meetings, ${chunks} indexed chunks.`);
  console.log(`Sign in as this rep locally with: npm run dev:login`);
}

main()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exitCode = 1;
  })
  .finally(() => sqlClient.end());
