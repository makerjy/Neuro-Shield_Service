"""
utils.py
Alzheimer's Disease Pipeline — 전처리 · 모델 · 예측 유틸리티
=============================================================
[파이프라인 전체 흐름]
  MRI 이미지  → CNN (EfficientNetB3)  ─┐
                                        ├→ 앙상블 → MCI/AD 분류
  임상 데이터 → ANN (5-seed 앙상블)  ─┘
                    │
                    └── MCI 환자만 → RSF 생존 분석 → 개인별 전환 확률 (12/24/36/48개월)
"""

# ── 호환성 패치 (Python 3.10 + 최신 scipy 환경) ──────────────────────────────
import datetime
import scipy.integrate
if not hasattr(datetime, "UTC"):
    datetime.UTC = datetime.timezone.utc
if not hasattr(scipy.integrate, "trapz"):
    scipy.integrate.trapz = scipy.integrate.trapezoid

# ── 표준 임포트 ──────────────────────────────────────────────────────────────
import os
import pickle
import warnings
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
import matplotlib
matplotlib.use("Agg")           # 서버 환경(화면 없음)에서도 동작
import joblib
import tensorflow as tf
from tensorflow import keras
from sklearn.preprocessing import StandardScaler
from sklearn.experimental import enable_iterative_imputer  # noqa
from sklearn.impute import IterativeImputer

warnings.filterwarnings("ignore")
os.environ["TF_CPP_MIN_LOG_LEVEL"] = "3"


# ══════════════════════════════════════════════════════════════════════════════
# 1. 상수 / 피처 정의
# ══════════════════════════════════════════════════════════════════════════════

IMG_SIZE = (224, 224)
CNN_WEIGHT = 0.4        # 앙상블 가중치: CNN
ANN_WEIGHT = 0.6        # 앙상블 가중치: ANN
CNN_AD_IDX = 1          # CNN 출력 클래스 순서: 0=CN, 1=DM(AD), 2=MCI

MH_COLS = [
    "MH10GAST", "MH11HEMA", "MH12RENA", "MH13ALLE", "MH14ALCH", "MH15DRUG",
    "MH16SMOK", "MH17MALI", "MH18SURG", "MH19OTHR", "MH2NEURL", "MH3HEAD",
    "MH4CARD",  "MH5RESP",  "MH6HEPAT", "MH7DERM",  "MH8MUSCL", "MH9ENDO",
    "MHPSYCH",
]

# MICE 임퓨터가 사용하는 베이스 피처 (순서 고정)
BASE_FEATS = [
    "entry_age", "PTGENDER",
    "MH10GAST", "MH11HEMA", "MH12RENA", "MH13ALLE", "MH14ALCH", "MH15DRUG",
    "MH16SMOK", "MH17MALI", "MH18SURG", "MH19OTHR", "MH2NEURL", "MH3HEAD",
    "MH4CARD",  "MH5RESP",  "MH6HEPAT", "MH7DERM",  "MH8MUSCL", "MH9ENDO",
    "MHPSYCH",  "COG_DISORDER", "dementia_med", "antidepressant_med",
    "CDRSB", "MMSCORE", "FAQTOTAL", "LDELTOTAL", "VSBPSYS",
]

COG_COLS    = ["CDRSB", "MMSCORE", "FAQTOTAL", "LDELTOTAL"]
ENG_FEATS   = ["FAQ_LDELTA_ratio", "high_risk_score", "med_cog_risk",
               "CDRSB_MMSE_ratio", "cog_composite"]
HEALTH_COLS = [c for c in BASE_FEATS if c not in COG_COLS]   # 25개
ALL_FEATS   = HEALTH_COLS + COG_COLS + ENG_FEATS              # 34개
H_DIM, C_DIM, E_DIM = len(HEALTH_COLS), len(COG_COLS), len(ENG_FEATS)

# RSF 피처 (생존 분석용)
RSF_FEATS = [
    "entry_age", "APOE4_Count",
    "mmse_baseline", "cdrsb_baseline",
    "mmse_slope",    "cdrsb_slope",
    "mmse_std",      "cdrsb_std",
    "mmse_total_change", "cdrsb_total_change",
]


# ══════════════════════════════════════════════════════════════════════════════
# 2. 모델 로딩
# ══════════════════════════════════════════════════════════════════════════════

