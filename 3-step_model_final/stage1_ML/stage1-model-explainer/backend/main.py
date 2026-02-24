from __future__ import annotations

import asyncio
import random
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import numpy as np
import pandas as pd
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

from demo_generator import EXPORT_FILENAME, generate_scored_dataset
from engine_loader import (
    EngineLoadError,
    REQUIRED_FIELDS,
    THRESHOLDS,
    build_default_values,
    get_model_version,
    load_engine,
    normalize_bounds,
)
from run_store import PIPELINE_STEPS, run_store
from schemas import (
    DemoGenerateRequest,
    DemoGenerateResponse,
    DemoGenerateSummary,
    MetaResponse,
    RunCreateResponse,
    RunPollResponse,
    RunRequest,
    RunStatus,
)

APP_NAME = "Stage1 ML Model Explainer API"
DEMO_DELAY_RANGE = (0.4, 0.8)
BACKEND_DIR = Path(__file__).resolve().parent
EXPORTS_DIR = BACKEND_DIR / "exports"
EXPORTS_DIR.mkdir(parents=True, exist_ok=True)

app = FastAPI(title=APP_NAME, version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

ENGINE: Optional[Dict[str, Any]] = None
ENGINE_ERROR: Optional[str] = None


try:
    ENGINE = load_engine()
except EngineLoadError as exc:
    ENGINE_ERROR = str(exc)


def _require_engine() -> Dict[str, Any]:
    if ENGINE is None:
        raise HTTPException(
            status_code=503,
            detail={
                "message": "Model engine is not available.",
                "error": ENGINE_ERROR or "Unknown engine load error.",
            },
        )
    return ENGINE


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _to_number(value: Any) -> Optional[float]:
    if value is None:
        return None
    if isinstance(value, str):
        stripped = value.strip()
        if stripped == "":
            return None
        try:
            return float(stripped)
        except ValueError:
            return None
    if isinstance(value, (int, float, np.integer, np.floating)):
        if np.isnan(value):
            return None
        return float(value)
    return None


def _normalize_values(raw_values: Dict[str, Any], features: List[str]) -> Dict[str, Optional[float]]:
    values = dict(raw_values)

    if "PTGENDER_num" not in values and "gender" in values:
        gender_raw = values.get("gender")
        gender_num: Optional[float] = None
        if isinstance(gender_raw, str):
            token = gender_raw.strip().lower()
            if token in {"male", "m", "1"}:
                gender_num = 1.0
            elif token in {"female", "f", "2"}:
                gender_num = 2.0
        else:
            gender_num = _to_number(gender_raw)

        values["PTGENDER_num"] = gender_num

    normalized: Dict[str, Optional[float]] = {}
    for feature in features:
        normalized[feature] = _to_number(values.get(feature))
    return normalized


def _missing_required(values: Dict[str, Optional[float]]) -> List[str]:
    return [feature for feature in REQUIRED_FIELDS if values.get(feature) is None]


def _safe_round(value: Optional[float], ndigits: int = 6) -> Optional[float]:
    if value is None:
        return None
    return round(float(value), ndigits)


def _risk_label(probability: float) -> str:
    if probability >= THRESHOLDS["high"]:
        return "High Risk"
    if probability >= THRESHOLDS["low"]:
        return "Borderline"
    return "Normal"


def _extract_estimator_probabilities(model: Any, X_sc: np.ndarray) -> Tuple[Dict[str, float], Optional[List[float]]]:
    probs: Dict[str, float] = {}

    named_estimators = getattr(model, "named_estimators_", None)
    if isinstance(named_estimators, dict) and named_estimators:
        for name, estimator in named_estimators.items():
            if hasattr(estimator, "predict_proba"):
                probs[name] = float(estimator.predict_proba(X_sc)[0, 1])
    else:
        estimators = getattr(model, "estimators_", [])
        for idx, estimator in enumerate(estimators):
            if hasattr(estimator, "predict_proba"):
                probs[f"estimator_{idx}"] = float(estimator.predict_proba(X_sc)[0, 1])

    weights_raw = getattr(model, "weights", None)
    weights: Optional[List[float]] = None
    if weights_raw is not None:
        try:
            weights = [float(w) for w in weights_raw]
        except Exception:  # noqa: BLE001
            weights = None

    return probs, weights


def _pick_estimator_prob(estimator_probs: Dict[str, float], keywords: List[str]) -> Optional[float]:
    for name, probability in estimator_probs.items():
        lowered = name.lower()
        if any(keyword in lowered for keyword in keywords):
            return probability
    return None


def _delta_for_sensitivity(feature: str, bounds: Dict[str, Tuple[float, float]]) -> float:
    cist_features = {
        "CIST_ORIENT",
        "CIST_ATTENTION",
        "CIST_EXEC",
        "CIST_MEMORY",
        "CIST_LANGUAGE",
    }
    if feature in cist_features:
        return 1.0

    fixed = {
        "entry_age": 2.0,
        "PTEDUCAT": 1.0,
        "VSBPSYS": 5.0,
        "BMI": 1.0,
    }

    if feature in fixed:
        if feature in bounds:
            low, high = bounds[feature]
            span = max(high - low, 0.0)
            if span > 0:
                return min(fixed[feature], span * 0.05)
        return fixed[feature]

    if feature in bounds:
        low, high = bounds[feature]
        span = max(high - low, 0.0)
        if span > 0:
            return span * 0.02

    return 0.5


def _predict_probability(engine: Dict[str, Any], unscaled_vector: np.ndarray) -> float:
    X_sc = engine["scaler"].transform(np.array([unscaled_vector], dtype=float))
    return float(engine["model"].predict_proba(X_sc)[0, 1])


def _compute_local_sensitivity(
    engine: Dict[str, Any],
    feature_order: List[str],
    bounds: Dict[str, Tuple[float, float]],
    base_unscaled: np.ndarray,
    baseline_probability: float,
) -> Dict[str, Any]:
    rows: List[Dict[str, Any]] = []

    for idx, feature in enumerate(feature_order):
        x_alt = np.array(base_unscaled, dtype=float)
        delta = _delta_for_sensitivity(feature, bounds)
        original_value = float(x_alt[idx])
        perturbed_value = original_value + delta

        if feature in bounds:
            low, high = bounds[feature]
            perturbed_value = float(np.clip(perturbed_value, low, high))

        x_alt[idx] = perturbed_value
        p1 = _predict_probability(engine, x_alt)

        rows.append(
            {
                "feature": feature,
                "base_value": _safe_round(original_value),
                "perturbed_value": _safe_round(perturbed_value),
                "delta_applied": _safe_round(perturbed_value - original_value),
                "prob_delta": _safe_round(p1 - baseline_probability),
            }
        )

    rows.sort(key=lambda row: abs(row["prob_delta"] or 0.0), reverse=True)

    return {
        "baseline_proba": _safe_round(baseline_probability),
        "method_note": "Local sensitivity around current input. This is not causal attribution.",
        "features": rows,
    }


def _run_inference_pipeline(
    engine: Dict[str, Any],
    values: Dict[str, Optional[float]],
) -> Dict[str, Any]:
    feature_order = [str(col) for col in engine["features"]]
    bounds = normalize_bounds(engine["bounds"])

    raw_df = pd.DataFrame(
        [{feature: values.get(feature, None) for feature in feature_order}],
        columns=feature_order,
    )
    ordered_df = raw_df.reindex(columns=feature_order)
    ordered_df = ordered_df.apply(pd.to_numeric, errors="coerce")

    input_ordered = {
        feature: _safe_round(None if pd.isna(ordered_df.at[0, feature]) else ordered_df.at[0, feature])
        for feature in feature_order
    }

    clipped_df = ordered_df.copy()
    clipping_delta: Dict[str, Dict[str, float]] = {}
    for feature, (low, high) in bounds.items():
        if feature not in clipped_df.columns:
            continue

        before = clipped_df.at[0, feature]
        if pd.isna(before):
            continue

        after = float(np.clip(float(before), low, high))
        clipped_df.at[0, feature] = after

        if float(before) != after:
            clipping_delta[feature] = {
                "before": _safe_round(before),
                "after": _safe_round(after),
                "low": _safe_round(low),
                "high": _safe_round(high),
                "delta": _safe_round(after - float(before)),
            }

    X_imp = np.array(engine["imputer"].transform(clipped_df), dtype=float)
    imputed_values: Dict[str, float] = {}
    for idx, feature in enumerate(feature_order):
        original = clipped_df.at[0, feature]
        imputed = float(X_imp[0, idx])
        if pd.isna(original):
            imputed_values[feature] = _safe_round(imputed) or imputed

    X_sc = np.array(engine["scaler"].transform(X_imp), dtype=float)
    scaled_values = {
        feature: _safe_round(float(X_sc[0, idx]))
        for idx, feature in enumerate(feature_order)
    }

    ensemble_proba = float(engine["model"].predict_proba(X_sc)[0, 1])
    estimator_probs, weights = _extract_estimator_probabilities(engine["model"], X_sc)

    rf_proba = _pick_estimator_prob(estimator_probs, ["rf", "forest", "random"])
    hgb_proba = _pick_estimator_prob(estimator_probs, ["hgb", "hist", "gradient"])

    if rf_proba is None and len(estimator_probs) >= 1:
        rf_proba = list(estimator_probs.values())[0]
    if hgb_proba is None and len(estimator_probs) >= 2:
        hgb_proba = list(estimator_probs.values())[1]

    model_breakdown = {
        "rf_proba": _safe_round(rf_proba),
        "hgb_proba": _safe_round(hgb_proba),
        "ensemble_proba": _safe_round(ensemble_proba),
        "weights": weights,
        "estimators": {name: _safe_round(prob) for name, prob in estimator_probs.items()},
    }

    local_sensitivity = _compute_local_sensitivity(
        engine=engine,
        feature_order=feature_order,
        bounds=bounds,
        base_unscaled=X_imp[0],
        baseline_probability=ensemble_proba,
    )

    result = {
        "probability": _safe_round(ensemble_proba),
        "risk_label": _risk_label(ensemble_proba),
        "thresholds": THRESHOLDS,
        "model_breakdown": model_breakdown,
        "generated_at": _now_iso(),
    }

    artifacts = {
        "input_ordered": input_ordered,
        "clipping_delta": clipping_delta,
        "imputed_values": imputed_values,
        "scaled_values": scaled_values,
        "model_breakdown": model_breakdown,
        "local_sensitivity": local_sensitivity,
    }

    return {"artifacts": artifacts, "result": result}


async def _demo_delay() -> None:
    await asyncio.sleep(random.uniform(*DEMO_DELAY_RANGE))


async def _process_run(run_id: str, values: Dict[str, Optional[float]]) -> None:
    try:
        engine = _require_engine()

        run_store.set_status(run_id, RunStatus.VALIDATING)
        run_store.set_step_state(run_id, "VALIDATING", "running")
        await _demo_delay()
        run_store.set_step_state(run_id, "VALIDATING", "completed")

        run_store.set_step_state(run_id, "ORDERING", "running")
        await _demo_delay()

        pipeline_output = _run_inference_pipeline(engine=engine, values=values)

        run_store.update_artifact(run_id, "input_ordered", pipeline_output["artifacts"]["input_ordered"])
        run_store.set_step_state(run_id, "ORDERING", "completed")

        run_store.set_status(run_id, RunStatus.CLIPPING)
        run_store.set_step_state(run_id, "CLIPPING", "running")
        await _demo_delay()
        run_store.update_artifact(run_id, "clipping_delta", pipeline_output["artifacts"]["clipping_delta"])
        run_store.set_step_state(run_id, "CLIPPING", "completed")

        run_store.set_status(run_id, RunStatus.IMPUTING)
        run_store.set_step_state(run_id, "IMPUTING", "running")
        await _demo_delay()
        run_store.update_artifact(run_id, "imputed_values", pipeline_output["artifacts"]["imputed_values"])
        run_store.set_step_state(run_id, "IMPUTING", "completed")

        run_store.set_status(run_id, RunStatus.SCALING)
        run_store.set_step_state(run_id, "SCALING", "running")
        await _demo_delay()
        run_store.update_artifact(run_id, "scaled_values", pipeline_output["artifacts"]["scaled_values"])
        run_store.set_step_state(run_id, "SCALING", "completed")

        run_store.set_status(run_id, RunStatus.INFERENCING)
        run_store.set_step_state(run_id, "INFERENCING", "running")
        await _demo_delay()
        run_store.update_artifact(run_id, "model_breakdown", pipeline_output["artifacts"]["model_breakdown"])
        run_store.set_step_state(run_id, "INFERENCING", "completed")

        run_store.set_status(run_id, RunStatus.EXPLAINING)
        run_store.set_step_state(run_id, "EXPLAINING", "running")
        await _demo_delay()
        run_store.update_artifact(run_id, "local_sensitivity", pipeline_output["artifacts"]["local_sensitivity"])
        run_store.set_step_state(run_id, "EXPLAINING", "completed")

        run_store.set_result(run_id, pipeline_output["result"])
        run_store.set_status(run_id, RunStatus.COMPLETED)
    except Exception as exc:  # noqa: BLE001
        run_store.set_error(run_id, f"{type(exc).__name__}: {exc}")


@app.get("/api/meta", response_model=MetaResponse)
async def get_meta() -> MetaResponse:
    engine = _require_engine()
    features = [str(col) for col in engine["features"]]
    bounds = normalize_bounds(engine["bounds"])
    return MetaResponse(
        features=features,
        bounds={feature: [low, high] for feature, (low, high) in bounds.items()},
        default_values=build_default_values(features, bounds),
        thresholds=THRESHOLDS,
        required_fields=REQUIRED_FIELDS,
        model_version=get_model_version(engine),
    )


@app.post("/api/run", response_model=RunCreateResponse)
async def create_run(request: RunRequest) -> RunCreateResponse:
    engine = _require_engine()
    features = [str(col) for col in engine["features"]]
    normalized_values = _normalize_values(request.values, features)
    missing_required = _missing_required(normalized_values)

    run_id = run_store.create_run(
        values=normalized_values,
        options=request.options.model_dump(),
        status=RunStatus.QUEUED,
        missing_required=missing_required,
    )

    if missing_required and not request.options.allow_missing_demo:
        run_store.set_status(run_id, RunStatus.DATA_MISSING)
        run_store.set_step_state(run_id, "VALIDATING", "failed")
        run_store.set_error(
            run_id,
            "Required input is missing. Turn on allow_missing_demo only for demo imputation walkthrough.",
        )
        # Keep status as DATA_MISSING (set_error marks FAILED)
        run_store.set_status(run_id, RunStatus.DATA_MISSING)
        return RunCreateResponse(run_id=run_id)

    asyncio.create_task(_process_run(run_id=run_id, values=normalized_values))
    return RunCreateResponse(run_id=run_id)


@app.get("/api/run/{run_id}", response_model=RunPollResponse)
async def get_run(run_id: str) -> RunPollResponse:
    run_data = run_store.get_run(run_id)
    if run_data is None:
        raise HTTPException(status_code=404, detail=f"run_id not found: {run_id}")

    status = run_data["status"]
    if isinstance(status, str):
        status = RunStatus(status)

    return RunPollResponse(
        run_id=run_id,
        status=status,
        progress=run_data["progress"],
        step_states=run_data["step_states"],
        step_artifacts=run_data["step_artifacts"],
        missing_required=run_data.get("missing_required", []),
        result=run_data.get("result"),
        error=run_data.get("error"),
    )


@app.post("/api/predict")
async def predict(request: RunRequest) -> Dict[str, Any]:
    engine = _require_engine()
    features = [str(col) for col in engine["features"]]
    normalized_values = _normalize_values(request.values, features)
    missing_required = _missing_required(normalized_values)

    if missing_required and not request.options.allow_missing_demo:
        return {
            "status": RunStatus.DATA_MISSING,
            "missing_required": missing_required,
            "message": "Required fields are missing. Prediction aborted.",
        }

    output = _run_inference_pipeline(engine=engine, values=normalized_values)
    return {
        "status": RunStatus.COMPLETED,
        "missing_required": missing_required,
        "step_artifacts": {
            "input_raw": normalized_values,
            **output["artifacts"],
        },
        "result": output["result"],
    }


@app.post("/api/demo/generate", response_model=DemoGenerateResponse)
async def generate_demo_csv(request: DemoGenerateRequest) -> DemoGenerateResponse:
    engine = _require_engine()

    df = generate_scored_dataset(
        engine=engine,
        n=request.n,
        target_mix=request.mix,
        seed=request.seed,
        include_clipping_cases_ratio=request.include_clipping_cases_ratio,
        include_missing_ratio=request.include_missing_ratio,
        max_attempts=request.max_attempts,
    )

    file_path = EXPORTS_DIR / EXPORT_FILENAME
    df.to_csv(file_path, index=False, encoding="utf-8-sig")

    summary_payload = df.attrs.get("summary", {})
    summary = DemoGenerateSummary(**summary_payload)

    return DemoGenerateResponse(
        status="ok",
        path=f"backend/exports/{EXPORT_FILENAME}",
        download_url=f"/api/demo/download/{EXPORT_FILENAME}",
        summary=summary,
    )


@app.get("/api/demo/download/{filename}")
async def download_demo_csv(filename: str) -> FileResponse:
    safe_name = Path(filename).name
    file_path = EXPORTS_DIR / safe_name
    if not file_path.exists():
        raise HTTPException(status_code=404, detail=f"export file not found: {safe_name}")

    return FileResponse(
        path=file_path,
        media_type="text/csv",
        filename=safe_name,
    )


@app.get("/api/health")
async def health() -> Dict[str, Any]:
    return {
        "ok": ENGINE is not None,
        "engine_loaded": ENGINE is not None,
        "error": ENGINE_ERROR,
        "time": _now_iso(),
        "steps": PIPELINE_STEPS,
    }
