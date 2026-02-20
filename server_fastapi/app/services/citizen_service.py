from __future__ import annotations

import hashlib
import secrets
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any

from fastapi import HTTPException
from sqlalchemy import and_, desc, func, select
from sqlalchemy.orm import Session

from server_fastapi.app.core.config import get_settings
from server_fastapi.app.models.citizen import (
    CitizenConsent,
    CitizenConsentTemplate,
    CitizenOtpLog,
    CitizenProfileInput,
    CitizenQuestionnaireResponse,
    CitizenRequest,
    CitizenSession,
    CitizenUpload,
)
from server_fastapi.app.models.local_center import (
    Appointment,
    Attachment,
    CaseStageState,
    LocalAuditEvent,
    LocalCase,
    Schedule,
    WorkItem,
)
from server_fastapi.app.services import storage_service
from server_fastapi.app.services.comms_service import dispatch_outbox_message, enqueue_outbox, hash_value
from server_fastapi.app.services.local_case_service import ensure_case

settings = get_settings()

OTP_WINDOW_MINUTES = 10


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _as_utc(dt: datetime) -> datetime:
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def _new_id(prefix: str) -> str:
    return f'{prefix}-{uuid.uuid4().hex[:12]}'


def _build_public_invite_link(token: str) -> str:
    base = (settings.base_path or '/').strip()
    if not base.startswith('/'):
        base = f'/{base}'
    base = base.rstrip('/')
    if base in {'', '/'}:
        return f'/p/sms?t={token}'
    return f'{base}/p/sms?t={token}'


def _hash_token(token: str) -> str:
    return hashlib.sha256(token.encode('utf-8')).hexdigest()


def _hash_otp(session_id: str, otp: str) -> str:
    seed = f'{session_id}:{otp}:{settings.jwt_secret}'
    return hashlib.sha256(seed.encode('utf-8')).hexdigest()


def _hash_ip(ip: str | None) -> str | None:
    if not ip:
        return None
    return hash_value(ip)


def _lock_session(db: Session, session: CitizenSession) -> None:
    session.status = 'LOCKED'
    session.locked_at = _utcnow()
    session.updated_at = _utcnow()
    db.flush()


def _assert_session_not_expired(db: Session, session: CitizenSession) -> None:
    now = _utcnow()
    expires_at = _as_utc(session.expires_at)
    if expires_at < now:
        session.status = 'EXPIRED'
        session.updated_at = now
        db.flush()
        raise HTTPException(status_code=410, detail='session expired')
    if session.status == 'LOCKED':
        raise HTTPException(status_code=423, detail='session locked')
    if session.status == 'REVOKED':
        raise HTTPException(status_code=403, detail='session revoked')


def _load_session(db: Session, session_id: str) -> CitizenSession:
    session = db.get(CitizenSession, session_id)
    if not session:
        raise HTTPException(status_code=404, detail='citizen session not found')
    _assert_session_not_expired(db, session)
    return session


def _ensure_write_session(db: Session, session_id: str) -> CitizenSession:
    session = _load_session(db, session_id)
    if not session.otp_verified_at:
        if not settings.demo_mode:
            raise HTTPException(status_code=403, detail='otp verification required')
        now = _utcnow()
        session.status = 'ACTIVE'
        session.otp_verified_at = now
        session.used_at = session.used_at or now
        session.updated_at = now
        _append_local_audit(
            db,
            case_id=session.case_id,
            action='CITIZEN_OTP_BYPASSED',
            message='OTP bypassed in demo mode',
            actor_name='system',
            actor_type='SYSTEM',
            after={'sessionId': session.id, 'verifiedAt': now.isoformat(), 'mode': 'demo'},
            entity_type='citizen_session',
            entity_id=session.id,
        )
        db.flush()
    if session.status not in {'ACTIVE', 'PENDING'}:
        raise HTTPException(status_code=403, detail='session is not writable')
    return session


def _append_local_audit(
    db: Session,
    *,
    case_id: str,
    action: str,
    message: str,
    actor_name: str = 'citizen',
    actor_type: str = 'CITIZEN',
    before: dict[str, Any] | None = None,
    after: dict[str, Any] | None = None,
    severity: str = 'info',
    entity_type: str = 'case',
    entity_id: str | None = None,
) -> None:
    db.add(
        LocalAuditEvent(
            case_id=case_id,
            at=_utcnow(),
            actor_name=actor_name,
            actor_type=actor_type,
            action=action,
            message=message,
            severity=severity,
            entity_type=entity_type,
            entity_id=entity_id or case_id,
            before_json=before,
            after_json=after,
        )
    )


