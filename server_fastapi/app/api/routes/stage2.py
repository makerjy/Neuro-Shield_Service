from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from server_fastapi.app.core.security import AuthUser, get_current_user
from server_fastapi.app.db.session import get_db
from server_fastapi.app.schemas.local_center import (
    Stage2ModelRunCreatePayload,
    Stage2Step2AutoFillPayload,
    Stage2Step2ManualEditPayload,
)
from server_fastapi.app.services.local_case_service import (
    apply_stage2_step2_manual_edit,
    create_stage2_model_run,
    get_stage2_step2_autofill,
)

router = APIRouter(tags=['stage2'])


@router.post('/api/stage2/model-runs')
def post_stage2_model_run(
    payload: Stage2ModelRunCreatePayload,
    db: Session = Depends(get_db),
    user: AuthUser = Depends(get_current_user),
) -> dict:
    return create_stage2_model_run(db, payload, actor_name=user.user_id)


@router.get('/api/stage2/cases/{case_id}/step2/autofill')
def get_stage2_case_step2_autofill(
    case_id: str,
    db: Session = Depends(get_db),
    user: AuthUser = Depends(get_current_user),
) -> Stage2Step2AutoFillPayload:
    return get_stage2_step2_autofill(db, case_id=case_id, actor_name=user.user_id)


@router.post('/api/stage2/cases/{case_id}/step2/manual-edit')
def post_stage2_case_step2_manual_edit(
    case_id: str,
    payload: Stage2Step2ManualEditPayload,
    db: Session = Depends(get_db),
    user: AuthUser = Depends(get_current_user),
) -> dict:
    return apply_stage2_step2_manual_edit(db, case_id=case_id, payload=payload, actor_name=user.user_id)
