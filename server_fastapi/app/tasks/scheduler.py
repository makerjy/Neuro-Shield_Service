from __future__ import annotations

from server_fastapi.app.db.session import SessionLocal
from server_fastapi.app.services.local_case_service import scan_due_schedules_and_contact_plans
from server_fastapi.app.tasks.celery_app import celery_app


@celery_app.task(name='server_fastapi.app.tasks.scheduler.scan_due_local_schedules')
def scan_due_local_schedules() -> dict:
    db = SessionLocal()
    try:
        return scan_due_schedules_and_contact_plans(db)
    finally:
        db.close()
