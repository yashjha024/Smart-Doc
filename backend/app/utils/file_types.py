"""Checks that an uploaded file's content matches its extension."""
from pathlib import Path

# extension -> predicate on the first bytes of the file
_SIGNATURES = {
    ".pdf": lambda h: b"%PDF-" in h[:1024],
    ".jpg": lambda h: h.startswith(b"\xff\xd8\xff"),
    ".jpeg": lambda h: h.startswith(b"\xff\xd8\xff"),
    ".png": lambda h: h.startswith(b"\x89PNG\r\n\x1a\n"),
    ".gif": lambda h: h[:6] in (b"GIF87a", b"GIF89a"),
    ".webp": lambda h: h[:4] == b"RIFF" and h[8:12] == b"WEBP",
    ".bmp": lambda h: h.startswith(b"BM"),
    ".tif": lambda h: h[:4] in (b"II*\x00", b"MM\x00*"),
    ".tiff": lambda h: h[:4] in (b"II*\x00", b"MM\x00*"),
}


def content_matches_extension(filename: str, head: bytes) -> bool:
    """True if the extension is one we know and the content matches it, or the extension is unknown."""
    check = _SIGNATURES.get(Path(filename).suffix.lower())
    return check is None or check(head)
