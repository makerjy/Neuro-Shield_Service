/* ──────────────────────────────────────────────────────────
   모델 적용 센터 – Mock 데이터
   ────────────────────────────────────────────────────────── */
import type {
  PipelineKpi,
  StageOverview,
  ModelUseNode,
  ModelUseEdge,
  InspectorContent,
  ModelCenterViewModel,
  BatchMeta,
  DispatchLog,
  Stage2Distribution,
  Stage3Enrollment,
  Stage3CaseResult,
  RiskBand,
} from "./modelCenter.types";

const BASE_DATE = "2026-02-12";
const D1_SCOPE_LINE = `기준: ${BASE_DATE} · D-1`;

export const MOCK_BATCH_META: BatchMeta = {
  baseDate: BASE_DATE,
  receiveDeadline: "08:30",
  modelWindow: "08:35-08:48",
  dispatchTime: "08:52",
  status: "partial",
  impactedStages: ["S2", "S3"],
  notes: "일부 기관(7개) 결과 지연으로 Stage2/3 집계가 부분 반영되었습니다.",
  receiveRate: 76.4,
  missingInstitutionCount: 7,
  expectedRetryAt: "2026-02-13 11:30",
};

export const MOCK_STAGE2_DISTRIBUTION: Stage2Distribution = {
  baseDate: BASE_DATE,
  receivedN: 157_204,
  adPct: 23.4,
  mciPct: 62.1,
  normalPct: 14.5,
};

export const MOCK_STAGE3_ENROLLMENT: Stage3Enrollment = {
  baseDate: BASE_DATE,
  stage2ReceivedN: 157_204,
  mciEnrollPct: 78.6,
  adEnrollPct: 64.2,
};

const STAGE3_MODEL_VERSION = {
  cnn_mri_extractor: "v1.0.3",
  ann_multimodal_conversion: "v2.1.0",
  guardrails: "v1.0.0",
};

const STAGE3_INPUTS_SUMMARY = {
  stage1_sources: ["health_check", "survey_lifestyle", "admin_info", "history"],
  stage2_sources: ["cognition_summary", "blood_biomarker", "pre_questionnaire", "medication_dx_history"],
  mri_cnn_used: true,
};

const DEFAULT_STAGE3_ACTIONS = ["3개월 추적", "보호자 동반 상담"];

export const MOCK_STAGE3_CASES: Stage3CaseResult[] = [
  {
    case_id: "C-2026-000101",
    stage: 3,
    model_version: STAGE3_MODEL_VERSION,
    inputs_summary: STAGE3_INPUTS_SUMMARY,
    upstream_cnn_signal: { mri_quality: "OK", cnn_risk_score: 0.18, key_rois: ["hippocampus_stable"] },
    outputs: {
      conversion_risk_2y: 0.14,
      conversion_risk_band_2y: "Low",
      conversion_reason_codes: ["MMSE_STABLE", "BIO_LOW_RISK", "MRI_STABLE"],
      conversion_top_features: [{ name: "MMSE trend", contribution: 0.11 }, { name: "p-tau", contribution: 0.08 }],
      followup_priority: "Low",
      recommended_actions: ["6개월 추적", "생활습관 교육"],
      guardrail_flags: [],
    },
  },
  {
    case_id: "C-2026-000102",
    stage: 3,
    model_version: STAGE3_MODEL_VERSION,
    inputs_summary: STAGE3_INPUTS_SUMMARY,
    upstream_cnn_signal: { mri_quality: "WARN", cnn_risk_score: 0.42, key_rois: ["temporal_cortex_thinning"] },
    outputs: {
      conversion_risk_2y: 0.33,
      conversion_risk_band_2y: "Med",
      conversion_reason_codes: ["MMSE_DROP", "MRI_TEMPORAL_THINNING", "FAMILY_HISTORY"],
      conversion_top_features: [{ name: "MMSE trend", contribution: 0.17 }, { name: "CNN MRI risk", contribution: 0.14 }],
      followup_priority: "Med",
      recommended_actions: DEFAULT_STAGE3_ACTIONS,
      guardrail_flags: ["MRI_QUALITY_WARN"],
    },
  },
  {
    case_id: "C-2026-000103",
    stage: 3,
    model_version: STAGE3_MODEL_VERSION,
    inputs_summary: STAGE3_INPUTS_SUMMARY,
    upstream_cnn_signal: { mri_quality: "OK", cnn_risk_score: 0.63, key_rois: ["hippocampus_volume_low"] },
    outputs: {
      conversion_risk_2y: 0.58,
      conversion_risk_band_2y: "High",
      conversion_reason_codes: ["MRI_HIPPOCAMPUS_LOW", "BIO_PTAU_HIGH", "MMSE_DROP"],
      conversion_top_features: [{ name: "p-tau", contribution: 0.21 }, { name: "CNN MRI risk", contribution: 0.15 }],
      followup_priority: "High",
      recommended_actions: ["MRI 재촬영 검토", "3개월 추적", "보호자 동반 상담"],
      guardrail_flags: [],
    },
  },
  {
    case_id: "C-2026-000104",
    stage: 3,
    model_version: STAGE3_MODEL_VERSION,
    inputs_summary: STAGE3_INPUTS_SUMMARY,
    upstream_cnn_signal: { mri_quality: "OK", cnn_risk_score: 0.48, key_rois: ["parietal_atrophy_index_high"] },
    outputs: {
      conversion_risk_2y: 0.41,
      conversion_reason_codes: ["IADL_DECLINE", "MRI_PARIETAL_ATROPHY", "BIO_BORDERLINE"],
      conversion_top_features: [{ name: "IADL change", contribution: 0.16 }, { name: "CNN MRI risk", contribution: 0.13 }],
      followup_priority: "Med",
      recommended_actions: DEFAULT_STAGE3_ACTIONS,
      guardrail_flags: [],
    },
  },
  {
    case_id: "C-2026-000105",
    stage: 3,
    model_version: STAGE3_MODEL_VERSION,
    inputs_summary: STAGE3_INPUTS_SUMMARY,
    upstream_cnn_signal: { mri_quality: "WARN", cnn_risk_score: 0.54, key_rois: ["temporal_cortex_thinning"] },
    outputs: {
      conversion_risk_2y: 0.47,
      conversion_risk_band_2y: "Med",
      conversion_reason_codes: ["MMSE_DROP", "APOE4_POSITIVE", "MRI_TEMPORAL_THINNING"],
      conversion_top_features: [{ name: "APOE4", contribution: 0.18 }, { name: "MMSE trend", contribution: 0.16 }],
      followup_priority: "High",
      recommended_actions: ["정밀검사 경로 재검토", "3개월 추적"],
      guardrail_flags: ["PARTIAL_STAGE2_RECEIVED"],
    },
  },
  {
    case_id: "C-2026-000106",
    stage: 3,
    model_version: STAGE3_MODEL_VERSION,
    inputs_summary: STAGE3_INPUTS_SUMMARY,
    upstream_cnn_signal: { mri_quality: "OK", cnn_risk_score: 0.22, key_rois: ["hippocampus_stable"] },
    outputs: {
      conversion_risk_2y: 0.19,
      conversion_risk_band_2y: "Low",
      conversion_reason_codes: ["MMSE_STABLE", "BIO_LOW_RISK", "FOLLOWUP_ADHERENT"],
      conversion_top_features: [{ name: "Follow-up adherence", contribution: 0.12 }, { name: "MMSE trend", contribution: 0.1 }],
      followup_priority: "Low",
      recommended_actions: ["6개월 추적", "전화 모니터링"],
      guardrail_flags: [],
    },
  },
  {
    case_id: "C-2026-000107",
    stage: 3,
    model_version: STAGE3_MODEL_VERSION,
    inputs_summary: STAGE3_INPUTS_SUMMARY,
    upstream_cnn_signal: { mri_quality: "OK", cnn_risk_score: 0.67, key_rois: ["hippocampus_volume_low", "temporal_cortex_thinning"] },
    outputs: {
      conversion_risk_2y: 0.62,
      conversion_risk_band_2y: "High",
      conversion_reason_codes: ["BIO_PTAU_HIGH", "MMSE_DROP", "MRI_HIPPOCAMPUS_LOW"],
      conversion_top_features: [{ name: "p-tau", contribution: 0.22 }, { name: "CNN MRI risk", contribution: 0.16 }],
      followup_priority: "High",
      recommended_actions: ["MRI 재촬영 검토", "3개월 추적", "보호자 동반 상담"],
      guardrail_flags: [],
    },
  },
  {
    case_id: "C-2026-000108",
    stage: 3,
    model_version: STAGE3_MODEL_VERSION,
    inputs_summary: STAGE3_INPUTS_SUMMARY,
    upstream_cnn_signal: { mri_quality: "WARN", cnn_risk_score: 0.39, key_rois: ["frontal_cortex_borderline"] },
    outputs: {
      conversion_risk_2y: 0.29,
      conversion_reason_codes: ["SLEEP_ISSUE", "MMSE_MINOR_DROP", "MRI_BORDERLINE"],
      conversion_top_features: [{ name: "Sleep quality", contribution: 0.12 }, { name: "CNN MRI risk", contribution: 0.11 }],
      followup_priority: "Med",
      recommended_actions: DEFAULT_STAGE3_ACTIONS,
      guardrail_flags: ["MRI_QUALITY_WARN"],
    },
  },
  {
    case_id: "C-2026-000109",
    stage: 3,
    model_version: STAGE3_MODEL_VERSION,
    inputs_summary: STAGE3_INPUTS_SUMMARY,
    upstream_cnn_signal: { mri_quality: "OK", cnn_risk_score: 0.71, key_rois: ["hippocampus_volume_low", "parietal_atrophy_index_high"] },
    outputs: {
      conversion_risk_2y: 0.69,
      conversion_risk_band_2y: "High",
      conversion_reason_codes: ["MRI_HIPPOCAMPUS_LOW", "MMSE_SHARP_DROP", "BIO_PTAU_HIGH"],
      conversion_top_features: [{ name: "CNN MRI risk", contribution: 0.2 }, { name: "MMSE trend", contribution: 0.18 }],
      followup_priority: "High",
      recommended_actions: ["정밀검사 우선 배정", "3개월 추적", "가족 상담"],
      guardrail_flags: ["PARTIAL_STAGE2_RECEIVED"],
    },
  },
  {
    case_id: "C-2026-000110",
    stage: 3,
    model_version: STAGE3_MODEL_VERSION,
    inputs_summary: STAGE3_INPUTS_SUMMARY,
    upstream_cnn_signal: { mri_quality: "OK", cnn_risk_score: 0.31, key_rois: ["temporal_cortex_mild_change"] },
    outputs: {
      conversion_risk_2y: 0.24,
      conversion_risk_band_2y: "Med",
      conversion_reason_codes: ["MMSE_MINOR_DROP", "BIO_BORDERLINE", "MRI_MILD_CHANGE"],
      conversion_top_features: [{ name: "MMSE trend", contribution: 0.14 }, { name: "Biomarker", contribution: 0.12 }],
      followup_priority: "Med",
      recommended_actions: ["6개월 추적", "인지훈련 프로그램 연계"],
      guardrail_flags: [],
    },
  },
];

function resolveRiskBand(risk: number, band?: RiskBand): RiskBand {
  if (band) return band;
  if (risk < 0.2) return "Low";
  if (risk < 0.5) return "Med";
  return "High";
}

const STAGE3_CASES_WITH_BAND = MOCK_STAGE3_CASES.map((item) => ({
  ...item,
  outputs: {
    ...item.outputs,
    conversion_risk_band_2y: resolveRiskBand(item.outputs.conversion_risk_2y, item.outputs.conversion_risk_band_2y),
  },
}));

const STAGE3_AVG_RISK_PCT = Number(
  (
    (STAGE3_CASES_WITH_BAND.reduce((acc, item) => acc + item.outputs.conversion_risk_2y, 0) /
      STAGE3_CASES_WITH_BAND.length) *
    100
  ).toFixed(1),
);

const STAGE3_BAND_COUNTS = STAGE3_CASES_WITH_BAND.reduce(
  (acc, item) => {
    const band = item.outputs.conversion_risk_band_2y as RiskBand;
    acc[band] += 1;
    return acc;
  },
  { Low: 0, Med: 0, High: 0 } as Record<RiskBand, number>,
);

export const MOCK_DISPATCH_LOGS: DispatchLog[] = [
  {
    stage: "S1",
    destination: "치매안심센터",
    sentCount: 38_124,
    failedCount: 18,
    retryCount: 18,
    lastSentAt: "2026-02-13 08:53",
    slaStatus: "ok",
  },
  {
    stage: "S2",
    destination: "광역",
    sentCount: 11_832,
    failedCount: 64,
    retryCount: 41,
    lastSentAt: "2026-02-13 08:54",
    slaStatus: "delayed",
  },
  {
    stage: "S3",
    destination: "중앙",
    sentCount: 7_405,
    failedCount: 39,
    retryCount: 27,
    lastSentAt: "2026-02-13 08:56",
    slaStatus: "delayed",
  },
];

