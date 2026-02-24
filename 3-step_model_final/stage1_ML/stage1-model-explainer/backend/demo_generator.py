from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Tuple

import numpy as np
import pandas as pd

from engine_loader import THRESHOLDS, normalize_bounds

CSV_COLUMNS = [
    "PTID",
    "label",
    "target",
    "DIAGNOSIS_str",
    "DM_Probability",
    "Predicted_Label",
    "Interest_Category",
]

DEFAULT_MIX: Dict[str, int] = {"CN": 40, "MCI": 35, "DM": 25}
LABEL_TO_TARGET = {"CN": 0, "MCI": 1, "DM": 2}
EXPORT_FILENAME = "stage1_demo_scored.csv"

RISK_POSITIVE_FEATURES = {"entry_age", "VSBPSYS", "BMI"}
RISK_NEGATIVE_FEATURES = {
    "CIST_ORIENT",
    "CIST_ATTENTION",
    "CIST_EXEC",
    "CIST_MEMORY",
    "CIST_LANGUAGE",
    "PTEDUCAT",
}
INTEGER_FEATURES = {
    "CIST_ORIENT",
    "CIST_ATTENTION",
    "CIST_EXEC",
    "CIST_MEMORY",
    "CIST_LANGUAGE",
    "entry_age",
    "PTEDUCAT",
    "VSBPSYS",
    "PTGENDER_num",
}


@dataclass
class ScoreResult:
    ordered: Dict[str, Optional[float]]
    clipped: Dict[str, Optional[float]]
    clipping_delta: Dict[str, Dict[str, float]]
    imputed: Dict[str, float]
    scaled: Dict[str, float]
    prob: float
    estimator_breakdown: Dict[str, Any]


def _safe_round(value: Optional[float], ndigits: int = 6) -> Optional[float]:
    if value is None:
        return None
    return round(float(value), ndigits)


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


def _label_from_probability(probability: float, thresholds: Dict[str, float]) -> str:
    if probability >= thresholds["high"]:
        return "DM"
    if probability >= thresholds["low"]:
        return "MCI"
    return "CN"


def _interest_from_probability(probability: float, thresholds: Dict[str, float]) -> str:
    if probability >= thresholds["high"]:
        return "High_Interest"
    if probability >= thresholds["low"]:
        return "Medium_Interest"
    return "Low_Interest"


def _mci_like_probability(probability: float, thresholds: Dict[str, float]) -> float:
    """
    Stage1 model is binary(DM probability), so MCI probability is a helper metric.
    It is derived by distance to the MCI band [low, high].
    """
    low = thresholds["low"]
    high = thresholds["high"]
    mid = (low + high) / 2.0
    half = max((high - low) / 2.0, 1e-6)

    if low <= probability < high:
        return float(np.clip(1.0 - abs(probability - mid) / half, 0.0, 1.0))

    if probability < low:
        return float(np.clip((probability / max(low, 1e-6)) * 0.5, 0.0, 1.0))

    return float(np.clip(((1.0 - probability) / max(1.0 - high, 1e-6)) * 0.5, 0.0, 1.0))


def _priority_from_probabilities(dm_probability: float, mci_probability: float) -> Tuple[float, str]:
    """
    Priority score combines DM and MCI probability.
    DM gets higher weight because immediate intervention is more critical.
    """
    score = float(np.clip(dm_probability * 0.75 + mci_probability * 0.25, 0.0, 1.0)) * 100.0

    if score >= 70.0:
        tier = "High_Interest"
    elif score >= 45.0:
        tier = "Medium_Interest"
    else:
        tier = "Low_Interest"

    return round(score, 2), tier


def _bucket_distance(probability: float, bucket: str, thresholds: Dict[str, float]) -> float:
    low = thresholds["low"]
    high = thresholds["high"]

    if bucket == "CN":
        return 0.0 if probability < low else abs(probability - low)
    if bucket == "MCI":
        if low <= probability < high:
            return 0.0
        return min(abs(probability - low), abs(probability - high))
    if bucket == "DM":
        return 0.0 if probability >= high else abs(probability - high)
    return 1.0


