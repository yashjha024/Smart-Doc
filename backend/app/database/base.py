"""Imports every SQLAlchemy model so metadata creation sees all tables."""

from app.models.compression_job import CompressionJob
from app.models.detected_identifier import DetectedIdentifier
from app.models.document import Document
from app.models.ocr_result import OcrResult
from app.models.rename_history import RenameHistory
from app.models.file_record import FileRecord
from app.models.processing_job import ProcessingJob

__all__ = [
    "CompressionJob",
    "DetectedIdentifier",
    "Document",
    "OcrResult",
    "RenameHistory",
    "FileRecord",
    "ProcessingJob",
]
