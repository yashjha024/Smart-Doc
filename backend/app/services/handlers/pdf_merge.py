import fitz  # PyMuPDF
from typing import Dict, Any
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
import uuid

from app.services.handlers.base import BaseHandler
from app.services.job_service import JobService
from app.services.storage import get_storage_provider
from app.models.file_record import FileRecord
from app.core.config import settings

class PdfMergeHandler(BaseHandler):
    @classmethod
    def execute(cls, job_id: str, db: Session, **kwargs) -> Dict[str, Any]:
        job_service = JobService(db)
        job = job_service.get_job(job_id)
        
        if not job.input_files or len(job.input_files) < 2:
            raise ValueError("Merge requires at least two input PDF files.")
            
        storage = get_storage_provider()
        
        # Validate all inputs and get local paths
        source_paths = []
        for ref in job.input_files:
            record = db.query(FileRecord).filter(FileRecord.stored_reference == ref).first()
            if not record:
                raise ValueError(f"Input file record not found for reference {ref}")
            if not record.original_filename.lower().endswith(".pdf"):
                raise ValueError(f"File {record.original_filename} is not a valid PDF")
            source_paths.append(storage.get_local_path(record.stored_reference))
            
        merged_doc = fitz.open()
        
        try:
            for path in source_paths:
                with fitz.open(path) as doc:
                    merged_doc.insert_pdf(doc)
            
            output_bytes = merged_doc.tobytes()
        finally:
            merged_doc.close()
            
        # Determine output filename
        unique_suffix = uuid.uuid4().hex[:6]
        final_filename = f"merged_{unique_suffix}.pdf"
        
        # Save to storage
        output_ref = storage.put(output_bytes, final_filename)
        
        # Create file record
        ttl = timedelta(minutes=settings.file_ttl_minutes)
        out_record = FileRecord(
            original_filename=final_filename,
            stored_reference=output_ref,
            mime_type="application/pdf",
            size_bytes=len(output_bytes),
            expires_at=datetime.utcnow() + ttl
        )
        db.add(out_record)
        db.commit()
        db.refresh(out_record)
        
        return {"output_files": [out_record.stored_reference]}
