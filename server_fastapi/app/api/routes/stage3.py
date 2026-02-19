from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from server_fastapi.app.core.security import AuthUser, get_current_user
from server_fastapi.app.db.session import get_db
from server_fastapi.app.schemas.local_center import Stage3ModelRunCreatePayload
from server_fastapi.app.services.local_case_service import create_stage3_model_run

router = APIRouter(tags=['stage3'])


@router.post('/api/stage3/model-runs')
def post_stage3_model_run(
    payload: Stage3ModelRunCreatePayload,
    db: Session = Depends(get_db),
    user: AuthUser = Depends(get_current_user),
) -> dict:
    return create_stage3_model_run(db, payload, actor_name=user.user_id)
