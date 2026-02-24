from __future__ import annotations

from datetime import datetime, timedelta, timezone
from hashlib import sha256
from uuid import uuid4

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from server_fastapi.app.models.control import OrgUnit
from server_fastapi.app.models.ingestion import EventRaw
from server_fastapi.app.models.local_center import (
    CaseStageState,
    Center,
    ContactPlan,
    ExamResult,
    LocalAuditEvent,
    LocalCase,
    LocalUser,
    Schedule,
    Stage2ModelRun,
    Stage3ModelRun,
    TimelineEvent,
    WorkItem,
)
from server_fastapi.app.services.aggregate_service import refresh_kpi_snapshots
from server_fastapi.app.services.regional_service import ensure_regional_snapshot_scope


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _new_id(prefix: str) -> str:
    return f'{prefix}-{uuid4().hex[:12]}'


def _case_key_for(case_id: str) -> str:
    digest = sha256(case_id.encode('utf-8')).hexdigest()[:20]
    return f'CK-{digest}'


DEMO_CENTERS = [
    ('LC-001', '강남구 치매안심센터', '11'),
    ('LC-002', '서초구 치매안심센터', '11'),
    ('LC-003', '송파구 치매안심센터', '11'),
    ('LC-101', '해운대구 치매안심센터', '26'),
    ('LC-201', '수원시 치매안심센터', '41'),
]

DEMO_USERS = [
    ('u-local-001', 'LC-001', '김순자', 'local.001@neuro.local'),
    ('u-local-002', 'LC-002', '최덕기', 'local.002@neuro.local'),
    ('u-local-003', 'LC-003', '박종덕', 'local.003@neuro.local'),
    ('u-local-004', 'LC-101', '이옥자', 'local.004@neuro.local'),
    ('u-local-005', 'LC-201', '한복자', 'local.005@neuro.local'),
]

DEMO_CASE_IDS = [
    'CASE-2026-001',
    'CASE-2026-002',
    'CASE-2026-003',
    'CASE-2026-004',
    'CASE-2026-005',
    'CASE-2026-006',
    'CASE-2026-007',
    'CASE-2026-008',
    'CASE-2026-009',
    'CASE-2026-010',
    'CASE-2026-011',
    'CASE-2026-012',
    'CASE-2026-013',
    'CASE-2026-014',
    'CASE-2026-015',
    'CASE-2026-175',
    'CASE-2026-901',
    'CASE-2026-902',
    'CASE-2026-903',
    'CASE-2026-904',
    'CASE-2026-905',
    'CASE-2026-906',
    'CASE-2026-907',
]


def _ensure_org_units(db: Session) -> None:
    units = [
        ('KR', '대한민국', 'nation', None, {'nation': 'KR'}),
        ('11', '서울특별시', 'sido', 'KR', {'nation': 'KR', 'region': '11'}),
        ('26', '부산광역시', 'sido', 'KR', {'nation': 'KR', 'region': '26'}),
        ('41', '경기도', 'sido', 'KR', {'nation': 'KR', 'region': '41'}),
    ]
    for unit_id, name, level, parent_id, region_path in units:
        row = db.get(OrgUnit, unit_id)
        if row:
            continue
        db.add(
            OrgUnit(
                id=unit_id,
                name=name,
                level=level,
                parent_id=parent_id,
                region_path=region_path,
            )
        )


def _ensure_centers_users(db: Session) -> None:
    for center_id, name, region_code in DEMO_CENTERS:
        center = db.get(Center, center_id)
        if center:
            continue
        db.add(Center(id=center_id, name=name, region_code=region_code, created_at=_utcnow()))

    db.flush()

    for user_id, center_id, name, email in DEMO_USERS:
        user = db.get(LocalUser, user_id)
        if user:
            continue
        db.add(LocalUser(id=user_id, center_id=center_id, name=name, email=email, is_active=True))


def _pick(seq: list[str], idx: int) -> str:
    return seq[idx % len(seq)]


