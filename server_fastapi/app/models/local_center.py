from __future__ import annotations

from datetime import datetime

from sqlalchemy import (
    Boolean,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    JSON,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column

from server_fastapi.app.db.base import Base


class Center(Base):
    __tablename__ = 'centers'
    __table_args__ = {'schema': 'local_center'}

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    region_code: Mapped[str] = mapped_column(String(32), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class LocalRole(Base):
    __tablename__ = 'roles'
    __table_args__ = {'schema': 'local_center'}

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    name: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)


class LocalUser(Base):
    __tablename__ = 'users'
    __table_args__ = {'schema': 'local_center'}

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    center_id: Mapped[str | None] = mapped_column(ForeignKey('local_center.centers.id'))
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    email: Mapped[str | None] = mapped_column(String(255), unique=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)


class LocalUserRole(Base):
    __tablename__ = 'user_roles'
    __table_args__ = (
        UniqueConstraint('user_id', 'role_id', name='uq_local_user_role'),
        {'schema': 'local_center'},
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[str] = mapped_column(ForeignKey('local_center.users.id'), nullable=False)
    role_id: Mapped[str] = mapped_column(ForeignKey('local_center.roles.id'), nullable=False)


class LocalCase(Base):
    __tablename__ = 'cases'
    __table_args__ = (
        Index('ix_local_cases_stage_status', 'stage', 'status'),
        Index('ix_local_cases_alert_priority', 'alert_level', 'priority_tier'),
        Index('ix_local_cases_case_key', 'case_key'),
        {'schema': 'local_center'},
    )

    case_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    case_key: Mapped[str] = mapped_column(String(96), unique=True, nullable=False)
    center_id: Mapped[str] = mapped_column(ForeignKey('local_center.centers.id'), nullable=False)
    owner_id: Mapped[str | None] = mapped_column(ForeignKey('local_center.users.id'))
    owner_type: Mapped[str] = mapped_column(String(32), nullable=False, default='counselor')
    stage: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    status: Mapped[str] = mapped_column(String(64), nullable=False, default='QUEUED')
    operational_status: Mapped[str] = mapped_column(String(64), nullable=False, default='TRACKING')
    priority_tier: Mapped[str] = mapped_column(String(16), nullable=False, default='P2')
    alert_level: Mapped[str | None] = mapped_column(String(16))
    subject_json: Mapped[dict] = mapped_column(JSON, nullable=False)
    communication_json: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    referral_json: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    metrics_json: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    raw_json: Mapped[dict | None] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class CaseStageState(Base):
    __tablename__ = 'case_stage_states'
    __table_args__ = (
        Index('ix_local_case_stage_state_case_stage', 'case_id', 'stage'),
        {'schema': 'local_center'},
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    case_id: Mapped[str] = mapped_column(ForeignKey('local_center.cases.case_id'), nullable=False)
    stage: Mapped[int] = mapped_column(Integer, nullable=False)
    state: Mapped[str] = mapped_column(String(64), nullable=False)
    entered_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    exited_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    is_current: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)


class WorkItem(Base):
    __tablename__ = 'work_items'
    __table_args__ = (
        Index('ix_local_work_items_case_status_due', 'case_id', 'status', 'due_at'),
        {'schema': 'local_center'},
    )

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    case_id: Mapped[str] = mapped_column(ForeignKey('local_center.cases.case_id'), nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    item_type: Mapped[str] = mapped_column(String(64), nullable=False)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default='OPEN')
    priority: Mapped[str] = mapped_column(String(16), nullable=False, default='P2')
    assignee_id: Mapped[str | None] = mapped_column(ForeignKey('local_center.users.id'))
    due_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    payload_json: Mapped[dict | None] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class Schedule(Base):
    __tablename__ = 'schedules'
    __table_args__ = (
        UniqueConstraint('idempotency_key', name='uq_local_schedules_idempotency'),
        Index('ix_local_schedules_due', 'start_at', 'status'),
        {'schema': 'local_center'},
    )

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    idempotency_key: Mapped[str] = mapped_column(String(255), nullable=False)
    case_id: Mapped[str] = mapped_column(ForeignKey('local_center.cases.case_id'), nullable=False)
    event_type: Mapped[str] = mapped_column(String(32), nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    start_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    duration_min: Mapped[int] = mapped_column(Integer, nullable=False, default=20)
    priority: Mapped[str] = mapped_column(String(16), nullable=False, default='NORMAL')
    assignee_id: Mapped[str | None] = mapped_column(ForeignKey('local_center.users.id'))
    payload_json: Mapped[dict | None] = mapped_column(JSON)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default='SCHEDULED')
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class TimelineEvent(Base):
    __tablename__ = 'timeline_events'
    __table_args__ = (
        Index('ix_local_timeline_case_at', 'case_id', 'at'),
        {'schema': 'local_center'},
    )

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    case_id: Mapped[str] = mapped_column(ForeignKey('local_center.cases.case_id'), nullable=False)
    at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    event_type: Mapped[str] = mapped_column(String(64), nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    detail: Mapped[str | None] = mapped_column(Text)
    actor_name: Mapped[str] = mapped_column(String(128), nullable=False)
    actor_type: Mapped[str] = mapped_column(String(16), nullable=False, default='system')
    payload_json: Mapped[dict | None] = mapped_column(JSON)


class LocalAuditEvent(Base):
    __tablename__ = 'audit_events'
    __table_args__ = (
        Index('ix_local_audit_case_at', 'case_id', 'at'),
        Index('ix_local_audit_entity_at', 'entity_type', 'entity_id', 'at'),
        {'schema': 'local_center'},
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    case_id: Mapped[str] = mapped_column(ForeignKey('local_center.cases.case_id'), nullable=False)
    at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    actor_name: Mapped[str] = mapped_column(String(128), nullable=False)
    actor_type: Mapped[str] = mapped_column(String(16), nullable=False, default='system')
    action: Mapped[str] = mapped_column(String(128), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    severity: Mapped[str] = mapped_column(String(16), nullable=False, default='info')
    entity_type: Mapped[str | None] = mapped_column(String(64))
    entity_id: Mapped[str | None] = mapped_column(String(96))
    before_json: Mapped[dict | None] = mapped_column(JSON)
    after_json: Mapped[dict | None] = mapped_column(JSON)


class Attachment(Base):
    __tablename__ = 'attachments'
    __table_args__ = {'schema': 'local_center'}

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    case_id: Mapped[str] = mapped_column(ForeignKey('local_center.cases.case_id'), nullable=False)
    file_key: Mapped[str | None] = mapped_column(String(255))
    file_name: Mapped[str] = mapped_column(String(255), nullable=False)
    file_url: Mapped[str] = mapped_column(String(1024), nullable=False)
    metadata_json: Mapped[dict | None] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class Note(Base):
    __tablename__ = 'notes'
    __table_args__ = {'schema': 'local_center'}

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    case_id: Mapped[str] = mapped_column(ForeignKey('local_center.cases.case_id'), nullable=False)
    author: Mapped[str] = mapped_column(String(128), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class Stage1Contact(Base):
    __tablename__ = 'stage1_contacts'
    __table_args__ = {'schema': 'local_center'}

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    case_id: Mapped[str] = mapped_column(ForeignKey('local_center.cases.case_id'), nullable=False)
    channel: Mapped[str] = mapped_column(String(16), nullable=False)
    template_id: Mapped[str | None] = mapped_column(String(128))
    status: Mapped[str] = mapped_column(String(32), nullable=False, default='NOT_STARTED')
    sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class Contact(Base):
    __tablename__ = 'contacts'
    __table_args__ = (
        Index('ix_local_contacts_case_created', 'case_id', 'created_at'),
        {'schema': 'local_center'},
    )

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    case_id: Mapped[str] = mapped_column(ForeignKey('local_center.cases.case_id'), nullable=False)
    channel: Mapped[str] = mapped_column(String(16), nullable=False, default='CALL')
    template_id: Mapped[str | None] = mapped_column(String(128))
    status: Mapped[str] = mapped_column(String(32), nullable=False, default='PENDING')
    payload_json: Mapped[dict | None] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class ContactResult(Base):
    __tablename__ = 'contact_results'
    __table_args__ = (
        Index('ix_local_contact_results_contact_created', 'contact_id', 'created_at'),
        {'schema': 'local_center'},
    )

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    contact_id: Mapped[str] = mapped_column(ForeignKey('local_center.contacts.id'), nullable=False)
    case_id: Mapped[str] = mapped_column(ForeignKey('local_center.cases.case_id'), nullable=False)
    outcome_type: Mapped[str] = mapped_column(String(64), nullable=False)
    detail: Mapped[str | None] = mapped_column(Text)
    payload_json: Mapped[dict | None] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class Stage1ContactResult(Base):
    __tablename__ = 'stage1_contact_results'
    __table_args__ = (
        Index('ix_local_stage1_results_case_created', 'case_id', 'created_at'),
        {'schema': 'local_center'},
    )

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    case_id: Mapped[str] = mapped_column(ForeignKey('local_center.cases.case_id'), nullable=False)
    outcome_type: Mapped[str] = mapped_column(String(64), nullable=False)
    memo: Mapped[str | None] = mapped_column(Text)
    reason_tags_json: Mapped[dict | None] = mapped_column(JSON)
    reject_code: Mapped[str | None] = mapped_column(String(64))
    reject_level: Mapped[str | None] = mapped_column(String(16))
    reject_detail: Mapped[str | None] = mapped_column(Text)
    followup_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    no_response_strategy: Mapped[str | None] = mapped_column(String(64))
    next_contact_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    assignee_id: Mapped[str | None] = mapped_column(String(64))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class RefusalCode(Base):
    __tablename__ = 'refusal_codes'
    __table_args__ = {'schema': 'local_center'}

    code: Mapped[str] = mapped_column(String(64), primary_key=True)
    label: Mapped[str] = mapped_column(String(255), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)


class ContactPlan(Base):
    __tablename__ = 'contact_plans'
    __table_args__ = (
        Index('ix_local_contact_plans_due', 'next_contact_at', 'status'),
        {'schema': 'local_center'},
    )

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    case_id: Mapped[str] = mapped_column(ForeignKey('local_center.cases.case_id'), nullable=False)
    strategy: Mapped[str] = mapped_column(String(64), nullable=False)
    next_contact_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    assignee_id: Mapped[str] = mapped_column(String(64), nullable=False)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default='PENDING')
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class ExamOrder(Base):
    __tablename__ = 'exam_orders'
    __table_args__ = {'schema': 'local_center'}

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    case_id: Mapped[str] = mapped_column(ForeignKey('local_center.cases.case_id'), nullable=False)
    order_no: Mapped[str] = mapped_column(String(128), nullable=False)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default='ORDERED')
    ordered_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class Appointment(Base):
    __tablename__ = 'appointments'
    __table_args__ = (
        Index('ix_local_appointments_case_at', 'case_id', 'appointment_at'),
        {'schema': 'local_center'},
    )

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    case_id: Mapped[str] = mapped_column(ForeignKey('local_center.cases.case_id'), nullable=False)
    appointment_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default='SCHEDULED')
    organization: Mapped[str | None] = mapped_column(String(255))


class ExamResult(Base):
    __tablename__ = 'exam_results'
    __table_args__ = (
        Index('ix_local_exam_results_case_status', 'case_id', 'status'),
        {'schema': 'local_center'},
    )

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    case_id: Mapped[str] = mapped_column(ForeignKey('local_center.cases.case_id'), nullable=False)
    status: Mapped[str] = mapped_column(String(16), nullable=False, default='pending')
    result_json: Mapped[dict | None] = mapped_column(JSON)
    validated_by: Mapped[str | None] = mapped_column(String(64))
    validated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class Stage2ModelRun(Base):
    __tablename__ = 'stage2_model_runs'
    __table_args__ = (
        Index('ix_local_stage2_runs_case_created', 'case_id', 'created_at'),
        {'schema': 'local_center'},
    )

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    case_id: Mapped[str] = mapped_column(ForeignKey('local_center.cases.case_id'), nullable=False)
    exam_result_id: Mapped[str] = mapped_column(ForeignKey('local_center.exam_results.id'), nullable=False)
    model_version: Mapped[str] = mapped_column(String(64), nullable=False)
    score: Mapped[float] = mapped_column(Numeric(8, 4), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class Followup(Base):
    __tablename__ = 'followups'
    __table_args__ = (
        Index('ix_local_followups_case_at', 'case_id', 'followup_at'),
        {'schema': 'local_center'},
    )

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    case_id: Mapped[str] = mapped_column(ForeignKey('local_center.cases.case_id'), nullable=False)
    followup_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default='PENDING')
    note: Mapped[str | None] = mapped_column(Text)


class LocalIntervention(Base):
    __tablename__ = 'interventions'
    __table_args__ = {'schema': 'local_center'}

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    case_id: Mapped[str] = mapped_column(ForeignKey('local_center.cases.case_id'), nullable=False)
    intervention_type: Mapped[str] = mapped_column(String(64), nullable=False)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default='OPEN')
    payload_json: Mapped[dict | None] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class Stage3ModelRun(Base):
    __tablename__ = 'stage3_model_runs'
    __table_args__ = (
        Index('ix_local_stage3_runs_case_created', 'case_id', 'created_at'),
        {'schema': 'local_center'},
    )

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    case_id: Mapped[str] = mapped_column(ForeignKey('local_center.cases.case_id'), nullable=False)
    stage2_model_run_id: Mapped[str] = mapped_column(ForeignKey('local_center.stage2_model_runs.id'), nullable=False)
    model_version: Mapped[str] = mapped_column(String(64), nullable=False)
    score: Mapped[float] = mapped_column(Numeric(8, 4), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class Alert(Base):
    __tablename__ = 'alerts'
    __table_args__ = (
        Index('ix_local_alerts_case_status', 'case_id', 'status'),
        {'schema': 'local_center'},
    )

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    case_id: Mapped[str] = mapped_column(ForeignKey('local_center.cases.case_id'), nullable=False)
    alert_type: Mapped[str] = mapped_column(String(64), nullable=False)
    severity: Mapped[str] = mapped_column(String(16), nullable=False)
    status: Mapped[str] = mapped_column(String(16), nullable=False, default='OPEN')
    message: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class RagRun(Base):
    __tablename__ = 'rag_runs'
    __table_args__ = (
        Index('ix_local_rag_runs_case_stage', 'case_id', 'stage'),
        {'schema': 'local_center'},
    )

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    case_id: Mapped[str] = mapped_column(ForeignKey('local_center.cases.case_id'), nullable=False)
    stage: Mapped[str] = mapped_column(String(16), nullable=False)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default='DONE')
    summary: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
