import shutil
from pathlib import Path

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.document import Document
from app.schemas.export import BulkExportResult, BulkRenameResult, ExportResult
from app.utils.file_storage import get_upload_path


class ExportService:
    def __init__(self, db: Session | None = None) -> None:
        self.db = db

    def export_document(self, document_id: int, save_location: str = "default") -> ExportResult:
        """Export a renamed document"""
        if self.db is None:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Database session missing.")

        document = self.db.get(Document, document_id)
        if document is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Document not found.",
            )

        source_path = get_upload_path(document.stored_filename)
        if not source_path.exists():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Stored document file was not found.",
            )

        # Create export directory
        export_dir = settings.output_dir / "exports"
        export_dir.mkdir(parents=True, exist_ok=True)

        # Copy file to export location
        target_path = export_dir / document.stored_filename
        shutil.copy2(source_path, target_path)

        # Update export count
        document.export_count = (document.export_count or 0) + 1
        self.db.add(document)
        self.db.commit()

        return ExportResult(
            document_id=document_id,
            filename=document.stored_filename,
            export_location=str(export_dir),
            message=f"Document exported successfully to {export_dir}",
        )

    def bulk_export(self, document_ids: list[int], save_location: str = "default") -> BulkExportResult:
        """Export multiple documents"""
        if self.db is None:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Database session missing.")

        export_dir = settings.output_dir / "bulk_exports"
        export_dir.mkdir(parents=True, exist_ok=True)

        successful = 0
        failed = 0

        for doc_id in document_ids:
            try:
                self.export_document(doc_id, save_location)
                successful += 1
            except Exception:
                failed += 1

        return BulkExportResult(
            total=len(document_ids),
            successful=successful,
            failed=failed,
            export_path=str(export_dir),
            message=f"Bulk export complete. Exported {successful}/{len(document_ids)} documents.",
        )
