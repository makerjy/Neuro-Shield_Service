from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from server_fastapi.app.core.security import require_ingest_secret
from server_fastapi.app.db.session import get_db
from server_fastapi.app.schemas.central import IngestEventsResponse
from server_fastapi.app.services.ingest_service import validate_and_ingest_raw_events

router = APIRouter(tags=['central-ingest'])


@router.post('/ingest/events', response_model=IngestEventsResponse, dependencies=[Depends(require_ingest_secret)])
def ingest_events(events: list[dict[str, Any]], db: Session = Depends(get_db)) -> IngestEventsResponse:
    return validate_and_ingest_raw_events(db, events)
