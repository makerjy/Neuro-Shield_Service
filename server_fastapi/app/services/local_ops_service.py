from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone
from typing import Any

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from server_fastapi.app.models.local_center import Contact, ContactPlan, ContactResult, ExamResult, LocalAuditEvent, Schedule
from server_fastapi.app.services.citizen_service import issue_citizen_invite, list_case_citizen_submissions
from server_fastapi.app.services.local_case_service import ensure_case


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _new_id(prefix: str) -> str:
    return f'{prefix}-{uuid.uuid4().hex[:12]}'


def _append_audit(
    db: Session,
    *,
    case_id: str,
    action: str,
    message: str,
    actor_name: str,
    actor_type: str = 'HUMAN',
    before: dict[str, Any] | None = None,
    after: dict[str, Any] | None = None,
    entity_type: str = 'case',
    entity_id: str | None = None,
) -> None:
    db.add(
        LocalAuditEvent(
            case_id=case_id,
            at=_utcnow(),
            actor_name=actor_name,
            actor_type=actor_type,
            action=action,
            message=message,
            severity='info',
            before_json=before,
            after_json=after,
            entity_type=entity_type,
            entity_id=entity_id or case_id,
        )
    )


def local_issue_citizen_invite(
    db: Session,
    *,
    case_id: str,
    center_id: str,
    citizen_phone: str,
    actor_name: str,
) -> dict[str, Any]:
    return issue_citizen_invite(
        db,
        case_id=case_id,
        center_id=center_id,
        citizen_phone=citizen_phone,
        actor_name=actor_name,
    )


def local_list_citizen_submissions(db: Session, *, case_id: str) -> dict[str, Any]:
    ensure_case(db, case_id)
    return list_case_citizen_submissions(db, case_id=case_id)


def validate_exam_result(
    db: Session,
    *,
    exam_result_id: str,
    status: str,
    actor_name: str,
) -> dict[str, Any]:
    if status not in {'valid', 'invalid'}:
        raise HTTPException(status_code=422, detail='status must be valid or invalid')

    row = db.get(ExamResult, exam_result_id)
    if not row:
        raise HTTPException(status_code=404, detail='exam result not found')

    before = {'status': row.status, 'validatedBy': row.validated_by, 'validatedAt': row.validated_at.isoformat() if row.validated_at else None}
    row.status = status
    row.validated_by = actor_name
    row.validated_at = _utcnow()

    _append_audit(
        db,
        case_id=row.case_id,
        action='EXAM_RESULT_VALIDATED',
        message=f'Exam result set to {status}',
        actor_name=actor_name,
        before=before,
        after={'status': row.status, 'validatedBy': row.validated_by, 'validatedAt': row.validated_at.isoformat()},
        entity_type='exam_result',
        entity_id=row.id,
    )
    db.commit()
    return {'ok': True, 'examResultId': row.id, 'status': row.status, 'validatedBy': row.validated_by, 'validatedAt': row.validated_at.isoformat()}


def create_contact(db: Session, *, payload: dict[str, Any], actor_name: str) -> dict[str, Any]:
    case_id = payload.get('caseId') or payload.get('case_id')
    if not case_id:
        raise HTTPException(status_code=422, detail='caseId is required')
    ensure_case(db, case_id)

    row = Contact(
        id=_new_id('CNT'),
        case_id=case_id,
        channel=(payload.get('channel') or 'CALL').upper(),
        template_id=payload.get('templateId') or payload.get('template_id'),
        status='SENT' if payload.get('sentAt') else 'PENDING',
        payload_json=payload,
        created_at=_utcnow(),
    )
    db.add(row)
    _append_audit(
        db,
        case_id=case_id,
        action='CONTACT_CREATED',
        message='Local contact created',
        actor_name=actor_name,
        after={'contactId': row.id, 'channel': row.channel},
        entity_type='contact',
        entity_id=row.id,
    )
    db.commit()
    return {'ok': True, 'contactId': row.id, 'caseId': row.case_id, 'channel': row.channel, 'status': row.status}


