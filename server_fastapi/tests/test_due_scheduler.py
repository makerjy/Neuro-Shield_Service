from __future__ import annotations

from datetime import datetime, timedelta, timezone

from server_fastapi.app.schemas.local_center import OutcomeSavePayload
from server_fastapi.app.services.local_case_service import save_stage1_outcome, scan_due_schedules_and_contact_plans


def test_due_contact_plan_is_queued_by_scheduler(db_session):
    save_stage1_outcome(
        db_session,
        'CASE-DUE-001',
        OutcomeSavePayload(
            outcomeType='NO_RESPONSE',
            noResponse={
                'strategy': 'CALL_RETRY',
                'nextContactAt': datetime.now(timezone.utc) - timedelta(minutes=5),
                'assigneeId': 'u-local-001',
                'channel': 'CALL',
            },
        ),
        actor_name='tester',
        actor_type='human',
    )

    due = scan_due_schedules_and_contact_plans(db_session)
    assert due['dueContactPlans'] >= 1
