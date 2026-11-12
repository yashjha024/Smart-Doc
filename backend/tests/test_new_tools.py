"""Phase 4 tools: resize, crop, image to PDF, zip, unzip, PDF to Word."""
import io
import tarfile
import zipfile

import fitz
import pytest
from PIL import Image

from tests.conftest import make_image, make_pdf
from tests.test_tools_api import download, run_job, upload


def image_size(data: bytes) -> tuple[int, int]:
    return Image.open(io.BytesIO(data)).size


# ─── Resize ───────────────────────────────────────────────────────────────

@pytest.mark.parametrize("config,expected", [
    ({"mode": "percent", "percent": 50}, (400, 300)),
    ({"mode": "fit", "width": 200}, (200, 150)),
    ({"mode": "fit", "width": 200, "height": 100}, (133, 100)),
    ({"mode": "exact", "width": 120, "height": 120}, (120, 120)),
])
def test_resize(client, config, expected):
    ref = upload(client, "pic.png", make_image("PNG", (800, 600)))
    job = run_job(client, "resize-image", [ref], config)
    assert job["status"] == "completed", job["error_information"]
    out = download(client, job["output_files"][0])
    assert out.startswith(b"\x89PNG")  # keeps the source format
    assert image_size(out) == expected


def test_resize_needs_a_dimension(client):
    ref = upload(client, "pic.png", make_image("PNG", (80, 60)))
    job = run_job(client, "resize-image", [ref], {"mode": "fit"})
    assert job["status"] == "failed"
    assert "width" in job["error_information"]


def test_resize_rejects_huge_result(client):
    ref = upload(client, "pic.png", make_image("PNG", (800, 600)))
    job = run_job(client, "resize-image", [ref], {"mode": "exact", "width": 50000, "height": 10})
    assert job["status"] == "failed"
    assert "limit" in job["error_information"]


# ─── Crop ─────────────────────────────────────────────────────────────────

@pytest.mark.parametrize("ratio,expected", [("1:1", (600, 600)), ("16:9", (800, 450)), ("9:16", (338, 600))])
def test_crop(client, ratio, expected):
    ref = upload(client, "photo.jpg", make_image("JPEG", (800, 600)))
    job = run_job(client, "crop-image", [ref], {"ratio": ratio, "position": "center"})
    assert job["status"] == "completed", job["error_information"]
    out = download(client, job["output_files"][0])
    assert out.startswith(b"\xff\xd8")
    assert image_size(out) == expected


def test_crop_position_start_keeps_left_edge(client):
    img = Image.new("RGB", (400, 200), "white")
    img.paste((255, 0, 0), (0, 0, 50, 200))  # red strip on the left
    buf = io.BytesIO(); img.save(buf, "PNG")
    ref = upload(client, "strip.png", buf.getvalue())
    job = run_job(client, "crop-image", [ref], {"ratio": "1:1", "position": "start"})
    out = Image.open(io.BytesIO(download(client, job["output_files"][0]))).convert("RGB")
    assert out.size == (200, 200)
    assert out.getpixel((10, 100)) == (255, 0, 0)


# ─── Image to PDF ─────────────────────────────────────────────────────────

@pytest.mark.parametrize("page_size", ["fit", "a4"])
def test_image_to_pdf(client, page_size):
    refs = [upload(client, "a.jpg", make_image("JPEG", (640, 480))), upload(client, "b.png", make_image("PNG", (300, 500)))]
    job = run_job(client, "image-to-pdf", refs, {"page_size": page_size})
    assert job["status"] == "completed", job["error_information"]
    with fitz.open(stream=download(client, job["output_files"][0]), filetype="pdf") as doc:
        assert len(doc) == 2
        if page_size == "fit":
            assert (round(doc[0].rect.width), round(doc[0].rect.height)) == (640, 480)
        else:
            assert round(doc[1].rect.width) == 595  # portrait A4 for the tall image
        assert doc[0].get_images()


# ─── Zip / Unzip ──────────────────────────────────────────────────────────

def test_zip_files_dedupes_names(client):
    refs = [upload(client, "notes.txt", b"one"), upload(client, "notes.txt", b"two"), upload(client, "a.pdf", make_pdf(1))]
    job = run_job(client, "zip-files", refs)
    assert job["status"] == "completed", job["error_information"]
    with zipfile.ZipFile(io.BytesIO(download(client, job["output_files"][0]))) as zf:
        assert sorted(zf.namelist()) == ["a.pdf", "notes (2).txt", "notes.txt"]
        assert zf.read("notes (2).txt") == b"two"


def make_zip(entries: dict[str, bytes]) -> bytes:
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        for name, data in entries.items():
            zf.writestr(name, data)
    return buf.getvalue()


def test_unzip(client):
    ref = upload(client, "bundle.zip", make_zip({"docs/readme.txt": b"hello", "../../evil.txt": b"nope", "img.png": make_image("PNG", (10, 10))}))
    job = run_job(client, "unzip-files", [ref])
    assert job["status"] == "completed", job["error_information"]
    outputs = job["result_metadata"]["tool_specific"]["outputs"]
    names = sorted(o["name"] for o in outputs)
    assert names == ["docs/readme.txt", "evil.txt", "img.png"]  # '..' stripped
    readme = next(o for o in outputs if o["name"] == "docs/readme.txt")
    assert download(client, readme["ref"]) == b"hello"
    assert len(job["output_files"]) == 3


def test_unzip_tar_gz_skips_links(client):
    buf = io.BytesIO()
    with tarfile.open(fileobj=buf, mode="w:gz") as tf:
        data = b"tar content"
        info = tarfile.TarInfo("folder/file.txt"); info.size = len(data)
        tf.addfile(info, io.BytesIO(data))
        link = tarfile.TarInfo("link"); link.type = tarfile.SYMTYPE; link.linkname = "/etc/passwd"
        tf.addfile(link)
    ref = upload(client, "bundle.tar.gz", buf.getvalue())
    job = run_job(client, "unzip-files", [ref])
    assert job["status"] == "completed", job["error_information"]
    assert [o["name"] for o in job["result_metadata"]["tool_specific"]["outputs"]] == ["folder/file.txt"]


def test_unzip_rejects_zip_bomb(client, monkeypatch):
    from app.services.handlers import archive
    monkeypatch.setattr(archive, "MAX_TOTAL_BYTES", 1000)
    ref = upload(client, "bomb.zip", make_zip({"zeros.bin": b"\0" * 5000}))
    job = run_job(client, "unzip-files", [ref])
    assert job["status"] == "failed"
    assert "over the limit" in job["error_information"]


def test_unzip_rejects_non_archive(client):
    ref = upload(client, "notes.gz", b"just text")
    job = run_job(client, "unzip-files", [ref])
    assert job["status"] == "failed"
    assert "supported" in job["error_information"]


# ─── PDF to Word ──────────────────────────────────────────────────────────

def test_pdf_to_word(client):
    ref = upload(client, "letter.pdf", make_pdf(2))
    job = run_job(client, "pdf-to-word", [ref], timeout=120)
    assert job["status"] == "completed", job["error_information"]
    out = download(client, job["output_files"][0])
    with zipfile.ZipFile(io.BytesIO(out)) as zf:  # a .docx is a zip
        xml = zf.read("word/document.xml").decode("utf-8")
    assert "Page 1" in xml and "Page 2" in xml
