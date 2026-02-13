import React from "react";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRightCircle,
  CheckCircle2,
  CircleDashed,
  HelpCircle,
} from "lucide-react";
import { Badge } from "../../ui/badge";
import { Button } from "../../ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../ui/card";
import { cn } from "../../ui/utils";

export type StepDef = {
  id: "S1" | "S2" | "S3" | "S4" | string;
  title: string;
  desc: string;
  status: "DONE" | "IN_PROGRESS" | "WAITING" | "MISSING" | "LOCKED";
  reason: string;
  nextAction: string;
  targetPanelId: string;
};

export type MetricCardDef = {
  key: string;
  title: string;
  value: string;
  sub?: string;
  updatedAt?: string;
  reasons: { text: string; confidence?: "high" | "mid" | "low" }[];
};

export type SummaryCardDef = {
  title: string;
  value: string;
  sub?: string;
  reasons: string[];
};

export type StageDetailConfig = {
  stage: 2 | 3;
  metricCards: MetricCardDef[];
  steps: StepDef[];
  summaryCards: {
    contact: SummaryCardDef;
    progress: SummaryCardDef;
    linkage: SummaryCardDef;
    recent: SummaryCardDef;
  };
};

export type WorkPanelDef = {
  panelId: string;
  title: string;
  description?: string;
  content: React.ReactNode;
};

type KpiStripItem = {
  label: string;
  value: string;
  tone?: "normal" | "warn" | "danger";
};

type PriorityMeta = {
  score: number;
  level: "L0" | "L1" | "L2" | "L3";
  guide: string;
  formulaSummary: string[];
  weightedFactors: string[];
};

type CaseHeaderProps = {
  caseId: string;
  stageLabel: string;
  assignee: string;
  status: string;
  subline: string;
  onBack: () => void;
  onSupportAction: () => void;
  onPrimaryAction: () => void;
};

type StageDetailFrameProps = {
  header: CaseHeaderProps;
  kpiStrip: {
    items: KpiStripItem[];
    note: string;
  };
  config: StageDetailConfig;
  priority: PriorityMeta;
  onOpenStep: (targetPanelId: string) => void;
};

function confidenceTone(confidence?: "high" | "mid" | "low") {
  if (confidence === "high") return "text-emerald-700";
  if (confidence === "low") return "text-red-700";
  return "text-slate-700";
}

function priorityBand(score: number) {
  if (score >= 85) return "긴급";
  if (score >= 65) return "우선";
  if (score >= 45) return "일반";
  return "관찰";
}

function kpiToneClass(tone?: KpiStripItem["tone"]) {
  if (tone === "danger") return "border-red-200 bg-red-50 text-red-800";
  if (tone === "warn") return "border-amber-200 bg-amber-50 text-amber-800";
  return "border-slate-200 bg-white/10 text-white";
}

function flowStatusMeta(status: StepDef["status"]) {
  if (status === "DONE") {
    return {
      label: "완료",
      chip: "border-emerald-200 bg-emerald-50 text-emerald-800",
      card: "border-emerald-200 bg-emerald-50/30",
      reason: "border-emerald-200 bg-white text-emerald-800",
      icon: CheckCircle2,
    };
  }
  if (status === "IN_PROGRESS") {
    return {
      label: "진행중",
      chip: "border-blue-200 bg-blue-50 text-blue-800",
      card: "border-blue-200 bg-blue-50/30",
      reason: "border-blue-200 bg-white text-blue-800",
      icon: CircleDashed,
    };
  }
  if (status === "LOCKED") {
    return {
      label: "잠김",
      chip: "border-amber-200 bg-amber-50 text-amber-800",
      card: "border-amber-200 bg-amber-50/30",
      reason: "border-amber-200 bg-white text-amber-800",
      icon: AlertTriangle,
    };
  }
  if (status === "MISSING") {
    return {
      label: "누락",
      chip: "border-red-200 bg-red-50 text-red-800",
      card: "border-red-200 bg-red-50/30",
      reason: "border-red-200 bg-white text-red-800",
      icon: AlertTriangle,
    };
  }
  return {
    label: "대기",
    chip: "border-slate-200 bg-slate-100 text-slate-700",
    card: "border-slate-200 bg-slate-50/60",
    reason: "border-slate-200 bg-white text-slate-700",
    icon: CircleDashed,
  };
}

