export type AdminLevel = 'NATION' | 'REGION' | 'SIGUNGU' | 'EUPMYEONDONG';

export interface RegionKey {
  level: AdminLevel;
  code: string;
  name: string;
}

export const makeRegionId = (key: RegionKey): string => `${key.level}:${key.code}`;

export const normalizeRegionCode = (value: unknown): string => String(value ?? '').trim();

export const geoLevelToAdminLevel = (
  level: 'ctprvn' | 'sig' | 'emd',
): AdminLevel => {
  if (level === 'ctprvn') return 'REGION';
  if (level === 'sig') return 'SIGUNGU';
  return 'EUPMYEONDONG';
};

export const parseRegionIdCode = (regionId: string | null | undefined): string | null => {
  if (!regionId) return null;
  const split = regionId.split(':');
  if (split.length >= 2) return split.slice(1).join(':').trim() || null;
  const normalized = normalizeRegionCode(regionId);
  return normalized || null;
};
