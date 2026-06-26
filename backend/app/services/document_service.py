from fastapi import HTTPException, UploadFile, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.document import Document
from app.utils.file_storage import save_upload
from app.utils.file_validation import validate_upload_type


class DocumentService:
    def __init__(self, db: Session) -> None:
        self.db = db

    def create_from_upload(self, file: UploadFile) -> Document:
        validate_upload_type(file)
        stored_filename, file_size = save_upload(file)

        document = Document(
            original_filename=file.filename or stored_filename,
            stored_filename=stored_filename,
            content_type=file.content_type or "application/octet-stream",
            file_size_bytes=file_size,
            status="uploaded",
        )
        self.db.add(document)
        self.db.commit()
        self.db.refresh(document)
        return document

    def list_documents(self) -> list[Document]:
        statement = select(Document).order_by(Document.created_at.desc())
        return list(self.db.scalars(statement).all())

    def get_document(self, document_id: int) -> Document:
        document = self.db.get(Document, document_id)
        if document is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Document not found.",
            )
        return document
