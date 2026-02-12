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
} from "./modelCenter.types";

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
    scopeLine: "전국 집계 · 비식별",
    status: "neutral",
    help: { title: "전체 대상자", body: "전국 치매안심센터 등록 대상자 합계 (비식별 집계)" },
  },
  {
    key: "s1-applied-rate",
    label: "1차 선별 적용률",
    value: 87.3,
    unit: "%",
    delta: 2.1,
    scopeLine: "전국 집계 · 비식별",
    status: "good",
    help: { title: "1차 선별 적용률", body: "모델/규칙 기반 1차 선별이 적용된 대상자 비율" },
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
    scopeLine: "전국 집계 · 비식별",
    status: "warn",
    help: { title: "1차 고위험 신호율", body: "모델 위험도 추정 기반 '고위험' 대상자 비율 (판단 보조 신호)" },
    jumpTo: "stage1",
  },
  {
    key: "s2-receive-rate",
    label: "2차 분류 수신률",
    value: 91.1,
    unit: "%",
    delta: 3.4,
    scopeLine: "전국 집계 · 비식별",
    status: "good",
    help: { title: "2차 분류 수신률", body: "의료기관으로부터 2차 진단 분류 결과를 수신한 비율" },
    jumpTo: "stage2",
    modeOverride: {
      quality: { label: "2차 불일치율", value: 6.8, unit: "%", status: "warn" },
      audit: { label: "2차 결과 지연", value: 18.3, unit: "일", status: "risk" },
    },
  },
  {
    key: "s2-distribution",
    label: "2차 분류 분포(AD)",
    value: 23.4,
    unit: "%",
    delta: 1.1,
    scopeLine: "전국 집계 · 비식별",
    status: "risk",
    help: { title: "AD 분류 비율", body: "기관 연계 결과 AD로 분류된 비율 (기관 입력 기준)" },
    jumpTo: "stage2",
  },
  {
    key: "s3-enrollment-rate",
    label: "3차 MCI 편입률",
    value: 78.6,
    unit: "%",
    delta: 5.2,
    scopeLine: "전국 집계 · 비식별",
    status: "good",
    help: { title: "MCI 관리 편입률", body: "MCI 분류 대상자 중 관리 등록/추적 대상 비율" },
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
    scopeLine: "전국 집계 · 비식별",
    status: "warn",
    help: { title: "추적 이행률", body: "다음 체크/방문/검사 일정 이행 완료 비율" },
    jumpTo: "stage3",
  },
  {
    key: "sla-violation",
    label: "SLA 위반/지연",
    value: 12,
    unit: "건",
    delta: -3,
    scopeLine: "전국 집계 · 비식별",
    status: "risk",
    help: { title: "SLA 위반", body: "처리 기한 초과 및 정책 위반 건수" },
  },
];

/* ════════════════════════════════════════════════════════════
   B. Stage Overviews
   ════════════════════════════════════════════════════════════ */
