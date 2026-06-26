from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.schemas.rename import RenamePreviewRequest, RenamePreviewResponse, RenameRequest, RenameResult
from app.services.rename_service import RenameService

router = APIRouter()


@router.post("/preview", response_model=RenamePreviewResponse)
def preview_rename(payload: RenamePreviewRequest) -> RenamePreviewResponse:
    service = RenameService()
    return service.preview(payload)


@router.post("", response_model=RenameResult)
def rename_document(payload: RenameRequest, db: Session = Depends(get_db)) -> RenameResult:
    service = RenameService(db)
    return service.rename(payload)


@router.post("/{history_id}/undo", response_model=RenameResult)
def undo_rename(history_id: int, db: Session = Depends(get_db)) -> RenameResult:
    service = RenameService(db)
    return service.undo(history_id)
