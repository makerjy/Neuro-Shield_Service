from __future__ import annotations

import asyncio
import json
from datetime import datetime, timezone
from typing import AsyncIterator, Callable

from sqlalchemy.orm import Session

from server_fastapi.app.services.dashboard_service import get_latest_snapshot_version


async def snapshot_stream(
    db_factory: Callable[[], Session],
    *,
    scope_level: str,
    scope_id: str,
    poll_seconds: float = 2.0,
) -> AsyncIterator[str]:
    last_version = ''
    while True:
        db = db_factory()
        try:
            current_version = get_latest_snapshot_version(db, scope_level=scope_level, scope_id=scope_id)
        finally:
            db.close()

        if current_version and current_version != last_version:
            last_version = current_version
            payload = {
                'snapshot_version': current_version,
                'scope_level': scope_level,
                'scope_id': scope_id,
                'ts': datetime.now(timezone.utc).isoformat(),
            }
            yield f"event: snapshot\ndata: {json.dumps(payload, ensure_ascii=False)}\n\n"

        await asyncio.sleep(poll_seconds)
