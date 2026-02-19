from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from server_fastapi.app.db.session import get_db
from server_fastapi.app.schemas.central import (
    BottleneckResponse,
    CentralCaseListResponse,
    CentralDashboardKpisResponse,
    DashboardDataOut,
    FunnelResponse,
    LinkageResponse,
    RegionComparisonResponse,
)
from server_fastapi.app.services.dashboard_service import (
    get_bottlenecks,
    get_cases,
    get_dashboard_bundle,
    get_dashboard_kpis,
    get_funnel,
    get_linkage,
    get_regions,
)

router = APIRouter(tags=['central-dashboard'])


@router.get('/dashboard/kpis', response_model=CentralDashboardKpisResponse)
def dashboard_kpis(
    window: str = Query('LAST_7D'),
    periodVariant: str = Query('default'),
    scope_level: str = Query('nation'),
    scope_id: str = Query('KR'),
    db: Session = Depends(get_db),
) -> CentralDashboardKpisResponse:
    return get_dashboard_kpis(
        db,
        window=window,
        period_variant=periodVariant,
        scope_level=scope_level,
        scope_id=scope_id,
    )


@router.get('/dashboard/bundle', response_model=DashboardDataOut)
def dashboard_bundle(
    window: str = Query('LAST_7D'),
    periodVariant: str = Query('default'),
    scope_level: str = Query('nation'),
    scope_id: str = Query('KR'),
    child_codes: str | None = Query(default=None),
    db: Session = Depends(get_db),
) -> DashboardDataOut:
    _ = child_codes
    return get_dashboard_bundle(
        db,
        window=window,
        period_variant=periodVariant,
        scope_level=scope_level,
        scope_id=scope_id,
    )


@router.get('/metrics/funnel', response_model=FunnelResponse)
def metrics_funnel(window: str = Query('LAST_7D'), periodVariant: str = Query('default')) -> FunnelResponse:
    return get_funnel(window=window, period_variant=periodVariant)


@router.get('/metrics/bottlenecks', response_model=BottleneckResponse)
def metrics_bottlenecks(window: str = Query('LAST_7D'), periodVariant: str = Query('default')) -> BottleneckResponse:
    return get_bottlenecks(window=window, period_variant=periodVariant)


@router.get('/metrics/linkage', response_model=LinkageResponse)
def metrics_linkage(window: str = Query('LAST_7D'), periodVariant: str = Query('default')) -> LinkageResponse:
    return get_linkage(window=window, period_variant=periodVariant)


@router.get('/metrics/regions', response_model=RegionComparisonResponse)
def metrics_regions(
    window: str = Query('LAST_7D'),
    periodVariant: str = Query('default'),
    db: Session = Depends(get_db),
) -> RegionComparisonResponse:
    return get_regions(db, window=window, period_variant=periodVariant)


@router.get('/cases', response_model=CentralCaseListResponse)
def central_cases(
    page: int = Query(1, ge=1),
    pageSize: int = Query(10, ge=1, le=100),
    stage: str | None = Query(default=None),
    event_type: str | None = Query(default=None),
    db: Session = Depends(get_db),
) -> CentralCaseListResponse:
    filters = {}
    if stage:
        filters['stage'] = stage
    if event_type:
        filters['event_type'] = event_type
    return get_cases(db, page=page, page_size=pageSize, filters=filters)
