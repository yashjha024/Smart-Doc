from typing import Any, Dict

from sqlalchemy.orm import Session

from app.services.handlers.base import BaseHandler
from app.services.handlers.common import encode_like_source, load_input, open_image, stem_of, store_output
from app.services.job_service import JobService

RATIOS = {"1:1": (1, 1), "4:3": (4, 3), "3:2": (3, 2), "16:9": (16, 9), "4:5": (4, 5), "9:16": (9, 16)}
POSITIONS = {"center", "start", "end"}


class ImageCropHandler(BaseHandler):
    """Crops to an aspect ratio, keeping as much of the image as possible.
    position: center, start (top/left) or end (bottom/right)."""

    @classmethod
    def execute(cls, job_id: str, db: Session, **kwargs) -> Dict[str, Any]:
        job = JobService(db).get_job(job_id)
        if not job.input_files:
            raise ValueError("Please add an image to crop.")
        config = job.configuration or {}
        ratio_key = config.get("ratio", "1:1")
        if ratio_key not in RATIOS:
            raise ValueError(f"Unknown aspect ratio: {ratio_key}")
        position = config.get("position", "center")
        if position not in POSITIONS:
            position = "center"

        record, path = load_input(db, job.input_files[0])
        img = open_image(path)
        src_format = img.format
        w, h = img.size
        rw, rh = RATIOS[ratio_key]

        # Largest box with the target ratio that fits inside the image.
        if w * rh > h * rw:
            crop_w, crop_h = round(h * rw / rh), h
        else:
            crop_w, crop_h = w, round(w * rh / rw)
        crop_w, crop_h = max(1, crop_w), max(1, crop_h)

        def offset(free: int) -> int:
            return 0 if position == "start" else free if position == "end" else free // 2

        left, top = offset(w - crop_w), offset(h - crop_h)
        cropped = img.crop((left, top, left + crop_w, top + crop_h))

        data, ext, mime = encode_like_source(cropped, src_format)
        ref = store_output(db, data, f"{stem_of(record)}_{ratio_key.replace(':', 'x')}.{ext}", mime)
        return {
            "output_files": [ref],
            "metadata": {
                "configuration": {"ratio": ratio_key, "position": position},
                "tool_specific": {"original_size": [w, h], "new_size": [crop_w, crop_h], "output_format": ext},
            },
        }
