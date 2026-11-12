import hmac
import threading
import time

from fastapi import APIRouter, Header, HTTPException

from app.core.config import settings
from app.services.cleanup_service import CleanupService

router = APIRouter()

_last_run = 0.0
_lock = threading.Lock()


@router.get("/cron/cleanup")
def cron_cleanup(authorization: str | None = Header(default=None)):
    """Called by Vercel Cron. Vercel sends 'Authorization: Bearer <CRON_SECRET>'."""
    if not settings.cron_secret:
        raise HTTPException(status_code=403, detail="Cleanup endpoint is disabled (CRON_SECRET not set).")
    expected = f"Bearer {settings.cron_secret}"
    if not authorization or not hmac.compare_digest(authorization, expected):
        raise HTTPException(status_code=401, detail="Unauthorized")
    return {"removed": CleanupService().run_cleanup()}


def maybe_cleanup() -> None:
    """Serverless only: run cleanup during a request at most every CLEANUP_INTERVAL_MINUTES.
    Vercel Hobby crons run once a day, so this keeps the one-hour promise while the app is in use."""
    global _last_run
    if not settings.serverless:
        return
    now = time.monotonic()
    if now - _last_run < settings.cleanup_interval_minutes * 60:
        return
    with _lock:
        if now - _last_run < settings.cleanup_interval_minutes * 60:
            return
        _last_run = now
    try:
        CleanupService().run_cleanup()
    except Exception:  # never fail the user's request because of cleanup
        import logging
        logging.getLogger(__name__).exception("Opportunistic cleanup failed")