/* ════════════════════════════════════════════════════════════
   A. KPI Strip (8개)
   ════════════════════════════════════════════════════════════ */
export const MOCK_KPIS: PipelineKpi[] = [
  {
    key: "total-subjects",
    label: "전체 대상자",
    value: 1_247_653,
    unit: "명",
    delta: 1.2,
    baseDate: BASE_DATE,
    scopeLine: D1_SCOPE_LINE,
    status: "neutral",
    help: { title: "전체 대상자", body: `기준일(D-1): ${BASE_DATE}\n전국 치매안심센터 등록 대상자 합계 (비식별 집계)` },
  },
  {
    key: "s1-applied-rate",
    label: "1차 선별 적용률",
    value: 87.3,
    unit: "%",
    delta: 2.1,
    baseDate: BASE_DATE,
    scopeLine: D1_SCOPE_LINE,
    status: "good",
    help: { title: "1차 선별 적용률", body: `기준일(D-1): ${BASE_DATE}\n모델/규칙 기반 1차 선별이 적용된 대상자 비율` },
    jumpTo: "stage1",
    modeOverride: {
      quality: { label: "1차 데이터 누락률", value: 4.2, unit: "%", status: "warn" },
      audit: { label: "1차 미적용 사유 Top1", value: 56.3, unit: "%", status: "warn" },
    },
  },
  {
    key: "s1-high-risk-rate",
    label: "1차 고위험 신호율",
    value: 12.3,
    unit: "%",
    delta: -0.8,
    baseDate: BASE_DATE,
    scopeLine: D1_SCOPE_LINE,
    status: "warn",
    help: { title: "1차 고위험 신호율", body: `기준일(D-1): ${BASE_DATE}\n모델 위험도 추정 기반 '고위험' 대상자 비율 (판단 보조 신호)` },
    jumpTo: "stage1",
  },
  {
    key: "s2-receive-rate",
    label: "2차 분류 수신률",
    value: 76.4,
    unit: "%",
    delta: -1.7,
    baseDate: BASE_DATE,
    partialStages: ["S2", "S3"],
    scopeLine: D1_SCOPE_LINE,
    status: "warn",
    help: { title: "2차 분류 수신률", body: `기준일(D-1): ${BASE_DATE}\n의료기관으로부터 2차 진단 분류 결과를 수신한 비율\n수신률 80% 미만으로 부분 집계 상태` },
    jumpTo: "stage2",
    modeOverride: {
      quality: { label: "2차 불일치율", value: 6.8, unit: "%", status: "warn" },
      audit: { label: "2차 결과 지연", value: 18.3, unit: "일", status: "risk" },
    },
  },
  {
    key: "s2-distribution",
    label: "2차 분류 분포(MCI/AD)",
    value: MOCK_STAGE2_DISTRIBUTION.adPct,
    valuePrefix: "AD",
    secondaryValueLine: `MCI ${MOCK_STAGE2_DISTRIBUTION.mciPct}%`,
    unit: "%",
    delta: 1.1,
    baseDate: BASE_DATE,
    partialStages: ["S2"],
    scopeLine: D1_SCOPE_LINE,
    status: "risk",
    help: {
      title: "2차 분류 분포(MCI/AD)",
      body:
        `기준일(D-1): ${MOCK_STAGE2_DISTRIBUTION.baseDate}\n` +
        `분모: 2차 기관 결과 수신 완료 ${MOCK_STAGE2_DISTRIBUTION.receivedN.toLocaleString()}명\n` +
        `AD ${MOCK_STAGE2_DISTRIBUTION.adPct}% · MCI ${MOCK_STAGE2_DISTRIBUTION.mciPct}% · 정상 ${MOCK_STAGE2_DISTRIBUTION.normalPct}%\n` +
        "기관 결과 기반",
    },
    jumpTo: "stage2",
  },
  {
    key: "s3-enrollment-rate",
    label: "2년 전환위험(MCI→AD)",
    value: STAGE3_AVG_RISK_PCT,
    secondaryValueLine: "멀티모달 ANN (S1/2 + MRI-CNN)",
    unit: "%",
    delta: 1.8,
    baseDate: BASE_DATE,
    partialStages: ["S3"],
    scopeLine: D1_SCOPE_LINE,
    status: "warn",
    help: {
      title: "2년 전환위험(MCI→AD)",
      body:
        `기준일(D-1): ${BASE_DATE}\n` +
        "정의: 2년 후 MCI에서 AD로 전환될 확률(0–100%)\n" +
        "산출: Stage1/2 멀티모달 데이터 + MRI(CNN) 신호를 결합한 최종 ANN 예측\n" +
        `분포: Low ${STAGE3_BAND_COUNTS.Low} · Med ${STAGE3_BAND_COUNTS.Med} · High ${STAGE3_BAND_COUNTS.High}\n` +
        "주의: 본 값은 참고용 판단 보조 신호입니다",
    },
    jumpTo: "stage3",
    modeOverride: {
      quality: { label: "추적 누락률", value: 8.1, unit: "%", status: "warn" },
      audit: { label: "SLA 위반", value: 12, unit: "건", status: "risk" },
    },
  },
  {
    key: "s3-adherence-rate",
    label: "3차 추적 이행률",
    value: 71.4,
    unit: "%",
    delta: -2.3,
    baseDate: BASE_DATE,
    partialStages: ["S3"],
    scopeLine: D1_SCOPE_LINE,
    status: "warn",
    help: { title: "추적 이행률", body: `기준일(D-1): ${BASE_DATE}\n다음 체크/방문/검사 일정 이행 완료 비율` },
    jumpTo: "stage3",
  },
  {
    key: "sla-violation",
    label: "SLA 위반/지연",
    value: 12,
    unit: "건",
    delta: -3,
    baseDate: BASE_DATE,
    partialStages: ["S2", "S3"],
    scopeLine: D1_SCOPE_LINE,
    status: "risk",
    help: { title: "SLA 위반", body: `기준일(D-1): ${BASE_DATE}\n처리 기한 초과 및 정책 위반 건수` },
  },
];

/* ════════════════════════════════════════════════════════════
   B. Stage Overviews
   ════════════════════════════════════════════════════════════ */
export const MOCK_STAGES: StageOverview[] = [
  {
    stageId: "stage1",
    examLabel: "1차 선별검사",
    title: "1차 선별",
    purposeLine: "대규모 대상자 중 '추가 확인 필요' 후보를 좁히는 운영 신호 생성",
    inputs: [
      { name: "건강검진 결과", desc: "국민건강보험공단 연계 데이터" },
      { name: "문진/생활습관", desc: "치매안심센터 등록 시 수집" },
      { name: "행정정보", desc: "연락처, 주소, 가구 유형 등" },
      { name: "과거 검사 이력", desc: "이전 차수 선별 결과" },
    ],
    processing: [
      { name: "Stage1 Risk Scoring", desc: "위험도 추정 모델", version: "v3.2.1" },
      { name: "Eligibility Rules", desc: "선별 기준 적합성 규칙", version: "v1.4" },
    ],
    outputs: [
      { name: "risk_score", desc: "위험도 추정 점수 (0–100)" },
      { name: "risk_band", desc: "정상 / 주의 / 고위험" },
      { name: "reason_codes", desc: "상위 3–5 사유 코드" },
      { name: "data_quality_flags", desc: "데이터 품질 경고" },
    ],
    transition: [
      { to: "stage2", ruleLine: "고위험(risk_band=고위험) → 2차 연계 권고" },
      { to: "end", ruleLine: "정상/주의 → 정기 재평가(6개월)" },
    ],
    metrics: {
      applied: 1_089_353,
      appliedRate: 87.3,
      conversionRate: 14.4,
      avgLatencyDays: 3.2,
      topIssues: [
        { code: "NA-01", label: "데이터 미수집", count: 89_234 },
        { code: "NA-02", label: "기준 미충족", count: 45_678 },
        { code: "NA-03", label: "행정보류", count: 23_388 },
      ],
    },
  },
  {
    stageId: "stage2",
    examLabel: "2차 진단검사",
    title: "2차 진단 분류",
    purposeLine: "의료기관/검사 결과 연계로 '진단 결과'를 수신하고, 모델은 일관성 검증 신호를 제공",
    inputs: [
      { name: "1차 선별 결과", desc: "Stage1 risk_score, risk_band, reason_codes" },
      { name: "2차 검사 결과", desc: "PET/MRI/바이오마커 등 의료기관 연계" },
    ],
    processing: [
      { name: "기관 결과 수신", desc: "기관 연계 데이터 매핑", version: "v2.1" },
      { name: "Consistency Check", desc: "모델 신호 vs 기관 결과 일관성 검증(참고)", version: "v1.2" },
    ],
    outputs: [
      { name: "diagnosis_class", desc: "AD / MCI / 정상 (기관 연계 결과)" },
      { name: "model_support_signal", desc: "모델 참고 신호 (일치/주의/검증필요)" },
      { name: "next_step_policy", desc: "3차 편입 / 종결 / 재평가 권고" },
    ],
    transition: [
      { to: "stage3", ruleLine: "MCI 분류 → 3차 관리 편입" },
      { to: "end", ruleLine: "AD → 전문 의료 연계 / 정상 → 정기 재평가" },
    ],
    metrics: {
      applied: 157_204,
      appliedRate: 91.1,
      conversionRate: 38.4,
      avgLatencyDays: 18.3,
      topIssues: [
        { code: "DL-01", label: "결과 수신 지연(30일+)", count: 4_128 },
        { code: "DL-02", label: "불일치(모델 vs 기관)", count: 2_347 },
      ],
    },
  },
  {
    stageId: "stage3",
    examLabel: "3차 감별검사",
    title: "3차 전환위험 예측",
    purposeLine: "Stage1/2 멀티모달 데이터와 MRI(CNN) 신호를 융합해 2년 후 MCI→AD 전환위험(%)을 산출",
    inputs: [
      { name: "Stage1/2 멀티모달 벡터", desc: "인지검사/바이오마커/문진/진료이력 결합 피처" },
      { name: "MRI 기반 CNN 신호", desc: "영상 위험 점수·ROI 요약·촬영 품질" },
      { name: "추적 이력", desc: "방문/상담/검사 완료 이력" },
    ],
    processing: [
      { name: "S3 MRI Feature Extractor (CNN)", desc: "MRI 기반 영상 파생 피처/위험 점수 생성", version: "v1.0.3" },
      { name: "S3 Conversion Risk Predictor (멀티모달 ANN)", desc: "2년 후 MCI→AD 전환위험(%) 산출", version: "v2.1.0" },
      { name: "Transition Policy", desc: "편입/이탈/재평가 정책 규칙", version: "v1.3" },
    ],
    outputs: [
      { name: "conversion_risk_2y", desc: "2년 후 MCI→AD 전환확률 (%)" },
      { name: "conversion_risk_band_2y", desc: "Low / Med / High" },
      { name: "conversion_reason_codes", desc: "전환위험 상위 사유 코드(3–5)" },
      { name: "conversion_top_features", desc: "주요 기여 피처와 기여도" },
      { name: "upstream_cnn_signal", desc: "MRI 품질/위험점수/핵심 ROI 요약" },
      { name: "followup_priority", desc: "High / Med / Low" },
      { name: "recommended_actions", desc: "추가검사/추적콜/교육프로그램 등 권고" },
      { name: "guardrail_flags", desc: "부분수신/이상치/보정 경고" },
    ],
    transition: [
      { to: "end", ruleLine: "위험구간/우선순위에 따른 추적·정밀검사·자원배분 실행" },
    ],
    metrics: {
      applied: 60_234,
      appliedRate: 78.6,
      conversionRate: STAGE3_AVG_RISK_PCT,
      avgLatencyDays: 14.7,
      topIssues: [
        { code: "FU-01", label: "추적 일정 지연", count: 3_891 },
        { code: "FU-02", label: "중도이탈(연락불가)", count: 1_245 },
        { code: "FU-03", label: "프로그램 대기", count: 987 },
      ],
    },
  },
];

/* ════════════════════════════════════════════════════════════
   C. Model Use Map (노드 + 엣지)
   ════════════════════════════════════════════════════════════ */
