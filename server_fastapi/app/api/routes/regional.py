from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from server_fastapi.app.db.session import get_db
from server_fastapi.app.services.regional_service import (
    _parse_district_tokens,
    build_area_comparison,
    build_cause_summary,
    build_cause_topn,
    build_cause_trend,
    build_dashboard_district_rows,
    build_report_summary,
    create_intervention_from_cause_snapshot,
    ensure_regional_snapshot_scope,
    get_intervention_items,
    put_intervention_items,
)

router = APIRouter(tags=['regional'])


class InterventionSnapshotUpsertBody(BaseModel):
    regionId: str = Field(default='seoul')
    period: str = Field(default='week')
    items: list[dict[str, Any]] = Field(default_factory=list)


class CauseInterventionCreateBody(BaseModel):
    from_: str | None = Field(default=None, alias='from')
    queryState: dict[str, Any] = Field(default_factory=dict)
    beforeSnapshot: dict[str, Any] = Field(default_factory=dict)


@router.get('/api/regional/dashboard/districts')
def get_regional_dashboard_districts(
    regionId: str = Query(default='seoul'),
    period: str = Query(default='week'),
    rangePreset: str = Query(default='7d'),
    district: list[str] = Query(default=[]),
    db: Session = Depends(get_db),
) -> dict:
    districts = _parse_district_tokens(district)
    items = build_dashboard_district_rows(
        db,
        region_id=regionId,
        period=period,
        range_preset=rangePreset,
        districts=districts,
    )
    return {
        'items': items,
        'regionId': regionId,
        'period': period,
        'rangePreset': rangePreset,
        'fetchedAt': __import__('datetime').datetime.utcnow().isoformat() + 'Z',
        'source': 'db',
    }


@router.get('/api/regional/cause/summary')
def get_regional_cause_summary(
    regionId: str = Query(default='seoul'),
    kpiKey: str = Query(default='regionalQueueRisk'),
    sigungu: str = Query(default=''),
    period: str = Query(default='week'),
    selectedStage: str | None = Query(default=None),
    selectedCauseKey: str | None = Query(default=None),
    db: Session = Depends(get_db),
) -> dict:
    stage = None if selectedStage in {None, '', 'all'} else selectedStage
    cause = None if selectedCauseKey in {None, '', 'all'} else selectedCauseKey
    return build_cause_summary(
        db,
        region_id=regionId,
        kpi_key=kpiKey,
        sigungu=sigungu,
        period=period,
        selected_stage=stage,
        selected_cause_key=cause,
    )


@router.get('/api/regional/cause/causes')
def get_regional_cause_topn(
    regionId: str = Query(default='seoul'),
    kpiKey: str = Query(default='regionalQueueRisk'),
    sigungu: str = Query(default=''),
    period: str = Query(default='week'),
    selectedStage: str | None = Query(default=None),
    selectedArea: str | None = Query(default=None),
    db: Session = Depends(get_db),
) -> dict:
    stage = None if selectedStage in {None, '', 'all'} else selectedStage
    area = None if selectedArea in {None, '', 'all'} else selectedArea
    return build_cause_topn(
        db,
        region_id=regionId,
        kpi_key=kpiKey,
        sigungu=sigungu,
        period=period,
        selected_stage=stage,
        selected_area=area,
    )


@router.get('/api/regional/cause/area-comparison')
def get_regional_area_comparison(
    regionId: str = Query(default='seoul'),
    kpiKey: str = Query(default='regionalQueueRisk'),
    sigungu: str = Query(default=''),
    period: str = Query(default='week'),
    selectedStage: str | None = Query(default=None),
    selectedCauseKey: str | None = Query(default=None),
    district: list[str] = Query(default=[]),
    db: Session = Depends(get_db),
) -> list[dict[str, Any]]:
    stage = None if selectedStage in {None, '', 'all'} else selectedStage
    cause = None if selectedCauseKey in {None, '', 'all'} else selectedCauseKey
    districts = [value for value in district if value]
    return build_area_comparison(
        db,
        region_id=regionId,
        kpi_key=kpiKey,
        sigungu=sigungu,
        period=period,
        selected_stage=stage,
        selected_cause_key=cause,
        districts=districts,
    )


@router.get('/api/regional/cause/trend')
def get_regional_cause_trend(
    regionId: str = Query(default='seoul'),
    kpiKey: str = Query(default='regionalQueueRisk'),
    sigungu: str = Query(default=''),
    period: str = Query(default='week'),
    selectedStage: str | None = Query(default=None),
    selectedCauseKey: str | None = Query(default=None),
    selectedArea: str | None = Query(default=None),
    trendMetric: str = Query(default='ratio'),
    db: Session = Depends(get_db),
) -> dict:
    stage = None if selectedStage in {None, '', 'all'} else selectedStage
    cause = None if selectedCauseKey in {None, '', 'all'} else selectedCauseKey
    area = None if selectedArea in {None, '', 'all'} else selectedArea
    return build_cause_trend(
        db,
        region_id=regionId,
        kpi_key=kpiKey,
        sigungu=sigungu,
        period=period,
        selected_stage=stage,
        selected_cause_key=cause,
        selected_area=area,
        trend_metric=trendMetric,
    )


@router.post('/api/regional/cause/interventions')
def post_regional_cause_intervention(
    body: CauseInterventionCreateBody,
    db: Session = Depends(get_db),
) -> dict:
    payload = {
        'from': body.from_,
        'queryState': body.queryState,
        'beforeSnapshot': body.beforeSnapshot,
    }
    return create_intervention_from_cause_snapshot(db, payload=payload)


@router.get('/api/regional/interventions/snapshot')
def get_regional_interventions_snapshot(
    regionId: str = Query(default='seoul'),
    period: str = Query(default='week'),
    db: Session = Depends(get_db),
) -> dict:
    ensure_regional_snapshot_scope(db, region_id=regionId, period=period)
    items = get_intervention_items(db, region_id=regionId, period=period)
    return {
        'regionId': regionId,
        'period': period,
        'items': items,
        'count': len(items),
    }


@router.put('/api/regional/interventions/snapshot')
def put_regional_interventions_snapshot(
    body: InterventionSnapshotUpsertBody,
    db: Session = Depends(get_db),
) -> dict:
    return put_intervention_items(db, region_id=body.regionId, period=body.period, items=body.items)


@router.get('/api/regional/reports/summary')
def get_regional_report_summary(
    regionId: str = Query(default='seoul'),
    scopeMode: str = Query(default='regional'),
    sgg: str = Query(default=''),
    kpi: str = Query(default='all'),
    period: str = Query(default='week'),
    db: Session = Depends(get_db),
) -> dict:
    return build_report_summary(
        db,
        region_id=regionId,
        scope_mode=scopeMode,
        sgg=sgg,
        kpi=kpi,
        period=period,
    )
