import time
import io
from PIL import Image
from datetime import datetime, timedelta

from app.database.session import SessionLocal
from app.services.storage import get_storage_provider
from app.models.file_record import FileRecord
from app.models.processing_job import ProcessingJob
from app.services.handlers.image_compress import ImageCompressionHandler
from app.services.handlers.image_convert import ImageConversionHandler
from app.services.execution_runner import ExecutionRunner

def create_dummy_image(format="JPEG", mode="RGB", size=(800, 600), color=(255, 0, 0)) -> bytes:
    img = Image.new(mode, size, color=color)
    buf = io.BytesIO()
    img.save(buf, format=format)
    return buf.getvalue()

def run_job(db, job_id, handler):
    ExecutionRunner.dispatch(job_id, handler)
    job = db.get(ProcessingJob, job_id)
    for _ in range(20):
        db.refresh(job)
        if job.status in ["completed", "failed"]:
            break
        time.sleep(0.5)
    return job

def main():
    print("--- Setting up test data ---")
    db = SessionLocal()
    storage = get_storage_provider()
    
    jpg_bytes = create_dummy_image("JPEG")
    png_bytes = create_dummy_image("PNG", mode="RGBA", color=(0, 255, 0, 128))
    
    jpg_ref = storage.put(jpg_bytes, "test_compress.jpg")
    png_ref = storage.put(png_bytes, "test_convert.png")
    
    ttl = timedelta(hours=1)
    rec1 = FileRecord(original_filename="test_compress.jpg", stored_reference=jpg_ref, mime_type="image/jpeg", size_bytes=len(jpg_bytes), expires_at=datetime.utcnow() + ttl)
    rec2 = FileRecord(original_filename="test_convert.png", stored_reference=png_ref, mime_type="image/png", size_bytes=len(png_bytes), expires_at=datetime.utcnow() + ttl)
    db.add_all([rec1, rec2])
    db.commit()
    
    print(f"Original JPG size: {len(jpg_bytes)} bytes")
    print(f"Original PNG size: {len(png_bytes)} bytes")
    
    # 1. Test JPG Compression (No target)
    print("\n--- Testing JPG Compression (Quality=50) ---")
    job1 = ProcessingJob(
        tool_id="image-compress",
        input_files=[jpg_ref],
        configuration={"quality": 50},
        expires_at=datetime.utcnow() + ttl
    )
    db.add(job1)
    db.commit()
    
    job1 = run_job(db, job1.id, ImageCompressionHandler.execute)
    assert job1.status == "completed", f"Failed: {job1.error_information}"
    meta1 = job1.result_metadata
    assert meta1 is not None
    assert meta1["metrics"]["original_size_bytes"] == len(jpg_bytes)
    assert "compressed_size_bytes" in meta1["metrics"]
    print(f"PASS: Compression complete. Metadata: {meta1['metrics']}")

    # 2. Test JPG Compression with Target Size
    print("\n--- Testing JPG Compression (Target=1KB) ---")
    # Our dummy image is tiny, let's just make target very small, it might fail or hit it depending on 800x600 pure red.
    # A solid red JPEG 800x600 is usually ~5KB at high quality.
    target_kb = 2
    job2 = ProcessingJob(
        tool_id="image-compress",
        input_files=[jpg_ref],
        configuration={"target_size_kb": target_kb},
        expires_at=datetime.utcnow() + ttl
    )
    db.add(job2)
    db.commit()
    
    job2 = run_job(db, job2.id, ImageCompressionHandler.execute)
    assert job2.status == "completed", f"Failed: {job2.error_information}"
    meta2 = job2.result_metadata
    print(f"PASS: Target compression complete. Target met: {meta2['tool_specific']['target_met']}, Size: {meta2['metrics']['compressed_size_bytes']}")
    
    # 3. Test PNG to JPEG Conversion (RGBA -> RGB check)
    print("\n--- Testing PNG (RGBA) to JPEG Conversion ---")
    job3 = ProcessingJob(
        tool_id="image-convert",
        input_files=[png_ref],
        configuration={"target_format": "JPG"},
        expires_at=datetime.utcnow() + ttl
    )
    db.add(job3)
    db.commit()
    
    job3 = run_job(db, job3.id, ImageConversionHandler.execute)
    assert job3.status == "completed", f"Failed: {job3.error_information}"
    out_ref = job3.output_files[0]
    out_path = storage.get_local_path(out_ref)
    
    # Verify converted image format
    with Image.open(out_path) as verify_img:
        assert verify_img.format == "JPEG"
        assert verify_img.mode == "RGB"
    print("PASS: Converted PNG with Alpha to JPEG successfully.")
    
    print("\nALL IMAGE TESTS PASSED.")

if __name__ == "__main__":
    main()
