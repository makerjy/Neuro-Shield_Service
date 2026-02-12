/* ═══════════════════════════════════════════════════════════════════════════════
   KPI 사전 데이터 계약 (TypeScript Interface)
═══════════════════════════════════════════════════════════════════════════════ */

export type DrillLevel = 'nation' | 'sido' | 'sigungu' | 'center';
export type ChartType = 'donut' | 'bar' | 'line' | 'table' | 'heatmap' | 'treemap' | 'bullet';
export type AggregationType = 'sum' | 'avg' | 'rate' | 'count' | 'median';
export type BreakdownType = 'ageGroup' | 'centerType' | 'status' | 'region' | 'month' | 'week' | 'severity';
export type UnitType = '%' | '건' | '일' | '분' | '명' | '원' | '점';
export type DomainType = 'case' | 'sla' | 'contact' | 'linkage' | 'dropout' | 'time' | 'data' | 'alert' | 'response' | 'quality';

/* ─────────────────────────────────────────────────────────────
   KPI 정의 인터페이스
───────────────────────────────────────────────────────────── */
export interface KPIDefinition {
  id: string;
  name: string;
  description: string;
  domain: DomainType;
  
  metric: {
    valueField?: string;
    numerator?: string;
    denominator?: string;
    aggregation: AggregationType;
    unit: UnitType;
    // Bullet 차트용 확장
    baseline?: number;       // 기준선 값
    target?: number;         // 목표 값
    higherBetter?: boolean;  // true: 높을수록 좋음, false: 낮을수록 좋음
  };
  
  visualization: {
    chartType: ChartType;
    breakdown?: BreakdownType;
    colorScheme?: string;
    format?: {
      decimals?: number;
      prefix?: string;
      suffix?: string;
    };
  };
  
  filters: {
    allowedLevels: DrillLevel[];
    defaultTimeRange?: 'week' | 'month' | 'quarter' | 'year';
  };
  
  priority: number; // 낮을수록 우선 표시
  isActive: boolean;
  chartEnabled?: boolean;  // KPI 통계 지표 그래프에 표시 여부
}

/* ─────────────────────────────────────────────────────────────
   KPI 데이터 응답 타입들
───────────────────────────────────────────────────────────── */
export interface DonutDataItem {
  name: string;
  value: number;
  color?: string;
}

export interface BarDataItem {
  label: string;
  value: number;
  color?: string;
}

export interface LineDataItem {
  x: string | number;
  value: number;
}

export interface TableColumn {
  key: string;
  label: string;
  align?: 'left' | 'center' | 'right';
  format?: 'number' | 'percent' | 'day' | 'count';
}

export interface TableRow {
  [key: string]: string | number;
}

export interface KPIDataResponse {
  kpiId: string;
  regionCode: string;
  drillLevel: DrillLevel;
  timestamp: string;
  data: DonutDataItem[] | BarDataItem[] | LineDataItem[] | { columns: TableColumn[]; rows: TableRow[] };
  summary?: {
    total?: number;
    average?: number;
    min?: { value: number; region: string };
    max?: { value: number; region: string };
  };
}

/* ─────────────────────────────────────────────────────────────
   드릴다운 상태 타입
───────────────────────────────────────────────────────────── */
export interface DrillPathItem {
  level: DrillLevel;
  code: string;
  name: string;
}

export interface DrillState {
  drillLevel: DrillLevel;
  drillPath: DrillPathItem[];
  selectedRegion: { code: string; name: string; level: DrillLevel } | null;
}

/* ─────────────────────────────────────────────────────────────
   Choropleth Scale 타입
───────────────────────────────────────────────────────────── */
export type ScaleMode = 'quantile' | 'equal';

export interface LegendBin {
  min: number;
  max: number;
  color: string;
  count?: number;
}

export interface ChoroplethScaleConfig {
  values: number[];
  mode: ScaleMode;
  steps: number;
  colorRange?: string[];
}

/* ═══════════════════════════════════════════════════════════════════════════════
   중앙센터(보건복지부) 운영감사형 KPI 타입
   Stage0~3 + L0~L2 파이프라인 기반
═══════════════════════════════════════════════════════════════════════════════ */

/** 시간 윈도우 */
export type CentralTimeWindow = 'LAST_24H' | 'LAST_7D' | 'LAST_30D' | 'LAST_90D';

/** 중앙 KPI ID 리터럴 (5개 핵심 지표) */
export type CentralKpiId =
  | 'SIGNAL_QUALITY'
  | 'POLICY_IMPACT'
  | 'BOTTLENECK_RISK'
  | 'DATA_READINESS'
  | 'GOVERNANCE_SAFETY';

