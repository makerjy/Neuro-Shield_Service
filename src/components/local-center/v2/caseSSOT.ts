import { useMemo, useSyncExternalStore } from "react";
import {
  CASE_RECORDS,
  type AlertTag,
  type CaseRecord,
} from "./caseRecords";

export type Stage = 1 | 2 | 3;
export type Stage2Route = "HOSPITAL" | "CENTER";

export type CaseStatus =
  | "OPEN"
  | "IN_PROGRESS"
  | "WAITING_RESULTS"
  | "READY_TO_CLASSIFY"
  | "CLASS_CONFIRMED"
  | "NEXT_STEP_SET"
  | "CLOSED"
  | "ON_HOLD"
  | "EXCLUDED";

export type CaseCore = {
  caseId: string;
  stage: Stage;
  assigneeId?: string;
  region: { sido: string; sigungu: string; center: string };
  patient: { name: string; age: number; phone?: string; caregiverPhone?: string };
  status: CaseStatus;
  createdAt: string;
  updatedAt: string;
  stage2Route: Stage2Route;
};

export type Stage2RequiredTests = {
  specialist: boolean;
  mmse?: number | null;
  cdrOrGds?: number | null;
  neuroType?: "CERAD-K" | "SNSB-II" | "SNSB-C" | "LICA" | null;
  neuroScore?: number | null;
};

export type Stage3RequiredTests = {
  biomarker: boolean;
  imaging: boolean;
  biomarkerResult?: "POS" | "NEG" | "UNK" | null;
  imagingResult?: "POS" | "NEG" | "UNK" | null;
  performedAt?: string | null;
};

export type EvidenceState = {
  stage2: {
    required: Stage2RequiredTests;
    completed: boolean;
    missing: string[];
  };
  stage3: {
    required: Stage3RequiredTests;
    completed: boolean;
    missing: string[];
  };
};

export type Stage2ModelOutput = {
  available: boolean;
  probs?: { NORMAL: number; MCI: number; AD: number };
  predictedLabel?: "정상" | "MCI" | "치매";
  mciScore?: number;
  mciBand?: "양호" | "중간" | "위험";
  modelVersion?: string;
  updatedAt?: string;
};

export type Stage3ModelOutput = {
  available: boolean;
  risk2yNow?: number;
  risk2yAt2y?: number;
  label?: "LOW" | "MID" | "HIGH";
  confidence?: "LOW" | "MID" | "HIGH";
  modelVersion?: string;
  updatedAt?: string;
};

export type CaseComputed = {
  evidence: EvidenceState;
  model2: Stage2ModelOutput;
  model3: Stage3ModelOutput;
  ops: {
    contactMode?: "HUMAN" | "AGENT";
    lastContactAt?: string;
    bookingPendingCount?: number;
    approvalsPendingCount?: number;
    dataQualityScore?: number;
    missingFieldCount?: number;
  };
};

export type CaseEntity = CaseCore & {
  computed: CaseComputed;
};

export type EventType =
  | "STAGE_CHANGE"
  | "STAGE2_PLAN_CONFIRMED"
  | "STAGE2_RESULTS_RECORDED"
  | "STAGE2_CLASS_CONFIRMED"
  | "STAGE2_NEXT_STEP_SET"
  | "STAGE3_DIFF_SCHEDULED"
  | "STAGE3_RESULTS_RECORDED"
  | "STAGE3_RISK_UPDATED"
  | "CONTACT_SENT"
  | "CONTACT_RESULT"
  | "BOOKING_CREATED"
  | "BOOKING_CONFIRMED"
  | "APPROVAL_PENDING"
  | "APPROVAL_RESOLVED"
  | "CASE_HOLD"
  | "CASE_EXCLUDED"
  | "CASE_CLOSED"
  | "DATA_SYNCED";

export type CaseEvent = {
  eventId: string;
  caseId: string;
  at: string;
  actorId: string;
  type: EventType;
  payload: Record<string, unknown>;
};

export type GlobalFilters = {
  periodFrom?: string;
  periodTo?: string;
  sido?: string;
  sigungu?: string;
  center?: string;
  stage?: Stage | "ALL";
  status?: CaseStatus | "ALL";
  assigneeId?: string;
  keyword?: string;
};

type InternalCaseEntity = CaseEntity & {
  legacyRisk: CaseRecord["risk"];
  legacyQuality: CaseRecord["quality"];
  legacyTags: AlertTag[];
};

export type DashboardStats = {
  contactNeeded: number;
  stage2Waiting: number;
  highRiskMci: number;
  stage3Waiting: number;
  churnRisk: number;
  stageCounts: Record<Stage, number>;
  pipelineData: Array<{ name: string; count: number; rate: number; drop: number; wait: number }>;
  mciDistribution: Array<{ name: string; value: number; color: string }>;
  highRiskMciList: Array<{ id: string; age: number; probability: string; period: string; nextAction: string }>;
  priorityTasks: Array<{ id: string; age: number; stage: "Stage 1" | "Stage 2" | "Stage 3"; reason: string; action: string; sla: string }>;
};

const MODEL2_VERSION = "stage2-gate-v2";
const MODEL3_VERSION = "stage3-gate-v2";

