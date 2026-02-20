from __future__ import annotations

from datetime import datetime, timedelta, timezone

import pytest
from fastapi import HTTPException

from server_fastapi.app.models.local_center import ExamResult, Followup
from server_fastapi.app.schemas.local_center import Stage2ModelRunCreatePayload, Stage3ModelRunCreatePayload
from server_fastapi.app.services.local_case_service import create_stage2_model_run, create_stage3_model_run, ensure_case


def test_stage2_model_run_requires_valid_exam_result(db_session):
    ensure_case(db_session, 'CASE-GATE-001')
    db_session.add(ExamResult(id='ER-GATE-001', case_id='CASE-GATE-001', status='pending'))
    db_session.commit()

    with pytest.raises(HTTPException) as exc_info:
        create_stage2_model_run(
            db_session,
            Stage2ModelRunCreatePayload(
                caseId='CASE-GATE-001',
                examResultId='ER-GATE-001',
                modelVersion='s2-v1',
                score=0.5,
            ),
            actor_name='tester',
        )
    assert exc_info.value.status_code == 409


def test_stage3_model_run_requires_valid_exam_result(db_session):
    ensure_case(db_session, 'CASE-GATE-002')
    exam = ExamResult(
        id='ER-GATE-002',
        case_id='CASE-GATE-002',
        status='valid',
        validated_by='tester',
        validated_at=datetime.now(timezone.utc),
    )
    db_session.add(exam)
    db_session.commit()

    stage2 = create_stage2_model_run(
        db_session,
        Stage2ModelRunCreatePayload(
            caseId='CASE-GATE-002',
            examResultId='ER-GATE-002',
            modelVersion='s2-v1',
            score=0.7,
        ),
        actor_name='tester',
    )
    assert stage2['ok'] is True

    db_session.add(
        Followup(
            id='FU-GATE-001',
            case_id='CASE-GATE-002',
            followup_at=datetime.now(timezone.utc) + timedelta(days=1),
            status='DONE',
            note='f1',
        )
    )
    db_session.add(
        Followup(
            id='FU-GATE-002',
            case_id='CASE-GATE-002',
            followup_at=datetime.now(timezone.utc) + timedelta(days=2),
            status='DONE',
            note='f2',
        )
    )
    exam.status = 'invalid'
    db_session.commit()

    with pytest.raises(HTTPException) as exc_info:
        create_stage3_model_run(
            db_session,
            Stage3ModelRunCreatePayload(
                caseId='CASE-GATE-002',
                modelVersion='s3-v1',
                score=0.2,
            ),
            actor_name='tester',
        )
    assert exc_info.value.status_code == 409
