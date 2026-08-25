-- The workspace: the company doing the selling.
--
-- Until now everything hung off an individual rep, so the seller's own material
-- had nowhere to live and `embeddings.account_id` was NOT NULL — which meant
-- retrieval could only ever find what was said *to* a prospect, never anything
-- about the product being sold. That is the ceiling this lifts.
--
-- Backfilled from email domains, so existing users land in a workspace without
-- anyone creating one.

CREATE TABLE "workspaces" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"domain" text NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "uq_workspaces_domain" ON "workspaces" USING btree ("domain");
--> statement-breakpoint
CREATE TYPE "public"."workspace_doc_kind" AS ENUM('product','pricing','positioning','case_study','objection','other');
--> statement-breakpoint
CREATE TABLE "workspace_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"title" text NOT NULL,
	"content" text NOT NULL,
	"kind" "workspace_doc_kind" DEFAULT 'other' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "workspace_documents" ADD CONSTRAINT "workspace_documents_workspace_id_fk"
	FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade;
--> statement-breakpoint
CREATE INDEX "ix_workspace_docs" ON "workspace_documents" USING btree ("workspace_id","is_active");
--> statement-breakpoint

-- One workspace per distinct email domain already in use.
INSERT INTO "workspaces" ("name", "domain")
SELECT DISTINCT
	initcap(split_part(u."email_domain", '.', 1)),
	u."email_domain"
FROM "users" u
WHERE u."email_domain" <> ''
ON CONFLICT ("domain") DO NOTHING;
--> statement-breakpoint

ALTER TABLE "users" ADD COLUMN "workspace_id" uuid;
--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_workspace_id_fk"
	FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE set null;
--> statement-breakpoint
UPDATE "users" u SET "workspace_id" = w."id"
FROM "workspaces" w WHERE w."domain" = u."email_domain";
--> statement-breakpoint

ALTER TABLE "accounts" ADD COLUMN "workspace_id" uuid;
--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_workspace_id_fk"
	FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade;
--> statement-breakpoint
UPDATE "accounts" a SET "workspace_id" = u."workspace_id"
FROM "users" u WHERE u."id" = a."owner_user_id";
--> statement-breakpoint

-- The change this migration exists for.
ALTER TABLE "embeddings" ADD COLUMN "workspace_id" uuid;
--> statement-breakpoint
ALTER TABLE "embeddings" ADD CONSTRAINT "embeddings_workspace_id_fk"
	FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade;
--> statement-breakpoint
UPDATE "embeddings" e SET "workspace_id" = a."workspace_id"
FROM "accounts" a WHERE a."id" = e."account_id";
--> statement-breakpoint
ALTER TABLE "embeddings" ALTER COLUMN "account_id" DROP NOT NULL;
--> statement-breakpoint
ALTER TYPE "public"."source_type" ADD VALUE IF NOT EXISTS 'workspace_doc';
