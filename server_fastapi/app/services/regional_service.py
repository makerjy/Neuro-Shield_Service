from __future__ import annotations

from collections import Counter
from datetime import datetime, timedelta, timezone
from hashlib import sha256
from typing import Any
from uuid import uuid4

from fastapi import HTTPException
from sqlalchemy import and_, func, select
from sqlalchemy.orm import Session

from server_fastapi.app.models.citizen import CitizenRequest
from server_fastapi.app.models.local_center import (
    ContactPlan,
    LocalCase,
    RegionalSnapshot,
    Schedule,
    Stage2ModelRun,
    Stage3ModelRun,
    WorkItem,
)

CAUSE_CATALOG: list[dict[str, Any]] = [
    {'causeKey': 'staff_shortage', 'causeLabel': '인력 여유 부족', 'owner': 'center', 'actionable': True, 'regionalNeed': 'high'},
    {'causeKey': 'contact_failure', 'causeLabel': '연락 미성공', 'owner': 'center', 'actionable': True, 'regionalNeed': 'high'},
    {'causeKey': 'data_gap', 'causeLabel': '데이터 부족', 'owner': 'system', 'actionable': True, 'regionalNeed': 'medium'},
    {'causeKey': 'hospital_slot_delay', 'causeLabel': '검사 슬롯 지연', 'owner': 'hospital', 'actionable': False, 'regionalNeed': 'high'},
    {'causeKey': 'external_dependency', 'causeLabel': '외부 연계 지연', 'owner': 'external', 'actionable': False, 'regionalNeed': 'medium'},
]

STAGE_META: list[tuple[str, str]] = [
    ('contact', '접촉'),
    ('recontact', '재접촉'),
    ('L2', 'L2'),
    ('3rd', '3차'),
]

DEFAULT_DISTRICTS = ['강남구', '서초구', '송파구', '강동구', '마포구', '영등포구']


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _new_id(prefix: str) -> str:
    return f'{prefix}-{uuid4().hex[:12]}'


def _h(seed: str) -> int:
    return int(sha256(seed.encode('utf-8')).hexdigest()[:12], 16)


def _sv(seed: str, min_value: float, max_value: float) -> float:
    span = max_value - min_value
    if span <= 0:
        return min_value
    ratio = (_h(seed) % 10000) / 10000.0
    return min_value + ratio * span


def _parse_district_tokens(tokens: list[str]) -> list[dict[str, str]]:
    parsed: list[dict[str, str]] = []
    for idx, raw in enumerate(tokens):
        value = str(raw or '').strip()
        if not value:
            continue
        if '::' in value:
            code, name = value.split('::', 1)
        else:
            code, name = f'D-{idx + 1:03d}', value
        code = code.strip() or f'D-{idx + 1:03d}'
        name = name.strip() or f'구역-{idx + 1}'
        parsed.append({'code': code, 'name': name})

    if parsed:
        return parsed

    return [{'code': f'D-{idx + 1:03d}', 'name': name} for idx, name in enumerate(DEFAULT_DISTRICTS)]


def _collect_base_metrics(db: Session) -> dict[str, int]:
    now = _utcnow()
    total_cases = int(db.execute(select(func.count()).select_from(LocalCase)).scalar_one() or 0)
    stage1_cases = int(db.execute(select(func.count()).select_from(LocalCase).where(LocalCase.stage == 1)).scalar_one() or 0)
    stage2_cases = int(db.execute(select(func.count()).select_from(LocalCase).where(LocalCase.stage == 2)).scalar_one() or 0)
    stage3_cases = int(db.execute(select(func.count()).select_from(LocalCase).where(LocalCase.stage >= 3)).scalar_one() or 0)
    high_alert_cases = int(
        db.execute(select(func.count()).select_from(LocalCase).where(LocalCase.alert_level.in_(['HIGH', 'MID']))).scalar_one() or 0
    )
    overdue_schedules = int(
        db.execute(
            select(func.count())
            .select_from(Schedule)
            .where(and_(Schedule.status.in_(['SCHEDULED', 'QUEUED']), Schedule.start_at < now))
        ).scalar_one()
        or 0
    )
    overdue_contacts = int(
        db.execute(
            select(func.count())
            .select_from(ContactPlan)
            .where(and_(ContactPlan.status.in_(['PENDING', 'QUEUED']), ContactPlan.next_contact_at < now))
        ).scalar_one()
        or 0
    )
    open_work_items = int(
        db.execute(select(func.count()).select_from(WorkItem).where(WorkItem.status.in_(['OPEN', 'IN_PROGRESS']))).scalar_one() or 0
    )
    stage2_runs = int(db.execute(select(func.count()).select_from(Stage2ModelRun)).scalar_one() or 0)
    stage3_runs = int(db.execute(select(func.count()).select_from(Stage3ModelRun)).scalar_one() or 0)
    citizen_pending = int(
        db.execute(select(func.count()).select_from(CitizenRequest).where(CitizenRequest.status == 'RECEIVED')).scalar_one() or 0
    )

    queue_pressure = max(1, overdue_schedules + overdue_contacts + open_work_items)
    if total_cases <= 0:
        # Empty environments still need operational demo figures.
        total_cases = 36
        stage1_cases = 14
        stage2_cases = 12
        stage3_cases = 10
        high_alert_cases = 9
        queue_pressure = 22

    return {
        'total_cases': total_cases,
        'stage1_cases': max(1, stage1_cases),
        'stage2_cases': max(1, stage2_cases),
        'stage3_cases': max(1, stage3_cases),
        'high_alert_cases': max(1, high_alert_cases),
        'overdue_schedules': max(1, overdue_schedules),
        'overdue_contacts': max(1, overdue_contacts),
        'open_work_items': max(1, open_work_items),
        'stage2_runs': max(1, stage2_runs),
        'stage3_runs': max(1, stage3_runs),
        'citizen_pending': max(1, citizen_pending),
        'queue_pressure': queue_pressure,
    }


