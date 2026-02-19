from __future__ import annotations

from datetime import datetime

from sqlalchemy import DateTime, Index, Integer, JSON, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from server_fastapi.app.db.base import Base


class EventRaw(Base):
    __tablename__ = 'events_raw'
    __table_args__ = (
        Index('ix_ingestion_events_raw_event_ts_org_event_type', 'event_ts', 'org_unit_id', 'event_type'),
        {'schema': 'ingestion'},
    )

    event_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    event_ts: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    org_unit_id: Mapped[str] = mapped_column(String(64), nullable=False)
    level: Mapped[str] = mapped_column(String(16), nullable=False)
    system: Mapped[str] = mapped_column(String(64), nullable=False)
    version: Mapped[str] = mapped_column(String(64), nullable=False)
    region_path: Mapped[dict] = mapped_column(JSON, nullable=False)
    case_key: Mapped[str] = mapped_column(String(128), nullable=False)
    stage: Mapped[str] = mapped_column(String(8), nullable=False)
    event_type: Mapped[str] = mapped_column(String(64), nullable=False)
    payload: Mapped[dict] = mapped_column(JSON, nullable=False)
    policy_version: Mapped[str | None] = mapped_column(String(64))
    kpi_version: Mapped[str | None] = mapped_column(String(64))
    model_version: Mapped[str | None] = mapped_column(String(64))
    trace_id: Mapped[str | None] = mapped_column(String(128))
    received_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class EventDeadletter(Base):
    __tablename__ = 'events_deadletter'
    __table_args__ = {'schema': 'ingestion'}

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    event_id: Mapped[str | None] = mapped_column(String(64))
    reason: Mapped[str] = mapped_column(String(128), nullable=False)
    detail: Mapped[str | None] = mapped_column(Text)
    raw_event: Mapped[dict] = mapped_column(JSON, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
