import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { MutableRefObject } from 'react';

export type DrillLevel = 'REGION' | 'SIGUNGU' | 'EUPMYEONDONG' | 'CUSTOM';
export type DrillViewMode = 'geomap' | 'heatmap';
export type DrillRangePreset = '24h' | '7d' | '30d' | '90d';

export interface DrillFilters {
  kpi: string;
  range: DrillRangePreset;
  view: DrillViewMode;
  overlay?: string;
}

export interface DrillContext {
  level: DrillLevel;
  id: string;
  label: string;
  filters: DrillFilters;
  timestamp: number;
}

interface UseDrillNavOptions {
  root: Pick<DrillContext, 'level' | 'id' | 'label'>;
  initialFilters: DrillFilters;
  queryKey?: string;
  kpiKey?: string;
  rangeKey?: string;
  viewKey?: string;
}

type HistoryMode = 'push' | 'replace';

const DEFAULT_QUERY_KEY = 'drill';
const DEFAULT_KPI_KEY = 'kpi';
const DEFAULT_RANGE_KEY = 'range';
const DEFAULT_VIEW_KEY = 'view';

type DrillItem = {
  l: DrillLevel;
  i: string;
  n: string;
};

const DRILL_LEVEL_ORDER: Record<DrillLevel, number> = {
  REGION: 0,
  SIGUNGU: 1,
  EUPMYEONDONG: 2,
  CUSTOM: 3,
};

function normalizeLevel(value: unknown): DrillLevel | null {
  if (
    value === 'REGION' ||
    value === 'SIGUNGU' ||
    value === 'EUPMYEONDONG' ||
    value === 'CUSTOM'
  ) {
    return value;
  }
  return null;
}

function toDrillItem(value: unknown): DrillItem | null {
  if (!value || typeof value !== 'object') return null;
  const source = value as Record<string, unknown>;
  const level = normalizeLevel(source.l ?? source.level);
  const rawId = source.i ?? source.id;
  if (!level || (typeof rawId !== 'string' && typeof rawId !== 'number')) return null;

  const id = String(rawId);
  const rawName = source.n ?? source.label ?? id;
  const name = typeof rawName === 'string' && rawName.trim() ? rawName : id;

  return { l: level, i: id, n: name };
}

function canonicalizeDrill(input: DrillItem[]): DrillItem[] {
  const normalized = input
    .filter(Boolean)
    .map((item) => ({ l: item.l, i: String(item.i), n: item.n }));

  const out: DrillItem[] = [];
  normalized.forEach((item) => {
    const nextOrder = DRILL_LEVEL_ORDER[item.l];
    while (out.length > 0) {
      const last = out[out.length - 1];
      if (DRILL_LEVEL_ORDER[last.l] < nextOrder) break;
      out.pop();
    }
    out.push(item);
  });

  return out;
}

function drillToQuery(drill: DrillItem[]): string {
  const canon = canonicalizeDrill(drill);
  return JSON.stringify(
    canon.map((item) => ({
      l: item.l,
      i: String(item.i),
      n: item.n,
    })),
  );
}

function parseRawDrillArray(raw: string): DrillItem[] {
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return canonicalizeDrill(
      parsed
        .map((item) => toDrillItem(item))
        .filter((item): item is DrillItem => Boolean(item)),
    );
  } catch {
    return [];
  }
}

function queryToDrill(raw: string | null): DrillItem[] {
  if (!raw) return [];

  const direct = parseRawDrillArray(raw);
  if (direct.length > 0) return direct;

  try {
    const decoded = decodeURIComponent(raw);
    if (decoded !== raw) {
      return parseRawDrillArray(decoded);
    }
  } catch {
    return [];
  }

  return [];
}

function stackToDrill(stack: DrillContext[]): DrillItem[] {
  return stack.map((item) => ({
    l: item.level,
    i: String(item.id),
    n: item.label,
  }));
}

