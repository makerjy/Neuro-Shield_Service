from __future__ import annotations

from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Index, Integer, JSON, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from server_fastapi.app.db.base import Base


class CitizenSession(Base):
    __tablename__ = 'citizen_sessions'
    __table_args__ = (
        Index('ix_citizen_sessions_invite_token_hash', 'invite_token_hash'),
        Index('ix_citizen_sessions_case_id', 'case_id'),
        {'schema': 'citizen'},
    )

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    case_id: Mapped[str] = mapped_column(ForeignKey('local_center.cases.case_id'), nullable=False)
    invite_token_hash: Mapped[str] = mapped_column(String(128), unique=True, nullable=False)
    phone_hash: Mapped[str | None] = mapped_column(String(128))
    status: Mapped[str] = mapped_column(String(32), nullable=False, default='PENDING')
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    otp_verified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    locked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    metadata_json: Mapped[dict | None] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class CitizenOtpLog(Base):
    __tablename__ = 'citizen_otp_logs'
    __table_args__ = (
        Index('ix_citizen_otp_logs_session_requested', 'citizen_session_id', 'requested_at'),
        Index('ix_citizen_otp_logs_ip_requested', 'ip_hash', 'requested_at'),
        {'schema': 'citizen'},
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    citizen_session_id: Mapped[str] = mapped_column(ForeignKey('citizen.citizen_sessions.id'), nullable=False)
    otp_hash: Mapped[str] = mapped_column(String(128), nullable=False)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default='ISSUED')
    ip_hash: Mapped[str | None] = mapped_column(String(128))
    phone_hash: Mapped[str | None] = mapped_column(String(128))
    error_code: Mapped[str | None] = mapped_column(String(64))
    attempt_no: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    requested_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    verified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class CitizenConsentTemplate(Base):
    __tablename__ = 'consent_templates'
    __table_args__ = {'schema': 'citizen'}

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    version: Mapped[str] = mapped_column(String(32), nullable=False, default='v1')
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    body: Mapped[str] = mapped_column(Text, nullable=False)
    required: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class CitizenConsent(Base):
    __tablename__ = 'citizen_consents'
    __table_args__ = (
        Index('ix_citizen_consents_case_created', 'case_id', 'created_at'),
        {'schema': 'citizen'},
    )

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    citizen_session_id: Mapped[str] = mapped_column(ForeignKey('citizen.citizen_sessions.id'), nullable=False)
    case_id: Mapped[str] = mapped_column(ForeignKey('local_center.cases.case_id'), nullable=False)
    template_id: Mapped[str | None] = mapped_column(ForeignKey('citizen.consent_templates.id'))
    consent_type: Mapped[str] = mapped_column(String(64), nullable=False)
    agreed: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    payload_json: Mapped[dict | None] = mapped_column(JSON)
    agreed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class CitizenProfileInput(Base):
    __tablename__ = 'citizen_profile_inputs'
    __table_args__ = (
        Index('ix_citizen_profile_inputs_case_created', 'case_id', 'created_at'),
        {'schema': 'citizen'},
    )

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    citizen_session_id: Mapped[str] = mapped_column(ForeignKey('citizen.citizen_sessions.id'), nullable=False)
    case_id: Mapped[str] = mapped_column(ForeignKey('local_center.cases.case_id'), nullable=False)
    payload_json: Mapped[dict] = mapped_column(JSON, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class CitizenQuestionnaireResponse(Base):
    __tablename__ = 'citizen_questionnaire_responses'
    __table_args__ = (
        Index('ix_citizen_questionnaire_case_created', 'case_id', 'created_at'),
        {'schema': 'citizen'},
    )

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    citizen_session_id: Mapped[str] = mapped_column(ForeignKey('citizen.citizen_sessions.id'), nullable=False)
    case_id: Mapped[str] = mapped_column(ForeignKey('local_center.cases.case_id'), nullable=False)
    questionnaire_id: Mapped[str] = mapped_column(String(64), nullable=False)
    responses_json: Mapped[dict] = mapped_column(JSON, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class CitizenUpload(Base):
    __tablename__ = 'citizen_uploads'
    __table_args__ = (
        Index('ix_citizen_uploads_case_created', 'case_id', 'created_at'),
        {'schema': 'citizen'},
    )

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    citizen_session_id: Mapped[str] = mapped_column(ForeignKey('citizen.citizen_sessions.id'), nullable=False)
    case_id: Mapped[str] = mapped_column(ForeignKey('local_center.cases.case_id'), nullable=False)
    file_key: Mapped[str] = mapped_column(String(255), nullable=False)
    file_name: Mapped[str] = mapped_column(String(255), nullable=False)
    content_type: Mapped[str] = mapped_column(String(128), nullable=False)
    size_bytes: Mapped[int | None] = mapped_column(Integer)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default='PRESIGNED')
    metadata_json: Mapped[dict | None] = mapped_column(JSON)
    committed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class CitizenRequest(Base):
    __tablename__ = 'citizen_requests'
    __table_args__ = (
        Index('ix_citizen_requests_status_created', 'status', 'created_at'),
        {'schema': 'citizen'},
    )

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    citizen_session_id: Mapped[str] = mapped_column(ForeignKey('citizen.citizen_sessions.id'), nullable=False)
    case_id: Mapped[str] = mapped_column(ForeignKey('local_center.cases.case_id'), nullable=False)
    request_type: Mapped[str] = mapped_column(String(64), nullable=False)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default='RECEIVED')
    payload_json: Mapped[dict | None] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    processed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
