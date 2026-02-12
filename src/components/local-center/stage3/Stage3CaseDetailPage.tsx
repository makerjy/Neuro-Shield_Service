import React, { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock3,
  ExternalLink,
  FileDown,
  LifeBuoy,
  Loader2,
  MessageSquare,
  Phone,
  ShieldAlert,
  ShieldCheck,
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
import { Input } from "../../ui/input";
import { Textarea } from "../../ui/textarea";
import { cn } from "../../ui/utils";
import {
  executeStage3Action,
  getStage3Case,
  requestStage3Support,
} from "./stage3MockApi";
import type { ExecuteActionBody, Stage3Case, SupportRequestBody } from "./stage3Types";

type UiNotice = {
  tone: "success" | "warning" | "error" | "info";
  message: string;
};

interface Stage3CaseDetailPageProps {
  caseId: string;
  onBack: () => void;
}

function formatDateTime(input?: string): string {
  if (!input) return "-";
  const date = new Date(input.includes("T") ? input : input.replace(" ", "T"));
  if (Number.isNaN(date.getTime())) return input;
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate(),
  ).padStart(2, "0")} ${String(date.getHours()).padStart(2, "0")}:${String(
    date.getMinutes(),
  ).padStart(2, "0")}`;
}

function toDday(target?: string): string {
  if (!target) return "미설정";
  const diff = Math.ceil(
    (new Date(`${target}T00:00:00`).getTime() - new Date().setHours(0, 0, 0, 0)) / (1000 * 60 * 60 * 24),
  );
  if (diff === 0) return "D-Day";
  if (diff > 0) return `D-${diff}`;
  return `D+${Math.abs(diff)}`;
}

function statusLabel(status: Stage3Case["status"]): string {
  if (status === "attrition_risk") return "이탈위험";
  if (status === "on_hold") return "보류";
  if (status === "completed") return "완료";
  return "진행중";
}

function zoneTone(zone: Stage3Case["risk"]["zone"]): string {
  if (zone === "danger") return "border-red-200 bg-red-50 text-red-800";
  if (zone === "watch") return "border-amber-200 bg-amber-50 text-amber-800";
  return "border-emerald-200 bg-emerald-50 text-emerald-800";
}

function exportAuditCsv(stage3: Stage3Case) {
  const rows = [
    ["time", "actor", "severity", "message", "logId"],
    ...stage3.audit.map((item) => [
      item.at,
      item.actor.name,
      item.severity ?? "info",
      item.message.replaceAll(",", " "),
      item.logId,
    ]),
  ];
  const blob = new Blob([rows.map((row) => row.join(",")).join("\n")], { type: "text/csv;charset=utf-8" });
  const href = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = href;
  a.download = `${stage3.caseId}-stage3-audit.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(href);
}

function exportAuditPdfView(stage3: Stage3Case) {
  const popup = window.open("", "_blank", "width=900,height=700");
  if (!popup) return;
  const html = `
    <html>
      <head><title>${stage3.caseId} Stage3 Audit</title></head>
      <body style="font-family: sans-serif; padding: 24px;">
        <h2>${stage3.caseId} Stage3 운영 로그</h2>
        <p>운영 기준 보고서 · 담당자 확인 필요</p>
        <hr />
        ${stage3.audit
          .map(
            (item) =>
              `<p><strong>${item.at}</strong> [${item.logId}] ${item.actor.name} · ${item.message}</p>`,
          )
          .join("")}
      </body>
    </html>
  `;
  popup.document.write(html);
  popup.document.close();
  popup.focus();
  popup.print();
}

