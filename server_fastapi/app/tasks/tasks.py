from __future__ import annotations

from server_fastapi.app.db.session import SessionLocal
from server_fastapi.app.models.local_center import ContactPlan, Schedule
from server_fastapi.app.tasks.celery_app import celery_app


@celery_app.task(name='server_fastapi.app.tasks.tasks.process_queued_schedules')
def process_queued_schedules() -> dict:
    db = SessionLocal()
    try:
        schedules = db.query(Schedule).filter(Schedule.status == 'QUEUED').all()
        plans = db.query(ContactPlan).filter(ContactPlan.status == 'QUEUED').all()

        for row in schedules:
            row.status = 'DONE'
        for row in plans:
            row.status = 'DONE'

        db.commit()
        return {'processedSchedules': len(schedules), 'processedContactPlans': len(plans)}
    finally:
        db.close()
