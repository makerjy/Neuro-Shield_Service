from __future__ import annotations

import csv
import io
from datetime import datetime, timezone

from sqlalchemy import desc, select

from server_fastapi.app.db.session import SessionLocal
from server_fastapi.app.models.analytics import KpiSnapshot
from server_fastapi.app.services.storage_service import upload_bytes
from server_fastapi.app.tasks.celery_app import celery_app


@celery_app.task(name='server_fastapi.app.tasks.report.generate_daily_report')
def generate_daily_report() -> dict:
    db = SessionLocal()
    try:
        rows = db.execute(
            select(KpiSnapshot)
            .where(KpiSnapshot.scope_level == 'nation', KpiSnapshot.scope_id == 'KR')
            .order_by(desc(KpiSnapshot.computed_at))
            .limit(5)
        ).scalars().all()

        out = io.StringIO()
        writer = csv.writer(out)
        writer.writerow(['kpi_id', 'value', 'numerator', 'denominator', 'computed_at'])
        for row in rows:
            writer.writerow([row.kpi_id, float(row.value), float(row.numerator), float(row.denominator), row.computed_at.isoformat()])

        key = f"reports/daily_kpi_report_{datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')}.csv"
        upload_bytes(key=key, content=out.getvalue().encode('utf-8'), content_type='text/csv')
        return {'ok': True, 's3_key': key, 'rows': len(rows)}
    finally:
        db.close()
