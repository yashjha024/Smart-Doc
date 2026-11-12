from collections.abc import Generator

from sqlalchemy import create_engine, text
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.core.config import settings


class Base(DeclarativeBase):
    pass


database_url = settings.database_url
if database_url.startswith("postgres://"):
    # SQLAlchemy 2 only accepts the postgresql:// scheme (Supabase/Heroku hand out postgres://).
    database_url = "postgresql://" + database_url[len("postgres://"):]

engine_kwargs = {"pool_pre_ping": True}
if database_url.startswith("sqlite"):
    # Worker threads write concurrently; wait for the lock instead of failing.
    engine_kwargs["connect_args"] = {"check_same_thread": False, "timeout": 30}

engine = create_engine(database_url, **engine_kwargs)

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

    if settings.environment.lower() != "production":
        Base.metadata.create_all(bind=engine)
        if settings.database_url.startswith("sqlite"):
            _migrate_schema()