function normalizeStackPath(stack: DrillContext[]): DrillContext[] {
  const out: DrillContext[] = [];
  stack.forEach((item) => {
    const nextOrder = DRILL_LEVEL_ORDER[item.level];
    while (out.length > 0) {
      const last = out[out.length - 1];
      if (DRILL_LEVEL_ORDER[last.level] < nextOrder) break;
      out.pop();
    }
    out.push({ ...item, id: String(item.id) });
  });
  return out;
}

function toRootContext(root: UseDrillNavOptions['root'], filters: DrillFilters): DrillContext {
  return {
    level: root.level,
    id: String(root.id),
    label: root.label,
    filters: { ...filters },
    timestamp: Date.now(),
  };
}

function parseView(value: string | null, fallback: DrillViewMode): DrillViewMode {
  if (value === 'geomap' || value === 'heatmap') return value;
  return fallback;
}

function parseRange(value: string, fallback: DrillRangePreset): DrillRangePreset {
  if (value === '24h' || value === '7d' || value === '30d' || value === '90d') return value;
  if (value === 'weekly') return '7d';
  if (value === 'monthly') return '30d';
  if (value === 'quarterly') return '90d';
  return fallback;
}

function parseStackFromUrl(
  rootContext: DrillContext,
  queryKey: string,
  kpiKey: string,
  rangeKey: string,
  viewKey: string,
): DrillContext[] {
  if (typeof window === 'undefined') return [rootContext];

  const params = new URLSearchParams(window.location.search);
  const parsedDrill = queryToDrill(params.get(queryKey));
  const baseFilters: DrillFilters = {
    kpi: params.get(kpiKey) ?? rootContext.filters.kpi,
    range: parseRange(params.get(rangeKey) ?? rootContext.filters.range, rootContext.filters.range),
    view: parseView(params.get(viewKey), rootContext.filters.view),
  };

  if (!parsedDrill.length) {
    return [{ ...rootContext, filters: { ...baseFilters } }];
  }

  const rootItem: DrillItem = { l: rootContext.level, i: String(rootContext.id), n: rootContext.label };
  const merged = canonicalizeDrill([
    rootItem,
    ...parsedDrill.filter((item) => !(item.l === rootItem.l && item.i === rootItem.i)),
  ]);

  return merged.map((item, index) => ({
    level: item.l,
    id: item.i,
    label: index === 0 ? rootContext.label : item.n,
    filters: { ...baseFilters },
    timestamp: Date.now() + index,
  }));
}

function areFiltersEqual(a: DrillFilters, b: DrillFilters): boolean {
  return (
    a.kpi === b.kpi &&
    a.range === b.range &&
    a.view === b.view &&
    (a.overlay ?? '') === (b.overlay ?? '')
  );
}

function areStacksEquivalent(a: DrillContext[], b: DrillContext[]): boolean {
  if (a.length !== b.length) return false;

  for (let idx = 0; idx < a.length; idx += 1) {
    if (a[idx].level !== b[idx].level) return false;
    if (String(a[idx].id) !== String(b[idx].id)) return false;
    if (a[idx].label !== b[idx].label) return false;
    if (!areFiltersEqual(a[idx].filters, b[idx].filters)) return false;
  }

  return true;
}

function buildDrillSignature(drillQuery: string, filters: Pick<DrillFilters, 'kpi' | 'range' | 'view'>): string {
  return `${drillQuery}|${filters.kpi}|${filters.range}|${filters.view}`;
}

