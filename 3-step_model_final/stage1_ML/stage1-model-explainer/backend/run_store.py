from __future__ import annotations

from copy import deepcopy
from datetime import datetime, timezone
from threading import Lock
from typing import Any, Dict, List, Optional
from uuid import uuid4

from schemas import RunStatus


PIPELINE_STEPS: List[str] = [
    "VALIDATING",
    "ORDERING",
    "CLIPPING",
    "IMPUTING",
    "SCALING",
    "INFERENCING",
    "EXPLAINING",
]


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


class RunStore:
    def __init__(self) -> None:
        self._runs: Dict[str, Dict[str, Any]] = {}
        self._lock = Lock()

    def create_run(
        self,
        values: Dict[str, Any],
        options: Dict[str, Any],
        status: RunStatus = RunStatus.QUEUED,
        missing_required: Optional[List[str]] = None,
    ) -> str:
        run_id = str(uuid4())
        step_states = {step: "pending" for step in PIPELINE_STEPS}
        if status == RunStatus.DATA_MISSING:
            step_states["VALIDATING"] = "failed"

        record: Dict[str, Any] = {
            "run_id": run_id,
            "status": status,
            "progress": 0,
            "created_at": now_iso(),
            "updated_at": now_iso(),
            "options": deepcopy(options),
            "missing_required": missing_required or [],
            "error": None,
            "step_states": step_states,
            "step_artifacts": {
                "input_raw": deepcopy(values),
                "input_ordered": {},
                "clipping_delta": {},
                "imputed_values": {},
                "scaled_values": {},
                "model_breakdown": {},
                "local_sensitivity": {},
            },
            "result": None,
        }

        with self._lock:
            self._runs[run_id] = record
        return run_id

    def get_run(self, run_id: str) -> Optional[Dict[str, Any]]:
        with self._lock:
            run = self._runs.get(run_id)
            if run is None:
                return None
            return deepcopy(run)

    def set_status(self, run_id: str, status: RunStatus) -> None:
        with self._lock:
            self._ensure_exists(run_id)
            run = self._runs[run_id]
            run["status"] = status
            run["updated_at"] = now_iso()
            run["progress"] = self._calc_progress(run)

    def set_missing_required(self, run_id: str, missing_required: List[str]) -> None:
        with self._lock:
            self._ensure_exists(run_id)
            run = self._runs[run_id]
            run["missing_required"] = missing_required
            run["updated_at"] = now_iso()

    def set_step_state(self, run_id: str, step: str, state: str) -> None:
        with self._lock:
            self._ensure_exists(run_id)
            run = self._runs[run_id]
            if step in run["step_states"]:
                run["step_states"][step] = state
            run["updated_at"] = now_iso()
            run["progress"] = self._calc_progress(run)

    def update_artifact(self, run_id: str, key: str, payload: Any) -> None:
        with self._lock:
            self._ensure_exists(run_id)
            run = self._runs[run_id]
            run["step_artifacts"][key] = deepcopy(payload)
            run["updated_at"] = now_iso()

    def set_result(self, run_id: str, result: Dict[str, Any]) -> None:
        with self._lock:
            self._ensure_exists(run_id)
            run = self._runs[run_id]
            run["result"] = deepcopy(result)
            run["updated_at"] = now_iso()
            run["progress"] = self._calc_progress(run)

    def set_error(self, run_id: str, message: str) -> None:
        with self._lock:
            self._ensure_exists(run_id)
            run = self._runs[run_id]
            run["error"] = message
            run["status"] = RunStatus.FAILED
            run["updated_at"] = now_iso()
            run["progress"] = self._calc_progress(run)

    def _ensure_exists(self, run_id: str) -> None:
        if run_id not in self._runs:
            raise KeyError(f"Unknown run_id: {run_id}")

    @staticmethod
    def _calc_progress(run: Dict[str, Any]) -> int:
        status = run["status"]
        if status == RunStatus.DATA_MISSING:
            return 0
        if status == RunStatus.COMPLETED:
            return 100
        completed_steps = sum(1 for state in run["step_states"].values() if state == "completed")
        total_steps = max(len(PIPELINE_STEPS), 1)
        base = int((completed_steps / total_steps) * 100)
        if status == RunStatus.FAILED:
            return max(base, 1)
        return max(base, 1 if status != RunStatus.QUEUED else 0)


run_store = RunStore()
