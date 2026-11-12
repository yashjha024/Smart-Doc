import logging
import threading
from datetime import datetime, timedelta

from sqlalchemy import delete, select

from app.core.config import settings
from app.database.session import SessionLocal
from app.models.compression_job import CompressionJob
from app.models.detected_identifier import DetectedIdentifier
from app.models.document import Document
from app.models.file_record import FileRecord
from app.models.ocr_result import OcrResult
from app.models.processing_job import ProcessingJob
from app.models.rename_history import RenameHistory
from app.services.storage import get_storage_provider

logger = logging.getLogger(__name__)


class CleanupService:
    """Deletes everything older than FILE_TTL_MINUTES: files, job rows and legacy DocRename data."""

    def __init__(self, interval_seconds: int = 600):
        self.interval_seconds = interval_seconds
        self._stop_event = threading.Event()
        self._thread = None

    def start(self):
        if self._thread is None or not self._thread.is_alive():
            self._stop_event.clear()
            self._thread = threading.Thread(target=self._run_loop, daemon=True)
            self._thread.start()
            logger.info("Cleanup service started (every %ss).", self.interval_seconds)

    def stop(self):
        self._stop_event.set()
        if self._thread:
            self._thread.join()
            logger.info("Cleanup service stopped.")

    def _run_loop(self):
        while not self._stop_event.is_set():
            try:
                self.run_cleanup()
            except Exception:
                logger.exception("Error during cleanup cycle")
            self._stop_event.wait(self.interval_seconds)

    def run_cleanup(self) -> dict:
        now = datetime.utcnow()
        cutoff = now - timedelta(minutes=settings.file_ttl_minutes)
        stats = {
            "files": self._expired_file_records(now),
            "jobs": self._expired_jobs(now),
            "documents": self._expired_legacy_documents(cutoff),
            "stray_files": self._stray_files(cutoff),
        }
        if any(stats.values()):
            logger.info("Cleanup removed %s", stats)
        return stats

    @staticmethod
    def _expired_file_records(now: datetime) -> int:
        storage = get_storage_provider()
        removed = 0
        with SessionLocal() as db:
            for record in db.scalars(select(FileRecord).where(FileRecord.expires_at <= now)).all():
                try:
                    storage.delete(record.stored_reference)
                    db.delete(record)
                    db.commit()
                    removed += 1
                except Exception:
                    db.rollback()
                    logger.exception("Failed to clean up file record %s", record.id)
        return removed

    @staticmethod
    def _expired_jobs(now: datetime) -> int:
        with SessionLocal() as db:
            result = db.execute(
                delete(ProcessingJob).where(
                    ProcessingJob.expires_at <= now,
                    ProcessingJob.status.in_(["completed", "failed"]),
                )
            )
            db.commit()
            return result.rowcount or 0

    @staticmethod
    def _expired_legacy_documents(cutoff: datetime) -> int:
        """Old DocRename uploads: delete the document, its related rows and its file."""
        removed = 0
        with SessionLocal() as db:
            docs = db.scalars(select(Document).where(Document.created_at <= cutoff)).all()
            for doc in docs:
                try:
                    for model in (OcrResult, DetectedIdentifier, RenameHistory, CompressionJob):
                        db.execute(delete(model).where(model.document_id == doc.id))
                    if doc.file_ref:
                        get_storage_provider().delete(doc.file_ref)
                    else:
                        path = settings.upload_dir / doc.stored_filename
                        if path.is_file() and path.resolve().parent == settings.upload_dir.resolve():
                            path.unlink()
                    db.delete(doc)
                    db.commit()
                    removed += 1
                except Exception:
                    db.rollback()
                    logger.exception("Failed to clean up document %s", doc.id)
        return removed

    @staticmethod
    def _stray_files(cutoff: datetime) -> int:
        """Files on disk with no row pointing at them (legacy outputs, temp files, orphans)."""
        cutoff_ts = cutoff.timestamp()
        with SessionLocal() as db:
            live_refs = set(db.scalars(select(FileRecord.stored_reference)).all())
            live_uploads = set(db.scalars(select(Document.stored_filename)).all())

        removed = 0
        folders = [
            (settings.storage_root / "files", live_refs),
            (settings.upload_dir, live_uploads),
            (settings.output_dir, set()),
            (settings.temp_dir, set()),
        ]
        for folder, keep in folders:
            if not folder.exists():
                continue
            for path in folder.rglob("*"):
                if not path.is_file() or path.name in keep:
                    continue
                try:
                    if path.stat().st_mtime <= cutoff_ts:
                        path.unlink()
                        removed += 1
                except OSError:
                    logger.warning("Could not delete %s", path)
        return removed


cleanup_service = CleanupService(interval_seconds=600)