def _period_scale(period: str) -> float:
    if period == 'month':
        return 1.12
    if period == 'quarter':
        return 1.26
    return 1.0


def _round(v: float, digits: int = 1) -> float:
    return round(float(v), digits)


def build_dashboard_district_rows(
    db: Session,
    *,
    region_id: str,
    period: str,
    range_preset: str,
    districts: list[dict[str, str]],
) -> list[dict[str, Any]]:
    base = _collect_base_metrics(db)
    n = max(1, len(districts))
    period_mul = _period_scale(period)

    rows: list[dict[str, Any]] = []
    for idx, district in enumerate(districts):
        code = district['code']
        name = district['name']
        seed = f'{region_id}:{period}:{range_preset}:{code}:{name}'
        scale = _sv(f'{seed}:scale', 0.72, 1.34) * period_mul

        volume = int(max(24, (base['total_cases'] * 4 / n) * scale + _sv(f'{seed}:vol_noise', 8, 80)))
        queue_count = int(max(10, (base['queue_pressure'] * 1.8 / n) * scale + _sv(f'{seed}:queue_noise', 6, 52)))
        inflow_count = int(max(12, (base['stage1_cases'] * 2.2 / n) * scale + _sv(f'{seed}:inflow_noise', 5, 38)))

        recontact_rate = _round(min(38, max(6, (base['overdue_contacts'] * 100 / max(base['total_cases'], 1)) * 0.6 + _sv(f'{seed}:recontact', 4, 20))))
        data_ready = _round(min(98, max(54, 100 - (base['citizen_pending'] * 100 / (base['total_cases'] * 1.8)) + _sv(f'{seed}:data', -8, 8))))
        governance = _round(min(99, max(62, 100 - (base['open_work_items'] * 100 / (base['total_cases'] * 2.4)) + _sv(f'{seed}:gov', -7, 9))))
        ad_density = _round(min(92, max(18, (base['high_alert_cases'] * 100 / max(base['total_cases'], 1)) + _sv(f'{seed}:ad', -10, 18))))
        dx_delay = _round(min(52, max(6, 8 + (base['stage2_cases'] * 22 / max(base['total_cases'], 1)) + _sv(f'{seed}:dx', -4, 14))))
        screen_to_dx = _round(min(90, max(28, 70 - dx_delay * 0.7 + _sv(f'{seed}:conv', -10, 9))))

        queue_type_backlog = [
            {'name': '재접촉 큐', 'value': int(queue_count * _sv(f'{seed}:qt1', 0.24, 0.36))},
            {'name': 'L2 큐', 'value': int(queue_count * _sv(f'{seed}:qt2', 0.18, 0.28))},
            {'name': '2차 큐', 'value': int(queue_count * _sv(f'{seed}:qt3', 0.14, 0.24))},
            {'name': '3차 큐', 'value': int(queue_count * _sv(f'{seed}:qt4', 0.10, 0.19))},
        ]

        cause_items = [
            {'name': '연락 실패', 'value': int(queue_count * _sv(f'{seed}:c1', 0.16, 0.28))},
            {'name': '인력 여유 부족', 'value': int(queue_count * _sv(f'{seed}:c2', 0.14, 0.24))},
            {'name': '데이터 부족', 'value': int(queue_count * _sv(f'{seed}:c3', 0.10, 0.18))},
            {'name': '2차/3차 대기', 'value': int(queue_count * _sv(f'{seed}:c4', 0.08, 0.16))},
            {'name': '예약 지연', 'value': int(queue_count * _sv(f'{seed}:c5', 0.06, 0.14))},
        ]
        cause_items.sort(key=lambda item: item['value'], reverse=True)

        recontact_reasons = [
            {'name': '연락처 오류', 'value': int(queue_count * _sv(f'{seed}:rr1', 0.12, 0.24))},
            {'name': '미응답', 'value': int(queue_count * _sv(f'{seed}:rr2', 0.16, 0.30))},
            {'name': '시간대 불일치', 'value': int(queue_count * _sv(f'{seed}:rr3', 0.10, 0.20))},
        ]
        recontact_reasons.sort(key=lambda item: item['value'], reverse=True)

        stage_weights = {
            '접촉': _sv(f'{seed}:sw1', 12, 28),
            '재접촉': _sv(f'{seed}:sw2', 10, 24),
            'L2': _sv(f'{seed}:sw3', 8, 18),
            '2차': _sv(f'{seed}:sw4', 8, 20),
            '3차': _sv(f'{seed}:sw5', 6, 16),
        }
        stage_total = max(1.0, sum(stage_weights.values()))
        stage_contrib = [{'name': key, 'value': _round(value / stage_total * 100)} for key, value in stage_weights.items()]

        rows.append(
            {
                'regionId': code,
                'name': name,
                'volume': volume,
                'kpi': {
                    'regionalSla': inflow_count,
                    'regionalQueueRisk': queue_count,
                    'regionalRecontact': recontact_rate,
                    'regionalDataReadiness': data_ready,
                    'regionalGovernance': governance,
                    'regionalAdTransitionHotspot': ad_density,
                    'regionalDxDelayHotspot': dx_delay,
                    'regionalScreenToDxRate': screen_to_dx,
                },
                'mapMetric': {
                    'regionalSla': inflow_count,
                    'regionalQueueRisk': queue_count,
                    'regionalRecontact': recontact_rate,
                    'regionalDataReadiness': data_ready,
                    'regionalGovernance': governance,
                    'regionalAdTransitionHotspot': ad_density,
                    'regionalDxDelayHotspot': dx_delay,
                    'regionalScreenToDxRate': screen_to_dx,
                },
                'adTransitionSignal': {
                    'regionId': code,
                    'regionName': name,
                    'highRiskCount': int(max(8, volume * _sv(f'{seed}:ad_count', 0.09, 0.22))),
                    'transition30d': int(max(6, volume * _sv(f'{seed}:ad30', 0.04, 0.16))),
                    'transition90d': int(max(12, volume * _sv(f'{seed}:ad90', 0.12, 0.36))),
                    'densityScore': ad_density,
                    'deltaFromAvg': _round(ad_density - 45),
                },
                'differentialDelay': {
                    'regionId': code,
                    'regionName': name,
                    'avgWaitDays': dx_delay,
                    'delayedRatio': _round(min(0.42, max(0.05, dx_delay / 120 + _sv(f'{seed}:dr', 0.01, 0.09))), 3),
                    'backlogCount': int(max(10, queue_count * _sv(f'{seed}:db', 0.4, 1.1))),
                    'deltaFromAvg': _round(dx_delay - 24),
                },
                'stageConversionRate': {
                    'regionId': code,
                    'regionName': name,
                    'conversionRate': _round(max(0.25, min(0.9, screen_to_dx / 100)), 3),
                    'deltaFromRegional': _round(screen_to_dx - 64),
                },
                'adTransitionDrivers': [
                    {'name': '고위험 밀집', 'value': int(max(6, volume * _sv(f'{seed}:ad_d1', 0.08, 0.18)))},
                    {'name': '최근 30일 전환 신호', 'value': int(max(6, volume * _sv(f'{seed}:ad_d2', 0.04, 0.14)))},
                    {'name': '평균 대비 위험 편차', 'value': _round(ad_density - 45)},
                ],
                'dxDelayDrivers': [
                    {'name': '평균 대기일', 'value': dx_delay},
                    {'name': '지연 비율', 'value': _round(min(95, dx_delay * 1.8))},
                    {'name': '대기 인원', 'value': int(max(8, queue_count * _sv(f'{seed}:dx_b', 0.35, 0.75)))},
                ],
                'screenToDxDrivers': [
                    {'name': '전환율 역격차', 'value': _round(100 - screen_to_dx)},
                    {'name': '재접촉 보조율', 'value': _round(_sv(f'{seed}:sc1', 6, 24))},
                    {'name': '지연 보조지표', 'value': _round(_sv(f'{seed}:sc2', 8, 46))},
                ],
                'policyImpactLocal': _round(min(92, max(34, governance - recontact_rate * 0.4 + _sv(f'{seed}:policy', -6, 7)))),
                'slaStageContribution': stage_contrib,
                'queueTypeBacklog': queue_type_backlog,
                'queueCauseTop': cause_items,
                'recontactReasons': recontact_reasons,
                'recontactTrend': [
                    {'day': 'D-6', 'value': _round(_sv(f'{seed}:rt0', 6, 28))},
                    {'day': 'D-5', 'value': _round(_sv(f'{seed}:rt1', 7, 30))},
                    {'day': 'D-4', 'value': _round(_sv(f'{seed}:rt2', 8, 32))},
                    {'day': 'D-3', 'value': _round(_sv(f'{seed}:rt3', 9, 34))},
                    {'day': 'D-2', 'value': _round(_sv(f'{seed}:rt4', 10, 36))},
                    {'day': 'D-1', 'value': _round(_sv(f'{seed}:rt5', 11, 38))},
                    {'day': 'D0', 'value': _round(_sv(f'{seed}:rt6', 12, 40))},
                ],
                'recontactSlots': [
                    {'slot': '08-10', 'successRate': _round(_sv(f'{seed}:slot0', 42, 82)), 'attempts': int(max(10, queue_count * 0.16))},
                    {'slot': '10-12', 'successRate': _round(_sv(f'{seed}:slot1', 45, 84)), 'attempts': int(max(10, queue_count * 0.18))},
                    {'slot': '12-14', 'successRate': _round(_sv(f'{seed}:slot2', 40, 78)), 'attempts': int(max(10, queue_count * 0.14))},
                    {'slot': '14-16', 'successRate': _round(_sv(f'{seed}:slot3', 46, 86)), 'attempts': int(max(10, queue_count * 0.20))},
                    {'slot': '16-18', 'successRate': _round(_sv(f'{seed}:slot4', 44, 83)), 'attempts': int(max(10, queue_count * 0.18))},
                    {'slot': '18-20', 'successRate': _round(_sv(f'{seed}:slot5', 38, 74)), 'attempts': int(max(10, queue_count * 0.14))},
                ],
                'missingFields': [
                    {'name': '연락처 최신화', 'value': int(max(3, queue_count * _sv(f'{seed}:mf1', 0.07, 0.18)))},
                    {'name': '보호자 정보', 'value': int(max(3, queue_count * _sv(f'{seed}:mf2', 0.05, 0.14)))},
                    {'name': '기저질환 코드', 'value': int(max(3, queue_count * _sv(f'{seed}:mf3', 0.05, 0.13)))},
                    {'name': '이전 접촉 이력', 'value': int(max(3, queue_count * _sv(f'{seed}:mf4', 0.04, 0.11)))},
                ],
                'collectionLeadtime': [
                    {'name': '0-1일', 'value': int(max(4, volume * _sv(f'{seed}:lt1', 0.08, 0.20)))},
                    {'name': '2-3일', 'value': int(max(4, volume * _sv(f'{seed}:lt2', 0.06, 0.16)))},
                    {'name': '4-7일', 'value': int(max(3, volume * _sv(f'{seed}:lt3', 0.04, 0.12)))},
                    {'name': '8일+', 'value': int(max(2, volume * _sv(f'{seed}:lt4', 0.03, 0.10)))},
                ],
                'governanceMissingTypes': [
                    {'name': '책임자 미기록', 'value': int(max(2, queue_count * _sv(f'{seed}:gm1', 0.05, 0.14)))},
                    {'name': '근거 링크 누락', 'value': int(max(2, queue_count * _sv(f'{seed}:gm2', 0.05, 0.14)))},
                    {'name': '접촉 로그 누락', 'value': int(max(2, queue_count * _sv(f'{seed}:gm3', 0.05, 0.14)))},
                ],
                'governanceActionStatus': [
                    {'status': '미조치', 'value': int(max(2, queue_count * _sv(f'{seed}:ga1', 0.07, 0.18)))},
                    {'status': '조치중', 'value': int(max(2, queue_count * _sv(f'{seed}:ga2', 0.06, 0.16)))},
                    {'status': '완료', 'value': int(max(2, queue_count * _sv(f'{seed}:ga3', 0.05, 0.12)))},
                ],
                'stageImpact': {
                    'stage1SignalDelta': _round(_sv(f'{seed}:si1', -18, 24)),
                    'stage1QueueDelta': int(_sv(f'{seed}:sq1', -12, 30)),
                    'stage2SignalDelta': _round(_sv(f'{seed}:si2', -16, 22)),
                    'stage2QueueDelta': int(_sv(f'{seed}:sq2', -10, 26)),
                    'stage3SignalDelta': _round(_sv(f'{seed}:si3', -14, 18)),
                    'stage3QueueDelta': int(_sv(f'{seed}:sq3', -9, 22)),
                },
            }
        )

    return rows


