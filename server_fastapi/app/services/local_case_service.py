from __future__ import annotations

import logging
import hashlib
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any

from fastapi import HTTPException
from sqlalchemy import and_, desc, func, select
from sqlalchemy.orm import Session

from server_fastapi.app.models.local_center import (
    Appointment,
    CaseStageState,
    Center,
    Contact,
    ContactPlan,
    ContactResult,
    ExamResult,
    Followup,
    LocalAuditEvent,
    LocalCase,
    LocalUser,
    Schedule,
    Stage1ContactResult,
    Stage2ModelRun,
    Stage3ModelRun,
    TimelineEvent,
    WorkItem,
)
from server_fastapi.app.schemas.local_center import (
    AuditLogResponse,
    CalendarEventCreatePayload,
    CalendarEventCreateResponse,
    ExecuteActionBody,
    InferenceRunPayload,
    LocalCaseSummaryResponse,
    LocalCasesListResponse,
    LocalDashboardKpiResponse,
    OpsLoopReconcileResponse,
    OutcomeSavePayload,
    OutcomeSaveResponse,
    Stage2ModelRunCreatePayload,
    Stage2Step2ManualEditPayload,
    Stage3ModelRunCreatePayload,
    SupportRequestBody,
    WorkItemCreatePayload,
    WorkItemPatchPayload,
)

logger = logging.getLogger(__name__)


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _new_id(prefix: str) -> str:
    return f'{prefix}-{uuid.uuid4().hex[:12]}'


def _case_key_for(case_id: str) -> str:
    digest = hashlib.sha256(case_id.encode('utf-8')).hexdigest()[:20]
    return f'CK-{digest}'


def _fmt(dt: datetime | None) -> str | None:
    return dt.isoformat() if dt else None


def _seed_hash(case_id: str, suffix: str) -> int:
    raw = f'{case_id}:{suffix}'.encode('utf-8')
    return int(hashlib.sha256(raw).hexdigest()[:8], 16)


def _seed_int(case_id: str, suffix: str, min_value: int, max_value: int) -> int:
    if min_value >= max_value:
        return min_value
    span = max_value - min_value + 1
    return min_value + (_seed_hash(case_id, suffix) % span)


def _seed_pick(case_id: str, suffix: str, items: list[str]) -> str:
    if not items:
        return ''
    idx = _seed_hash(case_id, suffix) % len(items)
    return items[idx]


def _extract_path_value(data: dict[str, Any], paths: list[tuple[str, ...]]) -> Any:
    for path in paths:
        cursor: Any = data
        valid = True
        for key in path:
            if not isinstance(cursor, dict) or key not in cursor:
                valid = False
                break
            cursor = cursor[key]
        if valid:
            return cursor
    return None


def _to_int(value: Any) -> int | None:
    try:
        if value is None:
            return None
        number = int(float(value))
        return number
    except (TypeError, ValueError):
        return None


def _to_float(value: Any) -> float | None:
    try:
        if value is None:
            return None
        return float(value)
    except (TypeError, ValueError):
        return None


def _normalize_cog_test_type(value: Any) -> str | None:
    if not isinstance(value, str):
        return None
    normalized = value.strip().upper()
    mapping = {
        'CERAD-K': 'CERAD-K',
        'CERAD': 'CERAD-K',
        'SNSB-II': 'SNSB-II',
        'SNSB2': 'SNSB-II',
        'SNSB-C': 'SNSB-C',
        'SNSBC': 'SNSB-C',
        'LICA': 'LICA',
    }
    return mapping.get(normalized)


def _normalize_specialist_status(value: Any) -> str | None:
    if isinstance(value, bool):
        return 'DONE' if value else 'MISSING'
    if not isinstance(value, str):
        return None
    normalized = value.strip().upper()
    if normalized in {'DONE', 'COMPLETE', 'COMPLETED', 'TRUE', 'YES', 'Y'}:
        return 'DONE'
    if normalized in {'MISSING', 'PENDING', 'FALSE', 'NO', 'N'}:
        return 'MISSING'
    return None


def _infer_stage2_risk_band(case: LocalCase) -> str:
    raw = dict(case.raw_json or {})
    case_state = raw.get('caseState') if isinstance(raw.get('caseState'), dict) else {}
    classification = str(case_state.get('classification') or '').upper()
    risk_score = _to_int(case_state.get('riskScore'))
    if classification == 'AD':
        return 'AD'
    if classification == 'MCI':
        return 'MID'
    if classification == 'NORMAL':
        return 'LOW'

    if isinstance(risk_score, int):
        if risk_score >= 82:
            return 'AD'
        if risk_score >= 70:
            return 'HIGH'
        if risk_score >= 40:
            return 'MID'
        return 'LOW'

    alert_level = (case.alert_level or '').upper()
    if alert_level == 'HIGH':
        return 'HIGH'
    if alert_level in {'MID', 'MEDIUM'}:
        return 'MID'
    return 'LOW'


def _seed_stage2_partial_results(case: LocalCase, risk_band: str) -> dict[str, Any]:
    case_id = case.case_id
    if risk_band == 'LOW':
        return {
            'mmse': _seed_int(case_id, 'mmse-low', 24, 29),
            'gds': _seed_int(case_id, 'gds-low', 1, 3),
            'cogTestType': _seed_pick(case_id, 'cog-low', ['CERAD-K', 'LICA']),
        }
    if risk_band == 'MID':
        return {
            'mmse': _seed_int(case_id, 'mmse-mid', 20, 25),
            'gds': _seed_int(case_id, 'gds-mid', 3, 5),
            'cogTestType': _seed_pick(case_id, 'cog-mid', ['SNSB-II', 'CERAD-K']),
        }
    if risk_band == 'HIGH':
        return {
            'mmse': _seed_int(case_id, 'mmse-high', 16, 22),
            'gds': _seed_int(case_id, 'gds-high', 4, 6),
            'cdr': float(_seed_pick(case_id, 'cdr-high', ['0.5', '1.0'])),
            'cogTestType': _seed_pick(case_id, 'cog-high', ['SNSB-II', 'SNSB-C']),
        }
    return {
        'mmse': _seed_int(case_id, 'mmse-ad', 10, 18),
        'gds': _seed_int(case_id, 'gds-ad', 5, 7),
        'cdr': float(_seed_pick(case_id, 'cdr-ad', ['1.0', '2.0'])),
        'cogTestType': _seed_pick(case_id, 'cog-ad', ['SNSB-II', 'SNSB-C']),
        'specialistOpinionStatus': 'DONE',
    }


def _count_missing_required_fields(payload: dict[str, Any], risk_band: str) -> int:
    required_keys = ['mmse', 'gds', 'cogTestType']
    if risk_band in {'HIGH', 'AD'}:
        required_keys.append('cdr')
    if risk_band == 'AD':
        required_keys.append('specialistOpinionStatus')

    missing = 0
    for key in required_keys:
        value = payload.get(key)
        if key == 'specialistOpinionStatus':
            if value != 'DONE':
                missing += 1
        elif value is None:
            missing += 1
    return missing


def _ensure_center_and_owner(db: Session) -> tuple[Center, LocalUser]:
    center = db.get(Center, 'LC-001')
    if not center:
        center = Center(id='LC-001', name='강남구 치매안심센터', region_code='11')
        db.add(center)

    owner = db.get(LocalUser, 'u-local-001')
    if not owner:
        owner = LocalUser(id='u-local-001', center_id='LC-001', name='담당상담사', email='local.001@neuro.local')
        db.add(owner)

    db.flush()
    return center, owner


