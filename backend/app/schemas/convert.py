from pydantic import BaseModel

class ConvertRequest(BaseModel):
    document_id: int
    target_format: str

class ConvertResult(BaseModel):
    document_id: int
    output_filename: str
    message: str
