from __future__ import annotations

from copy import deepcopy
from datetime import datetime, timezone
from enum import Enum
from threading import Lock
from typing import Any
from uuid import uuid4


class RunStatus(str, Enum):
    DATA_MISSING = "DATA_MISSING"
    QUEUED = "QUEUED"
    VALIDATING = "VALIDATING"
    RESIZE = "RESIZE"
    PREPROCESS = "PREPROCESS"
    INFERENCING = "INFERENCING"
    EXPLAINING = "EXPLAINING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"


STATUS_PROGRESS = {
    RunStatus.DATA_MISSING: 100,
    RunStatus.QUEUED: 0,
    RunStatus.VALIDATING: 10,
    RunStatus.RESIZE: 28,
    RunStatus.PREPROCESS: 48,
    RunStatus.INFERENCING: 68,
    RunStatus.EXPLAINING: 88,
    RunStatus.COMPLETED: 100,
    RunStatus.FAILED: 100,
}

FINAL_STATUSES = {
    RunStatus.DATA_MISSING,
    RunStatus.COMPLETED,
    RunStatus.FAILED,
}


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


class RunStore:
    """Simple in-memory run state store for demo usage."""

    def __init__(self) -> None:
        self._runs: dict[str, dict[str, Any]] = {}
        self._lock = Lock()

    def create_run(
        self,
        *,
        status: RunStatus,
        options: dict[str, Any] | None = None,
        step_artifacts: dict[str, Any] | None = None,
        error: str | None = None,
    ) -> str:
        run_id = str(uuid4())
        now = _utc_now_iso()

        payload = {
            "run_id": run_id,
            "status": status.value,
            "progress": STATUS_PROGRESS[status],
            "options": options or {},
            "step_artifacts": step_artifacts or {},
            "error": error,
            "created_at": now,
            "updated_at": now,
        }

        with self._lock:
            self._runs[run_id] = payload

        return run_id

    def update_run(
        self,
        run_id: str,
        *,
        status: RunStatus | None = None,
        progress: int | None = None,
        step_artifacts: dict[str, Any] | None = None,
        error: str | None = None,
    ) -> dict[str, Any]:
        with self._lock:
            if run_id not in self._runs:
                raise KeyError(f"Unknown run_id: {run_id}")

            current = self._runs[run_id]

            if status is not None:
                current["status"] = status.value
                current["progress"] = STATUS_PROGRESS[status] if progress is None else int(progress)
            elif progress is not None:
                current["progress"] = int(progress)

            if step_artifacts:
                current["step_artifacts"].update(step_artifacts)

            if error is not None:
                current["error"] = error

            current["updated_at"] = _utc_now_iso()
            return deepcopy(current)

    def get_run(self, run_id: str) -> dict[str, Any] | None:
        with self._lock:
            item = self._runs.get(run_id)
            return deepcopy(item) if item else None


run_store = RunStore()