def create_contact_result(db: Session, *, contact_id: str, payload: dict[str, Any], actor_name: str) -> dict[str, Any]:
    contact = db.get(Contact, contact_id)
    if not contact:
        raise HTTPException(status_code=404, detail='contact not found')

    outcome = payload.get('outcomeType') or payload.get('outcome_type')
    if not outcome:
        raise HTTPException(status_code=422, detail='outcomeType is required')

    row = ContactResult(
        id=_new_id('CRS'),
        contact_id=contact.id,
        case_id=contact.case_id,
        outcome_type=str(outcome),
        detail=payload.get('detail'),
        payload_json=payload,
        created_at=_utcnow(),
    )
    db.add(row)
    contact.status = 'DONE'

    if str(outcome).upper() == 'NO_RESPONSE':
        next_at = payload.get('nextContactAt') or payload.get('next_contact_at')
        if next_at:
            try:
                next_dt = datetime.fromisoformat(next_at)
            except Exception:
                next_dt = _utcnow() + timedelta(days=2)
        else:
            next_dt = _utcnow() + timedelta(days=2)
        db.add(
            ContactPlan(
                id=_new_id('CP'),
                case_id=contact.case_id,
                strategy=(payload.get('strategy') or 'CALL_RETRY'),
                next_contact_at=next_dt,
                assignee_id=payload.get('assigneeId') or payload.get('assignee_id') or 'u-local-001',
                status='PENDING',
            )
        )

    _append_audit(
        db,
        case_id=contact.case_id,
        action='CONTACT_RESULT_RECORDED',
        message=f'Contact result recorded: {outcome}',
        actor_name=actor_name,
        after={'contactId': contact.id, 'contactResultId': row.id, 'outcomeType': outcome},
        entity_type='contact_result',
        entity_id=row.id,
    )
    db.commit()
    return {'ok': True, 'contactResultId': row.id, 'contactId': contact.id, 'outcomeType': row.outcome_type}


def create_local_schedule(db: Session, *, payload: dict[str, Any], actor_name: str) -> dict[str, Any]:
    case_id = payload.get('caseId') or payload.get('case_id')
    if not case_id:
        raise HTTPException(status_code=422, detail='caseId is required')
    ensure_case(db, case_id)

    idempotency_key = payload.get('idempotencyKey') or payload.get('idempotency_key') or f'{case_id}:{payload.get("title")}:{payload.get("startAt")}'
    existing = db.execute(select(Schedule).where(Schedule.idempotency_key == idempotency_key)).scalar_one_or_none()
    if existing:
        return {'ok': True, 'scheduleId': existing.id, 'idempotent': True}

    start_raw = payload.get('startAt') or payload.get('start_at')
    if not start_raw:
        raise HTTPException(status_code=422, detail='startAt is required')
    try:
        start_at = datetime.fromisoformat(start_raw)
    except Exception as exc:
        raise HTTPException(status_code=422, detail='invalid startAt format') from exc

    row = Schedule(
        id=_new_id('CAL'),
        idempotency_key=idempotency_key,
        case_id=case_id,
        event_type=payload.get('eventType') or payload.get('event_type') or 'FOLLOWUP',
        title=payload.get('title') or '일정',
        start_at=start_at,
        duration_min=int(payload.get('durationMin') or payload.get('duration_min') or 20),
        priority=payload.get('priority') or 'NORMAL',
        assignee_id=payload.get('assigneeId') or payload.get('assignee_id'),
        payload_json=payload.get('payload') if isinstance(payload.get('payload'), dict) else payload,
        status='SCHEDULED',
        created_at=_utcnow(),
    )
    db.add(row)
    _append_audit(
        db,
        case_id=case_id,
        action='LOCAL_SCHEDULE_CREATED',
        message='Local schedule created',
        actor_name=actor_name,
        after={'scheduleId': row.id, 'eventType': row.event_type, 'startAt': row.start_at.isoformat()},
        entity_type='schedule',
        entity_id=row.id,
    )
    db.commit()
    return {'ok': True, 'scheduleId': row.id, 'idempotent': False}
