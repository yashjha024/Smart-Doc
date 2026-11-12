from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from datetime import datetime, timedelta

from app.database.session import get_db
from app.models.file_record import FileRecord
from app.services.storage import get_storage_provider
from app.core.config import settings

router = APIRouter()

@router.post("/upload")
def upload_file(file: UploadFile = File(...), db: Session = Depends(get_db)):
    storage = get_storage_provider()
    
    if not file.filename:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="A file name is required.")

    file_bytes = file.file.read()
    if not file_bytes:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="The uploaded file is empty.")
    stored_ref = storage.put(file_bytes, file.filename)
    
    ttl = timedelta(minutes=settings.file_ttl_minutes)
    
    record = FileRecord(
        original_filename=file.filename,
        stored_reference=stored_ref,
        mime_type=file.content_type or "application/octet-stream",
        size_bytes=len(file_bytes),
        expires_at=datetime.utcnow() + ttl
    )
    
    db.add(record)
    db.commit()
    db.refresh(record)
    
    return {"file_id": record.stored_reference, "original_filename": file.filename}

@router.get("/{file_id}/download")
def download_file(file_id: str, db: Session = Depends(get_db)):
    """Download a file by the reference returned from upload/jobs, verifying TTL expiration."""
    file_record = (
        db.query(FileRecord).filter(FileRecord.stored_reference == file_id).first()
        or db.get(FileRecord, file_id)
    )
    
    if not file_record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, 
            detail="File record not found."
        )
        
    if file_record.expires_at and file_record.expires_at < datetime.utcnow():
        raise HTTPException(
            status_code=status.HTTP_410_GONE, 
            detail="File has expired and is no longer available."
        )

    storage = get_storage_provider()
    
    if not storage.exists(file_record.stored_reference):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, 
            detail="File data not found in storage."
        )

    # For local storage provider, we return a FileResponse directly
    # In the future, this might return a signed S3 URL or stream from S3
    local_path = storage.get_local_path(file_record.stored_reference)
    
    return FileResponse(
        path=local_path,
        filename=file_record.original_filename,
        media_type=file_record.mime_type or "application/octet-stream"
    )
