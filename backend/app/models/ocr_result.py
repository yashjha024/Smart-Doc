from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, Text, Column

from app.database.session import Base


class OcrResult(Base):
    __tablename__ = "ocr_results"

    id = Column(Integer, primary_key=True, index=True)
    document_id = Column(Integer, ForeignKey("documents.id"), nullable=False, index=True)
    extracted_text = Column(Text, nullable=False)
    engine = Column(Text, nullable=False, default="paddleocr")
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