def build_cause_summary(
    db: Session,
    *,
    region_id: str,
    kpi_key: str,
    sigungu: str,
    period: str,
    selected_stage: str | None,
    selected_cause_key: str | None,
) -> dict[str, Any]:
    base = _collect_base_metrics(db)
    seed = f'{region_id}:{kpi_key}:{sigungu}:{period}:{selected_stage or "all"}:{selected_cause_key or "all"}'

    total = max(60, int(base['queue_pressure'] * _sv(f'{seed}:total', 2.2, 4.8)))
    weights = {
        'contact': _sv(f'{seed}:w1', 0.22, 0.34),
        'recontact': _sv(f'{seed}:w2', 0.18, 0.30),
        'L2': _sv(f'{seed}:w3', 0.16, 0.26),
        '3rd': _sv(f'{seed}:w4', 0.14, 0.22),
    }
    weight_sum = sum(weights.values())
    rows: list[dict[str, Any]] = []

    for stage_key, stage_label in STAGE_META:
        count = int(max(8, total * (weights[stage_key] / max(weight_sum, 1e-6))))
        ratio = _round(count / max(total, 1) * 100)
        top_causes = []
        for cause in CAUSE_CATALOG[:3]:
            top_causes.append(
                {
                    'causeKey': cause['causeKey'],
                    'ratio': _round(_sv(f'{seed}:{stage_key}:{cause["causeKey"]}', 12, 46)),
                }
            )
        top_causes.sort(key=lambda item: item['ratio'], reverse=True)

        rows.append(
            {
                'stageKey': stage_key,
                'stageLabel': stage_label,
                'ratio': ratio,
                'count': count,
                'avgDwellMinutes': int(_sv(f'{seed}:{stage_key}:dwell', 56, 420)),
                'deltaVsRegionalAvg': _round(_sv(f'{seed}:{stage_key}:delta', -18, 21)),
                'topCauses': top_causes,
            }
        )

    classified_ratio = _round(min(96, max(42, (base['stage2_runs'] * 100 / max(base['total_cases'], 1)) + _sv(f'{seed}:cov', 8, 34))))
    unclassified_ratio = _round(max(4, 100 - classified_ratio))
    owners = ['center', 'hospital', 'system', 'external']

    backlog_type = 'snapshot_waiting' if _h(f'{seed}:backlog') % 100 < 78 else 'period_accumulated'
    denominator = ['overall', 'stage', 'cause'][_h(f'{seed}:den') % 3]
    ownership = ['resident', 'center', 'hospital'][_h(f'{seed}:own') % 3]

    return {
        'stageBacklogBreakdown': rows,
        'kpiDefinition': {
            'backlogType': backlog_type,
            'denominator': denominator,
            'areaOwnership': ownership,
        },
        'classificationCoverage': {
            'classifiedRatio': classified_ratio,
            'unclassifiedRatio': unclassified_ratio,
            'unclassifiedOwner': owners[_h(f'{seed}:owner') % len(owners)],
        },
    }


