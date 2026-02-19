from __future__ import annotations

from sqlalchemy import func, select

from server_fastapi.app.models.ingestion import EventDeadletter, EventRaw


def _event_payload(event_id: str, payload: dict):
    return {
        'event_id': event_id,
        'event_ts': '2026-02-17T00:00:00Z',
        'producer': {
            'org_unit_id': '11',
            'level': 'sido',
            'system': 'local-center',
            'version': '1.0.0',
        },
        'region_path': {
            'nation': 'KR',
            'region': '11',
        },
        'case_key': 'case-001',
        'stage': 'S1',
        'event_type': 'CONTACT_ATTEMPTED',
        'payload': payload,
    }


def test_ingest_schema_validation(client):
    invalid = _event_payload('evt-invalid-stage', {'attempt': 1})
    invalid['stage'] = 'S9'

    response = client.post(
        '/api/central/ingest/events',
        headers={'x-ingest-secret': 'change-me'},
        json=[invalid],
    )

    assert response.status_code == 200
    body = response.json()
    assert body['accepted_count'] == 0
    assert body['rejected_count'] == 1
    assert any(reason.startswith('schema_invalid') for reason in body['rejected_reasons'])


def test_ingest_idempotency(client, db_session):
    payload = _event_payload('evt-dup-1', {'attempt': 1})

    response = client.post(
        '/api/central/ingest/events',
        headers={'x-ingest-secret': 'change-me'},
        json=[payload, payload],
    )

    assert response.status_code == 200
    body = response.json()
    assert body['accepted_count'] == 1
    assert body['duplicated_count'] == 1
    assert body['rejected_count'] == 0

    count = db_session.execute(select(func.count()).select_from(EventRaw)).scalar_one()
    assert count == 1


def test_pii_detection_to_deadletter(client, db_session):
    payload = _event_payload('evt-pii-1', {'phone': '010-1234-5678', 'memo': 'test'})

    response = client.post(
        '/api/central/ingest/events',
        headers={'x-ingest-secret': 'change-me'},
        json=[payload],
    )

    assert response.status_code == 200
    body = response.json()
    assert body['accepted_count'] == 0
    assert body['rejected_count'] == 1

    raw_count = db_session.execute(select(func.count()).select_from(EventRaw)).scalar_one()
    dead_count = db_session.execute(select(func.count()).select_from(EventDeadletter)).scalar_one()

    assert raw_count == 0
    assert dead_count == 1

    dead = db_session.execute(select(EventDeadletter).limit(1)).scalar_one()
    assert dead.reason == 'pii_detected'
    assert dead.raw_event['payload']['phone'] == '[REDACTED]'
