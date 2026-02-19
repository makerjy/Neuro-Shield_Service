from __future__ import annotations

from datetime import date, datetime, timezone
from statistics import mean

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from server_fastapi.app.models.analytics import KpiSnapshot
from server_fastapi.app.models.control import AuditEvent
from server_fastapi.app.models.ingestion import EventRaw
from server_fastapi.app.services.cache_service import delete_pattern

KPI_IDS = [
    'SIGNAL_QUALITY',
    'POLICY_IMPACT',
    'BOTTLENECK_RISK',
    'DATA_READINESS',
    'GOVERNANCE_SAFETY',
]


def _safe_pct(numerator: float, denominator: float) -> float:
    if denominator <= 0:
        return 0.0
    return round((numerator / denominator) * 100.0, 3)


def _snapshot_row(
    *,
    d: date,
    scope_level: str,
    scope_id: str,
    kpi_id: str,
    value: float,
    numerator: float,
    denominator: float,
    delta7d: float,
    auxiliary_json: dict | None,
    kpi_version: str,
    policy_version: str,
    window: str,
) -> dict:
    return {
        'd': d,
        'scope_level': scope_level,
        'scope_id': scope_id,
        'kpi_id': kpi_id,
        'value': value,
        'numerator': numerator,
        'denominator': denominator,
        'delta7d': delta7d,
        'auxiliary_json': auxiliary_json or {},
        'kpi_version': kpi_version,
        'policy_version': policy_version,
        'data_window_json': {'window': window},
    }


def _upsert_snapshot(db: Session, row: dict) -> None:
    existing = db.execute(
        select(KpiSnapshot).where(
            KpiSnapshot.d == row['d'],
            KpiSnapshot.scope_level == row['scope_level'],
            KpiSnapshot.scope_id == row['scope_id'],
            KpiSnapshot.kpi_id == row['kpi_id'],
        )
    ).scalar_one_or_none()

    if existing:
        existing.value = row['value']
        existing.numerator = row['numerator']
        existing.denominator = row['denominator']
        existing.delta7d = row['delta7d']
        existing.auxiliary_json = row['auxiliary_json']
        existing.kpi_version = row['kpi_version']
        existing.policy_version = row['policy_version']
        existing.data_window_json = row['data_window_json']
        existing.computed_at = datetime.now(timezone.utc)
    else:
        db.add(KpiSnapshot(**row))


def _compute_national_rows(db: Session, d: date, window: str) -> list[dict]:
    total_events = db.execute(select(func.count()).select_from(EventRaw)).scalar_one() or 0
    total_events = float(total_events)

    valid_signal_events = db.execute(
        select(func.count()).select_from(EventRaw).where(
            EventRaw.event_type.in_(
                [
                    'CONTACT_RESULT_RECORDED',
                    'EXAM_RESULT_VALIDATED',
                    'FOLLOWUP_RECORDED',
                    'CASE_STAGE_CHANGED',
                ]
            )
        )
    ).scalar_one() or 0
    signal_value = _safe_pct(float(valid_signal_events), total_events or 1.0)

    policy_events = db.execute(
        select(func.count()).select_from(AuditEvent).where(AuditEvent.entity_type == 'policy_rules')
    ).scalar_one() or 0
    policy_numerator = float(min(100, policy_events * 8 + 15))

    blocked_events = db.execute(
        select(func.count()).select_from(EventRaw).where(EventRaw.event_type.like('%BLOCKED%'))
    ).scalar_one() or 0
    bottleneck_numerator = float(min(100, blocked_events * 4 + 20))

    with_payload = db.execute(
        select(func.count()).select_from(EventRaw).where(EventRaw.payload.is_not(None))
    ).scalar_one() or 0
    data_readiness_value = _safe_pct(float(with_payload), total_events or 1.0)

    with_governance_fields = db.execute(
        select(func.count())
        .select_from(EventRaw)
        .where(EventRaw.policy_version.is_not(None), EventRaw.kpi_version.is_not(None))
    ).scalar_one() or 0
    governance_value = _safe_pct(float(with_governance_fields), total_events or 1.0)

    return [
        _snapshot_row(
            d=d,
            scope_level='nation',
            scope_id='KR',
            kpi_id='SIGNAL_QUALITY',
            value=signal_value,
            numerator=float(valid_signal_events),
            denominator=total_events or 1.0,
            delta7d=round(signal_value - 90.0, 3),
            auxiliary_json={'valid_events': valid_signal_events},
            kpi_version='v1',
            policy_version='v1',
            window=window,
        ),
        _snapshot_row(
            d=d,
            scope_level='nation',
            scope_id='KR',
            kpi_id='POLICY_IMPACT',
            value=policy_numerator,
            numerator=policy_numerator,
            denominator=100.0,
            delta7d=round(policy_numerator - 25.0, 3),
            auxiliary_json={'policy_change_count': policy_events},
            kpi_version='v1',
            policy_version='v1',
            window=window,
        ),
        _snapshot_row(
            d=d,
            scope_level='nation',
            scope_id='KR',
            kpi_id='BOTTLENECK_RISK',
            value=bottleneck_numerator,
            numerator=bottleneck_numerator,
            denominator=100.0,
            delta7d=round(bottleneck_numerator - 35.0, 3),
            auxiliary_json={'blocked_events': blocked_events},
            kpi_version='v1',
            policy_version='v1',
            window=window,
        ),
        _snapshot_row(
            d=d,
            scope_level='nation',
            scope_id='KR',
            kpi_id='DATA_READINESS',
            value=data_readiness_value,
            numerator=float(with_payload),
            denominator=total_events or 1.0,
            delta7d=round(data_readiness_value - 92.0, 3),
            auxiliary_json={'payload_filled': with_payload},
            kpi_version='v1',
            policy_version='v1',
            window=window,
        ),
        _snapshot_row(
            d=d,
            scope_level='nation',
            scope_id='KR',
            kpi_id='GOVERNANCE_SAFETY',
            value=governance_value,
            numerator=float(with_governance_fields),
            denominator=total_events or 1.0,
            delta7d=round(governance_value - 95.0, 3),
            auxiliary_json={'governed_events': with_governance_fields},
            kpi_version='v1',
            policy_version='v1',
            window=window,
        ),
    ]


