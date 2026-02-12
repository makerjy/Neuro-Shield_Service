/**
 * Regional KPI Dictionary (광역센터 운영 책임형)
 * - 중앙 프레임은 유지하고 KPI 의미만 광역 운영 책임 기준으로 재정의한다.
 * - 모든 지표는 case_id(운영 케이스) 기준 집계로 가정한다.
 */

/* ─── 타입 정의 ─── */
export type RegionalKpiKey =
  | 'regionalSla'            // 처리 SLA 준수율 (대표값)
  | 'regionalQueueRisk'      // 병목 큐 위험 점수
  | 'regionalRecontact'      // 재접촉 필요율
  | 'regionalDataReadiness'  // 데이터 충족률
  | 'regionalGovernance';    // 로그 완전성

export type RegionalChartKey =
  | 'regionalSlaTrend'
  | 'regionalQueueRiskTrend'
  | 'regionalRecontactTrend'
  | 'regionalDataReadinessTrend'
  | 'regionalGovernanceTrend';

export type RegionalCalcBasis = 'case' | 'event';
export type KpiDirection = 'higherWorse' | 'higherBetter';

export interface RegionalKpiDef {
  kpiKey: RegionalKpiKey | RegionalChartKey;
  label: string;
  shortLabel: string;
  unit: string;
  calcBasis: RegionalCalcBasis;
  tooltip: string;
  color: string;
  iconBg: string;
  isTopKpi: boolean;
  mapEligible: boolean;
  tableEligible: boolean;
  trendEligible: boolean;
  target?: number;
  invertColor?: boolean;
  defaultVisible?: boolean;
  priority: number;
  direction: KpiDirection;
}

/* ─── 상단 KPI 카드 (운영 책임형 5종) ─── */
export const REGIONAL_TOP_KPIS: RegionalKpiDef[] = [
  {
    kpiKey: 'regionalSla',
    label: '처리 SLA',
    shortLabel: '처리 SLA',
    unit: '%',
    calcBasis: 'case',
    tooltip: '광역 관할 케이스의 SLA 준수율. 지도는 시군구별 SLA 위반율을 보여준다.',
    color: '#2563eb',
    iconBg: 'bg-blue-100 text-blue-700',
    isTopKpi: true,
    mapEligible: true,
    tableEligible: true,
    trendEligible: true,
    target: 90,
    defaultVisible: true,
    priority: 1,
    direction: 'higherBetter',
  },
  {
    kpiKey: 'regionalQueueRisk',
    label: '병목 큐',
    shortLabel: '병목 큐',
    unit: '점',
    calcBasis: 'case',
    tooltip: '적체, 지연, 재접촉 누적을 반영한 병목 위험 점수. 값이 높을수록 우선 조치 필요.',
    color: '#ea580c',
    iconBg: 'bg-orange-100 text-orange-700',
    isTopKpi: true,
    mapEligible: true,
    tableEligible: true,
    trendEligible: true,
    target: 45,
    invertColor: true,
    defaultVisible: true,
    priority: 2,
    direction: 'higherWorse',
  },
  {
    kpiKey: 'regionalRecontact',
    label: '재접촉 필요',
    shortLabel: '재접촉 필요',
    unit: '%',
    calcBasis: 'case',
    tooltip: '재접촉이 필요한 케이스 비율. 실패 사유와 시간대별 성공률로 바로 조치한다.',
    color: '#d97706',
    iconBg: 'bg-amber-100 text-amber-700',
    isTopKpi: true,
    mapEligible: true,
    tableEligible: true,
    trendEligible: true,
    target: 12,
    invertColor: true,
    defaultVisible: true,
    priority: 3,
    direction: 'higherWorse',
  },
  {
    kpiKey: 'regionalDataReadiness',
    label: '데이터 준비',
    shortLabel: '데이터 준비',
    unit: '%',
    calcBasis: 'case',
    tooltip: '운영 필수 필드가 충족된 비율. 결측 필드와 수집 지연 구간을 함께 본다.',
    color: '#16a34a',
    iconBg: 'bg-green-100 text-green-700',
    isTopKpi: true,
    mapEligible: true,
    tableEligible: true,
    trendEligible: true,
    target: 92,
    defaultVisible: true,
    priority: 4,
    direction: 'higherBetter',
  },
  {
    kpiKey: 'regionalGovernance',
    label: '거버넌스/로그 완전성',
    shortLabel: '거버넌스',
    unit: '%',
    calcBasis: 'case',
    tooltip: '책임자, 근거, 로그 누락 없이 기록된 비율. 지도는 시군구별 누락률을 표시한다.',
    color: '#7c3aed',
    iconBg: 'bg-violet-100 text-violet-700',
    isTopKpi: true,
    mapEligible: true,
    tableEligible: true,
    trendEligible: true,
    target: 95,
    defaultVisible: true,
    priority: 5,
    direction: 'higherBetter',
  },
];

