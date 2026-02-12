/* ═══════════════════════════════════════════════════════════════════════════════
   Choropleth Scale 유틸리티 - 지도 색상 스케일 관리
═══════════════════════════════════════════════════════════════════════════════ */

import { LegendBin, ScaleMode } from './kpi.types';

/* ─────────────────────────────────────────────────────────────
   색상 팔레트
───────────────────────────────────────────────────────────── */
export const COLOR_PALETTES = {
  blue: ['#eff6ff', '#bfdbfe', '#93c5fd', '#60a5fa', '#3b82f6', '#2563eb', '#1d4ed8'],
  red: ['#fef2f2', '#fecaca', '#fca5a5', '#f87171', '#ef4444', '#dc2626', '#b91c1c'],
  green: ['#f0fdf4', '#bbf7d0', '#86efac', '#4ade80', '#22c55e', '#16a34a', '#15803d'],
  orange: ['#fff7ed', '#fed7aa', '#fdba74', '#fb923c', '#f97316', '#ea580c', '#c2410c'],
  purple: ['#faf5ff', '#e9d5ff', '#d8b4fe', '#c084fc', '#a855f7', '#9333ea', '#7e22ce'],
  heat: ['#fef3c7', '#fde68a', '#fcd34d', '#fbbf24', '#f59e0b', '#d97706', '#b45309'],
  risk: ['#ecfdf3', '#bbf7d0', '#86efac', '#fde68a', '#fbbf24', '#f97316', '#dc2626'],
};

/* ─────────────────────────────────────────────────────────────
   스케일 빌더 클래스
───────────────────────────────────────────────────────────── */
export class ChoroplethScale {
  private values: number[];
  private mode: ScaleMode;
  private steps: number;
  private colors: string[];
  private bins: LegendBin[];

  constructor(
    values: number[],
    mode: ScaleMode = 'quantile',
    steps: number = 6,
    colorPalette: keyof typeof COLOR_PALETTES = 'blue'
  ) {
    this.values = values.filter(v => v != null && !isNaN(v)).sort((a, b) => a - b);
    this.mode = mode;
    this.steps = Math.min(steps, this.values.length);
    this.colors = COLOR_PALETTES[colorPalette].slice(0, this.steps);
    this.bins = this.buildBins();
  }

  private buildBins(): LegendBin[] {
    if (this.values.length === 0) return [];

    const bins: LegendBin[] = [];
    const min = Math.min(...this.values);
    const max = Math.max(...this.values);

    if (this.mode === 'quantile') {
      // 분위 기반 구간
      for (let i = 0; i < this.steps; i++) {
        const startIdx = Math.floor((i / this.steps) * this.values.length);
        const endIdx = Math.floor(((i + 1) / this.steps) * this.values.length) - 1;
        
        const binMin = this.values[startIdx];
        const binMax = this.values[Math.min(endIdx, this.values.length - 1)];
        
        // 해당 구간에 속한 값 개수
        const count = this.values.filter(v => v >= binMin && (i === this.steps - 1 ? v <= binMax : v < (bins[i - 1]?.max ?? binMin))).length;
        
        bins.push({
          min: binMin,
          max: binMax,
          color: this.colors[i],
          count: Math.max(1, Math.floor(this.values.length / this.steps)),
        });
      }
    } else {
      // 동일 간격 구간
      const interval = (max - min) / this.steps;
      
      for (let i = 0; i < this.steps; i++) {
        const binMin = min + interval * i;
        const binMax = i === this.steps - 1 ? max : min + interval * (i + 1);
        const count = this.values.filter(v => v >= binMin && v <= binMax).length;
        
        bins.push({
          min: Math.round(binMin),
          max: Math.round(binMax),
          color: this.colors[i],
          count,
        });
      }
    }

    return bins;
  }

