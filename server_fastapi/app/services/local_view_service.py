from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from sqlalchemy import and_, desc, func, select
from sqlalchemy.orm import Session

from server_fastapi.app.models.local_center import (
    LocalCase,
    LocalUser,
    Schedule,
    Stage2ModelRun,
    Stage3ModelRun,
    TimelineEvent,
    WorkItem,
)
from server_fastapi.app.services.local_case_service import ensure_case, get_stage3_case

TOP_PRIORITY_STAGE1_CASE_ID = 'CASE-2026-175'


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _fmt_local(dt: datetime | None) -> str:
    if not dt:
        return _utcnow().strftime('%Y-%m-%d %H:%M')
    target = dt
    if target.tzinfo is not None:
        target = target.astimezone(timezone.utc)
    return target.strftime('%Y-%m-%d %H:%M')


def _seed_ratio(case_id: str, suffix: str) -> float:
    raw = f'{case_id}:{suffix}'
    acc = 0
    for idx, ch in enumerate(raw):
        acc = (acc * 33 + ord(ch) + idx) & 0xFFFFFFFF
    return (acc % 1000) / 1000.0


def _stage_label(stage: int) -> str:
    if stage >= 3:
        return 'Stage 3'
    if stage == 2:
        return 'Stage 2'
    return 'Stage 1'


def _legacy_risk(case: LocalCase) -> str:
    alert = str(case.alert_level or '').upper()
    if alert == 'HIGH':
        return '고'
    if alert in {'MID', 'MEDIUM'}:
        return '중'
    raw = dict(case.raw_json or {})
    case_state = raw.get('caseState') if isinstance(raw.get('caseState'), dict) else {}
    score_raw = case_state.get('riskScore')
    try:
        score = int(float(score_raw))
    except Exception:
        score = None
    if isinstance(score, int):
        if score >= 75:
            return '고'
        if score >= 45:
            return '중'
    return '저'


def _legacy_status(case: LocalCase) -> str:
    status = str(case.status or '').upper()
    if status in {'CLOSED', 'CLOSED_REFUSED', 'DONE'}:
        return '완료'
    if case.stage == 1 and status in {'QUEUED', 'WAITING_EXAM', 'EXAM_RESULT_PENDING'}:
        pivot = _seed_ratio(case.case_id, 'stage1-status')
        if pivot >= 0.82:
            return '지연'
        if pivot >= 0.58:
            return '임박'
        if pivot >= 0.36:
            return '진행중'
        return '대기'
    if status in {'WAITING_EXAM', 'EXAM_RESULT_PENDING', 'QUEUED'}:
        return '대기'
    if status in {'ON_HOLD'}:
        return '지연'
    if status in {'IN_PROGRESS', 'MODEL_RUNNING', 'LABS_RECEIVED'}:
        return '진행중'
    if case.stage >= 3 and status in {'TRACKING', 'REEVAL_DUE', 'LINKAGE_PENDING'}:
        return '임박'
    return '진행중'


def _legacy_path(case: LocalCase) -> str:
    if case.stage >= 3:
        return '추적 강화'
    if case.stage == 2:
        raw = dict(case.raw_json or {})
        case_state = raw.get('caseState') if isinstance(raw.get('caseState'), dict) else {}
        classification = str(case_state.get('classification') or '').upper()
        if classification in {'MCI_HIGH', 'AD'}:
            return 'High MCI 경로'
        return '의뢰 우선'
    path_seed = _seed_ratio(case.case_id, 'stage1-path')
    risk = _legacy_risk(case)
    if risk == '고' and path_seed >= 0.38:
        return '상담사 우선 접촉'
    if path_seed < 0.30:
        return '문자 안내 우선'
    if path_seed < 0.46:
        return '보호자 우선 접촉'
    if path_seed < 0.60:
        return '사전 기준 점검'
    if risk == '고':
        return '현장 방문 연계'
    return '초기 접촉 집중'


