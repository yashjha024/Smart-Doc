import zipfile
from pathlib import Path
import fitz  # PyMuPDF
from typing import Dict, Any, List
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
import uuid

from app.services.handlers.base import BaseHandler
from app.services.job_service import JobService
from app.services.storage import get_storage_provider
from app.models.file_record import FileRecord
from app.core.config import settings
from app.utils.filename import sanitize_filename

class PdfSplitHandler(BaseHandler):
    @classmethod
    def execute(cls, job_id: str, db: Session, **kwargs) -> Dict[str, Any]:
        job_service = JobService(db)
        job = job_service.get_job(job_id)
        
        if not job.input_files:
            raise ValueError("Split requires an input PDF file.")
            
        config = job.configuration or {}
        ranges_str_list = config.get("ranges", [])
        if not ranges_str_list:
            raise ValueError("No page ranges provided for splitting.")
            
        mode = config.get("mode", "extract").lower()
        if mode not in ["extract", "split"]:
            raise ValueError("Mode must be 'extract' or 'split'.")
            
        storage = get_storage_provider()
        
        input_ref = job.input_files[0]
        record = db.query(FileRecord).filter(FileRecord.stored_reference == input_ref).first()
        if not record or not record.original_filename.lower().endswith(".pdf"):
            raise ValueError("Input file is not a valid PDF.")
            
        source_path = storage.get_local_path(record.stored_reference)
        source_stem = sanitize_filename(Path(record.original_filename).stem)
        
        # Parse ranges
        parsed_ranges = []
        with fitz.open(source_path) as doc:
            max_page = len(doc)
            
            for r in ranges_str_list:
                pages = cls._parse_range(r, max_page)
                if not pages:
                    raise ValueError(f"Invalid or empty range: {r}")
                parsed_ranges.append(pages)
                
            unique_suffix = uuid.uuid4().hex[:6]
            
            if mode == "extract":
                # Flatten all pages into one list and deduplicate/sort if desired, but 
                # we should probably just preserve exact user sequence.
                flat_pages = []
                for p_list in parsed_ranges:
                    flat_pages.extend(p_list)
                    
                if not flat_pages:
                    raise ValueError("Selection resulted in no pages.")
                    
                new_doc = fitz.open()
                for p in flat_pages:
                    new_doc.insert_pdf(doc, from_page=p, to_page=p)
                
                output_bytes = new_doc.tobytes()
                new_doc.close()
                
                final_filename = f"{source_stem}_extracted_{unique_suffix}.pdf"
                mime_type = "application/pdf"
            else:
                # split mode - generate a ZIP of individual PDFs
                temp_dir = settings.temp_dir
                temp_dir.mkdir(parents=True, exist_ok=True)
                temp_zip_path = temp_dir / f"{source_stem}_split_{unique_suffix}.zip"
                
                with zipfile.ZipFile(temp_zip_path, 'w') as zf:
                    for i, (r_str, pages) in enumerate(zip(ranges_str_list, parsed_ranges)):
                        split_doc = fitz.open()
                        for p in pages:
                            split_doc.insert_pdf(doc, from_page=p, to_page=p)
                        
                        safe_r = r_str.replace(",", "_").replace(" ", "")
                        pdf_name = f"{source_stem}_parts_{safe_r}.pdf"
                        zf.writestr(pdf_name, split_doc.tobytes())
                        split_doc.close()
                
                with open(temp_zip_path, "rb") as f:
                    output_bytes = f.read()
                temp_zip_path.unlink()
                
                final_filename = f"{source_stem}_split_{unique_suffix}.zip"
                mime_type = "application/zip"
                
        # Save to storage
        output_ref = storage.put(output_bytes, final_filename)
        
        # Create file record
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
        
        return {"output_files": [out_record.stored_reference]}

    @staticmethod
    def _parse_range(r_str: str, max_page: int) -> List[int]:
        """Parse a string like '1-3' or '5' into a list of 0-indexed page integers."""
        r_str = str(r_str).strip()
        if not r_str:
            return []
            
        pages = []
        if "-" in r_str:
            parts = r_str.split("-")
            if len(parts) != 2:
                raise ValueError(f"Malformed range: {r_str}")
            try:
                start = int(parts[0].strip())
                end = int(parts[1].strip())
            except ValueError:
                raise ValueError(f"Non-numeric range: {r_str}")
                
            if start < 1 or end < 1 or start > end:
                raise ValueError(f"Invalid range boundaries: {r_str}")
            if end > max_page:
                raise ValueError(f"Range {r_str} exceeds document length ({max_page})")
                
            pages.extend(range(start - 1, end))
        else:
            try:
                p = int(r_str)
            except ValueError:
                raise ValueError(f"Non-numeric page: {r_str}")
            if p < 1 or p > max_page:
                raise ValueError(f"Page {r_str} out of bounds (1-{max_page})")
            pages.append(p - 1)
            
        return pages
