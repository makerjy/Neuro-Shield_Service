from __future__ import annotations

import asyncio
import json
import uuid
from datetime import datetime, timezone
from typing import Any, AsyncIterator

import psycopg
from fastapi import APIRouter, HTTPException
from fastapi.responses import JSONResponse, StreamingResponse

from server_fastapi.app.core.config import get_settings

settings = get_settings()
router = APIRouter()

SMS_MESSAGE_STORE: dict[str, dict[str, Any]] = {}


def as_bool(value: str | None, default: bool = False) -> bool:
    if value is None:
        return default
    return value.strip().lower() in {'1', 'true', 't', 'yes', 'y', 'on'}


def _health_db_url() -> str:
    return settings.database_url.replace('postgresql+psycopg://', 'postgresql://')


def resolve_main_app_base() -> str:
    return 'http://localhost:5173/neuro-shield'


def infer_stage_from_token(token: str) -> str:
    lower = token.lower()
    if 's3' in lower or 'stage3' in lower:
        return 'STAGE3'
    if 's2' in lower or 'stage2' in lower:
        return 'STAGE2'
    return 'STAGE1'


def default_checklist(stage: str) -> list[str]:
    if stage == 'STAGE3':
        return ['추적 일정 확인', '준비사항 점검', '필요 시 센터 문의']
    if stage == 'STAGE2':
        return ['검사/절차 단계 확인', '가능 일정 선택', '준비사항 확인']
    return ['기본 안내 확인', '예약 또는 상담 진행', '문의사항 정리']


@router.get('/api/health')
async def health() -> dict[str, str]:
    return {'status': 'ok', 'service': 'api', 'environment': settings.environment}


@router.get('/api/health/db', response_model=None)
async def health_db():
    try:
        with psycopg.connect(_health_db_url(), connect_timeout=3) as conn:
            with conn.cursor() as cursor:
                cursor.execute('SELECT 1')
                cursor.fetchone()
        return {'status': 'ok', 'database': 'reachable'}
    except Exception as exc:  # pragma: no cover
        return JSONResponse(
            status_code=503,
            content={'status': 'error', 'database': 'unreachable', 'detail': str(exc)},
        )


@router.get('/api/config')
async def config() -> dict[str, str | bool]:
    return {
        'environment': settings.environment,
        'use_model': settings.use_model,
        'model_path': settings.model_path,
        'model_gen_path': settings.model_gen_path,
        'model_scaler_path': settings.model_scaler_path,
        'demo_mode': settings.demo_mode,
    }


@router.post('/api/sms/messages')
async def create_sms_message(payload: dict[str, Any]) -> dict[str, Any]:
    case_id = payload.get('caseId') or payload.get('case_id')
    stage = payload.get('stage') or infer_stage_from_token(str(payload.get('token', '')))
    template_id = payload.get('templateId') or payload.get('template_id')
    variables = payload.get('variables') or {}
    send_policy = payload.get('sendPolicy') or payload.get('send_policy') or 'IMMEDIATE'
    citizen_phone = payload.get('citizenPhone') or payload.get('citizen_phone')

    if not case_id or not template_id:
        raise HTTPException(status_code=400, detail='caseId/templateId가 필요합니다.')

    message_id = f'MSG-{uuid.uuid4().hex[:12]}'
    token = payload.get('token') or f'tok-{uuid.uuid4().hex[:16]}'
    link_url = variables.get('LINK') or f'{resolve_main_app_base()}/p/sms?t={token}'
    rendered_text = payload.get('renderedText') or payload.get('renderedMessage') or variables.get('template') or ''

    status = 'SCHEDULED' if str(send_policy).upper().startswith('SCHEDULE') else 'DELIVERED'
    record = {
        'messageId': message_id,
        'caseId': case_id,
        'stage': stage,
        'templateId': template_id,
        'token': token,
        'linkUrl': link_url,
        'renderedText': rendered_text,
        'status': status,
        'variables': variables,
        'intendedTo': citizen_phone,
        'actualTo': citizen_phone,
        'createdAt': datetime.now(timezone.utc).isoformat(),
    }
    SMS_MESSAGE_STORE[message_id] = record

    return {
        'messageId': message_id,
        'token': token,
        'status': status,
        'renderedText': rendered_text,
        'linkUrl': link_url,
        'actualTo': citizen_phone,
        'intendedTo': citizen_phone,
    }