def _default_case_payload(case_id: str, owner_name: str) -> dict[str, Any]:
    return {
        'caseId': case_id,
        'stage': 3,
        'subject': {
            'maskedName': f'대상자-{case_id[-4:]}',
            'age': 74,
            'maskedPhone': '010-****-1234',
            'pseudonymKey': f'PS-{case_id[-4:]}',
        },
        'owner': {'name': owner_name, 'role': 'counselor'},
        'status': 'in_progress',
        'operationalStatus': 'TRACKING',
        'headerMeta': {
            'next_reval_at': (_utcnow() + timedelta(days=14)).date().isoformat(),
            'next_contact_at': (_utcnow() + timedelta(days=2)).date().isoformat(),
            'next_program_at': (_utcnow() + timedelta(days=10)).date().isoformat(),
            'plan_status': 'ACTIVE',
            'tracking_cycle_days': 30,
            'churn_risk': 'MID',
        },
        'risk': {
            'zone': 'watch',
            'intensity': 'monthly',
            'intensityReason': '기본 추적 강도',
            'triggers': [
                {
                    'key': 'score_drop',
                    'label': '점수 하락',
                    'satisfied': False,
                    'currentValueText': '4% 하락',
                    'thresholdText': '10% 이상 하락',
                    'lastUpdatedAt': _utcnow().strftime('%Y-%m-%d %H:%M'),
                },
                {
                    'key': 'contact_fail',
                    'label': '연락 실패 누적',
                    'satisfied': False,
                    'currentValueText': '1회',
                    'thresholdText': '3회 이상',
                    'lastUpdatedAt': _utcnow().strftime('%Y-%m-%d %H:%M'),
                },
            ],
        },
        'metrics': {
            'scoreZ': -1.8,
            'scoreChangePct': -4,
            'dataQualityPct': 94,
            'contactSuccessRatePct': 72,
            'contactFailStreak': 1,
            'trendByQuarter': [
                {'quarter': '24-Q3', 'value': -1.2},
                {'quarter': '24-Q4', 'value': -1.5},
                {'quarter': '25-Q1', 'value': -1.8},
            ],
            'threshold': -1.8,
        },
        'prediction': {
            'horizonMonths': 24,
            'probability': 0.46,
            'generatedAt': _utcnow().strftime('%Y-%m-%d %H:%M'),
            'confidence': 'MID',
            'intervalPct': {'low': 38, 'high': 54},
            'topDrivers': [
                {'key': 'score_decline', 'label': '점수 하락', 'direction': 'UP', 'delta': 4},
                {'key': 'data_quality', 'label': '데이터 품질', 'direction': 'UP', 'delta': 2},
            ],
            'trend': [
                {'at': (_utcnow() - timedelta(days=60)).strftime('%Y-%m-%d %H:%M'), 'p': 0.41},
                {'at': (_utcnow() - timedelta(days=30)).strftime('%Y-%m-%d %H:%M'), 'p': 0.43},
                {'at': _utcnow().strftime('%Y-%m-%d %H:%M'), 'p': 0.46},
            ],
        },
        'ops': {
            'nextCheckpointAt': (_utcnow() + timedelta(days=14)).date().isoformat(),
            'lastContactAt': (_utcnow() - timedelta(days=3)).date().isoformat(),
            'lastAssessmentAt': (_utcnow() - timedelta(days=28)).date().isoformat(),
            'recommended_actions': [
                {
                    'id': 'ra-1',
                    'type': 'SCHEDULE_REEVAL',
                    'title': '재평가 일정 확정',
                    'reason': '다음 평가 주기 도래',
                    'severity': 'MID',
                    'requires_approval': False,
                    'decision': 'PENDING',
                }
            ],
            'recommendedActions': [
                {
                    'id': 'rqa-1',
                    'priority': 1,
                    'title': '재평가 일정 생성',
                    'reasonChips': ['평가 주기'],
                    'dueInDays': 14,
                    'actionType': 'create_reassessment',
                    'payloadPreview': {},
                }
            ],
        },
        'audit': [],
        'timeline': [],
        'communication': {
            'recommendedTimeSlot': '평일 14:00~16:00',
            'history': [],
        },
        'referral': {
            'organization': '지역 협력기관',
            'status': 'not_started',
            'updatedAt': _utcnow().strftime('%Y-%m-%d %H:%M'),
            'ownerNote': '초기 상태',
        },
    }


def ensure_case(db: Session, case_id: str) -> LocalCase:
    case = db.get(LocalCase, case_id)
    if case:
        if not case.case_key:
            case.case_key = _case_key_for(case.case_id)
            case.updated_at = _utcnow()
            db.flush()
        return case

    _, owner = _ensure_center_and_owner(db)

    raw = _default_case_payload(case_id, owner.name)
    case = LocalCase(
        case_id=case_id,
        case_key=_case_key_for(case_id),
        center_id='LC-001',
        owner_id=owner.id,
        owner_type='counselor',
        stage=1,
        status='QUEUED',
        operational_status='TRACKING',
        priority_tier='P2',
        alert_level='LOW',
        subject_json={
            'maskedName': raw['subject']['maskedName'],
            'age': raw['subject']['age'],
            'maskedPhone': raw['subject']['maskedPhone'],
            'pseudonymKey': raw['subject']['pseudonymKey'],
        },
        communication_json=raw['communication'],
        referral_json=raw['referral'],
        metrics_json=raw['metrics'],
        raw_json=raw,
        created_at=_utcnow(),
        updated_at=_utcnow(),
    )
    db.add(case)
    db.flush()

    db.add(
        CaseStageState(
            case_id=case_id,
            stage=1,
            state='QUEUED',
            entered_at=_utcnow(),
            is_current=True,
        )
    )

    _append_timeline(
        db,
        case_id,
        event_type='STATUS',
        title='케이스 생성',
        detail='초기 Stage1 큐로 등록',
        actor_name='system',
        actor_type='system',
    )
    _append_audit(
        db,
        case_id,
        action='CASE_CREATED',
        message='Case lifecycle initialized',
        actor_name='system',
        actor_type='system',
        before=None,
        after={'stage': 1, 'state': 'QUEUED'},
    )

    db.commit()
    db.refresh(case)
    return case


def _append_timeline(
    db: Session,
    case_id: str,
    *,
    event_type: str,
    title: str,
    detail: str | None,
    actor_name: str,
    actor_type: str,
    payload: dict[str, Any] | None = None,
) -> TimelineEvent:
    row = TimelineEvent(
        id=_new_id('TL'),
        case_id=case_id,
        at=_utcnow(),
        event_type=event_type,
        title=title,
        detail=detail,
        actor_name=actor_name,
        actor_type=actor_type,
        payload_json=payload,
    )
    db.add(row)
    db.flush()
    return row


