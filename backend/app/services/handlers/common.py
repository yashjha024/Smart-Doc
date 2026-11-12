"""Helpers shared by job handlers: load inputs, store outputs, open images safely."""
import io
import mimetypes
from datetime import datetime, timedelta
from pathlib import Path

from PIL import Image, ImageOps, UnidentifiedImageError
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.file_record import FileRecord
from app.services.storage import get_storage_provider
from app.utils.filename import sanitize_filename


def load_input(db: Session, ref: str) -> tuple[FileRecord, Path]:
    """Return the FileRecord and local path for an uploaded file, or raise a user-facing ValueError."""
    record = db.query(FileRecord).filter(FileRecord.stored_reference == ref).first()
    path = get_storage_provider().get_local_path(ref) if record else None
    if not record or not path or not path.exists():
        raise ValueError("Input file not found. It may have expired.")
    return record, path


def stem_of(record: FileRecord) -> str:
    return sanitize_filename(Path(record.original_filename).stem) or "file"


def store_output(db: Session, data: bytes, filename: str, mime_type: str | None = None) -> str:
    """Save bytes as a new downloadable file (expires like uploads) and return its reference."""
    ref = get_storage_provider().put(data, filename)
    db.add(FileRecord(
        original_filename=filename,
        stored_reference=ref,
        mime_type=mime_type or mimetypes.guess_type(filename)[0] or "application/octet-stream",
        size_bytes=len(data),
        expires_at=datetime.utcnow() + timedelta(minutes=settings.file_ttl_minutes),
    ))
    db.commit()
    return ref


def open_image(path: Path) -> Image.Image:
    """Open an image with EXIF rotation applied, or raise a user-facing ValueError."""
    try:
        img = Image.open(path)
        img.load()
    except Image.DecompressionBombError:
        raise ValueError("This image is too large to process (over 100 megapixels).")
    except UnidentifiedImageError:
        raise ValueError("Invalid or corrupted image file.")
    except Exception:
        raise ValueError("This image could not be read. It may be damaged.")
    fmt = img.format
    img = ImageOps.exif_transpose(img)
    img.format = fmt  # exif_transpose drops it
    return img


# Pillow format name -> (file extension, mime type)
IMAGE_OUTPUTS = {
    "JPEG": ("jpg", "image/jpeg"),
    "MPO": ("jpg", "image/jpeg"),
    "PNG": ("png", "image/png"),
    "WEBP": ("webp", "image/webp"),
    "GIF": ("gif", "image/gif"),
    "BMP": ("bmp", "image/bmp"),
    "TIFF": ("tiff", "image/tiff"),
}


def encode_like_source(img: Image.Image, source_format: str | None) -> tuple[bytes, str, str]:
    """Encode in the source's format (JPEG for unknown), returning (bytes, extension, mime)."""
    fmt = (source_format or "JPEG").upper()
    if fmt not in IMAGE_OUTPUTS:
        fmt = "JPEG"
    if fmt == "MPO":
        fmt = "JPEG"
    ext, mime = IMAGE_OUTPUTS[fmt]
    if fmt == "JPEG" and img.mode not in ("RGB", "L", "CMYK"):
        img = img.convert("RGB")
    buf = io.BytesIO()
    kwargs = {"quality": 92} if fmt in ("JPEG", "WEBP") else {}
    img.save(buf, format=fmt, **kwargs)
    return buf.getvalue(), ext, mime
