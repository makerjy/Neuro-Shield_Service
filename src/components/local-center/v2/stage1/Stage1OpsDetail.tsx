import React, { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  ArrowRightCircle,
  Ban,
  Check,
  CheckCircle2,
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
  ShieldCheck,
  Timer,
  UserCheck,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "../shared";
import {
  getStage1ContactPriority,
  getStage1InterventionGuides,
  getStage1InterventionPlan,
  maskPhone,
  toAgeBand,
  type CaseRecord,
} from "../caseRecords";
import type {
  CaseHeader,
  ContactEvent,
  DataQualityLevel,
  InterventionLevel,
  PolicyGate,
  PolicyGateKey,
  SlaLevel,
  Stage1Detail,
  TodoItem,
} from "./stage1Types";

type TimelineFilter = "ALL" | "CALL" | "SMS" | "STATUS";
type ConsoleFocus = "NONE" | "CALL" | "SMS";
type CallTarget = "citizen" | "guardian";
type SmsTarget = "citizen" | "guardian";
type SmsDispatchStatus = "DELIVERED" | "FAILED" | "PENDING";
type CallScriptStep = "greeting" | "purpose" | "assessment" | "scheduling";

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
const DEFAULT_GUIDE_LINK = "https://neuro-shield.local/guide";
const DEFAULT_BOOKING_URL = "https://neuro-shield.local/booking";
const DEFAULT_UNSUBSCRIBE = "수신거부 080-000-0000";

const SMS_TEMPLATES: SmsTemplate[] = [
  {
    id: "S1_CONTACT_BASE",
    messageType: "CONTACT",
    label: "1차 접촉(기본)",
    body: ({ centerName, guideLink, centerPhone }) =>
      `[치매안심센터:${centerName}] 인지건강 확인을 위한 안내입니다. 진단이 확정된 상태가 아니며, 확인 절차(상담/선별검사)가 필요할 수 있습니다. 안내 확인 및 희망 연락시간 선택: ${guideLink} / 문의: ${centerPhone}`,
  },
  {
    id: "S1_CONTACT_GUARDIAN",
    messageType: "CONTACT",
    label: "1차 접촉(보호자 옵션)",
    body: ({ centerName, guideLink, centerPhone }) =>
      `[치매안심센터:${centerName}] 안내 확인 후 본인 응답이 어렵다면 보호자 연락처(선택)를 남길 수 있습니다. 안내 확인/연락시간 선택: ${guideLink} / 문의: ${centerPhone}`,
  },
  {
    id: "S1_BOOKING_BASE",
    messageType: "BOOKING",
    label: "1차 예약안내(선별/상담)",
    body: ({ centerName, reservationLink, centerPhone }) =>
      `[치매안심센터:${centerName}] 인지 선별검사/상담 예약 안내드립니다. 가능한 날짜·시간을 선택해주세요. 예약/변경: ${reservationLink} / 문의: ${centerPhone}`,
  },
  {
    id: "S1_BOOKING_CHANNEL",
    messageType: "BOOKING",
    label: "1차 예약안내(방문/전화 선택)",
    body: ({ centerName, reservationLink }) =>
      `[치매안심센터:${centerName}] 상담/선별검사는 방문 또는 전화로 진행될 수 있습니다. 희망 방식을 선택해 예약해주세요. ${reservationLink}`,
  },
  {
    id: "S1_REMINDER_FIRST",
    messageType: "REMINDER",
    label: "1차 리마인더(1차 안내)",
    body: ({ centerName, guideLink, centerPhone, unsubscribe }) =>
      `[치매안심센터:${centerName}] 이전에 안내드린 인지건강 확인 링크가 아직 미확인 상태입니다. 원치 않으시면 수신거부 가능하며, 확인은 아래 링크에서 가능합니다. ${guideLink} / 문의: ${centerPhone} / ${unsubscribe}`,
  },
  {
    id: "S1_REMINDER_FINAL",
    messageType: "REMINDER",
    label: "1차 리마인더(최종)",
    body: ({ centerName, guideLink, centerPhone }) =>
      `[치매안심센터:${centerName}] 확인이 없어 마지막으로 안내드립니다. 필요 시 아래 링크에서 확인/예약할 수 있습니다. ${guideLink} / 문의: ${centerPhone}`,
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
    title: "2단계: 연락 목적 고지",
    content:
      "이번 연락은 인지건강 확인 안내를 위한 운영 절차입니다. 현재 진단이 확정된 상태는 아니며, 상담/선별검사 등 확인 절차를 안내드립니다.",
    tips: ["목적을 선명하게 안내", "불안 유발 표현 금지", "확인 전 단계임을 명시"],
    checkpoints: ["목적 고지 문구 전달", "상대방 이해 여부 확인", "추가 문의 기록"],
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
      key: "PURPOSE_NOTICE_OK",
      label: "목적 고지",
      status: "FAIL",
      failReason: "목적 고지 기록이 없습니다",
      fixAction: { label: "스크립트 열기", action: "OPEN_NOTICE_SCRIPT" },
    },
    {
      key: "CONTACTABLE_TIME_OK",
      label: "연락 가능 시간",
      status: caseRecord?.status === "지연" ? "UNKNOWN" : "PASS",
      failReason: caseRecord?.status === "지연" ? "연락 가능 시간 확인이 필요합니다" : undefined,
      fixAction:
        caseRecord?.status === "지연"
          ? { label: "운영 시간 확인", action: "OPEN_NOTICE_SCRIPT" }
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

  return {
    header: {
      caseId: caseRecord?.id ?? "CASE-UNKNOWN",
      stage: "STAGE1",
      assigneeName: caseRecord?.manager ?? STAGE1_PANEL_OPERATOR,
      statusLabel: caseRecord?.status === "완료" ? "완료" : caseRecord?.status === "지연" ? "진행중" : caseRecord?.status ?? "진행중",
      waitDays: inferWaitDays(caseRecord?.status),
      sla: inferSla(caseRecord?.status),
      dataQuality: quality,
    },
    policyGates: buildPolicyGates(caseRecord),
    interventionLevel: intervention.level,
    riskEvidence: buildRiskEvidence(caseRecord),
    scoreSummary: buildScoreSummary(caseRecord),
    todos: buildTodos(intervention.level, quality.level),
    timeline: buildInitialTimeline(caseRecord, intervention.level),
  };
}

function buildInitialAuditLogs(caseRecord: CaseRecord | undefined, detail: Stage1Detail): AuditLogEntry[] {
  const actor = caseRecord?.manager ?? STAGE1_PANEL_OPERATOR;

  return [
    {
      id: `audit-${detail.header.caseId}-1`,
      at: formatDateTime(withHoursFromNow(-72)),
      actor,
      message: "케이스 상세 열람",
    },
    {
      id: `audit-${detail.header.caseId}-2`,
      at: formatDateTime(withHoursFromNow(-48)),
      actor,
      message: `개입 레벨 설정: ${detail.interventionLevel}`,
    },
    {
      id: `audit-${detail.header.caseId}-3`,
      at: formatDateTime(withHoursFromNow(-18)),
      actor,
      message: "연락 이력 동기화 완료",
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

export function Stage1OpsDetail({
  caseRecord,
  onOpenConsultation,
}: {
  caseRecord?: CaseRecord;
  onOpenConsultation?: (caseId: string, entry: "call" | "sms") => void;
}) {
  const [detail, setDetail] = useState<Stage1Detail>(() => buildInitialStage1Detail(caseRecord));
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>(() =>
    buildInitialAuditLogs(caseRecord, buildInitialStage1Detail(caseRecord))
  );
  const [timelineFilter, setTimelineFilter] = useState<TimelineFilter>("ALL");
  const [consoleFocus, setConsoleFocus] = useState<ConsoleFocus>("NONE");
  const [scriptOpen, setScriptOpen] = useState(false);

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

  const [reasonModal, setReasonModal] = useState<ReasonActionDraft | null>(null);
  const [outcomeModal, setOutcomeModal] = useState<OutcomeDraft | null>(null);
  const [savingOutcome, setSavingOutcome] = useState(false);

  const [nowTick, setNowTick] = useState(Date.now());
  const [recontactDueAt, setRecontactDueAt] = useState(withHoursFromNow(24));

  useEffect(() => {
    const initDetail = buildInitialStage1Detail(caseRecord);
    setDetail(initDetail);
    setAuditLogs(buildInitialAuditLogs(caseRecord, initDetail));
    setTimelineFilter("ALL");
    setConsoleFocus("NONE");
    setScriptOpen(false);
    setCallTarget("citizen");
    setCallActive(false);
    setCallSeconds(0);
    setCallMemo("");
    setCallResultDraft("SUCCESS");
    setSmsTargets({ citizen: true, guardian: false });
    setSmsTemplateId(SMS_TEMPLATES[0].id);
    setSmsScheduleType("NOW");
    setSmsScheduledAt("");
    setReasonModal(null);
    setOutcomeModal(null);
    setSavingOutcome(false);
    setRecontactDueAt(withHoursFromNow(24));
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
    "PURPOSE_NOTICE_OK",
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

    if (action === "OPEN_NOTICE_SCRIPT") {
      setScriptOpen(true);
      toast.success("처리 완료(로그 기록됨)");
      appendAuditLog("목적 고지 스크립트 열람");
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

  const openConsultationPage = (entry: "call" | "sms") => {
    const label = entry === "call" ? "전화 상담" : "문자/연계";
    appendTimeline({
      type: "STATUS_CHANGE",
      at: nowIso(),
      from: "Stage1 상세",
      to: "상담 서비스 화면",
      reason: `${label} 페이지 이동`,
      by: detail.header.assigneeName,
    });
    appendAuditLog(`${label} 페이지로 이동`);
    if (onOpenConsultation) {
      onOpenConsultation(detail.header.caseId, entry);
      return;
    }
    toast.error("상담 페이지 이동 경로를 확인하세요");
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
    setConsoleFocus("CALL");
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
    setConsoleFocus("SMS");
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
        updateGateStatus("PURPOSE_NOTICE_OK", "PASS", "통화 중 목적 고지 완료");
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

  const lastCallEvent = detail.timeline.find((event) => event.type === "CALL_ATTEMPT");
  const lastSmsEvent = detail.timeline.find((event) => event.type === "SMS_SENT");
  const isConsoleExpanded = consoleFocus !== "NONE";
  const modelPriorityValue = useMemo(() => computePriorityValue(caseRecord), [caseRecord]);
  const modelPriorityMeta = useMemo(() => priorityIndicator(modelPriorityValue), [modelPriorityValue]);
  const contactPriority = useMemo(() => getStage1ContactPriority(caseRecord), [caseRecord]);

  return (
    <div className="space-y-5">
      <OpsSummaryStrip
        header={detail.header}
        nextAction={nextOpenTodo?.title ?? "오늘 우선 업무 완료"}
        slaCountdown={remainingTimeText(detail.header.sla.dueAt, nowTick)}
        recontactCountdown={remainingTimeText(recontactDueAt, nowTick)}
      />

      <Stage1ScorePanel
        scoreSummary={detail.scoreSummary}
        modelPriorityValue={modelPriorityValue}
        modelPriorityMeta={modelPriorityMeta}
        contactPriority={contactPriority}
      />

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
        <section className={cn("space-y-4", isConsoleExpanded ? "xl:col-span-7" : "xl:col-span-8")}>
          <PolicyGatePanel gates={detail.policyGates} onFix={handleGateFixAction} />

          <RiskSignalEvidencePanel
            evidence={detail.riskEvidence}
            quality={detail.header.dataQuality}
          />

          <ContactTimeline
            timeline={filteredTimeline}
            filter={timelineFilter}
            onFilterChange={setTimelineFilter}
          />
        </section>

        <aside className={cn("space-y-4 xl:sticky xl:top-20", isConsoleExpanded ? "xl:col-span-5" : "xl:col-span-4")}>
          <TodoChecklistPanel
            todos={detail.todos}
            onDone={(todoId) => changeTodoStatus(todoId, "DONE")}
            onSnooze={(todoId) => changeTodoStatus(todoId, "SNOOZED")}
            onCancel={(todoId) => changeTodoStatus(todoId, "CANCELED")}
          />

          <ConsultationServicePanel
            onOpenCall={() => openConsultationPage("call")}
            onOpenSms={() => openConsultationPage("sms")}
            lastCallEvent={lastCallEvent}
            lastSmsEvent={lastSmsEvent}
          />

          <CallConsolePanel
            focus={consoleFocus === "CALL"}
            disabledReason={callDisabledReason}
            callTarget={callTarget}
            onTargetChange={setCallTarget}
            callActive={callActive}
            callDurationText={callDurationText}
            callResultDraft={callResultDraft}
            onResultDraftChange={setCallResultDraft}
            callMemo={callMemo}
            onMemoChange={setCallMemo}
            onOpenScript={() => setScriptOpen(true)}
            onStartCall={handleCallStart}
            onStopCall={handleCallStop}
            onFocus={() => setConsoleFocus("CALL")}
            onFocusClose={() => setConsoleFocus("NONE")}
            lastCallEvent={lastCallEvent}
          />

          <SmsConsolePanel
            focus={consoleFocus === "SMS"}
            disabledReason={smsDisabledReason}
            smsTargets={smsTargets}
            onToggleTarget={(target, checked) =>
              setSmsTargets((prev) => ({
                ...prev,
                [target]: target === "guardian" ? checked && hasGuardianPhone : checked,
              }))
            }
            guardianAvailable={hasGuardianPhone}
            smsTemplateId={smsTemplateId}
            onTemplateChange={setSmsTemplateId}
            smsScheduleType={smsScheduleType}
            onScheduleTypeChange={setSmsScheduleType}
            smsScheduledAt={smsScheduledAt}
            onScheduledAtChange={setSmsScheduledAt}
            previewText={smsPreview}
            onPrepareDispatch={handleSmsDispatchPrepare}
            onFocus={() => setConsoleFocus("SMS")}
            onFocusClose={() => setConsoleFocus("NONE")}
            lastSmsEvent={lastSmsEvent}
          />

          <InterventionLevelPanel
            level={detail.interventionLevel}
            statusLabel={detail.header.statusLabel}
            guides={interventionGuides}
            onChangeLevel={openLevelChangeModal}
            onHold={() => openStatusReasonModal("보류")}
            onExclude={() => openStatusReasonModal("우선순위 제외")}
          />
        </aside>
      </div>

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

        <div className="mt-3 space-y-2">
          {auditLogs.map((log) => (
            <div key={log.id} className="rounded-md border border-gray-100 bg-gray-50 px-3 py-2 text-xs">
              <div className="flex items-center justify-between">
                <p className="font-semibold text-slate-800">{log.message}</p>
                <span className="text-[11px] text-gray-500">{log.at}</span>
              </div>
              <p className="mt-0.5 text-[11px] text-gray-500">기록자: {log.actor}</p>
            </div>
          ))}
        </div>
      </section>

      <ScriptDrawer
        open={scriptOpen}
        onClose={() => setScriptOpen(false)}
        caseId={detail.header.caseId}
        assignee={detail.header.assigneeName}
        onMarkPurposeNotice={() => {
          updateGateStatus("PURPOSE_NOTICE_OK", "PASS", "목적 고지 스크립트 확인");
          toast.success("처리 완료(로그 기록됨)");
        }}
      />

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
  nextAction,
  slaCountdown,
  recontactCountdown,
}: {
  header: CaseHeader;
  nextAction: string;
  slaCountdown: string;
  recontactCountdown: string;
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-gradient-to-r from-slate-900 to-slate-800 px-4 py-3 text-white shadow-sm">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="rounded-md bg-white/15 px-2.5 py-1 font-semibold">현재 상태: {header.statusLabel}</span>
        <span className="rounded-md bg-white/15 px-2.5 py-1 font-semibold">대기 {header.waitDays}일</span>
        <span className="rounded-md bg-white/15 px-2.5 py-1 font-semibold">SLA 타이머 {slaCountdown}</span>
        <span className="rounded-md bg-white/15 px-2.5 py-1 font-semibold">재접촉 타이머 {recontactCountdown}</span>
        <SlaStatusBadge sla={header.sla} />
        <DataQualityBadge dataQuality={header.dataQuality} />
      </div>

      <p className="mt-2 text-[12px] text-slate-100">
        운영자가 지금 해야 할 행동: <strong>{nextAction}</strong>
      </p>
    </section>
  );
}

export function PolicyGatePanel({ gates, onFix }: { gates: PolicyGate[]; onFix: (gate: PolicyGate) => void }) {
  return (
    <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
          <UserCheck size={15} className="text-slate-500" />
          정책 게이트/연락 가능 상태
        </h3>
        <span className="text-[11px] text-gray-500">게이트 미충족은 실행 전 해소 필요</span>
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
}: {
  scoreSummary: Stage1Detail["scoreSummary"];
  modelPriorityValue: number;
  modelPriorityMeta: { label: string; tone: string; bar: string; guide: string };
  contactPriority: { label: string; tone: string };
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
            모델 산출 우선도 지표 {modelPriorityMeta.label} {modelPriorityValue}
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
          <span className="font-semibold">운영 우선도 Bullet Chart</span>
          <span>{modelPriorityMeta.guide}</span>
        </div>

        <div className="mt-3 grid grid-cols-1 gap-4 xl:grid-cols-[210px,1fr]">
          <div className="rounded-lg border border-white bg-white px-3 py-2">
            <p className="text-[10px] font-semibold text-gray-500">현재 우선도 점수</p>
            <p className={cn("mt-1 text-3xl font-black", scoreTone)}>{clampedPriority}</p>
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
              현재 위치: <span className={cn("font-bold", scoreTone)}>{activeBand}</span> · 점수 {clampedPriority}
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
}: {
  timeline: ContactEvent[];
  filter: TimelineFilter;
  onFilterChange: (next: TimelineFilter) => void;
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

      <div className="mt-3 space-y-2">
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
        오늘의 To-Do
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
                목적 고지
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
        <p className="mt-0.5 text-[10px] text-orange-700">문자 3종(접촉/예약안내/리마인더) 기준 · 확진/AI 판단 표현 금지</p>
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

export function ScriptDrawer({
  open,
  onClose,
  caseId,
  assignee,
  onMarkPurposeNotice,
}: {
  open: boolean;
  onClose: () => void;
  caseId: string;
  assignee: string;
  onMarkPurposeNotice: () => void;
}) {
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (!open) {
      setChecked(false);
    }
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-black/20">
      <aside className="h-full w-full max-w-md border-l border-gray-200 bg-white p-4 shadow-2xl">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900">콜 스크립트</h3>
          <button onClick={onClose} className="rounded-md border border-gray-200 p-1 text-gray-600 hover:bg-gray-50">
            <X size={14} />
          </button>
        </div>

        <div className="mt-3 rounded-lg border border-gray-100 bg-gray-50 p-3 text-xs text-gray-700 space-y-2">
          <p>안녕하세요. {DEFAULT_CENTER_NAME} {assignee} 담당자입니다.</p>
          <p>{caseId} 건 인지건강 확인 안내를 위해 연락드렸습니다.</p>
          <p>현재 진단이 확정된 상태는 아니며, 상담/선별검사 등 확인 절차를 안내드리는 단계입니다.</p>
          <p>확인 후 연락 가능 시간, 예약 방법, 다음 안내 절차를 정리해드리겠습니다.</p>
        </div>

        <label className="mt-4 flex items-start gap-2 rounded-lg border border-blue-100 bg-blue-50 p-3 text-xs text-blue-900">
          <input
            type="checkbox"
            checked={checked}
            onChange={(e) => setChecked(e.target.checked)}
            className="mt-0.5"
          />
          <span>목적 고지 문구를 확인하고 안내했습니다.</span>
        </label>

        <button
          onClick={() => {
            if (!checked) return;
            onMarkPurposeNotice();
            onClose();
          }}
          disabled={!checked}
          className="mt-3 inline-flex w-full items-center justify-center gap-1 rounded-md bg-[#163b6f] px-3 py-2 text-xs font-semibold text-white disabled:bg-gray-300"
        >
          <CheckCircle2 size={12} /> 목적 고지 완료 처리
        </button>
      </aside>
    </div>
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

export function Stage1CaseIdentity({ caseRecord }: { caseRecord?: CaseRecord }) {
  if (!caseRecord) {
    return null;
  }

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <h3 className="text-sm font-bold text-slate-900 mb-2">개인정보 요약(비식별)</h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs">
        <div className="rounded-md border border-gray-100 bg-gray-50 px-3 py-2">
          <p className="text-[10px] text-gray-400">케이스 키</p>
          <p className="font-semibold text-slate-900">{caseRecord.id}</p>
        </div>
        <div className="rounded-md border border-gray-100 bg-gray-50 px-3 py-2">
          <p className="text-[10px] text-gray-400">연령대</p>
          <p className="font-semibold text-slate-900">{toAgeBand(caseRecord.profile.age)}</p>
        </div>
        <div className="rounded-md border border-gray-100 bg-gray-50 px-3 py-2">
          <p className="text-[10px] text-gray-400">연락처</p>
          <p className="font-semibold text-slate-900">{maskPhone(caseRecord.profile.phone)}</p>
        </div>
      </div>
    </section>
  );
}
