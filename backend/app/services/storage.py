from abc import ABC, abstractmethod
from pathlib import Path
from uuid import uuid4
import os
import re
import shutil

from app.core.config import settings
from app.utils.filename import sanitize_filename

class StorageProvider(ABC):
    @abstractmethod
    def put(self, file_bytes: bytes, original_filename: str) -> str:
        """Stores a file and returns a safe reference (e.g., UUID-based path or key)."""
        pass

    @abstractmethod
    def get(self, reference: str) -> bytes:
        """Retrieves a file by its reference."""
        pass
        
    @abstractmethod
    def get_local_path(self, reference: str) -> Path:
        """Returns a local filesystem path for the reference. May download if using cloud storage."""
        pass

    @abstractmethod
    def delete(self, reference: str) -> bool:
        """Deletes a file by its reference."""
        pass
        
    @abstractmethod
    def exists(self, reference: str) -> bool:
        """Checks if a file exists."""
        pass

class LocalVolumeProvider(StorageProvider):
    def __init__(self):
        self.base_dir = settings.storage_root / "files"
        self.base_dir.mkdir(parents=True, exist_ok=True)

    def put(self, file_bytes: bytes, original_filename: str) -> str:
        # References travel in URLs, so keep them to URL-safe characters.
        # The original filename is kept on the FileRecord and used for downloads.
        safe_name = re.sub(r"[^A-Za-z0-9._-]+", "_", sanitize_filename(original_filename)).strip("_") or "file"
        reference = f"{uuid4().hex}_{safe_name}"
        path = self.base_dir / reference
        
        with open(path, "wb") as f:
            f.write(file_bytes)
            
        return reference

    def get(self, reference: str) -> bytes:
        path = self._resolve_path(reference)
        with open(path, "rb") as f:
            return f.read()

    def get_local_path(self, reference: str) -> Path:
        return self._resolve_path(reference)

    def delete(self, reference: str) -> bool:
        path = self._resolve_path(reference)
        try:
            path.unlink(missing_ok=True)
            return True
        except OSError:
            return False
            
    def exists(self, reference: str) -> bool:
        return self._resolve_path(reference).exists()
        
    def _resolve_path(self, reference: str) -> Path:
        # Prevent path traversal
        if ".." in reference or "/" in reference or "\\" in reference:
            raise ValueError("Invalid storage reference")
        return self.base_dir / reference

def get_storage_provider() -> StorageProvider:
    return LocalVolumeProvider()
