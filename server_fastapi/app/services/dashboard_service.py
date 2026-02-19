from __future__ import annotations

from datetime import date, datetime, timezone
from hashlib import sha256
from typing import Any

from sqlalchemy import desc, func, select
from sqlalchemy.orm import Session

from server_fastapi.app.core.config import get_settings
from server_fastapi.app.models.analytics import KpiSnapshot
from server_fastapi.app.models.ingestion import EventRaw
from server_fastapi.app.schemas.central import (
    BottleneckResponse,
    CentralCaseListResponse,
    CentralDashboardKpisResponse,
    DashboardDataOut,
    FunnelResponse,
    LinkageResponse,
    RegionComparisonResponse,
)
from server_fastapi.app.services.cache_service import get_json, set_json

settings = get_settings()

KPI_IDS = [
    'SIGNAL_QUALITY',
    'POLICY_IMPACT',
    'BOTTLENECK_RISK',
    'DATA_READINESS',
    'GOVERNANCE_SAFETY',
]

KPI_TO_KEY = {
    'SIGNAL_QUALITY': 'signalQuality',
    'POLICY_IMPACT': 'policyImpact',
    'BOTTLENECK_RISK': 'bottleneckRisk',
    'DATA_READINESS': 'dataReadiness',
    'GOVERNANCE_SAFETY': 'governanceSafety',
}

REGION_LIST = [
    {'code': '11', 'name': '서울특별시'},
    {'code': '26', 'name': '부산광역시'},
    {'code': '27', 'name': '대구광역시'},
    {'code': '28', 'name': '인천광역시'},
    {'code': '29', 'name': '광주광역시'},
    {'code': '30', 'name': '대전광역시'},
    {'code': '31', 'name': '울산광역시'},
    {'code': '36', 'name': '세종특별자치시'},
    {'code': '41', 'name': '경기도'},
    {'code': '43', 'name': '충청북도'},
    {'code': '44', 'name': '충청남도'},
    {'code': '45', 'name': '전라북도'},
    {'code': '46', 'name': '전라남도'},
    {'code': '47', 'name': '경상북도'},
    {'code': '48', 'name': '경상남도'},
    {'code': '50', 'name': '제주특별자치도'},
    {'code': '51', 'name': '강원특별자치도'},
]


def _h(seed: str) -> int:
    return int(sha256(seed.encode('utf-8')).hexdigest()[:12], 16)


def _sv(seed: str, min_value: float, max_value: float) -> float:
    span = max_value - min_value
    if span <= 0:
        return min_value
    ratio = (_h(seed) % 10000) / 10000.0
    return min_value + ratio * span


def _latest_snapshot_date(db: Session) -> date | None:
    return db.execute(select(func.max(KpiSnapshot.d))).scalar_one_or_none()


def _build_cache_key(scope_level: str, scope_id: str, window: str, period_variant: str, kpi_version: str = 'v1') -> str:
    return f'dash:{scope_level}:{scope_id}:{window}:{period_variant}:{kpi_version}'


def _snapshot_kpis(db: Session, window: str, scope_level: str, scope_id: str) -> list[dict[str, Any]]:
    snapshot_date = _latest_snapshot_date(db)
    if snapshot_date is None:
        return []

    rows = db.execute(
        select(KpiSnapshot)
        .where(
            KpiSnapshot.d == snapshot_date,
            KpiSnapshot.scope_level == scope_level,
            KpiSnapshot.scope_id == scope_id,
            KpiSnapshot.kpi_id.in_(KPI_IDS),
        )
        .order_by(KpiSnapshot.kpi_id)
    ).scalars().all()

    if not rows:
        return []

    results: list[dict[str, Any]] = []
    for row in rows:
        results.append(
            {
                'kpiId': row.kpi_id,
                'window': window,
                'numerator': float(row.numerator),
                'denominator': float(row.denominator),
                'value': float(row.value),
                'delta7d': float(row.delta7d),
                'auxiliary': row.auxiliary_json or {},
                'sparkline': [float(row.value)] * 7,
            }
        )

    return results


