export type GeoIndicator = {
  id: string;
  label: string;
  unit: string;
  scale: [number, number];
};

export const GEO_INDICATORS: GeoIndicator[] = [
  { id: 'total_cases', label: '총 케이스 수', unit: '건', scale: [120, 2200] },
  { id: 'completion', label: '케이스 처리율', unit: '%', scale: [60, 98] },
  { id: 'referral', label: 'SLA 준수율', unit: '%', scale: [85, 99] },
  { id: 'consultation_time', label: 'SLA 위반률', unit: '%', scale: [1, 15] },
  { id: 'wait_time', label: '평균 응답시간', unit: '분', scale: [6, 40] },
  { id: 'recontact', label: '데이터 품질', unit: '%', scale: [80, 99] },
  { id: 'followup_dropout', label: '데이터 부족률', unit: '%', scale: [1, 20] },
  { id: 'high_risk_rate', label: '고위험군 비율', unit: '%', scale: [5, 35] },
  { id: 'screening_coverage', label: '1차 선별 완료율', unit: '%', scale: [50, 95] },
  { id: 'dropout', label: '추적 이탈 비율', unit: '%', scale: [3, 25] },
  { id: 'waitlist_pressure', label: '대기/병목 지수', unit: '점', scale: [30, 95] },
  { id: 'accessibility_score', label: '접근성 점수', unit: '점', scale: [40, 98] },
  { id: 'regional_sla_violation', label: '시군구별 SLA 위반율', unit: '%', scale: [2, 34] },
  { id: 'regional_queue_risk', label: '시군구별 병목 점수', unit: '점', scale: [15, 95] },
  { id: 'regional_recontact_rate', label: '시군구별 재접촉 필요율', unit: '%', scale: [4, 38] },
  { id: 'regional_data_readiness', label: '시군구별 데이터 충족률', unit: '%', scale: [62, 99] },
  { id: 'regional_governance_missing', label: '시군구별 로그 누락률', unit: '%', scale: [1, 28] }
];

export function getGeoIndicator(id: string): GeoIndicator {
  return GEO_INDICATORS.find((item) => item.id === id) ?? GEO_INDICATORS[0];
}

export function formatGeoValue(value: number, indicator: GeoIndicator): string {
  if (indicator.unit === '%') return `${value.toFixed(1)}%`;
  if (indicator.unit === '점') return `${Math.round(value)}점`;
  if (indicator.unit === '분') return `${Math.round(value)}분`;
  if (indicator.unit === '건') return `${Math.round(value)}건`;
  return `${Math.round(value)}${indicator.unit}`;
}
