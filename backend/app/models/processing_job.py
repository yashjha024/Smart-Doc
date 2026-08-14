import uuid
from datetime import datetime
from sqlalchemy import DateTime, Integer, String, Column, JSON, Text, ForeignKey

from app.database.session import Base

class ProcessingJob(Base):
    __tablename__ = "processing_jobs"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()), index=True)
    tool_id = Column(String(100), nullable=False)
    status = Column(String(50), nullable=False, default="created", index=True)
    
    # Optional foreign keys to track inputs and outputs
    # Using JSON to support multiple file records per job
    input_files = Column(JSON, nullable=False, default=list)
    output_files = Column(JSON, nullable=False, default=list)
    
    configuration = Column(JSON, nullable=True)
    error_information = Column(Text, nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    completed_at = Column(DateTime, nullable=True)
    expires_at = Column(DateTime, nullable=True, index=True)
