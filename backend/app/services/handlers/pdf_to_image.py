import io
import uuid
import zipfile
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any, Dict

import fitz  # PyMuPDF
from PIL import Image
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.file_record import FileRecord
from app.services.handlers.base import BaseHandler
from app.services.job_service import JobService
from app.services.storage import get_storage_provider
from app.utils.filename import sanitize_filename

FORMATS = {
    # format -> (PIL format, extension, mime type)
    "jpg": ("JPEG", "jpg", "image/jpeg"),
    "png": ("PNG", "png", "image/png"),
    "webp": ("WEBP", "webp", "image/webp"),
}
MIN_DPI, MAX_DPI, DEFAULT_DPI = 72, 300, 150


class PdfToImageHandler(BaseHandler):
    @classmethod
    def execute(cls, job_id: str, db: Session, **kwargs) -> Dict[str, Any]:
        job = JobService(db).get_job(job_id)
        if not job.input_files:
            raise ValueError("Please add a PDF to convert.")

        config = job.configuration or {}
        img_format = str(config.get("format") or config.get("target_format") or "jpg").lower()
        if img_format == "jpeg":
            img_format = "jpg"
        if img_format not in FORMATS:
            raise ValueError(f"Unsupported image format: {img_format}")
        pil_format, ext, mime = FORMATS[img_format]

        try:
            dpi = int(config.get("dpi", DEFAULT_DPI))
        except (TypeError, ValueError):
            dpi = DEFAULT_DPI
        dpi = max(MIN_DPI, min(MAX_DPI, dpi))

        input_record = db.query(FileRecord).filter(FileRecord.stored_reference == job.input_files[0]).first()
        if not input_record:
            raise ValueError("Input file not found. It may have expired.")

        storage = get_storage_provider()
        source_path = storage.get_local_path(input_record.stored_reference)
        source_stem = sanitize_filename(Path(input_record.original_filename).stem)
        out_base = f"{source_stem}_{uuid.uuid4().hex[:6]}"

        try:
            doc = fitz.open(source_path)
        except Exception:
            raise ValueError("This file could not be opened as a PDF.")

        with doc:
            if len(doc) == 0:
                raise ValueError("This PDF has no pages.")

            def render(page_index: int) -> bytes:
                pix = doc.load_page(page_index).get_pixmap(dpi=dpi, alpha=False)
                image = Image.frombytes("RGB", (pix.width, pix.height), pix.samples)
                buf = io.BytesIO()
                save_kwargs = {"quality": 90} if pil_format in ("JPEG", "WEBP") else {"optimize": True}
                image.save(buf, format=pil_format, **save_kwargs)
                return buf.getvalue()

            page_count = len(doc)
            if page_count == 1:
                output_bytes = render(0)
                final_filename = f"{out_base}.{ext}"
                mime_type = mime
                output_ext = ext
            else:
                buf = io.BytesIO()
                with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
                    for i in range(page_count):
                        zf.writestr(f"{source_stem}_page_{i + 1}.{ext}", render(i))
                output_bytes = buf.getvalue()
                final_filename = f"{out_base}.zip"
                mime_type = "application/zip"
                output_ext = "zip"

        output_ref = storage.put(output_bytes, final_filename)
        out_record = FileRecord(
            original_filename=final_filename,
            stored_reference=output_ref,
            mime_type=mime_type,
            size_bytes=len(output_bytes),
            expires_at=datetime.utcnow() + timedelta(minutes=settings.file_ttl_minutes),
        )
        db.add(out_record)
        db.commit()

        return {
            "output_files": [out_record.stored_reference],
            "metadata": {
                "configuration": {"format": img_format, "dpi": dpi},
                "tool_specific": {"output_format": output_ext, "page_count": page_count},
            },
        }
