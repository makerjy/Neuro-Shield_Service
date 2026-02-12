import React, { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  Clock3,
  FileText,
  Lock,
  RefreshCw,
  Send,
  ShieldCheck,
  UserRound,
  Eye,
  ExternalLink,
} from "lucide-react";
import {
  QueryClient,
  QueryClientProvider,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { toast } from "sonner";
import { cn } from "../shared";
import type {
  CaseDetailResponse,
  OpsActionKey,
  OpsRecommendationResponse,
} from "./apiContracts";
import { getCaseDetail, getOpsRecommendations, runOpsAction } from "./mockApi";

interface Stage2CaseWorkflowProps {
  caseId: string;
  onBack: () => void;
}

type RunActionInput = {
  actionKey: OpsActionKey;
  reason?: string;
};

type RunActionContext = {
  previousCase?: CaseDetailResponse;
};

const stage2QueryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    },
  },
});

const caseQueryKey = (caseId: string) => ["stage2-case", caseId] as const;
const recommendationQueryKey = (caseId: string) => ["stage2-recommendations", caseId] as const;

function formatDateTime(isoLike?: string) {
  if (!isoLike) return "-";
  const d = new Date(isoLike);
  if (Number.isNaN(d.getTime())) return isoLike;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function signalTone(level: CaseDetailResponse["stage1"]["signalLevel"]) {
  if (level === "위험") return "text-red-700 bg-red-50 border-red-200";
  if (level === "주의") return "text-orange-700 bg-orange-50 border-orange-200";
  return "text-emerald-700 bg-emerald-50 border-emerald-200";
}

function mciTone(signal: CaseDetailResponse["stage2"]["mciSignal"]) {
  if (signal === "주의") return "text-orange-700 bg-orange-50 border-orange-200";
  if (signal === "양호") return "text-emerald-700 bg-emerald-50 border-emerald-200";
  return "text-gray-700 bg-gray-50 border-gray-200";
}

function stageStatusLabel(status: CaseDetailResponse["status"]) {
  if (status === "완료") return "작업 완료";
  if (status === "대기") return "작업 대기";
  if (status === "지연") return "지연";
  if (status === "보류") return "보류";
  return "진행중";
}

function appointmentLabel(status: CaseDetailResponse["operations"]["appointment"]["status"]) {
  if (status === "요청") return "예약 요청";
  if (status === "취소") return "예약 취소";
  if (status === "미정") return "미정";
  return "예약 완료";
}

function referralLabel(status: CaseDetailResponse["operations"]["referral"]["status"]) {
  if (status === "미생성") return "미생성";
  if (status === "생성됨") return "생성됨";
  if (status === "전송됨") return "전송됨";
  return "오류";
}

function fallbackActionPriority(caseData: CaseDetailResponse | null, rec: OpsRecommendationResponse | null): OpsActionKey {
  const action = rec?.items[0]?.actions?.[0]?.key;
  if (action) return action;
  if (!caseData) return "REQUEST_SUPPORT";
  if (caseData.operations.referral.status === "미생성") return "CREATE_REFERRAL";
  if (caseData.operations.referral.status === "생성됨") return "SEND_REFERRAL";
  return "TRACK_APPOINTMENT";
}

function applyOptimisticCase(caseData: CaseDetailResponse, actionKey: OpsActionKey): CaseDetailResponse {
  const next: CaseDetailResponse = JSON.parse(JSON.stringify(caseData));

  if (actionKey === "CREATE_REFERRAL") {
    next.operations.referral.status = "생성됨";
    return next;
  }

  if (actionKey === "SEND_REFERRAL") {
    next.operations.referral.status = "전송됨";
    return next;
  }

  if (actionKey === "TRACK_APPOINTMENT") {
    const current = next.operations.appointment.status;
    if (current === "미정") {
      next.operations.appointment.status = "요청";
    }
    return next;
  }

  return next;
}

export function Stage2CaseWorkflow({ caseId, onBack }: Stage2CaseWorkflowProps) {
  return (
    <QueryClientProvider client={stage2QueryClient}>
      <Stage2CaseWorkflowContent caseId={caseId} onBack={onBack} />
    </QueryClientProvider>
  );
}

function Stage2CaseWorkflowContent({ caseId, onBack }: Stage2CaseWorkflowProps) {
  const queryClient = useQueryClient();
  const [authorizeModalOpen, setAuthorizeModalOpen] = useState(false);
  const [authorizeReason, setAuthorizeReason] = useState("");
  const [isSensitiveExpanded, setIsSensitiveExpanded] = useState(false);

  const caseDataQuery = useQuery({
    queryKey: caseQueryKey(caseId),
    queryFn: () => getCaseDetail(caseId),
  });

  const recommendationsQuery = useQuery({
    queryKey: recommendationQueryKey(caseId),
    queryFn: () => getOpsRecommendations(caseId, "stage2-workflow-v1"),
  });

  const caseData = caseDataQuery.data ?? null;
  const recommendations = recommendationsQuery.data ?? null;

  const actionMutation = useMutation<unknown, Error, RunActionInput, RunActionContext>({
    mutationFn: async ({ actionKey, reason }) => {
      const actor = caseDataQuery.data?.assignee.name ?? "담당자";
      return await runOpsAction(caseId, actionKey, actor, reason);
    },
    onMutate: async ({ actionKey }) => {
      await queryClient.cancelQueries({ queryKey: caseQueryKey(caseId) });
      const previousCase = queryClient.getQueryData<CaseDetailResponse>(caseQueryKey(caseId));
      if (previousCase) {
        queryClient.setQueryData(caseQueryKey(caseId), applyOptimisticCase(previousCase, actionKey));
      }
      return { previousCase };
    },
    onError: (_, __, context) => {
      if (context?.previousCase) {
        queryClient.setQueryData(caseQueryKey(caseId), context.previousCase);
      }
      toast.error("처리 중 오류가 발생했습니다.");
    },
    onSuccess: async (_, { actionKey }) => {
      if (actionKey === "AUTHORIZE_VIEW") {
        setIsSensitiveExpanded(true);
      }
      toast.success("처리 완료(로그 기록됨)");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: caseQueryKey(caseId) }),
        queryClient.invalidateQueries({ queryKey: recommendationQueryKey(caseId) }),
      ]);
    },
  });

  const busyAction = actionMutation.isPending ? actionMutation.variables?.actionKey ?? null : null;

  useEffect(() => {
    if (caseData) {
      const hasAuthorizeLog = caseData.auditLogs.some((log) => log.message.includes("권한자 열람 실행"));
      setIsSensitiveExpanded(hasAuthorizeLog);
    }
  }, [caseData]);

  const runAction = (actionKey: OpsActionKey, reason?: string) => {
    actionMutation.mutate({ actionKey, reason });
  };

  const topAction = useMemo(() => fallbackActionPriority(caseData, recommendations), [caseData, recommendations]);
  const isLoading = caseDataQuery.isPending || recommendationsQuery.isPending;
  const hasError = caseDataQuery.isError;

  if (isLoading) {
    return <div className="rounded-xl border border-gray-200 bg-white p-8 text-sm text-gray-500">Stage 2 운영 화면을 불러오는 중...</div>;
  }

  if (hasError || !caseData) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-8 text-sm text-red-700">
        Stage 2 데이터를 확인할 수 없습니다.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <CaseHeaderSticky
        caseData={caseData}
        onBack={onBack}
        primaryBusy={busyAction === topAction}
        onRunPrimary={() => runAction(topAction)}
        supportBusy={busyAction === "REQUEST_SUPPORT"}
        onSupport={() => runAction("REQUEST_SUPPORT")}
      />

      <Stage1SignalStrip caseData={caseData} />

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 items-start">
        <section className="xl:col-span-8 space-y-4">
          <AssessmentSummaryPanel
            caseData={caseData}
            isSensitiveExpanded={isSensitiveExpanded}
            onAuthorize={() => setAuthorizeModalOpen(true)}
          />
          <TimelineRail timeline={caseData.timeline} />
          <AuditLogTable logs={caseData.auditLogs} />
        </section>

        <aside className="xl:col-span-4 space-y-4 xl:sticky xl:top-20">
          <OpsRecommendationPanel
            data={recommendations}
            busyAction={busyAction}
            onRunAction={(actionKey) => runAction(actionKey)}
          />
          <OpsQuickActions
            caseData={caseData}
            recommendations={recommendations}
            busyAction={busyAction}
            onRunAction={(actionKey) => {
              if (actionKey === "AUTHORIZE_VIEW") {
                setAuthorizeModalOpen(true);
                return;
              }
              runAction(actionKey);
            }}
          />
        </aside>
      </div>

      <AuthorizeViewModal
        open={authorizeModalOpen}
        reason={authorizeReason}
        busy={busyAction === "AUTHORIZE_VIEW"}
        onReasonChange={setAuthorizeReason}
        onClose={() => setAuthorizeModalOpen(false)}
        onConfirm={() => {
          runAction("AUTHORIZE_VIEW", authorizeReason || "운영 확인");
          setAuthorizeModalOpen(false);
          setAuthorizeReason("");
        }}
      />
    </div>
  );
}

