export type Stage3ActionType =
  | "create_reassessment"
  | "adjust_intensity"
  | "strengthen_referral"
  | "retry_contact"
  | "request_support"
  | "request_data_completion";

export type Stage3OperationalStatus =
  | "TRACKING"
  | "REEVAL_DUE"
  | "REEVAL_PENDING"
  | "LINKAGE_PENDING"
  | "CHURN_RISK"
  | "CLOSED";

export type Stage3PlanStatus = "ACTIVE" | "PAUSED" | "NEEDS_UPDATE";
export type Stage3ChurnRisk = "LOW" | "MID" | "HIGH";

export interface CaseStage3HeaderMeta {
  next_reval_at?: string;
  next_contact_at?: string;
  next_program_at?: string;
  plan_status: Stage3PlanStatus;
  tracking_cycle_days: number;
  churn_risk: Stage3ChurnRisk;
}

export type RecommendedAction = {
  id: string;
  type: "SCHEDULE_REEVAL" | "SEND_REMINDER" | "UPDATE_PLAN" | "ESCALATE_LEVEL";
  title: string;
  reason: string;
  severity: "LOW" | "MID" | "HIGH";
  requires_approval: boolean;
  decision?: "PENDING" | "APPROVED" | "HOLD";
};

export type TimelineEventType =
  | "CONTACT"
  | "MESSAGE"
  | "STATUS"
  | "REEVAL_SCHEDULED"
  | "REEVAL_COMPLETED"
  | "REEVAL_NOSHOW"
  | "PLAN_UPDATED"
  | "PROGRAM_STARTED"
  | "PROGRAM_STOPPED"
  | "LINKAGE_CREATED"
  | "LINKAGE_COMPLETED";

export type Stage3TimelineEvent = {
  id: string;
  at: string;
  type: TimelineEventType;
  title: string;
  detail?: string;
  actor: { name: string; type: "human" | "system" };
};

export type ConfidenceLevel = "LOW" | "MID" | "HIGH";

export interface TransitionPrediction {
  horizonMonths: 24;
  probability: number;
  generatedAt: string;
  confidence: ConfidenceLevel;
  intervalPct?: { low: number; high: number };
  topDrivers: {
    key: string;
    label: string;
    direction: "UP" | "DOWN";
    delta?: number;
    evidenceRef?: string;
  }[];
  trend?: { at: string; p: number }[];
}

export interface PredictionUiModel {
  prediction: TransitionPrediction;
  dataQualityPct: number;
  missingCount: number;
  warningCount: number;
  recommendedOps: { key: string; label: string; priority: "P0" | "P1" | "P2" }[];
}

export interface TransitionRiskSummary {
  level: "LOW" | "MID" | "HIGH";
  score: number;
  trend: "UP" | "DOWN" | "FLAT";
  activeSignals: { key: string; label: string; met: boolean }[];
}

export interface InterventionStatus {
  state: "NONE" | "IN_PROGRESS" | "DONE";
  lastActionAt?: string;
  nextActionDue?: string;
}

export interface Stage3WorkItem {
  id: string;
  priority: "P0" | "P1" | "P2";
  title: string;
  reason: string;
  estimatedTimeMin: number;
  completionCriteria: string[];
  action: { label: string; type: "CALL" | "MESSAGE" | "LINK" | "SCHEDULE" };
  actionType?: Stage3ActionType;
  payloadPreview?: Record<string, unknown>;
}

export type Stage3Case = {
  caseId: string;
  stage: 3;
  subject: {
    maskedName: string;
    age: number;
    maskedPhone?: string;
    pseudonymKey?: string;
  };
  owner: { name: string; role: "counselor" | "manager" | "director" };
  status: "in_progress" | "on_hold" | "completed" | "attrition_risk";
  operationalStatus: Stage3OperationalStatus;
  headerMeta: CaseStage3HeaderMeta;
  risk: {
    zone: "danger" | "watch" | "stable";
    intensity: "monthly" | "quarterly" | "biweekly";
    intensityReason: string;
    triggers: Array<{
      key: "score_drop" | "missing_exam" | "contact_fail" | "other";
      label: string;
      satisfied: boolean;
      currentValueText: string;
      thresholdText: string;
      lastUpdatedAt: string;
    }>;
  };
  metrics: {
    scoreZ?: number;
    scoreChangePct?: number;
    dataQualityPct?: number;
    contactSuccessRatePct?: number;
    contactFailStreak?: number;
    trendByQuarter: Array<{ quarter: string; value: number }>;
    threshold?: number;
  };
  prediction: TransitionPrediction;
  findings?: {
    mriSummary?: string;
    notes?: string;
  };
  ops: {
    nextCheckpointAt?: string;
    lastContactAt?: string;
    lastAssessmentAt?: string;
    recommended_actions: RecommendedAction[];
    recommendedActions: Array<{
      id: string;
      priority: 0 | 1 | 2;
      title: string;
      reasonChips: string[];
      dueInDays?: number;
      actionType: Stage3ActionType;
      payloadPreview: Record<string, unknown>;
    }>;
  };
  audit: Array<{
    at: string;
    actor: { name: string; type: "human" | "system" };
    message: string;
    logId: string;
    severity?: "info" | "warn";
  }>;
  timeline: Stage3TimelineEvent[];
  communication: {
    history: Array<{
      id: string;
      at: string;
      channel: "call" | "sms";
      result: "success" | "fail";
      reasonTag: "부재중" | "번호오류" | "시간대부적절" | "보호자연락필요" | "수신거부";
      note?: string;
    }>;
    recommendedTimeSlot?: string;
  };
  referral: {
    organization: string;
    status: "not_started" | "in_progress" | "done";
    updatedAt?: string;
    ownerNote?: string;
  };
};

export type ExecuteActionBody = {
  actionType: Stage3ActionType;
  payload: Record<string, unknown>;
};

export type ExecuteActionResult = {
  updatedCase: Stage3Case;
  newAuditLog: Stage3Case["audit"][number];
};

export type SupportRequestBody = {
  reason: string;
  requester: string;
};

export type SupportRequestResult = {
  updatedCase: Stage3Case;
  newAuditLog: Stage3Case["audit"][number];
};