def build_cnn(weights_path: str) -> keras.Model:
    """
    EfficientNetB3 기반 CNN 재건 + 가중치 로드.
    Sequential 역직렬화 버그를 우회하기 위해 Functional API로 수동 재건.
    출력: softmax(3) — 0:CN, 1:DM(AD), 2:MCI
    """
    inputs  = keras.Input(shape=(*IMG_SIZE, 3))
    base    = keras.applications.EfficientNetB3(
        include_top=False, weights=None, pooling="max"
    )
    x = base(inputs)
    x = keras.layers.BatchNormalization(
        axis=-1, momentum=0.99, epsilon=0.0001, name="batch_normalization_2"
    )(x)
    x = keras.layers.Dense(256, activation="relu",    name="dense_4")(x)
    x = keras.layers.Dropout(0.5,                     name="dropout_2")(x)
    out = keras.layers.Dense(3, activation="softmax", name="dense_5")(x)
    model = keras.Model(inputs=inputs, outputs=out)
    model.load_weights(weights_path)
    return model


def load_ann_models(ann_paths: list[str]) -> list:
    """5-seed binary ANN 모델 로드. 출력: sigmoid(1) — P(AD)"""
    models = [keras.models.load_model(p, compile=False) for p in ann_paths]
    return models


def load_preprocessing_tools(imputer_path: str, scaler_path: str):
    """MICE Imputer + StandardScaler 로드"""
    with open(imputer_path, "rb") as f:
        imputer = pickle.load(f)
    with open(scaler_path, "rb") as f:
        scaler = pickle.load(f)
    return imputer, scaler


def load_survival_models(rsf_path: str, rsf_scaler_path: str):
    """
    사전 학습된 RSF 모델 + RSF용 스케일러 로드.
    없으면 None 반환 → run_pipeline.py 에서 학습 후 저장 유도.
    """
    if os.path.exists(rsf_path) and os.path.exists(rsf_scaler_path):
        rsf    = joblib.load(rsf_path)
        sc_rsf = joblib.load(rsf_scaler_path)
        return rsf, sc_rsf
    return None, None


# ══════════════════════════════════════════════════════════════════════════════
# 3. 임상 데이터 전처리
# ══════════════════════════════════════════════════════════════════════════════

def preprocess_clinical(
    df: pd.DataFrame,
    mice_imputer,
    scaler,
) -> tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray]:
    """
    임상 CSV → ANN 입력 변환.
    반환: X_scaled(34), X_health(25), X_cog(4), X_eng(5)
    """
    df = df.copy()
    # 성별 인코딩
    df["PTGENDER"] = df["PTGENDER"].replace(
        {"Male": 1, "Female": 0, "M": 1, "F": 0}
    )

    # MICE 결측치 대치
    df_base      = df.reindex(columns=BASE_FEATS)
    imputed_arr  = mice_imputer.transform(df_base)
    df_imp       = pd.DataFrame(imputed_arr, columns=BASE_FEATS)

    # 파생 변수 생성 (2차 ANN 학습 시와 동일 공식)
    df_imp["FAQ_LDELTA_ratio"] = df_imp["FAQTOTAL"] / (df_imp["LDELTOTAL"] + 1)
    df_imp["high_risk_score"]  = df_imp["CDRSB"] * 2 + df_imp["FAQTOTAL"] - df_imp["LDELTOTAL"]
    df_imp["med_cog_risk"]     = df_imp["dementia_med"] + df_imp["COG_DISORDER"]
    df_imp["CDRSB_MMSE_ratio"] = df_imp["CDRSB"] / (df_imp["MMSCORE"] + 1)
    df_imp["cog_composite"]    = df_imp["MMSCORE"] - df_imp["CDRSB"] * 2 - df_imp["FAQTOTAL"] * 0.5

    # 스케일링
    X_scaled = scaler.transform(df_imp[ALL_FEATS].values)
    X_health = X_scaled[:, :H_DIM].astype(np.float32)
    X_cog    = X_scaled[:, H_DIM:H_DIM + C_DIM].astype(np.float32)
    X_eng    = X_scaled[:, H_DIM + C_DIM:].astype(np.float32)

    return X_scaled, X_health, X_cog, X_eng


# ══════════════════════════════════════════════════════════════════════════════
# 4. 이미지 처리
# ══════════════════════════════════════════════════════════════════════════════