/* ─── 추이/분석 차트용 KPI 정의 ─── */
export const REGIONAL_TREND_KPIS: RegionalKpiDef[] = [
  {
    kpiKey: 'regionalSlaTrend',
    label: '처리 SLA 추이',
    shortLabel: '처리 SLA',
    unit: '%',
    calcBasis: 'case',
    tooltip: '처리 SLA 추이',
    color: '#2563eb',
    iconBg: 'bg-blue-100 text-blue-700',
    isTopKpi: false,
    mapEligible: false,
    tableEligible: false,
    trendEligible: true,
    target: 90,
    defaultVisible: true,
    priority: 11,
    direction: 'higherBetter',
  },
  {
    kpiKey: 'regionalQueueRiskTrend',
    label: '병목 큐 추이',
    shortLabel: '병목 큐',
    unit: '점',
    calcBasis: 'case',
    tooltip: '병목 큐 추이',
    color: '#ea580c',
    iconBg: 'bg-orange-100 text-orange-700',
    isTopKpi: false,
    mapEligible: false,
    tableEligible: false,
    trendEligible: true,
    target: 45,
    invertColor: true,
    defaultVisible: true,
    priority: 12,
    direction: 'higherWorse',
  },
  {
    kpiKey: 'regionalRecontactTrend',
    label: '재접촉 필요 추이',
    shortLabel: '재접촉 필요',
    unit: '%',
    calcBasis: 'case',
    tooltip: '재접촉 필요 추이',
    color: '#d97706',
    iconBg: 'bg-amber-100 text-amber-700',
    isTopKpi: false,
    mapEligible: false,
    tableEligible: false,
    trendEligible: true,
    target: 12,
    invertColor: true,
    defaultVisible: true,
    priority: 13,
    direction: 'higherWorse',
  },
  {
    kpiKey: 'regionalDataReadinessTrend',
    label: '데이터 준비 추이',
    shortLabel: '데이터 준비',
    unit: '%',
    calcBasis: 'case',
    tooltip: '데이터 준비 추이',
    color: '#16a34a',
    iconBg: 'bg-green-100 text-green-700',
    isTopKpi: false,
    mapEligible: false,
    tableEligible: false,
    trendEligible: true,
    target: 92,
    defaultVisible: true,
    priority: 14,
    direction: 'higherBetter',
  },
  {
    kpiKey: 'regionalGovernanceTrend',
    label: '거버넌스 추이',
    shortLabel: '거버넌스',
    unit: '%',
    calcBasis: 'case',
    tooltip: '거버넌스 추이',
    color: '#7c3aed',
    iconBg: 'bg-violet-100 text-violet-700',
    isTopKpi: false,
    mapEligible: false,
    tableEligible: false,
    trendEligible: true,
    target: 95,
    defaultVisible: true,
    priority: 15,
    direction: 'higherBetter',
  },
];

/* ─── 리스크 스코어 가중치 Config (설정 화면 호환 유지) ─── */
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
 * 레거시 호환 스코어 함수 (설정 화면 수식 안내와 호환 유지)
 */
