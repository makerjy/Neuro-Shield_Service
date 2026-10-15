# Neuro-Shield — ADNI 기반 다단계 치매 위험 분석 및 관리 시스템

> **프로젝트 포트폴리오:** [Neuro-Shield — ADNI 치매 위험 관리 프로젝트 (Notion)](https://app.notion.com/p/3f16cc14e6038187a443e966874a7d60)  
> **개인 담당 역할:** 프로젝트·서비스 기획 · 구현 · 시각화  
> **데이터 / 도메인:** ADNI3 임상·인지·MRI 관련 데이터 · 경도인지장애(MCI) · 알츠하이머병(AD)  
> **기술 스택:** React/Vite · FastAPI · PostgreSQL · Docker · Linux/Ubuntu · OCI

## 1. 프로젝트 개요

**Neuro-Shield**는 ADNI 데이터를 활용한 치매 위험 분석 결과를 **고위험군 선별(Screening) → 단계별 분석 → 사례 추적(Case Tracking) → 후속 관리(Follow-up)** 과정으로 연결하기 위해 기획·구현한 팀 프로젝트입니다.

핵심은 **모델이 산출한 위험 신호와 임상적 진단을 구분**하는 것입니다. 예측 결과를 곧바로 확정 진단으로 취급하거나 자동으로 의학적 결정을 내리는 대신, 추가 평가가 필요한 대상을 선별하고 담당자의 후속 조치를 지원하는 서비스 흐름을 설계했습니다.

---

## 2. 개인 담당 역할 (My Contributions)

저는 팀에서 **프로젝트·서비스 기획, 구현, 시각화**를 주로 담당했습니다.

- **서비스 기획:** 단계별 사용 흐름을 정의하고, 위험 예측 결과를 Screening·사례 추적·후속 관리에 연결하는 구조 설계
- **프론트엔드 및 시각화:** React/Vite 기반 화면, 대시보드, 사례별 조회 화면, 단계별 상태 추적 인터페이스 구현·구성
- **백엔드 및 데이터 관리:** FastAPI 백엔드 구성요소 개발·연동, PostgreSQL 기반 사례 및 업무 흐름 데이터 관리
- **배포 및 시스템 통합:** Docker Compose를 이용한 Web/API/DB 구성, Linux/OCI 환경의 배포 절차 정리
- **발표 및 문서화:** 프로젝트 목표, 서비스 구조, 모델 결과와 업무 흐름의 연결 방식, 오탐·개인정보·담당자 검토의 필요성 설명

> **개인 기여와 팀 성과의 구분**
>
> 아래의 ML·ANN·MRI 모델링은 **팀 전체 프로젝트에서 수행한 내용**입니다. 모든 모델을 제가 직접 설계·훈련·평가한 것은 아닙니다.
>
> 제 주요 기여는 **예측 결과를 실제 서비스에 연결하기 위한 기획·구현·시각화 작업**입니다.

---

## 3. ADNI 데이터 구성 및 종단 데이터 분석

팀 프로젝트에서는 ADNI3의 임상·인지 정보와 MRI 관련 정보를 함께 다뤘습니다.

### 주요 데이터

- 인구통계학적 정보, 진단 이력 및 방문(Visit) 기록
- MMSE, CDR/CDRSB, FAQ, 지연회상(Delayed Recall) 등 인지기능 평가 지표
- FreeSurfer 기반 구조적 MRI ROI 특징
- DTI ROI 요약 지표
- T1 MRI 데이터

**Stage 2 ANN 관련 팀 자료**에는 **533명 피험자의 1,042개 관측치**가 기록되어 있습니다.

| 항목 | 데이터 |
|---|---:|
| 전체 피험자 | 533명 |
| 전체 관측치 | 1,042건 |
| MCI 관측치 | 866건 |
| AD 관측치 | 176건 |
| 피험자당 평균 방문 횟수 | 약 1.95회 |

이러한 종단 데이터에서는 단순히 행(Row)을 무작위로 나누는 것보다 다음 사항을 고려해야 합니다.

- **피험자 단위 데이터 분리(Subject-wise Split):** 동일 피험자의 정보가 학습·평가 데이터에 동시에 섞이지 않도록 관리
- **기준 시점(Baseline)과 방문 순서 정의:** 어떤 시점의 정보를 입력으로 사용할지 구분
- **추적 관찰 기간(Follow-up Window):** 질환의 변화를 관찰할 수 있는 기간 확인
- **데이터 누수(Leakage) 방지:** 미래 진단 정보가 기준 시점의 입력 변수에 포함되지 않도록 주의
- **클래스 불균형(Class Imbalance):** MCI와 AD 표본 수 차이가 평가에 미치는 영향 고려

---

## 4. 팀 전체 모델링 파이프라인 (Team Modeling Pipeline)

### Stage 1 — 고위험군 선별(Screening)

첫 단계는 확정적인 치매 진단이 아니라, **추가 평가나 우선 확인이 필요한 대상을 선별**하는 단계입니다.

모델이 산출한 위험도를 서비스에서 활용할 수 있도록 우선 검토 신호와 후속 관리 절차로 연결했습니다.

### Stage 2 — ANN 기반 위험도 분석

팀의 ANN 모델링 과정에서는 방문 시점과 피험자 단위로 데이터를 정렬하고, 결측치 처리와 특징 공학(Feature Engineering), 정규화/스케일링을 수행했습니다.

**주요 과정**

1. 피험자·방문 기록 정렬 및 Forward Fill
2. 학습 데이터에서 적합한 MICE 기반 결측치 대치(Imputation)
3. 특징 생성 및 스케일링
4. 건강 정보(Health), 인지 정보(Cognitive), 파생 특징(Engineered Features) 그룹 구성
5. Multi-input ANN 및 Soft-voting 결합 모델 학습

**팀 자료에 기록된 성능**

| 평가지표 | 결과 |
|---|---:|
| Accuracy | **0.90** |
| Macro F1 | **0.86** |
| Weighted F1 | **0.91** |
| AD Recall | **0.93** |

MCI 위험군을 Low/Mid/High로 나눈 결과는 별도의 확정된 임상 진단 분류가 아니라 **ANN의 AD 예측 확률에 임계값을 적용한 위험도 구분**입니다.

### Stage 3 — MRI 및 멀티모달 분석

팀 자료에서는 약 **1,127명의 피험자**, **13,590장의 2D MRI 슬라이스**를 활용한 **CN / MCI / Dementia 3-class 분류**가 기록되어 있습니다.

**주요 전처리·분석 절차**

- DICOM / NIfTI 형식 처리
- 영상 정합(Registration) 및 방향(Orientation) 정리
- Skull Stripping
- Bias Field Correction
- Intensity Normalization
- Axial / Coronal / Sagittal 방향별 슬라이스 구성
- 이미지 크기 조정 및 잡음 제거(Denoising)
- 데이터 증강(Augmentation)

모델은 **EfficientNet 기반 전이학습(Transfer Learning)**과 Attention 구조를 활용했습니다.

**팀 자료에 기록된 성능**

| 평가지표 | 결과 |
|---|---:|
| Test Accuracy | **91.4%** |
| Macro F1 | **0.89** |
| Test Loss | **0.28** |

분류 결과는 다음 방법을 통해 검토했습니다.

- Confusion Matrix
- Calibration Curve
- Occlusion Sensitivity
- Heatmap 기반 결과 해석

> 위 수치는 **팀 프로젝트에서 보고한 결과**입니다. 제가 별도로 재현·검증한 개인 실험 성과가 아니며, 임상적 유효성이 검증된 진단 성능을 의미하지 않습니다.
### 단계별 사용 모델 요약

| 단계 | 사용 모델 | 핵심 역할 |
|---|---|---|
| **Stage 1 — 1차 선별** | **XGBoost(XGB) 기반 앙상블 모델** | 연령·생활습관·간이인지검사 정보를 이용한 정상군 및 고위험군 선별 |
| **Stage 2 — 고위험군 등급화** | **ANN 5개 + Soft Voting Ensemble** | 서로 다른 Seed로 학습한 ANN의 예측 확률을 결합하여 위험군 세분화 |
| **Stage 3 — 멀티모달 통합 예측** | **MRI CNN + 임상·유전정보 ANN + Weighted Average Ensemble** | MRI 영상과 임상·바이오마커 정보의 예측 결과를 가중 결합 |

#### Stage 1 — XGBoost 기반 1차 선별

- **모델:** XGBoost 기반 앙상블 모델
- **입력:** 연령, 나이, 생활습관, 간이인지검사 등
- **목적:** 정상군과 고위험군(경도인지장애·치매 관련 위험군) 1차 구분

#### Stage 2 — ANN 기반 고위험군 등급화

- **모델:** ANN(Artificial Neural Network) 5개
- **앙상블:** Soft Voting
- **입력:** 성별, 혈압, BMI, MMSE, CDRSB, FAQ 등 임상·인지 변수
- **목적:** 예측 확률을 활용해 MCI 위험군을 Low / Mid / High로 세분화

서로 다른 Seed로 학습한 5개의 ANN 모델이 각각 예측 확률을 출력하고,
이를 Soft Voting으로 결합하는 구조입니다.

#### Stage 3 — CNN·ANN 기반 멀티모달 통합 예측

- **MRI 영상 모델:** CNN(Convolutional Neural Network)
- **임상·유전정보 모델:** ANN(Artificial Neural Network)
- **앙상블:** Weighted Average Ensemble
- **입력:** 임상평가, MRI 이미지, 바이오마커 정보
- **목적:** 영상·비영상 정보를 함께 활용한 통합 위험도 예측

MRI CNN과 임상·유전정보 ANN이 각각 예측값을 산출한 뒤,
두 결과를 가중 평균 방식으로 결합하여 최종 예측을 수행합니다.


> 

### 확장 분석 — MCI에서 AD로의 전환(Progression Analysis)

프로젝트에서는 현재 시점의 상태를 분류하는 문제에서 나아가 **MCI → AD 전환 위험**을 시간의 관점에서 분석하는 방법도 다뤘습니다.

- Baseline MCI 코호트 및 추적 진단 정보 구성
- 검열(Censoring) 개념
- Kaplan–Meier 생존 분석
- Random Survival Forest

이를 통해 **"현재 어떤 상태인가?"**뿐 아니라 **"시간이 지나면서 AD 전환 위험이 어떻게 달라질 수 있는가?"**라는 질문을 살펴봤습니다.

---

## 5. 서비스 아키텍처

```text
ADNI 기반 분석 및 팀 모델 예측 결과
                 ↓
          위험도 / 단계별 신호
                 ↓
             FastAPI
          서비스 및 API 계층
                 ↓
           PostgreSQL
       사례·상태·업무 흐름 관리
                 ↓
            React/Vite
       대시보드·추적 관리 화면
```

### Risk Signal ≠ Clinical Diagnosis

예측 점수만으로 의료적 판단을 확정하지 않고, 담당자가 확인·추적·관리하는 **Human-in-the-Loop** 구조를 지향했습니다.

이 프로젝트는 임상에 배포된 의료기기나 검증된 진단 시스템이 아니라 **연구·학습 목적의 팀 프로젝트**입니다.

---

## 6. 프로젝트를 통해 배운 점

### ① 종단 데이터에서는 데이터 구성 자체가 중요함

피험자 단위 분리, Baseline 정의, Follow-up, 결측치 처리, Leakage Control에 따라 모델의 평가 결과와 해석이 달라질 수 있습니다.

### ② 멀티모달 분석은 서로 다른 특징을 단순히 합치는 문제가 아님

Clinical, Cognitive, MRI 데이터는 측정 방법과 관측 시점이 다르므로 **동일 피험자와 시점을 기준으로 정합성 있게 연결**하는 과정이 중요합니다.

### ③ 모델의 예측 성능과 실제 서비스 활용은 별개임

모델의 위험도 출력을 운영자가 활용할 수 있는 **우선순위·다음 행동·추적 상태**로 변환하려면 서비스·데이터 구조를 별도로 설계해야 한다는 점을 배웠습니다.

### ④ 현재 관심 있는 연구 방향

뇌와 컴퓨터의 연결(BCI), 뇌 구조 및 기능에 대한 관심은 고등학교 때부터 가지고 있었습니다.

ADNI 프로젝트를 경험하며 관심을 더욱 구체화했고, 현재는 **MRI/fMRI·EEG 등 뇌영상과 생체신호를 전처리하고 멀티모달로 통합하여 AI 모델을 구축·평가하고, 의미 있는 특징이나 질환 관련 패턴을 발견하는 연구**에 관심이 있습니다.

치매 위험 관리 프로젝트는 이러한 관심을 실제 데이터와 서비스에 적용해 본 **여러 응용 분야 중 하나**입니다.

---

## 7. 저장소 구성

| 경로 | 설명 |
|---|---|
| `src/` | React/Vite 기반 프론트엔드 |
| `server_fastapi/` | FastAPI 백엔드 |
| `deploy/` | 배포 관련 구성 |
| `docker-compose.yml` | 서비스 컨테이너 구성 |
| `3-step_model_final/` | 팀 프로젝트의 단계별 모델 관련 통합 자료 |

---

## 8. 개발 환경 및 실행 방법

> 아래 명령어는 **서비스 개발·실행을 위한 안내**입니다. ADNI 원본 데이터와 별도 실험 환경 없이 팀 전체의 전처리·모델 학습·성능 평가를 완전히 재현할 수 있다는 의미는 아닙니다.

### 프론트엔드 실행

```bash
npm i
npm run dev
```

### 로컬 백엔드 실행

```bash
docker compose up -d api db redis minio sms worker beat
```

필요한 경우 다음 명령을 통해 로컬 API를 외부에 노출할 수 있습니다.

```bash
cloudflared tunnel --url http://localhost:80
```

배포된 프론트엔드의 URL에 다음과 같이 쿼리 파라미터를 추가하여 접속할 수 있습니다.

```text
https://<deployed-frontend>/neuro-shield/?apiBase=https://<tunnel-host>
```

외부 접속 도메인에 맞춰 `.env`의 `CORS_ORIGINS`를 설정한 뒤 아래 명령으로 API 컨테이너를 재빌드할 수 있습니다.

```bash
docker compose up -d --build api
```

### API 주소 적용 우선순위

1. URL 쿼리 파라미터 `apiBase`
2. 브라우저 `localStorage["neuro_shield_api_base"]`
3. 빌드 환경변수 `VITE_API_BASE_URL`

**UI 디자인 참고:** [Figma — UI/UX Structure Enhancement](https://www.figma.com/design/WjxvjXNuFweVSxoHZ6PNBJ/UI-UX-Structure-Enhancement)

---

## 9. 상세 프로젝트 포트폴리오

연구 배경, ADNI 데이터 구성, 팀의 모델링 과정 및 개인 담당 역할은 별도의 Notion 포트폴리오에 상세히 정리했습니다.

**[Neuro-Shield — ADNI Dementia Risk Management Portfolio (Notion)](https://app.notion.com/p/3f16cc14e6038187a443e966874a7d60)**
