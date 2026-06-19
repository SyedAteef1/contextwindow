// Context Window — database schema (Postgres + pgvector, Drizzle ORM).
// The knowledge-plane core (documents/chunks/memories/spaces/connections) is a faithful
// port of supermemory's packages/validation/schemas.ts. The product-layer tables
// (identities/skills/audit_log) are new. The moat lives in `memories`: versioning,
// contradiction relations, and temporal forgetting.

import { sql } from "drizzle-orm"
import {
	boolean,
	doublePrecision,
	index,
	integer,
	jsonb,
	pgEnum,
	pgTable,
	primaryKey,
	text,
	timestamp,
	vector,
} from "drizzle-orm/pg-core"

// Embedding dimensions — local all-MiniLM-L6-v2 (Transformers.js). Keep in sync with
// lib/memory/embeddings.ts if you swap models.
export const EMBEDDING_DIM = 384

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------
export const documentType = pgEnum("document_type", [
	"text", "pdf", "tweet", "google_doc", "google_slide", "google_sheet",
	"image", "video", "notion_doc", "webpage", "onedrive", "slack", "email", "ticket",
])
export const documentStatus = pgEnum("document_status", [
	"unknown", "queued", "extracting", "chunking", "embedding", "indexing", "done", "failed",
])
export const chunkType = pgEnum("chunk_type", ["text", "image"])
export const connectionProvider = pgEnum("connection_provider", [
	"notion", "google-drive", "onedrive", "slack", "gmail", "github", "zendesk", "pagerduty",
])
export const memoryRelation = pgEnum("memory_relation", ["updates", "extends", "derives"])
export const visibility = pgEnum("visibility", ["public", "private", "unlisted"])
export const spaceRole = pgEnum("space_role", ["owner", "admin", "editor", "viewer"])

// ---------------------------------------------------------------------------
// Spaces — containers / projects (a "containerTag" groups memories)
// ---------------------------------------------------------------------------
export const spaces = pgTable("spaces", {
	id: text("id").primaryKey(),
	name: text("name"),
	description: text("description"),
	orgId: text("org_id").notNull(),
	ownerId: text("owner_id").notNull(),
	containerTag: text("container_tag"),
	visibility: visibility("visibility").default("private").notNull(),
	metadata: jsonb("metadata"),
	createdAt: timestamp("created_at").defaultNow().notNull(),
	updatedAt: timestamp("updated_at").defaultNow().notNull(),
})

// ---------------------------------------------------------------------------
// Documents — raw ingested content (dedupe via contentHash)
// ---------------------------------------------------------------------------
export const documents = pgTable(
	"documents",
	{
		id: text("id").primaryKey(),
		customId: text("custom_id"),
		contentHash: text("content_hash"),
		orgId: text("org_id").notNull(),
		userId: text("user_id").notNull(),
		connectionId: text("connection_id"),

		title: text("title"),
		content: text("content"),
		summary: text("summary"),
		url: text("url"),
		source: text("source"),
		type: documentType("type").default("text").notNull(),
		status: documentStatus("status").default("unknown").notNull(),

		metadata: jsonb("metadata"),
		processingMetadata: jsonb("processing_metadata"),

		tokenCount: integer("token_count"),
		wordCount: integer("word_count"),
		chunkCount: integer("chunk_count").default(0).notNull(),

		summaryEmbedding: vector("summary_embedding", { dimensions: EMBEDDING_DIM }),
		summaryEmbeddingModel: text("summary_embedding_model"),

		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at").defaultNow().notNull(),
	},
	(t) => [
		index("documents_org_idx").on(t.orgId),
		index("documents_hash_idx").on(t.contentHash),
	],
)

