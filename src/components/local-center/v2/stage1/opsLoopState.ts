import type { ContactEvent } from "./stage1Types";

export type DomainEventType =
  | "RESULT_RECEIVED"
  | "RESULT_VALIDATED"
  | "PLAN_CONFIRMED"
  | "INFERENCE_REQUESTED"
  | "INFERENCE_STARTED"
  | "INFERENCE_PROGRESS"
  | "INFERENCE_COMPLETED"
  | "CLASSIFICATION_CONFIRMED"
  | "NEXT_STEP_DECIDED"
  | "REFERRAL_CONFIRMED";

export type DomainEvent = {
  type: DomainEventType;
  at?: string;
  sourceType?: string;
  summary?: string;
};

export type OpsStage = "stage1" | "stage2" | "stage3";
export type OpsLoopStepStatus = "TODO" | "READY" | "DONE";
export type InferenceJobStatus = "PENDING" | "RUNNING" | "DONE" | "FAILED";

export type OpsLoopStep = {
  id: "STEP1" | "STEP2" | "STEP3" | "STEP4";
  label: string;
  status: OpsLoopStepStatus;
  reason: string;
  requiresHumanApproval?: boolean;
};

export type OpsLoopCurrentData = {
  stage: OpsStage;
  storedOpsStatus?: string | null;
  storedDoneCount?: number | null;
  hasPlanConfirmed?: boolean;
  hasResultReceived?: boolean;
  hasResultValidated?: boolean;
  hasModelResult?: boolean;
  inferenceStatus?: InferenceJobStatus;
  classificationConfirmed?: boolean;
  nextStepDecided?: boolean;
  referralConfirmed?: boolean;
};

export type OpsLoopState = {
  stage: OpsStage;
  steps: OpsLoopStep[];
  doneCount: number;
  readyCount: number;
  totalCount: number;
  mismatch: boolean;
  mismatchReasons: string[];
};

export type InferenceCaseData = {
  caseId?: string;
  stage?: string | number;
  jobStatus?: InferenceJobStatus;
  progress?: number | null;
  etaSeconds?: number | null;
  startedAt?: string | null;
  updatedAt?: string | null;
  completedAt?: string | null;
  hasResult?: boolean;
  nowMs?: number;
  minDurationSec?: number;
  maxDurationSec?: number;
};

export type InferenceState = {
  jobStatus: InferenceJobStatus;
  progress: number;
  etaSeconds: number | null;
  startedAt?: string;
  updatedAt?: string;
  completedAt?: string;
  buffered: boolean;
};

function clamp(value: number, min: number, max: number) {
  if (Number.isNaN(value)) return min;
  return Math.max(min, Math.min(max, value));
}

function hashSeed(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (Math.imul(31, hash) + value.charCodeAt(index)) | 0;
  }
  return hash >>> 0;
}

function inferDurationSec(input: InferenceCaseData) {
  const min = input.minDurationSec ?? 30;
  const max = input.maxDurationSec ?? 180;
  const normalizedMin = Math.max(5, Math.min(min, max));
  const normalizedMax = Math.max(normalizedMin, max);
  const seed = hashSeed(`${input.caseId ?? "CASE"}:${input.stage ?? "stage"}:${input.startedAt ?? "start"}`);
  return normalizedMin + (seed % (normalizedMax - normalizedMin + 1));
}

function mapStepStatus(
  done: boolean,
  ready: boolean,
  doneReason: string,
  readyReason: string,
  todoReason: string,
): { status: OpsLoopStepStatus; reason: string } {
  if (done) return { status: "DONE", reason: doneReason };
  if (ready) return { status: "READY", reason: readyReason };
  return { status: "TODO", reason: todoReason };
}

