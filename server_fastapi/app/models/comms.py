from __future__ import annotations

from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Index, Integer, JSON, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from server_fastapi.app.db.base import Base


class MessageTemplate(Base):
    __tablename__ = 'message_templates'
    __table_args__ = {'schema': 'comms'}

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    channel: Mapped[str] = mapped_column(String(16), nullable=False, default='SMS')
    body_template: Mapped[str] = mapped_column(Text, nullable=False)
    active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class MessageOutbox(Base):
    __tablename__ = 'message_outbox'
    __table_args__ = (
        Index('ix_comms_outbox_status_due', 'status', 'next_retry_at'),
        {'schema': 'comms'},
    )

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    case_id: Mapped[str | None] = mapped_column(ForeignKey('local_center.cases.case_id'))
    channel: Mapped[str] = mapped_column(String(16), nullable=False, default='SMS')
    template_id: Mapped[str | None] = mapped_column(ForeignKey('comms.message_templates.id'))
    to_hash: Mapped[str] = mapped_column(String(128), nullable=False)
    payload_json: Mapped[dict | None] = mapped_column(JSON)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default='PENDING')
    retry_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    next_retry_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    last_error: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class MessageEvent(Base):
    __tablename__ = 'message_events'
    __table_args__ = (
        Index('ix_comms_events_outbox_created', 'outbox_id', 'created_at'),
        {'schema': 'comms'},
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    outbox_id: Mapped[str] = mapped_column(ForeignKey('comms.message_outbox.id'), nullable=False)
    event_type: Mapped[str] = mapped_column(String(64), nullable=False)
    payload_json: Mapped[dict | None] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
