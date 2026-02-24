from __future__ import annotations

import asyncio
import base64
import json
import logging
import mimetypes
import random
from io import BytesIO
from pathlib import Path
from typing import Any
from urllib.parse import quote

import numpy as np
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from PIL import Image
import tensorflow as tf

from engine_loader import CLASS_NAMES, INPUT_SIZE, ModelLoadError, load_model_engine
from explainers import build_gradcam_artifacts, build_occlusion_artifacts
from run_store import RunStatus, run_store
from schemas import MetaResponse, RunCreateResponse, RunOptions, RunStatusResponse


logger = logging.getLogger("stage3_cnn_explainer")
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")

BASE_DIR = Path(__file__).resolve().parent
ASSETS_DIR = BASE_DIR / "assets"
MODEL_PATH = ASSETS_DIR / "best_model_final.keras"
SAMPLES_DIR = ASSETS_DIR / "samples"

CLASS_NAMES_UI = ["CN (정상)", "DM (치매/AD)", "MCI (경도인지장애)"]
PIPELINE_STEPS = [
    "VALIDATING",
    "RESIZE",
    "PREPROCESS",
    "INFERENCING",
    "EXPLAINING",
    "COMPLETED",
]

model: tf.keras.Model | None = None
model_meta: dict[str, Any] = {
    "input_size": INPUT_SIZE,
    "class_names": CLASS_NAMES,
    "backbone_name": "EfficientNetB3",
    "head": [],
    "model_version": "unknown",
}
model_error: str | None = None
inference_lock = asyncio.Lock()

