CREATE TABLE "live_answers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"meeting_id" uuid NOT NULL,
	"question" text NOT NULL,
	"answer" text NOT NULL,
	"asked_by" text,
	"asked_at_ms" integer,
	"latency_ms" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "live_answers" ADD CONSTRAINT "live_answers_meeting_id_meetings_id_fk" FOREIGN KEY ("meeting_id") REFERENCES "public"."meetings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ix_live_answers_meeting" ON "live_answers" USING btree ("meeting_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_live_answers_question" ON "live_answers" USING btree ("meeting_id","asked_at_ms");