def _normalize_mix(n: int, target_mix: Optional[Dict[str, int]]) -> Dict[str, int]:
    raw = {"CN": 0, "MCI": 0, "DM": 0}

    if target_mix is None:
        target_mix = dict(DEFAULT_MIX)

    for key in raw:
        raw[key] = max(int(target_mix.get(key, 0)), 0)

    total = sum(raw.values())
    if total == n:
        return raw

    if total <= 0:
        raw = dict(DEFAULT_MIX)
        total = sum(raw.values())

    if total == n:
        return raw

    scaled: Dict[str, int] = {}
    fractions: List[Tuple[float, str]] = []
    assigned = 0
    for key, value in raw.items():
        exact = (value / total) * n
        base = int(np.floor(exact))
        scaled[key] = base
        assigned += base
        fractions.append((exact - base, key))

    remainder = n - assigned
    for _, key in sorted(fractions, reverse=True):
        if remainder <= 0:
            break
        scaled[key] += 1
        remainder -= 1

    return scaled


def _sample_value_in_bounds(
    feature: str,
    low: float,
    high: float,
    profile: str,
    rng: np.random.Generator,
) -> float:
    if feature == "PTGENDER_num":
        if profile == "DM":
            return float(rng.choice([1, 2], p=[0.6, 0.4]))
        if profile == "CN":
            return float(rng.choice([1, 2], p=[0.5, 0.5]))
        return float(rng.choice([1, 2], p=[0.55, 0.45]))

    if high <= low:
        return float(low)

    span = high - low

    if feature in RISK_NEGATIVE_FEATURES:
        if profile == "CN":
            mode = high - 0.12 * span
        elif profile == "DM":
            mode = low + 0.2 * span
        else:
            mode = low + 0.5 * span
        sampled = rng.triangular(low, mode, high)
    elif feature in RISK_POSITIVE_FEATURES:
        if profile == "CN":
            mode = low + 0.18 * span
        elif profile == "DM":
            mode = high - 0.12 * span
        else:
            mode = low + 0.55 * span
        sampled = rng.triangular(low, mode, high)
    else:
        if profile == "CN":
            sampled = rng.uniform(low, low + span * 0.45)
        elif profile == "DM":
            sampled = rng.uniform(low + span * 0.45, high)
        else:
            sampled = rng.uniform(low + span * 0.25, low + span * 0.75)

    return float(sampled)


def _cast_feature_value(feature: str, value: float) -> float:
    if feature in INTEGER_FEATURES:
        return float(int(round(value)))
    if feature == "BMI":
        return float(round(value, 1))
    return float(round(value, 4))


def generate_one_sample(engine: Dict[str, Any], strategy: Dict[str, Any]) -> Dict[str, Optional[float]]:
    features = [str(col) for col in engine["features"]]
    bounds = normalize_bounds(engine["bounds"])

    rng: np.random.Generator = strategy.get("rng") or np.random.default_rng(strategy.get("seed", 42))
    profile = str(strategy.get("profile", "MCI"))
    include_clipping_case = bool(strategy.get("include_clipping_case", False))
    include_missing_ratio = float(strategy.get("include_missing_ratio", 0.0))

    values: Dict[str, Optional[float]] = {}

    for feature in features:
        if feature == "PTGENDER_num":
            sampled = _sample_value_in_bounds(feature, 1.0, 2.0, profile, rng)
            values[feature] = _cast_feature_value(feature, sampled)
            continue

        if feature in bounds:
            low, high = bounds[feature]
            sampled = _sample_value_in_bounds(feature, low, high, profile, rng)
            values[feature] = _cast_feature_value(feature, sampled)
        else:
            values[feature] = float(round(rng.normal(0.0, 1.0), 4))

    if include_clipping_case and bounds:
        clip_features = list(bounds.keys())
        rng.shuffle(clip_features)
        clip_count = int(max(1, min(3, round(len(clip_features) * 0.2))))
        for feature in clip_features[:clip_count]:
            low, high = bounds[feature]
            span = max(high - low, 1.0)
            overflow = span * float(rng.uniform(0.05, 0.25))
            if rng.random() < 0.5:
                injected = low - overflow
            else:
                injected = high + overflow
            values[feature] = _cast_feature_value(feature, injected)

    if include_missing_ratio > 0:
        for feature in features:
            if rng.random() < include_missing_ratio:
                values[feature] = None

    return values


