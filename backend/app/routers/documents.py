from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.schemas.document import DocumentRead
from app.services.document_service import DocumentService

router = APIRouter()


class FromFileRequest(BaseModel):
    file_id: str


@router.post("", response_model=DocumentRead, status_code=201)
def upload_document(file: UploadFile = File(...), db: Session = Depends(get_db)) -> DocumentRead:
    return DocumentService(db).create_from_upload(file)


@router.post("/from-file", response_model=DocumentRead, status_code=201)
def document_from_file(payload: FromFileRequest, db: Session = Depends(get_db)) -> DocumentRead:
    """Create a Bulk Rename document from a file already uploaded via /files (works with Vercel Blob)."""
    return DocumentService(db).create_from_file(payload.file_id)


@router.get("", response_model=list[DocumentRead])
def list_documents(ids: str = Query(default="", description="Comma-separated document ids"), db: Session = Depends(get_db)) -> list[DocumentRead]:
    """Only returns the documents asked for, so one visitor never sees another's files."""
    try:
        wanted = [int(i) for i in ids.split(",") if i.strip()]
    except ValueError:
        raise HTTPException(status_code=400, detail="ids must be comma-separated numbers")
    if not wanted:
        return []
    return DocumentService(db).list_documents(wanted[:500])
