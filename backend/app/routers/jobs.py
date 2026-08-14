from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.schemas.job import JobCreate, JobResponse
from app.services.job_service import JobService
from app.services.execution_runner import ExecutionRunner

router = APIRouter()

@router.post("", response_model=JobResponse)
def create_job(payload: JobCreate, db: Session = Depends(get_db)):
    job_service = JobService(db)
    
    # Simple registry for MVP migration
    from app.services.handlers.pdf_to_image import PdfToImageHandler
    from app.services.handlers.pdf_merge import PdfMergeHandler
    from app.services.handlers.pdf_split import PdfSplitHandler
    
    handlers = {
        "pdf-to-image": PdfToImageHandler.execute,
        "pdf-merge": PdfMergeHandler.execute,
        "pdf-split": PdfSplitHandler.execute
    }
    
    if payload.tool_id not in handlers:
        raise HTTPException(status_code=400, detail=f"Unsupported tool: {payload.tool_id}")
        
    job = job_service.create_job(
        tool_id=payload.tool_id,
        input_files=payload.input_files,
        configuration=payload.configuration
    )
    
    # Dispatch execution in background
    ExecutionRunner.dispatch(job.id, handlers[payload.tool_id])
    
    return job

@router.get("/{job_id}", response_model=JobResponse)
def get_job_status(job_id: str, db: Session = Depends(get_db)):
    job_service = JobService(db)
    job = job_service.get_job(job_id)
    return job
