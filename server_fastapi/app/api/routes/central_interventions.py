from __future__ import annotations

from fastapi import APIRouter, Depends, File, Form, UploadFile
from sqlalchemy.orm import Session

from server_fastapi.app.core.security import AuthUser, get_current_user
from server_fastapi.app.db.session import get_db
from server_fastapi.app.schemas.central import (
    InterventionActionStatusRequest,
    InterventionCreateRequest,
    InterventionCreateResponse,
    InterventionOut,
    InterventionStatusRequest,
)
from server_fastapi.app.services.intervention_service import (
    add_intervention_evidence,
    create_intervention,
    get_intervention,
    list_interventions,
    update_action_status,
    update_intervention_status,
)
from server_fastapi.app.services.storage_service import upload_bytes

router = APIRouter(tags=['central-interventions'])


@router.post('/interventions', response_model=InterventionCreateResponse)
def post_intervention(
    payload: InterventionCreateRequest,
    db: Session = Depends(get_db),
    user: AuthUser = Depends(get_current_user),
) -> InterventionCreateResponse:
    row = create_intervention(db, user, payload)
    return InterventionCreateResponse(id=row.id, status=row.status)


@router.get('/interventions', response_model=list[InterventionOut])
def get_interventions(db: Session = Depends(get_db)) -> list[InterventionOut]:
    rows = list_interventions(db)
    return [
        InterventionOut(
            id=row.id,
            title=row.title,
            description=row.description,
            status=row.status,
            priority=row.priority,
            basis_type=row.basis_type,
            basis_ref=row.basis_ref,
            due_at=row.due_at.isoformat() if row.due_at else None,
            created_by=row.created_by,
            created_at=row.created_at.isoformat(),
        )
        for row in rows
    ]


@router.get('/interventions/{intervention_id}', response_model=InterventionOut)
def get_intervention_detail(intervention_id: str, db: Session = Depends(get_db)) -> InterventionOut:
    row = get_intervention(db, intervention_id)
    return InterventionOut(
        id=row.id,
        title=row.title,
        description=row.description,
        status=row.status,
        priority=row.priority,
        basis_type=row.basis_type,
        basis_ref=row.basis_ref,
        due_at=row.due_at.isoformat() if row.due_at else None,
        created_by=row.created_by,
        created_at=row.created_at.isoformat(),
    )


@router.post('/interventions/{intervention_id}/status', response_model=InterventionOut)
def post_intervention_status(
    intervention_id: str,
    payload: InterventionStatusRequest,
    db: Session = Depends(get_db),
    user: AuthUser = Depends(get_current_user),
) -> InterventionOut:
    row = update_intervention_status(db, user, intervention_id, payload.status)
    return InterventionOut(
        id=row.id,
        title=row.title,
        description=row.description,
        status=row.status,
        priority=row.priority,
        basis_type=row.basis_type,
        basis_ref=row.basis_ref,
        due_at=row.due_at.isoformat() if row.due_at else None,
        created_by=row.created_by,
        created_at=row.created_at.isoformat(),
    )


@router.post('/interventions/{intervention_id}/actions/{action_id}/status')
def post_action_status(
    intervention_id: str,
    action_id: str,
    payload: InterventionActionStatusRequest,
    db: Session = Depends(get_db),
    user: AuthUser = Depends(get_current_user),
) -> dict:
    row = update_action_status(db, user, intervention_id, action_id, payload.status)
    return {'id': row.id, 'status': row.status, 'completed_at': row.completed_at.isoformat() if row.completed_at else None}


@router.post('/interventions/{intervention_id}/evidence')
async def post_intervention_evidence(
    intervention_id: str,
    file: UploadFile = File(...),
    action_id: str | None = Form(default=None),
    db: Session = Depends(get_db),
    user: AuthUser = Depends(get_current_user),
) -> dict:
    content = await file.read()
    object_key = f'interventions/{intervention_id}/{file.filename}'
    s3_key = upload_bytes(key=object_key, content=content, content_type=file.content_type or 'application/octet-stream')
    evidence = add_intervention_evidence(
        db,
        user,
        intervention_id,
        action_id=action_id,
        file_name=file.filename,
        s3_key=s3_key,
    )
    return {'id': evidence.id, 's3_key': evidence.s3_key}