def _fallback_kpis(window: str, period_variant: str, scope_level: str, scope_id: str) -> list[dict[str, Any]]:
    seed = f'kpi:{window}:{period_variant}:{scope_level}:{scope_id}'
    signal = round(_sv(f'{seed}:sq', 85, 97), 1)
    policy = round(_sv(f'{seed}:pi', 12, 42), 1)
    bottle = round(_sv(f'{seed}:br', 18, 55), 1)
    data = round(_sv(f'{seed}:dr', 80, 98), 1)
    gov = round(_sv(f'{seed}:gs', 88, 99), 1)

    return [
        {
            'kpiId': 'SIGNAL_QUALITY',
            'window': window,
            'numerator': round(signal * 120),
            'denominator': 12000,
            'value': signal,
            'delta7d': round(signal - 91.0, 1),
            'auxiliary': {'valid_events': int(signal * 100)},
            'sparkline': [round(signal - 1.5 + i * 0.2, 1) for i in range(7)],
        },
        {
            'kpiId': 'POLICY_IMPACT',
            'window': window,
            'numerator': policy,
            'denominator': 100,
            'value': policy,
            'delta7d': round(policy - 24.0, 1),
            'auxiliary': {'rollbackCount': int(_sv(f'{seed}:rb', 0, 3))},
            'sparkline': [round(policy + ((i % 3) - 1) * 0.8, 1) for i in range(7)],
        },
        {
            'kpiId': 'BOTTLENECK_RISK',
            'window': window,
            'numerator': bottle,
            'denominator': 100,
            'value': bottle,
            'delta7d': round(bottle - 34.0, 1),
            'auxiliary': {'l2BacklogCount': int(_sv(f'{seed}:bc', 20, 180))},
            'sparkline': [round(bottle + ((i % 2) * 0.9), 1) for i in range(7)],
        },
        {
            'kpiId': 'DATA_READINESS',
            'window': window,
            'numerator': round(data * 110),
            'denominator': 11000,
            'value': data,
            'delta7d': round(data - 90.0, 1),
            'auxiliary': {'missingFieldRate': round(_sv(f'{seed}:mf', 1, 12), 1)},
            'sparkline': [round(data - 1.0 + i * 0.25, 1) for i in range(7)],
        },
        {
            'kpiId': 'GOVERNANCE_SAFETY',
            'window': window,
            'numerator': round(gov * 11),
            'denominator': 1100,
            'value': gov,
            'delta7d': round(gov - 95.0, 1),
            'auxiliary': {'missingResponsible': int(_sv(f'{seed}:mr', 0, 8))},
            'sparkline': [round(gov - 0.7 + i * 0.1, 1) for i in range(7)],
        },
    ]


def get_dashboard_kpis(
    db: Session,
    *,
    window: str,
    period_variant: str,
    scope_level: str = 'nation',
    scope_id: str = 'KR',
) -> CentralDashboardKpisResponse:
    rows = _snapshot_kpis(db, window, scope_level, scope_id)
    if not rows:
        rows = _fallback_kpis(window, period_variant, scope_level, scope_id)

    payload = {
        'window': window,
        'timestamp': datetime.now(timezone.utc).isoformat(),
        'kpis': rows,
    }
    return CentralDashboardKpisResponse.model_validate(payload)