def scan_images(img_root: str, folders: list[str] = ("MCI", "DM", "AD", "DM_or_AD")) -> pd.DataFrame:
    """
    이미지 폴더 스캔 → DataFrame 반환.
    파일명 규칙: {site}_{S}_{num}_{ImageID}_{slice}.png
    슬라이스 s2(중간) 만 사용.
    """
    records = []
    for folder in folders:
        path = os.path.join(img_root, folder)
        if not os.path.isdir(path):
            continue
        for fname in sorted(os.listdir(path)):
            if not fname.lower().endswith(".png"):
                continue
            parts = fname.replace(".png", "").split("_")
            if len(parts) < 5:
                continue
            slice_num = int(parts[4].replace("s", ""))
            if slice_num != 2:          # 중간 슬라이스만
                continue
            records.append({
                "subject_id":    f"{parts[0]}_S_{parts[2]}",
                "Image.Data.ID": parts[3],
                "filepath":      os.path.join(path, fname),
            })
    return pd.DataFrame(records)


def load_image(path: str) -> np.ndarray:
    """이미지 파일 → EfficientNet 전처리 배열 (224,224,3)"""
    img = tf.io.read_file(path)
    img = tf.image.decode_png(img, channels=3)
    img = tf.image.resize(img, IMG_SIZE)
    img = keras.applications.efficientnet.preprocess_input(
        tf.cast(img, tf.float32)
    )
    return img.numpy()


# ══════════════════════════════════════════════════════════════════════════════
# 5. 앙상블 예측
# ══════════════════════════════════════════════════════════════════════════════

def run_ensemble(
    df_clinical: pd.DataFrame,
    img_root: str,
    cnn_model,
    ann_models: list,
    mice_imputer,
    scaler,
    batch_size: int = 32,
) -> pd.DataFrame:
    """
    임상 CSV + 이미지 폴더 → MCI/AD 이진 분류 결과 DataFrame.

    반환 컬럼:
        subject_id, Image.Data.ID, label, true_binary,
        P_cnn_AD, P_ann_AD, P_ensemble_AD, pred_binary,
        risk_grade (Low/Medium/High, MCI 예측 환자만)
    """
    # ── 임상 전처리 ──
    df_target = df_clinical[df_clinical["label"].isin([1, 2])].copy().reset_index(drop=True)
    _, X_health, X_cog, X_eng = preprocess_clinical(df_target, mice_imputer, scaler)

    # ── 이미지 매칭 ──
    img_df = scan_images(img_root)
    df_target["img_id_clean"] = df_target["Image.Data.ID"].astype(str).str.strip()
    img_df["img_id_clean"]    = img_df["Image.Data.ID"].astype(str).str.strip()

    merged = df_target.reset_index(drop=False).merge(
        img_df[["img_id_clean", "filepath"]],
        on="img_id_clean", how="inner",
    ).rename(columns={"index": "orig_idx"})

    if len(merged) == 0:
        raise ValueError("이미지와 임상 데이터 매칭 실패. Image.Data.ID를 확인하세요.")

    # ── CNN 배치 예측 ──
    p_cnn = []
    n = len(merged)
    for start in range(0, n, batch_size):
        paths  = merged["filepath"].iloc[start:start + batch_size].tolist()
        imgs   = np.array([load_image(p) for p in paths])
        probs  = cnn_model(imgs, training=False).numpy()
        p_cnn.extend(probs[:, CNN_AD_IDX])

    # ── ANN 5-seed 평균 예측 ──
    idx = merged["orig_idx"].values
    seed_preds = [
        m.predict([X_health[idx], X_cog[idx], X_eng[idx]], verbose=0).flatten()
        for m in ann_models
    ]
    p_ann = np.mean(seed_preds, axis=0)

    # ── 앙상블 ──
    p_ens   = CNN_WEIGHT * np.array(p_cnn) + ANN_WEIGHT * p_ann
    y_pred  = (p_ens >= 0.5).astype(int)
    y_true  = (merged["label"].values == 2).astype(int)

    result = merged[["subject_id", "Image.Data.ID", "label", "visit_order"]].copy()
    result["true_binary"]   = y_true
    result["P_cnn_AD"]      = np.array(p_cnn)
    result["P_ann_AD"]      = p_ann
    result["P_ensemble_AD"] = p_ens
    result["pred_binary"]   = y_pred       # 0=MCI, 1=AD

    # ── MCI 예측 환자 위험도 등급 (P_ensemble_AD 분위수) ──
    mci_mask = result["pred_binary"] == 0
    if mci_mask.sum() > 0:
        q33 = result.loc[mci_mask, "P_ensemble_AD"].quantile(0.33)
        q66 = result.loc[mci_mask, "P_ensemble_AD"].quantile(0.66)
        result["risk_grade"] = pd.NA
        result.loc[mci_mask, "risk_grade"] = pd.cut(
            result.loc[mci_mask, "P_ensemble_AD"],
            bins=[-np.inf, q33, q66, np.inf],
            labels=["Low", "Medium", "High"],
        )

    return result


