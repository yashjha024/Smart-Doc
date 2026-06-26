from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.schemas.compression import CompressionRequest, CompressionResult
from app.services.compression_service import CompressionService

router = APIRouter()


@router.post("", response_model=CompressionResult)
def compress_pdf(payload: CompressionRequest, db: Session = Depends(get_db)) -> CompressionResult:
    service = CompressionService(db)
    return service.compress(payload)
