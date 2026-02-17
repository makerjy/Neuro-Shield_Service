export type CentralDefaultPeriod = 'weekly' | 'monthly' | 'quarterly' | 'yearly_cum';

export interface CentralSettingsData {
  matrixThresholds: {
    slaCut: number;
    dataCut: number;
  };
  headline: {
    maxItems: number;
    includePartialBadge: boolean;
  };
  drilldown: {
    keepPreviousData: boolean;
    prefetchEnabled: boolean;
    useScopeOverlay: boolean;
  };
  notifications: {
    batchDelayed: boolean;
    qualityRisk: boolean;
    governanceGap: boolean;
    policyImpactSpike: boolean;
  };
  reports: {
    defaultPeriod: CentralDefaultPeriod;
    includeFilterContext: boolean;
  };
}

const STORAGE_KEY = 'central.settings.v1';

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export const DEFAULT_CENTRAL_SETTINGS: CentralSettingsData = {
  matrixThresholds: {
    slaCut: 86,
    dataCut: 86,
  },
  headline: {
    maxItems: 3,
    includePartialBadge: true,
  },
  drilldown: {
    keepPreviousData: true,
    prefetchEnabled: true,
    useScopeOverlay: true,
  },
  notifications: {
    batchDelayed: true,
    qualityRisk: true,
    governanceGap: true,
    policyImpactSpike: false,
  },
  reports: {
    defaultPeriod: 'weekly',
    includeFilterContext: true,
  },
};

function isPeriod(value: unknown): value is CentralDefaultPeriod {
  return value === 'weekly' || value === 'monthly' || value === 'quarterly' || value === 'yearly_cum';
}

function normalizeSettings(raw: Partial<CentralSettingsData> | null | undefined): CentralSettingsData {
  return {
    matrixThresholds: {
      slaCut: clamp(Number(raw?.matrixThresholds?.slaCut ?? DEFAULT_CENTRAL_SETTINGS.matrixThresholds.slaCut), 70, 99),
      dataCut: clamp(Number(raw?.matrixThresholds?.dataCut ?? DEFAULT_CENTRAL_SETTINGS.matrixThresholds.dataCut), 70, 99),
    },
    headline: {
      maxItems: clamp(Number(raw?.headline?.maxItems ?? DEFAULT_CENTRAL_SETTINGS.headline.maxItems), 1, 5),
      includePartialBadge: Boolean(raw?.headline?.includePartialBadge ?? DEFAULT_CENTRAL_SETTINGS.headline.includePartialBadge),
    },
    drilldown: {
      keepPreviousData: Boolean(raw?.drilldown?.keepPreviousData ?? DEFAULT_CENTRAL_SETTINGS.drilldown.keepPreviousData),
      prefetchEnabled: Boolean(raw?.drilldown?.prefetchEnabled ?? DEFAULT_CENTRAL_SETTINGS.drilldown.prefetchEnabled),
      useScopeOverlay: Boolean(raw?.drilldown?.useScopeOverlay ?? DEFAULT_CENTRAL_SETTINGS.drilldown.useScopeOverlay),
    },
    notifications: {
      batchDelayed: Boolean(raw?.notifications?.batchDelayed ?? DEFAULT_CENTRAL_SETTINGS.notifications.batchDelayed),
      qualityRisk: Boolean(raw?.notifications?.qualityRisk ?? DEFAULT_CENTRAL_SETTINGS.notifications.qualityRisk),
      governanceGap: Boolean(raw?.notifications?.governanceGap ?? DEFAULT_CENTRAL_SETTINGS.notifications.governanceGap),
      policyImpactSpike: Boolean(raw?.notifications?.policyImpactSpike ?? DEFAULT_CENTRAL_SETTINGS.notifications.policyImpactSpike),
    },
    reports: {
      defaultPeriod: isPeriod(raw?.reports?.defaultPeriod)
        ? raw.reports.defaultPeriod
        : DEFAULT_CENTRAL_SETTINGS.reports.defaultPeriod,
      includeFilterContext: Boolean(raw?.reports?.includeFilterContext ?? DEFAULT_CENTRAL_SETTINGS.reports.includeFilterContext),
    },
  };
}

export function loadCentralSettings(): CentralSettingsData {
  try {
    if (typeof window === 'undefined') {
      return { ...DEFAULT_CENTRAL_SETTINGS };
    }
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_CENTRAL_SETTINGS };
    const parsed = JSON.parse(raw) as Partial<CentralSettingsData>;
    return normalizeSettings(parsed);
  } catch {
    return { ...DEFAULT_CENTRAL_SETTINGS };
  }
}

export function saveCentralSettings(settings: CentralSettingsData): void {
  const normalized = normalizeSettings(settings);
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
}

export function resetCentralSettings(): CentralSettingsData {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(STORAGE_KEY);
  }
  return { ...DEFAULT_CENTRAL_SETTINGS };
}
