-- The meter moves from the account to the rep.
--
-- Keyed on the account it was unlimited in practice: accounts are created
-- automatically, one per prospect domain, so a rep talking to thirty companies
-- had thirty separate free tiers. Existing counts are summed per rep rather
-- than discarded, so nobody's month resets as a side effect of the fix.

CREATE TABLE "usage_per_user" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"meetings_processed_this_month" integer DEFAULT 0 NOT NULL,
	"free_tier_limit" integer DEFAULT 5 NOT NULL,
	"period_start" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
INSERT INTO "usage_per_user" (
	"user_id", "meetings_processed_this_month", "free_tier_limit", "period_start"
)
SELECT
	a."owner_user_id",
	SUM(u."meetings_processed_this_month")::int,
	MAX(u."free_tier_limit")::int,
	MAX(u."period_start")
FROM "usage" u
JOIN "accounts" a ON a."id" = u."account_id"
GROUP BY a."owner_user_id";
--> statement-breakpoint
DROP TABLE "usage";
--> statement-breakpoint
ALTER TABLE "usage_per_user" RENAME TO "usage";
--> statement-breakpoint
ALTER TABLE "usage" ADD CONSTRAINT "usage_user_id_users_id_fk"
	FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "uq_usage_user" ON "usage" USING btree ("user_id");
--> statement-breakpoint
CREATE TYPE "public"."auth_event" AS ENUM('signed_up', 'signed_in');
--> statement-breakpoint
CREATE TABLE "auth_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"event" "auth_event" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "auth_events" ADD CONSTRAINT "auth_events_user_id_users_id_fk"
	FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "ix_auth_events_user" ON "auth_events" USING btree ("user_id","created_at");
--> statement-breakpoint
CREATE INDEX "ix_auth_events_type" ON "auth_events" USING btree ("event","created_at");
