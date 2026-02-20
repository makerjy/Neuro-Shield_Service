from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


class SessionResolveResponse(BaseModel):
    sessionId: str
    caseId: str
    caseKey: str
    status: str
    otpVerified: bool
    readOnly: bool
    expiresAt: str
    centerId: str | None = None


class OtpRequestBody(BaseModel):
    sessionId: str
    phoneNumber: str


class OtpVerifyBody(BaseModel):
    sessionId: str
    otpCode: str
    phoneNumber: str


class ConsentItem(BaseModel):
    templateId: str | None = None
    consentType: str | None = None
    agreed: bool
    extra: dict[str, Any] | None = None


class ConsentSubmitBody(BaseModel):
    sessionId: str
    consents: list[ConsentItem]


class ProfileSubmitBody(BaseModel):
    sessionId: str
    profile: dict[str, Any]


class AppointmentBookBody(BaseModel):
    sessionId: str
    appointmentAt: datetime
    organization: str | None = None


class AppointmentChangeBody(BaseModel):
    sessionId: str
    appointmentAt: datetime


class AppointmentCancelBody(BaseModel):
    sessionId: str
    reason: str | None = None


class QuestionnaireSubmitBody(BaseModel):
    sessionId: str
    responses: dict[str, Any] = Field(default_factory=dict)


class UploadPresignBody(BaseModel):
    sessionId: str
    fileName: str
    contentType: str
    sizeBytes: int | None = None


class UploadCommitBody(BaseModel):
    sessionId: str
    uploadId: str
    metadata: dict[str, Any] | None = None


class CitizenStatusQuery(BaseModel):
    sessionId: str
