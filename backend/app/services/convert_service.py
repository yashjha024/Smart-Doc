import logging
import tempfile
import zipfile
from pathlib import Path
from uuid import uuid4

import fitz  # PyMuPDF
from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.document import Document
from app.services.document_service import DocumentService
from app.utils.file_storage import get_output_path, get_upload_path

logger = logging.getLogger(__name__)
from app.utils.filename import sanitize_filename

class ConvertService:
    def __init__(self, db: Session):
        self.db = db

    def convert_document(self, document_id: int, target_format: str) -> str:
        document = DocumentService(self.db).get_document(document_id)
        source_path = get_upload_path(document.stored_filename)
        
        if not source_path.exists():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Stored document file was not found."
            )

        source_ext = source_path.suffix.lower()
        target_format = target_format.lower()

        # PDF to Images (ZIP)
        if source_ext == ".pdf" and target_format in ["jpg", "png"]:
            output = self._convert_pdf_to_images(source_path, document.stored_filename, target_format)
            self._mark_converted(document)
            return output
        
        # Images to PDF
        if source_ext in [".jpg", ".jpeg", ".png"] and target_format == "pdf":
            output = self._convert_image_to_pdf(source_path, document.stored_filename)
            self._mark_converted(document)
            return output

        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Conversion from {source_ext} to {target_format} is not supported."
        )

    def _mark_converted(self, document: Document):
        document.status = "converted"
        self.db.add(document)
        self.db.commit()

    def _convert_pdf_to_images(self, source_path: Path, stored_filename: str, img_format: str) -> str:
        source_stem = sanitize_filename(Path(stored_filename).stem)
        
        try:
            doc = fitz.open(source_path)
            if len(doc) == 1:
                # Single page PDF -> just return the image
                page = doc.load_page(0)
                pix = page.get_pixmap(dpi=200)
                out_filename = f"{source_stem}_{uuid4().hex[:6]}.{img_format}"
                out_path = get_output_path(out_filename)
                pix.save(str(out_path))
                return out_filename
            else:
                # Multi-page PDF -> ZIP of images
                zip_filename = f"{source_stem}_{uuid4().hex[:6]}.zip"
                zip_path = get_output_path(zip_filename)
                
                with zipfile.ZipFile(zip_path, 'w') as zf:
                    for page_num in range(len(doc)):
                        page = doc.load_page(page_num)
                        pix = page.get_pixmap(dpi=200)
                        img_bytes = pix.tobytes(img_format)
                        zf.writestr(f"{source_stem}_page_{page_num+1}.{img_format}", img_bytes)
                return zip_filename

        except Exception:
            logger.exception("PDF to image conversion failed")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to convert PDF to {img_format.upper()}."
            )

    def _convert_image_to_pdf(self, source_path: Path, stored_filename: str) -> str:
        source_stem = sanitize_filename(Path(stored_filename).stem)
        out_filename = f"{source_stem}_{uuid4().hex[:6]}.pdf"
        out_path = get_output_path(out_filename)
        
        try:
            doc = fitz.open()
            # Open image as a PDF page
            img_doc = fitz.open(source_path)
            pdf_bytes = img_doc.convert_to_pdf()
            img_pdf = fitz.open("pdf", pdf_bytes)
            
            doc.insert_pdf(img_pdf)
            doc.save(str(out_path))
            return out_filename
            
        except Exception:
            logger.exception("Image to PDF conversion failed")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to convert image to PDF."
            )