def _legacy_action(case: LocalCase) -> str:
    if case.stage == 1:
        path = _legacy_path(case)
        status = _legacy_status(case)
        if path == '문자 안내 우선':
            if status in {'대기', '임박'}:
                return '문자 안내 발송'
            if status == '지연':
                return '문자 리마인드 발송'
            return '문자 발송 결과 확인'
        if path == '보호자 우선 접촉':
            return '보호자 안내 연락'
        if path == '사전 기준 점검':
            return '채널 검증 필요'
        if path == '상담사 우선 접촉':
            return '상담사 직접 연락'
        if case.status in {'QUEUED', 'WAITING_EXAM'}:
            return '1차 전화 재시도'
        return '초기 접촉 점검'
    if case.stage == 2:
        if case.status in {'WAITING_EXAM', 'EXAM_RESULT_PENDING'}:
            return '검사결과 수신'
        return '분류 결과 확인'
    if case.status in {'CLOSED', 'DONE'}:
        return '케어플랜 종결 검토'
    return '재평가 일정 생성'


def _resolve_contact_mode(case: LocalCase) -> str:
    raw = dict(case.raw_json or {})
    ops = raw.get('ops') if isinstance(raw.get('ops'), dict) else {}
    mode = str(ops.get('contactMode') or '').upper()
    if mode in {'HUMAN', 'AGENT'}:
        return mode
    if case.stage != 1:
        return 'HUMAN'
    if _legacy_path(case) == '문자 안내 우선':
        return 'AGENT'
    return 'HUMAN'


def _is_demo_unassigned(case: LocalCase) -> bool:
    if case.stage != 1:
        return False
    if not (case.case_id.startswith('CASE-2026-') or case.case_id.startswith('CASE-TOKEN-')):
        return False
    return _seed_ratio(case.case_id, 'owner') < 0.22


def _quality_label(case: LocalCase) -> str:
    metrics = case.metrics_json if isinstance(case.metrics_json, dict) else {}
    score_raw = metrics.get('dataQualityPct')
    try:
        score = int(float(score_raw))
    except Exception:
        score = 80
    if score >= 90:
        return '양호'
    if score >= 75:
        return '주의'
    return '경고'


def _alert_tags(case: LocalCase, overdue_by_case: dict[str, int]) -> list[str]:
    tags: list[str] = []
    status = str(case.status or '').upper()
    if status in {'QUEUED', 'WAITING_EXAM', 'EXAM_RESULT_PENDING', 'ON_HOLD'}:
        tags.append('SLA 임박')
    if overdue_by_case.get(case.case_id, 0) > 0 and 'SLA 임박' not in tags:
        tags.append('SLA 임박')

    if case.stage == 2:
        raw = dict(case.raw_json or {})
        case_state = raw.get('caseState') if isinstance(raw.get('caseState'), dict) else {}
        classification = str(case_state.get('classification') or '').upper()
        risk_score_raw = case_state.get('riskScore')
        try:
            risk_score = int(float(risk_score_raw))
        except Exception:
            risk_score = None
        if not classification:
            tags.append('MCI 미등록')
        if classification in {'MCI_HIGH', 'AD'} or str(case.alert_level or '').upper() == 'HIGH' or (isinstance(risk_score, int) and risk_score >= 70):
            tags.append('High MCI')
        if case.status in {'WAITING_EXAM', 'EXAM_RESULT_PENDING'}:
            tags.append('연계 대기')

    if case.stage >= 3:
        tags.append('재평가 필요')
        churn_risk = str(((case.raw_json or {}).get('headerMeta') or {}).get('churn_risk') or '').upper()
        if churn_risk == 'HIGH':
            tags.append('이탈 위험')

    deduped = []
    for tag in tags:
        if tag not in deduped:
            deduped.append(tag)
    return deduped


def _owner_name_map(db: Session) -> dict[str, str]:
    rows = db.execute(select(LocalUser)).scalars().all()
    return {row.id: row.name for row in rows}


