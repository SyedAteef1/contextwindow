ALTER TABLE "live_answers" ALTER COLUMN "answer" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "live_answers" ADD COLUMN "status" text DEFAULT 'heard' NOT NULL;--> statement-breakpoint
ALTER TABLE "live_answers" ADD COLUMN "skipped_reason" text;