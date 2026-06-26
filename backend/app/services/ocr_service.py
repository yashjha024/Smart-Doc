import logging
import tempfile
from pathlib import Path
from typing import Any

from fastapi import HTTPException, status
from sqlalchemy import delete
from sqlalchemy.orm import Session

from app.models.detected_identifier import DetectedIdentifier
from app.models.ocr_result import OcrResult
from app.services.document_service import DocumentService
from app.services.identifier_service import IdentifierService
from app.utils.file_storage import get_upload_path

logger = logging.getLogger(__name__)

SUPPORTED_EXTENSIONS = {".pdf", ".jpg", ".jpeg", ".png"}
MIN_NATIVE_PDF_TEXT_CHARS = 25
PDF_RENDER_DPI = 220

_paddle_ocr: Any | None = None


class OcrService:
    def __init__(self, db: Session) -> None:
        self.db = db

    def extract_for_document(self, document_id: int) -> OcrResult:
        document = DocumentService(self.db).get_document(document_id)
        file_path = get_upload_path(document.stored_filename)

        extracted_text, engine = self.extract_text(file_path)
        if not extracted_text.strip():
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="No readable text could be extracted from this document.",
            )

        ocr_result = OcrResult(
            document_id=document.id,
            extracted_text=extracted_text,
            engine=engine,
        )
        detected_identifiers = [
            DetectedIdentifier(
                document_id=document.id,
                label=identifier.label,
                display_label=identifier.display_label,
                value=identifier.value,
                confidence=identifier.confidence,
            )
            for identifier in IdentifierService().detect(extracted_text)
        ]
        document.status = "ocr_complete"
        self.db.add(ocr_result)
        self.db.execute(delete(DetectedIdentifier).where(DetectedIdentifier.document_id == document.id))
        self.db.add_all(detected_identifiers)
        self.db.add(document)
        self.db.commit()
        self.db.refresh(ocr_result)
        return ocr_result

    def extract_text(self, file_path: Path) -> tuple[str, str]:
        self._validate_file(file_path)

        if file_path.suffix.lower() == ".pdf":
            return self._extract_pdf_text(file_path)

        text = self._extract_image_text(file_path)
        return text, "paddleocr"

    def _extract_pdf_text(self, file_path: Path) -> tuple[str, str]:
        fitz = self._load_pymupdf()

        try:
            with fitz.open(file_path) as document:
                page_text: list[str] = []
                engines_used: set[str] = set()

                with tempfile.TemporaryDirectory(prefix="docrename_ocr_") as temp_dir:
                    temp_path = Path(temp_dir)
                    for page_number, page in enumerate(document, start=1):
                        native_text = page.get_text("text").strip()
                        if len(native_text) >= MIN_NATIVE_PDF_TEXT_CHARS:
                            page_text.append(native_text)
                            engines_used.add("pymupdf")
                            continue

                        ocr_text = self._extract_pdf_page_with_ocr(page, page_number, temp_path)
                        if ocr_text:
                            page_text.append(ocr_text)
                            engines_used.add("paddleocr")
                        elif native_text:
                            page_text.append(native_text)
                            engines_used.add("pymupdf")

                return "\n\n".join(page_text).strip(), self._format_engine_name(engines_used)
        except HTTPException:
            raise
        except Exception as exc:
            logger.exception("PDF text extraction failed for %s", file_path)
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Unable to extract text from the PDF.",
            ) from exc

    def _extract_pdf_page_with_ocr(self, page: Any, page_number: int, temp_path: Path) -> str:
        image_path = temp_path / f"page_{page_number}.png"
        pixmap = page.get_pixmap(dpi=PDF_RENDER_DPI, alpha=False)
        pixmap.save(image_path)
        return self._extract_image_text(image_path)

    def _extract_image_text(self, image_path: Path) -> str:
        ocr = self._get_paddle_ocr()

        try:
            result = ocr.ocr(str(image_path), cls=True)
        except Exception as exc:
            logger.exception("PaddleOCR failed for %s", image_path)
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Unable to extract text with OCR.",
            ) from exc

        return self._flatten_paddle_result(result)

    def _flatten_paddle_result(self, result: Any) -> str:
        lines: list[str] = []

        for page in result or []:
            if not page:
                continue
            for item in page:
                parsed = self._parse_paddle_line(item)
                if parsed:
                    lines.append(parsed)

        return "\n".join(lines).strip()

    def _parse_paddle_line(self, item: Any) -> str | None:
        if not isinstance(item, (list, tuple)) or len(item) < 2:
            return None

        text_with_score = item[1]
        if (
            isinstance(text_with_score, (list, tuple))
            and len(text_with_score) >= 1
            and isinstance(text_with_score[0], str)
        ):
            return text_with_score[0].strip()

        return None

    def _validate_file(self, file_path: Path) -> None:
        if not file_path.exists():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Stored document file was not found.",
            )

        if file_path.suffix.lower() not in SUPPORTED_EXTENSIONS:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="OCR supports PDF, JPG, JPEG, and PNG files.",
            )

    def _format_engine_name(self, engines_used: set[str]) -> str:
        if engines_used == {"pymupdf", "paddleocr"}:
            return "pymupdf+paddleocr"
        if engines_used == {"pymupdf"}:
            return "pymupdf"
        if engines_used == {"paddleocr"}:
            return "paddleocr"
        return "none"

    def _load_pymupdf(self) -> Any:
        try:
            import fitz
        except ImportError as exc:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="PyMuPDF is not installed. Install backend requirements before running OCR.",
            ) from exc

        return fitz

    def _get_paddle_ocr(self) -> Any:
        global _paddle_ocr

        if _paddle_ocr is not None:
            return _paddle_ocr

        try:
            from paddleocr import PaddleOCR
        except ImportError as exc:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="PaddleOCR is not installed. Install backend requirements before running OCR.",
            ) from exc

        try:
            _paddle_ocr = PaddleOCR(use_angle_cls=True, lang="en", show_log=False)
        except Exception as exc:
            logger.exception("PaddleOCR initialization failed")
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="PaddleOCR could not be initialized.",
            ) from exc

        return _paddle_ocr
