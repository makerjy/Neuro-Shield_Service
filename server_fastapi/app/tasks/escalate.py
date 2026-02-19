from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import select

from server_fastapi.app.core.security import AuthUser
from server_fastapi.app.db.session import SessionLocal
from server_fastapi.app.models.control import Intervention, InterventionAction
from server_fastapi.app.services.audit_service import record_audit_event
from server_fastapi.app.tasks.celery_app import celery_app


@celery_app.task(name='server_fastapi.app.tasks.escalate.check_overdue_interventions')
def check_overdue_interventions() -> dict:
    db = SessionLocal()
    now = datetime.now(timezone.utc)
    updated = 0
    system_user = AuthUser(user_id='system-beat', role='SYSTEM')

    try:
        interventions = db.execute(
            select(Intervention).where(
                Intervention.status.in_(['OPEN', 'IN_PROGRESS']),
                Intervention.due_at.is_not(None),
                Intervention.due_at < now,
            )
        ).scalars().all()

        for row in interventions:
            before = {'status': row.status}
            row.status = 'OVERDUE'
            row.updated_at = now
            record_audit_event(
                db,
                system_user,
                action='INTERVENTION_ESCALATED',
                entity_type='interventions',
                entity_id=row.id,
                before_json=before,
                after_json={'status': row.status},
                basis_ref=row.basis_ref,
                severity='high',
                status='pending',
                description='Auto escalation by scheduler',
            )
            updated += 1

        actions = db.execute(
            select(InterventionAction).where(
                InterventionAction.status == 'PENDING',
                InterventionAction.due_at.is_not(None),
                InterventionAction.due_at < now,
            )
        ).scalars().all()

        for action in actions:
            action.status = 'OVERDUE'
            updated += 1

        db.commit()
        return {'ok': True, 'updated': updated}
    finally:
        db.close()
