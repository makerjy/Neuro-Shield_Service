import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  AlertTriangle,
  ArrowRightCircle,
  Ban,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock3,
  ExternalLink,
  FilePenLine,
  History,
  Layers,
  ListChecks,
  MessageSquare,
  PauseCircle,
  Phone,
  PhoneCall,
  RefreshCw,
  Shield,
  ShieldCheck,
  Timer,
  UserCheck,
  X,
  Zap,
} from "lucide-react";
import {
  Area,
  CartesianGrid,
  Line,
  LineChart,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { toast } from "sonner";
import { cn } from "../shared";
import { useOutcomeSubmit } from "../../../../hooks/useOutcomeSubmit";
import {
  Dialog,
  DialogContent,
} from "../../../ui/dialog";
import { SmsPanel } from "../../sms/SmsPanel";
import { CaseDetailPrograms } from "../../programs/CaseDetailPrograms";
import { Stage2ClassificationViz } from "../../stage2/Stage2ClassificationViz";
import { ModelGateGuard } from "../../shared/ModelGateGuard";
import type { SmsTemplate as StdSmsTemplate, SmsTemplateVars, CallScriptStep as StdCallScriptStep } from "../../sms/SmsPanel";
import type { SmsHistoryItem } from "../../sms/smsService";
import {
  getStage1ContactPriority,
  getStage1InterventionGuides,
  getStage1InterventionPlan,
  maskPhone,
  type CaseRecord,
} from "../caseRecords";
import {
  confirmCaseStage2Model,
  recordCaseEvent,
  runCaseStage2Model,
  runCaseStage3Model,
  setCaseBookingPending,
  setCaseContactMode,
  setCaseStage1NextStep,
  setCaseNextStep,
  type CaseEntity,
  type EventType,
  type Stage2Route,
  updateCaseStage2Evidence,
  updateCaseStage3Evidence,
  useCaseEntity,
  useCaseEvents,
} from "../caseSSOT";
import {
  fetchStage2Step2Autofill,
  submitStage2Step2ManualEdit,
  type Stage2Step2AutoFillPayload,
} from "../localCenterDemoApi";
import type {
  AgentJobStatus,
  ChannelResult,
  GateStatus,
  CaseHeader,
  ContactExecutor,
  ContactEvent,
  ContactExecution,
  ContactExecutionStatus,
  ContactFlowState,
  ContactFlowStep,
  ContactFlowStepStatus,
  ContactPlan,
  ContactStrategy,
  DataQualityLevel,
  HandoffMemo,
  InterventionLevel,
  LinkageStatus,
  FollowUpRoute,
  ReservationInfo,
  ReservationSnapshot,
  ReservationStatus,
  AgentExecutionLog,
  AgentContactResult,
  OutcomeSavePayload,
  OutcomeType,
  OutcomeCode,
  ResponseReasonTag,
  PolicyGate,
  PolicyGateKey,
  PreTriageInput,
  PreTriageResult,
  RejectLevel,
  RejectReasonCode,
  RecontactStrategy,
  RecommendedContactStrategy,
  SlaLevel,
  Stage1Detail,
  Stage3HeaderMeta,
  Stage3OpsStatus,
  Stage3PlanStatus,
  Stage3ChurnRisk,
  Stage3RecommendedAction,
  Stage3ReevalStatus,
  Stage3RiskSummary,
  Stage3RiskTrendPoint,
  Stage3DiffPathStatus,
  Stage3ProgramItem,
  Stage3ProgramExecutionField,
  TodoItem,
} from "./stage1Types";
import {
  deriveOutcomeTransition,
  derivePreTriageResultByRule,
  hasVulnerableTrigger,
} from "./stage1ContactEngine";
import type { Stage2Diagnosis } from "../../../stage2/stage2Types";
import {
  buildStage2ValidationErrors,
  countStage2MissingByPlan,
  computeStage2RequiredChecks,
  deriveStage2ModelRecommendation,
  deriveStage2ModelStatus,
  type Stage2FieldErrorKey,
  type Stage2FieldErrors,
  type Stage2PlanRequiredDraft,
  type Stage2PlanRoute,
} from "./stage2ModalLogic";
import { createStage1CalendarEvent } from "./stage1OutcomeApi";
import {
  computeInferenceState,
  computeOpsLoopState,
  formatEtaLabel,
  mapTimelineToEvents,
  type InferenceJobStatus,
  type OpsLoopState,
} from "./opsLoopState";
import { useStage3CaseView } from "../../../../stores/caseStore";
import type { Stage3ViewModel } from "../../../../domain/stage3/types";
import {
  listSmsReservationSyncEvents,
  matchSmsReservationSyncEvent,
  SMS_RESERVATION_SYNC_STORAGE_KEY,
  type SmsReservationSyncEvent,
} from "../../../../lib/smsReservationSync";

type TimelineFilter = "ALL" | "CALL" | "SMS" | "STATUS";
type CallTarget = "citizen" | "guardian";
type SmsTarget = "citizen" | "guardian";
type SmsDispatchStatus = "DELIVERED" | "FAILED" | "PENDING";
type CallScriptStep = "greeting" | "purpose" | "assessment" | "scheduling";
type Stage1LinkageAction = "CENTER_LINKAGE" | "HOSPITAL_LINKAGE" | "COUNSELING_LINKAGE";
type Stage1FlowVisualStatus = "COMPLETED" | "READY" | "PENDING" | "BLOCKED";
type Stage1FlowAction = "OPEN_PRECHECK" | "OPEN_CONTACT_EXECUTION" | "OPEN_RESPONSE_HANDLING" | "OPEN_FOLLOW_UP";
type Stage1FlowCardId = "PRECHECK" | "CONTACT_EXECUTION" | "RESPONSE_HANDLING" | "FOLLOW_UP";
type ChannelType = "CALL" | "SMS" | "GUARDIAN";
type ChannelState = "OK" | "NEEDS_CHECK" | "RESTRICTED";
type AgentJobTrigger = "AUTO_ON_ENTER" | "AUTO_ON_STRATEGY" | "AUTO_ON_RETRY_DUE" | "MANUAL_RETRY_NOW" | "MANUAL_RETRY_SCHEDULE";
type StageOpsMode = "stage1" | "stage2" | "stage3";
type SurfaceStage = "Stage 1" | "Stage 2" | "Stage 3";

const STAGE1_SMS_AUTO_CONTACT_COMPLETE_CASE_IDS = new Set(["CASE-2026-175"]);
const STAGE1_SMS_AUTO_CONTACT_COMPLETE_NAME = "김복남";
const STAGE1_FORCE_STEP1_WAIT_CASE_IDS = new Set(["CASE-2026-175"]);
const LINKED_DEMO_UNIFIED_OPS_CASE_IDS = new Set(["CASE-2026-175", "CASE-2026-275", "CASE-2026-375"]);
const LINKED_DEMO_UNIFIED_PRIORITY_SCORE = 80;
const LINKED_DEMO_UNIFIED_INTERVENTION_LEVEL: InterventionLevel = "L2";

type AgentJobState = {
  status: AgentJobStatus;
  attemptNo: number;
  jobId?: string;
  idempotencyKey?: string;
  queuedAt?: string;
  startedAt?: string;
  finishedAt?: string;
  nextRetryAt?: string;
  channelResult?: ChannelResult;
  lastError?: string;
  summary?: string;
};

type InferenceJobState = {
  status: InferenceJobStatus;
  startedAt?: string;
  updatedAt?: string;
  completedAt?: string;
  progress?: number;
  etaSeconds?: number | null;
  recommendedLabel?: Stage2ClassLabel;
  modelVersion?: string;
  failureReason?: string;
  minDurationSec?: number;
  maxDurationSec?: number;
};

type Stage2AutoFillFieldKey = "mmse" | "gds" | "cdr" | "cogTestType" | "specialistOpinionStatus";
type Stage2AutoFillRiskBand = "LOW" | "MID" | "HIGH" | "AD";

function inferStage2Step2RiskBand(
  caseRecord?: CaseRecord,
  classification?: string,
  riskScore?: number,
): Stage2AutoFillRiskBand {
  const normalizedLabel = typeof classification === "string" ? classification.toUpperCase() : "";
  if (normalizedLabel === "AD") return "AD";
  if (normalizedLabel === "MCI") return typeof riskScore === "number" && riskScore >= 70 ? "HIGH" : "MID";
  if (normalizedLabel === "NORMAL") return "LOW";

  if (typeof riskScore === "number") {
    if (riskScore >= 82) return "AD";
    if (riskScore >= 70) return "HIGH";
    if (riskScore >= 40) return "MID";
    return "LOW";
  }

  if (caseRecord?.risk === "고") return "HIGH";
  if (caseRecord?.risk === "중") return "MID";
  return "LOW";
}

function buildStage2Step2SeedAutofill(
  caseId: string,
  riskBand: Stage2AutoFillRiskBand,
): Stage2Step2AutoFillPayload {
  if (riskBand === "LOW") {
    return {
      caseId,
      source: "SEEDED",
      syncedAt: nowIso(),
      mmse: 26,
      gds: 2,
      cogTestType: "CERAD-K",
      specialistOpinionStatus: "MISSING",
      receivedMeta: {
        linkageStatus: "WAITING",
        providerName: "강남구 협력병원",
      },
      missingRequiredCount: 0,
      filledFields: ["mmse", "gds", "cogTestType", "specialistOpinionStatus"],
    };
  }
  if (riskBand === "MID") {
    return {
      caseId,
      source: "SEEDED",
      syncedAt: nowIso(),
      mmse: 23,
      gds: 4,
      cogTestType: "SNSB-II",
      specialistOpinionStatus: "MISSING",
      receivedMeta: {
        linkageStatus: "WAITING",
        providerName: "강남구 협력병원",
      },
      missingRequiredCount: 0,
      filledFields: ["mmse", "gds", "cogTestType", "specialistOpinionStatus"],
    };
  }
  if (riskBand === "HIGH") {
    return {
      caseId,
      source: "SEEDED",
      syncedAt: nowIso(),
      mmse: 19,
      gds: 5,
      cdr: 1,
      cogTestType: "SNSB-II",
      specialistOpinionStatus: "MISSING",
      receivedMeta: {
        linkageStatus: "WAITING",
        providerName: "강남구 협력병원",
      },
      missingRequiredCount: 0,
      filledFields: ["mmse", "gds", "cdr", "cogTestType", "specialistOpinionStatus"],
    };
  }
  return {
    caseId,
    source: "SEEDED",
    syncedAt: nowIso(),
    mmse: 14,
    gds: 6,
    cdr: 2,
    cogTestType: "SNSB-C",
    specialistOpinionStatus: "DONE",
    receivedMeta: {
      linkageStatus: "WAITING",
      providerName: "강남구 협력병원",
    },
    missingRequiredCount: 0,
    filledFields: ["mmse", "gds", "cdr", "cogTestType", "specialistOpinionStatus"],
  };
}

function ensureStage2Step2AutofillPayload(
  payload: Stage2Step2AutoFillPayload,
  riskBand: Stage2AutoFillRiskBand,
): Stage2Step2AutoFillPayload {
  const seeded = buildStage2Step2SeedAutofill(payload.caseId, riskBand);
  const specialistOpinionStatus =
    payload.specialistOpinionStatus ?? (riskBand === "AD" ? "DONE" : seeded.specialistOpinionStatus ?? "MISSING");
  const merged: Stage2Step2AutoFillPayload = {
    caseId: payload.caseId,
    source: payload.source,
    syncedAt: payload.syncedAt || nowIso(),
    mmse: payload.mmse ?? seeded.mmse,
    gds: payload.gds ?? seeded.gds,
    cdr: payload.cdr ?? seeded.cdr,
    cogTestType: payload.cogTestType ?? seeded.cogTestType,
    specialistOpinionStatus,
    receivedMeta: {
      linkageStatus: payload.receivedMeta?.linkageStatus ?? seeded.receivedMeta.linkageStatus,
      receivedAt: payload.receivedMeta?.receivedAt,
      providerName: payload.receivedMeta?.providerName ?? seeded.receivedMeta.providerName,
    },
    missingRequiredCount: payload.missingRequiredCount,
    filledFields: payload.filledFields,
  };

  const requiredKeys =
    riskBand === "LOW" || riskBand === "MID"
      ? (["mmse", "gds", "cogTestType"] as const)
      : riskBand === "HIGH"
        ? (["mmse", "gds", "cdr", "cogTestType"] as const)
        : (["mmse", "gds", "cdr", "cogTestType", "specialistOpinionStatus"] as const);
  const missingRequiredCount = requiredKeys.filter((field) => {
    if (field === "specialistOpinionStatus") return merged.specialistOpinionStatus !== "DONE";
    return merged[field] == null;
  }).length;
  merged.missingRequiredCount = missingRequiredCount;
  merged.filledFields = ["mmse", "gds", "cdr", "cogTestType", "specialistOpinionStatus"].filter((field) => {
    if (field === "specialistOpinionStatus") return merged.specialistOpinionStatus != null;
    return merged[field as Stage2AutoFillFieldKey] != null;
  });
  return merged;
}

type Stage1FlowCardConfig = {
  id: Stage1FlowCardId;
  title: string;
  description: string;
  relatedSteps: ContactFlowStep[];
  action: Stage1FlowAction;
};

type Stage1FlowCard = Stage1FlowCardConfig & {
  status: Stage1FlowVisualStatus;
  reason: string;
  nextActionHint: string;
  metricLabel: string;
  isCurrent: boolean;
};

export type Stage1HeaderSummary = {
  contactMode: ContactStrategy;
  effectiveMode: RecommendedContactStrategy;
  slaLevel: SlaLevel;
  qualityScore: number;
  missingCount: number;
  warningCount: number;
  lastUpdatedAt?: string;
  nextActionLabel?: string;
  stage2Meta?: {
    diagnosisStatus: Stage2Diagnosis["status"];
    completionPct: number;
    requiredDataPct: number;
    completedCount: number;
    classificationLabel: "정상" | "MCI" | "치매" | "결과대기";
    modelAvailable?: boolean;
    missingEvidence?: string[];
    mciStage?: "양호" | "적정" | "위험";
    stage3EntryNeeded: boolean;
    enteredAt?: string;
    targetAt?: string;
    delayDays: number;
    nextActionLabel: string;
  };
  stage3Meta?: {
    opsStatus: Stage3OpsStatus;
    stage3Type?: "PREVENTIVE_TRACKING" | "AD_MANAGEMENT";
    originStage2Result?: "MCI-MID" | "MCI-HIGH" | "AD";
    risk2yNowPct?: number;
    risk2yLabel?: Stage3RiskSummary["risk2y_label"];
    modelAvailable?: boolean;
    missingEvidence?: string[];
    trend: Stage3RiskSummary["trend"];
    modelVersion: string;
    riskUpdatedAt: string;
    nextReevalAt?: string;
    nextTrackingContactAt?: string;
    nextProgramAt?: string;
    diffPathStatus?: Stage3DiffPathStatus;
    planStatus: Stage3PlanStatus;
    trackingCycleDays: number;
    churnRisk: Stage3ChurnRisk;
  };
};

function toOpsLoopStateFromStage3View(view: Stage3ViewModel): OpsLoopState {
  const steps: OpsLoopState["steps"] = view.display.stepCards.map((card) => ({
    id: (`STEP${card.step}` as "STEP1" | "STEP2" | "STEP3" | "STEP4"),
    label: card.subtitle,
    status: card.state === "DONE" ? "DONE" : card.state === "IN_PROGRESS" ? "READY" : "TODO",
    reason: card.reason,
    requiresHumanApproval: card.step >= 3,
  }));
  const doneCount = steps.filter((step) => step.status === "DONE").length;
  const readyCount = steps.filter((step) => step.status === "READY").length;

  return {
    stage: "stage3",
    steps,
    doneCount,
    readyCount,
    totalCount: 4,
    mismatch: view.display.inconsistencyFlags.length > 0,
    mismatchReasons: [...view.display.inconsistencyFlags],
  };
}

type AuditLogEntry = {
  id: string;
  at: string;
  actor: string;
  message: string;
};

type ReasonActionDraft =
  | {
      mode: "LEVEL";
      title: string;
      confirmLabel: string;
      nextLevel: InterventionLevel;
      reason: string;
    }
  | {
      mode: "STATUS";
      title: string;
      confirmLabel: string;
      nextStatus: "보류" | "우선순위 제외";
      reason: string;
    };

type OutcomeDraft =
  | {
      mode: "CALL";
      title: string;
      result: "SUCCESS" | "NO_ANSWER" | "REJECTED" | "WRONG_NUMBER";
      note: string;
      durationSec: number;
    }
  | {
      mode: "SMS";
      title: string;
      result: SmsDispatchStatus;
      note: string;
      scheduled: boolean;
    };

type RejectReasonDraft = {
  code: RejectReasonCode | null;
  level: RejectLevel;
  detail: string;
  createFollowupEvent: boolean;
  followupAt: string;
};

type NoResponsePlanDraft = {
  strategy: RecontactStrategy | null;
  channel: "CALL" | "SMS";
  assigneeId: string;
  nextContactAt: string;
  applyL3: boolean;
};

type AutoFilledOutcomeState = {
  source: "SMS";
  outcome: OutcomeCode;
  summary: string;
  autoFilledAt: string;
  manualOverriddenAt?: string;
};

type RagRecommendation = {
  id: string;
  title: string;
  useCase: string;
  evidence: string[];
  scriptBody: string;
};

type Stage1FollowUpNextStepDecision = "KEEP_STAGE1" | "MOVE_STAGE2";

type FollowUpDecisionDraft = {
  route: FollowUpRoute;
  scheduledAt: string;
  place: string;
  contactGuide: string;
  note: string;
  stage2Decision: Stage1FollowUpNextStepDecision;
};

type Stage3ReviewDraft = {
  diffNeeded: boolean;
  diffDecisionSet: boolean;
  diffDecisionReason: string;
  priority: "HIGH" | "MID" | "LOW";
  caregiverNeeded: boolean;
  sensitiveHistory: boolean;
  resultLinkedChecked: boolean;
  consentConfirmed: boolean;
  strategyMemo: string;
};

type Stage3DiffDraft = {
  orgName: string;
  orgPhone: string;
  preferredHospital: string;
  preferredTimeWindow: string;
  caregiverCompanion: boolean;
  mobilityIssue: boolean;
  testBiomarker: boolean;
  testBrainImaging: boolean;
  testOther: boolean;
  bookingAt: string;
  bookingAltAt: string;
  bookingConfirmed: boolean;
  prepGuide: string;
  note: string;
  resultSummary: string;
  resultLabel: "양성 신호" | "음성 신호" | "불확실";
  riskReady: boolean;
  resultPerformedAt?: string;
  biomarkerResultText?: string;
  imagingResultText?: string;
  abeta?: string;
  tau?: string;
};

type Stage3TaskFieldKey =
  | "step1DiffDecision"
  | "step1Consent"
  | "step1StrategyMemo"
  | "step1DiffReason"
  | "step2CallRecord"
  | "step2Hospital"
  | "step2BookingAt"
  | "step2TestSelection"
  | "step2BiomarkerResult"
  | "step2ImagingResult"
  | "step2ResultSummary"
  | "step2PerformedAt";

type Stage3TaskFieldErrors = Partial<Record<Stage3TaskFieldKey, string>>;

type Stage2PlanItemId =
  | "MMSE"
  | "CDR_GDS"
  | "NEURO"
  | "SPECIALIST"
  | "GDS_K"
  | "ADL"
  | "BPSD";

type Stage2PlanItemRequiredLevel = "REQUIRED" | "RECOMMENDED" | "OPTIONAL";
type Stage2PlanItemStatus =
  | "PENDING"
  | "REFERRED"
  | "SCHEDULED"
  | "DONE"
  | "RECEIVED"
  | "NEEDS_REVIEW"
  | "MISSING"
  | "EXCEPTION";
type Stage2PlanItemSource = "AUTO" | "MANUAL" | "OVERRIDE" | null;
type Stage2PlanStatus = "PAUSED" | "IN_PROGRESS" | "READY" | "BLOCKED";

type Stage2PlanItemAction = {
  key: "OPEN_PIPELINE" | "REQUEST_RESULT" | "VIEW_RESULT" | "MANUAL_EXCEPTION" | "MARK_REVIEWED";
  label: string;
  enabled: boolean;
  intent?: "default" | "warning" | "danger" | "success";
};

type Stage2PlanItem = {
  id: Stage2PlanItemId;
  label: string;
  fullName: string;
  description: string;
  requiredLevel: Stage2PlanItemRequiredLevel;
  status: Stage2PlanItemStatus;
  source: Stage2PlanItemSource;
  orgName?: string;
  dueAt?: string;
  updatedAt?: string;
  missingReason?: string;
  actions: Stage2PlanItemAction[];
};

type Stage2PlanRouteState = {
  routeType: Stage2PlanRoute;
  orgName?: string;
  dueAt?: string;
  lastSyncAt?: string;
  needsReasonOnChange?: boolean;
};

type Stage2PlanSummary = {
  status: Stage2PlanStatus;
  completionRate: number;
  requiredSatisfaction: number;
  missingCount: number;
  qualityScore: number;
  step1Reviewed: boolean;
  locks: { step2: boolean; step3: boolean; step4: boolean };
};

type Stage3Step2FlowState = {
  consultStarted: boolean;
  infoCollected: boolean;
  ragGenerated: boolean;
  bookingConfirmed: boolean;
  messageSent: boolean;
  calendarSynced: boolean;
};

type Stage3Step2PanelKey = "REVIEW" | "BOOKING" | "RESULT" | "MODEL" | "TRANSITION";

type Stage3RagAutoFill = {
  generatedAt: string;
  confidenceLabel: "높음" | "보통" | "낮음";
  reasonSnippets: string[];
  patch: Partial<Stage3DiffDraft>;
  changedFields: string[];
  applied: boolean;
  ignored: boolean;
};

type Stage3RiskReviewDraft = {
  memo: string;
  nextAction: "RECOMMEND_DIFF" | "HOLD" | "UPDATE_PLAN";
};

type Stage3DiffPathAction = "CREATE_RECO" | "CREATE_REFER" | "SCHEDULE" | "COMPLETE" | "APPLY_RESULT";

type Stage3TrackingPlanDraft = {
  nextTrackingAt: string;
  reminderDaysBefore: number;
  reminderTime: string;
  retryCount: number;
};

type Stage3RiskReviewSnapshot = {
  at: string;
  memo: string;
  nextAction: Stage3RiskReviewDraft["nextAction"];
};

type Stage1Stats = {
  priorityScore?: number;
  priorityBand?: "관찰" | "일반" | "우선" | "긴급";
  interventionLevel?: "L0" | "L1" | "L2" | "L3";
  percentileTop?: number;
  updatedAt?: string;
};

type Stage2Stats = {
  resultLabel?: "정상" | "MCI" | "치매";
  mciSeverity?: "양호" | "적정" | "위험";
  probs?: { AD?: number; MCI?: number; NORMAL?: number };
  tests?: { neuropsych?: "DONE" | "MISSING"; clinical?: "DONE" | "MISSING"; specialist?: "DONE" | "MISSING" };
  testAt?: string;
  org?: string;
};

type Stage3Stats = {
  risk2yNow?: number;
  risk2yLabel?: "LOW" | "MID" | "HIGH";
  confidence?: "LOW" | "MID" | "HIGH";
  status?: "RESULT_PENDING" | "RESULT_APPLIED";
  nextReevalAt?: string;
  nextContactAt?: string;
  riskAt2y?: number;
};

type CaseOpsStats = {
  stage1: Stage1Stats;
  stage2: Stage2Stats;
  stage3: Stage3Stats;
  opsCounts?: {
    contactAttempts30d?: number;
    contactSuccess30d?: number;
    contactFail30d?: number;
    bookings?: number;
    programsPlanned?: number;
    programsDone?: number;
  };
  dataQuality?: { score: number; missingCount: number };
};

type SmsTemplate = {
  id: string;
  messageType: "CONTACT" | "BOOKING" | "REMINDER";
  label: string;
  body: (params: {
    caseId: string;
    centerName: string;
    centerPhone: string;
    guideLink: string;
    reservationLink: string;
    unsubscribe: string;
  }) => string;
};

const STAGE1_PANEL_OPERATOR = "박종덕";
const DEFAULT_CENTER_NAME = "강남구 치매안심센터";
const DEFAULT_CENTER_PHONE =
  (
    (import.meta.env.VITE_STAGE1_CENTER_PHONE as string | undefined) ??
    (import.meta.env.VITE_SMS_CENTER_PHONE as string | undefined) ??
    (import.meta.env.VITE_CENTER_PHONE as string | undefined) ??
    "02-555-0199"
  ).trim() || "02-555-0199";
const DEMO_CITIZEN_TOKEN_DEFAULT = "R-2ldKkoGbDF-marBFEbgVilAXB5Tw0r";
const DEPLOYED_CITIZEN_BASE_FALLBACK = "http://146.56.162.226/neuro-shield";
/** 시민화면 링크 (배포 환경 자동 감지) */
function getCitizenUrl(): string {
  const explicitDemoLink =
    ((import.meta.env.VITE_CITIZEN_ENTRY_URL as string | undefined) ||
      (import.meta.env.VITE_STAGE1_DEMO_LINK as string | undefined) ||
      "").trim();
  if (explicitDemoLink && explicitDemoLink.length > 0) return explicitDemoLink;
  const demoToken = ((import.meta.env.VITE_CITIZEN_DEMO_TOKEN as string | undefined) || DEMO_CITIZEN_TOKEN_DEFAULT).trim();
  if (typeof window !== "undefined") {
    const host = window.location.hostname.toLowerCase();
    if (host === "localhost" || host === "127.0.0.1" || host === "::1") {
      return `${DEPLOYED_CITIZEN_BASE_FALLBACK}/p/sms?t=${encodeURIComponent(demoToken)}`;
    }
    const configuredBase = (import.meta.env.VITE_PUBLIC_BASE_URL as string | undefined)?.trim();
    const base = configuredBase && configuredBase.length > 0 ? configuredBase.replace(/\/$/, "") : window.location.origin;
    const basePath = import.meta.env.VITE_BASE_PATH || "/neuro-shield/";
    const rootedBase = configuredBase && configuredBase.length > 0 ? base : `${base}${basePath.replace(/\/$/, "")}`;
    return `${rootedBase}/p/sms?t=${encodeURIComponent(demoToken)}`;
  }
  return `${DEPLOYED_CITIZEN_BASE_FALLBACK}/p/sms?t=${encodeURIComponent(demoToken)}`;
}
const DEFAULT_GUIDE_LINK = getCitizenUrl();
const DEFAULT_BOOKING_URL = "(센터 예약 안내)";
const DEFAULT_UNSUBSCRIBE = "수신거부 080-000-0000";
const CONTACT_DISCLAIMER = "본 안내는 진단이 아니며, 센터 안내 및 예약/연계 목적입니다.";

const SMS_TEMPLATES: SmsTemplate[] = [
  /* ── 접촉: 시민화면 링크 포함 ── */
  {
    id: "S1_CONTACT_BASE",
    messageType: "CONTACT",
    label: "1차 접촉(기본)",
    body: ({ centerName, guideLink, centerPhone }) =>
      `[치매안심센터:${centerName}] 인지건강 확인을 위한 센터 안내입니다. 확인 절차(상담/선별검사)가 필요할 수 있습니다. 안내 확인 및 희망 연락시간 선택: ${guideLink} / 문의: ${centerPhone}`,
  },
  {
    id: "S1_CONTACT_GUARDIAN",
    messageType: "CONTACT",
    label: "1차 접촉(보호자 옵션)",
    body: ({ centerName, guideLink, centerPhone }) =>
      `[치매안심센터:${centerName}] 안내 확인 후 본인 응답이 어렵다면 보호자 연락처(선택)를 남길 수 있습니다. 안내 확인/연락시간 선택: ${guideLink} / 문의: ${centerPhone}`,
  },
  /* ── 예약안내: 시민링크 없음, 센터 전화만 ── */
  {
    id: "S1_BOOKING_BASE",
    messageType: "BOOKING",
    label: "1차 예약안내(선별/상담)",
    body: ({ centerName, centerPhone, reservationLink }) =>
      `[치매안심센터:${centerName}] 예약 안내입니다. ${reservationLink} 확인 후 변경이 필요하면 ${centerPhone}로 연락 주세요.`,
  },
  {
    id: "S1_BOOKING_CHANNEL",
    messageType: "BOOKING",
    label: "1차 예약안내(방문/전화 선택)",
    body: ({ centerName, centerPhone, reservationLink }) =>
      `[치매안심센터:${centerName}] 예약 방식 안내입니다. ${reservationLink} 기준으로 방문/전화 방식을 선택해 주세요. 문의: ${centerPhone}`,
  },
  /* ── 리마인더: 시민링크 없음, 센터 전화만 ── */
  {
    id: "S1_REMINDER_FIRST",
    messageType: "REMINDER",
    label: "1차 리마인더(1차 안내)",
    body: ({ centerName, centerPhone, unsubscribe }) =>
      `[치매안심센터:${centerName}] 이전에 안내드린 인지건강 확인이 아직 미확인 상태입니다. 원치 않으시면 수신거부 가능합니다. 문의: ${centerPhone} / ${unsubscribe}`,
  },
  {
    id: "S1_REMINDER_FINAL",
    messageType: "REMINDER",
    label: "1차 리마인더(최종)",
    body: ({ centerName, centerPhone }) =>
      `[치매안심센터:${centerName}] 확인이 없어 마지막으로 안내드립니다. 필요 시 센터로 연락 주시면 안내해드리겠습니다. 문의: ${centerPhone}`,
  },
];

const STAGE2_SMS_TEMPLATES: SmsTemplate[] = [
  {
    id: "S2_CONTACT_BASE",
    messageType: "CONTACT",
    label: "2차 진단검사 예약 안내",
    body: ({ centerName, guideLink, centerPhone }) =>
      `[치매안심센터:${centerName}] 2차 진단검사(인지검사/임상평가) 예약 안내입니다. 아래 링크에서 일정 확인 후 예약을 진행해 주세요. ${guideLink} / 문의: ${centerPhone}`,
  },
  {
    id: "S2_CONTACT_RELIEF",
    messageType: "CONTACT",
    label: "2차 검사 진행 안내",
    body: ({ centerName, guideLink, centerPhone }) =>
      `[치매안심센터:${centerName}] 2차 확인 절차 안내입니다. 결과는 담당자 및 의료진 확인 후 안내됩니다. 일정 확인: ${guideLink} / 문의: ${centerPhone}`,
  },
  {
    id: "S2_BOOKING_NEURO",
    messageType: "BOOKING",
    label: "2차 검사 준비사항 안내",
    body: ({ centerName, reservationLink }) =>
      `[치매안심센터:${centerName}] 2차 검사를 원활히 진행할 수 있도록 준비사항을 안내드립니다. 준비/일정 확인: ${reservationLink}`,
  },
  {
    id: "S2_BOOKING_CLINICAL",
    messageType: "BOOKING",
    label: "2차 임상평가 일정 안내",
    body: ({ centerName, reservationLink, centerPhone }) =>
      `[치매안심센터:${centerName}] 2차 임상평가(전문의 상담 포함) 일정 안내입니다. 예약/변경: ${reservationLink} / 문의: ${centerPhone}`,
  },
  {
    id: "S2_REMINDER_BOOKING",
    messageType: "REMINDER",
    label: "2차 결과 확인/추적 안내",
    body: ({ centerName, guideLink, centerPhone }) =>
      `[치매안심센터:${centerName}] 검사 결과 확인 및 추적 안내입니다. 운영 참고용 안내이며 최종 조치는 담당자 확인 후 진행됩니다. ${guideLink} / 문의: ${centerPhone}`,
  },
  {
    id: "S2_REMINDER_NOSHOW",
    messageType: "REMINDER",
    label: "2차 노쇼 재예약 안내",
    body: ({ centerName, reservationLink }) =>
      `[치매안심센터:${centerName}] 예약 일정에 참석이 어려우셨다면 재예약이 가능합니다. 편한 시간으로 다시 선택해주세요. ${reservationLink}`,
  },
];

const STAGE3_SMS_TEMPLATES: SmsTemplate[] = [
  {
    id: "S3_CONTACT_BASE",
    messageType: "CONTACT",
    label: "3차 추적관리 기본 안내",
    body: ({ centerName, centerPhone }) =>
      `[치매안심센터:${centerName}] 추적 관리 일정 확인 안내입니다. 재평가/연계 일정 조율을 위해 연락드립니다. 문의: ${centerPhone}`,
  },
  {
    id: "S3_BOOKING_REEVAL",
    messageType: "BOOKING",
    label: "3차 감별검사/뇌영상 예약 안내",
    body: ({ centerName, reservationLink, centerPhone }) =>
      `[치매안심센터:${centerName}] 감별검사/뇌영상 일정 안내입니다. 예약 일정 확인: ${reservationLink} / 문의: ${centerPhone}`,
  },
  {
    id: "S3_BOOKING_CONFIRM",
    messageType: "BOOKING",
    label: "3차 예약 확인/변경 안내",
    body: ({ centerName, reservationLink, centerPhone }) =>
      `[치매안심센터:${centerName}] 예약 일정 확인 및 변경 안내입니다. 예약 확인/변경: ${reservationLink} / 문의: ${centerPhone}`,
  },
  {
    id: "S3_PROGRAM_GUIDE",
    messageType: "CONTACT",
    label: "3차 정밀관리(프로그램/연계) 안내",
    body: ({ centerName, guideLink, centerPhone }) =>
      `[치매안심센터:${centerName}] 정밀관리 프로그램/연계 안내입니다. 운영 참고 기준에 따라 담당자가 후속 일정을 안내드립니다. ${guideLink} / 문의: ${centerPhone}`,
  },
  {
    id: "S3_REMINDER_TRACK",
    messageType: "REMINDER",
    label: "3차 리마인더(추적 접촉)",
    body: ({ centerName, centerPhone }) =>
      `[치매안심센터:${centerName}] 추적 일정 확인을 위한 리마인더입니다. 담당자 확인 후 후속 일정을 안내드립니다. 문의: ${centerPhone}`,
  },
];

const CALL_SCRIPT_STEPS: Array<{
  step: CallScriptStep;
  title: string;
  content: string;
  tips: string[];
  checkpoints: string[];
}> = [
  {
    step: "greeting",
    title: "1단계: 인사 및 본인 확인",
    content:
      "안녕하세요. 치매안심센터 운영 담당자입니다. 지금 통화 가능하신가요? 본인 확인을 위해 성함과 생년월일 앞자리를 확인드리겠습니다.",
    tips: ["차분한 톤으로 시작", "통화 가능 여부 우선 확인", "확인 내용은 짧고 명확하게"],
    checkpoints: ["통화 가능 확인", "본인/보호자 확인", "기본 응대 분위기 점검"],
  },
  {
    step: "purpose",
    title: "2단계: 연락 안내",
    content:
      "이번 연락은 인지건강 확인 안내를 위한 운영 절차입니다. 상담/선별검사 등 확인 절차를 간단히 안내드립니다.",
    tips: ["연락 취지를 짧게 안내", "불안 유발 표현 금지", "상대방 이해 여부 확인"],
    checkpoints: ["핵심 안내 전달", "상대방 이해 여부 확인", "추가 문의 기록"],
  },
  {
    step: "assessment",
    title: "3단계: 현재 상황 확인",
    content:
      "최근 일상에서 불편한 점, 연락 채널(전화/문자/보호자), 상담/선별검사 참여 가능 여부를 확인하겠습니다. 필요 시 보호자 연락으로 전환해 안내를 이어가겠습니다.",
    tips: ["개방형 질문 우선", "기록 중심으로 정리", "재접촉 채널 확인"],
    checkpoints: ["현재 상황 확인", "연락 채널 확인", "추가 지원 필요 여부 확인"],
  },
  {
    step: "scheduling",
    title: "4단계: 다음 실행 정리",
    content:
      "오늘 확인 내용을 기준으로 문자 안내, 상담/선별검사 예약, 재접촉 일정을 정리하겠습니다. 회신 가능한 시간도 함께 확인하겠습니다.",
    tips: ["다음 행동 1개로 요약", "문자 안내 여부 확인", "재접촉 일정 설정"],
    checkpoints: ["다음 행동 합의", "문자 발송 동의 확인", "재접촉 시점 설정"],
  },
];

const STAGE2_CALL_SCRIPT_STEPS: Array<{
  step: CallScriptStep;
  title: string;
  content: string;
  tips: string[];
  checkpoints: string[];
}> = [
  {
    step: "greeting",
    title: "1단계: 인사 및 본인/보호자 확인",
    content:
      "안녕하세요. 치매안심센터 운영 담당자입니다. 지금 통화 가능하신가요? 본인 응답이 어려우면 보호자와 함께 안내를 이어가겠습니다.",
    tips: ["통화 가능 여부를 먼저 확인", "본인/보호자 경로를 즉시 확정", "불안 유발 표현 금지"],
    checkpoints: ["통화 가능 확인", "본인/보호자 확인", "연락 채널 확정"],
  },
  {
    step: "purpose",
    title: "2단계: 2차 평가 안내",
    content:
      "이번 연락은 2차 정밀평가(신경심리검사/임상평가) 연계를 위한 안내입니다. 최종 확인 통보가 아니라 추가 확인 절차 안내입니다.",
    tips: ["최종 확인 전 절차임을 명확히 안내", "센터 안내 톤 유지", "문의 채널 즉시 제공"],
    checkpoints: ["2차 평가 목적 전달", "의료진 확인 필요 고지", "상대방 이해 여부 확인"],
  },
  {
    step: "assessment",
    title: "3단계: 분기/연계 준비 확인",
    content:
      "현재 참여 가능 일정, 병원 연계 의향, 보호자 동행 가능 여부를 확인하겠습니다. 필요 시 내부 프로그램 연계도 함께 안내합니다.",
    tips: ["연계 동의 여부를 구체적으로 확인", "일정 제약을 먼저 파악", "거부/무응답 시 대체 경로 준비"],
    checkpoints: ["연계/예약 의향 확인", "동행/지원 필요 확인", "재연락 조건 기록"],
  },
  {
    step: "scheduling",
    title: "4단계: 다음 행정 실행 확정",
    content:
      "오늘 확인 내용을 기준으로 분기 설정, 연계/예약 실행, 추적 계획 생성을 진행하겠습니다. 다음 안내 시점을 함께 확정하겠습니다.",
    tips: ["다음 액션을 1개로 요약", "연계 상태를 즉시 기록", "후속조치 일정 생성"],
    checkpoints: ["다음 액션 합의", "연계/예약 상태 기록", "재접촉 일정 확정"],
  },
];

function nowIso() {
  return new Date().toISOString();
}

function formatDateTime(isoLike?: string) {
  if (!isoLike) return "-";
  const d = new Date(isoLike);
  if (Number.isNaN(d.getTime())) return isoLike;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")} ${String(
    d.getHours()
  ).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function withHoursFromNow(hours: number) {
  return new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
}

function toDateTimeLocalValue(isoLike?: string) {
  if (!isoLike) return "";
  const date = new Date(isoLike);
  if (Number.isNaN(date.getTime())) return "";
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60 * 1000);
  return local.toISOString().slice(0, 16);
}

function fromDateTimeLocalValue(value: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString();
}

function toIsoFromLegacyDateTime(input?: string) {
  if (!input) return undefined;
  const parsed = new Date(input.includes("T") ? input : input.replace(" ", "T"));
  if (Number.isNaN(parsed.getTime())) return undefined;
  return parsed.toISOString();
}

function recommendationToCallScripts(mode: StageOpsMode, recommendation?: RagRecommendation): StdCallScriptStep[] {
  const baseSteps = mode === "stage1" ? CALL_SCRIPT_STEPS : STAGE2_CALL_SCRIPT_STEPS;
  if (!recommendation) {
    return baseSteps as StdCallScriptStep[];
  }

  return baseSteps.map((step, idx) => ({
    ...step,
    content: idx === 1 ? `${step.content}\n\n추천 문구: ${recommendation.scriptBody}` : step.content,
    tips:
      idx === 0
        ? [...step.tips, `권장 상황: ${recommendation.useCase}`]
        : idx === 2
          ? [...step.tips, ...recommendation.evidence.slice(0, 2)]
          : step.tips,
  })) as StdCallScriptStep[];
}

function reservationInfoToBookingLine(reservation?: ReservationInfo) {
  if (!reservation || !reservation.scheduledAt) {
    return "(예약 정보 미생성)";
  }
  const place = reservation.place?.trim() || "센터 안내 데스크";
  const contact = reservation.contactGuide?.trim() || DEFAULT_CENTER_PHONE;
  return `${reservation.reservationType} / ${formatDateTime(reservation.scheduledAt)} / ${place} / 문의 ${contact}`;
}

function inferWaitDays(status?: CaseRecord["status"]) {
  if (status === "지연") return 10;
  if (status === "임박") return 7;
  if (status === "대기") return 6;
  if (status === "진행중") return 3;
  return 1;
}

function inferSla(status?: CaseRecord["status"]): CaseHeader["sla"] {
  if (status === "지연") {
    return { level: "OVERDUE", dueAt: withHoursFromNow(-4) };
  }
  if (status === "임박" || status === "대기") {
    return { level: "DUE_SOON", dueAt: withHoursFromNow(18) };
  }
  return { level: "OK", dueAt: withHoursFromNow(72) };
}

function mapDataQuality(raw?: CaseRecord["quality"]) {
  if (raw === "경고") {
    return {
      level: "EXCLUDE" as DataQualityLevel,
      score: 58,
      notes: ["연락처 검증 필요", "주소/보호자 필드 누락"],
    };
  }
  if (raw === "주의") {
    return {
      level: "WARN" as DataQualityLevel,
      score: 79,
      notes: ["기초 필드 일부 누락"],
    };
  }
  return {
    level: "GOOD" as DataQualityLevel,
    score: 96,
    notes: ["운영 실행 가능"],
  };
}

function computePriorityValue(caseRecord?: CaseRecord) {
  if (caseRecord && LINKED_DEMO_UNIFIED_OPS_CASE_IDS.has(caseRecord.id)) {
    return LINKED_DEMO_UNIFIED_PRIORITY_SCORE;
  }

  const statusScoreMap: Record<CaseRecord["status"], number> = {
    진행중: 62,
    대기: 76,
    완료: 24,
    임박: 88,
    지연: 94,
  };
  const riskBoost: Record<CaseRecord["risk"], number> = {
    저: 0,
    중: 8,
    고: 16,
  };
  const qualityPenalty: Record<CaseRecord["quality"], number> = {
    양호: 0,
    주의: 6,
    경고: 18,
  };

  if (!caseRecord) {
    return 60;
  }

  const alertBonus = Math.min(caseRecord.alertTags.length * 3, 12);
  const raw = statusScoreMap[caseRecord.status] + riskBoost[caseRecord.risk] + alertBonus - qualityPenalty[caseRecord.quality];

  return Math.max(5, Math.min(99, raw));
}

function priorityIndicator(value: number) {
  if (value >= 85) {
    return {
      label: "긴급",
      tone: "border-red-200 bg-red-50 text-red-700",
      bar: "bg-red-500",
      guide: "24시간 이내 접촉 실행",
    };
  }
  if (value >= 65) {
    return {
      label: "우선",
      tone: "border-orange-200 bg-orange-50 text-orange-700",
      bar: "bg-orange-500",
      guide: "당일 연락/안내 우선 처리",
    };
  }
  if (value >= 45) {
    return {
      label: "일반",
      tone: "border-blue-200 bg-blue-50 text-blue-700",
      bar: "bg-blue-500",
      guide: "정규 순서로 처리",
    };
  }
  return {
    label: "관찰",
    tone: "border-emerald-200 bg-emerald-50 text-emerald-700",
    bar: "bg-emerald-500",
    guide: "기록/모니터링 중심",
  };
}

function stage3OpsStatusLabel(status: Stage3OpsStatus) {
  if (status === "TRACKING") return "추적중";
  if (status === "REEVAL_DUE") return "재평가 임박";
  if (status === "REEVAL_PENDING") return "재평가 대기";
  if (status === "LINKAGE_PENDING") return "연계 대기";
  if (status === "PLAN_NEEDS_UPDATE") return "플랜 업데이트 필요";
  if (status === "CHURN_RISK") return "이탈 위험";
  return "종결";
}

function stage3PlanStatusLabel(status: Stage3PlanStatus) {
  if (status === "ACTIVE") return "ACTIVE";
  if (status === "PAUSED") return "PAUSED";
  return "NEEDS_UPDATE";
}

function resolveStage3OpsStatus(caseRecord?: CaseRecord): Stage3OpsStatus {
  if (!caseRecord) return "TRACKING";
  if (caseRecord.status === "완료") return "CLOSED";
  if (caseRecord.alertTags.includes("이탈 위험")) return "CHURN_RISK";
  if (caseRecord.alertTags.includes("연계 대기")) return "LINKAGE_PENDING";
  if (caseRecord.alertTags.includes("재평가 필요")) {
    return caseRecord.status === "임박" || caseRecord.status === "지연" ? "REEVAL_DUE" : "REEVAL_PENDING";
  }
  if (caseRecord.status === "지연") return "PLAN_NEEDS_UPDATE";
  return "TRACKING";
}

function resolveStage3PlanStatus(caseRecord?: CaseRecord): Stage3PlanStatus {
  if (!caseRecord) return "ACTIVE";
  if (caseRecord.status === "완료") return "PAUSED";
  if (caseRecord.status === "지연" || caseRecord.alertTags.includes("재평가 필요")) return "NEEDS_UPDATE";
  return "ACTIVE";
}

function resolveStage3ChurnRisk(caseRecord?: CaseRecord): Stage3ChurnRisk {
  if (!caseRecord) return "MID";
  if (caseRecord.alertTags.includes("이탈 위험") || caseRecord.status === "지연") return "HIGH";
  if (caseRecord.risk === "고" || caseRecord.status === "임박") return "MID";
  return "LOW";
}

function buildStage3HeaderMeta(caseRecord?: CaseRecord): Stage3HeaderMeta {
  const opsStatus = resolveStage3OpsStatus(caseRecord);
  const planStatus = resolveStage3PlanStatus(caseRecord);
  const churnRisk = resolveStage3ChurnRisk(caseRecord);
  const trackingCycleDays = caseRecord?.risk === "고" ? 14 : caseRecord?.risk === "중" ? 21 : 30;
  const nextReevalAt = withHoursFromNow(caseRecord?.status === "임박" ? 12 : caseRecord?.status === "지연" ? -6 : 72);
  const nextTrackingContactAt = withHoursFromNow(caseRecord?.status === "지연" ? 8 : 36);
  const nextProgramAt = withHoursFromNow(caseRecord?.risk === "고" ? 120 : 168);

  return {
    opsStatus,
    nextReevalAt,
    nextTrackingContactAt,
    nextProgramAt,
    planStatus,
    trackingCycleDays,
    churnRisk,
  };
}

function buildStage3RecommendedActions(
  caseRecord: CaseRecord | undefined,
  meta: Stage3HeaderMeta,
  stage2OpsView = false,
): Stage3RecommendedAction[] {
  const actions: Stage3RecommendedAction[] = [];
  const hasReevalSignal = caseRecord?.alertTags.includes("재평가 필요") ?? true;
  const hasChurnSignal = caseRecord?.alertTags.includes("이탈 위험") ?? false;
  const hasLinkageWait = caseRecord?.alertTags.includes("연계 대기") ?? false;
  const quality = mapDataQuality(caseRecord?.quality).level;

  if (hasReevalSignal || meta.opsStatus === "REEVAL_DUE" || meta.opsStatus === "REEVAL_PENDING") {
    actions.push({
      id: "s3-action-reeval",
      type: "SCHEDULE_REEVAL",
      title: stage2OpsView ? "신경심리/임상평가 예약 생성" : "재평가 예약 생성",
      reason: stage2OpsView
        ? "진단검사 경로에서 일정 확정이 필요합니다."
        : "재평가 필요 신호가 충족되어 일정 확정이 필요합니다.",
      severity: meta.opsStatus === "REEVAL_DUE" ? "HIGH" : "MID",
      requiresApproval: true,
      decision: "PENDING",
    });
  }

  if (hasChurnSignal || meta.churnRisk === "HIGH") {
    actions.push({
      id: "s3-action-reminder",
      type: "SEND_REMINDER",
      title: stage2OpsView ? "예약 안내/결과 요청 연락" : "확인 연락/리마인더 발송",
      reason: stage2OpsView
        ? "미응답/지연 신호가 있어 예약 안내 또는 결과 요청 연락이 필요합니다."
        : "미응답/이탈 위험 신호가 있어 확인 연락이 필요합니다.",
      severity: "HIGH",
      requiresApproval: false,
      decision: "PENDING",
    });
  }

  if (meta.planStatus === "NEEDS_UPDATE") {
    actions.push({
      id: "s3-action-plan",
      type: "UPDATE_PLAN",
      title: stage2OpsView ? "진단 플랜 업데이트" : "케어 플랜 업데이트",
      reason: stage2OpsView
        ? "최근 예약/결과 반영을 위해 진단 플랜 업데이트가 필요합니다."
        : "최근 추적 결과 반영을 위해 플랜 업데이트가 필요합니다.",
      severity: "MID",
      requiresApproval: true,
      decision: "PENDING",
    });
  }

  if (hasLinkageWait || meta.opsStatus === "LINKAGE_PENDING") {
    actions.push({
      id: "s3-action-escalate",
      type: "ESCALATE_LEVEL",
      title: stage2OpsView ? "의뢰 경로 실행/기관 재요청" : "연계 실행/강도 상향 검토",
      reason: stage2OpsView ? "진단검사 연계 대기 상태로 기관 재요청이 필요합니다." : "연계 대기 상태로 담당자 승인 후 실행이 필요합니다.",
      severity: hasLinkageWait ? "MID" : "LOW",
      requiresApproval: true,
      decision: "PENDING",
    });
  }

  if (quality === "EXCLUDE") {
    actions.unshift({
      id: "s3-action-quality",
      type: "SEND_REMINDER",
      title: "누락 보완 요청",
      reason: stage2OpsView ? "데이터 품질 저하로 진단 진행 판단이 확실하지 않습니다." : "데이터 품질 저하로 추적 판단이 확실하지 않습니다.",
      severity: "HIGH",
      requiresApproval: false,
      decision: "PENDING",
    });
  }

  return actions.slice(0, 3);
}

function clamp01(v: number) {
  return Math.max(0, Math.min(1, v));
}

function toPercentValue(probability01: number) {
  return Math.round(clamp01(probability01) * 100);
}

function deriveStage3RiskLabel(probability01: number): Stage3RiskSummary["risk2y_label"] {
  const risk = clamp01(probability01);
  if (risk >= 0.7) return "HIGH";
  if (risk >= 0.45) return "MID";
  return "LOW";
}

function priorityBandFromScore(score: number): Stage1Stats["priorityBand"] {
  if (score >= 85) return "긴급";
  if (score >= 65) return "우선";
  if (score >= 45) return "일반";
  return "관찰";
}

function toPercentUnknown(value?: number): number | undefined {
  if (value == null || Number.isNaN(value)) return undefined;
  const raw = value <= 1 ? value * 100 : value;
  return Math.max(0, Math.min(100, Math.round(raw)));
}

function deriveStage3Confidence(detail: Stage1Detail): Stage3Stats["confidence"] {
  const quality = detail.header.dataQuality.score;
  if (quality >= 90) return "HIGH";
  if (quality >= 70) return "MID";
  return "LOW";
}

function projectStage3RiskAt2y(risk?: Stage3RiskSummary): number | undefined {
  if (!risk) return undefined;
  const now = clamp01(risk.risk2y_now);
  const delta =
    risk.trend === "UP" ? 0.14 : risk.trend === "DOWN" ? -0.1 : risk.trend === "VOLATILE" ? 0.08 : 0.02;
  return clamp01(now + delta);
}

function buildStage2MockProbs(
  resultLabel?: Stage2Stats["resultLabel"],
  severity?: Stage2Stats["mciSeverity"],
): Stage2Stats["probs"] | undefined {
  if (!resultLabel) return undefined;
  if (resultLabel === "MCI") {
    if (severity === "위험") return { MCI: 0.68, AD: 0.25, NORMAL: 0.07 };
    return { MCI: 0.72, AD: 0.18, NORMAL: 0.1 };
  }
  if (resultLabel === "치매") return { AD: 0.74, MCI: 0.22, NORMAL: 0.04 };
  return { NORMAL: 0.78, MCI: 0.16, AD: 0.06 };
}

type Stage2ClassLabel = NonNullable<Stage2Diagnosis["classification"]>["label"];
type Stage2MciStageLabel = NonNullable<Stage2Diagnosis["classification"]>["mciStage"];

function inferStage2MciStage(caseRecord?: CaseRecord): Stage2MciStageLabel {
  if (caseRecord?.risk === "고") return "위험";
  if (caseRecord?.risk === "중") return "적정";
  return "양호";
}

function stage2MciStageDisplayLabel(stage?: Stage2MciStageLabel): "양호" | "중등" | "위험" | "-" {
  if (!stage) return "-";
  if (stage === "적정") return "중등";
  return stage;
}

function stage2DiagnosisStatusLabel(status?: Stage2Diagnosis["status"]): string {
  if (!status) return "-";
  if (status === "NOT_STARTED") return "대기";
  if (status === "IN_PROGRESS") return "진행중";
  return "완료";
}

function inferStage2Label(caseRecord?: CaseRecord): Stage2ClassLabel {
  if (caseRecord?.risk === "고") return "치매";
  if (caseRecord?.risk === "중") return "MCI";
  return "정상";
}

function stage2NeedsStage3(label: Stage2ClassLabel): boolean {
  return label === "MCI" || label === "치매";
}

function inferStage2NextStep(label: Stage2ClassLabel): Stage2Diagnosis["nextStep"] {
  if (label === "정상") return "FOLLOWUP_2Y";
  if (label === "MCI") return "STAGE3";
  return "DIFF_PATH";
}

function inferStage2Probs(label: Stage2ClassLabel, mciStage?: Stage2MciStageLabel): NonNullable<Stage2Diagnosis["classification"]>["probs"] {
  if (label === "치매") return { NORMAL: 0.08, MCI: 0.2, AD: 0.72 };
  if (label === "MCI") {
    if (mciStage === "위험") return { NORMAL: 0.08, MCI: 0.66, AD: 0.26 };
    if (mciStage === "양호") return { NORMAL: 0.32, MCI: 0.56, AD: 0.12 };
    return { NORMAL: 0.1, MCI: 0.72, AD: 0.18 };
  }
  return { NORMAL: 0.78, MCI: 0.17, AD: 0.05 };
}

function stage2ClassLabelFromModel(label?: "정상" | "MCI" | "치매"): Stage2ClassLabel | undefined {
  if (!label) return undefined;
  if (label === "정상") return "정상";
  if (label === "치매") return "치매";
  return "MCI";
}

function stage2MciStageFromModel(band?: "양호" | "중간" | "위험"): Stage2MciStageLabel | undefined {
  if (!band) return undefined;
  if (band === "중간") return "적정";
  return band;
}

function stage3ResultFromDiffLabel(label: Stage3DiffDraft["resultLabel"]): "POS" | "NEG" | "UNK" {
  if (label === "양성 신호") return "POS";
  if (label === "음성 신호") return "NEG";
  return "UNK";
}

function countStage2CompletedTests(tests: Stage2Diagnosis["tests"], route: Stage2Route = "HOSPITAL"): number {
  return (
    Number(Boolean(tests.specialist)) +
    Number(route === "CENTER" ? true : typeof tests.mmse === "number") +
    Number(typeof tests.cdr === "number") +
    Number(Boolean(tests.neuroCognitiveType))
  );
}

function stage2StatusFromTests(
  tests: Stage2Diagnosis["tests"],
  hasClassification: boolean,
  route: Stage2Route = "HOSPITAL",
): Stage2Diagnosis["status"] {
  const requiredCount = route === "CENTER" ? 3 : 4;
  const completed = countStage2CompletedTests(tests, route);
  if (hasClassification || completed >= requiredCount) return "COMPLETED";
  if (completed > 0) return "IN_PROGRESS";
  return "NOT_STARTED";
}

function buildInitialStage2Diagnosis(caseRecord?: CaseRecord, ssotCase?: CaseEntity): Stage2Diagnosis {
  const stage2WaitingFromSsot = Boolean(
    ssotCase &&
      ssotCase.stage === 2 &&
      ssotCase.operationStep === "WAITING" &&
      !ssotCase.computed.model2.available,
  );
  if (stage2WaitingFromSsot) {
    return {
      status: "NOT_STARTED",
      tests: {
        specialist: false,
        mmse: undefined,
        cdr: undefined,
        neuroCognitiveType: undefined,
      },
      classification: undefined,
      nextStep: undefined,
    };
  }

  const ssotStage2Required = ssotCase?.computed.evidence.stage2.required;
  const ssotModel2 = ssotCase?.computed.model2;
  if (ssotCase?.stage === 2 && ssotStage2Required) {
    const routeFromSsot: Stage2Route = ssotCase.stage2Route === "HOSPITAL" ? "HOSPITAL" : "CENTER";
    const labelFromSsot = stage2ClassLabelFromModel(ssotModel2?.predictedLabel) ?? inferStage2Label(caseRecord);
    const mciStageFromSsot = stage2MciStageFromModel(ssotModel2?.mciBand) ?? (labelFromSsot === "MCI" ? inferStage2MciStage(caseRecord) : undefined);
    const tests: Stage2Diagnosis["tests"] = {
      specialist: Boolean(ssotStage2Required.specialist),
      mmse: typeof ssotStage2Required.mmse === "number" ? ssotStage2Required.mmse : undefined,
      cdr: typeof ssotStage2Required.cdrOrGds === "number" ? ssotStage2Required.cdrOrGds : undefined,
      neuroCognitiveType: ssotStage2Required.neuroType ?? undefined,
    };
    const classificationConfirmedBySsot =
      ssotCase.status === "CLASS_CONFIRMED" ||
      ssotCase.status === "NEXT_STEP_SET" ||
      ssotCase.operationStep === "CLASSIFIED" ||
      ssotCase.operationStep === "FOLLOW_UP" ||
      ssotCase.operationStep === "COMPLETED" ||
      ssotCase.stage >= 3;

    return {
      status: stage2StatusFromTests(tests, classificationConfirmedBySsot, routeFromSsot),
      tests,
      classification: ssotModel2?.available
        ? {
            label: labelFromSsot,
            probs: ssotModel2.probs ?? inferStage2Probs(labelFromSsot, mciStageFromSsot),
            mciStage: mciStageFromSsot,
          }
        : undefined,
      nextStep: undefined,
    };
  }

  const label = inferStage2Label(caseRecord);
  const mciStage = label === "MCI" ? inferStage2MciStage(caseRecord) : undefined;
  const hasStarted = caseRecord?.status === "진행중" || caseRecord?.status === "임박" || caseRecord?.status === "지연";
  const route: Stage2Route =
    caseRecord?.path?.includes("의뢰") || caseRecord?.path?.includes("병원") ? "HOSPITAL" : "CENTER";
  const tests: Stage2Diagnosis["tests"] = {
    specialist: hasStarted ? caseRecord?.risk !== "저" : false,
    mmse: undefined,
    cdr: undefined,
    neuroCognitiveType: undefined,
  };

  return {
    status: stage2StatusFromTests(tests, false, route),
    tests,
    classification: hasStarted
      ? {
          label,
          probs: inferStage2Probs(label, mciStage),
          mciStage,
        }
      : undefined,
    nextStep: undefined,
  };
}

function buildCaseOpsStats({
  detail,
  modelPriorityValue,
  stage2ResultLabel,
  stage2MciSeverity,
  stage2TestAt,
  stage2Org,
}: {
  detail: Stage1Detail;
  modelPriorityValue: number;
  stage2ResultLabel?: Stage2Stats["resultLabel"];
  stage2MciSeverity?: Stage2Stats["mciSeverity"];
  stage2TestAt?: string;
  stage2Org?: string;
}): CaseOpsStats {
  const priorityScore = Math.max(0, Math.min(100, modelPriorityValue));
  const percentileTop = Math.max(1, 100 - priorityScore);
  const latestRisk = detail.stage3?.transitionRisk;
  const risk2yNow = latestRisk?.risk2y_now;
  const riskAt2y = projectStage3RiskAt2y(latestRisk);
  const stage2MockProbs = buildStage2MockProbs(stage2ResultLabel, stage2MciSeverity);

  const nowMs = Date.now();
  const range30dMs = 30 * 24 * 60 * 60 * 1000;
  const in30Days = (at: string) => {
    const ms = new Date(at).getTime();
    if (Number.isNaN(ms)) return false;
    return nowMs - ms <= range30dMs;
  };

  const recentTimeline = detail.timeline.filter((event) => in30Days(event.at));
  const contactAttempts30d = recentTimeline.filter((event) => event.type === "CALL_ATTEMPT").length;
  const contactSuccess30d = recentTimeline.filter(
    (event) => event.type === "CALL_ATTEMPT" && event.result === "SUCCESS",
  ).length;
  const contactFail30d = recentTimeline.filter(
    (event) =>
      (event.type === "CALL_ATTEMPT" && event.result !== "SUCCESS") ||
      (event.type === "SMS_SENT" && event.status === "FAILED"),
  ).length;
  const bookings = recentTimeline.filter(
    (event) =>
      event.type === "REEVAL_SCHEDULED" ||
      event.type === "REEVAL_RESCHEDULED" ||
      event.type === "DIFF_SCHEDULED",
  ).length;
  const programsPlanned =
    detail.stage3?.programs.filter(
      (program) => program.selected && (program.execution?.status === "PLANNED" || program.execution?.status === "IN_PROGRESS"),
    ).length ?? 0;
  const programsDone =
    detail.stage3?.programs.filter((program) => program.selected && program.execution?.status === "DONE").length ?? 0;

  return {
    stage1: {
      priorityScore,
      priorityBand: priorityBandFromScore(priorityScore),
      interventionLevel: detail.interventionLevel,
      percentileTop,
      updatedAt: detail.scoreSummary[0]?.updatedAt ?? detail.timeline[0]?.at,
    },
    stage2: {
      resultLabel: stage2ResultLabel,
      mciSeverity: stage2MciSeverity,
      probs: stage2MockProbs,
      tests: {
        neuropsych: detail.stage3 ? "DONE" : "MISSING",
        clinical: detail.stage3 ? "DONE" : "MISSING",
        specialist: detail.stage3 ? "DONE" : "MISSING",
      },
      testAt: stage2TestAt,
      org: stage2Org,
    },
    stage3: {
      risk2yNow,
      risk2yLabel: risk2yNow == null ? undefined : deriveStage3RiskLabel(risk2yNow),
      confidence: deriveStage3Confidence(detail),
      status:
        detail.stage3?.diffPathStatus === "COMPLETED" || Boolean(detail.stage3?.riskReviewedAt)
          ? "RESULT_APPLIED"
          : "RESULT_PENDING",
      nextReevalAt: detail.stage3?.headerMeta.nextReevalAt,
      nextContactAt: detail.stage3?.headerMeta.nextTrackingContactAt,
      riskAt2y,
    },
    opsCounts: {
      contactAttempts30d,
      contactSuccess30d,
      contactFail30d,
      bookings,
      programsPlanned,
      programsDone,
    },
    dataQuality: {
      score: detail.header.dataQuality.score,
      missingCount: detail.header.dataQuality.notes?.length ?? 0,
    },
  };
}

function buildStage3TransitionRisk(caseRecord?: CaseRecord): Stage3RiskSummary {
  const basePriority = computePriorityValue(caseRecord);
  const base = clamp01(basePriority / 100);
  const riskBoost =
    caseRecord?.risk === "고" ? 0.12 : caseRecord?.risk === "중" ? 0.05 : 0;
  const statusDelta =
    caseRecord?.status === "지연"
      ? 0.1
      : caseRecord?.status === "임박"
        ? 0.06
        : caseRecord?.status === "완료"
          ? -0.08
          : 0;
  const nowRisk = clamp01(base + riskBoost + statusDelta);
  const trendSeed =
    caseRecord?.status === "지연"
      ? [0.18, 0.14, 0.1, 0.06, 0.03, 0]
      : caseRecord?.status === "완료"
        ? [-0.1, -0.07, -0.05, -0.03, -0.01, 0]
        : [0.04, 0.02, 0.03, 0.01, 0.005, 0];

  const series = trendSeed.map((delta, idx) => {
    const risk2y = clamp01(nowRisk - delta);
    const ciSpan = caseRecord?.quality === "경고" ? 0.08 : caseRecord?.quality === "주의" ? 0.06 : 0.04;
    return {
      t: withHoursFromNow(-(24 * 30 * (5 - idx))),
      risk2y,
      ciLow: clamp01(risk2y - ciSpan),
      ciHigh: clamp01(risk2y + ciSpan),
      source: "model" as const,
    };
  });

  const first = series[0]?.risk2y ?? nowRisk;
  const delta = nowRisk - first;
  const volatility = Math.max(
    ...series.map((point, idx) => (idx === 0 ? 0 : Math.abs(point.risk2y - (series[idx - 1]?.risk2y ?? point.risk2y))))
  );
  const trend: Stage3RiskSummary["trend"] =
    volatility >= 0.08 ? "VOLATILE" : delta >= 0.04 ? "UP" : delta <= -0.04 ? "DOWN" : "FLAT";

  return {
    risk2y_now: nowRisk,
    risk2y_label: nowRisk >= 0.7 ? "HIGH" : nowRisk >= 0.45 ? "MID" : "LOW",
    trend,
    variabilityNote:
      trend === "VOLATILE"
        ? "변동이 커서 재평가/감별검사 결과 반영 후 재확인이 필요합니다."
        : undefined,
    updatedAt: nowIso(),
    modelVersion: "stage3-risk-v1.2",
    series,
  };
}

function buildStage3ProgramCatalog(caseRecord?: CaseRecord): Stage3ProgramItem[] {
  const isHighRisk = caseRecord?.risk === "고" || caseRecord?.status === "지연";
  return [
    {
      id: "program-precision-diff-neuro",
      major: "정밀진료 정보",
      middle: "감별검사 안내",
      leaf: "신경심리 정밀검사 안내",
      pinned: isHighRisk,
    },
    {
      id: "program-precision-mri-route",
      major: "정밀진료 정보",
      middle: "뇌영상 경로",
      leaf: "뇌영상 예약/연계 안내",
      pinned: isHighRisk,
    },
    {
      id: "program-case-followup-weekly",
      major: "정밀 사례관리",
      middle: "주기 추적",
      leaf: "주간 추적 연락 및 상태 점검",
      pinned: true,
    },
    {
      id: "program-case-caregiver",
      major: "정밀 사례관리",
      middle: "보호자 협력",
      leaf: "보호자 커뮤니케이션 계획",
    },
    {
      id: "program-support-homevisit",
      major: "치매지원서비스",
      middle: "생활 지원",
      leaf: "방문형 안내/지원 연계",
    },
    {
      id: "program-support-education",
      major: "치매지원서비스",
      middle: "교육",
      leaf: "인지건강 교육 패키지 안내",
      pinned: caseRecord?.quality !== "양호",
    },
    {
      id: "program-family-rest",
      major: "가족/돌봄 지원",
      middle: "가족지원",
      leaf: "가족 돌봄 부담 완화 안내",
    },
    {
      id: "program-family-counseling",
      major: "가족/돌봄 지원",
      middle: "상담",
      leaf: "돌봄자 상담 연계",
    },
  ];
}

function buildInitialProgramSelections(catalog: Stage3ProgramItem[]): Stage3ProgramItem[] {
  const defaults = new Set([
    "program-precision-diff-neuro",
    "program-case-followup-weekly",
    "program-support-education",
  ]);

  return catalog
    .filter((item) => defaults.has(item.id))
    .map((item) => ({
      ...item,
      selected: true,
      execution: {
        owner: STAGE1_PANEL_OPERATOR,
        status: "PLANNED",
        dueDate: withHoursFromNow(24 * 3),
        method: "안내",
      },
    }));
}

function detailTrendLabel(lastOutcome?: OutcomeCode) {
  if (!lastOutcome) return "변동 큼";
  if (lastOutcome === "CONTINUE_SELF") return "하락";
  if (lastOutcome === "NO_RESPONSE" || lastOutcome === "REFUSE") return "상승";
  return "변동 큼";
}

function buildPolicyGates(caseRecord?: CaseRecord): PolicyGate[] {
  const quality = mapDataQuality(caseRecord?.quality).level;
  const hasGuardian = Boolean(caseRecord?.profile.guardianPhone);

  return [
    {
      key: "CONSENT_OK",
      label: "동의 상태",
      status: quality === "EXCLUDE" ? "FAIL" : "PASS",
      failReason: quality === "EXCLUDE" ? "동의 이력 확인이 필요합니다" : undefined,
      fixAction: quality === "EXCLUDE" ? { label: "동의 요청", action: "REQUEST_CONSENT" } : undefined,
    },
    {
      key: "CONTACTABLE_TIME_OK",
      label: "접촉 채널 사전 확인",
      status: caseRecord?.status === "지연" ? "UNKNOWN" : "PASS",
      failReason: caseRecord?.status === "지연" ? "접촉 채널 확인이 필요합니다" : undefined,
      fixAction:
        caseRecord?.status === "지연"
          ? { label: "채널 확인", action: "CONFIRM_CONTACT_TIME" }
          : undefined,
    },
    {
      key: "PHONE_VERIFIED",
      label: "연락처 신뢰도",
      status: quality === "GOOD" ? "PASS" : "FAIL",
      failReason: quality === "GOOD" ? undefined : "전화번호 검증이 필요합니다",
      fixAction: quality === "GOOD" ? undefined : { label: "번호 검증", action: "VERIFY_PHONE" },
    },
    {
      key: "GUARDIAN_OPTIONAL",
      label: "보호자 연락처",
      status: hasGuardian ? "PASS" : "UNKNOWN",
      failReason: hasGuardian ? undefined : "보호자 연락처가 아직 없습니다",
      fixAction: hasGuardian ? undefined : { label: "보호자 추가", action: "ADD_GUARDIAN" },
    },
  ];
}

function buildRiskEvidence(caseRecord?: CaseRecord, mode: StageOpsMode = "stage1", stage2OpsView = false) {
  if (mode === "stage3" && !stage2OpsView) {
    return {
      topFactors: [
        {
          title: "재평가 필요 신호",
          description: "최근 추적 지표 변화로 재평가 예약 생성이 필요합니다.",
          recency: withHoursFromNow(-14),
        },
        {
          title: "연락 실패 누적",
          description: "확인 연락 실패가 누적되어 리마인더/재접촉 개입이 필요합니다.",
          recency: withHoursFromNow(-20),
          isMissing: caseRecord?.quality !== "양호",
        },
        {
          title: "플랜 업데이트 지연",
          description: "최근 변화가 반영되지 않아 플랜/연계 점검이 필요합니다.",
          recency: withHoursFromNow(-32),
        },
      ],
      computedAt: nowIso(),
      version: "stage3-risk-v1.2",
    };
  }

  if (mode === "stage3" && stage2OpsView) {
    return {
      topFactors: [
        {
          title: "예약 필요 신호",
          description: "SLA 임박 또는 미예약 항목이 감지되어 일정 확정이 필요합니다.",
          recency: withHoursFromNow(-14),
        },
        {
          title: "미응답 누적",
          description: "연락 실패 누적으로 재접촉/리마인더 실행이 필요합니다.",
          recency: withHoursFromNow(-20),
          isMissing: caseRecord?.quality !== "양호",
        },
        {
          title: "결과 수신 지연",
          description: "기관 회신 지연으로 결과 수신 재요청이 필요합니다.",
          recency: withHoursFromNow(-32),
        },
      ],
      computedAt: nowIso(),
      version: "stage2-ops-v3.1",
    };
  }

  const risk = caseRecord?.risk ?? "중";
  const topFactors =
    risk === "고"
      ? [
          {
            title: "최근 망각 빈도 증가",
            description: "최근 2주 내 동일 문의와 일정 혼선 이력이 반복되었습니다.",
            recency: withHoursFromNow(-16),
          },
          {
            title: "재접촉 지연 누적",
            description: "연락 시도 간격이 길어져 추적 강도 상향이 필요합니다.",
            recency: withHoursFromNow(-30),
          },
          {
            title: "생활 리듬 변동 신호",
            description: "연락 채널 응답 패턴이 불규칙해 접촉 채널 검증이 필요합니다.",
            recency: withHoursFromNow(-40),
            isMissing: caseRecord?.quality === "경고",
          },
        ]
      : risk === "저"
        ? [
            {
              title: "안내 반응 안정",
              description: "안내 메시지 응답률이 안정적으로 유지되고 있습니다.",
              recency: withHoursFromNow(-18),
            },
            {
              title: "연락 지연 신호 낮음",
              description: "최근 연락 실패 누적이 낮아 L0/L1 운영 강도가 적합합니다.",
              recency: withHoursFromNow(-34),
            },
            {
              title: "보강 데이터 소량",
              description: "소수 필드 보강 후 다음 주기 모니터링이 권고됩니다.",
              recency: withHoursFromNow(-45),
              isMissing: caseRecord?.quality !== "양호",
            },
          ]
        : [
            {
              title: "재평가 트리거 후보",
              description: "지표 변동이 기준에 근접하여 모니터링이 필요합니다.",
              recency: withHoursFromNow(-20),
            },
            {
              title: "연락 간격 증가",
              description: "미응답 누적 방지를 위해 접촉 강도 조정이 권고됩니다.",
              recency: withHoursFromNow(-32),
            },
            {
              title: "데이터 최신성 편차",
              description: "일부 항목의 업데이트 간격이 길어 보강이 필요합니다.",
              recency: withHoursFromNow(-46),
              isMissing: caseRecord?.quality !== "양호",
            },
          ];

  return {
    topFactors,
    computedAt: nowIso(),
    version: mode === "stage2" ? "stage2-risk-v2.4" : "stage1-risk-v2.4",
  };
}

function buildScoreSummary(
  caseRecord?: CaseRecord,
  mode: StageOpsMode = "stage1",
  stage3Meta?: {
    headerMeta: Stage3HeaderMeta;
    transitionRisk: Stage3RiskSummary;
    recommendedActions: Stage3RecommendedAction[];
    planProgressPct: number;
    reevalStatus: Stage3ReevalStatus;
    diffPathStatus: Stage3DiffPathStatus;
  },
  stage2OpsView = false,
) {
  if (mode === "stage3" && stage3Meta) {
    const isAdManagementCase = caseRecord?.profile.stage3Type === "AD_MANAGEMENT";
    const quality = mapDataQuality(caseRecord?.quality);
    const triggerCount = stage3Meta.recommendedActions.length;
    const maxSeverity =
      stage3Meta.recommendedActions.some((action) => action.severity === "HIGH")
        ? "HIGH"
        : stage3Meta.recommendedActions.some((action) => action.severity === "MID")
          ? "MID"
          : "LOW";
    const adherence = caseRecord?.status === "완료" ? 94 : caseRecord?.status === "지연" ? 58 : caseRecord?.status === "임박" ? 67 : 76;
    const riskPct = toPercentValue(stage3Meta.transitionRisk.risk2y_now);
    const reevalLabel =
      stage3Meta.reevalStatus === "COMPLETED"
        ? "COMPLETED"
        : stage3Meta.reevalStatus === "SCHEDULED"
          ? "SCHEDULED"
          : stage3Meta.reevalStatus === "NOSHOW"
            ? "NOSHOW"
            : "PENDING";

    if (stage2OpsView) {
      const completedSteps =
        (stage3Meta.diffPathStatus === "SCHEDULED" || stage3Meta.diffPathStatus === "COMPLETED" ? 2 : 1) +
        (stage3Meta.reevalStatus === "SCHEDULED" || stage3Meta.reevalStatus === "COMPLETED" ? 1 : 0) +
        (stage3Meta.planProgressPct >= 80 ? 1 : 0);
      const progressPct = Math.max(0, Math.min(100, Math.round((completedSteps / 4) * 100)));
      const delayedDays = caseRecord?.status === "지연" ? 7 : caseRecord?.status === "임박" ? 3 : 0;
      const referralWaiting = stage3Meta.diffPathStatus === "SCHEDULED" || stage3Meta.diffPathStatus === "COMPLETED" ? 0 : 1;
      const classificationConfirmed = stage3Meta.planProgressPct >= 80;

      return [
        {
          label: "진단 진행률",
          value: progressPct,
          unit: "%",
          updatedAt: stage3Meta.transitionRisk.updatedAt,
          flags: [progressPct >= 100 ? "DONE" : progressPct >= 40 ? "IN_PROGRESS" : "BLOCKED"],
        },
        {
          label: "예약/의뢰 대기",
          value: referralWaiting,
          unit: "건",
          updatedAt: stage3Meta.headerMeta.nextReevalAt ?? nowIso(),
          flags: [referralWaiting === 0 ? "CONFIRMED" : "WAITING"],
        },
        {
          label: "결과 수신 지연",
          value: delayedDays,
          unit: "일",
          updatedAt: stage3Meta.headerMeta.nextTrackingContactAt ?? nowIso(),
          flags: delayedDays > 0 ? ["DELAYED"] : ["NORMAL"],
        },
        {
          label: "분류 확정 상태",
          value: classificationConfirmed ? 1 : 0,
          unit: "단계",
          updatedAt: nowIso(),
          flags: [classificationConfirmed ? "CONFIRMED" : "UNCONFIRMED"],
        },
        {
          label: "필수자료 충족도",
          value: quality.score,
          unit: "%",
          updatedAt: nowIso(),
          flags: quality.level === "GOOD" ? ["OK"] : ["MISSING_IMPACT"],
        },
      ];
    }

    return [
      {
        label: isAdManagementCase ? "현재 위험지수(운영 참고)" : "2년 전환 위험도(운영 참고)",
        value: riskPct,
        unit: "%",
        updatedAt: stage3Meta.transitionRisk.updatedAt,
        flags: [deriveStage3RiskLabel(stage3Meta.transitionRisk.risk2y_now), stage3Meta.transitionRisk.trend],
      },
      {
        label: "재평가 필요도",
        value: triggerCount,
        unit: "건",
        updatedAt: stage3Meta.headerMeta.nextReevalAt ?? nowIso(),
        flags: [`심각도 ${maxSeverity}`, reevalLabel],
      },
      {
        label: "추적 준수도",
        value: adherence,
        unit: "%",
        updatedAt: stage3Meta.headerMeta.nextTrackingContactAt ?? nowIso(),
        flags: adherence < 70 ? ["지연 누적"] : undefined,
      },
      { label: "정밀관리 플랜", value: stage3Meta.planProgressPct, unit: "%", updatedAt: nowIso(), flags: [stage3PlanStatusLabel(stage3Meta.headerMeta.planStatus)] },
      {
        label: "데이터 품질",
        value: quality.score,
        unit: "%",
        updatedAt: nowIso(),
        flags: quality.level === "GOOD" ? ["누락 위험 낮음"] : ["누락 영향 있음"],
      },
    ];
  }

  const risk = caseRecord?.risk ?? "중";
  const offset = Number(caseRecord?.id.slice(-2) ?? 0) % 5;

  const base =
    risk === "고"
      ? [41, 53, 47, 44]
      : risk === "저"
        ? [79, 83, 86, 82]
        : [61, 68, 65, 66];

  return [
    {
      label: "CIST 점수",
      value: Math.max(0, Math.min(100, base[0] - offset)),
      unit: "점",
      updatedAt: withHoursFromNow(-12),
      flags: risk === "고" ? ["변동 큼"] : undefined,
    },
    {
      label: "기억 반응 지표",
      value: Math.max(0, Math.min(100, base[1] - offset)),
      unit: "점",
      updatedAt: withHoursFromNow(-14),
      flags: risk !== "저" ? ["주의"] : undefined,
    },
    {
      label: "생활 리듬 지표",
      value: Math.max(0, Math.min(100, base[2] + offset)),
      unit: "점",
      updatedAt: withHoursFromNow(-26),
      flags: caseRecord?.quality !== "양호" ? ["누락 가능"] : undefined,
    },
    {
      label: "접촉 반응 지표",
      value: Math.max(0, Math.min(100, base[3])),
      unit: "점",
      updatedAt: withHoursFromNow(-8),
      flags: caseRecord?.status === "임박" || caseRecord?.status === "지연" ? ["즉시 확인"] : undefined,
    },
  ];
}

function buildTodos(level: InterventionLevel, qualityLevel: DataQualityLevel): TodoItem[] {
  const byLevel: Record<InterventionLevel, TodoItem[]> = {
    L0: [
      { id: "todo-L0-1", title: "운영 지원 안내 완료 기록", priority: 1, status: "OPEN", suggestedAction: "VERIFY" },
      { id: "todo-L0-2", title: "다음 재접촉 예정일 등록", priority: 2, status: "OPEN", suggestedAction: "SCHEDULE" },
      { id: "todo-L0-3", title: "데이터 보강 요청", priority: 2, status: "OPEN", suggestedAction: "VERIFY" },
    ],
    L1: [
      { id: "todo-L1-1", title: "안내 발송 실행", priority: 1, status: "OPEN", suggestedAction: "SMS" },
      { id: "todo-L1-2", title: "보호자 연락처 확인", priority: 2, status: "OPEN", suggestedAction: "VERIFY" },
      { id: "todo-L1-3", title: "재평가 트리거 약식 설정", priority: 3, status: "OPEN", suggestedAction: "HOLD" },
    ],
    L2: [
      { id: "todo-L2-1", title: "1차 연락 1회 시도", priority: 1, status: "OPEN", suggestedAction: "CALL" },
      { id: "todo-L2-2", title: "부재 시 재시도 일정 생성", priority: 1, status: "OPEN", suggestedAction: "SCHEDULE" },
      { id: "todo-L2-3", title: "2차 연결 안내 준비", priority: 2, status: "OPEN", suggestedAction: "SMS" },
    ],
    L3: [
      { id: "todo-L3-1", title: "2차 연결 요청 전 게이트 점검", priority: 1, status: "OPEN", suggestedAction: "VERIFY" },
      { id: "todo-L3-2", title: "예약 유도 안내 발송", priority: 1, status: "OPEN", suggestedAction: "SMS" },
      { id: "todo-L3-3", title: "후속 경로 후보 전환 기록", priority: 2, status: "OPEN", suggestedAction: "SCHEDULE" },
    ],
  };

  if (qualityLevel === "EXCLUDE") {
    return [
      {
        id: "todo-q-1",
        title: "데이터 품질 보강 요청",
        priority: 1,
        status: "OPEN",
        suggestedAction: "VERIFY",
      },
      {
        id: "todo-q-2",
        title: "우선순위 제외 사유 검토",
        priority: 2,
        status: "OPEN",
        suggestedAction: "EXCLUDE",
      },
      {
        id: "todo-q-3",
        title: "연락 실행 보류 확인",
        priority: 3,
        status: "CANCELED",
        suggestedAction: "HOLD",
      },
    ];
  }

  if (qualityLevel === "WARN") {
    return byLevel[level].map((todo, idx) => (idx === 0 ? { ...todo, priority: 2 as const } : todo));
  }

  return byLevel[level];
}

function buildInitialTimeline(caseRecord: CaseRecord | undefined, level: InterventionLevel, mode: StageOpsMode = "stage1"): ContactEvent[] {
  const baseStatus = caseRecord?.status ?? "진행중";
  const actor = caseRecord?.manager ?? STAGE1_PANEL_OPERATOR;
  const stageName = mode === "stage2" ? "Stage2" : mode === "stage3" ? "Stage3" : "Stage1";
  const seedTemplateId = mode === "stage2" ? "S2_CONTACT_BASE" : mode === "stage3" ? "S3_CONTACT_BASE" : "S1_CONTACT_BASE";

  const events: ContactEvent[] = [
    {
      type: "STATUS_CHANGE",
      at: withHoursFromNow(-72),
      from: "접수",
      to: baseStatus,
      reason: `${stageName} 케이스 등록`,
      by: actor,
    },
    {
      type: "LEVEL_CHANGE",
      at: withHoursFromNow(-48),
      from: "L0",
      to: level,
      reason: "위험 신호 및 SLA 상태 반영",
      by: actor,
    },
  ];

  if (baseStatus === "진행중" || baseStatus === "임박" || baseStatus === "지연") {
    events.unshift({
      type: "CALL_ATTEMPT",
      at: withHoursFromNow(-18),
      result: "NO_ANSWER",
      note: "부재로 재접촉 필요",
      by: actor,
    });
  }

  if (caseRecord?.alertTags.includes("연계 대기")) {
    events.unshift({
      type: "SMS_SENT",
      at: withHoursFromNow(-14),
      templateId: seedTemplateId,
      status: "PENDING",
      by: actor,
    });
  }

  if (mode === "stage3") {
    events.unshift({
      type: "RISK_SERIES_UPDATED",
      at: withHoursFromNow(-12),
      by: actor,
      summary: "2년 전환 위험 시계열 업데이트",
    });
    events.unshift({
      type: "RISK_REVIEWED",
      at: withHoursFromNow(-11),
      by: actor,
      summary: "전환 위험 추세 검토 완료",
    });
    events.unshift({
      type: "DIFF_RECO_CREATED",
      at: withHoursFromNow(-9),
      by: actor,
      summary: "감별검사 권고 생성",
    });
    events.unshift({
      type: "PLAN_UPDATED",
      at: withHoursFromNow(-10),
      by: actor,
      summary: "추적 기준 입력 기반 플랜 업데이트",
    });
    events.unshift({
      type: "REEVAL_SCHEDULED",
      at: withHoursFromNow(-8),
      scheduledAt: withHoursFromNow(72),
      by: actor,
      reason: "재평가 필요 신호 대응",
    });
  }

  return events;
}

function buildInitialStage1Detail(
  caseRecord?: CaseRecord,
  mode: StageOpsMode = "stage1",
  stage2OpsView = false,
): Stage1Detail {
  const intervention = getStage1InterventionPlan(caseRecord);
  const resolvedInterventionLevel: InterventionLevel =
    caseRecord && LINKED_DEMO_UNIFIED_OPS_CASE_IDS.has(caseRecord.id)
      ? LINKED_DEMO_UNIFIED_INTERVENTION_LEVEL
      : intervention.level;
  const quality = mapDataQuality(caseRecord?.quality);
  const preTriageInput = buildPreTriageInput(caseRecord);
  const preTriage = applyContactModeHint(buildPreTriageResult(preTriageInput), caseRecord?.computed?.ops?.contactMode);
  const contactPlan = buildContactPlan(preTriage.strategy, caseRecord, mode);
  const contactExecution = buildInitialContactExecution(caseRecord);
  const linkageStatus: LinkageStatus = "NOT_CREATED";
  const stage3HeaderMeta = mode === "stage3" ? buildStage3HeaderMeta(caseRecord) : undefined;
  const stage3TransitionRisk = mode === "stage3" ? buildStage3TransitionRisk(caseRecord) : undefined;
  const stage3RecommendedActions =
    mode === "stage3" && stage3HeaderMeta ? buildStage3RecommendedActions(caseRecord, stage3HeaderMeta, stage2OpsView) : [];
  const stage3ProgramCatalog = mode === "stage3" ? buildStage3ProgramCatalog(caseRecord) : [];
  const stage3InitialPrograms = mode === "stage3" ? buildInitialProgramSelections(stage3ProgramCatalog) : [];
  const stage3EvidenceCompleted = Boolean(caseRecord?.computed?.stage3?.completed || caseRecord?.computed?.stage3?.modelAvailable);
  const stage3DiffPathStatus: Stage3DiffPathStatus = stage3EvidenceCompleted
    ? "COMPLETED"
    : stage3RecommendedActions.length > 0
      ? "RECOMMENDED"
      : "NONE";
  const stage3InitialReevalStatus: Stage3ReevalStatus =
    stage3EvidenceCompleted
      ? "COMPLETED"
      : stage3HeaderMeta?.opsStatus === "REEVAL_DUE" || stage3HeaderMeta?.opsStatus === "REEVAL_PENDING"
        ? "PENDING"
        : "SCHEDULED";
  const stage3PlanProgressPct =
    mode === "stage3"
      ? stage3HeaderMeta?.planStatus === "ACTIVE"
        ? 72
        : stage3HeaderMeta?.planStatus === "NEEDS_UPDATE"
          ? 48
          : 91
      : undefined;

  const riskGuardrails: string[] = [];
  if (hasVulnerableTrigger(preTriage.triggers)) {
    riskGuardrails.push("취약군 정책 적용: 상담사 우선 연결");
  }
  if (preTriage.triggers.includes("GUARDIAN_PRIMARY")) {
    riskGuardrails.push("보호자 우선 연락");
  }
  if (preTriage.triggers.includes("HAS_COMPLAINT_HISTORY")) {
    riskGuardrails.push("과거 민원 이력 있음");
  }
  if (preTriage.triggers.includes("HAS_REFUSAL_HISTORY")) {
    riskGuardrails.push("거부 이력 재확인 필요");
  }
  if (mode === "stage3") {
    riskGuardrails.push(
      stage2OpsView
        ? "운영 참고: 진단 진행/지연 신호는 담당자 검토 후 예약/의뢰/확정에 반영"
        : caseRecord?.profile.stage3Type === "AD_MANAGEMENT"
          ? "운영 참고: 현재 위험지수는 담당자 검토 후 실행"
          : "운영 참고: 전환 위험 신호는 담당자 검토 후 실행",
    );
  }

  return {
    header: {
      caseId: caseRecord?.id ?? "CASE-UNKNOWN",
      stage: mode === "stage2" ? "STAGE2" : mode === "stage3" ? "STAGE3" : "STAGE1",
      assigneeName: caseRecord?.manager ?? STAGE1_PANEL_OPERATOR,
      statusLabel:
        mode === "stage3" && stage3HeaderMeta
          ? stage2OpsView
            ? "진행중"
            : stage3OpsStatusLabel(stage3HeaderMeta.opsStatus)
          : caseRecord?.status === "완료"
            ? "완료"
            : caseRecord?.status === "지연"
              ? "진행중"
              : caseRecord?.status ?? "진행중",
      waitDays: inferWaitDays(caseRecord?.status),
      sla: inferSla(caseRecord?.status),
      dataQuality: quality,
      contactStrategy: preTriage.strategy,
      effectiveStrategy: preTriage.strategy,
      riskGuardrails: riskGuardrails.length > 0 ? riskGuardrails : undefined,
    },
    policyGates: buildPolicyGates(caseRecord),
    interventionLevel: resolvedInterventionLevel,
    riskEvidence: buildRiskEvidence(caseRecord, mode, stage2OpsView),
    scoreSummary: buildScoreSummary(
      caseRecord,
      mode,
      mode === "stage3" && stage3HeaderMeta && stage3TransitionRisk && stage3PlanProgressPct != null
        ? {
            headerMeta: stage3HeaderMeta,
            transitionRisk: stage3TransitionRisk,
            recommendedActions: stage3RecommendedActions,
            planProgressPct: stage3PlanProgressPct,
            reevalStatus: stage3InitialReevalStatus,
            diffPathStatus: stage3DiffPathStatus,
          }
        : undefined,
      stage2OpsView,
    ),
    todos: buildTodos(resolvedInterventionLevel, quality.level),
    timeline: buildInitialTimeline(caseRecord, resolvedInterventionLevel, mode),
    preTriageInput,
    preTriageResult: preTriage,
    contactPlan,
    contactExecution,
    contactFlowSteps: buildContactFlowSteps(contactExecution, preTriage, linkageStatus, mode),
    linkageStatus,
    contactExecutor: preTriage.strategy === "AI_FIRST" ? "AGENT_SEND_ONLY" : "HUMAN",
    lastSmsSentAt: contactExecution.lastSentAt ?? null,
    reservation: {
      source: "MANUAL",
      status: "NONE",
    },
    agentExecutionLogs: [],
    stage3:
      mode === "stage3" && stage3HeaderMeta && stage3TransitionRisk && stage3PlanProgressPct != null
        ? {
            headerMeta: stage3HeaderMeta,
            transitionRisk: stage3TransitionRisk,
            reevalStatus: stage3InitialReevalStatus,
            riskReviewedAt: caseRecord?.computed?.stage3?.modelAvailable ? toIsoFromLegacyDateTime(caseRecord?.updated) ?? nowIso() : undefined,
            diffPathStatus: stage3DiffPathStatus,
            triggersReviewedAt: stage3EvidenceCompleted ? toIsoFromLegacyDateTime(caseRecord?.updated) ?? nowIso() : undefined,
            planProgressPct: stage3PlanProgressPct,
            planUpdatedAt: stage3HeaderMeta.planStatus === "NEEDS_UPDATE" ? undefined : withHoursFromNow(-10),
            recommendedActions: stage3RecommendedActions,
            programs: stage3InitialPrograms,
          }
        : undefined,
  };
}

function buildInitialAuditLogs(
  caseRecord: CaseRecord | undefined,
  detail: Stage1Detail,
  mode: StageOpsMode = "stage1",
  stage2OpsView = false,
): AuditLogEntry[] {
  const actor = caseRecord?.manager ?? STAGE1_PANEL_OPERATOR;
  const stagePrefix = mode === "stage2" ? "Stage2" : mode === "stage3" ? "Stage3" : "Stage1";

  return [
    {
      id: `audit-${detail.header.caseId}-1`,
      at: formatDateTime(withHoursFromNow(-72)),
      actor,
      message: "케이스 상세 열람: 운영 보드 진입",
    },
    {
      id: `audit-${detail.header.caseId}-2`,
      at: formatDateTime(withHoursFromNow(-48)),
      actor,
      message:
        mode === "stage3"
          ? stage2OpsView
            ? `진단 기준 확정: 목표 ${detail.stage3?.headerMeta.trackingCycleDays ?? 21}일 / 플랜 ${stage3PlanStatusLabel(
                detail.stage3?.headerMeta.planStatus ?? "ACTIVE",
              )}`
            : `추적 기준 확정: ${detail.stage3?.headerMeta.trackingCycleDays ?? 21}일 주기 / 플랜 ${stage3PlanStatusLabel(
                detail.stage3?.headerMeta.planStatus ?? "ACTIVE",
              )}`
          : `${mode === "stage2" ? "분기 기준" : "접촉 방식"} 확정: ${detail.preTriageResult?.strategy === "HUMAN_FIRST" ? "상담사 우선" : "자동안내 우선"}`,
    },
    {
      id: `audit-${detail.header.caseId}-3`,
      at: formatDateTime(withHoursFromNow(-32)),
      actor,
      message: `개입 레벨 설정: ${detail.interventionLevel}`,
    },
    {
      id: `audit-${detail.header.caseId}-4`,
      at: formatDateTime(withHoursFromNow(-18)),
      actor,
      message: `${stagePrefix} 운영 이력 동기화: 완료`,
    },
  ];
}

function buildRagRecommendations(detail: Stage1Detail, mode: StageOpsMode = "stage1"): RagRecommendation[] {
  const riskTop = detail.riskEvidence.topFactors.map((factor) => factor.title).slice(0, 2);
  const isVulnerable = hasVulnerableTrigger(detail.preTriageResult?.triggers ?? []);
  const hasComplaint = detail.preTriageInput?.contactHistory.hasComplaint ?? false;
  const hasRefusal = detail.preTriageInput?.contactHistory.hasRefusal ?? false;
  const isDueSoon = detail.header.sla.level !== "OK";
  const isAgentMode = detail.contactExecutor === "AGENT_SEND_ONLY";

  if (mode === "stage3") {
    return [
      {
        id: "RAG-S3-01",
        title: "재평가 일정 확정형",
        useCase: "재평가 필요 신호가 있는 Stage3 케이스",
        evidence: [
          `핵심 신호: ${riskTop.join(", ") || "재평가 트리거"}`,
          "추적 운영 단계로 재평가 일정 생성이 우선입니다.",
          "운영 참고용 안내이며 최종 실행은 담당자 확인 후 진행합니다.",
        ],
        scriptBody:
          "현재 신호를 기준으로 재평가 일정을 먼저 확정하고, 이후 추적 계획을 함께 안내드리겠습니다.",
      },
      {
        id: "RAG-S3-02",
        title: "플랜 업데이트/연계형",
        useCase: "연계 대기 또는 플랜 업데이트 필요 상태",
        evidence: [
          "플랜 업데이트 단계에서 연계 상태를 함께 기록해야 누락이 줄어듭니다.",
          isDueSoon ? "일정 임박 상태이므로 우선순위 상향이 필요합니다." : "정규 주기 추적 기준으로 업데이트합니다.",
          "확정 표현 없이 운영 기준/후속 조치 중심으로 안내합니다.",
        ],
        scriptBody:
          "오늘 기록한 추적 결과를 기반으로 플랜을 업데이트하고 필요한 연계를 같이 진행하겠습니다.",
      },
      {
        id: "RAG-S3-03",
        title: "확인 연락/리마인더형",
        useCase: "연락 실패 누적 또는 이탈 위험 신호",
        evidence: [
          "이탈 위험/미응답 누적 시 확인 연락을 보조 개입으로 사용합니다.",
          isAgentMode ? "Agent 발송 후 담당자 결과 확인이 필요합니다." : "사람 직접 연락 결과를 즉시 기록합니다.",
          "재평가/플랜 루프를 유지하기 위한 보조 액션입니다.",
        ],
        scriptBody:
          "재평가/추적 일정 안내를 위해 확인 연락드립니다. 일정이 어려우시면 가능한 시간대로 재조율하겠습니다.",
      },
    ];
  }

  if (mode === "stage2") {
    const stage2Candidates: RagRecommendation[] = [
      {
        id: "RAG-S2-01",
        title: "2차 정밀평가 안내형",
        useCase: "2차 1단계/2단계 평가 연계가 필요한 케이스",
        evidence: [
          `근거 신호: ${riskTop.join(", ") || "검사 요약 확인"}`,
          "현재 단계는 최종 결과 통보가 아니라 추가 확인 절차 안내 단계입니다.",
          "의료진 확인 전 단계임을 반드시 명시해야 합니다.",
        ],
        scriptBody:
          "이번 안내는 2차 정밀평가 연계를 위한 절차 안내입니다. 최종 결과 통보가 아니며, 일정 확정 후 필요한 안내를 이어가겠습니다.",
      },
      {
        id: "RAG-S2-02",
        title: hasComplaint || hasRefusal ? "연계 동의 완충형" : "연계 동의 확인형",
        useCase: hasComplaint || hasRefusal ? "민원/거부 이력이 있어 완충 안내가 필요한 경우" : "분기 후 병원/센터 연계 동의 확인",
        evidence: [
          hasComplaint ? "민원 이력이 있어 선택지 중심으로 짧게 안내해야 합니다." : "연계 동의 확인 후 즉시 일정 생성이 가능합니다.",
          hasRefusal ? "거부 이력이 있어 강한 권유 대신 재안내 경로가 필요합니다." : "보호자 동행 여부를 함께 확인하면 연계 성공률이 올라갑니다.",
          "상대방 선택에 따라 재상담/보호자 전환 경로를 열어두세요.",
        ],
        scriptBody:
          "연계 진행 여부를 지금 확정하기 어려우시면 가능한 시간만 먼저 정하고, 담당자가 다시 안내드리겠습니다.",
      },
      {
        id: "RAG-S2-03",
        title: isDueSoon ? "추적 일정 우선형" : "후속조치 확정형",
        useCase: isDueSoon ? "SLA 임박/지연으로 일정 확정이 필요한 경우" : "분기 확정 후 후속조치 생성이 필요한 경우",
        evidence: [
          isDueSoon ? "SLA 임박 상태로 일정 확정/재요청 우선 처리가 필요합니다." : "분기 확정 후 추적/사례관리/감별검사 연계를 생성해야 합니다.",
          isAgentMode ? "Agent 안내 결과를 담당자가 확인 후 확정해야 합니다." : "상담/문자 결과를 즉시 기록하면 누락이 줄어듭니다.",
          "추천 문구는 운영 참고이며 최종 결정과 확정은 담당자 책임입니다.",
        ],
        scriptBody: isDueSoon
          ? "일정 지연을 막기 위해 가능한 시간대를 먼저 정하고, 필요한 연계는 바로 등록하겠습니다."
          : "오늘 확인한 내용을 기준으로 후속조치와 다음 일정을 함께 확정하겠습니다.",
      },
    ];

    return stage2Candidates;
  }

  const candidates: RagRecommendation[] = [
    {
      id: "RAG-GUIDE-01",
      title: isVulnerable ? "보호자 우선 확인형" : "기본 안내형",
      useCase: isVulnerable ? "보호자 주연락 또는 고령/이해 어려움 대상" : "초기 접촉, 민감 이력 낮음",
      evidence: [
        `위험 신호: ${riskTop.join(", ") || "기초 신호 확인"}`,
        isVulnerable ? "취약군 트리거가 있어 안내 속도를 낮추는 것이 안전합니다." : "현재 위험 신호가 급격하지 않아 기본 안내가 적합합니다.",
        "연락 목적은 센터 안내 및 예약/연계 확인으로 한정합니다.",
      ],
      scriptBody: isVulnerable
        ? "현재 안내는 센터 절차 확인을 위한 연락입니다. 본인 응답이 어려우시면 보호자와 함께 일정을 조율하겠습니다."
        : "현재 연락은 센터 안내와 예약 절차 확인을 위한 연락입니다. 응답 가능한 채널을 알려주시면 바로 연결하겠습니다.",
    },
    {
      id: "RAG-GUIDE-02",
      title: hasComplaint || hasRefusal ? "민감 이력 완충형" : "재시도 계획형",
      useCase: hasComplaint || hasRefusal ? "민원/거부 이력이 있는 케이스" : "무응답 또는 일정 조율이 필요한 케이스",
      evidence: [
        hasComplaint ? "민원 이력이 있어 설명 길이를 줄이고 선택지를 명확히 제시해야 합니다." : "최근 재접촉 필요 신호가 있어 시간대 옵션 제시가 필요합니다.",
        hasRefusal ? "거부 이력이 있어 강한 권유 대신 다음 선택지를 확인해야 합니다." : "지속 무응답 시 보호자/채널 전환 준비가 필요합니다.",
        "상대방 요청에 따라 언제든 상담사 직접 연결로 전환 가능합니다.",
      ],
      scriptBody:
        "안내 내용이 길지 않게 핵심만 전달드리겠습니다. 지금 바로 결정이 어려우시면 가능한 시간만 남겨주셔도 됩니다.",
    },
    {
      id: "RAG-GUIDE-03",
      title: isAgentMode ? "Agent 수행 점검형" : "SLA 우선 대응형",
      useCase: isAgentMode ? "자동 문자 수행 결과를 운영자가 검토할 때" : "SLA 임박/지연 상태 케이스",
      evidence: [
        isDueSoon ? "SLA 임박/지연 상태로 후속 일정 확정이 우선입니다." : "현재 SLA는 안정 구간이나 다음 연락 시점 기록이 필요합니다.",
        isAgentMode ? "Agent 수행 결과를 확인한 뒤 Step3/4를 운영자가 수동 확정해야 합니다." : "통화/문자 실행 후 응답 결과를 즉시 기록하면 누락이 줄어듭니다.",
        "추천은 운영 참고이며 실행 주체는 담당자입니다.",
      ],
      scriptBody: isAgentMode
        ? "자동 안내 결과를 확인했습니다. 이어서 담당자가 후속 절차를 안내드리겠습니다."
        : "일정을 바로 확정하기 어려우시면 재연락 시간을 먼저 등록하고 후속 안내를 이어가겠습니다.",
    },
  ];

  return candidates.slice(0, 3);
}

function remainingTimeText(targetIso: string | undefined, nowMs: number) {
  if (!targetIso) return "-";
  const target = new Date(targetIso).getTime();
  if (Number.isNaN(target)) return "-";

  const diffMs = target - nowMs;
  const abs = Math.abs(diffMs);
  const hours = Math.floor(abs / (1000 * 60 * 60));
  const mins = Math.floor((abs % (1000 * 60 * 60)) / (1000 * 60));

  if (diffMs >= 0) {
    return `${hours}시간 ${mins}분 남음`;
  }
  return `${hours}시간 ${mins}분 경과`;
}

function eventToCategory(event: ContactEvent): TimelineFilter {
  if (event.type === "CALL_ATTEMPT") return "CALL";
  if (
    event.type === "SMS_RESERVATION_RESERVED" ||
    event.type === "SMS_RESERVATION_CANCELLED" ||
    event.type === "SMS_RESERVATION_CHANGED" ||
    event.type === "SMS_RESERVATION_NO_SHOW"
  ) {
    return "SMS";
  }
  if (event.type === "INCONSISTENT_SMS_STATUS") return "STATUS";
  if (event.type === "MESSAGE_SENT") {
    if (event.summary.includes("STAGE1_RESPONSE_RECORDED") || event.summary.includes("STAGE2_RESPONSE_RECORDED")) {
      return "STATUS";
    }
    return "SMS";
  }
  if (event.type === "SMS_SENT" || event.type === "AGENT_SMS_SENT") return "SMS";
  return "STATUS";
}

function eventTitle(event: ContactEvent) {
  if (event.type === "CALL_ATTEMPT") {
    if (event.result === "SUCCESS") return "연락 성공";
    if (event.result === "NO_ANSWER") return "부재";
    if (event.result === "REJECTED") return "연락 거절";
    return "번호 오류";
  }
  if (event.type === "SMS_SENT") {
    return `문자 발송 (${resolveSmsTemplateLabel(event.templateId)})`;
  }
  if (event.type === "MESSAGE_SENT") {
    if (event.summary.includes("STAGE1_RESPONSE_RECORDED") || event.summary.includes("STAGE2_RESPONSE_RECORDED")) {
      return "반응 처리 기록";
    }
    return "예약 확인 문자 발송";
  }
  if (event.type === "SMS_RESERVATION_RESERVED") return "[SMS] 시민 예약 완료";
  if (event.type === "SMS_RESERVATION_CANCELLED") return "[SMS] 시민 예약 취소";
  if (event.type === "SMS_RESERVATION_CHANGED") return "[SMS] 시민 예약 변경";
  if (event.type === "SMS_RESERVATION_NO_SHOW") return "[SMS] 시민 예약 노쇼";
  if (event.type === "INCONSISTENT_SMS_STATUS") return "문자 발송 상태 확인 필요";
  if (event.type === "LEVEL_CHANGE") {
    return `개입 레벨 변경 ${event.from} → ${event.to}`;
  }
  if (event.type === "POLICY_GATE_UPDATE") {
    return `정책 게이트 업데이트 (${event.key})`;
  }
  if (event.type === "OUTCOME_RECORDED") {
    return `응답 결과 기록 (${OUTCOME_LABELS[event.outcomeCode].label})`;
  }
  if (event.type === "CALENDAR_SYNC") {
    return event.status === "SUCCESS" ? "캘린더 일정 등록" : "캘린더 일정 등록 실패";
  }
  if (event.type === "CAL_EVENT_CREATED") return "캘린더 이벤트 생성";
  if (event.type === "STRATEGY_CHANGE") {
    return `접촉 전략 변경 ${STRATEGY_LABELS[event.from]} → ${STRATEGY_LABELS[event.to]}`;
  }
  if (event.type === "AGENT_JOB_QUEUED") return "Agent 자동 수행 예약";
  if (event.type === "AGENT_JOB_STARTED") return "Agent 자동 수행 시작";
  if (event.type === "AGENT_SMS_SENT") return "Agent 문자 발송";
  if (event.type === "AGENT_JOB_SUCCEEDED") return "Agent 자동 수행 성공";
  if (event.type === "AGENT_JOB_FAILED") return "Agent 자동 수행 실패";
  if (event.type === "AGENT_JOB_CANCELED") return "Agent 자동 수행 취소";
  if (event.type === "CONTACT_STRATEGY_CHANGED") return "접촉 전략 변경";
  if (event.type === "OPERATOR_OVERRIDE_TO_HUMAN") return "운영자 수동 전환";
  if (event.type === "REEVAL_SCHEDULED") return "진단/재평가 일정 생성";
  if (event.type === "REEVAL_RESCHEDULED") return "진단/재평가 일정 변경";
  if (event.type === "REEVAL_COMPLETED") return "진단/재평가 완료";
  if (event.type === "REEVAL_NOSHOW") return "진단/재평가 노쇼";
  if (event.type === "PLAN_CREATED") return "플랜 생성";
  if (event.type === "PLAN_UPDATED") return "플랜 업데이트";
  if (event.type === "PROGRAM_STARTED") return "프로그램 시작";
  if (event.type === "PROGRAM_COMPLETED") return "프로그램 완료";
  if (event.type === "PROGRAM_STOPPED") return "프로그램 중단";
  if (event.type === "LINKAGE_CREATED") return "연계 생성";
  if (event.type === "LINKAGE_APPROVED") return "연계 승인";
  if (event.type === "LINKAGE_COMPLETED") return "연계 완료";
  if (event.type === "STAGE3_ACTION_DECISION") return "운영 권고 처리";
  if (event.type === "RISK_SERIES_UPDATED") return "운영 지표 시계열 업데이트";
  if (event.type === "RISK_REVIEWED") return "운영 지표 검토";
  if (event.type === "DIFF_RECO_CREATED") return "진단검사 경로 제안 생성";
  if (event.type === "DIFF_REFER_CREATED") return "진단검사 의뢰 생성";
  if (event.type === "DIFF_SCHEDULED") return "진단검사 예약 생성";
  if (event.type === "DIFF_COMPLETED") return "진단검사 경로 완료";
  if (event.type === "DIFF_RESULT_APPLIED") return "진단검사 결과 입력";
  if (event.type === "PROGRAM_SELECTED") return "프로그램 선택";
  if (event.type === "PROGRAM_EXEC_UPDATED") return "프로그램 실행 업데이트";
  if (event.type === "PROGRAM_EXEC_COMPLETED") return "프로그램 실행 완료";
  if (event.type === "NEXT_TRACKING_SET") return "다음 추적 일정 설정";
  if (event.type === "STAGE2_PLAN_CONFIRMED") return "Stage2 검사 계획 확정";
  if (event.type === "STAGE2_RESULTS_RECORDED") return "Stage2 검사 결과 입력 완료";
  if (event.type === "STAGE2_STEP2_AUTOFILL_APPLIED") return "Stage2 STEP2 자동 기입 적용";
  if (event.type === "STAGE2_MANUAL_EDIT_APPLIED") return "Stage2 STEP2 수동 수정 반영";
  if (event.type === "STAGE2_CLASS_CONFIRMED") return "Stage2 분류 확정";
  if (event.type === "STAGE2_NEXT_STEP_SET") return "Stage2 다음 단계 결정";
  if (event.type === "INFERENCE_REQUESTED") return `Stage${event.stage} 모델 실행 요청`;
  if (event.type === "INFERENCE_STARTED") return `Stage${event.stage} 모델 실행 시작`;
  if (event.type === "INFERENCE_PROGRESS") return `Stage${event.stage} 모델 실행 진행`;
  if (event.type === "INFERENCE_COMPLETED") return `Stage${event.stage} 모델 실행 완료`;
  if (event.type === "INFERENCE_FAILED") return `Stage${event.stage} 모델 실행 실패`;
  return `상태 변경 ${event.from} → ${event.to}`;
}

function eventDetail(event: ContactEvent) {
  if (event.type === "CALL_ATTEMPT") {
    return event.note ?? "연락 결과 기록";
  }
  if (event.type === "SMS_SENT") {
    return `발송 상태: ${event.status}`;
  }
  if (event.type === "MESSAGE_SENT") {
    return event.summary;
  }
  if (
    event.type === "SMS_RESERVATION_RESERVED" ||
    event.type === "SMS_RESERVATION_CANCELLED" ||
    event.type === "SMS_RESERVATION_CHANGED" ||
    event.type === "SMS_RESERVATION_NO_SHOW"
  ) {
    const chunks = [event.programName, event.scheduledAt ? formatDateTime(event.scheduledAt) : undefined].filter(Boolean);
    return chunks.length > 0 ? chunks.join(" · ") : event.summary;
  }
  if (event.type === "INCONSISTENT_SMS_STATUS") {
    return [event.summary, event.detail].filter(Boolean).join(" · ");
  }
  if (event.type === "LEVEL_CHANGE") {
    return event.reason;
  }
  if (event.type === "POLICY_GATE_UPDATE") {
    return `상태: ${event.status}`;
  }
  if (event.type === "OUTCOME_RECORDED") {
    const detail: string[] = [];
    if (event.reasonTags && event.reasonTags.length > 0) {
      detail.push(`보조사유 ${event.reasonTags.map((tag) => RESPONSE_REASON_TAG_META[tag].label).join(", ")}`);
    }
    if (event.rejectCode) detail.push(`거부코드 ${event.rejectCode}`);
    if (event.rejectLevel) detail.push(`레벨 ${event.rejectLevel}`);
    if (event.recontactStrategy) detail.push(`재접촉 전략 ${event.recontactStrategy}`);
    if (event.nextContactAt) detail.push(`다음 접촉 ${formatDateTime(event.nextContactAt)}`);
    if (event.note) detail.push(event.note);
    return detail.length > 0 ? detail.join(" · ") : "응답 결과 저장";
  }
  if (event.type === "CALENDAR_SYNC") {
    const base = `${event.title} · ${formatDateTime(event.scheduledAt)}`;
    return event.status === "FAILED" ? `${base} · ${event.error ?? "재시도 필요"}` : base;
  }
  if (event.type === "CAL_EVENT_CREATED") {
    return `${formatDateTime(event.scheduledAt)} · ${event.summary}`;
  }
  if (event.type === "AGENT_SMS_SENT") {
    return `${event.summary} · 결과 ${AGENT_CHANNEL_RESULT_LABELS[event.channelResult]}${event.detail ? ` · ${event.detail}` : ""}`;
  }
  if (
    event.type === "AGENT_JOB_QUEUED" ||
    event.type === "AGENT_JOB_STARTED" ||
    event.type === "AGENT_JOB_SUCCEEDED" ||
    event.type === "AGENT_JOB_FAILED" ||
    event.type === "AGENT_JOB_CANCELED" ||
    event.type === "CONTACT_STRATEGY_CHANGED" ||
    event.type === "OPERATOR_OVERRIDE_TO_HUMAN"
  ) {
    return [event.summary, event.detail].filter(Boolean).join(" · ");
  }
  if (event.type === "REEVAL_SCHEDULED") {
    return `${formatDateTime(event.scheduledAt)} · ${event.reason ?? "재평가 일정 생성"}`;
  }
  if (event.type === "REEVAL_RESCHEDULED") {
    return `${formatDateTime(event.from)} → ${formatDateTime(event.to)}${event.reason ? ` · ${event.reason}` : ""}`;
  }
  if (event.type === "REEVAL_COMPLETED" || event.type === "REEVAL_NOSHOW") {
    return event.note ?? "재평가 실행 결과 기록";
  }
  if (event.type === "PLAN_CREATED" || event.type === "PLAN_UPDATED") {
    return event.summary;
  }
  if (event.type === "PROGRAM_STARTED" || event.type === "PROGRAM_COMPLETED" || event.type === "PROGRAM_STOPPED") {
    return event.summary;
  }
  if (event.type === "LINKAGE_CREATED" || event.type === "LINKAGE_APPROVED" || event.type === "LINKAGE_COMPLETED") {
    return `${event.linkageType} · ${event.summary ?? "연계 상태 반영"}`;
  }
  if (event.type === "STAGE3_ACTION_DECISION") {
    return `${event.actionId} · ${event.decision}${event.note ? ` · ${event.note}` : ""}`;
  }
  if (
    event.type === "RISK_SERIES_UPDATED" ||
    event.type === "RISK_REVIEWED" ||
    event.type === "DIFF_RECO_CREATED" ||
    event.type === "DIFF_REFER_CREATED" ||
    event.type === "DIFF_SCHEDULED" ||
    event.type === "DIFF_COMPLETED" ||
    event.type === "DIFF_RESULT_APPLIED" ||
    event.type === "PROGRAM_SELECTED" ||
    event.type === "PROGRAM_EXEC_UPDATED" ||
    event.type === "PROGRAM_EXEC_COMPLETED" ||
    event.type === "STAGE2_PLAN_CONFIRMED" ||
    event.type === "STAGE2_RESULTS_RECORDED" ||
    event.type === "STAGE2_STEP2_AUTOFILL_APPLIED" ||
    event.type === "STAGE2_MANUAL_EDIT_APPLIED" ||
    event.type === "STAGE2_CLASS_CONFIRMED" ||
    event.type === "STAGE2_NEXT_STEP_SET"
  ) {
    return event.summary;
  }
  if (
    event.type === "INFERENCE_REQUESTED" ||
    event.type === "INFERENCE_STARTED" ||
    event.type === "INFERENCE_COMPLETED" ||
    event.type === "INFERENCE_FAILED"
  ) {
    return `${event.summary}${event.reason ? ` · ${event.reason}` : ""}`;
  }
  if (event.type === "INFERENCE_PROGRESS") {
    return `${event.summary} · ${Math.round(event.progress)}%${event.etaSeconds != null ? ` · ETA ${formatEtaLabel(event.etaSeconds)}` : ""}`;
  }
  if (event.type === "NEXT_TRACKING_SET") {
    return `${formatDateTime(event.nextAt)}${event.summary ? ` · ${event.summary}` : ""}`;
  }
  return event.reason;
}

function dataQualityText(level: DataQualityLevel) {
  if (level === "GOOD") return "정상";
  if (level === "WARN") return "주의";
  return "우선순위 제외";
}

function slaText(level: SlaLevel) {
  if (level === "OK") return "정상";
  if (level === "DUE_SOON") return "임박";
  return "지연";
}

function todoTone(priority: TodoItem["priority"]) {
  if (priority === 1) return "border-red-200 bg-red-50 text-red-700";
  if (priority === 2) return "border-orange-200 bg-orange-50 text-orange-700";
  return "border-blue-200 bg-blue-50 text-blue-700";
}

function gateTone(status: PolicyGate["status"]) {
  if (status === "PASS") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "FAIL") return "border-red-200 bg-red-50 text-red-700";
  return "border-gray-200 bg-gray-50 text-gray-600";
}

function channelTone(state: ChannelState) {
  if (state === "OK") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (state === "RESTRICTED") return "border-red-200 bg-red-50 text-red-700";
  return "border-gray-200 bg-gray-50 text-gray-600";
}

function channelStateLabel(state: ChannelState) {
  if (state === "OK") return "충족";
  if (state === "RESTRICTED") return "제한";
  return "확인 필요";
}

function channelStateSummary(state: ChannelState) {
  if (state === "OK") return "발신 가능";
  if (state === "RESTRICTED") return "차단/오류 발생";
  return "채널 검증 필요";
}

function hasChannelRestriction(reason?: string) {
  if (!reason) return false;
  return /차단|오류|불가|제한/.test(reason);
}

function resolveAgentGateStatus(gates: PolicyGate[]): GateStatus {
  const requiredKeys: PolicyGateKey[] = ["CONSENT_OK", "CONTACTABLE_TIME_OK", "PHONE_VERIFIED"];
  const required = gates.filter((gate) => requiredKeys.includes(gate.key));
  if (required.some((gate) => gate.status === "FAIL")) return "BLOCKED";
  if (required.some((gate) => gate.status !== "PASS")) return "NEEDS_CHECK";
  return "PASS";
}

function buildAgentIdempotencyKey(caseId: string, contactAttemptNo: number, channel: "SMS", templateVersion: string) {
  return `${caseId}:${contactAttemptNo}:${channel}:${templateVersion}`;
}

function agentTriggerLabel(trigger: AgentJobTrigger) {
  if (trigger === "AUTO_ON_ENTER") return "케이스 진입 자동 수행";
  if (trigger === "AUTO_ON_STRATEGY") return "접촉 기준 변경 자동 수행";
  if (trigger === "AUTO_ON_RETRY_DUE") return "재시도 도래 자동 수행";
  if (trigger === "MANUAL_RETRY_NOW") return "운영자 즉시 재시도";
  return "운영자 재시도 예약";
}

function evaluateMockAgentDispatch({
  caseRecord,
  gates,
  attemptNo,
}: {
  caseRecord?: CaseRecord;
  gates: PolicyGate[];
  attemptNo: number;
}): { success: boolean; channelResult: ChannelResult; errorCode?: string; errorMessage?: string } {
  const phoneGate = gates.find((gate) => gate.key === "PHONE_VERIFIED");
  const phone = caseRecord?.profile.phone;
  if (phoneGate?.status !== "PASS" || !phone) {
    return {
      success: false,
      channelResult: "FAILED",
      errorCode: "PHONE_INVALID",
      errorMessage: "전화번호 검증이 완료되지 않아 자동 발송이 차단되었습니다.",
    };
  }

  if ((caseRecord?.alertTags ?? []).includes("재평가 필요") && attemptNo === 1) {
    return {
      success: false,
      channelResult: "FAILED",
      errorCode: "CHANNEL_TEMP_ERROR",
      errorMessage: "채널 응답 오류로 자동 발송이 실패했습니다.",
    };
  }

  return {
    success: true,
    channelResult: "SENT",
  };
}

const mockAgentService = {
  queueSms({
    caseId,
    idempotencyKey,
  }: {
    caseId: string;
    idempotencyKey: string;
  }) {
    return {
      ok: true,
      jobId: `agent-job:${caseId}:${idempotencyKey}`,
      queuedAt: nowIso(),
    };
  },
  cancelJob(jobId?: string) {
    if (!jobId) return { ok: false };
    return { ok: true };
  },
};

function getGateFailureReason(gates: PolicyGate[], required: PolicyGateKey[]) {
  const failed = gates.find((gate) => required.includes(gate.key) && gate.status !== "PASS");
  return failed?.failReason ?? (failed ? `${failed.label} 확인 필요` : undefined);
}

function callResultLabel(result: OutcomeDraft extends { mode: "CALL"; result: infer R } ? R : never) {
  if (result === "SUCCESS") return "연락 성공";
  if (result === "NO_ANSWER") return "부재";
  if (result === "REJECTED") return "거절";
  return "번호 오류";
}

function smsResultLabel(result: SmsDispatchStatus) {
  if (result === "DELIVERED") return "전송 완료";
  if (result === "FAILED") return "전송 실패";
  return "전송 예약";
}

function smsMessageTypeLabel(type: SmsTemplate["messageType"]) {
  if (type === "CONTACT") return "접촉";
  if (type === "BOOKING") return "예약안내";
  return "리마인더";
}

function resolveSmsTemplateLabel(templateId: string) {
  const normalized = templateId.split("(")[0];
  const match = [...SMS_TEMPLATES, ...STAGE2_SMS_TEMPLATES, ...STAGE3_SMS_TEMPLATES].find((template) => template.id === normalized);
  return match ? `${smsMessageTypeLabel(match.messageType)} · ${match.label}` : templateId;
}

import { sendSmsApi as sendSmsApiCommon } from "../../sms/smsService";

/* ── 접촉 전략 관련 상수 / 유틸 ── */

const STRATEGY_LABELS: Record<ContactStrategy, string> = {
  HUMAN_FIRST: "상담사 우선",
  AI_FIRST: "자동안내 우선",
  MANUAL_OVERRIDE: "수동 전환",
};

const STRATEGY_TONES: Record<ContactStrategy, string> = {
  HUMAN_FIRST: "border-red-200 bg-red-50 text-red-700",
  AI_FIRST: "border-blue-200 bg-blue-50 text-blue-700",
  MANUAL_OVERRIDE: "border-amber-200 bg-amber-50 text-amber-700",
};

const STRATEGY_HELPER_TEXT = "접촉 전략은 사전 기준(룰)에 따라 추천되며, 최종 실행/전환은 담당자가 수행합니다.";

const TRIGGER_REASON_LABELS: Record<string, string> = {
  AGE_OVER_THRESHOLD: "고령 기준에 해당되어 상담사 우선 안내가 권고됩니다.",
  HAS_MCI_HISTORY: "이전 인지저하 이력이 있어 상담사 확인이 우선입니다.",
  HAS_DEMENTIA_HISTORY: "치매 관련 이력이 있어 상담사 직접 안내가 필요합니다.",
  HAS_COMPLAINT_HISTORY: "과거 민원 이력이 있어 상담사 우선 대응이 권고됩니다.",
  HAS_REFUSAL_HISTORY: "거부 이력이 있어 상담사 확인 후 접촉이 안전합니다.",
  GUARDIAN_PRIMARY: "보호자가 주 연락 대상이라 보호자 우선 안내가 필요합니다.",
  NEEDS_GUARDIAN_SUPPORT: "본인 단독 응답이 어려울 수 있어 보호자 확인이 필요합니다.",
  COMPREHENSION_DIFFICULTY: "이해 어려움 가능성이 있어 상담사 우선 안내가 권고됩니다.",
  STANDARD_CONTACT_PATH: "일반 기준에 해당되어 자동 안내 우선이 가능합니다.",
  CALL_RESPONSE_POOR: "최근 전화 응답률이 낮아 접촉 방식 조정이 필요합니다.",
  SMS_RESPONSE_POOR: "최근 문자 응답률이 낮아 접촉 방식 조정이 필요합니다.",
};

function explainStrategyTrigger(trigger: string) {
  if (trigger.startsWith("수동 전환:")) {
    return `담당자 수동 변경 사유: ${trigger.replace("수동 전환:", "").trim()}`;
  }
  return TRIGGER_REASON_LABELS[trigger] ?? trigger;
}

const OUTCOME_LABELS: Record<OutcomeCode, { label: string; tone: string }> = {
  CONTINUE_SELF: { label: "계속 진행", tone: "border-emerald-200 bg-emerald-50 text-emerald-700" },
  SCHEDULE_LATER: { label: "나중에", tone: "border-blue-200 bg-blue-50 text-blue-700" },
  REQUEST_GUARDIAN: { label: "보호자 연결", tone: "border-violet-200 bg-violet-50 text-violet-700" },
  REQUEST_HUMAN: { label: "상담사 연결", tone: "border-orange-200 bg-orange-50 text-orange-700" },
  REFUSE: { label: "중단/거부", tone: "border-red-200 bg-red-50 text-red-700" },
  NO_RESPONSE: { label: "무응답 처리", tone: "border-gray-200 bg-gray-50 text-gray-600" },
  CONFUSED: { label: "이해 어려움", tone: "border-amber-200 bg-amber-50 text-amber-700" },
  EMOTIONAL: { label: "감정적 반응", tone: "border-yellow-200 bg-yellow-50 text-yellow-700" },
};

const RESPONSE_PRIMARY_OUTCOMES: OutcomeCode[] = [
  "CONTINUE_SELF",
  "SCHEDULE_LATER",
  "REQUEST_GUARDIAN",
  "REQUEST_HUMAN",
  "NO_RESPONSE",
  "REFUSE",
];

const RESPONSE_REASON_TAG_META: Record<ResponseReasonTag, { label: string; hint: string; tone: string }> = {
  CONFUSION: {
    label: "이해 어려움",
    hint: "설명이 반복되거나 맥락 이해가 어려운 반응",
    tone: "border-amber-200 bg-amber-50 text-amber-700",
  },
  EMOTIONAL: {
    label: "감정적 반응",
    hint: "불안/항의 등 감정 자극 반응",
    tone: "border-yellow-200 bg-yellow-50 text-yellow-700",
  },
};

const NO_RESPONSE_CHANNEL_STRATEGY: Record<"CALL" | "SMS", RecontactStrategy> = {
  CALL: "CALL_RETRY",
  SMS: "SMS_RETRY",
};

const NO_RESPONSE_CHANNEL_LABEL: Record<"CALL" | "SMS", string> = {
  CALL: "전화",
  SMS: "문자",
};

const OUTCOME_TO_API_TYPE: Record<OutcomeCode, OutcomeType> = {
  CONTINUE_SELF: "PROCEED",
  SCHEDULE_LATER: "LATER",
  REQUEST_GUARDIAN: "PROTECTOR_LINK",
  REQUEST_HUMAN: "COUNSELOR_LINK",
  REFUSE: "REJECT",
  NO_RESPONSE: "NO_RESPONSE",
  CONFUSED: "HARD_TO_UNDERSTAND",
  EMOTIONAL: "EMOTIONAL",
};

const CONTACT_EXECUTOR_LABELS: Record<ContactExecutor, string> = {
  HUMAN: "사람 직접 접촉",
  AGENT_SEND_ONLY: "Agent 접촉(문자 자동)",
};

const CONTACT_EXECUTOR_TONES: Record<ContactExecutor, string> = {
  HUMAN: "border-blue-200 bg-blue-50 text-blue-700",
  AGENT_SEND_ONLY: "border-violet-200 bg-violet-50 text-violet-700",
};

const AGENT_RESULT_LABELS: Record<AgentContactResult, string> = {
  SENT_SUCCESS: "발송 성공",
  SENT_FAILED: "발송 실패",
  NO_RESPONSE: "응답 없음",
  WAITING: "응답 대기",
};

const AGENT_JOB_STATUS_LABELS: Record<AgentJobStatus, string> = {
  IDLE: "대기",
  QUEUED: "예약됨",
  RUNNING: "수행중",
  SUCCEEDED: "성공",
  FAILED: "실패",
  CANCELED: "취소",
};

const AGENT_CHANNEL_RESULT_LABELS: Record<ChannelResult, string> = {
  SENT: "발송됨",
  DELIVERED: "전달 완료",
  FAILED: "실패",
  UNKNOWN: "결과 미수신",
};

const STAGE3_RISK_NEXT_ACTION_LABELS: Record<Stage3RiskReviewDraft["nextAction"], string> = {
  RECOMMEND_DIFF: "감별경로 권고 강화",
  HOLD: "추세 관찰 유지",
  UPDATE_PLAN: "플랜 업데이트 우선",
};

const FOLLOW_UP_ROUTE_META: Record<
  FollowUpRoute,
  {
    label: string;
    description: string;
    linkageStatus: LinkageStatus;
    reservationType: string;
    defaultPlace: string;
  }
> = {
  CENTER_VISIT_BOOKING: {
    label: "안심센터 방문 예약",
    description: "센터 방문 일정으로 후속 상담/검사 예약",
    linkageStatus: "BOOKING_IN_PROGRESS",
    reservationType: "안심센터 방문",
    defaultPlace: "강남구 치매안심센터",
  },
  HOSPITAL_REFERRAL_BOOKING: {
    label: "병원 의뢰/예약",
    description: "병원 의뢰 연계 후 예약 안내",
    linkageStatus: "REFERRAL_CREATED",
    reservationType: "병원 의뢰/예약",
    defaultPlace: "협력 병원",
  },
  COUNSELING_CENTER_BOOKING: {
    label: "치매상담소 예약",
    description: "상담소 연계 일정 확정",
    linkageStatus: "BOOKING_DONE",
    reservationType: "치매상담소 예약",
    defaultPlace: "지역 치매상담소",
  },
  HOLD_TRACKING: {
    label: "보류/추적",
    description: "재접촉 추적 일정으로 관리",
    linkageStatus: "NOT_CREATED",
    reservationType: "추적 관리",
    defaultPlace: "전화/문자 추적",
  },
};

const REJECT_REASON_OPTIONS: Array<{ code: RejectReasonCode; label: string }> = [
  { code: "R1_SELF_REJECT", label: "본인 거부" },
  { code: "R2_GUARDIAN_REJECT", label: "보호자 거부" },
  { code: "R3_OTHER_INSTITUTION", label: "타 기관 이용" },
  { code: "R4_ALREADY_DIAGNOSED", label: "이미 진단/관리 중" },
  { code: "R5_CONTACT_INVALID", label: "연락처 오류" },
  { code: "R6_EMOTIONAL_BACKLASH", label: "감정 반응 우려" },
  { code: "R7_OTHER", label: "기타" },
];

const REJECT_LEVEL_OPTIONS: Array<{ value: RejectLevel; label: string }> = [
  { value: "TEMP", label: "일시 거부" },
  { value: "FINAL", label: "최종 거부" },
];

const CONTACT_FLOW_STEPS_META: Array<{ step: ContactFlowStep; label: string; description: string }> = [
  { step: "PRE_TRIAGE", label: "A. 사전 확인", description: "기초 정보와 이력 확인" },
  { step: "STRATEGY", label: "B. 접촉 주체", description: "상담사 우선/자동안내 우선 적용" },
  { step: "COMPOSE", label: "C. 접촉 준비", description: "문자/전화 실행 준비" },
  { step: "SEND", label: "D. 접촉 진행", description: "응답 확인 및 기록" },
  { step: "RESPONSE", label: "E. 분기 처리", description: "유지/전환/보류/중단 처리" },
  { step: "OUTCOME", label: "F. 후속 생성", description: "예약/의뢰/추적 등록" },
];

const STAGE2_CONTACT_FLOW_STEPS_META: Array<{ step: ContactFlowStep; label: string; description: string }> = [
  { step: "PRE_TRIAGE", label: "A. 근거 확인", description: "2차 평가 자료와 필수 항목 확인" },
  { step: "STRATEGY", label: "B. 결과 점검", description: "결과 입력 및 담당자 확인 체크" },
  { step: "COMPOSE", label: "C. 분기 설정", description: "정상/MCI/AD 의심 및 운영 강도 설정" },
  { step: "SEND", label: "D. 연계 준비", description: "연계 기관/채널/일정 준비" },
  { step: "RESPONSE", label: "E. 연계 실행", description: "의뢰/예약 실행 및 결과 기록" },
  { step: "OUTCOME", label: "F. 확정/후속", description: "담당자 확정 및 후속조치 생성" },
];

const STAGE3_CONTACT_FLOW_STEPS_META: Array<{ step: ContactFlowStep; label: string; description: string }> = [
  { step: "PRE_TRIAGE", label: "A. 전환 위험 추적", description: "추세 확인/변동 원인 점검" },
  { step: "STRATEGY", label: "A-2. 추적 기준선", description: "동의/채널/주기/담당자 확인" },
  { step: "COMPOSE", label: "B. 감별경로 권고", description: "감별검사/뇌영상 권고 생성" },
  { step: "SEND", label: "B-2. 의뢰/예약", description: "의뢰서/예약 생성 및 변경" },
  { step: "RESPONSE", label: "C. 정밀관리 제공", description: "프로그램 제공 실행 및 기록" },
  { step: "OUTCOME", label: "D. 관리 제공(프로그램·연계)", description: "프로그램 실행·연계 기록/추적 계획 확정" },
];

const STAGE2_OPS_CONTACT_FLOW_STEPS_META: Array<{ step: ContactFlowStep; label: string; description: string }> = [
  { step: "PRE_TRIAGE", label: "A. 검사 수행 관리", description: "신경심리/임상/전문의 수행 상태 확인" },
  { step: "STRATEGY", label: "A-2. 수행 체크", description: "누락 항목 점검/담당자 확인" },
  { step: "COMPOSE", label: "B. 검사 결과 입력", description: "점수/검사유형/결과 문서 입력" },
  { step: "SEND", label: "B-2. 입력 반영", description: "수행일/기관/근거 연결" },
  { step: "RESPONSE", label: "C. 분류 확정", description: "정상/MCI/치매 분류 및 근거 확정" },
  { step: "OUTCOME", label: "D. 다음 단계 결정", description: "정상 추적/MCI Stage3/치매 감별경로 결정" },
];

const STAGE1_FLOW_CONFIG: Stage1FlowCardConfig[] = [
  {
    id: "PRECHECK",
    title: "사전 조건 확인",
    description: "동의/연락 가능 여부 확인",
    relatedSteps: ["PRE_TRIAGE", "STRATEGY"],
    action: "OPEN_PRECHECK",
  },
  {
    id: "CONTACT_EXECUTION",
    title: "접촉 실행",
    description: "전화·문자 실행 및 기록",
    relatedSteps: ["COMPOSE", "SEND"],
    action: "OPEN_CONTACT_EXECUTION",
  },
  {
    id: "RESPONSE_HANDLING",
    title: "반응 처리",
    description: "응답 결과/무응답/상담 전환 처리",
    relatedSteps: ["RESPONSE"],
    action: "OPEN_RESPONSE_HANDLING",
  },
  {
    id: "FOLLOW_UP",
    title: "후속 결정",
    description: "유지·보류·연계 및 인수인계 확정",
    relatedSteps: ["OUTCOME"],
    action: "OPEN_FOLLOW_UP",
  },
];

const STAGE2_FLOW_CONFIG: Stage1FlowCardConfig[] = [
  {
    id: "PRECHECK",
    title: "검사 수행 관리",
    description: "검사 예약/수행 상태 및 누락 항목 점검",
    relatedSteps: ["PRE_TRIAGE", "STRATEGY"],
    action: "OPEN_PRECHECK",
  },
  {
    id: "CONTACT_EXECUTION",
    title: "검사 결과 입력",
    description: "MMSE/CDR/신경인지/전문의 소견 입력",
    relatedSteps: ["COMPOSE", "SEND"],
    action: "OPEN_CONTACT_EXECUTION",
  },
  {
    id: "RESPONSE_HANDLING",
    title: "분류 확정",
    description: "정상/MCI/치매 분류 확정",
    relatedSteps: ["RESPONSE"],
    action: "OPEN_RESPONSE_HANDLING",
  },
  {
    id: "FOLLOW_UP",
    title: "다음 단계 결정",
    description: "2년후 선별/Stage3/감별경로 결정",
    relatedSteps: ["OUTCOME"],
    action: "OPEN_FOLLOW_UP",
  },
];

const STAGE3_FLOW_CONFIG: Stage1FlowCardConfig[] = [
  {
    id: "PRECHECK",
    title: "전환 위험 추적(리뷰)",
    description: "시계열 확인/변동 원인 점검",
    relatedSteps: ["PRE_TRIAGE", "STRATEGY"],
    action: "OPEN_PRECHECK",
  },
  {
    id: "CONTACT_EXECUTION",
    title: "정밀검사 연계 경로",
    description: "권고/의뢰/예약 생성",
    relatedSteps: ["COMPOSE", "SEND"],
    action: "OPEN_CONTACT_EXECUTION",
  },
  {
    id: "RESPONSE_HANDLING",
    title: "정밀관리 제공",
    description: "프로그램 선택/실행 필드 기록",
    relatedSteps: ["RESPONSE"],
    action: "OPEN_RESPONSE_HANDLING",
  },
  {
    id: "FOLLOW_UP",
    title: "관리 제공(프로그램·연계)",
    description: "프로그램 실행·연계 기록/추적 계획 확정",
    relatedSteps: ["OUTCOME"],
    action: "OPEN_FOLLOW_UP",
  },
];

const STAGE2_OPS_FLOW_CONFIG: Stage1FlowCardConfig[] = [
  {
    id: "PRECHECK",
    title: "검사 수행 관리",
    description: "신경심리검사/임상평가/전문의 진찰 수행 상태 점검",
    relatedSteps: ["PRE_TRIAGE", "STRATEGY"],
    action: "OPEN_PRECHECK",
  },
  {
    id: "CONTACT_EXECUTION",
    title: "검사 결과 입력",
    description: "점수 입력/검사 종류 선택/수행 근거 기록",
    relatedSteps: ["COMPOSE", "SEND"],
    action: "OPEN_CONTACT_EXECUTION",
  },
  {
    id: "RESPONSE_HANDLING",
    title: "분류 확정",
    description: "정상/MCI/치매 분류 확정",
    relatedSteps: ["RESPONSE"],
    action: "OPEN_RESPONSE_HANDLING",
  },
  {
    id: "FOLLOW_UP",
    title: "다음 단계 결정",
    description: "정상 추적/MCI Stage3/치매 감별경로 결정",
    relatedSteps: ["OUTCOME"],
    action: "OPEN_FOLLOW_UP",
  },
];

const STAGE1_STEP_MODAL_MAP: Record<Stage1FlowAction, Stage1FlowCardId> = {
  OPEN_PRECHECK: "PRECHECK",
  OPEN_CONTACT_EXECUTION: "CONTACT_EXECUTION",
  OPEN_RESPONSE_HANDLING: "RESPONSE_HANDLING",
  OPEN_FOLLOW_UP: "FOLLOW_UP",
};

function getFlowCardLockReason(flowCards: Stage1FlowCard[], targetId: Stage1FlowCardId): string | null {
  const targetIndex = flowCards.findIndex((card) => card.id === targetId);
  if (targetIndex <= 0) return null;

  const canPass = (status: Stage1FlowVisualStatus) => status === "COMPLETED" || status === "READY";
  const blockedBy = flowCards.slice(0, targetIndex).find((card) => !canPass(card.status));
  if (!blockedBy) return null;

  const targetTitle = flowCards[targetIndex]?.title ?? "해당";
  return `${blockedBy.title} 단계를 먼저 완료해야 ${targetTitle} 작업을 열 수 있습니다.`;
}

const FLOW_STATUS_META: Record<
  Stage1FlowVisualStatus,
  {
    label: string;
    icon: React.ComponentType<{ size?: number; className?: string }>;
    cardTone: string;
    chipTone: string;
    reasonTone: string;
  }
> = {
  COMPLETED: {
    label: "완료",
    icon: CheckCircle2,
    cardTone:
      "border-emerald-200 bg-emerald-50/70 text-emerald-900 shadow-sm hover:shadow-emerald-200/70",
    chipTone: "border border-emerald-200 bg-emerald-100 text-emerald-700",
    reasonTone: "border-emerald-200 bg-white/70 text-emerald-800",
  },
  READY: {
    label: "준비",
    icon: Timer,
    cardTone:
      "border-cyan-200 bg-cyan-50/80 text-cyan-900 shadow-sm hover:shadow-cyan-200/60",
    chipTone: "border border-cyan-200 bg-cyan-100 text-cyan-700",
    reasonTone: "border-cyan-200 bg-white/80 text-cyan-900",
  },
  PENDING: {
    label: "대기",
    icon: Clock3,
    cardTone:
      "border-sky-200 bg-sky-50/70 text-slate-900 shadow-sm hover:shadow-sky-200/60",
    chipTone: "border border-sky-200 bg-sky-100 text-sky-700",
    reasonTone: "border-sky-200 bg-white/70 text-slate-700",
  },
  BLOCKED: {
    label: "누락",
    icon: AlertCircle,
    cardTone:
      "border-rose-200 bg-rose-50/80 text-rose-900 shadow-inner hover:shadow-rose-200/50",
    chipTone: "border border-rose-200 bg-rose-100 text-rose-700",
    reasonTone: "border-rose-200 bg-white/70 text-rose-800",
  },
};

const CONTACT_STATUS_HINT: Record<ContactExecutionStatus, string> = {
  NOT_STARTED: "미접촉",
  SENT: "발송 완료",
  WAITING_RESPONSE: "응답 대기",
  RETRY_NEEDED: "재시도 필요",
  HANDOFF_TO_HUMAN: "상담 전환",
  PAUSED: "보류",
  STOPPED: "중단",
  DONE: "완료",
};

const LINKAGE_STATUS_HINT: Record<LinkageStatus, string> = {
  NOT_CREATED: "미생성",
  BOOKING_IN_PROGRESS: "예약중",
  BOOKING_DONE: "예약완료",
  REFERRAL_CREATED: "의뢰생성",
};

const RESERVATION_STATUS_LABELS: Record<ReservationStatus, string> = {
  NONE: "미생성",
  RESERVED: "예약 완료",
  CANCELLED: "예약 취소",
  CHANGED: "예약 변경",
  NO_SHOW: "노쇼",
};

const SMS_RESERVATION_EVENT_TYPE_BY_STATUS: Record<
  Exclude<ReservationStatus, "NONE">,
  "SMS_RESERVATION_RESERVED" | "SMS_RESERVATION_CANCELLED" | "SMS_RESERVATION_CHANGED" | "SMS_RESERVATION_NO_SHOW"
> = {
  RESERVED: "SMS_RESERVATION_RESERVED",
  CANCELLED: "SMS_RESERVATION_CANCELLED",
  CHANGED: "SMS_RESERVATION_CHANGED",
  NO_SHOW: "SMS_RESERVATION_NO_SHOW",
};

function mapReservationStatusToOutcome(status: ReservationStatus): OutcomeCode {
  if (status === "CANCELLED") return "SCHEDULE_LATER";
  if (status === "NO_SHOW") return "NO_RESPONSE";
  return "CONTINUE_SELF";
}

function toReservationStatus(status: SmsReservationSyncEvent["status"]): Exclude<ReservationStatus, "NONE"> {
  if (status === "CANCELLED") return "CANCELLED";
  if (status === "CHANGED") return "CHANGED";
  if (status === "NO_SHOW") return "NO_SHOW";
  return "RESERVED";
}

function buildReservationSummary(reservation: ReservationSnapshot | undefined) {
  if (!reservation || reservation.status === "NONE") return "예약 정보 미수신";
  const chunks = [
    reservation.programName,
    reservation.scheduledAt ? formatDateTime(reservation.scheduledAt) : undefined,
    reservation.locationName,
  ].filter(Boolean);
  return chunks.length > 0 ? chunks.join(" · ") : RESERVATION_STATUS_LABELS[reservation.status];
}

const STAGE1_LINKAGE_ACTION_META: Record<
  Stage1LinkageAction,
  {
    title: string;
    description: string;
    nextStatus: LinkageStatus;
    note: string;
  }
> = {
  CENTER_LINKAGE: {
    title: "안심센터 연계",
    description: "센터 내부 상담/프로그램 연계",
    nextStatus: "BOOKING_IN_PROGRESS",
    note: "센터 내부 연계 경로를 생성합니다.",
  },
  HOSPITAL_LINKAGE: {
    title: "병원 연계",
    description: "의뢰 생성 및 병원 연계 준비",
    nextStatus: "REFERRAL_CREATED",
    note: "의뢰 문서와 연락 채널을 확인합니다.",
  },
  COUNSELING_LINKAGE: {
    title: "치매상담소 연계",
    description: "상담소 예약 연계 및 일정 확정",
    nextStatus: "BOOKING_DONE",
    note: "상담소 접수 완료 후 예약 상태를 확정합니다.",
  },
};

function useStage1Flow(
  detail: Stage1Detail,
  mode: StageOpsMode,
  stage2OpsView = false,
  opsLoopState?: OpsLoopState | null,
): Stage1FlowCard[] {
  return useMemo(() => {
    const isStage2Mode = mode === "stage2";
    const isStage3Mode = mode === "stage3";
    const flowConfig = isStage3Mode
      ? stage2OpsView
        ? STAGE2_OPS_FLOW_CONFIG
        : STAGE3_FLOW_CONFIG
      : isStage2Mode
        ? STAGE2_FLOW_CONFIG
        : STAGE1_FLOW_CONFIG;
    const flowStepsMeta = isStage3Mode
      ? stage2OpsView
        ? STAGE2_OPS_CONTACT_FLOW_STEPS_META
        : STAGE3_CONTACT_FLOW_STEPS_META
      : isStage2Mode
        ? STAGE2_CONTACT_FLOW_STEPS_META
        : CONTACT_FLOW_STEPS_META;
    const gateFailCount = detail.policyGates.filter((gate) => gate.status === "FAIL").length;
    const preTriageReady = Boolean(detail.preTriageInput) && detail.header.dataQuality.level !== "EXCLUDE";
    const strategyDecided = Boolean(detail.preTriageResult?.strategy);
    const hasContactAttempt = detail.contactExecution.status !== "NOT_STARTED";
    const hasResponse = Boolean(detail.contactExecution.lastOutcomeCode || detail.contactExecution.lastResponseAt);
    const followUpCompleted =
      detail.linkageStatus !== "NOT_CREATED" ||
      detail.contactExecution.status === "DONE" ||
      detail.contactExecution.status === "STOPPED";
    const flowStepStatusMap = new Map(detail.contactFlowSteps.map((step) => [step.step, step.status] as const));
    const flowStepLabelMap = new Map(flowStepsMeta.map((step) => [step.step, step.label] as const));
    const relatedStepSummary = (steps: ContactFlowStep[]) =>
      steps
        .map((step) => `${flowStepLabelMap.get(step) ?? step}:${flowStepStatusMap.get(step) ?? "WAITING"}`)
        .join(" / ");

    if (opsLoopState && opsLoopState.steps.length === flowConfig.length) {
      const cards = flowConfig.map((config, index) => {
        const step = opsLoopState.steps[index];
        const relatedSummary = relatedStepSummary(config.relatedSteps);
        const status: Stage1FlowVisualStatus =
          step.status === "DONE" ? "COMPLETED" : step.status === "READY" ? "READY" : "PENDING";
        const nextActionHint =
          step.status === "DONE"
            ? "다음 단계로 이동하거나 타임라인 로그를 확인하세요."
            : step.status === "READY"
              ? step.requiresHumanApproval
                ? "자동 준비 완료 상태입니다. 담당자 승인/확정으로 완료 처리하세요."
                : "필요 데이터가 준비되었습니다. 다음 작업을 실행하세요."
              : "현재 단계 필수 입력/검토를 완료해야 다음 단계가 열립니다.";

        return {
          ...config,
          status,
          reason: step.reason,
          nextActionHint,
          metricLabel: `${step.label} · ${relatedSummary}`,
          isCurrent: false,
        };
      });

      const gatedCards = cards.reduce<Stage1FlowCard[]>((acc, card, index) => {
        if (index === 0) {
          acc.push(card);
          return acc;
        }
        const prevCard = acc[index - 1];
        if (prevCard.status === "COMPLETED" || prevCard.status === "READY") {
          acc.push(card);
          return acc;
        }
        const blockedStepNo = index;
        acc.push({
          ...card,
          status: "BLOCKED",
          reason: `STEP ${blockedStepNo} 완료 전에는 ${card.title} 단계를 진행할 수 없습니다.`,
          nextActionHint: `STEP ${blockedStepNo}를 먼저 완료해 주세요.`,
          metricLabel: `선행 단계 미완료 · ${relatedStepSummary(card.relatedSteps)}`,
          isCurrent: false,
        });
        return acc;
      }, []);

      const currentIndex = gatedCards.findIndex((card) => card.status !== "COMPLETED" && card.status !== "READY");
      const resolvedCurrentIndex = currentIndex === -1 ? gatedCards.length - 1 : currentIndex;
      return gatedCards.map((card, index) => ({ ...card, isCurrent: index === resolvedCurrentIndex }));
    }

    if (isStage3Mode) {
      const stage3Data = detail.stage3;
      const baselineReady = preTriageReady && strategyDecided;
      const pendingApprovals =
        stage3Data?.recommendedActions.filter((action) => action.requiresApproval && action.decision === "PENDING").length ?? 0;
      const riskReviewed = Boolean(stage3Data?.riskReviewedAt);
      const diffPathStatus: Stage3DiffPathStatus = stage3Data?.diffPathStatus ?? "NONE";
      const diffPathReady = diffPathStatus === "SCHEDULED" || diffPathStatus === "COMPLETED";
      const diffResultReady = diffPathStatus === "COMPLETED";
      const hasProgramExecution =
        stage3Data?.programs.some((program) => {
          const status = program.execution?.status;
          return status === "PLANNED" || status === "IN_PROGRESS" || status === "DONE";
        }) ?? false;
      const planUpdated = Boolean(stage3Data?.planUpdatedAt) || detail.linkageStatus !== "NOT_CREATED";
      const nextTrackingReady = Boolean(stage3Data?.headerMeta.nextTrackingContactAt);

      const cards = flowConfig.map((config) => {
        const relatedSummary = relatedStepSummary(config.relatedSteps);

        if (config.id === "PRECHECK") {
          if (stage2OpsView) {
            if (!baselineReady) {
              return {
                ...config,
                status: "PENDING" as const,
                reason: "검사 수행 관리 시작 전 기본 정보 확인이 필요합니다.",
                nextActionHint: "STEP1에서 검사 수행 항목 점검과 담당자 메모를 먼저 저장하세요.",
                metricLabel: `검사 수행 준비 대기 · ${relatedSummary}`,
                isCurrent: false,
              };
            }
            if (!riskReviewed) {
              return {
                ...config,
                status: "PENDING" as const,
                reason: "STEP1 검사 수행 관리 완료 기록이 없습니다.",
                nextActionHint: "검토 완료 버튼을 눌러 STEP2(검사 결과 입력) 잠금을 해제하세요.",
                metricLabel: `검사 수행 관리 완료 대기 · ${relatedSummary}`,
                isCurrent: false,
              };
            }
            return {
              ...config,
              status: "COMPLETED" as const,
              reason: "검사 수행 관리 단계가 완료되었습니다.",
              nextActionHint: "STEP2에서 검사 결과 입력을 진행하세요.",
              metricLabel: `검사 수행 관리 완료 · ${relatedSummary}`,
              isCurrent: false,
            };
          }
          if (!baselineReady) {
            return {
              ...config,
              status: "PENDING" as const,
              reason: "추적 기준선(동의/연락채널/추적주기) 확인이 아직 완료되지 않았습니다.",
              nextActionHint: "사전 확인 팝업에서 기준선을 확정한 뒤 위험 추세를 검토하세요.",
              metricLabel: `기준선 미확정 · ${relatedSummary}`,
              isCurrent: false,
            };
          }
          if (!riskReviewed) {
            return {
              ...config,
              status: "PENDING" as const,
              reason: "2년 전환 위험 시계열 리뷰가 아직 기록되지 않았습니다.",
              nextActionHint: "위험 추세 카드에서 '위험 추세 검토 완료'를 먼저 실행하세요.",
              metricLabel: `리스크 리뷰 대기 · ${relatedSummary}`,
              isCurrent: false,
            };
          }
          return {
            ...config,
            status: "COMPLETED" as const,
            reason: "전환 위험 추적 리뷰 및 기준선 확정이 완료되었습니다.",
            nextActionHint: "정밀검사 연계 경로 단계로 이동해 권고를 실행하세요.",
            metricLabel: `리스크 리뷰 완료 · ${relatedSummary}`,
            isCurrent: false,
          };
        }

        if (config.id === "CONTACT_EXECUTION") {
          if (stage2OpsView) {
            if (!baselineReady || !riskReviewed) {
              return {
                ...config,
                status: "BLOCKED" as const,
                reason: "STEP1 완료 전에는 검사 결과 입력을 진행할 수 없습니다.",
                nextActionHint: "STEP1(검사 수행 관리)을 먼저 완료하세요.",
                metricLabel: `검사 결과 입력 잠금 · ${relatedSummary}`,
                isCurrent: false,
              };
            }
            if (!diffPathReady) {
              return {
                ...config,
                status: "PENDING" as const,
                reason: "검사 결과 입력(점수/문서 연결)이 아직 완료되지 않았습니다.",
                nextActionHint: "STEP2에서 MMSE/CDR/신경심리 결과를 입력하세요.",
                metricLabel: `검사 결과 입력 대기 · ${relatedSummary}`,
                isCurrent: false,
              };
            }
            return {
              ...config,
              status: "COMPLETED" as const,
              reason: "검사 결과 입력이 반영되었습니다.",
              nextActionHint: "STEP3에서 정상/MCI/치매 분류를 확정하세요.",
              metricLabel: `검사 결과 입력 완료 · ${relatedSummary}`,
              isCurrent: false,
            };
          }
          if (!baselineReady || !riskReviewed) {
            return {
              ...config,
              status: "BLOCKED" as const,
              reason: "STEP1(전환 위험 추적 리뷰) 완료 전에는 감별경로 작업을 진행할 수 없습니다.",
              nextActionHint: "STEP1에서 기준선 확정과 위험 리뷰를 먼저 완료하세요.",
              metricLabel: `감별경로 잠금 · ${relatedSummary}`,
              isCurrent: false,
            };
          }
          if (pendingApprovals > 0) {
            return {
              ...config,
              status: "PENDING" as const,
              reason: `승인 필요 권고 ${pendingApprovals}건이 남아 있습니다.`,
              nextActionHint: "우측 감별경로 권고 패널에서 승인/보류를 처리하세요.",
              metricLabel: `권고 승인 대기 ${pendingApprovals}건 · ${relatedSummary}`,
              isCurrent: false,
            };
          }
          if (!diffPathReady) {
            return {
              ...config,
              status: "PENDING" as const,
              reason: "정밀검사 연계 경로가 예약 또는 완료 상태가 아닙니다.",
              nextActionHint: "권고·의뢰 후 예약 생성/결과 입력까지 진행하세요.",
              metricLabel: `감별경로 ${diffPathStatus} · ${relatedSummary}`,
              isCurrent: false,
            };
          }
          if (!diffResultReady) {
            return {
              ...config,
              status: "PENDING" as const,
              reason: "예약은 생성되었지만 검사결과 입력/반영이 아직 완료되지 않았습니다.",
              nextActionHint: "STEP2에서 결과 수집/입력 반영을 완료해 주세요.",
              metricLabel: `감별경로 ${diffPathStatus} · 결과 반영 대기 · ${relatedSummary}`,
              isCurrent: false,
            };
          }
          return {
            ...config,
            status: "COMPLETED" as const,
            reason: "정밀검사 연계 경로 권고가 처리되었습니다.",
            nextActionHint: "정밀관리 제공 단계에서 프로그램 실행을 기록하세요.",
            metricLabel: `감별경로 ${diffPathStatus} · ${relatedSummary}`,
            isCurrent: false,
          };
        }

        if (config.id === "RESPONSE_HANDLING") {
          if (stage2OpsView) {
            if (!diffPathReady) {
              return {
                ...config,
                status: "BLOCKED" as const,
                reason: "STEP2 완료 전에는 분류 확정을 진행할 수 없습니다.",
                nextActionHint: "검사 결과 입력을 먼저 완료하세요.",
                metricLabel: `분류 확정 잠금 · ${relatedSummary}`,
                isCurrent: false,
              };
            }
            if (stage3Data?.reevalStatus === "SCHEDULED" || stage3Data?.reevalStatus === "COMPLETED") {
              return {
                ...config,
                status: "COMPLETED" as const,
                reason: "분류 확정이 기록되었습니다.",
                nextActionHint: "STEP4에서 다음 단계를 결정하세요.",
                metricLabel: `분류 확정 완료 · ${relatedSummary}`,
                isCurrent: false,
              };
            }
            return {
              ...config,
              status: "PENDING" as const,
              reason: "정상/MCI/치매 분류 확정이 아직 완료되지 않았습니다.",
              nextActionHint: "STEP3에서 분류 선택과 근거를 저장하세요.",
              metricLabel: `분류 확정 대기 · ${relatedSummary}`,
              isCurrent: false,
            };
          }
          if (!diffResultReady || pendingApprovals > 0) {
            return {
              ...config,
              status: "BLOCKED" as const,
              reason: "감별경로 결과 반영이 완료되지 않았거나 승인 대기 권고가 남아 정밀관리 제공이 잠금됩니다.",
              nextActionHint: "STEP2에서 승인 처리 후 결과 수집/반영까지 완료하세요.",
              metricLabel: `정밀관리 잠금 · ${relatedSummary}`,
              isCurrent: false,
            };
          }
          if (hasProgramExecution) {
            return {
              ...config,
              status: "COMPLETED" as const,
              reason: "정밀관리 프로그램 제공 실행이 기록되었습니다.",
              nextActionHint: "관리 제공(프로그램·연계) 단계에서 추적 계획을 확정하세요.",
              metricLabel: `프로그램 실행 기록 있음 · ${relatedSummary}`,
              isCurrent: false,
            };
          }
          return {
            ...config,
            status: "PENDING" as const,
            reason: "선택 프로그램의 실행 필드(연계/예약/안내/교육/방문) 기록이 아직 없습니다.",
            nextActionHint: "프로그램 섹션에서 항목 선택 후 실행 필드를 입력하세요.",
            metricLabel: `프로그램 실행 대기 · ${relatedSummary}`,
            isCurrent: false,
          };
        }

        if (stage2OpsView) {
          if (stage3Data?.planUpdatedAt) {
            return {
              ...config,
              status: "COMPLETED" as const,
              reason: "다음 단계 결정이 완료되었습니다.",
              nextActionHint: "타임라인/감사 로그에서 변경 근거를 확인하세요.",
              metricLabel: `다음 단계 결정 완료 · ${relatedSummary}`,
              isCurrent: false,
            };
          }
          return {
            ...config,
            status: "PENDING" as const,
            reason: "다음 단계 결정(정상 추적/MCI Stage3/치매 감별경로)이 남아 있습니다.",
            nextActionHint: "STEP4에서 후속 경로를 저장하세요.",
            metricLabel: `다음 단계 결정 대기 · ${relatedSummary}`,
            isCurrent: false,
          };
        }

        if (!hasProgramExecution) {
          return {
            ...config,
            status: "BLOCKED" as const,
            reason: "정밀관리 제공 실행이 최소 1건 기록되어야 관리 제공(프로그램·연계) 단계를 진행할 수 있습니다.",
            nextActionHint: "STEP3에서 프로그램 실행 상태를 먼저 기록하세요.",
            metricLabel: `관리 제공 잠금 · ${relatedSummary}`,
            isCurrent: false,
          };
        }

        if (planUpdated && nextTrackingReady) {
          return {
            ...config,
            status: "COMPLETED" as const,
            reason: "검사/프로그램 입력 후 플랜 업데이트와 다음 추적 일정이 설정되었습니다.",
            nextActionHint: "타임라인/감사 로그를 검토하고 루프를 재시작하세요.",
            metricLabel: `플랜 업데이트+다음 추적 설정 완료 · ${relatedSummary}`,
            isCurrent: false,
          };
        }

        return {
          ...config,
          status: "PENDING" as const,
          reason: "결과 입력/플랜 업데이트/다음 추적 일정 설정이 아직 남아 있습니다.",
          nextActionHint: "결과 입력 또는 플랜 업데이트 버튼을 실행하세요.",
          metricLabel: `관리 제공 대기 · ${relatedSummary}`,
          isCurrent: false,
        };
      });

      // Stage3 루프는 순차 게이트를 강제한다.
      // 선행 단계가 완료되지 않았으면 후행 단계는 완료/대기 상태가 아니라 BLOCKED로 표기한다.
      const gatedCards = cards.reduce<Stage1FlowCard[]>((acc, card, index) => {
        if (index === 0) {
          acc.push(card);
          return acc;
        }
        const prevCard = acc[index - 1];
        if (prevCard.status === "COMPLETED" || prevCard.status === "READY") {
          acc.push(card);
          return acc;
        }
        const blockedStepNo = index;
        acc.push({
          ...card,
          status: "BLOCKED",
          reason: `STEP ${blockedStepNo} 완료 전에는 ${card.title} 단계를 진행할 수 없습니다.`,
          nextActionHint: `STEP ${blockedStepNo}를 먼저 완료해 주세요.`,
          metricLabel: `선행 단계 미완료 · ${relatedStepSummary(card.relatedSteps)}`,
          isCurrent: false,
        });
        return acc;
      }, []);

      const currentIndex = gatedCards.findIndex((card) => card.status !== "COMPLETED" && card.status !== "READY");
      const resolvedCurrentIndex = currentIndex === -1 ? gatedCards.length - 1 : currentIndex;
      return gatedCards.map((card, index) => ({ ...card, isCurrent: index === resolvedCurrentIndex }));
    }

    const cards = flowConfig.map((config) => {
      const relatedSummary = relatedStepSummary(config.relatedSteps);
      if (config.id === "PRECHECK") {
        if (gateFailCount > 0 || !preTriageReady) {
          return {
            ...config,
            status: "BLOCKED" as const,
            reason: gateFailCount > 0
              ? isStage2Mode
                ? `필수 근거 ${gateFailCount}건이 아직 충족되지 않았습니다.`
                : `필수 게이트 ${gateFailCount}건이 아직 충족되지 않았습니다.`
              : isStage2Mode
                ? "필수 근거 입력이 누락되어 결과 확인이 불가합니다."
                : "사전 확인 입력이 누락되어 접촉 전략 확정이 불가합니다.",
            nextActionHint: isStage2Mode
              ? "근거/게이트 관리 영역에서 누락 항목을 먼저 보완하세요."
              : "사전 확인/게이트 관리 영역에서 필수 항목을 보완하세요.",
            metricLabel: gateFailCount > 0
              ? `${isStage2Mode ? "필수 근거" : "게이트"} FAIL ${gateFailCount}건 · ${relatedSummary}`
              : `${isStage2Mode ? "필수 근거 누락" : "사전 확인 누락"} · ${relatedSummary}`,
            isCurrent: false,
          };
        }
        if (strategyDecided) {
          return {
            ...config,
            status: "COMPLETED" as const,
            reason: isStage2Mode ? "2차 평가 근거와 확인 조건이 준비되었습니다." : "사전 조건과 접촉 전략이 확인되었습니다.",
            nextActionHint: isStage2Mode
              ? "분기/운영강도 설정 단계로 이동해 다음 작업을 확정하세요."
              : "접촉 실행 단계로 이동해 문자/전화를 실행하세요.",
            metricLabel: `${isStage2Mode ? "확인 기준" : "전략"} ${detail.preTriageResult?.strategy ?? "확정"} · ${relatedSummary}`,
            isCurrent: false,
          };
        }
        return {
          ...config,
          status: "PENDING" as const,
          reason: isStage2Mode
            ? "근거는 준비됐지만 담당자 확인 체크가 남았습니다."
            : "사전 조건은 확인됐지만 접촉 전략 확정이 남았습니다.",
          nextActionHint: isStage2Mode
            ? "결과 확인/확정 모달에서 담당자 확인 체크를 완료하세요."
            : "전략 배지와 정책 사유를 확인해 접촉 전략을 확정하세요.",
          metricLabel: `${isStage2Mode ? "확인 체크" : "전략 확정"} 대기 · ${relatedSummary}`,
          isCurrent: false,
        };
      }

      if (config.id === "CONTACT_EXECUTION") {
        const isAutoFirst =
          (detail.header.effectiveStrategy ?? detail.preTriageResult?.strategy) === "AI_FIRST" &&
          detail.contactExecutor === "AGENT_SEND_ONLY";
        const contactStepDescription = isAutoFirst
          ? isStage2Mode
            ? "Agent 안내 결과 확인 및 예외 처리"
            : "Agent 수행 결과 확인 및 예외 처리"
          : config.description;
        if (!preTriageReady || !strategyDecided) {
          return {
            ...config,
            description: contactStepDescription,
            status: "BLOCKED" as const,
            reason: isStage2Mode
              ? "결과 확인 단계가 완료되어야 분기/강도 설정이 가능합니다."
              : "사전 조건 확인이 완료되어야 접촉 실행이 가능합니다.",
            nextActionHint: isStage2Mode
              ? "결과 확인 단계에서 누락 근거를 먼저 보완하세요."
              : "먼저 사전 조건 확인 단계에서 누락 항목을 보완하세요.",
            metricLabel: `${isStage2Mode ? "분기 설정" : "실행"} 대기 · ${relatedSummary}`,
            isCurrent: false,
          };
        }
        if (hasContactAttempt) {
          return {
            ...config,
            description: contactStepDescription,
            status: "COMPLETED" as const,
            reason:
              detail.contactExecutor === "AGENT_SEND_ONLY"
                ? isStage2Mode
                  ? "Agent 안내 결과가 기록되어 분기/강도 설정 근거로 반영되었습니다."
                  : "Agent 수행 결과가 기록되었습니다."
                : isStage2Mode
                  ? "분기/강도 설정 이력이 기록되었습니다."
                  : "접촉 실행 이력이 기록되었습니다.",
            nextActionHint: isStage2Mode
              ? "연계/예약 실행 단계로 이동해 종단 처리를 진행하세요."
              : "응답 상태를 확인하고 반응 처리 단계로 이동하세요.",
            metricLabel: `${CONTACT_STATUS_HINT[detail.contactExecution.status]} · ${CONTACT_EXECUTOR_LABELS[detail.contactExecutor]} · ${relatedSummary}`,
            isCurrent: false,
          };
        }
        return {
          ...config,
          description: contactStepDescription,
          status: "PENDING" as const,
          reason:
            detail.contactExecutor === "AGENT_SEND_ONLY"
              ? isStage2Mode
                ? "Agent 안내 결과 확인이 아직 없습니다."
                : "Agent 자동 수행 결과 확인이 아직 없습니다."
              : isStage2Mode
                ? "아직 분기/강도 설정 기록이 없습니다."
                : "아직 문자/전화 실행 기록이 없습니다.",
          nextActionHint:
            detail.contactExecutor === "AGENT_SEND_ONLY"
              ? isStage2Mode
                ? "분기/강도 설정 단계에서 Agent 안내 결과를 확인하고 예외를 처리하세요."
                : "접촉 실행 단계에서 Agent 수행 상태를 확인하고 예외를 처리하세요."
              : isStage2Mode
                ? "상담/문자 실행 패널을 열어 분기 안내를 시작하세요."
                : "상담/문자 실행 패널을 열어 1차 접촉을 시작하세요.",
          metricLabel: `${isStage2Mode ? "분기 미설정" : "미접촉"} · ${CONTACT_EXECUTOR_LABELS[detail.contactExecutor]} · ${relatedSummary}`,
          isCurrent: false,
        };
      }

      if (config.id === "RESPONSE_HANDLING") {
        if (!hasContactAttempt) {
          return {
            ...config,
            status: "BLOCKED" as const,
            reason: isStage2Mode
              ? "분기/강도 설정 이후에만 연계/예약을 실행할 수 있습니다."
              : "접촉 실행 이후에만 응답 결과를 처리할 수 있습니다.",
            nextActionHint: isStage2Mode
              ? "분기/강도 설정 단계에서 먼저 기준을 확정하세요."
              : "접촉 실행 단계에서 먼저 전화/문자를 수행하세요.",
            metricLabel: `${isStage2Mode ? "연계 실행 대기" : "응답 없음"} · ${relatedSummary}`,
            isCurrent: false,
          };
        }
        if (hasResponse) {
          return {
            ...config,
            status: "COMPLETED" as const,
            reason: isStage2Mode ? "연계/예약 실행 이력이 기록되었습니다." : "응답 결과가 기록되어 분기 처리가 가능합니다.",
            nextActionHint: isStage2Mode
              ? "확정/후속조치 단계에서 담당자 확정과 추적 계획을 완료하세요."
              : "후속 결정 단계에서 연계/보류/종결을 확정하세요.",
            metricLabel: detail.contactExecution.lastOutcomeCode
              ? `${OUTCOME_LABELS[detail.contactExecution.lastOutcomeCode].label} · ${relatedSummary}`
              : `${isStage2Mode ? "연계 기록 완료" : "응답 기록 완료"} · ${relatedSummary}`,
            isCurrent: false,
          };
        }
        return {
          ...config,
          status: "PENDING" as const,
          reason: isStage2Mode ? "연계 실행은 진행되었지만 결과 기록이 없습니다." : "접촉은 수행되었지만 응답 결과 기록이 없습니다.",
          nextActionHint: isStage2Mode
            ? "응답 결과 처리 패널에서 연계 실행 결과를 기록하세요."
            : "응답 결과 처리 패널에서 결과 버튼을 선택해 기록하세요.",
          metricLabel: `${isStage2Mode ? "연계 결과 기록 대기" : "응답 기록 대기"} · ${relatedSummary}`,
          isCurrent: false,
        };
      }

      if (!hasResponse) {
        return {
          ...config,
          status: "BLOCKED" as const,
          reason: isStage2Mode
            ? "연계/예약 실행 결과가 기록되어야 확정/후속조치를 진행할 수 있습니다."
            : "응답 결과가 기록되어야 후속 결정을 진행할 수 있습니다.",
          nextActionHint: isStage2Mode
            ? "연계/예약 실행 단계에서 결과를 먼저 기록하세요."
            : "반응 처리 단계에서 Outcome을 먼저 기록하세요.",
          metricLabel: `${LINKAGE_STATUS_HINT[detail.linkageStatus]} · ${relatedSummary}`,
          isCurrent: false,
        };
      }
      if (followUpCompleted) {
        return {
          ...config,
          status: "COMPLETED" as const,
          reason: isStage2Mode
            ? "후속조치가 생성되어 추적 운영이 가능한 상태입니다."
            : "후속 조치가 생성되었거나 케이스가 종결되었습니다.",
          nextActionHint: isStage2Mode
            ? "필요 시 추적 계획을 보완하고 감사 로그를 확인하세요."
            : "필요시 인수인계 메모를 보완하고 감사 로그를 확인하세요.",
          metricLabel: `${LINKAGE_STATUS_HINT[detail.linkageStatus]} · ${relatedSummary}`,
          isCurrent: false,
        };
      }
      return {
        ...config,
        status: "PENDING" as const,
        reason: isStage2Mode ? "담당자 확정 및 후속조치 생성이 남아 있습니다." : "후속 생성 또는 인수인계 확정이 남아 있습니다.",
        nextActionHint: isStage2Mode
          ? "후속 결정 패널에서 분기 확정과 추적 계획을 저장하세요."
          : "후속 결정 패널에서 연계/보류/전환을 확정하세요.",
        metricLabel: `${LINKAGE_STATUS_HINT[detail.linkageStatus]} · ${relatedSummary}`,
        isCurrent: false,
      };
    });

    const currentIndex = cards.findIndex((card) => card.status !== "COMPLETED" && card.status !== "READY");
    const resolvedCurrentIndex = currentIndex === -1 ? cards.length - 1 : currentIndex;

    return cards.map((card, index) => ({
      ...card,
      isCurrent: index === resolvedCurrentIndex,
    }));
  }, [detail, mode, opsLoopState, stage2OpsView]);
}

function buildPreTriageInput(caseRecord?: CaseRecord): PreTriageInput {
  const age = caseRecord?.profile.age ?? 70;
  const hasGuardian = Boolean(caseRecord?.profile.guardianPhone);
  const hasComplaint = caseRecord?.quality === "경고" || Boolean(caseRecord?.alertTags.includes("이탈 위험"));
  const hasRefusal = caseRecord?.status === "지연" || Boolean(caseRecord?.alertTags.includes("재평가 필요"));
  const needsGuardian = !hasGuardian && age >= 75;
  const comprehensionDifficultyFlag = age >= 80 || caseRecord?.risk === "고";
  const hasMCI = Boolean(caseRecord?.alertTags.includes("High MCI") || caseRecord?.alertTags.includes("재평가 필요"));
  const hasDementia = caseRecord?.risk === "고" && age >= 80;

  return {
    age,
    dxHistory: { hasMCI, hasDementia },
    contactHistory: {
      hasComplaint,
      hasRefusal,
      needsGuardian,
      comprehensionDifficultyFlag,
    },
    guardian: {
      exists: hasGuardian,
      isPrimaryContact: hasGuardian && (needsGuardian || comprehensionDifficultyFlag),
    },
    responseHistory: {
      smsResponseGood: caseRecord?.risk !== "고",
      callResponseGood: caseRecord?.status !== "지연",
      lastOutcome: caseRecord?.status === "지연" ? "NO_RESPONSE" : undefined,
    },
  };
}

function buildPreTriageResult(input: PreTriageInput): PreTriageResult {
  return derivePreTriageResultByRule(input);
}

function applyContactModeHint(preTriage: PreTriageResult, contactMode?: "HUMAN" | "AGENT"): PreTriageResult {
  if (!contactMode) return preTriage;
  const hintedStrategy: RecommendedContactStrategy = contactMode === "AGENT" ? "AI_FIRST" : "HUMAN_FIRST";
  if (preTriage.strategy === hintedStrategy) return preTriage;

  const trigger = contactMode === "AGENT" ? "CONTACT_MODE_HINT_AGENT" : "CONTACT_MODE_HINT_HUMAN";
  const policyNote =
    contactMode === "AGENT"
      ? "운영 설정 기준에서 자동 안내/응답 수집 우선으로 설정되어 있습니다. 최종 실행은 담당자가 확인 후 진행합니다."
      : "운영 설정 기준에서 상담사 우선 접촉으로 설정되어 있습니다. 최종 실행은 담당자가 확인 후 진행합니다.";

  return {
    strategy: hintedStrategy,
    triggers: [...preTriage.triggers, trigger],
    policyNote,
    confidence: "RULE",
  };
}

function buildContactPlan(strategy: RecommendedContactStrategy, caseRecord?: CaseRecord, mode: StageOpsMode = "stage1"): ContactPlan {
  const isStage2Mode = mode === "stage2";
  const isStage3Mode = mode === "stage3";
  const humanTemplateId = isStage2Mode
    ? caseRecord?.profile.guardianPhone
      ? "S2_CONTACT_RELIEF"
      : "S2_CONTACT_BASE"
    : isStage3Mode
      ? "S3_CONTACT_BASE"
    : caseRecord?.profile.guardianPhone
      ? "S1_CONTACT_GUARDIAN"
      : "S1_CONTACT_BASE";
  const autoTemplateId = isStage2Mode ? "S2_CONTACT_BASE" : isStage3Mode ? "S3_CONTACT_BASE" : "S1_CONTACT_BASE";

  if (strategy === "HUMAN_FIRST") {
    return {
      channel: "HYBRID",
      templateId: humanTemplateId,
      maxRetryPolicy: { maxRetries: 3, intervalHours: 24 },
    };
  }
  return {
    channel: "SMS",
    templateId: autoTemplateId,
    maxRetryPolicy: { maxRetries: 2, intervalHours: 24 },
  };
}

function buildInitialContactExecution(caseRecord?: CaseRecord): ContactExecution {
  if (!caseRecord) {
    return { status: "NOT_STARTED", retryCount: 0 };
  }

  const lastTouchAt = toIsoFromLegacyDateTime(caseRecord.updated);

  if (caseRecord.status === "완료") {
    return {
      status: "DONE",
      retryCount: 1,
      lastSentAt: lastTouchAt,
      lastResponseAt: lastTouchAt,
      lastOutcomeCode: "CONTINUE_SELF",
    };
  }

  if (caseRecord.status === "지연") {
    return {
      status: "RETRY_NEEDED",
      retryCount: 2,
      lastSentAt: lastTouchAt,
      lastOutcomeCode: "NO_RESPONSE",
    };
  }

  if (caseRecord.status === "임박") {
    return {
      status: "RETRY_NEEDED",
      retryCount: 1,
      lastSentAt: lastTouchAt,
      lastOutcomeCode: "NO_RESPONSE",
    };
  }

  if (caseRecord.status === "진행중") {
    return {
      status: "WAITING_RESPONSE",
      retryCount: 1,
      lastSentAt: lastTouchAt,
    };
  }

  return { status: "NOT_STARTED", retryCount: 0 };
}

function buildContactFlowSteps(
  execution: ContactExecution,
  preTriage?: PreTriageResult,
  linkageStatus: LinkageStatus = "NOT_CREATED",
  mode: StageOpsMode = "stage1"
): ContactFlowState[] {
  const hasPreTriage = Boolean(preTriage);
  const hasStrategy = Boolean(preTriage?.strategy);
  const isSent = execution.status !== "NOT_STARTED";
  const hasOutcome = Boolean(execution.lastOutcomeCode || execution.lastResponseAt);
  const hasRiskWarning = execution.status === "HANDOFF_TO_HUMAN" || execution.status === "STOPPED" || execution.status === "RETRY_NEEDED";
  const flowMeta =
    mode === "stage2" ? STAGE2_CONTACT_FLOW_STEPS_META : mode === "stage3" ? STAGE3_CONTACT_FLOW_STEPS_META : CONTACT_FLOW_STEPS_META;

  return flowMeta.map(({ step, label, description }) => {
    let status: ContactFlowStepStatus = "WAITING";
    if (step === "PRE_TRIAGE") status = hasPreTriage ? "DONE" : "MISSING";
    else if (step === "STRATEGY") status = hasStrategy ? "DONE" : "MISSING";
    else if (step === "COMPOSE") status = hasStrategy ? (isSent || mode === "stage3" ? "DONE" : "WAITING") : "MISSING";
    else if (step === "SEND") status = isSent || mode === "stage3" ? (hasOutcome ? "DONE" : "WAITING") : "MISSING";
    else if (step === "RESPONSE") status = hasOutcome ? (hasRiskWarning ? "WARNING" : "DONE") : isSent || mode === "stage3" ? "WAITING" : "MISSING";
    else if (step === "OUTCOME") {
      if (!hasOutcome) status = "MISSING";
      else if (linkageStatus === "NOT_CREATED") status = "WAITING";
      else status = "DONE";
    }
    return { step, label, status, description };
  });
}

function mapSmsTemplatesToPanelTemplates(templates: SmsTemplate[]): StdSmsTemplate[] {
  return templates.map((template) => ({
    id: template.id,
    type: template.messageType,
    label: template.label,
    body: (vars: SmsTemplateVars) =>
      template.body({
        caseId: vars.caseAlias ?? "CASE",
        centerName: vars.centerName,
        centerPhone: vars.centerPhone,
        guideLink: vars.guideLink,
        reservationLink: vars.bookingLink,
        unsubscribe: vars.optOut ?? DEFAULT_UNSUBSCRIBE,
      }),
  }));
}

/** STAGE1_STD_TEMPLATES: SmsPanel에 전달할 StdSmsTemplate[] */
const STAGE1_STD_TEMPLATES: StdSmsTemplate[] = mapSmsTemplatesToPanelTemplates(SMS_TEMPLATES);

/** STAGE2_STD_TEMPLATES: SmsPanel에 전달할 StdSmsTemplate[] */
const STAGE2_STD_TEMPLATES: StdSmsTemplate[] = mapSmsTemplatesToPanelTemplates(STAGE2_SMS_TEMPLATES);

/** STAGE3_STD_TEMPLATES: SmsPanel에 전달할 StdSmsTemplate[] */
const STAGE3_STD_TEMPLATES: StdSmsTemplate[] = mapSmsTemplatesToPanelTemplates(STAGE3_SMS_TEMPLATES);

export function Stage1OpsDetail({
  caseId,
  caseRecord,
  onHeaderSummaryChange,
  onPrimaryActionChange,
  mode = "stage1",
  surfaceStage,
}: {
  caseId?: string;
  caseRecord?: CaseRecord;
  onHeaderSummaryChange?: (summary: Stage1HeaderSummary) => void;
  onPrimaryActionChange?: (handler: (() => void) | null) => void;
  mode?: StageOpsMode;
  surfaceStage?: SurfaceStage;
}) {
  const resolvedCaseId = caseRecord?.id ?? caseId;
  const isStage2Mode = mode === "stage2";
  const isStage3Mode = mode === "stage3";
  const isStage2OpsView = isStage3Mode && surfaceStage === "Stage 2";
  const stageLabel = isStage2Mode || isStage2OpsView ? "2차" : isStage3Mode ? "3차" : "1차";
  const ssotCase = useCaseEntity(resolvedCaseId);
  const ssotEvents = useCaseEvents(resolvedCaseId);
  const stage3View = useStage3CaseView(isStage3Mode ? resolvedCaseId : null);
  const resolvedStage3TypeForUi =
    stage3View?.source.profile?.stage3Type ??
    caseRecord?.profile.stage3Type ??
    (stage3View?.source.profile?.originStage2Result === "AD" ? "AD_MANAGEMENT" : undefined);
  const stage2Evidence = ssotCase?.computed.evidence.stage2;
  const stage3Evidence = ssotCase?.computed.evidence.stage3;
  const ssotModel2 = ssotCase?.computed.model2;
  const ssotModel3 = ssotCase?.computed.model3;
  const stage2StoredModelAvailable = Boolean(ssotModel2?.available);
  const stage3StoredModelAvailable = Boolean(ssotModel3?.available);
  const stage2GateMissing = stage2Evidence?.missing ?? [];
  const stage3GateMissing = stage3Evidence?.missing ?? [];
  const smsTemplateCatalog = isStage2Mode ? STAGE2_SMS_TEMPLATES : isStage3Mode ? STAGE3_SMS_TEMPLATES : SMS_TEMPLATES;
  const panelSmsTemplates = isStage2Mode ? STAGE2_STD_TEMPLATES : isStage3Mode ? STAGE3_STD_TEMPLATES : STAGE1_STD_TEMPLATES;
  const defaultSmsTemplateId = smsTemplateCatalog[0]?.id ?? "";
  const queryClient = useQueryClient();

  const [detail, setDetail] = useState<Stage1Detail>(() => buildInitialStage1Detail(caseRecord, mode, isStage2OpsView));
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>(() =>
    buildInitialAuditLogs(caseRecord, buildInitialStage1Detail(caseRecord, mode, isStage2OpsView), mode, isStage2OpsView)
  );
  const [timelineFilter, setTimelineFilter] = useState<TimelineFilter>("ALL");
  const [activeStage1Modal, setActiveStage1Modal] = useState<Stage1FlowCardId | null>(null);

  const [callTarget, setCallTarget] = useState<CallTarget>("citizen");
  const [callActive, setCallActive] = useState(false);
  const [callSeconds, setCallSeconds] = useState(0);
  const [callMemo, setCallMemo] = useState("");
  const [callResultDraft, setCallResultDraft] = useState<"SUCCESS" | "NO_ANSWER" | "REJECTED" | "WRONG_NUMBER">(
    "SUCCESS"
  );

  const [smsTargets, setSmsTargets] = useState<{ citizen: boolean; guardian: boolean }>({
    citizen: true,
    guardian: false,
  });
  const [smsTemplateId, setSmsTemplateId] = useState(defaultSmsTemplateId);
  const [smsScheduleType, setSmsScheduleType] = useState<"NOW" | "SCHEDULE">("NOW");
  const [smsScheduledAt, setSmsScheduledAt] = useState("");
  const [restrictNightSend, setRestrictNightSend] = useState(true);

  const [reasonModal, setReasonModal] = useState<ReasonActionDraft | null>(null);
  const [outcomeModal, setOutcomeModal] = useState<OutcomeDraft | null>(null);
  const [savingOutcome, setSavingOutcome] = useState(false);

  const [nowTick, setNowTick] = useState(Date.now());
  const [recontactDueAt, setRecontactDueAt] = useState(withHoursFromNow(24));

  /* ── 접촉 전략 Override 모달 ── */
  const [strategyOverrideOpen, setStrategyOverrideOpen] = useState(false);
  const [strategyOverrideReason, setStrategyOverrideReason] = useState("");
  const [strategyOverrideTarget, setStrategyOverrideTarget] = useState<RecommendedContactStrategy>("HUMAN_FIRST");

  const [selectedOutcomeCode, setSelectedOutcomeCode] = useState<OutcomeCode | null>(null);
  const [outcomeNote, setOutcomeNote] = useState("");
  const [responsePanelExpanded, setResponsePanelExpanded] = useState(true);
  const [stage3ContactPanelOpen, setStage3ContactPanelOpen] = useState(false);
  const [stage3TaskModalStep, setStage3TaskModalStep] = useState<Stage1FlowCardId | null>(null);
  const [stage3ProgramSearch, setStage3ProgramSearch] = useState("");
  const [stage3ProgramMajorFilter, setStage3ProgramMajorFilter] = useState<Stage3ProgramItem["major"] | "ALL">("ALL");
  const [stage3ProgramOnlyPinned, setStage3ProgramOnlyPinned] = useState(false);
  const [stage3ProgramDrawerId, setStage3ProgramDrawerId] = useState<string | null>(null);
  const [stage3ProgramExecutionDraft, setStage3ProgramExecutionDraft] = useState<Stage3ProgramExecutionField>({
    owner: caseRecord?.manager ?? STAGE1_PANEL_OPERATOR,
    status: "PLANNED",
    method: "안내",
  });
  const [stage3ReviewDraft, setStage3ReviewDraft] = useState<Stage3ReviewDraft>({
    diffNeeded: true,
    diffDecisionSet: true,
    diffDecisionReason: "",
    priority: "HIGH",
    caregiverNeeded: false,
    sensitiveHistory: false,
    resultLinkedChecked: false,
    consentConfirmed: false,
    strategyMemo: "",
  });
  const [stage3DiffDraft, setStage3DiffDraft] = useState<Stage3DiffDraft>({
    orgName: "협력 병원",
    orgPhone: "02-555-0199",
    preferredHospital: "협력 병원",
    preferredTimeWindow: "평일 오후 14:00~16:00",
    caregiverCompanion: false,
    mobilityIssue: false,
    testBiomarker: true,
    testBrainImaging: true,
    testOther: false,
    bookingAt: withHoursFromNow(72),
    bookingAltAt: withHoursFromNow(96),
    bookingConfirmed: false,
    prepGuide: "신분증/복용약 목록/최근 검사기록 지참 안내",
    note: "",
    resultSummary: "",
    resultLabel: "불확실",
    riskReady: false,
    resultPerformedAt: "",
    biomarkerResultText: "",
    imagingResultText: "",
    abeta: "",
    tau: "",
  });
  const [stage3Step2Flow, setStage3Step2Flow] = useState<Stage3Step2FlowState>({
    consultStarted: false,
    infoCollected: false,
    ragGenerated: false,
    bookingConfirmed: false,
    messageSent: false,
    calendarSynced: false,
  });
  const [stage3Step2ActivePanel, setStage3Step2ActivePanel] = useState<Stage3Step2PanelKey>("REVIEW");
  const [stage3RagAutoFill, setStage3RagAutoFill] = useState<Stage3RagAutoFill | null>(null);
  const [stage3RiskReviewDraft, setStage3RiskReviewDraft] = useState<Stage3RiskReviewDraft>({
    memo: "",
    nextAction: "RECOMMEND_DIFF",
  });
  const [stage3TrackingPlanDraft, setStage3TrackingPlanDraft] = useState<Stage3TrackingPlanDraft>({
    nextTrackingAt: withHoursFromNow(24 * 21),
    reminderDaysBefore: 2,
    reminderTime: "09:00",
    retryCount: 2,
  });
  const [stage3LatestRiskReview, setStage3LatestRiskReview] = useState<Stage3RiskReviewSnapshot | null>(null);
  const [stage3AdditionalInfoOpen, setStage3AdditionalInfoOpen] = useState(false);
  const [stage3ShowResultCollection, setStage3ShowResultCollection] = useState(false);
  const [stage3FieldErrorsByStep, setStage3FieldErrorsByStep] = useState<
    Partial<Record<Stage1FlowCardId, Stage3TaskFieldErrors>>
  >({});
  const stage3FieldRefs = useRef<Partial<Record<Stage3TaskFieldKey, HTMLElement | null>>>({});
  const [rejectReasonDraft, setRejectReasonDraft] = useState<RejectReasonDraft>({
    code: null,
    level: "TEMP",
    detail: "",
    createFollowupEvent: false,
    followupAt: withHoursFromNow(168),
  });
  const [noResponsePlanDraft, setNoResponsePlanDraft] = useState<NoResponsePlanDraft>({
    strategy: null,
    channel: "CALL",
    assigneeId: caseRecord?.manager ?? STAGE1_PANEL_OPERATOR,
    nextContactAt: withHoursFromNow(24),
    applyL3: false,
  });
  const [responseReasonTags, setResponseReasonTags] = useState<ResponseReasonTag[]>([]);
  const [responseValidationError, setResponseValidationError] = useState<string | null>(null);
  const [responseDraftDirty, setResponseDraftDirty] = useState(false);
  const [responseLastSavedAt, setResponseLastSavedAt] = useState<string | null>(null);
  const [autoFilledOutcomeState, setAutoFilledOutcomeState] = useState<AutoFilledOutcomeState | null>(null);
  const [reservationDetailOpen, setReservationDetailOpen] = useState(false);
  const responseManualEditedRef = useRef(false);
  const processedSmsReservationEventKeysRef = useRef<Set<string>>(new Set());
  const [ragRecommendations, setRagRecommendations] = useState<RagRecommendation[]>([]);
  const [ragLoading, setRagLoading] = useState(false);
  const [selectedRagId, setSelectedRagId] = useState<string | null>(null);
  const [ragEditedScript, setRagEditedScript] = useState("");
  const [followUpDecisionDraft, setFollowUpDecisionDraft] = useState<FollowUpDecisionDraft>({
    route: "CENTER_VISIT_BOOKING",
    scheduledAt: withHoursFromNow(72),
    place: FOLLOW_UP_ROUTE_META.CENTER_VISIT_BOOKING.defaultPlace,
    contactGuide: DEFAULT_CENTER_PHONE,
    note: "",
    stage2Decision: "KEEP_STAGE1",
  });
  const [stage2Diagnosis, setStage2Diagnosis] = useState<Stage2Diagnosis>(() => buildInitialStage2Diagnosis(caseRecord, ssotCase));
  const [stage2ClassificationDraft, setStage2ClassificationDraft] = useState<Stage2ClassLabel>(() => inferStage2Label(caseRecord));
  const [stage2ClassificationOverrideReason, setStage2ClassificationOverrideReason] = useState("");
  const [stage2ClassificationEdited, setStage2ClassificationEdited] = useState(false);
  const [stage2RationaleDraft, setStage2RationaleDraft] = useState("");
  const [stage2HospitalDraft, setStage2HospitalDraft] = useState("강남구 협력병원");
  const [stage2ScheduleDraft, setStage2ScheduleDraft] = useState(withHoursFromNow(72));
  const [stage2PlanRouteDraft, setStage2PlanRouteDraft] = useState<"HOSPITAL_REFERRAL" | "CENTER_DIRECT">(
    "HOSPITAL_REFERRAL",
  );
  const [stage2PlanRequiredDraft, setStage2PlanRequiredDraft] = useState({
    specialist: true,
    mmse: true,
    cdrOrGds: true,
    neuroCognitive: true,
  });
  const [stage2OptionalTestsDraft, setStage2OptionalTestsDraft] = useState({
    gdsk: false,
    adl: false,
    bpsd: false,
  });
  const [stage2ManualEditEnabled, setStage2ManualEditEnabled] = useState(false);
  const [stage2ManualEditReason, setStage2ManualEditReason] = useState("");
  const [stage2FieldErrors, setStage2FieldErrors] = useState<Stage2FieldErrors>({});
  const stage2FieldRefs = useRef<Partial<Record<Stage2FieldErrorKey, HTMLElement | null>>>({});
  const stage2PlanItemRefs = useRef<Partial<Record<Stage2PlanItemId, HTMLDivElement | null>>>({});
  const [stage2IntegrationState, setStage2IntegrationState] = useState<{
    receivedAt?: string;
    lastSyncedAt?: string;
    sourceOrg?: string;
  }>({
    sourceOrg: "강남구 협력병원",
  });
  const [stage2AutoFillPayload, setStage2AutoFillPayload] = useState<Stage2Step2AutoFillPayload | null>(null);
  const [stage2AutoFillLoading, setStage2AutoFillLoading] = useState(false);
  const [stage2AutoFillError, setStage2AutoFillError] = useState<string | null>(null);
  const stage2AutoFillBaselineRef = useRef<{
    mmse: number | null;
    cdr: number | null;
    neuro: Stage2Diagnosis["tests"]["neuroCognitiveType"] | null;
    specialist: boolean | null;
  } | null>(null);
  const [stage2ModelRunState, setStage2ModelRunState] = useState<InferenceJobState>({
    status: "PENDING",
    minDurationSec: 45,
    maxDurationSec: 160,
  });
  const [stage3ModelRunState, setStage3ModelRunState] = useState<InferenceJobState>({
    status: "PENDING",
    minDurationSec: 60,
    maxDurationSec: 180,
  });
  const [stage2ReceiveHistoryOpen, setStage2ReceiveHistoryOpen] = useState(false);
  const [stage2EnteredAt] = useState(() => caseRecord?.created ?? withHoursFromNow(-96));
  const [stage2TargetAt] = useState(() => withHoursFromNow(24 * 10));
  const [stage2ConfirmedAt, setStage2ConfirmedAt] = useState<string | undefined>(undefined);

  const stage2ErrorOrder: Stage2FieldErrorKey[] = [
    "step1Consent",
    "step1Plan",
    "step1StrategyMemo",
    "manualEditReason",
    "mmse",
    "cdr",
    "neuro",
    "specialist",
    "classification",
    "rationale",
    "overrideReason",
    "nextStep",
  ];

  const registerStage2FieldRef = useCallback(
    (key: Stage2FieldErrorKey) => (element: HTMLElement | null) => {
      stage2FieldRefs.current[key] = element;
    },
    [],
  );

  const applyStage2ValidationErrors = useCallback(
    (errors: Stage2FieldErrors) => {
      setStage2FieldErrors(errors);
      const first = stage2ErrorOrder.find((key) => Boolean(errors[key]));
      if (!first) return false;
      const target = stage2FieldRefs.current[first];
      if (target) {
        target.scrollIntoView({ behavior: "smooth", block: "center" });
        if ("focus" in target && typeof target.focus === "function") {
          target.focus();
        }
      }
      return true;
    },
    [stage2ErrorOrder],
  );

  const clearStage2FieldError = useCallback((key: Stage2FieldErrorKey) => {
    setStage2FieldErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }, []);

  const focusStage2ErrorField = useCallback((key: Stage2FieldErrorKey) => {
    const target = stage2FieldRefs.current[key];
    if (!target) {
      if (
        key === "mmse" ||
        key === "cdr" ||
        key === "neuro" ||
        key === "specialist" ||
        key === "manualEditReason"
      ) {
        setStage3TaskModalStep("CONTACT_EXECUTION");
      }
      return;
    }
    target.scrollIntoView({ behavior: "smooth", block: "center" });
    if ("focus" in target && typeof target.focus === "function") {
      target.focus();
    }
  }, []);

  const stage2ErrorSummaryEntries = useMemo(
    () =>
      stage2ErrorOrder
        .filter((key) => Boolean(stage2FieldErrors[key]))
        .map((key) => ({
          key,
          message: stage2FieldErrors[key] as string,
        })),
    [stage2ErrorOrder, stage2FieldErrors],
  );

  const stage2FieldClass = useCallback(
    (key: Stage2FieldErrorKey, base: string) =>
      cn(
        base,
        stage2FieldErrors[key]
          ? "border-rose-400 bg-rose-50 text-rose-900 placeholder:text-rose-400 focus:border-rose-500"
          : "",
      ),
    [stage2FieldErrors],
  );

  const registerStage2PlanItemRef = useCallback(
    (id: Stage2PlanItemId) => (element: HTMLDivElement | null) => {
      stage2PlanItemRefs.current[id] = element;
    },
    [],
  );

  const stage3ErrorOrderByStep: Record<Stage1FlowCardId, Stage3TaskFieldKey[]> = {
    PRECHECK: ["step1DiffDecision", "step1Consent", "step1DiffReason", "step1StrategyMemo"],
    CONTACT_EXECUTION: [
      "step2CallRecord",
      "step2Hospital",
      "step2TestSelection",
      "step2BookingAt",
      "step2PerformedAt",
      "step2BiomarkerResult",
      "step2ImagingResult",
      "step2ResultSummary",
    ],
    RESPONSE_HANDLING: [],
    FOLLOW_UP: [],
  };

  const registerStage3FieldRef = useCallback(
    (key: Stage3TaskFieldKey) => (element: HTMLElement | null) => {
      stage3FieldRefs.current[key] = element;
    },
    [],
  );

  const clearStage3FieldError = useCallback((step: Stage1FlowCardId, key: Stage3TaskFieldKey) => {
    setStage3FieldErrorsByStep((prev) => {
      const current = prev[step];
      if (!current?.[key]) return prev;
      const nextStepErrors = { ...current };
      delete nextStepErrors[key];
      return {
        ...prev,
        [step]: nextStepErrors,
      };
    });
  }, []);

  const stage3FieldClass = useCallback(
    (step: Stage1FlowCardId, key: Stage3TaskFieldKey, base: string) =>
      cn(
        base,
        stage3FieldErrorsByStep[step]?.[key]
          ? "border-rose-400 bg-rose-50 text-rose-900 placeholder:text-rose-400 focus:border-rose-500"
          : "",
      ),
    [stage3FieldErrorsByStep],
  );

  const applyStage3ValidationErrors = useCallback(
    (step: Stage1FlowCardId, errors: Stage3TaskFieldErrors) => {
      setStage3FieldErrorsByStep((prev) => ({
        ...prev,
        [step]: errors,
      }));
      const first = stage3ErrorOrderByStep[step].find((key) => Boolean(errors[key]));
      if (!first) return false;
      const target = stage3FieldRefs.current[first];
      if (target) {
        target.scrollIntoView({ behavior: "smooth", block: "center" });
        if ("focus" in target && typeof target.focus === "function") {
          target.focus();
        }
      }
      return true;
    },
    [stage3ErrorOrderByStep],
  );

  const focusStage3ErrorField = useCallback((key: Stage3TaskFieldKey) => {
    const target = stage3FieldRefs.current[key];
    if (!target) return;
    target.scrollIntoView({ behavior: "smooth", block: "center" });
    if ("focus" in target && typeof target.focus === "function") {
      target.focus();
    }
  }, []);

  /* ── 인수인계 메모 ── */
  const [handoffMemoOpen, setHandoffMemoOpen] = useState(false);
  const [handoffMemoText, setHandoffMemoText] = useState("");
  const [agentJob, setAgentJob] = useState<AgentJobState>({
    status: "IDLE",
    attemptNo: 0,
  });
  const agentJobRunTokenRef = useRef(0);
  const agentQueuedKeyRef = useRef<Set<string>>(new Set());
  const agentAutoEnterTriggeredRef = useRef<Set<string>>(new Set());
  const prevAgentAutoModeRef = useRef(false);

  const {
    isSaving: isOutcomeSaving,
    submitError: outcomeSubmitError,
    calendarFailures,
    retryingKeys: calendarRetryingKeys,
    submit: submitOutcomeWithCalendar,
    retryCalendarFailure,
    clearSubmitError,
  } = useOutcomeSubmit();

  useEffect(() => {
    const initDetail = buildInitialStage1Detail(caseRecord, mode, isStage2OpsView);
    setDetail(initDetail);
    setAuditLogs(buildInitialAuditLogs(caseRecord, initDetail, mode, isStage2OpsView));
    setTimelineFilter("ALL");
    setActiveStage1Modal(null);
    setCallTarget("citizen");
    setCallActive(false);
    setCallSeconds(0);
    setCallMemo("");
    setCallResultDraft("SUCCESS");
    setSmsTargets({ citizen: true, guardian: false });
    setSmsTemplateId(defaultSmsTemplateId);
    setSmsScheduleType("NOW");
    setSmsScheduledAt("");
    setRestrictNightSend(true);
    setReasonModal(null);
    setOutcomeModal(null);
    setSavingOutcome(false);
    setRecontactDueAt(withHoursFromNow(24));
    setResponsePanelExpanded(true);
    setStage3ContactPanelOpen(false);
    setStage3TaskModalStep(null);
    setStage3ProgramSearch("");
    setStage3ProgramMajorFilter("ALL");
    setStage3ProgramOnlyPinned(false);
    setStage3ProgramDrawerId(null);
    setStage3ProgramExecutionDraft({
      owner: caseRecord?.manager ?? STAGE1_PANEL_OPERATOR,
      status: "PLANNED",
      method: "안내",
    });
    setStage3ReviewDraft({
      diffNeeded: true,
      diffDecisionSet: true,
      diffDecisionReason: caseRecord?.computed?.stage3?.completed ? "검사 결과 수집/반영이 완료되어 정밀관리 단계로 진행합니다." : "",
      priority: caseRecord?.risk === "고" ? "HIGH" : caseRecord?.risk === "중" ? "MID" : "LOW",
      caregiverNeeded: Boolean(caseRecord?.profile.guardianPhone),
      sensitiveHistory: Boolean(caseRecord?.alertTags.includes("이탈 위험")),
      resultLinkedChecked: Boolean(caseRecord?.computed?.stage3?.completed),
      consentConfirmed: Boolean(caseRecord?.computed?.stage3?.completed),
      strategyMemo: caseRecord?.computed?.stage3?.completed
        ? "감별검사 경로에서 결과 수집/반영 완료. 정밀관리 제공 단계로 연계 준비."
        : "",
    });
    const stage3Completed = Boolean(caseRecord?.computed?.stage3?.completed || caseRecord?.computed?.stage3?.modelAvailable);
    const stage3RiskLabel = caseRecord?.computed?.stage3?.label;
    const resultTextByLabel = stage3RiskLabel === "HIGH" ? "양성" : stage3RiskLabel === "LOW" ? "음성" : "불확실";
    const resultPerformedAt = stage3Completed ? toIsoFromLegacyDateTime(caseRecord?.updated) ?? withHoursFromNow(-24) : "";
    setStage3DiffDraft({
      orgName: "협력 병원",
      orgPhone: DEFAULT_CENTER_PHONE,
      preferredHospital: "협력 병원",
      preferredTimeWindow: "평일 오후 14:00~16:00",
      caregiverCompanion: false,
      mobilityIssue: false,
      testBiomarker: true,
      testBrainImaging: true,
      testOther: false,
      bookingAt: withHoursFromNow(72),
      bookingAltAt: withHoursFromNow(96),
      bookingConfirmed: stage3Completed,
      prepGuide: "신분증/복용약 목록/최근 검사기록 지참 안내",
      note: stage3Completed ? "연계 기관 결과 반영 완료." : "",
      resultSummary: stage3Completed ? "협력 병원 검사 결과 수집/입력 반영 완료." : "",
      resultLabel: stage3Completed ? resultTextByLabel : "불확실",
      riskReady: stage3Completed,
      resultPerformedAt,
      biomarkerResultText: stage3Completed ? resultTextByLabel : "",
      imagingResultText: stage3Completed ? resultTextByLabel : "",
      abeta: "",
      tau: "",
    });
    setStage3Step2Flow({
      consultStarted: stage3Completed,
      infoCollected: stage3Completed,
      ragGenerated: stage3Completed,
      bookingConfirmed: stage3Completed,
      messageSent: stage3Completed,
      calendarSynced: stage3Completed,
    });
    setStage3Step2ActivePanel("REVIEW");
    setStage3RagAutoFill(null);
    setStage3RiskReviewDraft({
      memo: "",
      nextAction: "RECOMMEND_DIFF",
    });
    setStage3TrackingPlanDraft({
      nextTrackingAt: withHoursFromNow((initDetail.stage3?.headerMeta.trackingCycleDays ?? 21) * 24),
      reminderDaysBefore: 2,
      reminderTime: "09:00",
      retryCount: 2,
    });
    setStage3LatestRiskReview(null);
    setStage3AdditionalInfoOpen(false);
    setStage3ShowResultCollection(false);
    setStage3FieldErrorsByStep({});
    setSelectedOutcomeCode(null);
    setOutcomeNote("");
    setRejectReasonDraft({
      code: null,
      level: "TEMP",
      detail: "",
      createFollowupEvent: false,
      followupAt: withHoursFromNow(168),
    });
    setNoResponsePlanDraft({
      strategy: null,
      channel: "CALL",
      assigneeId: caseRecord?.manager ?? STAGE1_PANEL_OPERATOR,
      nextContactAt: withHoursFromNow(24),
      applyL3: false,
    });
    setResponseReasonTags([]);
    setResponseValidationError(null);
    setResponseDraftDirty(false);
    setResponseLastSavedAt(null);
    setAutoFilledOutcomeState(null);
    setReservationDetailOpen(false);
    responseManualEditedRef.current = false;
    processedSmsReservationEventKeysRef.current = new Set();
    setRagRecommendations([]);
    setRagLoading(false);
    setSelectedRagId(null);
    setRagEditedScript("");
    setFollowUpDecisionDraft({
      route: "CENTER_VISIT_BOOKING",
      scheduledAt: withHoursFromNow(72),
      place: FOLLOW_UP_ROUTE_META.CENTER_VISIT_BOOKING.defaultPlace,
      contactGuide: DEFAULT_CENTER_PHONE,
      note: "",
      stage2Decision: "KEEP_STAGE1",
    });
    const initialStage2 = buildInitialStage2Diagnosis(caseRecord, ssotCase);
    setStage2Diagnosis(initialStage2);
    setStage2ClassificationDraft(initialStage2.classification?.label ?? inferStage2Label(caseRecord));
    setStage2ClassificationOverrideReason("");
    setStage2ClassificationEdited(false);
    setStage2RationaleDraft("");
    setStage2HospitalDraft("강남구 협력병원");
    setStage2ScheduleDraft(withHoursFromNow(72));
    setStage2PlanRouteDraft("HOSPITAL_REFERRAL");
    setStage2PlanRequiredDraft({
      specialist: true,
      mmse: true,
      cdrOrGds: true,
      neuroCognitive: true,
    });
    setStage2OptionalTestsDraft({
      gdsk: false,
      adl: false,
      bpsd: false,
    });
    setStage2ManualEditEnabled(false);
    setStage2ManualEditReason("");
    setStage2FieldErrors({});
    setStage2IntegrationState({
      sourceOrg: "강남구 협력병원",
    });
    setStage2AutoFillPayload(null);
    setStage2AutoFillLoading(false);
    setStage2AutoFillError(null);
    stage2AutoFillBaselineRef.current = null;
    setStage2ModelRunState({
      status: "PENDING",
      minDurationSec: 45,
      maxDurationSec: 160,
    });
    setStage3ModelRunState({
      status: "PENDING",
      minDurationSec: 60,
      maxDurationSec: 180,
    });
    setStage2ReceiveHistoryOpen(false);
    setStage2ConfirmedAt(undefined);
    setAgentJob({
      status: "IDLE",
      attemptNo: 0,
    });
    agentJobRunTokenRef.current = 0;
    agentQueuedKeyRef.current = new Set();
    agentAutoEnterTriggeredRef.current = new Set();
    prevAgentAutoModeRef.current = false;
    clearSubmitError();
  }, [caseRecord?.id, clearSubmitError, defaultSmsTemplateId, isStage2OpsView, mode]);

  const stage2CaseWaitingForKickoff = Boolean(
    (isStage2Mode || isStage2OpsView) &&
      ssotCase?.stage === 2 &&
      ssotCase.operationStep === "WAITING" &&
      !ssotCase.computed.model2.available,
  );
  const hasStage1GateDoneTimeline = useMemo(
    () =>
      detail.timeline.some(
        (event) => typeof event.summary === "string" && event.summary.includes("STAGE1_GATE_DONE"),
      ),
    [detail.timeline],
  );
  const stage1CaseWaitingForKickoff = Boolean(
    mode === "stage1" &&
      ssotCase?.stage === 1 &&
      ssotCase.operationStep === "WAITING" &&
      ssotCase.modelStatus === "PENDING" &&
      !hasStage1GateDoneTimeline &&
      STAGE1_FORCE_STEP1_WAIT_CASE_IDS.has(ssotCase.caseId),
  );

  useEffect(() => {
    if (!stage2CaseWaitingForKickoff) return;
    setStage2Diagnosis({
      status: "NOT_STARTED",
      tests: {
        specialist: false,
        mmse: undefined,
        cdr: undefined,
        neuroCognitiveType: undefined,
      },
      classification: undefined,
      nextStep: undefined,
    });
    setStage2ClassificationEdited(false);
    setStage2ClassificationOverrideReason("");
    setDetail((prev) => ({
      ...prev,
      timeline: prev.timeline.filter((event) => event.type === "STATUS_CHANGE" || event.type === "LEVEL_CHANGE"),
      stage3: prev.stage3
        ? {
            ...prev.stage3,
            riskReviewedAt: undefined,
            triggersReviewedAt: undefined,
            planUpdatedAt: undefined,
            headerMeta: {
              ...prev.stage3.headerMeta,
              opsStatus: "REEVAL_PENDING",
            },
          }
        : prev.stage3,
    }));
  }, [stage2CaseWaitingForKickoff]);

  useEffect(() => {
    if (!stage1CaseWaitingForKickoff) return;
    setDetail((prev) => ({
      ...prev,
      timeline: prev.timeline.filter((event) => event.type === "STATUS_CHANGE" || event.type === "LEVEL_CHANGE"),
      contactExecution: {
        ...prev.contactExecution,
        status: "NOT_STARTED",
        lastSentAt: undefined,
        lastResponseAt: undefined,
        lastOutcomeCode: undefined,
        retryCount: 0,
      },
    }));
  }, [stage1CaseWaitingForKickoff]);

  const latestSmsTimelineAt = useMemo(
    () =>
      detail.timeline.find((event) => event.type === "SMS_SENT" || event.type === "AGENT_SMS_SENT")?.at ??
      detail.contactExecution.lastSentAt ??
      null,
    [detail.contactExecution.lastSentAt, detail.timeline],
  );

  useEffect(() => {
    if (!latestSmsTimelineAt) return;
    setDetail((prev) => (prev.lastSmsSentAt === latestSmsTimelineAt ? prev : { ...prev, lastSmsSentAt: latestSmsTimelineAt }));
  }, [latestSmsTimelineAt]);

  useEffect(() => {
    setStage2ModelRunState((prev) => {
      if (prev.status === "RUNNING") return prev;
      if (!stage2StoredModelAvailable) return prev;
      return {
        ...prev,
        status: "DONE",
        updatedAt: ssotModel2?.updatedAt ?? prev.updatedAt ?? nowIso(),
        completedAt: ssotModel2?.updatedAt ?? prev.completedAt ?? nowIso(),
        progress: 100,
        etaSeconds: 0,
        recommendedLabel: stage2ClassLabelFromModel(ssotModel2?.predictedLabel),
      };
    });
  }, [ssotModel2?.predictedLabel, ssotModel2?.updatedAt, stage2StoredModelAvailable]);

  useEffect(() => {
    setStage3ModelRunState((prev) => {
      if (prev.status === "RUNNING") return prev;
      if (!stage3StoredModelAvailable) return prev;
      return {
        ...prev,
        status: "DONE",
        updatedAt: ssotModel3?.updatedAt ?? prev.updatedAt ?? nowIso(),
        completedAt: ssotModel3?.updatedAt ?? prev.completedAt ?? nowIso(),
        progress: 100,
        etaSeconds: 0,
      };
    });
  }, [ssotModel3?.updatedAt, stage3StoredModelAvailable]);

  useEffect(() => {
    const ticker = window.setInterval(() => setNowTick(Date.now()), 1000);
    return () => window.clearInterval(ticker);
  }, []);

  useEffect(() => {
    if (!callActive) return;
    const timer = window.setInterval(() => {
      setCallSeconds((prev) => prev + 1);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [callActive]);

  useEffect(() => {
    const shouldLoadRag =
      activeStage1Modal === "CONTACT_EXECUTION" ||
      (isStage3Mode && stage3TaskModalStep === "CONTACT_EXECUTION");
    if (!shouldLoadRag) return;
    setRagLoading(true);
    const timer = window.setTimeout(() => {
      const recommendations = buildRagRecommendations(detail, mode);
      setRagRecommendations(recommendations);
      const first = recommendations[0];
      setSelectedRagId(first?.id ?? null);
      setRagEditedScript(first?.scriptBody ?? "");
      setRagLoading(false);
    }, 180);

    return () => window.clearTimeout(timer);
  }, [activeStage1Modal, detail, isStage3Mode, mode, stage3TaskModalStep]);

  const interventionGuides = useMemo(() => getStage1InterventionGuides(), []);

  const nextOpenTodo = useMemo(() => detail.todos.find((todo) => todo.status === "OPEN"), [detail.todos]);

  const filteredTimeline = useMemo(() => {
    if (timelineFilter === "ALL") return detail.timeline;
    return detail.timeline.filter((event) => eventToCategory(event) === timelineFilter);
  }, [detail.timeline, timelineFilter]);

  const hasSmsReservationSignal = useMemo(
    () =>
      detail.reservation?.source === "SMS" ||
      detail.timeline.some(
        (event) =>
          event.type === "SMS_RESERVATION_RESERVED" ||
          event.type === "SMS_RESERVATION_CANCELLED" ||
          event.type === "SMS_RESERVATION_CHANGED" ||
          event.type === "SMS_RESERVATION_NO_SHOW",
      ) ||
      ssotEvents.some((event) => event.type === "BOOKING_CONFIRMED" && String(event.payload?.source ?? "").toLowerCase() === "citizen"),
    [detail.reservation?.source, detail.timeline, ssotEvents],
  );

  const smsTemplate = useMemo(
    () => smsTemplateCatalog.find((template) => template.id === smsTemplateId) ?? smsTemplateCatalog[0],
    [smsTemplateCatalog, smsTemplateId]
  );

  const smsPreview = useMemo(() => {
    return smsTemplate.body({
      caseId: detail.header.caseId,
      centerName: DEFAULT_CENTER_NAME,
      centerPhone: DEFAULT_CENTER_PHONE,
      guideLink: DEFAULT_GUIDE_LINK,
      reservationLink: reservationInfoToBookingLine(detail.reservationInfo),
      unsubscribe: DEFAULT_UNSUBSCRIBE,
    });
  }, [detail.header.caseId, detail.reservationInfo, smsTemplate]);

  const selectedRecommendation = useMemo(
    () => ragRecommendations.find((item) => item.id === selectedRagId) ?? null,
    [ragRecommendations, selectedRagId]
  );

  const callScriptsForModal = useMemo(
    () => recommendationToCallScripts(mode, selectedRecommendation ?? undefined),
    [mode, selectedRecommendation]
  );

  const smsTemplatesForExecutor = useMemo(() => {
    if (detail.contactExecutor === "AGENT_SEND_ONLY") {
      return panelSmsTemplates.filter((item) => item.type !== "BOOKING");
    }
    if (!detail.reservationInfo) {
      return panelSmsTemplates.filter((item) => item.type !== "BOOKING");
    }
    return panelSmsTemplates;
  }, [detail.contactExecutor, detail.reservationInfo, panelSmsTemplates]);

  const hasGuardianPhone = Boolean(caseRecord?.profile.guardianPhone);
  const callGateReason = getGateFailureReason(detail.policyGates, [
    "CONSENT_OK",
    "CONTACTABLE_TIME_OK",
    "PHONE_VERIFIED",
  ]);
  const smsGateReason = getGateFailureReason(detail.policyGates, [
    "CONSENT_OK",
    "CONTACTABLE_TIME_OK",
    "PHONE_VERIFIED",
  ]);

  const callDisabledReason =
    callGateReason ??
    (callTarget === "guardian" && !hasGuardianPhone ? "보호자 연락처가 없습니다" : undefined);
  const smsDisabledReason =
    smsGateReason ??
    ((smsTargets.guardian && !hasGuardianPhone) || (!smsTargets.citizen && !smsTargets.guardian)
      ? !smsTargets.citizen && !smsTargets.guardian
        ? "수신 대상을 선택하세요"
        : "보호자 연락처가 없습니다"
      : undefined);

  const sensitivityFlags = [
    detail.preTriageInput?.contactHistory.hasComplaint ? "민원 이력" : null,
    detail.preTriageInput?.contactHistory.hasRefusal ? "거부 이력" : null,
  ].filter(Boolean) as string[];
  const currentHour = new Date(nowTick).getHours();
  const isNightWindow = currentHour >= 21 || currentHour < 8;
  const isNightBlocked = restrictNightSend && isNightWindow;
  const composerPreview = `${smsPreview}\n\n${CONTACT_DISCLAIMER}`;

  const appendAuditLog = useCallback(
    (message: string) => {
      const entry: AuditLogEntry = {
        id: `audit-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        at: formatDateTime(nowIso()),
        actor: detail.header.assigneeName || STAGE1_PANEL_OPERATOR,
        message,
      };
      setAuditLogs((prev) => [entry, ...prev]);
    },
    [detail.header.assigneeName],
  );

  const timelineEventTypeToSsot = (event: ContactEvent): EventType => {
    if (event.type === "CALL_ATTEMPT") return "CONTACT_RESULT";
    if (event.type === "SMS_SENT" || event.type === "MESSAGE_SENT" || event.type === "AGENT_SMS_SENT") return "CONTACT_SENT";
    if (event.type === "SMS_RESERVATION_RESERVED" || event.type === "SMS_RESERVATION_CHANGED") return "BOOKING_CONFIRMED";
    if (event.type === "SMS_RESERVATION_CANCELLED" || event.type === "SMS_RESERVATION_NO_SHOW") return "CONTACT_RESULT";
    if (event.type === "LINKAGE_CREATED") return "BOOKING_CREATED";
    if (event.type === "LINKAGE_APPROVED" || event.type === "LINKAGE_COMPLETED") return "BOOKING_CONFIRMED";
    if (event.type === "DIFF_SCHEDULED") return "STAGE3_DIFF_SCHEDULED";
    if (event.type === "DIFF_RESULT_APPLIED") return "STAGE3_RESULTS_RECORDED";
    if (event.type === "RISK_SERIES_UPDATED" || event.type === "RISK_REVIEWED") return "STAGE3_RISK_UPDATED";
    if (event.type === "STAGE2_PLAN_CONFIRMED") return "STAGE2_PLAN_CONFIRMED";
    if (event.type === "STAGE2_RESULTS_RECORDED") return "STAGE2_RESULTS_RECORDED";
    if (event.type === "STAGE2_STEP2_AUTOFILL_APPLIED") return "STAGE2_RESULTS_RECORDED";
    if (event.type === "STAGE2_MANUAL_EDIT_APPLIED") return "STAGE2_RESULTS_RECORDED";
    if (event.type === "STAGE2_CLASS_CONFIRMED") return "STAGE2_CLASS_CONFIRMED";
    if (event.type === "STAGE2_NEXT_STEP_SET") return "STAGE2_NEXT_STEP_SET";
    if (event.type === "INFERENCE_REQUESTED") return "INFERENCE_REQUESTED";
    if (event.type === "INFERENCE_STARTED") return "INFERENCE_STARTED";
    if (event.type === "INFERENCE_PROGRESS") return "INFERENCE_PROGRESS";
    if (event.type === "INFERENCE_COMPLETED") return "INFERENCE_COMPLETED";
    if (event.type === "INFERENCE_FAILED") return "INFERENCE_FAILED";
    if (event.type === "STATUS_CHANGE" && (event.from.includes("Stage") || event.to.includes("Stage"))) return "STAGE_CHANGE";
    return "DATA_SYNCED";
  };

  const appendTimeline = (event: ContactEvent) => {
    setDetail((prev) => ({ ...prev, timeline: [event, ...prev.timeline] }));
    if (caseRecord?.id) {
      recordCaseEvent(
        caseRecord.id,
        timelineEventTypeToSsot(event),
        {
          timelineType: event.type,
          at: event.at,
        },
        detail.header.assigneeName,
      );
    }
  };

  const applySmsReservationSyncEvent = useCallback(
    (syncEvent: SmsReservationSyncEvent) => {
      const reservationStatus = toReservationStatus(syncEvent.status);
      const timelineType = SMS_RESERVATION_EVENT_TYPE_BY_STATUS[reservationStatus];
      const outcomeCode = mapReservationStatusToOutcome(reservationStatus);
      const eventAt = syncEvent.updatedAt || syncEvent.createdAt || nowIso();
      const programName = syncEvent.programName || syncEvent.programType || "시민 예약";
      const summary = `${programName} · ${RESERVATION_STATUS_LABELS[reservationStatus]}`;
      const autoMemo =
        reservationStatus === "CANCELLED"
          ? "시민이 문자 링크 예약을 취소했습니다. 후속 연락 일정을 확인해 주세요."
          : reservationStatus === "NO_SHOW"
            ? "시민 예약 노쇼가 확인되었습니다. 재접촉 계획을 검토해 주세요."
            : `시민이 문자 링크로 예약을 완료했습니다${syncEvent.scheduledAt ? ` (${formatDateTime(syncEvent.scheduledAt)})` : ""}.`;

      const latestSmsStatus = detail.timeline.find((event) => event.type === "SMS_SENT");
      const needsSmsConsistencyWarning =
        latestSmsStatus?.status === "PENDING" ||
        latestSmsStatus?.status === "FAILED" ||
        (!latestSmsStatus && !detail.lastSmsSentAt);

      setDetail((prev) => {
        const baseLastSmsSentAt = syncEvent.lastSmsSentAt ?? prev.lastSmsSentAt ?? prev.contactExecution.lastSentAt ?? eventAt;
        const nextExecutionStatus = prev.contactExecution.status === "NOT_STARTED" ? "WAITING_RESPONSE" : prev.contactExecution.status;
        const nextLinkageStatus =
          reservationStatus === "RESERVED" || reservationStatus === "CHANGED"
            ? "BOOKING_DONE"
            : prev.linkageStatus;
        const nextExecution: ContactExecution = {
          ...prev.contactExecution,
          status: nextExecutionStatus,
          lastSentAt: prev.contactExecution.lastSentAt ?? baseLastSmsSentAt,
          lastResponseAt: eventAt,
          lastOutcomeCode: outcomeCode,
        };
        const nextReservation: ReservationSnapshot = {
          source: "SMS",
          status: reservationStatus,
          programType: syncEvent.programType ?? prev.reservation?.programType,
          programName,
          scheduledAt: syncEvent.scheduledAt ?? prev.reservation?.scheduledAt,
          locationName: syncEvent.locationName ?? prev.reservation?.locationName,
          options: syncEvent.options ?? prev.reservation?.options,
          createdAt: prev.reservation?.createdAt ?? syncEvent.createdAt ?? eventAt,
          updatedAt: eventAt,
          createdBy: syncEvent.createdBy === "AGENT" ? "AGENT" : syncEvent.createdBy === "STAFF" ? "STAFF" : "CITIZEN",
          reservationId: syncEvent.reservationId ?? prev.reservation?.reservationId,
        };

        const nextReservationInfo: ReservationInfo | undefined =
          reservationStatus === "RESERVED" || reservationStatus === "CHANGED"
            ? {
                route: prev.reservationInfo?.route ?? "CENTER_VISIT_BOOKING",
                reservationType: syncEvent.programType ?? prev.reservationInfo?.reservationType ?? "문자 예약",
                scheduledAt: syncEvent.scheduledAt ?? prev.reservationInfo?.scheduledAt,
                place: syncEvent.locationName ?? prev.reservationInfo?.place,
                contactGuide: prev.reservationInfo?.contactGuide ?? DEFAULT_CENTER_PHONE,
                note: syncEvent.note ?? prev.reservationInfo?.note,
              }
            : prev.reservationInfo;

        return {
          ...prev,
          lastSmsSentAt: baseLastSmsSentAt,
          reservation: nextReservation,
          reservationInfo: nextReservationInfo,
          linkageStatus: nextLinkageStatus,
          contactExecution: nextExecution,
          contactFlowSteps: buildContactFlowSteps(nextExecution, prev.preTriageResult, nextLinkageStatus, mode),
        };
      });

      appendTimeline({
        type: timelineType,
        at: eventAt,
        actor: "CITIZEN",
        source: "SMS",
        summary: `[SMS] 시민 예약 ${RESERVATION_STATUS_LABELS[reservationStatus]}`,
        reservationId: syncEvent.reservationId,
        programName,
        scheduledAt: syncEvent.scheduledAt,
        by: detail.header.assigneeName,
      });
      appendAuditLog(`[SMS] 예약 동기화: ${summary}`);

      if (needsSmsConsistencyWarning) {
        appendTimeline({
          type: "INCONSISTENT_SMS_STATUS",
          at: eventAt,
          summary: "예약 이벤트가 도착했지만 문자 발송 상태 확인이 필요합니다.",
          detail: latestSmsStatus ? `최근 문자 상태 ${latestSmsStatus.status}` : "문자 발송 로그가 없습니다.",
          reservationId: syncEvent.reservationId,
          by: detail.header.assigneeName,
        });
        appendAuditLog("INCONSISTENT_SMS_STATUS: 문자 발송 상태 확인 필요");
      }

      if (!responseManualEditedRef.current) {
        setSelectedOutcomeCode(outcomeCode);
        setOutcomeNote(autoMemo);
        setResponseReasonTags((prev) => prev);
        setResponseValidationError(null);
        setResponseDraftDirty(false);
        setResponseLastSavedAt(eventAt);
        setAutoFilledOutcomeState({
          source: "SMS",
          outcome: outcomeCode,
          summary: autoMemo,
          autoFilledAt: eventAt,
        });
      } else {
        setAutoFilledOutcomeState((prev) =>
          prev ?? {
            source: "SMS",
            outcome: outcomeCode,
            summary: "문자 예약 동기화가 도착했지만 기존 수동 입력을 유지했습니다.",
            autoFilledAt: eventAt,
            manualOverriddenAt: nowIso(),
          },
        );
      }
    },
    [appendAuditLog, detail.header.assigneeName, detail.lastSmsSentAt, detail.timeline, mode],
  );

  useEffect(() => {
    if (typeof window === "undefined") return;

    const runSync = () => {
      const events = listSmsReservationSyncEvents();
      if (!events.length) return;

      events
        .filter((event) =>
          matchSmsReservationSyncEvent(event, {
            caseId: detail.header.caseId,
            phoneCandidates: [
              caseRecord?.profile.phone,
              caseRecord?.profile.guardianPhone,
              ssotCase?.patient.phone,
              ssotCase?.patient.caregiverPhone,
            ],
          }),
        )
        .sort((a, b) => a.updatedAt.localeCompare(b.updatedAt))
        .forEach((event) => {
          const key = `${event.reservationId ?? event.eventId}:${event.status}:${event.updatedAt}`;
          if (processedSmsReservationEventKeysRef.current.has(key)) return;
          processedSmsReservationEventKeysRef.current.add(key);
          applySmsReservationSyncEvent(event);
        });
    };

    runSync();
    const timer = window.setInterval(runSync, 5000);
    const onStorage = (event: StorageEvent) => {
      if (event.key === SMS_RESERVATION_SYNC_STORAGE_KEY) {
        runSync();
      }
    };
    window.addEventListener("storage", onStorage);

    return () => {
      window.clearInterval(timer);
      window.removeEventListener("storage", onStorage);
    };
  }, [
    applySmsReservationSyncEvent,
    caseRecord?.profile.guardianPhone,
    caseRecord?.profile.phone,
    detail.header.caseId,
    ssotCase?.patient.caregiverPhone,
    ssotCase?.patient.phone,
  ]);

  const stage2AutoFillFieldHasValue = useCallback(
    (field: Stage2AutoFillFieldKey) => {
      if (!stage2AutoFillPayload) return false;
      if (field === "cdr") return stage2AutoFillPayload.cdr != null || stage2AutoFillPayload.gds != null;
      return stage2AutoFillPayload[field] != null;
    },
    [stage2AutoFillPayload],
  );

  useEffect(() => {
    if (!isStage2OpsView) return;
    if (stage3TaskModalStep !== "CONTACT_EXECUTION") return;
    if (!caseRecord?.id) return;

    let mounted = true;
    setStage2AutoFillLoading(true);
    setStage2AutoFillError(null);
    const riskBand = inferStage2Step2RiskBand(caseRecord, ssotCase?.classification, ssotCase?.riskScore);

    const applyPayload = (rawPayload: Stage2Step2AutoFillPayload) => {
      const payload = ensureStage2Step2AutofillPayload(rawPayload, riskBand);
      const normalizedCdr = payload.cdr ?? payload.gds;

      setStage2AutoFillPayload(payload);
      setStage2IntegrationState((prev) => ({
        ...prev,
        lastSyncedAt: payload.syncedAt,
        receivedAt: payload.receivedMeta.receivedAt ?? prev.receivedAt,
        sourceOrg: payload.receivedMeta.providerName ?? prev.sourceOrg,
      }));
      setStage2Diagnosis((prev) => {
        const nextRoute: Stage2Route = stage2PlanRouteDraft === "HOSPITAL_REFERRAL" ? "HOSPITAL" : "CENTER";
        const nextTests = {
          ...prev.tests,
          mmse: payload.mmse ?? prev.tests.mmse,
          cdr: normalizedCdr ?? prev.tests.cdr,
          neuroCognitiveType: payload.cogTestType ?? prev.tests.neuroCognitiveType,
          specialist:
            payload.specialistOpinionStatus != null
              ? payload.specialistOpinionStatus === "DONE"
              : prev.tests.specialist,
        };
        return {
          ...prev,
          tests: nextTests,
          status: stage2StatusFromTests(nextTests, Boolean(prev.classification?.label), nextRoute),
        };
      });
      stage2AutoFillBaselineRef.current = {
        mmse: payload.mmse ?? null,
        cdr: normalizedCdr ?? null,
        neuro: payload.cogTestType ?? null,
        specialist: payload.specialistOpinionStatus != null ? payload.specialistOpinionStatus === "DONE" : null,
      };
      appendTimeline({
        type: "STAGE2_STEP2_AUTOFILL_APPLIED",
        at: payload.syncedAt,
        by: detail.header.assigneeName,
        summary: `source=${payload.source} · fields=${(payload.filledFields ?? []).join(", ") || "-"}`,
      });
      appendAuditLog(
        `STEP2_AUTOFILL_APPLIED: ${payload.source} · 누락 ${payload.missingRequiredCount}건 · 동기화 ${formatDateTime(payload.syncedAt)}`,
      );
    };

    fetchStage2Step2Autofill(caseRecord.id)
      .then((response) => {
        if (!mounted) return;
        applyPayload(response.item);
      })
      .catch((error) => {
        if (!mounted) return;
        const message = error instanceof Error ? error.message : "자동 기입 실패";
        const fallback = buildStage2Step2SeedAutofill(caseRecord.id, riskBand);
        setStage2AutoFillError(`${message} · 기본 자동채움 적용`);
        applyPayload(fallback);
        toast("STEP2 자동 기입 연결에 실패해 기본 자동채움을 적용했습니다.");
      })
      .finally(() => {
        if (!mounted) return;
        setStage2AutoFillLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [
    appendAuditLog,
    caseRecord?.id,
    detail.header.assigneeName,
    isStage2OpsView,
    ssotCase?.classification,
    ssotCase?.riskScore,
    stage2PlanRouteDraft,
    stage3TaskModalStep,
  ]);

  const collectStage2ManualChangedFields = useCallback(() => {
    const baseline = stage2AutoFillBaselineRef.current;
    if (!baseline) return {} as Record<string, unknown>;
    const changed: Record<string, unknown> = {};
    const currentMmse = typeof stage2Diagnosis.tests.mmse === "number" ? stage2Diagnosis.tests.mmse : null;
    const currentCdr = typeof stage2Diagnosis.tests.cdr === "number" ? stage2Diagnosis.tests.cdr : null;
    const currentNeuro = stage2Diagnosis.tests.neuroCognitiveType ?? null;
    const currentSpecialist = stage2Diagnosis.tests.specialist ?? false;

    if (baseline.mmse !== currentMmse) changed.mmse = currentMmse;
    if (baseline.cdr !== currentCdr) changed.cdr = currentCdr;
    if (baseline.neuro !== currentNeuro) changed.cogTestType = currentNeuro;
    if (baseline.specialist != null && baseline.specialist !== currentSpecialist) {
      changed.specialistOpinionStatus = currentSpecialist ? "DONE" : "MISSING";
    }
    return changed;
  }, [stage2Diagnosis.tests.cdr, stage2Diagnosis.tests.mmse, stage2Diagnosis.tests.neuroCognitiveType, stage2Diagnosis.tests.specialist]);

  const saveStage2TestInputs = () => {
    const changedFields = collectStage2ManualChangedFields();
    const validationErrors = buildStage2ValidationErrors(
      stage2EffectiveTests,
      stage2PlanRouteDraft as Stage2PlanRoute,
      stage2PlanRequiredDraft as Stage2PlanRequiredDraft,
    );
    const hasManualChange = Object.keys(changedFields).length > 0;
    if ((stage2ManualEditEnabled || hasManualChange) && stage2ManualEditReason.trim().length < 5) {
      validationErrors.manualEditReason = "수동 수정 사유를 5자 이상 입력하세요.";
    }
    if (applyStage2ValidationErrors(validationErrors)) {
      toast.error("필수 입력/오류 항목을 먼저 보완해 주세요.");
      return false;
    }
    setStage2FieldErrors({});

    const hasClassification = Boolean(stage2Diagnosis.classification?.label);
    const nextStatus = stage2StatusFromTests(stage2EffectiveTests, hasClassification, stage2Route);
    const missingKeys = computeStage2MissingFields(
      stage2EffectiveTests,
      stage2PlanRouteDraft as Stage2PlanRoute,
      stage2PlanRequiredDraft as Stage2PlanRequiredDraft,
    );
    setStage2Diagnosis((prev) => ({
      ...prev,
      status: nextStatus,
    }));
    setStage2IntegrationState((prev) => ({
      ...prev,
      receivedAt: missingKeys.length === 0 ? nowIso() : prev.receivedAt,
      lastSyncedAt: nowIso(),
      sourceOrg: stage2HospitalDraft || prev.sourceOrg,
    }));

    if (caseRecord?.id) {
      updateCaseStage2Evidence(
        caseRecord.id,
        {
          specialist: Boolean(stage2EffectiveTests.specialist),
          mmse: typeof stage2EffectiveTests.mmse === "number" ? stage2EffectiveTests.mmse : null,
          cdrOrGds: typeof stage2EffectiveTests.cdr === "number" ? stage2EffectiveTests.cdr : null,
          neuroType: stage2EffectiveTests.neuroCognitiveType ?? null,
        },
        {
          route: stage2PlanRouteDraft === "HOSPITAL_REFERRAL" ? "HOSPITAL" : "CENTER",
          actorId: detail.header.assigneeName,
        },
      );
    }

    if (missingKeys.length === 0) {
      const now = nowIso();
      const recommended = deriveStage2ModelRecommendation(stage2EffectiveTests);

      if (stage2StoredModelAvailable) {
        setStage2ModelRunState((prev) => ({
          ...prev,
          status: "DONE",
          startedAt: prev.startedAt ?? now,
          updatedAt: now,
          completedAt: now,
          progress: 100,
          etaSeconds: 0,
          recommendedLabel: stage2ClassLabelFromModel(ssotModel2?.predictedLabel) ?? recommended,
        }));
        appendAuditLog("Stage2 기존 모델 결과를 재사용했습니다.");
      } else {
        setStage2ModelRunState((prev) => ({
          ...prev,
          status: "RUNNING",
          startedAt: now,
          updatedAt: now,
          completedAt: undefined,
          progress: 3,
          etaSeconds: null,
          recommendedLabel: recommended,
          failureReason: undefined,
        }));
        appendTimeline({
          type: "INFERENCE_REQUESTED",
          stage: 2,
          at: now,
          by: detail.header.assigneeName,
          summary: "Stage2 모델 실행 요청",
        });
        appendTimeline({
          type: "INFERENCE_STARTED",
          stage: 2,
          at: now,
          by: detail.header.assigneeName,
          summary: "Stage2 모델 실행 시작",
        });
        appendAuditLog("Stage2 모델 실행 요청");
      }
    } else {
      setStage2ModelRunState((prev) => ({
        ...prev,
        status: "PENDING",
        updatedAt: nowIso(),
        startedAt: undefined,
        completedAt: undefined,
        progress: 0,
        etaSeconds: null,
      }));
    }

    appendTimeline({
      type: "STATUS_CHANGE",
      at: nowIso(),
      from: "검사입력",
      to: "검사입력",
      reason: `Stage2 검사 입력 반영 (${countStage2CompletedTests(stage2EffectiveTests, stage2Route)}/${stage2RequiredTestCount})`,
      by: detail.header.assigneeName,
    });
    if (hasManualChange) {
      const reason = stage2ManualEditReason.trim();
      appendTimeline({
        type: "STAGE2_MANUAL_EDIT_APPLIED",
        at: nowIso(),
        by: detail.header.assigneeName,
        summary: `fields=${Object.keys(changedFields).join(", ") || "-"} · reason=${reason || "-"}`,
      });
      if (caseRecord?.id) {
        void submitStage2Step2ManualEdit(caseRecord.id, {
          changedFields,
          reason,
          editor: detail.header.assigneeName,
        }).catch(() => {
          toast.error("수동 수정 감사로그 동기화에 실패했습니다.");
        });
      }
    }
    stage2AutoFillBaselineRef.current = {
      mmse: typeof stage2Diagnosis.tests.mmse === "number" ? stage2Diagnosis.tests.mmse : null,
      cdr: typeof stage2Diagnosis.tests.cdr === "number" ? stage2Diagnosis.tests.cdr : null,
      neuro: stage2Diagnosis.tests.neuroCognitiveType ?? null,
      specialist: stage2Diagnosis.tests.specialist ?? null,
    };
    if (stage2ManualEditEnabled) {
      setStage2ManualEditEnabled(false);
    }
    setStage2ManualEditReason("");
    if ((stage2ManualEditEnabled || hasManualChange) && stage2ManualEditReason.trim()) {
      appendAuditLog(`Stage2 수동 수정: ${stage2ManualEditReason.trim()}`);
    }
    appendAuditLog(`Stage2 검사 결과 입력 반영: ${countStage2CompletedTests(stage2EffectiveTests, stage2Route)}/${stage2RequiredTestCount}`);
    if (caseRecord?.id) {
      void queryClient.invalidateQueries({ queryKey: ["caseDetail", caseRecord.id] });
    }
    void queryClient.invalidateQueries({ queryKey: ["stage2Cases"] });
    void queryClient.invalidateQueries({ queryKey: ["dashboardStats"] });
    if (caseRecord?.id) {
      void queryClient.invalidateQueries({ queryKey: ["local-center", "case", caseRecord.id] });
    }
    void queryClient.invalidateQueries({ queryKey: ["local-center", "cases"] });
    void queryClient.invalidateQueries({ queryKey: ["local-center", "dashboard-stats"] });
    toast.success("검사 결과 입력이 반영되었습니다.");
    return true;
  };

  const confirmStage2Classification = () => {
    const validationErrors = buildStage2ValidationErrors(
      stage2EffectiveTests,
      stage2PlanRouteDraft as Stage2PlanRoute,
      stage2PlanRequiredDraft as Stage2PlanRequiredDraft,
      {
        rationale: stage2RationaleDraft,
        recommendedLabel: stage2ModelRecommendedLabel,
        selectedLabel: stage2ClassificationDraft,
        overrideReason: stage2ClassificationOverrideReason,
      },
    );
    if (applyStage2ValidationErrors(validationErrors)) {
      toast.error("분류 확정 전에 누락 항목을 확인해 주세요.");
      return;
    }
    if (!stage2CanConfirm) {
      toast.error("분류 확정 요건이 부족합니다.");
      return;
    }

    const label = stage2ClassificationDraft;
    const mciStage = label === "MCI" ? inferStage2MciStage(caseRecord) : undefined;
    const probs = inferStage2Probs(label, mciStage);
    const nextStep = inferStage2NextStep(label);
    const now = nowIso();
    const nextStatus = stage2StatusFromTests(stage2EffectiveTests, true, stage2Route);

    setStage2Diagnosis((prev) => ({
      ...prev,
      status: nextStatus,
      classification: {
        label,
        probs,
        mciStage,
      },
      nextStep,
    }));
    setStage2ConfirmedAt(now);
    setStage2ClassificationEdited(false);
    setStage2FieldErrors({});

    if (caseRecord?.id) {
      confirmCaseStage2Model(caseRecord.id, label, {
        mciBand: mciStage === "적정" ? "중간" : mciStage,
        rationale: `${stage2RationaleDraft.trim()}${
          stage2ClassificationIsOverride && stage2ClassificationOverrideReason.trim()
            ? ` (override: ${stage2ClassificationOverrideReason.trim()})`
            : ""
        }`,
        actorId: detail.header.assigneeName,
      });
    }

    appendTimeline({
      type: "STATUS_CHANGE",
      at: now,
      from: "분류확정대기",
      to: `분류확정(${label}${mciStage ? `-${mciStage}` : ""})`,
      reason: stage2RationaleDraft.trim() || "진단 결과 라벨 확정",
      by: detail.header.assigneeName,
    });
    appendAuditLog(`Stage2 분류 확정: ${label}${mciStage ? `(${mciStage})` : ""}`);
    toast.success("분류가 확정되었습니다.");
  };

  const setStage2NextStep = (nextStep: Stage2Diagnosis["nextStep"], summary: string) => {
    setStage2Diagnosis((prev) => ({
      ...prev,
      nextStep,
    }));

    if (caseRecord?.id && nextStep) {
      setCaseNextStep(caseRecord.id, nextStep, {
        actorId: detail.header.assigneeName,
        summary,
      });
    }

    appendTimeline({
      type: "PLAN_UPDATED",
      at: nowIso(),
      by: detail.header.assigneeName,
      summary,
    });
    appendAuditLog(`Stage2 다음 단계 결정: ${summary}`);
    toast.success("다음 단계가 반영되었습니다.");
  };

  const saveStage2Booking = () => {
    setDetail((prev) => ({
      ...prev,
      linkageStatus: "BOOKING_DONE",
      reservationInfo: {
        route: "HOSPITAL_REFERRAL_BOOKING",
        reservationType: "2차 진단검사 예약",
        scheduledAt: stage2ScheduleDraft,
        place: stage2HospitalDraft,
        contactGuide: DEFAULT_CENTER_PHONE,
        note: "Stage2 검사 예약 등록",
      },
    }));

    if (caseRecord?.id) {
      setCaseBookingPending(caseRecord.id, 0, detail.header.assigneeName);
    }

    appendTimeline({
      type: "LINKAGE_CREATED",
      at: nowIso(),
      by: detail.header.assigneeName,
      linkageType: "HOSPITAL",
      summary: `검사 예약 등록 (${stage2HospitalDraft})`,
    });
    appendAuditLog(`검사 예약 관리 저장: ${stage2HospitalDraft} / ${formatDateTime(stage2ScheduleDraft)}`);
    toast.success("검사 예약이 저장되었습니다.");
  };

  const appendAgentExecutionLog = (entry: Omit<AgentExecutionLog, "id">) => {
    const nextEntry: AgentExecutionLog = {
      ...entry,
      id: `agent-log-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    };
    setDetail((prev) => ({
      ...prev,
      agentExecutionLogs: [nextEntry, ...prev.agentExecutionLogs],
    }));
  };

  const updateGateStatus = (key: PolicyGateKey, status: PolicyGate["status"], byActionLabel: string) => {
    setDetail((prev) => ({
      ...prev,
      policyGates: prev.policyGates.map((gate) =>
        gate.key === key ? { ...gate, status, failReason: status === "PASS" ? undefined : gate.failReason } : gate
      ),
    }));

    appendTimeline({
      type: "POLICY_GATE_UPDATE",
      at: nowIso(),
      key,
      status,
      by: detail.header.assigneeName,
    });
    appendAuditLog(`정책 게이트 업데이트 (${byActionLabel})`);
  };

  const regenerateTodos = (level: InterventionLevel, qualityLevel: DataQualityLevel) => {
    setDetail((prev) => {
      const existingDone = new Set(prev.todos.filter((todo) => todo.status === "DONE").map((todo) => todo.title));
      const nextTodos = buildTodos(level, qualityLevel).map((todo) =>
        existingDone.has(todo.title) ? { ...todo, status: "DONE" as const } : todo
      );

      return { ...prev, todos: nextTodos };
    });
  };

  const changeTodoStatus = (todoId: string, status: TodoItem["status"]) => {
    setDetail((prev) => ({
      ...prev,
      todos: prev.todos.map((todo) => (todo.id === todoId ? { ...todo, status } : todo)),
    }));

    const target = detail.todos.find((todo) => todo.id === todoId);
    if (!target) return;

    appendTimeline({
      type: "STATUS_CHANGE",
      at: nowIso(),
      from: target.status,
      to: status,
      reason: `To-Do 처리: ${target.title}`,
      by: detail.header.assigneeName,
    });

    appendAuditLog(`To-Do ${status === "DONE" ? "완료" : status === "SNOOZED" ? "보류" : "취소"}: ${target.title}`);
    toast.success("처리 완료(로그 기록됨)");
  };

  const completeSuggestedTodo = (action: TodoItem["suggestedAction"]) => {
    const target = detail.todos.find((todo) => todo.status === "OPEN" && todo.suggestedAction === action);
    if (!target) return;
    changeTodoStatus(target.id, "DONE");
  };

  const runStage1SmsAutoContactCompleteScenario = useCallback(
    async (item: SmsHistoryItem) => {
      if (mode !== "stage1" || isStage2Mode || isStage3Mode || !caseRecord) return false;

      const normalizedCaseName = (caseRecord.profile.name ?? "").replace(/\s+/g, "");
      const normalizedTargetName = STAGE1_SMS_AUTO_CONTACT_COMPLETE_NAME.replace(/\s+/g, "");
      const normalizedPreview = (item.preview ?? "").replace(/\s+/g, "");
      const isTargetCase =
        STAGE1_SMS_AUTO_CONTACT_COMPLETE_CASE_IDS.has(caseRecord.id) ||
        normalizedCaseName === normalizedTargetName ||
        normalizedPreview.includes(normalizedTargetName);
      if (!isTargetCase) return false;

      const now = nowIso();
      const scheduledAt = withHoursFromNow(24);
      const title = `${caseRecord.profile.name} 접촉 완료 후속 확인`;
      const idempotencyKey = `${caseRecord.id}:stage1-sms-complete:${item.id}`;
      let linkageAfter: LinkageStatus = "BOOKING_DONE";

      try {
        await createStage1CalendarEvent({
          idempotencyKey,
          event: {
            caseId: caseRecord.id,
            type: "FOLLOWUP",
            title,
            startAt: scheduledAt,
            durationMin: 20,
            priority: "NORMAL",
            payload: {
              scenario: "STAGE1_SMS_CONTACT_COMPLETE",
              trigger: "SMS_SENT",
            },
          },
        });
        appendTimeline({
          type: "CALENDAR_SYNC",
          at: nowIso(),
          status: "SUCCESS",
          eventType: "FOLLOWUP",
          title,
          scheduledAt,
          idempotencyKey,
          by: detail.header.assigneeName,
        });
        appendTimeline({
          type: "CAL_EVENT_CREATED",
          at: nowIso(),
          scheduledAt,
          summary: `${caseRecord.profile.name} · 문자 접촉 완료 후속 일정`,
          by: detail.header.assigneeName,
        });
        appendAuditLog(`캘린더 등록 완료(자동 시나리오): ${title} · ${formatDateTime(scheduledAt)}`);
      } catch (error) {
        linkageAfter = "BOOKING_IN_PROGRESS";
        const errorMessage = error instanceof Error ? error.message : "캘린더 등록 실패";
        appendTimeline({
          type: "CALENDAR_SYNC",
          at: nowIso(),
          status: "FAILED",
          eventType: "FOLLOWUP",
          title,
          scheduledAt,
          idempotencyKey,
          error: errorMessage,
          by: detail.header.assigneeName,
        });
        appendAuditLog(`캘린더 등록 실패(자동 시나리오): ${errorMessage}`);
      }

      const nextOutcomeCode: OutcomeCode = "CONTINUE_SELF";
      completeSuggestedTodo("SMS");
      setRecontactDueAt(scheduledAt);
      setDetail((prev) => {
        const nextExec: ContactExecution = {
          ...prev.contactExecution,
          status: "DONE",
          lastSentAt: now,
          lastResponseAt: now,
          lastOutcomeCode: nextOutcomeCode,
          retryCount: prev.contactExecution.retryCount + 1,
        };
        return {
          ...prev,
          linkageStatus: linkageAfter,
          contactExecution: nextExec,
          contactFlowSteps: buildContactFlowSteps(nextExec, prev.preTriageResult, linkageAfter, mode),
        };
      });

      appendTimeline({
        type: "OUTCOME_RECORDED",
        at: now,
        outcomeCode: nextOutcomeCode,
        note: "Stage1 문자 발송 자동 시나리오(김복남 데모)",
        by: detail.header.assigneeName,
      });
      appendTimeline({
        type: "MESSAGE_SENT",
        at: now,
        summary: "STAGE1_SMS_AUTO_COMPLETE · 접촉 완료 처리",
        by: detail.header.assigneeName,
      });
      appendAuditLog(`${caseRecord.profile.name} 케이스 자동 시나리오 적용: 문자 발송 후 접촉 완료 처리`);

      if (linkageAfter === "BOOKING_DONE") {
        toast.success("문자 발송 후 접촉완료 처리 및 캘린더 일정 등록이 완료되었습니다.");
      } else {
        toast.error("접촉완료는 처리되었지만 캘린더 등록은 실패했습니다. 캘린더 재시도를 진행하세요.");
      }

      return true;
    },
    [
      appendAuditLog,
      appendTimeline,
      caseRecord,
      completeSuggestedTodo,
      detail.header.assigneeName,
      isStage2Mode,
      isStage3Mode,
      mode,
    ],
  );

  const handleGateFixAction = (gate: PolicyGate) => {
    const action = gate.fixAction?.action;
    if (!action) return;

    if (action === "CONFIRM_CONTACT_TIME") {
      updateGateStatus("CONTACTABLE_TIME_OK", "PASS", "접촉 채널 확인 처리");
      toast.success("처리 완료(로그 기록됨)");
      appendAuditLog("접촉 채널 확인 처리");
      return;
    }

    if (action === "REQUEST_CONSENT") {
      updateGateStatus("CONSENT_OK", "PASS", "동의 요청 처리");
      toast.success("처리 완료(로그 기록됨)");
      return;
    }

    if (action === "VERIFY_PHONE") {
      updateGateStatus("PHONE_VERIFIED", "PASS", "연락처 검증");
      toast.success("처리 완료(로그 기록됨)");
      return;
    }

    if (action === "ADD_GUARDIAN") {
      updateGateStatus("GUARDIAN_OPTIONAL", "PASS", "보호자 연락처 등록");
      toast.success("처리 완료(로그 기록됨)");
    }
  };

  const openLevelChangeModal = (toLevel: InterventionLevel) => {
    if (toLevel === detail.interventionLevel) return;
    setReasonModal({
      mode: "LEVEL",
      title: `개입 레벨 변경 (${detail.interventionLevel} → ${toLevel})`,
      confirmLabel: "변경 적용",
      nextLevel: toLevel,
      reason: "",
    });
  };

  const openStatusReasonModal = (nextStatus: "보류" | "우선순위 제외") => {
    setReasonModal({
      mode: "STATUS",
      title: `${nextStatus} 처리 사유 입력`,
      confirmLabel: `${nextStatus} 적용`,
      nextStatus,
      reason: "",
    });
  };

  const handleLinkageAction = (action: Stage1LinkageAction) => {
    const meta = STAGE1_LINKAGE_ACTION_META[action];
    const before = detail.linkageStatus;
    const after = meta.nextStatus;

    setDetail((prev) => {
      const newExec: ContactExecution = {
        ...prev.contactExecution,
        status:
          prev.contactExecution.status === "STOPPED"
            ? "STOPPED"
            : prev.contactExecution.status === "DONE"
              ? "DONE"
              : "HANDOFF_TO_HUMAN",
      };

      return {
        ...prev,
        linkageStatus: after,
        contactExecution: newExec,
        contactFlowSteps: buildContactFlowSteps(newExec, prev.preTriageResult, after, mode),
      };
    });

    appendTimeline({
      type: "STATUS_CHANGE",
      at: nowIso(),
      from: LINKAGE_STATUS_HINT[before],
      to: LINKAGE_STATUS_HINT[after],
      reason: `${meta.title} 실행`,
      by: detail.header.assigneeName,
    });
    appendAuditLog(`연계 실행: ${meta.title}`);
    toast.success(`${meta.title}가 기록되었습니다.`);
  };

  const applyStage3ActionDecision = (actionId: string, decision: "APPROVED" | "HOLD") => {
    if (!isStage3Mode) return;
    const target = detail.stage3?.recommendedActions.find((action) => action.id === actionId);
    if (!target) return;

    const now = nowIso();
    setDetail((prev) => {
      if (!prev.stage3) return prev;
      const nextActions = prev.stage3.recommendedActions.map((action) =>
        action.id === actionId ? { ...action, decision } : action
      );
      const pendingApprovalCount = nextActions.filter((action) => action.requiresApproval && action.decision === "PENDING").length;

      let nextReevalStatus = prev.stage3.reevalStatus;
      let nextPlanStatus = prev.stage3.headerMeta.planStatus;
      let nextPlanUpdatedAt = prev.stage3.planUpdatedAt;
      let nextLinkage = prev.linkageStatus;

      if (decision === "APPROVED") {
        if (target.type === "SCHEDULE_REEVAL") {
          nextReevalStatus = "SCHEDULED";
        }
        if (target.type === "UPDATE_PLAN") {
          nextPlanStatus = "ACTIVE";
          nextPlanUpdatedAt = now;
        }
        if (target.type === "ESCALATE_LEVEL") {
          nextLinkage = "BOOKING_IN_PROGRESS";
        }
      }

      const nextStage3 = {
        ...prev.stage3,
        reevalStatus: nextReevalStatus,
        planUpdatedAt: nextPlanUpdatedAt,
        triggersReviewedAt: pendingApprovalCount === 0 ? now : prev.stage3.triggersReviewedAt,
        recommendedActions: nextActions,
        headerMeta: {
          ...prev.stage3.headerMeta,
          planStatus: nextPlanStatus,
          opsStatus:
            nextPlanStatus === "NEEDS_UPDATE"
              ? "PLAN_NEEDS_UPDATE"
              : nextReevalStatus === "PENDING"
                ? "REEVAL_PENDING"
                : nextLinkage !== "NOT_CREATED"
                  ? "LINKAGE_PENDING"
                  : "TRACKING",
        },
      };

      return {
        ...prev,
        linkageStatus: nextLinkage,
        stage3: nextStage3,
        contactFlowSteps: buildContactFlowSteps(prev.contactExecution, prev.preTriageResult, nextLinkage, mode),
      };
    });

    appendTimeline({
      type: "STAGE3_ACTION_DECISION",
      at: now,
      by: detail.header.assigneeName,
      actionId,
      decision,
      note: target.title,
    });

    if (decision === "APPROVED") {
      if (target.type === "SCHEDULE_REEVAL") {
        appendTimeline({
          type: "REEVAL_SCHEDULED",
          at: now,
          scheduledAt: detail.stage3?.headerMeta.nextReevalAt ?? withHoursFromNow(72),
          by: detail.header.assigneeName,
          reason: "권고 액션 승인",
        });
      } else if (target.type === "UPDATE_PLAN") {
        appendTimeline({
          type: "PLAN_UPDATED",
          at: now,
          by: detail.header.assigneeName,
          summary: "권고 액션 승인으로 플랜 업데이트",
        });
      } else if (target.type === "ESCALATE_LEVEL") {
        appendTimeline({
          type: "LINKAGE_CREATED",
          at: now,
          by: detail.header.assigneeName,
          linkageType: "CENTER",
          summary: "연계 실행 경로 생성",
        });
      } else if (target.type === "SEND_REMINDER") {
        appendTimeline({
          type: "SMS_SENT",
          at: now,
          templateId: "S3_REMINDER_TRACK",
          status: "PENDING",
          by: detail.header.assigneeName,
        });
      }
    }

    appendAuditLog(`Stage3 권고 ${decision === "APPROVED" ? "승인" : "보류"}: ${target.title}`);
    toast.success(`처리 완료(감사 로그 기록됨): ${target.title}`);
  };

  const handleStage3ReevalAction = (action: "SCHEDULE" | "RESCHEDULE" | "COMPLETE" | "NOSHOW") => {
    if (!isStage3Mode) return;
    const now = nowIso();
    const currentReevalAt = detail.stage3?.headerMeta.nextReevalAt ?? withHoursFromNow(72);
    const nextReevalAt =
      action === "RESCHEDULE" ? withHoursFromNow(120) : action === "COMPLETE" ? withHoursFromNow(24 * 14) : currentReevalAt;

    setDetail((prev) => {
      if (!prev.stage3) return prev;
      const nextReevalStatus: Stage3ReevalStatus =
        action === "COMPLETE" ? "COMPLETED" : action === "NOSHOW" ? "NOSHOW" : "SCHEDULED";
      const nextOpsStatus: Stage3OpsStatus =
        action === "COMPLETE"
          ? prev.stage3.headerMeta.planStatus === "NEEDS_UPDATE"
            ? "PLAN_NEEDS_UPDATE"
            : "TRACKING"
          : action === "NOSHOW"
            ? "CHURN_RISK"
            : "REEVAL_PENDING";

      return {
        ...prev,
        stage3: {
          ...prev.stage3,
          reevalStatus: nextReevalStatus,
          headerMeta: {
            ...prev.stage3.headerMeta,
            nextReevalAt,
            opsStatus: nextOpsStatus,
          },
        },
        contactFlowSteps: buildContactFlowSteps(prev.contactExecution, prev.preTriageResult, prev.linkageStatus, mode),
      };
    });

    if (action === "SCHEDULE") {
      appendTimeline({
        type: "REEVAL_SCHEDULED",
        at: now,
        scheduledAt: currentReevalAt,
        by: detail.header.assigneeName,
        reason: "재평가 일정 생성",
      });
      appendAuditLog(`재평가 일정 생성: ${formatDateTime(currentReevalAt)}`);
    } else if (action === "RESCHEDULE") {
      appendTimeline({
        type: "REEVAL_RESCHEDULED",
        at: now,
        from: currentReevalAt,
        to: nextReevalAt,
        by: detail.header.assigneeName,
        reason: "일정 재조율",
      });
      appendAuditLog(`재평가 일정 변경: ${formatDateTime(currentReevalAt)} → ${formatDateTime(nextReevalAt)}`);
    } else if (action === "COMPLETE") {
      appendTimeline({
        type: "REEVAL_COMPLETED",
        at: now,
        by: detail.header.assigneeName,
        note: "재평가 완료 기록",
      });
      appendAuditLog("재평가 완료 기록");
    } else {
      appendTimeline({
        type: "REEVAL_NOSHOW",
        at: now,
        by: detail.header.assigneeName,
        note: "노쇼 처리",
      });
      appendAuditLog("재평가 노쇼 처리");
    }
    toast.success("처리 완료(로그 기록됨)");
  };

  const handleStage3RiskReview = (options?: {
    summary?: string;
    nextAction?: Stage3RiskReviewDraft["nextAction"];
    silentToast?: boolean;
  }) => {
    if (!isStage3Mode) return;
    const now = nowIso();
    const summary = options?.summary ?? (isStage2OpsView ? "진단 진행 검토 완료" : "전환 위험 추세 검토 완료");
    setDetail((prev) => {
      if (!prev.stage3) return prev;
      const series = [...prev.stage3.transitionRisk.series];
      const lastPoint = series[series.length - 1];
      const riskPoint = lastPoint
        ? {
            t: now,
            risk2y: lastPoint.risk2y,
            ciLow: lastPoint.ciLow,
            ciHigh: lastPoint.ciHigh,
            source: "manual" as const,
            event: "REEVAL",
          }
        : {
            t: now,
            risk2y: prev.stage3.transitionRisk.risk2y_now,
            source: "manual" as const,
            event: "REEVAL",
          };
      const nextSeries = [...series.slice(-11), riskPoint];
      return {
        ...prev,
        stage3: {
          ...prev.stage3,
          riskReviewedAt: now,
          transitionRisk: {
            ...prev.stage3.transitionRisk,
            updatedAt: now,
            series: nextSeries,
          },
        },
      };
    });
    appendTimeline({
      type: "RISK_REVIEWED",
      at: now,
      by: detail.header.assigneeName,
      summary,
    });
    appendTimeline({
      type: "RISK_SERIES_UPDATED",
      at: now,
      by: detail.header.assigneeName,
      summary: isStage2OpsView ? "진단 진행 시계열 확인 시각 업데이트" : "전환 위험 시계열 확인 시각 업데이트",
    });
    appendAuditLog(`${isStage2OpsView ? "Stage2 진단 진행 검토" : "Stage3 위험 추세 검토"} 완료: ${summary}`);
    if (options?.nextAction) {
      setStage3LatestRiskReview({
        at: now,
        memo: summary,
        nextAction: options.nextAction,
      });
    }
    if (!options?.silentToast) {
      toast.success(isStage2OpsView ? "진단 진행 검토가 기록되었습니다." : "위험 추세 검토가 기록되었습니다.");
    }
  };

  const handleStage3DiffPathAction = (action: Stage3DiffPathAction) => {
    if (!isStage3Mode) return;
    const now = nowIso();
    if (action === "APPLY_RESULT") {
      setStage3DiffDraft((prev) => ({
        ...prev,
        riskReady: true,
        resultPerformedAt: prev.resultPerformedAt || now,
      }));
    }
    setDetail((prev) => {
      if (!prev.stage3) return prev;
      let nextStatus: Stage3DiffPathStatus = prev.stage3.diffPathStatus;
      let nextReeval: Stage3ReevalStatus = prev.stage3.reevalStatus;
      let nextPlanStatus: Stage3PlanStatus = prev.stage3.headerMeta.planStatus;
      let nextPlanUpdatedAt = prev.stage3.planUpdatedAt;
      let nextNextReevalAt = prev.stage3.headerMeta.nextReevalAt;
      let nextTransitionRisk = prev.stage3.transitionRisk;

      if (action === "CREATE_RECO") {
        nextStatus = "RECOMMENDED";
      } else if (action === "CREATE_REFER") {
        nextStatus = "REFERRED";
      } else if (action === "SCHEDULE") {
        nextStatus = "SCHEDULED";
        nextReeval = "SCHEDULED";
        nextNextReevalAt = withHoursFromNow(72);
        const lastPoint = prev.stage3.transitionRisk.series[prev.stage3.transitionRisk.series.length - 1];
        nextTransitionRisk = {
          ...prev.stage3.transitionRisk,
          updatedAt: now,
          series: [
            ...prev.stage3.transitionRisk.series.slice(-11),
            {
              t: now,
              risk2y: lastPoint?.risk2y ?? prev.stage3.transitionRisk.risk2y_now,
              ciLow: lastPoint?.ciLow,
              ciHigh: lastPoint?.ciHigh,
              source: "manual",
              event: "REEVAL",
            },
          ],
        };
      } else if (action === "COMPLETE") {
        nextStatus = "COMPLETED";
        nextReeval = "COMPLETED";
        const latest = prev.stage3.transitionRisk.series[prev.stage3.transitionRisk.series.length - 1];
        const risk2y = clamp01((latest?.risk2y ?? prev.stage3.transitionRisk.risk2y_now) - 0.03);
        nextTransitionRisk = {
          ...prev.stage3.transitionRisk,
          risk2y_now: risk2y,
          risk2y_label: risk2y >= 0.7 ? "HIGH" : risk2y >= 0.45 ? "MID" : "LOW",
          updatedAt: now,
          series: [
            ...prev.stage3.transitionRisk.series.slice(-11),
            {
              t: now,
              risk2y,
              ciLow: clamp01(risk2y - 0.04),
              ciHigh: clamp01(risk2y + 0.04),
              source: "manual",
              event: "REEVAL",
            },
          ],
        };
      } else if (action === "APPLY_RESULT") {
        nextStatus = "COMPLETED";
        nextPlanStatus = "NEEDS_UPDATE";
        nextPlanUpdatedAt = now;
        const latest = prev.stage3.transitionRisk.series[prev.stage3.transitionRisk.series.length - 1];
        const risk2y = clamp01((latest?.risk2y ?? prev.stage3.transitionRisk.risk2y_now) + 0.04);
        nextTransitionRisk = {
          ...prev.stage3.transitionRisk,
          risk2y_now: risk2y,
          risk2y_label: risk2y >= 0.7 ? "HIGH" : risk2y >= 0.45 ? "MID" : "LOW",
          updatedAt: now,
          series: [
            ...prev.stage3.transitionRisk.series.slice(-11),
            {
              t: now,
              risk2y,
              ciLow: clamp01(risk2y - 0.05),
              ciHigh: clamp01(risk2y + 0.05),
              source: "manual",
              event: "DIFF_RESULT_APPLIED",
            },
          ],
        };
      }

      const nextOpsStatus: Stage3OpsStatus =
        nextPlanStatus === "NEEDS_UPDATE"
          ? "PLAN_NEEDS_UPDATE"
          : nextStatus === "REFERRED" || nextStatus === "SCHEDULED"
            ? "LINKAGE_PENDING"
            : nextReeval === "PENDING"
              ? "REEVAL_PENDING"
              : "TRACKING";

      return {
        ...prev,
        stage3: {
          ...prev.stage3,
          diffPathStatus: nextStatus,
          reevalStatus: nextReeval,
          planUpdatedAt: nextPlanUpdatedAt,
          transitionRisk: nextTransitionRisk,
          headerMeta: {
            ...prev.stage3.headerMeta,
            planStatus: nextPlanStatus,
            nextReevalAt: nextNextReevalAt,
            opsStatus: nextOpsStatus,
          },
        },
        linkageStatus: action === "CREATE_REFER" || action === "SCHEDULE" ? "REFERRAL_CREATED" : prev.linkageStatus,
      };
    });

    if (action === "CREATE_RECO") {
      appendTimeline({
        type: "DIFF_RECO_CREATED",
        at: now,
        by: detail.header.assigneeName,
        summary: isStage2OpsView ? "신경심리검사 진행 제안 생성" : "감별검사/뇌영상 권고 생성",
      });
      appendAuditLog(isStage2OpsView ? "진단검사 경로 제안 생성" : "감별경로 권고 생성");
    } else if (action === "CREATE_REFER") {
      appendTimeline({
        type: "DIFF_REFER_CREATED",
        at: now,
        by: detail.header.assigneeName,
        summary: isStage2OpsView ? "신경심리/임상평가 의뢰서 생성" : "감별경로 의뢰서 생성",
      });
      appendTimeline({
        type: "LINKAGE_CREATED",
        at: now,
        by: detail.header.assigneeName,
        linkageType: "HOSPITAL",
        summary: isStage2OpsView ? "진단검사 의뢰 연계 경로 생성" : "의뢰 연계 경로 생성",
      });
      appendAuditLog(isStage2OpsView ? "진단검사 의뢰 생성" : "감별경로 의뢰 생성");
    } else if (action === "SCHEDULE") {
      const scheduledAt = withHoursFromNow(72);
      appendTimeline({
        type: "DIFF_SCHEDULED",
        at: now,
        by: detail.header.assigneeName,
        summary: isStage2OpsView ? "진단검사 예약 생성" : "감별경로 예약 생성",
      });
      appendTimeline({
        type: "REEVAL_SCHEDULED",
        at: now,
        by: detail.header.assigneeName,
        scheduledAt,
        reason: isStage2OpsView ? "진단검사 예약 생성" : "감별경로 예약 생성",
      });
      appendAuditLog(isStage2OpsView ? "진단검사 예약 생성" : "감별경로 예약 생성");
    } else if (action === "COMPLETE") {
      appendTimeline({
        type: "DIFF_COMPLETED",
        at: now,
        by: detail.header.assigneeName,
        summary: isStage2OpsView ? "진단검사 수행 완료 기록" : "감별경로 완료 기록",
      });
      appendTimeline({
        type: "REEVAL_COMPLETED",
        at: now,
        by: detail.header.assigneeName,
        note: isStage2OpsView ? "진단검사 완료" : "감별경로 완료",
      });
      appendAuditLog(isStage2OpsView ? "진단검사 완료 기록" : "감별경로 완료 기록");
    } else {
      appendTimeline({
        type: "DIFF_RESULT_APPLIED",
        at: now,
        by: detail.header.assigneeName,
        summary: isStage2OpsView ? "진단검사 결과 입력 및 분류 확정 대기" : "감별 결과 입력 및 플랜 업데이트 필요 표시",
      });
      appendAuditLog(isStage2OpsView ? "진단검사 결과 입력" : "감별 결과 입력");
    }

    if (caseRecord?.id && action === "APPLY_RESULT") {
      const resultValue = stage3ResultFromDiffLabel(stage3DiffDraft.resultLabel);
      const now = nowIso();
      updateCaseStage3Evidence(
        caseRecord.id,
        {
          biomarker: stage3DiffDraft.testBiomarker,
          imaging: stage3DiffDraft.testBrainImaging,
          biomarkerResult: stage3DiffDraft.testBiomarker ? resultValue : null,
          imagingResult: stage3DiffDraft.testBrainImaging ? resultValue : null,
          performedAt: now,
        },
        detail.header.assigneeName,
      );

      if (stage3StoredModelAvailable) {
        setStage3ModelRunState((prev) => ({
          ...prev,
          status: "DONE",
          startedAt: prev.startedAt ?? now,
          updatedAt: now,
          completedAt: now,
          progress: 100,
          etaSeconds: 0,
        }));
        appendAuditLog("Stage3 기존 모델 결과를 재사용했습니다.");
      } else {
        setStage3ModelRunState((prev) => ({
          ...prev,
          status: "RUNNING",
          startedAt: now,
          updatedAt: now,
          completedAt: undefined,
          progress: 4,
          etaSeconds: null,
          failureReason: undefined,
        }));
        appendTimeline({
          type: "INFERENCE_REQUESTED",
          stage: 3,
          at: now,
          by: detail.header.assigneeName,
          summary: "Stage3 모델 실행 요청",
        });
        appendTimeline({
          type: "INFERENCE_STARTED",
          stage: 3,
          at: now,
          by: detail.header.assigneeName,
          summary: "Stage3 모델 실행 시작",
        });
        appendAuditLog("Stage3 모델 실행 요청");
      }
    }

    if (caseRecord?.id && action === "SCHEDULE") {
      recordCaseEvent(
        caseRecord.id,
        "STAGE3_DIFF_SCHEDULED",
        {
          scheduledAt: withHoursFromNow(72),
        },
        detail.header.assigneeName,
      );
    }

    toast.success("처리 완료(감사 로그 기록됨)");
  };

  const handleStage3Step2Consultation = useCallback(
    (note: string, type: "CONTACT" | "BOOKING" | "REMINDER", templateLabel: string) => {
      if (!isStage3Mode) return;
      const now = nowIso();
      const trimmed = note.trim();
      setStage3Step2Flow((prev) => ({ ...prev, consultStarted: true, infoCollected: true }));
      if (trimmed.length > 0) {
        setStage3DiffDraft((prev) => ({ ...prev, note: trimmed }));
      }

      appendTimeline({
        type: "CALL_ATTEMPT",
        at: now,
        result: "SUCCESS",
        note: trimmed || `${type} 상담 기록`,
        by: detail.header.assigneeName,
      });
      appendAuditLog(`Stage3 상담 기록: ${templateLabel}${trimmed ? ` (${trimmed.slice(0, 80)})` : ""}`);
    },
    [appendAuditLog, detail.header.assigneeName, isStage3Mode],
  );

  const handleStage3Step2SmsSent = useCallback(
    (item: SmsHistoryItem) => {
      if (!isStage3Mode) return;
      const now = nowIso();
      appendTimeline({
        type: "SMS_SENT",
        at: now,
        templateId: item.templateLabel,
        status: item.status === "SENT" ? "DELIVERED" : item.status === "SCHEDULED" ? "PENDING" : "FAILED",
        by: detail.header.assigneeName,
      });
      appendTimeline({
        type: "MESSAGE_SENT",
        at: now,
        by: detail.header.assigneeName,
        summary: `예약 안내 문자 ${item.mode === "NOW" ? "발송" : "예약"}: ${item.templateLabel}`,
      });
      setStage3Step2Flow((prev) => ({ ...prev, messageSent: item.status !== "FAILED" }));
      appendAuditLog(`Stage3 문자 ${item.mode === "NOW" ? "발송" : "예약"}: ${item.templateLabel} (${item.status})`);
    },
    [appendAuditLog, detail.header.assigneeName, isStage3Mode],
  );

  const runStage3RagAutoFill = useCallback(() => {
    if (!isStage3Mode) return;
    const now = nowIso();
    const sourceText = [stage3DiffDraft.note, callMemo, ragEditedScript, selectedRecommendation?.scriptBody]
      .filter(Boolean)
      .join(" ");
    const confidenceLabel: Stage3RagAutoFill["confidenceLabel"] =
      sourceText.length >= 180 ? "높음" : sourceText.length >= 80 ? "보통" : "낮음";

    const patch: Partial<Stage3DiffDraft> = {
      preferredHospital: stage3DiffDraft.preferredHospital || stage3DiffDraft.orgName || "협력 병원",
      preferredTimeWindow:
        sourceText.includes("오전") || sourceText.includes("아침")
          ? "평일 오전 10:00~12:00"
          : sourceText.includes("주말")
            ? "주말 오전 09:00~11:00"
            : "평일 오후 14:00~16:00",
      caregiverCompanion: sourceText.includes("보호자") || stage3ReviewDraft.caregiverNeeded,
      mobilityIssue: sourceText.includes("이동") || sourceText.includes("교통"),
      testBiomarker: true,
      testBrainImaging: true,
      prepGuide:
        "운영 참고: 신분증/복용약 목록/기존 검사결과 지참, 일정 변경 시 센터에 사전 연락",
      orgName: stage3DiffDraft.orgName || "협력 병원",
      orgPhone: stage3DiffDraft.orgPhone || DEFAULT_CENTER_PHONE,
    };
    const changedFields = Object.keys(patch).filter((key) => {
      const nextValue = (patch as Record<string, unknown>)[key];
      const currentValue = (stage3DiffDraft as Record<string, unknown>)[key];
      return nextValue !== currentValue;
    });
    const reasonSnippets = [
      selectedRecommendation?.title ? `추천 근거: ${selectedRecommendation.title}` : "운영 가이드 기준 자동 제안",
      sourceText.length > 0
        ? `상담 메모 기반 추출: ${sourceText.slice(0, 60)}${sourceText.length > 60 ? "..." : ""}`
        : "상담 메모가 짧아 기본 템플릿 기반으로 채움",
      `담당자 확인 필요 · 신뢰도 ${confidenceLabel}`,
    ];

    setStage3RagAutoFill({
      generatedAt: now,
      confidenceLabel,
      reasonSnippets,
      patch,
      changedFields,
      applied: false,
      ignored: false,
    });
    setStage3Step2Flow((prev) => ({ ...prev, ragGenerated: true }));
    appendAuditLog(`Stage3 RAG 자동기록 제안 생성 (${confidenceLabel})`);
    toast.success("RAG 자동기록 제안이 생성되었습니다. 담당자 확인 후 적용하세요.");
  }, [
    appendAuditLog,
    callMemo,
    isStage3Mode,
    ragEditedScript,
    selectedRecommendation?.scriptBody,
    selectedRecommendation?.title,
    stage3DiffDraft,
    stage3ReviewDraft.caregiverNeeded,
  ]);

  const applyStage3RagAutoFill = useCallback(() => {
    if (!stage3RagAutoFill) return;
    const now = nowIso();
    setStage3DiffDraft((prev) => ({ ...prev, ...stage3RagAutoFill.patch }));
    setStage3RagAutoFill((prev) => (prev ? { ...prev, applied: true, ignored: false } : prev));
    setStage3Step2Flow((prev) => ({ ...prev, infoCollected: true, ragGenerated: true }));
    appendTimeline({
      type: "STAGE3_ACTION_DECISION",
      at: now,
      by: detail.header.assigneeName,
      actionId: "RAG_AUTOFILL",
      decision: "APPROVED",
      note: `자동 채움 적용(${stage3RagAutoFill.changedFields.length}개 필드)`,
    });
    appendAuditLog(`Stage3 RAG 자동기록 적용: ${stage3RagAutoFill.changedFields.join(", ") || "변경 없음"}`);
  }, [appendAuditLog, detail.header.assigneeName, stage3RagAutoFill]);

  const ignoreStage3RagAutoFill = useCallback(() => {
    if (!stage3RagAutoFill) return;
    const now = nowIso();
    setStage3RagAutoFill((prev) => (prev ? { ...prev, ignored: true, applied: false } : prev));
    appendTimeline({
      type: "STAGE3_ACTION_DECISION",
      at: now,
      by: detail.header.assigneeName,
      actionId: "RAG_AUTOFILL",
      decision: "HOLD",
      note: "자동 채움 무시",
    });
    appendAuditLog("Stage3 RAG 자동기록 무시");
  }, [appendAuditLog, detail.header.assigneeName, stage3RagAutoFill]);

  const runStage3BookingBundle = useCallback(() => {
    if (!isStage3Mode) return;
    const stepErrors: Stage3TaskFieldErrors = {};
    if (!callMemo.trim() && !stage3Step2Flow.consultStarted) {
      stepErrors.step2CallRecord = "전화 상담 기록(메모 또는 상담 시작)이 필요합니다.";
    }
    if (!stage3DiffDraft.preferredHospital.trim()) {
      stepErrors.step2Hospital = "연계 기관/병원을 입력하세요.";
    }
    if (!stage3DiffDraft.testBiomarker && !stage3DiffDraft.testBrainImaging && !stage3DiffDraft.testOther) {
      stepErrors.step2TestSelection = "검사 항목을 최소 1개 선택하세요.";
    }
    if (!stage3DiffDraft.bookingAt) {
      stepErrors.step2BookingAt = "예약 일시를 먼저 입력해 주세요.";
    }
    if (Object.keys(stepErrors).length > 0) {
      applyStage3ValidationErrors("CONTACT_EXECUTION", stepErrors);
      toast.error("예약 확정 전에 누락 항목을 확인해 주세요.");
      return;
    }
    setStage3FieldErrorsByStep((prev) => ({ ...prev, CONTACT_EXECUTION: {} }));

    const now = nowIso();
    handleStage3DiffPathAction("SCHEDULE");
    setStage3DiffDraft((prev) => ({ ...prev, bookingConfirmed: true }));
    setStage3Step2Flow((prev) => ({
      ...prev,
      bookingConfirmed: true,
      messageSent: true,
      calendarSynced: true,
    }));
    if (caseRecord?.id) {
      setCaseBookingPending(caseRecord.id, 0, detail.header.assigneeName);
    }

    appendTimeline({
      type: "SMS_SENT",
      at: now,
      templateId: "S3_BOOKING_CONFIRM",
      status: "DELIVERED",
      by: detail.header.assigneeName,
    });
    appendTimeline({
      type: "MESSAGE_SENT",
      at: now,
      by: detail.header.assigneeName,
      summary: `예약 확인 문자 발송 · ${formatDateTime(stage3DiffDraft.bookingAt)}`,
    });
    const calendarKey = `S3-CAL-${Date.now()}`;
    appendTimeline({
      type: "CALENDAR_SYNC",
      at: now,
      status: "SUCCESS",
      eventType: "FOLLOWUP",
      title: `Stage3 감별검사 예약 (${detail.header.caseId})`,
      scheduledAt: stage3DiffDraft.bookingAt,
      idempotencyKey: calendarKey,
      by: detail.header.assigneeName,
    });
    appendTimeline({
      type: "CAL_EVENT_CREATED",
      at: now,
      by: detail.header.assigneeName,
      scheduledAt: stage3DiffDraft.bookingAt,
      summary: `${stage3DiffDraft.preferredHospital || stage3DiffDraft.orgName} · ${formatDateTime(stage3DiffDraft.bookingAt)}`,
    });

    appendAuditLog(
      `Stage3 예약 확정 패키지 실행: ${stage3DiffDraft.preferredHospital || stage3DiffDraft.orgName} · ${formatDateTime(stage3DiffDraft.bookingAt)} · 문자/캘린더 기록 완료`,
    );
    toast.success("예약/문자/캘린더 패키지가 기록되었습니다.");
  }, [
    applyStage3ValidationErrors,
    appendAuditLog,
    caseRecord?.id,
    callMemo,
    detail.header.assigneeName,
    detail.header.caseId,
    handleStage3DiffPathAction,
    isStage3Mode,
    stage3DiffDraft.bookingAt,
    stage3DiffDraft.orgName,
    stage3DiffDraft.preferredHospital,
    stage3DiffDraft.testBiomarker,
    stage3DiffDraft.testBrainImaging,
    stage3DiffDraft.testOther,
    stage3Step2Flow.consultStarted,
  ]);

  const toggleStage3ProgramSelection = (programId: string, forceSelected?: boolean) => {
    if (!isStage3Mode) return;
    const now = nowIso();
    setDetail((prev) => {
      if (!prev.stage3) return prev;
      const nextPrograms = prev.stage3.programs.map((program) => {
        if (program.id !== programId) return program;
        const selected = forceSelected ?? !program.selected;
        return {
          ...program,
          selected,
          execution:
            selected
              ? program.execution ?? {
                  owner: prev.header.assigneeName,
                  dueDate: withHoursFromNow(24 * 3),
                  status: "PLANNED",
                  method: "안내",
                }
              : undefined,
        };
      });
      return {
        ...prev,
        stage3: {
          ...prev.stage3,
          programs: nextPrograms,
        },
      };
    });
    appendTimeline({
      type: "PROGRAM_SELECTED",
      at: now,
      by: detail.header.assigneeName,
      summary: `프로그램 선택 변경: ${programId}`,
    });
    appendAuditLog(`프로그램 선택 변경: ${programId}`);
  };

  const updateStage3ProgramExecution = (programId: string, patch: Partial<Stage3ProgramExecutionField>) => {
    if (!isStage3Mode) return;
    const now = nowIso();
    setDetail((prev) => {
      if (!prev.stage3) return prev;
      const nextPrograms = prev.stage3.programs.map((program) => {
        if (program.id !== programId) return program;
        return {
          ...program,
          selected: true,
          execution: {
            owner: prev.header.assigneeName,
            ...program.execution,
            ...patch,
          },
        };
      });
      return {
        ...prev,
        stage3: {
          ...prev.stage3,
          programs: nextPrograms,
        },
      };
    });
    appendTimeline({
      type: patch.status === "DONE" ? "PROGRAM_EXEC_COMPLETED" : "PROGRAM_EXEC_UPDATED",
      at: now,
      by: detail.header.assigneeName,
      summary: `프로그램 실행 업데이트: ${programId}`,
    });
    appendAuditLog(`프로그램 실행 업데이트: ${programId}`);
    toast.success("프로그램 실행 정보가 기록되었습니다.");
  };

  const toggleStage3ProgramPin = (programId: string) => {
    if (!isStage3Mode) return;
    setDetail((prev) => {
      if (!prev.stage3) return prev;
      return {
        ...prev,
        stage3: {
          ...prev.stage3,
          programs: prev.stage3.programs.map((program) =>
            program.id === programId ? { ...program, pinned: !program.pinned } : program
          ),
        },
      };
    });
  };

  const applyStage3PlanUpdate = () => {
    if (!isStage3Mode) return;
    const now = nowIso();
    setDetail((prev) => {
      if (!prev.stage3) return prev;
      const latest = prev.stage3.transitionRisk.series[prev.stage3.transitionRisk.series.length - 1];
      const risk2y = latest?.risk2y ?? prev.stage3.transitionRisk.risk2y_now;
      return {
        ...prev,
        stage3: {
          ...prev.stage3,
          planUpdatedAt: now,
          transitionRisk: {
            ...prev.stage3.transitionRisk,
            updatedAt: now,
            series: [
              ...prev.stage3.transitionRisk.series.slice(-11),
              {
                t: now,
                risk2y,
                ciLow: latest?.ciLow,
                ciHigh: latest?.ciHigh,
                source: "manual",
                event: "PLAN_UPDATED",
              },
            ],
          },
          headerMeta: {
            ...prev.stage3.headerMeta,
            planStatus: "ACTIVE",
            opsStatus: "TRACKING",
          },
        },
      };
    });
    appendTimeline({ type: "PLAN_UPDATED", at: now, by: detail.header.assigneeName, summary: "정밀관리 플랜 업데이트 기록" });
    appendAuditLog("정밀관리 플랜 업데이트");
    toast.success("플랜 업데이트가 기록되었습니다.");
  };

  const setStage3NextTrackingAt = () => {
    if (!isStage3Mode) return;
    const now = nowIso();
    const nextAt = withHoursFromNow((detail.stage3?.headerMeta.trackingCycleDays ?? 21) * 24);
    setDetail((prev) => {
      if (!prev.stage3) return prev;
      return {
        ...prev,
        stage3: {
          ...prev.stage3,
          headerMeta: {
            ...prev.stage3.headerMeta,
            nextTrackingContactAt: nextAt,
          },
        },
      };
    });
    appendTimeline({
      type: "NEXT_TRACKING_SET",
      at: now,
      by: detail.header.assigneeName,
      nextAt,
      summary: "다음 추적 일정 설정",
    });
    appendAuditLog(`다음 추적 일정 설정: ${formatDateTime(nextAt)}`);
    toast.success("다음 추적 일정이 설정되었습니다.");
  };

  const runStage3PrimaryAction = useCallback(() => {
    if (!isStage3Mode) return;
    if (isStage2OpsView) {
      if (!detail.stage3?.riskReviewedAt) {
        handleStage3RiskReview({ summary: "STEP1 검토 완료" });
        return;
      }
      if (detail.stage3.diffPathStatus === "NONE" || detail.stage3.diffPathStatus === "RECOMMENDED") {
        handleStage3DiffPathAction("SCHEDULE");
        return;
      }
      if (detail.stage3.reevalStatus !== "SCHEDULED" && detail.stage3.reevalStatus !== "COMPLETED") {
        handleStage3ReevalAction("SCHEDULE");
        return;
      }
      setStage3TaskModalStep("FOLLOW_UP");
      return;
    }
    const next = detail.stage3?.recommendedActions.find((action) => action.decision === "PENDING");
    if (next) {
      applyStage3ActionDecision(next.id, "APPROVED");
      return;
    }
    if (!detail.stage3?.riskReviewedAt) {
      handleStage3RiskReview();
      return;
    }
    if (detail.stage3.diffPathStatus === "NONE") {
      handleStage3DiffPathAction("CREATE_RECO");
      return;
    }
    const hasProgramExecution =
      detail.stage3.programs.some(
        (program) =>
          program.selected &&
          (program.execution?.status === "PLANNED" || program.execution?.status === "IN_PROGRESS" || program.execution?.status === "DONE")
      );
    if (!hasProgramExecution) {
      const firstProgram = detail.stage3.programs[0];
      if (firstProgram) {
        toggleStage3ProgramSelection(firstProgram.id, true);
        updateStage3ProgramExecution(firstProgram.id, { status: "PLANNED", method: "안내", dueDate: withHoursFromNow(72) });
        return;
      }
    }
    if (detail.stage3.headerMeta.planStatus === "NEEDS_UPDATE") {
      applyStage3PlanUpdate();
      return;
    }
    setStage3NextTrackingAt();
  }, [
    applyStage3ActionDecision,
    applyStage3PlanUpdate,
    detail.stage3,
    handleStage3DiffPathAction,
    handleStage3RiskReview,
    handleStage3ReevalAction,
    isStage3Mode,
    isStage2OpsView,
    setStage3NextTrackingAt,
    setStage3TaskModalStep,
    toggleStage3ProgramSelection,
    updateStage3ProgramExecution,
  ]);

  const handleContactExecutorChange = (next: ContactExecutor) => {
    if (next === detail.contactExecutor) return;
    const prev = detail.contactExecutor;
    const now = nowIso();
    const shouldOperatorOverrideToHuman = effectiveStrategy === "AI_FIRST" && next === "HUMAN";

    if (shouldOperatorOverrideToHuman) {
      cancelAgentJob({
        actor: "operator",
        summary: "운영자 수동 전환으로 자동 수행을 중지했습니다.",
        detailMessage: "사람 직접 접촉 모드로 전환",
        moveToHuman: true,
      });
    }

    setDetail((prevDetail) => ({
      ...prevDetail,
      contactExecutor: next,
    }));

    appendTimeline({
      type: "STATUS_CHANGE",
      at: now,
      from: CONTACT_EXECUTOR_LABELS[prev],
      to: CONTACT_EXECUTOR_LABELS[next],
      reason: "접촉 주체 전환",
      by: detail.header.assigneeName,
    });
    if (shouldOperatorOverrideToHuman) {
      appendTimeline({
        type: "OPERATOR_OVERRIDE_TO_HUMAN",
        at: now,
        actor: "operator",
        caseId: detail.header.caseId,
        summary: "운영자 수동 전환",
        detail: "자동안내 우선 기준에서 사람 직접 접촉으로 전환",
        by: detail.header.assigneeName,
      });
      appendAuditLog("운영자 수동 전환: 사람 직접 접촉 모드로 전환");
    }
    appendAuditLog(`접촉 주체 전환: ${CONTACT_EXECUTOR_LABELS[prev]} → ${CONTACT_EXECUTOR_LABELS[next]}`);
    toast.success("접촉 주체가 업데이트되었습니다.");
  };

  const handleApplyRagRecommendation = (recommendation: RagRecommendation) => {
    setSelectedRagId(recommendation.id);
    setRagEditedScript(recommendation.scriptBody);
  };

  const handleSaveFollowUpDecision = () => {
    const routeMeta = FOLLOW_UP_ROUTE_META[followUpDecisionDraft.route];
    const stage2Decision =
      mode === "stage1"
        ? followUpDecisionDraft.stage2Decision === "MOVE_STAGE2"
          ? "MOVE_STAGE2"
          : "KEEP_STAGE1"
        : null;

    if (followUpDecisionDraft.route !== "HOLD_TRACKING" && !followUpDecisionDraft.scheduledAt) {
      toast.error("연계/예약 일정은 필수입니다.");
      return false;
    }

    const reservation: ReservationInfo | undefined =
      followUpDecisionDraft.route === "HOLD_TRACKING"
        ? undefined
        : {
            route: followUpDecisionDraft.route,
            reservationType: routeMeta.reservationType,
            scheduledAt: followUpDecisionDraft.scheduledAt,
            place: followUpDecisionDraft.place || routeMeta.defaultPlace,
            contactGuide: followUpDecisionDraft.contactGuide || DEFAULT_CENTER_PHONE,
            note: followUpDecisionDraft.note || undefined,
          };

    const beforeStatus = detail.linkageStatus;
    const afterStatus = routeMeta.linkageStatus;

    setDetail((prev) => ({
      ...prev,
      linkageStatus: afterStatus,
      reservationInfo: reservation,
      reservation:
        reservation == null
          ? {
              source: prev.reservation?.source ?? "MANUAL",
              status: "NONE",
            }
          : {
              source: "MANUAL",
              status: "RESERVED",
              programType: routeMeta.reservationType,
              programName: routeMeta.label,
              scheduledAt: reservation.scheduledAt,
              locationName: reservation.place,
              createdAt: prev.reservation?.createdAt ?? nowIso(),
              updatedAt: nowIso(),
              createdBy: "STAFF",
              reservationId: prev.reservation?.reservationId,
              options: prev.reservation?.options,
            },
      contactFlowSteps: buildContactFlowSteps(prev.contactExecution, prev.preTriageResult, afterStatus, mode),
    }));
    if (reservation?.scheduledAt) {
      setRecontactDueAt(reservation.scheduledAt);
    }

    appendTimeline({
      type: "STATUS_CHANGE",
      at: nowIso(),
      from: LINKAGE_STATUS_HINT[beforeStatus],
      to: LINKAGE_STATUS_HINT[afterStatus],
      reason: `${routeMeta.label} 선택`,
      by: detail.header.assigneeName,
    });

    if (resolvedCaseId && mode === "stage1") {
      const stage2Route: Stage2Route = followUpDecisionDraft.route === "HOSPITAL_REFERRAL_BOOKING" ? "HOSPITAL" : "CENTER";
      setCaseStage1NextStep(resolvedCaseId, stage2Decision ?? "KEEP_STAGE1", {
        route: stage2Route,
      });

      const decisionLabel = stage2Decision === "MOVE_STAGE2" ? "Stage2 전환" : "Stage1 유지";
      appendTimeline({
        type: "STATUS_CHANGE",
        at: nowIso(),
        from: "Stage 1",
        to: stage2Decision === "MOVE_STAGE2" ? "Stage 2" : "Stage 1",
        reason: `후속 단계 결정 (${decisionLabel})`,
        by: detail.header.assigneeName,
      });
      appendAuditLog(`후속 결정 저장: ${routeMeta.label} · ${decisionLabel}`);
      toast.success(
        stage2Decision === "MOVE_STAGE2"
          ? "후속 결정이 저장되어 Stage2 전환이 반영되었습니다."
          : "후속 결정이 저장되었습니다.",
      );
      return true;
    }

    appendAuditLog(`후속 결정 저장: ${routeMeta.label}`);
    toast.success("후속 결정이 저장되었습니다.");
    return true;
  };

  const confirmReasonAction = () => {
    if (!reasonModal || !reasonModal.reason.trim()) return;

    if (reasonModal.mode === "LEVEL") {
      const nextLevel = reasonModal.nextLevel;
      const prevLevel = detail.interventionLevel;
      const qualityLevel = detail.header.dataQuality.level;

      setDetail((prev) => ({ ...prev, interventionLevel: nextLevel }));
      regenerateTodos(nextLevel, qualityLevel);

      appendTimeline({
        type: "LEVEL_CHANGE",
        at: nowIso(),
        from: prevLevel,
        to: nextLevel,
        reason: reasonModal.reason,
        by: detail.header.assigneeName,
      });
      appendAuditLog(`개입 레벨 변경: ${prevLevel} → ${nextLevel} (${reasonModal.reason})`);
      toast.success("처리 완료(로그 기록됨)");
      setReasonModal(null);
      return;
    }

    const from = detail.header.statusLabel;
    const to = reasonModal.nextStatus;

    setDetail((prev) => {
      const nextQuality =
        to === "우선순위 제외"
          ? {
              level: "EXCLUDE" as DataQualityLevel,
              score: Math.min(prev.header.dataQuality.score, 60),
              notes: ["우선순위 제외 상태", "데이터 보강 후 재개 가능"],
            }
          : prev.header.dataQuality;

      return {
        ...prev,
        header: {
          ...prev.header,
          statusLabel: to,
          dataQuality: nextQuality,
        },
        todos: to === "우선순위 제외" ? buildTodos(prev.interventionLevel, "EXCLUDE") : prev.todos,
      };
    });

    appendTimeline({
      type: "STATUS_CHANGE",
      at: nowIso(),
      from,
      to,
      reason: reasonModal.reason,
      by: detail.header.assigneeName,
    });
    appendAuditLog(`상태 변경: ${from} → ${to} (${reasonModal.reason})`);
    toast.success("처리 완료(로그 기록됨)");
    setReasonModal(null);
  };

  const handleCallStart = () => {
    if (callDisabledReason) return;
    setCallActive(true);
    setCallSeconds(0);
    appendAuditLog(`전화 연결 시작 (${callTarget === "citizen" ? "본인" : "보호자"})`);
  };

  const handleCallStop = () => {
    setCallActive(false);
    setOutcomeModal({
      mode: "CALL",
      title: "통화 결과 기록",
      result: callResultDraft,
      note: callMemo,
      durationSec: callSeconds,
    });
  };

  const handleSmsDispatchPrepare = () => {
    if (smsDisabledReason) return;
    setOutcomeModal({
      mode: "SMS",
      title: smsScheduleType === "NOW" ? "문자 발송 결과 기록" : "문자 예약 결과 기록",
      result: smsScheduleType === "NOW" ? "DELIVERED" : "PENDING",
      note: "",
      scheduled: smsScheduleType === "SCHEDULE",
    });
  };

  const confirmOutcome = async () => {
    if (!outcomeModal) return;
    setSavingOutcome(true);

    if (outcomeModal.mode === "CALL") {
      const at = nowIso();
      const result = outcomeModal.result;
      const note = outcomeModal.note.trim();

      appendTimeline({
        type: "CALL_ATTEMPT",
        at,
        result,
        note: note || undefined,
        by: detail.header.assigneeName,
      });

      appendAuditLog(`통화 결과 기록: ${callResultLabel(result)}${note ? ` (${note})` : ""}`);

      setDetail((prev) => ({
        ...prev,
        header: {
          ...prev.header,
          waitDays: result === "SUCCESS" ? 0 : prev.header.waitDays + 1,
          statusLabel: result === "SUCCESS" ? "진행중" : prev.header.statusLabel,
        },
      }));

      if (result === "SUCCESS") {
        completeSuggestedTodo("CALL");
        setRecontactDueAt(withHoursFromNow(72));
      } else if (result === "NO_ANSWER") {
        setRecontactDueAt(withHoursFromNow(6));
      } else {
        setRecontactDueAt(withHoursFromNow(24));
      }

      setCallMemo("");
      setCallSeconds(0);
      setSavingOutcome(false);
      setOutcomeModal(null);
      toast.success("처리 완료(로그 기록됨)");
      return;
    }

    const smsResult = outcomeModal.result;
    const message = smsPreview;
    const targets: Array<{ key: SmsTarget; label: string; phone?: string }> = [
      { key: "citizen", label: "본인", phone: caseRecord?.profile.phone },
      { key: "guardian", label: "보호자", phone: caseRecord?.profile.guardianPhone },
    ].filter((entry) => smsTargets[entry.key]);

    const timelineAt = outcomeModal.scheduled && smsScheduledAt ? new Date(smsScheduledAt).toISOString() : nowIso();
    let deliveredCount = 0;
    let failedCount = 0;

    for (const target of targets) {
      let finalStatus: SmsDispatchStatus = smsResult;

      if (!outcomeModal.scheduled && target.phone && smsResult !== "FAILED") {
        const smsStage = isStage2Mode ? "STAGE2" : isStage3Mode ? "STAGE3" : "STAGE1";
        const result = await sendSmsApiCommon({
          caseId: detail.header.caseId,
          citizenPhone: target.phone,
          templateId: smsTemplateId,
          renderedMessage: message,
          dedupeKey: `${detail.header.caseId}-${smsTemplateId}-${target.label}-${Date.now()}`,
          stage: smsStage,
        });
        if (!result.success) {
          finalStatus = "FAILED";
        }
      }

      if (finalStatus === "DELIVERED" || finalStatus === "PENDING") {
        deliveredCount += 1;
      }
      if (finalStatus === "FAILED") {
        failedCount += 1;
      }

      appendTimeline({
        type: "SMS_SENT",
        at: timelineAt,
        templateId: `${smsTemplateId}(${target.label})`,
        status: finalStatus,
        by: detail.header.assigneeName,
      });
    }

    appendAuditLog(
      `문자 ${outcomeModal.scheduled ? "예약" : "발송"}: ${smsTemplate.label} (${targets.length}건, 완료/예약 ${deliveredCount}, 실패 ${failedCount})`
    );

    if (deliveredCount > 0) {
      completeSuggestedTodo("SMS");
      setRecontactDueAt(withHoursFromNow(48));
    }

    setSavingOutcome(false);
    setOutcomeModal(null);
    toast.success("처리 완료(로그 기록됨)");
  };

  const callDurationText = `${String(Math.floor(callSeconds / 60)).padStart(2, "0")}:${String(callSeconds % 60).padStart(2, "0")}`;

  /* ── 접촉 전략 Override 처리 ── */
  const confirmStrategyOverride = () => {
    if (!strategyOverrideReason.trim()) return;
    const prev = detail.header.effectiveStrategy ?? detail.preTriageResult?.strategy ?? "AI_FIRST";
    const next = strategyOverrideTarget;
    const isVulnerableCase = hasVulnerableTrigger(detail.preTriageResult?.triggers ?? []);

    if (next === "AI_FIRST" && isVulnerableCase && strategyOverrideReason.trim().length < 12) {
      toast.error("취약군 케이스의 자동 안내 우선 전환은 상세 사유를 12자 이상 입력해야 합니다.");
      return;
    }

    setDetail((prev_) => {
      const newPreTriage: PreTriageResult = {
        strategy: next,
        triggers: [...(prev_.preTriageResult?.triggers ?? []), `수동 전환: ${strategyOverrideReason}`],
        policyNote: `담당자 수동 전환 적용 (${STRATEGY_LABELS[next]}). 사유: ${strategyOverrideReason}`,
        confidence: "RULE",
      };
      return {
        ...prev_,
        header: {
          ...prev_.header,
          contactStrategy: "MANUAL_OVERRIDE",
          effectiveStrategy: next,
        },
        contactExecutor: next === "AI_FIRST" ? "AGENT_SEND_ONLY" : "HUMAN",
        preTriageResult: newPreTriage,
        contactPlan: buildContactPlan(next, caseRecord, mode),
        contactFlowSteps: buildContactFlowSteps(prev_.contactExecution, newPreTriage, prev_.linkageStatus, mode),
      };
    });
    if (caseRecord?.id) {
      setCaseContactMode(caseRecord.id, next === "AI_FIRST" ? "AGENT" : "HUMAN", detail.header.assigneeName);
    }

    appendTimeline({
      type: "STRATEGY_CHANGE",
      at: nowIso(),
      from: prev,
      to: next,
      reason: strategyOverrideReason,
      by: detail.header.assigneeName,
    });
    appendTimeline({
      type: "CONTACT_STRATEGY_CHANGED",
      at: nowIso(),
      actor: "operator",
      caseId: detail.header.caseId,
      summary: `접촉 전략 변경: ${STRATEGY_LABELS[prev]} → ${STRATEGY_LABELS[next]}`,
      detail: strategyOverrideReason,
      by: detail.header.assigneeName,
    });
    if (next === "HUMAN_FIRST") {
      cancelAgentJob({
        actor: "operator",
        summary: "전략 수동 변경으로 자동 수행을 중지했습니다.",
        detailMessage: strategyOverrideReason,
        moveToHuman: true,
      });
    }
    appendAuditLog(`접촉 전략 수동 전환: ${STRATEGY_LABELS[prev]} → ${STRATEGY_LABELS[next]} (${strategyOverrideReason})`);
    toast.success("접촉 전략이 전환되었습니다.");
    setStrategyOverrideOpen(false);
    setStrategyOverrideReason("");
  };

  const markResponseDraftDirty = useCallback(() => {
    setResponseDraftDirty(true);
    responseManualEditedRef.current = true;
    if (responseValidationError) {
      setResponseValidationError(null);
    }
    clearSubmitError();
  }, [clearSubmitError, responseValidationError]);

  const handleSelectOutcomeCode = useCallback(
    (code: OutcomeCode | null) => {
      if (
        code &&
        autoFilledOutcomeState &&
        code !== autoFilledOutcomeState.outcome &&
        !autoFilledOutcomeState.manualOverriddenAt
      ) {
        const overriddenAt = nowIso();
        appendAuditLog(
          `응답 결과 수동 덮어쓰기: ${OUTCOME_LABELS[autoFilledOutcomeState.outcome].label} → ${OUTCOME_LABELS[code].label}`,
        );
        appendTimeline({
          type: "MESSAGE_SENT",
          at: overriddenAt,
          summary: `STAGE1_MANUAL_EDIT_APPLIED · ${OUTCOME_LABELS[autoFilledOutcomeState.outcome].label} → ${OUTCOME_LABELS[code].label}`,
          by: detail.header.assigneeName,
        });
        setAutoFilledOutcomeState((prev) =>
          prev
            ? {
                ...prev,
                manualOverriddenAt: overriddenAt,
              }
            : prev,
        );
      }
      markResponseDraftDirty();
      setSelectedOutcomeCode(code);
    },
    [appendAuditLog, appendTimeline, autoFilledOutcomeState, detail.header.assigneeName, markResponseDraftDirty],
  );

  const handleOutcomeNoteChange = useCallback(
    (note: string) => {
      markResponseDraftDirty();
      setOutcomeNote(note);
    },
    [markResponseDraftDirty],
  );

  const handleRejectReasonDraftChange = useCallback(
    (next: RejectReasonDraft) => {
      markResponseDraftDirty();
      setRejectReasonDraft(next);
    },
    [markResponseDraftDirty],
  );

  const handleNoResponsePlanDraftChange = useCallback(
    (next: NoResponsePlanDraft) => {
      markResponseDraftDirty();
      setNoResponsePlanDraft(next);
    },
    [markResponseDraftDirty],
  );

  const handleToggleResponseReasonTag = useCallback(
    (tag: ResponseReasonTag) => {
      markResponseDraftDirty();
      setResponseReasonTags((prev) => (prev.includes(tag) ? prev.filter((item) => item !== tag) : [...prev, tag]));
    },
    [markResponseDraftDirty],
  );

  const resetResponseTriageDraft = useCallback(() => {
    const shouldRecommendL3 =
      detail.header.sla.level !== "OK" || detail.contactExecution.retryCount >= 2 || computePriorityValue(caseRecord) >= 85;
    setSelectedOutcomeCode(null);
    setOutcomeNote("");
    setRejectReasonDraft({
      code: null,
      level: "TEMP",
      detail: "",
      createFollowupEvent: false,
      followupAt: withHoursFromNow(168),
    });
    setNoResponsePlanDraft({
      strategy: null,
      channel: "CALL",
      assigneeId: detail.header.assigneeName || STAGE1_PANEL_OPERATOR,
      nextContactAt: withHoursFromNow(24),
      applyL3: shouldRecommendL3,
    });
    setResponseReasonTags([]);
    setResponseValidationError(null);
    clearSubmitError();
    setResponseDraftDirty(false);
    setAutoFilledOutcomeState(null);
    responseManualEditedRef.current = false;
  }, [caseRecord, clearSubmitError, detail.contactExecution.retryCount, detail.header.assigneeName, detail.header.sla.level]);

  const persistOutcomeTriage = async ({
    code,
    note,
    reject,
    noResponse,
    reasonTags = [],
  }: {
    code: OutcomeCode;
    note: string;
    reject?: RejectReasonDraft;
    noResponse?: NoResponsePlanDraft;
    reasonTags?: ResponseReasonTag[];
  }) => {
    const normalizedNote = note.trim();
    const nextContactAt = noResponse?.nextContactAt;

    const payload: OutcomeSavePayload = {
      outcomeType: OUTCOME_TO_API_TYPE[code],
      memo: normalizedNote || undefined,
      reasonTags: reasonTags.length > 0 ? reasonTags : undefined,
    };

    if (code === "REFUSE" && reject?.code) {
      payload.reject = {
        code: reject.code,
        level: reject.level,
        detail: reject.detail.trim() || undefined,
        followup: {
          createFollowupEvent: reject.createFollowupEvent,
          followupAt: reject.createFollowupEvent ? reject.followupAt : undefined,
        },
      };
    }

    if (code === "NO_RESPONSE" && noResponse?.strategy && nextContactAt) {
      payload.noResponse = {
        strategy: noResponse.strategy,
        nextContactAt,
        escalateLevel: noResponse.applyL3 ? "L3" : undefined,
        channel: noResponse.channel,
        assigneeId: noResponse.assigneeId || undefined,
      };
    }

    const submitResult = await submitOutcomeWithCalendar({
      caseId: detail.header.caseId,
      payload,
    });
    if (!submitResult) {
      toast.error("응답 결과 저장에 실패했습니다. 다시 시도해 주세요.");
      return false;
    }

    const now = nowIso();
    let autoMemo: HandoffMemo | null = null;
    let recommendedNextAction = "";
    let switchedToHybrid = false;

    setDetail((prev) => {
      const transition = deriveOutcomeTransition({
        outcomeCode: code,
        execution: prev.contactExecution,
        linkageStatus: prev.linkageStatus,
        contactPlan: prev.contactPlan,
      });

      recommendedNextAction = transition.recommendedNextAction;
      switchedToHybrid = transition.switchedToHybrid;

      let nextPlan = transition.contactPlan;
      if (nextPlan && code === "SCHEDULE_LATER") {
        nextPlan = { ...nextPlan, scheduledAt: withHoursFromNow(transition.recontactAfterHours) };
      }
      if (nextPlan && code === "NO_RESPONSE" && nextContactAt) {
        nextPlan = { ...nextPlan, scheduledAt: nextContactAt };
      }

      if (transition.requiresHandoffMemo) {
        autoMemo = {
          triggers: prev.preTriageResult?.triggers ?? [],
          lastContactSummary: `최근 접촉: ${formatDateTime(prev.contactExecution.lastSentAt ?? now)}`,
          currentOutcome: code,
          recommendedNextAction,
          generatedAt: now,
        };
      }

      const newExec: ContactExecution = {
        ...prev.contactExecution,
        status: transition.executionStatus,
        lastOutcomeCode: code,
        lastResponseAt: now,
        retryCount: transition.retryCount,
        handoffMemo: autoMemo ?? prev.contactExecution.handoffMemo,
      };
      return {
        ...prev,
        linkageStatus: transition.linkageStatus,
        contactPlan: nextPlan,
        contactExecution: newExec,
        contactFlowSteps: buildContactFlowSteps(newExec, prev.preTriageResult, transition.linkageStatus, mode),
      };
    });

    appendTimeline({
      type: "OUTCOME_RECORDED",
      at: now,
      outcomeCode: code,
      reasonTags: reasonTags.length > 0 ? reasonTags : undefined,
      note: normalizedNote || undefined,
      rejectCode: payload.reject?.code,
      rejectLevel: payload.reject?.level,
      recontactStrategy: payload.noResponse?.strategy,
      nextContactAt: payload.noResponse?.nextContactAt ?? payload.reject?.followup?.followupAt,
      outcomeId: submitResult.outcome.outcomeId,
      by: detail.header.assigneeName,
    });
    const reasonTagText =
      reasonTags.length > 0
        ? ` · 보조사유: ${reasonTags.map((tag) => RESPONSE_REASON_TAG_META[tag].label).join(", ")}`
        : "";
    appendAuditLog(`응답 결과 기록: ${OUTCOME_LABELS[code].label}${reasonTagText}${normalizedNote ? ` (${normalizedNote.slice(0, 60)})` : ""}`);
    appendTimeline({
      type: "MESSAGE_SENT",
      at: now,
      summary: `${isStage2Mode ? "STAGE2_RESPONSE_RECORDED" : "STAGE1_RESPONSE_RECORDED"} · ${OUTCOME_LABELS[code].label}`,
      by: detail.header.assigneeName,
    });

    const linkedEventAt =
      submitResult.outcome.nextAction?.events?.[0]?.startAt ??
      payload.noResponse?.nextContactAt ??
      payload.reject?.followup?.followupAt;
    const fallbackDelay = code === "SCHEDULE_LATER" ? 72 : code === "NO_RESPONSE" ? 24 : code === "REFUSE" ? 168 : 48;
    setRecontactDueAt(linkedEventAt ?? withHoursFromNow(fallbackDelay));

    if (switchedToHybrid) {
      appendAuditLog("반복 무응답으로 채널 전환 권고 적용: HYBRID");
    }

    if (payload.noResponse?.escalateLevel === "L3" && detail.interventionLevel !== "L3") {
      const fromLevel = detail.interventionLevel;
      setDetail((prev) => ({ ...prev, interventionLevel: "L3" }));
      regenerateTodos("L3", detail.header.dataQuality.level);
      appendTimeline({
        type: "LEVEL_CHANGE",
        at: now,
        from: fromLevel,
        to: "L3",
        reason: "무응답 정책 권고에 따라 개입 레벨 상향 적용",
        by: detail.header.assigneeName,
      });
      appendAuditLog(`개입 레벨 변경: ${fromLevel} → L3 (무응답 정책 권고 반영)`);
    }

    submitResult.calendar.created.forEach((created) => {
      appendTimeline({
        type: "CALENDAR_SYNC",
        at: nowIso(),
        status: "SUCCESS",
        eventType: created.event.type,
        title: created.event.title,
        scheduledAt: created.event.startAt,
        idempotencyKey: created.idempotencyKey,
        by: detail.header.assigneeName,
      });
    });

    submitResult.calendar.failed.forEach((failed) => {
      appendTimeline({
        type: "CALENDAR_SYNC",
        at: nowIso(),
        status: "FAILED",
        eventType: failed.eventType,
        title: failed.title,
        scheduledAt: failed.scheduledAt,
        idempotencyKey: failed.idempotencyKey,
        error: failed.errorMessage,
        by: detail.header.assigneeName,
      });
    });

    if (submitResult.calendar.failed.length > 0) {
      appendAuditLog(`캘린더 등록 실패: ${submitResult.calendar.failed.length}건 (재시도 필요)`);
      toast.error("응답 결과는 저장되었지만 캘린더 등록이 일부 실패했습니다. 재시도를 눌러주세요.");
    } else if (submitResult.calendar.created.length > 0) {
      appendAuditLog(`캘린더 등록 완료: ${submitResult.calendar.created.length}건`);
      toast.success("캘린더에 재접촉 일정이 등록되었습니다.");
    } else {
      toast.success("응답 결과가 기록되었습니다.");
    }

    if (autoMemo) {
      setHandoffMemoText(
        `[인수인계 메모]\n접촉 전략(룰 기반): ${(detail.header.effectiveStrategy ?? detail.preTriageResult?.strategy ?? "AI_FIRST")}\n트리거: ${autoMemo.triggers.join(", ")}\n${autoMemo.lastContactSummary}\n현재 결과: ${OUTCOME_LABELS[code].label}\n권장 다음 행동: ${autoMemo.recommendedNextAction}`
      );
      setHandoffMemoOpen(true);
    }

    if (!isStage3Mode && activeStage1Modal === "RESPONSE_HANDLING") {
      setActiveStage1Modal("FOLLOW_UP");
      setHandoffMemoOpen(true);
    } else {
      setActiveStage1Modal(null);
    }
    resetResponseTriageDraft();
    setResponseLastSavedAt(now);
    responseManualEditedRef.current = false;
    return true;
  };

  /* ── Outcome Triage 기록 ── */
  const confirmOutcomeTriage = async () => {
    if (isOutcomeSaving) return;
    if (!selectedOutcomeCode) {
      const message = "결과 유형을 선택하세요.";
      setResponseValidationError(message);
      toast.error(message);
      return;
    }
    if (selectedOutcomeCode === "REFUSE") {
      if (!rejectReasonDraft.code) {
        const message = "거부 코드를 선택해야 저장할 수 있습니다.";
        setResponseValidationError(message);
        toast.error(message);
        return;
      }
      if (rejectReasonDraft.code === "R7_OTHER" && !rejectReasonDraft.detail.trim()) {
        const message = "기타 사유를 입력해야 저장할 수 있습니다.";
        setResponseValidationError(message);
        toast.error(message);
        return;
      }
      if (rejectReasonDraft.createFollowupEvent && !rejectReasonDraft.followupAt) {
        const message = "후속 일정을 지정해 주세요.";
        setResponseValidationError(message);
        toast.error(message);
        return;
      }
      setResponseValidationError(null);
      await persistOutcomeTriage({
        code: "REFUSE",
        note: outcomeNote,
        reject: rejectReasonDraft,
        reasonTags: responseReasonTags,
      });
      return;
    }
    if (selectedOutcomeCode === "NO_RESPONSE") {
      const noResponseStrategy = noResponsePlanDraft.strategy ?? NO_RESPONSE_CHANNEL_STRATEGY[noResponsePlanDraft.channel];
      if (!noResponseStrategy) {
        const message = "무응답 처리 시 다음 접촉 채널을 선택해야 합니다.";
        setResponseValidationError(message);
        toast.error(message);
        return;
      }
      if (!noResponsePlanDraft.nextContactAt) {
        const message = "무응답 처리 시 다음 접촉 일시를 지정해야 합니다.";
        setResponseValidationError(message);
        toast.error(message);
        return;
      }
      if (!noResponsePlanDraft.assigneeId.trim()) {
        const message = "무응답 처리 담당자를 지정해야 저장할 수 있습니다.";
        setResponseValidationError(message);
        toast.error(message);
        return;
      }
      setResponseValidationError(null);
      await persistOutcomeTriage({
        code: "NO_RESPONSE",
        note: outcomeNote,
        noResponse: {
          ...noResponsePlanDraft,
          strategy: noResponseStrategy,
        },
        reasonTags: responseReasonTags,
      });
      return;
    }
    setResponseValidationError(null);
    await persistOutcomeTriage({
      code: selectedOutcomeCode,
      note: outcomeNote,
      reasonTags: responseReasonTags,
    });
  };

  const modelPriorityValue = useMemo(() => computePriorityValue(caseRecord), [caseRecord]);
  const modelPriorityMeta = useMemo(() => priorityIndicator(modelPriorityValue), [modelPriorityValue]);
  const contactPriority = useMemo(() => getStage1ContactPriority(caseRecord), [caseRecord]);
  const effectiveStrategy = detail.header.effectiveStrategy ?? detail.preTriageResult?.strategy ?? "AI_FIRST";
  const strategyBadge = detail.header.contactStrategy ?? effectiveStrategy;
  const missingCount = detail.contactFlowSteps.filter((step) => step.status === "MISSING").length;
  const warningCount = detail.contactFlowSteps.filter((step) => step.status === "WARNING").length;
  const preTriageReady = Boolean(detail.preTriageInput) && detail.header.dataQuality.level !== "EXCLUDE";
  const stage2InferenceState = useMemo(
    () =>
      computeInferenceState({
        caseId: detail.header.caseId,
        stage: 2,
        jobStatus: stage2ModelRunState.status,
        progress: stage2ModelRunState.progress,
        etaSeconds: stage2ModelRunState.etaSeconds,
        startedAt: stage2ModelRunState.startedAt,
        updatedAt: stage2ModelRunState.updatedAt,
        completedAt: stage2ModelRunState.completedAt,
        hasResult:
          stage2ModelRunState.status === "DONE" ||
          (stage2StoredModelAvailable && stage2ModelRunState.status !== "RUNNING"),
        minDurationSec: stage2ModelRunState.minDurationSec,
        maxDurationSec: stage2ModelRunState.maxDurationSec,
        nowMs: nowTick,
      }),
    [
      detail.header.caseId,
      nowTick,
      stage2ModelRunState.completedAt,
      stage2ModelRunState.etaSeconds,
      stage2ModelRunState.maxDurationSec,
      stage2ModelRunState.minDurationSec,
      stage2ModelRunState.progress,
      stage2ModelRunState.startedAt,
      stage2ModelRunState.status,
      stage2ModelRunState.updatedAt,
      stage2StoredModelAvailable,
    ],
  );
  const stage3InferenceState = useMemo(
    () =>
      computeInferenceState({
        caseId: detail.header.caseId,
        stage: 3,
        jobStatus: stage3ModelRunState.status,
        progress: stage3ModelRunState.progress,
        etaSeconds: stage3ModelRunState.etaSeconds,
        startedAt: stage3ModelRunState.startedAt,
        updatedAt: stage3ModelRunState.updatedAt,
        completedAt: stage3ModelRunState.completedAt,
        hasResult:
          stage3ModelRunState.status === "DONE" ||
          (stage3StoredModelAvailable && stage3ModelRunState.status !== "RUNNING"),
        minDurationSec: stage3ModelRunState.minDurationSec,
        maxDurationSec: stage3ModelRunState.maxDurationSec,
        nowMs: nowTick,
      }),
    [
      detail.header.caseId,
      nowTick,
      stage3ModelRunState.completedAt,
      stage3ModelRunState.etaSeconds,
      stage3ModelRunState.maxDurationSec,
      stage3ModelRunState.minDurationSec,
      stage3ModelRunState.progress,
      stage3ModelRunState.startedAt,
      stage3ModelRunState.status,
      stage3ModelRunState.updatedAt,
      stage3StoredModelAvailable,
    ],
  );
  const stage2ModelAvailable = stage2InferenceState.jobStatus === "DONE";
  const stage3ModelAvailable = stage3InferenceState.jobStatus === "DONE";
  const stage3ResultEvidenceReadyForOps = Boolean(
    stage3Evidence?.completed ||
      (stage3DiffDraft.resultPerformedAt &&
        stage3DiffDraft.resultSummary.trim() &&
        stage3DiffDraft.biomarkerResultText?.trim() &&
        stage3DiffDraft.imagingResultText?.trim()),
  );
  const stage2ConfirmedByState = Boolean(
    stage2ConfirmedAt ||
      ssotCase?.status === "CLASS_CONFIRMED" ||
      ssotCase?.status === "NEXT_STEP_SET" ||
      ssotCase?.operationStep === "CLASSIFIED" ||
      ssotCase?.operationStep === "FOLLOW_UP" ||
      ssotCase?.operationStep === "COMPLETED" ||
      ssotCase?.stage === 3,
  );
  const stage2EffectiveTests = useMemo<Stage2Diagnosis["tests"]>(() => {
    const required = stage2Evidence?.required;
    const mmseFromEvidence = typeof required?.mmse === "number" && Number.isFinite(required.mmse) ? required.mmse : undefined;
    const cdrFromEvidence =
      typeof required?.cdrOrGds === "number" && Number.isFinite(required.cdrOrGds) ? required.cdrOrGds : undefined;
    return {
      specialist: Boolean(stage2Diagnosis.tests.specialist || required?.specialist || stage2ConfirmedByState),
      mmse:
        typeof stage2Diagnosis.tests.mmse === "number" && Number.isFinite(stage2Diagnosis.tests.mmse)
          ? stage2Diagnosis.tests.mmse
          : mmseFromEvidence,
      cdr:
        typeof stage2Diagnosis.tests.cdr === "number" && Number.isFinite(stage2Diagnosis.tests.cdr)
          ? stage2Diagnosis.tests.cdr
          : cdrFromEvidence,
      neuroCognitiveType: stage2Diagnosis.tests.neuroCognitiveType ?? required?.neuroType ?? undefined,
    };
  }, [stage2ConfirmedByState, stage2Diagnosis.tests, stage2Evidence?.required]);
  const loopEvents = useMemo(() => mapTimelineToEvents(detail.timeline), [detail.timeline]);
  const opsLoopState = useMemo(() => {
    if (isStage2OpsView) {
      return computeOpsLoopState(loopEvents, {
        stage: "stage2",
        storedOpsStatus: detail.stage3?.headerMeta.opsStatus,
        hasPlanConfirmed: stage2CaseWaitingForKickoff ? false : Boolean(detail.stage3?.riskReviewedAt),
        hasResultReceived: stage2CaseWaitingForKickoff
          ? false
          : Boolean(
              stage2ModelAvailable ||
                stage2IntegrationState.receivedAt ||
                stage2Evidence?.updatedAt ||
                stage2Diagnosis.status !== "NOT_STARTED",
            ),
        hasResultValidated: stage2CaseWaitingForKickoff
          ? false
          : Boolean(stage2ModelAvailable || stage2Evidence?.completed || stage2Diagnosis.status === "COMPLETED"),
        hasModelResult: stage2CaseWaitingForKickoff ? false : stage2ModelAvailable,
        inferenceStatus: stage2InferenceState.jobStatus,
        classificationConfirmed: stage2CaseWaitingForKickoff ? false : stage2ConfirmedByState,
        nextStepDecided: stage2CaseWaitingForKickoff ? false : Boolean(stage2Diagnosis.nextStep),
      });
    }

    if (mode === "stage2") {
      return computeOpsLoopState(loopEvents, {
        stage: "stage2",
        hasPlanConfirmed: stage2CaseWaitingForKickoff ? false : preTriageReady && Boolean(detail.preTriageResult?.strategy),
        hasResultReceived: stage2CaseWaitingForKickoff
          ? false
          : Boolean(
              stage2ModelAvailable ||
                stage2IntegrationState.receivedAt ||
                stage2Evidence?.updatedAt ||
                stage2Diagnosis.status !== "NOT_STARTED",
            ),
        hasResultValidated: stage2CaseWaitingForKickoff
          ? false
          : Boolean(stage2ModelAvailable || stage2Evidence?.completed || stage2Diagnosis.status === "COMPLETED"),
        hasModelResult: stage2CaseWaitingForKickoff ? false : stage2ModelAvailable,
        inferenceStatus: stage2InferenceState.jobStatus,
        classificationConfirmed: stage2CaseWaitingForKickoff ? false : stage2ConfirmedByState,
        nextStepDecided: stage2CaseWaitingForKickoff ? false : Boolean(stage2Diagnosis.nextStep),
      });
    }

    if (mode === "stage3") {
      if (stage3View && !isStage2OpsView) {
        return toOpsLoopStateFromStage3View(stage3View);
      }
      return computeOpsLoopState(loopEvents, {
        stage: "stage3",
        storedOpsStatus: detail.stage3?.headerMeta.opsStatus,
        hasPlanConfirmed: Boolean(detail.stage3?.riskReviewedAt),
        hasResultReceived: stage3ResultEvidenceReadyForOps || stage3ModelAvailable,
        hasResultValidated: stage3ResultEvidenceReadyForOps || stage3ModelAvailable,
        hasModelResult: stage3ModelAvailable,
        inferenceStatus: stage3InferenceState.jobStatus,
        classificationConfirmed: Boolean(stage3LatestRiskReview?.at || detail.stage3?.riskReviewedAt),
        nextStepDecided: Boolean(detail.stage3?.planUpdatedAt || detail.stage3?.headerMeta.nextTrackingContactAt),
        referralConfirmed: detail.linkageStatus === "BOOKING_DONE" || detail.linkageStatus === "REFERRAL_CREATED",
      });
    }

    const hasStage1ContactAttempted = detail.contactExecution.status !== "NOT_STARTED";
    const hasStage1ResponseRecorded = Boolean(detail.contactExecution.lastOutcomeCode || detail.contactExecution.lastResponseAt);
    return computeOpsLoopState(loopEvents, {
      stage: "stage1",
      hasPlanConfirmed: stage1CaseWaitingForKickoff ? false : preTriageReady && Boolean(detail.preTriageResult?.strategy),
      hasResultReceived: stage1CaseWaitingForKickoff ? false : hasStage1ContactAttempted,
      hasResultValidated: stage1CaseWaitingForKickoff ? false : hasStage1ContactAttempted,
      hasModelResult: false,
      classificationConfirmed: stage1CaseWaitingForKickoff ? false : hasStage1ResponseRecorded,
      nextStepDecided: stage1CaseWaitingForKickoff
        ? false
        : detail.linkageStatus !== "NOT_CREATED" ||
          detail.contactExecution.status === "DONE" ||
          detail.contactExecution.status === "STOPPED",
    });
  }, [
    detail.contactExecution.lastOutcomeCode,
    detail.contactExecution.lastResponseAt,
    detail.contactExecution.status,
    detail.linkageStatus,
    detail.preTriageResult,
    detail.stage3?.headerMeta.nextTrackingContactAt,
    detail.stage3?.headerMeta.opsStatus,
    detail.stage3?.planUpdatedAt,
    detail.stage3?.riskReviewedAt,
    isStage2OpsView,
    loopEvents,
    mode,
    preTriageReady,
    stage1CaseWaitingForKickoff,
    stage3View,
    stage2ConfirmedByState,
    stage2Diagnosis.nextStep,
    stage2Diagnosis.status,
    stage2Evidence?.completed,
    stage2Evidence?.updatedAt,
    stage2InferenceState.jobStatus,
    stage2IntegrationState.receivedAt,
    stage2CaseWaitingForKickoff,
    stage2ModelAvailable,
    stage3InferenceState.jobStatus,
    stage3LatestRiskReview?.at,
    stage3ModelAvailable,
    stage3ResultEvidenceReadyForOps,
  ]);
  const stage1FlowCards = useStage1Flow(detail, mode, isStage2OpsView, opsLoopState);
  const stage3RiskSummary = detail.stage3?.transitionRisk;
  const stage3Programs = detail.stage3?.programs ?? [];
  const stage3FilteredPrograms = useMemo(() => {
    return stage3Programs.filter((program) => {
      if (stage3ProgramMajorFilter !== "ALL" && program.major !== stage3ProgramMajorFilter) return false;
      if (stage3ProgramOnlyPinned && !program.pinned) return false;
      if (!stage3ProgramSearch.trim()) return true;
      const keyword = stage3ProgramSearch.trim().toLowerCase();
      return `${program.major} ${program.middle} ${program.leaf}`.toLowerCase().includes(keyword);
    });
  }, [stage3ProgramMajorFilter, stage3ProgramOnlyPinned, stage3ProgramSearch, stage3Programs]);
  const stage3VirtualizedPrograms = useMemo(() => stage3FilteredPrograms.slice(0, 24), [stage3FilteredPrograms]);
  const stage3SelectedPrograms = useMemo(() => stage3Programs.filter((program) => program.selected), [stage3Programs]);
  const stage3HasProgramExecution = useMemo(
    () =>
      stage3Programs.some(
        (program) =>
          program.selected &&
          (program.execution?.status === "PLANNED" ||
            program.execution?.status === "IN_PROGRESS" ||
            program.execution?.status === "DONE"),
      ),
    [stage3Programs],
  );
  const stage3PendingApprovalCount = useMemo(
    () => detail.stage3?.recommendedActions.filter((action) => action.requiresApproval && action.decision === "PENDING").length ?? 0,
    [detail.stage3?.recommendedActions],
  );
  const stage3DiffStatusReady = detail.stage3?.diffPathStatus === "SCHEDULED" || detail.stage3?.diffPathStatus === "COMPLETED";
  const stage3ResultEvidenceReady =
    Boolean(stage3Evidence?.completed) ||
    Boolean(
      stage3DiffDraft.resultPerformedAt &&
        stage3DiffDraft.resultSummary.trim() &&
        stage3DiffDraft.biomarkerResultText?.trim() &&
        stage3DiffDraft.imagingResultText?.trim(),
    );
  const stage3DiffReadyForRisk = stage3DiffStatusReady && stage3ResultEvidenceReady;
  const activeProgramDraft = useMemo(
    () => stage3Programs.find((program) => program.id === stage3ProgramDrawerId) ?? null,
    [stage3ProgramDrawerId, stage3Programs]
  );
  const stage3TaskOrder: Stage1FlowCardId[] = ["PRECHECK", "CONTACT_EXECUTION", "RESPONSE_HANDLING", "FOLLOW_UP"];
  const stage1TaskOrder: Stage1FlowCardId[] = stage3TaskOrder;
  const stage1TaskStepIndex = activeStage1Modal ? stage1TaskOrder.indexOf(activeStage1Modal) : -1;
  const stage1TaskCurrentCard = activeStage1Modal ? stage1FlowCards.find((card) => card.id === activeStage1Modal) ?? null : null;
  const stage3TaskStepIndex = stage3TaskModalStep ? stage3TaskOrder.indexOf(stage3TaskModalStep) : -1;
  const stage3TaskCurrentCard = stage3TaskModalStep ? stage1FlowCards.find((card) => card.id === stage3TaskModalStep) ?? null : null;
  const stage3FollowUpLocked = stage1FlowCards.find((card) => card.id === "FOLLOW_UP")?.status === "BLOCKED";
  const linkageLockedOnBoard = isStage3Mode ? stage3FollowUpLocked : !isStage2Mode;
  const agentGateStatus = useMemo(() => resolveAgentGateStatus(detail.policyGates), [detail.policyGates]);
  const isAgentAutoMode = effectiveStrategy === "AI_FIRST" && detail.contactExecutor === "AGENT_SEND_ONLY";
  const agentRetryIntervalHours = detail.contactPlan?.maxRetryPolicy.intervalHours ?? 24;
  const agentMaxRetries = detail.contactPlan?.maxRetryPolicy.maxRetries ?? 2;
  const agentTemplateVersion = detail.contactPlan?.templateId ?? (isStage2Mode ? "S2_CONTACT_BASE" : isStage3Mode ? "S3_CONTACT_BASE" : "S1_CONTACT_BASE");
  const stage2Route = ssotCase?.stage2Route ?? (stage2PlanRouteDraft === "HOSPITAL_REFERRAL" ? "HOSPITAL" : "CENTER");
  const openStage3Step2Panel = useCallback((panel: Stage3Step2PanelKey) => {
    setStage3Step2ActivePanel(panel);
    if (panel === "RESULT") {
      setStage3ShowResultCollection(true);
    }
    if (typeof window !== "undefined") {
      window.requestAnimationFrame(() => {
        const target = document.getElementById(`stage3-step2-panel-${panel.toLowerCase()}`);
        target?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    }
  }, []);
  const stage2PlanItems = usePlanItems({
    routeType: stage2PlanRouteDraft as Stage2PlanRoute,
    hospitalName: stage2HospitalDraft,
    dueAt: stage2ScheduleDraft,
    tests: stage2Diagnosis.tests,
    optionalTests: stage2OptionalTestsDraft,
    integrationReceivedAt: stage2IntegrationState.receivedAt,
    integrationUpdatedAt: stage2IntegrationState.lastSyncedAt,
    manualEditEnabled: stage2ManualEditEnabled,
  });
  const stage2Step1Reviewed = Boolean(detail.stage3?.riskReviewedAt);
  const stage2RequiredBlockingPlanItems = useMemo(
    () =>
      stage2PlanItems.filter(
        (item) =>
          item.requiredLevel === "REQUIRED" &&
          (item.status === "MISSING" || item.status === "NEEDS_REVIEW" || item.status === "PENDING"),
      ),
    [stage2PlanItems],
  );
  const stage2PlanCompletionRate = useMemo(() => {
    const completed = stage2PlanItems.filter((item) => item.status === "DONE" || item.status === "RECEIVED").length;
    return stage2PlanItems.length ? Math.round((completed / stage2PlanItems.length) * 100) : 0;
  }, [stage2PlanItems]);
  const stage2RequiredSatisfaction = useMemo(() => {
    const requiredItems = stage2PlanItems.filter((item) => item.requiredLevel === "REQUIRED");
    const satisfied = requiredItems.filter((item) => STAGE2_STEP2_READY_STATUSES.has(item.status)).length;
    return requiredItems.length ? Math.round((satisfied / requiredItems.length) * 100) : 0;
  }, [stage2PlanItems]);
  const stage2PlanRouteChangeNeedsReason = useMemo(
    () =>
      detail.timeline.some((event) => event.type === "DIFF_REFER_CREATED" || event.type === "DIFF_SCHEDULED" || event.type === "LINKAGE_CREATED"),
    [detail.timeline],
  );
  const stage2PlanRouteState: Stage2PlanRouteState = useMemo(
    () => ({
      routeType: stage2PlanRouteDraft as Stage2PlanRoute,
      orgName: stage2HospitalDraft,
      dueAt: stage2ScheduleDraft,
      lastSyncAt: stage2IntegrationState.lastSyncedAt ?? stage2IntegrationState.receivedAt ?? detail.stage3?.riskReviewedAt,
      needsReasonOnChange: stage2PlanRouteChangeNeedsReason,
    }),
    [
      detail.stage3?.riskReviewedAt,
      stage2HospitalDraft,
      stage2IntegrationState.lastSyncedAt,
      stage2IntegrationState.receivedAt,
      stage2PlanRouteChangeNeedsReason,
      stage2PlanRouteDraft,
      stage2ScheduleDraft,
    ],
  );
  const stage2PlanSummary: Stage2PlanSummary = useMemo(() => {
    const hasRequiredInProgress = stage2PlanItems.some(
      (item) =>
        item.requiredLevel === "REQUIRED" &&
        (item.status === "REFERRED" || item.status === "SCHEDULED" || item.status === "DONE" || item.status === "RECEIVED"),
    );
    const status: Stage2PlanStatus =
      stage2RequiredBlockingPlanItems.length > 0
        ? "BLOCKED"
        : stage2Step1Reviewed
          ? "READY"
          : hasRequiredInProgress
            ? "IN_PROGRESS"
            : "PAUSED";
    return {
      status,
      completionRate: stage2PlanCompletionRate,
      requiredSatisfaction: stage2RequiredSatisfaction,
      missingCount: stage2RequiredBlockingPlanItems.length,
      qualityScore: detail.header.dataQuality.score,
      step1Reviewed: stage2Step1Reviewed,
      locks: {
        step2: stage1FlowCards.find((card) => card.id === "CONTACT_EXECUTION")?.status === "BLOCKED",
        step3: stage1FlowCards.find((card) => card.id === "RESPONSE_HANDLING")?.status === "BLOCKED",
        step4: stage1FlowCards.find((card) => card.id === "FOLLOW_UP")?.status === "BLOCKED",
      },
    };
  }, [
    detail.header.dataQuality.score,
    stage1FlowCards,
    stage2PlanCompletionRate,
    stage2PlanItems,
    stage2RequiredBlockingPlanItems.length,
    stage2RequiredSatisfaction,
    stage2Step1Reviewed,
  ]);
  const handleStage2PlanRouteSelect = useCallback(
    (nextRoute: Stage2PlanRoute) => {
      if (nextRoute === stage2PlanRouteDraft) return;
      let reason = "";
      if (stage2PlanRouteChangeNeedsReason && typeof window !== "undefined") {
        reason = window.prompt("기존 의뢰/예약 이력이 있습니다. 경로 변경 사유를 입력하세요.")?.trim() ?? "";
        if (!reason) {
          toast.error("경로 변경 사유를 입력해야 합니다.");
          return;
        }
      }
      const prevLabel = stage2PlanRouteDraft === "HOSPITAL_REFERRAL" ? "협력병원 의뢰" : "센터 직접 수행";
      const nextLabel = nextRoute === "HOSPITAL_REFERRAL" ? "협력병원 의뢰" : "센터 직접 수행";
      setStage2PlanRouteDraft(nextRoute);
      clearStage2FieldError("step1Plan");
      appendTimeline({
        type: "STATUS_CHANGE",
        at: nowIso(),
        from: prevLabel,
        to: nextLabel,
        reason: reason || "Stage2 수행 경로 변경",
        by: detail.header.assigneeName,
      });
      appendAuditLog(`Stage2 수행 경로 변경: ${prevLabel} → ${nextLabel}${reason ? ` (${reason})` : ""}`);
    },
    [
      appendAuditLog,
      clearStage2FieldError,
      detail.header.assigneeName,
      stage2PlanRouteChangeNeedsReason,
      stage2PlanRouteDraft,
    ],
  );
  const handleStage2PlanPrimaryAction = useCallback(() => {
    const now = nowIso();
    if (stage2PlanRouteDraft === "HOSPITAL_REFERRAL") {
      appendTimeline({
        type: "DIFF_REFER_CREATED",
        at: now,
        by: detail.header.assigneeName,
        summary: `의뢰 생성/재전송: ${stage2HospitalDraft || "협력병원"} · 목표 ${formatDateTime(stage2ScheduleDraft)}`,
      });
      appendAuditLog(`Stage2 의뢰 생성/재전송: ${stage2HospitalDraft || "협력병원"}`);
      setDetail((prev) =>
        prev.stage3
          ? {
              ...prev,
              stage3: {
                ...prev.stage3,
                diffPathStatus: prev.stage3.diffPathStatus === "NONE" ? "REFERRED" : prev.stage3.diffPathStatus,
              },
            }
          : prev,
      );
      toast.success("의뢰 생성/재전송이 기록되었습니다.");
      return;
    }
    appendTimeline({
      type: "DIFF_SCHEDULED",
      at: now,
      by: detail.header.assigneeName,
      summary: `센터 일정 생성: ${formatDateTime(stage2ScheduleDraft)}`,
    });
    appendAuditLog(`Stage2 센터 일정 생성: ${formatDateTime(stage2ScheduleDraft)}`);
    setDetail((prev) =>
      prev.stage3
        ? {
            ...prev,
            stage3: {
              ...prev.stage3,
              diffPathStatus: prev.stage3.diffPathStatus === "NONE" ? "SCHEDULED" : prev.stage3.diffPathStatus,
            },
          }
        : prev,
    );
    toast.success("센터 일정 생성이 기록되었습니다.");
  }, [
    appendAuditLog,
    detail.header.assigneeName,
    stage2HospitalDraft,
    stage2PlanRouteDraft,
    stage2ScheduleDraft,
  ]);
  const handleStage2PlanItemAction = useCallback(
    (item: Stage2PlanItem, action: Stage2PlanItemAction) => {
      const now = nowIso();
      if (action.key === "OPEN_PIPELINE") {
        setStage3TaskModalStep("CONTACT_EXECUTION");
        return;
      }
      if (action.key === "VIEW_RESULT") {
        setStage3TaskModalStep("CONTACT_EXECUTION");
        if (typeof window !== "undefined") {
          window.setTimeout(() => {
            const target =
              document.getElementById("stage2-modal-step2-input") ??
              document.getElementById("stage2-step2-input");
            target?.scrollIntoView({ behavior: "smooth", block: "start" });
          }, 20);
        }
        return;
      }
      if (action.key === "REQUEST_RESULT") {
        appendTimeline({
          type: "MESSAGE_SENT",
          at: now,
          by: detail.header.assigneeName,
          summary: `${item.label} 결과 재요청`,
        });
        appendAuditLog(`Stage2 결과 재요청: ${item.label}`);
        toast.success(`${item.label} 결과 재요청이 기록되었습니다.`);
        return;
      }
      if (action.key === "MANUAL_EXCEPTION") {
        setStage2ManualEditEnabled(true);
        setStage3TaskModalStep("CONTACT_EXECUTION");
        appendAuditLog(`Stage2 수기 입력(예외) 전환: ${item.label}`);
        toast("STEP2에서 수기 입력 사유를 함께 기록해 주세요.");
        return;
      }
      appendTimeline({
        type: "STAGE2_RESULTS_RECORDED",
        at: now,
        by: detail.header.assigneeName,
        summary: `${item.label} 검증 완료`,
      });
      appendAuditLog(`Stage2 검증 완료: ${item.label}`);
      toast.success(`${item.label} 검증 완료를 기록했습니다.`);
    },
    [appendAuditLog, detail.header.assigneeName],
  );
  const stage2PlanRequiredChecks = useMemo(
    () =>
      computeStage2RequiredChecks(stage2PlanRouteDraft as Stage2PlanRoute, stage2PlanRequiredDraft as Stage2PlanRequiredDraft),
    [stage2PlanRequiredDraft, stage2PlanRouteDraft],
  );
  const stage2RequiredTestCount = stage2Route === "HOSPITAL" ? 4 : 3;
  const stage2CompletedCount = stage2Evidence
    ? stage2RequiredTestCount - stage2Evidence.missing.length
    : countStage2CompletedTests(stage2EffectiveTests);
  const stage2CompletionPct = Math.round((Math.max(0, stage2CompletedCount) / stage2RequiredTestCount) * 100);
  const stage2DisplayLabel = stage2ClassLabelFromModel(ssotModel2?.predictedLabel) ?? stage2ModelRunState.recommendedLabel;
  const stage2DisplayMciStage = stage2MciStageFromModel(ssotModel2?.mciBand);
  const stage3CaseResultLabel: "정상" | "MCI" | "치매" = stage2DisplayLabel ?? "MCI";
  const stage3MciSeverity: "양호" | "적정" | "위험" | undefined =
    caseRecord?.risk === "고" ? "위험" : caseRecord?.risk === "저" ? "양호" : "적정";
  const stage2CurrentLabel: Stage2ClassLabel = stage2DisplayLabel ?? stage2ClassificationDraft;
  const stage2CurrentMciStage = stage2DisplayMciStage;
  const stage2Stage3EntryNeeded = stage2ModelAvailable ? stage2NeedsStage3(stage2CurrentLabel) : false;
  const stage2TargetDelayDays = Math.max(
    0,
    Math.floor((Date.now() - new Date(stage2TargetAt).getTime()) / (1000 * 60 * 60 * 24)),
  );
  const stage2InputMissingCount = countStage2MissingByPlan(
    stage2EffectiveTests,
    stage2PlanRouteDraft as Stage2PlanRoute,
    stage2PlanRequiredDraft as Stage2PlanRequiredDraft,
  );
  const stage2MissingRequirements = [
    ...(stage2PlanRequiredChecks.mmse && !(typeof stage2EffectiveTests.mmse === "number" && Number.isFinite(stage2EffectiveTests.mmse))
      ? ["MMSE 점수 미입력"]
      : []),
    ...(stage2PlanRequiredChecks.cdrOrGds && !(typeof stage2EffectiveTests.cdr === "number" && Number.isFinite(stage2EffectiveTests.cdr))
      ? ["CDR/GDS 점수 미입력"]
      : []),
    ...(stage2PlanRequiredChecks.neuroCognitive && !stage2EffectiveTests.neuroCognitiveType ? ["신경인지검사 유형 미선택"] : []),
    ...(stage2PlanRequiredChecks.specialist && !stage2EffectiveTests.specialist ? ["전문의 소견 미확인"] : []),
    ...stage2GateMissing,
    stage2RationaleDraft.trim().length > 0 ? null : "확정 근거 1줄 미입력",
  ].filter(Boolean) as string[];
  const stage2ResultMissingCount = Math.max(stage2InputMissingCount, stage2GateMissing.length);
  const stage2BookingWaitingCount =
    Number(detail.linkageStatus !== "BOOKING_DONE") + Number(stage2Diagnosis.status !== "COMPLETED");
  const stage2ClassificationConfirmed = Boolean(
    stage2ConfirmedByState,
  );
  const stage2ModelReady = stage2InferenceState.jobStatus === "DONE";
  const stage2RequiredDataPct = Math.max(0, Math.round(((stage2RequiredTestCount + 1 - stage2MissingRequirements.length) / (stage2RequiredTestCount + 1)) * 100));
  const stage2IntegrationStatus = useMemo(() => {
    const hasBooking = detail.linkageStatus !== "NOT_CREATED";
    const hasReceived = Boolean(stage2IntegrationState.receivedAt || stage2Evidence?.updatedAt || stage2Diagnosis.status !== "NOT_STARTED");
    return deriveStage2ModelStatus(stage2ResultMissingCount, hasBooking, hasReceived);
  }, [detail.linkageStatus, stage2Diagnosis.status, stage2Evidence?.updatedAt, stage2IntegrationState.receivedAt, stage2ResultMissingCount]);
  const stage2IntegrationDisplayStatus =
    stage2InferenceState.jobStatus === "DONE" && stage2ResultMissingCount === 0 ? "READY" : stage2IntegrationStatus;
  const stage2ModelRecommendedLabel = stage2ModelReady ? stage2DisplayLabel ?? stage2ModelRunState.recommendedLabel : undefined;
  const stage2ClassificationIsOverride =
    Boolean(stage2ModelRecommendedLabel) && stage2ClassificationDraft !== stage2ModelRecommendedLabel;
  const stage2OverrideMissing = stage2ClassificationIsOverride && stage2ClassificationOverrideReason.trim().length === 0;
  const stage2CanConfirm = stage2ModelReady && stage2MissingRequirements.length === 0 && !stage2OverrideMissing;
  const stage2Step4Selectable = stage2ClassificationConfirmed || stage2CanConfirm;
  const stage2NextActionLabel =
    stage2Diagnosis.status === "NOT_STARTED"
      ? "검사 결과 입력"
      : stage2Diagnosis.status === "IN_PROGRESS"
        ? "누락 검사 보완"
        : stage2CanConfirm
          ? "분류 확정"
          : "다음 단계 결정";
  const stage2DraftMciStage = stage2ClassificationDraft === "MCI" ? inferStage2MciStage(caseRecord) : undefined;
  const stage2DraftProbs = stage2ModelReady ? inferStage2Probs(stage2ClassificationDraft, stage2DraftMciStage) : undefined;
  const stage2ResolvedLabel: Stage2ClassLabel = stage2DisplayLabel ?? stage2ClassificationDraft;
  const stage2ResolvedMciStage: Stage2MciStageLabel | undefined = stage2DisplayMciStage ?? (stage2ResolvedLabel === "MCI" ? stage2DraftMciStage : undefined);
  const stage2ResolvedProbs = stage2ModelReady ? (ssotModel2?.probs ?? inferStage2Probs(stage2ResolvedLabel, stage2ResolvedMciStage)) : undefined;
  const stage3CurrentStepErrors: Stage3TaskFieldErrors = stage3TaskModalStep ? stage3FieldErrorsByStep[stage3TaskModalStep] ?? {} : {};
  const stage3ErrorSummaryEntries = useMemo(
    () =>
      stage3TaskModalStep
        ? stage3ErrorOrderByStep[stage3TaskModalStep]
            .filter((key) => Boolean(stage3CurrentStepErrors[key]))
            .map((key) => ({ key, message: stage3CurrentStepErrors[key] as string }))
        : [],
    [stage3CurrentStepErrors, stage3ErrorOrderByStep, stage3TaskModalStep],
  );

  useEffect(() => {
    if (stage2ModelRunState.status !== "RUNNING") return;
    if (stage2InferenceState.jobStatus !== "RUNNING" && stage2InferenceState.jobStatus !== "PENDING") return;
    const shouldFinish = stage2InferenceState.progress >= 95;
    if (!shouldFinish) return;

    const now = nowIso();
    const recommended = stage2ModelRunState.recommendedLabel ?? deriveStage2ModelRecommendation(stage2Diagnosis.tests);
    let didComplete = false;
    setStage2ModelRunState((prev) => {
      if (prev.status !== "RUNNING") return prev;
      didComplete = true;
      return {
        ...prev,
        status: "DONE",
        updatedAt: now,
        completedAt: now,
        progress: 100,
        etaSeconds: 0,
        recommendedLabel: recommended,
      };
    });
    if (!didComplete) return;

    let syncOk = true;
    if (caseRecord?.id) {
      syncOk = runCaseStage2Model(caseRecord.id, detail.header.assigneeName, {
        labelOverride: recommended,
      });
    }
    if (!syncOk) {
      setStage2ModelRunState((prev) => ({
        ...prev,
        status: "FAILED",
        updatedAt: now,
        completedAt: now,
        failureReason: "STAGE2_GATE_FAILED",
      }));
      appendTimeline({
        type: "INFERENCE_FAILED",
        stage: 2,
        at: now,
        by: detail.header.assigneeName,
        summary: "Stage2 모델 실행 실패",
        reason: "필수 검사/결과 조건 미충족",
      });
      appendAuditLog("Stage2 모델 실행 실패: 게이트 조건 미충족");
      return;
    }

    appendTimeline({
      type: "INFERENCE_COMPLETED",
      stage: 2,
      at: now,
      by: detail.header.assigneeName,
      summary: `Stage2 모델 실행 완료 · 추천 ${recommended}`,
      progress: 100,
      etaSeconds: 0,
    });
    appendTimeline({
      type: "STAGE2_RESULTS_RECORDED",
      at: now,
      by: detail.header.assigneeName,
      summary: `모델 산출 완료: 추천 ${recommended} (운영 참고)`,
    });
    appendAuditLog(`Stage2 모델 산출 완료: 추천 ${recommended}`);
  }, [
    appendAuditLog,
    caseRecord?.id,
    detail.header.assigneeName,
    runCaseStage2Model,
    stage2Diagnosis.tests,
    stage2InferenceState.jobStatus,
    stage2InferenceState.progress,
    stage2ModelRunState.recommendedLabel,
    stage2ModelRunState.status,
  ]);

  useEffect(() => {
    if (stage3ModelRunState.status !== "RUNNING") return;
    if (stage3InferenceState.jobStatus !== "RUNNING" && stage3InferenceState.jobStatus !== "PENDING") return;
    const shouldFinish = stage3InferenceState.progress >= 95;
    if (!shouldFinish) return;

    const now = nowIso();
    let didComplete = false;
    setStage3ModelRunState((prev) => {
      if (prev.status !== "RUNNING") return prev;
      didComplete = true;
      return {
        ...prev,
        status: "DONE",
        updatedAt: now,
        completedAt: now,
        progress: 100,
        etaSeconds: 0,
      };
    });
    if (!didComplete) return;

    let syncOk = true;
    if (caseRecord?.id) {
      syncOk = runCaseStage3Model(caseRecord.id, detail.header.assigneeName);
    }
    if (!syncOk) {
      setStage3ModelRunState((prev) => ({
        ...prev,
        status: "FAILED",
        updatedAt: now,
        completedAt: now,
        failureReason: "STAGE3_GATE_FAILED",
      }));
      appendTimeline({
        type: "INFERENCE_FAILED",
        stage: 3,
        at: now,
        by: detail.header.assigneeName,
        summary: "Stage3 모델 실행 실패",
        reason: "Stage2 확정 결과/후속 데이터 조건 미충족",
      });
      appendAuditLog("Stage3 모델 실행 실패: 게이트 조건 미충족");
      return;
    }

    appendTimeline({
      type: "INFERENCE_COMPLETED",
      stage: 3,
      at: now,
      by: detail.header.assigneeName,
      summary: "Stage3 모델 실행 완료",
      progress: 100,
      etaSeconds: 0,
    });
    appendAuditLog("Stage3 모델 산출 완료");
  }, [
    appendAuditLog,
    caseRecord?.id,
    detail.header.assigneeName,
    runCaseStage3Model,
    stage3InferenceState.jobStatus,
    stage3InferenceState.progress,
    stage3ModelRunState.status,
  ]);

  const focusStage2ResultInput = useCallback(() => {
    if (typeof window === "undefined") return;
    const target =
      document.getElementById("stage2-modal-step2-input") ??
      document.getElementById("stage2-step2-input");
    target?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);
  const focusStage3ResultInput = useCallback(() => {
    setStage3TaskModalStep("CONTACT_EXECUTION");
    setStage3ShowResultCollection(true);
    if (typeof window === "undefined") return;
    window.setTimeout(() => {
      const target = document.getElementById("stage3-step2-input");
      target?.scrollIntoView({ behavior: "smooth", block: "start" });
      focusStage3ErrorField("step2PerformedAt");
    }, 30);
  }, [focusStage3ErrorField]);

  const confirmDiscardResponseDraft = useCallback(() => {
    if (isOutcomeSaving) return false;
    if (activeStage1Modal !== "RESPONSE_HANDLING" || !responseDraftDirty) return true;
    return window.confirm("저장하지 않고 나가면 입력 내용이 사라집니다. 계속할까요?");
  }, [activeStage1Modal, isOutcomeSaving, responseDraftDirty]);

  const setStage1ModalStep = useCallback(
    (target: Stage1FlowCardId) => {
      if (isOutcomeSaving) return false;
      if (activeStage1Modal === "RESPONSE_HANDLING" && target !== "RESPONSE_HANDLING" && !confirmDiscardResponseDraft()) {
        return false;
      }
      setActiveStage1Modal(target);
      if (target === "FOLLOW_UP") {
        setHandoffMemoOpen(true);
      }
      return true;
    },
    [activeStage1Modal, confirmDiscardResponseDraft, isOutcomeSaving],
  );

  const closeStage1Modal = useCallback(() => {
    if (!confirmDiscardResponseDraft()) return;
    setActiveStage1Modal(null);
  }, [confirmDiscardResponseDraft]);
  const closeStage3TaskModal = useCallback(() => {
    setStage3TaskModalStep(null);
  }, []);

  const cancelAgentJob = useCallback(
    ({
      actor,
      summary,
      detailMessage,
      moveToHuman = false,
    }: {
      actor: "system" | "agent" | "operator";
      summary: string;
      detailMessage?: string;
      moveToHuman?: boolean;
    }) => {
      if (agentJob.status !== "QUEUED" && agentJob.status !== "RUNNING") return;

      const now = nowIso();
      const token = agentJobRunTokenRef.current + 1;
      agentJobRunTokenRef.current = token;
      if (agentJob.idempotencyKey) {
        agentQueuedKeyRef.current.delete(agentJob.idempotencyKey);
      }
      mockAgentService.cancelJob(agentJob.jobId);

      setAgentJob((prev) => ({
        ...prev,
        status: "CANCELED",
        finishedAt: now,
        summary,
        lastError: detailMessage,
      }));

      if (moveToHuman) {
        setDetail((prev) => {
          const nextExecution: ContactExecution = {
            ...prev.contactExecution,
            status: "HANDOFF_TO_HUMAN",
          };
          return {
            ...prev,
            contactExecution: nextExecution,
            contactFlowSteps: buildContactFlowSteps(nextExecution, prev.preTriageResult, prev.linkageStatus, mode),
          };
        });
      }

      appendTimeline({
        type: "AGENT_JOB_CANCELED",
        at: now,
        actor,
        caseId: detail.header.caseId,
        attemptNo: agentJob.attemptNo,
        idempotencyKey: agentJob.idempotencyKey ?? `${detail.header.caseId}:0:SMS:${agentTemplateVersion}`,
        summary,
        detail: detailMessage,
        by: actor,
      });
      appendAuditLog(`Agent 자동 수행 취소: ${summary}${detailMessage ? ` (${detailMessage})` : ""}`);
    },
    [agentJob.attemptNo, agentJob.idempotencyKey, agentJob.status, agentTemplateVersion, appendAuditLog, detail.header.caseId]
  );

  const queueAgentJob = useCallback(
    ({
      trigger,
      runAfterMs = 250,
      force = false,
    }: {
      trigger: AgentJobTrigger;
      runAfterMs?: number;
      force?: boolean;
    }) => {
      if (effectiveStrategy !== "AI_FIRST") return false;
      if (detail.contactExecutor !== "AGENT_SEND_ONLY") return false;
      if (agentGateStatus !== "PASS") return false;
      if (!force && !["NOT_STARTED", "RETRY_NEEDED"].includes(detail.contactExecution.status)) return false;
      if (!force && ["QUEUED", "RUNNING"].includes(agentJob.status)) return false;

      const attemptNo = detail.contactExecution.retryCount + 1;
      if (attemptNo > agentMaxRetries) {
        appendAuditLog(`Agent 자동 수행 차단: 최대 재시도 ${agentMaxRetries}회를 초과했습니다.`);
        return false;
      }

      if (!force && detail.contactExecution.status === "RETRY_NEEDED" && detail.contactExecution.lastSentAt) {
        const elapsedMs = Date.now() - new Date(detail.contactExecution.lastSentAt).getTime();
        if (elapsedMs < agentRetryIntervalHours * 60 * 60 * 1000) {
          return false;
        }
      }

      const idempotencyKey = buildAgentIdempotencyKey(
        detail.header.caseId,
        attemptNo,
        "SMS",
        agentTemplateVersion
      );
      if (agentQueuedKeyRef.current.has(idempotencyKey)) {
        return false;
      }

      const queueResult = mockAgentService.queueSms({
        caseId: detail.header.caseId,
        idempotencyKey,
      });
      if (!queueResult.ok) {
        appendAuditLog(`Agent 자동 수행 예약 실패: ${idempotencyKey}`);
        return false;
      }

      const queuedAt = queueResult.queuedAt;
      const queueSummary = `${agentTriggerLabel(trigger)}으로 문자 자동 수행 예약`;
      setAgentJob({
        status: "QUEUED",
        attemptNo,
        jobId: queueResult.jobId,
        idempotencyKey,
        queuedAt,
        startedAt: undefined,
        finishedAt: undefined,
        nextRetryAt: runAfterMs > 5000 ? new Date(Date.now() + runAfterMs).toISOString() : undefined,
        channelResult: undefined,
        lastError: undefined,
        summary: queueSummary,
      });

      agentQueuedKeyRef.current.add(idempotencyKey);
      appendTimeline({
        type: "AGENT_JOB_QUEUED",
        at: queuedAt,
        actor: "system",
        caseId: detail.header.caseId,
        attemptNo,
        idempotencyKey,
        summary: queueSummary,
        detail: `trigger=${trigger}`,
        by: "system",
      });
      appendAuditLog(`Agent 자동 수행 예약: attempt ${attemptNo} (${idempotencyKey})`);

      const runToken = agentJobRunTokenRef.current + 1;
      agentJobRunTokenRef.current = runToken;

      window.setTimeout(() => {
        if (agentJobRunTokenRef.current !== runToken) return;

        const startedAt = nowIso();
        setAgentJob((prev) => {
          if (prev.idempotencyKey !== idempotencyKey || prev.status !== "QUEUED") return prev;
          return {
            ...prev,
            status: "RUNNING",
            startedAt,
            summary: "Agent 문자 자동 수행 진행중",
          };
        });

        appendTimeline({
          type: "AGENT_JOB_STARTED",
          at: startedAt,
          actor: "agent",
          caseId: detail.header.caseId,
          attemptNo,
          idempotencyKey,
          summary: "Agent 문자 자동 수행 시작",
          detail: `attempt ${attemptNo}`,
          by: "agent",
        });
        appendAuditLog(`Agent 자동 수행 시작: attempt ${attemptNo}`);

        window.setTimeout(() => {
          if (agentJobRunTokenRef.current !== runToken) return;

          const finishedAt = nowIso();
          const dispatch = evaluateMockAgentDispatch({
            caseRecord,
            gates: detail.policyGates,
            attemptNo,
          });

          if (dispatch.success) {
            setAgentJob((prev) => ({
              ...prev,
              status: "SUCCEEDED",
              attemptNo,
              idempotencyKey,
              finishedAt,
              channelResult: dispatch.channelResult,
              lastError: undefined,
              nextRetryAt: undefined,
              summary: "Agent 문자 자동 수행 성공",
            }));

            setDetail((prev) => {
              const nextExecution: ContactExecution = {
                ...prev.contactExecution,
                status: "SENT",
                lastSentAt: finishedAt,
                retryCount: Math.max(prev.contactExecution.retryCount, attemptNo),
              };
              return {
                ...prev,
                contactExecution: nextExecution,
                contactFlowSteps: buildContactFlowSteps(nextExecution, prev.preTriageResult, prev.linkageStatus, mode),
              };
            });
            setRecontactDueAt(withHoursFromNow(48));

            appendTimeline({
              type: "AGENT_SMS_SENT",
              at: finishedAt,
              actor: "agent",
              caseId: detail.header.caseId,
              attemptNo,
              idempotencyKey,
              channelResult: dispatch.channelResult,
              summary: "Agent 자동 문자 발송 완료",
              detail: AGENT_CHANNEL_RESULT_LABELS[dispatch.channelResult],
              by: "agent",
            });
            appendTimeline({
              type: "AGENT_JOB_SUCCEEDED",
              at: finishedAt,
              actor: "agent",
              caseId: detail.header.caseId,
              attemptNo,
              idempotencyKey,
              summary: "Agent 자동 수행 성공",
              detail: AGENT_CHANNEL_RESULT_LABELS[dispatch.channelResult],
              by: "agent",
            });
            appendAgentExecutionLog({
              at: finishedAt,
              result: "SENT_SUCCESS",
              summary: "Agent 자동 문자 발송 성공",
              recommendationId: selectedRagId ?? undefined,
              recommendationTitle: ragRecommendations.find((item) => item.id === selectedRagId)?.title,
              actor: "agent",
            });
            appendAuditLog(`Agent 자동 수행 성공: attempt ${attemptNo} (${idempotencyKey})`);
            return;
          }

          const nextRetryAt = new Date(Date.now() + agentRetryIntervalHours * 60 * 60 * 1000).toISOString();
          setAgentJob((prev) => ({
            ...prev,
            status: "FAILED",
            attemptNo,
            idempotencyKey,
            finishedAt,
            channelResult: dispatch.channelResult,
            lastError: dispatch.errorMessage,
            nextRetryAt,
            summary: "Agent 문자 자동 수행 실패",
          }));

          setDetail((prev) => {
            const nextExecution: ContactExecution = {
              ...prev.contactExecution,
              status: "RETRY_NEEDED",
              lastSentAt: finishedAt,
              retryCount: Math.max(prev.contactExecution.retryCount, attemptNo),
            };
            return {
              ...prev,
              contactExecution: nextExecution,
              contactFlowSteps: buildContactFlowSteps(nextExecution, prev.preTriageResult, prev.linkageStatus, mode),
            };
          });
          setRecontactDueAt(nextRetryAt);

          appendTimeline({
            type: "AGENT_JOB_FAILED",
            at: finishedAt,
            actor: "agent",
            caseId: detail.header.caseId,
            attemptNo,
            idempotencyKey,
            summary: "Agent 자동 수행 실패",
            detail: dispatch.errorMessage,
            errorCode: dispatch.errorCode,
            by: "agent",
          });
          appendAgentExecutionLog({
            at: finishedAt,
            result: "SENT_FAILED",
            summary: dispatch.errorMessage ?? "Agent 자동 문자 발송 실패",
            recommendationId: selectedRagId ?? undefined,
            recommendationTitle: ragRecommendations.find((item) => item.id === selectedRagId)?.title,
            actor: "agent",
          });
          appendAuditLog(`Agent 자동 수행 실패: ${dispatch.errorMessage ?? dispatch.errorCode ?? "unknown"}`);
        }, 1000);
      }, runAfterMs);

      return true;
    },
    [
      agentGateStatus,
      agentJob.status,
      agentMaxRetries,
      agentRetryIntervalHours,
      agentTemplateVersion,
      appendAuditLog,
      caseRecord,
      detail.contactExecution.lastSentAt,
      detail.contactExecution.retryCount,
      detail.contactExecution.status,
      detail.contactExecutor,
      detail.header.caseId,
      detail.policyGates,
      effectiveStrategy,
      ragRecommendations,
      selectedRagId,
    ]
  );

  const retryAgentNow = useCallback(() => {
    const queued = queueAgentJob({ trigger: "MANUAL_RETRY_NOW", runAfterMs: 200, force: true });
    if (!queued) {
      toast.error("즉시 재시도 조건을 충족하지 못했습니다.");
      return;
    }
    toast.success("Agent 즉시 재시도를 예약했습니다.");
  }, [queueAgentJob]);

  const scheduleAgentRetry = useCallback(() => {
    const queued = queueAgentJob({
      trigger: "MANUAL_RETRY_SCHEDULE",
      runAfterMs: agentRetryIntervalHours * 60 * 60 * 1000,
      force: true,
    });
    if (!queued) {
      toast.error("재시도 예약 조건을 충족하지 못했습니다.");
      return;
    }
    toast.success(`재시도를 ${agentRetryIntervalHours}시간 후로 예약했습니다.`);
  }, [agentRetryIntervalHours, queueAgentJob]);

  useEffect(() => {
    if (!isAgentAutoMode || agentGateStatus !== "PASS") return;
    if (detail.contactExecution.status !== "NOT_STARTED" && detail.contactExecution.status !== "RETRY_NEEDED") return;

    const caseKey = detail.header.caseId;
    if (agentAutoEnterTriggeredRef.current.has(caseKey)) return;
    agentAutoEnterTriggeredRef.current.add(caseKey);
    queueAgentJob({ trigger: "AUTO_ON_ENTER", runAfterMs: 250 });
  }, [
    agentGateStatus,
    detail.contactExecution.status,
    detail.header.caseId,
    isAgentAutoMode,
    queueAgentJob,
  ]);

  useEffect(() => {
    const wasAutoMode = prevAgentAutoModeRef.current;
    if (!wasAutoMode && isAgentAutoMode && agentGateStatus === "PASS") {
      queueAgentJob({ trigger: "AUTO_ON_STRATEGY", runAfterMs: 250 });
    }
    prevAgentAutoModeRef.current = isAgentAutoMode;
  }, [agentGateStatus, isAgentAutoMode, queueAgentJob]);

  useEffect(() => {
    if (!isAgentAutoMode || agentGateStatus !== "PASS") return;
    if (detail.contactExecution.status !== "RETRY_NEEDED") return;
    if (!detail.contactExecution.lastSentAt) return;

    const elapsedMs = Date.now() - new Date(detail.contactExecution.lastSentAt).getTime();
    if (elapsedMs < agentRetryIntervalHours * 60 * 60 * 1000) return;

    queueAgentJob({ trigger: "AUTO_ON_RETRY_DUE", runAfterMs: 200 });
  }, [
    agentGateStatus,
    agentRetryIntervalHours,
    detail.contactExecution.lastSentAt,
    detail.contactExecution.status,
    isAgentAutoMode,
    nowTick,
    queueAgentJob,
  ]);

  useEffect(() => {
    if (isAgentAutoMode) return;
    if (agentJob.status !== "QUEUED" && agentJob.status !== "RUNNING") return;
    cancelAgentJob({
      actor: "system",
      summary: "자동 수행 정책이 비활성화되어 작업을 중지했습니다.",
      moveToHuman: true,
    });
  }, [agentJob.status, cancelAgentJob, isAgentAutoMode]);

  const openStage1FlowModal = useCallback(
    (modal: Stage1FlowCardId) => {
      const lockReason = getFlowCardLockReason(stage1FlowCards, modal);
      if (lockReason) {
        toast.error(lockReason);
        return;
      }

      if (isStage3Mode) {
        setStage3TaskModalStep(modal);
        return;
      }

      setStage1ModalStep(modal);
    },
    [isStage3Mode, setStage1ModalStep, stage1FlowCards]
  );

  const moveStage3TaskStep = useCallback(
    (offset: -1 | 1) => {
      if (!stage3TaskModalStep) return;
      const currentIndex = stage3TaskOrder.indexOf(stage3TaskModalStep);
      const target = stage3TaskOrder[currentIndex + offset];
      if (!target) return;
      const lockReason = getFlowCardLockReason(stage1FlowCards, target);
      if (lockReason) {
        toast.error(lockReason);
        return;
      }
      setStage3TaskModalStep(target);
    },
    [stage1FlowCards, stage3TaskModalStep, stage3TaskOrder],
  );

  const moveStage1TaskStep = useCallback(
    (offset: -1 | 1) => {
      if (!activeStage1Modal) return;
      const currentIndex = stage1TaskOrder.indexOf(activeStage1Modal);
      const target = stage1TaskOrder[currentIndex + offset];
      if (!target) return;
      const lockReason = getFlowCardLockReason(stage1FlowCards, target);
      if (lockReason) {
        toast.error(lockReason);
        return;
      }
      setStage1ModalStep(target);
    },
    [activeStage1Modal, setStage1ModalStep, stage1FlowCards, stage1TaskOrder],
  );

  const handleStage3TaskComplete = useCallback(() => {
    if (!stage3TaskModalStep || !detail.stage3) return;
    const now = nowIso();

    if (stage3TaskModalStep === "PRECHECK") {
      if (isStage2OpsView) {
        const blockingRequiredItems = stage2RequiredBlockingPlanItems;
        const precheckErrors = buildStage2ValidationErrors(
          stage2EffectiveTests,
          stage2PlanRouteDraft as Stage2PlanRoute,
          stage2PlanRequiredDraft as Stage2PlanRequiredDraft,
          {
            skipTestChecks: true,
            strategyMemo: stage3ReviewDraft.strategyMemo,
            consentConfirmed: stage3ReviewDraft.consentConfirmed,
          },
        );
        if (blockingRequiredItems.length > 0) {
          precheckErrors.step1Plan = `필수 검사 상태 미충족: ${blockingRequiredItems
            .map((item) => item.label)
            .join(", ")}`;
        }
        if (applyStage2ValidationErrors(precheckErrors)) {
          if (blockingRequiredItems.length > 0) {
            scrollToFirstErrorCard(
              blockingRequiredItems.map((item) => item.id),
              stage2PlanItemRefs,
            );
          }
          toast.error("STEP1 필수 입력/계획 누락을 먼저 확인해 주세요.");
          return;
        }
        setDetail((prev) => {
          if (!prev.stage3) return prev;
          const baselineStrategy = prev.header.effectiveStrategy ?? prev.preTriageResult?.strategy ?? "HUMAN_FIRST";
          return {
            ...prev,
            preTriageResult: prev.preTriageResult ?? {
              strategy: baselineStrategy,
              triggers: ["STAGE2_PLAN_BASELINE_CONFIRMED"],
              policyNote: "Stage2 진입 리뷰에서 검사 수행 기준선이 확인되었습니다.",
              confidence: "RULE",
            },
            policyGates: prev.policyGates.map((gate) =>
              gate.key === "CONSENT_OK" || gate.key === "PHONE_VERIFIED" || gate.key === "CONTACTABLE_TIME_OK"
                ? { ...gate, status: "PASS", failReason: undefined }
                : gate,
            ),
            stage3: {
              ...prev.stage3,
              riskReviewedAt: now,
            },
          };
        });
        const summary = `경로 ${stage2PlanRouteDraft === "HOSPITAL_REFERRAL" ? "협약병원 의뢰" : "센터 직접 수행"} · 기관 ${stage2HospitalDraft} · 목표일 ${formatDateTime(stage2ScheduleDraft)}`;
        appendTimeline({
          type: "STAGE2_PLAN_CONFIRMED",
          at: now,
          by: detail.header.assigneeName,
          summary,
        });
        appendAuditLog(`STAGE2_PLAN_CONFIRMED: ${summary}`);
        setStage2FieldErrors({});
        toast.success("STEP1 검사 계획이 확정되었습니다.");
        setStage3TaskModalStep("CONTACT_EXECUTION");
        return;
      }
      const precheckErrors: Stage3TaskFieldErrors = {};
      if (!stage3ReviewDraft.consentConfirmed) {
        precheckErrors.step1Consent = "상담 동의 확인이 필요합니다.";
      }
      if (stage3ReviewDraft.strategyMemo.trim().length < 10) {
        precheckErrors.step1StrategyMemo = "전략 메모를 10자 이상 입력해 주세요.";
      }
      if (applyStage3ValidationErrors("PRECHECK", precheckErrors)) {
        toast.error("STEP1 필수 입력을 먼저 확인해 주세요.");
        return;
      }
      setStage3FieldErrorsByStep((prev) => ({ ...prev, PRECHECK: {} }));
      setDetail((prev) => {
        if (!prev.stage3) return prev;
        const series = [...prev.stage3.transitionRisk.series];
        const lastPoint = series[series.length - 1];
        const reviewedPoint = {
          t: now,
          risk2y: lastPoint?.risk2y ?? prev.stage3.transitionRisk.risk2y_now,
          ciLow: lastPoint?.ciLow,
          ciHigh: lastPoint?.ciHigh,
          source: "manual" as const,
          event: "REEVAL" as const,
        };
        const nextSeries = [...series.slice(-11), reviewedPoint];
        const baselineStrategy = prev.header.effectiveStrategy ?? prev.preTriageResult?.strategy ?? "HUMAN_FIRST";
        return {
          ...prev,
          preTriageResult: prev.preTriageResult ?? {
            strategy: baselineStrategy,
            triggers: ["STAGE3_REVIEW_BASELINE_CONFIRMED"],
            policyNote: "Stage3 케이스 상태 리뷰에서 추적 기준선이 확인되었습니다.",
            confidence: "RULE",
          },
          policyGates: prev.policyGates.map((gate) =>
            gate.key === "CONSENT_OK" || gate.key === "PHONE_VERIFIED" || gate.key === "CONTACTABLE_TIME_OK"
              ? { ...gate, status: "PASS", failReason: undefined }
              : gate,
          ),
          stage3: {
            ...prev.stage3,
            riskReviewedAt: now,
            transitionRisk: {
              ...prev.stage3.transitionRisk,
              updatedAt: now,
              series: nextSeries,
            },
          },
        };
      });
      const checklistSummary = [
        stage3ReviewDraft.diffNeeded ? (isStage2OpsView ? "Stage2 진입 필요" : "감별경로 필요") : isStage2OpsView ? "Stage2 진입 보류" : "감별경로 보류",
        stage3ReviewDraft.caregiverNeeded ? "보호자 협력 필요" : null,
        stage3ReviewDraft.consentConfirmed ? "상담 동의 확인" : null,
        stage3ReviewDraft.diffDecisionReason.trim() ? `사유:${stage3ReviewDraft.diffDecisionReason.trim()}` : null,
      ]
        .filter(Boolean)
        .join(", ");
      const reviewSummary = `케이스 상태 리뷰 완료 · 우선도 ${stage3ReviewDraft.priority}${checklistSummary ? ` · 체크 ${checklistSummary}` : ""} · 메모: ${stage3ReviewDraft.strategyMemo.slice(0, 80)}`;
      appendTimeline({
        type: "RISK_REVIEWED",
        at: now,
        by: detail.header.assigneeName,
        summary: reviewSummary,
      });
      appendAuditLog(`${isStage2OpsView ? "Stage2 진입 근거 검토" : "Stage3 케이스 리뷰"} 완료: ${checklistSummary || "체크 없음"} · ${stage3ReviewDraft.strategyMemo}`);
      setStage3LatestRiskReview({
        at: now,
        memo: stage3ReviewDraft.strategyMemo,
        nextAction: isStage2OpsView ? "UPDATE_PLAN" : "RECOMMEND_DIFF",
      });
      toast.success(isStage2OpsView ? "STEP1 근거 검토가 저장되었습니다." : "STEP1 리뷰가 저장되었습니다.");
      if (isStage2OpsView) {
        setStage3TaskModalStep("CONTACT_EXECUTION");
      } else {
        setStage3TaskModalStep("CONTACT_EXECUTION");
      }
      return;
    }

    if (stage3TaskModalStep === "CONTACT_EXECUTION") {
      if (isStage2OpsView) {
        const step2Errors = buildStage2ValidationErrors(
          stage2EffectiveTests,
          stage2PlanRouteDraft as Stage2PlanRoute,
          stage2PlanRequiredDraft as Stage2PlanRequiredDraft,
        );
        if (stage2ManualEditEnabled && stage2ManualEditReason.trim().length < 5) {
          step2Errors.manualEditReason = "수동 수정 사유를 5자 이상 입력하세요.";
        }
        if (applyStage2ValidationErrors(step2Errors)) {
          toast.error("STEP2 누락/오류 필드를 먼저 보완해 주세요.");
          return;
        }
        const saveOk = saveStage2TestInputs();
        if (!saveOk) return;
        const autoPlanConfirmed = !stage2Step1Reviewed;
        setDetail((prev) => {
          if (!prev.stage3) return prev;
          return {
            ...prev,
            stage3: {
              ...prev.stage3,
              riskReviewedAt: prev.stage3.riskReviewedAt ?? now,
              diffPathStatus: "SCHEDULED",
            },
          };
        });
        if (autoPlanConfirmed) {
          const autoSummary = `STEP2 반영 기반 자동 계획 확정 · 경로 ${stage2PlanRouteDraft === "HOSPITAL_REFERRAL" ? "협약병원 의뢰" : "센터 직접 수행"}`;
          appendTimeline({
            type: "STAGE2_PLAN_CONFIRMED",
            at: now,
            by: detail.header.assigneeName,
            summary: autoSummary,
          });
          appendAuditLog(`STAGE2_PLAN_CONFIRMED(AUTO): ${autoSummary}`);
        }
        const summary = `필수 검사 입력 완료 (${countStage2CompletedTests(stage2EffectiveTests, stage2Route)}/${stage2RequiredTestCount})`;
        appendTimeline({
          type: "STAGE2_RESULTS_RECORDED",
          at: now,
          by: detail.header.assigneeName,
          summary,
        });
        appendAuditLog(`STAGE2_RESULTS_RECORDED: ${summary}`);
        setStage2FieldErrors({});
        toast.success("STEP2 검사 결과 입력이 완료되었습니다.");
        setStage3TaskModalStep("RESPONSE_HANDLING");
        return;
      }
      if (stage3PendingApprovalCount > 0) {
        toast.error("승인 대기 권고를 먼저 처리해 주세요.");
        return;
      }
      const step2Errors: Stage3TaskFieldErrors = {};
      if (!callMemo.trim() && !stage3Step2Flow.consultStarted) {
        step2Errors.step2CallRecord = "전화 상담 기록(메모 또는 상담 시작)이 필요합니다.";
      }
      if (!stage3DiffDraft.preferredHospital.trim()) {
        step2Errors.step2Hospital = "병원/기관 정보를 입력해 주세요.";
      }
      if (stage3ReviewDraft.diffNeeded && !stage3DiffDraft.testBiomarker && !stage3DiffDraft.testBrainImaging && !stage3DiffDraft.testOther) {
        step2Errors.step2TestSelection = "검사 항목을 최소 1개 선택해 주세요.";
      }
      if (!stage3DiffDraft.bookingAt) {
        step2Errors.step2BookingAt = "예약 일시를 입력해 주세요.";
      }
      if (!stage3Step2Flow.bookingConfirmed) {
        step2Errors.step2BookingAt = "예약 확정 패키지를 먼저 실행해 주세요.";
      }
      if (stage3ReviewDraft.diffNeeded) {
        if (!stage3DiffDraft.resultPerformedAt) {
          step2Errors.step2PerformedAt = "검사 수행 일시를 입력해 주세요.";
        }
        if (!stage3DiffDraft.biomarkerResultText?.trim()) {
          step2Errors.step2BiomarkerResult = "바이오마커 결과를 입력해 주세요.";
        }
        if (!stage3DiffDraft.imagingResultText?.trim()) {
          step2Errors.step2ImagingResult = "뇌영상 결과를 입력해 주세요.";
        }
        if (!stage3DiffDraft.resultSummary.trim()) {
          step2Errors.step2ResultSummary = "결과 요약을 입력해 주세요.";
        }
      }
      if (Object.keys(step2Errors).length > 0) {
        if (
          stage3ReviewDraft.diffNeeded &&
          (step2Errors.step2PerformedAt ||
            step2Errors.step2BiomarkerResult ||
            step2Errors.step2ImagingResult ||
            step2Errors.step2ResultSummary)
        ) {
          setStage3ShowResultCollection(true);
        }
        applyStage3ValidationErrors("CONTACT_EXECUTION", step2Errors);
        toast.error("STEP2 필수 입력을 먼저 완료해 주세요.");
        return;
      }
      setStage3FieldErrorsByStep((prev) => ({ ...prev, CONTACT_EXECUTION: {} }));

      if (!stage3DiffReadyForRisk) {
        toast.error(
          isStage2OpsView
            ? "신경심리검사 경로를 예약 또는 결과수신 상태로 만들어야 STEP3로 이동할 수 있습니다."
            : "검사 결과 반영 후에만 STEP3(위험 예측/추적)를 진행할 수 있습니다.",
        );
        return;
      }
      appendAuditLog(`${isStage2OpsView ? "신경심리검사" : "감별경로"} 단계 완료 확인: ${detail.stage3.diffPathStatus}`);
      toast.success(isStage2OpsView ? "STEP2 신경심리검사 단계 완료 처리되었습니다." : "STEP2 완료 처리되었습니다.");
      moveStage3TaskStep(1);
      return;
    }

    if (stage3TaskModalStep === "RESPONSE_HANDLING") {
      if (isStage2OpsView) {
        const step3Errors = buildStage2ValidationErrors(
          stage2EffectiveTests,
          stage2PlanRouteDraft as Stage2PlanRoute,
          stage2PlanRequiredDraft as Stage2PlanRequiredDraft,
          {
            rationale: stage2RationaleDraft,
            recommendedLabel: stage2ModelRecommendedLabel,
            selectedLabel: stage2ClassificationDraft,
            overrideReason: stage2ClassificationOverrideReason,
          },
        );
        if (applyStage2ValidationErrors(step3Errors)) {
          toast.error("STEP3 분류 확정 조건을 확인해 주세요.");
          return;
        }
        if (!stage2CanConfirm) {
          toast.error("분류 확정 요건이 부족합니다.");
          return;
        }
        setDetail((prev) => {
          if (!prev.stage3) return prev;
          return {
            ...prev,
            stage3: {
              ...prev.stage3,
              reevalStatus: "SCHEDULED",
            },
          };
        });
        confirmStage2Classification();
        const summary = `분류 확정 ${stage2ClassificationDraft}${stage2ClassificationDraft === "MCI" ? `(${stage2DraftMciStage ?? "-"})` : ""}`;
        appendTimeline({
          type: "STAGE2_CLASS_CONFIRMED",
          at: now,
          by: detail.header.assigneeName,
          summary,
        });
        appendAuditLog(`STAGE2_CLASS_CONFIRMED: ${summary}`);
        setStage2FieldErrors({});
        toast.success("STEP3 분류 확정이 완료되었습니다.");
        setStage3TaskModalStep("FOLLOW_UP");
        return;
      }
      if (!stage3DiffReadyForRisk) {
        toast.error(isStage2OpsView ? "STEP2 완료 후 임상평가 기록을 완료해 주세요." : "감별경로 예약/완료 후 위험 추적 기록을 완료해 주세요.");
        return;
      }
      if (!stage3RiskReviewDraft.memo.trim()) {
        toast.error(isStage2OpsView ? "임상평가(MMSE/CDR) 결과 메모를 입력해야 완료할 수 있습니다." : "추세 검토 메모를 입력해야 완료할 수 있습니다.");
        return;
      }
      const summary = isStage2OpsView
        ? `임상평가 결과 메모: ${stage3RiskReviewDraft.memo.slice(0, 120)}`
        : `추세 검토 메모: ${stage3RiskReviewDraft.memo.slice(0, 120)} · 다음 액션: ${STAGE3_RISK_NEXT_ACTION_LABELS[stage3RiskReviewDraft.nextAction]}`;
      handleStage3RiskReview({
        summary,
        nextAction: isStage2OpsView ? "UPDATE_PLAN" : stage3RiskReviewDraft.nextAction,
        silentToast: true,
      });
      toast.success(isStage2OpsView ? "STEP3 임상평가 기록이 저장되었습니다." : "STEP3 위험 추적 검토가 저장되었습니다.");
      moveStage3TaskStep(1);
      return;
    }

    if (isStage2OpsView) {
      if (!stage2Step4Selectable) {
        toast.error("STEP3 분류 확정을 먼저 완료해 주세요.");
        return;
      }
      const step4Errors = buildStage2ValidationErrors(
        stage2EffectiveTests,
        stage2PlanRouteDraft as Stage2PlanRoute,
        stage2PlanRequiredDraft as Stage2PlanRequiredDraft,
        {
          skipTestChecks: true,
          requireNextStep: true,
          hasNextStep: Boolean(stage2Diagnosis.nextStep),
        },
      );
      if (applyStage2ValidationErrors(step4Errors)) {
        toast.error("STEP4에서 다음 단계를 선택해 주세요.");
        return;
      }
      setDetail((prev) => {
        if (!prev.stage3) return prev;
        return {
          ...prev,
          stage3: {
            ...prev.stage3,
            planUpdatedAt: now,
            headerMeta: {
              ...prev.stage3.headerMeta,
              planStatus: "ACTIVE",
              opsStatus: stage2Diagnosis.nextStep === "FOLLOWUP_2Y" ? "TRACKING" : "LINKAGE_PENDING",
              nextTrackingContactAt: stage3TrackingPlanDraft.nextTrackingAt ?? prev.stage3.headerMeta.nextTrackingContactAt,
            },
          },
        };
      });
      const nextStepSummary =
        stage2Diagnosis.nextStep === "FOLLOWUP_2Y"
          ? "정상 추적(2년 후 선별)"
          : stage2Diagnosis.nextStep === "STAGE3"
            ? "MCI 케이스 Stage3 진입"
            : "치매 감별검사 경로";
      appendTimeline({
        type: "STAGE2_NEXT_STEP_SET",
        at: now,
        by: detail.header.assigneeName,
        summary: nextStepSummary,
      });
      appendAuditLog(`STAGE2_NEXT_STEP_SET: ${nextStepSummary}`);
      setStage2FieldErrors({});
      toast.success("STEP4 다음 단계 결정이 완료되었습니다.");
      closeStage3TaskModal();
      return;
    }

    if (!stage3HasProgramExecution) {
      toast.error("정밀관리 항목을 최소 1건 선택하고 실행 필드를 저장해 주세요.");
      return;
    }
    if (!stage3TrackingPlanDraft.nextTrackingAt) {
      toast.error("다음 추적 일정을 지정해야 완료할 수 있습니다.");
      return;
    }

    setDetail((prev) => {
      if (!prev.stage3) return prev;
      return {
        ...prev,
        stage3: {
          ...prev.stage3,
          planUpdatedAt: now,
          headerMeta: {
            ...prev.stage3.headerMeta,
            planStatus: "ACTIVE",
            opsStatus: "TRACKING",
            nextTrackingContactAt: stage3TrackingPlanDraft.nextTrackingAt,
          },
        },
      };
    });
    appendTimeline({
      type: "PLAN_UPDATED",
      at: now,
      by: detail.header.assigneeName,
      summary: "정밀관리 실행 기록으로 플랜을 업데이트했습니다.",
    });
    appendTimeline({
      type: "NEXT_TRACKING_SET",
      at: now,
      by: detail.header.assigneeName,
      nextAt: stage3TrackingPlanDraft.nextTrackingAt,
      summary: `리마인더 D-${stage3TrackingPlanDraft.reminderDaysBefore} / ${stage3TrackingPlanDraft.reminderTime} · 재시도 ${stage3TrackingPlanDraft.retryCount}회`,
    });
    appendAuditLog(
      `Stage3 관리 제공(프로그램·연계) 완료: 다음 추적 ${formatDateTime(stage3TrackingPlanDraft.nextTrackingAt)} · 리마인더 D-${stage3TrackingPlanDraft.reminderDaysBefore}`,
    );
    toast.success("STEP4 관리 제공(프로그램·연계)이 완료되었습니다.");
    closeStage3TaskModal();
  }, [
    closeStage3TaskModal,
    detail.header.assigneeName,
    detail.stage3,
    handleStage3RiskReview,
    moveStage3TaskStep,
    stage3DiffReadyForRisk,
    stage3HasProgramExecution,
    stage3PendingApprovalCount,
    stage3ReviewDraft.caregiverNeeded,
    stage3ReviewDraft.consentConfirmed,
    stage3ReviewDraft.diffDecisionSet,
    stage3ReviewDraft.diffNeeded,
    stage3ReviewDraft.priority,
    stage3ReviewDraft.resultLinkedChecked,
    stage3ReviewDraft.sensitiveHistory,
    stage3ReviewDraft.strategyMemo,
    stage3ReviewDraft.diffDecisionReason,
    stage3RiskReviewDraft.memo,
    stage3RiskReviewDraft.nextAction,
    stage3TaskModalStep,
    stage3TrackingPlanDraft.nextTrackingAt,
    stage3TrackingPlanDraft.reminderDaysBefore,
    stage3TrackingPlanDraft.reminderTime,
    stage3TrackingPlanDraft.retryCount,
    stage3DiffDraft.bookingAt,
    stage3DiffDraft.preferredHospital,
    stage3DiffDraft.testBiomarker,
    stage3DiffDraft.testBrainImaging,
    stage3DiffDraft.testOther,
    stage3DiffDraft.resultPerformedAt,
    stage3DiffDraft.resultSummary,
    stage3DiffDraft.biomarkerResultText,
    stage3DiffDraft.imagingResultText,
    stage3Step2Flow.bookingConfirmed,
    stage3Step2Flow.consultStarted,
    stage2CanConfirm,
    stage2ClassificationDraft,
    stage2ClassificationOverrideReason,
    stage2Diagnosis,
    stage2DraftMciStage,
    stage2EffectiveTests,
    stage2HospitalDraft,
    stage2ManualEditEnabled,
    stage2ManualEditReason,
    stage2ModelRecommendedLabel,
    stage2PlanRequiredDraft,
    stage2PlanRouteDraft,
    stage2Route,
    stage2ResultMissingCount,
    stage2ScheduleDraft,
    stage2Step1Reviewed,
    stage2Step4Selectable,
    stage2RequiredTestCount,
    applyStage2ValidationErrors,
    applyStage3ValidationErrors,
    confirmStage2Classification,
    isStage2OpsView,
    saveStage2TestInputs,
    callMemo,
  ]);

  const handleStage1TaskComplete = useCallback(async () => {
    if (!activeStage1Modal) return;

    const now = nowIso();
    if (activeStage1Modal === "PRECHECK") {
      const requiredGates = detail.policyGates.filter((gate) => gate.key !== "GUARDIAN_OPTIONAL");
      const failedRequiredGates = requiredGates.filter((gate) => gate.status === "FAIL");
      const unknownRequiredGates = requiredGates.filter((gate) => gate.status === "UNKNOWN");
      if (failedRequiredGates.length > 0) {
        toast.error("필수 사전 조건이 남아 있어 완료 처리할 수 없습니다.");
        return;
      }
      if (unknownRequiredGates.length > 0) {
        toast("확인 필요 항목이 남아 있지만 운영 기록 기준으로 다음 단계 진행을 허용합니다.");
      }
      setDetail((prev) => {
        const nextPreTriage =
          prev.preTriageResult ??
          applyContactModeHint(
            buildPreTriageResult(prev.preTriageInput),
            prev.contactExecutor === "AGENT_SEND_ONLY" ? "AGENT" : "HUMAN",
          );
        const nextEffectiveStrategy = prev.header.effectiveStrategy ?? nextPreTriage.strategy;
        const nextContactStrategy =
          prev.header.contactStrategy === "MANUAL_OVERRIDE" ? "MANUAL_OVERRIDE" : nextPreTriage.strategy;
        return {
          ...prev,
          header: {
            ...prev.header,
            contactStrategy: nextContactStrategy,
            effectiveStrategy: nextEffectiveStrategy,
          },
          preTriageResult: nextPreTriage,
          contactFlowSteps: buildContactFlowSteps(prev.contactExecution, nextPreTriage, prev.linkageStatus, mode),
        };
      });

      appendTimeline({
        type: "MESSAGE_SENT",
        at: now,
        summary: "STAGE1_GATE_DONE · 사전 조건 확인 완료",
        by: detail.header.assigneeName,
      });
      appendAuditLog("STAGE1_GATE_DONE: 사전 조건 확인 완료");
      toast.success("STEP1 완료 처리되었습니다.");
      setStage1ModalStep("CONTACT_EXECUTION");
      return;
    }

    if (activeStage1Modal === "CONTACT_EXECUTION") {
      if (detail.contactExecution.status === "NOT_STARTED") {
        toast.error("접촉 실행 기록이 없어 완료 처리할 수 없습니다.");
        return;
      }
      appendTimeline({
        type: "MESSAGE_SENT",
        at: now,
        summary: "STAGE1_CONTACT_ATTEMPT · 접촉 실행 완료",
        by: detail.header.assigneeName,
      });
      appendAuditLog("STAGE1_CONTACT_ATTEMPT: 접촉 실행 완료");
      toast.success("STEP2 완료 처리되었습니다.");
      setStage1ModalStep("RESPONSE_HANDLING");
      return;
    }

    if (activeStage1Modal === "RESPONSE_HANDLING") {
      const hasResponseRecorded = Boolean(detail.contactExecution.lastOutcomeCode || detail.contactExecution.lastResponseAt);
      if (!hasResponseRecorded) {
        toast.error("응답 결과를 먼저 저장해야 완료 처리할 수 있습니다.");
        return;
      }
      appendTimeline({
        type: "MESSAGE_SENT",
        at: now,
        summary: `STAGE1_RESPONSE_RECORDED · ${detail.contactExecution.lastOutcomeCode ? OUTCOME_LABELS[detail.contactExecution.lastOutcomeCode].label : "응답 결과"} 기록`,
        by: detail.header.assigneeName,
      });
      appendAuditLog("STAGE1_RESPONSE_RECORDED: 응답 결과 저장 완료");
      toast.success("STEP3 완료 처리되었습니다.");
      setStage1ModalStep("FOLLOW_UP");
      return;
    }

    const saved = handleSaveFollowUpDecision();
    if (!saved) return;
    appendTimeline({
      type: "MESSAGE_SENT",
      at: now,
      summary: "STAGE1_DECISION_DONE · 후속 결정 완료",
      by: detail.header.assigneeName,
    });
    appendAuditLog("STAGE1_DECISION_DONE: 후속 결정 완료");
    toast.success("STEP4 완료 처리되었습니다.");
    closeStage1Modal();
  }, [
    activeStage1Modal,
    appendAuditLog,
    closeStage1Modal,
    detail.contactExecution.lastOutcomeCode,
    detail.contactExecution.lastResponseAt,
    detail.contactExecution.status,
    detail.header.assigneeName,
    detail.policyGates,
    mode,
    handleSaveFollowUpDecision,
    setStage1ModalStep,
  ]);

  const handleFlowAction = useCallback(
    (action: Stage1FlowAction) => {
      const modal = STAGE1_STEP_MODAL_MAP[action];
      openStage1FlowModal(modal);
    },
    [openStage1FlowModal]
  );

  const handleRetryCalendarFailure = useCallback(
    async (idempotencyKey: string) => {
      const result = await retryCalendarFailure(idempotencyKey);
      if (!result.ok) {
        toast.error("캘린더 등록 재시도에 실패했습니다.");
        return;
      }

      const recovered = calendarFailures.find((entry) => entry.idempotencyKey === idempotencyKey);
      if (recovered) {
        appendTimeline({
          type: "CALENDAR_SYNC",
          at: nowIso(),
          status: "SUCCESS",
          eventType: recovered.eventType,
          title: recovered.title,
          scheduledAt: recovered.scheduledAt,
          idempotencyKey: recovered.idempotencyKey,
          by: detail.header.assigneeName,
        });
        appendAuditLog(`캘린더 등록 재시도 성공: ${recovered.title}`);
      }
      toast.success("캘린더 일정이 등록되었습니다.");
    },
    [appendAuditLog, calendarFailures, detail.header.assigneeName, retryCalendarFailure]
  );

  useEffect(() => {
    const summaryMissingCount = mode === "stage2" ? stage2MissingRequirements.length : missingCount;
    const summaryWarningCount = mode === "stage2" ? Math.max(0, 4 - stage2CompletedCount) : warningCount;
    const stage2OpsDelayRiskPct =
      mode === "stage3" && isStage2OpsView
        ? Math.max(
            0,
            Math.min(
              100,
              Math.round(
                detail.header.sla.level === "OVERDUE"
                  ? 76
                  : detail.header.sla.level === "DUE_SOON"
                    ? 58
                    : 32 + Math.max(0, summaryMissingCount * 4 + summaryWarningCount * 3),
              ),
            ),
          )
        : undefined;
    const stage2OpsRiskLabel: Stage3RiskSummary["risk2y_label"] =
      stage2OpsDelayRiskPct == null ? "MID" : stage2OpsDelayRiskPct >= 70 ? "HIGH" : stage2OpsDelayRiskPct >= 45 ? "MID" : "LOW";
    const stage2OpsTrend: Stage3RiskSummary["trend"] =
      stage2OpsDelayRiskPct == null
        ? "FLAT"
        : stage2OpsDelayRiskPct >= 70
          ? "UP"
          : stage2OpsDelayRiskPct >= 45
            ? "VOLATILE"
            : "DOWN";

    onHeaderSummaryChange?.({
      contactMode: strategyBadge,
      effectiveMode: effectiveStrategy,
      slaLevel: detail.header.sla.level,
      qualityScore: detail.header.dataQuality.score,
      missingCount: summaryMissingCount,
      warningCount: summaryWarningCount,
      lastUpdatedAt: detail.timeline[0]?.at,
      nextActionLabel: mode === "stage2" ? stage2NextActionLabel : undefined,
      stage2Meta:
        mode === "stage2" || isStage2OpsView
          ? {
              diagnosisStatus: stage2Diagnosis.status,
              completionPct: stage2CompletionPct,
              requiredDataPct: stage2RequiredDataPct,
              completedCount: stage2CompletedCount,
              classificationLabel: stage2ModelAvailable ? stage2CurrentLabel : "결과대기",
              modelAvailable: stage2ModelAvailable,
              missingEvidence: stage2GateMissing,
              mciStage: stage2ModelAvailable && stage2CurrentLabel === "MCI" ? stage2ResolvedMciStage : undefined,
              stage3EntryNeeded: stage2Stage3EntryNeeded,
              enteredAt: stage2EnteredAt,
              targetAt: stage2TargetAt,
              delayDays: stage2TargetDelayDays,
              nextActionLabel: stage2NextActionLabel,
            }
          : undefined,
      stage3Meta:
        mode === "stage3" && detail.stage3
          ? {
              opsStatus: detail.stage3.headerMeta.opsStatus,
              stage3Type: stage3View?.source.profile?.stage3Type,
              originStage2Result: stage3View?.source.profile?.originStage2Result,
              risk2yNowPct: isStage2OpsView
                ? stage2OpsDelayRiskPct ?? 0
                : stage3ModelAvailable
                  ? stage3View?.display.riskBadge.kind === "ready"
                    ? stage3View.display.riskBadge.riskPct
                    : toPercentValue(detail.stage3.transitionRisk.risk2y_now)
                  : undefined,
              risk2yLabel: isStage2OpsView
                ? stage2OpsRiskLabel
                : stage3ModelAvailable
                  ? deriveStage3RiskLabel(detail.stage3.transitionRisk.risk2y_now)
                  : undefined,
              modelAvailable: isStage2OpsView ? stage2ModelAvailable : stage3ModelAvailable,
              missingEvidence: isStage2OpsView ? stage2GateMissing : stage3GateMissing,
              trend: isStage2OpsView ? stage2OpsTrend : detail.stage3.transitionRisk.trend,
              modelVersion: isStage2OpsView ? "stage2-ops-v1.0" : detail.stage3.transitionRisk.modelVersion,
              riskUpdatedAt: detail.stage3.transitionRisk.updatedAt,
              nextReevalAt: detail.stage3.headerMeta.nextReevalAt,
              nextTrackingContactAt: detail.stage3.headerMeta.nextTrackingContactAt,
              nextProgramAt: detail.stage3.headerMeta.nextProgramAt,
              diffPathStatus: detail.stage3.diffPathStatus,
              planStatus: detail.stage3.headerMeta.planStatus,
              trackingCycleDays: detail.stage3.headerMeta.trackingCycleDays,
              churnRisk: isStage2OpsView
                ? detail.header.sla.level === "OVERDUE"
                  ? "HIGH"
                  : detail.header.sla.level === "DUE_SOON"
                    ? "MID"
                    : "LOW"
                : detail.stage3.headerMeta.churnRisk,
            }
          : undefined,
    });
  }, [
    detail.header.sla.level,
    detail.header.dataQuality.score,
    detail.stage3,
    detail.timeline,
    effectiveStrategy,
    missingCount,
    mode,
    onHeaderSummaryChange,
    stage2CompletedCount,
    stage2CompletionPct,
    stage2CurrentLabel,
    stage2ResolvedMciStage,
    stage2Diagnosis.status,
    stage2EnteredAt,
    stage2MissingRequirements.length,
    stage2NextActionLabel,
    stage2Stage3EntryNeeded,
    stage2TargetAt,
    stage2TargetDelayDays,
    stage2ModelAvailable,
    stage3View,
    stage3ModelAvailable,
    stage2GateMissing,
    stage3GateMissing,
    strategyBadge,
    warningCount,
    isStage2OpsView,
  ]);

  useEffect(() => {
    if (!onPrimaryActionChange) return;
    if (mode !== "stage3") {
      onPrimaryActionChange(null);
      return;
    }
    onPrimaryActionChange(() => runStage3PrimaryAction());
  }, [mode, onPrimaryActionChange, runStage3PrimaryAction]);

  useEffect(() => {
    if (!activeProgramDraft) return;
    setStage3ProgramExecutionDraft({
      owner: activeProgramDraft.execution?.owner ?? detail.header.assigneeName,
      dueDate: activeProgramDraft.execution?.dueDate,
      institution: activeProgramDraft.execution?.institution,
      method: activeProgramDraft.execution?.method ?? "안내",
      status: activeProgramDraft.execution?.status ?? "PLANNED",
      note: activeProgramDraft.execution?.note ?? "",
    });
  }, [activeProgramDraft, detail.header.assigneeName]);

  if (isStage2Mode) {
    const stage2StepItems = [
      {
        key: "STEP 1",
        title: "검사 수행 관리",
        status: stage2CaseWaitingForKickoff
          ? "PENDING"
          : detail.reservationInfo?.scheduledAt
            ? "DONE"
            : detail.linkageStatus !== "NOT_CREATED"
              ? "IN_PROGRESS"
              : "PENDING",
        reason: stage2CaseWaitingForKickoff
          ? "Step1 검토 대기"
          : detail.reservationInfo?.scheduledAt
            ? `예약 ${formatDateTime(detail.reservationInfo.scheduledAt)}`
            : "예약/수행 상태 점검 필요",
      },
      {
        key: "STEP 2",
        title: "검사 결과 입력",
        status: stage2CaseWaitingForKickoff
          ? "PENDING"
          : stage2CompletedCount >= stage2RequiredTestCount
            ? "DONE"
            : stage2CompletedCount > 0
              ? "IN_PROGRESS"
              : "PENDING",
        reason: stage2CaseWaitingForKickoff
          ? "Step1 완료 후 진행 가능"
          : `필수 ${stage2RequiredTestCount}항목 중 ${stage2CompletedCount}개 완료`,
      },
      {
        key: "STEP 3",
        title: "분류 확정",
        status: stage2CaseWaitingForKickoff ? "BLOCKED" : stage2ClassificationConfirmed ? "DONE" : stage2CanConfirm ? "IN_PROGRESS" : "BLOCKED",
        reason: stage2CaseWaitingForKickoff
          ? "Step2 완료 후 진행 가능"
          : stage2ClassificationConfirmed
            ? "분류 확정 완료"
            : stage2CanConfirm
              ? "확정 가능"
              : "요건 미충족",
      },
      {
        key: "STEP 4",
        title: "다음 단계 결정",
        status: stage2CaseWaitingForKickoff
          ? "PENDING"
          : stage2Diagnosis.nextStep
            ? "DONE"
            : stage2ClassificationConfirmed
              ? "IN_PROGRESS"
              : "PENDING",
        reason: stage2CaseWaitingForKickoff ? "Step3 완료 후 진행" : stage2Diagnosis.nextStep ? `선택 ${stage2Diagnosis.nextStep}` : "분류 확정 후 진행",
      },
    ] as const;

    const testRows = [
      {
        label: "전문의 진찰",
        done: Boolean(stage2Diagnosis.tests.specialist),
        sub: stage2Diagnosis.tests.specialist ? "소견 확인 완료" : "소견 확인 필요",
      },
      {
        label: "MMSE",
        done: stage2Route === "CENTER" ? true : typeof stage2Diagnosis.tests.mmse === "number",
        sub:
          stage2Route === "CENTER" && typeof stage2Diagnosis.tests.mmse !== "number"
            ? "센터 직접 수행 경로: 선택 입력"
            : typeof stage2Diagnosis.tests.mmse === "number"
              ? `점수 ${stage2Diagnosis.tests.mmse}`
              : "미입력",
      },
      {
        label: "CDR or GDS",
        done: typeof stage2Diagnosis.tests.cdr === "number",
        sub: typeof stage2Diagnosis.tests.cdr === "number" ? `점수 ${stage2Diagnosis.tests.cdr}` : "미입력",
      },
      {
        label: "신경인지검사",
        done: Boolean(stage2Diagnosis.tests.neuroCognitiveType),
        sub: stage2Diagnosis.tests.neuroCognitiveType ?? "유형 미선택",
      },
    ];

    return (
      <div className="space-y-5">
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
          <aside className="space-y-4 xl:col-span-3">
            <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <h3 className="text-sm font-bold text-slate-900">Stage1 요약 카드</h3>
              <div className="mt-3 space-y-2 text-xs">
                <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
                  <p className="text-[11px] text-slate-500">선별 결과</p>
                  <p className="mt-1 font-semibold text-slate-900">
                    {detail.riskEvidence.topFactors[0]?.title ?? "선별 근거 확인 필요"}
                  </p>
                </div>
                <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
                  <p className="text-[11px] text-slate-500">우선도 점수</p>
                  <p className="mt-1 font-semibold text-slate-900">{modelPriorityValue}점</p>
                </div>
                <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
                  <p className="text-[11px] text-slate-500">인지저하 여부</p>
                  <p className="mt-1 font-semibold text-slate-900">{stage2CurrentLabel === "정상" ? "아님" : "확인"}</p>
                </div>
              </div>
            </section>

            <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <h3 className="text-sm font-bold text-slate-900">Stage2 검사 구성 Scorecard</h3>
              <div className="mt-3 space-y-2 text-xs">
                {testRows.map((row) => (
                  <article key={row.label} className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-semibold text-slate-900">{row.label}</p>
                      <span
                        className={cn(
                          "rounded-md border px-2 py-0.5 text-[10px] font-semibold",
                          row.done ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-amber-200 bg-amber-50 text-amber-700",
                        )}
                      >
                        {row.done ? "DONE" : "MISSING"}
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] text-slate-600">{row.sub}</p>
                  </article>
                ))}
                <p className="rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] text-slate-700">
                  완료율 {stage2CompletedCount}/{stage2RequiredTestCount} ({stage2CompletionPct}%)
                </p>
              </div>
            </section>

            <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <h3 className="text-sm font-bold text-slate-900">Stage2 분류 결과 카드</h3>
              {stage2ModelAvailable ? (
                <>
                  <p className="mt-3 text-xs text-slate-500">결과 라벨</p>
                  <p className="mt-1 text-lg font-bold text-slate-900">
                    {stage2DisplayLabel ?? "미확정"}
                    {stage2DisplayLabel === "MCI" && stage2DisplayMciStage ? ` (${stage2DisplayMciStage})` : ""}
                  </p>
                  <div className="mt-3 space-y-2 text-xs">
                    {([
                      { key: "NORMAL", label: "NORMAL", pct: toPercentUnknown(stage2ResolvedProbs?.NORMAL) ?? 0, tone: "bg-emerald-500" },
                      { key: "MCI", label: "MCI", pct: toPercentUnknown(stage2ResolvedProbs?.MCI) ?? 0, tone: "bg-blue-500" },
                      { key: "AD", label: "AD", pct: toPercentUnknown(stage2ResolvedProbs?.AD) ?? 0, tone: "bg-rose-500" },
                    ] as const).map((entry) => (
                      <div key={entry.key}>
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-semibold text-slate-700">{entry.label}</span>
                          <span className="text-[11px] text-slate-600">{entry.pct}%</span>
                        </div>
                        <div className="mt-1 h-2 rounded-full bg-slate-100">
                          <div className={cn("h-2 rounded-full", entry.tone)} style={{ width: `${entry.pct}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 rounded-md border border-slate-200 bg-slate-50 px-2 py-2 text-[11px] text-slate-700">
                    <p>신경심리검사 및 임상평가 기반 분류</p>
                    <p>운영 참고용 ANN 세분화 결과 포함</p>
                  </div>
                </>
              ) : (
                <div className="mt-3">
                  <ModelGateGuard stage={2} missing={stage2GateMissing} onOpenStep={focusStage2ResultInput} />
                </div>
              )}
            </section>
          </aside>

          <section className="space-y-4 xl:col-span-6">
            <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-900">Stage2 Step Workflow</h3>
                <span className="text-[11px] text-slate-500">
                  완료 {stage2StepItems.filter((step) => step.status === "DONE").length}/4
                </span>
              </div>
              <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
                {stage2StepItems.map((step) => (
                  <article key={step.key} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[11px] font-semibold text-slate-500">{step.key}</p>
                      <span
                        className={cn(
                          "rounded-md border px-2 py-0.5 text-[10px] font-semibold",
                          step.status === "DONE"
                            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                            : step.status === "IN_PROGRESS"
                              ? "border-blue-200 bg-blue-50 text-blue-700"
                              : step.status === "BLOCKED"
                                ? "border-rose-200 bg-rose-50 text-rose-700"
                                : "border-slate-200 bg-white text-slate-600",
                        )}
                      >
                        {step.status}
                      </span>
                    </div>
                    <p className="mt-1 text-sm font-bold text-slate-900">{step.title}</p>
                    <p className="mt-1 text-[11px] text-slate-600">{step.reason}</p>
                  </article>
                ))}
              </div>
            </section>

            <section id="stage2-step2-input" className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <h3 className="text-sm font-bold text-slate-900">STEP 2. 검사 결과 입력</h3>
              <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
                <label className="text-[11px] text-slate-600">
                  MMSE 점수
                  <input
                    value={stage2Diagnosis.tests.mmse ?? ""}
                    onChange={(event) =>
                      setStage2Diagnosis((prev) => ({
                        ...prev,
                        tests: {
                          ...prev.tests,
                          mmse: event.target.value === "" ? undefined : Number(event.target.value),
                        },
                      }))
                    }
                    className="mt-1 h-8 w-full rounded-md border border-gray-200 px-2 text-xs outline-none focus:border-blue-300"
                  />
                </label>
                <label className="text-[11px] text-slate-600">
                  CDR 점수
                  <input
                    value={stage2Diagnosis.tests.cdr ?? ""}
                    onChange={(event) =>
                      setStage2Diagnosis((prev) => ({
                        ...prev,
                        tests: {
                          ...prev.tests,
                          cdr: event.target.value === "" ? undefined : Number(event.target.value),
                        },
                      }))
                    }
                    className="mt-1 h-8 w-full rounded-md border border-gray-200 px-2 text-xs outline-none focus:border-blue-300"
                  />
                </label>
                <label className="text-[11px] text-slate-600">
                  신경인지검사
                  <select
                    value={stage2Diagnosis.tests.neuroCognitiveType ?? ""}
                    onChange={(event) =>
                      setStage2Diagnosis((prev) => ({
                        ...prev,
                        tests: {
                          ...prev.tests,
                          neuroCognitiveType:
                            (event.target.value as Stage2Diagnosis["tests"]["neuroCognitiveType"]) || undefined,
                        },
                      }))
                    }
                    className="mt-1 h-8 w-full rounded-md border border-gray-200 px-2 text-xs outline-none focus:border-blue-300"
                  >
                    <option value="">선택</option>
                    <option value="CERAD-K">CERAD-K</option>
                    <option value="SNSB-II">SNSB-II</option>
                    <option value="SNSB-C">SNSB-C</option>
                    <option value="LICA">LICA</option>
                  </select>
                </label>
                <label className="text-[11px] text-slate-600">
                  전문의 소견
                  <select
                    value={stage2Diagnosis.tests.specialist ? "DONE" : "MISSING"}
                    onChange={(event) =>
                      setStage2Diagnosis((prev) => ({
                        ...prev,
                        tests: {
                          ...prev.tests,
                          specialist: event.target.value === "DONE",
                        },
                      }))
                    }
                    className="mt-1 h-8 w-full rounded-md border border-gray-200 px-2 text-xs outline-none focus:border-blue-300"
                  >
                    <option value="MISSING">MISSING</option>
                    <option value="DONE">DONE</option>
                  </select>
                </label>
              </div>
              <button
                onClick={saveStage2TestInputs}
                className="mt-3 inline-flex items-center gap-1 rounded-md bg-[#163b6f] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#112f5a]"
              >
                <CheckCircle2 size={13} /> 결과 입력 반영
              </button>
            </section>

            <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <h3 className="text-sm font-bold text-slate-900">STEP 3. 분류 확정</h3>
              <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
                <label className="text-[11px] text-slate-600">
                  진단 결과 라벨
                  <select
                    value={stage2ClassificationDraft}
                    onChange={(event) => setStage2ClassificationDraft(event.target.value as Stage2ClassLabel)}
                    className="mt-1 h-8 w-full rounded-md border border-gray-200 px-2 text-xs outline-none focus:border-blue-300"
                  >
                    <option value="정상">정상</option>
                    <option value="MCI">MCI</option>
                    <option value="치매">치매</option>
                  </select>
                </label>
                <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] text-slate-700">
                  <p className="font-semibold">MCI 세분화(ANN)</p>
                  <p className="mt-1">{stage2ClassificationDraft === "MCI" ? stage2DraftMciStage ?? "산출 대기" : "-"}</p>
                </div>
              </div>
              {stage2ModelAvailable && stage2DraftProbs ? (
                <div className="mt-2 space-y-2 text-xs">
                  {([
                    { key: "NORMAL", label: "NORMAL", pct: toPercentUnknown(stage2DraftProbs.NORMAL) ?? 0, tone: "bg-emerald-500" },
                    { key: "MCI", label: "MCI", pct: toPercentUnknown(stage2DraftProbs.MCI) ?? 0, tone: "bg-blue-500" },
                    { key: "AD", label: "AD", pct: toPercentUnknown(stage2DraftProbs.AD) ?? 0, tone: "bg-rose-500" },
                  ] as const).map((entry) => (
                    <div key={entry.key}>
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-semibold text-slate-700">{entry.label}</span>
                        <span className="text-[11px] text-slate-600">{entry.pct}%</span>
                      </div>
                      <div className="mt-1 h-2 rounded-full bg-slate-100">
                        <div className={cn("h-2 rounded-full", entry.tone)} style={{ width: `${entry.pct}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mt-3">
                  <ModelGateGuard stage={2} missing={stage2GateMissing} onOpenStep={focusStage2ResultInput} />
                </div>
              )}
              <label className="mt-3 block text-[11px] text-slate-600">
                확정 근거 1줄(필수)
                <textarea
                  value={stage2RationaleDraft}
                  onChange={(event) => setStage2RationaleDraft(event.target.value)}
                  className="mt-1 h-20 w-full rounded-md border border-gray-200 px-2 py-1 text-xs outline-none focus:border-blue-300"
                />
              </label>
              <button
                onClick={confirmStage2Classification}
                disabled={!stage2CanConfirm}
                className="mt-3 inline-flex items-center gap-1 rounded-md bg-[#163b6f] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#112f5a] disabled:opacity-50"
              >
                <ShieldCheck size={13} /> 분류 확정
              </button>
              {!stage2CanConfirm ? (
                <div className="mt-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-800">
                  {stage2MissingRequirements.map((message) => (
                    <p key={message}>- {message}</p>
                  ))}
                </div>
              ) : null}
            </section>

            <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <h3 className="text-sm font-bold text-slate-900">STEP 4. 다음 단계 결정</h3>
              <p className="mt-2 text-[11px] text-slate-600">
                분류 확정 후에만 버튼이 활성화됩니다. 현재 라벨: {stage2ModelAvailable ? stage2CurrentLabel : "결과대기"}
                {stage2ModelAvailable && stage2CurrentLabel === "MCI" && stage2CurrentMciStage ? ` (${stage2CurrentMciStage})` : ""}
              </p>
              <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-3">
                <button
                  onClick={() => setStage2NextStep("FOLLOWUP_2Y", "정상 분류로 2년 후 선별검사 일정 생성")}
                  disabled={!stage2ClassificationConfirmed || stage2CurrentLabel !== "정상"}
                  className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1.5 text-[11px] font-semibold text-slate-700 hover:bg-white disabled:opacity-50"
                >
                  정상 → 2년 후 선별
                </button>
                <button
                  onClick={() => setStage2NextStep("STAGE3", "MCI/치매 분류로 Stage3 진입 준비")}
                  disabled={!stage2ClassificationConfirmed || !stage2NeedsStage3(stage2CurrentLabel)}
                  className="rounded-md border border-blue-200 bg-blue-50 px-2 py-1.5 text-[11px] font-semibold text-blue-700 hover:bg-blue-100 disabled:opacity-50"
                >
                  Stage3 진입
                </button>
                <button
                  onClick={() => setStage2NextStep("DIFF_PATH", "치매 분류로 감별검사 경로 활성화")}
                  disabled={!stage2ClassificationConfirmed || stage2CurrentLabel !== "치매"}
                  className="rounded-md border border-rose-200 bg-rose-50 px-2 py-1.5 text-[11px] font-semibold text-rose-700 hover:bg-rose-100 disabled:opacity-50"
                >
                  감별검사 경로
                </button>
              </div>
            </section>
          </section>

          <aside className="space-y-4 xl:col-span-3">
            <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <h3 className="text-sm font-bold text-slate-900">검사 예약 관리</h3>
              <div className="mt-3 space-y-2">
                <label className="text-[11px] text-slate-600">
                  병원 선택
                  <select
                    value={stage2HospitalDraft}
                    onChange={(event) => setStage2HospitalDraft(event.target.value)}
                    className="mt-1 h-8 w-full rounded-md border border-gray-200 px-2 text-xs outline-none focus:border-blue-300"
                  >
                    <option value="강남구 협력병원">강남구 협력병원</option>
                    <option value="서울의료원">서울의료원</option>
                    <option value="신경심리 전문클리닉">신경심리 전문클리닉</option>
                    <option value="기타 협력기관">기타 협력기관</option>
                  </select>
                </label>
                <label className="text-[11px] text-slate-600">
                  일정 등록
                  <input
                    type="datetime-local"
                    value={toDateTimeLocalValue(stage2ScheduleDraft)}
                    onChange={(event) => setStage2ScheduleDraft(fromDateTimeLocalValue(event.target.value) || stage2ScheduleDraft)}
                    className="mt-1 h-8 w-full rounded-md border border-gray-200 px-2 text-xs outline-none focus:border-blue-300"
                  />
                </label>
                <button
                  onClick={saveStage2Booking}
                  className="inline-flex w-full items-center justify-center gap-1 rounded-md bg-[#163b6f] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#112f5a]"
                >
                  <PhoneCall size={13} /> 일정 등록
                </button>
                <button
                  onClick={() => {
                    appendTimeline({
                      type: "CAL_EVENT_CREATED",
                      at: nowIso(),
                      scheduledAt: stage2ScheduleDraft,
                      summary: "Stage2 검사 일정 캘린더 등록",
                      by: detail.header.assigneeName,
                    });
                    appendAuditLog(`캘린더 생성: ${formatDateTime(stage2ScheduleDraft)}`);
                    toast.success("캘린더 등록 로그를 남겼습니다.");
                  }}
                  className="inline-flex w-full items-center justify-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-white"
                >
                  <Timer size={13} /> 캘린더 생성
                </button>
              </div>
            </section>

            <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <h3 className="text-sm font-bold text-slate-900">결과 입력 가이드</h3>
              <div className="mt-2 space-y-1 text-[11px] text-slate-600">
                <p>MMSE: 일반적으로 24점 이상은 정상 범위 참고값으로 사용합니다.</p>
                <p>CDR: 0(정상), 0.5(MCI 가능성), 1 이상(치매 가능성) 기준으로 검토합니다.</p>
              </div>
            </section>

            <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <h3 className="text-sm font-bold text-slate-900">ANN 세분화 설명 패널</h3>
              <div className="mt-2 space-y-1 text-[11px] text-slate-600">
                <p>경도인지장애는 치매 진행 골든타임으로 조기 대응이 중요합니다.</p>
                <p>연 10% 수준의 전환 가능성이 보고되어 추적 관리가 필요합니다.</p>
                <p>해마 위축/혈관성 요인은 세분화 판단 시 주요 참고 항목입니다.</p>
              </div>
            </section>
          </aside>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
          <ContactTimeline
            timeline={filteredTimeline}
            filter={timelineFilter}
            onFilterChange={setTimelineFilter}
            listClassName="max-h-[360px] overflow-y-auto pr-1"
            mode={mode}
            stage2OpsView={isStage2OpsView}
            stage3Type={resolvedStage3TypeForUi}
          />
          <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <h3 className="text-sm font-bold text-slate-900">감사 로그</h3>
            <div className="mt-3 max-h-[360px] space-y-2 overflow-y-auto pr-1">
              {auditLogs.length === 0 ? (
                <p className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] text-slate-500">
                  감사 로그가 없습니다.
                </p>
              ) : (
                auditLogs.map((log) => (
                  <article key={log.id} className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
                    <p className="text-[11px] text-slate-500">{log.at}</p>
                    <p className="text-xs font-semibold text-slate-800">{log.actor}</p>
                    <p className="text-[11px] text-slate-700">{log.message}</p>
                  </article>
                ))
              )}
            </div>
          </section>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <section className="space-y-4 xl:col-span-8">
          <Stage1ScorePanel
            scoreSummary={detail.scoreSummary}
            modelPriorityValue={modelPriorityValue}
            modelPriorityMeta={modelPriorityMeta}
            contactPriority={contactPriority}
            interventionLevel={detail.interventionLevel}
            stage3Risk={stage3RiskSummary}
            stage3DiffPathStatus={detail.stage3?.diffPathStatus}
            stage3RiskReviewedAt={detail.stage3?.riskReviewedAt}
            onStage3MarkRiskReviewed={handleStage3RiskReview}
            mode={mode}
            stage2OpsView={isStage2OpsView}
            stage2ResultLabel={stage2ResolvedLabel}
            stage2MciStage={stage2ResolvedMciStage}
            stage2Probs={stage2ResolvedProbs}
            stage2DiagnosisStatus={stage2Diagnosis.status}
            stage2CompletionPct={stage2CompletionPct}
            stage2RequiredDataPct={stage2RequiredDataPct}
            stage2NextDiagnosisAt={detail.stage3?.headerMeta.nextReevalAt}
            stage2QualityScore={detail.header.dataQuality.score}
            stage2WaitingCount={stage2BookingWaitingCount}
            stage2ResultMissingCount={stage2ResultMissingCount}
            stage2ClassificationConfirmed={stage2ClassificationConfirmed}
            stage2ModelAvailable={stage2ModelAvailable}
            stage3ModelAvailable={stage3ModelAvailable}
            stage3Type={resolvedStage3TypeForUi}
            stage2MissingEvidence={stage2GateMissing}
            stage3MissingEvidence={stage3GateMissing}
            onOpenStage2Input={focusStage2ResultInput}
            onOpenStage3Input={focusStage3ResultInput}
          />

          <ContactFlowPanel
            flowCards={stage1FlowCards}
            onAction={handleFlowAction}
            mode={mode}
            stage2OpsView={isStage2OpsView}
            opsLoopState={opsLoopState}
            storedOpsStatus={isStage3Mode ? detail.stage3?.headerMeta.opsStatus ?? ssotCase?.status : ssotCase?.status}
          />

          {!isStage3Mode ? (
            <ServiceOperationsBoard
              strategy={effectiveStrategy}
              strategyBadge={strategyBadge}
              contactExecutor={detail.contactExecutor}
              executionStatus={detail.contactExecution.status}
              lastSentAt={detail.contactExecution.lastSentAt}
              lastOutcome={detail.contactExecution.lastOutcomeCode}
              retryCount={detail.contactExecution.retryCount}
              linkageStatus={detail.linkageStatus}
              memoCount={auditLogs.length}
              lastContactAt={detail.contactExecution.lastResponseAt ?? detail.contactExecution.lastSentAt}
              timelineCount={detail.timeline.length}
              preTriage={detail.preTriageResult}
              riskGuardrails={detail.header.riskGuardrails}
              onOpenStrategyOverride={() => setStrategyOverrideOpen(true)}
              mode={mode}
            />
          ) : null}

          {!isStage3Mode ? (
            <>
              <div className="grid grid-cols-1 gap-3">
                <ContactExecutionLauncherCard
                  mode={mode}
                  stage2OpsView={isStage2OpsView}
                  contactExecutor={detail.contactExecutor}
                  executionStatus={detail.contactExecution.status}
                  strategy={effectiveStrategy}
                  lastSentAt={detail.contactExecution.lastSentAt}
                  sensitivityFlags={sensitivityFlags}
                  latestAgentLog={detail.agentExecutionLogs[0]}
                  selectedRecommendation={selectedRecommendation}
                  agentJob={agentJob}
                  gateStatus={agentGateStatus}
                  onSwitchExecutor={handleContactExecutorChange}
                  onOpen={() => openStage1FlowModal("CONTACT_EXECUTION")}
                  onRetryNow={retryAgentNow}
                  onScheduleRetry={scheduleAgentRetry}
                />
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <ResponseTriagePanel
                  expanded={responsePanelExpanded}
                  onToggle={() => setResponsePanelExpanded((prev) => !prev)}
                  executionStatus={detail.contactExecution.status}
                  lastSentAt={detail.contactExecution.lastSentAt}
                  lastSmsSentAt={detail.lastSmsSentAt}
                  assigneeName={detail.header.assigneeName}
                  reservation={detail.reservation}
                  showReservationSync={hasSmsReservationSignal}
                  autoFilledState={autoFilledOutcomeState}
                  onOpenReservationDetail={() => setReservationDetailOpen(true)}
                  selectedOutcomeCode={selectedOutcomeCode}
                  onSelectOutcomeCode={handleSelectOutcomeCode}
                  reasonTags={responseReasonTags}
                  onToggleReasonTag={handleToggleResponseReasonTag}
                  rejectReasonDraft={rejectReasonDraft}
                  onRejectReasonDraftChange={handleRejectReasonDraftChange}
                  noResponsePlanDraft={noResponsePlanDraft}
                  onNoResponsePlanDraftChange={handleNoResponsePlanDraftChange}
                  outcomeNote={outcomeNote}
                  onOutcomeNoteChange={handleOutcomeNoteChange}
                  isSaving={isOutcomeSaving}
                  submitError={outcomeSubmitError}
                  validationError={responseValidationError}
                  onClearError={clearSubmitError}
                  onReset={resetResponseTriageDraft}
                  onConfirm={confirmOutcomeTriage}
                  hasUnsavedChanges={responseDraftDirty}
                  lastSavedAt={responseLastSavedAt}
                  onOpenHandoffMemo={() => setHandoffMemoOpen(true)}
                  mode={mode}
                />

                <HandoffMemoGeneratorCard
                  expanded={handoffMemoOpen || Boolean(detail.contactExecution.handoffMemo)}
                  onToggle={() => setHandoffMemoOpen((prev) => !prev)}
                  memoText={handoffMemoText}
                  onMemoChange={setHandoffMemoText}
                  onSave={() => {
                    appendAuditLog(`인수인계 메모 저장: ${handoffMemoText.slice(0, 80)}...`);
                    toast.success("인수인계 메모가 저장되었습니다.");
                    setHandoffMemoOpen(false);
                  }}
                  mode={mode}
                />
              </div>

              <InterventionLevelPanel
                level={detail.interventionLevel}
                statusLabel={detail.header.statusLabel}
                guides={interventionGuides}
                onChangeLevel={openLevelChangeModal}
                onHold={() => openStatusReasonModal("보류")}
                onExclude={() => openStatusReasonModal("우선순위 제외")}
                mode={mode}
              />
            </>
          ) : (
            <>
              <section className="rounded-xl border border-indigo-200 bg-indigo-50 p-4 shadow-sm">
                <h3 className="text-sm font-bold text-indigo-900">다음 체크포인트</h3>
                <p className="mt-1 text-[11px] text-indigo-800">
                  {isStage2OpsView
                    ? "Step 카드의 작업 열기에서 근거검토/신경심리/임상평가/전문의 확정을 순차 기록합니다."
                    : "Step 카드의 작업 열기에서 감별경로/위험추적/정밀관리 실행을 순차 기록합니다. 최종 조치는 담당자 확인 후 진행합니다."}
                </p>
                <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
                  <span className="rounded-md border border-indigo-300 bg-white px-2 py-1">
                    {isStage2OpsView ? "다음 진단 일정" : "다음 재평가"} {formatDateTime(detail.stage3?.headerMeta.nextReevalAt)}
                  </span>
                  <span className="rounded-md border border-indigo-300 bg-white px-2 py-1">
                    {isStage2OpsView ? "진단 플랜" : "플랜"} {stage3PlanStatusLabel(detail.stage3?.headerMeta.planStatus ?? "ACTIVE")}
                  </span>
                  <span className="rounded-md border border-indigo-300 bg-white px-2 py-1">
                    {isStage2OpsView ? "결과 수신 목표" : "추적 주기"} {detail.stage3?.headerMeta.trackingCycleDays ?? 21}일
                  </span>
                </div>
              </section>

              <InterventionLevelPanel
                level={detail.interventionLevel}
                statusLabel={detail.header.statusLabel}
                guides={interventionGuides}
                onChangeLevel={openLevelChangeModal}
                onHold={() => openStatusReasonModal("보류")}
                onExclude={() => openStatusReasonModal("우선순위 제외")}
                mode={mode}
              />
            </>
          )}
        </section>

        <aside className="space-y-4 xl:col-span-4 xl:sticky xl:top-0 self-start">
          {isStage3Mode ? (
            <>
              <section className="rounded-xl border border-indigo-200 bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-bold text-slate-900">{isStage2OpsView ? "진단검사 진행 상태 요약" : "정밀검사 연계 상태 요약"}</h3>
                  <button
                    onClick={() => openStage1FlowModal("CONTACT_EXECUTION")}
                    className="rounded-md border border-indigo-200 bg-indigo-50 px-2 py-1 text-[11px] font-semibold text-indigo-700 hover:bg-indigo-100"
                  >
                    STEP2 작업 열기
                  </button>
                </div>
                <p className="mt-1 text-[11px] text-gray-500">
                  {isStage2OpsView ? "STEP2/3 상태" : "상태"} {detail.stage3?.diffPathStatus ?? "NONE"} · 승인 대기 {stage3PendingApprovalCount}건 ·{" "}
                  {isStage2OpsView ? "목표일" : "다음 재평가"} {formatDateTime(detail.stage3?.headerMeta.nextReevalAt)}
                </p>
                <p className="mt-2 text-[10px] text-indigo-700">
                  {isStage2OpsView
                    ? "운영 참고: 진단검사 경로 상태는 예약/의뢰 우선순위 신호이며 최종 실행은 담당자 확인 후 진행합니다."
                    : "운영 참고: 감별경로 상태는 권고/연계 우선순위 신호이며 최종 실행은 담당자 확인 후 진행합니다."}
                </p>
              </section>

              <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                <button
                  onClick={() => setStage3ContactPanelOpen((prev) => !prev)}
                  className="flex w-full items-center justify-between text-left"
                >
                  <span className="text-sm font-bold text-slate-900">
                    상담/문자 실행 ({isStage2OpsView ? "예약안내/결과요청" : "확인/리마인더"})
                  </span>
                  <span className="text-[11px] font-semibold text-slate-500">{stage3ContactPanelOpen ? "접기" : "열기"}</span>
                </button>
                <p className="mt-1 text-[11px] text-gray-500">
                  {isStage2OpsView ? "예약 안내/결과 요청/미응답 재접촉을 보조 실행합니다." : "재평가 일정 안내를 위한 보조 실행 패널입니다."}
                </p>
                {stage3ContactPanelOpen ? (
                  <div className="mt-3">
                    <ContactExecutionLauncherCard
                      mode={mode}
                      stage2OpsView={isStage2OpsView}
                      contactExecutor={detail.contactExecutor}
                      executionStatus={detail.contactExecution.status}
                      strategy={effectiveStrategy}
                      lastSentAt={detail.contactExecution.lastSentAt}
                      sensitivityFlags={sensitivityFlags}
                      latestAgentLog={detail.agentExecutionLogs[0]}
                      selectedRecommendation={selectedRecommendation}
                      agentJob={agentJob}
                      gateStatus={agentGateStatus}
                      onSwitchExecutor={handleContactExecutorChange}
                      onOpen={() => openStage1FlowModal("CONTACT_EXECUTION")}
                      onRetryNow={retryAgentNow}
                      onScheduleRetry={scheduleAgentRetry}
                    />
                    <div className="mt-3">
                      <ResponseTriagePanel
                        expanded={responsePanelExpanded}
                        onToggle={() => setResponsePanelExpanded((prev) => !prev)}
                        executionStatus={detail.contactExecution.status}
                        lastSentAt={detail.contactExecution.lastSentAt}
                        lastSmsSentAt={detail.lastSmsSentAt}
                        assigneeName={detail.header.assigneeName}
                        reservation={detail.reservation}
                        showReservationSync={hasSmsReservationSignal}
                        autoFilledState={autoFilledOutcomeState}
                        onOpenReservationDetail={() => setReservationDetailOpen(true)}
                        selectedOutcomeCode={selectedOutcomeCode}
                        onSelectOutcomeCode={handleSelectOutcomeCode}
                        reasonTags={responseReasonTags}
                        onToggleReasonTag={handleToggleResponseReasonTag}
                        rejectReasonDraft={rejectReasonDraft}
                        onRejectReasonDraftChange={handleRejectReasonDraftChange}
                        noResponsePlanDraft={noResponsePlanDraft}
                        onNoResponsePlanDraftChange={handleNoResponsePlanDraftChange}
                        outcomeNote={outcomeNote}
                        onOutcomeNoteChange={handleOutcomeNoteChange}
                        isSaving={isOutcomeSaving}
                        submitError={outcomeSubmitError}
                        validationError={responseValidationError}
                        onClearError={clearSubmitError}
                        onReset={resetResponseTriageDraft}
                        onConfirm={confirmOutcomeTriage}
                        hasUnsavedChanges={responseDraftDirty}
                        lastSavedAt={responseLastSavedAt}
                        onOpenHandoffMemo={() => setHandoffMemoOpen(true)}
                        mode={mode}
                      />
                    </div>
                  </div>
                ) : null}
              </section>

              {stage3LatestRiskReview ? (
                <section className="rounded-xl border border-indigo-200 bg-indigo-50 p-4 shadow-sm">
                  <h3 className="text-sm font-bold text-indigo-900">{isStage2OpsView ? "최신 진단 진행 메모" : "최신 위험 추적 메모"}</h3>
                  <p className="mt-1 text-[11px] text-indigo-800">{stage3LatestRiskReview.memo}</p>
                  <p className="mt-1 text-[10px] text-indigo-700">
                    {formatDateTime(stage3LatestRiskReview.at)} · {isStage2OpsView ? "다음 작업" : "다음 액션"} {STAGE3_RISK_NEXT_ACTION_LABELS[stage3LatestRiskReview.nextAction]}
                  </p>
                </section>
              ) : null}

              <RiskSignalEvidencePanel
                evidence={detail.riskEvidence}
                quality={detail.header.dataQuality}
                mode={mode}
                stage2OpsView={isStage2OpsView}
                stage3Type={resolvedStage3TypeForUi}
              />

              <ContactTimeline
                timeline={filteredTimeline}
                filter={timelineFilter}
                onFilterChange={setTimelineFilter}
                listClassName="max-h-[300px] overflow-y-auto pr-1"
                mode={mode}
                stage2OpsView={isStage2OpsView}
                stage3Type={resolvedStage3TypeForUi}
              />
            </>
          ) : (
            <>
              <RiskSignalEvidencePanel
                evidence={detail.riskEvidence}
                quality={detail.header.dataQuality}
                mode={mode}
                stage2OpsView={isStage2OpsView}
                stage3Type={resolvedStage3TypeForUi}
              />

              <ContactTimeline
                timeline={filteredTimeline}
                filter={timelineFilter}
                onFilterChange={setTimelineFilter}
                listClassName="max-h-[340px] overflow-y-auto pr-1"
                mode={mode}
                stage2OpsView={isStage2OpsView}
                stage3Type={resolvedStage3TypeForUi}
              />

              <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                <h3 className="text-sm font-bold text-slate-900">운영 요약 (읽기 전용)</h3>
                <p className="mt-1 text-[11px] text-gray-500">운영자가 지금 해야 할 행동: Step을 눌러 팝업에서 실행하세요.</p>
                <div className="mt-3 grid grid-cols-1 gap-3 text-xs">
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <p className="text-slate-500">열린 할 일</p>
                    <p className="mt-1 text-lg font-bold text-slate-900">
                      {detail.todos.filter((todo) => todo.status === "OPEN").length}건
                    </p>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <p className="text-slate-500">다음 예정 연락</p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">{formatDateTime(recontactDueAt)}</p>
                    {calendarFailures.length > 0 ? (
                      <div className="mt-2 space-y-1">
                        <p className="text-[11px] font-semibold text-red-600">캘린더 등록 실패 {calendarFailures.length}건</p>
                        {calendarFailures.slice(0, 2).map((failure) => (
                          <div key={failure.idempotencyKey} className="rounded-md border border-red-200 bg-red-50 px-2 py-1.5">
                            <p className="text-[10px] font-semibold text-red-700">{failure.title}</p>
                            <p className="text-[10px] text-red-600">{formatDateTime(failure.scheduledAt)}</p>
                            <button
                              onClick={() => handleRetryCalendarFailure(failure.idempotencyKey)}
                              disabled={Boolean(calendarRetryingKeys[failure.idempotencyKey])}
                              className="mt-1 inline-flex items-center rounded-md border border-red-300 px-2 py-0.5 text-[10px] font-semibold text-red-700 hover:bg-red-100 disabled:opacity-50"
                            >
                              {calendarRetryingKeys[failure.idempotencyKey] ? "재시도 중..." : "재시도"}
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <p className="text-slate-500">우선 할 일</p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">
                      {nextOpenTodo?.title ?? "모든 주요 작업이 처리되었습니다."}
                    </p>
                  </div>
                </div>
              </div>
            </>
          )}

          <AgentExecutionLogPanel logs={detail.agentExecutionLogs} />
        </aside>
      </div>

      <Dialog
        open={Boolean(stage3ProgramDrawerId)}
        onOpenChange={(open) => {
          if (!open) setStage3ProgramDrawerId(null);
        }}
      >
        <DialogContent className="max-w-2xl p-4">
          <h3 className="text-sm font-bold text-slate-900">ProgramExecutionDrawer</h3>
          <p className="mt-1 text-[11px] text-gray-500">
            선택 프로그램 실행 필드를 입력하면 Stage3 Step3 기록으로 반영됩니다.
          </p>
          {activeProgramDraft ? (
            <div className="mt-3 space-y-3">
              <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
                <p className="text-xs font-semibold text-slate-900">
                  {activeProgramDraft.major} / {activeProgramDraft.middle} / {activeProgramDraft.leaf}
                </p>
              </div>
              <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                <label className="text-[11px] text-slate-600">
                  담당자
                  <input
                    value={stage3ProgramExecutionDraft.owner}
                    onChange={(event) =>
                      setStage3ProgramExecutionDraft((prev) => ({ ...prev, owner: event.target.value }))
                    }
                    className="mt-1 h-8 w-full rounded-md border border-gray-200 px-2 text-[11px] outline-none focus:border-blue-300"
                  />
                </label>
                <label className="text-[11px] text-slate-600">
                  Due Date
                  <input
                    type="datetime-local"
                    value={toDateTimeLocalValue(stage3ProgramExecutionDraft.dueDate)}
                    onChange={(event) =>
                      setStage3ProgramExecutionDraft((prev) => ({
                        ...prev,
                        dueDate: fromDateTimeLocalValue(event.target.value) || undefined,
                      }))
                    }
                    className="mt-1 h-8 w-full rounded-md border border-gray-200 px-2 text-[11px] outline-none focus:border-blue-300"
                  />
                </label>
                <label className="text-[11px] text-slate-600">
                  실행 방식
                  <select
                    value={stage3ProgramExecutionDraft.method ?? "안내"}
                    onChange={(event) =>
                      setStage3ProgramExecutionDraft((prev) => ({
                        ...prev,
                        method: event.target.value as NonNullable<Stage3ProgramExecutionField["method"]>,
                      }))
                    }
                    className="mt-1 h-8 w-full rounded-md border border-gray-200 px-2 text-[11px] outline-none focus:border-blue-300"
                  >
                    <option value="연계">연계</option>
                    <option value="예약">예약</option>
                    <option value="안내">안내</option>
                    <option value="교육">교육</option>
                    <option value="방문">방문</option>
                  </select>
                </label>
                <label className="text-[11px] text-slate-600">
                  상태
                  <select
                    value={stage3ProgramExecutionDraft.status ?? "PLANNED"}
                    onChange={(event) =>
                      setStage3ProgramExecutionDraft((prev) => ({
                        ...prev,
                        status: event.target.value as NonNullable<Stage3ProgramExecutionField["status"]>,
                      }))
                    }
                    className="mt-1 h-8 w-full rounded-md border border-gray-200 px-2 text-[11px] outline-none focus:border-blue-300"
                  >
                    <option value="PLANNED">예정</option>
                    <option value="IN_PROGRESS">진행중</option>
                    <option value="DONE">완료</option>
                    <option value="HOLD">보류</option>
                  </select>
                </label>
                <label className="text-[11px] text-slate-600 md:col-span-2">
                  기관
                  <input
                    value={stage3ProgramExecutionDraft.institution ?? ""}
                    onChange={(event) =>
                      setStage3ProgramExecutionDraft((prev) => ({ ...prev, institution: event.target.value }))
                    }
                    className="mt-1 h-8 w-full rounded-md border border-gray-200 px-2 text-[11px] outline-none focus:border-blue-300"
                  />
                </label>
                <label className="text-[11px] text-slate-600 md:col-span-2">
                  메모
                  <textarea
                    value={stage3ProgramExecutionDraft.note ?? ""}
                    onChange={(event) =>
                      setStage3ProgramExecutionDraft((prev) => ({ ...prev, note: event.target.value }))
                    }
                    className="mt-1 h-20 w-full rounded-md border border-gray-200 px-2 py-1 text-[11px] outline-none focus:border-blue-300"
                  />
                </label>
              </div>
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setStage3ProgramDrawerId(null)}
                  className="rounded-md border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-700"
                >
                  닫기
                </button>
                <button
                  onClick={() => {
                    if (!stage3ProgramDrawerId) return;
                    updateStage3ProgramExecution(stage3ProgramDrawerId, stage3ProgramExecutionDraft);
                    setStage3ProgramDrawerId(null);
                  }}
                  className="rounded-md bg-[#163b6f] px-3 py-1.5 text-xs font-semibold text-white"
                >
                  저장
                </button>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog
        open={isStage3Mode && Boolean(stage3TaskModalStep)}
        onOpenChange={(open) => {
          if (!open) closeStage3TaskModal();
        }}
      >
        <DialogContent className="w-[96vw] max-w-[96vw] sm:max-w-[1460px] max-h-[92vh] overflow-y-auto p-4">
          <div className="space-y-3">
            <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-bold text-indigo-900">
                    {isStage2OpsView ? "Stage2 작업열기" : "Stage3 작업열기"} · {stage3TaskCurrentCard?.title ?? "운영 루프"}
                  </p>
                  <p className="text-[11px] text-indigo-700">
                    {isStage2OpsView
                      ? "근거검토→신경심리→임상평가→전문의/분류 확정을 팝업에서 처리합니다. 운영 참고이며 담당자 확인 후 실행합니다."
                      : "추적→감별→위험추적→정밀관리 실행을 팝업에서 처리합니다. 운영 참고이며 담당자 확인 후 실행합니다."}
                  </p>
                </div>
                <span className="rounded-md border border-indigo-300 bg-white px-2 py-1 text-[11px] font-semibold text-indigo-700">
                  단계 {stage3TaskStepIndex + 1}/{stage3TaskOrder.length}
                </span>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-1.5 md:grid-cols-4">
                {stage3TaskOrder.map((stepId, index) => {
                  const card = stage1FlowCards.find((item) => item.id === stepId);
                  const isActive = stage3TaskModalStep === stepId;
                  const stepErrorCount = Object.keys(stage3FieldErrorsByStep[stepId] ?? {}).length;
                  return (
                    <button
                      key={stepId}
                      type="button"
                      onClick={() => {
                        const lockReason = getFlowCardLockReason(stage1FlowCards, stepId);
                        if (lockReason) {
                          toast.error(lockReason);
                          return;
                        }
                        setStage3TaskModalStep(stepId);
                      }}
                      className={cn(
                        "rounded-md border px-2 py-1.5 text-left text-[11px]",
                        isActive ? "border-indigo-300 bg-white text-indigo-800" : "border-indigo-100 bg-indigo-50/60 text-indigo-700",
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-semibold">STEP {index + 1}</p>
                        {stepErrorCount > 0 ? (
                          <span className="rounded-full border border-rose-200 bg-rose-50 px-1.5 py-0.5 text-[10px] font-semibold text-rose-700">
                            오류 {stepErrorCount}
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-0.5 truncate">{card?.title ?? stepId}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            {stage3TaskModalStep === "PRECHECK"
              ? (() => {
                  const opsStats = buildCaseOpsStats({
                    detail,
                    modelPriorityValue,
                    stage2ResultLabel: stage2ModelAvailable ? stage3CaseResultLabel : undefined,
                    stage2MciSeverity: stage2ModelAvailable ? stage3MciSeverity : undefined,
                    stage2TestAt: caseRecord?.updated,
                    stage2Org: "협력기관 평가 기록",
                  });
                  const stage2ProbEntries: Array<{ key: "AD" | "MCI" | "NORMAL"; label: string }> = [
                    { key: "AD", label: "AD" },
                    { key: "MCI", label: "MCI" },
                    { key: "NORMAL", label: "정상" },
                  ];
                  const hasStage2Probs = stage2ModelAvailable && stage2ProbEntries.some(
                    (entry) => opsStats.stage2.probs?.[entry.key] != null,
                  );
                  const stage3RiskNowPct = stage3ModelAvailable ? toPercentUnknown(opsStats.stage3.risk2yNow) : undefined;
                  const stage3RiskAt2yPct = stage3ModelAvailable ? toPercentUnknown(opsStats.stage3.riskAt2y) : undefined;
                  const stage3StatusLabel = !stage3ModelAvailable
                    ? "결과수신 대기"
                    : opsStats.stage3.status === "RESULT_APPLIED"
                      ? (isStage2OpsView ? "결과수신 완료" : "반영 완료")
                      : isStage2OpsView
                        ? "결과수신 대기"
                        : "검사결과 대기";
                  if (isStage2OpsView) {
                    const reservationAttemptCount = detail.timeline.filter(
                      (event) =>
                        event.type === "DIFF_REFER_CREATED" ||
                        event.type === "DIFF_SCHEDULED" ||
                        event.type === "LINKAGE_CREATED",
                    ).length;
                    const contactMessageCount = detail.timeline.filter(
                      (event) =>
                        event.type === "CALL_ATTEMPT" ||
                        event.type === "SMS_SENT" ||
                        event.type === "MESSAGE_SENT",
                    ).length;
                    const resultInputCount = detail.timeline.filter(
                      (event) => event.type === "STAGE2_RESULTS_RECORDED" || event.type === "DIFF_RESULT_APPLIED",
                    ).length;
                    const stage2Step1Errors = stage2ErrorSummaryEntries.filter(
                      (entry) => entry.key === "step1Plan" || entry.key === "step1StrategyMemo" || entry.key === "step1Consent",
                    );

                    return (
                      <section className="rounded-lg border border-gray-200 bg-white p-4">
                        <h4 className="text-sm font-bold text-slate-900">Stage2 진입 리뷰 & 검사 수행 관리</h4>
                        <p className="mt-1 text-[11px] text-gray-600">
                          STEP1은 검사 항목 선택이 아니라, 현재 검사 플랜/연계 경로/누락 상태를 검토하고 승인하는 단계입니다.
                        </p>
                        <div className="mt-3">
                          <StepChecklist items={STAGE2_TASK_CHECKLIST.PRECHECK} />
                        </div>
                        {stage2Step1Errors.length > 0 ? (
                          <div className="mt-3 rounded-md border border-rose-200 bg-rose-50 p-2">
                            <p className="text-[11px] font-semibold text-rose-700">누락/오류 항목</p>
                            <ul className="mt-1 space-y-1">
                              {stage2Step1Errors.map((entry) => (
                                <li key={entry.key}>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (entry.key === "step1Plan") {
                                        scrollToFirstErrorCard(
                                          stage2RequiredBlockingPlanItems.map((item) => item.id),
                                          stage2PlanItemRefs,
                                        );
                                        return;
                                      }
                                      focusStage2ErrorField(entry.key);
                                    }}
                                    className="text-[11px] text-rose-700 underline decoration-dotted underline-offset-2"
                                  >
                                    - {entry.message}
                                  </button>
                                </li>
                              ))}
                            </ul>
                          </div>
                        ) : null}

                        <div className="mt-3">
                          <Stage2Step1PlanSummaryBar
                            summary={stage2PlanSummary}
                            route={stage2PlanRouteState}
                            onOpenMissing={() =>
                              scrollToFirstErrorCard(
                                stage2RequiredBlockingPlanItems.map((item) => item.id),
                                stage2PlanItemRefs,
                              )
                            }
                            onPrimaryAction={handleStage2PlanPrimaryAction}
                            onReviewComplete={handleStage3TaskComplete}
                          />
                        </div>

                        <div className="mt-2 flex justify-end">
                          <button
                            type="button"
                            onClick={() => setStage3TaskModalStep("CONTACT_EXECUTION")}
                            className="rounded-md border border-slate-200 bg-slate-50 px-3 py-1.5 text-[11px] font-semibold text-slate-700"
                          >
                            상담/문자 실행 열기
                          </button>
                        </div>

                        <div className="mt-3 grid grid-cols-1 gap-3 xl:grid-cols-[1fr_1.2fr]">
                          <div className="space-y-3">
                            <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
                              <p className="text-xs font-semibold text-slate-800">Stage1→Stage2 요약 Scorecard</p>
                              <div className="mt-2 grid grid-cols-2 gap-2 text-[11px]">
                                <div className="rounded border border-slate-200 bg-white px-2 py-1.5">
                                  <p className="text-slate-500">Stage1 우선도</p>
                                  <p className="font-semibold text-slate-900">
                                    {opsStats.stage1.priorityScore ?? "-"}점 / {opsStats.stage1.priorityBand ?? "확실하지 않음"}
                                  </p>
                                </div>
                                <div className="rounded border border-slate-200 bg-white px-2 py-1.5">
                                  <p className="text-slate-500">개입 레벨</p>
                                  <p className="font-semibold text-slate-900">{opsStats.stage1.interventionLevel ?? "-"}</p>
                                </div>
                                <div className="rounded border border-slate-200 bg-white px-2 py-1.5">
                                  <p className="text-slate-500">Stage2 진입일</p>
                                  <p className="font-semibold text-slate-900">{formatDateTime(stage2EnteredAt)}</p>
                                </div>
                                <div className="rounded border border-slate-200 bg-white px-2 py-1.5">
                                  <p className="text-slate-500">Stage2 상태</p>
                                  <p className="font-semibold text-slate-900">{stage2DiagnosisStatusLabel(stage2Diagnosis.status)}</p>
                                </div>
                                <div className="col-span-2 rounded border border-slate-200 bg-white px-2 py-1.5">
                                  <p className="text-slate-500">Stage2 진입 근거 요약</p>
                                  <p className="font-semibold text-slate-900">
                                    Stage1 인지저하 신호와 누락/지연 이력 기준으로 Stage2 진단검사 경로를 우선 실행합니다.
                                  </p>
                                </div>
                              </div>
                            </div>

                            <details className="rounded-md border border-slate-200 bg-slate-50 p-3">
                              <summary className="cursor-pointer text-xs font-semibold text-slate-800">이전 작업 리뷰(요약)</summary>
                              <div className="mt-2 grid grid-cols-3 gap-2 text-[11px]">
                                <div className="rounded border border-slate-200 bg-white px-2 py-1.5">
                                  <p className="text-slate-500">예약/의뢰 시도</p>
                                  <p className="font-semibold text-slate-900">{reservationAttemptCount}</p>
                                </div>
                                <div className="rounded border border-slate-200 bg-white px-2 py-1.5">
                                  <p className="text-slate-500">연락/문자 실행</p>
                                  <p className="font-semibold text-slate-900">{contactMessageCount}</p>
                                </div>
                                <div className="rounded border border-slate-200 bg-white px-2 py-1.5">
                                  <p className="text-slate-500">결과 입력 이벤트</p>
                                  <p className="font-semibold text-slate-900">{resultInputCount}</p>
                                </div>
                              </div>
                            </details>

                            <label className="text-[11px] text-slate-600">
                              전략 메모(필수, 20자 이상)
                              <textarea
                                ref={registerStage2FieldRef("step1StrategyMemo")}
                                value={stage3ReviewDraft.strategyMemo}
                                onChange={(event) => {
                                  clearStage2FieldError("step1StrategyMemo");
                                  setStage3ReviewDraft((prev) => ({ ...prev, strategyMemo: event.target.value }));
                                }}
                                className={stage2FieldClass(
                                  "step1StrategyMemo",
                                  "mt-1 h-24 w-full rounded-md border border-gray-200 px-2 py-1 text-[11px] outline-none focus:border-indigo-300",
                                )}
                                placeholder="Stage1 근거 요약, Stage2 검사 경로, 담당자 확인 포인트를 입력하세요."
                              />
                            </label>
                            {stage2FieldErrors.step1StrategyMemo ? (
                              <p className="-mt-2 text-[10px] font-semibold text-rose-600">{stage2FieldErrors.step1StrategyMemo}</p>
                            ) : null}
                            <label className="flex items-center gap-1 text-[11px] text-slate-700">
                              <input
                                ref={registerStage2FieldRef("step1Consent")}
                                type="checkbox"
                                checked={stage3ReviewDraft.consentConfirmed}
                                onChange={(event) => {
                                  clearStage2FieldError("step1Consent");
                                  setStage3ReviewDraft((prev) => ({ ...prev, consentConfirmed: event.target.checked }));
                                }}
                              />
                              Stage1 결과/동의 정보 확인 완료
                            </label>
                            {stage2FieldErrors.step1Consent ? (
                              <p className="-mt-2 text-[10px] font-semibold text-rose-600">{stage2FieldErrors.step1Consent}</p>
                            ) : null}
                          </div>

                          <div className="space-y-3 rounded-md border border-slate-200 bg-slate-50 p-3">
                            <div ref={registerStage2FieldRef("step1Plan")}>
                              <p className="text-xs font-semibold text-slate-800">검사 수행 경로</p>
                              <div className="mt-2">
                                <PlanRouteCards
                                  routeType={stage2PlanRouteDraft as Stage2PlanRoute}
                                  orgName={stage2HospitalDraft}
                                  dueAt={stage2ScheduleDraft}
                                  needsReasonOnChange={stage2PlanRouteChangeNeedsReason}
                                  onSelectRoute={handleStage2PlanRouteSelect}
                                />
                              </div>
                            </div>
                            {stage2FieldErrors.step1Plan ? (
                              <p className="text-[10px] font-semibold text-rose-600">{stage2FieldErrors.step1Plan}</p>
                            ) : null}

                            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                              <label className="text-[11px] text-slate-600">
                                기관
                                <input
                                  value={stage2HospitalDraft}
                                  onChange={(event) => setStage2HospitalDraft(event.target.value)}
                                  className="mt-1 h-8 w-full rounded-md border border-gray-200 px-2 text-[11px] outline-none focus:border-indigo-300"
                                />
                              </label>
                              <label className="text-[11px] text-slate-600">
                                목표일
                                <input
                                  type="datetime-local"
                                  value={toDateTimeLocalValue(stage2ScheduleDraft)}
                                  onChange={(event) => setStage2ScheduleDraft(fromDateTimeLocalValue(event.target.value) || stage2ScheduleDraft)}
                                  className="mt-1 h-8 w-full rounded-md border border-gray-200 px-2 text-[11px] outline-none focus:border-indigo-300"
                                />
                              </label>
                            </div>

                            <div>
                              <p className="text-xs font-semibold text-slate-800">검사 항목 상태 카드</p>
                              <p className="mt-1 text-[10px] text-slate-500">
                                필수 항목은 누락/검증 필요 상태에서 STEP2가 잠금됩니다. 카드 액션으로 결과 재요청/수기입력 전환이 가능합니다.
                              </p>
                              <div className="mt-2">
                                <PlanItemCardList
                                  items={stage2PlanItems}
                                  onAction={handleStage2PlanItemAction}
                                  registerRef={registerStage2PlanItemRef}
                                />
                              </div>
                            </div>

                            <div className="rounded-md border border-slate-200 bg-white p-2 text-[10px] text-slate-600">
                              <p>STEP 잠금 상태: STEP2 {stage2PlanSummary.locks.step2 ? "잠금" : "해제"} · STEP3 {stage2PlanSummary.locks.step3 ? "잠금" : "해제"} · STEP4 {stage2PlanSummary.locks.step4 ? "잠금" : "해제"}</p>
                              <p className="mt-1">검토 완료 여부: {stage2PlanSummary.step1Reviewed ? "완료" : "대기"} · 완료율 {stage2PlanSummary.completionRate}%</p>
                            </div>
                          </div>
                        </div>
                      </section>
                    );
                  }

                  return (
                    <section className="rounded-lg border border-gray-200 bg-white p-4">
                      <h4 className="text-sm font-bold text-slate-900">{isStage2OpsView ? "Stage1 근거/진입 검토" : "케이스 상태 리뷰 & 전략 수립"}</h4>
                      <p className="mt-1 text-[11px] text-gray-600">
                        {isStage2OpsView
                          ? "Step1은 Stage1 근거와 Stage2 진입 필요성을 확인하고 담당자 검토를 기록하는 단계입니다."
                          : "Step1은 수치 요약 중심으로 현재 상태를 확인하는 단계입니다. 운영 참고용 정보이며 담당자 확인 후 실행합니다."}
                      </p>

                      <div className="mt-3 grid grid-cols-2 gap-2 rounded-lg border border-indigo-200 bg-indigo-50 p-2 md:grid-cols-3 xl:grid-cols-6">
                        <div
                          title="업무 우선도는 운영 실행 순서를 나타내는 보조 지표입니다."
                          className="rounded-md border border-indigo-100 bg-white p-2 shadow-sm transition-all duration-150 hover:-translate-y-0.5 hover:shadow-md"
                        >
                          <p className="text-[10px] font-semibold text-indigo-600">업무 우선도</p>
                          <p className="mt-1 text-xs font-bold text-slate-900">
                            {opsStats.stage1.priorityBand ?? "확실하지 않음"} · {opsStats.stage1.priorityScore ?? "-"}점
                          </p>
                          <p className="mt-1 text-[10px] text-slate-500">개입 {opsStats.stage1.interventionLevel ?? "-"}</p>
                        </div>
                        <div
                          title="Stage2 결과 라벨(케이스 기준)입니다."
                          className="rounded-md border border-indigo-100 bg-white p-2 shadow-sm transition-all duration-150 hover:-translate-y-0.5 hover:shadow-md"
                        >
                          <p className="text-[10px] font-semibold text-indigo-600">Stage2 결과</p>
                          <p className="mt-1 text-xs font-bold text-slate-900">
                            {stage2ModelAvailable ? opsStats.stage2.resultLabel ?? "미확정" : "결과대기"}
                            {stage2ModelAvailable && opsStats.stage2.mciSeverity ? `(${opsStats.stage2.mciSeverity})` : ""}
                          </p>
                          <p className="mt-1 text-[10px] text-slate-500">{formatDateTime(opsStats.stage2.testAt)}</p>
                        </div>
                        <div
                          title="정상/AD/MCI 분류 확률입니다. 데이터 미수집 시 확실하지 않음으로 표시됩니다."
                          className="rounded-md border border-indigo-100 bg-white p-2 shadow-sm transition-all duration-150 hover:-translate-y-0.5 hover:shadow-md"
                        >
                          <p className="text-[10px] font-semibold text-indigo-600">Stage2 분류 확률</p>
                          <p className="mt-1 text-xs font-bold text-slate-900">
                            {hasStage2Probs ? "모델 추정치(운영 참고)" : "확실하지 않음(미수집)"}
                          </p>
                          {hasStage2Probs ? (
                            <div className="mt-1 space-y-1">
                              {stage2ProbEntries.map((entry) => {
                                const pct = toPercentUnknown(opsStats.stage2.probs?.[entry.key]) ?? 0;
                                return (
                                  <div key={entry.key} className="space-y-0.5">
                                    <div className="flex items-center justify-between text-[10px] text-slate-500">
                                      <span>{entry.label}</span>
                                      <span>{pct}%</span>
                                    </div>
                                    <div className="h-1.5 rounded bg-slate-100">
                                      <div className="h-full rounded bg-indigo-400" style={{ width: `${pct}%` }} />
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <p className="mt-1 text-[10px] text-slate-500">결과 라벨 기준으로만 확인</p>
                          )}
                        </div>
                        <div
                          title={isStage2OpsView
                            ? "진단 지연 위험(운영 참고)입니다."
                            : stage3View?.source.profile?.stage3Type === "AD_MANAGEMENT"
                              ? "현재 위험지수(운영 참고)입니다. 담당자 확인 전 운영 참고용입니다."
                              : "2년 전환위험 현재값입니다. 담당자 확인 전 운영 참고용입니다."}
                          className="rounded-md border border-indigo-100 bg-white p-2 shadow-sm transition-all duration-150 hover:-translate-y-0.5 hover:shadow-md"
                        >
                          <p className="text-[10px] font-semibold text-indigo-600">
                            {isStage2OpsView
                              ? "진단 지연 위험(현재)"
                              : stage3View?.source.profile?.stage3Type === "AD_MANAGEMENT"
                                ? "Stage3 현재 위험지수(현재)"
                                : "Stage3 전환위험(현재)"}
                          </p>
                          <p className="mt-1 text-xs font-bold text-slate-900">
                            {stage3RiskNowPct == null ? "확실하지 않음(데이터 없음)" : `${stage3RiskNowPct}%`}
                          </p>
                          <p className="mt-1 text-[10px] text-slate-500">
                            {isStage2OpsView
                              ? "진행 위험"
                              : stage3View?.source.profile?.stage3Type === "AD_MANAGEMENT"
                                ? "현재 위험지수"
                                : "전환위험"}{" "}
                            {stage3ModelAvailable ? opsStats.stage3.risk2yLabel ?? "-" : "결과대기"}
                          </p>
                        </div>
                        <div
                          title={isStage2OpsView ? "목표일 기준 지연 추정치입니다." : "현재 추세 기반 2년 후 예측값입니다."}
                          className="rounded-md border border-indigo-100 bg-white p-2 shadow-sm transition-all duration-150 hover:-translate-y-0.5 hover:shadow-md"
                        >
                          <p className="text-[10px] font-semibold text-indigo-600">{isStage2OpsView ? "목표일 지연 예측" : "Stage3 2년 후 예측"}</p>
                          <p className="mt-1 text-xs font-bold text-slate-900">
                            {stage3RiskAt2yPct == null ? "확실하지 않음(데이터 없음)" : `${stage3RiskAt2yPct}%`}
                          </p>
                          <p className="mt-1 text-[10px] text-slate-500">신뢰수준 {opsStats.stage3.confidence ?? "-"}</p>
                        </div>
                        <div
                          title="데이터 품질과 누락 건수입니다."
                          className="rounded-md border border-indigo-100 bg-white p-2 shadow-sm transition-all duration-150 hover:-translate-y-0.5 hover:shadow-md"
                        >
                          <p className="text-[10px] font-semibold text-indigo-600">데이터 품질</p>
                          <p className="mt-1 text-xs font-bold text-slate-900">
                            {opsStats.dataQuality?.score ?? "-"}%
                          </p>
                          <p className="mt-1 text-[10px] text-slate-500">누락 {opsStats.dataQuality?.missingCount ?? 0}건</p>
                        </div>
                      </div>

                      <div className="mt-3 grid grid-cols-1 gap-3 xl:grid-cols-[1.6fr_1fr]">
                        <div className="space-y-3">
                          <div className="grid grid-cols-1 gap-2 lg:grid-cols-3">
                            <article className="rounded-md border border-slate-200 bg-slate-50 p-3">
                              <div className="flex items-center justify-between">
                                <p className="text-[10px] font-semibold text-slate-700">Stage1 수치 요약</p>
                                <button
                                  type="button"
                                  onClick={() => toast(modelPriorityMeta.guide)}
                                  className="rounded border border-slate-300 bg-white px-1.5 py-0.5 text-[10px] font-semibold text-slate-700"
                                >
                                  기준 보기
                                </button>
                              </div>
                              <p className="mt-1 text-[11px] text-slate-700">
                                업무 우선도: <strong>{opsStats.stage1.priorityBand ?? "확실하지 않음"}</strong> ({opsStats.stage1.priorityScore ?? "-"}점 /{" "}
                                {opsStats.stage1.interventionLevel ?? "-"})
                              </p>
                              <p className="mt-1 text-[10px] text-slate-500">
                                상위 {opsStats.stage1.percentileTop ?? "-"}% · 업데이트 {formatDateTime(opsStats.stage1.updatedAt)}
                              </p>
                            </article>

                            <article className="rounded-md border border-slate-200 bg-slate-50 p-3">
                              <p className="text-[10px] font-semibold text-slate-700">Stage2 분류 요약(케이스 기준)</p>
                              <p className="mt-1 text-[11px] text-slate-700">
                                결과 라벨:{" "}
                                <strong>
                                  {stage2ModelAvailable ? opsStats.stage2.resultLabel ?? "미확정" : "결과대기"}
                                  {stage2ModelAvailable && opsStats.stage2.mciSeverity ? `(${opsStats.stage2.mciSeverity})` : ""}
                                </strong>
                              </p>
                              <p className="mt-1 text-[10px] text-slate-500">
                                분류 확률: {hasStage2Probs ? "모델 추정치(운영 참고)" : "확실하지 않음(미수집)"}
                              </p>
                              <div className="mt-1 flex flex-wrap gap-1">
                                {([
                                  ["신경심리", opsStats.stage2.tests?.neuropsych],
                                  ["임상평가", opsStats.stage2.tests?.clinical],
                                  ["전문의", opsStats.stage2.tests?.specialist],
                                ] as const).map(([label, status]) => (
                                  <span
                                    key={label}
                                    className={cn(
                                      "rounded px-1.5 py-0.5 text-[10px] font-semibold",
                                      status === "DONE" ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-600",
                                    )}
                                  >
                                    {label} {status === "DONE" ? "완료" : "미확인"}
                                  </span>
                                ))}
                              </div>
                              <p className="mt-1 text-[10px] text-slate-500">
                                검사일 {formatDateTime(opsStats.stage2.testAt)} · {opsStats.stage2.org ?? "기관 정보 없음"}
                              </p>
                            </article>

                            <article className="rounded-md border border-slate-200 bg-slate-50 p-3">
                              <p className="text-[10px] font-semibold text-slate-700">
                                {stage3View?.source.profile?.stage3Type === "AD_MANAGEMENT" ? "Stage3 현재 위험지수/상태" : "Stage3 전환위험/상태"}
                              </p>
                              <p className="mt-1 text-[11px] text-slate-700">
                                {stage3View?.source.profile?.stage3Type === "AD_MANAGEMENT" ? "현재 위험지수:" : "전환위험:"}{" "}
                                <strong>
                                  {stage3ModelAvailable ? opsStats.stage3.risk2yLabel ?? "미확정" : "결과대기"} ({stage3RiskNowPct == null ? "-" : `${stage3RiskNowPct}%`})
                                </strong>
                              </p>
                              <div className="mt-1 flex flex-wrap items-center gap-1">
                                <span
                                  className={cn(
                                    "rounded px-1.5 py-0.5 text-[10px] font-semibold",
                                    opsStats.stage3.status === "RESULT_APPLIED"
                                      ? "bg-emerald-100 text-emerald-700"
                                      : "bg-amber-100 text-amber-700",
                                  )}
                                >
                                  상태: {stage3StatusLabel}
                                </span>
                                {opsStats.stage3.status === "RESULT_PENDING" ? (
                                  <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">
                                    임시 추정치
                                  </span>
                                ) : null}
                              </div>
                              <p className="mt-1 text-[10px] text-slate-500">
                                신뢰수준 {stage3ModelAvailable ? opsStats.stage3.confidence ?? "-" : "결과대기"} · 재평가 {formatDateTime(opsStats.stage3.nextReevalAt)}
                              </p>
                              <p className="mt-1 text-[10px] text-slate-500">
                                다음 추적 {formatDateTime(opsStats.stage3.nextContactAt)} · 2년 후 예측 {stage3RiskAt2yPct ?? "-"}%
                              </p>
                            </article>
                          </div>

                          <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
                            <div className="rounded-md border border-slate-200 bg-slate-50 p-2">
                              <p className="text-[10px] font-semibold text-slate-700">접촉 시도(30일)</p>
                              <p className="mt-1 text-sm font-bold text-slate-900">{opsStats.opsCounts?.contactAttempts30d ?? 0}</p>
                            </div>
                            <div className="rounded-md border border-slate-200 bg-slate-50 p-2">
                              <p className="text-[10px] font-semibold text-slate-700">성공(30일)</p>
                              <p className="mt-1 text-sm font-bold text-emerald-700">{opsStats.opsCounts?.contactSuccess30d ?? 0}</p>
                            </div>
                            <div className="rounded-md border border-slate-200 bg-slate-50 p-2">
                              <p className="text-[10px] font-semibold text-slate-700">실패 누적(30일)</p>
                              <p className="mt-1 text-sm font-bold text-rose-700">{opsStats.opsCounts?.contactFail30d ?? 0}</p>
                            </div>
                            <div className="rounded-md border border-slate-200 bg-slate-50 p-2">
                              <p className="text-[10px] font-semibold text-slate-700">예약 생성</p>
                              <p className="mt-1 text-sm font-bold text-slate-900">{opsStats.opsCounts?.bookings ?? 0}</p>
                            </div>
                            <div className="rounded-md border border-slate-200 bg-slate-50 p-2">
                              <p className="text-[10px] font-semibold text-slate-700">프로그램(예정/완료)</p>
                              <p className="mt-1 text-sm font-bold text-slate-900">
                                {(opsStats.opsCounts?.programsPlanned ?? 0) + (opsStats.opsCounts?.programsDone ?? 0)} / {opsStats.opsCounts?.programsDone ?? 0}
                              </p>
                            </div>
                          </div>

                          <details className="rounded-md border border-slate-200 bg-slate-50 p-3">
                            <summary className="cursor-pointer text-xs font-semibold text-slate-800">이력(참고용)</summary>
                            <div className="mt-2 space-y-1.5">
                              {detail.timeline.slice(0, 8).map((event, idx) => (
                                <div key={`${event.at}-${idx}`} className="rounded border border-slate-200 bg-white px-2 py-1.5">
                                  <p className="text-[11px] font-semibold text-slate-700">{eventTitle(event)}</p>
                                  <p className="text-[10px] text-slate-500">{formatDateTime(event.at)} · {event.by}</p>
                                  <p className="text-[10px] text-slate-600">{eventDetail(event)}</p>
                                </div>
                              ))}
                              {detail.timeline.length === 0 ? (
                                <p className="rounded border border-slate-200 bg-white px-2 py-1.5 text-[10px] text-slate-500">
                                  기록이 없습니다.
                                </p>
                              ) : null}
                            </div>
                          </details>

                          <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
                            <p className="text-xs font-semibold text-slate-800">{isStage2OpsView ? "Stage1→Stage2 진입 근거(운영 참고)" : "Stage2→Stage3 전이 근거(운영 참고)"}</p>
                            <ul className="mt-1 space-y-1 text-[11px] text-slate-600">
                              <li>{isStage2OpsView ? "• Stage1 선별 근거 기준으로 Stage2 진단검사 경로가 필요합니다." : "• 최근 평가 기록에서 추가 감별검사 권고 신호가 확인되었습니다."}</li>
                              <li>{isStage2OpsView ? "• 미응답/지연 이력으로 예약·의뢰 우선순위가 상향되었습니다." : "• 추적 지연/미응답 이력으로 정밀관리 연계 우선순위가 상향되었습니다."}</li>
                              <li>{isStage2OpsView ? "• 운영 가이드 기준 상 신경심리/임상평가/전문의 경로를 순차 실행해야 합니다." : "• 운영 가이드 기준 상 정밀검사 연계 경로 시작이 필요합니다."}</li>
                              <li>• 최종 조치는 담당자 검토 및 의료진 확인 전 운영 참고용입니다.</li>
                            </ul>
                          </div>
                        </div>

                        <div className="space-y-3">
                          {stage3ErrorSummaryEntries.length > 0 ? (
                            <div className="rounded-md border border-rose-200 bg-rose-50 p-2">
                              <p className="text-[11px] font-semibold text-rose-700">필수 항목 누락 {stage3ErrorSummaryEntries.length}건</p>
                              <ul className="mt-1 space-y-1">
                                {stage3ErrorSummaryEntries.map((entry) => (
                                  <li key={entry.key}>
                                    <button
                                      type="button"
                                      onClick={() => focusStage3ErrorField(entry.key)}
                                      className="text-[11px] text-rose-700 underline decoration-dotted underline-offset-2"
                                    >
                                      - {entry.message}
                                    </button>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          ) : null}
                          <div className="rounded-md border border-slate-200 bg-slate-50 p-3.5">
                            <p className="text-sm font-semibold text-slate-800">전략 수립(필수)</p>
                            <div className="mt-2 rounded-md border border-slate-200 bg-white p-2.5">
                              <p className="text-sm font-semibold text-slate-700">자동 감지된 주의/전제</p>
                              <div className="mt-1 flex flex-wrap gap-1">
                                {[
                                  stage3ReviewDraft.sensitiveHistory ? "민감 이력 주의" : null,
                                  stage3ReviewDraft.resultLinkedChecked ? "검사결과 연결 확인 필요" : null,
                                  detail.timeline.some((event) => event.type === "CALL_ATTEMPT" && event.result === "NO_ANSWER")
                                    ? "미응답 이력 누적"
                                    : null,
                                  caseRecord?.profile.guardianPhone ? "보호자 연락 우선 가능" : "본인 연락 우선",
                                ]
                                  .filter(Boolean)
                                  .map((chip) => (
                                    <span key={chip} className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-700">
                                      {chip}
                                    </span>
                                  ))}
                              </div>
                            </div>

                            <div
                              ref={registerStage3FieldRef("step1DiffDecision")}
                              className={cn(
                                "mt-2 grid grid-cols-1 gap-2",
                                stage3CurrentStepErrors.step1DiffDecision ? "rounded-md border border-rose-200 bg-rose-50 p-1" : "",
                              )}
                            >
                              <p className="text-sm font-semibold text-slate-700">감별검사 필요 여부(필수)</p>
                              <button
                                type="button"
                                onClick={() => {
                                  clearStage3FieldError("PRECHECK", "step1DiffDecision");
                                  setStage3ReviewDraft((prev) => ({
                                    ...prev,
                                    diffNeeded: true,
                                    diffDecisionSet: true,
                                  }));
                                }}
                                className={cn(
                                  "flex w-full items-center justify-between rounded-md border px-3.5 py-2.5 text-left",
                                  stage3ReviewDraft.diffDecisionSet && stage3ReviewDraft.diffNeeded
                                    ? "border-indigo-300 bg-indigo-50 text-indigo-800"
                                    : "border-slate-200 bg-white text-slate-700",
                                )}
                              >
                                <span className="text-sm font-semibold">감별검사 필요(권고)</span>
                                <span className="text-xs">전화 상담 후 병원 연계/예약 패키지 실행</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  clearStage3FieldError("PRECHECK", "step1DiffDecision");
                                  setStage3ReviewDraft((prev) => ({
                                    ...prev,
                                    diffNeeded: false,
                                    diffDecisionSet: true,
                                  }));
                                }}
                                className={cn(
                                  "flex w-full items-center justify-between rounded-md border px-3.5 py-2.5 text-left",
                                  stage3ReviewDraft.diffDecisionSet && !stage3ReviewDraft.diffNeeded
                                    ? "border-slate-400 bg-slate-100 text-slate-800"
                                    : "border-slate-200 bg-white text-slate-700",
                                )}
                              >
                                <span className="text-sm font-semibold">보류(추적/재평가 후 결정)</span>
                                <span className="text-xs">전화 상담 후 재평가/추적 계획 우선</span>
                              </button>
                              {stage3CurrentStepErrors.step1DiffDecision ? (
                                <p className="text-xs font-semibold text-rose-600">{stage3CurrentStepErrors.step1DiffDecision}</p>
                              ) : null}
                            </div>

                            {stage3ReviewDraft.diffDecisionSet ? (
                              <label className="mt-2 block text-sm text-slate-600">
                                선택 이유(선택 입력)
                                <input
                                  ref={registerStage3FieldRef("step1DiffReason")}
                                  value={stage3ReviewDraft.diffDecisionReason}
                                  onChange={(event) => {
                                    clearStage3FieldError("PRECHECK", "step1DiffReason");
                                    setStage3ReviewDraft((prev) => ({ ...prev, diffDecisionReason: event.target.value }));
                                  }}
                                  className={stage3FieldClass(
                                    "PRECHECK",
                                    "step1DiffReason",
                                    "mt-1 h-10 w-full rounded-md border border-gray-200 px-3 text-sm outline-none focus:border-indigo-300",
                                  )}
                                  placeholder="선택 이유를 짧게 기록하세요."
                                />
                              </label>
                            ) : null}

                            <label className="mt-2 flex items-center gap-1.5 text-sm text-slate-700">
                              <input
                                ref={registerStage3FieldRef("step1Consent")}
                                type="checkbox"
                                checked={stage3ReviewDraft.consentConfirmed}
                                onChange={(event) => {
                                  clearStage3FieldError("PRECHECK", "step1Consent");
                                  setStage3ReviewDraft((prev) => ({ ...prev, consentConfirmed: event.target.checked }));
                                }}
                              />
                              상담 동의 확인(필수)
                            </label>
                            {stage3CurrentStepErrors.step1Consent ? (
                              <p className="text-xs font-semibold text-rose-600">{stage3CurrentStepErrors.step1Consent}</p>
                            ) : null}
                            <label className="mt-1 flex items-center gap-1.5 text-sm text-slate-700">
                              <input
                                type="checkbox"
                                checked={stage3ReviewDraft.caregiverNeeded}
                                onChange={(event) => setStage3ReviewDraft((prev) => ({ ...prev, caregiverNeeded: event.target.checked }))}
                              />
                              보호자 협조 필요(선택)
                            </label>

                            <div className="mt-2">
                              <label className="text-sm font-semibold text-slate-600">업무 우선순위(운영)</label>
                              <select
                                value={stage3ReviewDraft.priority}
                                onChange={(event) =>
                                  setStage3ReviewDraft((prev) => ({
                                    ...prev,
                                    priority: event.target.value as Stage3ReviewDraft["priority"],
                                  }))
                                }
                                className="mt-1 h-10 w-full rounded-md border border-gray-200 px-3 text-sm outline-none focus:border-indigo-300"
                              >
                                <option value="HIGH">HIGH</option>
                                <option value="MID">MID</option>
                                <option value="LOW">LOW</option>
                              </select>
                            </div>
                            <div className="mt-2">
                              <label className="text-sm font-semibold text-slate-600">전략 메모(필수)</label>
                              <textarea
                                ref={registerStage3FieldRef("step1StrategyMemo")}
                                value={stage3ReviewDraft.strategyMemo}
                                onChange={(event) => {
                                  clearStage3FieldError("PRECHECK", "step1StrategyMemo");
                                  setStage3ReviewDraft((prev) => ({ ...prev, strategyMemo: event.target.value }));
                                }}
                                className={stage3FieldClass(
                                  "PRECHECK",
                                  "step1StrategyMemo",
                                  "mt-1 h-32 w-full rounded-md border border-gray-200 px-3 py-2 text-sm outline-none focus:border-indigo-300",
                                )}
                                placeholder={"1) Stage3로 넘어온 이유\n2) 감별검사/연계 계획\n3) 추적/정밀관리 방향"}
                              />
                              {stage3CurrentStepErrors.step1StrategyMemo ? (
                                <p className="mt-1 text-xs font-semibold text-rose-600">{stage3CurrentStepErrors.step1StrategyMemo}</p>
                              ) : null}
                            </div>
                          </div>

                          <div className="rounded-md border border-indigo-200 bg-indigo-50 p-3">
                            <p className="text-sm text-indigo-800">
                              완료 시 <strong>{isStage2OpsView ? "STEP1 검토 완료" : "STAGE3_REVIEW_DONE"}</strong> 이벤트와 전략 메모가 타임라인/감사로그에 기록됩니다.
                            </p>
                            <button
                              type="button"
                              onClick={handleStage3TaskComplete}
                              className="mt-2 w-full rounded-md border border-indigo-300 bg-white px-3 py-2 text-sm font-semibold text-indigo-700 hover:bg-indigo-100"
                            >
                              {isStage2OpsView ? "Step2(신경심리검사)로 이동" : "Step2(검사 연계)로 이동"}
                            </button>
                          </div>
                        </div>
                      </div>
                    </section>
                  );
                })()
              : null}

            {stage3TaskModalStep === "CONTACT_EXECUTION"
              ? (() => {
                  const diffStatus = detail.stage3?.diffPathStatus ?? "NONE";
                  if (isStage2OpsView) {
                    const stage2Step2Errors = stage2ErrorSummaryEntries.filter(
                      (entry) =>
                        entry.key === "manualEditReason" ||
                        entry.key === "mmse" ||
                        entry.key === "cdr" ||
                        entry.key === "neuro" ||
                        entry.key === "specialist",
                    );
                    const integrationMeta = {
                      WAITING: { label: "대기", chip: "bg-slate-100 text-slate-700 border-slate-200" },
                      REQUESTED: { label: "요청됨", chip: "bg-blue-50 text-blue-700 border-blue-200" },
                      PARTIAL: { label: "부분 수신", chip: "bg-amber-50 text-amber-700 border-amber-200" },
                      VERIFY_NEEDED: { label: "검증 필요", chip: "bg-rose-50 text-rose-700 border-rose-200" },
                      READY: { label: "수신 완료", chip: "bg-emerald-50 text-emerald-700 border-emerald-200" },
                    } as const;
                    const integrationChip = integrationMeta[stage2IntegrationDisplayStatus];
                    const integrationHistory = detail.timeline
                      .filter((event) =>
                        event.type === "STAGE2_RESULTS_RECORDED" ||
                        event.type === "STAGE2_STEP2_AUTOFILL_APPLIED" ||
                        event.type === "STAGE2_MANUAL_EDIT_APPLIED" ||
                        event.type === "DIFF_RESULT_APPLIED" ||
                        event.type === "DIFF_REFER_CREATED" ||
                        event.type === "DIFF_SCHEDULED" ||
                        event.type === "MESSAGE_SENT",
                      )
                      .slice(0, 6);
                    const stage2AutoFillSourceMeta = stage2AutoFillPayload
                      ? {
                          RECEIVED: { label: "수신", chip: "border-emerald-200 bg-emerald-50 text-emerald-700" },
                          MAPPED: { label: "매핑", chip: "border-blue-200 bg-blue-50 text-blue-700" },
                          SEEDED: { label: "자동 기입", chip: "border-violet-200 bg-violet-50 text-violet-700" },
                        }[stage2AutoFillPayload.source]
                      : null;
                    const manualChangedFields = collectStage2ManualChangedFields();
                    const manualChangedKeys = Object.keys(manualChangedFields);
                    const manualReasonRequired = stage2ManualEditEnabled || manualChangedKeys.length > 0;
                    const inputLocked = !stage2ManualEditEnabled;
                    const syncAt = stage2IntegrationState.lastSyncedAt ?? stage2Evidence?.updatedAt;
                    const receivedAt = stage2IntegrationState.receivedAt ?? stage2Evidence?.updatedAt;
                    const step2Tasks = [
                      { label: "연계 결과 수신 확인", done: Boolean(receivedAt) },
                      { label: "누락/이상치 검증", done: stage2ResultMissingCount === 0 },
                      { label: "전문의 소견 확인", done: Boolean(stage2Diagnosis.tests.specialist) },
                      { label: "반영 후 STEP3 모델 산출 요청", done: stage2InferenceState.jobStatus === "DONE" },
                    ];

                    return (
                      <section id="stage2-modal-step2-input" className="rounded-xl border border-slate-200 bg-gradient-to-b from-white to-slate-50 p-4 shadow-sm">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div>
                            <h4 className="text-sm font-bold text-slate-900">STEP2 · 검사 결과 수신/검증/반영</h4>
                            <p className="mt-1 text-[11px] text-slate-600">
                              연계병원 결과를 수신한 뒤 검증하고, 담당자 확인으로 반영합니다.
                            </p>
                          </div>
                          <span className={cn("rounded-full border px-2.5 py-1 text-[10px] font-semibold", integrationChip.chip)}>
                            연계 상태 {integrationChip.label}
                          </span>
                        </div>
                        {stage2AutoFillLoading ? (
                          <div className="mt-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] text-slate-600">
                            자동 기입값을 동기화하는 중입니다...
                          </div>
                        ) : null}
                        {stage2AutoFillError ? (
                          <div className="mt-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-800">
                            {stage2AutoFillError}
                          </div>
                        ) : null}
                        {stage2AutoFillPayload && stage2AutoFillSourceMeta ? (
                          <div className="mt-2 flex flex-wrap items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] text-slate-700">
                            <span className="font-semibold text-slate-800">자동 기입 출처</span>
                            <span className={cn("rounded border px-2 py-0.5 text-[10px] font-semibold", stage2AutoFillSourceMeta.chip)}>
                              {stage2AutoFillSourceMeta.label}
                            </span>
                            <span className="text-slate-500">동기화 {formatDateTime(stage2AutoFillPayload.syncedAt)}</span>
                          </div>
                        ) : null}
                        <div className="mt-3">
                          <StepChecklist items={STAGE2_TASK_CHECKLIST.CONTACT_EXECUTION} />
                        </div>

                        <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-4">
                          {step2Tasks.map((task) => (
                            <article
                              key={task.label}
                              className={cn(
                                "rounded-lg border px-2.5 py-2 text-[11px]",
                                task.done ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-slate-200 bg-white text-slate-700",
                              )}
                            >
                              <p className="font-semibold">{task.done ? "완료" : "대기"}</p>
                              <p className="mt-1">{task.label}</p>
                            </article>
                          ))}
                        </div>

                        <div className="mt-3 grid grid-cols-1 gap-3 xl:grid-cols-[320px,1fr]">
                          <div className="space-y-3">

                        <div className="rounded-md border border-indigo-200 bg-indigo-50 p-3">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="text-xs font-semibold text-indigo-900">연계 상태</p>
                            <span className={cn("rounded border px-2 py-0.5 text-[10px] font-semibold", integrationChip.chip)}>
                              {integrationChip.label}
                            </span>
                          </div>
                          <div className="mt-2 grid grid-cols-2 gap-2 text-[11px] md:grid-cols-4">
                            <div className="rounded border border-indigo-100 bg-white px-2 py-1.5">
                              <p className="text-slate-500">마지막 동기화</p>
                              <p className="font-semibold text-slate-900">{formatDateTime(syncAt)}</p>
                            </div>
                            <div className="rounded border border-indigo-100 bg-white px-2 py-1.5">
                              <p className="text-slate-500">결과 수신 시각</p>
                              <p className="font-semibold text-slate-900">{formatDateTime(receivedAt)}</p>
                            </div>
                            <div className="rounded border border-indigo-100 bg-white px-2 py-1.5">
                              <p className="text-slate-500">수신 기관</p>
                              <p className="font-semibold text-slate-900">{stage2IntegrationState.sourceOrg ?? stage2HospitalDraft}</p>
                            </div>
                            <div className="rounded border border-indigo-100 bg-white px-2 py-1.5">
                              <p className="text-slate-500">누락 항목</p>
                              <p className={cn("font-semibold", stage2ResultMissingCount > 0 ? "text-rose-700" : "text-emerald-700")}>
                                {stage2ResultMissingCount}건
                              </p>
                            </div>
                          </div>
                          <div className="mt-2 grid grid-cols-1 gap-1">
                            <button
                              type="button"
                              onClick={() => {
                                const now = nowIso();
                                setStage2IntegrationState((prev) => ({ ...prev, lastSyncedAt: now }));
                                setStage2ModelRunState((prev) => ({
                                  ...prev,
                                  status: "PENDING",
                                  updatedAt: now,
                                  startedAt: undefined,
                                  completedAt: undefined,
                                  progress: 0,
                                  etaSeconds: null,
                                }));
                                appendTimeline({
                                  type: "MESSAGE_SENT",
                                  at: now,
                                  by: detail.header.assigneeName,
                                  summary: "연계병원 결과 재요청",
                                });
                                appendAuditLog("Stage2 결과 재요청 실행");
                                toast.success("결과 재요청 이벤트를 기록했습니다.");
                              }}
                              className="rounded border border-blue-200 bg-white px-2 py-1 text-[10px] font-semibold text-blue-700 hover:bg-blue-50"
                            >
                              결과 재요청
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                const now = nowIso();
                                setStage2IntegrationState((prev) => ({ ...prev, lastSyncedAt: now }));
                                if (stage2ResultMissingCount > 0) {
                                  setStage2ModelRunState((prev) => ({
                                    ...prev,
                                    status: "PENDING",
                                    updatedAt: now,
                                    startedAt: undefined,
                                    completedAt: undefined,
                                    progress: 0,
                                    etaSeconds: null,
                                  }));
                                }
                                appendAuditLog("Stage2 최신화 실행");
                                toast.success("최신화 시각을 갱신했습니다.");
                              }}
                              className="rounded border border-indigo-200 bg-white px-2 py-1 text-[10px] font-semibold text-indigo-700 hover:bg-indigo-50"
                            >
                              최신화
                            </button>
                          </div>
                          <details
                            open={stage2ReceiveHistoryOpen}
                            onToggle={(event) => setStage2ReceiveHistoryOpen((event.target as HTMLDetailsElement).open)}
                            className="mt-2 rounded border border-indigo-100 bg-white p-2"
                          >
                            <summary className="cursor-pointer text-[10px] font-semibold text-slate-700">수신 이력 보기</summary>
                            <div className="mt-2 space-y-1">
                              {integrationHistory.length > 0 ? (
                                integrationHistory.map((event, idx) => (
                                  <div key={`${event.at}-${idx}`} className="rounded border border-slate-200 px-2 py-1 text-[10px] text-slate-600">
                                    <p className="font-semibold text-slate-700">{eventTitle(event)}</p>
                                    <p>{formatDateTime(event.at)} · {event.summary}</p>
                                  </div>
                                ))
                              ) : (
                                <p className="text-[10px] text-slate-500">수신 이력이 없습니다.</p>
                              )}
                            </div>
                          </details>
                        </div>

                        {stage2Step2Errors.length > 0 ? (
                          <div className="rounded-md border border-rose-200 bg-rose-50 p-2">
                            <p className="text-[11px] font-semibold text-rose-700">누락/오류 항목</p>
                            <ul className="mt-1 space-y-1">
                              {stage2Step2Errors.map((entry) => (
                                <li key={entry.key}>
                                  <button
                                    type="button"
                                    onClick={() => focusStage2ErrorField(entry.key)}
                                    className="text-[11px] text-rose-700 underline decoration-dotted underline-offset-2"
                                  >
                                    - {entry.message}
                                  </button>
                                </li>
                              ))}
                            </ul>
                          </div>
                        ) : null}

                          {stage2ResultMissingCount > 0 ? (
                            <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-800">
                              누락 경고: 필수 검사 입력 {stage2ResultMissingCount}건이 남아 있습니다.
                            </div>
                          ) : (
                            <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-[11px] text-emerald-800">
                              필수 검사 입력 누락이 없습니다.
                            </div>
                          )}
                          </div>

                          <div className="space-y-3">

                        <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="text-xs font-semibold text-slate-800">자동 기입 결과 확인</p>
                            <label className="flex items-center gap-1 text-[10px] font-semibold text-slate-700">
                              <input
                                type="checkbox"
                                checked={stage2ManualEditEnabled}
                                onChange={(event) => {
                                  if (!event.target.checked && manualChangedKeys.length > 0) {
                                    toast.error("수정된 값이 있어 사유 입력 없이 잠금을 해제할 수 없습니다.");
                                    return;
                                  }
                                  setStage2ManualEditEnabled(event.target.checked);
                                  if (!event.target.checked) {
                                    setStage2ManualEditReason("");
                                    clearStage2FieldError("manualEditReason");
                                  }
                                }}
                              />
                              수동 수정
                            </label>
                          </div>
                          <p className="mt-1 text-[10px] text-slate-600">
                            자동 기입(운영 참고) 값이 반영됨. 수동 수정 시 사유 기록이 필수입니다.
                          </p>
                          <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-2">
                            <label className="text-[11px] text-slate-600">
                              <span className="inline-flex items-center gap-1">
                                <TermWithTooltip term="MMSE" /> 점수 (0~30)
                                {stage2AutoFillSourceMeta && stage2AutoFillFieldHasValue("mmse") ? (
                                  <span className={cn("rounded border px-1.5 py-0.5 text-[10px] font-semibold", stage2AutoFillSourceMeta.chip)}>
                                    {stage2AutoFillSourceMeta.label}
                                  </span>
                                ) : null}
                              </span>
                              <input
                                ref={registerStage2FieldRef("mmse")}
                                type="number"
                                inputMode="decimal"
                                min={0}
                                max={30}
                                step={1}
                                value={stage2Diagnosis.tests.mmse ?? ""}
                                disabled={inputLocked}
                                onChange={(event) => {
                                  clearStage2FieldError("mmse");
                                  clearStage2FieldError("manualEditReason");
                                  const value = event.target.value;
                                  const next = value === "" ? undefined : Number(value);
                                  setStage2Diagnosis((prev) => ({
                                    ...prev,
                                    tests: {
                                      ...prev.tests,
                                      mmse: value === "" || Number.isNaN(next) ? undefined : next,
                                    },
                                  }));
                                }}
                                className={stage2FieldClass(
                                  "mmse",
                                  "mt-1 h-8 w-full rounded-md border border-gray-200 px-2 text-xs outline-none focus:border-blue-300 disabled:cursor-not-allowed disabled:bg-slate-100",
                                )}
                              />
                              {stage2FieldErrors.mmse ? <p className="mt-1 text-[10px] font-semibold text-rose-600">{stage2FieldErrors.mmse}</p> : null}
                            </label>
                            <label className="text-[11px] text-slate-600">
                              <span className="inline-flex items-center gap-1">
                                <TermWithTooltip term="CDR" />/<TermWithTooltip term="GDS" /> 점수 (0~7)
                                {stage2AutoFillSourceMeta && stage2AutoFillFieldHasValue("cdr") ? (
                                  <span className={cn("rounded border px-1.5 py-0.5 text-[10px] font-semibold", stage2AutoFillSourceMeta.chip)}>
                                    {stage2AutoFillSourceMeta.label}
                                  </span>
                                ) : null}
                              </span>
                              <input
                                ref={registerStage2FieldRef("cdr")}
                                type="number"
                                inputMode="decimal"
                                min={0}
                                max={7}
                                step={0.5}
                                value={stage2Diagnosis.tests.cdr ?? ""}
                                disabled={inputLocked}
                                onChange={(event) => {
                                  clearStage2FieldError("cdr");
                                  clearStage2FieldError("manualEditReason");
                                  const value = event.target.value;
                                  const next = value === "" ? undefined : Number(value);
                                  setStage2Diagnosis((prev) => ({
                                    ...prev,
                                    tests: {
                                      ...prev.tests,
                                      cdr: value === "" || Number.isNaN(next) ? undefined : next,
                                    },
                                  }));
                                }}
                                className={stage2FieldClass(
                                  "cdr",
                                  "mt-1 h-8 w-full rounded-md border border-gray-200 px-2 text-xs outline-none focus:border-blue-300 disabled:cursor-not-allowed disabled:bg-slate-100",
                                )}
                              />
                              {stage2FieldErrors.cdr ? <p className="mt-1 text-[10px] font-semibold text-rose-600">{stage2FieldErrors.cdr}</p> : null}
                            </label>
                            <label className="text-[11px] text-slate-600">
                              <span className="inline-flex items-center gap-1">
                                신경인지검사 유형
                                {stage2AutoFillSourceMeta && stage2AutoFillFieldHasValue("cogTestType") ? (
                                  <span className={cn("rounded border px-1.5 py-0.5 text-[10px] font-semibold", stage2AutoFillSourceMeta.chip)}>
                                    {stage2AutoFillSourceMeta.label}
                                  </span>
                                ) : null}
                              </span>
                              <select
                                ref={registerStage2FieldRef("neuro")}
                                value={stage2Diagnosis.tests.neuroCognitiveType ?? ""}
                                disabled={inputLocked}
                                onChange={(event) => {
                                  clearStage2FieldError("neuro");
                                  clearStage2FieldError("manualEditReason");
                                  setStage2Diagnosis((prev) => ({
                                    ...prev,
                                    tests: {
                                      ...prev.tests,
                                      neuroCognitiveType:
                                        (event.target.value as Stage2Diagnosis["tests"]["neuroCognitiveType"]) || undefined,
                                    },
                                  }));
                                }}
                                className={stage2FieldClass(
                                  "neuro",
                                  "mt-1 h-8 w-full rounded-md border border-gray-200 px-2 text-xs outline-none focus:border-blue-300 disabled:cursor-not-allowed disabled:bg-slate-100",
                                )}
                              >
                                <option value="">선택</option>
                                <option value="CERAD-K">CERAD-K</option>
                                <option value="SNSB-II">SNSB-II</option>
                                <option value="SNSB-C">SNSB-C</option>
                                <option value="LICA">LICA</option>
                              </select>
                              {stage2FieldErrors.neuro ? <p className="mt-1 text-[10px] font-semibold text-rose-600">{stage2FieldErrors.neuro}</p> : null}
                            </label>
                            <label className="text-[11px] text-slate-600">
                              <span className="inline-flex items-center gap-1">
                                전문의 소견 상태
                                {stage2AutoFillSourceMeta && stage2AutoFillFieldHasValue("specialistOpinionStatus") ? (
                                  <span className={cn("rounded border px-1.5 py-0.5 text-[10px] font-semibold", stage2AutoFillSourceMeta.chip)}>
                                    {stage2AutoFillSourceMeta.label}
                                  </span>
                                ) : null}
                              </span>
                              <select
                                ref={registerStage2FieldRef("specialist")}
                                value={stage2Diagnosis.tests.specialist ? "DONE" : "MISSING"}
                                disabled={inputLocked}
                                onChange={(event) => {
                                  clearStage2FieldError("specialist");
                                  clearStage2FieldError("manualEditReason");
                                  setStage2Diagnosis((prev) => ({
                                    ...prev,
                                    tests: {
                                      ...prev.tests,
                                      specialist: event.target.value === "DONE",
                                    },
                                  }));
                                }}
                                className={stage2FieldClass(
                                  "specialist",
                                  "mt-1 h-8 w-full rounded-md border border-gray-200 px-2 text-xs outline-none focus:border-blue-300 disabled:cursor-not-allowed disabled:bg-slate-100",
                                )}
                              >
                                <option value="MISSING">MISSING</option>
                                <option value="DONE">DONE</option>
                              </select>
                              {stage2FieldErrors.specialist ? (
                                <p className="mt-1 text-[10px] font-semibold text-rose-600">{stage2FieldErrors.specialist}</p>
                              ) : null}
                            </label>
                          </div>
                          {manualChangedKeys.length > 0 ? (
                            <div className="mt-2 rounded-md border border-amber-200 bg-amber-50 px-2 py-1.5 text-[10px] text-amber-800">
                              변경 필드: {manualChangedKeys.join(", ")} · 저장 전에 수동 수정 사유가 필요합니다.
                            </div>
                          ) : null}
                          {manualReasonRequired ? (
                            <label className="mt-2 block text-[11px] text-slate-600">
                              수동 수정 사유(필수)
                              <textarea
                                ref={registerStage2FieldRef("manualEditReason")}
                                value={stage2ManualEditReason}
                                onChange={(event) => {
                                  clearStage2FieldError("manualEditReason");
                                  setStage2ManualEditReason(event.target.value);
                                }}
                                className={stage2FieldClass(
                                  "manualEditReason",
                                  "mt-1 h-16 w-full rounded-md border border-gray-200 px-2 py-1 text-[11px] outline-none focus:border-blue-300",
                                )}
                                placeholder="자동 수신값을 수정한 이유를 입력하세요."
                              />
                              {stage2FieldErrors.manualEditReason ? (
                                <p className="mt-1 text-[10px] font-semibold text-rose-600">{stage2FieldErrors.manualEditReason}</p>
                              ) : null}
                            </label>
                          ) : null}
                        </div>

                            <div className="rounded-md border border-slate-200 bg-white px-3 py-2 text-[10px] text-slate-600">
                              변경값은 담당자 확인 후 <strong>결과 입력 반영</strong> 버튼으로 저장됩니다.
                            </div>
                          </div>
                        </div>

                        <div className="mt-3 flex flex-wrap justify-end gap-2 border-t border-slate-200 pt-3">
                          <button
                            type="button"
                            onClick={() => moveStage3TaskStep(1)}
                            className="inline-flex items-center rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                          >
                            Step3(분류 확정) 미리 보기
                          </button>
                          <button
                            onClick={saveStage2TestInputs}
                            className="inline-flex items-center gap-1 rounded-md bg-[#163b6f] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#112f5a]"
                          >
                            <CheckCircle2 size={13} /> 결과 입력 반영
                          </button>
                        </div>
                      </section>
                    );
                  }
                  const approvedReady = stage3PendingApprovalCount === 0;
                  const highPriorityRecs = ragRecommendations.slice(0, 3);
                  const stage3Step2Errors = stage3ErrorSummaryEntries.filter((entry) =>
                    stage3ErrorOrderByStep.CONTACT_EXECUTION.includes(entry.key as Stage3TaskFieldKey),
                  );
                  const isDiffPathFlow = stage3ReviewDraft.diffNeeded;
                  const previousExamSummary = [
                    `Stage1 우선도 ${modelPriorityMeta.bandLabel} (${Math.round(modelPriorityValue)}점)`,
                    `Stage2 결과 ${stage2ResolvedLabel}${stage2ResolvedMciStage ? `(${stage2ResolvedMciStage})` : ""}`,
                    `현재 검사 연계 상태 ${diffStatus}`,
                  ];
                  const stage3Step2Panels: Array<{
                    key: Stage3Step2PanelKey;
                    title: string;
                    description: string;
                    done: boolean;
                  }> = [
                    {
                      key: "REVIEW",
                      title: "1) 이전 상담/리뷰 확인",
                      description: "이전 검사와 통화 맥락을 확인합니다.",
                      done: stage3Step2Flow.consultStarted || callMemo.trim().length > 0,
                    },
                    {
                      key: "BOOKING",
                      title: "2) 정밀검사 예약 생성",
                      description: "기관/검사/예약 정보를 확정합니다.",
                      done:
                        Boolean(stage3DiffDraft.preferredHospital.trim()) &&
                        (stage3DiffDraft.testBiomarker || stage3DiffDraft.testBrainImaging || stage3DiffDraft.testOther) &&
                        Boolean(stage3DiffDraft.bookingAt),
                    },
                    {
                      key: "RESULT",
                      title: "3) 결과 수신 입력",
                      description: "수행일/결과요약/핵심 결과를 반영합니다.",
                      done: stage3ResultEvidenceReady,
                    },
                    {
                      key: "MODEL",
                      title: "4) Stage2 모델 판정",
                      description: "결과 반영 이후 모델 상태를 확인합니다.",
                      done: stage3InferenceState.jobStatus === "DONE",
                    },
                    {
                      key: "TRANSITION",
                      title: "5) Stage3 전이 여부 확정",
                      description: "다음 단계(위험 추적)로 이동합니다.",
                      done: stage3DiffReadyForRisk,
                    },
                  ];
                  const stage3Step2PanelOrder = stage3Step2Panels.map((panel) => panel.key);
                  const stage3Step2ActiveIndex = Math.max(0, stage3Step2PanelOrder.indexOf(stage3Step2ActivePanel));

                  return (
                    <section id="stage3-step2-input" className="rounded-lg border border-gray-200 bg-white p-4">
                      <h4 className="text-sm font-bold text-slate-900">
                        {isDiffPathFlow
                          ? "이전검사 리뷰 → 전화 상담 → 예약/문자/캘린더 → 결과 수집"
                          : "이전검사 리뷰 → 전화 상담 → 재평가 안내/추적 계획"}
                      </h4>
                      <p className="mt-1 text-[11px] text-gray-600">
                        {isDiffPathFlow
                          ? "이전 검사 결과를 확인한 뒤 통화로 연계/예약을 진행하고, 필요 시 결과 수집을 반영합니다."
                          : "이전 검사 결과를 확인한 뒤 통화로 재평가 안내와 추적 계획을 확정합니다."}
                      </p>

                      <div className="mt-3 grid grid-cols-1 gap-3 xl:grid-cols-[minmax(360px,0.9fr)_minmax(0,1.1fr)]">
                        <div className="space-y-2">
                          {stage3Step2Panels.map((panel, index) => {
                            const active = stage3Step2ActivePanel === panel.key;
                            const blocked = index > stage3Step2ActiveIndex + 1;
                            return (
                              <button
                                key={panel.key}
                                type="button"
                                onClick={() => {
                                  if (blocked) return;
                                  openStage3Step2Panel(panel.key);
                                }}
                                className={cn(
                                  "flex w-full items-center justify-between rounded-md border px-3 py-2 text-left",
                                  active
                                    ? "border-indigo-300 bg-indigo-50"
                                    : panel.done
                                      ? "border-emerald-200 bg-emerald-50"
                                      : "border-slate-200 bg-slate-50",
                                  blocked ? "cursor-not-allowed opacity-60" : "hover:border-indigo-200 hover:bg-white",
                                )}
                              >
                                <div>
                                  <p className="text-[11px] font-semibold text-slate-900">{panel.title}</p>
                                  <p className="text-[10px] text-slate-600">{panel.description}</p>
                                </div>
                                <span
                                  className={cn(
                                    "rounded border px-2 py-0.5 text-[10px] font-semibold",
                                    panel.done
                                      ? "border-emerald-300 bg-white text-emerald-700"
                                      : active
                                        ? "border-indigo-300 bg-white text-indigo-700"
                                        : "border-slate-200 bg-white text-slate-600",
                                  )}
                                >
                                  {panel.done ? "완료" : blocked ? "잠금" : active ? "열림" : "대기"}
                                </span>
                              </button>
                            );
                          })}

                          {stage3Step2Errors.length > 0 ? (
                            <div className="rounded-md border border-rose-200 bg-rose-50 p-2">
                              <p className="text-[11px] font-semibold text-rose-700">필수 항목 누락 {stage3Step2Errors.length}건</p>
                              <ul className="mt-1 space-y-1">
                                {stage3Step2Errors.map((entry) => (
                                  <li key={entry.key}>
                                    <button
                                      type="button"
                                      onClick={() => focusStage3ErrorField(entry.key as Stage3TaskFieldKey)}
                                      className="text-[11px] text-rose-700 underline decoration-dotted underline-offset-2"
                                    >
                                      - {entry.message}
                                    </button>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          ) : null}
                        </div>

                        <div className="space-y-3 rounded-md border border-slate-200 bg-slate-50 p-3">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="text-xs font-semibold text-slate-800">전화/문자 실행 패널</p>
                            <span className="text-[10px] text-slate-500">Stage1 상담/문자 시스템 재사용</span>
                          </div>
                          <div className="rounded-md border border-slate-200 bg-white p-2">
                            <p className="text-xs font-semibold text-slate-800">이전 검사 요약</p>
                            <ul className="mt-1 space-y-1 text-[11px] text-slate-600">
                              {previousExamSummary.map((item) => (
                                <li key={item}>• {item}</li>
                              ))}
                            </ul>
                          </div>
                          <div className="grid grid-cols-3 gap-1">
                            <button
                              type="button"
                              onClick={() => {
                                clearStage3FieldError("CONTACT_EXECUTION", "step2CallRecord");
                                setStage3Step2Flow((prev) => ({ ...prev, consultStarted: true }));
                                handleCallStart();
                              }}
                              className="rounded border border-blue-200 bg-blue-50 px-2 py-1 text-[10px] font-semibold text-blue-700"
                            >
                              전화상담 시작
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                const first = highPriorityRecs[0];
                                if (first) {
                                  handleApplyRagRecommendation(first);
                                  setStage3Step2Flow((prev) => ({ ...prev, consultStarted: true }));
                                  toast.success("스크립트 추천을 적용했습니다.");
                                } else {
                                  toast("추천 스크립트가 아직 없습니다.");
                                }
                              }}
                              className="rounded border border-indigo-200 bg-indigo-50 px-2 py-1 text-[10px] font-semibold text-indigo-700"
                            >
                              스크립트 추천
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                if (!callMemo.trim()) {
                                  applyStage3ValidationErrors("CONTACT_EXECUTION", {
                                    ...stage3FieldErrorsByStep.CONTACT_EXECUTION,
                                    step2CallRecord: "통화 메모를 입력해 주세요.",
                                  });
                                  toast.error("통화 메모를 먼저 입력해 주세요.");
                                  return;
                                }
                                clearStage3FieldError("CONTACT_EXECUTION", "step2CallRecord");
                                setStage3Step2Flow((prev) => ({ ...prev, infoCollected: true }));
                                setStage3DiffDraft((prev) => ({ ...prev, note: callMemo.trim() }));
                                appendAuditLog(`Stage3 통화 메모 반영: ${callMemo.slice(0, 60)}`);
                              }}
                              className="rounded border border-slate-200 bg-white px-2 py-1 text-[10px] font-semibold text-slate-700"
                            >
                              통화 메모 반영
                            </button>
                          </div>
                          <label className="text-[11px] text-slate-600">
                            통화 메모 요약(필수)
                            <textarea
                              ref={registerStage3FieldRef("step2CallRecord")}
                              value={callMemo}
                              onChange={(event) => {
                                clearStage3FieldError("CONTACT_EXECUTION", "step2CallRecord");
                                setCallMemo(event.target.value);
                              }}
                              className={stage3FieldClass(
                                "CONTACT_EXECUTION",
                                "step2CallRecord",
                                "mt-1 h-14 w-full rounded-md border border-gray-200 px-2 py-1 text-[11px] outline-none focus:border-indigo-300",
                              )}
                              placeholder="전화 상담 핵심 내용을 요약하세요."
                            />
                            {stage3CurrentStepErrors.step2CallRecord ? (
                              <p className="mt-1 text-[10px] font-semibold text-rose-600">{stage3CurrentStepErrors.step2CallRecord}</p>
                            ) : null}
                          </label>

                          <SmsPanel
                            stageLabel="3차"
                            templates={smsTemplatesForExecutor}
                            defaultVars={{
                              centerName: DEFAULT_CENTER_NAME,
                              centerPhone: DEFAULT_CENTER_PHONE,
                              bookingLink: reservationInfoToBookingLine(detail.reservationInfo),
                            }}
                            caseId={detail.header.caseId}
                            citizenPhone={caseRecord?.profile.phone ?? "010-0000-0000"}
                            guardianPhone={caseRecord?.profile.guardianPhone}
                            callScripts={callScriptsForModal}
                            compact
                            onConsultation={handleStage3Step2Consultation}
                            onSmsSent={handleStage3Step2SmsSent}
                          />
                        </div>
                      </div>

                      <div className="mx-auto mt-3 max-w-[1100px] space-y-3 px-2 md:px-8">
                        {stage3Step2ActivePanel === "REVIEW" ? (
                        <div id="stage3-step2-panel-review" className="space-y-3 rounded-md border border-slate-200 bg-slate-50 p-3">
                          <div className="rounded-md border border-slate-200 bg-white p-2">
                            <p className="text-xs font-semibold text-slate-800">이전 검사 요약</p>
                            <ul className="mt-1 space-y-1 text-[11px] text-slate-600">
                              {previousExamSummary.map((item) => (
                                <li key={item}>• {item}</li>
                              ))}
                            </ul>
                          </div>
                          <p className="text-[11px] text-slate-600">
                            전화/문자 실행은 우측 패널에서 상시 확인·수행할 수 있습니다.
                          </p>
                        </div>
                        ) : null}

                        {stage3Step2ActivePanel === "BOOKING" || stage3Step2ActivePanel === "RESULT" ? (
                        <div id="stage3-step2-panel-booking" className="space-y-3 rounded-md border border-slate-200 bg-slate-50 p-3">
                          <p className="text-xs font-semibold text-slate-800">연계/예약 폼</p>
                          <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                            <label className="text-[11px] text-slate-600">
                              병원/기관(필수)
                              <input
                                ref={registerStage3FieldRef("step2Hospital")}
                                value={stage3DiffDraft.preferredHospital}
                                onChange={(event) => {
                                  clearStage3FieldError("CONTACT_EXECUTION", "step2Hospital");
                                  setStage3DiffDraft((prev) => ({ ...prev, preferredHospital: event.target.value }));
                                }}
                                className={stage3FieldClass(
                                  "CONTACT_EXECUTION",
                                  "step2Hospital",
                                  "mt-1 h-8 w-full rounded-md border border-gray-200 px-2 text-[11px] outline-none focus:border-indigo-300",
                                )}
                              />
                              {stage3CurrentStepErrors.step2Hospital ? (
                                <p className="mt-1 text-[10px] font-semibold text-rose-600">{stage3CurrentStepErrors.step2Hospital}</p>
                              ) : null}
                            </label>
                            <label className="text-[11px] text-slate-600">
                              예약 일시(필수)
                              <input
                                ref={registerStage3FieldRef("step2BookingAt")}
                                type="datetime-local"
                                value={toDateTimeLocalValue(stage3DiffDraft.bookingAt)}
                                onChange={(event) => {
                                  clearStage3FieldError("CONTACT_EXECUTION", "step2BookingAt");
                                  setStage3DiffDraft((prev) => ({
                                    ...prev,
                                    bookingAt: fromDateTimeLocalValue(event.target.value) || prev.bookingAt,
                                  }));
                                }}
                                className={stage3FieldClass(
                                  "CONTACT_EXECUTION",
                                  "step2BookingAt",
                                  "mt-1 h-8 w-full rounded-md border border-gray-200 px-2 text-[11px] outline-none focus:border-indigo-300",
                                )}
                              />
                              {stage3CurrentStepErrors.step2BookingAt ? (
                                <p className="mt-1 text-[10px] font-semibold text-rose-600">{stage3CurrentStepErrors.step2BookingAt}</p>
                              ) : null}
                            </label>
                          </div>
                          <div
                            ref={registerStage3FieldRef("step2TestSelection")}
                            className={cn(
                              "grid grid-cols-3 gap-2 rounded-md border border-slate-200 bg-white p-2 text-[11px] text-slate-700",
                              stage3CurrentStepErrors.step2TestSelection ? "border-rose-300 bg-rose-50" : "",
                            )}
                          >
                            <label className="flex items-center gap-1">
                              <input
                                type="checkbox"
                                checked={stage3DiffDraft.testBiomarker}
                                onChange={(event) => {
                                  clearStage3FieldError("CONTACT_EXECUTION", "step2TestSelection");
                                  setStage3DiffDraft((prev) => ({ ...prev, testBiomarker: event.target.checked }));
                                }}
                              />
                              바이오마커
                            </label>
                            <label className="flex items-center gap-1">
                              <input
                                type="checkbox"
                                checked={stage3DiffDraft.testBrainImaging}
                                onChange={(event) => {
                                  clearStage3FieldError("CONTACT_EXECUTION", "step2TestSelection");
                                  setStage3DiffDraft((prev) => ({ ...prev, testBrainImaging: event.target.checked }));
                                }}
                              />
                              뇌영상
                            </label>
                            <label className="flex items-center gap-1">
                              <input
                                type="checkbox"
                                checked={stage3DiffDraft.testOther}
                                onChange={(event) => {
                                  clearStage3FieldError("CONTACT_EXECUTION", "step2TestSelection");
                                  setStage3DiffDraft((prev) => ({ ...prev, testOther: event.target.checked }));
                                }}
                              />
                              기타 검사
                            </label>
                          </div>
                          {stage3CurrentStepErrors.step2TestSelection ? (
                            <p className="text-[10px] font-semibold text-rose-600">{stage3CurrentStepErrors.step2TestSelection}</p>
                          ) : null}

                          <details
                            open={stage3AdditionalInfoOpen}
                            onToggle={(event) => setStage3AdditionalInfoOpen((event.target as HTMLDetailsElement).open)}
                            className="rounded-md border border-slate-200 bg-white p-2"
                          >
                            <summary className="cursor-pointer text-[11px] font-semibold text-slate-700">추가 정보(선택)</summary>
                            <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-2">
                              <label className="text-[11px] text-slate-600">
                                연락처
                                <input
                                  value={stage3DiffDraft.orgPhone}
                                  onChange={(event) => setStage3DiffDraft((prev) => ({ ...prev, orgPhone: event.target.value }))}
                                  className="mt-1 h-8 w-full rounded-md border border-gray-200 px-2 text-[11px] outline-none focus:border-indigo-300"
                                />
                              </label>
                              <label className="text-[11px] text-slate-600">
                                대체 일정
                                <input
                                  type="datetime-local"
                                  value={toDateTimeLocalValue(stage3DiffDraft.bookingAltAt)}
                                  onChange={(event) =>
                                    setStage3DiffDraft((prev) => ({
                                      ...prev,
                                      bookingAltAt: fromDateTimeLocalValue(event.target.value) || prev.bookingAltAt,
                                    }))
                                  }
                                  className="mt-1 h-8 w-full rounded-md border border-gray-200 px-2 text-[11px] outline-none focus:border-indigo-300"
                                />
                              </label>
                            </div>
                            <label className="mt-2 block text-[11px] text-slate-600">
                              안내/준비사항
                              <textarea
                                value={stage3DiffDraft.prepGuide}
                                onChange={(event) => setStage3DiffDraft((prev) => ({ ...prev, prepGuide: event.target.value }))}
                                className="mt-1 h-14 w-full rounded-md border border-gray-200 px-2 py-1 text-[11px] outline-none focus:border-indigo-300"
                              />
                            </label>
                            <label className="mt-2 block text-[11px] text-slate-600">
                              운영 메모
                              <textarea
                                value={stage3DiffDraft.note}
                                onChange={(event) => setStage3DiffDraft((prev) => ({ ...prev, note: event.target.value }))}
                                className="mt-1 h-16 w-full rounded-md border border-gray-200 px-2 py-1 text-[11px] outline-none focus:border-indigo-300"
                              />
                            </label>
                          </details>

                          <div className="rounded-md border border-indigo-200 bg-white p-2">
                            <div className="flex flex-wrap items-center gap-1">
                              <button
                                type="button"
                                onClick={runStage3RagAutoFill}
                                className="rounded border border-indigo-200 bg-indigo-50 px-2 py-1 text-[10px] font-semibold text-indigo-700"
                              >
                                RAG 자동 채움
                              </button>
                              {stage3RagAutoFill ? (
                                <>
                                  <button
                                    type="button"
                                    onClick={applyStage3RagAutoFill}
                                    className="rounded border border-emerald-200 bg-emerald-50 px-2 py-1 text-[10px] font-semibold text-emerald-700"
                                  >
                                    적용
                                  </button>
                                  <button
                                    type="button"
                                    onClick={ignoreStage3RagAutoFill}
                                    className="rounded border border-slate-200 bg-white px-2 py-1 text-[10px] font-semibold text-slate-700"
                                  >
                                    무시
                                  </button>
                                </>
                              ) : null}
                            </div>
                            {stage3RagAutoFill ? (
                              <div className="mt-2 rounded border border-slate-200 bg-slate-50 p-2 text-[10px] text-slate-600">
                                <p className="font-semibold text-slate-800">
                                  추천 입력(확인 필요) · 신뢰도 {stage3RagAutoFill.confidenceLabel}
                                </p>
                                <p className="mt-1">변경 필드: {stage3RagAutoFill.changedFields.join(", ") || "없음"}</p>
                                {stage3RagAutoFill.reasonSnippets.map((snippet) => (
                                  <p key={snippet} className="mt-0.5">- {snippet}</p>
                                ))}
                              </div>
                            ) : null}
                          </div>

                          <div className="rounded-md border border-emerald-200 bg-emerald-50 p-2">
                            <p className="text-[10px] text-emerald-800">
                              {isDiffPathFlow
                                ? "예약 확정 패키지: 예약 저장 + 확인 문자 + 캘린더 등록 + 감사 로그 기록"
                                : "추적 계획 패키지: 다음 연락 일정 저장 + 안내 문자 + 캘린더 등록 + 감사 로그 기록"}
                            </p>
                            <button
                              type="button"
                              onClick={runStage3BookingBundle}
                              disabled={!approvedReady}
                              className="mt-2 w-full rounded-md border border-emerald-300 bg-white px-2 py-1.5 text-[11px] font-semibold text-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {isDiffPathFlow ? "예약 확정 패키지 실행" : "추적 계획 패키지 실행"}
                            </button>
                            {!approvedReady ? <p className="mt-1 text-[10px] text-amber-700">승인 대기 액션을 먼저 처리하세요.</p> : null}
                          </div>

                          <label id="stage3-step2-panel-result" className="flex items-center gap-1 text-[11px] font-semibold text-slate-700">
                            <input
                              type="checkbox"
                              checked={stage3ShowResultCollection}
                              onChange={(event) => setStage3ShowResultCollection(event.target.checked)}
                            />
                            검사 완료/결과 수신 입력 열기 (Step3 진입 필수)
                          </label>
                          {stage3ShowResultCollection ? (
                            <div className="rounded-md border border-slate-200 bg-white p-2">
                              <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                                <label className="text-[11px] text-slate-600">
                                  수행 일시(필수)
                                  <input
                                    ref={registerStage3FieldRef("step2PerformedAt")}
                                    type="datetime-local"
                                    value={toDateTimeLocalValue(stage3DiffDraft.resultPerformedAt)}
                                    onChange={(event) => {
                                      clearStage3FieldError("CONTACT_EXECUTION", "step2PerformedAt");
                                      setStage3DiffDraft((prev) => ({
                                        ...prev,
                                        resultPerformedAt: fromDateTimeLocalValue(event.target.value) || "",
                                      }));
                                    }}
                                    className={stage3FieldClass(
                                      "CONTACT_EXECUTION",
                                      "step2PerformedAt",
                                      "mt-1 h-8 w-full rounded-md border border-gray-200 px-2 text-[11px] outline-none focus:border-indigo-300",
                                    )}
                                  />
                                  {stage3CurrentStepErrors.step2PerformedAt ? (
                                    <p className="mt-1 text-[10px] font-semibold text-rose-600">{stage3CurrentStepErrors.step2PerformedAt}</p>
                                  ) : null}
                                </label>
                                <label className="text-[11px] text-slate-600">
                                  결과 라벨
                                  <select
                                    value={stage3DiffDraft.resultLabel}
                                    onChange={(event) =>
                                      setStage3DiffDraft((prev) => ({
                                        ...prev,
                                        resultLabel: event.target.value as Stage3DiffDraft["resultLabel"],
                                      }))
                                    }
                                    className="mt-1 h-8 w-full rounded-md border border-gray-200 px-2 text-[11px] outline-none focus:border-indigo-300"
                                  >
                                    <option value="양성 신호">양성 신호</option>
                                    <option value="음성 신호">음성 신호</option>
                                    <option value="불확실">불확실</option>
                                  </select>
                                </label>
                                <label className="text-[11px] text-slate-600">
                                  바이오마커 결과({isDiffPathFlow ? "필수" : "선택"})
                                  <input
                                    ref={registerStage3FieldRef("step2BiomarkerResult")}
                                    value={stage3DiffDraft.biomarkerResultText ?? ""}
                                    onChange={(event) => {
                                      clearStage3FieldError("CONTACT_EXECUTION", "step2BiomarkerResult");
                                      setStage3DiffDraft((prev) => ({
                                        ...prev,
                                        biomarkerResultText: event.target.value,
                                      }));
                                    }}
                                    className={stage3FieldClass(
                                      "CONTACT_EXECUTION",
                                      "step2BiomarkerResult",
                                      "mt-1 h-8 w-full rounded-md border border-gray-200 px-2 text-[11px] outline-none focus:border-indigo-300",
                                    )}
                                  />
                                  {stage3CurrentStepErrors.step2BiomarkerResult ? (
                                    <p className="mt-1 text-[10px] font-semibold text-rose-600">
                                      {stage3CurrentStepErrors.step2BiomarkerResult}
                                    </p>
                                  ) : null}
                                </label>
                                <label className="text-[11px] text-slate-600">
                                  뇌영상 결과({isDiffPathFlow ? "필수" : "선택"})
                                  <input
                                    ref={registerStage3FieldRef("step2ImagingResult")}
                                    value={stage3DiffDraft.imagingResultText ?? ""}
                                    onChange={(event) => {
                                      clearStage3FieldError("CONTACT_EXECUTION", "step2ImagingResult");
                                      setStage3DiffDraft((prev) => ({
                                        ...prev,
                                        imagingResultText: event.target.value,
                                      }));
                                    }}
                                    className={stage3FieldClass(
                                      "CONTACT_EXECUTION",
                                      "step2ImagingResult",
                                      "mt-1 h-8 w-full rounded-md border border-gray-200 px-2 text-[11px] outline-none focus:border-indigo-300",
                                    )}
                                  />
                                  {stage3CurrentStepErrors.step2ImagingResult ? (
                                    <p className="mt-1 text-[10px] font-semibold text-rose-600">
                                      {stage3CurrentStepErrors.step2ImagingResult}
                                    </p>
                                  ) : null}
                                </label>
                              </div>
                              <label className="mt-2 block text-[11px] text-slate-600">
                                결과 요약(필수)
                                <textarea
                                  ref={registerStage3FieldRef("step2ResultSummary")}
                                  value={stage3DiffDraft.resultSummary}
                                  onChange={(event) => {
                                    clearStage3FieldError("CONTACT_EXECUTION", "step2ResultSummary");
                                    setStage3DiffDraft((prev) => ({ ...prev, resultSummary: event.target.value }));
                                  }}
                                  className={stage3FieldClass(
                                    "CONTACT_EXECUTION",
                                    "step2ResultSummary",
                                    "mt-1 h-16 w-full rounded-md border border-gray-200 px-2 py-1 text-[11px] outline-none focus:border-indigo-300",
                                  )}
                                  placeholder="결과 요약을 입력하세요."
                                />
                                {stage3CurrentStepErrors.step2ResultSummary ? (
                                  <p className="mt-1 text-[10px] font-semibold text-rose-600">{stage3CurrentStepErrors.step2ResultSummary}</p>
                                ) : null}
                              </label>
                              <button
                                type="button"
                                onClick={() => {
                                  const resultErrors: Stage3TaskFieldErrors = {};
                                  if (!stage3DiffDraft.resultPerformedAt) {
                                    resultErrors.step2PerformedAt = "결과 수행 일시를 입력하세요.";
                                  }
                                  if (isDiffPathFlow && !stage3DiffDraft.biomarkerResultText?.trim()) {
                                    resultErrors.step2BiomarkerResult = "바이오마커 결과를 입력하세요.";
                                  }
                                  if (isDiffPathFlow && !stage3DiffDraft.imagingResultText?.trim()) {
                                    resultErrors.step2ImagingResult = "뇌영상 결과를 입력하세요.";
                                  }
                                  if (!stage3DiffDraft.resultSummary.trim()) {
                                    resultErrors.step2ResultSummary = "결과 요약을 입력하세요.";
                                  }
                                  if (Object.keys(resultErrors).length > 0) {
                                    applyStage3ValidationErrors("CONTACT_EXECUTION", {
                                      ...stage3FieldErrorsByStep.CONTACT_EXECUTION,
                                      ...resultErrors,
                                    });
                                    toast.error("결과 수집 항목을 확인해 주세요.");
                                    return;
                                  }
                                  setStage3FieldErrorsByStep((prev) => {
                                    const nextErrors = { ...(prev.CONTACT_EXECUTION ?? {}) };
                                    delete nextErrors.step2PerformedAt;
                                    delete nextErrors.step2BiomarkerResult;
                                    delete nextErrors.step2ImagingResult;
                                    delete nextErrors.step2ResultSummary;
                                    return {
                                      ...prev,
                                      CONTACT_EXECUTION: nextErrors,
                                    };
                                  });
                                  handleStage3DiffPathAction("APPLY_RESULT");
                                  toast.success("검사 결과가 반영되었습니다.");
                                }}
                                className="mt-2 rounded border border-indigo-200 bg-indigo-50 px-3 py-1 text-[11px] font-semibold text-indigo-700"
                              >
                                결과 수집/입력 반영
                              </button>
                            </div>
                          ) : null}
                        </div>
                        ) : null}

                        {stage3Step2ActivePanel === "MODEL" ? (
                          <div id="stage3-step2-panel-model" className="rounded-md border border-indigo-200 bg-indigo-50 p-3">
                            <p className="text-xs font-semibold text-indigo-900">모델 판정 상태</p>
                            <p className="mt-1 text-[11px] text-indigo-800">
                              상태 {stage3InferenceState.jobStatus} · 진행률 {Math.round(stage3InferenceState.progress)}%
                              {stage3InferenceState.updatedAt ? ` · 업데이트 ${formatDateTime(stage3InferenceState.updatedAt)}` : ""}
                            </p>
                            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-indigo-100">
                              <div
                                className="h-full rounded-full bg-indigo-500 transition-all duration-700"
                                style={{ width: `${Math.round(stage3InferenceState.progress)}%` }}
                              />
                            </div>
                            <button
                              type="button"
                              onClick={() => handleStage3DiffPathAction("APPLY_RESULT")}
                              className="mt-2 rounded border border-indigo-300 bg-white px-2 py-1 text-[10px] font-semibold text-indigo-700"
                            >
                              모델 결과 상태 갱신
                            </button>
                          </div>
                        ) : null}

                        {stage3Step2ActivePanel === "TRANSITION" ? (
                          <div id="stage3-step2-panel-transition" className="rounded-md border border-emerald-200 bg-emerald-50 p-3">
                            <p className="text-xs font-semibold text-emerald-900">Stage3 전이 여부 확정</p>
                            <p className="mt-1 text-[11px] text-emerald-800">
                              {stage3DiffReadyForRisk
                                ? "결과 반영이 완료되었습니다. 다음 단계에서 위험 추적/모델 확인을 진행하세요."
                                : "아직 결과 수집이 완료되지 않아 다음 단계가 잠겨 있습니다."}
                            </p>
                            <button
                              type="button"
                              onClick={() => moveStage3TaskStep(1)}
                              disabled={!stage3DiffReadyForRisk}
                              className="mt-2 rounded border border-emerald-300 bg-white px-2 py-1 text-[10px] font-semibold text-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              Step3(위험 예측/추적)로 이동
                            </button>
                          </div>
                        ) : null}
                      </div>

                      <div className="mt-3 rounded-md border border-gray-200 bg-gray-50 p-2">
                        <p className="text-[11px] font-semibold text-slate-700">승인 필요 액션</p>
                        <div className="mt-1 space-y-1">
                          {(detail.stage3?.recommendedActions ?? [])
                            .filter((action) => action.requiresApproval)
                            .map((action) => (
                              <div key={action.id} className="flex items-center justify-between rounded border border-slate-200 bg-white px-2 py-1">
                                <div>
                                  <p className="text-[11px] font-semibold text-slate-800">{action.title}</p>
                                  <p className="text-[10px] text-slate-500">{action.reason}</p>
                                </div>
                                <div className="flex items-center gap-1">
                                  <button
                                    onClick={() => applyStage3ActionDecision(action.id, "APPROVED")}
                                    className="rounded border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700"
                                  >
                                    승인
                                  </button>
                                  <button
                                    onClick={() => applyStage3ActionDecision(action.id, "HOLD")}
                                    className="rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] font-semibold text-slate-700"
                                  >
                                    보류
                                  </button>
                                </div>
                              </div>
                            ))}
                          {(detail.stage3?.recommendedActions ?? []).filter((action) => action.requiresApproval).length === 0 ? (
                            <p className="rounded border border-slate-200 bg-white px-2 py-1 text-[10px] text-slate-500">
                              승인 대기 액션이 없습니다.
                            </p>
                          ) : null}
                        </div>
                      </div>
                    </section>
                  );
                })()
              : null}

            {stage3TaskModalStep === "RESPONSE_HANDLING" ? (
              isStage2OpsView ? (
                <section className="rounded-lg border border-gray-200 bg-white p-4">
                  <h4 className="text-sm font-bold text-slate-900">분류 확정</h4>
                  <p className="mt-1 text-[11px] text-gray-600">
                    정상/MCI/치매 분류를 담당자 확인으로 확정합니다. 모델 확률은 운영 참고 정보입니다.
                  </p>
                  <div className="mt-3">
                    <StepChecklist items={STAGE2_TASK_CHECKLIST.RESPONSE_HANDLING} />
                  </div>
                  {(() => {
                    const stage2Step3Errors = stage2ErrorSummaryEntries.filter(
                      (entry) =>
                        entry.key === "classification" ||
                        entry.key === "rationale" ||
                        entry.key === "overrideReason" ||
                        entry.key === "mmse" ||
                        entry.key === "cdr" ||
                        entry.key === "neuro" ||
                        entry.key === "specialist",
                    );
                    const stage2TimeFlow = [
                      ...detail.timeline
                        .filter((event) =>
                          event.type === "STAGE2_PLAN_CONFIRMED" ||
                          event.type === "STAGE2_RESULTS_RECORDED" ||
                          event.type === "DIFF_RESULT_APPLIED" ||
                          event.type === "STAGE2_CLASS_CONFIRMED" ||
                          event.type === "INFERENCE_STARTED" ||
                          event.type === "INFERENCE_COMPLETED" ||
                          event.type === "INFERENCE_FAILED",
                        )
                        .slice(0, 6)
                        .map((event) => ({
                          at: event.at,
                          label: eventTitle(event),
                          summary: event.summary,
                        })),
                      ...(stage2InferenceState.updatedAt
                        ? [
                            {
                              at: stage2InferenceState.updatedAt,
                              label:
                                stage2InferenceState.jobStatus === "RUNNING"
                                  ? "모델 실행 시작"
                                  : stage2InferenceState.jobStatus === "DONE"
                                    ? "모델 결과 생성"
                                    : stage2InferenceState.jobStatus === "FAILED"
                                      ? "모델 실행 실패"
                                      : "모델 실행 대기",
                              summary:
                                stage2InferenceState.jobStatus === "DONE"
                                  ? `추천 분류 ${stage2ModelRecommendedLabel ?? "-"}`
                                  : "검사 결과 반영 후 모델 결과를 갱신합니다.",
                            },
                          ]
                        : []),
                    ]
                      .sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime())
                      .slice(-6);
                    const modelStatusChip =
                      stage2InferenceState.jobStatus === "DONE"
                        ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                        : stage2InferenceState.jobStatus === "RUNNING"
                          ? "bg-blue-50 border-blue-200 text-blue-700"
                          : stage2InferenceState.jobStatus === "FAILED"
                            ? "bg-rose-50 border-rose-200 text-rose-700"
                            : "bg-slate-100 border-slate-200 text-slate-700";
                    const modelReadyForConfirm = stage2ModelReady && stage2DraftProbs;
                    return (
                      <>
                        <div className="mt-3 rounded-md border border-slate-200 bg-slate-50 p-3">
                          <p className="text-xs font-semibold text-slate-800">Stage2 처리 흐름</p>
                          <div className="mt-2 space-y-1.5">
                            {stage2TimeFlow.length > 0 ? (
                              stage2TimeFlow.map((event) => (
                                <div key={`${event.at}-${event.label}`} className="rounded border border-slate-200 bg-white px-2 py-1.5 text-[10px]">
                                  <p className="font-semibold text-slate-700">{event.label}</p>
                                  <p className="text-slate-500">{formatDateTime(event.at)}</p>
                                  <p className="text-slate-600">{event.summary}</p>
                                </div>
                              ))
                            ) : (
                              <p className="rounded border border-slate-200 bg-white px-2 py-1 text-[10px] text-slate-500">
                                단계 이벤트가 아직 없습니다.
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="mt-3 rounded-md border border-indigo-200 bg-indigo-50 p-3">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="text-xs font-semibold text-indigo-900">모델 산출 상태</p>
                            <span className={cn("rounded border px-2 py-0.5 text-[10px] font-semibold", modelStatusChip)}>
                              {stage2InferenceState.jobStatus}
                            </span>
                          </div>
                          <p className="mt-1 text-[11px] text-indigo-800">
                            추천 분류: {stage2ModelRecommendedLabel ?? "대기"} · 업데이트 {formatDateTime(stage2InferenceState.updatedAt)}
                          </p>
                          {stage2InferenceState.jobStatus === "RUNNING" ? (
                            <div className="mt-2 rounded-md border border-blue-200 bg-white px-2 py-2">
                              <div className="flex items-center justify-between text-[10px] text-blue-700">
                                <span>모델 결과 생성 중</span>
                                <span>{Math.round(stage2InferenceState.progress)}%</span>
                              </div>
                              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-blue-100">
                                <div
                                  className="h-full rounded-full bg-blue-500 transition-all duration-700"
                                  style={{ width: `${Math.round(stage2InferenceState.progress)}%` }}
                                />
                              </div>
                              <p className="mt-1 text-[10px] text-blue-700">
                                ETA {formatEtaLabel(stage2InferenceState.etaSeconds)}
                                {stage2InferenceState.buffered ? " · 버퍼링 진행률(추정)" : ""}
                              </p>
                            </div>
                          ) : null}
                          {stage2InferenceState.jobStatus === "FAILED" ? (
                            <div className="mt-2 rounded-md border border-rose-200 bg-white px-2 py-2 text-[10px] text-rose-700">
                              <p>모델 실행이 실패했습니다. 재시도 후 분류 확정을 진행하세요.</p>
                              <button
                                type="button"
                                onClick={() => {
                                  const now = nowIso();
                                  setStage2ModelRunState((prev) => ({
                                    ...prev,
                                    status: "RUNNING",
                                    startedAt: now,
                                    updatedAt: now,
                                    completedAt: undefined,
                                    progress: 4,
                                    etaSeconds: null,
                                    failureReason: undefined,
                                    recommendedLabel: prev.recommendedLabel ?? deriveStage2ModelRecommendation(stage2Diagnosis.tests),
                                  }));
                                  appendTimeline({
                                    type: "INFERENCE_REQUESTED",
                                    stage: 2,
                                    at: now,
                                    by: detail.header.assigneeName,
                                    summary: "Stage2 모델 재실행 요청",
                                  });
                                  appendTimeline({
                                    type: "INFERENCE_STARTED",
                                    stage: 2,
                                    at: now,
                                    by: detail.header.assigneeName,
                                    summary: "Stage2 모델 재실행 시작",
                                  });
                                  appendAuditLog("Stage2 모델 재실행 요청");
                                }}
                                className="mt-2 rounded border border-rose-300 bg-white px-2 py-1 text-[10px] font-semibold text-rose-700"
                              >
                                재시도
                              </button>
                            </div>
                          ) : null}
                          <p className="text-[10px] text-indigo-700">
                            모델 결과는 운영 참고용이며, 최종 분류 확정은 담당자 판단으로 기록됩니다.
                          </p>
                        </div>

                        {stage2Step3Errors.length > 0 ? (
                          <div className="mt-3 rounded-md border border-rose-200 bg-rose-50 p-2">
                            <p className="text-[11px] font-semibold text-rose-700">누락/오류 항목</p>
                            <ul className="mt-1 space-y-1">
                              {stage2Step3Errors.map((entry) => (
                                <li key={entry.key}>
                                  <button
                                    type="button"
                                    onClick={() => focusStage2ErrorField(entry.key)}
                                    className="text-[11px] text-rose-700 underline decoration-dotted underline-offset-2"
                                  >
                                    - {entry.message}
                                  </button>
                                </li>
                              ))}
                            </ul>
                          </div>
                        ) : null}

                        <div className="mt-3 rounded-md border border-slate-200 bg-slate-50 p-3">
                          {modelReadyForConfirm ? (
                            <Stage2ClassificationViz
                              probs={stage2DraftProbs}
                              predictedLabel={stage2ModelRecommendedLabel ?? stage2ClassificationDraft}
                              mciSeverity={stage2DraftMciStage}
                              mciScore={
                                (stage2ModelRecommendedLabel ?? stage2ClassificationDraft) === "MCI"
                                  ? stage2DraftMciStage === "위험"
                                    ? 82
                                    : stage2DraftMciStage === "양호"
                                      ? 34
                                      : 58
                                  : undefined
                              }
                            />
                          ) : (
                            <ModelGateGuard stage={2} missing={stage2GateMissing} onOpenStep={focusStage2ResultInput} />
                          )}
                        </div>

                        <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
                          <label className="text-[11px] text-slate-600">
                            분류 결과
                            <select
                              ref={registerStage2FieldRef("classification")}
                              value={stage2ClassificationDraft}
                              onChange={(event) => {
                                const nextValue = event.target.value as Stage2ClassLabel;
                                clearStage2FieldError("classification");
                                clearStage2FieldError("overrideReason");
                                setStage2ClassificationEdited(true);
                                setStage2ClassificationDraft(nextValue);
                                if (stage2ModelRecommendedLabel && nextValue === stage2ModelRecommendedLabel) {
                                  setStage2ClassificationOverrideReason("");
                                }
                              }}
                              className={stage2FieldClass(
                                "classification",
                                "mt-1 h-8 w-full rounded-md border border-gray-200 px-2 text-xs outline-none focus:border-blue-300",
                              )}
                            >
                              <option value="정상">정상</option>
                              <option value="MCI">MCI</option>
                              <option value="치매">치매</option>
                            </select>
                            {stage2FieldErrors.classification ? (
                              <p className="mt-1 text-[10px] font-semibold text-rose-600">{stage2FieldErrors.classification}</p>
                            ) : null}
                            {stage2ClassificationEdited ? (
                              <p className="mt-1 text-[10px] font-semibold text-indigo-700">담당자 분류 선택이 변경되었습니다.</p>
                            ) : null}
                          </label>
                          <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] text-slate-700">
                            <p className="font-semibold">
                              <TermWithTooltip term="ANN" /> 세분화
                            </p>
                            <p className="mt-1">{stage2ClassificationDraft === "MCI" ? stage2DraftMciStage ?? "산출 대기" : "-"}</p>
                          </div>
                        </div>

                        {stage2ClassificationIsOverride ? (
                          <label className="mt-2 block text-[11px] text-slate-600">
                            모델 추천과 다르게 확정하는 사유(필수)
                            <textarea
                              ref={registerStage2FieldRef("overrideReason")}
                              value={stage2ClassificationOverrideReason}
                              onChange={(event) => {
                                clearStage2FieldError("overrideReason");
                                setStage2ClassificationOverrideReason(event.target.value);
                              }}
                              className={stage2FieldClass(
                                "overrideReason",
                                "mt-1 h-16 w-full rounded-md border border-gray-200 px-2 py-1 text-xs outline-none focus:border-blue-300",
                              )}
                              placeholder="모델 추천과 다른 분류를 선택한 사유를 입력하세요."
                            />
                            {stage2FieldErrors.overrideReason ? (
                              <p className="mt-1 text-[10px] font-semibold text-rose-600">{stage2FieldErrors.overrideReason}</p>
                            ) : null}
                          </label>
                        ) : null}

                        <label className="mt-3 block text-[11px] text-slate-600">
                          확정 근거 1줄(필수)
                          <textarea
                            ref={registerStage2FieldRef("rationale")}
                            value={stage2RationaleDraft}
                            onChange={(event) => {
                              clearStage2FieldError("rationale");
                              setStage2RationaleDraft(event.target.value);
                            }}
                            className={stage2FieldClass(
                              "rationale",
                              "mt-1 h-20 w-full rounded-md border border-gray-200 px-2 py-1 text-xs outline-none focus:border-blue-300",
                            )}
                            placeholder="예: MMSE __점, CDR/GDS __, 신경인지검사 __ 결과를 근거로 __로 분류함."
                          />
                          {stage2FieldErrors.rationale ? (
                            <p className="mt-1 text-[10px] font-semibold text-rose-600">{stage2FieldErrors.rationale}</p>
                          ) : null}
                        </label>

                        {!stage2CanConfirm ? (
                          <div className="mt-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-800">
                            {stage2MissingRequirements.map((message) => (
                              <p key={message}>- {message}</p>
                            ))}
                            {stage2OverrideMissing ? <p>- 모델 추천과 다르게 확정하는 사유를 입력하세요.</p> : null}
                            <button
                              type="button"
                              onClick={focusStage2ResultInput}
                              className="mt-2 rounded border border-amber-300 bg-white px-2 py-1 text-[10px] font-semibold text-amber-700"
                            >
                              검사 결과 입력 열기
                            </button>
                          </div>
                        ) : null}

                        <button
                          onClick={confirmStage2Classification}
                          disabled={!stage2CanConfirm}
                          className="mt-3 inline-flex items-center gap-1 rounded-md bg-[#163b6f] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#112f5a] disabled:opacity-50"
                        >
                          <ShieldCheck size={13} /> 분류 확정
                        </button>
                      </>
                    );
                  })()}
                </section>
              ) : (
                <section className="rounded-lg border border-gray-200 bg-white p-4">
                  <h4 className="text-sm font-bold text-slate-900">
                    {stage3View?.source.profile?.stage3Type === "AD_MANAGEMENT" ? "검사결과 기반 위험도 추적" : "검사결과 기반 전환 위험 예측/추적"}
                  </h4>
                  <p className="mt-1 text-[11px] text-gray-600">
                    감별경로 예약/결과 입력 이후에만 위험 추세 검토를 완료할 수 있습니다.
                  </p>
                  {!stage3ResultEvidenceReady ? (
                    <div className="mt-3">
                      <ModelGateGuard
                        stage={3}
                        missing={
                          stage3GateMissing.length > 0
                            ? stage3GateMissing
                            : ["검사 수행 일시", "바이오마커 결과", "뇌영상 결과", "결과 요약"]
                        }
                        onOpenStep={focusStage3ResultInput}
                      />
                    </div>
                  ) : stage3InferenceState.jobStatus === "FAILED" ? (
                    <div className="mt-3 rounded-md border border-rose-200 bg-rose-50 p-3 text-[11px] text-rose-800">
                      모델 실행 실패: {stage3ModelRunState.failureReason ?? "원인 미확인"}
                      <button
                        type="button"
                        onClick={() => handleStage3DiffPathAction("APPLY_RESULT")}
                        className="mt-2 block rounded border border-rose-300 bg-white px-2 py-1 text-[10px] font-semibold text-rose-700"
                      >
                        재시도
                      </button>
                    </div>
                  ) : stage3InferenceState.jobStatus !== "DONE" ? (
                    <div className="mt-3 rounded-md border border-blue-200 bg-blue-50 p-3 text-[11px] text-blue-800">
                      <p className="font-semibold">모델 결과 생성 중</p>
                      <p className="mt-1">
                        진행률 {Math.round(stage3InferenceState.progress)}% · ETA {formatEtaLabel(stage3InferenceState.etaSeconds)}
                        {stage3InferenceState.buffered ? " · 버퍼링 진행률(추정)" : ""}
                      </p>
                      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-blue-100">
                        <div
                          className="h-full rounded-full bg-blue-500 transition-all duration-700"
                          style={{ width: `${Math.round(stage3InferenceState.progress)}%` }}
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => handleStage3DiffPathAction("APPLY_RESULT")}
                        className="mt-2 block rounded border border-blue-300 bg-white px-2 py-1 text-[10px] font-semibold text-blue-700"
                      >
                        {stage3InferenceState.jobStatus === "RUNNING" ? "실행 상태 새로고침" : "모델 실행 요청"}
                      </button>
                    </div>
                  ) : !stage3DiffReadyForRisk ? (
                    <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-[11px] text-amber-800">
                      감별경로 상태가 {detail.stage3?.diffPathStatus ?? "NONE"} 입니다. STEP2에서 결과 수집/입력 반영을 먼저 완료해 주세요.
                    </div>
                  ) : (
                    <div className="mt-3 space-y-3">
                      <div className="rounded-md border border-indigo-200 bg-indigo-50 p-3">
                        <p className="text-xs font-semibold text-indigo-900">
                          {stage3View?.source.profile?.stage3Type === "AD_MANAGEMENT" ? "현재 위험지수" : "2년 전환 위험도"}{" "}
                          {toPercentValue(detail.stage3?.transitionRisk.risk2y_now ?? 0)}%
                        </p>
                        <p className="mt-1 text-[11px] text-indigo-800">
                          신뢰 {deriveStage3RiskLabel(detail.stage3?.transitionRisk.risk2y_now ?? 0)} · 추세 {detail.stage3?.transitionRisk.trend} · 모델{" "}
                          {detail.stage3?.transitionRisk.modelVersion}
                        </p>
                        {detail.stage3 ? (
                          <RiskTrendChart
                            risk={detail.stage3.transitionRisk}
                            stage2OpsView={false}
                            stage3Type={resolvedStage3TypeForUi}
                          />
                        ) : null}
                      </div>
                      <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
                        <label className="text-[11px] text-slate-600">
                          추세 검토 메모(필수)
                          <textarea
                            value={stage3RiskReviewDraft.memo}
                            onChange={(event) => setStage3RiskReviewDraft((prev) => ({ ...prev, memo: event.target.value }))}
                            className="mt-1 h-24 w-full rounded-md border border-gray-200 px-2 py-1 text-[11px] outline-none focus:border-indigo-300"
                            placeholder="왜 위험이 상승/하락했는지, 어떤 후속 조치가 필요한지 기록하세요."
                          />
                        </label>
                        <div>
                          <label className="text-[11px] text-slate-600">다음 액션</label>
                          <select
                            value={stage3RiskReviewDraft.nextAction}
                            onChange={(event) =>
                              setStage3RiskReviewDraft((prev) => ({
                                ...prev,
                                nextAction: event.target.value as Stage3RiskReviewDraft["nextAction"],
                              }))
                            }
                            className="mt-1 h-8 w-full rounded-md border border-gray-200 px-2 text-[11px] outline-none focus:border-indigo-300"
                          >
                            {Object.entries(STAGE3_RISK_NEXT_ACTION_LABELS).map(([value, label]) => (
                              <option key={value} value={value}>
                                {label}
                              </option>
                            ))}
                          </select>
                          <button
                            onClick={() =>
                              handleStage3RiskReview({
                                summary: `중간 검토: ${stage3RiskReviewDraft.memo || "메모 없음"} · 다음 액션: ${STAGE3_RISK_NEXT_ACTION_LABELS[stage3RiskReviewDraft.nextAction]}`,
                                nextAction: stage3RiskReviewDraft.nextAction,
                              })
                            }
                            className="mt-3 rounded-md border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-[11px] font-semibold text-indigo-700 hover:bg-indigo-100"
                          >
                            추세 검토 기록
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </section>
              )
            ) : null}

            {stage3TaskModalStep === "FOLLOW_UP" ? (
              isStage2OpsView ? (
                <section className="space-y-3 rounded-lg border border-gray-200 bg-white p-4">
                  <h4 className="text-sm font-bold text-slate-900">다음 단계 결정</h4>
                  <p className="text-[11px] text-gray-600">
                    분류 확정 결과를 기준으로 정상 추적/Stage3 진입/감별 경로 중 1개를 결정하고 기록합니다.
                  </p>
                  <StepChecklist items={STAGE2_TASK_CHECKLIST.FOLLOW_UP} />

                  <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
                    <p className="text-xs font-semibold text-slate-800">다음 단계 선택</p>
                    <p className="mt-1 text-[11px] text-slate-600">
                      현재 분류: {stage2CurrentLabel}
                      {stage2CurrentLabel === "MCI" && stage2CurrentMciStage ? ` (${stage2CurrentMciStage})` : ""}
                    </p>
                    <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-3">
                      <button
                        onClick={() => setStage2NextStep("FOLLOWUP_2Y", "정상 분류로 2년 후 선별검사 일정 생성")}
                        disabled={!stage2Step4Selectable || stage2CurrentLabel !== "정상"}
                        className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-[11px] font-semibold text-slate-700 disabled:opacity-50"
                      >
                        정상 → 2년 후 선별
                      </button>
                      <button
                        onClick={() => setStage2NextStep("STAGE3", "MCI/치매 분류로 Stage3 진입 생성")}
                        disabled={!stage2Step4Selectable || !stage2NeedsStage3(stage2CurrentLabel)}
                        className="rounded-md border border-blue-200 bg-blue-50 px-2 py-1.5 text-[11px] font-semibold text-blue-700 disabled:opacity-50"
                      >
                        MCI → Stage3 진입
                      </button>
                      <button
                        onClick={() => setStage2NextStep("DIFF_PATH", "치매 분류로 감별검사 경로 전환")}
                        disabled={!stage2Step4Selectable || stage2CurrentLabel !== "치매"}
                        className="rounded-md border border-rose-200 bg-rose-50 px-2 py-1.5 text-[11px] font-semibold text-rose-700 disabled:opacity-50"
                      >
                        치매 → 감별 경로
                      </button>
                    </div>
                  </div>

                  <div className="rounded-md border border-indigo-200 bg-indigo-50 p-3">
                    <p className="text-xs font-semibold text-indigo-900">안내 실행(보조)</p>
                    <p className="mt-1 text-[11px] text-indigo-800">
                      일정 안내/결과 요청은 우측 상담·문자 패널에서 실행됩니다. 완료 시 타임라인/감사로그에 함께 기록됩니다.
                    </p>
                  </div>
                </section>
              ) : (
                <section className="space-y-3 rounded-lg border border-gray-200 bg-white p-4">
                  <h4 className="text-sm font-bold text-slate-900">관리 제공(프로그램·연계)</h4>
                  <p className="text-[11px] text-gray-600">
                    기존 프로그램 제공 UI를 재사용해 실행/연계를 기록하고 추적 계획을 확정합니다.
                  </p>
                  <div className="rounded-md border border-slate-200 bg-white p-3">
                    <p className="mb-2 text-[11px] text-slate-600">
                      빠른 실행보드는 제거되었고, 아래 프로그램 제공 UI에서 선택/실행을 기록합니다.
                      <span className="ml-1 font-semibold text-slate-800">추천 상위 3개 일괄 추가</span> 기능은 유지됩니다.
                    </p>
                    {stage2ModelAvailable ? (
                      <CaseDetailPrograms
                        caseId={detail.header.caseId}
                        stage={3}
                        resultLabel={stage3CaseResultLabel}
                        mciSeverity={stage3MciSeverity}
                        riskTags={detail.header.riskGuardrails ?? []}
                        actorName={detail.header.assigneeName}
                      />
                    ) : (
                      <ModelGateGuard stage={2} missing={stage2GateMissing} onOpenStep={focusStage2ResultInput} />
                    )}
                  </div>

                  <div className="rounded-md border border-indigo-200 bg-indigo-50 p-3">
                    <p className="text-xs font-semibold text-indigo-900">추적 계획 확정</p>
                    <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-2">
                      <label className="text-[11px] text-indigo-800">
                        다음 추적 일정
                        <input
                          type="datetime-local"
                          value={toDateTimeLocalValue(stage3TrackingPlanDraft.nextTrackingAt)}
                          onChange={(event) =>
                            setStage3TrackingPlanDraft((prev) => ({
                              ...prev,
                              nextTrackingAt: fromDateTimeLocalValue(event.target.value) || prev.nextTrackingAt,
                            }))
                          }
                          className="mt-1 h-8 w-full rounded-md border border-indigo-200 px-2 text-[11px] outline-none focus:border-indigo-400"
                        />
                      </label>
                      <label className="text-[11px] text-indigo-800">
                        리마인더 시간
                        <input
                          type="time"
                          value={stage3TrackingPlanDraft.reminderTime}
                          onChange={(event) => setStage3TrackingPlanDraft((prev) => ({ ...prev, reminderTime: event.target.value }))}
                          className="mt-1 h-8 w-full rounded-md border border-indigo-200 px-2 text-[11px] outline-none focus:border-indigo-400"
                        />
                      </label>
                    </div>
                  </div>
                </section>
              )
            ) : null}

            <div className="sticky bottom-0 z-10 flex flex-wrap items-center justify-end gap-2 rounded-lg border border-slate-200 bg-white/95 p-3 backdrop-blur">
              <button
                onClick={closeStage3TaskModal}
                className="rounded-md border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-700"
              >
                닫기
              </button>
              <button
                onClick={() => moveStage3TaskStep(-1)}
                disabled={stage3TaskStepIndex <= 0}
                className="rounded-md border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-700 disabled:opacity-40"
              >
                이전
              </button>
              <button
                onClick={() => {
                  if (!isStage2OpsView && stage3TaskModalStep === "PRECHECK") {
                    handleStage3TaskComplete();
                    return;
                  }
                  if (isStage2OpsView && stage3TaskModalStep === "CONTACT_EXECUTION") {
                    handleStage3TaskComplete();
                    return;
                  }
                  moveStage3TaskStep(1);
                }}
                disabled={stage3TaskStepIndex < 0 || stage3TaskStepIndex >= stage3TaskOrder.length - 1}
                className="rounded-md border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-700 disabled:opacity-40"
              >
                다음
              </button>
              <button
                onClick={handleStage3TaskComplete}
                className="rounded-md bg-[#15386a] px-3 py-1.5 text-xs font-semibold text-white"
              >
                완료로 표시
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!isStage3Mode && Boolean(activeStage1Modal)}
        onOpenChange={(open) => {
          if (!open) closeStage1Modal();
        }}
      >
        <DialogContent className="w-[96vw] max-w-[96vw] sm:max-w-[1700px] max-h-[92vh] overflow-y-auto p-4">
          <div className="space-y-3">
            <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-bold text-indigo-900">
                    {isStage2Mode ? "Stage2 작업열기" : "Stage1 작업열기"} · {stage1TaskCurrentCard?.title ?? "운영 루프"}
                  </p>
                  <p className="text-[11px] text-indigo-700">
                    {isStage2Mode
                      ? "근거 확인→접촉 실행→반응 처리→후속 결정을 한 패널에서 연속 수행합니다."
                      : "사전 조건→접촉 실행→반응 처리→후속 결정을 이동 없이 연속 수행합니다."}
                  </p>
                </div>
                <span className="rounded-md border border-indigo-300 bg-white px-2 py-1 text-[11px] font-semibold text-indigo-700">
                  단계 {stage1TaskStepIndex + 1}/{stage1TaskOrder.length}
                </span>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-1.5 md:grid-cols-4">
                {stage1TaskOrder.map((stepId, index) => {
                  const card = stage1FlowCards.find((item) => item.id === stepId);
                  const isActive = activeStage1Modal === stepId;
                  return (
                    <button
                      key={stepId}
                      type="button"
                      onClick={() => {
                        const lockReason = getFlowCardLockReason(stage1FlowCards, stepId);
                        if (lockReason) {
                          toast.error(lockReason);
                          return;
                        }
                        setStage1ModalStep(stepId);
                      }}
                      className={cn(
                        "rounded-md border px-2 py-1.5 text-left text-[11px]",
                        isActive ? "border-indigo-300 bg-white text-indigo-800" : "border-indigo-100 bg-indigo-50/60 text-indigo-700",
                      )}
                    >
                      <p className="font-semibold">STEP {index + 1}</p>
                      <p className="mt-0.5 truncate">{card?.title ?? stepId}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            {activeStage1Modal === "PRECHECK" ? (
              <section className="rounded-lg border border-gray-200 bg-white p-4">
                <h3 className="text-sm font-bold text-slate-900">{isStage2Mode ? "2차 평가 결과 확인" : "사전 조건 확인"}</h3>
                <p className="mt-1 text-[11px] text-gray-500">
                  {isStage2Mode
                    ? "분기/연계 실행 전, 필수 근거와 입력값 충족 여부를 확인합니다."
                    : "운영 실행 전, 대상자 접촉 채널의 유효성과 제한 사항을 확인합니다."}
                </p>
                <div className="mt-3">
                  <PolicyGatePanel gates={detail.policyGates} onFix={handleGateFixAction} mode={mode} />
                </div>
              </section>
            ) : null}

            {activeStage1Modal === "CONTACT_EXECUTION" ? (
              <section className="space-y-3 rounded-lg border border-gray-200 bg-white p-4">
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                  <div>
                    <p className="text-sm font-bold text-slate-900">{isStage2Mode ? "분기/연계 실행" : "접촉 실행"}</p>
                    <p className="text-[11px] text-slate-600">
                      {isStage2Mode
                        ? "분기 안내와 연계 실행 기록을 같은 패널에서 처리합니다."
                        : "접촉 주체에 따라 실행 방식이 달라집니다."}
                    </p>
                  </div>
                  <span className={cn("rounded-full border px-2.5 py-1 text-[11px] font-semibold", CONTACT_EXECUTOR_TONES[detail.contactExecutor])}>
                    {CONTACT_EXECUTOR_LABELS[detail.contactExecutor]}
                  </span>
                </div>

                <div className="grid grid-cols-1 gap-3 xl:grid-cols-[minmax(340px,0.8fr)_minmax(600px,1.2fr)]">
                  <RagRecommendationPanel
                    loading={ragLoading}
                    recommendations={ragRecommendations}
                    selectedId={selectedRagId}
                    editedScript={ragEditedScript}
                    onSelect={handleApplyRagRecommendation}
                    onEditScript={setRagEditedScript}
                  />

                  {detail.contactExecutor === "HUMAN" ? (
                    <SmsPanel
                      stageLabel={stageLabel}
                      templates={smsTemplatesForExecutor}
                      defaultVars={{
                        centerName: DEFAULT_CENTER_NAME,
                        centerPhone: DEFAULT_CENTER_PHONE,
                        bookingLink: reservationInfoToBookingLine(detail.reservationInfo),
                      }}
                      caseId={detail.header.caseId}
                      citizenPhone={caseRecord?.profile.phone ? (isStage2Mode || isStage3Mode ? caseRecord.profile.phone : maskPhone(caseRecord.profile.phone)) : "010-****-1234"}
                      guardianPhone={
                        caseRecord?.profile.guardianPhone
                          ? isStage2Mode || isStage3Mode
                            ? caseRecord.profile.guardianPhone
                            : maskPhone(caseRecord.profile.guardianPhone)
                          : undefined
                      }
                      callScripts={callScriptsForModal}
                      onSmsSent={(item) => {
                        if (item.type === "BOOKING" && !detail.reservationInfo) {
                          toast.error("예약 정보가 없어 예약안내 문자는 전송할 수 없습니다.");
                          appendAuditLog("예약안내 발송 차단: 예약 객체 없음");
                          return;
                        }
                        appendTimeline({
                          type: "SMS_SENT",
                          at: nowIso(),
                          templateId: item.templateLabel,
                          status: item.status === "SENT" ? "DELIVERED" : item.status === "SCHEDULED" ? "PENDING" : "FAILED",
                          by: detail.header.assigneeName,
                        });
                        appendAuditLog(`${stageLabel} 문자 ${item.mode === "NOW" ? "발송" : "예약"}: ${item.templateLabel} (${item.status})`);
                        if (item.status === "SENT") {
                          if (!isStage2Mode && !isStage3Mode) {
                            void runStage1SmsAutoContactCompleteScenario(item).then((handled) => {
                              if (handled) return;
                              completeSuggestedTodo("SMS");
                              setRecontactDueAt(withHoursFromNow(48));
                              setDetail((prev) => {
                                const newExec: ContactExecution = {
                                  ...prev.contactExecution,
                                  status: "SENT",
                                  lastSentAt: nowIso(),
                                  retryCount: prev.contactExecution.retryCount + 1,
                                };
                                return {
                                  ...prev,
                                  contactExecution: newExec,
                                  contactFlowSteps: buildContactFlowSteps(newExec, prev.preTriageResult, prev.linkageStatus, mode),
                                };
                              });
                            });
                            return;
                          }
                          completeSuggestedTodo("SMS");
                          setRecontactDueAt(withHoursFromNow(48));
                          setDetail((prev) => {
                            const newExec: ContactExecution = {
                              ...prev.contactExecution,
                              status: "SENT",
                              lastSentAt: nowIso(),
                              retryCount: prev.contactExecution.retryCount + 1,
                            };
                            return {
                              ...prev,
                              contactExecution: newExec,
                              contactFlowSteps: buildContactFlowSteps(newExec, prev.preTriageResult, prev.linkageStatus, mode),
                            };
                          });
                        }
                      }}
                      onConsultation={(note, type, templateLabel) => {
                        appendTimeline({
                          type: "CALL_ATTEMPT",
                          at: nowIso(),
                          result: "SUCCESS",
                          note: note || undefined,
                          by: detail.header.assigneeName,
                        });
                        const recommendationLog = selectedRecommendation ? ` / 추천 스크립트: ${selectedRecommendation.title}` : "";
                        appendAuditLog(`${stageLabel} 상담 기록: ${templateLabel}${note ? ` (${note.slice(0, 60)})` : ""}${recommendationLog}`);
                        if (type === "CONTACT") {
                          completeSuggestedTodo("CALL");
                        }
                        setDetail((prev) => {
                          const newExec: ContactExecution = {
                            ...prev.contactExecution,
                            status: "WAITING_RESPONSE",
                            lastSentAt: nowIso(),
                            retryCount: prev.contactExecution.retryCount + 1,
                          };
                          return {
                            ...prev,
                            contactExecution: newExec,
                            contactFlowSteps: buildContactFlowSteps(newExec, prev.preTriageResult, prev.linkageStatus, mode),
                          };
                        });
                        toast.success("상담 기록이 저장되었습니다.");
                      }}
                    />
                  ) : (
                    <section className="rounded-xl border border-violet-200 bg-violet-50/70 p-4">
                      <h4 className="text-sm font-bold text-violet-900">Agent 접촉 수행 상태</h4>
                      <p className="mt-1 text-[11px] text-violet-700">
                        자동 수행은 게이트 통과와 정책 허용 시에만 실행됩니다. 운영자는 결과 확인과 예외 처리만 수행합니다.
                      </p>

                      <div className="mt-3 rounded-lg border border-violet-200 bg-white p-3 text-xs text-slate-700">
                        <p>
                          현재 상태: <strong>{AGENT_JOB_STATUS_LABELS[agentJob.status]}</strong>
                        </p>
                        <p className="mt-1">
                          게이트 상태: <strong>{agentGateStatus === "PASS" ? "통과" : agentGateStatus === "NEEDS_CHECK" ? "확인 필요" : "제한"}</strong>
                        </p>
                        <p className="mt-1">
                          시도 번호: <strong>{agentJob.attemptNo || detail.contactExecution.retryCount + 1}</strong>
                        </p>
                        <p>
                          최근 수행:{" "}
                          <strong>
                            {detail.agentExecutionLogs[0]
                              ? `${formatDateTime(detail.agentExecutionLogs[0].at)} · ${AGENT_RESULT_LABELS[detail.agentExecutionLogs[0].result]}`
                              : "기록 없음"}
                          </strong>
                        </p>
                        {agentJob.idempotencyKey ? (
                          <p className="mt-1">
                            중복 방지 키: <strong>{agentJob.idempotencyKey}</strong>
                          </p>
                        ) : null}
                        {agentJob.lastError ? (
                          <p className="mt-1 text-red-700">
                            실패 사유: <strong>{agentJob.lastError}</strong>
                          </p>
                        ) : null}
                        {agentJob.nextRetryAt ? (
                          <p className="mt-1">
                            재시도 예정: <strong>{formatDateTime(agentJob.nextRetryAt)}</strong>
                          </p>
                        ) : null}
                        <p className="mt-1">STEP3/STEP4 후속 결정은 담당자가 직접 수행합니다.</p>
                      </div>

                      <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
                        <button
                          onClick={() => toast("최근 Agent 수행 상태를 확인했습니다.")}
                          className="rounded-md border border-violet-200 bg-violet-50 px-3 py-2 text-xs font-semibold text-violet-700"
                        >
                          Agent 수행 상태 확인
                        </button>
                        {(agentJob.status === "FAILED" || agentJob.status === "CANCELED") && agentGateStatus === "PASS" ? (
                          <button
                            onClick={retryAgentNow}
                            className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700"
                          >
                            즉시 재시도
                          </button>
                        ) : null}
                        {agentJob.status === "FAILED" && agentGateStatus === "PASS" ? (
                          <button
                            onClick={scheduleAgentRetry}
                            className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700"
                          >
                            재시도 예약
                          </button>
                        ) : null}
                        {(agentJob.status === "QUEUED" || agentJob.status === "RUNNING") ? (
                          <button
                            onClick={() =>
                              cancelAgentJob({
                                actor: "operator",
                                summary: "운영자 요청으로 Agent 작업을 취소했습니다.",
                                moveToHuman: false,
                              })
                            }
                            className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700"
                          >
                            수행 취소
                          </button>
                        ) : null}
                        <button
                          onClick={() => handleContactExecutorChange("HUMAN")}
                          className="rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                        >
                          사람 직접 접촉으로 전환
                        </button>
                      </div>
                    </section>
                  )}
                </div>
              </section>
            ) : null}

            {activeStage1Modal === "RESPONSE_HANDLING" ? (
              <section className="rounded-lg border border-gray-200 bg-white p-4">
                <h3 className="text-sm font-bold text-slate-900">반응 처리</h3>
                <p className="mt-1 text-[11px] text-gray-500">
                  이 단계에서 응답 결과를 확정하고 무응답/거부/상담 전환 여부를 기록합니다.
                </p>
                <div className="mt-3">
                  <ResponseTriagePanel
                    expanded
                    onToggle={closeStage1Modal}
                    executionStatus={detail.contactExecution.status}
                    lastSentAt={detail.contactExecution.lastSentAt}
                    lastSmsSentAt={detail.lastSmsSentAt}
                    assigneeName={detail.header.assigneeName}
                    reservation={detail.reservation}
                    showReservationSync={hasSmsReservationSignal}
                    autoFilledState={autoFilledOutcomeState}
                    onOpenReservationDetail={() => setReservationDetailOpen(true)}
                    selectedOutcomeCode={selectedOutcomeCode}
                    onSelectOutcomeCode={handleSelectOutcomeCode}
                    reasonTags={responseReasonTags}
                    onToggleReasonTag={handleToggleResponseReasonTag}
                    rejectReasonDraft={rejectReasonDraft}
                    onRejectReasonDraftChange={handleRejectReasonDraftChange}
                    noResponsePlanDraft={noResponsePlanDraft}
                    onNoResponsePlanDraftChange={handleNoResponsePlanDraftChange}
                    outcomeNote={outcomeNote}
                    onOutcomeNoteChange={handleOutcomeNoteChange}
                    isSaving={isOutcomeSaving}
                    submitError={outcomeSubmitError}
                    validationError={responseValidationError}
                    onClearError={clearSubmitError}
                    onReset={resetResponseTriageDraft}
                    onConfirm={confirmOutcomeTriage}
                    hasUnsavedChanges={responseDraftDirty}
                    lastSavedAt={responseLastSavedAt}
                    onOpenHandoffMemo={() => setHandoffMemoOpen(true)}
                    mode={mode}
                  />
                </div>
              </section>
            ) : null}

            {activeStage1Modal === "FOLLOW_UP" ? (
              <section className="space-y-3 rounded-lg border border-gray-200 bg-white p-4">
                <h3 className="text-sm font-bold text-slate-900">{isStage2Mode ? "확정/후속조치" : "후속 결정"}</h3>
                <p className="mt-1 text-[11px] text-gray-500">
                  {isStage2Mode
                    ? "이 단계에서 담당자 확정, 연계 상태 확인, 추적 계획 생성을 완료합니다."
                    : "이 단계에서 유지/보류/전환/연계를 확정하고 후속 조치와 인수인계를 완료합니다."}
                </p>

                <FollowUpDecisionPanel
                  draft={followUpDecisionDraft}
                  reservationInfo={detail.reservationInfo}
                  reservation={detail.reservation}
                  showStage2Decision={mode === "stage1"}
                  onChange={setFollowUpDecisionDraft}
                  onSave={handleSaveFollowUpDecision}
                />

                <NextActionPanel
                  mode={mode}
                  execution={detail.contactExecution}
                  strategy={effectiveStrategy}
                  preTriageReady={preTriageReady}
                  strategyDecided={Boolean(detail.preTriageResult?.strategy)}
                  hasVulnerableGuardrail={Boolean(detail.header.riskGuardrails?.length)}
                  linkageStatus={detail.linkageStatus}
                  onOpenSmsModal={() => openStage1FlowModal("CONTACT_EXECUTION")}
                  onOpenOutcomeTriage={() => openStage1FlowModal("RESPONSE_HANDLING")}
                  onOpenHandoffMemo={() => setHandoffMemoOpen(true)}
                  onOpenStrategyOverride={() => setStrategyOverrideOpen(true)}
                />

                <HandoffMemoGeneratorCard
                  expanded={handoffMemoOpen || Boolean(detail.contactExecution.handoffMemo)}
                  onToggle={() => setHandoffMemoOpen((prev) => !prev)}
                  memoText={handoffMemoText}
                  onMemoChange={setHandoffMemoText}
                  onSave={() => {
                    appendAuditLog(`인수인계 메모 저장: ${handoffMemoText.slice(0, 80)}...`);
                    toast.success("인수인계 메모가 저장되었습니다.");
                    setHandoffMemoOpen(false);
                  }}
                  mode={mode}
                />

                <InterventionLevelPanel
                  level={detail.interventionLevel}
                  statusLabel={detail.header.statusLabel}
                  guides={interventionGuides}
                  onChangeLevel={openLevelChangeModal}
                  onHold={() => openStatusReasonModal("보류")}
                  onExclude={() => openStatusReasonModal("우선순위 제외")}
                  mode={mode}
                />
              </section>
            ) : null}

            <div className="sticky bottom-0 z-10 flex flex-wrap items-center justify-end gap-2 rounded-lg border border-slate-200 bg-white/95 p-3 backdrop-blur">
              <button
                onClick={closeStage1Modal}
                className="rounded-md border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-700"
              >
                닫기
              </button>
              <button
                onClick={() => moveStage1TaskStep(-1)}
                disabled={stage1TaskStepIndex <= 0}
                className="rounded-md border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-700 disabled:opacity-40"
              >
                이전
              </button>
              <button
                onClick={() => moveStage1TaskStep(1)}
                disabled={stage1TaskStepIndex < 0 || stage1TaskStepIndex >= stage1TaskOrder.length - 1}
                className="rounded-md border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-700 disabled:opacity-40"
              >
                다음
              </button>
              <button
                onClick={handleStage1TaskComplete}
                className="rounded-md bg-[#15386a] px-3 py-1.5 text-xs font-semibold text-white"
              >
                완료로 표시
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between border-b border-gray-100 pb-2">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <History size={15} className="text-slate-500" />
            변경 사유 및 감사 로그
          </h3>
          <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
            로그 무결성 확인
          </span>
        </div>

        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full border-collapse text-xs">
            <thead>
              <tr className="bg-gray-50 text-gray-600">
                <th className="border border-gray-200 px-3 py-2 text-left font-semibold">시각</th>
                <th className="border border-gray-200 px-3 py-2 text-left font-semibold">행위자</th>
                <th className="border border-gray-200 px-3 py-2 text-left font-semibold">행위</th>
                <th className="border border-gray-200 px-3 py-2 text-left font-semibold">요약</th>
              </tr>
            </thead>
            <tbody>
              {auditLogs.map((log) => {
                const [action, ...summaryParts] = log.message.split(":");
                const summary = summaryParts.join(":").trim();
                return (
                  <tr key={log.id} className="odd:bg-white even:bg-gray-50/60">
                    <td className="border border-gray-200 px-3 py-2 text-gray-600">{log.at}</td>
                    <td className="border border-gray-200 px-3 py-2 text-gray-700">{log.actor}</td>
                    <td className="border border-gray-200 px-3 py-2 font-semibold text-slate-800">{action.trim()}</td>
                    <td className="border border-gray-200 px-3 py-2 text-gray-600">{summary || "-"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <ActionReasonModal
        draft={reasonModal}
        onClose={() => setReasonModal(null)}
        onChangeReason={(reason) =>
          setReasonModal((prev) => {
            if (!prev) return prev;
            return { ...prev, reason };
          })
        }
        onConfirm={confirmReasonAction}
      />

      <OutcomeModal
        draft={outcomeModal}
        loading={savingOutcome}
        onClose={() => {
          if (!savingOutcome) setOutcomeModal(null);
        }}
        onChangeResult={(value) =>
          setOutcomeModal((prev) => {
            if (!prev) return prev;
            if (prev.mode === "CALL") {
              return { ...prev, result: value as OutcomeDraft extends { mode: "CALL"; result: infer R } ? R : never };
            }
            return { ...prev, result: value as SmsDispatchStatus };
          })
        }
        onChangeNote={(note) =>
          setOutcomeModal((prev) => {
            if (!prev) return prev;
            return { ...prev, note };
          })
        }
        onConfirm={confirmOutcome}
      />

      <ReservationDetailModal
        open={reservationDetailOpen}
        reservation={detail.reservation}
        onClose={() => setReservationDetailOpen(false)}
      />

      {/* ═══ 접촉 전략 Override 모달 ═══ */}
      {strategyOverrideOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4">
          <div className="w-full max-w-md rounded-xl border border-gray-200 bg-white p-5 shadow-2xl">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Shield size={15} className="text-amber-600" />
              접촉 전략 수동 전환
            </h3>
            <p className="mt-1 text-[11px] text-gray-500">{STRATEGY_HELPER_TEXT}</p>

            {detail.header.riskGuardrails && detail.header.riskGuardrails.length > 0 && (
              <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
                <p className="text-[11px] font-semibold text-amber-800 flex items-center gap-1">
                  <AlertTriangle size={12} /> 취약 대상 경고
                </p>
                <ul className="mt-1 space-y-0.5">
                  {detail.header.riskGuardrails.map((g) => (
                    <li key={g} className="text-[11px] text-amber-700">• {g}</li>
                  ))}
                </ul>
                {strategyOverrideTarget === "AI_FIRST" ? (
                  <p className="mt-2 text-[10px] font-semibold text-amber-900">
                    취약군 케이스에서 자동 안내 우선 전환 시 상세 사유 기록이 필요합니다.
                  </p>
                ) : null}
              </div>
            )}

            <div className="mt-3">
              <label className="text-[11px] font-semibold text-gray-600">전환 대상 전략</label>
              <div className="mt-1 grid grid-cols-2 gap-2">
                {(["HUMAN_FIRST", "AI_FIRST"] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => setStrategyOverrideTarget(s)}
                    className={cn(
                      "rounded-lg border-2 px-3 py-2 text-xs font-semibold transition-colors",
                      strategyOverrideTarget === s ? STRATEGY_TONES[s].replace("bg-", "border-").split(" ")[0] + " " + STRATEGY_TONES[s] : "border-gray-200 bg-gray-50 text-gray-500"
                    )}
                  >
                    {STRATEGY_LABELS[s]}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-3">
              <label className="text-[11px] font-semibold text-gray-600">전환 사유 (필수)</label>
              <textarea
                value={strategyOverrideReason}
                onChange={(e) => setStrategyOverrideReason(e.target.value)}
                className="mt-1 h-20 w-full rounded-lg border border-gray-200 px-2 py-1.5 text-xs outline-none focus:border-blue-400"
                placeholder="전략 전환 사유를 입력하세요 (감사 로그에 기록됩니다)"
              />
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setStrategyOverrideOpen(false)} className="rounded-md border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-700">취소</button>
              <button
                onClick={confirmStrategyOverride}
                disabled={!strategyOverrideReason.trim()}
                className="rounded-md bg-[#163b6f] px-3 py-1.5 text-xs font-semibold text-white disabled:bg-gray-300"
              >
                전략 전환 적용
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

export function DataQualityBadge({ dataQuality }: { dataQuality: CaseHeader["dataQuality"] }) {
  const tone =
    dataQuality.level === "GOOD"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : dataQuality.level === "WARN"
        ? "border-orange-200 bg-orange-50 text-orange-700"
        : "border-red-200 bg-red-50 text-red-700";

  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold", tone)}>
      <ShieldCheck size={12} /> 데이터 품질 {dataQualityText(dataQuality.level)} ({dataQuality.score}%)
    </span>
  );
}

export function SlaStatusBadge({ sla }: { sla: CaseHeader["sla"] }) {
  const tone =
    sla.level === "OK"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : sla.level === "DUE_SOON"
        ? "border-orange-200 bg-orange-50 text-orange-700"
        : "border-red-200 bg-red-50 text-red-700";

  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold", tone)}>
      <Clock3 size={12} /> SLA {slaText(sla.level)}
    </span>
  );
}

export function OpsSummaryStrip({
  header,
  strategyBadge,
  effectiveStrategy,
  nextAction,
  missingCount,
  warningCount,
  lastUpdatedAt,
  slaCountdown,
  recontactCountdown,
}: {
  header: CaseHeader;
  strategyBadge: ContactStrategy;
  effectiveStrategy: RecommendedContactStrategy;
  nextAction: string;
  missingCount: number;
  warningCount: number;
  lastUpdatedAt?: string;
  slaCountdown: string;
  recontactCountdown: string;
}) {
  const statusTone =
    header.statusLabel === "완료"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : header.statusLabel === "보류"
        ? "border-orange-200 bg-orange-50 text-orange-700"
        : header.statusLabel === "우선순위 제외"
          ? "border-gray-200 bg-gray-100 text-gray-700"
          : "border-blue-200 bg-blue-50 text-blue-700";

  return (
    <section className="rounded-xl border border-slate-200 bg-gradient-to-r from-slate-900 to-slate-800 px-4 py-3 text-white shadow-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-md bg-white/15 px-2.5 py-1 text-xs font-semibold">Case {header.caseId}</span>
        <span className="rounded-md bg-white/15 px-2.5 py-1 text-xs font-semibold">Stage1</span>
        <span className={cn("rounded-md border px-2.5 py-1 text-xs font-semibold", statusTone)}>현재 상태 {header.statusLabel}</span>
        <span className="rounded-md bg-white/15 px-2.5 py-1 text-xs font-semibold">대기 {header.waitDays}일</span>
        <span className="rounded-md bg-white/15 px-2.5 py-1 text-xs font-semibold">SLA {slaCountdown}</span>
        <span className="rounded-md bg-white/15 px-2.5 py-1 text-xs font-semibold">재접촉 {recontactCountdown}</span>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
        <span className={cn("inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold", STRATEGY_TONES[strategyBadge])}>
          <Shield size={12} /> 접촉 전략 {strategyBadge}
          {strategyBadge === "MANUAL_OVERRIDE" ? ` (${effectiveStrategy})` : ""}
        </span>
        <SlaStatusBadge sla={header.sla} />
        <DataQualityBadge dataQuality={header.dataQuality} />
        {header.riskGuardrails && header.riskGuardrails.length > 0 ? (
          <span className="inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-800">
            <AlertTriangle size={12} /> 리스크 가드레일 {header.riskGuardrails.length}건
          </span>
        ) : null}
      </div>

      {header.riskGuardrails && header.riskGuardrails.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-1">
          {header.riskGuardrails.map((guardrail) => (
            <span key={guardrail} className="rounded border border-amber-200 bg-white/95 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
              {guardrail}
            </span>
          ))}
        </div>
      ) : null}

      <div className="mt-2 rounded-md border border-white/20 bg-white/10 px-3 py-2 text-[11px] text-slate-100">
        <p>최근 업데이트 {formatDateTime(lastUpdatedAt)} / 누락 {missingCount}건 / 경고 {warningCount}건</p>
        <p className="mt-1">
          현재 우선 액션: <strong>{nextAction}</strong>
        </p>
        <p className="mt-1 text-[10px] text-slate-300">운영 참고: {STRATEGY_HELPER_TEXT}</p>
      </div>
    </section>
  );
}

/* ═══ 서비스 운영 보드 (4카드) ═══ */
function ServiceOperationsBoard({
  strategy,
  strategyBadge,
  contactExecutor,
  executionStatus,
  lastSentAt,
  lastOutcome,
  retryCount,
  linkageStatus,
  memoCount,
  lastContactAt,
  timelineCount,
  preTriage,
  riskGuardrails,
  onOpenStrategyOverride,
  mode = "stage1",
  stage2OpsView = false,
}: {
  strategy: RecommendedContactStrategy;
  strategyBadge: ContactStrategy;
  contactExecutor: ContactExecutor;
  executionStatus: ContactExecutionStatus;
  lastSentAt?: string;
  lastOutcome?: OutcomeCode;
  retryCount: number;
  linkageStatus: LinkageStatus;
  memoCount: number;
  lastContactAt?: string;
  timelineCount: number;
  preTriage?: PreTriageResult;
  riskGuardrails?: string[];
  onOpenStrategyOverride: () => void;
  mode?: StageOpsMode;
  stage2OpsView?: boolean;
}) {
  const [hovered, setHovered] = useState<number | null>(null);
  const isStage3Mode = mode === "stage3";
  const isStage2OpsMode = isStage3Mode && stage2OpsView;

  const execLabels: Record<ContactExecutionStatus, { label: string; tone: string }> = {
    NOT_STARTED: { label: "미접촉", tone: "text-gray-600" },
    SENT: { label: "발송완료", tone: "text-blue-700" },
    WAITING_RESPONSE: { label: "응답대기", tone: "text-amber-700" },
    RETRY_NEEDED: { label: "재시도필요", tone: "text-orange-700" },
    HANDOFF_TO_HUMAN: { label: "상담전환", tone: "text-red-700" },
    PAUSED: { label: "보류", tone: "text-gray-600" },
    STOPPED: { label: "중단", tone: "text-red-700" },
    DONE: { label: "완료", tone: "text-emerald-700" },
  };

  const linkageLabelMap: Record<LinkageStatus, string> = {
    NOT_CREATED: "미생성",
    BOOKING_IN_PROGRESS: "예약중",
    BOOKING_DONE: "예약완료",
    REFERRAL_CREATED: "의뢰생성",
  };

  const strategyValue = strategy === "HUMAN_FIRST" ? "상담사 우선" : "자동안내 우선";
  const strategySub = strategyBadge === "MANUAL_OVERRIDE" ? "담당자 수동 변경 적용" : "사전 기준 자동 추천";
  const strategyReasons = [
    ...(preTriage?.triggers ?? []).slice(0, 4).map(explainStrategyTrigger),
    ...(riskGuardrails ?? []).slice(0, 2),
  ];
  if (strategy === "HUMAN_FIRST" && strategyReasons.length === 0) {
    strategyReasons.push("취약군 보호 정책에 따라 상담사 우선으로 진행합니다.");
  }

  const cards = isStage2OpsMode
    ? [
        {
          title: "진단 진행률",
          value: linkageStatus === "BOOKING_DONE" || linkageStatus === "REFERRAL_CREATED" ? "75%" : "50%",
          sub: `현재 단계 ${linkageLabelMap[linkageStatus]} · 로그 ${timelineCount}건`,
          helperTitle: "운영 근거",
          helper: [
            `최근 기록: ${formatDateTime(lastContactAt)}`,
            `예약/의뢰 상태: ${linkageLabelMap[linkageStatus]}`,
            "진단 진행률은 예약/결과/확정 단계 기록을 기준으로 계산됩니다.",
          ],
          tone: "border-blue-200 bg-blue-50 text-blue-700",
          icon: Shield,
        },
        {
          title: "예약/의뢰 대기",
          value: linkageStatus === "BOOKING_DONE" || linkageStatus === "REFERRAL_CREATED" ? "0건" : "1건",
          sub: "병원 의뢰/예약 확정 필요",
          helperTitle: "운영 근거",
          helper: [
            `현재 상태: ${linkageLabelMap[linkageStatus]}`,
            "대기 건은 Step2 작업 열기에서 즉시 처리합니다.",
            `재시도 누적: ${retryCount}회`,
          ],
          tone:
            linkageStatus === "BOOKING_DONE" || linkageStatus === "REFERRAL_CREATED"
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border-amber-200 bg-amber-50 text-amber-700",
          icon: AlertCircle,
        },
        {
          title: "결과 수신 지연",
          value: retryCount >= 3 ? "지연" : retryCount >= 1 ? "주의" : "정상",
          sub: `재시도 ${retryCount}회 · ${detailTrendLabel(lastOutcome)}`,
          helperTitle: "운영 근거",
          helper: [
            `마지막 확인: ${formatDateTime(lastSentAt)}`,
            `현재 실행 상태: ${execLabels[executionStatus].label}`,
            "결과 수신 지연은 재요청/미응답 누적을 함께 반영합니다.",
          ],
          tone: retryCount >= 3 ? "border-red-200 bg-red-50 text-red-700" : "border-slate-200 bg-slate-50 text-slate-700",
          icon: Zap,
        },
        {
          title: "분류 확정 상태",
          value: linkageStatus === "BOOKING_DONE" ? "확정 준비" : "미확정",
          sub: `${formatDateTime(lastContactAt)} · 메모 ${memoCount}건`,
          helperTitle: "운영 근거",
          helper: [
            `분류 확정 전제: 신경심리/임상평가/전문의 기록`,
            `누적 로그: ${timelineCount}건`,
            "최종 분류 확정은 담당자/의료진 확인 후 진행합니다.",
          ],
          tone: linkageStatus === "BOOKING_DONE" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-gray-200 bg-gray-50 text-gray-700",
          icon: History,
        },
      ]
    : isStage3Mode
      ? [
        {
          title: "전환 위험도",
          value: retryCount >= 3 ? "HIGH" : retryCount >= 1 ? "MID" : "LOW",
      sub: `추세 ${detailTrendLabel(lastOutcome)} · 로그 ${timelineCount}건`,
      helperTitle: "운영 근거",
      helper: [
        `최근 기록: ${formatDateTime(lastContactAt)}`,
        `재시도 누적: ${retryCount}회`,
        "전환 위험 신호는 운영 참고용이며 담당자 확인 후 실행합니다.",
      ],
      tone: retryCount >= 3 ? "border-red-200 bg-red-50 text-red-700" : "border-amber-200 bg-amber-50 text-amber-700",
      icon: Shield,
    },
    {
      title: "활성 신호",
      value: `${(riskGuardrails?.length ?? 0) + (preTriage?.triggers.length ?? 0)}건`,
      sub: "트리거/가드레일 기준",
      helperTitle: "운영 근거",
      helper: [
        ...(riskGuardrails?.slice(0, 2) ?? []),
        ...((preTriage?.triggers ?? []).slice(0, 2).map(explainStrategyTrigger)),
      ].slice(0, 3),
      tone: "border-slate-200 bg-slate-50 text-slate-700",
      icon: AlertCircle,
    },
    {
      title: "개입 상태",
      value: execLabels[executionStatus].label,
      sub: linkageStatus === "NOT_CREATED" ? "미실행 항목 존재" : `연계 ${linkageLabelMap[linkageStatus]}`,
      helperTitle: "운영 근거",
      helper: [
        `재평가/연계 상태: ${linkageLabelMap[linkageStatus]}`,
        `현재 실행 상태: ${execLabels[executionStatus].label}`,
        linkageStatus === "NOT_CREATED" ? "개입 미실행 상태는 우측 Workboard에서 즉시 처리하세요." : "개입 이력이 기록되었습니다.",
      ],
      tone: linkageStatus === "NOT_CREATED" ? "border-red-200 bg-red-50 text-red-700" : "border-emerald-200 bg-emerald-50 text-emerald-700",
      icon: Zap,
    },
    {
      title: "플랜/기록",
      value: `메모 ${memoCount}건`,
      sub: `${formatDateTime(lastContactAt)} · 누적 ${timelineCount}건`,
      helperTitle: "운영 근거",
      helper: [
        `마지막 개입: ${formatDateTime(lastContactAt)}`,
        `누적 로그: ${timelineCount}건`,
        "모든 실행은 감사 로그와 타임라인에 기록됩니다.",
      ],
      tone: "border-gray-200 bg-gray-50 text-gray-700",
      icon: History,
        },
      ]
      : [
    {
      title: "접촉 방식",
      value: strategyValue,
      sub: `${strategySub} · ${CONTACT_EXECUTOR_LABELS[contactExecutor]}`,
      helperTitle: "판정 근거",
      helper:
        strategyReasons.length > 0
          ? [...strategyReasons.slice(0, 2), `현재 접촉 주체: ${CONTACT_EXECUTOR_LABELS[contactExecutor]}`]
          : [
              "사전 기준 항목 충족으로 자동 안내 우선이 제안되었습니다.",
              `현재 접촉 주체: ${CONTACT_EXECUTOR_LABELS[contactExecutor]}`,
              "추가 위험 신호가 없어 확실하지 않음 항목은 없습니다.",
            ],
      tone:
        strategy === "HUMAN_FIRST"
          ? "border-red-200 bg-red-50 text-red-700"
          : "border-blue-200 bg-blue-50 text-blue-700",
      icon: Shield,
    },
    {
      title: "진행 상태",
      value: execLabels[executionStatus].label,
      sub: lastOutcome ? `최근 결과: ${OUTCOME_LABELS[lastOutcome].label}` : `재시도 ${retryCount}회`,
      helperTitle: "판정 근거",
      helper: [
        `마지막 안내/발송: ${formatDateTime(lastSentAt)}`,
        `누적 재시도 횟수: ${retryCount}회`,
        !lastSentAt ? "최근 접촉 시각이 없어 확실하지 않음" : "최근 접촉 시각이 기록되어 있음",
      ],
      tone: `border-slate-200 bg-slate-50 ${execLabels[executionStatus].tone}`,
      icon: Zap,
    },
    {
      title: "예약/연계",
      value: linkageLabelMap[linkageStatus],
      sub: lastSentAt ? `최근 발송: ${formatDateTime(lastSentAt)}` : "운영 참고",
      helperTitle: "판정 근거",
      helper: [
        linkageStatus === "NOT_CREATED" ? "아직 생성 전입니다." : `현재 단계: ${linkageLabelMap[linkageStatus]}`,
        "필요 시 담당자가 즉시 수동 변경할 수 있습니다.",
        linkageStatus === "NOT_CREATED" ? "연계 결과 데이터가 없어 확실하지 않음" : "연계 상태 데이터가 기록되어 있음",
      ],
      tone: "border-emerald-200 bg-emerald-50 text-emerald-700",
      icon: CheckCircle2,
    },
    {
      title: "최근 기록",
      value: `메모 ${memoCount}건`,
      sub: `${formatDateTime(lastContactAt)} · 로그 ${timelineCount}건`,
      helperTitle: "판정 근거",
      helper: [
        `마지막 접촉: ${formatDateTime(lastContactAt)}`,
        `누적 로그: ${timelineCount}건`,
        timelineCount === 0 ? "기록 데이터가 없어 확실하지 않음" : "최근 기록 데이터가 누적되어 있음",
      ],
      tone: "border-gray-200 bg-gray-50 text-gray-700",
      icon: History,
        },
      ];

  return (
    <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
      {cards.map((card, idx) => (
        <article
          key={card.title}
          onMouseEnter={() => setHovered(idx)}
          onMouseLeave={() => setHovered((prev) => (prev === idx ? null : prev))}
          onFocus={() => setHovered(idx)}
          onBlur={() => setHovered((prev) => (prev === idx ? null : prev))}
          className={cn(
            "relative rounded-xl border p-3 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md",
            card.tone
          )}
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <card.icon size={14} />
              <p className="text-[11px] font-semibold opacity-80">{card.title}</p>
            </div>
            {idx === 0 && !isStage3Mode ? (
              <button
                type="button"
                onClick={onOpenStrategyOverride}
                className="rounded-md border border-current/40 bg-white/70 px-2 py-0.5 text-[10px] font-semibold"
              >
                수동 변경
              </button>
            ) : null}
          </div>
          <p className="mt-1 text-lg font-bold">{card.value}</p>
          <p className="mt-0.5 text-[10px] opacity-70">{card.sub}</p>

          <div
            className={cn(
              "pointer-events-none absolute inset-x-2 top-[calc(100%+8px)] z-20 rounded-lg border border-slate-200 bg-white p-3 text-slate-700 shadow-lg transition-all duration-150",
              hovered === idx ? "translate-y-0 opacity-100" : "-translate-y-1 opacity-0"
            )}
          >
            <p className="text-[11px] font-semibold text-slate-900">{card.helperTitle}</p>
            <div className="mt-1 space-y-0.5 text-[11px] text-slate-600">
              {card.helper.map((line) => (
                <p key={`${card.title}-${line}`}>- {line}</p>
              ))}
            </div>
          </div>
        </article>
      ))}
    </section>
  );
}

function ContactExecutionLauncherCard({
  mode = "stage1",
  stage2OpsView = false,
  contactExecutor,
  executionStatus,
  strategy,
  lastSentAt,
  sensitivityFlags,
  latestAgentLog,
  selectedRecommendation,
  agentJob,
  gateStatus,
  onSwitchExecutor,
  onOpen,
  onRetryNow,
  onScheduleRetry,
}: {
  mode?: StageOpsMode;
  stage2OpsView?: boolean;
  contactExecutor: ContactExecutor;
  executionStatus: ContactExecutionStatus;
  strategy: RecommendedContactStrategy;
  lastSentAt?: string;
  sensitivityFlags: string[];
  latestAgentLog?: AgentExecutionLog;
  selectedRecommendation: RagRecommendation | null;
  agentJob: AgentJobState;
  gateStatus: GateStatus;
  onSwitchExecutor: (next: ContactExecutor) => void;
  onOpen: () => void;
  onRetryNow: () => void;
  onScheduleRetry: () => void;
}) {
  const isStage2Mode = mode === "stage2";
  const isStage3Mode = mode === "stage3";
  const isStage2OpsMode = isStage3Mode && stage2OpsView;
  const isAdManagement = isStage3Mode && stage3Type === "AD_MANAGEMENT" && !isStage2OpsMode;
  const statusLabelMap: Record<ContactExecutionStatus, string> = {
    NOT_STARTED: "미접촉",
    SENT: "발송완료",
    WAITING_RESPONSE: "응답대기",
    RETRY_NEEDED: "재시도필요",
    HANDOFF_TO_HUMAN: "상담전환",
    PAUSED: "보류",
    STOPPED: "중단",
    DONE: "완료",
  };

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
          <MessageSquare size={15} className="text-[#15386a]" />
          상담/문자 실행 ({isStage2OpsMode ? "예약안내/결과요청" : isStage3Mode ? "확인/리마인더" : isStage2Mode ? "2차" : "1차"})
        </h3>
        <span className={cn("rounded-full border px-2 py-0.5 text-[10px] font-semibold", CONTACT_EXECUTOR_TONES[contactExecutor])}>
          {CONTACT_EXECUTOR_LABELS[contactExecutor]}
        </span>
      </div>
      <p className="mt-1 text-[11px] text-gray-500">
        {contactExecutor === "HUMAN"
          ? isStage3Mode
            ? isStage2OpsMode
              ? "예약 안내/결과 요청 연락은 담당자가 직접 수행합니다."
              : "재평가 일정 안내를 위한 확인 연락은 담당자가 직접 수행합니다."
            : isStage2Mode
            ? "분기 안내/연계 동의 확인은 담당자가 직접 수행합니다."
            : "전화/문자 실행은 담당자가 직접 수행합니다."
          : isStage3Mode
            ? isStage2OpsMode
              ? "Agent 안내 결과 확인/기록 전용 모드입니다. 핵심 조치는 진단검사 패널에서 수행합니다."
              : "Agent 리마인더 결과 확인/기록 전용 모드입니다. 핵심 조치는 재평가/플랜 패널에서 수행합니다."
            : isStage2Mode
            ? "Agent 안내 결과 확인/기록 전용 모드입니다. 확정과 후속조치는 담당자가 수행합니다."
            : "Agent 접촉 결과 확인/기록 전용 모드입니다. 후속 결정은 담당자가 수행합니다."}
      </p>
      {strategy === "AI_FIRST" ? (
        <p className="mt-1 text-[11px] text-violet-700">
          운영자가 지금 해야 할 행동: Agent 수행 결과 확인 후 필요 시 예외 처리
        </p>
      ) : null}

      <div className="mt-3 grid grid-cols-2 gap-2">
        {(["HUMAN", "AGENT_SEND_ONLY"] as const).map((mode) => (
          <button
            key={mode}
            onClick={() => onSwitchExecutor(mode)}
            className={cn(
              "rounded-md border px-2.5 py-1.5 text-[11px] font-semibold transition-colors",
              contactExecutor === mode
                ? CONTACT_EXECUTOR_TONES[mode]
                : "border-gray-200 bg-gray-50 text-gray-600 hover:bg-gray-100"
            )}
          >
            {CONTACT_EXECUTOR_LABELS[mode]}
          </button>
        ))}
      </div>

      <button
        type="button"
        onClick={onOpen}
        className={cn(
          "mt-3 h-11 w-full rounded-lg text-sm font-semibold text-white transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md",
          contactExecutor === "HUMAN" ? "bg-[#15386a] hover:bg-[#102b4e]" : "bg-violet-700 hover:bg-violet-800"
        )}
      >
        {contactExecutor === "HUMAN"
          ? isStage3Mode
            ? isStage2OpsMode
              ? "예약/결과 안내 실행 열기"
              : "보조 연락 실행 열기"
            : isStage2Mode
            ? "분기 안내/문자 실행 열기"
            : "상담/문자 실행 열기"
          : "Agent 수행 상태 확인"}
      </button>

      <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-[11px] text-slate-700">
        <p>
          현재 상태: <strong>{statusLabelMap[executionStatus]}</strong>
        </p>
        <p className="mt-0.5">
          {isStage3Mode ? "운영 기준" : isStage2Mode ? "운영 기준" : "접촉 기준"}: <strong>{strategy === "HUMAN_FIRST" ? "상담사 우선" : "자동안내 우선"}</strong>
        </p>
        <p className="mt-0.5">
          최근 발송: <strong>{formatDateTime(lastSentAt)}</strong>
        </p>
        <p className="mt-0.5">
          민감 이력: <strong>{sensitivityFlags.length > 0 ? sensitivityFlags.join(", ") : "확인 항목 없음"}</strong>
        </p>
        {contactExecutor === "AGENT_SEND_ONLY" ? (
          <>
            <p className="mt-0.5">
              Agent 작업 상태: <strong>{AGENT_JOB_STATUS_LABELS[agentJob.status]}</strong>
            </p>
            <p className="mt-0.5">
              채널 게이트: <strong>{gateStatus === "PASS" ? "통과" : gateStatus === "NEEDS_CHECK" ? "확인 필요" : "제한"}</strong>
            </p>
            <p className="mt-0.5">
              최근 Agent 수행:{" "}
              <strong>
                {latestAgentLog ? `${formatDateTime(latestAgentLog.at)} · ${AGENT_RESULT_LABELS[latestAgentLog.result]}` : "기록 없음"}
              </strong>
            </p>
            {agentJob.status === "FAILED" ? (
              <p className="mt-0.5 text-red-700">
                실패 사유: <strong>{agentJob.lastError ?? "사유 없음"}</strong>
              </p>
            ) : null}
            {agentJob.nextRetryAt ? (
              <p className="mt-0.5">
                재시도 예정: <strong>{formatDateTime(agentJob.nextRetryAt)}</strong>
              </p>
            ) : null}
            {(agentJob.status === "FAILED" || agentJob.status === "CANCELED") && gateStatus === "PASS" ? (
              <div className="mt-2 flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={onRetryNow}
                  className="rounded-md border border-violet-200 bg-violet-50 px-2 py-1 text-[10px] font-semibold text-violet-700 hover:bg-violet-100"
                >
                  즉시 재시도
                </button>
                <button
                  type="button"
                  onClick={onScheduleRetry}
                  className="rounded-md border border-slate-200 bg-white px-2 py-1 text-[10px] font-semibold text-slate-700 hover:bg-slate-100"
                >
                  재시도 예약
                </button>
              </div>
            ) : null}
          </>
        ) : selectedRecommendation ? (
          <p className="mt-0.5">
            추천 스크립트: <strong>{selectedRecommendation.title}</strong>
          </p>
        ) : null}
      </div>
    </section>
  );
}

function RagRecommendationPanel({
  loading,
  recommendations,
  selectedId,
  editedScript,
  onSelect,
  onEditScript,
}: {
  loading: boolean;
  recommendations: RagRecommendation[];
  selectedId: string | null;
  editedScript: string;
  onSelect: (recommendation: RagRecommendation) => void;
  onEditScript: (value: string) => void;
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-bold text-slate-900">RAG 상담/문자 추천</h4>
        <span className="text-[10px] text-slate-500">추천일 뿐, 최종 실행은 담당자가 수행합니다.</span>
      </div>

      {loading ? (
        <div className="mt-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-[11px] text-slate-500">
          추천 스크립트를 준비 중입니다...
        </div>
      ) : (
        <>
          <div className="mt-2 grid grid-cols-1 gap-2">
            {recommendations.map((recommendation) => (
              <button
                key={recommendation.id}
                onClick={() => onSelect(recommendation)}
                className={cn(
                  "rounded-lg border px-3 py-2 text-left transition-colors",
                  selectedId === recommendation.id
                    ? "border-blue-300 bg-blue-50"
                    : "border-slate-200 bg-white hover:bg-slate-50"
                )}
              >
                <p className="text-xs font-semibold text-slate-900">{recommendation.title}</p>
                <p className="mt-0.5 text-[11px] text-slate-600">{recommendation.useCase}</p>
                <div className="mt-1 space-y-0.5 text-[10px] text-slate-500">
                  {recommendation.evidence.slice(0, 3).map((line) => (
                    <p key={`${recommendation.id}-${line}`}>- {line}</p>
                  ))}
                </div>
              </button>
            ))}
          </div>

          <div className="mt-2">
            <label className="text-[11px] font-semibold text-slate-600">추천 문구 편집</label>
            <textarea
              value={editedScript}
              onChange={(event) => onEditScript(event.target.value)}
              className="mt-1 h-20 w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs outline-none focus:border-blue-400"
              placeholder="추천 문구를 확인하고 필요시 수정하세요"
            />
          </div>
        </>
      )}
    </section>
  );
}

function FollowUpDecisionPanel({
  draft,
  reservationInfo,
  reservation,
  showStage2Decision = false,
  onChange,
  onSave,
}: {
  draft: FollowUpDecisionDraft;
  reservationInfo?: ReservationInfo;
  reservation?: ReservationSnapshot;
  showStage2Decision?: boolean;
  onChange: (next: FollowUpDecisionDraft) => void;
  onSave: () => void;
}) {
  const routeMeta = FOLLOW_UP_ROUTE_META[draft.route];
  const needsSchedule = draft.route !== "HOLD_TRACKING";

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
        <ExternalLink size={15} className="text-blue-600" />
        STEP4 후속 결정
      </h3>
      <p className="mt-1 text-[11px] text-gray-500">연계/예약 선택은 이 단계에서만 가능합니다.</p>

      <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
        {(Object.keys(FOLLOW_UP_ROUTE_META) as FollowUpRoute[]).map((route) => {
          const meta = FOLLOW_UP_ROUTE_META[route];
          return (
            <button
              key={route}
              onClick={() =>
                onChange({
                  ...draft,
                  route,
                  place: meta.defaultPlace,
                })
              }
              className={cn(
                "rounded-lg border px-3 py-2 text-left transition-colors",
                draft.route === route ? "border-blue-300 bg-blue-50" : "border-gray-200 bg-gray-50 hover:bg-gray-100"
              )}
            >
              <p className="text-xs font-semibold text-slate-900">{meta.label}</p>
              <p className="mt-0.5 text-[11px] text-slate-600">{meta.description}</p>
            </button>
          );
        })}
      </div>

      {showStage2Decision ? (
        <div className="mt-3 rounded-md border border-slate-200 bg-slate-50 p-3">
          <p className="text-[11px] font-semibold text-slate-700">다음 단계 결정 (Stage1)</p>
          <p className="mt-0.5 text-[10px] text-slate-500">후속 결정 저장 시 Stage2 전환 여부를 함께 기록합니다.</p>
          <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-2">
            <button
              type="button"
              onClick={() => onChange({ ...draft, stage2Decision: "KEEP_STAGE1" })}
              className={cn(
                "rounded-md border px-3 py-2 text-left text-xs transition-colors",
                draft.stage2Decision === "KEEP_STAGE1"
                  ? "border-slate-400 bg-white text-slate-900"
                  : "border-slate-200 bg-slate-100 text-slate-700 hover:bg-slate-200",
              )}
            >
              <p className="font-semibold">Stage1 유지</p>
              <p className="mt-0.5 text-[10px] text-slate-500">후속 추적/연계를 Stage1에서 계속 수행</p>
            </button>
            <button
              type="button"
              onClick={() => onChange({ ...draft, stage2Decision: "MOVE_STAGE2" })}
              className={cn(
                "rounded-md border px-3 py-2 text-left text-xs transition-colors",
                draft.stage2Decision === "MOVE_STAGE2"
                  ? "border-blue-300 bg-blue-50 text-blue-900"
                  : "border-blue-200 bg-white text-blue-700 hover:bg-blue-50",
              )}
            >
              <p className="font-semibold">Stage2로 올림</p>
              <p className="mt-0.5 text-[10px] text-blue-600">2차 평가 대기열로 전환</p>
            </button>
          </div>
        </div>
      ) : null}

      <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
        <div>
          <label className="text-[11px] font-semibold text-gray-600">일정</label>
          <input
            type="datetime-local"
            value={toDateTimeLocalValue(draft.scheduledAt)}
            onChange={(event) => onChange({ ...draft, scheduledAt: fromDateTimeLocalValue(event.target.value) || draft.scheduledAt })}
            disabled={!needsSchedule}
            className="mt-1 w-full rounded-md border border-gray-200 px-2 py-1.5 text-xs outline-none focus:border-blue-400 disabled:bg-gray-100"
          />
        </div>
        <div>
          <label className="text-[11px] font-semibold text-gray-600">장소</label>
          <input
            value={draft.place}
            onChange={(event) => onChange({ ...draft, place: event.target.value })}
            disabled={!needsSchedule}
            className="mt-1 w-full rounded-md border border-gray-200 px-2 py-1.5 text-xs outline-none focus:border-blue-400 disabled:bg-gray-100"
          />
        </div>
      </div>

      <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-2">
        <div>
          <label className="text-[11px] font-semibold text-gray-600">문의/변경 연락처</label>
          <input
            value={draft.contactGuide}
            onChange={(event) => onChange({ ...draft, contactGuide: event.target.value })}
            disabled={!needsSchedule}
            className="mt-1 w-full rounded-md border border-gray-200 px-2 py-1.5 text-xs outline-none focus:border-blue-400 disabled:bg-gray-100"
          />
        </div>
        <div>
          <label className="text-[11px] font-semibold text-gray-600">메모</label>
          <input
            value={draft.note}
            onChange={(event) => onChange({ ...draft, note: event.target.value })}
            className="mt-1 w-full rounded-md border border-gray-200 px-2 py-1.5 text-xs outline-none focus:border-blue-400"
          />
        </div>
      </div>

      <div className="mt-3 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] text-slate-700">
        <p>현재 선택: <strong>{routeMeta.label}</strong></p>
        <p className="mt-0.5">예약안내 문자 템플릿은 후속 결정 저장 후 활성화됩니다.</p>
        {showStage2Decision ? (
          <p className="mt-0.5">
            단계 결정: <strong>{draft.stage2Decision === "MOVE_STAGE2" ? "Stage2로 올림" : "Stage1 유지"}</strong>
          </p>
        ) : null}
        <p className="mt-0.5">
          예약 출처/상태: <strong>{reservation?.source === "SMS" ? "SMS" : reservation?.source ?? "수동"} / {reservation ? RESERVATION_STATUS_LABELS[reservation.status] : "미생성"}</strong>
        </p>
        <p className="mt-0.5">현재 예약 정보: <strong>{reservationInfo ? reservationInfoToBookingLine(reservationInfo) : "없음"}</strong></p>
      </div>

      <div className="mt-3 flex justify-end">
        <button
          onClick={onSave}
          className="rounded-md bg-[#163b6f] px-3 py-1.5 text-xs font-semibold text-white"
        >
          후속 결정 저장
        </button>
      </div>
    </section>
  );
}

function AgentExecutionLogPanel({ logs }: { logs: AgentExecutionLog[] }) {
  return (
    <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <h3 className="text-sm font-bold text-slate-900">Agent 수행 로그</h3>
      <p className="mt-1 text-[11px] text-gray-500">자동 수행 결과 기록(운영자 확인용)</p>

      <div className="mt-3 space-y-2">
        {logs.length === 0 ? (
          <p className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-[11px] text-gray-500">
            자동 수행 기록 없음 — 운영자가 수동 실행했거나 아직 제안이 승인되지 않았습니다.
          </p>
        ) : (
          logs.slice(0, 4).map((log) => (
            <div key={log.id} className="rounded-md border border-violet-200 bg-violet-50 px-3 py-2">
              <p className="text-[11px] font-semibold text-violet-800">{AGENT_RESULT_LABELS[log.result]}</p>
              <p className="mt-0.5 text-[11px] text-violet-700">{log.summary}</p>
              <p className="mt-0.5 text-[10px] text-violet-600">
                {formatDateTime(log.at)}
                {log.recommendationTitle ? ` · 추천 ${log.recommendationTitle}` : ""}
              </p>
            </div>
          ))
        )}
      </div>
    </section>
  );
}

/* ═══ Contact Flow 패널 (행정 실행 4단계) ═══ */
function ContactFlowPanel({
  flowCards,
  onAction,
  mode = "stage1",
  stage2OpsView = false,
  opsLoopState,
  storedOpsStatus,
}: {
  flowCards: Stage1FlowCard[];
  onAction: (action: Stage1FlowAction) => void;
  mode?: StageOpsMode;
  stage2OpsView?: boolean;
  opsLoopState?: OpsLoopState | null;
  storedOpsStatus?: string | null;
}) {
  const title =
    mode === "stage2" ? "Stage2 진행 흐름" : mode === "stage3" ? (stage2OpsView ? "Stage2 진단검사 운영 루프" : "Stage3 운영 루프") : "Stage1 진행 흐름";
  const doneCount = flowCards.filter((card) => card.status === "COMPLETED").length;
  const readyCount = flowCards.filter((card) => card.status === "READY").length;

  return (
    <section className="relative z-10 rounded-2xl border border-gray-200 bg-gradient-to-b from-white to-slate-50 p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Zap size={15} className="text-blue-600" />
            {title}
          </h3>
          {storedOpsStatus ? (
            <p className="mt-1 text-[10px] text-slate-500">
              저장 상태: {storedOpsStatus} · 계산 상태: 완료 {opsLoopState?.doneCount ?? doneCount} / 준비 {opsLoopState?.readyCount ?? readyCount}
            </p>
          ) : null}
          {opsLoopState?.mismatch ? (
            <p className="mt-1 inline-flex rounded border border-amber-300 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-800">
              정합화 필요: {opsLoopState.mismatchReasons[0] ?? "저장 상태와 계산 상태가 불일치합니다."}
            </p>
          ) : null}
        </div>
        <span className="text-[11px] text-gray-500">
          {doneCount}/{flowCards.length} 단계 완료 · 준비 {readyCount}단계
        </span>
      </div>

      <div className="mt-4 overflow-x-auto overflow-y-visible pt-1 pb-3">
        <ol className="relative z-10 mx-auto flex w-max items-stretch justify-center gap-3 px-2">
          {flowCards.map((card, idx) => {
            const tone = FLOW_STATUS_META[card.status];
            const Icon = tone.icon;
            const lockReason = getFlowCardLockReason(flowCards, card.id);
            const isLocked = Boolean(lockReason);

            return (
              <React.Fragment key={card.id}>
                <li className="shrink-0 py-1">
                  <button
                    type="button"
                    onClick={() => {
                      if (isLocked) return;
                      onAction(card.action);
                    }}
                    aria-disabled={isLocked}
                    title={isLocked ? lockReason ?? undefined : undefined}
                    className={cn(
                      "group relative z-0 w-[230px] transform-gpu rounded-2xl border p-4 text-left transition-all duration-200 ease-out focus-visible:z-20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300",
                      tone.cardTone,
                      !isLocked && "hover:z-20 hover:-translate-y-0.5 hover:scale-[1.02]",
                      isLocked && "cursor-not-allowed opacity-75 saturate-75",
                      !isLocked && card.isCurrent && "ring-2 ring-offset-1 ring-blue-300 motion-safe:animate-pulse"
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-semibold tracking-wide text-slate-500">STEP {idx + 1}</span>
                      <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", tone.chipTone)}>
                        {tone.label}
                      </span>
                    </div>

                    <div className="mt-2 flex items-center gap-2">
                      <Icon size={14} className="shrink-0" />
                      <p className="text-sm font-bold tracking-tight">{card.title}</p>
                    </div>

                    <p className="mt-1 text-[11px] text-slate-600">{card.description}</p>
                    <div className={cn("mt-2 rounded-lg border px-2.5 py-2 text-[11px] leading-relaxed", tone.reasonTone)}>
                      <p className="font-semibold">상태 사유</p>
                      <p
                        className="mt-0.5 text-[10px]"
                        style={{
                          display: "-webkit-box",
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: "vertical",
                          overflow: "hidden",
                        }}
                      >
                        {card.reason}
                      </p>
                    </div>

                    {isLocked ? (
                      <div className="mt-2 max-h-0 overflow-hidden rounded-lg border border-amber-300 bg-amber-50 px-2.5 py-0 text-[11px] leading-relaxed text-amber-900 opacity-0 transition-all duration-200 group-hover:max-h-24 group-hover:py-2 group-hover:opacity-100 group-focus-visible:max-h-24 group-focus-visible:py-2 group-focus-visible:opacity-100">
                        <p className="font-semibold">선행 단계 필요</p>
                        <p
                          className="mt-0.5 text-[10px]"
                          style={{
                            display: "-webkit-box",
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: "vertical",
                            overflow: "hidden",
                          }}
                        >
                          {lockReason}
                        </p>
                      </div>
                    ) : (
                      <div className="mt-2 max-h-0 overflow-hidden rounded-lg border border-dashed border-slate-300 bg-white/70 px-2.5 py-0 text-[11px] text-slate-700 opacity-0 transition-all duration-200 group-hover:max-h-24 group-hover:py-2 group-hover:opacity-100 group-focus-visible:max-h-24 group-focus-visible:py-2 group-focus-visible:opacity-100">
                        <p className="font-semibold text-slate-800">다음 작업</p>
                        <p className="mt-0.5">{card.nextActionHint}</p>
                      </div>
                    )}

                    <span className="mt-2 inline-flex rounded-md border border-current/40 px-2.5 py-1 text-[11px] font-semibold">
                      {isLocked ? "선행 단계 필요" : "작업 열기"}
                    </span>
                  </button>
                </li>
                {idx < flowCards.length - 1 ? (
                  <li className="flex shrink-0 items-center text-slate-300" aria-hidden="true">
                    <ChevronRight size={18} />
                  </li>
                ) : null}
              </React.Fragment>
            );
          })}
        </ol>
      </div>

      <p className="mt-3 text-[11px] text-gray-500">
        {mode === "stage3"
          ? stage2OpsView
            ? "단계 카드를 누르면 단일 작업 패널에서 근거검토→신경심리→임상평가→전문의/분류 확정을 연속 수행합니다."
            : "단계 카드를 누르면 단일 작업 패널에서 추적·재평가·관리 제공을 연속 수행합니다. 현재 운영 단계가 강조됩니다."
          : "단계 카드를 누르면 단일 작업 패널이 열리고 Step1~4를 연속 수행할 수 있습니다."}
      </p>
    </section>
  );
}

/* ═══ 접촉 전략 카드 ═══ */
function ContactStrategyCard({
  preTriageInput,
  preTriage,
  strategyBadge,
  effectiveStrategy,
  contactPlan,
  riskGuardrails,
  onOverride,
}: {
  preTriageInput?: PreTriageInput;
  preTriage?: PreTriageResult;
  strategyBadge: ContactStrategy;
  effectiveStrategy: RecommendedContactStrategy;
  contactPlan?: ContactPlan;
  riskGuardrails?: string[];
  onOverride: () => void;
}) {
  const channelLabel =
    contactPlan?.channel === "CALL"
      ? "전화 우선"
      : contactPlan?.channel === "SMS"
        ? "문자 우선"
        : "하이브리드";

  const isVulnerable = Boolean(riskGuardrails?.length);

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
          <Shield size={15} className="text-blue-600" />
          접촉 전략 (사전 기준/룰 기반)
        </h3>
        <button
          onClick={onOverride}
          className="inline-flex items-center gap-1 rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] font-semibold text-amber-700 hover:bg-amber-100"
        >
          <RefreshCw size={11} /> 전략 전환
        </button>
      </div>

      <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className={cn("rounded-lg border p-3", STRATEGY_TONES[strategyBadge])}>
          <p className="text-[11px] font-semibold opacity-70">현재 전략 배지</p>
          <p className="mt-1 text-base font-bold">
            {strategyBadge}
            {strategyBadge === "MANUAL_OVERRIDE" ? ` (${effectiveStrategy})` : ""}
          </p>
          <p className="mt-1 text-[11px] opacity-80">
            {channelLabel} · 재시도 {contactPlan?.maxRetryPolicy.maxRetries ?? 2}회 / {contactPlan?.maxRetryPolicy.intervalHours ?? 24}시간 간격
          </p>
          <p className="mt-1 text-[10px] opacity-80">운영 참고</p>
        </div>

        <div className="rounded-lg border border-gray-100 bg-gray-50 p-3">
          <p className="text-[11px] font-semibold text-gray-700">정책 사유 (트리거)</p>
          {(preTriage?.triggers ?? []).map((trigger) => (
            <p key={trigger} className="mt-0.5 text-[11px] text-gray-600">• {trigger}</p>
          ))}
          <p className="mt-2 text-[10px] text-gray-500">{preTriage?.policyNote}</p>
          <p className="mt-1 text-[10px] text-gray-500">
            confidence: {preTriage?.confidence ?? "RULE"} / 담당자 확인 필요
          </p>
        </div>
      </div>

      {riskGuardrails && riskGuardrails.length > 0 && (
        <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-2.5">
          <p className="text-[11px] font-semibold text-amber-800 flex items-center gap-1">
            <AlertTriangle size={12} /> 취약군(상담사 우선) 정책 안내
          </p>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {riskGuardrails.map((g) => (
              <span key={g} className="rounded border border-amber-300 bg-white px-2 py-0.5 text-[10px] font-semibold text-amber-700">{g}</span>
            ))}
          </div>
          <p className="mt-2 text-[10px] text-amber-800">
            왜 상담사 우선인지: 취약군 보호와 민원 위험 완화를 위한 운영 정책입니다.
          </p>
        </div>
      )}

      {preTriageInput ? (
        <div className="mt-3 rounded-lg border border-gray-100 bg-gray-50 p-3 text-[11px] text-gray-600">
          <p>
            입력 요약: 연령 {preTriageInput.age}세 / 보호자 {preTriageInput.guardian.exists ? "있음" : "없음"} /
            민원 이력 {preTriageInput.contactHistory.hasComplaint ? "있음" : "없음"} /
            거부 이력 {preTriageInput.contactHistory.hasRefusal ? "있음" : "없음"}
          </p>
        </div>
      ) : null}

      <p className="mt-3 text-[10px] text-gray-500">
        {STRATEGY_HELPER_TEXT}
        {isVulnerable ? " (취약군 정책 적용 케이스)" : ""}
      </p>
    </section>
  );
}

/* ═══ Next Action 패널 ═══ */
function NextActionPanel({
  mode = "stage1",
  execution,
  strategy,
  preTriageReady,
  strategyDecided,
  hasVulnerableGuardrail,
  linkageStatus,
  onOpenSmsModal,
  onOpenOutcomeTriage,
  onOpenHandoffMemo,
  onOpenStrategyOverride,
}: {
  mode?: StageOpsMode;
  execution: ContactExecution;
  strategy: RecommendedContactStrategy;
  preTriageReady: boolean;
  strategyDecided: boolean;
  hasVulnerableGuardrail: boolean;
  linkageStatus: LinkageStatus;
  onOpenSmsModal: () => void;
  onOpenOutcomeTriage: () => void;
  onOpenHandoffMemo: () => void;
  onOpenStrategyOverride: () => void;
}) {
  const isStage2Mode = mode === "stage2";
  const isStage3Mode = mode === "stage3";
  const p1Actions: Array<{ label: string; action: () => void; tone: string }> = [];
  const p2Actions: Array<{ label: string; action: () => void; tone: string }> = [];

  if (!preTriageReady) {
    p1Actions.push({
      label: isStage3Mode ? "추적 기준선 누락 항목 보완" : isStage2Mode ? "2차 근거 누락 항목 보완" : "사전 확인 누락 항목 보완",
      action: onOpenStrategyOverride,
      tone: "bg-red-600 text-white hover:bg-red-700",
    });
  }

  if (!strategyDecided || hasVulnerableGuardrail) {
    p1Actions.push({
      label: isStage3Mode ? "감별경로 권고/의뢰 처리" : isStage2Mode ? "분기/운영강도 설정" : "접촉 방식 확정/수동 변경",
      action: onOpenStrategyOverride,
      tone: "bg-amber-600 text-white hover:bg-amber-700",
    });
  }

  if (execution.status === "NOT_STARTED" || execution.status === "RETRY_NEEDED") {
    p1Actions.push({
      label: isStage3Mode
        ? "재평가 예약 생성/변경"
        : isStage2Mode
        ? `분기 안내 실행 (${strategy === "HUMAN_FIRST" ? "상담사 우선" : "자동안내 우선"})`
        : `1차 접촉 실행 (${strategy === "HUMAN_FIRST" ? "상담사 우선" : "자동안내 우선"})`,
      action: onOpenSmsModal,
      tone: "bg-[#15386a] text-white hover:bg-[#102b4e]",
    });
  }

  if (execution.status === "SENT" || execution.status === "WAITING_RESPONSE") {
    p1Actions.push({
      label: isStage3Mode ? "재평가 완료/노쇼 기록" : isStage2Mode ? "연계/동의 결과 처리" : "응답 결과 처리",
      action: onOpenOutcomeTriage,
      tone: "bg-blue-600 text-white hover:bg-blue-700",
    });
  }

  if (execution.status === "HANDOFF_TO_HUMAN" || execution.status === "PAUSED") {
    p1Actions.push({
      label: isStage3Mode ? "플랜 업데이트 사유/메모 작성" : isStage2Mode ? "확정 사유/메모 작성" : "상담 인계 메모 작성/확인",
      action: onOpenHandoffMemo,
      tone: "bg-red-600 text-white hover:bg-red-700",
    });
  }

  if (execution.status === "STOPPED") {
    p2Actions.push({
      label: isStage3Mode ? "운영 상태(이탈/종결) 확인" : isStage2Mode ? "중단/보류 사유 확인" : "재접촉 제한 안내 확인",
      action: onOpenHandoffMemo,
      tone: "border-red-200 bg-red-50 text-red-700 hover:bg-red-100",
    });
  }

  if (execution.status === "RETRY_NEEDED") {
    p2Actions.push({
      label: isStage3Mode ? "확인 연락/리마인더 보조 실행" : isStage2Mode ? "무응답 재접촉 계획 적용" : "반복 무응답 재시도 규칙 적용",
      action: onOpenSmsModal,
      tone: "border-orange-200 bg-orange-50 text-orange-700 hover:bg-orange-100",
    });
  }

  if (linkageStatus === "BOOKING_IN_PROGRESS" || linkageStatus === "REFERRAL_CREATED") {
    p2Actions.push({
      label: isStage3Mode ? "플랜/연계 후속 상태 확인" : isStage2Mode ? "연계/예약 후속 상태 확인" : "예약/의뢰 후속 상태 확인",
      action: onOpenHandoffMemo,
      tone: "border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
    });
  }

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
        <Zap size={15} className="text-orange-600" />
        지금 할 일
      </h3>
      <p className="mt-1 text-[11px] text-gray-500">운영 참고 · 담당자 확인 필요</p>

      {p1Actions.length > 0 && (
        <div className="mt-3 space-y-2">
          <p className="text-[11px] font-semibold text-red-700">P1 · 즉시 실행</p>
          {p1Actions.map((a) => (
            <button
              key={a.label}
              onClick={a.action}
              className={cn("w-full rounded-lg border px-3 py-2.5 text-xs font-semibold transition-colors", a.tone)}
            >
              {a.label}
            </button>
          ))}
        </div>
      )}

      {p2Actions.length > 0 && (
        <div className="mt-3 space-y-2">
          <p className="text-[11px] font-semibold text-blue-700">P2 · 보조 실행</p>
          {p2Actions.map((a) => (
            <button
              key={a.label}
              onClick={a.action}
              className={cn("w-full rounded-lg border px-3 py-2 text-xs font-semibold transition-colors", a.tone)}
            >
              {a.label}
            </button>
          ))}
        </div>
      )}

      {execution.lastOutcomeCode && (
        <div className="mt-3 rounded-md border border-gray-100 bg-gray-50 px-3 py-2">
          <p className="text-[11px] text-gray-600">
            최근 결과: <strong>{OUTCOME_LABELS[execution.lastOutcomeCode].label}</strong>
          </p>
        </div>
      )}
    </section>
  );
}

function ResponseTriagePanel({
  expanded,
  onToggle,
  executionStatus,
  lastSentAt,
  lastSmsSentAt,
  assigneeName,
  reservation,
  showReservationSync,
  autoFilledState,
  onOpenReservationDetail,
  selectedOutcomeCode,
  onSelectOutcomeCode,
  reasonTags,
  onToggleReasonTag,
  rejectReasonDraft,
  onRejectReasonDraftChange,
  noResponsePlanDraft,
  onNoResponsePlanDraftChange,
  outcomeNote,
  onOutcomeNoteChange,
  isSaving,
  submitError,
  validationError,
  onClearError,
  onReset,
  onConfirm,
  hasUnsavedChanges,
  lastSavedAt,
  onOpenHandoffMemo,
  mode = "stage1",
}: {
  expanded: boolean;
  onToggle: () => void;
  executionStatus: ContactExecutionStatus;
  lastSentAt?: string;
  lastSmsSentAt?: string | null;
  assigneeName: string;
  reservation?: ReservationSnapshot;
  showReservationSync?: boolean;
  autoFilledState?: AutoFilledOutcomeState | null;
  onOpenReservationDetail?: () => void;
  selectedOutcomeCode: OutcomeCode | null;
  onSelectOutcomeCode: (code: OutcomeCode | null) => void;
  reasonTags: ResponseReasonTag[];
  onToggleReasonTag: (tag: ResponseReasonTag) => void;
  rejectReasonDraft: RejectReasonDraft;
  onRejectReasonDraftChange: (next: RejectReasonDraft) => void;
  noResponsePlanDraft: NoResponsePlanDraft;
  onNoResponsePlanDraftChange: (next: NoResponsePlanDraft) => void;
  outcomeNote: string;
  onOutcomeNoteChange: (note: string) => void;
  isSaving: boolean;
  submitError?: string | null;
  validationError?: string | null;
  onClearError: () => void;
  onReset: () => void;
  onConfirm: () => void | Promise<void>;
  hasUnsavedChanges: boolean;
  lastSavedAt?: string | null;
  onOpenHandoffMemo?: () => void;
  mode?: StageOpsMode;
}) {
  const isStage3Mode = mode === "stage3";
  const currentStatusLabel = selectedOutcomeCode
    ? OUTCOME_LABELS[selectedOutcomeCode].label
    : CONTACT_STATUS_HINT[executionStatus];

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
          <ArrowRightCircle size={15} className="text-blue-600" />
          {isStage3Mode ? "추적 접촉 결과 기록(보조)" : "응답 결과 처리"}
        </h3>
        <button
          onClick={onToggle}
          className="rounded-md border border-gray-200 px-2 py-1 text-[11px] font-semibold text-gray-600 hover:bg-gray-50"
        >
          {expanded ? "접기" : "열기"}
        </button>
      </div>
      <p className="mt-1 text-[11px] text-gray-500">
        {isStage3Mode ? "재평가/일정 안내를 위한 보조 기록 패널입니다." : "운영 참고 · 담당자 확인 필요"}
      </p>

      {expanded ? (
        <div className="mt-3 space-y-3">
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <div className="grid grid-cols-1 gap-2 text-[11px] md:grid-cols-3">
              <p className="text-slate-600">
                현재 상태: <strong className="text-slate-900">{currentStatusLabel}</strong>
              </p>
              <p className="text-slate-600">
                최근 발송: <strong className="text-slate-900">{formatDateTime(lastSentAt)}</strong>
              </p>
              <p className="text-slate-600">
                담당자: <strong className="text-slate-900">{assigneeName}</strong>
              </p>
            </div>
            <p className="mt-2 text-[11px] text-slate-600">
              먼저 결과 유형을 선택하고, 필요한 입력을 채운 뒤 저장하세요.
            </p>
          </div>

          {showReservationSync && reservation?.source === "SMS" && reservation.status !== "NONE" ? (
            <div className="rounded-lg border border-sky-200 bg-sky-50 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="space-y-1 text-[11px]">
                  <p className="inline-flex items-center rounded-full border border-sky-300 bg-white px-2 py-0.5 font-semibold text-sky-700">
                    문자 예약 동기화
                  </p>
                  <p className="text-slate-700">
                    최근 문자 발송: <strong>{formatDateTime(lastSmsSentAt)}</strong>
                  </p>
                  <p className="text-slate-700">
                    예약 상태: <strong>{RESERVATION_STATUS_LABELS[reservation.status]}</strong>
                  </p>
                  <p className="text-slate-700">
                    예약 완료 시각: <strong>{formatDateTime(reservation.updatedAt ?? reservation.createdAt)}</strong>
                  </p>
                </div>
                {onOpenReservationDetail ? (
                  <button
                    type="button"
                    onClick={onOpenReservationDetail}
                    className="rounded-md border border-sky-300 bg-white px-2.5 py-1 text-[11px] font-semibold text-sky-700 hover:bg-sky-100"
                  >
                    예약 내용 확인
                  </button>
                ) : null}
              </div>
            </div>
          ) : null}

          {!((showReservationSync && reservation?.source === "SMS" && reservation.status !== "NONE")) && lastSmsSentAt ? (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-[11px] text-slate-700">
              <p className="font-semibold text-slate-800">문자 예약 동기화 대기</p>
              <p className="mt-1">
                최근 문자 발송 {formatDateTime(lastSmsSentAt)} 이후 시민 예약 이벤트가 아직 수신되지 않았습니다.
              </p>
              <p className="mt-1 text-slate-500">
                시민이 문자 링크에서 예약을 완료하면 이 위치에 예약 출처/일정/상태가 자동으로 표시됩니다.
              </p>
            </div>
          ) : null}

          {autoFilledState ? (
            <div
              className={cn(
                "rounded-md border px-3 py-2 text-[11px]",
                autoFilledState.manualOverriddenAt
                  ? "border-amber-200 bg-amber-50 text-amber-800"
                  : "border-emerald-200 bg-emerald-50 text-emerald-800",
              )}
            >
              <p className="font-semibold">
                {autoFilledState.manualOverriddenAt ? "자동 반영 후 수동 수정됨" : "자동 반영됨"}
              </p>
              <p className="mt-0.5">{autoFilledState.summary}</p>
              <p className="mt-0.5 text-[10px] opacity-80">
                자동 반영 {formatDateTime(autoFilledState.autoFilledAt)}
                {autoFilledState.manualOverriddenAt ? ` · 수동 수정 ${formatDateTime(autoFilledState.manualOverriddenAt)}` : ""}
              </p>
            </div>
          ) : null}

          <div className="rounded-md border border-indigo-200 bg-indigo-50 px-3 py-2 text-[11px] font-semibold text-indigo-800">
            운영 참고 · 담당자 확인 필요
          </div>

          {validationError ? (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2">
              <p className="text-[11px] font-semibold text-red-700">{validationError}</p>
            </div>
          ) : null}

          {submitError ? (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2">
              <div className="flex items-start justify-between gap-2">
                <p className="text-[11px] font-semibold text-red-700">저장 실패: {submitError}</p>
                <button
                  onClick={onClearError}
                  className="rounded border border-red-200 px-1.5 py-0.5 text-[10px] font-semibold text-red-700 hover:bg-red-100"
                >
                  닫기
                </button>
              </div>
            </div>
          ) : null}

          <div>
            <p className="text-[11px] font-semibold text-gray-600">결과 유형 (단일 선택)</p>
            <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-2">
              {RESPONSE_PRIMARY_OUTCOMES.map((code) => {
                const meta = OUTCOME_LABELS[code];
                const selected = selectedOutcomeCode === code;
                return (
                  <button
                    key={code}
                    type="button"
                    onClick={() => {
                      onClearError();
                      onSelectOutcomeCode(code);
                    }}
                    className={cn(
                      "rounded-lg border-2 px-3 py-2 text-left transition-colors",
                      selected ? `${meta.tone} border-current` : "border-gray-200 bg-gray-50 hover:bg-gray-100",
                    )}
                  >
                    <p className="text-xs font-semibold text-slate-900">{meta.label}</p>
                    <p className="mt-1 text-[10px] text-slate-500">
                      {code === "CONTINUE_SELF"
                        ? "응답 확인 후 다음 단계 진행"
                        : code === "SCHEDULE_LATER"
                          ? "일정 보류 후 추후 재처리"
                          : code === "REQUEST_GUARDIAN"
                            ? "보호자 연락으로 전환"
                            : code === "REQUEST_HUMAN"
                              ? "사람 상담으로 전환"
                              : code === "NO_RESPONSE"
                                ? "무응답으로 재접촉 계획 생성"
                                : "중단/거부 사유를 기록"}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {selectedOutcomeCode === "NO_RESPONSE" ? (
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
              <p className="text-[11px] font-semibold text-blue-800">무응답 재접촉 계획 (필수)</p>
              <p className="mt-1 text-[10px] text-blue-700">
                재시도 카운트는 저장 시 자동으로 +1 반영됩니다. 현재 {noResponsePlanDraft.channel === "CALL" ? "전화" : "문자"} 채널로 설정되어 있습니다.
              </p>
              <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-3">
                <div>
                  <label className="text-[10px] font-semibold text-gray-600">채널</label>
                  <div className="mt-1 grid grid-cols-2 gap-1">
                    {(Object.keys(NO_RESPONSE_CHANNEL_LABEL) as Array<"CALL" | "SMS">).map((channel) => (
                      <button
                        key={channel}
                        type="button"
                        onClick={() =>
                          onNoResponsePlanDraftChange({
                            ...noResponsePlanDraft,
                            channel,
                            strategy: NO_RESPONSE_CHANNEL_STRATEGY[channel],
                          })
                        }
                        className={cn(
                          "rounded-md border px-2 py-1 text-[10px] font-semibold",
                          noResponsePlanDraft.channel === channel
                            ? "border-blue-300 bg-blue-100 text-blue-800"
                            : "border-gray-200 bg-white text-gray-600",
                        )}
                      >
                        {NO_RESPONSE_CHANNEL_LABEL[channel]}
                      </button>
                    ))}
                  </div>
                </div>
                <label className="text-[10px] font-semibold text-gray-600">
                  다음 접촉 일시
                  <input
                    type="datetime-local"
                    value={toDateTimeLocalValue(noResponsePlanDraft.nextContactAt)}
                    onChange={(event) => {
                      const next = fromDateTimeLocalValue(event.target.value);
                      onNoResponsePlanDraftChange({
                        ...noResponsePlanDraft,
                        nextContactAt: next || noResponsePlanDraft.nextContactAt,
                      });
                    }}
                    className="mt-1 h-8 w-full rounded-md border border-gray-200 px-2 text-[11px] outline-none focus:border-blue-400"
                  />
                </label>
                <label className="text-[10px] font-semibold text-gray-600">
                  담당자
                  <input
                    type="text"
                    value={noResponsePlanDraft.assigneeId}
                    onChange={(event) => {
                      onNoResponsePlanDraftChange({
                        ...noResponsePlanDraft,
                        assigneeId: event.target.value,
                      });
                    }}
                    className="mt-1 h-8 w-full rounded-md border border-gray-200 px-2 text-[11px] outline-none focus:border-blue-400"
                    placeholder="담당자 이름 또는 ID"
                  />
                </label>
              </div>
              <label className="mt-2 inline-flex items-center gap-2 text-[10px] text-blue-800">
                <input
                  type="checkbox"
                  checked={noResponsePlanDraft.applyL3}
                  onChange={(event) =>
                    onNoResponsePlanDraftChange({
                      ...noResponsePlanDraft,
                      applyL3: event.target.checked,
                    })
                  }
                />
                권고에 따라 개입 레벨 L3를 적용합니다.
              </label>
            </div>
          ) : null}

          {selectedOutcomeCode === "REFUSE" ? (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3">
              <p className="text-[11px] font-semibold text-red-800">거부 사유 입력 (필수)</p>
              <p className="mt-1 text-[10px] text-red-700">거부 사유는 운영 개선과 민원 대응 근거로 활용됩니다.</p>
              <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-2">
                <label className="text-[10px] font-semibold text-gray-600">
                  거부 코드
                  <select
                    value={rejectReasonDraft.code ?? ""}
                    onChange={(event) => {
                      const nextCode = (event.target.value || null) as RejectReasonCode | null;
                      onRejectReasonDraftChange({ ...rejectReasonDraft, code: nextCode });
                    }}
                    className="mt-1 h-8 w-full rounded-md border border-gray-200 bg-white px-2 text-[11px] outline-none focus:border-red-300"
                  >
                    <option value="">코드 선택</option>
                    {REJECT_REASON_OPTIONS.map((option) => (
                      <option key={option.code} value={option.code}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <div>
                  <label className="text-[10px] font-semibold text-gray-600">거부 수준</label>
                  <div className="mt-1 grid grid-cols-2 gap-1">
                    {REJECT_LEVEL_OPTIONS.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => onRejectReasonDraftChange({ ...rejectReasonDraft, level: option.value })}
                        className={cn(
                          "h-8 rounded-md border px-2 text-[10px] font-semibold",
                          rejectReasonDraft.level === option.value
                            ? "border-red-300 bg-red-100 text-red-700"
                            : "border-gray-200 bg-white text-gray-600",
                        )}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              {rejectReasonDraft.code === "R7_OTHER" ? (
                <label className="mt-2 block text-[10px] font-semibold text-gray-600">
                  기타 사유 (필수)
                  <textarea
                    value={rejectReasonDraft.detail}
                    onChange={(event) => onRejectReasonDraftChange({ ...rejectReasonDraft, detail: event.target.value })}
                    className="mt-1 h-14 w-full rounded-md border border-gray-200 px-2 py-1 text-[11px] outline-none focus:border-red-300"
                    placeholder="기타 거부 사유를 입력하세요"
                  />
                </label>
              ) : null}
            </div>
          ) : null}

          {selectedOutcomeCode === "REQUEST_GUARDIAN" || selectedOutcomeCode === "REQUEST_HUMAN" ? (
            <div className="rounded-lg border border-violet-200 bg-violet-50 p-3">
              <p className="text-[11px] font-semibold text-violet-800">인계 메모 작성 (권장)</p>
              <p className="mt-1 text-[10px] text-violet-700">인계 정보까지 함께 기록하면 후속 조치가 빨라집니다.</p>
              <button
                type="button"
                onClick={onOpenHandoffMemo}
                className="mt-2 rounded-md border border-violet-300 bg-white px-2.5 py-1 text-[11px] font-semibold text-violet-700 hover:bg-violet-100"
              >
                인계 메모 열기
              </button>
            </div>
          ) : null}

          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
            <p className="text-[11px] font-semibold text-amber-800">보조 사유 태그 (복수 선택)</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {(Object.keys(RESPONSE_REASON_TAG_META) as ResponseReasonTag[]).map((tag) => {
                const meta = RESPONSE_REASON_TAG_META[tag];
                const selected = reasonTags.includes(tag);
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => onToggleReasonTag(tag)}
                    className={cn(
                      "rounded-full border px-2.5 py-1 text-[10px] font-semibold transition-colors",
                      selected ? meta.tone : "border-gray-200 bg-white text-gray-600",
                    )}
                    title={meta.hint}
                  >
                    {meta.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="text-[11px] font-semibold text-gray-600">메모 (선택)</label>
            <textarea
              value={outcomeNote}
              onChange={(event) => onOutcomeNoteChange(event.target.value)}
              className="mt-1 h-16 w-full rounded-md border border-gray-200 px-2 py-1 text-xs outline-none focus:border-blue-400"
              placeholder="응답 내용을 간단히 기록하세요"
            />
          </div>

          <div className="sticky bottom-0 z-10 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white/95 px-3 py-2 backdrop-blur">
            <div className="flex items-center gap-2 text-[11px]">
              <span
                className={cn(
                  "rounded-full border px-2 py-0.5 font-semibold",
                  hasUnsavedChanges
                    ? "border-amber-200 bg-amber-50 text-amber-700"
                    : "border-emerald-200 bg-emerald-50 text-emerald-700",
                )}
              >
                {hasUnsavedChanges ? "저장되지 않음" : "저장 완료"}
              </span>
              {lastSavedAt ? <span className="text-gray-500">최근 저장 {formatDateTime(lastSavedAt)}</span> : null}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={onToggle}
                className="rounded-md border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-700"
              >
                닫기
              </button>
              <button
                onClick={onReset}
                className="rounded-md border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-700"
              >
                초기화
              </button>
              <button
                onClick={onConfirm}
                disabled={isSaving}
                className="rounded-md bg-[#163b6f] px-3 py-1.5 text-xs font-semibold text-white disabled:bg-gray-300"
              >
                {isSaving ? "저장 중..." : "저장"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function ReservationDetailModal({
  open,
  reservation,
  onClose,
}: {
  open: boolean;
  reservation?: ReservationSnapshot;
  onClose: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="w-[min(720px,94vw)] rounded-xl border border-gray-200 bg-white p-0">
        <div className="border-b border-gray-100 px-5 py-4">
          <h3 className="text-sm font-bold text-slate-900">예약 내용 확인</h3>
          <p className="mt-1 text-[11px] text-gray-500">문자 예약 동기화 결과를 확인합니다.</p>
        </div>
        <div className="space-y-3 px-5 py-4 text-xs text-slate-700">
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
              <p className="text-[11px] text-slate-500">채널 출처</p>
              <p className="mt-0.5 font-semibold text-slate-900">문자(SMS) 링크</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
              <p className="text-[11px] text-slate-500">예약 주체</p>
              <p className="mt-0.5 font-semibold text-slate-900">
                {reservation?.createdBy === "STAFF" ? "담당자 수행" : reservation?.createdBy === "AGENT" ? "자동 안내/응답 수집" : "시민 직접 수행"}
              </p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
              <p className="text-[11px] text-slate-500">예약 프로그램</p>
              <p className="mt-0.5 font-semibold text-slate-900">
                {reservation?.programName ?? reservation?.programType ?? "일부 정보 미수신"}
              </p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
              <p className="text-[11px] text-slate-500">예약 상태</p>
              <p className="mt-0.5 font-semibold text-slate-900">
                {reservation ? RESERVATION_STATUS_LABELS[reservation.status] : "일부 정보 미수신"}
              </p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
              <p className="text-[11px] text-slate-500">예약 일정</p>
              <p className="mt-0.5 font-semibold text-slate-900">{formatDateTime(reservation?.scheduledAt)}</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
              <p className="text-[11px] text-slate-500">장소/기관</p>
              <p className="mt-0.5 font-semibold text-slate-900">{reservation?.locationName ?? "일부 정보 미수신"}</p>
            </div>
          </div>

          {reservation?.options && reservation.options.length > 0 ? (
            <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
              <p className="text-[11px] font-semibold text-slate-700">추가 옵션</p>
              <div className="mt-1 space-y-1 text-[11px] text-slate-600">
                {reservation.options.map((option) => (
                  <p key={`${option.key}-${option.value}`}>
                    {option.label}: <strong className="text-slate-900">{option.value}</strong>
                  </p>
                ))}
              </div>
            </div>
          ) : null}

          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] text-slate-600">
            내부 식별자 {reservation?.reservationId ? `#${reservation.reservationId}` : "미수신"} · 외부 원문 링크/토큰은 노출하지 않습니다.
          </div>
        </div>
        <div className="flex justify-end border-t border-gray-100 px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-gray-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-gray-50"
          >
            닫기
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function HandoffMemoGeneratorCard({
  expanded,
  onToggle,
  memoText,
  onMemoChange,
  onSave,
  mode = "stage1",
}: {
  expanded: boolean;
  onToggle: () => void;
  memoText: string;
  onMemoChange: (text: string) => void;
  onSave: () => void;
  mode?: StageOpsMode;
}) {
  const isStage3Mode = mode === "stage3";
  return (
    <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
          <FilePenLine size={15} className="text-blue-600" />
          {isStage3Mode ? "운영 메모/플랜 근거" : "상담 인계 메모"}
        </h3>
        <button
          onClick={onToggle}
          className="rounded-md border border-gray-200 px-2 py-1 text-[11px] font-semibold text-gray-600 hover:bg-gray-50"
        >
          {expanded ? "접기" : "열기"}
        </button>
      </div>
      <p className="mt-1 text-[11px] text-gray-500">{isStage3Mode ? "플랜 업데이트/연계 변경 사유를 기록합니다." : "운영 참고 · 담당자 확인 필요"}</p>

      {expanded ? (
        <div className="mt-3 space-y-2">
          <textarea
            value={memoText}
            onChange={(event) => onMemoChange(event.target.value)}
            className="h-40 w-full rounded-md border border-gray-200 px-3 py-2 text-xs font-mono outline-none focus:border-blue-400"
            placeholder="[인수인계 메모]&#10;접촉 전략(룰 기반): ...&#10;트리거: ...&#10;최근 접촉: ...&#10;현재 결과: ...&#10;권장 다음 행동: ..."
          />
          <div className="flex justify-end">
            <button
              onClick={onSave}
              disabled={!memoText.trim()}
              className="rounded-md bg-[#163b6f] px-3 py-1.5 text-xs font-semibold text-white disabled:bg-gray-300"
            >
              저장
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}

export function PolicyGatePanel({
  gates,
  onFix,
  mode = "stage1",
}: {
  gates: PolicyGate[];
  onFix: (gate: PolicyGate) => void;
  mode?: StageOpsMode;
}) {
  const isStage3Mode = mode === "stage3";
  const gateMap = new Map(gates.map((gate) => [gate.key, gate] as const));
  const baseGateKeys: PolicyGateKey[] = ["CONSENT_OK", "PHONE_VERIFIED", "GUARDIAN_OPTIONAL"];
  const baseGates = baseGateKeys
    .map((key) => gateMap.get(key))
    .filter((gate): gate is PolicyGate => Boolean(gate));

  const consentGate = gateMap.get("CONSENT_OK");
  const phoneGate = gateMap.get("PHONE_VERIFIED");
  const guardianGate = gateMap.get("GUARDIAN_OPTIONAL");

  const callState: ChannelState =
    phoneGate?.status === "PASS"
      ? "OK"
      : phoneGate?.status === "FAIL" && hasChannelRestriction(phoneGate.failReason)
        ? "RESTRICTED"
        : "NEEDS_CHECK";
  const smsState: ChannelState =
    consentGate?.status === "FAIL"
      ? "RESTRICTED"
      : phoneGate?.status === "PASS"
        ? "OK"
        : phoneGate?.status === "FAIL" && hasChannelRestriction(phoneGate.failReason)
          ? "RESTRICTED"
          : "NEEDS_CHECK";
  const guardianState: ChannelState =
    guardianGate?.status === "PASS" ? "OK" : guardianGate?.status === "FAIL" ? "RESTRICTED" : "NEEDS_CHECK";

  const callDetail = callState === "OK" ? channelStateSummary(callState) : phoneGate?.failReason ?? channelStateSummary(callState);
  const smsDetail =
    smsState === "OK"
      ? channelStateSummary(smsState)
      : consentGate?.status === "FAIL"
        ? consentGate.failReason ?? channelStateSummary(smsState)
        : phoneGate?.failReason ?? channelStateSummary(smsState);
  const guardianDetail =
    guardianState === "OK" ? channelStateSummary(guardianState) : guardianGate?.failReason ?? channelStateSummary(guardianState);

  const channelRows: Array<{
    key: ChannelType;
    label: string;
    state: ChannelState;
    detail: string;
    actionLabel?: string;
    onAction?: () => void;
  }> = [
    {
      key: "CALL",
      label: "전화",
      state: callState,
      detail: callDetail,
      actionLabel:
        callState === "NEEDS_CHECK"
          ? "번호 검증"
          : callState === "RESTRICTED"
            ? "제한 사유 보기"
            : undefined,
      onAction:
        callState === "NEEDS_CHECK" && phoneGate?.fixAction?.action === "VERIFY_PHONE"
          ? () => onFix(phoneGate)
          : callState === "RESTRICTED"
            ? () => toast.error(callDetail)
            : undefined,
    },
    {
      key: "SMS",
      label: "문자",
      state: smsState,
      detail: smsDetail,
      actionLabel:
        smsState === "NEEDS_CHECK"
          ? "문자 채널 점검"
          : smsState === "RESTRICTED"
            ? "제한 사유 보기"
            : undefined,
      onAction:
        smsState === "NEEDS_CHECK"
          ? () => toast("문자 채널 점검은 준비 중입니다.")
          : smsState === "RESTRICTED"
            ? () => toast.error(smsDetail)
            : undefined,
    },
    {
      key: "GUARDIAN",
      label: "보호자",
      state: guardianState,
      detail: guardianDetail,
      actionLabel:
        guardianState === "RESTRICTED"
          ? "제한 사유 보기"
          : guardianState === "NEEDS_CHECK" && guardianGate?.fixAction
            ? guardianGate.fixAction.label
            : undefined,
      onAction:
        guardianState === "RESTRICTED"
          ? () => toast.error(guardianDetail)
          : guardianState === "NEEDS_CHECK" && guardianGate?.fixAction
            ? () => onFix(guardianGate)
            : undefined,
    },
  ];

  const channelCardState: ChannelState = channelRows.some((row) => row.state === "RESTRICTED")
    ? "RESTRICTED"
    : channelRows.some((row) => row.state === "NEEDS_CHECK")
      ? "NEEDS_CHECK"
      : "OK";

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
          <UserCheck size={15} className="text-slate-500" />
          {isStage3Mode ? "추적 설정 상태" : "사전 확인 상태"}
        </h3>
        <span className="text-[11px] text-gray-500">{isStage3Mode ? "기준선 미확정 항목은 Step2가 잠금됩니다." : "미충족 항목은 실행 전 확인 필요"}</span>
      </div>

      <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2">
        {baseGates.map((gate) => (
          <div key={gate.key} className="rounded-lg border border-gray-100 bg-gray-50 p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-semibold text-slate-800">{gate.label}</p>
              <span className={cn("rounded px-2 py-0.5 text-[10px] font-semibold", gateTone(gate.status))}>
                {gate.status === "PASS" ? "충족" : gate.status === "FAIL" ? "미충족" : "확인 필요"}
              </span>
            </div>
            <p className="mt-1 text-[11px] text-gray-500">{gate.failReason ?? "운영 실행 가능"}</p>
            {gate.fixAction && gate.status !== "PASS" && (
              <button
                onClick={() => onFix(gate)}
                className="mt-2 inline-flex items-center gap-1 rounded-md border border-blue-200 bg-blue-50 px-2 py-1 text-[11px] font-semibold text-blue-700 hover:bg-blue-100"
              >
                <ArrowRightCircle size={11} /> {gate.fixAction.label}
              </button>
            )}
          </div>
        ))}

        <div className="rounded-lg border border-gray-100 bg-gray-50 p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-semibold text-slate-800">접촉 채널 확인</p>
            <span className={cn("rounded px-2 py-0.5 text-[10px] font-semibold", channelTone(channelCardState))}>
              {channelStateLabel(channelCardState)}
            </span>
          </div>
          <p className="mt-1 text-[11px] text-gray-500">전화/문자/보호자 채널 상태를 확인합니다</p>

          <div className="mt-2 space-y-2">
            {channelRows.map((row) => (
              <div key={row.key} className="rounded-md border border-gray-100 bg-white px-2.5 py-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[11px] font-semibold text-slate-700">{row.label}</p>
                  <span className={cn("rounded px-2 py-0.5 text-[10px] font-semibold", channelTone(row.state))}>
                    {channelStateLabel(row.state)}
                  </span>
                </div>
                <p className="mt-1 text-[11px] text-gray-500">{row.detail}</p>
                {row.onAction && row.actionLabel ? (
                  <button
                    onClick={row.onAction}
                    className="mt-1.5 inline-flex items-center gap-1 rounded-md border border-blue-200 bg-blue-50 px-2 py-1 text-[11px] font-semibold text-blue-700 hover:bg-blue-100"
                  >
                    <ArrowRightCircle size={11} /> {row.actionLabel}
                  </button>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      </div>

      <p className="mt-3 text-[11px] text-gray-500">
        운영자가 지금 해야 할 행동: {isStage3Mode ? "기준선/위험리뷰 완료 후 감별경로 단계 진행" : "미확인/제한 채널 조치 후 접촉 실행"}
      </p>
    </section>
  );
}

export function RiskSignalEvidencePanel({
  evidence,
  quality,
  mode = "stage1",
  stage2OpsView = false,
  stage3Type,
}: {
  evidence: Stage1Detail["riskEvidence"];
  quality: CaseHeader["dataQuality"];
  mode?: StageOpsMode;
  stage2OpsView?: boolean;
  stage3Type?: Stage3ViewModel["source"]["profile"]["stage3Type"];
}) {
  const isStage3Mode = mode === "stage3";
  const isStage2OpsMode = isStage3Mode && stage2OpsView;
  const isAdManagement = isStage3Mode && stage3Type === "AD_MANAGEMENT" && !isStage2OpsMode;
  return (
    <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
          <Layers size={15} className="text-slate-500" />
          {isStage2OpsMode ? "진단 진행 근거(운영 참고)" : isStage3Mode ? (isAdManagement ? "위험도 추적 근거(운영 참고)" : "전환 위험 근거(운영 참고)") : "위험 신호 근거"}
        </h3>
        <span className="text-[11px] text-gray-500">산출 시각 {formatDateTime(evidence.computedAt)} · {evidence.version}</span>
      </div>

      <div className="mt-3 space-y-2">
        {evidence.topFactors.slice(0, 3).map((factor) => (
          <div key={factor.title} className="rounded-md border border-gray-100 bg-gray-50 px-3 py-2">
            <div className="flex items-center gap-2">
              <p className="text-xs font-semibold text-slate-900">{factor.title}</p>
              {factor.isMissing && (
                <span className="rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-semibold text-red-700">누락 가능</span>
              )}
            </div>
            <p className="mt-1 text-[11px] text-gray-600">{factor.description}</p>
            <p className="mt-1 text-[10px] text-gray-400">최근성: {formatDateTime(factor.recency)}</p>
          </div>
        ))}
      </div>

      <div className="mt-3 rounded-md border border-gray-100 bg-white px-3 py-2 text-[11px] text-gray-600">
        <p>데이터 최신성: 최근 48시간 내 동기화 기준</p>
        <p title="품질 점수는 누락 필드, 연락처 검증, 최근성 기준의 운영 점수입니다.">품질 점수: {quality.score}% (툴팁 확인 가능)</p>
        <p>누락 필드: {quality.notes?.join(", ") ?? "없음"}</p>
        {isStage2OpsMode ? <p>운영 참고: 진단 예약/의뢰/확정은 담당자·의료진 확인 후 진행합니다.</p> : null}
        {!isStage2OpsMode && isStage3Mode ? <p>운영 참고: 최종 조치는 담당자·의료진 확인 전 기준으로만 활용합니다.</p> : null}
      </div>
    </section>
  );
}

function RiskTrendChart({
  risk,
  stageBadge,
  threshold = 65,
  stage2OpsView = false,
  stage3Type = "PREVENTIVE_TRACKING",
}: {
  risk: Stage3RiskSummary;
  stageBadge?: Stage3DiffPathStatus;
  threshold?: number;
  stage2OpsView?: boolean;
  stage3Type?: "PREVENTIVE_TRACKING" | "AD_MANAGEMENT";
}) {
  const gradientId = useId().replace(/:/g, "");
  const formatAxisLabel = (iso: string, fullYear = false) => {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return iso.slice(5, 10);
    const yy = String(date.getFullYear()).slice(2);
    const yyyy = String(date.getFullYear());
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const dd = String(date.getDate()).padStart(2, "0");
    return fullYear ? `${yyyy}.${mm}.${dd}` : `${yy}.${mm}.${dd}`;
  };
  const mapEventLabel = (event?: Stage3RiskTrendPoint["event"] | "REEVAL") =>
    event === "DIFF_RESULT_APPLIED"
      ? stage2OpsView
        ? "검사결과 수신"
        : "검사결과 반영"
      : event === "PLAN_UPDATED"
        ? stage2OpsView
          ? "분류/플랜 갱신"
          : "플랜 갱신"
        : event === "REEVAL"
          ? stage2OpsView
            ? "진단 진행 검토"
            : "재평가"
          : undefined;

  const histSeries = useMemo(() => {
    const normalized = risk.series
      .map((point) => {
        const parsed = new Date(point.t);
        const date = Number.isNaN(parsed.getTime()) ? new Date(risk.updatedAt) : parsed;
        const safeDate = Number.isNaN(date.getTime()) ? new Date() : date;
        return {
          t: safeDate.toISOString(),
          date: safeDate,
          risk01: clamp01(point.risk2y),
          ciLow01: point.ciLow == null ? undefined : clamp01(point.ciLow),
          ciHigh01: point.ciHigh == null ? undefined : clamp01(point.ciHigh),
          eventLabel: mapEventLabel(point.event ?? (point.source === "manual" ? "REEVAL" : undefined)),
        };
      })
      .sort((a, b) => a.date.getTime() - b.date.getTime());

    if (normalized.length === 0) {
      const fallbackDate = (() => {
        const parsed = new Date(risk.updatedAt);
        return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
      })();
      return [
        {
          t: fallbackDate.toISOString(),
          date: fallbackDate,
          risk01: clamp01(risk.risk2y_now),
          ciLow01: undefined,
          ciHigh01: undefined,
          eventLabel: undefined,
        },
      ];
    }
    return normalized;
  }, [risk.risk2y_now, risk.series, risk.updatedAt]);

  const lastHist = histSeries[histSeries.length - 1];
  const currentRisk01 = clamp01(lastHist?.risk01 ?? risk.risk2y_now);
  const currentRiskPct = toPercentValue(currentRisk01);
  const currentRiskLabel = deriveStage3RiskLabel(currentRisk01);
  const isAdManagement = stage3Type === "AD_MANAGEMENT" && !stage2OpsView;
  const projectionDelta =
    risk.trend === "UP"
      ? 0.14
      : risk.trend === "DOWN"
        ? -0.1
        : risk.trend === "VOLATILE"
          ? 0.08
          : 0.02;
  const riskAt2y01 = clamp01(currentRisk01 + projectionDelta);
  const riskAt2yPct = toPercentValue(riskAt2y01);
  const forecastMonths = isAdManagement ? [] : [12, 24, 36];
  const forecastSeries = forecastMonths.map((month, idx) => {
    const forecastDate = new Date(lastHist.date);
    forecastDate.setMonth(forecastDate.getMonth() + month);
    const ratio = (idx + 1) / forecastMonths.length;
    const risk01 = clamp01(currentRisk01 + (riskAt2y01 - currentRisk01) * ratio);
    return {
      t: forecastDate.toISOString(),
      date: forecastDate,
      riskPct: toPercentValue(risk01),
      axisLabel: formatAxisLabel(forecastDate.toISOString()),
    };
  });

  type RiskChartRow = {
    t: string;
    axisLabel: string;
    pointKind: "HIST" | "FORECAST";
    histRiskPct: number | null;
    forecastRiskPct: number | null;
    areaRiskPct: number | null;
    riskPct: number;
    ciLowPct?: number;
    ciHighPct?: number;
    eventLabel?: string;
  };

  const chartData: RiskChartRow[] = [
    ...histSeries.map((point, idx) => {
      const riskPct = toPercentValue(point.risk01);
      return {
        t: point.t,
        axisLabel: formatAxisLabel(point.t),
        pointKind: "HIST",
        histRiskPct: riskPct,
        forecastRiskPct: forecastSeries.length > 0 && idx === histSeries.length - 1 ? riskPct : null,
        areaRiskPct: riskPct,
        riskPct,
        ciLowPct: point.ciLow01 == null ? undefined : toPercentValue(point.ciLow01),
        ciHighPct: point.ciHigh01 == null ? undefined : toPercentValue(point.ciHigh01),
        eventLabel: point.eventLabel,
      };
    }),
    ...forecastSeries.map((point) => ({
      t: point.t,
      axisLabel: point.axisLabel,
      pointKind: "FORECAST" as const,
      histRiskPct: null,
      forecastRiskPct: point.riskPct,
      areaRiskPct: point.riskPct,
      riskPct: point.riskPct,
      ciLowPct: undefined,
      ciHighPct: undefined,
      eventLabel: undefined,
    })),
  ];
  const axisLabelMap = useMemo(() => {
    const map = new Map<string, string>();
    chartData.forEach((point, index) => {
      const date = new Date(point.t);
      if (Number.isNaN(date.getTime())) {
        map.set(point.t, point.axisLabel);
        return;
      }
      const isEdge = index === 0 || index === chartData.length - 1;
      const prevDate = index > 0 ? new Date(chartData[index - 1].t) : null;
      const yearChanged = prevDate ? prevDate.getFullYear() !== date.getFullYear() : false;
      map.set(point.t, formatAxisLabel(point.t, isEdge || yearChanged));
    });
    return map;
  }, [chartData]);

  const hasInterval = chartData.some((point) => point.ciLowPct != null && point.ciHighPct != null);
  const eventPoints = chartData.filter((point) => point.pointKind === "HIST" && Boolean(point.eventLabel)).slice(-3);
  const highPoints = chartData.filter((point) => point.riskPct >= threshold);
  const latestHighPoint = highPoints[highPoints.length - 1];
  const forecastEndPoint = forecastSeries.length > 0 ? chartData[chartData.length - 1] : undefined;
  const areaTone = currentRiskPct >= threshold
    ? { top: "#ef4444", bottom: "#ef4444" }
    : { top: "#2563eb", bottom: "#2563eb" };
  const recentTrendSummary = (() => {
    if (histSeries.length < 4) return "최근 구간 데이터가 적어 추세 해석은 제한적입니다.";
    const recent = histSeries.slice(-4).map((point) => toPercentValue(point.risk01));
    const deltas = recent.slice(1).map((point, idx) => point - recent[idx]);
    const rising = deltas.filter((delta) => delta > 0).length;
    const falling = deltas.filter((delta) => delta < 0).length;
    const maxSwing = Math.max(...deltas.map((delta) => Math.abs(delta)));
    if (maxSwing >= 10) return stage2OpsView ? "최근 3구간 변동이 큽니다. 결과 수신/재요청 상태를 재점검해 주세요." : "최근 3구간 변동이 큽니다. 감별검사/재평가 결과 확인 후 재점검이 필요합니다.";
    if (rising >= 2) return "최근 3구간 중 상승 구간이 우세합니다.";
    if (falling >= 2) return "최근 3구간 중 하락 구간이 우세합니다.";
    return "최근 구간은 큰 급변 없이 유지됩니다.";
  })();
  const stageBadgeLabel =
    stageBadge === "COMPLETED"
      ? stage2OpsView
        ? "현재 단계: 결과 수신 완료"
        : isAdManagement
          ? "현재 단계: AD 관리 지표 반영 완료"
          : "현재 단계: 검사결과 반영 완료"
      : stageBadge === "SCHEDULED"
        ? stage2OpsView
          ? "현재 단계: 진단 예약됨"
          : isAdManagement
            ? "현재 단계: 관리 일정 예약됨"
            : "현재 단계: 감별검사 예약됨"
        : stageBadge === "REFERRED"
          ? stage2OpsView
            ? "현재 단계: 의뢰 진행중"
            : "현재 단계: 의뢰 진행중"
          : stageBadge === "RECOMMENDED"
            ? stage2OpsView
              ? "현재 단계: 의뢰/예약 대기"
              : "현재 단계: 권고 생성"
            : stage2OpsView
              ? "현재 단계: 결과 수신 대기"
              : isAdManagement
                ? "현재 단계: 관리 지표 대기"
                : "현재 단계: 검사결과 대기";

  const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: Array<{ payload: RiskChartRow }> }) => {
    if (!active || !payload || payload.length === 0) return null;
    const point = payload[0]?.payload;
    if (!point) return null;
    return (
      <div className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-[10px] shadow-sm">
        <p className="font-semibold text-slate-800">{formatDateTime(point.t)} · {point.pointKind === "FORECAST" ? "미래 예측(+3y)" : "관측/추정"}</p>
        <p className="mt-0.5 text-slate-700">
          {stage2OpsView ? "진단 진행/지연 지표" : isAdManagement ? "위험도 추적 지표(운영 참고)" : "전환위험(운영 참고)"} {point.riskPct}%
        </p>
        {point.ciLowPct != null && point.ciHighPct != null ? (
          <p className="text-slate-500">구간 {point.ciLowPct}% ~ {point.ciHighPct}%</p>
        ) : null}
        {point.eventLabel ? <p className="text-slate-500">이벤트 {point.eventLabel}</p> : null}
        {point.riskPct >= threshold ? (
          <p className="text-red-600">{stage2OpsView ? `${threshold}% 지연 임계 초과` : `${threshold}% 초과 포인트`}</p>
        ) : null}
      </div>
    );
  };

  return (
    <div className="rounded-lg border border-slate-100 bg-slate-50 px-2.5 py-2.5">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="rounded-full border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-[10px] font-semibold text-indigo-700">
          {stage2OpsView ? "현재 진행/지연" : isAdManagement ? "현재 위험지수" : "현재 위험"} {currentRiskPct}% ({currentRiskLabel})
        </span>
        <span className="rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-[10px] font-semibold text-sky-700">
          {isAdManagement ? "최근 추세" : stage2OpsView ? "목표일 예측" : "3년 후 예측"} {isAdManagement ? risk.trend : `${riskAt2yPct}%`}
        </span>
        <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-semibold text-slate-700">
          추세 {risk.trend}
        </span>
      </div>

      <div className="mt-2 grid grid-cols-1 gap-2.5 xl:grid-cols-[1fr_220px]">
        <div className="h-56 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 8, right: 24, left: 0, bottom: 6 }}>
              <defs>
                <linearGradient id={`risk-grad-${gradientId}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={areaTone.top} stopOpacity={0.3} />
                  <stop offset="100%" stopColor={areaTone.bottom} stopOpacity={0.04} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="#e5e7eb" strokeDasharray="4 4" />
              <XAxis
                dataKey="t"
                tick={{ fontSize: 10, fill: "#64748b" }}
                axisLine={false}
                tickLine={false}
                interval="preserveStartEnd"
                minTickGap={16}
                tickMargin={8}
                tickFormatter={(value: string) => axisLabelMap.get(value) ?? formatAxisLabel(value, true)}
              />
              <YAxis
                domain={[0, 100]}
                ticks={[0, 25, 50, 75, 100]}
                tickFormatter={(value) => `${value}%`}
                tick={{ fontSize: 10, fill: "#64748b" }}
                axisLine={false}
                tickLine={false}
                width={34}
              />
              <Tooltip content={<CustomTooltip />} />
              <ReferenceLine y={threshold} stroke="#dc2626" strokeDasharray="4 3" />
              {eventPoints.map((point, index) => (
                <ReferenceLine
                  key={`event-${point.t}-${index}`}
                  x={point.t}
                  stroke="#94a3b8"
                  strokeDasharray="3 3"
                />
              ))}
              {hasInterval ? (
                <Line
                  type="monotone"
                  dataKey="ciLowPct"
                  stroke="#94a3b8"
                  strokeDasharray="4 4"
                  strokeWidth={1}
                  dot={false}
                  isAnimationActive={false}
                />
              ) : null}
              {hasInterval ? (
                <Line
                  type="monotone"
                  dataKey="ciHighPct"
                  stroke="#94a3b8"
                  strokeDasharray="4 4"
                  strokeWidth={1}
                  dot={false}
                  isAnimationActive={false}
                />
              ) : null}
              <Area
                type="monotone"
                dataKey="areaRiskPct"
                stroke="none"
                fill={`url(#risk-grad-${gradientId})`}
                isAnimationActive={false}
              />
              <Line
                type="monotone"
                dataKey="histRiskPct"
                stroke="#334155"
                strokeWidth={2.2}
                isAnimationActive={false}
                dot={(props: { cx?: number; cy?: number; payload?: RiskChartRow }) => {
                  if (props.cx == null || props.cy == null || !props.payload || props.payload.histRiskPct == null) return null;
                  const isHigh = props.payload.riskPct >= threshold;
                  return (
                    <circle
                      cx={props.cx}
                      cy={props.cy}
                      r={isHigh ? 4 : 3}
                      fill={isHigh ? "#dc2626" : "#334155"}
                      stroke="#ffffff"
                      strokeWidth={1.2}
                    />
                  );
                }}
                activeDot={{ r: 5 }}
              />
              {forecastSeries.length > 0 ? (
                <Line
                  type="monotone"
                  dataKey="forecastRiskPct"
                  stroke="#2563eb"
                  strokeDasharray="6 4"
                  strokeWidth={2}
                  connectNulls={false}
                  isAnimationActive={false}
                  dot={(props: { cx?: number; cy?: number; payload?: RiskChartRow }) => {
                    if (props.cx == null || props.cy == null || !props.payload || props.payload.forecastRiskPct == null) return null;
                    const isHigh = props.payload.riskPct >= threshold;
                    return (
                      <circle
                        cx={props.cx}
                        cy={props.cy}
                        r={isHigh ? 4 : 3}
                        fill={isHigh ? "#dc2626" : "#2563eb"}
                        stroke="#ffffff"
                        strokeWidth={1.1}
                      />
                    );
                  }}
                />
              ) : null}
              {forecastSeries.length > 0 && forecastEndPoint ? (
                <ReferenceDot
                  x={forecastEndPoint.t}
                  y={forecastEndPoint.riskPct}
                  r={5}
                  fill={forecastEndPoint.riskPct >= threshold ? "#dc2626" : "#2563eb"}
                  stroke="#fff"
                  strokeWidth={1.4}
                  label={{ value: `+3y ${forecastEndPoint.riskPct}%`, position: "top", fill: "#1e293b", fontSize: 10 }}
                />
              ) : null}
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="space-y-2 rounded-md border border-slate-200 bg-white p-2">
          <p className="text-[10px] font-semibold text-slate-700">{stageBadgeLabel}</p>
          <p className="text-[10px] text-slate-500">
            업데이트 {formatDateTime(risk.updatedAt)} · 모델 {risk.modelVersion}
          </p>
          {latestHighPoint ? (
            <div className="rounded border border-red-200 bg-red-50 px-2 py-1 text-[10px] text-red-700">
              <p className="font-semibold">{threshold}% 초과 시점</p>
              <p>{latestHighPoint.axisLabel} · {latestHighPoint.riskPct}% (운영 참고)</p>
            </div>
          ) : (
            <div className="rounded border border-emerald-200 bg-emerald-50 px-2 py-1 text-[10px] text-emerald-700">
              <p className="font-semibold">{threshold}% 초과 포인트 없음</p>
              <p>현재 구간은 임계치 미만입니다.</p>
            </div>
          )}
          <div className="space-y-1">
            <p className="text-[10px] font-semibold text-slate-700">핵심 이벤트</p>
            {eventPoints.length ? (
              eventPoints.map((point) => (
                <p key={`${point.t}-${point.eventLabel}`} className="text-[10px] text-slate-600">
                  {point.axisLabel} · {point.eventLabel}
                </p>
              ))
            ) : (
              <p className="text-[10px] text-slate-500">최근 이벤트 없음</p>
            )}
          </div>
        </div>
      </div>

      <p className="mt-1 text-[10px] text-slate-500">{recentTrendSummary}</p>
      <p className="mt-0.5 text-[10px] text-slate-500">
        {stage2OpsView
          ? "운영 참고: 지표는 진단 예약/의뢰/확정 우선순위 판단에 활용합니다."
          : "운영 참고: 확률 추정치는 담당자 확인 후 실행 우선순위 결정에 활용합니다."}
      </p>
    </div>
  );
}

const STAGE2_STEP2_READY_STATUSES = new Set<Stage2PlanItemStatus>([
  "REFERRED",
  "SCHEDULED",
  "DONE",
  "RECEIVED",
  "EXCEPTION",
]);

function planItemStatusLabel(status: Stage2PlanItemStatus) {
  if (status === "PENDING") return "대기";
  if (status === "REFERRED") return "의뢰됨";
  if (status === "SCHEDULED") return "예약확정";
  if (status === "DONE") return "수행완료";
  if (status === "RECEIVED") return "결과수신";
  if (status === "NEEDS_REVIEW") return "검증필요";
  if (status === "MISSING") return "누락";
  return "예외(수기)";
}

function planItemRequiredLevelLabel(requiredLevel: Stage2PlanItemRequiredLevel) {
  if (requiredLevel === "REQUIRED") return "필수";
  if (requiredLevel === "RECOMMENDED") return "권고";
  return "선택";
}

function planItemSourceLabel(source: Stage2PlanItemSource) {
  if (source === "AUTO") return "AUTO(병원)";
  if (source === "MANUAL") return "MANUAL(센터)";
  if (source === "OVERRIDE") return "OVERRIDE";
  return "출처 미지정";
}

function planItemStatusClass(status: Stage2PlanItemStatus) {
  if (status === "MISSING" || status === "NEEDS_REVIEW") return "border-rose-200 bg-rose-50 text-rose-700";
  if (status === "DONE" || status === "RECEIVED") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "REFERRED" || status === "SCHEDULED") return "border-amber-200 bg-amber-50 text-amber-700";
  if (status === "EXCEPTION") return "border-violet-200 bg-violet-50 text-violet-700";
  return "border-slate-200 bg-slate-100 text-slate-700";
}

function planSummaryStatusLabel(status: Stage2PlanStatus) {
  if (status === "PAUSED") return "PAUSED";
  if (status === "IN_PROGRESS") return "IN_PROGRESS";
  if (status === "READY") return "READY";
  return "BLOCKED";
}

function planSummaryStatusClass(status: Stage2PlanStatus) {
  if (status === "READY") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "IN_PROGRESS") return "border-blue-200 bg-blue-50 text-blue-700";
  if (status === "BLOCKED") return "border-rose-200 bg-rose-50 text-rose-700";
  return "border-slate-200 bg-slate-100 text-slate-700";
}

function renderPlanItemTerm(item: Stage2PlanItem) {
  if (item.id === "MMSE") return <GlossaryTooltip term="MMSE" className="text-[11px] font-semibold text-slate-900" />;
  if (item.id === "CDR_GDS") {
    return (
      <span className="text-[11px] font-semibold text-slate-900">
        <GlossaryTooltip term="CDR" /> 또는 <GlossaryTooltip term="GDS" />
      </span>
    );
  }
  if (item.id === "NEURO") return <span className="text-[11px] font-semibold text-slate-900">신경인지검사</span>;
  if (item.id === "SPECIALIST") return <span className="text-[11px] font-semibold text-slate-900">전문의 진찰</span>;
  if (item.id === "GDS_K") return <GlossaryTooltip term="GDS-K" className="text-[11px] font-semibold text-slate-900" />;
  if (item.id === "ADL") return <GlossaryTooltip term="ADL" className="text-[11px] font-semibold text-slate-900" />;
  return <GlossaryTooltip term="BPSD" className="text-[11px] font-semibold text-slate-900" />;
}

function scrollToFirstErrorCard(
  itemIds: Stage2PlanItemId[],
  refs: React.MutableRefObject<Partial<Record<Stage2PlanItemId, HTMLDivElement | null>>>,
) {
  const firstId = itemIds[0];
  if (!firstId) return;
  const target = refs.current[firstId];
  if (!target) return;
  target.scrollIntoView({ behavior: "smooth", block: "center" });
  if ("focus" in target && typeof target.focus === "function") {
    target.focus();
  }
}

function usePlanItems({
  routeType,
  hospitalName,
  dueAt,
  tests,
  optionalTests,
  integrationReceivedAt,
  integrationUpdatedAt,
  manualEditEnabled,
}: {
  routeType: Stage2PlanRoute;
  hospitalName: string;
  dueAt: string;
  tests: Stage2Diagnosis["tests"];
  optionalTests: { gdsk: boolean; adl: boolean; bpsd: boolean };
  integrationReceivedAt?: string;
  integrationUpdatedAt?: string;
  manualEditEnabled: boolean;
}) {
  return useMemo<Stage2PlanItem[]>(() => {
    const resolvedDueAt = dueAt || "2026-02-20T09:00:00";
    const resolvedUpdatedAt = integrationUpdatedAt || integrationReceivedAt;
    const defaultSource: Stage2PlanItemSource = manualEditEnabled ? "OVERRIDE" : routeType === "HOSPITAL_REFERRAL" ? "AUTO" : "MANUAL";
    const hasMmse = typeof tests.mmse === "number" && Number.isFinite(tests.mmse);
    const hasCdrOrGds = typeof tests.cdr === "number" && Number.isFinite(tests.cdr);
    const hasNeuro = Boolean(tests.neuroCognitiveType);
    const hasSpecialist = Boolean(tests.specialist);

    const buildActions = (status: Stage2PlanItemStatus): Stage2PlanItemAction[] => {
      if (status === "MISSING") {
        return [
          { key: "OPEN_PIPELINE", label: "결과 입력 열기", enabled: true, intent: "danger" },
          { key: "REQUEST_RESULT", label: "결과 재요청", enabled: true, intent: "warning" },
          { key: "MANUAL_EXCEPTION", label: "수기 입력(예외)", enabled: true, intent: "default" },
        ];
      }
      if (status === "NEEDS_REVIEW") {
        return [
          { key: "VIEW_RESULT", label: "결과 보기", enabled: true, intent: "default" },
          { key: "MARK_REVIEWED", label: "검증 완료", enabled: true, intent: "success" },
        ];
      }
      if (status === "REFERRED" || status === "SCHEDULED") {
        return [
          { key: "OPEN_PIPELINE", label: "의뢰/예약 확인", enabled: true, intent: "default" },
          { key: "REQUEST_RESULT", label: "결과 재요청", enabled: true, intent: "warning" },
        ];
      }
      if (status === "DONE" || status === "RECEIVED" || status === "EXCEPTION") {
        return [
          { key: "VIEW_RESULT", label: "결과 보기", enabled: true, intent: "default" },
          { key: "MARK_REVIEWED", label: "검증 완료", enabled: true, intent: "success" },
        ];
      }
      return [{ key: "OPEN_PIPELINE", label: "작업 열기", enabled: true, intent: "default" }];
    };

    const items: Stage2PlanItem[] = [
      {
        id: "MMSE",
        label: "MMSE",
        fullName: "인지기능 선별검사",
        description: "인지기능 선별검사 점수 수신 상태를 관리합니다.",
        requiredLevel: routeType === "HOSPITAL_REFERRAL" ? "REQUIRED" : "RECOMMENDED",
        status: hasMmse ? "RECEIVED" : routeType === "HOSPITAL_REFERRAL" ? "REFERRED" : "PENDING",
        source: defaultSource,
        orgName: hospitalName,
        dueAt: resolvedDueAt,
        updatedAt: resolvedUpdatedAt,
        actions: [],
      },
      {
        id: "CDR_GDS",
        label: "CDR 또는 GDS",
        fullName: "치매 임상척도",
        description: "CDR 또는 GDS 점수 중 최소 1개 수신이 필요합니다.",
        requiredLevel: "REQUIRED",
        status: hasCdrOrGds ? "RECEIVED" : "MISSING",
        source: defaultSource,
        orgName: hospitalName,
        dueAt: resolvedDueAt,
        updatedAt: resolvedUpdatedAt,
        missingReason: hasCdrOrGds ? undefined : "임상척도 점수 미수신",
        actions: [],
      },
      {
        id: "NEURO",
        label: "신경인지검사",
        fullName: "CERAD-K / SNSB-II / SNSB-C / LICA",
        description: "선택한 신경인지검사 결과를 수신/검증합니다.",
        requiredLevel: "REQUIRED",
        status: hasNeuro ? "RECEIVED" : "PENDING",
        source: defaultSource,
        orgName: hospitalName,
        dueAt: resolvedDueAt,
        updatedAt: resolvedUpdatedAt,
        actions: [],
      },
      {
        id: "SPECIALIST",
        label: "전문의 진찰",
        fullName: "전문의 소견/진찰 기록",
        description: "전문의 소견 여부와 기록 연결 상태를 관리합니다.",
        requiredLevel: "REQUIRED",
        status: hasSpecialist ? "DONE" : routeType === "HOSPITAL_REFERRAL" ? "REFERRED" : "PENDING",
        source: defaultSource,
        orgName: hospitalName,
        dueAt: resolvedDueAt,
        updatedAt: resolvedUpdatedAt,
        actions: [],
      },
      {
        id: "GDS_K",
        label: "GDS-K",
        fullName: "노인우울척도(한국판)",
        description: "고령자에서 우울 증상 여부와 정도를 선별하기 위한 자가보고식 설문 도구입니다.",
        requiredLevel: "OPTIONAL",
        status: optionalTests.gdsk ? "SCHEDULED" : "PENDING",
        source: optionalTests.gdsk ? "MANUAL" : null,
        orgName: hospitalName,
        dueAt: resolvedDueAt,
        updatedAt: resolvedUpdatedAt,
        actions: [],
      },
      {
        id: "ADL",
        label: "ADL",
        fullName: "일상생활 수행능력",
        description: "기능 저하 여부를 평가하는 보조 지표입니다.",
        requiredLevel: "OPTIONAL",
        status: optionalTests.adl ? "SCHEDULED" : "PENDING",
        source: optionalTests.adl ? "MANUAL" : null,
        orgName: hospitalName,
        dueAt: resolvedDueAt,
        updatedAt: resolvedUpdatedAt,
        actions: [],
      },
      {
        id: "BPSD",
        label: "BPSD",
        fullName: "행동·심리 증상",
        description: "행동·심리 증상 관련 보조 평가 항목입니다.",
        requiredLevel: "OPTIONAL",
        status: optionalTests.bpsd ? "SCHEDULED" : "PENDING",
        source: optionalTests.bpsd ? "MANUAL" : null,
        orgName: hospitalName,
        dueAt: resolvedDueAt,
        updatedAt: resolvedUpdatedAt,
        actions: [],
      },
    ];

    return items.map((item) => ({
      ...item,
      actions: buildActions(item.status),
    }));
  }, [dueAt, hospitalName, integrationReceivedAt, integrationUpdatedAt, manualEditEnabled, optionalTests.adl, optionalTests.bpsd, optionalTests.gdsk, routeType, tests.cdr, tests.mmse, tests.neuroCognitiveType, tests.specialist]);
}

function Stage2Step1PlanSummaryBar({
  summary,
  route,
  onOpenMissing,
  onPrimaryAction,
  onReviewComplete,
}: {
  summary: Stage2PlanSummary;
  route: Stage2PlanRouteState;
  onOpenMissing: () => void;
  onPrimaryAction: () => void;
  onReviewComplete: () => void;
}) {
  const routeLabel = route.routeType === "HOSPITAL_REFERRAL" ? "협력병원 의뢰" : "센터 직접 수행";
  return (
    <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-3">
      <div className="grid grid-cols-2 gap-2 md:grid-cols-6">
        <div className="rounded-md border border-indigo-100 bg-white px-2 py-1.5">
          <p className="text-[10px] text-slate-500">플랜 상태</p>
          <p className={cn("mt-1 inline-flex rounded border px-1.5 py-0.5 text-[10px] font-semibold", planSummaryStatusClass(summary.status))}>
            {planSummaryStatusLabel(summary.status)}
          </p>
        </div>
        <div className="rounded-md border border-indigo-100 bg-white px-2 py-1.5">
          <p className="text-[10px] text-slate-500">연계 경로</p>
          <p className="mt-1 text-[11px] font-semibold text-slate-900">{routeLabel}</p>
        </div>
        <div className="rounded-md border border-indigo-100 bg-white px-2 py-1.5">
          <p className="text-[10px] text-slate-500">목표일</p>
          <p className="mt-1 text-[11px] font-semibold text-slate-900">{formatDateTime(route.dueAt)}</p>
        </div>
        <div className="rounded-md border border-indigo-100 bg-white px-2 py-1.5">
          <p className="text-[10px] text-slate-500">최근 동기화</p>
          <p className="mt-1 text-[11px] font-semibold text-slate-900">{formatDateTime(route.lastSyncAt)}</p>
        </div>
        <div className="rounded-md border border-indigo-100 bg-white px-2 py-1.5">
          <p className="text-[10px] text-slate-500">필수자료 충족도</p>
          <p className="mt-1 text-[11px] font-semibold text-slate-900">{summary.requiredSatisfaction}%</p>
        </div>
        <div className="rounded-md border border-indigo-100 bg-white px-2 py-1.5">
          <button
            type="button"
            onClick={onOpenMissing}
            className={cn(
              "inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-semibold",
              summary.missingCount > 0
                ? "border-rose-200 bg-rose-50 text-rose-700"
                : "border-emerald-200 bg-emerald-50 text-emerald-700",
            )}
          >
            <AlertTriangle size={12} />
            누락 {summary.missingCount}건
          </button>
          <p className="mt-1 text-[10px] text-slate-500">품질 {summary.qualityScore}%</p>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
        <button
          type="button"
          onClick={onPrimaryAction}
          className="rounded-md border border-indigo-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-indigo-700"
        >
          {route.routeType === "HOSPITAL_REFERRAL" ? "의뢰 생성/재전송" : "센터 일정 생성"}
        </button>
        <button
          type="button"
          onClick={onReviewComplete}
          className="rounded-md bg-[#163b6f] px-3 py-1.5 text-[11px] font-semibold text-white"
        >
          검토 완료
        </button>
      </div>
    </div>
  );
}

function PlanRouteCards({
  routeType,
  orgName,
  dueAt,
  needsReasonOnChange,
  onSelectRoute,
}: {
  routeType: Stage2PlanRoute;
  orgName?: string;
  dueAt?: string;
  needsReasonOnChange?: boolean;
  onSelectRoute: (route: Stage2PlanRoute) => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
      <button
        type="button"
        onClick={() => onSelectRoute("HOSPITAL_REFERRAL")}
        className={cn(
          "rounded-md border px-3 py-2 text-left",
          routeType === "HOSPITAL_REFERRAL" ? "border-indigo-300 bg-indigo-50 text-indigo-800" : "border-slate-200 bg-white text-slate-700",
        )}
      >
        <p className="text-xs font-semibold"><GlossaryTooltip term="협약병원 의뢰" /></p>
        <p className="mt-1 text-[10px]">기관: {orgName || "-"}</p>
        <p className="text-[10px]">목표일: {formatDateTime(dueAt)}</p>
      </button>
      <button
        type="button"
        onClick={() => onSelectRoute("CENTER_DIRECT")}
        className={cn(
          "rounded-md border px-3 py-2 text-left",
          routeType === "CENTER_DIRECT" ? "border-indigo-300 bg-indigo-50 text-indigo-800" : "border-slate-200 bg-white text-slate-700",
        )}
      >
        <p className="text-xs font-semibold"><GlossaryTooltip term="센터 직접 수행" /></p>
        <p className="mt-1 text-[10px]">센터 내부 일정/담당 배정 중심</p>
        {needsReasonOnChange ? <p className="text-[10px] text-amber-700">기존 의뢰 이력이 있어 경로 변경 시 사유가 필요합니다.</p> : null}
      </button>
    </div>
  );
}

function PlanItemCard({
  item,
  onAction,
  registerRef,
}: {
  item: Stage2PlanItem;
  onAction: (item: Stage2PlanItem, action: Stage2PlanItemAction) => void;
  registerRef?: (id: Stage2PlanItemId) => (el: HTMLDivElement | null) => void;
}) {
  const isError = item.status === "MISSING" || item.status === "NEEDS_REVIEW";
  return (
    <div
      ref={registerRef?.(item.id)}
      tabIndex={-1}
      className={cn(
        "rounded-md border bg-white p-3 outline-none",
        isError ? "border-rose-300 bg-rose-50/40" : "border-slate-200",
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          {renderPlanItemTerm(item)}
          <p className="mt-0.5 text-[10px] text-slate-500">{item.fullName}</p>
        </div>
        <div className="flex flex-wrap items-center gap-1">
          <span className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-semibold text-slate-700">
            {planItemRequiredLevelLabel(item.requiredLevel)}
          </span>
          <span className={cn("rounded border px-1.5 py-0.5 text-[10px] font-semibold", planItemStatusClass(item.status))}>
            {planItemStatusLabel(item.status)}
          </span>
        </div>
      </div>
      <p className="mt-1 text-[10px] text-slate-600">{item.description}</p>
      <div className="mt-2 grid grid-cols-2 gap-2 text-[10px] text-slate-600">
        <p>출처: {planItemSourceLabel(item.source)}</p>
        <p>기관: {item.orgName || "-"}</p>
        <p>목표일: {formatDateTime(item.dueAt)}</p>
        <p>업데이트: {formatDateTime(item.updatedAt)}</p>
      </div>
      {item.missingReason ? <p className="mt-1 rounded border border-rose-200 bg-rose-50 px-2 py-1 text-[10px] font-semibold text-rose-700">{item.missingReason}</p> : null}
      <div className="mt-2 flex flex-wrap gap-1">
        {item.actions.map((action) => (
          <button
            key={action.key}
            type="button"
            disabled={!action.enabled}
            onClick={() => onAction(item, action)}
            className={cn(
              "rounded border px-1.5 py-1 text-[10px] font-semibold",
              action.intent === "danger"
                ? "border-rose-200 bg-rose-50 text-rose-700"
                : action.intent === "warning"
                  ? "border-amber-200 bg-amber-50 text-amber-700"
                  : action.intent === "success"
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                    : "border-slate-200 bg-slate-50 text-slate-700",
              action.enabled ? "" : "cursor-not-allowed opacity-50",
            )}
          >
            {action.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function PlanItemCardList({
  items,
  onAction,
  registerRef,
}: {
  items: Stage2PlanItem[];
  onAction: (item: Stage2PlanItem, action: Stage2PlanItemAction) => void;
  registerRef?: (id: Stage2PlanItemId) => (el: HTMLDivElement | null) => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
      {items.map((item) => (
        <PlanItemCard key={item.id} item={item} onAction={onAction} registerRef={registerRef} />
      ))}
    </div>
  );
}

const STAGE2_TASK_CHECKLIST: Record<Stage1FlowCardId, string[]> = {
  PRECHECK: [
    "Stage1 선별 결과와 Stage2 진입 근거 확인",
    "필수 검사 항목(전문의/MMSE/CDR·GDS/신경인지) 수행 계획 확정",
    "수행 경로(협약병원 의뢰/센터 직접 수행) 선택",
    "기관/담당자/목표일 설정",
  ],
  CONTACT_EXECUTION: [
    "MMSE 점수 입력",
    "CDR 또는 GDS 점수 입력",
    "신경인지검사 유형/결과 입력",
    "전문의 진찰/소견 완료 여부 확인",
  ],
  RESPONSE_HANDLING: [
    "분류 결과(정상/MCI/치매) 선택",
    "모델 분류 확률 확인(운영 참고)",
    "MCI일 때 세분화(양호/중간/위험) 확인",
    "담당자 확인 후 분류 확정",
  ],
  FOLLOW_UP: [
    "정상/MCI/치매에 맞는 다음 단계 1개 선택",
    "안내 실행(전화/문자) 및 캘린더 등록 여부 확인",
    "다음 단계 결정 이벤트 기록",
  ],
};

const STAGE2_TERM_GLOSSARY: Record<string, string> = {
  "MMSE": "인지기능 선별검사(기억/지남력 등) 점수입니다.",
  "CDR": "치매 중증도 평가 척도입니다.",
  "GDS": "약어 정의 확인 필요: 업무정의서 기준으로 CDR 대체 척도로 사용 중인지 확인이 필요합니다.",
  "GDS-K": "고령자에서 우울 증상 여부와 정도를 선별하기 위한 자가보고식 설문 도구입니다.",
  "ADL": "일상생활 수행능력(식사/옷입기/이동 등) 평가입니다.",
  "BPSD": "치매 관련 행동·심리 증상(불안/초조/환각 등) 평가입니다.",
  "MCI": "경도인지장애 분류입니다.",
  "AD": "알츠하이머형 치매 관련 분류 항목입니다.",
  "ANN": "모델(인공신경망) 기반 세분화 결과(운영 참고)입니다.",
  "협약병원 의뢰": "협력 병원에 검사 경로를 의뢰하고 결과를 수신하는 운영 경로입니다.",
  "센터 직접 수행": "센터 내부 일정으로 검사/평가를 직접 수행하는 운영 경로입니다.",
};

function GlossaryTooltip({
  term,
  className,
}: {
  term: string;
  className?: string;
}) {
  return <TermWithTooltip term={term} className={className} />;
}

function TermWithTooltip({
  term,
  className,
}: {
  term: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const tooltipId = useId();
  const wrapperRef = useRef<HTMLSpanElement | null>(null);
  const description = STAGE2_TERM_GLOSSARY[term];

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (!wrapperRef.current?.contains(target)) {
        setOpen(false);
      }
    };
    window.addEventListener("pointerdown", onPointerDown);
    return () => window.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  if (!description) {
    return <span className={className}>{term}</span>;
  }

  return (
    <span ref={wrapperRef} className={cn("relative inline-flex items-center", className)}>
      <button
        type="button"
        className="inline-flex items-center gap-1 rounded px-0.5 text-inherit underline decoration-dotted underline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-300"
        aria-describedby={open ? tooltipId : undefined}
        aria-expanded={open}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={(event) => {
          const next = event.relatedTarget as Node | null;
          if (!wrapperRef.current?.contains(next)) setOpen(false);
        }}
        onClick={() => setOpen((prev) => !prev)}
      >
        {term}
        <AlertCircle size={12} className="text-slate-400" />
      </button>
      {open ? (
        <span
          id={tooltipId}
          role="tooltip"
          className="absolute left-0 top-[calc(100%+6px)] z-40 w-64 rounded-md border border-slate-200 bg-white px-2 py-1.5 text-[10px] font-medium text-slate-600 shadow-lg"
        >
          {description}
        </span>
      ) : null}
    </span>
  );
}

function StepChecklist({ items }: { items: string[] }) {
  return (
    <div className="rounded-md border border-indigo-200 bg-indigo-50 p-3">
      <p className="text-xs font-semibold text-indigo-900">해야 할 작업</p>
      <ul className="mt-1 space-y-1 text-[11px] text-indigo-800">
        {items.map((item) => (
          <li key={item}>• {item}</li>
        ))}
      </ul>
    </div>
  );
}

export function Stage1ScorePanel({
  scoreSummary,
  modelPriorityValue,
  modelPriorityMeta,
  contactPriority,
  interventionLevel,
  stage3Risk,
  stage3DiffPathStatus,
  stage3RiskReviewedAt,
  onStage3MarkRiskReviewed,
  mode = "stage1",
  stage2OpsView = false,
  stage2ResultLabel,
  stage2MciStage,
  stage2Probs,
  stage2DiagnosisStatus,
  stage2CompletionPct,
  stage2RequiredDataPct,
  stage2NextDiagnosisAt,
  stage2QualityScore,
  stage2WaitingCount,
  stage2ResultMissingCount,
  stage2ClassificationConfirmed,
  stage2ModelAvailable = false,
  stage3ModelAvailable = false,
  stage3Type,
  stage2MissingEvidence = [],
  stage3MissingEvidence = [],
  onOpenStage2Input,
  onOpenStage3Input,
}: {
  scoreSummary: Stage1Detail["scoreSummary"];
  modelPriorityValue: number;
  modelPriorityMeta: { label: string; tone: string; bar: string; guide: string };
  contactPriority: { label: string; tone: string };
  interventionLevel: InterventionLevel;
  stage3Risk?: Stage3RiskSummary;
  stage3DiffPathStatus?: Stage3DiffPathStatus;
  stage3RiskReviewedAt?: string;
  onStage3MarkRiskReviewed?: () => void;
  mode?: StageOpsMode;
  stage2OpsView?: boolean;
  stage2ResultLabel?: Stage2ClassLabel;
  stage2MciStage?: Stage2MciStageLabel;
  stage2Probs?: NonNullable<NonNullable<Stage2Diagnosis["classification"]>["probs"]>;
  stage2DiagnosisStatus?: Stage2Diagnosis["status"];
  stage2CompletionPct?: number;
  stage2RequiredDataPct?: number;
  stage2NextDiagnosisAt?: string;
  stage2QualityScore?: number;
  stage2WaitingCount?: number;
  stage2ResultMissingCount?: number;
  stage2ClassificationConfirmed?: boolean;
  stage2ModelAvailable?: boolean;
  stage3ModelAvailable?: boolean;
  stage3Type?: Stage3ViewModel["source"]["profile"]["stage3Type"];
  stage2MissingEvidence?: string[];
  stage3MissingEvidence?: string[];
  onOpenStage2Input?: () => void;
  onOpenStage3Input?: () => void;
}) {
  const isStage2Mode = mode === "stage2";
  const isStage3Mode = mode === "stage3";
  const isStage2OpsMode = isStage3Mode && stage2OpsView;
  const isAdManagement = isStage3Mode && stage3Type === "AD_MANAGEMENT" && !isStage2OpsMode;
  const stage2MciScore = stage2MciStage === "위험" ? 82 : stage2MciStage === "양호" ? 34 : 58;
  const clampedPriority = Math.max(0, Math.min(100, modelPriorityValue));
  const topPercent = Math.max(1, 100 - clampedPriority);
  const activeBand =
    clampedPriority >= 85
      ? "긴급"
      : clampedPriority >= 65
        ? "우선"
        : clampedPriority >= 45
          ? "일반"
          : "관찰";
  const scoreTone =
    activeBand === "긴급"
      ? "text-red-600"
      : activeBand === "우선"
        ? "text-orange-600"
        : activeBand === "일반"
          ? "text-blue-600"
          : "text-emerald-600";
  const stepCards = [
    { key: "관찰", range: "0-44", tone: "border-emerald-300 bg-emerald-50 text-emerald-700", dot: "bg-emerald-500", guide: "기록/모니터링" },
    { key: "일반", range: "45-64", tone: "border-blue-300 bg-blue-50 text-blue-700", dot: "bg-blue-500", guide: "정규 순서 처리" },
    { key: "우선", range: "65-84", tone: "border-orange-300 bg-orange-50 text-orange-700", dot: "bg-orange-500", guide: "당일 우선 처리" },
    { key: "긴급", range: "85-100", tone: "border-red-300 bg-red-50 text-red-700", dot: "bg-red-500", guide: "24시간 내 실행" },
  ] as const;

  if (isStage3Mode && stage3Risk) {
    if (isStage2OpsMode) {
      const topStripItems = [
        {
          label: "분류 결과",
          value: stage2ModelAvailable
            ? stage2ResultLabel === "MCI"
              ? `${stage2ResultLabel}(${stage2MciStageDisplayLabel(stage2MciStage)})`
              : stage2ResultLabel ?? "미확정"
            : "결과대기",
          hint: "모델 분류 결과(운영 참고)",
        },
        {
          label: "2차 진단 상태",
          value: stage2DiagnosisStatusLabel(stage2DiagnosisStatus),
          hint: "IN_PROGRESS / COMPLETED",
        },
        {
          label: "검사 완료율",
          value: `${stage2CompletionPct ?? 0}%`,
          hint: "필수 검사 항목 기준",
        },
        {
          label: "필수자료 충족도",
          value: `${stage2RequiredDataPct ?? 0}%`,
          hint: "누락 영향 반영",
        },
        {
          label: "다음 진단 일정",
          value: formatDateTime(stage2NextDiagnosisAt),
          hint: "예약/결과 목표일",
        },
        {
          label: "데이터 품질",
          value: `${stage2QualityScore ?? 0}%`,
          hint: "최신성/유효성",
        },
      ] as const;

      return (
        <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-bold text-slate-900">Stage2 분류 확정 보드</h3>
            <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-semibold text-slate-700">
              모델 분류 결과(운영 참고)
            </span>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6">
            {topStripItems.map((item) => (
              <article
                key={item.label}
                title={item.hint}
                className="rounded-lg border border-slate-200 bg-gradient-to-b from-white to-slate-50 px-2.5 py-2 shadow-sm transition-all duration-150 hover:-translate-y-0.5 hover:shadow-md"
              >
                <p className="text-[10px] font-semibold text-slate-500">{item.label}</p>
                <p className="mt-1 text-xs font-bold text-slate-900">{item.value}</p>
              </article>
            ))}
          </div>

          <div className="mt-4">
            {stage2ModelAvailable ? (
              <Stage2ClassificationViz
                probs={stage2Probs}
                predictedLabel={stage2ResultLabel}
                mciSeverity={stage2MciStage}
                mciScore={stage2MciScore}
              />
            ) : (
              <ModelGateGuard stage={2} missing={stage2MissingEvidence} onOpenStep={onOpenStage2Input} />
            )}
          </div>

          <div className="mt-4 grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-5">
            {scoreSummary.map((item) => (
              <article
                key={item.label}
                className="rounded-xl border border-gray-200 bg-gradient-to-b from-white to-slate-50 p-3 shadow-sm transition-all duration-150 hover:-translate-y-0.5 hover:shadow-md"
                title="Stage2 운영 KPI"
              >
                <p className="text-[11px] font-semibold text-gray-500">{item.label}</p>
                <p className="mt-1 text-lg font-bold text-slate-900">
                  {item.value}
                  {item.unit ? <span className="ml-0.5 text-xs text-gray-400">{item.unit}</span> : null}
                </p>
                <p className="text-[10px] text-gray-400">업데이트 {formatDateTime(item.updatedAt)}</p>
                {item.flags?.length ? (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {item.flags.map((flag) => (
                      <span key={`${item.label}-${flag}`} className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">
                        {flag}
                      </span>
                    ))}
                  </div>
                ) : null}
              </article>
            ))}
          </div>

          <div className="mt-4 grid grid-cols-1 gap-2 md:grid-cols-3">
            <article className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-[11px] font-semibold text-slate-700">예약/의뢰 대기 건수</p>
              <p className="mt-1 text-lg font-bold text-slate-900">{stage2WaitingCount ?? 0}건</p>
              <p className="text-[10px] text-slate-500">예약 확정/의뢰 완료가 필요한 항목</p>
            </article>
            <article className="rounded-xl border border-amber-200 bg-amber-50 p-3">
              <p className="text-[11px] font-semibold text-amber-800">결과 입력 누락 항목</p>
              <p className="mt-1 text-lg font-bold text-amber-900">{stage2ResultMissingCount ?? 0}건</p>
              <p className="text-[10px] text-amber-700">필수 검사 항목(MMSE/CDR/신경인지/전문의) 기준</p>
            </article>
            <article className="rounded-xl border border-indigo-200 bg-indigo-50 p-3">
              <p className="text-[11px] font-semibold text-indigo-900">분류 확정 상태</p>
              <p className="mt-1 text-lg font-bold text-indigo-900">
                {stage2ClassificationConfirmed ? "CONFIRMED" : "UNCONFIRMED"}
              </p>
              <p className="text-[10px] text-indigo-700">담당자 확인 후 확정 버튼으로 반영</p>
            </article>
          </div>
        </section>
      );
    }

    if (!stage3ModelAvailable) {
      return (
        <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-bold text-slate-900">{isAdManagement ? "AD 위험도 추적" : "AD 전환 위험(2년)"}</h3>
            <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-semibold text-slate-700">
              결과 대기
            </span>
          </div>
          <div className="mt-3">
            <ModelGateGuard stage={3} missing={stage3MissingEvidence} onOpenStep={onOpenStage3Input} />
          </div>
        </section>
      );
    }

    const scoreTooltipByLabel = (label: string) => {
      if (isStage2OpsMode) {
        if (label.includes("진단 진행률")) return "Stage2 워크플로우의 완료 비율입니다. 예약/결과/확정 기록을 반영합니다.";
        if (label.includes("예약/의뢰 대기")) return "의뢰/예약 확정이 필요한 항목 수입니다.";
        if (label.includes("결과 수신 지연")) return "결과 미수신/지연 누적 수준입니다.";
        if (label.includes("분류 확정 상태")) return "정상/MCI/치매 분류 확정 여부입니다.";
        if (label.includes("필수자료 충족도")) return "필수 서류/점수/진찰 기록의 충족 수준입니다.";
      }
      if (label.includes("전환 위험")) return "2년 내 AD 전환 위험의 운영 참고 지표입니다. 확률 단독으로 단정하지 않습니다.";
      if (label.includes("현재 위험지수")) return "현재 위험지수의 운영 참고 지표입니다. 확률 단독으로 단정하지 않습니다.";
      if (label.includes("재평가 필요도")) return "트리거/가드레일로 감지된 주의 신호 수입니다. 재평가 우선순위에 반영됩니다.";
      if (label.includes("추적 준수도")) return "최근 추적 실행의 준수 수준입니다. 지연/미응답 누적 여부를 함께 확인하세요.";
      if (label.includes("정밀관리 플랜")) return "정밀관리 플랜의 진행 상태입니다. 변경/실행은 감사 로그에 기록됩니다.";
      if (label.includes("데이터 품질")) return "누락/최신성/유효성을 반영한 운영 품질 지표입니다.";
      return "운영 참고 지표입니다.";
    };
    const normalizeScoreLabelForStage3 = (label: string) => {
      if (!isAdManagement) return label;
      return label
        .replace("2년 전환 위험도", "현재 위험지수")
        .replace("2년 전환위험", "현재 위험지수")
        .replace("전환 위험도", "현재 위험지수")
        .replace("전환위험", "현재 위험지수")
        .replace("전환 위험", "위험");
    };

    return (
      <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="group relative inline-flex items-center gap-1 text-sm font-bold text-slate-900">
              {isStage2OpsMode ? "Stage2 진단검사 운영 지표" : isAdManagement ? "AD 위험도 추적" : "AD 전환 위험(2년)"}
              <AlertCircle size={13} className="text-slate-400" />
              <span className="pointer-events-none absolute left-0 top-[calc(100%+8px)] z-20 w-80 rounded-md border border-slate-200 bg-white px-2 py-1.5 text-[10px] font-medium text-slate-600 opacity-0 shadow-md transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100">
                {isStage2OpsMode
                  ? "Stage2 진단검사의 진행/지연 신호를 운영 참고용으로 표시합니다. 예약/의뢰/확정은 담당자 확인 후 진행합니다."
                  : isAdManagement
                    ? "감별검사/관리 데이터를 바탕으로 현재 위험지수를 운영 참고용으로 표시합니다. 최종 조치는 담당자·의료진 확인 후 진행합니다."
                    : "감별검사/뇌영상 및 추적 정보를 바탕으로 2년 내 AD 전환 위험을 운영 참고용으로 표시합니다. 최종 조치는 담당자·의료진 확인 후 진행합니다."}
              </span>
            </h3>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="group relative rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-[11px] font-semibold text-blue-700">
              {isStage2OpsMode ? "진단 지연 위험" : isAdManagement ? "현재 위험지수" : "2년 전환위험"} {toPercentValue(stage3Risk.risk2y_now)}%
              <span className="pointer-events-none absolute left-0 top-[calc(100%+6px)] z-20 w-56 rounded-md border border-slate-200 bg-white px-2 py-1 text-[10px] font-medium text-slate-600 opacity-0 shadow-md transition-opacity duration-150 group-hover:opacity-100">
                {isStage2OpsMode ? "진단 지연 위험: 운영 우선순위 참고 지표" : isAdManagement ? "현재 위험지수: 운영 우선순위 참고 지표" : "전환위험: 운영 우선순위 참고 지표"}
              </span>
            </span>
            <span className="group relative rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-[11px] font-semibold text-indigo-700">
              {isStage2OpsMode ? "진행 상태" : "신뢰수준"} {deriveStage3RiskLabel(stage3Risk.risk2y_now)}
              <span className="pointer-events-none absolute left-0 top-[calc(100%+6px)] z-20 w-52 rounded-md border border-slate-200 bg-white px-2 py-1 text-[10px] font-medium text-slate-600 opacity-0 shadow-md transition-opacity duration-150 group-hover:opacity-100">
                {isStage2OpsMode ? "진단 진행 상태와 누락 영향 반영" : "데이터 품질/누락 영향이 반영된 신뢰 수준"}
              </span>
            </span>
            <span className={cn("group relative rounded-full border px-2.5 py-1 text-[11px] font-semibold", contactPriority.tone)}>
              {isStage2OpsMode ? "진단 진행 강도" : "업무 우선도"} {contactPriority.label}
              <span className="pointer-events-none absolute left-0 top-[calc(100%+6px)] z-20 w-52 rounded-md border border-slate-200 bg-white px-2 py-1 text-[10px] font-medium text-slate-600 opacity-0 shadow-md transition-opacity duration-150 group-hover:opacity-100">
                {isStage2OpsMode ? "진단 진행 강도: 리마인더/상담/기관재요청 강도" : "업무 우선도: 운영 실행 순서를 나타내는 보조 지표"}
              </span>
            </span>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-5">
          {scoreSummary.map((item) => {
            const displayLabel = normalizeScoreLabelForStage3(item.label);
            return (
            <article
              key={item.label}
              className="group relative rounded-xl border border-gray-200 bg-gradient-to-b from-white to-slate-50 p-3 shadow-sm transition-all duration-150 hover:-translate-y-0.5 hover:shadow-md"
            >
              <p className="text-[11px] font-semibold text-gray-500">{displayLabel}</p>
              <p className="mt-1 text-lg font-bold text-slate-900">
                {item.value}
                {item.unit ? <span className="ml-0.5 text-xs text-gray-400">{item.unit}</span> : null}
              </p>
              <p className="text-[10px] text-gray-400">업데이트 {formatDateTime(item.updatedAt)}</p>
              {item.flags?.length ? (
                <div className="mt-1 flex flex-wrap gap-1">
                  {item.flags.map((flag) => (
                    <span key={`${item.label}-${flag}`} className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">
                      {flag}
                    </span>
                  ))}
                </div>
              ) : (
                <span className="mt-1 inline-flex rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">
                  정상
                </span>
              )}
              <span className="pointer-events-none absolute left-3 top-[calc(100%+6px)] z-20 w-56 rounded-md border border-slate-200 bg-white px-2 py-1 text-[10px] font-medium text-slate-600 opacity-0 shadow-md transition-opacity duration-150 group-hover:opacity-100">
                {scoreTooltipByLabel(displayLabel)}
              </span>
            </article>
            );
          })}
        </div>

        <div className="mt-4 rounded-xl border border-indigo-200 bg-indigo-50 p-3">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="text-xs font-semibold text-indigo-900">
                {isStage2OpsMode
                  ? "진단 진행/지연 시계열"
                  : stage3Type === "AD_MANAGEMENT"
                    ? "위험도 추적 시계열"
                    : "전환 위험 시계열(관측 + 1·2·3년 예측)"}
              </p>
              <p className="text-[11px] text-indigo-700">
                {isStage2OpsMode ? "지연 추세" : "추세"} {stage3Risk.trend} · 업데이트 {formatDateTime(stage3Risk.updatedAt)} · 모델 {stage3Risk.modelVersion}
              </p>
            </div>
            <button
              type="button"
              onClick={onStage3MarkRiskReviewed}
              className="rounded-md border border-indigo-300 bg-white px-2.5 py-1 text-[11px] font-semibold text-indigo-700 hover:bg-indigo-100"
            >
              {stage3RiskReviewedAt
                ? isStage2OpsMode
                  ? "진단 진행 재검토 기록"
                  : "위험 추세 재검토 기록"
                : isStage2OpsMode
                  ? "진단 진행 검토 완료"
                  : "위험 추세 검토 완료"}
            </button>
          </div>
          <div className="mt-2">
            <RiskTrendChart
              risk={stage3Risk}
              stageBadge={stage3DiffPathStatus}
              stage2OpsView={isStage2OpsMode}
              stage3Type={stage3Type}
            />
          </div>
          <p className="mt-2 text-[11px] text-indigo-700">
            {isStage2OpsMode
              ? stage3Risk.variabilityNote ?? "운영 참고: 지연/누락/근거를 함께 확인해 예약·의뢰·확정을 진행합니다."
              : stage3Risk.variabilityNote ?? "운영 참고: 확률 단독으로 단정하지 않고 누락/품질/근거를 함께 확인합니다."}
          </p>
        </div>

        <details className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
          <summary className="cursor-pointer text-[11px] font-semibold text-slate-800">업무 우선도(보조) 보기</summary>
          <div className="mt-3 grid grid-cols-1 gap-4 xl:grid-cols-[210px,1fr]">
            <div className="rounded-lg border border-white bg-white px-3 py-2">
              <p className="text-[10px] font-semibold text-gray-500">업무 우선도 점수 / 개입 레벨</p>
              <p className={cn("mt-1 text-3xl font-black", scoreTone)}>
                {clampedPriority} <span className="text-lg font-bold text-slate-600">/ {interventionLevel}</span>
              </p>
              <div className="mt-2 flex items-center justify-between">
                <span className={cn("rounded-full border px-2 py-0.5 text-[10px] font-semibold", modelPriorityMeta.tone)}>
                  {activeBand}
                </span>
                <span className="text-[10px] font-semibold text-gray-500">상위 {topPercent}% 대상</span>
              </div>
            </div>
            <div className="rounded-lg border border-white bg-white px-3 py-3">
              <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
                {stepCards.map((step) => {
                  const isActive = step.key === activeBand;
                  return (
                    <div
                      key={step.key}
                      className={cn("rounded-lg border px-2 py-2 transition-colors", isActive ? step.tone : "border-gray-200 bg-gray-50 text-gray-500")}
                    >
                      <div className="flex items-center justify-between">
                        <p className="text-[11px] font-bold">{step.key}</p>
                        <span className={cn("h-2 w-2 rounded-full", isActive ? step.dot : "bg-gray-300")} />
                      </div>
                      <p className="mt-0.5 text-[10px] font-semibold">{step.range}</p>
                      <p className="mt-1 text-[10px]">{step.guide}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </details>
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-sm font-bold text-slate-900">{isStage2Mode ? "2차 평가 근거 요약" : "1차 검사 점수"}</h3>
        <div className="flex items-center gap-2">
          <span className={cn("rounded-full border px-2.5 py-1 text-[11px] font-semibold", contactPriority.tone)}>
            {isStage2Mode ? "추적 우선도" : "접촉 우선도"} {contactPriority.label}
          </span>
          <span className={cn("rounded-full border px-2.5 py-1 text-[11px] font-semibold", modelPriorityMeta.tone)}>
            {isStage2Mode ? "운영 개입 지표" : "우선 처리 지표"} {modelPriorityMeta.label} {modelPriorityValue}
          </span>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-4">
        {scoreSummary.map((item) => (
          <article key={item.label} className="rounded-lg border border-gray-100 bg-gray-50 p-3">
            <p className="text-[11px] font-semibold text-gray-500">{item.label}</p>
            <p className="mt-1 text-lg font-bold text-slate-900">
              {item.value}
              {item.unit ? <span className="ml-0.5 text-xs text-gray-400">{item.unit}</span> : null}
            </p>
            <p className="text-[10px] text-gray-400">업데이트 {formatDateTime(item.updatedAt)}</p>
          </article>
        ))}
      </div>

      <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
        <div className="flex items-center justify-between text-[11px] text-slate-700">
          <span className="relative inline-flex items-center gap-1 font-semibold group">
            {isStage2Mode ? "운영 개입 우선도 Bullet Chart" : "운영 우선도 Bullet Chart"}
            <AlertCircle size={13} className="text-slate-400" />
            <span className="pointer-events-none absolute left-0 top-[calc(100%+8px)] z-30 w-64 rounded-lg border border-slate-200 bg-white p-2 text-[11px] text-slate-600 opacity-0 shadow-md transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100">
              <span className="block font-semibold text-slate-900">계산 방식 요약</span>
              <span className="mt-1 block">- 상태/위험/데이터 품질 점수를 합산합니다.</span>
              <span className="block">- 민원·지연·재시도 이력을 가중 요소로 반영합니다.</span>
              <span className="block">- 점수 구간(관찰/일반/우선/긴급)은 실행 우선순위 분류용입니다.</span>
            </span>
          </span>
          <span>{modelPriorityMeta.guide}</span>
        </div>

        <div className="mt-3 grid grid-cols-1 gap-4 xl:grid-cols-[210px,1fr]">
          <div className="rounded-lg border border-white bg-white px-3 py-2">
            <p className="text-[10px] font-semibold text-gray-500">현재 우선도 점수 / 개입 레벨</p>
            <p className={cn("mt-1 text-3xl font-black", scoreTone)}>
              {clampedPriority} <span className="text-lg font-bold text-slate-600">/ {interventionLevel}</span>
            </p>
            <div className="mt-2 flex items-center justify-between">
              <span className={cn("rounded-full border px-2 py-0.5 text-[10px] font-semibold", modelPriorityMeta.tone)}>
                {activeBand}
              </span>
              <span className="text-[10px] font-semibold text-gray-500">상위 {topPercent}% 대상</span>
            </div>
          </div>

          <div className="rounded-lg border border-white bg-white px-3 py-3">
            <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
              {stepCards.map((step) => {
                const isActive = step.key === activeBand;
                return (
                  <div
                    key={step.key}
                    className={cn(
                      "rounded-lg border px-2 py-2 transition-colors",
                      isActive ? step.tone : "border-gray-200 bg-gray-50 text-gray-500"
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <p className="text-[11px] font-bold">{step.key}</p>
                      <span className={cn("h-2 w-2 rounded-full", isActive ? step.dot : "bg-gray-300")} />
                    </div>
                    <p className="mt-0.5 text-[10px] font-semibold">{step.range}</p>
                    <p className="mt-1 text-[10px]">{step.guide}</p>
                  </div>
                );
              })}
            </div>

            <div className="mt-2 rounded-md border border-gray-100 bg-gray-50 px-2 py-1.5 text-[11px] text-gray-600">
              현재 위치: <span className={cn("font-bold", scoreTone)}>{activeBand}</span> · 점수 {clampedPriority} / {interventionLevel}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export function ContactTimeline({
  timeline,
  filter,
  onFilterChange,
  listClassName,
  mode = "stage1",
  stage2OpsView = false,
  stage3Type,
}: {
  timeline: ContactEvent[];
  filter: TimelineFilter;
  onFilterChange: (next: TimelineFilter) => void;
  listClassName?: string;
  mode?: StageOpsMode;
  stage2OpsView?: boolean;
  stage3Type?: Stage3ViewModel["source"]["profile"]["stage3Type"];
}) {
  const isStage3Mode = mode === "stage3";
  const isStage2OpsMode = isStage3Mode && stage2OpsView;
  const isAdManagement = isStage3Mode && stage3Type === "AD_MANAGEMENT" && !isStage2OpsMode;
  return (
    <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
          <History size={15} className="text-slate-500" />
          {isStage2OpsMode
            ? "진단검사/결과/분류 타임라인"
            : isStage3Mode
              ? isAdManagement
                ? "위험도추적/감별/프로그램/플랜 타임라인"
                : "전환위험/감별/프로그램/플랜 타임라인"
              : "연락/발송/상태 타임라인"}
        </h3>

        <div className="flex items-center gap-1 rounded-lg border border-gray-200 bg-gray-50 p-1 text-[11px] font-semibold">
          {[
            { key: "ALL" as const, label: "전체" },
            { key: "CALL" as const, label: "연락" },
            { key: "SMS" as const, label: "발송" },
            { key: "STATUS" as const, label: "상태" },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => onFilterChange(tab.key)}
              className={cn(
                "rounded-md px-2 py-1 transition-colors",
                filter === tab.key ? "bg-white text-slate-900 shadow-sm" : "text-gray-500 hover:bg-white"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className={cn("mt-3 space-y-2", listClassName)}>
        {timeline.length === 0 ? (
          <p className="rounded-md border border-gray-100 bg-gray-50 px-3 py-2 text-xs text-gray-500">
            {isStage2OpsMode
              ? "진단검사 기록 없음 — 예약/결과/확정 액션을 실행하면 여기에 누적됩니다."
              : isStage3Mode
              ? "자동 수행 기록 없음 — 운영자가 수동 실행했거나 아직 제안이 승인되지 않았습니다."
              : "해당 필터의 기록이 없습니다."}
          </p>
        ) : (
          timeline.map((event, idx) => (
            <div key={`${event.type}-${event.at}-${idx}`} className="rounded-md border border-gray-100 bg-gray-50 px-3 py-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-slate-800">{eventTitle(event)}</p>
                <span className="text-[11px] text-gray-500">{formatDateTime(event.at)}</span>
              </div>
              <p className="mt-1 text-[11px] text-gray-600">{eventDetail(event)}</p>
              <p className="mt-1 text-[10px] text-gray-400">처리자: {event.by}</p>
            </div>
          ))
        )}
      </div>

      <p className="mt-3 text-[11px] text-gray-500">
        {isStage2OpsMode
          ? "운영자가 지금 해야 할 행동: 예약/결과수신/분류확정 이벤트를 우선 확인하고 누락을 보완하세요."
          : isStage3Mode
          ? isAdManagement
            ? "운영자가 지금 해야 할 행동: 위험도추적/감별/프로그램/플랜 이벤트를 우선 확인하고 보조 연락 기록을 점검"
            : "운영자가 지금 해야 할 행동: 전환위험/감별/프로그램/플랜 이벤트를 우선 확인하고 보조 연락 기록을 점검"
          : "운영자가 지금 해야 할 행동: 최근 3일 미접촉이면 재시도 계획 생성"}
      </p>
    </section>
  );
}

export function TodoChecklistPanel({
  todos,
  onDone,
  onSnooze,
  onCancel,
}: {
  todos: TodoItem[];
  onDone: (todoId: string) => void;
  onSnooze: (todoId: string) => void;
  onCancel: (todoId: string) => void;
}) {
  return (
    <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
        <ListChecks size={15} className="text-slate-500" />
        오늘 할 일
      </h3>

      <div className="mt-3 space-y-2">
        {todos.map((todo) => (
          <article key={todo.id} className="rounded-lg border border-gray-100 bg-gray-50 p-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-xs font-semibold text-slate-800">{todo.title}</p>
                {todo.dueAt ? <p className="text-[10px] text-gray-500">기한 {formatDateTime(todo.dueAt)}</p> : null}
              </div>
              <span className={cn("rounded border px-1.5 py-0.5 text-[10px] font-semibold", todoTone(todo.priority))}>P{todo.priority}</span>
            </div>

            <div className="mt-2 flex items-center justify-between">
              <span className="text-[11px] text-gray-500">
                상태: {todo.status === "OPEN" ? "진행 필요" : todo.status === "DONE" ? "완료" : todo.status === "SNOOZED" ? "보류" : "취소"}
              </span>

              <div className="flex items-center gap-1">
                <button
                  onClick={() => onDone(todo.id)}
                  disabled={todo.status === "DONE"}
                  className="inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-[10px] font-semibold text-emerald-700 disabled:opacity-50"
                >
                  <Check size={11} /> 완료
                </button>
                <button
                  onClick={() => onSnooze(todo.id)}
                  disabled={todo.status === "SNOOZED"}
                  className="inline-flex items-center gap-1 rounded-md border border-orange-200 bg-orange-50 px-2 py-1 text-[10px] font-semibold text-orange-700 disabled:opacity-50"
                >
                  <PauseCircle size={11} /> 보류
                </button>
                <button
                  onClick={() => onCancel(todo.id)}
                  disabled={todo.status === "CANCELED"}
                  className="inline-flex items-center gap-1 rounded-md border border-gray-200 bg-gray-100 px-2 py-1 text-[10px] font-semibold text-gray-600 disabled:opacity-50"
                >
                  <Ban size={11} /> 제외
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>

      <p className="mt-3 text-[11px] text-gray-500">운영자가 지금 해야 할 행동: 상단 2개 To-Do부터 완료</p>
    </section>
  );
}

function ConsultationServicePanel({
  onOpenCall,
  onOpenSms,
  lastCallEvent,
  lastSmsEvent,
}: {
  onOpenCall: () => void;
  onOpenSms: () => void;
  lastCallEvent?: ContactEvent;
  lastSmsEvent?: ContactEvent;
}) {
  return (
    <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
        <PhoneCall size={15} className="text-slate-500" />
        상담/문자 실행
      </h3>

      <p className="mt-2 text-[11px] text-gray-500">
        하단 인라인 상담/SMS 엔진에서 바로 실행하거나, 필요 시 v1 상담 서비스 화면으로 이동해 처리할 수 있습니다.
      </p>

      <div className="mt-3 space-y-2">
        <button
          onClick={onOpenCall}
          className="inline-flex w-full items-center justify-between rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-left hover:bg-blue-100"
        >
          <span className="inline-flex items-center gap-2 text-xs font-semibold text-blue-900">
            <Phone size={13} /> 전화 상담 페이지 열기
          </span>
          <ArrowRightCircle size={14} className="text-blue-700" />
        </button>

        <button
          onClick={onOpenSms}
          className="inline-flex w-full items-center justify-between rounded-lg border border-orange-200 bg-orange-50 px-3 py-2 text-left hover:bg-orange-100"
        >
          <span className="inline-flex items-center gap-2 text-xs font-semibold text-orange-900">
            <MessageSquare size={13} /> 문자/연계 페이지 열기
          </span>
          <ArrowRightCircle size={14} className="text-orange-700" />
        </button>
      </div>

      <div className="mt-3 space-y-1 rounded-md border border-gray-100 bg-gray-50 px-3 py-2">
        <p className="text-[11px] text-gray-600">
          최근 전화:{" "}
          {lastCallEvent?.type === "CALL_ATTEMPT"
            ? `${formatDateTime(lastCallEvent.at)} · ${eventTitle(lastCallEvent)}`
            : "기록 없음"}
        </p>
        <p className="text-[11px] text-gray-600">
          최근 문자:{" "}
          {lastSmsEvent?.type === "SMS_SENT"
            ? `${formatDateTime(lastSmsEvent.at)} · ${resolveSmsTemplateLabel(lastSmsEvent.templateId)}`
            : "기록 없음"}
        </p>
      </div>
    </section>
  );
}

export function CallConsolePanel({
  focus,
  disabledReason,
  callTarget,
  onTargetChange,
  callActive,
  callDurationText,
  callResultDraft,
  onResultDraftChange,
  callMemo,
  onMemoChange,
  onOpenScript,
  onStartCall,
  onStopCall,
  onFocus,
  onFocusClose,
  lastCallEvent,
}: {
  focus: boolean;
  disabledReason?: string;
  callTarget: CallTarget;
  onTargetChange: (target: CallTarget) => void;
  callActive: boolean;
  callDurationText: string;
  callResultDraft: "SUCCESS" | "NO_ANSWER" | "REJECTED" | "WRONG_NUMBER";
  onResultDraftChange: (value: "SUCCESS" | "NO_ANSWER" | "REJECTED" | "WRONG_NUMBER") => void;
  callMemo: string;
  onMemoChange: (value: string) => void;
  onOpenScript: () => void;
  onStartCall: () => void;
  onStopCall: () => void;
  onFocus: () => void;
  onFocusClose: () => void;
  lastCallEvent?: ContactEvent;
}) {
  const [currentStep, setCurrentStep] = useState<CallScriptStep>("greeting");
  const [checkStates, setCheckStates] = useState<Record<string, boolean>>({});
  const script = CALL_SCRIPT_STEPS.find((entry) => entry.step === currentStep) ?? CALL_SCRIPT_STEPS[0];

  useEffect(() => {
    setCurrentStep("greeting");
    setCheckStates({});
  }, [callTarget]);

  return (
    <section
      className={cn(
        "rounded-xl border bg-white p-0 shadow-sm transition-all overflow-hidden",
        focus ? "border-blue-300 ring-2 ring-blue-100 shadow-lg" : "border-gray-200"
      )}
    >
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-blue-100 px-4 py-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-blue-900 flex items-center gap-2">
            <PhoneCall size={15} className="text-blue-700" />
            상담 실행 엔진
          </h3>
          {focus ? (
            <button
              onClick={onFocusClose}
              className="inline-flex items-center gap-1 rounded-md border border-gray-200 bg-white px-2 py-1 text-[10px] font-semibold text-gray-600"
            >
              <X size={11} /> 포커스 종료
            </button>
          ) : (
            <button
              onClick={onFocus}
              className="inline-flex items-center gap-1 rounded-md border border-blue-200 bg-white px-2 py-1 text-[10px] font-semibold text-blue-700"
            >
              <ExternalLink size={11} /> 포커스
            </button>
          )}
        </div>
        <p className="mt-1 text-[11px] text-blue-700">구버전 상담 화면 흐름(단계 선택/스크립트/결과 기록)을 v2 운영 콘솔에 맞춰 반영</p>
      </div>

      <div className="p-4 space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => onTargetChange("citizen")}
            className={cn(
              "flex items-center gap-2 rounded-lg border-2 px-3 py-2.5 text-left transition-colors",
              callTarget === "citizen" ? "border-blue-500 bg-blue-50" : "border-gray-200 bg-gray-50 hover:border-gray-300"
            )}
          >
            <div className={cn("h-3 w-3 rounded-full border-2", callTarget === "citizen" ? "border-blue-500 bg-blue-500" : "border-gray-300")} />
            <div>
              <p className="text-xs font-semibold text-slate-900">대상자 본인</p>
              <p className="text-[10px] text-gray-500">상담 기본 대상</p>
            </div>
          </button>
          <button
            onClick={() => onTargetChange("guardian")}
            className={cn(
              "flex items-center gap-2 rounded-lg border-2 px-3 py-2.5 text-left transition-colors",
              callTarget === "guardian" ? "border-violet-500 bg-violet-50" : "border-gray-200 bg-gray-50 hover:border-gray-300"
            )}
          >
            <div className={cn("h-3 w-3 rounded-full border-2", callTarget === "guardian" ? "border-violet-500 bg-violet-500" : "border-gray-300")} />
            <div>
              <p className="text-xs font-semibold text-slate-900">보호자</p>
              <p className="text-[10px] text-gray-500">필요 시 우선 연락 전환</p>
            </div>
          </button>
        </div>

        <div className="grid grid-cols-4 gap-1 rounded-lg border border-gray-200 bg-gray-50 p-1 text-[11px] font-semibold">
          {CALL_SCRIPT_STEPS.map((step, idx) => (
            <button
              key={step.step}
              onClick={() => setCurrentStep(step.step)}
              className={cn(
                "rounded-md px-2 py-1 transition-colors",
                currentStep === step.step ? "bg-white text-slate-900 shadow-sm" : "text-gray-500 hover:bg-white"
              )}
            >
              {idx + 1}단계
            </button>
          ))}
        </div>

        <div>
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-blue-900">{script.title}</p>
              <button
                onClick={onOpenScript}
                className="inline-flex items-center gap-1 rounded border border-blue-200 bg-white px-1.5 py-0.5 text-[10px] font-semibold text-blue-700"
              >
                <FilePenLine size={10} />
                안내 확인
              </button>
            </div>
            <p className="mt-2 whitespace-pre-line text-[11px] leading-relaxed text-blue-900">{script.content}</p>
          </div>

          <div className="mt-2 grid grid-cols-1 gap-2 lg:grid-cols-2">
            <div className="rounded-md border border-gray-100 bg-gray-50 p-2">
              <p className="text-[11px] font-semibold text-gray-700">상담 팁</p>
              <ul className="mt-1 space-y-1">
                {script.tips.map((tip) => (
                  <li key={tip} className="text-[10px] text-gray-600">• {tip}</li>
                ))}
              </ul>
            </div>
            <div className="rounded-md border border-gray-100 bg-gray-50 p-2">
              <p className="text-[11px] font-semibold text-gray-700">체크포인트</p>
              <div className="mt-1 space-y-1">
                {script.checkpoints.map((checkpoint) => (
                  <label key={checkpoint} className="flex items-center gap-1 text-[10px] text-gray-600">
                    <input
                      type="checkbox"
                      checked={Boolean(checkStates[checkpoint])}
                      onChange={(e) => setCheckStates((prev) => ({ ...prev, [checkpoint]: e.target.checked }))}
                    />
                    {checkpoint}
                  </label>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-md border border-gray-100 bg-gray-50 px-3 py-2">
          <p className="text-[11px] font-semibold text-gray-700">통화 결과(임시 선택)</p>
          <div className="mt-1 grid grid-cols-2 gap-1 text-[11px]">
            {[
              { value: "SUCCESS", label: "성공", icon: CheckCircle2, tone: "text-emerald-700" },
              { value: "NO_ANSWER", label: "부재", icon: Clock3, tone: "text-orange-700" },
              { value: "REJECTED", label: "거절", icon: AlertCircle, tone: "text-red-700" },
              { value: "WRONG_NUMBER", label: "번호 오류", icon: X, tone: "text-gray-700" },
            ].map((option) => (
              <label key={option.value} className="flex items-center gap-1 rounded border border-gray-200 bg-white px-2 py-1">
                <input
                  type="radio"
                  name="call-result-draft"
                  checked={callResultDraft === option.value}
                  onChange={() => onResultDraftChange(option.value as "SUCCESS" | "NO_ANSWER" | "REJECTED" | "WRONG_NUMBER")}
                />
                <option.icon size={11} className={option.tone} />
                {option.label}
              </label>
            ))}
          </div>
        </div>

        <div className="rounded-md border border-gray-100 bg-gray-50 px-3 py-2">
          <p className="text-[11px] text-gray-500">통화 메모</p>
          <textarea
            value={callMemo}
            onChange={(e) => onMemoChange(e.target.value)}
            className="mt-1 h-16 w-full rounded-md border border-gray-200 bg-white px-2 py-1 text-xs outline-none focus:border-blue-400"
            placeholder="통화 중 확인한 사항을 기록하세요"
          />
        </div>

        <div className="flex items-center justify-between">
          <div className="inline-flex items-center gap-1 rounded-md bg-gray-100 px-2 py-1 text-[11px] font-semibold text-gray-700">
            <Timer size={12} /> {callActive ? `통화 중 ${callDurationText}` : "대기"}
          </div>

          {!callActive ? (
            <button
              onClick={onStartCall}
              disabled={Boolean(disabledReason)}
              title={disabledReason}
              className="inline-flex items-center gap-1 rounded-md bg-[#163b6f] px-3 py-1.5 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:bg-gray-300"
            >
              <Phone size={12} /> 전화하기
            </button>
          ) : (
            <button
              onClick={onStopCall}
              className="inline-flex items-center gap-1 rounded-md bg-red-600 px-3 py-1.5 text-xs font-semibold text-white"
            >
              <CheckCircle2 size={12} /> 통화 종료
            </button>
          )}
        </div>

        {disabledReason ? <p className="text-[11px] text-red-600">실행 불가: {disabledReason}</p> : null}

        {lastCallEvent?.type === "CALL_ATTEMPT" ? (
          <p className="text-[11px] text-gray-500">
            최근 이력: {formatDateTime(lastCallEvent.at)} · {eventTitle(lastCallEvent)}
          </p>
        ) : null}
      </div>
    </section>
  );
}

export function SmsConsolePanel({
  focus,
  disabledReason,
  smsTargets,
  onToggleTarget,
  guardianAvailable,
  smsTemplateId,
  onTemplateChange,
  smsScheduleType,
  onScheduleTypeChange,
  smsScheduledAt,
  onScheduledAtChange,
  previewText,
  onPrepareDispatch,
  onFocus,
  onFocusClose,
  lastSmsEvent,
}: {
  focus: boolean;
  disabledReason?: string;
  smsTargets: { citizen: boolean; guardian: boolean };
  onToggleTarget: (target: SmsTarget, checked: boolean) => void;
  guardianAvailable: boolean;
  smsTemplateId: string;
  onTemplateChange: (id: string) => void;
  smsScheduleType: "NOW" | "SCHEDULE";
  onScheduleTypeChange: (type: "NOW" | "SCHEDULE") => void;
  smsScheduledAt: string;
  onScheduledAtChange: (value: string) => void;
  previewText: string;
  onPrepareDispatch: () => void;
  onFocus: () => void;
  onFocusClose: () => void;
  lastSmsEvent?: ContactEvent;
}) {
  const selectedCount = Number(smsTargets.citizen) + Number(smsTargets.guardian && guardianAvailable);

  return (
    <section
      className={cn(
        "rounded-xl border bg-white p-0 shadow-sm transition-all overflow-hidden",
        focus ? "border-orange-300 ring-2 ring-orange-100 shadow-lg" : "border-gray-200"
      )}
    >
      <div className="bg-gradient-to-r from-orange-50 to-amber-50 border-b border-orange-100 px-4 py-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-orange-900 flex items-center gap-2">
            <MessageSquare size={15} className="text-orange-700" />
            SMS 엔진
          </h3>
          {focus ? (
            <button
              onClick={onFocusClose}
              className="inline-flex items-center gap-1 rounded-md border border-gray-200 bg-white px-2 py-1 text-[10px] font-semibold text-gray-600"
            >
              <X size={11} /> 포커스 종료
            </button>
          ) : (
            <button
              onClick={onFocus}
              className="inline-flex items-center gap-1 rounded-md border border-orange-200 bg-white px-2 py-1 text-[10px] font-semibold text-orange-700"
            >
              <ExternalLink size={11} /> 포커스
            </button>
          )}
        </div>
        <p className="mt-1 text-[11px] text-orange-700">구버전 문자 발송 UI(대상 선택/템플릿/미리보기)를 v2 콘솔로 이식</p>
        <p className="mt-0.5 text-[10px] text-orange-700">문자 3종(접촉/예약안내/리마인더) 기준 · 과도한 단정 표현 금지</p>
      </div>

      <div className="p-4 space-y-2">
        <div className="space-y-2">
          <label
            className={cn(
              "flex items-center gap-3 rounded-lg border-2 px-3 py-2.5 transition-colors",
              smsTargets.citizen ? "border-orange-400 bg-orange-50" : "border-gray-200 bg-white hover:border-gray-300"
            )}
          >
            <input
              type="checkbox"
              checked={smsTargets.citizen}
              onChange={(e) => onToggleTarget("citizen", e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-orange-600"
            />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900">대상자 본인</p>
              <p className="text-[11px] text-gray-500">기본 수신 대상</p>
            </div>
            {smsTargets.citizen ? (
              <span className="rounded bg-orange-100 px-1.5 py-0.5 text-[10px] font-semibold text-orange-700">발송</span>
            ) : null}
          </label>

          <label
            className={cn(
              "flex items-center gap-3 rounded-lg border-2 px-3 py-2.5 transition-colors",
              !guardianAvailable
                ? "border-dashed border-gray-200 bg-gray-50 opacity-60"
                : smsTargets.guardian
                  ? "border-blue-400 bg-blue-50"
                  : "border-gray-200 bg-white hover:border-gray-300"
            )}
          >
            <input
              type="checkbox"
              checked={smsTargets.guardian && guardianAvailable}
              onChange={(e) => onToggleTarget("guardian", e.target.checked)}
              disabled={!guardianAvailable}
              className="h-4 w-4 rounded border-gray-300 text-blue-600"
            />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900">보호자</p>
              <p className="text-[11px] text-gray-500">{guardianAvailable ? "추가 수신 가능" : "등록된 번호 없음"}</p>
            </div>
            {smsTargets.guardian && guardianAvailable ? (
              <span className="rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700">발송</span>
            ) : null}
          </label>
        </div>

        <select
          value={smsTemplateId}
          onChange={(e) => onTemplateChange(e.target.value)}
          className="w-full rounded-md border border-gray-200 bg-white px-2 py-2 text-xs outline-none focus:border-blue-400"
        >
          {SMS_TEMPLATES.map((template) => (
            <option key={template.id} value={template.id}>
              {smsMessageTypeLabel(template.messageType)} · {template.label}
            </option>
          ))}
        </select>

        <div className="grid grid-cols-2 gap-1 rounded-lg border border-gray-200 bg-gray-50 p-1 text-[11px] font-semibold">
          <button
            onClick={() => onScheduleTypeChange("NOW")}
            className={cn("rounded-md px-2 py-1", smsScheduleType === "NOW" ? "bg-white shadow-sm text-slate-900" : "text-gray-500")}
          >
            즉시
          </button>
          <button
            onClick={() => onScheduleTypeChange("SCHEDULE")}
            className={cn("rounded-md px-2 py-1", smsScheduleType === "SCHEDULE" ? "bg-white shadow-sm text-slate-900" : "text-gray-500")}
          >
            예약
          </button>
        </div>

        {smsScheduleType === "SCHEDULE" ? (
          <input
            type="datetime-local"
            value={smsScheduledAt}
            onChange={(e) => onScheduledAtChange(e.target.value)}
            className="w-full rounded-md border border-gray-200 bg-white px-2 py-2 text-xs outline-none focus:border-blue-400"
          />
        ) : null}

        <div className="rounded-md border border-gray-100 bg-gray-50 px-3 py-2">
          <p className="text-[11px] text-gray-500">미리보기</p>
          <p className="mt-1 text-[11px] text-gray-700 whitespace-pre-wrap">{previewText}</p>
          <p className="mt-1 text-[10px] text-gray-400">예상 길이: {previewText.length}자</p>
        </div>

        <button
          onClick={onPrepareDispatch}
          disabled={Boolean(disabledReason) || (smsScheduleType === "SCHEDULE" && !smsScheduledAt)}
          title={disabledReason ?? (smsScheduleType === "SCHEDULE" && !smsScheduledAt ? "예약 시간을 입력하세요" : undefined)}
          className="inline-flex w-full items-center justify-center gap-1 rounded-md bg-orange-600 px-3 py-1.5 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:bg-gray-300"
        >
          <MessageSquare size={12} /> {smsScheduleType === "NOW" ? `SMS 발송 (${selectedCount}건)` : `SMS 예약 (${selectedCount}건)`}
        </button>

        {disabledReason ? <p className="text-[11px] text-red-600">실행 불가: {disabledReason}</p> : null}

        {lastSmsEvent?.type === "SMS_SENT" ? (
          <p className="text-[11px] text-gray-500">
            최근 이력: {formatDateTime(lastSmsEvent.at)} · {resolveSmsTemplateLabel(lastSmsEvent.templateId)} · {smsResultLabel(lastSmsEvent.status)}
          </p>
        ) : null}
      </div>
    </section>
  );
}

function InterventionLevelPanel({
  level,
  statusLabel,
  guides,
  onChangeLevel,
  onHold,
  onExclude,
  mode = "stage1",
}: {
  level: InterventionLevel;
  statusLabel: string;
  guides: ReturnType<typeof getStage1InterventionGuides>;
  onChangeLevel: (level: InterventionLevel) => void;
  onHold: () => void;
  onExclude: () => void;
  mode?: StageOpsMode;
}) {
  const isStage3Mode = mode === "stage3";
  return (
    <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
        <Layers size={15} className="text-slate-500" />
        {isStage3Mode ? "추적 강도 (운영 강도)" : "개입 레벨 (운영 강도)"}
      </h3>

      <div className="mt-3 space-y-2">
        {guides.map((guide) => (
          <button
            key={guide.level}
            onClick={() => onChangeLevel(guide.level)}
            title={`${guide.purpose} / 적용 시점: ${guide.whenToUse}`}
            className={cn(
              "w-full rounded-lg border px-3 py-2 text-left transition-colors",
              guide.level === level ? guide.tone : "border-gray-200 bg-gray-50 hover:bg-gray-100"
            )}
          >
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold">{guide.level} · {guide.label}</p>
              {guide.level === level ? <CheckCircle2 size={13} /> : null}
            </div>
            <p className="mt-1 text-[11px] text-gray-600">{guide.purpose}</p>
          </button>
        ))}
      </div>

      <div className="mt-3 rounded-md border border-gray-100 bg-gray-50 p-2">
        <p className="text-[11px] text-gray-600">현재 상태: <strong>{statusLabel}</strong></p>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <button
          onClick={onHold}
          className="inline-flex items-center justify-center gap-1 rounded-md border border-orange-200 bg-orange-50 px-2 py-1.5 text-[11px] font-semibold text-orange-700"
        >
          <PauseCircle size={12} /> 보류
        </button>
        <button
          onClick={onExclude}
          className="inline-flex items-center justify-center gap-1 rounded-md border border-red-200 bg-red-50 px-2 py-1.5 text-[11px] font-semibold text-red-700"
        >
          <Ban size={12} /> 우선순위 제외
        </button>
      </div>
    </section>
  );
}

export function ActionReasonModal({
  draft,
  onClose,
  onChangeReason,
  onConfirm,
}: {
  draft: ReasonActionDraft | null;
  onClose: () => void;
  onChangeReason: (reason: string) => void;
  onConfirm: () => void;
}) {
  if (!draft) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4">
      <div className="w-full max-w-md rounded-xl border border-gray-200 bg-white p-4 shadow-2xl">
        <h3 className="text-sm font-bold text-slate-900">{draft.title}</h3>
        <p className="mt-1 text-xs text-gray-500">변경 사유는 감사 로그에 즉시 기록됩니다.</p>

        <textarea
          value={draft.reason}
          onChange={(e) => onChangeReason(e.target.value)}
          className="mt-3 h-24 w-full rounded-lg border border-gray-200 px-2 py-1.5 text-xs outline-none focus:border-blue-400"
          placeholder="변경 사유를 입력하세요"
        />

        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-md border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-700">
            취소
          </button>
          <button
            onClick={onConfirm}
            disabled={!draft.reason.trim()}
            className="rounded-md bg-[#163b6f] px-3 py-1.5 text-xs font-semibold text-white disabled:bg-gray-300"
          >
            {draft.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export function OutcomeModal({
  draft,
  loading,
  onClose,
  onChangeResult,
  onChangeNote,
  onConfirm,
}: {
  draft: OutcomeDraft | null;
  loading: boolean;
  onClose: () => void;
  onChangeResult: (value: string) => void;
  onChangeNote: (value: string) => void;
  onConfirm: () => void;
}) {
  if (!draft) return null;

  const callOptions = [
    { value: "SUCCESS", label: "연락 성공" },
    { value: "NO_ANSWER", label: "부재" },
    { value: "REJECTED", label: "거절" },
    { value: "WRONG_NUMBER", label: "번호 오류" },
  ] as const;

  const smsOptions = [
    { value: "DELIVERED", label: "전송 완료" },
    { value: "FAILED", label: "전송 실패" },
    { value: "PENDING", label: "전송 예약" },
  ] as const;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4">
      <div className="w-full max-w-md rounded-xl border border-gray-200 bg-white p-4 shadow-2xl">
        <h3 className="text-sm font-bold text-slate-900">{draft.title}</h3>
        {draft.mode === "CALL" ? (
          <p className="mt-1 text-xs text-gray-500">통화 시간: {String(Math.floor(draft.durationSec / 60)).padStart(2, "0")}:{String(draft.durationSec % 60).padStart(2, "0")}</p>
        ) : (
          <p className="mt-1 text-xs text-gray-500">{draft.scheduled ? "예약 발송 결과를 기록합니다" : "즉시 발송 결과를 기록합니다"}</p>
        )}

        <div className="mt-3">
          <label className="text-[11px] font-semibold text-gray-600">결과</label>
          <select
            value={draft.result}
            onChange={(e) => onChangeResult(e.target.value)}
            className="mt-1 w-full rounded-md border border-gray-200 bg-white px-2 py-2 text-xs outline-none focus:border-blue-400"
          >
            {(draft.mode === "CALL" ? callOptions : smsOptions).map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div className="mt-3">
          <label className="text-[11px] font-semibold text-gray-600">메모</label>
          <textarea
            value={draft.note}
            onChange={(e) => onChangeNote(e.target.value)}
            className="mt-1 h-20 w-full rounded-md border border-gray-200 px-2 py-1.5 text-xs outline-none focus:border-blue-400"
            placeholder="결과 메모를 입력하세요"
          />
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <button
            onClick={onClose}
            disabled={loading}
            className="rounded-md border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-700 disabled:opacity-50"
          >
            취소
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="rounded-md bg-[#163b6f] px-3 py-1.5 text-xs font-semibold text-white disabled:bg-gray-300"
          >
            {loading ? "처리 중..." : "저장"}
          </button>
        </div>
      </div>
    </div>
  );
}
