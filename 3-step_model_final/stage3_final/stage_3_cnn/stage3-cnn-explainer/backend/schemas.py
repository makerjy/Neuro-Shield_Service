from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field

from run_store import RunStatus


class RunOptions(BaseModel):
    explain: bool = True
    occlusion: bool = False
    allow_cpu_only: bool = True


class RunCreateResponse(BaseModel):
    run_id: str


class RunStatusResponse(BaseModel):
    run_id: str
    status: RunStatus
    progress: int = Field(ge=0, le=100)
    step_artifacts: dict[str, Any]
    error: str | None = None


class MetaResponse(BaseModel):
    class_names: list[str]
    class_names_ui: list[str]
    input_size: list[int]
    required_inputs: list[str]
    pipeline_steps: list[str]
    model_info: dict[str, Any]


class SamplesResponse(BaseModel):
    samples: dict[str, list[dict[str, Any]]]
