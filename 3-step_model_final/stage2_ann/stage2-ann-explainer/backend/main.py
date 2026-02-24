from __future__ import annotations

import os
import random
import re
import time
import uuid
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List

import numpy as np
import pandas as pd
from fastapi import BackgroundTasks, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from engine_loader import ModelLoadError, get_model_branch_dims, load_stage2_model
from explainers import Stage2Explainer
from preprocess import Stage2Preprocessor
from run_store import RunStore
from schemas import RunCreated, RunRequest, RunStatus

BASE_DIR = Path(__file__).resolve().parent
ASSET_DIR = BASE_DIR / "assets"
EXPORT_DIR = BASE_DIR / "exports"
DEFAULT_MODEL_DIR = BASE_DIR.parents[2] / "stage2_modelfinal"
MODEL_DIR = Path(os.getenv("STAGE2_MODEL_DIR", str(DEFAULT_MODEL_DIR)))
MODEL_GLOB = "best_stage2_binary_ann_seed*.keras"
CSV_PATH = ASSET_DIR / "ADNI3_Golden_Master_Longitudinal.csv"
SCALER_PATH = ASSET_DIR / "stage2_scaler_v4.pkl"

app = FastAPI(title="Stage2 ANN Explainer API", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

run_store = RunStore()
preprocessor: Stage2Preprocessor | None = None
models: List[Any] = []
explainer: Stage2Explainer | None = None
model_branch_dims: Dict[str, int] = {}
model_version = "stage2_modelfinal_binary_ensemble"


class BatchScoreRequest(BaseModel):
    sample_ids: List[str] | None = None
    limit: int = Field(default=50, ge=1, le=5000)


def _step_delay() -> None:
    time.sleep(random.uniform(0.4, 0.8))


def _set_status(run_id: str, status: RunStatus, progress: int, artifacts: Dict[str, Any] | None = None) -> None:
    run_store.update(run_id, status=status, progress=progress, artifacts=artifacts)


def _seed_sort_key(path: Path) -> int:
    m = re.search(r"seed(\d+)", path.stem)
    if m:
        return int(m.group(1))
    return 10**9


def _resolve_model_paths() -> List[Path]:
    paths = sorted(MODEL_DIR.glob(MODEL_GLOB), key=_seed_sort_key)
    if not paths:
        raise RuntimeError(f"model_files_not_found: dir={MODEL_DIR}, pattern={MODEL_GLOB}")
    return paths


@app.on_event("startup")
def startup() -> None:
    global preprocessor, models, explainer, model_branch_dims, model_version

    EXPORT_DIR.mkdir(parents=True, exist_ok=True)

    preprocessor = Stage2Preprocessor(str(CSV_PATH), str(SCALER_PATH))

    model_paths = _resolve_model_paths()
    loaded_models = []
    for path in model_paths:
        try:
            loaded_models.append(load_stage2_model(str(path)))
        except ModelLoadError as exc:
            raise RuntimeError(str(exc)) from exc

    models = loaded_models
    model_branch_dims = get_model_branch_dims(models[0])
    expected_dims = {
        "health": len(preprocessor.health_cols),
        "cognitive": len(preprocessor.cog_cols),
        "bio": len(preprocessor.bio_cols),
        "engineering": len(preprocessor.eng_feats),
    }
    if model_branch_dims != expected_dims:
        raise RuntimeError(
            f"dimension_mismatch: model={model_branch_dims}, preprocess={expected_dims}"
        )

    model_version = f"stage2_modelfinal_binary_ensemble_{len(model_paths)}"
    explainer = Stage2Explainer(models, preprocessor)


@app.get("/api/meta")
def get_meta() -> Dict[str, Any]:
    if preprocessor is None:
        raise HTTPException(status_code=500, detail="engine_not_ready")
    return preprocessor.meta(model_branch_dims=model_branch_dims, model_version=model_version)


@app.get("/api/samples")
def get_samples() -> Dict[str, Any]:
    if preprocessor is None:
        raise HTTPException(status_code=500, detail="engine_not_ready")
    return {"samples": preprocessor.samples}


@app.get("/api/sample/{sample_id}")
def get_sample(sample_id: str) -> Dict[str, Any]:
    if preprocessor is None:
        raise HTTPException(status_code=500, detail="engine_not_ready")

    payload = preprocessor.get_sample_values(sample_id)
    if payload is None:
        raise HTTPException(status_code=404, detail="sample_not_found")
    return payload


def _execute_run(run_id: str, req: RunRequest) -> None:
    assert preprocessor is not None
    assert explainer is not None

    try:
        _set_status(run_id, RunStatus.VALIDATING, 10)
        parsed = preprocessor.parse_input_values(req.values)
        missing_required = preprocessor.find_missing_required(parsed)
        run_store.update(run_id, artifacts={"missing_required": missing_required})
        _step_delay()

        if missing_required and not req.options.allow_missing_demo:
            _set_status(run_id, RunStatus.DATA_MISSING, 100)
            return

        _set_status(run_id, RunStatus.IMPUTING, 24)
        filled, imputed_map = preprocessor.impute_values(parsed)
        run_store.update(run_id, artifacts={"imputed_map": imputed_map})
        _step_delay()

        _set_status(run_id, RunStatus.ENGINEERING, 40)
        merged, engineered, row = preprocessor.assemble_vector(filled)
        run_store.update(
            run_id,
            artifacts={
                "engineered_values": engineered,
                "formulas": preprocessor.ENGINEERING_FORMULAS,
            },
        )
        _step_delay()

        _set_status(run_id, RunStatus.SCALING, 56)
        scaled, scaled_preview, scaled_stats = preprocessor.scale_row(row)
        run_store.update(
            run_id,
            artifacts={
                "scaled_preview": scaled_preview,
                "scaled_stats": scaled_stats,
            },
        )
        _step_delay()

        _set_status(run_id, RunStatus.SPLITTING, 68)
        split_inputs, split_dims = preprocessor.split_scaled(scaled)
        run_store.update(run_id, artifacts={"split_dims": split_dims})
        _step_delay()

        _set_status(run_id, RunStatus.INFERENCING, 82)
        probs = explainer.predict_probs(split_inputs)
        p_ad_ensemble = explainer.predict_ad_prob(split_inputs)
        probs_map = {
            preprocessor.LABEL_NAMES[i]: float(p) for i, p in enumerate(probs)
        }
        pred_idx = int(np.argmax(probs))
        pred_label = preprocessor.LABEL_NAMES[pred_idx]
        confidence = float(np.max(probs))
        bucket = preprocessor.to_operational_bucket(pred_idx)
        stage3_eligible = pred_idx in (3, 4) or p_ad_ensemble >= 0.65

        run_store.update(
            run_id,
            artifacts={
                "probs": probs_map,
                "p_ad_ensemble": float(p_ad_ensemble),
                "predicted_label": pred_label,
                "confidence": confidence,
                "operational_bucket": bucket,
                "stage3_eligible": stage3_eligible,
                "prob_sum": float(sum(probs)),
                "input_filled": filled,
                "input_engineered_full": merged,
            },
        )
        _step_delay()

        _set_status(run_id, RunStatus.EXPLAINING, 93)
        local = explainer.local_sensitivity(
            filled_values=filled,
            target_mode=req.options.target_class,
            mmse_direction=req.options.mmse_direction,
            base_probs=probs,
            predicted_idx=pred_idx,
        )
        branch = explainer.branch_summary(split_inputs)

        artifacts: Dict[str, Any] = {
            "local_sensitivity_top10": local["top10"],
            "local_sensitivity_all": local["all"],
            "local_sensitivity_note": local["method_note"],
            "local_sensitivity_target": local["target_class"],
        }
        if branch is not None:
            artifacts["branch_summary"] = branch["summary"]
            artifacts["branch_note"] = branch["note"]
            artifacts["branch_missing_layers"] = branch["missing_layers"]

        run_store.update(run_id, artifacts=artifacts)
        _step_delay()

        _set_status(run_id, RunStatus.COMPLETED, 100)

    except Exception as exc:  # noqa: BLE001
        run_store.update(run_id, status=RunStatus.FAILED, progress=100, error=str(exc))


@app.post("/api/run", response_model=RunCreated)
def create_run(req: RunRequest, background_tasks: BackgroundTasks) -> RunCreated:
    if preprocessor is None:
        raise HTTPException(status_code=500, detail="engine_not_ready")

    run_id = str(uuid.uuid4())
    run_store.create(run_id=run_id, status=RunStatus.QUEUED, progress=1)

    try:
        parsed = preprocessor.parse_input_values(req.values)
    except ValueError as exc:
        run_store.update(run_id, status=RunStatus.FAILED, progress=100, error=str(exc))
        return RunCreated(run_id=run_id)

    missing_required = preprocessor.find_missing_required(parsed)
    run_store.update(
        run_id,
        artifacts={
            "input_raw": req.values,
            "missing_required": missing_required,
        },
    )

    if missing_required and not req.options.allow_missing_demo:
        run_store.update(run_id, status=RunStatus.DATA_MISSING, progress=100)
        return RunCreated(run_id=run_id)

    background_tasks.add_task(_execute_run, run_id, req)
    return RunCreated(run_id=run_id)


@app.get("/api/run/{run_id}")
def get_run(run_id: str) -> Dict[str, Any]:
    data = run_store.get(run_id)
    if data is None:
        raise HTTPException(status_code=404, detail="run_not_found")
    return data


@app.post("/api/batch/score")
def batch_score(req: BatchScoreRequest) -> Dict[str, Any]:
    if preprocessor is None or explainer is None:
        raise HTTPException(status_code=500, detail="engine_not_ready")

    rows: List[Dict[str, Any]] = []
    samples = preprocessor.samples

    if req.sample_ids:
        sample_ids = req.sample_ids
    else:
        sample_ids = [s["id"] for s in samples[: req.limit]]

    for sid in sample_ids:
        payload = preprocessor.get_sample_values(sid)
        if payload is None:
            continue
        parsed = preprocessor.parse_input_values(payload["values"])
        filled, _ = preprocessor.impute_values(parsed)
        _, _, row = preprocessor.assemble_vector(filled)
        scaled, _, _ = preprocessor.scale_row(row)
        split_inputs, _ = preprocessor.split_scaled(scaled)
        probs = explainer.predict_probs(split_inputs)
        pred_idx = int(np.argmax(probs))

        out = {
            "sample_id": sid,
            "subject_id": payload.get("subject_id"),
            "predicted_label": preprocessor.LABEL_NAMES[pred_idx],
            "confidence": float(np.max(probs)),
        }
        for i, p in enumerate(probs):
            out[f"prob_{preprocessor.LABEL_NAMES[i]}"] = float(p)
        rows.append(out)

    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    export_path = EXPORT_DIR / f"batch_score_{ts}.csv"
    pd.DataFrame(rows).to_csv(export_path, index=False)

    return {
        "rows": len(rows),
        "export_file": str(export_path),
    }


@app.get("/health")
def health() -> Dict[str, str]:
    return {"status": "ok"}
