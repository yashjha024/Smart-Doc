"""Vercel mode: Blob upload tokens and registration, inline jobs, cron, documents in storage."""
import base64
import hashlib
import hmac
import json
import time

import fitz
import pytest

from app.core.config import settings
from app.services import storage as storage_module
from app.services.blob_tokens import generate_client_token
from app.services.storage import LocalVolumeProvider
from tests.conftest import make_pdf
from tests.test_tools_api import download, upload

RW_TOKEN = "vercel_blob_rw_StoreAbc123_secretSecretSecret"


def test_client_token_matches_vercel_format():
    token = generate_client_token(RW_TOKEN, "0" * 32 + "_a.pdf", maximum_size_in_bytes=1000)
    assert token.startswith("vercel_blob_client_StoreAbc123_")
    sig, payload_b64 = base64.b64decode(token.split("_", 4)[4]).decode().split(".", 1)
    expected = hmac.new(RW_TOKEN.encode(), payload_b64.encode(), hashlib.sha256).hexdigest()
    assert sig == expected
    payload = json.loads(base64.b64decode(payload_b64))
    assert payload["pathname"] == "0" * 32 + "_a.pdf"
    assert payload["maximumSizeInBytes"] == 1000
    assert payload["allowOverwrite"] is False
    assert payload["validUntil"] > time.time() * 1000


def test_client_token_rejects_wrong_token():
    with pytest.raises(ValueError):
        generate_client_token("not-a-token", "x", maximum_size_in_bytes=1)


class FakeBlobProvider(LocalVolumeProvider):
    """Local files standing in for Vercel Blob, with the extra methods the blob flow uses."""
    name = "blob"

    def size(self, reference):
        return self.get_local_path(reference).stat().st_size if self.exists(reference) else None

    def read_head(self, reference, n=1024):
        return self.get(reference)[:n]


@pytest.fixture
def blob_mode(monkeypatch):
    fake = FakeBlobProvider()
    monkeypatch.setattr(settings, "storage_backend", "blob")
    monkeypatch.setattr(settings, "blob_read_write_token", RW_TOKEN)
    monkeypatch.setattr(storage_module, "_provider", fake)
    return fake


def test_upload_config_reports_mode(client, blob_mode):
    assert client.get("/api/files/upload-config").json()["mode"] == "blob"


def test_blob_token_endpoint(client, blob_mode):
    body = {"type": "blob.generate-client-token", "payload": {"pathname": "a" * 32 + "_report.pdf", "multipart": False}}
    res = client.post("/api/files/blob-token", json=body)
    assert res.status_code == 200
    assert res.json()["clientToken"].startswith("vercel_blob_client_StoreAbc123_")


@pytest.mark.parametrize("pathname", ["../evil.pdf", "folder/x.pdf", "report.pdf", "a" * 32 + "_bad name.pdf"])
def test_blob_token_rejects_bad_pathnames(client, blob_mode, pathname):
    body = {"type": "blob.generate-client-token", "payload": {"pathname": pathname}}
    assert client.post("/api/files/blob-token", json=body).status_code == 400


def test_register_blob_then_process(client, blob_mode):
    # Simulate the browser having uploaded straight to Blob.
    pdf = make_pdf(3)
    pathname = "b" * 32 + "_report.pdf"
    (blob_mode.base_dir / pathname).write_bytes(pdf)

    res = client.post("/api/files/register", json={"pathname": pathname, "filename": "report.pdf"})
    assert res.status_code == 200, res.text
    assert res.json()["file_id"] == pathname
    # Registering twice is refused.
    assert client.post("/api/files/register", json={"pathname": pathname, "filename": "report.pdf"}).status_code == 409

    job = client.post("/api/jobs", json={"tool_id": "split-pdf", "input_files": [pathname], "configuration": {"ranges": ["1"], "mode": "extract"}}).json()
    import time as _t
    for _ in range(100):
        job = client.get(f"/api/jobs/{job['id']}").json()
        if job["status"] in ("completed", "failed"):
            break
        _t.sleep(0.1)
    assert job["status"] == "completed", job["error_information"]
    with fitz.open(stream=download(client, job["output_files"][0]), filetype="pdf") as doc:
        assert len(doc) == 1


def test_register_rejects_fake_content_and_deletes_it(client, blob_mode):
    pathname = "c" * 32 + "_fake.pdf"
    (blob_mode.base_dir / pathname).write_bytes(b"not a pdf")
    res = client.post("/api/files/register", json={"pathname": pathname, "filename": "fake.pdf"})
    assert res.status_code == 400
    assert not blob_mode.exists(pathname)


def test_register_missing_blob_is_404(client, blob_mode):
    res = client.post("/api/files/register", json={"pathname": "d" * 32 + "_gone.pdf", "filename": "gone.pdf"})
    assert res.status_code == 404


def test_inline_jobs_finish_inside_the_request(client, monkeypatch):
    monkeypatch.setattr(settings, "job_mode", "inline")
    ref = upload(client, "a.pdf", make_pdf(2))
    res = client.post("/api/jobs", json={"tool_id": "pdf-to-jpg", "input_files": [ref], "configuration": {"dpi": 72}})
    assert res.status_code == 200
    assert res.json()["status"] == "completed"  # no polling needed


def test_cron_cleanup_requires_secret(client, monkeypatch):
    monkeypatch.setattr(settings, "cron_secret", "")
    assert client.get("/api/cron/cleanup").status_code == 403
    monkeypatch.setattr(settings, "cron_secret", "s3cret")
    assert client.get("/api/cron/cleanup").status_code == 401
    assert client.get("/api/cron/cleanup", headers={"Authorization": "Bearer wrong"}).status_code == 401
    res = client.get("/api/cron/cleanup", headers={"Authorization": "Bearer s3cret"})
    assert res.status_code == 200
    assert "files" in res.json()["removed"]


def test_documents_are_only_listed_by_id(client):
    ref = upload(client, "statement.pdf", make_pdf(1))
    doc = client.post("/api/documents/from-file", json={"file_id": ref}).json()
    assert client.get("/api/documents").json() == []
    listed = client.get(f"/api/documents?ids={doc['id']}").json()
    assert [d["id"] for d in listed] == [doc["id"]]


def test_rename_document_in_storage_only_changes_its_name(client):
    pdf = fitz.open(); page = pdf.new_page(); page.insert_text((72, 100), "Account Number: 50100123456789")
    ref = upload(client, "scan 1.pdf", pdf.tobytes())
    doc = client.post("/api/documents/from-file", json={"file_id": ref}).json()

    res = client.post("/api/bulk/bulk-rename", json={"document_ids": [doc["id"]], "template": "{account_number}", "prefix": "", "suffix": "", "auto_save": False}).json()
    assert res["successful"] == 1, res
    assert res["results"][0]["filename"] == "50100123456789.pdf"

    dl = client.get(f"/api/export/download/{doc['id']}")
    assert dl.status_code == 200
    assert "50100123456789.pdf" in dl.headers["content-disposition"]
    assert dl.content.startswith(b"%PDF")
