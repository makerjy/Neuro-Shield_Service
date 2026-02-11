/**
 * 광역센터 운영 KPI Dictionary
 * ─────────────────────────────────────────
 * 중앙센터 KPI와의 혼동 방지를 위해 별도 파일로 분리.
 * 모든 KPI는 case_id(배정 케이스) 기준 집계 — event_id/signal_id 기반 KPI 노출 금지.
 *
 * 광역센터 PRIMARY USER JOB:
 * "오늘/이번주 무엇이 밀렸고 어디에 개입해야 하는가"
 * → 현장 처리량 · 병목 · 개입대상 최우선
 */

/* ─── 타입 정의 ─── */
export type RegionalKpiKey =
  | 'ops_new_assigned'       // 신규 배정(이번 기간)
  | 'ops_active_cases'       // 현재 처리중
  | 'ops_sla_breach'         // SLA 위반(건/비율)
  | 'ops_not_reached'        // 미접촉(건/비율)
  | 'ops_long_wait'          // 장기 대기(건/비율)
  | 'ops_recontact_need';    // 재접촉 필요(운영)

export type RegionalChartKey =
  | 'ops_sla_rate'           // SLA 준수율(운영)
  | 'ops_not_reached_rate'   // 미접촉률(운영)
  | 'ops_avg_wait_time'      // 평균 대기시간(운영)
  | 'ops_completion_rate';   // 완료율(운영)

export type RegionalCalcBasis = 'case' | 'event';

export interface RegionalKpiDef {
  kpiKey: RegionalKpiKey | RegionalChartKey;
  label: string;                    // 화면 노출 라벨 (반드시 (운영) 또는 구분자 포함)
  shortLabel: string;               // 카드 축약 라벨
  unit: string;                     // 건, %, 분, 시간
  calcBasis: RegionalCalcBasis;     // 집계 단위 (반드시 'case')
  tooltip: string;                  // 집계 기준 설명
  color: string;                    // 시리즈/아이콘 색상
  iconBg: string;                   // 카드 아이콘 배경
  isTopKpi: boolean;                // 상단 KPI 카드 대상
  mapEligible: boolean;             // 지도 choropleth 가능 여부
  tableEligible: boolean;           // 하단 테이블 컬럼 포함 여부
  trendEligible: boolean;           // 추이 차트 시리즈 대상
  target?: number;                  // 목표치 (ReferenceLine)
  invertColor?: boolean;            // true면 높을수록 나쁨 (대기시간, 위반 등)
  defaultVisible?: boolean;         // 기본 선택 여부
  priority: number;                 // 정렬 순서 (작을수록 먼저)
}

/* ─── 상단 KPI 카드 (TOP KPI SET) ─── */
export const REGIONAL_TOP_KPIS: RegionalKpiDef[] = [
  {
    kpiKey: 'ops_new_assigned',
    label: '신규 배정(운영)',
    shortLabel: '신규 배정',
    unit: '건',
    calcBasis: 'case',
    tooltip: '집계: case_id 기준 | 해당 기간 내 assigned_at 발생 건수 | 동일 시민 중복 신호 → 1건 병합',
    color: '#3b82f6',
    iconBg: 'bg-blue-100 text-blue-600',
    isTopKpi: true,
    mapEligible: true,
    tableEligible: true,
    trendEligible: false,
    defaultVisible: true,
    priority: 1,
  },
  {
    kpiKey: 'ops_active_cases',
    label: '현재 처리중(운영)',
    shortLabel: '처리중',
    unit: '건',
    calcBasis: 'case',
    tooltip: '집계: case_id 기준 | status ∈ {신규, 처리중, 재접촉 필요, SLA 임박/위반} | 완료/이탈 제외',
    color: '#06b6d4',
    iconBg: 'bg-cyan-100 text-cyan-600',
    isTopKpi: true,
    mapEligible: true,
    tableEligible: true,
    trendEligible: false,
    defaultVisible: true,
    priority: 2,
  },
  {
    kpiKey: 'ops_sla_breach',
    label: 'SLA 위반(운영)',
    shortLabel: 'SLA 위반',
    unit: '건',
    calcBasis: 'case',
    tooltip: '집계: case_id 기준 | sla_state=breach | 위반 건수 + (위반/전체 활성)*100 = 위반율',
    color: '#ef4444',
    iconBg: 'bg-red-100 text-red-600',
    isTopKpi: true,
    mapEligible: true,
    tableEligible: true,
    trendEligible: false,
    invertColor: true,
    defaultVisible: true,
    priority: 3,
  },
  {
    kpiKey: 'ops_not_reached',
    label: '미접촉(운영)',
    shortLabel: '미접촉',
    unit: '건',
    calcBasis: 'case',
    tooltip: '집계: case_id 기준 | contact_state ∈ {fail, not_reached} | 접촉 시도 후 미응답 포함',
    color: '#f97316',
    iconBg: 'bg-orange-100 text-orange-600',
    isTopKpi: true,
    mapEligible: true,
    tableEligible: true,
    trendEligible: false,
    invertColor: true,
    defaultVisible: true,
    priority: 4,
  },
  {
    kpiKey: 'ops_long_wait',
    label: '장기 대기(운영)',
    shortLabel: '장기 대기',
    unit: '건',
    calcBasis: 'case',
    tooltip: '집계: case_id 기준 | waiting_days >= 7일(기본 임계) | 첫 배정 후 미처리 기간 기준',
    color: '#8b5cf6',
    iconBg: 'bg-purple-100 text-purple-600',
    isTopKpi: true,
    mapEligible: true,
    tableEligible: true,
    trendEligible: false,
    invertColor: true,
    defaultVisible: true,
    priority: 5,
  },
  {
    kpiKey: 'ops_recontact_need',
    label: '재접촉 필요(운영)',
    shortLabel: '재접촉 필요',
    unit: '건',
    calcBasis: 'case',
    tooltip: '집계: case_id 기준 | needs_recontact=true | 재접촉 미완료 건',
    color: '#ec4899',
    iconBg: 'bg-pink-100 text-pink-600',
    isTopKpi: true,
    mapEligible: false,
    tableEligible: true,
    trendEligible: false,
    invertColor: true,
    defaultVisible: false, // 옵션 — 기본 숨김
    priority: 6,
  },
];

