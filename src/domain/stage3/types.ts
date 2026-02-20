export type Stage3ModelStatus = "NOT_READY" | "QUEUED" | "RUNNING" | "READY" | "FAILED";

export type Stage3LoopStatus = "IN_PROGRESS" | "ON_HOLD" | "EXCLUDED" | "DONE";

export type Stage3LoopStep = 1 | 2 | 3 | 4;

export type Stage3ModelResult = {
  risk_1y_ad?: number;
  risk_2y_ad: number;
  risk_3y_ad?: number;
  computedAt: string;
  modelVersion: string;
  evidence?: string[];
};

export type Stage3CaseType = "PREVENTIVE_TRACKING" | "AD_MANAGEMENT";
export type Stage3OriginStage2Result = "MCI-MID" | "MCI-HIGH" | "AD";

export type Stage3Case = {
  caseId: string;
  updatedAt?: string;
  model: {
    status: Stage3ModelStatus;
    result: Stage3ModelResult | null;
  };
  profile?: {
    stage3Type: Stage3CaseType;
    originStage2Result: Stage3OriginStage2Result;
    originRiskScore: number;
  };
  loop: {
    step: Stage3LoopStep;
    completed: {
      step1At?: string;
      step2At?: string;
      step3At?: string;
      step4At?: string;
    };
    status: Stage3LoopStatus;
    blockers: string[];
  };
};

export type Stage3ReconcilePolicy = {
  autoCompleteStep1: boolean;
};

export type Stage3ReconcilePatchCode = "P1" | "P2" | "P3" | "P4" | "P5";

export type Stage3ReconcilePatch = {
  code: Stage3ReconcilePatchCode;
  path: string;
  message: string;
  from?: unknown;
  to?: unknown;
};

export type Stage3ReconcileAuditLog = {
  at: string;
  actor: "system";
  message: string;
  kind: "AUTO_STEP1_COMPLETED";
};

export type Stage3ReconcileResult = {
  nextCase: Stage3Case;
  patches: Stage3ReconcilePatch[];
  inconsistencyFlags: string[];
  auditLog?: Stage3ReconcileAuditLog;
};

export type Stage3StepCardState = "LOCKED" | "TODO" | "IN_PROGRESS" | "DONE";

export type Stage3StepCard = {
  step: Stage3LoopStep;
  title: string;
  subtitle: string;
  state: Stage3StepCardState;
  reason: string;
  canOpen: boolean;
};

export type Stage3ViewModel = {
  caseId: string;
  source: Stage3Case;
  display: {
    modelBadge: {
      label: string;
      status: Stage3ModelStatus;
      tone: "neutral" | "warning" | "success" | "danger";
    };
    riskBadge:
      | {
          kind: "ready";
          label: string;
          riskPct: number;
          modelVersion: string;
          computedAt: string;
          tone: "neutral" | "warning" | "success" | "danger";
        }
      | {
          kind: "pending";
          label: string;
          reason: string;
          tone: "neutral" | "warning" | "success" | "danger";
        };
    loopProgress: {
      done: number;
      total: number;
      text: string;
    };
    trackingStatus: "안정" | "악화" | "이탈 위험";
    intensity: "일반" | "집중" | "긴급";
    stepCards: Stage3StepCard[];
    inconsistencyFlags: string[];
    warnings: string[];
    primaryCta: {
      label: string;
      step: Stage3LoopStep | null;
      reason: string;
    };
  };
  meta: {
    lastUpdatedAt?: string;
  };
};
