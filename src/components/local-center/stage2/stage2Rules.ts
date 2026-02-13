import type {
  BottleneckCode,
  MciSubClass,
  Stage2CaseDetailData,
  Stage2Class,
  Stage2StepKey,
} from "./stage2Types";

export type Stage2NextActionSeverity = "HIGH" | "MID" | "LOW";

export type Stage2NextAction = {
  label: string;
  actionId:
    | "OPEN_STEP2_NEURO"
    | "OPEN_STEP3_CLINICAL"
    | "OPEN_STEP4_SPECIALIST"
    | "OPEN_REFERRAL"
    | "OPEN_DIAGNOSIS_CONFIRM"
    | "OPEN_FOLLOWUP_PLAN"
    | "OPEN_COMMUNICATION"
    | "OPEN_WORKBOARD";
  reason: string;
  severity: Stage2NextActionSeverity;
  step?: Stage2StepKey;
};

function hasDiagnosisRationale(caseData: Stage2CaseDetailData): boolean {
  const diagnosisRationale = caseData.diagnosis.rationale?.trim() ?? "";
  const decisionRationale = caseData.decision.rationaleSummary?.trim() ?? "";
  return diagnosisRationale.length > 0 || decisionRationale.length > 0;
}

export function getMissingRequirements(caseData: Stage2CaseDetailData): string[] {
  const missing: string[] = [];
  if (caseData.steps.neuropsych.status !== "DONE") {
    missing.push("2차 1단계 결과 미입력");
  }
  if (caseData.steps.clinicalEval.status !== "DONE") {
    missing.push("2차 2단계 임상평가 미완료");
  }
  if (caseData.steps.specialist.status !== "DONE") {
    missing.push("전문의 진찰 문서 없음");
  }
  if (!hasDiagnosisRationale(caseData)) {
    missing.push("확정 근거 1줄 미입력");
  }
  return missing;
}

export function canConfirmDiagnosis(caseData: Stage2CaseDetailData): boolean {
  return getMissingRequirements(caseData).length === 0;
}

function classNeedsReferral(decisionClass: Stage2Class, mciSubClass: MciSubClass): boolean {
  return (
    decisionClass === "DEMENTIA" ||
    (decisionClass === "MCI" && mciSubClass === "HIGH_RISK")
  );
}

export function deriveBottleneck(caseData: Stage2CaseDetailData): BottleneckCode | null {
  if (caseData.bottleneckCode && caseData.bottleneckCode !== "NONE") {
    return caseData.bottleneckCode;
  }

  if (caseData.referral.status === "DELAYED" || caseData.referral.status === "RE_REQUESTED") {
    return "HOSPITAL_DELAY";
  }

  const hasNoResponseLog = caseData.commLogs.some((log) =>
    /(무응답|연락 불가|미응답)/.test(log.result) || /(무응답|연락 불가|미응답)/.test(log.note ?? ""),
  );
  if (hasNoResponseLog) {
    return "NO_RESPONSE";
  }

  if (
    caseData.followUp.reservationStatus === "NOT_REGISTERED" ||
    caseData.referral.status === "BEFORE_REFERRAL"
  ) {
    return "RESERVATION_PENDING";
  }

  if (getMissingRequirements(caseData).length > 0) {
    return "MISSING_DOCS";
  }

  return null;
}

function bottleneckAction(code: BottleneckCode | undefined): Stage2NextAction | null {
  if (!code || code === "NONE") return null;
  if (code === "RESERVATION_PENDING") {
    return {
      label: "예약 확정",
      actionId: "OPEN_REFERRAL",
      reason: "병목코드가 예약 미완료로 설정되어 일정 확정이 우선입니다.",
      severity: "HIGH",
      step: "specialist",
    };
  }
  if (code === "HOSPITAL_DELAY") {
    return {
      label: "결과 재요청",
      actionId: "OPEN_REFERRAL",
      reason: "병원 회신 지연으로 결과 수신 재요청이 필요합니다.",
      severity: "HIGH",
      step: "specialist",
    };
  }
  if (code === "NO_RESPONSE") {
    return {
      label: "다음 접촉 계획",
      actionId: "OPEN_COMMUNICATION",
      reason: "대상자 미응답 병목으로 연락 채널 재설정이 필요합니다.",
      severity: "MID",
      step: "specialist",
    };
  }
  if (code === "OTHER") {
    return {
      label: "작업 사유 확인",
      actionId: "OPEN_WORKBOARD",
      reason: "기타 병목 사유를 확인하고 다음 실행을 정리해야 합니다.",
      severity: "MID",
    };
  }
  return {
    label: "자료 보완",
    actionId: "OPEN_WORKBOARD",
    reason: "자료 누락 병목이 있어 누락 항목 보완이 필요합니다.",
    severity: "HIGH",
  };
}

export function computeNextAction(caseData: Stage2CaseDetailData): Stage2NextAction {
  const effectiveBottleneck = deriveBottleneck(caseData) ?? caseData.bottleneckCode;
  const fromBottleneck = bottleneckAction(effectiveBottleneck ?? undefined);
  if (fromBottleneck) return fromBottleneck;

  if (caseData.steps.neuropsych.status !== "DONE") {
    return {
      label: "결과 입력",
      actionId: "OPEN_STEP2_NEURO",
      reason: "분류 확정 전 2차 1단계 신경심리검사 완료가 필요합니다.",
      severity: "HIGH",
      step: "neuropsych",
    };
  }
  if (caseData.steps.clinicalEval.status !== "DONE") {
    return {
      label: "결과 입력",
      actionId: "OPEN_STEP3_CLINICAL",
      reason: "분류 미확정 상태로 Step3 입력이 우선입니다.",
      severity: "HIGH",
      step: "clinicalEval",
    };
  }
  if (caseData.steps.specialist.status !== "DONE") {
    return {
      label: "예약 확정",
      actionId: "OPEN_STEP4_SPECIALIST",
      reason: "전문의 진찰 기록 전에는 담당자 확정을 진행할 수 없습니다.",
      severity: "HIGH",
      step: "specialist",
    };
  }
  if (caseData.decision.class === "UNCONFIRMED") {
    return {
      label: "분류 확정",
      actionId: "OPEN_DIAGNOSIS_CONFIRM",
      reason: "필수 단계가 완료되어 분류 확정 작업을 진행할 수 있습니다.",
      severity: "HIGH",
      step: "specialist",
    };
  }
  if (
    classNeedsReferral(caseData.decision.class, caseData.decision.mciSubClass) &&
    caseData.referral.status !== "RESULT_RECEIVED" &&
    caseData.referral.status !== "RESERVATION_CONFIRMED"
  ) {
    return {
      label: "연계/예약 실행",
      actionId: "OPEN_REFERRAL",
      reason: "위험/치매 분기에서는 감별검사 연계가 최우선입니다.",
      severity: "HIGH",
      step: "specialist",
    };
  }
  if (caseData.followupTodos.some((todo) => todo.status !== "DONE")) {
    return {
      label: "다음 접촉 계획",
      actionId: "OPEN_FOLLOWUP_PLAN",
      reason: "분류에 따른 후속조치 To-do가 남아 있습니다.",
      severity: "MID",
    };
  }
  return {
    label: "오늘 할 일 점검",
    actionId: "OPEN_WORKBOARD",
    reason: "핵심 단계가 완료되어 운영 기록 점검이 필요합니다.",
    severity: "LOW",
  };
}
