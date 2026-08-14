import os
import sys
import uuid
import time
from pathlib import Path

# Setup path so we can import app
sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))

from app.core.config import settings
from app.database.session import Base, engine, SessionLocal
from app.models.file_record import FileRecord
from app.models.processing_job import ProcessingJob
from app.services.storage import get_storage_provider, LocalVolumeProvider
from app.services.job_service import JobService
from app.services.execution_runner import ExecutionRunner
from app.services.handlers.pdf_to_image import PdfToImageHandler
from app.services.cleanup_service import cleanup_service

def verify_storage():
    print("--- Verifying StorageProvider ---")
    provider = get_storage_provider()
    assert isinstance(provider, LocalVolumeProvider), "StorageProvider should be LocalVolumeProvider"
    
    test_data = b"Hello, FileCraft!"
    ref = provider.put(test_data, "test.txt")
    print(f"Stored file with reference: {ref}")
    
    assert provider.exists(ref), "File should exist after put"
    
    read_data = provider.get(ref)
    assert read_data == test_data, "Read data should match written data"
    
    local_path = provider.get_local_path(ref)
    assert local_path.exists(), "Local path should exist"
    
    deleted = provider.delete(ref)
    assert deleted, "Delete should return True"
    assert not provider.exists(ref), "File should not exist after delete"
    
    # Path traversal check
    try:
        provider.get_local_path("../../../windows/system32")
        print("FAIL: Path traversal allowed!")
    except ValueError:
        print("PASS: Path traversal prevented.")
        
    print("StorageProvider tests passed.\n")

def verify_job_runner():
    print("--- Verifying ExecutionRunner ---")
    with SessionLocal() as db:
        job_service = JobService(db)
        job = job_service.create_job(tool_id="test-tool", input_files=["dummy_ref"], configuration={})
        job_id = job.id
        print(f"Created Job: {job_id}")
        
    def mock_handler(job_id, db):
        print(f"Handler executing for job {job_id}")
        time.sleep(1)
        return {"output_files": ["mock_output_ref"]}
        
    ExecutionRunner.dispatch(job_id, mock_handler)
    
    # Poll for completion
    completed = False
    for _ in range(10):
        with SessionLocal() as db:
            job_service = JobService(db)
            j = job_service.get_job(job_id)
            print(f"Polled job status: {j.status}")
            if j.status == "completed":
                assert j.output_files[0] == "mock_output_ref"
                completed = True
                break
        time.sleep(0.2)
        
    assert completed, "Job did not complete in time"
    print("ExecutionRunner tests passed.\n")

def verify_pdf_to_image():
    print("--- Verifying PDF -> Image Handler ---")
    import fitz
    
    # Create a dummy PDF
    temp_dir = settings.temp_dir
    temp_dir.mkdir(parents=True, exist_ok=True)
    pdf_path = temp_dir / "test_verify.pdf"
    doc = fitz.open()
    page = doc.new_page()
    page.insert_text((50, 50), "Hello, FileCraft Verification!")
    doc.save(str(pdf_path))
    doc.close()
    
    provider = get_storage_provider()
    with open(pdf_path, "rb") as f:
        pdf_ref = provider.put(f.read(), "test_verify.pdf")
        
    with SessionLocal() as db:
        # Create input record
        from datetime import datetime, timedelta
        in_record = FileRecord(
            original_filename="test_verify.pdf",
            stored_reference=pdf_ref,
            mime_type="application/pdf",
            size_bytes=pdf_path.stat().st_size,
            expires_at=datetime.utcnow() + timedelta(minutes=60)
        )
        db.add(in_record)
        db.commit()
        
        # Create Job
        job_service = JobService(db)
        job = job_service.create_job(
            tool_id="pdf-to-image",
            input_files=[pdf_ref],
            configuration={"target_format": "jpg"}
        )
        job_id = job.id
        
    ExecutionRunner.dispatch(job_id, PdfToImageHandler.execute)
    
    # Poll
    completed = False
    for _ in range(20):
        with SessionLocal() as db:
            job_service = JobService(db)
            j = job_service.get_job(job_id)
            if j.status == "completed":
                assert j.output_files
                print(f"Job completed with output: {j.output_files[0]}")
                out_record = db.query(FileRecord).filter(FileRecord.stored_reference == j.output_files[0]).first()
                assert out_record is not None, "Output file record should exist"
                assert out_record.mime_type == "image/jpeg", "Output should be JPEG"
                
                out_path = provider.get_local_path(j.output_files[0])
                assert out_path.exists(), "Output image file should exist"
                print("PDF -> Image tests passed.\n")
                completed = True
                break
            elif j.status == "failed":
                print(f"Job failed: {j.error_information}")
                break
        time.sleep(0.5)
        
    assert completed, "PDF to Image job did not complete successfully"
    pdf_path.unlink()

def verify_cleanup():
    print("--- Verifying Cleanup Service ---")
    provider = get_storage_provider()
    ref = provider.put(b"expired", "expired.txt")
    
    from datetime import datetime, timedelta
    with SessionLocal() as db:
        record = FileRecord(
            original_filename="expired.txt",
            stored_reference=ref,
            mime_type="text/plain",
            size_bytes=7,
            expires_at=datetime.utcnow() - timedelta(minutes=1) # Already expired
        )
        db.add(record)
        db.commit()
        record_id = record.id
        
    cleanup_service.run_cleanup()
    
    with SessionLocal() as db:
        check_record = db.query(FileRecord).filter(FileRecord.id == record_id).first()
        assert check_record is None, "Expired record should be deleted from DB"
        
    assert not provider.exists(ref), "Expired file should be deleted from storage"
    print("Cleanup Service tests passed.\n")

if __name__ == "__main__":
    # Create tables
    Base.metadata.create_all(bind=engine)
    
    try:
        verify_storage()
        verify_job_runner()
        verify_pdf_to_image()
        verify_cleanup()
        print("ALL FOUNDATION TESTS PASSED.")
    except AssertionError as e:
        print(f"TEST FAILED: {e}")
    except Exception as e:
        import traceback
        traceback.print_exc()
        print("TEST FAILED WITH EXCEPTION.")