def build_cause_topn(
    db: Session,
    *,
    region_id: str,
    kpi_key: str,
    sigungu: str,
    period: str,
    selected_stage: str | None,
    selected_area: str | None,
) -> dict[str, Any]:
    base = _collect_base_metrics(db)
    seed = f'{region_id}:{kpi_key}:{sigungu}:{period}:{selected_stage or "all"}:{selected_area or "all"}'

    rows: list[dict[str, Any]] = []
    total = 0
    for idx, cause in enumerate(CAUSE_CATALOG):
        stage_bias = 1.0 if selected_stage is None else 1.15 + idx * 0.03
        area_bias = 1.0 if selected_area is None else 1.2
        count = int(max(8, (base['queue_pressure'] * _sv(f'{seed}:{cause["causeKey"]}:count', 2.4, 7.1)) * stage_bias * area_bias))
        total += count
        confidence = ['high', 'med', 'low'][_h(f'{seed}:{cause["causeKey"]}:conf') % 3]
        evidence_type = ['call_log', 'appointment', 'integration', 'manual'][_h(f'{seed}:{cause["causeKey"]}:etype') % 4]
        include_link = _h(f'{seed}:{cause["causeKey"]}:link') % 100 >= 25

        rows.append(
            {
                'causeKey': cause['causeKey'],
                'causeLabel': cause['causeLabel'],
                'ratio': 0.0,
                'count': count,
                'meta': {
                    'owner': cause['owner'],
                    'actionable': cause['actionable'],
                    'regionalNeed': cause['regionalNeed'],
                },
                'evidence': {
                    'type': evidence_type,
                    'link': f'/regional/bottleneck?cause={cause["causeKey"]}&evidence={evidence_type}' if include_link else None,
                    'confidence': confidence,
                    'missingReason': None if include_link else '원본 로그 연결 지연',
                },
            }
        )

    for row in rows:
        row['ratio'] = _round((row['count'] / max(total, 1)) * 100)

    rows.sort(key=lambda item: item['count'], reverse=True)

    coverage = build_cause_summary(
        db,
        region_id=region_id,
        kpi_key=kpi_key,
        sigungu=sigungu,
        period=period,
        selected_stage=selected_stage,
        selected_cause_key=None,
    )['classificationCoverage']

    return {'causes': rows, 'coverage': coverage}


