import type { CaseRecord } from "./caseRecords";
import {
  type CaseEntity,
  type CaseEvent,
  type DashboardStats,
  type GlobalFilters,
  getCaseEntity,
  getDashboardStats,
  listCaseDashboardRecords,
  listCaseEvents,
} from "./caseSSOT";

const USE_REAL_LOCAL_CENTER_API = import.meta.env.VITE_USE_REAL_LOCAL_CENTER_API === "true";
const LOCAL_CENTER_BASE = "/api/local-center";

export type LocalCenterApiSource = "demo" | "remote" | "fallback";

export type LocalCenterDashboardStatsResponse = {
  stats: DashboardStats;
  totalCases: number;
  fetchedAt: string;
  source: LocalCenterApiSource;
};

export type LocalCenterCasesResponse = {
  items: CaseRecord[];
  total: number;
  fetchedAt: string;
  source: LocalCenterApiSource;
};

export type LocalCenterCaseResponse = {
  item: CaseEntity | null;
  fetchedAt: string;
  source: LocalCenterApiSource;
};

export type LocalCenterCaseEventsResponse = {
  items: CaseEvent[];
  total: number;
  fetchedAt: string;
  source: LocalCenterApiSource;
};

function withQuery(path: string, params: Record<string, string | number | boolean | null | undefined>) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    search.set(key, String(value));
  }
  const query = search.toString();
  return query ? `${path}?${query}` : path;
}

function toFilterQuery(filters?: Partial<GlobalFilters>): Record<string, string | number | undefined> {
  return {
    periodFrom: filters?.periodFrom,
    periodTo: filters?.periodTo,
    sido: filters?.sido,
    sigungu: filters?.sigungu,
    center: filters?.center,
    stage: filters?.stage,
    status: filters?.status,
    assigneeId: filters?.assigneeId,
    keyword: filters?.keyword,
  };
}

function nowIso() {
  return new Date().toISOString();
}

function delay(ms = 180) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    method: "GET",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    ...init,
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  return (await response.json()) as T;
}

async function runDemo<T>(builder: () => T, source: LocalCenterApiSource = "demo") {
  await delay(120 + Math.floor(Math.random() * 140));
  const payload = builder();
  return {
    payload,
    source,
  };
}

export async function fetchLocalCenterDashboardStats(
  filters?: Partial<GlobalFilters>,
): Promise<LocalCenterDashboardStatsResponse> {
  const query = toFilterQuery(filters);
  if (USE_REAL_LOCAL_CENTER_API) {
    try {
      const remote = await fetchJson<LocalCenterDashboardStatsResponse>(withQuery(`${LOCAL_CENTER_BASE}/dashboard/stats`, query));
      return remote;
    } catch {
      const fallback = await runDemo(() => ({
        stats: getDashboardStats(filters),
        totalCases: listCaseDashboardRecords(filters).length,
        fetchedAt: nowIso(),
      }), "fallback");
      return { ...fallback.payload, source: fallback.source };
    }
  }

  const demo = await runDemo(() => ({
    stats: getDashboardStats(filters),
    totalCases: listCaseDashboardRecords(filters).length,
    fetchedAt: nowIso(),
  }));
  return { ...demo.payload, source: demo.source };
}

export async function fetchLocalCenterCaseDashboard(
  filters?: Partial<GlobalFilters>,
): Promise<LocalCenterCasesResponse> {
  const query = toFilterQuery(filters);
  if (USE_REAL_LOCAL_CENTER_API) {
    try {
      const remote = await fetchJson<LocalCenterCasesResponse>(withQuery(`${LOCAL_CENTER_BASE}/cases`, query));
      return remote;
    } catch {
      const fallback = await runDemo(() => {
        const items = listCaseDashboardRecords(filters);
        return {
          items,
          total: items.length,
          fetchedAt: nowIso(),
        };
      }, "fallback");
      return { ...fallback.payload, source: fallback.source };
    }
  }

  const demo = await runDemo(() => {
    const items = listCaseDashboardRecords(filters);
    return {
      items,
      total: items.length,
      fetchedAt: nowIso(),
    };
  });
  return { ...demo.payload, source: demo.source };
}

export async function fetchLocalCenterCase(caseId: string): Promise<LocalCenterCaseResponse> {
  if (USE_REAL_LOCAL_CENTER_API) {
    try {
      const remote = await fetchJson<LocalCenterCaseResponse>(`${LOCAL_CENTER_BASE}/cases/${encodeURIComponent(caseId)}`);
      return remote;
    } catch {
      const fallback = await runDemo(
        () => ({
          item: getCaseEntity(caseId),
          fetchedAt: nowIso(),
        }),
        "fallback",
      );
      return { ...fallback.payload, source: fallback.source };
    }
  }

  const demo = await runDemo(() => ({
    item: getCaseEntity(caseId),
    fetchedAt: nowIso(),
  }));
  return { ...demo.payload, source: demo.source };
}

export async function fetchLocalCenterCaseEvents(caseId: string): Promise<LocalCenterCaseEventsResponse> {
  if (USE_REAL_LOCAL_CENTER_API) {
    try {
      const remote = await fetchJson<LocalCenterCaseEventsResponse>(`${LOCAL_CENTER_BASE}/cases/${encodeURIComponent(caseId)}/events`);
      return remote;
    } catch {
      const fallback = await runDemo(
        () => {
          const items = listCaseEvents(caseId);
          return {
            items,
            total: items.length,
            fetchedAt: nowIso(),
          };
        },
        "fallback",
      );
      return { ...fallback.payload, source: fallback.source };
    }
  }

  const demo = await runDemo(() => {
    const items = listCaseEvents(caseId);
    return {
      items,
      total: items.length,
      fetchedAt: nowIso(),
    };
  });
  return { ...demo.payload, source: demo.source };
}

export { USE_REAL_LOCAL_CENTER_API };
