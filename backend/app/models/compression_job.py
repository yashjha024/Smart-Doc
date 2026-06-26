from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, Column
from sqlalchemy.orm import declarative_base

from app.database.session import Base


class CompressionJob(Base):
    __tablename__ = "compression_jobs"

    id = Column(Integer, primary_key=True, index=True)
    document_id = Column(Integer, ForeignKey("documents.id"), nullable=False, index=True)
    mode = Column(String(50), nullable=False)
    target_size_kb = Column(Integer, nullable=True)
    original_size_bytes = Column(Integer, nullable=False)
    compressed_size_bytes = Column(Integer, nullable=True)
    output_filename = Column(String(255), nullable=True)
    status = Column(String(50), nullable=False, default="pending")
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
