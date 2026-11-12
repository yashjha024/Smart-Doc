from fastapi import APIRouter

from app.routers import bulk, compression, documents, export, health, identifiers, maintenance, ocr, rename, convert, files, jobs

api_router = APIRouter()
api_router.include_router(health.router, tags=["health"])
api_router.include_router(maintenance.router, tags=["maintenance"])
api_router.include_router(files.router, prefix="/files", tags=["files"])
api_router.include_router(jobs.router, prefix="/jobs", tags=["jobs"])
api_router.include_router(documents.router, prefix="/documents", tags=["documents"])
api_router.include_router(ocr.router, prefix="/ocr", tags=["ocr"])
api_router.include_router(identifiers.router, prefix="/identifiers", tags=["identifiers"])
api_router.include_router(rename.router, prefix="/rename", tags=["rename"])
api_router.include_router(compression.router, prefix="/compression", tags=["compression"])
api_router.include_router(convert.router, prefix="/convert", tags=["convert"])
api_router.include_router(export.router, prefix="/export", tags=["export"])
api_router.include_router(bulk.router, prefix="/bulk", tags=["bulk"])
