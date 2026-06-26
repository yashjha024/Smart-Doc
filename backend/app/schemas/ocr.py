from datetime import datetime

from pydantic import BaseModel, ConfigDict


class OcrResultRead(BaseModel):
    id: int
    document_id: int
    extracted_text: str
    engine: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