export const MOCK_NODES: ModelUseNode[] = [
  /* ══════ Inputs ══════ */
  // Stage 1 입력
  { id: "in-health",   group: "input", label: "건강검진",       shortDesc: "국민건강보험공단 연계",       stageTag: "stage1" },
  { id: "in-survey",   group: "input", label: "문진/생활습관",   shortDesc: "안심센터 등록 시 수집",       stageTag: "stage1" },
  { id: "in-admin",    group: "input", label: "행정정보",       shortDesc: "연락처, 주소, 가구유형",     stageTag: "stage1" },
  { id: "in-history",  group: "input", label: "과거검사이력",    shortDesc: "이전 차수 선별 결과",        stageTag: "stage1" },
  // Stage 2 입력
  { id: "in-cogtest",  group: "input", label: "인지검사 요약지표", shortDesc: "MMSE/MoCA/CDR 요약",       stageTag: "stage2" },
  { id: "in-biomarker",group: "input", label: "혈액/바이오마커",  shortDesc: "Aβ42, p-tau, NfL 등",       stageTag: "stage2" },
  { id: "in-survey2",  group: "input", label: "2차 사전설문",    shortDesc: "일상생활 평가 + 보호자 문진",  stageTag: "stage2" },
  { id: "in-medhist",  group: "input", label: "약물/진료이력",   shortDesc: "처방전, 외래/입원 코드",      stageTag: "stage2" },
  // Stage 3 입력
  { id: "in-mri",      group: "input", label: "MRI 피처",      shortDesc: "해마 체적, 피질 두께 등",     stageTag: "stage3" },
  { id: "in-pet",      group: "input", label: "PET 피처",      shortDesc: "Aβ/Tau SUVR, Centiloid",    stageTag: "stage3" },
  { id: "in-imgderiv", group: "input", label: "영상 파생지표",   shortDesc: "ROI 비율, 위축 지수",        stageTag: "stage3" },
  { id: "in-followup", group: "input", label: "추적이력",       shortDesc: "방문/상담/검사 이력",         stageTag: "stage3" },

  /* ══════ Feature Builders ══════ */
  { id: "ft-builder",  group: "feature", label: "S1 Feature Builder", shortDesc: "1차 입력 전처리·변환",    stageTag: "stage1" },
  { id: "ft-s2-vec",   group: "feature", label: "S2 Vectorizer",     shortDesc: "인지+바이오+설문 벡터화",   stageTag: "stage2" },
  { id: "ft-s3-enc",   group: "feature", label: "S3 MRI Encoder",    shortDesc: "MRI 기반 영상 피처 인코딩", stageTag: "stage3" },

  /* ══════ Models & Rules ══════ */
  // Stage 1
  { id: "md-s1-risk",    group: "model", label: "S1 Risk Scoring",    shortDesc: "위험도 추정 모델 v3.2.1",   stageTag: "stage1" },
  { id: "md-s1-rule",    group: "model", label: "Eligibility Rules",  shortDesc: "선별 기준 적합성 규칙 v1.4", stageTag: "stage1" },
  // Stage 2
  { id: "md-s2-ann",     group: "model", label: "S2 ANN Classifier",  shortDesc: "ANN 분류 보조 모델 v1.0",   stageTag: "stage2" },
  { id: "md-s2-consist", group: "model", label: "Consistency Check",  shortDesc: "모델↔기관 일관성 검증 v1.2", stageTag: "stage2" },
  // Stage 3
  { id: "md-s3-cnn",     group: "model", label: "S3 MRI Feature Extractor (CNN)", shortDesc: "영상 파생 피처/위험점수 생성 v1.0.3", stageTag: "stage3" },
  { id: "md-s3-prio",    group: "model", label: "S3 Conversion Risk Predictor (멀티모달 ANN)", shortDesc: "2년 후 MCI→AD 전환위험(%) 산출 v2.1.0", stageTag: "stage3" },
  // Cross-stage
  { id: "md-guardrail",  group: "model", label: "Post-Model Guardrails", shortDesc: "신뢰구간·이상치 보정 v1.0", stageTag: "common" },
  { id: "md-transition", group: "model", label: "Transition Policy",  shortDesc: "단계 전환 정책 규칙 v1.3", stageTag: "common" },

  /* ══════ Outputs ══════ */
  // Stage 1 산출물
  { id: "out-score",    group: "output", label: "risk_score",        shortDesc: "위험도 추정 점수 0–100",      stageTag: "stage1" },
  { id: "out-band",     group: "output", label: "risk_band",         shortDesc: "정상/주의/고위험",           stageTag: "stage1" },
  { id: "out-reason",   group: "output", label: "reason_codes",      shortDesc: "상위 3–5 사유 코드",         stageTag: "stage1" },
  { id: "out-quality",  group: "output", label: "data_quality_flags", shortDesc: "데이터 품질 경고",           stageTag: "stage1" },
  // Stage 2 모델 보조 신호
  { id: "out-s2-class", group: "output", label: "s2_support_class",   shortDesc: "모델 보조 분류 (참고)",      stageTag: "stage2" },
  { id: "out-s2-conf",  group: "output", label: "s2_support_confidence", shortDesc: "모델 보조 신뢰도",       stageTag: "stage2" },
  { id: "out-s2-reason",group: "output", label: "s2_reason_codes",   shortDesc: "S2 모델 사유 코드",          stageTag: "stage2" },
  // Stage 2 기관 결과 (isExternal)
  { id: "out-diag",     group: "output", label: "diagnosis_class",   shortDesc: "AD/MCI/정상 (기관 결과)",    stageTag: "stage2", isExternal: true },
  { id: "out-signal",   group: "output", label: "model_support_signal", shortDesc: "일치/주의/검증필요 (참고)", stageTag: "stage2" },
  // Stage 3 최종 산출물 (멀티모달 ANN)
  { id: "out-s3-class", group: "output", label: "conversion_risk_2y", shortDesc: "2년 후 MCI→AD 전환확률(%)", stageTag: "stage3" },
  { id: "out-s3-conf",  group: "output", label: "conversion_risk_band_2y", shortDesc: "Low/Med/High 위험 구간", stageTag: "stage3" },
  { id: "out-s3-reason",group: "output", label: "conversion_reason_codes", shortDesc: "전환위험 상위 사유 코드", stageTag: "stage3" },
  { id: "out-s3-top",   group: "output", label: "conversion_top_features", shortDesc: "기여 피처 Top", stageTag: "stage3" },
  { id: "out-s3-cnn",   group: "output", label: "upstream_cnn_signal", shortDesc: "MRI 품질/위험점수/ROI 요약", stageTag: "stage3" },
  // Stage 3 운영 산출물
  { id: "out-priority", group: "output", label: "followup_priority", shortDesc: "High/Med/Low",              stageTag: "stage3" },
  { id: "out-actions",  group: "output", label: "recommended_actions", shortDesc: "권고 액션 목록",           stageTag: "stage3" },
  // Post-Model Guardrails
  { id: "out-guardrail",group: "output", label: "guardrail_flags",   shortDesc: "보정/이상치 경고 플래그",     stageTag: "common" },

  /* ══════ Dispatch ══════ */
  { id: "dispatch-s1", group: "dispatch", label: "S1 Dispatch", shortDesc: "신규 케이스 목록 / 예약 유도 대상", stageTag: "stage1" },
  { id: "dispatch-s2", group: "dispatch", label: "S2 Dispatch", shortDesc: "기관 결과 반영 목록 / 검증필요 플래그", stageTag: "stage2" },
  { id: "dispatch-s3", group: "dispatch", label: "S3 Dispatch", shortDesc: "전환위험 구간 / 우선순위 / 권고 액션", stageTag: "stage3" },

  /* ══════ Downstream Ops ══════ */
  // Stage 1 OPS
  { id: "ops-case",      group: "ops", label: "케이스 생성",       shortDesc: "안심센터 케이스 등록",       stageTag: "stage1" },
  { id: "ops-booking",   group: "ops", label: "예약 유도",        shortDesc: "2차 검사 예약 안내",        stageTag: "stage1" },
  // Stage 2 OPS
  { id: "ops-s2-prio",   group: "ops", label: "2차 검사 우선순위", shortDesc: "2차 검사 우선순위 조정",    stageTag: "stage2" },
  // Stage 3 OPS
  { id: "ops-s3-route",  group: "ops", label: "정밀검사 경로추천",  shortDesc: "전환위험 기반 경로 추천",    stageTag: "stage3" },
  { id: "ops-s3-resched",group: "ops", label: "재검/추적 재조정",  shortDesc: "재검·추적 일정 재조정",     stageTag: "stage3" },
  { id: "ops-resource",  group: "ops", label: "자원 배분",        shortDesc: "센터별 자원 최적화",        stageTag: "common" },
  { id: "ops-tracking",  group: "ops", label: "MCI 추적",        shortDesc: "추적 일정 관리",           stageTag: "stage3" },
];

export const MOCK_EDGES: ModelUseEdge[] = [
  /* ══════ Stage 1 Flow ══════ */
  // Inputs → S1 Feature Builder
  { from: "in-health",  to: "ft-builder",  label: "건강검진 데이터" },
  { from: "in-survey",  to: "ft-builder",  label: "문진 데이터" },
  { from: "in-admin",   to: "ft-builder",  label: "행정 정보" },
  { from: "in-history", to: "ft-builder",  label: "검사 이력" },
  // S1 Feature Builder → Models
  { from: "ft-builder", to: "md-s1-risk",  label: "피처 벡터" },
  { from: "ft-builder", to: "md-s1-rule",  label: "기준 데이터" },
  // S1 Models → Outputs
  { from: "md-s1-risk", to: "out-score",   label: "risk_score" },
  { from: "md-s1-risk", to: "out-band",    label: "risk_band" },
  { from: "md-s1-risk", to: "out-reason",  label: "reason_codes" },
  { from: "md-s1-rule", to: "out-quality",  label: "quality_flags" },
  // S1 Outputs → Guardrails
  { from: "out-score",  to: "md-guardrail", label: "S1 검증" },
  // S1 Outputs → Dispatch → Ops
  { from: "out-score",  to: "dispatch-s1", label: "신규 케이스 집계" },
  { from: "out-band",   to: "dispatch-s1", label: "예약 유도 대상" },
  { from: "dispatch-s1", to: "ops-case",   label: "케이스 생성 트리거" },
  { from: "dispatch-s1", to: "ops-booking", label: "예약 유도 조건" },

  /* ══════ Stage 2 Flow ══════ */
  // S2 Inputs → S2 Vectorizer
  { from: "in-cogtest",   to: "ft-s2-vec", label: "인지검사 데이터" },
  { from: "in-biomarker", to: "ft-s2-vec", label: "바이오마커" },
  { from: "in-survey2",   to: "ft-s2-vec", label: "2차 설문" },
  { from: "in-medhist",   to: "ft-s2-vec", label: "진료이력" },
  // S1 결과 → S2 입력
  { from: "out-band",     to: "ft-s2-vec", label: "1차 결과 전달", style: "dashed" },
  // S2 Vectorizer → S2 ANN
  { from: "ft-s2-vec",    to: "md-s2-ann", label: "S2 벡터" },
  // S2 ANN → S2 Outputs
  { from: "md-s2-ann",    to: "out-s2-class",  label: "보조 분류" },
  { from: "md-s2-ann",    to: "out-s2-conf",   label: "신뢰도" },
  { from: "md-s2-ann",    to: "out-s2-reason",  label: "사유 코드" },
  // S2 Outputs → Guardrails
  { from: "out-s2-class", to: "md-guardrail", label: "S2 검증" },
  // 기관 결과(외부) → Consistency Check
  { from: "out-diag",     to: "md-s2-consist", label: "기관 결과", style: "dashed" },
  { from: "out-s2-class", to: "md-s2-consist", label: "모델 보조 분류" },
  // Consistency Check → 출력
  { from: "md-s2-consist",to: "out-signal",    label: "일관성 신호" },
  // S2 Outputs → Transition
  { from: "out-diag",     to: "md-transition", style: "dashed" },
  // S2 Outputs → Dispatch → Ops
  { from: "out-diag",     to: "dispatch-s2",   label: "기관 결과 반영 목록" },
  { from: "out-signal",   to: "dispatch-s2",   label: "검증필요 플래그" },
  { from: "dispatch-s2",  to: "ops-s2-prio",   label: "우선순위 참고" },

  /* ══════ Stage 3 Flow ══════ */
  // S3 Inputs → S3 Encoder
  { from: "in-mri",       to: "ft-s3-enc", label: "MRI 피처" },
  { from: "in-pet",       to: "ft-s3-enc", label: "PET 피처" },
  { from: "in-imgderiv",  to: "ft-s3-enc", label: "파생 지표" },
  // Stage1/2 멀티모달 입력 + 추적이력 → S3 ANN
  { from: "ft-s2-vec",    to: "md-s3-prio", label: "S1/2 멀티모달 벡터", style: "dashed" },
  { from: "out-diag",     to: "md-s3-prio", label: "기관 분류 결과", style: "dashed" },
  { from: "out-signal",   to: "md-s3-prio", label: "일관성 신호", style: "dashed" },
  { from: "in-followup",  to: "md-s3-prio", label: "추적 이력" },
  // S3 Encoder → S3 MRI Feature Extractor (CNN)
  { from: "ft-s3-enc",    to: "md-s3-cnn", label: "MRI 텐서" },
  // CNN 출력 → 업스트림 신호
  { from: "md-s3-cnn",    to: "out-s3-cnn", label: "MRI 위험 신호" },
  // CNN 신호 → S3 최종 ANN
  { from: "out-s3-cnn",   to: "md-s3-prio", label: "업스트림 CNN 신호" },
  // S3 최종 ANN → S3 Outputs
  { from: "md-s3-prio",   to: "out-s3-class",  label: "전환위험(2년)" },
  { from: "md-s3-prio",   to: "out-s3-conf",   label: "위험 구간" },
  { from: "md-s3-prio",   to: "out-s3-reason", label: "사유 코드" },
  { from: "md-s3-prio",   to: "out-s3-top",    label: "기여 피처" },
  { from: "md-s3-prio",   to: "out-priority",  label: "우선순위" },
  { from: "md-s3-prio",   to: "out-actions",   label: "권고 액션" },
  // S3 Outputs → Guardrails
  { from: "out-s3-class", to: "md-guardrail", label: "S3 전환위험 검증" },
  // Transition
  { from: "md-transition", to: "md-s3-prio",   label: "MCI 편입" },
  // Guardrails → Output
  { from: "md-guardrail", to: "out-guardrail",  label: "보정 플래그" },
  // S3 Outputs → Dispatch → Ops
  { from: "out-s3-class", to: "dispatch-s3",    label: "전환위험(%)" },
  { from: "out-s3-conf",  to: "dispatch-s3",    label: "위험 구간" },
  { from: "out-priority", to: "dispatch-s3",    label: "High 추적 우선순위" },
  { from: "out-actions",  to: "dispatch-s3",    label: "권고 액션 목록" },
  { from: "out-guardrail",to: "dispatch-s3",    label: "재처리 필요 플래그" },
  { from: "dispatch-s3",  to: "ops-tracking",   label: "추적 우선순위" },
  { from: "dispatch-s3",  to: "ops-resource",   label: "자원 배분 입력" },
  { from: "dispatch-s3",  to: "ops-s3-route",   label: "경로 참고" },
  { from: "dispatch-s3",  to: "ops-s3-resched", label: "재조정 트리거" },
];

