from datetime import datetime

from pydantic import BaseModel, ConfigDict


class DocumentRead(BaseModel):
    id: int
    original_filename: str
    stored_filename: str
    content_type: str
    file_size_bytes: int
    status: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
