-- Upgrade for databases created before jobs stored result metadata.
-- Not needed after 000_init_schema.sql; safe to re-run.
ALTER TABLE processing_jobs ADD COLUMN IF NOT EXISTS result_metadata JSON;
