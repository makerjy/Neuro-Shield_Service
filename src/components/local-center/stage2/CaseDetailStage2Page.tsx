import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
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
import { ContactLinkageActionsCard } from "../ContactLinkageActionsCard";
import { CaseDetailPrograms } from "../programs/CaseDetailPrograms";
import {
  CaseHeader as StageCaseHeader,
  KpiStrip,
  PriorityPanel,
  StageProgressFlow,
  type StepDef,
} from "../shared/StageDetailFrame";
import { SmsPanel } from "../sms/SmsPanel";
import type { SmsTemplate } from "../sms/SmsPanel";
import type { SmsHistoryItem } from "../sms/smsService";
import { toPanelTemplates } from "../../../features/sms/templateRegistry";
import {
  executeStage3Action,
  getStage3Case,
  requestStage3Support,
} from "../stage3/stage3MockApi";
import { derivePredictionRecommendedOps, toStage3WorkItems, workItemAutoGen } from "../stage3/stage3ActionRules";
import type {
  ExecuteActionBody,
  InterventionStatus,
  PredictionUiModel,
  RecommendedAction,
  Stage3Case,
  Stage3WorkItem,
  SupportRequestBody,
  TimelineEventType,
} from "../stage3/stage3Types";

type UiNotice = {
  tone: "success" | "warning" | "error" | "info";
  message: string;
};

const STAGE3_SMS_TEMPLATES: SmsTemplate[] = toPanelTemplates("STAGE3");