def _overdue_by_case(db: Session) -> dict[str, int]:
    now = _utcnow()
    rows = db.execute(
        select(Schedule.case_id, func.count())
        .where(and_(Schedule.status.in_(['SCHEDULED', 'QUEUED']), Schedule.start_at < now))
        .group_by(Schedule.case_id)
    ).all()
    return {str(case_id): int(count or 0) for case_id, count in rows}


def _case_record(case: LocalCase, owner_map: dict[str, str], overdue_map: dict[str, int]) -> dict[str, Any]:
    subject = case.subject_json if isinstance(case.subject_json, dict) else {}
    manager = owner_map.get(case.owner_id or '', case.owner_id or '담당자 미지정')
    if _is_demo_unassigned(case):
        manager = '담당자 미지정'
    guardian_phone = subject.get('guardianPhone')
    if not guardian_phone and _seed_ratio(case.case_id, 'guardian') < 0.38:
        guardian_phone = f"010-****-{(1000 + int(_seed_ratio(case.case_id, 'g4') * 8000)):04d}"
    return {
        'id': case.case_id,
        'stage': _stage_label(case.stage),
        'risk': _legacy_risk(case),
        'path': _legacy_path(case),
        'status': _legacy_status(case),
        'manager': manager,
        'action': _legacy_action(case),
        'updated': _fmt_local(case.updated_at),
        'quality': _quality_label(case),
        'profile': {
            'name': str(subject.get('maskedName') or f'대상자-{case.case_id[-4:]}'),
            'age': int(subject.get('age') or 74),
            'phone': str(subject.get('maskedPhone') or '010-****-0000'),
            'guardianPhone': guardian_phone,
        },
        'alertTags': _alert_tags(case, overdue_map),
    }


def list_dashboard_case_records(db: Session, *, stage: str | None, status: str | None, keyword: str | None) -> list[dict[str, Any]]:
    rows = db.execute(select(LocalCase).order_by(desc(LocalCase.updated_at))).scalars().all()
    owner_map = _owner_name_map(db)
    overdue_map = _overdue_by_case(db)

    records = [_case_record(row, owner_map, overdue_map) for row in rows]

    if stage and stage != 'ALL':
        target = str(stage).replace('STAGE', '').replace('Stage ', '').strip()
        records = [row for row in records if row['stage'].endswith(target)]

    if status and status != 'ALL':
        normalized = str(status).strip()
        records = [row for row in records if row['status'] == normalized]

    if keyword:
        q = str(keyword).strip().lower()
        if q:
            records = [
                row
                for row in records
                if q in str(row['id']).lower()
                or q in str(row['profile']['name']).lower()
                or q in str(row['manager']).lower()
            ]

    return records


