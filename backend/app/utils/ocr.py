from pathlib import Path

SUPPORTED_OCR_EXTENSIONS = {".pdf", ".jpg", ".jpeg", ".png"}


def is_image_file(path: Path) -> bool:
    return path.suffix.lower() in {".jpg", ".jpeg", ".png"}


def is_supported_ocr_file(path: Path) -> bool:
    return path.suffix.lower() in SUPPORTED_OCR_EXTENSIONS