app = FastAPI(title="Stage3 CNN Model Explainer API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

if ASSETS_DIR.exists():
    app.mount("/api/assets", StaticFiles(directory=str(ASSETS_DIR)), name="assets")


def _model_dump(instance: Any) -> dict[str, Any]:
    if hasattr(instance, "model_dump"):
        return instance.model_dump()
    return instance.dict()  # pragma: no cover


def _to_bool(value: Any, default: bool) -> bool:
    if value is None:
        return default
    if isinstance(value, bool):
        return value
    if isinstance(value, (int, float)):
        return bool(value)
    return str(value).strip().lower() in {"1", "true", "yes", "y", "on"}


def _png_base64_from_pil(image: Image.Image) -> str:
    buffer = BytesIO()
    image.save(buffer, format="PNG")
    return base64.b64encode(buffer.getvalue()).decode("utf-8")


def _preview_image(image: Image.Image, max_side: int = 420) -> Image.Image:
    preview = image.copy()
    preview.thumbnail((max_side, max_side), Image.LANCZOS)
    return preview


def _resolve_sample_path(sample_id: str) -> Path:
    if not sample_id:
        raise ValueError("sample_id is empty")

    sample_root = SAMPLES_DIR.resolve()
    candidate = (SAMPLES_DIR / sample_id).resolve()

    if sample_root not in candidate.parents and candidate != sample_root:
        raise ValueError("Invalid sample_id path")
    if not candidate.exists() or not candidate.is_file():
        raise ValueError(f"Unknown sample_id: {sample_id}")

    return candidate


def _collect_preprocess_stats(tensor: np.ndarray) -> dict[str, float]:
    return {
        "min": float(np.min(tensor)),
        "max": float(np.max(tensor)),
        "mean": float(np.mean(tensor)),
        "std": float(np.std(tensor)),
    }


def _samples_payload() -> dict[str, list[dict[str, Any]]]:
    payload: dict[str, list[dict[str, Any]]] = {"CN": [], "DM": [], "MCI": []}

    if not SAMPLES_DIR.exists():
        return payload

    class_map = {
        "CN": "CN",
        "MCI": "MCI",
        "DM": "DM",
        "AD": "DM",
        "DM_or_AD": "DM",
    }

    image_suffixes = {".png", ".jpg", ".jpeg"}

    for class_dir in sorted([p for p in SAMPLES_DIR.iterdir() if p.is_dir()]):
        class_key = class_map.get(class_dir.name)
        if class_key is None:
            continue

        for file_path in sorted(class_dir.iterdir()):
            if file_path.suffix.lower() not in image_suffixes:
                continue

            rel = file_path.relative_to(SAMPLES_DIR)
            encoded_rel = "/".join(quote(part) for part in rel.parts)
            url = f"/api/assets/samples/{encoded_rel}"

            payload[class_key].append(
                {
                    "id": str(rel).replace("\\", "/"),
                    "name": file_path.name,
                    "url_thumbnail": url,
                    "url_full": url,
                }
            )

    return payload


async def _demo_delay() -> None:
    await asyncio.sleep(random.uniform(0.4, 0.8))


@app.on_event("startup")
async def _startup() -> None:
    global model, model_meta, model_error

    try:
        model, model_meta = load_model_engine(MODEL_PATH)
        model_error = None
        logger.info("Model loaded successfully from %s", MODEL_PATH)
    except ModelLoadError as exc:
        model = None
        model_error = str(exc)
        logger.error("Model load failed: %s", model_error)


@app.get("/api/meta", response_model=MetaResponse)
async def get_meta() -> MetaResponse:
    info = dict(model_meta)
    info.update(
        {
            "load_status": "ready" if model is not None else "error",
            "load_error": model_error,
        }
    )

    return MetaResponse(
        class_names=CLASS_NAMES,
        class_names_ui=CLASS_NAMES_UI,
        input_size=[INPUT_SIZE[0], INPUT_SIZE[1]],
        required_inputs=["single_mri_image(jpg/png/jpeg)"],
        pipeline_steps=PIPELINE_STEPS,
        model_info=info,
    )


@app.get("/api/samples")
async def get_samples() -> dict[str, list[dict[str, Any]]]:
    return _samples_payload()


@app.post("/api/run", response_model=RunCreateResponse)
async def create_run(request: Request) -> RunCreateResponse:
    content_type = request.headers.get("content-type", "")

    file_bytes: bytes | None = None
    filename: str | None = None
    mime: str | None = None
    sample_id: str | None = None
    options = RunOptions()

    if "multipart/form-data" in content_type:
        form = await request.form()

        sample_value = form.get("sample_id")
        if sample_value:
            sample_id = str(sample_value).strip()

        options_raw = form.get("options")
        if options_raw:
            try:
                options = RunOptions(**json.loads(str(options_raw)))
            except json.JSONDecodeError as exc:
                raise HTTPException(status_code=400, detail=f"Invalid options JSON: {exc}") from exc
        else:
            options = RunOptions(
                explain=_to_bool(form.get("explain"), True),
                occlusion=_to_bool(form.get("occlusion"), False),
                allow_cpu_only=_to_bool(form.get("allow_cpu_only"), True),
            )

        upload = form.get("file")
        if upload is not None and hasattr(upload, "filename") and getattr(upload, "filename", ""):
            file_bytes = await upload.read()
            filename = upload.filename
            mime = upload.content_type or mimetypes.guess_type(filename)[0] or "application/octet-stream"

    elif "application/json" in content_type:
        payload = await request.json()
        sample_id = payload.get("sample_id")
        options = RunOptions(**(payload.get("options") or {}))

    if file_bytes is None and sample_id:
        try:
            sample_path = _resolve_sample_path(sample_id)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

        file_bytes = sample_path.read_bytes()
        filename = sample_path.name
        mime = mimetypes.guess_type(sample_path.name)[0] or "image/png"

    if file_bytes is None:
        run_id = run_store.create_run(
            status=RunStatus.DATA_MISSING,
            options=_model_dump(options),
            step_artifacts={
                "message": "입력 이미지가 없어 결과를 생성하지 않았습니다.",
            },
        )
        return RunCreateResponse(run_id=run_id)

    run_id = run_store.create_run(
        status=RunStatus.QUEUED,
        options=_model_dump(options),
        step_artifacts={},
    )

    asyncio.create_task(
        _execute_pipeline(
            run_id=run_id,
            image_bytes=file_bytes,
            filename=filename or "uploaded_image",
            mime=mime or "image/png",
            options=options,
        )
    )

    return RunCreateResponse(run_id=run_id)


@app.get("/api/run/{run_id}", response_model=RunStatusResponse)
async def get_run_status(run_id: str) -> RunStatusResponse:
    run_data = run_store.get_run(run_id)
    if run_data is None:
        raise HTTPException(status_code=404, detail=f"Unknown run_id: {run_id}")
    return RunStatusResponse(**run_data)


async def _execute_pipeline(
    *,
    run_id: str,
    image_bytes: bytes,
    filename: str,
    mime: str,
    options: RunOptions,
) -> None:
    try:
        if model is None:
            raise RuntimeError(model_error or "Model unavailable")

        run_store.update_run(run_id, status=RunStatus.VALIDATING)
        await _demo_delay()

        image = Image.open(BytesIO(image_bytes)).convert("RGB")
        original_size = [int(image.width), int(image.height)]

        run_store.update_run(
            run_id,
            step_artifacts={
                "input_info": {
                    "filename": filename,
                    "mime": mime,
                    "original_size": original_size,
                },
                "image_preview_original": _png_base64_from_pil(_preview_image(image)),
            },
        )

        run_store.update_run(run_id, status=RunStatus.RESIZE)
        await _demo_delay()

        resized = image.resize(INPUT_SIZE, Image.BILINEAR)
        resized_rgb = np.asarray(resized, dtype=np.uint8)

        run_store.update_run(
            run_id,
            step_artifacts={
                "image_preview_resized": _png_base64_from_pil(resized),
            },
        )

        run_store.update_run(run_id, status=RunStatus.PREPROCESS)
        await _demo_delay()

        img_array = resized_rgb.astype("float32")
        img_batch = np.expand_dims(img_array, axis=0)
        img_preprocessed = tf.keras.applications.efficientnet.preprocess_input(img_batch)

        run_store.update_run(
            run_id,
            step_artifacts={
                "preprocess_stats": _collect_preprocess_stats(img_preprocessed),
            },
        )

        run_store.update_run(run_id, status=RunStatus.INFERENCING)
        await _demo_delay()

        async with inference_lock:
            predictions = model(img_preprocessed, training=False).numpy()[0]

        top_idx = int(np.argmax(predictions))
        confidence = float(predictions[top_idx])

        probs = {CLASS_NAMES[i]: float(predictions[i]) for i in range(len(CLASS_NAMES))}
        probs_ui = {CLASS_NAMES_UI[i]: float(predictions[i]) for i in range(len(CLASS_NAMES_UI))}

        run_store.update_run(
            run_id,
            step_artifacts={
                "probs": probs,
                "probs_ui": probs_ui,
                "top_class": CLASS_NAMES[top_idx],
                "top_class_ui": CLASS_NAMES_UI[top_idx],
                "confidence": confidence,
                "top_class_index": top_idx,
            },
        )

        run_store.update_run(run_id, status=RunStatus.EXPLAINING)
        await _demo_delay()

        explain_artifacts: dict[str, Any] = {}

        if options.explain:
            async with inference_lock:
                explain_artifacts["gradcam"] = build_gradcam_artifacts(
                    model=model,
                    preprocessed_batch=img_preprocessed,
                    resized_rgb=resized_rgb,
                    class_index=top_idx,
                )

            if options.occlusion:
                async with inference_lock:
                    explain_artifacts["occlusion"] = build_occlusion_artifacts(
                        model=model,
                        resized_rgb=resized_rgb,
                        baseline_probs=predictions,
                        target_class_index=top_idx,
                        patch_size=32,
                        stride=32,
                        max_evals=49,
                    )
        else:
            explain_artifacts["gradcam"] = {"disabled": True, "reason": "Explain option turned off"}

        run_store.update_run(run_id, step_artifacts=explain_artifacts)
        run_store.update_run(run_id, status=RunStatus.COMPLETED)

    except Exception as exc:  # pragma: no cover - runtime safety path
        logger.exception("Run failed: %s", run_id)
        run_store.update_run(run_id, status=RunStatus.FAILED, error=str(exc))