  getColor(value: number): string {
    if (value == null || isNaN(value)) return '#e5e7eb'; // gray-200
    
    for (let i = 0; i < this.bins.length; i++) {
      const bin = this.bins[i];
      if (value >= bin.min && (i === this.bins.length - 1 ? value <= bin.max : value < this.bins[i + 1]?.min)) {
        return bin.color;
      }
    }
    
    // 범위 밖이면 가장 가까운 색상
    if (value < this.bins[0]?.min) return this.colors[0];
    return this.colors[this.colors.length - 1];
  }

  getLegendBins(): LegendBin[] {
    return this.bins;
  }

  getStats() {
    if (this.values.length === 0) {
      return { min: 0, max: 0, avg: 0, median: 0, total: 0 };
    }
    
    const sum = this.values.reduce((a, b) => a + b, 0);
    const mid = Math.floor(this.values.length / 2);
    
    return {
      min: Math.min(...this.values),
      max: Math.max(...this.values),
      avg: Math.round(sum / this.values.length),
      median: this.values.length % 2 ? this.values[mid] : Math.round((this.values[mid - 1] + this.values[mid]) / 2),
      total: sum,
    };
  }
}

/* ─────────────────────────────────────════════════════════────
   포맷터 유틸리티
───────────────────────────────────────────────────────────── */
export function formatNumber(value: number, unit?: string): string {
  if (value == null || isNaN(value)) return '-';
  
  const formatted = value >= 10000 
    ? `${(value / 10000).toFixed(1)}만`
    : value >= 1000 
      ? `${(value / 1000).toFixed(1)}천`
      : value.toLocaleString();
  
  return unit ? `${formatted}${unit}` : formatted;
}

export function formatPercent(value: number, decimals: number = 1): string {
  if (value == null || isNaN(value)) return '-';
  return `${value.toFixed(decimals)}%`;
}

export function formatRange(min: number, max: number): string {
  return `${formatNumber(min)} ~ ${formatNumber(max)}`;
}

/* ─────────────────────────────────────────────────────────────
   KPI 기반 색상 팔레트 매핑 유틸리티
───────────────────────────────────────────────────────────── */
export const KPI_PALETTE_MAP: Record<string, keyof typeof COLOR_PALETTES> = {
  throughputNow: 'blue',
  slaViolationRateNow: 'red',
  dataShortageRateNow: 'heat',
  activeIncidentsNow: 'green',
  /* 새 5-KPI */
  signalQuality: 'blue',
  policyImpact: 'purple',
  bottleneckRisk: 'red',
  dataReadiness: 'green',
  governanceSafety: 'heat',
};

/** KPI 키에 해당하는 팔레트 이름 반환 */
export function getKpiPalette(kpiKey: string): keyof typeof COLOR_PALETTES {
  return KPI_PALETTE_MAP[kpiKey] ?? 'blue';
}

/** KPI 키에 해당하는 색상 배열 반환 */
export function getKpiPaletteColors(kpiKey: string): string[] {
  return COLOR_PALETTES[getKpiPalette(kpiKey)];
}

/** KPI 키에 해당하는 CSS 그라데이션 문자열 반환 */
export function getKpiGradient(kpiKey: string): string {
  const colors = getKpiPaletteColors(kpiKey);
  return `linear-gradient(90deg, ${colors.join(', ')})`;
}

/** KPI 키에 해당하는 한글 라벨 */
export const KPI_LABELS: Record<string, string> = {
  throughputNow: '전국 운영 처리건수',
  slaViolationRateNow: 'SLA 위반률',
  dataShortageRateNow: '데이터 부족률',
  activeIncidentsNow: '활성 이슈',
  /* 새 5-KPI */
  signalQuality: '신호 품질',
  policyImpact: '정책 영향',
  bottleneckRisk: '병목 위험',
  dataReadiness: '데이터 준비도',
  governanceSafety: '거버넌스 안전',
};

export function getKpiLabel(kpiKey: string): string {
  return KPI_LABELS[kpiKey] ?? kpiKey;
}
