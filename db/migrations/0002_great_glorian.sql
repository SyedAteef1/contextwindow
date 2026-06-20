CREATE TYPE "public"."identity_status" AS ENUM('pending', 'approved', 'denied');--> statement-breakpoint
ALTER TABLE "identities" ADD COLUMN "email" text;--> statement-breakpoint
ALTER TABLE "identities" ADD COLUMN "status" "identity_status" DEFAULT 'approved' NOT NULL;--> statement-breakpoint
ALTER TABLE "identities" ADD COLUMN "approved_by" text;--> statement-breakpoint
ALTER TABLE "identities" ADD COLUMN "approved_at" timestamp;--> statement-breakpoint
CREATE INDEX "identities_email_idx" ON "identities" USING btree ("email");