export interface CaseHeaderStickyProps {
  caseData: CaseDetailResponse;
  onBack: () => void;
  onRunPrimary: () => void;
  onSupport: () => void;
  primaryBusy: boolean;
  supportBusy: boolean;
}

export function CaseHeaderSticky({
  caseData,
  onBack,
  onRunPrimary,
  onSupport,
  primaryBusy,
  supportBusy,
}: CaseHeaderStickyProps) {
  return (
    <header className="sticky top-0 z-20 rounded-xl border border-gray-200 bg-white/95 px-5 py-4 shadow-sm backdrop-blur">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50"
            title="목록으로"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-slate-900">{caseData.caseId}</h2>
              <span className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-sm font-bold text-blue-700">Stage 2</span>
            </div>
            <p className="mt-0.5 text-xs text-gray-500">
              담당자 {caseData.assignee.name} ({caseData.assignee.role}) · 현재 상태 {stageStatusLabel(caseData.status)}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onSupport}
            disabled={supportBusy}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-xs font-bold text-gray-700 hover:bg-gray-50 disabled:opacity-60"
          >
            <ShieldCheck size={14} />
            운영 지원 요청
          </button>
          <button
            onClick={onRunPrimary}
            disabled={primaryBusy}
            className="inline-flex items-center gap-2 rounded-lg bg-[#163b6f] px-3 py-2 text-xs font-bold text-white hover:bg-[#0f2b50] disabled:opacity-60"
          >
            <ExternalLink size={14} />
            다음 액션 1순위 실행
          </button>
        </div>
      </div>
    </header>
  );
}

