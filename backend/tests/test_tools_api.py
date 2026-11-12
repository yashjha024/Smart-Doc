"""End-to-end HTTP tests: upload -> create job -> poll -> download, using the frontend's tool ids."""
import io
import time
import zipfile

import fitz
import pytest
from PIL import Image

from tests.conftest import make_image, make_pdf


def upload(client, name: str, data: bytes) -> str:
    res = client.post("/api/files/upload", files={"file": (name, data)})
    assert res.status_code == 200, res.text
    return res.json()["file_id"]


def run_job(client, tool_id: str, refs: list[str], config: dict | None = None, timeout: float = 60) -> dict:
    res = client.post("/api/jobs", json={"tool_id": tool_id, "input_files": refs, "configuration": config or {}})
    assert res.status_code == 200, res.text
    job_id = res.json()["id"]
    deadline = time.time() + timeout
    while time.time() < deadline:
        job = client.get(f"/api/jobs/{job_id}").json()
        if job["status"] in ("completed", "failed"):
            return job
        time.sleep(0.1)
    pytest.fail(f"job {job_id} did not finish")


def download(client, ref: str) -> bytes:
    res = client.get(f"/api/files/{ref}/download")
    assert res.status_code == 200, res.text
    assert "attachment" in res.headers.get("content-disposition", "")
    return res.content


def test_upload_rejects_empty_file(client):
    res = client.post("/api/files/upload", files={"file": ("empty.pdf", b"")})
    assert res.status_code == 400


def test_download_unknown_file_is_404(client):
    assert client.get("/api/files/does-not-exist/download").status_code == 404


def test_uploaded_file_can_be_downloaded(client):
    data = make_pdf(1)
    ref = upload(client, "my file #1.pdf", data)
    assert download(client, ref) == data


def test_unknown_tool_is_rejected(client):
    ref = upload(client, "a.pdf", make_pdf(1))
    res = client.post("/api/jobs", json={"tool_id": "pdf-to-word", "input_files": [ref]})
    assert res.status_code == 400


@pytest.mark.parametrize("mode", ["low", "medium", "high"])
def test_compress_pdf(client, mode):
    data = make_pdf(2, with_image=True)
    ref = upload(client, "big.pdf", data)
    job = run_job(client, "compress-pdf", [ref], {"mode": mode})
    assert job["status"] == "completed", job["error_information"]
    out = download(client, job["output_files"][0])
    assert len(out) <= len(data)
    with fitz.open(stream=out, filetype="pdf") as doc:
        assert len(doc) == 2


def test_compress_pdf_levels_are_ordered(client):
    data = make_pdf(2, with_image=True)
    sizes = {}
    for mode in ("low", "high"):
        job = run_job(client, "compress-pdf", [upload(client, "big.pdf", data)], {"mode": mode})
        sizes[mode] = job["result_metadata"]["metrics"]["compressed_size_bytes"]
    assert sizes["high"] <= sizes["low"], sizes


@pytest.mark.parametrize("fmt,magic", [("jpg", b"\xff\xd8"), ("png", b"\x89PNG"), ("webp", b"RIFF")])
def test_pdf_to_image_single_page(client, fmt, magic):
    ref = upload(client, "one.pdf", make_pdf(1))
    job = run_job(client, "pdf-to-jpg", [ref], {"format": fmt, "dpi": 72})
    assert job["status"] == "completed", job["error_information"]
    assert download(client, job["output_files"][0]).startswith(magic)


def test_pdf_to_image_multi_page_zip_and_dpi(client):
    ref = upload(client, "three.pdf", make_pdf(3))
    job = run_job(client, "pdf-to-jpg", [ref], {"format": "png", "dpi": 72})
    assert job["status"] == "completed", job["error_information"]
    with zipfile.ZipFile(io.BytesIO(download(client, job["output_files"][0]))) as zf:
        names = zf.namelist()
        assert len(names) == 3
        img = Image.open(io.BytesIO(zf.read(names[0])))
        assert img.width == 595  # A4 (PyMuPDF default page) at 72 dpi


def test_merge_pdf(client):
    refs = [upload(client, "a.pdf", make_pdf(2)), upload(client, "b.pdf", make_pdf(3))]
    job = run_job(client, "merge-pdf", refs)
    assert job["status"] == "completed", job["error_information"]
    with fitz.open(stream=download(client, job["output_files"][0]), filetype="pdf") as doc:
        assert len(doc) == 5


def test_merge_needs_two_files(client):
    job = run_job(client, "merge-pdf", [upload(client, "a.pdf", make_pdf(1))])
    assert job["status"] == "failed"
    assert "two" in job["error_information"]


def test_split_pdf_extract(client):
    ref = upload(client, "five.pdf", make_pdf(5))
    job = run_job(client, "split-pdf", [ref], {"ranges": ["1-2", "5"], "mode": "extract"})
    assert job["status"] == "completed", job["error_information"]
    with fitz.open(stream=download(client, job["output_files"][0]), filetype="pdf") as doc:
        assert len(doc) == 3


def test_split_pdf_zip(client):
    ref = upload(client, "five.pdf", make_pdf(5))
    job = run_job(client, "split-pdf", [ref], {"ranges": ["1-2", "3-5"], "mode": "split"})
    assert job["status"] == "completed", job["error_information"]
    with zipfile.ZipFile(io.BytesIO(download(client, job["output_files"][0]))) as zf:
        assert len(zf.namelist()) == 2


def test_split_pdf_out_of_range_fails_cleanly(client):
    ref = upload(client, "two.pdf", make_pdf(2))
    job = run_job(client, "split-pdf", [ref], {"ranges": ["9"], "mode": "extract"})
    assert job["status"] == "failed"
    assert "out of bounds" in job["error_information"]


def test_image_compress(client):
    data = make_image("JPEG", (1200, 900))
    job = run_job(client, "image-compress", [upload(client, "photo.jpg", data)], {"quality": 40})
    assert job["status"] == "completed", job["error_information"]
    assert len(download(client, job["output_files"][0])) < len(data)


@pytest.mark.parametrize("src_fmt,src_name,target,magic", [
    ("PNG", "pic.png", "jpg", b"\xff\xd8"),
    ("JPEG", "pic.jpg", "webp", b"RIFF"),
    ("GIF", "pic.gif", "png", b"\x89PNG"),
    ("BMP", "pic.bmp", "webp", b"RIFF"),
])
def test_image_convert(client, src_fmt, src_name, target, magic):
    mode = "P" if src_fmt == "GIF" else "RGB"
    ref = upload(client, src_name, make_image(src_fmt, (200, 150), mode))
    job = run_job(client, "image-convert", [ref], {"target_format": target})
    assert job["status"] == "completed", job["error_information"]
    assert download(client, job["output_files"][0]).startswith(magic)


def test_bad_pdf_gives_readable_error(client):
    ref = upload(client, "fake.pdf", b"this is not a pdf")
    job = run_job(client, "pdf-to-jpg", [ref], {"format": "jpg"})
    assert job["status"] == "failed"
    assert "PDF" in job["error_information"]