def build_dashboard_stats(db: Session, records: list[dict[str, Any]]) -> dict[str, Any]:
    total = max(1, len(records))
    stage_counts = {1: 0, 2: 0, 3: 0}
    contact_needed = 0
    stage2_waiting = 0
    high_risk_mci = 0
    stage3_waiting = 0
    churn_risk = 0

    for row in records:
        stage_label = str(row.get('stage') or '')
        if stage_label.endswith('1'):
            stage_counts[1] += 1
            if row.get('status') in {'대기', '임박', '지연'}:
                contact_needed += 1
        elif stage_label.endswith('2'):
            stage_counts[2] += 1
            if row.get('status') in {'대기', '임박', '지연'}:
                stage2_waiting += 1
            if 'High MCI' in (row.get('alertTags') or []):
                high_risk_mci += 1
        else:
            stage_counts[3] += 1
            if row.get('status') in {'대기', '임박', '지연', '진행중'}:
                stage3_waiting += 1
            if '이탈 위험' in (row.get('alertTags') or []):
                churn_risk += 1

    high_mci_list = [
        {
            'id': row['id'],
            'age': row['profile'].get('age', 0),
            'probability': f"{72 + (idx % 9)}%",
            'period': '30일',
            'nextAction': '추적 등록',
        }
        for idx, row in enumerate(records)
        if 'High MCI' in (row.get('alertTags') or [])
    ][:5]

    def to_priority_task(row: dict[str, Any]) -> dict[str, Any]:
        return {
            'id': row['id'],
            'name': row['profile'].get('name', row['id']),
            'age': row['profile'].get('age', 0),
            'stage': row['stage'],
            'reason': ', '.join(row.get('alertTags') or ['운영 확인']),
            'action': row.get('action', '확인'),
            'sla': '24h' if 'SLA 임박' in (row.get('alertTags') or []) else '72h',
        }

    priority_tasks = [to_priority_task(row) for row in records if row.get('status') in {'대기', '임박', '지연'}]

    pinned_task = next((to_priority_task(row) for row in records if str(row.get('id')) == TOP_PRIORITY_STAGE1_CASE_ID), None)
    if pinned_task is not None:
        priority_tasks = [pinned_task, *[task for task in priority_tasks if task.get('id') != TOP_PRIORITY_STAGE1_CASE_ID]]

    priority_tasks = priority_tasks[:6]

    stage1_base = max(stage_counts[1], 1)
    stage2_mci = max(high_risk_mci, min(stage_counts[2], stage2_waiting))
    stage2_rate = round(stage_counts[2] / stage1_base * 100, 1)
    mci_rate = round(stage2_mci / stage1_base * 100, 1)
    high_mci_rate = round(high_risk_mci / stage1_base * 100, 1)
    stage3_rate = round(stage_counts[3] / stage1_base * 100, 1)

    pipeline_data = [
        {
            'name': '1차 선별',
            'count': stage_counts[1],
            'rate': 100.0,
            'drop': 0.0,
            'wait': contact_needed,
        },
        {
            'name': '2차 평가',
            'count': stage_counts[2],
            'rate': stage2_rate,
            'drop': max(0.0, round(100 - stage2_rate, 1)),
            'wait': stage2_waiting,
        },
        {
            'name': 'MCI',
            'count': stage2_mci,
            'rate': mci_rate,
            'drop': max(0.0, round(stage2_rate - mci_rate, 1)),
            'wait': stage2_waiting,
        },
        {
            'name': 'High MCI',
            'count': high_risk_mci,
            'rate': high_mci_rate,
            'drop': max(0.0, round(mci_rate - high_mci_rate, 1)),
            'wait': high_risk_mci,
        },
        {
            'name': '3차 감별',
            'count': stage_counts[3],
            'rate': stage3_rate,
            'drop': max(0.0, round(high_mci_rate - stage3_rate, 1)),
            'wait': stage3_waiting,
        },
    ]

    mci_distribution = [
        {'name': 'MCI-High', 'value': high_risk_mci, 'color': '#ef4444'},
        {'name': 'MCI-Mid', 'value': max(0, stage2_waiting - high_risk_mci), 'color': '#f59e0b'},
        {'name': 'Stable', 'value': max(0, stage_counts[3] - churn_risk), 'color': '#10b981'},
    ]

    return {
        'contactNeeded': contact_needed,
        'stage2Waiting': stage2_waiting,
        'highRiskMci': high_risk_mci,
        'stage3Waiting': stage3_waiting,
        'churnRisk': churn_risk,
        'stageCounts': stage_counts,
        'pipelineData': pipeline_data,
        'mciDistribution': mci_distribution,
        'highRiskMciList': high_mci_list,
        'priorityTasks': priority_tasks,
    }