def _append_audit(
    db: Session,
    case_id: str,
    *,
    action: str,
    message: str,
    actor_name: str,
    actor_type: str,
    before: dict[str, Any] | None,
    after: dict[str, Any] | None,
    severity: str = 'info',
    entity_type: str = 'case',
    entity_id: str | None = None,
) -> LocalAuditEvent:
    row = LocalAuditEvent(
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
    db.add(row)
    db.flush()
    return row


def _transition_stage_state(db: Session, case_id: str, stage: int, new_state: str) -> None:
    current_rows = db.execute(
        select(CaseStageState).where(
            CaseStageState.case_id == case_id,
            CaseStageState.stage == stage,
            CaseStageState.is_current.is_(True),
        )
    ).scalars().all()

    now = _utcnow()
    for row in current_rows:
        row.is_current = False
        row.exited_at = now

    db.add(
        CaseStageState(
            case_id=case_id,
            stage=stage,
            state=new_state,
            entered_at=now,
            is_current=True,
        )
    )


def _to_calendar_events(case_id: str, payload: OutcomeSavePayload) -> list[dict[str, Any]]:
    events: list[dict[str, Any]] = []

    if payload.outcomeType == 'NO_RESPONSE' and payload.noResponse and payload.noResponse.nextContactAt:
        strategy_label = {
            'CALL_RETRY': '전화 재접촉',
            'SMS_RETRY': '문자 재안내',
            'TIME_CHANGE': '시간대 변경 후 재접촉',
            'PROTECTOR_CONTACT': '보호자 우선 연락',
            'AGENT_SMS': '안내 문자 재발송',
        }[payload.noResponse.strategy]

        events.append(
            {
                'caseId': case_id,
                'type': 'RECONTACT',
                'title': f'{strategy_label} 일정',
                'startAt': payload.noResponse.nextContactAt.isoformat(),
                'durationMin': 20,
                'priority': 'HIGH' if payload.noResponse.escalateLevel == 'L3' else 'NORMAL',
                'payload': {
                    'strategy': payload.noResponse.strategy,
                    'escalateLevel': payload.noResponse.escalateLevel,
                },
            }
        )

    if payload.outcomeType == 'LATER':
        start_at = payload.noResponse.nextContactAt if payload.noResponse and payload.noResponse.nextContactAt else _utcnow() + timedelta(hours=72)
        events.append(
            {
                'caseId': case_id,
                'type': 'RECONTACT',
                'title': '나중에 재안내 일정',
                'startAt': start_at.isoformat(),
                'durationMin': 20,
                'priority': 'NORMAL',
                'payload': {'memo': payload.memo},
            }
        )

    if payload.outcomeType == 'REJECT' and payload.reject:
        should_create_followup = bool(
            (payload.reject.followup and payload.reject.followup.createFollowupEvent)
            or (payload.reject.followup and payload.reject.followup.followupAt)
        )
        if should_create_followup:
            reason_label = {
                'R1_SELF_REJECT': '본인 거부',
                'R2_GUARDIAN_REJECT': '보호자 거부',
                'R3_OTHER_INSTITUTION': '타 기관 이용',
                'R4_ALREADY_DIAGNOSED': '이미 진단/관리 중',
                'R5_CONTACT_INVALID': '연락처 오류',
                'R6_EMOTIONAL_BACKLASH': '감정 반응 우려',
                'R7_OTHER': '기타',
            }.get(payload.reject.code or '', '거부 사유 확인')
            followup_at = (
                payload.reject.followup.followupAt
                if payload.reject.followup and payload.reject.followup.followupAt
                else _utcnow() + timedelta(days=7)
            )

            events.append(
                {
                    'caseId': case_id,
                    'type': 'FOLLOWUP',
                    'title': f'거부 후속 확인 ({reason_label})',
                    'startAt': followup_at.isoformat(),
                    'durationMin': 20,
                    'priority': 'HIGH' if payload.reject.level == 'FINAL' else 'NORMAL',
                    'payload': {
                        'rejectCode': payload.reject.code,
                        'rejectLevel': payload.reject.level,
                    },
                }
            )

    return events


def _validate_outcome_payload(payload: OutcomeSavePayload) -> None:
    if payload.outcomeType == 'REJECT':
        if not payload.reject or not payload.reject.code:
            raise HTTPException(status_code=422, detail='reject.code is required for REJECT')
        if payload.reject.code == 'R7_OTHER' and not (payload.reject.detail and payload.reject.detail.strip()):
            raise HTTPException(status_code=422, detail='reject.detail is required when reject.code=R7_OTHER')

    if payload.outcomeType == 'NO_RESPONSE':
        if not payload.noResponse:
            raise HTTPException(status_code=422, detail='noResponse is required for NO_RESPONSE')
        missing = []
        if not payload.noResponse.strategy:
            missing.append('strategy')
        if not payload.noResponse.nextContactAt:
            missing.append('nextContactAt')
        if not payload.noResponse.assigneeId:
            missing.append('assigneeId')
        if missing:
            raise HTTPException(status_code=422, detail=f'noResponse fields required: {", ".join(missing)}')


def save_stage1_outcome(
    db: Session,
    case_id: str,
    payload: OutcomeSavePayload,
    *,
    actor_name: str = 'system',
    actor_type: str = 'system',
) -> OutcomeSaveResponse:
    _validate_outcome_payload(payload)
    case = ensure_case(db, case_id)

    result = Stage1ContactResult(
        id=_new_id('OUT'),
        case_id=case_id,
        outcome_type=payload.outcomeType,
        memo=payload.memo,
        reason_tags_json={'reasonTags': payload.reasonTags or []},
        reject_code=payload.reject.code if payload.reject else None,
        reject_level=payload.reject.level if payload.reject else None,
        reject_detail=payload.reject.detail if payload.reject else None,
        followup_at=(payload.reject.followup.followupAt if payload.reject and payload.reject.followup else None),
        no_response_strategy=(payload.noResponse.strategy if payload.noResponse else None),
        next_contact_at=(payload.noResponse.nextContactAt if payload.noResponse else None),
        assignee_id=(payload.noResponse.assigneeId if payload.noResponse else None),
        created_at=_utcnow(),
    )
    db.add(result)

    next_state = 'OUTCOME_RECORDED'
    if payload.outcomeType == 'REJECT':
        next_state = 'CLOSED_REFUSED' if payload.reject and payload.reject.level == 'FINAL' else 'RECONTACT_SCHEDULED'
    elif payload.outcomeType == 'NO_RESPONSE':
        next_state = 'RECONTACT_SCHEDULED'
    elif payload.outcomeType in {'PROCEED', 'PROTECTOR_LINK', 'COUNSELOR_LINK'}:
        next_state = 'STAGE2_ELIGIBLE'
    elif payload.outcomeType == 'LATER':
        next_state = 'RECONTACT_SCHEDULED'

    _transition_stage_state(db, case_id, stage=1, new_state=next_state)

    prev_stage = case.stage
    prev_status = case.status
    case.status = next_state
    if next_state == 'STAGE2_ELIGIBLE':
        case.stage = max(case.stage, 2)
    case.updated_at = _utcnow()

    events = _to_calendar_events(case_id, payload)
    if payload.outcomeType == 'NO_RESPONSE' and payload.noResponse and payload.noResponse.nextContactAt:
        db.add(
            ContactPlan(
                id=_new_id('CP'),
                case_id=case_id,
                strategy=payload.noResponse.strategy,
                next_contact_at=payload.noResponse.nextContactAt,
                assignee_id=payload.noResponse.assigneeId or 'unknown',
                status='PENDING',
            )
        )

    _append_timeline(
        db,
        case_id,
        event_type='STATUS',
        title='Stage1 결과 저장',
        detail=f'Outcome={payload.outcomeType}',
        actor_name=actor_name,
        actor_type=actor_type,
        payload={'outcomeType': payload.outcomeType},
    )

    _append_audit(
        db,
        case_id,
        action='OUTCOME_SAVED',
        message=f'Stage1 outcome saved: {payload.outcomeType}',
        actor_name=actor_name,
        actor_type=actor_type,
        before={'stage': prev_stage, 'status': prev_status},
        after={'stage': case.stage, 'status': case.status},
    )

    db.commit()

    response_payload: dict[str, Any] = {
        'ok': True,
        'outcomeId': result.id,
        'timelinePatch': {'at': _utcnow().isoformat(), 'outcomeType': payload.outcomeType},
    }
    if events:
        response_payload['nextAction'] = {'type': 'CREATE_CALENDAR_EVENT', 'events': events}

    return OutcomeSaveResponse.model_validate(response_payload)


def create_calendar_event(
    db: Session,
    payload: CalendarEventCreatePayload,
    *,
    actor_name: str = 'system',
    actor_type: str = 'system',
) -> CalendarEventCreateResponse:
    case = ensure_case(db, payload.event.caseId)

    existing = db.execute(
        select(Schedule).where(Schedule.idempotency_key == payload.idempotencyKey)
    ).scalar_one_or_none()
    if existing:
        return CalendarEventCreateResponse(ok=True, eventId=existing.id)

    schedule = Schedule(
        id=_new_id('CAL'),
        idempotency_key=payload.idempotencyKey,
        case_id=payload.event.caseId,
        event_type=payload.event.type,
        title=payload.event.title,
        start_at=payload.event.startAt,
        duration_min=payload.event.durationMin,
        priority=payload.event.priority,
        payload_json=payload.event.payload,
        status='SCHEDULED',
        created_at=_utcnow(),
    )
    db.add(schedule)

    _append_timeline(
        db,
        case.case_id,
        event_type='REEVAL_SCHEDULED' if payload.event.type == 'RECONTACT' else 'PLAN_UPDATED',
        title='캘린더 일정 생성',
        detail=payload.event.title,
        actor_name=actor_name,
        actor_type=actor_type,
        payload={'eventType': payload.event.type, 'startAt': payload.event.startAt.isoformat()},
    )

    _append_audit(
        db,
        case.case_id,
        action='CALENDAR_EVENT_CREATED',
        message=f'Calendar event created: {payload.event.type}',
        actor_name=actor_name,
        actor_type=actor_type,
        before=None,
        after={'eventId': schedule.id, 'idempotencyKey': payload.idempotencyKey},
    )

    db.commit()
    return CalendarEventCreateResponse(ok=True, eventId=schedule.id)


def _apply_stage3_from_db(db: Session, case: LocalCase, base: dict[str, Any]) -> dict[str, Any]:
    timeline_rows = db.execute(
        select(TimelineEvent).where(TimelineEvent.case_id == case.case_id).order_by(desc(TimelineEvent.at)).limit(100)
    ).scalars().all()
    audit_rows = db.execute(
        select(LocalAuditEvent).where(LocalAuditEvent.case_id == case.case_id).order_by(desc(LocalAuditEvent.at)).limit(100)
    ).scalars().all()

    base['timeline'] = [
        {
            'id': row.id,
            'at': row.at.strftime('%Y-%m-%d %H:%M'),
            'type': row.event_type,
            'title': row.title,
            'detail': row.detail,
            'actor': {'name': row.actor_name, 'type': row.actor_type},
        }
        for row in timeline_rows
    ]

    base['audit'] = [
        {
            'at': row.at.strftime('%Y-%m-%d %H:%M'),
            'actor': {'name': row.actor_name, 'type': row.actor_type},
            'message': row.message,
            'logId': f'LOG-{row.id}',
            'severity': row.severity,
        }
        for row in audit_rows
    ]

    base['status'] = case.raw_json.get('status', case.status) if case.raw_json else case.status
    base['operationalStatus'] = case.raw_json.get('operationalStatus', case.operational_status) if case.raw_json else case.operational_status
    base['subject'] = case.subject_json
    base['communication'] = case.communication_json
    base['referral'] = case.referral_json
    base['metrics'] = case.metrics_json

    return base


def get_stage3_case(db: Session, case_id: str) -> dict[str, Any]:
    case = ensure_case(db, case_id)

    payload = case.raw_json if case.raw_json else _default_case_payload(case_id, '담당상담사')
    payload = dict(payload)

    payload = _apply_stage3_from_db(db, case, payload)
    case.raw_json = payload
    case.updated_at = _utcnow()
    db.commit()
    return payload


def _derive_zone(metrics: dict[str, Any]) -> str:
    change = float(metrics.get('scoreChangePct') or 0)
    fail = int(metrics.get('contactFailStreak') or 0)
    if change <= -10 or fail >= 4:
        return 'danger'
    if change <= -5 or fail >= 2:
        return 'watch'
    return 'stable'


def _derive_operational_status(stage3: dict[str, Any]) -> str:
    if stage3.get('status') == 'completed':
        return 'CLOSED'
    header = stage3.get('headerMeta', {})
    if header.get('churn_risk') == 'HIGH' or stage3.get('risk', {}).get('zone') == 'danger':
        return 'CHURN_RISK'
    if stage3.get('referral', {}).get('status') != 'done':
        return 'LINKAGE_PENDING'
    return 'TRACKING'


def execute_stage3_action(
    db: Session,
    case_id: str,
    body: ExecuteActionBody,
    *,
    actor_name: str = '사용자',
) -> dict[str, Any]:
    case = ensure_case(db, case_id)
    stage3 = get_stage3_case(db, case_id)

    before_status = {'status': stage3.get('status'), 'operationalStatus': stage3.get('operationalStatus')}

    risk = stage3.setdefault('risk', {})
    metrics = stage3.setdefault('metrics', {})
    header = stage3.setdefault('headerMeta', {})
    ops = stage3.setdefault('ops', {})
    referral = stage3.setdefault('referral', {})
    communication = stage3.setdefault('communication', {'history': []})
    communication.setdefault('history', [])

    if body.actionType == 'create_reassessment':
        next_day = (_utcnow() + timedelta(days=14)).date().isoformat()
        ops['nextCheckpointAt'] = next_day
        header['next_reval_at'] = next_day
        title = '재평가 예약 생성'
        detail = '다음 재평가 일정이 설정되었습니다.'
    elif body.actionType == 'adjust_intensity':
        risk['intensity'] = 'biweekly'
        risk['intensityReason'] = '신호 누적에 따른 추적 강도 상향'
        header['tracking_cycle_days'] = 14
        title = '추적 강도 조정'
        detail = '추적 주기를 조정했습니다.'
    elif body.actionType == 'strengthen_referral':
        referral['status'] = 'done'
        referral['updatedAt'] = _utcnow().strftime('%Y-%m-%d %H:%M')
        referral['ownerNote'] = '연계 완료'
        title = '연계 완료'
        detail = '연계 진행 상태를 완료로 반영했습니다.'
    elif body.actionType == 'retry_contact':
        metrics['contactSuccessRatePct'] = min(100, int(metrics.get('contactSuccessRatePct') or 0) + 10)
        metrics['contactFailStreak'] = max(0, int(metrics.get('contactFailStreak') or 0) - 1)
        communication['history'].insert(
            0,
            {
                'id': _new_id('CH'),
                'at': _utcnow().strftime('%Y-%m-%d %H:%M'),
                'channel': 'call',
                'result': 'success',
                'reasonTag': '부재중',
                'note': '재시도 연결 성공',
            },
        )
        title = '확인 연락 실행'
        detail = '확인 연락 시도 결과를 기록했습니다.'
    elif body.actionType == 'request_data_completion':
        metrics['dataQualityPct'] = min(100, int(metrics.get('dataQualityPct') or 90) + 5)
        title = '데이터 보완 요청'
        detail = '누락 보완 요청을 기록했습니다.'
    elif body.actionType == 'request_support':
        stage3['status'] = 'on_hold'
        title = '운영 지원 요청'
        detail = '운영 지원 요청이 등록되었습니다.'
    else:
        title = '운영 액션 실행'
        detail = f'실행 타입: {body.actionType}'

    risk['zone'] = _derive_zone(metrics)
    if risk['zone'] == 'danger':
        header['churn_risk'] = 'HIGH'
    elif risk['zone'] == 'watch':
        header['churn_risk'] = 'MID'
    else:
        header['churn_risk'] = 'LOW'

    stage3['operationalStatus'] = _derive_operational_status(stage3)

    timeline = _append_timeline(
        db,
        case_id,
        event_type='STATUS',
        title=title,
        detail=detail,
        actor_name=actor_name,
        actor_type='human',
        payload=body.payload,
    )
    audit = _append_audit(
        db,
        case_id,
        action='STAGE3_ACTION_EXECUTED',
        message=f'운영 액션 실행: {body.actionType}',
        actor_name=actor_name,
        actor_type='human',
        before=before_status,
        after={'status': stage3.get('status'), 'operationalStatus': stage3.get('operationalStatus')},
        severity='warn' if body.actionType == 'request_support' else 'info',
    )

    case.raw_json = stage3
    case.status = stage3.get('status', case.status)
    case.operational_status = stage3.get('operationalStatus', case.operational_status)
    case.metrics_json = stage3.get('metrics', case.metrics_json)
    case.communication_json = stage3.get('communication', case.communication_json)
    case.referral_json = stage3.get('referral', case.referral_json)
    case.stage = max(case.stage, 3)
    case.updated_at = _utcnow()
    db.commit()

    updated = get_stage3_case(db, case_id)
    new_audit = {
        'at': audit.at.strftime('%Y-%m-%d %H:%M'),
        'actor': {'name': audit.actor_name, 'type': audit.actor_type},
        'message': audit.message,
        'logId': f'LOG-{audit.id}',
        'severity': audit.severity,
    }

    return {'updatedCase': updated, 'newAuditLog': new_audit, 'timelineEventId': timeline.id}


def support_request(db: Session, case_id: str, body: SupportRequestBody) -> dict[str, Any]:
    payload = ExecuteActionBody(actionType='request_support', payload={'reason': body.reason})
    result = execute_stage3_action(db, case_id, payload, actor_name=body.requester)
    return result


def _to_case_summary(case: LocalCase) -> LocalCaseSummaryResponse:
    next_schedule = case.raw_json.get('headerMeta', {}).get('next_reval_at') if case.raw_json else None
    return LocalCaseSummaryResponse(
        caseId=case.case_id,
        stage=case.stage,
        status=case.status,
        operationalStatus=case.operational_status,
        owner=case.owner_id,
        alertLevel=case.alert_level,
        priorityTier=case.priority_tier,
        nextActionAt=next_schedule,
    )


def list_local_cases(
    db: Session,
    *,
    stage: str | None,
    alert: str | None,
    q: str | None,
    owner_type: str | None,
    priority_tier: str | None,
    status: str | None,
    page: int,
    size: int,
) -> LocalCasesListResponse:
    rows = db.execute(select(LocalCase).order_by(desc(LocalCase.updated_at))).scalars().all()

    def _match(row: LocalCase) -> bool:
        if stage and str(row.stage) != stage.replace('STAGE', ''):
            return False
        if alert and (row.alert_level or '').lower() != alert.lower():
            return False
        if owner_type and (row.owner_type or '').lower() != owner_type.lower():
            return False
        if priority_tier and (row.priority_tier or '').lower() != priority_tier.lower():
            return False
        if status and (row.status or '').lower() != status.lower():
            return False
        if q:
            ql = q.lower()
            name = str((row.subject_json or {}).get('maskedName', '')).lower()
            if ql not in row.case_id.lower() and ql not in name:
                return False
        return True

    filtered = [row for row in rows if _match(row)]
    total = len(filtered)
    start = (page - 1) * size
    items = filtered[start : start + size]

    return LocalCasesListResponse(
        total=total,
        page=page,
        size=size,
        items=[_to_case_summary(item) for item in items],
    )


def get_case_summary(db: Session, case_id: str) -> LocalCaseSummaryResponse:
    case = ensure_case(db, case_id)
    return _to_case_summary(case)


def get_local_dashboard_kpis(db: Session) -> LocalDashboardKpiResponse:
    cases = db.execute(select(LocalCase)).scalars().all()

    stage1_open = sum(1 for case in cases if case.stage == 1 and case.status not in {'CLOSED_REFUSED'})
    stage2_pending_exam = sum(1 for case in cases if case.stage >= 2 and case.status in {'WAITING_EXAM', 'EXAM_RESULT_PENDING'})
    stage3_tracking = sum(1 for case in cases if case.stage >= 3 and case.operational_status in {'TRACKING', 'REEVAL_DUE', 'LINKAGE_PENDING'})
    churn_risk_high = sum(
        1
        for case in cases
        if ((case.raw_json or {}).get('headerMeta') or {}).get('churn_risk') == 'HIGH'
    )

    overdue_schedules = db.execute(
        select(func.count()).select_from(Schedule).where(Schedule.status == 'SCHEDULED', Schedule.start_at < _utcnow())
    ).scalar_one()
    open_work_items = db.execute(
        select(func.count()).select_from(WorkItem).where(WorkItem.status.in_(['OPEN', 'IN_PROGRESS']))
    ).scalar_one()

    return LocalDashboardKpiResponse(
        stage1Open=int(stage1_open),
        stage2PendingExam=int(stage2_pending_exam),
        stage3Tracking=int(stage3_tracking),
        overdueSchedules=int(overdue_schedules or 0),
        openWorkItems=int(open_work_items or 0),
        churnRiskHigh=int(churn_risk_high),
    )


def list_calendar_events(db: Session, *, from_at: datetime | None, to_at: datetime | None, assignee: str | None) -> list[dict[str, Any]]:
    query = select(Schedule)
    if from_at:
        query = query.where(Schedule.start_at >= from_at)
    if to_at:
        query = query.where(Schedule.start_at <= to_at)
    if assignee:
        query = query.where(Schedule.assignee_id == assignee)

    rows = db.execute(query.order_by(Schedule.start_at.asc())).scalars().all()
    events: list[dict[str, Any]] = []
    for row in rows:
        try:
            start_at = row.start_at
            if start_at is None:
                raise ValueError('start_at is null')
            payload = row.payload_json if isinstance(row.payload_json, dict) else {}
            events.append(
                {
                    'eventId': row.id,
                    'caseId': row.case_id,
                    'type': row.event_type,
                    'title': row.title,
                    'startAt': start_at.isoformat() if isinstance(start_at, datetime) else str(start_at),
                    'durationMin': row.duration_min,
                    'priority': row.priority,
                    'status': row.status,
                    'payload': payload,
                }
            )
        except Exception:
            logger.exception('Calendar event serialization failed for schedule id=%s', getattr(row, 'id', 'unknown'))
    return events


def create_work_item(db: Session, payload: WorkItemCreatePayload, actor_name: str = 'system') -> dict[str, Any]:
    ensure_case(db, payload.caseId)

    row = WorkItem(
        id=_new_id('WI'),
        case_id=payload.caseId,
        title=payload.title,
        item_type=payload.type,
        status=payload.status,
        priority=payload.priority,
        assignee_id=payload.assigneeId,
        due_at=payload.dueAt,
        payload_json=payload.payload,
        created_at=_utcnow(),
        updated_at=_utcnow(),
    )
    db.add(row)

    _append_audit(
        db,
        payload.caseId,
        action='WORK_ITEM_CREATED',
        message=f'Work item created: {payload.title}',
        actor_name=actor_name,
        actor_type='human',
        before=None,
        after={'workItemId': row.id, 'status': row.status},
    )

    db.commit()
    return {
        'id': row.id,
        'caseId': row.case_id,
        'title': row.title,
        'type': row.item_type,
        'status': row.status,
        'priority': row.priority,
        'assigneeId': row.assignee_id,
        'dueAt': _fmt(row.due_at),
        'payload': row.payload_json or {},
    }


def update_work_item(db: Session, work_item_id: str, payload: WorkItemPatchPayload, actor_name: str = 'system') -> dict[str, Any]:
    row = db.get(WorkItem, work_item_id)
    if not row:
        raise HTTPException(status_code=404, detail='work item not found')

    before = {
        'status': row.status,
        'priority': row.priority,
        'assigneeId': row.assignee_id,
        'dueAt': _fmt(row.due_at),
    }

    if payload.status is not None:
        row.status = payload.status
    if payload.priority is not None:
        row.priority = payload.priority
    if payload.assigneeId is not None:
        row.assignee_id = payload.assigneeId
    if payload.dueAt is not None:
        row.due_at = payload.dueAt
    if payload.payload is not None:
        row.payload_json = payload.payload

    row.updated_at = _utcnow()

    _append_audit(
        db,
        row.case_id,
        action='WORK_ITEM_UPDATED',
        message=f'Work item updated: {row.id}',
        actor_name=actor_name,
        actor_type='human',
        before=before,
        after={
            'status': row.status,
            'priority': row.priority,
            'assigneeId': row.assignee_id,
            'dueAt': _fmt(row.due_at),
        },
    )

    db.commit()
    return {
        'id': row.id,
        'caseId': row.case_id,
        'title': row.title,
        'type': row.item_type,
        'status': row.status,
        'priority': row.priority,
        'assigneeId': row.assignee_id,
        'dueAt': _fmt(row.due_at),
        'payload': row.payload_json or {},
    }


def list_audit_events(
    db: Session,
    *,
    case_id: str | None,
    from_at: datetime | None,
    to_at: datetime | None,
) -> list[AuditLogResponse]:
    query = select(LocalAuditEvent)
    if case_id:
        query = query.where(LocalAuditEvent.case_id == case_id)
    if from_at:
        query = query.where(LocalAuditEvent.at >= from_at)
    if to_at:
        query = query.where(LocalAuditEvent.at <= to_at)

    rows = db.execute(query.order_by(desc(LocalAuditEvent.at)).limit(500)).scalars().all()
    return [
        AuditLogResponse(
            id=row.id,
            caseId=row.case_id,
            at=row.at.isoformat(),
            actor={'name': row.actor_name, 'type': row.actor_type},
            action=row.action,
            message=row.message,
            severity=row.severity,
            before=row.before_json,
            after=row.after_json,
        )
        for row in rows
    ]


def get_stage2_step2_autofill(db: Session, case_id: str, actor_name: str = 'system') -> dict[str, Any]:
    case = ensure_case(db, case_id)
    now = _utcnow()

    latest_exam = db.execute(
        select(ExamResult)
        .where(ExamResult.case_id == case_id)
        .order_by(desc(ExamResult.validated_at), desc(ExamResult.id))
        .limit(1)
    ).scalar_one_or_none()

    risk_band = _infer_stage2_risk_band(case)
    received_json = dict(latest_exam.result_json or {}) if latest_exam and isinstance(latest_exam.result_json, dict) else {}
    direct_keys = {'mmse', 'gds', 'cdr', 'cogTestType', 'specialistOpinionStatus'}
    has_direct_key = bool(direct_keys.intersection(set(received_json.keys())))

    mmse = _to_int(
        _extract_path_value(
            received_json,
            [('mmse',), ('MMSE',), ('scores', 'mmse'), ('result', 'mmse')],
        )
    )
    gds = _to_int(
        _extract_path_value(
            received_json,
            [('gds',), ('GDS',), ('scores', 'gds'), ('result', 'gds')],
        )
    )
    cdr = _to_float(
        _extract_path_value(
            received_json,
            [('cdr',), ('CDR',), ('cdrOrGds',), ('scores', 'cdr'), ('result', 'cdr')],
        )
    )
    cog_test_type = _normalize_cog_test_type(
        _extract_path_value(
            received_json,
            [('cogTestType',), ('neuroType',), ('testType',), ('scores', 'cogTestType'), ('result', 'neuroType')],
        )
    )
    specialist_status = _normalize_specialist_status(
        _extract_path_value(
            received_json,
            [('specialistOpinionStatus',), ('specialist',), ('specialistDone',), ('result', 'specialistOpinionStatus')],
        )
    )

    seeded = _seed_stage2_partial_results(case, risk_band)
    mmse = mmse if mmse is not None else _to_int(seeded.get('mmse'))
    gds = gds if gds is not None else _to_int(seeded.get('gds'))
    cdr = cdr if cdr is not None else _to_float(seeded.get('cdr'))
    cog_test_type = cog_test_type if cog_test_type is not None else _normalize_cog_test_type(seeded.get('cogTestType'))
    specialist_status = specialist_status if specialist_status is not None else _normalize_specialist_status(seeded.get('specialistOpinionStatus'))

    if latest_exam:
        source = 'RECEIVED' if has_direct_key else 'MAPPED'
    else:
        source = 'SEEDED'

    provider_name = _extract_path_value(
        received_json,
        [('providerName',), ('provider',), ('hospitalName',), ('meta', 'providerName')],
    )
    if not provider_name:
        provider_name = ((case.referral_json or {}).get('organization') if isinstance(case.referral_json, dict) else None) or '강남구 협력병원'

    if latest_exam:
        linkage_status = 'FAILED' if (latest_exam.status or '').lower() == 'invalid' else 'RECEIVED'
        received_at = _fmt(latest_exam.validated_at) or _fmt(now)
    else:
        linkage_status = 'WAITING'
        received_at = None

    payload: dict[str, Any] = {
        'caseId': case_id,
        'source': source,
        'syncedAt': now.isoformat(),
        'mmse': mmse,
        'gds': gds,
        'cdr': cdr,
        'cogTestType': cog_test_type,
        'specialistOpinionStatus': specialist_status,
        'receivedMeta': {
            'linkageStatus': linkage_status,
            'receivedAt': received_at,
            'providerName': provider_name,
        },
    }
    payload['missingRequiredCount'] = _count_missing_required_fields(payload, risk_band)
    payload['filledFields'] = [field for field in ['mmse', 'gds', 'cdr', 'cogTestType', 'specialistOpinionStatus'] if payload.get(field) is not None]

    raw = dict(case.raw_json or {})
    raw['stage2Step2Draft'] = {
        'riskBand': risk_band,
        **payload,
    }
    case.raw_json = raw
    case.updated_at = now

    _append_timeline(
        db,
        case_id,
        event_type='STEP2_AUTOFILL_APPLIED',
        title='Stage2 STEP2 자동 기입',
        detail=f'source={source} filled={",".join(payload["filledFields"]) or "-"}',
        actor_name=actor_name,
        actor_type='system',
        payload={
            'source': source,
            'syncedAt': payload['syncedAt'],
            'filledFields': payload['filledFields'],
            'missingRequiredCount': payload['missingRequiredCount'],
        },
    )
    _append_audit(
        db,
        case_id,
        action='STEP2_AUTOFILL_APPLIED',
        message=f'Stage2 step2 autofill applied ({source})',
        actor_name=actor_name,
        actor_type='system',
        before=None,
        after={
            'source': source,
            'filledFields': payload['filledFields'],
            'missingRequiredCount': payload['missingRequiredCount'],
        },
        entity_type='stage2_step2',
        entity_id=case_id,
    )
    db.commit()
    return payload


def apply_stage2_step2_manual_edit(
    db: Session,
    *,
    case_id: str,
    payload: Stage2Step2ManualEditPayload,
    actor_name: str = 'system',
) -> dict[str, Any]:
    case = ensure_case(db, case_id)
    reason = (payload.reason or '').strip()
    if len(reason) < 5:
        raise HTTPException(status_code=422, detail='manual edit reason must be at least 5 characters')

    changed_fields = dict(payload.changedFields or {})
    if not changed_fields:
        return {'ok': True, 'caseId': case_id, 'changedFields': {}, 'editedAt': _utcnow().isoformat()}

    now = _utcnow()
    editor = payload.editor or actor_name
    latest_exam = db.execute(
        select(ExamResult)
        .where(ExamResult.case_id == case_id)
        .order_by(desc(ExamResult.validated_at), desc(ExamResult.id))
        .limit(1)
    ).scalar_one_or_none()
    if not latest_exam:
        latest_exam = ExamResult(
            id=_new_id('EXR'),
            case_id=case_id,
            status='valid',
            result_json={},
            validated_by=editor,
            validated_at=now,
        )
        db.add(latest_exam)
        db.flush()

    before_json = dict(latest_exam.result_json or {}) if isinstance(latest_exam.result_json, dict) else {}
    normalized_changed: dict[str, Any] = {}
    for key, value in changed_fields.items():
        if key in {'mmse', 'gds'}:
            normalized_changed[key] = _to_int(value)
        elif key == 'cdr':
            normalized_changed[key] = _to_float(value)
        elif key == 'cogTestType':
            normalized_changed[key] = _normalize_cog_test_type(value)
        elif key == 'specialistOpinionStatus':
            normalized_changed[key] = _normalize_specialist_status(value)
        else:
            normalized_changed[key] = value

    next_json = {
        **before_json,
        **normalized_changed,
        'manualEditReason': reason,
        'manualEditedBy': editor,
        'manualEditedAt': now.isoformat(),
    }
    latest_exam.result_json = next_json
    latest_exam.status = 'valid'
    latest_exam.validated_by = editor
    latest_exam.validated_at = now

    raw = dict(case.raw_json or {})
    draft = raw.get('stage2Step2Draft')
    draft_json = dict(draft) if isinstance(draft, dict) else {}
    draft_json.update(normalized_changed)
    draft_json['source'] = draft_json.get('source') or 'MAPPED'
    draft_json['syncedAt'] = now.isoformat()
    draft_json['manualEditReason'] = reason
    draft_json['manualEditedBy'] = editor
    raw['stage2Step2Draft'] = draft_json
    case.raw_json = raw
    case.updated_at = now

    changed_keys = [key for key in normalized_changed.keys() if normalized_changed.get(key) is not None]
    _append_timeline(
        db,
        case_id,
        event_type='STEP2_MANUAL_EDIT_APPLIED',
        title='Stage2 STEP2 수동 수정',
        detail=f'fields={",".join(changed_keys) or "-"}',
        actor_name=editor,
        actor_type='human',
        payload={'changedFields': normalized_changed, 'reason': reason},
    )
    _append_audit(
        db,
        case_id,
        action='STEP2_MANUAL_EDIT_APPLIED',
        message=f'Stage2 step2 manual edit applied ({",".join(changed_keys) or "none"})',
        actor_name=editor,
        actor_type='human',
        before=before_json,
        after={'changedFields': normalized_changed, 'reason': reason},
        entity_type='exam_result',
        entity_id=latest_exam.id,
    )
    db.commit()
    return {
        'ok': True,
        'caseId': case_id,
        'examResultId': latest_exam.id,
        'changedFields': normalized_changed,
        'reason': reason,
        'editor': editor,
        'editedAt': now.isoformat(),
    }


def create_stage2_model_run(db: Session, payload: Stage2ModelRunCreatePayload, actor_name: str = 'system') -> dict[str, Any]:
    case = ensure_case(db, payload.caseId)

    exam_result = db.get(ExamResult, payload.examResultId)
    if not exam_result or exam_result.case_id != payload.caseId or exam_result.status != 'valid':
        raise HTTPException(
            status_code=409,
            detail={'code': 'EXAM_RESULT_REQUIRED', 'message': '검사결과(valid)가 있어야 Stage2 모델 실행이 가능합니다.'},
        )

    run = Stage2ModelRun(
        id=_new_id('S2RUN'),
        case_id=payload.caseId,
        exam_result_id=payload.examResultId,
        model_version=payload.modelVersion,
        score=payload.score,
        created_at=_utcnow(),
    )
    db.add(run)

    case.stage = max(case.stage, 2)
    case.status = 'MODEL_READY'
    case.updated_at = _utcnow()

    _append_timeline(
        db,
        payload.caseId,
        event_type='STATUS',
        title='Stage2 모델 실행',
        detail=f'model={payload.modelVersion}',
        actor_name=actor_name,
        actor_type='human',
        payload={'runId': run.id},
    )
    _append_audit(
        db,
        payload.caseId,
        action='STAGE2_MODEL_RUN_CREATED',
        message=f'Stage2 model run created: {run.id}',
        actor_name=actor_name,
        actor_type='human',
        before=None,
        after={'runId': run.id, 'score': payload.score, 'examResultId': payload.examResultId},
    )

    db.commit()
    return {
        'ok': True,
        'runId': run.id,
        'caseId': run.case_id,
        'examResultId': run.exam_result_id,
        'modelVersion': run.model_version,
        'score': float(run.score),
        'createdAt': run.created_at.isoformat(),
    }


def create_stage3_model_run(db: Session, payload: Stage3ModelRunCreatePayload, actor_name: str = 'system') -> dict[str, Any]:
    case = ensure_case(db, payload.caseId)

    valid_exam = db.execute(
        select(ExamResult)
        .where(ExamResult.case_id == payload.caseId, ExamResult.status == 'valid')
        .order_by(desc(ExamResult.validated_at), desc(ExamResult.id))
        .limit(1)
    ).scalar_one_or_none()
    stage2_run = db.execute(
        select(Stage2ModelRun).where(Stage2ModelRun.case_id == payload.caseId).order_by(desc(Stage2ModelRun.created_at)).limit(1)
    ).scalar_one_or_none()
    followup_count = db.execute(
        select(func.count()).select_from(Followup).where(Followup.case_id == payload.caseId)
    ).scalar_one()

    if not valid_exam:
        raise HTTPException(
            status_code=409,
            detail={
                'code': 'EXAM_RESULT_REQUIRED',
                'message': '검사결과(valid)가 있어야 Stage3 모델 실행이 가능합니다.',
            },
        )
    if not stage2_run or int(followup_count or 0) < 2:
        raise HTTPException(
            status_code=409,
            detail={
                'code': 'STAGE3_GATE_FAILED',
                'message': 'Stage2 확정 결과 및 최소 2건의 followup 데이터가 필요합니다.',
            },
        )

    run = Stage3ModelRun(
        id=_new_id('S3RUN'),
        case_id=payload.caseId,
        stage2_model_run_id=stage2_run.id,
        model_version=payload.modelVersion,
        score=payload.score,
        created_at=_utcnow(),
    )
    db.add(run)

    case.stage = max(case.stage, 3)
    case.status = 'in_progress'
    case.operational_status = 'TRACKING'
    case.updated_at = _utcnow()

    _append_timeline(
        db,
        payload.caseId,
        event_type='STATUS',
        title='Stage3 모델 실행',
        detail=f'model={payload.modelVersion}',
        actor_name=actor_name,
        actor_type='human',
        payload={'runId': run.id},
    )
    _append_audit(
        db,
        payload.caseId,
        action='STAGE3_MODEL_RUN_CREATED',
        message=f'Stage3 model run created: {run.id}',
        actor_name=actor_name,
        actor_type='human',
        before=None,
        after={'runId': run.id, 'score': payload.score, 'stage2RunId': stage2_run.id, 'followups': int(followup_count or 0)},
    )

    db.commit()
    return {
        'ok': True,
        'runId': run.id,
        'caseId': run.case_id,
        'stage2ModelRunId': run.stage2_model_run_id,
        'modelVersion': run.model_version,
        'score': float(run.score),
        'createdAt': run.created_at.isoformat(),
    }


def _ops_step_state(*, done: bool, ready: bool, done_reason: str, ready_reason: str, todo_reason: str) -> dict[str, str]:
    if done:
        return {'status': 'DONE', 'reason': done_reason}
    if ready:
        return {'status': 'READY', 'reason': ready_reason}
    return {'status': 'TODO', 'reason': todo_reason}


def _map_timeline_to_ops_events(rows: list[TimelineEvent]) -> set[str]:
    mapped: set[str] = set()
    for row in rows:
        event_type = (row.event_type or '').upper()
        title = (row.title or '').upper()
        detail = (row.detail or '').upper()
        blob = f'{event_type} {title} {detail}'

        if 'PLAN' in blob or '계획' in blob:
            mapped.add('PLAN_CONFIRMED')
        if 'RESULT' in blob or '결과' in blob:
            mapped.add('RESULT_RECEIVED')
        if 'VALID' in blob or '검증' in blob or '확정' in blob:
            mapped.add('RESULT_VALIDATED')
        if 'INFERENCE_REQUESTED' in blob or '모델 실행 요청' in blob:
            mapped.add('INFERENCE_REQUESTED')
        if 'INFERENCE_STARTED' in blob or '모델 실행 시작' in blob:
            mapped.add('INFERENCE_STARTED')
        if 'INFERENCE_COMPLETED' in blob or '모델 실행 완료' in blob:
            mapped.add('INFERENCE_COMPLETED')
        if 'CLASS' in blob or '분류' in blob:
            mapped.add('CLASSIFICATION_CONFIRMED')
        if 'NEXT STEP' in blob or '다음 단계' in blob:
            mapped.add('NEXT_STEP_DECIDED')
        if 'REFERRAL' in blob or '의뢰' in blob or '예약' in blob:
            mapped.add('REFERRAL_CONFIRMED')

    return mapped


def _ensure_case_state(raw: dict[str, Any], stage: int) -> dict[str, Any]:
    state = raw.get('caseState') if isinstance(raw.get('caseState'), dict) else {}
    state.setdefault('stage', stage)
    state.setdefault('operationStep', 'WAITING')
    state.setdefault('modelStatus', 'PENDING')
    raw['caseState'] = state
    return state


def _compute_ops_loop(stage: int, mapped_events: set[str], raw: dict[str, Any]) -> dict[str, Any]:
    state = _ensure_case_state(raw, stage)
    result_received = 'RESULT_RECEIVED' in mapped_events
    result_validated = 'RESULT_VALIDATED' in mapped_events
    inference_completed = 'INFERENCE_COMPLETED' in mapped_events or state.get('modelStatus') == 'DONE'
    inference_started = 'INFERENCE_STARTED' in mapped_events or state.get('modelStatus') == 'PROCESSING'
    classification_confirmed = 'CLASSIFICATION_CONFIRMED' in mapped_events
    next_step_decided = 'NEXT_STEP_DECIDED' in mapped_events
    referral_confirmed = 'REFERRAL_CONFIRMED' in mapped_events
    plan_confirmed = 'PLAN_CONFIRMED' in mapped_events

    if stage == 1:
        labels = ['사전 조건 확인', '결과 수집/입력', '분류/판단', '다음 단계 결정']
    elif stage == 2:
        labels = ['검사 수행 관리', '검사 결과 수신/검증', '분류 확정', '다음 단계 결정']
    else:
        labels = ['추적 기준선/플랜 확인', '검사 결과 수신/검증', '위험평가 검토', '연계/다음 조치 결정']

    step1 = _ops_step_state(
        done=plan_confirmed,
        ready=False,
        done_reason=f'{labels[0]} 단계가 확정되었습니다.',
        ready_reason=f'{labels[0]} 준비 완료',
        todo_reason=f'{labels[0]} 이벤트가 아직 없습니다.',
    )
    step2 = _ops_step_state(
        done=result_validated,
        ready=result_received,
        done_reason=f'{labels[1]}가 검증까지 완료되었습니다.',
        ready_reason=f'{labels[1]}는 완료됐고 검증 대기입니다.',
        todo_reason=f'{labels[1]}가 아직 수신되지 않았습니다.',
    )
    step3 = _ops_step_state(
        done=classification_confirmed,
        ready=inference_completed or inference_started,
        done_reason=f'{labels[2]}이 담당자 승인으로 확정되었습니다.',
        ready_reason='모델 결과가 생성되어 승인 대기(READY) 상태입니다.' if inference_completed else '모델 실행 중입니다.',
        todo_reason=f'{labels[2]}에 필요한 모델 결과가 아직 없습니다.',
    )
    step4 = _ops_step_state(
        done=next_step_decided,
        ready=referral_confirmed,
        done_reason=f'{labels[3]}이 완료되었습니다.',
        ready_reason='연계/의뢰는 반영되었고 최종 결정 대기입니다.',
        todo_reason=f'{labels[3]}이 아직 결정되지 않았습니다.',
    )

    steps = [
        {'id': 'STEP1', 'label': labels[0], **step1},
        {'id': 'STEP2', 'label': labels[1], **step2},
        {'id': 'STEP3', 'label': labels[2], **step3, 'requiresHumanApproval': True},
        {'id': 'STEP4', 'label': labels[3], **step4, 'requiresHumanApproval': True},
    ]

    done_count = sum(1 for step in steps if step['status'] == 'DONE')
    ready_count = sum(1 for step in steps if step['status'] == 'READY')
    mismatch_reasons: list[str] = []
    if result_received and step2['status'] == 'TODO':
        mismatch_reasons.append('결과 수신 이벤트가 있는데 Step2가 TODO입니다.')
    if inference_completed and step3['status'] == 'TODO':
        mismatch_reasons.append('모델 결과가 있는데 Step3가 TODO입니다.')

    return {
        'stage': stage,
        'steps': steps,
        'doneCount': done_count,
        'readyCount': ready_count,
        'totalCount': 4,
        'mismatch': len(mismatch_reasons) > 0,
        'mismatchReasons': mismatch_reasons,
    }


def reconcile_case_ops_loop(db: Session, case_id: str, actor_name: str = 'system') -> OpsLoopReconcileResponse:
    case = ensure_case(db, case_id)
    timeline_rows = db.execute(
        select(TimelineEvent).where(TimelineEvent.case_id == case_id).order_by(desc(TimelineEvent.at)).limit(300)
    ).scalars().all()

    raw = dict(case.raw_json or {})
    computed = _compute_ops_loop(case.stage, _map_timeline_to_ops_events(timeline_rows), raw)
    raw['opsLoop'] = computed
    state = _ensure_case_state(raw, case.stage)
    if case.stage == 2:
        if state.get('modelStatus') == 'DONE':
            state['operationStep'] = 'RESULT_READY'
        elif computed['readyCount'] > 0 or computed['doneCount'] > 0:
            state['operationStep'] = 'IN_PROGRESS'
    if case.stage >= 3:
        if state.get('modelStatus') == 'DONE':
            state['operationStep'] = 'FOLLOW_UP'
        elif computed['readyCount'] > 0 or computed['doneCount'] > 0:
            state['operationStep'] = 'IN_PROGRESS'

    case.raw_json = raw
    case.updated_at = _utcnow()
    _append_audit(
        db,
        case_id,
        action='OPS_LOOP_RECONCILED',
        message='Ops loop state reconciled from timeline events',
        actor_name=actor_name,
        actor_type='human',
        before=None,
        after={'doneCount': computed['doneCount'], 'readyCount': computed['readyCount']},
    )
    db.commit()
    return OpsLoopReconcileResponse(
        caseId=case_id,
        stage=case.stage,
        doneCount=computed['doneCount'],
        readyCount=computed['readyCount'],
        totalCount=computed['totalCount'],
        mismatch=computed['mismatch'],
        steps=computed['steps'],
        mismatchReasons=computed['mismatchReasons'],
    )


def _duration_by_case(case_id: str, stage: int) -> int:
    base = 30 + (sum(ord(ch) for ch in f'{case_id}:{stage}') % 150)
    return max(30, min(base, 180))


def _find_case_with_job(db: Session, job_id: str) -> tuple[LocalCase | None, dict[str, Any], dict[str, Any] | None]:
    rows = db.execute(select(LocalCase).order_by(desc(LocalCase.updated_at)).limit(1000)).scalars().all()
    for case in rows:
        raw = dict(case.raw_json or {})
        jobs = raw.get('inferenceJobs')
        if isinstance(jobs, dict) and isinstance(jobs.get(job_id), dict):
            return case, raw, jobs[job_id]
    return None, {}, None


def _apply_inference_completion(db: Session, case: LocalCase, raw: dict[str, Any], job: dict[str, Any], actor_name: str) -> None:
    state = _ensure_case_state(raw, case.stage)
    stage = int(job.get('stage') or case.stage)
    now_iso = _utcnow().isoformat()

    if stage == 2:
        bucket = sum(ord(ch) for ch in case.case_id) % 3
        if bucket == 0:
            classification = 'NORMAL'
            risk_score = 30
        elif bucket == 1:
            classification = 'MCI'
            risk_score = 55
        else:
            classification = 'AD'
            risk_score = 82

        state.update(
            {
                'stage': max(case.stage, 2),
                'modelStatus': 'DONE',
                'operationStep': 'RESULT_READY',
                'classification': classification,
                'riskScore': risk_score,
                'modelVersion': job.get('modelVersion') or 's2-v2',
                'modelUpdatedAt': now_iso,
            }
        )
        case.stage = max(case.stage, 2)
        case.status = 'READY_TO_CLASSIFY'
        case.operational_status = 'TRACKING'

        db.add(
            WorkItem(
                id=_new_id('WI'),
                case_id=case.case_id,
                title='분류 확정 검토',
                item_type='CLASSIFICATION_CONFIRM',
                status='OPEN',
                priority='P1',
                assignee_id=case.owner_id,
                due_at=_utcnow() + timedelta(days=1),
                payload_json={'jobId': job.get('jobId'), 'stage': 2},
                created_at=_utcnow(),
                updated_at=_utcnow(),
            )
        )
    else:
        risk_options = [15, 35, 67, 88]
        risk_score = risk_options[sum(ord(ch) for ch in case.case_id) % len(risk_options)]
        state.update(
            {
                'stage': max(case.stage, 3),
                'modelStatus': 'DONE',
                'operationStep': 'FOLLOW_UP',
                'riskScore': risk_score,
                'modelVersion': job.get('modelVersion') or 's3-v2',
                'modelUpdatedAt': now_iso,
            }
        )
        case.stage = max(case.stage, 3)
        case.status = 'in_progress'
        case.operational_status = 'LINKAGE_PENDING'

        db.add(
            WorkItem(
                id=_new_id('WI'),
                case_id=case.case_id,
                title='다음 단계 결정',
                item_type='NEXT_STEP_DECISION',
                status='OPEN',
                priority='P1',
                assignee_id=case.owner_id,
                due_at=_utcnow() + timedelta(days=2),
                payload_json={'jobId': job.get('jobId'), 'stage': 3},
                created_at=_utcnow(),
                updated_at=_utcnow(),
            )
        )

    _append_timeline(
        db,
        case.case_id,
        event_type='INFERENCE_COMPLETED',
        title=f'Stage{stage} 모델 실행 완료',
        detail=f'job={job.get("jobId")} model={job.get("modelVersion") or "-"}',
        actor_name=actor_name,
        actor_type='system',
        payload={'jobId': job.get('jobId'), 'stage': stage},
    )
    _append_timeline(
        db,
        case.case_id,
        event_type='STATUS',
        title='모델 결과 반영',
        detail=f'stage={stage}',
        actor_name=actor_name,
        actor_type='system',
        payload={'jobId': job.get('jobId'), 'stage': stage},
    )
    _append_audit(
        db,
        case.case_id,
        action='MODEL_RESULT_APPLIED',
        message=f'Stage{stage} model result applied',
        actor_name=actor_name,
        actor_type='system',
        before=None,
        after={'jobId': job.get('jobId'), 'stage': stage, 'operationStep': state.get('operationStep')},
    )


def run_case_inference(db: Session, case_id: str, payload: InferenceRunPayload, actor_name: str = 'system') -> dict[str, Any]:
    case = ensure_case(db, case_id)
    valid_exam = db.execute(
        select(ExamResult)
        .where(ExamResult.case_id == case_id, ExamResult.status == 'valid')
        .order_by(desc(ExamResult.validated_at), desc(ExamResult.id))
        .limit(1)
    ).scalar_one_or_none()
    if not valid_exam:
        raise HTTPException(
            status_code=409,
            detail={'code': 'EXAM_RESULT_REQUIRED', 'message': '검사결과(valid)가 있어야 모델 실행이 가능합니다.'},
        )

    if payload.stage == 3:
        stage2_run = db.execute(
            select(Stage2ModelRun).where(Stage2ModelRun.case_id == case_id).order_by(desc(Stage2ModelRun.created_at)).limit(1)
        ).scalar_one_or_none()
        if not stage2_run:
            raise HTTPException(status_code=409, detail={'code': 'STAGE2_REQUIRED', 'message': 'Stage3 실행 전 Stage2 모델 실행이 필요합니다.'})

    raw = dict(case.raw_json or {})
    jobs = raw.get('inferenceJobs')
    if not isinstance(jobs, dict):
        jobs = {}
    job_id = _new_id('INF')
    now = _utcnow()
    duration_sec = _duration_by_case(case_id, payload.stage)

    job = {
        'jobId': job_id,
        'caseId': case_id,
        'stage': int(payload.stage),
        'status': 'RUNNING',
        'progress': 2,
        'etaSeconds': duration_sec,
        'durationSec': duration_sec,
        'requestedAt': now.isoformat(),
        'startedAt': now.isoformat(),
        'updatedAt': now.isoformat(),
        'completedAt': None,
        'modelVersion': payload.modelVersion or (f's{payload.stage}-v2'),
    }
    jobs[job_id] = job
    raw['inferenceJobs'] = jobs
    state = _ensure_case_state(raw, case.stage)
    state['modelStatus'] = 'PROCESSING'
    if payload.stage == 2:
        case.stage = max(case.stage, 2)
        case.status = 'WAITING_RESULTS'
    else:
        case.stage = max(case.stage, 3)
        case.status = 'in_progress'
        case.operational_status = 'TRACKING'
    state['stage'] = case.stage
    case.raw_json = raw
    case.updated_at = now

    _append_timeline(
        db,
        case_id,
        event_type='INFERENCE_REQUESTED',
        title=f'Stage{payload.stage} 모델 실행 요청',
        detail=f'job={job_id}',
        actor_name=actor_name,
        actor_type='human',
        payload={'jobId': job_id, 'stage': payload.stage},
    )
    _append_timeline(
        db,
        case_id,
        event_type='INFERENCE_STARTED',
        title=f'Stage{payload.stage} 모델 실행 시작',
        detail=f'job={job_id}',
        actor_name=actor_name,
        actor_type='system',
        payload={'jobId': job_id, 'stage': payload.stage},
    )
    _append_audit(
        db,
        case_id,
        action='INFERENCE_RUN_STARTED',
        message=f'Stage{payload.stage} inference started',
        actor_name=actor_name,
        actor_type='human',
        before=None,
        after={'jobId': job_id, 'stage': payload.stage, 'durationSec': duration_sec},
    )

    db.commit()
    return {
        'jobId': job_id,
        'caseId': case_id,
        'stage': int(payload.stage),
        'status': 'RUNNING',
        'progress': 2,
        'etaSeconds': duration_sec,
        'startedAt': now.isoformat(),
        'updatedAt': now.isoformat(),
        'completedAt': None,
    }


def get_inference_job(db: Session, job_id: str, actor_name: str = 'system') -> dict[str, Any]:
    case, raw, job = _find_case_with_job(db, job_id)
    if not case or not job:
        raise HTTPException(status_code=404, detail='inference job not found')

    now = _utcnow()
    status = str(job.get('status') or 'PENDING')
    if status in {'PENDING', 'RUNNING'}:
        started_at_raw = job.get('startedAt')
        try:
            started_at = datetime.fromisoformat(started_at_raw) if isinstance(started_at_raw, str) else now
        except ValueError:
            started_at = now
        duration_sec = int(job.get('durationSec') or 60)
        elapsed = max(0, int((now - started_at).total_seconds()))
        if elapsed >= duration_sec:
            status = 'DONE'
            job['status'] = 'DONE'
            job['progress'] = 100
            job['etaSeconds'] = 0
            job['completedAt'] = now.isoformat()
            if not job.get('appliedAt'):
                _apply_inference_completion(db, case, raw, job, actor_name=actor_name)
                job['appliedAt'] = now.isoformat()
        else:
            progress = min(99, max(int(job.get('progress') or 0), int((elapsed / max(duration_sec, 1)) * 100)))
            job['status'] = 'RUNNING'
            job['progress'] = progress
            job['etaSeconds'] = max(1, duration_sec - elapsed)

    job['updatedAt'] = now.isoformat()
    jobs = raw.get('inferenceJobs')
    if not isinstance(jobs, dict):
        jobs = {}
    jobs[job_id] = job
    raw['inferenceJobs'] = jobs
    case.raw_json = raw
    case.updated_at = now
    db.commit()

    return {
        'jobId': job_id,
        'caseId': case.case_id,
        'stage': int(job.get('stage') or case.stage),
        'status': str(job.get('status') or 'PENDING'),
        'progress': int(job.get('progress') or 0),
        'etaSeconds': int(job['etaSeconds']) if isinstance(job.get('etaSeconds'), int) else job.get('etaSeconds'),
        'startedAt': job.get('startedAt'),
        'updatedAt': job.get('updatedAt'),
        'completedAt': job.get('completedAt'),
    }


def scan_due_schedules_and_contact_plans(db: Session) -> dict[str, int]:
    now = _utcnow()

    due_schedules = db.execute(
        select(Schedule).where(Schedule.status == 'SCHEDULED', Schedule.start_at <= now)
    ).scalars().all()
    due_plans = db.execute(
        select(ContactPlan).where(ContactPlan.status == 'PENDING', ContactPlan.next_contact_at <= now)
    ).scalars().all()

    schedule_count = 0
    for row in due_schedules:
        row.status = 'QUEUED'
        _append_audit(
            db,
            row.case_id,
            action='SCHEDULE_DUE_QUEUED',
            message=f'Due schedule queued: {row.id}',
            actor_name='beat',
            actor_type='system',
            before={'status': 'SCHEDULED'},
            after={'status': 'QUEUED'},
        )
        schedule_count += 1

    contact_plan_count = 0
    for row in due_plans:
        row.status = 'QUEUED'
        _append_audit(
            db,
            row.case_id,
            action='CONTACT_PLAN_DUE_QUEUED',
            message=f'Due contact plan queued: {row.id}',
            actor_name='beat',
            actor_type='system',
            before={'status': 'PENDING'},
            after={'status': 'QUEUED'},
        )
        contact_plan_count += 1

    db.commit()
    return {'dueSchedules': schedule_count, 'dueContactPlans': contact_plan_count}
