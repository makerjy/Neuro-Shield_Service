from __future__ import annotations

from collections import Counter
from typing import Any

from pydantic import ValidationError
from sqlalchemy import select
from sqlalchemy.orm import Session

from server_fastapi.app.models.ingestion import EventDeadletter, EventRaw
from server_fastapi.app.schemas.central import IngestEventIn, IngestEventsResponse
from server_fastapi.app.services.pii_service import detect_pii, redact_payload

COMMON_EVENT_TYPES = {
    'CASE_STAGE_CHANGED',
    'WORK_ITEM_STATUS_CHANGED',
    'SCHEDULE_CREATED',
    'ATTACHMENT_ADDED',
    'NOTE_ADDED',
}

STAGE_EVENT_TYPES: dict[str, set[str]] = {
    'S1': {
        'CONTACT_ATTEMPTED',
        'CONTACT_RESULT_RECORDED',
        'REFUSAL_CODE_SELECTED',
    },
    'S2': {
        'EXAM_ORDER_CREATED',
        'APPOINTMENT_BOOKED',
        'EXAM_RESULT_VALIDATED',
        'MODEL_RUN_RECORDED_S2',
    },
    'S3': {
        'FOLLOWUP_RECORDED',
        'INTERVENTION_PLAN_UPDATED_LOCAL',
        'MODEL_RUN_RECORDED_S3',
        'ALERT_RAISED_LOCAL',
    },
}


def _is_event_type_allowed(stage: str, event_type: str) -> bool:
    if event_type in COMMON_EVENT_TYPES:
        return True
    return event_type in STAGE_EVENT_TYPES.get(stage, set())


def _create_deadletter(db: Session, event: IngestEventIn, reason: str, detail: str) -> None:
    sanitized_event = event.model_dump(mode='json')
    sanitized_event['payload'] = redact_payload(event.payload)

    deadletter = EventDeadletter(
        event_id=event.event_id,
        reason=reason,
        detail=detail,
        raw_event=sanitized_event,
    )
    db.add(deadletter)


def _create_deadletter_from_raw(db: Session, raw_event: dict[str, Any], reason: str, detail: str) -> None:
    event_id = raw_event.get('event_id')
    sanitized = redact_payload(raw_event)
    deadletter = EventDeadletter(
        event_id=event_id if isinstance(event_id, str) else None,
        reason=reason,
        detail=detail,
        raw_event=sanitized if isinstance(sanitized, dict) else {'raw': sanitized},
    )
    db.add(deadletter)


def validate_and_ingest_events(db: Session, events: list[IngestEventIn]) -> IngestEventsResponse:
    accepted_count = 0
    duplicated_count = 0
    rejected_count = 0
    rejected_reasons: Counter[str] = Counter()
    seen_event_ids: set[str] = set()

    incoming_ids = [event.event_id for event in events]
    existing_ids = set()
    if incoming_ids:
        existing_ids = set(
            db.execute(select(EventRaw.event_id).where(EventRaw.event_id.in_(incoming_ids))).scalars().all()
        )

    for event in events:
        if event.event_id in seen_event_ids or event.event_id in existing_ids:
            duplicated_count += 1
            continue
        seen_event_ids.add(event.event_id)

        if not _is_event_type_allowed(event.stage, event.event_type):
            reason = 'event_type_not_allowed'
            _create_deadletter(db, event, reason, f'stage={event.stage} event_type={event.event_type}')
            rejected_count += 1
            rejected_reasons[reason] += 1
            continue

        pii_findings = detect_pii(event.payload)
        if pii_findings:
            reason = 'pii_detected'
            _create_deadletter(db, event, reason, ','.join(pii_findings))
            rejected_count += 1
            rejected_reasons[reason] += 1
            continue

        row = EventRaw(
            event_id=event.event_id,
            event_ts=event.event_ts,
            org_unit_id=event.producer.org_unit_id,
            level=event.producer.level,
            system=event.producer.system,
            version=event.producer.version,
            region_path=event.region_path.model_dump(exclude_none=True),
            case_key=event.case_key,
            stage=event.stage,
            event_type=event.event_type,
            payload=event.payload,
            policy_version=event.policy_version,
            kpi_version=event.kpi_version,
            model_version=event.model_version,
            trace_id=event.trace_id,
        )
        db.add(row)
        accepted_count += 1

    db.commit()

    reasons = [f'{key}:{value}' for key, value in sorted(rejected_reasons.items())]
    return IngestEventsResponse(
        accepted_count=accepted_count,
        duplicated_count=duplicated_count,
        rejected_count=rejected_count,
        rejected_reasons=reasons,
    )


def validate_and_ingest_raw_events(db: Session, raw_events: list[dict[str, Any]]) -> IngestEventsResponse:
    valid_events: list[IngestEventIn] = []
    schema_rejected_count = 0
    rejected_reasons: Counter[str] = Counter()

    for raw in raw_events:
        try:
            valid_events.append(IngestEventIn.model_validate(raw))
        except ValidationError as exc:
            schema_rejected_count += 1
            rejected_reasons['schema_invalid'] += 1
            _create_deadletter_from_raw(db, raw, 'schema_invalid', str(exc))

    if valid_events:
        result = validate_and_ingest_events(db, valid_events)
        merged = Counter()
        for item in result.rejected_reasons:
            key, _, count = item.partition(':')
            merged[key] += int(count or '1')
        merged.update(rejected_reasons)

        return IngestEventsResponse(
            accepted_count=result.accepted_count,
            duplicated_count=result.duplicated_count,
            rejected_count=result.rejected_count + schema_rejected_count,
            rejected_reasons=[f'{key}:{value}' for key, value in sorted(merged.items())],
        )

    db.commit()
    return IngestEventsResponse(
        accepted_count=0,
        duplicated_count=0,
        rejected_count=schema_rejected_count,
        rejected_reasons=[f'{key}:{value}' for key, value in sorted(rejected_reasons.items())],
    )