/* ─── 추이/분석 차트용 KPI ─── */
export const REGIONAL_TREND_KPIS: RegionalKpiDef[] = [
  {
    kpiKey: 'ops_sla_rate',
    label: 'SLA 준수율(운영)',
    shortLabel: 'SLA 준수율',
    unit: '%',
    calcBasis: 'case',
    tooltip: 'SLA 기한 내 처리 완료된 케이스 비율 (case_id 기준)',
    color: '#22c55e',
    iconBg: 'bg-green-100 text-green-600',
    isTopKpi: false,
    mapEligible: true,
    tableEligible: true,
    trendEligible: true,
    target: 90,
    defaultVisible: true,
    priority: 10,
  },
  {
    kpiKey: 'ops_not_reached_rate',
    label: '미접촉률(운영)',
    shortLabel: '미접촉률',
    unit: '%',
    calcBasis: 'case',
    tooltip: '접촉 시도 후 미접촉 케이스 비율 (case_id 기준)',
    color: '#f97316',
    iconBg: 'bg-orange-100 text-orange-600',
    isTopKpi: false,
    mapEligible: true,
    tableEligible: true,
    trendEligible: true,
    target: 15,
    invertColor: true,
    defaultVisible: true,
    priority: 11,
  },
  {
    kpiKey: 'ops_avg_wait_time',
    label: '평균 대기시간(운영)',
    shortLabel: '평균 대기',
    unit: '일',
    calcBasis: 'case',
    tooltip: '배정~첫 처리 완료까지 평균 소요 일수 (case_id 기준)',
    color: '#8b5cf6',
    iconBg: 'bg-purple-100 text-purple-600',
    isTopKpi: false,
    mapEligible: false,
    tableEligible: true,
    trendEligible: true,
    target: 5,
    invertColor: true,
    defaultVisible: true,
    priority: 12,
  },
  {
    kpiKey: 'ops_completion_rate',
    label: '완료율(운영)',
    shortLabel: '완료율',
    unit: '%',
    calcBasis: 'case',
    tooltip: '기간 내 완료 처리된 케이스 비율 (case_id 기준, 이탈 제외)',
    color: '#3b82f6',
    iconBg: 'bg-blue-100 text-blue-600',
    isTopKpi: false,
    mapEligible: false,
    tableEligible: true,
    trendEligible: true,
    target: 85,
    defaultVisible: true,
    priority: 13,
  },
];

/* ─── 리스크 스코어 가중치 Config ─── */
export interface RiskWeightConfig {
  slaBreachRate: number;
  notReachedRate: number;
  avgWaitTimeNorm: number;
  longWaitRate: number;
}

export const DEFAULT_RISK_WEIGHTS: RiskWeightConfig = {
  slaBreachRate: 0.35,
  notReachedRate: 0.30,
  avgWaitTimeNorm: 0.20,
  longWaitRate: 0.15,
};

/**
 * risk_score = w1*SLA_breach_rate + w2*not_reached_rate + w3*avg_wait_time_norm + w4*long_wait_rate
 * 정규화: 각 항목은 0~100 범위로 변환 후 가중합
 */
export function computeRiskScore(
  metrics: {
    slaBreachRate: number;    // 0~100
    notReachedRate: number;   // 0~100
    avgWaitTimeNorm: number;  // 0~100 (max 대기 기준 정규화)
    longWaitRate: number;     // 0~100
  },
  weights: RiskWeightConfig = DEFAULT_RISK_WEIGHTS,
): number {
  return (
    weights.slaBreachRate * metrics.slaBreachRate +
    weights.notReachedRate * metrics.notReachedRate +
    weights.avgWaitTimeNorm * metrics.avgWaitTimeNorm +
    weights.longWaitRate * metrics.longWaitRate
  );
}

