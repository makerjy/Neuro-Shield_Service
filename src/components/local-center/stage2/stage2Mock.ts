import {
  generateCases,
  maskPhone,
  type Case,
  type SecondExamStatus,
} from "../caseData";
import type {
  FollowUpState,
  MciSubClass,
  Stage2AuditLogItem,
  Stage2CaseDetailData,
  Stage2ChecklistItem,
  Stage2Class,
  Stage2Decision,
  Stage2MemoItem,
  Stage2StepKey,
  Stage2Steps,
  Stage2TimelineItem,
  StepStatus,
} from "./stage2Types";

function seeded(seed: string): number {
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (Math.imul(31, hash) + seed.charCodeAt(index)) | 0;
  }
  return ((hash >>> 0) % 10000) / 10000;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function toDateTime(date: string, seed: string): string {
  const hour = 9 + Math.floor(seeded(`${seed}-hour`) * 9);
  const minute = Math.floor(seeded(`${seed}-minute`) * 6) * 10;
  return `${date} ${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function countMissing(baseCase: Case): number {
  let missing = 0;
  if (baseCase.secondExamStatus === "NONE") missing += 1;
  if (baseCase.contactStatus === "UNREACHED") missing += 1;
  if (!baseCase.guardianPhone) missing += 1;
  if (!baseCase.reservation) missing += 1;
  if (baseCase.autoMemo.lines.some((line) => line.includes("누락"))) missing += 1;
  return clamp(missing, 0, 5);
}

function neuroReliability(missingCount: number): "OK" | "CAUTION" | "LOW" {
  if (missingCount >= 3) return "LOW";
  if (missingCount >= 1) return "CAUTION";
  return "OK";
}

function healthStatus(baseCase: Case): StepStatus {
  return baseCase.registeredDate ? "DONE" : "MISSING";
}

function neuroStatus(baseCase: Case): StepStatus {
  if (baseCase.secondExamStatus === "NONE") return "MISSING";
  if (baseCase.secondExamStatus === "SCHEDULED") return "PENDING";
  return "DONE";
}

function clinicalStatus(baseCase: Case): StepStatus {
  if (baseCase.secondExamStatus === "RESULT_CONFIRMED") return "DONE";
  if (baseCase.secondExamStatus === "DONE") {
    return seeded(`${baseCase.id}-clinical`) > 0.35 ? "DONE" : "INPUT_REQUIRED";
  }
  if (baseCase.secondExamStatus === "SCHEDULED") return "INPUT_REQUIRED";
  return "MISSING";
}

function specialistStatus(baseCase: Case): StepStatus {
  if (baseCase.secondExamStatus === "RESULT_CONFIRMED") return "DONE";
  if (baseCase.secondExamStatus === "DONE") {
    return seeded(`${baseCase.id}-specialist`) > 0.4 ? "DONE" : "PENDING";
  }
  if (baseCase.secondExamStatus === "SCHEDULED") return "PENDING";
  return "MISSING";
}

function toWorkStatus(baseCase: Case): "WAITING" | "IN_PROGRESS" | "DONE" {
  if (baseCase.secondExamStatus === "RESULT_CONFIRMED") return "DONE";
  if (baseCase.secondExamStatus === "DONE" || baseCase.secondExamStatus === "SCHEDULED") return "IN_PROGRESS";
  return "WAITING";
}

function deriveClassFromRisk(baseCase: Case): Exclude<Stage2Class, "UNCONFIRMED"> {
  const risk = baseCase.riskScore;
  if (risk >= 82 || (baseCase.riskLevel === "high" && seeded(`${baseCase.id}-risk-class`) > 0.62)) {
    return "DEMENTIA";
  }
  if (risk >= 48 || baseCase.riskLevel !== "low") {
    return "MCI";
  }
  return "NORMAL";
}

function deriveMciSubclass(baseCase: Case): MciSubClass {
  const score = baseCase.riskScore;
  if (score >= 76) return "HIGH_RISK";
  if (score >= 62) return "MODERATE";
  return "MILD_OK";
}

function confidenceNote(steps: Stage2Steps): Stage2Decision["confidenceNote"] {
  const reliability = steps.neuropsych.reliability;
  if (reliability === "LOW") return "LOW";
  if (reliability === "CAUTION") return "CAUTION";
  return "N/A";
}

function canConfirmDecision(steps: Stage2Steps): boolean {
  return steps.clinicalEval.status === "DONE" && steps.specialist.status === "DONE";
}

function mapEvidence(baseCase: Case, steps: Stage2Steps, classLabel: Stage2Class): string[] {
  const lines: string[] = [];
  if (steps.healthCheck.date) {
    lines.push(`건강검진 데이터 ${steps.healthCheck.date} 업데이트 반영`);
  }
  lines.push(steps.neuropsych.summary ?? "2차 1단계 요약 없음");
  lines.push(
    steps.clinicalEval.status === "DONE"
      ? `2차 2단계 체크리스트 ${steps.clinicalEval.checklistCount ?? 0}개 입력 완료`
      : "2차 2단계 체크리스트 입력 대기",
  );
  lines.push(
    steps.specialist.status === "DONE"
      ? "전문의 진찰 연계/기록 완료"
      : "전문의 진찰 연계 대기",
  );
  if (classLabel === "UNCONFIRMED") {
    lines.unshift("분류 미확정: Step3/Step4 완료 후 운영상 분류가 확정됩니다.");
  }
  return lines;
}

function buildSteps(baseCase: Case): Stage2Steps {
  const missing = countMissing(baseCase);
  const reliability = neuroReliability(missing);
  const neuroZ = Number(
    clamp(
      -2.7 + ((100 - baseCase.riskScore) / 100) * 2.1 + seeded(`${baseCase.id}-neuro-z`) * 0.7,
      -3,
      2.5,
    ).toFixed(1),
  );

  const clinicalChecklistCount = 12 + Math.floor(seeded(`${baseCase.id}-clinical-count`) * 5);

  return {
    healthCheck: {
      status: healthStatus(baseCase),
      date: toDateTime(baseCase.registeredDate, `${baseCase.id}-health`),
      summary: `건강검진 위험 점수 ${baseCase.riskScore}점 반영`,
    },
    neuropsych: {
      status: neuroStatus(baseCase),
      date:
        baseCase.secondExamStatus === "NONE"
          ? undefined
          : toDateTime(baseCase.autoMemo.lastUpdatedAt, `${baseCase.id}-neuro`),
      summary:
        baseCase.secondExamStatus === "NONE"
          ? "SNSB 결과 미입력"
          : `SNSB ${neuroZ} SD · 누락 ${missing}건`,
      missingCount: missing,
      reliability,
    },
    clinicalEval: {
      status: clinicalStatus(baseCase),
      date:
        baseCase.secondExamStatus === "DONE" || baseCase.secondExamStatus === "RESULT_CONFIRMED"
          ? toDateTime(baseCase.autoMemo.lastUpdatedAt, `${baseCase.id}-clinical`)
          : undefined,
      checklistCount: clinicalChecklistCount,
      evaluator: baseCase.counselor,
    },
    specialist: {
      status: specialistStatus(baseCase),
      date:
        baseCase.secondExamStatus === "DONE" || baseCase.secondExamStatus === "RESULT_CONFIRMED"
          ? toDateTime(baseCase.autoMemo.lastUpdatedAt, `${baseCase.id}-specialist`)
          : undefined,
      summary:
        baseCase.secondExamStatus === "RESULT_CONFIRMED"
          ? "전문의 진찰 메모 확인 완료"
          : baseCase.secondExamStatus === "DONE"
            ? "진찰 메모 정리 대기"
            : "전문의 진찰 미연계",
    },
  };
}

function buildDecision(baseCase: Case, steps: Stage2Steps): Stage2Decision {
  const confirmedClass = deriveClassFromRisk(baseCase);
  const classLabel: Stage2Class = canConfirmDecision(steps) ? confirmedClass : "UNCONFIRMED";

  return {
    class: classLabel,
    mciSubClass: classLabel === "MCI" ? deriveMciSubclass(baseCase) : null,
    confidenceNote: confidenceNote(steps),
    evidence: mapEvidence(baseCase, steps, classLabel),
  };
}

function referralFromSecondExam(status: SecondExamStatus): FollowUpState["referralStatus"] {
  if (status === "RESULT_CONFIRMED") return "SENT";
  if (status === "DONE") return "DRAFT";
  return "NOT_CREATED";
}

function reservationFromCase(baseCase: Case): FollowUpState["reservationStatus"] {
  if (!baseCase.reservation) return "NOT_REGISTERED";
  if (baseCase.secondExamStatus === "RESULT_CONFIRMED") return "CONFIRMED";
  return "REQUESTED";
}

function buildProgramDomains(decision: Stage2Decision): FollowUpState["programPlan"] {
  if (decision.class !== "MCI") return undefined;
  if (decision.mciSubClass === "MILD_OK") {
    return {
      domains: ["PHYSICAL"],
      notes: "신체건강 중심 맞춤형 사례관리 권고",
    };
  }
  if (decision.mciSubClass === "MODERATE") {
    return {
      domains: ["COGNITIVE", "PHYSICAL"],
      notes: "인지기능 + 신체건강 병행 사례관리 권고",
    };
  }
  return undefined;
}

function buildFollowUp(baseCase: Case, decision: Stage2Decision): FollowUpState {
  return {
    reevalTrigger: baseCase.autoMemo.lines.some((line) => line.includes("연속 미응답")) ? "ON" : "OFF",
    trackingRegistered:
      decision.class === "MCI" && decision.mciSubClass !== "HIGH_RISK" && baseCase.consultStatus === "DONE",
    referralStatus: referralFromSecondExam(baseCase.secondExamStatus),
    reservationStatus: reservationFromCase(baseCase),
    programPlan: buildProgramDomains(decision),
  };
}

function mapTimelineStatus(status: StepStatus): Stage2TimelineItem["status"] {
  if (status === "DONE") return "DONE";
  if (status === "MISSING") return "UNKNOWN";
  return "PENDING";
}

function buildTimeline(
  baseCase: Case,
  steps: Stage2Steps,
  decision: Stage2Decision,
  followUp: FollowUpState,
): Stage2TimelineItem[] {
  const timeline: Stage2TimelineItem[] = [
    {
      id: `${baseCase.id}-timeline-health`,
      title: "Step1 건강검진 데이터",
      status: mapTimelineStatus(steps.healthCheck.status),
      at: steps.healthCheck.date,
      stepId: "healthCheck",
    },
    {
      id: `${baseCase.id}-timeline-neuropsych`,
      title: "Step2 신경심리검사",
      status: mapTimelineStatus(steps.neuropsych.status),
      at: steps.neuropsych.date,
      stepId: "neuropsych",
    },
    {
      id: `${baseCase.id}-timeline-clinical`,
      title: "Step3 2차 2단계 치매임상평가",
      status: mapTimelineStatus(steps.clinicalEval.status),
      at: steps.clinicalEval.date,
      stepId: "clinicalEval",
    },
    {
      id: `${baseCase.id}-timeline-specialist`,
      title: "Step4 전문의 진찰",
      status: mapTimelineStatus(steps.specialist.status),
      at: steps.specialist.date,
      stepId: "specialist",
    },
    {
      id: `${baseCase.id}-timeline-class`,
      title: "종합 분류(운영 참고)",
      status: decision.class === "UNCONFIRMED" ? "PENDING" : "DONE",
      at: toDateTime(baseCase.autoMemo.lastUpdatedAt, `${baseCase.id}-timeline-class`),
    },
    {
      id: `${baseCase.id}-timeline-followup`,
      title: "후속조치 연계",
      status:
        followUp.referralStatus === "SENT" || followUp.reservationStatus === "CONFIRMED"
          ? "DONE"
          : followUp.referralStatus === "DRAFT" || followUp.reservationStatus === "REQUESTED"
            ? "PENDING"
            : "UNKNOWN",
      at:
        followUp.reservationStatus === "CONFIRMED" && baseCase.reservation
          ? `${baseCase.reservation.date} ${baseCase.reservation.time}`
          : undefined,
    },
  ];

  return timeline;
}

function buildChecklist(baseCase: Case, steps: Stage2Steps): Stage2ChecklistItem[] {
  return [
    {
      id: `${baseCase.id}-check-health`,
      stepId: "healthCheck",
      label: "Step1 건강검진 데이터 최신성 확인",
      done: steps.healthCheck.status === "DONE",
      note: steps.healthCheck.summary,
    },
    {
      id: `${baseCase.id}-check-neuro`,
      stepId: "neuropsych",
      label: "Step2 신경심리검사 누락 항목 보완",
      done: steps.neuropsych.status === "DONE",
      note: `누락 ${steps.neuropsych.missingCount ?? 0}건`,
    },
    {
      id: `${baseCase.id}-check-clinical`,
      stepId: "clinicalEval",
      label: "Step3 2차 2단계 체크리스트 입력",
      done: steps.clinicalEval.status === "DONE",
      note: steps.clinicalEval.status === "DONE" ? "입력 완료" : "입력 대기",
    },
    {
      id: `${baseCase.id}-check-specialist`,
      stepId: "specialist",
      label: "Step4 전문의 진찰 연계/확인",
      done: steps.specialist.status === "DONE",
      note: steps.specialist.summary,
    },
    {
      id: `${baseCase.id}-check-summary`,
      stepId: "clinicalEval",
      label: "종합 분류 근거 메모 검토",
      done: steps.clinicalEval.status === "DONE" && steps.specialist.status === "DONE",
      note: "운영 참고/의료진 확인 전 문구 포함",
    },
  ];
}

function buildAuditLogs(baseCase: Case): Stage2AuditLogItem[] {
  const lines = baseCase.autoMemo.lines.slice(0, 8);

  if (lines.length === 0) {
    return [
      {
        id: `${baseCase.id}-audit-0`,
        timestamp: toDateTime(baseCase.autoMemo.lastUpdatedAt, `${baseCase.id}-audit-0`),
        actor: "System",
        message: "Stage2 운영 로그가 생성되었습니다.",
      },
    ];
  }

  return lines.map((line, index) => ({
    id: `${baseCase.id}-audit-${index}`,
    timestamp: toDateTime(baseCase.autoMemo.lastUpdatedAt, `${baseCase.id}-audit-${index}`),
    actor: index % 2 === 0 ? baseCase.counselor : "System",
    message: line.replace("⚠ ", ""),
  }));
}

function buildMemos(baseCase: Case): Stage2MemoItem[] {
  return baseCase.autoMemo.lines.slice(0, 5).map((line, index) => ({
    id: `${baseCase.id}-memo-${index}`,
    timestamp: toDateTime(baseCase.autoMemo.lastUpdatedAt, `${baseCase.id}-memo-${index}`),
    author: index % 2 === 0 ? baseCase.counselor : "운영 시스템",
    content: line,
  }));
}

function calcMissingTotal(steps: Stage2Steps, followUp: FollowUpState, baseCase: Case): number {
  let total = 0;
  if (steps.neuropsych.status === "MISSING") total += 1;
  if (steps.clinicalEval.status !== "DONE") total += 1;
  if (steps.specialist.status !== "DONE") total += 1;
  if (followUp.reservationStatus === "NOT_REGISTERED") total += 1;
  if (!baseCase.guardianPhone) total += 1;
  return total;
}

export function buildStage2CaseDetailMock(baseCase: Case): Stage2CaseDetailData {
  const steps = buildSteps(baseCase);
  const decision = buildDecision(baseCase, steps);
  const followUp = buildFollowUp(baseCase, decision);
  const timeline = buildTimeline(baseCase, steps, decision, followUp);
  const checklist = buildChecklist(baseCase, steps);
  const missingTotal = calcMissingTotal(steps, followUp, baseCase);

  return {
    caseId: baseCase.id,
    centerName: "서울시 강남구 치매안심센터",
    owner: baseCase.counselor,
    roleLabel: "사례 관리자",
    stageLabel: "Stage 2",
    workStatus: toWorkStatus(baseCase),
    lastUpdatedAt: toDateTime(baseCase.autoMemo.lastUpdatedAt, `${baseCase.id}-updated`),
    missingTotal,
    steps,
    decision,
    followUp,
    timeline,
    checklist,
    auditLogs: buildAuditLogs(baseCase),
    memos: buildMemos(baseCase),
    pii: {
      maskedName: baseCase.patientName,
      maskedPhone: maskPhone(baseCase.phone),
      age: baseCase.age,
      gender: baseCase.gender,
      addressMasked: "서울시 **구 **동",
      guardianMasked: baseCase.guardianPhone ? maskPhone(baseCase.guardianPhone) : undefined,
    },
  };
}

export function getStage2CaseDetailById(caseId: string): Stage2CaseDetailData | null {
  const cases = generateCases();
  const match = cases.find((item) => item.id === caseId);
  if (!match) return null;
  return buildStage2CaseDetailMock(match);
}

export function getStage2SampleCaseDetail(): Stage2CaseDetailData {
  const sample = generateCases()[3];
  return buildStage2CaseDetailMock(sample);
}
