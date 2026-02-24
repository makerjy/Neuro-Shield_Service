from __future__ import annotations

import os
from pathlib import Path
from typing import Any

os.environ["CUDA_VISIBLE_DEVICES"] = "-1"
os.environ["TF_CPP_MIN_LOG_LEVEL"] = "2"

import tensorflow as tf


INPUT_SIZE = (224, 224)
CLASS_NAMES = ["CN (정상)", "DM (치매)", "MCI (경도인지장애)"]


class ModelLoadError(RuntimeError):
    pass


def load_model_engine(model_path: str | Path) -> tuple[tf.keras.Model, dict[str, Any]]:
    model_path = Path(model_path)

    if not model_path.exists():
        raise ModelLoadError(f"MODEL_FILE_MISSING: {model_path}")

    try:
        inputs = tf.keras.Input(shape=(224, 224, 3))
        base_model = tf.keras.applications.EfficientNetB3(
            include_top=False,
            weights=None,
            pooling="max",
        )

        x = base_model(inputs)
        x = tf.keras.layers.BatchNormalization(
            axis=-1,
            momentum=0.99,
            epsilon=0.0001,
            name="batch_normalization_2",
        )(x)
        x = tf.keras.layers.Dense(256, activation="relu", name="dense_4")(x)
        x = tf.keras.layers.Dropout(0.5, name="dropout_2")(x)
        outputs = tf.keras.layers.Dense(3, activation="softmax", name="dense_5")(x)

        model = tf.keras.Model(inputs=inputs, outputs=outputs, name="neuro_shield_stage3")
    except Exception as exc:  # pragma: no cover - explicit diagnostic path
        raise ModelLoadError(f"MODEL_BUILD_FAILED: {exc}") from exc

    try:
        model.load_weights(str(model_path))
    except Exception as exc:  # pragma: no cover - explicit diagnostic path
        raise ModelLoadError(f"WEIGHT_LOAD_FAILED: {exc}") from exc

    model_meta = {
        "input_size": INPUT_SIZE,
        "class_names": CLASS_NAMES,
        "backbone_name": "EfficientNetB3",
        "head": [
            "BatchNormalization(name=batch_normalization_2)",
            "Dense(256, relu, name=dense_4)",
            "Dropout(0.5, name=dropout_2)",
            "Dense(3, softmax, name=dense_5)",
        ],
        "model_version": "unknown",
        "weights_path": str(model_path),
    }

    return model, model_meta