export interface Stage1SignalStripProps {
  caseData: CaseDetailResponse;
}

export function Stage1SignalStrip({ caseData }: Stage1SignalStripProps) {
  return (
    <section className="rounded-xl border border-slate-200 bg-gradient-to-r from-slate-900 to-slate-800 px-4 py-3 text-white shadow-sm">
      <div className="flex flex-wrap items-center gap-3 text-xs">
        <span className="rounded-md bg-white/15 px-2.5 py-1 font-semibold">
          CIST {caseData.stage1.cist.score}/{caseData.stage1.cist.max} · 신뢰도 {caseData.stage1.cist.reliability}
        </span>
        <span className={cn("rounded-md border px-2.5 py-1 font-semibold", signalTone(caseData.stage1.signalLevel))}>
          위험 신호 등급 {caseData.stage1.signalLevel}
        </span>
        <span
          className={cn(
            "rounded-md px-2.5 py-1 font-semibold",
            caseData.stage1.retrigger.enabled ? "bg-orange-500/20 text-orange-100" : "bg-emerald-500/20 text-emerald-100"
          )}
        >
          재평가 트리거 {caseData.stage1.retrigger.enabled ? "ON" : "OFF"}
          {caseData.stage1.retrigger.reason ? ` · ${caseData.stage1.retrigger.reason}` : ""}
        </span>
        <span className="rounded-md bg-white/15 px-2.5 py-1 font-semibold">
          데이터 충분성 누락 {caseData.stage2.neuropsych_1.missingItems.count}건
        </span>
        <span className="ml-auto text-[11px] text-white/70">
          최근 업데이트 {formatDateTime(caseData.auditLogs[0]?.at)}
        </span>
      </div>
    </section>
  );
}

export interface AssessmentSummaryPanelProps {
  caseData: CaseDetailResponse;
  isSensitiveExpanded: boolean;
  onAuthorize: () => void;
}