function writeStackToUrl(params: {
  stack: DrillContext[];
  mode: HistoryMode;
  queryKey: string;
  kpiKey: string;
  rangeKey: string;
  viewKey: string;
  defaultFilters: DrillFilters;
  lastAppliedQueryRef: MutableRefObject<string>;
}): boolean {
  const { stack, mode, queryKey, kpiKey, rangeKey, viewKey, defaultFilters, lastAppliedQueryRef } = params;
  if (typeof window === 'undefined') return false;
  if (!stack.length) return false;

  const currentUrl = new URL(window.location.href);
  const nextUrl = new URL(window.location.href);
  const current = stack[stack.length - 1];

  const canonicalDrill = drillToQuery(stackToDrill(stack));
  const drillDepth = canonicalizeDrill(stackToDrill(stack)).length;
  const isRootOnly = drillDepth <= 1;
  const isDefaultFilterState =
    current.filters.kpi === defaultFilters.kpi &&
    current.filters.range === defaultFilters.range &&
    current.filters.view === defaultFilters.view;

  if (isRootOnly) {
    nextUrl.searchParams.delete(queryKey);
  } else {
    nextUrl.searchParams.set(queryKey, canonicalDrill);
  }

  if (isRootOnly && isDefaultFilterState) {
    nextUrl.searchParams.delete(viewKey);
    nextUrl.searchParams.delete(kpiKey);
    nextUrl.searchParams.delete(rangeKey);
  } else {
    if (current.filters.view === defaultFilters.view) {
      nextUrl.searchParams.delete(viewKey);
    } else {
      nextUrl.searchParams.set(viewKey, current.filters.view);
    }

    if (current.filters.kpi === defaultFilters.kpi) {
      nextUrl.searchParams.delete(kpiKey);
    } else {
      nextUrl.searchParams.set(kpiKey, current.filters.kpi);
    }

    if (current.filters.range === defaultFilters.range) {
      nextUrl.searchParams.delete(rangeKey);
    } else {
      nextUrl.searchParams.set(rangeKey, current.filters.range);
    }
  }

  if (nextUrl.search === currentUrl.search) return false;

  if (mode === 'replace') {
    window.history.replaceState({}, '', nextUrl.toString());
  } else {
    window.history.pushState({}, '', nextUrl.toString());
  }

  const normalizedDrill = isRootOnly ? '' : canonicalDrill;
  lastAppliedQueryRef.current = buildDrillSignature(normalizedDrill, current.filters);
  return true;
}

