from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from server_fastapi.app.db.session import get_db
from server_fastapi.app.schemas.central import (
    AuditEventOut,
    DriverAnalysisOut,
    PolicyChangeEventOut,
    QualityAlertOut,
    UnifiedAuditEventOut,
)
from server_fastapi.app.services.governance_service import (
    get_audit_changes,
    get_audit_events,
    get_policy_changes,
    get_quality_alerts,
    get_quality_drivers,
    get_unified_audit,
)

router = APIRouter(tags=['central-governance'])


@router.get('/policy/changes', response_model=list[PolicyChangeEventOut])
def policy_changes(
    status: str | None = Query(default=None),
    stage: str | None = Query(default=None),
    range: str | None = Query(default=None),
) -> list[PolicyChangeEventOut]:
    return [PolicyChangeEventOut.model_validate(item) for item in get_policy_changes(status, stage, range)]


@router.get('/quality/drivers', response_model=list[DriverAnalysisOut])
def quality_drivers(range: str | None = Query(default=None)) -> list[DriverAnalysisOut]:
    return [DriverAnalysisOut.model_validate(item) for item in get_quality_drivers(range)]


@router.get('/quality/alerts', response_model=list[QualityAlertOut])
def quality_alerts(
    severity: str | None = Query(default=None),
    resolved: bool | None = Query(default=None),
) -> list[QualityAlertOut]:
    return [QualityAlertOut.model_validate(item) for item in get_quality_alerts(severity, resolved)]


@router.get('/audit/unified', response_model=list[UnifiedAuditEventOut])
def audit_unified(
    type: str | None = Query(default=None),
    severity: str | None = Query(default=None),
    status: str | None = Query(default=None),
    range: str | None = Query(default=None),
) -> list[UnifiedAuditEventOut]:
    return [
        UnifiedAuditEventOut.model_validate(item)
        for item in get_unified_audit(type, severity, status, range)
    ]


@router.get('/audit/events', response_model=list[AuditEventOut])
def audit_events(
    entity_type: str | None = Query(default=None),
    entity_id: str | None = Query(default=None),
    range: str | None = Query(default=None),
    db: Session = Depends(get_db),
) -> list[AuditEventOut]:
    rows = get_audit_events(db, entity_type=entity_type, entity_id=entity_id, range_expr=range)
    return [
        AuditEventOut(
            id=row.id,
            ts=row.ts.isoformat(),
            actor_id=row.actor_id,
            actor_role=row.actor_role,
            action=row.action,
            entity_type=row.entity_type,
            entity_id=row.entity_id,
            severity=row.severity,
            status=row.status,
            before_json=row.before_json,
            after_json=row.after_json,
            basis_ref=row.basis_ref,
            description=row.description,
        )
        for row in rows
    ]


@router.get('/audit/changes', response_model=list[AuditEventOut])
def audit_changes(
    type: str | None = Query(default=None),
    range: str | None = Query(default=None),
    db: Session = Depends(get_db),
) -> list[AuditEventOut]:
    rows = get_audit_changes(db, change_type=type, range_expr=range)
    return [
        AuditEventOut(
            id=row.id,
            ts=row.ts.isoformat(),
            actor_id=row.actor_id,
            actor_role=row.actor_role,
            action=row.action,
            entity_type=row.entity_type,
            entity_id=row.entity_id,
            severity=row.severity,
            status=row.status,
            before_json=row.before_json,
            after_json=row.after_json,
            basis_ref=row.basis_ref,
            description=row.description,
        )
        for row in rows
    ]
