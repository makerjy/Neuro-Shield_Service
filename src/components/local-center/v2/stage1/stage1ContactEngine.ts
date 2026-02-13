import type {
  ContactExecution,
  ContactExecutionStatus,
  ContactPlan,
  LinkageStatus,
  OutcomeCode,
  PreTriageInput,
  PreTriageResult,
  RecommendedContactStrategy,
} from "./stage1Types";

export const VULNERABLE_TRIGGER_CODES = [
  "AGE_OVER_THRESHOLD",
  "HAS_MCI_HISTORY",
  "HAS_DEMENTIA_HISTORY",
  "HAS_COMPLAINT_HISTORY",
  "HAS_REFUSAL_HISTORY",
  "GUARDIAN_PRIMARY",
  "COMPREHENSION_DIFFICULTY",
] as const;

const VULNERABLE_TRIGGER_SET = new Set<string>(VULNERABLE_TRIGGER_CODES);

export function derivePreTriageResultByRule(input: PreTriageInput): PreTriageResult {
  const triggers: string[] = [];

  if (input.age >= 80) triggers.push("AGE_OVER_THRESHOLD");
  if (input.dxHistory.hasMCI) triggers.push("HAS_MCI_HISTORY");
  if (input.dxHistory.hasDementia) triggers.push("HAS_DEMENTIA_HISTORY");
  if (input.contactHistory.hasComplaint) triggers.push("HAS_COMPLAINT_HISTORY");
  if (input.contactHistory.hasRefusal) triggers.push("HAS_REFUSAL_HISTORY");
  if (input.guardian.isPrimaryContact) triggers.push("GUARDIAN_PRIMARY");
  if (input.contactHistory.needsGuardian) triggers.push("NEEDS_GUARDIAN_SUPPORT");
  if (input.contactHistory.comprehensionDifficultyFlag) triggers.push("COMPREHENSION_DIFFICULTY");

  if (triggers.length === 0) {
    triggers.push("STANDARD_CONTACT_PATH");
  }

  const strategy: RecommendedContactStrategy = triggers.some((trigger) => VULNERABLE_TRIGGER_SET.has(trigger))
    ? "HUMAN_FIRST"
    : "AI_FIRST";

  const policyNote = strategy === "HUMAN_FIRST"
    ? "취약군 보호 정책이 적용되어 상담사 우선 접촉이 권고됩니다. 최종 실행은 담당자가 확인 후 진행합니다."
    : "사전 기준(룰)에서 자동 안내/응답 수집 우선이 적합합니다. 필요 시 담당자가 상담사 우선으로 전환할 수 있습니다.";

  return { strategy, triggers, policyNote, confidence: "RULE" };
}

export function hasVulnerableTrigger(triggers: string[]): boolean {
  return triggers.some((trigger) => VULNERABLE_TRIGGER_SET.has(trigger));
}

export type OutcomeTransitionResult = {
  executionStatus: ContactExecutionStatus;
  retryCount: number;
  linkageStatus: LinkageStatus;
  contactPlan?: ContactPlan;
  requiresHandoffMemo: boolean;
  recommendedNextAction: string;
  recontactAfterHours: number;
  switchedToHybrid: boolean;
};

export function deriveOutcomeTransition({
  outcomeCode,
  execution,
  linkageStatus,
  contactPlan,
}: {
  outcomeCode: OutcomeCode;
  execution: ContactExecution;
  linkageStatus: LinkageStatus;
  contactPlan?: ContactPlan;
}): OutcomeTransitionResult {
  const handoffRequired =
    outcomeCode === "REQUEST_HUMAN" ||
    outcomeCode === "REQUEST_GUARDIAN" ||
    outcomeCode === "CONFUSED" ||
    outcomeCode === "EMOTIONAL";

  let executionStatus: ContactExecutionStatus = execution.status;
  if (outcomeCode === "CONTINUE_SELF") executionStatus = "DONE";
  if (outcomeCode === "SCHEDULE_LATER") executionStatus = "WAITING_RESPONSE";
  if (outcomeCode === "NO_RESPONSE") executionStatus = "RETRY_NEEDED";
  if (outcomeCode === "REFUSE") executionStatus = "STOPPED";
  if (handoffRequired) executionStatus = "HANDOFF_TO_HUMAN";

  const retryCount = outcomeCode === "NO_RESPONSE" ? execution.retryCount + 1 : execution.retryCount;

  let nextLinkageStatus: LinkageStatus = linkageStatus;
  let recommendedNextAction = "상태 확인";
  if (outcomeCode === "CONTINUE_SELF") {
    nextLinkageStatus = linkageStatus === "BOOKING_IN_PROGRESS" ? "BOOKING_DONE" : "BOOKING_IN_PROGRESS";
    recommendedNextAction = nextLinkageStatus === "BOOKING_DONE" ? "예약 상태 확인 후 종료 검토" : "예약 생성 안내";
  } else if (outcomeCode === "SCHEDULE_LATER") {
    nextLinkageStatus = "BOOKING_IN_PROGRESS";
    recommendedNextAction = "재연락 일정 등록";
  } else if (handoffRequired) {
    nextLinkageStatus = "REFERRAL_CREATED";
    recommendedNextAction = "상담사 인계 및 보호자/본인 직접 연락";
  } else if (outcomeCode === "REFUSE") {
    nextLinkageStatus = "NOT_CREATED";
    recommendedNextAction = "재접촉 제한 정책 확인";
  } else if (outcomeCode === "NO_RESPONSE") {
    recommendedNextAction = "재시도 일정 조정";
  }

  let nextPlan = contactPlan;
  if (nextPlan && outcomeCode === "SCHEDULE_LATER") {
    nextPlan = { ...nextPlan };
  }

  let switchedToHybrid = false;
  if (nextPlan && outcomeCode === "NO_RESPONSE" && retryCount >= 2 && nextPlan.channel !== "HYBRID") {
    nextPlan = { ...nextPlan, channel: "HYBRID" };
    switchedToHybrid = true;
  }

  const recontactAfterHours =
    outcomeCode === "SCHEDULE_LATER" ? 72 : outcomeCode === "NO_RESPONSE" ? 24 : outcomeCode === "REFUSE" ? 168 : 48;

  return {
    executionStatus,
    retryCount,
    linkageStatus: nextLinkageStatus,
    contactPlan: nextPlan,
    requiresHandoffMemo: handoffRequired,
    recommendedNextAction,
    recontactAfterHours,
    switchedToHybrid,
  };
}
