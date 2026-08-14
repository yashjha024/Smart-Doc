import threading
import time
import logging
from datetime import datetime
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database.session import SessionLocal
from app.models.file_record import FileRecord
from app.services.storage import get_storage_provider

logger = logging.getLogger(__name__)

class CleanupService:
    def __init__(self, interval_seconds: int = 600):
        self.interval_seconds = interval_seconds
        self._stop_event = threading.Event()
        self._thread = None

    def start(self):
        if self._thread is None or not self._thread.is_alive():
            self._stop_event.clear()
            self._thread = threading.Thread(target=self._run_loop, daemon=True)
            self._thread.start()
            logger.info("Cleanup service started.")

    def stop(self):
        self._stop_event.set()
        if self._thread:
            self._thread.join()
            logger.info("Cleanup service stopped.")

    def _run_loop(self):
        while not self._stop_event.is_set():
            try:
                self.run_cleanup()
            except Exception as e:
                logger.error(f"Error during cleanup cycle: {e}")
            
            # Wait for interval or stop event
            self._stop_event.wait(self.interval_seconds)

    def run_cleanup(self):
        """Finds expired files, deletes them from storage, and removes their database records."""
        storage = get_storage_provider()
        
        with SessionLocal() as db:
            now = datetime.utcnow()
            statement = select(FileRecord).where(FileRecord.expires_at <= now)
            expired_files = list(db.scalars(statement).all())
            
            if not expired_files:
                return

            logger.info(f"Found {len(expired_files)} expired files to clean up.")
            
            for file_record in expired_files:
                try:
                    # 1. Delete from storage
                    storage.delete(file_record.stored_reference)
                    
                    # 2. Delete from DB
                    db.delete(file_record)
                    db.commit()
                except Exception as e:
                    db.rollback()
                    logger.error(f"Failed to clean up file record {file_record.id}: {e}")

# Global instance
cleanup_service = CleanupService(interval_seconds=600)  # Runs every 10 minutes by default