const caseStore = new Map<string, InternalCaseEntity>();
const eventStore = new Map<string, CaseEvent[]>();
const listeners = new Set<() => void>();

let snapshotVersion = 0;
let globalFilters: GlobalFilters = {
  stage: "ALL",
  status: "ALL",
  keyword: "",
};

function emitChange() {
  snapshotVersion += 1;
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshotVersion() {
  return snapshotVersion;
}

function nowIso() {
  return new Date().toISOString();
}

function seeded(seed: string): number {
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (Math.imul(31, hash) + seed.charCodeAt(index)) | 0;
  }
  return ((hash >>> 0) % 10000) / 10000;
}

function clamp01(value: number) {
  if (Number.isNaN(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function normalizeProbs(input: { NORMAL: number; MCI: number; AD: number }) {
  const normal = Math.max(0, input.NORMAL);
  const mci = Math.max(0, input.MCI);
  const ad = Math.max(0, input.AD);
  const sum = normal + mci + ad;
  if (sum <= 0) {
    return { NORMAL: 0.33, MCI: 0.34, AD: 0.33 };
  }
  return {
    NORMAL: Number((normal / sum).toFixed(4)),
    MCI: Number((mci / sum).toFixed(4)),
    AD: Number((ad / sum).toFixed(4)),
  };
}

function labelByProbability(probs: { NORMAL: number; MCI: number; AD: number }) {
  const sorted = [
    { key: "NORMAL" as const, value: probs.NORMAL },
    { key: "MCI" as const, value: probs.MCI },
    { key: "AD" as const, value: probs.AD },
  ].sort((a, b) => b.value - a.value);

  const top = sorted[0]?.key;
  if (top === "NORMAL") return "정상" as const;
  if (top === "AD") return "치매" as const;
  return "MCI" as const;
}

function buildMciBand(score: number): "양호" | "중간" | "위험" {
  if (score >= 70) return "위험";
  if (score >= 40) return "중간";
  return "양호";
}

function toLegacyDateTime(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")} ${String(
    date.getHours(),
  ).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function parseLegacyDateTime(input: string) {
  const parsed = new Date(input.includes("T") ? input : input.replace(" ", "T"));
  if (Number.isNaN(parsed.getTime())) return nowIso();
  return parsed.toISOString();
}

function stageFromLegacy(stage: CaseRecord["stage"]): Stage {
  if (stage === "Stage 1") return 1;
  if (stage === "Stage 2") return 2;
  return 3;
}

function stageToLegacy(stage: Stage): "Stage 1" | "Stage 2" | "Stage 3" {
  if (stage === 1) return "Stage 1";
  if (stage === 2) return "Stage 2";
  return "Stage 3";
}

function statusFromLegacy(status: CaseRecord["status"]): CaseStatus {
  if (status === "완료") return "CLOSED";
  if (status === "지연") return "ON_HOLD";
  if (status === "임박") return "WAITING_RESULTS";
  if (status === "대기") return "WAITING_RESULTS";
  return "IN_PROGRESS";
}

function statusToLegacy(status: CaseStatus): CaseRecord["status"] {
  if (status === "CLOSED") return "완료";
  if (status === "ON_HOLD") return "지연";
  if (status === "WAITING_RESULTS") return "대기";
  if (status === "READY_TO_CLASSIFY") return "임박";
  if (status === "CLASS_CONFIRMED") return "진행중";
  if (status === "NEXT_STEP_SET") return "진행중";
  if (status === "EXCLUDED") return "지연";
  return "진행중";
}

function qualityScoreToLabel(score: number): CaseRecord["quality"] {
  if (score >= 90) return "양호";
  if (score >= 75) return "주의";
  return "경고";
}

function routeFromLegacy(record: CaseRecord): Stage2Route {
  if (record.path.includes("의뢰") || record.path.includes("병원")) return "HOSPITAL";
  return "CENTER";
}

function evaluateStage2Evidence(required: Stage2RequiredTests, route: Stage2Route) {
  const missing: string[] = [];
  if (!required.specialist) missing.push("전문의 진찰");
  if (required.cdrOrGds == null) missing.push("CDR 또는 GDS");
  if (!required.neuroType) missing.push("신경인지검사 유형");
  if (route === "HOSPITAL" && required.mmse == null) missing.push("MMSE");

  return {
    completed: missing.length === 0,
    missing,
  };
}

function evaluateStage3Evidence(required: Stage3RequiredTests) {
  const missing: string[] = [];
  if (!required.biomarker) {
    missing.push("바이오마커 검사 수행");
  } else if (!required.biomarkerResult) {
    missing.push("바이오마커 결과 입력");
  }

  if (!required.imaging) {
    missing.push("뇌영상 검사 수행");
  } else if (!required.imagingResult) {
    missing.push("뇌영상 결과 입력");
  }

  if (!required.performedAt) missing.push("검사 수행 시각");

  return {
    completed: missing.length === 0,
    missing,
  };
}

function generateStage2Model(
  entity: InternalCaseEntity,
  labelOverride?: "정상" | "MCI" | "치매",
  mciBandOverride?: "양호" | "중간" | "위험",
): Stage2ModelOutput {
  const signalSeed = seeded(`${entity.caseId}-model2`);
  const evidence = entity.computed.evidence.stage2.required;
  const riskWeight = entity.legacyRisk === "고" ? 0.72 : entity.legacyRisk === "중" ? 0.5 : 0.28;
  const cdrWeight = evidence.cdrOrGds == null ? 0.35 : clamp01(evidence.cdrOrGds / 3);
  const mmseWeight = evidence.mmse == null ? 0.35 : clamp01((30 - evidence.mmse) / 30);
  const neuroWeight = evidence.neuroScore == null ? 0.45 : clamp01((100 - evidence.neuroScore) / 100);

  let probs = normalizeProbs({
    NORMAL: 0.2 + (1 - riskWeight) * 0.45 + (1 - cdrWeight) * 0.2 + (1 - mmseWeight) * 0.1,
    MCI: 0.25 + riskWeight * 0.4 + cdrWeight * 0.35 + neuroWeight * 0.25,
    AD: 0.15 + riskWeight * 0.55 + cdrWeight * 0.45 + mmseWeight * 0.35 + signalSeed * 0.08,
  });

  if (labelOverride) {
    if (labelOverride === "정상") {
      probs = normalizeProbs({ NORMAL: 0.78, MCI: 0.17, AD: 0.05 });
    } else if (labelOverride === "MCI") {
      probs = normalizeProbs({ NORMAL: 0.14, MCI: 0.7, AD: 0.16 });
    } else {
      probs = normalizeProbs({ NORMAL: 0.08, MCI: 0.2, AD: 0.72 });
    }
  }

  const predictedLabel = labelOverride ?? labelByProbability(probs);
  const mciScoreBase = Math.round(probs.MCI * 100 + probs.AD * 30 + signalSeed * 12);
  const mciScore = Math.max(0, Math.min(100, mciScoreBase));
  const mciBand = mciBandOverride ?? buildMciBand(mciScore);

  return {
    available: true,
    probs,
    predictedLabel,
    mciScore,
    mciBand,
    modelVersion: MODEL2_VERSION,
    updatedAt: nowIso(),
  };
}

function generateStage3Model(entity: InternalCaseEntity): Stage3ModelOutput {
  const seed = seeded(`${entity.caseId}-model3`);
  const stage2Label = entity.computed.model2.predictedLabel;
  const required = entity.computed.evidence.stage3.required;

  let base = stage2Label === "치매" ? 0.7 : stage2Label === "MCI" ? 0.52 : 0.28;
  if (required.biomarkerResult === "POS") base += 0.14;
  if (required.biomarkerResult === "NEG") base -= 0.08;
  if (required.biomarkerResult === "UNK") base += 0.03;

  if (required.imagingResult === "POS") base += 0.14;
  if (required.imagingResult === "NEG") base -= 0.07;
  if (required.imagingResult === "UNK") base += 0.03;

  if (entity.status === "ON_HOLD") base += 0.06;
  if (entity.status === "CLOSED") base -= 0.05;

  const risk2yNow = clamp01(base + (seed - 0.5) * 0.08);
  const risk2yAt2y = clamp01(risk2yNow + 0.08 + (seed - 0.5) * 0.05);
  const label: Stage3ModelOutput["label"] = risk2yNow >= 0.7 ? "HIGH" : risk2yNow >= 0.45 ? "MID" : "LOW";

  let confidence: Stage3ModelOutput["confidence"] = "HIGH";
  if (required.biomarkerResult === "UNK" || required.imagingResult === "UNK") confidence = "MID";
  if (!required.performedAt) confidence = "LOW";

  return {
    available: true,
    risk2yNow,
    risk2yAt2y,
    label,
    confidence,
    modelVersion: MODEL3_VERSION,
    updatedAt: nowIso(),
  };
}

function cloneCase(entity: InternalCaseEntity): InternalCaseEntity {
  return JSON.parse(JSON.stringify(entity)) as InternalCaseEntity;
}

function recomputeCase(entity: InternalCaseEntity): InternalCaseEntity {
  const next = cloneCase(entity);
  const stage2Eval = evaluateStage2Evidence(next.computed.evidence.stage2.required, next.stage2Route);
  const stage3Eval = evaluateStage3Evidence(next.computed.evidence.stage3.required);

  next.computed.evidence.stage2.completed = stage2Eval.completed;
  next.computed.evidence.stage2.missing = stage2Eval.missing;
  next.computed.evidence.stage3.completed = stage3Eval.completed;
  next.computed.evidence.stage3.missing = stage3Eval.missing;

  if (stage2Eval.completed) {
    if (!next.computed.model2.available || !next.computed.model2.probs) {
      next.computed.model2 = generateStage2Model(next);
    }
  } else {
    next.computed.model2 = { available: false };
  }

  if (stage3Eval.completed) {
    if (!next.computed.model3.available || next.computed.model3.risk2yNow == null) {
      next.computed.model3 = generateStage3Model(next);
    }
  } else {
    next.computed.model3 = { available: false };
  }

  const missingFieldCount = stage2Eval.missing.length + stage3Eval.missing.length;
  const baseQuality = next.legacyQuality === "양호" ? 95 : next.legacyQuality === "주의" ? 82 : 64;

  const fallbackBookingPendingCount = next.status === "WAITING_RESULTS" || next.status === "READY_TO_CLASSIFY" ? 1 : 0;
  const fallbackApprovalsPendingCount = next.status === "IN_PROGRESS" && next.stage >= 2 ? 1 : 0;
  next.computed.ops = {
    ...next.computed.ops,
    dataQualityScore: Math.max(40, Math.min(100, baseQuality - missingFieldCount * 4)),
    missingFieldCount,
    bookingPendingCount: next.computed.ops.bookingPendingCount ?? fallbackBookingPendingCount,
    approvalsPendingCount: next.computed.ops.approvalsPendingCount ?? fallbackApprovalsPendingCount,
  };

  return next;
}

function initialStage2Required(record: CaseRecord, route: Stage2Route): Stage2RequiredTests {
  const seed = seeded(`${record.id}-stage2-required`);
  const started = record.stage !== "Stage 1";
  const specialist = started && record.status !== "대기";
  const cdrOrGds = started && seed > 0.18 ? Number((0.5 + seeded(`${record.id}-cdr`) * 1.8).toFixed(1)) : null;
  const neuroType =
    started && seed > 0.22
      ? (["CERAD-K", "SNSB-II", "SNSB-C", "LICA"] as const)[Math.floor(seeded(`${record.id}-neuro`) * 4)]
      : null;
  const mmse = route === "HOSPITAL" && started && seed > 0.32 ? Math.round(18 + seeded(`${record.id}-mmse`) * 10) : null;
  const neuroScore = started && seed > 0.27 ? Math.round(45 + seeded(`${record.id}-neuro-score`) * 40) : null;

  return {
    specialist,
    mmse,
    cdrOrGds,
    neuroType,
    neuroScore,
  };
}

function initialStage3Required(record: CaseRecord): Stage3RequiredTests {
  const seed = seeded(`${record.id}-stage3-required`);
  const isStage3 = record.stage === "Stage 3";

  if (!isStage3) {
    return {
      biomarker: false,
      imaging: false,
      biomarkerResult: null,
      imagingResult: null,
      performedAt: null,
    };
  }

  const biomarker = seed > 0.18;
  const imaging = seed > 0.2;
  const hasResults = seed > 0.45 && biomarker && imaging;
  const resultSeed = seeded(`${record.id}-stage3-result`);

  const valueBySeed = (value: number): "POS" | "NEG" | "UNK" => {
    if (value >= 0.66) return "POS";
    if (value >= 0.33) return "UNK";
    return "NEG";
  };

  return {
    biomarker,
    imaging,
    biomarkerResult: hasResults ? valueBySeed(resultSeed) : null,
    imagingResult: hasResults ? valueBySeed(1 - resultSeed) : null,
    performedAt: hasResults ? parseLegacyDateTime(record.updated) : null,
  };
}

function toInternalCase(record: CaseRecord): InternalCaseEntity {
  const stage = stageFromLegacy(record.stage);
  const route = routeFromLegacy(record);
  const createdAt = parseLegacyDateTime(record.updated);

  const base: InternalCaseEntity = {
    caseId: record.id,
    stage,
    assigneeId: record.manager,
    region: {
      sido: "서울특별시",
      sigungu: "강남구",
      center: "강남구 치매안심센터",
    },
    patient: {
      name: record.profile.name,
      age: record.profile.age,
      phone: record.profile.phone,
      caregiverPhone: record.profile.guardianPhone,
    },
    status: statusFromLegacy(record.status),
    createdAt,
    updatedAt: parseLegacyDateTime(record.updated),
    stage2Route: route,
    legacyRisk: record.risk,
    legacyQuality: record.quality,
    legacyTags: [...record.alertTags],
    computed: {
      evidence: {
        stage2: {
          required: initialStage2Required(record, route),
          completed: false,
          missing: [],
        },
        stage3: {
          required: initialStage3Required(record),
          completed: false,
          missing: [],
        },
      },
      model2: {
        available: false,
      },
      model3: {
        available: false,
      },
      ops: {
        contactMode: record.path.includes("문자") ? "AGENT" : "HUMAN",
        lastContactAt: parseLegacyDateTime(record.updated),
        bookingPendingCount: record.alertTags.includes("연계 대기") ? 1 : 0,
        approvalsPendingCount: record.status === "임박" ? 1 : 0,
      },
    },
  };

  return recomputeCase(base);
}

function ensureStore() {
  if (caseStore.size > 0) return;

  for (const record of CASE_RECORDS) {
    const internal = toInternalCase(record);
    caseStore.set(internal.caseId, internal);
    eventStore.set(internal.caseId, [
      {
        eventId: `evt-${internal.caseId}-init`,
        caseId: internal.caseId,
        at: internal.updatedAt,
        actorId: internal.assigneeId ?? "system",
        type: "DATA_SYNCED",
        payload: {
          reason: "INITIALIZE_FROM_CASE_RECORDS",
        },
      },
    ]);
  }
}

function patchCase(caseId: string, patcher: (draft: InternalCaseEntity) => void) {
  ensureStore();
  const current = caseStore.get(caseId);
  if (!current) return;

  const draft = cloneCase(current);
  patcher(draft);
  draft.updatedAt = nowIso();
  const recomputed = recomputeCase(draft);
  caseStore.set(caseId, recomputed);
  emitChange();
}

function makeEvent(caseId: string, type: EventType, payload: Record<string, unknown>, actorId: string): CaseEvent {
  return {
    eventId: `evt-${caseId}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    caseId,
    at: nowIso(),
    actorId,
    type,
    payload,
  };
}

export function recordCaseEvent(
  caseId: string,
  type: EventType,
  payload: Record<string, unknown> = {},
  actorId = "system",
) {
  ensureStore();
  const event = makeEvent(caseId, type, payload, actorId);
  const prev = eventStore.get(caseId) ?? [];
  eventStore.set(caseId, [event, ...prev]);
  emitChange();
  return event;
}

export function updateCaseStage2Evidence(
  caseId: string,
  payload: Partial<Stage2RequiredTests>,
  options?: { route?: Stage2Route; actorId?: string },
) {
  patchCase(caseId, (draft) => {
    draft.stage = 2;
    if (options?.route) {
      draft.stage2Route = options.route;
    }
    draft.status = "WAITING_RESULTS";
    draft.computed.evidence.stage2.required = {
      ...draft.computed.evidence.stage2.required,
      ...payload,
    };
  });

  recordCaseEvent(
    caseId,
    "STAGE2_RESULTS_RECORDED",
    {
      route: options?.route,
      required: payload,
    },
    options?.actorId ?? "system",
  );
}

function mapLabelToProbs(label: "정상" | "MCI" | "치매") {
  if (label === "정상") return normalizeProbs({ NORMAL: 0.78, MCI: 0.17, AD: 0.05 });
  if (label === "MCI") return normalizeProbs({ NORMAL: 0.13, MCI: 0.71, AD: 0.16 });
  return normalizeProbs({ NORMAL: 0.08, MCI: 0.2, AD: 0.72 });
}

export function confirmCaseStage2Model(
  caseId: string,
  label: "정상" | "MCI" | "치매",
  options?: { mciBand?: "양호" | "중간" | "위험"; actorId?: string; rationale?: string },
) {
  ensureStore();
  const target = caseStore.get(caseId);
  if (!target) return false;
  if (!target.computed.evidence.stage2.completed) return false;

  patchCase(caseId, (draft) => {
    const probs = mapLabelToProbs(label);
    const mciScore = Math.round((probs.MCI + probs.AD * 0.3) * 100);

    draft.status = "CLASS_CONFIRMED";
    draft.computed.model2 = {
      available: true,
      probs,
      predictedLabel: label,
      mciScore,
      mciBand: options?.mciBand ?? buildMciBand(mciScore),
      modelVersion: MODEL2_VERSION,
      updatedAt: nowIso(),
    };
  });

  recordCaseEvent(
    caseId,
    "STAGE2_CLASS_CONFIRMED",
    {
      label,
      rationale: options?.rationale,
    },
    options?.actorId ?? "system",
  );

  return true;
}

export function setCaseNextStep(
  caseId: string,
  nextStep: "FOLLOWUP_2Y" | "STAGE3" | "DIFF_PATH",
  options?: { actorId?: string; summary?: string },
) {
  patchCase(caseId, (draft) => {
    draft.status = "NEXT_STEP_SET";

    if (nextStep === "STAGE3") {
      draft.stage = 3;
      draft.status = "IN_PROGRESS";
    }

    if (nextStep === "FOLLOWUP_2Y") {
      draft.status = "CLOSED";
    }
  });

  if (nextStep === "STAGE3") {
    recordCaseEvent(
      caseId,
      "STAGE_CHANGE",
      {
        from: 2,
        to: 3,
        reason: "MCI_CONFIRMED",
      },
      options?.actorId ?? "system",
    );
  }

  recordCaseEvent(
    caseId,
    "STAGE2_NEXT_STEP_SET",
    {
      nextStep,
      summary: options?.summary,
    },
    options?.actorId ?? "system",
  );
}

export function setCaseBookingPending(caseId: string, pendingCount: number, actorId = "system") {
  patchCase(caseId, (draft) => {
    draft.computed.ops.bookingPendingCount = Math.max(0, pendingCount);
    if (pendingCount > 0) {
      draft.status = "WAITING_RESULTS";
    } else if (draft.status === "WAITING_RESULTS") {
      draft.status = "IN_PROGRESS";
    }
  });

  recordCaseEvent(caseId, pendingCount > 0 ? "BOOKING_CREATED" : "BOOKING_CONFIRMED", { pendingCount }, actorId);
}

export function updateCaseStage3Evidence(
  caseId: string,
  payload: Partial<Stage3RequiredTests>,
  actorId = "system",
) {
  patchCase(caseId, (draft) => {
    draft.stage = 3;
    draft.status = "WAITING_RESULTS";
    draft.computed.evidence.stage3.required = {
      ...draft.computed.evidence.stage3.required,
      ...payload,
    };
  });

  recordCaseEvent(
    caseId,
    "STAGE3_RESULTS_RECORDED",
    {
      required: payload,
    },
    actorId,
  );
}

export function runCaseStage3Model(caseId: string, actorId = "system") {
  ensureStore();
  const target = caseStore.get(caseId);
  if (!target || !target.computed.evidence.stage3.completed) return false;

  patchCase(caseId, (draft) => {
    draft.computed.model3 = generateStage3Model(draft);
    draft.status = "IN_PROGRESS";
  });

  recordCaseEvent(caseId, "STAGE3_RISK_UPDATED", {}, actorId);
  return true;
}

export function listCaseEvents(caseId: string) {
  ensureStore();
  return [...(eventStore.get(caseId) ?? [])];
}

export function getCaseEntity(caseId: string): CaseEntity | null {
  ensureStore();
  const found = caseStore.get(caseId);
  if (!found) return null;
  const { legacyQuality: _legacyQuality, legacyRisk: _legacyRisk, legacyTags: _legacyTags, ...entity } = found;
  return entity;
}

function includeByFilters(entity: InternalCaseEntity, filters: GlobalFilters) {
  if (filters.stage && filters.stage !== "ALL" && entity.stage !== filters.stage) return false;
  if (filters.status && filters.status !== "ALL" && entity.status !== filters.status) return false;
  if (filters.sido && entity.region.sido !== filters.sido) return false;
  if (filters.sigungu && entity.region.sigungu !== filters.sigungu) return false;
  if (filters.center && entity.region.center !== filters.center) return false;
  if (filters.assigneeId && entity.assigneeId !== filters.assigneeId) return false;

  const q = (filters.keyword ?? "").trim().toLowerCase();
  if (q.length > 0) {
    const blob = [
      entity.caseId,
      entity.patient.name,
      entity.patient.phone,
      entity.assigneeId,
      entity.status,
      entity.stage,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    if (!blob.includes(q)) return false;
  }

  return true;
}

function getMergedFilters(input?: Partial<GlobalFilters>): GlobalFilters {
  return {
    ...globalFilters,
    ...(input ?? {}),
  };
}

export function listCaseEntities(input?: Partial<GlobalFilters>): CaseEntity[] {
  ensureStore();
  const merged = getMergedFilters(input);

  return [...caseStore.values()]
    .filter((entity) => includeByFilters(entity, merged))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .map((entity) => {
      const { legacyQuality: _legacyQuality, legacyRisk: _legacyRisk, legacyTags: _legacyTags, ...plain } = entity;
      return plain;
    });
}

function deriveLegacyRisk(entity: InternalCaseEntity): CaseRecord["risk"] {
  if (entity.computed.model3.available) {
    if (entity.computed.model3.label === "HIGH") return "고";
    if (entity.computed.model3.label === "MID") return "중";
    return "저";
  }

  if (entity.computed.model2.available) {
    if (entity.computed.model2.predictedLabel === "치매" || entity.computed.model2.mciBand === "위험") return "고";
    if (entity.computed.model2.predictedLabel === "MCI") return "중";
    return "저";
  }

  return entity.legacyRisk;
}

function deriveLegacyPath(entity: InternalCaseEntity): string {
  if (entity.stage === 1) return entity.computed.ops.contactMode === "AGENT" ? "문자 안내 우선" : "초기 접촉 집중";

  if (entity.stage === 2) {
    if (!entity.computed.model2.available) return "검사결과 입력 대기";
    if (entity.computed.model2.predictedLabel === "치매") return "의료 의뢰 우선";
    if (entity.computed.model2.predictedLabel === "MCI") {
      return entity.computed.model2.mciBand === "위험" ? "High MCI 경로" : "MCI 경로";
    }
    return "정상 추적 권고";
  }

  if (!entity.computed.model3.available) return "재평가 준비";
  if (entity.computed.model3.label === "HIGH") return "추적 강화";
  if (entity.computed.model3.label === "MID") return "정기 추적";
  return "완화 추적";
}

function deriveLegacyAction(entity: InternalCaseEntity): string {
  if (entity.status === "WAITING_RESULTS") return "검사 결과 입력";
  if (entity.status === "READY_TO_CLASSIFY") return "분류 근거 검토";
  if (entity.status === "CLASS_CONFIRMED") return "다음 단계 결정";
  if (entity.status === "NEXT_STEP_SET") return entity.stage === 3 ? "재평가 일정 생성" : "후속 계획 확정";
  if (entity.status === "CLOSED") return "종결";
  if (entity.status === "ON_HOLD") return "재연락 대기";
  return entity.stage === 3 ? "재평가 일정 생성" : "연계 실행";
}

function deriveLegacyAlertTags(entity: InternalCaseEntity): AlertTag[] {
  const tags = new Set<AlertTag>();

  if (entity.computed.ops.bookingPendingCount && entity.computed.ops.bookingPendingCount > 0) {
    tags.add("연계 대기");
  }

  if (entity.stage === 2 && !entity.computed.model2.available) {
    tags.add("MCI 미등록");
  }

  if (
    entity.stage === 2 &&
    entity.computed.model2.available &&
    entity.computed.model2.predictedLabel === "MCI" &&
    entity.computed.model2.mciBand === "위험"
  ) {
    tags.add("High MCI");
  }

  if (entity.stage === 3 && !entity.computed.evidence.stage3.completed) {
    tags.add("재평가 필요");
  }

  if (entity.stage === 3 && (entity.computed.model3.label === "HIGH" || !entity.computed.model3.available)) {
    tags.add("이탈 위험");
  }

  if (entity.status === "WAITING_RESULTS" || entity.status === "ON_HOLD") {
    tags.add("SLA 임박");
  }

  for (const legacy of entity.legacyTags) {
    tags.add(legacy);
  }

  return [...tags];
}

export function toCaseDashboardRecord(entity: CaseEntity): CaseRecord {
  ensureStore();
  const internal = caseStore.get(entity.caseId);
  if (!internal) {
    return CASE_RECORDS[0];
  }

  const qualityScore = internal.computed.ops.dataQualityScore ?? 80;

  return {
    id: internal.caseId,
    stage: stageToLegacy(internal.stage),
    risk: deriveLegacyRisk(internal),
    path: deriveLegacyPath(internal),
    status: statusToLegacy(internal.status),
    manager: internal.assigneeId ?? "담당자 미지정",
    action: deriveLegacyAction(internal),
    updated: toLegacyDateTime(internal.updatedAt),
    quality: qualityScoreToLabel(qualityScore),
    profile: {
      name: internal.patient.name,
      age: internal.patient.age,
      phone: internal.patient.phone ?? "010-0000-0000",
      guardianPhone: internal.patient.caregiverPhone,
    },
    alertTags: deriveLegacyAlertTags(internal),
    computed: {
      stage2: {
        modelAvailable: internal.computed.model2.available,
        predictedLabel: internal.computed.model2.predictedLabel,
        mciBand: internal.computed.model2.mciBand,
        completed: internal.computed.evidence.stage2.completed,
        missing: internal.computed.evidence.stage2.missing,
      },
      stage3: {
        modelAvailable: internal.computed.model3.available,
        label: internal.computed.model3.label,
        completed: internal.computed.evidence.stage3.completed,
        missing: internal.computed.evidence.stage3.missing,
      },
      ops: {
        bookingPendingCount: internal.computed.ops.bookingPendingCount,
        approvalsPendingCount: internal.computed.ops.approvalsPendingCount,
        dataQualityScore: internal.computed.ops.dataQualityScore,
      },
    },
  };
}

export function listCaseDashboardRecords(input?: Partial<GlobalFilters>): CaseRecord[] {
  return listCaseEntities(input).map((entity) => toCaseDashboardRecord(entity));
}

function buildDashboardStats(cases: InternalCaseEntity[]): DashboardStats {
  const stageCounts: Record<Stage, number> = { 1: 0, 2: 0, 3: 0 };
  const stage2Cases = cases.filter((item) => item.stage === 2);
  const stage3Cases = cases.filter((item) => item.stage === 3);

  for (const item of cases) {
    stageCounts[item.stage] += 1;
  }

  const contactNeeded = cases.filter(
    (item) => item.stage === 1 && (item.status === "OPEN" || item.status === "IN_PROGRESS" || item.status === "WAITING_RESULTS"),
  ).length;

  const stage2Waiting = stage2Cases.filter((item) => !item.computed.evidence.stage2.completed).length;
  const highRiskMciCases = stage2Cases.filter(
    (item) => item.computed.model2.available && item.computed.model2.predictedLabel === "MCI" && item.computed.model2.mciBand === "위험",
  );

  const stage3Waiting = stage3Cases.filter((item) => !item.computed.evidence.stage3.completed).length;
  const churnRisk = stage3Cases.filter((item) => item.computed.model3.available && item.computed.model3.label === "HIGH").length;

  const stage2Mci = stage2Cases.filter(
    (item) => item.computed.model2.available && item.computed.model2.predictedLabel === "MCI",
  ).length;

  const mciLow = stage2Cases.filter(
    (item) => item.computed.model2.available && item.computed.model2.predictedLabel === "MCI" && item.computed.model2.mciBand === "양호",
  ).length;
  const mciMid = stage2Cases.filter(
    (item) => item.computed.model2.available && item.computed.model2.predictedLabel === "MCI" && item.computed.model2.mciBand === "중간",
  ).length;
  const mciHigh = highRiskMciCases.length;
  const mciTotal = mciLow + mciMid + mciHigh;

  const toPct = (count: number) => (mciTotal === 0 ? 0 : Math.round((count / mciTotal) * 100));

  const highRiskMciList = highRiskMciCases.slice(0, 3).map((item) => ({
    id: item.caseId,
    age: item.patient.age,
    probability: `${Math.round((item.computed.model2.probs?.AD ?? 0) * 100)}%`,
    period: item.computed.ops.bookingPendingCount ? "3개월" : "6개월",
    nextAction: "Stage3 진입 검토",
  }));

  const priorityTasks = [...cases]
    .sort((a, b) => {
      const aWeight = (a.computed.ops.missingFieldCount ?? 0) + (a.computed.ops.bookingPendingCount ?? 0) * 2;
      const bWeight = (b.computed.ops.missingFieldCount ?? 0) + (b.computed.ops.bookingPendingCount ?? 0) * 2;
      if (bWeight !== aWeight) return bWeight - aWeight;
      return b.updatedAt.localeCompare(a.updatedAt);
    })
    .slice(0, 4)
    .map((item) => ({
      id: item.caseId,
      age: item.patient.age,
      stage: stageToLegacy(item.stage),
      reason:
        item.stage === 2 && !item.computed.evidence.stage2.completed
          ? "필수 검사 입력 누락"
          : item.stage === 3 && !item.computed.evidence.stage3.completed
            ? "감별검사 결과 입력 필요"
            : "예약/연계 후속 처리 필요",
      action: item.stage >= 2 ? "연계" : "전화",
      sla: item.status === "ON_HOLD" || item.status === "WAITING_RESULTS" ? "지연" : "1h 임박",
    }));

  const stage1Count = Math.max(stageCounts[1], 1);
  const stage2Rate = Math.round((stageCounts[2] / stage1Count) * 100);
  const mciRate = Math.round((stage2Mci / stage1Count) * 100);
  const highMciRate = Math.round((highRiskMciCases.length / stage1Count) * 100);
  const stage3Rate = Math.round((stageCounts[3] / stage1Count) * 100);

  const pipelineData = [
    { name: "1차 선별", count: stageCounts[1], rate: 100, drop: 0, wait: 1.2 },
    { name: "2차 평가", count: stageCounts[2], rate: stage2Rate, drop: Math.max(0, 100 - stage2Rate), wait: 4.2 },
    { name: "MCI", count: stage2Mci, rate: mciRate, drop: Math.max(0, stage2Rate - mciRate), wait: 6.4 },
    { name: "High MCI", count: highRiskMciCases.length, rate: highMciRate, drop: Math.max(0, mciRate - highMciRate), wait: 9.1 },
    { name: "3차 감별", count: stageCounts[3], rate: stage3Rate, drop: Math.max(0, highMciRate - stage3Rate), wait: 12.5 },
  ];

  return {
    contactNeeded,
    stage2Waiting,
    highRiskMci: highRiskMciCases.length,
    stage3Waiting,
    churnRisk,
    stageCounts,
    pipelineData,
    mciDistribution: [
      { name: "Low", value: toPct(mciLow), color: "#059669" },
      { name: "Moderate", value: toPct(mciMid), color: "#d97706" },
      { name: "High", value: toPct(mciHigh), color: "#dc2626" },
    ],
    highRiskMciList,
    priorityTasks,
  };
}

export function getDashboardStats(input?: Partial<GlobalFilters>): DashboardStats {
  ensureStore();
  const merged = getMergedFilters(input);
  const cases = [...caseStore.values()].filter((entity) => includeByFilters(entity, merged));
  return buildDashboardStats(cases);
}

export function getGlobalFilters(): GlobalFilters {
  return { ...globalFilters };
}

export function setGlobalFilters(next: Partial<GlobalFilters>) {
  globalFilters = {
    ...globalFilters,
    ...next,
  };
  emitChange();
}

export function applyDrilldownFilter(trigger: string) {
  const trimmed = trigger.trim();
  if (trimmed === "Stage 1" || trimmed === "1차 선별") {
    setGlobalFilters({ stage: 1 });
    return;
  }
  if (trimmed === "Stage 2" || trimmed === "2차 평가" || trimmed === "MCI" || trimmed === "High MCI") {
    setGlobalFilters({ stage: 2 });
    return;
  }
  if (trimmed === "Stage 3" || trimmed === "3차 감별") {
    setGlobalFilters({ stage: 3 });
    return;
  }

  if (trimmed === "SLA 임박") {
    setGlobalFilters({ status: "WAITING_RESULTS" });
    return;
  }

  setGlobalFilters({ stage: "ALL", status: "ALL" });
}

export function useCaseEntities(input?: Partial<GlobalFilters>) {
  useSyncExternalStore(subscribe, getSnapshotVersion, getSnapshotVersion);
  return useMemo(() => listCaseEntities(input), [input, getSnapshotVersion()]);
}

export function useCaseEntity(caseId?: string | null) {
  useSyncExternalStore(subscribe, getSnapshotVersion, getSnapshotVersion);
  return useMemo(() => {
    if (!caseId) return null;
    return getCaseEntity(caseId);
  }, [caseId, getSnapshotVersion()]);
}

export function useCaseEvents(caseId?: string | null) {
  useSyncExternalStore(subscribe, getSnapshotVersion, getSnapshotVersion);
  return useMemo(() => {
    if (!caseId) return [];
    return listCaseEvents(caseId);
  }, [caseId, getSnapshotVersion()]);
}

export function useCaseDashboardRecords(input?: Partial<GlobalFilters>) {
  useSyncExternalStore(subscribe, getSnapshotVersion, getSnapshotVersion);
  return useMemo(() => listCaseDashboardRecords(input), [input, getSnapshotVersion()]);
}

export function useDashboardStats(input?: Partial<GlobalFilters>) {
  useSyncExternalStore(subscribe, getSnapshotVersion, getSnapshotVersion);
  return useMemo(() => getDashboardStats(input), [input, getSnapshotVersion()]);
}

export function useGlobalFilters() {
  useSyncExternalStore(subscribe, getSnapshotVersion, getSnapshotVersion);
  return useMemo(() => getGlobalFilters(), [getSnapshotVersion()]);
}
