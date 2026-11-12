from functools import lru_cache
from pathlib import Path

from typing import Annotated

from pydantic import Field
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "DocRename"
    app_version: str = "0.1.0"
    environment: str = "development"
    database_url: str = "sqlite:///./docrename.db"
    storage_root: Path = Field(default=Path("local_data"))
    # NoDecode: accept a plain comma-separated env value instead of requiring JSON.
    cors_origins: Annotated[list[str], NoDecode] = ["http://127.0.0.1:5173", "http://localhost:5173"]
    file_ttl_minutes: int = 60

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    from pydantic import model_validator, field_validator
    
    @field_validator("cors_origins", mode="before")
    def assemble_cors_origins(cls, v: str | list[str]) -> list[str]:
        if isinstance(v, str) and not v.startswith("["):
            return [i.strip() for i in v.split(",")]
        elif isinstance(v, list):
            return v
        return v
    @model_validator(mode='after')
    def validate_production_database(self) -> 'Settings':
        if self.environment.lower() == "production":
            if not self.database_url or "sqlite" in self.database_url:
                raise ValueError(
                    "CRITICAL: Application is starting in 'production' environment "
                    "but DATABASE_URL is either missing or set to SQLite. "
                    "Production architecture requires PostgreSQL."
                )
        return self

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