function ensureReasonLines(lines: string[]) {
  if (lines.length > 0) return lines.slice(0, 3);
  return ["관련 데이터가 충분하지 않아 확실하지 않음"];
}

export function CaseHeader({
  caseId,
  stageLabel,
  assignee,
  status,
  subline,
  onBack,
  onSupportAction,
  onPrimaryAction,
}: CaseHeaderProps) {
  return (
    <header className="sticky top-0 z-30 rounded-xl border border-slate-200 bg-white/95 px-4 py-3 shadow-sm backdrop-blur md:px-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="icon" onClick={onBack} aria-label="목록으로 이동">
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <h1 className="text-base font-bold text-slate-900 md:text-lg">{caseId}</h1>
            <Badge className="border-blue-200 bg-blue-50 text-blue-800">{stageLabel}</Badge>
            <Badge className="border-slate-200 bg-slate-50 text-slate-700">{status}</Badge>
          </div>
          <p className="text-xs text-slate-600">
            담당자: <span className="font-semibold text-slate-900">{assignee}</span>
          </p>
          <p className="text-[11px] text-slate-500">{subline}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" className="h-8 px-3 text-xs font-semibold" onClick={onSupportAction}>
            운영 지원 요청
          </Button>
          <Button className="h-8 bg-[#15386a] px-3 text-xs font-semibold text-white hover:bg-[#102b4e]" onClick={onPrimaryAction}>
            다음 액션 1순위 실행 <ArrowRightCircle className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </header>
  );
}

export function KpiStrip({ items, note }: { items: KpiStripItem[]; note: string }) {
  return (
    <section className="rounded-xl border border-slate-700 bg-gradient-to-r from-slate-900 to-slate-800 px-4 py-3 text-white shadow-sm">
      <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold">
        {items.map((item) => (
          <span key={item.label} className={cn("rounded-md border px-2 py-1", kpiToneClass(item.tone))}>
            {item.label} {item.value}
          </span>
        ))}
      </div>
      <p className="mt-2 text-[11px] text-slate-200">{note}</p>
    </section>
  );
}

export function DomainMetricCards({ cards }: { cards: MetricCardDef[] }) {
  return (
    <Card className="border-slate-200 bg-white shadow-sm">
      <CardHeader className="border-b border-slate-100 px-4 py-3">
        <CardTitle className="text-sm font-bold text-slate-900">도메인 지표 요약</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-1 gap-2 px-4 py-4 sm:grid-cols-2 xl:grid-cols-3">
        {cards.map((card) => (
          <article key={card.key} className="group relative rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
            <p className="text-[11px] text-slate-500">{card.title}</p>
            <p className="mt-1 text-base font-bold text-slate-900">{card.value}</p>
            {card.sub ? <p className="text-[11px] text-slate-600">{card.sub}</p> : null}
            <p className="mt-1 text-[10px] text-slate-500">업데이트 {card.updatedAt ?? "-"}</p>
            <span className="mt-2 inline-flex cursor-default items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-semibold text-slate-700">
              근거
              <HelpCircle className="h-3 w-3 text-slate-400" />
            </span>

            <div className="pointer-events-none absolute inset-x-2 top-[calc(100%+8px)] z-20 rounded-lg border border-slate-200 bg-white p-2 text-[11px] text-slate-700 opacity-0 shadow-md transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100">
              <p className="font-semibold text-slate-900">운영 근거</p>
              <div className="mt-1 space-y-0.5">
                {ensureReasonLines(card.reasons.map((reason) => reason.text)).map((line) => {
                  const confidence = card.reasons.find((reason) => reason.text === line)?.confidence;
                  return (
                    <p key={`${card.key}-${line}`} className={confidenceTone(confidence)}>
                      - {line}
                    </p>
                  );
                })}
              </div>
            </div>
          </article>
        ))}
      </CardContent>
    </Card>
  );
}

