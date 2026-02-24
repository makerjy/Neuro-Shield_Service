from __future__ import annotations

from enum import Enum
from typing import Any, Dict, List, Literal

from pydantic import BaseModel, Field


class RunStatus(str, Enum):
    DATA_MISSING = "DATA_MISSING"
    QUEUED = "QUEUED"
    VALIDATING = "VALIDATING"
    IMPUTING = "IMPUTING"
    ENGINEERING = "ENGINEERING"
    SCALING = "SCALING"
    SPLITTING = "SPLITTING"
    INFERENCING = "INFERENCING"
    EXPLAINING = "EXPLAINING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"


class RunOptions(BaseModel):
    allow_missing_demo: bool = Field(default=False)
    target_class: Literal["pred", "MCI_High"] = Field(default="pred")
    mmse_direction: Literal["down", "up"] = Field(default="down")


class RunRequest(BaseModel):
    values: Dict[str, Any] = Field(default_factory=dict)
    options: RunOptions = Field(default_factory=RunOptions)


class RunCreated(BaseModel):
    run_id: str


class SampleItem(BaseModel):
    id: str
    subject_id: str | None
    DIAGNOSIS: str | None
    label: int | None
    risk_label: int
    risk_name: str
    brief_features: Dict[str, Any]


class SamplesResponse(BaseModel):
    samples: List[SampleItem]


class RunResponse(BaseModel):
    run_id: str
    status: RunStatus
    progress: int
    step_artifacts: Dict[str, Any]
    error: str | None = None
