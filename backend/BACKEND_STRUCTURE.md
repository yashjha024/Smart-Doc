# DocRename Backend Structure

## Root

- `requirements.txt`: Python dependencies for the FastAPI backend, SQLite ORM, uploads, OCR, and PDF processing.
- `.env.example`: Example local configuration values.
- `.gitignore`: Keeps local virtual environments, SQLite files, and uploaded data out of version control.

## `app/`

- `__init__.py`: Marks the backend application as a Python package.
- `main.py`: Creates the FastAPI app, configures CORS, registers API routers, initializes SQLite tables, and creates local storage folders on startup.

## `app/core/`

- `__init__.py`: Package marker for core application settings.
- `config.py`: Central settings object for app name, version, SQLite URL, CORS origins, and local storage paths.

## `app/routers/`

- `__init__.py`: Package marker for HTTP route modules.
- `api.py`: Collects all feature routers into one `api_router` mounted by `main.py`.
- `health.py`: Health endpoint for checking backend status and active storage root.
- `documents.py`: Upload and list endpoints for source documents.
- `ocr.py`: Runs OCR/text extraction for a stored document and persists extracted text plus detected identifiers.
- `identifiers.py`: Accepts extracted OCR text and returns possible identifier values with confidence scores.
- `rename.py`: Filename preview, rename, and undo route placeholders.
- `compression.py`: Runs PDF compression requests for low, medium, high, and target-size modes.

## `app/services/`

- `__init__.py`: Package marker for business logic modules.
- `document_service.py`: Handles document upload validation, local file saving, and document database records.
- `identifier_service.py`: Detects account numbers, certificate numbers, invoice numbers, receipt numbers, membership IDs, and registration numbers from OCR text with confidence scores.
- `ocr_service.py`: Extracts native PDF text with PyMuPDF, falls back to PaddleOCR for scanned PDFs and images, and persists OCR results.
- `rename_service.py`: Handles template preview, prefix/suffix naming, filename sanitization, duplicate-safe file renames, history persistence, and undo.
- `compression_service.py`: Compresses PDFs with Ghostscript and PyMuPDF, supports presets and target-size attempts, writes output PDFs, persists jobs, and returns compression statistics.

## `app/models/`

- `__init__.py`: Exports all SQLAlchemy models.
- `document.py`: Main uploaded-document table.
- `ocr_result.py`: Stores extracted OCR text for a document.
- `detected_identifier.py`: Stores candidate identifiers found in OCR text.
- `rename_history.py`: Stores filename changes and undo state.
- `compression_job.py`: Stores compression attempts, modes, optional target size, sizes, output files, and status.

## `app/schemas/`

- `__init__.py`: Package marker for Pydantic schemas.
- `health.py`: Response model for health checks.
- `document.py`: Response model for document records.
- `identifier.py`: Request and response models for direct identifier detection and persisted detected identifiers.
- `ocr.py`: Response model for OCR results.
- `rename.py`: Request and response models for rename preview, rename, and undo.
- `compression.py`: Request and response models for PDF compression, including before/after sizes, savings, ratio, backend, and target-size status.

## `app/database/`

- `__init__.py`: Exports database engine, session factory, base model class, and dependency helpers.
- `session.py`: Creates the SQLite SQLAlchemy engine, `SessionLocal`, `Base`, `get_db`, and `init_db`.
- `base.py`: Imports every model so SQLAlchemy can create all tables.

## `app/utils/`

- `__init__.py`: Package marker for shared helpers.
- `file_validation.py`: Validates accepted upload content types: PDF, JPG, and PNG.
- `file_storage.py`: Saves uploaded files into local storage and returns stored filename plus size.
- `filename.py`: Template token parsing, safe template rendering, Windows-safe filename sanitization, and filename construction.
- `pdf.py`: Small PDF-related helper functions.
- `ocr.py`: OCR file-type helper functions for PDFs and supported image formats.

## Compatibility Packages

- `app/api/`: Compatibility wrapper for the older Phase 1 route location. New code should use `app/routers`.
- `app/db/`: Compatibility wrapper for the older Phase 1 database location. New code should use `app/database`.
