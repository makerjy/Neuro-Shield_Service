from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field


OutcomeType = Literal[
    'PROCEED',
    'LATER',
    'PROTECTOR_LINK',
    'COUNSELOR_LINK',
    'REJECT',
    'NO_RESPONSE',
    'HARD_TO_UNDERSTAND',
    'EMOTIONAL',
]

RejectReasonCode = Literal[
    'R1_SELF_REJECT',
    'R2_GUARDIAN_REJECT',
    'R3_OTHER_INSTITUTION',
    'R4_ALREADY_DIAGNOSED',
    'R5_CONTACT_INVALID',
    'R6_EMOTIONAL_BACKLASH',
    'R7_OTHER',
]

RecontactStrategy = Literal[
    'CALL_RETRY',
    'SMS_RETRY',
    'TIME_CHANGE',
    'PROTECTOR_CONTACT',
    'AGENT_SMS',
]


class OutcomeRejectFollowup(BaseModel):
    createFollowupEvent: bool | None = None
    followupAt: datetime | None = None


class OutcomeRejectPayload(BaseModel):
    code: RejectReasonCode | None = None
    level: Literal['TEMP', 'FINAL'] | None = None
    detail: str | None = None
    followup: OutcomeRejectFollowup | None = None


class OutcomeNoResponsePayload(BaseModel):
    strategy: RecontactStrategy | None = None
    nextContactAt: datetime | None = None
    escalateLevel: Literal['L0', 'L1', 'L2', 'L3'] | None = None
    channel: Literal['CALL', 'SMS'] | None = None
    assigneeId: str | None = None


class OutcomeSavePayload(BaseModel):
    outcomeType: OutcomeType
    memo: str | None = None
    reasonTags: list[str] | None = None
    reject: OutcomeRejectPayload | None = None
    noResponse: OutcomeNoResponsePayload | None = None


class CalendarEventDraft(BaseModel):
    caseId: str
    type: Literal['RECONTACT', 'FOLLOWUP']
    title: str
    startAt: datetime
    durationMin: int = 20
    priority: Literal['NORMAL', 'HIGH'] = 'NORMAL'
    payload: dict[str, Any] | None = None


class OutcomeSaveResponse(BaseModel):
    ok: Literal[True]
    outcomeId: str
    timelinePatch: dict[str, Any] | None = None
    nextAction: dict[str, Any] | None = None


class CalendarEventCreatePayload(BaseModel):
    idempotencyKey: str
    event: CalendarEventDraft


class CalendarEventCreateResponse(BaseModel):
    ok: Literal[True]
    eventId: str


class ExecuteActionBody(BaseModel):
    actionType: str
    payload: dict[str, Any] = Field(default_factory=dict)


class SupportRequestBody(BaseModel):
    reason: str
    requester: str


class Stage2ModelRunCreatePayload(BaseModel):
    caseId: str
    examResultId: str
    modelVersion: str = 's2-v1'
    score: float


class Stage3ModelRunCreatePayload(BaseModel):
    caseId: str
    modelVersion: str = 's3-v1'
    score: float


class WorkItemCreatePayload(BaseModel):
    caseId: str
    title: str
    type: str
    priority: Literal['P0', 'P1', 'P2'] = 'P2'
    status: str = 'OPEN'
    assigneeId: str | None = None
    dueAt: datetime | None = None
    payload: dict[str, Any] = Field(default_factory=dict)


class WorkItemPatchPayload(BaseModel):
    status: str | None = None
    priority: Literal['P0', 'P1', 'P2'] | None = None
    assigneeId: str | None = None
    dueAt: datetime | None = None
    payload: dict[str, Any] | None = None


class LocalCaseSummaryResponse(BaseModel):
    caseId: str
    stage: int
    status: str
    operationalStatus: str
    owner: str | None = None
    alertLevel: str | None = None
    priorityTier: str
    nextActionAt: str | None = None


class LocalCasesListResponse(BaseModel):
    total: int
    page: int
    size: int
    items: list[LocalCaseSummaryResponse]


class LocalDashboardKpiResponse(BaseModel):
    stage1Open: int
    stage2PendingExam: int
    stage3Tracking: int
    overdueSchedules: int
    openWorkItems: int
    churnRiskHigh: int


class AuditLogResponse(BaseModel):
    id: int
    caseId: str
    at: str
    actor: dict[str, str]
    action: str
    message: str
    severity: str
    before: dict[str, Any] | None = None
    after: dict[str, Any] | None = None
