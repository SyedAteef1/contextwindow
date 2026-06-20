CREATE TYPE "public"."escalation_status" AS ENUM('open', 'escalated', 'resolved', 'denied', 'expired');--> statement-breakpoint
CREATE TABLE "escalations" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text NOT NULL,
	"topic" text NOT NULL,
	"question" text NOT NULL,
	"asker_principal_id" text,
	"asker_surface" text NOT NULL,
	"asker_thread_ref" text,
	"tier" text NOT NULL,
	"owner_principal_id" text,
	"owner_team" text,
	"routed_to" text NOT NULL,
	"reason" text,
	"escalate_after" timestamp,
	"then_to" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" "escalation_status" DEFAULT 'open' NOT NULL,
	"answer_text" text,
	"resolved_by_principal_id" text,
	"resulting_memory_id" text,
	"surface" text NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "author_principal_id" text;--> statement-breakpoint
ALTER TABLE "memories" ADD COLUMN "author_principal_id" text;--> statement-breakpoint
CREATE INDEX "escalations_org_idx" ON "escalations" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "escalations_status_idx" ON "escalations" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "escalations_open_topic_idx" ON "escalations" USING btree ("org_id","topic") WHERE status in ('open','escalated');--> statement-breakpoint
CREATE INDEX "documents_author_idx" ON "documents" USING btree ("author_principal_id");--> statement-breakpoint
CREATE INDEX "memories_author_idx" ON "memories" USING btree ("author_principal_id");