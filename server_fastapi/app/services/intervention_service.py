from __future__ import annotations

import uuid
from datetime import datetime, timezone

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from server_fastapi.app.core.security import AuthUser
from server_fastapi.app.models.analytics import KpiSnapshot
from server_fastapi.app.models.control import Intervention, InterventionAction, InterventionEvidence, InterventionTarget
from server_fastapi.app.models.ingestion import EventRaw
from server_fastapi.app.schemas.central import InterventionCreateRequest
from server_fastapi.app.services.audit_service import record_audit_event


def _new_id(prefix: str) -> str:
    return f'{prefix}-{uuid.uuid4().hex[:12]}'


def validate_basis_ref(db: Session, basis_type: str, basis_ref: str) -> bool:
    if basis_type == 'KPI':
        exists = db.execute(
            select(KpiSnapshot.id).where(KpiSnapshot.kpi_id == basis_ref).limit(1)
        ).scalar_one_or_none()
        return exists is not None
    if basis_type == 'EVENT':
        exists = db.get(EventRaw, basis_ref)
        return exists is not None
    return False


def create_intervention(db: Session, user: AuthUser, payload: InterventionCreateRequest) -> Intervention:
    if not payload.basis_ref:
        raise HTTPException(status_code=422, detail='basis_ref is required')

    if not validate_basis_ref(db, payload.basis_type, payload.basis_ref):
        raise HTTPException(status_code=422, detail='basis_ref not found')

    intervention = Intervention(
        id=_new_id('INT'),
        title=payload.title,
        description=payload.description,
        status='OPEN',
        priority=payload.priority,
        basis_type=payload.basis_type,
        basis_ref=payload.basis_ref,
        due_at=payload.due_at,
        created_by=user.user_id,
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    )
    db.add(intervention)

    for org_unit_id in payload.target_org_unit_ids:
        db.add(
            InterventionTarget(
                intervention_id=intervention.id,
                target_org_unit_id=org_unit_id,
                target_level='sido',
            )
        )

    db.add(
        InterventionAction(
            id=_new_id('ACT'),
            intervention_id=intervention.id,
            action_type='INITIAL_CONTACT',
            status='PENDING',
            due_at=payload.due_at,
        )
    )

    record_audit_event(
        db,
        user,
        action='INTERVENTION_CREATED',
        entity_type='interventions',
        entity_id=intervention.id,
        before_json=None,
        after_json={
            'title': payload.title,
            'basis_type': payload.basis_type,
            'basis_ref': payload.basis_ref,
            'priority': payload.priority,
        },
        basis_ref=payload.basis_ref,
        severity='medium',
        status='resolved',
        description='Central intervention created',
    )

    db.commit()
    db.refresh(intervention)
    return intervention


def list_interventions(db: Session) -> list[Intervention]:
    return db.execute(select(Intervention).order_by(Intervention.created_at.desc())).scalars().all()


def get_intervention(db: Session, intervention_id: str) -> Intervention:
    intervention = db.get(Intervention, intervention_id)
    if not intervention:
        raise HTTPException(status_code=404, detail='intervention not found')
    return intervention


def update_intervention_status(db: Session, user: AuthUser, intervention_id: str, status: str) -> Intervention:
    intervention = get_intervention(db, intervention_id)
    before = {'status': intervention.status}
    intervention.status = status
    intervention.updated_at = datetime.now(timezone.utc)

    record_audit_event(
        db,
        user,
        action='INTERVENTION_STATUS_UPDATED',
        entity_type='interventions',
        entity_id=intervention.id,
        before_json=before,
        after_json={'status': status},
        basis_ref=intervention.basis_ref,
        severity='medium',
        status='resolved',
    )

    db.commit()
    db.refresh(intervention)
    return intervention


def update_action_status(
    db: Session,
    user: AuthUser,
    intervention_id: str,
    action_id: str,
    status: str,
) -> InterventionAction:
    action = db.get(InterventionAction, action_id)
    if not action or action.intervention_id != intervention_id:
        raise HTTPException(status_code=404, detail='action not found')

    before = {'status': action.status}
    action.status = status
    if status.upper() in {'DONE', 'COMPLETED'}:
        action.completed_at = datetime.now(timezone.utc)

    record_audit_event(
        db,
        user,
        action='INTERVENTION_ACTION_STATUS_UPDATED',
        entity_type='intervention_actions',
        entity_id=action.id,
        before_json=before,
        after_json={'status': action.status},
        severity='low',
        status='resolved',
    )

    db.commit()
    db.refresh(action)
    return action


def add_intervention_evidence(
    db: Session,
    user: AuthUser,
    intervention_id: str,
    *,
    action_id: str | None,
    file_name: str,
    s3_key: str,
) -> InterventionEvidence:
    _ = get_intervention(db, intervention_id)

    evidence = InterventionEvidence(
        id=_new_id('EVD'),
        intervention_id=intervention_id,
        action_id=action_id,
        s3_key=s3_key,
        file_name=file_name,
        uploaded_by=user.user_id,
        uploaded_at=datetime.now(timezone.utc),
    )
    db.add(evidence)

    record_audit_event(
        db,
        user,
        action='INTERVENTION_EVIDENCE_ADDED',
        entity_type='intervention_evidence',
        entity_id=evidence.id,
        before_json=None,
        after_json={'file_name': file_name, 's3_key': s3_key},
        severity='low',
        status='resolved',
    )

    db.commit()
    db.refresh(evidence)
    return evidence
