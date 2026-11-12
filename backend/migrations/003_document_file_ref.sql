-- Bulk Rename documents point at shared storage (local disk or Vercel Blob).
-- Safe to re-run.
ALTER TABLE documents ADD COLUMN IF NOT EXISTS file_ref VARCHAR(255);
