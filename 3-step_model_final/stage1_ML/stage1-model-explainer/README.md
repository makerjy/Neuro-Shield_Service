# Stage1 ML Model Explainer

Neuro-Shield Stage1 ML 모델의 내부 작동(입력 → 전처리 → 추론 → 민감도)을 심사위원에게 단계별로 설명하기 위한 단독 데모 서비스입니다.

- Frontend: Vanilla JS + HTML + CSS + Chart.js CDN
- Backend: FastAPI + joblib 엔진 로드 + run_id 기반 상태머신
- 모델 파일: `backend/assets/ADNI_CIST_Predictor_Final.joblib`

## 구조

```text
stage1-model-explainer/
  backend/
    main.py
    engine_loader.py
    demo_generator.py
    schemas.py
    run_store.py
    requirements.txt
    assets/
      ADNI_CIST_Predictor_Final.joblib
    exports/
      stage1_demo_scored.csv
  frontend/
    index.html
    styles.css
    app.js
  docker-compose.yml
  README.md
```

## 실행 방법

1. 모델 파일 배치
- 위치: `stage1-model-explainer/backend/assets/ADNI_CIST_Predictor_Final.joblib`

2. 실행

```bash
cd stage1-model-explainer
docker-compose up --build
```

3. 접속
- Frontend: [http://localhost:5178](http://localhost:5178)
- Backend API: [http://localhost:8000](http://localhost:8000)
- Health: [http://localhost:8000/api/health](http://localhost:8000/api/health)

## API 요약

- `GET /api/meta`
  - `features`, `bounds`, `default_values`, `thresholds`, `required_fields`, `model_version`
- `POST /api/run`
  - body:
    - `values: { feature: number | null, gender?: "Male" | "Female" }`
    - `options: { allow_missing_demo: boolean }`
  - response: `{ run_id }`
- `GET /api/run/{run_id}`
  - 상태/진행률/단계 아티팩트 조회
- `POST /api/predict`
  - 동기 즉시 추론 (옵션)
- `POST /api/demo/generate`
  - 100건 데모 입력 생성 + 모델 점수화 + `backend/exports/stage1_demo_scored.csv` 저장
  - body 예시:
    - `{"n":100,"mix":{"CN":40,"MCI":35,"DM":25},"seed":42,"include_clipping_cases_ratio":0.1}`
- `GET /api/demo/download/{filename}`
  - 생성된 CSV 다운로드

## 데모 CSV 생성 규칙

- 출력 컬럼(고정 순서):
  - 기본 7개: `PTID,label,target,DIAGNOSIS_str,DM_Probability,Predicted_Label,Interest_Category`
  - + 입력값 컬럼: `CIST_ORIENT,CIST_ATTENTION,CIST_EXEC,CIST_MEMORY,CIST_LANGUAGE,entry_age,PTEDUCAT,VSBPSYS,BMI,PTGENDER_num`
  - + 파생 컬럼: `PTGENDER_str,MCI_Probability,Priority_Score,Priority_Tier,CLIPPING_APPLIED`
- `PTID`: `NS-DEMO-0001` ~ `NS-DEMO-0100`
- `label`/`DIAGNOSIS_str`:
  - `prob < 0.40 -> CN`
  - `0.40 <= prob < 0.70 -> MCI`
  - `prob >= 0.70 -> DM`
- `target` 매핑:
  - `CN=0`, `MCI=1`, `DM=2`
- `Predicted_Label`:
  - 위와 동일 threshold 규칙
- `Interest_Category`:
  - `MCI/DM` 결합 우선도 점수 기반

### 우선도 스코어링

- `MCI_Probability`:
  - Stage1이 DM 이진 모델이라, MCI는 threshold 거리 기반 보조 확률로 계산
- `Priority_Score`:
  - `Priority_Score = (DM_Probability * 0.75 + MCI_Probability * 0.25) * 100`
- `Priority_Tier`:
  - `>=70: High_Interest`
  - `>=45: Medium_Interest`
  - `<45: Low_Interest`
- `Interest_Category`는 `Priority_Tier`와 동일하게 저장

## 상태머신

`QUEUED → VALIDATING → CLIPPING → IMPUTING → SCALING → INFERENCING → EXPLAINING → COMPLETED`

예외 상태:
- `DATA_MISSING`: 필수 입력 누락 + 데모 모드 OFF
- `FAILED`: 런타임 오류

프론트 타임라인에는 설명용 `ORDERING` 단계가 별도로 표시됩니다.

## 전처리/추론 파이프라인 (ML_Model.py 동기화)

1. 입력 수집 (CIST + 건강정보 + 성별)
2. `engine['features']` 순서로 재정렬
3. `engine['bounds']` 기반 clipping
4. `engine['imputer'].transform`
5. `engine['scaler'].transform`
6. `engine['model'].predict_proba`로 확률 계산

성별 매핑:
- `Male -> PTGENDER_num=1`
- `Female -> PTGENDER_num=2`

## 필수 입력 정책

기본 원칙:
- 필수값 누락 시 `DATA_MISSING`으로 종료, 확률 미반환

필수 필드:
- `CIST_ORIENT`, `CIST_ATTENTION`, `CIST_EXEC`, `CIST_MEMORY`, `CIST_LANGUAGE`, `entry_age`, `PTGENDER_num`

데모 모드:
- `allow_missing_demo=true`이면 결측 허용 및 imputer 결과 시각화 가능
- 기본값 OFF

## Local Sensitivity (SHAP 대체 설명)

기준 입력 `x`의 확률 `p0` 대비, feature별 작은 변동 후 `p1 - p0` 계산:
- CIST 항목: `+1`
- `entry_age/PTEDUCAT/VSBPSYS/BMI`: `min(고정값, bounds 폭의 5%)`
  - age `+2`, educ `+1`, sysBP `+5`, BMI `+1`
- 항상 bounds 내 clipping 후 계산

주의 문구:
- 이 값은 **현재 입력 주변 민감도**이며 **인과 관계가 아님**

## 버전 호환 이슈 가이드

joblib/pickle 로드 시 학습 환경과 실행 환경의 버전 차이로 실패할 수 있습니다.

이미 반영된 대응:
- `engine_loader.py`에서 로드 전 `sys.modules["numpy._core"] = numpy.core` 매핑 적용

추가 조치:
- `backend/requirements.txt`의 `scikit-learn`, `numpy`, `joblib` 버전 핀을 학습 환경에 맞게 조정
- 현재 제공 기본 핀: `scikit-learn==1.7.2`, `numpy==2.2.3` (본 모델 파일 로드 확인 버전)

## 심사위원 데모 시나리오

1. 정상 입력 (결측 OFF)
- `Run Scoring` 실행
- 단계 진행 확인 후 확률/리스크 구간/RF-HGB-Ensemble 확인

2. 일부 결측 + 데모 모드 ON
- 몇 개 항목을 `미입력`으로 체크
- `IMPUTING` 단계에서 채워진 값 확인
- 결과 비교 설명

3. bounds 밖 입력
- 예: `VSBPSYS=400` 같은 값 입력
- `CLIPPING` 단계에서 before/after/delta 확인

4. local sensitivity 설명
- 우측 차트에서 `p1-p0` 상위 feature를 설명
- "이 케이스 근처 민감도"임을 강조

## QA 체크리스트

- [ ] required_fields 누락 시 DATA_MISSING으로 종료되고 확률이 노출되지 않는가
- [ ] feature order가 engine['features']와 동일한가
- [ ] clipping 변화량이 정확히 표시되는가
- [ ] 결측 입력 시 imputed 값이 표시되는가(데모 모드 ON)
- [ ] RF/HGB/Ensemble 확률이 동시에 표시되는가
- [ ] local sensitivity가 bounds 내에서 계산되는가
- [ ] run_id 기반 상태 폴링이 끊김 없이 진행되는가
- [ ] 리포트 HTML이 한 페이지로 깔끔히 출력되는가

## 공통 테마(Neuro-Shield Tokens)

- 글로벌 토큰 파일: `frontend/theme.css`
- 엔트리 import: `frontend/index.html`에서 `theme.css`를 `styles.css`보다 먼저 로드
- 색상 정책:
  - `styles.css`, `app.js`에는 하드코딩 색상(HEX/RGB/HSL) 사용하지 않음
  - 상태/리스크/차트 색상은 `var(--success|--warning|--destructive|--risk-*|--chart-*)`만 사용
- 차트 팔레트:
  - `frontend/app.js`의 `cssVar()` + `chartPalette()` 유틸로 CSS 변수값을 읽어서 공급
