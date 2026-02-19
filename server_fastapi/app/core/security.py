from __future__ import annotations

from dataclasses import dataclass

from fastapi import Header, HTTPException, status

from server_fastapi.app.core.config import get_settings


@dataclass
class AuthUser:
    user_id: str
    role: str


def require_ingest_secret(x_ingest_secret: str | None = Header(default=None)) -> None:
    settings = get_settings()
    if not x_ingest_secret or x_ingest_secret != settings.ingest_shared_secret:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail='invalid ingest secret',
        )


def get_current_user(
    x_user_id: str | None = Header(default='system', alias='X-User-Id'),
    x_user_role: str | None = Header(default='SYSTEM', alias='X-User-Role'),
) -> AuthUser:
    return AuthUser(user_id=x_user_id or 'system', role=x_user_role or 'SYSTEM')