def score_one(engine: Dict[str, Any], values: Dict[str, Optional[float]]) -> Dict[str, Any]:
    feature_order = [str(col) for col in engine["features"]]
    bounds = normalize_bounds(engine["bounds"])

    raw_df = pd.DataFrame(
        [{feature: values.get(feature, None) for feature in feature_order}],
        columns=feature_order,
    )
    ordered_df = raw_df.reindex(columns=feature_order)
    ordered_df = ordered_df.apply(pd.to_numeric, errors="coerce")

    ordered = {
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

    clipped = {
        feature: _safe_round(None if pd.isna(clipped_df.at[0, feature]) else clipped_df.at[0, feature])
        for feature in feature_order
    }

    X_imp = np.array(engine["imputer"].transform(clipped_df), dtype=float)
    X_sc = np.array(engine["scaler"].transform(X_imp), dtype=float)

    imputed: Dict[str, float] = {}
    for idx, feature in enumerate(feature_order):
        if pd.isna(clipped_df.at[0, feature]):
            imputed[feature] = _safe_round(float(X_imp[0, idx])) or float(X_imp[0, idx])

    scaled = {
        feature: _safe_round(float(X_sc[0, idx]))
        for idx, feature in enumerate(feature_order)
    }

    prob = float(engine["model"].predict_proba(X_sc)[0, 1])
    estimator_probs, weights = _extract_estimator_probabilities(engine["model"], X_sc)

    rf_proba = _pick_estimator_prob(estimator_probs, ["rf", "forest", "random"])
    hgb_proba = _pick_estimator_prob(estimator_probs, ["hgb", "hist", "gradient"])
    if rf_proba is None and len(estimator_probs) >= 1:
        rf_proba = list(estimator_probs.values())[0]
    if hgb_proba is None and len(estimator_probs) >= 2:
        hgb_proba = list(estimator_probs.values())[1]

    estimator_breakdown = {
        "rf_proba": _safe_round(rf_proba),
        "hgb_proba": _safe_round(hgb_proba),
        "ensemble_proba": _safe_round(prob),
        "weights": weights,
        "estimators": {name: _safe_round(value) for name, value in estimator_probs.items()},
    }

    return ScoreResult(
        ordered=ordered,
        clipped=clipped,
        clipping_delta=clipping_delta,
        imputed=imputed,
        scaled=scaled,
        prob=prob,
        estimator_breakdown=estimator_breakdown,
    ).__dict__


def generate_scored_dataset(
    engine: Dict[str, Any],
    n: int = 100,
    target_mix: Optional[Dict[str, int]] = None,
    seed: int = 42,
    include_clipping_cases_ratio: float = 0.10,
    include_missing_ratio: float = 0.0,
    max_attempts: int = 5000,
) -> pd.DataFrame:
    rng = np.random.default_rng(seed)
    n = max(int(n), 1)
    desired_mix = _normalize_mix(n=n, target_mix=target_mix)

    accepted: List[Tuple[Dict[str, Optional[float]], Dict[str, Any]]] = []
    bucket_counts = {"CN": 0, "MCI": 0, "DM": 0}
    warnings: List[str] = []

    attempts = 0
    while attempts < max_attempts and len(accepted) < n:
        remaining = {bucket: max(desired_mix[bucket] - bucket_counts[bucket], 0) for bucket in desired_mix}
        if sum(remaining.values()) == 0:
            break

        order = ["CN", "MCI", "DM"]
        weights = np.array([remaining[bucket] for bucket in order], dtype=float)
        weights = weights / np.sum(weights)
        target_bucket = str(rng.choice(order, p=weights))

        sample = generate_one_sample(
            engine,
            {
                "rng": rng,
                "profile": target_bucket,
                "include_clipping_case": bool(rng.random() < include_clipping_cases_ratio),
                "include_missing_ratio": include_missing_ratio,
            },
        )
        scored = score_one(engine, sample)
        bucket = _label_from_probability(float(scored["prob"]), THRESHOLDS)

        attempts += 1
        if bucket_counts[bucket] < desired_mix[bucket]:
            accepted.append((sample, scored))
            bucket_counts[bucket] += 1

    if len(accepted) < n:
        warnings.append(
            "Target mix was not fully satisfied within max_attempts. Remaining samples were filled by nearest probability bucket."
        )

        for target_bucket in ["CN", "MCI", "DM"]:
            while bucket_counts[target_bucket] < desired_mix[target_bucket] and len(accepted) < n:
                best_candidate: Optional[Tuple[float, Dict[str, Optional[float]], Dict[str, Any]]] = None

                for _ in range(60):
                    sample = generate_one_sample(
                        engine,
                        {
                            "rng": rng,
                            "profile": target_bucket,
                            "include_clipping_case": bool(rng.random() < include_clipping_cases_ratio),
                            "include_missing_ratio": include_missing_ratio,
                        },
                    )
                    scored = score_one(engine, sample)
                    distance = _bucket_distance(float(scored["prob"]), target_bucket, THRESHOLDS)
                    if best_candidate is None or distance < best_candidate[0]:
                        best_candidate = (distance, sample, scored)

                if best_candidate is None:
                    break

                _, sample, scored = best_candidate
                accepted.append((sample, scored))
                actual_bucket = _label_from_probability(float(scored["prob"]), THRESHOLDS)
                bucket_counts[actual_bucket] += 1

    while len(accepted) < n:
        sample = generate_one_sample(
            engine,
            {
                "rng": rng,
                "profile": "MCI",
                "include_clipping_case": bool(rng.random() < include_clipping_cases_ratio),
                "include_missing_ratio": include_missing_ratio,
            },
        )
        scored = score_one(engine, sample)
        accepted.append((sample, scored))
        bucket = _label_from_probability(float(scored["prob"]), THRESHOLDS)
        bucket_counts[bucket] += 1

    rows: List[Dict[str, Any]] = []
    clipping_case_count = 0
    feature_order = [str(col) for col in engine["features"]]

    for idx, (sample, scored) in enumerate(accepted[:n], start=1):
        probability = float(scored["prob"])
        mci_probability = _mci_like_probability(probability, THRESHOLDS)
        priority_score, priority_tier = _priority_from_probabilities(
            dm_probability=probability,
            mci_probability=mci_probability,
        )
        label = _label_from_probability(probability, THRESHOLDS)
        predicted_label = _label_from_probability(probability, THRESHOLDS)
        interest = priority_tier

        if scored.get("clipping_delta"):
            clipping_case_count += 1

        row: Dict[str, Any] = {
            "PTID": f"NS-DEMO-{idx:04d}",
            "label": label,
            "target": LABEL_TO_TARGET[label],
            "DIAGNOSIS_str": label,
            "DM_Probability": round(probability, 6),
            "Predicted_Label": predicted_label,
            "Interest_Category": interest,
        }

        # Include input values shown on UI cards (image fields) for traceability.
        for feature in feature_order:
            row[feature] = sample.get(feature)

        row["PTGENDER_str"] = "Male" if int(round(float(sample.get("PTGENDER_num", 1.0)))) == 1 else "Female"
        row["MCI_Probability"] = round(mci_probability, 6)
        row["Priority_Score"] = priority_score
        row["Priority_Tier"] = priority_tier
        row["CLIPPING_APPLIED"] = bool(scored.get("clipping_delta"))

        rows.append(row)

    ordered_columns = (
        CSV_COLUMNS
        + feature_order
        + ["PTGENDER_str", "MCI_Probability", "Priority_Score", "Priority_Tier", "CLIPPING_APPLIED"]
    )
    df = pd.DataFrame(rows, columns=ordered_columns)

    prob_series = df["DM_Probability"].astype(float)
    mci_series = df["MCI_Probability"].astype(float)
    summary = {
        "n": int(len(df)),
        "bucket_counts": {
            "CN": int((df["label"] == "CN").sum()),
            "MCI": int((df["label"] == "MCI").sum()),
            "DM": int((df["label"] == "DM").sum()),
        },
        "prob_min": round(float(prob_series.min()), 6),
        "prob_max": round(float(prob_series.max()), 6),
        "prob_mean": round(float(prob_series.mean()), 6),
        "mci_mean": round(float(mci_series.mean()), 6),
        "priority_counts": {
            "High_Interest": int((df["Priority_Tier"] == "High_Interest").sum()),
            "Medium_Interest": int((df["Priority_Tier"] == "Medium_Interest").sum()),
            "Low_Interest": int((df["Priority_Tier"] == "Low_Interest").sum()),
        },
        "requested_mix": desired_mix,
        "seed": int(seed),
        "attempts": int(attempts),
        "actual_clipping_cases": int(clipping_case_count),
        "warnings": warnings,
    }

    df.attrs["summary"] = summary
    return df
