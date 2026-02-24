import type { ActiveCaseState, PipelineStep, StageKey } from "./types";

export const DEFAULT_SEED = 20260223;

export const FIXED_ACTIVE_CASE: ActiveCaseState = {
  caseId: "case-2026-175",
  ptid: "002_S_1155",
  name: "김복남(가명)",
  ageBand: "70s",
  currentStage: "stage1",
  stageStatus: "IDLE",
  badges: [],
  previous: {},
};

export const FLOW_NODES = [
  "stage1",
  "stage2",
  "stage3",
] as const;

export const STAGE_STAGE_TO_FLOW_INDEX: Record<StageKey, number> = {
  stage1: 0,
  stage2: 1,
  stage3: 2,
};

export const STAGE_CARD_COPY: Record<
  StageKey,
  {
    title: string;
    subtitle: string;
    io: string;
  }
> = {
  stage1: {
    title: "1차 선별(ML)",
    subtitle: "건강검진/생활습관 기반 위험도 산출",
    io: "입력: 건강/인지 기초값 · 출력: 위험확률/접촉우선순위",
  },
  stage2: {
    title: "2차 감별(ANN)",
    subtitle: "인지/혈액/문진 기반 3중 분류",
    io: "입력: Stage1 + 인지/바이오 · 출력: LOW/HIGH_MCI, AD",
  },
  stage3: {
    title: "추적 관리(멀티모달)",
    subtitle: "Stage1/2 + 영상(CNN) 기반 전환위험 추적",
    io: "입력: Stage1/2 + MRI · 출력: Year1/Year2 전환위험",
  },
};

export const STAGE_LABELS: Record<StageKey, string> = {
  stage1: "Stage1",
  stage2: "Stage2",
  stage3: "Stage3",
};

export const STAGE_PIPELINE_STEPS: Record<StageKey, PipelineStep[]> = {
  stage1: [
    { key: "validate", label: "입력 검증", status: "pending" },
    { key: "preprocess", label: "결측/스케일링(전처리)", status: "pending" },
    { key: "infer", label: "모델 추론", status: "pending" },
    { key: "post", label: "후처리(라벨/확률)", status: "pending" },
    { key: "store", label: "결과 저장 준비", status: "pending" },
  ],
  stage2: [
    { key: "validate", label: "입력 검증", status: "pending" },
    { key: "preprocess", label: "결측/스케일링(전처리)", status: "pending" },
    { key: "infer", label: "3-Branch ANN 추론", status: "pending" },
    { key: "post", label: "후처리(3중 분류)", status: "pending" },
    { key: "store", label: "결과 저장 준비", status: "pending" },
  ],
  stage3: [
    { key: "validate", label: "입력 검증", status: "pending" },
    { key: "preprocess", label: "영상/메타 전처리", status: "pending" },
    { key: "infer", label: "CNN/Fusion 추론", status: "pending" },
    { key: "post", label: "후처리(Year1/Year2)", status: "pending" },
    { key: "store", label: "결과 저장 준비", status: "pending" },
  ],
};

export const STAGE_LOG_TEMPLATES: Record<StageKey, string[]> = {
  stage1: [
    "feature check... CIST/건강정보 스키마 확인",
    "missing scan... 필수 입력 결측 여부 확인",
    "clipping... 정상 범위를 벗어난 값 보정",
    "scaling... stage1 scaler 변환 중",
    "inference batch... risk head 계산",
    "post-process... 관심 카테고리 규칙 적용",
    "queue sync... 운영 루프 상태 전파",
  ],
  stage2: [
    "feature check... 3-branch 입력 shape 검증",
    "imputation... 연령/성별 그룹 중앙값 대체",
    "engineering... 파생 피처 5종 생성",
    "scaling... ANN 입력 정규화",
    "inference batch... 5-seed soft voting 계산",
    "post-process... LOW/HIGH_MCI, AD 확률 정리",
    "queue sync... Stage3 연계 태그 갱신",
  ],
  stage3: [
    "feature check... 영상/메타 입력 검증",
    "resize... 224x224 규격 변환",
    "preprocess... efficientnet 입력 변환",
    "inference batch... CNN biomarker score 계산",
    "fusion... Stage1/2 결과와 결합",
    "post-process... Year1/Year2 위험도 산출",
    "queue sync... 추적관리 플랜 상태 반영",
  ],
};
