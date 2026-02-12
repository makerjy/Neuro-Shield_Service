export type Stage2Class = "NORMAL" | "MCI" | "DEMENTIA" | "UNCONFIRMED";
export type MciSubClass = "MILD_OK" | "MODERATE" | "HIGH_RISK" | null;

export type StepStatus = "DONE" | "PENDING" | "INPUT_REQUIRED" | "MISSING";
export type Stage2StepKey = "healthCheck" | "neuropsych" | "clinicalEval" | "specialist";

export type Stage2Steps = {
  healthCheck: { status: StepStatus; date?: string; summary?: string };
  neuropsych: {
    status: StepStatus;
    date?: string;
    summary?: string;
    missingCount?: number;
    reliability?: "OK" | "CAUTION" | "LOW";
  };
  clinicalEval: {
    status: StepStatus;
    date?: string;
    checklistCount?: number;
    evaluator?: string;
  };
  specialist: { status: StepStatus; date?: string; summary?: string };
};

export type Stage2Decision = {
  class: Stage2Class;
  mciSubClass: MciSubClass;
  confidenceNote?: "CAUTION" | "LOW" | "N/A";
  evidence: string[];
};

export type ProgramDomain = "PHYSICAL" | "COGNITIVE" | "DAILY" | "FAMILY";

export type FollowUpState = {
  reevalTrigger: "ON" | "OFF";
  trackingRegistered: boolean;
  referralStatus: "NOT_CREATED" | "DRAFT" | "SENT";
  reservationStatus: "NOT_REGISTERED" | "REQUESTED" | "CONFIRMED";
  programPlan?: { domains: ProgramDomain[]; notes?: string };
};

export type Stage2CaseDetail = {
  caseId: string;
  centerName: string;
  owner: string;
  roleLabel: string;
  stageLabel: "Stage 2";
  workStatus: "WAITING" | "IN_PROGRESS" | "DONE";
  lastUpdatedAt: string;
  missingTotal: number;
  steps: Stage2Steps;
  decision: Stage2Decision;
  followUp: FollowUpState;
};

export type Stage2TimelineItem = {
  id: string;
  title: string;
  status: "DONE" | "PENDING" | "UNKNOWN";
  at?: string;
  stepId?: Stage2StepKey;
};

export type Stage2ChecklistItem = {
  id: string;
  stepId: Stage2StepKey;
  label: string;
  done: boolean;
  note?: string;
};

export type Stage2AuditLogItem = {
  id: string;
  timestamp: string;
  actor: string;
  message: string;
};

export type Stage2MemoItem = {
  id: string;
  timestamp: string;
  author: string;
  content: string;
};

export type Stage2PiiSummary = {
  maskedName: string;
  maskedPhone: string;
  age: number;
  gender: string;
  addressMasked: string;
  guardianMasked?: string;
};

export type Stage2ActionKey =
  | "CONFIRM_STEP"
  | "TOGGLE_REEVAL"
  | "TOGGLE_TRACKING"
  | "OPEN_PROGRAM"
  | "SAVE_OPS_MEMO"
  | "PREPARE_REFERRAL"
  | "LINK_RESERVATION"
  | "AUTHORIZE_VIEW"
  | "FOCUS_STEP";

export type Stage2NextActionItem = {
  id: string;
  priority: "P1" | "P2" | "P3";
  title: string;
  description: string;
  actionKey: Stage2ActionKey;
  stepId?: Stage2StepKey;
};

export type Stage2CaseDetailData = Stage2CaseDetail & {
  timeline: Stage2TimelineItem[];
  checklist: Stage2ChecklistItem[];
  auditLogs: Stage2AuditLogItem[];
  memos: Stage2MemoItem[];
  pii: Stage2PiiSummary;
};
