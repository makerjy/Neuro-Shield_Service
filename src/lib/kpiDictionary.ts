/* ═══════════════════════════════════════════════════════════════════════════════
   KPI 사전 (Dictionary) - Mock Data
═══════════════════════════════════════════════════════════════════════════════ */

import { KPIDefinition } from './kpi.types';

export const KPI_DICTIONARY: KPIDefinition[] = [
  // ─────────────────────────────────────────────────────────────
  // SLA 관련 KPI
  // ─────────────────────────────────────────────────────────────
  {
    id: 'sla-status',
    name: 'SLA 현황',
    description: 'SLA 준수/위반 현황',
    domain: 'sla',
    metric: {
      numerator: 'sla_compliant_count',
      denominator: 'total_count',
      aggregation: 'rate',
      unit: '%',
    },
    visualization: {
      chartType: 'donut',
      breakdown: 'status',
      colorScheme: 'sla',
      format: { decimals: 2, suffix: '%' },
    },
    filters: {
      allowedLevels: ['nation', 'sido', 'sigungu', 'center'],
      defaultTimeRange: 'week',
    },
    priority: 1,
    isActive: true,
  },
  {
    id: 'data-status',
    name: '데이터 현황',
    description: '데이터 충분/부족 현황',
    domain: 'data',
    metric: {
      numerator: 'data_sufficient_count',
      denominator: 'total_count',
      aggregation: 'rate',
      unit: '%',
    },
    visualization: {
      chartType: 'donut',
      breakdown: 'status',
      colorScheme: 'data',
      format: { decimals: 2, suffix: '%' },
    },
    filters: {
      allowedLevels: ['nation', 'sido', 'sigungu', 'center'],
      defaultTimeRange: 'week',
    },
    priority: 2,
    isActive: true,
  },

  // ─────────────────────────────────────────────────────────────
  // 케이스 분포 KPI
  // ─────────────────────────────────────────────────────────────
  {
    id: 'case-distribution',
    name: '케이스 분포',
    description: '연령별/유형별 케이스 분포',
    domain: 'case',
    metric: {
      valueField: 'case_count',
      aggregation: 'sum',
      unit: '건',
    },
    visualization: {
      chartType: 'bar',
      breakdown: 'ageGroup',
      colorScheme: 'age',
      format: { decimals: 0 },
    },
    filters: {
      allowedLevels: ['nation', 'sido', 'sigungu', 'center'],
      defaultTimeRange: 'week',
    },
    priority: 3,
    isActive: true,
  },

  // ─────────────────────────────────────────────────────────────
  // 센터별/지역별 부하 KPI
  // ─────────────────────────────────────────────────────────────
  {
    id: 'center-load',
    name: '케이스 이동 현황',
    description: '광역센터간 케이스 이동 현황',
    domain: 'case',
    metric: {
      valueField: 'transfer_count',
      aggregation: 'sum',
      unit: '건',
    },
    visualization: {
      chartType: 'bar',
      breakdown: 'centerType',
      colorScheme: 'blue',
      format: { decimals: 0 },
    },
    filters: {
      allowedLevels: ['nation', 'sido'],
      defaultTimeRange: 'week',
    },
    priority: 4,
    isActive: true,
  },

  // ─────────────────────────────────────────────────────────────
  // 시계열 추이 KPI
  // ─────────────────────────────────────────────────────────────
  {
    id: 'trend-timeseries',
    name: '연간 처리량 추이',
    description: '연도별 처리량 및 증감률 추이',
    domain: 'case',
    metric: {
      valueField: 'processed_count',
      aggregation: 'sum',
      unit: '건',
    },
    visualization: {
      chartType: 'line',
      breakdown: 'month',
      colorScheme: 'green',
      format: { decimals: 0 },
    },
    filters: {
      allowedLevels: ['nation', 'sido', 'sigungu'],
      defaultTimeRange: 'year',
    },
    priority: 10,
    isActive: true,
  },

  // ─────────────────────────────────────────────────────────────
  // KPI 요약 테이블
  // ─────────────────────────────────────────────────────────────
  {
    id: 'kpi-summary-table',
    name: 'KPI 요약',
    description: 'KPI별 평균/최저/최고 현황',
    domain: 'case',
    metric: {
      valueField: 'kpi_value',
      aggregation: 'avg',
      unit: '%',
    },
    visualization: {
      chartType: 'table',
      format: { decimals: 1 },
    },
    filters: {
      allowedLevels: ['nation', 'sido'],
      defaultTimeRange: 'week',
    },
    priority: 5,
    isActive: true,
    chartEnabled: false, // KPI 통계 지표 그래프에 표시 안함
  },

  // ─────────────────────────────────────────────────────────────
  // KPI 통계 지표용 Bullet KPI (chartEnabled=true만 자동 표시)
  // ─────────────────────────────────────────────────────────────
  {
    id: 'kpi-sla-rate',
    name: 'SLA 준수율',
    description: '전체 케이스 중 SLA 기준을 충족한 비율',
    domain: 'sla',
    metric: {
      numerator: 'sla_compliant_count',
      denominator: 'total_count',
      aggregation: 'rate',
      unit: '%',
      baseline: 92,
      target: 95,
      higherBetter: true,
    },
    visualization: {
      chartType: 'bullet',
      format: { decimals: 1, suffix: '%' },
    },
    filters: {
      allowedLevels: ['nation', 'sido', 'sigungu', 'center'],
      defaultTimeRange: 'week',
    },
    priority: 100,
    isActive: true,
    chartEnabled: true,
  },
  {
    id: 'kpi-data-rate',
    name: '데이터 충족률',
    description: '필수 데이터 항목이 모두 채워진 케이스 비율',
    domain: 'data',
    metric: {
      numerator: 'data_sufficient_count',
      denominator: 'total_count',
      aggregation: 'rate',
      unit: '%',
      baseline: 88,
      target: 90,
      higherBetter: true,
    },
    visualization: {
      chartType: 'bullet',
      format: { decimals: 1, suffix: '%' },
    },
    filters: {
      allowedLevels: ['nation', 'sido', 'sigungu', 'center'],
      defaultTimeRange: 'week',
    },
    priority: 101,
    isActive: true,
    chartEnabled: true,
  },
  {
    id: 'kpi-completion-rate',
    name: '처리 완료율',
    description: '전체 접수 케이스 중 처리 완료된 비율',
    domain: 'case',
    metric: {
      numerator: 'completed_count',
      denominator: 'total_count',
      aggregation: 'rate',
      unit: '%',
      baseline: 88,
      target: 90,
      higherBetter: true,
    },
    visualization: {
      chartType: 'bullet',
      format: { decimals: 1, suffix: '%' },
    },
    filters: {
      allowedLevels: ['nation', 'sido', 'sigungu', 'center'],
      defaultTimeRange: 'week',
    },
    priority: 102,
    isActive: true,
    chartEnabled: true,
  },
  {
    id: 'kpi-response-rate',
    name: '응답 적시율',
    description: '지정 기한 내 응답한 케이스 비율',
    domain: 'response',
    metric: {
      numerator: 'timely_response_count',
      denominator: 'total_count',
      aggregation: 'rate',
      unit: '%',
      baseline: 82,
      target: 85,
      higherBetter: true,
    },
    visualization: {
      chartType: 'bullet',
      format: { decimals: 1, suffix: '%' },
    },
    filters: {
      allowedLevels: ['nation', 'sido', 'sigungu', 'center'],
      defaultTimeRange: 'week',
    },
    priority: 103,
    isActive: true,
    chartEnabled: true,
  },
  {
    id: 'kpi-quality-score',
    name: '품질 점수',
    description: '처리 품질 평가 점수 평균',
    domain: 'quality',
    metric: {
      valueField: 'quality_score',
      aggregation: 'avg',
      unit: '점',
      baseline: 85,
      target: 88,
      higherBetter: true,
    },
    visualization: {
      chartType: 'bullet',
      format: { decimals: 1, suffix: '점' },
    },
    filters: {
      allowedLevels: ['nation', 'sido', 'sigungu', 'center'],
      defaultTimeRange: 'week',
    },
    priority: 104,
    isActive: true,
    chartEnabled: true,
  },
  {
    id: 'kpi-avg-processing-time',
    name: '평균 처리시간',
    description: '케이스 평균 처리 소요 시간 (일)',
    domain: 'time',
    metric: {
      valueField: 'processing_time_days',
      aggregation: 'avg',
      unit: '일',
      baseline: 3.0,
      target: 2.5,
      higherBetter: false, // 낮을수록 좋음
    },
    visualization: {
      chartType: 'bullet',
      format: { decimals: 1, suffix: '일' },
    },
    filters: {
      allowedLevels: ['nation', 'sido', 'sigungu', 'center'],
      defaultTimeRange: 'week',
    },
    priority: 105,
    isActive: true,
    chartEnabled: true,
  },

  // ─────────────────────────────────────────────────────────────
  // 총 처리건수 (좌측 요약용)
  // ─────────────────────────────────────────────────────────────
  {
    id: 'total-cases',
    name: '총 처리건수',
    description: '전체 처리된 케이스 수',
    domain: 'case',
    metric: {
      valueField: 'total_case_count',
      aggregation: 'sum',
      unit: '건',
    },
    visualization: {
      chartType: 'treemap',
      breakdown: 'region',
      colorScheme: 'blue',
      format: { decimals: 0 },
    },
    filters: {
      allowedLevels: ['nation', 'sido', 'sigungu', 'center'],
      defaultTimeRange: 'week',
    },
    priority: 0,
    isActive: true,
  },
];

