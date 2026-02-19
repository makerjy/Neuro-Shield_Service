"""local center domain tables and seeds

Revision ID: 0003_local_center_domain
Revises: 0002_seed_data
Create Date: 2026-02-17
"""
from __future__ import annotations

from typing import Sequence

from alembic import op

revision: str = '0003_local_center_domain'
down_revision: str | None = '0002_seed_data'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _exec(sql: str) -> None:
    op.get_bind().exec_driver_sql(sql)


def upgrade() -> None:
    _exec("CREATE SCHEMA IF NOT EXISTS local_center")

    _exec(
        """
        CREATE TABLE IF NOT EXISTS local_center.centers (
          id varchar(64) PRIMARY KEY,
          name varchar(255) NOT NULL,
          region_code varchar(32) NOT NULL,
          created_at timestamptz NOT NULL DEFAULT now()
        )
        """
    )

    _exec(
        """
        CREATE TABLE IF NOT EXISTS local_center.roles (
          id varchar(64) PRIMARY KEY,
          name varchar(255) UNIQUE NOT NULL
        )
        """
    )

    _exec(
        """
        CREATE TABLE IF NOT EXISTS local_center.users (
          id varchar(64) PRIMARY KEY,
          center_id varchar(64) REFERENCES local_center.centers(id),
          name varchar(255) NOT NULL,
          email varchar(255) UNIQUE,
          is_active boolean NOT NULL DEFAULT true
        )
        """
    )

    _exec(
        """
        CREATE TABLE IF NOT EXISTS local_center.user_roles (
          id bigserial PRIMARY KEY,
          user_id varchar(64) NOT NULL REFERENCES local_center.users(id),
          role_id varchar(64) NOT NULL REFERENCES local_center.roles(id),
          CONSTRAINT uq_local_user_role UNIQUE (user_id, role_id)
        )
        """
    )

    _exec(
        """
        CREATE TABLE IF NOT EXISTS local_center.cases (
          case_id varchar(64) PRIMARY KEY,
          center_id varchar(64) NOT NULL REFERENCES local_center.centers(id),
          owner_id varchar(64) REFERENCES local_center.users(id),
          owner_type varchar(32) NOT NULL DEFAULT 'counselor',
          stage integer NOT NULL DEFAULT 1,
          status varchar(64) NOT NULL DEFAULT 'QUEUED',
          operational_status varchar(64) NOT NULL DEFAULT 'TRACKING',
          priority_tier varchar(16) NOT NULL DEFAULT 'P2',
          alert_level varchar(16),
          subject_json jsonb NOT NULL,
          communication_json jsonb NOT NULL DEFAULT '{}'::jsonb,
          referral_json jsonb NOT NULL DEFAULT '{}'::jsonb,
          metrics_json jsonb NOT NULL DEFAULT '{}'::jsonb,
          raw_json jsonb,
          created_at timestamptz NOT NULL DEFAULT now(),
          updated_at timestamptz NOT NULL DEFAULT now()
        )
        """
    )
    _exec("CREATE INDEX IF NOT EXISTS ix_local_cases_stage_status ON local_center.cases (stage, status)")
    _exec("CREATE INDEX IF NOT EXISTS ix_local_cases_alert_priority ON local_center.cases (alert_level, priority_tier)")

    _exec(
        """
        CREATE TABLE IF NOT EXISTS local_center.case_stage_states (
          id bigserial PRIMARY KEY,
          case_id varchar(64) NOT NULL REFERENCES local_center.cases(case_id),
          stage integer NOT NULL,
          state varchar(64) NOT NULL,
          entered_at timestamptz NOT NULL DEFAULT now(),
          exited_at timestamptz,
          is_current boolean NOT NULL DEFAULT true
        )
        """
    )
    _exec("CREATE INDEX IF NOT EXISTS ix_local_case_stage_state_case_stage ON local_center.case_stage_states (case_id, stage)")

    _exec(
        """
        CREATE TABLE IF NOT EXISTS local_center.work_items (
          id varchar(64) PRIMARY KEY,
          case_id varchar(64) NOT NULL REFERENCES local_center.cases(case_id),
          title varchar(255) NOT NULL,
          item_type varchar(64) NOT NULL,
          status varchar(32) NOT NULL DEFAULT 'OPEN',
          priority varchar(16) NOT NULL DEFAULT 'P2',
          assignee_id varchar(64) REFERENCES local_center.users(id),
          due_at timestamptz,
          payload_json jsonb,
          created_at timestamptz NOT NULL DEFAULT now(),
          updated_at timestamptz NOT NULL DEFAULT now()
        )
        """
    )
    _exec("CREATE INDEX IF NOT EXISTS ix_local_work_items_case_status_due ON local_center.work_items (case_id, status, due_at)")

    _exec(
        """
        CREATE TABLE IF NOT EXISTS local_center.schedules (
          id varchar(64) PRIMARY KEY,
          idempotency_key varchar(255) NOT NULL,
          case_id varchar(64) NOT NULL REFERENCES local_center.cases(case_id),
          event_type varchar(32) NOT NULL,
          title varchar(255) NOT NULL,
          start_at timestamptz NOT NULL,
          duration_min integer NOT NULL DEFAULT 20,
          priority varchar(16) NOT NULL DEFAULT 'NORMAL',
          assignee_id varchar(64) REFERENCES local_center.users(id),
          payload_json jsonb,
          status varchar(32) NOT NULL DEFAULT 'SCHEDULED',
          created_at timestamptz NOT NULL DEFAULT now(),
          CONSTRAINT uq_local_schedules_idempotency UNIQUE (idempotency_key)
        )
        """
    )
    _exec("CREATE INDEX IF NOT EXISTS ix_local_schedules_due ON local_center.schedules (start_at, status)")

    _exec(
        """
        CREATE TABLE IF NOT EXISTS local_center.timeline_events (
          id varchar(64) PRIMARY KEY,
          case_id varchar(64) NOT NULL REFERENCES local_center.cases(case_id),
          at timestamptz NOT NULL DEFAULT now(),
          event_type varchar(64) NOT NULL,
          title varchar(255) NOT NULL,
          detail text,
          actor_name varchar(128) NOT NULL,
          actor_type varchar(16) NOT NULL DEFAULT 'system',
          payload_json jsonb
        )
        """
    )
    _exec("CREATE INDEX IF NOT EXISTS ix_local_timeline_case_at ON local_center.timeline_events (case_id, at)")

    _exec(
        """
        CREATE TABLE IF NOT EXISTS local_center.audit_events (
          id bigserial PRIMARY KEY,
          case_id varchar(64) NOT NULL REFERENCES local_center.cases(case_id),
          at timestamptz NOT NULL DEFAULT now(),
          actor_name varchar(128) NOT NULL,
          actor_type varchar(16) NOT NULL DEFAULT 'system',
          action varchar(128) NOT NULL,
          message text NOT NULL,
          severity varchar(16) NOT NULL DEFAULT 'info',
          before_json jsonb,
          after_json jsonb
        )
        """
    )
    _exec("CREATE INDEX IF NOT EXISTS ix_local_audit_case_at ON local_center.audit_events (case_id, at)")

    _exec(
        """
        CREATE TABLE IF NOT EXISTS local_center.attachments (
          id varchar(64) PRIMARY KEY,
          case_id varchar(64) NOT NULL REFERENCES local_center.cases(case_id),
          file_name varchar(255) NOT NULL,
          file_url varchar(1024) NOT NULL,
          created_at timestamptz NOT NULL DEFAULT now()
        )
        """
    )

    _exec(
        """
        CREATE TABLE IF NOT EXISTS local_center.notes (
          id varchar(64) PRIMARY KEY,
          case_id varchar(64) NOT NULL REFERENCES local_center.cases(case_id),
          author varchar(128) NOT NULL,
          content text NOT NULL,
          created_at timestamptz NOT NULL DEFAULT now()
        )
        """
    )

    _exec(
        """
        CREATE TABLE IF NOT EXISTS local_center.stage1_contacts (
          id varchar(64) PRIMARY KEY,
          case_id varchar(64) NOT NULL REFERENCES local_center.cases(case_id),
          channel varchar(16) NOT NULL,
          template_id varchar(128),
          status varchar(32) NOT NULL DEFAULT 'NOT_STARTED',
          sent_at timestamptz
        )
        """
    )

    _exec(
        """
        CREATE TABLE IF NOT EXISTS local_center.stage1_contact_results (
          id varchar(64) PRIMARY KEY,
          case_id varchar(64) NOT NULL REFERENCES local_center.cases(case_id),
          outcome_type varchar(64) NOT NULL,
          memo text,
          reason_tags_json jsonb,
          reject_code varchar(64),
          reject_level varchar(16),
          reject_detail text,
          followup_at timestamptz,
          no_response_strategy varchar(64),
          next_contact_at timestamptz,
          assignee_id varchar(64),
          created_at timestamptz NOT NULL DEFAULT now()
        )
        """
    )
    _exec("CREATE INDEX IF NOT EXISTS ix_local_stage1_results_case_created ON local_center.stage1_contact_results (case_id, created_at)")

    _exec(
        """
        CREATE TABLE IF NOT EXISTS local_center.refusal_codes (
          code varchar(64) PRIMARY KEY,
          label varchar(255) NOT NULL,
          is_active boolean NOT NULL DEFAULT true
        )
        """
    )

    _exec(
        """
        CREATE TABLE IF NOT EXISTS local_center.contact_plans (
          id varchar(64) PRIMARY KEY,
          case_id varchar(64) NOT NULL REFERENCES local_center.cases(case_id),
          strategy varchar(64) NOT NULL,
          next_contact_at timestamptz NOT NULL,
          assignee_id varchar(64) NOT NULL,
          status varchar(32) NOT NULL DEFAULT 'PENDING',
          created_at timestamptz NOT NULL DEFAULT now()
        )
        """
    )
    _exec("CREATE INDEX IF NOT EXISTS ix_local_contact_plans_due ON local_center.contact_plans (next_contact_at, status)")

    _exec(
        """
        CREATE TABLE IF NOT EXISTS local_center.exam_orders (
          id varchar(64) PRIMARY KEY,
          case_id varchar(64) NOT NULL REFERENCES local_center.cases(case_id),
          order_no varchar(128) NOT NULL,
          status varchar(32) NOT NULL DEFAULT 'ORDERED',
          ordered_at timestamptz NOT NULL DEFAULT now()
        )
        """
    )

    _exec(
        """
        CREATE TABLE IF NOT EXISTS local_center.appointments (
          id varchar(64) PRIMARY KEY,
          case_id varchar(64) NOT NULL REFERENCES local_center.cases(case_id),
          appointment_at timestamptz NOT NULL,
          status varchar(32) NOT NULL DEFAULT 'SCHEDULED',
          organization varchar(255)
        )
        """
    )
    _exec("CREATE INDEX IF NOT EXISTS ix_local_appointments_case_at ON local_center.appointments (case_id, appointment_at)")

    _exec(
        """
        CREATE TABLE IF NOT EXISTS local_center.exam_results (
          id varchar(64) PRIMARY KEY,
          case_id varchar(64) NOT NULL REFERENCES local_center.cases(case_id),
          status varchar(16) NOT NULL DEFAULT 'pending',
          result_json jsonb,
          validated_at timestamptz
        )
        """
    )
    _exec("CREATE INDEX IF NOT EXISTS ix_local_exam_results_case_status ON local_center.exam_results (case_id, status)")

    _exec(
        """
        CREATE TABLE IF NOT EXISTS local_center.stage2_model_runs (
          id varchar(64) PRIMARY KEY,
          case_id varchar(64) NOT NULL REFERENCES local_center.cases(case_id),
          exam_result_id varchar(64) NOT NULL REFERENCES local_center.exam_results(id),
          model_version varchar(64) NOT NULL,
          score numeric(8,4) NOT NULL,
          created_at timestamptz NOT NULL DEFAULT now()
        )
        """
    )
    _exec("CREATE INDEX IF NOT EXISTS ix_local_stage2_runs_case_created ON local_center.stage2_model_runs (case_id, created_at)")

    _exec(
        """
        CREATE TABLE IF NOT EXISTS local_center.followups (
          id varchar(64) PRIMARY KEY,
          case_id varchar(64) NOT NULL REFERENCES local_center.cases(case_id),
          followup_at timestamptz NOT NULL,
          status varchar(32) NOT NULL DEFAULT 'PENDING',
          note text
        )
        """
    )
    _exec("CREATE INDEX IF NOT EXISTS ix_local_followups_case_at ON local_center.followups (case_id, followup_at)")

    _exec(
        """
        CREATE TABLE IF NOT EXISTS local_center.interventions (
          id varchar(64) PRIMARY KEY,
          case_id varchar(64) NOT NULL REFERENCES local_center.cases(case_id),
          intervention_type varchar(64) NOT NULL,
          status varchar(32) NOT NULL DEFAULT 'OPEN',
          payload_json jsonb,
          created_at timestamptz NOT NULL DEFAULT now()
        )
        """
    )

    _exec(
        """
        CREATE TABLE IF NOT EXISTS local_center.stage3_model_runs (
          id varchar(64) PRIMARY KEY,
          case_id varchar(64) NOT NULL REFERENCES local_center.cases(case_id),
          stage2_model_run_id varchar(64) NOT NULL REFERENCES local_center.stage2_model_runs(id),
          model_version varchar(64) NOT NULL,
          score numeric(8,4) NOT NULL,
          created_at timestamptz NOT NULL DEFAULT now()
        )
        """
    )
    _exec("CREATE INDEX IF NOT EXISTS ix_local_stage3_runs_case_created ON local_center.stage3_model_runs (case_id, created_at)")

    _exec(
        """
        CREATE TABLE IF NOT EXISTS local_center.alerts (
          id varchar(64) PRIMARY KEY,
          case_id varchar(64) NOT NULL REFERENCES local_center.cases(case_id),
          alert_type varchar(64) NOT NULL,
          severity varchar(16) NOT NULL,
          status varchar(16) NOT NULL DEFAULT 'OPEN',
          message text NOT NULL,
          created_at timestamptz NOT NULL DEFAULT now()
        )
        """
    )
    _exec("CREATE INDEX IF NOT EXISTS ix_local_alerts_case_status ON local_center.alerts (case_id, status)")

    _exec(
        """
        CREATE TABLE IF NOT EXISTS local_center.rag_runs (
          id varchar(64) PRIMARY KEY,
          case_id varchar(64) NOT NULL REFERENCES local_center.cases(case_id),
          stage varchar(16) NOT NULL,
          status varchar(32) NOT NULL DEFAULT 'DONE',
          summary text,
          created_at timestamptz NOT NULL DEFAULT now()
        )
        """
    )
    _exec("CREATE INDEX IF NOT EXISTS ix_local_rag_runs_case_stage ON local_center.rag_runs (case_id, stage)")

    _exec(
        """
        INSERT INTO local_center.refusal_codes (code, label, is_active)
        VALUES
          ('R1_SELF_REJECT', '본인 거부', true),
          ('R2_GUARDIAN_REJECT', '보호자 거부', true),
          ('R3_OTHER_INSTITUTION', '타 기관 이용', true),
          ('R4_ALREADY_DIAGNOSED', '이미 진단/관리 중', true),
          ('R5_CONTACT_INVALID', '연락처 오류', true),
          ('R6_EMOTIONAL_BACKLASH', '감정 반응 우려', true),
          ('R7_OTHER', '기타', true)
        ON CONFLICT (code) DO NOTHING
        """
    )

    _exec(
        """
        INSERT INTO local_center.centers (id, name, region_code)
        VALUES ('LC-001', '강남구 치매안심센터', '11')
        ON CONFLICT (id) DO NOTHING
        """
    )

    _exec(
        """
        INSERT INTO local_center.users (id, center_id, name, email, is_active)
        VALUES ('u-local-001', 'LC-001', '담당상담사', 'local.001@neuro.local', true)
        ON CONFLICT (id) DO NOTHING
        """
    )

    _exec(
        """
        INSERT INTO local_center.cases
          (case_id, center_id, owner_id, owner_type, stage, status, operational_status, priority_tier, alert_level, subject_json, communication_json, referral_json, metrics_json, raw_json)
        VALUES
          (
            'LC-DEMO-0001',
            'LC-001',
            'u-local-001',
            'counselor',
            1,
            'CONTACT_READY',
            'TRACKING',
            'P1',
            'MID',
            '{"maskedName":"대상자-0001","age":76,"maskedPhone":"010-****-1001","pseudonymKey":"PS-0001"}'::jsonb,
            '{"recommendedTimeSlot":"평일 14:00~16:00","history":[]}'::jsonb,
            '{"organization":"지역 협력기관","status":"in_progress","ownerNote":"연계 검토 중"}'::jsonb,
            '{"scoreZ":-1.7,"scoreChangePct":-6,"dataQualityPct":92,"contactSuccessRatePct":68,"contactFailStreak":2,"trendByQuarter":[{"quarter":"24-Q4","value":-1.4},{"quarter":"25-Q1","value":-1.7}],"threshold":-1.8}'::jsonb,
            '{"caseId":"LC-DEMO-0001","stage":3,"subject":{"maskedName":"대상자-0001","age":76,"maskedPhone":"010-****-1001","pseudonymKey":"PS-0001"},"owner":{"name":"담당상담사","role":"counselor"},"status":"in_progress","operationalStatus":"TRACKING","headerMeta":{"next_reval_at":"2026-03-01","next_contact_at":"2026-02-20","next_program_at":"2026-02-25","plan_status":"ACTIVE","tracking_cycle_days":30,"churn_risk":"MID"},"risk":{"zone":"watch","intensity":"monthly","intensityReason":"기본 추적 강도","triggers":[]},"metrics":{"scoreZ":-1.7,"scoreChangePct":-6,"dataQualityPct":92,"contactSuccessRatePct":68,"contactFailStreak":2,"trendByQuarter":[{"quarter":"24-Q4","value":-1.4},{"quarter":"25-Q1","value":-1.7}],"threshold":-1.8},"prediction":{"horizonMonths":24,"probability":0.53,"generatedAt":"2026-02-17 09:00","confidence":"MID","intervalPct":{"low":46,"high":60},"topDrivers":[],"trend":[]},"ops":{"nextCheckpointAt":"2026-03-01","lastContactAt":"2026-02-14","lastAssessmentAt":"2026-01-20","recommended_actions":[],"recommendedActions":[]},"audit":[],"timeline":[],"communication":{"recommendedTimeSlot":"평일 14:00~16:00","history":[]},"referral":{"organization":"지역 협력기관","status":"in_progress","updatedAt":"2026-02-17 09:00","ownerNote":"연계 검토 중"}}'::jsonb
          )
        ON CONFLICT (case_id) DO NOTHING
        """
    )

    _exec(
        """
        INSERT INTO local_center.case_stage_states (case_id, stage, state, entered_at, is_current)
        VALUES ('LC-DEMO-0001', 1, 'CONTACT_READY', now(), true)
        ON CONFLICT DO NOTHING
        """
    )

    _exec(
        """
        INSERT INTO local_center.exam_results (id, case_id, status, result_json, validated_at)
        VALUES
          ('ER-DEMO-0001', 'LC-DEMO-0001', 'valid', '{"score":72}'::jsonb, now()),
          ('ER-DEMO-0002', 'LC-DEMO-0001', 'pending', '{}'::jsonb, NULL)
        ON CONFLICT (id) DO NOTHING
        """
    )

    _exec(
        """
        INSERT INTO local_center.followups (id, case_id, followup_at, status, note)
        VALUES
          ('FU-DEMO-0001', 'LC-DEMO-0001', now() - interval '5 days', 'DONE', '1차 추적 완료'),
          ('FU-DEMO-0002', 'LC-DEMO-0001', now() - interval '2 days', 'DONE', '2차 추적 완료')
        ON CONFLICT (id) DO NOTHING
        """
    )


def downgrade() -> None:
    for table in [
        'rag_runs',
        'alerts',
        'stage3_model_runs',
        'interventions',
        'followups',
        'stage2_model_runs',
        'exam_results',
        'appointments',
        'exam_orders',
        'contact_plans',
        'refusal_codes',
        'stage1_contact_results',
        'stage1_contacts',
        'notes',
        'attachments',
        'audit_events',
        'timeline_events',
        'schedules',
        'work_items',
        'case_stage_states',
        'cases',
        'user_roles',
        'users',
        'roles',
        'centers',
    ]:
        _exec(f'DROP TABLE IF EXISTS local_center.{table} CASCADE')

    _exec('DROP SCHEMA IF EXISTS local_center CASCADE')
