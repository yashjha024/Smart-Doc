from datetime import datetime
from typing import Optional, Any, Dict
from pydantic import BaseModel

class JobCreate(BaseModel):
    tool_id: str
    input_files: list[str] = []
    configuration: Optional[Dict[str, Any]] = None

class JobResponse(BaseModel):
    id: str
    tool_id: str
    status: str
    input_files: list[str] = []
    output_files: list[str] = []
    configuration: Optional[Dict[str, Any]] = None
    result_metadata: Optional[Dict[str, Any]] = None
    error_information: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    completed_at: Optional[datetime] = None
    expires_at: Optional[datetime] = None

    model_config = {"from_attributes": True}