# ══════════════════════════════════════════════════════════════════════════════
# 6. 생존 분석 — RSF 학습 / 로드
# ══════════════════════════════════════════════════════════════════════════════

def _build_survival_dataset(long_path: str, delta_path: str) -> pd.DataFrame:
    """종단 데이터 + delta 피처 → RSF 학습용 생존 데이터셋 생성"""
    df_long  = pd.read_csv(long_path).sort_values(["RID", "Months_from_bl"])
    df_delta = pd.read_csv(delta_path)

    records = []
    for rid, visits in df_long.groupby("RID"):
        visits = visits.sort_values("Months_from_bl")
        mci_v  = visits[visits["DIAGNOSIS"] == "MCI"]
        dem_v  = visits[visits["DIAGNOSIS"] == "Dementia"]
        if len(mci_v) == 0:
            continue
        t0         = mci_v["Months_from_bl"].min()
        future_dem = dem_v[dem_v["Months_from_bl"] > t0]
        if len(future_dem) > 0:
            t_event = future_dem["Months_from_bl"].min() - t0
            event   = 1
        else:
            t_event = visits["Months_from_bl"].max() - t0
            event   = 0
        if t_event > 0:
            records.append({"RID": rid, "time": t_event, "event": event})

    surv_df = pd.DataFrame(records).merge(
        df_delta[["RID"] + RSF_FEATS], on="RID", how="left"
    )
    return surv_df.dropna(subset=RSF_FEATS)


def train_and_save_survival_models(
    long_path: str,
    delta_path: str,
    rsf_save_path: str,
    rsf_scaler_save_path: str,
) -> tuple:
    """
    RSF 학습 후 저장. 최초 1회만 실행.
    반환: (rsf_model, rsf_scaler, cox_model, surv_df)
    """
    from sksurv.ensemble import RandomSurvivalForest
    from sksurv.util import Surv

    surv_df = _build_survival_dataset(long_path, delta_path)
    print(f"생존 학습 데이터: {len(surv_df)}명 (전환 {surv_df['event'].sum()}명)")

    # 스케일러
    sc = StandardScaler()
    X  = sc.fit_transform(surv_df[RSF_FEATS].values)
    y  = Surv.from_arrays(
        event=surv_df["event"].astype(bool),
        time=surv_df["time"],
    )

    # RSF 학습
    rsf = RandomSurvivalForest(
        n_estimators=300, min_samples_leaf=10,
        max_features="sqrt", random_state=42, n_jobs=-1,
    )
    rsf.fit(X, y)

    # 저장
    joblib.dump(rsf, rsf_save_path)
    joblib.dump(sc,  rsf_scaler_save_path)
    print(f"✅ RSF 모델 저장: {rsf_save_path}")
    print(f"✅ RSF 스케일러 저장: {rsf_scaler_save_path}")

    return rsf, sc, surv_df


# ══════════════════════════════════════════════════════════════════════════════
# 7. 생존 예측 (개인별)
# ══════════════════════════════════════════════════════════════════════════════