def _resolve_legacy_case_context(token: str) -> dict[str, Any]:
    try:
        from server_fastapi.app.api.routes.legacy import SMS_MESSAGE_STORE
    except Exception:
        SMS_MESSAGE_STORE = {}

    matched = next((item for item in SMS_MESSAGE_STORE.values() if item.get('token') == token), None)
    if matched:
        return {
            'case_id': str(matched.get('caseId') or ''),
            'phone': matched.get('actualTo') or matched.get('intendedTo'),
            'center_id': matched.get('centerId') or 'LC-001',
            'source': 'legacy_sms_store',
        }
    return {}


def _fallback_case_id_from_token(token: str) -> str:
    return f"CASE-TOKEN-{hashlib.sha256(token.encode('utf-8')).hexdigest()[:10].upper()}"


def _touch_stage_state(db: Session, *, case_id: str, stage: int, state: str) -> None:
    rows = db.execute(
        select(CaseStageState).where(
            CaseStageState.case_id == case_id,
            CaseStageState.stage == stage,
            CaseStageState.is_current.is_(True),
        )
    ).scalars().all()
    now = _utcnow()
    for row in rows:
        row.is_current = False
        row.exited_at = now
    db.add(
        CaseStageState(
            case_id=case_id,
            stage=stage,
            state=state,
            entered_at=now,
            is_current=True,
        )
    )


def _create_work_item(
    db: Session,
    *,
    case_id: str,
    title: str,
    item_type: str,
    payload: dict[str, Any] | None = None,
    due_days: int = 2,
) -> WorkItem:
    row = WorkItem(
        id=_new_id('WI'),
        case_id=case_id,
        title=title,
        item_type=item_type,
        status='OPEN',
        priority='P1',
        due_at=_utcnow() + timedelta(days=due_days),
        payload_json=payload,
        created_at=_utcnow(),
        updated_at=_utcnow(),
    )
    db.add(row)
    return row


def _create_citizen_request(
    db: Session,
    *,
    session_id: str,
    case_id: str,
    request_type: str,
    payload: dict[str, Any] | None = None,
    status: str = 'RECEIVED',
) -> CitizenRequest:
    row = CitizenRequest(
        id=_new_id('CRQ'),
        citizen_session_id=session_id,
        case_id=case_id,
        request_type=request_type,
        status=status,
        payload_json=payload,
        created_at=_utcnow(),
    )
    db.add(row)
    return row


def issue_citizen_invite(
    db: Session,
    *,
    case_id: str,
    center_id: str,
    citizen_phone: str,
    actor_name: str,
) -> dict[str, Any]:
    case = ensure_case(db, case_id)
    raw_token = secrets.token_urlsafe(24)
    token_hash = _hash_token(raw_token)
    expires_at = _utcnow() + timedelta(hours=settings.invite_token_ttl_hours)

    existing = db.execute(
        select(CitizenSession).where(
            CitizenSession.case_id == case_id,
            CitizenSession.status.in_(['PENDING', 'ACTIVE']),
            CitizenSession.expires_at > _utcnow(),
        )
    ).scalar_one_or_none()
    if existing:
        existing.status = 'REVOKED'
        existing.updated_at = _utcnow()

    session = CitizenSession(
        id=_new_id('CS'),
        case_id=case_id,
        invite_token_hash=token_hash,
        phone_hash=hash_value(citizen_phone),
        status='PENDING',
        expires_at=expires_at,
        metadata_json={'center_id': center_id},
        created_at=_utcnow(),
        updated_at=_utcnow(),
    )
    db.add(session)
    db.flush()

    invite_link = _build_public_invite_link(raw_token)
    outbox = enqueue_outbox(
        db,
        case_id=case.case_id,
        template_id='citizen_invite',
        to_phone=citizen_phone,
        payload={
            'case_id': case.case_id,
            'center_id': center_id,
            'citizen_phone': citizen_phone,
            'template_id': 'citizen_invite',
            'variables': {'link': invite_link},
            'dedupe_key': f'{case.case_id}:{session.id}:invite',
        },
    )
    dispatch_outbox_message(db, outbox)

    _append_local_audit(
        db,
        case_id=case.case_id,
        action='CITIZEN_INVITE_ISSUED',
        message='Citizen invite token issued',
        actor_name=actor_name,
        actor_type='HUMAN',
        after={'sessionId': session.id, 'expiresAt': expires_at.isoformat()},
        entity_type='citizen_session',
        entity_id=session.id,
    )
    db.commit()

    return {
        'ok': True,
        'sessionId': session.id,
        'inviteToken': raw_token,
        'inviteUrl': invite_link,
        'expiresAt': expires_at.isoformat(),
        'outboxStatus': outbox.status,
    }


