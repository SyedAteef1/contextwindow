CREATE TYPE "public"."episode_role" AS ENUM('user', 'assistant', 'system', 'event');--> statement-breakpoint
CREATE TABLE "episodes" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text NOT NULL,
	"session_id" text NOT NULL,
	"principal_id" text,
	"surface" text,
	"role" "episode_role" NOT NULL,
	"content" text NOT NULL,
	"embedding" vector(384),
	"embedding_model" text,
	"consolidated" boolean DEFAULT false NOT NULL,
	"consolidated_at" timestamp,
	"consolidation_memory_ids" jsonb,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "episodes_org_idx" ON "episodes" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "episodes_session_idx" ON "episodes" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "episodes_unconsolidated_idx" ON "episodes" USING btree ("org_id","consolidated");--> statement-breakpoint
CREATE INDEX "episodes_embedding_idx" ON "episodes" USING hnsw ("embedding" vector_cosine_ops);