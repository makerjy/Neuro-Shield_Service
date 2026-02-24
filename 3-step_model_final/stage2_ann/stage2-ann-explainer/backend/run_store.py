from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from threading import Lock
from typing import Any, Dict

from schemas import RunStatus


@dataclass
class RunRecord:
    run_id: str
    status: RunStatus
    progress: int
    step_artifacts: Dict[str, Any] = field(default_factory=dict)
    error: str | None = None
    created_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    updated_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class RunStore:
    def __init__(self) -> None:
        self._runs: Dict[str, RunRecord] = {}
        self._lock = Lock()

    def create(self, run_id: str, status: RunStatus = RunStatus.QUEUED, progress: int = 0) -> RunRecord:
        with self._lock:
            rec = RunRecord(run_id=run_id, status=status, progress=progress)
            self._runs[run_id] = rec
            return rec

    def update(
        self,
        run_id: str,
        *,
        status: RunStatus | None = None,
        progress: int | None = None,
        artifacts: Dict[str, Any] | None = None,
        error: str | None = None,
    ) -> None:
        with self._lock:
            rec = self._runs.get(run_id)
            if rec is None:
                return
            if status is not None:
                rec.status = status
            if progress is not None:
                rec.progress = int(progress)
            if artifacts:
                rec.step_artifacts.update(artifacts)
            if error is not None:
                rec.error = error
            rec.updated_at = datetime.now(timezone.utc).isoformat()

    def get(self, run_id: str) -> Dict[str, Any] | None:
        with self._lock:
            rec = self._runs.get(run_id)
            if rec is None:
                return None
            return {
                "run_id": rec.run_id,
                "status": rec.status,
                "progress": rec.progress,
                "step_artifacts": rec.step_artifacts,
                "error": rec.error,
                "created_at": rec.created_at,
                "updated_at": rec.updated_at,
            }
