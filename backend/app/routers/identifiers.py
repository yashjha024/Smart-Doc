from fastapi import APIRouter

from app.schemas.identifier import (
    IdentifierDetectionRequest,
    IdentifierDetectionResponse,
    IdentifierDetectionResult,
)
from app.services.identifier_service import IdentifierService

router = APIRouter()


@router.post("/detect", response_model=IdentifierDetectionResponse)
def detect_identifiers(payload: IdentifierDetectionRequest) -> IdentifierDetectionResponse:
    service = IdentifierService()
    identifiers = [
        IdentifierDetectionResult(
            label=match.label,
            display_label=match.display_label,
            value=match.value,
            confidence=match.confidence,
        )
        for match in service.detect(payload.text)
    ]
    return IdentifierDetectionResponse(identifiers=identifiers)