def predict_individual_survival(
    ensemble_result: pd.DataFrame,
    delta_path: str,
    rsf_model,
    rsf_scaler,
    time_points: list[int] = [12, 24, 36, 48],
) -> pd.DataFrame:
    """
    앙상블에서 MCI로 분류된 환자 → 개인별 전환 확률 예측.

    반환 컬럼:
        subject_id, risk_grade, P_ensemble_AD,
        P_convert_12mo, P_convert_24mo, P_convert_36mo, P_convert_48mo,
        final_risk_grade
    """
    mci_df = ensemble_result[ensemble_result["pred_binary"] == 0].copy()
    if len(mci_df) == 0:
        return pd.DataFrame()

    # delta 피처 연결
    df_delta = pd.read_csv(delta_path)
    mci_df["RID_parsed"] = (
        mci_df["subject_id"].str.extract(r"(\d+)$")
        .astype(float).astype("Int64")
    )
    mci_df = mci_df.merge(
        df_delta[["RID"] + RSF_FEATS].rename(columns={"RID": "RID_parsed"}),
        on="RID_parsed", how="left",
    )
    # 종단 데이터 없는 환자는 median으로 대체
    for col in RSF_FEATS:
        mci_df[col] = mci_df[col].fillna(mci_df[col].median())

    # RSF 개인별 예측
    X_mci    = rsf_scaler.transform(mci_df[RSF_FEATS].values)
    surv_fns = rsf_model.predict_survival_function(X_mci, return_array=False)

    for t in time_points:
        mci_df[f"P_convert_{t}mo"] = [1 - fn(t) for fn in surv_fns]

    # 최종 위험도 등급 (24개월 기준)
    def _final_grade(p24: float) -> str:
        if p24 < 0.15:   return "Low"
        elif p24 < 0.40: return "Medium"
        return "High"

    mci_df["final_risk_grade"] = mci_df["P_convert_24mo"].apply(_final_grade)

    keep = (
        ["subject_id", "risk_grade", "P_ensemble_AD"]
        + [f"P_convert_{t}mo" for t in time_points]
        + ["final_risk_grade"]
    )
    return mci_df[keep].reset_index(drop=True)


# ══════════════════════════════════════════════════════════════════════════════
# 8. 결과 시각화
# ══════════════════════════════════════════════════════════════════════════════

def plot_ensemble_result(ensemble_df: pd.DataFrame, save_path: str = None):
    """앙상블 결과 시각화 (P(AD) 분포 + 위험도 등급 파이)"""
    fig, axes = plt.subplots(1, 2, figsize=(14, 5))

    # P(AD) 분포
    ax = axes[0]
    colors = {"MCI": "steelblue", "AD": "salmon"}
    for pred, color in colors.items():
        mask = ensemble_df["pred_binary"] == (0 if pred == "MCI" else 1)
        ax.hist(ensemble_df.loc[mask, "P_ensemble_AD"],
                bins=30, alpha=0.65, color=color, label=pred, edgecolor="white")
    ax.set_xlabel("P(AD) — 앙상블 확률")
    ax.set_title("예측 분포")
    ax.legend()

    # 위험도 파이 (MCI 환자만)
    ax2 = axes[1]
    mci = ensemble_df[ensemble_df["pred_binary"] == 0]
    if "risk_grade" in mci.columns and mci["risk_grade"].notna().any():
        counts = mci["risk_grade"].value_counts().reindex(["Low", "Medium", "High"])
        ax2.pie(counts, labels=counts.index, autopct="%1.1f%%",
                colors=["#2ecc71", "#f39c12", "#e74c3c"])
        ax2.set_title("MCI 환자 앙상블 위험도 분포")

    plt.tight_layout()
    if save_path:
        fig.savefig(save_path, dpi=150)
        print(f"📊 앙상블 결과 저장: {save_path}")
    return fig


def plot_survival_result(survival_df: pd.DataFrame, save_path: str = None):
    """개인별 생존 예측 결과 시각화 (전환 확률 분포 by 위험도 그룹)"""
    time_cols = [c for c in survival_df.columns if c.startswith("P_convert_")]
    if not time_cols:
        return None

    colors = {"Low": "#2ecc71", "Medium": "#f39c12", "High": "#e74c3c"}
    fig, axes = plt.subplots(1, len(time_cols), figsize=(5 * len(time_cols), 5))
    if len(time_cols) == 1:
        axes = [axes]

    for ax, col in zip(axes, time_cols):
        label = col.replace("P_convert_", "").replace("mo", "개월")
        for grade, color in colors.items():
            sub = survival_df[survival_df["final_risk_grade"] == grade][col]
            if len(sub) == 0:
                continue
            ax.hist(sub, bins=20, alpha=0.6, color=color, label=grade, edgecolor="white")
        ax.set_title(f"{label} 전환 확률 분포")
        ax.set_xlabel("전환 확률")
        ax.set_ylabel("환자 수")
        ax.legend()

    plt.suptitle("MCI 환자 개인별 치매 전환 확률 (RSF)", y=1.02, fontsize=13)
    plt.tight_layout()
    if save_path:
        fig.savefig(save_path, dpi=150)
        print(f"📊 생존 예측 결과 저장: {save_path}")
    return fig
