from __future__ import annotations

import importlib.util
import logging
import os
import re
from pathlib import Path
from typing import Any
from uuid import uuid4

import numpy as np
import pandas as pd
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel


logger = logging.getLogger("stage3_future_explainer")
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")

BACKEND_DIR = Path(__file__).resolve().parent
APP_DIR = BACKEND_DIR.parent


def _resolve_project_root() -> Path:
    env_root = os.getenv("STAGE3_PROJECT_ROOT")
    if env_root:
        return Path(env_root).resolve()

    for candidate in [APP_DIR, *APP_DIR.parents]:
        if (candidate / "stage3_final").exists() and (candidate / "src").exists():
            return candidate.resolve()
    return APP_DIR.resolve()


PROJECT_ROOT = _resolve_project_root()


def _resolve_pipeline_dir() -> Path:
    direct = PROJECT_ROOT / "stage3_final" / "core_source" / "stage3_예측모델"
    if direct.exists():
        return direct

    core_root = PROJECT_ROOT / "stage3_final" / "core_source"
    if core_root.exists():
        for child in sorted(core_root.iterdir()):
            if child.is_dir() and child.name.startswith("stage3_"):
                return child

    raise RuntimeError("stage3 pipeline directory not found under stage3_final/core_source")


PIPELINE_DIR = _resolve_pipeline_dir()

CSV_PATH = PIPELINE_DIR / "ADNI3_Golden_Master_Longitudinal_image.csv"
DELTA_PATH = PIPELINE_DIR / "delta_patient_level.csv"
LONGITUDINAL_PATH = PIPELINE_DIR / "ADNI_Longitudinal_DATA.csv"
AUTO_LONGITUDINAL_PATH = PIPELINE_DIR / "_auto_longitudinal_for_rsf.csv"

IMG_ROOT = PROJECT_ROOT / "stage3_final" / "stage_3_cnn" / "TEST_IMAGE"
CNN_WEIGHTS = PROJECT_ROOT / "stage3_final" / "stage_3_cnn" / "best_model_final.keras"
ANN_DIR = PROJECT_ROOT / "stage2_modelfinal"

MICE_IMPUTER_PATH = PROJECT_ROOT / "stage3_final" / "data" / "preprocessing" / "stage2_mice_imputer.pkl"
SCALER_PATH = PROJECT_ROOT / "stage3_final" / "data" / "preprocessing" / "stage2_scaler.pkl"

RSF_MODEL_PATH = PIPELINE_DIR / "rsf_survival_model.joblib"
RSF_SCALER_PATH = PIPELINE_DIR / "rsf_survival_scaler.joblib"

ANN_SEED_ORDER = [42, 99, 123, 777, 2024]


def _load_stage3_utils():
    utils_path = PIPELINE_DIR / "utils.py"
    if not utils_path.exists():
        raise RuntimeError(f"utils.py not found: {utils_path}")

    spec = importlib.util.spec_from_file_location("stage3_pipeline_utils", utils_path)
    if spec is None or spec.loader is None:
        raise RuntimeError("failed to load stage3 utils module spec")

    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


stage3_utils = _load_stage3_utils()


class PredictRequest(BaseModel):
    subject_id: str
    scan_id: str | None = None
    image_data_id: str | None = None


class PredictResponse(BaseModel):
    run_id: str
    subject_id: str
    image_data_id: str
    image_path: str
    predicted_binary: int
    predicted_label: str
    ensemble_risk_grade: str
    survival_risk_grade: str
    year1_conversion_risk: float
    year2_conversion_risk: float
    p_convert_12mo: float
    p_convert_24mo: float
    p_convert_36mo: float
    p_convert_48mo: float
    p_cnn_ad: float
    p_ann_ad: float
    p_ensemble_ad: float
    cnn_class_probs: dict[str, float]
    cnn_top_class: str
    cnn_top_confidence: float
    source: str
    note: str | None = None


