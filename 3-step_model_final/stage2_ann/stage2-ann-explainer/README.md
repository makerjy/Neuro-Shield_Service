# Stage2 ANN Model Explainer (Neuro-Shield)

심사위원 시연용 `Stage2 ANN` 설명 콘솔입니다.
한 화면에서 입력 → 전처리/결측 보정 → 엔지니어링 피처 → 스케일링 → 3-branch binary 앙상블 추론 → 데모용 5중 확률 투영 → 로컬 민감도를 단계별로 보여줍니다.

## 1) 실행

```bash
cd /Users/ijaeyong/projects/Oracle_team6_final/stage2_ann/stage2-ann-explainer
docker-compose up --build
```

- Frontend: http://localhost:5190
- Backend API: http://localhost:8010

## 2) 구조

```text
/stage2-ann-explainer
  /backend
    main.py
    engine_loader.py
    preprocess.py
    explainers.py
    run_store.py
    schemas.py
    requirements.txt
    /assets
      ADNI3_Golden_Master_Longitudinal.csv
      stage2_scaler_v4.pkl (optional)
    /exports
  /frontend
    index.html
    styles.css
    app.js
    nginx.conf
  docker-compose.yml
  README.md

/3-step_model_final
  /stage2_modelfinal
    best_stage2_binary_ann_seed42.keras
    best_stage2_binary_ann_seed99.keras
    best_stage2_binary_ann_seed123.keras
    best_stage2_binary_ann_seed777.keras
    best_stage2_binary_ann_seed2024.keras
```

## 3) 핵심 모델 설명

- `stage2_modelfinal` 기준 5-seed binary ANN 앙상블
  - Seed: `42, 99, 123, 777, 2024`
  - 입력 브랜치: `Health(25)`, `Cognitive(4)`, `Engineering(5)`
  - 각 seed 모델은 `P(AD)`를 출력하고 soft-voting 평균으로 최종 `P(AD)` 계산
- UI/운영 연동을 위해 데모용 5단 라벨로 투영
  - `[CN, MCI_Low, MCI_Mid, MCI_High, AD]`
  - `P(AD)` 기준: `<0.30 = MCI_Low`, `<0.65 = MCI_Mid`, `>=0.65 = MCI_High/AD`

## 4) risk_label 생성 규칙 (학습 코드 기준)

- `label == 0` -> `risk_label=0 (CN)`
- `label == 2` -> `risk_label=4 (AD)`
- `label == 1` -> `CDRSB` 기준 세분화
  - `<= 0.5` -> `1 (MCI_Low)`
  - `<= 2.0` -> `2 (MCI_Mid)`
  - else -> `3 (MCI_High)`

주의: 위 매핑은 제공된 학습 코드 관찰 기반의 **데모 기준 매핑**입니다.

## 5) 엔지니어링 피처

- `FAQ_LDELTA_ratio = FAQTOTAL / (LDELTOTAL + 1)`
- `high_risk_score = CDRSB*2 + FAQTOTAL - LDELTOTAL`
- `med_cog_risk = dementia_med + COG_DISORDER`
- `CDRSB_MMSE_ratio = CDRSB / (MMSCORE + 1)`
- `cog_composite = MMSCORE - CDRSB*2 - FAQTOTAL*0.5`

## 6) 결측/스케일러 처리

- 필수 입력 7개(`entry_age`, `PTGENDER`, `VSBPSYS`, `CDRSB`, `MMSCORE`, `FAQTOTAL`, `LDELTOTAL`)가 누락되고 `결측 허용(데모 모드)`가 꺼져 있으면 `DATA_MISSING`으로 종료합니다.
- 결측 허용 모드에서는 `age_group(10년)` + `PTGENDER` 그룹 중앙값 우선, 없으면 전체 중앙값으로 대체합니다.
- 스케일러 로드 전략
  1. `backend/assets/stage2_scaler_v4.pkl` 존재 시 우선 사용
  2. 없으면 CSV 기반으로 전처리 후 `StandardScaler` 재학습(fit)

주의: 2번은 데모용 재구성으로 학습 환경과 완전히 동일하지 않을 수 있습니다.

## 7) 3분 시연 플로우

1. 샘플에서 `CN` 선택 후 실행
2. 중앙 스텝퍼에서 `IMPUTING -> ENGINEERING -> SCALING -> SPLITTING -> INFERENCING -> EXPLAINING` 진행 확인
3. `MCI_High` 샘플 실행 후 `FAQ_LDELTA_ratio`, `high_risk_score`와 확률 변화 강조
4. `AD` 샘플 실행 후 `Stage3 추적 대상` 배지 확인
5. `Local Sensitivity Top10`으로 어떤 입력이 민감했는지 설명

## 8) API 요약

- `GET /api/meta`
- `GET /api/samples`
- `GET /api/sample/{id}`
- `POST /api/run`
- `GET /api/run/{run_id}`
- `POST /api/batch/score` (선택)

## 9) 면책

- 본 서비스는 심사/설명용이며 의료적 진단을 대체하지 않습니다.
- Local sensitivity는 인과 추론이 아니라, 현재 입력 주변의 국소 민감도입니다.

## 10) QA 체크리스트

- [x] 필수 입력 누락 시 `DATA_MISSING` 종료 및 확률 미노출
- [x] 엔지니어링 피처 5개 계산식 반영
- [x] `stage2_scaler_v4.pkl` 우선 사용, 없으면 CSV 기반 `StandardScaler` fallback
- [x] 3-branch split 후 `model.predict([X_h, X_c, X_e])` 수행
- [x] 5개 확률 + 합계(`prob_sum`) 제공
- [x] Local sensitivity Top10 및 method note 제공
- [x] 샘플 선택 → 입력 자동 채움 → 실행 연동
- [x] 스텝퍼 기반 설명 흐름(VALIDATING~COMPLETED)