export function PriorityPanel({ score, level, guide, formulaSummary, weightedFactors }: PriorityMeta) {
  const clamped = Math.max(0, Math.min(100, score));
  const band = priorityBand(clamped);
  const bandTone =
    band === "긴급"
      ? "text-red-700 border-red-200 bg-red-50"
      : band === "우선"
        ? "text-orange-700 border-orange-200 bg-orange-50"
        : band === "일반"
          ? "text-blue-700 border-blue-200 bg-blue-50"
          : "text-emerald-700 border-emerald-200 bg-emerald-50";
  const topPercent = Math.max(1, 100 - clamped);

  return (
    <Card className="border-slate-200 bg-white shadow-sm">
      <CardHeader className="border-b border-slate-100 px-4 py-3">
        <CardTitle className="text-sm font-bold text-slate-900">운영 우선도</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 px-4 py-4">
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-3">
          <p className="text-[11px] text-slate-500">현재 점수 / 개입 레벨</p>
          <p className="mt-1 text-3xl font-black text-slate-900">
            {clamped} <span className="text-lg font-bold text-slate-600">/ {level}</span>
          </p>
          <div className="mt-2 flex items-center justify-between text-[11px]">
            <span className={cn("rounded-full border px-2 py-0.5 font-semibold", bandTone)}>{band}</span>
            <span className="text-slate-500">상위 {topPercent}% 대상</span>
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] text-slate-700">
          <div className="group relative inline-flex items-center gap-1 font-semibold">
            계산 방식 요약
            <HelpCircle className="h-3.5 w-3.5 text-slate-400" />
            <div className="pointer-events-none absolute left-0 top-[calc(100%+8px)] z-20 w-72 rounded-lg border border-slate-200 bg-white p-2 text-[11px] text-slate-700 opacity-0 shadow-md transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100">
              <p className="font-semibold text-slate-900">계산 근거</p>
              <div className="mt-1 space-y-0.5">
                {ensureReasonLines(formulaSummary).map((line) => (
                  <p key={`formula-${line}`}>- {line}</p>
                ))}
                {ensureReasonLines(weightedFactors).map((line) => (
                  <p key={`factor-${line}`}>- {line}</p>
                ))}
              </div>
            </div>
          </div>
          <p className="mt-1 text-slate-600">{guide}</p>
        </div>
      </CardContent>
    </Card>
  );
}

export function StageProgressFlow({
  steps,
  onOpenStep,
}: {
  steps: StepDef[];
  onOpenStep: (targetPanelId: string) => void;
}) {
  const completed = steps.filter((step) => step.status === "DONE").length;

  return (
    <Card className="border-slate-200 bg-white shadow-sm">
      <CardHeader className="border-b border-slate-100 px-4 py-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-bold text-slate-900">진행 흐름</CardTitle>
          <span className="text-[11px] text-slate-500">
            {completed}/{steps.length} 단계 완료
          </span>
        </div>
      </CardHeader>
      <CardContent className="grid grid-cols-1 gap-3 px-4 py-4 md:grid-cols-2 xl:grid-cols-4">
        {steps.map((step, index) => {
          const meta = flowStatusMeta(step.status);
          const Icon = meta.icon;
          return (
            <article key={step.id} className={cn("rounded-xl border p-3", meta.card)}>
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-semibold text-slate-500">STEP {index + 1}</span>
                <span className={cn("rounded-full border px-2 py-0.5 text-[10px] font-semibold", meta.chip)}>
                  {meta.label}
                </span>
              </div>
              <div className="mt-2 flex items-center gap-1.5">
                <Icon className="h-4 w-4" />
                <p className="text-sm font-bold text-slate-900">{step.title}</p>
              </div>
              <p className="mt-1 text-[11px] text-slate-600">{step.desc}</p>
              <div className={cn("mt-2 rounded-lg border px-2 py-1.5 text-[11px]", meta.reason)}>
                <p className="font-semibold">상태 사유</p>
                <p className="mt-0.5">{step.reason}</p>
              </div>
              <p className="mt-2 text-[11px] text-slate-700">
                <span className="font-semibold">다음 작업:</span> {step.nextAction}
              </p>
              <Button
                size="sm"
                variant="outline"
                className="mt-2 h-7 w-full text-[11px] font-semibold"
                onClick={() => onOpenStep(step.targetPanelId)}
              >
                작업 열기
              </Button>
            </article>
          );
        })}
      </CardContent>
    </Card>
  );
}

