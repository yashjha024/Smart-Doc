"""Upload limits, legacy route hardening, cleanup and interrupted-job recovery."""
import os
import time
from datetime import datetime, timedelta

from app.core.config import settings
from app.database.session import SessionLocal
from app.models.document import Document
from app.models.file_record import FileRecord
from app.models.ocr_result import OcrResult
from app.models.processing_job import ProcessingJob
from app.services.cleanup_service import CleanupService
from app.services.execution_runner import ExecutionRunner
from app.services.storage import get_storage_provider
from tests.conftest import make_pdf


def test_upload_over_size_limit_is_413(client, monkeypatch):
    monkeypatch.setattr(settings, "max_upload_mb", 1)
    res = client.post("/api/files/upload", files={"file": ("big.bin", b"x" * (1024 * 1024 + 1))})
    assert res.status_code == 413


def test_legacy_convert_download_blocks_traversal(client):
    for name in ("..%5C..%5C.env", "..%2F..%2F.env", "%2E%2E%5Cdocrename.db"):
        res = client.get(f"/api/convert/download/{name}")
        assert res.status_code == 404, name


def test_legacy_convert_download_missing_is_404(client):
    assert client.get("/api/convert/download/nope.pdf").status_code == 404


def test_cleanup_removes_expired_records_jobs_and_legacy_data():
    storage = get_storage_provider()
    past = datetime.utcnow() - timedelta(hours=3)
    future = datetime.utcnow() + timedelta(hours=1)

    expired_ref = storage.put(make_pdf(1), "old.pdf")
    live_ref = storage.put(make_pdf(1), "new.pdf")

    settings.ensure_local_directories()
    legacy_name = "abc_legacy.pdf"
    (settings.upload_dir / legacy_name).write_bytes(b"%PDF-1.4")
    stray = settings.output_dir / "exports" / "stray.pdf"
    stray.parent.mkdir(parents=True, exist_ok=True)
    stray.write_bytes(b"old output")
    old_ts = past.timestamp()
    os.utime(stray, (old_ts, old_ts))

    with SessionLocal() as db:
        db.add_all([
            FileRecord(original_filename="old.pdf", stored_reference=expired_ref, mime_type="application/pdf", size_bytes=1, expires_at=past),
            FileRecord(original_filename="new.pdf", stored_reference=live_ref, mime_type="application/pdf", size_bytes=1, expires_at=future),
            ProcessingJob(id="expired-job", tool_id="merge-pdf", status="completed", input_files=[], output_files=[], expires_at=past),
            ProcessingJob(id="live-job", tool_id="merge-pdf", status="completed", input_files=[], output_files=[], expires_at=future),
        ])
        doc = Document(original_filename="legacy.pdf", stored_filename=legacy_name, content_type="application/pdf", file_size_bytes=8, created_at=past)
        db.add(doc)
        db.flush()
        db.add(OcrResult(document_id=doc.id, extracted_text="hello"))
        db.commit()
        doc_id = doc.id

    CleanupService().run_cleanup()

    assert not storage.exists(expired_ref)
    assert storage.exists(live_ref)
    assert not (settings.upload_dir / legacy_name).exists()
    assert not stray.exists()
    with SessionLocal() as db:
        assert db.query(FileRecord).filter_by(stored_reference=expired_ref).first() is None
        assert db.query(FileRecord).filter_by(stored_reference=live_ref).first() is not None
        assert db.get(ProcessingJob, "expired-job") is None
        assert db.get(ProcessingJob, "live-job") is not None
        assert db.get(Document, doc_id) is None
        assert db.query(OcrResult).filter_by(document_id=doc_id).count() == 0


def test_interrupted_jobs_are_marked_failed():
    with SessionLocal() as db:
        db.add(ProcessingJob(id="stuck-job", tool_id="merge-pdf", status="processing", input_files=[], output_files=[]))
        db.commit()
    assert ExecutionRunner.fail_interrupted_jobs() >= 1
    with SessionLocal() as db:
        job = db.get(ProcessingJob, "stuck-job")
        assert job.status == "failed"
        assert "restarted" in job.error_information


def test_many_jobs_finish_with_bounded_pool(client):
    refs = []
    for i in range(8):
        res = client.post("/api/files/upload", files={"file": (f"p{i}.pdf", make_pdf(2))})
        refs.append(res.json()["file_id"])
    job_ids = [client.post("/api/jobs", json={"tool_id": "pdf-to-jpg", "input_files": [r], "configuration": {"dpi": 72}}).json()["id"] for r in refs]
    deadline = time.time() + 60
    pending = set(job_ids)
    while pending and time.time() < deadline:
        for jid in list(pending):
            if client.get(f"/api/jobs/{jid}").json()["status"] == "completed":
                pending.discard(jid)
        time.sleep(0.1)
    assert not pending