export function AssessmentSummaryPanel({ caseData, isSensitiveExpanded, onAuthorize }: AssessmentSummaryPanelProps) {
  return (
    <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="rounded-lg border border-gray-100 bg-gray-50 p-3">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <UserRound size={15} className="text-slate-500" />
            개인정보 요약
          </h3>
          <dl className="mt-2 space-y-1 text-xs">
            <div className="flex justify-between"><dt className="text-gray-500">이름</dt><dd className="font-semibold text-slate-800">{caseData.piiSummary.maskedName}</dd></div>
            <div className="flex justify-between"><dt className="text-gray-500">나이</dt><dd className="font-semibold text-slate-800">{caseData.piiSummary.age}세</dd></div>
            <div className="flex justify-between"><dt className="text-gray-500">연락처</dt><dd className="font-semibold text-slate-800">{caseData.piiSummary.maskedPhone}</dd></div>
            <div className="flex justify-between"><dt className="text-gray-500">비식별 단계</dt><dd className="font-semibold text-slate-800">{caseData.piiSummary.anonymizationLevel}</dd></div>
          </dl>
        </div>

        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
          <p className="font-bold flex items-center gap-1.5">
            <Lock size={14} /> 참고 분류(의료진 확인 전)
          </p>
          <p className="mt-1">본 화면의 분류 정보는 운영 정렬을 위한 참고 정보입니다. 의료진 확인 전 / 담당자 검토 필요</p>
          <div className="mt-2 flex items-center justify-between">
            <MCISignalBadge signal={caseData.stage2.mciSignal} />
            <button
              onClick={onAuthorize}
              className="inline-flex items-center gap-1 rounded-md border border-amber-300 bg-white px-2 py-1 text-[11px] font-semibold text-amber-800 hover:bg-amber-100"
            >
              <Eye size={12} /> 권한자 열람 실행
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <Stage1CISTCard stage1={caseData.stage1} />
        <Stage2NeuropsychCard neuro={caseData.stage2.neuropsych_1} />
        <Stage2ClinicalEvalCard clinical={caseData.stage2.clinical_2} />
      </div>

      {isSensitiveExpanded && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs text-blue-900">
          <p className="font-semibold">운영 권고(참고): 세부 열람이 기록되었습니다</p>
          <p className="mt-1">의료진 확인 전 / 담당자 검토 필요 문구 기준으로만 상세를 해석해 주세요.</p>
        </div>
      )}
    </section>
  );
}

export interface Stage1CISTCardProps {
  stage1: CaseDetailResponse["stage1"];
}

export function Stage1CISTCard({ stage1 }: Stage1CISTCardProps) {
  return (
    <article className="rounded-lg border border-gray-200 bg-white p-3">
      <p className="text-[11px] font-bold text-gray-500 uppercase">Stage1 지표</p>
      <p className="mt-1 text-sm font-bold text-slate-900">CIST {stage1.cist.score}/{stage1.cist.max}</p>
      <p className="text-xs text-gray-600">신뢰도 {stage1.cist.reliability}</p>
      <p className="mt-2 text-[11px] text-gray-500">시행일 {stage1.cist.date}</p>
    </article>
  );
}

export interface Stage2NeuropsychCardProps {
  neuro: CaseDetailResponse["stage2"]["neuropsych_1"];
}

export function Stage2NeuropsychCard({ neuro }: Stage2NeuropsychCardProps) {
  return (
    <article className="rounded-lg border border-gray-200 bg-white p-3">
      <p className="text-[11px] font-bold text-gray-500 uppercase">2차 1단계 신경심리검사</p>
      <p className="mt-1 text-sm font-bold text-slate-900">{neuro.name} · {neuro.summarySD} SD</p>
      <p className="text-xs text-gray-600">신뢰도 {neuro.reliability}</p>
      <p className="mt-1 text-[11px] text-gray-500">누락 항목 {neuro.missingItems.count}건</p>
      {neuro.missingItems.count > 0 && (
        <p className="text-[11px] text-orange-700 mt-1">{neuro.missingItems.items.join(", ")}</p>
      )}
      <p className="mt-2 text-[11px] text-gray-500">시행일 {neuro.date}</p>
    </article>
  );
}

export interface Stage2ClinicalEvalCardProps {
  clinical: CaseDetailResponse["stage2"]["clinical_2"];
}

