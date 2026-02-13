import {
  generateCases,
  maskPhone,
  type Case,
  type SecondExamStatus,
} from "../caseData";
import type {
  CaseStage2Status,
  BranchPlan,
  ClinicalSummary,
  DomainScore,
  FollowUpState,
  FollowUpPlan,
  LinkageStatus,
  MciSubClass,
  NeuropsychSummary,
  Stage2AuditEvent,
  Stage2AuditLogItem,
  Stage2CaseDetailData,
  Stage2ChecklistItem,
  Stage2Class,
  Stage2Decision,
  Stage2MemoItem,
  Stage2FollowupTodo,
  Stage2StepKey,
  Stage2Steps,
  Stage2TimelineItem,
  TodoType,
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
  const finalClass =
    classLabel === "DEMENTIA"
      ? "AD_SUSPECT"
      : classLabel === "NORMAL"
        ? "NORMAL"
        : classLabel === "MCI"
          ? "MCI"
          : "UNCONFIRMED";
  const decidedAt =
    classLabel === "UNCONFIRMED"
      ? undefined
      : toDateTime(baseCase.autoMemo.lastUpdatedAt, `${baseCase.id}-decision-at`);

  return {
    class: classLabel,
    mciSubClass: classLabel === "MCI" ? deriveMciSubclass(baseCase) : null,
    confidenceNote: confidenceNote(steps),
    evidence: mapEvidence(baseCase, steps, classLabel),
    finalClass,
    decidedAt,
    decidedBy: classLabel === "UNCONFIRMED" ? undefined : baseCase.counselor,
    rationaleSummary:
      classLabel === "UNCONFIRMED"
        ? "Step3/Step4 미완료로 운영상 분류 확정 대기"
        : `검사 기반 분류 ${finalClass} · 운영 강도 조정 필요`,
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

function buildBirthDate(age: number, seed: string): string {
  const nowYear = new Date().getFullYear();
  const year = nowYear - age;
  const month = String(1 + Math.floor(seeded(`${seed}-birth-month`) * 12)).padStart(2, "0");
  const day = String(1 + Math.floor(seeded(`${seed}-birth-day`) * 27)).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function buildDomainScores(baseCase: Case): DomainScore[] {
  const base = Math.max(18, Math.min(30, Math.round(30 - (baseCase.riskScore - 45) * 0.16)));
  const gradeOf = (score: number): DomainScore["grade"] => (score >= 24 ? "정상" : score >= 20 ? "경계" : "저하");
  const scoreFrom = (delta: number) => Math.max(10, Math.min(30, base + delta));
  return [
    { domain: "MEMORY", score: scoreFrom(-3), grade: gradeOf(scoreFrom(-3)), summary: "최근 기억 회상 변동 관찰" },
    { domain: "ATTENTION", score: scoreFrom(-1), grade: gradeOf(scoreFrom(-1)), summary: "주의 지속시간 약간 저하" },
    { domain: "EXECUTIVE", score: scoreFrom(-2), grade: gradeOf(scoreFrom(-2)), summary: "집행기능 과제 반응 지연" },
    { domain: "LANGUAGE", score: scoreFrom(0), grade: gradeOf(scoreFrom(0)), summary: "언어 기능은 비교적 보존" },
    { domain: "VISUOSPATIAL", score: scoreFrom(-2), grade: gradeOf(scoreFrom(-2)), summary: "시공간 과제 일부 실수" },
  ];
}

function buildNeuropsychSummary(baseCase: Case, steps: Stage2Steps): NeuropsychSummary {
  const domains = buildDomainScores(baseCase);
  const cistTotal = Math.max(12, Math.min(30, Math.round(domains.reduce((acc, cur) => acc + cur.score, 0) / domains.length)));
  return {
    cistTotal,
    domains,
    missingCount: steps.neuropsych.missingCount ?? 0,
    freshness: steps.neuropsych.date ? "LATEST" : "UNKNOWN",
    updatedAt: steps.neuropsych.date ?? toDateTime(baseCase.autoMemo.lastUpdatedAt, `${baseCase.id}-neuro-summary`),
  };
}

function buildClinicalSummary(baseCase: Case, steps: Stage2Steps): ClinicalSummary {
  const risk = baseCase.riskScore;
  const adlImpact: ClinicalSummary["adlImpact"] = risk >= 70 ? "YES" : risk >= 50 ? "UNKNOWN" : "NO";
  const flags: ClinicalSummary["flags"] = [];
  if (risk >= 58) flags.push("MOOD");
  if (risk >= 64) flags.push("SLEEP");
  if (risk >= 72) flags.push("MEDICATION");
  return {
    adlImpact,
    caregiverNote:
      adlImpact === "YES"
        ? "보호자 관찰: 최근 일상 루틴 유지가 어렵고 복약 관리가 불안정함."
        : adlImpact === "UNKNOWN"
          ? "보호자 관찰: 경미한 건망 반응이 있으나 기능 저하는 추가 확인 필요."
          : "보호자 관찰: 일상 기능은 대체로 유지됨.",
    flags,
    needDifferential: risk >= 68 || steps.specialist.status !== "DONE",
    updatedAt: steps.clinicalEval.date ?? toDateTime(baseCase.autoMemo.lastUpdatedAt, `${baseCase.id}-clinical-summary`),
  };
}

function toBranch(decision: Stage2Decision): BranchPlan["branch"] {
  if (decision.class === "DEMENTIA") return "AD_SUSPECT";
  if (decision.class === "MCI") return "MCI";
  if (decision.class === "NORMAL") return "NORMAL";
  return "UNCONFIRMED";
}

function toIntensity(baseCase: Case, decision: Stage2Decision): BranchPlan["intensityLevel"] {
  if (decision.class === "DEMENTIA" || (decision.class === "MCI" && decision.mciSubClass === "HIGH_RISK")) return "L3";
  if (baseCase.riskScore >= 60 || decision.class === "MCI") return "L2";
  return "L1";
}

function buildBranchPlan(baseCase: Case, decision: Stage2Decision, steps: Stage2Steps, followUp: FollowUpState): BranchPlan {
  return {
    branch: toBranch(decision),
    intensityLevel: toIntensity(baseCase, decision),
    nextActions: [
      { id: "confirm-result", label: "2차 평가 결과 확정", done: steps.clinicalEval.status === "DONE" && steps.specialist.status === "DONE" },
      { id: "set-branch", label: "분기/운영 강도 설정", done: decision.class !== "UNCONFIRMED" },
      {
        id: "linkage",
        label: "연계/예약 실행",
        done: followUp.referralStatus === "SENT" || followUp.reservationStatus === "CONFIRMED",
      },
      { id: "followup", label: "추적 계획 생성", done: Boolean(followUp.programPlan) || followUp.reevalTrigger === "ON" },
    ],
  };
}

function buildLinkageStatuses(baseCase: Case, followUp: FollowUpState): LinkageStatus[] {
  const reservationDate = baseCase.reservation ? `${baseCase.reservation.date} ${baseCase.reservation.time}` : undefined;
  return [
    {
      type: "CENTER",
      status: followUp.trackingRegistered ? "CREATED" : "NOT_CREATED",
      lastActor: baseCase.counselor,
      lastAt: toDateTime(baseCase.autoMemo.lastUpdatedAt, `${baseCase.id}-center-link`),
      nextSchedule: reservationDate,
    },
    {
      type: "HOSPITAL",
      status:
        followUp.referralStatus === "SENT" ? "COMPLETED" : followUp.referralStatus === "DRAFT" ? "CREATED" : "NOT_CREATED",
      lastActor: baseCase.counselor,
      lastAt: toDateTime(baseCase.autoMemo.lastUpdatedAt, `${baseCase.id}-hospital-link`),
      nextSchedule: reservationDate,
    },
    {
      type: "COUNSELING",
      status:
        followUp.reservationStatus === "CONFIRMED"
          ? "COMPLETED"
          : followUp.reservationStatus === "REQUESTED"
            ? "CREATED"
            : "NOT_CREATED",
      lastActor: baseCase.counselor,
      lastAt: toDateTime(baseCase.autoMemo.lastUpdatedAt, `${baseCase.id}-counseling-link`),
      nextSchedule: reservationDate,
    },
  ];
}

function buildFollowUpPlan(baseCase: Case, branchPlan: BranchPlan): FollowUpPlan {
  const cadence: FollowUpPlan["cadence"] =
    branchPlan.intensityLevel === "L3" ? "WEEKLY" : branchPlan.intensityLevel === "L2" ? "BIWEEKLY" : "MONTHLY";
  const dayShift = cadence === "WEEKLY" ? 7 : cadence === "BIWEEKLY" ? 14 : 30;
  const date = new Date();
  date.setDate(date.getDate() + dayShift);
  return {
    cadence,
    nextDate: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`,
    stage3Enroll: branchPlan.intensityLevel !== "L1",
    notes:
      branchPlan.intensityLevel === "L3"
        ? "재검 임박군 우선 모니터링 및 보호자 동행 권고"
        : "정기 추적과 생활습관 프로그램 안내",
  };
}

function buildAuditEvents(baseCase: Case, decision: Stage2Decision, branchPlan: BranchPlan, followUpPlan: FollowUpPlan): Stage2AuditEvent[] {
  return [
    {
      at: toDateTime(baseCase.autoMemo.lastUpdatedAt, `${baseCase.id}-evt-1`),
      actor: baseCase.counselor,
      action: "2차 평가 결과 확정",
      reason: decision.rationaleSummary,
      summary: `분류 ${decision.finalClass ?? "UNCONFIRMED"} / 강도 ${branchPlan.intensityLevel}`,
    },
    {
      at: toDateTime(baseCase.autoMemo.lastUpdatedAt, `${baseCase.id}-evt-2`),
      actor: baseCase.counselor,
      action: "분기/레벨 변경",
      reason: "검사 기반 분류",
      summary: branchPlan.nextActions.map((item) => `${item.label}:${item.done ? "완료" : "대기"}`).join(", "),
    },
    {
      at: toDateTime(baseCase.autoMemo.lastUpdatedAt, `${baseCase.id}-evt-3`),
      actor: "운영 시스템",
      action: "추적 계획 생성",
      reason: `추적 주기 ${followUpPlan.cadence}`,
      summary: `다음 일정 ${followUpPlan.nextDate} / Stage3 등록 ${followUpPlan.stage3Enroll ? "예정" : "미정"}`,
    },
  ];
}

function buildStage2Status(steps: Stage2Steps, decision: Stage2Decision, baseCase: Case): CaseStage2Status {
  if (baseCase.contactStatus === "UNREACHED") return "WAITING";
  if (decision.class !== "UNCONFIRMED") return "JUDGMENT_DONE";
  if (steps.specialist.status === "PENDING") return "RESULT_WAITING";
  if (steps.clinicalEval.status === "MISSING" || steps.specialist.status === "MISSING") return "ON_HOLD";
  return "IN_PROGRESS";
}

function buildTodoType(decision: Stage2Decision): TodoType {
  if (decision.class === "NORMAL") return "NORMAL_REANALYSIS";
  if (decision.class === "MCI" && decision.mciSubClass === "MILD_OK") return "MCI_MILD_TRACKING";
  if (decision.class === "MCI" && decision.mciSubClass === "MODERATE") return "MCI_MODERATE_TRACKING";
  if (decision.class === "MCI" && decision.mciSubClass === "HIGH_RISK") return "MCI_HIGH_RISK_DIFF_TEST";
  return "DEMENTIA_DIFF_TEST";
}

function buildFollowupTodos(baseCase: Case, decision: Stage2Decision, followUpPlan: FollowUpPlan): Stage2FollowupTodo[] {
  const timestamp = toDateTime(baseCase.autoMemo.lastUpdatedAt, `${baseCase.id}-todo-created`);
  const coreTodo: Stage2FollowupTodo = {
    id: `${baseCase.id}-todo-core`,
    type: buildTodoType(decision),
    title:
      decision.class === "NORMAL"
        ? "재분석 예약(검진 업데이트 시점)"
        : decision.class === "MCI" && decision.mciSubClass === "MILD_OK"
          ? "추적 + 신체건강 사례관리"
          : decision.class === "MCI" && decision.mciSubClass === "MODERATE"
            ? "추적 + 인지/신체 사례관리"
            : "감별검사 연계(권고)",
    status: decision.class === "UNCONFIRMED" ? "WAITING" : "IN_PROGRESS",
    assignee: baseCase.counselor,
    dueDate: followUpPlan.nextDate,
    createdAt: timestamp,
  };

  const items: Stage2FollowupTodo[] = [coreTodo];
  if (baseCase.contactStatus === "UNREACHED") {
    items.push({
      id: `${baseCase.id}-todo-recontact`,
      type: "NO_RESPONSE_RETRY",
      title: "무응답 재접촉 계획 생성",
      status: "WAITING",
      assignee: baseCase.counselor,
      dueDate: followUpPlan.nextDate,
      createdAt: timestamp,
    });
  }
  return items;
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
  const neuropsychSummary = buildNeuropsychSummary(baseCase, steps);
  const clinicalSummary = buildClinicalSummary(baseCase, steps);
  const branchPlan = buildBranchPlan(baseCase, decision, steps, followUp);
  const linkageStatuses = buildLinkageStatuses(baseCase, followUp);
  const followUpPlan = buildFollowUpPlan(baseCase, branchPlan);
  const auditEvents = buildAuditEvents(baseCase, decision, branchPlan, followUpPlan);
  const timeline = buildTimeline(baseCase, steps, decision, followUp);
  const checklist = buildChecklist(baseCase, steps);
  const missingTotal = calcMissingTotal(steps, followUp, baseCase);
  const stage2Status = buildStage2Status(steps, decision, baseCase);
  const stage2EnteredAt = toDateTime(baseCase.registeredDate, `${baseCase.id}-stage2-entered`);
  const targetCompletionDate = new Date();
  targetCompletionDate.setDate(targetCompletionDate.getDate() + 14);
  const targetCompletionAt = `${targetCompletionDate.getFullYear()}-${String(targetCompletionDate.getMonth() + 1).padStart(2, "0")}-${String(targetCompletionDate.getDate()).padStart(2, "0")} 18:00`;
  const referral = {
    status:
      followUp.referralStatus === "SENT"
        ? "RESULT_RECEIVED"
        : followUp.reservationStatus === "CONFIRMED"
          ? "RESERVATION_CONFIRMED"
          : followUp.reservationStatus === "REQUESTED"
            ? "RESERVATION_REQUESTED"
            : followUp.referralStatus === "DRAFT"
              ? "REFERRED"
              : "BEFORE_REFERRAL",
    org: "강남구 협력병원",
    contact: "02-777-2200",
    schedule: baseCase.reservation ? `${baseCase.reservation.date} ${baseCase.reservation.time}` : undefined,
    resultReceivedAt: baseCase.secondExamStatus === "RESULT_CONFIRMED" ? toDateTime(baseCase.autoMemo.lastUpdatedAt, `${baseCase.id}-result-received`) : undefined,
    lastRequestedAt: toDateTime(baseCase.autoMemo.lastUpdatedAt, `${baseCase.id}-request-at`),
    owner: baseCase.counselor,
  } as const;
  const diagnosis = {
    finalClass: decision.finalClass,
    mciSubtype: decision.mciSubClass,
    confirmedBy: decision.decidedBy,
    confirmedAt: decision.decidedAt,
    rationale: decision.rationaleSummary,
  };
  const followupTodos = buildFollowupTodos(baseCase, decision, followUpPlan);
  const commLogs = [
    {
      id: `${baseCase.id}-comm-1`,
      channel: "CALL" as const,
      result: baseCase.contactStatus === "REACHED" ? "연락 성공" : "연락 불가",
      at: toDateTime(baseCase.autoMemo.lastUpdatedAt, `${baseCase.id}-comm-1`),
      note: "2차 운영 안내",
    },
    {
      id: `${baseCase.id}-comm-2`,
      channel: "SMS" as const,
      templateLabel: "2차 예약안내",
      result: "SENT",
      at: toDateTime(baseCase.autoMemo.lastUpdatedAt, `${baseCase.id}-comm-2`),
      note: "예약 링크 안내",
    },
  ];
  const stage1EvidenceSummary = [
    "건강검진 위험 신호 반영",
    "1차 선별결과 고위험군 플래그",
    "접촉 로그 기반 2차 평가 연계",
  ];

  return {
    caseId: baseCase.id,
    centerName: "서울시 강남구 치매안심센터",
    owner: baseCase.counselor,
    roleLabel: "사례 관리자",
    stageLabel: "Stage 2",
    workStatus: toWorkStatus(baseCase),
    stage2Status,
    stage2EnteredAt,
    targetCompletionAt,
    lastUpdatedAt: toDateTime(baseCase.autoMemo.lastUpdatedAt, `${baseCase.id}-updated`),
    missingTotal,
    steps,
    decision,
    followUp,
    bottleneckCode:
      steps.clinicalEval.status !== "DONE" || steps.specialist.status !== "DONE"
        ? "MISSING_DOCS"
        : followUp.reservationStatus === "NOT_REGISTERED"
          ? "RESERVATION_PENDING"
          : "NONE",
    bottleneckMemo: "필수 단계 우선 점검",
    stage1EvidenceSummary,
    neuropsychTest: neuropsychSummary,
    clinicalEvalData: clinicalSummary,
    specialistVisit: {
      status: steps.specialist.status,
      summary: steps.specialist.summary ?? "전문의 진찰 요약 없음",
      date: steps.specialist.date,
    },
    referral,
    diagnosis,
    followupTodos,
    commLogs,
    timeline,
    checklist,
    auditLogs: buildAuditLogs(baseCase),
    memos: buildMemos(baseCase),
    neuropsychSummary,
    clinicalSummary,
    branchPlan,
    linkageStatuses,
    followUpPlan,
    auditEvents,
    pii: {
      fullName: baseCase.patientName,
      birthDate: buildBirthDate(baseCase.age, `${baseCase.id}-birth`),
      phone: baseCase.phone,
      address: `${baseCase.id.endsWith("7") ? "서울시 강남구 논현동" : "서울시 강남구 역삼동"} ${101 + (baseCase.age % 10)}동 ${1001 + (baseCase.riskScore % 20)}호`,
      guardianName: baseCase.guardianPhone ? "보호자(가족)" : undefined,
      guardianPhone: baseCase.guardianPhone,
      consentStatus:
        baseCase.contactStatus === "REACHED" && baseCase.consultStatus === "DONE"
          ? "완료"
          : baseCase.contactStatus === "REACHED"
            ? "진행 중"
            : "갱신 필요",
      medicalHistory:
        baseCase.riskLevel === "high"
          ? ["고혈압", "당뇨", "고지혈증"]
          : baseCase.riskLevel === "medium"
            ? ["고혈압"]
            : [],
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

export const STAGE2_DETAILED_FIXTURE: Stage2CaseDetailData = buildStage2CaseDetailMock(generateCases()[5]);
