import io
import uuid
from typing import Dict, Any, Optional
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

class ImageCompressionHandler(BaseHandler):
    SUPPORTED_FORMATS = {"JPEG", "JPG", "PNG", "WEBP"}
    MAX_ITERATIONS = 6

    @classmethod
    def execute(cls, job_id: str, db: Session, **kwargs) -> Dict[str, Any]:
        job_service = JobService(db)
        job = job_service.get_job(job_id)
        
        if not job.input_files:
            raise ValueError("Image compression requires an input file.")
            
        config = job.configuration or {}
        quality = config.get("quality") # Optional
        target_size_kb = config.get("target_size_kb") # Optional
        
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
        if fmt in ("MPO", "JPG"):  # MPO is how Pillow reports many phone-camera JPEGs
            fmt = "JPEG"
        if fmt not in cls.SUPPORTED_FORMATS:
            raise ValueError(f"Unsupported image format: {fmt}")
            
        original_size = source_path.stat().st_size
        
        # Determine output format and settings
        out_fmt = fmt if fmt != "JPG" else "JPEG"
        
        target_met = None
        quality_used = None
        best_output_bytes = b""
        
        # Helper to encode and measure
        def _encode(q: Optional[int]) -> bytes:
            buf = io.BytesIO()
            save_kwargs = {}
            if out_fmt in ["JPEG", "WEBP"]:
                if q is not None:
                    save_kwargs["quality"] = q
            elif out_fmt == "PNG":
                save_kwargs["optimize"] = True
                if q is not None:
                    # PIL PNG compress_level is 0-9. Map quality (1-100) to 0-9 inversely
                    # High quality = low compression, Low quality = high compression
                    cl = int(9 - ((q - 1) / 99) * 9)
                    save_kwargs["compress_level"] = max(0, min(9, cl))
                    
            if out_fmt == "JPEG" and img.mode not in ("RGB", "L", "CMYK"):
                converted = img.convert("RGB")
                converted.save(buf, format="JPEG", **save_kwargs)
            else:
                img.save(buf, format=out_fmt, **save_kwargs)
            return buf.getvalue()

        if target_size_kb is not None:
            target_bytes = target_size_kb * 1024
            # Iterative search for JPEG and WEBP
            if out_fmt in ["JPEG", "WEBP"]:
                low_q = 10
                high_q = 95
                best_bytes = None
                
                # First try with high quality to see if it's already under
                test_bytes = _encode(high_q)
                if len(test_bytes) <= target_bytes:
                    best_bytes = test_bytes
                    quality_used = high_q
                    target_met = True
                else:
                    for _ in range(cls.MAX_ITERATIONS):
                        mid_q = (low_q + high_q) // 2
                        test_bytes = _encode(mid_q)
                        if len(test_bytes) <= target_bytes:
                            best_bytes = test_bytes
                            quality_used = mid_q
                            low_q = mid_q + 1 # Try to push quality higher while staying under target
                        else:
                            high_q = mid_q - 1
                            
                        if low_q > high_q:
                            break
                            
                if best_bytes is not None and len(best_bytes) <= target_bytes:
                    best_output_bytes = best_bytes
                    target_met = True
                else:
                    # Target could not be met even at low_q=10, fallback to lowest
                    best_output_bytes = _encode(10)
                    quality_used = 10
                    target_met = False
            else:
                # PNG does not support target size iteratively in the same way via PIL natively without resizing.
                # Just use max compression.
                best_output_bytes = _encode(1) # Quality 1 -> compress_level 9
                quality_used = 1
                target_met = len(best_output_bytes) <= target_bytes
        else:
            # Single encoding pass based on requested quality or default
            q = quality if quality is not None else 75
            best_output_bytes = _encode(q)
            quality_used = q

        # Never hand back a bigger file than the user uploaded (same format either way).
        if len(best_output_bytes) >= original_size:
            best_output_bytes = source_path.read_bytes()

        compressed_size = len(best_output_bytes)
        
        # If output is larger than input, just use the input if we don't strictly need a format change,
        # but here it's an explicit compression operation. We will still store the output, 
        # savings will be 0.
        savings_bytes = max(0, original_size - compressed_size)
        savings_percent = round((savings_bytes / original_size) * 100, 2) if original_size else 0.0
        
        source_stem = sanitize_filename(Path(record.original_filename).stem)
        ext = ".jpg" if out_fmt == "JPEG" else f".{out_fmt.lower()}"
        unique_suffix = uuid.uuid4().hex[:6]
        final_filename = f"{source_stem}_compressed_{unique_suffix}{ext}"
        
        output_ref = storage.put(best_output_bytes, final_filename)
        
        mime_type = f"image/{'jpeg' if out_fmt == 'JPEG' else out_fmt.lower()}"
        
        ttl = timedelta(minutes=settings.file_ttl_minutes)
        out_record = FileRecord(
            original_filename=final_filename,
            stored_reference=output_ref,
            mime_type=mime_type,
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
                "savings_bytes": savings_bytes,
                "savings_percent": savings_percent
            },
            "configuration": {
                "quality": quality,
                "target_size_kb": target_size_kb
            },
            "tool_specific": {
                "target_met": target_met,
                "quality_used": quality_used,
                "output_format": out_fmt
            }
        }
        
        return {
            "output_files": [out_record.stored_reference],
            "metadata": metadata
        }