def build_area_comparison(
    db: Session,
    *,
    region_id: str,
    kpi_key: str,
    sigungu: str,
    period: str,
    selected_stage: str | None,
    selected_cause_key: str | None,
    districts: list[str],
) -> list[dict[str, Any]]:
    base = _collect_base_metrics(db)
    seed = f'{region_id}:{kpi_key}:{sigungu}:{period}:{selected_stage or "all"}:{selected_cause_key or "all"}'
    parsed = districts or DEFAULT_DISTRICTS

    rows: list[dict[str, Any]] = []
    raw_scores: list[float] = []
    for area in parsed:
        score = _sv(f'{seed}:{area}:score', 12, 44)
        raw_scores.append(score)

    avg = sum(raw_scores) / max(len(raw_scores), 1)

    for idx, area in enumerate(parsed):
        ratio = _round(raw_scores[idx])
        count = int(max(6, base['queue_pressure'] * _sv(f'{seed}:{area}:count', 0.9, 2.9)))
        delta = _round(ratio - avg)
        if delta >= 6:
            highlight = 'critical'
        elif delta >= 2:
            highlight = 'watch'
        else:
            highlight = 'none'

        rows.append(
            {
                'areaKey': area,
                'areaLabel': area,
                'ratio': ratio,
                'count': count,
                'deltaVsAvg': delta,
                'highlightLevel': highlight,
            }
        )

    rows.sort(key=lambda item: item['ratio'], reverse=True)
    return rows


