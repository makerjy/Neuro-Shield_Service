from __future__ import annotations

from typing import Any

from sqlalchemy.orm import Session

from server_fastapi.app.core.security import AuthUser
from server_fastapi.app.models.control import AuditEvent


ENTITY_TYPE_BY_CHANGE_TYPE = {
    'POLICY': 'policy_rules',
    'KPI': 'kpi_definitions',
    'MODEL': 'model_registry',
    'RBAC': 'roles',
    'INTERVENTION': 'interventions',
}


def record_audit_event(
    db: Session,
    user: AuthUser,
    *,
    action: str,
    entity_type: str,
    entity_id: str,
    before_json: dict[str, Any] | None,
    after_json: dict[str, Any] | None,
    severity: str = 'medium',
    status: str = 'pending',
    basis_ref: str | None = None,
    description: str | None = None,
) -> AuditEvent:
    event = AuditEvent(
        actor_id=user.user_id,
        actor_role=user.role,
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        severity=severity,
        status=status,
        before_json=before_json,
        after_json=after_json,
        basis_ref=basis_ref,
        description=description,
    )
    db.add(event)
    db.flush()
    return event