export function Stage2ClinicalEvalCard({ clinical }: Stage2ClinicalEvalCardProps) {
  const previewChecklist = clinical.checklist.slice(0, 3);

  return (
    <article className="rounded-lg border border-gray-200 bg-white p-3">
      <p className="text-[11px] font-bold text-gray-500 uppercase">2차 2단계 치매 임상 평가</p>
      <div className="mt-1 flex items-center justify-between">
        <p className="text-sm font-bold text-slate-900">{clinical.completed ? "입력 완료" : "입력 대기"}</p>
        <span className={cn("rounded px-2 py-0.5 text-[10px] font-semibold", clinical.completed ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-600")}>
          {clinical.completed ? "완료" : "대기"}
        </span>
      </div>
      <p className="mt-1 text-xs text-gray-600">체크 항목 {clinical.checklist.length}개</p>
      <div className="mt-2 space-y-1">
        {previewChecklist.map((item) => (
          <p key={item.key} className="text-[11px] text-gray-600">
            {item.label}: <span className="font-semibold text-slate-800">{item.value}</span>
          </p>
        ))}
      </div>
      {clinical.note && (
        <p className="mt-2 rounded-md border border-gray-100 bg-gray-50 px-2 py-1 text-[11px] text-gray-600">
          관찰 요약: {clinical.note}
        </p>
      )}
      <p className="mt-1 text-[11px] text-gray-500">평가자 {clinical.evaluator?.name ?? "미지정"}</p>
      <p className="text-[11px] text-gray-500">평가일 {clinical.date ?? "미입력"}</p>
    </article>
  );
}

export interface MCISignalBadgeProps {
  signal: CaseDetailResponse["stage2"]["mciSignal"];
}

export function MCISignalBadge({ signal }: MCISignalBadgeProps) {
  const label = signal ?? "미입력";
  return (
    <span className={cn("inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold", mciTone(signal))}>
      인지 위험 신호: {label}(참고)
    </span>
  );
}

export interface OpsRecommendationPanelProps {
  data: OpsRecommendationResponse | null;
  busyAction: OpsActionKey | null;
  onRunAction: (actionKey: OpsActionKey) => void;
}

export function OpsRecommendationPanel({ data, busyAction, onRunAction }: OpsRecommendationPanelProps) {
  return (
    <section className="rounded-xl border border-[#163b6f]/20 bg-[#f8fbff] p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-[#163b6f]">운영 권고(참고)</h3>
        <span className="text-[11px] text-gray-500">의료진 확인 전 / 담당자 검토 필요</span>
      </div>

      <div className="mt-3 space-y-2">
        {data?.items?.length ? (
          data.items.map((item) => (
            <div key={item.id} className="rounded-lg border border-blue-100 bg-white p-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold text-slate-900">P{item.priority}. {item.title}</p>
              </div>
              <p className="mt-1 text-[11px] text-gray-600">{item.rationale}</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {item.actions.map((action) => (
                  <button
                    key={`${item.id}-${action.key}`}
                    onClick={() => onRunAction(action.key)}
                    disabled={busyAction === action.key}
                    className="inline-flex items-center gap-1 rounded-md border border-blue-200 bg-blue-50 px-2 py-1 text-[11px] font-semibold text-blue-700 hover:bg-blue-100 disabled:opacity-60"
                  >
                    {busyAction === action.key ? <RefreshCw size={11} className="animate-spin" /> : <Send size={11} />}
                    {action.label}
                  </button>
                ))}
              </div>
            </div>
          ))
        ) : (
          <div className="rounded-lg border border-blue-100 bg-white p-3 text-[11px] text-gray-500">
            현재 권고 항목이 없습니다. 상태 변경 시 자동 갱신됩니다.
          </div>
        )}
      </div>
    </section>
  );
}

export interface OpsQuickActionsProps {
  caseData: CaseDetailResponse;
  recommendations: OpsRecommendationResponse | null;
  busyAction: OpsActionKey | null;
  onRunAction: (actionKey: OpsActionKey) => void;
}

export function OpsQuickActions({ caseData, recommendations, busyAction, onRunAction }: OpsQuickActionsProps) {
  const usedActions = useMemo(() => {
    const set = new Set<OpsActionKey>();
    recommendations?.items.forEach((item) => item.actions.forEach((action) => set.add(action.key)));
    return set;
  }, [recommendations]);

  const quickCandidates: Array<{ key: OpsActionKey; label: string }> = [
    { key: "CREATE_REFERRAL", label: "의뢰서 생성" },
    { key: "SEND_REFERRAL", label: "의뢰서 전송" },
    { key: "TRACK_APPOINTMENT", label: "예약 현황 추적" },
    { key: "LINK_COUNSELING", label: "상담 프로그램 연계" },
    { key: "AUTHORIZE_VIEW", label: "권한자 열람 실행" },
  ];

  const deduped = quickCandidates.filter((item) => !usedActions.has(item.key));

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <h3 className="text-sm font-bold text-gray-800">운영 액션</h3>
      <div className="mt-2 grid grid-cols-1 gap-2">
        {deduped.map((item) => (
          <button
            key={item.key}
            onClick={() => onRunAction(item.key)}
            disabled={busyAction === item.key}
            className="inline-flex items-center justify-center gap-1 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-100 disabled:opacity-60"
          >
            {busyAction === item.key ? <RefreshCw size={12} className="animate-spin" /> : <FileText size={12} />}
            {item.label}
          </button>
        ))}
      </div>

      <div className="mt-3 rounded-md border border-gray-100 bg-gray-50 p-2 text-[11px] text-gray-600">
        <p>의뢰 상태: <strong>{referralLabel(caseData.operations.referral.status)}</strong></p>
        <p>예약 상태: <strong>{appointmentLabel(caseData.operations.appointment.status)}</strong></p>
        {caseData.operations.appointment.at && <p>예약 시각: {caseData.operations.appointment.at}</p>}
      </div>
    </section>
  );
}

export interface TimelineRailProps {
  timeline: CaseDetailResponse["timeline"];
}

export function TimelineRail({ timeline }: TimelineRailProps) {
  return (
    <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
        <Clock3 size={15} className="text-slate-500" />
        작업 타임라인
      </h3>
      <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2">
        {timeline.map((item) => (
          <div key={item.key} className="rounded-md border border-gray-100 bg-gray-50 px-3 py-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-slate-800">{item.label}</p>
              <span className={cn(
                "rounded px-1.5 py-0.5 text-[10px] font-semibold",
                item.status === "done" ? "bg-emerald-100 text-emerald-700" : item.status === "waiting" ? "bg-amber-100 text-amber-700" : "bg-gray-200 text-gray-600"
              )}>
                {item.status === "done" ? "완료" : item.status === "waiting" ? "대기" : "미확인"}
              </span>
            </div>
            <p className="mt-1 text-[11px] text-gray-500">{item.at ?? "시각 미입력"}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

export interface AuditLogTableProps {
  logs: CaseDetailResponse["auditLogs"];
}

export function AuditLogTable({ logs }: AuditLogTableProps) {
  return (
    <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
        <CheckCircle2 size={15} className="text-slate-500" />
        감사 로그
      </h3>
      <div className="mt-3 overflow-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="text-[11px] uppercase text-gray-500 border-b border-gray-100">
              <th className="py-2 pr-2">시각</th>
              <th className="py-2 pr-2">담당자</th>
              <th className="py-2">기록</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log) => (
              <tr key={log.id} className="border-b border-gray-50 text-xs">
                <td className="py-2 pr-2 text-gray-500 whitespace-nowrap">{log.at}</td>
                <td className="py-2 pr-2 font-semibold text-slate-700">{log.actor}</td>
                <td className="py-2 text-gray-700">{log.message}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export interface AuthorizeViewModalProps {
  open: boolean;
  reason: string;
  busy: boolean;
  onClose: () => void;
  onReasonChange: (value: string) => void;
  onConfirm: () => void;
}

export function AuthorizeViewModal({
  open,
  reason,
  busy,
  onClose,
  onReasonChange,
  onConfirm,
}: AuthorizeViewModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4">
      <div className="w-full max-w-md rounded-xl border border-gray-200 bg-white p-4 shadow-2xl">
        <h3 className="text-sm font-bold text-slate-900">권한자 열람 확인</h3>
        <p className="mt-1 text-xs text-gray-600">열람 실행 시 감사 로그에 즉시 기록됩니다. 의료진 확인 전 / 담당자 검토 필요</p>

        <label className="mt-3 block text-[11px] font-semibold text-gray-600">열람 사유(선택)</label>
        <textarea
          value={reason}
          onChange={(e) => onReasonChange(e.target.value)}
          className="mt-1 h-20 w-full rounded-lg border border-gray-200 px-2 py-1.5 text-xs outline-none focus:border-blue-400"
          placeholder="예: 보호자 문의 대응을 위한 확인"
        />

        <div className="mt-4 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50"
          >
            취소
          </button>
          <button
            onClick={onConfirm}
            disabled={busy}
            className="rounded-lg bg-[#163b6f] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#0f2b50] disabled:opacity-60"
          >
            {busy ? "처리 중..." : "열람 실행"}
          </button>
        </div>
      </div>
    </div>
  );
}
