from __future__ import annotations

from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Index, Integer, JSON, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from server_fastapi.app.db.base import Base


class OrgUnit(Base):
    __tablename__ = 'org_units'
    __table_args__ = {'schema': 'control'}

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    level: Mapped[str] = mapped_column(String(16), nullable=False)
    parent_id: Mapped[str | None] = mapped_column(ForeignKey('control.org_units.id'), nullable=True)
    region_path: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class User(Base):
    __tablename__ = 'users'
    __table_args__ = {'schema': 'control'}

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    org_unit_id: Mapped[str | None] = mapped_column(ForeignKey('control.org_units.id'))
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    display_name: Mapped[str] = mapped_column(String(255), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class Role(Base):
    __tablename__ = 'roles'
    __table_args__ = {'schema': 'control'}

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    name: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    description: Mapped[str | None] = mapped_column(Text)


class Permission(Base):
    __tablename__ = 'permissions'
    __table_args__ = {'schema': 'control'}

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    name: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    description: Mapped[str | None] = mapped_column(Text)


class RolePermission(Base):
    __tablename__ = 'role_permissions'
    __table_args__ = (
        UniqueConstraint('role_id', 'permission_id', name='uq_role_permission'),
        {'schema': 'control'},
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    role_id: Mapped[str] = mapped_column(ForeignKey('control.roles.id'), nullable=False)
    permission_id: Mapped[str] = mapped_column(ForeignKey('control.permissions.id'), nullable=False)


class KpiDefinition(Base):
    __tablename__ = 'kpi_definitions'
    __table_args__ = {'schema': 'control'}

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    formula_json: Mapped[dict] = mapped_column(JSON, nullable=False)
    threshold_json: Mapped[dict] = mapped_column(JSON, nullable=False)
    scope_rules_json: Mapped[dict] = mapped_column(JSON, nullable=False)
    version: Mapped[str] = mapped_column(String(64), default='v1', nullable=False)
    active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class PolicyRule(Base):
    __tablename__ = 'policy_rules'
    __table_args__ = {'schema': 'control'}

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    stage: Mapped[str] = mapped_column(String(16), nullable=False)
    status: Mapped[str] = mapped_column(String(32), nullable=False)
    rule_json: Mapped[dict] = mapped_column(JSON, nullable=False)
    version: Mapped[str] = mapped_column(String(64), nullable=False)
    deployed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    deployed_by: Mapped[str | None] = mapped_column(String(128))


class ModelRegistry(Base):
    __tablename__ = 'model_registry'
    __table_args__ = {'schema': 'control'}

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    model_name: Mapped[str] = mapped_column(String(255), nullable=False)
    stage: Mapped[str] = mapped_column(String(16), nullable=False)
    version: Mapped[str] = mapped_column(String(64), nullable=False)
    status: Mapped[str] = mapped_column(String(32), nullable=False)
    metrics_json: Mapped[dict | None] = mapped_column(JSON)
    deployed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class Intervention(Base):
    __tablename__ = 'interventions'
    __table_args__ = (
        Index('ix_control_interventions_status_due_at', 'status', 'due_at'),
        {'schema': 'control'},
    )

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default='OPEN')
    priority: Mapped[str] = mapped_column(String(16), nullable=False, default='MEDIUM')
    basis_type: Mapped[str] = mapped_column(String(16), nullable=False)
    basis_ref: Mapped[str] = mapped_column(String(255), nullable=False)
    due_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_by: Mapped[str] = mapped_column(String(128), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class InterventionTarget(Base):
    __tablename__ = 'intervention_targets'
    __table_args__ = (
        Index('ix_control_intervention_targets_target_org', 'target_org_unit_id'),
        {'schema': 'control'},
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    intervention_id: Mapped[str] = mapped_column(ForeignKey('control.interventions.id'), nullable=False)
    target_org_unit_id: Mapped[str] = mapped_column(ForeignKey('control.org_units.id'), nullable=False)
    target_level: Mapped[str] = mapped_column(String(16), nullable=False)


class InterventionAction(Base):
    __tablename__ = 'intervention_actions'
    __table_args__ = {'schema': 'control'}

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    intervention_id: Mapped[str] = mapped_column(ForeignKey('control.interventions.id'), nullable=False)
    action_type: Mapped[str] = mapped_column(String(64), nullable=False)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default='PENDING')
    due_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class InterventionEvidence(Base):
    __tablename__ = 'intervention_evidence'
    __table_args__ = {'schema': 'control'}

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    intervention_id: Mapped[str] = mapped_column(ForeignKey('control.interventions.id'), nullable=False)
    action_id: Mapped[str | None] = mapped_column(ForeignKey('control.intervention_actions.id'))
    s3_key: Mapped[str] = mapped_column(String(512), nullable=False)
    file_name: Mapped[str] = mapped_column(String(255), nullable=False)
    uploaded_by: Mapped[str] = mapped_column(String(128), nullable=False)
    uploaded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class AuditEvent(Base):
    __tablename__ = 'audit_events'
    __table_args__ = (
        Index('ix_control_audit_events_entity_ts', 'entity_type', 'entity_id', 'ts'),
        {'schema': 'control'},
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    ts: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    actor_id: Mapped[str] = mapped_column(String(128), nullable=False)
    actor_role: Mapped[str] = mapped_column(String(128), nullable=False)
    action: Mapped[str] = mapped_column(String(128), nullable=False)
    entity_type: Mapped[str] = mapped_column(String(64), nullable=False)
    entity_id: Mapped[str] = mapped_column(String(128), nullable=False)
    severity: Mapped[str] = mapped_column(String(16), nullable=False, default='medium')
    status: Mapped[str] = mapped_column(String(16), nullable=False, default='pending')
    before_json: Mapped[dict | None] = mapped_column(JSON)
    after_json: Mapped[dict | None] = mapped_column(JSON)
    basis_ref: Mapped[str | None] = mapped_column(String(255))
    description: Mapped[str | None] = mapped_column(Text)
