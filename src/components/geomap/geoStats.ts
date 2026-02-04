import { GeoIndicator } from './geoIndicators';

export type RegionStat = {
  code: string;
  value: number;
};

const hashSeed = (input: string) => {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash * 31 + input.charCodeAt(i)) >>> 0;
  }
  return hash;
};

export function generateRegionStats(codes: string[], indicator: GeoIndicator, seed: string): RegionStat[] {
  const [min, max] = indicator.scale;
  return codes.map((code) => {
    const hash = hashSeed(`${code}-${seed}`);
    const ratio = (hash % 1000) / 1000;
    const value = min + (max - min) * ratio;
    return { code, value };
  });
}