def get_session_from_token(db: Session, token: str, client_ip: str | None = None) -> dict[str, Any]:
    token_hash = _hash_token(token)
    session = db.execute(select(CitizenSession).where(CitizenSession.invite_token_hash == token_hash)).scalar_one_or_none()
    if not session:
        context = _resolve_legacy_case_context(token)
        case_id = str(context.get('case_id') or '').strip() or _fallback_case_id_from_token(token)
        case = ensure_case(db, case_id)
        session = CitizenSession(
            id=_new_id('CS'),
            case_id=case.case_id,
            invite_token_hash=token_hash,
            phone_hash=hash_value(context['phone']) if context.get('phone') else None,
            status='PENDING',
            expires_at=_utcnow() + timedelta(hours=settings.invite_token_ttl_hours),
            metadata_json={'center_id': context.get('center_id') or 'LC-001', 'source': context.get('source') or 'token_fallback'},
            created_at=_utcnow(),
            updated_at=_utcnow(),
        )
        db.add(session)
        db.flush()

    _assert_session_not_expired(db, session)

    case = ensure_case(db, session.case_id)
    session.updated_at = _utcnow()
    metadata = dict(session.metadata_json or {})
    metadata['last_ip_hash'] = _hash_ip(client_ip)
    metadata['reuse_count'] = int(metadata.get('reuse_count') or 0) + 1
    session.metadata_json = metadata
    if not session.used_at:
        session.used_at = _utcnow()
    db.commit()

    return {
        'sessionId': session.id,
        'caseId': case.case_id,
        'caseKey': case.case_key,
        'status': session.status,
        'otpVerified': bool(session.otp_verified_at),
        'readOnly': not bool(session.otp_verified_at),
        'expiresAt': session.expires_at.isoformat(),
        'centerId': (session.metadata_json or {}).get('center_id'),
    }


def _failed_otp_count(
    db: Session,
    *,
    session_id: str,
    ip_hash: str | None,
    phone_hash: str | None,
) -> int:
    from_at = _utcnow() - timedelta(minutes=OTP_WINDOW_MINUTES)
    query = select(func.count()).select_from(CitizenOtpLog).where(
        CitizenOtpLog.citizen_session_id == session_id,
        CitizenOtpLog.status == 'FAILED',
        CitizenOtpLog.requested_at >= from_at,
    )
    if ip_hash:
        query = query.where(CitizenOtpLog.ip_hash == ip_hash)
    if phone_hash:
        query = query.where(CitizenOtpLog.phone_hash == phone_hash)
    return int(db.execute(query).scalar_one() or 0)


def request_otp(
    db: Session,
    *,
    session_id: str,
    client_ip: str | None,
    phone_number: str,
) -> dict[str, Any]:
    session = _load_session(db, session_id)
    ip_hash = _hash_ip(client_ip)
    phone_hash = hash_value(phone_number)
    failed_count = _failed_otp_count(db, session_id=session.id, ip_hash=ip_hash, phone_hash=phone_hash)
    if failed_count >= settings.otp_max_attempts:
        _lock_session(db, session)
        db.commit()
        raise HTTPException(status_code=423, detail='session locked by otp rate limit')

    otp = f'{secrets.randbelow(1000000):06d}'
    expires_at = _utcnow() + timedelta(seconds=settings.otp_ttl_seconds)
    log = CitizenOtpLog(
        citizen_session_id=session.id,
        otp_hash=_hash_otp(session.id, otp),
        status='ISSUED',
        ip_hash=ip_hash,
        phone_hash=phone_hash,
        attempt_no=failed_count + 1,
        expires_at=expires_at,
        requested_at=_utcnow(),
    )
    db.add(log)

    outbox = enqueue_outbox(
        db,
        case_id=session.case_id,
        template_id='citizen_otp',
        to_phone=phone_number,
        payload={
            'case_id': session.case_id,
            'center_id': (session.metadata_json or {}).get('center_id', 'LC-001'),
            'citizen_phone': phone_number,
            'template_id': 'citizen_otp',
            'variables': {'otp': otp},
            'dedupe_key': f'{session.id}:{log.id}:otp',
        },
    )
    dispatch_outbox_message(db, outbox)
    _append_local_audit(
        db,
        case_id=session.case_id,
        action='CITIZEN_OTP_REQUESTED',
        message='Citizen OTP issued',
        after={'sessionId': session.id, 'expiresAt': expires_at.isoformat()},
        entity_type='citizen_session',
        entity_id=session.id,
    )
    db.commit()

    response: dict[str, Any] = {'ok': True, 'ttlSeconds': settings.otp_ttl_seconds}
    if settings.environment != 'production':
        response['devOtp'] = otp
    return response


