from collections.abc import Generator

from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.core.config import settings


class Base(DeclarativeBase):
    pass


database_url = settings.database_url
if database_url.startswith("postgres://"):
    # SQLAlchemy 2 only accepts the postgresql:// scheme (Supabase/Heroku hand out postgres://).
    database_url = "postgresql://" + database_url[len("postgres://"):]

engine_kwargs = {"pool_pre_ping": True}
if settings.serverless and not database_url.startswith("sqlite"):
    # Serverless instances are short-lived and Neon scales to zero, so don't keep
    # connections around between requests (use the pooled DATABASE_URL instead).
    from sqlalchemy.pool import NullPool
    engine_kwargs = {"poolclass": NullPool}
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


# Columns added after a table was first created: (table, column, SQL type/default).
# create_all() never alters existing tables, so add them here (SQLite and Postgres).
_ADDED_COLUMNS = [
    ("documents", "export_count", "INTEGER NOT NULL DEFAULT 0"),
    ("documents", "file_ref", "VARCHAR(255)"),
]


def _migrate_schema() -> None:
    """Add columns that newer code expects to tables created by older versions."""
    inspector = inspect(engine)
    tables = set(inspector.get_table_names())
    with engine.begin() as conn:
        for table, column, ddl in _ADDED_COLUMNS:
            if table in tables and column not in {c["name"] for c in inspector.get_columns(table)}:
                conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {column} {ddl}"))


def init_db() -> None:
    from app.database import base  # noqa: F401

    if settings.environment.lower() != "production" or settings.auto_create_tables:
        Base.metadata.create_all(bind=engine)
        _migrate_schema()
