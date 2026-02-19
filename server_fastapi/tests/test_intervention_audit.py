from __future__ import annotations

from datetime import date

import pytest
from fastapi import HTTPException
from sqlalchemy import select

from server_fastapi.app.core.security import AuthUser
from server_fastapi.app.models.analytics import KpiSnapshot
from server_fastapi.app.models.control import AuditEvent, Intervention
from server_fastapi.app.schemas.central import InterventionCreateRequest
from server_fastapi.app.services.intervention_service import create_intervention, update_intervention_status


def test_intervention_requires_basis_ref(db_session):
    payload = InterventionCreateRequest.model_validate(
        {
            'title': '긴급 개입',
            'basis_type': 'KPI',
            'basis_ref': 'UNKNOWN_KPI',
            'target_org_unit_ids': ['11'],
        }
    )

    with pytest.raises(HTTPException) as exc_info:
        create_intervention(db_session, AuthUser(user_id='tester', role='ADMIN'), payload)

    assert exc_info.value.status_code == 422
    assert 'basis_ref' in str(exc_info.value.detail)


def test_intervention_status_writes_audit_before_after(db_session):
    db_session.add(
        KpiSnapshot(
            d=date(2026, 2, 17),
            scope_level='nation',
            scope_id='KR',
            kpi_id='SIGNAL_QUALITY',
            value=92.1,
            numerator=921,
            denominator=1000,
            delta7d=1.1,
            auxiliary_json={'valid': 921},
            kpi_version='v1',
            policy_version='v1',
            data_window_json={'window': 'LAST_7D'},
        )
    )
    db_session.commit()

    user = AuthUser(user_id='u-central-admin', role='CENTRAL_ADMIN')
    created = create_intervention(
        db_session,
        user,
        InterventionCreateRequest.model_validate(
            {
                'title': '부산 SLA 개선 개입',
                'description': '지원 인력 재배치',
                'basis_type': 'KPI',
                'basis_ref': 'SIGNAL_QUALITY',
                'target_org_unit_ids': ['26'],
            }
        ),
    )

    updated = update_intervention_status(db_session, user, created.id, 'IN_PROGRESS')
    assert updated.status == 'IN_PROGRESS'

    intervention = db_session.execute(select(Intervention).where(Intervention.id == created.id)).scalar_one()
    assert intervention.status == 'IN_PROGRESS'

    events = db_session.execute(
        select(AuditEvent).where(AuditEvent.entity_id == created.id).order_by(AuditEvent.id)
    ).scalars().all()

    assert len(events) >= 2
    assert events[-1].before_json == {'status': 'OPEN'}
    assert events[-1].after_json == {'status': 'IN_PROGRESS'}