def verify_otp(
    db: Session,
    *,
    session_id: str,
    otp_code: str,
    client_ip: str | None,
    phone_number: str,
) -> dict[str, Any]:
    session = _load_session(db, session_id)
    ip_hash = _hash_ip(client_ip)
    phone_hash = hash_value(phone_number)

    failed_count = _failed_otp_count(db, session_id=session.id, ip_hash=ip_hash, phone_hash=phone_hash)
    if failed_count >= settings.otp_max_attempts:
        _lock_session(db, session)
        db.commit()
        raise HTTPException(status_code=423, detail='session locked')

    now = _utcnow()
    issued = db.execute(
        select(CitizenOtpLog)
        .where(
            CitizenOtpLog.citizen_session_id == session.id,
            CitizenOtpLog.status == 'ISSUED',
        )
        .order_by(desc(CitizenOtpLog.requested_at))
        .limit(1)
    ).scalar_one_or_none()
    if not issued or _as_utc(issued.expires_at) < now:
        db.add(
            CitizenOtpLog(
                citizen_session_id=session.id,
                otp_hash='expired',
                status='FAILED',
                ip_hash=ip_hash,
                phone_hash=phone_hash,
                error_code='OTP_EXPIRED',
                attempt_no=failed_count + 1,
                expires_at=now,
                requested_at=now,
            )
        )
        db.commit()
        raise HTTPException(status_code=400, detail='otp expired')

    if issued.otp_hash != _hash_otp(session.id, otp_code):
        db.add(
            CitizenOtpLog(
                citizen_session_id=session.id,
                otp_hash='invalid',
                status='FAILED',
                ip_hash=ip_hash,
                phone_hash=phone_hash,
                error_code='OTP_MISMATCH',
                attempt_no=failed_count + 1,
                expires_at=issued.expires_at,
                requested_at=now,
            )
        )
        if failed_count + 1 >= settings.otp_max_attempts:
            _lock_session(db, session)
        db.commit()
        raise HTTPException(status_code=400, detail='otp mismatch')

    issued.status = 'VERIFIED'
    issued.verified_at = now
    session.status = 'ACTIVE'
    session.otp_verified_at = now
    session.used_at = now
    session.updated_at = now
    _append_local_audit(
        db,
        case_id=session.case_id,
        action='CITIZEN_OTP_VERIFIED',
        message='Citizen OTP verified',
        after={'sessionId': session.id, 'verifiedAt': now.isoformat()},
        entity_type='citizen_session',
        entity_id=session.id,
    )
    db.commit()
    return {'ok': True, 'sessionId': session.id, 'status': session.status, 'verifiedAt': now.isoformat()}


def get_consent_templates(db: Session) -> list[dict[str, Any]]:
    rows = db.execute(
        select(CitizenConsentTemplate)
        .where(CitizenConsentTemplate.active.is_(True))
        .order_by(CitizenConsentTemplate.required.desc(), CitizenConsentTemplate.id.asc())
    ).scalars().all()
    return [
        {
            'id': row.id,
            'version': row.version,
            'title': row.title,
            'body': row.body,
            'required': row.required,
        }
        for row in rows
    ]


