from __future__ import annotations

from server_fastapi.app.db.session import SessionLocal
from server_fastapi.app.services.regional_service import build_report_summary, ensure_regional_snapshot_scope
from server_fastapi.app.tasks.celery_app import celery_app

DEFAULT_REGION_IDS = [
    'seoul',
    'busan',
    'daegu',
    'incheon',
    'gwangju',
    'daejeon',
    'ulsan',
    'sejong',
    'gyeonggi',
    'gangwon',
    'chungbuk',
    'chungnam',
    'jeonbuk',
    'jeonnam',
    'gyeongbuk',
    'gyeongnam',
    'jeju',
]
DEFAULT_PERIODS = ['week', 'month', 'quarter']


@celery_app.task(name='server_fastapi.app.tasks.regional.sync_regional_snapshots')
def sync_regional_snapshots(region_ids: list[str] | None = None) -> dict:
    db = SessionLocal()
    try:
        targets = [value.strip() for value in (region_ids or DEFAULT_REGION_IDS) if str(value).strip()]
        prepared_scopes = 0
        report_rows = 0

        for region_id in targets:
            for period in DEFAULT_PERIODS:
                ensure_regional_snapshot_scope(db, region_id=region_id, period=period)
                build_report_summary(
                    db,
                    region_id=region_id,
                    scope_mode='regional',
                    sgg='',
                    kpi='all',
                    period=period,
                )
                prepared_scopes += 1
                report_rows += 1

        return {
            'ok': True,
            'regions': len(targets),
            'preparedScopes': prepared_scopes,
            'reportSummariesRefreshed': report_rows,
        }
    finally:
        db.close()
