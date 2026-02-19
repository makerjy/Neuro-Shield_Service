from __future__ import annotations

import asyncio
from datetime import date

from sqlalchemy.orm import sessionmaker

from server_fastapi.app.models.analytics import KpiSnapshot
from server_fastapi.app.services.stream_service import snapshot_stream


def test_sse_snapshot_version_change(engine):
    SessionLocal = sessionmaker(bind=engine)

    with SessionLocal() as db:
        db.add(
            KpiSnapshot(
                d=date(2026, 2, 17),
                scope_level='nation',
                scope_id='KR',
                kpi_id='SIGNAL_QUALITY',
                value=92.4,
                numerator=924,
                denominator=1000,
                delta7d=1.1,
                auxiliary_json={},
                kpi_version='v1',
                policy_version='v1',
                data_window_json={'window': 'LAST_7D'},
            )
        )
        db.commit()

    async def _collect_first() -> str:
        gen = snapshot_stream(SessionLocal, scope_level='nation', scope_id='KR', poll_seconds=0.01)
        first = await gen.__anext__()
        await gen.aclose()
        return first

    payload = asyncio.run(_collect_first())

    assert 'event: snapshot' in payload
    assert 'snapshot_version' in payload
    assert 'nation' in payload
