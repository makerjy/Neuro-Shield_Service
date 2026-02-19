from __future__ import annotations

from sqlalchemy import select

from server_fastapi.app.models.analytics import KpiSnapshot
from server_fastapi.app.schemas.central import IngestEventIn
from server_fastapi.app.services.aggregate_service import refresh_kpi_snapshots
from server_fastapi.app.services.ingest_service import validate_and_ingest_events


def _event(event_id: str, event_type: str):
    return IngestEventIn.model_validate(
        {
            'event_id': event_id,
            'event_ts': '2026-02-17T00:00:00Z',
            'producer': {
                'org_unit_id': '11',
                'level': 'sido',
                'system': 'local-center',
                'version': '1.0.0',
            },
            'region_path': {'nation': 'KR', 'region': '11'},
            'case_key': f'case-{event_id}',
            'stage': 'S1',
            'event_type': event_type,
            'payload': {'ok': True},
            'policy_version': 'v1',
            'kpi_version': 'v1',
        }
    )


def test_aggregate_no_double_count_with_duplicate_event(db_session):
    events = [
        _event('evt-aggr-1', 'CONTACT_ATTEMPTED'),
        _event('evt-aggr-1', 'CONTACT_ATTEMPTED'),
        _event('evt-aggr-2', 'CONTACT_RESULT_RECORDED'),
    ]
    ingest_result = validate_and_ingest_events(db_session, events)

    assert ingest_result.accepted_count == 2
    assert ingest_result.duplicated_count == 1

    refresh_kpi_snapshots(db_session)

    signal_row = db_session.execute(
        select(KpiSnapshot).where(
            KpiSnapshot.scope_level == 'nation',
            KpiSnapshot.scope_id == 'KR',
            KpiSnapshot.kpi_id == 'SIGNAL_QUALITY',
        )
    ).scalar_one()

    # SIGNAL_QUALITY numerator is based on valid signal events,
    # and duplicate event_id should not inflate this value.
    assert float(signal_row.numerator) == 1.0
