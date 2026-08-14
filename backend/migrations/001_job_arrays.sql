-- PostgreSQL Migration: Migrate Job fields to JSON arrays

ALTER TABLE processing_jobs ADD COLUMN input_files JSON NOT NULL DEFAULT '[]'::json;
ALTER TABLE processing_jobs ADD COLUMN output_files JSON NOT NULL DEFAULT '[]'::json;

-- Migrate existing data (if any)
UPDATE processing_jobs 
SET input_files = json_build_array(input_file_reference) 
WHERE input_file_reference IS NOT NULL;

UPDATE processing_jobs 
SET output_files = json_build_array(output_file_reference) 
WHERE output_file_reference IS NOT NULL;

-- Drop old columns
ALTER TABLE processing_jobs DROP COLUMN input_file_reference;
ALTER TABLE processing_jobs DROP COLUMN output_file_reference;
