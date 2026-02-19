from __future__ import annotations

from datetime import date, datetime

from sqlalchemy import Date, DateTime, Index, Integer, JSON, Numeric, String, func
from sqlalchemy.orm import Mapped, mapped_column

from server_fastapi.app.db.base import Base


class FactContactDaily(Base):
    __tablename__ = 'fact_contact_daily'
    __table_args__ = (
        Index('ix_analytics_fact_contact_daily_d_org', 'd', 'org_unit_id'),
        {'schema': 'analytics'},
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    d: Mapped[date] = mapped_column(Date, nullable=False)
    org_unit_id: Mapped[str] = mapped_column(String(64), nullable=False)
    attempted_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    success_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    no_response_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)


class FactStageFlowDaily(Base):
    __tablename__ = 'fact_stage_flow_daily'
    __table_args__ = (
        Index('ix_analytics_fact_stage_flow_daily_d_org', 'd', 'org_unit_id'),
        {'schema': 'analytics'},
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    d: Mapped[date] = mapped_column(Date, nullable=False)
    org_unit_id: Mapped[str] = mapped_column(String(64), nullable=False)
    stage: Mapped[str] = mapped_column(String(8), nullable=False)
    entered_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    completed_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    blocked_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)


class FactExamDaily(Base):
    __tablename__ = 'fact_exam_daily'
    __table_args__ = (
        Index('ix_analytics_fact_exam_daily_d_org', 'd', 'org_unit_id'),
        {'schema': 'analytics'},
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    d: Mapped[date] = mapped_column(Date, nullable=False)
    org_unit_id: Mapped[str] = mapped_column(String(64), nullable=False)
    order_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    appointment_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    validated_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)


class FactModelRunDaily(Base):
    __tablename__ = 'fact_model_run_daily'
    __table_args__ = (
        Index('ix_analytics_fact_model_run_daily_d_org', 'd', 'org_unit_id'),
        {'schema': 'analytics'},
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    d: Mapped[date] = mapped_column(Date, nullable=False)
    org_unit_id: Mapped[str] = mapped_column(String(64), nullable=False)
    stage: Mapped[str] = mapped_column(String(8), nullable=False)
    run_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    avg_score: Mapped[float | None] = mapped_column(Numeric(6, 3))
    drift_score: Mapped[float | None] = mapped_column(Numeric(6, 3))


class FactWorkitemDaily(Base):
    __tablename__ = 'fact_workitem_daily'
    __table_args__ = (
        Index('ix_analytics_fact_workitem_daily_d_org', 'd', 'org_unit_id'),
        {'schema': 'analytics'},
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    d: Mapped[date] = mapped_column(Date, nullable=False)
    org_unit_id: Mapped[str] = mapped_column(String(64), nullable=False)
    created_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    completed_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    overdue_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)


class KpiSnapshot(Base):
    __tablename__ = 'kpi_snapshots'
    __table_args__ = (
        Index('ix_analytics_kpi_snapshots_d_scope_kpi', 'd', 'scope_level', 'scope_id', 'kpi_id'),
        {'schema': 'analytics'},
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    d: Mapped[date] = mapped_column(Date, nullable=False)
    scope_level: Mapped[str] = mapped_column(String(16), nullable=False)
    scope_id: Mapped[str] = mapped_column(String(64), nullable=False)
    kpi_id: Mapped[str] = mapped_column(String(64), nullable=False)
    value: Mapped[float] = mapped_column(Numeric(8, 3), nullable=False)
    numerator: Mapped[float] = mapped_column(Numeric(12, 3), nullable=False)
    denominator: Mapped[float] = mapped_column(Numeric(12, 3), nullable=False)
    delta7d: Mapped[float] = mapped_column(Numeric(8, 3), nullable=False)
    auxiliary_json: Mapped[dict | None] = mapped_column(JSON)
    computed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    kpi_version: Mapped[str] = mapped_column(String(64), nullable=False, default='v1')
    policy_version: Mapped[str] = mapped_column(String(64), nullable=False, default='v1')
    data_window_json: Mapped[dict] = mapped_column(JSON, nullable=False)
