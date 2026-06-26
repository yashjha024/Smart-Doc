from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class IdentifierDetectionRequest(BaseModel):
    text: str = Field(min_length=1)


class IdentifierDetectionResult(BaseModel):
    label: str
    display_label: str
    value: str
    confidence: float = Field(ge=0, le=1)


class IdentifierDetectionResponse(BaseModel):
    identifiers: list[IdentifierDetectionResult]


class DetectedIdentifierRead(BaseModel):
    id: int
    document_id: int
    label: str
    display_label: str | None = None
    value: str
    confidence: float
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
