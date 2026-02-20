from __future__ import annotations

from collections.abc import Iterator

import pytest
from sqlalchemy import create_engine, event
from sqlalchemy.orm import Session, sessionmaker

from server_fastapi.app.db.base import Base
from server_fastapi.app.models import citizen as _citizen_models  # noqa: F401
from server_fastapi.app.models import comms as _comms_models  # noqa: F401
from server_fastapi.app.models import local_center as _local_center_models  # noqa: F401


ATTACHED_SCHEMAS = ['local_center', 'citizen', 'comms', 'control', 'ingestion', 'analytics']


@pytest.fixture()
def db_session() -> Iterator[Session]:
    engine = create_engine('sqlite+pysqlite:///:memory:', future=True)

    @event.listens_for(engine, 'connect')
    def _attach_schemas(dbapi_connection, _connection_record):  # type: ignore[no-untyped-def]
        cursor = dbapi_connection.cursor()
        for schema_name in ATTACHED_SCHEMAS:
            cursor.execute(f"ATTACH DATABASE ':memory:' AS {schema_name}")
        cursor.close()

    Base.metadata.create_all(engine)
    session_local = sessionmaker(bind=engine, autocommit=False, autoflush=False)
    session = session_local()
    try:
        yield session
    finally:
        session.close()
        engine.dispose()
