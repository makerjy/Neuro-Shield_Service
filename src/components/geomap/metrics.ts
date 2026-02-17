import { GeoIndicator } from './geoIndicators';
import { normalizeRegionCode } from '../../lib/regionKey';

export type MetricPoint = {
  code: string;
  name: string;
  value: number;
  yoy: number;
  rank: number;
};

export type RegionSeriesPoint = {
  year: number;
  value: number;
};

const hashSeed = (input: string) => {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash * 31 + input.charCodeAt(i)) >>> 0;
  }
  return hash;
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const seededRatio = (seed: string) => (hashSeed(seed) % 10000) / 10000;
const seededBetween = (seed: string, min: number, max: number) => min + seededRatio(seed) * (max - min);

const buildDeterministicSeries = (
  code: string,
  indicator: GeoIndicator,
  years: number[]
): RegionSeriesPoint[] => {
  if (!years.length) return [];

  const [min, max] = indicator.scale;
  const range = max - min;
  const len = years.length;
  const denominator = Math.max(1, len - 1);
  const seedBase = `${code}-${indicator.id}`;

  const base = seededBetween(`${seedBase}-base`, min + range * 0.2, max - range * 0.2);
  const slope = seededBetween(`${seedBase}-slope`, -range * 0.045, range * 0.045);
  const seasonalAmp = seededBetween(`${seedBase}-amp`, range * 0.04, range * 0.14);
  const phase = seededBetween(`${seedBase}-phase`, 0, Math.PI * 2);
  const noiseAmp = range * 0.03;
  const shockIndex = Math.round(seededBetween(`${seedBase}-shock-index`, 1, Math.max(1, len - 2)));
  const shockSign = seededBetween(`${seedBase}-shock-sign`, -1, 1) >= 0 ? 1 : -1;
  const shockAmp = seededBetween(`${seedBase}-shock-amp`, range * 0.06, range * 0.18) * shockSign;
  const shockRecovery = seededBetween(`${seedBase}-shock-rec`, 0.38, 0.72);

  return years.map((year, index) => {
    const drift = (index - denominator / 2) * slope;
    const wave = Math.sin((index / denominator) * Math.PI * 2 + phase) * seasonalAmp;
    const secondaryWave = Math.sin((index / denominator) * Math.PI + phase * 0.35) * seasonalAmp * 0.35;
    const noise = seededBetween(`${seedBase}-noise-${year}`, -noiseAmp, noiseAmp);

    let shock = 0;
    if (index === shockIndex) shock += shockAmp;
    if (index === shockIndex - 1) shock += shockAmp * 0.22;
    if (index === shockIndex + 1) shock -= shockAmp * shockRecovery;
    if (index === shockIndex + 2) shock -= shockAmp * shockRecovery * 0.35;

    const value = clamp(base + drift + wave + secondaryWave + noise + shock, min, max);
    return {
      year,
      value: Number(value.toFixed(1)),
    };
  });
};

const getFeatureCode = (feature: any) =>
  normalizeRegionCode(
    feature?.properties?.code ??
      feature?.properties?.adm_cd ??
      feature?.properties?.ADM_CD ??
      feature?.properties?.sggnm_cd ??
      feature?.properties?.SGGNM_CD ??
      feature?.properties?.sigungu_cd ??
      feature?.properties?.SIGUNGU_CD ??
      feature?.properties?.emd_cd ??
      feature?.properties?.EMD_CD ??
      feature?.properties?.CTPRVN_CD ??
      feature?.properties?.SIG_CD ??
      feature?.properties?.EMD_CD ??
      ''
  );

const getFeatureName = (feature: any) =>
  String(
    feature?.properties?.name ??
      feature?.properties?.CTP_KOR_NM ??
      feature?.properties?.SIG_KOR_NM ??
      feature?.properties?.EMD_KOR_NM ??
      '-'
  );

export const buildMetrics = (
  features: any[],
  indicator: GeoIndicator,
  year: number
): MetricPoint[] => {
  const points = features.map((feature) => {
    const code = getFeatureCode(feature);
    const name = getFeatureName(feature);
    const series = buildDeterministicSeries(code, indicator, [year - 1, year]);
    const prevValue = series[0]?.value ?? indicator.scale[0];
    const value = series[1]?.value ?? prevValue;
    const yoy = value - prevValue;
    return { code, name, value, yoy, rank: 0 };
  });

  const sorted = [...points].sort((a, b) => b.value - a.value);
  sorted.forEach((item, idx) => {
    item.rank = idx + 1;
  });
  return points;
};

export const buildRegionSeries = (
  code: string,
  indicator: GeoIndicator,
  years: number[]
): RegionSeriesPoint[] => {
  return buildDeterministicSeries(code, indicator, years);
};

export const buildComposition = (code: string) => {
  const hash = hashSeed(code);
  const primary = 40 + (hash % 40);
  const secondary = 100 - primary;
  return [
    { name: '고위험군', value: primary },
    { name: '관찰군', value: secondary }
  ];
};
