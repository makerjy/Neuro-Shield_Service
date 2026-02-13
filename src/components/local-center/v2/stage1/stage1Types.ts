export type Stage = "STAGE1" | "STAGE2" | "STAGE3";

export type DataQualityLevel = "GOOD" | "WARN" | "EXCLUDE";
export type SlaLevel = "OK" | "DUE_SOON" | "OVERDUE";

export type PolicyGateKey =
  | "CONSENT_OK"
  | "CONTACTABLE_TIME_OK"
  | "PHONE_VERIFIED"
  | "GUARDIAN_OPTIONAL";

export type PolicyGate = {
  key: PolicyGateKey;
  label: string;
  status: "PASS" | "FAIL" | "UNKNOWN";
  failReason?: string;
  fixAction?: {
    label: string;
    action: "CONFIRM_CONTACT_TIME" | "REQUEST_CONSENT" | "VERIFY_PHONE" | "ADD_GUARDIAN";
  };
};

export type InterventionLevel = "L0" | "L1" | "L2" | "L3";

/* ── 접촉 전략 (사전 기준/룰 기반) ── */
export type RecommendedContactStrategy = "HUMAN_FIRST" | "AI_FIRST";
export type ContactStrategy = RecommendedContactStrategy | "MANUAL_OVERRIDE";

export type PreTriageInput = {
  age: number;
  dxHistory: {
    hasMCI: boolean;
    hasDementia: boolean;
  };
  contactHistory: {
    hasComplaint: boolean;
    hasRefusal: boolean;
    needsGuardian: boolean;
    comprehensionDifficultyFlag: boolean;
  };
  guardian: {
    exists: boolean;
    isPrimaryContact: boolean;
  };
  responseHistory: {
    smsResponseGood: boolean;
    callResponseGood: boolean;
    lastOutcome?: OutcomeCode;
  };
};

export type PreTriageResult = {
  strategy: RecommendedContactStrategy;
  triggers: string[];
  policyNote: string;
  confidence: "RULE";
};

export type ContactPlan = {
  channel: "SMS" | "CALL" | "HYBRID";
  templateId?: string;
  scheduledAt?: string;
  maxRetryPolicy: {
    maxRetries: number;
    intervalHours: number;
  };
};

export type ContactExecutionStatus =
  | "NOT_STARTED"
  | "SENT"
  | "WAITING_RESPONSE"
  | "RETRY_NEEDED"
  | "HANDOFF_TO_HUMAN"
  | "PAUSED"
  | "STOPPED"
  | "DONE";

export type ContactExecution = {
  status: ContactExecutionStatus;
  lastSentAt?: string;
  lastResponseAt?: string;
  lastOutcomeCode?: OutcomeCode;
  retryCount: number;
  handoffMemo?: HandoffMemo;
};

export type OutcomeCode =
  | "CONTINUE_SELF"
  | "SCHEDULE_LATER"
  | "REQUEST_GUARDIAN"
  | "REQUEST_HUMAN"
  | "REFUSE"
  | "NO_RESPONSE"
  | "CONFUSED"
  | "EMOTIONAL";

export type HandoffMemo = {
  triggers: string[];
  lastContactSummary: string;
  currentOutcome: OutcomeCode;
  recommendedNextAction: string;
  generatedAt: string;
};

export type LinkageStatus = "NOT_CREATED" | "BOOKING_IN_PROGRESS" | "BOOKING_DONE" | "REFERRAL_CREATED";

/* ── Contact Flow 단계 (Step A → F) ── */
export type ContactFlowStep = "PRE_TRIAGE" | "STRATEGY" | "COMPOSE" | "SEND" | "RESPONSE" | "OUTCOME";
export type ContactFlowStepStatus = "DONE" | "WAITING" | "MISSING" | "WARNING";

export type ContactFlowState = {
  step: ContactFlowStep;
  label: string;
  status: ContactFlowStepStatus;
  description: string;
};

export type CaseHeader = {
  caseId: string;
  stage: Stage;
  assigneeName: string;
  statusLabel: string;
  waitDays: number;
  sla: { level: SlaLevel; dueAt?: string };
  dataQuality: { level: DataQualityLevel; score: number; notes?: string[] };
  contactStrategy?: ContactStrategy;
  effectiveStrategy?: RecommendedContactStrategy;
  riskGuardrails?: string[];
};

export type RiskSignalEvidence = {
  topFactors: { title: string; description: string; recency: string; isMissing?: boolean }[];
  computedAt: string;
  version: string;
};

export type TodoItem = {
  id: string;
  title: string;
  priority: 1 | 2 | 3;
  status: "OPEN" | "DONE" | "SNOOZED" | "CANCELED";
  dueAt?: string;
  suggestedAction?: "CALL" | "SMS" | "SCHEDULE" | "VERIFY" | "HOLD" | "EXCLUDE";
};

export type ContactEvent =
  | {
      type: "CALL_ATTEMPT";
      at: string;
      result: "SUCCESS" | "NO_ANSWER" | "REJECTED" | "WRONG_NUMBER";
      note?: string;
      by: string;
    }
  | {
      type: "SMS_SENT";
      at: string;
      templateId: string;
      status: "DELIVERED" | "FAILED" | "PENDING";
      by: string;
    }
  | {
      type: "STATUS_CHANGE";
      at: string;
      from: string;
      to: string;
      reason: string;
      by: string;
    }
  | {
      type: "LEVEL_CHANGE";
      at: string;
      from: InterventionLevel;
      to: InterventionLevel;
      reason: string;
      by: string;
    }
  | {
      type: "POLICY_GATE_UPDATE";
      at: string;
      key: PolicyGateKey;
      status: "PASS" | "FAIL" | "UNKNOWN";
      by: string;
    }
  | {
      type: "STRATEGY_CHANGE";
      at: string;
      from: ContactStrategy;
      to: ContactStrategy;
      reason: string;
      by: string;
    }
  | {
      type: "OUTCOME_RECORDED";
      at: string;
      outcomeCode: OutcomeCode;
      note?: string;
      by: string;
    };

export type Stage1Detail = {
  header: CaseHeader;
  policyGates: PolicyGate[];
  interventionLevel: InterventionLevel;
  riskEvidence: RiskSignalEvidence;
  scoreSummary: { label: string; value: number; unit?: string; updatedAt: string; flags?: string[] }[];
  todos: TodoItem[];
  timeline: ContactEvent[];
  preTriageInput?: PreTriageInput;
  preTriageResult?: PreTriageResult;
  contactPlan?: ContactPlan;
  contactExecution: ContactExecution;
  contactFlowSteps: ContactFlowState[];
  linkageStatus: LinkageStatus;
};
