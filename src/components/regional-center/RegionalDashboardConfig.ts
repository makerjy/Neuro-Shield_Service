import type { RegionalKpiKey } from '../../lib/regionalKpiDictionary';

export type RegionalDrilldownKind = 'inflow' | 'queue' | 'sla' | 'recontact' | 'centerRisk';
export type RegionalKpiUnit = '건' | '%' | '점' | '일';
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
  {
    key: 'regionalAdTransitionHotspot',
    label: 'AD 전환 예측 집중 구역',
    shortLabel: '전환 위험',
    unit: '점',
    direction: 'higherWorse',
    tooltip: '고위험 전환 신호가 밀집된 구역의 집중도 지표',
    scopeLine: REGIONAL_SCOPE_LINE,
    clickAction: '클릭하면 집중 구역·최근 신호 변화·권장 개입을 본다.',
    drilldownKind: 'centerRisk',
    mapMetricLabel: '시군구별 AD 전환 위험 집중도',
    trendGoal: 42,
    color: '#dc2626',
    iconBg: 'bg-rose-100 text-rose-700',
  },
  {
    key: 'regionalDxDelayHotspot',
    label: '감별검사 지연 구역',
    shortLabel: '검사 지연',
    unit: '일',
    direction: 'higherWorse',
    tooltip: '감별검사 평균 대기일과 지연 비율을 결합한 병목 지표',
    scopeLine: REGIONAL_SCOPE_LINE,
    clickAction: '클릭하면 대기 병목 구역·지연 원인·조치 후보를 본다.',
    drilldownKind: 'queue',
    mapMetricLabel: '시군구별 감별검사 지연 대기일',
    trendGoal: 24,
    color: '#f97316',
    iconBg: 'bg-orange-100 text-orange-700',
  },
  {
    key: 'regionalScreenToDxRate',
    label: '선별→정밀연계 전환율 비교',
    shortLabel: '전환율',
    unit: '%',
    direction: 'higherBetter',
    tooltip: '선별 이후 정밀연계 방문 완료율 비교 지표',
    scopeLine: REGIONAL_SCOPE_LINE,
    clickAction: '클릭하면 지역별 전환율 격차와 운영 제안을 본다.',
    drilldownKind: 'sla',
    mapMetricLabel: '시군구별 선별→정밀연계 전환율',
    trendGoal: 68,
    color: '#0f766e',
    iconBg: 'bg-teal-100 text-teal-700',
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
