import mimetypes
from datetime import datetime, timedelta
from urllib.parse import quote

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from fastapi.responses import FileResponse, StreamingResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.config import settings
from app.database.session import get_db
from app.models.file_record import FileRecord
from app.routers.maintenance import maybe_cleanup
from app.services.blob_tokens import generate_client_token
from app.services.storage import REFERENCE_PATTERN, get_storage_provider
from app.utils.file_types import content_matches_extension

router = APIRouter()


def _limit_bytes() -> int:
    return settings.max_upload_mb * 1024 * 1024


def _not_real(filename: str) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail=f"{filename} doesn't look like a real {filename.rsplit('.', 1)[-1].upper()} file.",
    )


def _create_record(db: Session, filename: str, ref: str, size: int, mime: str | None) -> dict:
    record = FileRecord(
        original_filename=filename,
        stored_reference=ref,
        mime_type=mime or mimetypes.guess_type(filename)[0] or "application/octet-stream",
        size_bytes=size,
        storage_provider=get_storage_provider().name,
        expires_at=datetime.utcnow() + timedelta(minutes=settings.file_ttl_minutes),
    )
    db.add(record)
    db.commit()
    return {"file_id": ref, "original_filename": filename}


@router.get("/upload-config")
def upload_config():
    """Tells the frontend how to upload: straight to this API, or browser → Vercel Blob."""
    return {"mode": "blob" if settings.storage_backend == "blob" else "direct", "max_upload_mb": settings.max_upload_mb}


@router.post("/upload")
def upload_file(file: UploadFile = File(...), db: Session = Depends(get_db)):
    if not file.filename:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="A file name is required.")
    maybe_cleanup()

    # Read in chunks so an oversized upload is rejected without loading it all.
    limit = _limit_bytes()
    chunks, total = [], 0
    while chunk := file.file.read(1024 * 1024):
        total += len(chunk)
        if total > limit:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail=f"{file.filename} is larger than the {settings.max_upload_mb} MB limit.",
            )
        chunks.append(chunk)
    file_bytes = b"".join(chunks)

    if not file_bytes:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="The uploaded file is empty.")
    if not content_matches_extension(file.filename, file_bytes[:1024]):
        raise _not_real(file.filename)

    ref = get_storage_provider().put(file_bytes, file.filename)
    return _create_record(db, file.filename, ref, len(file_bytes), file.content_type)


# ─── Browser → Vercel Blob uploads ───────────────────────────────────────────

class BlobTokenRequest(BaseModel):
    type: str
    payload: dict


@router.post("/blob-token")
def blob_token(body: BlobTokenRequest):
    """`handleUploadUrl` for @vercel/blob/client upload(): returns a short-lived token
    that only allows uploading one new blob at the requested (validated) pathname."""
    if settings.storage_backend != "blob":
        raise HTTPException(status_code=404, detail="Blob uploads are not enabled.")
    if body.type != "blob.generate-client-token":
        raise HTTPException(status_code=400, detail="Unsupported event type.")
    pathname = str(body.payload.get("pathname", ""))
    if not REFERENCE_PATTERN.match(pathname):
        raise HTTPException(status_code=400, detail="Invalid upload name.")
    token = generate_client_token(settings.blob_read_write_token, pathname, maximum_size_in_bytes=_limit_bytes())
    return {"type": "blob.generate-client-token", "clientToken": token}


class RegisterRequest(BaseModel):
    pathname: str
    filename: str
    content_type: str | None = None


@router.post("/register")
def register_blob(body: RegisterRequest, db: Session = Depends(get_db)):
    """After the browser uploads to Blob, record the file so jobs can use it."""
    if settings.storage_backend != "blob":
        raise HTTPException(status_code=404, detail="Blob uploads are not enabled.")
    if not REFERENCE_PATTERN.match(body.pathname):
        raise HTTPException(status_code=400, detail="Invalid upload name.")
    if db.query(FileRecord).filter(FileRecord.stored_reference == body.pathname).first():
        raise HTTPException(status_code=409, detail="This upload is already registered.")
    maybe_cleanup()

    storage = get_storage_provider()
    size = storage.size(body.pathname)
    if size is None:
        raise HTTPException(status_code=404, detail="Upload not found. Please try again.")
    if size == 0 or size > _limit_bytes():
        storage.delete(body.pathname)
        raise HTTPException(status_code=413 if size else 400,
                            detail=f"{body.filename} is larger than the {settings.max_upload_mb} MB limit." if size else "The uploaded file is empty.")
    if not content_matches_extension(body.filename, storage.read_head(body.pathname)):
        storage.delete(body.pathname)
        raise _not_real(body.filename)
    return _create_record(db, body.filename, body.pathname, size, body.content_type)


# ─── Downloads ───────────────────────────────────────────────────────────────

@router.get("/{file_id}/download")
def download_file(file_id: str, db: Session = Depends(get_db)):
    """Download a file by the reference returned from upload/jobs, verifying TTL expiration."""
    file_record = (
        db.query(FileRecord).filter(FileRecord.stored_reference == file_id).first()
        or db.get(FileRecord, file_id)
    )
    if not file_record:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File record not found.")
    if file_record.expires_at and file_record.expires_at < datetime.utcnow():
        raise HTTPException(status_code=status.HTTP_410_GONE, detail="File has expired and is no longer available.")

    storage = get_storage_provider()
    if not storage.exists(file_record.stored_reference):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File data not found in storage.")

    media_type = file_record.mime_type or "application/octet-stream"
    if storage.name == "local":
        return FileResponse(path=storage.get_local_path(file_record.stored_reference),
                            filename=file_record.original_filename, media_type=media_type)

    # Streamed, so Vercel's 4.5 MB response limit doesn't apply.
    name = file_record.original_filename
    ascii_name = name.encode("ascii", "ignore").decode() or "download"
    return StreamingResponse(
        storage.iter_bytes(file_record.stored_reference),
        media_type=media_type,
        headers={
            "Content-Disposition": f"attachment; filename=\"{ascii_name.replace(chr(34), '')}\"; filename*=UTF-8''{quote(name)}",
            "Content-Length": str(file_record.size_bytes),
        },
    )
