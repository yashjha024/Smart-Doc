import uuid
from datetime import datetime
from sqlalchemy import DateTime, Integer, String, Column, BigInteger

from app.database.session import Base

class FileRecord(Base):
    __tablename__ = "file_records"

    # Use string for id to ensure SQLite compatibility during migration
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()), index=True)
    original_filename = Column(String(255), nullable=False)
    stored_reference = Column(String(255), nullable=False, unique=True, index=True)
    mime_type = Column(String(100), nullable=False)
    size_bytes = Column(BigInteger, nullable=False)
    storage_provider = Column(String(50), nullable=False, default="local")
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    expires_at = Column(DateTime, nullable=True, index=True)