export const MOCK_STAGES: StageOverview[] = [
  {
    stageId: "stage1",
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
    title: "2차 진단 분류",
    purposeLine: "의료기관/검사 결과 연계로 '분류 결과'를 수신하는 단계",
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
    title: "3차 MCI 관리",
    purposeLine: "MCI 분류 대상자의 추적/관리/재평가 운영",
    inputs: [
      { name: "2차 분류 결과", desc: "diagnosis_class=MCI, 기관 결과" },
      { name: "3차 추적 이력", desc: "방문/상담/검사 완료 이력" },
    ],
    processing: [
      { name: "MCI Follow-up Prioritizer", desc: "추적 우선순위 추천 모델", version: "v2.0" },
      { name: "Transition Policy", desc: "편입/이탈/재평가 정책 규칙", version: "v1.3" },
    ],
    outputs: [
      { name: "followup_priority", desc: "High / Med / Low" },
      { name: "recommended_actions", desc: "추가검사/추적콜/교육프로그램 등 권고" },
      { name: "adherence_metrics", desc: "이행률 집계" },
      { name: "drop_off_reason", desc: "중도이탈 사유 코드" },
    ],
    transition: [
      { to: "end", ruleLine: "재평가 완료 / 이탈 / 전문 의료 연계" },
    ],
    metrics: {
      applied: 60_234,
      appliedRate: 78.6,
      conversionRate: 71.4,
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
  // ─ Inputs
  { id: "in-health", group: "input", label: "건강검진", shortDesc: "국민건강보험공단 연계" },
  { id: "in-survey", group: "input", label: "문진/생활습관", shortDesc: "안심센터 등록 시 수집" },
  { id: "in-admin", group: "input", label: "행정정보", shortDesc: "연락처, 주소, 가구유형" },
  { id: "in-history", group: "input", label: "과거검사이력", shortDesc: "이전 차수 선별 결과" },
  { id: "in-exam", group: "input", label: "2차검사결과", shortDesc: "PET/MRI/바이오마커" },
  { id: "in-followup", group: "input", label: "3차추적이력", shortDesc: "방문/상담/검사 이력" },
  // ─ Features
  { id: "ft-builder", group: "feature", label: "Feature Builder", shortDesc: "입력 데이터 전처리·변환" },
  // ─ Models & Rules
  { id: "md-s1-risk", group: "model", label: "Stage1 Risk Scoring", shortDesc: "위험도 추정 모델 v3.2.1" },
  { id: "md-s1-rule", group: "model", label: "Eligibility Rules", shortDesc: "선별 기준 적합성 규칙 v1.4" },
  { id: "md-s2-consist", group: "model", label: "Consistency Check", shortDesc: "모델↔기관 일관성 검증 v1.2" },
  { id: "md-transition", group: "model", label: "Transition Policy", shortDesc: "단계 전환 정책 규칙 v1.3" },
  { id: "md-s3-prio", group: "model", label: "MCI Prioritizer", shortDesc: "추적 우선순위 추천 v2.0" },
  // ─ Outputs
  { id: "out-score", group: "output", label: "risk_score", shortDesc: "위험도 추정 점수 0–100" },
  { id: "out-band", group: "output", label: "risk_band", shortDesc: "정상/주의/고위험" },
  { id: "out-reason", group: "output", label: "reason_codes", shortDesc: "상위 3–5 사유 코드" },
  { id: "out-diag", group: "output", label: "diagnosis_class", shortDesc: "AD/MCI/정상 (기관 결과)" },
  { id: "out-signal", group: "output", label: "model_support_signal", shortDesc: "일치/주의/검증필요 (참고)" },
  { id: "out-priority", group: "output", label: "followup_priority", shortDesc: "High/Med/Low" },
  { id: "out-actions", group: "output", label: "recommended_actions", shortDesc: "권고 액션 목록" },
  { id: "out-quality", group: "output", label: "data_quality_flags", shortDesc: "데이터 품질 경고" },
  // ─ Downstream Ops
  { id: "ops-case", group: "ops", label: "케이스 생성", shortDesc: "안심센터 케이스 등록" },
  { id: "ops-booking", group: "ops", label: "예약 유도", shortDesc: "2차 검사 예약 안내" },
  { id: "ops-resource", group: "ops", label: "자원 배분", shortDesc: "센터별 자원 최적화" },
  { id: "ops-tracking", group: "ops", label: "MCI 추적", shortDesc: "추적 일정 관리" },
];

export const MOCK_EDGES: ModelUseEdge[] = [
  // Inputs → Feature Builder
  { from: "in-health", to: "ft-builder", label: "건강검진 데이터" },
  { from: "in-survey", to: "ft-builder", label: "문진 데이터" },
  { from: "in-admin", to: "ft-builder", label: "행정 정보" },
  { from: "in-history", to: "ft-builder", label: "검사 이력" },
  // Feature Builder → Models
  { from: "ft-builder", to: "md-s1-risk", label: "피처 벡터" },
  { from: "ft-builder", to: "md-s1-rule", label: "기준 데이터" },
  // Stage1 Models → Outputs
  { from: "md-s1-risk", to: "out-score", label: "risk_score" },
  { from: "md-s1-risk", to: "out-band", label: "risk_band" },
  { from: "md-s1-risk", to: "out-reason", label: "reason_codes" },
  { from: "md-s1-rule", to: "out-quality", label: "quality_flags" },
  // Stage2
  { from: "in-exam", to: "md-s2-consist" },
  { from: "out-band", to: "md-s2-consist", label: "1차 결과 전달" },
  { from: "md-s2-consist", to: "out-diag", label: "기관 연계 결과" },
  { from: "md-s2-consist", to: "out-signal", label: "모델 참고 신호" },
  // Transition
  { from: "out-diag", to: "md-transition" },
  { from: "md-transition", to: "md-s3-prio", label: "MCI 편입" },
  // Stage3
  { from: "in-followup", to: "md-s3-prio", label: "추적 이력" },
  { from: "md-s3-prio", to: "out-priority", label: "우선순위" },
  { from: "md-s3-prio", to: "out-actions", label: "권고 액션" },
  // Outputs → Ops
  { from: "out-score", to: "ops-case", label: "케이스 생성 트리거" },
  { from: "out-band", to: "ops-booking", label: "예약 유도 조건" },
  { from: "out-priority", to: "ops-tracking", label: "추적 우선순위" },
  { from: "out-actions", to: "ops-resource", label: "자원 배분 입력" },
];

/* ════════════════════════════════════════════════════════════
   D. Inspector Contents
   ════════════════════════════════════════════════════════════ */
const RESPONSIBILITY_LINE = "최종 결정 주체: 담당자/기관. 모델은 판단 보조 신호만 제공합니다.";

export const MOCK_INSPECTOR: Record<string, InspectorContent> = {
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
      what: "의료기관 검사 결과(AD/MCI/정상)를 수신하고, 모델 참고 신호와 분리 표기합니다.",
      why: "기관 연계 결과의 수신 현황과 일관성을 모니터링하여 운영 품질을 확보합니다.",
      whereUsed: ["2차 분류 현황 보고", "불일치 모니터링", "3차 편입 판단 참고"],
      responsibility: RESPONSIBILITY_LINE,
    },
    dataContract: {
      inputs: [
        { field: "stage1_result", type: "object", nullable: false, note: "risk_score, risk_band" },
        { field: "exam_result", type: "object", nullable: false, note: "PET/MRI/바이오마커" },
      ],
      outputs: [
        { field: "diagnosis_class", type: "enum(AD|MCI|NORMAL)", nullable: false, note: "기관 연계 결과" },
        { field: "model_support_signal", type: "enum(일치|주의|검증필요)", nullable: false, note: "모델 참고 신호" },
        { field: "next_step_policy", type: "enum(3차편입|종결|재평가)", nullable: false },
      ],
      refreshCadence: "실시간 (기관 연계 시점)",
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
  },
  stage3: {
    id: "stage3",
    definition: {
      what: "MCI 분류 대상자에 대한 추적/관리/재평가를 운영합니다.",
      why: "MCI 대상자의 체계적 관리와 적시 개입을 통해 중증 전환을 지연시키는 것을 목표로 합니다.",
      whereUsed: ["MCI 추적 일정 관리", "자원 배분", "재평가 일정 수립"],
      responsibility: RESPONSIBILITY_LINE,
    },
    dataContract: {
      inputs: [
        { field: "diagnosis_class", type: "enum(MCI)", nullable: false, note: "2차 분류 결과" },
        { field: "followup_history", type: "array", nullable: true, note: "방문/상담/검사 이력" },
      ],
      outputs: [
        { field: "followup_priority", type: "enum(High|Med|Low)", nullable: false },
        { field: "recommended_actions", type: "string[]", nullable: false },
        { field: "adherence_metrics", type: "object", nullable: false },
        { field: "drop_off_reason", type: "string", nullable: true },
      ],
      refreshCadence: "주 1회 배치",
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
      what: "다양한 원천 데이터를 모델 입력에 적합한 피처 벡터로 전처리·변환합니다.",
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
    id: "in-exam",
    definition: {
      what: "의료기관에서 수행한 2차 검사(PET/MRI/바이오마커) 결과 데이터입니다.",
      why: "기관 연계 결과를 수신하여 2차 진단 분류(AD/MCI/정상)의 근거를 제공합니다.",
      whereUsed: ["Consistency Check 입력", "2차 분류 결과 산출"],
      responsibility: RESPONSIBILITY_LINE,
    },
    dataContract: {
      inputs: [
        { field: "exam_type", type: "enum(PET|MRI|Biomarker)", nullable: false },
        { field: "exam_result", type: "object", nullable: false },
        { field: "exam_date", type: "date", nullable: false },
        { field: "institution_code", type: "string", nullable: false },
      ],
      refreshCadence: "실시간 (기관 연계 시점)",
    },
    qualityAudit: {
      missingRate: 8.9,
      driftSignals: [{ name: "수신 지연 추이", level: "mid", note: "평균 18.3일 (목표 14일)" }],
      biasAlerts: [{ group: "농어촌 지역", level: "mid", note: "수신 소요 +5.2일" }],
      changeLog: [{ version: "v2.1", date: "2026-01-20", summary: "바이오마커 연계 추가" }],
    },
  },
  "in-followup": {
    id: "in-followup",
    definition: {
      what: "MCI 대상자의 추적 방문/상담/검사 이행 이력 데이터입니다.",
      why: "추적 이행률을 모니터링하고, 우선순위 추천 모델의 입력으로 활용됩니다.",
      whereUsed: ["MCI Prioritizer 입력", "이행률 집계"],
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
  "md-s3-prio": {
    id: "md-s3-prio",
    definition: {
      what: "MCI 대상자의 추적 우선순위를 추천하는 판단 보조 모델입니다.",
      why: "제한된 추적 자원을 높은 이탈 위험 대상자에게 우선 배분합니다.",
      whereUsed: ["MCI 추적 일정 관리", "자원 배분 최적화"],
      responsibility: RESPONSIBILITY_LINE,
    },
    dataContract: {
      inputs: [
        { field: "diagnosis_class", type: "enum(MCI)", nullable: false },
        { field: "followup_history", type: "array", nullable: true },
      ],
      outputs: [
        { field: "followup_priority", type: "enum(High|Med|Low)", nullable: false },
        { field: "recommended_actions", type: "string[]", nullable: false },
      ],
      refreshCadence: "주 1회 배치",
    },
    qualityAudit: {
      missingRate: 0.5,
      driftSignals: [{ name: "우선순위 분포 변화", level: "low", note: "High 비율 +1.2%p" }],
      biasAlerts: [{ group: "독거 가구", level: "high", note: "High 과대표현 +12%p" }],
      changeLog: [
        { version: "v2.0", date: "2026-01-10", summary: "모델 전면 교체", impact: "High 정밀도 +4.2%p" },
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
      refreshCadence: "실시간",
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
      refreshCadence: "실시간",
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
      refreshCadence: "주 1회",
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
      refreshCadence: "주 1회",
    },
    qualityAudit: { missingRate: 0, driftSignals: [], biasAlerts: [], changeLog: [] },
  },
};

/* ════════════════════════════════════════════════════════════
   E. Root ViewModel (assembled)
   ════════════════════════════════════════════════════════════ */
export function buildMockViewModel(viewMode: "ops" | "quality" | "audit" = "ops"): ModelCenterViewModel {
  return {
    lastUpdatedAt: "2026-02-12 09:00",
    viewMode,
    kpis: MOCK_KPIS,
    stages: MOCK_STAGES,
    useMap: { nodes: MOCK_NODES, edges: MOCK_EDGES },
    inspector: MOCK_INSPECTOR,
  };
}
