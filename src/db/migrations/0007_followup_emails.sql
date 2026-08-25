CREATE TABLE "followup_emails" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"meeting_id" uuid NOT NULL,
	"account_id" uuid NOT NULL,
	"subject" text NOT NULL,
	"body" text NOT NULL,
	"recipients" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" "proposal_status" DEFAULT 'pending' NOT NULL,
	"sent_at" timestamp with time zone,
	"sent_by_user_id" uuid,
	"gmail_message_id" text,
	"gmail_thread_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "followup_emails" ADD CONSTRAINT "followup_emails_meeting_id_meetings_id_fk" FOREIGN KEY ("meeting_id") REFERENCES "public"."meetings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "followup_emails" ADD CONSTRAINT "followup_emails_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "followup_emails" ADD CONSTRAINT "followup_emails_sent_by_user_id_users_id_fk" FOREIGN KEY ("sent_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_followup_emails_meeting" ON "followup_emails" USING btree ("meeting_id");--> statement-breakpoint
CREATE INDEX "ix_followup_emails_account_status" ON "followup_emails" USING btree ("account_id","status");