from fastapi import APIRouter, Depends, File, UploadFile
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.schemas.document import DocumentRead
from app.services.document_service import DocumentService

router = APIRouter()


@router.post("", response_model=DocumentRead, status_code=201)
def upload_document(file: UploadFile = File(...), db: Session = Depends(get_db)) -> DocumentRead:
    service = DocumentService(db)
    return service.create_from_upload(file)


@router.get("", response_model=list[DocumentRead])
def list_documents(db: Session = Depends(get_db)) -> list[DocumentRead]:
    service = DocumentService(db)
    return service.list_documents()
