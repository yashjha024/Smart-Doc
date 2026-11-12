from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.schemas.job import JobCreate, JobResponse
from app.services.job_service import JobService
from app.services.execution_runner import ExecutionRunner
from app.services.handlers.pdf_to_image import PdfToImageHandler
from app.services.handlers.pdf_merge import PdfMergeHandler
from app.services.handlers.pdf_split import PdfSplitHandler
from app.services.handlers.pdf_compress import PdfCompressHandler
from app.services.handlers.image_compress import ImageCompressionHandler
from app.services.handlers.image_convert import ImageConversionHandler

router = APIRouter()

# Tool ids match frontend/src/config/tools.ts.
HANDLERS = {
    "compress-pdf": PdfCompressHandler.execute,
    "pdf-to-jpg": PdfToImageHandler.execute,
    "merge-pdf": PdfMergeHandler.execute,
    "split-pdf": PdfSplitHandler.execute,
    "image-compress": ImageCompressionHandler.execute,
    "image-convert": ImageConversionHandler.execute,
}

# Older ids, kept so existing scripts and stored jobs still resolve.
ALIASES = {
    "pdf-compress": "compress-pdf",
    "pdf-to-image": "pdf-to-jpg",
    "pdf-merge": "merge-pdf",
    "pdf-split": "split-pdf",
}


@router.post("", response_model=JobResponse)
def create_job(payload: JobCreate, db: Session = Depends(get_db)):
    tool_id = ALIASES.get(payload.tool_id, payload.tool_id)
    handler = HANDLERS.get(tool_id)
    if handler is None:
        raise HTTPException(status_code=400, detail=f"Unsupported tool: {payload.tool_id}")
    if not payload.input_files:
        raise HTTPException(status_code=400, detail="At least one input file is required.")

    job_service = JobService(db)
    job = job_service.create_job(
        tool_id=tool_id,
        input_files=payload.input_files,
        configuration=payload.configuration,
    )

    ExecutionRunner.dispatch(job.id, handler)

    # dispatch() updates the job in its own session; reload so the response is current.
    db.refresh(job)
    return job


@router.get("/{job_id}", response_model=JobResponse)
def get_job_status(job_id: str, db: Session = Depends(get_db)):
    return JobService(db).get_job(job_id)
