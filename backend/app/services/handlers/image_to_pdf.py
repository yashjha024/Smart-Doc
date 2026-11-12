import io
import uuid
from typing import Any, Dict

import fitz  # PyMuPDF
from sqlalchemy.orm import Session

from app.services.handlers.base import BaseHandler
from app.services.handlers.common import load_input, open_image, stem_of, store_output
from app.services.job_service import JobService

A4 = fitz.paper_rect("a4")  # 595 x 842 pt
MARGIN = 36  # 0.5 inch
MAX_IMAGES = 200


class ImageToPdfHandler(BaseHandler):
    """Combines images (in upload order) into one PDF, one image per page.
    page_size: "fit" (page matches each image) or "a4" (image centred on A4 with a margin)."""

    @classmethod
    def execute(cls, job_id: str, db: Session, **kwargs) -> Dict[str, Any]:
        job = JobService(db).get_job(job_id)
        if not job.input_files:
            raise ValueError("Please add at least one image.")
        if len(job.input_files) > MAX_IMAGES:
            raise ValueError(f"You can combine up to {MAX_IMAGES} images at once.")
        page_size = (job.configuration or {}).get("page_size", "fit")

        doc = fitz.open()
        try:
            for ref in job.input_files:
                record, path = load_input(db, ref)
                img = open_image(path)
                if img.mode not in ("RGB", "L"):
                    img = img.convert("RGB")
                buf = io.BytesIO()
                # JPEG keeps photos small; PNG keeps flat graphics crisp.
                if (record.mime_type or "").endswith("png") or img.mode == "L":
                    img.save(buf, format="PNG", optimize=True)
                else:
                    img.save(buf, format="JPEG", quality=92)

                w, h = img.size  # treat pixels as points (72 dpi)
                if page_size == "a4":
                    page_rect = A4 if h >= w else fitz.Rect(0, 0, A4.height, A4.width)
                    page = doc.new_page(width=page_rect.width, height=page_rect.height)
                    box = fitz.Rect(MARGIN, MARGIN, page_rect.width - MARGIN, page_rect.height - MARGIN)
                    page.insert_image(box, stream=buf.getvalue(), keep_proportion=True)
                else:
                    page = doc.new_page(width=w, height=h)
                    page.insert_image(page.rect, stream=buf.getvalue())

            data = doc.tobytes(garbage=3, deflate=True)
            page_count = len(doc)
        finally:
            doc.close()

        name = f"{stem_of(record)}.pdf" if page_count == 1 else f"images_{uuid.uuid4().hex[:6]}.pdf"
        ref = store_output(db, data, name, "application/pdf")
        return {
            "output_files": [ref],
            "metadata": {"configuration": {"page_size": page_size}, "tool_specific": {"output_format": "pdf", "page_count": page_count}},
        }
