export type Stage = "STAGE1" | "STAGE2" | "STAGE3";

export type DataQualityLevel = "GOOD" | "WARN" | "EXCLUDE";
export type SlaLevel = "OK" | "DUE_SOON" | "OVERDUE";

export type PolicyGateKey =
  | "CONSENT_OK"
  | "PURPOSE_NOTICE_OK"
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
    action: "OPEN_NOTICE_SCRIPT" | "REQUEST_CONSENT" | "VERIFY_PHONE" | "ADD_GUARDIAN";
  };
};

export type InterventionLevel = "L0" | "L1" | "L2" | "L3";

export type CaseHeader = {
  caseId: string;
  stage: Stage;
  assigneeName: string;
  statusLabel: string;
  waitDays: number;
  sla: { level: SlaLevel; dueAt?: string };
  dataQuality: { level: DataQualityLevel; score: number; notes?: string[] };
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
    };

export type Stage1Detail = {
  header: CaseHeader;
  policyGates: PolicyGate[];
  interventionLevel: InterventionLevel;
  riskEvidence: RiskSignalEvidence;
  scoreSummary: { label: string; value: number; unit?: string; updatedAt: string; flags?: string[] }[];
  todos: TodoItem[];
  timeline: ContactEvent[];
};

