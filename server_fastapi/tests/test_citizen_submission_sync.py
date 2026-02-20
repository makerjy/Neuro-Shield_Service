from __future__ import annotations

from sqlalchemy import select

from server_fastapi.app.models.local_center import CaseStageState, LocalAuditEvent, WorkItem
from server_fastapi.app.services.citizen_service import (
    citizen_status,
    get_session_from_token,
    issue_citizen_invite,
    request_otp,
    submit_profile,
    verify_otp,
)


def _activate_session(db_session, case_id: str, phone: str) -> str:
    invite = issue_citizen_invite(
        db_session,
        case_id=case_id,
        center_id='LC-001',
        citizen_phone=phone,
        actor_name='tester',
    )
    resolved = get_session_from_token(db_session, token=invite['inviteToken'], client_ip='127.0.0.1')
    session_id = resolved['sessionId']
    otp = request_otp(
        db_session,
        session_id=session_id,
        client_ip='127.0.0.1',
        phone_number=phone,
    )['devOtp']
    verify_otp(
        db_session,
        session_id=session_id,
        otp_code=otp,
        client_ip='127.0.0.1',
        phone_number=phone,
    )
    return session_id


def test_citizen_profile_submission_syncs_local_and_audit(db_session):
    session_id = _activate_session(db_session, case_id='CASE-SYNC-001', phone='01033334444')
    result = submit_profile(
        db_session,
        session_id=session_id,
        profile_payload={'visitPreferredTime': 'afternoon', 'mobility': 'assisted'},
    )
    assert result['ok'] is True

    work_items = db_session.execute(
        select(WorkItem).where(WorkItem.case_id == 'CASE-SYNC-001', WorkItem.item_type == 'CITIZEN_PROFILE_REVIEW')
    ).scalars().all()
    assert len(work_items) == 1

    current_state = db_session.execute(
        select(CaseStageState).where(
            CaseStageState.case_id == 'CASE-SYNC-001',
            CaseStageState.stage == 1,
            CaseStageState.is_current.is_(True),
        )
    ).scalar_one()
    assert current_state.state == 'PROFILE_UPDATED'

    audit = db_session.execute(
        select(LocalAuditEvent)
        .where(LocalAuditEvent.case_id == 'CASE-SYNC-001', LocalAuditEvent.action == 'CITIZEN_PROFILE_SUBMITTED')
        .order_by(LocalAuditEvent.id.desc())
    ).scalar_one()
    assert audit.actor_type == 'CITIZEN'

    status = citizen_status(db_session, session_id=session_id)
    assert 'risk' not in status
    assert 'prediction' not in status
