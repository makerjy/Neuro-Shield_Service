from __future__ import annotations

from celery import Celery

from server_fastapi.app.core.config import get_settings

settings = get_settings()

celery_app = Celery(
    'central_worker',
    broker=settings.celery_broker_url,
    backend=settings.celery_result_backend,
)

celery_app.conf.update(
    timezone='Asia/Seoul',
    enable_utc=True,
    task_serializer='json',
    result_serializer='json',
    accept_content=['json'],
    imports=(
        'server_fastapi.app.tasks.aggregate',
        'server_fastapi.app.tasks.report',
        'server_fastapi.app.tasks.escalate',
        'server_fastapi.app.tasks.quality_check',
        'server_fastapi.app.tasks.scheduler',
        'server_fastapi.app.tasks.tasks',
        'server_fastapi.app.tasks.citizen_tasks',
        'server_fastapi.app.tasks.regional',
    ),
    beat_schedule={
        'aggregate-kpis': {
            'task': 'server_fastapi.app.tasks.aggregate.aggregate_kpis',
            'schedule': 300.0,
        },
        'generate-daily-report': {
            'task': 'server_fastapi.app.tasks.report.generate_daily_report',
            'schedule': 3600.0,
        },
        'check-overdue-interventions': {
            'task': 'server_fastapi.app.tasks.escalate.check_overdue_interventions',
            'schedule': 600.0,
        },
        'quality-check': {
            'task': 'server_fastapi.app.tasks.quality_check.run_quality_checks',
            'schedule': 900.0,
        },
        'citizen-reminders-due': {
            'task': 'server_fastapi.app.tasks.citizen_tasks.reminders_due',
            'schedule': 180.0,
        },
        'citizen-cleanup-expired-sessions': {
            'task': 'server_fastapi.app.tasks.citizen_tasks.cleanup_expired_sessions',
            'schedule': 600.0,
        },
        'citizen-process-submissions': {
            'task': 'server_fastapi.app.tasks.citizen_tasks.process_citizen_submission',
            'schedule': 300.0,
        },
        'citizen-data-quality-daily': {
            'task': 'server_fastapi.app.tasks.quality_check.run_quality_checks',
            'schedule': 86400.0,
        },
        'scan-due-local-schedules': {
            'task': 'server_fastapi.app.tasks.scheduler.scan_due_local_schedules',
            'schedule': 60.0,
        },
        'process-queued-local-schedules': {
            'task': 'server_fastapi.app.tasks.tasks.process_queued_schedules',
            'schedule': 120.0,
        },
        'sync-regional-snapshots': {
            'task': 'server_fastapi.app.tasks.regional.sync_regional_snapshots',
            'schedule': 900.0,
        },
    },
)

celery_app.autodiscover_tasks(['server_fastapi.app.tasks'])
