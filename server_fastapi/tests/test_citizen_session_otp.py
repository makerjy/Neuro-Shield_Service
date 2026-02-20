from __future__ import annotations

from datetime import datetime, timezone

import pytest
from fastapi import HTTPException
from sqlalchemy import select

from server_fastapi.app.models.citizen import CitizenSession
from server_fastapi.app.services import citizen_service
from server_fastapi.app.services.citizen_service import get_session_from_token, issue_citizen_invite, request_otp, verify_otp


def test_invite_token_reuse_is_blocked(db_session):
    invite = issue_citizen_invite(
        db_session,
        case_id='CASE-CIT-001',
        center_id='LC-001',
        citizen_phone='01012345678',
        actor_name='tester',
    )
    token = invite['inviteToken']

    first = get_session_from_token(db_session, token=token, client_ip='127.0.0.1')
    assert first['sessionId'].startswith('CS-')
    assert first['readOnly'] is True

    second = get_session_from_token(db_session, token=token, client_ip='127.0.0.1')
    assert second['sessionId'] == first['sessionId']
    assert second['readOnly'] is True


def test_invite_token_expiry_is_enforced(db_session):
    invite = issue_citizen_invite(
        db_session,
        case_id='CASE-CIT-EXPIRED',
        center_id='LC-001',
        citizen_phone='01056785678',
        actor_name='tester',
    )
    session = db_session.execute(select(CitizenSession).where(CitizenSession.id == invite['sessionId'])).scalar_one()
    session.expires_at = session.expires_at.replace(year=2000)
    db_session.commit()

    with pytest.raises(HTTPException) as exc_info:
        get_session_from_token(db_session, token=invite['inviteToken'], client_ip='127.0.0.1')
    assert exc_info.value.status_code == 410


def test_otp_failed_attempt_lock(db_session):
    invite = issue_citizen_invite(
        db_session,
        case_id='CASE-CIT-002',
        center_id='LC-001',
        citizen_phone='01011112222',
        actor_name='tester',
    )
    resolved = get_session_from_token(db_session, token=invite['inviteToken'], client_ip='10.0.0.1')
    session_id = resolved['sessionId']

    otp_result = request_otp(
        db_session,
        session_id=session_id,
        client_ip='10.0.0.1',
        phone_number='01011112222',
    )
    assert otp_result['ok'] is True

    for _ in range(5):
        with pytest.raises(HTTPException) as exc_info:
            verify_otp(
                db_session,
                session_id=session_id,
                otp_code='000000',
                client_ip='10.0.0.1',
                phone_number='01011112222',
            )
        assert exc_info.value.status_code in (400, 423)

    with pytest.raises(HTTPException) as locked_exc:
        verify_otp(
            db_session,
            session_id=session_id,
            otp_code='000000',
            client_ip='10.0.0.1',
            phone_number='01011112222',
        )
    assert locked_exc.value.status_code == 423


def test_demo_mode_allows_booking_without_otp(db_session, monkeypatch):
    monkeypatch.setattr(citizen_service.settings, 'demo_mode', True)
    invite = issue_citizen_invite(
        db_session,
        case_id='CASE-CIT-DEMO',
        center_id='LC-001',
        citizen_phone='01033334444',
        actor_name='tester',
    )
    resolved = get_session_from_token(db_session, token=invite['inviteToken'], client_ip='127.0.0.1')
    result = citizen_service.book_appointment(
        db_session,
        session_id=resolved['sessionId'],
        appointment_at=datetime(2026, 2, 20, 10, 0, tzinfo=timezone.utc),
        organization='강남구 치매안심센터',
    )
    session = db_session.execute(select(CitizenSession).where(CitizenSession.id == resolved['sessionId'])).scalar_one()

    assert result['ok'] is True
    assert session.otp_verified_at is not None


def test_invite_url_uses_base_path(db_session, monkeypatch):
    monkeypatch.setattr(citizen_service.settings, 'base_path', '/neuro-shield/')
    invite = issue_citizen_invite(
        db_session,
        case_id='CASE-CIT-BASEPATH',
        center_id='LC-001',
        citizen_phone='01055556666',
        actor_name='tester',
    )

    assert invite['inviteUrl'].startswith('/neuro-shield/p/sms?t=')
