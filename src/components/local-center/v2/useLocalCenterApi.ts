import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { type GlobalFilters, useCaseStoreVersion, useGlobalFilters } from "./caseSSOT";
import {
  fetchLocalCenterCase,
  fetchLocalCenterCaseDashboard,
  fetchLocalCenterCaseEvents,
  fetchLocalCenterDashboardStats,
} from "./localCenterDemoApi";

const QUERY_STALE_TIME_MS = 15_000;
const QUERY_GC_TIME_MS = 30 * 60_000;

function mergeFilters(base: GlobalFilters, override?: Partial<GlobalFilters>) {
  return {
    ...base,
    ...(override ?? {}),
  };
}

export function useLocalCenterDashboardStatsQuery(override?: Partial<GlobalFilters>) {
  const globalFilters = useGlobalFilters();
  const version = useCaseStoreVersion();
  const filters = useMemo(() => mergeFilters(globalFilters, override), [globalFilters, override]);

  return useQuery({
    queryKey: ["local-center", "dashboard-stats", filters, version],
    queryFn: () => fetchLocalCenterDashboardStats(filters),
    placeholderData: keepPreviousData,
    staleTime: QUERY_STALE_TIME_MS,
    gcTime: QUERY_GC_TIME_MS,
    refetchOnWindowFocus: false,
  });
}

export function useLocalCenterCaseDashboardQuery(override?: Partial<GlobalFilters>) {
  const globalFilters = useGlobalFilters();
  const version = useCaseStoreVersion();
  const filters = useMemo(() => mergeFilters(globalFilters, override), [globalFilters, override]);

  return useQuery({
    queryKey: ["local-center", "cases", filters, version],
    queryFn: () => fetchLocalCenterCaseDashboard(filters),
    placeholderData: keepPreviousData,
    staleTime: QUERY_STALE_TIME_MS,
    gcTime: QUERY_GC_TIME_MS,
    refetchOnWindowFocus: false,
  });
}

export function useLocalCenterCaseQuery(caseId?: string | null) {
  const version = useCaseStoreVersion();
  return useQuery({
    queryKey: ["local-center", "case", caseId, version],
    queryFn: () => fetchLocalCenterCase(caseId ?? ""),
    enabled: Boolean(caseId),
    placeholderData: keepPreviousData,
    staleTime: QUERY_STALE_TIME_MS,
    gcTime: QUERY_GC_TIME_MS,
    refetchOnWindowFocus: false,
  });
}

export function useLocalCenterCaseEventsQuery(caseId?: string | null) {
  const version = useCaseStoreVersion();
  return useQuery({
    queryKey: ["local-center", "case-events", caseId, version],
    queryFn: () => fetchLocalCenterCaseEvents(caseId ?? ""),
    enabled: Boolean(caseId),
    placeholderData: keepPreviousData,
    staleTime: QUERY_STALE_TIME_MS,
    gcTime: QUERY_GC_TIME_MS,
    refetchOnWindowFocus: false,
  });
}
