from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.schemas.export import BulkExportRequest, BulkExportResult, BulkRenameRequest, BulkRenameResult
from app.services.bulk_rename_service import BulkRenameService
from app.services.export_service import ExportService

router = APIRouter()


@router.post("/bulk-rename", response_model=BulkRenameResult)
def bulk_rename(payload: BulkRenameRequest, db: Session = Depends(get_db)) -> BulkRenameResult:
    """Rename multiple documents using OCR and identifier detection per file."""
    service = BulkRenameService(db)
    return service.bulk_rename(payload)


@router.post("/bulk-export", response_model=BulkExportResult)
def bulk_export(payload: BulkExportRequest, db: Session = Depends(get_db)) -> BulkExportResult:
    """Export multiple documents"""
    export_service = ExportService(db)
    return export_service.bulk_export(payload.document_ids, payload.save_location)
