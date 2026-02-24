import type {
  InternalRangeKey,
  Intervention,
  InterventionMetricSnapshot,
  InterventionStageKey,
  InterventionStatus,
  InterventionType,
  KpiKey,
  OwnerOrg,
  RegionalQueryState,
} from '../components/regional-center/opsContracts';

const REGIONAL_BASE = '/api/regional';

function withQuery(path: string, params: Record<string, string | number | boolean | null | undefined>): string {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    search.set(key, String(value));
  });
  const query = search.toString();
  return query ? `${path}?${query}` : path;
}

function withDistrictQuery(
  path: string,
  params: Record<string, string | number | boolean | null | undefined>,
  districtTokens: string[],
): string {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    search.set(key, String(value));
  });
  districtTokens.forEach((token) => {
    if (!token) return;
    search.append('district', token);
  });
  const query = search.toString();
  return query ? `${path}?${query}` : path;
}

async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    ...init,
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  return (await response.json()) as T;
}

function toPeriod(range: InternalRangeKey): 'week' | 'month' | 'quarter' {
  if (range === 'month') return 'month';
  if (range === 'quarter') return 'quarter';
  return 'week';
}

function normalizeDistrictTokens(districts: Array<string | { code: string; name: string }>): string[] {
  return districts
    .map((district) => {
      if (typeof district === 'string') return district;
      const code = String(district.code || '').trim();
      const name = String(district.name || '').trim();
      if (!code && !name) return '';
      if (!code) return name;
      if (!name) return code;
      return `${code}::${name}`;
    })
    .filter(Boolean);
}

function normalizeStageKey(value: unknown): InterventionStageKey {
  const raw = String(value ?? '').trim();
  if (raw === 'Stage2' || raw === 'L2') return 'Stage2';
  if (raw === 'Stage3' || raw === '3rd') return 'Stage3';
  return 'Stage1';
}

function normalizeStatus(value: unknown): InterventionStatus {
  const raw = String(value ?? '').trim();
  if (raw === 'IN_PROGRESS') return 'IN_PROGRESS';
  if (raw === 'DONE') return 'DONE';
  if (raw === 'BLOCKED') return 'BLOCKED';
  return 'TODO';
}

function normalizeType(value: unknown): InterventionType {
  const raw = String(value ?? '').trim();
  if (raw === 'STAFFING' || raw === 'RECONTACT_PUSH' || raw === 'DATA_FIX' || raw === 'PATHWAY_TUNE' || raw === 'GOVERNANCE_FIX') {
    return raw;
  }
  return 'RECONTACT_PUSH';
}

function normalizeOwnerOrg(value: unknown): OwnerOrg {
  const raw = String(value ?? '').trim();
  if (raw === 'center' || raw === 'hospital' || raw === 'system' || raw === 'external' || raw === 'regional') {
    return raw;
  }
  return 'regional';
}

function normalizeKpi(value: unknown): KpiKey {
  const raw = String(value ?? '').trim();
  const candidates: KpiKey[] = [
    'regionalSla',
    'regionalQueueRisk',
    'regionalRecontact',
    'regionalDataReadiness',
    'regionalGovernance',
    'regionalAdTransitionHotspot',
    'regionalDxDelayHotspot',
    'regionalScreenToDxRate',
  ];
  if (candidates.includes(raw as KpiKey)) return raw as KpiKey;
  return 'regionalQueueRisk';
}

function defaultMetricSnapshot(): InterventionMetricSnapshot {
  return {
    regionalSla: 0,
    regionalQueueRisk: 0,
    regionalRecontact: 0,
    regionalDataReadiness: 0,
    regionalGovernance: 0,
    regionalAdTransitionHotspot: 0,
    regionalDxDelayHotspot: 0,
    regionalScreenToDxRate: 0,
  };
}

function defaultLayerByKpi(kpiKey: KpiKey): RegionalQueryState['layer'] {
  if (kpiKey === 'regionalAdTransitionHotspot') return 'RISK';
  if (kpiKey === 'regionalScreenToDxRate') return 'GAP';
  if (kpiKey === 'regionalDxDelayHotspot' || kpiKey === 'regionalRecontact') return 'BOTTLENECK';
  return 'LOAD';
}

function normalizeQueryState(
  raw: any,
  regionId: string,
  period: InternalRangeKey,
  kpiKey: KpiKey,
  areaKey: string,
): RegionalQueryState {
  const selectedStage = raw?.selectedStage;
  const stage =
    selectedStage === 'contact' || selectedStage === 'recontact' || selectedStage === 'L2' || selectedStage === '3rd'
      ? selectedStage
      : null;
  return {
    regionKey: String(raw?.regionKey || regionId),
    period: (raw?.period === 'week' || raw?.period === 'month' || raw?.period === 'quarter' ? raw.period : period) as InternalRangeKey,
    kpiKey: normalizeKpi(raw?.kpiKey || kpiKey),
    areaKey: raw?.areaKey == null ? areaKey : String(raw.areaKey),
    layer: raw?.layer === 'RISK' || raw?.layer === 'BOTTLENECK' || raw?.layer === 'GAP' || raw?.layer === 'LOAD'
      ? raw.layer
      : defaultLayerByKpi(kpiKey),
    selectedStage: stage,
    selectedCauseKey: raw?.selectedCauseKey == null ? null : String(raw.selectedCauseKey),
    trendMetric: raw?.trendMetric === 'count' ? 'count' : 'ratio',
  };
}

