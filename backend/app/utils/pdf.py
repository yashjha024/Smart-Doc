from pathlib import Path


def is_pdf(path: Path) -> bool:
    return path.suffix.lower() == ".pdf"


def bytes_to_kb(size_bytes: int) -> float:
    return round(size_bytes / 1024, 2)
