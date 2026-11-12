import glob
import io
import logging
import os
import shutil
import subprocess
import uuid
from dataclasses import dataclass
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

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class CompressionPreset:
    ghostscript_setting: str
    image_dpi: int
    jpeg_quality: int


class PdfCompressHandler(BaseHandler):
    # Matches the UI: low = "Light / Best quality", high = "Maximum / Smallest size".
    PRESETS = {
        "low": CompressionPreset("/printer", 220, 82),
        "medium": CompressionPreset("/ebook", 150, 65),
        "high": CompressionPreset("/screen", 96, 45),
    }

    @classmethod
    def execute(cls, job_id: str, db: Session, **kwargs) -> Dict[str, Any]:
        job = JobService(db).get_job(job_id)
        if not job.input_files:
            raise ValueError("Please add a PDF to compress.")

        config = job.configuration or {}
        mode = config.get("mode", "medium")
        if mode not in cls.PRESETS:
            mode = "medium"
        preset = cls.PRESETS[mode]

        storage = get_storage_provider()
        input_ref = job.input_files[0]
        record = db.query(FileRecord).filter(FileRecord.stored_reference == input_ref).first()
        if not record:
            raise ValueError("Input file not found. It may have expired.")

        source_path = storage.get_local_path(input_ref)
        if not source_path.exists():
            raise ValueError("Input file not found. It may have expired.")

        original_size = source_path.stat().st_size
        if original_size == 0:
            raise ValueError("The uploaded file is empty.")

        source_stem = sanitize_filename(Path(record.original_filename).stem)

        gs_path = cls._find_ghostscript()
        if gs_path:
            output_bytes = cls._compress_with_ghostscript(gs_path, source_path, source_stem, mode, preset)
            backend = "ghostscript"
        else:
            output_bytes = cls._compress_with_pymupdf(source_path, preset)
            backend = "pymupdf"

        # Never hand back a bigger file than the user uploaded.
        if len(output_bytes) >= original_size:
            output_bytes = source_path.read_bytes()

        compressed_size = len(output_bytes)
        saved_bytes = max(original_size - compressed_size, 0)
        savings_percent = round((saved_bytes / original_size) * 100, 2) if original_size else 0.0

        final_filename = f"{source_stem}_compressed.pdf"
        output_ref = storage.put(output_bytes, final_filename)
        out_record = FileRecord(
            original_filename=final_filename,
            stored_reference=output_ref,
            mime_type="application/pdf",
            size_bytes=compressed_size,
            expires_at=datetime.utcnow() + timedelta(minutes=settings.file_ttl_minutes),
        )
        db.add(out_record)
        db.commit()

        return {
            "output_files": [out_record.stored_reference],
            "metadata": {
                "metrics": {
                    "original_size_bytes": original_size,
                    "compressed_size_bytes": compressed_size,
                    "savings_bytes": saved_bytes,
                    "savings_percent": savings_percent,
                },
                "configuration": {"mode": mode},
                "tool_specific": {"preset": mode, "backend": backend, "output_format": "pdf"},
            },
        }

    @classmethod
    def _compress_with_ghostscript(cls, gs_path: str, source_path: Path, stem: str, mode: str, preset: CompressionPreset) -> bytes:
        temp_dir = settings.temp_dir
        temp_dir.mkdir(parents=True, exist_ok=True)
        temp_output_path = temp_dir / f"{stem}_{mode}_{uuid.uuid4().hex[:8]}.pdf"

        command = [
            gs_path,
            "-dSAFER",
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
            if completed.returncode != 0 or not temp_output_path.exists() or temp_output_path.stat().st_size == 0:
                logger.error("Ghostscript failed (%s): %s", completed.returncode, completed.stderr)
                raise ValueError("This PDF could not be compressed. It may be damaged or password-protected.")
            return temp_output_path.read_bytes()
        except subprocess.TimeoutExpired:
            raise ValueError("Compression took too long. Try a smaller PDF.")
        finally:
            if temp_output_path.exists():
                temp_output_path.unlink()

    @classmethod
    def _compress_with_pymupdf(cls, source_path: Path, preset: CompressionPreset) -> bytes:
        """Fallback when Ghostscript is not installed: recompress large images, then rewrite the PDF."""
        try:
            doc = fitz.open(source_path)
        except Exception:
            raise ValueError("This file could not be opened as a PDF.")

        with doc:
            if doc.needs_pass:
                raise ValueError("Password-protected PDFs can't be compressed.")

            done: set[int] = set()
            for page in doc:
                page_rect = page.rect
                for img in page.get_images(full=True):
                    xref, smask = img[0], img[1]
                    if xref in done or smask:  # skip images with transparency masks
                        continue
                    done.add(xref)
                    try:
                        cls._recompress_image(doc, page, xref, page_rect, preset)
                    except Exception:
                        logger.debug("Skipping image xref %s", xref, exc_info=True)

            try:
                doc.subset_fonts()
            except Exception:
                logger.debug("Font subsetting skipped", exc_info=True)

            return doc.tobytes(garbage=4, deflate=True, deflate_images=True, deflate_fonts=True, clean=True)

    @staticmethod
    def _recompress_image(doc: "fitz.Document", page: "fitz.Page", xref: int, page_rect: "fitz.Rect", preset: CompressionPreset) -> None:
        info = doc.extract_image(xref)
        if not info or not info.get("image"):
            return
        original = info["image"]
        image = Image.open(io.BytesIO(original))
        if image.mode not in ("RGB", "L"):
            image = image.convert("RGB")

        # Target pixel size: the page size (in inches) times the preset DPI. Use the
        # largest on-page placement so shared images are never undersized.
        rects = page.get_image_rects(xref)
        if rects:
            w_in = max(r.width for r in rects) / 72
            h_in = max(r.height for r in rects) / 72
        else:
            w_in, h_in = page_rect.width / 72, page_rect.height / 72
        max_w = max(1, int(w_in * preset.image_dpi))
        max_h = max(1, int(h_in * preset.image_dpi))
        if image.width > max_w or image.height > max_h:
            image.thumbnail((max_w, max_h), Image.LANCZOS)

        buf = io.BytesIO()
        image.save(buf, format="JPEG", quality=preset.jpeg_quality, optimize=True)
        new_bytes = buf.getvalue()
        if len(new_bytes) < len(original) * 0.9:
            page.replace_image(xref, stream=new_bytes)

    @staticmethod
    def _find_ghostscript() -> str | None:
        configured = os.environ.get("GHOSTSCRIPT_PATH")
        if configured and Path(configured).exists():
            return configured
        for executable in ("gswin64c", "gswin32c", "gs"):
            path = shutil.which(executable)
            if path:
                return path
        # The Windows installer does not add Ghostscript to PATH.
        for root in (os.environ.get("ProgramFiles", r"C:\Program Files"), os.environ.get("ProgramFiles(x86)", r"C:\Program Files (x86)")):
            matches = sorted(glob.glob(os.path.join(root, "gs", "gs*", "bin", "gswin*c.exe")), reverse=True)
            if matches:
                return matches[0]
        return None
