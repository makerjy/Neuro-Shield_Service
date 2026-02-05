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
