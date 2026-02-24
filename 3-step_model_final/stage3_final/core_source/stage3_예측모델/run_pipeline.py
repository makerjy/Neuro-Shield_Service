"""
run_pipeline.py
Alzheimer's Disease — 전체 파이프라인 실행 스크립트
=====================================================
실행 방법:
    python run_pipeline.py                          # 기본 경로 사용
    python run_pipeline.py --csv my_data.csv        # CSV 경로 지정
    python run_pipeline.py --skip-survival          # 앙상블만 실행
    python run_pipeline.py --retrain-survival       # RSF 재학습

[파이프라인 순서]
  1. 모델 + 전처리 도구 로드
  2. 임상 CSV 전처리 (MICE → 파생변수 → 스케일링)
  3. 이미지 스캔 + 임상 데이터 매칭
  4. CNN + ANN 앙상블 → MCI / AD 분류
  5. MCI 환자만 → RSF 생존 분석 → 개인별 전환 확률
  6. 결과 저장 (CSV + 그래프)
"""

import os
import argparse
import time
import pandas as pd
import numpy as np
from sklearn.metrics import classification_report

import utils  # utils.py 와 같은 디렉토리에 있어야 함


# ══════════════════════════════════════════════════════════════════════════════
# 경로 설정 (환경에 맞게 수정)
# ══════════════════════════════════════════════════════════════════════════════

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.abspath(os.path.join(BASE_DIR, "..", "..", ".."))

PATHS = {
    # ── 입력 데이터 ──
    "csv":            os.path.join(BASE_DIR, "ADNI3_Golden_Master_Longitudinal_image.csv"),
    "img_root":       os.path.join(PROJECT_ROOT, "stage3_final", "stage_3_cnn", "TEST_IMAGE"),
    "longitudinal":   os.path.join(BASE_DIR, "ADNI_Longitudinal_DATA.csv"),
    "delta":          os.path.join(BASE_DIR, "delta_patient_level.csv"),

    # ── 사전 학습 모델 ──
    "cnn_weights":    os.path.join(PROJECT_ROOT, "stage3_final", "stage_3_cnn", "best_model_final.keras"),
    "ann_seeds":      [
        os.path.join(PROJECT_ROOT, "stage2_modelfinal", f"best_stage2_binary_ann_seed{s}.keras")
        for s in [42, 99, 123, 777, 2024]
    ],
    "mice_imputer":   os.path.join(PROJECT_ROOT, "stage3_final", "data", "preprocessing", "stage2_mice_imputer.pkl"),
    "scaler":         os.path.join(PROJECT_ROOT, "stage3_final", "data", "preprocessing", "stage2_scaler.pkl"),

    # ── 생존 분석 모델 (없으면 자동 학습 후 저장) ──
    "rsf_model":      os.path.join(BASE_DIR, "rsf_survival_model.joblib"),
    "rsf_scaler":     os.path.join(BASE_DIR, "rsf_survival_scaler.joblib"),

    # ── 출력 ──
    "out_ensemble":   os.path.join(BASE_DIR, "output_ensemble_result.csv"),
    "out_survival":   os.path.join(BASE_DIR, "output_survival_result.csv"),
    "fig_ensemble":   os.path.join(BASE_DIR, "output_fig_ensemble.png"),
    "fig_survival":   os.path.join(BASE_DIR, "output_fig_survival.png"),
}


# ══════════════════════════════════════════════════════════════════════════════
# Step 0: CLI 인자 파싱
# ══════════════════════════════════════════════════════════════════════════════

def parse_args():
    parser = argparse.ArgumentParser(description="Alzheimer's Disease Pipeline")
    parser.add_argument("--csv",              default=PATHS["csv"],
                        help="임상 데이터 CSV 경로")
    parser.add_argument("--img-root",         default=PATHS["img_root"],
                        help="MRI 이미지 루트 폴더 경로")
    parser.add_argument("--skip-survival",    action="store_true",
                        help="앙상블만 실행 (생존 분석 건너뜀)")
    parser.add_argument("--retrain-survival", action="store_true",
                        help="RSF 생존 모델 재학습 (기존 저장 파일 무시)")
    return parser.parse_args()


# ══════════════════════════════════════════════════════════════════════════════
# Step 1: 모델 로드
# ══════════════════════════════════════════════════════════════════════════════

