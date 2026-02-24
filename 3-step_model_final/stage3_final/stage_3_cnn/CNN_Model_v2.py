import os
# [필수] GPU 연산 오류(JIT/Sqrt)를 원천 차단하기 위해 CPU 모드 강제 사용
os.environ["CUDA_VISIBLE_DEVICES"] = "-1"
os.environ['TF_CPP_MIN_LOG_LEVEL'] = '2'

import streamlit as st
import tensorflow as tf
import numpy as np
from PIL import Image

# 페이지 설정
st.set_page_config(page_title="MindGuard AI", layout="centered")

# ==========================================
# 1. 모델 수동 재건 및 가중치 로드 함수
# ==========================================
@st.cache_resource
def load_neuro_model_safe():
    model_path = "best_model_final.keras" # 파일이 같은 폴더에 있어야 합니다.
    
    if not os.path.exists(model_path):
        st.error(f"❌ 파일을 찾을 수 없습니다: {model_path}")
        return None

    try:
        # 1-1. 튼튼한 함수형(Functional) 모델 뼈대 구축
        inputs = tf.keras.Input(shape=(224, 224, 3))
        
        # 성민님의 학습 설정(pooling='max')과 동일하게 백본 생성
        base_model = tf.keras.applications.EfficientNetB3(
            include_top=False, weights=None, pooling='max'
        )
        
        x = base_model(inputs)
        # 가중치 파일 내의 실제 레이어 이름(batch_normalization_2, dense_4, dense_5)과 일치시킵니다.
        x = tf.keras.layers.BatchNormalization(axis=-1, momentum=0.99, epsilon=0.0001, name="batch_normalization_2")(x)
        x = tf.keras.layers.Dense(256, activation='relu', name="dense_4")(x)
        x = tf.keras.layers.Dropout(0.5, name="dropout_2")(x)
        outputs = tf.keras.layers.Dense(3, activation='softmax', name="dense_5")(x)
        
        model = tf.keras.Model(inputs=inputs, outputs=outputs)

        # 1-2. .keras 파일에서 가중치만 쏙 뽑아서 입히기 (Direct Load)
        # 이 방식은 Sequential Deserialization 버그를 100% 우회합니다.
        model.load_weights(model_path)
        return model
        
    except Exception as e:
        st.error(f"❌ 모델 복원 중 오류 발생: {e}")
        return None

# 모델 실행
model = load_neuro_model_safe()
# 클래스 순서: 0:CN, 1:DM, 2:MCI (알파벳 정렬 기준)
CLASS_NAMES = ['CN (정상)', 'DM (치매)', 'MCI (경도인지장애)']

# ==========================================
# 2. UI 및 판독 실행부
# ==========================================
st.title("🧠 MindGuard AI: 정밀 진단 시스템")
st.write("사용자의 MRI 영상을 분석하여 치매 및 인지장애 여부를 판독합니다.")

uploaded_file = st.sidebar.file_uploader("뇌 MRI 영상 업로드", type=["jpg", "png", "jpeg"])

if uploaded_file and model:
    # 이미지 표시
    img = Image.open(uploaded_file).convert('RGB')
    st.image(img, use_container_width=True, caption="입력 MRI 영상")
    
    if st.button("AI 정밀 판독 실행"):
        with st.spinner('딥러닝 신경망이 패턴을 분석 중입니다...'):
            try:
                # 3. 전처리 (학습 규격 100% 일치)
                img_resized = img.resize((224, 224))
                img_array = np.array(img_resized).astype('float32')
                img_batch = np.expand_dims(img_array, axis=0) # 배치 차원 추가
                
                # EfficientNet 전용 전처리 함수 적용
                img_preprocessed = tf.keras.applications.efficientnet.preprocess_input(img_batch)
                
                # 4. 판독 실행 (BatchNormalization 동작을 위해 training=False 고정)
                predictions = model(img_preprocessed, training=False)
                prob = predictions.numpy()[0]
                
                top_idx = np.argmax(prob)
                confidence = prob[top_idx] * 100
                
                # 5. 결과 시각화
                st.divider()
                st.subheader(f"판독 결과: :blue[{CLASS_NAMES[top_idx]}]")
                st.info(f"AI 분석 신뢰도: **{confidence:.2f}%**")
                
                # 확률 분포 차트
                chart_data = {CLASS_NAMES[i]: float(prob[i]) for i in range(3)}
                st.bar_chart(chart_data)
                
            except Exception as e:
                st.error(f"판독 과정 중 기술적 오류: {e}")

elif not uploaded_file:
    st.info("왼쪽 사이드바에서 분석할 MRI 이미지를 선택해 주세요.")