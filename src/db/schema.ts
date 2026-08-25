/**
 * The data model.
 *
 * The eight tables named in the spec are all here under their given names.
 * Four more exist because the described features need them:
 *
 *  - `users` / `oauthCredentials` — the spec begins at "Google OAuth login",
 *    which needs somewhere to put the rep and their refresh token.
 *  - `followupProposals` — a drafted follow-up must survive between the wrap-up
 *    agent writing it and the rep clicking approve. Nothing reaches Google
 *    Calendar until that row flips to `approved`.
 *  - `webhookDeliveries` — Attendee webhooks are at-least-once, so we dedupe on
 *    their `idempotency_key` rather than processing a transcript twice.
 */
import {
  bigint,
  boolean,
  customType,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  vector,
} from "drizzle-orm/pg-core";

/** Keep in sync with EMBEDDING_DIM. Changing it requires a new migration. */
export const EMBEDDING_DIM = 1024;

/**
 * Vocabulary width for lexical vectors. BGE-M3 rides on XLM-RoBERTa's
 * vocabulary, so this is its size.
 */
export const SPARSE_DIM = 250_002;

/**
 * pgvector's `sparsevec`, which Drizzle has no built-in type for.
 *
 * Stored and read as its text literal (`{index:value,...}/dim`) — the driver
 * has no binary codec for it, and the values only ever move between Postgres
 * and the embedding server.
 */
const sparsevec = customType<{ data: string; driverData: string; config: { dimensions: number } }>({
  dataType(config) {
    return `sparsevec(${config?.dimensions ?? SPARSE_DIM})`;
  },
});

// --------------------------------------------------------------------------
// Enums
// --------------------------------------------------------------------------

/** Lifecycle of a meeting as *we* see it, not as the bot sees it. */
export const meetingStatusEnum = pgEnum("meeting_status", [
  "detected", // found on the calendar, nothing done yet
  "brief_pending", // research agent queued
  "brief_ready", // pre-call brief delivered to the rep
  "bot_scheduled", // bot dispatched, waiting to join
  "recording", // bot is in the meeting
  "transcribed", // transcript stored, wrap-up not yet run
  "processed", // summary + intent written
  "skipped_quota", // over the free-tier cap
  "failed",
  "cancelled", // removed from the calendar
]);

export const dealStageEnum = pgEnum("deal_stage", [
  "discovery",
  "qualification",
  "proposal",
  "negotiation",
  "closed_won",
  "closed_lost",
]);

/** How the wrap-up agent formats a summary. Resolved per account. */
export const deliverableTypeEnum = pgEnum("deliverable_type", [
  "meeting_minutes",
  "timeline",
  "plain_summary",
]);

export const sourceTypeEnum = pgEnum("source_type", [
  "transcript",
  "brief",
  "summary",
  "playbook",
]);

export const proposalStatusEnum = pgEnum("proposal_status", [
  "pending",
  "approved",
  "rejected",
  "expired",
]);

// --------------------------------------------------------------------------
// Identity
// --------------------------------------------------------------------------

/** A sales rep. Their email domain defines what counts as an *external* attendee. */
export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull(),
    name: text("name"),
    pictureUrl: text("picture_url"),
    googleSub: text("google_sub"),
    /** Cached from the email; classifies attendees as internal vs external. */
    emailDomain: text("email_domain").notNull(),
    defaultDeliverableType: deliverableTypeEnum("default_deliverable_type")
      .notNull()
      .default("plain_summary"),
    lastCalendarSyncAt: timestamp("last_calendar_sync_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("uq_users_email").on(t.email),
    uniqueIndex("uq_users_google_sub").on(t.googleSub),
    index("ix_users_email_domain").on(t.emailDomain),
  ],
);

/** Google OAuth tokens. Both tokens are encrypted at rest (see lib/crypto.ts). */
export const oauthCredentials = pgTable(
  "oauth_credentials",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    provider: text("provider").notNull().default("google"),
    accessTokenEncrypted: text("access_token_encrypted").notNull(),
    refreshTokenEncrypted: text("refresh_token_encrypted"),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    scopes: jsonb("scopes").$type<string[]>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("uq_oauth_user_provider").on(t.userId, t.provider)],
);

// --------------------------------------------------------------------------
// CRM core
// --------------------------------------------------------------------------

