import time
import uuid
import fitz
from datetime import datetime, timedelta
from app.database.session import SessionLocal
from app.services.storage import get_storage_provider
from app.models.file_record import FileRecord
from app.models.processing_job import ProcessingJob
from app.services.handlers.pdf_merge import PdfMergeHandler
from app.services.handlers.pdf_split import PdfSplitHandler
from app.services.execution_runner import ExecutionRunner

def create_dummy_pdf(text: str, filename: str) -> bytes:
    doc = fitz.open()
    page = doc.new_page()
    page.insert_text((50, 50), text)
    if "3 pages" in text:
        doc.new_page().insert_text((50, 50), "Page 2")
        doc.new_page().insert_text((50, 50), "Page 3")
    return doc.tobytes()

def main():
    print("--- Setting up test data ---")
    db = SessionLocal()
    storage = get_storage_provider()
    
    # Create two PDFs
    pdf1_bytes = create_dummy_pdf("Test PDF 1", "test1.pdf")
    pdf2_bytes = create_dummy_pdf("Test PDF 2 with 3 pages", "test2.pdf")
    
    ref1 = storage.put(pdf1_bytes, "test1.pdf")
    ref2 = storage.put(pdf2_bytes, "test2.pdf")
    
    rec1 = FileRecord(original_filename="test1.pdf", stored_reference=ref1, mime_type="application/pdf", size_bytes=len(pdf1_bytes), expires_at=datetime.utcnow() + timedelta(hours=1))
    rec2 = FileRecord(original_filename="test2.pdf", stored_reference=ref2, mime_type="application/pdf", size_bytes=len(pdf2_bytes), expires_at=datetime.utcnow() + timedelta(hours=1))
    db.add_all([rec1, rec2])
    db.commit()
    
    print("--- Testing Merge PDF ---")
    merge_job = ProcessingJob(
        tool_id="pdf-merge",
        input_files=[ref1, ref2],
        expires_at=datetime.utcnow() + timedelta(hours=1)
    )
    db.add(merge_job)
    db.commit()
    
    ExecutionRunner.dispatch(merge_job.id, PdfMergeHandler.execute)
    
    # Poll
    for _ in range(10):
        db.refresh(merge_job)
        if merge_job.status in ["completed", "failed"]:
            break
        time.sleep(0.5)
        
    assert merge_job.status == "completed", f"Merge failed: {merge_job.error_information}"
    assert len(merge_job.output_files) == 1
    
    merged_ref = merge_job.output_files[0]
    merged_path = storage.get_local_path(merged_ref)
    with fitz.open(merged_path) as m_doc:
        assert len(m_doc) == 4, f"Expected 4 pages, got {len(m_doc)}"
    print("PASS: Merge PDF successful")
    
    print("--- Testing Split PDF (Extract) ---")
    split_extract_job = ProcessingJob(
        tool_id="pdf-split",
        input_files=[merged_ref],
        configuration={"ranges": ["1", "4"], "mode": "extract"},
        expires_at=datetime.utcnow() + timedelta(hours=1)
    )
    db.add(split_extract_job)
    db.commit()
    
    ExecutionRunner.dispatch(split_extract_job.id, PdfSplitHandler.execute)
    for _ in range(10):
        db.refresh(split_extract_job)
        if split_extract_job.status in ["completed", "failed"]:
            break
        time.sleep(0.5)
        
    assert split_extract_job.status == "completed", f"Extract failed: {split_extract_job.error_information}"
    extr_ref = split_extract_job.output_files[0]
    with fitz.open(storage.get_local_path(extr_ref)) as e_doc:
        assert len(e_doc) == 2, f"Expected 2 pages, got {len(e_doc)}"
    print("PASS: Extract PDF successful")
    
    print("--- Testing Split PDF (Split ZIP) ---")
    split_zip_job = ProcessingJob(
        tool_id="pdf-split",
        input_files=[merged_ref],
        configuration={"ranges": ["1", "2-4"], "mode": "split"},
        expires_at=datetime.utcnow() + timedelta(hours=1)
    )
    db.add(split_zip_job)
    db.commit()
    
    ExecutionRunner.dispatch(split_zip_job.id, PdfSplitHandler.execute)
    for _ in range(10):
        db.refresh(split_zip_job)
        if split_zip_job.status in ["completed", "failed"]:
            break
        time.sleep(0.5)
        
    assert split_zip_job.status == "completed", f"Split ZIP failed: {split_zip_job.error_information}"
    zip_ref = split_zip_job.output_files[0]
    zip_path = storage.get_local_path(zip_ref)
    import zipfile
    with zipfile.ZipFile(zip_path, 'r') as zf:
        assert len(zf.namelist()) == 2, f"Expected 2 PDFs in ZIP, got {len(zf.namelist())}"
    print("PASS: Split ZIP successful")
    
    print("ALL TESTS PASSED.")

if __name__ == "__main__":
    main()