/** 중앙 KPI 정의 (감사형 — numerator/denominator/window/drillToken 필수) */
export interface CentralKpiDefinition {
  id: CentralKpiId;
  name: string;
  shortName: string;        // 카드 라벨용 축약명
  description: string;
  formula: string;           // 사람이 읽을 수 있는 공식 문자열
  numeratorField: string;
  denominatorField: string;
  unit: '%' | '건' | '일' | '시간';
  higherBetter: boolean;
  baseline: number;
  target: number;
  /** 드릴다운 시 사용할 drillToken (서브페이지에서 prefiltered list 연동) */
  drillToken: string;
  /** 보조 지표 키 (예: median lead-time, backlog count) */
  auxiliaryKeys?: string[];
}

/** 중앙 KPI 응답 값 (API 레벨) */
export interface CentralKpiValue {
  kpiId: CentralKpiId;
  window: CentralTimeWindow;
  numerator: number;
  denominator: number;
  value: number;              // numerator / denominator
  delta7d: number;            // 전주 대비 변화 (pp)
  auxiliary?: Record<string, number>; // medianLeadTimeDays, backlogCount 등
  sparkline?: number[];       // 최근 7 데이터포인트
}

/** 중앙 대시보드 KPI 목록 응답 */
export interface CentralDashboardKpisResponse {
  window: CentralTimeWindow;
  timestamp: string;
  kpis: CentralKpiValue[];
}

/* ─────────────────────────────────────────────────────────────
   Funnel (National Funnel Subpage)
───────────────────────────────────────────────────────────── */
export interface FunnelStage {
  stage: string;              // Reach, Stage0, Stage1, Consent, L0, L1, L2, Stage2, Stage3
  label: string;
  count: number;
  conversionRate?: number;    // 이전 스테이지 대비 전환율 (%)
}

export interface FunnelResponse {
  window: CentralTimeWindow;
  stages: FunnelStage[];
}

/* ─────────────────────────────────────────────────────────────
   Bottleneck (병목 진단)
───────────────────────────────────────────────────────────── */
export interface BottleneckMetric {
  key: string;
  label: string;
  value: number;
  unit: string;
  threshold: number;
  status: 'red' | 'yellow' | 'green';
  category: 'consent' | 'readiness' | 'blocked' | 'system';
}

export interface BottleneckResponse {
  window: CentralTimeWindow;
  metrics: BottleneckMetric[];
}

/* ─────────────────────────────────────────────────────────────
   Linkage & Lead-time
───────────────────────────────────────────────────────────── */
export interface LinkageMetric {
  stage: 'stage2' | 'stage3';
  linkageRate: number;
  medianLeadTimeDays: number;
  blockedCount: number;
  blockedReasons: { reason: string; count: number }[];
}

export interface LinkageResponse {
  window: CentralTimeWindow;
  metrics: LinkageMetric[];
}

/* ─────────────────────────────────────────────────────────────
   Regional Comparison Table
───────────────────────────────────────────────────────────── */
export interface RegionComparisonRow {
  regionCode: string;
  regionName: string;
  signalQuality: number;
  policyImpact: number;
  bottleneckRisk: number;
  dataReadiness: number;
  governanceSafety: number;
  blockedPct: number;
  consentPct: number;
  backlogCount: number;
}

export interface RegionComparisonResponse {
  window: CentralTimeWindow;
  rows: RegionComparisonRow[];
}

/* ─────────────────────────────────────────────────────────────
   Event Schema (이벤트 기반 집계)
───────────────────────────────────────────────────────────── */
export type CentralEventType =
  | 'STAGE0_PROCESSED'
  | 'STAGE1_FLAGGED'
  | 'CONSENT_GRANTED'
  | 'INTERVENTION_ASSIGNED'
  | 'L2_FIRST_ACTION_TAKEN'
  | 'STAGE2_ELIGIBLE'
  | 'STAGE2_APPLIED'
  | 'STAGE2_BLOCKED'
  | 'STAGE2_LINKED'
  | 'STAGE2_CAREPATH_SET'
  | 'FOLLOWUP_ENROLLED'
  | 'STAGE3_ELIGIBLE'
  | 'STAGE3_APPLIED'
  | 'STAGE3_BLOCKED'
  | 'NEXT_REVIEW_SCHEDULED'
  | 'REVIEW_COMPLETED'
  | 'DROPOUT_FLAGGED';

export interface CentralEvent {
  eventId: string;
  eventType: CentralEventType;
  caseId: string;
  regionCode: string;
  timestamp: string;          // ISO-8601
  payload?: Record<string, unknown>;
}
