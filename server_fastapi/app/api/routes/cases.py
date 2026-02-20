from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from server_fastapi.app.core.security import AuthUser, get_current_user
from server_fastapi.app.db.session import get_db
from server_fastapi.app.schemas.local_center import (
    ExecuteActionBody,
    InferenceRunPayload,
    OutcomeSavePayload,
    OutcomeSaveResponse,
    SupportRequestBody,
)
from server_fastapi.app.services.local_case_service import (
    execute_stage3_action,
    get_inference_job,
    get_stage3_case,
    reconcile_case_ops_loop,
    run_case_inference,
    save_stage1_outcome,
    support_request,
)

router = APIRouter(tags=['local-cases'])


@router.post('/api/cases/{case_id}/outcomes', response_model=OutcomeSaveResponse)
def save_case_outcome(
    case_id: str,
    payload: OutcomeSavePayload,
    db: Session = Depends(get_db),
    user: AuthUser = Depends(get_current_user),
) -> OutcomeSaveResponse:
    return save_stage1_outcome(db, case_id, payload, actor_name=user.user_id, actor_type='human')


@router.get('/api/cases/{case_id}')
def get_case(case_id: str, db: Session = Depends(get_db)) -> dict:
    return get_stage3_case(db, case_id)


@router.post('/api/cases/{case_id}/actions/execute')
def execute_case_action(
    case_id: str,
    body: ExecuteActionBody,
    db: Session = Depends(get_db),
    user: AuthUser = Depends(get_current_user),
) -> dict:
    return execute_stage3_action(db, case_id, body, actor_name=user.user_id)


@router.post('/api/cases/{case_id}/support-request')
def create_support_request(
    case_id: str,
    body: SupportRequestBody,
    db: Session = Depends(get_db),
) -> dict:
    return support_request(db, case_id, body)


@router.post('/api/cases/{case_id}/ops-loop/reconcile')
def reconcile_ops_loop(
    case_id: str,
    db: Session = Depends(get_db),
    user: AuthUser = Depends(get_current_user),
) -> dict:
    return reconcile_case_ops_loop(db, case_id, actor_name=user.user_id).model_dump()


@router.post('/api/cases/{case_id}/inference/run')
def run_inference(
    case_id: str,
    payload: InferenceRunPayload,
    db: Session = Depends(get_db),
    user: AuthUser = Depends(get_current_user),
) -> dict:
    return run_case_inference(db, case_id, payload, actor_name=user.user_id)


@router.get('/api/inference/{job_id}')
def get_inference_status(
    job_id: str,
    db: Session = Depends(get_db),
) -> dict:
    return get_inference_job(db, job_id)