class RuntimeState:
    ready: bool = False
    load_error: str | None = None
    note: str | None = None

    df_clinical: pd.DataFrame | None = None
    cnn_model: Any | None = None
    ann_models: list[Any] | None = None
    mice_imputer: Any | None = None
    scaler: Any | None = None
    rsf_model: Any | None = None
    rsf_scaler: Any | None = None

    image_map: dict[tuple[str, str], str] | None = None
    subject_images: dict[str, list[tuple[str, str]]] | None = None


STATE = RuntimeState()

app = FastAPI(title="Stage3 Future Predictor API", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _must_exist(path: Path, label: str) -> None:
    if not path.exists():
        raise RuntimeError(f"{label} missing: {path}")


def _parse_int(value: Any, fallback: int | None = None) -> int | None:
    try:
        return int(float(value))
    except (TypeError, ValueError):
        return fallback


def _parse_visit_month(value: Any) -> int:
    order = _parse_int(value, 1)
    if order is None:
        return 0
    return max(0, (order - 1) * 12)


def _map_diagnosis(row: pd.Series) -> str | None:
    raw = str(row.get("DIAGNOSIS", "")).strip().lower()
    label_val = _parse_int(row.get("label"), None)

    if raw in {"cn", "normal", "1", "1.0"}:
        return "CN"
    if raw in {"mci", "2", "2.0"}:
        return "MCI"
    if raw in {"dementia", "ad", "dm", "3", "3.0"}:
        return "Dementia"

    if label_val == 0:
        return "CN"
    if label_val == 1:
        return "MCI"
    if label_val == 2:
        return "Dementia"
    return None


def _extract_rid(subject_id: str) -> int | None:
    matched = re.search(r"(\d+)$", subject_id)
    if not matched:
        return None
    return int(matched.group(1))


def _extract_image_id(scan_id: str | None) -> str | None:
    if not scan_id:
        return None
    matched = re.search(r"(I\d+)", scan_id, flags=re.IGNORECASE)
    if not matched:
        return None
    return matched.group(1).upper()


def _scan_images_extended(img_root: Path) -> tuple[dict[tuple[str, str], str], dict[str, list[tuple[str, str]]]]:
    image_map: dict[tuple[str, str], str] = {}
    subject_images: dict[str, list[tuple[str, str]]] = {}

    folders = ["MCI", "AD", "DM", "DM_or_AD", "CN"]
    preferred = []
    fallback = []

    for folder in folders:
        folder_path = img_root / folder
        if not folder_path.is_dir():
            continue

        for file_path in sorted(folder_path.glob("*.png")):
            parts = file_path.stem.split("_")
            if len(parts) < 5:
                continue

            subject_id = f"{parts[0]}_S_{parts[2]}"
            image_id = parts[3].upper().strip()
            slice_raw = parts[4].lower().strip()
            slice_num = _parse_int(slice_raw.replace("s", ""), None)

            item = (subject_id, image_id, str(file_path), slice_num or 0)
            if slice_num == 2:
                preferred.append(item)
            else:
                fallback.append(item)

    for subject_id, image_id, file_path, _slice_num in preferred + fallback:
        key = (subject_id, image_id)
        if key not in image_map:
            image_map[key] = file_path
        subject_images.setdefault(subject_id, []).append((image_id, file_path))

    return image_map, subject_images


def _build_auto_longitudinal_from_clinical(df_clinical: pd.DataFrame, out_path: Path) -> Path:
    records: list[dict[str, Any]] = []
    for _, row in df_clinical.iterrows():
        subject_id = str(row.get("subject_id", "")).strip()
        rid = _extract_rid(subject_id)
        if rid is None:
            continue

        diagnosis = _map_diagnosis(row)
        if diagnosis is None:
            continue

        records.append(
            {
                "RID": rid,
                "Months_from_bl": _parse_visit_month(row.get("visit_order")),
                "DIAGNOSIS": diagnosis,
            }
        )

    if not records:
        raise RuntimeError("failed to build fallback longitudinal dataset: no usable rows")

    df = pd.DataFrame(records).drop_duplicates(subset=["RID", "Months_from_bl", "DIAGNOSIS"])
    df = df.sort_values(["RID", "Months_from_bl"], kind="stable")
    out_path.parent.mkdir(parents=True, exist_ok=True)
    df.to_csv(out_path, index=False)
    return out_path


def _load_or_train_survival_models(df_clinical: pd.DataFrame) -> tuple[Any | None, Any | None, str]:
    rsf_model, rsf_scaler = stage3_utils.load_survival_models(str(RSF_MODEL_PATH), str(RSF_SCALER_PATH))
    if rsf_model is not None and rsf_scaler is not None:
        return rsf_model, rsf_scaler, "pretrained"

    try:
        long_path = LONGITUDINAL_PATH if LONGITUDINAL_PATH.exists() else _build_auto_longitudinal_from_clinical(
            df_clinical, AUTO_LONGITUDINAL_PATH
        )
        rsf_model, rsf_scaler, _ = stage3_utils.train_and_save_survival_models(
            long_path=str(long_path),
            delta_path=str(DELTA_PATH),
            rsf_save_path=str(RSF_MODEL_PATH),
            rsf_scaler_save_path=str(RSF_SCALER_PATH),
        )
        note = "trained_from_longitudinal" if LONGITUDINAL_PATH.exists() else "trained_from_auto_longitudinal"
        return rsf_model, rsf_scaler, note
    except Exception as exc:
        logger.exception("RSF model load/train failed")
        return None, None, f"survival_model_unavailable: {exc}"


def _ensemble_grade(p_ensemble_ad: float) -> str:
    if p_ensemble_ad < 0.33:
        return "Low"
    if p_ensemble_ad < 0.66:
        return "Medium"
    return "High"


def _survival_grade(p24: float) -> str:
    if p24 < 0.15:
        return "Low"
    if p24 < 0.40:
        return "Medium"
    return "High"


def _predict_fallback_curve(p_ensemble_ad: float, pred_binary: int) -> tuple[float, float, float, float]:
    if pred_binary == 1:
        p12 = float(np.clip(0.72 + p_ensemble_ad * 0.22, 0.72, 0.97))
        p24 = float(np.clip(p12 + 0.10, 0.80, 0.99))
    else:
        p12 = float(np.clip(0.05 + p_ensemble_ad * 0.55, 0.03, 0.72))
        p24 = float(np.clip(p12 + 0.08 + p_ensemble_ad * 0.12, 0.05, 0.92))
    p36 = float(np.clip(p24 + 0.07, 0.08, 0.96))
    p48 = float(np.clip(p36 + 0.06, 0.10, 0.98))
    return p12, p24, p36, p48


def _select_case_row(df_clinical: pd.DataFrame, subject_id: str, image_data_id: str | None) -> pd.Series:
    subject_rows = df_clinical[df_clinical["subject_id"].astype(str).str.strip() == subject_id].copy()
    if len(subject_rows) == 0:
        raise HTTPException(status_code=404, detail=f"subject_id not found: {subject_id}")

    subject_rows["Image.Data.ID_norm"] = subject_rows["Image.Data.ID"].astype(str).str.strip().str.upper()
    subject_rows["visit_order_num"] = pd.to_numeric(subject_rows["visit_order"], errors="coerce")
    subject_rows = subject_rows.sort_values(["visit_order_num"], kind="stable")

    if image_data_id:
        matched = subject_rows[subject_rows["Image.Data.ID_norm"] == image_data_id.upper()]
        if len(matched) > 0:
            return matched.iloc[-1]

    label_num = pd.to_numeric(subject_rows["label"], errors="coerce")
    mci_or_ad = subject_rows[(label_num == 1) | (label_num == 2)]
    if len(mci_or_ad) > 0:
        return mci_or_ad.iloc[-1]
    return subject_rows.iloc[-1]


def _select_image_path(subject_id: str, row_image_id: str, req_image_id: str | None) -> tuple[str, str]:
    assert STATE.image_map is not None
    assert STATE.subject_images is not None

    candidates = []
    if req_image_id:
        candidates.append(req_image_id.upper())
    if row_image_id:
        candidates.append(row_image_id.upper())

    for image_id in candidates:
        key = (subject_id, image_id)
        if key in STATE.image_map:
            return image_id, STATE.image_map[key]

    subject_paths = STATE.subject_images.get(subject_id, [])
    if subject_paths:
        image_id, path = subject_paths[0]
        return image_id, path

    raise HTTPException(status_code=404, detail=f"no image file mapped for subject_id={subject_id}")


def _predict_case(req: PredictRequest) -> PredictResponse:
    if not STATE.ready or STATE.df_clinical is None:
        raise HTTPException(status_code=503, detail=STATE.load_error or "model not ready")

    assert STATE.cnn_model is not None
    assert STATE.ann_models is not None
    assert STATE.mice_imputer is not None
    assert STATE.scaler is not None

    req_image_id = req.image_data_id or _extract_image_id(req.scan_id)
    case_row = _select_case_row(STATE.df_clinical, req.subject_id, req_image_id)
    row_image_id = str(case_row.get("Image.Data.ID", "")).strip().upper()
    image_id, image_path = _select_image_path(req.subject_id, row_image_id, req_image_id)

    case_df = case_row.to_frame().T.reset_index(drop=True)
    _, x_health, x_cog, x_eng = stage3_utils.preprocess_clinical(case_df, STATE.mice_imputer, STATE.scaler)

    ann_seed_preds = [
        float(model.predict([x_health, x_cog, x_eng], verbose=0).flatten()[0])
        for model in STATE.ann_models
    ]
    p_ann = float(np.mean(ann_seed_preds))

    image_np = stage3_utils.load_image(image_path)
    image_batch = np.expand_dims(image_np, axis=0)
    cnn_probs = STATE.cnn_model(image_batch, training=False).numpy()[0]

    p_cnn = float(cnn_probs[stage3_utils.CNN_AD_IDX])
    p_ensemble = float(stage3_utils.CNN_WEIGHT * p_cnn + stage3_utils.ANN_WEIGHT * p_ann)
    pred_binary = int(p_ensemble >= 0.5)
    pred_label = "AD" if pred_binary == 1 else "MCI"
    ensemble_grade = _ensemble_grade(p_ensemble)

    p12 = p24 = p36 = p48 = None
    survival_grade = None
    source = "REAL_PIPELINE_WITH_HEURISTIC_SURVIVAL"
    note: str | None = None

    if pred_binary == 0 and STATE.rsf_model is not None and STATE.rsf_scaler is not None:
        ensemble_df = pd.DataFrame(
            [
                {
                    "subject_id": req.subject_id,
                    "risk_grade": ensemble_grade,
                    "P_ensemble_AD": p_ensemble,
                    "pred_binary": pred_binary,
                }
            ]
        )
        survival_df = stage3_utils.predict_individual_survival(
            ensemble_result=ensemble_df,
            delta_path=str(DELTA_PATH),
            rsf_model=STATE.rsf_model,
            rsf_scaler=STATE.rsf_scaler,
            time_points=[12, 24, 36, 48],
        )

        if len(survival_df) > 0:
            row = survival_df.iloc[0]
            p12 = float(row["P_convert_12mo"])
            p24 = float(row["P_convert_24mo"])
            p36 = float(row["P_convert_36mo"])
            p48 = float(row["P_convert_48mo"])
            survival_grade = str(row["final_risk_grade"])
            source = "REAL_PIPELINE"
        else:
            p12, p24, p36, p48 = _predict_fallback_curve(p_ensemble, pred_binary)
            survival_grade = _survival_grade(p24)
            note = "RSF survival input not available for this subject; fallback curve used."
    else:
        p12, p24, p36, p48 = _predict_fallback_curve(p_ensemble, pred_binary)
        survival_grade = _survival_grade(p24)
        if pred_binary == 1:
            note = "Predicted AD case; fallback progression curve used."
        elif STATE.rsf_model is None:
            note = STATE.note or "RSF model unavailable; fallback curve used."

    cnn_labels = ["CN", "AD", "MCI"]
    top_idx = int(np.argmax(cnn_probs))
    cnn_prob_payload = {
        "CN": float(cnn_probs[0]),
        "AD": float(cnn_probs[1]),
        "MCI": float(cnn_probs[2]),
    }

    return PredictResponse(
        run_id=str(uuid4()),
        subject_id=req.subject_id,
        image_data_id=image_id,
        image_path=image_path,
        predicted_binary=pred_binary,
        predicted_label=pred_label,
        ensemble_risk_grade=ensemble_grade,
        survival_risk_grade=survival_grade,
        year1_conversion_risk=float(p12),
        year2_conversion_risk=float(p24),
        p_convert_12mo=float(p12),
        p_convert_24mo=float(p24),
        p_convert_36mo=float(p36),
        p_convert_48mo=float(p48),
        p_cnn_ad=p_cnn,
        p_ann_ad=p_ann,
        p_ensemble_ad=p_ensemble,
        cnn_class_probs=cnn_prob_payload,
        cnn_top_class=cnn_labels[top_idx],
        cnn_top_confidence=float(cnn_probs[top_idx]),
        source=source,
        note=note,
    )


@app.on_event("startup")
async def _startup() -> None:
    try:
        _must_exist(CSV_PATH, "clinical csv")
        _must_exist(DELTA_PATH, "delta csv")
        _must_exist(IMG_ROOT, "image root")
        _must_exist(CNN_WEIGHTS, "cnn weights")
        _must_exist(MICE_IMPUTER_PATH, "mice imputer")
        _must_exist(SCALER_PATH, "stage2 scaler")

        ann_paths = [ANN_DIR / f"best_stage2_binary_ann_seed{seed}.keras" for seed in ANN_SEED_ORDER]
        for p in ann_paths:
            _must_exist(p, f"ann weights({p.name})")

        df = pd.read_csv(CSV_PATH)
        df.columns = [str(c).strip() for c in df.columns]
        STATE.df_clinical = df

        STATE.cnn_model = stage3_utils.build_cnn(str(CNN_WEIGHTS))
        STATE.ann_models = stage3_utils.load_ann_models([str(p) for p in ann_paths])
        STATE.mice_imputer, STATE.scaler = stage3_utils.load_preprocessing_tools(
            str(MICE_IMPUTER_PATH), str(SCALER_PATH)
        )
        STATE.image_map, STATE.subject_images = _scan_images_extended(IMG_ROOT)
        STATE.rsf_model, STATE.rsf_scaler, survival_note = _load_or_train_survival_models(df)
        STATE.note = survival_note

        STATE.ready = True
        STATE.load_error = None
        logger.info(
            "Stage3 Future API ready | clinical=%d rows | subjects=%d | images=%d | survival=%s",
            len(df),
            df["subject_id"].nunique() if "subject_id" in df.columns else -1,
            len(STATE.image_map),
            survival_note,
        )
    except Exception as exc:
        STATE.ready = False
        STATE.load_error = str(exc)
        logger.exception("startup failed: %s", exc)


@app.get("/api/meta")
async def get_meta() -> dict[str, Any]:
    return {
        "ready": STATE.ready,
        "load_error": STATE.load_error,
        "survival_note": STATE.note,
        "paths": {
            "clinical_csv": str(CSV_PATH),
            "delta_csv": str(DELTA_PATH),
            "longitudinal_csv": str(LONGITUDINAL_PATH) if LONGITUDINAL_PATH.exists() else str(AUTO_LONGITUDINAL_PATH),
            "img_root": str(IMG_ROOT),
            "cnn_weights": str(CNN_WEIGHTS),
            "ann_dir": str(ANN_DIR),
        },
    }


@app.post("/api/predict", response_model=PredictResponse)
async def predict(req: PredictRequest) -> PredictResponse:
    return _predict_case(req)