export function computeRiskScore(
  metrics: {
    slaBreachRate: number;
    notReachedRate: number;
    avgWaitTimeNorm: number;
    longWaitRate: number;
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

/* ─── Top5 우선순위 계산 (요구 공식: 0.6 * KPI + 0.4 * volume) ─── */
export const PRIORITY_WEIGHTS = {
  kpi: 0.6,
  volume: 0.4,
} as const;

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

export function normalizeForPriority(value: number, min: number, max: number, direction: KpiDirection): number {
  if (max <= min) return 0.5;
  const normalized = clamp01((value - min) / (max - min));
  return direction === 'higherWorse' ? normalized : 1 - normalized;
}

export function normalizeVolumeForPriority(value: number, min: number, max: number): number {
  if (max <= min) return 0.5;
  return clamp01((value - min) / (max - min));
}

export function computePriorityScore(params: {
  kpiValue: number;
  kpiMin: number;
  kpiMax: number;
  volume: number;
  volumeMin: number;
  volumeMax: number;
  direction: KpiDirection;
}): number {
  const kpiNorm = normalizeForPriority(params.kpiValue, params.kpiMin, params.kpiMax, params.direction);
  const volumeNorm = normalizeVolumeForPriority(params.volume, params.volumeMin, params.volumeMax);
  return Number((kpiNorm * PRIORITY_WEIGHTS.kpi + volumeNorm * PRIORITY_WEIGHTS.volume).toFixed(3));
}

/* ─── 처리 단계 (운영 정의) ─── */
export const OPS_STAGE_KEYS = [
  'new',
  'in_progress',
  'recontact_need',
  'sla_imminent',
  'sla_breach',
  'completed',
  'dropout',
] as const;

export type OpsStageKey = typeof OPS_STAGE_KEYS[number];

export const OPS_STAGE_META: Record<OpsStageKey, { label: string; color: string }> = {
  new: { label: '신규', color: '#3b82f6' },
  in_progress: { label: '처리중', color: '#06b6d4' },
  recontact_need: { label: '재접촉 필요', color: '#f59e0b' },
  sla_imminent: { label: 'SLA 임박', color: '#f97316' },
  sla_breach: { label: 'SLA 위반', color: '#ef4444' },
  completed: { label: '완료', color: '#22c55e' },
  dropout: { label: '이탈(운영)', color: '#6b7280' },
};

/* ─── 하단 요약 컬럼 (운영 우선순위) ─── */
export const OPS_TABLE_COLUMNS = [
  { key: 'district', label: '시군구', align: 'left' as const },
  { key: 'kpiValue', label: 'KPI 값', align: 'right' as const },
  { key: 'volume', label: '규모(건수)', align: 'right' as const },
  { key: 'priorityScore', label: '우선순위', align: 'right' as const },
  { key: 'nationalDelta', label: '전국 대비 Δ', align: 'right' as const },
] as const;

/* ─── 전체 KPI 목록 (참조용) ─── */
export const ALL_REGIONAL_KPIS: RegionalKpiDef[] = [
  ...REGIONAL_TOP_KPIS,
  ...REGIONAL_TREND_KPIS,
];

export function isVisibleInRegional(kpi: RegionalKpiDef): boolean {
  return kpi.calcBasis === 'case';
}

/* ─── 광역센터 설정 (localStorage 기반) ─── */
export interface RegionalSettingsData {
  thresholds: {
    longWaitDays: number;
    slaNearDays: number;
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

/** KPI → GeoMapPanel indicatorId 매핑 */
export const OPS_TO_GEO_INDICATOR: Record<RegionalKpiKey, string> = {
  regionalSla: 'regional_sla_violation',
  regionalQueueRisk: 'regional_queue_risk',
  regionalRecontact: 'regional_recontact_rate',
  regionalDataReadiness: 'regional_data_readiness',
  regionalGovernance: 'regional_governance_missing',
};

/** KPI → 지도 색상 스키마 */
export const OPS_COLOR_SCHEME: Record<RegionalKpiKey, string> = {
  regionalSla: 'red',
  regionalQueueRisk: 'orange',
  regionalRecontact: 'orange',
  regionalDataReadiness: 'green',
  regionalGovernance: 'purple',
};
