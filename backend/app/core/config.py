import os
from functools import lru_cache
from pathlib import Path
from typing import Annotated, Literal

from pydantic import Field, field_validator, model_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict

# Vercel sets VERCEL=1 in every function. Its filesystem is read-only except /tmp,
# work can't continue after a response, and instances share nothing.
ON_VERCEL = os.environ.get("VERCEL") == "1"


class Settings(BaseSettings):
    app_name: str = "FileCraft"
    app_version: str = "0.1.0"
    environment: str = "development"
    database_url: str = "sqlite:///./docrename.db"
    storage_root: Path = Field(default=Path("/tmp/filecraft") if ON_VERCEL else Path("local_data"))
    # NoDecode: accept a plain comma-separated env value instead of requiring JSON.
    cors_origins: Annotated[list[str], NoDecode] = ["http://127.0.0.1:5173", "http://localhost:5173"]
    file_ttl_minutes: int = 60
    max_upload_mb: int = 50
    cleanup_interval_minutes: int = 10

    # "thread": jobs run on a background pool (long-running server).
    # "inline": jobs run inside the POST /jobs request (serverless).
    job_mode: Literal["thread", "inline"] = "inline" if ON_VERCEL else "thread"
    # "local": files under storage_root/files. "blob": Vercel Blob (needs BLOB_READ_WRITE_TOKEN).
    storage_backend: Literal["local", "blob"] = "blob" if ON_VERCEL else "local"
    blob_read_write_token: str = ""
    # Create missing tables at startup (safe to repeat). Off by default in production.
    auto_create_tables: bool = ON_VERCEL
    # Vercel Cron sends "Authorization: Bearer <CRON_SECRET>".
    cron_secret: str = ""

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    @field_validator("cors_origins", mode="before")
    @classmethod
    def assemble_cors_origins(cls, v: str | list[str]) -> list[str]:
        if isinstance(v, str) and not v.startswith("["):
            return [i.strip() for i in v.split(",") if i.strip()]
        return v

    @model_validator(mode="after")
    def validate_deployment(self) -> "Settings":
        if self.environment.lower() == "production" and (not self.database_url or "sqlite" in self.database_url):
            raise ValueError(
                "CRITICAL: Application is starting in 'production' environment "
                "but DATABASE_URL is either missing or set to SQLite. "
                "Production architecture requires PostgreSQL."
            )
        if self.storage_backend == "blob" and not self.blob_read_write_token:
            raise ValueError("STORAGE_BACKEND=blob needs BLOB_READ_WRITE_TOKEN (connect a Vercel Blob store).")
        return self

    @property
    def serverless(self) -> bool:
        return self.job_mode == "inline"

    @property
    def upload_dir(self) -> Path:
        return self.storage_root / "uploads"

    @property
    def output_dir(self) -> Path:
        return self.storage_root / "outputs"

    @property
    def temp_dir(self) -> Path:
        return self.storage_root / "tmp"

    def ensure_local_directories(self) -> None:
        self.upload_dir.mkdir(parents=True, exist_ok=True)
        self.output_dir.mkdir(parents=True, exist_ok=True)
        self.temp_dir.mkdir(parents=True, exist_ok=True)


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
