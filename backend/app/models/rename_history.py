from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, Column

from app.database.session import Base


class RenameHistory(Base):
    __tablename__ = "rename_history"

    id = Column(Integer, primary_key=True, index=True)
    document_id = Column(Integer, ForeignKey("documents.id"), nullable=False, index=True)
    previous_filename = Column(String(255), nullable=False)
    new_filename = Column(String(255), nullable=False)
    template_used = Column(String(255), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    undone_at = Column(DateTime, nullable=True)
