import { useMemo, useSyncExternalStore } from "react";
import {
  CASE_RECORDS,
  type AlertTag,
  type CaseRecord,
} from "./caseRecords";
import { generateCases, type Case as SeedCase } from "../caseData";
import { reconcileStage3Case } from "../../../domain/stage3/reconcileStage3Case";
import type {
  Stage3Case as Stage3DomainCase,
  Stage3ModelStatus as Stage3DomainModelStatus,
  Stage3ReconcilePatch,
  Stage3ReconcilePolicy,
} from "../../../domain/stage3/types";

export type Stage = 1 | 2 | 3;
export type Stage2Route = "HOSPITAL" | "CENTER";
export type OperationStep = "WAITING" | "IN_PROGRESS" | "RESULT_READY" | "CLASSIFIED" | "FOLLOW_UP" | "COMPLETED";
export type ModelStatus = "PENDING" | "PROCESSING" | "DONE";
export type CaseClassification = "NORMAL" | "MCI" | "AD";
export type Stage2ResultBucket = "NORMAL" | "MCI_LOW" | "MCI_MID" | "MCI_HIGH" | "AD";
export type Stage3Type = "PREVENTIVE_TRACKING" | "AD_MANAGEMENT";
export type Stage3OriginStage2Result = "MCI-MID" | "MCI-HIGH" | "AD";

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
  operationStep: OperationStep;
  modelStatus: ModelStatus;
  classification?: CaseClassification;
  riskScore?: number;
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
  conversionRisk1y?: number;
  conversionRisk2y?: number;
  conversionRisk3y?: number;
  currentRiskIndex?: number;
  label?: "LOW" | "MID" | "HIGH";
  confidence?: "LOW" | "MID" | "HIGH";
  modelVersion?: string;
  updatedAt?: string;
};

export type CaseComputed = {
  evidence: EvidenceState;
  model2: Stage2ModelOutput;
  model3: Stage3ModelOutput;
  stage3Profile?: {
    originStage2Result: Stage3OriginStage2Result;
    originRiskScore: number;
    stage3Type: Stage3Type;
  };
  stage3Loop?: {
    step: 1 | 2 | 3 | 4;
    completed: {
      step1At?: string;
      step2At?: string;
      step3At?: string;
      step4At?: string;
    };
    status: "IN_PROGRESS" | "ON_HOLD" | "EXCLUDED" | "DONE";
    blockers: string[];
  };
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
  | "INFERENCE_REQUESTED"
  | "INFERENCE_STARTED"
  | "INFERENCE_PROGRESS"
  | "INFERENCE_COMPLETED"
  | "INFERENCE_FAILED"
  | "MODEL_RESULT_APPLIED"
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
  priorityTasks: Array<{ id: string; name: string; age: number; stage: "Stage 1" | "Stage 2" | "Stage 3"; reason: string; action: string; sla: string }>;
};

const MODEL2_VERSION = "stage2-gate-v2";
const MODEL3_VERSION = "stage3-gate-v2";
const DEFAULT_STAGE3_RECONCILE_POLICY: Stage3ReconcilePolicy = {
  autoCompleteStep1: true,
};
export const STAGE3_RECONCILE_POLICY = DEFAULT_STAGE3_RECONCILE_POLICY;
const PRIORITY_TASK_PINNED_CASE_IDS = new Set(["CASE-2026-175"]);

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

function toCaseClassification(label?: Stage2ModelOutput["predictedLabel"]): CaseClassification | undefined {
  if (!label) return undefined;
  if (label === "정상") return "NORMAL";
  if (label === "치매") return "AD";
  return "MCI";
}

function stage2BucketToLabel(bucket: Stage2ResultBucket): "정상" | "MCI" | "치매" {
  if (bucket === "AD") return "치매";
  if (bucket === "NORMAL") return "정상";
  return "MCI";
}

function stage2BucketToMciBand(bucket: Stage2ResultBucket): "양호" | "중간" | "위험" | undefined {
  if (bucket === "MCI_LOW") return "양호";
  if (bucket === "MCI_MID") return "중간";
  if (bucket === "MCI_HIGH") return "위험";
  return undefined;
}

function deriveStage2ResultBucketFromModel(model: Stage2ModelOutput): Stage2ResultBucket {
  if (!model.available || !model.predictedLabel) return "NORMAL";
  if (model.predictedLabel === "치매") return "AD";
  if (model.predictedLabel === "정상") return "NORMAL";
  if (model.mciBand === "위험") return "MCI_HIGH";
  if (model.mciBand === "중간") return "MCI_MID";
  return "MCI_LOW";
}

function toStage3OriginStage2Result(bucket: Stage2ResultBucket): Stage3OriginStage2Result | null {
  if (bucket === "MCI_MID") return "MCI-MID";
  if (bucket === "MCI_HIGH") return "MCI-HIGH";
  if (bucket === "AD") return "AD";
  return null;
}

function stage3TypeFromOrigin(origin: Stage3OriginStage2Result): Stage3Type {
  return origin === "AD" ? "AD_MANAGEMENT" : "PREVENTIVE_TRACKING";
}

function isStage3EligibleOrigin(origin: Stage3OriginStage2Result | null): origin is Stage3OriginStage2Result {
  return origin != null;
}

function stage3RiskBase(model3: Stage3ModelOutput, stage3Type: Stage3Type): number {
  if (stage3Type === "AD_MANAGEMENT") {
    return clamp01(model3.currentRiskIndex ?? model3.risk2yNow ?? model3.conversionRisk2y ?? 0);
  }
  return clamp01(model3.conversionRisk2y ?? model3.risk2yNow ?? model3.currentRiskIndex ?? 0);
}

function mapCaseStatusToStage3LoopStatus(
  status: CaseStatus,
): "IN_PROGRESS" | "ON_HOLD" | "EXCLUDED" | "DONE" {
  if (status === "ON_HOLD") return "ON_HOLD";
  if (status === "EXCLUDED") return "EXCLUDED";
  if (status === "CLOSED") return "DONE";
  return "IN_PROGRESS";
}

function mapStage3DomainStatusToModelStatus(status: Stage3DomainModelStatus): ModelStatus {
  if (status === "RUNNING" || status === "QUEUED") return "PROCESSING";
  if (status === "READY") return "DONE";
  return "PENDING";
}

function mapModelStatusToStage3DomainStatus(
  status: ModelStatus,
  hasModelResult: boolean,
): Stage3DomainModelStatus {
  if (hasModelResult) return "READY";
  if (status === "PROCESSING") return "RUNNING";
  return "NOT_READY";
}

function inferStage3LoopStepFromCompletion(completed: {
  step1At?: string;
  step2At?: string;
  step3At?: string;
  step4At?: string;
}): 1 | 2 | 3 | 4 {
  const step1 = Boolean(completed.step1At);
  const step2 = step1 && Boolean(completed.step2At);
  const step3 = step2 && Boolean(completed.step3At);
  const step4 = step3 && Boolean(completed.step4At);
  if (step4) return 4;
  if (step3) return 4;
  if (step2) return 3;
  if (step1) return 2;
  return 1;
}

