from __future__ import annotations

import os
import sys
from pathlib import Path
from typing import Any, Dict, Iterable, Optional, Tuple

import joblib
import numpy as np

MODEL_FILENAME = "ADNI_CIST_Predictor_Final.joblib"
MODEL_RELATIVE_PATH = Path(__file__).resolve().parent / "assets" / MODEL_FILENAME

REQUIRED_ENGINE_KEYS = ("features", "bounds", "imputer", "scaler", "model")

KNOWN_DEFAULTS: Dict[str, float] = {
    "CIST_ORIENT": 5,
    "CIST_ATTENTION": 3,
    "CIST_EXEC": 4,
    "CIST_MEMORY": 7,
    "CIST_LANGUAGE": 3,
    "entry_age": 75,
    "PTEDUCAT": 12,
    "VSBPSYS": 130,
    "BMI": 23.5,
    "PTGENDER_num": 1,
}

REQUIRED_FIELDS = [
    "CIST_ORIENT",
    "CIST_ATTENTION",
    "CIST_EXEC",
    "CIST_MEMORY",
    "CIST_LANGUAGE",
    "entry_age",
    "PTGENDER_num",
]

THRESHOLDS = {
    "low": 0.4,
    "high": 0.7,
}


class EngineLoadError(RuntimeError):
    pass


def _install_numpy_pickle_compat() -> None:
    """
    Compatibility shim for artifacts that pickle BitGenerator classes instead of names.
    """
    try:
        import numpy.random._pickle as np_pickle
    except Exception:  # noqa: BLE001
        return

    original_ctor = getattr(np_pickle, "__bit_generator_ctor", None)
    if not callable(original_ctor):
        return

    if getattr(original_ctor, "_codex_compat_wrapped", False):
        return

    def _compat_ctor(bit_generator_name: object = "MT19937"):  # type: ignore[override]
        if isinstance(bit_generator_name, type):
            return bit_generator_name()

        if isinstance(bit_generator_name, str):
            short_name = bit_generator_name.split(".")[-1]
            bit_generators = getattr(np_pickle, "BitGenerators", {})
            if short_name in bit_generators:
                return bit_generators[short_name]()

        return original_ctor(bit_generator_name)

    setattr(_compat_ctor, "_codex_compat_wrapped", True)
    np_pickle.__bit_generator_ctor = _compat_ctor


def load_engine(
    model_path: Optional[str] = None,
    enable_numpy_core_alias: bool = True,
) -> Dict[str, Any]:
    if enable_numpy_core_alias:
        # Legacy pickle compatibility: some artifacts reference numpy._core.
        sys.modules.setdefault("numpy._core", np.core)
        _install_numpy_pickle_compat()

    resolved_path = Path(model_path) if model_path else MODEL_RELATIVE_PATH
    if not resolved_path.exists():
        raise EngineLoadError(
            "Model file was not found. "
            f"Expected path: {resolved_path}. "
            "Place ADNI_CIST_Predictor_Final.joblib under backend/assets/."
        )

    try:
        engine = joblib.load(resolved_path)
    except Exception as exc:  # noqa: BLE001
        raise EngineLoadError(
            "Failed to load model engine from joblib. "
            "Check numpy/scikit-learn version compatibility and ensure the model file is valid. "
            f"Original error: {type(exc).__name__}: {exc}"
        ) from exc

    missing = [key for key in REQUIRED_ENGINE_KEYS if key not in engine]
    if missing:
        raise EngineLoadError(
            f"Invalid engine payload: missing keys {missing}. "
            f"Required keys are {list(REQUIRED_ENGINE_KEYS)}."
        )

    return engine


def normalize_bounds(bounds: Dict[str, Any]) -> Dict[str, Tuple[float, float]]:
    normalized: Dict[str, Tuple[float, float]] = {}
    for feature, raw in bounds.items():
        if isinstance(raw, (tuple, list)) and len(raw) == 2:
            low, high = float(raw[0]), float(raw[1])
            normalized[feature] = (low, high)
    return normalized


def build_default_values(
    features: Iterable[str],
    bounds: Dict[str, Tuple[float, float]],
) -> Dict[str, Optional[float]]:
    defaults: Dict[str, Optional[float]] = {}
    for feature in features:
        if feature in KNOWN_DEFAULTS:
            defaults[feature] = KNOWN_DEFAULTS[feature]
            continue

        if feature in bounds:
            low, high = bounds[feature]
            defaults[feature] = round((low + high) / 2, 3)
        else:
            defaults[feature] = None
    return defaults


def get_model_version(engine: Dict[str, Any]) -> str:
    for key in ("model_version", "version", "artifact_version"):
        if key in engine and engine[key] is not None:
            return str(engine[key])

    model = engine.get("model")
    if model is None:
        return "unknown"

    if hasattr(model, "__class__"):
        return model.__class__.__name__
    return "unknown"