def build_cause_trend(
    db: Session,
    *,
    region_id: str,
    kpi_key: str,
    sigungu: str,
    period: str,
    selected_stage: str | None,
    selected_cause_key: str | None,
    selected_area: str | None,
    trend_metric: str,
) -> dict[str, Any]:
    base = _collect_base_metrics(db)
    seed = f'{region_id}:{kpi_key}:{sigungu}:{period}:{selected_stage or "all"}:{selected_cause_key or "all"}:{selected_area or "all"}:{trend_metric}'

    if period == 'quarter':
        labels = ['W-11', 'W-10', 'W-09', 'W-08', 'W-07', 'W-06', 'W-05', 'W-04', 'W-03', 'W-02', 'W-01', 'W-00']
    elif period == 'month':
        labels = ['D-13', 'D-12', 'D-11', 'D-10', 'D-09', 'D-08', 'D-07', 'D-06', 'D-05', 'D-04', 'D-03', 'D-02', 'D-01', 'D0']
    else:
        labels = ['D-6', 'D-5', 'D-4', 'D-3', 'D-2', 'D-1', 'D0']

    points: list[dict[str, Any]] = []
    base_count = _sv(f'{seed}:base_count', 60, 220) + base['queue_pressure'] * 0.3
    slope_count = _sv(f'{seed}:slope_count', -8, 10)
    base_ratio = _sv(f'{seed}:base_ratio', 10, 36)
    slope_ratio = _sv(f'{seed}:slope_ratio', -1.2, 1.8)

    for idx, label in enumerate(labels):
        count = int(max(1, base_count + slope_count * idx + _sv(f'{seed}:{label}:noise_count', -14, 14)))
        ratio = _round(max(0.4, min(98, base_ratio + slope_ratio * idx + _sv(f'{seed}:{label}:noise_ratio', -1.8, 1.8))))
        value = ratio if trend_metric == 'ratio' else float(count)
        points.append({'dateKey': label, 'value': value, 'count': count, 'ratio': ratio})

    alerts: list[dict[str, Any]] = []
    if len(points) >= 4:
        recent = points[-4:]
        count_up = all(recent[i + 1]['count'] >= recent[i]['count'] for i in range(len(recent) - 1))
        ratio_up = all(recent[i + 1]['ratio'] >= recent[i]['ratio'] for i in range(len(recent) - 1))

        if count_up:
            alerts.append(
                {
                    'type': 'increasing_streak',
                    'metric': 'count',
                    'days': 4,
                    'severity': 'critical' if recent[-1]['count'] - recent[0]['count'] >= 24 else 'watch',
                    'delta': float(recent[-1]['count'] - recent[0]['count']),
                }
            )
        if ratio_up:
            alerts.append(
                {
                    'type': 'no_decrease',
                    'metric': 'ratio',
                    'days': 4,
                    'severity': 'critical' if recent[-1]['ratio'] - recent[0]['ratio'] >= 4 else 'watch',
                    'delta': _round(recent[-1]['ratio'] - recent[0]['ratio']),
                }
            )

    return {'metric': trend_metric, 'points': points, 'alerts': alerts}


def _load_snapshot(db: Session, scope_key: str) -> RegionalSnapshot | None:
    return db.execute(select(RegionalSnapshot).where(RegionalSnapshot.scope_key == scope_key)).scalar_one_or_none()


def get_snapshot_payload(db: Session, scope_key: str) -> dict[str, Any] | None:
    row = _load_snapshot(db, scope_key)
    if not row:
        return None
    return dict(row.payload_json or {})


def put_snapshot_payload(
    db: Session,
    *,
    scope_key: str,
    region_id: str,
    payload: dict[str, Any],
    snapshot_id: str | None = None,
) -> RegionalSnapshot:
    now = _utcnow()
    row = _load_snapshot(db, scope_key)
    if row:
        row.region_id = region_id
        row.payload_json = payload
        row.updated_at = now
        db.flush()
        return row

    row = RegionalSnapshot(
        snapshot_id=snapshot_id or _new_id('SNAP'),
        scope_key=scope_key,
        region_id=region_id,
        payload_json=payload,
        created_at=now,
        updated_at=now,
    )
    db.add(row)
    db.flush()
    return row


def get_intervention_items(db: Session, *, region_id: str, period: str) -> list[dict[str, Any]]:
    scope_key = f'interventions:{region_id}:{period}'
    payload = get_snapshot_payload(db, scope_key)
    if not payload:
        return []
    items = payload.get('items') if isinstance(payload.get('items'), list) else []
    return [item for item in items if isinstance(item, dict)]


def put_intervention_items(db: Session, *, region_id: str, period: str, items: list[dict[str, Any]]) -> dict[str, Any]:
    scope_key = f'interventions:{region_id}:{period}'
    payload = {
        'items': items,
        'updatedAt': _utcnow().isoformat(),
    }
    put_snapshot_payload(db, scope_key=scope_key, region_id=region_id, payload=payload)
    db.commit()
    return {'ok': True, 'count': len(items), 'scopeKey': scope_key}


def _infer_intervention_type(kpi_key: str) -> str:
    if kpi_key == 'regionalDxDelayHotspot':
        return 'PATHWAY_TUNE'
    if kpi_key == 'regionalAdTransitionHotspot':
        return 'FOLLOWUP_AUTOMATION'
    if kpi_key == 'regionalQueueRisk':
        return 'STAFFING'
    if kpi_key == 'regionalDataReadiness':
        return 'DATA_FIX'
    return 'RECONTACT_PUSH'


def _normalize_intervention_stage(value: str | None) -> str:
    raw = str(value or '').strip()
    if raw in {'Stage1', 'Stage2', 'Stage3'}:
        return raw
    if raw in {'contact', 'recontact'}:
        return 'Stage1'
    if raw == 'L2':
        return 'Stage2'
    if raw == '3rd':
        return 'Stage3'
    return 'Stage1'


def _default_metric_snapshot(seed: str) -> dict[str, float]:
    return {
        'regionalSla': _round(_sv(f'{seed}:sla', 72, 96)),
        'regionalQueueRisk': _round(_sv(f'{seed}:queue', 110, 540)),
        'regionalRecontact': _round(_sv(f'{seed}:recontact', 7, 26)),
        'regionalDataReadiness': _round(_sv(f'{seed}:ready', 58, 92)),
        'regionalGovernance': _round(_sv(f'{seed}:gov', 68, 98)),
        'regionalAdTransitionHotspot': _round(_sv(f'{seed}:ad', 22, 81)),
        'regionalDxDelayHotspot': _round(_sv(f'{seed}:dx', 9, 52)),
        'regionalScreenToDxRate': _round(_sv(f'{seed}:conv', 34, 84)),
    }