def _build_case_payload(case_id: str, idx: int, owner_name: str) -> dict:
    stage = 1 if idx % 3 == 0 else (2 if idx % 3 == 1 else 3)
    if case_id.endswith('175'):
        stage = 1

    status_by_stage = {
        1: ['QUEUED', 'IN_PROGRESS', 'WAITING_EXAM'],
        2: ['EXAM_RESULT_PENDING', 'IN_PROGRESS', 'WAITING_EXAM'],
        3: ['TRACKING', 'LINKAGE_PENDING', 'IN_PROGRESS'],
    }
    status = _pick(status_by_stage[stage], idx)

    alert = _pick(['LOW', 'MID', 'HIGH'], idx)
    priority = _pick(['P2', 'P1', 'P0'], idx)
    age = 64 + (idx % 24)

    classification = None
    if stage == 2:
        classification = _pick(['NORMAL', 'MCI', 'MCI_HIGH'], idx)
    if stage == 3:
        classification = _pick(['MCI', 'MCI_HIGH', 'AD'], idx)

    risk_score = 42 + (idx * 7) % 52
    churn = 'HIGH' if (stage == 3 and idx % 2 == 0) else ('MID' if stage == 3 else 'LOW')

    return {
        'case_id': case_id,
        'stage': stage,
        'status': status,
        'alert': alert,
        'priority': priority,
        'age': age,
        'classification': classification,
        'risk_score': risk_score,
        'churn': churn,
        'owner_name': owner_name,
    }


def _ensure_case(db: Session, *, case_id: str, center_id: str, owner_id: str, payload: dict, idx: int) -> bool:
    existing = db.get(LocalCase, case_id)
    if existing:
        return False

    now = _utcnow() - timedelta(hours=idx * 3)
    raw_json = {
        'caseState': {
            'stage': payload['stage'],
            'operationStep': 'IN_PROGRESS',
            'modelStatus': 'DONE' if payload['stage'] >= 2 else 'PENDING',
            'classification': payload['classification'],
            'riskScore': payload['risk_score'],
        },
        'status': payload['status'].lower() if payload['status'] in {'IN_PROGRESS', 'TRACKING'} else payload['status'],
        'operationalStatus': 'TRACKING' if payload['stage'] >= 3 else 'IN_PROGRESS',
        'headerMeta': {
            'next_reval_at': (now + timedelta(days=14)).date().isoformat(),
            'next_contact_at': (now + timedelta(days=2)).date().isoformat(),
            'tracking_cycle_days': 30,
            'churn_risk': payload['churn'],
        },
        'metrics': {
            'dataQualityPct': 92 - (idx % 18),
            'scoreChangePct': -1 * (idx % 9),
            'contactFailStreak': idx % 4,
        },
    }

    case = LocalCase(
        case_id=case_id,
        case_key=_case_key_for(case_id),
        center_id=center_id,
        owner_id=owner_id,
        owner_type='counselor',
        stage=payload['stage'],
        status=payload['status'],
        operational_status='TRACKING' if payload['stage'] >= 3 else 'IN_PROGRESS',
        priority_tier=payload['priority'],
        alert_level=payload['alert'],
        subject_json={
            'maskedName': f'대상자-{case_id[-4:]}',
            'age': payload['age'],
            'maskedPhone': f"010-****-{1000 + idx:04d}",
        },
        communication_json={'recommendedTimeSlot': '평일 14:00~16:00'},
        referral_json={'status': 'not_started', 'ownerNote': '초기 상태'},
        metrics_json=raw_json['metrics'],
        raw_json=raw_json,
        created_at=now,
        updated_at=now,
    )
    db.add(case)
    db.flush([case])

    db.add(
        CaseStageState(
            case_id=case_id,
            stage=payload['stage'],
            state='IN_PROGRESS',
            entered_at=now,
            is_current=True,
        )
    )

    db.add(
        TimelineEvent(
            id=_new_id('TL'),
            case_id=case_id,
            at=now,
            event_type='STATUS',
            title='케이스 등록',
            detail='운영 데이터 시드 초기화',
            actor_name='bootstrap',
            actor_type='system',
            payload_json={'stage': payload['stage']},
        )
    )

    db.add(
        LocalAuditEvent(
            case_id=case_id,
            at=now,
            actor_name='bootstrap',
            actor_type='SYSTEM',
            action='CASE_SEEDED',
            message='Demo case seeded for integrated services',
            severity='info',
            entity_type='case',
            entity_id=case_id,
            after_json={'stage': payload['stage'], 'status': payload['status']},
        )
    )

    db.add(
        WorkItem(
            id=_new_id('WI'),
            case_id=case_id,
            title='운영 우선 확인',
            item_type='OPS_REVIEW',
            status='OPEN',
            priority='P1' if payload['alert'] in {'HIGH', 'MID'} else 'P2',
            assignee_id=owner_id,
            due_at=now + timedelta(days=2),
            payload_json={'seed': True},
            created_at=now,
            updated_at=now,
        )
    )

    db.add(
        Schedule(
            id=_new_id('CAL'),
            idempotency_key=f'{case_id}:seed-schedule',
            case_id=case_id,
            event_type='FOLLOWUP' if payload['stage'] >= 2 else 'RECONTACT',
            title='초기 시드 일정',
            start_at=now + timedelta(days=3),
            duration_min=30,
            priority='HIGH' if payload['alert'] == 'HIGH' else 'NORMAL',
            assignee_id=owner_id,
            payload_json={'seed': True},
            status='SCHEDULED',
            created_at=now,
        )
    )

    if payload['stage'] >= 2:
        exam_id = _new_id('EXM')
        db.add(
            ExamResult(
                id=exam_id,
                case_id=case_id,
                status='valid',
                result_json={'mmse': 20 + (idx % 8), 'gds': 2 + (idx % 4), 'cdr': 0.5 + (idx % 2) * 0.5},
                validated_by='u-local-001',
                validated_at=now,
            )
        )
        s2_id = _new_id('S2RUN')
        db.add(
            Stage2ModelRun(
                id=s2_id,
                case_id=case_id,
                exam_result_id=exam_id,
                model_version='s2-v2',
                score=min(0.98, 0.28 + (idx % 12) * 0.055),
                created_at=now,
            )
        )

        if payload['stage'] >= 3:
            db.add(
                Stage3ModelRun(
                    id=_new_id('S3RUN'),
                    case_id=case_id,
                    stage2_model_run_id=s2_id,
                    model_version='s3-v2',
                    score=min(0.92, 0.22 + (idx % 10) * 0.06),
                    created_at=now,
                )
            )
            db.add(
                ContactPlan(
                    id=_new_id('CP'),
                    case_id=case_id,
                    strategy='CALL_RETRY',
                    next_contact_at=now + timedelta(days=1),
                    assignee_id=owner_id,
                    status='PENDING',
                    created_at=now,
                )
            )

    db.add(
        EventRaw(
            event_id=_new_id('EVT'),
            event_ts=now,
            org_unit_id='11' if center_id in {'LC-001', 'LC-002', 'LC-003'} else ('26' if center_id == 'LC-101' else '41'),
            level='sido',
            system='local-center',
            version='2.0',
            region_path={'nation': 'KR', 'region': '11' if center_id in {'LC-001', 'LC-002', 'LC-003'} else ('26' if center_id == 'LC-101' else '41')},
            case_key=_case_key_for(case_id),
            stage=f'S{payload["stage"]}',
            event_type='CASE_STAGE_CHANGED' if payload['stage'] >= 2 else 'CONTACT_ATTEMPTED',
            payload={'seed': True, 'status': payload['status']},
            policy_version='v1',
            kpi_version='v1',
            model_version='s2-v2' if payload['stage'] >= 2 else None,
            trace_id=_new_id('TRACE'),
            received_at=now,
        )
    )

    return True


