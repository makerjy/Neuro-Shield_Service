import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  AlertTriangle,
  ArrowRightCircle,
  Ban,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock3,
  ExternalLink,
  FilePenLine,
  History,
  Layers,
  ListChecks,
  MessageSquare,
  PauseCircle,
  Phone,
  PhoneCall,
  RefreshCw,
  Shield,
  ShieldCheck,
  Timer,
  UserCheck,
  X,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "../shared";
import {
  Dialog,
  DialogContent,
} from "../../../ui/dialog";
import { SmsPanel } from "../../sms/SmsPanel";
import type { SmsTemplate as StdSmsTemplate, SmsTemplateVars, CallScriptStep as StdCallScriptStep } from "../../sms/SmsPanel";
import type { SmsHistoryItem } from "../../sms/smsService";
import {
  getStage1ContactPriority,
  getStage1InterventionGuides,
  getStage1InterventionPlan,
  maskPhone,
  type CaseRecord,
} from "../caseRecords";
import type {
  CaseHeader,
  ContactEvent,
  ContactExecution,
  ContactExecutionStatus,
  ContactFlowState,
  ContactFlowStep,
  ContactFlowStepStatus,
  ContactPlan,
  ContactStrategy,
  DataQualityLevel,
  HandoffMemo,
  InterventionLevel,
  LinkageStatus,
  OutcomeCode,
  PolicyGate,
  PolicyGateKey,
  PreTriageInput,
  PreTriageResult,
  RecommendedContactStrategy,
  SlaLevel,
  Stage1Detail,
  TodoItem,
} from "./stage1Types";
import {
  deriveOutcomeTransition,
  derivePreTriageResultByRule,
  hasVulnerableTrigger,
} from "./stage1ContactEngine";

type TimelineFilter = "ALL" | "CALL" | "SMS" | "STATUS";
type CallTarget = "citizen" | "guardian";
type SmsTarget = "citizen" | "guardian";
type SmsDispatchStatus = "DELIVERED" | "FAILED" | "PENDING";
type CallScriptStep = "greeting" | "purpose" | "assessment" | "scheduling";
type Stage1LinkageAction = "CENTER_LINKAGE" | "HOSPITAL_LINKAGE" | "COUNSELING_LINKAGE";
type Stage1FlowVisualStatus = "COMPLETED" | "PENDING" | "BLOCKED";
type Stage1FlowAction = "OPEN_PRECHECK" | "OPEN_CONTACT_EXECUTION" | "OPEN_RESPONSE_HANDLING" | "OPEN_FOLLOW_UP";
type Stage1FlowCardId = "PRECHECK" | "CONTACT_EXECUTION" | "RESPONSE_HANDLING" | "FOLLOW_UP";

type Stage1FlowCardConfig = {
  id: Stage1FlowCardId;
  title: string;
  description: string;
  relatedSteps: ContactFlowStep[];
  action: Stage1FlowAction;
};

type Stage1FlowCard = Stage1FlowCardConfig & {
  status: Stage1FlowVisualStatus;
  reason: string;
  nextActionHint: string;
  metricLabel: string;
  isCurrent: boolean;
};

export type Stage1HeaderSummary = {
  contactMode: ContactStrategy;
  effectiveMode: RecommendedContactStrategy;
  slaLevel: SlaLevel;
  qualityScore: number;
  missingCount: number;
  warningCount: number;
  lastUpdatedAt?: string;
};

type AuditLogEntry = {
  id: string;
  at: string;
  actor: string;
  message: string;
};

type ReasonActionDraft =
  | {
      mode: "LEVEL";
      title: string;
      confirmLabel: string;
      nextLevel: InterventionLevel;
      reason: string;
    }
  | {
      mode: "STATUS";
      title: string;
      confirmLabel: string;
      nextStatus: "보류" | "우선순위 제외";
      reason: string;
    };

type OutcomeDraft =
  | {
      mode: "CALL";
      title: string;
      result: "SUCCESS" | "NO_ANSWER" | "REJECTED" | "WRONG_NUMBER";
      note: string;
      durationSec: number;
    }
  | {
      mode: "SMS";
      title: string;
      result: SmsDispatchStatus;
      note: string;
      scheduled: boolean;
    };

type SmsTemplate = {
  id: string;
  messageType: "CONTACT" | "BOOKING" | "REMINDER";
  label: string;
  body: (params: {
    caseId: string;
    centerName: string;
    centerPhone: string;
    guideLink: string;
    reservationLink: string;
    unsubscribe: string;
  }) => string;
};

const STAGE1_PANEL_OPERATOR = "김성실";
const DEFAULT_CENTER_NAME = "강남구 치매안심센터";
const DEFAULT_CENTER_PHONE = "02-555-0199";
/** 시민화면 링크 (배포 환경 자동 감지) */
function getCitizenUrl(): string {
  if (typeof window !== "undefined") {
    const base = window.location.origin;
    const basePath = import.meta.env.VITE_BASE_PATH || "/neuro-shield/";
    return `${base}${basePath.replace(/\/$/, "")}/#citizen`;
  }
  return "http://146.56.162.226/neuro-shield/#citizen";
}
const DEFAULT_GUIDE_LINK = getCitizenUrl();
const DEFAULT_BOOKING_URL = "(센터 예약 안내)";
const DEFAULT_UNSUBSCRIBE = "수신거부 080-000-0000";
const CONTACT_DISCLAIMER = "본 안내는 진단이 아니며, 센터 안내 및 예약/연계 목적입니다.";

const SMS_TEMPLATES: SmsTemplate[] = [
  /* ── 접촉: 시민화면 링크 포함 ── */
  {
    id: "S1_CONTACT_BASE",
    messageType: "CONTACT",
    label: "1차 접촉(기본)",
    body: ({ centerName, guideLink, centerPhone }) =>
      `[치매안심센터:${centerName}] 인지건강 확인을 위한 센터 안내입니다. 확인 절차(상담/선별검사)가 필요할 수 있습니다. 안내 확인 및 희망 연락시간 선택: ${guideLink} / 문의: ${centerPhone}`,
  },
  {
    id: "S1_CONTACT_GUARDIAN",
    messageType: "CONTACT",
    label: "1차 접촉(보호자 옵션)",
    body: ({ centerName, guideLink, centerPhone }) =>
      `[치매안심센터:${centerName}] 안내 확인 후 본인 응답이 어렵다면 보호자 연락처(선택)를 남길 수 있습니다. 안내 확인/연락시간 선택: ${guideLink} / 문의: ${centerPhone}`,
  },
  /* ── 예약안내: 시민링크 없음, 센터 전화만 ── */
  {
    id: "S1_BOOKING_BASE",
    messageType: "BOOKING",
    label: "1차 예약안내(선별/상담)",
    body: ({ centerName, centerPhone }) =>
      `[치매안심센터:${centerName}] 인지 선별검사/상담 예약 안내드립니다. 가능한 날짜·시간을 선택해주세요. 예약/변경 문의: ${centerPhone}`,
  },
  {
    id: "S1_BOOKING_CHANNEL",
    messageType: "BOOKING",
    label: "1차 예약안내(방문/전화 선택)",
    body: ({ centerName, centerPhone }) =>
      `[치매안심센터:${centerName}] 상담/선별검사는 방문 또는 전화로 진행될 수 있습니다. 희망 방식을 선택해 예약해주세요. 문의: ${centerPhone}`,
  },
  /* ── 리마인더: 시민링크 없음, 센터 전화만 ── */
  {
    id: "S1_REMINDER_FIRST",
    messageType: "REMINDER",
    label: "1차 리마인더(1차 안내)",
    body: ({ centerName, centerPhone, unsubscribe }) =>
      `[치매안심센터:${centerName}] 이전에 안내드린 인지건강 확인이 아직 미확인 상태입니다. 원치 않으시면 수신거부 가능합니다. 문의: ${centerPhone} / ${unsubscribe}`,
  },
  {
    id: "S1_REMINDER_FINAL",
    messageType: "REMINDER",
    label: "1차 리마인더(최종)",
    body: ({ centerName, centerPhone }) =>
      `[치매안심센터:${centerName}] 확인이 없어 마지막으로 안내드립니다. 필요 시 센터로 연락 주시면 안내해드리겠습니다. 문의: ${centerPhone}`,
  },
];

const CALL_SCRIPT_STEPS: Array<{
  step: CallScriptStep;
  title: string;
  content: string;
  tips: string[];
  checkpoints: string[];
}> = [
  {
    step: "greeting",
    title: "1단계: 인사 및 본인 확인",
    content:
      "안녕하세요. 치매안심센터 운영 담당자입니다. 지금 통화 가능하신가요? 본인 확인을 위해 성함과 생년월일 앞자리를 확인드리겠습니다.",
    tips: ["차분한 톤으로 시작", "통화 가능 여부 우선 확인", "확인 내용은 짧고 명확하게"],
    checkpoints: ["통화 가능 확인", "본인/보호자 확인", "기본 응대 분위기 점검"],
  },
  {
    step: "purpose",
    title: "2단계: 연락 안내",
    content:
      "이번 연락은 인지건강 확인 안내를 위한 운영 절차입니다. 상담/선별검사 등 확인 절차를 간단히 안내드립니다.",
    tips: ["연락 취지를 짧게 안내", "불안 유발 표현 금지", "상대방 이해 여부 확인"],
    checkpoints: ["핵심 안내 전달", "상대방 이해 여부 확인", "추가 문의 기록"],
  },
  {
    step: "assessment",
    title: "3단계: 현재 상황 확인",
    content:
      "최근 일상에서 불편한 점, 연락 가능 시간, 상담/선별검사 참여 가능 여부를 확인하겠습니다. 필요 시 보호자 연락으로 전환해 안내를 이어가겠습니다.",
    tips: ["개방형 질문 우선", "기록 중심으로 정리", "재접촉 가능 시간 확인"],
    checkpoints: ["현재 상황 확인", "연락 가능 시간대 확인", "추가 지원 필요 여부 확인"],
  },
  {
    step: "scheduling",
    title: "4단계: 다음 실행 정리",
    content:
      "오늘 확인 내용을 기준으로 문자 안내, 상담/선별검사 예약, 재접촉 일정을 정리하겠습니다. 회신 가능한 시간도 함께 확인하겠습니다.",
    tips: ["다음 행동 1개로 요약", "문자 안내 여부 확인", "재접촉 일정 설정"],
    checkpoints: ["다음 행동 합의", "문자 발송 동의 확인", "재접촉 시점 설정"],
  },
];

function nowIso() {
  return new Date().toISOString();
}

function formatDateTime(isoLike?: string) {
  if (!isoLike) return "-";
  const d = new Date(isoLike);
  if (Number.isNaN(d.getTime())) return isoLike;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")} ${String(
    d.getHours()
  ).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function withHoursFromNow(hours: number) {
  return new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
}

function inferWaitDays(status?: CaseRecord["status"]) {
  if (status === "지연") return 10;
  if (status === "임박") return 7;
  if (status === "대기") return 6;
  if (status === "진행중") return 3;
  return 1;
}

function inferSla(status?: CaseRecord["status"]): CaseHeader["sla"] {
  if (status === "지연") {
    return { level: "OVERDUE", dueAt: withHoursFromNow(-4) };
  }
  if (status === "임박" || status === "대기") {
    return { level: "DUE_SOON", dueAt: withHoursFromNow(18) };
  }
  return { level: "OK", dueAt: withHoursFromNow(72) };
}

function mapDataQuality(raw?: CaseRecord["quality"]) {
  if (raw === "경고") {
    return {
      level: "EXCLUDE" as DataQualityLevel,
      score: 58,
      notes: ["연락처 검증 필요", "주소/보호자 필드 누락"],
    };
  }
  if (raw === "주의") {
    return {
      level: "WARN" as DataQualityLevel,
      score: 79,
      notes: ["기초 필드 일부 누락"],
    };
  }
  return {
    level: "GOOD" as DataQualityLevel,
    score: 96,
    notes: ["운영 실행 가능"],
  };
}

function computePriorityValue(caseRecord?: CaseRecord) {
  const statusScoreMap: Record<CaseRecord["status"], number> = {
    진행중: 62,
    대기: 76,
    완료: 24,
    임박: 88,
    지연: 94,
  };
  const riskBoost: Record<CaseRecord["risk"], number> = {
    저: 0,
    중: 8,
    고: 16,
  };
  const qualityPenalty: Record<CaseRecord["quality"], number> = {
    양호: 0,
    주의: 6,
    경고: 18,
  };

  if (!caseRecord) {
    return 60;
  }

  const alertBonus = Math.min(caseRecord.alertTags.length * 3, 12);
  const raw = statusScoreMap[caseRecord.status] + riskBoost[caseRecord.risk] + alertBonus - qualityPenalty[caseRecord.quality];

  return Math.max(5, Math.min(99, raw));
}

function priorityIndicator(value: number) {
  if (value >= 85) {
    return {
      label: "긴급",
      tone: "border-red-200 bg-red-50 text-red-700",
      bar: "bg-red-500",
      guide: "24시간 이내 접촉 실행",
    };
  }
  if (value >= 65) {
    return {
      label: "우선",
      tone: "border-orange-200 bg-orange-50 text-orange-700",
      bar: "bg-orange-500",
      guide: "당일 연락/안내 우선 처리",
    };
  }
  if (value >= 45) {
    return {
      label: "일반",
      tone: "border-blue-200 bg-blue-50 text-blue-700",
      bar: "bg-blue-500",
      guide: "정규 순서로 처리",
    };
  }
  return {
    label: "관찰",
    tone: "border-emerald-200 bg-emerald-50 text-emerald-700",
    bar: "bg-emerald-500",
    guide: "기록/모니터링 중심",
  };
}

function buildPolicyGates(caseRecord?: CaseRecord): PolicyGate[] {
  const quality = mapDataQuality(caseRecord?.quality).level;
  const hasGuardian = Boolean(caseRecord?.profile.guardianPhone);

  return [
    {
      key: "CONSENT_OK",
      label: "동의 상태",
      status: quality === "EXCLUDE" ? "FAIL" : "PASS",
      failReason: quality === "EXCLUDE" ? "동의 이력 확인이 필요합니다" : undefined,
      fixAction: quality === "EXCLUDE" ? { label: "동의 요청", action: "REQUEST_CONSENT" } : undefined,
    },
    {
      key: "CONTACTABLE_TIME_OK",
      label: "연락 가능 시간",
      status: caseRecord?.status === "지연" ? "UNKNOWN" : "PASS",
      failReason: caseRecord?.status === "지연" ? "연락 가능 시간 확인이 필요합니다" : undefined,
      fixAction:
        caseRecord?.status === "지연"
          ? { label: "연락 시간 확인", action: "CONFIRM_CONTACT_TIME" }
          : undefined,
    },
    {
      key: "PHONE_VERIFIED",
      label: "연락처 신뢰도",
      status: quality === "GOOD" ? "PASS" : "FAIL",
      failReason: quality === "GOOD" ? undefined : "전화번호 검증이 필요합니다",
      fixAction: quality === "GOOD" ? undefined : { label: "번호 검증", action: "VERIFY_PHONE" },
    },
    {
      key: "GUARDIAN_OPTIONAL",
      label: "보호자 연락처",
      status: hasGuardian ? "PASS" : "UNKNOWN",
      failReason: hasGuardian ? undefined : "보호자 연락처가 아직 없습니다",
      fixAction: hasGuardian ? undefined : { label: "보호자 추가", action: "ADD_GUARDIAN" },
    },
  ];
}

function buildRiskEvidence(caseRecord?: CaseRecord) {
  const risk = caseRecord?.risk ?? "중";
  const topFactors =
    risk === "고"
      ? [
          {
            title: "최근 망각 빈도 증가",
            description: "최근 2주 내 동일 문의와 일정 혼선 이력이 반복되었습니다.",
            recency: withHoursFromNow(-16),
          },
          {
            title: "재접촉 지연 누적",
            description: "연락 시도 간격이 길어져 추적 강도 상향이 필요합니다.",
            recency: withHoursFromNow(-30),
          },
          {
            title: "생활 리듬 변동 신호",
            description: "활동 시간대가 불규칙해 연락 가능 시간 검증이 필요합니다.",
            recency: withHoursFromNow(-40),
            isMissing: caseRecord?.quality === "경고",
          },
        ]
      : risk === "저"
        ? [
            {
              title: "안내 반응 안정",
              description: "안내 메시지 응답률이 안정적으로 유지되고 있습니다.",
              recency: withHoursFromNow(-18),
            },
            {
              title: "연락 지연 신호 낮음",
              description: "최근 연락 실패 누적이 낮아 L0/L1 운영 강도가 적합합니다.",
              recency: withHoursFromNow(-34),
            },
            {
              title: "보강 데이터 소량",
              description: "소수 필드 보강 후 다음 주기 모니터링이 권고됩니다.",
              recency: withHoursFromNow(-45),
              isMissing: caseRecord?.quality !== "양호",
            },
          ]
        : [
            {
              title: "재평가 트리거 후보",
              description: "지표 변동이 기준에 근접하여 모니터링이 필요합니다.",
              recency: withHoursFromNow(-20),
            },
            {
              title: "연락 간격 증가",
              description: "미응답 누적 방지를 위해 접촉 강도 조정이 권고됩니다.",
              recency: withHoursFromNow(-32),
            },
            {
              title: "데이터 최신성 편차",
              description: "일부 항목의 업데이트 간격이 길어 보강이 필요합니다.",
              recency: withHoursFromNow(-46),
              isMissing: caseRecord?.quality !== "양호",
            },
          ];

  return {
    topFactors,
    computedAt: nowIso(),
    version: "stage1-risk-v2.4",
  };
}

function buildScoreSummary(caseRecord?: CaseRecord) {
  const risk = caseRecord?.risk ?? "중";
  const offset = Number(caseRecord?.id.slice(-2) ?? 0) % 5;

  const base =
    risk === "고"
      ? [41, 53, 47, 44]
      : risk === "저"
        ? [79, 83, 86, 82]
        : [61, 68, 65, 66];

  return [
    {
      label: "CIST 점수",
      value: Math.max(0, Math.min(100, base[0] - offset)),
      unit: "점",
      updatedAt: withHoursFromNow(-12),
      flags: risk === "고" ? ["변동 큼"] : undefined,
    },
    {
      label: "기억 반응 지표",
      value: Math.max(0, Math.min(100, base[1] - offset)),
      unit: "점",
      updatedAt: withHoursFromNow(-14),
      flags: risk !== "저" ? ["주의"] : undefined,
    },
    {
      label: "생활 리듬 지표",
      value: Math.max(0, Math.min(100, base[2] + offset)),
      unit: "점",
      updatedAt: withHoursFromNow(-26),
      flags: caseRecord?.quality !== "양호" ? ["누락 가능"] : undefined,
    },
    {
      label: "접촉 반응 지표",
      value: Math.max(0, Math.min(100, base[3])),
      unit: "점",
      updatedAt: withHoursFromNow(-8),
      flags: caseRecord?.status === "임박" || caseRecord?.status === "지연" ? ["즉시 확인"] : undefined,
    },
  ];
}

