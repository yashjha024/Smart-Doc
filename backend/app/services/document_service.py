from pathlib import Path
from uuid import uuid4

from fastapi import HTTPException, UploadFile, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.document import Document
from app.models.file_record import FileRecord
from app.services.storage import get_storage_provider
from app.utils.file_types import content_matches_extension
from app.utils.filename import sanitize_filename

# Bulk Rename reads documents with PyMuPDF / OCR.
SUPPORTED_EXTENSIONS = {".pdf", ".jpg", ".jpeg", ".png"}


class DocumentService:
    def __init__(self, db: Session) -> None:
        self.db = db

    def create_from_upload(self, file: UploadFile) -> Document:
        """Direct multipart upload (local development; on Vercel use create_from_file)."""
        name = file.filename or "upload"
        self._check_extension(name)
        limit = settings.max_upload_mb * 1024 * 1024
        data = file.file.read(limit + 1)
        if len(data) > limit:
            raise HTTPException(status_code=413, detail=f"{name} is larger than the {settings.max_upload_mb} MB limit.")
        if not data:
            raise HTTPException(status_code=400, detail="The uploaded file is empty.")
        if not content_matches_extension(name, data[:1024]):
            raise HTTPException(status_code=400, detail=f"{name} doesn't look like a real {Path(name).suffix.upper().lstrip('.')} file.")
        ref = get_storage_provider().put(data, name)
        return self._create(name, ref, file.content_type or "application/octet-stream", len(data))

    def create_from_file(self, file_id: str) -> Document:
        """Turn a file uploaded through /files (direct or Vercel Blob) into a Bulk Rename document."""
        record = self.db.query(FileRecord).filter(FileRecord.stored_reference == file_id).first()
        if record is None:
            raise HTTPException(status_code=404, detail="Uploaded file not found. It may have expired.")
        self._check_extension(record.original_filename)
        return self._create(record.original_filename, record.stored_reference, record.mime_type, record.size_bytes)

    def _create(self, original: str, ref: str, content_type: str, size: int) -> Document:
        document = Document(
            original_filename=original,
            # Unique working name; a rename replaces it. The content stays at file_ref.
            stored_filename=f"{uuid4().hex}_{sanitize_filename(original)}",
            content_type=content_type,
            file_size_bytes=size,
            status="uploaded",
            file_ref=ref,
        )
        self.db.add(document)
        self.db.commit()
        self.db.refresh(document)
        return document

    @staticmethod
    def _check_extension(name: str) -> None:
        if Path(name).suffix.lower() not in SUPPORTED_EXTENSIONS:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Only PDF, JPG, and PNG files are supported.")

    def list_documents(self, ids: list[int] | None = None) -> list[Document]:
        statement = select(Document).order_by(Document.created_at.desc())
        if ids is not None:
            statement = statement.where(Document.id.in_(ids))
        return list(self.db.scalars(statement).all())

    def get_document(self, document_id: int) -> Document:
        document = self.db.get(Document, document_id)
        if document is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Document not found.",
            )
        return document
