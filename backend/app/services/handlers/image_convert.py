import io
import uuid
from typing import Dict, Any
from pathlib import Path
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from PIL import Image, UnidentifiedImageError

from app.services.handlers.base import BaseHandler
from app.services.job_service import JobService
from app.services.storage import get_storage_provider
from app.models.file_record import FileRecord
from app.core.config import settings
from app.utils.filename import sanitize_filename

class ImageConversionHandler(BaseHandler):
    # Supported input formats map to their PIL format strings
    # MPO is how Pillow reports many phone-camera JPEGs.
    SUPPORTED_INPUT_FORMATS = {"JPEG", "JPG", "MPO", "PNG", "WEBP", "GIF", "BMP", "TIFF"}
    # Supported output formats map to their PIL format strings
    SUPPORTED_OUTPUT_FORMATS = {"JPEG", "JPG", "PNG", "WEBP"}

    @classmethod
    def execute(cls, job_id: str, db: Session, **kwargs) -> Dict[str, Any]:
        job_service = JobService(db)
        job = job_service.get_job(job_id)
        
        if not job.input_files:
            raise ValueError("Image conversion requires an input file.")
            
        config = job.configuration or {}
        target_format_raw = config.get("target_format", "").upper()
        
        if target_format_raw not in cls.SUPPORTED_OUTPUT_FORMATS:
            raise ValueError(f"Unsupported target format: {target_format_raw}")
            
        # Normalize JPG to JPEG for PIL
        target_format = "JPEG" if target_format_raw == "JPG" else target_format_raw
        
        storage = get_storage_provider()
        input_ref = job.input_files[0]
        
        record = db.query(FileRecord).filter(FileRecord.stored_reference == input_ref).first()
        if not record:
            raise ValueError("Input file record not found.")
            
        source_path = storage.get_local_path(input_ref)
        if not source_path.exists():
            raise ValueError("Source file missing from storage.")
            
        try:
            img = Image.open(source_path)
            img.load()
        except Image.DecompressionBombError:
            raise ValueError("This image is too large to process (over 100 megapixels).")
        except UnidentifiedImageError:
            raise ValueError("Invalid or corrupted image file.")
        except Exception:
            raise ValueError("This image could not be read. It may be damaged.")
            
        fmt = (img.format or "").upper()
        if fmt in ("MPO", "JPG"):
            fmt = "JPEG"
        if fmt not in cls.SUPPORTED_INPUT_FORMATS:
            raise ValueError(f"Unsupported input image format: {fmt}")
            
        if fmt == target_format:
            raise ValueError(f"Image is already in {target_format} format.")
            
        # Handle transparency if converting to JPEG
        if target_format == "JPEG" and img.mode in ("RGBA", "LA", "P"):
            # Create a solid white background
            background = Image.new('RGB', img.size, (255, 255, 255))
            # If the image has an alpha channel, paste it using itself as the mask
            if img.mode in ("RGBA", "LA"):
                background.paste(img, mask=img.split()[-1])
            else:
                background.paste(img)
            img = background
        elif img.mode != "RGB" and target_format == "JPEG":
            img = img.convert("RGB")
        elif img.mode not in ("RGB", "RGBA", "L", "LA", "P"):
            # e.g. CMYK or 16-bit TIFFs, which PNG/WebP can't store directly
            img = img.convert("RGBA" if "A" in img.getbands() else "RGB")
            
        buf = io.BytesIO()
        img.save(buf, format=target_format)
        output_bytes = buf.getvalue()
        
        source_stem = sanitize_filename(Path(record.original_filename).stem)
        ext = ".jpg" if target_format == "JPEG" else f".{target_format.lower()}"
        unique_suffix = uuid.uuid4().hex[:6]
        final_filename = f"{source_stem}_{unique_suffix}{ext}"
        
        output_ref = storage.put(output_bytes, final_filename)
        
        mime_type = f"image/{'jpeg' if target_format == 'JPEG' else target_format.lower()}"
        
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
            "output_files": [out_record.stored_reference]
        }