def get_funnel(window: str, period_variant: str) -> FunnelResponse:
    seed = f'funnel:{window}:{period_variant}'
    reach = int(_sv(f'{seed}:reach', 50000, 120000))
    s0 = int(reach * _sv(f'{seed}:s0', 0.25, 0.40))
    s1 = int(s0 * _sv(f'{seed}:s1', 0.10, 0.20))
    consent = int(s1 * _sv(f'{seed}:consent', 0.50, 0.72))
    l1 = int(consent * _sv(f'{seed}:l1', 0.25, 0.38))
    l2 = int(consent * _sv(f'{seed}:l2', 0.12, 0.25))
    s2 = int((l1 + l2) * _sv(f'{seed}:s2', 0.35, 0.55))
    s3 = int(s2 * _sv(f'{seed}:s3', 0.15, 0.35))

    raw = [
        ('Reach', '접근(Reach)', reach),
        ('Stage0', '0차 스크리닝', s0),
        ('Stage1', '1차 위험 신호', s1),
        ('Consent', '동의 획득', consent),
        ('L1', 'L1 일반상담', l1),
        ('L2', 'L2 심층상담', l2),
        ('Stage2', '2차 연결', s2),
        ('Stage3', '3차 추적관리', s3),
    ]

    stages: list[dict[str, Any]] = []
    prev = None
    for stage, label, count in raw:
        conversion = 100.0 if prev in (None, 0) else round((count / prev) * 100.0, 1)
        stages.append({'stage': stage, 'label': label, 'count': count, 'conversionRate': conversion})
        prev = count

    return FunnelResponse.model_validate({'window': window, 'stages': stages})


def get_bottlenecks(window: str, period_variant: str) -> BottleneckResponse:
    seed = f'bn:{window}:{period_variant}'
    metrics = [
        {
            'key': 'consent_pending_rate',
            'label': '동의 보류율',
            'value': round(_sv(f'{seed}:cp', 15, 45), 1),
            'unit': '%',
            'threshold': 30,
            'status': 'red',
            'category': 'consent',
        },
        {
            'key': 'input_readiness_rate',
            'label': '입력 준비율',
            'value': round(_sv(f'{seed}:ir', 70, 98), 1),
            'unit': '%',
            'threshold': 90,
            'status': 'yellow',
            'category': 'readiness',
        },
        {
            'key': 'stage2_blocked_rate',
            'label': '2차 차단율',
            'value': round(_sv(f'{seed}:s2b', 5, 25), 1),
            'unit': '%',
            'threshold': 15,
            'status': 'red',
            'category': 'blocked',
        },
        {
            'key': 'queue_depth',
            'label': '메시지 큐 깊이',
            'value': int(_sv(f'{seed}:qd', 0, 500)),
            'unit': '건',
            'threshold': 200,
            'status': 'yellow',
            'category': 'system',
        },
    ]
    return BottleneckResponse.model_validate({'window': window, 'metrics': metrics})


def get_linkage(window: str, period_variant: str) -> LinkageResponse:
    seed = f'link:{window}:{period_variant}'
    metrics = [
        {
            'stage': 'stage2',
            'linkageRate': round(_sv(f'{seed}:s2lr', 55, 82), 1),
            'medianLeadTimeDays': round(_sv(f'{seed}:s2lt', 3, 12), 1),
            'blockedCount': int(_sv(f'{seed}:s2bc', 15, 90)),
            'blockedReasons': [
                {'reason': '서류 미비', 'count': int(_sv(f'{seed}:s2r1', 5, 30))},
                {'reason': '기관 거부', 'count': int(_sv(f'{seed}:s2r2', 3, 20))},
            ],
        },
        {
            'stage': 'stage3',
            'linkageRate': round(_sv(f'{seed}:s3lr', 40, 70), 1),
            'medianLeadTimeDays': round(_sv(f'{seed}:s3lt', 7, 28), 1),
            'blockedCount': int(_sv(f'{seed}:s3bc', 5, 40)),
            'blockedReasons': [
                {'reason': '이탈(dropout)', 'count': int(_sv(f'{seed}:s3r1', 3, 15))},
                {'reason': '재평가 대기', 'count': int(_sv(f'{seed}:s3r2', 2, 10))},
            ],
        },
    ]
    return LinkageResponse.model_validate({'window': window, 'metrics': metrics})