function ensureStage3LoopShape(entity: Pick<CaseEntity, "stage" | "status" | "computed" | "operationStep" | "updatedAt">) {
  if (entity.stage !== 3) return;
  if (!entity.computed.stage3Loop) {
    entity.computed.stage3Loop = {
      step: 1,
      completed: {},
      status: mapCaseStatusToStage3LoopStatus(entity.status),
      blockers: [],
    };
  }

  entity.computed.stage3Loop.status = mapCaseStatusToStage3LoopStatus(entity.status);

  const completed = entity.computed.stage3Loop.completed;
  if (entity.computed.evidence.stage3.completed && !completed.step2At) {
    completed.step2At = entity.computed.evidence.stage3.required.performedAt ?? entity.updatedAt;
  }
  if (entity.computed.model3.available && !completed.step3At) {
    completed.step3At = entity.computed.model3.updatedAt ?? entity.updatedAt;
  }
  if (entity.status === "CLOSED" && !completed.step4At) {
    completed.step4At = entity.updatedAt;
  }

  entity.computed.stage3Loop.step = inferStage3LoopStepFromCompletion(completed);
}

function toStage3DomainCaseFromInternal(entity: InternalCaseEntity): Stage3DomainCase | null {
  if (entity.stage !== 3) return null;
  ensureStage3LoopShape(entity);
  const loop = entity.computed.stage3Loop;
  if (!loop) return null;
  const profile = entity.computed.stage3Profile;
  const risk2y = stage3RiskBase(entity.computed.model3, profile?.stage3Type ?? "PREVENTIVE_TRACKING");

  return {
    caseId: entity.caseId,
    updatedAt: entity.updatedAt,
    model: {
      status: mapModelStatusToStage3DomainStatus(entity.modelStatus, entity.computed.model3.available),
      result: entity.computed.model3.available
        ? {
            risk_1y_ad: entity.computed.model3.conversionRisk1y,
            risk_2y_ad: risk2y,
            risk_3y_ad: entity.computed.model3.conversionRisk3y,
            computedAt: entity.computed.model3.updatedAt ?? entity.updatedAt,
            modelVersion: entity.computed.model3.modelVersion ?? MODEL3_VERSION,
          }
        : null,
    },
    loop: {
      step: loop.step,
      completed: { ...loop.completed },
      status: loop.status,
      blockers: [...loop.blockers],
    },
    profile: profile
      ? {
          originStage2Result: profile.originStage2Result,
          originRiskScore: profile.originRiskScore,
          stage3Type: profile.stage3Type,
        }
      : undefined,
  };
}

export function toStage3DomainCase(entity: CaseEntity): Stage3DomainCase | null {
  if (entity.stage !== 3) return null;

  const loop = entity.computed.stage3Loop;
  const completed = loop?.completed ?? {};
  const profile = entity.computed.stage3Profile;
  const risk2y = stage3RiskBase(entity.computed.model3, profile?.stage3Type ?? "PREVENTIVE_TRACKING");

  return {
    caseId: entity.caseId,
    updatedAt: entity.updatedAt,
    model: {
      status: mapModelStatusToStage3DomainStatus(entity.modelStatus, entity.computed.model3.available),
      result: entity.computed.model3.available
        ? {
            risk_1y_ad: entity.computed.model3.conversionRisk1y,
            risk_2y_ad: risk2y,
            risk_3y_ad: entity.computed.model3.conversionRisk3y,
            computedAt: entity.computed.model3.updatedAt ?? entity.updatedAt,
            modelVersion: entity.computed.model3.modelVersion ?? MODEL3_VERSION,
          }
        : null,
    },
    loop: {
      step: loop?.step ?? inferStage3LoopStepFromCompletion(completed),
      completed: { ...completed },
      status: loop?.status ?? mapCaseStatusToStage3LoopStatus(entity.status),
      blockers: loop?.blockers ? [...loop.blockers] : [],
    },
    profile: profile
      ? {
          originStage2Result: profile.originStage2Result,
          originRiskScore: profile.originRiskScore,
          stage3Type: profile.stage3Type,
        }
      : undefined,
  };
}

function applyStage3DomainCaseToInternal(entity: InternalCaseEntity, stage3Domain: Stage3DomainCase) {
  if (stage3Domain.profile) {
    entity.computed.stage3Profile = {
      originStage2Result: stage3Domain.profile.originStage2Result,
      originRiskScore: stage3Domain.profile.originRiskScore,
      stage3Type: stage3Domain.profile.stage3Type,
    };
  }

  entity.computed.stage3Loop = {
    step: stage3Domain.loop.step,
    completed: { ...stage3Domain.loop.completed },
    status: stage3Domain.loop.status,
    blockers: [...stage3Domain.loop.blockers],
  };

  entity.modelStatus = mapStage3DomainStatusToModelStatus(stage3Domain.model.status);

  if (stage3Domain.model.status !== "READY" || !stage3Domain.model.result) {
    entity.computed.model3 = { available: false };
    entity.riskScore = undefined;
  } else {
    const prev = entity.computed.model3;
    const stage3Type = entity.computed.stage3Profile?.stage3Type ?? "PREVENTIVE_TRACKING";
    const risk2y = clamp01(stage3Domain.model.result.risk_2y_ad);
    const risk1y =
      stage3Domain.model.result.risk_1y_ad == null
        ? stage3Type === "AD_MANAGEMENT"
          ? undefined
          : clamp01(risk2y - 0.06)
        : clamp01(stage3Domain.model.result.risk_1y_ad);
    const risk3y =
      stage3Domain.model.result.risk_3y_ad == null
        ? stage3Type === "AD_MANAGEMENT"
          ? undefined
          : clamp01(risk2y + 0.09)
        : clamp01(stage3Domain.model.result.risk_3y_ad);

    entity.computed.model3 = {
      available: true,
      risk2yNow: risk2y,
      risk2yAt2y: stage3Type === "AD_MANAGEMENT" ? undefined : risk3y ?? prev.risk2yAt2y,
      conversionRisk1y: stage3Type === "AD_MANAGEMENT" ? undefined : risk1y,
      conversionRisk2y: stage3Type === "AD_MANAGEMENT" ? undefined : risk2y,
      conversionRisk3y: stage3Type === "AD_MANAGEMENT" ? undefined : risk3y,
      currentRiskIndex: stage3Type === "AD_MANAGEMENT" ? risk2y : undefined,
      label:
        risk2y >= 0.7
          ? "HIGH"
          : risk2y >= 0.45
            ? "MID"
            : "LOW",
      confidence: prev.confidence ?? "MID",
      modelVersion: stage3Domain.model.result.modelVersion,
      updatedAt: stage3Domain.model.result.computedAt,
    };
    entity.riskScore = Math.round(stage3RiskBase(entity.computed.model3, stage3Type) * 100);
  }

  if (stage3Domain.loop.status === "ON_HOLD") {
    entity.status = "ON_HOLD";
  } else if (stage3Domain.loop.status === "EXCLUDED") {
    entity.status = "EXCLUDED";
  } else if (stage3Domain.loop.status === "DONE") {
    entity.status = "CLOSED";
  } else if (entity.status === "ON_HOLD" || entity.status === "EXCLUDED") {
    entity.status = "IN_PROGRESS";
  }

  if (entity.status === "CLOSED") {
    entity.operationStep = "COMPLETED";
  } else if (entity.modelStatus === "DONE") {
    entity.operationStep = "FOLLOW_UP";
  } else if (stage3Domain.loop.step >= 2) {
    entity.operationStep = "IN_PROGRESS";
  } else {
    entity.operationStep = "WAITING";
  }
}

