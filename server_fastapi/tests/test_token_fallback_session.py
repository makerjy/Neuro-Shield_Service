from __future__ import annotations

from server_fastapi.app.services.citizen_service import get_session_from_token


def test_unknown_token_creates_fallback_session(db_session):
    token = 'legacy-stage1-token-demo'
    first = get_session_from_token(db_session, token=token, client_ip='127.0.0.1')
    second = get_session_from_token(db_session, token=token, client_ip='127.0.0.1')

    assert first['sessionId'].startswith('CS-')
    assert first['caseId'].startswith('CASE-TOKEN-')
    assert first['readOnly'] is True
    assert second['sessionId'] == first['sessionId']
