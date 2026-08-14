from datetime import datetime, timedelta
from typing import Optional
from sqlalchemy.orm import Session
from fastapi import HTTPException, status

from app.models.processing_job import ProcessingJob
from app.core.config import settings

class JobService:
    def __init__(self, db: Session):
        self.db = db

    def create_job(self, tool_id: str, input_files: list[str] = None, configuration: dict = None) -> ProcessingJob:
        ttl = timedelta(minutes=settings.file_ttl_minutes)
        expires_at = datetime.utcnow() + ttl
        
        job = ProcessingJob(
            tool_id=tool_id,
            status="created",
            input_files=input_files or [],
            configuration=configuration,
            expires_at=expires_at
        )
        
        self.db.add(job)
        self.db.commit()
        self.db.refresh(job)
        return job

    def get_job(self, job_id: str) -> ProcessingJob:
        job = self.db.get(ProcessingJob, job_id)
        if not job:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, 
                detail="Processing job not found."
            )
        return job

    def update_job_status(self, job_id: str, status: str, output_files: list[str] = None, error_info: Optional[str] = None) -> ProcessingJob:
        job = self.get_job(job_id)
        job.status = status
        
        if output_files is not None:
            job.output_files = output_files
            
        if error_info:
            job.error_information = error_info
            
        if status in ["completed", "failed"]:
            job.completed_at = datetime.utcnow()
            
        self.db.add(job)
        self.db.commit()
        self.db.refresh(job)
        return job