// ---------------------------------------------------------------------------
// Chunks — semantic chunks with embeddings (embeddingNew supports model migration)
// ---------------------------------------------------------------------------
export const chunks = pgTable(
	"chunks",
	{
		id: text("id").primaryKey(),
		documentId: text("document_id").notNull().references(() => documents.id, { onDelete: "cascade" }),
		content: text("content").notNull(),
		embeddedContent: text("embedded_content"),
		type: chunkType("type").default("text").notNull(),
		position: integer("position").notNull(),
		metadata: jsonb("metadata"),

		embedding: vector("embedding", { dimensions: EMBEDDING_DIM }),
		embeddingModel: text("embedding_model"),
		embeddingNew: vector("embedding_new", { dimensions: EMBEDDING_DIM }),
		embeddingNewModel: text("embedding_new_model"),

		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(t) => [
		index("chunks_document_idx").on(t.documentId),
		// HNSW index for fast approximate cosine search.
		index("chunks_embedding_idx").using("hnsw", t.embedding.op("vector_cosine_ops")),
	],
)

// ---------------------------------------------------------------------------
// Memories — distilled facts. THE MOAT: versioning + contradiction + forgetting.
// ---------------------------------------------------------------------------
export const memories = pgTable(
	"memories",
	{
		id: text("id").primaryKey(),
		memory: text("memory").notNull(),
		spaceId: text("space_id").notNull().references(() => spaces.id, { onDelete: "cascade" }),
		orgId: text("org_id").notNull(),
		userId: text("user_id"),

		// Version control
		version: integer("version").default(1).notNull(),
		isLatest: boolean("is_latest").default(true).notNull(),
		parentMemoryId: text("parent_memory_id"),
		rootMemoryId: text("root_memory_id"),

		// Relationships: { [targetMemoryId]: "updates" | "extends" | "derives" }
		memoryRelations: jsonb("memory_relations").default(sql`'{}'::jsonb`).notNull(),

		sourceCount: integer("source_count").default(1).notNull(),

		// Status flags + temporal forgetting
		isInference: boolean("is_inference").default(false).notNull(),
		isForgotten: boolean("is_forgotten").default(false).notNull(),
		isStatic: boolean("is_static").default(false).notNull(),
		forgetAfter: timestamp("forget_after"),
		forgetReason: text("forget_reason"),

		memoryEmbedding: vector("memory_embedding", { dimensions: EMBEDDING_DIM }),
		memoryEmbeddingModel: text("memory_embedding_model"),

		metadata: jsonb("metadata"),

		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at").defaultNow().notNull(),
	},
	(t) => [
		index("memories_space_idx").on(t.spaceId),
		index("memories_org_idx").on(t.orgId),
		index("memories_latest_idx").on(t.isLatest),
		// HNSW index for fast approximate cosine search over the memory graph.
		index("memories_embedding_idx").using("hnsw", t.memoryEmbedding.op("vector_cosine_ops")),
	],
)

// memory -> source document provenance
export const memoryDocumentSources = pgTable(
	"memory_document_sources",
	{
		memoryId: text("memory_id").notNull().references(() => memories.id, { onDelete: "cascade" }),
		documentId: text("document_id").notNull().references(() => documents.id, { onDelete: "cascade" }),
		relevanceScore: doublePrecision("relevance_score").default(100).notNull(),
		metadata: jsonb("metadata"),
		addedAt: timestamp("added_at").defaultNow().notNull(),
	},
	(t) => [primaryKey({ columns: [t.memoryId, t.documentId] })],
)

export const documentsToSpaces = pgTable(
	"documents_to_spaces",
	{
		documentId: text("document_id").notNull().references(() => documents.id, { onDelete: "cascade" }),
		spaceId: text("space_id").notNull().references(() => spaces.id, { onDelete: "cascade" }),
	},
	(t) => [primaryKey({ columns: [t.documentId, t.spaceId] })],
)

// ---------------------------------------------------------------------------
// Connections — OAuth integrations (sources AND surfaces)
// ---------------------------------------------------------------------------
export const connections = pgTable("connections", {
	id: text("id").primaryKey(),
	provider: connectionProvider("provider").notNull(),
	orgId: text("org_id").notNull(),
	userId: text("user_id").notNull(),
	email: text("email"),
	documentLimit: integer("document_limit").default(10000).notNull(),
	containerTags: text("container_tags").array(),
	accessToken: text("access_token"),
	refreshToken: text("refresh_token"),
	expiresAt: timestamp("expires_at"),
	metadata: jsonb("metadata").default(sql`'{}'::jsonb`).notNull(),
	createdAt: timestamp("created_at").defaultNow().notNull(),
})

// ---------------------------------------------------------------------------
// PRODUCT LAYER (new) — identities, skills, audit
// ---------------------------------------------------------------------------

// Maps a surface user (e.g. Slack U123) to an internal principal + permissions.
export const identities = pgTable(
	"identities",
	{
		id: text("id").primaryKey(),
		orgId: text("org_id").notNull(),
		principalId: text("principal_id").notNull(), // internal canonical user
		surface: text("surface").notNull(), // "slack" | "claude" | "email" | "web" | ...
		surfaceUserId: text("surface_user_id").notNull(), // e.g. Slack user id
		displayName: text("display_name"),
		roles: text("roles").array().default(sql`'{}'::text[]`).notNull(),
		metadata: jsonb("metadata"),
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(t) => [index("identities_surface_idx").on(t.surface, t.surfaceUserId)],
)

// Compiled executable skills (SKILL.md packages) extracted from memory.
export const skills = pgTable("skills", {
	id: text("id").primaryKey(),
	orgId: text("org_id").notNull(),
	name: text("name").notNull(),
	description: text("description"),
	// The compiled procedure IR (steps, decisions, guardrails, provenance).
	procedure: jsonb("procedure").notNull(),
	version: integer("version").default(1).notNull(),
	isLatest: boolean("is_latest").default(true).notNull(),
	createdAt: timestamp("created_at").defaultNow().notNull(),
	updatedAt: timestamp("updated_at").defaultNow().notNull(),
})

// Every answer, action, and approval — the audit trail.
export const auditLog = pgTable(
	"audit_log",
	{
		id: text("id").primaryKey(),
		orgId: text("org_id").notNull(),
		principalId: text("principal_id"),
		surface: text("surface"),
		kind: text("kind").notNull(), // "answer" | "act" | "approval" | "ingest" | "brief"
		payload: jsonb("payload").notNull(),
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(t) => [index("audit_org_idx").on(t.orgId)],
)

// Short-lived OAuth state (CSRF nonce + PKCE verifier) between authorize and callback.
export const oauthStates = pgTable("oauth_states", {
	state: text("state").primaryKey(),
	provider: connectionProvider("provider").notNull(),
	orgId: text("org_id").notNull(),
	userId: text("user_id").notNull(),
	codeVerifier: text("code_verifier"),
	subdomain: text("subdomain"), // for Zendesk-style per-account hosts
	redirectTo: text("redirect_to"),
	createdAt: timestamp("created_at").defaultNow().notNull(),
	expiresAt: timestamp("expires_at").notNull(),
})