def get_regions(db: Session, window: str, period_variant: str) -> RegionComparisonResponse:
    snapshot_date = _latest_snapshot_date(db)
    rows: list[dict[str, Any]] = []

    if snapshot_date is not None:
        snap_rows = db.execute(
            select(KpiSnapshot)
            .where(KpiSnapshot.d == snapshot_date, KpiSnapshot.scope_level == 'sido')
            .order_by(KpiSnapshot.scope_id, KpiSnapshot.kpi_id)
        ).scalars().all()

        grouped: dict[str, dict[str, float]] = {}
        for row in snap_rows:
            grouped.setdefault(row.scope_id, {})[row.kpi_id] = float(row.value)

        for idx, region in enumerate(REGION_LIST):
            values = grouped.get(region['code']) or grouped.get(str(idx + 1)) or {}
            if not values:
                continue
            rows.append(
                {
                    'regionCode': region['code'],
                    'regionName': region['name'],
                    'signalQuality': round(values.get('SIGNAL_QUALITY', 90.0), 1),
                    'policyImpact': round(values.get('POLICY_IMPACT', 25.0), 1),
                    'bottleneckRisk': round(values.get('BOTTLENECK_RISK', 35.0), 1),
                    'dataReadiness': round(values.get('DATA_READINESS', 92.0), 1),
                    'governanceSafety': round(values.get('GOVERNANCE_SAFETY', 96.0), 1),
                    'blockedPct': round(max(1.0, 100 - values.get('DATA_READINESS', 92.0)) / 2.0, 1),
                    'consentPct': round(min(100.0, values.get('SIGNAL_QUALITY', 90.0) - 10.0), 1),
                    'backlogCount': int(max(1, values.get('BOTTLENECK_RISK', 35.0) * 2)),
                }
            )

    if not rows:
        seed = f'regions:{window}:{period_variant}'
        for region in REGION_LIST:
            rs = f'{seed}:{region["code"]}'
            rows.append(
                {
                    'regionCode': region['code'],
                    'regionName': region['name'],
                    'signalQuality': round(_sv(f'{rs}:sq', 80, 98), 1),
                    'policyImpact': round(_sv(f'{rs}:pi', 10, 45), 1),
                    'bottleneckRisk': round(_sv(f'{rs}:br', 15, 55), 1),
                    'dataReadiness': round(_sv(f'{rs}:dr', 78, 99), 1),
                    'governanceSafety': round(_sv(f'{rs}:gs', 85, 99), 1),
                    'blockedPct': round(_sv(f'{rs}:blk', 5, 30), 1),
                    'consentPct': round(_sv(f'{rs}:cnp', 40, 80), 1),
                    'backlogCount': int(_sv(f'{rs}:bc', 5, 120)),
                }
            )

    rows.sort(key=lambda item: item['blockedPct'], reverse=True)
    return RegionComparisonResponse.model_validate({'window': window, 'rows': rows})


def get_cases(db: Session, page: int, page_size: int, filters: dict[str, str] | None = None) -> CentralCaseListResponse:
    filters = filters or {}
    query = select(EventRaw).order_by(desc(EventRaw.event_ts))

    if stage := filters.get('stage'):
        query = query.where(EventRaw.stage == stage)
    if event_type := filters.get('event_type'):
        query = query.where(EventRaw.event_type == event_type)

    total = db.execute(select(func.count()).select_from(query.subquery())).scalar_one()
    rows = db.execute(query.offset((page - 1) * page_size).limit(page_size)).scalars().all()

    items = [
        {
            'caseId': row.case_key,
            'regionCode': row.region_path.get('region', 'KR') if isinstance(row.region_path, dict) else 'KR',
            'regionName': row.region_path.get('region', '전국') if isinstance(row.region_path, dict) else '전국',
            'currentStage': row.stage,
            'urgency': 'high' if row.event_type.endswith('BLOCKED') else 'medium',
            'createdAt': row.event_ts.isoformat(),
            'lastEventAt': row.event_ts.isoformat(),
            'blockedReason': row.payload.get('reason') if isinstance(row.payload, dict) else None,
        }
        for row in rows
    ]

    return CentralCaseListResponse.model_validate(
        {
            'total': int(total),
            'page': page,
            'pageSize': page_size,
            'items': items,
        }
    )


