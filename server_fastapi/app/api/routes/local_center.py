from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from server_fastapi.app.core.security import AuthUser, get_current_user
from server_fastapi.app.db.session import get_db
from server_fastapi.app.schemas.local_center import (
    LocalCasesListResponse,
    LocalDashboardKpiResponse,
    WorkItemCreatePayload,
    WorkItemPatchPayload,
)
from server_fastapi.app.services.local_case_service import (
    create_work_item,
    get_case_summary,
    get_local_dashboard_kpis,
    list_audit_events,
    list_local_cases,
    update_work_item,
)

router = APIRouter(tags=['local-center'])


@router.get('/api/local-center/cases', response_model=LocalCasesListResponse)
def get_local_cases(
    stage: str | None = Query(default=None),
    alert: str | None = Query(default=None),
    q: str | None = Query(default=None),
    ownerType: str | None = Query(default=None),
    priorityTier: str | None = Query(default=None),
    status: str | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    size: int = Query(default=20, ge=1, le=200),
    db: Session = Depends(get_db),
) -> LocalCasesListResponse:
    return list_local_cases(
        db,
        stage=stage,
        alert=alert,
        q=q,
        owner_type=ownerType,
        priority_tier=priorityTier,
        status=status,
        page=page,
        size=size,
    )


@router.get('/api/local-center/cases/{case_id}/summary')
def get_local_case_summary(case_id: str, db: Session = Depends(get_db)) -> dict:
    return get_case_summary(db, case_id).model_dump()


@router.get('/api/local-center/dashboard/kpis', response_model=LocalDashboardKpiResponse)
def get_local_kpis(db: Session = Depends(get_db)) -> LocalDashboardKpiResponse:
    return get_local_dashboard_kpis(db)


@router.post('/api/local-center/work-items')
def post_work_item(
    payload: WorkItemCreatePayload,
    db: Session = Depends(get_db),
    user: AuthUser = Depends(get_current_user),
) -> dict:
    return create_work_item(db, payload, actor_name=user.user_id)


@router.patch('/api/local-center/work-items/{work_item_id}')
def patch_work_item(
    work_item_id: str,
    payload: WorkItemPatchPayload,
    db: Session = Depends(get_db),
    user: AuthUser = Depends(get_current_user),
) -> dict:
    return update_work_item(db, work_item_id, payload, actor_name=user.user_id)


@router.get('/api/local-center/audit-events')
def get_local_audit_events(
    caseId: str | None = Query(default=None),
    from_at: datetime | None = Query(default=None, alias='from'),
    to_at: datetime | None = Query(default=None, alias='to'),
    db: Session = Depends(get_db),
) -> dict:
    rows = list_audit_events(db, case_id=caseId, from_at=from_at, to_at=to_at)
    return {'items': [row.model_dump() for row in rows], 'total': len(rows)}
