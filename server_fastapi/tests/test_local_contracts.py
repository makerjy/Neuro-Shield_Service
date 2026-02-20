from __future__ import annotations

from datetime import datetime, timedelta, timezone

import pytest
from fastapi import HTTPException

from server_fastapi.app.models.local_center import Schedule
from server_fastapi.app.schemas.local_center import CalendarEventCreatePayload, CalendarEventDraft, OutcomeSavePayload
from server_fastapi.app.services.local_case_service import create_calendar_event, ensure_case, list_calendar_events, save_stage1_outcome


def test_calendar_event_idempotency(db_session):
    start_at = datetime.now(timezone.utc) + timedelta(hours=2)
    payload = CalendarEventCreatePayload(
        idempotencyKey='case-001:outcome-001:RECONTACT:0',
        event=CalendarEventDraft(
            caseId='CASE-IDEMP-001',
            type='RECONTACT',
            title='재접촉 일정',
            startAt=start_at,
            durationMin=20,
            priority='NORMAL',
            payload={'source': 'test'},
        ),
    )

    first = create_calendar_event(db_session, payload, actor_name='tester')
    second = create_calendar_event(db_session, payload, actor_name='tester')

    assert first.ok is True
    assert first.eventId == second.eventId


def test_outcome_validation_requires_reject_code(db_session):
    with pytest.raises(HTTPException) as exc_info:
        save_stage1_outcome(
            db_session,
            'CASE-OUT-001',
            OutcomeSavePayload(
                outcomeType='REJECT',
                reject=None,
            ),
            actor_name='tester',
            actor_type='human',
        )
    assert exc_info.value.status_code == 422


def test_outcome_validation_requires_no_response_fields(db_session):
    with pytest.raises(HTTPException) as exc_info:
        save_stage1_outcome(
            db_session,
            'CASE-OUT-002',
            OutcomeSavePayload(
                outcomeType='NO_RESPONSE',
                noResponse={
                    'strategy': 'CALL_RETRY',
                    'nextContactAt': datetime.now(timezone.utc) + timedelta(days=1),
                },
            ),
            actor_name='tester',
            actor_type='human',
        )
    assert exc_info.value.status_code == 422


def test_list_calendar_events_sanitizes_non_object_payload(db_session):
    ensure_case(db_session, 'CASE-CAL-001')
    db_session.add(
        Schedule(
            id='CAL-SANITIZE-001',
            idempotency_key='CAL-SANITIZE-001',
            case_id='CASE-CAL-001',
            event_type='APPOINTMENT',
            title='시민 예약 일정',
            start_at=datetime(2026, 2, 20, 10, 0, tzinfo=timezone.utc),
            duration_min=30,
            priority='NORMAL',
            payload_json='bad-payload',
            status='SCHEDULED',
        )
    )
    db_session.commit()

    events = list_calendar_events(db_session, from_at=None, to_at=None, assignee=None)
    target = next(item for item in events if item['eventId'] == 'CAL-SANITIZE-001')

    assert target['payload'] == {}
