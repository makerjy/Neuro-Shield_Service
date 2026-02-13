import type { InternalRangeKey, KpiKey, RangeKey } from './opsContracts';

export type RegionalPageId = 'overview' | 'cause' | 'interventions' | 'reports' | 'settings';

export const REGIONAL_PATHS: Record<RegionalPageId, string> = {
  overview: '/',
  cause: '/regional/cause',
  interventions: '/regional/interventions',
  reports: '/regional/reports',
  settings: '/regional/settings',
};

function normalizeBasePath(rawPath?: string): string {
  if (!rawPath || !rawPath.trim()) return '/';
  let value = rawPath.trim();
  if (!value.startsWith('/')) value = `/${value}`;
  if (!value.endsWith('/')) value = `${value}/`;
  return value;
}

const BASE_PATH = normalizeBasePath(
  import.meta.env.VITE_BASE_PATH ?? import.meta.env.BASE_PATH ?? import.meta.env.BASE_URL ?? '/',
);

function stripBasePath(pathname: string): string {
  if (BASE_PATH === '/') return pathname;
  if (pathname === BASE_PATH.slice(0, -1)) return '/';
  if (!pathname.startsWith(BASE_PATH)) return pathname;
  const stripped = pathname.slice(BASE_PATH.length);
  return stripped.startsWith('/') ? stripped : `/${stripped}`;
}

function withBasePath(path: string): string {
  if (BASE_PATH === '/') return path;
  const normalized = path.startsWith('/') ? path.slice(1) : path;
  return `${BASE_PATH}${normalized}`;
}

export type RegionalSelectionState = {
  selectedKpiKey: KpiKey;
  selectedRegionSgg: string | null;
  selectedRange: InternalRangeKey;
};

const RANGE_TO_URL: Record<InternalRangeKey, RangeKey> = {
  week: 'weekly',
  month: 'monthly',
  quarter: 'quarterly',
};

const RANGE_FROM_URL: Record<RangeKey, InternalRangeKey> = {
  weekly: 'week',
  monthly: 'month',
  quarterly: 'quarter',
};

export function toUrlRange(range: InternalRangeKey): RangeKey {
  return RANGE_TO_URL[range];
}

export function fromUrlRange(range: string | null | undefined): InternalRangeKey {
  if (!range) return 'week';
  if (range in RANGE_FROM_URL) return RANGE_FROM_URL[range as RangeKey];
  return 'week';
}

export function parseRegionalPage(pathname: string): RegionalPageId {
  const scopedPath = stripBasePath(pathname);
  const match = scopedPath.match(/^\/regional\/([^/?#]+)/);
  const slug = match?.[1] as RegionalPageId | undefined;
  if (!slug) return 'overview';
  if (slug === 'overview' || slug === 'cause' || slug === 'interventions' || slug === 'reports' || slug === 'settings') {
    return slug;
  }
  return 'overview';
}

export function isRegionalPathname(pathname: string): boolean {
  const scoped = stripBasePath(pathname);
  return scoped === '/' || scoped.startsWith('/regional/');
}

export function buildRegionalUrl(page: RegionalPageId, selection: RegionalSelectionState, extras?: Record<string, string | null | undefined>): string {
  const params = new URLSearchParams();
  const targetPath = withBasePath(REGIONAL_PATHS[page]);

  if (selection.selectedKpiKey !== 'regionalSla') {
    params.set('kpi', selection.selectedKpiKey);
  }
  if (selection.selectedRange !== 'week') {
    params.set('range', toUrlRange(selection.selectedRange));
  }
  if (selection.selectedRegionSgg) params.set('sgg', selection.selectedRegionSgg);

  if (extras) {
    Object.entries(extras).forEach(([key, value]) => {
      if (value == null || value === '') return;
      params.set(key, value);
    });
  }

  const hasExtras = Boolean(extras && Object.values(extras).some((value) => value != null && value !== ''));
  const isPlainOverview =
    page === 'overview' &&
    selection.selectedKpiKey === 'regionalSla' &&
    selection.selectedRange === 'week' &&
    !selection.selectedRegionSgg &&
    !hasExtras;

  if (isPlainOverview) return targetPath;
  const query = params.toString();
  return query ? `${targetPath}?${query}` : targetPath;
}

export function parseRegionalSelection(search: string, fallbackKpi: KpiKey): RegionalSelectionState {
  const params = new URLSearchParams(search);
  const kpiParam = (params.get('kpi') as KpiKey | null) ?? fallbackKpi;
  const selectedKpiKey: KpiKey =
    kpiParam === 'regionalSla' ||
    kpiParam === 'regionalQueueRisk' ||
    kpiParam === 'regionalRecontact' ||
    kpiParam === 'regionalDataReadiness' ||
    kpiParam === 'regionalGovernance'
      ? kpiParam
      : fallbackKpi;

  return {
    selectedKpiKey,
    selectedRange: fromUrlRange(params.get('range')),
    selectedRegionSgg: params.get('sgg'),
  };
}
