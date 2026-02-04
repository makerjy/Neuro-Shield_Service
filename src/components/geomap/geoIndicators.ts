export type GeoIndicator = {
  id: string;
  label: string;
  unit: string;
  scale: [number, number];
};

export const GEO_INDICATORS: GeoIndicator[] = [
  { id: 'completion', label: '상담완료율', unit: '%', scale: [55, 95] },
  { id: 'referral', label: '연계율', unit: '%', scale: [20, 70] },
  { id: 'dropout', label: '이탈률', unit: '%', scale: [5, 30] },
  { id: 'recontact', label: '재접촉 성공률', unit: '%', scale: [30, 80] },
  { id: 'wait_time', label: '평균 상담대기시간', unit: '일', scale: [0.5, 5] },
  { id: 'consultation_time', label: '평균 상담시간', unit: '분', scale: [10, 35] },
  { id: 'high_risk_rate', label: '고위험군 비율', unit: '명/1만', scale: [12, 68] },
  { id: 'screening_coverage', label: '1차 선별 완료율', unit: '%', scale: [45, 92] },
  { id: 'followup_dropout', label: '추적 이탈 비율', unit: '%', scale: [6, 28] },
  { id: 'waitlist_pressure', label: '대기/병목 지수', unit: '점', scale: [30, 95] },
  { id: 'accessibility_score', label: '접근성 점수', unit: '점', scale: [40, 98] }
];

export function getGeoIndicator(id: string): GeoIndicator {
  return GEO_INDICATORS.find((item) => item.id === id) ?? GEO_INDICATORS[0];
}

export function formatGeoValue(value: number, indicator: GeoIndicator): string {
  if (indicator.unit === '%') return `${value.toFixed(1)}%`;
  if (indicator.unit === '점') return `${Math.round(value)}점`;
  if (indicator.unit === '일') return `${value.toFixed(1)}일`;
  if (indicator.unit === '분') return `${Math.round(value)}분`;
  if (indicator.unit === '명/1만') return `${value.toFixed(1)}명`;
  return `${Math.round(value)}${indicator.unit}`;
}
