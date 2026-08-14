from collections.abc import Generator

from sqlalchemy import create_engine, text
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.core.config import settings


class Base(DeclarativeBase):
    pass


engine_kwargs = {}
if settings.database_url.startswith("sqlite"):
    engine_kwargs["connect_args"] = {"check_same_thread": False}

engine = create_engine(
    settings.database_url,
    **engine_kwargs
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def _migrate_schema() -> None:
    """Apply lightweight schema updates for existing SQLite databases."""
    with engine.begin() as conn:
        columns = {
            row[1]
            for row in conn.execute(text("PRAGMA table_info(documents)"))
        }
        if columns and "export_count" not in columns:
            conn.execute(
                text(
                    "ALTER TABLE documents ADD COLUMN export_count INTEGER NOT NULL DEFAULT 0"
                )
            )


def init_db() -> None:
    from app.database import base  # noqa: F401

    Base.metadata.create_all(bind=engine)
    _migrate_schema()
