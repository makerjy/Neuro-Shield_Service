from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


class CitizenInviteBody(BaseModel):
    centerId: str
    citizenPhone: str


class ExamResultValidateBody(BaseModel):
    status: str = 'valid'


class LocalContactCreateBody(BaseModel):
    caseId: str
    channel: str = 'CALL'
    templateId: str | None = None
    payload: dict[str, Any] = Field(default_factory=dict)


class LocalContactResultBody(BaseModel):
    outcomeType: str
    detail: str | None = None
    strategy: str | None = None
    nextContactAt: datetime | None = None
    assigneeId: str | None = None
    payload: dict[str, Any] = Field(default_factory=dict)


class LocalScheduleCreateBody(BaseModel):
    caseId: str
    eventType: str = 'FOLLOWUP'
    title: str
    startAt: datetime
    durationMin: int = 20
    priority: str = 'NORMAL'
    idempotencyKey: str | None = None
    payload: dict[str, Any] = Field(default_factory=dict)
