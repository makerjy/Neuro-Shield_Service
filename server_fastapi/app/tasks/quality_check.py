from __future__ import annotations

from sqlalchemy import func, select

from server_fastapi.app.core.security import AuthUser
from server_fastapi.app.db.session import SessionLocal
from server_fastapi.app.models.ingestion import EventDeadletter, EventRaw
from server_fastapi.app.services.audit_service import record_audit_event
from server_fastapi.app.tasks.celery_app import celery_app


@celery_app.task(name='server_fastapi.app.tasks.quality_check.run_quality_checks')
def run_quality_checks() -> dict:
    db = SessionLocal()
    system_user = AuthUser(user_id='system-quality', role='SYSTEM')

    try:
        deadletter_count = db.execute(select(func.count()).select_from(EventDeadletter)).scalar_one()
        raw_count = db.execute(select(func.count()).select_from(EventRaw)).scalar_one()

        issues = []
        if deadletter_count > 0:
            issues.append({'type': 'deadletter_present', 'count': int(deadletter_count)})
        if raw_count == 0:
            issues.append({'type': 'no_data', 'count': 0})

        if issues:
            record_audit_event(
                db,
                system_user,
                action='QUALITY_CHECK_ALERT',
                entity_type='quality',
                entity_id='daily-check',
                before_json=None,
                after_json={'issues': issues},
                severity='medium',
                status='pending',
                description='Automated quality check findings',
            )

        db.commit()
        return {
            'ok': True,
            'issues': issues,
            'raw_events': int(raw_count),
            'deadletters': int(deadletter_count),
        }
    finally:
        db.close()
