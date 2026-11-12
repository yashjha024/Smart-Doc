from datetime import datetime

from sqlalchemy import DateTime, Integer, String, Column

from app.database.session import Base


class Document(Base):
    __tablename__ = "documents"

    id = Column(Integer, primary_key=True, index=True)
    original_filename = Column(String(255), nullable=False)
    stored_filename = Column(String(255), nullable=False, unique=True)
    content_type = Column(String(100), nullable=False)
    file_size_bytes = Column(Integer, nullable=False)
    status = Column(String(50), nullable=False, default="uploaded")
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    export_count = Column(Integer, default=0, nullable=False)  # Track export count for bulk operations
    # Reference in the shared StorageProvider (local disk or Vercel Blob). Older rows
    # predate this and keep their file in storage_root/uploads under stored_filename.
    file_ref = Column(String(255), nullable=True)