def submit_consents(
    db: Session,
    *,
    session_id: str,
    consents: list[dict[str, Any]],
) -> dict[str, Any]:
    session = _ensure_write_session(db, session_id)
    created_ids: list[str] = []
    for payload in consents:
        row = CitizenConsent(
            id=_new_id('CCN'),
            citizen_session_id=session.id,
            case_id=session.case_id,
            template_id=payload.get('templateId'),
            consent_type=payload.get('consentType') or payload.get('templateId') or 'GENERAL',
            agreed=bool(payload.get('agreed')),
            payload_json=payload,
            agreed_at=_utcnow() if payload.get('agreed') else None,
            created_at=_utcnow(),
        )
        db.add(row)
        created_ids.append(row.id)

    _touch_stage_state(db, case_id=session.case_id, stage=1, state='CONSENT_RECEIVED')
    _create_citizen_request(
        db,
        session_id=session.id,
        case_id=session.case_id,
        request_type='CONSENT_SUBMIT',
        payload={'count': len(consents)},
    )
    _append_local_audit(
        db,
        case_id=session.case_id,
        action='CITIZEN_CONSENT_SUBMITTED',
        message='Citizen consent submitted',
        after={'count': len(consents)},
        entity_type='citizen_session',
        entity_id=session.id,
    )
    db.commit()
    return {'ok': True, 'consentIds': created_ids}


def submit_profile(
    db: Session,
    *,
    session_id: str,
    profile_payload: dict[str, Any],
) -> dict[str, Any]:
    session = _ensure_write_session(db, session_id)
    row = CitizenProfileInput(
        id=_new_id('CPF'),
        citizen_session_id=session.id,
        case_id=session.case_id,
        payload_json=profile_payload,
        created_at=_utcnow(),
    )
    db.add(row)
    _touch_stage_state(db, case_id=session.case_id, stage=1, state='PROFILE_UPDATED')
    _create_work_item(
        db,
        case_id=session.case_id,
        title='시민 프로필 입력 검토',
        item_type='CITIZEN_PROFILE_REVIEW',
        payload={'profileId': row.id},
        due_days=1,
    )
    _create_citizen_request(
        db,
        session_id=session.id,
        case_id=session.case_id,
        request_type='PROFILE_SUBMIT',
        payload={'profileId': row.id},
    )
    _append_local_audit(
        db,
        case_id=session.case_id,
        action='CITIZEN_PROFILE_SUBMITTED',
        message='Citizen profile submitted',
        after={'profileId': row.id},
        entity_type='citizen_profile',
        entity_id=row.id,
    )
    db.commit()
    return {'ok': True, 'profileId': row.id, 'accepted': True}


def list_appointment_slots(db: Session, *, session_id: str) -> dict[str, Any]:
    session = _load_session(db, session_id)
    _assert_session_not_expired(db, session)
    today = _utcnow().date()
    slots = []
    for day in range(1, 8):
        date = today + timedelta(days=day)
        slots.append({'date': date.isoformat(), 'times': ['10:00', '14:00', '16:00']})
    return {'sessionId': session.id, 'slots': slots}


def book_appointment(
    db: Session,
    *,
    session_id: str,
    appointment_at: datetime,
    organization: str | None = None,
) -> dict[str, Any]:
    session = _ensure_write_session(db, session_id)
    row = Appointment(
        id=_new_id('APT'),
        case_id=session.case_id,
        appointment_at=appointment_at,
        status='SCHEDULED',
        organization=organization,
    )
    db.add(row)
    schedule = Schedule(
        id=_new_id('CAL'),
        idempotency_key=f'{session.case_id}:{row.id}:appointment',
        case_id=session.case_id,
        event_type='APPOINTMENT',
        title='시민 예약 일정',
        start_at=appointment_at,
        duration_min=30,
        priority='NORMAL',
        payload_json={'appointmentId': row.id, 'source': 'citizen'},
        status='SCHEDULED',
        created_at=_utcnow(),
    )
    db.add(schedule)
    _touch_stage_state(db, case_id=session.case_id, stage=2, state='APPOINTMENT_BOOKED')
    _create_citizen_request(
        db,
        session_id=session.id,
        case_id=session.case_id,
        request_type='APPOINTMENT_BOOK',
        payload={'appointmentId': row.id},
    )
    _append_local_audit(
        db,
        case_id=session.case_id,
        action='CITIZEN_APPOINTMENT_BOOKED',
        message='Citizen appointment booked',
        after={'appointmentId': row.id, 'at': appointment_at.isoformat()},
        entity_type='appointment',
        entity_id=row.id,
    )
    db.commit()
    return {'ok': True, 'appointmentId': row.id, 'status': row.status, 'appointmentAt': appointment_at.isoformat()}


