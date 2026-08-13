from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.schemas.convert import ConvertRequest, ConvertResult
from app.services.convert_service import ConvertService

router = APIRouter()

@router.post("", response_model=ConvertResult)
def convert_document(payload: ConvertRequest, db: Session = Depends(get_db)) -> ConvertResult:
    service = ConvertService(db)
    output_filename = service.convert_document(payload.document_id, payload.target_format)
    
    return ConvertResult(
        document_id=payload.document_id,
        output_filename=output_filename,
        message=f"Document successfully converted to {payload.target_format.upper()}."
    )

@router.get("/download/{filename}")
def download_converted(filename: str):
    from fastapi.responses import FileResponse
    from app.utils.file_storage import get_output_path
    import os
    
    file_path = get_output_path(filename)
    if not file_path.exists():
        return {"error": "File not found"}
        
    return FileResponse(
        path=file_path,
        filename=filename,
        media_type="application/octet-stream",
    )