def seed_demo_data_if_needed(db: Session, *, min_cases: int = 20) -> dict[str, int | bool | str]:
    existing_cases = int(db.execute(select(func.count()).select_from(LocalCase)).scalar_one() or 0)
    if existing_cases >= min_cases:
        return {
            'seeded': False,
            'existingCases': existing_cases,
            'createdCases': 0,
            'reason': 'already_seeded',
        }

    _ensure_org_units(db)
    _ensure_centers_users(db)
    db.flush()

    created = 0
    for idx, case_id in enumerate(DEMO_CASE_IDS):
        center_id, _, _ = DEMO_CENTERS[idx % len(DEMO_CENTERS)]
        owner_id, _, owner_name, _ = DEMO_USERS[idx % len(DEMO_USERS)]
        payload = _build_case_payload(case_id, idx, owner_name)
        if _ensure_case(db, case_id=case_id, center_id=center_id, owner_id=owner_id, payload=payload, idx=idx):
            created += 1

    db.commit()

    ensure_regional_snapshot_scope(db, region_id='seoul', period='week')
    ensure_regional_snapshot_scope(db, region_id='seoul', period='month')
    ensure_regional_snapshot_scope(db, region_id='seoul', period='quarter')

    snapshots = refresh_kpi_snapshots(db, window='LAST_7D')

    return {
        'seeded': True,
        'existingCases': existing_cases,
        'createdCases': created,
        'snapshotRows': snapshots,
    }
