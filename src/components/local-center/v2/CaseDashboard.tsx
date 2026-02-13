import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  ArrowUpDown,
  Calendar,
  Download,
  ExternalLink,
  Filter,
  History,
  Info,
  MessageSquare,
  Phone,
  Search,
  UserCheck,
  Users,
} from "lucide-react";
import { cn, type StageType } from "./shared";
import {
  ALERT_FILTER_TABS,
  CASE_RECORDS,
  matchesAlertFilter,
  resolveInitialCaseFilter,
  type CaseAlertFilter,
  type CaseRecord,
} from "./caseRecords";

type StageView = Extract<StageType, "Stage 1" | "Stage 2" | "Stage 3">;

type Stage1ContactStatus = "미시도" | "시도중" | "성공" | "실패" | "재시도 필요";
type Stage1Channel = "전화" | "문자" | "보호자";
type Stage1NextAction = "재시도" | "예약 생성" | "보호자 전환" | "Stage2 전환" | "사전조건 점검" | "상태 확인";
type Stage1OwnerType = "AGENT" | "HUMAN" | "UNASSIGNED";
type Stage1PriorityTier = "L0" | "L1" | "L2" | "L3";
type Stage1StatusFilter = "ALL" | "NOT_TRIED" | "RETRY_NEEDED" | "IN_PROGRESS" | "SUCCESS";
type Stage1OwnerFilter = "ALL" | Stage1OwnerType;
type Stage1PriorityFilter = "ALL" | "L3_ONLY" | "L2_L3" | "L0_L1";

type Stage1PriorityFactor = {
  key: "SLA_URGENCY" | "CONTACT_STALENESS" | "RISK_LEVEL" | "RETRY_NEEDED" | "CHANNEL_FRICTION";
  label: string;
  weight: number;
  value: number;
  contribution: number;
};

type Stage2Classification = "AD" | "MCI" | "정상" | "보류";
type Stage2Confirmation = "임시" | "확정";
type Stage2NextPath = "Stage3" | "종료" | "추가 검사";

type Stage3TrackingStatus = "안정" | "악화" | "이탈 위험";
type Stage3Intensity = "일반" | "집중" | "긴급";

type SummaryCard = {
  label: string;
  value: string;
  color: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
};

type QuickAction = {
  key: string;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  tone: string;
  disabled?: boolean;
};

type StageRowBase = {
  kind: StageView;
  caseId: string;
  stage: StageView;
  updated: string;
  manager: string;
  source: CaseRecord;
};

type Stage1Row = StageRowBase & {
  kind: "Stage 1";
  contactStatus: Stage1ContactStatus;
  lastContactAttemptAt: string;
  channel: Stage1Channel;
  nextAction: Stage1NextAction;
  ownerType: Stage1OwnerType;
  ownerName?: string;
  ownerReason: string;
  priorityScore: number;
  priorityTier: Stage1PriorityTier;
  priorityFactors: Stage1PriorityFactor[];
  statusRank: number;
  lastContactMs: number;
  slaUrgencyScore: number;
  slaHint?: "임박" | "지연";
};

type Stage2Row = StageRowBase & {
  kind: "Stage 2";
  classification: Stage2Classification;
  rationale: string;
  confirmation: Stage2Confirmation;
  nextPath: Stage2NextPath;
  confirmationRank: number;
  classificationRank: number;
  updatedMs: number;
};

type Stage3Row = StageRowBase & {
  kind: "Stage 3";
  trackingStatus: Stage3TrackingStatus;
  recentEvent: string;
  nextEvalDate: string;
  intensity: Stage3Intensity;
  intensityRank: number;
  nextEvalMs: number;
};

type StageRow = Stage1Row | Stage2Row | Stage3Row;

type StageAdapter<T extends StageRow> = {
  operationQuestion: string;
  operationHint: string;
  sortLabel: string;
  defaultSortDescending: boolean;
  mapRow: (item: CaseRecord) => T;
  compare: (a: T, b: T) => number;
  searchBlob: (row: T) => string;
  summary: (rows: T[]) => SummaryCard[];
  quickActions: (row: T) => QuickAction[];
};

const STAGE_FILTER_OPTIONS: { label: string; value: StageView }[] = [
  { label: "Stage 1", value: "Stage 1" },
  { label: "Stage 2", value: "Stage 2" },
  { label: "Stage 3", value: "Stage 3" },
];

const STAGE1_OWNER_FILTER_OPTIONS: Array<{ label: string; value: Stage1OwnerFilter }> = [
  { label: "전체", value: "ALL" },
  { label: "Agent", value: "AGENT" },
  { label: "상담사", value: "HUMAN" },
  { label: "미배정", value: "UNASSIGNED" },
];

const STAGE1_PRIORITY_FILTER_OPTIONS: Array<{ label: string; value: Stage1PriorityFilter }> = [
  { label: "전체", value: "ALL" },
  { label: "L3만", value: "L3_ONLY" },
  { label: "L2~L3", value: "L2_L3" },
  { label: "L0~L1", value: "L0_L1" },
];

const STAGE1_STATUS_FILTER_OPTIONS: Array<{ label: string; value: Stage1StatusFilter }> = [
  { label: "전체", value: "ALL" },
  { label: "미시도", value: "NOT_TRIED" },
  { label: "재시도 필요", value: "RETRY_NEEDED" },
  { label: "시도중", value: "IN_PROGRESS" },
  { label: "성공", value: "SUCCESS" },
];