function normalizeIntervention(raw: any, regionId: string, period: InternalRangeKey): Intervention {
  const kpiKey = normalizeKpi(raw?.kpiKey);
  const areaLabel = String(raw?.areaLabel || raw?.areaKey || '광역 전체');
  const areaKey = String(raw?.areaKey || areaLabel);
  const snapshot = raw?.createdFrom?.snapshot ?? {};
  const beforeMetrics = raw?.beforeMetrics && typeof raw.beforeMetrics === 'object' ? raw.beforeMetrics : defaultMetricSnapshot();
  const afterMetrics = raw?.afterMetrics && typeof raw.afterMetrics === 'object' ? raw.afterMetrics : undefined;
  const beforeValue = Number(snapshot.kpiValue ?? beforeMetrics[kpiKey] ?? 0);
  const beforeBacklog = Number(snapshot.backlogCount ?? beforeMetrics.regionalQueueRisk ?? 0);

  return {
    id: String(raw?.id || `INT-${Date.now()}`),
    title: String(raw?.title || `${areaLabel} ${kpiKey} 대응 개입`),
    stageKey: normalizeStageKey(raw?.stageKey),
    areaKey,
    areaLabel,
    region: String(raw?.region || regionId),
    kpiKey,
    type: normalizeType(raw?.type),
    status: normalizeStatus(raw?.status),
    owner: String(raw?.owner || '광역 운영팀'),
    ownerOrg: normalizeOwnerOrg(raw?.ownerOrg),
    createdAt: String(raw?.createdAt || new Date().toISOString()),
    dueAt: raw?.dueAt ? String(raw.dueAt) : undefined,
    ruleId: raw?.ruleId ? String(raw.ruleId) : undefined,
    context: normalizeQueryState(raw?.context ?? raw?.createdFrom?.queryState, regionId, period, kpiKey, areaKey),
    assignment: raw?.assignment,
    successMetric: raw?.successMetric,
    createdFrom: {
      causeKey: String(raw?.createdFrom?.causeKey || 'staff_shortage'),
      kpiKey: normalizeKpi(raw?.createdFrom?.kpiKey || kpiKey),
      snapshotId: raw?.createdFrom?.snapshotId ? String(raw.createdFrom.snapshotId) : undefined,
      queryState: normalizeQueryState(raw?.createdFrom?.queryState, regionId, period, kpiKey, areaKey),
      snapshot: {
        kpiValue: beforeValue,
        backlogCount: beforeBacklog,
        avgDwell: Number(snapshot.avgDwell ?? snapshot.avgDwellMin ?? 0),
        deltaVsRegional: snapshot.deltaVsRegional == null ? undefined : Number(snapshot.deltaVsRegional),
        unit: snapshot.unit === '%' || snapshot.unit === '건' || snapshot.unit === '일' || snapshot.unit === '점' ? snapshot.unit : undefined,
      },
    },
    expectedEffectTags: Array.isArray(raw?.expectedEffectTags) ? raw.expectedEffectTags.map((value: unknown) => String(value)) : [],
    logs: Array.isArray(raw?.logs) ? raw.logs : [],
    kpiComparison: raw?.kpiComparison && typeof raw.kpiComparison === 'object'
      ? raw.kpiComparison
      : {
          before: { value: beforeValue, backlog: beforeBacklog },
        },
    notes: String(raw?.notes || ''),
    evidenceLinks: Array.isArray(raw?.evidenceLinks) ? raw.evidenceLinks.map((value: unknown) => String(value)) : [],
    beforeMetrics: beforeMetrics as InterventionMetricSnapshot,
    afterMetrics: afterMetrics as InterventionMetricSnapshot | undefined,
    timeline: Array.isArray(raw?.timeline) ? raw.timeline : [],
  };
}

export async function fetchRegionalDashboardDistricts(params: {
  regionId: string;
  period: InternalRangeKey;
  rangePreset: string;
  districts: Array<string | { code: string; name: string }>;
}): Promise<{ items: any[]; regionId: string; period: string; rangePreset: string; fetchedAt: string; source: string }> {
  const districtTokens = normalizeDistrictTokens(params.districts);
  const path = withDistrictQuery(
    `${REGIONAL_BASE}/dashboard/districts`,
    {
      regionId: params.regionId,
      period: toPeriod(params.period),
      rangePreset: params.rangePreset,
    },
    districtTokens,
  );
  return fetchJson(path);
}