def _compute_region_rows(db: Session, d: date, window: str) -> list[dict]:
    org_rows = db.execute(
        select(EventRaw.org_unit_id, func.count(EventRaw.event_id)).group_by(EventRaw.org_unit_id)
    ).all()
    if not org_rows:
        return []

    counts = [float(row[1]) for row in org_rows]
    avg_count = mean(counts)
    rows: list[dict] = []

    for org_unit_id, count in org_rows:
        count = float(count)
        signal_quality = _safe_pct(count, max(avg_count * 1.1, 1.0))
        policy_impact = min(100.0, 15.0 + count * 2.5)
        bottleneck_risk = min(100.0, 20.0 + max(0.0, avg_count - count) * 4.0)
        data_readiness = min(100.0, 70.0 + count * 2.0)
        governance_safety = min(100.0, 75.0 + count * 1.8)

        rows.extend(
            [
                _snapshot_row(
                    d=d,
                    scope_level='sido',
                    scope_id=str(org_unit_id),
                    kpi_id='SIGNAL_QUALITY',
                    value=round(signal_quality, 3),
                    numerator=count,
                    denominator=max(avg_count * 1.1, 1.0),
                    delta7d=round(signal_quality - 90.0, 3),
                    auxiliary_json=None,
                    kpi_version='v1',
                    policy_version='v1',
                    window=window,
                ),
                _snapshot_row(
                    d=d,
                    scope_level='sido',
                    scope_id=str(org_unit_id),
                    kpi_id='POLICY_IMPACT',
                    value=round(policy_impact, 3),
                    numerator=policy_impact,
                    denominator=100.0,
                    delta7d=round(policy_impact - 25.0, 3),
                    auxiliary_json=None,
                    kpi_version='v1',
                    policy_version='v1',
                    window=window,
                ),
                _snapshot_row(
                    d=d,
                    scope_level='sido',
                    scope_id=str(org_unit_id),
                    kpi_id='BOTTLENECK_RISK',
                    value=round(bottleneck_risk, 3),
                    numerator=bottleneck_risk,
                    denominator=100.0,
                    delta7d=round(bottleneck_risk - 35.0, 3),
                    auxiliary_json=None,
                    kpi_version='v1',
                    policy_version='v1',
                    window=window,
                ),
                _snapshot_row(
                    d=d,
                    scope_level='sido',
                    scope_id=str(org_unit_id),
                    kpi_id='DATA_READINESS',
                    value=round(data_readiness, 3),
                    numerator=data_readiness,
                    denominator=100.0,
                    delta7d=round(data_readiness - 90.0, 3),
                    auxiliary_json=None,
                    kpi_version='v1',
                    policy_version='v1',
                    window=window,
                ),
                _snapshot_row(
                    d=d,
                    scope_level='sido',
                    scope_id=str(org_unit_id),
                    kpi_id='GOVERNANCE_SAFETY',
                    value=round(governance_safety, 3),
                    numerator=governance_safety,
                    denominator=100.0,
                    delta7d=round(governance_safety - 95.0, 3),
                    auxiliary_json=None,
                    kpi_version='v1',
                    policy_version='v1',
                    window=window,
                ),
            ]
        )

    return rows


def refresh_kpi_snapshots(db: Session, window: str = 'LAST_7D') -> int:
    today = date.today()

    rows = _compute_national_rows(db, today, window)
    rows.extend(_compute_region_rows(db, today, window))

    for row in rows:
        _upsert_snapshot(db, row)

    db.commit()

    # Invalidate impacted scope cache keys.
    delete_pattern('dash:nation:KR:*')
    delete_pattern('dash:sido:*')
    delete_pattern('metrics:*')

    return len(rows)
