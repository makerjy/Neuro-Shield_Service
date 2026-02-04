import { GeoIndicator } from './geoIndicators';

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

const valueFromHash = (hash: number, indicator: GeoIndicator) => {
  const [min, max] = indicator.scale;
  const ratio = (hash % 1000) / 1000;
  return min + (max - min) * ratio;
};

const getFeatureCode = (feature: any) =>
  String(
    feature?.properties?.code ??
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
    const hash = hashSeed(`${code}-${indicator.id}-${year}`);
    const prevHash = hashSeed(`${code}-${indicator.id}-${year - 1}`);
    const value = valueFromHash(hash, indicator);
    const prevValue = valueFromHash(prevHash, indicator);
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
  return years.map((year) => {
    const hash = hashSeed(`${code}-${indicator.id}-${year}`);
    return {
      year,
      value: valueFromHash(hash, indicator)
    };
  });
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