def step1_load_models():
    print("\n" + "="*60)
    print("  Step 1: 모델 로드")
    print("="*60)
    t = time.time()

    cnn = utils.build_cnn(PATHS["cnn_weights"])
    print(f"  ✅ CNN 로드 완료  | 출력: {cnn.output_shape}")

    ann_models = utils.load_ann_models(PATHS["ann_seeds"])
    print(f"  ✅ ANN 로드 완료  | {len(ann_models)}개 seed")

    imputer, scaler = utils.load_preprocessing_tools(
        PATHS["mice_imputer"], PATHS["scaler"]
    )
    print(f"  ✅ 전처리 도구 로드 | MICE + Scaler ({scaler.n_features_in_}개 피처)")
    print(f"  ⏱  {time.time()-t:.1f}초")

    return cnn, ann_models, imputer, scaler


# ══════════════════════════════════════════════════════════════════════════════
# Step 2~4: 앙상블 실행
# ══════════════════════════════════════════════════════════════════════════════

def step2_run_ensemble(csv_path, img_root, cnn, ann_models, imputer, scaler):
    print("\n" + "="*60)
    print("  Step 2~4: 임상 전처리 → 이미지 매칭 → 앙상블 예측")
    print("="*60)
    t = time.time()

    df_clinical = pd.read_csv(csv_path)
    df_clinical.columns = df_clinical.columns.str.strip()
    print(f"  임상 데이터: {len(df_clinical)}행, {df_clinical['subject_id'].nunique()}명")

    ensemble_df = utils.run_ensemble(
        df_clinical=df_clinical,
        img_root=img_root,
        cnn_model=cnn,
        ann_models=ann_models,
        mice_imputer=imputer,
        scaler=scaler,
    )

    n_mci = (ensemble_df["pred_binary"] == 0).sum()
    n_ad  = (ensemble_df["pred_binary"] == 1).sum()
    print(f"\n  예측 결과: MCI={n_mci}명 / AD={n_ad}명 / 합계={len(ensemble_df)}명")

    # 레이블이 있으면 성능 평가
    if "true_binary" in ensemble_df.columns:
        y_true = ensemble_df["true_binary"].values
        y_pred = ensemble_df["pred_binary"].values
        print("\n  [앙상블 분류 성능]")
        print(classification_report(
            y_true, y_pred, target_names=["MCI", "AD"], zero_division=0
        ))

    # 위험도 분포
    if "risk_grade" in ensemble_df.columns:
        grade_counts = ensemble_df["risk_grade"].value_counts()
        print("  MCI 위험도 분포:")
        for g in ["Low", "Medium", "High"]:
            n = grade_counts.get(g, 0)
            print(f"    {g:6s}: {n}명")

    print(f"  ⏱  {time.time()-t:.1f}초")

    # 저장
    ensemble_df.to_csv(PATHS["out_ensemble"], index=False)
    print(f"\n  💾 앙상블 결과 저장: {PATHS['out_ensemble']}")

    utils.plot_ensemble_result(ensemble_df, save_path=PATHS["fig_ensemble"])

    return ensemble_df


# ══════════════════════════════════════════════════════════════════════════════
# Step 5: 생존 분석
# ══════════════════════════════════════════════════════════════════════════════

