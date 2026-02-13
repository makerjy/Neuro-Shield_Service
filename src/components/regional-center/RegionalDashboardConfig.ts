import type { RegionalKpiKey } from '../../lib/regionalKpiDictionary';

export type RegionalDrilldownKind = 'inflow' | 'queue' | 'sla' | 'recontact' | 'centerRisk';
export type RegionalKpiUnit = '건' | '%' | '점';
export type RegionalKpiDirection = 'higherWorse' | 'higherBetter';

export interface RegionalDashboardKpiConfig {
  key: RegionalKpiKey;
  label: string;
  shortLabel: string;
  unit: RegionalKpiUnit;
  direction: RegionalKpiDirection;
  tooltip: string;
  scopeLine: string;
  clickAction: string;
  drilldownKind: RegionalDrilldownKind;
  mapMetricLabel: string;
  trendGoal: number;
  color: string;
  iconBg: string;
}

const REGIONAL_SCOPE_LINE = '광역 관할 하위 센터 기준';

export const REGIONAL_DASHBOARD_KPIS: RegionalDashboardKpiConfig[] = [
  {
    key: 'regionalSla',
    label: '신규 유입(금일/24h)',
    shortLabel: '신규 유입',
    unit: '건',
    direction: 'higherWorse',
    tooltip: '최근 기간에 새로 유입·전환된 케이스 규모',
    scopeLine: REGIONAL_SCOPE_LINE,
    clickAction: '클릭하면 유입 경로별로 분해한다.',
    drilldownKind: 'inflow',
    mapMetricLabel: '시군구별 신규 유입량',
    trendGoal: 280,
    color: '#2563eb',
    iconBg: 'bg-blue-100 text-blue-700',
  },
  {
    key: 'regionalQueueRisk',
    label: '처리 중(큐 잔량)',
    shortLabel: '처리 중',
    unit: '건',
    direction: 'higherWorse',
    tooltip: '현재 처리 대기/진행 중인 큐 잔량',
    scopeLine: REGIONAL_SCOPE_LINE,
    clickAction: '클릭하면 큐 유형·센터별 적체를 본다.',
    drilldownKind: 'queue',
    mapMetricLabel: '시군구별 큐 잔량',
    trendGoal: 160,
    color: '#ea580c',
    iconBg: 'bg-orange-100 text-orange-700',
  },
  {
    key: 'regionalRecontact',
    label: 'SLA 위험(임박/초과)',
    shortLabel: 'SLA 위험',
    unit: '%',
    direction: 'higherWorse',
    tooltip: '기한 임박/초과로 지연 위험이 있는 케이스 비율',
    scopeLine: REGIONAL_SCOPE_LINE,
    clickAction: '클릭하면 위험 매트릭스를 연다.',
    drilldownKind: 'sla',
    mapMetricLabel: '시군구별 SLA 위험 비율',
    trendGoal: 6,
    color: '#ef4444',
    iconBg: 'bg-red-100 text-red-700',
  },
  {
    key: 'regionalDataReadiness',
    label: '재접촉 필요',
    shortLabel: '재접촉',
    unit: '%',
    direction: 'higherWorse',
    tooltip: '미응답·반송·번호 오류로 재접촉이 필요한 케이스 비율',
    scopeLine: REGIONAL_SCOPE_LINE,
    clickAction: '클릭하면 사유별 조치로 연결한다.',
    drilldownKind: 'recontact',
    mapMetricLabel: '시군구별 재접촉 필요 비율',
    trendGoal: 9,
    color: '#d97706',
    iconBg: 'bg-amber-100 text-amber-700',
  },
  {
    key: 'regionalGovernance',
    label: '센터 리스크(운영 병목)',
    shortLabel: '센터 리스크',
    unit: '점',
    direction: 'higherWorse',
    tooltip: '하위 센터의 적체·오류·SLA 위험이 누적된 운영 리스크',
    scopeLine: REGIONAL_SCOPE_LINE,
    clickAction: '클릭하면 지원 우선순위를 정한다.',
    drilldownKind: 'centerRisk',
    mapMetricLabel: '시군구별 센터 리스크 점수',
    trendGoal: 40,
    color: '#7c3aed',
    iconBg: 'bg-violet-100 text-violet-700',
  },
];

export const REGIONAL_DASHBOARD_KPI_MAP: Record<RegionalKpiKey, RegionalDashboardKpiConfig> =
  REGIONAL_DASHBOARD_KPIS.reduce(
    (acc, item) => {
      acc[item.key] = item;
      return acc;
    },
    {} as Record<RegionalKpiKey, RegionalDashboardKpiConfig>,
  );