def _build_bundle(window: str, kpis: list[dict[str, Any]], regions: RegionComparisonResponse) -> dict[str, Any]:
    lookup = {item['kpiId']: item for item in kpis}

    def _bundle_for(kpi_id: str, higher_better: bool) -> dict[str, Any]:
        key = KPI_TO_KEY[kpi_id]
        base = lookup[kpi_id]
        region_series = [
            {'regionCode': row.regionCode, 'regionName': row.regionName, 'value': getattr(row, key)} for row in regions.rows
        ]

        sorted_rows = sorted(region_series, key=lambda r: r['value'], reverse=not higher_better)
        worst = sorted_rows[:5]
        best = list(reversed(sorted_rows[-5:]))

        return {
            'national': {
                'value': base['value'],
                'deltaPP': base['delta7d'],
                'target': 95.0 if higher_better else 30.0,
                'numerator': base['numerator'],
                'denominator': base['denominator'],
            },
            'regions': region_series,
            'breakdown': [
                {'name': '핵심', 'value': round(base['value'] * 0.6, 1), 'color': '#2563eb'},
                {'name': '보조', 'value': round(base['value'] * 0.4, 1), 'color': '#93c5fd'},
            ],
            'breakdownType': 'donut' if higher_better else 'bar',
            'cause': [
                {'name': '운영', 'value': round(base['value'] * 0.45, 1)},
                {'name': '데이터', 'value': round(base['value'] * 0.35, 1)},
                {'name': '정책', 'value': round(base['value'] * 0.20, 1)},
            ],
            'causeType': 'bar',
            'trend': [
                {'period': f'D{i + 1}', 'value': round(base['value'] - 1.2 + i * 0.25, 1)}
                for i in range(7)
            ],
            'worstRegions': worst,
            'bestRegions': best,
        }

    return {
        'signalQuality': _bundle_for('SIGNAL_QUALITY', True),
        'policyImpact': _bundle_for('POLICY_IMPACT', False),
        'bottleneckRisk': _bundle_for('BOTTLENECK_RISK', False),
        'dataReadiness': _bundle_for('DATA_READINESS', True),
        'governanceSafety': _bundle_for('GOVERNANCE_SAFETY', True),
    }


def get_dashboard_bundle(
    db: Session,
    *,
    window: str,
    period_variant: str,
    scope_level: str,
    scope_id: str,
) -> DashboardDataOut:
    cache_key = _build_cache_key(scope_level, scope_id, window, period_variant)
    cached = get_json(cache_key)
    if isinstance(cached, dict):
        return DashboardDataOut.model_validate(cached)

    kpi_payload = get_dashboard_kpis(
        db,
        window=window,
        period_variant=period_variant,
        scope_level=scope_level,
        scope_id=scope_id,
    )
    regions = get_regions(db, window=window, period_variant=period_variant)
    bundle = _build_bundle(window, [k.model_dump() for k in kpi_payload.kpis], regions)

    ttl = min(max(settings.cache_ttl_seconds, settings.cache_min_ttl_seconds), settings.cache_max_ttl_seconds)
    set_json(cache_key, bundle, ttl)

    return DashboardDataOut.model_validate(bundle)


def get_latest_snapshot_version(db: Session, scope_level: str, scope_id: str) -> str:
    row = db.execute(
        select(KpiSnapshot.computed_at)
        .where(KpiSnapshot.scope_level == scope_level, KpiSnapshot.scope_id == scope_id)
        .order_by(desc(KpiSnapshot.computed_at))
        .limit(1)
    ).scalar_one_or_none()
    if row is None:
        return ''
    return row.isoformat()