def step3_run_survival(ensemble_df, retrain=False):
    print("\n" + "="*60)
    print("  Step 5: MCI 환자 개인별 생존 예측 (RSF)")
    print("="*60)
    t = time.time()

    # RSF 모델 로드 or 학습
    rsf_model, rsf_scaler = utils.load_survival_models(
        PATHS["rsf_model"], PATHS["rsf_scaler"]
    )

    if rsf_model is None or retrain:
        print("  RSF 모델 없음 → 학습 시작 (최초 1회)")
        rsf_model, rsf_scaler, _ = utils.train_and_save_survival_models(
            long_path=PATHS["longitudinal"],
            delta_path=PATHS["delta"],
            rsf_save_path=PATHS["rsf_model"],
            rsf_scaler_save_path=PATHS["rsf_scaler"],
        )
    else:
        print("  ✅ RSF 모델 로드 완료 (사전 학습)")

    # 개인별 예측
    survival_df = utils.predict_individual_survival(
        ensemble_result=ensemble_df,
        delta_path=PATHS["delta"],
        rsf_model=rsf_model,
        rsf_scaler=rsf_scaler,
        time_points=[12, 24, 36, 48],
    )

    if len(survival_df) == 0:
        print("  ⚠️  MCI 예측 환자가 없어 생존 분석 생략")
        return None

    print(f"\n  생존 예측 완료: {len(survival_df)}명")
    print("\n  [그룹별 전환 확률 (평균)]")
    p_cols = ["P_convert_12mo", "P_convert_24mo", "P_convert_36mo", "P_convert_48mo"]
    summary = survival_df.groupby("final_risk_grade")[p_cols].mean()
    for grade in ["Low", "Medium", "High"]:
        if grade not in summary.index:
            continue
        row = summary.loc[grade]
        print(f"    {grade:6s}: "
              f"12mo={row['P_convert_12mo']:.1%}  "
              f"24mo={row['P_convert_24mo']:.1%}  "
              f"36mo={row['P_convert_36mo']:.1%}  "
              f"48mo={row['P_convert_48mo']:.1%}")

    print(f"\n  최종 위험도 등급 분포:")
    for g in ["Low", "Medium", "High"]:
        n = (survival_df["final_risk_grade"] == g).sum()
        print(f"    {g:6s}: {n}명")

    print(f"  ⏱  {time.time()-t:.1f}초")

    # 저장
    survival_df.to_csv(PATHS["out_survival"], index=False)
    print(f"\n  💾 생존 예측 결과 저장: {PATHS['out_survival']}")

    utils.plot_survival_result(survival_df, save_path=PATHS["fig_survival"])

    return survival_df


# ══════════════════════════════════════════════════════════════════════════════
# 최종 요약 출력
# ══════════════════════════════════════════════════════════════════════════════

def print_summary(ensemble_df, survival_df):
    print("\n" + "="*60)
    print("  최종 파이프라인 결과 요약")
    print("="*60)

    total = len(ensemble_df)
    n_mci = (ensemble_df["pred_binary"] == 0).sum()
    n_ad  = (ensemble_df["pred_binary"] == 1).sum()

    print(f"\n  [앙상블 분류]")
    print(f"    전체 분석 환자 : {total}명")
    print(f"    AD  예측        : {n_ad}명  ({n_ad/total:.1%})")
    print(f"    MCI 예측        : {n_mci}명  ({n_mci/total:.1%})")

    if survival_df is not None and len(survival_df) > 0:
        print(f"\n  [MCI 개인별 생존 예측]")
        for g in ["Low", "Medium", "High"]:
            sub = survival_df[survival_df["final_risk_grade"] == g]
            if len(sub) == 0:
                continue
            p24_mean = sub["P_convert_24mo"].mean()
            p24_max  = sub["P_convert_24mo"].max()
            print(f"    {g:6s} ({len(sub):3d}명) — "
                  f"24개월 전환 확률: 평균 {p24_mean:.1%}, 최고 {p24_max:.1%}")

    print(f"\n  [출력 파일]")
    print(f"    {PATHS['out_ensemble']}")
    if survival_df is not None:
        print(f"    {PATHS['out_survival']}")
    print(f"    {PATHS['fig_ensemble']}")
    if survival_df is not None:
        print(f"    {PATHS['fig_survival']}")
    print()


# ══════════════════════════════════════════════════════════════════════════════
# 메인 실행
# ══════════════════════════════════════════════════════════════════════════════

def main():
    args = parse_args()

    total_start = time.time()
    print("\n" + "="*60)
    print("  Alzheimer's Disease Pipeline START")
    print("="*60)

    # Step 1: 모델 로드
    cnn, ann_models, imputer, scaler = step1_load_models()

    # Step 2~4: 앙상블
    ensemble_df = step2_run_ensemble(
        csv_path=args.csv,
        img_root=args.img_root,
        cnn=cnn,
        ann_models=ann_models,
        imputer=imputer,
        scaler=scaler,
    )

    # Step 5: 생존 분석
    survival_df = None
    if not args.skip_survival:
        survival_df = step3_run_survival(
            ensemble_df=ensemble_df,
            retrain=args.retrain_survival,
        )

    # 최종 요약
    print_summary(ensemble_df, survival_df)

    print(f"  ⏱  전체 실행 시간: {time.time()-total_start:.1f}초")
    print("="*60)
    print("  Pipeline DONE")
    print("="*60 + "\n")


if __name__ == "__main__":
    main()
