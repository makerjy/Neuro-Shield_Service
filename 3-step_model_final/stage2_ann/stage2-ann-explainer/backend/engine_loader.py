from __future__ import annotations

import os
from pathlib import Path
from typing import Dict, List, Tuple

# CPU 우선 실행 (기본 on)
os.environ.setdefault("CUDA_VISIBLE_DEVICES", "-1")
os.environ.setdefault("TF_CPP_MIN_LOG_LEVEL", "2")

import tensorflow as tf
from tensorflow import keras


class ModelLoadError(RuntimeError):
    pass


def load_stage2_model(model_path: str):
    path = Path(model_path)
    if not path.exists():
        raise ModelLoadError(f"model_not_found: {path}")

    try:
        model = keras.models.load_model(path, compile=False)
    except (OSError, IOError) as exc:
        raise ModelLoadError(f"model_io_error: {exc}") from exc
    except Exception as exc:  # noqa: BLE001
        # keras format/TF version mismatch 포함
        raise ModelLoadError(f"model_load_failed: {type(exc).__name__}: {exc}") from exc

    return model


def get_model_branch_dims(model) -> Dict[str, int]:
    dims = {"health": 0, "cognitive": 0, "bio": 0, "engineering": 0}

    for tensor in model.inputs:
        shape = getattr(tensor, "shape", None)
        dim = int(shape[-1]) if shape is not None else 0
        name = str(getattr(tensor, "name", "")).lower()

        if "health" in name:
            dims["health"] = dim
        elif "cog" in name:
            dims["cognitive"] = dim
        elif "bio" in name:
            dims["bio"] = dim
        elif "eng" in name:
            dims["engineering"] = dim

    # fallback: 이름이 없는 경우 입력 순서 기준 보정
    if not any(dims.values()):
        raw_dims: List[int] = []
        for tensor in model.inputs:
            shape = getattr(tensor, "shape", None)
            raw_dims.append(int(shape[-1]) if shape is not None else 0)

        if len(raw_dims) == 3:
            dims = {
                "health": raw_dims[0],
                "cognitive": raw_dims[1],
                "bio": 0,
                "engineering": raw_dims[2],
            }
        elif len(raw_dims) == 4:
            dims = {
                "health": raw_dims[0],
                "cognitive": raw_dims[1],
                "bio": raw_dims[2],
                "engineering": raw_dims[3],
            }
        else:
            raise ValueError(f"unexpected_input_count: expected 3 or 4 branches, got {len(raw_dims)}")

    if dims["health"] <= 0 or dims["cognitive"] <= 0 or dims["engineering"] <= 0:
        raise ValueError(f"invalid_branch_dims: {dims}")

    return dims


def build_branch_probe(model) -> Tuple[keras.Model | None, List[str], List[str]]:
    layer_map = {
        "Health": ["h_relu2"],
        "Cog": ["c_relu3"],
        "Bio": ["b_relu1"],
        "Eng": ["e_relu2"],
        "Fusion": ["fusion"],
        "Embedding": ["ann_embedding_relu", "fc_relu", "fc_relu1"],
    }

    outputs = []
    aliases = []
    missing = []

    for alias, layer_names in layer_map.items():
        found = None
        for layer_name in layer_names:
            try:
                found = model.get_layer(layer_name)
                break
            except Exception:  # noqa: BLE001
                continue

        if found is None:
            missing.append("/".join(layer_names))
            continue

        outputs.append(found.output)
        aliases.append(alias)

    if not outputs:
        return None, [], missing

    probe = keras.Model(inputs=model.inputs, outputs=outputs, name="stage2_branch_probe")
    return probe, aliases, missing