/* ─── 처리 단계 (운영 정의, 정책 단계 용어 혼입 금지) ─── */
export const OPS_STAGE_KEYS = [
  'new',            // 신규
  'in_progress',    // 처리중
  'recontact_need', // 재접촉 필요
  'sla_imminent',   // SLA 임박
  'sla_breach',     // SLA 위반
  'completed',      // 완료
  'dropout',        // 이탈(운영)
] as const;

export type OpsStageKey = typeof OPS_STAGE_KEYS[number];

export const OPS_STAGE_META: Record<OpsStageKey, { label: string; color: string }> = {
  new:              { label: '신규',          color: '#3b82f6' },
  in_progress:      { label: '처리중',        color: '#06b6d4' },
  recontact_need:   { label: '재접촉 필요',    color: '#f59e0b' },
  sla_imminent:     { label: 'SLA 임박',      color: '#f97316' },
  sla_breach:       { label: 'SLA 위반',      color: '#ef4444' },
  completed:        { label: '완료',          color: '#22c55e' },
  dropout:          { label: '이탈(운영)',     color: '#6b7280' },
};

/* ─── 하단 테이블 컬럼 정의 ─── */
export const OPS_TABLE_COLUMNS = [
  { key: 'district',       label: '시군구',      align: 'left'  as const },
  { key: 'assignedCount',  label: '배정 건수',    align: 'right' as const },
  { key: 'activeCount',    label: '처리중',       align: 'right' as const },
  { key: 'slaBreach',      label: 'SLA 위반',    align: 'right' as const },
  { key: 'slaImminent',    label: 'SLA 임박',    align: 'right' as const },
  { key: 'notReached',     label: '미접촉',       align: 'right' as const },
  { key: 'longWait',       label: '장기대기',     align: 'right' as const },
  { key: 'avgWaitDays',    label: '평균 대기(일)', align: 'right' as const },
  { key: 'completionRate', label: '완료율(운영)',  align: 'right' as const },
] as const;

/* ─── 전체 KPI 목록 (참조/필터용) ─── */
export const ALL_REGIONAL_KPIS: RegionalKpiDef[] = [
  ...REGIONAL_TOP_KPIS,
  ...REGIONAL_TREND_KPIS,
];

/** event_id 기반 KPI는 광역 화면에서 숨김 처리 */
export function isVisibleInRegional(kpi: RegionalKpiDef): boolean {
  return kpi.calcBasis === 'case';
}

/* ─── 광역센터 설정 (localStorage 기반) ─── */
export interface RegionalSettingsData {
  thresholds: {
    longWaitDays: number;    // 장기 대기 기준일 (기본 7)
    slaNearDays: number;     // SLA 임박 기준일 (기본 3)
  };
  weights: RiskWeightConfig;
  notifications: {
    slaBreachAlert: boolean;
    slaImminentAlert: boolean;
    longWaitSurge: boolean;
    riskIncrease: boolean;
  };
}

export const DEFAULT_REGIONAL_SETTINGS: RegionalSettingsData = {
  thresholds: { longWaitDays: 7, slaNearDays: 3 },
  weights: { ...DEFAULT_RISK_WEIGHTS },
  notifications: {
    slaBreachAlert: true,
    slaImminentAlert: true,
    longWaitSurge: false,
    riskIncrease: false,
  },
};

export function loadRegionalSettings(regionCode: string): RegionalSettingsData {
  try {
    const rawT = localStorage.getItem(`regional.settings.${regionCode}.thresholds`);
    const rawW = localStorage.getItem(`regional.settings.${regionCode}.weights`);
    const rawN = localStorage.getItem(`regional.settings.${regionCode}.notifications`);
    return {
      thresholds: rawT ? JSON.parse(rawT) : DEFAULT_REGIONAL_SETTINGS.thresholds,
      weights: rawW ? JSON.parse(rawW) : DEFAULT_REGIONAL_SETTINGS.weights,
      notifications: rawN ? JSON.parse(rawN) : DEFAULT_REGIONAL_SETTINGS.notifications,
    };
  } catch {
    return { ...DEFAULT_REGIONAL_SETTINGS };
  }
}

export function saveRegionalSettings(regionCode: string, settings: RegionalSettingsData): void {
  localStorage.setItem(`regional.settings.${regionCode}.thresholds`, JSON.stringify(settings.thresholds));
  localStorage.setItem(`regional.settings.${regionCode}.weights`, JSON.stringify(settings.weights));
  localStorage.setItem(`regional.settings.${regionCode}.notifications`, JSON.stringify(settings.notifications));
}

/** ops KPI → GeoMapPanel indicatorId 매핑 */
export const OPS_TO_GEO_INDICATOR: Record<string, string> = {
  ops_new_assigned: 'total_cases',
  ops_active_cases: 'completion',
  ops_sla_breach: 'consultation_time',
  ops_not_reached: 'followup_dropout',
  ops_long_wait: 'waitlist_pressure',
};

/** ops KPI → 지도 색상 스키마 매핑 */
export const OPS_COLOR_SCHEME: Record<string, string> = {
  ops_new_assigned: 'blue',
  ops_active_cases: 'green',
  ops_sla_breach: 'red',
  ops_not_reached: 'orange',
  ops_long_wait: 'purple',
};
