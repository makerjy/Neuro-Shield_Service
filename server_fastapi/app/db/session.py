from __future__ import annotations

from collections.abc import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from server_fastapi.app.core.config import get_settings

settings = get_settings()


def _normalize_database_url(url: str) -> str:
    if url.startswith('postgresql://'):
        return url.replace('postgresql://', 'postgresql+psycopg://', 1)
    return url


engine = create_engine(_normalize_database_url(settings.database_url), pool_pre_ping=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine, class_=Session)


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
