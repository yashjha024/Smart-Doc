import logging
import os
import traceback
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime
from typing import Any, Callable

from sqlalchemy import update

from app.database.session import SessionLocal
from app.models.processing_job import ProcessingJob
from app.services.job_service import JobService

logger = logging.getLogger(__name__)

# A small fixed pool: PDF/image work is CPU- and memory-heavy, so running every
# job at once would just make them all slow (and risk running out of memory).
MAX_WORKERS = int(os.environ.get("JOB_WORKERS", "3"))
_executor = ThreadPoolExecutor(max_workers=MAX_WORKERS, thread_name_prefix="job")


class ExecutionRunner:
    """
    Runs jobs on a bounded background thread pool.
    Kept behind this class so it can later move to a real queue (or run inline on serverless).
    """

    @staticmethod
    def dispatch(job_id: str, handler_func: Callable[[str, Any], dict], *args, **kwargs):
        """
        handler_func takes (job_id, db_session) and returns {"output_files": [...], "metadata": {...}},
        or raises (ValueError for user-facing problems).
        """
        with SessionLocal() as db:
            JobService(db).update_job_status(job_id, "processing")
        _executor.submit(ExecutionRunner._execute, job_id, handler_func, *args, **kwargs)

    @staticmethod
    def _execute(job_id: str, handler_func: Callable, *args, **kwargs):
        with SessionLocal() as db:
            job_service = JobService(db)
            try:
                result = handler_func(job_id, db, *args, **kwargs)
                job_service.update_job_status(
                    job_id, "completed",
                    output_files=result.get("output_files"),
                    result_metadata=result.get("metadata"),
                )
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

    @staticmethod
    def fail_interrupted_jobs() -> int:
        """At startup, any job still 'created'/'processing' was cut off by a restart."""
        with SessionLocal() as db:
            result = db.execute(
                update(ProcessingJob)
                .where(ProcessingJob.status.in_(["created", "processing"]))
                .values(
                    status="failed",
                    error_information="The server restarted while this file was processing. Please try again.",
                    completed_at=datetime.utcnow(),
                )
            )
            db.commit()
            count = result.rowcount or 0
        if count:
            logger.warning("Marked %s interrupted job(s) as failed.", count)
        return count
