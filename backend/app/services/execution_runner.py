import threading
import logging
import traceback
from typing import Callable, Any

from app.database.session import SessionLocal
from app.services.job_service import JobService

logger = logging.getLogger(__name__)

class ExecutionRunner:
    """
    Abstracts execution to allow seamless transition to Celery/Redis in the future.
    Currently executes tasks in a background thread to prevent blocking the API.
    """
    
    @staticmethod
    def dispatch(job_id: str, handler_func: Callable[[str, Any], dict], *args, **kwargs):
        """
        Dispatches a job to be processed.
        handler_func should take (job_id, db_session) and return a dict with {"output_files": [...], "metadata": {...}}
        or raise an exception on failure.
        """
        # Update status to validating/processing
        with SessionLocal() as db:
            job_service = JobService(db)
            job_service.update_job_status(job_id, "processing")
            
        # Submit to background execution
        thread = threading.Thread(
            target=ExecutionRunner._execute,
            args=(job_id, handler_func) + args,
            kwargs=kwargs,
            daemon=True
        )
        thread.start()
        
    @staticmethod
    def _execute(job_id: str, handler_func: Callable, *args, **kwargs):
        with SessionLocal() as db:
            job_service = JobService(db)
            try:
                result = handler_func(job_id, db, *args, **kwargs)
                output_files = result.get("output_files")
                result_metadata = result.get("metadata")
                job_service.update_job_status(job_id, "completed", output_files=output_files, result_metadata=result_metadata)
            except Exception as e:
                logger.error(f"Job {job_id} failed: {traceback.format_exc()}")
                db.rollback()
                # Handlers raise ValueError with messages written for users; anything
                # else may contain paths or internals, so show a generic message.
                message = str(e) if isinstance(e, ValueError) else "Something went wrong while processing this file."
                try:
                    job_service.update_job_status(job_id, "failed", error_info=message)
                except Exception:
                    logger.error(f"Could not mark job {job_id} as failed: {traceback.format_exc()}")
