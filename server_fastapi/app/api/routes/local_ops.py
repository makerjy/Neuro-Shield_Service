from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from server_fastapi.app.core.security import AuthUser, get_current_user
from server_fastapi.app.db.session import get_db
from server_fastapi.app.schemas.local_ops import (
    CitizenInviteBody,
    ExamResultValidateBody,
    LocalContactCreateBody,
    LocalContactResultBody,
    LocalScheduleCreateBody,
)
from server_fastapi.app.services.local_ops_service import (
    create_contact,
    create_contact_result,
    create_local_schedule,
    local_issue_citizen_invite,
    local_list_citizen_submissions,
    validate_exam_result,
)

router = APIRouter(tags=['local-ops'])


@router.post('/api/local/cases/{case_id}/citizen-invite')
def post_local_citizen_invite(
    case_id: str,
    body: CitizenInviteBody,
    db: Session = Depends(get_db),
    user: AuthUser = Depends(get_current_user),
) -> dict:
    return local_issue_citizen_invite(
        db,
        case_id=case_id,
        center_id=body.centerId,
        citizen_phone=body.citizenPhone,
        actor_name=user.user_id,
    )


@router.get('/api/local/cases/{case_id}/citizen-submissions')
def get_local_citizen_submissions(case_id: str, db: Session = Depends(get_db)) -> dict:
    return local_list_citizen_submissions(db, case_id=case_id)


@router.post('/api/local/exam-results/{exam_result_id}/validate')
def post_local_exam_validate(
    exam_result_id: str,
    body: ExamResultValidateBody,
    db: Session = Depends(get_db),
    user: AuthUser = Depends(get_current_user),
) -> dict:
    return validate_exam_result(
        db,
        exam_result_id=exam_result_id,
        status=body.status,
        actor_name=user.user_id,
    )


@router.post('/api/local/contacts')
def post_local_contact(
    body: LocalContactCreateBody,
    db: Session = Depends(get_db),
    user: AuthUser = Depends(get_current_user),
) -> dict:
    payload = body.model_dump()
    payload['payload'] = body.payload
    return create_contact(db, payload=payload, actor_name=user.user_id)


@router.post('/api/local/contacts/{contact_id}/result')
def post_local_contact_result(
    contact_id: str,
    body: LocalContactResultBody,
    db: Session = Depends(get_db),
    user: AuthUser = Depends(get_current_user),
) -> dict:
    payload = body.model_dump(exclude_none=True)
    if body.nextContactAt:
        payload['nextContactAt'] = body.nextContactAt.isoformat()
    return create_contact_result(db, contact_id=contact_id, payload=payload, actor_name=user.user_id)


@router.post('/api/local/schedules')
def post_local_schedule(
    body: LocalScheduleCreateBody,
    db: Session = Depends(get_db),
    user: AuthUser = Depends(get_current_user),
) -> dict:
    payload = body.model_dump(exclude_none=True)
    payload['startAt'] = body.startAt.isoformat()
    return create_local_schedule(db, payload=payload, actor_name=user.user_id)
