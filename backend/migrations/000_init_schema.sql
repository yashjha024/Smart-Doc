
CREATE TABLE documents (
	id SERIAL NOT NULL, 
	original_filename VARCHAR(255) NOT NULL, 
	stored_filename VARCHAR(255) NOT NULL, 
	content_type VARCHAR(100) NOT NULL, 
	file_size_bytes INTEGER NOT NULL, 
	status VARCHAR(50) NOT NULL, 
	created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL, 
	export_count INTEGER NOT NULL, 
	PRIMARY KEY (id), 
	UNIQUE (stored_filename)
)

;
CREATE INDEX ix_documents_id ON documents (id);

CREATE TABLE file_records (
	id VARCHAR(36) NOT NULL, 
	original_filename VARCHAR(255) NOT NULL, 
	stored_reference VARCHAR(255) NOT NULL, 
	mime_type VARCHAR(100) NOT NULL, 
	size_bytes BIGINT NOT NULL, 
	storage_provider VARCHAR(50) NOT NULL, 
	created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL, 
	expires_at TIMESTAMP WITHOUT TIME ZONE, 
	PRIMARY KEY (id)
)

;
CREATE INDEX ix_file_records_id ON file_records (id);
CREATE INDEX ix_file_records_expires_at ON file_records (expires_at);
CREATE UNIQUE INDEX ix_file_records_stored_reference ON file_records (stored_reference);

CREATE TABLE processing_jobs (
	id VARCHAR(36) NOT NULL, 
	tool_id VARCHAR(100) NOT NULL, 
	status VARCHAR(50) NOT NULL, 
	input_files JSON NOT NULL, 
	output_files JSON NOT NULL, 
	configuration JSON, 
	error_information TEXT, 
	result_metadata JSON, 
	created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL, 
	updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL, 
	completed_at TIMESTAMP WITHOUT TIME ZONE, 
	expires_at TIMESTAMP WITHOUT TIME ZONE, 
	PRIMARY KEY (id)
)

;
CREATE INDEX ix_processing_jobs_expires_at ON processing_jobs (expires_at);
CREATE INDEX ix_processing_jobs_status ON processing_jobs (status);
CREATE INDEX ix_processing_jobs_id ON processing_jobs (id);

CREATE TABLE compression_jobs (
	id SERIAL NOT NULL, 
	document_id INTEGER NOT NULL, 
	mode VARCHAR(50) NOT NULL, 
	target_size_kb INTEGER, 
	original_size_bytes INTEGER NOT NULL, 
	compressed_size_bytes INTEGER, 
	output_filename VARCHAR(255), 
	status VARCHAR(50) NOT NULL, 
	created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(document_id) REFERENCES documents (id)
)

;
CREATE INDEX ix_compression_jobs_id ON compression_jobs (id);
CREATE INDEX ix_compression_jobs_document_id ON compression_jobs (document_id);

CREATE TABLE detected_identifiers (
	id SERIAL NOT NULL, 
	document_id INTEGER NOT NULL, 
	label VARCHAR(100) NOT NULL, 
	display_label VARCHAR(100) NOT NULL, 
	value VARCHAR(255) NOT NULL, 
	confidence FLOAT NOT NULL, 
	created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(document_id) REFERENCES documents (id)
)

;
CREATE INDEX ix_detected_identifiers_id ON detected_identifiers (id);
CREATE INDEX ix_detected_identifiers_document_id ON detected_identifiers (document_id);

CREATE TABLE ocr_results (
	id SERIAL NOT NULL, 
	document_id INTEGER NOT NULL, 
	extracted_text TEXT NOT NULL, 
	engine TEXT NOT NULL, 
	created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(document_id) REFERENCES documents (id)
)

;
CREATE INDEX ix_ocr_results_document_id ON ocr_results (document_id);
CREATE INDEX ix_ocr_results_id ON ocr_results (id);

CREATE TABLE rename_history (
	id SERIAL NOT NULL, 
	document_id INTEGER NOT NULL, 
	previous_filename VARCHAR(255) NOT NULL, 
	new_filename VARCHAR(255) NOT NULL, 
	template_used VARCHAR(255), 
	created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL, 
	undone_at TIMESTAMP WITHOUT TIME ZONE, 
	PRIMARY KEY (id), 
	FOREIGN KEY(document_id) REFERENCES documents (id)
)

;
CREATE INDEX ix_rename_history_id ON rename_history (id);
CREATE INDEX ix_rename_history_document_id ON rename_history (document_id);