export const accounts = pgTable(
  "accounts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerUserId: uuid("owner_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    companyName: text("company_name").notNull(),
    domain: text("domain").notNull(),
    industry: text("industry"),
    dealStage: dealStageEnum("deal_stage").notNull().default("discovery"),
    /**
     * Per-account override of the summary format. When null the wrap-up agent
     * falls back to an industry heuristic, then to the user's default.
     */
    deliverablePreference: deliverableTypeEnum("deliverable_preference"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("uq_accounts_owner_domain").on(t.ownerUserId, t.domain),
    index("ix_accounts_owner_stage").on(t.ownerUserId, t.dealStage),
  ],
);

export const contacts = pgTable(
  "contacts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    accountId: uuid("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    name: text("name"),
    role: text("role"),
    email: text("email").notNull(),
    isDecisionMaker: boolean("is_decision_maker").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("uq_contacts_account_email").on(t.accountId, t.email)],
);

export const meetings = pgTable(
  "meetings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    accountId: uuid("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    ownerUserId: uuid("owner_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title"),
    scheduledAt: timestamp("scheduled_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }),
    calendarEventId: text("calendar_event_id").notNull(),
    meetingUrl: text("meeting_url"),
    status: meetingStatusEnum("status").notNull().default("detected"),
    /** Provider-side bot handle, e.g. Attendee's `bot_weIAju4OXNZkDTpZ`. */
    botId: text("bot_id"),
    botState: text("bot_state"),
    attendees: jsonb("attendees").$type<MeetingAttendee[]>(),
    errorMessage: text("error_message"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("uq_meetings_owner_event").on(t.ownerUserId, t.calendarEventId),
    index("ix_meetings_status_scheduled").on(t.status, t.scheduledAt),
    index("ix_meetings_bot_id").on(t.botId),
    index("ix_meetings_account").on(t.accountId),
  ],
);

export const transcripts = pgTable(
  "transcripts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    meetingId: uuid("meeting_id")
      .notNull()
      .references(() => meetings.id, { onDelete: "cascade" }),
    rawText: text("raw_text").notNull().default(""),
    /** Attendee's TranscriptUtterance shape, stored verbatim. */
    speakerSegments: jsonb("speaker_segments").$type<SpeakerSegment[]>(),
    source: text("source"),
    durationSeconds: integer("duration_seconds"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("uq_transcripts_meeting").on(t.meetingId)],
);

/** Pre-call research output. */
export const meetingBriefs = pgTable(
  "meeting_briefs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    meetingId: uuid("meeting_id")
      .notNull()
      .references(() => meetings.id, { onDelete: "cascade" }),
    content: text("content").notNull(),
    /** The research prompt requires every claim to carry one of these. */
    citations: jsonb("citations").$type<Citation[]>(),
    generatedAt: timestamp("generated_at", { withTimezone: true }).notNull().defaultNow(),
    /** When the rep opened it in the app. */
    notifiedAt: timestamp("notified_at", { withTimezone: true }),
    /**
     * When the brief was emailed to the rep.
     *
     * Separate from `notifiedAt` so re-reading a brief in the app never causes
     * a second email, and so a send that failed can be retried without
     * pretending the rep has already seen it.
     */
    emailedAt: timestamp("emailed_at", { withTimezone: true }),
  },
  (t) => [uniqueIndex("uq_briefs_meeting").on(t.meetingId)],
);