export function useDrillNav({
  root,
  initialFilters,
  queryKey = DEFAULT_QUERY_KEY,
  kpiKey = DEFAULT_KPI_KEY,
  rangeKey = DEFAULT_RANGE_KEY,
  viewKey = DEFAULT_VIEW_KEY,
}: UseDrillNavOptions) {
  const latestFiltersRef = useRef<DrillFilters>(initialFilters);
  const lastAppliedQueryRef = useRef<string>('');

  useEffect(() => {
    latestFiltersRef.current = initialFilters;
  }, [initialFilters.kpi, initialFilters.overlay, initialFilters.range, initialFilters.view]);

  const rootIdentity = useMemo(
    () => `${root.level}:${String(root.id)}:${root.label}`,
    [root.id, root.label, root.level],
  );

  const rootContext = useMemo(
    () => toRootContext(root, initialFilters),
    [
      initialFilters.kpi,
      initialFilters.overlay,
      initialFilters.range,
      initialFilters.view,
      root.id,
      root.label,
      root.level,
      rootIdentity,
    ],
  );

  const [stack, setStack] = useState<DrillContext[]>(() =>
    parseStackFromUrl(rootContext, queryKey, kpiKey, rangeKey, viewKey),
  );

  const current = stack[stack.length - 1] ?? rootContext;
  const canGoBack = stack.length > 1;
  const canBack = canGoBack;

  useEffect(() => {
    lastAppliedQueryRef.current = buildDrillSignature(drillToQuery(stackToDrill(stack)), current.filters);
  }, [current.filters.kpi, current.filters.range, current.filters.view, stack]);

  const commit = useCallback(
    (nextStack: DrillContext[], mode: HistoryMode) => {
      const normalized = nextStack.length
        ? normalizeStackPath(nextStack)
        : [toRootContext({ level: root.level, id: String(root.id), label: root.label }, latestFiltersRef.current)];

      writeStackToUrl({
        stack: normalized,
        mode,
        queryKey,
        kpiKey,
        rangeKey,
        viewKey,
        defaultFilters: latestFiltersRef.current,
        lastAppliedQueryRef,
      });
      return normalized;
    },
    [kpiKey, queryKey, rangeKey, root.id, root.label, root.level, viewKey],
  );

  useEffect(() => {
    const nextRootContext = toRootContext(root, latestFiltersRef.current);
    const parsed = parseStackFromUrl(nextRootContext, queryKey, kpiKey, rangeKey, viewKey);
    setStack((prev) => (areStacksEquivalent(prev, parsed) ? prev : parsed));
    writeStackToUrl({
      stack: parsed,
      mode: 'replace',
      queryKey,
      kpiKey,
      rangeKey,
      viewKey,
      defaultFilters: latestFiltersRef.current,
      lastAppliedQueryRef,
    });
    // root identity changed: keep current drill if URL has it, otherwise rebuild root context.
  }, [
    kpiKey,
    queryKey,
    rangeKey,
    root.id,
    root.label,
    root.level,
    rootIdentity,
    viewKey,
  ]);

  useEffect(() => {
    const onPopState = () => {
      const params = new URLSearchParams(window.location.search);
      const canonFromUrl = drillToQuery(queryToDrill(params.get(queryKey)));
      const signatureFromUrl = buildDrillSignature(canonFromUrl, {
        kpi: params.get(kpiKey) ?? latestFiltersRef.current.kpi,
        range: parseRange(
          params.get(rangeKey) ?? latestFiltersRef.current.range,
          latestFiltersRef.current.range,
        ),
        view: parseView(params.get(viewKey), latestFiltersRef.current.view),
      });
      if (signatureFromUrl === lastAppliedQueryRef.current) return;

      const nextRootContext = toRootContext(root, latestFiltersRef.current);
      const parsed = parseStackFromUrl(nextRootContext, queryKey, kpiKey, rangeKey, viewKey);
      setStack((prev) => (areStacksEquivalent(prev, parsed) ? prev : parsed));
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [kpiKey, queryKey, rangeKey, root.id, root.label, root.level, rootIdentity, viewKey]);

  const syncFilters = useCallback(
    (filters: Partial<DrillFilters>, mode: HistoryMode = 'replace') => {
      setStack((prev) => {
        const source = prev.length ? prev : [rootContext];
        const next = source.map((item) => ({
          ...item,
          filters: { ...item.filters, ...filters },
        }));
        if (areStacksEquivalent(source, next)) return source;
        return commit(next, mode);
      });
    },
    [commit, rootContext],
  );

  const push = useCallback(
    (next: Omit<DrillContext, 'timestamp'>, mode: HistoryMode = 'push') => {
      setStack((prev) => {
        const source = normalizeStackPath(prev.length ? prev : [rootContext]);
        const currentContext = source[source.length - 1];
        const nextContext: DrillContext = {
          ...next,
          id: String(next.id),
          filters: { ...currentContext.filters, ...next.filters },
          timestamp: Date.now(),
        };
        const nextOrder = DRILL_LEVEL_ORDER[nextContext.level];
        const nextStack = [
          ...source.filter((item) => DRILL_LEVEL_ORDER[item.level] < nextOrder),
          nextContext,
        ];

        if (areStacksEquivalent(source, nextStack)) return source;
        return commit(nextStack, mode);
      });
    },
    [commit, rootContext],
  );

  const back = useCallback(() => {
    setStack((prev) => {
      if (prev.length <= 1) return prev;
      const next = prev.slice(0, -1);
      return commit(next, 'push');
    });
  }, [commit]);

  const jumpTo = useCallback(
    (index: number) => {
      setStack((prev) => {
        if (index < 0 || index >= prev.length) return prev;
        const next = prev.slice(0, index + 1);
        if (areStacksEquivalent(prev, next)) return prev;
        return commit(next, 'push');
      });
    },
    [commit],
  );

  const reset = useCallback(() => {
    const next = [
      toRootContext({ level: root.level, id: String(root.id), label: root.label }, latestFiltersRef.current),
    ];
    setStack((prev) => {
      if (areStacksEquivalent(prev, next)) return prev;
      return commit(next, 'push');
    });
  }, [commit, root.id, root.label, root.level]);

  return {
    stack,
    current,
    canBack,
    canGoBack,
    push,
    back,
    jumpTo,
    reset,
    syncFilters,
  };
}
