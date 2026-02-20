"""citizen/comms domain tables and local center extensions

Revision ID: 0004_citizen_comms_domain
Revises: 0003_local_center_domain
Create Date: 2026-02-19
"""
from __future__ import annotations

from typing import Sequence

from alembic import op

revision: str = '0004_citizen_comms_domain'
down_revision: str | None = '0003_local_center_domain'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _exec(sql: str) -> None:
    op.get_bind().exec_driver_sql(sql)


def upgrade() -> None:
    _exec("CREATE SCHEMA IF NOT EXISTS citizen")
    _exec("CREATE SCHEMA IF NOT EXISTS comms")

    _exec("ALTER TABLE local_center.cases ADD COLUMN IF NOT EXISTS case_key varchar(96)")
    _exec("UPDATE local_center.cases SET case_key = 'CK-' || substr(md5(case_id), 1, 20) WHERE case_key IS NULL")
    _exec("ALTER TABLE local_center.cases ALTER COLUMN case_key SET NOT NULL")
    _exec(
        """
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1
            FROM pg_constraint
            WHERE conname = 'uq_local_cases_case_key'
              AND conrelid = 'local_center.cases'::regclass
          ) THEN
            ALTER TABLE local_center.cases
              ADD CONSTRAINT uq_local_cases_case_key UNIQUE (case_key);
          END IF;
        END
        $$;
        """
    )
    _exec("CREATE INDEX IF NOT EXISTS ix_local_cases_case_key ON local_center.cases (case_key)")

    _exec("ALTER TABLE local_center.exam_results ADD COLUMN IF NOT EXISTS validated_by varchar(64)")
    _exec("ALTER TABLE local_center.attachments ADD COLUMN IF NOT EXISTS file_key varchar(255)")
    _exec("ALTER TABLE local_center.attachments ADD COLUMN IF NOT EXISTS metadata_json jsonb")
    _exec("ALTER TABLE local_center.audit_events ADD COLUMN IF NOT EXISTS entity_type varchar(64)")
    _exec("ALTER TABLE local_center.audit_events ADD COLUMN IF NOT EXISTS entity_id varchar(96)")
    _exec("CREATE INDEX IF NOT EXISTS ix_local_audit_entity_at ON local_center.audit_events (entity_type, entity_id, at DESC)")

    _exec(
        """
        CREATE TABLE IF NOT EXISTS local_center.contacts (
          id varchar(64) PRIMARY KEY,
          case_id varchar(64) NOT NULL REFERENCES local_center.cases(case_id),
          channel varchar(16) NOT NULL DEFAULT 'CALL',
          template_id varchar(128),
          status varchar(32) NOT NULL DEFAULT 'PENDING',
          payload_json jsonb,
          created_at timestamptz NOT NULL DEFAULT now()
        )
        """
    )
    _exec("CREATE INDEX IF NOT EXISTS ix_local_contacts_case_created ON local_center.contacts (case_id, created_at)")

    _exec(
        """
        CREATE TABLE IF NOT EXISTS local_center.contact_results (
          id varchar(64) PRIMARY KEY,
          contact_id varchar(64) NOT NULL REFERENCES local_center.contacts(id),
          case_id varchar(64) NOT NULL REFERENCES local_center.cases(case_id),
          outcome_type varchar(64) NOT NULL,
          detail text,
          payload_json jsonb,
          created_at timestamptz NOT NULL DEFAULT now()
        )
        """
    )
    _exec(
        "CREATE INDEX IF NOT EXISTS ix_local_contact_results_contact_created ON local_center.contact_results (contact_id, created_at)"
    )

    _exec(
        """
        CREATE TABLE IF NOT EXISTS citizen.citizen_sessions (
          id varchar(64) PRIMARY KEY,
          case_id varchar(64) NOT NULL REFERENCES local_center.cases(case_id),
          invite_token_hash varchar(128) NOT NULL UNIQUE,
          phone_hash varchar(128),
          status varchar(32) NOT NULL DEFAULT 'PENDING',
          expires_at timestamptz NOT NULL,
          otp_verified_at timestamptz,
          locked_at timestamptz,
          used_at timestamptz,
          metadata_json jsonb,
          created_at timestamptz NOT NULL DEFAULT now(),
          updated_at timestamptz NOT NULL DEFAULT now()
        )
        """
    )
    _exec("CREATE INDEX IF NOT EXISTS ix_citizen_sessions_invite_token_hash ON citizen.citizen_sessions (invite_token_hash)")
    _exec("CREATE INDEX IF NOT EXISTS ix_citizen_sessions_case_id ON citizen.citizen_sessions (case_id)")

    _exec(
        """
        CREATE TABLE IF NOT EXISTS citizen.citizen_otp_logs (
          id bigserial PRIMARY KEY,
          citizen_session_id varchar(64) NOT NULL REFERENCES citizen.citizen_sessions(id),
          otp_hash varchar(128) NOT NULL,
          status varchar(32) NOT NULL DEFAULT 'ISSUED',
          ip_hash varchar(128),
          phone_hash varchar(128),
          error_code varchar(64),
          attempt_no integer NOT NULL DEFAULT 0,
          expires_at timestamptz NOT NULL,
          requested_at timestamptz NOT NULL DEFAULT now(),
          verified_at timestamptz
        )
        """
    )
    _exec(
        "CREATE INDEX IF NOT EXISTS ix_citizen_otp_logs_session_requested ON citizen.citizen_otp_logs (citizen_session_id, requested_at)"
    )
    _exec("CREATE INDEX IF NOT EXISTS ix_citizen_otp_logs_ip_requested ON citizen.citizen_otp_logs (ip_hash, requested_at)")

    _exec(
        """
        CREATE TABLE IF NOT EXISTS citizen.consent_templates (
          id varchar(64) PRIMARY KEY,
          version varchar(32) NOT NULL DEFAULT 'v1',
          title varchar(255) NOT NULL,
          body text NOT NULL,
          required boolean NOT NULL DEFAULT true,
          active boolean NOT NULL DEFAULT true,
          created_at timestamptz NOT NULL DEFAULT now()
        )
        """
    )

    _exec(
        """
        CREATE TABLE IF NOT EXISTS citizen.citizen_consents (
          id varchar(64) PRIMARY KEY,
          citizen_session_id varchar(64) NOT NULL REFERENCES citizen.citizen_sessions(id),
          case_id varchar(64) NOT NULL REFERENCES local_center.cases(case_id),
          template_id varchar(64) REFERENCES citizen.consent_templates(id),
          consent_type varchar(64) NOT NULL,
          agreed boolean NOT NULL DEFAULT false,
          payload_json jsonb,
          agreed_at timestamptz,
          created_at timestamptz NOT NULL DEFAULT now()
        )
        """
    )
    _exec("CREATE INDEX IF NOT EXISTS ix_citizen_consents_case_created ON citizen.citizen_consents (case_id, created_at)")

    _exec(
        """
        CREATE TABLE IF NOT EXISTS citizen.citizen_profile_inputs (
          id varchar(64) PRIMARY KEY,
          citizen_session_id varchar(64) NOT NULL REFERENCES citizen.citizen_sessions(id),
          case_id varchar(64) NOT NULL REFERENCES local_center.cases(case_id),
          payload_json jsonb NOT NULL,
          created_at timestamptz NOT NULL DEFAULT now()
        )
        """
    )
    _exec(
        "CREATE INDEX IF NOT EXISTS ix_citizen_profile_inputs_case_created ON citizen.citizen_profile_inputs (case_id, created_at)"
    )

    _exec(
        """
        CREATE TABLE IF NOT EXISTS citizen.citizen_questionnaire_responses (
          id varchar(64) PRIMARY KEY,
          citizen_session_id varchar(64) NOT NULL REFERENCES citizen.citizen_sessions(id),
          case_id varchar(64) NOT NULL REFERENCES local_center.cases(case_id),
          questionnaire_id varchar(64) NOT NULL,
          responses_json jsonb NOT NULL,
          created_at timestamptz NOT NULL DEFAULT now()
        )
        """
    )
    _exec(
        "CREATE INDEX IF NOT EXISTS ix_citizen_questionnaire_case_created ON citizen.citizen_questionnaire_responses (case_id, created_at)"
    )

    _exec(
        """
        CREATE TABLE IF NOT EXISTS citizen.citizen_uploads (
          id varchar(64) PRIMARY KEY,
          citizen_session_id varchar(64) NOT NULL REFERENCES citizen.citizen_sessions(id),
          case_id varchar(64) NOT NULL REFERENCES local_center.cases(case_id),
          file_key varchar(255) NOT NULL,
          file_name varchar(255) NOT NULL,
          content_type varchar(128) NOT NULL,
          size_bytes integer,
          status varchar(32) NOT NULL DEFAULT 'PRESIGNED',
          metadata_json jsonb,
          committed_at timestamptz,
          created_at timestamptz NOT NULL DEFAULT now()
        )
        """
    )
    _exec("CREATE INDEX IF NOT EXISTS ix_citizen_uploads_case_created ON citizen.citizen_uploads (case_id, created_at)")

    _exec(
        """
        CREATE TABLE IF NOT EXISTS citizen.citizen_requests (
          id varchar(64) PRIMARY KEY,
          citizen_session_id varchar(64) NOT NULL REFERENCES citizen.citizen_sessions(id),
          case_id varchar(64) NOT NULL REFERENCES local_center.cases(case_id),
          request_type varchar(64) NOT NULL,
          status varchar(32) NOT NULL DEFAULT 'RECEIVED',
          payload_json jsonb,
          created_at timestamptz NOT NULL DEFAULT now(),
          processed_at timestamptz
        )
        """
    )
    _exec("CREATE INDEX IF NOT EXISTS ix_citizen_requests_status_created ON citizen.citizen_requests (status, created_at)")

    _exec(
        """
        CREATE TABLE IF NOT EXISTS comms.message_templates (
          id varchar(64) PRIMARY KEY,
          channel varchar(16) NOT NULL DEFAULT 'SMS',
          body_template text NOT NULL,
          active boolean NOT NULL DEFAULT true,
          created_at timestamptz NOT NULL DEFAULT now()
        )
        """
    )

    _exec(
        """
        CREATE TABLE IF NOT EXISTS comms.message_outbox (
          id varchar(64) PRIMARY KEY,
          case_id varchar(64) REFERENCES local_center.cases(case_id),
          channel varchar(16) NOT NULL DEFAULT 'SMS',
          template_id varchar(64) REFERENCES comms.message_templates(id),
          to_hash varchar(128) NOT NULL,
          payload_json jsonb,
          status varchar(32) NOT NULL DEFAULT 'PENDING',
          retry_count integer NOT NULL DEFAULT 0,
          next_retry_at timestamptz,
          last_error text,
          created_at timestamptz NOT NULL DEFAULT now(),
          sent_at timestamptz
        )
        """
    )
    _exec("CREATE INDEX IF NOT EXISTS ix_comms_outbox_status_due ON comms.message_outbox (status, next_retry_at)")

    _exec(
        """
        CREATE TABLE IF NOT EXISTS comms.message_events (
          id bigserial PRIMARY KEY,
          outbox_id varchar(64) NOT NULL REFERENCES comms.message_outbox(id),
          event_type varchar(64) NOT NULL,
          payload_json jsonb,
          created_at timestamptz NOT NULL DEFAULT now()
        )
        """
    )
    _exec("CREATE INDEX IF NOT EXISTS ix_comms_events_outbox_created ON comms.message_events (outbox_id, created_at)")

    _exec(
        """
        INSERT INTO citizen.consent_templates (id, version, title, body, required, active)
        VALUES
          ('CONSENT_CORE_V1', 'v1', '필수 동의', '검사 및 추적 관리를 위한 필수 동의', true, true),
          ('CONSENT_MARKETING_V1', 'v1', '선택 동의', '추가 복지 서비스 안내 수신 동의', false, true)
        ON CONFLICT (id) DO NOTHING
        """
    )

    _exec(
        """
        INSERT INTO comms.message_templates (id, channel, body_template, active)
        VALUES
          ('citizen_invite', 'SMS', '[Neuro-Shield] 안내 링크: {{link}}', true),
          ('citizen_otp', 'SMS', '[Neuro-Shield] 본인확인 OTP: {{otp}}', true),
          ('citizen_reminder', 'SMS', '[Neuro-Shield] 미완료 항목이 있습니다. 링크: {{link}}', true)
        ON CONFLICT (id) DO NOTHING
        """
    )

    _exec(
        """
        INSERT INTO local_center.cases (
          case_id, case_key, center_id, owner_id, owner_type, stage, status, operational_status, priority_tier, alert_level,
          subject_json, communication_json, referral_json, metrics_json, raw_json
        )
        VALUES (
          'CASE-DEMO-001',
          'CK-' || substr(md5('CASE-DEMO-001'), 1, 20),
          'LC-001',
          'u-local-001',
          'counselor',
          1,
          'QUEUED',
          'TRACKING',
          'P2',
          'LOW',
          '{"maskedName":"대상자-0001","maskedPhone":"010-****-1001","age":74}'::jsonb,
          '{}'::jsonb,
          '{}'::jsonb,
          '{}'::jsonb,
          '{"status":"in_progress"}'::jsonb
        )
        ON CONFLICT (case_id) DO NOTHING
        """
    )

    _exec(
        """
        INSERT INTO citizen.citizen_sessions (
          id, case_id, invite_token_hash, phone_hash, status, expires_at, metadata_json
        )
        VALUES (
          'CS-DEMO-001',
          'CASE-DEMO-001',
          '4f9703569f0f9f2f3f38184eb4bd100f977f530e78d30005d8f6d36bd80da407',
          'demo-phone-hash',
          'PENDING',
          now() + interval '48 hour',
          '{"demo":true}'::jsonb
        )
        ON CONFLICT (id) DO NOTHING
        """
    )