function buildTodos(level: InterventionLevel, qualityLevel: DataQualityLevel): TodoItem[] {
  const byLevel: Record<InterventionLevel, TodoItem[]> = {
    L0: [
      { id: "todo-L0-1", title: "운영 지원 안내 완료 기록", priority: 1, status: "OPEN", suggestedAction: "VERIFY" },
      { id: "todo-L0-2", title: "다음 재접촉 예정일 등록", priority: 2, status: "OPEN", suggestedAction: "SCHEDULE" },
      { id: "todo-L0-3", title: "데이터 보강 요청", priority: 2, status: "OPEN", suggestedAction: "VERIFY" },
    ],
    L1: [
      { id: "todo-L1-1", title: "안내 발송 실행", priority: 1, status: "OPEN", suggestedAction: "SMS" },
      { id: "todo-L1-2", title: "보호자 연락처 확인", priority: 2, status: "OPEN", suggestedAction: "VERIFY" },
      { id: "todo-L1-3", title: "재평가 트리거 약식 설정", priority: 3, status: "OPEN", suggestedAction: "HOLD" },
    ],
    L2: [
      { id: "todo-L2-1", title: "1차 연락 1회 시도", priority: 1, status: "OPEN", suggestedAction: "CALL" },
      { id: "todo-L2-2", title: "부재 시 재시도 일정 생성", priority: 1, status: "OPEN", suggestedAction: "SCHEDULE" },
      { id: "todo-L2-3", title: "2차 연결 안내 준비", priority: 2, status: "OPEN", suggestedAction: "SMS" },
    ],
    L3: [
      { id: "todo-L3-1", title: "2차 연결 요청 전 게이트 점검", priority: 1, status: "OPEN", suggestedAction: "VERIFY" },
      { id: "todo-L3-2", title: "예약 유도 안내 발송", priority: 1, status: "OPEN", suggestedAction: "SMS" },
      { id: "todo-L3-3", title: "후속 경로 후보 전환 기록", priority: 2, status: "OPEN", suggestedAction: "SCHEDULE" },
    ],
  };

  if (qualityLevel === "EXCLUDE") {
    return [
      {
        id: "todo-q-1",
        title: "데이터 품질 보강 요청",
        priority: 1,
        status: "OPEN",
        suggestedAction: "VERIFY",
      },
      {
        id: "todo-q-2",
        title: "우선순위 제외 사유 검토",
        priority: 2,
        status: "OPEN",
        suggestedAction: "EXCLUDE",
      },
      {
        id: "todo-q-3",
        title: "연락 실행 보류 확인",
        priority: 3,
        status: "CANCELED",
        suggestedAction: "HOLD",
      },
    ];
  }

  if (qualityLevel === "WARN") {
    return byLevel[level].map((todo, idx) => (idx === 0 ? { ...todo, priority: 2 as const } : todo));
  }

  return byLevel[level];
}

function buildInitialTimeline(caseRecord: CaseRecord | undefined, level: InterventionLevel): ContactEvent[] {
  const baseStatus = caseRecord?.status ?? "진행중";
  const actor = caseRecord?.manager ?? STAGE1_PANEL_OPERATOR;

  const events: ContactEvent[] = [
    {
      type: "STATUS_CHANGE",
      at: withHoursFromNow(-72),
      from: "접수",
      to: baseStatus,
      reason: "Stage1 케이스 등록",
      by: actor,
    },
    {
      type: "LEVEL_CHANGE",
      at: withHoursFromNow(-48),
      from: "L0",
      to: level,
      reason: "위험 신호 및 SLA 상태 반영",
      by: actor,
    },
  ];

  if (baseStatus !== "완료") {
    events.unshift({
      type: "CALL_ATTEMPT",
      at: withHoursFromNow(-18),
      result: "NO_ANSWER",
      note: "부재로 재접촉 필요",
      by: actor,
    });
  }

  if (caseRecord?.alertTags.includes("연계 대기")) {
    events.unshift({
      type: "SMS_SENT",
      at: withHoursFromNow(-14),
      templateId: "S1_CONTACT_BASE",
      status: "PENDING",
      by: actor,
    });
  }

  return events;
}

function buildInitialStage1Detail(caseRecord?: CaseRecord): Stage1Detail {
  const intervention = getStage1InterventionPlan(caseRecord);
  const quality = mapDataQuality(caseRecord?.quality);
  const preTriageInput = buildPreTriageInput(caseRecord);
  const preTriage = buildPreTriageResult(preTriageInput);
  const contactPlan = buildContactPlan(preTriage.strategy, caseRecord);
  const contactExecution = buildInitialContactExecution();
  const linkageStatus: LinkageStatus = "NOT_CREATED";

  const riskGuardrails: string[] = [];
  if (hasVulnerableTrigger(preTriage.triggers)) {
    riskGuardrails.push("취약군 정책 적용: 상담사 우선 연결");
  }
  if (preTriage.triggers.includes("GUARDIAN_PRIMARY")) {
    riskGuardrails.push("보호자 우선 연락");
  }
  if (preTriage.triggers.includes("HAS_COMPLAINT_HISTORY")) {
    riskGuardrails.push("과거 민원 이력 있음");
  }
  if (preTriage.triggers.includes("HAS_REFUSAL_HISTORY")) {
    riskGuardrails.push("거부 이력 재확인 필요");
  }

  return {
    header: {
      caseId: caseRecord?.id ?? "CASE-UNKNOWN",
      stage: "STAGE1",
      assigneeName: caseRecord?.manager ?? STAGE1_PANEL_OPERATOR,
      statusLabel: caseRecord?.status === "완료" ? "완료" : caseRecord?.status === "지연" ? "진행중" : caseRecord?.status ?? "진행중",
      waitDays: inferWaitDays(caseRecord?.status),
      sla: inferSla(caseRecord?.status),
      dataQuality: quality,
      contactStrategy: preTriage.strategy,
      effectiveStrategy: preTriage.strategy,
      riskGuardrails: riskGuardrails.length > 0 ? riskGuardrails : undefined,
    },
    policyGates: buildPolicyGates(caseRecord),
    interventionLevel: intervention.level,
    riskEvidence: buildRiskEvidence(caseRecord),
    scoreSummary: buildScoreSummary(caseRecord),
    todos: buildTodos(intervention.level, quality.level),
    timeline: buildInitialTimeline(caseRecord, intervention.level),
    preTriageInput,
    preTriageResult: preTriage,
    contactPlan,
    contactExecution,
    contactFlowSteps: buildContactFlowSteps(contactExecution, preTriage, linkageStatus),
    linkageStatus,
  };
}

function buildInitialAuditLogs(caseRecord: CaseRecord | undefined, detail: Stage1Detail): AuditLogEntry[] {
  const actor = caseRecord?.manager ?? STAGE1_PANEL_OPERATOR;

  return [
    {
      id: `audit-${detail.header.caseId}-1`,
      at: formatDateTime(withHoursFromNow(-72)),
      actor,
      message: "케이스 상세 열람: 운영 보드 진입",
    },
    {
      id: `audit-${detail.header.caseId}-2`,
      at: formatDateTime(withHoursFromNow(-48)),
      actor,
      message: `접촉 방식 확정: ${detail.preTriageResult?.strategy === "HUMAN_FIRST" ? "상담사 우선" : "자동안내 우선"}`,
    },
    {
      id: `audit-${detail.header.caseId}-3`,
      at: formatDateTime(withHoursFromNow(-32)),
      actor,
      message: `개입 레벨 설정: ${detail.interventionLevel}`,
    },
    {
      id: `audit-${detail.header.caseId}-4`,
      at: formatDateTime(withHoursFromNow(-18)),
      actor,
      message: "연락 이력 동기화: 완료",
    },
  ];
}

function remainingTimeText(targetIso: string | undefined, nowMs: number) {
  if (!targetIso) return "-";
  const target = new Date(targetIso).getTime();
  if (Number.isNaN(target)) return "-";

  const diffMs = target - nowMs;
  const abs = Math.abs(diffMs);
  const hours = Math.floor(abs / (1000 * 60 * 60));
  const mins = Math.floor((abs % (1000 * 60 * 60)) / (1000 * 60));

  if (diffMs >= 0) {
    return `${hours}시간 ${mins}분 남음`;
  }
  return `${hours}시간 ${mins}분 경과`;
}

function eventToCategory(event: ContactEvent): TimelineFilter {
  if (event.type === "CALL_ATTEMPT") return "CALL";
  if (event.type === "SMS_SENT") return "SMS";
  return "STATUS";
}

function eventTitle(event: ContactEvent) {
  if (event.type === "CALL_ATTEMPT") {
    if (event.result === "SUCCESS") return "연락 성공";
    if (event.result === "NO_ANSWER") return "부재";
    if (event.result === "REJECTED") return "연락 거절";
    return "번호 오류";
  }
  if (event.type === "SMS_SENT") {
    return `문자 발송 (${resolveSmsTemplateLabel(event.templateId)})`;
  }
  if (event.type === "LEVEL_CHANGE") {
    return `개입 레벨 변경 ${event.from} → ${event.to}`;
  }
  if (event.type === "POLICY_GATE_UPDATE") {
    return `정책 게이트 업데이트 (${event.key})`;
  }
  return `상태 변경 ${event.from} → ${event.to}`;
}

function eventDetail(event: ContactEvent) {
  if (event.type === "CALL_ATTEMPT") {
    return event.note ?? "연락 결과 기록";
  }
  if (event.type === "SMS_SENT") {
    return `발송 상태: ${event.status}`;
  }
  if (event.type === "LEVEL_CHANGE") {
    return event.reason;
  }
  if (event.type === "POLICY_GATE_UPDATE") {
    return `상태: ${event.status}`;
  }
  return event.reason;
}

function dataQualityText(level: DataQualityLevel) {
  if (level === "GOOD") return "정상";
  if (level === "WARN") return "주의";
  return "우선순위 제외";
}

function slaText(level: SlaLevel) {
  if (level === "OK") return "정상";
  if (level === "DUE_SOON") return "임박";
  return "지연";
}

function todoTone(priority: TodoItem["priority"]) {
  if (priority === 1) return "border-red-200 bg-red-50 text-red-700";
  if (priority === 2) return "border-orange-200 bg-orange-50 text-orange-700";
  return "border-blue-200 bg-blue-50 text-blue-700";
}

function gateTone(status: PolicyGate["status"]) {
  if (status === "PASS") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "FAIL") return "border-red-200 bg-red-50 text-red-700";
  return "border-gray-200 bg-gray-50 text-gray-600";
}

function getGateFailureReason(gates: PolicyGate[], required: PolicyGateKey[]) {
  const failed = gates.find((gate) => required.includes(gate.key) && gate.status !== "PASS");
  return failed?.failReason ?? (failed ? `${failed.label} 확인 필요` : undefined);
}

function callResultLabel(result: OutcomeDraft extends { mode: "CALL"; result: infer R } ? R : never) {
  if (result === "SUCCESS") return "연락 성공";
  if (result === "NO_ANSWER") return "부재";
  if (result === "REJECTED") return "거절";
  return "번호 오류";
}

function smsResultLabel(result: SmsDispatchStatus) {
  if (result === "DELIVERED") return "전송 완료";
  if (result === "FAILED") return "전송 실패";
  return "전송 예약";
}

function smsMessageTypeLabel(type: SmsTemplate["messageType"]) {
  if (type === "CONTACT") return "접촉";
  if (type === "BOOKING") return "예약안내";
  return "리마인더";
}

function resolveSmsTemplateLabel(templateId: string) {
  const normalized = templateId.split("(")[0];
  const match = SMS_TEMPLATES.find((template) => template.id === normalized);
  return match ? `${smsMessageTypeLabel(match.messageType)} · ${match.label}` : templateId;
}

import { sendSmsApi as sendSmsApiCommon } from "../../sms/smsService";

/* ── 접촉 전략 관련 상수 / 유틸 ── */

const STRATEGY_LABELS: Record<ContactStrategy, string> = {
  HUMAN_FIRST: "상담사 우선",
  AI_FIRST: "자동안내 우선",
  MANUAL_OVERRIDE: "수동 전환",
};

const STRATEGY_TONES: Record<ContactStrategy, string> = {
  HUMAN_FIRST: "border-red-200 bg-red-50 text-red-700",
  AI_FIRST: "border-blue-200 bg-blue-50 text-blue-700",
  MANUAL_OVERRIDE: "border-amber-200 bg-amber-50 text-amber-700",
};

const STRATEGY_HELPER_TEXT = "접촉 전략은 사전 기준(룰)에 따라 추천되며, 최종 실행/전환은 담당자가 수행합니다.";

const TRIGGER_REASON_LABELS: Record<string, string> = {
  AGE_OVER_THRESHOLD: "고령 기준에 해당되어 상담사 우선 안내가 권고됩니다.",
  HAS_MCI_HISTORY: "이전 인지저하 이력이 있어 상담사 확인이 우선입니다.",
  HAS_DEMENTIA_HISTORY: "치매 관련 이력이 있어 상담사 직접 안내가 필요합니다.",
  HAS_COMPLAINT_HISTORY: "과거 민원 이력이 있어 상담사 우선 대응이 권고됩니다.",
  HAS_REFUSAL_HISTORY: "거부 이력이 있어 상담사 확인 후 접촉이 안전합니다.",
  GUARDIAN_PRIMARY: "보호자가 주 연락 대상이라 보호자 우선 안내가 필요합니다.",
  NEEDS_GUARDIAN_SUPPORT: "본인 단독 응답이 어려울 수 있어 보호자 확인이 필요합니다.",
  COMPREHENSION_DIFFICULTY: "이해 어려움 가능성이 있어 상담사 우선 안내가 권고됩니다.",
  STANDARD_CONTACT_PATH: "일반 기준에 해당되어 자동 안내 우선이 가능합니다.",
  CALL_RESPONSE_POOR: "최근 전화 응답률이 낮아 접촉 방식 조정이 필요합니다.",
  SMS_RESPONSE_POOR: "최근 문자 응답률이 낮아 접촉 방식 조정이 필요합니다.",
};

function explainStrategyTrigger(trigger: string) {
  if (trigger.startsWith("수동 전환:")) {
    return `담당자 수동 변경 사유: ${trigger.replace("수동 전환:", "").trim()}`;
  }
  return TRIGGER_REASON_LABELS[trigger] ?? trigger;
}

const OUTCOME_LABELS: Record<OutcomeCode, { label: string; icon: string; tone: string }> = {
  CONTINUE_SELF: { label: "계속 진행", icon: "→", tone: "border-emerald-200 bg-emerald-50 text-emerald-700" },
  SCHEDULE_LATER: { label: "나중에", icon: "⏰", tone: "border-blue-200 bg-blue-50 text-blue-700" },
  REQUEST_GUARDIAN: { label: "보호자 연결", icon: "👤", tone: "border-violet-200 bg-violet-50 text-violet-700" },
  REQUEST_HUMAN: { label: "상담사 연결", icon: "☎", tone: "border-orange-200 bg-orange-50 text-orange-700" },
  REFUSE: { label: "중단/거부", icon: "✕", tone: "border-red-200 bg-red-50 text-red-700" },
  NO_RESPONSE: { label: "무응답 처리", icon: "…", tone: "border-gray-200 bg-gray-50 text-gray-600" },
  CONFUSED: { label: "이해 어려움", icon: "?", tone: "border-amber-200 bg-amber-50 text-amber-700" },
  EMOTIONAL: { label: "감정적 반응", icon: "!", tone: "border-yellow-200 bg-yellow-50 text-yellow-700" },
};

const CONTACT_FLOW_STEPS_META: Array<{ step: ContactFlowStep; label: string; description: string }> = [
  { step: "PRE_TRIAGE", label: "A. 사전 확인", description: "기초 정보와 이력 확인" },
  { step: "STRATEGY", label: "B. 접촉 주체", description: "상담사 우선/자동안내 우선 적용" },
  { step: "COMPOSE", label: "C. 접촉 준비", description: "문자/전화 실행 준비" },
  { step: "SEND", label: "D. 접촉 진행", description: "응답 확인 및 기록" },
  { step: "RESPONSE", label: "E. 분기 처리", description: "유지/전환/보류/중단 처리" },
  { step: "OUTCOME", label: "F. 후속 생성", description: "예약/의뢰/추적 등록" },
];

const STAGE1_FLOW_CONFIG: Stage1FlowCardConfig[] = [
  {
    id: "PRECHECK",
    title: "사전 조건 확인",
    description: "동의/연락 가능 여부 확인",
    relatedSteps: ["PRE_TRIAGE", "STRATEGY"],
    action: "OPEN_PRECHECK",
  },
  {
    id: "CONTACT_EXECUTION",
    title: "접촉 실행",
    description: "전화·문자 실행 및 기록",
    relatedSteps: ["COMPOSE", "SEND"],
    action: "OPEN_CONTACT_EXECUTION",
  },
  {
    id: "RESPONSE_HANDLING",
    title: "반응 처리",
    description: "응답 결과/무응답/상담 전환 처리",
    relatedSteps: ["RESPONSE"],
    action: "OPEN_RESPONSE_HANDLING",
  },
  {
    id: "FOLLOW_UP",
    title: "후속 결정",
    description: "유지·보류·연계 및 인수인계 확정",
    relatedSteps: ["OUTCOME"],
    action: "OPEN_FOLLOW_UP",
  },
];

const STAGE1_STEP_MODAL_MAP: Record<Stage1FlowAction, Stage1FlowCardId> = {
  OPEN_PRECHECK: "PRECHECK",
  OPEN_CONTACT_EXECUTION: "CONTACT_EXECUTION",
  OPEN_RESPONSE_HANDLING: "RESPONSE_HANDLING",
  OPEN_FOLLOW_UP: "FOLLOW_UP",
};

const FLOW_STATUS_META: Record<
  Stage1FlowVisualStatus,
  {
    label: string;
    icon: React.ComponentType<{ size?: number; className?: string }>;
    cardTone: string;
    chipTone: string;
    reasonTone: string;
  }
> = {
  COMPLETED: {
    label: "완료",
    icon: CheckCircle2,
    cardTone:
      "border-emerald-200 bg-emerald-50/70 text-emerald-900 shadow-sm hover:shadow-emerald-200/70",
    chipTone: "border border-emerald-200 bg-emerald-100 text-emerald-700",
    reasonTone: "border-emerald-200 bg-white/70 text-emerald-800",
  },
  PENDING: {
    label: "대기",
    icon: Clock3,
    cardTone:
      "border-sky-200 bg-sky-50/70 text-slate-900 shadow-sm hover:shadow-sky-200/60",
    chipTone: "border border-sky-200 bg-sky-100 text-sky-700",
    reasonTone: "border-sky-200 bg-white/70 text-slate-700",
  },
  BLOCKED: {
    label: "누락",
    icon: AlertCircle,
    cardTone:
      "border-rose-200 bg-rose-50/80 text-rose-900 shadow-inner hover:shadow-rose-200/50",
    chipTone: "border border-rose-200 bg-rose-100 text-rose-700",
    reasonTone: "border-rose-200 bg-white/70 text-rose-800",
  },
};

const CONTACT_STATUS_HINT: Record<ContactExecutionStatus, string> = {
  NOT_STARTED: "미접촉",
  SENT: "발송 완료",
  WAITING_RESPONSE: "응답 대기",
  RETRY_NEEDED: "재시도 필요",
  HANDOFF_TO_HUMAN: "상담 전환",
  PAUSED: "보류",
  STOPPED: "중단",
  DONE: "완료",
};

const LINKAGE_STATUS_HINT: Record<LinkageStatus, string> = {
  NOT_CREATED: "미생성",
  BOOKING_IN_PROGRESS: "예약중",
  BOOKING_DONE: "예약완료",
  REFERRAL_CREATED: "의뢰생성",
};

const STAGE1_LINKAGE_ACTION_META: Record<
  Stage1LinkageAction,
  {
    title: string;
    description: string;
    nextStatus: LinkageStatus;
    note: string;
  }
> = {
  CENTER_LINKAGE: {
    title: "안심센터 연계",
    description: "센터 내부 상담/프로그램 연계",
    nextStatus: "BOOKING_IN_PROGRESS",
    note: "센터 내부 연계 경로를 생성합니다.",
  },
  HOSPITAL_LINKAGE: {
    title: "병원 연계",
    description: "의뢰 생성 및 병원 연계 준비",
    nextStatus: "REFERRAL_CREATED",
    note: "의뢰 문서와 연락 채널을 확인합니다.",
  },
  COUNSELING_LINKAGE: {
    title: "치매상담소 연계",
    description: "상담소 예약 연계 및 일정 확정",
    nextStatus: "BOOKING_DONE",
    note: "상담소 접수 완료 후 예약 상태를 확정합니다.",
  },
};