interface CaseDetailStage2PageProps {
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

function addDaysYmd(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function daysSince(input?: string): number | null {
  if (!input) return null;
  const parsed = new Date(input.includes("T") ? input : input.replace(" ", "T"));
  if (Number.isNaN(parsed.getTime())) return null;
  return Math.floor((Date.now() - parsed.getTime()) / (1000 * 60 * 60 * 24));
}

function statusLabel(status: Stage3Case["status"]): string {
  if (status === "attrition_risk") return "이탈위험";
  if (status === "on_hold") return "보류";
  if (status === "completed") return "완료";
  return "진행중";
}

function operationalStatusLabel(status: Stage3Case["operationalStatus"]): string {
  if (status === "TRACKING") return "추적중";
  if (status === "REEVAL_DUE") return "재평가 임박";
  if (status === "REEVAL_PENDING") return "재평가 대기";
  if (status === "LINKAGE_PENDING") return "연계 대기";
  if (status === "CHURN_RISK") return "이탈 위험";
  return "종결";
}

function planStatusLabel(status: Stage3Case["headerMeta"]["plan_status"]): string {
  if (status === "ACTIVE") return "플랜 활성";
  if (status === "PAUSED") return "플랜 일시중지";
  return "플랜 갱신 필요";
}

function trackingCycleLabel(days: number): string {
  if (days <= 14) return "2주 주기";
  if (days <= 30) return "월간 주기";
  return "분기 주기";
}

function riskTrendLabel(delta: number): "상승" | "하락" | "변동 큼" {
  if (Math.abs(delta) >= 0.1) return "변동 큼";
  if (delta > 0.02) return "상승";
  return "하락";
}

function timeDday(target?: string): string {
  if (!target) return "미정";
  const date = new Date(`${target}T00:00:00`);
  if (Number.isNaN(date.getTime())) return "미정";
  const diff = Math.ceil((date.getTime() - new Date().setHours(0, 0, 0, 0)) / (1000 * 60 * 60 * 24));
  if (diff === 0) return "D-Day";
  if (diff > 0) return `D-${diff}`;
  return `D+${Math.abs(diff)}`;
}

function timelineTypeLabel(type: TimelineEventType): string {
  if (type === "CONTACT") return "연락";
  if (type === "MESSAGE") return "발송";
  if (type === "STATUS") return "상태";
  if (type === "REEVAL_SCHEDULED") return "재평가 일정";
  if (type === "REEVAL_COMPLETED") return "재평가 완료";
  if (type === "REEVAL_NOSHOW") return "재평가 노쇼";
  if (type === "PLAN_UPDATED") return "플랜 갱신";
  if (type === "PROGRAM_STARTED") return "프로그램 시작";
  if (type === "PROGRAM_STOPPED") return "프로그램 중단";
  if (type === "LINKAGE_CREATED") return "연계 생성";
  return "연계 완료";
}

function recommendedActionTypeLabel(type: RecommendedAction["type"]): string {
  if (type === "SCHEDULE_REEVAL") return "재평가 예약 생성";
  if (type === "SEND_REMINDER") return "리마인더 발송";
  if (type === "UPDATE_PLAN") return "플랜 갱신";
  return "추적 강도 상향/지원 요청";
}

function toAgeBand(age: number): string {
  const bucket = Math.max(20, Math.floor(age / 10) * 10);
  return `${bucket}대`;
}

function toPct(probability: number): number {
  return Math.round(probability * 100);
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

function priorityRank(priority: Stage3WorkItem["priority"]): number {
  if (priority === "P0") return 0;
  if (priority === "P1") return 1;
  return 2;
}

function mergeWorkItems(primary: Stage3WorkItem[], fallback: Stage3WorkItem[]): Stage3WorkItem[] {
  const byActionType = new Set<string>();
  const merged: Stage3WorkItem[] = [];
  for (const item of [...primary, ...fallback]) {
    const key = item.actionType ?? item.id;
    if (byActionType.has(key)) continue;
    byActionType.add(key);
    merged.push(item);
  }
  return merged.sort((a, b) => priorityRank(a.priority) - priorityRank(b.priority));
}

function findSignalLinkedAction(
  triggerKey: Stage3Case["risk"]["triggers"][number]["key"],
  actions: Stage3Case["ops"]["recommendedActions"],
) {
  const priorities: Record<Stage3Case["risk"]["triggers"][number]["key"], Stage3Case["ops"]["recommendedActions"][number]["actionType"][]> = {
    score_drop: ["create_reassessment", "adjust_intensity"],
    contact_fail: ["retry_contact", "create_reassessment"],
    missing_exam: ["request_data_completion", "create_reassessment", "adjust_intensity"],
    other: ["request_support"],
  };
  const allowed = priorities[triggerKey] ?? [];
  return actions.find((action) => allowed.includes(action.actionType)) ?? null;
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

export function CaseDetailStage2Page({ caseId, onBack }: CaseDetailStage2PageProps) {
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
  const [qualityDrawerOpen, setQualityDrawerOpen] = useState(false);
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
  const [timelineTab, setTimelineTab] = useState<"ALL" | "CONTACT" | "MESSAGE" | "STATUS">("ALL");
  const [scheduleDraft, setScheduleDraft] = useState({
    nextReevalAt: "",
    nextContactAt: "",
    nextProgramAt: "",
  });
  const [mriExpanded, setMriExpanded] = useState(false);
  const [smsModalOpen, setSmsModalOpen] = useState(false);
  const [linkageModalOpen, setLinkageModalOpen] = useState(false);
  const [selectedFailTag, setSelectedFailTag] = useState<
    Stage3Case["communication"]["history"][number]["reasonTag"] | null
  >(null);
  const [activePanelId, setActivePanelId] = useState<string | null>(null);
  const [workboardFilter, setWorkboardFilter] = useState<"ALL" | "P0" | "P1" | "P2">("ALL");
  const hasLoggedPredictionView = useRef(false);
  const panelRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const registerPanelRef = (panelId: string) => (node: HTMLDivElement | null) => {
    panelRefs.current[panelId] = node;
  };

  useEffect(() => {
    let alive = true;
    hasLoggedPredictionView.current = false;
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

  useEffect(() => {
    if (!stage3) return;
    setScheduleDraft({
      nextReevalAt: stage3.headerMeta.next_reval_at ?? "",
      nextContactAt: stage3.headerMeta.next_contact_at ?? "",
      nextProgramAt: stage3.headerMeta.next_program_at ?? "",
    });
  }, [stage3?.caseId, stage3?.headerMeta.next_reval_at, stage3?.headerMeta.next_contact_at, stage3?.headerMeta.next_program_at]);

  useEffect(() => {
    if (!activePanelId) return;
    const timer = setTimeout(() => setActivePanelId(null), 1800);
    return () => clearTimeout(timer);
  }, [activePanelId]);

  useEffect(() => {
    if (!stage3 || hasLoggedPredictionView.current) return;
    hasLoggedPredictionView.current = true;
    setStage3((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        audit: [
          {
            at: formatDateTime(new Date().toISOString()),
            actor: { name: prev.owner.name, type: "human" as const },
            message: `예측 결과 열람: 24개월 전환위협 확률(추정) ${toPct(prev.prediction.probability)}%`,
            logId: `LOG-${Date.now()}`,
            severity: "info" as const,
          },
          ...prev.audit,
        ],
      };
    });
  }, [stage3]);

  const sortedActions = useMemo(() => {
    if (!stage3) return [];
    return [...stage3.ops.recommendedActions].sort((a, b) => {
      if (a.priority !== b.priority) return a.priority - b.priority;
      return (a.dueInDays ?? 999) - (b.dueInDays ?? 999);
    });
  }, [stage3]);

  const todayActions = sortedActions.filter((item) => (item.dueInDays ?? 0) <= 1).slice(0, 3);
  const weeklyActions = sortedActions.filter((item) => (item.dueInDays ?? 0) > 1 && (item.dueInDays ?? 8) <= 7);
  const predictionAutoWorkItems = useMemo<Stage3WorkItem[]>(() => {
    if (!stage3) return [];
    return workItemAutoGen({
      p: stage3.prediction.probability,
      confidence: stage3.prediction.confidence,
      quality: stage3.metrics.dataQualityPct ?? 0,
      missingCount: Math.max(0, Math.round((100 - (stage3.metrics.dataQualityPct ?? 0)) / 5)),
      trend: stage3.prediction.trend,
      signals: stage3.risk.triggers.map((trigger) => ({
        key: trigger.key,
        label: trigger.label,
        met: trigger.satisfied,
      })),
      referralStatus: stage3.referral.status,
    });
  }, [stage3]);
  const runbookWorkItems = useMemo<Stage3WorkItem[]>(() => toStage3WorkItems(sortedActions), [sortedActions]);
  const workItems = useMemo<Stage3WorkItem[]>(
    () => mergeWorkItems(predictionAutoWorkItems, runbookWorkItems),
    [predictionAutoWorkItems, runbookWorkItems],
  );
  const workboardToday = runbookWorkItems.filter((item) => item.priority === "P0");
  const workboardWeek = runbookWorkItems.filter((item) => item.priority === "P1");
  const workboardLater = runbookWorkItems.filter((item) => item.priority === "P2");

  const openLinkagePanel = () => {
    setLinkageModalOpen(true);
  };

  const logLocalEvent = (
    title: string,
    type: TimelineEventType,
    detail?: string,
    severity: "info" | "warn" = "info",
  ) => {
    setStage3((prev) => {
      if (!prev) return prev;
      const now = formatDateTime(new Date().toISOString());
      return {
        ...prev,
        audit: [
          {
            at: now,
            actor: { name: prev.owner.name, type: "human" },
            message: `${title}${detail ? `: ${detail}` : ""}`,
            logId: `LOG-${Date.now()}`,
            severity,
          },
          ...prev.audit,
        ],
        timeline: [
          {
            id: `${prev.caseId}-tl-${Date.now()}`,
            at: now,
            type,
            title,
            detail,
            actor: { name: prev.owner.name, type: "human" },
          },
          ...prev.timeline,
        ],
      };
    });
  };

  const openQualityDrawer = () => {
    setQualityDrawerOpen(true);
    setStage3((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        audit: [
          {
            at: formatDateTime(new Date().toISOString()),
            actor: { name: prev.owner.name, type: "human" as const },
            message: "데이터 품질 상세 열람: 누락 보완 검토를 시작했습니다.",
            logId: `LOG-${Date.now()}`,
            severity: "info" as const,
          },
          ...prev.audit,
        ],
      };
    });
  };

  const openPanel = (panelId: string) => {
    const target = panelRefs.current[panelId];
    if (!target) return;
    target.scrollIntoView({ behavior: "smooth", block: "start" });
    target.focus({ preventScroll: true });
    setActivePanelId(panelId);
    if (panelId === "stage3-panel-followup") setWorkboardFilter("P0");
    else if (panelId === "stage3-panel-workboard") setWorkboardFilter("P0");
    else if (panelId === "stage3-panel-plan") setWorkboardFilter("P1");
    else if (panelId === "stage3-panel-risk") setWorkboardFilter("P0");
    else setWorkboardFilter("ALL");
  };

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

  const renderProgramProvisionPanel = () => (
    <CaseDetailPrograms
      caseId={stage3.caseId}
      stage={3}
      resultLabel={stage3.risk.zone === "danger" ? "전환위험 관리" : "추적관리"}
      mciSeverity={undefined}
      riskTags={stage3.risk.triggers.filter((t) => t.satisfied).map((t) => t.label)}
      actorId="OP-001"
      actorName={stage3.owner.name}
    />
  );

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

  /* ── SMS 발송 콜백 (SmsPanel 통합) ── */
  const handleStage3SmsSent = (item: SmsHistoryItem) => {
    const now = formatDateTime(new Date().toISOString());
    setStage3((prev) => {
      if (!prev) return prev;
      const nextHistory = [
        {
          id: `${prev.caseId}-sms-${Date.now()}`,
          at: item.at,
          channel: "sms" as const,
          result: item.status === "SENT" ? "success" as const : "fail" as const,
          reasonTag: "부재중" as const,
          note: `${item.templateLabel}${item.note ? ` / ${item.note}` : ""}`,
        },
        ...prev.communication.history,
      ];
      const nextAudit = [
        {
          at: now,
          actor: { name: prev.owner.name, type: "human" as const },
          message: `3차 문자 ${item.mode === "NOW" ? "발송" : "예약"}: ${item.templateLabel} (${item.status})`,
          logId: `LOG-${Date.now()}`,
          severity: "info" as const,
        },
        ...prev.audit,
      ];
      const nextTimeline = [
        {
          id: `${prev.caseId}-tl-${Date.now()}`,
          at: now,
          type: item.type === "BOOKING" ? ("REEVAL_SCHEDULED" as const) : ("MESSAGE" as const),
          title: item.type === "BOOKING" ? "재평가/추적 예약 안내 발송" : "리마인더 발송",
          detail: `${item.templateLabel} (${item.status})`,
          actor: { name: prev.owner.name, type: "human" as const },
        },
        ...prev.timeline,
      ];
      const shouldShiftCheckpoint = item.type === "BOOKING";
      return {
        ...prev,
        communication: { ...prev.communication, history: nextHistory },
        ops: { ...prev.ops, nextCheckpointAt: shouldShiftCheckpoint ? addDaysYmd(7) : prev.ops.nextCheckpointAt },
        audit: nextAudit,
        timeline: nextTimeline,
      };
    });
    setNotice({
      tone: item.status === "SENT" || item.status === "SCHEDULED" ? "success" : "error",
      message: item.status === "SENT" ? "문자 발송이 완료되었습니다." : item.status === "SCHEDULED" ? "문자 예약이 등록되었습니다." : "문자 발송에 실패했습니다.",
    });
  };

  const handleStage3Consultation = (note: string, type: string, templateLabel: string) => {
    const now = formatDateTime(new Date().toISOString());
    setStage3((prev) => {
      if (!prev) return prev;
      const entry = {
        at: now,
        actor: { name: prev.owner.name, type: "human" as const },
        message: `상담 실행 기록: ${type} · ${templateLabel}${note ? ` / ${note}` : ""}`,
        logId: `LOG-${Date.now()}`,
        severity: "info" as const,
      };
      return {
        ...prev,
        audit: [entry, ...prev.audit],
        timeline: [
          {
            id: `${prev.caseId}-tl-${Date.now()}`,
            at: now,
            type: "CONTACT" as const,
            title: "확인 연락 실행",
            detail: `${type} · ${templateLabel}`,
            actor: { name: prev.owner.name, type: "human" as const },
          },
          ...prev.timeline,
        ],
      };
    });
    setNotice({ tone: "info", message: "상담 실행 기록이 저장되었습니다." });
  };

  const activeTriggerCount = stage3.risk.triggers.filter((item) => item.satisfied).length;
  const trend = stage3.metrics.trendByQuarter;
  const recentThreeTrend = trend.slice(-3);
  const recentTrendDirection =
    recentThreeTrend.length < 2
      ? "확실하지 않음"
      : recentThreeTrend[recentThreeTrend.length - 1].value - recentThreeTrend[0].value > 0.1
        ? "상승"
        : recentThreeTrend[recentThreeTrend.length - 1].value - recentThreeTrend[0].value < -0.1
          ? "하락"
          : "유지";
  const dataQualityPct = stage3.metrics.dataQualityPct ?? 0;
  const missingFieldCount = Math.max(0, Math.round((100 - dataQualityPct) / 5));
  const prediction = stage3.prediction;
  const predictionPct = toPct(prediction.probability);
  const predictionTrend = prediction.trend ?? [];
  const predictionDelta =
    predictionTrend.length >= 2
      ? Number((predictionTrend[predictionTrend.length - 1].p - predictionTrend[predictionTrend.length - 2].p).toFixed(2))
      : 0;
  const isPredictionSpike = prediction.probability >= 0.7 || predictionDelta >= 0.1;
  const recommendedOps = derivePredictionRecommendedOps(prediction, dataQualityPct, missingFieldCount);
  const predictionUiModel: PredictionUiModel = {
    prediction,
    dataQualityPct,
    missingCount: missingFieldCount,
    warningCount: activeTriggerCount,
    recommendedOps,
  };
  const interventionStatus: InterventionStatus = {
    state: workItems.length === 0 ? "DONE" : "IN_PROGRESS",
    lastActionAt: stage3.audit[0]?.at,
    nextActionDue: workItems.some((item) => item.priority === "P0") ? "즉시" : undefined,
  };
  const lastInterventionGapDays = daysSince(interventionStatus.lastActionAt);
  const hasExecutionLog = stage3.audit.some((item) => item.message.includes("운영 액션 실행"));
  const combinedP0Count = workItems.filter((item) => item.priority === "P0").length;
  const followupAdherencePct = stage3.metrics.contactSuccessRatePct ?? 0;
  const recentUpdatedAt = stage3.audit[0]?.at ?? prediction.generatedAt;
  const recentThreeSummary =
    recentThreeTrend.length > 0
      ? recentThreeTrend.map((item) => `${item.quarter} ${item.value.toFixed(1)}`).join(" · ")
      : "최근 추이 데이터 없음";
  const referralStateLabel =
    stage3.referral.status === "done"
      ? "연계 완료"
      : stage3.referral.status === "in_progress"
      ? "연계 진행"
      : "연계 미시작";
  const riskZoneLabel =
    stage3.risk.zone === "danger"
      ? "높음"
      : stage3.risk.zone === "watch"
      ? "중간"
      : "낮음";
  const timeline = stage3.timeline ?? [];
  const noResponseCount = stage3.communication.history.filter((item) => item.result === "fail").length;
  const noShowCount = timeline.filter((event) => event.type === "REEVAL_NOSHOW").length;
  const carePlanProgress = Math.max(
    0,
    Math.min(
      100,
      Math.round(
        (followupAdherencePct * 0.5 + (stage3.headerMeta.plan_status === "ACTIVE" ? 30 : stage3.headerMeta.plan_status === "NEEDS_UPDATE" ? 10 : 0)) *
          1.05,
      ),
    ),
  );
  const highestTriggerSeverity: "LOW" | "MID" | "HIGH" =
    stage3.risk.triggers.some((trigger) => trigger.satisfied && (trigger.key === "score_drop" || trigger.key === "contact_fail"))
      ? "HIGH"
      : stage3.risk.triggers.some((trigger) => trigger.satisfied)
      ? "MID"
      : "LOW";
  const pendingApprovalCount = stage3.ops.recommended_actions.filter(
    (item) => item.requires_approval && (item.decision ?? "PENDING") !== "APPROVED",
  ).length;
  const nonMildPendingApprovalCount = stage3.ops.recommended_actions.filter(
    (item) =>
      item.requires_approval &&
      (item.decision ?? "PENDING") !== "APPROVED" &&
      item.severity !== "LOW",
  ).length;
  const baselineReady = Boolean(
    stage3.headerMeta.tracking_cycle_days > 0 &&
      stage3.communication.recommendedTimeSlot &&
      (stage3.subject.maskedPhone || stage3.communication.history.length > 0),
  );
  const step1Status: StepDef["status"] = baselineReady ? "DONE" : "MISSING";
  const step2Status: StepDef["status"] = !baselineReady
    ? "LOCKED"
    : activeTriggerCount > 0
    ? "IN_PROGRESS"
    : "WAITING";
  const step3HasExecution = timeline.some((event) =>
    ["REEVAL_SCHEDULED", "CONTACT", "MESSAGE"].includes(event.type),
  );
  const step3Status: StepDef["status"] = !baselineReady
    ? "LOCKED"
    : nonMildPendingApprovalCount > 0
    ? "LOCKED"
    : step3HasExecution
    ? "DONE"
    : "WAITING";
  const step4Status: StepDef["status"] = !step3HasExecution
    ? "LOCKED"
    : timeline.some((event) => ["LINKAGE_CREATED", "LINKAGE_COMPLETED", "PLAN_UPDATED"].includes(event.type))
    ? "DONE"
    : "IN_PROGRESS";
  const step4Open = step4Status !== "LOCKED";
  const stage3FlowSteps: StepDef[] = [
    {
      id: "S1",
      title: "추적 설정(기준선 확정)",
      desc: "동의/연락채널/보호자/추적주기/베이스라인 확정",
      status: step1Status,
      reason: baselineReady
        ? `추적 주기 ${trackingCycleLabel(stage3.headerMeta.tracking_cycle_days)} · 다음 재평가 ${stage3.headerMeta.next_reval_at ?? "미정"}`
        : "기준선 정보가 부족하여 추적 설정 확정이 필요합니다.",
      nextAction: "추적 주기와 기준선 값을 확인하고 저장합니다.",
      targetPanelId: "stage3-panel-plan",
    },
    {
      id: "S2",
      title: "모니터링 업데이트(신호·트리거)",
      desc: "최근 변화/트리거 생성/검토/승인",
      status: step2Status,
      reason:
        step2Status === "LOCKED"
          ? "STEP1 기준선 확정 전이라 잠김 상태입니다."
          : `활성 트리거 ${activeTriggerCount}건 · 승인 필요 ${pendingApprovalCount}건`,
      nextAction: "트리거 근거를 검토하고 승인/보류를 처리합니다.",
      targetPanelId: "stage3-panel-risk",
    },
    {
      id: "S3",
      title: "재평가·확인 실행",
      desc: "재평가 예약 생성/변경, 확인 연락(리마인더) 및 결과 기록",
      status: step3Status,
      reason:
        step3Status === "LOCKED"
          ? nonMildPendingApprovalCount > 0
            ? "승인 필요 트리거가 미승인 상태여서 잠김(경미 신호는 예외)."
            : "STEP2 완료 전이라 잠김 상태입니다."
          : step3HasExecution
          ? "재평가/확인 연락 실행 기록이 존재합니다."
          : "재평가 예약 또는 확인 연락 실행 기록이 필요합니다.",
      nextAction: "재평가 일정 생성 또는 확인 연락 실행을 기록합니다.",
      targetPanelId: "stage3-panel-workboard",
    },
    {
      id: "S4",
      title: "연계·플랜 갱신",
      desc: "연계 실행 + 플랜 업데이트 + 종결/완화 결정",
      status: step4Status,
      reason:
        step4Status === "LOCKED"
          ? "STEP3 실행 기록이 없어 연계·플랜 갱신이 잠김 상태입니다."
          : `연계 상태 ${referralStateLabel} · 플랜 ${planStatusLabel(stage3.headerMeta.plan_status)}`,
      nextAction: "연계 상태를 갱신하고 케어 플랜을 업데이트합니다.",
      targetPanelId: "stage3-panel-followup",
    },
  ];
  const stage3SlaState =
    combinedP0Count >= 2 || activeTriggerCount >= 3
      ? "주의"
      : combinedP0Count > 0 || activeTriggerCount > 0
      ? "점검중"
      : "정상";
  const stage3KpiStrip = {
    items: [
      {
        label: "SLA",
        value: stage3SlaState,
        tone: stage3SlaState === "주의" ? "danger" : stage3SlaState === "점검중" ? "warn" : "normal",
      },
      {
        label: "데이터 품질",
        value: `${dataQualityPct}%`,
        tone: dataQualityPct < 90 ? "warn" : "normal",
      },
      {
        label: "누락",
        value: `${missingFieldCount}건`,
        tone: missingFieldCount > 0 ? "warn" : "normal",
      },
      {
        label: "경고",
        value: `${activeTriggerCount}건`,
        tone: activeTriggerCount >= 3 ? "danger" : activeTriggerCount > 0 ? "warn" : "normal",
      },
      {
        label: "다음 재평가",
        value: `${timeDday(stage3.headerMeta.next_reval_at)} (${stage3.headerMeta.next_reval_at ?? "미정"})`,
      },
    ] as const,
    note: "운영 참고: 모델/지표는 우선순위 정렬용이며 최종 조치는 담당자·의료진 확인 후 진행합니다.",
  };

  const priorityScore = clampScore(
    predictionPct * 0.55 +
      activeTriggerCount * 11 +
      missingFieldCount * 2.2 +
      (combinedP0Count > 0 ? 10 : 0) +
      (stage3.referral.status !== "done" ? 5 : 0),
  );
  const stage3PriorityMeta = {
    score: priorityScore,
    level: toPriorityLevel(priorityScore),
    guide: `재평가 지연/미응답/연계 대기/이탈 위험을 합산해 우선순위를 정렬합니다.`,
    formulaSummary: [
      "재평가 지연, 노쇼/미응답, 연계 대기, 이탈 위험을 가중 요소로 반영합니다.",
      "가중치 결과는 운영 우선순위 정렬용이며 단정 근거가 아닙니다.",
    ],
    weightedFactors: [
      `재평가 ${timeDday(stage3.headerMeta.next_reval_at)}`,
      `미응답/노쇼 ${noResponseCount + noShowCount}건`,
      `연계 상태 ${referralStateLabel}`,
      `이탈 위험 ${stage3.headerMeta.churn_risk}`,
    ],
  };

  const stage3Header = {
    caseId: stage3.caseId,
    stageLabel: "Stage 3",
    assignee: stage3.owner.name,
    status: operationalStatusLabel(stage3.operationalStatus),
    subline: `다음 재평가 ${stage3.headerMeta.next_reval_at ?? "미정"} · 다음 연락 ${stage3.headerMeta.next_contact_at ?? "미정"} · ${planStatusLabel(stage3.headerMeta.plan_status)} · 연락처 ${stage3.subject.maskedPhone ?? "미등록"}`,
    onBack,
    onSupportAction: () => setSupportModalOpen(true),
    onPrimaryAction: () => {
      if (!primaryAction) {
        setNotice({ tone: "info", message: "실행 가능한 우선 작업이 없습니다." });
        return;
      }
      setActionModal(primaryAction);
    },
  };

  const resolveActionFromWorkItem = (item: Stage3WorkItem | null) => {
    if (!item) return null;
    const byId = sortedActions.find((action) => action.id === item.id);
    if (byId) return byId;
    const byType = item.actionType ? sortedActions.find((action) => action.actionType === item.actionType) : null;
    if (byType) return byType;
    if (!item.actionType) return null;
    const syntheticPriority = item.priority === "P0" ? 0 : item.priority === "P1" ? 1 : 2;
    return {
      id: item.id,
      priority: syntheticPriority as 0 | 1 | 2,
      title: item.title,
      reasonChips: [item.reason],
      dueInDays: item.priority === "P0" ? 0 : item.priority === "P1" ? 3 : 7,
      actionType: item.actionType,
      payloadPreview: item.payloadPreview ?? {},
    };
  };

  const primaryWorkItem = workItems[0] ?? null;
  const primaryAction = resolveActionFromWorkItem(primaryWorkItem);
  const dataCompletionAction =
    sortedActions.find((action) => action.actionType === "request_data_completion") ??
    resolveActionFromWorkItem(
      predictionAutoWorkItems.find((item) => item.actionType === "request_data_completion") ?? null,
    );

  const runSignalLinkedAction = (triggerKey: Stage3Case["risk"]["triggers"][number]["key"]) => {
    const linked = findSignalLinkedAction(triggerKey, sortedActions);
    if (!linked) {
      setNotice({ tone: "info", message: "연결된 개입 작업이 없어 Workboard에서 수동 선택이 필요합니다." });
      return;
    }
    setActionModal(linked);
  };

  const runWorkItem = (item: Stage3WorkItem) => {
    const target = resolveActionFromWorkItem(item);
    if (!target) {
      setNotice({ tone: "info", message: "해당 작업은 이미 처리되었거나 최신 목록에서 제외되었습니다." });
      return;
    }
    setActionModal(target);
  };

  const workflowRailSteps = stage3FlowSteps.map((step) => ({
    ...step,
    railStatus:
      step.status === "DONE"
        ? ("DONE" as const)
        : step.status === "IN_PROGRESS"
        ? ("IN_PROGRESS" as const)
        : step.status === "LOCKED" || step.status === "MISSING"
        ? ("BLOCKED" as const)
        : ("WAITING" as const),
    blockedHint:
      step.status === "LOCKED" || step.status === "MISSING"
        ? "선행 조건을 완료하거나 승인 필요 항목을 처리하세요."
        : undefined,
  }));
  const topRecommendedActions = stage3.ops.recommended_actions.slice(0, 3);
  const pendingRecommendedCount = stage3.ops.recommended_actions.filter(
    (item) => (item.decision ?? "PENDING") === "PENDING",
  ).length;
  const trendChip = riskTrendLabel(predictionDelta);

  const handleRecommendedDecision = (
    target: RecommendedAction,
    decision: "APPROVED" | "HOLD",
  ) => {
    const timelineType: TimelineEventType =
      target.type === "SCHEDULE_REEVAL"
        ? "REEVAL_SCHEDULED"
        : target.type === "SEND_REMINDER"
        ? "MESSAGE"
        : target.type === "UPDATE_PLAN"
        ? "PLAN_UPDATED"
        : "STATUS";
    const decisionLabel = decision === "APPROVED" ? "승인" : "보류";
    setStage3((prev) => {
      if (!prev) return prev;
      const now = formatDateTime(new Date().toISOString());
      return {
        ...prev,
        ops: {
          ...prev.ops,
          recommended_actions: prev.ops.recommended_actions.map((item) =>
            item.id === target.id ? { ...item, decision } : item,
          ),
        },
        audit: [
          {
            at: now,
            actor: { name: prev.owner.name, type: "human" },
            message: `권고 액션 ${decisionLabel}: ${target.title}`,
            logId: `LOG-${Date.now()}`,
            severity: decision === "APPROVED" ? "info" : "warn",
          },
          ...prev.audit,
        ],
        timeline: [
          {
            id: `${prev.caseId}-tl-${Date.now()}`,
            at: now,
            type: timelineType,
            title: `${target.title} ${decisionLabel}`,
            detail: target.reason,
            actor: { name: prev.owner.name, type: "human" },
          },
          ...prev.timeline,
        ],
      };
    });
    setNotice({
      tone: decision === "APPROVED" ? "success" : "warning",
      message: `${target.title} ${decisionLabel} 처리됨 (감사 로그/타임라인 기록)`,
    });
  };

  const openLinkageWithGate = () => {
    if (!step4Open) {
      setNotice({
        tone: "warning",
        message: "Step4는 Step3 실행 기록(재평가 예약/확인 연락)이 있어야 열립니다.",
      });
      return;
    }
    logLocalEvent("연계 실행 패널 열기", "LINKAGE_CREATED", "연계 유형 선택 대기");
    openLinkagePanel();
  };

  const saveScheduleMeta = () => {
    setStage3((prev) => {
      if (!prev) return prev;
      const now = formatDateTime(new Date().toISOString());
      return {
        ...prev,
        headerMeta: {
          ...prev.headerMeta,
          next_reval_at: scheduleDraft.nextReevalAt || undefined,
          next_contact_at: scheduleDraft.nextContactAt || undefined,
          next_program_at: scheduleDraft.nextProgramAt || undefined,
          plan_status: "ACTIVE",
        },
        ops: {
          ...prev.ops,
          nextCheckpointAt: scheduleDraft.nextReevalAt || prev.ops.nextCheckpointAt,
        },
        audit: [
          {
            at: now,
            actor: { name: prev.owner.name, type: "human" },
            message: "다음 예정 일정이 갱신되었습니다.",
            logId: `LOG-${Date.now()}`,
            severity: "info",
          },
          ...prev.audit,
        ],
        timeline: [
          {
            id: `${prev.caseId}-tl-${Date.now()}`,
            at: now,
            type: "PLAN_UPDATED",
            title: "다음 일정 변경",
            detail: `재평가 ${scheduleDraft.nextReevalAt || "-"} / 연락 ${scheduleDraft.nextContactAt || "-"} / 프로그램 ${scheduleDraft.nextProgramAt || "-"}`,
            actor: { name: prev.owner.name, type: "human" },
          },
          ...prev.timeline,
        ],
      };
    });
    setScheduleModalOpen(false);
    setNotice({ tone: "success", message: "일정 변경이 기록되었습니다." });
  };

  const filteredTimeline = timeline.filter((item) => {
    if (timelineTab === "ALL") return true;
    if (timelineTab === "CONTACT") return item.type === "CONTACT";
    if (timelineTab === "MESSAGE") return item.type === "MESSAGE";
    return item.type === "STATUS" || item.type === "PLAN_UPDATED" || item.type === "LINKAGE_COMPLETED" || item.type === "LINKAGE_CREATED";
  });
  const autoLogs = timeline.filter((item) => item.actor.type === "system");

  return (
    <div className="min-h-screen bg-[#f4f7fb] pb-6">
      {notice && <ToastBanner notice={notice} />}
      <main className="mx-auto mt-4 w-full max-w-[1320px] space-y-4 px-4 xl:px-6">
        <StageCaseHeader {...stage3Header} />
        <KpiStrip items={[...stage3KpiStrip.items]} note={stage3KpiStrip.note} />
        <Stage3TopSummaryStrip
          predictionUiModel={predictionUiModel}
          primaryActionTitle={primaryAction?.title ?? "우선 작업 없음"}
          onOpenPrediction={() => openPanel("stage3-panel-prediction")}
          onOpenQuality={openQualityDrawer}
          onOpenDrivers={() => openPanel("stage3-panel-risk")}
          onOpenWorkboard={() => openPanel("stage3-panel-workboard")}
        />

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
          <aside className="space-y-4 xl:col-span-3">
            <Card className="border-slate-200 bg-white shadow-sm">
              <CardHeader className="border-b border-slate-100 px-4 py-3">
                <CardTitle className="text-sm font-bold text-slate-900">Stage3 운영 요약</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 px-4 py-4">
                <SummaryStatCard
                  title="AD 전환 위험(운영용)"
                  value={`${predictionPct}% · ${riskZoneLabel}`}
                  helper={`${trendChip} · 산출 ${prediction.generatedAt}`}
                />
                <SummaryStatCard
                  title="재평가 필요도"
                  value={`트리거 ${activeTriggerCount}건 · ${highestTriggerSeverity}`}
                  helper={pendingApprovalCount > 0 ? "승인 필요" : "승인 대기 없음"}
                  tone={pendingApprovalCount > 0 ? "warn" : "normal"}
                />
                <SummaryStatCard
                  title="추적 준수도"
                  value={`SLA ${followupAdherencePct}%`}
                  helper={`미응답 ${noResponseCount} · 노쇼 ${noShowCount}`}
                />
                <SummaryStatCard
                  title="케어 플랜"
                  value={`진행률 ${carePlanProgress}%`}
                  helper={`다음 일정 ${stage3.headerMeta.next_program_at ?? "미정"}`}
                />
                <SummaryStatCard
                  title="데이터 품질"
                  value={`${dataQualityPct}%`}
                  helper={`누락 ${missingFieldCount} · 경고 ${activeTriggerCount}`}
                  tone={missingFieldCount > 0 ? "warn" : "normal"}
                />
              </CardContent>
            </Card>
            <PriorityPanel {...stage3PriorityMeta} />
            <Stage3WorkflowRail steps={workflowRailSteps} onOpenStep={openPanel} />
          </aside>

          <section className="space-y-4 xl:col-span-6">
            <div
              ref={registerPanelRef("stage3-panel-plan")}
              tabIndex={-1}
              className={cn(
                "rounded-xl transition",
                activePanelId === "stage3-panel-plan" && "ring-2 ring-blue-300 ring-offset-2",
              )}
            >
              <StageProgressFlow steps={stage3FlowSteps} onOpenStep={openPanel} />
            </div>

            <div
              ref={registerPanelRef("stage3-panel-prediction")}
              tabIndex={-1}
              className={cn(
                "rounded-xl transition",
                activePanelId === "stage3-panel-prediction" && "ring-2 ring-blue-300 ring-offset-2",
              )}
            >
              <PredictionInterpretationBlock
                model={predictionUiModel}
                isPredictionSpike={isPredictionSpike}
                onOpenQuality={openQualityDrawer}
              />
            </div>

            <div
              ref={registerPanelRef("stage3-panel-risk")}
              tabIndex={-1}
              className={cn(
                "rounded-xl transition",
                activePanelId === "stage3-panel-risk" && "ring-2 ring-blue-300 ring-offset-2",
              )}
            >
              <TrendPanel stage3={stage3} />
            </div>

            <div
              ref={registerPanelRef("stage3-panel-update")}
              tabIndex={-1}
              className={cn(
                "rounded-xl transition",
                activePanelId === "stage3-panel-update" && "ring-2 ring-blue-300 ring-offset-2",
              )}
            >
              <TriggerPanel stage3={stage3} onRunSignalAction={runSignalLinkedAction} />
            </div>
          </section>

          <aside className="space-y-4 xl:col-span-3">
            <div
              ref={registerPanelRef("stage3-panel-workboard")}
              tabIndex={-1}
              className={cn(
                "rounded-xl transition",
                activePanelId === "stage3-panel-workboard" && "ring-2 ring-blue-300 ring-offset-2",
              )}
            >
              <Card className="border-slate-200 bg-white shadow-sm">
                <CardHeader className="border-b border-slate-100 px-4 py-3">
                  <CardTitle className="text-sm font-bold text-slate-900">Workboard</CardTitle>
                  <p className="text-[11px] text-slate-600">Stage1 상세 프레임을 유지하고 Stage3 개입 큐로 치환했습니다.</p>
                </CardHeader>
                <CardContent className="px-0 py-0">
                  <WorkboardPanel
                    predictionBased={predictionAutoWorkItems}
                    today={workboardToday}
                    thisWeek={workboardWeek}
                    later={workboardLater}
                    filter={workboardFilter}
                    pendingActionId={pendingActionId}
                    onRunWorkItem={runWorkItem}
                  />
                </CardContent>
              </Card>
            </div>

            <div
              ref={registerPanelRef("stage3-panel-schedule")}
              tabIndex={-1}
              className={cn(
                "rounded-xl transition",
                activePanelId === "stage3-panel-schedule" && "ring-2 ring-blue-300 ring-offset-2",
              )}
            >
              <Card className="border-slate-200 bg-white shadow-sm">
                <CardHeader className="border-b border-slate-100 px-4 py-3">
                  <CardTitle className="text-sm font-bold text-slate-900">다음 예정 일정</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 px-4 py-4 text-xs text-slate-700">
                  <p>다음 재평가: {stage3.headerMeta.next_reval_at ?? "미정"} ({timeDday(stage3.headerMeta.next_reval_at)})</p>
                  <p>다음 연락: {stage3.headerMeta.next_contact_at ?? "미정"}</p>
                  <p>다음 프로그램: {stage3.headerMeta.next_program_at ?? "미정"}</p>
                  <Button variant="outline" className="h-7 w-full text-[11px] font-semibold" onClick={() => setScheduleModalOpen(true)}>
                    일정 변경
                  </Button>
                </CardContent>
              </Card>
            </div>

            <Card className="border-slate-200 bg-white shadow-sm">
              <CardHeader className="border-b border-slate-100 px-4 py-3">
                <CardTitle className="text-sm font-bold text-slate-900">트리거/권고 액션</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 px-4 py-4">
                {topRecommendedActions.length === 0 ? (
                  <p className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs text-slate-600">권고 액션이 없습니다.</p>
                ) : (
                  topRecommendedActions.map((item) => (
                    <article key={item.id} className="rounded-md border border-slate-200 bg-slate-50 p-2">
                      <p className="text-xs font-semibold text-slate-900">{recommendedActionTypeLabel(item.type)}</p>
                      <p className="mt-0.5 text-[11px] text-slate-700">{item.reason}</p>
                      <div className="mt-1 flex items-center gap-1 text-[10px] text-slate-500">
                        <span>심각도 {item.severity}</span>
                        <span>·</span>
                        <span>{item.requires_approval ? "승인 필요" : "자동 반영 가능"}</span>
                      </div>
                      <div className="mt-2 grid grid-cols-2 gap-1">
                        <Button size="sm" className="h-7 text-[11px]" onClick={() => handleRecommendedDecision(item, "APPROVED")}>
                          승인
                        </Button>
                        <Button size="sm" variant="outline" className="h-7 text-[11px]" onClick={() => handleRecommendedDecision(item, "HOLD")}>
                          보류
                        </Button>
                      </div>
                    </article>
                  ))
                )}
                <p className="text-[11px] text-slate-500">대기 중 권고 {pendingRecommendedCount}건</p>
              </CardContent>
            </Card>

            <Card className="border-slate-200 bg-white shadow-sm">
              <CardHeader className="border-b border-slate-100 px-4 py-3">
                <CardTitle className="text-sm font-bold text-slate-900">확인 연락/리마인더 발송</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 px-4 py-4">
                <p className="text-xs text-slate-700">전화/문자 실행은 담당자가 수행합니다.</p>
                <Button
                  variant="outline"
                  className="h-8 w-full text-[11px] font-semibold"
                  onClick={() => {
                    logLocalEvent("사람 직접 연락 실행", "CONTACT", "확인 연락 워크플로우 진입");
                    setSmsModalOpen(true);
                  }}
                >
                  사람 직접 연락(확인)
                </Button>
                <Button
                  variant="outline"
                  className="h-8 w-full text-[11px] font-semibold"
                  onClick={() => {
                    logLocalEvent("리마인더 자동 발송 실행", "MESSAGE", "Agent 발송 워크플로우 진입");
                    setSmsModalOpen(true);
                  }}
                >
                  Agent 발송(리마인더 자동)
                </Button>
                <Button
                  className="h-8 w-full bg-[#15386a] text-[11px] font-semibold text-white hover:bg-[#102b4e]"
                  onClick={() => {
                    logLocalEvent("확인 연락/리마인더 실행 열기", "STATUS");
                    setSmsModalOpen(true);
                  }}
                >
                  실행 열기
                </Button>
                {(selectedFailTag === "수신거부" || selectedFailTag === "보호자연락필요") && (
                  <p className="rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] text-amber-900">
                    민감 이력 경고: 실행 전 담당자 확인 필요
                  </p>
                )}
              </CardContent>
            </Card>

            <div
              ref={registerPanelRef("stage3-panel-followup")}
              tabIndex={-1}
              className={cn(
                "rounded-xl transition",
                activePanelId === "stage3-panel-followup" && "ring-2 ring-blue-300 ring-offset-2",
              )}
            >
              <ContactLinkageActionsCard
                stageLabel="3차"
                onOpenContact={() => {
                  logLocalEvent("상담/문자 실행 열기", "CONTACT");
                  setSmsModalOpen(true);
                }}
                onOpenLinkage={openLinkageWithGate}
                linkageButtonLabel={step4Open ? "연계 실행" : "연계 실행 (Step4 잠김)"}
                linkageDescription={step4Open ? "연계 실행 시 타임라인/감사 로그를 기록합니다." : "Step3 실행 기록이 있어야 연계를 열 수 있습니다."}
              />
              <div className="mt-2">
                <ReferralPanel stage3={stage3} />
              </div>
            </div>
          </aside>
        </div>

        <div ref={registerPanelRef("stage3-panel-audit")} tabIndex={-1}>
          <Card className="border-slate-200 bg-white shadow-sm">
            <CardHeader className="border-b border-slate-100 px-4 py-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <CardTitle className="text-sm font-bold text-slate-900">타임라인</CardTitle>
                <div className="flex gap-1.5">
                  <Button variant={timelineTab === "ALL" ? "default" : "outline"} size="sm" className="h-7 text-[11px]" onClick={() => setTimelineTab("ALL")}>전체</Button>
                  <Button variant={timelineTab === "CONTACT" ? "default" : "outline"} size="sm" className="h-7 text-[11px]" onClick={() => setTimelineTab("CONTACT")}>연락</Button>
                  <Button variant={timelineTab === "MESSAGE" ? "default" : "outline"} size="sm" className="h-7 text-[11px]" onClick={() => setTimelineTab("MESSAGE")}>발송</Button>
                  <Button variant={timelineTab === "STATUS" ? "default" : "outline"} size="sm" className="h-7 text-[11px]" onClick={() => setTimelineTab("STATUS")}>상태</Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-4 px-4 py-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
              <div className="space-y-2">
                {filteredTimeline.length === 0 ? (
                  <p className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">해당 필터의 타임라인 기록이 없습니다.</p>
                ) : (
                  filteredTimeline.map((event) => (
                    <article key={event.id} className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
                      <p className="text-[11px] text-slate-500">{event.at} · {timelineTypeLabel(event.type)}</p>
                      <p className="text-xs font-semibold text-slate-900">{event.title}</p>
                      {event.detail ? <p className="text-[11px] text-slate-700">{event.detail}</p> : null}
                    </article>
                  ))
                )}
              </div>
              <div className="space-y-2">
                <p className="text-xs font-semibold text-slate-700">자동 수행 로그</p>
                {autoLogs.length === 0 ? (
                  <p className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                    자동 수행 기록 없음 — 운영자가 수동 실행했거나 아직 제안이 승인되지 않았습니다.
                  </p>
                ) : (
                  autoLogs.slice(0, 6).map((event) => (
                    <article key={event.id} className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
                      <p className="text-[11px] text-slate-500">{event.at}</p>
                      <p className="text-xs text-slate-800">{event.title}</p>
                    </article>
                  ))
                )}
                <AuditTimeline
                  stage3={stage3}
                  onExportCsv={() => exportAuditCsv(stage3)}
                  onExportPdf={() => exportAuditPdfView(stage3)}
                />
              </div>
            </CardContent>
          </Card>
        </div>
      </main>

      <Dialog open={qualityDrawerOpen} onOpenChange={setQualityDrawerOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>데이터 품질 상세</DialogTitle>
            <DialogDescription>
              누락/품질 상태는 예측 확률의 확실성에 영향을 줄 수 있어 담당자 확인이 필요합니다.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 text-sm text-slate-700">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <p>데이터 품질: {dataQualityPct}%</p>
              <p>누락 항목: {missingFieldCount}건</p>
              <p>경고 신호: {activeTriggerCount}건</p>
              <p>신뢰 수준: {prediction.confidence}</p>
            </div>
            {missingFieldCount > 0 || prediction.confidence === "LOW" ? (
              <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                누락 영향으로 확실하지 않음(추정치 변동 가능). 누락 보완 요청(P0)을 권장합니다.
              </p>
            ) : (
              <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-900">
                누락 위험이 낮아 운영 참고용 해석 안정성이 상대적으로 높은 상태입니다.
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setQualityDrawerOpen(false)}>
              닫기
            </Button>
            <Button
              className="bg-[#15386a] text-white hover:bg-[#102b4e]"
              disabled={!dataCompletionAction}
              onClick={() => {
                if (!dataCompletionAction) return;
                setQualityDrawerOpen(false);
                setActionModal(dataCompletionAction);
              }}
            >
              누락 보완 요청(P0)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={scheduleModalOpen} onOpenChange={setScheduleModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>다음 예정 일정 변경</DialogTitle>
            <DialogDescription>재평가/연락/프로그램 일정을 운영 기준에 맞게 갱신합니다.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-600">다음 재평가</label>
              <Input
                type="date"
                value={scheduleDraft.nextReevalAt}
                onChange={(event) => setScheduleDraft((prev) => ({ ...prev, nextReevalAt: event.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-600">다음 연락</label>
              <Input
                type="date"
                value={scheduleDraft.nextContactAt}
                onChange={(event) => setScheduleDraft((prev) => ({ ...prev, nextContactAt: event.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-600">다음 프로그램</label>
              <Input
                type="date"
                value={scheduleDraft.nextProgramAt}
                onChange={(event) => setScheduleDraft((prev) => ({ ...prev, nextProgramAt: event.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setScheduleModalOpen(false)}>
              닫기
            </Button>
            <Button className="bg-[#15386a] text-white hover:bg-[#102b4e]" onClick={saveScheduleMeta}>
              저장
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* SMS 모달 */}
      <Dialog open={smsModalOpen} onOpenChange={setSmsModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-0">
          <SmsPanel
            stageLabel="3차"
            templates={STAGE3_SMS_TEMPLATES}
            defaultVars={{
              centerName: "강남구 치매안심센터",
            }}
            caseId={stage3.caseId}
            citizenPhone={stage3.subject.maskedPhone ?? "010-****-1234"}
            guardianPhone={undefined}
            onSmsSent={(item) => {
              handleStage3SmsSent(item);
            }}
            onConsultation={handleStage3Consultation}
          />
        </DialogContent>
      </Dialog>

      {/* 연계 모달 */}
      <Dialog open={linkageModalOpen} onOpenChange={setLinkageModalOpen}>
        <DialogContent
          className="!left-1/2 !top-1/2 !translate-x-[-50%] !translate-y-[-50%] !max-w-none gap-0 overflow-hidden p-0"
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
                    운영 규칙: 단정 표현 금지. 안내·확인·연계 톤 사용. 목적 고지 필수.
                  </DialogDescription>
            </DialogHeader>
            <div className="min-h-0 flex-1 overflow-auto px-4 py-4">
              <div className="min-w-[1080px]">{renderProgramProvisionPanel()}</div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

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

interface Stage3TopSummaryStripProps {
  predictionUiModel: PredictionUiModel;
  primaryActionTitle: string;
  onOpenPrediction: () => void;
  onOpenQuality: () => void;
  onOpenDrivers: () => void;
  onOpenWorkboard: () => void;
}

function Stage3TopSummaryStrip({
  predictionUiModel,
  primaryActionTitle,
  onOpenPrediction,
  onOpenQuality,
  onOpenDrivers,
  onOpenWorkboard,
}: Stage3TopSummaryStripProps) {
  const probabilityPct = toPct(predictionUiModel.prediction.probability);
  const topDriverText = predictionUiModel.prediction.topDrivers
    .slice(0, 3)
    .map((driver) => driver.label)
    .join(", ");
  const recommendedOpsText =
    predictionUiModel.recommendedOps.slice(0, 2).map((op) => op.label).join(" + ") || "추적 강도 유지";

  return (
    <section className="rounded-xl border border-slate-200 bg-white px-4 py-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge className="border-blue-200 bg-blue-50 text-blue-800">Stage 3</Badge>
          <Badge className={cn("border", probabilityPct >= 70 ? "border-red-200 bg-red-50 text-red-800" : probabilityPct >= 55 ? "border-amber-200 bg-amber-50 text-amber-800" : "border-emerald-200 bg-emerald-50 text-emerald-800")}>
            전환위협 추정 {probabilityPct}%
          </Badge>
          <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] text-slate-700">
            기준일 {predictionUiModel.prediction.generatedAt}
          </span>
        </div>
        <p className="text-xs font-semibold text-slate-700">P0 개입: {primaryActionTitle}</p>
      </div>
      <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-4">
        <TopSummaryMetric
          title="2년 내 전환위협 확률(추정)"
          value={`${probabilityPct}%`}
          helper={`기준일 ${predictionUiModel.prediction.generatedAt}`}
          onClick={onOpenPrediction}
        />
        <TopSummaryMetric
          title="신뢰 수준"
          value={predictionUiModel.prediction.confidence}
          helper={`품질 ${predictionUiModel.dataQualityPct}% · 누락 ${predictionUiModel.missingCount}건 · 경고 ${predictionUiModel.warningCount}건`}
          onClick={onOpenQuality}
        />
        <TopSummaryMetric title="핵심 근거" value={topDriverText || "근거 확인 필요"} helper="근거 상세 열기" onClick={onOpenDrivers} />
        <TopSummaryMetric title="권장 운영" value={recommendedOpsText} helper="P0/P1 작업 열기" onClick={onOpenWorkboard} />
      </div>
      <p className="mt-2 text-[11px] text-slate-600">
        운영 참고: 전환위협 확률은 모델 기반 추정치이며, 최종 실행은 담당자·의료진 확인 후 진행합니다.
      </p>
    </section>
  );
}

function TopSummaryMetric({
  title,
  value,
  helper,
  onClick,
}: {
  title: string;
  value: string;
  helper: string;
  onClick?: () => void;
}) {
  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-left transition hover:border-blue-300 hover:bg-blue-50"
      >
        <p className="text-[11px] text-slate-500">{title}</p>
        <p className="mt-0.5 text-sm font-bold text-slate-900">{value}</p>
        <p className="mt-0.5 text-[11px] text-slate-600">{helper}</p>
      </button>
    );
  }
  return (
    <article className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-left">
      <p className="text-[11px] text-slate-500">{title}</p>
      <p className="mt-0.5 text-sm font-bold text-slate-900">{value}</p>
      <p className="mt-0.5 text-[11px] text-slate-600">{helper}</p>
    </article>
  );
}

function SummaryStatCard({
  title,
  value,
  helper,
  tone = "normal",
}: {
  title: string;
  value: string;
  helper: string;
  tone?: "normal" | "warn";
}) {
  return (
    <article
      className={cn(
        "rounded-lg border px-3 py-2",
        tone === "warn"
          ? "border-amber-200 bg-amber-50"
          : "border-slate-200 bg-slate-50",
      )}
    >
      <p className="text-[11px] text-slate-500">{title}</p>
      <p className="mt-0.5 text-sm font-bold text-slate-900">{value}</p>
      <p className="mt-0.5 text-[11px] text-slate-600">{helper}</p>
    </article>
  );
}

type Stage3RailStep = StepDef & {
  railStatus: "DONE" | "IN_PROGRESS" | "WAITING" | "BLOCKED";
  blockedHint?: string;
};

function Stage3WorkflowRail({
  steps,
  onOpenStep,
}: {
  steps: Stage3RailStep[];
  onOpenStep: (targetPanelId: string) => void;
}) {
  return (
    <Card className="border-slate-200 bg-white shadow-sm">
      <CardHeader className="border-b border-slate-100 px-4 py-3">
        <CardTitle className="text-sm font-bold text-slate-900">Stage3 운영 루프</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 px-4 py-4">
        {steps.map((step, index) => {
          const statusTone =
            step.railStatus === "DONE"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : step.railStatus === "IN_PROGRESS"
              ? "border-blue-200 bg-blue-50 text-blue-800"
              : step.railStatus === "BLOCKED"
                ? "border-red-200 bg-red-50 text-red-800"
                : "border-slate-200 bg-slate-50 text-slate-700";
          return (
            <article key={step.id} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-bold text-slate-900">
                  STEP {index + 1} · {step.title}
                </p>
                <span className={cn("rounded-md border px-2 py-0.5 text-[11px] font-semibold", statusTone)}>
                  {step.railStatus === "DONE"
                    ? "DONE"
                    : step.railStatus === "IN_PROGRESS"
                    ? "IN_PROGRESS"
                    : step.railStatus === "BLOCKED"
                    ? "BLOCKED"
                    : "WAITING"}
                </span>
              </div>
              <p className="mt-1 text-[11px] text-slate-700">{step.reason}</p>
              {step.blockedHint ? <p className="mt-1 text-[11px] text-red-700">연결 작업: {step.blockedHint}</p> : null}
              <Button
                variant="outline"
                size="sm"
                className="mt-2 h-7 w-full text-[11px] font-semibold"
                onClick={() => onOpenStep(step.targetPanelId)}
              >
                해당 패널 열기
              </Button>
            </article>
          );
        })}
      </CardContent>
    </Card>
  );
}

interface WorkboardPanelProps {
  predictionBased: Stage3WorkItem[];
  today: Stage3WorkItem[];
  thisWeek: Stage3WorkItem[];
  later: Stage3WorkItem[];
  filter: "ALL" | "P0" | "P1" | "P2";
  pendingActionId: string | null;
  onRunWorkItem: (item: Stage3WorkItem) => void;
}

function WorkboardPanel({
  predictionBased,
  today,
  thisWeek,
  later,
  filter,
  pendingActionId,
  onRunWorkItem,
}: WorkboardPanelProps) {
  const showP0 = filter === "ALL" || filter === "P0";
  const showP1 = filter === "ALL" || filter === "P1";
  const showP2 = filter === "ALL" || filter === "P2";
  return (
    <div className="space-y-4 px-4 py-4">
      <WorkboardSection
        title="예측 기반 작업"
        items={predictionBased}
        pendingActionId={pendingActionId}
        onRunWorkItem={onRunWorkItem}
      />
      {showP0 ? (
        <WorkboardSection title="Today (P0)" items={today} pendingActionId={pendingActionId} onRunWorkItem={onRunWorkItem} />
      ) : null}
      {showP1 ? (
        <WorkboardSection
          title="This Week (P1)"
          items={thisWeek}
          pendingActionId={pendingActionId}
          onRunWorkItem={onRunWorkItem}
        />
      ) : null}
      {showP2 ? (
        <WorkboardSection title="Later (P2)" items={later} pendingActionId={pendingActionId} onRunWorkItem={onRunWorkItem} />
      ) : null}
    </div>
  );
}

function WorkboardSection({
  title,
  items,
  pendingActionId,
  onRunWorkItem,
}: {
  title: string;
  items: Stage3WorkItem[];
  pendingActionId: string | null;
  onRunWorkItem: (item: Stage3WorkItem) => void;
}) {
  return (
    <section>
      <p className="mb-2 text-xs font-bold text-slate-600">{title}</p>
      <div className="space-y-2">
        {items.length === 0 ? (
          <p className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs text-slate-500">
            등록된 작업이 없습니다.
          </p>
        ) : (
          items.map((item) => (
            <article key={item.id} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-bold text-slate-900">
                  {item.priority} · {item.title}
                </p>
                <span className="text-[11px] text-slate-600">{item.estimatedTimeMin}분</span>
              </div>
              <p className="mt-1 text-[11px] text-slate-700">{item.reason}</p>
              <p className="mt-1 text-[11px] text-slate-600">완료 조건: {item.completionCriteria[0]}</p>
              <Button
                size="sm"
                className="mt-2 h-7 bg-[#15386a] px-2.5 text-[11px] text-white hover:bg-[#102b4e]"
                onClick={() => onRunWorkItem(item)}
              >
                {pendingActionId === item.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CalendarClock className="h-3.5 w-3.5" />}
                {item.action.label}
              </Button>
            </article>
          ))
        )}
      </div>
    </section>
  );
}

function PredictionInterpretationBlock({
  model,
  isPredictionSpike,
  onOpenQuality,
}: {
  model: PredictionUiModel;
  isPredictionSpike: boolean;
  onOpenQuality: () => void;
}) {
  const pPct = toPct(model.prediction.probability);
  const interval = model.prediction.intervalPct
    ? `${model.prediction.intervalPct.low}~${model.prediction.intervalPct.high}%`
    : "범위 정보 없음";
  const trend = model.prediction.trend ?? [];
  const width = 420;
  const height = 120;
  const padding = 20;
  const values = trend.map((point) => point.p);
  const max = Math.max(...values, model.prediction.probability, 0.8);
  const min = Math.min(...values, model.prediction.probability, 0.2);
  const range = max - min || 1;
  const points = trend.map((point, index) => {
    const x = padding + (index / Math.max(1, trend.length - 1)) * (width - padding * 2);
    const y = padding + ((max - point.p) / range) * (height - padding * 2);
    return { ...point, x, y };
  });

  return (
    <Card className="border-slate-200 bg-white shadow-sm">
      <CardHeader className="border-b border-slate-100 px-4 py-3">
        <CardTitle className="text-sm font-bold text-slate-900">2년 내 MCI→AD 전환위협 확률(추정)</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 px-4 py-4">
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-3xl font-black text-slate-900">
            {pPct}% <span className="text-sm font-semibold text-slate-500">(운영 참고)</span>
          </p>
          {isPredictionSpike ? (
            <Badge className="border-red-200 bg-red-50 text-red-800">급변</Badge>
          ) : null}
          <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] text-slate-700">
            기준일 {model.prediction.generatedAt}
          </span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] text-slate-700">
            신뢰 수준 {model.prediction.confidence}
          </span>
          <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] text-slate-700">
            범위 {interval}
          </span>
          <button
            type="button"
            onClick={onOpenQuality}
            className="rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] text-slate-700 transition hover:border-blue-300 hover:bg-blue-50"
          >
            데이터 품질 {model.dataQualityPct}% / 누락 {model.missingCount}건
          </button>
        </div>
        <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
          개인 상태를 단정하는 수치가 아니라 운영 우선순위 정렬을 위한 신호입니다. 누락/품질 저하 시 확실하지 않을 수 있습니다.
        </div>

        <div className="space-y-2">
          <p className="text-xs font-semibold text-slate-700">Top Drivers</p>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
            {model.prediction.topDrivers.slice(0, 3).map((driver) => (
              <article key={driver.key} className="rounded-md border border-slate-200 bg-slate-50 px-2 py-2">
                <p className="text-xs font-semibold text-slate-800">
                  {driver.direction === "UP" ? "↑" : "↓"} {driver.label}
                </p>
                <p className="text-[11px] text-slate-600">최근 변화 {driver.delta ?? "-"}</p>
                <p className="text-[11px] text-slate-500">근거 {driver.evidenceRef ?? "-"}</p>
              </article>
            ))}
          </div>
        </div>

        <div className="space-y-1">
          <p className="text-xs font-semibold text-slate-700">전환위협 추이</p>
          <div className="overflow-x-auto">
            <svg width={width} height={height} role="img" aria-label="예측 확률 추이" className="max-w-full">
              <polyline
                fill="none"
                stroke="#1d4ed8"
                strokeWidth="2.5"
                points={points.map((point) => `${point.x},${point.y}`).join(" ")}
              />
              {points.map((point) => (
                <g key={point.at}>
                  <circle cx={point.x} cy={point.y} r={3.5} fill="#1d4ed8" />
                  <title>{`${point.at} ${toPct(point.p)}%`}</title>
                </g>
              ))}
            </svg>
          </div>
          {model.missingCount > 0 || model.prediction.confidence === "LOW" ? (
            <p className="text-[11px] text-amber-700">누락 영향으로 확실하지 않음(추정치 변동 가능)</p>
          ) : null}
        </div>

        <div>
          <p className="mb-1 text-xs font-semibold text-slate-700">권장 운영</p>
          <div className="flex flex-wrap gap-1.5">
            {model.recommendedOps.slice(0, 3).map((op) => (
              <span key={op.key} className="rounded-md border border-blue-200 bg-blue-50 px-2 py-0.5 text-[11px] text-blue-800">
                {op.priority} · {op.label}
              </span>
            ))}
          </div>
        </div>
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
  onRunSignalAction?: (triggerKey: Stage3Case["risk"]["triggers"][number]["key"]) => void;
}

export function TriggerPanel({ stage3, onRunSignalAction }: TriggerPanelProps) {
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
            <Button
              variant="outline"
              size="sm"
              className="mt-2 h-7 text-[11px] font-semibold"
              disabled={!onRunSignalAction}
              onClick={() => onRunSignalAction?.(trigger.key)}
            >
              이 신호 기반 개입 열기
            </Button>
          </div>
        ))}
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