def build_case_entity(db: Session, case_id: str) -> dict[str, Any]:
    case = ensure_case(db, case_id)
    legacy_status = _legacy_status(case)
    contact_mode = _resolve_contact_mode(case)
    assignee_id = None if _is_demo_unassigned(case) else case.owner_id

    stage2_run = db.execute(
        select(Stage2ModelRun).where(Stage2ModelRun.case_id == case.case_id).order_by(desc(Stage2ModelRun.created_at)).limit(1)
    ).scalar_one_or_none()
    stage3_run = db.execute(
        select(Stage3ModelRun).where(Stage3ModelRun.case_id == case.case_id).order_by(desc(Stage3ModelRun.created_at)).limit(1)
    ).scalar_one_or_none()

    model2_available = stage2_run is not None
    model3_available = stage3_run is not None

    if model2_available and stage2_run:
        score = float(stage2_run.score)
        if score >= 0.75:
            predicted_label = '치매'
            classification = 'AD'
            mci_band = '위험'
        elif score >= 0.45:
            predicted_label = 'MCI'
            classification = 'MCI'
            mci_band = '중간' if score < 0.62 else '위험'
        else:
            predicted_label = '정상'
            classification = 'NORMAL'
            mci_band = '양호'
    else:
        score = 0.0
        predicted_label = None
        classification = None
        mci_band = None

    model3_label = None
    model3_risk = None
    if model3_available and stage3_run:
        model3_risk = max(0.0, min(1.0, float(stage3_run.score)))
        if model3_risk >= 0.4:
            model3_label = 'HIGH'
        elif model3_risk >= 0.25:
            model3_label = 'MID'
        else:
            model3_label = 'LOW'

    subject = case.subject_json if isinstance(case.subject_json, dict) else {}

    created_at = case.created_at.isoformat() if case.created_at else _utcnow().isoformat()
    updated_at = case.updated_at.isoformat() if case.updated_at else _utcnow().isoformat()

    return {
        'caseId': case.case_id,
        'stage': int(case.stage),
        'assigneeId': assignee_id,
        'region': {
            'sido': '서울특별시',
            'sigungu': '강남구',
            'center': '강남구 치매안심센터',
        },
        'patient': {
            'name': str(subject.get('maskedName') or f'대상자-{case.case_id[-4:]}'),
            'age': int(subject.get('age') or 74),
            'phone': str(subject.get('maskedPhone') or '010-****-0000'),
            'caregiverPhone': subject.get('guardianPhone'),
        },
        'status': 'CLOSED'
        if legacy_status == '완료'
        else ('ON_HOLD' if legacy_status == '지연' else ('WAITING_RESULTS' if legacy_status in {'대기', '임박'} else 'IN_PROGRESS')),
        'operationStep': (
            'COMPLETED'
            if legacy_status == '완료'
            else (
                'FOLLOW_UP'
                if case.stage >= 3
                else (
                    'WAITING'
                    if legacy_status in {'대기', '임박', '지연'}
                    else ('RESULT_READY' if model2_available else 'IN_PROGRESS')
                )
            )
        ),
        'modelStatus': 'DONE' if (model2_available or model3_available) else 'PENDING',
        'classification': classification,
        'riskScore': int(max(0, min(100, round(score * 100 if score else 55)))),
        'createdAt': created_at,
        'updatedAt': updated_at,
        'stage2Route': 'CENTER',
        'computed': {
            'evidence': {
                'stage2': {
                    'required': {'specialist': True, 'mmse': None, 'cdrOrGds': None, 'neuroType': None, 'neuroScore': None},
                    'completed': model2_available,
                    'missing': [] if model2_available else ['검사결과 수신 필요'],
                },
                'stage3': {
                    'required': {'biomarker': True, 'imaging': True, 'biomarkerResult': None, 'imagingResult': None, 'performedAt': None},
                    'completed': model3_available,
                    'missing': [] if model3_available else ['Stage3 모델 결과 필요'],
                },
            },
            'model2': {
                'available': model2_available,
                'probs': {'NORMAL': max(0.0, 1 - score), 'MCI': max(0.0, min(score, 0.7)), 'AD': max(0.0, score - 0.3)} if model2_available else None,
                'predictedLabel': predicted_label,
                'mciScore': int(round(score * 100)) if model2_available else None,
                'mciBand': mci_band,
                'modelVersion': stage2_run.model_version if stage2_run else None,
                'updatedAt': stage2_run.created_at.isoformat() if stage2_run and stage2_run.created_at else None,
            },
            'model3': {
                'available': model3_available,
                'risk2yNow': model3_risk,
                'risk2yAt2y': model3_risk,
                'conversionRisk1y': model3_risk,
                'conversionRisk2y': model3_risk,
                'conversionRisk3y': model3_risk,
                'currentRiskIndex': model3_risk,
                'label': model3_label,
                'confidence': 'MID' if model3_available else None,
                'modelVersion': stage3_run.model_version if stage3_run else None,
                'updatedAt': stage3_run.created_at.isoformat() if stage3_run and stage3_run.created_at else None,
            },
            'ops': {
                'contactMode': contact_mode,
                'lastContactAt': updated_at,
                'bookingPendingCount': int(
                    db.execute(
                        select(func.count())
                        .select_from(WorkItem)
                        .where(and_(WorkItem.case_id == case.case_id, WorkItem.item_type.like('%BOOKING%'), WorkItem.status.in_(['OPEN', 'IN_PROGRESS'])))
                    ).scalar_one()
                    or 0
                ),
                'approvalsPendingCount': int(
                    db.execute(
                        select(func.count())
                        .select_from(WorkItem)
                        .where(and_(WorkItem.case_id == case.case_id, WorkItem.item_type.like('%APPROVAL%'), WorkItem.status.in_(['OPEN', 'IN_PROGRESS'])))
                    ).scalar_one()
                    or 0
                ),
                'dataQualityScore': 95 if _quality_label(case) == '양호' else (82 if _quality_label(case) == '주의' else 65),
                'missingFieldCount': 0 if _quality_label(case) == '양호' else (2 if _quality_label(case) == '주의' else 5),
            },
        },
    }


