from __future__ import annotations

from collections.abc import Generator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from server_fastapi.app.db.base import Base
from server_fastapi.app.db.session import get_db
from server_fastapi.app.main import create_app
from server_fastapi.app.models import local_center  # noqa: F401


@pytest.fixture(scope='session')
def engine():
    engine = create_engine(
        'sqlite+pysqlite:///:memory:',
        connect_args={'check_same_thread': False},
        poolclass=StaticPool,
    )

    @event.listens_for(engine, 'connect')
    def _attach_schemas(dbapi_connection, _):
        cursor = dbapi_connection.cursor()
        for schema in ('control', 'ingestion', 'analytics', 'local_center'):
            try:
                cursor.execute(f"ATTACH DATABASE ':memory:' AS {schema}")
            except Exception:
                pass
        cursor.close()

    Base.metadata.create_all(engine)
    yield engine
    Base.metadata.drop_all(engine)


@pytest.fixture
def db_session(engine) -> Generator[Session, None, None]:
    TestingSessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, class_=Session)
    session = TestingSessionLocal()
    try:
        for table in reversed(Base.metadata.sorted_tables):
            session.execute(table.delete())
        session.commit()
        yield session
    finally:
        session.close()


@pytest.fixture
def client(db_session: Session) -> Generator[TestClient, None, None]:
    app = create_app()

    def _override_get_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = _override_get_db

    with TestClient(app) as test_client:
        yield test_client

    app.dependency_overrides.clear()
