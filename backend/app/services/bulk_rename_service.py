from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.detected_identifier import DetectedIdentifier
from app.models.ocr_result import OcrResult
from app.schemas.export import BulkRenameItemResult, BulkRenameRequest, BulkRenameResult
from app.schemas.rename import RenameRequest
from app.services.document_service import DocumentService
from app.services.identifier_service import IdentifierService
from app.services.ocr_service import OcrService
from app.services.rename_service import RenameService
from app.utils.filename import find_missing_template_tokens, find_template_tokens


class BulkRenameService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.document_service = DocumentService(db)
        self.rename_service = RenameService(db)
        self.ocr_service = OcrService(db)
        self.identifier_service = IdentifierService()

    def bulk_rename(self, payload: BulkRenameRequest) -> BulkRenameResult:
        if not payload.document_ids:
            raise HTTPException(status_code=400, detail="Select at least one document.")

        template_tokens = find_template_tokens(payload.template)
        if not template_tokens:
            raise HTTPException(
                status_code=400,
                detail="Template must include at least one placeholder, e.g. {account_number}.",
            )

        results: list[BulkRenameItemResult] = []
        successful = 0
        failed = 0

        for document_id in payload.document_ids:
            result = self._rename_document(
                document_id=document_id,
                template=payload.template,
                prefix=payload.prefix,
                suffix=payload.suffix,
            )
            results.append(result)
            if result.status == "success":
                successful += 1
            else:
                failed += 1

        return BulkRenameResult(
            total=len(payload.document_ids),
            successful=successful,
            failed=failed,
            results=results,
        )

    def _rename_document(
        self,
        document_id: int,
        template: str,
        prefix: str,
        suffix: str,
    ) -> BulkRenameItemResult:
        try:
            document = self.document_service.get_document(document_id)
            values = self._resolve_template_values(document_id, template)
            missing = find_missing_template_tokens(template, values)
            if missing:
                return BulkRenameItemResult(
                    document_id=document_id,
                    original_filename=document.original_filename,
                    status="failed",
                    error=f"Missing detected values: {', '.join(missing)}",
                )

            rename_result = self.rename_service.rename(
                RenameRequest(
                    document_id=document_id,
                    template=template,
                    values=values,
                    prefix=prefix,
                    suffix=suffix,
                )
            )
            return BulkRenameItemResult(
                document_id=document_id,
                original_filename=document.original_filename,
                status="success",
                filename=rename_result.filename,
                previous_filename=rename_result.previous_filename,
                message=rename_result.message,
                detected_values=values,
            )
        except HTTPException as exc:
            detail = exc.detail if isinstance(exc.detail, str) else str(exc.detail)
            original_filename = None
            try:
                original_filename = self.document_service.get_document(document_id).original_filename
            except HTTPException:
                pass
            return BulkRenameItemResult(
                document_id=document_id,
                original_filename=original_filename,
                status="failed",
                error=detail,
            )
        except Exception as exc:
            return BulkRenameItemResult(
                document_id=document_id,
                status="failed",
                error=str(exc),
            )

    def _resolve_template_values(self, document_id: int, template: str) -> dict[str, str]:
        identifiers = self._ensure_identifiers(document_id)
        tokens = find_template_tokens(template)
        best_by_label: dict[str, str] = {}

        for identifier in sorted(identifiers, key=lambda item: item.confidence, reverse=True):
            if identifier.label not in best_by_label:
                best_by_label[identifier.label] = identifier.value

        return {token: best_by_label[token] for token in tokens if token in best_by_label}

    def _ensure_identifiers(self, document_id: int) -> list[DetectedIdentifier]:
        statement = select(DetectedIdentifier).where(DetectedIdentifier.document_id == document_id)
        identifiers = list(self.db.scalars(statement).all())
        if identifiers:
            return identifiers

        ocr_statement = (
            select(OcrResult)
            .where(OcrResult.document_id == document_id)
            .order_by(OcrResult.created_at.desc())
        )
        existing_ocr = self.db.scalar(ocr_statement)
        if existing_ocr is not None:
            return self._store_identifiers(document_id, existing_ocr.extracted_text)

        self.ocr_service.extract_for_document(document_id)
        return list(self.db.scalars(statement).all())

    def _store_identifiers(self, document_id: int, extracted_text: str) -> list[DetectedIdentifier]:
        detected = [
            DetectedIdentifier(
                document_id=document_id,
                label=identifier.label,
                display_label=identifier.display_label,
                value=identifier.value,
                confidence=identifier.confidence,
            )
            for identifier in self.identifier_service.detect(extracted_text)
        ]
        self.db.add_all(detected)
        self.db.commit()
        for identifier in detected:
            self.db.refresh(identifier)
        return detected
