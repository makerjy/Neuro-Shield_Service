from __future__ import annotations

import hashlib
import hmac
import uuid
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any, Protocol

import httpx
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from server_fastapi.app.core.config import get_settings
from server_fastapi.app.models.comms import MessageEvent, MessageOutbox
from server_fastapi.app.models.local_center import LocalAuditEvent

settings = get_settings()


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def hash_value(value: str) -> str:
    secret = settings.jwt_secret.encode('utf-8')
    digest = hmac.new(secret, value.encode('utf-8'), hashlib.sha256).hexdigest()
    return digest


class SmsProvider(Protocol):
    def send_sms(
        self,
        *,
        case_id: str,
        center_id: str,
        citizen_phone: str,
        template_id: str,
        variables: dict[str, Any],
        dedupe_key: str | None = None,
    ) -> dict[str, Any]:
        ...


@dataclass
class HttpSmsProvider:
    base_url: str

    def send_sms(
        self,
        *,
        case_id: str,
        center_id: str,
        citizen_phone: str,
        template_id: str,
        variables: dict[str, Any],
        dedupe_key: str | None = None,
    ) -> dict[str, Any]:
        payload = {
            'case_id': case_id,
            'center_id': center_id,
            'citizen_phone': citizen_phone,
            'template_id': template_id,
            'variables': variables,
            'dedupe_key': dedupe_key,
        }
        url = f"{self.base_url.rstrip('/')}/api/outreach/send-sms"
        with httpx.Client(timeout=5.0) as client:
            response = client.post(url, json=payload)
            response.raise_for_status()
            data = response.json()
        return {
            'provider_message_id': data.get('provider_message_id'),
            'status': data.get('status', 'SENT'),
            'actual_to': data.get('actual_to'),
            'intended_to': data.get('intended_to'),
        }


class NoopSmsProvider:
    def send_sms(
        self,
        *,
        case_id: str,
        center_id: str,
        citizen_phone: str,
        template_id: str,
        variables: dict[str, Any],
        dedupe_key: str | None = None,
    ) -> dict[str, Any]:
        return {
            'provider_message_id': f'noop-{uuid.uuid4().hex[:10]}',
            'status': 'QUEUED',
            'actual_to': citizen_phone,
            'intended_to': citizen_phone,
        }


def get_sms_provider() -> SmsProvider:
    return HttpSmsProvider(base_url=settings.sms_provider_base_url)


def enqueue_outbox(
    db: Session,
    *,
    case_id: str,
    template_id: str,
    to_phone: str,
    payload: dict[str, Any],
    status: str = 'PENDING',
    next_retry_at: datetime | None = None,
) -> MessageOutbox:
    row = MessageOutbox(
        id=f'OUTBOX-{uuid.uuid4().hex[:12]}',
        case_id=case_id,
        channel='SMS',
        template_id=template_id,
        to_hash=hash_value(to_phone),
        payload_json=payload,
        status=status,
        retry_count=0,
        next_retry_at=next_retry_at,
        created_at=_utcnow(),
    )
    db.add(row)
    db.flush()
    return row


def _append_outbox_event(db: Session, outbox_id: str, event_type: str, payload: dict[str, Any] | None = None) -> None:
    db.add(
        MessageEvent(
            outbox_id=outbox_id,
            event_type=event_type,
            payload_json=payload,
            created_at=_utcnow(),
        )
    )


def _append_local_audit(db: Session, outbox: MessageOutbox, action: str, message: str, severity: str, payload: dict[str, Any] | None = None) -> None:
    if not outbox.case_id:
        return
    db.add(
        LocalAuditEvent(
            case_id=outbox.case_id,
            at=_utcnow(),
            actor_name='comms',
            actor_type='SYSTEM',
            action=action,
            message=message,
            severity=severity,
            entity_type='message_outbox',
            entity_id=outbox.id,
            after_json=payload,
        )
    )


def dispatch_outbox_message(
    db: Session,
    outbox: MessageOutbox,
    *,
    provider: SmsProvider | None = None,
    max_retry: int = 5,
) -> MessageOutbox:
    provider = provider or get_sms_provider()
    payload = dict(outbox.payload_json or {})
    try:
        result = provider.send_sms(
            case_id=outbox.case_id or payload.get('case_id') or '',
            center_id=payload.get('center_id') or 'LC-001',
            citizen_phone=payload.get('citizen_phone') or payload.get('to') or '',
            template_id=outbox.template_id or payload.get('template_id') or 'citizen_invite',
            variables=payload.get('variables') or payload,
            dedupe_key=payload.get('dedupe_key'),
        )
        outbox.status = 'SENT'
        outbox.sent_at = _utcnow()
        outbox.last_error = None
        _append_outbox_event(db, outbox.id, 'SENT', result)
        _append_local_audit(db, outbox, 'COMMS_SMS_SENT', 'SMS message sent', 'info', result)
    except Exception as exc:  # pragma: no cover - provider/network failures
        outbox.retry_count = int(outbox.retry_count or 0) + 1
        outbox.last_error = str(exc)
        if outbox.retry_count >= max_retry:
            outbox.status = 'DEAD'
            _append_outbox_event(db, outbox.id, 'DEAD_LETTER', {'error': str(exc), 'retry_count': outbox.retry_count})
            _append_local_audit(
                db,
                outbox,
                'COMMS_SMS_DEAD_LETTER',
                'SMS message moved to dead letter queue',
                'warn',
                {'error': str(exc), 'retry_count': outbox.retry_count},
            )
        else:
            outbox.status = 'RETRY'
            outbox.next_retry_at = _utcnow() + timedelta(minutes=min(30, 2 * outbox.retry_count))
            _append_outbox_event(db, outbox.id, 'RETRY_SCHEDULED', {'error': str(exc), 'retry_count': outbox.retry_count})
            _append_local_audit(
                db,
                outbox,
                'COMMS_SMS_RETRY',
                'SMS message retry scheduled',
                'warn',
                {'error': str(exc), 'retry_count': outbox.retry_count, 'nextRetryAt': outbox.next_retry_at.isoformat()},
            )
    db.flush()
    return outbox


def dispatch_due_outbox_messages(db: Session, *, limit: int = 100, provider: SmsProvider | None = None) -> dict[str, int]:
    now = _utcnow()
    rows = db.execute(
        select(MessageOutbox)
        .where(
            or_(
                MessageOutbox.status == 'PENDING',
                (MessageOutbox.status == 'RETRY') & (MessageOutbox.next_retry_at <= now),
            )
        )
        .order_by(MessageOutbox.created_at.asc())
        .limit(limit)
    ).scalars().all()

    sent = 0
    dead = 0
    retried = 0
    for row in rows:
        before = row.status
        dispatch_outbox_message(db, row, provider=provider)
        if row.status == 'SENT':
            sent += 1
        elif row.status == 'DEAD':
            dead += 1
        elif row.status == 'RETRY' and before != 'RETRY':
            retried += 1

    db.commit()
    return {'processed': len(rows), 'sent': sent, 'retried': retried, 'dead': dead}
