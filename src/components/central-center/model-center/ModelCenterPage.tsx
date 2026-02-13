/* ──────────────────────────────────────────────────────────
   모델 적용 센터 – 전면 개편 페이지
   ──────────────────────────────────────────────────────────
   A. Executive Strip  (ModelPipelineSummaryStrip)
   B. Pipeline + Model Use Map
     B1. ThreeStagePipelineFlow
     B2. ModelUseMap
   C. Detail Inspector
   + ViewModeToggle
   ────────────────────────────────────────────────────────── */
import React, { useState, useRef, useCallback, useMemo, useEffect } from "react";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import {
  Info,
  ChevronRight,
  ChevronDown,
  Layers,
  Eye,
  ShieldCheck,
  FileSearch,
  Database,
  Activity,
  ArrowRight,
  AlertTriangle,
  CheckCircle2,
  Clock,
  XCircle,
  HelpCircle,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  Settings2,
  CircleDot,
  Box,
  Cpu,
  Workflow,
  Users,
  ExternalLink,
} from "lucide-react";

import type {
  ViewMode,
  StageId,
  PipelineKpi,
  StageOverview,
  ModelUseNode,
  ModelUseEdge,
  InspectorContent,
  BatchMeta,
  DispatchLog,
  HoverMetaBase,
  BatchStageTag,
} from "./modelCenter.types";

import {
  MOCK_KPIS,
  MOCK_STAGES,
  MOCK_NODES,
  MOCK_EDGES,
  MOCK_INSPECTOR,
  MOCK_BATCH_META,
  MOCK_DISPATCH_LOGS,
  MOCK_STAGE2_DISTRIBUTION,
} from "./modelCenterMock";

/* ═══════════════════════════════════════════════════════════
   0. ViewModeToggle
   ═══════════════════════════════════════════════════════════ */
const MODE_META: Record<ViewMode, { label: string; icon: React.ElementType; color: string }> = {
  ops:     { label: "운영",   icon: Eye,          color: "bg-blue-600" },
  quality: { label: "품질",   icon: Activity,     color: "bg-amber-500" },
  audit:   { label: "감사",   icon: ShieldCheck,  color: "bg-purple-600" },
};