export async function fetchRegionalCauseSummary(params: {
  regionId: string;
  kpiKey: KpiKey;
  sigungu: string;
  period: InternalRangeKey;
  selectedStage?: string | null;
  selectedCauseKey?: string | null;
}): Promise<any> {
  return fetchJson(
    withQuery(`${REGIONAL_BASE}/cause/summary`, {
      regionId: params.regionId,
      kpiKey: params.kpiKey,
      sigungu: params.sigungu,
      period: toPeriod(params.period),
      selectedStage: params.selectedStage ?? undefined,
      selectedCauseKey: params.selectedCauseKey ?? undefined,
    }),
  );
}

export async function fetchRegionalCauseTopN(params: {
  regionId: string;
  kpiKey: KpiKey;
  sigungu: string;
  period: InternalRangeKey;
  selectedStage?: string | null;
  selectedArea?: string | null;
}): Promise<any> {
  return fetchJson(
    withQuery(`${REGIONAL_BASE}/cause/causes`, {
      regionId: params.regionId,
      kpiKey: params.kpiKey,
      sigungu: params.sigungu,
      period: toPeriod(params.period),
      selectedStage: params.selectedStage ?? undefined,
      selectedArea: params.selectedArea ?? undefined,
    }),
  );
}

export async function fetchRegionalCauseAreaComparison(params: {
  regionId: string;
  kpiKey: KpiKey;
  sigungu: string;
  period: InternalRangeKey;
  selectedStage?: string | null;
  selectedCauseKey?: string | null;
  districtOptions: string[];
}): Promise<any[]> {
  const path = withDistrictQuery(
    `${REGIONAL_BASE}/cause/area-comparison`,
    {
      regionId: params.regionId,
      kpiKey: params.kpiKey,
      sigungu: params.sigungu,
      period: toPeriod(params.period),
      selectedStage: params.selectedStage ?? undefined,
      selectedCauseKey: params.selectedCauseKey ?? undefined,
    },
    normalizeDistrictTokens(params.districtOptions),
  );
  return fetchJson(path);
}

export async function fetchRegionalCauseTrend(params: {
  regionId: string;
  kpiKey: KpiKey;
  sigungu: string;
  period: InternalRangeKey;
  selectedStage?: string | null;
  selectedCauseKey?: string | null;
  selectedArea?: string | null;
  trendMetric: 'count' | 'ratio';
}): Promise<any> {
  return fetchJson(
    withQuery(`${REGIONAL_BASE}/cause/trend`, {
      regionId: params.regionId,
      kpiKey: params.kpiKey,
      sigungu: params.sigungu,
      period: toPeriod(params.period),
      selectedStage: params.selectedStage ?? undefined,
      selectedCauseKey: params.selectedCauseKey ?? undefined,
      selectedArea: params.selectedArea ?? undefined,
      trendMetric: params.trendMetric,
    }),
  );
}

export async function createRegionalCauseIntervention(payload: {
  from: 'bottleneck';
  queryState: Record<string, unknown>;
  beforeSnapshot: Record<string, unknown>;
}): Promise<{ interventionId: string; snapshotId: string; redirectUrl: string }> {
  return fetchJson(`${REGIONAL_BASE}/cause/interventions`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function fetchRegionalInterventionSnapshot(params: {
  regionId: string;
  period: InternalRangeKey;
}): Promise<{ regionId: string; period: string; items: Intervention[]; count: number }> {
  const path = withQuery(`${REGIONAL_BASE}/interventions/snapshot`, {
    regionId: params.regionId,
    period: toPeriod(params.period),
  });
  const raw = await fetchJson<{ regionId: string; period: string; items: any[]; count: number }>(path);
  const items = Array.isArray(raw.items)
    ? raw.items.map((item) => normalizeIntervention(item, params.regionId, params.period))
    : [];
  return {
    regionId: raw.regionId,
    period: raw.period,
    items,
    count: items.length,
  };
}

export async function putRegionalInterventionSnapshot(params: {
  regionId: string;
  period: InternalRangeKey;
  items: Intervention[];
}): Promise<{ ok: boolean; count: number; scopeKey: string }> {
  return fetchJson(`${REGIONAL_BASE}/interventions/snapshot`, {
    method: 'PUT',
    body: JSON.stringify({
      regionId: params.regionId,
      period: toPeriod(params.period),
      items: params.items,
    }),
  });
}

export async function fetchRegionalReportSummary(params: {
  regionId: string;
  scopeMode: 'regional' | 'sigungu';
  sgg: string;
  kpi: KpiKey | 'all';
  period: InternalRangeKey;
}): Promise<any> {
  return fetchJson(
    withQuery(`${REGIONAL_BASE}/reports/summary`, {
      regionId: params.regionId,
      scopeMode: params.scopeMode,
      sgg: params.sgg,
      kpi: params.kpi,
      period: toPeriod(params.period),
    }),
  );
}
