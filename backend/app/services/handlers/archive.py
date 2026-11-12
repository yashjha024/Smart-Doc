import io
import tarfile
import zipfile
from pathlib import PurePosixPath
from typing import Any, Dict, Iterator

from sqlalchemy.orm import Session

from app.services.handlers.base import BaseHandler
from app.services.handlers.common import load_input, stem_of, store_output
from app.services.job_service import JobService

MAX_ENTRIES = 500
MAX_TOTAL_BYTES = 500 * 1024 * 1024  # uncompressed, guards against zip bombs


class ZipHandler(BaseHandler):
    """Packs all input files into one ZIP. Duplicate names get a (2), (3)… suffix."""

    @classmethod
    def execute(cls, job_id: str, db: Session, **kwargs) -> Dict[str, Any]:
        job = JobService(db).get_job(job_id)
        if not job.input_files:
            raise ValueError("Please add files to zip.")

        buf = io.BytesIO()
        used: set[str] = set()
        with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED, compresslevel=6) as zf:
            for ref in job.input_files:
                record, path = load_input(db, ref)
                name = record.original_filename or "file"
                base, dot, ext = name.rpartition(".")
                n = 2
                while name.lower() in used:
                    name = f"{base} ({n}).{ext}" if dot else f"{ext} ({n})"
                    n += 1
                used.add(name.lower())
                zf.write(path, arcname=name)

        data = buf.getvalue()
        filename = "files.zip" if len(job.input_files) > 1 else f"{stem_of(record)}.zip"
        ref = store_output(db, data, filename, "application/zip")
        return {"output_files": [ref], "metadata": {"tool_specific": {"output_format": "zip", "file_count": len(job.input_files)}}}


class UnzipHandler(BaseHandler):
    """Extracts a ZIP or TAR (.tar, .tar.gz/.tgz, .tar.bz2) into separate downloadable files."""

    @classmethod
    def execute(cls, job_id: str, db: Session, **kwargs) -> Dict[str, Any]:
        job = JobService(db).get_job(job_id)
        if not job.input_files:
            raise ValueError("Please add an archive to extract.")
        record, path = load_input(db, job.input_files[0])

        outputs = []
        total = 0
        for name, data in cls._entries(path):
            total += len(data)
            if total > MAX_TOTAL_BYTES:
                raise ValueError("This archive unpacks to more than 500 MB, which is over the limit.")
            if len(outputs) >= MAX_ENTRIES:
                raise ValueError(f"This archive has more than {MAX_ENTRIES} files, which is over the limit.")
            display = cls._safe_display_name(name)
            ref = store_output(db, data, PurePosixPath(display).name)
            outputs.append({"ref": ref, "name": display, "size": len(data)})

        if not outputs:
            raise ValueError("This archive is empty.")
        return {
            "output_files": [o["ref"] for o in outputs],
            "metadata": {"tool_specific": {"output_format": "files", "outputs": outputs, "archive": record.original_filename}},
        }

    @staticmethod
    def _safe_display_name(name: str) -> str:
        # Only for display: drop drive letters, leading slashes and '..' parts.
        parts = [p for p in PurePosixPath(name.replace("\\", "/")).parts if p not in ("", "/", ".", "..") and not p.endswith(":")]
        return "/".join(parts) or "file"

    @staticmethod
    def _read_limited(stream, declared: int) -> bytes:
        # Never trust the declared size: read at most the overall limit + 1.
        data = stream.read(MAX_TOTAL_BYTES + 1)
        if len(data) > MAX_TOTAL_BYTES:
            raise ValueError("This archive unpacks to more than 500 MB, which is over the limit.")
        return data

    @classmethod
    def _entries(cls, path) -> Iterator[tuple[str, bytes]]:
        if zipfile.is_zipfile(path):
            try:
                with zipfile.ZipFile(path) as zf:
                    infos = [i for i in zf.infolist() if not i.is_dir()]
                    if len(infos) > MAX_ENTRIES:
                        raise ValueError(f"This archive has more than {MAX_ENTRIES} files, which is over the limit.")
                    if sum(i.file_size for i in infos) > MAX_TOTAL_BYTES:
                        raise ValueError("This archive unpacks to more than 500 MB, which is over the limit.")
                    for info in infos:
                        if info.flag_bits & 0x1:
                            raise ValueError("Password-protected ZIP files aren't supported.")
                        with zf.open(info) as f:
                            yield info.filename, cls._read_limited(f, info.file_size)
            except zipfile.BadZipFile:
                raise ValueError("This ZIP file is damaged.")
            return

        try:
            tf = tarfile.open(path, mode="r:*")
        except (tarfile.TarError, OSError):
            raise ValueError("Only ZIP and TAR archives (.zip, .tar, .tar.gz, .tgz, .tar.bz2) are supported.")
        with tf:
            members = [m for m in tf.getmembers() if m.isfile()]  # skips links, devices, dirs
            if len(members) > MAX_ENTRIES:
                raise ValueError(f"This archive has more than {MAX_ENTRIES} files, which is over the limit.")
            for m in members:
                f = tf.extractfile(m)
                if f is not None:
                    yield m.name, cls._read_limited(f, m.size)

