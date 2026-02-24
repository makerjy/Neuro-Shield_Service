from __future__ import annotations

from enum import Enum
from typing import Any, Dict, List, Optional, Union

from pydantic import BaseModel, Field


class RunStatus(str, Enum):
    DATA_MISSING = "DATA_MISSING"
    QUEUED = "QUEUED"
    VALIDATING = "VALIDATING"
    CLIPPING = "CLIPPING"
    IMPUTING = "IMPUTING"
    SCALING = "SCALING"
    INFERENCING = "INFERENCING"
    EXPLAINING = "EXPLAINING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"


class RunOptions(BaseModel):
    allow_missing_demo: bool = False


class RunRequest(BaseModel):
    values: Dict[str, Optional[Union[float, int, str]]] = Field(default_factory=dict)
    options: RunOptions = Field(default_factory=RunOptions)


class RunCreateResponse(BaseModel):
    run_id: str


class MetaResponse(BaseModel):
    features: List[str]
    bounds: Dict[str, List[float]]
    default_values: Dict[str, Optional[Union[float, int]]]
    thresholds: Dict[str, float]
    required_fields: List[str]
    model_version: str


class RunPollResponse(BaseModel):
    run_id: str
    status: RunStatus
    progress: int
    step_states: Dict[str, str]
    step_artifacts: Dict[str, Any]
    missing_required: List[str] = Field(default_factory=list)
    result: Optional[Dict[str, Any]] = None
    error: Optional[str] = None


class DemoGenerateRequest(BaseModel):
    n: int = Field(default=100, ge=1, le=10000)
    mix: Dict[str, int] = Field(default_factory=lambda: {"CN": 40, "MCI": 35, "DM": 25})
    seed: int = 42
    include_clipping_cases_ratio: float = Field(default=0.10, ge=0.0, le=1.0)
    include_missing_ratio: float = Field(default=0.0, ge=0.0, le=1.0)
    max_attempts: int = Field(default=5000, ge=100, le=100000)


class DemoGenerateSummary(BaseModel):
    n: int
    bucket_counts: Dict[str, int]
    prob_min: float
    prob_max: float
    prob_mean: float
    mci_mean: float
    priority_counts: Dict[str, int]
    requested_mix: Dict[str, int]
    seed: int
    attempts: int
    actual_clipping_cases: int
    warnings: List[str] = Field(default_factory=list)


class DemoGenerateResponse(BaseModel):
    status: str
    path: str
    download_url: str
    summary: DemoGenerateSummary