function useStage1Flow(detail: Stage1Detail): Stage1FlowCard[] {
  return useMemo(() => {
    const gateFailCount = detail.policyGates.filter((gate) => gate.status === "FAIL").length;
    const preTriageReady = Boolean(detail.preTriageInput) && detail.header.dataQuality.level !== "EXCLUDE";
    const strategyDecided = Boolean(detail.preTriageResult?.strategy);
    const hasContactAttempt = detail.contactExecution.status !== "NOT_STARTED";
    const hasResponse = Boolean(detail.contactExecution.lastOutcomeCode || detail.contactExecution.lastResponseAt);
    const followUpCompleted =
      detail.linkageStatus !== "NOT_CREATED" ||
      detail.contactExecution.status === "DONE" ||
      detail.contactExecution.status === "STOPPED";
    const flowStepStatusMap = new Map(detail.contactFlowSteps.map((step) => [step.step, step.status] as const));
    const flowStepLabelMap = new Map(CONTACT_FLOW_STEPS_META.map((step) => [step.step, step.label] as const));
    const relatedStepSummary = (steps: ContactFlowStep[]) =>
      steps
        .map((step) => `${flowStepLabelMap.get(step) ?? step}:${flowStepStatusMap.get(step) ?? "WAITING"}`)
        .join(" / ");

    const cards = STAGE1_FLOW_CONFIG.map((config) => {
      const relatedSummary = relatedStepSummary(config.relatedSteps);
      if (config.id === "PRECHECK") {
        if (gateFailCount > 0 || !preTriageReady) {
          return {
            ...config,
            status: "BLOCKED" as const,
            reason: gateFailCount > 0
              ? `필수 게이트 ${gateFailCount}건이 아직 충족되지 않았습니다.`
              : "사전 확인 입력이 누락되어 접촉 전략 확정이 불가합니다.",
            nextActionHint: "사전 확인/게이트 관리 영역에서 필수 항목을 보완하세요.",
            metricLabel: gateFailCount > 0 ? `게이트 FAIL ${gateFailCount}건 · ${relatedSummary}` : `사전 확인 누락 · ${relatedSummary}`,
            isCurrent: false,
          };
        }
        if (strategyDecided) {
          return {
            ...config,
            status: "COMPLETED" as const,
            reason: "사전 조건과 접촉 전략이 확인되었습니다.",
            nextActionHint: "접촉 실행 단계로 이동해 문자/전화를 실행하세요.",
            metricLabel: `전략 ${detail.preTriageResult?.strategy ?? "확정"} · ${relatedSummary}`,
            isCurrent: false,
          };
        }
        return {
          ...config,
          status: "PENDING" as const,
          reason: "사전 조건은 확인됐지만 접촉 전략 확정이 남았습니다.",
          nextActionHint: "전략 배지와 정책 사유를 확인해 접촉 전략을 확정하세요.",
          metricLabel: `전략 확정 대기 · ${relatedSummary}`,
          isCurrent: false,
        };
      }

      if (config.id === "CONTACT_EXECUTION") {
        if (!preTriageReady || !strategyDecided) {
          return {
            ...config,
            status: "BLOCKED" as const,
            reason: "사전 조건 확인이 완료되어야 접촉 실행이 가능합니다.",
            nextActionHint: "먼저 사전 조건 확인 단계에서 누락 항목을 보완하세요.",
            metricLabel: `실행 대기 · ${relatedSummary}`,
            isCurrent: false,
          };
        }
        if (hasContactAttempt) {
          return {
            ...config,
            status: "COMPLETED" as const,
            reason: "접촉 실행 이력이 기록되었습니다.",
            nextActionHint: "응답 상태를 확인하고 반응 처리 단계로 이동하세요.",
            metricLabel: `${CONTACT_STATUS_HINT[detail.contactExecution.status]} · ${relatedSummary}`,
            isCurrent: false,
          };
        }
        return {
          ...config,
          status: "PENDING" as const,
          reason: "아직 문자/전화 실행 기록이 없습니다.",
          nextActionHint: "상담/문자 실행 패널을 열어 1차 접촉을 시작하세요.",
          metricLabel: `미접촉 · ${relatedSummary}`,
          isCurrent: false,
        };
      }

      if (config.id === "RESPONSE_HANDLING") {
        if (!hasContactAttempt) {
          return {
            ...config,
            status: "BLOCKED" as const,
            reason: "접촉 실행 이후에만 응답 결과를 처리할 수 있습니다.",
            nextActionHint: "접촉 실행 단계에서 먼저 전화/문자를 수행하세요.",
            metricLabel: `응답 없음 · ${relatedSummary}`,
            isCurrent: false,
          };
        }
        if (hasResponse) {
          return {
            ...config,
            status: "COMPLETED" as const,
            reason: "응답 결과가 기록되어 분기 처리가 가능합니다.",
            nextActionHint: "후속 결정 단계에서 연계/보류/종결을 확정하세요.",
            metricLabel: detail.contactExecution.lastOutcomeCode
              ? `${OUTCOME_LABELS[detail.contactExecution.lastOutcomeCode].label} · ${relatedSummary}`
              : `응답 기록 완료 · ${relatedSummary}`,
            isCurrent: false,
          };
        }
        return {
          ...config,
          status: "PENDING" as const,
          reason: "접촉은 수행되었지만 응답 결과 기록이 없습니다.",
          nextActionHint: "응답 결과 처리 패널에서 결과 버튼을 선택해 기록하세요.",
          metricLabel: `응답 기록 대기 · ${relatedSummary}`,
          isCurrent: false,
        };
      }

      if (!hasResponse) {
        return {
          ...config,
          status: "BLOCKED" as const,
          reason: "응답 결과가 기록되어야 후속 결정을 진행할 수 있습니다.",
          nextActionHint: "반응 처리 단계에서 Outcome을 먼저 기록하세요.",
          metricLabel: `${LINKAGE_STATUS_HINT[detail.linkageStatus]} · ${relatedSummary}`,
          isCurrent: false,
        };
      }
      if (followUpCompleted) {
        return {
          ...config,
          status: "COMPLETED" as const,
          reason: "후속 조치가 생성되었거나 케이스가 종결되었습니다.",
          nextActionHint: "필요시 인수인계 메모를 보완하고 감사 로그를 확인하세요.",
          metricLabel: `${LINKAGE_STATUS_HINT[detail.linkageStatus]} · ${relatedSummary}`,
          isCurrent: false,
        };
      }
      return {
        ...config,
        status: "PENDING" as const,
        reason: "후속 생성 또는 인수인계 확정이 남아 있습니다.",
        nextActionHint: "후속 결정 패널에서 연계/보류/전환을 확정하세요.",
        metricLabel: `${LINKAGE_STATUS_HINT[detail.linkageStatus]} · ${relatedSummary}`,
        isCurrent: false,
      };
    });

    const currentIndex = cards.findIndex((card) => card.status !== "COMPLETED");
    const resolvedCurrentIndex = currentIndex === -1 ? cards.length - 1 : currentIndex;

    return cards.map((card, index) => ({
      ...card,
      isCurrent: index === resolvedCurrentIndex,
    }));
  }, [detail]);
}

function buildPreTriageInput(caseRecord?: CaseRecord): PreTriageInput {
  const age = caseRecord?.profile.age ?? 70;
  const hasGuardian = Boolean(caseRecord?.profile.guardianPhone);
  const hasComplaint = caseRecord?.quality === "경고" || Boolean(caseRecord?.alertTags.includes("이탈 위험"));
  const hasRefusal = caseRecord?.status === "지연" || Boolean(caseRecord?.alertTags.includes("재평가 필요"));
  const needsGuardian = !hasGuardian && age >= 75;
  const comprehensionDifficultyFlag = age >= 80 || caseRecord?.risk === "고";
  const hasMCI = Boolean(caseRecord?.alertTags.includes("High MCI") || caseRecord?.alertTags.includes("재평가 필요"));
  const hasDementia = caseRecord?.risk === "고" && age >= 80;

  return {
    age,
    dxHistory: { hasMCI, hasDementia },
    contactHistory: {
      hasComplaint,
      hasRefusal,
      needsGuardian,
      comprehensionDifficultyFlag,
    },
    guardian: {
      exists: hasGuardian,
      isPrimaryContact: hasGuardian && (needsGuardian || comprehensionDifficultyFlag),
    },
    responseHistory: {
      smsResponseGood: caseRecord?.risk !== "고",
      callResponseGood: caseRecord?.status !== "지연",
      lastOutcome: caseRecord?.status === "지연" ? "NO_RESPONSE" : undefined,
    },
  };
}

function buildPreTriageResult(input: PreTriageInput): PreTriageResult {
  return derivePreTriageResultByRule(input);
}

function buildContactPlan(strategy: RecommendedContactStrategy, caseRecord?: CaseRecord): ContactPlan {
  if (strategy === "HUMAN_FIRST") {
    return {
      channel: "HYBRID",
      templateId: caseRecord?.profile.guardianPhone ? "S1_CONTACT_GUARDIAN" : "S1_CONTACT_BASE",
      maxRetryPolicy: { maxRetries: 3, intervalHours: 24 },
    };
  }
  return {
    channel: "SMS",
    templateId: "S1_CONTACT_BASE",
    maxRetryPolicy: { maxRetries: 2, intervalHours: 24 },
  };
}

function buildInitialContactExecution(): ContactExecution {
  return { status: "NOT_STARTED", retryCount: 0 };
}

function buildContactFlowSteps(
  execution: ContactExecution,
  preTriage?: PreTriageResult,
  linkageStatus: LinkageStatus = "NOT_CREATED"
): ContactFlowState[] {
  const hasPreTriage = Boolean(preTriage);
  const hasStrategy = Boolean(preTriage?.strategy);
  const isSent = execution.status !== "NOT_STARTED";
  const hasOutcome = Boolean(execution.lastOutcomeCode || execution.lastResponseAt);
  const hasRiskWarning = execution.status === "HANDOFF_TO_HUMAN" || execution.status === "STOPPED" || execution.status === "RETRY_NEEDED";

  return CONTACT_FLOW_STEPS_META.map(({ step, label, description }) => {
    let status: ContactFlowStepStatus = "WAITING";
    if (step === "PRE_TRIAGE") status = hasPreTriage ? "DONE" : "MISSING";
    else if (step === "STRATEGY") status = hasStrategy ? "DONE" : "MISSING";
    else if (step === "COMPOSE") status = hasStrategy ? (isSent ? "DONE" : "WAITING") : "MISSING";
    else if (step === "SEND") status = isSent ? (hasOutcome ? "DONE" : "WAITING") : "MISSING";
    else if (step === "RESPONSE") status = hasOutcome ? (hasRiskWarning ? "WARNING" : "DONE") : isSent ? "WAITING" : "MISSING";
    else if (step === "OUTCOME") {
      if (!hasOutcome) status = "MISSING";
      else if (linkageStatus === "NOT_CREATED") status = "WAITING";
      else status = "DONE";
    }
    return { step, label, status, description };
  });
}

/** STAGE1_STD_TEMPLATES: SmsPanel에 전달할 StdSmsTemplate[] */
const STAGE1_STD_TEMPLATES: StdSmsTemplate[] = SMS_TEMPLATES.map((template) => ({
  id: template.id,
  type: template.messageType,
  label: template.label,
  body: (vars) =>
    template.body({
      caseId: "",
      centerName: vars.centerName,
      centerPhone: vars.centerPhone,
      guideLink: vars.guideLink,
      reservationLink: vars.bookingLink,
      unsubscribe: DEFAULT_UNSUBSCRIBE,
    }),
}));

