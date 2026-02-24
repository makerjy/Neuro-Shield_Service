from __future__ import annotations

import base64
from io import BytesIO
from typing import Any, Iterable

import numpy as np
from PIL import Image
import tensorflow as tf


CONV_TYPES = (
    tf.keras.layers.Conv2D,
    tf.keras.layers.SeparableConv2D,
    tf.keras.layers.DepthwiseConv2D,
)


def _iter_layers_reverse(layer: tf.keras.layers.Layer) -> Iterable[tf.keras.layers.Layer]:
    if isinstance(layer, tf.keras.Model):
        for sub_layer in reversed(layer.layers):
            yield from _iter_layers_reverse(sub_layer)
    yield layer


def _np_to_png_base64(arr: np.ndarray) -> str:
    arr_uint8 = np.clip(arr, 0, 255).astype(np.uint8)
    image = Image.fromarray(arr_uint8)
    buf = BytesIO()
    image.save(buf, format="PNG")
    return base64.b64encode(buf.getvalue()).decode("utf-8")


def _mono_to_jet_rgb(values: np.ndarray) -> np.ndarray:
    v = np.clip(values, 0.0, 1.0)
    r = np.clip(1.5 - np.abs(4.0 * v - 3.0), 0.0, 1.0)
    g = np.clip(1.5 - np.abs(4.0 * v - 2.0), 0.0, 1.0)
    b = np.clip(1.5 - np.abs(4.0 * v - 1.0), 0.0, 1.0)
    return (np.stack([r, g, b], axis=-1) * 255.0).astype(np.uint8)


def _resolve_base_model(model: tf.keras.Model) -> tf.keras.Model:
    for layer in model.layers:
        if isinstance(layer, tf.keras.Model):
            return layer
    raise ValueError("No nested backbone model found.")


def find_last_conv_layer_name(model: tf.keras.Model) -> str:
    base_model = _resolve_base_model(model)
    for layer in _iter_layers_reverse(base_model):
        if isinstance(layer, CONV_TYPES):
            return layer.name
    raise ValueError("No Conv2D-like layer found for Grad-CAM.")


def build_gradcam_artifacts(
    model: tf.keras.Model,
    preprocessed_batch: np.ndarray,
    resized_rgb: np.ndarray,
    class_index: int | None = None,
) -> dict[str, Any]:
    base_model = _resolve_base_model(model)
    target_layer_name = find_last_conv_layer_name(model)

    target_layer = None
    for layer in _iter_layers_reverse(base_model):
        if layer.name == target_layer_name:
            target_layer = layer
            break

    if target_layer is None:
        raise RuntimeError(f"Unable to locate target layer: {target_layer_name}")

    conv_model = tf.keras.Model(inputs=base_model.input, outputs=target_layer.output)
    bn_layer = model.get_layer("batch_normalization_2")
    dense4_layer = model.get_layer("dense_4")
    dropout_layer = model.get_layer("dropout_2")
    dense5_layer = model.get_layer("dense_5")

    with tf.GradientTape() as tape:
        conv_outputs = conv_model(preprocessed_batch, training=False)
        tape.watch(conv_outputs)

        pooled = tf.reduce_max(conv_outputs, axis=(1, 2))
        x = bn_layer(pooled, training=False)
        x = dense4_layer(x, training=False)
        x = dropout_layer(x, training=False)
        predictions = dense5_layer(x, training=False)

        if class_index is None:
            class_index = int(tf.argmax(predictions[0]).numpy())
        class_score = predictions[:, class_index]

    grads = tape.gradient(class_score, conv_outputs)
    pooled_grads = tf.reduce_mean(grads, axis=(1, 2))
    conv_outputs = conv_outputs[0]
    pooled_grads = pooled_grads[0]

    cam = tf.reduce_sum(conv_outputs * pooled_grads, axis=-1)
    cam = tf.nn.relu(cam)

    cam_np = cam.numpy()
    if np.max(cam_np) > 0:
        cam_np = cam_np / (np.max(cam_np) + 1e-8)

    cam_img = Image.fromarray((cam_np * 255.0).astype(np.uint8)).resize((224, 224), Image.BILINEAR)
    heatmap_01 = np.asarray(cam_img, dtype=np.float32) / 255.0
    heatmap_rgb = _mono_to_jet_rgb(heatmap_01)

    overlay = (
        0.6 * resized_rgb.astype(np.float32) + 0.4 * heatmap_rgb.astype(np.float32)
    ).clip(0, 255).astype(np.uint8)

    return {
        "heatmap": _np_to_png_base64(heatmap_rgb),
        "overlay": _np_to_png_base64(overlay),
        "target_layer_name": target_layer_name,
        "target_class_index": int(class_index),
    }


def build_occlusion_artifacts(
    model: tf.keras.Model,
    resized_rgb: np.ndarray,
    baseline_probs: np.ndarray,
    target_class_index: int,
    patch_size: int = 32,
    stride: int = 32,
    max_evals: int = 64,
) -> dict[str, Any]:
    h, w, _ = resized_rgb.shape

    y_points = list(range(0, h - patch_size + 1, stride))
    x_points = list(range(0, w - patch_size + 1, stride))

    if not y_points or not x_points:
        raise ValueError("Invalid patch_size/stride for image dimensions.")

    delta_grid = np.zeros((len(y_points), len(x_points)), dtype=np.float32)
    patch_records: list[dict[str, Any]] = []

    fill_color = np.mean(resized_rgb, axis=(0, 1), keepdims=True).astype(np.uint8)
    baseline_prob = float(baseline_probs[target_class_index])

    eval_count = 0
    stop_outer = False

    for yi, y in enumerate(y_points):
        for xi, x in enumerate(x_points):
            if eval_count >= max_evals:
                stop_outer = True
                break

            masked = resized_rgb.copy()
            masked[y : y + patch_size, x : x + patch_size, :] = fill_color

            batch = np.expand_dims(masked.astype(np.float32), axis=0)
            masked_preprocessed = tf.keras.applications.efficientnet.preprocess_input(batch)
            probs = model(masked_preprocessed, training=False).numpy()[0]

            new_prob = float(probs[target_class_index])
            delta = new_prob - baseline_prob
            drop = baseline_prob - new_prob

            delta_grid[yi, xi] = delta
            patch_records.append(
                {
                    "x": int(x),
                    "y": int(y),
                    "x2": int(x + patch_size),
                    "y2": int(y + patch_size),
                    "delta": float(delta),
                    "prob_drop": float(drop),
                }
            )
            eval_count += 1

        if stop_outer:
            break

    impact_grid = np.maximum(0.0, -delta_grid)
    if np.max(impact_grid) > 0:
        impact_grid = impact_grid / np.max(impact_grid)

    impact_resized = np.asarray(
        Image.fromarray((impact_grid * 255.0).astype(np.uint8)).resize((224, 224), Image.BILINEAR),
        dtype=np.float32,
    ) / 255.0
    delta_map_rgb = _mono_to_jet_rgb(impact_resized)

    top_regions = sorted(
        [item for item in patch_records if item["prob_drop"] > 0],
        key=lambda item: item["prob_drop"],
        reverse=True,
    )[:3]

    for i, region in enumerate(top_regions, start=1):
        region["rank"] = i

    return {
        "delta_map": _np_to_png_base64(delta_map_rgb),
        "patch_size": patch_size,
        "stride": stride,
        "evaluated_patches": eval_count,
        "top_regions": top_regions,
    }
