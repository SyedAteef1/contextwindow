ALTER TABLE "embeddings" ADD COLUMN "sparse_vector" sparsevec(250002);--> statement-breakpoint
CREATE INDEX "ix_embeddings_sparse_hnsw" ON "embeddings" USING hnsw ("sparse_vector" sparsevec_ip_ops);