function reconcileInternalStage3Case(
  entity: InternalCaseEntity,
  policy: Stage3ReconcilePolicy = DEFAULT_STAGE3_RECONCILE_POLICY,
) {
  if (entity.stage !== 3) {
    return { nextCase: entity, patches: [] as Stage3ReconcilePatch[], inconsistencyFlags: [] as string[], auditLog: undefined };
  }

  const stage3Domain = toStage3DomainCaseFromInternal(entity);
  if (!stage3Domain) {
    return { nextCase: entity, patches: [] as Stage3ReconcilePatch[], inconsistencyFlags: [] as string[], auditLog: undefined };
  }

  const reconciled = reconcileStage3Case(stage3Domain, policy);
  if (reconciled.patches.length === 0) {
    return { ...reconciled, nextCase: entity };
  }

  const next = cloneCase(entity);
  applyStage3DomainCaseToInternal(next, reconciled.nextCase);
  return { ...reconciled, nextCase: next };
}

function stageModelReadyStep(stage: Stage): OperationStep {
  if (stage === 1) return "CLASSIFIED";
  if (stage === 2) return "RESULT_READY";
  return "FOLLOW_UP";
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

  // Demo baseline: make Stage2 outputs form a realistic NORMAL/MCI/AD mix.
  const severityBase = clamp01(riskWeight * 0.42 + cdrWeight * 0.31 + mmseWeight * 0.17 + neuroWeight * 0.1);
  const severity = clamp01(severityBase + (signalSeed - 0.5) * 0.12);
  const normalRaw = clamp01((0.72 - severity) * 1.6);
  const mciRaw = clamp01(1 - Math.abs(severity - 0.5) * 2.2);
  const adRaw = clamp01((severity - 0.33) * 1.7);
  let probs = normalizeProbs({
    NORMAL: 0.12 + normalRaw,
    MCI: 0.16 + mciRaw,
    AD: 0.1 + adRaw,
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

function generateStage3Model(entity: InternalCaseEntity, riskOverride?: number): Stage3ModelOutput {
  const seed = seeded(`${entity.caseId}-model3`);
  const stage2Label = entity.computed.model2.predictedLabel;
  const required = entity.computed.evidence.stage3.required;
  const stage3Type = entity.computed.stage3Profile?.stage3Type ?? (stage2Label === "치매" ? "AD_MANAGEMENT" : "PREVENTIVE_TRACKING");

  let base = stage2Label === "치매" ? 0.7 : stage2Label === "MCI" ? 0.52 : 0.28;
  if (required.biomarkerResult === "POS") base += 0.14;
  if (required.biomarkerResult === "NEG") base -= 0.08;
  if (required.biomarkerResult === "UNK") base += 0.03;

  if (required.imagingResult === "POS") base += 0.14;
  if (required.imagingResult === "NEG") base -= 0.07;
  if (required.imagingResult === "UNK") base += 0.03;

  if (entity.status === "ON_HOLD") base += 0.06;
  if (entity.status === "CLOSED") base -= 0.05;

  const currentRiskIndex = riskOverride == null ? clamp01(base + (seed - 0.5) * 0.08) : clamp01(riskOverride);
  const conversionRisk1y = clamp01(currentRiskIndex - 0.06 + (seed - 0.5) * 0.03);
  const conversionRisk2y = currentRiskIndex;
  const conversionRisk3y = clamp01(currentRiskIndex + 0.09 + (seed - 0.5) * 0.05);
  const labelBase = stage3Type === "AD_MANAGEMENT" ? currentRiskIndex : conversionRisk2y;
  const label: Stage3ModelOutput["label"] = labelBase >= 0.7 ? "HIGH" : labelBase >= 0.45 ? "MID" : "LOW";

  let confidence: Stage3ModelOutput["confidence"] = "HIGH";
  if (required.biomarkerResult === "UNK" || required.imagingResult === "UNK") confidence = "MID";
  if (!required.performedAt) confidence = "LOW";

  return {
    available: true,
    risk2yNow: stage3Type === "AD_MANAGEMENT" ? currentRiskIndex : conversionRisk2y,
    risk2yAt2y: stage3Type === "AD_MANAGEMENT" ? undefined : conversionRisk3y,
    conversionRisk1y: stage3Type === "AD_MANAGEMENT" ? undefined : conversionRisk1y,
    conversionRisk2y: stage3Type === "AD_MANAGEMENT" ? undefined : conversionRisk2y,
    conversionRisk3y: stage3Type === "AD_MANAGEMENT" ? undefined : conversionRisk3y,
    currentRiskIndex: stage3Type === "AD_MANAGEMENT" ? currentRiskIndex : undefined,
    label,
    confidence,
    modelVersion: stage3Type === "AD_MANAGEMENT" ? "stage3-ad-management-v1.0" : "stage3-risk-v1.3",
    updatedAt: nowIso(),
  };
}

function assignStage3ProfileFromStage2(entity: InternalCaseEntity) {
  const bucket = deriveStage2ResultBucketFromModel(entity.computed.model2);
  const origin = toStage3OriginStage2Result(bucket);
  if (!isStage3EligibleOrigin(origin)) {
    entity.computed.stage3Profile = undefined;
    return null;
  }

  const originRiskScore = Math.round((entity.computed.model2.probs?.AD ?? 0) * 100);
  const stage3Type = stage3TypeFromOrigin(origin);
  entity.computed.stage3Profile = {
    originStage2Result: origin,
    originRiskScore,
    stage3Type,
  };
  return entity.computed.stage3Profile;
}

function stage2BucketFromSeed(seedValue: number): Stage2ResultBucket {
  if (seedValue < 0.3) return "NORMAL";
  if (seedValue < 0.48) return "MCI_LOW";
  if (seedValue < 0.68) return "MCI_MID";
  if (seedValue < 0.82) return "MCI_HIGH";
  return "AD";
}

function cloneCase(entity: InternalCaseEntity): InternalCaseEntity {
  return JSON.parse(JSON.stringify(entity)) as InternalCaseEntity;
}

function recomputeCase(entity: InternalCaseEntity): InternalCaseEntity {
  const next = cloneCase(entity);
  const stage2Eval = evaluateStage2Evidence(next.computed.evidence.stage2.required, next.stage2Route);
  const stage3Eval = evaluateStage3Evidence(next.computed.evidence.stage3.required);
  const stage3Profile = assignStage3ProfileFromStage2(next);

  next.computed.evidence.stage2.completed = stage2Eval.completed;
  next.computed.evidence.stage2.missing = stage2Eval.missing;
  next.computed.evidence.stage3.completed = stage3Eval.completed;
  next.computed.evidence.stage3.missing = stage3Eval.missing;
  ensureStage3LoopShape(next);

  // 모델 결과는 실행 완료 이벤트로 생성되며, 증거 누락이 생겨도 기존 산출값은 유지한다.
  if (!next.computed.model2.available) {
    next.computed.model2 = { available: false };
  }
  if (!next.computed.model3.available) {
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

  if (next.stage >= 3 && next.computed.model3.available) {
    next.modelStatus = "DONE";
    next.operationStep = next.operationStep === "COMPLETED" ? "COMPLETED" : "FOLLOW_UP";
    next.riskScore = Math.round(stage3RiskBase(next.computed.model3, stage3Profile?.stage3Type ?? "PREVENTIVE_TRACKING") * 100);
  } else if (next.stage >= 2 && next.computed.model2.available) {
    next.modelStatus = "DONE";
    if (next.operationStep !== "CLASSIFIED" && next.operationStep !== "COMPLETED") {
      next.operationStep = "RESULT_READY";
    }
    next.classification = toCaseClassification(next.computed.model2.predictedLabel);
    next.riskScore = Math.round((next.computed.model2.probs?.AD ?? 0) * 100);
  } else if (next.modelStatus !== "PROCESSING") {
    next.modelStatus = "PENDING";
  }

  return reconcileInternalStage3Case(next).nextCase;
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

function normalizeAssigneeId(manager: string): string | undefined {
  const normalized = manager.trim();
  if (normalized.length === 0 || normalized.includes("미지정")) return undefined;
  return normalized;
}

function toInternalCase(record: CaseRecord): InternalCaseEntity {
  const stage = stageFromLegacy(record.stage);
  const route = routeFromLegacy(record);
  const createdAt = parseLegacyDateTime(record.updated);

  const base: InternalCaseEntity = {
    caseId: record.id,
    stage,
    assigneeId: normalizeAssigneeId(record.manager),
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
    operationStep: stage === 1 ? "IN_PROGRESS" : stage === 2 ? "IN_PROGRESS" : "FOLLOW_UP",
    modelStatus: "PENDING",
    classification: undefined,
    riskScore: undefined,
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
        contactMode: record.path.includes("문자") || record.action.includes("문자") ? "AGENT" : "HUMAN",
        lastContactAt: parseLegacyDateTime(record.updated),
        bookingPendingCount: record.alertTags.includes("연계 대기") ? 1 : 0,
        approvalsPendingCount: record.status === "임박" ? 1 : 0,
      },
    },
  };
  const seededEntity = recomputeCase(base);
  const scenarioBucket = Math.floor(seeded(`${record.id}-stage-scenario`) * 4);

  if (seededEntity.stage === 2) {
    const bucket = stage2BucketFromSeed(seeded(`${record.id}-stage2-bucket`));
    const targetLabel = stage2BucketToLabel(bucket);
    const targetBand = stage2BucketToMciBand(bucket);
    const severitySeed = seeded(`${record.id}-stage2-severity-bias`);
    let finalLabel: "정상" | "MCI" | "치매" = targetLabel;
    let finalBand: "양호" | "중간" | "위험" | undefined = targetBand;
    if (targetLabel === "MCI" && severitySeed > 0.72) {
      finalLabel = "치매";
      finalBand = undefined;
    } else if (targetLabel === "MCI" && severitySeed < 0.22) {
      finalLabel = "정상";
      finalBand = undefined;
    }
    const progressSeed = seeded(`${record.id}-stage2-progress`);
    const keepPending = progressSeed < 0.14;
    const waitingForInput = keepPending && (scenarioBucket === 0 || bucket === "MCI_LOW");

    if (keepPending) {
      seededEntity.computed.model2 = { available: false };
      seededEntity.computed.stage3Profile = undefined;
      seededEntity.modelStatus = "PENDING";
      seededEntity.status = waitingForInput ? "WAITING_RESULTS" : "IN_PROGRESS";
      seededEntity.operationStep = waitingForInput ? "WAITING" : "IN_PROGRESS";
    } else {
      // 완료율은 높지만 일부 케이스는 자료 누락이 남도록 유지한다.
      seededEntity.computed.evidence.stage2.required = {
        ...seededEntity.computed.evidence.stage2.required,
        specialist: true,
        mmse:
          seededEntity.computed.evidence.stage2.required.mmse ??
          (finalLabel === "치매" ? 20 : finalLabel === "MCI" ? 24 : 27),
        cdrOrGds:
          seededEntity.computed.evidence.stage2.required.cdrOrGds ??
          (scenarioBucket === 1 ? null : finalLabel === "치매" ? 1.6 : finalLabel === "MCI" ? 0.7 : 0.2),
      };
      seededEntity.computed.model2 = generateStage2Model(seededEntity, finalLabel, finalBand);
      seededEntity.modelStatus = "DONE";
      assignStage3ProfileFromStage2(seededEntity);

      if (progressSeed < 0.46) {
        seededEntity.status = "READY_TO_CLASSIFY";
        seededEntity.operationStep = "RESULT_READY";
      } else if (progressSeed < 0.8) {
        seededEntity.status = "CLASS_CONFIRMED";
        seededEntity.operationStep = "CLASSIFIED";
      } else {
        seededEntity.status = "NEXT_STEP_SET";
        seededEntity.operationStep = "COMPLETED";
      }
    }
  }

  if (seededEntity.stage === 3) {
    const originRoll = seeded(`${record.id}-stage3-origin`);
    const origin: Stage3OriginStage2Result = originRoll < 0.4 ? "MCI-MID" : originRoll < 0.75 ? "MCI-HIGH" : "AD";
    seededEntity.computed.stage3Profile = {
      originStage2Result: origin,
      originRiskScore: origin === "AD" ? 82 : origin === "MCI-HIGH" ? 64 : 47,
      stage3Type: stage3TypeFromOrigin(origin),
    };
    seededEntity.computed.model2 = generateStage2Model(
      seededEntity,
      origin === "AD" ? "치매" : "MCI",
      origin === "MCI-HIGH" ? "위험" : origin === "MCI-MID" ? "중간" : undefined,
    );

    const riskPreset = [0.15, 0.35, 0.67, 0.88][scenarioBucket] ?? 0.35;
    seededEntity.computed.model3 = generateStage3Model(seededEntity, riskPreset);
    seededEntity.modelStatus = "DONE";
    seededEntity.operationStep = "FOLLOW_UP";
    seededEntity.riskScore = Math.round(stage3RiskBase(seededEntity.computed.model3, seededEntity.computed.stage3Profile.stage3Type) * 100);
  }

  if (seededEntity.stage === 1) {
    if (seededEntity.status === "CLOSED") {
      seededEntity.operationStep = "COMPLETED";
    } else {
      const stage1ProgressSeed = seeded(`${record.id}-stage1-progress`);
      const shouldWait =
        seededEntity.status === "WAITING_RESULTS" ? stage1ProgressSeed < 0.45 : stage1ProgressSeed < 0.12;
      seededEntity.operationStep = shouldWait ? "WAITING" : "IN_PROGRESS";
    }
  }

  if (record.id === "CASE-2026-175") {
    seededEntity.stage = 1;
    seededEntity.status = "WAITING_RESULTS";
    seededEntity.operationStep = "WAITING";
    seededEntity.modelStatus = "PENDING";
    seededEntity.classification = undefined;
    seededEntity.riskScore = undefined;
    seededEntity.computed.model2 = { available: false };
    seededEntity.computed.model3 = { available: false };
    seededEntity.computed.stage3Profile = undefined;
    seededEntity.computed.evidence.stage2.required = {
      specialist: false,
      mmse: null,
      cdrOrGds: null,
      neuroType: null,
      neuroScore: null,
    };
    seededEntity.computed.evidence.stage3.required = {
      biomarker: false,
      imaging: false,
      biomarkerResult: null,
      imagingResult: null,
      performedAt: null,
    };
    seededEntity.computed.ops.contactMode = "HUMAN";
    seededEntity.computed.ops.bookingPendingCount = 1;
    seededEntity.computed.ops.approvalsPendingCount = 0;
  }

  if (record.id === "CASE-2026-275") {
    seededEntity.stage = 2;
    seededEntity.stage2Route = "HOSPITAL";
    seededEntity.status = "WAITING_RESULTS";
    seededEntity.operationStep = "WAITING";
    seededEntity.modelStatus = "PENDING";
    seededEntity.classification = undefined;
    seededEntity.riskScore = undefined;
    seededEntity.computed.evidence.stage2.required = {
      specialist: false,
      mmse: null,
      cdrOrGds: null,
      neuroType: null,
      neuroScore: null,
    };
    seededEntity.computed.model2 = { available: false };
    seededEntity.computed.model3 = { available: false };
    seededEntity.computed.stage3Profile = undefined;
    seededEntity.computed.ops.bookingPendingCount = 1;
    seededEntity.computed.ops.approvalsPendingCount = 0;
  }

  if (record.id === "CASE-2026-375") {
    seededEntity.stage = 3;
    seededEntity.stage2Route = "HOSPITAL";
    seededEntity.status = "WAITING_RESULTS";
    seededEntity.operationStep = "WAITING";
    seededEntity.modelStatus = "PENDING";
    seededEntity.classification = "MCI";
    seededEntity.riskScore = undefined;
    seededEntity.computed.evidence.stage2.required = {
      specialist: true,
      mmse: 23,
      cdrOrGds: 1,
      neuroType: "SNSB-II",
      neuroScore: 58,
    };
    seededEntity.computed.model2 = { available: false };
    seededEntity.computed.stage3Profile = {
      originStage2Result: "MCI-HIGH",
      originRiskScore: 64,
      stage3Type: "PREVENTIVE_TRACKING",
    };
    seededEntity.computed.evidence.stage3.required = {
      biomarker: false,
      imaging: false,
      biomarkerResult: null,
      imagingResult: null,
      performedAt: null,
    };
    seededEntity.computed.model3 = { available: false };
    seededEntity.computed.ops.bookingPendingCount = 1;
    seededEntity.computed.ops.approvalsPendingCount = 0;
  }

  return recomputeCase(seededEntity);
}

function mapSeedRisk(riskLevel: SeedCase["riskLevel"]): CaseRecord["risk"] {
  if (riskLevel === "high") return "고";
  if (riskLevel === "medium") return "중";
  return "저";
}

function deriveStageFromSeed(seed: SeedCase): CaseRecord["stage"] {
  if (seed.secondExamStatus === "DONE" || seed.secondExamStatus === "RESULT_CONFIRMED") return "Stage 3";
  if (seed.consultStatus === "DONE" || seed.reservation || seed.secondExamStatus === "SCHEDULED") return "Stage 2";
  return "Stage 1";
}

function deriveStatusFromSeed(seed: SeedCase, stage: CaseRecord["stage"]): CaseRecord["status"] {
  if (seed.contactStatus === "UNREACHED") return "대기";
  if (stage === "Stage 3") {
    if (seed.secondExamStatus === "RESULT_CONFIRMED") return "완료";
    if (seed.riskLevel === "high") return "지연";
    return "임박";
  }
  if (stage === "Stage 2") {
    if (seed.consultStatus === "DONE" && seed.secondExamStatus !== "NONE") return "임박";
    return "진행중";
  }
  return seed.consultStatus === "DONE" ? "진행중" : "대기";
}

function deriveQualityFromSeed(seed: SeedCase): CaseRecord["quality"] {
  if (seed.riskScore >= 70) return "경고";
  if (seed.riskScore >= 45) return "주의";
  return "양호";
}

function derivePathFromSeed(seed: SeedCase, stage: CaseRecord["stage"]): string {
  if (stage === "Stage 1") {
    const stage1Seed = seeded(`${seed.patientName}-${seed.age}-stage1-path`);
    if (seed.contactStatus === "UNREACHED") {
      if (stage1Seed < 0.45) return "문자 안내 우선";
      if (seed.guardianPhone && stage1Seed < 0.75) return "보호자 우선 접촉";
      return "재접촉 강화";
    }
    if (stage1Seed < 0.25) return "문자 안내 우선";
    if (seed.guardianPhone && stage1Seed < 0.45) return "보호자 우선 접촉";
    if (seed.riskLevel === "high") return "상담사 우선 접촉";
    return "초기 접촉 집중";
  }
  if (stage === "Stage 2") {
    if (seed.secondExamStatus === "NONE") return "검사결과 입력 대기";
    if (seed.riskLevel === "high") return "AD 감별 경로";
    if (seed.riskLevel === "low") return "정상(CN) 추적 경로";
    return "MCI 경로";
  }
  if (seed.secondExamStatus === "RESULT_CONFIRMED") return "정밀관리 경로";
  return "재평가 준비";
}

function deriveActionFromSeed(
  seed: SeedCase,
  stage: CaseRecord["stage"],
  status: CaseRecord["status"],
  path: CaseRecord["path"],
): string {
  if (stage === "Stage 1") {
    if (path.includes("문자")) {
      return status === "대기" ? "문자 안내 발송" : status === "완료" ? "문자 발송 결과 확인" : "문자 리마인드 발송";
    }
    if (path.includes("보호자")) {
      return status === "대기" ? "보호자 연락 시도" : "보호자 안내 연락";
    }
    if (seed.riskLevel === "high") {
      return status === "대기" ? "1차 전화 재시도" : "상담사 직접 연락";
    }
    return status === "대기" ? "재연락 실행" : "상담 진행";
  }
  if (stage === "Stage 2") {
    return seed.secondExamStatus === "NONE" ? "검사 결과 입력" : "분류 확정";
  }
  return seed.secondExamStatus === "RESULT_CONFIRMED" ? "추적 계획 확정" : "재평가 일정 생성";
}

function deriveManagerFromSeed(seed: SeedCase): string {
  const ownerSeed = seeded(`${seed.patientName}-${seed.registeredDate}-owner`);
  if (ownerSeed < 0.08) {
    return "담당자 미지정";
  }
  return seed.counselor;
}

function deriveAlertTagsFromSeed(seed: SeedCase, stage: CaseRecord["stage"], status: CaseRecord["status"]): AlertTag[] {
  const tags = new Set<AlertTag>();
  if (status === "대기" || status === "임박" || status === "지연") tags.add("SLA 임박");
  if (stage !== "Stage 1" && !seed.reservation) tags.add("연계 대기");
  if (stage === "Stage 2" && seed.secondExamStatus === "NONE") tags.add("MCI 미등록");
  if (stage === "Stage 3" && seed.secondExamStatus !== "RESULT_CONFIRMED") tags.add("재평가 필요");
  if (stage === "Stage 3" && seed.riskLevel === "high") tags.add("이탈 위험");
  if (stage === "Stage 2" && seed.riskLevel === "high" && seed.secondExamStatus !== "NONE") tags.add("High MCI");
  return [...tags];
}

function toSeedCaseRecord(seed: SeedCase, index: number): CaseRecord {
  const stage = deriveStageFromSeed(seed);
  const status = deriveStatusFromSeed(seed, stage);
  const path = derivePathFromSeed(seed, stage);
  const manager = deriveManagerFromSeed(seed);
  const id = `CASE-2026-${String(101 + index).padStart(3, "0")}`;
  const hour = String(9 + (index % 9)).padStart(2, "0");
  const minute = index % 2 === 0 ? "00" : "30";

  return {
    id,
    stage,
    risk: mapSeedRisk(seed.riskLevel),
    path,
    status,
    manager,
    action: deriveActionFromSeed(seed, stage, status, path),
    updated: `${seed.registeredDate} ${hour}:${minute}`,
    quality: deriveQualityFromSeed(seed),
    profile: {
      name: seed.patientName,
      age: seed.age,
      phone: seed.phone,
      guardianPhone: seed.guardianPhone,
    },
    alertTags: deriveAlertTagsFromSeed(seed, stage, status),
  };
}

function normalizePhoneNumber(value?: string) {
  return (value ?? "").replace(/\D/g, "");
}

function caseIdentityKey(record: CaseRecord) {
  const name = record.profile.name.trim().toLowerCase();
  const age = String(record.profile.age);
  const phone = normalizePhoneNumber(record.profile.phone);
  const guardianPhone = normalizePhoneNumber(record.profile.guardianPhone);
  if (phone.length > 0) return `${name}|${phone}`;
  if (guardianPhone.length > 0) return `${name}|g:${guardianPhone}`;
  return `${name}|age:${age}`;
}

function isAssignedManagerName(manager: string) {
  const normalized = manager.trim();
  return normalized.length > 0 && !normalized.includes("미지정");
}

function harmonizeCaseManagers(records: CaseRecord[]) {
  const managerByIdentity = new Map<string, string>();

  for (const record of records) {
    if (!isAssignedManagerName(record.manager)) continue;
    const key = caseIdentityKey(record);
    if (!managerByIdentity.has(key)) {
      managerByIdentity.set(key, record.manager);
    }
  }

  return records.map((record) => {
    const normalizedManager = managerByIdentity.get(caseIdentityKey(record));
    if (!normalizedManager || normalizedManager === record.manager) return record;
    return {
      ...record,
      manager: normalizedManager,
    };
  });
}

function buildStage1VarietyRecords(): CaseRecord[] {
  return [
    {
      id: "CASE-2026-901",
      stage: "Stage 1",
      risk: "저",
      path: "문자 안내 우선",
      status: "대기",
      manager: "박민지",
      action: "문자 안내 발송",
      updated: "2026-02-19 09:05",
      quality: "양호",
      profile: { name: "데모대상 A", age: 68, phone: "010-8801-1101", guardianPhone: "010-9922-3301" },
      alertTags: ["SLA 임박"],
    },
    {
      id: "CASE-2026-902",
      stage: "Stage 1",
      risk: "중",
      path: "문자 안내 우선",
      status: "임박",
      manager: "이동욱",
      action: "문자 리마인드 발송",
      updated: "2026-02-19 08:40",
      quality: "주의",
      profile: { name: "데모대상 B", age: 74, phone: "010-8801-1102" },
      alertTags: ["SLA 임박", "연계 대기"],
    },
    {
      id: "CASE-2026-903",
      stage: "Stage 1",
      risk: "고",
      path: "사전 기준 점검",
      status: "임박",
      manager: "담당자 미지정",
      action: "채널 검증 필요",
      updated: "2026-02-19 08:20",
      quality: "경고",
      profile: { name: "데모대상 C", age: 81, phone: "", guardianPhone: "010-9922-3303" },
      alertTags: ["SLA 임박", "연계 대기"],
    },
    {
      id: "CASE-2026-904",
      stage: "Stage 1",
      risk: "중",
      path: "사전 기준 점검",
      status: "대기",
      manager: "담당자 미지정",
      action: "담당 배정 필요",
      updated: "2026-02-19 07:55",
      quality: "주의",
      profile: { name: "데모대상 D", age: 72, phone: "010-8801-1104" },
      alertTags: ["SLA 임박"],
    },
    {
      id: "CASE-2026-905",
      stage: "Stage 1",
      risk: "고",
      path: "상담사 우선 접촉",
      status: "지연",
      manager: "서지윤",
      action: "1차 전화 재시도",
      updated: "2026-02-19 07:25",
      quality: "경고",
      profile: { name: "데모대상 E", age: 84, phone: "010-8801-1105", guardianPhone: "010-9922-3305" },
      alertTags: ["SLA 임박", "재평가 필요"],
    },
    {
      id: "CASE-2026-906",
      stage: "Stage 1",
      risk: "중",
      path: "보호자 우선 접촉",
      status: "진행중",
      manager: "한수민",
      action: "보호자 통화 완료 후 안내",
      updated: "2026-02-19 06:50",
      quality: "주의",
      profile: { name: "데모대상 F", age: 76, phone: "010-8801-1106", guardianPhone: "010-9922-3306" },
      alertTags: ["연계 대기"],
    },
    {
      id: "CASE-2026-907",
      stage: "Stage 1",
      risk: "저",
      path: "문자 안내 우선",
      status: "완료",
      manager: "최유리",
      action: "문자 발송 결과 확인",
      updated: "2026-02-19 06:10",
      quality: "양호",
      profile: { name: "데모대상 G", age: 65, phone: "010-8801-1107" },
      alertTags: [],
    },
  ];
}

function buildSeedCaseRecords() {
  const records = [...CASE_RECORDS];
  const extra = generateCases().slice(0, 50).map((seed, index) => toSeedCaseRecord(seed, index));
  const stage1Variety = buildStage1VarietyRecords();
  const existingIds = new Set(records.map((item) => item.id));

  for (const item of [...extra, ...stage1Variety]) {
    if (!existingIds.has(item.id)) {
      records.push(item);
    }
  }
  return harmonizeCaseManagers(records);
}

function ensureStore() {
  if (caseStore.size > 0) return;

  for (const record of buildSeedCaseRecords()) {
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

function hasEvent(events: CaseEvent[], ...types: EventType[]) {
  return events.some((event) => types.includes(event.type));
}

function syncCaseLifecycle(draft: InternalCaseEntity, events: CaseEvent[]): InternalCaseEntity {
  const next = cloneCase(draft);

  const inferenceRequested = hasEvent(events, "INFERENCE_REQUESTED");
  const inferenceStarted = hasEvent(events, "INFERENCE_STARTED", "INFERENCE_PROGRESS");
  const inferenceCompleted = hasEvent(events, "INFERENCE_COMPLETED", "MODEL_RESULT_APPLIED");
  const inferenceFailed = hasEvent(events, "INFERENCE_FAILED");
  const stage2ResultReceived = hasEvent(events, "STAGE2_RESULTS_RECORDED");
  const stage3ResultReceived = hasEvent(events, "STAGE3_RESULTS_RECORDED");
  const stage2ClassConfirmed = hasEvent(events, "STAGE2_CLASS_CONFIRMED");
  const nextStepDecided = hasEvent(events, "STAGE2_NEXT_STEP_SET");
  const closedByEvent = hasEvent(events, "CASE_CLOSED");

  if (next.computed.model3.available || (next.stage >= 3 && inferenceCompleted)) {
    next.modelStatus = "DONE";
    if (next.operationStep !== "COMPLETED") {
      next.operationStep = "FOLLOW_UP";
    }
  } else if (next.computed.model2.available || (next.stage >= 2 && inferenceCompleted)) {
    next.modelStatus = "DONE";
    if (next.operationStep !== "CLASSIFIED" && next.operationStep !== "COMPLETED") {
      next.operationStep = "RESULT_READY";
    }
  } else if ((inferenceRequested || inferenceStarted) && !inferenceFailed) {
    next.modelStatus = "PROCESSING";
  } else {
    next.modelStatus = "PENDING";
  }

  if (next.stage === 1) {
    if (closedByEvent || next.status === "CLOSED") {
      next.operationStep = "COMPLETED";
    } else if (hasEvent(events, "CONTACT_RESULT", "CONTACT_SENT")) {
      next.operationStep = "IN_PROGRESS";
    }
  } else if (next.stage === 2) {
    if (nextStepDecided || next.status === "NEXT_STEP_SET") {
      next.operationStep = "COMPLETED";
    } else if (stage2ClassConfirmed || next.status === "CLASS_CONFIRMED") {
      next.operationStep = "CLASSIFIED";
    } else if (next.computed.model2.available || inferenceCompleted) {
      next.operationStep = "RESULT_READY";
    } else if (stage2ResultReceived || next.computed.evidence.stage2.completed) {
      next.operationStep = "IN_PROGRESS";
    } else {
      next.operationStep = "WAITING";
    }
  } else {
    if (closedByEvent || next.status === "CLOSED") {
      next.operationStep = "COMPLETED";
    } else if (next.computed.model3.available || inferenceCompleted) {
      next.operationStep = "FOLLOW_UP";
    } else if (stage3ResultReceived || next.computed.evidence.stage3.completed) {
      next.operationStep = "IN_PROGRESS";
    } else {
      next.operationStep = "WAITING";
    }
  }

  if (next.computed.model2.available) {
    next.classification = toCaseClassification(next.computed.model2.predictedLabel);
    next.riskScore = Math.round((next.computed.model2.probs?.AD ?? 0) * 100);
    if (next.status === "WAITING_RESULTS" || next.status === "IN_PROGRESS") {
      next.status = "READY_TO_CLASSIFY";
    }
  }

  if (next.computed.model3.available) {
    next.riskScore = Math.round(
      stage3RiskBase(next.computed.model3, next.computed.stage3Profile?.stage3Type ?? "PREVENTIVE_TRACKING") * 100,
    );
    if (next.status === "WAITING_RESULTS") {
      next.status = "IN_PROGRESS";
    }
  }

  if (stage2ClassConfirmed) {
    next.status = "CLASS_CONFIRMED";
  }
  if (nextStepDecided) {
    next.status = next.stage === 3 ? "IN_PROGRESS" : "NEXT_STEP_SET";
  }
  if (closedByEvent) {
    next.status = "CLOSED";
    next.operationStep = "COMPLETED";
  }

  return next;
}

function patchCase(caseId: string, patcher: (draft: InternalCaseEntity) => void) {
  ensureStore();
  const current = caseStore.get(caseId);
  if (!current) return;

  const draft = cloneCase(current);
  patcher(draft);
  draft.updatedAt = nowIso();
  const recomputed = recomputeCase(draft);
  const synced = syncCaseLifecycle(recomputed, eventStore.get(caseId) ?? []);
  caseStore.set(caseId, synced);
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
  const nextEvents = [event, ...prev];
  eventStore.set(caseId, nextEvents);
  const current = caseStore.get(caseId);
  if (current) {
    const recomputed = recomputeCase({
      ...current,
      updatedAt: event.at,
    });
    caseStore.set(caseId, syncCaseLifecycle(recomputed, nextEvents));
  }
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
    draft.operationStep = "IN_PROGRESS";
    draft.modelStatus = "PENDING";
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

export function runCaseStage2Model(
  caseId: string,
  actorId = "system",
  options?: { labelOverride?: "정상" | "MCI" | "치매"; mciBandOverride?: "양호" | "중간" | "위험" },
) {
  ensureStore();
  const target = caseStore.get(caseId);
  if (!target || !target.computed.evidence.stage2.completed) return false;

  const now = nowIso();
  patchCase(caseId, (draft) => {
    const model = generateStage2Model(draft, options?.labelOverride, options?.mciBandOverride);
    draft.stage = 2;
    draft.computed.model2 = model;
    draft.modelStatus = "DONE";
    draft.operationStep = stageModelReadyStep(2);
    draft.status = "READY_TO_CLASSIFY";
    draft.classification = toCaseClassification(model.predictedLabel);
    draft.riskScore = Math.round((model.probs?.AD ?? 0) * 100);

    const profile = assignStage3ProfileFromStage2(draft);
    if (draft.stage === 3 && profile && draft.computed.model3.available) {
      draft.computed.model3 = generateStage3Model(draft);
    }
  });

  recordCaseEvent(caseId, "INFERENCE_COMPLETED", { stage: 2, at: now }, actorId);
  recordCaseEvent(caseId, "MODEL_RESULT_APPLIED", { stage: 2, at: now }, actorId);
  recordCaseEvent(caseId, "APPROVAL_PENDING", { stage: 2, target: "CLASSIFICATION_CONFIRMED" }, actorId);
  return true;
}

export function confirmCaseStage2Model(
  caseId: string,
  label: "정상" | "MCI" | "치매",
  options?: { mciBand?: "양호" | "중간" | "위험"; actorId?: string; rationale?: string },
) {
  ensureStore();
  const target = caseStore.get(caseId);
  if (!target) return false;
  if (!target.computed.model2.available && !target.computed.evidence.stage2.completed) return false;

  patchCase(caseId, (draft) => {
    const probs = mapLabelToProbs(label);
    const mciScore = Math.round((probs.MCI + probs.AD * 0.3) * 100);

    draft.status = "CLASS_CONFIRMED";
    draft.operationStep = "CLASSIFIED";
    draft.modelStatus = "DONE";
    draft.classification = toCaseClassification(label);
    draft.riskScore = Math.round((probs.AD ?? 0) * 100);
    draft.computed.model2 = {
      available: true,
      probs,
      predictedLabel: label,
      mciScore,
      mciBand: options?.mciBand ?? buildMciBand(mciScore),
      modelVersion: MODEL2_VERSION,
      updatedAt: nowIso(),
    };

    const profile = assignStage3ProfileFromStage2(draft);
    if (draft.stage === 3) {
      if (!profile) {
        draft.stage = 2;
        draft.status = "CLASS_CONFIRMED";
        draft.operationStep = "CLASSIFIED";
        draft.computed.model3 = { available: false };
      } else if (draft.computed.model3.available) {
        draft.computed.model3 = generateStage3Model(draft);
      }
    }
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
  recordCaseEvent(caseId, "APPROVAL_RESOLVED", { stage: 2, target: "CLASSIFICATION_CONFIRMED" }, options?.actorId ?? "system");

  return true;
}

export function setCaseNextStep(
  caseId: string,
  nextStep: "FOLLOWUP_2Y" | "STAGE3" | "DIFF_PATH",
  options?: { actorId?: string; summary?: string },
) {
  let stage3Transitioned = false;
  let stage3BlockedReason: string | null = null;

  patchCase(caseId, (draft) => {
    draft.status = "NEXT_STEP_SET";
    draft.operationStep = "COMPLETED";

    if (nextStep === "STAGE3") {
      const profile = assignStage3ProfileFromStage2(draft);
      if (!profile) {
        stage3BlockedReason = "Stage3 전이는 MCI-MID/MCI-HIGH/AD 결과에서만 가능합니다.";
        draft.status = "CLASS_CONFIRMED";
        draft.operationStep = "CLASSIFIED";
        return;
      }

      stage3Transitioned = true;
      draft.stage = 3;
      draft.status = "IN_PROGRESS";
      draft.operationStep = "IN_PROGRESS";
      if (draft.computed.evidence.stage3.completed) {
        draft.computed.model3 = generateStage3Model(draft);
      }
      draft.modelStatus = draft.computed.model3.available ? "DONE" : "PENDING";
    }

    if (nextStep === "FOLLOWUP_2Y") {
      draft.status = "CLOSED";
      draft.operationStep = "COMPLETED";
    }
  });

  if (nextStep === "STAGE3" && stage3Transitioned) {
    recordCaseEvent(
      caseId,
      "STAGE_CHANGE",
      {
        from: 2,
        to: 3,
        reason: "STAGE2_CLASS_ELIGIBLE",
      },
      options?.actorId ?? "system",
    );
  }

  recordCaseEvent(
    caseId,
    "STAGE2_NEXT_STEP_SET",
    {
      nextStep,
      applied: nextStep === "STAGE3" ? stage3Transitioned : true,
      blockedReason: stage3BlockedReason,
      summary: options?.summary,
    },
    options?.actorId ?? "system",
  );
  recordCaseEvent(caseId, "APPROVAL_RESOLVED", { stage: 2, target: "NEXT_STEP_DECIDED" }, options?.actorId ?? "system");

  return nextStep === "STAGE3" ? stage3Transitioned : true;
}

export function setCaseBookingPending(caseId: string, pendingCount: number, actorId = "system") {
  patchCase(caseId, (draft) => {
    draft.computed.ops.bookingPendingCount = Math.max(0, pendingCount);
    if (pendingCount > 0) {
      draft.status = "WAITING_RESULTS";
      if (draft.operationStep === "WAITING") {
        draft.operationStep = "IN_PROGRESS";
      }
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
    draft.operationStep = "IN_PROGRESS";
    draft.modelStatus = "PENDING";
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

  const now = nowIso();
  patchCase(caseId, (draft) => {
    assignStage3ProfileFromStage2(draft);
    draft.computed.model3 = generateStage3Model(draft);
    draft.modelStatus = "DONE";
    draft.operationStep = stageModelReadyStep(3);
    draft.riskScore = Math.round(stage3RiskBase(draft.computed.model3, draft.computed.stage3Profile?.stage3Type ?? "PREVENTIVE_TRACKING") * 100);
    draft.status = "IN_PROGRESS";
  });

  recordCaseEvent(caseId, "INFERENCE_COMPLETED", { stage: 3, at: now }, actorId);
  recordCaseEvent(caseId, "MODEL_RESULT_APPLIED", { stage: 3, at: now }, actorId);
  recordCaseEvent(caseId, "APPROVAL_PENDING", { stage: 3, target: "NEXT_STEP_DECIDED" }, actorId);
  recordCaseEvent(caseId, "STAGE3_RISK_UPDATED", {}, actorId);
  return true;
}

export function reconcileCaseStage3(
  caseId: string,
  policy: Stage3ReconcilePolicy = DEFAULT_STAGE3_RECONCILE_POLICY,
  actorId = "system",
) {
  ensureStore();
  const current = caseStore.get(caseId);
  if (!current) return null;

  const reconciled = reconcileInternalStage3Case(current, policy);
  if (reconciled.patches.length === 0) return reconciled;

  const nextEvents = [...(eventStore.get(caseId) ?? [])];
  if (reconciled.auditLog) {
    nextEvents.unshift(
      makeEvent(
        caseId,
        "DATA_SYNCED",
        {
          reason: "STAGE3_RECONCILED",
          message: reconciled.auditLog.message,
          patches: reconciled.patches.map((patch) => ({ code: patch.code, path: patch.path })),
        },
        actorId,
      ),
    );
    eventStore.set(caseId, nextEvents);
  }

  const recomputed = recomputeCase({
    ...reconciled.nextCase,
    updatedAt: nowIso(),
  });
  caseStore.set(caseId, syncCaseLifecycle(recomputed, nextEvents));
  emitChange();
  return reconciled;
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
        classificationConfirmed:
          internal.status === "CLASS_CONFIRMED" ||
          internal.status === "NEXT_STEP_SET" ||
          internal.status === "CLOSED" ||
          internal.operationStep === "CLASSIFIED" ||
          internal.operationStep === "FOLLOW_UP" ||
          internal.operationStep === "COMPLETED" ||
          internal.stage >= 3,
        predictedLabel: internal.computed.model2.predictedLabel,
        mciBand: internal.computed.model2.mciBand,
        completed: internal.computed.evidence.stage2.completed,
        missing: internal.computed.evidence.stage2.missing,
      },
      stage3: {
        modelAvailable: internal.computed.model3.available,
        label: internal.computed.model3.label,
        riskNow:
          stage3RiskBase(
            internal.computed.model3,
            internal.computed.stage3Profile?.stage3Type ?? "PREVENTIVE_TRACKING",
          ),
        stage3Type: internal.computed.stage3Profile?.stage3Type,
        originStage2Result: internal.computed.stage3Profile?.originStage2Result,
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

  const stage2Waiting = stage2Cases.filter((item) => item.operationStep === "WAITING" || item.operationStep === "IN_PROGRESS").length;
  const highRiskMciCases = stage2Cases.filter(
    (item) => item.computed.model2.available && item.computed.model2.predictedLabel === "MCI" && item.computed.model2.mciBand === "위험",
  );

  const stage3Waiting = stage3Cases.filter((item) => item.operationStep === "WAITING" || item.operationStep === "IN_PROGRESS").length;
  const churnRisk = stage3Cases.filter(
    (item) => (item.computed.model3.available && item.computed.model3.label === "HIGH") || (item.riskScore ?? 0) >= 67,
  ).length;

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

  const toPriorityTask = (item: InternalCaseEntity, pinned = false) => ({
    id: item.caseId,
    name: item.patient.name,
    age: item.patient.age,
    stage: stageToLegacy(item.stage),
    reason:
      pinned
        ? "예약/연계 후속 처리 시급"
        : item.stage === 2 && !item.computed.evidence.stage2.completed
          ? "필수 검사 입력 누락"
          : item.stage === 3 && !item.computed.evidence.stage3.completed
            ? "감별검사 결과 입력 필요"
            : "예약/연계 후속 처리 필요",
    action: item.stage >= 2 ? "연계" : "전화",
    sla: pinned ? "즉시" : item.status === "ON_HOLD" || item.status === "WAITING_RESULTS" ? "지연" : "1h 임박",
  });

  const sortedPriorityCandidates = [...cases]
    .sort((a, b) => {
      const aWeight = (a.computed.ops.missingFieldCount ?? 0) + (a.computed.ops.bookingPendingCount ?? 0) * 2;
      const bWeight = (b.computed.ops.missingFieldCount ?? 0) + (b.computed.ops.bookingPendingCount ?? 0) * 2;
      if (bWeight !== aWeight) return bWeight - aWeight;
      return b.updatedAt.localeCompare(a.updatedAt);
    });

  const pinnedPriorityCases = sortedPriorityCandidates.filter((item) => PRIORITY_TASK_PINNED_CASE_IDS.has(item.caseId));
  const regularPriorityCases = sortedPriorityCandidates.filter((item) => !PRIORITY_TASK_PINNED_CASE_IDS.has(item.caseId));
  const priorityTasks = [...pinnedPriorityCases, ...regularPriorityCases]
    .slice(0, 4)
    .map((item) => toPriorityTask(item, PRIORITY_TASK_PINNED_CASE_IDS.has(item.caseId)));

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

export function useCaseStoreVersion() {
  return useSyncExternalStore(subscribe, getSnapshotVersion, getSnapshotVersion);
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
