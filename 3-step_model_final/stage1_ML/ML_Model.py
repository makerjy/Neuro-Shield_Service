import streamlit as st
import pandas as pd
import numpy as np
import joblib
import os

# ==========================================
# 1. 페이지 설정 및 스타일
# ==========================================
st.set_page_config(page_title="MindGuard AI (CIST Mode)", layout="wide", page_icon="🧠")

# CSS를 활용한 디자인 개선 (unsafe_allow_html=True 사용)
st.markdown("""
    <style>
    .main { background-color: #f5f7f9; }
    .stMetric { background-color: #ffffff; padding: 20px; border-radius: 10px; box-shadow: 0 2px 4px rgba(0,0,0,0.05); }
    </style>
    """, unsafe_allow_html=True) # <--- 이 부분의 인자명을 수정했습니다.

# ==========================================
# 2. 모델 로드 (최신 CIST 전용 모델 반영)
# ==========================================
@st.cache_resource
def load_model():
    model_path = "ADNI_CIST_Predictor_Final.joblib"
    if os.path.exists(model_path):
        return joblib.load(model_path)
    else:
        return None

engine = load_model()

if engine is None:
    st.error("❌ 모델 파일('ADNI_CIST_Predictor_Final.joblib')을 찾을 수 없습니다. 모델 학습 스크립트를 먼저 실행해주세요.")
    st.stop()

# ==========================================
# 3. 사이드바: 사용자 입력
# ==========================================
st.sidebar.header("📋 CIST 검사 결과 입력")

with st.sidebar:
    st.subheader("1. 인지 기능 (CIST)")
    cist_orient = st.slider("지남력 (0~5점)", 0, 5, 5)
    cist_attent = st.slider("주의력 (0~3점)", 0, 3, 3)
    cist_exec   = st.slider("집행기능 (0~6점)", 0, 6, 4)
    cist_memory = st.slider("기억력 (0~10점)", 0, 10, 7)
    cist_lang   = st.slider("언어기능 (0~4점)", 0, 4, 3)
    
    st.markdown("---")
    st.subheader("2. 기본 건강 정보")
    age = st.number_input("연령 (세)", 40, 100, 75)
    edu = st.number_input("교육 연수 (년)", 0, 25, 12)
    gender = st.selectbox("성별", ["Male", "Female"])
    
    st.markdown("---")
    st.subheader("3. 생체 지표")
    sys_bp = st.number_input("수축기 혈압 (mmHg)", 70, 250, 130)
    bmi = st.number_input("BMI (체질량지수)", 10.0, 60.0, 23.5)

    predict_btn = st.button("🚀 AI 치매 위험도 분석")

# ==========================================
# 4. 메인 화면: 분석 및 결과 리포트
# ==========================================
st.title("test_version.2")
st.markdown("#### 한국형 CIST 기반 AI 치매 예측 엔진")

if predict_btn:
    gender_num = 1 if gender == "Male" else 2
    
    input_dict = {
        "CIST_ORIENT": cist_orient,
        "CIST_ATTENTION": cist_attent,
        "CIST_EXEC": cist_exec,
        "CIST_MEMORY": cist_memory,
        "CIST_LANGUAGE": cist_lang,
        "entry_age": age,
        "PTEDUCAT": edu,
        "VSBPSYS": sys_bp,
        "BMI": bmi,
        "PTGENDER_num": gender_num
    }
    
    input_df = pd.DataFrame([input_dict])
    
    # 모델 학습 시 사용된 피처 순서와 동일하게 정렬
    input_df = input_df[engine['features']]
    
    # 전처리 (Clipping)
    for col, (low, high) in engine['bounds'].items():
        if col in input_df.columns:
            input_df[col] = input_df[col].clip(low, high)
            
    # Scaling 및 Imputing
    X_imp = engine['imputer'].transform(input_df)
    X_sc = engine['scaler'].transform(X_imp)
    
    # 예측 수행
    prob = engine['model'].predict_proba(X_sc)[0, 1]
    
    # 결과 출력
    st.markdown("---")
    st.subheader("📍 AI 분석 결과 리포트")
    
    m1, m2, m3 = st.columns(3)
    with m1:
        st.metric("치매 위험도", f"{prob*100:.1f}%")
    with m2:
        if prob >= 0.7:
            st.error("🚨 고위험군 (High Risk)")
        elif prob >= 0.4:
            st.warning("⚠️ 경계군 (Borderline)")
        else:
            st.success("✅ 저위험군 (Normal)")
    with m3:
        if prob >= 0.7:
            st.write("**정밀 검사가 강력히 권장됩니다.**")
        elif prob >= 0.4:
            st.write("**추적 관찰 및 인지 재활을 권장합니다.**")
        else:
            st.write("**현재 상태 유지를 위한 습관을 권장합니다.**")

    st.progress(prob)

else:
    st.write("검사 결과를 입력하고 **분석 시작** 버튼을 눌러주세요.")
    # use_container_width로 수정 (최신 버전 권장사항)
    st.image("https://images.unsplash.com/photo-1559757175-5700dde675bc?auto=format&fit=crop&w=1000&q=80", use_container_width=True)

st.markdown("---")
st.caption("※ 본 서비스는 ADNI 데이터를 기반으로 학습된 보조 도구입니다.")