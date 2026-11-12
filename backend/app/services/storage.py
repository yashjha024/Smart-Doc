import mimetypes
import re
from abc import ABC, abstractmethod
from pathlib import Path
from typing import Iterator
from uuid import uuid4

from app.core.config import settings
from app.utils.filename import sanitize_filename

# References travel in URLs (/api/files/<ref>/download), so they are always
# "<32 hex>_<url-safe name>" — no slashes, no spaces. Same format for every backend.
REFERENCE_PATTERN = re.compile(r"^[0-9a-f]{32}_[A-Za-z0-9._-]{1,180}$")


def make_reference(original_filename: str) -> str:
    safe_name = re.sub(r"[^A-Za-z0-9._-]+", "_", sanitize_filename(original_filename)).strip("_") or "file"
    return f"{uuid4().hex}_{safe_name[:150]}"


def check_reference(reference: str) -> str:
    if not REFERENCE_PATTERN.match(reference or "") or ".." in reference:
        raise ValueError("Invalid storage reference")
    return reference


class StorageProvider(ABC):
    name: str

    @abstractmethod
    def put(self, file_bytes: bytes, original_filename: str) -> str:
        """Stores a file and returns its reference."""

    @abstractmethod
    def get(self, reference: str) -> bytes:
        """Returns the file's bytes."""

    @abstractmethod
    def get_local_path(self, reference: str) -> Path:
        """Returns a local path to the file, downloading it first for remote storage."""

    @abstractmethod
    def iter_bytes(self, reference: str, chunk_size: int = 1024 * 1024) -> Iterator[bytes]:
        """Streams the file (used for downloads, so large files never sit in memory)."""

    @abstractmethod
    def delete(self, reference: str) -> bool:
        """Deletes the file. Deleting a missing file is not an error."""

    @abstractmethod
    def exists(self, reference: str) -> bool:
        """Checks if a file exists."""


class LocalVolumeProvider(StorageProvider):
    name = "local"

    def __init__(self):
        self.base_dir = settings.storage_root / "files"
        self.base_dir.mkdir(parents=True, exist_ok=True)

    def put(self, file_bytes: bytes, original_filename: str) -> str:
        reference = make_reference(original_filename)
        (self.base_dir / reference).write_bytes(file_bytes)
        return reference

    def get(self, reference: str) -> bytes:
        return self._resolve_path(reference).read_bytes()

    def get_local_path(self, reference: str) -> Path:
        return self._resolve_path(reference)

    def iter_bytes(self, reference: str, chunk_size: int = 1024 * 1024) -> Iterator[bytes]:
        with open(self._resolve_path(reference), "rb") as f:
            while chunk := f.read(chunk_size):
                yield chunk

    def delete(self, reference: str) -> bool:
        try:
            self._resolve_path(reference).unlink(missing_ok=True)
            return True
        except (OSError, ValueError):
            return False

    def exists(self, reference: str) -> bool:
        try:
            return self._resolve_path(reference).exists()
        except ValueError:
            return False

    def _resolve_path(self, reference: str) -> Path:
        # Prevent path traversal: references are a single safe file name.
        if not reference or ".." in reference or "/" in reference or "\\" in reference:
            raise ValueError("Invalid storage reference")
        return self.base_dir / reference


class VercelBlobProvider(StorageProvider):
    """Vercel Blob (public store; references contain a random UUID so URLs can't be guessed).
    Processing needs real files, so blobs are downloaded to a /tmp cache on first use."""

    name = "blob"
    ACCESS = "public"

    def __init__(self):
        from vercel.blob import sync as blob  # imported lazily: only needed on Vercel
        self._blob = blob
        self.cache_dir = settings.storage_root / "blob-cache"
        self.cache_dir.mkdir(parents=True, exist_ok=True)

    def put(self, file_bytes: bytes, original_filename: str) -> str:
        reference = make_reference(original_filename)
        self._blob.put_blob(
            reference, bytes(file_bytes), access=self.ACCESS,
            content_type=mimetypes.guess_type(original_filename)[0] or "application/octet-stream",
        )
        # Keep a local copy so a follow-up step in the same instance needn't re-download.
        (self.cache_dir / reference).write_bytes(file_bytes)
        return reference

    def get(self, reference: str) -> bytes:
        return self.get_local_path(reference).read_bytes()

    def get_local_path(self, reference: str) -> Path:
        path = self.cache_dir / check_reference(reference)
        if not path.exists():
            tmp = path.with_suffix(path.suffix + ".part")
            with self._blob.stream_blob(reference, access=self.ACCESS) as download, open(tmp, "wb") as f:
                for chunk in download:
                    f.write(chunk)
            tmp.replace(path)
        return path

    def iter_bytes(self, reference: str, chunk_size: int = 1024 * 1024) -> Iterator[bytes]:
        cached = self.cache_dir / check_reference(reference)
        if cached.exists():
            with open(cached, "rb") as f:
                while chunk := f.read(chunk_size):
                    yield chunk
            return
        with self._blob.stream_blob(reference, access=self.ACCESS) as download:
            yield from download

    def read_head(self, reference: str, n: int = 1024) -> bytes:
        """First bytes of a blob (for file-type checks) without downloading all of it."""
        buf = b""
        with self._blob.stream_blob(check_reference(reference), access=self.ACCESS) as download:
            for chunk in download:
                buf += chunk
                if len(buf) >= n:
                    break
        return buf[:n]

    def size(self, reference: str) -> int | None:
        try:
            return self._blob.head_blob(check_reference(reference)).size
        except self._blob.BlobNotFoundError:
            return None

    def delete(self, reference: str) -> bool:
        try:
            check_reference(reference)
        except ValueError:
            return False
        (self.cache_dir / reference).unlink(missing_ok=True)
        try:
            self._blob.delete_blob(reference)  # deleting a missing blob succeeds
            return True
        except Exception:
            return False

    def exists(self, reference: str) -> bool:
        return self.size(reference) is not None


_provider: StorageProvider | None = None


def get_storage_provider() -> StorageProvider:
    global _provider
    if _provider is None:
        _provider = VercelBlobProvider() if settings.storage_backend == "blob" else LocalVolumeProvider()
    return _provider