export function mapTimelineToEvents(timelineRows: ContactEvent[]): DomainEvent[] {
  const mapped: DomainEvent[] = [];

  const push = (type: DomainEventType, row: ContactEvent, summary?: string) => {
    mapped.push({
      type,
      at: row.at,
      sourceType: row.type,
      summary: summary ?? ("summary" in row ? row.summary : undefined),
    });
  };

  for (const row of timelineRows) {
    if (row.type === "STAGE2_PLAN_CONFIRMED") {
      push("PLAN_CONFIRMED", row);
      continue;
    }

    if (row.type === "RISK_REVIEWED") {
      push("PLAN_CONFIRMED", row);
      continue;
    }

    if (row.type === "STAGE2_RESULTS_RECORDED") {
      push("RESULT_RECEIVED", row);
      if (row.summary.includes("검증") || row.summary.includes("입력") || row.summary.includes("완료")) {
        push("RESULT_VALIDATED", row);
      }
      if (row.summary.includes("모델 산출 완료")) {
        push("INFERENCE_COMPLETED", row);
      }
      continue;
    }

    if (row.type === "STAGE2_STEP2_AUTOFILL_APPLIED") {
      push("RESULT_RECEIVED", row);
      continue;
    }

    if (row.type === "STAGE2_MANUAL_EDIT_APPLIED") {
      push("RESULT_RECEIVED", row);
      push("RESULT_VALIDATED", row);
      continue;
    }

    if (row.type === "DIFF_RESULT_APPLIED" || row.type === "REEVAL_COMPLETED") {
      push("RESULT_RECEIVED", row);
      push("RESULT_VALIDATED", row);
      continue;
    }

    if (row.type === "CALL_ATTEMPT") {
      push("RESULT_RECEIVED", row, row.note);
      continue;
    }

    if (row.type === "OUTCOME_RECORDED") {
      push("RESULT_VALIDATED", row, row.note);
      continue;
    }

    if (row.type === "STAGE2_CLASS_CONFIRMED") {
      push("CLASSIFICATION_CONFIRMED", row);
      continue;
    }

    if (row.type === "STAGE2_NEXT_STEP_SET") {
      push("NEXT_STEP_DECIDED", row);
      continue;
    }

    if (row.type === "LINKAGE_APPROVED" || row.type === "LINKAGE_COMPLETED") {
      push("REFERRAL_CONFIRMED", row);
      continue;
    }

    if (row.type === "PLAN_UPDATED" || row.type === "NEXT_TRACKING_SET") {
      push("NEXT_STEP_DECIDED", row);
      continue;
    }

    if (
      row.type === "INFERENCE_REQUESTED" ||
      row.type === "INFERENCE_STARTED" ||
      row.type === "INFERENCE_PROGRESS" ||
      row.type === "INFERENCE_COMPLETED" ||
      row.type === "INFERENCE_FAILED"
    ) {
      if (row.type === "INFERENCE_REQUESTED") push("INFERENCE_REQUESTED", row);
      if (row.type === "INFERENCE_STARTED") push("INFERENCE_STARTED", row);
      if (row.type === "INFERENCE_PROGRESS") push("INFERENCE_PROGRESS", row);
      if (row.type === "INFERENCE_COMPLETED") push("INFERENCE_COMPLETED", row);
      continue;
    }
  }

  return mapped;
}

