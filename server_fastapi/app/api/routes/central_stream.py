from __future__ import annotations

from fastapi import APIRouter, Query
from fastapi.responses import StreamingResponse

from server_fastapi.app.db.session import SessionLocal
from server_fastapi.app.services.stream_service import snapshot_stream

router = APIRouter(tags=['central-stream'])


@router.get('/stream')
async def stream(scope_level: str = Query('nation'), scope_id: str = Query('KR')) -> StreamingResponse:
    return StreamingResponse(
        snapshot_stream(SessionLocal, scope_level=scope_level, scope_id=scope_id),
        media_type='text/event-stream',
        headers={
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'X-Accel-Buffering': 'no',
        },
    )
