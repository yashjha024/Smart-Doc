from enum import StrEnum

from pydantic import BaseModel, Field


class CompressionMode(StrEnum):
    low = "low"
    medium = "medium"
    high = "high"
    target_size = "target_size"


class CompressionRequest(BaseModel):
    document_id: int
    mode: CompressionMode
    target_size_kb: int | None = Field(default=None, gt=0)


class CompressionResult(BaseModel):
    job_id: int
    document_id: int
    mode: CompressionMode
    original_size_bytes: int
    original_size_kb: float
    compressed_size_bytes: int
    compressed_size_kb: float
    saved_bytes: int
    savings_percent: float
    compression_ratio: float
    target_size_kb: int | None = None
    target_met: bool | None = None
    output_filename: str
    compression_backend: str
    quality_label: str
    message: str
