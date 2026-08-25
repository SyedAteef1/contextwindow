CREATE TABLE "precomputed_answers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"meeting_id" uuid,
	"question" text NOT NULL,
	"answer" text NOT NULL,
	"topic" text,
	"vector" vector(1024) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "precomputed_answers" ADD CONSTRAINT "precomputed_answers_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "precomputed_answers" ADD CONSTRAINT "precomputed_answers_meeting_id_meetings_id_fk" FOREIGN KEY ("meeting_id") REFERENCES "public"."meetings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ix_precomputed_account" ON "precomputed_answers" USING btree ("account_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_precomputed_account_question" ON "precomputed_answers" USING btree ("account_id","question");--> statement-breakpoint
CREATE INDEX "ix_precomputed_vector_hnsw" ON "precomputed_answers" USING hnsw ("vector" vector_cosine_ops);