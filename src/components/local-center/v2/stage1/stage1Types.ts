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
export type ContactExecutor = "HUMAN" | "AGENT_SEND_ONLY";

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

export type OutcomeType =
  | "PROCEED"
  | "LATER"
  | "PROTECTOR_LINK"
  | "COUNSELOR_LINK"
  | "REJECT"
  | "NO_RESPONSE"
  | "HARD_TO_UNDERSTAND"
  | "EMOTIONAL";

export type RejectReasonCode =
  | "R1_SELF_REJECT"
  | "R2_GUARDIAN_REJECT"
  | "R3_OTHER_INSTITUTION"
  | "R4_ALREADY_DIAGNOSED"
  | "R5_CONTACT_INVALID"
  | "R6_EMOTIONAL_BACKLASH"
  | "R7_OTHER";

export type RejectLevel = "TEMP" | "FINAL";

export type RecontactStrategy =
  | "CALL_RETRY"
  | "SMS_RETRY"
  | "TIME_CHANGE"
  | "PROTECTOR_CONTACT"
  | "AGENT_SMS";

export type CalendarEventType = "RECONTACT" | "FOLLOWUP";

export interface CalendarEventDraft {
  caseId: string;
  type: CalendarEventType;
  title: string;
  startAt: string;
  durationMin?: number;
  priority?: "NORMAL" | "HIGH";
  payload?: Record<string, any>;
}

export type OutcomeSavePayload = {
  outcomeType: OutcomeType;
  memo?: string;
  reject?: {
    code: RejectReasonCode;
    level: RejectLevel;
    detail?: string;
    followup?: {
      createFollowupEvent?: boolean;
      followupAt?: string;
    };
  };
  noResponse?: {
    strategy: RecontactStrategy;
    nextContactAt: string;
    escalateLevel?: InterventionLevel;
  };
};

export type OutcomeSaveResponse = {
  ok: true;
  outcomeId: string;
  timelinePatch?: Record<string, unknown>;
  nextAction?: {
    type: "CREATE_CALENDAR_EVENT";
    events: CalendarEventDraft[];
  };
};

export type CalendarEventCreatePayload = {
  idempotencyKey: string;
  event: CalendarEventDraft;
};

export type CalendarEventCreateResponse = {
  ok: true;
  eventId: string;
};

export type HandoffMemo = {
  triggers: string[];
  lastContactSummary: string;
  currentOutcome: OutcomeCode;
  recommendedNextAction: string;
  generatedAt: string;
};

export type LinkageStatus = "NOT_CREATED" | "BOOKING_IN_PROGRESS" | "BOOKING_DONE" | "REFERRAL_CREATED";

export type FollowUpRoute =
  | "CENTER_VISIT_BOOKING"
  | "HOSPITAL_REFERRAL_BOOKING"
  | "COUNSELING_CENTER_BOOKING"
  | "HOLD_TRACKING";

export type ReservationInfo = {
  route: FollowUpRoute;
  reservationType: string;
  scheduledAt?: string;
  place?: string;
  contactGuide?: string;
  note?: string;
};

export type AgentContactResult = "SENT_SUCCESS" | "SENT_FAILED" | "NO_RESPONSE" | "WAITING";

export type AgentJobStatus = "IDLE" | "QUEUED" | "RUNNING" | "SUCCEEDED" | "FAILED" | "CANCELED";
export type ChannelResult = "SENT" | "DELIVERED" | "FAILED" | "UNKNOWN";
export type GateStatus = "PASS" | "NEEDS_CHECK" | "BLOCKED";

export type AgentExecutionLog = {
  id: string;
  at: string;
  result: AgentContactResult;
  summary: string;
  recommendationId?: string;
  recommendationTitle?: string;
  actor: string;
};

export type Stage3OpsStatus =
  | "TRACKING"
  | "REEVAL_DUE"
  | "REEVAL_PENDING"
  | "LINKAGE_PENDING"
  | "PLAN_NEEDS_UPDATE"
  | "CHURN_RISK"
  | "CLOSED";

