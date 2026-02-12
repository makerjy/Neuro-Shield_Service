import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Circle,
  CircleDashed,
  Eye,
  ExternalLink,
  ListChecks,
  MessageSquare,
  Phone,
  ShieldAlert,
  ShieldCheck,
  Stethoscope,
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
import type {
  FollowUpState,
  MciSubClass,
  ProgramDomain,
  Stage2ActionKey,
  Stage2AuditLogItem,
  Stage2CaseDetailData,
  Stage2ChecklistItem,
  Stage2Class,
  Stage2MemoItem,
  Stage2NextActionItem,
  Stage2StepKey,
  Stage2Steps,
  Stage2TimelineItem,
  StepStatus,
} from "./stage2Types";

interface CaseDetailStage2PageProps {
  data?: Stage2CaseDetailData | null;
  onBack: () => void;
  isLoading?: boolean;
}

const STEP_ORDER: Stage2StepKey[] = ["healthCheck", "neuropsych", "clinicalEval", "specialist"];
const PROGRAM_DOMAINS: ProgramDomain[] = ["PHYSICAL", "COGNITIVE", "DAILY", "FAMILY"];

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

function formatDateTime(input: Date | string): string {
  const date = input instanceof Date ? input : new Date(input.includes("T") ? input : input.replace(" ", "T"));
  if (Number.isNaN(date.getTime())) {
    return typeof input === "string" ? input : "";
  }
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate(),
  ).padStart(2, "0")} ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function statusLabel(status: StepStatus): string {
  if (status === "DONE") return "완료";
  if (status === "INPUT_REQUIRED") return "입력대기";
  if (status === "MISSING") return "누락";
  return "대기";
}

function statusTone(status: StepStatus): string {
  if (status === "DONE") return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (status === "INPUT_REQUIRED") return "border-orange-200 bg-orange-50 text-orange-800";
  if (status === "MISSING") return "border-red-200 bg-red-50 text-red-800";
  return "border-slate-200 bg-slate-100 text-slate-700";
}

function workStatusTone(status: Stage2CaseDetailData["workStatus"]): string {
  if (status === "DONE") return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (status === "IN_PROGRESS") return "border-blue-200 bg-blue-50 text-blue-800";
  return "border-slate-200 bg-slate-100 text-slate-700";
}