export function SummaryCardsRow({ cards }: { cards: StageDetailConfig["summaryCards"] }) {
  const ordered = [cards.contact, cards.progress, cards.linkage, cards.recent];
  return (
    <section className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
      {ordered.map((card) => (
        <article key={card.title} className="group relative rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
          <p className="text-[11px] text-slate-500">{card.title}</p>
          <p className="mt-1 text-base font-bold text-slate-900">{card.value}</p>
          <p className="mt-1 text-[11px] text-slate-600">{card.sub ?? "-"}</p>
          <span className="mt-2 inline-flex cursor-default items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-semibold text-slate-700">
            운영 근거
            <HelpCircle className="h-3 w-3 text-slate-400" />
          </span>
          <div className="pointer-events-none absolute inset-x-2 top-[calc(100%+8px)] z-20 rounded-lg border border-slate-200 bg-white p-2 text-[11px] text-slate-700 opacity-0 shadow-md transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100">
            {ensureReasonLines(card.reasons).map((line) => (
              <p key={`${card.title}-${line}`}>- {line}</p>
            ))}
          </div>
        </article>
      ))}
    </section>
  );
}

export function WorkPanels({
  panels,
  activePanelId,
  registerPanelRef,
}: {
  panels: WorkPanelDef[];
  activePanelId?: string | null;
  registerPanelRef?: (panelId: string) => (node: HTMLDivElement | null) => void;
}) {
  return (
    <section className="space-y-3">
      {panels.map((panel) => (
        <div
          key={panel.panelId}
          ref={registerPanelRef ? registerPanelRef(panel.panelId) : undefined}
          tabIndex={-1}
          className={cn(
            "rounded-xl transition",
            activePanelId === panel.panelId && "ring-2 ring-blue-300 ring-offset-2",
          )}
        >
          <Card className="border-slate-200 bg-white shadow-sm">
            <CardHeader className="border-b border-slate-100 px-4 py-3">
              <CardTitle className="text-sm font-bold text-slate-900">{panel.title}</CardTitle>
              {panel.description ? <p className="text-[11px] text-slate-600">{panel.description}</p> : null}
            </CardHeader>
            <CardContent className="px-4 py-4">{panel.content}</CardContent>
          </Card>
        </div>
      ))}
    </section>
  );
}

export function StageDetailFrame({ header, kpiStrip, config, priority, onOpenStep }: StageDetailFrameProps) {
  return (
    <div className="space-y-4">
      <CaseHeader {...header} />
      <KpiStrip items={kpiStrip.items} note={kpiStrip.note} />
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <div className="xl:col-span-8">
          <DomainMetricCards cards={config.metricCards} />
        </div>
        <div className="xl:col-span-4">
          <PriorityPanel {...priority} />
        </div>
      </div>
      <StageProgressFlow steps={config.steps} onOpenStep={onOpenStep} />
      <SummaryCardsRow cards={config.summaryCards} />
    </div>
  );
}
