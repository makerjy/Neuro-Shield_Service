from __future__ import annotations

import pickle
from pathlib import Path
from typing import Any, Dict, List, Tuple

import numpy as np
import pandas as pd
from sklearn.preprocessing import StandardScaler


class Stage2Preprocessor:
    MISS_THR = 50.0

    # ann_model_val.ipynb / run_preprocessing() 기준 고정 순서
    BASE_FEATURES = [
        "entry_age",
        "PTGENDER",
        "MH10GAST",
        "MH11HEMA",
        "MH12RENA",
        "MH13ALLE",
        "MH14ALCH",
        "MH15DRUG",
        "MH16SMOK",
        "MH17MALI",
        "MH18SURG",
        "MH19OTHR",
        "MH2NEURL",
        "MH3HEAD",
        "MH4CARD",
        "MH5RESP",
        "MH6HEPAT",
        "MH7DERM",
        "MH8MUSCL",
        "MH9ENDO",
        "MHPSYCH",
        "COG_DISORDER",
        "dementia_med",
        "antidepressant_med",
        "CDRSB",
        "MMSCORE",
        "FAQTOTAL",
        "LDELTOTAL",
        "VSBPSYS",
    ]

    COG_COLS = ["CDRSB", "MMSCORE", "FAQTOTAL", "LDELTOTAL"]
    ENG_FEATS = [
        "FAQ_LDELTA_ratio",
        "high_risk_score",
        "med_cog_risk",
        "CDRSB_MMSE_ratio",
        "cog_composite",
    ]

    REQUIRED_FIELDS = [
        "entry_age",
        "PTGENDER",
        "VSBPSYS",
        "CDRSB",
        "MMSCORE",
        "FAQTOTAL",
        "LDELTOTAL",
    ]

    LABEL_NAMES = {
        0: "CN",
        1: "MCI_Low",
        2: "MCI_Mid",
        3: "MCI_High",
        4: "AD",
    }

    ENGINEERING_FORMULAS = {
        "FAQ_LDELTA_ratio": "FAQTOTAL / (LDELTOTAL + 1)",
        "high_risk_score": "CDRSB*2 + FAQTOTAL - LDELTOTAL",
        "med_cog_risk": "dementia_med + COG_DISORDER",
        "CDRSB_MMSE_ratio": "CDRSB / (MMSCORE + 1)",
        "cog_composite": "MMSCORE - CDRSB*2 - FAQTOTAL*0.5",
    }

    CDRSB_THRESHOLDS = {
        "MCI_Low_max": 0.5,
        "MCI_Mid_max": 2.0,
        "AD_high_risk_threshold": 0.65,
        "MCI_mid_threshold": 0.30,
    }

    OPERATIONAL_BUCKET_RULES = {
        "Low": "MCI 저위험군: 관찰/재평가",
        "Medium": "MCI 중간위험군: 추가검사/재연락",
        "High": "MCI 고위험/AD: Stage3 추적관리 우선",
    }

    def __init__(self, csv_path: str, scaler_path: str | None = None) -> None:
        self.csv_path = Path(csv_path)
        if not self.csv_path.exists():
            raise FileNotFoundError(f"csv_not_found: {self.csv_path}")

        self.df = pd.read_csv(self.csv_path)
        if "subject_id" in self.df.columns and "visit_order" in self.df.columns:
            self.df = self.df.sort_values(["subject_id", "visit_order"]).reset_index(drop=True)

        self._drop_sparse_columns()
        self._build_feature_groups()

        self.reference_df = self._build_reference_dataframe()
        self.group_medians = self._build_group_median_lookup(self.reference_df)
        self.global_medians = self.reference_df[self.base_feats].median(numeric_only=True).to_dict()

        self.scaler, self.scaler_source = self._load_or_fit_scaler(scaler_path)

        self.samples, self.sample_lookup = self._build_samples(per_class=12)

    def _drop_sparse_columns(self) -> None:
        meta_cols = {
            "subject_id",
            "DIAGNOSIS",
            "label",
            "label_name",
            "visit",
            "Image.Data.ID",
            "visit_order",
            "mmse_change",
            "cdrsb_change",
        }
        missing_pct = self.df.isnull().mean() * 100
        drop_cols = [
            col
            for col in missing_pct[missing_pct >= self.MISS_THR].index.tolist()
            if col not in meta_cols and col not in self.BASE_FEATURES
        ]
        if drop_cols:
            self.df = self.df.drop(columns=drop_cols)

    def _build_feature_groups(self) -> None:
        for col in self.BASE_FEATURES:
            if col not in self.df.columns:
                self.df[col] = np.nan

        self.mh_cols = [c for c in self.BASE_FEATURES if c.startswith("MH")]
        self.health_cols = [c for c in self.BASE_FEATURES if c not in self.COG_COLS]
        self.cog_cols = list(self.COG_COLS)
        self.bio_cols: List[str] = []

        self.base_feats = self.health_cols + self.cog_cols
        self.eng_feats = list(self.ENG_FEATS)
        self.all_feats = self.health_cols + self.cog_cols + self.eng_feats

        self.binary_cols = [
            c for c in [*self.mh_cols, "COG_DISORDER", "dementia_med", "antidepressant_med"] if c in self.base_feats
        ]

        for col in self.base_feats:
            self.df[col] = pd.to_numeric(self.df[col], errors="coerce")

    @staticmethod
    def _safe_label_name(row: pd.Series) -> str:
        raw = row.get("label_name")
        if raw is None:
            return ""
        return str(raw).strip().upper()

    def make_risk_label(self, row: pd.Series) -> int:
        lab = row.get("label")
        name = self._safe_label_name(row)

        if lab == 0 or name == "CN":
            return 0
        if lab == 2 or name in {"AD", "DM", "DEMENTIA"}:
            return 4

        # MCI를 CDRSB로 세분화
        if lab == 1 or name == "MCI":
            s = row.get("CDRSB")
            if pd.isna(s):
                return 2
            if s <= 0.5:
                return 1
            if s <= 2.0:
                return 2
            return 3

        try:
            as_int = int(lab)
            if as_int in self.LABEL_NAMES:
                return as_int
        except Exception:  # noqa: BLE001
            pass

        return 2

    def _build_reference_dataframe(self) -> pd.DataFrame:
        ref = self.df.copy()

        if "subject_id" in ref.columns:
            ref[self.base_feats] = ref.groupby("subject_id")[self.base_feats].ffill()

        ref["age_group"] = (ref["entry_age"] // 10) * 10
        for col in self.base_feats:
            ref[col] = ref.groupby(["age_group", "PTGENDER"], dropna=False)[col].transform(
                lambda x: x.fillna(x.median())
            )

        ref[self.base_feats] = ref[self.base_feats].fillna(ref[self.base_feats].median(numeric_only=True))

        eng_df = self.compute_engineered_features_df(ref)
        for feat in self.eng_feats:
            ref[feat] = eng_df[feat]

        ref["risk_label"] = ref.apply(self.make_risk_label, axis=1)

        return ref

    @staticmethod
    def _group_key(age: float | None, gender: float | None) -> Tuple[int, int] | None:
        if age is None or gender is None:
            return None
        if pd.isna(age) or pd.isna(gender):
            return None
        g = 1 if float(gender) < 1.5 else 2
        return int(age // 10 * 10), g

    def _build_group_median_lookup(self, ref_df: pd.DataFrame) -> Dict[Tuple[int, int], Dict[str, float]]:
        grouped = ref_df.groupby(["age_group", "PTGENDER"], dropna=False)[self.base_feats].median(numeric_only=True)
        lookup: Dict[Tuple[int, int], Dict[str, float]] = {}
        for (age_group, gender), row in grouped.iterrows():
            if pd.isna(age_group) or pd.isna(gender):
                continue
            g = 1 if float(gender) < 1.5 else 2
            lookup[(int(age_group), g)] = {k: float(v) for k, v in row.to_dict().items() if not pd.isna(v)}
        return lookup

    def _load_or_fit_scaler(self, scaler_path: str | None) -> Tuple[StandardScaler, str]:
        if scaler_path:
            p = Path(scaler_path)
            if p.exists():
                with open(p, "rb") as f:
                    scaler = pickle.load(f)
                if hasattr(scaler, "transform"):
                    return scaler, p.name

        scaler = StandardScaler()
        scaler.fit(self.reference_df[self.all_feats].values.astype(np.float32))
        return scaler, "csv_refit"

    @staticmethod
    def _is_missing(v: Any) -> bool:
        if v is None:
            return True
        try:
            return bool(pd.isna(v))
        except Exception:  # noqa: BLE001
            return False

    def parse_input_values(self, values: Dict[str, Any]) -> Dict[str, float | None]:
        out: Dict[str, float | None] = {}
        for col in self.base_feats:
            raw = values.get(col, None)
            if raw is None or raw == "":
                out[col] = None
            else:
                try:
                    out[col] = float(raw)
                except Exception as exc:  # noqa: BLE001
                    raise ValueError(f"invalid_numeric_value: {col}={raw}") from exc
        return out

    def find_missing_required(self, parsed: Dict[str, float | None]) -> List[str]:
        return [col for col in self.REQUIRED_FIELDS if self._is_missing(parsed.get(col))]

    def _impute_single(self, col: str, age: float | None, gender: float | None) -> Tuple[float, str]:
        key = self._group_key(age, gender)
        if key is not None:
            row = self.group_medians.get(key, {})
            val = row.get(col)
            if val is not None and not pd.isna(val):
                return float(val), "group_median"

        fallback = self.global_medians.get(col)
        if fallback is not None and not pd.isna(fallback):
            return float(fallback), "global_median"

        return 0.0, "zero_fallback"

    def impute_values(self, parsed: Dict[str, float | None]) -> Tuple[Dict[str, float], Dict[str, Dict[str, Any]]]:
        filled = {k: v for k, v in parsed.items()}
        imputed_map: Dict[str, Dict[str, Any]] = {}

        priority = ["entry_age", "PTGENDER"] + [c for c in self.base_feats if c not in {"entry_age", "PTGENDER"}]

        for col in priority:
            if self._is_missing(filled.get(col)):
                age = filled.get("entry_age")
                gender = filled.get("PTGENDER")
                val, source = self._impute_single(col, age, gender)
                filled[col] = float(val)
                imputed_map[col] = {"value": float(val), "source": source}

        for bcol in self.binary_cols:
            v = float(filled[bcol])
            filled[bcol] = float(1 if v >= 0.5 else 0)

        if "PTGENDER" in filled:
            g = float(filled["PTGENDER"])
            filled["PTGENDER"] = 1.0 if g < 1.5 else 2.0

        return {k: float(v) for k, v in filled.items()}, imputed_map

    def compute_engineered_features(self, vals: Dict[str, float]) -> Dict[str, float]:
        faq = vals["FAQTOTAL"]
        ldel = vals["LDELTOTAL"]
        cdr = vals["CDRSB"]
        mmse = vals["MMSCORE"]
        dem_med = vals.get("dementia_med", 0.0)
        cog_dis = vals.get("COG_DISORDER", 0.0)

        return {
            "FAQ_LDELTA_ratio": float(faq / (ldel + 1.0)),
            "high_risk_score": float(cdr * 2.0 + faq - ldel),
            "med_cog_risk": float(dem_med + cog_dis),
            "CDRSB_MMSE_ratio": float(cdr / (mmse + 1.0)),
            "cog_composite": float(mmse - cdr * 2.0 - faq * 0.5),
        }

    def compute_engineered_features_df(self, frame: pd.DataFrame) -> pd.DataFrame:
        out = pd.DataFrame(index=frame.index)
        out["FAQ_LDELTA_ratio"] = frame["FAQTOTAL"] / (frame["LDELTOTAL"] + 1.0)
        out["high_risk_score"] = frame["CDRSB"] * 2.0 + frame["FAQTOTAL"] - frame["LDELTOTAL"]
        out["med_cog_risk"] = frame["dementia_med"] + frame["COG_DISORDER"]
        out["CDRSB_MMSE_ratio"] = frame["CDRSB"] / (frame["MMSCORE"] + 1.0)
        out["cog_composite"] = frame["MMSCORE"] - frame["CDRSB"] * 2.0 - frame["FAQTOTAL"] * 0.5
        return out

    def assemble_vector(self, filled: Dict[str, float]) -> Tuple[Dict[str, float], Dict[str, float], np.ndarray]:
        engineered = self.compute_engineered_features(filled)
        merged = {**filled, **engineered}
        row = np.array([[float(merged[col]) for col in self.all_feats]], dtype=np.float32)
        return merged, engineered, row

    def scale_row(self, row: np.ndarray) -> Tuple[np.ndarray, Dict[str, float], Dict[str, float]]:
        scaled = self.scaler.transform(row)
        preview = {feat: float(scaled[0, i]) for i, feat in enumerate(self.all_feats[:12])}
        stats = {
            "mean": float(np.mean(scaled[0])),
            "std": float(np.std(scaled[0])),
            "min": float(np.min(scaled[0])),
            "max": float(np.max(scaled[0])),
            "feature_count": int(scaled.shape[1]),
            "scaler_source": self.scaler_source,
        }
        return scaled, preview, stats

    def split_scaled(self, scaled: np.ndarray) -> Tuple[List[np.ndarray], Dict[str, int]]:
        h_dim = len(self.health_cols)
        c_dim = len(self.cog_cols)
        e_dim = len(self.eng_feats)

        h = scaled[:, :h_dim]
        c = scaled[:, h_dim : h_dim + c_dim]
        e = scaled[:, h_dim + c_dim : h_dim + c_dim + e_dim]

        return [h, c, e], {
            "health": h_dim,
            "cognitive": c_dim,
            "bio": 0,
            "engineering": e_dim,
        }

    def to_operational_bucket(self, pred_idx: int) -> Dict[str, str]:
        if pred_idx in (3, 4):
            key = "High"
        elif pred_idx in (1, 2):
            key = "Medium"
        else:
            key = "Low"

        return {
            "name": key,
            "description": self.OPERATIONAL_BUCKET_RULES[key],
        }

    @staticmethod
    def _to_json_value(v: Any) -> Any:
        if v is None:
            return None
        if isinstance(v, (np.floating, float)):
            if np.isnan(v):
                return None
            return float(v)
        if isinstance(v, (np.integer, int)):
            return int(v)
        return v

    def _build_samples(self, per_class: int = 12) -> Tuple[List[Dict[str, Any]], Dict[str, pd.Series]]:
        if "risk_label" not in self.reference_df.columns:
            return [], {}

        samples: List[Dict[str, Any]] = []
        lookup: Dict[str, pd.Series] = {}

        for risk_label in range(5):
            part = self.reference_df[self.reference_df["risk_label"] == risk_label]
            if part.empty:
                continue
            take_n = min(per_class, len(part))
            chosen = part.sample(n=take_n, random_state=42)

            for idx, row in chosen.iterrows():
                sample_id = f"sample-{risk_label}-{idx}"
                item = {
                    "id": sample_id,
                    "subject_id": self._to_json_value(row.get("subject_id")),
                    "DIAGNOSIS": self._to_json_value(row.get("DIAGNOSIS")),
                    "label": self._to_json_value(row.get("label")),
                    "risk_label": int(risk_label),
                    "risk_name": self.LABEL_NAMES[int(risk_label)],
                    "brief_features": {
                        "entry_age": self._to_json_value(row.get("entry_age")),
                        "CDRSB": self._to_json_value(row.get("CDRSB")),
                        "MMSCORE": self._to_json_value(row.get("MMSCORE")),
                        "FAQTOTAL": self._to_json_value(row.get("FAQTOTAL")),
                        "LDELTOTAL": self._to_json_value(row.get("LDELTOTAL")),
                        "VSBPSYS": self._to_json_value(row.get("VSBPSYS")),
                    },
                }
                samples.append(item)
                lookup[sample_id] = row

        samples.sort(key=lambda x: (x["risk_label"], str(x.get("subject_id"))))
        return samples, lookup

    def get_sample_values(self, sample_id: str) -> Dict[str, Any] | None:
        row = self.sample_lookup.get(sample_id)
        if row is None:
            return None

        return {
            "id": sample_id,
            "subject_id": self._to_json_value(row.get("subject_id")),
            "DIAGNOSIS": self._to_json_value(row.get("DIAGNOSIS")),
            "label": self._to_json_value(row.get("label")),
            "risk_label": self._to_json_value(row.get("risk_label")),
            "values": {col: self._to_json_value(row.get(col)) for col in self.base_feats},
        }

    def meta(self, model_branch_dims: Dict[str, int], model_version: str) -> Dict[str, Any]:
        return {
            "feature_groups": {
                "health": self.health_cols,
                "cog": self.cog_cols,
                "bio": self.bio_cols,
                "eng": self.eng_feats,
                "mh_cols": self.mh_cols,
            },
            "required_fields": self.REQUIRED_FIELDS,
            "label_names": self.LABEL_NAMES,
            "thresholds": {
                "cdrsb": self.CDRSB_THRESHOLDS,
                "operational_bucket": self.OPERATIONAL_BUCKET_RULES,
            },
            "engineering_formulas": self.ENGINEERING_FORMULAS,
            "model_info": {
                "version": model_version,
                "input_dim": len(self.all_feats),
                "branch_dim": model_branch_dims,
                "scaler_source": self.scaler_source,
                "architecture": "3-branch binary ANN ensemble (health25/cog4/eng5)",
            },
            "notes": {
                "label_mapping": "stage2_modelfinal binary(AD vs MCI) 결과를 데모용 5단 라벨(CN/MCI_Low/MCI_Mid/MCI_High/AD)로 투영합니다.",
            },
        }