export function computeOpsLoopState(events: DomainEvent[], currentData: OpsLoopCurrentData): OpsLoopState {
  const hasEvent = (type: DomainEventType) => events.some((event) => event.type === type);
  const stage = currentData.stage;

  const basePlanConfirmed = Boolean(currentData.hasPlanConfirmed || hasEvent("PLAN_CONFIRMED"));
  const baseResultReceived = Boolean(currentData.hasResultReceived || hasEvent("RESULT_RECEIVED"));
  const baseResultValidated = Boolean(currentData.hasResultValidated || hasEvent("RESULT_VALIDATED"));
  const inferenceRequested = hasEvent("INFERENCE_REQUESTED");
  const inferenceStarted = hasEvent("INFERENCE_STARTED");
  const inferenceProgress = hasEvent("INFERENCE_PROGRESS");
  const inferenceCompleted = Boolean(currentData.hasModelResult || hasEvent("INFERENCE_COMPLETED"));
  const classificationConfirmed = Boolean(currentData.classificationConfirmed || hasEvent("CLASSIFICATION_CONFIRMED"));
  const nextStepDecided = Boolean(currentData.nextStepDecided || hasEvent("NEXT_STEP_DECIDED"));
  const referralConfirmed = Boolean(currentData.referralConfirmed || hasEvent("REFERRAL_CONFIRMED"));
  const downstreamProgressed =
    baseResultReceived ||
    baseResultValidated ||
    inferenceRequested ||
    inferenceStarted ||
    inferenceProgress ||
    inferenceCompleted ||
    classificationConfirmed ||
    nextStepDecided ||
    referralConfirmed;
  const planConfirmed = basePlanConfirmed || downstreamProgressed;
  const planConfirmedInferred = !basePlanConfirmed && planConfirmed;
  const resultReceived =
    baseResultReceived ||
    baseResultValidated ||
    inferenceRequested ||
    inferenceStarted ||
    inferenceProgress ||
    inferenceCompleted ||
    classificationConfirmed ||
    nextStepDecided ||
    referralConfirmed;
  const resultValidated = baseResultValidated || inferenceCompleted || classificationConfirmed || nextStepDecided || referralConfirmed;
  const resultValidatedInferred = !baseResultValidated && resultValidated;
  const inferenceRunning =
    currentData.inferenceStatus === "RUNNING" ||
    inferenceStarted ||
    inferenceProgress ||
    (inferenceRequested && !inferenceCompleted);

  const labelsByStage: Record<OpsStage, [string, string, string, string]> = {
    stage1: ["사전 조건 확인", "결과 수집/입력", "분류/판단", "다음 단계 결정"],
    stage2: ["검사 수행 관리", "검사 결과 수신/검증", "분류 확정", "다음 단계 결정"],
    stage3: ["추적 기준선/플랜 확인", "검사 결과 수신/검증", "위험평가 검토", "연계/다음 조치 결정"],
  };
  const labels = labelsByStage[stage];

  const step1 = mapStepStatus(
    planConfirmed,
    false,
    planConfirmedInferred ? `${labels[0]} 후속 이벤트를 기준으로 자동 정합되었습니다.` : `${labels[0]} 단계가 확정되었습니다.`,
    `${labels[0]} 준비 완료`,
    `${labels[0]} 이벤트가 아직 없습니다.`,
  );
  const step2 = mapStepStatus(
    resultValidated,
    resultReceived,
    resultValidatedInferred ? `${labels[1]}가 후속 이벤트 기준으로 검증 완료 처리되었습니다.` : `${labels[1]}가 검증까지 완료되었습니다.`,
    `${labels[1]}는 완료됐고 검증 대기입니다.`,
    `${labels[1]}가 아직 수신되지 않았습니다.`,
  );
  const step3 = mapStepStatus(
    classificationConfirmed,
    inferenceCompleted || inferenceRunning || inferenceRequested,
    `${labels[2]}이 담당자 승인으로 확정되었습니다.`,
    inferenceCompleted
      ? "모델 결과가 생성되어 승인 대기(READY) 상태입니다."
      : inferenceRunning
        ? "모델 실행 중입니다. 완료 후 승인 가능합니다."
        : "모델 실행 요청이 접수되어 준비 중입니다.",
    `${labels[2]}에 필요한 모델 결과가 아직 없습니다.`,
  );
  const step4 = mapStepStatus(
    nextStepDecided,
    referralConfirmed,
    `${labels[3]}이 완료되었습니다.`,
    "연계/의뢰는 반영되었고 최종 결정 대기입니다.",
    `${labels[3]}이 아직 결정되지 않았습니다.`,
  );

  const steps: OpsLoopStep[] = [
    { id: "STEP1", label: labels[0], ...step1 },
    { id: "STEP2", label: labels[1], ...step2 },
    { id: "STEP3", label: labels[2], ...step3, requiresHumanApproval: true },
    { id: "STEP4", label: labels[3], ...step4, requiresHumanApproval: true },
  ];

  const doneCount = steps.filter((step) => step.status === "DONE").length;
  const readyCount = steps.filter((step) => step.status === "READY").length;

  const mismatchReasons: string[] = [];
  if (resultReceived && steps[1].status === "TODO") {
    mismatchReasons.push("결과 수신 이벤트가 있는데 Step2가 TODO입니다.");
  }
  if (inferenceCompleted && steps[2].status === "TODO") {
    mismatchReasons.push("모델 결과가 있는데 Step3가 TODO입니다.");
  }
  if (classificationConfirmed && steps[2].status !== "DONE") {
    mismatchReasons.push("분류 확정 이벤트가 있는데 Step3가 DONE이 아닙니다.");
  }
  if (nextStepDecided && steps[3].status !== "DONE") {
    mismatchReasons.push("다음 단계 결정 이벤트가 있는데 Step4가 DONE이 아닙니다.");
  }
  if (currentData.storedDoneCount != null && currentData.storedDoneCount !== doneCount) {
    mismatchReasons.push(`저장된 완료 단계(${currentData.storedDoneCount})와 계산값(${doneCount})이 다릅니다.`);
  }
  if (
    currentData.storedOpsStatus &&
    doneCount === 0 &&
    readyCount === 0 &&
    (planConfirmed || resultReceived || inferenceCompleted || classificationConfirmed)
  ) {
    mismatchReasons.push(`저장된 운영 상태(${currentData.storedOpsStatus}) 대비 계산 단계가 과도하게 낮습니다.`);
  }

  return {
    stage,
    steps,
    doneCount,
    readyCount,
    totalCount: steps.length,
    mismatch: mismatchReasons.length > 0,
    mismatchReasons,
  };
}