function parseUpdatedMs(updated: string) {
  const date = new Date(updated.replace(" ", "T"));
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

function formatDateTime(updated: string) {
  return updated.length > 16 ? updated.slice(0, 16) : updated;
}

function addDaysText(updated: string, days: number) {
  const base = new Date(updated.replace(" ", "T"));
  if (Number.isNaN(base.getTime())) return updated.slice(0, 10);
  base.setDate(base.getDate() + days);
  return `${base.getFullYear()}-${String(base.getMonth() + 1).padStart(2, "0")}-${String(base.getDate()).padStart(2, "0")}`;
}

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

function clamp100(value: number) {
  return Math.max(0, Math.min(100, value));
}

function priorityTierFromScore(score: number): Stage1PriorityTier {
  if (score >= 85) return "L3";
  if (score >= 70) return "L2";
  if (score >= 50) return "L1";
  return "L0";
}

function priorityTierTone(priorityTier: Stage1PriorityTier) {
  if (priorityTier === "L3") return "bg-red-50 text-red-700 border-red-200";
  if (priorityTier === "L2") return "bg-orange-50 text-orange-700 border-orange-200";
  if (priorityTier === "L1") return "bg-blue-50 text-blue-700 border-blue-200";
  return "bg-gray-100 text-gray-700 border-gray-200";
}

function interventionLevelLabel(priorityTier: Stage1PriorityTier) {
  if (priorityTier === "L3") return "연계 강화";
  if (priorityTier === "L2") return "접촉";
  if (priorityTier === "L1") return "안내";
  return "관찰";
}

function interventionLevelDetail(priorityTier: Stage1PriorityTier) {
  if (priorityTier === "L3") return "2차 연계 요청 중심";
  if (priorityTier === "L2") return "상담사 직접 연락 중심";
  if (priorityTier === "L1") return "자가점검/정보 제공 중심";
  return "기록/모니터링 중심";
}

function ownerTone(ownerType: Stage1OwnerType) {
  if (ownerType === "AGENT") return "bg-indigo-50 text-indigo-700 border-indigo-200";
  if (ownerType === "HUMAN") return "bg-emerald-50 text-emerald-700 border-emerald-200";
  return "bg-gray-100 text-gray-700 border-gray-200";
}

function ownerLabel(ownerType: Stage1OwnerType) {
  if (ownerType === "AGENT") return "Agent";
  if (ownerType === "HUMAN") return "상담사";
  return "미배정";
}

function priorityTooltipFactors(row: Stage1Row) {
  return [...row.priorityFactors].sort((a, b) => b.contribution - a.contribution).slice(0, 3);
}

function stage1StatusFilterMatch(status: Stage1ContactStatus, filter: Stage1StatusFilter) {
  if (filter === "ALL") return true;
  if (filter === "NOT_TRIED") return status === "미시도";
  if (filter === "RETRY_NEEDED") return status === "재시도 필요" || status === "실패";
  if (filter === "IN_PROGRESS") return status === "시도중";
  return status === "성공";
}

function stage1PriorityFilterMatch(priorityTier: Stage1PriorityTier, filter: Stage1PriorityFilter) {
  if (filter === "ALL") return true;
  if (filter === "L3_ONLY") return priorityTier === "L3";
  if (filter === "L2_L3") return priorityTier === "L3" || priorityTier === "L2";
  return priorityTier === "L1" || priorityTier === "L0";
}

function resolveStage1Owner(
  item: CaseRecord,
  contactStatus: Stage1ContactStatus,
  channel: Stage1Channel
): Pick<Stage1Row, "ownerType" | "ownerName" | "ownerReason"> {
  const isGateBlocked = item.quality === "경고" || item.profile.phone.trim().length === 0;
  if (isGateBlocked) {
    return {
      ownerType: "UNASSIGNED",
      ownerName: undefined,
      ownerReason: "사전 기준 점검 항목이 남아 있어 먼저 채널 검증이 필요합니다.",
    };
  }

  const isAutoGuidePreferred = item.path.includes("문자") || item.action.includes("문자");
  if (isAutoGuidePreferred) {
    return {
      ownerType: "AGENT",
      ownerName: "자동 안내 Agent",
      ownerReason: "자동안내 우선 경로로 접수되어 자동 발송/상태 확인 흐름이 적용됩니다.",
    };
  }

  const requiresHumanFirst =
    item.risk === "고" ||
    item.alertTags.includes("이탈 위험") ||
    (channel === "보호자" && (contactStatus === "재시도 필요" || contactStatus === "실패"));

  if (requiresHumanFirst) {
    return {
      ownerType: "HUMAN",
      ownerName: item.manager,
      ownerReason: "채널 제약 또는 위험 신호가 있어 상담사 우선 접촉이 필요합니다.",
    };
  }

  return {
    ownerType: "HUMAN",
    ownerName: item.manager,
    ownerReason: "기본 운영 기준에서 상담사 직접 확인이 필요한 케이스입니다.",
  };
}

function computeStage1Priority(
  item: CaseRecord,
  contactStatus: Stage1ContactStatus,
  channel: Stage1Channel,
  lastContactMs: number
): Pick<Stage1Row, "priorityScore" | "priorityTier" | "priorityFactors" | "slaUrgencyScore"> {
  const hasSlaAlert = item.alertTags.includes("SLA 임박");
  const slaUrgency =
    item.status === "임박" || item.status === "지연" || hasSlaAlert
      ? 1
      : item.status === "진행중"
        ? 0.5
        : item.status === "대기"
          ? 0.35
          : item.status === "완료"
            ? 0.2
            : 0;

  const hoursSinceLastContact = lastContactMs > 0 ? (Date.now() - lastContactMs) / (1000 * 60 * 60) : 0;
  const contactStaleness =
    contactStatus === "미시도"
      ? 0.6
      : hoursSinceLastContact >= 48
        ? 1
        : hoursSinceLastContact >= 24
          ? 0.85
          : hoursSinceLastContact >= 12
            ? 0.55
            : hoursSinceLastContact >= 6
              ? 0.3
              : hoursSinceLastContact >= 3
                ? 0.2
                : 0.1;

  const riskBase = item.risk === "고" ? 1 : item.risk === "중" ? 0.6 : 0.25;
  const riskBoost = item.alertTags.includes("High MCI") || item.alertTags.includes("이탈 위험") ? 0.2 : 0;
  const riskLevel = clamp01(riskBase + riskBoost);

  const retryNeeded =
    contactStatus === "재시도 필요" || contactStatus === "실패"
      ? 1
      : contactStatus === "미시도"
        ? 0.6
        : contactStatus === "시도중"
          ? 0.2
          : 0;

  const channelFrictionBase =
    item.quality === "경고"
      ? 0.65
      : item.quality === "주의"
        ? 0.35
        : 0.1;
  const channelFriction = clamp01(
    channelFrictionBase +
      (channel === "보호자" ? 0.2 : 0) +
      (!item.profile.guardianPhone && (contactStatus === "실패" || contactStatus === "재시도 필요") ? 0.2 : 0)
  );

  const factors: Stage1PriorityFactor[] = [
    { key: "SLA_URGENCY", label: "SLA 임박도", weight: 40, value: clamp01(slaUrgency), contribution: 0 },
    { key: "CONTACT_STALENESS", label: "접촉 공백", weight: 25, value: clamp01(contactStaleness), contribution: 0 },
    { key: "RISK_LEVEL", label: "위험 신호", weight: 20, value: clamp01(riskLevel), contribution: 0 },
    { key: "RETRY_NEEDED", label: "재시도 필요", weight: 10, value: clamp01(retryNeeded), contribution: 0 },
    { key: "CHANNEL_FRICTION", label: "채널 제약", weight: 5, value: clamp01(channelFriction), contribution: 0 },
  ].map((factor) => ({
    ...factor,
    contribution: Number((factor.weight * factor.value).toFixed(1)),
  }));

  const score = Math.round(
    clamp100(
      factors.reduce((sum, factor) => sum + factor.contribution, 0)
    )
  );

  return {
    priorityScore: score,
    priorityTier: priorityTierFromScore(score),
    priorityFactors: factors,
    slaUrgencyScore: clamp01(slaUrgency),
  };
}

function stage1ContactTone(status: Stage1ContactStatus) {
  if (status === "재시도 필요") return "bg-red-50 text-red-700 border-red-200";
  if (status === "실패") return "bg-orange-50 text-orange-700 border-orange-200";
  if (status === "시도중") return "bg-blue-50 text-blue-700 border-blue-200";
  if (status === "성공") return "bg-emerald-50 text-emerald-700 border-emerald-200";
  return "bg-gray-100 text-gray-700 border-gray-200";
}

function stage1ChannelTone(channel: Stage1Channel) {
  if (channel === "보호자") return "bg-violet-50 text-violet-700 border-violet-200";
  if (channel === "문자") return "bg-blue-50 text-blue-700 border-blue-200";
  return "bg-emerald-50 text-emerald-700 border-emerald-200";
}

function stage1NextActionTone(action: Stage1NextAction) {
  if (action === "사전조건 점검") return "bg-gray-100 text-gray-700 border-gray-200";
  if (action === "상태 확인") return "bg-indigo-50 text-indigo-700 border-indigo-200";
  if (action === "Stage2 전환") return "bg-indigo-50 text-indigo-700 border-indigo-200";
  if (action === "보호자 전환") return "bg-violet-50 text-violet-700 border-violet-200";
  if (action === "예약 생성") return "bg-blue-50 text-blue-700 border-blue-200";
  return "bg-orange-50 text-orange-700 border-orange-200";
}

function stage2ClassificationTone(classification: Stage2Classification) {
  if (classification === "AD") return "bg-red-50 text-red-700 border-red-200";
  if (classification === "MCI") return "bg-orange-50 text-orange-700 border-orange-200";
  if (classification === "정상") return "bg-emerald-50 text-emerald-700 border-emerald-200";
  return "bg-gray-100 text-gray-700 border-gray-200";
}

function stage2ConfirmationTone(confirmation: Stage2Confirmation) {
  if (confirmation === "확정") return "bg-blue-50 text-blue-700 border-blue-200";
  return "bg-amber-50 text-amber-700 border-amber-200";
}

function stage2PathTone(nextPath: Stage2NextPath) {
  if (nextPath === "Stage3") return "bg-violet-50 text-violet-700 border-violet-200";
  if (nextPath === "종료") return "bg-emerald-50 text-emerald-700 border-emerald-200";
  return "bg-orange-50 text-orange-700 border-orange-200";
}

function stage3TrackingTone(status: Stage3TrackingStatus) {
  if (status === "이탈 위험") return "bg-red-50 text-red-700 border-red-200";
  if (status === "악화") return "bg-orange-50 text-orange-700 border-orange-200";
  return "bg-emerald-50 text-emerald-700 border-emerald-200";
}

function stage3IntensityTone(intensity: Stage3Intensity) {
  if (intensity === "긴급") return "bg-red-50 text-red-700 border-red-200";
  if (intensity === "집중") return "bg-orange-50 text-orange-700 border-orange-200";
  return "bg-blue-50 text-blue-700 border-blue-200";
}

function deriveStage1Row(item: CaseRecord): Stage1Row {
  const contactStatus: Stage1ContactStatus =
    item.status === "완료"
      ? "성공"
      : item.status === "진행중"
        ? "시도중"
        : item.status === "지연"
          ? "실패"
          : item.status === "임박"
            ? "재시도 필요"
            : "미시도";

  const channel: Stage1Channel =
    item.action.includes("문자")
      ? "문자"
      : item.action.includes("보호자") || ((contactStatus === "실패" || contactStatus === "재시도 필요") && Boolean(item.profile.guardianPhone))
        ? "보호자"
        : "전화";

  const baseNextAction: Stage1NextAction =
    contactStatus === "성공" && (item.risk === "고" || item.alertTags.includes("재평가 필요"))
      ? "Stage2 전환"
      : contactStatus === "성공" || contactStatus === "시도중"
        ? "예약 생성"
        : channel !== "보호자" && Boolean(item.profile.guardianPhone)
          ? "보호자 전환"
          : "재시도";

  const statusRank: Record<Stage1ContactStatus, number> = {
    "재시도 필요": 5,
    실패: 4,
    미시도: 3,
    시도중: 2,
    성공: 1,
  };

  const lastContactMs = parseUpdatedMs(item.updated);
  const owner = resolveStage1Owner(item, contactStatus, channel);
  const priority = computeStage1Priority(item, contactStatus, channel, lastContactMs);

  const nextAction: Stage1NextAction =
    owner.ownerType === "UNASSIGNED"
      ? "사전조건 점검"
      : owner.ownerType === "AGENT" && (priority.priorityTier === "L3" || priority.priorityTier === "L2")
        ? "상태 확인"
        : baseNextAction;

  return {
    kind: "Stage 1",
    stage: "Stage 1",
    caseId: item.id,
    manager: item.manager,
    updated: item.updated,
    source: item,
    contactStatus,
    lastContactAttemptAt: formatDateTime(item.updated),
    channel,
    nextAction,
    ownerType: owner.ownerType,
    ownerName: owner.ownerName,
    ownerReason: owner.ownerReason,
    priorityScore: priority.priorityScore,
    priorityTier: priority.priorityTier,
    priorityFactors: priority.priorityFactors,
    statusRank: statusRank[contactStatus],
    lastContactMs,
    slaUrgencyScore: priority.slaUrgencyScore,
    slaHint: item.status === "임박" || item.status === "지연" ? item.status : undefined,
  };
}

function deriveStage2Row(item: CaseRecord): Stage2Row {
  const classification: Stage2Classification =
    item.path.includes("High MCI") || (item.risk === "고" && item.quality === "경고")
      ? "AD"
      : item.path.includes("MCI") || item.alertTags.includes("MCI 미등록")
        ? "MCI"
        : item.risk === "저" && item.status === "완료"
          ? "정상"
          : "보류";

  const confirmation: Stage2Confirmation = item.status === "완료" ? "확정" : "임시";

  const nextPath: Stage2NextPath =
    classification === "보류" || item.quality === "경고"
      ? "추가 검사"
      : classification === "정상"
        ? "종료"
        : "Stage3";

  const rationaleParts = [item.path];
  if (item.alertTags.length > 0) rationaleParts.push(`신호 ${item.alertTags.slice(0, 2).join(", ")}`);
  if (item.quality !== "양호") rationaleParts.push(`품질 ${item.quality}`);

  const classificationRank: Record<Stage2Classification, number> = {
    AD: 4,
    MCI: 3,
    보류: 2,
    정상: 1,
  };

  return {
    kind: "Stage 2",
    stage: "Stage 2",
    caseId: item.id,
    manager: item.manager,
    updated: item.updated,
    source: item,
    classification,
    rationale: rationaleParts.join(" · "),
    confirmation,
    nextPath,
    confirmationRank: confirmation === "임시" ? 2 : 1,
    classificationRank: classificationRank[classification],
    updatedMs: parseUpdatedMs(item.updated),
  };
}

function deriveStage3Row(item: CaseRecord): Stage3Row {
  const trackingStatus: Stage3TrackingStatus =
    item.alertTags.includes("이탈 위험") || item.status === "지연"
      ? "이탈 위험"
      : item.risk === "고" || item.status === "임박"
        ? "악화"
        : "안정";

  const intensity: Stage3Intensity =
    trackingStatus === "이탈 위험"
      ? "긴급"
      : trackingStatus === "악화"
        ? "집중"
        : "일반";

  const nextEvalDate = addDaysText(item.updated, trackingStatus === "안정" ? 30 : trackingStatus === "악화" ? 14 : 7);
  const nextEvalMs = new Date(`${nextEvalDate}T09:00:00`).getTime();

  return {
    kind: "Stage 3",
    stage: "Stage 3",
    caseId: item.id,
    manager: item.manager,
    updated: item.updated,
    source: item,
    trackingStatus,
    recentEvent: item.action,
    nextEvalDate,
    intensity,
    intensityRank: intensity === "긴급" ? 3 : intensity === "집중" ? 2 : 1,
    nextEvalMs,
  };
}

const STAGE_VIEW_ADAPTERS: Record<StageView, StageAdapter<StageRow>> = {
  "Stage 1": {
    operationQuestion: "이 케이스는 접촉이 되었는가? 안 되었는가? 다음 행정은 무엇인가?",
    operationHint: "Stage 1은 선별/접촉 관리 관점으로만 표시됩니다.",
    sortLabel: "개입 레벨 우선순위",
    defaultSortDescending: true,
    mapRow: (item) => deriveStage1Row(item),
    compare: (a, b) => {
      const rowA = a as Stage1Row;
      const rowB = b as Stage1Row;
      if (rowB.priorityScore !== rowA.priorityScore) return rowB.priorityScore - rowA.priorityScore;
      if (rowB.slaUrgencyScore !== rowA.slaUrgencyScore) return rowB.slaUrgencyScore - rowA.slaUrgencyScore;
      if (rowA.lastContactMs !== rowB.lastContactMs) return rowA.lastContactMs - rowB.lastContactMs;
      return rowB.statusRank - rowA.statusRank;
    },
    searchBlob: (row) => {
      const target = row as Stage1Row;
      return [
        target.caseId,
        target.contactStatus,
        target.channel,
        target.nextAction,
        target.manager,
        ownerLabel(target.ownerType),
        target.ownerName ?? "",
        target.priorityTier,
        String(target.priorityScore),
      ].join(" ");
    },
    summary: (rows) => {
      const stageRows = rows as Stage1Row[];
      return [
        { label: "총 케이스", value: stageRows.length.toLocaleString(), color: "text-slate-900", icon: Users },
        {
          label: "접촉 미완료",
          value: stageRows.filter((row) => row.contactStatus !== "성공").length.toLocaleString(),
          color: "text-blue-600",
          icon: Phone,
        },
        {
          label: "재시도 필요",
          value: stageRows.filter((row) => row.contactStatus === "재시도 필요" || row.contactStatus === "실패").length.toLocaleString(),
          color: "text-red-600",
          icon: AlertCircle,
        },
        {
          label: "예약 생성 대기",
          value: stageRows.filter((row) => row.nextAction === "예약 생성").length.toLocaleString(),
          color: "text-indigo-600",
          icon: Calendar,
        },
        {
          label: "Stage2 전환 후보",
          value: stageRows.filter((row) => row.nextAction === "Stage2 전환").length.toLocaleString(),
          color: "text-violet-600",
          icon: ExternalLink,
        },
      ];
    },
    quickActions: (row) => {
      const stageRow = row as Stage1Row;
      if (stageRow.ownerType === "UNASSIGNED") {
        return [
          { key: "precheck", label: "사전조건 점검", icon: Filter, tone: "text-gray-700 bg-gray-100 border-gray-200 hover:bg-gray-200" },
          { key: "verify-channel", label: "채널 점검", icon: MessageSquare, tone: "text-blue-700 bg-blue-50 border-blue-100 hover:bg-blue-100" },
        ];
      }

      if (stageRow.ownerType === "AGENT") {
        const urgent = stageRow.priorityTier === "L3" || stageRow.priorityTier === "L2";
        return [
          {
            key: "agent-run",
            label: urgent ? "즉시 Agent 실행" : "Agent 상태 확인",
            icon: MessageSquare,
            tone: "text-indigo-700 bg-indigo-50 border-indigo-100 hover:bg-indigo-100",
          },
          {
            key: "agent-status",
            label: "상태 확인",
            icon: History,
            tone: "text-blue-700 bg-blue-50 border-blue-100 hover:bg-blue-100",
          },
        ];
      }

      return [
        { key: "call", label: "전화", icon: Phone, tone: "text-emerald-700 bg-emerald-50 border-emerald-100 hover:bg-emerald-100" },
        {
          key: "guardian",
          label: "보호자 전환",
          icon: UserCheck,
          tone: stageRow.source.profile.guardianPhone
            ? "text-violet-700 bg-violet-50 border-violet-100 hover:bg-violet-100"
            : "text-gray-400 bg-gray-100 border-gray-200",
          disabled: !stageRow.source.profile.guardianPhone,
        },
        { key: "reserve", label: "예약 생성", icon: Calendar, tone: "text-blue-700 bg-blue-50 border-blue-100 hover:bg-blue-100" },
      ];
    },
  },
  "Stage 2": {
    operationQuestion: "이 케이스는 어떤 상태로 분류되었고, 근거는 무엇인가?",
    operationHint: "Stage 2는 분류 판단 관점으로만 표시됩니다.",
    sortLabel: "분류 확인 우선순위",
    defaultSortDescending: true,
    mapRow: (item) => deriveStage2Row(item),
    compare: (a, b) => {
      const rowA = a as Stage2Row;
      const rowB = b as Stage2Row;
      if (rowB.confirmationRank !== rowA.confirmationRank) return rowB.confirmationRank - rowA.confirmationRank;
      if (rowB.classificationRank !== rowA.classificationRank) return rowB.classificationRank - rowA.classificationRank;
      return rowB.updatedMs - rowA.updatedMs;
    },
    searchBlob: (row) => {
      const target = row as Stage2Row;
      return [target.caseId, target.classification, target.confirmation, target.nextPath, target.rationale, target.manager].join(" ");
    },
    summary: (rows) => {
      const stageRows = rows as Stage2Row[];
      return [
        { label: "총 케이스", value: stageRows.length.toLocaleString(), color: "text-slate-900", icon: Users },
        {
          label: "임시 분류",
          value: stageRows.filter((row) => row.confirmation === "임시").length.toLocaleString(),
          color: "text-amber-600",
          icon: AlertCircle,
        },
        {
          label: "확정 분류",
          value: stageRows.filter((row) => row.confirmation === "확정").length.toLocaleString(),
          color: "text-blue-600",
          icon: UserCheck,
        },
        {
          label: "Stage3 경로",
          value: stageRows.filter((row) => row.nextPath === "Stage3").length.toLocaleString(),
          color: "text-violet-600",
          icon: ExternalLink,
        },
        {
          label: "추가 검사 경로",
          value: stageRows.filter((row) => row.nextPath === "추가 검사").length.toLocaleString(),
          color: "text-orange-600",
          icon: History,
        },
      ];
    },
    quickActions: () => [
      { key: "edit-classification", label: "분류 수정", icon: Filter, tone: "text-indigo-700 bg-indigo-50 border-indigo-100 hover:bg-indigo-100" },
      { key: "review-rationale", label: "근거 확인", icon: History, tone: "text-blue-700 bg-blue-50 border-blue-100 hover:bg-blue-100" },
      { key: "move-stage3", label: "Stage3 전환", icon: ExternalLink, tone: "text-violet-700 bg-violet-50 border-violet-100 hover:bg-violet-100" },
    ],
  },
  "Stage 3": {
    operationQuestion: "상태가 유지되는가, 악화되는가, 이탈 위험이 있는가?",
    operationHint: "Stage 3는 추적/관리 관점으로만 표시됩니다.",
    sortLabel: "관리 집중도 우선순위",
    defaultSortDescending: true,
    mapRow: (item) => deriveStage3Row(item),
    compare: (a, b) => {
      const rowA = a as Stage3Row;
      const rowB = b as Stage3Row;
      if (rowB.intensityRank !== rowA.intensityRank) return rowB.intensityRank - rowA.intensityRank;
      return rowA.nextEvalMs - rowB.nextEvalMs;
    },
    searchBlob: (row) => {
      const target = row as Stage3Row;
      return [target.caseId, target.trackingStatus, target.intensity, target.recentEvent, target.nextEvalDate, target.manager].join(" ");
    },
    summary: (rows) => {
      const stageRows = rows as Stage3Row[];
      return [
        { label: "총 케이스", value: stageRows.length.toLocaleString(), color: "text-slate-900", icon: Users },
        {
          label: "이탈 위험",
          value: stageRows.filter((row) => row.trackingStatus === "이탈 위험").length.toLocaleString(),
          color: "text-red-600",
          icon: AlertCircle,
        },
        {
          label: "악화",
          value: stageRows.filter((row) => row.trackingStatus === "악화").length.toLocaleString(),
          color: "text-orange-600",
          icon: History,
        },
        {
          label: "긴급 집중도",
          value: stageRows.filter((row) => row.intensity === "긴급").length.toLocaleString(),
          color: "text-red-600",
          icon: UserCheck,
        },
        {
          label: "7일 내 재평가",
          value: stageRows.filter((row) => row.nextEvalMs - Date.now() <= 7 * 24 * 60 * 60 * 1000).length.toLocaleString(),
          color: "text-blue-600",
          icon: Calendar,
        },
      ];
    },
    quickActions: () => [
      { key: "add-tracking", label: "추적 기록 추가", icon: History, tone: "text-blue-700 bg-blue-50 border-blue-100 hover:bg-blue-100" },
      { key: "book-recheck", label: "재평가 예약", icon: Calendar, tone: "text-orange-700 bg-orange-50 border-orange-100 hover:bg-orange-100" },
      { key: "adjust-intensity", label: "관리 강도 조정", icon: UserCheck, tone: "text-violet-700 bg-violet-50 border-violet-100 hover:bg-violet-100" },
    ],
  },
};

export function CaseDashboard({
  onSelectCase,
  initialFilter,
}: {
  onSelectCase: (id: string, stage: StageType) => void;
  initialFilter: string | null;
}) {
  const [activeFilterTab, setActiveFilterTab] = useState<CaseAlertFilter>("전체");
  const [stageFilter, setStageFilter] = useState<StageView>("Stage 1");
  const [searchKeyword, setSearchKeyword] = useState("");
  const [ownerFilter, setOwnerFilter] = useState<Stage1OwnerFilter>("ALL");
  const [priorityFilter, setPriorityFilter] = useState<Stage1PriorityFilter>("ALL");
  const [statusFilter, setStatusFilter] = useState<Stage1StatusFilter>("ALL");
  const [isOpsFilterOpen, setIsOpsFilterOpen] = useState(false);
  const [sortDescending, setSortDescending] = useState(true);
  const [hoveredCaseId, setHoveredCaseId] = useState<string | null>(null);
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const opsFilterRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const resolved = resolveInitialCaseFilter(initialFilter);
    setActiveFilterTab(resolved.alertFilter);
    setStageFilter(resolved.stageFilter === "all" ? "Stage 1" : resolved.stageFilter);
  }, [initialFilter]);

  const adapter = useMemo(() => STAGE_VIEW_ADAPTERS[stageFilter], [stageFilter]);

  useEffect(() => {
    setSortDescending(adapter.defaultSortDescending);
  }, [adapter.defaultSortDescending, stageFilter]);

  useEffect(() => {
    if (stageFilter !== "Stage 1") setIsOpsFilterOpen(false);
  }, [stageFilter]);

  useEffect(() => {
    if (!isOpsFilterOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (!opsFilterRef.current) return;
      if (!opsFilterRef.current.contains(event.target as Node)) {
        setIsOpsFilterOpen(false);
      }
    };

    window.addEventListener("pointerdown", handlePointerDown);
    return () => window.removeEventListener("pointerdown", handlePointerDown);
  }, [isOpsFilterOpen]);

  const scopedRows = useMemo(() => {
    const q = searchKeyword.trim().toLowerCase();
    return CASE_RECORDS
      .filter((item) => item.stage === stageFilter)
      .map((item) => {
        const row = adapter.mapRow(item);
        return {
          item,
          row,
          searchBlob: adapter.searchBlob(row).toLowerCase(),
        };
      })
      .filter((entry) => (q ? entry.searchBlob.includes(q) : true));
  }, [adapter, searchKeyword, stageFilter]);

  const alertTabCounts = useMemo(() => {
    const counts = Object.fromEntries(ALERT_FILTER_TABS.map((tab) => [tab, 0])) as Record<CaseAlertFilter, number>;
    counts["전체"] = scopedRows.length;
    for (const tab of ALERT_FILTER_TABS) {
      if (tab === "전체") continue;
      counts[tab] = scopedRows.reduce((total, entry) => total + (matchesAlertFilter(entry.item, tab) ? 1 : 0), 0);
    }
    return counts;
  }, [scopedRows]);

  const stageCounts = useMemo(() => {
    const counts: Record<StageView, number> = { "Stage 1": 0, "Stage 2": 0, "Stage 3": 0 };
    for (const item of CASE_RECORDS) {
      if (item.stage === "Stage 1" || item.stage === "Stage 2" || item.stage === "Stage 3") {
        counts[item.stage] += 1;
      }
    }
    return counts;
  }, []);

  const stageRows = useMemo(() => {
    const mapped = scopedRows
      .filter((entry) => matchesAlertFilter(entry.item, activeFilterTab))
      .map((entry) => entry.row);

    const filtered =
      stageFilter === "Stage 1"
        ? (mapped as Stage1Row[]).filter((row) => {
            const ownerMatched = ownerFilter === "ALL" ? true : row.ownerType === ownerFilter;
            const priorityMatched = stage1PriorityFilterMatch(row.priorityTier, priorityFilter);
            const statusMatched = stage1StatusFilterMatch(row.contactStatus, statusFilter);
            return ownerMatched && priorityMatched && statusMatched;
          })
        : mapped;

    const sorted = [...filtered].sort(adapter.compare);
    if (!sortDescending) sorted.reverse();
    return sorted;
  }, [activeFilterTab, adapter, ownerFilter, priorityFilter, scopedRows, sortDescending, stageFilter, statusFilter]);

  const summary = useMemo(() => adapter.summary(stageRows), [adapter, stageRows]);
  const hoveredRow = useMemo(
    () => stageRows.find((row) => row.caseId === hoveredCaseId) ?? null,
    [hoveredCaseId, stageRows]
  );

  const hasStage1OpsFilter = ownerFilter !== "ALL" || priorityFilter !== "ALL" || statusFilter !== "ALL";
  const activeOpsFilterCount = Number(ownerFilter !== "ALL") + Number(priorityFilter !== "ALL") + Number(statusFilter !== "ALL");
  const hasActiveFilter =
    activeFilterTab !== "전체" || searchKeyword.trim().length > 0 || (stageFilter === "Stage 1" && hasStage1OpsFilter);

  const resetOpsFilters = () => {
    setOwnerFilter("ALL");
    setPriorityFilter("ALL");
    setStatusFilter("ALL");
  };

  const resetFilters = () => {
    setActiveFilterTab("전체");
    setSearchKeyword("");
    resetOpsFilters();
  };

  const clearHoverTimer = () => {
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }
  };

  const openHoverPanel = (caseId: string, delayMs = 0) => {
    clearHoverTimer();
    if (delayMs <= 0) {
      setHoveredCaseId(caseId);
      return;
    }
    hoverTimerRef.current = setTimeout(() => {
      setHoveredCaseId(caseId);
      hoverTimerRef.current = null;
    }, delayMs);
  };

  const closeHoverPanel = (delayMs = 140) => {
    clearHoverTimer();
    if (!hoveredCaseId) return;
    hoverTimerRef.current = setTimeout(() => {
      setHoveredCaseId(null);
      hoverTimerRef.current = null;
    }, delayMs);
  };

  useEffect(() => () => clearHoverTimer(), []);

  return (
    <div className="h-full flex flex-col gap-6">
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        {summary.map((item, idx) => (
          <div key={idx} className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{item.label}</p>
              <p className={cn("text-xl font-bold mt-1", item.color)}>{item.value}</p>
            </div>
            <div className={cn("p-2 rounded-lg bg-gray-50", item.color)}>
              <item.icon size={20} className="opacity-20" />
            </div>
          </div>
        ))}
      </div>

      <div className="flex-1 flex flex-col min-h-0">
        <div className="flex-1 bg-white rounded-xl border border-gray-200 shadow-sm flex flex-col overflow-hidden">
          <div className="p-4 border-b border-gray-100 bg-gray-50/30 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex gap-2 overflow-x-auto pb-1 md:pb-0 scrollbar-hide">
                {ALERT_FILTER_TABS.map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveFilterTab(tab)}
                    className={cn(
                      "group whitespace-nowrap rounded-xl border px-4 py-2 text-[12px] font-bold transition-all duration-200 ease-out active:scale-[0.98]",
                      activeFilterTab === tab
                        ? "border-blue-600 bg-gradient-to-b from-blue-500 to-blue-700 text-white shadow-[0_10px_20px_-12px_rgba(37,99,235,0.9)]"
                        : "border-gray-200 bg-white text-gray-600 shadow-[0_2px_8px_rgba(15,23,42,0.08)] hover:-translate-y-0.5 hover:scale-[1.03] hover:border-blue-200 hover:text-blue-700 hover:shadow-[0_12px_24px_-16px_rgba(37,99,235,0.75)]"
                    )}
                  >
                    {tab}
                    <span
                      className={cn(
                        "ml-1 text-[10px] font-semibold",
                        activeFilterTab === tab ? "text-blue-100" : "text-gray-400 transition-colors group-hover:text-blue-500"
                      )}
                    >
                      ({alertTabCounts[tab].toLocaleString()})
                    </span>
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setSortDescending((prev) => !prev)}
                  className="flex items-center gap-1 text-[10px] font-bold text-gray-600 bg-white px-2 py-1 border border-gray-200 rounded"
                >
                  {adapter.sortLabel}
                  <ArrowUpDown size={10} />
                </button>
                <button className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg border border-gray-200" title="내보내기">
                  <Download size={16} />
                </button>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-gray-500 bg-white border border-gray-200 rounded px-2 py-1">
                <Filter size={10} />
                Stage 선택
              </span>
              {STAGE_FILTER_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  onClick={() => setStageFilter(option.value)}
                  className={cn(
                    "group rounded-lg border px-3.5 py-1.5 text-[12px] font-semibold transition-all duration-200 ease-out active:scale-[0.98]",
                    stageFilter === option.value
                      ? "border-[#163b6f] bg-gradient-to-b from-[#244f87] to-[#163b6f] text-white shadow-[0_8px_18px_-12px_rgba(22,59,111,0.9)]"
                      : "border-gray-200 bg-white text-gray-600 shadow-[0_1px_6px_rgba(15,23,42,0.06)] hover:-translate-y-0.5 hover:scale-[1.03] hover:border-[#9eb5d8] hover:text-[#163b6f] hover:shadow-[0_10px_20px_-14px_rgba(30,64,175,0.6)]"
                  )}
                >
                  {option.label}
                  <span
                    className={cn(
                      "ml-1 text-[10px] font-semibold",
                      stageFilter === option.value ? "text-blue-100" : "text-gray-400 transition-colors group-hover:text-[#295a9d]"
                    )}
                  >
                    ({stageCounts[option.value].toLocaleString()})
                  </span>
                </button>
              ))}

              {stageFilter === "Stage 1" && (
                <div ref={opsFilterRef} className="relative">
                  <button
                    type="button"
                    onClick={() => setIsOpsFilterOpen((prev) => !prev)}
                    aria-expanded={isOpsFilterOpen}
                    className={cn(
                      "inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-[11px] font-semibold transition-colors",
                      hasStage1OpsFilter
                        ? "border-blue-200 bg-blue-50 text-blue-700"
                        : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
                    )}
                  >
                    <Filter size={12} />
                    운영 필터
                    {activeOpsFilterCount > 0 && (
                      <span className="rounded bg-blue-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
                        {activeOpsFilterCount}
                      </span>
                    )}
                  </button>

                  {isOpsFilterOpen && (
                    <div className="absolute left-0 top-[calc(100%+8px)] z-40 w-[360px] rounded-xl border border-gray-200 bg-white p-3 shadow-xl">
                      <div className="space-y-3">
                        <div>
                          <p className="mb-1 text-[11px] font-bold text-gray-600">담당</p>
                          <div className="flex flex-wrap gap-1">
                            {STAGE1_OWNER_FILTER_OPTIONS.map((option) => (
                              <button
                                key={option.value}
                                onClick={() => setOwnerFilter(option.value)}
                                className={cn(
                                  "rounded-md border px-2 py-1 text-[11px] font-semibold transition-colors",
                                  ownerFilter === option.value
                                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                    : "border-gray-200 text-gray-600 hover:bg-gray-50"
                                )}
                              >
                                {option.label}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div>
                          <p className="mb-1 text-[11px] font-bold text-gray-600">개입 레벨</p>
                          <div className="flex flex-wrap gap-1">
                            {STAGE1_PRIORITY_FILTER_OPTIONS.map((option) => (
                              <button
                                key={option.value}
                                onClick={() => setPriorityFilter(option.value)}
                                className={cn(
                                  "rounded-md border px-2 py-1 text-[11px] font-semibold transition-colors",
                                  priorityFilter === option.value
                                    ? "border-orange-200 bg-orange-50 text-orange-700"
                                    : "border-gray-200 text-gray-600 hover:bg-gray-50"
                                )}
                              >
                                {option.label}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div>
                          <p className="mb-1 text-[11px] font-bold text-gray-600">상태</p>
                          <div className="flex flex-wrap gap-1">
                            {STAGE1_STATUS_FILTER_OPTIONS.map((option) => (
                              <button
                                key={option.value}
                                onClick={() => setStatusFilter(option.value)}
                                className={cn(
                                  "rounded-md border px-2 py-1 text-[11px] font-semibold transition-colors",
                                  statusFilter === option.value
                                    ? "border-blue-200 bg-blue-50 text-blue-700"
                                    : "border-gray-200 text-gray-600 hover:bg-gray-50"
                                )}
                              >
                                {option.label}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="flex items-center justify-between border-t border-gray-100 pt-2">
                          <span className="text-[10px] text-gray-500">필터가 즉시 테이블에 반영됩니다.</span>
                          <button
                            type="button"
                            onClick={resetOpsFilters}
                            className="text-[11px] font-semibold text-blue-600 hover:text-blue-700"
                          >
                            운영 필터 초기화
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {stageFilter === "Stage 1" && (
                <span className="text-[10px] text-gray-500">
                  개입 레벨/담당/상태를 한 번에 설정
                </span>
              )}

              <div className="group relative">
                <span className="inline-flex h-7 w-7 cursor-help items-center justify-center rounded-lg border border-blue-100 bg-blue-50 text-blue-700 shadow-sm transition-colors hover:bg-blue-100">
                  <Info size={13} />
                </span>
                <div className="pointer-events-none invisible absolute left-0 top-full z-30 mt-2 w-[320px] rounded-lg border border-blue-100 bg-white p-3 opacity-0 shadow-xl transition-all duration-150 group-hover:visible group-hover:opacity-100">
                  <p className="text-[11px] font-bold text-blue-800">운영 질문</p>
                  <p className="mt-1 text-xs text-gray-800">{adapter.operationQuestion}</p>
                  <p className="mt-1 text-[11px] text-gray-500">{adapter.operationHint}</p>
                </div>
              </div>

              <div className="ml-auto flex w-full md:w-[280px] items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-1.5">
                <Search size={14} className="text-gray-400" />
                <input
                  value={searchKeyword}
                  onChange={(e) => setSearchKeyword(e.target.value)}
                  placeholder="케이스ID/담당/상태/개입 레벨 검색"
                  className="w-full bg-transparent text-xs text-gray-700 outline-none placeholder:text-gray-400"
                />
              </div>

              {hasActiveFilter && (
                <button onClick={resetFilters} className="text-[11px] font-semibold text-blue-600 hover:text-blue-700">
                  필터 초기화
                </button>
              )}
            </div>

          </div>

          <div className="flex-1 overflow-auto">
            <table className="w-full text-left border-collapse">
              {stageFilter === "Stage 1" && (
                <>
                  <thead className="sticky top-0 bg-white z-20 shadow-sm">
                    <tr className="bg-gray-50/80 text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                      <th className="px-4 py-3 border-b border-gray-100">케이스 키</th>
                      <th className="px-4 py-3 border-b border-gray-100">담당</th>
                      <th className="px-4 py-3 border-b border-gray-100">개입 레벨</th>
                      <th className="px-4 py-3 border-b border-gray-100">접촉 상태</th>
                      <th className="px-4 py-3 border-b border-gray-100">마지막 접촉 시도</th>
                      <th className="px-4 py-3 border-b border-gray-100">접촉 채널</th>
                      <th className="px-4 py-3 border-b border-gray-100">다음 액션</th>
                    </tr>
                  </thead>
                  <tbody className="text-sm">
                    {stageRows.length === 0 && (
                      <tr>
                        <td colSpan={7} className="px-4 py-16 text-center text-xs text-gray-400">
                          조건에 맞는 케이스가 없습니다.
                        </td>
                      </tr>
                    )}
                    {(stageRows as Stage1Row[]).map((row) => {
                      return (
                        <tr
                          key={row.caseId}
                          data-case-id={row.caseId}
                          className={cn(
                            "cursor-pointer transition-colors border-b border-gray-50 last:border-0",
                            hoveredCaseId === row.caseId ? "bg-blue-50/60" : "hover:bg-gray-50/70"
                          )}
                          onClick={() => onSelectCase(row.caseId, row.stage)}
                          onMouseEnter={() => openHoverPanel(row.caseId, 30)}
                          onMouseLeave={() => closeHoverPanel(150)}
                        >
                          <td className="px-4 py-3.5">
                            <p className="font-mono font-medium text-gray-900">{row.caseId}</p>
                            <p className="text-[10px] text-gray-400">담당자 {row.manager}</p>
                          </td>
                          <td className="px-4 py-3.5">
                            <div className="group relative inline-flex flex-col">
                              <span className={cn("inline-flex w-fit rounded border px-2 py-0.5 text-[10px] font-semibold", ownerTone(row.ownerType))}>
                                {ownerLabel(row.ownerType)}
                              </span>
                              <p className="mt-1 text-[10px] text-gray-500">{row.ownerName ?? "배정 필요"}</p>
                              <div className="pointer-events-none invisible absolute left-0 top-[calc(100%+6px)] z-20 w-56 rounded-lg border border-gray-200 bg-white p-2 text-[11px] text-gray-700 opacity-0 shadow-xl transition-all duration-150 group-hover:visible group-hover:opacity-100">
                                {row.ownerReason}
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3.5">
                            <div className="group relative inline-flex flex-col">
                              <span className={cn("inline-flex w-fit rounded border px-2 py-0.5 text-[10px] font-semibold", priorityTierTone(row.priorityTier))}>
                                {row.priorityTier} · {interventionLevelLabel(row.priorityTier)}
                              </span>
                              <p className="mt-1 text-[10px] text-gray-500">{interventionLevelDetail(row.priorityTier)} · 점수 {row.priorityScore}</p>
                              <div className="pointer-events-none invisible absolute left-0 top-[calc(100%+6px)] z-20 w-60 rounded-lg border border-gray-200 bg-white p-2 text-[11px] text-gray-700 opacity-0 shadow-xl transition-all duration-150 group-hover:visible group-hover:opacity-100">
                                <p className="font-semibold text-gray-800">개입 레벨 근거</p>
                                {priorityTooltipFactors(row).map((factor) => (
                                  <p key={`${row.caseId}-${factor.key}`} className="mt-1">
                                    • {factor.label} {factor.contribution.toFixed(1)}점
                                  </p>
                                ))}
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3.5">
                            <span className={cn("rounded border px-2 py-0.5 text-[10px] font-semibold", stage1ContactTone(row.contactStatus))}>
                              {row.contactStatus}
                            </span>
                            {row.slaHint ? (
                              <p className="mt-1 text-[10px] text-gray-500">SLA 보조 정보: {row.slaHint}</p>
                            ) : null}
                          </td>
                          <td className="px-4 py-3.5 text-xs text-gray-700">{row.lastContactAttemptAt}</td>
                          <td className="px-4 py-3.5">
                            <span className={cn("rounded border px-2 py-0.5 text-[10px] font-semibold", stage1ChannelTone(row.channel))}>
                              {row.channel}
                            </span>
                          </td>
                          <td className="px-4 py-3.5">
                            <span className={cn("rounded border px-2 py-0.5 text-[10px] font-semibold", stage1NextActionTone(row.nextAction))}>
                              {row.nextAction}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </>
              )}

              {stageFilter === "Stage 2" && (
                <>
                  <thead className="sticky top-0 bg-white z-20 shadow-sm">
                    <tr className="bg-gray-50/80 text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                      <th className="px-4 py-3 border-b border-gray-100">케이스 키</th>
                      <th className="px-4 py-3 border-b border-gray-100">분류 결과</th>
                      <th className="px-4 py-3 border-b border-gray-100">분류 근거 요약</th>
                      <th className="px-4 py-3 border-b border-gray-100">분류 확정 여부</th>
                      <th className="px-4 py-3 border-b border-gray-100">다음 경로</th>
                    </tr>
                  </thead>
                  <tbody className="text-sm">
                    {stageRows.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-4 py-16 text-center text-xs text-gray-400">
                          조건에 맞는 케이스가 없습니다.
                        </td>
                      </tr>
                    )}
                    {(stageRows as Stage2Row[]).map((row) => {
                      return (
                        <tr
                          key={row.caseId}
                          data-case-id={row.caseId}
                          className={cn(
                            "cursor-pointer transition-colors border-b border-gray-50 last:border-0",
                            hoveredCaseId === row.caseId ? "bg-blue-50/60" : "hover:bg-gray-50/70"
                          )}
                          onClick={() => onSelectCase(row.caseId, row.stage)}
                          onMouseEnter={() => openHoverPanel(row.caseId, 30)}
                          onMouseLeave={() => closeHoverPanel(150)}
                        >
                          <td className="px-4 py-3.5">
                            <p className="font-mono font-medium text-gray-900">{row.caseId}</p>
                            <p className="text-[10px] text-gray-400">담당자 {row.manager}</p>
                          </td>
                          <td className="px-4 py-3.5">
                            <span className={cn("rounded border px-2 py-0.5 text-[10px] font-semibold", stage2ClassificationTone(row.classification))}>
                              {row.classification}
                            </span>
                          </td>
                          <td className="px-4 py-3.5 text-xs text-gray-700">{row.rationale}</td>
                          <td className="px-4 py-3.5">
                            <span className={cn("rounded border px-2 py-0.5 text-[10px] font-semibold", stage2ConfirmationTone(row.confirmation))}>
                              {row.confirmation}
                            </span>
                          </td>
                          <td className="px-4 py-3.5">
                            <span className={cn("rounded border px-2 py-0.5 text-[10px] font-semibold", stage2PathTone(row.nextPath))}>
                              {row.nextPath}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </>
              )}

              {stageFilter === "Stage 3" && (
                <>
                  <thead className="sticky top-0 bg-white z-20 shadow-sm">
                    <tr className="bg-gray-50/80 text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                      <th className="px-4 py-3 border-b border-gray-100">케이스 키</th>
                      <th className="px-4 py-3 border-b border-gray-100">추적 상태</th>
                      <th className="px-4 py-3 border-b border-gray-100">최근 추적 이벤트</th>
                      <th className="px-4 py-3 border-b border-gray-100">다음 평가 예정일</th>
                      <th className="px-4 py-3 border-b border-gray-100">관리 집중도</th>
                    </tr>
                  </thead>
                  <tbody className="text-sm">
                    {stageRows.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-4 py-16 text-center text-xs text-gray-400">
                          조건에 맞는 케이스가 없습니다.
                        </td>
                      </tr>
                    )}
                    {(stageRows as Stage3Row[]).map((row) => {
                      return (
                        <tr
                          key={row.caseId}
                          data-case-id={row.caseId}
                          className={cn(
                            "cursor-pointer transition-colors border-b border-gray-50 last:border-0",
                            hoveredCaseId === row.caseId ? "bg-blue-50/60" : "hover:bg-gray-50/70"
                          )}
                          onClick={() => onSelectCase(row.caseId, row.stage)}
                          onMouseEnter={() => openHoverPanel(row.caseId, 30)}
                          onMouseLeave={() => closeHoverPanel(150)}
                        >
                          <td className="px-4 py-3.5">
                            <p className="font-mono font-medium text-gray-900">{row.caseId}</p>
                            <p className="text-[10px] text-gray-400">담당자 {row.manager}</p>
                          </td>
                          <td className="px-4 py-3.5">
                            <span className={cn("rounded border px-2 py-0.5 text-[10px] font-semibold", stage3TrackingTone(row.trackingStatus))}>
                              {row.trackingStatus}
                            </span>
                          </td>
                          <td className="px-4 py-3.5 text-xs text-gray-700">{row.recentEvent}</td>
                          <td className="px-4 py-3.5 text-xs font-semibold text-gray-700">{row.nextEvalDate}</td>
                          <td className="px-4 py-3.5">
                            <span className={cn("rounded border px-2 py-0.5 text-[10px] font-semibold", stage3IntensityTone(row.intensity))}>
                              {row.intensity}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </>
              )}
            </table>

            {hoveredRow && (
              <div
                className="fixed z-50 w-64 rounded-xl border border-gray-200 bg-white p-4 shadow-2xl"
                style={{
                  top: (() => {
                    const row = document.querySelector(`tr[data-case-id="${hoveredRow.caseId}"]`);
                    if (!row) return 180;
                    const rect = row.getBoundingClientRect();
                    const panelHeight = 250;
                    const y = rect.top + rect.height / 2 - panelHeight / 2;
                    return Math.max(80, Math.min(y, window.innerHeight - panelHeight - 20));
                  })(),
                  right: 24,
                }}
                onMouseEnter={() => clearHoverTimer()}
                onMouseLeave={() => closeHoverPanel(120)}
              >
                <div className="mb-3">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400">퀵 액션</p>
                  <p className="mt-0.5 font-mono text-sm font-bold text-blue-700">{hoveredRow.caseId}</p>
                  <p className="mt-0.5 text-[11px] text-gray-500">담당자 {hoveredRow.manager}</p>
                </div>

                <div className="mb-3 rounded-lg border border-gray-100 bg-gray-50 p-2 text-[11px] text-gray-700">
                  {hoveredRow.kind === "Stage 1" && (
                    <p>
                      {ownerLabel(hoveredRow.ownerType)} · {hoveredRow.priorityTier} {interventionLevelLabel(hoveredRow.priorityTier)}({hoveredRow.priorityScore}) · 접촉 {hoveredRow.contactStatus} · 다음 {hoveredRow.nextAction}
                    </p>
                  )}
                  {hoveredRow.kind === "Stage 2" && (
                    <p>
                      분류 {hoveredRow.classification} · {hoveredRow.confirmation} · 경로 {hoveredRow.nextPath}
                    </p>
                  )}
                  {hoveredRow.kind === "Stage 3" && (
                    <p>
                      추적 {hoveredRow.trackingStatus} · 집중도 {hoveredRow.intensity} · 평가 {hoveredRow.nextEvalDate}
                    </p>
                  )}
                </div>

                <div className="mb-3 grid grid-cols-2 gap-1.5">
                  {adapter.quickActions(hoveredRow).map((action) => (
                    <button
                      key={`${hoveredRow.caseId}-${action.key}`}
                      onClick={(event) => event.stopPropagation()}
                      disabled={action.disabled}
                      className={cn(
                        "inline-flex items-center gap-1 rounded-lg border px-2 py-2 text-[11px] font-semibold",
                        action.tone,
                        action.disabled ? "cursor-not-allowed opacity-70" : "cursor-pointer"
                      )}
                    >
                      <action.icon size={12} />
                      {action.label}
                    </button>
                  ))}
                </div>

                <button
                  className="w-full rounded-lg bg-blue-600 py-2 text-[11px] font-bold text-white hover:bg-blue-700"
                  onClick={() => onSelectCase(hoveredRow.caseId, hoveredRow.stage)}
                >
                  상세 보기
                </button>
              </div>
            )}
          </div>

          <div className="p-3 bg-gray-50 text-[10px] text-gray-500 border-t border-gray-100 flex items-center justify-between">
            <span>
              {stageFilter} 필터 결과: 1 - {stageRows.length} of {CASE_RECORDS.filter((item) => item.stage === stageFilter).length}
            </span>
            <div className="flex items-center gap-3">
              <span className="italic">Stage를 바꾸면 컬럼/상태배지/퀵액션/정렬기준이 즉시 전환됩니다.</span>
              <span className="inline-flex items-center gap-1">
                <History size={10} />
                감사 로그 자동 기록
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
