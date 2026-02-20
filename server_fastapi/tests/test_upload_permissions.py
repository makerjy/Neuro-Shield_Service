from __future__ import annotations

import pytest
from fastapi import HTTPException

from server_fastapi.app.services import storage_service
from server_fastapi.app.services.citizen_service import (
    commit_upload,
    create_upload_presign,
    get_session_from_token,
    issue_citizen_invite,
    request_otp,
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


def test_upload_presign_and_commit_enforces_session_ownership(db_session, monkeypatch):
    monkeypatch.setattr(storage_service, 'create_presigned_put_url', lambda **kwargs: 'https://example.com/upload')
    monkeypatch.setattr(storage_service, 'create_presigned_get_url', lambda **kwargs: 'https://example.com/download')

    owner_session = _activate_session(db_session, case_id='CASE-UP-001', phone='01077778888')
    other_session = _activate_session(db_session, case_id='CASE-UP-002', phone='01099990000')

    presign = create_upload_presign(
        db_session,
        session_id=owner_session,
        file_name='report.pdf',
        content_type='application/pdf',
        size_bytes=12345,
    )
    assert presign['ok'] is True

    with pytest.raises(HTTPException) as exc_info:
        commit_upload(
            db_session,
            session_id=other_session,
            upload_id=presign['uploadId'],
            metadata={'source': 'test'},
        )
    assert exc_info.value.status_code == 403