export type Stage3PlanStatus = "ACTIVE" | "NEEDS_UPDATE" | "PAUSED";
export type Stage3ChurnRisk = "LOW" | "MID" | "HIGH";

export type Stage3HeaderMeta = {
  opsStatus: Stage3OpsStatus;
  nextReevalAt?: string;
  nextTrackingContactAt?: string;
  nextProgramAt?: string;
  planStatus: Stage3PlanStatus;
  trackingCycleDays: number;
  churnRisk: Stage3ChurnRisk;
};

export type Stage3RecommendedAction = {
  id: string;
  type: "SCHEDULE_REEVAL" | "SEND_REMINDER" | "UPDATE_PLAN" | "ESCALATE_LEVEL";
  title: string;
  reason: string;
  severity: "LOW" | "MID" | "HIGH";
  requiresApproval: boolean;
  decision: "PENDING" | "APPROVED" | "HOLD";
};

export type Stage3ReevalStatus = "PENDING" | "SCHEDULED" | "COMPLETED" | "NOSHOW";

export type Stage3RiskTrendPoint = {
  t: string;
  risk2y: number;
  ciLow?: number;
  ciHigh?: number;
  source?: "model" | "manual";
  event?: "DIFF_RESULT_APPLIED" | "PLAN_UPDATED" | "REEVAL";
};

export type Stage3RiskSummary = {
  risk2y_now: number;
  risk2y_label: "LOW" | "MID" | "HIGH";
  trend: "UP" | "DOWN" | "VOLATILE" | "FLAT";
  variabilityNote?: string;
  updatedAt: string;
  modelVersion: string;
  series: Stage3RiskTrendPoint[];
};

export type Stage3DiffPathStatus = "NONE" | "RECOMMENDED" | "REFERRED" | "SCHEDULED" | "COMPLETED";

export type Stage3ProgramExecutionStatus = "PLANNED" | "IN_PROGRESS" | "DONE" | "HOLD";

export type Stage3ProgramExecutionField = {
  owner: string;
  dueDate?: string;
  institution?: string;
  method?: "연계" | "예약" | "안내" | "교육" | "방문";
  status?: Stage3ProgramExecutionStatus;
  note?: string;
};