def build_case_events(db: Session, case_id: str) -> list[dict[str, Any]]:
    ensure_case(db, case_id)
    rows = db.execute(
        select(TimelineEvent).where(TimelineEvent.case_id == case_id).order_by(desc(TimelineEvent.at)).limit(200)
    ).scalars().all()

    mapped: list[dict[str, Any]] = []
    for idx, row in enumerate(rows):
        event_type = str(row.event_type or '').upper()
        if event_type == 'INFERENCE_REQUESTED':
            mapped_type = 'INFERENCE_REQUESTED'
        elif event_type in {'INFERENCE_STARTED', 'INFERENCE_PROGRESS'}:
            mapped_type = 'INFERENCE_STARTED'
        elif event_type == 'INFERENCE_COMPLETED':
            mapped_type = 'INFERENCE_COMPLETED'
        elif event_type in {'CALENDAR', 'REEVAL_SCHEDULED'}:
            mapped_type = 'BOOKING_CREATED'
        elif event_type in {'CONTACT', 'RECONTACT'}:
            mapped_type = 'CONTACT_RESULT'
        elif event_type == 'STATUS':
            mapped_type = 'STAGE_CHANGE'
        else:
            mapped_type = 'DATA_SYNCED'

        mapped.append(
            {
                'eventId': row.id or f'evt-{case_id}-{idx + 1}',
                'caseId': case_id,
                'at': row.at.isoformat() if row.at else _utcnow().isoformat(),
                'actorId': row.actor_name,
                'type': mapped_type,
                'payload': row.payload_json or {'title': row.title, 'detail': row.detail, 'eventType': row.event_type},
            }
        )

    if mapped:
        return mapped

    # Ensure empty timelines still render a stable history card.
    stage3_payload = get_stage3_case(db, case_id)
    return [
        {
            'eventId': f'evt-{case_id}-bootstrap',
            'caseId': case_id,
            'at': _utcnow().isoformat(),
            'actorId': 'system',
            'type': 'DATA_SYNCED',
            'payload': {
                'stage': stage3_payload.get('stage'),
                'status': stage3_payload.get('status'),
            },
        }
    ]
