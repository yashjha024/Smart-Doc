from datetime import datetime

from sqlalchemy import DateTime, Float, ForeignKey, Integer, String, Column

from app.database.session import Base


class DetectedIdentifier(Base):
    __tablename__ = "detected_identifiers"

    id = Column(Integer, primary_key=True, index=True)
    document_id = Column(Integer, ForeignKey("documents.id"), nullable=False, index=True)
    label = Column(String(100), nullable=False)
    display_label = Column(String(100), nullable=False)
    value = Column(String(255), nullable=False)
    confidence = Column(Float, nullable=False, default=0.0)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
