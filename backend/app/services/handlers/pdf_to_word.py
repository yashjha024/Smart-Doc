import uuid
from typing import Any, Dict

from sqlalchemy.orm import Session

from app.services.handlers.base import BaseHandler
from app.services.handlers.common import load_input, stem_of, store_output
from app.services.job_service import JobService


class PdfToWordHandler(BaseHandler):
    """Converts a text-based PDF to an editable DOCX with pdf2docx."""

    MAX_PAGES = 100

    @classmethod
    def execute(cls, job_id: str, db: Session, **kwargs) -> Dict[str, Any]:
        import fitz
        from app.core.config import settings

        job = JobService(db).get_job(job_id)
        if not job.input_files:
            raise ValueError("Please add a PDF to convert.")
        record, path = load_input(db, job.input_files[0])

        try:
            with fitz.open(path) as doc:
                if doc.needs_pass:
                    raise ValueError("Password-protected PDFs can't be converted.")
                pages = len(doc)
                has_text = any(page.get_text().strip() for page in doc)
        except ValueError:
            raise
        except Exception:
            raise ValueError("This file could not be opened as a PDF.")
        if pages > cls.MAX_PAGES:
            raise ValueError(f"This PDF has {pages} pages; converting is limited to {cls.MAX_PAGES}. Split it first.")

        try:
            from pdf2docx import Converter
        except ImportError:
            raise ValueError("PDF to Word isn't installed on this server.")

        settings.temp_dir.mkdir(parents=True, exist_ok=True)
        out_path = settings.temp_dir / f"{uuid.uuid4().hex}.docx"
        try:
            converter = Converter(str(path))
            try:
                converter.convert(str(out_path))
            finally:
                converter.close()
            data = out_path.read_bytes()
        except ValueError:
            raise
        except Exception:
            raise ValueError("This PDF could not be converted. It may be damaged or use an unusual layout.")
        finally:
            if out_path.exists():
                out_path.unlink()

        ref = store_output(db, data, f"{stem_of(record)}.docx",
                           "application/vnd.openxmlformats-officedocument.wordprocessingml.document")
        return {
            "output_files": [ref],
            "metadata": {"tool_specific": {"output_format": "docx", "page_count": pages, "scanned": not has_text}},
        }