def _get_latest_active_appointment(db: Session, case_id: str) -> Appointment | None:
    return db.execute(
        select(Appointment)
        .where(Appointment.case_id == case_id, Appointment.status.in_(['SCHEDULED', 'RESCHEDULED']))
        .order_by(desc(Appointment.appointment_at))
        .limit(1)
    ).scalar_one_or_none()


def change_appointment(
    db: Session,
    *,
    session_id: str,
    appointment_at: datetime,
) -> dict[str, Any]:
    session = _ensure_write_session(db, session_id)
    row = _get_latest_active_appointment(db, session.case_id)
    if not row:
        raise HTTPException(status_code=404, detail='appointment not found')
    before_at = row.appointment_at
    row.appointment_at = appointment_at
    row.status = 'RESCHEDULED'
    _create_citizen_request(
        db,
        session_id=session.id,
        case_id=session.case_id,
        request_type='APPOINTMENT_CHANGE',
        payload={'appointmentId': row.id, 'before': before_at.isoformat(), 'after': appointment_at.isoformat()},
    )
    _append_local_audit(
        db,
        case_id=session.case_id,
        action='CITIZEN_APPOINTMENT_CHANGED',
        message='Citizen appointment changed',
        before={'appointmentAt': before_at.isoformat()},
        after={'appointmentAt': appointment_at.isoformat()},
        entity_type='appointment',
        entity_id=row.id,
    )
    db.commit()
    return {'ok': True, 'appointmentId': row.id, 'status': row.status, 'appointmentAt': appointment_at.isoformat()}


def cancel_appointment(db: Session, *, session_id: str, reason: str | None = None) -> dict[str, Any]:
    session = _ensure_write_session(db, session_id)
    row = _get_latest_active_appointment(db, session.case_id)
    if not row:
        raise HTTPException(status_code=404, detail='appointment not found')
    row.status = 'CANCELED'
    _create_citizen_request(
        db,
        session_id=session.id,
        case_id=session.case_id,
        request_type='APPOINTMENT_CANCEL',
        payload={'appointmentId': row.id, 'reason': reason},
    )
    _append_local_audit(
        db,
        case_id=session.case_id,
        action='CITIZEN_APPOINTMENT_CANCELED',
        message='Citizen appointment canceled',
        after={'appointmentId': row.id, 'reason': reason},
        entity_type='appointment',
        entity_id=row.id,
    )
    db.commit()
    return {'ok': True, 'appointmentId': row.id, 'status': row.status}


QUESTIONNAIRES: dict[str, dict[str, Any]] = {
    'Q-BASE-1': {
        'id': 'Q-BASE-1',
        'title': '기초 문진',
        'questions': [
            {'id': 'q1', 'type': 'text', 'label': '최근 불편한 점이 있나요?'},
            {'id': 'q2', 'type': 'boolean', 'label': '복약 지원이 필요하신가요?'},
        ],
    }
}


def list_questionnaires(db: Session, *, session_id: str) -> list[dict[str, Any]]:
    _load_session(db, session_id)
    return list(QUESTIONNAIRES.values())


def get_questionnaire(db: Session, *, session_id: str, questionnaire_id: str) -> dict[str, Any]:
    _load_session(db, session_id)
    item = QUESTIONNAIRES.get(questionnaire_id)
    if not item:
        raise HTTPException(status_code=404, detail='questionnaire not found')
    return item


