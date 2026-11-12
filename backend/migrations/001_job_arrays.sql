-- Upgrade for databases created before jobs stored file lists as JSON arrays.
-- Not needed after 000_init_schema.sql; safe to re-run (does nothing if already applied).
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_name = 'processing_jobs' AND column_name = 'input_file_reference') THEN
        ALTER TABLE processing_jobs ADD COLUMN IF NOT EXISTS input_files JSON NOT NULL DEFAULT '[]'::json;
        ALTER TABLE processing_jobs ADD COLUMN IF NOT EXISTS output_files JSON NOT NULL DEFAULT '[]'::json;

        UPDATE processing_jobs SET input_files = json_build_array(input_file_reference)
        WHERE input_file_reference IS NOT NULL;
        UPDATE processing_jobs SET output_files = json_build_array(output_file_reference)
        WHERE output_file_reference IS NOT NULL;

        ALTER TABLE processing_jobs DROP COLUMN input_file_reference;
        ALTER TABLE processing_jobs DROP COLUMN output_file_reference;
    END IF;
END $$;