def downgrade() -> None:
    _exec("DROP TABLE IF EXISTS comms.message_events")
    _exec("DROP TABLE IF EXISTS comms.message_outbox")
    _exec("DROP TABLE IF EXISTS comms.message_templates")
    _exec("DROP SCHEMA IF EXISTS comms CASCADE")

    _exec("DROP TABLE IF EXISTS citizen.citizen_requests")
    _exec("DROP TABLE IF EXISTS citizen.citizen_uploads")
    _exec("DROP TABLE IF EXISTS citizen.citizen_questionnaire_responses")
    _exec("DROP TABLE IF EXISTS citizen.citizen_profile_inputs")
    _exec("DROP TABLE IF EXISTS citizen.citizen_consents")
    _exec("DROP TABLE IF EXISTS citizen.consent_templates")
    _exec("DROP TABLE IF EXISTS citizen.citizen_otp_logs")
    _exec("DROP TABLE IF EXISTS citizen.citizen_sessions")
    _exec("DROP SCHEMA IF EXISTS citizen CASCADE")

    _exec("DROP TABLE IF EXISTS local_center.contact_results")
    _exec("DROP TABLE IF EXISTS local_center.contacts")

    _exec("DROP INDEX IF EXISTS ix_local_audit_entity_at")
    _exec("ALTER TABLE local_center.audit_events DROP COLUMN IF EXISTS entity_id")
    _exec("ALTER TABLE local_center.audit_events DROP COLUMN IF EXISTS entity_type")

    _exec("ALTER TABLE local_center.attachments DROP COLUMN IF EXISTS metadata_json")
    _exec("ALTER TABLE local_center.attachments DROP COLUMN IF EXISTS file_key")
    _exec("ALTER TABLE local_center.exam_results DROP COLUMN IF EXISTS validated_by")

    _exec("ALTER TABLE local_center.cases DROP CONSTRAINT IF EXISTS uq_local_cases_case_key")
    _exec("DROP INDEX IF EXISTS ix_local_cases_case_key")
    _exec("ALTER TABLE local_center.cases DROP COLUMN IF EXISTS case_key")
