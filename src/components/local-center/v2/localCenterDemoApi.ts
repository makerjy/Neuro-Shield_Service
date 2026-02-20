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

export type Stage2AutoFillSource = "RECEIVED" | "MAPPED" | "SEEDED";

export type Stage2Step2AutoFillPayload = {
  caseId: string;
  source: Stage2AutoFillSource;
  syncedAt: string;
  mmse?: number;
  gds?: number;
  cdr?: number;
  cogTestType?: "CERAD-K" | "SNSB-II" | "SNSB-C" | "LICA";
  specialistOpinionStatus?: "MISSING" | "DONE";
  receivedMeta: {
    linkageStatus: "WAITING" | "RECEIVED" | "FAILED";
    receivedAt?: string;
    providerName?: string;
  };
  missingRequiredCount: number;
  filledFields?: string[];
};

export type Stage2Step2AutoFillResponse = {
  item: Stage2Step2AutoFillPayload;
  fetchedAt: string;
  source: LocalCenterApiSource;
};

export type Stage2Step2ManualEditPayload = {
  changedFields: Record<string, unknown>;
  reason: string;
  editor?: string;
};

export type Stage2Step2ManualEditResponse = {
  ok: boolean;
  caseId: string;
  changedFields: Record<string, unknown>;
  reason?: string;
  editor?: string;
  editedAt?: string;
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

function seedHash(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (Math.imul(31, hash) + value.charCodeAt(index)) | 0;
  }
  return hash >>> 0;
}

function seedInt(caseId: string, suffix: string, min: number, max: number) {
  if (min >= max) return min;
  const span = max - min + 1;
  return min + (seedHash(`${caseId}:${suffix}`) % span);
}

function seedPick<T>(caseId: string, suffix: string, items: T[]): T {
  return items[seedHash(`${caseId}:${suffix}`) % items.length] as T;
}

function inferStage2RiskBand(entity: CaseEntity | null): "LOW" | "MID" | "HIGH" | "AD" {
  if (!entity) return "MID";
  if (entity.classification === "AD") return "AD";
  if (entity.classification === "MCI") return "MID";
  if (entity.classification === "NORMAL") return "LOW";
  const risk = entity.riskScore ?? 55;
  if (risk >= 82) return "AD";
  if (risk >= 70) return "HIGH";
  if (risk >= 40) return "MID";
  return "LOW";
}

function buildSeededStep2AutoFill(caseId: string, entity: CaseEntity | null): Stage2Step2AutoFillPayload {
  const riskBand = inferStage2RiskBand(entity);
  const payload: Stage2Step2AutoFillPayload = {
    caseId,
    source: "SEEDED",
    syncedAt: nowIso(),
    receivedMeta: {
      linkageStatus: "WAITING",
      providerName: "강남구 협력병원",
    },
    missingRequiredCount: 0,
  };

  if (riskBand === "LOW") {
    payload.mmse = seedInt(caseId, "mmse-low", 24, 29);
    payload.gds = seedInt(caseId, "gds-low", 1, 3);
    payload.cogTestType = seedPick(caseId, "cog-low", ["CERAD-K", "LICA"]);
  } else if (riskBand === "MID") {
    payload.mmse = seedInt(caseId, "mmse-mid", 20, 25);
    payload.gds = seedInt(caseId, "gds-mid", 3, 5);
    payload.cogTestType = seedPick(caseId, "cog-mid", ["SNSB-II", "CERAD-K"]);
  } else if (riskBand === "HIGH") {
    payload.mmse = seedInt(caseId, "mmse-high", 16, 22);
    payload.gds = seedInt(caseId, "gds-high", 4, 6);
    payload.cdr = Number(seedPick(caseId, "cdr-high", [0.5, 1]));
    payload.cogTestType = seedPick(caseId, "cog-high", ["SNSB-II", "SNSB-C"]);
  } else {
    payload.mmse = seedInt(caseId, "mmse-ad", 10, 18);
    payload.gds = seedInt(caseId, "gds-ad", 5, 7);
    payload.cdr = Number(seedPick(caseId, "cdr-ad", [1, 2]));
    payload.cogTestType = seedPick(caseId, "cog-ad", ["SNSB-II", "SNSB-C"]);
    payload.specialistOpinionStatus = "DONE";
  }

  const requiredKeys =
    riskBand === "LOW" || riskBand === "MID"
      ? (["mmse", "gds", "cogTestType"] as const)
      : riskBand === "HIGH"
        ? (["mmse", "gds", "cdr", "cogTestType"] as const)
        : (["mmse", "gds", "cdr", "cogTestType", "specialistOpinionStatus"] as const);
  payload.missingRequiredCount = requiredKeys.filter((key) => {
    if (key === "specialistOpinionStatus") return payload.specialistOpinionStatus !== "DONE";
    return payload[key] == null;
  }).length;
  payload.filledFields = ["mmse", "gds", "cdr", "cogTestType", "specialistOpinionStatus"].filter(
    (key) => payload[key as keyof Stage2Step2AutoFillPayload] != null,
  );
  return payload;
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

export async function fetchStage2Step2Autofill(caseId: string): Promise<Stage2Step2AutoFillResponse> {
  const demoBuilder = () => {
    const entity = getCaseEntity(caseId);
    const item = buildSeededStep2AutoFill(caseId, entity);
    return {
      item,
      fetchedAt: nowIso(),
    };
  };

  if (USE_REAL_LOCAL_CENTER_API) {
    try {
      const remote = await fetchJson<Stage2Step2AutoFillResponse | Stage2Step2AutoFillPayload>(
        `/api/stage2/cases/${encodeURIComponent(caseId)}/step2/autofill`,
      );
      if ("item" in remote) {
        return { ...remote, source: remote.source ?? "remote" };
      }
      return {
        item: remote,
        fetchedAt: nowIso(),
        source: "remote",
      };
    } catch {
      const fallback = await runDemo(demoBuilder, "fallback");
      return { ...fallback.payload, source: fallback.source };
    }
  }

  const demo = await runDemo(demoBuilder);
  return { ...demo.payload, source: demo.source };
}

export async function submitStage2Step2ManualEdit(
  caseId: string,
  payload: Stage2Step2ManualEditPayload,
): Promise<Stage2Step2ManualEditResponse> {
  if (USE_REAL_LOCAL_CENTER_API) {
    try {
      const remote = await fetchJson<Omit<Stage2Step2ManualEditResponse, "source">>(
        `/api/stage2/cases/${encodeURIComponent(caseId)}/step2/manual-edit`,
        {
          method: "POST",
          body: JSON.stringify(payload),
        },
      );
      return { ...remote, source: "remote" };
    } catch {
      const fallback = await runDemo(
        () => ({
          ok: true,
          caseId,
          changedFields: payload.changedFields,
          reason: payload.reason,
          editor: payload.editor,
          editedAt: nowIso(),
        }),
        "fallback",
      );
      return { ...fallback.payload, source: fallback.source };
    }
  }

  const demo = await runDemo(() => ({
    ok: true,
    caseId,
    changedFields: payload.changedFields,
    reason: payload.reason,
    editor: payload.editor,
    editedAt: nowIso(),
  }));
  return { ...demo.payload, source: demo.source };
}

export { USE_REAL_LOCAL_CENTER_API };
