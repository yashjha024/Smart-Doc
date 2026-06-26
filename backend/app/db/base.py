"""Compatibility wrapper for app.database.base."""

from app.database.base import (
    CompressionJob,
    DetectedIdentifier,
    Document,
    OcrResult,
    RenameHistory,
)

__all__ = [
    "CompressionJob",
    "DetectedIdentifier",
    "Document",
    "OcrResult",
    "RenameHistory",
]
