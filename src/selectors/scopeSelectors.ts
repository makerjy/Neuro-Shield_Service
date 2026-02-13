export type ScopeLevel = 'REGION' | 'SIGUNGU' | 'EUPMYEONDONG';

export interface ScopeDrillNode {
  level: ScopeLevel;
  id: string;
  name: string;
}

export interface RegionGraphNode {
  id: string;
  name: string;
  level: ScopeLevel;
}

export interface RegionGraph {
  nodesById: Record<string, RegionGraphNode>;
  childrenByParentKey: Record<string, string[]>;
}

function getScopeKey(scope: ScopeDrillNode): string {
  return `${scope.level}:${scope.id}`;
}

export function selectChildRegionIds(scope: ScopeDrillNode, regionGraph: RegionGraph): string[] {
  return regionGraph.childrenByParentKey[getScopeKey(scope)] ?? [];
}

export function selectChildRows<T extends { regionId: string }>(
  scope: ScopeDrillNode,
  regionGraph: RegionGraph,
  rows: T[],
): T[] {
  const childIds = selectChildRegionIds(scope, regionGraph);
  if (!childIds.length) return [];
  const idSet = new Set(childIds);
  return rows.filter((row) => idSet.has(row.regionId));
}
