import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ExternalLink,
  ListChecks,
  MessageSquare,
  Phone,
  ShieldAlert,
} from "lucide-react";
import { Badge } from "../../ui/badge";
import { Button } from "../../ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../ui/dialog";
import { Textarea } from "../../ui/textarea";
import { cn } from "../../ui/utils";
import { CaseDetailPrograms } from "../programs/CaseDetailPrograms";
import { SmsPanel } from "../sms/SmsPanel";
import type { SmsTemplate } from "../sms/SmsPanel";
import type { SmsHistoryItem } from "../sms/smsService";
import {
  StageDetailFrame,
  type StageDetailConfig,
} from "../shared/StageDetailFrame";
import type {
  BottleneckCode,
  CaseStage2Status,
  FollowUpState,
  MciSubClass,
  ProgramDomain,
  ReferralStatus,
  Stage2AuditLogItem,
  Stage2CaseDetailData,
  Stage2Class,
  Stage2FollowupTodo,
  Stage2MemoItem,
  Stage2StepKey,
  Stage2Steps,
  Stage2TimelineItem,
  TodoType,
  WorkflowStep,
  StepStatus,
} from "./stage2Types";
import {
  canConfirmDiagnosis,
  computeNextAction,
  deriveBottleneck,
  getMissingRequirements,
} from "./stage2Rules";

interface CaseDetailStage2PageProps {
  data?: Stage2CaseDetailData | null;
  onBack: () => void;
  isLoading?: boolean;
}

const STEP_ORDER: Stage2StepKey[] = ["healthCheck", "neuropsych", "clinicalEval", "specialist"];

const CLASS_LABEL: Record<Stage2Class, string> = {
  NORMAL: "정상",
  MCI: "경도인지장애(MCI)",
  DEMENTIA: "치매",
  UNCONFIRMED: "분류 미확정",
};

const MCI_SUBCLASS_LABEL: Record<Exclude<MciSubClass, null>, string> = {
  MILD_OK: "양호",
  MODERATE: "중증",
  HIGH_RISK: "위험",
};

const STAGE2_SMS_TEMPLATES: SmsTemplate[] = [
  /* ── 접촉: 시민화면 링크 포함 ── */
  {
    id: "S2_CONTACT_BASE",
    type: "CONTACT",
    label: "2차 접촉(정밀평가 안내)",
    body: ({ centerName, guideLink, centerPhone }) =>
      `[치매안심센터:${centerName}] 1차 확인 결과에 따라 2차 정밀평가(인지검사/임상평가) 안내드립니다. 이는 확진이 아니라 추가 확인 절차입니다. 예약/안내 확인: ${guideLink} / 문의: ${centerPhone}`,
  },
  {
    id: "S2_CONTACT_RELIEF",
    type: "CONTACT",
    label: "2차 접촉(불안 완화)",
    body: ({ centerName, guideLink, centerPhone }) =>
      `[치매안심센터:${centerName}] 추가 확인을 위한 2차 평가 안내입니다. 결과는 의료진 평가를 통해 최종 확인됩니다. 예약/상담 요청: ${guideLink} / 문의: ${centerPhone}`,
  },
  /* ── 예약안내: 시민링크 없음, 센터 안내만 ── */
  {
    id: "S2_BOOKING_STEP1",
    type: "BOOKING",
    label: "2차 예약안내(1단계 신경심리)",
    body: ({ centerName, centerPhone }) =>
      `[치매안심센터:${centerName}] 2차 1단계 인지검사(신경심리검사) 예약 안내드립니다. 가능한 일정을 선택해주세요. 예약/변경 문의: ${centerPhone}`,
  },
  {
    id: "S2_BOOKING_STEP2",
    type: "BOOKING",
    label: "2차 예약안내(2단계 임상평가)",
    body: ({ centerName, centerPhone }) =>
      `[치매안심센터:${centerName}] 2차 2단계 임상평가(전문의 상담/의료 연계) 안내드립니다. 일정 선택 또는 상담 요청 문의: ${centerPhone}`,
  },
  /* ── 리마인더: 시민링크 없음, 센터 안내만 ── */
  {
    id: "S2_REMINDER_BOOKING",
    type: "REMINDER",
    label: "2차 리마인더(미예약)",
    body: ({ centerName, centerPhone }) =>
      `[치매안심센터:${centerName}] 2차 평가 예약이 아직 완료되지 않았습니다. 추가 확인 절차 진행을 위해 일정 선택 부탁드립니다. 문의: ${centerPhone}`,
  },
  {
    id: "S2_REMINDER_NOSHOW",
    type: "REMINDER",
    label: "2차 리마인더(노쇼 재예약)",
    body: ({ centerName, centerPhone }) =>
      `[치매안심센터:${centerName}] 예약 일정에 참석이 어려우셨다면 재예약이 가능합니다. 편한 시간으로 다시 선택해주세요. 문의: ${centerPhone}`,
  },
];

const WORK_STATUS_LABEL: Record<Stage2CaseDetailData["workStatus"], string> = {
  WAITING: "작업 대기",
  IN_PROGRESS: "진행 중",
  DONE: "완료",
};

const STAGE2_STATUS_LABEL: Record<CaseStage2Status, string> = {
  WAITING: "대기",
  IN_PROGRESS: "진행중",
  RESULT_WAITING: "결과수신대기",
  JUDGMENT_DONE: "판단완료",
  ON_HOLD: "보류",
  DISCONTINUED: "중단(거부)",
};

const BOTTLENECK_LABEL: Record<BottleneckCode, string> = {
  NONE: "없음",
  RESERVATION_PENDING: "예약 미완료",
  HOSPITAL_DELAY: "병원 회신 지연",
  NO_RESPONSE: "대상자 미응답",
  MISSING_DOCS: "자료 누락",
  OTHER: "기타",
};

const REFERRAL_LABEL: Record<ReferralStatus, string> = {
  BEFORE_REFERRAL: "의뢰전",
  REFERRED: "의뢰완료",
  RESERVATION_REQUESTED: "예약요청",
  RESERVATION_CONFIRMED: "예약확정",
  RESULT_RECEIVED: "결과수신",
  DELAYED: "지연",
  RE_REQUESTED: "재요청",
};

