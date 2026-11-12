from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image

# Pillow raises DecompressionBombError above 2x this value, i.e. 100 megapixels.
Image.MAX_IMAGE_PIXELS = 50_000_000

from app.core.config import settings
from app.database.session import init_db
from app.routers.api import api_router


def create_app() -> FastAPI:
    app = FastAPI(
        title=settings.app_name,
        version=settings.app_version,
        docs_url="/docs",
        redoc_url="/redoc",
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
        # The frontend reads the download name from this header (cross-origin on Vercel).
        expose_headers=["Content-Disposition"],
    )

    app.include_router(api_router, prefix="/api")

    from app.services.cleanup_service import cleanup_service

    @app.on_event("startup")
    def on_startup() -> None:
        init_db()
        settings.ensure_local_directories()
        if settings.serverless:
            # No background threads: cleanup runs from Vercel Cron (/api/cron/cleanup)
            # and opportunistically during requests. Other instances may still be
            # running jobs, so never mark "processing" jobs as failed here.
            return
        from app.services.execution_runner import ExecutionRunner
        ExecutionRunner.fail_interrupted_jobs()
        cleanup_service.interval_seconds = settings.cleanup_interval_minutes * 60
        cleanup_service.start()

    @app.on_event("shutdown")
    def on_shutdown() -> None:
        cleanup_service.stop()

    return app


app = create_app()