export function Stage1OpsDetail({
  caseRecord,
  onHeaderSummaryChange,
}: {
  caseRecord?: CaseRecord;
  onHeaderSummaryChange?: (summary: Stage1HeaderSummary) => void;
}) {
  const [detail, setDetail] = useState<Stage1Detail>(() => buildInitialStage1Detail(caseRecord));
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>(() =>
    buildInitialAuditLogs(caseRecord, buildInitialStage1Detail(caseRecord))
  );
  const [timelineFilter, setTimelineFilter] = useState<TimelineFilter>("ALL");
  const [activeStage1Modal, setActiveStage1Modal] = useState<Stage1FlowCardId | null>(null);

  const [callTarget, setCallTarget] = useState<CallTarget>("citizen");
  const [callActive, setCallActive] = useState(false);
  const [callSeconds, setCallSeconds] = useState(0);
  const [callMemo, setCallMemo] = useState("");
  const [callResultDraft, setCallResultDraft] = useState<"SUCCESS" | "NO_ANSWER" | "REJECTED" | "WRONG_NUMBER">(
    "SUCCESS"
  );

  const [smsTargets, setSmsTargets] = useState<{ citizen: boolean; guardian: boolean }>({
    citizen: true,
    guardian: false,
  });
  const [smsTemplateId, setSmsTemplateId] = useState(SMS_TEMPLATES[0].id);
  const [smsScheduleType, setSmsScheduleType] = useState<"NOW" | "SCHEDULE">("NOW");
  const [smsScheduledAt, setSmsScheduledAt] = useState("");
  const [restrictNightSend, setRestrictNightSend] = useState(true);

  const [reasonModal, setReasonModal] = useState<ReasonActionDraft | null>(null);
  const [outcomeModal, setOutcomeModal] = useState<OutcomeDraft | null>(null);
  const [savingOutcome, setSavingOutcome] = useState(false);

  const [nowTick, setNowTick] = useState(Date.now());
  const [recontactDueAt, setRecontactDueAt] = useState(withHoursFromNow(24));

  /* ── 접촉 전략 Override 모달 ── */
  const [strategyOverrideOpen, setStrategyOverrideOpen] = useState(false);
  const [strategyOverrideReason, setStrategyOverrideReason] = useState("");
  const [strategyOverrideTarget, setStrategyOverrideTarget] = useState<RecommendedContactStrategy>("HUMAN_FIRST");

  const [selectedOutcomeCode, setSelectedOutcomeCode] = useState<OutcomeCode | null>(null);
  const [outcomeNote, setOutcomeNote] = useState("");
  const [responsePanelExpanded, setResponsePanelExpanded] = useState(true);

  /* ── 인수인계 메모 ── */
  const [handoffMemoOpen, setHandoffMemoOpen] = useState(false);
  const [handoffMemoText, setHandoffMemoText] = useState("");

  useEffect(() => {
    const initDetail = buildInitialStage1Detail(caseRecord);
    setDetail(initDetail);
    setAuditLogs(buildInitialAuditLogs(caseRecord, initDetail));
    setTimelineFilter("ALL");
    setActiveStage1Modal(null);
    setCallTarget("citizen");
    setCallActive(false);
    setCallSeconds(0);
    setCallMemo("");
    setCallResultDraft("SUCCESS");
    setSmsTargets({ citizen: true, guardian: false });
    setSmsTemplateId(SMS_TEMPLATES[0].id);
    setSmsScheduleType("NOW");
    setSmsScheduledAt("");
    setRestrictNightSend(true);
    setReasonModal(null);
    setOutcomeModal(null);
    setSavingOutcome(false);
    setRecontactDueAt(withHoursFromNow(24));
    setResponsePanelExpanded(true);
  }, [caseRecord?.id]);

  useEffect(() => {
    const ticker = window.setInterval(() => setNowTick(Date.now()), 1000);
    return () => window.clearInterval(ticker);
  }, []);

  useEffect(() => {
    if (!callActive) return;
    const timer = window.setInterval(() => {
      setCallSeconds((prev) => prev + 1);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [callActive]);

  const interventionGuides = useMemo(() => getStage1InterventionGuides(), []);

  const nextOpenTodo = useMemo(() => detail.todos.find((todo) => todo.status === "OPEN"), [detail.todos]);

  const filteredTimeline = useMemo(() => {
    if (timelineFilter === "ALL") return detail.timeline;
    return detail.timeline.filter((event) => eventToCategory(event) === timelineFilter);
  }, [detail.timeline, timelineFilter]);

  const smsTemplate = useMemo(
    () => SMS_TEMPLATES.find((template) => template.id === smsTemplateId) ?? SMS_TEMPLATES[0],
    [smsTemplateId]
  );

  const smsPreview = useMemo(() => {
    return smsTemplate.body({
      caseId: detail.header.caseId,
      centerName: DEFAULT_CENTER_NAME,
      centerPhone: DEFAULT_CENTER_PHONE,
      guideLink: DEFAULT_GUIDE_LINK,
      reservationLink: DEFAULT_BOOKING_URL,
      unsubscribe: DEFAULT_UNSUBSCRIBE,
    });
  }, [detail.header.caseId, smsTemplate]);

  const hasGuardianPhone = Boolean(caseRecord?.profile.guardianPhone);
  const callGateReason = getGateFailureReason(detail.policyGates, [
    "CONSENT_OK",
    "CONTACTABLE_TIME_OK",
    "PHONE_VERIFIED",
  ]);
  const smsGateReason = getGateFailureReason(detail.policyGates, [
    "CONSENT_OK",
    "CONTACTABLE_TIME_OK",
    "PHONE_VERIFIED",
  ]);

  const callDisabledReason =
    callGateReason ??
    (callTarget === "guardian" && !hasGuardianPhone ? "보호자 연락처가 없습니다" : undefined);
  const smsDisabledReason =
    smsGateReason ??
    ((smsTargets.guardian && !hasGuardianPhone) || (!smsTargets.citizen && !smsTargets.guardian)
      ? !smsTargets.citizen && !smsTargets.guardian
        ? "수신 대상을 선택하세요"
        : "보호자 연락처가 없습니다"
      : undefined);

  const sensitivityFlags = [
    detail.preTriageInput?.contactHistory.hasComplaint ? "민원 이력" : null,
    detail.preTriageInput?.contactHistory.hasRefusal ? "거부 이력" : null,
  ].filter(Boolean) as string[];
  const currentHour = new Date(nowTick).getHours();
  const isNightWindow = currentHour >= 21 || currentHour < 8;
  const isNightBlocked = restrictNightSend && isNightWindow;
  const composerPreview = `${smsPreview}\n\n${CONTACT_DISCLAIMER}`;

  const appendAuditLog = (message: string) => {
    const entry: AuditLogEntry = {
      id: `audit-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      at: formatDateTime(nowIso()),
      actor: detail.header.assigneeName || STAGE1_PANEL_OPERATOR,
      message,
    };
    setAuditLogs((prev) => [entry, ...prev]);
  };

  const appendTimeline = (event: ContactEvent) => {
    setDetail((prev) => ({ ...prev, timeline: [event, ...prev.timeline] }));
  };

  const updateGateStatus = (key: PolicyGateKey, status: PolicyGate["status"], byActionLabel: string) => {
    setDetail((prev) => ({
      ...prev,
      policyGates: prev.policyGates.map((gate) =>
        gate.key === key ? { ...gate, status, failReason: status === "PASS" ? undefined : gate.failReason } : gate
      ),
    }));

    appendTimeline({
      type: "POLICY_GATE_UPDATE",
      at: nowIso(),
      key,
      status,
      by: detail.header.assigneeName,
    });
    appendAuditLog(`정책 게이트 업데이트 (${byActionLabel})`);
  };

  const regenerateTodos = (level: InterventionLevel, qualityLevel: DataQualityLevel) => {
    setDetail((prev) => {
      const existingDone = new Set(prev.todos.filter((todo) => todo.status === "DONE").map((todo) => todo.title));
      const nextTodos = buildTodos(level, qualityLevel).map((todo) =>
        existingDone.has(todo.title) ? { ...todo, status: "DONE" as const } : todo
      );

      return { ...prev, todos: nextTodos };
    });
  };

  const changeTodoStatus = (todoId: string, status: TodoItem["status"]) => {
    setDetail((prev) => ({
      ...prev,
      todos: prev.todos.map((todo) => (todo.id === todoId ? { ...todo, status } : todo)),
    }));

    const target = detail.todos.find((todo) => todo.id === todoId);
    if (!target) return;

    appendTimeline({
      type: "STATUS_CHANGE",
      at: nowIso(),
      from: target.status,
      to: status,
      reason: `To-Do 처리: ${target.title}`,
      by: detail.header.assigneeName,
    });

    appendAuditLog(`To-Do ${status === "DONE" ? "완료" : status === "SNOOZED" ? "보류" : "취소"}: ${target.title}`);
    toast.success("처리 완료(로그 기록됨)");
  };

  const completeSuggestedTodo = (action: TodoItem["suggestedAction"]) => {
    const target = detail.todos.find((todo) => todo.status === "OPEN" && todo.suggestedAction === action);
    if (!target) return;
    changeTodoStatus(target.id, "DONE");
  };

  const handleGateFixAction = (gate: PolicyGate) => {
    const action = gate.fixAction?.action;
    if (!action) return;

    if (action === "CONFIRM_CONTACT_TIME") {
      updateGateStatus("CONTACTABLE_TIME_OK", "PASS", "연락 시간 확인 처리");
      toast.success("처리 완료(로그 기록됨)");
      appendAuditLog("연락 시간 확인 처리");
      return;
    }

    if (action === "REQUEST_CONSENT") {
      updateGateStatus("CONSENT_OK", "PASS", "동의 요청 처리");
      toast.success("처리 완료(로그 기록됨)");
      return;
    }

    if (action === "VERIFY_PHONE") {
      updateGateStatus("PHONE_VERIFIED", "PASS", "연락처 검증");
      toast.success("처리 완료(로그 기록됨)");
      return;
    }

    if (action === "ADD_GUARDIAN") {
      updateGateStatus("GUARDIAN_OPTIONAL", "PASS", "보호자 연락처 등록");
      toast.success("처리 완료(로그 기록됨)");
    }
  };

  const openLevelChangeModal = (toLevel: InterventionLevel) => {
    if (toLevel === detail.interventionLevel) return;
    setReasonModal({
      mode: "LEVEL",
      title: `개입 레벨 변경 (${detail.interventionLevel} → ${toLevel})`,
      confirmLabel: "변경 적용",
      nextLevel: toLevel,
      reason: "",
    });
  };

  const openStatusReasonModal = (nextStatus: "보류" | "우선순위 제외") => {
    setReasonModal({
      mode: "STATUS",
      title: `${nextStatus} 처리 사유 입력`,
      confirmLabel: `${nextStatus} 적용`,
      nextStatus,
      reason: "",
    });
  };

  const handleLinkageAction = (action: Stage1LinkageAction) => {
    const meta = STAGE1_LINKAGE_ACTION_META[action];
    const before = detail.linkageStatus;
    const after = meta.nextStatus;

    setDetail((prev) => {
      const newExec: ContactExecution = {
        ...prev.contactExecution,
        status:
          prev.contactExecution.status === "STOPPED"
            ? "STOPPED"
            : prev.contactExecution.status === "DONE"
              ? "DONE"
              : "HANDOFF_TO_HUMAN",
      };

      return {
        ...prev,
        linkageStatus: after,
        contactExecution: newExec,
        contactFlowSteps: buildContactFlowSteps(newExec, prev.preTriageResult, after),
      };
    });

    appendTimeline({
      type: "STATUS_CHANGE",
      at: nowIso(),
      from: LINKAGE_STATUS_HINT[before],
      to: LINKAGE_STATUS_HINT[after],
      reason: `${meta.title} 실행`,
      by: detail.header.assigneeName,
    });
    appendAuditLog(`연계 실행: ${meta.title}`);
    toast.success(`${meta.title}가 기록되었습니다.`);
  };

  const confirmReasonAction = () => {
    if (!reasonModal || !reasonModal.reason.trim()) return;

    if (reasonModal.mode === "LEVEL") {
      const nextLevel = reasonModal.nextLevel;
      const prevLevel = detail.interventionLevel;
      const qualityLevel = detail.header.dataQuality.level;

      setDetail((prev) => ({ ...prev, interventionLevel: nextLevel }));
      regenerateTodos(nextLevel, qualityLevel);

      appendTimeline({
        type: "LEVEL_CHANGE",
        at: nowIso(),
        from: prevLevel,
        to: nextLevel,
        reason: reasonModal.reason,
        by: detail.header.assigneeName,
      });
      appendAuditLog(`개입 레벨 변경: ${prevLevel} → ${nextLevel} (${reasonModal.reason})`);
      toast.success("처리 완료(로그 기록됨)");
      setReasonModal(null);
      return;
    }

    const from = detail.header.statusLabel;
    const to = reasonModal.nextStatus;

    setDetail((prev) => {
      const nextQuality =
        to === "우선순위 제외"
          ? {
              level: "EXCLUDE" as DataQualityLevel,
              score: Math.min(prev.header.dataQuality.score, 60),
              notes: ["우선순위 제외 상태", "데이터 보강 후 재개 가능"],
            }
          : prev.header.dataQuality;

      return {
        ...prev,
        header: {
          ...prev.header,
          statusLabel: to,
          dataQuality: nextQuality,
        },
        todos: to === "우선순위 제외" ? buildTodos(prev.interventionLevel, "EXCLUDE") : prev.todos,
      };
    });

    appendTimeline({
      type: "STATUS_CHANGE",
      at: nowIso(),
      from,
      to,
      reason: reasonModal.reason,
      by: detail.header.assigneeName,
    });
    appendAuditLog(`상태 변경: ${from} → ${to} (${reasonModal.reason})`);
    toast.success("처리 완료(로그 기록됨)");
    setReasonModal(null);
  };

  const handleCallStart = () => {
    if (callDisabledReason) return;
    setCallActive(true);
    setCallSeconds(0);
    appendAuditLog(`전화 연결 시작 (${callTarget === "citizen" ? "본인" : "보호자"})`);
  };

  const handleCallStop = () => {
    setCallActive(false);
    setOutcomeModal({
      mode: "CALL",
      title: "통화 결과 기록",
      result: callResultDraft,
      note: callMemo,
      durationSec: callSeconds,
    });
  };

  const handleSmsDispatchPrepare = () => {
    if (smsDisabledReason) return;
    setOutcomeModal({
      mode: "SMS",
      title: smsScheduleType === "NOW" ? "문자 발송 결과 기록" : "문자 예약 결과 기록",
      result: smsScheduleType === "NOW" ? "DELIVERED" : "PENDING",
      note: "",
      scheduled: smsScheduleType === "SCHEDULE",
    });
  };

  const confirmOutcome = async () => {
    if (!outcomeModal) return;
    setSavingOutcome(true);

    if (outcomeModal.mode === "CALL") {
      const at = nowIso();
      const result = outcomeModal.result;
      const note = outcomeModal.note.trim();

      appendTimeline({
        type: "CALL_ATTEMPT",
        at,
        result,
        note: note || undefined,
        by: detail.header.assigneeName,
      });

      appendAuditLog(`통화 결과 기록: ${callResultLabel(result)}${note ? ` (${note})` : ""}`);

      setDetail((prev) => ({
        ...prev,
        header: {
          ...prev.header,
          waitDays: result === "SUCCESS" ? 0 : prev.header.waitDays + 1,
          statusLabel: result === "SUCCESS" ? "진행중" : prev.header.statusLabel,
        },
      }));

      if (result === "SUCCESS") {
        completeSuggestedTodo("CALL");
        setRecontactDueAt(withHoursFromNow(72));
      } else if (result === "NO_ANSWER") {
        setRecontactDueAt(withHoursFromNow(6));
      } else {
        setRecontactDueAt(withHoursFromNow(24));
      }

      setCallMemo("");
      setCallSeconds(0);
      setSavingOutcome(false);
      setOutcomeModal(null);
      toast.success("처리 완료(로그 기록됨)");
      return;
    }

    const smsResult = outcomeModal.result;
    const message = smsPreview;
    const targets: Array<{ key: SmsTarget; label: string; phone?: string }> = [
      { key: "citizen", label: "본인", phone: caseRecord?.profile.phone },
      { key: "guardian", label: "보호자", phone: caseRecord?.profile.guardianPhone },
    ].filter((entry) => smsTargets[entry.key]);

    const timelineAt = outcomeModal.scheduled && smsScheduledAt ? new Date(smsScheduledAt).toISOString() : nowIso();
    let deliveredCount = 0;
    let failedCount = 0;

    for (const target of targets) {
      let finalStatus: SmsDispatchStatus = smsResult;

      if (!outcomeModal.scheduled && target.phone && smsResult !== "FAILED") {
        const result = await sendSmsApiCommon({
          caseId: detail.header.caseId,
          citizenPhone: target.phone,
          templateId: smsTemplateId,
          renderedMessage: message,
          dedupeKey: `${detail.header.caseId}-${smsTemplateId}-${target.label}-${Date.now()}`,
        });
        if (!result.success) {
          finalStatus = "FAILED";
        }
      }

      if (finalStatus === "DELIVERED" || finalStatus === "PENDING") {
        deliveredCount += 1;
      }
      if (finalStatus === "FAILED") {
        failedCount += 1;
      }

      appendTimeline({
        type: "SMS_SENT",
        at: timelineAt,
        templateId: `${smsTemplateId}(${target.label})`,
        status: finalStatus,
        by: detail.header.assigneeName,
      });
    }

    appendAuditLog(
      `문자 ${outcomeModal.scheduled ? "예약" : "발송"}: ${smsTemplate.label} (${targets.length}건, 완료/예약 ${deliveredCount}, 실패 ${failedCount})`
    );

    if (deliveredCount > 0) {
      completeSuggestedTodo("SMS");
      setRecontactDueAt(withHoursFromNow(48));
    }

    setSavingOutcome(false);
    setOutcomeModal(null);
    toast.success("처리 완료(로그 기록됨)");
  };

  const callDurationText = `${String(Math.floor(callSeconds / 60)).padStart(2, "0")}:${String(callSeconds % 60).padStart(2, "0")}`;

  /* ── 접촉 전략 Override 처리 ── */
  const confirmStrategyOverride = () => {
    if (!strategyOverrideReason.trim()) return;
    const prev = detail.header.effectiveStrategy ?? detail.preTriageResult?.strategy ?? "AI_FIRST";
    const next = strategyOverrideTarget;
    const isVulnerableCase = hasVulnerableTrigger(detail.preTriageResult?.triggers ?? []);

    if (next === "AI_FIRST" && isVulnerableCase && strategyOverrideReason.trim().length < 12) {
      toast.error("취약군 케이스의 자동 안내 우선 전환은 상세 사유를 12자 이상 입력해야 합니다.");
      return;
    }

    setDetail((prev_) => {
      const newPreTriage: PreTriageResult = {
        strategy: next,
        triggers: [...(prev_.preTriageResult?.triggers ?? []), `수동 전환: ${strategyOverrideReason}`],
        policyNote: `담당자 수동 전환 적용 (${STRATEGY_LABELS[next]}). 사유: ${strategyOverrideReason}`,
        confidence: "RULE",
      };
      return {
        ...prev_,
        header: {
          ...prev_.header,
          contactStrategy: "MANUAL_OVERRIDE",
          effectiveStrategy: next,
        },
        preTriageResult: newPreTriage,
        contactPlan: buildContactPlan(next, caseRecord),
        contactFlowSteps: buildContactFlowSteps(prev_.contactExecution, newPreTriage, prev_.linkageStatus),
      };
    });

    appendTimeline({
      type: "STRATEGY_CHANGE",
      at: nowIso(),
      from: prev,
      to: next,
      reason: strategyOverrideReason,
      by: detail.header.assigneeName,
    });
    appendAuditLog(`접촉 전략 수동 전환: ${STRATEGY_LABELS[prev]} → ${STRATEGY_LABELS[next]} (${strategyOverrideReason})`);
    toast.success("접촉 전략이 전환되었습니다.");
    setStrategyOverrideOpen(false);
    setStrategyOverrideReason("");
  };

  /* ── Outcome Triage 기록 ── */
  const confirmOutcomeTriage = () => {
    if (!selectedOutcomeCode) return;
    const code = selectedOutcomeCode;
    const now = nowIso();
    let autoMemo: HandoffMemo | null = null;
    let recommendedNextAction = "";
    let switchedToHybrid = false;

    setDetail((prev) => {
      const transition = deriveOutcomeTransition({
        outcomeCode: code,
        execution: prev.contactExecution,
        linkageStatus: prev.linkageStatus,
        contactPlan: prev.contactPlan,
      });

      recommendedNextAction = transition.recommendedNextAction;
      switchedToHybrid = transition.switchedToHybrid;

      let nextPlan = transition.contactPlan;
      if (nextPlan && code === "SCHEDULE_LATER") {
        nextPlan = { ...nextPlan, scheduledAt: withHoursFromNow(transition.recontactAfterHours) };
      }

      if (transition.requiresHandoffMemo) {
        autoMemo = {
          triggers: prev.preTriageResult?.triggers ?? [],
          lastContactSummary: `최근 접촉: ${formatDateTime(prev.contactExecution.lastSentAt ?? now)}`,
          currentOutcome: code,
          recommendedNextAction,
          generatedAt: now,
        };
      }

      const newExec: ContactExecution = {
        ...prev.contactExecution,
        status: transition.executionStatus,
        lastOutcomeCode: code,
        lastResponseAt: now,
        retryCount: transition.retryCount,
        handoffMemo: autoMemo ?? prev.contactExecution.handoffMemo,
      };
      return {
        ...prev,
        linkageStatus: transition.linkageStatus,
        contactPlan: nextPlan,
        contactExecution: newExec,
        contactFlowSteps: buildContactFlowSteps(newExec, prev.preTriageResult, transition.linkageStatus),
      };
    });

    appendTimeline({
      type: "OUTCOME_RECORDED",
      at: now,
      outcomeCode: code,
      note: outcomeNote.trim() || undefined,
      by: detail.header.assigneeName,
    });
    appendAuditLog(`응답 결과 기록: ${OUTCOME_LABELS[code].label}${outcomeNote.trim() ? ` (${outcomeNote.trim().slice(0, 60)})` : ""}`);

    const recontactDelay =
      code === "SCHEDULE_LATER" ? 72 : code === "NO_RESPONSE" ? 24 : code === "REFUSE" ? 168 : 48;
    setRecontactDueAt(withHoursFromNow(recontactDelay));

    if (switchedToHybrid) {
      appendAuditLog("반복 무응답으로 채널 전환 권고 적용: HYBRID");
    }

    if (autoMemo) {
      setHandoffMemoText(
        `[인수인계 메모]\n접촉 전략(룰 기반): ${(detail.header.effectiveStrategy ?? detail.preTriageResult?.strategy ?? "AI_FIRST")}\n트리거: ${autoMemo.triggers.join(", ")}\n${autoMemo.lastContactSummary}\n현재 결과: ${OUTCOME_LABELS[code].label}\n권장 다음 행동: ${autoMemo.recommendedNextAction}`
      );
      setHandoffMemoOpen(true);
    }

    toast.success("응답 결과가 기록되었습니다.");
    setActiveStage1Modal(null);
    setSelectedOutcomeCode(null);
    setOutcomeNote("");
  };

  const modelPriorityValue = useMemo(() => computePriorityValue(caseRecord), [caseRecord]);
  const modelPriorityMeta = useMemo(() => priorityIndicator(modelPriorityValue), [modelPriorityValue]);
  const contactPriority = useMemo(() => getStage1ContactPriority(caseRecord), [caseRecord]);
  const effectiveStrategy = detail.header.effectiveStrategy ?? detail.preTriageResult?.strategy ?? "AI_FIRST";
  const strategyBadge = detail.header.contactStrategy ?? effectiveStrategy;
  const missingCount = detail.contactFlowSteps.filter((step) => step.status === "MISSING").length;
  const warningCount = detail.contactFlowSteps.filter((step) => step.status === "WARNING").length;
  const preTriageReady = Boolean(detail.preTriageInput) && detail.header.dataQuality.level !== "EXCLUDE";

  const closeStage1Modal = useCallback(() => {
    setActiveStage1Modal(null);
  }, []);

  const handleFlowAction = useCallback(
    (action: Stage1FlowAction) => {
      const modal = STAGE1_STEP_MODAL_MAP[action];
      setActiveStage1Modal(modal);
      if (modal === "FOLLOW_UP") {
        setHandoffMemoOpen(true);
      }
    },
    []
  );

  useEffect(() => {
    onHeaderSummaryChange?.({
      contactMode: strategyBadge,
      effectiveMode: effectiveStrategy,
      slaLevel: detail.header.sla.level,
      qualityScore: detail.header.dataQuality.score,
      missingCount,
      warningCount,
      lastUpdatedAt: detail.timeline[0]?.at,
    });
  }, [
    detail.header.sla.level,
    detail.header.dataQuality.score,
    detail.timeline,
    effectiveStrategy,
    missingCount,
    onHeaderSummaryChange,
    strategyBadge,
    warningCount,
  ]);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <section className="space-y-4 xl:col-span-8">
          <Stage1ScorePanel
            scoreSummary={detail.scoreSummary}
            modelPriorityValue={modelPriorityValue}
            modelPriorityMeta={modelPriorityMeta}
            contactPriority={contactPriority}
            interventionLevel={detail.interventionLevel}
          />

          <ContactFlowPanel detail={detail} onAction={handleFlowAction} />

          <ServiceOperationsBoard
            strategy={effectiveStrategy}
            strategyBadge={strategyBadge}
            executionStatus={detail.contactExecution.status}
            lastSentAt={detail.contactExecution.lastSentAt}
            lastOutcome={detail.contactExecution.lastOutcomeCode}
            retryCount={detail.contactExecution.retryCount}
            linkageStatus={detail.linkageStatus}
            memoCount={auditLogs.length}
            lastContactAt={detail.contactExecution.lastResponseAt ?? detail.contactExecution.lastSentAt}
            timelineCount={detail.timeline.length}
            preTriage={detail.preTriageResult}
            riskGuardrails={detail.header.riskGuardrails}
            onOpenStrategyOverride={() => setStrategyOverrideOpen(true)}
          />

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <ContactExecutionLauncherCard
              executionStatus={detail.contactExecution.status}
              strategy={effectiveStrategy}
              lastSentAt={detail.contactExecution.lastSentAt}
              sensitivityFlags={sensitivityFlags}
              onOpen={() => setActiveStage1Modal("CONTACT_EXECUTION")}
            />
            <LinkageActionPanel
              linkageStatus={detail.linkageStatus}
              onAction={handleLinkageAction}
            />
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <ResponseTriagePanel
              expanded={responsePanelExpanded}
              onToggle={() => setResponsePanelExpanded((prev) => !prev)}
              selectedOutcomeCode={selectedOutcomeCode}
              onSelectOutcomeCode={setSelectedOutcomeCode}
              outcomeNote={outcomeNote}
              onOutcomeNoteChange={setOutcomeNote}
              onConfirm={confirmOutcomeTriage}
            />

            <HandoffMemoGeneratorCard
              expanded={handoffMemoOpen || Boolean(detail.contactExecution.handoffMemo)}
              onToggle={() => setHandoffMemoOpen((prev) => !prev)}
              memoText={handoffMemoText}
              onMemoChange={setHandoffMemoText}
              onSave={() => {
                appendAuditLog(`인수인계 메모 저장: ${handoffMemoText.slice(0, 80)}...`);
                toast.success("인수인계 메모가 저장되었습니다.");
                setHandoffMemoOpen(false);
              }}
            />
          </div>

          <InterventionLevelPanel
            level={detail.interventionLevel}
            statusLabel={detail.header.statusLabel}
            guides={interventionGuides}
            onChangeLevel={openLevelChangeModal}
            onHold={() => openStatusReasonModal("보류")}
            onExclude={() => openStatusReasonModal("우선순위 제외")}
          />
        </section>

        <aside className="space-y-4 xl:col-span-4 xl:sticky xl:top-0 self-start">
          <RiskSignalEvidencePanel
            evidence={detail.riskEvidence}
            quality={detail.header.dataQuality}
          />

          <ContactTimeline
            timeline={filteredTimeline}
            filter={timelineFilter}
            onFilterChange={setTimelineFilter}
            listClassName="max-h-[340px] overflow-y-auto pr-1"
          />

          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <h3 className="text-sm font-bold text-slate-900">운영 요약 (읽기 전용)</h3>
            <p className="mt-1 text-[11px] text-gray-500">운영자가 지금 해야 할 행동: Step을 눌러 팝업에서 실행하세요.</p>
            <div className="mt-3 grid grid-cols-1 gap-3 text-xs">
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <p className="text-slate-500">열린 할 일</p>
                <p className="mt-1 text-lg font-bold text-slate-900">
                  {detail.todos.filter((todo) => todo.status === "OPEN").length}건
                </p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <p className="text-slate-500">다음 예정 연락</p>
                <p className="mt-1 text-sm font-semibold text-slate-900">{formatDateTime(recontactDueAt)}</p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <p className="text-slate-500">우선 할 일</p>
                <p className="mt-1 text-sm font-semibold text-slate-900">
                  {nextOpenTodo?.title ?? "모든 주요 작업이 처리되었습니다."}
                </p>
              </div>
            </div>
          </div>
        </aside>
      </div>

      <Dialog
        open={activeStage1Modal === "PRECHECK"}
        onOpenChange={(open) => {
          if (!open) closeStage1Modal();
        }}
      >
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto p-4">
          <h3 className="text-sm font-bold text-slate-900">사전 조건 확인</h3>
          <p className="mt-1 text-[11px] text-gray-500">
            이 단계에서 동의와 연락 가능 여부를 확인하고 실행 가능 상태를 판단합니다.
          </p>
          <div className="mt-3">
            <PolicyGatePanel gates={detail.policyGates} onFix={handleGateFixAction} />
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={activeStage1Modal === "CONTACT_EXECUTION"}
        onOpenChange={(open) => {
          if (!open) closeStage1Modal();
        }}
      >
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-0">
          <SmsPanel
            stageLabel="1차"
            templates={STAGE1_STD_TEMPLATES}
            defaultVars={{
              centerName: DEFAULT_CENTER_NAME,
              centerPhone: DEFAULT_CENTER_PHONE,
            }}
            caseId={detail.header.caseId}
            citizenPhone={caseRecord?.profile.phone ? maskPhone(caseRecord.profile.phone) : "010-****-1234"}
            guardianPhone={caseRecord?.profile.guardianPhone ? maskPhone(caseRecord.profile.guardianPhone) : undefined}
            callScripts={CALL_SCRIPT_STEPS as StdCallScriptStep[]}
            onSmsSent={(item) => {
              appendTimeline({
                type: "SMS_SENT",
                at: nowIso(),
                templateId: item.templateLabel,
                status: item.status === "SENT" ? "DELIVERED" : item.status === "SCHEDULED" ? "PENDING" : "FAILED",
                by: detail.header.assigneeName,
              });
              appendAuditLog(`1차 문자 ${item.mode === "NOW" ? "발송" : "예약"}: ${item.templateLabel} (${item.status})`);
              if (item.status === "SENT") {
                completeSuggestedTodo("SMS");
                setRecontactDueAt(withHoursFromNow(48));
                setDetail((prev) => {
                  const newExec: ContactExecution = {
                    ...prev.contactExecution,
                    status: "SENT",
                    lastSentAt: nowIso(),
                    retryCount: prev.contactExecution.retryCount + 1,
                  };
                  return {
                    ...prev,
                    contactExecution: newExec,
                    contactFlowSteps: buildContactFlowSteps(newExec, prev.preTriageResult, prev.linkageStatus),
                  };
                });
              }
            }}
            onConsultation={(note, type, templateLabel) => {
              appendTimeline({
                type: "CALL_ATTEMPT",
                at: nowIso(),
                result: "SUCCESS",
                note: note || undefined,
                by: detail.header.assigneeName,
              });
              appendAuditLog(`1차 상담 기록: ${templateLabel}${note ? ` (${note.slice(0, 60)})` : ""}`);
              if (type === "CONTACT") {
                completeSuggestedTodo("CALL");
              }
              setDetail((prev) => {
                const newExec: ContactExecution = {
                  ...prev.contactExecution,
                  status: "WAITING_RESPONSE",
                  lastSentAt: nowIso(),
                  retryCount: prev.contactExecution.retryCount + 1,
                };
                return {
                  ...prev,
                  contactExecution: newExec,
                  contactFlowSteps: buildContactFlowSteps(newExec, prev.preTriageResult, prev.linkageStatus),
                };
              });
              toast.success("상담 기록이 저장되었습니다.");
            }}
          />
        </DialogContent>
      </Dialog>

      <Dialog
        open={activeStage1Modal === "RESPONSE_HANDLING"}
        onOpenChange={(open) => {
          if (!open) closeStage1Modal();
        }}
      >
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto p-4">
          <h3 className="text-sm font-bold text-slate-900">반응 처리</h3>
          <p className="mt-1 text-[11px] text-gray-500">
            이 단계에서 응답 결과를 확정하고 무응답/거부/상담 전환 여부를 기록합니다.
          </p>
          <div className="mt-3">
            <ResponseTriagePanel
              expanded
              onToggle={closeStage1Modal}
              selectedOutcomeCode={selectedOutcomeCode}
              onSelectOutcomeCode={setSelectedOutcomeCode}
              outcomeNote={outcomeNote}
              onOutcomeNoteChange={setOutcomeNote}
              onConfirm={confirmOutcomeTriage}
            />
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={activeStage1Modal === "FOLLOW_UP"}
        onOpenChange={(open) => {
          if (!open) closeStage1Modal();
        }}
      >
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto p-4">
          <h3 className="text-sm font-bold text-slate-900">후속 결정</h3>
          <p className="mt-1 text-[11px] text-gray-500">
            이 단계에서 유지/보류/전환/연계를 확정하고 후속 조치와 인수인계를 완료합니다.
          </p>

          <div className="mt-3 space-y-3">
            <NextActionPanel
              execution={detail.contactExecution}
              strategy={effectiveStrategy}
              preTriageReady={preTriageReady}
              strategyDecided={Boolean(detail.preTriageResult?.strategy)}
              hasVulnerableGuardrail={Boolean(detail.header.riskGuardrails?.length)}
              linkageStatus={detail.linkageStatus}
              onOpenSmsModal={() => setActiveStage1Modal("CONTACT_EXECUTION")}
              onOpenOutcomeTriage={() => setActiveStage1Modal("RESPONSE_HANDLING")}
              onOpenHandoffMemo={() => setHandoffMemoOpen(true)}
              onOpenStrategyOverride={() => setStrategyOverrideOpen(true)}
            />

            <HandoffMemoGeneratorCard
              expanded={handoffMemoOpen || Boolean(detail.contactExecution.handoffMemo)}
              onToggle={() => setHandoffMemoOpen((prev) => !prev)}
              memoText={handoffMemoText}
              onMemoChange={setHandoffMemoText}
              onSave={() => {
                appendAuditLog(`인수인계 메모 저장: ${handoffMemoText.slice(0, 80)}...`);
                toast.success("인수인계 메모가 저장되었습니다.");
                setHandoffMemoOpen(false);
              }}
            />

            <InterventionLevelPanel
              level={detail.interventionLevel}
              statusLabel={detail.header.statusLabel}
              guides={interventionGuides}
              onChangeLevel={openLevelChangeModal}
              onHold={() => openStatusReasonModal("보류")}
              onExclude={() => openStatusReasonModal("우선순위 제외")}
            />
          </div>
        </DialogContent>
      </Dialog>

      <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between border-b border-gray-100 pb-2">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <History size={15} className="text-slate-500" />
            변경 사유 및 감사 로그
          </h3>
          <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
            로그 무결성 확인
          </span>
        </div>

        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full border-collapse text-xs">
            <thead>
              <tr className="bg-gray-50 text-gray-600">
                <th className="border border-gray-200 px-3 py-2 text-left font-semibold">시각</th>
                <th className="border border-gray-200 px-3 py-2 text-left font-semibold">행위자</th>
                <th className="border border-gray-200 px-3 py-2 text-left font-semibold">행위</th>
                <th className="border border-gray-200 px-3 py-2 text-left font-semibold">요약</th>
              </tr>
            </thead>
            <tbody>
              {auditLogs.map((log) => {
                const [action, ...summaryParts] = log.message.split(":");
                const summary = summaryParts.join(":").trim();
                return (
                  <tr key={log.id} className="odd:bg-white even:bg-gray-50/60">
                    <td className="border border-gray-200 px-3 py-2 text-gray-600">{log.at}</td>
                    <td className="border border-gray-200 px-3 py-2 text-gray-700">{log.actor}</td>
                    <td className="border border-gray-200 px-3 py-2 font-semibold text-slate-800">{action.trim()}</td>
                    <td className="border border-gray-200 px-3 py-2 text-gray-600">{summary || "-"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <ActionReasonModal
        draft={reasonModal}
        onClose={() => setReasonModal(null)}
        onChangeReason={(reason) =>
          setReasonModal((prev) => {
            if (!prev) return prev;
            return { ...prev, reason };
          })
        }
        onConfirm={confirmReasonAction}
      />

      <OutcomeModal
        draft={outcomeModal}
        loading={savingOutcome}
        onClose={() => {
          if (!savingOutcome) setOutcomeModal(null);
        }}
        onChangeResult={(value) =>
          setOutcomeModal((prev) => {
            if (!prev) return prev;
            if (prev.mode === "CALL") {
              return { ...prev, result: value as OutcomeDraft extends { mode: "CALL"; result: infer R } ? R : never };
            }
            return { ...prev, result: value as SmsDispatchStatus };
          })
        }
        onChangeNote={(note) =>
          setOutcomeModal((prev) => {
            if (!prev) return prev;
            return { ...prev, note };
          })
        }
        onConfirm={confirmOutcome}
      />

      {/* ═══ 접촉 전략 Override 모달 ═══ */}
      {strategyOverrideOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4">
          <div className="w-full max-w-md rounded-xl border border-gray-200 bg-white p-5 shadow-2xl">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Shield size={15} className="text-amber-600" />
              접촉 전략 수동 전환
            </h3>
            <p className="mt-1 text-[11px] text-gray-500">{STRATEGY_HELPER_TEXT}</p>

            {detail.header.riskGuardrails && detail.header.riskGuardrails.length > 0 && (
              <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
                <p className="text-[11px] font-semibold text-amber-800 flex items-center gap-1">
                  <AlertTriangle size={12} /> 취약 대상 경고
                </p>
                <ul className="mt-1 space-y-0.5">
                  {detail.header.riskGuardrails.map((g) => (
                    <li key={g} className="text-[11px] text-amber-700">• {g}</li>
                  ))}
                </ul>
                {strategyOverrideTarget === "AI_FIRST" ? (
                  <p className="mt-2 text-[10px] font-semibold text-amber-900">
                    취약군 케이스에서 자동 안내 우선 전환 시 상세 사유 기록이 필요합니다.
                  </p>
                ) : null}
              </div>
            )}

            <div className="mt-3">
              <label className="text-[11px] font-semibold text-gray-600">전환 대상 전략</label>
              <div className="mt-1 grid grid-cols-2 gap-2">
                {(["HUMAN_FIRST", "AI_FIRST"] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => setStrategyOverrideTarget(s)}
                    className={cn(
                      "rounded-lg border-2 px-3 py-2 text-xs font-semibold transition-colors",
                      strategyOverrideTarget === s ? STRATEGY_TONES[s].replace("bg-", "border-").split(" ")[0] + " " + STRATEGY_TONES[s] : "border-gray-200 bg-gray-50 text-gray-500"
                    )}
                  >
                    {STRATEGY_LABELS[s]}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-3">
              <label className="text-[11px] font-semibold text-gray-600">전환 사유 (필수)</label>
              <textarea
                value={strategyOverrideReason}
                onChange={(e) => setStrategyOverrideReason(e.target.value)}
                className="mt-1 h-20 w-full rounded-lg border border-gray-200 px-2 py-1.5 text-xs outline-none focus:border-blue-400"
                placeholder="전략 전환 사유를 입력하세요 (감사 로그에 기록됩니다)"
              />
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setStrategyOverrideOpen(false)} className="rounded-md border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-700">취소</button>
              <button
                onClick={confirmStrategyOverride}
                disabled={!strategyOverrideReason.trim()}
                className="rounded-md bg-[#163b6f] px-3 py-1.5 text-xs font-semibold text-white disabled:bg-gray-300"
              >
                전략 전환 적용
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

export function DataQualityBadge({ dataQuality }: { dataQuality: CaseHeader["dataQuality"] }) {
  const tone =
    dataQuality.level === "GOOD"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : dataQuality.level === "WARN"
        ? "border-orange-200 bg-orange-50 text-orange-700"
        : "border-red-200 bg-red-50 text-red-700";

  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold", tone)}>
      <ShieldCheck size={12} /> 데이터 품질 {dataQualityText(dataQuality.level)} ({dataQuality.score}%)
    </span>
  );
}

export function SlaStatusBadge({ sla }: { sla: CaseHeader["sla"] }) {
  const tone =
    sla.level === "OK"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : sla.level === "DUE_SOON"
        ? "border-orange-200 bg-orange-50 text-orange-700"
        : "border-red-200 bg-red-50 text-red-700";

  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold", tone)}>
      <Clock3 size={12} /> SLA {slaText(sla.level)}
    </span>
  );
}

export function OpsSummaryStrip({
  header,
  strategyBadge,
  effectiveStrategy,
  nextAction,
  missingCount,
  warningCount,
  lastUpdatedAt,
  slaCountdown,
  recontactCountdown,
}: {
  header: CaseHeader;
  strategyBadge: ContactStrategy;
  effectiveStrategy: RecommendedContactStrategy;
  nextAction: string;
  missingCount: number;
  warningCount: number;
  lastUpdatedAt?: string;
  slaCountdown: string;
  recontactCountdown: string;
}) {
  const statusTone =
    header.statusLabel === "완료"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : header.statusLabel === "보류"
        ? "border-orange-200 bg-orange-50 text-orange-700"
        : header.statusLabel === "우선순위 제외"
          ? "border-gray-200 bg-gray-100 text-gray-700"
          : "border-blue-200 bg-blue-50 text-blue-700";

  return (
    <section className="rounded-xl border border-slate-200 bg-gradient-to-r from-slate-900 to-slate-800 px-4 py-3 text-white shadow-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-md bg-white/15 px-2.5 py-1 text-xs font-semibold">Case {header.caseId}</span>
        <span className="rounded-md bg-white/15 px-2.5 py-1 text-xs font-semibold">Stage1</span>
        <span className={cn("rounded-md border px-2.5 py-1 text-xs font-semibold", statusTone)}>현재 상태 {header.statusLabel}</span>
        <span className="rounded-md bg-white/15 px-2.5 py-1 text-xs font-semibold">대기 {header.waitDays}일</span>
        <span className="rounded-md bg-white/15 px-2.5 py-1 text-xs font-semibold">SLA {slaCountdown}</span>
        <span className="rounded-md bg-white/15 px-2.5 py-1 text-xs font-semibold">재접촉 {recontactCountdown}</span>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
        <span className={cn("inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold", STRATEGY_TONES[strategyBadge])}>
          <Shield size={12} /> 접촉 전략 {strategyBadge}
          {strategyBadge === "MANUAL_OVERRIDE" ? ` (${effectiveStrategy})` : ""}
        </span>
        <SlaStatusBadge sla={header.sla} />
        <DataQualityBadge dataQuality={header.dataQuality} />
        {header.riskGuardrails && header.riskGuardrails.length > 0 ? (
          <span className="inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-800">
            <AlertTriangle size={12} /> 리스크 가드레일 {header.riskGuardrails.length}건
          </span>
        ) : null}
      </div>

      {header.riskGuardrails && header.riskGuardrails.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-1">
          {header.riskGuardrails.map((guardrail) => (
            <span key={guardrail} className="rounded border border-amber-200 bg-white/95 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
              {guardrail}
            </span>
          ))}
        </div>
      ) : null}

      <div className="mt-2 rounded-md border border-white/20 bg-white/10 px-3 py-2 text-[11px] text-slate-100">
        <p>최근 업데이트 {formatDateTime(lastUpdatedAt)} / 누락 {missingCount}건 / 경고 {warningCount}건</p>
        <p className="mt-1">
          현재 우선 액션: <strong>{nextAction}</strong>
        </p>
        <p className="mt-1 text-[10px] text-slate-300">운영 참고: {STRATEGY_HELPER_TEXT}</p>
      </div>
    </section>
  );
}

/* ═══ 서비스 운영 보드 (4카드) ═══ */
function ServiceOperationsBoard({
  strategy,
  strategyBadge,
  executionStatus,
  lastSentAt,
  lastOutcome,
  retryCount,
  linkageStatus,
  memoCount,
  lastContactAt,
  timelineCount,
  preTriage,
  riskGuardrails,
  onOpenStrategyOverride,
}: {
  strategy: RecommendedContactStrategy;
  strategyBadge: ContactStrategy;
  executionStatus: ContactExecutionStatus;
  lastSentAt?: string;
  lastOutcome?: OutcomeCode;
  retryCount: number;
  linkageStatus: LinkageStatus;
  memoCount: number;
  lastContactAt?: string;
  timelineCount: number;
  preTriage?: PreTriageResult;
  riskGuardrails?: string[];
  onOpenStrategyOverride: () => void;
}) {
  const [hovered, setHovered] = useState<number | null>(null);

  const execLabels: Record<ContactExecutionStatus, { label: string; tone: string }> = {
    NOT_STARTED: { label: "미접촉", tone: "text-gray-600" },
    SENT: { label: "발송완료", tone: "text-blue-700" },
    WAITING_RESPONSE: { label: "응답대기", tone: "text-amber-700" },
    RETRY_NEEDED: { label: "재시도필요", tone: "text-orange-700" },
    HANDOFF_TO_HUMAN: { label: "상담전환", tone: "text-red-700" },
    PAUSED: { label: "보류", tone: "text-gray-600" },
    STOPPED: { label: "중단", tone: "text-red-700" },
    DONE: { label: "완료", tone: "text-emerald-700" },
  };

  const linkageLabelMap: Record<LinkageStatus, string> = {
    NOT_CREATED: "미생성",
    BOOKING_IN_PROGRESS: "예약중",
    BOOKING_DONE: "예약완료",
    REFERRAL_CREATED: "의뢰생성",
  };

  const strategyValue = strategy === "HUMAN_FIRST" ? "상담사 우선" : "자동안내 우선";
  const strategySub = strategyBadge === "MANUAL_OVERRIDE" ? "담당자 수동 변경 적용" : "사전 기준 자동 추천";
  const strategyReasons = [
    ...(preTriage?.triggers ?? []).slice(0, 4).map(explainStrategyTrigger),
    ...(riskGuardrails ?? []).slice(0, 2),
  ];
  if (strategy === "HUMAN_FIRST" && strategyReasons.length === 0) {
    strategyReasons.push("취약군 보호 정책에 따라 상담사 우선으로 진행합니다.");
  }

  const cards = [
    {
      title: "접촉 방식",
      value: strategyValue,
      sub: strategySub,
      helperTitle: "판정 근거",
      helper:
        strategyReasons.length > 0
          ? strategyReasons.slice(0, 3)
          : ["사전 기준 항목 충족으로 자동 안내 우선이 제안되었습니다.", "추가 위험 신호가 없어 확실하지 않음 항목은 없습니다."],
      tone:
        strategy === "HUMAN_FIRST"
          ? "border-red-200 bg-red-50 text-red-700"
          : "border-blue-200 bg-blue-50 text-blue-700",
      icon: Shield,
    },
    {
      title: "진행 상태",
      value: execLabels[executionStatus].label,
      sub: lastOutcome ? `최근 결과: ${OUTCOME_LABELS[lastOutcome].label}` : `재시도 ${retryCount}회`,
      helperTitle: "판정 근거",
      helper: [
        `마지막 안내/발송: ${formatDateTime(lastSentAt)}`,
        `누적 재시도 횟수: ${retryCount}회`,
        !lastSentAt ? "최근 접촉 시각이 없어 확실하지 않음" : "최근 접촉 시각이 기록되어 있음",
      ],
      tone: `border-slate-200 bg-slate-50 ${execLabels[executionStatus].tone}`,
      icon: Zap,
    },
    {
      title: "예약/연계",
      value: linkageLabelMap[linkageStatus],
      sub: lastSentAt ? `최근 발송: ${formatDateTime(lastSentAt)}` : "운영 참고",
      helperTitle: "판정 근거",
      helper: [
        linkageStatus === "NOT_CREATED" ? "아직 생성 전입니다." : `현재 단계: ${linkageLabelMap[linkageStatus]}`,
        "필요 시 담당자가 즉시 수동 변경할 수 있습니다.",
        linkageStatus === "NOT_CREATED" ? "연계 결과 데이터가 없어 확실하지 않음" : "연계 상태 데이터가 기록되어 있음",
      ],
      tone: "border-emerald-200 bg-emerald-50 text-emerald-700",
      icon: CheckCircle2,
    },
    {
      title: "최근 기록",
      value: `메모 ${memoCount}건`,
      sub: `${formatDateTime(lastContactAt)} · 로그 ${timelineCount}건`,
      helperTitle: "판정 근거",
      helper: [
        `마지막 접촉: ${formatDateTime(lastContactAt)}`,
        `누적 로그: ${timelineCount}건`,
        timelineCount === 0 ? "기록 데이터가 없어 확실하지 않음" : "최근 기록 데이터가 누적되어 있음",
      ],
      tone: "border-gray-200 bg-gray-50 text-gray-700",
      icon: History,
    },
  ];

  return (
    <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
      {cards.map((card, idx) => (
        <article
          key={card.title}
          onMouseEnter={() => setHovered(idx)}
          onMouseLeave={() => setHovered((prev) => (prev === idx ? null : prev))}
          onFocus={() => setHovered(idx)}
          onBlur={() => setHovered((prev) => (prev === idx ? null : prev))}
          className={cn(
            "relative rounded-xl border p-3 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md",
            card.tone
          )}
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <card.icon size={14} />
              <p className="text-[11px] font-semibold opacity-80">{card.title}</p>
            </div>
            {idx === 0 ? (
              <button
                type="button"
                onClick={onOpenStrategyOverride}
                className="rounded-md border border-current/40 bg-white/70 px-2 py-0.5 text-[10px] font-semibold"
              >
                수동 변경
              </button>
            ) : null}
          </div>
          <p className="mt-1 text-lg font-bold">{card.value}</p>
          <p className="mt-0.5 text-[10px] opacity-70">{card.sub}</p>

          <div
            className={cn(
              "pointer-events-none absolute inset-x-2 top-[calc(100%+8px)] z-20 rounded-lg border border-slate-200 bg-white p-3 text-slate-700 shadow-lg transition-all duration-150",
              hovered === idx ? "translate-y-0 opacity-100" : "-translate-y-1 opacity-0"
            )}
          >
            <p className="text-[11px] font-semibold text-slate-900">{card.helperTitle}</p>
            <div className="mt-1 space-y-0.5 text-[11px] text-slate-600">
              {card.helper.map((line) => (
                <p key={`${card.title}-${line}`}>- {line}</p>
              ))}
            </div>
          </div>
        </article>
      ))}
    </section>
  );
}

function ContactExecutionLauncherCard({
  executionStatus,
  strategy,
  lastSentAt,
  sensitivityFlags,
  onOpen,
}: {
  executionStatus: ContactExecutionStatus;
  strategy: RecommendedContactStrategy;
  lastSentAt?: string;
  sensitivityFlags: string[];
  onOpen: () => void;
}) {
  const statusLabelMap: Record<ContactExecutionStatus, string> = {
    NOT_STARTED: "미접촉",
    SENT: "발송완료",
    WAITING_RESPONSE: "응답대기",
    RETRY_NEEDED: "재시도필요",
    HANDOFF_TO_HUMAN: "상담전환",
    PAUSED: "보류",
    STOPPED: "중단",
    DONE: "완료",
  };

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
        <MessageSquare size={15} className="text-[#15386a]" />
        상담/문자 실행 (1차)
      </h3>
      <p className="mt-1 text-[11px] text-gray-500">전화/문자 실행과 기록은 전용 팝업에서 처리합니다.</p>

      <button
        type="button"
        onClick={onOpen}
        className="mt-3 h-11 w-full rounded-lg bg-[#15386a] text-sm font-semibold text-white transition-all duration-200 hover:-translate-y-0.5 hover:bg-[#102b4e] hover:shadow-md"
      >
        상담/문자 실행 열기
      </button>

      <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-[11px] text-slate-700">
        <p>
          현재 상태: <strong>{statusLabelMap[executionStatus]}</strong>
        </p>
        <p className="mt-0.5">
          접촉 기준: <strong>{strategy === "HUMAN_FIRST" ? "상담사 우선" : "자동안내 우선"}</strong>
        </p>
        <p className="mt-0.5">
          최근 발송: <strong>{formatDateTime(lastSentAt)}</strong>
        </p>
        <p className="mt-0.5">
          민감 이력: <strong>{sensitivityFlags.length > 0 ? sensitivityFlags.join(", ") : "확인 항목 없음"}</strong>
        </p>
      </div>
    </section>
  );
}

function LinkageActionPanel({
  linkageStatus,
  onAction,
}: {
  linkageStatus: LinkageStatus;
  onAction: (action: Stage1LinkageAction) => void;
}) {
  return (
    <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
        <ExternalLink size={15} className="text-[#15386a]" />
        연계 작업
      </h3>
      <p className="mt-1 text-[11px] text-gray-500">프로그램 제공/외부 연계는 이 패널에서만 실행합니다.</p>

      <div className="mt-3 space-y-2">
        {(Object.keys(STAGE1_LINKAGE_ACTION_META) as Stage1LinkageAction[]).map((actionKey) => {
          const action = STAGE1_LINKAGE_ACTION_META[actionKey];
          return (
            <button
              key={actionKey}
              type="button"
              onClick={() => onAction(actionKey)}
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-left transition-colors hover:bg-slate-100"
            >
              <p className="text-xs font-semibold text-slate-900">{action.title}</p>
              <p className="mt-0.5 text-[11px] text-slate-600">{action.description}</p>
            </button>
          );
        })}
      </div>

      <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-[11px] text-emerald-800">
        <p>
          현재 예약/연계 상태: <strong>{LINKAGE_STATUS_HINT[linkageStatus]}</strong>
        </p>
        <p className="mt-0.5">연계 실행 시 감사 로그와 타임라인에 즉시 기록됩니다.</p>
      </div>
    </section>
  );
}

/* ═══ Contact Flow 패널 (행정 실행 4단계) ═══ */
function ContactFlowPanel({
  detail,
  onAction,
}: {
  detail: Stage1Detail;
  onAction: (action: Stage1FlowAction) => void;
}) {
  const flowCards = useStage1Flow(detail);
  const doneCount = flowCards.filter((card) => card.status === "COMPLETED").length;

  return (
    <section className="relative z-10 rounded-2xl border border-gray-200 bg-gradient-to-b from-white to-slate-50 p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
          <Zap size={15} className="text-blue-600" />
          Stage1 진행 흐름
        </h3>
        <span className="text-[11px] text-gray-500">
          {doneCount}/{flowCards.length} 단계 완료
        </span>
      </div>

      <div className="mt-4 overflow-x-auto overflow-y-visible pt-1 pb-3">
        <ol className="relative z-10 mx-auto flex w-max items-stretch justify-center gap-3 px-2">
          {flowCards.map((card, idx) => {
            const tone = FLOW_STATUS_META[card.status];
            const Icon = tone.icon;

            return (
              <React.Fragment key={card.id}>
                <li className="shrink-0 py-1">
                  <button
                    type="button"
                    onClick={() => onAction(card.action)}
                    className={cn(
                      "group relative z-0 w-[230px] transform-gpu rounded-2xl border p-4 text-left transition-all duration-200 ease-out hover:z-20 hover:-translate-y-0.5 hover:scale-[1.02] focus-visible:z-20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300",
                      tone.cardTone,
                      card.isCurrent && "ring-2 ring-offset-1 ring-blue-300 motion-safe:animate-pulse"
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-semibold tracking-wide text-slate-500">STEP {idx + 1}</span>
                      <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", tone.chipTone)}>
                        {tone.label}
                      </span>
                    </div>

                    <div className="mt-2 flex items-center gap-2">
                      <Icon size={14} className="shrink-0" />
                      <p className="text-sm font-bold tracking-tight">{card.title}</p>
                    </div>

                    <p className="mt-1 text-[11px] text-slate-600">{card.description}</p>
                    <p className="mt-2 text-xs font-semibold text-slate-800">{card.metricLabel}</p>

                    <div className={cn("mt-2 rounded-lg border px-2.5 py-2 text-[11px] leading-relaxed", tone.reasonTone)}>
                      <p className="font-semibold">상태 사유</p>
                      <p className="mt-0.5">{card.reason}</p>
                    </div>

                    <div className="mt-2 max-h-0 overflow-hidden rounded-lg border border-dashed border-slate-300 bg-white/70 px-2.5 py-0 text-[11px] text-slate-700 opacity-0 transition-all duration-200 group-hover:max-h-24 group-hover:py-2 group-hover:opacity-100 group-focus-visible:max-h-24 group-focus-visible:py-2 group-focus-visible:opacity-100">
                      <p className="font-semibold text-slate-800">다음 작업</p>
                      <p className="mt-0.5">{card.nextActionHint}</p>
                    </div>

                    <span className="mt-2 inline-flex rounded-md border border-current/40 px-2.5 py-1 text-[11px] font-semibold">
                      작업 열기
                    </span>
                  </button>
                </li>
                {idx < flowCards.length - 1 ? (
                  <li className="flex shrink-0 items-center text-slate-300" aria-hidden="true">
                    <ChevronRight size={18} />
                  </li>
                ) : null}
              </React.Fragment>
            );
          })}
        </ol>
      </div>

      <p className="mt-3 text-[11px] text-gray-500">
        단계 카드를 누르면 관련 작업 화면으로 바로 이동합니다. 현재 단계에는 강조 윤곽이 표시됩니다.
      </p>
    </section>
  );
}

/* ═══ 접촉 전략 카드 ═══ */
function ContactStrategyCard({
  preTriageInput,
  preTriage,
  strategyBadge,
  effectiveStrategy,
  contactPlan,
  riskGuardrails,
  onOverride,
}: {
  preTriageInput?: PreTriageInput;
  preTriage?: PreTriageResult;
  strategyBadge: ContactStrategy;
  effectiveStrategy: RecommendedContactStrategy;
  contactPlan?: ContactPlan;
  riskGuardrails?: string[];
  onOverride: () => void;
}) {
  const channelLabel =
    contactPlan?.channel === "CALL"
      ? "전화 우선"
      : contactPlan?.channel === "SMS"
        ? "문자 우선"
        : "하이브리드";

  const isVulnerable = Boolean(riskGuardrails?.length);

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
          <Shield size={15} className="text-blue-600" />
          접촉 전략 (사전 기준/룰 기반)
        </h3>
        <button
          onClick={onOverride}
          className="inline-flex items-center gap-1 rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] font-semibold text-amber-700 hover:bg-amber-100"
        >
          <RefreshCw size={11} /> 전략 전환
        </button>
      </div>

      <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className={cn("rounded-lg border p-3", STRATEGY_TONES[strategyBadge])}>
          <p className="text-[11px] font-semibold opacity-70">현재 전략 배지</p>
          <p className="mt-1 text-base font-bold">
            {strategyBadge}
            {strategyBadge === "MANUAL_OVERRIDE" ? ` (${effectiveStrategy})` : ""}
          </p>
          <p className="mt-1 text-[11px] opacity-80">
            {channelLabel} · 재시도 {contactPlan?.maxRetryPolicy.maxRetries ?? 2}회 / {contactPlan?.maxRetryPolicy.intervalHours ?? 24}시간 간격
          </p>
          <p className="mt-1 text-[10px] opacity-80">운영 참고</p>
        </div>

        <div className="rounded-lg border border-gray-100 bg-gray-50 p-3">
          <p className="text-[11px] font-semibold text-gray-700">정책 사유 (트리거)</p>
          {(preTriage?.triggers ?? []).map((trigger) => (
            <p key={trigger} className="mt-0.5 text-[11px] text-gray-600">• {trigger}</p>
          ))}
          <p className="mt-2 text-[10px] text-gray-500">{preTriage?.policyNote}</p>
          <p className="mt-1 text-[10px] text-gray-500">
            confidence: {preTriage?.confidence ?? "RULE"} / 담당자 확인 필요
          </p>
        </div>
      </div>

      {riskGuardrails && riskGuardrails.length > 0 && (
        <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-2.5">
          <p className="text-[11px] font-semibold text-amber-800 flex items-center gap-1">
            <AlertTriangle size={12} /> 취약군(상담사 우선) 정책 안내
          </p>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {riskGuardrails.map((g) => (
              <span key={g} className="rounded border border-amber-300 bg-white px-2 py-0.5 text-[10px] font-semibold text-amber-700">{g}</span>
            ))}
          </div>
          <p className="mt-2 text-[10px] text-amber-800">
            왜 상담사 우선인지: 취약군 보호와 민원 위험 완화를 위한 운영 정책입니다.
          </p>
        </div>
      )}

      {preTriageInput ? (
        <div className="mt-3 rounded-lg border border-gray-100 bg-gray-50 p-3 text-[11px] text-gray-600">
          <p>
            입력 요약: 연령 {preTriageInput.age}세 / 보호자 {preTriageInput.guardian.exists ? "있음" : "없음"} /
            민원 이력 {preTriageInput.contactHistory.hasComplaint ? "있음" : "없음"} /
            거부 이력 {preTriageInput.contactHistory.hasRefusal ? "있음" : "없음"}
          </p>
        </div>
      ) : null}

      <p className="mt-3 text-[10px] text-gray-500">
        {STRATEGY_HELPER_TEXT}
        {isVulnerable ? " (취약군 정책 적용 케이스)" : ""}
      </p>
    </section>
  );
}

/* ═══ Next Action 패널 ═══ */
function NextActionPanel({
  execution,
  strategy,
  preTriageReady,
  strategyDecided,
  hasVulnerableGuardrail,
  linkageStatus,
  onOpenSmsModal,
  onOpenOutcomeTriage,
  onOpenHandoffMemo,
  onOpenStrategyOverride,
}: {
  execution: ContactExecution;
  strategy: RecommendedContactStrategy;
  preTriageReady: boolean;
  strategyDecided: boolean;
  hasVulnerableGuardrail: boolean;
  linkageStatus: LinkageStatus;
  onOpenSmsModal: () => void;
  onOpenOutcomeTriage: () => void;
  onOpenHandoffMemo: () => void;
  onOpenStrategyOverride: () => void;
}) {
  const p1Actions: Array<{ label: string; action: () => void; tone: string }> = [];
  const p2Actions: Array<{ label: string; action: () => void; tone: string }> = [];

  if (!preTriageReady) {
    p1Actions.push({
      label: "사전 확인 누락 항목 보완",
      action: onOpenStrategyOverride,
      tone: "bg-red-600 text-white hover:bg-red-700",
    });
  }

  if (!strategyDecided || hasVulnerableGuardrail) {
    p1Actions.push({
      label: "접촉 방식 확정/수동 변경",
      action: onOpenStrategyOverride,
      tone: "bg-amber-600 text-white hover:bg-amber-700",
    });
  }

  if (execution.status === "NOT_STARTED" || execution.status === "RETRY_NEEDED") {
    p1Actions.push({
      label: `1차 접촉 실행 (${strategy === "HUMAN_FIRST" ? "상담사 우선" : "자동안내 우선"})`,
      action: onOpenSmsModal,
      tone: "bg-[#15386a] text-white hover:bg-[#102b4e]",
    });
  }

  if (execution.status === "SENT" || execution.status === "WAITING_RESPONSE") {
    p1Actions.push({
      label: "응답 결과 처리",
      action: onOpenOutcomeTriage,
      tone: "bg-blue-600 text-white hover:bg-blue-700",
    });
  }

  if (execution.status === "HANDOFF_TO_HUMAN" || execution.status === "PAUSED") {
    p1Actions.push({
      label: "상담 인계 메모 작성/확인",
      action: onOpenHandoffMemo,
      tone: "bg-red-600 text-white hover:bg-red-700",
    });
  }

  if (execution.status === "STOPPED") {
    p2Actions.push({
      label: "재접촉 제한 안내 확인",
      action: onOpenHandoffMemo,
      tone: "border-red-200 bg-red-50 text-red-700 hover:bg-red-100",
    });
  }

  if (execution.status === "RETRY_NEEDED") {
    p2Actions.push({
      label: "반복 무응답 재시도 규칙 적용",
      action: onOpenSmsModal,
      tone: "border-orange-200 bg-orange-50 text-orange-700 hover:bg-orange-100",
    });
  }

  if (linkageStatus === "BOOKING_IN_PROGRESS" || linkageStatus === "REFERRAL_CREATED") {
    p2Actions.push({
      label: "예약/의뢰 후속 상태 확인",
      action: onOpenHandoffMemo,
      tone: "border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
    });
  }

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
        <Zap size={15} className="text-orange-600" />
        지금 할 일
      </h3>
      <p className="mt-1 text-[11px] text-gray-500">운영 참고 · 담당자 확인 필요</p>

      {p1Actions.length > 0 && (
        <div className="mt-3 space-y-2">
          <p className="text-[11px] font-semibold text-red-700">P1 · 즉시 실행</p>
          {p1Actions.map((a) => (
            <button
              key={a.label}
              onClick={a.action}
              className={cn("w-full rounded-lg border px-3 py-2.5 text-xs font-semibold transition-colors", a.tone)}
            >
              {a.label}
            </button>
          ))}
        </div>
      )}

      {p2Actions.length > 0 && (
        <div className="mt-3 space-y-2">
          <p className="text-[11px] font-semibold text-blue-700">P2 · 보조 실행</p>
          {p2Actions.map((a) => (
            <button
              key={a.label}
              onClick={a.action}
              className={cn("w-full rounded-lg border px-3 py-2 text-xs font-semibold transition-colors", a.tone)}
            >
              {a.label}
            </button>
          ))}
        </div>
      )}

      {execution.lastOutcomeCode && (
        <div className="mt-3 rounded-md border border-gray-100 bg-gray-50 px-3 py-2">
          <p className="text-[11px] text-gray-600">
            최근 결과: <strong>{OUTCOME_LABELS[execution.lastOutcomeCode].icon} {OUTCOME_LABELS[execution.lastOutcomeCode].label}</strong>
          </p>
        </div>
      )}
    </section>
  );
}

function ResponseTriagePanel({
  expanded,
  onToggle,
  selectedOutcomeCode,
  onSelectOutcomeCode,
  outcomeNote,
  onOutcomeNoteChange,
  onConfirm,
}: {
  expanded: boolean;
  onToggle: () => void;
  selectedOutcomeCode: OutcomeCode | null;
  onSelectOutcomeCode: (code: OutcomeCode | null) => void;
  outcomeNote: string;
  onOutcomeNoteChange: (note: string) => void;
  onConfirm: () => void;
}) {
  return (
    <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
          <ArrowRightCircle size={15} className="text-blue-600" />
          응답 결과 처리
        </h3>
        <button
          onClick={onToggle}
          className="rounded-md border border-gray-200 px-2 py-1 text-[11px] font-semibold text-gray-600 hover:bg-gray-50"
        >
          {expanded ? "접기" : "열기"}
        </button>
      </div>
      <p className="mt-1 text-[11px] text-gray-500">운영 참고 · 담당자 확인 필요</p>

      {expanded ? (
        <div className="mt-3 space-y-3">
          <div className="grid grid-cols-2 gap-2">
            {(Object.keys(OUTCOME_LABELS) as OutcomeCode[]).map((code) => {
              const meta = OUTCOME_LABELS[code];
              return (
                <button
                  key={code}
                  onClick={() => onSelectOutcomeCode(code)}
                  className={cn(
                    "rounded-lg border-2 px-3 py-2 text-left transition-colors",
                    selectedOutcomeCode === code ? `${meta.tone} border-current` : "border-gray-200 bg-gray-50 hover:bg-gray-100"
                  )}
                >
                  <p className="text-xs font-semibold text-slate-900">
                    {meta.icon} {meta.label}
                  </p>
                </button>
              );
            })}
          </div>

          <div>
            <label className="text-[11px] font-semibold text-gray-600">메모 (선택)</label>
            <textarea
              value={outcomeNote}
              onChange={(event) => onOutcomeNoteChange(event.target.value)}
              className="mt-1 h-16 w-full rounded-md border border-gray-200 px-2 py-1 text-xs outline-none focus:border-blue-400"
              placeholder="응답 내용을 간단히 기록하세요"
            />
          </div>

          <div className="flex justify-end gap-2">
            <button
              onClick={() => {
                onSelectOutcomeCode(null);
                onOutcomeNoteChange("");
              }}
              className="rounded-md border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-700"
            >
              초기화
            </button>
            <button
              onClick={onConfirm}
              disabled={!selectedOutcomeCode}
              className="rounded-md bg-[#163b6f] px-3 py-1.5 text-xs font-semibold text-white disabled:bg-gray-300"
            >
              저장
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function HandoffMemoGeneratorCard({
  expanded,
  onToggle,
  memoText,
  onMemoChange,
  onSave,
}: {
  expanded: boolean;
  onToggle: () => void;
  memoText: string;
  onMemoChange: (text: string) => void;
  onSave: () => void;
}) {
  return (
    <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
          <FilePenLine size={15} className="text-blue-600" />
          상담 인계 메모
        </h3>
        <button
          onClick={onToggle}
          className="rounded-md border border-gray-200 px-2 py-1 text-[11px] font-semibold text-gray-600 hover:bg-gray-50"
        >
          {expanded ? "접기" : "열기"}
        </button>
      </div>
      <p className="mt-1 text-[11px] text-gray-500">운영 참고 · 담당자 확인 필요</p>

      {expanded ? (
        <div className="mt-3 space-y-2">
          <textarea
            value={memoText}
            onChange={(event) => onMemoChange(event.target.value)}
            className="h-40 w-full rounded-md border border-gray-200 px-3 py-2 text-xs font-mono outline-none focus:border-blue-400"
            placeholder="[인수인계 메모]&#10;접촉 전략(룰 기반): ...&#10;트리거: ...&#10;최근 접촉: ...&#10;현재 결과: ...&#10;권장 다음 행동: ..."
          />
          <div className="flex justify-end">
            <button
              onClick={onSave}
              disabled={!memoText.trim()}
              className="rounded-md bg-[#163b6f] px-3 py-1.5 text-xs font-semibold text-white disabled:bg-gray-300"
            >
              저장
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}

export function PolicyGatePanel({ gates, onFix }: { gates: PolicyGate[]; onFix: (gate: PolicyGate) => void }) {
  return (
    <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
          <UserCheck size={15} className="text-slate-500" />
          사전 확인 상태
        </h3>
        <span className="text-[11px] text-gray-500">미충족 항목은 실행 전 확인 필요</span>
      </div>

      <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2">
        {gates.map((gate) => (
          <div key={gate.key} className="rounded-lg border border-gray-100 bg-gray-50 p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-semibold text-slate-800">{gate.label}</p>
              <span className={cn("rounded px-2 py-0.5 text-[10px] font-semibold", gateTone(gate.status))}>
                {gate.status === "PASS" ? "충족" : gate.status === "FAIL" ? "미충족" : "확인 필요"}
              </span>
            </div>
            <p className="mt-1 text-[11px] text-gray-500">{gate.failReason ?? "운영 실행 가능"}</p>
            {gate.fixAction && gate.status !== "PASS" && (
              <button
                onClick={() => onFix(gate)}
                className="mt-2 inline-flex items-center gap-1 rounded-md border border-blue-200 bg-blue-50 px-2 py-1 text-[11px] font-semibold text-blue-700 hover:bg-blue-100"
              >
                <ArrowRightCircle size={11} /> {gate.fixAction.label}
              </button>
            )}
          </div>
        ))}
      </div>

      <p className="mt-3 text-[11px] text-gray-500">운영자가 지금 해야 할 행동: 게이트 미충족 1건 해소 후 연락 실행</p>
    </section>
  );
}

export function RiskSignalEvidencePanel({
  evidence,
  quality,
}: {
  evidence: Stage1Detail["riskEvidence"];
  quality: CaseHeader["dataQuality"];
}) {
  return (
    <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
          <Layers size={15} className="text-slate-500" />
          위험 신호 근거
        </h3>
        <span className="text-[11px] text-gray-500">산출 시각 {formatDateTime(evidence.computedAt)} · {evidence.version}</span>
      </div>

      <div className="mt-3 space-y-2">
        {evidence.topFactors.slice(0, 3).map((factor) => (
          <div key={factor.title} className="rounded-md border border-gray-100 bg-gray-50 px-3 py-2">
            <div className="flex items-center gap-2">
              <p className="text-xs font-semibold text-slate-900">{factor.title}</p>
              {factor.isMissing && (
                <span className="rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-semibold text-red-700">누락 가능</span>
              )}
            </div>
            <p className="mt-1 text-[11px] text-gray-600">{factor.description}</p>
            <p className="mt-1 text-[10px] text-gray-400">최근성: {formatDateTime(factor.recency)}</p>
          </div>
        ))}
      </div>

      <div className="mt-3 rounded-md border border-gray-100 bg-white px-3 py-2 text-[11px] text-gray-600">
        <p>데이터 최신성: 최근 48시간 내 동기화 기준</p>
        <p title="품질 점수는 누락 필드, 연락처 검증, 최근성 기준의 운영 점수입니다.">품질 점수: {quality.score}% (툴팁 확인 가능)</p>
        <p>누락 필드: {quality.notes?.join(", ") ?? "없음"}</p>
      </div>
    </section>
  );
}

export function Stage1ScorePanel({
  scoreSummary,
  modelPriorityValue,
  modelPriorityMeta,
  contactPriority,
  interventionLevel,
}: {
  scoreSummary: Stage1Detail["scoreSummary"];
  modelPriorityValue: number;
  modelPriorityMeta: { label: string; tone: string; bar: string; guide: string };
  contactPriority: { label: string; tone: string };
  interventionLevel: InterventionLevel;
}) {
  const clampedPriority = Math.max(0, Math.min(100, modelPriorityValue));
  const topPercent = Math.max(1, 100 - clampedPriority);
  const activeBand =
    clampedPriority >= 85
      ? "긴급"
      : clampedPriority >= 65
        ? "우선"
        : clampedPriority >= 45
          ? "일반"
          : "관찰";
  const scoreTone =
    activeBand === "긴급"
      ? "text-red-600"
      : activeBand === "우선"
        ? "text-orange-600"
        : activeBand === "일반"
          ? "text-blue-600"
          : "text-emerald-600";
  const stepCards = [
    { key: "관찰", range: "0-44", tone: "border-emerald-300 bg-emerald-50 text-emerald-700", dot: "bg-emerald-500", guide: "기록/모니터링" },
    { key: "일반", range: "45-64", tone: "border-blue-300 bg-blue-50 text-blue-700", dot: "bg-blue-500", guide: "정규 순서 처리" },
    { key: "우선", range: "65-84", tone: "border-orange-300 bg-orange-50 text-orange-700", dot: "bg-orange-500", guide: "당일 우선 처리" },
    { key: "긴급", range: "85-100", tone: "border-red-300 bg-red-50 text-red-700", dot: "bg-red-500", guide: "24시간 내 실행" },
  ] as const;

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-sm font-bold text-slate-900">1차 검사 점수</h3>
        <div className="flex items-center gap-2">
          <span className={cn("rounded-full border px-2.5 py-1 text-[11px] font-semibold", contactPriority.tone)}>
            접촉 우선도 {contactPriority.label}
          </span>
          <span className={cn("rounded-full border px-2.5 py-1 text-[11px] font-semibold", modelPriorityMeta.tone)}>
            우선 처리 지표 {modelPriorityMeta.label} {modelPriorityValue}
          </span>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-2">
        {scoreSummary.map((item) => (
          <article key={item.label} className="rounded-lg border border-gray-100 bg-gray-50 p-3">
            <p className="text-[11px] font-semibold text-gray-500">{item.label}</p>
            <p className="mt-1 text-lg font-bold text-slate-900">
              {item.value}
              {item.unit ? <span className="ml-0.5 text-xs text-gray-400">{item.unit}</span> : null}
            </p>
            <p className="text-[10px] text-gray-400">업데이트 {formatDateTime(item.updatedAt)}</p>
            {item.flags?.length ? (
              <div className="mt-1 flex flex-wrap gap-1">
                {item.flags.map((flag) => (
                  <span key={`${item.label}-${flag}`} className="rounded bg-orange-100 px-1.5 py-0.5 text-[10px] font-semibold text-orange-700">
                    {flag}
                  </span>
                ))}
              </div>
            ) : (
              <span className="mt-1 inline-flex rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">
                정상
              </span>
            )}
          </article>
        ))}
      </div>

      <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
        <div className="flex items-center justify-between text-[11px] text-slate-700">
          <span className="relative inline-flex items-center gap-1 font-semibold group">
            운영 우선도 Bullet Chart
            <AlertCircle size={13} className="text-slate-400" />
            <span className="pointer-events-none absolute left-0 top-[calc(100%+8px)] z-30 w-64 rounded-lg border border-slate-200 bg-white p-2 text-[11px] text-slate-600 opacity-0 shadow-md transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100">
              <span className="block font-semibold text-slate-900">계산 방식 요약</span>
              <span className="mt-1 block">- 상태/위험/데이터 품질 점수를 합산합니다.</span>
              <span className="block">- 민원·지연·재시도 이력을 가중 요소로 반영합니다.</span>
              <span className="block">- 점수 구간(관찰/일반/우선/긴급)으로 실행 우선순위를 정합니다.</span>
            </span>
          </span>
          <span>{modelPriorityMeta.guide}</span>
        </div>

        <div className="mt-3 grid grid-cols-1 gap-4 xl:grid-cols-[210px,1fr]">
          <div className="rounded-lg border border-white bg-white px-3 py-2">
            <p className="text-[10px] font-semibold text-gray-500">현재 우선도 점수 / 개입 레벨</p>
            <p className={cn("mt-1 text-3xl font-black", scoreTone)}>
              {clampedPriority} <span className="text-lg font-bold text-slate-600">/ {interventionLevel}</span>
            </p>
            <div className="mt-2 flex items-center justify-between">
              <span className={cn("rounded-full border px-2 py-0.5 text-[10px] font-semibold", modelPriorityMeta.tone)}>
                {activeBand}
              </span>
              <span className="text-[10px] font-semibold text-gray-500">상위 {topPercent}% 대상</span>
            </div>
          </div>

          <div className="rounded-lg border border-white bg-white px-3 py-3">
            <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
              {stepCards.map((step) => {
                const isActive = step.key === activeBand;
                return (
                  <div
                    key={step.key}
                    className={cn(
                      "rounded-lg border px-2 py-2 transition-colors",
                      isActive ? step.tone : "border-gray-200 bg-gray-50 text-gray-500"
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <p className="text-[11px] font-bold">{step.key}</p>
                      <span
                        className={cn(
                          "h-2 w-2 rounded-full",
                          isActive ? step.dot : "bg-gray-300"
                        )}
                      />
                    </div>
                    <p className="mt-0.5 text-[10px] font-semibold">{step.range}</p>
                    <p className="mt-1 text-[10px]">{step.guide}</p>
                  </div>
                );
              })}
            </div>

            <div className="mt-2 rounded-md border border-gray-100 bg-gray-50 px-2 py-1.5 text-[11px] text-gray-600">
              현재 위치: <span className={cn("font-bold", scoreTone)}>{activeBand}</span> · 점수 {clampedPriority} / {interventionLevel}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export function ContactTimeline({
  timeline,
  filter,
  onFilterChange,
  listClassName,
}: {
  timeline: ContactEvent[];
  filter: TimelineFilter;
  onFilterChange: (next: TimelineFilter) => void;
  listClassName?: string;
}) {
  return (
    <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
          <History size={15} className="text-slate-500" />
          연락/발송/상태 타임라인
        </h3>

        <div className="flex items-center gap-1 rounded-lg border border-gray-200 bg-gray-50 p-1 text-[11px] font-semibold">
          {[
            { key: "ALL" as const, label: "전체" },
            { key: "CALL" as const, label: "연락" },
            { key: "SMS" as const, label: "발송" },
            { key: "STATUS" as const, label: "상태" },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => onFilterChange(tab.key)}
              className={cn(
                "rounded-md px-2 py-1 transition-colors",
                filter === tab.key ? "bg-white text-slate-900 shadow-sm" : "text-gray-500 hover:bg-white"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className={cn("mt-3 space-y-2", listClassName)}>
        {timeline.length === 0 ? (
          <p className="rounded-md border border-gray-100 bg-gray-50 px-3 py-2 text-xs text-gray-500">해당 필터의 기록이 없습니다.</p>
        ) : (
          timeline.map((event, idx) => (
            <div key={`${event.type}-${event.at}-${idx}`} className="rounded-md border border-gray-100 bg-gray-50 px-3 py-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-slate-800">{eventTitle(event)}</p>
                <span className="text-[11px] text-gray-500">{formatDateTime(event.at)}</span>
              </div>
              <p className="mt-1 text-[11px] text-gray-600">{eventDetail(event)}</p>
              <p className="mt-1 text-[10px] text-gray-400">처리자: {event.by}</p>
            </div>
          ))
        )}
      </div>

      <p className="mt-3 text-[11px] text-gray-500">운영자가 지금 해야 할 행동: 최근 3일 미접촉이면 재시도 계획 생성</p>
    </section>
  );
}

export function TodoChecklistPanel({
  todos,
  onDone,
  onSnooze,
  onCancel,
}: {
  todos: TodoItem[];
  onDone: (todoId: string) => void;
  onSnooze: (todoId: string) => void;
  onCancel: (todoId: string) => void;
}) {
  return (
    <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
        <ListChecks size={15} className="text-slate-500" />
        오늘 할 일
      </h3>

      <div className="mt-3 space-y-2">
        {todos.map((todo) => (
          <article key={todo.id} className="rounded-lg border border-gray-100 bg-gray-50 p-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-xs font-semibold text-slate-800">{todo.title}</p>
                {todo.dueAt ? <p className="text-[10px] text-gray-500">기한 {formatDateTime(todo.dueAt)}</p> : null}
              </div>
              <span className={cn("rounded border px-1.5 py-0.5 text-[10px] font-semibold", todoTone(todo.priority))}>P{todo.priority}</span>
            </div>

            <div className="mt-2 flex items-center justify-between">
              <span className="text-[11px] text-gray-500">
                상태: {todo.status === "OPEN" ? "진행 필요" : todo.status === "DONE" ? "완료" : todo.status === "SNOOZED" ? "보류" : "취소"}
              </span>

              <div className="flex items-center gap-1">
                <button
                  onClick={() => onDone(todo.id)}
                  disabled={todo.status === "DONE"}
                  className="inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-[10px] font-semibold text-emerald-700 disabled:opacity-50"
                >
                  <Check size={11} /> 완료
                </button>
                <button
                  onClick={() => onSnooze(todo.id)}
                  disabled={todo.status === "SNOOZED"}
                  className="inline-flex items-center gap-1 rounded-md border border-orange-200 bg-orange-50 px-2 py-1 text-[10px] font-semibold text-orange-700 disabled:opacity-50"
                >
                  <PauseCircle size={11} /> 보류
                </button>
                <button
                  onClick={() => onCancel(todo.id)}
                  disabled={todo.status === "CANCELED"}
                  className="inline-flex items-center gap-1 rounded-md border border-gray-200 bg-gray-100 px-2 py-1 text-[10px] font-semibold text-gray-600 disabled:opacity-50"
                >
                  <Ban size={11} /> 제외
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>

      <p className="mt-3 text-[11px] text-gray-500">운영자가 지금 해야 할 행동: 상단 2개 To-Do부터 완료</p>
    </section>
  );
}

function ConsultationServicePanel({
  onOpenCall,
  onOpenSms,
  lastCallEvent,
  lastSmsEvent,
}: {
  onOpenCall: () => void;
  onOpenSms: () => void;
  lastCallEvent?: ContactEvent;
  lastSmsEvent?: ContactEvent;
}) {
  return (
    <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
        <PhoneCall size={15} className="text-slate-500" />
        상담/문자 실행
      </h3>

      <p className="mt-2 text-[11px] text-gray-500">
        하단 인라인 상담/SMS 엔진에서 바로 실행하거나, 필요 시 v1 상담 서비스 화면으로 이동해 처리할 수 있습니다.
      </p>

      <div className="mt-3 space-y-2">
        <button
          onClick={onOpenCall}
          className="inline-flex w-full items-center justify-between rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-left hover:bg-blue-100"
        >
          <span className="inline-flex items-center gap-2 text-xs font-semibold text-blue-900">
            <Phone size={13} /> 전화 상담 페이지 열기
          </span>
          <ArrowRightCircle size={14} className="text-blue-700" />
        </button>

        <button
          onClick={onOpenSms}
          className="inline-flex w-full items-center justify-between rounded-lg border border-orange-200 bg-orange-50 px-3 py-2 text-left hover:bg-orange-100"
        >
          <span className="inline-flex items-center gap-2 text-xs font-semibold text-orange-900">
            <MessageSquare size={13} /> 문자/연계 페이지 열기
          </span>
          <ArrowRightCircle size={14} className="text-orange-700" />
        </button>
      </div>

      <div className="mt-3 space-y-1 rounded-md border border-gray-100 bg-gray-50 px-3 py-2">
        <p className="text-[11px] text-gray-600">
          최근 전화:{" "}
          {lastCallEvent?.type === "CALL_ATTEMPT"
            ? `${formatDateTime(lastCallEvent.at)} · ${eventTitle(lastCallEvent)}`
            : "기록 없음"}
        </p>
        <p className="text-[11px] text-gray-600">
          최근 문자:{" "}
          {lastSmsEvent?.type === "SMS_SENT"
            ? `${formatDateTime(lastSmsEvent.at)} · ${resolveSmsTemplateLabel(lastSmsEvent.templateId)}`
            : "기록 없음"}
        </p>
      </div>
    </section>
  );
}

export function CallConsolePanel({
  focus,
  disabledReason,
  callTarget,
  onTargetChange,
  callActive,
  callDurationText,
  callResultDraft,
  onResultDraftChange,
  callMemo,
  onMemoChange,
  onOpenScript,
  onStartCall,
  onStopCall,
  onFocus,
  onFocusClose,
  lastCallEvent,
}: {
  focus: boolean;
  disabledReason?: string;
  callTarget: CallTarget;
  onTargetChange: (target: CallTarget) => void;
  callActive: boolean;
  callDurationText: string;
  callResultDraft: "SUCCESS" | "NO_ANSWER" | "REJECTED" | "WRONG_NUMBER";
  onResultDraftChange: (value: "SUCCESS" | "NO_ANSWER" | "REJECTED" | "WRONG_NUMBER") => void;
  callMemo: string;
  onMemoChange: (value: string) => void;
  onOpenScript: () => void;
  onStartCall: () => void;
  onStopCall: () => void;
  onFocus: () => void;
  onFocusClose: () => void;
  lastCallEvent?: ContactEvent;
}) {
  const [currentStep, setCurrentStep] = useState<CallScriptStep>("greeting");
  const [checkStates, setCheckStates] = useState<Record<string, boolean>>({});
  const script = CALL_SCRIPT_STEPS.find((entry) => entry.step === currentStep) ?? CALL_SCRIPT_STEPS[0];

  useEffect(() => {
    setCurrentStep("greeting");
    setCheckStates({});
  }, [callTarget]);

  return (
    <section
      className={cn(
        "rounded-xl border bg-white p-0 shadow-sm transition-all overflow-hidden",
        focus ? "border-blue-300 ring-2 ring-blue-100 shadow-lg" : "border-gray-200"
      )}
    >
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-blue-100 px-4 py-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-blue-900 flex items-center gap-2">
            <PhoneCall size={15} className="text-blue-700" />
            상담 실행 엔진
          </h3>
          {focus ? (
            <button
              onClick={onFocusClose}
              className="inline-flex items-center gap-1 rounded-md border border-gray-200 bg-white px-2 py-1 text-[10px] font-semibold text-gray-600"
            >
              <X size={11} /> 포커스 종료
            </button>
          ) : (
            <button
              onClick={onFocus}
              className="inline-flex items-center gap-1 rounded-md border border-blue-200 bg-white px-2 py-1 text-[10px] font-semibold text-blue-700"
            >
              <ExternalLink size={11} /> 포커스
            </button>
          )}
        </div>
        <p className="mt-1 text-[11px] text-blue-700">구버전 상담 화면 흐름(단계 선택/스크립트/결과 기록)을 v2 운영 콘솔에 맞춰 반영</p>
      </div>

      <div className="p-4 space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => onTargetChange("citizen")}
            className={cn(
              "flex items-center gap-2 rounded-lg border-2 px-3 py-2.5 text-left transition-colors",
              callTarget === "citizen" ? "border-blue-500 bg-blue-50" : "border-gray-200 bg-gray-50 hover:border-gray-300"
            )}
          >
            <div className={cn("h-3 w-3 rounded-full border-2", callTarget === "citizen" ? "border-blue-500 bg-blue-500" : "border-gray-300")} />
            <div>
              <p className="text-xs font-semibold text-slate-900">대상자 본인</p>
              <p className="text-[10px] text-gray-500">상담 기본 대상</p>
            </div>
          </button>
          <button
            onClick={() => onTargetChange("guardian")}
            className={cn(
              "flex items-center gap-2 rounded-lg border-2 px-3 py-2.5 text-left transition-colors",
              callTarget === "guardian" ? "border-violet-500 bg-violet-50" : "border-gray-200 bg-gray-50 hover:border-gray-300"
            )}
          >
            <div className={cn("h-3 w-3 rounded-full border-2", callTarget === "guardian" ? "border-violet-500 bg-violet-500" : "border-gray-300")} />
            <div>
              <p className="text-xs font-semibold text-slate-900">보호자</p>
              <p className="text-[10px] text-gray-500">필요 시 우선 연락 전환</p>
            </div>
          </button>
        </div>

        <div className="grid grid-cols-4 gap-1 rounded-lg border border-gray-200 bg-gray-50 p-1 text-[11px] font-semibold">
          {CALL_SCRIPT_STEPS.map((step, idx) => (
            <button
              key={step.step}
              onClick={() => setCurrentStep(step.step)}
              className={cn(
                "rounded-md px-2 py-1 transition-colors",
                currentStep === step.step ? "bg-white text-slate-900 shadow-sm" : "text-gray-500 hover:bg-white"
              )}
            >
              {idx + 1}단계
            </button>
          ))}
        </div>

        <div>
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-blue-900">{script.title}</p>
              <button
                onClick={onOpenScript}
                className="inline-flex items-center gap-1 rounded border border-blue-200 bg-white px-1.5 py-0.5 text-[10px] font-semibold text-blue-700"
              >
                <FilePenLine size={10} />
                안내 확인
              </button>
            </div>
            <p className="mt-2 whitespace-pre-line text-[11px] leading-relaxed text-blue-900">{script.content}</p>
          </div>

          <div className="mt-2 grid grid-cols-1 gap-2 lg:grid-cols-2">
            <div className="rounded-md border border-gray-100 bg-gray-50 p-2">
              <p className="text-[11px] font-semibold text-gray-700">상담 팁</p>
              <ul className="mt-1 space-y-1">
                {script.tips.map((tip) => (
                  <li key={tip} className="text-[10px] text-gray-600">• {tip}</li>
                ))}
              </ul>
            </div>
            <div className="rounded-md border border-gray-100 bg-gray-50 p-2">
              <p className="text-[11px] font-semibold text-gray-700">체크포인트</p>
              <div className="mt-1 space-y-1">
                {script.checkpoints.map((checkpoint) => (
                  <label key={checkpoint} className="flex items-center gap-1 text-[10px] text-gray-600">
                    <input
                      type="checkbox"
                      checked={Boolean(checkStates[checkpoint])}
                      onChange={(e) => setCheckStates((prev) => ({ ...prev, [checkpoint]: e.target.checked }))}
                    />
                    {checkpoint}
                  </label>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-md border border-gray-100 bg-gray-50 px-3 py-2">
          <p className="text-[11px] font-semibold text-gray-700">통화 결과(임시 선택)</p>
          <div className="mt-1 grid grid-cols-2 gap-1 text-[11px]">
            {[
              { value: "SUCCESS", label: "성공", icon: CheckCircle2, tone: "text-emerald-700" },
              { value: "NO_ANSWER", label: "부재", icon: Clock3, tone: "text-orange-700" },
              { value: "REJECTED", label: "거절", icon: AlertCircle, tone: "text-red-700" },
              { value: "WRONG_NUMBER", label: "번호 오류", icon: X, tone: "text-gray-700" },
            ].map((option) => (
              <label key={option.value} className="flex items-center gap-1 rounded border border-gray-200 bg-white px-2 py-1">
                <input
                  type="radio"
                  name="call-result-draft"
                  checked={callResultDraft === option.value}
                  onChange={() => onResultDraftChange(option.value as "SUCCESS" | "NO_ANSWER" | "REJECTED" | "WRONG_NUMBER")}
                />
                <option.icon size={11} className={option.tone} />
                {option.label}
              </label>
            ))}
          </div>
        </div>

        <div className="rounded-md border border-gray-100 bg-gray-50 px-3 py-2">
          <p className="text-[11px] text-gray-500">통화 메모</p>
          <textarea
            value={callMemo}
            onChange={(e) => onMemoChange(e.target.value)}
            className="mt-1 h-16 w-full rounded-md border border-gray-200 bg-white px-2 py-1 text-xs outline-none focus:border-blue-400"
            placeholder="통화 중 확인한 사항을 기록하세요"
          />
        </div>

        <div className="flex items-center justify-between">
          <div className="inline-flex items-center gap-1 rounded-md bg-gray-100 px-2 py-1 text-[11px] font-semibold text-gray-700">
            <Timer size={12} /> {callActive ? `통화 중 ${callDurationText}` : "대기"}
          </div>

          {!callActive ? (
            <button
              onClick={onStartCall}
              disabled={Boolean(disabledReason)}
              title={disabledReason}
              className="inline-flex items-center gap-1 rounded-md bg-[#163b6f] px-3 py-1.5 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:bg-gray-300"
            >
              <Phone size={12} /> 전화하기
            </button>
          ) : (
            <button
              onClick={onStopCall}
              className="inline-flex items-center gap-1 rounded-md bg-red-600 px-3 py-1.5 text-xs font-semibold text-white"
            >
              <CheckCircle2 size={12} /> 통화 종료
            </button>
          )}
        </div>

        {disabledReason ? <p className="text-[11px] text-red-600">실행 불가: {disabledReason}</p> : null}

        {lastCallEvent?.type === "CALL_ATTEMPT" ? (
          <p className="text-[11px] text-gray-500">
            최근 이력: {formatDateTime(lastCallEvent.at)} · {eventTitle(lastCallEvent)}
          </p>
        ) : null}
      </div>
    </section>
  );
}

export function SmsConsolePanel({
  focus,
  disabledReason,
  smsTargets,
  onToggleTarget,
  guardianAvailable,
  smsTemplateId,
  onTemplateChange,
  smsScheduleType,
  onScheduleTypeChange,
  smsScheduledAt,
  onScheduledAtChange,
  previewText,
  onPrepareDispatch,
  onFocus,
  onFocusClose,
  lastSmsEvent,
}: {
  focus: boolean;
  disabledReason?: string;
  smsTargets: { citizen: boolean; guardian: boolean };
  onToggleTarget: (target: SmsTarget, checked: boolean) => void;
  guardianAvailable: boolean;
  smsTemplateId: string;
  onTemplateChange: (id: string) => void;
  smsScheduleType: "NOW" | "SCHEDULE";
  onScheduleTypeChange: (type: "NOW" | "SCHEDULE") => void;
  smsScheduledAt: string;
  onScheduledAtChange: (value: string) => void;
  previewText: string;
  onPrepareDispatch: () => void;
  onFocus: () => void;
  onFocusClose: () => void;
  lastSmsEvent?: ContactEvent;
}) {
  const selectedCount = Number(smsTargets.citizen) + Number(smsTargets.guardian && guardianAvailable);

  return (
    <section
      className={cn(
        "rounded-xl border bg-white p-0 shadow-sm transition-all overflow-hidden",
        focus ? "border-orange-300 ring-2 ring-orange-100 shadow-lg" : "border-gray-200"
      )}
    >
      <div className="bg-gradient-to-r from-orange-50 to-amber-50 border-b border-orange-100 px-4 py-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-orange-900 flex items-center gap-2">
            <MessageSquare size={15} className="text-orange-700" />
            SMS 엔진
          </h3>
          {focus ? (
            <button
              onClick={onFocusClose}
              className="inline-flex items-center gap-1 rounded-md border border-gray-200 bg-white px-2 py-1 text-[10px] font-semibold text-gray-600"
            >
              <X size={11} /> 포커스 종료
            </button>
          ) : (
            <button
              onClick={onFocus}
              className="inline-flex items-center gap-1 rounded-md border border-orange-200 bg-white px-2 py-1 text-[10px] font-semibold text-orange-700"
            >
              <ExternalLink size={11} /> 포커스
            </button>
          )}
        </div>
        <p className="mt-1 text-[11px] text-orange-700">구버전 문자 발송 UI(대상 선택/템플릿/미리보기)를 v2 콘솔로 이식</p>
        <p className="mt-0.5 text-[10px] text-orange-700">문자 3종(접촉/예약안내/리마인더) 기준 · 과도한 단정 표현 금지</p>
      </div>

      <div className="p-4 space-y-2">
        <div className="space-y-2">
          <label
            className={cn(
              "flex items-center gap-3 rounded-lg border-2 px-3 py-2.5 transition-colors",
              smsTargets.citizen ? "border-orange-400 bg-orange-50" : "border-gray-200 bg-white hover:border-gray-300"
            )}
          >
            <input
              type="checkbox"
              checked={smsTargets.citizen}
              onChange={(e) => onToggleTarget("citizen", e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-orange-600"
            />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900">대상자 본인</p>
              <p className="text-[11px] text-gray-500">기본 수신 대상</p>
            </div>
            {smsTargets.citizen ? (
              <span className="rounded bg-orange-100 px-1.5 py-0.5 text-[10px] font-semibold text-orange-700">발송</span>
            ) : null}
          </label>

          <label
            className={cn(
              "flex items-center gap-3 rounded-lg border-2 px-3 py-2.5 transition-colors",
              !guardianAvailable
                ? "border-dashed border-gray-200 bg-gray-50 opacity-60"
                : smsTargets.guardian
                  ? "border-blue-400 bg-blue-50"
                  : "border-gray-200 bg-white hover:border-gray-300"
            )}
          >
            <input
              type="checkbox"
              checked={smsTargets.guardian && guardianAvailable}
              onChange={(e) => onToggleTarget("guardian", e.target.checked)}
              disabled={!guardianAvailable}
              className="h-4 w-4 rounded border-gray-300 text-blue-600"
            />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900">보호자</p>
              <p className="text-[11px] text-gray-500">{guardianAvailable ? "추가 수신 가능" : "등록된 번호 없음"}</p>
            </div>
            {smsTargets.guardian && guardianAvailable ? (
              <span className="rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700">발송</span>
            ) : null}
          </label>
        </div>

        <select
          value={smsTemplateId}
          onChange={(e) => onTemplateChange(e.target.value)}
          className="w-full rounded-md border border-gray-200 bg-white px-2 py-2 text-xs outline-none focus:border-blue-400"
        >
          {SMS_TEMPLATES.map((template) => (
            <option key={template.id} value={template.id}>
              {smsMessageTypeLabel(template.messageType)} · {template.label}
            </option>
          ))}
        </select>

        <div className="grid grid-cols-2 gap-1 rounded-lg border border-gray-200 bg-gray-50 p-1 text-[11px] font-semibold">
          <button
            onClick={() => onScheduleTypeChange("NOW")}
            className={cn("rounded-md px-2 py-1", smsScheduleType === "NOW" ? "bg-white shadow-sm text-slate-900" : "text-gray-500")}
          >
            즉시
          </button>
          <button
            onClick={() => onScheduleTypeChange("SCHEDULE")}
            className={cn("rounded-md px-2 py-1", smsScheduleType === "SCHEDULE" ? "bg-white shadow-sm text-slate-900" : "text-gray-500")}
          >
            예약
          </button>
        </div>

        {smsScheduleType === "SCHEDULE" ? (
          <input
            type="datetime-local"
            value={smsScheduledAt}
            onChange={(e) => onScheduledAtChange(e.target.value)}
            className="w-full rounded-md border border-gray-200 bg-white px-2 py-2 text-xs outline-none focus:border-blue-400"
          />
        ) : null}

        <div className="rounded-md border border-gray-100 bg-gray-50 px-3 py-2">
          <p className="text-[11px] text-gray-500">미리보기</p>
          <p className="mt-1 text-[11px] text-gray-700 whitespace-pre-wrap">{previewText}</p>
          <p className="mt-1 text-[10px] text-gray-400">예상 길이: {previewText.length}자</p>
        </div>

        <button
          onClick={onPrepareDispatch}
          disabled={Boolean(disabledReason) || (smsScheduleType === "SCHEDULE" && !smsScheduledAt)}
          title={disabledReason ?? (smsScheduleType === "SCHEDULE" && !smsScheduledAt ? "예약 시간을 입력하세요" : undefined)}
          className="inline-flex w-full items-center justify-center gap-1 rounded-md bg-orange-600 px-3 py-1.5 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:bg-gray-300"
        >
          <MessageSquare size={12} /> {smsScheduleType === "NOW" ? `SMS 발송 (${selectedCount}건)` : `SMS 예약 (${selectedCount}건)`}
        </button>

        {disabledReason ? <p className="text-[11px] text-red-600">실행 불가: {disabledReason}</p> : null}

        {lastSmsEvent?.type === "SMS_SENT" ? (
          <p className="text-[11px] text-gray-500">
            최근 이력: {formatDateTime(lastSmsEvent.at)} · {resolveSmsTemplateLabel(lastSmsEvent.templateId)} · {smsResultLabel(lastSmsEvent.status)}
          </p>
        ) : null}
      </div>
    </section>
  );
}

function InterventionLevelPanel({
  level,
  statusLabel,
  guides,
  onChangeLevel,
  onHold,
  onExclude,
}: {
  level: InterventionLevel;
  statusLabel: string;
  guides: ReturnType<typeof getStage1InterventionGuides>;
  onChangeLevel: (level: InterventionLevel) => void;
  onHold: () => void;
  onExclude: () => void;
}) {
  return (
    <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
        <Layers size={15} className="text-slate-500" />
        개입 레벨 (운영 강도)
      </h3>

      <div className="mt-3 space-y-2">
        {guides.map((guide) => (
          <button
            key={guide.level}
            onClick={() => onChangeLevel(guide.level)}
            title={`${guide.purpose} / 적용 시점: ${guide.whenToUse}`}
            className={cn(
              "w-full rounded-lg border px-3 py-2 text-left transition-colors",
              guide.level === level ? guide.tone : "border-gray-200 bg-gray-50 hover:bg-gray-100"
            )}
          >
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold">{guide.level} · {guide.label}</p>
              {guide.level === level ? <CheckCircle2 size={13} /> : null}
            </div>
            <p className="mt-1 text-[11px] text-gray-600">{guide.purpose}</p>
          </button>
        ))}
      </div>

      <div className="mt-3 rounded-md border border-gray-100 bg-gray-50 p-2">
        <p className="text-[11px] text-gray-600">현재 상태: <strong>{statusLabel}</strong></p>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <button
          onClick={onHold}
          className="inline-flex items-center justify-center gap-1 rounded-md border border-orange-200 bg-orange-50 px-2 py-1.5 text-[11px] font-semibold text-orange-700"
        >
          <PauseCircle size={12} /> 보류
        </button>
        <button
          onClick={onExclude}
          className="inline-flex items-center justify-center gap-1 rounded-md border border-red-200 bg-red-50 px-2 py-1.5 text-[11px] font-semibold text-red-700"
        >
          <Ban size={12} /> 우선순위 제외
        </button>
      </div>
    </section>
  );
}

export function ActionReasonModal({
  draft,
  onClose,
  onChangeReason,
  onConfirm,
}: {
  draft: ReasonActionDraft | null;
  onClose: () => void;
  onChangeReason: (reason: string) => void;
  onConfirm: () => void;
}) {
  if (!draft) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4">
      <div className="w-full max-w-md rounded-xl border border-gray-200 bg-white p-4 shadow-2xl">
        <h3 className="text-sm font-bold text-slate-900">{draft.title}</h3>
        <p className="mt-1 text-xs text-gray-500">변경 사유는 감사 로그에 즉시 기록됩니다.</p>

        <textarea
          value={draft.reason}
          onChange={(e) => onChangeReason(e.target.value)}
          className="mt-3 h-24 w-full rounded-lg border border-gray-200 px-2 py-1.5 text-xs outline-none focus:border-blue-400"
          placeholder="변경 사유를 입력하세요"
        />

        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-md border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-700">
            취소
          </button>
          <button
            onClick={onConfirm}
            disabled={!draft.reason.trim()}
            className="rounded-md bg-[#163b6f] px-3 py-1.5 text-xs font-semibold text-white disabled:bg-gray-300"
          >
            {draft.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export function OutcomeModal({
  draft,
  loading,
  onClose,
  onChangeResult,
  onChangeNote,
  onConfirm,
}: {
  draft: OutcomeDraft | null;
  loading: boolean;
  onClose: () => void;
  onChangeResult: (value: string) => void;
  onChangeNote: (value: string) => void;
  onConfirm: () => void;
}) {
  if (!draft) return null;

  const callOptions = [
    { value: "SUCCESS", label: "연락 성공" },
    { value: "NO_ANSWER", label: "부재" },
    { value: "REJECTED", label: "거절" },
    { value: "WRONG_NUMBER", label: "번호 오류" },
  ] as const;

  const smsOptions = [
    { value: "DELIVERED", label: "전송 완료" },
    { value: "FAILED", label: "전송 실패" },
    { value: "PENDING", label: "전송 예약" },
  ] as const;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4">
      <div className="w-full max-w-md rounded-xl border border-gray-200 bg-white p-4 shadow-2xl">
        <h3 className="text-sm font-bold text-slate-900">{draft.title}</h3>
        {draft.mode === "CALL" ? (
          <p className="mt-1 text-xs text-gray-500">통화 시간: {String(Math.floor(draft.durationSec / 60)).padStart(2, "0")}:{String(draft.durationSec % 60).padStart(2, "0")}</p>
        ) : (
          <p className="mt-1 text-xs text-gray-500">{draft.scheduled ? "예약 발송 결과를 기록합니다" : "즉시 발송 결과를 기록합니다"}</p>
        )}

        <div className="mt-3">
          <label className="text-[11px] font-semibold text-gray-600">결과</label>
          <select
            value={draft.result}
            onChange={(e) => onChangeResult(e.target.value)}
            className="mt-1 w-full rounded-md border border-gray-200 bg-white px-2 py-2 text-xs outline-none focus:border-blue-400"
          >
            {(draft.mode === "CALL" ? callOptions : smsOptions).map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div className="mt-3">
          <label className="text-[11px] font-semibold text-gray-600">메모</label>
          <textarea
            value={draft.note}
            onChange={(e) => onChangeNote(e.target.value)}
            className="mt-1 h-20 w-full rounded-md border border-gray-200 px-2 py-1.5 text-xs outline-none focus:border-blue-400"
            placeholder="결과 메모를 입력하세요"
          />
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <button
            onClick={onClose}
            disabled={loading}
            className="rounded-md border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-700 disabled:opacity-50"
          >
            취소
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="rounded-md bg-[#163b6f] px-3 py-1.5 text-xs font-semibold text-white disabled:bg-gray-300"
          >
            {loading ? "처리 중..." : "저장"}
          </button>
        </div>
      </div>
    </div>
  );
}