function formatDateTime(input: Date | string): string {
  const date = input instanceof Date ? input : new Date(input.includes("T") ? input : input.replace(" ", "T"));
  if (Number.isNaN(date.getTime())) {
    return typeof input === "string" ? input : "";
  }
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate(),
  ).padStart(2, "0")} ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function toDateTimeInputValue(value?: string): string {
  if (!value) return "";
  const parsed = new Date(value.includes("T") ? value : value.replace(" ", "T"));
  if (Number.isNaN(parsed.getTime())) return "";
  const yyyy = parsed.getFullYear();
  const mm = String(parsed.getMonth() + 1).padStart(2, "0");
  const dd = String(parsed.getDate()).padStart(2, "0");
  const hh = String(parsed.getHours()).padStart(2, "0");
  const min = String(parsed.getMinutes()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
}

function statusLabel(status: StepStatus): string {
  if (status === "DONE") return "완료";
  if (status === "INPUT_REQUIRED") return "입력대기";
  if (status === "MISSING") return "누락";
  return "대기";
}

function domainLabel(domain: ProgramDomain): string {
  if (domain === "PHYSICAL") return "신체건강";
  if (domain === "COGNITIVE") return "인지기능";
  if (domain === "DAILY") return "일상생활";
  return "가족지원";
}

function domainDescription(domain: ProgramDomain): string {
  if (domain === "PHYSICAL") return "운동/만성질환 관리 중심";
  if (domain === "COGNITIVE") return "인지훈련·재활 중심";
  if (domain === "DAILY") return "생활리듬·복약·일상지원";
  return "보호자 교육·가족 상담";
}

function recommendedDomains(subClass: MciSubClass): ProgramDomain[] {
  if (subClass === "MILD_OK") return ["PHYSICAL"];
  if (subClass === "MODERATE") return ["COGNITIVE", "PHYSICAL"];
  return [];
}

function stepTitle(stepKey: Stage2StepKey): string {
  if (stepKey === "healthCheck") return "Stage1 근거";
  if (stepKey === "neuropsych") return "2차 1단계 신경심리검사";
  if (stepKey === "clinicalEval") return "2차 2단계 임상평가";
  return "전문의 진찰";
}

function stepSummary(steps: Stage2Steps, stepKey: Stage2StepKey): string {
  if (stepKey === "healthCheck") {
    return steps.healthCheck.summary ?? "건강검진 데이터 요약 없음";
  }
  if (stepKey === "neuropsych") {
    return steps.neuropsych.summary ?? "신경심리검사 요약 없음";
  }
  if (stepKey === "clinicalEval") {
    const count = steps.clinicalEval.checklistCount ?? 0;
    const evaluator = steps.clinicalEval.evaluator ?? "평가자 미지정";
    return `체크리스트 ${count}개 · ${evaluator}`;
  }
  return steps.specialist.summary ?? "전문의 진찰 연계 요약 없음";
}

function nextStepStatus(status: StepStatus): StepStatus {
  if (status === "MISSING") return "INPUT_REQUIRED";
  if (status === "PENDING" || status === "INPUT_REQUIRED") return "DONE";
  return "DONE";
}

function timelineStatusFromStep(status: StepStatus): Stage2TimelineItem["status"] {
  if (status === "DONE") return "DONE";
  if (status === "MISSING") return "UNKNOWN";
  return "PENDING";
}

function classSummary(decisionClass: Stage2Class, mciSubClass: MciSubClass): string {
  if (decisionClass === "MCI" && mciSubClass) {
    return `${CLASS_LABEL[decisionClass]} · ${MCI_SUBCLASS_LABEL[mciSubClass]}`;
  }
  return CLASS_LABEL[decisionClass];
}

function decisionChipLabel(caseData: Stage2CaseDetailData): string {
  const finalClass = caseData.decision.finalClass;
  if (finalClass === "AD_SUSPECT") return "치매";
  if (finalClass === "MCI") return "MCI";
  if (finalClass === "NORMAL") return "정상";
  return "미확정";
}

function shouldActivateProgramLink(caseData: Stage2CaseDetailData): boolean {
  return caseData.decision.class === "MCI" && caseData.decision.mciSubClass !== "HIGH_RISK";
}

function followUpMappingLabel(subClass: MciSubClass): string {
  if (subClass === "MILD_OK") return "추적 + 맞춤형사례관리(신체건강)";
  if (subClass === "MODERATE") return "추적 + 맞춤형사례관리(인지기능+신체건강)";
  return "감별검사 권고(의뢰/예약 연계)";
}

function inferClassFromHealthSummary(summary?: string): Stage2Class {
  const scoreMatch = summary?.match(/(\\d+)점/);
  if (!scoreMatch) return "MCI";
  const riskScore = Number(scoreMatch[1]);
  if (riskScore >= 82) return "DEMENTIA";
  if (riskScore >= 48) return "MCI";
  return "NORMAL";
}

function stepProgress(steps: Stage2Steps): number {
  const doneCount = STEP_ORDER.filter((stepId) => steps[stepId].status === "DONE").length;
  return Math.round((doneCount / STEP_ORDER.length) * 100);
}

function clampScore(score: number): number {
  return Math.max(0, Math.min(100, Math.round(score)));
}

function toPriorityLevel(score: number): "L0" | "L1" | "L2" | "L3" {
  if (score >= 85) return "L3";
  if (score >= 65) return "L2";
  if (score >= 45) return "L1";
  return "L0";
}

function computeMissingTotal(next: Stage2CaseDetailData): number {
  let missing = 0;
  if (next.steps.neuropsych.status === "MISSING") missing += 1;
  if (next.steps.clinicalEval.status !== "DONE") missing += 1;
  if (next.steps.specialist.status !== "DONE") missing += 1;
  if (next.followUp.reservationStatus === "NOT_REGISTERED") missing += 1;
  if (!next.pii.guardianPhone) missing += 1;
  return missing;
}

function normalizeFollowUpByDecision(
  decisionClass: Stage2Class,
  mciSubClass: MciSubClass,
  followUp: FollowUpState,
): FollowUpState {
  if (decisionClass === "NORMAL") {
    return {
      ...followUp,
      trackingRegistered: false,
      programPlan: undefined,
    };
  }
  if (decisionClass === "MCI") {
    if (mciSubClass === "MILD_OK") {
      return {
        ...followUp,
        programPlan: followUp.programPlan ?? {
          domains: ["PHYSICAL"],
          notes: "신체건강 중심",
        },
      };
    }
    if (mciSubClass === "MODERATE") {
      return {
        ...followUp,
        programPlan: followUp.programPlan ?? {
          domains: ["COGNITIVE", "PHYSICAL"],
          notes: "인지+신체 병행",
        },
      };
    }
    return {
      ...followUp,
      programPlan: undefined,
    };
  }

  if (decisionClass === "DEMENTIA") {
    return {
      ...followUp,
      trackingRegistered: false,
      programPlan: undefined,
    };
  }

  return followUp;
}

function todoTypeLabel(type: TodoType): string {
  if (type === "NORMAL_REANALYSIS") return "정상 재분석";
  if (type === "MCI_MILD_TRACKING") return "MCI 양호 추적";
  if (type === "MCI_MODERATE_TRACKING") return "MCI 중증 추적";
  if (type === "MCI_HIGH_RISK_DIFF_TEST") return "MCI 위험 감별검사";
  if (type === "DEMENTIA_DIFF_TEST") return "치매 감별검사/장기관리";
  return "무응답 재접촉";
}

function addDays(base: Date, days: number): string {
  const date = new Date(base);
  date.setDate(date.getDate() + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function buildFollowupTodosByDecision(
  decisionClass: Stage2Class,
  subClass: MciSubClass,
  owner: string,
  now: string,
): Stage2FollowupTodo[] {
  const nowDate = new Date(now.includes("T") ? now : now.replace(" ", "T"));
  const makeTodo = (
    id: string,
    type: TodoType,
    title: string,
    dueInDays: number,
  ): Stage2FollowupTodo => ({
    id,
    type,
    title,
    status: "WAITING",
    assignee: owner,
    dueDate: addDays(nowDate, dueInDays),
    createdAt: now,
  });

  if (decisionClass === "NORMAL") {
    return [makeTodo(`todo-${Date.now()}-normal`, "NORMAL_REANALYSIS", "재분석 예약(검진 업데이트 시)", 30)];
  }
  if (decisionClass === "MCI" && subClass === "MILD_OK") {
    return [makeTodo(`todo-${Date.now()}-mci-mild-1`, "MCI_MILD_TRACKING", "추적 + 신체건강 사례관리", 14)];
  }
  if (decisionClass === "MCI" && subClass === "MODERATE") {
    return [makeTodo(`todo-${Date.now()}-mci-mod-1`, "MCI_MODERATE_TRACKING", "추적 + 인지+신체 사례관리", 7)];
  }
  if (decisionClass === "MCI" && subClass === "HIGH_RISK") {
    return [
      makeTodo(`todo-${Date.now()}-mci-risk-1`, "MCI_HIGH_RISK_DIFF_TEST", "감별검사 권고(의뢰/예약 연계)", 3),
      makeTodo(`todo-${Date.now()}-mci-risk-2`, "MCI_HIGH_RISK_DIFF_TEST", "검사항목 체크리스트(권고)", 5),
    ];
  }
  return [makeTodo(`todo-${Date.now()}-dem-1`, "DEMENTIA_DIFF_TEST", "감별검사 연계", 3)];
}

function workflowStepLabel(step: WorkflowStep): string {
  if (step === "VERIFY_STAGE1_EVIDENCE") return "1) Stage1 근거";
  if (step === "NEUROPSYCH_TEST") return "2) 2차 1단계 신경심리검사";
  if (step === "CLINICAL_EVAL") return "3) 2차 2단계 임상평가";
  if (step === "SPECIALIST_VISIT") return "4) 전문의 진찰";
  if (step === "CONFIRM_DIAGNOSIS") return "5) 분류 확정";
  return "6) 후속조치 확정";
}

type Stage2RailStatus = "DONE" | "WAITING" | "MISSING" | "BLOCKED";

type Stage2WorkAction = {
  label: string;
  run: () => void;
};

type Stage2WorkItem = {
  id: string;
  priority: "P1" | "P2" | "P3";
  title: string;
  description: string;
  step?: Stage2StepKey;
  completionCriteria: Array<{ label: string; done: boolean }>;
  actions: Stage2WorkAction[];
};

function railStatusLabel(status: Stage2RailStatus): string {
  if (status === "DONE") return "완료";
  if (status === "MISSING") return "누락";
  if (status === "BLOCKED") return "막힘";
  return "대기";
}

function railStatusTone(status: Stage2RailStatus): string {
  if (status === "DONE") return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (status === "MISSING") return "border-red-200 bg-red-50 text-red-800";
  if (status === "BLOCKED") return "border-violet-200 bg-violet-50 text-violet-800";
  return "border-slate-200 bg-slate-100 text-slate-700";
}

export function CaseDetailStage2Page({ data, onBack, isLoading = false }: CaseDetailStage2PageProps) {
  const [caseData, setCaseData] = useState<Stage2CaseDetailData | null>(data ?? null);
  const [activeStep, setActiveStep] = useState<Stage2StepKey>("clinicalEval");
  const [activeWorkflowStep, setActiveWorkflowStep] = useState<WorkflowStep>("CLINICAL_EVAL");
  const [focusedStep, setFocusedStep] = useState<Stage2StepKey | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [memoInput, setMemoInput] = useState("");
  const [bottleneckCodeDraft, setBottleneckCodeDraft] = useState<BottleneckCode>("NONE");
  const [bottleneckMemoDraft, setBottleneckMemoDraft] = useState("");
  const [evidenceExpanded, setEvidenceExpanded] = useState(false);
  const [programModalOpen, setProgramModalOpen] = useState(false);
  const [programDraftDomains, setProgramDraftDomains] = useState<ProgramDomain[]>([]);
  const [programDraftNote, setProgramDraftNote] = useState("");
  const [authorizeModalOpen, setAuthorizeModalOpen] = useState(false);
  const [authorizeReason, setAuthorizeReason] = useState("");
  const [smsModalOpen, setSmsModalOpen] = useState(false);
  const [linkageModalOpen, setLinkageModalOpen] = useState(false);
  const [activePanelId, setActivePanelId] = useState<string | null>(null);
  const [qualityDrawerOpen, setQualityDrawerOpen] = useState(false);
  const [qualityReasons, setQualityReasons] = useState<Record<string, string>>({});
  const [qualityResolved, setQualityResolved] = useState<Record<string, boolean>>({});
  const [caseSwitching, setCaseSwitching] = useState(false);
  const [branchDrawerOpen, setBranchDrawerOpen] = useState(false);
  const [branchDraftClass, setBranchDraftClass] = useState<"NORMAL" | "MCI" | "AD_SUSPECT" | "UNCONFIRMED">(
    "UNCONFIRMED",
  );
  const [branchDraftIntensity, setBranchDraftIntensity] = useState<"L1" | "L2" | "L3">("L2");
  const [branchReason, setBranchReason] = useState("");
  const [actionConfirmOpen, setActionConfirmOpen] = useState(false);
  const [actionConfirmReason, setActionConfirmReason] = useState("");
  const [pendingAction, setPendingAction] = useState<{ title: string; summary: string; run: () => void } | null>(null);
  const [recommendedScript, setRecommendedScript] = useState("");
  const [outcomeReason, setOutcomeReason] = useState("");
  const [diagnosisDraftClass, setDiagnosisDraftClass] = useState<"NORMAL" | "MCI" | "AD_SUSPECT" | "UNCONFIRMED">(
    "UNCONFIRMED",
  );
  const [diagnosisDraftSubClass, setDiagnosisDraftSubClass] = useState<MciSubClass>(null);
  const [diagnosisDraftReason, setDiagnosisDraftReason] = useState("");
  const [followupScheduleDraft, setFollowupScheduleDraft] = useState("");
  const [followupChannelDraft, setFollowupChannelDraft] = useState<"CALL" | "SMS" | "GUARDIAN">("CALL");
  const [followupAssigneeDraft, setFollowupAssigneeDraft] = useState("");
  const [nextContactModalOpen, setNextContactModalOpen] = useState(false);
  const [discontinueModalOpen, setDiscontinueModalOpen] = useState(false);
  const [discontinueCodeDraft, setDiscontinueCodeDraft] = useState("의사거부");
  const [discontinueMemoDraft, setDiscontinueMemoDraft] = useState("");
  const [stage1DetailOpen, setStage1DetailOpen] = useState(false);
  const [neuroDetailOpen, setNeuroDetailOpen] = useState(false);
  const [clinicalDetailOpen, setClinicalDetailOpen] = useState(false);
  const [specialistDetailOpen, setSpecialistDetailOpen] = useState(false);

  const healthRef = useRef<HTMLDivElement>(null);
  const neuroRef = useRef<HTMLDivElement>(null);
  const clinicalRef = useRef<HTMLDivElement>(null);
  const specialistRef = useRef<HTMLDivElement>(null);
  const panelRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const registerPanelRef = (panelId: string) => (node: HTMLDivElement | null) => {
    panelRefs.current[panelId] = node;
  };

  useEffect(() => {
    setCaseSwitching(true);
    const timer = window.setTimeout(() => {
      setCaseData(data ?? null);
      setActiveStep("clinicalEval");
      setActiveWorkflowStep("CLINICAL_EVAL");
      setMemoInput("");
      setBottleneckCodeDraft(data?.bottleneckCode ?? "NONE");
      setBottleneckMemoDraft(data?.bottleneckMemo ?? "");
      setEvidenceExpanded(false);
      setProgramModalOpen(false);
      setAuthorizeModalOpen(false);
      setAuthorizeReason("");
      setLinkageModalOpen(false);
      setQualityDrawerOpen(false);
      setQualityReasons({});
      setQualityResolved({});
      setBranchDrawerOpen(false);
      setBranchReason("");
      setActionConfirmOpen(false);
      setActionConfirmReason("");
      setPendingAction(null);
      setOutcomeReason("");
      setDiagnosisDraftClass(data?.diagnosis.finalClass ?? "UNCONFIRMED");
      setDiagnosisDraftSubClass(data?.diagnosis.mciSubtype ?? null);
      setDiagnosisDraftReason(data?.diagnosis.rationale ?? data?.decision.rationaleSummary ?? "");
      setFollowupScheduleDraft(toDateTimeInputValue(data?.followUpPlan.nextDate));
      setFollowupChannelDraft("CALL");
      setFollowupAssigneeDraft(data?.owner ?? "");
      setNextContactModalOpen(false);
      setDiscontinueModalOpen(false);
      setDiscontinueCodeDraft("의사거부");
      setDiscontinueMemoDraft("");
      setStage1DetailOpen(false);
      setNeuroDetailOpen(false);
      setClinicalDetailOpen(false);
      setSpecialistDetailOpen(false);
      setCaseSwitching(false);
    }, 120);
    return () => window.clearTimeout(timer);
  }, [data]);

  useEffect(() => {
    if (!toastMessage) return;
    const timer = window.setTimeout(() => setToastMessage(null), 2400);
    return () => window.clearTimeout(timer);
  }, [toastMessage]);

  useEffect(() => {
    if (!focusedStep) return;
    const timer = window.setTimeout(() => setFocusedStep(null), 1600);
    return () => window.clearTimeout(timer);
  }, [focusedStep]);

  useEffect(() => {
    if (!activePanelId) return;
    const timer = window.setTimeout(() => setActivePanelId(null), 1800);
    return () => window.clearTimeout(timer);
  }, [activePanelId]);

  useEffect(() => {
    if (!caseData || !branchDrawerOpen) return;
    setBranchDraftClass(caseData.branchPlan.branch);
    setBranchDraftIntensity(caseData.branchPlan.intensityLevel);
    setBranchReason("");
  }, [branchDrawerOpen, caseData]);

  useEffect(() => {
    if (!caseData) return;
    setBottleneckCodeDraft(caseData.bottleneckCode ?? "NONE");
    setBottleneckMemoDraft(caseData.bottleneckMemo ?? "");
    setDiagnosisDraftClass(caseData.diagnosis.finalClass ?? "UNCONFIRMED");
    setDiagnosisDraftSubClass(caseData.diagnosis.mciSubtype ?? null);
    setDiagnosisDraftReason(caseData.diagnosis.rationale ?? caseData.decision.rationaleSummary ?? "");
    setFollowupScheduleDraft(toDateTimeInputValue(caseData.followUpPlan.nextDate));
    setFollowupAssigneeDraft(caseData.owner);
  }, [caseData?.caseId]);

  useEffect(() => {
    if (!caseData) return;
    const script =
      caseData.decision.finalClass === "NORMAL"
        ? "2차 평가 종합 결과는 정상 범위입니다. 생활습관 관리와 정기 점검 일정을 안내드립니다."
        : caseData.decision.finalClass === "MCI"
          ? "2차 평가 종합 결과를 기준으로 재검/프로그램 연계를 안내드립니다. 생활습관 관리 계획을 함께 진행합니다."
          : caseData.decision.finalClass === "AD_SUSPECT"
            ? "감별검사와 병원 연계가 필요합니다. 보호자 동행 및 예약 안내를 함께 진행합니다."
            : "2차 평가 입력 보완 후 분기 결정을 진행해 주세요.";
    setRecommendedScript(script);
  }, [caseData]);

  const focusStep = (stepId: Stage2StepKey) => {
    const targetRef =
      stepId === "healthCheck"
        ? healthRef
        : stepId === "neuropsych"
          ? neuroRef
          : stepId === "clinicalEval"
            ? clinicalRef
            : specialistRef;
    targetRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    setFocusedStep(stepId);
  };

  const openPanel = (panelId: string) => {
    const target = panelRefs.current[panelId];
    if (panelId === "stage2-panel-classification") {
      setEvidenceExpanded(true);
    }
    if (!target) return;
    target.scrollIntoView({ behavior: "smooth", block: "start" });
    target.focus({ preventScroll: true });
    setActivePanelId(panelId);
  };

  const openWorkflowStep = (workflowStep: WorkflowStep) => {
    setActiveWorkflowStep(workflowStep);
    if (workflowStep === "VERIFY_STAGE1_EVIDENCE") {
      setActiveStep("healthCheck");
      openPanel("stage2-panel-collection");
      return;
    }
    if (workflowStep === "NEUROPSYCH_TEST") {
      setActiveStep("neuropsych");
      openPanel("stage2-panel-collection");
      focusStep("neuropsych");
      return;
    }
    if (workflowStep === "CLINICAL_EVAL") {
      setActiveStep("clinicalEval");
      openPanel("stage2-panel-collection");
      focusStep("clinicalEval");
      return;
    }
    if (workflowStep === "SPECIALIST_VISIT") {
      setActiveStep("specialist");
      openPanel("stage2-panel-referral");
      focusStep("specialist");
      return;
    }
    if (workflowStep === "CONFIRM_DIAGNOSIS") {
      setActiveStep("specialist");
      openPanel("stage2-panel-diagnosis-confirm");
      return;
    }
    openPanel("stage2-panel-followup-todo");
  };

  const applyMutation = (
    mutate: (prev: Stage2CaseDetailData, timestamp: string) => Stage2CaseDetailData,
    options?: {
      auditMessage?: string;
      memoMessage?: string;
      toast?: string;
      actor?: string;
    },
  ) => {
    setCaseData((prev) => {
      if (!prev) return prev;
      const timestamp = formatDateTime(new Date());
      let next = mutate(prev, timestamp);

      if (options?.auditMessage) {
        const actor = options.actor ?? prev.owner;
        const log: Stage2AuditLogItem = {
          id: `AUD-${Date.now()}-${next.auditLogs.length}`,
          timestamp,
          actor,
          message: options.auditMessage,
        };
        next = {
          ...next,
          auditLogs: [log, ...next.auditLogs],
          auditEvents: [
            {
              at: timestamp,
              actor,
              action: options.auditMessage,
              reason: options.memoMessage,
              summary: options.auditMessage,
            },
            ...next.auditEvents,
          ],
        };
      }

      if (options?.memoMessage) {
        const memo: Stage2MemoItem = {
          id: `MEMO-${Date.now()}-${next.memos.length}`,
          timestamp,
          author: options.actor ?? prev.owner,
          content: options.memoMessage,
        };
        next = { ...next, memos: [memo, ...next.memos] };
      }

      next = {
        ...next,
        lastUpdatedAt: timestamp,
        missingTotal: computeMissingTotal(next),
      };

      return next;
    });

    if (options?.toast) {
      setToastMessage(options.toast);
    }
  };

  const updateStepStatus = (stepId: Stage2StepKey, nextStatus?: StepStatus) => {
    const currentStatus = caseData?.steps[stepId].status ?? "PENDING";
    const resolvedStatus = nextStatus ?? nextStepStatus(currentStatus);

    applyMutation(
      (prev, timestamp) => {
        const current = prev.steps[stepId].status;
        const status = nextStatus ?? nextStepStatus(current);
        const nextSteps: Stage2Steps = {
          ...prev.steps,
          [stepId]: {
            ...prev.steps[stepId],
            status,
            date: prev.steps[stepId].date ?? timestamp,
          },
        };

        const decisionCanConfirm =
          nextSteps.clinicalEval.status === "DONE" && nextSteps.specialist.status === "DONE";

        let nextDecision = prev.decision;
        if (prev.decision.class === "UNCONFIRMED" && decisionCanConfirm) {
          const fallbackClass: Stage2Class =
            prev.followUp.referralStatus === "SENT"
              ? "DEMENTIA"
              : inferClassFromHealthSummary(prev.steps.healthCheck.summary);

          const fallbackSubClass: MciSubClass =
            fallbackClass === "MCI"
              ? prev.decision.mciSubClass ??
                (prev.followUp.programPlan?.domains.includes("COGNITIVE") ? "MODERATE" : "MILD_OK")
              : null;

          nextDecision = {
            ...prev.decision,
            class: fallbackClass,
            mciSubClass: fallbackSubClass,
            evidence: [
              "Step3/Step4 완료로 종합 분류(운영 참고) 확정",
              ...prev.decision.evidence.filter((item) => !item.includes("분류 미확정")),
            ],
          };
        }

        const nextFollowUp = normalizeFollowUpByDecision(
          nextDecision.class,
          nextDecision.mciSubClass,
          prev.followUp,
        );

        const nextChecklist = prev.checklist.map((item) =>
          item.stepId === stepId
            ? {
                ...item,
                done: status === "DONE",
                note: status === "DONE" ? "완료" : item.note,
              }
            : item,
        );

        const nextTimeline = prev.timeline.map((item) => {
          if (item.stepId === stepId) {
            return {
              ...item,
              status: timelineStatusFromStep(status),
              at: timestamp,
            };
          }
          if (item.title === "종합 분류(운영 참고)") {
            return {
              ...item,
              status: nextDecision.class === "UNCONFIRMED" ? "PENDING" : "DONE",
              at: timestamp,
            };
          }
          return item;
        });

        return {
          ...prev,
          steps: nextSteps,
          decision: nextDecision,
          followUp: nextFollowUp,
          checklist: nextChecklist,
          timeline: nextTimeline,
        };
      },
      {
        auditMessage: `${stepTitle(stepId)} 상태 업데이트 (${statusLabel(resolvedStatus)})`,
        toast: `${stepTitle(stepId)} 업데이트가 반영되었습니다.`,
      },
    );
  };

  const advanceReferral = () => {
    applyMutation(
      (prev, timestamp) => {
        const nextReferral =
          prev.followUp.referralStatus === "NOT_CREATED"
            ? "DRAFT"
            : prev.followUp.referralStatus === "DRAFT"
              ? "SENT"
              : "SENT";

        const nextTimeline = prev.timeline.map((item) => {
          if (item.title === "후속조치 연계") {
            return {
              ...item,
              status: nextReferral === "SENT" ? "DONE" : "PENDING",
              at: timestamp,
            };
          }
          return item;
        });

        return {
          ...prev,
          followUp: {
            ...prev.followUp,
            referralStatus: nextReferral,
          },
          linkageStatuses: prev.linkageStatuses.map((item) =>
            item.type === "HOSPITAL"
              ? {
                  ...item,
                  status: nextReferral === "SENT" ? "COMPLETED" : "CREATED",
                  lastActor: prev.owner,
                  lastAt: timestamp,
                }
              : item,
          ),
          timeline: nextTimeline,
          auditEvents: [
            {
              at: timestamp,
              actor: prev.owner,
              action: "연계 생성/완료",
              reason: "감별검사 의뢰 진행",
              summary: `병원 연계 ${nextReferral}`,
            },
            ...prev.auditEvents,
          ],
        };
      },
      {
        auditMessage: "감별검사 의뢰서 상태 업데이트",
        memoMessage: "감별검사 의뢰서 상태 업데이트",
        toast: "의뢰서 진행 상태가 반영되었습니다.",
      },
    );
  };

  const advanceReservation = () => {
    applyMutation(
      (prev, timestamp) => {
        const nextReservation =
          prev.followUp.reservationStatus === "NOT_REGISTERED"
            ? "REQUESTED"
            : prev.followUp.reservationStatus === "REQUESTED"
              ? "CONFIRMED"
              : "CONFIRMED";

        const nextTimeline = prev.timeline.map((item) => {
          if (item.title === "후속조치 연계") {
            return {
              ...item,
              status: nextReservation === "CONFIRMED" ? "DONE" : "PENDING",
              at: timestamp,
            };
          }
          return item;
        });

        return {
          ...prev,
          followUp: {
            ...prev.followUp,
            reservationStatus: nextReservation,
          },
          linkageStatuses: prev.linkageStatuses.map((item) =>
            item.type === "COUNSELING"
              ? {
                  ...item,
                  status: nextReservation === "CONFIRMED" ? "COMPLETED" : "CREATED",
                  lastActor: prev.owner,
                  lastAt: timestamp,
                }
              : item,
          ),
          timeline: nextTimeline,
          auditEvents: [
            {
              at: timestamp,
              actor: prev.owner,
              action: "연계 생성/완료",
              reason: "예약/의뢰 연계 진행",
              summary: `상담소 연계 ${nextReservation}`,
            },
            ...prev.auditEvents,
          ],
        };
      },
      {
        auditMessage: "감별검사 예약/의뢰 연계 상태 업데이트",
        memoMessage: "예약/의뢰 연계 실행 기록",
        toast: "예약/의뢰 연계 상태가 반영되었습니다.",
      },
    );
  };

  const saveOpsMemo = () => {
    if (!memoInput.trim()) {
      setToastMessage("저장할 운영 메모를 입력해 주세요.");
      return;
    }

    const content = memoInput.trim();
    applyMutation(
      (prev) => prev,
      {
        auditMessage: `운영 메모 저장: ${content.slice(0, 40)}`,
        memoMessage: content,
        toast: "운영 메모가 저장되었습니다.",
      },
    );
    setMemoInput("");
  };

  const runAuthorize = () => {
    const reason = authorizeReason.trim() || "운영 검토";
    applyMutation(
      (prev) => prev,
      {
        auditMessage: `권한자 열람 실행 (${reason})`,
        memoMessage: `권한자 열람 실행 사유: ${reason}`,
        toast: "권한자 열람 실행 기록이 저장되었습니다.",
      },
    );
    setAuthorizeModalOpen(false);
    setAuthorizeReason("");
  };

  const requestOpsSupport = () => {
    applyMutation(
      (prev) => prev,
      {
        auditMessage: "운영 지원 요청 접수",
        memoMessage: "운영 지원 요청이 접수되어 담당자 검토를 요청했습니다.",
        toast: "운영 지원 요청이 기록되었습니다.",
      },
    );
  };

  const toggleProgramDomain = (domain: ProgramDomain) => {
    setProgramDraftDomains((prev) =>
      prev.includes(domain) ? prev.filter((item) => item !== domain) : [...prev, domain],
    );
  };

  const openProgramModal = () => {
    if (!caseData) return;
    setProgramDraftDomains(caseData.followUp.programPlan?.domains ?? recommendedDomains(caseData.decision.mciSubClass));
    setProgramDraftNote(caseData.followUp.programPlan?.notes ?? "");
    setProgramModalOpen(true);
  };

  const openLinkagePanel = () => {
    setLinkageModalOpen(true);
  };

  const saveProgramPlan = () => {
    if (!caseData) return;
    if (programDraftDomains.length === 0) {
      setToastMessage("최소 1개 영역을 선택해 주세요.");
      return;
    }

    applyMutation(
      (prev) => ({
        ...prev,
        followUp: {
          ...prev.followUp,
          programPlan: {
            domains: programDraftDomains,
            notes: programDraftNote.trim() || undefined,
          },
        },
      }),
      {
        auditMessage: "사례관리 프로그램 계획 저장",
        memoMessage: `프로그램 연계: ${programDraftDomains.map(domainLabel).join(", ")}${
          programDraftNote.trim() ? ` / ${programDraftNote.trim()}` : ""
        }`,
        toast: "프로그램 연계 계획이 저장되었습니다.",
      },
    );

    setProgramModalOpen(false);
  };

  const saveBranchPlan = () => {
    const classFromDraft: Stage2Class =
      branchDraftClass === "AD_SUSPECT"
        ? "DEMENTIA"
        : branchDraftClass === "MCI"
          ? "MCI"
          : branchDraftClass === "NORMAL"
            ? "NORMAL"
            : "UNCONFIRMED";

    applyMutation(
      (prev, timestamp) => {
        const nextMciSubClass: MciSubClass =
          classFromDraft === "MCI" ? prev.decision.mciSubClass ?? "MODERATE" : null;
        const nextDecision = {
          ...prev.decision,
          class: classFromDraft,
          mciSubClass: nextMciSubClass,
          finalClass: branchDraftClass,
          decidedAt: classFromDraft === "UNCONFIRMED" ? undefined : timestamp,
          decidedBy: classFromDraft === "UNCONFIRMED" ? undefined : prev.owner,
          rationaleSummary:
            branchReason.trim() ||
            "운영 권고는 기준 기반이며 최종 결정은 담당자/의료진 확인 후 확정",
        };
        return {
          ...prev,
          decision: nextDecision,
          branchPlan: {
            ...prev.branchPlan,
            branch: branchDraftClass,
            intensityLevel: branchDraftIntensity,
          },
          timeline: prev.timeline.map((item) =>
            item.title === "종합 분류(운영 참고)"
              ? {
                  ...item,
                  status: classFromDraft === "UNCONFIRMED" ? "PENDING" : "DONE",
                  at: timestamp,
                }
              : item,
          ),
          auditEvents: [
            {
              at: timestamp,
              actor: prev.owner,
              action: "분기/레벨 변경",
              reason: branchReason.trim() || "사유 미입력",
              summary: `${branchDraftClass} / ${branchDraftIntensity}`,
            },
            ...prev.auditEvents,
          ],
        };
      },
      {
        auditMessage: `분기/레벨 변경: ${branchDraftClass} / ${branchDraftIntensity}`,
        memoMessage: `분기/레벨 변경 사유: ${branchReason.trim() || "사유 미입력"}`,
        toast: "분기/레벨 설정이 저장되었습니다.",
      },
    );
    setBranchDrawerOpen(false);
  };

  const saveBottleneck = () => {
    applyMutation(
      (prev) => ({
        ...prev,
        bottleneckCode: bottleneckCodeDraft,
        bottleneckMemo: bottleneckMemoDraft.trim() || undefined,
      }),
      {
        auditMessage: `병목 갱신: ${BOTTLENECK_LABEL[bottleneckCodeDraft]}`,
        memoMessage: `병목 사유: ${bottleneckMemoDraft.trim() || "사유 미입력"}`,
        toast: "병목 정보가 저장되었습니다.",
      },
    );
  };

  const updateReferralStatus = (status: ReferralStatus) => {
    applyMutation(
      (prev, timestamp) => {
        const nextReferralStatus =
          status === "RESULT_RECEIVED" ? "SENT" : status === "REFERRED" ? "DRAFT" : prev.followUp.referralStatus;
        const nextReservationStatus =
          status === "RESERVATION_CONFIRMED"
            ? "CONFIRMED"
            : status === "RESERVATION_REQUESTED"
              ? "REQUESTED"
              : prev.followUp.reservationStatus;
        return {
          ...prev,
          referral: {
            ...prev.referral,
            status,
            lastRequestedAt: timestamp,
            resultReceivedAt: status === "RESULT_RECEIVED" ? timestamp : prev.referral.resultReceivedAt,
          },
          followUp: {
            ...prev.followUp,
            referralStatus: nextReferralStatus,
            reservationStatus: nextReservationStatus,
          },
          linkageStatuses: prev.linkageStatuses.map((item) =>
            item.type === "HOSPITAL"
              ? {
                  ...item,
                  status:
                    status === "RESULT_RECEIVED" || status === "RESERVATION_CONFIRMED"
                      ? "COMPLETED"
                      : status === "DELAYED"
                        ? "CANCELED"
                        : "CREATED",
                  lastActor: prev.owner,
                  lastAt: timestamp,
                  nextSchedule: prev.referral.schedule ?? item.nextSchedule,
                }
              : item,
          ),
        };
      },
      {
        auditMessage: `연계 상태 변경: ${REFERRAL_LABEL[status]}`,
        memoMessage: `연계 상태를 ${REFERRAL_LABEL[status]}(으)로 변경`,
        toast: `연계 상태가 ${REFERRAL_LABEL[status]}(으)로 반영되었습니다.`,
      },
    );
  };

  const confirmDiagnosisDecision = () => {
    const rationale = diagnosisDraftReason.trim();
    if (!rationale) {
      setToastMessage("확정 근거를 입력해 주세요.");
      return;
    }
    const classFromDraft: Stage2Class =
      diagnosisDraftClass === "AD_SUSPECT"
        ? "DEMENTIA"
        : diagnosisDraftClass === "MCI"
          ? "MCI"
          : diagnosisDraftClass === "NORMAL"
            ? "NORMAL"
            : "UNCONFIRMED";
    applyMutation(
      (prev, timestamp) => {
        const nextSubClass: MciSubClass = classFromDraft === "MCI" ? diagnosisDraftSubClass ?? "MODERATE" : null;
        const nextTodos =
          classFromDraft === "UNCONFIRMED"
            ? prev.followupTodos
            : buildFollowupTodosByDecision(classFromDraft, nextSubClass, prev.owner, timestamp);
        return {
          ...prev,
          stage2Status: classFromDraft === "UNCONFIRMED" ? "IN_PROGRESS" : "JUDGMENT_DONE",
          decision: {
            ...prev.decision,
            class: classFromDraft,
            mciSubClass: nextSubClass,
            finalClass: diagnosisDraftClass,
            decidedAt: classFromDraft === "UNCONFIRMED" ? undefined : timestamp,
            decidedBy: classFromDraft === "UNCONFIRMED" ? undefined : prev.owner,
            rationaleSummary: rationale,
          },
          diagnosis: {
            ...prev.diagnosis,
            finalClass: diagnosisDraftClass,
            mciSubtype: nextSubClass,
            confirmedBy: classFromDraft === "UNCONFIRMED" ? undefined : prev.owner,
            confirmedAt: classFromDraft === "UNCONFIRMED" ? undefined : timestamp,
            rationale,
          },
          followupTodos: nextTodos,
          followUpPlan: {
            ...prev.followUpPlan,
            nextDate: followupScheduleDraft
              ? formatDateTime(new Date(followupScheduleDraft)).slice(0, 10)
              : prev.followUpPlan.nextDate,
          },
          timeline: prev.timeline.map((item) =>
            item.title === "종합 분류(운영 참고)"
              ? {
                  ...item,
                  status: classFromDraft === "UNCONFIRMED" ? "PENDING" : "DONE",
                  at: timestamp,
                }
              : item,
          ),
        };
      },
      {
        auditMessage: `담당자 확정: ${diagnosisDraftClass}${diagnosisDraftClass === "MCI" && diagnosisDraftSubClass ? `/${MCI_SUBCLASS_LABEL[diagnosisDraftSubClass]}` : ""}`,
        memoMessage: `분류 확정 근거: ${rationale}`,
        toast: "분류 확정과 후속조치 To-do가 반영되었습니다.",
      },
    );
  };

  const saveFollowupSchedule = () => {
    if (!followupScheduleDraft) {
      setToastMessage("다음 접촉 일시를 입력해 주세요.");
      return;
    }
    if (!followupAssigneeDraft.trim()) {
      setToastMessage("담당자를 입력해 주세요.");
      return;
    }
    const parsedAt = new Date(
      followupScheduleDraft.includes("T")
        ? followupScheduleDraft
        : `${followupScheduleDraft}T09:00`,
    );
    const savedAt = formatDateTime(parsedAt);
    if (!savedAt) {
      setToastMessage("유효한 접촉 일시를 입력해 주세요.");
      return;
    }
    applyMutation(
      (prev) => ({
        ...prev,
        followUpPlan: {
          ...prev.followUpPlan,
          nextDate: savedAt.slice(0, 10),
        },
        followupTodos: prev.followupTodos.map((todo, index) =>
          index === 0 ? { ...todo, dueDate: savedAt.slice(0, 10), assignee: followupAssigneeDraft.trim() } : todo,
        ),
        commLogs: [
          {
            id: `comm-${Date.now()}`,
            channel: followupChannelDraft === "GUARDIAN" ? "CALL" : followupChannelDraft,
            result: "다음 접촉 계획 등록",
            at: formatDateTime(new Date()),
            note: `채널 ${followupChannelDraft} · 일시 ${savedAt} · 담당 ${followupAssigneeDraft.trim()}`,
          },
          ...prev.commLogs,
        ],
      }),
      {
        auditMessage: "다음 접촉 계획 생성",
        memoMessage: `채널 ${followupChannelDraft} / 일시 ${savedAt} / 담당 ${followupAssigneeDraft.trim()}`,
        toast: "다음 접촉 계획이 저장되었습니다.",
      },
    );
    setNextContactModalOpen(false);
  };

  const confirmDiscontinueCase = () => {
    if (!discontinueCodeDraft.trim()) {
      setToastMessage("거부 코드를 선택해 주세요.");
      return;
    }
    applyMutation(
      (prev) => ({
        ...prev,
        stage2Status: "DISCONTINUED",
      }),
      {
        auditMessage: "상태 변경: 중단(거부)",
        memoMessage: `거부코드 ${discontinueCodeDraft}${discontinueMemoDraft.trim() ? ` / ${discontinueMemoDraft.trim()}` : ""}`,
        toast: "중단(거부) 상태로 변경되었습니다.",
      },
    );
    setDiscontinueModalOpen(false);
  };

  const toggleTodoStatus = (todoId: string) => {
    applyMutation(
      (prev) => ({
        ...prev,
        followupTodos: prev.followupTodos.map((todo) =>
          todo.id === todoId
            ? {
                ...todo,
                status:
                  todo.status === "WAITING"
                    ? "IN_PROGRESS"
                    : todo.status === "IN_PROGRESS"
                      ? "DONE"
                      : "WAITING",
              }
            : todo,
        ),
      }),
      {
        auditMessage: "후속조치 To-do 상태 변경",
      },
    );
  };

  /* ── SMS 발송 콜백 (SmsPanel 통합) ── */
  const handleStage2SmsSent = (item: SmsHistoryItem) => {
    const isBooking = item.type === "BOOKING";
    applyMutation(
      (prev, timestamp) => {
        const nextReservationStatus = isBooking
          ? prev.followUp.reservationStatus === "NOT_REGISTERED" ? "REQUESTED" : prev.followUp.reservationStatus
          : prev.followUp.reservationStatus;
        return {
          ...prev,
          followUp: { ...prev.followUp, reservationStatus: nextReservationStatus },
          commLogs: [
            {
              id: `comm-${Date.now()}-sms`,
              channel: "SMS",
              templateLabel: item.templateLabel,
              result: item.status,
              at: item.at || timestamp,
              note: item.note,
            },
            ...prev.commLogs,
          ],
          timeline: isBooking
            ? prev.timeline.map((t) =>
                t.title === "후속조치 연계"
                  ? { ...t, status: nextReservationStatus === "CONFIRMED" ? "DONE" : "PENDING", at: item.at }
                  : t,
              )
            : prev.timeline,
        };
      },
      {
        auditMessage: `2차 문자 ${item.mode === "NOW" ? "발송" : "예약"}: ${item.templateLabel} (${item.status})`,
        memoMessage: `2차 문자: ${item.templateLabel}${item.note ? ` / ${item.note}` : ""}`,
        toast: item.status === "SENT" ? "문자 발송이 완료되었습니다." : item.status === "SCHEDULED" ? "문자 예약이 등록되었습니다." : "문자 발송에 실패했습니다.",
      },
    );
  };

  const handleStage2Consultation = (note: string, type: string, templateLabel: string) => {
    applyMutation(
      (prev, timestamp) => ({
        ...prev,
        commLogs: [
          {
            id: `comm-${Date.now()}-call`,
            channel: "CALL",
            templateLabel,
            result: `상담 기록(${type})`,
            at: timestamp,
            note,
          },
          ...prev.commLogs,
        ],
      }),
      {
        auditMessage: `2차 상담 실행 기록 (${type})`,
        memoMessage: `2차 상담 실행: ${templateLabel}${note ? ` / ${note}` : ""}`,
        toast: "상담 실행 기록이 저장되었습니다.",
      },
    );
  };

  const openActionConfirm = (title: string, summary: string, run: () => void) => {
    setPendingAction({ title, summary, run });
    setActionConfirmReason("");
    setActionConfirmOpen(true);
  };

  const confirmPendingAction = () => {
    if (!pendingAction) return;
    pendingAction.run();
    applyMutation(
      (prev) => prev,
      {
        auditMessage: `${pendingAction.title} 실행`,
        memoMessage: `${pendingAction.title} 실행 사유: ${actionConfirmReason.trim() || "사유 미입력"}`,
      },
    );
    setActionConfirmOpen(false);
    setPendingAction(null);
  };

  const checklistProgress = useMemo(() => {
    if (!caseData || caseData.checklist.length === 0) return 0;
    const doneCount = caseData.checklist.filter((item) => item.done).length;
    return Math.round((doneCount / caseData.checklist.length) * 100);
  }, [caseData]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-24 animate-pulse rounded-xl border border-slate-200 bg-white" />
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
          <div className="h-72 animate-pulse rounded-xl border border-slate-200 bg-white xl:col-span-3" />
          <div className="h-72 animate-pulse rounded-xl border border-slate-200 bg-white xl:col-span-6" />
          <div className="h-72 animate-pulse rounded-xl border border-slate-200 bg-white xl:col-span-3" />
        </div>
      </div>
    );
  }

  if (!caseData) {
    return (
      <div className="space-y-4 rounded-xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-900">
        <p className="text-base font-bold">분류 요약을 표시할 데이터가 없음</p>
        <p>Step3/Step4 입력 데이터가 없거나 케이스 로드가 실패했습니다.</p>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={onBack}>
            목록으로 이동
          </Button>
        </div>
      </div>
    );
  }

  const hasIncompleteSteps = STEP_ORDER.some((stepId) => caseData.steps[stepId].status !== "DONE");
  const neuropsychMissingCount = caseData.steps.neuropsych.missingCount ?? 0;
  const hasEvidenceGap = neuropsychMissingCount > 0;
  const diagnosisValidationCase: Stage2CaseDetailData = {
    ...caseData,
    diagnosis: {
      ...caseData.diagnosis,
      rationale: diagnosisDraftReason.trim() || caseData.diagnosis.rationale,
    },
    decision: {
      ...caseData.decision,
      rationaleSummary: diagnosisDraftReason.trim() || caseData.decision.rationaleSummary,
    },
  };
  const missingRequirements = getMissingRequirements(diagnosisValidationCase);
  const canConfirmNow = canConfirmDiagnosis(diagnosisValidationCase);
  const nextActionSuggestion = computeNextAction(caseData);
  const inferredBottleneckCode = deriveBottleneck(caseData) ?? "NONE";
  const effectiveBottleneckCode =
    bottleneckCodeDraft !== "NONE" ? bottleneckCodeDraft : inferredBottleneckCode;
  const showBottleneckTag = effectiveBottleneckCode !== "NONE";
  const needsRecontactPlan =
    effectiveBottleneckCode === "NO_RESPONSE" ||
    caseData.commLogs.some((log) => /(무응답|연락 불가|미응답)/.test(log.result) || /(무응답|연락 불가|미응답)/.test(log.note ?? ""));

  const followUpSummary =
    caseData.decision.class === "NORMAL"
      ? {
          value: `재분석 ${caseData.followUp.reevalTrigger}`,
          helper: "건강검진 업데이트 기반 재분석 모니터링",
          done: caseData.followUp.reevalTrigger === "ON",
        }
      : caseData.decision.class === "MCI" && caseData.decision.mciSubClass !== "HIGH_RISK"
        ? {
            value: caseData.followUp.trackingRegistered ? "추적 등록" : "등록 필요",
            helper: caseData.followUp.programPlan?.domains.length
              ? `프로그램 ${caseData.followUp.programPlan.domains.map(domainLabel).join(", ")}`
              : "프로그램 선택 필요",
            done: caseData.followUp.trackingRegistered && Boolean(caseData.followUp.programPlan?.domains.length),
          }
        : caseData.decision.class === "MCI" || caseData.decision.class === "DEMENTIA"
          ? {
              value:
                caseData.followUp.referralStatus === "SENT" || caseData.followUp.reservationStatus === "CONFIRMED"
                  ? "연계 완료"
                  : caseData.followUp.referralStatus === "DRAFT" || caseData.followUp.reservationStatus === "REQUESTED"
                    ? "연계 진행"
                    : "준비 필요",
              helper: `의뢰 ${caseData.followUp.referralStatus} · 예약 ${caseData.followUp.reservationStatus}`,
              done:
                caseData.followUp.referralStatus === "SENT" || caseData.followUp.reservationStatus === "CONFIRMED",
            }
          : {
              value: "분류 확정 필요",
              helper: "Step3/Step4 완료 후 후속조치가 확정됩니다.",
              done: false,
            };

  const hasFollowUpPending =
    caseData.decision.class !== "UNCONFIRMED" &&
    !followUpSummary.done;
  const coveragePct = stepProgress(caseData.steps);
  const dataQualityPct = clampScore(100 - caseData.missingTotal * 12 - (caseData.steps.neuropsych.missingCount ?? 0) * 3);
  const warningCount =
    Number(hasEvidenceGap) +
    Number(caseData.decision.confidenceNote === "LOW" || caseData.decision.confidenceNote === "CAUTION") +
    Number(hasFollowUpPending);
  const clinicalDone = caseData.steps.clinicalEval.status === "DONE";
  const specialistDone = caseData.steps.specialist.status === "DONE";
  const gateBlocked = !clinicalDone || !specialistDone;
  const recentMemo = caseData.memos[0];
  const recentAudit = caseData.auditLogs[0];
  const latestCommLog = caseData.commLogs[0];
  const cautionSignals = [
    ...(caseData.steps.neuropsych.missingCount ? [`신경심리 누락 ${caseData.steps.neuropsych.missingCount}건`] : []),
    ...(caseData.clinicalSummary.needDifferential ? ["추가 감별 필요"] : []),
    ...(caseData.referral.status === "DELAYED" ? ["병원 회신 지연"] : []),
  ];

  const priorityScore = clampScore(
    20 +
      caseData.missingTotal * 10 +
      (caseData.decision.class === "DEMENTIA"
        ? 28
        : caseData.decision.class === "MCI" && caseData.decision.mciSubClass === "HIGH_RISK"
          ? 24
          : caseData.decision.class === "MCI"
            ? 14
            : 6) +
      (hasIncompleteSteps ? 18 : 4) +
      (hasFollowUpPending ? 10 : 0),
  );
  const priorityLevel = toPriorityLevel(priorityScore);
  const stage2FlowStatus = {
    S1: caseData.stage1EvidenceSummary.length > 0 ? "DONE" : "MISSING",
    S2: caseData.steps.neuropsych.status === "DONE" ? "DONE" : caseData.steps.neuropsych.status === "MISSING" ? "MISSING" : "WAITING",
    S3: caseData.steps.clinicalEval.status === "DONE" ? "DONE" : caseData.steps.clinicalEval.status === "MISSING" ? "MISSING" : "WAITING",
    S4: caseData.steps.specialist.status === "DONE" ? "DONE" : caseData.steps.specialist.status === "MISSING" ? "MISSING" : "WAITING",
    S5: caseData.decision.class === "UNCONFIRMED" ? "WAITING" : "DONE",
    S6: caseData.followupTodos.length > 0 && caseData.followupTodos.every((todo) => todo.status === "DONE") ? "DONE" : "WAITING",
  } as const;

  const nowDate = new Date();
  const enteredDate = new Date(caseData.stage2EnteredAt.replace(" ", "T"));
  const targetDate = new Date(caseData.targetCompletionAt.replace(" ", "T"));
  const elapsedDays = Number.isNaN(enteredDate.getTime())
    ? 0
    : Math.max(0, Math.floor((nowDate.getTime() - enteredDate.getTime()) / (1000 * 60 * 60 * 24)));
  const remainingDays = Number.isNaN(targetDate.getTime())
    ? 0
    : Math.ceil((targetDate.getTime() - nowDate.getTime()) / (1000 * 60 * 60 * 24));
  const delayDays = remainingDays < 0 ? Math.abs(remainingDays) : 0;
  const referralBaseAt = caseData.referral.lastRequestedAt ?? caseData.referral.schedule ?? caseData.lastUpdatedAt;
  const referralBaseDate = new Date(referralBaseAt.replace(" ", "T"));
  const referralDelayDays =
    caseData.referral.status === "RESULT_RECEIVED"
      ? 0
      : Number.isNaN(referralBaseDate.getTime())
        ? 0
        : Math.max(0, Math.floor((nowDate.getTime() - referralBaseDate.getTime()) / (1000 * 60 * 60 * 24)));

  const stage2Config: StageDetailConfig = {
    stage: 2,
    metricCards: [
      {
        key: "classification",
        title: "분류 결과",
        value: classSummary(caseData.decision.class, caseData.decision.mciSubClass),
        sub: caseData.decision.class === "UNCONFIRMED" ? "분류 확정 대기" : "운영 참고 상태",
        updatedAt: caseData.lastUpdatedAt,
        reasons: [
          { text: caseData.decision.evidence[0] ?? "Step3/Step4 데이터가 없어 확실하지 않음", confidence: "mid" },
          { text: caseData.decision.evidence[1] ?? "최근 근거가 부족해 확실하지 않음", confidence: "low" },
          { text: `최근 업데이트 ${caseData.lastUpdatedAt}`, confidence: "high" },
        ],
      },
      {
        key: "mci-subclass",
        title: "MCI 세부분류",
        value: caseData.decision.mciSubClass ? MCI_SUBCLASS_LABEL[caseData.decision.mciSubClass] : "해당 없음",
        sub: "양호/중증/위험 기준",
        updatedAt: caseData.lastUpdatedAt,
        reasons: [
          { text: caseData.decision.class !== "MCI" ? "MCI 분류가 아니어서 해당 없음" : "MCI 분류 기준에 따라 운영자가 확인", confidence: "mid" },
          { text: `임상평가 ${clinicalDone ? "완료" : "대기"} · 전문의 ${specialistDone ? "완료" : "대기"}` },
        ],
      },
      {
        key: "coverage",
        title: "검사 커버리지",
        value: `${coveragePct}%`,
        sub: `필수 단계 완료 ${STEP_ORDER.filter((stepId) => caseData.steps[stepId].status === "DONE").length}/${STEP_ORDER.length}`,
        updatedAt: caseData.lastUpdatedAt,
        reasons: [
          { text: `건강검진 ${statusLabel(caseData.steps.healthCheck.status)} / 신경심리 ${statusLabel(caseData.steps.neuropsych.status)}` },
          { text: `임상평가 ${statusLabel(caseData.steps.clinicalEval.status)} / 전문의 ${statusLabel(caseData.steps.specialist.status)}` },
        ],
      },
      {
        key: "clinical",
        title: "임상평가 완료 여부",
        value: clinicalDone ? "완료" : "대기",
        sub: `체크리스트 ${caseData.steps.clinicalEval.checklistCount ?? 0}개`,
        updatedAt: caseData.steps.clinicalEval.date ?? caseData.lastUpdatedAt,
        reasons: [
          { text: caseData.steps.clinicalEval.evaluator ? `평가자 ${caseData.steps.clinicalEval.evaluator}` : "평가자 정보가 없어 확실하지 않음" },
          { text: caseData.steps.clinicalEval.date ? `입력 시각 ${caseData.steps.clinicalEval.date}` : "입력 시각 누락" },
        ],
      },
      {
        key: "specialist",
        title: "전문의 진찰 상태",
        value: specialistDone ? "완료" : caseData.steps.specialist.status === "PENDING" ? "예약중" : "미확정",
        sub: caseData.steps.specialist.summary ?? "요약 없음",
        updatedAt: caseData.steps.specialist.date ?? caseData.lastUpdatedAt,
        reasons: [
          { text: caseData.steps.specialist.summary ?? "전문의 진찰 메모가 없어 확실하지 않음" },
          { text: caseData.steps.specialist.date ? `기록 시각 ${caseData.steps.specialist.date}` : "연계 시각 누락" },
        ],
      },
      {
        key: "quality",
        title: "데이터 품질",
        value: `${dataQualityPct}%`,
        sub: `누락 ${caseData.missingTotal}건`,
        updatedAt: caseData.lastUpdatedAt,
        reasons: [
          { text: `신경심리 누락 ${caseData.steps.neuropsych.missingCount ?? 0}건` },
          { text: `보호자 연락처 ${caseData.pii.guardianMasked ? "등록" : "미등록"}` },
          { text: caseData.missingTotal > 0 ? "누락 영향으로 확실하지 않음 항목 포함" : "핵심 필드가 채워짐", confidence: caseData.missingTotal > 0 ? "low" : "high" },
        ],
      },
    ],
    steps: [
      {
        id: "S1",
        title: "Stage1 근거 확인",
        desc: "선별 결과/접촉 로그 기반 확인",
        status: stage2FlowStatus.S1,
        reason: caseData.stage1EvidenceSummary.length > 0 ? `근거 ${caseData.stage1EvidenceSummary.length}건 확인` : "근거 요약 누락",
        nextAction: "근거 요약 누락 시 문서 보완을 요청합니다.",
        targetPanelId: "stage2-panel-collection",
      },
      {
        id: "S2",
        title: "2차 1단계 신경심리검사",
        desc: "검사 점수/도메인 결과 확인",
        status: stage2FlowStatus.S2,
        reason: `신경심리 ${statusLabel(caseData.steps.neuropsych.status)} · 누락 ${caseData.steps.neuropsych.missingCount ?? 0}건`,
        nextAction: "미완료 시 검사 입력/보완을 진행합니다.",
        targetPanelId: "stage2-panel-collection",
      },
      {
        id: "S3",
        title: "2차 2단계 임상평가",
        desc: "체크리스트/임상평가 입력",
        status: stage2FlowStatus.S3,
        reason: `임상평가 ${statusLabel(caseData.steps.clinicalEval.status)} · 체크리스트 ${caseData.steps.clinicalEval.checklistCount ?? 0}개`,
        nextAction: "입력 대기/누락 항목을 우선 해소합니다.",
        targetPanelId: "stage2-panel-collection",
      },
      {
        id: "S4",
        title: "전문의 진찰",
        desc: "전문의 연계/소견 기록",
        status: stage2FlowStatus.S4,
        reason: `전문의 ${statusLabel(caseData.steps.specialist.status)} · ${caseData.specialistVisit.summary}`,
        nextAction: "전문의 연계 상태를 갱신하고 기록을 남깁니다.",
        targetPanelId: "stage2-panel-referral",
      },
      {
        id: "S5",
        title: "최종 분류 확정",
        desc: "담당자 확정 및 근거 기록",
        status: stage2FlowStatus.S5,
        reason:
          caseData.decision.class === "UNCONFIRMED"
            ? `확정 대기 · ${missingRequirements[0] ?? "필수 항목 확인 필요"}`
            : `현재 ${classSummary(caseData.decision.class, caseData.decision.mciSubClass)} 확정`,
        nextAction: caseData.decision.class === "UNCONFIRMED" ? "필수 요건 충족 후 담당자 확정을 실행합니다." : "확정 근거와 이력을 점검합니다.",
        targetPanelId: "stage2-panel-diagnosis-confirm",
      },
      {
        id: "S6",
        title: "후속조치 확정/Stage3 전환",
        desc: "To-do/일정 생성 및 관리",
        status: stage2FlowStatus.S6,
        reason:
          caseData.followupTodos.length > 0
            ? `To-do ${caseData.followupTodos.filter((todo) => todo.status === "DONE").length}/${caseData.followupTodos.length}`
            : "후속조치 미생성",
        nextAction: "후속조치 To-do를 생성하고 캘린더 일정을 등록합니다.",
        targetPanelId: "stage2-panel-followup-todo",
      },
    ],
    summaryCards: {
      contact: {
        title: "운영 방식",
        value: caseData.followUp.reevalTrigger === "ON" ? "재분석+수동 점검" : "수동 점검 중심",
        sub: `담당자 ${caseData.owner}`,
        reasons: [
          "재분석 트리거와 누락 상태를 함께 보고 운영자가 결정합니다.",
          "결정 주체는 담당자/의료진이며 화면은 운영 참고입니다.",
        ],
      },
      progress: {
        title: "진행 상태",
        value: `${coveragePct}%`,
        sub: `분류 ${caseData.decision.class === "UNCONFIRMED" ? "미확정" : "확정"}`,
        reasons: [
          `필수 단계 완료 ${STEP_ORDER.filter((stepId) => caseData.steps[stepId].status === "DONE").length}/${STEP_ORDER.length}`,
          hasIncompleteSteps ? "입력 대기 또는 누락 단계가 남아 있습니다." : "핵심 단계가 완료되었습니다.",
        ],
      },
      linkage: {
        title: "예약/연계",
        value:
          caseData.followUp.reservationStatus === "CONFIRMED" || caseData.followUp.referralStatus === "SENT"
            ? "실행됨"
            : "추가 실행 필요",
        sub: `예약 ${caseData.followUp.reservationStatus} · 의뢰 ${caseData.followUp.referralStatus}`,
        reasons: [
          "예약/연계 확정 전에는 후속 경로가 확실하지 않을 수 있습니다.",
          caseData.followUp.reservationStatus === "CONFIRMED" || caseData.followUp.referralStatus === "SENT"
            ? "최신 예약 또는 의뢰 상태가 기록되어 있습니다."
            : "예약 또는 의뢰 상태가 미확정입니다.",
        ],
      },
      recent: {
        title: "최근 기록",
        value: `메모 ${caseData.memos.length}건`,
        sub: recentAudit ? `${recentAudit.timestamp} ${recentAudit.actor}` : "감사 로그 없음",
        reasons: [
          recentMemo ? `최근 메모: ${recentMemo.content.slice(0, 28)}` : "최근 메모가 없어 확실하지 않음",
          recentAudit ? `최근 감사 로그: ${recentAudit.message.slice(0, 32)}` : "감사 로그가 없어 확실하지 않음",
        ],
      },
    },
  };

  const stage2KpiStrip = {
    items: [
      {
        label: "Stage2 상태",
        value: STAGE2_STATUS_LABEL[caseData.stage2Status],
        tone: caseData.stage2Status === "ON_HOLD" || caseData.stage2Status === "DISCONTINUED" ? "danger" : "normal",
      },
      ...(showBottleneckTag
        ? [
            {
              label: "병목",
              value: BOTTLENECK_LABEL[effectiveBottleneckCode],
              tone: "warn" as const,
            },
          ]
        : []),
      {
        label: "Stage2 진입일",
        value: caseData.stage2EnteredAt.slice(0, 10),
      },
      {
        label: "경과일",
        value: `D+${elapsedDays}`,
      },
      {
        label: "목표 완료일",
        value: caseData.targetCompletionAt.slice(0, 10),
      },
      ...(delayDays > 0
        ? [
            {
              label: "지연일",
              value: `${delayDays}일`,
              tone: "danger" as const,
            },
          ]
        : []),
      {
        label: "최근 업데이트",
        value: caseData.lastUpdatedAt,
      },
    ] as const,
    note: "운영 참고: 분류/권고는 담당자와 의료진이 확인 후 확정합니다.",
  };

  const stage2PriorityMeta = {
    score: priorityScore,
    level: priorityLevel,
    guide: `현재 우선도는 ${priorityLevel}로 분류되어 다음 작업 우선순위를 안내합니다.`,
    formulaSummary: [
      "단계 누락, 분류 위험군, 예약/의뢰 상태를 합산합니다.",
      "입력 대기와 재검 필요 신호를 가중치로 반영합니다.",
    ],
    weightedFactors: [
      `누락 건수 ${caseData.missingTotal}건`,
      `분류 상태 ${classSummary(caseData.decision.class, caseData.decision.mciSubClass)}`,
      `후속조치 ${followUpSummary.value}`,
    ],
  };

  const requiredDoneCount = STEP_ORDER.filter((stepId) => caseData.steps[stepId].status === "DONE").length;
  const bottleneckSteps = (["clinicalEval", "specialist"] as Stage2StepKey[]).filter(
    (stepId) => caseData.steps[stepId].status !== "DONE",
  );
  const firstBottleneckStep = bottleneckSteps[0];
  const firstBottleneckTitle = firstBottleneckStep ? stepTitle(firstBottleneckStep) : "병목 없음";

  const toRailStatus = (stepId: Stage2StepKey): Stage2RailStatus => {
    const stepStatus = caseData.steps[stepId].status;
    if (stepId === "specialist" && caseData.steps.clinicalEval.status !== "DONE" && stepStatus !== "DONE") {
      return "BLOCKED";
    }
    if (stepStatus === "DONE") return "DONE";
    if (stepStatus === "MISSING") return "MISSING";
    return "WAITING";
  };

  const railSteps = STEP_ORDER.map((stepId) => ({
    stepId,
    title: stepTitle(stepId),
    summary: stepSummary(caseData.steps, stepId),
    status: toRailStatus(stepId),
    updatedAt: caseData.steps[stepId].date ?? "기록일 미입력",
  }));

  const workflowRailSteps: Array<{
    step: WorkflowStep;
    title: string;
    status: Stage2RailStatus;
    updatedAt: string;
    blockedReason?: string;
    summary: string;
  }> = [
    {
      step: "VERIFY_STAGE1_EVIDENCE",
      title: workflowStepLabel("VERIFY_STAGE1_EVIDENCE"),
      status: caseData.stage1EvidenceSummary.length > 0 ? "DONE" : "MISSING",
      updatedAt: caseData.lastUpdatedAt,
      summary: `근거 ${caseData.stage1EvidenceSummary.length}건`,
    },
    {
      step: "NEUROPSYCH_TEST",
      title: workflowStepLabel("NEUROPSYCH_TEST"),
      status: toRailStatus("neuropsych"),
      updatedAt: caseData.steps.neuropsych.date ?? "기록일 미입력",
      blockedReason:
        caseData.steps.neuropsych.status === "DONE" ? undefined : "2차 1단계 결과 입력/보완 필요",
      summary: stepSummary(caseData.steps, "neuropsych"),
    },
    {
      step: "CLINICAL_EVAL",
      title: workflowStepLabel("CLINICAL_EVAL"),
      status: toRailStatus("clinicalEval"),
      updatedAt: caseData.steps.clinicalEval.date ?? "기록일 미입력",
      blockedReason:
        caseData.steps.clinicalEval.status === "DONE" ? undefined : "체크리스트 입력 또는 평가자 확인 필요",
      summary: stepSummary(caseData.steps, "clinicalEval"),
    },
    {
      step: "SPECIALIST_VISIT",
      title: workflowStepLabel("SPECIALIST_VISIT"),
      status: toRailStatus("specialist"),
      updatedAt: caseData.steps.specialist.date ?? "기록일 미입력",
      blockedReason:
        caseData.steps.specialist.status === "DONE" ? undefined : "전문의 진찰 연계/기록이 필요합니다.",
      summary: stepSummary(caseData.steps, "specialist"),
    },
    {
      step: "CONFIRM_DIAGNOSIS",
      title: workflowStepLabel("CONFIRM_DIAGNOSIS"),
      status:
        caseData.decision.class === "UNCONFIRMED"
          ? missingRequirements.length > 0
            ? "BLOCKED"
            : "WAITING"
          : "DONE",
      updatedAt: caseData.decision.decidedAt ?? caseData.lastUpdatedAt,
      blockedReason:
        caseData.decision.class === "UNCONFIRMED" && missingRequirements.length > 0
          ? missingRequirements[0]
          : undefined,
      summary:
        caseData.decision.class === "UNCONFIRMED"
          ? "담당자 확정 대기"
          : classSummary(caseData.decision.class, caseData.decision.mciSubClass),
    },
    {
      step: "CONFIRM_FOLLOWUP",
      title: workflowStepLabel("CONFIRM_FOLLOWUP"),
      status:
        caseData.decision.class === "UNCONFIRMED"
          ? "BLOCKED"
          : caseData.followupTodos.length > 0 && caseData.followupTodos.every((todo) => todo.status === "DONE")
            ? "DONE"
            : "WAITING",
      updatedAt: caseData.followUpPlan.nextDate || caseData.lastUpdatedAt,
      blockedReason:
        caseData.decision.class === "UNCONFIRMED"
          ? "분류 확정 후 후속조치를 생성할 수 있습니다."
          : undefined,
      summary:
        caseData.followupTodos.length > 0
          ? `To-do ${caseData.followupTodos.filter((todo) => todo.status === "DONE").length}/${caseData.followupTodos.length}`
          : "후속조치 대기",
    },
  ];

  const classificationHeadline =
    caseData.decision.class === "UNCONFIRMED"
      ? "분류 미확정: Step3(임상평가)와 Step4(전문의 진찰) 완료 전에는 분류를 확정할 수 없습니다."
      : hasIncompleteSteps
        ? "분류 확정 대기: 필수 단계 누락으로 확정이 보류되었습니다."
        : `운영 참고 분류: ${classSummary(caseData.decision.class, caseData.decision.mciSubClass)} (담당자/의료진 확인 전)`;

  const qualityMissingItems = [
    ...STEP_ORDER.filter((stepId) => caseData.steps[stepId].status !== "DONE").map((stepId, idx) => ({
      id: `missing-step-${stepId}-${idx}`,
      label: `${stepTitle(stepId)} 상태 ${statusLabel(caseData.steps[stepId].status)}`,
      step: stepId,
      severity: stepId === "clinicalEval" || stepId === "specialist" ? "HIGH" : "MID",
    })),
    ...(neuropsychMissingCount > 0
      ? [
          {
            id: "missing-neuropsych-items",
            label: `신경심리검사 세부 누락 ${neuropsychMissingCount}건`,
            step: "neuropsych" as Stage2StepKey,
            severity: "MID",
          },
        ]
      : []),
    ...(!caseData.pii.guardianPhone
      ? [
          {
            id: "missing-guardian-contact",
            label: "보호자 연락처 미등록",
            step: "specialist" as Stage2StepKey,
            severity: "LOW",
          },
        ]
      : []),
  ];

  const qualityWarningItems = [
    ...(caseData.decision.confidenceNote === "LOW" || caseData.decision.confidenceNote === "CAUTION"
      ? [
          {
            id: "warning-confidence",
            label: `분류 신뢰도 ${caseData.decision.confidenceNote}`,
            step: "clinicalEval" as Stage2StepKey,
          },
        ]
      : []),
    ...(hasFollowUpPending
      ? [
          {
            id: "warning-followup-pending",
            label: "후속조치 준비 미완료",
            step: caseData.decision.class === "NORMAL" ? ("healthCheck" as Stage2StepKey) : ("specialist" as Stage2StepKey),
          },
        ]
      : []),
  ];

  const qualityOpenItemsCount =
    qualityMissingItems.filter((item) => !qualityResolved[item.id]).length +
    qualityWarningItems.filter((item) => !qualityResolved[item.id]).length;

  const openStepFromRail = (stepId: Stage2StepKey) => {
    setActiveStep(stepId);
    setFocusedStep(stepId);
    if (stepId === "neuropsych") setActiveWorkflowStep("NEUROPSYCH_TEST");
    if (stepId === "clinicalEval") setActiveWorkflowStep("CLINICAL_EVAL");
    if (stepId === "specialist") setActiveWorkflowStep("SPECIALIST_VISIT");
    if (stepId === "healthCheck") setActiveWorkflowStep("VERIFY_STAGE1_EVIDENCE");
  };

  const navigateToStepWork = (stepId: Stage2StepKey) => {
    setActiveStep(stepId);
    if (stepId === "neuropsych") setActiveWorkflowStep("NEUROPSYCH_TEST");
    if (stepId === "clinicalEval") setActiveWorkflowStep("CLINICAL_EVAL");
    if (stepId === "specialist") setActiveWorkflowStep("SPECIALIST_VISIT");
    if (stepId === "healthCheck") setActiveWorkflowStep("VERIFY_STAGE1_EVIDENCE");
    openPanel("stage2-panel-collection");
    focusStep(stepId);
  };

  const runNextActionSuggestion = () => {
    if (nextActionSuggestion.actionId === "OPEN_STEP2_NEURO") {
      navigateToStepWork("neuropsych");
      return;
    }
    if (nextActionSuggestion.actionId === "OPEN_STEP3_CLINICAL") {
      navigateToStepWork("clinicalEval");
      return;
    }
    if (nextActionSuggestion.actionId === "OPEN_STEP4_SPECIALIST") {
      navigateToStepWork("specialist");
      return;
    }
    if (nextActionSuggestion.actionId === "OPEN_REFERRAL") {
      openPanel("stage2-panel-referral");
      return;
    }
    if (nextActionSuggestion.actionId === "OPEN_DIAGNOSIS_CONFIRM") {
      openPanel("stage2-panel-diagnosis-confirm");
      return;
    }
    if (nextActionSuggestion.actionId === "OPEN_FOLLOWUP_PLAN") {
      openPanel("stage2-panel-followup-todo");
      return;
    }
    if (nextActionSuggestion.actionId === "OPEN_COMMUNICATION") {
      setNextContactModalOpen(true);
      return;
    }
    openPanel("stage2-panel-followup");
  };

  const linkageSummary = caseData.linkageStatuses.map((item) => `${item.type}:${item.status}`).join(" · ");

  const workflowStepDone = {
    STEP1: caseData.steps.clinicalEval.status === "DONE" && caseData.steps.specialist.status === "DONE",
    STEP2: caseData.decision.class !== "UNCONFIRMED",
    STEP3: caseData.linkageStatuses.some((item) => item.status === "CREATED" || item.status === "COMPLETED"),
    STEP4: Boolean(caseData.followUpPlan.nextDate),
  } as const;

  const workflowCards = [
    {
      id: "STEP1" as const,
      title: "STEP 1: 2차 평가 결과 확정",
      status:
        workflowStepDone.STEP1
          ? "DONE"
          : caseData.steps.clinicalEval.status === "MISSING" || caseData.steps.specialist.status === "MISSING"
            ? "MISSING"
            : "WAITING",
      detail: `임상평가 ${statusLabel(caseData.steps.clinicalEval.status)} · 전문의 ${statusLabel(caseData.steps.specialist.status)}`,
      ctaLabel: "결과 확인/확정",
      disabled: Boolean(caseData.readOnly),
      onRun: () =>
        openActionConfirm("2차 평가 결과 확정", "결과 입력/담당자 확인 체크를 완료합니다.", () => {
          updateStepStatus("clinicalEval", "DONE");
          updateStepStatus("specialist", "DONE");
          applyMutation(
            (prev) => ({
              ...prev,
              decision: {
                ...prev.decision,
                class: prev.decision.class === "UNCONFIRMED" ? inferClassFromHealthSummary(prev.steps.healthCheck.summary) : prev.decision.class,
              },
            }),
            {
              auditMessage: "2차 평가 결과 확정",
              memoMessage: "결과 입력/담당자 확인 체크 완료",
            },
          );
        }),
    },
    {
      id: "STEP2" as const,
      title: "STEP 2: 분기 결정(정상/MCI/AD 의심) & 운영강도",
      status: workflowStepDone.STEP2 ? "DONE" : "WAITING",
      detail: `분기 ${decisionChipLabel(caseData)} · 강도 ${caseData.branchPlan.intensityLevel}`,
      ctaLabel: "분기/레벨 설정 열기",
      disabled: Boolean(caseData.readOnly) || gateBlocked,
      onRun: () =>
        openActionConfirm("분기/레벨 설정", "검사 기반 분류와 운영 강도를 설정합니다.", () => {
          setBranchDrawerOpen(true);
        }),
    },
    {
      id: "STEP3" as const,
      title: "STEP 3: 연계/예약 실행",
      status:
        workflowStepDone.STEP3
          ? "DONE"
          : caseData.followUp.reservationStatus === "NOT_REGISTERED" && caseData.followUp.referralStatus === "NOT_CREATED"
            ? "MISSING"
            : "WAITING",
      detail: linkageSummary || "연계 상태 없음",
      ctaLabel: "연계 실행",
      disabled: Boolean(caseData.readOnly) || gateBlocked,
      onRun: () =>
        openActionConfirm("연계/예약 실행", "센터/병원/상담소 연계 실행 화면으로 이동합니다.", () => {
          openLinkagePanel();
        }),
    },
    {
      id: "STEP4" as const,
      title: "STEP 4: 추적 계획 생성",
      status: workflowStepDone.STEP4 ? "DONE" : "WAITING",
      detail: `주기 ${caseData.followUpPlan.cadence} · 다음 ${caseData.followUpPlan.nextDate}`,
      ctaLabel: "추적 계획 생성",
      disabled: Boolean(caseData.readOnly) || gateBlocked,
      onRun: () =>
        openActionConfirm("추적 계획 생성", "재검/모니터링/Stage3 등록 계획을 저장합니다.", () => {
          applyMutation(
            (prev) => ({
              ...prev,
              followUp: {
                ...prev.followUp,
                reevalTrigger: "ON",
              },
            }),
            {
              auditMessage: "추적 계획 생성/수정",
              memoMessage: `추적 주기 ${caseData.followUpPlan.cadence} / 다음 일정 ${caseData.followUpPlan.nextDate}`,
            },
          );
        }),
    },
  ];

  const workItems: Stage2WorkItem[] = [
    {
      id: "work-step1",
      priority: gateBlocked ? "P1" : "P2",
      title: "2차 평가 결과 확정",
      description: "Step1 게이트를 완료해야 분기/연계 작업을 실행할 수 있습니다.",
      step: "clinicalEval",
      completionCriteria: [
        { label: "Step3 임상평가 완료", done: caseData.steps.clinicalEval.status === "DONE" },
        { label: "Step4 전문의 진찰 완료", done: caseData.steps.specialist.status === "DONE" },
      ],
      actions: [
        {
          label: "결과 확인/확정",
          run: workflowCards[0].onRun,
        },
      ],
    },
    {
      id: "work-step2",
      priority: workflowStepDone.STEP2 ? "P2" : "P1",
      title: "분기/레벨 설정",
      description: "검사 기반 분류와 운영 강도를 확정합니다.",
      step: "clinicalEval",
      completionCriteria: [
        { label: "분기 결정", done: workflowStepDone.STEP2 },
        { label: "운영 강도 설정", done: Boolean(caseData.branchPlan.intensityLevel) },
      ],
      actions: gateBlocked
        ? []
        : [
            {
              label: "분기/레벨 설정 열기",
              run: workflowCards[1].onRun,
            },
          ],
    },
    {
      id: "work-step3",
      priority: workflowStepDone.STEP3 ? "P2" : "P1",
      title: "연계/예약 실행",
      description: "센터/병원/상담소 연계를 생성하고 일정 상태를 반영합니다.",
      step: "specialist",
      completionCriteria: [
        { label: "연계 생성", done: workflowStepDone.STEP3 },
        {
          label: "예약/의뢰 상태 기록",
          done: caseData.followUp.reservationStatus !== "NOT_REGISTERED" || caseData.followUp.referralStatus !== "NOT_CREATED",
        },
      ],
      actions: gateBlocked
        ? []
        : [
            {
              label: "연계 실행",
              run: workflowCards[2].onRun,
            },
          ],
    },
    {
      id: "work-step4",
      priority: workflowStepDone.STEP4 ? "P2" : "P1",
      title: "추적 계획 생성",
      description: "재검 주기와 다음 일정을 확정합니다.",
      step: "specialist",
      completionCriteria: [
        { label: "다음 일정 설정", done: workflowStepDone.STEP4 },
        { label: "Stage3 등록 여부 결정", done: typeof caseData.followUpPlan.stage3Enroll === "boolean" },
      ],
      actions: gateBlocked
        ? []
        : [
            {
              label: "추적 계획 생성",
              run: workflowCards[3].onRun,
            },
          ],
    },
    {
      id: "work-program",
      priority:
        caseData.decision.class === "MCI" &&
        caseData.decision.mciSubClass !== "HIGH_RISK" &&
        !caseData.followUp.programPlan
          ? "P1"
          : "P2",
      title: "사례관리 프로그램 선택",
      description: "MCI 분기에서는 세부분류에 맞는 프로그램 도메인 선택이 필요합니다.",
      completionCriteria: [
        {
          label: "프로그램 도메인 선택",
          done: Boolean(caseData.followUp.programPlan?.domains.length),
        },
        {
          label: "연계 메모 기록",
          done: Boolean(caseData.followUp.programPlan?.notes),
        },
      ],
      actions:
        gateBlocked || !shouldActivateProgramLink(caseData)
          ? []
          : [
              {
                label: "프로그램 선택",
                run: () =>
                  openActionConfirm("사례관리 프로그램 선택", "프로그램 선택 모달을 열어 연계 계획을 저장합니다.", () =>
                    openProgramModal(),
                  ),
              },
            ],
    },
    {
      id: "work-quality",
      priority: "P2",
      title: "누락/경고 데이터 보완",
      description: "Partial Data 항목을 점검하고 사유를 기록합니다.",
      completionCriteria: [
        { label: "누락 항목 처리", done: qualityMissingItems.every((item) => qualityResolved[item.id]) },
        { label: "경고 항목 처리", done: qualityWarningItems.every((item) => qualityResolved[item.id]) },
      ],
      actions: [{ label: "품질 Task 열기", run: () => setQualityDrawerOpen(true) }],
    },
    {
      id: "work-memo",
      priority: "P2",
      title: "근거 메모 정리",
      description: "분류 근거/보완 사유를 메모와 감사로그에 남깁니다.",
      completionCriteria: [{ label: "운영 메모 1건 이상", done: caseData.memos.length > 0 || memoInput.trim().length > 0 }],
      actions: [{ label: "운영 메모 저장", run: saveOpsMemo }],
    },
  ];

  const priorityOrder: Record<Stage2WorkItem["priority"], number> = { P1: 1, P2: 2, P3: 3 };
  const orderedWorkItems = [...workItems].sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
  const filteredWorkItems = orderedWorkItems.filter((item) => !item.step || item.step === activeStep);
  const displayWorkItems = filteredWorkItems.length > 0 ? filteredWorkItems : orderedWorkItems;
  const activeStepSummary = railSteps.find((row) => row.stepId === activeStep) ?? railSteps[0];

  const updateQualityReason = (itemId: string, text: string) => {
    setQualityReasons((prev) => ({ ...prev, [itemId]: text }));
  };

  const completeQualityTask = (itemId: string, label: string, step?: Stage2StepKey) => {
    setQualityResolved((prev) => ({ ...prev, [itemId]: true }));
    applyMutation(
      (prev) => prev,
      {
        auditMessage: `데이터 품질 작업 완료: ${label}`,
        memoMessage: `품질 보완 완료 · ${label}${qualityReasons[itemId] ? ` / 사유: ${qualityReasons[itemId]}` : ""}`,
      },
    );
    if (step) {
      openStepFromRail(step);
    }
  };

  const stage2Header = {
    caseId: caseData.caseId,
    stageLabel: caseData.stageLabel,
    assignee: `${caseData.owner} (${caseData.roleLabel})`,
    status: STAGE2_STATUS_LABEL[caseData.stage2Status] ?? WORK_STATUS_LABEL[caseData.workStatus],
    subline: `${caseData.pii.fullName} · ${caseData.pii.birthDate} (${caseData.pii.age}세) · ${caseData.pii.phone} · 케이스키 ${caseData.caseId}`,
    onBack,
    onSupportAction: requestOpsSupport,
    onPrimaryAction: () => {
      openActionConfirm(
        "다음 액션 1순위 실행",
        `${nextActionSuggestion.label} · ${nextActionSuggestion.reason}`,
        runNextActionSuggestion,
      );
    },
  };
  const renderProgramProvisionPanel = () =>
    shouldActivateProgramLink(caseData) || caseData.decision.class === "DEMENTIA" ? (
      <CaseDetailPrograms
        caseId={caseData.caseId}
        stage={2}
        resultLabel={
          caseData.decision.class === "NORMAL" ? "정상"
          : caseData.decision.class === "MCI" ? "MCI"
          : caseData.decision.class === "DEMENTIA" ? "치매"
          : "정상"
        }
        mciSeverity={
          caseData.decision.mciSubClass === "MILD_OK" ? "양호"
          : caseData.decision.mciSubClass === "MODERATE" ? "중등"
          : caseData.decision.mciSubClass === "HIGH_RISK" ? "중증"
          : undefined
        }
        riskTags={[]}
        actorId="OP-001"
        actorName={caseData.owner}
      />
    ) : (
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
        {caseData.decision.class === "NORMAL" && "정상 분류는 재분석 트리거 모니터링이 우선이므로 프로그램 연계는 비활성입니다."}
        {caseData.decision.class === "MCI" &&
          caseData.decision.mciSubClass === "HIGH_RISK" &&
          "MCI 위험 분류는 감별검사 권고가 우선이므로 프로그램 연계를 잠시 비활성합니다. 감별검사 경로를 먼저 검토하세요."}
        {caseData.decision.class === "UNCONFIRMED" &&
          "분류 미확정 상태에서는 프로그램 연계를 활성화할 수 없습니다."}
      </div>
    );

  return (
    <div className="min-h-screen bg-[#f4f7fb] pb-24">
      {toastMessage && (
        <div className="fixed right-4 top-20 z-50 rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow-lg">
          {toastMessage}
        </div>
      )}

      <main className="mx-auto w-full max-w-[1320px] space-y-4 px-4 py-5 md:px-6">
        <StageDetailFrame
          header={stage2Header}
          kpiStrip={{ items: [...stage2KpiStrip.items], note: stage2KpiStrip.note }}
          config={stage2Config}
          priority={stage2PriorityMeta}
          onOpenStep={openPanel}
        />

        {gateBlocked && (
          <Card className="border-red-200 bg-red-50 shadow-sm">
            <CardContent className="px-4 py-3 text-xs text-red-900">
              GateBlocked: Step1(2차 평가 결과 확정) 완료 전에는 분기/연계/추적 작업이 비활성화됩니다.
            </CardContent>
          </Card>
        )}

        {caseData.readOnly && (
          <Card className="border-slate-300 bg-slate-100 shadow-sm">
            <CardContent className="px-4 py-3 text-xs text-slate-700">
              ReadOnly 권한: 조회만 가능합니다. 실행 버튼은 비활성화됩니다.
            </CardContent>
          </Card>
        )}

        {(hasIncompleteSteps || hasEvidenceGap || hasFollowUpPending) && (
          <Card className="border-orange-200 bg-orange-50 shadow-sm">
            <CardContent className="px-4 py-3 text-xs text-orange-900">
              Partial Data 상태: 일부 단계/근거/후속조치가 미완료입니다. 분류 및 권고는 운영 참고로 사용하며 의료진 확인 전 단계입니다.
            </CardContent>
          </Card>
        )}

        <Card className="border-slate-200 bg-white shadow-sm">
          <CardHeader className="border-b border-slate-100 px-4 py-3">
            <CardTitle className="text-sm font-bold text-slate-900">Stage2 분류 확정 보드</CardTitle>
            <p className="text-[11px] text-slate-600">
              운영 참고: 분류/권고는 담당자와 의료진이 확인 후 확정합니다.
            </p>
          </CardHeader>
          <CardContent className="space-y-3 px-4 py-4">
            <div className="grid grid-cols-1 gap-3 xl:grid-cols-12">
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 xl:col-span-8">
                <p className="text-xs font-semibold text-slate-900">개인정보 요약 (Stage2 운영 허용)</p>
                <div className="mt-2 grid grid-cols-1 gap-2 text-[11px] text-slate-700 sm:grid-cols-2">
                  <p><span className="font-semibold">성명:</span> {caseData.pii.fullName}</p>
                  <p><span className="font-semibold">성별/나이:</span> {caseData.pii.gender} · {caseData.pii.age}세</p>
                  <p><span className="font-semibold">생년:</span> {caseData.pii.birthDate}</p>
                  <p><span className="font-semibold">연락처:</span> {caseData.pii.phone}</p>
                  <p className="sm:col-span-2"><span className="font-semibold">주소:</span> {caseData.pii.address}</p>
                  <p><span className="font-semibold">보호자:</span> {caseData.pii.guardianName ?? "미등록"}</p>
                  <p><span className="font-semibold">보호자 연락처:</span> {caseData.pii.guardianPhone ?? "미등록"}</p>
                  <p><span className="font-semibold">동의 상태:</span> {caseData.pii.consentStatus}</p>
                </div>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 xl:col-span-4">
                <p className="text-xs font-semibold text-slate-900">Stage2 핵심 배지</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Badge className="border-blue-200 bg-blue-50 text-blue-800">2차 평가 종합 분류 {decisionChipLabel(caseData)}</Badge>
                  <Badge className="border-violet-200 bg-violet-50 text-violet-800">운영 강도 {caseData.branchPlan.intensityLevel}</Badge>
                  <Badge className={cn("border", delayDays > 0 ? "border-red-200 bg-red-50 text-red-800" : remainingDays <= 2 ? "border-orange-200 bg-orange-50 text-orange-800" : "border-emerald-200 bg-emerald-50 text-emerald-800")}>
                    SLA {delayDays > 0 ? `지연 D+${delayDays}` : remainingDays <= 2 ? "임박" : "정상"}
                  </Badge>
                  <Badge className="border-slate-300 bg-white text-slate-700">상태 {STAGE2_STATUS_LABEL[caseData.stage2Status]}</Badge>
                  {showBottleneckTag ? (
                    <Badge className="border-amber-200 bg-amber-50 text-amber-800">
                      병목 {BOTTLENECK_LABEL[effectiveBottleneckCode]}
                    </Badge>
                  ) : null}
                </div>
                <p className="mt-2 text-[11px] text-slate-600">{classificationHeadline}</p>
                <p className="mt-1 text-[11px] text-slate-600">
                  Stage2 진입 {caseData.stage2EnteredAt} · 경과 D+{elapsedDays} · 목표 {caseData.targetCompletionAt}
                </p>
                <div className="mt-2 rounded-md border border-[#15386a]/20 bg-[#f2f7ff] px-2 py-2">
                  <p className="text-[11px] font-semibold text-[#15386a]">다음 액션 1개</p>
                  <p className="text-xs font-bold text-slate-900">{nextActionSuggestion.label}</p>
                  <p className="text-[11px] text-slate-600">{nextActionSuggestion.reason}</p>
                  <Button
                    className="mt-2 h-7 w-full bg-[#15386a] text-[11px] font-semibold text-white hover:bg-[#102b4e]"
                    onClick={() =>
                      openActionConfirm(
                        "다음 액션 1순위 실행",
                        `${nextActionSuggestion.label} · ${nextActionSuggestion.reason}`,
                        runNextActionSuggestion,
                      )
                    }
                    disabled={caseData.readOnly}
                  >
                    다음 액션 실행
                  </Button>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-1">
                  <Button
                    variant="outline"
                    className="h-7 text-[11px] font-semibold"
                    onClick={() => openActionConfirm("연계 생성", "연계 관리 패널로 이동합니다.", () => openPanel("stage2-panel-referral"))}
                    disabled={caseData.readOnly}
                  >
                    연계 생성
                  </Button>
                  <Button
                    variant="outline"
                    className="h-7 text-[11px] font-semibold"
                    onClick={() => openActionConfirm("문자/전화", "상담/문자 패널로 이동합니다.", () => setSmsModalOpen(true))}
                    disabled={caseData.readOnly}
                  >
                    문자/전화
                  </Button>
                  <Button
                    variant="outline"
                    className="h-7 text-[11px] font-semibold"
                    onClick={() => openActionConfirm("문서 업로드", "자료 누락 보완 작업을 엽니다.", () => setQualityDrawerOpen(true))}
                    disabled={caseData.readOnly}
                  >
                    문서 업로드
                  </Button>
                  <Button
                    variant="outline"
                    className="h-7 text-[11px] font-semibold"
                    onClick={() => openActionConfirm("분류 확정", "분류 확정 카드로 이동합니다.", () => openPanel("stage2-panel-diagnosis-confirm"))}
                    disabled={caseData.readOnly}
                  >
                    분류 확정
                  </Button>
                </div>
                <div className="mt-1 grid grid-cols-2 gap-1">
                  <Button
                    variant="outline"
                    className="h-7 text-[11px] font-semibold"
                    onClick={() =>
                      openActionConfirm("보류 전환", "케이스 상태를 보류로 전환하고 이력을 남깁니다.", () =>
                        applyMutation(
                          (prev) => ({ ...prev, stage2Status: "ON_HOLD" }),
                          { auditMessage: "케이스 상태 변경: 보류", memoMessage: "상단 액션에서 보류 전환" },
                        ),
                      )
                    }
                    disabled={caseData.readOnly}
                  >
                    보류
                  </Button>
                  <Button
                    variant="outline"
                    className="h-7 text-[11px] font-semibold"
                    onClick={() => setDiscontinueModalOpen(true)}
                    disabled={caseData.readOnly}
                  >
                    중단(거부)
                  </Button>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
              <button
                type="button"
                className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-left"
                onClick={() => navigateToStepWork(firstBottleneckStep ?? "clinicalEval")}
              >
                <p className="text-[11px] text-slate-500">분류 상태</p>
                <p className="mt-1 text-sm font-bold text-slate-900">
                  {caseData.decision.class === "UNCONFIRMED" ? "미확정" : "확정"}
                </p>
                <p className="mt-1 text-[11px] text-slate-600">{classificationHeadline}</p>
              </button>
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                <p className="text-[11px] text-slate-500">필수 단계</p>
                <p className="mt-1 text-sm font-bold text-slate-900">
                  {requiredDoneCount}/{STEP_ORDER.length}
                </p>
                <p className="mt-1 text-[11px] text-slate-600">Step1~4 완료율 {coveragePct}%</p>
              </div>
              <button
                type="button"
                className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-left"
                onClick={() => navigateToStepWork(firstBottleneckStep ?? "clinicalEval")}
              >
                <p className="text-[11px] text-slate-500">병목</p>
                <p className="mt-1 text-sm font-bold text-slate-900">
                  {BOTTLENECK_LABEL[effectiveBottleneckCode]}
                </p>
                <p className="mt-1 text-[11px] text-slate-600">{caseData.bottleneckMemo ?? firstBottleneckTitle}</p>
              </button>
              <button
                type="button"
                className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-left"
                onClick={() => setQualityDrawerOpen(true)}
              >
                <p className="text-[11px] text-slate-500">데이터 품질</p>
                <p className="mt-1 text-sm font-bold text-slate-900">
                  {dataQualityPct}% / 누락 {qualityMissingItems.length} / 경고 {qualityWarningItems.length}
                </p>
                <p className="mt-1 text-[11px] text-slate-600">열린 작업 {qualityOpenItemsCount}건</p>
              </button>
            </div>
          </CardContent>
        </Card>

        <div
          className={cn(
            "grid grid-cols-1 gap-4 xl:grid-cols-12 transition-opacity duration-200",
            caseSwitching && "opacity-60",
          )}
        >
          <aside className="space-y-4 xl:col-span-3">
            <Card className="border-slate-200 bg-white shadow-sm">
              <CardHeader className="border-b border-slate-100 px-4 py-3">
                <CardTitle className="text-sm font-bold text-slate-900">진행단계 mini-stepper</CardTitle>
                <p className="text-[11px] text-slate-600">단계를 누르면 기존 섹션으로 이동합니다.</p>
              </CardHeader>
              <CardContent className="space-y-2 px-3 py-3">
                {workflowRailSteps.map((step) => (
                  <div
                    key={step.step}
                    ref={
                      step.step === "VERIFY_STAGE1_EVIDENCE"
                        ? healthRef
                        : step.step === "NEUROPSYCH_TEST"
                          ? neuroRef
                          : step.step === "CLINICAL_EVAL"
                            ? clinicalRef
                            : step.step === "SPECIALIST_VISIT"
                              ? specialistRef
                              : undefined
                    }
                  >
                    <button
                      type="button"
                      onClick={() => openWorkflowStep(step.step)}
                      className={cn(
                        "w-full rounded-lg border px-3 py-2 text-left transition",
                        activeWorkflowStep === step.step
                          ? "border-[#15386a]/40 bg-[#f2f7ff]"
                          : "border-slate-200 bg-white hover:bg-slate-50",
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-semibold text-slate-900">{step.title}</p>
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-slate-700">
                          <span
                            className={cn(
                              "h-2 w-2 rounded-full",
                              step.status === "DONE"
                                ? "bg-emerald-500"
                                : step.status === "BLOCKED" || step.status === "MISSING"
                                  ? "bg-red-500"
                                  : "bg-blue-500",
                            )}
                          />
                          {railStatusLabel(step.status)}
                        </span>
                      </div>
                      <p className="mt-1 text-[11px] text-slate-600">{step.summary}</p>
                      {step.blockedReason ? (
                        <p className="mt-1 text-[10px] text-amber-700">막힌 이유: {step.blockedReason}</p>
                      ) : null}
                      <p className="mt-1 text-[10px] text-slate-500">{step.updatedAt}</p>
                    </button>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="border-slate-200 bg-white shadow-sm">
              <CardHeader className="border-b border-slate-100 px-4 py-3">
                <CardTitle className="text-sm font-bold text-slate-900">Bottleneck</CardTitle>
                <p className="text-[11px] text-slate-600">병목 코드와 사유를 기록하면 다음 작업 제안이 갱신됩니다.</p>
              </CardHeader>
              <CardContent className="space-y-2 px-3 py-3">
                <div className="space-y-1">
                  <p className="text-[11px] font-semibold text-slate-700">병목 코드</p>
                  <select
                    className="h-8 w-full rounded-md border border-slate-200 bg-white px-2 text-xs"
                    value={bottleneckCodeDraft}
                    onChange={(event) => setBottleneckCodeDraft(event.target.value as BottleneckCode)}
                    disabled={caseData.readOnly}
                  >
                    {(["NONE", "RESERVATION_PENDING", "HOSPITAL_DELAY", "NO_RESPONSE", "MISSING_DOCS", "OTHER"] as const).map(
                      (code) => (
                        <option key={code} value={code}>
                          {BOTTLENECK_LABEL[code]}
                        </option>
                      ),
                    )}
                  </select>
                </div>
                <input
                  type="text"
                  value={bottleneckMemoDraft}
                  onChange={(event) => setBottleneckMemoDraft(event.target.value)}
                  className="h-8 w-full rounded-md border border-slate-200 bg-white px-2 text-xs"
                  placeholder="병목/대기 원인 메모(1줄)"
                />
                <div className="rounded-md border border-slate-200 bg-slate-50 px-2 py-2">
                  <p className="text-[11px] font-semibold text-slate-800">다음 작업 제안</p>
                  <p className="text-[11px] text-slate-700">{nextActionSuggestion.label}</p>
                  <p className="text-[10px] text-slate-600">{nextActionSuggestion.reason}</p>
                </div>
                <Button
                  className="h-8 w-full bg-[#15386a] text-[11px] font-semibold text-white hover:bg-[#102b4e]"
                  onClick={() => openActionConfirm("병목 저장", "병목 코드와 메모를 저장합니다.", saveBottleneck)}
                  disabled={caseData.readOnly}
                >
                  병목 저장
                </Button>
              </CardContent>
            </Card>
          </aside>

          <section className="space-y-4 xl:col-span-6">
            <div
              ref={registerPanelRef("stage2-panel-collection")}
              tabIndex={-1}
              className={cn(
                "rounded-xl transition",
                activePanelId === "stage2-panel-collection" && "ring-2 ring-blue-300 ring-offset-2",
              )}
            >
              <Card className="border-slate-200 bg-white shadow-sm">
              <CardHeader className="border-b border-slate-100 px-4 py-3">
                <CardTitle className="text-sm font-bold text-slate-900">확정 불가 사유 + 근거 타임라인</CardTitle>
                <p className="text-[11px] text-slate-600">결과 화면이 아니라 분류 확정을 위한 행정 작업 화면입니다.</p>
              </CardHeader>
              <CardContent className="space-y-3 px-4 py-4">
                <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-900">
                  {classificationHeadline}
                </div>

                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-semibold text-slate-900">A) Stage1 결과</p>
                    <Badge className={cn("border text-[10px]", caseData.stage1EvidenceSummary.length > 0 ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-red-200 bg-red-50 text-red-800")}>
                      {caseData.stage1EvidenceSummary.length > 0 ? "완료" : "미완료"}
                    </Badge>
                  </div>
                  <div className="mt-2 space-y-1 text-[11px] text-slate-700">
                    <p>선별 근거: {caseData.stage1EvidenceSummary[0] ?? "근거 요약이 없습니다."}</p>
                    <p>
                      접촉 이력: {latestCommLog ? `${latestCommLog.at} · ${latestCommLog.result}` : "최근 접촉 기록 없음"}
                    </p>
                    <p>
                      주의 신호:{" "}
                      {cautionSignals.length > 0 ? cautionSignals.join(", ") : "없음"}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setStage1DetailOpen((prev) => !prev)}
                    className="mt-2 text-[11px] font-semibold text-blue-700"
                  >
                    {stage1DetailOpen ? "자세히 접기" : "자세히"}
                  </button>
                  <div className={cn("mt-2 space-y-1", !stage1DetailOpen && "hidden")}>
                    {caseData.stage1EvidenceSummary.map((item) => (
                      <p key={item} className="text-[11px] text-slate-700">
                        • {item}
                      </p>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-semibold text-slate-900">B) 2차 1단계 신경심리검사</p>
                      <div className="flex items-center gap-1">
                        <Badge className={cn("border text-[10px]", caseData.steps.neuropsych.status === "DONE" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-amber-200 bg-amber-50 text-amber-800")}>
                          {caseData.steps.neuropsych.status === "DONE" ? "완료" : "미완료"}
                        </Badge>
                        {caseData.steps.neuropsych.status !== "DONE" && (
                          <Button
                            variant="outline"
                            className="h-6 px-2 text-[10px] font-semibold"
                            onClick={() =>
                              openActionConfirm(
                                "신경심리검사 보완",
                                "2차 1단계 보완 작업으로 이동합니다.",
                                () => navigateToStepWork("neuropsych"),
                              )
                            }
                            disabled={caseData.readOnly}
                          >
                            {caseData.referral.status === "BEFORE_REFERRAL" ? "예약 생성" : "결과 입력"}
                          </Button>
                        )}
                      </div>
                    </div>
                    <p className="mt-1 text-[11px] text-slate-700">
                      CIST 총점 {caseData.neuropsychSummary.cistTotal}점 · 누락 {caseData.neuropsychSummary.missingCount}건
                    </p>
                    <button
                      type="button"
                      onClick={() => setNeuroDetailOpen((prev) => !prev)}
                      className="mt-2 text-[11px] font-semibold text-blue-700"
                    >
                      {neuroDetailOpen ? "자세히 접기" : "자세히"}
                    </button>
                    <div className={cn("mt-2 space-y-1", !neuroDetailOpen && "hidden")}>
                      {caseData.neuropsychSummary.domains.slice(0, 5).map((domain) => (
                        <div key={domain.domain} className="rounded-md border border-slate-200 bg-white px-2 py-1">
                          <p className="text-[11px] font-semibold text-slate-800">
                            {domain.domain} · {domain.grade}
                          </p>
                          <p className="text-[10px] text-slate-600">{domain.summary}</p>
                        </div>
                      ))}
                    </div>
                    <p className="mt-2 text-[10px] text-slate-500">
                      업데이트 {caseData.neuropsychSummary.updatedAt} · 누락 {caseData.neuropsychSummary.missingCount}건
                    </p>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-semibold text-slate-900">C) 2차 2단계 임상평가</p>
                      <div className="flex items-center gap-1">
                        <Badge className={cn("border text-[10px]", caseData.steps.clinicalEval.status === "DONE" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-amber-200 bg-amber-50 text-amber-800")}>
                          {caseData.steps.clinicalEval.status === "DONE" ? "완료" : "미완료"}
                        </Badge>
                        {caseData.steps.clinicalEval.status !== "DONE" && (
                          <Button
                            variant="outline"
                            className="h-6 px-2 text-[10px] font-semibold"
                            onClick={() =>
                              openActionConfirm(
                                "임상평가 보완",
                                "2차 2단계 입력 작업으로 이동합니다.",
                                () => navigateToStepWork("clinicalEval"),
                              )
                            }
                            disabled={caseData.readOnly}
                          >
                            {caseData.referral.status === "BEFORE_REFERRAL" ? "의뢰/예약" : "결과 재요청"}
                          </Button>
                        )}
                      </div>
                    </div>
                    <p className="mt-1 text-[11px] text-slate-700">
                      평가일 {caseData.steps.clinicalEval.date ?? "미입력"} · 기관 {caseData.referral.org ?? "-"} · 평가자 {caseData.steps.clinicalEval.evaluator ?? "-"}
                    </p>
                    <p className="mt-1 text-[11px] text-slate-700">
                      핵심 요약: {caseData.clinicalSummary.caregiverNote}
                    </p>
                    <button
                      type="button"
                      onClick={() => setClinicalDetailOpen((prev) => !prev)}
                      className="mt-2 text-[11px] font-semibold text-blue-700"
                    >
                      {clinicalDetailOpen ? "자세히 접기" : "자세히"}
                    </button>
                    <div className={cn("mt-2 space-y-1", !clinicalDetailOpen && "hidden")}>
                      <div className="rounded-md border border-slate-200 bg-white px-2 py-1">
                        <p className="text-[11px] font-semibold text-slate-800">일상생활 기능 저하</p>
                        <p className="text-[10px] text-slate-600">{caseData.clinicalSummary.adlImpact === "YES" ? "예" : caseData.clinicalSummary.adlImpact === "NO" ? "아니오" : "불명"}</p>
                      </div>
                      <div className="rounded-md border border-slate-200 bg-white px-2 py-1">
                        <p className="text-[11px] font-semibold text-slate-800">보호자 관찰 소견</p>
                        <p className="text-[10px] text-slate-600">{caseData.clinicalSummary.caregiverNote}</p>
                      </div>
                      <div className="rounded-md border border-slate-200 bg-white px-2 py-1">
                        <p className="text-[11px] font-semibold text-slate-800">우울/수면/약물 영향 플래그</p>
                        <p className="text-[10px] text-slate-600">{caseData.clinicalSummary.flags.join(", ") || "없음"}</p>
                      </div>
                      <div className="rounded-md border border-slate-200 bg-white px-2 py-1">
                        <p className="text-[11px] font-semibold text-slate-800">추가 감별 필요</p>
                        <p className="text-[10px] text-slate-600">{caseData.clinicalSummary.needDifferential ? "필요" : "현재 불필요"}</p>
                      </div>
                      <div className="rounded-md border border-slate-200 bg-white px-2 py-1">
                        <p className="text-[11px] font-semibold text-slate-800">첨부 문서</p>
                        <p className="text-[10px] text-blue-700 underline">{caseData.referral.status === "BEFORE_REFERRAL" ? "문서 없음" : "임상평가 요약 문서"}</p>
                      </div>
                    </div>
                    <p className="mt-2 text-[10px] text-slate-500">업데이트 {caseData.clinicalSummary.updatedAt}</p>
                  </div>
                </div>

                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-semibold text-slate-900">D) 전문의 진찰</p>
                    <div className="flex items-center gap-1">
                      <Badge className={cn("border text-[10px]", caseData.steps.specialist.status === "DONE" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-amber-200 bg-amber-50 text-amber-800")}>
                        {caseData.steps.specialist.status === "DONE" ? "완료" : "미완료"}
                      </Badge>
                      {caseData.steps.specialist.status !== "DONE" && (
                        <Button
                          variant="outline"
                          className="h-6 px-2 text-[10px] font-semibold"
                          onClick={() => openActionConfirm("전문의 진찰 연계", "전문의 진찰 연계/기록 패널로 이동합니다.", () => navigateToStepWork("specialist"))}
                          disabled={caseData.readOnly}
                        >
                          연계 실행
                        </Button>
                      )}
                    </div>
                  </div>
                  <p className="mt-1 text-[11px] text-slate-700">
                    진찰일 {caseData.specialistVisit.date ?? "미입력"} · 기관 {caseData.referral.org ?? "-"} · 의사 {caseData.owner}
                  </p>
                  <p className="mt-1 text-[11px] text-slate-700">소견 요약: {caseData.specialistVisit.summary}</p>
                  <button
                    type="button"
                    onClick={() => setSpecialistDetailOpen((prev) => !prev)}
                    className="mt-2 text-[11px] font-semibold text-blue-700"
                  >
                    {specialistDetailOpen ? "자세히 접기" : "자세히"}
                  </button>
                  <div className={cn("mt-2 rounded-md border border-slate-200 bg-white px-2 py-1", !specialistDetailOpen && "hidden")}>
                    <p className="text-[11px] font-semibold text-slate-800">문서 첨부</p>
                    <p className="text-[10px] text-blue-700 underline">
                      {caseData.specialistVisit.date ? "전문의 소견서.pdf" : "문서 없음"}
                    </p>
                  </div>
                </div>

                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-slate-900">핵심 실행 카드 ({Object.values(workflowStepDone).filter(Boolean).length}/4)</p>
                    <p className="text-[10px] text-slate-500">단계 카드를 누르면 관련 작업으로 이동합니다.</p>
                  </div>
                  <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-2">
                    {workflowCards.map((step) => (
                      <div key={step.id} className="rounded-md border border-slate-200 bg-white p-2">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-[11px] font-semibold text-slate-900">{step.title}</p>
                          <span className={cn("rounded-md border px-2 py-0.5 text-[10px] font-semibold", step.status === "DONE" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : step.status === "MISSING" ? "border-red-200 bg-red-50 text-red-800" : "border-slate-200 bg-slate-100 text-slate-700")}>
                            {step.status}
                          </span>
                        </div>
                        <p className="mt-1 text-[10px] text-slate-600">{step.detail}</p>
                        <Button
                          variant="outline"
                          className="mt-2 h-7 w-full text-[11px] font-semibold"
                          onClick={step.onRun}
                          disabled={step.disabled}
                        >
                          {step.ctaLabel}
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-xs font-semibold text-slate-900">{activeStepSummary.title}</p>
                      <p className="mt-1 text-[11px] text-slate-600">{activeStepSummary.summary}</p>
                    </div>
                    <Badge className={cn("border text-[10px]", railStatusTone(activeStepSummary.status))}>
                      {railStatusLabel(activeStepSummary.status)}
                    </Badge>
                  </div>
                  <div className="mt-2 space-y-1">
                    {(workItems.find((item) => item.step === activeStep)?.completionCriteria ?? []).map((criteria) => (
                      <p key={`${activeStep}-${criteria.label}`} className="text-[11px] text-slate-700">
                        {criteria.done ? "✓" : "○"} {criteria.label}
                      </p>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  {caseData.timeline.map((item) => (
                    <div key={item.id} className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-semibold text-slate-800">{item.title}</p>
                        <span className="text-[10px] text-slate-500">{item.at ?? "시각 미입력"}</span>
                      </div>
                      <p className="mt-1 text-[11px] text-slate-600">상태: {item.status === "DONE" ? "반영됨" : item.status === "PENDING" ? "대기" : "누락"}</p>
                    </div>
                  ))}
                </div>

                <div
                  ref={registerPanelRef("stage2-panel-classification")}
                  tabIndex={-1}
                  className={cn(
                    "rounded-lg transition",
                    activePanelId === "stage2-panel-classification" && "ring-2 ring-blue-300 ring-offset-2",
                  )}
                >
                  <button
                    type="button"
                    onClick={() => setEvidenceExpanded((prev) => !prev)}
                    className="inline-flex items-center text-xs font-semibold text-blue-700"
                  >
                    {evidenceExpanded ? "근거 상세 접기" : "근거 상세 보기(CIST/SNSB 등)"}
                  </button>
                  {evidenceExpanded && (
                    <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
                      {caseData.decision.evidence.map((item) => (
                        <div key={item} className="flex items-start justify-between gap-2">
                          <p className="text-xs text-slate-700">{item}</p>
                          <Button
                            variant="outline"
                            className="h-7 px-2 text-[11px] font-semibold"
                            onClick={() => openStepFromRail("clinicalEval")}
                          >
                            보완 이동
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
              </Card>
            </div>
          </section>

          <aside className="space-y-4 xl:col-span-3">
            <div
              ref={registerPanelRef("stage2-panel-followup")}
              tabIndex={-1}
              className={cn(
                "rounded-xl transition",
                activePanelId === "stage2-panel-followup" && "ring-2 ring-blue-300 ring-offset-2",
              )}
            >
              <Card className="border-slate-200 bg-white shadow-sm">
              <CardHeader className="border-b border-slate-100 px-4 py-3">
                <CardTitle className="text-sm font-bold text-slate-900">Workboard</CardTitle>
                <p className="text-[11px] text-slate-600">P1 작업을 최우선으로 처리하세요.</p>
              </CardHeader>
              <CardContent className="space-y-2 px-3 py-3">
                {displayWorkItems.map((item) => (
                  <div key={item.id} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-bold text-slate-900">
                        {item.priority} · {item.title}
                      </p>
                      {item.step && (
                        <Badge variant="outline" className="text-[10px]">
                          {item.step.toUpperCase()}
                        </Badge>
                      )}
                    </div>
                    <p className="mt-1 text-[11px] text-slate-600">{item.description}</p>
                    <div className="mt-2 space-y-1">
                      {item.completionCriteria.map((criteria) => (
                        <p key={`${item.id}-${criteria.label}`} className="text-[11px] text-slate-700">
                          {criteria.done ? "✓" : "○"} {criteria.label}
                        </p>
                      ))}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {item.actions.map((action) => (
                        <Button
                          key={`${item.id}-${action.label}`}
                          variant="outline"
                          className="h-7 px-2 text-[11px] font-semibold"
                          onClick={() => openActionConfirm(`${item.title} · ${action.label}`, item.description, action.run)}
                          disabled={caseData.readOnly || item.actions.length === 0}
                        >
                          {action.label}
                        </Button>
                      ))}
                      {item.actions.length === 0 && (
                        <p className="text-[10px] text-slate-500">게이트 충족 후 실행 가능합니다.</p>
                      )}
                    </div>
                  </div>
                ))}
              </CardContent>
              </Card>
            </div>

            <div
              ref={registerPanelRef("stage2-panel-referral")}
              tabIndex={-1}
              className={cn(
                "rounded-xl transition",
                activePanelId === "stage2-panel-referral" && "ring-2 ring-blue-300 ring-offset-2",
              )}
            >
              <Card className="border-slate-200 bg-white shadow-sm">
                <CardHeader className="border-b border-slate-100 px-4 py-3">
                  <CardTitle className="text-sm font-bold text-slate-900">연계 상태(의뢰/예약/수신)</CardTitle>
                  <p className="text-[11px] text-slate-600">의뢰전 → 의뢰완료 → 예약요청 → 예약확정 → 결과수신</p>
                </CardHeader>
                <CardContent className="space-y-2 px-3 py-3">
                  <div className="grid grid-cols-5 gap-1 rounded-md border border-slate-200 bg-slate-50 p-2 text-center">
                    {(["BEFORE_REFERRAL", "REFERRED", "RESERVATION_REQUESTED", "RESERVATION_CONFIRMED", "RESULT_RECEIVED"] as const).map((code) => (
                      <span
                        key={code}
                        className={cn(
                          "rounded px-1 py-1 text-[10px] font-semibold",
                          caseData.referral.status === code
                            ? "bg-[#15386a] text-white"
                            : "bg-white text-slate-600",
                        )}
                      >
                        {REFERRAL_LABEL[code]}
                      </span>
                    ))}
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] text-slate-700">
                    <p>
                      <span className="font-semibold">현재 상태:</span> {REFERRAL_LABEL[caseData.referral.status]}
                    </p>
                    <p>
                      <span className="font-semibold">책임 주체:</span> {caseData.referral.owner ?? caseData.owner}
                    </p>
                    <p>
                      <span className="font-semibold">기관/연락처:</span> {caseData.referral.org ?? "-"} / {caseData.referral.contact ?? "-"}
                    </p>
                    <p>
                      <span className="font-semibold">예약일시:</span> {caseData.referral.schedule ?? "-"}
                    </p>
                    <p>
                      <span className="font-semibold">결과수신대기:</span>{" "}
                      {caseData.referral.status === "RESULT_RECEIVED" ? "수신 완료" : `${referralDelayDays}일`}
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-1">
                    <Button
                      variant="outline"
                      className="h-7 text-[11px] font-semibold"
                      onClick={() =>
                        openActionConfirm("의뢰 생성", "의뢰 상태를 업데이트하고 감사 로그를 기록합니다.", () => updateReferralStatus("REFERRED"))
                      }
                      disabled={caseData.readOnly || gateBlocked}
                    >
                      의뢰 생성
                    </Button>
                    <Button
                      variant="outline"
                      className="h-7 text-[11px] font-semibold"
                      onClick={() =>
                        openActionConfirm("예약 확정", "예약 상태를 확정합니다.", () => updateReferralStatus("RESERVATION_CONFIRMED"))
                      }
                      disabled={caseData.readOnly || gateBlocked}
                    >
                      예약 확정
                    </Button>
                    <Button
                      variant="outline"
                      className="h-7 text-[11px] font-semibold"
                      onClick={() =>
                        openActionConfirm("일정 변경", "일정을 재요청 상태로 기록합니다.", () => updateReferralStatus("RE_REQUESTED"))
                      }
                      disabled={caseData.readOnly || gateBlocked}
                    >
                      일정 변경
                    </Button>
                    <Button
                      variant="outline"
                      className="h-7 text-[11px] font-semibold"
                      onClick={() =>
                        openActionConfirm("결과 재요청", "결과 수신 지연 상태를 반영합니다.", () => updateReferralStatus("DELAYED"))
                      }
                      disabled={caseData.readOnly || gateBlocked}
                    >
                      결과 재요청
                    </Button>
                  </div>
                  <Button
                    variant="outline"
                    className="h-7 w-full text-[11px] font-semibold"
                    onClick={() => openActionConfirm("문서 연결", "문서 업로드/품질 작업으로 이동합니다.", () => setQualityDrawerOpen(true))}
                    disabled={caseData.readOnly}
                  >
                    문서 연결
                  </Button>
                </CardContent>
              </Card>
            </div>

            <div
              ref={registerPanelRef("stage2-panel-diagnosis-confirm")}
              tabIndex={-1}
              className={cn(
                "rounded-xl transition",
                activePanelId === "stage2-panel-diagnosis-confirm" && "ring-2 ring-blue-300 ring-offset-2",
              )}
            >
              <Card className="border-slate-200 bg-white shadow-sm">
                <CardHeader className="border-b border-slate-100 px-4 py-3">
                  <CardTitle className="text-sm font-bold text-slate-900">분류 확정 카드</CardTitle>
                  <p className="text-[11px] text-slate-600">담당자 확정 시 후속조치 To-do가 자동 생성됩니다.</p>
                </CardHeader>
                <CardContent className="space-y-2 px-3 py-3">
                  <div className="rounded-md border border-amber-200 bg-amber-50 px-2 py-2 text-[11px] text-amber-900">
                    운영 참고: 분류/권고는 담당자와 의료진이 확인 후 확정합니다.
                  </div>
                  <div className="space-y-1">
                    <p className="text-[11px] font-semibold text-slate-700">분류</p>
                    <select
                      className="h-8 w-full rounded-md border border-slate-200 bg-white px-2 text-xs"
                      value={diagnosisDraftClass}
                      onChange={(event) =>
                        setDiagnosisDraftClass(event.target.value as "NORMAL" | "MCI" | "AD_SUSPECT" | "UNCONFIRMED")
                      }
                      disabled={caseData.readOnly}
                    >
                      <option value="UNCONFIRMED">선택 필요</option>
                      <option value="NORMAL">정상</option>
                      <option value="MCI">MCI</option>
                      <option value="AD_SUSPECT">치매</option>
                    </select>
                  </div>
                  {diagnosisDraftClass === "MCI" && (
                    <div className="flex flex-wrap gap-1">
                      {(["MILD_OK", "MODERATE", "HIGH_RISK"] as const).map((sub) => (
                        <button
                          key={sub}
                          type="button"
                          className={cn(
                            "rounded-md border px-2 py-1 text-[10px] font-semibold",
                            diagnosisDraftSubClass === sub
                              ? "border-violet-300 bg-violet-50 text-violet-800"
                              : "border-slate-200 bg-white text-slate-700",
                          )}
                          onClick={() => setDiagnosisDraftSubClass(sub)}
                          disabled={caseData.readOnly}
                        >
                          {MCI_SUBCLASS_LABEL[sub]}
                        </button>
                      ))}
                    </div>
                  )}
                  <Textarea
                    value={diagnosisDraftReason}
                    onChange={(event) => setDiagnosisDraftReason(event.target.value)}
                    className="min-h-[72px]"
                    placeholder="확정 근거를 최소 1줄 입력하세요."
                  />
                  {!canConfirmNow && (
                    <div className="rounded-md border border-red-200 bg-red-50 px-2 py-2 text-[11px] text-red-800">
                      <p className="font-semibold">필수 요건 미충족</p>
                      {missingRequirements.map((item) => (
                        <p key={item}>- {item}</p>
                      ))}
                    </div>
                  )}
                  <Button
                    className="h-8 w-full bg-[#15386a] text-[11px] font-semibold text-white hover:bg-[#102b4e]"
                    onClick={() =>
                      openActionConfirm("담당자 확정", "분류 확정 및 후속조치 To-do 자동 생성을 실행합니다.", confirmDiagnosisDecision)
                    }
                    disabled={caseData.readOnly || !canConfirmNow}
                  >
                    확정
                  </Button>
                </CardContent>
              </Card>
            </div>

            <div
              ref={registerPanelRef("stage2-panel-followup-todo")}
              tabIndex={-1}
              className={cn(
                "rounded-xl transition",
                activePanelId === "stage2-panel-followup-todo" && "ring-2 ring-blue-300 ring-offset-2",
              )}
            >
              <Card className="border-slate-200 bg-white shadow-sm">
                <CardHeader className="border-b border-slate-100 px-4 py-3">
                  <CardTitle className="text-sm font-bold text-slate-900">후속조치/다음 작업</CardTitle>
                  <p className="text-[11px] text-slate-600">분류 확정 이후 To-do를 처리합니다.</p>
                </CardHeader>
                <CardContent className="space-y-2 px-3 py-3">
                  {caseData.decision.class === "UNCONFIRMED" ? (
                    <div className="rounded-md border border-slate-200 bg-slate-50 px-2 py-2 text-[11px] text-slate-600">
                      분류 확정 후 자동 생성됩니다.
                    </div>
                  ) : caseData.followupTodos.length === 0 ? (
                    <p className="text-[11px] text-slate-600">생성된 To-do가 없습니다.</p>
                  ) : (
                    caseData.followupTodos.map((todo) => (
                      <div key={todo.id} className="rounded-md border border-slate-200 bg-slate-50 px-2 py-2">
                        <p className="text-[11px] font-semibold text-slate-900">
                          {todo.title}
                        </p>
                        <p className="text-[10px] text-slate-600">
                          {todoTypeLabel(todo.type)} · 담당 {todo.assignee ?? "-"} · 마감 {todo.dueDate ?? "-"}
                        </p>
                        <div className="mt-1 flex items-center justify-between">
                          <Badge className={cn("border text-[10px]", todo.status === "DONE" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : todo.status === "IN_PROGRESS" ? "border-blue-200 bg-blue-50 text-blue-800" : "border-slate-200 bg-slate-100 text-slate-700")}>
                            {todo.status}
                          </Badge>
                          <Button
                            variant="outline"
                            className="h-6 px-2 text-[10px] font-semibold"
                            onClick={() =>
                              openActionConfirm("To-do 상태 변경", "후속조치 상태를 순차적으로 변경합니다.", () =>
                                toggleTodoStatus(todo.id),
                              )
                            }
                            disabled={caseData.readOnly}
                          >
                            상태 변경
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                  <div className="rounded-md border border-slate-200 bg-slate-50 px-2 py-2">
                    <p className="text-[11px] font-semibold text-slate-800">다음 접촉 계획</p>
                    <p className="mt-1 text-[10px] text-slate-600">
                      최근 계획: {caseData.followUpPlan.nextDate || "미등록"}
                    </p>
                    <Button
                      variant="outline"
                      className="mt-2 h-7 w-full text-[11px] font-semibold"
                      onClick={() => setNextContactModalOpen(true)}
                      disabled={caseData.readOnly || caseData.decision.class === "UNCONFIRMED" || !needsRecontactPlan}
                    >
                      다음 접촉 계획
                    </Button>
                    <p className={cn("mt-1 text-[10px]", needsRecontactPlan ? "text-amber-700" : "text-slate-500")}>
                      {needsRecontactPlan
                        ? "무응답/재접촉 상황으로 계획 등록이 필요합니다."
                        : "무응답/재접촉 상황에서 버튼이 활성화됩니다."}
                    </p>
                    <div className="mt-2 space-y-1">
                      {caseData.commLogs
                        .filter((log) => log.result.includes("다음 접촉 계획"))
                        .slice(0, 3)
                        .map((log) => (
                          <p key={log.id} className="text-[10px] text-slate-600">
                            {log.at} · {log.note}
                          </p>
                        ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card className="border-slate-200 bg-white shadow-sm">
              <CardHeader className="border-b border-slate-100 px-4 py-3">
                <CardTitle className="text-sm font-bold text-slate-900">상담/문자 실행 (2차)</CardTitle>
                <p className="text-[11px] text-slate-600">분기별 스크립트 추천 + 채널 실행</p>
              </CardHeader>
              <CardContent className="space-y-2 px-3 py-3">
                <div className="grid grid-cols-2 gap-1">
                  <Button
                    variant="outline"
                    className="h-8 text-[11px] font-semibold"
                    onClick={() =>
                      openActionConfirm("사람 직접 상담", "상담 실행 패널을 열어 통화/기록을 진행합니다.", () => setSmsModalOpen(true))
                    }
                    disabled={caseData.readOnly}
                  >
                    <Phone className="h-3.5 w-3.5" />
                    사람 직접 상담
                  </Button>
                  <Button
                    variant="outline"
                    className="h-8 text-[11px] font-semibold"
                    onClick={() =>
                      openActionConfirm("문자 발송", "문자 템플릿 확인 후 발송/예약을 진행합니다.", () => setSmsModalOpen(true))
                    }
                    disabled={caseData.readOnly}
                  >
                    <MessageSquare className="h-3.5 w-3.5" />
                    문자 발송
                  </Button>
                  <Button
                    variant="outline"
                    className="h-8 text-[11px] font-semibold"
                    onClick={() =>
                      openActionConfirm("보호자 안내", "보호자 연락처로 안내를 진행합니다.", () => setSmsModalOpen(true))
                    }
                    disabled={caseData.readOnly || !caseData.pii.guardianPhone}
                  >
                    보호자 안내
                  </Button>
                  <Button
                    variant="outline"
                    className="h-8 text-[11px] font-semibold"
                    onClick={() =>
                      openActionConfirm("기록만 남기기", "접촉 없이 운영 기록만 저장합니다.", () =>
                        applyMutation(
                          (prev) => prev,
                          { auditMessage: "기록만 남기기 실행", memoMessage: "접촉 없이 운영 기록만 저장" },
                        ),
                      )
                    }
                    disabled={caseData.readOnly}
                  >
                    기록만 남기기
                  </Button>
                </div>
                <div className="rounded-md border border-slate-200 bg-slate-50 px-2 py-2">
                  <p className="text-[11px] font-semibold text-slate-800">분기별 기본 스크립트 추천</p>
                  <Textarea value={recommendedScript} onChange={(event) => setRecommendedScript(event.target.value)} className="mt-1 min-h-[86px]" />
                </div>
              </CardContent>
            </Card>

            <div
              ref={registerPanelRef("stage2-panel-schedule-handoff")}
              tabIndex={-1}
              className={cn(
                "rounded-xl transition",
                activePanelId === "stage2-panel-schedule-handoff" && "ring-2 ring-blue-300 ring-offset-2",
              )}
            >
              <Card className="border-slate-200 bg-white shadow-sm">
              <CardHeader className="border-b border-slate-100 px-4 py-3">
                <CardTitle className="text-sm font-bold text-slate-900">응답 결과 처리</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 px-3 py-3">
                <div className="grid grid-cols-2 gap-1">
                  {[
                    "이해/동의(진행)",
                    "추가 설명 필요(재상담)",
                    "보호자 요청(보호자 전환)",
                    "연계 동의(병원/프로그램)",
                    "거부/중단",
                    "무응답 처리",
                  ].map((label) => (
                    <Button
                      key={label}
                      variant="outline"
                      className="h-8 text-[11px] font-semibold"
                      onClick={() => {
                        if (label === "거부/중단") {
                          setDiscontinueModalOpen(true);
                          return;
                        }
                        if (label === "무응답 처리") {
                          setBottleneckCodeDraft("NO_RESPONSE");
                          setNextContactModalOpen(true);
                          return;
                        }
                        openActionConfirm(
                          `응답 결과 처리: ${label}`,
                          "응답 결과를 저장하고 타임라인/Step 상태를 업데이트합니다.",
                          () =>
                            applyMutation(
                              (prev, timestamp) => ({
                                ...prev,
                                timeline: [
                                  {
                                    id: `timeline-stage2-outcome-${Date.now()}`,
                                    title: `응답 결과 처리 - ${label}`,
                                    status: "DONE",
                                    at: timestamp,
                                    stepId: "specialist",
                                  },
                                  ...prev.timeline,
                                ],
                              }),
                              { auditMessage: `응답 결과 처리: ${label}`, memoMessage: `응답 처리 사유: ${outcomeReason || "미입력"}` },
                            ),
                        );
                      }}
                      disabled={caseData.readOnly}
                    >
                      {label}
                    </Button>
                  ))}
                </div>
                <Textarea
                  value={outcomeReason}
                  onChange={(event) => setOutcomeReason(event.target.value)}
                  className="min-h-[72px]"
                  placeholder="응답 처리 사유 입력"
                />
              </CardContent>
              </Card>
            </div>

            <Card className="border-slate-200 bg-white shadow-sm">
              <CardHeader className="border-b border-slate-100 px-4 py-3">
                <CardTitle className="flex items-center justify-between text-sm font-bold text-slate-900">
                  <span className="flex items-center gap-2">
                    <ListChecks className="h-4 w-4 text-slate-600" />
                    체크리스트
                  </span>
                  <span className="text-[11px] text-slate-500">완료율 {checklistProgress}%</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 px-3 py-3">
                {caseData.checklist.map((item) => (
                  <div key={item.id} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                    <div className="flex items-start justify-between gap-2">
                      <button type="button" onClick={() => focusStep(item.stepId)} className="flex-1 text-left">
                        <p className="text-xs font-semibold text-slate-800">{item.label}</p>
                        <p className="mt-1 text-[11px] text-slate-500">{item.note ?? ""}</p>
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          applyMutation(
                            (prev) => {
                              const nextChecklist = prev.checklist.map((row) =>
                                row.id === item.id ? { ...row, done: !row.done } : row,
                              );
                              const nextStatus = !item.done ? "DONE" : "PENDING";
                              const nextSteps = {
                                ...prev.steps,
                                [item.stepId]: {
                                  ...prev.steps[item.stepId],
                                  status: nextStatus as StepStatus,
                                },
                              };
                              return {
                                ...prev,
                                checklist: nextChecklist,
                                steps: nextSteps,
                                timeline: prev.timeline.map((row) =>
                                  row.stepId === item.stepId
                                    ? { ...row, status: timelineStatusFromStep(nextStatus as StepStatus) }
                                    : row,
                                ),
                              };
                            },
                            {
                              auditMessage: `체크리스트 변경: ${item.label} (${item.done ? "대기" : "완료"})`,
                            },
                          )
                        }
                        className={cn(
                          "rounded-md border px-2 py-1 text-[11px] font-semibold",
                          item.done
                            ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                            : "border-orange-200 bg-orange-50 text-orange-800",
                        )}
                      >
                        {item.done ? "완료" : "대기"}
                      </button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="border-slate-200 bg-white shadow-sm">
              <CardHeader className="border-b border-slate-100 px-4 py-3">
                <CardTitle className="flex items-center gap-2 text-sm font-bold text-slate-900">
                  <ShieldAlert className="h-4 w-4 text-slate-600" />
                  감사 로그
                </CardTitle>
              </CardHeader>
              <CardContent className="max-h-[260px] space-y-2 overflow-auto px-3 py-3">
                {caseData.auditEvents.length === 0 ? (
                  <p className="text-xs text-slate-500">감사 로그가 아직 없습니다.</p>
                ) : (
                  caseData.auditEvents.map((event, index) => (
                    <div key={`${event.at}-${event.action}-${index}`} className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1.5">
                      <p className="text-[11px] text-slate-500">
                        {event.at} · {event.actor}
                      </p>
                      <p className="mt-0.5 text-xs font-semibold text-slate-800">{event.action}</p>
                      <p className="text-[11px] text-slate-700">사유: {event.reason ?? "-"}</p>
                      <p className="text-[11px] text-slate-700">{event.summary}</p>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </aside>
        </div>

        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900">
          모든 분류/점수/권고는 운영 참고 정보입니다. 의료진 확인 전 / 담당자 검토 필요.
        </p>
      </main>

      {nextActionSuggestion && (
        <div className="fixed bottom-4 left-4 right-4 z-40 md:hidden">
          <Button
            className="h-12 w-full rounded-xl bg-[#15386a] text-sm font-bold text-white hover:bg-[#102b4e]"
            onClick={() =>
              openActionConfirm(
                "다음 액션 1순위 실행",
                `${nextActionSuggestion.label} · ${nextActionSuggestion.reason}`,
                runNextActionSuggestion,
              )
            }
          >
            <ExternalLink className="h-4 w-4" />
            다음 액션 1순위 실행
          </Button>
        </div>
      )}

      <Dialog open={discontinueModalOpen} onOpenChange={setDiscontinueModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>중단(거부) 처리</DialogTitle>
            <DialogDescription>상태를 중단(거부)로 바꿀 때 거부코드는 필수입니다.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <div className="space-y-1">
              <p className="text-xs font-semibold text-slate-700">거부코드</p>
              <select
                className="h-9 w-full rounded-md border border-slate-200 bg-white px-2 text-xs"
                value={discontinueCodeDraft}
                onChange={(event) => setDiscontinueCodeDraft(event.target.value)}
              >
                <option value="의사거부">의사거부</option>
                <option value="보호자거부">보호자거부</option>
                <option value="연계거부">연계거부</option>
                <option value="기타">기타</option>
              </select>
            </div>
            <Textarea
              value={discontinueMemoDraft}
              onChange={(event) => setDiscontinueMemoDraft(event.target.value)}
              className="min-h-[88px]"
              placeholder="메모(선택)"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDiscontinueModalOpen(false)}>
              취소
            </Button>
            <Button className="bg-[#15386a] text-white hover:bg-[#102b4e]" onClick={confirmDiscontinueCase}>
              저장
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={nextContactModalOpen} onOpenChange={setNextContactModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>다음 접촉 계획</DialogTitle>
            <DialogDescription>무응답/재접촉 상황에서 접촉방법과 일시를 등록합니다.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <select
                className="h-9 rounded-md border border-slate-200 bg-white px-2 text-xs"
                value={followupChannelDraft}
                onChange={(event) => setFollowupChannelDraft(event.target.value as "CALL" | "SMS" | "GUARDIAN")}
              >
                <option value="CALL">전화</option>
                <option value="SMS">문자</option>
                <option value="GUARDIAN">보호자</option>
              </select>
              <input
                type="datetime-local"
                className="h-9 rounded-md border border-slate-200 bg-white px-2 text-xs"
                value={followupScheduleDraft}
                onChange={(event) => setFollowupScheduleDraft(event.target.value)}
              />
            </div>
            <input
              type="text"
              className="h-9 w-full rounded-md border border-slate-200 bg-white px-2 text-xs"
              value={followupAssigneeDraft}
              onChange={(event) => setFollowupAssigneeDraft(event.target.value)}
              placeholder="담당자"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNextContactModalOpen(false)}>
              취소
            </Button>
            <Button className="bg-[#15386a] text-white hover:bg-[#102b4e]" onClick={saveFollowupSchedule}>
              저장
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={actionConfirmOpen} onOpenChange={setActionConfirmOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{pendingAction?.title ?? "작업 실행 확인"}</DialogTitle>
            <DialogDescription>{pendingAction?.summary ?? "작업 실행 사유를 입력하고 진행해 주세요."}</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              운영 참고: 분류/권고는 담당자와 의료진이 확인 후 확정합니다.
            </p>
            <Textarea
              value={actionConfirmReason}
              onChange={(event) => setActionConfirmReason(event.target.value)}
              className="min-h-[96px]"
              placeholder="실행 사유를 입력하세요."
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActionConfirmOpen(false)}>
              취소
            </Button>
            <Button
              className="bg-[#15386a] text-white hover:bg-[#102b4e]"
              onClick={confirmPendingAction}
              disabled={caseData.readOnly}
            >
              확인 후 실행
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={branchDrawerOpen} onOpenChange={setBranchDrawerOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>분기/레벨 설정</DialogTitle>
            <DialogDescription>
              운영 권고는 기준 기반이며 최종 결정은 담당자/의료진 확인 후 확정됩니다.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <p className="text-xs font-semibold text-slate-700">2차 평가 종합 분류</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {(["NORMAL", "MCI", "AD_SUSPECT", "UNCONFIRMED"] as const).map((value) => (
                  <button
                    key={value}
                    type="button"
                    className={cn(
                      "rounded-md border px-3 py-1.5 text-xs font-semibold",
                      branchDraftClass === value
                        ? "border-[#15386a] bg-[#f2f7ff] text-[#15386a]"
                        : "border-slate-200 bg-white text-slate-700",
                    )}
                    onClick={() => setBranchDraftClass(value)}
                  >
                    {value === "AD_SUSPECT" ? "AD 의심" : value}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-700">운영 강도 레벨</p>
              <div className="mt-2 flex gap-2">
                {(["L1", "L2", "L3"] as const).map((level) => (
                  <button
                    key={level}
                    type="button"
                    className={cn(
                      "rounded-md border px-3 py-1.5 text-xs font-semibold",
                      branchDraftIntensity === level
                        ? "border-violet-300 bg-violet-50 text-violet-800"
                        : "border-slate-200 bg-white text-slate-700",
                    )}
                    onClick={() => setBranchDraftIntensity(level)}
                  >
                    {level}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label htmlFor="branch-reason" className="text-xs font-semibold text-slate-700">
                변경 사유
              </label>
              <Textarea
                id="branch-reason"
                value={branchReason}
                onChange={(event) => setBranchReason(event.target.value)}
                className="mt-1 min-h-[96px]"
                placeholder="예: 2차 임상평가/전문의 기록 반영"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBranchDrawerOpen(false)}>
              취소
            </Button>
            <Button
              className="bg-[#15386a] text-white hover:bg-[#102b4e]"
              onClick={saveBranchPlan}
              disabled={caseData.readOnly || gateBlocked}
            >
              저장
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={programModalOpen} onOpenChange={setProgramModalOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>사례관리 프로그램 선택</DialogTitle>
            <DialogDescription>MCI 분류 운영 권고 기준으로 프로그램 도메인을 선택합니다.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {(["PHYSICAL", "COGNITIVE", "DAILY", "FAMILY"] as const).map((domain) => (
                <button
                  key={domain}
                  type="button"
                  className={cn(
                    "rounded-lg border px-3 py-2 text-left",
                    programDraftDomains.includes(domain)
                      ? "border-[#15386a]/40 bg-[#f2f7ff]"
                      : "border-slate-200 bg-slate-50",
                  )}
                  onClick={() => toggleProgramDomain(domain)}
                >
                  <p className="text-xs font-semibold text-slate-900">{domainLabel(domain)}</p>
                  <p className="mt-1 text-[11px] text-slate-600">{domainDescription(domain)}</p>
                </button>
              ))}
            </div>
            <Textarea
              value={programDraftNote}
              onChange={(event) => setProgramDraftNote(event.target.value)}
              className="min-h-[86px]"
              placeholder="프로그램 연계 메모 입력"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setProgramModalOpen(false)}>
              취소
            </Button>
            <Button className="bg-[#15386a] text-white hover:bg-[#102b4e]" onClick={saveProgramPlan} disabled={caseData.readOnly}>
              저장
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={smsModalOpen} onOpenChange={setSmsModalOpen}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto p-0">
          <SmsPanel
            stageLabel="2차"
            templates={STAGE2_SMS_TEMPLATES}
            defaultVars={{
              centerName: caseData.centerName ?? "강남구 치매안심센터",
            }}
            caseId={caseData.caseId}
            citizenPhone={caseData.pii.phone}
            guardianPhone={caseData.pii.guardianPhone}
            onSmsSent={handleStage2SmsSent}
            onConsultation={handleStage2Consultation}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={linkageModalOpen} onOpenChange={setLinkageModalOpen}>
        <DialogContent
          className="!left-1/2 !top-1/2 !max-w-none !translate-x-[-50%] !translate-y-[-50%] gap-0 overflow-hidden p-0"
          style={{
            width: "min(96vw, 1720px)",
            maxWidth: "min(96vw, 1720px)",
            height: "min(94vh, 980px)",
          }}
        >
          <div className="flex h-full min-h-0 flex-col">
            <DialogHeader className="border-b border-slate-100 px-4 py-3 text-left">
              <DialogTitle className="text-base font-bold text-slate-900">연계</DialogTitle>
              <DialogDescription className="text-xs text-slate-600">
                운영 규칙: 확진/자동 판단 표현 금지. 안내·확인·연계 톤 사용. 목적 고지 필수.
              </DialogDescription>
            </DialogHeader>
            <div className="min-h-0 flex-1 overflow-auto px-4 py-4">
              <div className="min-w-[1080px]">{renderProgramProvisionPanel()}</div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={qualityDrawerOpen} onOpenChange={setQualityDrawerOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Data Quality Task Drawer</DialogTitle>
            <DialogDescription>
              누락/경고 항목을 업무로 처리하고 사유를 남깁니다. 완료 시 감사 로그에 자동 기록됩니다.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[60vh] space-y-3 overflow-auto pr-1">
            {[...qualityMissingItems, ...qualityWarningItems].map((item) => {
              const resolved = Boolean(qualityResolved[item.id]);
              return (
                <div key={item.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-semibold text-slate-900">{item.label}</p>
                    <Badge className={cn("border text-[10px]", resolved ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-orange-200 bg-orange-50 text-orange-800")}>
                      {resolved ? "완료" : "대기"}
                    </Badge>
                  </div>
                  {"severity" in item && (
                    <p className="mt-1 text-[11px] text-slate-600">중요도: {item.severity}</p>
                  )}
                  <Textarea
                    value={qualityReasons[item.id] ?? ""}
                    onChange={(event) => updateQualityReason(item.id, event.target.value)}
                    className="mt-2 min-h-[72px]"
                    placeholder="사유 기록(선택)"
                  />
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      className="h-8 px-2 text-[11px] font-semibold"
                      onClick={() => item.step && navigateToStepWork(item.step)}
                      disabled={!item.step}
                    >
                      바로가기
                    </Button>
                    <Button
                      className="h-8 bg-[#15386a] px-2 text-[11px] font-semibold text-white hover:bg-[#102b4e]"
                      onClick={() => completeQualityTask(item.id, item.label, item.step)}
                      disabled={resolved}
                    >
                      완료 처리
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setQualityDrawerOpen(false)}>
              닫기
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={authorizeModalOpen} onOpenChange={setAuthorizeModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>권한자 열람 실행</DialogTitle>
            <DialogDescription>
              개인정보 열람은 운영 참고 범위에서만 수행하며, 감사 로그에 자동 기록됩니다.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              운영 참고/의료진 확인 전 · 담당자 검토 필요
            </div>

            <div>
              <label htmlFor="authorize-reason" className="text-xs font-semibold text-slate-700">
                열람 사유
              </label>
              <Textarea
                id="authorize-reason"
                value={authorizeReason}
                onChange={(event) => setAuthorizeReason(event.target.value)}
                className="mt-1 min-h-[96px]"
                placeholder="예: 보호자 문의 대응을 위한 연락처 확인"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAuthorizeModalOpen(false)}>
              닫기
            </Button>
            <Button className="bg-[#15386a] text-white hover:bg-[#102b4e]" onClick={runAuthorize}>
              기록 후 열람 실행
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function InfoLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-slate-200 bg-white px-2 py-1">
      <p className="text-[11px] text-slate-500">{label}</p>
      <p className="text-xs font-semibold text-slate-700">{value}</p>
    </div>
  );
}
