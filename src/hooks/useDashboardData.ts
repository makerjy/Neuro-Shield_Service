import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';
import type {
  BottleneckMetric,
  CentralKpiId,
  CentralKpiValue,
  CentralTimeWindow,
  DrillLevel,
  FunnelStage,
  LinkageMetric,
  RegionComparisonRow,
} from '../lib/kpi.types';
import type { DashboardData } from '../lib/centralKpiTheme';
import {
  fetchCentralBottlenecks,
  fetchCentralDashboardBundle,
  fetchCentralFunnel,
  fetchCentralKpis,
  fetchCentralLinkage,
  fetchCentralRegions,
} from '../mocks/mockCentralOps';

export type DashboardScope = {
  level: DrillLevel;
  regionCode?: string;
  regionName?: string;
  subRegions?: Array<{ id: string; name: string }>;
};

export type DashboardLoadingStage = 'loadingInitial' | 'loadingScopeChange' | 'refreshing' | 'ready';

type DrilldownData = {
  funnelData: FunnelStage[];
  bottleneckData: BottleneckMetric[];
  linkageData: LinkageMetric[];
  regionData: RegionComparisonRow[];
};

const QUERY_STALE_TIME_MS = 60_000;
const QUERY_GC_TIME_MS = 30 * 60_000;

const DEFAULT_DRILLDOWN_DATA: DrilldownData = {
  funnelData: [],
  bottleneckData: [],
  linkageData: [],
  regionData: [],
};

function toRegionList(scope: DashboardScope): Array<{ code: string; name: string }> | undefined {
  if (scope.level === 'nation') return undefined;
  if (scope.subRegions?.length) {
    return scope.subRegions.map((region) => ({ code: region.id, name: region.name }));
  }
  if (scope.regionCode && scope.regionName) {
    return [{ code: scope.regionCode, name: scope.regionName }];
  }
  return undefined;
}

function buildDashboardQueryKey(scope: DashboardScope, period: CentralTimeWindow, selectedKpi: CentralKpiId) {
  return ['dashboard', scope.level, scope.regionCode ?? 'KR', period, selectedKpi] as const;
}

interface UseDashboardDataOptions {
  loadDrilldown?: boolean;
}

export function useDashboardData(
  scope: DashboardScope,
  period: CentralTimeWindow,
  selectedKpi: CentralKpiId,
  options: UseDashboardDataOptions = {}
) {
  const queryClient = useQueryClient();
  const regionList = useMemo(() => toRegionList(scope), [scope]);
  const shouldLoadDrilldown = options.loadDrilldown ?? false;
  const baseKey = useMemo(() => buildDashboardQueryKey(scope, period, selectedKpi), [scope, period, selectedKpi]);

  const centralKpisQuery = useQuery({
    queryKey: [...baseKey, 'kpis'],
    queryFn: async () => {
      const response = await fetchCentralKpis(period);
      return response.kpis as CentralKpiValue[];
    },
    placeholderData: keepPreviousData,
    staleTime: QUERY_STALE_TIME_MS,
    gcTime: QUERY_GC_TIME_MS,
    refetchOnWindowFocus: false,
  });

  const dashboardBundleQuery = useQuery({
    queryKey: [...baseKey, 'bundle'],
    queryFn: () => fetchCentralDashboardBundle(period, regionList, scope.level, scope.regionCode),
    placeholderData: keepPreviousData,
    staleTime: QUERY_STALE_TIME_MS,
    gcTime: QUERY_GC_TIME_MS,
    refetchOnWindowFocus: false,
  });

  const drilldownQuery = useQuery({
    queryKey: [...baseKey, 'drilldown'],
    queryFn: async (): Promise<DrilldownData> => {
      const [funnel, bottleneck, linkage, regions] = await Promise.all([
        fetchCentralFunnel(period),
        fetchCentralBottlenecks(period),
        fetchCentralLinkage(period),
        fetchCentralRegions(period),
      ]);
      return {
        funnelData: funnel.stages,
        bottleneckData: bottleneck.metrics,
        linkageData: linkage.metrics,
        regionData: regions.rows,
      };
    },
    enabled: shouldLoadDrilldown,
    placeholderData: keepPreviousData,
    staleTime: QUERY_STALE_TIME_MS,
    gcTime: QUERY_GC_TIME_MS,
    refetchOnWindowFocus: false,
  });

  const prefetchScope = useCallback(
    (nextScope: DashboardScope) => {
      const nextRegionList = toRegionList(nextScope);
      const nextBaseKey = buildDashboardQueryKey(nextScope, period, selectedKpi);

      queryClient.prefetchQuery({
        queryKey: [...nextBaseKey, 'bundle'],
        queryFn: () => fetchCentralDashboardBundle(period, nextRegionList, nextScope.level, nextScope.regionCode),
        staleTime: QUERY_STALE_TIME_MS,
        gcTime: QUERY_GC_TIME_MS,
      });
    },
    [period, queryClient, selectedKpi]
  );

  const hasInitialData = Boolean(dashboardBundleQuery.data && centralKpisQuery.data);
  const isScopeChangeLoading = hasInitialData && (dashboardBundleQuery.isFetching || (shouldLoadDrilldown && drilldownQuery.isFetching));
  const isRefreshing = hasInitialData && !isScopeChangeLoading && centralKpisQuery.isFetching;

  const loadingStage: DashboardLoadingStage = !hasInitialData
    ? 'loadingInitial'
    : isScopeChangeLoading
      ? 'loadingScopeChange'
      : isRefreshing
        ? 'refreshing'
        : 'ready';

  return {
    centralKpis: centralKpisQuery.data ?? [],
    dashData: (dashboardBundleQuery.data ?? null) as DashboardData | null,
    drilldownData: drilldownQuery.data ?? DEFAULT_DRILLDOWN_DATA,
    loadingStage,
    isInitialLoading: loadingStage === 'loadingInitial',
    isScopeChangeLoading: loadingStage === 'loadingScopeChange',
    isRefreshing: loadingStage === 'refreshing',
    prefetchScope,
  };
}
