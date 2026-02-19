"""seed baseline data

Revision ID: 0002_seed_data
Revises: 0001_initial_schema
Create Date: 2026-02-17
"""
from __future__ import annotations

from typing import Sequence

from alembic import op

revision: str = '0002_seed_data'
down_revision: str | None = '0001_initial_schema'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _exec(sql: str) -> None:
    op.get_bind().exec_driver_sql(sql)


def upgrade() -> None:
    _exec(
        """
        INSERT INTO control.org_units (id, name, level, parent_id, region_path)
        VALUES
          ('KR', '대한민국', 'nation', NULL, '{"nation":"KR"}'::json),
          ('11', '서울특별시', 'sido', 'KR', '{"nation":"KR","region":"11"}'::json),
          ('26', '부산광역시', 'sido', 'KR', '{"nation":"KR","region":"26"}'::json),
          ('41', '경기도', 'sido', 'KR', '{"nation":"KR","region":"41"}'::json)
        ON CONFLICT (id) DO NOTHING
        """
    )

    _exec(
        """
        INSERT INTO control.roles (id, name, description)
        VALUES
          ('CENTRAL_ADMIN', '중앙 관리자', 'Central control tower admin'),
          ('AUDITOR', '감사 담당자', 'Audit reader')
        ON CONFLICT (id) DO NOTHING
        """
    )

    _exec(
        """
        INSERT INTO control.permissions (id, name, description)
        VALUES
          ('central:read', 'Central read', 'Read central dashboards'),
          ('central:write', 'Central write', 'Modify central settings'),
          ('audit:read', 'Audit read', 'Read audit trails')
        ON CONFLICT (id) DO NOTHING
        """
    )

    _exec(
        """
        INSERT INTO control.role_permissions (role_id, permission_id)
        VALUES
          ('CENTRAL_ADMIN', 'central:read'),
          ('CENTRAL_ADMIN', 'central:write'),
          ('CENTRAL_ADMIN', 'audit:read'),
          ('AUDITOR', 'central:read'),
          ('AUDITOR', 'audit:read')
        ON CONFLICT ON CONSTRAINT uq_role_permission DO NOTHING
        """
    )

    _exec(
        """
        INSERT INTO control.users (id, org_unit_id, email, display_name, is_active)
        VALUES
          ('u-central-admin', 'KR', 'central.admin@neuro.local', '중앙관리자', true),
          ('u-auditor', 'KR', 'auditor@neuro.local', '감사담당자', true)
        ON CONFLICT (id) DO NOTHING
        """
    )

    _exec(
        """
        INSERT INTO control.kpi_definitions (id, name, formula_json, threshold_json, scope_rules_json, version, active)
        VALUES
          ('SIGNAL_QUALITY', '신호 품질', '{"formula":"valid/total"}'::json, '{"warn":90,"risk":85}'::json, '{"levels":["nation","sido"]}'::json, 'v1', true),
          ('POLICY_IMPACT', '정책 영향', '{"formula":"impact_score"}'::json, '{"warn":40,"risk":70}'::json, '{"levels":["nation","sido"]}'::json, 'v1', true),
          ('BOTTLENECK_RISK', '병목 위험', '{"formula":"blocked_weighted"}'::json, '{"warn":40,"risk":70}'::json, '{"levels":["nation","sido"]}'::json, 'v1', true),
          ('DATA_READINESS', '데이터 준비도', '{"formula":"filled/total"}'::json, '{"warn":90,"risk":85}'::json, '{"levels":["nation","sido"]}'::json, 'v1', true),
          ('GOVERNANCE_SAFETY', '거버넌스 안전', '{"formula":"governed/total"}'::json, '{"warn":95,"risk":90}'::json, '{"levels":["nation","sido"]}'::json, 'v1', true)
        ON CONFLICT (id) DO NOTHING
        """
    )

    _exec(
        """
        INSERT INTO control.policy_rules (id, name, stage, status, rule_json, version, deployed_at, deployed_by)
        VALUES
          ('POL-L2-001', 'L2 기준점 운영', 'S1', 'deployed', '{"threshold":65}'::json, 'v2.3.1', now(), 'central-admin')
        ON CONFLICT (id) DO NOTHING
        """
    )

    _exec(
        """
        INSERT INTO ingestion.events_raw
          (event_id, event_ts, org_unit_id, level, system, version, region_path, case_key, stage, event_type, payload, policy_version, kpi_version, model_version, trace_id)
        VALUES
          ('11111111-1111-1111-1111-111111111111', now() - interval '1 day', '11', 'sido', 'local-center', '1.0', '{"nation":"KR","region":"11"}'::json, 'case-seed-001', 'S1', 'CONTACT_ATTEMPTED', '{"attempt":1}'::json, 'v1', 'v1', NULL, 'trace-seed-1'),
          ('22222222-2222-2222-2222-222222222222', now() - interval '1 day', '26', 'sido', 'local-center', '1.0', '{"nation":"KR","region":"26"}'::json, 'case-seed-002', 'S2', 'EXAM_RESULT_VALIDATED', '{"result":"normal"}'::json, 'v1', 'v1', 'v3.2', 'trace-seed-2')
        ON CONFLICT (event_id) DO NOTHING
        """
    )

    _exec(
        """
        INSERT INTO analytics.kpi_snapshots
          (d, scope_level, scope_id, kpi_id, value, numerator, denominator, delta7d, auxiliary_json, kpi_version, policy_version, data_window_json)
        VALUES
          (current_date, 'nation', 'KR', 'SIGNAL_QUALITY', 92.4, 9240, 10000, 1.2, '{"valid_events":9240}'::json, 'v1', 'v1', '{"window":"LAST_7D"}'::json),
          (current_date, 'nation', 'KR', 'POLICY_IMPACT', 26.3, 26.3, 100, -1.1, '{"policy_change_count":3}'::json, 'v1', 'v1', '{"window":"LAST_7D"}'::json),
          (current_date, 'nation', 'KR', 'BOTTLENECK_RISK', 38.8, 38.8, 100, 2.1, '{"blocked_events":12}'::json, 'v1', 'v1', '{"window":"LAST_7D"}'::json),
          (current_date, 'nation', 'KR', 'DATA_READINESS', 91.5, 9150, 10000, -0.4, '{"payload_filled":9150}'::json, 'v1', 'v1', '{"window":"LAST_7D"}'::json),
          (current_date, 'nation', 'KR', 'GOVERNANCE_SAFETY', 96.2, 962, 1000, 0.3, '{"governed_events":962}'::json, 'v1', 'v1', '{"window":"LAST_7D"}'::json)
        ON CONFLICT DO NOTHING
        """
    )


def downgrade() -> None:
    _exec("DELETE FROM analytics.kpi_snapshots WHERE scope_level='nation' AND scope_id='KR'")
    _exec("DELETE FROM ingestion.events_raw WHERE event_id IN ('11111111-1111-1111-1111-111111111111','22222222-2222-2222-2222-222222222222')")
    _exec("DELETE FROM control.policy_rules WHERE id='POL-L2-001'")
    _exec("DELETE FROM control.kpi_definitions WHERE id IN ('SIGNAL_QUALITY','POLICY_IMPACT','BOTTLENECK_RISK','DATA_READINESS','GOVERNANCE_SAFETY')")
    _exec("DELETE FROM control.users WHERE id IN ('u-central-admin','u-auditor')")
    _exec("DELETE FROM control.role_permissions")
    _exec("DELETE FROM control.permissions WHERE id IN ('central:read','central:write','audit:read')")
    _exec("DELETE FROM control.roles WHERE id IN ('CENTRAL_ADMIN','AUDITOR')")
    _exec("DELETE FROM control.org_units WHERE id IN ('11','26','41','KR')")
