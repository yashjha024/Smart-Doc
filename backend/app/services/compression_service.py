import shutil
import subprocess
from dataclasses import dataclass
from pathlib import Path
from uuid import uuid4

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.compression_job import CompressionJob
from app.schemas.compression import CompressionMode, CompressionRequest, CompressionResult
from app.services.document_service import DocumentService
from app.utils.file_storage import get_output_path, get_upload_path
from app.utils.filename import sanitize_filename
from app.utils.pdf import bytes_to_kb, is_pdf


@dataclass(frozen=True)
class CompressionPreset:
    ghostscript_setting: str
    image_dpi: int
    jpeg_quality: int


@dataclass(frozen=True)
class CompressionCandidate:
    path: Path
    method: str
    quality_label: str


class CompressionService:
    PRESETS: dict[CompressionMode, CompressionPreset] = {
        CompressionMode.low: CompressionPreset("/screen", 96, 45),
        CompressionMode.medium: CompressionPreset("/ebook", 150, 65),
        CompressionMode.high: CompressionPreset("/printer", 220, 82),
    }

    TARGET_ATTEMPTS: tuple[tuple[str, CompressionPreset], ...] = (
        ("target_lowest", CompressionPreset("/screen", 72, 35)),
        ("target_low", CompressionPreset("/screen", 96, 45)),
        ("target_medium", CompressionPreset("/ebook", 130, 58)),
        ("target_balanced", CompressionPreset("/ebook", 150, 65)),
        ("target_high", CompressionPreset("/printer", 200, 78)),
    )

    def __init__(self, db: Session) -> None:
        self.db = db

    def compress(self, payload: CompressionRequest) -> CompressionResult:
        self._validate_request(payload)

        document = DocumentService(self.db).get_document(payload.document_id)
        source_path = get_upload_path(document.stored_filename)
        self._validate_pdf(source_path)

        original_size = source_path.stat().st_size
        job = CompressionJob(
            document_id=document.id,
            mode=payload.mode.value,
            target_size_kb=payload.target_size_kb,
            original_size_bytes=original_size,
            status="running",
        )
        self.db.add(job)
        self.db.commit()
        self.db.refresh(job)

        try:
            candidate = self._compress_to_candidate(source_path, document.stored_filename, payload)
            compressed_size = candidate.path.stat().st_size

            job.status = "complete"
            job.output_filename = candidate.path.name
            job.compressed_size_bytes = compressed_size
            self.db.add(job)
            self.db.commit()
            self.db.refresh(job)

            return self._build_result(
                job=job,
                payload=payload,
                original_size=original_size,
                compressed_size=compressed_size,
                output_filename=candidate.path.name,
                compression_backend=candidate.method,
                quality_label=candidate.quality_label,
            )
        except HTTPException:
            job.status = "failed"
            self.db.add(job)
            self.db.commit()
            raise
        except Exception as exc:
            job.status = "failed"
            self.db.add(job)
            self.db.commit()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="PDF compression failed.",
            ) from exc

    def _compress_to_candidate(
        self,
        source_path: Path,
        stored_filename: str,
        payload: CompressionRequest,
    ) -> CompressionCandidate:
        if payload.mode == CompressionMode.target_size:
            return self._compress_for_target_size(source_path, stored_filename, payload.target_size_kb or 0)

        preset = self.PRESETS[payload.mode]
        output_path = self._new_output_path(stored_filename, payload.mode.value)
        return self._run_best_available_compression(source_path, output_path, preset, payload.mode.value)

    def _compress_for_target_size(self, source_path: Path, stored_filename: str, target_size_kb: int) -> CompressionCandidate:
        target_bytes = target_size_kb * 1024
        best_candidate: CompressionCandidate | None = None
        generated_candidates: list[CompressionCandidate] = []

        for label, preset in self.TARGET_ATTEMPTS:
            output_path = self._new_output_path(stored_filename, label)
            candidate = self._run_best_available_compression(source_path, output_path, preset, label)
            generated_candidates.append(candidate)

            if best_candidate is None or candidate.path.stat().st_size < best_candidate.path.stat().st_size:
                best_candidate = candidate

            if candidate.path.stat().st_size <= target_bytes:
                self._remove_unused_candidates(generated_candidates, candidate)
                return candidate

        if best_candidate is None:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Unable to create a compressed PDF candidate.",
            )
        self._remove_unused_candidates(generated_candidates, best_candidate)
        return best_candidate

    def _run_best_available_compression(
        self,
        source_path: Path,
        output_path: Path,
        preset: CompressionPreset,
        quality_label: str,
    ) -> CompressionCandidate:
        gs_path = self._find_ghostscript()
        candidates: list[CompressionCandidate] = []
        backend_errors: list[str] = []

        if gs_path is not None:
            gs_output = output_path.with_name(f"{output_path.stem}_gs.pdf")
            try:
                self._compress_with_ghostscript(gs_path, source_path, gs_output, preset)
                if gs_output.exists() and gs_output.stat().st_size > 0:
                    candidates.append(CompressionCandidate(gs_output, "ghostscript", quality_label))
            except HTTPException as exc:
                backend_errors.append(str(exc.detail))
                if gs_output.exists():
                    gs_output.unlink()
            except Exception as exc:
                backend_errors.append(f"Ghostscript compression failed: {exc}")
                if gs_output.exists():
                    gs_output.unlink()
        else:
            backend_errors.append("Ghostscript executable was not found.")

        pymupdf_output = output_path.with_name(f"{output_path.stem}_pymupdf.pdf")
        try:
            self._compress_with_pymupdf(source_path, pymupdf_output)
            if pymupdf_output.exists() and pymupdf_output.stat().st_size > 0:
                candidates.append(CompressionCandidate(pymupdf_output, "pymupdf", quality_label))
        except HTTPException as exc:
            backend_errors.append(str(exc.detail))
            if pymupdf_output.exists():
                pymupdf_output.unlink()
        except Exception as exc:
            backend_errors.append(f"PyMuPDF compression failed: {exc}")
            if pymupdf_output.exists():
                pymupdf_output.unlink()

        if not candidates:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"No PDF compression backend produced an output file. {' '.join(backend_errors)}",
            )

        best = min(candidates, key=lambda item: item.path.stat().st_size)
        final_path = output_path
        if best.path != final_path:
            if final_path.exists():
                final_path.unlink()
            best.path.replace(final_path)

        for candidate in candidates:
            if candidate.path.exists() and candidate.path != final_path:
                candidate.path.unlink()

        return CompressionCandidate(final_path, best.method, quality_label)

    def _remove_unused_candidates(self, candidates: list[CompressionCandidate], keep: CompressionCandidate) -> None:
        for candidate in candidates:
            if candidate.path != keep.path and candidate.path.exists():
                candidate.path.unlink()

    def _compress_with_ghostscript(
        self,
        gs_path: str,
        source_path: Path,
        output_path: Path,
        preset: CompressionPreset,
    ) -> None:
        command = [
            gs_path,
            "-sDEVICE=pdfwrite",
            "-dCompatibilityLevel=1.6",
            f"-dPDFSETTINGS={preset.ghostscript_setting}",
            "-dNOPAUSE",
            "-dQUIET",
            "-dBATCH",
            "-dDetectDuplicateImages=true",
            "-dCompressFonts=true",
            "-dSubsetFonts=true",
            "-dDownsampleColorImages=true",
            f"-dColorImageResolution={preset.image_dpi}",
            "-dAutoFilterColorImages=false",
            "-dColorImageFilter=/DCTEncode",
            f"-dJPEGQ={preset.jpeg_quality}",
            "-dDownsampleGrayImages=true",
            f"-dGrayImageResolution={preset.image_dpi}",
            "-dDownsampleMonoImages=true",
            f"-dMonoImageResolution={preset.image_dpi}",
            f"-sOutputFile={output_path}",
            str(source_path),
        ]

        completed = subprocess.run(command, capture_output=True, text=True, timeout=180, check=False)
        if completed.returncode != 0:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Ghostscript compression failed.",
            )

    def _compress_with_pymupdf(self, source_path: Path, output_path: Path) -> None:
        try:
            import fitz
        except ImportError as exc:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="PyMuPDF is not installed. Install backend requirements before compressing PDFs.",
            ) from exc

        with fitz.open(source_path) as pdf:
            pdf.save(
                output_path,
                garbage=4,
                deflate=True,
                deflate_images=True,
                deflate_fonts=True,
                clean=True,
            )

    def _find_ghostscript(self) -> str | None:
        for executable in ("gswin64c", "gswin32c", "gs"):
            path = shutil.which(executable)
            if path:
                return path
        return None

    def _new_output_path(self, stored_filename: str, label: str) -> Path:
        source_stem = sanitize_filename(Path(stored_filename).stem)
        output_filename = f"{source_stem}_{label}_{uuid4().hex[:10]}.pdf"
        return get_output_path(output_filename)

    def _validate_request(self, payload: CompressionRequest) -> None:
        if payload.mode == CompressionMode.target_size and payload.target_size_kb is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="target_size_kb is required when mode is target_size.",
            )
        if payload.mode != CompressionMode.target_size and payload.target_size_kb is not None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="target_size_kb can only be used with target_size mode.",
            )

    def _validate_pdf(self, source_path: Path) -> None:
        if not source_path.exists():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Stored document file was not found.",
            )
        if not is_pdf(source_path):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="PDF compression only supports PDF files.",
            )

    def _build_result(
        self,
        job: CompressionJob,
        payload: CompressionRequest,
        original_size: int,
        compressed_size: int,
        output_filename: str,
        compression_backend: str,
        quality_label: str,
    ) -> CompressionResult:
        saved_bytes = max(original_size - compressed_size, 0)
        savings_percent = round((saved_bytes / original_size) * 100, 2) if original_size else 0.0
        compression_ratio = round(compressed_size / original_size, 4) if original_size else 0.0
        target_met = None
        if payload.mode == CompressionMode.target_size and payload.target_size_kb is not None:
            target_met = compressed_size <= payload.target_size_kb * 1024

        message = "PDF compressed successfully."
        if target_met is False:
            message = "PDF compressed, but the requested target size could not be reached."
        elif compressed_size >= original_size:
            message = "PDF processed successfully, but no smaller output could be produced."

        return CompressionResult(
            job_id=job.id,
            document_id=job.document_id,
            mode=payload.mode,
            original_size_bytes=original_size,
            original_size_kb=bytes_to_kb(original_size),
            compressed_size_bytes=compressed_size,
            compressed_size_kb=bytes_to_kb(compressed_size),
            saved_bytes=saved_bytes,
            savings_percent=savings_percent,
            compression_ratio=compression_ratio,
            target_size_kb=payload.target_size_kb,
            target_met=target_met,
            output_filename=output_filename,
            compression_backend=compression_backend,
            quality_label=quality_label,
            message=message,
        )
