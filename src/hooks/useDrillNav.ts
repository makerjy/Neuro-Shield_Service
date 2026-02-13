import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

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

type CompactDrillEntry = {
  l: DrillLevel;
  i: string;
  n?: string;
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

function parseCompactStack(raw: string): Array<{ level: DrillLevel; id: string; label: string }> | null {
  try {
    const decoded = JSON.parse(raw) as Array<Record<string, unknown>>;
    if (!Array.isArray(decoded) || decoded.length === 0) return null;

    const mapped = decoded
      .map((item) => {
        const level = normalizeLevel(item.l ?? item.level);
        const id = typeof item.i === 'string' ? item.i : typeof item.id === 'string' ? item.id : null;
        const name = typeof item.n === 'string' ? item.n : typeof item.label === 'string' ? item.label : '';
        if (!level || !id) return null;
        return {
          level,
          id,
          label: name.trim() ? name : id,
        };
      })
      .filter((item): item is { level: DrillLevel; id: string; label: string } => Boolean(item));

    return mapped.length ? mapped : null;
  } catch {
    return null;
  }
}

function serializeCompactStack(stack: DrillContext[]): string {
  const compact: CompactDrillEntry[] = stack.map((item) => ({
    l: item.level,
    i: item.id,
    n: item.label,
  }));
  return JSON.stringify(compact);
}

function toRootContext(root: UseDrillNavOptions['root'], initialFilters: DrillFilters): DrillContext {
  return {
    level: root.level,
    id: root.id,
    label: root.label,
    filters: { ...initialFilters },
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
  const raw = params.get(queryKey);
  const view = parseView(params.get(viewKey), rootContext.filters.view);
  const kpi = params.get(kpiKey) ?? rootContext.filters.kpi;
  const range = parseRange(params.get(rangeKey) ?? rootContext.filters.range, rootContext.filters.range);
  const baseFilters: DrillFilters = {
    kpi,
    range,
    view,
  };

  if (!raw) {
    return [{ ...rootContext, filters: { ...rootContext.filters, ...baseFilters } }];
  }

  const compact = parseCompactStack(raw);
  if (compact?.length) {
    const normalized = compact.map((item, idx) => ({
      level: idx === 0 ? rootContext.level : item.level,
      id: idx === 0 ? rootContext.id : item.id,
      label: idx === 0 ? rootContext.label : item.label,
      filters: { ...baseFilters },
      timestamp: Date.now(),
    }));
    return normalized;
  }

  try {
    const decoded = JSON.parse(raw) as Array<Partial<DrillContext>>;
    if (!Array.isArray(decoded) || decoded.length === 0) {
      return [{ ...rootContext, filters: { ...rootContext.filters, ...baseFilters } }];
    }

    const mapped = decoded
      .map((item) => {
        const level = normalizeLevel(item.level);
        if (!level || typeof item.id !== 'string' || typeof item.label !== 'string') return null;

        const sourceFilters = item.filters ?? {};
        const filters: DrillFilters = {
          kpi:
            typeof sourceFilters.kpi === 'string' && sourceFilters.kpi.trim()
              ? sourceFilters.kpi
              : baseFilters.kpi,
          range: parseRange(
            typeof sourceFilters.range === 'string' ? sourceFilters.range : baseFilters.range,
            baseFilters.range,
          ),
          view: parseView(
            typeof sourceFilters.view === 'string' ? sourceFilters.view : view,
            view,
          ),
          overlay:
            typeof sourceFilters.overlay === 'string' && sourceFilters.overlay.trim()
              ? sourceFilters.overlay
              : undefined,
        };

        return {
          level,
          id: item.id,
          label: item.label,
          filters,
          timestamp: typeof item.timestamp === 'number' ? item.timestamp : Date.now(),
        } as DrillContext;
      })
      .filter((item): item is DrillContext => Boolean(item));

    if (!mapped.length) {
      return [{ ...rootContext, filters: { ...rootContext.filters, ...baseFilters } }];
    }

    const normalized = [...mapped];
    normalized[0] = {
      ...normalized[0],
      level: rootContext.level,
      id: rootContext.id,
      label: rootContext.label,
      filters: { ...normalized[0].filters, ...rootContext.filters, ...baseFilters },
    };

    const last = normalized[normalized.length - 1];
    if (
      last.filters.view !== baseFilters.view ||
      last.filters.kpi !== baseFilters.kpi ||
      last.filters.range !== baseFilters.range
    ) {
      last.filters = { ...last.filters, ...baseFilters };
    }

    return normalized;
  } catch {
    return [{ ...rootContext, filters: { ...rootContext.filters, ...baseFilters } }];
  }
}

function writeStackToUrl(
  stack: DrillContext[],
  mode: HistoryMode,
  queryKey: string,
  kpiKey: string,
  rangeKey: string,
  viewKey: string,
  defaultFilters: DrillFilters,
): void {
  if (typeof window === 'undefined') return;
  if (!stack.length) return;

  const url = new URL(window.location.href);
  const current = stack[stack.length - 1];
  const isDefaultFilterState =
    current.filters.kpi === defaultFilters.kpi &&
    current.filters.range === defaultFilters.range &&
    current.filters.view === defaultFilters.view;
  const isRootOnly = stack.length <= 1;

  if (isRootOnly) {
    url.searchParams.delete(queryKey);
  } else {
    url.searchParams.set(queryKey, serializeCompactStack(stack));
  }

  if (isRootOnly && isDefaultFilterState) {
    url.searchParams.delete(viewKey);
    url.searchParams.delete(kpiKey);
    url.searchParams.delete(rangeKey);
  } else {
    if (current.filters.view === defaultFilters.view) {
      url.searchParams.delete(viewKey);
    } else {
      url.searchParams.set(viewKey, current.filters.view);
    }

    if (current.filters.kpi === defaultFilters.kpi) {
      url.searchParams.delete(kpiKey);
    } else {
      url.searchParams.set(kpiKey, current.filters.kpi);
    }

    if (current.filters.range === defaultFilters.range) {
      url.searchParams.delete(rangeKey);
    } else {
      url.searchParams.set(rangeKey, current.filters.range);
    }
  }

  if (mode === 'replace') {
    window.history.replaceState({}, '', url.toString());
  } else {
    window.history.pushState({}, '', url.toString());
  }
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
  useEffect(() => {
    latestFiltersRef.current = initialFilters;
  }, [initialFilters.kpi, initialFilters.overlay, initialFilters.range, initialFilters.view]);

  const rootIdentity = useMemo(
    () => `${root.level}:${root.id}:${root.label}`,
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

  const commit = useCallback(
    (nextStack: DrillContext[], mode: HistoryMode) => {
      writeStackToUrl(nextStack, mode, queryKey, kpiKey, rangeKey, viewKey, initialFilters);
      return nextStack;
    },
    [initialFilters, kpiKey, queryKey, rangeKey, viewKey],
  );

  useEffect(() => {
    const nextRootContext = toRootContext(root, latestFiltersRef.current);
    const parsed = parseStackFromUrl(nextRootContext, queryKey, kpiKey, rangeKey, viewKey);
    setStack(parsed);
    writeStackToUrl(parsed, 'replace', queryKey, kpiKey, rangeKey, viewKey, latestFiltersRef.current);
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
      const nextRootContext = toRootContext(root, latestFiltersRef.current);
      setStack(parseStackFromUrl(nextRootContext, queryKey, kpiKey, rangeKey, viewKey));
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
        return commit(next, mode);
      });
    },
    [commit, rootContext],
  );

  const push = useCallback(
    (next: Omit<DrillContext, 'timestamp'>, mode: HistoryMode = 'push') => {
      setStack((prev) => {
        const source = prev.length ? prev : [rootContext];
        const currentContext = source[source.length - 1];
        const nextContext: DrillContext = {
          ...next,
          filters: { ...currentContext.filters, ...next.filters },
          timestamp: Date.now(),
        };

        const isSameTarget =
          currentContext.level === nextContext.level &&
          currentContext.id === nextContext.id &&
          currentContext.label === nextContext.label;

        const nextStack = isSameTarget
          ? [...source.slice(0, -1), nextContext]
          : [...source, nextContext];

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
        return commit(next, 'push');
      });
    },
    [commit],
  );

  const reset = useCallback(() => {
    const next = [toRootContext({ level: root.level, id: root.id, label: root.label }, latestFiltersRef.current)];
    setStack(commit(next, 'push'));
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
