import os
import zipfile
from pathlib import Path
import fitz  # PyMuPDF
from typing import Dict, Any
from sqlalchemy.orm import Session
from datetime import datetime, timedelta

from app.services.handlers.base import BaseHandler
from app.services.job_service import JobService
from app.services.storage import get_storage_provider
from app.models.file_record import FileRecord
from app.core.config import settings
from app.utils.filename import sanitize_filename

class PdfToImageHandler(BaseHandler):
    @classmethod
    def execute(cls, job_id: str, db: Session, **kwargs) -> Dict[str, Any]:
        job_service = JobService(db)
        job = job_service.get_job(job_id)
        
        if not job.input_files:
            raise ValueError("Input file reference is required for PDF to Image conversion")
            
        config = job.configuration or {}
        img_format = config.get("target_format", "jpg").lower()
        
        if img_format not in ["jpg", "png"]:
            raise ValueError(f"Unsupported image format: {img_format}")
            
        # Get input file record
        input_record = db.query(FileRecord).filter(FileRecord.stored_reference == job.input_files[0]).first()
        if not input_record:
            raise ValueError("Input file record not found")
            
        storage = get_storage_provider()
        source_path = storage.get_local_path(input_record.stored_reference)
        
        source_stem = sanitize_filename(Path(input_record.original_filename).stem)
        doc = fitz.open(source_path)
        
        output_ext = "zip" if len(doc) > 1 else img_format
        mime_type = "application/zip" if output_ext == "zip" else f"image/{'jpeg' if img_format == 'jpg' else 'png'}"
        
        # We will write the output to a temporary local path before putting it in storage
        temp_dir = settings.temp_dir
        temp_dir.mkdir(parents=True, exist_ok=True)
        
        # Determine unique filename for output
        import uuid
        unique_suffix = uuid.uuid4().hex[:6]
        out_filename_base = f"{source_stem}_{unique_suffix}"
        
        output_bytes = b""
        
        if len(doc) == 1:
            page = doc.load_page(0)
            pix = page.get_pixmap(dpi=200)
            output_bytes = pix.tobytes(img_format)
            final_filename = f"{out_filename_base}.{output_ext}"
        else:
            temp_zip_path = temp_dir / f"{out_filename_base}.zip"
            with zipfile.ZipFile(temp_zip_path, 'w') as zf:
                for page_num in range(len(doc)):
                    page = doc.load_page(page_num)
                    pix = page.get_pixmap(dpi=200)
                    img_bytes = pix.tobytes(img_format)
                    zf.writestr(f"{source_stem}_page_{page_num+1}.{img_format}", img_bytes)
            
            with open(temp_zip_path, "rb") as f:
                output_bytes = f.read()
            temp_zip_path.unlink()
            final_filename = f"{out_filename_base}.zip"
            
        # Put into storage
        output_ref = storage.put(output_bytes, final_filename)
        
        # Create output file record
        ttl = timedelta(minutes=settings.file_ttl_minutes)
        out_record = FileRecord(
            original_filename=final_filename,
            stored_reference=output_ref,
            mime_type=mime_type,
            size_bytes=len(output_bytes),
            expires_at=datetime.utcnow() + ttl
        )
        db.add(out_record)
        db.commit()
        db.refresh(out_record)
        
        return {
            "output_files": [out_record.stored_reference],
            "metadata": {
                "tool_specific": {
                    "output_format": output_ext
                }
            }
        }