def submit_questionnaire_response(
    db: Session,
    *,
    session_id: str,
    questionnaire_id: str,
    responses: dict[str, Any],
) -> dict[str, Any]:
    session = _ensure_write_session(db, session_id)
    if questionnaire_id not in QUESTIONNAIRES:
        raise HTTPException(status_code=404, detail='questionnaire not found')

    row = CitizenQuestionnaireResponse(
        id=_new_id('CQR'),
        citizen_session_id=session.id,
        case_id=session.case_id,
        questionnaire_id=questionnaire_id,
        responses_json=responses,
        created_at=_utcnow(),
    )
    db.add(row)
    _create_work_item(
        db,
        case_id=session.case_id,
        title='시민 설문 응답 검토',
        item_type='CITIZEN_QUESTIONNAIRE_REVIEW',
        payload={'questionnaireId': questionnaire_id, 'responseId': row.id},
    )
    _create_citizen_request(
        db,
        session_id=session.id,
        case_id=session.case_id,
        request_type='QUESTIONNAIRE_SUBMIT',
        payload={'questionnaireId': questionnaire_id, 'responseId': row.id},
    )
    _append_local_audit(
        db,
        case_id=session.case_id,
        action='CITIZEN_QUESTIONNAIRE_SUBMITTED',
        message='Citizen questionnaire submitted',
        after={'questionnaireId': questionnaire_id, 'responseId': row.id},
        entity_type='citizen_questionnaire',
        entity_id=row.id,
    )
    db.commit()
    return {'ok': True, 'responseId': row.id}


def create_upload_presign(
    db: Session,
    *,
    session_id: str,
    file_name: str,
    content_type: str,
    size_bytes: int | None,
) -> dict[str, Any]:
    session = _ensure_write_session(db, session_id)
    safe_name = file_name.replace(' ', '_')
    file_key = f'citizen/{session.case_id}/{session.id}/{uuid.uuid4().hex[:12]}-{safe_name}'
    upload = CitizenUpload(
        id=_new_id('CUP'),
        citizen_session_id=session.id,
        case_id=session.case_id,
        file_key=file_key,
        file_name=file_name,
        content_type=content_type,
        size_bytes=size_bytes,
        status='PRESIGNED',
        created_at=_utcnow(),
    )
    db.add(upload)
    _create_citizen_request(
        db,
        session_id=session.id,
        case_id=session.case_id,
        request_type='UPLOAD_PRESIGN',
        payload={'uploadId': upload.id, 'fileKey': file_key},
    )
    try:
        url = storage_service.create_presigned_put_url(key=file_key, content_type=content_type, expires_in=600)
    except Exception as exc:  # pragma: no cover - s3 unavailable
        raise HTTPException(status_code=503, detail=f'upload presign failed: {exc}') from exc

    db.commit()
    return {'ok': True, 'uploadId': upload.id, 'fileKey': file_key, 'putUrl': url, 'expiresIn': 600}


def commit_upload(
    db: Session,
    *,
    session_id: str,
    upload_id: str,
    metadata: dict[str, Any] | None = None,
) -> dict[str, Any]:
    session = _ensure_write_session(db, session_id)
    upload = db.get(CitizenUpload, upload_id)
    if not upload or upload.citizen_session_id != session.id:
        raise HTTPException(status_code=403, detail='upload ownership mismatch')

    upload.status = 'COMMITTED'
    upload.metadata_json = metadata or {}
    upload.committed_at = _utcnow()

    attachment = Attachment(
        id=_new_id('ATT'),
        case_id=session.case_id,
        file_key=upload.file_key,
        file_name=upload.file_name,
        file_url=f's3://{settings.s3_bucket}/{upload.file_key}',
        metadata_json={'contentType': upload.content_type, 'sizeBytes': upload.size_bytes, **(metadata or {})},
        created_at=_utcnow(),
    )
    db.add(attachment)
    _create_work_item(
        db,
        case_id=session.case_id,
        title='시민 업로드 확인',
        item_type='CITIZEN_UPLOAD_REVIEW',
        payload={'uploadId': upload.id, 'attachmentId': attachment.id},
    )
    _create_citizen_request(
        db,
        session_id=session.id,
        case_id=session.case_id,
        request_type='UPLOAD_COMMIT',
        payload={'uploadId': upload.id, 'attachmentId': attachment.id},
    )
    _append_local_audit(
        db,
        case_id=session.case_id,
        action='CITIZEN_UPLOAD_COMMITTED',
        message='Citizen upload committed',
        after={'uploadId': upload.id, 'attachmentId': attachment.id},
        entity_type='attachment',
        entity_id=attachment.id,
    )
    db.commit()

    download_url: str | None = None
    try:
        download_url = storage_service.create_presigned_get_url(key=upload.file_key, expires_in=300)
    except Exception:
        download_url = None
    return {'ok': True, 'uploadId': upload.id, 'attachmentId': attachment.id, 'downloadUrl': download_url}