/* ════════════════════════════════════════════════════════════
   D. Inspector Contents
   ════════════════════════════════════════════════════════════ */
const RESPONSIBILITY_LINE = "최종 결정 주체: 담당자/기관. 모델은 판단 보조 신호만 제공합니다.";

export const MOCK_INSPECTOR: Record<string, InspectorContent> = {
  "batch-cycle": {
    id: "batch-cycle",
    definition: {
      what: "D-1 기준 일 단위 배치 집계/모델 실행/센터 전송의 상태 요약입니다.",
      why: "실시간 처리로 오해하지 않도록 배치 운영 상태와 영향 범위를 한 번에 제공합니다.",
      whereUsed: ["Batch Cycle Banner", "전송 상태 점검", "부분 집계 대응"],
      responsibility: RESPONSIBILITY_LINE,
    },
    dataContract: {
      outputs: [
        { field: "baseDate", type: "date", nullable: false, note: "D-1 기준일" },
        { field: "receiveDeadline", type: "time", nullable: false, note: "수신 마감 시각" },
        { field: "modelWindow", type: "string", nullable: false, note: "모델 실행 구간" },
        { field: "dispatchTime", type: "time", nullable: false, note: "전송 완료 시각" },
      ],
      refreshCadence: "일 1회 배치",
    },
    qualityAudit: {
      changeLog: [{ version: "BATCH-2026-02-13", date: "2026-02-13", summary: "S2/S3 부분 집계 감지 및 재처리 예정" }],
    },
    batchSummary: {
      impactedStages: MOCK_BATCH_META.impactedStages,
      receiveRate: MOCK_BATCH_META.receiveRate,
      missingInstitutionCount: MOCK_BATCH_META.missingInstitutionCount,
      expectedRetryAt: MOCK_BATCH_META.expectedRetryAt,
      impactedMetrics: ["2차 분류 분포(MCI/AD)", "2년 전환위험(MCI→AD)", "3차 추적 이행률"],
      dispatchLogs: MOCK_DISPATCH_LOGS,
    },
  },
  /* ─ Stages ─ */
  stage1: {
    id: "stage1",
    definition: {
      what: "대규모 대상자 중 '추가 확인 필요' 후보를 좁히는 운영 신호를 생성합니다.",
      why: "한정된 2차 검사 자원을 효율적으로 배분하기 위해, 위험도 추정 기반 우선순위를 제공합니다.",
      whereUsed: ["케이스 생성", "예약 유도", "센터 자원 배분 참고"],
      responsibility: RESPONSIBILITY_LINE,
    },
    dataContract: {
      inputs: [
        { field: "health_exam_result", type: "object", nullable: false, note: "건강검진 결과 전체" },
        { field: "survey_responses", type: "array", nullable: true, note: "문진/생활습관 응답" },
        { field: "admin_info", type: "object", nullable: false, note: "연락처, 주소" },
        { field: "prior_screening_history", type: "array", nullable: true, note: "이전 차수 결과" },
      ],
      outputs: [
        { field: "risk_score", type: "number(0-100)", nullable: false },
        { field: "risk_band", type: "enum(정상|주의|고위험)", nullable: false },
        { field: "reason_codes", type: "string[]", nullable: false, note: "상위 3–5 사유" },
        { field: "data_quality_flags", type: "string[]", nullable: true },
        { field: "transition_eligible", type: "boolean", nullable: false },
      ],
      refreshCadence: "일 1회 배치",
    },
    qualityAudit: {
      missingRate: 4.2,
      driftSignals: [
        { name: "risk_score 분포 이동", level: "low", note: "평균 +1.3 (정상 범위)" },
      ],
      biasAlerts: [
        { group: "75세+ 연령대", level: "mid", note: "고위험 분류 비율 평균 대비 +8.1%p" },
      ],
      changeLog: [
        { version: "v3.2.1", date: "2026-01-15", summary: "연령 가중치 조정", impact: "75세+ 고위험률 -2.3%p" },
        { version: "v3.2.0", date: "2025-12-01", summary: "BMI 피처 추가", impact: "전체 정확도 +1.1%p" },
        { version: "v3.1.0", date: "2025-09-20", summary: "모델 기반 아키텍처 교체" },
      ],
    },
  },
  stage2: {
    id: "stage2",
    definition: {
      what: "의료기관/검사 결과 연계로 '진단 결과'를 수신하고, 모델은 일관성 검증 신호를 제공합니다.",
      why: "기관 결과(공식 분류)와 모델 신호(참고)를 분리해 운영 오해를 방지하고, 수신 누락/지연을 배치 단위로 관리합니다.",
      whereUsed: ["2차 분류 현황 보고", "불일치 모니터링", "3차 편입 판단 참고"],
      responsibility: RESPONSIBILITY_LINE,
    },
    dataContract: {
      inputs: [
        { field: "stage1_result", type: "object", nullable: false, note: "risk_score, risk_band" },
        { field: "exam_result", type: "object", nullable: false, note: "PET/MRI/바이오마커" },
      ],
      outputs: [
        { field: "diagnosis_class", type: "enum(AD|MCI|NORMAL)", nullable: false, note: "기관 결과 = 공식 분류" },
        { field: "model_support_signal", type: "enum(일치|주의|검증필요)", nullable: false, note: "모델 신호 = 참고(공식 분류 대체 불가)" },
        { field: "next_step_policy", type: "enum(3차편입|종결|재평가)", nullable: false },
      ],
      refreshCadence: "일 1회 배치 (D-1 결과 집계)",
    },
    qualityAudit: {
      missingRate: 8.9,
      driftSignals: [
        { name: "불일치율 추이", level: "mid", note: "전월 대비 +1.2%p 증가" },
      ],
      biasAlerts: [
        { group: "농어촌 지역", level: "mid", note: "결과 수신 평균 소요 +5.2일" },
      ],
      changeLog: [
        { version: "v2.1", date: "2026-01-20", summary: "바이오마커 연계 추가", impact: "수신률 +3.4%p" },
        { version: "v2.0", date: "2025-11-15", summary: "PET/MRI 표준 매핑 적용" },
      ],
    },
    batchSummary: {
      impactedStages: ["S2", "S3"],
      receiveRate: 76.4,
      missingInstitutionCount: 7,
      expectedRetryAt: "2026-02-13 11:30",
      impactedMetrics: ["2차 분류 분포(MCI/AD)", "2년 전환위험(MCI→AD)", "3차 추적 이행률"],
    },
  },
  stage3: {
    id: "stage3",
    definition: {
      what: "Stage1/2 멀티모달 데이터와 MRI(CNN) 신호를 결합해 2년 후 MCI→AD 전환확률(0–100%)을 산출하는 최종 단계입니다.",
      why: "고위험 대상에 추적·정밀검사 자원을 우선 배분하고, 부분 집계 상황에서도 일관된 운영 기준을 제공하기 위해 필요합니다.",
      whereUsed: ["정밀검사 경로 추천", "추적 우선순위(High/Med/Low) 산정", "재검/추적 재조정", "품질 보고(드리프트/누락/가드레일 경고)"],
      responsibility: RESPONSIBILITY_LINE,
    },
    dataContract: {
      inputs: [
        { field: "stage12_feature_vector", type: "number[96]", nullable: false, note: "Stage1/2 멀티모달 결합 피처" },
        { field: "diagnosis_class", type: "enum(MCI|AD)", nullable: false, note: "기관 분류 결과" },
        { field: "upstream_cnn_signal", type: "object", nullable: false, note: "MRI 품질/위험점수/핵심 ROI 요약" },
        { field: "followup_history", type: "array", nullable: true, note: "방문/상담/검사 이력" },
      ],
      outputs: [
        { field: "conversion_risk_2y", type: "number(0-1)", nullable: false, note: "UI 표시: 0–100%" },
        { field: "conversion_risk_band_2y", type: "enum(Low|Med|High)", nullable: false },
        { field: "conversion_reason_codes", type: "string[]", nullable: false, note: "상위 3–5개 사유 코드" },
        { field: "conversion_top_features", type: "object[]", nullable: true, note: "name/contribution" },
        { field: "upstream_cnn_signal", type: "object", nullable: false, note: "mri_quality/cnn_risk_score/key_rois" },
        { field: "followup_priority", type: "enum(High|Med|Low)", nullable: false },
        { field: "recommended_actions", type: "string[]", nullable: false },
        { field: "guardrail_flags", type: "string[]", nullable: true },
      ],
      refreshCadence: "일 1회 배치 (D-1 결과 집계)",
    },
    qualityAudit: {
      missingRate: 8.1,
      driftSignals: [
        { name: "이행률 하락 추세", level: "mid", note: "3개월 연속 -1.5%p/월" },
      ],
      biasAlerts: [
        { group: "독거 가구", level: "high", note: "중도이탈률 평균 대비 +12.3%p" },
      ],
      changeLog: [
        { version: "v2.0", date: "2026-01-10", summary: "우선순위 모델 전면 교체", impact: "High 정밀도 +4.2%p" },
        { version: "v1.3", date: "2025-10-05", summary: "이탈 사유 코드 체계 개편" },
      ],
    },
  },
  /* ─ Key Nodes ─ */
  "md-s1-risk": {
    id: "md-s1-risk",
    definition: {
      what: "건강검진·문진·행정정보를 입력받아 위험도 추정 점수(0–100)를 산출하는 판단 보조 모델입니다.",
      why: "대상자 우선순위 추천을 통해 제한된 2차 검사 자원의 효율적 배분을 지원합니다.",
      whereUsed: ["1차 선별 risk_score 생성", "케이스 우선순위 정렬"],
      responsibility: RESPONSIBILITY_LINE,
    },
    dataContract: {
      inputs: [
        { field: "feature_vector", type: "number[48]", nullable: false, note: "Feature Builder 출력" },
      ],
      outputs: [
        { field: "risk_score", type: "number(0-100)", nullable: false },
        { field: "risk_band", type: "enum", nullable: false },
        { field: "reason_codes", type: "string[3-5]", nullable: false },
      ],
      refreshCadence: "일 1회 배치",
    },
    qualityAudit: {
      missingRate: 0.3,
      driftSignals: [
        { name: "입력 피처 분포", level: "low", note: "PSI 0.02 (안정)" },
      ],
      biasAlerts: [],
      changeLog: [
        { version: "v3.2.1", date: "2026-01-15", summary: "연령 가중치 미세 조정" },
        { version: "v3.2.0", date: "2025-12-01", summary: "BMI 피처 추가" },
      ],
    },
  },
  "ft-builder": {
    id: "ft-builder",
    definition: {
      what: "1차 선별용 원천 데이터를 모델 입력에 적합한 피처 벡터로 전처리·변환합니다.",
      why: "데이터 표준화와 결측치 처리를 통해 모델 입력 품질을 보장합니다.",
      whereUsed: ["Stage1 Risk Scoring 입력", "Eligibility Rules 입력"],
      responsibility: RESPONSIBILITY_LINE,
    },
    dataContract: {
      inputs: [
        { field: "raw_health_exam", type: "object", nullable: false },
        { field: "raw_survey", type: "array", nullable: true },
        { field: "raw_admin", type: "object", nullable: false },
      ],
      outputs: [
        { field: "feature_vector", type: "number[48]", nullable: false },
        { field: "missing_flags", type: "string[]", nullable: true },
      ],
      refreshCadence: "일 1회 배치",
    },
    qualityAudit: {
      missingRate: 4.2,
      driftSignals: [],
      biasAlerts: [],
      changeLog: [
        { version: "v2.1", date: "2025-12-01", summary: "BMI 파생 피처 추가" },
      ],
    },
  },
  "ft-s2-vec": {
    id: "ft-s2-vec",
    definition: {
      what: "인지검사·바이오마커·설문·진료이력 데이터를 ANN 모델 입력 벡터로 변환합니다.",
      why: "다양한 형식의 2차 데이터를 일관된 수치 벡터로 정규화하여 ANN 입력 품질을 보장합니다.",
      whereUsed: ["S2 ANN Classifier 입력"],
      responsibility: RESPONSIBILITY_LINE,
    },
    dataContract: {
      inputs: [
        { field: "cogtest_features", type: "number[6]", nullable: false, note: "인지검사 요약" },
        { field: "biomarker_features", type: "number[4]", nullable: true, note: "혈액 바이오마커" },
        { field: "survey2_features", type: "number[8]", nullable: true, note: "2차 설문 요약" },
        { field: "medhist_features", type: "number[5]", nullable: true, note: "진료이력 요약" },
      ],
      outputs: [
        { field: "s2_feature_vector", type: "number[64]", nullable: false },
        { field: "missing_flags", type: "string[]", nullable: true },
      ],
      refreshCadence: "검사 접수 시점",
    },
    qualityAudit: {
      missingRate: 8.3,
      driftSignals: [{ name: "입력 분포 변화", level: "low", note: "PSI 0.03 (안정)" }],
      biasAlerts: [],
      changeLog: [{ version: "v1.0", date: "2026-01-15", summary: "초기 구축" }],
    },
  },
  "ft-s3-enc": {
    id: "ft-s3-enc",
    definition: {
      what: "MRI 정량 피처를 Stage3 업스트림 CNN 입력 텐서로 인코딩합니다.",
      why: "영상 신호를 표준화해 해마 체적/피질두께 기반 위험 점수가 안정적으로 계산되도록 지원합니다.",
      whereUsed: ["S3 MRI Feature Extractor (CNN) 입력"],
      responsibility: RESPONSIBILITY_LINE,
    },
    dataContract: {
      inputs: [
        { field: "mri_features", type: "number[128]", nullable: false, note: "MRI 정량 피처" },
        { field: "pet_features", type: "number[64]", nullable: true, note: "PET 정량 피처" },
        { field: "derived_metrics", type: "number[16]", nullable: true, note: "영상 파생 지표" },
      ],
      outputs: [
        { field: "s3_tensor", type: "tensor[1,208]", nullable: false },
        { field: "missing_flags", type: "string[]", nullable: true },
      ],
      refreshCadence: "영상 수신 시점",
    },
    qualityAudit: {
      missingRate: 18.7,
      driftSignals: [{ name: "스캐너 프로토콜 차이", level: "mid", note: "기관 간 표준화 편차 ±4.2%" }],
      biasAlerts: [],
      changeLog: [{ version: "v1.0", date: "2026-01-20", summary: "초기 구축" }],
    },
  },
  /* ─ Input Nodes ─ */
  "in-health": {
    id: "in-health",
    definition: {
      what: "국민건강보험공단으로부터 연계되는 건강검진 결과 데이터입니다.",
      why: "1차 선별 모델의 핵심 입력 원천으로, 만성질환·BMI·혈압 등 건강 지표를 포함합니다.",
      whereUsed: ["Feature Builder 입력", "1차 선별 risk_score 산출"],
      responsibility: RESPONSIBILITY_LINE,
    },
    dataContract: {
      inputs: [
        { field: "exam_date", type: "date", nullable: false, note: "검진 일자" },
        { field: "bmi", type: "number", nullable: true, note: "체질량지수" },
        { field: "blood_pressure", type: "object", nullable: true, note: "수축기/이완기" },
        { field: "chronic_diseases", type: "string[]", nullable: true, note: "만성질환 코드" },
      ],
      refreshCadence: "분기 1회 배치 연계",
    },
    qualityAudit: {
      missingRate: 3.1,
      driftSignals: [{ name: "검진 결과 수신 지연", level: "low", note: "평균 2일 이내" }],
      biasAlerts: [],
      changeLog: [{ version: "v1.0", date: "2025-06-01", summary: "초기 연계 구축" }],
    },
  },
  "in-survey": {
    id: "in-survey",
    definition: {
      what: "치매안심센터 등록 시 수집하는 문진 및 생활습관 응답 데이터입니다.",
      why: "생활 패턴, 인지 기능 자가 평가 등 건강검진에 포함되지 않는 보충 정보를 제공합니다.",
      whereUsed: ["Feature Builder 입력"],
      responsibility: RESPONSIBILITY_LINE,
    },
    dataContract: {
      inputs: [
        { field: "survey_id", type: "string", nullable: false },
        { field: "responses", type: "object[]", nullable: false, note: "문항별 응답" },
      ],
      refreshCadence: "등록 시점 1회",
    },
    qualityAudit: {
      missingRate: 12.7,
      driftSignals: [],
      biasAlerts: [{ group: "75세+ 연령대", level: "mid", note: "미응답률 평균 대비 +8%p" }],
      changeLog: [{ version: "v1.2", date: "2025-11-01", summary: "문항 개편 (15→20문항)" }],
    },
  },
  "in-admin": {
    id: "in-admin",
    definition: {
      what: "대상자 행정정보(연락처, 주소, 가구유형 등)입니다.",
      why: "연락 가능 여부, 독거 여부 등 운영 판단에 필요한 행정 기초 데이터입니다.",
      whereUsed: ["Feature Builder 입력", "케이스 생성 시 연락처 참조"],
      responsibility: RESPONSIBILITY_LINE,
    },
    dataContract: {
      inputs: [
        { field: "address", type: "object", nullable: false },
        { field: "household_type", type: "enum", nullable: true, note: "독거/동거/시설" },
        { field: "contact_phone", type: "string", nullable: true },
      ],
      refreshCadence: "등록/변경 시",
    },
    qualityAudit: {
      missingRate: 5.4,
      driftSignals: [],
      biasAlerts: [],
      changeLog: [{ version: "v1.1", date: "2025-08-15", summary: "가구유형 필드 추가" }],
    },
  },
  "in-history": {
    id: "in-history",
    definition: {
      what: "이전 차수의 1차 선별 결과 및 검사 이력 데이터입니다.",
      why: "반복 선별 시 이전 결과 대비 변화 추이를 파악하여 위험도 추정 정확도를 높입니다.",
      whereUsed: ["Feature Builder 입력"],
      responsibility: RESPONSIBILITY_LINE,
    },
    dataContract: {
      inputs: [
        { field: "prior_risk_scores", type: "number[]", nullable: true },
        { field: "prior_risk_bands", type: "string[]", nullable: true },
        { field: "last_screening_date", type: "date", nullable: true },
      ],
      refreshCadence: "일 1회 배치",
    },
    qualityAudit: {
      missingRate: 18.3,
      driftSignals: [{ name: "이력 없는 신규 대상자 비율", level: "low", note: "22.1% (정상 범위)" }],
      biasAlerts: [],
      changeLog: [{ version: "v1.0", date: "2025-06-01", summary: "초기 구축" }],
    },
  },
  "in-exam": {
    id: "in-cogtest",
    definition: {
      what: "인지기능검사(MMSE, MoCA, CDR 등)의 요약 점수 데이터입니다.",
      why: "2차 ANN 모델의 핵심 입력으로, 인지기능 저하 정도를 수치화한 참고 데이터입니다.",
      whereUsed: ["S2 Vectorizer 입력", "ANN Classifier 입력"],
      responsibility: RESPONSIBILITY_LINE,
    },
    dataContract: {
      inputs: [
        { field: "mmse_score", type: "number(0-30)", nullable: false, note: "MMSE 점수" },
        { field: "moca_score", type: "number(0-30)", nullable: true, note: "MoCA 점수" },
        { field: "cdr_global", type: "number(0-3)", nullable: true, note: "CDR 전체 점수" },
        { field: "exam_date", type: "date", nullable: false },
      ],
      refreshCadence: "검사 시점 1회",
    },
    qualityAudit: {
      missingRate: 6.4,
      driftSignals: [{ name: "검사 도구 버전 차이", level: "low", note: "MoCA v8.1 ↔ v7.1 혼재 2.1%" }],
      biasAlerts: [{ group: "저학력 대상자", level: "mid", note: "MMSE 문항별 오답률 편향 +6.2%p" }],
      changeLog: [{ version: "v1.0", date: "2025-09-01", summary: "초기 연계 구축" }],
    },
  },
  "in-cogtest": {
    id: "in-cogtest",
    definition: {
      what: "인지기능검사(MMSE, MoCA, CDR 등)의 요약 점수 데이터입니다.",
      why: "2차 ANN 모델의 핵심 입력으로, 인지기능 저하 정도를 수치화한 참고 데이터입니다.",
      whereUsed: ["S2 Vectorizer 입력", "ANN Classifier 입력"],
      responsibility: RESPONSIBILITY_LINE,
    },
    dataContract: {
      inputs: [
        { field: "mmse_score", type: "number(0-30)", nullable: false, note: "MMSE 점수" },
        { field: "moca_score", type: "number(0-30)", nullable: true, note: "MoCA 점수" },
        { field: "cdr_global", type: "number(0-3)", nullable: true, note: "CDR 전체 점수" },
        { field: "exam_date", type: "date", nullable: false },
      ],
      refreshCadence: "검사 시점 1회",
    },
    qualityAudit: {
      missingRate: 6.4,
      driftSignals: [{ name: "검사 도구 버전 차이", level: "low", note: "MoCA v8.1 ↔ v7.1 혼재 2.1%" }],
      biasAlerts: [{ group: "저학력 대상자", level: "mid", note: "MMSE 문항별 오답률 편향 +6.2%p" }],
      changeLog: [{ version: "v1.0", date: "2025-09-01", summary: "초기 연계 구축" }],
    },
  },
  "in-biomarker": {
    id: "in-biomarker",
    definition: {
      what: "혈액 기반 바이오마커(Aβ42, p-tau181, NfL 등) 수치 데이터입니다.",
      why: "ANN 모델의 보조 입력으로, 신경퇴행 관련 혈액 지표를 제공합니다.",
      whereUsed: ["S2 Vectorizer 입력"],
      responsibility: RESPONSIBILITY_LINE,
    },
    dataContract: {
      inputs: [
        { field: "ab42_ratio", type: "number", nullable: true, note: "Aβ42/40 비율" },
        { field: "ptau181", type: "number", nullable: true, note: "pg/mL" },
        { field: "nfl", type: "number", nullable: true, note: "Neurofilament light" },
        { field: "sample_date", type: "date", nullable: false },
      ],
      refreshCadence: "검사 시점 1회",
    },
    qualityAudit: {
      missingRate: 22.1,
      driftSignals: [{ name: "검사 키트 변경", level: "mid", note: "Elecsys → Lumipulse 전환 중 2.3% 편차" }],
      biasAlerts: [],
      changeLog: [{ version: "v1.0", date: "2025-10-01", summary: "초기 연계" }],
    },
  },
  "in-survey2": {
    id: "in-survey2",
    definition: {
      what: "2차 검사 전 수집하는 일상생활 평가 및 보호자 문진 데이터입니다.",
      why: "인지검사만으로 파악하기 어려운 일상 기능 저하를 보충하여 모델 입력 품질을 높입니다.",
      whereUsed: ["S2 Vectorizer 입력"],
      responsibility: RESPONSIBILITY_LINE,
    },
    dataContract: {
      inputs: [
        { field: "adl_score", type: "number", nullable: true, note: "일상생활 수행능력" },
        { field: "iadl_score", type: "number", nullable: true, note: "도구적 일상생활" },
        { field: "guardian_responses", type: "object[]", nullable: true, note: "보호자 문진 응답" },
      ],
      refreshCadence: "2차 검사 전 1회",
    },
    qualityAudit: {
      missingRate: 15.3,
      driftSignals: [],
      biasAlerts: [{ group: "독거 대상자", level: "high", note: "보호자 문진 미수집 42.1%" }],
      changeLog: [{ version: "v1.0", date: "2025-11-01", summary: "초기 구축" }],
    },
  },
  "in-medhist": {
    id: "in-medhist",
    definition: {
      what: "대상자의 약물 처방 및 진료 이력(외래·입원) 데이터입니다.",
      why: "공존 질환·약물 상호작용 등 인지기능에 영향을 줄 수 있는 임상 맥락을 제공합니다.",
      whereUsed: ["S2 Vectorizer 입력"],
      responsibility: RESPONSIBILITY_LINE,
    },
    dataContract: {
      inputs: [
        { field: "rx_codes", type: "string[]", nullable: true, note: "처방 약물 ATC 코드" },
        { field: "visit_history", type: "object[]", nullable: true, note: "외래/입원 코드" },
        { field: "comorbidity_index", type: "number", nullable: true, note: "Charlson 동반질환 지수" },
      ],
      refreshCadence: "월 1회 배치",
    },
    qualityAudit: {
      missingRate: 11.7,
      driftSignals: [],
      biasAlerts: [],
      changeLog: [{ version: "v1.0", date: "2025-11-15", summary: "처방 데이터 연계 구축" }],
    },
  },
  "in-mri": {
    id: "in-mri",
    definition: {
      what: "구조적 MRI에서 추출한 해마 체적, 피질 두께, 뇌실 비율 등 정량 피처입니다.",
      why: "Stage3 최종 ANN이 참조하는 업스트림 CNN 신호를 생성하기 위한 핵심 영상 원천 데이터입니다.",
      whereUsed: ["S3 MRI Encoder 입력", "S3 MRI Feature Extractor(CNN) 입력"],
      responsibility: RESPONSIBILITY_LINE,
    },
    dataContract: {
      inputs: [
        { field: "hippocampal_volume", type: "number", nullable: false, note: "해마 체적 (mm³)" },
        { field: "cortical_thickness", type: "number[]", nullable: true, note: "ROI별 피질 두께" },
        { field: "ventricular_ratio", type: "number", nullable: true, note: "뇌실 비율" },
        { field: "scan_date", type: "date", nullable: false },
      ],
      refreshCadence: "검사 시점 1회",
    },
    qualityAudit: {
      missingRate: 14.2,
      driftSignals: [{ name: "스캐너 기종 차이", level: "mid", note: "3T/1.5T 혼재 시 체적 편차 ±3.1%" }],
      biasAlerts: [],
      changeLog: [{ version: "v1.0", date: "2025-12-01", summary: "FreeSurfer 파이프라인 적용" }],
    },
  },
  "in-pet": {
    id: "in-pet",
    definition: {
      what: "아밀로이드/타우 PET에서 추출한 SUVR, Centiloid 등 정량 피처입니다.",
      why: "뇌 내 병리 단백질 축적 신호를 보조적으로 반영해 Stage3 전환위험 추정의 안정성을 높입니다.",
      whereUsed: ["S3 MRI Encoder 입력"],
      responsibility: RESPONSIBILITY_LINE,
    },
    dataContract: {
      inputs: [
        { field: "amyloid_suvr", type: "number", nullable: true, note: "Aβ PET SUVR" },
        { field: "centiloid", type: "number", nullable: true, note: "Centiloid 단위" },
        { field: "tau_suvr", type: "number", nullable: true, note: "Tau PET SUVR" },
        { field: "scan_date", type: "date", nullable: false },
      ],
      refreshCadence: "검사 시점 1회",
    },
    qualityAudit: {
      missingRate: 31.4,
      driftSignals: [{ name: "추적자 종류 차이", level: "mid", note: "Florbetaben vs Flutemetamol 혼재" }],
      biasAlerts: [{ group: "농어촌 지역", level: "high", note: "PET 장비 접근성 낮음 — 미수집률 +18%p" }],
      changeLog: [{ version: "v1.0", date: "2025-12-15", summary: "PET 정량 파이프라인 구축" }],
    },
  },
  "in-imgderiv": {
    id: "in-imgderiv",
    definition: {
      what: "MRI/PET 원시 피처에서 파생된 복합 지표(ROI 비율, 위축 지수 등)입니다.",
      why: "단일 피처보다 높은 판별력을 가진 복합 지표를 생성하여 모델 정확도를 높입니다.",
      whereUsed: ["S3 MRI Encoder 입력"],
      responsibility: RESPONSIBILITY_LINE,
    },
    dataContract: {
      inputs: [
        { field: "atrophy_index", type: "number", nullable: true, note: "전체 뇌 위축 지수" },
        { field: "roi_ratios", type: "number[]", nullable: true, note: "ROI 간 비율" },
        { field: "asymmetry_score", type: "number", nullable: true, note: "좌우 비대칭 점수" },
      ],
      refreshCadence: "MRI/PET 수신 후 파생",
    },
    qualityAudit: {
      missingRate: 16.8,
      driftSignals: [],
      biasAlerts: [],
      changeLog: [{ version: "v1.0", date: "2026-01-05", summary: "파생 지표 파이프라인 구축" }],
    },
  },
  "in-followup": {
    id: "in-followup",
    definition: {
      what: "MCI 대상자의 추적 방문/상담/검사 이행 이력 데이터입니다.",
      why: "추적 이행률을 모니터링하고, Stage3 최종 전환위험 예측(멀티모달 ANN)의 입력으로 활용됩니다.",
      whereUsed: ["S3 Conversion Risk Predictor 입력", "이행률 집계"],
      responsibility: RESPONSIBILITY_LINE,
    },
    dataContract: {
      inputs: [
        { field: "visit_records", type: "object[]", nullable: true },
        { field: "last_contact_date", type: "date", nullable: true },
        { field: "program_participation", type: "string[]", nullable: true },
      ],
      refreshCadence: "주 1회 배치",
    },
    qualityAudit: {
      missingRate: 8.1,
      driftSignals: [{ name: "이행률 하락", level: "mid", note: "3개월 연속 -1.5%p/월" }],
      biasAlerts: [{ group: "독거 가구", level: "high", note: "중도이탈률 +12.3%p" }],
      changeLog: [{ version: "v1.0", date: "2025-06-01", summary: "초기 구축" }],
    },
  },
  /* ─ Model Nodes ─ */
  "md-s1-rule": {
    id: "md-s1-rule",
    definition: {
      what: "대상자의 선별 기준 적합성을 판단하는 규칙 기반 엔진입니다.",
      why: "연령, 데이터 수집 완전성, 행정 상태 등을 확인하여 모델 적용 가능 여부를 결정합니다.",
      whereUsed: ["1차 선별 적용 여부 판단", "미적용 사유 코드 생성"],
      responsibility: RESPONSIBILITY_LINE,
    },
    dataContract: {
      inputs: [{ field: "base_criteria", type: "object", nullable: false, note: "연령/주소/등록상태" }],
      outputs: [
        { field: "eligible", type: "boolean", nullable: false },
        { field: "exclusion_reason", type: "string", nullable: true },
        { field: "data_quality_flags", type: "string[]", nullable: true },
      ],
      refreshCadence: "일 1회 배치",
    },
    qualityAudit: {
      missingRate: 0,
      driftSignals: [],
      biasAlerts: [],
      changeLog: [
        { version: "v1.4", date: "2025-12-15", summary: "75세+ 기준 완화" },
        { version: "v1.3", date: "2025-09-01", summary: "데이터 완전성 기준 추가" },
      ],
    },
  },
  "md-s2-ann": {
    id: "md-s2-ann",
    definition: {
      what: "인지검사·바이오마커·설문 벡터를 입력받아 2차 분류 보조 신호를 산출하는 ANN 모델입니다.",
      why: "기관 연계 결과 수신 전 분류 보조 신호를 제공하여, 기관 결과와의 일관성 검증에 참고합니다.",
      whereUsed: ["S2 분류 보조 신호 생성", "Consistency Check 참고 입력"],
      responsibility: RESPONSIBILITY_LINE,
    },
    dataContract: {
      inputs: [
        { field: "s2_feature_vector", type: "number[64]", nullable: false, note: "S2 Vectorizer 출력" },
      ],
      outputs: [
        { field: "s2_support_class", type: "enum(AD|MCI|NORMAL)", nullable: false, note: "보조 분류 (참고)" },
        { field: "s2_support_confidence", type: "number(0-1)", nullable: false, note: "분류 신뢰도" },
        { field: "s2_reason_codes", type: "string[3-5]", nullable: false, note: "상위 기여 피처" },
      ],
      refreshCadence: "검사 접수 시점",
    },
    qualityAudit: {
      missingRate: 0.5,
      driftSignals: [{ name: "입력 피처 분포", level: "low", note: "PSI 0.04 (안정)" }],
      biasAlerts: [{ group: "75세+ 연령대", level: "mid", note: "AD 보조 분류 비율 +5.4%p" }],
      changeLog: [
        { version: "v1.0", date: "2026-01-15", summary: "ANN Classifier 초기 배포" },
      ],
    },
  },
  "md-s2-consist": {
    id: "md-s2-consist",
    definition: {
      what: "기관 연계 2차 검사 결과와 1차 모델 신호 간 일관성을 검증하는 참고 모듈입니다.",
      why: "결과 불일치(예: 1차 저위험 → 2차 AD)를 집계하여 품질 모니터링에 활용합니다.",
      whereUsed: ["불일치 모니터링", "model_support_signal 생성"],
      responsibility: RESPONSIBILITY_LINE,
    },
    dataContract: {
      inputs: [
        { field: "stage1_risk_band", type: "enum", nullable: false },
        { field: "exam_diagnosis", type: "enum(AD|MCI|NORMAL)", nullable: false },
      ],
      outputs: [
        { field: "model_support_signal", type: "enum(일치|주의|검증필요)", nullable: false },
        { field: "inconsistency_score", type: "number", nullable: false },
      ],
      refreshCadence: "실시간",
    },
    qualityAudit: {
      missingRate: 0,
      driftSignals: [{ name: "불일치율 추이", level: "mid", note: "전월 대비 +1.2%p" }],
      biasAlerts: [],
      changeLog: [{ version: "v1.2", date: "2026-01-10", summary: "불일치 임계값 조정" }],
    },
  },
  "md-transition": {
    id: "md-transition",
    definition: {
      what: "2차 분류 결과에 따라 다음 단계(3차 편입/종결/재평가)를 결정하는 정책 규칙입니다.",
      why: "분류 결과별로 명확한 후속 조치를 자동 권고하여 운영 효율을 높입니다.",
      whereUsed: ["3차 MCI 관리 편입 판단", "종결/재평가 분기"],
      responsibility: RESPONSIBILITY_LINE,
    },
    dataContract: {
      inputs: [{ field: "diagnosis_class", type: "enum(AD|MCI|NORMAL)", nullable: false }],
      outputs: [{ field: "next_step_policy", type: "enum(3차편입|종결|재평가)", nullable: false }],
      refreshCadence: "실시간",
    },
    qualityAudit: {
      missingRate: 0,
      driftSignals: [],
      biasAlerts: [],
      changeLog: [
        { version: "v1.3", date: "2026-01-10", summary: "MCI 편입 기준 세분화" },
        { version: "v1.2", date: "2025-10-01", summary: "AD 전문 의료 연계 규칙 추가" },
      ],
    },
  },
  "md-s3-cnn": {
    id: "md-s3-cnn",
    definition: {
      what: "MRI 인코딩 텐서를 입력받아 Stage3 최종 ANN이 사용할 영상 파생 피처와 CNN 위험 점수를 생성하는 업스트림 모델입니다.",
      why: "영상 기반 변화를 정량화해 최종 전환위험 예측(멀티모달 ANN)의 입력 신호 품질을 보강합니다.",
      whereUsed: ["upstream_cnn_signal 생성", "S3 Conversion Risk Predictor 입력"],
      responsibility: RESPONSIBILITY_LINE,
    },
    dataContract: {
      inputs: [
        { field: "s3_tensor", type: "tensor[1,208]", nullable: false, note: "S3 Encoder 출력" },
      ],
      outputs: [
        { field: "upstream_cnn_signal.mri_quality", type: "enum(OK|WARN|FAIL)", nullable: false },
        { field: "upstream_cnn_signal.cnn_risk_score", type: "number(0-1)", nullable: false },
        { field: "upstream_cnn_signal.key_rois", type: "string[]", nullable: false, note: "상위 기여 ROI" },
      ],
      refreshCadence: "영상 수신 시점",
    },
    qualityAudit: {
      missingRate: 0.8,
      driftSignals: [{ name: "텐서 분포 변화", level: "low", note: "KL divergence 0.02 (안정)" }],
      biasAlerts: [{ group: "1.5T 스캐너", level: "mid", note: "3T 대비 cnn_risk_score -0.08 편차" }],
      changeLog: [
        { version: "v1.0.3", date: "2026-02-01", summary: "S3 MRI Feature Extractor(CNN) 배포" },
      ],
    },
  },
  "md-s3-prio": {
    id: "md-s3-prio",
    definition: {
      what: "Stage1/2 멀티모달 데이터와 MRI(CNN) 신호를 결합해 2년 후 MCI→AD 전환확률(%)을 산출하는 Stage3 최종 모델(멀티모달 ANN)입니다.",
      why: "전환위험이 높은 대상에 추적·정밀검사 자원을 우선 배분하도록 지원합니다.",
      whereUsed: ["2년 전환위험(MCI→AD) 산출", "followup_priority 생성", "recommended_actions 생성"],
      responsibility: RESPONSIBILITY_LINE,
    },
    dataContract: {
      inputs: [
        { field: "stage12_feature_vector", type: "number[96]", nullable: false, note: "Stage1/2 결합 피처" },
        { field: "diagnosis_class", type: "enum(MCI|AD)", nullable: false },
        { field: "upstream_cnn_signal", type: "object", nullable: false },
        { field: "followup_history", type: "array", nullable: true },
      ],
      outputs: [
        { field: "conversion_risk_2y", type: "number(0-1)", nullable: false, note: "UI 표시: 0–100%" },
        { field: "conversion_risk_band_2y", type: "enum(Low|Med|High)", nullable: false },
        { field: "conversion_reason_codes", type: "string[]", nullable: false },
        { field: "conversion_top_features", type: "object[]", nullable: true, note: "{name, contribution}" },
        { field: "followup_priority", type: "enum(High|Med|Low)", nullable: false },
        { field: "recommended_actions", type: "string[]", nullable: false },
      ],
      refreshCadence: "일 1회 배치 (D-1 집계)",
    },
    qualityAudit: {
      missingRate: 0.5,
      driftSignals: [{ name: "전환위험 분포 변화", level: "low", note: "평균 +0.9%p (안정)" }],
      biasAlerts: [{ group: "독거 가구", level: "high", note: "High 과대표현 +12%p" }],
      changeLog: [
        { version: "v2.1.0", date: "2026-01-10", summary: "멀티모달 ANN 전환위험 예측 모델 배포", impact: "2년 전환위험 예측 AUC +3.9%p" },
      ],
    },
  },
  /* ─ Output Nodes ─ */
  "out-score": {
    id: "out-score",
    definition: {
      what: "1차 선별 위험도 추정 점수(0–100)입니다.",
      why: "대상자 우선순위를 수치화하여 케이스 정렬 및 자원 배분의 근거로 활용합니다.",
      whereUsed: ["케이스 생성 트리거", "케이스 우선순위 정렬"],
      responsibility: RESPONSIBILITY_LINE,
    },
    dataContract: {
      outputs: [{ field: "risk_score", type: "number(0-100)", nullable: false }],
      refreshCadence: "일 1회 배치",
    },
    qualityAudit: { missingRate: 0.3, driftSignals: [], biasAlerts: [], changeLog: [] },
  },
  "out-band": {
    id: "out-band",
    definition: {
      what: "위험도 추정 등급(정상/주의/고위험)입니다.",
      why: "점수를 3단계로 구분하여 직관적인 운영 판단을 지원합니다.",
      whereUsed: ["예약 유도 조건", "2차 연계 권고 판단"],
      responsibility: RESPONSIBILITY_LINE,
    },
    dataContract: {
      outputs: [{ field: "risk_band", type: "enum(정상|주의|고위험)", nullable: false }],
      refreshCadence: "일 1회 배치",
    },
    qualityAudit: { missingRate: 0, driftSignals: [], biasAlerts: [], changeLog: [] },
  },
  "out-reason": {
    id: "out-reason",
    definition: {
      what: "위험도 추정의 상위 3–5개 사유 코드입니다.",
      why: "왜 해당 대상자가 고위험으로 분류되었는지 근거를 제공합니다.",
      whereUsed: ["케이스 상세 사유 표시", "센터 상담 참고"],
      responsibility: RESPONSIBILITY_LINE,
    },
    dataContract: {
      outputs: [{ field: "reason_codes", type: "string[3-5]", nullable: false }],
      refreshCadence: "일 1회 배치",
    },
    qualityAudit: { missingRate: 0, driftSignals: [], biasAlerts: [], changeLog: [] },
  },
  "out-diag": {
    id: "out-diag",
    definition: {
      what: "2차 진단 분류 결과(AD/MCI/정상)입니다. 기관 연계 결과이며, 모델 판단이 아닙니다.",
      why: "의료기관 검사 결과를 운영 시스템에 반영하여 후속 조치를 결정합니다.",
      whereUsed: ["3차 편입 판단", "분류 분포 보고"],
      responsibility: RESPONSIBILITY_LINE,
    },
    dataContract: {
      outputs: [{ field: "diagnosis_class", type: "enum(AD|MCI|NORMAL)", nullable: false, note: "기관 연계 결과" }],
      refreshCadence: "실시간 (기관 연계 시점)",
    },
    qualityAudit: { missingRate: 8.9, driftSignals: [], biasAlerts: [], changeLog: [] },
  },
  "out-signal": {
    id: "out-signal",
    definition: {
      what: "모델 참고 신호(일치/주의/검증필요)입니다. 기관 결과와 1차 모델 신호 간 일관성을 나타냅니다.",
      why: "품질 모니터링 목적으로 활용되며, 진단이나 결정의 근거로 사용되지 않습니다.",
      whereUsed: ["불일치 모니터링 대시보드", "품질 보고"],
      responsibility: RESPONSIBILITY_LINE,
    },
    dataContract: {
      outputs: [{ field: "model_support_signal", type: "enum(일치|주의|검증필요)", nullable: false, note: "참고용 보조 신호" }],
      refreshCadence: "실시간",
    },
    qualityAudit: { missingRate: 0, driftSignals: [], biasAlerts: [], changeLog: [] },
  },
  "out-priority": {
    id: "out-priority",
    definition: {
      what: "MCI 추적 우선순위(High/Med/Low) 추천값입니다.",
      why: "제한된 추적 자원의 효율적 배분을 지원하는 판단 보조 신호입니다.",
      whereUsed: ["MCI 추적 일정 관리", "센터 자원 배분"],
      responsibility: RESPONSIBILITY_LINE,
    },
    dataContract: {
      outputs: [{ field: "followup_priority", type: "enum(High|Med|Low)", nullable: false }],
      refreshCadence: "주 1회 배치",
    },
    qualityAudit: { missingRate: 0.5, driftSignals: [], biasAlerts: [], changeLog: [] },
  },
  "out-actions": {
    id: "out-actions",
    definition: {
      what: "추천 후속 조치 목록(추가검사/추적콜/교육프로그램 등)입니다.",
      why: "센터 담당자가 참고할 수 있는 권고 액션을 제공합니다.",
      whereUsed: ["케이스 상세 권고 표시", "자원 배분 입력"],
      responsibility: RESPONSIBILITY_LINE,
    },
    dataContract: {
      outputs: [{ field: "recommended_actions", type: "string[]", nullable: false }],
      refreshCadence: "주 1회 배치",
    },
    qualityAudit: { missingRate: 0, driftSignals: [], biasAlerts: [], changeLog: [] },
  },
  "out-quality": {
    id: "out-quality",
    definition: {
      what: "데이터 품질 경고 플래그입니다.",
      why: "입력 데이터의 결측·이상·일관성 문제를 표시하여 운영자가 데이터 품질을 파악합니다.",
      whereUsed: ["품질 모니터링 대시보드", "1차 선별 품질 보고"],
      responsibility: RESPONSIBILITY_LINE,
    },
    dataContract: {
      outputs: [{ field: "data_quality_flags", type: "string[]", nullable: true }],
      refreshCadence: "일 1회 배치",
    },
    qualityAudit: { missingRate: 0, driftSignals: [], biasAlerts: [], changeLog: [] },
  },
  /* ─ Stage 2 Output Nodes ─ */
  "out-s2-class": {
    id: "out-s2-class",
    definition: {
      what: "ANN 모델의 2차 분류 보조 신호(AD/MCI/NORMAL)입니다. 기관 결과가 아닌 모델 참고 신호입니다.",
      why: "기관 결과와의 일관성 검증(Consistency Check)의 비교 대상으로 활용됩니다.",
      whereUsed: ["Consistency Check 입력", "S2 품질 모니터링"],
      responsibility: RESPONSIBILITY_LINE,
    },
    dataContract: {
      outputs: [{ field: "s2_support_class", type: "enum(AD|MCI|NORMAL)", nullable: false, note: "모델 보조 분류 (참고)" }],
      refreshCadence: "검사 접수 시점",
    },
    qualityAudit: { missingRate: 0.5, driftSignals: [], biasAlerts: [], changeLog: [] },
  },
  "out-s2-conf": {
    id: "out-s2-conf",
    definition: {
      what: "ANN 모델의 분류 신뢰도(0–1)입니다.",
      why: "모델 보조 신호의 확신 정도를 수치화하여, 낮은 신뢰도 건은 추가 검토를 유도합니다.",
      whereUsed: ["2차 검사 우선순위 참고", "품질 보고"],
      responsibility: RESPONSIBILITY_LINE,
    },
    dataContract: {
      outputs: [{ field: "s2_support_confidence", type: "number(0-1)", nullable: false }],
      refreshCadence: "검사 접수 시점",
    },
    qualityAudit: { missingRate: 0, driftSignals: [], biasAlerts: [], changeLog: [] },
  },
  "out-s2-reason": {
    id: "out-s2-reason",
    definition: {
      what: "ANN 모델의 상위 3–5개 기여 피처 코드입니다.",
      why: "모델이 왜 해당 보조 분류를 산출했는지 근거를 제공합니다.",
      whereUsed: ["Inspector 상세", "품질 감사"],
      responsibility: RESPONSIBILITY_LINE,
    },
    dataContract: {
      outputs: [{ field: "s2_reason_codes", type: "string[3-5]", nullable: false }],
      refreshCadence: "검사 접수 시점",
    },
    qualityAudit: { missingRate: 0, driftSignals: [], biasAlerts: [], changeLog: [] },
  },
  /* ─ Stage 3 Output Nodes ─ */
  "out-s3-class": {
    id: "out-s3-class",
    definition: {
      what: "2년 후 MCI에서 AD로 전환될 확률(0–100%)을 나타내는 예측값입니다.",
      why: "추적/정밀검사 자원을 높은 위험 대상에 우선 배분하기 위한 운영 신호로 사용됩니다.",
      whereUsed: ["정밀검사 경로 추천", "추적 우선순위 산정", "Guardrails 검증"],
      responsibility: RESPONSIBILITY_LINE,
    },
    dataContract: {
      outputs: [{ field: "conversion_risk_2y", type: "number(0-1)", nullable: false, note: "UI 표시: 0–100%" }],
      refreshCadence: "일 1회 배치 (D-1 집계)",
    },
    qualityAudit: { missingRate: 0.8, driftSignals: [], biasAlerts: [], changeLog: [] },
  },
  "out-s3-conf": {
    id: "out-s3-conf",
    definition: {
      what: "2년 전환위험(%)을 운영 구간(Low/Med/High)으로 구분한 값입니다.",
      why: "센터가 위험군별 대응 강도를 빠르게 정하는 기준으로 활용됩니다.",
      whereUsed: ["추적 우선순위 정책", "센터 배치 기준"],
      responsibility: RESPONSIBILITY_LINE,
    },
    dataContract: {
      outputs: [{ field: "conversion_risk_band_2y", type: "enum(Low|Med|High)", nullable: false }],
      refreshCadence: "일 1회 배치 (D-1 집계)",
    },
    qualityAudit: { missingRate: 0, driftSignals: [], biasAlerts: [], changeLog: [] },
  },
  "out-s3-reason": {
    id: "out-s3-reason",
    definition: {
      what: "전환위험 산출에 크게 기여한 상위 3–5개 사유 코드입니다.",
      why: "예측 근거를 확인해 운영자가 추적/재검 우선순위를 설명할 수 있도록 지원합니다.",
      whereUsed: ["Inspector 상세", "품질 감사"],
      responsibility: RESPONSIBILITY_LINE,
    },
    dataContract: {
      outputs: [{ field: "conversion_reason_codes", type: "string[3-5]", nullable: false }],
      refreshCadence: "일 1회 배치 (D-1 집계)",
    },
    qualityAudit: { missingRate: 0, driftSignals: [], biasAlerts: [], changeLog: [] },
  },
  "out-s3-top": {
    id: "out-s3-top",
    definition: {
      what: "전환위험 산출에 반영된 상위 기여 피처와 기여도입니다.",
      why: "모델 근거를 수치로 확인해 배치 점검·설명 책임을 보강합니다.",
      whereUsed: ["Inspector 상세", "품질 감사"],
      responsibility: RESPONSIBILITY_LINE,
    },
    dataContract: {
      outputs: [{ field: "conversion_top_features", type: "object[]", nullable: true, note: "{name, contribution}" }],
      refreshCadence: "일 1회 배치 (D-1 집계)",
    },
    qualityAudit: { missingRate: 0, driftSignals: [], biasAlerts: [], changeLog: [] },
  },
  "out-s3-cnn": {
    id: "out-s3-cnn",
    definition: {
      what: "MRI 기반 CNN 업스트림 신호 요약입니다(mri_quality, cnn_risk_score, key_rois).",
      why: "영상 단독 판단이 아니라 최종 ANN 입력 신호로 활용되는 중간 결과를 투명하게 제공합니다.",
      whereUsed: ["S3 Conversion Risk Predictor 입력", "품질 모니터링"],
      responsibility: RESPONSIBILITY_LINE,
    },
    dataContract: {
      outputs: [
        { field: "upstream_cnn_signal.mri_quality", type: "enum(OK|WARN|FAIL)", nullable: false },
        { field: "upstream_cnn_signal.cnn_risk_score", type: "number(0-1)", nullable: false },
        { field: "upstream_cnn_signal.key_rois", type: "string[]", nullable: false },
      ],
      refreshCadence: "영상 수신 시점",
    },
    qualityAudit: { missingRate: 0, driftSignals: [], biasAlerts: [], changeLog: [] },
  },
  /* ─ Post-Model Guardrails ─ */
  "md-guardrail": {
    id: "md-guardrail",
    definition: {
      what: "S1/S2/S3 모델 출력에 대한 신뢰구간 검증, 이상치 탐지, 편향 보정을 수행하는 후처리 모듈입니다.",
      why: "모델 출력이 통계적 이상 범위에 있거나 편향이 감지될 때 경고 플래그를 발행합니다.",
      whereUsed: ["guardrail_flags 생성", "재검/추적 일정 재조정 트리거"],
      responsibility: RESPONSIBILITY_LINE,
    },
    dataContract: {
      inputs: [
        { field: "risk_score", type: "number", nullable: true, note: "S1 출력" },
        { field: "s2_support_class", type: "enum", nullable: true, note: "S2 출력" },
        { field: "conversion_risk_2y", type: "number", nullable: true, note: "S3 출력" },
      ],
      outputs: [
        { field: "guardrail_flags", type: "string[]", nullable: false, note: "보정/이상치 경고" },
        { field: "confidence_adjusted", type: "boolean", nullable: false },
      ],
      refreshCadence: "모델 출력 생성 시점",
    },
    qualityAudit: {
      missingRate: 0,
      driftSignals: [{ name: "플래그 발행률", level: "low", note: "2.1% (정상 범위)" }],
      biasAlerts: [],
      changeLog: [{ version: "v1.0", date: "2026-02-01", summary: "Guardrails 초기 배포" }],
    },
  },
  "out-guardrail": {
    id: "out-guardrail",
    definition: {
      what: "Post-Model Guardrails에서 발행한 보정/이상치 경고 플래그입니다.",
      why: "모델 출력의 신뢰성 문제를 운영자에게 알려 추가 검토를 유도합니다.",
      whereUsed: ["재검/추적 일정 재조정", "품질 대시보드"],
      responsibility: RESPONSIBILITY_LINE,
    },
    dataContract: {
      outputs: [{ field: "guardrail_flags", type: "string[]", nullable: false, note: "보정/이상치 경고" }],
      refreshCadence: "모델 출력 생성 시점",
    },
    qualityAudit: { missingRate: 0, driftSignals: [], biasAlerts: [], changeLog: [] },
  },
  /* ─ Dispatch Nodes ─ */
  "dispatch-s1": {
    id: "dispatch-s1",
    definition: {
      what: "S1 산출물(신규 케이스 후보/예약 유도 대상)을 일 단위 배치로 센터에 전송하는 노드입니다.",
      why: "선별 결과를 센터 운영 시스템으로 안정적으로 전달해 후속 처리 누락을 줄입니다.",
      whereUsed: ["S1 Dispatch 로그", "센터 케이스 생성", "예약 유도"],
      responsibility: RESPONSIBILITY_LINE,
    },
    dataContract: {
      inputs: [
        { field: "risk_score", type: "number", nullable: false },
        { field: "risk_band", type: "enum", nullable: false },
      ],
      outputs: [
        { field: "dispatch_payload", type: "object[]", nullable: false, note: "신규 케이스 / 예약 유도 대상" },
      ],
      refreshCadence: "일 1회 배치 전송",
    },
    qualityAudit: { missingRate: 0, driftSignals: [], biasAlerts: [], changeLog: [] },
    batchSummary: {
      dispatchLogs: MOCK_DISPATCH_LOGS.filter((log) => log.stage === "S1"),
    },
  },
  "dispatch-s2": {
    id: "dispatch-s2",
    definition: {
      what: "S2 기관 결과 반영 목록과 검증필요 플래그를 일 단위 배치로 전송하는 노드입니다.",
      why: "기관 결과 기반 운영 지시를 광역/센터에 일관되게 전달합니다.",
      whereUsed: ["S2 Dispatch 로그", "검증필요 후속 처리", "2차 우선순위 조정"],
      responsibility: RESPONSIBILITY_LINE,
    },
    dataContract: {
      inputs: [
        { field: "diagnosis_class", type: "enum(AD|MCI|NORMAL)", nullable: false },
        { field: "model_support_signal", type: "enum(일치|주의|검증필요)", nullable: false },
      ],
      outputs: [
        { field: "dispatch_payload", type: "object[]", nullable: false, note: "기관 결과 반영 / 검증필요 플래그" },
      ],
      refreshCadence: "일 1회 배치 전송",
    },
    qualityAudit: { missingRate: 0, driftSignals: [], biasAlerts: [], changeLog: [] },
    batchSummary: {
      impactedStages: ["S2"],
      dispatchLogs: MOCK_DISPATCH_LOGS.filter((log) => log.stage === "S2"),
    },
  },
  "dispatch-s3": {
    id: "dispatch-s3",
    definition: {
      what: "S3 전환위험(2년) 구간과 추적 우선순위/권고 액션을 일 단위 배치로 전송하는 노드입니다.",
      why: "전환위험 기반 운영 지시를 중앙/광역/센터에 일관되게 전달합니다.",
      whereUsed: ["S3 Dispatch 로그", "MCI/AD 추적 운영", "자원 배분"],
      responsibility: RESPONSIBILITY_LINE,
    },
    dataContract: {
      inputs: [
        { field: "conversion_risk_2y", type: "number(0-1)", nullable: false, note: "UI 표시: 0–100%" },
        { field: "conversion_risk_band_2y", type: "enum(Low|Med|High)", nullable: false },
        { field: "followup_priority", type: "enum(High|Med|Low)", nullable: false },
        { field: "recommended_actions", type: "string[]", nullable: false },
      ],
      outputs: [
        { field: "dispatch_payload", type: "object[]", nullable: false, note: "전환위험 구간 / High 추적 목록 / 권고 액션" },
      ],
      refreshCadence: "일 1회 배치 전송",
    },
    qualityAudit: { missingRate: 0, driftSignals: [], biasAlerts: [], changeLog: [] },
    batchSummary: {
      impactedStages: ["S3"],
      dispatchLogs: MOCK_DISPATCH_LOGS.filter((log) => log.stage === "S3"),
    },
  },

  /* ─ Ops Nodes ─ */
  "ops-case": {
    id: "ops-case",
    definition: {
      what: "위험도 추정 결과를 기반으로 안심센터 케이스를 생성하는 운영 프로세스입니다.",
      why: "고위험 대상자에 대한 체계적 관리를 시작하기 위해 케이스를 등록합니다.",
      whereUsed: ["치매안심센터 케이스 관리"],
      responsibility: RESPONSIBILITY_LINE,
    },
    dataContract: {
      inputs: [{ field: "risk_score", type: "number", nullable: false }, { field: "risk_band", type: "enum", nullable: false }],
      refreshCadence: "일 1회 배치 반영",
    },
    qualityAudit: { missingRate: 0, driftSignals: [], biasAlerts: [], changeLog: [] },
  },
  "ops-booking": {
    id: "ops-booking",
    definition: {
      what: "고위험 대상자에게 2차 검사 예약을 안내하는 운영 프로세스입니다.",
      why: "선별 결과에 따라 적시에 2차 검사를 받을 수 있도록 유도합니다.",
      whereUsed: ["SMS/알림 발송", "예약 시스템 연동"],
      responsibility: RESPONSIBILITY_LINE,
    },
    dataContract: {
      inputs: [{ field: "risk_band", type: "enum", nullable: false }],
      refreshCadence: "일 1회 배치 반영",
    },
    qualityAudit: { missingRate: 0, driftSignals: [], biasAlerts: [], changeLog: [] },
  },
  "ops-resource": {
    id: "ops-resource",
    definition: {
      what: "권고 액션 기반으로 센터별 자원(상담/검사/프로그램)을 배분하는 운영 프로세스입니다.",
      why: "수요 예측을 통해 자원 병목을 사전에 방지합니다.",
      whereUsed: ["센터 운영 계획", "자원 모니터링"],
      responsibility: RESPONSIBILITY_LINE,
    },
    dataContract: {
      inputs: [{ field: "recommended_actions", type: "string[]", nullable: false }],
      refreshCadence: "일 1회 배치 반영",
    },
    qualityAudit: { missingRate: 0, driftSignals: [], biasAlerts: [], changeLog: [] },
  },
  "ops-tracking": {
    id: "ops-tracking",
    definition: {
      what: "MCI 대상자의 추적 일정을 관리하는 운영 프로세스입니다.",
      why: "우선순위에 따라 방문/상담/검사 일정을 체계적으로 관리합니다.",
      whereUsed: ["MCI 추적 일정 관리", "이행률 모니터링"],
      responsibility: RESPONSIBILITY_LINE,
    },
    dataContract: {
      inputs: [{ field: "followup_priority", type: "enum(High|Med|Low)", nullable: false }],
      refreshCadence: "일 1회 배치 반영",
    },
    qualityAudit: { missingRate: 0, driftSignals: [], biasAlerts: [], changeLog: [] },
  },
  "ops-s2-prio": {
    id: "ops-s2-prio",
    definition: {
      what: "모델 보조 신뢰도를 참고하여 2차 검사 우선순위를 조정하는 운영 프로세스입니다.",
      why: "제한된 2차 검사 슬롯을 모델 보조 신호 기반으로 효율 배분합니다.",
      whereUsed: ["2차 검사 예약 대기열 조정"],
      responsibility: RESPONSIBILITY_LINE,
    },
    dataContract: {
      inputs: [{ field: "s2_support_confidence", type: "number(0-1)", nullable: false }],
      refreshCadence: "일 1회 배치 반영",
    },
    qualityAudit: { missingRate: 0, driftSignals: [], biasAlerts: [], changeLog: [] },
  },
  "ops-s3-route": {
    id: "ops-s3-route",
    definition: {
      what: "3차 정밀검사 대상자의 검사 경로(PET/MRI/기타)를 추천하는 운영 프로세스입니다.",
      why: "2년 전환위험(%)과 위험 구간, 업스트림 CNN 신호를 참고해 검사 경로를 제안합니다.",
      whereUsed: ["3차 정밀검사 경로 배정"],
      responsibility: RESPONSIBILITY_LINE,
    },
    dataContract: {
      inputs: [
        { field: "conversion_risk_2y", type: "number(0-1)", nullable: false },
        { field: "conversion_risk_band_2y", type: "enum(Low|Med|High)", nullable: false },
        { field: "upstream_cnn_signal.cnn_risk_score", type: "number(0-1)", nullable: true },
      ],
      refreshCadence: "일 1회 배치 반영",
    },
    qualityAudit: { missingRate: 0, driftSignals: [], biasAlerts: [], changeLog: [] },
  },
  "ops-s3-resched": {
    id: "ops-s3-resched",
    definition: {
      what: "Guardrails 플래그에 따라 재검·추적 일정을 재조정하는 운영 프로세스입니다.",
      why: "모델 신뢰성 이슈 발생 시 추가 검토 또는 재검을 스케줄링합니다.",
      whereUsed: ["재검 일정 관리", "추적 스케줄 재배정"],
      responsibility: RESPONSIBILITY_LINE,
    },
    dataContract: {
      inputs: [{ field: "guardrail_flags", type: "string[]", nullable: false }],
      refreshCadence: "플래그 발행 시점",
    },
    qualityAudit: { missingRate: 0, driftSignals: [], biasAlerts: [], changeLog: [] },
  },
};

/* ════════════════════════════════════════════════════════════
   E. Root ViewModel (assembled)
   ════════════════════════════════════════════════════════════ */
export function buildMockViewModel(viewMode: "ops" | "quality" | "audit" = "ops"): ModelCenterViewModel {
  return {
    lastUpdatedAt: "2026-02-13 09:00",
    batchMeta: MOCK_BATCH_META,
    dispatchLogs: MOCK_DISPATCH_LOGS,
    stage2Distribution: MOCK_STAGE2_DISTRIBUTION,
    stage3Enrollment: MOCK_STAGE3_ENROLLMENT,
    stage3Cases: STAGE3_CASES_WITH_BAND,
    viewMode,
    kpis: MOCK_KPIS,
    stages: MOCK_STAGES,
    useMap: { nodes: MOCK_NODES, edges: MOCK_EDGES },
    inspector: MOCK_INSPECTOR,
  };
}
