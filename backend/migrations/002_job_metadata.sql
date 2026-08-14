-- PostgreSQL Migration: Add result_metadata to ProcessingJobs

ALTER TABLE processing_jobs ADD COLUMN result_metadata JSON;