/** Post-call deliverable plus extracted intent. */
export const meetingSummaries = pgTable(
  "meeting_summaries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    meetingId: uuid("meeting_id")
      .notNull()
      .references(() => meetings.id, { onDelete: "cascade" }),
    content: text("content").notNull(),
    intentSignals: jsonb("intent_signals").$type<IntentSignals>(),
    deliverableType: deliverableTypeEnum("deliverable_type").notNull(),
    generatedAt: timestamp("generated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("uq_summaries_meeting").on(t.meetingId)],
);

/**
 * A drafted follow-up meeting. This row is the approval gate: the calendar
 * event is only created when a rep flips it to `approved`.
 */
export const followupProposals = pgTable(
  "followup_proposals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    meetingId: uuid("meeting_id")
      .notNull()
      .references(() => meetings.id, { onDelete: "cascade" }),
    accountId: uuid("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    agenda: text("agenda").notNull(),
    rationale: text("rationale"),
    proposedStart: timestamp("proposed_start", { withTimezone: true }).notNull(),
    proposedEnd: timestamp("proposed_end", { withTimezone: true }).notNull(),
    attendeeEmails: jsonb("attendee_emails").$type<string[]>(),
    status: proposalStatusEnum("status").notNull().default("pending"),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    approvedByUserId: uuid("approved_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    createdCalendarEventId: text("created_calendar_event_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("ix_followups_meeting").on(t.meetingId),
    index("ix_followups_account_status").on(t.accountId, t.status),
  ],
);

/**
 * The recap email drafted after a call.
 *
 * Separate from `followup_proposals` because the two have different lifetimes:
 * every processed meeting earns a recap, but only some warrant another meeting.
 * Keeping them apart means a call with no next step still gets its minutes sent.
 *
 * Nothing here reaches a customer until a rep dispatches it. The draft is the
 * product; sending is the rep's decision.
 */
export const followupEmails = pgTable(
  "followup_emails",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    meetingId: uuid("meeting_id")
      .notNull()
      .references(() => meetings.id, { onDelete: "cascade" }),
    accountId: uuid("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    subject: text("subject").notNull(),
    /** Plain text with blank-line paragraphs; rendered to HTML at send time. */
    body: text("body").notNull(),
    recipients: jsonb("recipients").$type<string[]>().notNull().default([]),
    status: proposalStatusEnum("status").notNull().default("pending"),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    sentByUserId: uuid("sent_by_user_id").references(() => users.id, { onDelete: "set null" }),
    /** Gmail's ids, so a sent recap can be found in the rep's own mailbox. */
    gmailMessageId: text("gmail_message_id"),
    gmailThreadId: text("gmail_thread_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("uq_followup_emails_meeting").on(t.meetingId),
    index("ix_followup_emails_account_status").on(t.accountId, t.status),
  ],
);


// --------------------------------------------------------------------------
// Retrieval
// --------------------------------------------------------------------------

/**
 * Chunk-level vectors for the chat agent.
 *
 * `accountId` is NOT NULL and every retrieval query filters on it — that is
 * what keeps one account's history from leaking into another's answers.
 */
export const embeddings = pgTable(
  "embeddings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    accountId: uuid("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    sourceType: sourceTypeEnum("source_type").notNull(),
    sourceId: uuid("source_id").notNull(),
    chunkIndex: integer("chunk_index").notNull().default(0),
    content: text("content").notNull(),
    vector: vector("vector", { dimensions: EMBEDDING_DIM }).notNull(),
    /**
     * Lexical weights, when the embedding model produces them. Null on every
     * row unless hybrid retrieval is configured, which is why it is nullable
     * rather than defaulted — an empty sparsevec and "no sparse vector" mean
     * different things.
     */
    sparseVector: sparsevec("sparse_vector", { dimensions: SPARSE_DIM }),
    meta: jsonb("meta").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("uq_embeddings_chunk").on(t.sourceType, t.sourceId, t.chunkIndex),
    index("ix_embeddings_account_source").on(t.accountId, t.sourceType),
    // HNSW over cosine distance. Built in the migration with the operator class.
    index("ix_embeddings_vector_hnsw").using(
      "hnsw",
      t.vector.op("vector_cosine_ops"),
    ),
    // Sparse vectors are compared by inner product, not cosine.
    index("ix_embeddings_sparse_hnsw").using(
      "hnsw",
      t.sparseVector.op("sparsevec_ip_ops"),
    ),
  ],
);

/**
 * Sales playbook content as plain rows, retrieved into agent prompts the same
 * way embeddings are. Global snippets (`accountId IS NULL`) apply everywhere;
 * account-scoped ones layer on top.
 */
export const playbookSnippets = pgTable(
  "playbook_snippets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerUserId: uuid("owner_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    accountId: uuid("account_id").references(() => accounts.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    content: text("content").notNull(),
    /** Which agents pull this in: research | wrapup | chat */
    appliesTo: jsonb("applies_to").$type<PlaybookAudience[]>(),
    industry: text("industry"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("ix_playbook_owner").on(t.ownerUserId),
    index("ix_playbook_account").on(t.accountId),
    index("ix_playbook_industry").on(t.industry),
  ],
);

// --------------------------------------------------------------------------
// Metering & webhook bookkeeping
// --------------------------------------------------------------------------

/**
 * Free-tier meter, one row per account.
 *
 * `periodStart` is what makes "this month" mean anything: the counter resets
 * when the stored period predates the current calendar month.
 */
export const usage = pgTable(
  "usage",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /**
     * The meter belongs to the rep, not to the company they are selling to.
     *
     * Keyed on the account it was unlimited in practice: accounts are created
     * automatically, one per prospect domain, so a rep talking to thirty
     * companies had thirty separate free tiers and never met a paywall.
     */
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    meetingsProcessedThisMonth: integer("meetings_processed_this_month").notNull().default(0),
    freeTierLimit: integer("free_tier_limit").notNull().default(5),
    periodStart: timestamp("period_start", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("uq_usage_user").on(t.userId)],
);

export const authEventEnum = pgEnum("auth_event", ["signed_up", "signed_in"]);

/**
 * Who arrived, and when.
 *
 * Deliberately thin: a user, an event, a timestamp. No IP address and no device
 * fingerprint — those are personal data that would need a privacy policy and a
 * retention rule before they could be justified, and neither is needed to answer
 * "who signed up" or "who is still active".
 */
export const authEvents = pgTable(
  "auth_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    event: authEventEnum("event").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("ix_auth_events_user").on(t.userId, t.createdAt),
    index("ix_auth_events_type").on(t.event, t.createdAt),
  ],
);

/**
 * Answers surfaced to the rep *during* a call.
 *
 * The live loop is deliberately separate from the wrap-up: it has a sub-second
 * budget, so it never touches retrieval or the summary pipeline. One row per
 * question detected in the transcript stream.
 */
export const liveAnswers = pgTable(
  "live_answers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    meetingId: uuid("meeting_id")
      .notNull()
      .references(() => meetings.id, { onDelete: "cascade" }),
    question: text("question").notNull(),
    /** Null until an answer exists, or permanently when nothing was answered. */
    answer: text("answer"),
    /**
     * `heard` lands within ~350ms so the rep sees the system is listening;
     * the row is then updated in place to `answered` or `skipped`.
     */
    status: text("status").notNull().default("heard").$type<LiveStatus>(),
    skippedReason: text("skipped_reason"),
    askedBy: text("asked_by"),
    /**
     * The utterance's timestamp from the provider — epoch milliseconds, not an
     * offset into the call, so it overflows a 32-bit integer.
     */
    askedAtMs: bigint("asked_at_ms", { mode: "number" }),
    /** End-to-end milliseconds, so latency regressions are visible in data. */
    latencyMs: integer("latency_ms"),
    /**
     * Which lane produced this — `cache`, `fast`, or `main`.
     *
     * Persisted rather than only streamed, because the panel rebuilds from the
     * database on reload: without it, a 13ms cache hit renders identically to a
     * 1,300ms generated answer.
     */
    via: text("via"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("ix_live_answers_meeting").on(t.meetingId, t.createdAt),
    // The same utterance can arrive twice; one answer per question per meeting.
    uniqueIndex("uq_live_answers_question").on(t.meetingId, t.askedAtMs),
  ],
);

/**
 * Answers written *before* the call, for questions a buyer is likely to ask.
 *
 * This is what makes a sub-second reply possible. Generating an answer takes
 * ~700-1,600ms and varies wildly; a vector lookup takes ~5ms and does not vary
 * at all. Since the questions that actually get asked mid-call are mostly
 * predictable — pricing, security, SSO, integrations, timeline — the answer can
 * be waiting rather than generated on demand.
 *
 * Scoped by account, like everything else in retrieval: an answer grounded in
 * one customer's brief must never surface on another's call.
 */
export const precomputedAnswers = pgTable(
  "precomputed_answers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    accountId: uuid("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    /** The meeting whose brief produced this, for regeneration and audit. */
    meetingId: uuid("meeting_id").references(() => meetings.id, { onDelete: "cascade" }),
    question: text("question").notNull(),
    answer: text("answer").notNull(),
    /** Broad bucket — pricing, security, product — for coverage reporting. */
    topic: text("topic"),
    vector: vector("vector", { dimensions: EMBEDDING_DIM }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("ix_precomputed_account").on(t.accountId),
    uniqueIndex("uq_precomputed_account_question").on(t.accountId, t.question),
    index("ix_precomputed_vector_hnsw").using("hnsw", t.vector.op("vector_cosine_ops")),
  ],
);

/** Dedupe log for at-least-once bot webhooks. */
export const webhookDeliveries = pgTable(
  "webhook_deliveries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    provider: text("provider").notNull(),
    idempotencyKey: text("idempotency_key").notNull(),
    trigger: text("trigger"),
    botId: text("bot_id"),
    payload: jsonb("payload").$type<Record<string, unknown>>(),
    receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("uq_webhook_provider_key").on(t.provider, t.idempotencyKey),
    index("ix_webhook_bot_id").on(t.botId),
  ],
);


// --------------------------------------------------------------------------
// Chat threads
// --------------------------------------------------------------------------

/**
 * A saved conversation about one account.
 *
 * Chat used to live entirely in the browser: history travelled up with each
 * request, capped at twenty turns, and vanished on refresh. That makes the
 * assistant amnesiac exactly where memory is worth most — a rep asking about an
 * account they last touched three weeks ago. Threads persist so the account
 * accumulates a record of what has been asked about it, and so more than one
 * line of enquiry can be kept apart.
 */
export const chatThreads = pgTable(
  "chat_threads",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    accountId: uuid("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    ownerUserId: uuid("owner_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** Derived from the opening question, and editable. */
    title: text("title").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    /** Sorts the sidebar. Separate from `updatedAt`, which a rename also moves. */
    lastMessageAt: timestamp("last_message_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("ix_chat_threads_account").on(t.accountId, t.lastMessageAt)],
);

export const chatRoleEnum = pgEnum("chat_role", ["user", "assistant"]);

export const chatMessages = pgTable(
  "chat_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    threadId: uuid("thread_id")
      .notNull()
      .references(() => chatThreads.id, { onDelete: "cascade" }),
    role: chatRoleEnum("role").notNull(),
    content: text("content").notNull(),
    /**
     * What the answer was drawn from, stored alongside it. Retrieval would
     * return something different if re-run later, and a citation that no longer
     * matches the sentence it supports is worse than none.
     */
    sources: jsonb("sources").$type<ChatMessageSource[]>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("ix_chat_messages_thread").on(t.threadId, t.createdAt)],
);

// --------------------------------------------------------------------------
// JSONB payload shapes
// --------------------------------------------------------------------------

export type MeetingAttendee = {
  email: string;
  displayName?: string | null;
  organizer?: boolean;
  self?: boolean;
  responseStatus?: string | null;
  external: boolean;
};

/** Mirrors Attendee's `TranscriptUtterance`. */
export type SpeakerSegment = {
  speakerName: string;
  speakerUuid?: string | null;
  speakerIsHost?: boolean;
  timestampMs: number;
  durationMs: number;
  text: string;
};

export type Citation = { title: string; url: string };

export type IntentSignals = {
  buyingInterest: "high" | "medium" | "low" | "none";
  interestRationale: string;
  objections: { objection: string; severity: "high" | "medium" | "low"; quote?: string | null }[];
  nextSteps: { step: string; owner: "us" | "them" | "both"; dueDate?: string | null }[];
  competitorsMentioned: string[];
  budgetSignals: string[];
  timelineSignals: string[];
  followupRecommended: boolean;
  followupRationale: string;
  suggestedFollowupDays: number | null;
};

export type PlaybookAudience = "research" | "wrapup" | "chat";

/** A retrieved chunk, as cited on a stored chat answer. */
export type ChatMessageSource = {
  label: string;
  sourceType: string;
  sourceId: string;
  similarity: number;
};

// --------------------------------------------------------------------------
// Inferred row types
// --------------------------------------------------------------------------

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Account = typeof accounts.$inferSelect;
export type NewAccount = typeof accounts.$inferInsert;
export type Contact = typeof contacts.$inferSelect;
export type Meeting = typeof meetings.$inferSelect;
export type NewMeeting = typeof meetings.$inferInsert;
export type Transcript = typeof transcripts.$inferSelect;
export type MeetingBrief = typeof meetingBriefs.$inferSelect;
export type MeetingSummary = typeof meetingSummaries.$inferSelect;
export type FollowupProposal = typeof followupProposals.$inferSelect;
export type PlaybookSnippet = typeof playbookSnippets.$inferSelect;
export type Usage = typeof usage.$inferSelect;
export type LiveAnswer = typeof liveAnswers.$inferSelect;
export type PrecomputedAnswer = typeof precomputedAnswers.$inferSelect;
/** Lifecycle of one utterance on the live panel. */
export type LiveStatus = "heard" | "answering" | "answered" | "skipped";
export type MeetingStatus = (typeof meetingStatusEnum.enumValues)[number];
export type DealStage = (typeof dealStageEnum.enumValues)[number];
export type DeliverableType = (typeof deliverableTypeEnum.enumValues)[number];
export type SourceType = (typeof sourceTypeEnum.enumValues)[number];

export type FollowupEmail = typeof followupEmails.$inferSelect;
export type NewFollowupEmail = typeof followupEmails.$inferInsert;

export type ChatThread = typeof chatThreads.$inferSelect;
export type ChatMessage = typeof chatMessages.$inferSelect;

export type AuthEvent = typeof authEvents.$inferSelect;
