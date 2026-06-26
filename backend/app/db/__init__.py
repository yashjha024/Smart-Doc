"""Compatibility wrapper for the canonical app.database package."""

from app.database import Base, SessionLocal, engine, get_db, init_db

__all__ = ["Base", "SessionLocal", "engine", "get_db", "init_db"]
