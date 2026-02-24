# Neuro-Shield Stage3 CNN Model Explainer

심사위원에게 `입력 → 전처리 → 추론 → 설명(Grad-CAM/옵션 Occlusion)`을 단계별로 시연하기 위한 단독 콘솔 서비스입니다.

- Frontend: Vanilla JS + HTML + CSS
- Backend: FastAPI + TensorFlow (EfficientNetB3 수동 재건 + `load_weights`)
- 상태 진행: `run_id` 기반 상태머신 + 프론트 폴링

## 1) 실행 방법

```bash
cd stage3-cnn-explainer
docker-compose up --build
```

- Frontend: [http://localhost:5180](http://localhost:5180)
- Backend: [http://localhost:8001](http://localhost:8001)
- Backend OpenAPI: [http://localhost:8001/docs](http://localhost:8001/docs)

## 2) 모델 파일 배치 안내

모델 파일은 아래 위치에 있어야 합니다.

```text
stage3-cnn-explainer/backend/assets/best_model_final.keras
```

컨테이너 시작 시 파일이 없으면 backend가 명확한 에러 로그를 출력하고 종료됩니다.

## 3) 심사 시연 스크립트 (3분)

1. `CN` 샘플 선택 후 `Run Inference` 실행
2. 중앙 Stepper에서 `VALIDATING → RESIZE → PREPROCESS → INFERENCING → EXPLAINING → COMPLETED` 진행 확인
3. 우측에서 클래스 확률, 예측 클래스, Grad-CAM 오버레이 확인
4. `MCI` 샘플로 재실행 후 확률/Grad-CAM 비교
5. `DM (AD)` 샘플로 재실행 후 확률/Grad-CAM 비교
6. Step 카드 클릭으로 전처리 통계(min/max/mean/std), 리사이즈 이미지, Raw JSON 증빙 확인
7. `Run Report` 버튼으로 한 페이지 출력(브라우저 Print → PDF 저장)

## 4) 주요 동작 요약

- 모델 구조는 `CNN_Model_v2.py`와 동일
  - `Input(224,224,3)`
  - `EfficientNetB3(include_top=False, weights=None, pooling='max')`
  - `BatchNormalization(name="batch_normalization_2")`
  - `Dense(256, relu, name="dense_4")`
  - `Dropout(0.5, name="dropout_2")`
  - `Dense(3, softmax, name="dense_5")`
  - `load_weights(best_model_final.keras)`
- 전처리:
  - `PIL.Image.open(...).convert("RGB")`
  - `resize(224,224)`
  - `np.expand_dims(..., axis=0)`
  - `tf.keras.applications.efficientnet.preprocess_input`
- 추론:
  - `model(x, training=False)`
- 클래스 순서:
  - Backend 계산 순서: `CN (정상)`, `DM (치매)`, `MCI (경도인지장애)`
  - UI 표기: `DM (치매/AD)`

## 5) API 요약

- `GET /api/meta`
- `GET /api/samples`
- `POST /api/run` (multipart 업로드 또는 `sample_id`)
- `GET /api/run/{run_id}`

`입력이 없으면 DATA_MISSING`으로 종료되며 확률/결과는 반환하지 않습니다.

## 6) 주의 문구

- 본 서비스는 심사/설명용 데모이며 의료적 진단을 대체하지 않습니다.
- Grad-CAM/Occlusion은 인과를 증명하지 않으며 시각적 설명 보조 도구입니다.

## 7) QA 체크리스트

- [x] 이미지 없으면 `DATA_MISSING`이며 결과 확률 미노출
- [x] `224` 리사이즈 + `efficientnet preprocess_input` 적용
- [x] `model(x, training=False)`로 추론
- [x] 클래스 순서 `CN/DM/MCI` 일관성 유지
- [x] `run_id` 기반 단계 진행 + 폴링
- [x] Grad-CAM last conv layer 자동 탐색
- [x] heatmap/overlay 표시
- [x] Run Report 한 페이지 출력 지원
