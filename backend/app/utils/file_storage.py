from pathlib import Path
from uuid import uuid4

from fastapi import UploadFile

from app.core.config import settings
from app.utils.filename import sanitize_filename


def save_upload(file: UploadFile) -> tuple[str, int]:
    settings.ensure_local_directories()

    original_name = sanitize_filename(file.filename or "upload")
    stored_filename = f"{uuid4().hex}_{original_name}"
    destination = settings.upload_dir / stored_filename

    size = 0
    with destination.open("wb") as output:
        while chunk := file.file.read(1024 * 1024):
            size += len(chunk)
            output.write(chunk)

    return stored_filename, size


def get_upload_path(stored_filename: str) -> Path:
    return settings.upload_dir / stored_filename


def get_output_path(output_filename: str) -> Path:
    settings.ensure_local_directories()
    return settings.output_dir / output_filename
