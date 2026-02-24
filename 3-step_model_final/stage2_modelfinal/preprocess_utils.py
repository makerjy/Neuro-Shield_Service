
import pandas as pd
import numpy as np
import pickle
import os

def run_preprocessing(df, imputer_path, scaler_path):
    # 1. 도구 로드 시도
    imputer = None
    if os.path.exists(imputer_path):
        with open(imputer_path, 'rb') as f:
            imputer = pickle.load(f)
    
    with open(scaler_path, 'rb') as f:
        scaler = pickle.load(f)

    # 🌟 [수사] 임퓨터가 기억하는 피처 순서 추출
    if imputer and hasattr(imputer, 'feature_names_in_'):
        required_base_feats = list(imputer.feature_names_in_)
    else:
        # 임퓨터가 없을 경우 스케일러의 기억에서 베이스 피처(파생변수 제외) 추출
        # 스케일러의 34개 피처 중 앞쪽 29개가 베이스 피처임
        all_scaler_feats = list(scaler.feature_names_in_)
        required_base_feats = [f for f in all_scaler_feats if f not in ['FAQ_LDELTA_ratio', 'high_risk_score', 'med_cog_risk', 'CDRSB_MMSE_ratio', 'cog_composite']]

    # 🌟 [데이터 정렬] 임퓨터가 원하는 순서대로 컬럼을 재배치 (없으면 0으로 생성)
    df_aligned = df.reindex(columns=required_base_feats)
    
    # 2. 결측치 처리 (임퓨터가 없으면 fillna(0)으로 강제 진행)
    if imputer:
        print(f"✔️ MICE Imputer 적용 중 (피처 {len(required_base_feats)}개)...")
        imputed_data = imputer.transform(df_aligned)
    else:
        print("⚠️ Imputer 로드 실패로 fillna(0) 강제 대체 진행")
        imputed_data = df_aligned.fillna(0).values
        
    df_imputed = pd.DataFrame(imputed_data, columns=required_base_feats)
    
    # 3. 파생 변수 생성 (2차 모델 동일 로직)
    df_imputed['FAQ_LDELTA_ratio'] = df_imputed['FAQTOTAL'] / (df_imputed['LDELTOTAL'] + 1e-5)
    df_imputed['CDRSB_MMSE_ratio'] = df_imputed['CDRSB'] / (df_imputed['MMSCORE'] + 1e-5)
    df_imputed['high_risk_score'] = (df_imputed['CDRSB'] * 2.0) + (30 - df_imputed['MMSCORE'])
    df_imputed['cog_composite'] = (df_imputed['MMSCORE'] * 0.5) - (df_imputed['FAQTOTAL'] * 0.3) - (df_imputed['CDRSB'] * 0.2)
    df_imputed['med_cog_risk'] = df_imputed['dementia_med'] + df_imputed['COG_DISORDER'] + (df_imputed['FAQTOTAL'] > 5).astype(int)
    
    # 🌟 [최종 정렬] 스케일러의 기억(34개 피처)과 100% 일치시킴
    final_feats = list(scaler.feature_names_in_)
    df_final = df_imputed.reindex(columns=final_feats, fill_value=0)
    
    X_scaled = scaler.transform(df_final)
    
    return X_scaled, final_feats