export function Stage3CaseDetailPage({ caseId, onBack }: Stage3CaseDetailPageProps) {
  const [stage3, setStage3] = useState<Stage3Case | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [notice, setNotice] = useState<UiNotice | null>(null);
  const [pendingActionId, setPendingActionId] = useState<string | null>(null);
  const [actionModal, setActionModal] = useState<Stage3Case["ops"]["recommendedActions"][number] | null>(null);
  const [actionReason, setActionReason] = useState("");
  const [actionOwner, setActionOwner] = useState("");
  const [supportModalOpen, setSupportModalOpen] = useState(false);
  const [supportReason, setSupportReason] = useState("");
  const [mriExpanded, setMriExpanded] = useState(false);
  const [selectedFailTag, setSelectedFailTag] = useState<
    Stage3Case["communication"]["history"][number]["reasonTag"] | null
  >(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setLoadError(null);
    getStage3Case(caseId)
      .then((data) => {
        if (!alive) return;
        setStage3(data);
        setActionOwner(data.owner.name);
      })
      .catch(() => {
        if (!alive) return;
        setLoadError("Stage3 케이스를 불러오지 못했습니다.");
      })
      .finally(() => {
        if (!alive) return;
        setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [caseId]);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 2800);
    return () => clearTimeout(timer);
  }, [notice]);

  const sortedActions = useMemo(() => {
    if (!stage3) return [];
    return [...stage3.ops.recommendedActions].sort((a, b) => {
      if (a.priority !== b.priority) return a.priority - b.priority;
      return (a.dueInDays ?? 999) - (b.dueInDays ?? 999);
    });
  }, [stage3]);

  const primaryAction = sortedActions[0] ?? null;
  const todayActions = sortedActions.filter((item) => (item.dueInDays ?? 0) <= 1).slice(0, 3);
  const weeklyActions = sortedActions.filter((item) => (item.dueInDays ?? 0) > 1 && (item.dueInDays ?? 8) <= 7);

  if (loading) {
    return (
      <div className="flex min-h-[420px] items-center justify-center rounded-xl border border-slate-200 bg-white">
        <p className="flex items-center gap-2 text-sm text-slate-600">
          <Loader2 className="h-4 w-4 animate-spin" />
          Stage3 운영 워크스테이션 로딩 중...
        </p>
      </div>
    );
  }

  if (loadError || !stage3) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-800">
        {loadError ?? "데이터를 확인할 수 없습니다."}
      </div>
    );
  }

  const runOptimistic = async (
    action: Stage3Case["ops"]["recommendedActions"][number],
    reasonText: string,
    ownerName: string,
  ) => {
    const previous = stage3;
    const optimisticAudit = {
      at: formatDateTime(new Date().toISOString()),
      actor: { name: ownerName, type: "human" as const },
      message: `실행 요청 전송: ${action.title} · 감사 로그 기록 중...`,
      logId: `TMP-${Date.now()}`,
      severity: "info" as const,
    };

    setStage3({
      ...previous,
      audit: [optimisticAudit, ...previous.audit],
      ops: {
        ...previous.ops,
        recommendedActions: previous.ops.recommendedActions.filter((item) => item.id !== action.id),
      },
    });

    try {
      const body: ExecuteActionBody = {
        actionType: action.actionType,
        payload: { ...action.payloadPreview, reason: reasonText, owner: ownerName },
      };
      const result = await executeStage3Action(previous.caseId, body, ownerName);
      setStage3(result.updatedCase);
      setNotice({
        tone: "success",
        message: `${action.title} 완료 · 감사 로그 기록됨`,
      });
    } catch {
      setStage3(previous);
      setNotice({
        tone: "error",
        message: `실행 실패: 요청 전송 단계에서 오류가 발생했습니다. 재시도해 주세요.`,
      });
    } finally {
      setPendingActionId(null);
      setActionModal(null);
      setActionReason("");
    }
  };

  return (
    <div className="min-h-screen bg-[#f4f7fb] pb-6">
      {notice && <ToastBanner notice={notice} />}

      <CaseIdentityBar
        stage3={stage3}
        onBack={onBack}
        onPrimary={() => primaryAction && setActionModal(primaryAction)}
        onSupport={() => setSupportModalOpen(true)}
        primaryDisabled={!primaryAction || pendingActionId != null}
      />

      <div className="mx-auto mt-4 grid max-w-[1440px] grid-cols-1 gap-4 px-4 xl:grid-cols-12 xl:px-6">
        <NextBestActionDock
          className="xl:col-span-3"
          todayActions={todayActions}
          weeklyActions={weeklyActions}
          pendingActionId={pendingActionId}
          onRunAction={setActionModal}
        />

        <section className="space-y-4 xl:col-span-6">
          <StateNarrative stage3={stage3} />
          <KpiTriplet stage3={stage3} />
          <WhatChangedCard stage3={stage3} />
          <TrendPanel stage3={stage3} />
          <TriggerPanel stage3={stage3} />
          <Card className="border-slate-200 bg-white shadow-sm">
            <CardHeader className="border-b border-slate-100 px-4 py-3">
              <CardTitle className="text-sm font-bold text-slate-900">참고 소견(요약)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 px-4 py-4">
              <p className="text-sm text-slate-700">{stage3.findings?.mriSummary ?? "등록된 요약이 없습니다."}</p>
              <button
                type="button"
                className="inline-flex items-center text-xs font-semibold text-blue-700"
                onClick={() => setMriExpanded((prev) => !prev)}
              >
                {mriExpanded ? (
                  <>
                    <ChevronUp className="mr-1 h-3.5 w-3.5" />
                    상세 접기
                  </>
                ) : (
                  <>
                    <ChevronDown className="mr-1 h-3.5 w-3.5" />
                    상세 보기
                  </>
                )}
              </button>
              {mriExpanded && (
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
                  의료진 확인 전 운영 참고로만 사용합니다. 연계 진행/재평가/이탈 방지 순서로 작업합니다.
                </div>
              )}
            </CardContent>
          </Card>
        </section>

        <section className="space-y-4 xl:col-span-3">
          <ContactPanel
            stage3={stage3}
            selectedFailTag={selectedFailTag}
            onSelectFailTag={setSelectedFailTag}
          />
          <ReferralPanel stage3={stage3} />
          <AuditTimeline
            stage3={stage3}
            onExportCsv={() => exportAuditCsv(stage3)}
            onExportPdf={() => exportAuditPdfView(stage3)}
          />
        </section>
      </div>

      <Dialog open={Boolean(actionModal)} onOpenChange={(open) => !open && setActionModal(null)}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>실행 확인</DialogTitle>
            <DialogDescription>
              실행 결과는 운영 기준에 따라 처리되며 감사 로그에 즉시 기록됩니다.
            </DialogDescription>
          </DialogHeader>
          {actionModal && (
            <div className="space-y-3">
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <p className="text-sm font-bold text-slate-900">{actionModal.title}</p>
                <p className="mt-1 text-xs text-slate-600">
                  예정 기한: {actionModal.dueInDays == null ? "미정" : `D-${actionModal.dueInDays}`}
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {actionModal.reasonChips.map((chip) => (
                    <span
                      key={chip}
                      className="rounded-md border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-700"
                    >
                      {chip}
                    </span>
                  ))}
                </div>
                <p className="mt-2 text-xs text-slate-600">
                  감사 로그 미리보기: `{actionModal.actionType}` 실행 + 담당자 + 실행 사유
                </p>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-600">담당자</label>
                <Input value={actionOwner} onChange={(event) => setActionOwner(event.target.value)} />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-600">실행 사유</label>
                <Textarea
                  value={actionReason}
                  onChange={(event) => setActionReason(event.target.value)}
                  placeholder="예: 운영 기준 점검 결과 우선 처리"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setActionModal(null)}>
              취소
            </Button>
            <Button
              className="bg-[#15386a] text-white hover:bg-[#102b4e]"
              disabled={!actionModal || pendingActionId != null}
              onClick={async () => {
                if (!actionModal) return;
                setPendingActionId(actionModal.id);
                await runOptimistic(actionModal, actionReason, actionOwner || stage3.owner.name);
              }}
            >
              {pendingActionId ? <Loader2 className="h-4 w-4 animate-spin" /> : <ExternalLink className="h-4 w-4" />}
              {pendingActionId ? "감사 로그 기록 중..." : "실행"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={supportModalOpen} onOpenChange={setSupportModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>운영 지원 요청</DialogTitle>
            <DialogDescription>
              지원 요청은 경고 등급 로그로 기록되며 담당자 확인이 필요합니다.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Textarea
              value={supportReason}
              onChange={(event) => setSupportReason(event.target.value)}
              placeholder="지원 요청 사유를 입력하세요."
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSupportModalOpen(false)}>
              닫기
            </Button>
            <Button
              className="bg-[#15386a] text-white hover:bg-[#102b4e]"
              onClick={async () => {
                const backup = stage3;
                const optimistic = {
                  ...backup,
                  audit: [
                    {
                      at: formatDateTime(new Date().toISOString()),
                      actor: { name: backup.owner.name, type: "human" as const },
                      message: "운영 지원 요청 전송 중...",
                      logId: `TMP-${Date.now()}`,
                      severity: "warn" as const,
                    },
                    ...backup.audit,
                  ],
                };
                setStage3(optimistic);

                try {
                  const body: SupportRequestBody = {
                    reason: supportReason || "운영 기준 초과 신호 대응",
                    requester: backup.owner.name,
                  };
                  const result = await requestStage3Support(backup.caseId, body);
                  setStage3(result.updatedCase);
                  setSupportModalOpen(false);
                  setSupportReason("");
                  setNotice({ tone: "warning", message: "운영 지원 요청이 접수되었고 감사 로그에 기록되었습니다." });
                } catch {
                  setStage3(backup);
                  setNotice({
                    tone: "error",
                    message: "지원 요청 실패: 요청 등록 단계에서 오류가 발생했습니다.",
                  });
                }
              }}
            >
              <LifeBuoy className="h-4 w-4" />
              요청 전송
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

interface CaseIdentityBarProps {
  stage3: Stage3Case;
  onBack: () => void;
  onPrimary: () => void;
  onSupport: () => void;
  primaryDisabled: boolean;
}

export function CaseIdentityBar({
  stage3,
  onBack,
  onPrimary,
  onSupport,
  primaryDisabled,
}: CaseIdentityBarProps) {
  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 shadow-sm backdrop-blur">
      <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-3 px-4 py-3 xl:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <Button variant="outline" size="icon" onClick={onBack} aria-label="목록으로 이동">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-base font-bold text-slate-900">{stage3.caseId}</h1>
              <Badge className="border-violet-200 bg-violet-50 text-violet-800">Stage 3</Badge>
              <Badge className={cn("border", zoneTone(stage3.risk.zone))}>{statusLabel(stage3.status)}</Badge>
            </div>
            <p className="truncate text-xs text-slate-600">
              담당자 {stage3.owner.name} · 마지막 접촉 {stage3.ops.lastContactAt ?? "-"} · 마지막 평가{" "}
              {stage3.ops.lastAssessmentAt ?? "-"}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2">
          <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] text-slate-600">
            다음 체크포인트 {toDday(stage3.ops.nextCheckpointAt)} ({stage3.ops.nextCheckpointAt ?? "미설정"})
          </span>
          <TriggerChips triggers={stage3.risk.triggers.slice(0, 3)} />
          <Button
            className="h-8 bg-[#15386a] px-3 text-xs font-semibold text-white hover:bg-[#102b4e]"
            onClick={onPrimary}
            disabled={primaryDisabled}
          >
            <ExternalLink className="h-3.5 w-3.5" />
            다음 액션 1순위 실행
          </Button>
          <Button variant="outline" className="h-8 px-3 text-xs font-semibold" onClick={onSupport}>
            <ShieldCheck className="h-3.5 w-3.5" />
            운영 지원 요청
          </Button>
        </div>
      </div>
    </header>
  );
}

interface NextBestActionDockProps {
  className?: string;
  todayActions: Stage3Case["ops"]["recommendedActions"];
  weeklyActions: Stage3Case["ops"]["recommendedActions"];
  pendingActionId: string | null;
  onRunAction: (action: Stage3Case["ops"]["recommendedActions"][number]) => void;
}

export function NextBestActionDock({
  className,
  todayActions,
  weeklyActions,
  pendingActionId,
  onRunAction,
}: NextBestActionDockProps) {
  return (
    <aside className={className}>
      <div className="space-y-4 xl:sticky xl:top-20">
        <Card className="border-slate-200 bg-white shadow-sm">
          <CardHeader className="border-b border-slate-100 px-4 py-3">
            <CardTitle className="text-sm font-bold text-slate-900">Runbook & Action Queue</CardTitle>
            <p className="text-[11px] text-slate-600">오늘 해야 할 일과 이번주 작업을 분리해 실행합니다.</p>
          </CardHeader>
          <CardContent className="space-y-4 px-4 py-4">
            <ActionQueue
              title="오늘 해야 할 일"
              actions={todayActions}
              emptyText="오늘 즉시 처리할 항목이 없습니다."
              pendingActionId={pendingActionId}
              onRunAction={onRunAction}
            />
            <ActionQueue
              title="이번주 내 해야 할 일"
              actions={weeklyActions}
              emptyText="이번주 예약된 후속 작업이 없습니다."
              pendingActionId={pendingActionId}
              onRunAction={onRunAction}
            />
          </CardContent>
        </Card>
      </div>
    </aside>
  );
}

interface ActionQueueProps {
  title: string;
  actions: Stage3Case["ops"]["recommendedActions"];
  emptyText: string;
  pendingActionId: string | null;
  onRunAction: (action: Stage3Case["ops"]["recommendedActions"][number]) => void;
}

export function ActionQueue({
  title,
  actions,
  emptyText,
  pendingActionId,
  onRunAction,
}: ActionQueueProps) {
  return (
    <section>
      <p className="mb-2 text-xs font-bold text-slate-600">{title}</p>
      <div className="space-y-2">
        {actions.length === 0 ? (
          <p className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500">{emptyText}</p>
        ) : (
          actions.map((action) => (
            <ActionCard
              key={action.id}
              action={action}
              isPending={pendingActionId === action.id}
              onRun={() => onRunAction(action)}
            />
          ))
        )}
      </div>
    </section>
  );
}

interface ActionCardProps {
  action: Stage3Case["ops"]["recommendedActions"][number];
  isPending: boolean;
  onRun: () => void;
}

export function ActionCard({ action, isPending, onRun }: ActionCardProps) {
  return (
    <article className="rounded-lg border border-slate-200 bg-slate-50 p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-bold text-slate-900">
          P{action.priority} · {action.title}
        </p>
        <span className="text-[11px] font-semibold text-slate-500">
          {action.dueInDays == null ? "기한 미정" : action.dueInDays <= 0 ? "오늘" : `D-${action.dueInDays}`}
        </span>
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {action.reasonChips.map((chip) => (
          <span key={chip} className="rounded-md border border-slate-200 bg-white px-2 py-0.5 text-[11px] text-slate-700">
            {chip}
          </span>
        ))}
      </div>
      <div className="mt-2 flex items-center justify-between">
        <span className="text-[11px] text-slate-600">예상 소요 3~8분</span>
        <Button size="sm" className="h-7 bg-[#15386a] px-2.5 text-[11px] text-white hover:bg-[#102b4e]" onClick={onRun}>
          {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CalendarClock className="h-3.5 w-3.5" />}
          실행
        </Button>
      </div>
    </article>
  );
}

interface StateNarrativeProps {
  stage3: Stage3Case;
}

export function StateNarrative({ stage3 }: StateNarrativeProps) {
  const narrative = useMemo(() => {
    const scoreDrop = stage3.metrics.scoreChangePct ?? 0;
    const failStreak = stage3.metrics.contactFailStreak ?? 0;
    const activeTriggers = stage3.risk.triggers.filter((item) => item.satisfied).map((item) => item.label);
    return `최근 분기 ${Math.abs(scoreDrop)}% 변화와 연락 실패 ${failStreak}회가 확인되어 ${
      activeTriggers.join(", ") || "운영 기준 점검"
    } 기준으로 추적 강도 ${stage3.risk.intensity}를 유지하는 상태입니다.`;
  }, [stage3]);

  return (
    <Card className="border-slate-200 bg-white shadow-sm">
      <CardHeader className="border-b border-slate-100 px-4 py-3">
        <CardTitle className="text-sm font-bold text-slate-900">현재 상태 요약</CardTitle>
      </CardHeader>
      <CardContent className="px-4 py-4">
        <p className="text-sm text-slate-700">{narrative}</p>
        <p className="mt-2 text-xs text-slate-500">
          운영 기준 문장입니다. 담당자 확인 필요 / 의료진 확인 전 운영 참고로 사용합니다.
        </p>
      </CardContent>
    </Card>
  );
}

interface KpiTripletProps {
  stage3: Stage3Case;
}

export function KpiTriplet({ stage3 }: KpiTripletProps) {
  return (
    <section className="grid grid-cols-1 gap-3 md:grid-cols-3">
      <Card className="border-slate-200 bg-white shadow-sm">
        <CardContent className="px-4 py-4">
          <p className="text-xs text-slate-500">최근 점수(표준화/SD)</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{stage3.metrics.scoreZ?.toFixed(1) ?? "-"}</p>
          <p className="text-xs text-slate-600">직전 대비 {stage3.metrics.scoreChangePct}%</p>
        </CardContent>
      </Card>
      <Card className="border-slate-200 bg-white shadow-sm">
        <CardContent className="px-4 py-4">
          <p className="text-xs text-slate-500">연락 성공률</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{stage3.metrics.contactSuccessRatePct ?? "-"}%</p>
          <ContactStreak failStreak={stage3.metrics.contactFailStreak ?? 0} />
        </CardContent>
      </Card>
      <Card className="border-slate-200 bg-white shadow-sm">
        <CardContent className="px-4 py-4">
          <p className="text-xs text-slate-500">데이터 품질</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{stage3.metrics.dataQualityPct ?? "-"}%</p>
          <DataQualityBadge value={stage3.metrics.dataQualityPct ?? 0} />
        </CardContent>
      </Card>
    </section>
  );
}

function WhatChangedCard({ stage3 }: { stage3: Stage3Case }) {
  const trend = stage3.metrics.trendByQuarter;
  const last = trend[trend.length - 1];
  const prev = trend[trend.length - 2];
  const delta = last && prev ? Number((last.value - prev.value).toFixed(1)) : 0;
  const contact = stage3.communication.history.slice(0, 5);
  const failCount = contact.filter((item) => item.result === "fail").length;

  const items = [
    `직전 분기 대비 점수 변화 ${delta > 0 ? "+" : ""}${delta}`,
    `최근 5회 연락 중 실패 ${failCount}회`,
    `데이터 품질 ${stage3.metrics.dataQualityPct ?? 0}% (${(stage3.metrics.dataQualityPct ?? 0) >= 95 ? "누락 위험 낮음" : "점검 필요"})`,
  ];

  return (
    <Card className="border-slate-200 bg-white shadow-sm">
      <CardHeader className="border-b border-slate-100 px-4 py-3">
        <CardTitle className="text-sm font-bold text-slate-900">최근 분기 대비 변화</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 px-4 py-4">
        {items.map((item) => (
          <p key={item} className="flex items-start gap-2 text-xs text-slate-700">
            <span className="mt-[6px] h-1.5 w-1.5 rounded-full bg-slate-500" />
            {item}
          </p>
        ))}
      </CardContent>
    </Card>
  );
}

interface TrendPanelProps {
  stage3: Stage3Case;
}

export function TrendPanel({ stage3 }: TrendPanelProps) {
  const trend = stage3.metrics.trendByQuarter;
  const threshold = stage3.metrics.threshold ?? -1.8;
  const width = 560;
  const height = 180;
  const padding = 28;
  const values = trend.map((item) => item.value);
  const max = Math.max(...values, threshold);
  const min = Math.min(...values, threshold);
  const range = max - min || 1;

  const points = trend.map((item, index) => {
    const x = padding + (index / Math.max(1, trend.length - 1)) * (width - padding * 2);
    const y = padding + ((max - item.value) / range) * (height - padding * 2);
    return { ...item, x, y };
  });

  const thresholdY = padding + ((max - threshold) / range) * (height - padding * 2);
  const biggestDropIndex = (() => {
    let idx = -1;
    let drop = 0;
    for (let i = 1; i < trend.length; i += 1) {
      const currentDrop = trend[i].value - trend[i - 1].value;
      if (currentDrop < drop) {
        drop = currentDrop;
        idx = i;
      }
    }
    return idx;
  })();

  return (
    <Card className="border-slate-200 bg-white shadow-sm">
      <CardHeader className="border-b border-slate-100 px-4 py-3">
        <CardTitle className="text-sm font-bold text-slate-900">지표 변화 추이</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 px-4 py-4">
        <div className="overflow-x-auto">
          <svg
            width={width}
            height={height}
            role="img"
            aria-label="분기별 점수 추이와 운영 기준 임계치 라인"
            className="max-w-full"
          >
            <line x1={padding} x2={width - padding} y1={thresholdY} y2={thresholdY} stroke="#d97706" strokeDasharray="4 4" strokeWidth="1.5" />
            <title>운영 기준 임계치 {threshold}</title>
            <polyline
              fill="none"
              stroke="#1d4ed8"
              strokeWidth="2.5"
              points={points.map((p) => `${p.x},${p.y}`).join(" ")}
            />
            {points.map((point, idx) => (
              <g key={point.quarter}>
                <circle
                  cx={point.x}
                  cy={point.y}
                  r={idx === biggestDropIndex ? 5 : 4}
                  fill={idx === biggestDropIndex ? "#dc2626" : "#1d4ed8"}
                />
                <title>{`${point.quarter}: ${point.value}`}</title>
                <text x={point.x} y={height - 8} fontSize="10" textAnchor="middle" fill="#475569">
                  {point.quarter}
                </text>
              </g>
            ))}
            <text x={width - padding} y={thresholdY - 6} fontSize="10" textAnchor="end" fill="#b45309">
              운영 기준 임계치 {threshold}
            </text>
          </svg>
        </div>
        <p className="text-xs text-slate-600">
          급변 구간은 붉은 점으로 표시합니다. 툴팁 없이도 운영 기준 초과 여부를 읽을 수 있습니다.
        </p>
      </CardContent>
    </Card>
  );
}

interface TriggerPanelProps {
  stage3: Stage3Case;
}

export function TriggerPanel({ stage3 }: TriggerPanelProps) {
  return (
    <Card className="border-slate-200 bg-white shadow-sm">
      <CardHeader className="border-b border-slate-100 px-4 py-3">
        <CardTitle className="text-sm font-bold text-slate-900">재평가 필요 신호</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 px-4 py-4">
        {stage3.risk.triggers.map((trigger) => (
          <div key={trigger.key} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-semibold text-slate-800">{trigger.label}</p>
              <Badge className={cn("border", trigger.satisfied ? "border-red-200 bg-red-50 text-red-800" : "border-emerald-200 bg-emerald-50 text-emerald-800")}>
                {trigger.satisfied ? "충족" : "미충족"}
              </Badge>
            </div>
            <p className="mt-1 text-[11px] text-slate-600">
              현재값: {trigger.currentValueText} · 기준: {trigger.thresholdText}
            </p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

interface ContactPanelProps {
  stage3: Stage3Case;
  selectedFailTag: Stage3Case["communication"]["history"][number]["reasonTag"] | null;
  onSelectFailTag: (tag: Stage3Case["communication"]["history"][number]["reasonTag"] | null) => void;
}

export function ContactPanel({ stage3, selectedFailTag, onSelectFailTag }: ContactPanelProps) {
  const tags: Stage3Case["communication"]["history"][number]["reasonTag"][] = [
    "부재중",
    "번호오류",
    "시간대부적절",
    "보호자연락필요",
    "수신거부",
  ];
  return (
    <Card className="border-slate-200 bg-white shadow-sm">
      <CardHeader className="border-b border-slate-100 px-4 py-3">
        <CardTitle className="text-sm font-bold text-slate-900">커뮤니케이션</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 px-4 py-4">
        <div className="rounded-md border border-slate-200 bg-slate-50 p-2 text-xs text-slate-700">
          다음 연락 권장 시간대: <strong>{stage3.communication.recommendedTimeSlot ?? "미설정"}</strong>
        </div>
        <div className="space-y-2">
          {stage3.communication.history.slice(0, 5).map((item) => (
            <div key={item.id} className="rounded-md border border-slate-200 px-2 py-1.5">
              <p className="text-[11px] text-slate-500">{item.at}</p>
              <p className="text-xs text-slate-700">
                {item.channel === "call" ? <Phone className="mr-1 inline h-3.5 w-3.5" /> : <MessageSquare className="mr-1 inline h-3.5 w-3.5" />}
                {item.result === "success" ? "연결 성공" : "연결 실패"} · {item.reasonTag}
              </p>
            </div>
          ))}
        </div>
        <div>
          <p className="mb-1 text-xs font-semibold text-slate-600">실패 원인 태그 기록</p>
          <div className="flex flex-wrap gap-1.5">
            {tags.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => onSelectFailTag(selectedFailTag === tag ? null : tag)}
                className={cn(
                  "rounded-md border px-2 py-0.5 text-[11px]",
                  selectedFailTag === tag
                    ? "border-blue-200 bg-blue-50 text-blue-800"
                    : "border-slate-200 bg-white text-slate-700",
                )}
              >
                {tag}
              </button>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

interface ReferralPanelProps {
  stage3: Stage3Case;
}

export function ReferralPanel({ stage3 }: ReferralPanelProps) {
  const statusLabelText =
    stage3.referral.status === "done"
      ? "연계 완료"
      : stage3.referral.status === "in_progress"
        ? "연계 진행"
        : "연계 미시작";
  return (
    <Card className="border-slate-200 bg-white shadow-sm">
      <CardHeader className="border-b border-slate-100 px-4 py-3">
        <CardTitle className="text-sm font-bold text-slate-900">연계 진행</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 px-4 py-4 text-xs text-slate-700">
        <p>기관: {stage3.referral.organization}</p>
        <p>상태: {statusLabelText}</p>
        <p>업데이트: {stage3.referral.updatedAt ?? "-"}</p>
        <p>메모: {stage3.referral.ownerNote ?? "-"}</p>
      </CardContent>
    </Card>
  );
}

interface AuditTimelineProps {
  stage3: Stage3Case;
  onExportCsv: () => void;
  onExportPdf: () => void;
}

export function AuditTimeline({ stage3, onExportCsv, onExportPdf }: AuditTimelineProps) {
  return (
    <Card className="border-slate-200 bg-white shadow-sm">
      <CardHeader className="border-b border-slate-100 px-4 py-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-sm font-bold text-slate-900">감사 로그</CardTitle>
          <div className="flex gap-1.5">
            <Button variant="outline" size="sm" className="h-7 px-2 text-[11px]" onClick={onExportCsv}>
              <FileDown className="h-3.5 w-3.5" />
              CSV
            </Button>
            <Button variant="outline" size="sm" className="h-7 px-2 text-[11px]" onClick={onExportPdf}>
              <FileDown className="h-3.5 w-3.5" />
              PDF
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="max-h-[320px] space-y-2 overflow-auto px-4 py-4">
        {stage3.audit.map((item) => (
          <div key={item.logId} className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1.5">
            <p className="text-[11px] text-slate-500">
              {item.at} · {item.logId}
            </p>
            <p className="text-xs font-semibold text-slate-700">{item.actor.name}</p>
            <p className="text-xs text-slate-700">{item.message}</p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function TriggerChips({
  triggers,
}: {
  triggers: Stage3Case["risk"]["triggers"];
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {triggers.map((trigger) => (
        <span
          key={trigger.key}
          className={cn(
            "rounded-md border px-2 py-0.5 text-[11px] font-semibold",
            trigger.satisfied
              ? "border-red-200 bg-red-50 text-red-800"
              : "border-emerald-200 bg-emerald-50 text-emerald-800",
          )}
        >
          {trigger.label}
        </span>
      ))}
    </div>
  );
}

function ContactStreak({ failStreak }: { failStreak: number }) {
  return (
    <div className="mt-2 flex items-center gap-1">
      {Array.from({ length: 5 }).map((_, index) => (
        <span
          key={index}
          className={cn("h-2 w-6 rounded-sm", index < failStreak ? "bg-red-500" : "bg-slate-200")}
          aria-label={`연속 실패 시각화 ${failStreak}회`}
        />
      ))}
      <span className="ml-1 text-[11px] text-slate-600">연속 실패 {failStreak}회</span>
    </div>
  );
}

function DataQualityBadge({ value }: { value: number }) {
  const tone =
    value >= 95
      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
      : value >= 85
        ? "border-amber-200 bg-amber-50 text-amber-800"
        : "border-red-200 bg-red-50 text-red-800";
  const text =
    value >= 95 ? "누락 위험 낮음" : value >= 85 ? "누락 위험 점검 필요" : "누락 위험 높음";
  return (
    <span className={cn("mt-2 inline-flex rounded-md border px-2 py-0.5 text-[11px] font-semibold", tone)}>
      {text}
    </span>
  );
}

function ToastBanner({ notice }: { notice: UiNotice }) {
  const toneClass =
    notice.tone === "success"
      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
      : notice.tone === "warning"
        ? "border-amber-200 bg-amber-50 text-amber-800"
        : notice.tone === "error"
          ? "border-red-200 bg-red-50 text-red-800"
          : "border-blue-200 bg-blue-50 text-blue-800";
  const icon =
    notice.tone === "error" ? (
      <AlertTriangle className="h-4 w-4" />
    ) : notice.tone === "warning" ? (
      <ShieldAlert className="h-4 w-4" />
    ) : notice.tone === "success" ? (
      <CheckCircle2 className="h-4 w-4" />
    ) : (
      <Clock3 className="h-4 w-4" />
    );
  return (
    <div className={cn("fixed right-4 top-20 z-50 flex items-center gap-2 rounded-lg border px-3 py-2 text-xs shadow", toneClass)}>
      {icon}
      {notice.message}
    </div>
  );
}
