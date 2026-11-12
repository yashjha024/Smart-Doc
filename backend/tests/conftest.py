import io
import os
import sys
import tempfile
from pathlib import Path

import pytest

# Point the app at a throwaway database and storage folder before it is imported.
_TMP = Path(tempfile.mkdtemp(prefix="filecraft-tests-"))
os.environ["DATABASE_URL"] = f"sqlite:///{(_TMP / 'test.db').as_posix()}"
os.environ["STORAGE_ROOT"] = str(_TMP / "data")
os.environ["ENVIRONMENT"] = "test"

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import fitz  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from PIL import Image  # noqa: E402

from app.main import app  # noqa: E402


@pytest.fixture(scope="session")
def client():
    with TestClient(app) as c:
        yield c


def make_pdf(pages: int = 3, with_image: bool = False) -> bytes:
    doc = fitz.open()
    for i in range(pages):
        page = doc.new_page()
        page.insert_text((72, 72), f"Page {i + 1}", fontsize=24)
        if with_image:
            img = Image.effect_noise((1600, 1600), 60).convert("RGB")
            buf = io.BytesIO()
            img.save(buf, format="PNG")
            page.insert_image(fitz.Rect(72, 100, 500, 528), stream=buf.getvalue())
    data = doc.tobytes()
    doc.close()
    return data


def make_image(fmt: str = "PNG", size=(800, 600), mode="RGB") -> bytes:
    img = Image.effect_noise(size, 50).convert(mode)
    buf = io.BytesIO()
    img.save(buf, format=fmt)
    return buf.getvalue()
