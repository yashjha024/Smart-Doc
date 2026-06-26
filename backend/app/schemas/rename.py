from pydantic import BaseModel, Field


class RenamePreviewRequest(BaseModel):
    template: str = Field(min_length=1, examples=["BANK_{account_number}"])
    values: dict[str, str]
    prefix: str = ""
    suffix: str = ""
    extension: str = ".pdf"


class RenamePreviewResponse(BaseModel):
    filename: str
    is_valid: bool
    warnings: list[str] = Field(default_factory=list)


class RenameRequest(BaseModel):
    document_id: int
    template: str
    values: dict[str, str]
    prefix: str = ""
    suffix: str = ""


class RenameResult(BaseModel):
    document_id: int
    filename: str
    previous_filename: str | None = None
    history_id: int | None = None
    message: str
