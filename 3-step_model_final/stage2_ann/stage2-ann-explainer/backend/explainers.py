from __future__ import annotations

from typing import Any, Dict, List

import numpy as np

from engine_loader import build_branch_probe


class Stage2Explainer:
    def __init__(self, models, preprocessor) -> None:
        self.models = models
        self.model = models[0]
        self.preprocessor = preprocessor
        self.branch_probe, self.branch_aliases, self.missing_layers = build_branch_probe(self.model)

    @staticmethod
    def _map_binary_to_demo_probs(p_ad: float) -> List[float]:
        p_ad = float(np.clip(p_ad, 0.0, 1.0))
        p_mci = float(1.0 - p_ad)

        mci_low = 0.0
        mci_mid = 0.0
        mci_high = 0.0

        # ann_model_val.ipynb의 risk tag 규칙:
        # p < 0.30: Low, p < 0.65: Mid, else High
        if p_ad < 0.30:
            mci_low = p_mci
        elif p_ad < 0.65:
            mci_mid = p_mci
        else:
            mci_high = p_mci

        # [CN, MCI_Low, MCI_Mid, MCI_High, AD]
        return [0.0, mci_low, mci_mid, mci_high, p_ad]

    def predict_ad_prob(self, split_inputs: List[np.ndarray]) -> float:
        probs: List[float] = []
        for model in self.models:
            out = model.predict(split_inputs, verbose=0)
            p_ad = float(np.asarray(out).reshape(-1)[0])
            probs.append(p_ad)
        return float(np.mean(probs))

    def predict_probs(self, split_inputs: List[np.ndarray]) -> List[float]:
        p_ad = self.predict_ad_prob(split_inputs)
        return self._map_binary_to_demo_probs(p_ad)

    def _perturb_value(self, feature: str, value: float, mmse_direction: str = "down") -> float:
        if feature in self.preprocessor.binary_cols:
            return float(1.0 - (1.0 if value >= 0.5 else 0.0))

        if feature == "entry_age":
            return float(value + 2.0)
        if feature == "VSBPSYS":
            return float(value + 5.0)
        if feature == "CDRSB":
            return float(value + 0.5)
        if feature == "MMSCORE":
            return float(value - 1.0 if mmse_direction == "down" else value + 1.0)
        if feature == "FAQTOTAL":
            return float(value + 1.0)
        if feature == "LDELTOTAL":
            return float(value - 1.0)

        if feature == "FAQ_LDELTA_ratio":
            return float(value + 0.5)
        if feature == "CDRSB_MMSE_ratio":
            return float(value + 0.05)
        if feature == "high_risk_score":
            return float(value + 2.0)
        if feature == "cog_composite":
            return float(value - 2.0)
        if feature == "med_cog_risk":
            return float(value + 1.0)

        return float(value + 1.0)

    def local_sensitivity(
        self,
        filled_values: Dict[str, float],
        target_mode: str,
        mmse_direction: str,
        base_probs: List[float],
        predicted_idx: int,
    ) -> Dict[str, Any]:
        target_idx = predicted_idx if target_mode == "pred" else 3

        base_merged, _, _ = self.preprocessor.assemble_vector(filled_values)
        rows: List[Dict[str, Any]] = []
        for feat in [*self.preprocessor.base_feats, *self.preprocessor.eng_feats]:
            base_val = float(base_merged[feat])
            new_val = self._perturb_value(feat, base_val, mmse_direction=mmse_direction)

            if feat in self.preprocessor.base_feats:
                perturbed_vals = dict(filled_values)
                perturbed_vals[feat] = float(new_val)
                perturbed_merged, _, _ = self.preprocessor.assemble_vector(perturbed_vals)
            else:
                perturbed_merged = dict(base_merged)
                perturbed_merged[feat] = float(new_val)

            row = np.array(
                [[float(perturbed_merged[c]) for c in self.preprocessor.all_feats]],
                dtype=np.float32,
            )
            scaled, _, _ = self.preprocessor.scale_row(row)
            split_inputs, _ = self.preprocessor.split_scaled(scaled)
            p1 = self.predict_probs(split_inputs)

            rows.append(
                {
                    "feature": feat,
                    "base": base_val,
                    "perturbed": float(new_val),
                    "delta": float(new_val - base_val),
                    "prob_delta_target": float(p1[target_idx] - base_probs[target_idx]),
                    "prob_delta_mci_high": float(p1[3] - base_probs[3]),
                }
            )

        rows_sorted = sorted(rows, key=lambda x: abs(x["prob_delta_target"]), reverse=True)
        top10 = rows_sorted[:10]

        note = (
            "Local sensitivity based on one-feature perturbation around current input. "
            "This indicates nearby model responsiveness, not causal effect."
        )

        return {
            "target_class": self.preprocessor.LABEL_NAMES[int(target_idx)],
            "target_idx": int(target_idx),
            "top10": top10,
            "all": rows_sorted,
            "method_note": note,
        }

    def branch_summary(self, split_inputs: List[np.ndarray]) -> Dict[str, Any] | None:
        if self.branch_probe is None:
            return None

        raw_out = self.branch_probe.predict(split_inputs, verbose=0)
        if not isinstance(raw_out, list):
            raw_out = [raw_out]

        summary: Dict[str, Dict[str, float | int]] = {}
        for alias, vec in zip(self.branch_aliases, raw_out):
            arr = np.asarray(vec)[0]
            summary[alias] = {
                "dim": int(arr.shape[-1]) if arr.ndim > 0 else 1,
                "l2_norm": float(np.linalg.norm(arr)),
                "mean": float(np.mean(arr)),
                "std": float(np.std(arr)),
            }

        branch_keys = [k for k in ["Health", "Cog", "Bio", "Eng"] if k in summary]
        dominant = None
        if branch_keys:
            dominant = max(branch_keys, key=lambda k: summary[k]["l2_norm"])

        note = None
        if dominant is not None:
            note = f"{dominant} branch shows the strongest activation norm for this case."

        return {
            "summary": summary,
            "dominant_branch": dominant,
            "note": note,
            "missing_layers": self.missing_layers,
        }
