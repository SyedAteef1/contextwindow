CREATE EXTENSION IF NOT EXISTS vector;--> statement-breakpoint
CREATE TYPE "public"."deal_stage" AS ENUM('discovery', 'qualification', 'proposal', 'negotiation', 'closed_won', 'closed_lost');--> statement-breakpoint
CREATE TYPE "public"."deliverable_type" AS ENUM('meeting_minutes', 'timeline', 'plain_summary');--> statement-breakpoint
CREATE TYPE "public"."meeting_status" AS ENUM('detected', 'brief_pending', 'brief_ready', 'bot_scheduled', 'recording', 'transcribed', 'processed', 'skipped_quota', 'failed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."proposal_status" AS ENUM('pending', 'approved', 'rejected', 'expired');--> statement-breakpoint
CREATE TYPE "public"."source_type" AS ENUM('transcript', 'brief', 'summary', 'playbook');--> statement-breakpoint
CREATE TABLE "accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_user_id" uuid NOT NULL,
	"company_name" text NOT NULL,
	"domain" text NOT NULL,
	"industry" text,
	"deal_stage" "deal_stage" DEFAULT 'discovery' NOT NULL,
	"deliverable_preference" "deliverable_type",
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"name" text,
	"role" text,
	"email" text NOT NULL,
	"is_decision_maker" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "embeddings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"source_type" "source_type" NOT NULL,
	"source_id" uuid NOT NULL,
	"chunk_index" integer DEFAULT 0 NOT NULL,
	"content" text NOT NULL,
	"vector" vector(1024) NOT NULL,
	"meta" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "followup_proposals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"meeting_id" uuid NOT NULL,
	"account_id" uuid NOT NULL,
	"title" text NOT NULL,
	"agenda" text NOT NULL,
	"rationale" text,
	"proposed_start" timestamp with time zone NOT NULL,
	"proposed_end" timestamp with time zone NOT NULL,
	"attendee_emails" jsonb,
	"status" "proposal_status" DEFAULT 'pending' NOT NULL,
	"approved_at" timestamp with time zone,
	"approved_by_user_id" uuid,
	"created_calendar_event_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "meeting_briefs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"meeting_id" uuid NOT NULL,
	"content" text NOT NULL,
	"citations" jsonb,
	"generated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"notified_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "meeting_summaries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"meeting_id" uuid NOT NULL,
	"content" text NOT NULL,
	"intent_signals" jsonb,
	"deliverable_type" "deliverable_type" NOT NULL,
	"generated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "meetings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"owner_user_id" uuid NOT NULL,
	"title" text,
	"scheduled_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone,
	"calendar_event_id" text NOT NULL,
	"meeting_url" text,
	"status" "meeting_status" DEFAULT 'detected' NOT NULL,
	"bot_id" text,
	"bot_state" text,
	"attendees" jsonb,
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "oauth_credentials" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"provider" text DEFAULT 'google' NOT NULL,
	"access_token_encrypted" text NOT NULL,
	"refresh_token_encrypted" text,
	"expires_at" timestamp with time zone,
	"scopes" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "playbook_snippets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_user_id" uuid NOT NULL,
	"account_id" uuid,
	"title" text NOT NULL,
	"content" text NOT NULL,
	"applies_to" jsonb,
	"industry" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transcripts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"meeting_id" uuid NOT NULL,
	"raw_text" text DEFAULT '' NOT NULL,
	"speaker_segments" jsonb,
	"source" text,
	"duration_seconds" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "usage" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"meetings_processed_this_month" integer DEFAULT 0 NOT NULL,
	"free_tier_limit" integer DEFAULT 5 NOT NULL,
	"period_start" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"name" text,
	"picture_url" text,
	"google_sub" text,
	"email_domain" text NOT NULL,
	"default_deliverable_type" "deliverable_type" DEFAULT 'plain_summary' NOT NULL,
	"last_calendar_sync_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "webhook_deliveries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider" text NOT NULL,
	"idempotency_key" text NOT NULL,
	"trigger" text,
	"bot_id" text,
	"payload" jsonb,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "embeddings" ADD CONSTRAINT "embeddings_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "followup_proposals" ADD CONSTRAINT "followup_proposals_meeting_id_meetings_id_fk" FOREIGN KEY ("meeting_id") REFERENCES "public"."meetings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "followup_proposals" ADD CONSTRAINT "followup_proposals_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "followup_proposals" ADD CONSTRAINT "followup_proposals_approved_by_user_id_users_id_fk" FOREIGN KEY ("approved_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meeting_briefs" ADD CONSTRAINT "meeting_briefs_meeting_id_meetings_id_fk" FOREIGN KEY ("meeting_id") REFERENCES "public"."meetings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meeting_summaries" ADD CONSTRAINT "meeting_summaries_meeting_id_meetings_id_fk" FOREIGN KEY ("meeting_id") REFERENCES "public"."meetings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meetings" ADD CONSTRAINT "meetings_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meetings" ADD CONSTRAINT "meetings_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oauth_credentials" ADD CONSTRAINT "oauth_credentials_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "playbook_snippets" ADD CONSTRAINT "playbook_snippets_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "playbook_snippets" ADD CONSTRAINT "playbook_snippets_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transcripts" ADD CONSTRAINT "transcripts_meeting_id_meetings_id_fk" FOREIGN KEY ("meeting_id") REFERENCES "public"."meetings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usage" ADD CONSTRAINT "usage_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_accounts_owner_domain" ON "accounts" USING btree ("owner_user_id","domain");--> statement-breakpoint
CREATE INDEX "ix_accounts_owner_stage" ON "accounts" USING btree ("owner_user_id","deal_stage");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_contacts_account_email" ON "contacts" USING btree ("account_id","email");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_embeddings_chunk" ON "embeddings" USING btree ("source_type","source_id","chunk_index");--> statement-breakpoint
CREATE INDEX "ix_embeddings_account_source" ON "embeddings" USING btree ("account_id","source_type");--> statement-breakpoint
CREATE INDEX "ix_embeddings_vector_hnsw" ON "embeddings" USING hnsw ("vector" vector_cosine_ops);--> statement-breakpoint
CREATE INDEX "ix_followups_meeting" ON "followup_proposals" USING btree ("meeting_id");--> statement-breakpoint
CREATE INDEX "ix_followups_account_status" ON "followup_proposals" USING btree ("account_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_briefs_meeting" ON "meeting_briefs" USING btree ("meeting_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_summaries_meeting" ON "meeting_summaries" USING btree ("meeting_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_meetings_owner_event" ON "meetings" USING btree ("owner_user_id","calendar_event_id");--> statement-breakpoint
CREATE INDEX "ix_meetings_status_scheduled" ON "meetings" USING btree ("status","scheduled_at");--> statement-breakpoint
CREATE INDEX "ix_meetings_bot_id" ON "meetings" USING btree ("bot_id");--> statement-breakpoint
CREATE INDEX "ix_meetings_account" ON "meetings" USING btree ("account_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_oauth_user_provider" ON "oauth_credentials" USING btree ("user_id","provider");--> statement-breakpoint
CREATE INDEX "ix_playbook_owner" ON "playbook_snippets" USING btree ("owner_user_id");--> statement-breakpoint
CREATE INDEX "ix_playbook_account" ON "playbook_snippets" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "ix_playbook_industry" ON "playbook_snippets" USING btree ("industry");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_transcripts_meeting" ON "transcripts" USING btree ("meeting_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_usage_account" ON "usage" USING btree ("account_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_users_email" ON "users" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_users_google_sub" ON "users" USING btree ("google_sub");--> statement-breakpoint
CREATE INDEX "ix_users_email_domain" ON "users" USING btree ("email_domain");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_webhook_provider_key" ON "webhook_deliveries" USING btree ("provider","idempotency_key");--> statement-breakpoint
CREATE INDEX "ix_webhook_bot_id" ON "webhook_deliveries" USING btree ("bot_id");