export function computeInferenceState(caseData: InferenceCaseData): InferenceState {
  const status = caseData.jobStatus ?? "PENDING";
  const hasResult = Boolean(caseData.hasResult);
  const startedAt = caseData.startedAt ?? undefined;
  const updatedAt = caseData.updatedAt ?? undefined;
  const completedAt = caseData.completedAt ?? undefined;

  if (hasResult || status === "DONE") {
    return {
      jobStatus: "DONE",
      progress: 100,
      etaSeconds: 0,
      startedAt,
      updatedAt,
      completedAt,
      buffered: false,
    };
  }

  if (status === "FAILED") {
    return {
      jobStatus: "FAILED",
      progress: clamp(caseData.progress ?? 0, 0, 99),
      etaSeconds: null,
      startedAt,
      updatedAt,
      completedAt,
      buffered: false,
    };
  }

  const durationSec = inferDurationSec(caseData);
  if (!startedAt) {
    return {
      jobStatus: status,
      progress: status === "RUNNING" ? 6 : 2,
      etaSeconds: caseData.etaSeconds ?? durationSec,
      startedAt,
      updatedAt,
      completedAt,
      buffered: true,
    };
  }

  const startMs = new Date(startedAt).getTime();
  const nowMs = caseData.nowMs ?? Date.now();
  const elapsedSec = Number.isNaN(startMs) ? 0 : Math.max(0, Math.round((nowMs - startMs) / 1000));
  const ratio = clamp(elapsedSec / durationSec, 0, 1);
  const eased = 1 - Math.exp(-3.2 * ratio);
  const synthetic = ratio >= 1 ? 95 : clamp(5 + eased * 88, 5, 95);
  const progress = clamp(Math.max(caseData.progress ?? 0, synthetic), 0, 99);
  const etaSeconds = caseData.etaSeconds ?? Math.max(5, durationSec - elapsedSec);

  return {
    jobStatus: status,
    progress,
    etaSeconds,
    startedAt,
    updatedAt,
    completedAt,
    buffered: caseData.progress == null || caseData.etaSeconds == null,
  };
}

export function formatEtaLabel(etaSeconds: number | null | undefined) {
  if (etaSeconds == null || Number.isNaN(etaSeconds)) return "ETA 계산 중";
  if (etaSeconds <= 0) return "곧 완료";
  const minutes = Math.floor(etaSeconds / 60);
  const seconds = etaSeconds % 60;
  if (minutes <= 0) return `${seconds}초`;
  return `${minutes}분 ${seconds.toString().padStart(2, "0")}초`;
}