function confidenceTone(confidence?: Stage2CaseDetailData["decision"]["confidenceNote"]): string {
  if (confidence === "LOW") return "border-red-200 bg-red-50 text-red-800";
  if (confidence === "CAUTION") return "border-orange-200 bg-orange-50 text-orange-800";
  return "border-slate-200 bg-slate-100 text-slate-700";
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
  if (stepKey === "healthCheck") return "Step 1 · 건강검진 데이터";
  if (stepKey === "neuropsych") return "Step 2 · 2차 1단계 신경심리검사(SNSB 등)";
  if (stepKey === "clinicalEval") return "Step 3 · 2차 2단계 치매임상평가";
  return "Step 4 · 전문의 진찰";
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

function computeMissingTotal(next: Stage2CaseDetailData): number {
  let missing = 0;
  if (next.steps.neuropsych.status === "MISSING") missing += 1;
  if (next.steps.clinicalEval.status !== "DONE") missing += 1;
  if (next.steps.specialist.status !== "DONE") missing += 1;
  if (next.followUp.reservationStatus === "NOT_REGISTERED") missing += 1;
  if (!next.pii.guardianMasked) missing += 1;
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

function buildNextActions(caseData: Stage2CaseDetailData): Stage2NextActionItem[] {
  const actions: Stage2NextActionItem[] = [];
  const { decision, steps, followUp } = caseData;

  if (decision.class === "UNCONFIRMED") {
    if (steps.clinicalEval.status !== "DONE") {
      actions.push({
        id: "next-unconfirmed-step3",
        priority: "P1",
        title: "2차 2단계 체크리스트 입력",
        description: "분류 미확정 상태 해소를 위해 Step3 입력이 필요합니다.",
        actionKey: "FOCUS_STEP",
        stepId: "clinicalEval",
      });
    }
    if (steps.specialist.status !== "DONE") {
      actions.push({
        id: "next-unconfirmed-step4",
        priority: "P1",
        title: "전문의 진찰 연계/기록",
        description: "Step4가 완료되어야 종합 분류를 확정할 수 있습니다.",
        actionKey: "FOCUS_STEP",
        stepId: "specialist",
      });
    }
    actions.push({
      id: "next-unconfirmed-summary",
      priority: "P2",
      title: "분류 근거 메모 정리",
      description: "Step3/4 완료 전 운영 근거를 정리해 담당자 검토를 준비합니다.",
      actionKey: "SAVE_OPS_MEMO",
    });
    return actions.slice(0, 3);
  }

  if (decision.class === "DEMENTIA" || (decision.class === "MCI" && decision.mciSubClass === "HIGH_RISK")) {
    if (followUp.referralStatus !== "SENT") {
      actions.push({
        id: "next-referral",
        priority: "P1",
        title: "감별검사 권고 → 의뢰서 진행",
        description:
          followUp.referralStatus === "NOT_CREATED"
            ? "의뢰서 초안 생성이 필요합니다."
            : "의뢰서 전송 단계로 진행하세요.",
        actionKey: "PREPARE_REFERRAL",
      });
    }
    if (followUp.reservationStatus === "NOT_REGISTERED" || followUp.reservationStatus === "REQUESTED") {
      actions.push({
        id: "next-reservation",
        priority: "P1",
        title: "감별검사 예약/의뢰 연계",
        description:
          followUp.reservationStatus === "NOT_REGISTERED"
            ? "예약/의뢰 동기화 미등록 상태입니다."
            : "예약 요청 상태를 확정 단계로 연계하세요.",
        actionKey: "LINK_RESERVATION",
      });
    }
    if (steps.clinicalEval.status !== "DONE") {
      actions.push({
        id: "next-step3",
        priority: "P2",
        title: "Step3 입력 보완",
        description: "감별검사 연계 전 2차 2단계 입력 대기를 해소합니다.",
        actionKey: "FOCUS_STEP",
        stepId: "clinicalEval",
      });
    }
    return actions.slice(0, 3);
  }

  if (decision.class === "MCI") {
    actions.push({
      id: "next-tracking",
      priority: "P1",
      title: followUp.trackingRegistered ? "추적관리 유지 점검" : "추적관리 등록",
      description: "MCI 분류는 추적 관리를 기본으로 운영합니다.",
      actionKey: "TOGGLE_TRACKING",
    });
    actions.push({
      id: "next-program",
      priority: "P2",
      title: "사례관리 프로그램 선택",
      description: "세부분류 기준으로 프로그램 연계를 결정합니다.",
      actionKey: "OPEN_PROGRAM",
    });
    actions.push({
      id: "next-memo",
      priority: "P3",
      title: "운영 메모/권고 저장",
      description: "담당자 검토용 메모를 남기고 감사 로그를 기록합니다.",
      actionKey: "SAVE_OPS_MEMO",
    });
    return actions;
  }

  actions.push({
    id: "next-normal-trigger",
    priority: "P1",
    title: "재분석 트리거 설정",
    description: "건강검진 데이터 업데이트 시 재분석 트리거를 관리합니다.",
    actionKey: "TOGGLE_REEVAL",
  });
  actions.push({
    id: "next-normal-step1",
    priority: "P2",
    title: "건강검진 데이터 최신성 확인",
    description: "정상 분류는 데이터 업데이트 모니터링이 우선입니다.",
    actionKey: "FOCUS_STEP",
    stepId: "healthCheck",
  });
  actions.push({
    id: "next-normal-memo",
    priority: "P3",
    title: "모니터링 메모 기록",
    description: "재평가 기준과 운영 의견을 남깁니다.",
    actionKey: "SAVE_OPS_MEMO",
  });

  return actions;
}

export function CaseDetailStage2Page({ data, onBack, isLoading = false }: CaseDetailStage2PageProps) {
  const [caseData, setCaseData] = useState<Stage2CaseDetailData | null>(data ?? null);
  const [focusedStep, setFocusedStep] = useState<Stage2StepKey | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [memoInput, setMemoInput] = useState("");
  const [evidenceExpanded, setEvidenceExpanded] = useState(false);
  const [programModalOpen, setProgramModalOpen] = useState(false);
  const [programDraftDomains, setProgramDraftDomains] = useState<ProgramDomain[]>([]);
  const [programDraftNote, setProgramDraftNote] = useState("");
  const [authorizeModalOpen, setAuthorizeModalOpen] = useState(false);
  const [authorizeReason, setAuthorizeReason] = useState("");
  const [smsModalOpen, setSmsModalOpen] = useState(false);

  const healthRef = useRef<HTMLDivElement>(null);
  const neuroRef = useRef<HTMLDivElement>(null);
  const clinicalRef = useRef<HTMLDivElement>(null);
  const specialistRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setCaseData(data ?? null);
    setMemoInput("");
    setEvidenceExpanded(false);
    setProgramModalOpen(false);
    setAuthorizeModalOpen(false);
    setAuthorizeReason("");
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
        const log: Stage2AuditLogItem = {
          id: `AUD-${Date.now()}-${next.auditLogs.length}`,
          timestamp,
          actor: options.actor ?? prev.owner,
          message: options.auditMessage,
        };
        next = { ...next, auditLogs: [log, ...next.auditLogs] };
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

  const toggleTracking = () => {
    applyMutation(
      (prev) => ({
        ...prev,
        followUp: {
          ...prev.followUp,
          trackingRegistered: !prev.followUp.trackingRegistered,
        },
      }),
      {
        auditMessage: "추적 관리 상태 변경",
        memoMessage: "추적 관리 등록/해제 실행 기록",
        toast: `추적 관리 상태가 변경되었습니다.`,
      },
    );
  };

  const toggleReevalTrigger = () => {
    applyMutation(
      (prev) => ({
        ...prev,
        followUp: {
          ...prev.followUp,
          reevalTrigger: prev.followUp.reevalTrigger === "ON" ? "OFF" : "ON",
        },
      }),
      {
        auditMessage: "재분석 트리거 설정 변경",
        memoMessage: "건강검진 데이터 업데이트 재분석 트리거 설정",
        toast: "재분석 트리거 설정이 저장되었습니다.",
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
          timeline: nextTimeline,
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
          timeline: nextTimeline,
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

  const setMciSubClass = (subClass: Exclude<MciSubClass, null>) => {
    applyMutation(
      (prev) => {
        if (prev.decision.class !== "MCI") return prev;

        const nextDecision = {
          ...prev.decision,
          mciSubClass: subClass,
        };

        return {
          ...prev,
          decision: nextDecision,
          followUp: normalizeFollowUpByDecision("MCI", subClass, prev.followUp),
        };
      },
      {
        auditMessage: `MCI 세부분류 설정: ${MCI_SUBCLASS_LABEL[subClass]}`,
        toast: `MCI 세부분류를 ${MCI_SUBCLASS_LABEL[subClass]}로 설정했습니다.`,
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
      (prev) => prev,
      {
        auditMessage: `2차 상담 실행 기록 (${type})`,
        memoMessage: `2차 상담 실행: ${templateLabel}${note ? ` / ${note}` : ""}`,
        toast: "상담 실행 기록이 저장되었습니다.",
      },
    );
  };

  const runNextAction = (action: Stage2NextActionItem) => {
    switch (action.actionKey) {
      case "FOCUS_STEP":
        if (action.stepId) {
          focusStep(action.stepId);
          setToastMessage(`${stepTitle(action.stepId)}로 이동했습니다.`);
        }
        return;
      case "TOGGLE_REEVAL":
        toggleReevalTrigger();
        return;
      case "TOGGLE_TRACKING":
        toggleTracking();
        return;
      case "OPEN_PROGRAM":
        openProgramModal();
        return;
      case "SAVE_OPS_MEMO":
        saveOpsMemo();
        return;
      case "PREPARE_REFERRAL":
        advanceReferral();
        return;
      case "LINK_RESERVATION":
        advanceReservation();
        return;
      case "AUTHORIZE_VIEW":
        setAuthorizeModalOpen(true);
        return;
      case "CONFIRM_STEP":
        if (action.stepId) {
          updateStepStatus(action.stepId);
        }
        return;
      default:
        return;
    }
  };

  const checklistProgress = useMemo(() => {
    if (!caseData || caseData.checklist.length === 0) return 0;
    const doneCount = caseData.checklist.filter((item) => item.done).length;
    return Math.round((doneCount / caseData.checklist.length) * 100);
  }, [caseData]);

  if (isLoading) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-600">
        Stage2 상세 데이터를 불러오는 중입니다...
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

  const nextActions = buildNextActions(caseData);
  const primaryAction = nextActions[0] ?? null;
  const hasIncompleteSteps = STEP_ORDER.some((stepId) => caseData.steps[stepId].status !== "DONE");
  const neuropsychMissingCount = caseData.steps.neuropsych.missingCount ?? 0;
  const hasEvidenceGap = neuropsychMissingCount > 0;

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

  const serviceSummaryCards = [
    {
      key: "decision",
      title: "분류 확정",
      value: caseData.decision.class === "UNCONFIRMED" ? "미확정" : "확정",
      helper:
        caseData.decision.class === "UNCONFIRMED"
          ? "Step3/Step4 완료 필요"
          : classSummary(caseData.decision.class, caseData.decision.mciSubClass),
      done: caseData.decision.class !== "UNCONFIRMED",
    },
    {
      key: "followup",
      title: "후속조치 준비",
      value: followUpSummary.value,
      helper: followUpSummary.helper,
      done: followUpSummary.done,
    },
    {
      key: "program",
      title: "프로그램 연계",
      value: caseData.followUp.programPlan?.domains.length ? "계획 설정" : "미설정",
      helper: caseData.followUp.programPlan?.domains.map(domainLabel).join(", ") || "분류 기반 선택 필요",
      done: Boolean(caseData.followUp.programPlan?.domains.length),
    },
    {
      key: "comms",
      title: "상담/문자 실행",
      value: caseData.memos.length > 0 ? "기록 있음" : "기록 없음",
      helper: `최근 메모 ${caseData.memos.length}건`,
      done: caseData.memos.length > 0,
    },
  ] as const;

  return (
    <div className="min-h-screen bg-[#f4f7fb] pb-24">
      {toastMessage && (
        <div className="fixed right-4 top-20 z-50 rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow-lg">
          {toastMessage}
        </div>
      )}

      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 shadow-sm backdrop-blur">
        <div className="mx-auto w-full max-w-[1320px] px-4 py-3 md:px-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="outline" size="icon" onClick={onBack} aria-label="목록으로 이동">
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                <h1 className="text-base font-bold text-slate-900 md:text-lg">{caseData.caseId}</h1>
                <Badge className="border-blue-200 bg-blue-50 text-blue-800">{caseData.stageLabel}</Badge>
                <Badge className={cn("border", workStatusTone(caseData.workStatus))}>
                  {WORK_STATUS_LABEL[caseData.workStatus]}
                </Badge>
              </div>
              <p className="text-xs text-slate-600">
                대상 유형: 선별검사 인지저하자 · {caseData.owner} ({caseData.roleLabel}) · {caseData.centerName}
              </p>
              <p className="text-sm font-semibold text-slate-900">
                현재 분류(운영 참고): {classSummary(caseData.decision.class, caseData.decision.mciSubClass)}
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <Badge className="border-blue-200 bg-blue-50 text-blue-800">
                  {CLASS_LABEL[caseData.decision.class]}
                </Badge>
                {caseData.decision.class === "MCI" && caseData.decision.mciSubClass && (
                  <Badge className="border-sky-200 bg-sky-50 text-sky-800">
                    MCI {MCI_SUBCLASS_LABEL[caseData.decision.mciSubClass]}
                  </Badge>
                )}
              </div>
              <p className="rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] font-medium text-amber-900">
                의료진 확인 전 / 담당자 검토 필요
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2">
              <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] text-slate-600">
                최근 업데이트 {caseData.lastUpdatedAt}
              </span>
              <span className="rounded-md border border-orange-200 bg-orange-50 px-2 py-1 text-[11px] font-semibold text-orange-800">
                누락 {caseData.missingTotal}건
              </span>
              <button
                type="button"
                className="rounded-md border border-slate-200 bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-700"
                onClick={toggleReevalTrigger}
              >
                재평가 트리거 {caseData.followUp.reevalTrigger}
              </button>
              <Button variant="outline" className="h-8 px-3 text-xs font-semibold" onClick={() => setAuthorizeModalOpen(true)}>
                <ShieldCheck className="h-3.5 w-3.5" />
                권한자 열람 실행
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto grid w-full max-w-[1320px] grid-cols-1 gap-4 px-4 py-5 xl:grid-cols-12 md:px-6">
        <section className="space-y-4 xl:col-span-9">
          {hasIncompleteSteps && (
            <Card className="border-orange-200 bg-orange-50 shadow-sm">
              <CardContent className="px-4 py-3 text-xs text-orange-900">
                Partial Data 상태: 일부 단계가 입력 대기/누락 상태입니다. 분류 또는 후속조치는 운영 참고로 사용하며 의료진 확인 전 단계입니다.
              </CardContent>
            </Card>
          )}

          {!hasIncompleteSteps && hasEvidenceGap && (
            <Card className="border-amber-200 bg-amber-50 shadow-sm">
              <CardContent className="px-4 py-3 text-xs text-amber-900">
                검사 단계는 완료되었지만 신경심리검사 세부 누락 {neuropsychMissingCount}건이 남아 있습니다. 현재 분류/권고는 운영 참고로 사용하고 담당자 검토를 진행하세요.
              </CardContent>
            </Card>
          )}

          {!hasIncompleteSteps && hasFollowUpPending && (
            <Card className="border-blue-200 bg-blue-50 shadow-sm">
              <CardContent className="px-4 py-3 text-xs text-blue-900">
                분류는 확정되었으며, 현재는 후속조치 실행 항목이 남아 있습니다. 우측 Next Action 우선순위에 따라 연계/추적 등록을 진행하세요.
              </CardContent>
            </Card>
          )}

          <Card className="border-slate-200 bg-white shadow-sm">
            <CardHeader className="border-b border-slate-100 px-4 py-3">
              <CardTitle className="text-sm font-bold text-slate-900">서비스 운영 보드</CardTitle>
              <p className="text-[11px] text-slate-600">분류 확정/연계/커뮤니케이션 진행 상태를 한 번에 확인합니다.</p>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-2 px-4 py-4 sm:grid-cols-2 lg:grid-cols-4">
              {serviceSummaryCards.map((item) => (
                <div key={item.key} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                  <p className="text-[11px] text-slate-500">{item.title}</p>
                  <p className="mt-1 text-sm font-bold text-slate-900">{item.value}</p>
                  <p className="mt-1 text-[11px] text-slate-600">{item.helper}</p>
                  <span
                    className={cn(
                      "mt-2 inline-flex rounded-md border px-2 py-0.5 text-[10px] font-semibold",
                      item.done
                        ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                        : "border-orange-200 bg-orange-50 text-orange-800",
                    )}
                  >
                    {item.done ? "준비됨" : "확인 필요"}
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="border-slate-200 bg-white shadow-sm">
            <CardHeader className="border-b border-slate-100 px-4 py-3">
              <CardTitle className="text-sm font-bold text-slate-900">Stage2 진단 플로우</CardTitle>
              <p className="text-[11px] text-slate-600">운영 참고 흐름 · 의료진 확인 전</p>
            </CardHeader>
            <CardContent className="space-y-3 px-4 py-4">
              {STEP_ORDER.map((stepId) => {
                const step = caseData.steps[stepId];
                return (
                  <div
                    key={stepId}
                    ref={
                      stepId === "healthCheck"
                        ? healthRef
                        : stepId === "neuropsych"
                          ? neuroRef
                          : stepId === "clinicalEval"
                            ? clinicalRef
                            : specialistRef
                    }
                    className={cn(
                      "rounded-lg border border-slate-200 bg-slate-50 p-3 transition",
                      focusedStep === stepId && "ring-2 ring-blue-400 ring-offset-2",
                    )}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="space-y-1">
                        <p className="flex items-center gap-1.5 text-sm font-semibold text-slate-900">
                          <StepStatusIcon status={step.status} />
                          {stepTitle(stepId)}
                        </p>
                        <p className="text-xs text-slate-600">{stepSummary(caseData.steps, stepId)}</p>
                        <p className="text-[11px] text-slate-500">{step.date ?? "기록일 미입력"}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={cn("rounded-md border px-2 py-0.5 text-[11px] font-semibold", statusTone(step.status))}>
                          {statusLabel(step.status)}
                        </span>
                        <Button
                          className="h-8 bg-[#15386a] px-3 text-[11px] font-semibold text-white hover:bg-[#102b4e]"
                          onClick={() => updateStepStatus(stepId)}
                        >
                          {step.status === "MISSING"
                            ? "보완 바로가기"
                            : step.status === "DONE"
                              ? "확인 바로가기"
                              : step.status === "INPUT_REQUIRED"
                                ? "입력 바로가기"
                                : "진행 바로가기"}
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}

              <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
                <p className="text-xs font-semibold text-blue-900">종합 분류(운영 참고)</p>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <p className="text-sm font-bold text-blue-900">
                    {classSummary(caseData.decision.class, caseData.decision.mciSubClass)}
                  </p>
                  <span className={cn("rounded-md border px-2 py-0.5 text-[11px] font-semibold", confidenceTone(caseData.decision.confidenceNote))}>
                    신뢰도 {caseData.decision.confidenceNote ?? "N/A"}
                  </span>
                </div>
                <ul className="mt-2 space-y-1 text-[11px] text-blue-900">
                  {caseData.decision.evidence.slice(0, 4).map((item) => (
                    <li key={item} className="flex items-start gap-2">
                      <span className="mt-[6px] h-1 w-1 rounded-full bg-blue-700" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-200 bg-white shadow-sm">
            <CardHeader className="border-b border-slate-100 px-4 py-3">
              <CardTitle className="text-sm font-bold text-slate-900">분류 기반 후속조치</CardTitle>
              <p className="text-[11px] text-slate-600">운영 참고/의료진 확인 전</p>
            </CardHeader>
            <CardContent className="space-y-3 px-4 py-4">
              <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-900">
                운영 참고/의료진 확인 전 · 분류 확정 후에도 담당자 검토가 필요합니다.
              </div>

              {caseData.decision.class === "UNCONFIRMED" && (
                <div className="space-y-3 rounded-lg border border-orange-200 bg-orange-50 p-3">
                  <p className="text-sm font-bold text-orange-900">분류 미확정(운영 참고)</p>
                  <p className="text-xs text-orange-900">
                    Step3(치매임상평가)와 Step4(전문의 진찰) 완료 전에는 분류를 확정할 수 없습니다.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Button className="h-8 bg-[#15386a] px-3 text-xs font-semibold text-white hover:bg-[#102b4e]" onClick={() => focusStep("clinicalEval")}>
                      Step3 입력 이동
                    </Button>
                    <Button variant="outline" className="h-8 px-3 text-xs font-semibold" onClick={() => focusStep("specialist")}>
                      Step4 연계 확인
                    </Button>
                  </div>
                </div>
              )}

              {caseData.decision.class === "NORMAL" && (
                <div className="space-y-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3">
                  <p className="text-sm font-bold text-emerald-900">정상(운영 참고)</p>
                  <p className="text-xs text-emerald-900">건강검진 데이터 업데이트 시 재분석이 트리거됩니다.</p>
                  <div className="flex flex-wrap gap-2">
                    <Button className="h-8 bg-[#15386a] px-3 text-xs font-semibold text-white hover:bg-[#102b4e]" onClick={toggleReevalTrigger}>
                      재분석 트리거 {caseData.followUp.reevalTrigger === "ON" ? "OFF" : "ON"} 설정
                    </Button>
                    <Button variant="outline" className="h-8 px-3 text-xs font-semibold" onClick={saveOpsMemo}>
                      모니터링 메모 기록
                    </Button>
                  </div>
                  <p className="rounded-md border border-emerald-200 bg-white px-2 py-1 text-[11px] text-emerald-800">
                    재분석 트리거는 건강검진 데이터 변경 감지를 위한 운영 옵션입니다.
                  </p>
                </div>
              )}

              {caseData.decision.class === "MCI" && (
                <div className="space-y-3 rounded-lg border border-blue-200 bg-blue-50 p-3">
                  <p className="text-sm font-bold text-blue-900">경도인지장애(MCI) (운영 참고)</p>
                  <div className="flex flex-wrap gap-2">
                    {(["MILD_OK", "MODERATE", "HIGH_RISK"] as const).map((subClass) => (
                      <button
                        key={subClass}
                        type="button"
                        className={cn(
                          "rounded-md border px-2.5 py-1 text-xs font-semibold",
                          caseData.decision.mciSubClass === subClass
                            ? "border-blue-300 bg-white text-blue-900"
                            : "border-blue-200 bg-blue-100 text-blue-700",
                        )}
                        onClick={() => setMciSubClass(subClass)}
                      >
                        {MCI_SUBCLASS_LABEL[subClass]}
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-blue-900">
                    후속조치: {followUpMappingLabel(caseData.decision.mciSubClass)}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Button className="h-8 bg-[#15386a] px-3 text-xs font-semibold text-white hover:bg-[#102b4e]" onClick={toggleTracking}>
                      추적 관리 {caseData.followUp.trackingRegistered ? "해제" : "등록"}
                    </Button>
                    <Button variant="outline" className="h-8 px-3 text-xs font-semibold" onClick={openProgramModal}>
                      사례관리 프로그램 선택
                    </Button>
                    <Button variant="outline" className="h-8 px-3 text-xs font-semibold" onClick={saveOpsMemo}>
                      운영 메모/권고 저장
                    </Button>
                  </div>

                  {caseData.decision.mciSubClass === "HIGH_RISK" && (
                    <div className="rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-900">
                      <p className="font-semibold">감별검사 권고</p>
                      <p className="mt-1">위험 세부분류는 의뢰/예약 연계를 최우선으로 실행합니다.</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <Button className="h-8 bg-red-600 px-3 text-xs font-semibold text-white hover:bg-red-700" onClick={advanceReferral}>
                          의뢰서 준비
                        </Button>
                        <Button variant="outline" className="h-8 border-red-200 px-3 text-xs font-semibold text-red-800" onClick={advanceReservation}>
                          감별검사 예약 연계
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {caseData.decision.class === "DEMENTIA" && (
                <div className="space-y-3 rounded-lg border border-red-200 bg-red-50 p-3">
                  <p className="text-sm font-bold text-red-900">치매(운영 참고)</p>
                  <p className="text-xs text-red-900">후속조치: 감별검사(의뢰/예약 연계)</p>
                  <div className="flex flex-wrap gap-2">
                    <Button className="h-8 bg-red-600 px-3 text-xs font-semibold text-white hover:bg-red-700" onClick={advanceReferral}>
                      의뢰서 생성/보완
                    </Button>
                    <Button variant="outline" className="h-8 border-red-200 px-3 text-xs font-semibold text-red-800" onClick={advanceReservation}>
                      예약/의뢰 연계
                    </Button>
                    <Button variant="outline" className="h-8 border-red-200 px-3 text-xs font-semibold text-red-800" onClick={() => setAuthorizeModalOpen(true)}>
                      권한자 열람 실행
                    </Button>
                  </div>
                </div>
              )}

              <div>
                <label htmlFor="stage2-memo" className="text-xs font-semibold text-slate-700">
                  운영 메모/권고
                </label>
                <Textarea
                  id="stage2-memo"
                  value={memoInput}
                  onChange={(event) => setMemoInput(event.target.value)}
                  className="mt-1 min-h-[86px]"
                  placeholder="후속조치 실행 근거를 남겨주세요."
                />
              </div>
            </CardContent>
          </Card>

          {/* ── 프로그램 제공(행정 실행) — 고도화된 UI ── */}
          <Card className="border-slate-200 bg-white shadow-sm">
            <CardHeader className="border-b border-slate-100 px-4 py-3">
              <CardTitle className="text-sm font-bold text-slate-900">프로그램 제공(사례관리)</CardTitle>
            </CardHeader>
            <CardContent className="px-4 py-4">
              {shouldActivateProgramLink(caseData) || caseData.decision.class === "DEMENTIA" ? (
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
              )}
            </CardContent>
          </Card>

          <Card className="border-slate-200 bg-white shadow-sm">
            <button
              type="button"
              onClick={() => setEvidenceExpanded((prev) => !prev)}
              className="flex w-full items-center justify-between px-4 py-3 text-left"
            >
              <div>
                <p className="text-sm font-bold text-slate-900">근거 상세(CIST/SNSB 등)</p>
                <p className="text-[11px] text-slate-600">운영 참고/의료진 확인 전</p>
              </div>
              {evidenceExpanded ? <ChevronUp className="h-4 w-4 text-slate-500" /> : <ChevronDown className="h-4 w-4 text-slate-500" />}
            </button>
            {evidenceExpanded && (
              <CardContent className="space-y-3 border-t border-slate-100 px-4 py-4">
                <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                  점수/근거는 운영 참고 정보이며 의료진 확인 전입니다.
                </div>
                <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <p className="text-xs font-semibold text-slate-800">건강검진·CIST 요약</p>
                    <p className="mt-1 text-xs text-slate-700">{caseData.steps.healthCheck.summary ?? "요약 없음"}</p>
                    <p className="mt-1 text-[11px] text-slate-500">{caseData.steps.healthCheck.date ?? "시각 미입력"}</p>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <p className="text-xs font-semibold text-slate-800">SNSB 요약</p>
                    <p className="mt-1 text-xs text-slate-700">{caseData.steps.neuropsych.summary ?? "요약 없음"}</p>
                    <p className="mt-1 text-[11px] text-slate-500">신뢰도 {caseData.steps.neuropsych.reliability ?? "N/A"}</p>
                  </div>
                </div>
                <ul className="space-y-1 text-xs text-slate-700">
                  {caseData.decision.evidence.map((item) => (
                    <li key={item} className="flex items-start gap-2">
                      <span className="mt-[6px] h-1 w-1 rounded-full bg-slate-600" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            )}
          </Card>
        </section>

        <aside className="space-y-4 xl:col-span-3">
          <Card className="border-[#163b6f]/20 bg-[#f7fbff] shadow-sm">
            <CardHeader className="border-b border-blue-100 px-4 py-3">
              <CardTitle className="text-sm font-bold text-[#15386a]">Next Action Panel</CardTitle>
              <p className="text-[11px] text-slate-600">분류 기반 우선순위</p>
            </CardHeader>
            <CardContent className="space-y-2 px-4 py-4">
              {nextActions.map((action) => (
                <button
                  key={action.id}
                  type="button"
                  onClick={() => runNextAction(action)}
                  className={cn(
                    "w-full rounded-lg border border-blue-200 bg-white p-3 text-left transition hover:shadow-sm",
                    primaryAction?.id === action.id && "border-[#15386a]/40",
                  )}
                >
                  <p className="text-xs font-bold text-slate-900">
                    {action.priority}: {action.title}
                  </p>
                  <p className="mt-1 text-[11px] text-slate-600">{action.description}</p>
                </button>
              ))}
            </CardContent>
          </Card>

          {/* SMS 트리거 버튼 */}
          <Card className="border-slate-200 bg-white shadow-sm">
            <CardContent className="px-4 py-4">
              <Button
                className="h-11 w-full gap-2 bg-[#15386a] text-sm font-semibold text-white hover:bg-[#102b4e]"
                onClick={() => setSmsModalOpen(true)}
              >
                <MessageSquare className="h-4 w-4" />
                상담/문자 실행 (2차)
              </Button>
              <p className="mt-2 text-center text-[11px] text-slate-500">
                접촉 · 예약안내 · 리마인더 문자 발송
              </p>
            </CardContent>
          </Card>

          {/* SMS 모달 */}
          <Dialog open={smsModalOpen} onOpenChange={setSmsModalOpen}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-0">
              <SmsPanel
                stageLabel="2차"
                templates={STAGE2_SMS_TEMPLATES}
                defaultVars={{
                  centerName: caseData.centerName ?? "강남구 치매안심센터",
                }}
                caseId={caseData.caseId}
                citizenPhone={caseData.pii.maskedPhone}
                guardianPhone={caseData.pii.guardianMasked ?? undefined}
                onSmsSent={(item) => {
                  handleStage2SmsSent(item);
                }}
                onConsultation={handleStage2Consultation}
              />
            </DialogContent>
          </Dialog>

          <Card className="border-slate-200 bg-white shadow-sm">
            <CardHeader className="border-b border-slate-100 px-4 py-3">
              <CardTitle className="text-sm font-bold text-slate-900">운영 메모/개인정보 요약</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 px-4 py-4">
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <InfoLine label="이름" value={caseData.pii.maskedName} />
                  <InfoLine label="연령/성별" value={`${caseData.pii.age}세 · ${caseData.pii.gender}`} />
                  <InfoLine label="연락처" value={caseData.pii.maskedPhone} />
                  <InfoLine label="보호자" value={caseData.pii.guardianMasked ?? "미등록"} />
                </div>
                <Button variant="outline" className="mt-3 h-8 w-full text-xs font-semibold" onClick={() => setAuthorizeModalOpen(true)}>
                  <Eye className="h-3.5 w-3.5" />
                  권한자 열람 실행
                </Button>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-slate-700">메모 이력</p>
                  <span className="text-[11px] text-slate-500">{caseData.memos.length}건</span>
                </div>
                <div className="max-h-[220px] space-y-2 overflow-auto">
                  {caseData.memos.length === 0 ? (
                    <p className="text-xs text-slate-500">저장된 메모가 없습니다.</p>
                  ) : (
                    caseData.memos.map((memo) => (
                      <div key={memo.id} className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1.5">
                        <p className="text-[11px] text-slate-500">
                          {memo.timestamp} · {memo.author}
                        </p>
                        <p className="mt-0.5 text-xs text-slate-700">{memo.content}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </aside>

        <section className="space-y-4 xl:col-span-12">
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
            <Card className="border-slate-200 bg-white shadow-sm xl:col-span-4">
              <CardHeader className="border-b border-slate-100 px-4 py-3">
                <CardTitle className="flex items-center gap-2 text-sm font-bold text-slate-900">
                  <CalendarClock className="h-4 w-4 text-slate-600" />
                  작업 타임라인
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 px-4 py-4">
                {caseData.timeline.map((item) => (
                  <div key={item.id} className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-semibold text-slate-800">{item.title}</p>
                      <span
                        className={cn(
                          "rounded-md border px-2 py-0.5 text-[11px] font-semibold",
                          item.status === "DONE"
                            ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                            : item.status === "PENDING"
                              ? "border-orange-200 bg-orange-50 text-orange-800"
                              : "border-slate-200 bg-slate-100 text-slate-700",
                        )}
                      >
                        {item.status === "DONE" ? "완료" : item.status === "PENDING" ? "대기" : "미입력"}
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] text-slate-500">{item.at ?? "시각 미입력"}</p>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="border-slate-200 bg-white shadow-sm xl:col-span-4">
              <CardHeader className="border-b border-slate-100 px-4 py-3">
                <CardTitle className="flex items-center justify-between text-sm font-bold text-slate-900">
                  <span className="flex items-center gap-2">
                    <ListChecks className="h-4 w-4 text-slate-600" />
                    체크리스트
                  </span>
                  <span className="text-[11px] text-slate-500">완료율 {checklistProgress}%</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 px-4 py-4">
                {caseData.checklist.map((item) => (
                  <div key={item.id} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                    <div className="flex items-start justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => focusStep(item.stepId)}
                        className="flex-1 text-left"
                      >
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

            <Card className="border-slate-200 bg-white shadow-sm xl:col-span-4">
              <CardHeader className="border-b border-slate-100 px-4 py-3">
                <CardTitle className="flex items-center gap-2 text-sm font-bold text-slate-900">
                  <Stethoscope className="h-4 w-4 text-slate-600" />
                  후속조치 상태
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 px-4 py-4 text-xs text-slate-700">
                <InfoLine label="재분석 트리거" value={caseData.followUp.reevalTrigger} />
                <InfoLine label="추적 관리" value={caseData.followUp.trackingRegistered ? "등록" : "미등록"} />
                <InfoLine
                  label="의뢰 상태"
                  value={
                    caseData.followUp.referralStatus === "NOT_CREATED"
                      ? "미생성"
                      : caseData.followUp.referralStatus === "DRAFT"
                        ? "초안"
                        : "전송 완료"
                  }
                />
                <InfoLine
                  label="예약 상태"
                  value={
                    caseData.followUp.reservationStatus === "NOT_REGISTERED"
                      ? "미등록"
                      : caseData.followUp.reservationStatus === "REQUESTED"
                        ? "요청"
                        : "확정"
                  }
                />
              </CardContent>
            </Card>
          </div>

          <Card className="border-slate-200 bg-white shadow-sm">
            <CardHeader className="border-b border-slate-100 px-4 py-3">
              <CardTitle className="flex items-center gap-2 text-sm font-bold text-slate-900">
                <ShieldAlert className="h-4 w-4 text-slate-600" />
                감사 로그
              </CardTitle>
            </CardHeader>
            <CardContent className="px-0 py-0">
              {caseData.auditLogs.length === 0 ? (
                <p className="px-4 py-4 text-xs text-slate-500">감사 로그가 아직 없습니다.</p>
              ) : (
                <div className="max-h-[280px] overflow-auto">
                  <table className="w-full text-left">
                    <thead className="bg-slate-50 text-[11px] text-slate-500">
                      <tr>
                        <th className="px-4 py-2 font-medium">시각</th>
                        <th className="px-4 py-2 font-medium">행위자</th>
                        <th className="px-4 py-2 font-medium">기록</th>
                      </tr>
                    </thead>
                    <tbody>
                      {caseData.auditLogs.map((log) => (
                        <tr key={log.id} className="border-t border-slate-100 text-xs">
                          <td className="whitespace-nowrap px-4 py-2 text-slate-600">{log.timestamp}</td>
                          <td className="whitespace-nowrap px-4 py-2 font-semibold text-slate-800">{log.actor}</td>
                          <td className="px-4 py-2 text-slate-700">{log.message}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </section>

        <p className="xl:col-span-12 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900">
          모든 분류/점수/권고는 운영 참고 정보입니다. 의료진 확인 전 / 담당자 검토 필요.
        </p>
      </main>

      {primaryAction && (
        <div className="fixed bottom-4 left-4 right-4 z-40 md:hidden">
          <Button
            className="h-12 w-full rounded-xl bg-[#15386a] text-sm font-bold text-white hover:bg-[#102b4e]"
            onClick={() => runNextAction(primaryAction)}
          >
            <ExternalLink className="h-4 w-4" />
            다음 액션 1순위 실행
          </Button>
        </div>
      )}

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

function StepStatusIcon({ status }: { status: StepStatus }) {
  if (status === "DONE") {
    return <CheckCircle2 className="h-4 w-4 text-emerald-600" />;
  }
  if (status === "MISSING") {
    return <AlertTriangle className="h-4 w-4 text-red-600" />;
  }
  if (status === "INPUT_REQUIRED") {
    return <CircleDashed className="h-4 w-4 text-orange-600" />;
  }
  return <Circle className="h-4 w-4 text-slate-500" />;
}
