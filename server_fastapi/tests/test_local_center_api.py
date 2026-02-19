from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import func, select

from server_fastapi.app.models.local_center import ExamResult, Followup, LocalAuditEvent, Stage2ModelRun


def test_stage1_reject_code_required(client):
    response = client.post(
        '/api/cases/LC-T-REJECT/outcomes',
        json={'outcomeType': 'REJECT', 'reject': {}},
    )
    assert response.status_code == 422


def test_stage1_no_response_required_fields(client):
    response = client.post(
        '/api/cases/LC-T-NR/outcomes',
        json={'outcomeType': 'NO_RESPONSE', 'noResponse': {'strategy': 'CALL_RETRY'}},
    )
    assert response.status_code == 422


def test_calendar_idempotency(client):
    payload = {
        'idempotencyKey': 'idem-local-001',
        'event': {
            'caseId': 'LC-T-CAL',
            'type': 'RECONTACT',
            'title': '재접촉 일정',
            'startAt': '2026-02-17T10:00:00Z',
            'durationMin': 20,
            'priority': 'NORMAL',
            'payload': {'channel': 'CALL'},
        },
    }

    res1 = client.post('/api/calendar/events', json=payload)
    res2 = client.post('/api/calendar/events', json=payload)

    assert res1.status_code == 200
    assert res2.status_code == 200
    assert res1.json()['eventId'] == res2.json()['eventId']


def test_stage2_model_gate_blocks_invalid_or_pending(client, db_session):
    case_id = 'LC-T-S2'

    client.get(f'/api/cases/{case_id}')

    db_session.add(ExamResult(id='ER-T-PENDING', case_id=case_id, status='pending', result_json={}, validated_at=None))
    db_session.add(ExamResult(id='ER-T-INVALID', case_id=case_id, status='invalid', result_json={}, validated_at=None))
    db_session.commit()

    pending_res = client.post(
        '/api/stage2/model-runs',
        json={'caseId': case_id, 'examResultId': 'ER-T-PENDING', 'modelVersion': 's2-v1', 'score': 0.61},
    )
    invalid_res = client.post(
        '/api/stage2/model-runs',
        json={'caseId': case_id, 'examResultId': 'ER-T-INVALID', 'modelVersion': 's2-v1', 'score': 0.61},
    )

    assert pending_res.status_code == 409
    assert invalid_res.status_code == 409
    assert pending_res.json()['detail']['code'] == 'EXAM_RESULT_REQUIRED'
    assert invalid_res.json()['detail']['code'] == 'EXAM_RESULT_REQUIRED'


def test_stage3_model_gate_blocks_when_prereq_missing(client):
    case_id = 'LC-T-S3'
    client.get(f'/api/cases/{case_id}')

    res = client.post('/api/stage3/model-runs', json={'caseId': case_id, 'modelVersion': 's3-v1', 'score': 0.72})

    assert res.status_code == 409
    assert res.json()['detail']['code'] == 'STAGE3_GATE_FAILED'


def test_write_apis_create_audit_events(client, db_session):
    case_id = 'LC-T-AUDIT'

    response = client.post('/api/cases/{}/outcomes'.format(case_id), json={'outcomeType': 'PROCEED'})
    assert response.status_code == 200

    db_session.add(ExamResult(id='ER-T-VALID', case_id=case_id, status='valid', result_json={'score': 70}, validated_at=datetime.now(timezone.utc)))
    db_session.commit()

    stage2 = client.post(
        '/api/stage2/model-runs',
        json={'caseId': case_id, 'examResultId': 'ER-T-VALID', 'modelVersion': 's2-v1', 'score': 0.66},
    )
    assert stage2.status_code == 200

    db_session.add(Followup(id='FU-T-1', case_id=case_id, followup_at=datetime.now(timezone.utc), status='DONE', note='1'))
    db_session.add(Followup(id='FU-T-2', case_id=case_id, followup_at=datetime.now(timezone.utc), status='DONE', note='2'))
    db_session.commit()

    stage3 = client.post('/api/stage3/model-runs', json={'caseId': case_id, 'modelVersion': 's3-v1', 'score': 0.74})
    assert stage3.status_code == 200

    support = client.post(f'/api/cases/{case_id}/support-request', json={'reason': '인력 부족', 'requester': 'tester'})
    assert support.status_code == 200

    audit_count = db_session.execute(
        select(func.count()).select_from(LocalAuditEvent).where(LocalAuditEvent.case_id == case_id)
    ).scalar_one()
    assert audit_count >= 4

    s2_run_count = db_session.execute(
        select(func.count()).select_from(Stage2ModelRun).where(Stage2ModelRun.case_id == case_id)
    ).scalar_one()
    assert s2_run_count == 1
