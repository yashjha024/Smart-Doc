from datetime import datetime
from pathlib import Path

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.document import Document
from app.models.rename_history import RenameHistory
from app.schemas.rename import RenamePreviewRequest, RenamePreviewResponse, RenameRequest, RenameResult
from app.services.document_service import DocumentService
from app.utils.file_storage import get_upload_path
from app.utils.filename import (
    append_duplicate_counter,
    build_filename,
    find_missing_template_tokens,
    find_template_tokens,
    sanitize_filename,
)


class RenameService:
    def __init__(self, db: Session | None = None) -> None:
        self.db = db

    def preview(self, payload: RenamePreviewRequest) -> RenamePreviewResponse:
        warnings = self._validate_template(payload.template, payload.values)
        filename = build_filename(
            template=payload.template,
            values=payload.values,
            prefix=payload.prefix,
            suffix=payload.suffix,
            extension=payload.extension,
        )
        return RenamePreviewResponse(
            filename=filename,
            is_valid=len(warnings) == 0,
            warnings=warnings,
        )

    def rename(self, payload: RenameRequest) -> RenameResult:
        if self.db is None:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Database session missing.")

        self._raise_for_missing_values(payload.template, payload.values)
        document = DocumentService(self.db).get_document(payload.document_id)
        source_path = get_upload_path(document.stored_filename)
        if not source_path.exists():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Stored document file was not found.",
            )

        requested_filename = build_filename(
            template=payload.template,
            values=payload.values,
            prefix=payload.prefix,
            suffix=payload.suffix,
            extension=source_path.suffix,
        )
        final_filename = self._resolve_duplicate_filename(
            requested_filename=requested_filename,
            document_id=document.id,
            current_filename=document.stored_filename,
        )
        target_path = get_upload_path(final_filename)

        if source_path == target_path:
            return RenameResult(
                document_id=document.id,
                filename=document.stored_filename,
                previous_filename=document.stored_filename,
                history_id=None,
                message="Filename is already up to date.",
            )

        previous_filename = document.stored_filename
        self._move_file(source_path, target_path)

        try:
            history = RenameHistory(
                document_id=document.id,
                previous_filename=previous_filename,
                new_filename=final_filename,
                template_used=self._describe_template(payload.template, payload.prefix, payload.suffix),
            )
            document.stored_filename = final_filename
            document.status = "renamed"
            self.db.add(history)
            self.db.add(document)
            self.db.commit()
            self.db.refresh(history)
        except Exception:
            self.db.rollback()
            self._move_file(target_path, source_path, best_effort=True)
            raise

        return RenameResult(
            document_id=document.id,
            filename=final_filename,
            previous_filename=previous_filename,
            history_id=history.id,
            message="Document renamed successfully.",
        )

    def undo(self, history_id: int) -> RenameResult:
        if self.db is None:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Database session missing.")

        history = self.db.get(RenameHistory, history_id)
        if history is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Rename history entry not found.",
            )
        if history.undone_at is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="This rename has already been undone.",
            )

        document = DocumentService(self.db).get_document(history.document_id)
        if document.stored_filename != history.new_filename:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Cannot undo because the document has been renamed again after this history entry.",
            )

        current_path = get_upload_path(history.new_filename)
        restore_path = get_upload_path(history.previous_filename)
        if not current_path.exists():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Current document file was not found.",
            )
        if restore_path.exists():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Cannot undo because the previous filename already exists.",
            )

        self._move_file(current_path, restore_path)

        try:
            document.stored_filename = history.previous_filename
            document.status = "rename_undone"
            history.undone_at = datetime.utcnow()
            self.db.add(document)
            self.db.add(history)
            self.db.commit()
        except Exception:
            self.db.rollback()
            self._move_file(restore_path, current_path, best_effort=True)
            raise

        return RenameResult(
            document_id=document.id,
            filename=history.previous_filename,
            previous_filename=history.new_filename,
            history_id=history.id,
            message="Rename undone successfully.",
        )

    def _validate_template(self, template: str, values: dict[str, str]) -> list[str]:
        warnings: list[str] = []
        missing = find_missing_template_tokens(template, values)
        if missing:
            warnings.append(f"Missing values for: {', '.join(missing)}")
        return warnings

    def _raise_for_missing_values(self, template: str, values: dict[str, str]) -> None:
        missing = find_missing_template_tokens(template, values)
        if missing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Missing template values: {', '.join(missing)}",
            )

    def _resolve_duplicate_filename(self, requested_filename: str, document_id: int, current_filename: str) -> str:
        candidate = sanitize_filename(Path(requested_filename).stem) + Path(requested_filename).suffix
        counter = 1
        while self._filename_exists(candidate, document_id, current_filename):
            candidate = append_duplicate_counter(requested_filename, counter)
            counter += 1
        return candidate

    def _filename_exists(self, filename: str, document_id: int, current_filename: str) -> bool:
        if self.db is None:
            return False

        if filename == current_filename:
            return False

        statement = select(Document.id).where(
            Document.stored_filename == filename,
            Document.id != document_id,
        )
        exists_in_database = self.db.scalar(statement) is not None
        exists_on_disk = get_upload_path(filename).exists()
        return exists_in_database or exists_on_disk

    def _move_file(self, source: Path, target: Path, best_effort: bool = False) -> None:
        try:
            target.parent.mkdir(parents=True, exist_ok=True)
            source.rename(target)
        except OSError as exc:
            if best_effort:
                return
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Unable to rename the document file.",
            ) from exc

    def _describe_template(self, template: str, prefix: str, suffix: str) -> str:
        parts = [f"template={template}"]
        if prefix:
            parts.append(f"prefix={prefix}")
        if suffix:
            parts.append(f"suffix={suffix}")
        return "; ".join(parts)[:255]
