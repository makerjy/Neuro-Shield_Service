export type Stage2Class = "NORMAL" | "MCI" | "DEMENTIA" | "UNCONFIRMED";
export type MciSubClass = "MILD_OK" | "MODERATE" | "HIGH_RISK" | null;

export type StepStatus = "DONE" | "PENDING" | "INPUT_REQUIRED" | "MISSING";
export type Stage2StepKey = "healthCheck" | "neuropsych" | "clinicalEval" | "specialist";
export type CaseStage2Status =
  | "WAITING"
  | "IN_PROGRESS"
  | "RESULT_WAITING"
  | "JUDGMENT_DONE"
  | "ON_HOLD"
  | "DISCONTINUED";
export type WorkflowStep =
  | "VERIFY_STAGE1_EVIDENCE"
  | "NEUROPSYCH_TEST"
  | "CLINICAL_EVAL"
  | "SPECIALIST_VISIT"
  | "CONFIRM_DIAGNOSIS"
  | "CONFIRM_FOLLOWUP";
export type BottleneckCode =
  | "NONE"
  | "RESERVATION_PENDING"
  | "HOSPITAL_DELAY"
  | "NO_RESPONSE"
  | "MISSING_DOCS"
  | "OTHER";
export type ReferralStatus =
  | "BEFORE_REFERRAL"
  | "REFERRED"
  | "RESERVATION_REQUESTED"
  | "RESERVATION_CONFIRMED"
  | "RESULT_RECEIVED"
  | "DELAYED"
  | "RE_REQUESTED";
export type TodoType =
  | "NORMAL_REANALYSIS"
  | "MCI_MILD_TRACKING"
  | "MCI_MODERATE_TRACKING"
  | "MCI_HIGH_RISK_DIFF_TEST"
  | "DEMENTIA_DIFF_TEST"
  | "NO_RESPONSE_RETRY";

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
  finalClass?: "NORMAL" | "MCI" | "AD_SUSPECT" | "UNCONFIRMED";
  decidedAt?: string;
  decidedBy?: string;
  rationaleSummary?: string;
};

export type DomainScore = {
  domain: "MEMORY" | "ATTENTION" | "EXECUTIVE" | "LANGUAGE" | "VISUOSPATIAL" | "OTHER";
  score: number;
  grade: "정상" | "경계" | "저하";
  summary: string;
};

export type NeuropsychSummary = {
  cistTotal: number;
  domains: DomainScore[];
  missingCount: number;
  freshness: "LATEST" | "STALE" | "UNKNOWN";
  updatedAt: string;
};

export type ClinicalSummary = {
  adlImpact: "YES" | "NO" | "UNKNOWN";
  caregiverNote: string;
  flags: Array<"MOOD" | "SLEEP" | "MEDICATION" | "DELIRIUM" | "OTHER">;
  needDifferential: boolean;
  updatedAt: string;
};

export type BranchPlan = {
  branch: "NORMAL" | "MCI" | "AD_SUSPECT" | "UNCONFIRMED";
  intensityLevel: "L1" | "L2" | "L3";
  nextActions: Array<{ id: string; label: string; done: boolean }>;
};

export type Stage2LinkageType = "CENTER" | "HOSPITAL" | "COUNSELING";

export type LinkageStatus = {
  type: Stage2LinkageType;
  status: "NOT_CREATED" | "CREATED" | "COMPLETED" | "CANCELED";
  lastActor?: string;
  lastAt?: string;
  nextSchedule?: string;
};

export type FollowUpPlan = {
  cadence: "WEEKLY" | "BIWEEKLY" | "MONTHLY";
  nextDate: string;
  stage3Enroll: boolean;
  notes?: string;
};

export type Stage2AuditEvent = {
  at: string;
  actor: string;
  action: string;
  reason?: string;
  summary: string;
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
  stage2Status: CaseStage2Status;
  stage2EnteredAt: string;
  targetCompletionAt: string;
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

export type Stage2FollowupTodo = {
  id: string;
  type: TodoType;
  title: string;
  status: "WAITING" | "IN_PROGRESS" | "DONE";
  assignee?: string;
  dueDate?: string;
  createdAt: string;
};

export type Stage2CommLog = {
  id: string;
  channel: "SMS" | "CALL";
  templateLabel?: string;
  result: string;
  at: string;
  note?: string;
};

export type Stage2MemoItem = {
  id: string;
  timestamp: string;
  author: string;
  content: string;
};

export type Stage2PiiSummary = {
  fullName: string;
  birthDate: string;
  phone: string;
  address: string;
  guardianName?: string;
  guardianPhone?: string;
  consentStatus: "진행 중" | "완료" | "갱신 필요";
  medicalHistory: string[];
  // backward compatibility
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
  bottleneckCode?: BottleneckCode;
  bottleneckMemo?: string;
  stage1EvidenceSummary: string[];
  neuropsychTest: NeuropsychSummary;
  clinicalEvalData: ClinicalSummary;
  specialistVisit: {
    status: StepStatus;
    summary: string;
    date?: string;
  };
  referral: {
    status: ReferralStatus;
    org?: string;
    contact?: string;
    schedule?: string;
    resultReceivedAt?: string;
    lastRequestedAt?: string;
    owner?: string;
  };
  diagnosis: {
    finalClass: Stage2Decision["finalClass"];
    mciSubtype: MciSubClass;
    confirmedBy?: string;
    confirmedAt?: string;
    rationale?: string;
  };
  followupTodos: Stage2FollowupTodo[];
  commLogs: Stage2CommLog[];
  neuropsychSummary: NeuropsychSummary;
  clinicalSummary: ClinicalSummary;
  branchPlan: BranchPlan;
  linkageStatuses: LinkageStatus[];
  followUpPlan: FollowUpPlan;
  auditEvents: Stage2AuditEvent[];
  readOnly?: boolean;
};
