from __future__ import annotations

from datetime import datetime
import logging

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from server_fastapi.app.core.security import AuthUser, get_current_user
from server_fastapi.app.db.session import get_db
from server_fastapi.app.schemas.local_center import CalendarEventCreatePayload, CalendarEventCreateResponse
from server_fastapi.app.services.local_case_service import create_calendar_event, list_calendar_events

router = APIRouter(tags=['local-calendar'])
logger = logging.getLogger(__name__)


@router.post('/api/calendar/events', response_model=CalendarEventCreateResponse)
def post_calendar_event(
    payload: CalendarEventCreatePayload,
    db: Session = Depends(get_db),
    user: AuthUser = Depends(get_current_user),
) -> CalendarEventCreateResponse:
    return create_calendar_event(db, payload, actor_name=user.user_id, actor_type='human')


@router.get('/api/local-center/calendar/events')
def get_calendar_events(
    from_at: datetime | None = Query(default=None, alias='from'),
    to_at: datetime | None = Query(default=None, alias='to'),
    assignee: str | None = Query(default=None),
    db: Session = Depends(get_db),
) -> dict:
    try:
        rows = list_calendar_events(db, from_at=from_at, to_at=to_at, assignee=assignee)
        return {'items': rows, 'total': len(rows)}
    except Exception:
        logger.exception('Calendar events fetch failed (degraded response)')
        # 데모/운영 화면 안정성을 위해 500 대신 안전 응답을 반환한다.
        return {'items': [], 'total': 0, 'degraded': True}
