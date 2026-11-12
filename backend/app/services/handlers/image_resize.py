from typing import Any, Dict

from PIL import Image
from sqlalchemy.orm import Session

from app.services.handlers.base import BaseHandler
from app.services.handlers.common import encode_like_source, load_input, open_image, stem_of, store_output
from app.services.job_service import JobService

MAX_SIDE = 12000


def _int(value: Any) -> int | None:
    try:
        n = int(value)
        return n if n > 0 else None
    except (TypeError, ValueError):
        return None


class ImageResizeHandler(BaseHandler):
    """Modes: percent (scale), fit (within width x height, keeps shape), exact (stretch to width x height)."""

    @classmethod
    def execute(cls, job_id: str, db: Session, **kwargs) -> Dict[str, Any]:
        job = JobService(db).get_job(job_id)
        if not job.input_files:
            raise ValueError("Please add an image to resize.")
        config = job.configuration or {}
        mode = config.get("mode", "percent")

        record, path = load_input(db, job.input_files[0])
        img = open_image(path)
        src_format = img.format
        w, h = img.size

        if mode == "percent":
            pct = _int(config.get("percent")) or 50
            if not 1 <= pct <= 400:
                raise ValueError("Scale must be between 1% and 400%.")
            new_w, new_h = max(1, round(w * pct / 100)), max(1, round(h * pct / 100))
        elif mode in ("fit", "exact"):
            tw, th = _int(config.get("width")), _int(config.get("height"))
            if not tw and not th:
                raise ValueError("Enter a width, a height, or both.")
            if mode == "exact" and tw and th:
                new_w, new_h = tw, th
            else:
                # Fit inside the box; a missing side follows the image's shape.
                scale = min(tw / w if tw else float("inf"), th / h if th else float("inf"))
                new_w, new_h = max(1, round(w * scale)), max(1, round(h * scale))
        else:
            raise ValueError(f"Unknown resize mode: {mode}")

        if new_w > MAX_SIDE or new_h > MAX_SIDE:
            raise ValueError(f"The result would be {new_w}×{new_h}px; the limit is {MAX_SIDE}px per side.")

        resized = img.resize((new_w, new_h), Image.LANCZOS)
        data, ext, mime = encode_like_source(resized, src_format)
        ref = store_output(db, data, f"{stem_of(record)}_{new_w}x{new_h}.{ext}", mime)
        return {
            "output_files": [ref],
            "metadata": {
                "configuration": {"mode": mode},
                "tool_specific": {"original_size": [w, h], "new_size": [new_w, new_h], "output_format": ext},
            },
        }
