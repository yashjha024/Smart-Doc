from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.schemas.ocr import OcrResultRead
from app.services.ocr_service import OcrService

router = APIRouter()


@router.post("/{document_id}", response_model=OcrResultRead)
def extract_document_text(document_id: int, db: Session = Depends(get_db)) -> OcrResultRead:
    service = OcrService(db)
    return service.extract_for_document(document_id)
