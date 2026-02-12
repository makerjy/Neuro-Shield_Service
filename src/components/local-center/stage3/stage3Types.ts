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
  findings?: {
    mriSummary?: string;
    notes?: string;
  };
  ops: {
    nextCheckpointAt?: string;
    lastContactAt?: string;
    lastAssessmentAt?: string;
    recommendedActions: Array<{
      id: string;
      priority: 0 | 1 | 2;
      title: string;
      reasonChips: string[];
      dueInDays?: number;
      actionType:
        | "create_reassessment"
        | "adjust_intensity"
        | "strengthen_referral"
        | "retry_contact"
        | "request_support";
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
  actionType:
    | "create_reassessment"
    | "adjust_intensity"
    | "strengthen_referral"
    | "retry_contact"
    | "request_support";
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
