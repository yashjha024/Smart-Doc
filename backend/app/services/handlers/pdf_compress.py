import shutil
import subprocess
import uuid
from typing import Dict, Any
from pathlib import Path
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from dataclasses import dataclass

from app.services.handlers.base import BaseHandler
from app.services.job_service import JobService
from app.services.storage import get_storage_provider
from app.models.file_record import FileRecord
from app.core.config import settings
from app.utils.filename import sanitize_filename

@dataclass(frozen=True)
class CompressionPreset:
    ghostscript_setting: str
    image_dpi: int
    jpeg_quality: int

class PdfCompressHandler(BaseHandler):
    PRESETS = {
        "low": CompressionPreset("/screen", 96, 45),
        "medium": CompressionPreset("/ebook", 150, 65),
        "high": CompressionPreset("/printer", 220, 82),
    }

    @classmethod
    def execute(cls, job_id: str, db: Session, **kwargs) -> Dict[str, Any]:
        job_service = JobService(db)
        job = job_service.get_job(job_id)
        
        if not job.input_files:
            raise ValueError("PDF compression requires an input file.")
            
        config = job.configuration or {}
        mode = config.get("mode", "medium")
        if mode not in cls.PRESETS:
            mode = "medium"
            
        preset = cls.PRESETS[mode]
        
        storage = get_storage_provider()
        input_ref = job.input_files[0]
        
        record = db.query(FileRecord).filter(FileRecord.stored_reference == input_ref).first()
        if not record:
            raise ValueError("Input file record not found.")
            
        source_path = storage.get_local_path(input_ref)
        if not source_path.exists():
            raise ValueError("Source file missing from storage.")
            
        original_size = source_path.stat().st_size
        if original_size == 0:
            raise ValueError("Source file is empty.")
            
        gs_path = cls._find_ghostscript()
        if not gs_path:
            raise ValueError("Ghostscript executable was not found.")
            
        temp_dir = settings.temp_dir
        temp_dir.mkdir(parents=True, exist_ok=True)
        
        unique_suffix = uuid.uuid4().hex[:8]
        source_stem = sanitize_filename(Path(record.original_filename).stem)
        temp_output_path = temp_dir / f"{source_stem}_{mode}_{unique_suffix}.pdf"
        
        # Run ghostscript
        command = [
            gs_path,
            "-sDEVICE=pdfwrite",
            "-dCompatibilityLevel=1.6",
            f"-dPDFSETTINGS={preset.ghostscript_setting}",
            "-dNOPAUSE",
            "-dQUIET",
            "-dBATCH",
            "-dDetectDuplicateImages=true",
            "-dCompressFonts=true",
            "-dSubsetFonts=true",
            "-dDownsampleColorImages=true",
            f"-dColorImageResolution={preset.image_dpi}",
            "-dAutoFilterColorImages=false",
            "-dColorImageFilter=/DCTEncode",
            f"-dJPEGQ={preset.jpeg_quality}",
            "-dDownsampleGrayImages=true",
            f"-dGrayImageResolution={preset.image_dpi}",
            "-dDownsampleMonoImages=true",
            f"-dMonoImageResolution={preset.image_dpi}",
            f"-sOutputFile={temp_output_path}",
            str(source_path),
        ]
        
        try:
            completed = subprocess.run(command, capture_output=True, text=True, timeout=180, check=False)
            if completed.returncode != 0:
                raise RuntimeError(f"Ghostscript compression failed. {completed.stderr}")
                
            if not temp_output_path.exists() or temp_output_path.stat().st_size == 0:
                raise RuntimeError("Ghostscript produced an empty or missing output file.")
                
            compressed_size = temp_output_path.stat().st_size
            
            with open(temp_output_path, "rb") as f:
                output_bytes = f.read()
                
            # Clean up temp
            temp_output_path.unlink()
            
        except subprocess.TimeoutExpired:
            raise RuntimeError("Ghostscript compression timed out.")
        except Exception as exc:
            if temp_output_path.exists():
                temp_output_path.unlink()
            raise RuntimeError(f"Compression error: {str(exc)}")

        # Calculate metrics
        saved_bytes = max(original_size - compressed_size, 0)
        savings_percent = round((saved_bytes / original_size) * 100, 2) if original_size else 0.0
        
        # Save output
        final_filename = f"{source_stem}_compressed.pdf"
        output_ref = storage.put(output_bytes, final_filename)
        
        ttl = timedelta(minutes=settings.file_ttl_minutes)
        out_record = FileRecord(
            original_filename=final_filename,
            stored_reference=output_ref,
            mime_type="application/pdf",
            size_bytes=compressed_size,
            expires_at=datetime.utcnow() + ttl
        )
        db.add(out_record)
        db.commit()
        db.refresh(out_record)
        
        metadata = {
            "metrics": {
                "original_size_bytes": original_size,
                "compressed_size_bytes": compressed_size,
                "savings_bytes": saved_bytes,
                "savings_percent": savings_percent
            },
            "configuration": {
                "mode": mode
            },
            "tool_specific": {
                "preset": mode,
                "backend": "ghostscript"
            }
        }
        
        return {
            "output_files": [out_record.stored_reference],
            "metadata": metadata
        }

    @staticmethod
    def _find_ghostscript() -> str | None:
        for executable in ("gswin64c", "gswin32c", "gs"):
            path = shutil.which(executable)
            if path:
                return path
        return None
