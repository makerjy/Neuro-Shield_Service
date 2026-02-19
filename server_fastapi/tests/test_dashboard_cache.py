from __future__ import annotations

from datetime import date

from sqlalchemy import select

from server_fastapi.app.models.analytics import KpiSnapshot
from server_fastapi.app.services import dashboard_service


def _seed_kpi(db_session, value: float) -> None:
    for kpi_id in (
        'SIGNAL_QUALITY',
        'POLICY_IMPACT',
        'BOTTLENECK_RISK',
        'DATA_READINESS',
        'GOVERNANCE_SAFETY',
    ):
        db_session.add(
            KpiSnapshot(
                d=date(2026, 2, 17),
                scope_level='nation',
                scope_id='KR',
                kpi_id=kpi_id,
                value=value,
                numerator=value,
                denominator=100,
                delta7d=0.5,
                auxiliary_json={},
                kpi_version='v1',
                policy_version='v1',
                data_window_json={'window': 'LAST_7D'},
            )
        )
    db_session.commit()


def test_dashboard_bundle_cache_hit_miss(db_session, monkeypatch):
    _seed_kpi(db_session, 90.0)

    cache_store: dict[str, dict] = {}

    monkeypatch.setattr(dashboard_service, 'get_json', lambda key: cache_store.get(key))
    monkeypatch.setattr(dashboard_service, 'set_json', lambda key, value, ttl: cache_store.setdefault(key, value))

    first = dashboard_service.get_dashboard_bundle(
        db_session,
        window='LAST_7D',
        period_variant='default',
        scope_level='nation',
        scope_id='KR',
    )
    assert first.signalQuality.national.value == 90.0

    row = db_session.execute(
        select(KpiSnapshot).where(KpiSnapshot.kpi_id == 'SIGNAL_QUALITY')
    ).scalar_one()
    row.value = 70.0
    db_session.commit()

    second = dashboard_service.get_dashboard_bundle(
        db_session,
        window='LAST_7D',
        period_variant='default',
        scope_level='nation',
        scope_id='KR',
    )

    # Cached value should be served until cache is invalidated.
    assert second.signalQuality.national.value == 90.0
    assert len(cache_store) == 1
