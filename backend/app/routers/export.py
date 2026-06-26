from fastapi import APIRouter, Depends
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.schemas.export import ExportRequest, ExportResult
from app.services.export_service import ExportService
from app.utils.file_storage import get_upload_path

router = APIRouter()


@router.post("/export", response_model=ExportResult)
def export_document(payload: ExportRequest, db: Session = Depends(get_db)) -> ExportResult:
    """Export a renamed document"""
    service = ExportService(db)
    return service.export_document(payload.document_id, payload.save_location)


@router.get("/download/{document_id}")
def download_document(document_id: int, db: Session = Depends(get_db)):
    """Download a document for immediate use"""
    from app.models.document import Document

    document = db.get(Document, document_id)
    if document is None:
        return {"error": "Document not found"}

    file_path = get_upload_path(document.stored_filename)
    if not file_path.exists():
        return {"error": "File not found"}

    return FileResponse(
        path=file_path,
        filename=document.stored_filename,
        media_type="application/octet-stream",
    )
