from __future__ import annotations

import asyncio
import json
from datetime import datetime, timezone
from typing import AsyncIterator

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from server_fastapi.app.db.session import get_db
from server_fastapi.app.schemas.citizen import (
    AppointmentBookBody,
    AppointmentCancelBody,
    AppointmentChangeBody,
    ConsentSubmitBody,
    OtpRequestBody,
    OtpVerifyBody,
    ProfileSubmitBody,
    QuestionnaireSubmitBody,
    SessionResolveResponse,
    UploadCommitBody,
    UploadPresignBody,
)
from server_fastapi.app.services.citizen_service import (
    book_appointment,
    cancel_appointment,
    change_appointment,
    citizen_status,
    commit_upload,
    create_upload_presign,
    get_consent_templates,
    get_questionnaire,
    get_session_from_token,
    list_appointment_slots,
    list_questionnaires,
    request_otp,
    submit_consents,
    submit_profile,
    submit_questionnaire_response,
    verify_otp,
)

router = APIRouter(tags=['citizen'])


@router.get('/api/citizen/session', response_model=SessionResolveResponse)
def get_citizen_session(
    request: Request,
    token: str = Query(...),
    db: Session = Depends(get_db),
) -> SessionResolveResponse:
    client_ip = request.client.host if request.client else None
    return SessionResolveResponse.model_validate(get_session_from_token(db, token=token, client_ip=client_ip))


@router.post('/api/citizen/otp/request')
def post_citizen_otp_request(
    body: OtpRequestBody,
    request: Request,
    db: Session = Depends(get_db),
) -> dict:
    client_ip = request.client.host if request.client else None
    return request_otp(
        db,
        session_id=body.sessionId,
        phone_number=body.phoneNumber,
        client_ip=client_ip,
    )


@router.post('/api/citizen/otp/verify')
def post_citizen_otp_verify(
    body: OtpVerifyBody,
    request: Request,
    db: Session = Depends(get_db),
) -> dict:
    client_ip = request.client.host if request.client else None
    return verify_otp(
        db,
        session_id=body.sessionId,
        otp_code=body.otpCode,
        phone_number=body.phoneNumber,
        client_ip=client_ip,
    )


@router.get('/api/citizen/consents/template')
def get_citizen_consents_template(db: Session = Depends(get_db)) -> dict:
    return {'items': get_consent_templates(db)}


@router.post('/api/citizen/consents')
def post_citizen_consents(body: ConsentSubmitBody, db: Session = Depends(get_db)) -> dict:
    consent_items = [item.model_dump(exclude_none=True) for item in body.consents]
    return submit_consents(db, session_id=body.sessionId, consents=consent_items)


@router.post('/api/citizen/profile')
def post_citizen_profile(body: ProfileSubmitBody, db: Session = Depends(get_db)) -> dict:
    return submit_profile(db, session_id=body.sessionId, profile_payload=body.profile)


@router.get('/api/citizen/appointments/slots')
def get_citizen_appointment_slots(
    sessionId: str = Query(...),
    db: Session = Depends(get_db),
) -> dict:
    return list_appointment_slots(db, session_id=sessionId)


@router.post('/api/citizen/appointments/book')
def post_citizen_appointment_book(body: AppointmentBookBody, db: Session = Depends(get_db)) -> dict:
    return book_appointment(
        db,
        session_id=body.sessionId,
        appointment_at=body.appointmentAt,
        organization=body.organization,
    )


@router.post('/api/citizen/appointments/change')
def post_citizen_appointment_change(body: AppointmentChangeBody, db: Session = Depends(get_db)) -> dict:
    return change_appointment(db, session_id=body.sessionId, appointment_at=body.appointmentAt)


@router.post('/api/citizen/appointments/cancel')
def post_citizen_appointment_cancel(body: AppointmentCancelBody, db: Session = Depends(get_db)) -> dict:
    return cancel_appointment(db, session_id=body.sessionId, reason=body.reason)


@router.get('/api/citizen/questionnaires')
def get_citizen_questionnaires(
    sessionId: str = Query(...),
    db: Session = Depends(get_db),
) -> dict:
    return {'items': list_questionnaires(db, session_id=sessionId)}


@router.get('/api/citizen/questionnaires/{questionnaire_id}')
def get_citizen_questionnaire(
    questionnaire_id: str,
    sessionId: str = Query(...),
    db: Session = Depends(get_db),
) -> dict:
    return get_questionnaire(db, session_id=sessionId, questionnaire_id=questionnaire_id)


@router.post('/api/citizen/questionnaires/{questionnaire_id}/responses')
def post_citizen_questionnaire_response(
    questionnaire_id: str,
    body: QuestionnaireSubmitBody,
    db: Session = Depends(get_db),
) -> dict:
    return submit_questionnaire_response(
        db,
        session_id=body.sessionId,
        questionnaire_id=questionnaire_id,
        responses=body.responses,
    )


@router.post('/api/citizen/uploads/presign')
def post_citizen_upload_presign(body: UploadPresignBody, db: Session = Depends(get_db)) -> dict:
    return create_upload_presign(
        db,
        session_id=body.sessionId,
        file_name=body.fileName,
        content_type=body.contentType,
        size_bytes=body.sizeBytes,
    )


@router.post('/api/citizen/uploads/commit')
def post_citizen_upload_commit(body: UploadCommitBody, db: Session = Depends(get_db)) -> dict:
    return commit_upload(
        db,
        session_id=body.sessionId,
        upload_id=body.uploadId,
        metadata=body.metadata,
    )


@router.get('/api/citizen/status')
def get_citizen_status(sessionId: str = Query(...), db: Session = Depends(get_db)) -> dict:
    return citizen_status(db, session_id=sessionId)


@router.get('/api/citizen/stream')
def citizen_stream(sessionId: str = Query(...), db: Session = Depends(get_db)) -> StreamingResponse:
    if not sessionId:
        raise HTTPException(status_code=400, detail='sessionId is required')

    status_payload = citizen_status(db, session_id=sessionId)

    async def event_stream() -> AsyncIterator[str]:
        seq = 0
        while True:
            seq += 1
            payload = {
                'seq': seq,
                'type': 'citizen_status',
                'ts': datetime.now(timezone.utc).isoformat(),
                'status': status_payload,
            }
            yield f'event: status\ndata: {json.dumps(payload)}\n\n'
            await asyncio.sleep(2.0)

    return StreamingResponse(
        event_stream(),
        media_type='text/event-stream',
        headers={
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'X-Accel-Buffering': 'no',
        },
    )