export type Stage3ProgramItem = {
  id: string;
  major: "정밀진료 정보" | "정밀 사례관리" | "치매지원서비스" | "가족/돌봄 지원";
  middle: string;
  leaf: string;
  pinned?: boolean;
  selected?: boolean;
  execution?: Stage3ProgramExecutionField;
};

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
      rejectCode?: RejectReasonCode;
      rejectLevel?: RejectLevel;
      recontactStrategy?: RecontactStrategy;
      nextContactAt?: string;
      outcomeId?: string;
      by: string;
    }
  | {
      type: "CALENDAR_SYNC";
      at: string;
      status: "SUCCESS" | "FAILED";
      eventType: CalendarEventType;
      title: string;
      scheduledAt: string;
      idempotencyKey: string;
      error?: string;
      by: string;
    }
  | {
      type: "AGENT_JOB_QUEUED";
      at: string;
      actor: "system" | "agent" | "operator";
      caseId: string;
      attemptNo: number;
      idempotencyKey: string;
      summary: string;
      detail?: string;
      by: string;
    }
  | {
      type: "AGENT_JOB_STARTED";
      at: string;
      actor: "system" | "agent" | "operator";
      caseId: string;
      attemptNo: number;
      idempotencyKey: string;
      summary: string;
      detail?: string;
      by: string;
    }
  | {
      type: "AGENT_SMS_SENT";
      at: string;
      actor: "system" | "agent" | "operator";
      caseId: string;
      attemptNo: number;
      idempotencyKey: string;
      channelResult: ChannelResult;
      summary: string;
      detail?: string;
      by: string;
    }
  | {
      type: "AGENT_JOB_SUCCEEDED";
      at: string;
      actor: "system" | "agent" | "operator";
      caseId: string;
      attemptNo: number;
      idempotencyKey: string;
      summary: string;
      detail?: string;
      by: string;
    }
  | {
      type: "AGENT_JOB_FAILED";
      at: string;
      actor: "system" | "agent" | "operator";
      caseId: string;
      attemptNo: number;
      idempotencyKey: string;
      summary: string;
      detail?: string;
      errorCode?: string;
      by: string;
    }
  | {
      type: "AGENT_JOB_CANCELED";
      at: string;
      actor: "system" | "agent" | "operator";
      caseId: string;
      attemptNo: number;
      idempotencyKey: string;
      summary: string;
      detail?: string;
      by: string;
    }
  | {
      type: "CONTACT_STRATEGY_CHANGED";
      at: string;
      actor: "system" | "agent" | "operator";
      caseId: string;
      summary: string;
      detail?: string;
      by: string;
    }
  | {
      type: "OPERATOR_OVERRIDE_TO_HUMAN";
      at: string;
      actor: "operator";
      caseId: string;
      summary: string;
      detail?: string;
      by: string;
    }
  | {
      type: "REEVAL_SCHEDULED";
      at: string;
      scheduledAt: string;
      by: string;
      reason?: string;
    }
  | {
      type: "REEVAL_RESCHEDULED";
      at: string;
      from?: string;
      to: string;
      by: string;
      reason?: string;
    }
  | {
      type: "REEVAL_COMPLETED";
      at: string;
      by: string;
      note?: string;
    }
  | {
      type: "REEVAL_NOSHOW";
      at: string;
      by: string;
      note?: string;
    }
  | {
      type: "PLAN_CREATED" | "PLAN_UPDATED";
      at: string;
      by: string;
      summary: string;
    }
  | {
      type: "PROGRAM_STARTED" | "PROGRAM_COMPLETED" | "PROGRAM_STOPPED";
      at: string;
      by: string;
      summary: string;
    }
  | {
      type: "LINKAGE_CREATED" | "LINKAGE_APPROVED" | "LINKAGE_COMPLETED";
      at: string;
      by: string;
      linkageType: "CENTER" | "HOSPITAL" | "COUNSELING";
      summary?: string;
    }
  | {
      type: "STAGE3_ACTION_DECISION";
      at: string;
      by: string;
      actionId: string;
      decision: "APPROVED" | "HOLD";
      note?: string;
    }
  | {
      type: "RISK_SERIES_UPDATED";
      at: string;
      by: string;
      summary: string;
    }
  | {
      type: "RISK_REVIEWED";
      at: string;
      by: string;
      summary: string;
    }
  | {
      type:
        | "DIFF_RECO_CREATED"
        | "DIFF_REFER_CREATED"
        | "DIFF_SCHEDULED"
        | "DIFF_COMPLETED"
        | "DIFF_RESULT_APPLIED";
      at: string;
      by: string;
      summary: string;
    }
  | {
      type: "PROGRAM_SELECTED" | "PROGRAM_EXEC_UPDATED" | "PROGRAM_EXEC_COMPLETED";
      at: string;
      by: string;
      summary: string;
    }
  | {
      type: "NEXT_TRACKING_SET";
      at: string;
      by: string;
      nextAt: string;
      summary?: string;
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
  contactExecutor: ContactExecutor;
  reservationInfo?: ReservationInfo;
  agentExecutionLogs: AgentExecutionLog[];
  stage3?: {
    headerMeta: Stage3HeaderMeta;
    transitionRisk: Stage3RiskSummary;
    reevalStatus: Stage3ReevalStatus;
    riskReviewedAt?: string;
    diffPathStatus: Stage3DiffPathStatus;
    triggersReviewedAt?: string;
    planProgressPct: number;
    planUpdatedAt?: string;
    recommendedActions: Stage3RecommendedAction[];
    programs: Stage3ProgramItem[];
  };
};
