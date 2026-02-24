import type { Stage2Diagnosis } from "../../../stage2/stage2Types";

export type Stage2PlanRoute = "HOSPITAL_REFERRAL" | "CENTER_DIRECT";

export type Stage2PlanRequiredDraft = {
  specialist: boolean;
  mmse: boolean;
  cdrOrGds: boolean;
  neuroCognitive: boolean;
};

export type Stage2FieldErrorKey =
  | "step1StrategyMemo"
  | "step1Consent"
  | "step1Plan"
  | "manualEditReason"
  | "mmse"
  | "cdr"
  | "neuro"
  | "specialist"
  | "classification"
  | "rationale"
  | "overrideReason"
  | "nextStep";

export type Stage2FieldErrors = Partial<Record<Stage2FieldErrorKey, string>>;

export function computeStage2RequiredChecks(route: Stage2PlanRoute, required: Stage2PlanRequiredDraft) {
  return {
    specialist: required.specialist,
    mmse: required.mmse && route === "HOSPITAL_REFERRAL",
    cdrOrGds: required.cdrOrGds,
    neuroCognitive: required.neuroCognitive,
  };
}

export function computeStage2MissingFields(
  tests: Stage2Diagnosis["tests"],
  route: Stage2PlanRoute,
  required: Stage2PlanRequiredDraft,
) {
  const checks = computeStage2RequiredChecks(route, required);
  const missing: Stage2FieldErrorKey[] = [];
  const hasMmse = typeof tests.mmse === "number" && Number.isFinite(tests.mmse);
  const hasCdr = typeof tests.cdr === "number" && Number.isFinite(tests.cdr);
  if (checks.mmse && !hasMmse) missing.push("mmse");
  if (checks.cdrOrGds && !hasCdr) missing.push("cdr");
  if (checks.neuroCognitive && !tests.neuroCognitiveType) missing.push("neuro");
  if (checks.specialist && !tests.specialist) missing.push("specialist");
  return missing;
}

export function buildStage2ValidationErrors(
  tests: Stage2Diagnosis["tests"],
  route: Stage2PlanRoute,
  required: Stage2PlanRequiredDraft,
  options?: {
    strategyMemo?: string;
    consentConfirmed?: boolean;
    rationale?: string;
    recommendedLabel?: "정상" | "MCI" | "치매";
    selectedLabel?: "정상" | "MCI" | "치매";
    overrideReason?: string;
    requireNextStep?: boolean;
    hasNextStep?: boolean;
    skipTestChecks?: boolean;
  },
): Stage2FieldErrors {
  const errors: Stage2FieldErrors = {};
  if (!options?.skipTestChecks) {
    const missing = computeStage2MissingFields(tests, route, required);
    for (const key of missing) {
      if (key === "mmse") errors.mmse = "MMSE 점수를 입력하세요.";
      if (key === "cdr") errors.cdr = "CDR 또는 GDS 점수를 입력하세요.";
      if (key === "neuro") errors.neuro = "신경인지검사 유형을 선택하세요.";
      if (key === "specialist") errors.specialist = "전문의 소견 완료 여부를 확인하세요.";
    }
    if (typeof tests.mmse === "number" && Number.isFinite(tests.mmse) && (tests.mmse < 0 || tests.mmse > 30)) {
      errors.mmse = "MMSE 점수는 0~30 범위로 입력하세요.";
    }
    if (typeof tests.cdr === "number" && Number.isFinite(tests.cdr) && (tests.cdr < 0 || tests.cdr > 7)) {
      errors.cdr = "CDR/GDS 점수는 0~7 범위로 입력하세요.";
    }
  }

  if (options?.strategyMemo != null && options.strategyMemo.trim().length < 20) {
    errors.step1StrategyMemo = "전략 메모를 20자 이상 입력하세요.";
  }
  if (options?.consentConfirmed === false) {
    errors.step1Consent = "Stage1 결과/동의 정보 확인이 필요합니다.";
  }
  if (options?.rationale != null && options.rationale.trim().length === 0) {
    errors.rationale = "확정 근거를 입력하세요.";
  }
  if (
    options?.recommendedLabel &&
    options?.selectedLabel &&
    options.recommendedLabel !== options.selectedLabel &&
    (!options.overrideReason || options.overrideReason.trim().length === 0)
  ) {
    errors.overrideReason = "모델 추천과 다르게 확정하려면 사유가 필요합니다.";
  }
  if (options?.requireNextStep && !options?.hasNextStep) {
    errors.nextStep = "다음 단계를 1개 선택하세요.";
  }
  return errors;
}

export function countStage2MissingByPlan(
  tests: Stage2Diagnosis["tests"],
  route: Stage2PlanRoute,
  required: Stage2PlanRequiredDraft,
) {
  return computeStage2MissingFields(tests, route, required).length;
}

export function deriveStage2ModelRecommendation(tests: Stage2Diagnosis["tests"]): "정상" | "MCI" | "치매" {
  const mmse = typeof tests.mmse === "number" ? tests.mmse : null;
  const cdr = typeof tests.cdr === "number" ? tests.cdr : null;

  if ((mmse != null && mmse <= 20) || (cdr != null && cdr >= 2)) return "치매";
  if ((mmse != null && mmse <= 25) || (cdr != null && cdr >= 0.5)) return "MCI";
  return "정상";
}

export function deriveStage2ModelStatus(
  missingCount: number,
  hasBooking: boolean,
  hasReceivedAt: boolean,
): "WAITING" | "REQUESTED" | "PARTIAL" | "VERIFY_NEEDED" | "READY" {
  if (!hasBooking) return "WAITING";
  if (!hasReceivedAt) return "REQUESTED";
  if (missingCount > 0) return "PARTIAL";
  return "VERIFY_NEEDED";
}
