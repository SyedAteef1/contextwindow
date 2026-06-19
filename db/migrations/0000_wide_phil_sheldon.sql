CREATE EXTENSION IF NOT EXISTS vector;--> statement-breakpoint
CREATE TYPE "public"."chunk_type" AS ENUM('text', 'image');--> statement-breakpoint
CREATE TYPE "public"."connection_provider" AS ENUM('notion', 'google-drive', 'onedrive', 'slack', 'gmail', 'github', 'zendesk', 'pagerduty');--> statement-breakpoint
CREATE TYPE "public"."document_status" AS ENUM('unknown', 'queued', 'extracting', 'chunking', 'embedding', 'indexing', 'done', 'failed');--> statement-breakpoint
CREATE TYPE "public"."document_type" AS ENUM('text', 'pdf', 'tweet', 'google_doc', 'google_slide', 'google_sheet', 'image', 'video', 'notion_doc', 'webpage', 'onedrive', 'slack', 'email', 'ticket');--> statement-breakpoint
CREATE TYPE "public"."memory_relation" AS ENUM('updates', 'extends', 'derives');--> statement-breakpoint
CREATE TYPE "public"."space_role" AS ENUM('owner', 'admin', 'editor', 'viewer');--> statement-breakpoint
CREATE TYPE "public"."visibility" AS ENUM('public', 'private', 'unlisted');--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text NOT NULL,
	"principal_id" text,
	"surface" text,
	"kind" text NOT NULL,
	"payload" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chunks" (
	"id" text PRIMARY KEY NOT NULL,
	"document_id" text NOT NULL,
	"content" text NOT NULL,
	"embedded_content" text,
	"type" "chunk_type" DEFAULT 'text' NOT NULL,
	"position" integer NOT NULL,
	"metadata" jsonb,
	"embedding" vector(384),
	"embedding_model" text,
	"embedding_new" vector(384),
	"embedding_new_model" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "connections" (
	"id" text PRIMARY KEY NOT NULL,
	"provider" "connection_provider" NOT NULL,
	"org_id" text NOT NULL,
	"user_id" text NOT NULL,
	"email" text,
	"document_limit" integer DEFAULT 10000 NOT NULL,
	"container_tags" text[],
	"access_token" text,
	"refresh_token" text,
	"expires_at" timestamp,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "documents" (
	"id" text PRIMARY KEY NOT NULL,
	"custom_id" text,
	"content_hash" text,
	"org_id" text NOT NULL,
	"user_id" text NOT NULL,
	"connection_id" text,
	"title" text,
	"content" text,
	"summary" text,
	"url" text,
	"source" text,
	"type" "document_type" DEFAULT 'text' NOT NULL,
	"status" "document_status" DEFAULT 'unknown' NOT NULL,
	"metadata" jsonb,
	"processing_metadata" jsonb,
	"token_count" integer,
	"word_count" integer,
	"chunk_count" integer DEFAULT 0 NOT NULL,
	"summary_embedding" vector(384),
	"summary_embedding_model" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "documents_to_spaces" (
	"document_id" text NOT NULL,
	"space_id" text NOT NULL,
	CONSTRAINT "documents_to_spaces_document_id_space_id_pk" PRIMARY KEY("document_id","space_id")
);
--> statement-breakpoint
CREATE TABLE "identities" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text NOT NULL,
	"principal_id" text NOT NULL,
	"surface" text NOT NULL,
	"surface_user_id" text NOT NULL,
	"display_name" text,
	"roles" text[] DEFAULT '{}'::text[] NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "memories" (
	"id" text PRIMARY KEY NOT NULL,
	"memory" text NOT NULL,
	"space_id" text NOT NULL,
	"org_id" text NOT NULL,
	"user_id" text,
	"version" integer DEFAULT 1 NOT NULL,
	"is_latest" boolean DEFAULT true NOT NULL,
	"parent_memory_id" text,
	"root_memory_id" text,
	"memory_relations" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"source_count" integer DEFAULT 1 NOT NULL,
	"is_inference" boolean DEFAULT false NOT NULL,
	"is_forgotten" boolean DEFAULT false NOT NULL,
	"is_static" boolean DEFAULT false NOT NULL,
	"forget_after" timestamp,
	"forget_reason" text,
	"memory_embedding" vector(384),
	"memory_embedding_model" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "memory_document_sources" (
	"memory_id" text NOT NULL,
	"document_id" text NOT NULL,
	"relevance_score" double precision DEFAULT 100 NOT NULL,
	"metadata" jsonb,
	"added_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "memory_document_sources_memory_id_document_id_pk" PRIMARY KEY("memory_id","document_id")
);
--> statement-breakpoint
CREATE TABLE "oauth_states" (
	"state" text PRIMARY KEY NOT NULL,
	"provider" "connection_provider" NOT NULL,
	"org_id" text NOT NULL,
	"user_id" text NOT NULL,
	"code_verifier" text,
	"subdomain" text,
	"redirect_to" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "skills" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"procedure" jsonb NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"is_latest" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "spaces" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text,
	"description" text,
	"org_id" text NOT NULL,
	"owner_id" text NOT NULL,
	"container_tag" text,
	"visibility" "visibility" DEFAULT 'private' NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "chunks" ADD CONSTRAINT "chunks_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents_to_spaces" ADD CONSTRAINT "documents_to_spaces_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents_to_spaces" ADD CONSTRAINT "documents_to_spaces_space_id_spaces_id_fk" FOREIGN KEY ("space_id") REFERENCES "public"."spaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memories" ADD CONSTRAINT "memories_space_id_spaces_id_fk" FOREIGN KEY ("space_id") REFERENCES "public"."spaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memory_document_sources" ADD CONSTRAINT "memory_document_sources_memory_id_memories_id_fk" FOREIGN KEY ("memory_id") REFERENCES "public"."memories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memory_document_sources" ADD CONSTRAINT "memory_document_sources_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_org_idx" ON "audit_log" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "chunks_document_idx" ON "chunks" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX "chunks_embedding_idx" ON "chunks" USING hnsw ("embedding" vector_cosine_ops);--> statement-breakpoint
CREATE INDEX "documents_org_idx" ON "documents" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "documents_hash_idx" ON "documents" USING btree ("content_hash");--> statement-breakpoint
CREATE INDEX "identities_surface_idx" ON "identities" USING btree ("surface","surface_user_id");--> statement-breakpoint
CREATE INDEX "memories_space_idx" ON "memories" USING btree ("space_id");--> statement-breakpoint
CREATE INDEX "memories_org_idx" ON "memories" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "memories_latest_idx" ON "memories" USING btree ("is_latest");--> statement-breakpoint
CREATE INDEX "memories_embedding_idx" ON "memories" USING hnsw ("memory_embedding" vector_cosine_ops);