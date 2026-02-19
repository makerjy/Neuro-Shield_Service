from __future__ import annotations

from datetime import datetime

from sqlalchemy import desc, select
from sqlalchemy.orm import Session

from server_fastapi.app.models.control import AuditEvent
from server_fastapi.app.services.audit_service import ENTITY_TYPE_BY_CHANGE_TYPE
from server_fastapi.app.services.reference_data import DRIVER_ANALYSIS, POLICY_CHANGES, QUALITY_ALERTS, UNIFIED_AUDIT


def _in_range(ts: str, range_expr: str | None) -> bool:
    if not range_expr:
        return True
    try:
        start_s, end_s = range_expr.split(',', 1)
        dt = datetime.fromisoformat(ts.replace('Z', '+00:00'))
        start = datetime.fromisoformat(start_s)
        end = datetime.fromisoformat(end_s)
        return start <= dt <= end
    except Exception:
        return True


def get_policy_changes(status: str | None, stage: str | None, range_expr: str | None) -> list[dict]:
    rows = POLICY_CHANGES
    if status:
        rows = [row for row in rows if row['status'] == status]
    if stage:
        rows = [row for row in rows if stage in row.get('title', '') or stage in row.get('description', '')]
    if range_expr:
        rows = [row for row in rows if _in_range(row['deployedAt'], range_expr)]
    return rows


def get_quality_drivers(range_expr: str | None) -> list[dict]:
    if not range_expr:
        return DRIVER_ANALYSIS
    # driver rows do not have direct timestamps; return full set for contract compatibility.
    return DRIVER_ANALYSIS


def get_quality_alerts(severity: str | None, resolved: bool | None) -> list[dict]:
    rows = QUALITY_ALERTS
    if severity:
        rows = [row for row in rows if row['severity'] == severity]
    if resolved is not None:
        rows = [row for row in rows if row['resolved'] is resolved]
    return rows


def get_unified_audit(event_type: str | None, severity: str | None, status: str | None, range_expr: str | None) -> list[dict]:
    rows = UNIFIED_AUDIT
    if event_type:
        rows = [row for row in rows if row['type'] == event_type]
    if severity:
        rows = [row for row in rows if row['severity'] == severity]
    if status:
        rows = [row for row in rows if row['status'] == status]
    if range_expr:
        rows = [row for row in rows if _in_range(row['timestamp'], range_expr)]
    return rows


def get_audit_events(
    db: Session,
    *,
    entity_type: str | None,
    entity_id: str | None,
    range_expr: str | None,
) -> list[AuditEvent]:
    query = select(AuditEvent)
    if entity_type:
        query = query.where(AuditEvent.entity_type == entity_type)
    if entity_id:
        query = query.where(AuditEvent.entity_id == entity_id)
    query = query.order_by(desc(AuditEvent.ts)).limit(500)

    rows = db.execute(query).scalars().all()

    if range_expr:
        filtered: list[AuditEvent] = []
        for row in rows:
            if _in_range(row.ts.isoformat(), range_expr):
                filtered.append(row)
        rows = filtered

    return rows


def get_audit_changes(db: Session, change_type: str | None, range_expr: str | None) -> list[AuditEvent]:
    query = select(AuditEvent)
    entity_type = ENTITY_TYPE_BY_CHANGE_TYPE.get(change_type or '', None)
    if entity_type:
        query = query.where(AuditEvent.entity_type == entity_type)

    query = query.order_by(desc(AuditEvent.ts)).limit(500)
    rows = db.execute(query).scalars().all()

    if range_expr:
        rows = [row for row in rows if _in_range(row.ts.isoformat(), range_expr)]

    return rows