@router.patch('/api/sms/messages/{message_id}/status')
async def patch_sms_message_status(message_id: str, payload: dict[str, Any]) -> dict[str, Any]:
    record = SMS_MESSAGE_STORE.get(message_id)
    if not record:
        raise HTTPException(status_code=404, detail='message not found')

    status = payload.get('status')
    if not status:
        raise HTTPException(status_code=400, detail='status가 필요합니다.')

    record['status'] = status
    record['updatedAt'] = datetime.now(timezone.utc).isoformat()
    return {'ok': True, 'messageId': message_id, 'status': status}


@router.get('/api/public/sms/landing')
async def get_public_sms_landing(t: str) -> dict[str, Any]:
    if not t:
        raise HTTPException(status_code=400, detail='token(t)이 필요합니다.')

    matched = next((item for item in SMS_MESSAGE_STORE.values() if item.get('token') == t), None)
    if matched:
        stage = matched.get('stage') or 'STAGE1'
        if matched.get('status') in {'DELIVERED', 'SENT', 'SCHEDULED'}:
            matched['status'] = 'CLICKED'
            matched['clickedAt'] = datetime.now(timezone.utc).isoformat()
    else:
        stage = infer_stage_from_token(t)

    if stage == 'STAGE1':
        return {
            'stage': stage,
            'actionType': 'BOOKING',
            'centerName': '강남구 치매안심센터',
            'callbackPhone': '02-555-0199',
            'caseAlias': '대상자',
            'privacyNotice': '문자와 공개 화면에는 민감정보를 최소화해 표시합니다.',
        }

    return {
        'stage': stage,
        'actionType': 'FOLLOW_UP_HUB' if stage == 'STAGE3' else 'NEXT_STEP_HUB',
        'centerName': '강남구 치매안심센터',
        'callbackPhone': '02-555-0199',
        'caseAlias': '대상자',
        'cta': {
            'primary': '추적 일정 확인' if stage == 'STAGE3' else '검사/절차 일정 확인',
            'secondary': '전화 문의',
        },
        'checklist': default_checklist(stage),
        'dueDate': '7일 이내 확인 권장' if stage == 'STAGE3' else '3일 이내 확인 권장',
        'privacyNotice': '문자와 공개 화면에는 민감정보를 최소화해 표시합니다.',
    }


@router.post('/api/public/sms/landing/action')
async def post_public_sms_landing_action(payload: dict[str, Any]) -> dict[str, Any]:
    token = payload.get('token')
    status = payload.get('status') or 'ACTION_COMPLETED'
    if not token:
        raise HTTPException(status_code=400, detail='token이 필요합니다.')

    matched = next((item for item in SMS_MESSAGE_STORE.values() if item.get('token') == token), None)
    if matched:
        matched['status'] = status
        matched['actionType'] = payload.get('actionType')
        matched['actionUpdatedAt'] = datetime.now(timezone.utc).isoformat()

    return {'ok': True, 'status': status}


@router.get('/api/sse/heartbeat')
async def sse_heartbeat() -> StreamingResponse:
    async def event_stream() -> AsyncIterator[str]:
        seq = 0
        while True:
            seq += 1
            payload = {'seq': seq, 'ts': datetime.now(timezone.utc).isoformat(), 'type': 'heartbeat'}
            yield f'event: heartbeat\\ndata: {json.dumps(payload)}\\n\\n'
            await asyncio.sleep(1.0)

    return StreamingResponse(
        event_stream(),
        media_type='text/event-stream',
        headers={
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'X-Accel-Buffering': 'no',
        },
    )
