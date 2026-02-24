import type {
  BottleneckResponse,
  CentralDashboardKpisResponse,
  CentralTimeWindow,
  FunnelResponse,
  LinkageResponse,
  RegionComparisonResponse,
} from './kpi.types';
import type { DashboardData } from './centralKpiTheme';
import {
  MOCK_DRIVER_ANALYSIS,
  MOCK_POLICY_CHANGES,
  MOCK_QUALITY_ALERTS,
  MOCK_UNIFIED_AUDIT,
  fetchCentralBottlenecks as mockFetchCentralBottlenecks,
  fetchCentralCases as mockFetchCentralCases,
  fetchCentralDashboardBundle as mockFetchCentralDashboardBundle,
  fetchCentralFunnel as mockFetchCentralFunnel,
  fetchCentralKpis as mockFetchCentralKpis,
  fetchCentralLinkage as mockFetchCentralLinkage,
  fetchCentralRegions as mockFetchCentralRegions,
  type DriverAnalysis,
  type PolicyChangeEvent,
  type QualityAlert,
  type UnifiedAuditEvent,
} from '../mocks/mockCentralOps';

const USE_REAL_CENTRAL_API = String(import.meta.env.VITE_USE_REAL_CENTRAL_API ?? 'true').toLowerCase() !== 'false';
const CENTRAL_BASE = '/api/central';

function withQuery(path: string, params: Record<string, string | undefined | null | number | boolean>) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    search.set(key, String(value));
  });
  const query = search.toString();
  return query ? `${path}?${query}` : path;
}

async function fetchJson<T>(path: string): Promise<T> {
  const response = await fetch(path, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  return (await response.json()) as T;
}

export async function fetchCentralKpis(
  window: CentralTimeWindow = 'LAST_7D',
  periodVariant = 'default'
): Promise<CentralDashboardKpisResponse> {
  if (!USE_REAL_CENTRAL_API) return mockFetchCentralKpis(window, periodVariant);
  try {
    return await fetchJson<CentralDashboardKpisResponse>(
      withQuery(`${CENTRAL_BASE}/dashboard/kpis`, { window, periodVariant })
    );
  } catch {
    return mockFetchCentralKpis(window, periodVariant);
  }
}

export async function fetchCentralFunnel(
  window: CentralTimeWindow = 'LAST_7D',
  periodVariant = 'default'
): Promise<FunnelResponse> {
  if (!USE_REAL_CENTRAL_API) return mockFetchCentralFunnel(window, periodVariant);
  try {
    return await fetchJson<FunnelResponse>(
      withQuery(`${CENTRAL_BASE}/metrics/funnel`, { window, periodVariant })
    );
  } catch {
    return mockFetchCentralFunnel(window, periodVariant);
  }
}

export async function fetchCentralBottlenecks(
  window: CentralTimeWindow = 'LAST_7D',
  periodVariant = 'default'
): Promise<BottleneckResponse> {
  if (!USE_REAL_CENTRAL_API) return mockFetchCentralBottlenecks(window, periodVariant);
  try {
    return await fetchJson<BottleneckResponse>(
      withQuery(`${CENTRAL_BASE}/metrics/bottlenecks`, { window, periodVariant })
    );
  } catch {
    return mockFetchCentralBottlenecks(window, periodVariant);
  }
}

export async function fetchCentralLinkage(
  window: CentralTimeWindow = 'LAST_7D',
  periodVariant = 'default'
): Promise<LinkageResponse> {
  if (!USE_REAL_CENTRAL_API) return mockFetchCentralLinkage(window, periodVariant);
  try {
    return await fetchJson<LinkageResponse>(
      withQuery(`${CENTRAL_BASE}/metrics/linkage`, { window, periodVariant })
    );
  } catch {
    return mockFetchCentralLinkage(window, periodVariant);
  }
}

export async function fetchCentralRegions(
  window: CentralTimeWindow = 'LAST_7D',
  periodVariant = 'default'
): Promise<RegionComparisonResponse> {
  if (!USE_REAL_CENTRAL_API) return mockFetchCentralRegions(window, periodVariant);
  try {
    return await fetchJson<RegionComparisonResponse>(
      withQuery(`${CENTRAL_BASE}/metrics/regions`, { window, periodVariant })
    );
  } catch {
    return mockFetchCentralRegions(window, periodVariant);
  }
}

export async function fetchCentralCases(
  filters: Record<string, string> = {},
  page = 1
): Promise<{ total: number; page: number; pageSize: number; items: any[] }> {
  if (!USE_REAL_CENTRAL_API) return mockFetchCentralCases(filters, page);
  try {
    return await fetchJson<{ total: number; page: number; pageSize: number; items: any[] }>(
      withQuery(`${CENTRAL_BASE}/cases`, {
        page,
        ...filters,
      })
    );
  } catch {
    return mockFetchCentralCases(filters, page);
  }
}

export async function fetchCentralDashboardBundle(
  window: CentralTimeWindow = 'LAST_7D',
  regionList?: { code: string; name: string }[],
  drillLevel?: string,
  regionCode?: string,
  periodVariant = 'default'
): Promise<DashboardData> {
  if (!USE_REAL_CENTRAL_API) {
    return mockFetchCentralDashboardBundle(window, regionList, drillLevel, regionCode, periodVariant);
  }

  try {
    const childCodes = regionList?.map((r) => r.code).join(',');
    return await fetchJson<DashboardData>(
      withQuery(`${CENTRAL_BASE}/dashboard/bundle`, {
        window,
        periodVariant,
        scope_level: drillLevel ?? 'nation',
        scope_id: regionCode ?? 'KR',
        child_codes: childCodes,
      })
    );
  } catch {
    return mockFetchCentralDashboardBundle(window, regionList, drillLevel, regionCode, periodVariant);
  }
}

export async function fetchPolicyChanges(
  params: { status?: string; stage?: string; range?: string } = {}
): Promise<PolicyChangeEvent[]> {
  if (!USE_REAL_CENTRAL_API) return MOCK_POLICY_CHANGES;
  try {
    return await fetchJson<PolicyChangeEvent[]>(withQuery(`${CENTRAL_BASE}/policy/changes`, params));
  } catch {
    return MOCK_POLICY_CHANGES;
  }
}

export async function fetchDriverAnalysis(params: { range?: string } = {}): Promise<DriverAnalysis[]> {
  if (!USE_REAL_CENTRAL_API) return MOCK_DRIVER_ANALYSIS;
  try {
    return await fetchJson<DriverAnalysis[]>(withQuery(`${CENTRAL_BASE}/quality/drivers`, params));
  } catch {
    return MOCK_DRIVER_ANALYSIS;
  }
}

export async function fetchQualityAlerts(
  params: { severity?: string; resolved?: boolean } = {}
): Promise<QualityAlert[]> {
  if (!USE_REAL_CENTRAL_API) return MOCK_QUALITY_ALERTS;
  try {
    return await fetchJson<QualityAlert[]>(withQuery(`${CENTRAL_BASE}/quality/alerts`, params));
  } catch {
    return MOCK_QUALITY_ALERTS;
  }
}

export async function fetchUnifiedAudit(
  params: { type?: string; severity?: string; status?: string; range?: string } = {}
): Promise<UnifiedAuditEvent[]> {
  if (!USE_REAL_CENTRAL_API) return MOCK_UNIFIED_AUDIT;
  try {
    return await fetchJson<UnifiedAuditEvent[]>(withQuery(`${CENTRAL_BASE}/audit/unified`, params));
  } catch {
    return MOCK_UNIFIED_AUDIT;
  }
}

export { USE_REAL_CENTRAL_API };
