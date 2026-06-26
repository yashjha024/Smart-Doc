from pydantic import BaseModel


class ExportRequest(BaseModel):
    document_id: int
    save_location: str = "default"  # "default" or "download"


class ExportResult(BaseModel):
    document_id: int
    filename: str
    export_location: str
    message: str


class BulkRenameRequest(BaseModel):
    document_ids: list[int]
    template: str
    prefix: str = ""
    suffix: str = ""
    auto_save: bool = False  # Auto-save after rename


class BulkRenameItemResult(BaseModel):
    document_id: int
    original_filename: str | None = None
    status: str
    filename: str | None = None
    previous_filename: str | None = None
    message: str | None = None
    error: str | None = None
    detected_values: dict[str, str] | None = None


class BulkRenameResult(BaseModel):
    total: int
    successful: int
    failed: int
    results: list[BulkRenameItemResult]


class BulkExportRequest(BaseModel):
    document_ids: list[int]
    save_location: str = "default"


class BulkExportResult(BaseModel):
    total: int
    successful: int
    failed: int
    export_path: str
    message: str