def citizen_status(db: Session, *, session_id: str) -> dict[str, Any]:
    session = _load_session(db, session_id)
    case = ensure_case(db, session.case_id)
    open_items = db.execute(
        select(func.count()).select_from(WorkItem).where(WorkItem.case_id == case.case_id, WorkItem.status.in_(['OPEN', 'IN_PROGRESS']))
    ).scalar_one()
    appt = _get_latest_active_appointment(db, case.case_id)
    return {
        'caseKey': case.case_key,
        'stage': case.stage,
        'sessionStatus': session.status,
        'otpVerified': bool(session.otp_verified_at),
        'nextAppointmentAt': appt.appointment_at.isoformat() if appt else None,
        'openRequestCount': int(open_items or 0),
    }


def list_case_citizen_submissions(db: Session, *, case_id: str) -> dict[str, Any]:
    consents = db.execute(select(CitizenConsent).where(CitizenConsent.case_id == case_id).order_by(desc(CitizenConsent.created_at))).scalars().all()
    profiles = db.execute(
        select(CitizenProfileInput).where(CitizenProfileInput.case_id == case_id).order_by(desc(CitizenProfileInput.created_at))
    ).scalars().all()
    questionnaires = db.execute(
        select(CitizenQuestionnaireResponse)
        .where(CitizenQuestionnaireResponse.case_id == case_id)
        .order_by(desc(CitizenQuestionnaireResponse.created_at))
    ).scalars().all()
    uploads = db.execute(select(CitizenUpload).where(CitizenUpload.case_id == case_id).order_by(desc(CitizenUpload.created_at))).scalars().all()
    requests = db.execute(select(CitizenRequest).where(CitizenRequest.case_id == case_id).order_by(desc(CitizenRequest.created_at))).scalars().all()

    return {
        'consents': [
            {'id': row.id, 'templateId': row.template_id, 'consentType': row.consent_type, 'agreed': row.agreed, 'at': row.created_at.isoformat()}
            for row in consents
        ],
        'profiles': [{'id': row.id, 'payload': row.payload_json, 'at': row.created_at.isoformat()} for row in profiles],
        'questionnaires': [
            {'id': row.id, 'questionnaireId': row.questionnaire_id, 'responses': row.responses_json, 'at': row.created_at.isoformat()}
            for row in questionnaires
        ],
        'uploads': [
            {'id': row.id, 'fileKey': row.file_key, 'fileName': row.file_name, 'status': row.status, 'at': row.created_at.isoformat()}
            for row in uploads
        ],
        'requests': [
            {'id': row.id, 'type': row.request_type, 'status': row.status, 'at': row.created_at.isoformat(), 'processedAt': row.processed_at.isoformat() if row.processed_at else None}
            for row in requests
        ],
    }


def process_pending_citizen_requests(db: Session, *, limit: int = 200) -> dict[str, int]:
    now = _utcnow()
    rows = db.execute(
        select(CitizenRequest)
        .where(and_(CitizenRequest.status == 'RECEIVED', CitizenRequest.processed_at.is_(None)))
        .order_by(CitizenRequest.created_at.asc())
        .limit(limit)
    ).scalars().all()

    for row in rows:
        row.status = 'PROCESSED'
        row.processed_at = now
        _append_local_audit(
            db,
            case_id=row.case_id,
            action='CITIZEN_REQUEST_PROCESSED',
            message=f'Citizen request processed: {row.request_type}',
            actor_name='worker',
            actor_type='SYSTEM',
            after={'requestId': row.id, 'type': row.request_type},
            entity_type='citizen_request',
            entity_id=row.id,
        )
    db.commit()
    return {'processed': len(rows)}


def cleanup_expired_sessions(db: Session) -> dict[str, int]:
    now = _utcnow()
    rows = db.execute(
        select(CitizenSession).where(CitizenSession.status.in_(['PENDING', 'ACTIVE']), CitizenSession.expires_at < now)
    ).scalars().all()
    for row in rows:
        row.status = 'EXPIRED'
        row.updated_at = now
        _append_local_audit(
            db,
            case_id=row.case_id,
            action='CITIZEN_SESSION_EXPIRED',
            message='Citizen session expired by cleanup task',
            actor_name='beat',
            actor_type='SYSTEM',
            entity_type='citizen_session',
            entity_id=row.id,
        )
    db.commit()
    return {'expired': len(rows)}