function ViewModeToggle({ mode, onChange }: { mode: ViewMode; onChange: (m: ViewMode) => void }) {
  return (
    <div className="inline-flex items-center rounded-lg border border-slate-200 bg-white p-0.5 shadow-sm">
      {(Object.keys(MODE_META) as ViewMode[]).map((m) => {
        const meta = MODE_META[m];
        const Icon = meta.icon;
        const active = mode === m;
        return (
          <button
            key={m}
            onClick={() => onChange(m)}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-xs font-semibold transition-all ${
              active
                ? `${meta.color} text-white shadow-sm`
                : "text-slate-500 hover:text-slate-700 hover:bg-slate-50"
            }`}
          >
            <Icon className="h-3.5 w-3.5" />
            {meta.label}
          </button>
        );
      })}
    </div>
  );
}

const BATCH_STATUS_META: Record<BatchMeta["status"], { label: string; chip: string; icon: React.ElementType }> = {
  completed: { label: "완료", chip: "bg-emerald-100 text-emerald-700 border-emerald-200", icon: CheckCircle2 },
  running: { label: "진행중", chip: "bg-blue-100 text-blue-700 border-blue-200", icon: Clock },
  partial: { label: "부분완료", chip: "bg-amber-100 text-amber-700 border-amber-200", icon: AlertTriangle },
  delayed: { label: "지연", chip: "bg-orange-100 text-orange-700 border-orange-200", icon: AlertTriangle },
  failed: { label: "실패", chip: "bg-red-100 text-red-700 border-red-200", icon: XCircle },
};

function BatchCycleBanner({
  meta,
  onOpenDetail,
}: {
  meta: BatchMeta;
  onOpenDetail: () => void;
}) {
  const statusMeta = BATCH_STATUS_META[meta.status];
  const StatusIcon = statusMeta.icon;
  const showImpact = meta.status === "partial" || meta.status === "delayed" || meta.status === "failed";

  return (
    <div className="bg-white border-b border-slate-200 px-5 py-2.5 flex items-center justify-between gap-3 flex-shrink-0">
      <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-600">
        <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-1 text-slate-700 font-semibold">
          D-1 기준일: {meta.baseDate}
        </span>
        <span className="rounded-md bg-slate-50 px-2 py-1 border border-slate-200">수신 마감: {meta.receiveDeadline}</span>
        <span className="rounded-md bg-slate-50 px-2 py-1 border border-slate-200">모델 실행: {meta.modelWindow}</span>
        <span className="rounded-md bg-slate-50 px-2 py-1 border border-slate-200">센터 전송 완료: {meta.dispatchTime}</span>
        <span className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 font-semibold ${statusMeta.chip}`}>
          <StatusIcon className="h-3 w-3" />
          상태: {statusMeta.label}
        </span>
        {showImpact && meta.impactedStages && meta.impactedStages.length > 0 && (
          <span className="inline-flex items-center gap-1">
            <span className="text-slate-400">영향 Stage</span>
            {meta.impactedStages.map((stage) => (
              <span key={stage} className="rounded-md bg-amber-100 text-amber-700 border border-amber-200 px-1.5 py-0.5 font-semibold">
                {stage}
              </span>
            ))}
          </span>
        )}
        {meta.notes && <span className="text-slate-500">{meta.notes}</span>}
      </div>
      <button
        className="text-[11px] text-blue-600 hover:text-blue-700 font-semibold whitespace-nowrap"
        onClick={onOpenDetail}
      >
        배치 상세 보기
      </button>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   1. ModelPipelineSummaryStrip (Executive Strip)
   ═══════════════════════════════════════════════════════════ */
const STATUS_STYLES: Record<string, string> = {
  good:    "border-emerald-200 bg-gradient-to-br from-white to-emerald-50/80 shadow-sm",
  warn:    "border-amber-200 bg-gradient-to-br from-white to-amber-50/80 shadow-sm",
  risk:    "border-red-200 bg-gradient-to-br from-white to-red-50/80 shadow-sm",
  neutral: "border-slate-200 bg-gradient-to-br from-white to-slate-50/60 shadow-sm",
};
const STATUS_DOT: Record<string, string> = {
  good:    "bg-emerald-500",
  warn:    "bg-amber-500",
  risk:    "bg-red-500",
  neutral: "bg-slate-400",
};

function KpiCard({
  kpi,
  viewMode,
  onJump,
}: {
  kpi: PipelineKpi;
  viewMode: ViewMode;
  onJump?: (s: StageId) => void;
}) {
  const [showHelp, setShowHelp] = useState(false);

  // ViewMode override
  const override = kpi.modeOverride?.[viewMode];
  const label = override?.label ?? kpi.label;
  const value = override?.value ?? kpi.value;
  const valuePrefix = override?.valuePrefix ?? kpi.valuePrefix;
  const secondaryValueLine = override?.secondaryValueLine ?? kpi.secondaryValueLine;
  const unit = (override?.unit ?? kpi.unit) as string | undefined;
  const status = (override?.status ?? kpi.status ?? "neutral") as string;

  const formatted = unit === "명" ? value.toLocaleString() : `${value}`;
  const deltaIcon =
    kpi.delta == null
      ? null
      : kpi.delta > 0
      ? <ArrowUpRight className="h-3 w-3 text-emerald-500" />
      : kpi.delta < 0
      ? <ArrowDownRight className="h-3 w-3 text-red-500" />
      : <Minus className="h-3 w-3 text-slate-400" />;

  return (
    <div
      className={`relative flex flex-col justify-between rounded-xl border p-3.5 transition-all duration-200 ease-out hover:shadow-lg hover:scale-[1.04] hover:-translate-y-0.5 ${STATUS_STYLES[status]} ${
        kpi.jumpTo ? "cursor-pointer" : ""
      }`}
      onClick={() => kpi.jumpTo && onJump?.(kpi.jumpTo)}
    >
      {/* Help tooltip */}
      {kpi.help && (
        <button
          className="absolute top-2 left-2 text-slate-300 hover:text-slate-500"
          onClick={(e) => { e.stopPropagation(); setShowHelp(!showHelp); }}
        >
          <HelpCircle className="h-3.5 w-3.5" />
        </button>
      )}
      <div className="absolute top-2 right-2 flex flex-col items-end gap-1">
        <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[9px] text-slate-500">
          기준: {kpi.baseDate} · D-1
        </span>
        {kpi.partialStages && kpi.partialStages.length > 0 && (
          <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[9px] text-amber-700" title={`반영 범위: ${kpi.partialStages.join("/")}`}>
            부분 집계
          </span>
        )}
      </div>
      {showHelp && kpi.help && (
        <div className="absolute top-8 left-2 z-20 w-60 rounded-lg border border-slate-200 bg-white p-3 text-xs shadow-lg">
          <p className="font-semibold text-slate-700 mb-1">{kpi.help.title}</p>
          <p className="text-slate-500 leading-relaxed whitespace-pre-line">{kpi.help.body}</p>
        </div>
      )}

      <div className="flex items-center gap-1.5 mb-2 mt-8">
        <span className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT[status]}`} />
        <span className="text-[11px] font-medium text-slate-500 leading-tight truncate">{label}</span>
      </div>

      <div className="flex items-end gap-1.5">
        <span className="text-xl font-bold text-slate-800 leading-none">
          {valuePrefix ? `${valuePrefix} ` : ""}
          {formatted}
        </span>
        {unit && <span className="text-xs text-slate-400 mb-0.5">{unit}</span>}
      </div>
      {secondaryValueLine && (
        <p className="mt-1 text-[10px] text-slate-500 font-medium">{secondaryValueLine}</p>
      )}

      <div className="flex items-center justify-between mt-2">
        <span className="text-[10px] text-slate-400">{kpi.scopeLine}</span>
        {kpi.delta != null && (
          <span className="flex items-center gap-0.5 text-[10px] text-slate-500">
            {deltaIcon}
            {Math.abs(kpi.delta)}{unit === "건" || unit === "명" ? "" : "%p"}
          </span>
        )}
      </div>

    </div>
  );
}

function ModelPipelineSummaryStrip({
  kpis,
  viewMode,
  onJump,
}: {
  kpis: PipelineKpi[];
  viewMode: ViewMode;
  onJump: (s: StageId) => void;
}) {
  return (
    <div className="grid grid-cols-4 lg:grid-cols-8 gap-3">
      {kpis.map((k) => (
        <KpiCard key={k.key} kpi={k} viewMode={viewMode} onJump={onJump} />
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   2. ThreeStagePipelineFlow
   ═══════════════════════════════════════════════════════════ */
const STAGE_COLORS: Record<StageId, { bg: string; border: string; accent: string; headerBg: string }> = {
  stage1: { bg: "bg-blue-50/60",    border: "border-blue-200", accent: "text-blue-700",    headerBg: "bg-blue-600" },
  stage2: { bg: "bg-amber-50/60",   border: "border-amber-200", accent: "text-amber-700", headerBg: "bg-amber-500" },
  stage3: { bg: "bg-emerald-50/60", border: "border-emerald-200", accent: "text-emerald-700", headerBg: "bg-emerald-600" },
};

const STAGE_TO_BATCH_TAG: Record<StageId, BatchStageTag> = {
  stage1: "S1",
  stage2: "S2",
  stage3: "S3",
};

type StageDispatchState = "completed" | "partial" | "delayed" | "failed";
type StageHoverPayload = { meta: HoverMetaBase; dispatchState: StageDispatchState };

const STAGE_HOVER_STATE_META: Record<StageDispatchState, { label: string; badgeClass: string }> = {
  completed: { label: "완료", badgeClass: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  partial: { label: "부분 집계", badgeClass: "bg-amber-100 text-amber-700 border-amber-200" },
  delayed: { label: "지연", badgeClass: "bg-orange-100 text-orange-700 border-orange-200" },
  failed: { label: "실패", badgeClass: "bg-red-100 text-red-700 border-red-200" },
};

function useIsTouchDevice(): boolean {
  const [isTouch, setIsTouch] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const media = window.matchMedia("(hover: none), (pointer: coarse)");
    const update = () => setIsTouch(media.matches || navigator.maxTouchPoints > 0);
    update();
    media.addEventListener?.("change", update);
    return () => media.removeEventListener?.("change", update);
  }, []);

  return isTouch;
}

function resolveStageDispatchState(
  stageTag: BatchStageTag,
  batchMeta: BatchMeta,
  dispatchLogs: DispatchLog[],
): StageDispatchState {
  const logs = dispatchLogs.filter((log) => log.stage === stageTag);
  const impacted = Boolean(batchMeta.impactedStages?.includes(stageTag));
  if (logs.some((log) => log.slaStatus === "breached")) return "failed";
  if (batchMeta.status === "failed" && impacted) return "failed";
  if (logs.some((log) => log.slaStatus === "delayed")) return "delayed";
  if (batchMeta.status === "delayed" && impacted) return "delayed";
  if (logs.some((log) => log.failedCount > 0 || log.retryCount > 0)) return "partial";
  if (batchMeta.status === "partial" && impacted) return "partial";
  return "completed";
}

function buildStageHoverPayload(
  stage: StageOverview,
  batchMeta: BatchMeta,
  dispatchLogs: DispatchLog[],
): StageHoverPayload {
  const stageTag = STAGE_TO_BATCH_TAG[stage.stageId];
  const dispatchState = resolveStageDispatchState(stageTag, batchMeta, dispatchLogs);
  const dispatchLabel = STAGE_HOVER_STATE_META[dispatchState].label;
  const isPartial = dispatchState === "partial" || dispatchState === "delayed" || dispatchState === "failed";

  if (stage.stageId === "stage1") {
    return {
      dispatchState,
      meta: {
        stage: stageTag,
        title: "Stage1 — 1차 선별검사",
        baseDate: batchMeta.baseDate,
        definition: "건강검진/문진/이력 기반으로 위험도 점수와 선별 대상자를 산출",
        denominator: { label: "대상자", n: stage.metrics.applied },
        coverage: { receivedPct: stage.metrics.appliedRate, partial: isPartial, notes: batchMeta.notes },
        outputs: ["신규 케이스 생성 후보", "2차(진단) 검사 권고/예약 유도", "이상 신호(사유 코드)"],
        caution: "위험도는 진단이 아니라 선별/우선순위 신호",
        modelChip: `ML ${stage.processing[0]?.version ?? "v-"}`,
        dispatchChip: `전송: ${dispatchLabel}`,
      },
    };
  }

  if (stage.stageId === "stage2") {
    return {
      dispatchState,
      meta: {
        stage: stageTag,
        title: "Stage2 — 2차 진단검사",
        baseDate: batchMeta.baseDate,
        definition: "의료기관 진단 결과를 수신하고, 모델이 일관성 검증 신호를 제공",
        denominator: { label: "기관 결과 수신", n: MOCK_STAGE2_DISTRIBUTION.receivedN },
        coverage: { receivedPct: batchMeta.receiveRate, partial: isPartial, notes: batchMeta.notes },
        outputs: ["AD/MCI/정상 분포 집계", "검증필요/주의 플래그", "센터 후속조치 대상"],
        caution: "기관 결과가 공식 분류이며 모델 신호는 참고(비진단)",
        modelChip: "ANN v1.0",
        dispatchChip: `전송: ${dispatchLabel}`,
      },
    };
  }

  return {
    dispatchState,
    meta: {
      stage: stageTag,
      title: "Stage3 — 3차 감별검사",
      baseDate: batchMeta.baseDate,
      definition: "MCI 추적군 중심으로 전환 위험/우선순위와 권고 액션을 갱신",
      denominator: { label: "추적 대상", n: stage.metrics.applied },
      coverage: { receivedPct: stage.metrics.appliedRate, partial: isPartial, notes: batchMeta.notes },
      outputs: ["우선순위 High 리스트", "권고 액션(재검/정밀검사/연계)", "추적 지연/누락 경고"],
      caution: "우선순위는 운영 신호이며 임상 판단을 대체하지 않음",
      modelChip: "CNN v1.0",
      dispatchChip: `전송: ${dispatchLabel}`,
    },
  };
}

function StageHoverSummary({
  hoverMeta,
  dispatchState,
  onOpenDetail,
}: {
  hoverMeta: HoverMetaBase;
  dispatchState: StageDispatchState;
  onOpenDetail: () => void;
}) {
  const receivedPctLine = hoverMeta.coverage?.receivedPct != null ? `${hoverMeta.coverage.receivedPct.toFixed(1)}%` : "-";
  const coverageState = hoverMeta.coverage?.partial ? "부분 집계" : "정상";
  const stateMeta = STAGE_HOVER_STATE_META[dispatchState];

  return (
    <div className="w-[340px] rounded-lg border border-slate-200 bg-white p-2.5 text-[11px] leading-4 shadow-xl">
      <p className="flex items-center justify-between gap-2 text-slate-800 font-semibold">
        <span className="truncate">{hoverMeta.title}</span>
        <span className={`shrink-0 rounded border px-1.5 py-0.5 text-[10px] font-semibold ${stateMeta.badgeClass}`}>
          {stateMeta.label}
        </span>
      </p>
      <p className="mt-1 truncate text-slate-500">
        기준일(D-1): {hoverMeta.baseDate} · {hoverMeta.modelChip ?? "모델 미정"} · {hoverMeta.dispatchChip ?? "전송: -"}
      </p>
      <p className="mt-1 truncate text-slate-600">정의: {hoverMeta.definition}</p>
      <p className="mt-1 truncate text-slate-600">
        분모: {hoverMeta.denominator.label} {hoverMeta.denominator.n.toLocaleString()} · 수신률 {receivedPctLine} · {coverageState}
      </p>
      <p className="mt-1 truncate text-slate-600">산출물: {hoverMeta.outputs.slice(0, 3).join(" / ")}</p>
      <div className="mt-1 flex items-center gap-2">
        <p className="min-w-0 flex-1 truncate text-slate-500">주의: {hoverMeta.caution ?? "-"}</p>
        <button
          className="inline-flex items-center gap-1 text-[10px] font-semibold text-blue-600 hover:text-blue-700 shrink-0"
          onClick={(e) => {
            e.stopPropagation();
            onOpenDetail();
          }}
        >
          상세 보기
          <ExternalLink className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}

function StageCard({
  stage,
  viewMode,
  isSelected,
  isBatchImpacted,
  hoverMeta,
  dispatchState,
  isTouchDevice,
  onOpenDetail,
  onClick,
}: {
  stage: StageOverview;
  viewMode: ViewMode;
  isSelected: boolean;
  isBatchImpacted?: boolean;
  hoverMeta: HoverMetaBase;
  dispatchState: StageDispatchState;
  isTouchDevice: boolean;
  onOpenDetail: () => void;
  onClick: () => void;
}) {
  const c = STAGE_COLORS[stage.stageId];
  const [expanded, setExpanded] = useState(false);
  const [isTooltipOpen, setIsTooltipOpen] = useState(false);
  const [isInfoOpen, setIsInfoOpen] = useState(false);

  const handleOpenDetail = useCallback(() => {
    setIsTooltipOpen(false);
    setIsInfoOpen(false);
    onOpenDetail();
  }, [onOpenDetail]);

  const cardBody = (
    <div
      className={`relative pt-2 rounded-xl border-2 transition-all cursor-pointer ${c.bg} ${
        isSelected ? `${c.border} shadow-lg ring-2 ring-offset-1 ring-blue-300` : `${c.border} hover:shadow-md`
      }`}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
    >
      <span className="absolute left-3 -top-2.5 rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-semibold text-slate-700 whitespace-nowrap">
        {stage.examLabel}
      </span>
      {/* Header */}
      <div className={`${c.headerBg} rounded-t-[10px] px-4 py-2.5 flex items-center justify-between`}>
        <div className="flex items-center gap-2">
          <span className="text-white/80 text-xs font-mono">{stage.stageId.toUpperCase()}</span>
          <span className="text-white font-semibold text-sm">{stage.title}</span>
        </div>
        <div className="flex items-center gap-2">
          {isBatchImpacted && (
            <span className="rounded bg-amber-100/90 px-1.5 py-0.5 text-[9px] font-semibold text-amber-700">
              부분 집계
            </span>
          )}
          {isTouchDevice && (
            <PopoverPrimitive.Root open={isInfoOpen} onOpenChange={setIsInfoOpen}>
              <PopoverPrimitive.Trigger asChild>
                <button
                  className="text-[11px] font-semibold text-white/90 hover:text-white rounded px-1"
                  onClick={(e) => e.stopPropagation()}
                  aria-label={`${hoverMeta.title} 요약`}
                >
                  ⓘ
                </button>
              </PopoverPrimitive.Trigger>
              <PopoverPrimitive.Portal>
                <PopoverPrimitive.Content
                  side="top"
                  align="end"
                  sideOffset={8}
                  collisionPadding={12}
                  className="z-50 p-0 bg-transparent border-0 shadow-none"
                >
                  <StageHoverSummary hoverMeta={hoverMeta} dispatchState={dispatchState} onOpenDetail={handleOpenDetail} />
                </PopoverPrimitive.Content>
              </PopoverPrimitive.Portal>
            </PopoverPrimitive.Root>
          )}
          <button
            className="text-white/70 hover:text-white"
            onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
          >
            {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Purpose */}
      <div className="px-4 py-2 border-b border-dashed border-slate-200/80">
        <p className="text-[11px] text-slate-500 italic">{stage.purposeLine}</p>
      </div>
      {stage.stageId === "stage2" && (
        <div className="mx-4 mt-2 rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-[10px] text-amber-700 font-semibold">
          기관 결과 = 공식 분류 · 모델 신호 = 참고(비진단)
        </div>
      )}

      {/* Metrics row */}
      <div className="px-4 py-3 grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
        <div>
          <span className="text-slate-400">적용</span>
          <span className="ml-1.5 font-bold text-slate-700">{stage.metrics.applied.toLocaleString()}명</span>
        </div>
        {stage.metrics.appliedRate != null && (
          <div>
            <span className="text-slate-400">적용률</span>
            <span className="ml-1.5 font-bold text-slate-700">{stage.metrics.appliedRate}%</span>
          </div>
        )}
        {stage.metrics.conversionRate != null && (
          <div>
            <span className="text-slate-400">전환율</span>
            <span className="ml-1.5 font-bold text-slate-700">{stage.metrics.conversionRate}%</span>
          </div>
        )}
        {stage.metrics.avgLatencyDays != null && (
          <div>
            <span className="text-slate-400">소요</span>
            <span className="ml-1.5 font-bold text-slate-700">{stage.metrics.avgLatencyDays}일</span>
          </div>
        )}
      </div>

      {/* ViewMode-specific highlight */}
      {viewMode === "quality" && (
        <div className="mx-4 mb-2 px-2.5 py-1.5 bg-amber-100/80 rounded text-[10px] text-amber-700 flex items-center gap-1">
          <AlertTriangle className="h-3 w-3" />
          데이터 품질 경고 {stage.metrics.topIssues?.length ?? 0}건
        </div>
      )}
      {viewMode === "audit" && (
        <div className="mx-4 mb-2 px-2.5 py-1.5 bg-purple-100/80 rounded text-[10px] text-purple-700 flex items-center gap-1">
          <ShieldCheck className="h-3 w-3" />
          최근 변경: {stage.processing[0]?.version ?? "-"}
        </div>
      )}

      {/* Expanded: Input → Processing → Output */}
      {expanded && (
        <div className="px-4 pb-3 space-y-2.5 border-t border-slate-200/60 mt-1 pt-3">
          {/* Inputs */}
          <div>
            <div className="flex items-center gap-1 text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
              <Database className="h-3 w-3" /> 입력
            </div>
            <div className="flex flex-wrap gap-1">
              {stage.inputs.map((inp) => (
                <span key={inp.name} className="inline-block bg-blue-100 text-blue-700 text-[10px] px-1.5 py-0.5 rounded">
                  {inp.name}
                </span>
              ))}
            </div>
          </div>
          {/* Processing */}
          <div>
            <div className="flex items-center gap-1 text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
              <Cpu className="h-3 w-3" /> 모델/규칙
            </div>
            <div className="flex flex-wrap gap-1">
              {stage.processing.map((p) => (
                <span key={p.name} className="inline-flex items-center gap-1 bg-slate-100 text-slate-600 text-[10px] px-1.5 py-0.5 rounded">
                  {p.name}
                  {p.version && <span className="text-slate-400 font-mono">{p.version}</span>}
                </span>
              ))}
            </div>
          </div>
          {/* Outputs */}
          <div>
            <div className="flex items-center gap-1 text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
              <ArrowRight className="h-3 w-3" /> 산출물
            </div>
            <div className="flex flex-wrap gap-1">
              {stage.outputs.map((o) => (
                <span key={o.name} className="inline-block bg-emerald-100 text-emerald-700 text-[10px] px-1.5 py-0.5 rounded font-mono">
                  {o.name}
                </span>
              ))}
            </div>
          </div>
          {/* Transition */}
          <div>
            <div className="flex items-center gap-1 text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
              <Workflow className="h-3 w-3" /> 전달
            </div>
            {stage.transition.map((t, i) => (
              <p key={i} className="text-[10px] text-slate-500 ml-4">
                → {t.to === "end" ? "종료" : t.to.toUpperCase()}: {t.ruleLine}
              </p>
            ))}
          </div>
          {/* Top Issues */}
          {stage.metrics.topIssues && stage.metrics.topIssues.length > 0 && (
            <div>
              <div className="flex items-center gap-1 text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                <AlertTriangle className="h-3 w-3" /> 주요 이슈
              </div>
              {stage.metrics.topIssues.map((iss) => (
                <div key={iss.code} className="flex items-center justify-between text-[10px] text-slate-500 ml-4">
                  <span className="font-mono text-slate-400">{iss.code}</span>
                  <span>{iss.label}</span>
                  <span className="font-bold text-slate-600">{iss.count.toLocaleString()}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );

  if (isTouchDevice) {
    return cardBody;
  }

  return (
    <TooltipPrimitive.Root open={isTooltipOpen} onOpenChange={setIsTooltipOpen} delayDuration={180}>
      <TooltipPrimitive.Trigger asChild>{cardBody}</TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content
          side="top"
          align="end"
          sideOffset={8}
          collisionPadding={12}
          className="z-50 p-0 bg-transparent border-0 shadow-none"
        >
          <StageHoverSummary hoverMeta={hoverMeta} dispatchState={dispatchState} onOpenDetail={handleOpenDetail} />
          <TooltipPrimitive.Arrow className="fill-white" />
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  );
}

function ThreeStagePipelineFlow({
  stages,
  viewMode,
  selectedStage,
  batchMeta,
  dispatchLogs,
  onSelectStage,
  onOpenStageDetail,
}: {
  stages: StageOverview[];
  viewMode: ViewMode;
  selectedStage: string | null;
  batchMeta: BatchMeta;
  dispatchLogs: DispatchLog[];
  onSelectStage: (id: string) => void;
  onOpenStageDetail: (stageId: StageId) => void;
}) {
  const isTouchDevice = useIsTouchDevice();
  const hoverMetaByStage = useMemo(() => {
    return stages.reduce<Record<StageId, StageHoverPayload>>((acc, stage) => {
      acc[stage.stageId] = buildStageHoverPayload(stage, batchMeta, dispatchLogs);
      return acc;
    }, {} as Record<StageId, StageHoverPayload>);
  }, [stages, batchMeta, dispatchLogs]);

  return (
    <TooltipPrimitive.Provider delayDuration={180}>
      <div className="flex items-stretch gap-3">
        {stages.map((s, i) => {
          const hoverPayload = hoverMetaByStage[s.stageId];
          return (
            <React.Fragment key={s.stageId}>
              <div className="flex-1 min-w-0">
                <StageCard
                  stage={s}
                  viewMode={viewMode}
                  isSelected={selectedStage === s.stageId}
                  isBatchImpacted={Boolean(batchMeta.impactedStages?.includes(STAGE_TO_BATCH_TAG[s.stageId]))}
                  hoverMeta={hoverPayload.meta}
                  dispatchState={hoverPayload.dispatchState}
                  isTouchDevice={isTouchDevice}
                  onClick={() => onSelectStage(s.stageId)}
                  onOpenDetail={() => onOpenStageDetail(s.stageId)}
                />
              </div>
              {i < stages.length - 1 && (
                <div className="flex items-center">
                  <ArrowRight className="h-5 w-5 text-slate-300" />
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>
    </TooltipPrimitive.Provider>
  );
}

/* ═══════════════════════════════════════════════════════════
   3. ModelUseMap (HTML Grid 기반 — 가독성 개선 v2)
   ═══════════════════════════════════════════════════════════ */
const GROUP_COLS: {
  key: string;
  label: string;
  labelKo: string;
  color: string;
  bg: string;
  bgSoft: string;
  borderColor: string;
  icon: React.ElementType;
}[] = [
  { key: "input",   label: "INPUT SOURCES",   labelKo: "입력 데이터",     color: "#3b82f6", bg: "#dbeafe", bgSoft: "bg-blue-50/40",    borderColor: "border-blue-200", icon: Database },
  { key: "feature", label: "FEATURE BUILDER", labelKo: "피처 빌더",       color: "#8b5cf6", bg: "#ede9fe", bgSoft: "bg-violet-50/40",  borderColor: "border-violet-200", icon: Box },
  { key: "model",   label: "MODELS & RULES",  labelKo: "모델 / 규칙",     color: "#f59e0b", bg: "#fef3c7", bgSoft: "bg-amber-50/40",   borderColor: "border-amber-200", icon: Cpu },
  { key: "output",  label: "OUTPUTS",         labelKo: "산출물",          color: "#10b981", bg: "#d1fae5", bgSoft: "bg-emerald-50/40", borderColor: "border-emerald-200", icon: ArrowRight },
  { key: "dispatch",label: "DISPATCH",        labelKo: "전송",            color: "#2563eb", bg: "#dbeafe", bgSoft: "bg-blue-50/30",    borderColor: "border-blue-200", icon: Users },
  { key: "ops",     label: "DOWNSTREAM OPS",  labelKo: "운영 활용",       color: "#ef4444", bg: "#fee2e2", bgSoft: "bg-red-50/40",     borderColor: "border-red-200", icon: Workflow },
];

const STAGE_TAG_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  stage1: { bg: "bg-blue-100",    text: "text-blue-600",    label: "S1" },
  stage2: { bg: "bg-amber-100",   text: "text-amber-600",   label: "S2" },
  stage3: { bg: "bg-emerald-100", text: "text-emerald-600", label: "S3" },
  common: { bg: "bg-slate-100",   text: "text-slate-500",   label: "공통" },
};

function UseMapNode({
  node,
  meta,
  isSelected,
  isHovered,
  isConnected,
  dimmed,
  onSelect,
  onHover,
  onLeave,
}: {
  node: ModelUseNode;
  meta: typeof GROUP_COLS[number];
  isSelected: boolean;
  isHovered: boolean;
  isConnected: boolean;
  dimmed: boolean;
  onSelect: () => void;
  onHover: () => void;
  onLeave: () => void;
}) {
  const tagInfo = node.stageTag ? STAGE_TAG_COLORS[node.stageTag] : null;

  return (
    <button
      onClick={onSelect}
      onMouseEnter={onHover}
      onMouseLeave={onLeave}
      className={`
        group relative w-full text-left rounded-lg border px-3 py-2.5
        transition-all duration-150 ease-out
        ${node.isExternal ? "border-dashed" : ""}
        ${isSelected
          ? "shadow-md ring-2 ring-offset-1 text-white"
          : isHovered || isConnected
          ? "shadow-sm -translate-y-0.5"
          : dimmed
          ? "opacity-30"
          : "hover:shadow-sm hover:-translate-y-0.5"
        }
      `}
      style={{
        background: isSelected ? meta.color : isHovered ? meta.bg : "#ffffff",
        borderColor: isSelected || isHovered || isConnected ? meta.color : node.isExternal ? "#f59e0b" : "#e2e8f0",
        ...(isConnected && !isSelected && !isHovered ? { borderColor: meta.color, borderWidth: 2 } : {}),
      }}
    >
      {/* Stage tag badge */}
      {tagInfo && (
        <span className={`absolute -top-1.5 -left-1 text-[7px] font-bold px-1 py-px rounded ${
          isSelected ? "bg-white/30 text-white" : `${tagInfo.bg} ${tagInfo.text}`
        }`}>
          {tagInfo.label}
        </span>
      )}
      {/* External badge (기관 결과) */}
      {node.isExternal && !isSelected && (
        <span className="absolute -top-1.5 -right-1 text-[7px] font-bold px-1 py-px rounded bg-amber-100 text-amber-600">
          기관
        </span>
      )}
      <p className={`text-[11px] font-semibold leading-tight truncate ${isSelected ? "text-white" : "text-slate-700"}`}>
        {node.label}
      </p>
      <p className={`text-[9px] mt-0.5 leading-tight truncate ${isSelected ? "text-white/70" : "text-slate-400"}`}>
        {node.shortDesc}
      </p>
      {/* Connected indicator dot */}
      {isConnected && !isSelected && (
        <span
          className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full ring-2 ring-white"
          style={{ background: meta.color }}
        />
      )}
    </button>
  );
}

function ModelUseMap({
  nodes,
  edges,
  selectedNode,
  onSelectNode,
  viewMode,
}: {
  nodes: ModelUseNode[];
  edges: ModelUseEdge[];
  selectedNode: string | null;
  onSelectNode: (id: string) => void;
  viewMode: ViewMode;
}) {
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);

  const grouped = useMemo(() => {
    const g: Record<string, ModelUseNode[]> = {};
    for (const n of nodes) (g[n.group] ??= []).push(n);
    return g;
  }, [nodes]);

  // Stage order for sub-grouping within columns
  const stageOrder: (string | undefined)[] = ["stage1", "stage2", "stage3", "common", undefined];
  const stageLabelMap: Record<string, string> = { stage1: "Stage 1", stage2: "Stage 2", stage3: "Stage 3", common: "공통" };

  // Sub-group nodes by stageTag within each column
  const groupedByStage = useMemo(() => {
    const result: Record<string, { tag: string; label: string; nodes: ModelUseNode[] }[]> = {};
    for (const col of GROUP_COLS) {
      const list = grouped[col.key] ?? [];
      const subGroups: { tag: string; label: string; nodes: ModelUseNode[] }[] = [];
      for (const st of stageOrder) {
        const filtered = list.filter((n) => (n.stageTag ?? undefined) === st);
        if (filtered.length > 0) {
          subGroups.push({ tag: st ?? "etc", label: stageLabelMap[st ?? ""] ?? "", nodes: filtered });
        }
      }
      result[col.key] = subGroups;
    }
    return result;
  }, [grouped]);

  // Connected nodes (1-hop from hovered/selected)
  const { connectedNodes } = useMemo(() => {
    const focus = hoveredNode ?? selectedNode;
    if (!focus) return { connectedNodes: new Set<string>() };
    const cn = new Set<string>();
    for (const e of edges) {
      if (e.from === focus || e.to === focus) {
        cn.add(e.from);
        cn.add(e.to);
      }
    }
    return { connectedNodes: cn };
  }, [edges, hoveredNode, selectedNode]);

  const hasFocus = hoveredNode != null || selectedNode != null;

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      {/* ── Column Headers ── */}
      <div className="grid grid-cols-6 border-b border-slate-100">
        {GROUP_COLS.map((col) => {
          const Icon = col.icon;
          return (
            <div
              key={col.key}
              className={`flex flex-col items-center gap-0.5 py-3 ${col.bgSoft} border-r last:border-r-0 ${col.borderColor}`}
            >
              <Icon className="h-4 w-4" style={{ color: col.color }} />
              <span className="text-[10px] font-bold tracking-wider" style={{ color: col.color }}>
                {col.label}
              </span>
              <span className="text-[9px] text-slate-400">{col.labelKo}</span>
            </div>
          );
        })}
      </div>

      {/* ── SVG Connection Lines ── */}
      <div className="relative">
        {/* Overlay SVG for curved edges */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none z-0" preserveAspectRatio="none">
          {/* We draw lines in the grid overlay — handled by CSS borders instead */}
        </svg>

        {/* ── Node Grid ── */}
        <div className="grid grid-cols-6 min-h-[420px]">
          {GROUP_COLS.map((col, colIdx) => {
            const subGroups = groupedByStage[col.key] ?? [];
            return (
              <div
                key={col.key}
                className={`flex flex-col gap-1.5 p-3 ${col.bgSoft} ${
                  colIdx < GROUP_COLS.length - 1 ? `border-r ${col.borderColor}` : ""
                }`}
              >
                {subGroups.map((sg, sgIdx) => (
                  <React.Fragment key={sg.tag}>
                    {/* Stage sub-header */}
                    {sg.label && (
                      <div className={`flex items-center gap-1 ${sgIdx > 0 ? "mt-2 pt-2 border-t border-dashed border-slate-200/60" : ""}`}>
                        <span className={`text-[8px] font-bold px-1 py-px rounded ${
                          STAGE_TAG_COLORS[sg.tag]?.bg ?? "bg-slate-100"
                        } ${STAGE_TAG_COLORS[sg.tag]?.text ?? "text-slate-400"}`}>
                          {sg.label}
                        </span>
                      </div>
                    )}
                    {sg.nodes.map((node) => {
                      const isSel = selectedNode === node.id;
                      const isHov = hoveredNode === node.id;
                      const isCon = connectedNodes.has(node.id);
                      return (
                        <UseMapNode
                          key={node.id}
                          node={node}
                          meta={col}
                          isSelected={isSel}
                          isHovered={isHov}
                          isConnected={isCon && !isSel && !isHov}
                          dimmed={hasFocus && !isCon && !isSel && !isHov}
                          onSelect={() => onSelectNode(node.id)}
                          onHover={() => setHoveredNode(node.id)}
                          onLeave={() => setHoveredNode(null)}
                        />
                      );
                    })}
                  </React.Fragment>
                ))}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Connected edges legend (bottom bar) ── */}
      {(hoveredNode || selectedNode) && (() => {
        const focus = hoveredNode ?? selectedNode;
        const node = nodes.find((n) => n.id === focus);
        const related = edges.filter((e) => e.from === focus || e.to === focus);
        if (!node || related.length === 0) return null;
        return (
          <div className="border-t border-slate-100 bg-slate-50/80 px-4 py-2.5">
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-[10px] font-bold text-slate-600">{node.label}</span>
              <span className="text-[9px] text-slate-400">— 연결된 흐름</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {related.map((e) => {
                const isOutgoing = e.from === focus;
                const targetId = isOutgoing ? e.to : e.from;
                const targetNode = nodes.find((n) => n.id === targetId);
                return (
                  <span
                    key={`${e.from}-${e.to}`}
                    className="inline-flex items-center gap-1 text-[9px] bg-white border border-slate-200 rounded px-2 py-0.5 text-slate-500"
                  >
                    {isOutgoing ? "→" : "←"}
                    <span className="font-medium text-slate-700">{targetNode?.label ?? targetId}</span>
                    {e.label && <span className="text-slate-300">({e.label})</span>}
                  </span>
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* ── View mode badge ── */}
      {viewMode === "quality" && (
        <div className="border-t border-amber-200 bg-amber-50 px-4 py-2 text-[10px] text-amber-700 flex items-center gap-1.5">
          <AlertTriangle className="h-3 w-3" />
          품질 모드: 데이터 품질 경고가 있는 노드가 강조됩니다
        </div>
      )}
      {viewMode === "audit" && (
        <div className="border-t border-purple-200 bg-purple-50 px-4 py-2 text-[10px] text-purple-700 flex items-center gap-1.5">
          <ShieldCheck className="h-3 w-3" />
          감사 모드: 변경 이력이 있는 모델/규칙 노드를 클릭하여 Inspector에서 확인하세요
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   4. DetailInspector (3-tab)
   ═══════════════════════════════════════════════════════════ */
type InspectorTab = "definition" | "contract" | "quality";
type InspectorFocusMode = "default" | "stage-detail";

const INSPECTOR_TABS: { id: InspectorTab; label: string; icon: React.ElementType }[] = [
  { id: "definition", label: "정의", icon: FileSearch },
  { id: "contract",   label: "데이터 계약", icon: Database },
  { id: "quality",    label: "품질/감사", icon: ShieldCheck },
];

function DetailInspector({
  content,
  viewMode,
  selectedContext,
  stages,
  batchMeta,
  dispatchLogs,
  focusMode,
  focusNonce,
}: {
  content: InspectorContent | null;
  viewMode: ViewMode;
  selectedContext: string | null;
  stages: StageOverview[];
  batchMeta: BatchMeta;
  dispatchLogs: DispatchLog[];
  focusMode: InspectorFocusMode;
  focusNonce: number;
}) {
  const [tab, setTab] = useState<InspectorTab>("definition");
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const stageMap = useMemo(() => {
    const map: Record<string, StageOverview> = {};
    for (const stage of stages) {
      map[stage.stageId] = stage;
    }
    return map;
  }, [stages]);
  const stageContext = selectedContext ? stageMap[selectedContext] : null;
  const stageTag = stageContext ? STAGE_TO_BATCH_TAG[stageContext.stageId] : null;
  const stageDispatchLogs = stageTag ? dispatchLogs.filter((log) => log.stage === stageTag) : [];
  const stageDispatchState = stageTag ? resolveStageDispatchState(stageTag, batchMeta, dispatchLogs) : null;
  const isStageContext = Boolean(stageContext);

  useEffect(() => {
    if (focusMode !== "stage-detail") return;
    if (!isStageContext) return;
    if (focusNonce < 1) return;
    setTab("quality");
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
    });
  }, [focusMode, focusNonce, isStageContext]);

  if (!content) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-slate-400 text-xs p-6">
        <Layers className="h-8 w-8 mb-2 text-slate-300" />
        <p>좌측 파이프라인 또는 모델 사용 지도에서</p>
        <p>항목을 선택하면 상세 정보가 표시됩니다.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* ID + Tabs */}
      <div className="border-b border-slate-200 px-4 pt-3 pb-0">
        <p className="text-xs font-bold text-slate-700 mb-2 flex items-center gap-1.5">
          <CircleDot className="h-3.5 w-3.5 text-blue-500" />
          {content.id}
        </p>
        <div className="flex gap-1">
          {INSPECTOR_TABS.map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-medium rounded-t-md transition ${
                  tab === t.id
                    ? "bg-white border border-b-0 border-slate-200 text-slate-800 -mb-px"
                    : "text-slate-400 hover:text-slate-600"
                }`}
              >
                <Icon className="h-3 w-3" />
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab content */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 text-xs leading-relaxed space-y-3">
        {tab === "definition" && (
          <>
            <Section title="무엇을 의미하는가">
              <p className="text-slate-600">{content.definition.what}</p>
            </Section>
            <Section title="왜 필요한가">
              <p className="text-slate-600">{content.definition.why}</p>
            </Section>
            <Section title="어디서 사용되는가">
              <div className="flex flex-wrap gap-1">
                {content.definition.whereUsed.map((w) => (
                  <span key={w} className="bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded text-[10px]">{w}</span>
                ))}
              </div>
            </Section>
            <Section title="책임 주체">
              <p className="text-slate-600 font-medium bg-amber-50 px-2 py-1.5 rounded border border-amber-200">
                ⚖️ {content.definition.responsibility}
              </p>
            </Section>
            {content.batchSummary && (
              <Section title="배치 영향 요약">
                <div className="space-y-1.5">
                  {content.batchSummary.impactedStages && content.batchSummary.impactedStages.length > 0 && (
                    <div className="flex items-center gap-1.5">
                      <span className="text-slate-400">영향 Stage</span>
                      {content.batchSummary.impactedStages.map((stage) => (
                        <span key={stage} className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">
                          {stage}
                        </span>
                      ))}
                    </div>
                  )}
                  {content.batchSummary.receiveRate != null && (
                    <p className="text-slate-600">기관 결과 수신률: <span className="font-semibold">{content.batchSummary.receiveRate}%</span></p>
                  )}
                  {content.batchSummary.missingInstitutionCount != null && (
                    <p className="text-slate-600">누락 기관 수: <span className="font-semibold">{content.batchSummary.missingInstitutionCount}개</span></p>
                  )}
                  {content.batchSummary.expectedRetryAt && (
                    <p className="text-slate-600">예상 재처리 시각: <span className="font-semibold">{content.batchSummary.expectedRetryAt}</span></p>
                  )}
                </div>
              </Section>
            )}
          </>
        )}

        {tab === "contract" && (
          <>
            {content.dataContract.inputs && (
              <Section title="입력 스키마">
                <table className="w-full text-[10px]">
                  <thead>
                    <tr className="text-slate-400 border-b border-slate-100">
                      <th className="text-left py-1">필드</th>
                      <th className="text-left py-1">타입</th>
                      <th className="text-center py-1">null</th>
                      <th className="text-left py-1">비고</th>
                    </tr>
                  </thead>
                  <tbody>
                    {content.dataContract.inputs.map((f) => (
                      <tr key={f.field} className="border-b border-slate-50">
                        <td className="py-1 font-mono text-slate-700">{f.field}</td>
                        <td className="py-1 text-slate-500">{f.type}</td>
                        <td className="py-1 text-center">{f.nullable ? "✓" : "✗"}</td>
                        <td className="py-1 text-slate-400">{f.note ?? ""}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Section>
            )}
            {content.dataContract.outputs && (
              <Section title="출력 스키마">
                <table className="w-full text-[10px]">
                  <thead>
                    <tr className="text-slate-400 border-b border-slate-100">
                      <th className="text-left py-1">필드</th>
                      <th className="text-left py-1">타입</th>
                      <th className="text-center py-1">null</th>
                      <th className="text-left py-1">비고</th>
                    </tr>
                  </thead>
                  <tbody>
                    {content.dataContract.outputs.map((f) => (
                      <tr key={f.field} className="border-b border-slate-50">
                        <td className="py-1 font-mono text-slate-700">{f.field}</td>
                        <td className="py-1 text-slate-500">{f.type}</td>
                        <td className="py-1 text-center">{f.nullable ? "✓" : "✗"}</td>
                        <td className="py-1 text-slate-400">{f.note ?? ""}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Section>
            )}
            {content.dataContract.refreshCadence && (
              <Section title="갱신 주기">
                <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-600 px-2 py-1 rounded">
                  <Clock className="h-3 w-3" />
                  {content.dataContract.refreshCadence}
                </span>
              </Section>
            )}
          </>
        )}

        {tab === "quality" && (
          <>
            {isStageContext && stageContext && stageDispatchState && (
              <>
                <Section title="Daily Batch Timeline">
                  <div className="rounded-md border border-slate-200 bg-slate-50 p-2.5 text-[11px] text-slate-600 space-y-1">
                    <p className="flex items-center justify-between">
                      <span>{stageContext.examLabel}</span>
                      <span className={`rounded border px-1.5 py-0.5 text-[10px] font-semibold ${STAGE_HOVER_STATE_META[stageDispatchState].badgeClass}`}>
                        {STAGE_HOVER_STATE_META[stageDispatchState].label}
                      </span>
                    </p>
                    <p>기준일(D-1): {batchMeta.baseDate}</p>
                    <p>수신 마감 {batchMeta.receiveDeadline} → 모델 {batchMeta.modelWindow} → 전송 {batchMeta.dispatchTime}</p>
                    {batchMeta.impactedStages?.includes(stageTag as BatchStageTag) && (
                      <p className="text-amber-700">부분 집계 영향 Stage ({stageTag})</p>
                    )}
                  </div>
                </Section>
                <Section title="Model Meta">
                  <div className="rounded-md border border-slate-200 bg-white p-2.5 text-[11px] text-slate-600 space-y-1">
                    {stageContext.processing.map((proc) => (
                      <p key={proc.name}>
                        {proc.name}
                        {proc.version ? <span className="ml-1 text-slate-400 font-mono">{proc.version}</span> : null}
                      </p>
                    ))}
                    <p className="text-slate-500">
                      {stageContext.stageId === "stage2"
                        ? "기관 결과 = 공식 분류 / 모델 신호 = 참고(비진단)"
                        : stageContext.stageId === "stage3"
                        ? "우선순위는 운영 신호이며 임상 판단을 대체하지 않음"
                        : "위험도는 선별/우선순위 신호로 활용"}
                    </p>
                  </div>
                </Section>
                <Section title="Dispatch Log">
                  <table className="w-full text-[10px]">
                    <thead>
                      <tr className="text-slate-400 border-b border-slate-100">
                        <th className="text-left py-1">대상</th>
                        <th className="text-right py-1">전송</th>
                        <th className="text-right py-1">실패/재시도</th>
                        <th className="text-left py-1">SLA</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stageDispatchLogs.map((log) => (
                        <tr key={`${log.stage}-${log.destination}`} className="border-b border-slate-50 text-slate-600">
                          <td className="py-1">{log.destination}</td>
                          <td className="py-1 text-right">{log.sentCount.toLocaleString()}</td>
                          <td className="py-1 text-right">{log.failedCount}/{log.retryCount}</td>
                          <td className="py-1">{log.slaStatus}</td>
                        </tr>
                      ))}
                      {stageDispatchLogs.length === 0 && (
                        <tr>
                          <td className="py-2 text-slate-400" colSpan={4}>전송 로그가 없습니다.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </Section>
              </>
            )}
            {!isStageContext && content.batchSummary?.impactedMetrics && content.batchSummary.impactedMetrics.length > 0 && (
              <Section title="영향 지표">
                <div className="flex flex-wrap gap-1">
                  {content.batchSummary.impactedMetrics.map((metric) => (
                    <span key={metric} className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">
                      {metric}
                    </span>
                  ))}
                </div>
              </Section>
            )}
            {content.qualityAudit.missingRate != null && (
              <Section title="데이터 누락률">
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-slate-100 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full ${content.qualityAudit.missingRate > 5 ? "bg-amber-500" : "bg-emerald-500"}`}
                      style={{ width: `${Math.min(content.qualityAudit.missingRate * 5, 100)}%` }}
                    />
                  </div>
                  <span className="text-slate-600 font-bold">{content.qualityAudit.missingRate}%</span>
                </div>
              </Section>
            )}
            {content.qualityAudit.driftSignals && content.qualityAudit.driftSignals.length > 0 && (
              <Section title="Drift 신호">
                {content.qualityAudit.driftSignals.map((d) => (
                  <div key={d.name} className="flex items-start gap-2 bg-slate-50 p-2 rounded mb-1">
                    <LevelBadge level={d.level} />
                    <div>
                      <p className="font-medium text-slate-700">{d.name}</p>
                      <p className="text-slate-400">{d.note}</p>
                    </div>
                  </div>
                ))}
              </Section>
            )}
            {content.qualityAudit.biasAlerts && content.qualityAudit.biasAlerts.length > 0 && (
              <Section title="편향 알림">
                {content.qualityAudit.biasAlerts.map((b) => (
                  <div key={b.group} className="flex items-start gap-2 bg-slate-50 p-2 rounded mb-1">
                    <LevelBadge level={b.level} />
                    <div>
                      <p className="font-medium text-slate-700">{b.group}</p>
                      <p className="text-slate-400">{b.note}</p>
                    </div>
                  </div>
                ))}
              </Section>
            )}
            {content.qualityAudit.changeLog && content.qualityAudit.changeLog.length > 0 && (
              <Section title="변경 이력">
                <div className="space-y-1.5">
                  {content.qualityAudit.changeLog.map((cl) => (
                    <div key={cl.version + cl.date} className="flex items-start gap-2 border-l-2 border-blue-300 pl-2.5">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-semibold text-blue-600">{cl.version}</span>
                          <span className="text-slate-400">{cl.date}</span>
                        </div>
                        <p className="text-slate-600">{cl.summary}</p>
                        {cl.impact && (
                          <p className="text-slate-400 mt-0.5">영향: {cl.impact}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </Section>
            )}
            {!isStageContext && content.batchSummary?.dispatchLogs && content.batchSummary.dispatchLogs.length > 0 && (
              <Section title="DISPATCH 로그">
                <table className="w-full text-[10px]">
                  <thead>
                    <tr className="text-slate-400 border-b border-slate-100">
                      <th className="text-left py-1">Stage</th>
                      <th className="text-left py-1">대상</th>
                      <th className="text-right py-1">전송</th>
                      <th className="text-right py-1">실패/재시도</th>
                      <th className="text-left py-1">SLA</th>
                    </tr>
                  </thead>
                  <tbody>
                    {content.batchSummary.dispatchLogs.map((log) => (
                      <tr key={`${log.stage}-${log.destination}`} className="border-b border-slate-50 text-slate-600">
                        <td className="py-1 font-semibold">{log.stage}</td>
                        <td className="py-1">{log.destination}</td>
                        <td className="py-1 text-right">{log.sentCount.toLocaleString()}</td>
                        <td className="py-1 text-right">{log.failedCount}/{log.retryCount}</td>
                        <td className="py-1">{log.slaStatus}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Section>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/* ─── Inspector helpers ─── */
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">{title}</h4>
      {children}
    </div>
  );
}

function LevelBadge({ level }: { level: "low" | "mid" | "high" }) {
  const map = {
    low: "bg-emerald-100 text-emerald-700",
    mid: "bg-amber-100 text-amber-700",
    high: "bg-red-100 text-red-700",
  };
  return (
    <span className={`inline-block text-[9px] font-bold px-1.5 py-0.5 rounded ${map[level]}`}>
      {level.toUpperCase()}
    </span>
  );
}

/* ═══════════════════════════════════════════════════════════
   5. ROOT PAGE
   ═══════════════════════════════════════════════════════════ */
export default function ModelCenterPage() {
  const [viewMode, setViewMode] = useState<ViewMode>("ops");
  const [selectedContext, setSelectedContext] = useState<string | null>(null);
  const [inspectorFocusMode, setInspectorFocusMode] = useState<InspectorFocusMode>("default");
  const [inspectorFocusNonce, setInspectorFocusNonce] = useState(0);
  const batchMeta = MOCK_BATCH_META;

  // Refs for scroll-to-stage
  const stageRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // Jump from KPI strip
  const handleJump = useCallback((stageId: StageId) => {
    setSelectedContext(stageId);
    setInspectorFocusMode("default");
    stageRefs.current[stageId]?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, []);

  const handleSelectContext = useCallback((id: string) => {
    setSelectedContext(id);
    setInspectorFocusMode("default");
  }, []);

  const handleOpenStageDetail = useCallback((stageId: StageId) => {
    setSelectedContext(stageId);
    setInspectorFocusMode("stage-detail");
    setInspectorFocusNonce((prev) => prev + 1);
    stageRefs.current[stageId]?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, []);

  // Inspector content
  const inspectorContent = selectedContext ? (MOCK_INSPECTOR[selectedContext] ?? null) : null;

  return (
    <div className="h-full flex flex-col overflow-hidden bg-slate-50">
      {/* ── 고정 안내 배너 ── */}
      <div className="bg-slate-700 text-slate-300 text-[10px] text-center py-1.5 px-4 flex-shrink-0">
        <Info className="inline h-3 w-3 mr-1 -mt-0.5" />
        본 화면은 비식별 집계 기반 운영 대시보드이며, 모델은 판단 보조 신호를 제공합니다.
        최종 행정 조치는 담당 기관의 책임 하에 수행됩니다.
      </div>

      {/* ── Header bar ── */}
      <div className="flex items-center justify-between px-5 py-3 bg-white border-b border-slate-200 flex-shrink-0">
        <div className="flex items-center gap-3">
          <h1 className="text-base font-bold text-slate-800">모델 적용 센터</h1>
          <span className="text-[10px] text-slate-400 bg-slate-100 px-2 py-0.5 rounded">
            최종 업데이트: 2026-02-13 09:00
          </span>
        </div>
        <ViewModeToggle mode={viewMode} onChange={setViewMode} />
      </div>
      <BatchCycleBanner meta={batchMeta} onOpenDetail={() => handleSelectContext("batch-cycle")} />

      {/* ── Main body: 2-column ── */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* ─── Left: scrollable content ─── */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">

          {/* A. Executive Strip */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Pipeline KPI</h2>
              <span className="text-[9px] bg-slate-100 text-slate-400 px-1.5 py-0.5 rounded">
                {viewMode === "ops" ? "운영 지표" : viewMode === "quality" ? "품질 지표" : "감사 지표"}
              </span>
            </div>
            <ModelPipelineSummaryStrip kpis={MOCK_KPIS} viewMode={viewMode} onJump={handleJump} />
          </section>

          {/* B1. Three-Stage Pipeline Flow */}
          <section>
            <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
              3단계 파이프라인 플로우
            </h2>
            <div ref={(el) => { stageRefs.current["stage1"] = el; }}>
              {/* Wrapper for scroll target */}
            </div>
            <ThreeStagePipelineFlow
              stages={MOCK_STAGES}
              viewMode={viewMode}
              batchMeta={batchMeta}
              dispatchLogs={MOCK_DISPATCH_LOGS}
              selectedStage={selectedContext}
              onSelectStage={handleSelectContext}
              onOpenStageDetail={handleOpenStageDetail}
            />
            {/* scroll anchors */}
            {MOCK_STAGES.map((s) => (
              <div key={s.stageId} ref={(el) => { stageRefs.current[s.stageId] = el; }} />
            ))}
          </section>

          {/* B2. Model Use Map */}
          <section>
            <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2">
              Model Use Map — 모델 사용 지도
              <span className="text-[9px] bg-slate-100 text-slate-400 px-1.5 py-0.5 rounded font-normal normal-case">
                노드 클릭 시 우측 Inspector 연동
              </span>
            </h2>
            <ModelUseMap
              nodes={MOCK_NODES}
              edges={MOCK_EDGES}
              selectedNode={selectedContext}
              onSelectNode={handleSelectContext}
              viewMode={viewMode}
            />
          </section>

          {/* Stage 2 라벨 분리 표기 안내 */}
          <section className="bg-white rounded-xl border border-slate-200 p-4">
            <h3 className="text-xs font-bold text-slate-700 mb-2 flex items-center gap-1.5">
              <Info className="h-3.5 w-3.5 text-amber-500" />
              Stage 2 라벨 규칙 — 분리 표기 안내
            </h3>
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 mb-3 text-[11px] font-semibold text-amber-700">
              기관 결과 = 공식 분류 · 모델 신호 = 참고(비진단)
            </div>
            <div className="grid grid-cols-2 gap-3 text-[11px]">
              <div className="bg-amber-50 rounded-lg p-3 border border-amber-200">
                <p className="font-semibold text-amber-700 mb-1">2차 진단 분류 (기관 연계 결과)</p>
                <p className="text-amber-600">의료기관에서 수신한 분류 결과 (AD / MCI / 정상)</p>
                <p className="text-amber-500 mt-1 italic">※ 기관의 검사/판정에 의한 결과</p>
              </div>
              <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
                <p className="font-semibold text-blue-700 mb-1">모델 참고 신호</p>
                <p className="text-blue-600">일치 / 주의 / 검증 필요</p>
                <p className="text-blue-500 mt-1 italic">※ 참고용 보조 신호이며, 진단이 아닙니다</p>
              </div>
            </div>
            {batchMeta.status === "partial" && (
              <p className="mt-3 text-[11px] text-amber-700">
                부분 집계 상태: 수신률 {batchMeta.receiveRate}% · 누락 기관 {batchMeta.missingInstitutionCount}개 · 예상 재처리 {batchMeta.expectedRetryAt}
              </p>
            )}
          </section>

          {/* View mode 설명 */}
          <section className="bg-slate-100/50 rounded-xl border border-slate-200 p-4">
            <h3 className="text-xs font-bold text-slate-600 mb-2 flex items-center gap-1.5">
              <Settings2 className="h-3.5 w-3.5" />
              View Mode 설명
            </h3>
            <div className="grid grid-cols-3 gap-3 text-[10px]">
              <div className={`p-2.5 rounded-lg border ${viewMode === "ops" ? "bg-blue-50 border-blue-300" : "bg-white border-slate-200"}`}>
                <p className="font-semibold text-blue-700">운영 모드</p>
                <p className="text-slate-500 mt-0.5">처리량, 전환율, 병목, 자원</p>
              </div>
              <div className={`p-2.5 rounded-lg border ${viewMode === "quality" ? "bg-amber-50 border-amber-300" : "bg-white border-slate-200"}`}>
                <p className="font-semibold text-amber-700">품질 모드</p>
                <p className="text-slate-500 mt-0.5">누락률, drift, 편향 알림</p>
              </div>
              <div className={`p-2.5 rounded-lg border ${viewMode === "audit" ? "bg-purple-50 border-purple-300" : "bg-white border-slate-200"}`}>
                <p className="font-semibold text-purple-700">감사 모드</p>
                <p className="text-slate-500 mt-0.5">버전/룰 변경, 책임 추적, SLA</p>
              </div>
            </div>
          </section>

        </div>

        {/* ─── Right: Detail Inspector ─── */}
        <div className="w-80 border-l border-slate-200 bg-white flex-shrink-0">
          <DetailInspector
            content={inspectorContent}
            viewMode={viewMode}
            selectedContext={selectedContext}
            stages={MOCK_STAGES}
            batchMeta={batchMeta}
            dispatchLogs={MOCK_DISPATCH_LOGS}
            focusMode={inspectorFocusMode}
            focusNonce={inspectorFocusNonce}
          />
        </div>
      </div>
    </div>
  );
}