def _create_intervention_item_from_snapshot(
    *,
    region_id: str,
    query_state: dict[str, Any],
    before_snapshot: dict[str, Any],
    snapshot_id: str,
) -> dict[str, Any]:
    now = _utcnow()
    kpi_key = str(query_state.get('kpiKey') or 'regionalQueueRisk')
    area_label = str(query_state.get('selectedCompareAreaKey') or query_state.get('areaKey') or query_state.get('sigungu') or '광역 전체')
    stage_key = _normalize_intervention_stage(query_state.get('selectedStage'))
    cause_key = str(query_state.get('selectedCauseKey') or 'staff_shortage')
    intervention_id = _new_id('INT')
    seed = f'{region_id}:{snapshot_id}:{intervention_id}'

    before_metrics = _default_metric_snapshot(f'{seed}:before')

    return {
        'id': intervention_id,
        'title': f'{area_label} {kpi_key} 대응 개입',
        'stageKey': stage_key,
        'areaKey': area_label,
        'areaLabel': area_label,
        'region': region_id,
        'kpiKey': kpi_key,
        'type': _infer_intervention_type(kpi_key),
        'status': 'TODO',
        'owner': '광역 운영팀',
        'ownerOrg': 'regional',
        'createdAt': now.isoformat(),
        'dueAt': (now + timedelta(days=3)).isoformat(),
        'ruleId': 'RULE-CAUSE-SNAPSHOT',
        'context': query_state,
        'assignment': {
            'ownerOrg': 'regional',
            'assigneeId': 'regional-ops-01',
            'assigneeName': '광역 운영팀',
            'assigneeRole': 'regional_ops',
            'slaHours': 72,
        },
        'successMetric': {
            'kpiKey': kpi_key,
            'metricType': 'ratio',
            'targetDelta': -5,
            'evaluationWindowDays': 14,
        },
        'createdFrom': {
            'causeKey': cause_key,
            'kpiKey': kpi_key,
            'snapshotId': snapshot_id,
            'queryState': query_state,
            'snapshot': {
                'kpiValue': float(before_snapshot.get('kpiValue') or before_metrics.get(kpi_key, 0.0)),
                'backlogCount': int(before_snapshot.get('backlogCount') or 0),
                'avgDwell': float(before_snapshot.get('avgDwellMin') or 0.0),
                'deltaVsRegional': float(before_snapshot.get('deltaVsRegional') or 0.0),
                'unit': '%',
            },
        },
        'expectedEffectTags': ['병목 완화', 'SLA 안정화'],
        'logs': [
            {
                'id': _new_id('LOG'),
                'type': 'instruction',
                'actor': '광역 운영팀',
                'actorOrg': 'regional',
                'timestamp': now.isoformat(),
                'requiresFollowup': True,
                'followupDueAt': (now + timedelta(hours=24)).isoformat(),
                'note': '원인분석 스냅샷 기반 개입 생성',
                'referenceLink': '/regional/bottleneck',
            }
        ],
        'kpiComparison': {
            'before': {
                'value': float(before_snapshot.get('kpiValue') or before_metrics.get(kpi_key, 0.0)),
                'backlog': int(before_snapshot.get('backlogCount') or 0),
            }
        },
        'notes': '원인 분석 스냅샷에서 자동 생성됨',
        'evidenceLinks': ['/regional/bottleneck'],
        'beforeMetrics': before_metrics,
        'afterMetrics': None,
        'timeline': [
            {
                'id': _new_id('TL'),
                'at': now.isoformat(),
                'actor': '시스템',
                'message': '원인 분석에서 개입 자동 생성',
            }
        ],
    }


def create_intervention_from_cause_snapshot(
    db: Session,
    *,
    payload: dict[str, Any],
) -> dict[str, Any]:
    query_state = payload.get('queryState') if isinstance(payload.get('queryState'), dict) else {}
    before_snapshot = payload.get('beforeSnapshot') if isinstance(payload.get('beforeSnapshot'), dict) else {}

    region_id = str(query_state.get('regionKey') or 'seoul')
    period = str(query_state.get('period') or 'week')

    snapshot_id = _new_id('SNAP')
    scope_key = f'cause:{snapshot_id}'
    put_snapshot_payload(
        db,
        scope_key=scope_key,
        region_id=region_id,
        payload={
            'queryState': query_state,
            'beforeSnapshot': before_snapshot,
            'createdAt': _utcnow().isoformat(),
        },
        snapshot_id=snapshot_id,
    )

    item = _create_intervention_item_from_snapshot(
        region_id=region_id,
        query_state=query_state,
        before_snapshot=before_snapshot,
        snapshot_id=snapshot_id,
    )

    existing = get_intervention_items(db, region_id=region_id, period=period)
    existing.insert(0, item)
    put_snapshot_payload(
        db,
        scope_key=f'interventions:{region_id}:{period}',
        region_id=region_id,
        payload={'items': existing, 'updatedAt': _utcnow().isoformat()},
    )

    db.commit()
    return {
        'interventionId': item['id'],
        'snapshotId': snapshot_id,
        'redirectUrl': f'/regional/interventions/new?interventionId={item["id"]}&snapshotId={snapshot_id}',
    }


