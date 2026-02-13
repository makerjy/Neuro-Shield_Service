import type { DrillLevel } from './kpi.types';

export type DashboardRegionNode = {
  code: string;
  name: string;
};

export type ChildrenType = 'sido' | 'sigungu' | 'eupmyeondong' | 'case';

export type ChildrenScope = {
  childrenType: ChildrenType;
  childrenCodes: string[];
  childrenNameMap: Record<string, string>;
  children: DashboardRegionNode[];
};

type GetChildrenScopeArgs = {
  level: DrillLevel;
  parentRegionCode?: string;
  candidates: DashboardRegionNode[];
};

const CHILDREN_TYPE_BY_LEVEL: Record<DrillLevel, ChildrenType> = {
  nation: 'sido',
  sido: 'sigungu',
  sigungu: 'eupmyeondong',
  center: 'case',
};

function isValidChildCode(level: DrillLevel, parentRegionCode: string | undefined, code: string): boolean {
  if (!code) return false;

  if (level === 'nation') {
    return code.length === 2;
  }

  if (level === 'sido') {
    if (!parentRegionCode) return false;
    return code.startsWith(parentRegionCode) && code.length > parentRegionCode.length;
  }

  if (level === 'sigungu') {
    if (!parentRegionCode) return false;
    return code.startsWith(parentRegionCode) && code.length > parentRegionCode.length;
  }

  return true;
}

export function getChildrenScope({ level, parentRegionCode, candidates }: GetChildrenScopeArgs): ChildrenScope {
  const childrenType = CHILDREN_TYPE_BY_LEVEL[level];
  const seen = new Set<string>();
  const normalized: DashboardRegionNode[] = [];

  for (const item of candidates) {
    const code = String(item.code ?? '').trim();
    if (!code) continue;
    if (seen.has(code)) continue;

    seen.add(code);
    normalized.push({
      code,
      name: String(item.name ?? '').trim(),
    });
  }

  let filtered: DashboardRegionNode[] = [];

  if (level === 'nation') {
    filtered = normalized.filter((item) => isValidChildCode(level, parentRegionCode, item.code));
  } else if (parentRegionCode) {
    const strictMatched = normalized.filter((item) => {
      if (item.code === parentRegionCode) return false;
      return isValidChildCode(level, parentRegionCode, item.code);
    });

    if (strictMatched.length > 0) {
      filtered = strictMatched;
    } else {
      // 코드 체계(예: 31 vs 41)가 달라도 현재 화면의 children 리스트를 우선 사용한다.
      filtered = normalized.filter((item) => item.code !== parentRegionCode);
      if (filtered.length > 0) {
        console.warn('[ChildrenScope] parent-child code prefix mismatch, fallback to candidate children', {
          level,
          parentRegionCode,
          sampleChildCode: filtered[0]?.code,
        });
      }
    }
  } else {
    filtered = normalized;
  }

  const childrenNameMap = filtered.reduce<Record<string, string>>((acc, item) => {
    if (item.name) {
      acc[item.code] = item.name;
    }
    return acc;
  }, {});

  return {
    childrenType,
    childrenCodes: filtered.map((item) => item.code),
    childrenNameMap,
    children: filtered,
  };
}