/* ─────────────────────────────────────────────────────────────
   KPI 사전 조회 함수
───────────────────────────────────────────────────────────── */
export function getKPIsByPanel(panel: 'left' | 'right' | 'bottom'): KPIDefinition[] {
  const dictionary = KPI_DICTIONARY.filter(k => k.isActive);
  
  switch (panel) {
    case 'left':
      return dictionary.filter(k => 
        k.visualization.chartType === 'treemap' || k.id === 'total-cases'
      ).sort((a, b) => a.priority - b.priority);
    
    case 'right':
      return dictionary.filter(k => 
        ['donut', 'bar', 'table'].includes(k.visualization.chartType) && 
        k.id !== 'total-cases'
      ).sort((a, b) => a.priority - b.priority);
    
    case 'bottom':
      return dictionary.filter(k => 
        k.visualization.chartType === 'line'
      ).sort((a, b) => a.priority - b.priority);
    
    default:
      return [];
  }
}

export function getKPIById(id: string): KPIDefinition | undefined {
  return KPI_DICTIONARY.find(k => k.id === id);
}

export function getKPIsForLevel(level: string): KPIDefinition[] {
  return KPI_DICTIONARY.filter(k => 
    k.isActive && k.filters.allowedLevels.includes(level as any)
  ).sort((a, b) => a.priority - b.priority);
}

