from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session

from server_fastapi.app.db.session import SessionLocal
from server_fastapi.app.models.local_center import ContactPlan, LocalAuditEvent
from server_fastapi.app.services.citizen_service import cleanup_expired_sessions, issue_citizen_invite, process_pending_citizen_requests, request_otp
from server_fastapi.app.services.comms_service import dispatch_due_outbox_messages
from server_fastapi.app.services.local_case_service import scan_due_schedules_and_contact_plans
from server_fastapi.app.tasks.celery_app import celery_app


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


@celery_app.task(name='server_fastapi.app.tasks.citizen_tasks.send_sms_invite')
def send_sms_invite(case_id: str, center_id: str, citizen_phone: str) -> dict:
    db = SessionLocal()
    try:
        return issue_citizen_invite(
            db,
            case_id=case_id,
            center_id=center_id,
            citizen_phone=citizen_phone,
            actor_name='worker',
        )
    finally:
        db.close()


@celery_app.task(name='server_fastapi.app.tasks.citizen_tasks.send_otp')
def send_otp(session_id: str, phone_number: str, client_ip: str | None = None) -> dict:
    db = SessionLocal()
    try:
        return request_otp(
            db,
            session_id=session_id,
            client_ip=client_ip or '127.0.0.1',
            phone_number=phone_number,
        )
    finally:
        db.close()


@celery_app.task(name='server_fastapi.app.tasks.citizen_tasks.process_citizen_submission')
def process_citizen_submission(limit: int = 200) -> dict:
    db = SessionLocal()
    try:
        return process_pending_citizen_requests(db, limit=limit)
    finally:
        db.close()


@celery_app.task(name='server_fastapi.app.tasks.citizen_tasks.generate_contact_plan')
def generate_contact_plan(case_id: str, strategy: str = 'CALL_RETRY', assignee_id: str = 'u-local-001') -> dict:
    db = SessionLocal()
    try:
        row = ContactPlan(
            id=f'CP-AUTO-{uuid.uuid4().hex[:12]}',
            case_id=case_id,
            strategy=strategy,
            next_contact_at=_utcnow() + timedelta(days=2),
            assignee_id=assignee_id,
            status='PENDING',
        )
        db.add(row)
        db.add(
            LocalAuditEvent(
                case_id=case_id,
                at=_utcnow(),
                actor_name='worker',
                actor_type='SYSTEM',
                action='CONTACT_PLAN_GENERATED',
                message='Auto-generated contact plan',
                severity='info',
                entity_type='contact_plan',
                entity_id=row.id,
            )
        )
        db.commit()
        return {'ok': True, 'contactPlanId': row.id}
    finally:
        db.close()


@celery_app.task(name='server_fastapi.app.tasks.citizen_tasks.reminders_due')
def reminders_due() -> dict:
    db = SessionLocal()
    try:
        due_items = scan_due_schedules_and_contact_plans(db)
        message_result = dispatch_due_outbox_messages(db, limit=200)
        return {**due_items, **message_result}
    finally:
        db.close()


@celery_app.task(name='server_fastapi.app.tasks.citizen_tasks.cleanup_expired_sessions')
def cleanup_expired_sessions_task() -> dict:
    db = SessionLocal()
    try:
        return cleanup_expired_sessions(db)
    finally:
        db.close()


@celery_app.task(name='server_fastapi.app.tasks.citizen_tasks.audit_compact')
def audit_compact(retain_days: int = 90) -> dict:
    db: Session = SessionLocal()
    try:
        threshold = _utcnow() - timedelta(days=retain_days)
        deleted = db.query(LocalAuditEvent).filter(LocalAuditEvent.at < threshold).delete(synchronize_session=False)
        db.commit()
        return {'deleted': int(deleted)}
    finally:
        db.close()