def build_report_summary(
    db: Session,
    *,
    region_id: str,
    scope_mode: str,
    sgg: str,
    kpi: str,
    period: str,
) -> dict[str, Any]:
    base = _collect_base_metrics(db)
    seed = f'report:{region_id}:{scope_mode}:{sgg or "all"}:{kpi}:{period}'

    interventions = get_intervention_items(db, region_id=region_id, period=period)
    total_actions = len(interventions)
    pending_actions = sum(1 for item in interventions if str(item.get('status')) in {'TODO', 'BLOCKED'})

    queue_before = int(max(80, base['queue_pressure'] * _sv(f'{seed}:qb', 8, 20)))
    queue_after = int(max(20, queue_before - max(1, total_actions) * _sv(f'{seed}:qdelta', 4, 16)))
    effect_rate = _round(min(95, max(15, _sv(f'{seed}:effect', 38, 86) + total_actions * 1.2)))
    sla_prev = _round(_sv(f'{seed}:sla_prev', 11, 24))
    sla_now = _round(max(4, min(36, sla_prev + _sv(f'{seed}:sla_delta', -6.4, 4.2))))
    sla_delta = _round(sla_now - sla_prev)

    causes = build_cause_topn(
        db,
        region_id=region_id,
        kpi_key=kpi if kpi != 'all' else 'regionalQueueRisk',
        sigungu=sgg,
        period=period,
        selected_stage=None,
        selected_area=sgg or None,
    )['causes']
    cause_top3 = causes[:3]

    counter = Counter((str(item.get('title') or '개입 실행'), str(item.get('stageKey') or 'Stage1'), str(item.get('owner') or '광역 운영팀')) for item in interventions)
    intervention_summary = [
        {
            'title': title,
            'stage': stage,
            'owner': owner,
            'count': count,
            'status': '완료' if count % 3 == 0 else '진행',
        }
        for (title, stage, owner), count in counter.most_common(3)
    ]

    if not intervention_summary:
        intervention_summary = [
            {'title': '재접촉 슬롯 확대', 'stage': 'Stage1', 'owner': '광역 운영팀', 'count': 3, 'status': '진행'},
            {'title': '검사 연계 슬롯 요청', 'stage': 'Stage2', 'owner': '협약 병원 연계', 'count': 2, 'status': '완료'},
            {'title': '고위험군 후속 연락 강화', 'stage': 'Stage3', 'owner': '광역·기초센터 협업', 'count': 1, 'status': '진행'},
        ]

    kpi_before_after = [
        {
            'label': 'SLA 위험률',
            'before': sla_prev,
            'after': sla_now,
            'unit': '%',
            'higherBetter': False,
            'delta': _round(sla_now - sla_prev),
        },
        {
            'label': '병목 적체 건수',
            'before': float(queue_before),
            'after': float(queue_after),
            'unit': '건',
            'higherBetter': False,
            'delta': float(queue_after - queue_before),
        },
        {
            'label': '개입 효과 발생 비율',
            'before': _round(max(12, effect_rate - _sv(f'{seed}:effect_before', 6, 16))),
            'after': effect_rate,
            'unit': '%',
            'higherBetter': True,
            'delta': _round(effect_rate - max(12, effect_rate - _sv(f'{seed}:effect_before', 6, 16))),
        },
    ]

    unresolved_tasks = [
        {'title': 'Stage2 검사 연계 지연 구역 후속 조치', 'risk': '높음', 'recommendation': '협약 병원 슬롯 재배치 요청'},
        {'title': 'After 데이터 미수집 개입 항목 정리', 'risk': '중간', 'recommendation': '센터 보고 지연 항목 수집 요청'},
        {'title': '재접촉 미응답 구역 반복 모니터링', 'risk': '중간', 'recommendation': '자동 재접촉 캠페인 확대'},
    ]

    return {
        'metrics': {
            'queueBefore': queue_before,
            'queueAfter': queue_after,
            'queue': queue_after,
            'actions': total_actions,
            'pending': pending_actions,
            'bottleneckRelief': _round(((queue_before - queue_after) / max(queue_before, 1)) * 100),
            'effectRate': effect_rate,
            'slaPrev': sla_prev,
            'slaNow': sla_now,
            'slaDelta': sla_delta,
        },
        'causeTop3': cause_top3,
        'interventionSummary': intervention_summary,
        'kpiBeforeAfter': kpi_before_after,
        'unresolvedTasks': unresolved_tasks,
    }


def ensure_regional_snapshot_scope(db: Session, *, region_id: str, period: str) -> None:
    scope_key = f'interventions:{region_id}:{period}'
    if _load_snapshot(db, scope_key):
        return

    put_snapshot_payload(
        db,
        scope_key=scope_key,
        region_id=region_id,
        payload={'items': [], 'updatedAt': _utcnow().isoformat()},
    )
    db.commit()


def get_required_dict(body: dict[str, Any], key: str) -> dict[str, Any]:
    value = body.get(key)
    if not isinstance(value, dict):
        raise HTTPException(status_code=422, detail=f'{key} must be object')
    return value
