from __future__ import annotations

from server_fastapi.app.db.session import SessionLocal
from server_fastapi.app.services.aggregate_service import refresh_kpi_snapshots
from server_fastapi.app.tasks.celery_app import celery_app


@celery_app.task(name='server_fastapi.app.tasks.aggregate.aggregate_kpis')
def aggregate_kpis(window: str = 'LAST_7D') -> dict:
    db = SessionLocal()
    try:
        rows = refresh_kpi_snapshots(db, window=window)
        return {'ok': True, 'snapshots_upserted': rows}
    finally:
        db.close()
