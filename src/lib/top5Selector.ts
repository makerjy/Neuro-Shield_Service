export type MetricByCode = Record<string, number | null | undefined>;

export type Top5Row = {
  code: string;
  name: string;
  value: number;
  rank: number;
};

type SelectTop5Params = {
  metricByCode: MetricByCode;
  childrenCodes: string[];
  nameMap: Record<string, string>;
  sortOrder?: 'desc' | 'asc';
  limit?: number;
  excludeCodes?: string[];
  onMissingName?: (code: string) => void;
};

type AssertTop5Params = {
  top5: Top5Row[];
  childrenCodes: string[];
  parentRegionCode?: string;
};

export function selectTop5({
  metricByCode,
  childrenCodes,
  nameMap,
  sortOrder = 'desc',
  limit = 5,
  excludeCodes = [],
  onMissingName,
}: SelectTop5Params): Top5Row[] {
  const excluded = new Set(excludeCodes);

  const rows = childrenCodes
    .filter((code) => !excluded.has(code))
    .map((code) => {
      const value = metricByCode[code];
      const resolvedName = nameMap[code];
      if (!resolvedName) {
        onMissingName?.(code);
      }
      return {
        code,
        name: resolvedName || `미매핑: ${code}`,
        value,
      };
    })
    .filter((row): row is { code: string; name: string; value: number } => {
      return row.value != null && Number.isFinite(row.value);
    })
    .sort((a, b) => {
      const valueDiff = sortOrder === 'desc' ? b.value - a.value : a.value - b.value;
      if (valueDiff !== 0) return valueDiff;

      const nameDiff = a.name.localeCompare(b.name, 'ko-KR');
      if (nameDiff !== 0) return nameDiff;

      return a.code.localeCompare(b.code);
    })
    .slice(0, limit);

  return rows.map((row, index) => ({
    ...row,
    rank: index + 1,
  }));
}

export function assertTop5WithinChildren({
  top5,
  childrenCodes,
  parentRegionCode,
}: AssertTop5Params): boolean {
  const childCodeSet = new Set(childrenCodes);
  const hasOutsideCode = top5.some((item) => !childCodeSet.has(item.code));
  const hasParentCode = parentRegionCode != null && top5.some((item) => item.code === parentRegionCode);
  const isValid = !hasOutsideCode && !hasParentCode;

  console.assert(
    isValid,
    '[Top5] invalid candidate detected',
    {
      top5Codes: top5.map((item) => item.code),
      parentRegionCode,
      childrenCodes,
    }
  );

  return isValid;
}
