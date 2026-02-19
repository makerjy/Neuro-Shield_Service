from __future__ import annotations

from server_fastapi.app.db.session import SessionLocal
from server_fastapi.app.schemas.central import IngestEventIn
from server_fastapi.app.services.ingest_service import validate_and_ingest_events
from server_fastapi.app.tasks.celery_app import celery_app


@celery_app.task(name='server_fastapi.app.tasks.ingest.ingest_events_batch')
def ingest_events_batch(events: list[dict]) -> dict:
    db = SessionLocal()
    try:
        payload = [IngestEventIn.model_validate(item) for item in events]
        result = validate_and_ingest_events(db, payload)
        return result.model_dump()
    finally:
        db.close()