/** 
 * KPI 통계 지표 그래프용 - chartEnabled=true인 KPI만 반환
 * 하드코딩 금지: 이 함수를 통해 자동 생성됨
 */
export function getChartEnabledKPIs(level?: string): KPIDefinition[] {
  return KPI_DICTIONARY.filter(k => 
    k.isActive && 
    (k as any).chartEnabled === true &&
    (!level || k.filters.allowedLevels.includes(level as any))
  ).sort((a, b) => a.priority - b.priority);
}

/* ─────────────────────────────────────────────────────────────
   KPI 데이터 Fetch 함수 (Mock)
   실제로는 API 호출을 수행하지만, 여기서는 Mock 데이터 반환
───────────────────────────────────────────────────────────── */
function hashSeed(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash * 31 + input.charCodeAt(i)) >>> 0;
  }
  return hash;
}

function seededRandom(seed: string, min: number, max: number): number {
  const ratio = (hashSeed(seed) % 1000) / 1000;
  return min + (max - min) * ratio;
}

export function fetchKPIData(
  kpiId: string,
  regionCode: string,
  drillLevel: string,
  timeRange?: string
): any {
  const kpi = getKPIById(kpiId);
  if (!kpi) return null;

  const seedKey = `${kpiId}-${regionCode}-${drillLevel}`;
  
  // chartType에 따른 Mock 데이터 생성
  switch (kpi.visualization.chartType) {
    case 'donut': {
      if (kpiId === 'sla-status') {
        const normalRate = 100 - seededRandom(`${seedKey}-sla`, 2, 6);
        return [
          { name: '정상', value: Number(normalRate.toFixed(2)), color: '#3b82f6' },
          { name: '위반', value: Number((100 - normalRate).toFixed(2)), color: '#ef4444' },
        ];
      }
      if (kpiId === 'data-status') {
        const dataRate = 100 - seededRandom(`${seedKey}-data`, 3, 8);
        return [
          { name: '충분', value: Number(dataRate.toFixed(2)), color: '#3b82f6' },
          { name: '부족', value: Number((100 - dataRate).toFixed(2)), color: '#f59e0b' },
        ];
      }
      // 기본 도넛 데이터
      return [
        { name: '항목1', value: Math.round(seededRandom(`${seedKey}-1`, 40, 60)), color: '#3b82f6' },
        { name: '항목2', value: Math.round(seededRandom(`${seedKey}-2`, 20, 40)), color: '#22c55e' },
        { name: '항목3', value: Math.round(seededRandom(`${seedKey}-3`, 10, 20)), color: '#f59e0b' },
      ];
    }
    
    case 'bar': {
      if (kpiId === 'case-distribution') {
        const ages = ['0-4', '5-9', '10-14', '15-19', '20-24', '25-29', '30-34', '35-39', '40-44', '45-49', '50-54', '55-59', '60-64', '65-69'];
        const colors = ['#3b82f6', '#60a5fa', '#22c55e', '#f59e0b', '#ec4899', '#8b5cf6'];
        return ages.map((age, idx) => ({
          label: age,
          value: Math.round(seededRandom(`${seedKey}-age-${idx}`, 800, 4500)),
          color: colors[Math.floor(idx / 3) % colors.length],
        }));
      }
      if (kpiId === 'center-load') {
        return [
          { label: '비이동자', value: Math.round(seededRandom(`${seedKey}-load-1`, 35000, 45000)) },
          { label: '총 이동자', value: Math.round(seededRandom(`${seedKey}-load-2`, 4000, 6000)) },
          { label: '시도내 이동', value: Math.round(seededRandom(`${seedKey}-load-3`, 1500, 2500)) },
          { label: '시도간 이동', value: Math.round(seededRandom(`${seedKey}-load-4`, 1200, 2000)) },
          { label: '광역센터간', value: Math.round(seededRandom(`${seedKey}-load-5`, 1000, 1800)) },
        ];
      }
      // 기본 막대 데이터
      return [
        { label: '항목A', value: Math.round(seededRandom(`${seedKey}-a`, 1000, 5000)) },
        { label: '항목B', value: Math.round(seededRandom(`${seedKey}-b`, 1000, 5000)) },
        { label: '항목C', value: Math.round(seededRandom(`${seedKey}-c`, 1000, 5000)) },
      ];
    }
    
    case 'table': {
      return {
        columns: [
          { key: 'kpi', label: 'KPI 구분', align: 'left' },
          { key: 'avg', label: '평균값', align: 'right', format: 'percent' },
          { key: 'min', label: '최저(지역)', align: 'right' },
          { key: 'max', label: '최고(지역)', align: 'right' },
        ],
        rows: [
          { kpi: 'SLA 준수율', avg: 96.2, min: '91.3% (제주)', max: '99.1% (서울)' },
          { kpi: '데이터 충족률', avg: 94.8, min: '88.5% (강원)', max: '98.2% (경기)' },
          { kpi: '평균 처리시간', avg: 2.3, min: '1.8일 (서울)', max: '3.5일 (제주)' },
        ],
      };
    }
    
    case 'line': {
      const years = ['2018', '2019', '2020', '2021', '2022', '2023', '2024', '2025', '2026'];
      return years.map((year, idx) => ({
        x: year,
        value: Math.round(seededRandom(`${seedKey}-ts-${idx}`, 12000, 18000)),
      }));
    }
    
    case 'treemap': {
      return [
        { name: '경기도', value: Math.round(seededRandom(`${seedKey}-tree-경기`, 2500, 3500)) },
        { name: '경상남도', value: Math.round(seededRandom(`${seedKey}-tree-경남`, 1800, 2500)) },
        { name: '부산광역시', value: Math.round(seededRandom(`${seedKey}-tree-부산`, 1500, 2200)) },
        { name: '인천광역시', value: Math.round(seededRandom(`${seedKey}-tree-인천`, 1200, 1800)) },
        { name: '충청남도', value: Math.round(seededRandom(`${seedKey}-tree-충남`, 1000, 1500)) },
      ];
    }
    
    case 'bullet': {
      // 시계열 차트용 데이터: 일별 데이터 생성 (최근 7/30/90일)
      const metric = kpi.metric as any;
      const baseline = metric.baseline ?? 85;
      const target = metric.target ?? 90;
      const higherBetter = metric.higherBetter !== false;
      const unit = metric.unit || '%';
      
      // 필터에 따른 일수 결정
      const daysCount = timeRange === 'week' ? 7 : timeRange === 'month' ? 30 : 90;
      const today = new Date(2026, 1, 5); // 2026년 2월 5일
      
      // 일별 데이터 생성
      const dailyData: { date: string; value: number }[] = [];
      
      for (let i = daysCount - 1; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        const dateStr = `${d.getMonth() + 1}/${d.getDate()}`;
        
        let baseValue: number;
        if (kpiId === 'kpi-sla-rate') {
          baseValue = 94 + seededRandom(`${seedKey}-sla-d${i}`, -2, 2);
        } else if (kpiId === 'kpi-data-rate') {
          baseValue = 95 + seededRandom(`${seedKey}-data-d${i}`, -3, 2);
        } else if (kpiId === 'kpi-completion-rate') {
          baseValue = 95 + seededRandom(`${seedKey}-comp-d${i}`, -2, 2);
        } else if (kpiId === 'kpi-response-rate') {
          baseValue = 87 + seededRandom(`${seedKey}-resp-d${i}`, -3, 3);
        } else if (kpiId === 'kpi-quality-score') {
          baseValue = 92 + seededRandom(`${seedKey}-qual-d${i}`, -2, 2);
        } else if (kpiId === 'kpi-avg-processing-time') {
          baseValue = 2.3 + seededRandom(`${seedKey}-time-d${i}`, -0.5, 0.5);
        } else {
          baseValue = baseline + seededRandom(`${seedKey}-d${i}`, -5, 5);
        }
        
        dailyData.push({
          date: dateStr,
          value: Number(baseValue.toFixed(1)),
        });
      }
      
      // 현재값 = 마지막 날 값
      const current = dailyData[dailyData.length - 1].value;
      
      return {
        dailyData,
        current,
        baseline,
        target,
        unit,
        higherBetter,
      };
    }
    
    default:
      return null;
  }
}
