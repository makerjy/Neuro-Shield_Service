import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ClipboardCheck,
  ExternalLink,
  Eye,
  FileText,
  ListChecks,
  Lock,
  ShieldAlert,
  ShieldCheck,
  Siren,
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
import type {
  ActionItem,
  ActionKey,
  AuditLogItem,
  ClassificationTone,
  Stage2ActionState,
  Stage2CaseDetailData,
  Stage2ChecklistItem,
  Stage2MemoItem,
  Stage2OperationalState,
  TimelineStep,
} from "./stage2Types";

type FocusTarget = "cist" | "snsb" | "workflow" | "checklist";

interface CaseDetailStage2PageProps {
  data: Stage2CaseDetailData;
  onBack: () => void;
}

type StatusChipItem = {
  id: string;
  label: string;
  tone: ClassificationTone;
  ariaLabel: string;
  onClick?: () => void;
};

function formatDateTime(input: Date | string): string {
  const date = input instanceof Date ? input : new Date(input.replace(" ", "T"));
  if (Number.isNaN(date.getTime())) {
    return typeof input === "string" ? input : "";
  }
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate(),
  ).padStart(2, "0")} ${String(date.getHours()).padStart(2, "0")}:${String(
    date.getMinutes(),
  ).padStart(2, "0")}`;
}

function toneClass(tone: ClassificationTone): string {
  if (tone === "success") return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (tone === "warning") return "border-amber-200 bg-amber-50 text-amber-800";
  if (tone === "attention") return "border-red-200 bg-red-50 text-red-800";
  return "border-slate-200 bg-slate-100 text-slate-700";
}

function stageTone(status: TimelineStep["status"]): string {
  if (status === "done") return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (status === "waiting") return "border-amber-200 bg-amber-50 text-amber-800";
  return "border-slate-200 bg-slate-100 text-slate-700";
}

function referralTone(status: Stage2ActionState["referralStatus"]): ClassificationTone {
  if (status === "전송 완료") return "success";
  if (status === "준비 완료") return "warning";
  return "neutral";
}

function reservationTone(status: Stage2ActionState["reservationStatus"]): ClassificationTone {
  if (status === "예약 준비 완료") return "success";
  if (status === "예약 요청") return "warning";
  return "neutral";
}

function buildRecommendedActions(
  state: Stage2ActionState,
  operational: Stage2OperationalState,
  checklistWaiting: boolean,
): ActionItem[] {
  const p1: ActionItem =
    state.referralStatus === "미생성"
      ? {
          key: "CREATE_REFERRAL",
          priority: "P1",
          label: "의뢰서 준비",
          helper: "운영 권고(참고)",
          rationale: [
            "2차 1단계 결과가 정리되어 문서 초안 준비가 가능합니다.",
            checklistWaiting
              ? "2차 2단계가 입력 대기 상태라 후속 단계 정렬이 필요합니다."
              : "2차 2단계 체크가 준비되어 있어 문서 연결이 용이합니다.",
            `예약 상태: ${state.reservationStatus}`,
          ],
        }
      : state.referralStatus === "준비 완료"
        ? {
            key: "SEND_REFERRAL",
            priority: "P1",
            label: "의뢰서 전송",
            helper: "운영 권고(참고)",
            rationale: [
              "의뢰서 초안 준비가 끝나 전송 단계로 이동할 수 있습니다.",
              "전송 이후 예약 추적 단계와 연결이 가능합니다.",
              `위험 신호: ${operational.riskSignalLevel}`,
            ],
          }
        : {
            key: "TRACK_RESERVATION",
            priority: "P1",
            label: "예약 현황 추적",
            helper: "운영 권고(참고)",
            rationale: [
              "의뢰 작업 이후 방문 일정 추적이 우선입니다.",
              "입력 대기와 누락 항목을 함께 점검할 수 있습니다.",
              `예약 상태: ${state.reservationStatus}`,
            ],
          };

  return [
    p1,
    {
      key: "AUTHORIZE_VIEW",
      priority: "P2",
      label: "권한자 열람 실행",
      helper: "운영 권고(참고)",
      rationale: [
        "개인정보 요약은 기본 비식별 상태로 유지됩니다.",
        "열람 실행 시 감사 로그에 즉시 남습니다.",
        "의료진 확인 전에는 운영 참고 범위만 확인합니다.",
      ],
    },
    {
      key: "REQUEST_SUPPORT",
      priority: "P3",
      label: "운영 지원 요청",
      helper: "운영 권고(참고)",
      rationale: [
        "입력 대기 항목이 길어질 때 병목 완화에 도움 됩니다.",
        "센터 간 협업 메모를 남겨 이력을 추적할 수 있습니다.",
        "누락 항목 보완 요청을 묶어서 전달할 수 있습니다.",
      ],
    },
  ];
}

function nextActionStateByKey(
  prev: Stage2ActionState,
  key: ActionKey,
): Pick<Stage2ActionState, "referralStatus" | "reservationStatus"> {
  if (key === "CREATE_REFERRAL") {
    return { referralStatus: "준비 완료", reservationStatus: prev.reservationStatus };
  }
  if (key === "SEND_REFERRAL") {
    return {
      referralStatus: "전송 완료",
      reservationStatus: prev.reservationStatus === "미등록" ? "예약 요청" : prev.reservationStatus,
    };
  }
  if (key === "TRACK_RESERVATION") {
    return {
      referralStatus: prev.referralStatus,
      reservationStatus: prev.reservationStatus === "미등록" ? "예약 요청" : "예약 준비 완료",
    };
  }
  return {
    referralStatus: prev.referralStatus,
    reservationStatus: prev.reservationStatus,
  };
}

function timelineByAction(prev: TimelineStep[], key: ActionKey, timestamp: string): TimelineStep[] {
  return prev.map((item) => {
    if (item.title === "의뢰서 작업" && key === "CREATE_REFERRAL") {
      return { ...item, status: "waiting", at: timestamp };
    }
    if (item.title === "의뢰서 작업" && key === "SEND_REFERRAL") {
      return { ...item, status: "done", at: timestamp };
    }
    if (item.title === "예약 추적" && key === "TRACK_RESERVATION") {
      return { ...item, status: "waiting", at: timestamp };
    }
    if (item.title === "최종 운영 정리" && (key === "SEND_REFERRAL" || key === "TRACK_RESERVATION")) {
      return { ...item, status: "waiting", at: timestamp };
    }
    return item;
  });
}

export function CaseDetailStage2Page({ data, onBack }: CaseDetailStage2PageProps) {
  const [actions, setActions] = useState<Stage2ActionState>(data.actions);
  const [timeline, setTimeline] = useState<TimelineStep[]>(data.timeline);
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>(data.auditLogs);
  const [checklist, setChecklist] = useState<Stage2ChecklistItem[]>(data.checklist);
  const [memos, setMemos] = useState<Stage2MemoItem[]>(data.memos);
  const [memoInput, setMemoInput] = useState("");
  const [memoExpanded, setMemoExpanded] = useState(true);
  const [actionModal, setActionModal] = useState<ActionItem | null>(null);
  const [actionReason, setActionReason] = useState("");
  const [authorizeModalOpen, setAuthorizeModalOpen] = useState(false);
  const [authorizeReason, setAuthorizeReason] = useState("");
  const [piiExpanded, setPiiExpanded] = useState(false);
  const [focusTarget, setFocusTarget] = useState<FocusTarget | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const cistRef = useRef<HTMLDivElement>(null);
  const snsbRef = useRef<HTMLDivElement>(null);
  const workflowRef = useRef<HTMLDivElement>(null);
  const checklistRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setActions(data.actions);
    setTimeline(data.timeline);
    setAuditLogs(data.auditLogs);
    setChecklist(data.checklist);
    setMemos(data.memos);
    setPiiExpanded(false);
    setActionModal(null);
    setActionReason("");
    setAuthorizeReason("");
    setMemoInput("");
  }, [data]);

  useEffect(() => {
    if (!focusTarget) return;
    const timer = setTimeout(() => setFocusTarget(null), 1700);
    return () => clearTimeout(timer);
  }, [focusTarget]);

  useEffect(() => {
    if (!toastMessage) return;
    const timer = setTimeout(() => setToastMessage(null), 2600);
    return () => clearTimeout(timer);
  }, [toastMessage]);

  const checklistWaiting = data.evidence.stage2Clinical.status === "입력 대기";
  const missingDetails = useMemo(() => {
    const items: string[] = [];
    if (data.evidence.snsb.missingCount > 0) {
      items.push(`SNSB 누락 ${data.evidence.snsb.missingCount}건`);
    }
    if (checklistWaiting) {
      items.push("2차 2단계 체크리스트 입력 대기");
    }
    if (actions.reservationStatus === "미등록") {
      items.push("예약 정보 미등록");
    }
    if (!data.pii.guardianMasked) {
      items.push("보호자 연락처 미등록");
    }
    return items.slice(0, 4);
  }, [actions.reservationStatus, checklistWaiting, data.evidence.snsb.missingCount, data.pii.guardianMasked]);

  const primaryAction = actions.recommendedActions[0];
  const secondaryActions = actions.recommendedActions.slice(1);

  const scrollToTarget = (target: FocusTarget) => {
    const map: Record<FocusTarget, React.RefObject<HTMLDivElement>> = {
      cist: cistRef,
      snsb: snsbRef,
      workflow: workflowRef,
      checklist: checklistRef,
    };
    map[target].current?.scrollIntoView({ behavior: "smooth", block: "start" });
    setFocusTarget(target);
  };

  const appendAuditLog = (message: string) => {
    const timestamp = formatDateTime(new Date());
    setAuditLogs((prev) => [
      {
        id: `AUD-${Date.now()}-${prev.length}`,
        timestamp,
        actor: data.header.assignee.name,
        message,
      },
      ...prev,
    ]);
  };

  const appendMemo = (content: string, author = data.header.assignee.name) => {
    const timestamp = formatDateTime(new Date());
    setMemos((prev) => [
      {
        id: `MEMO-${Date.now()}-${prev.length}`,
        timestamp,
        author,
        content,
      },
      ...prev,
    ]);
  };

  const runAction = (action: ActionItem, reason?: string) => {
    if (action.key === "AUTHORIZE_VIEW") {
      setAuthorizeModalOpen(true);
      setActionReason(reason ?? "");
      return;
    }

    const timestamp = formatDateTime(new Date());
    const nextBase = nextActionStateByKey(actions, action.key);
    const nextState: Stage2ActionState = {
      ...actions,
      ...nextBase,
      recommendedActions: buildRecommendedActions(
        { ...actions, ...nextBase, recommendedActions: actions.recommendedActions },
        data.operational,
        checklistWaiting,
      ),
    };

    setActions(nextState);
    setTimeline((prev) => timelineByAction(prev, action.key, timestamp));

    const reasonSuffix = reason?.trim() ? ` · 사유: ${reason.trim()}` : "";
    appendAuditLog(`${action.label} 실행 기록${reasonSuffix}`);
    appendMemo(`운영 권고(참고) 실행: ${action.label}${reasonSuffix}`, data.header.assignee.name);
    setToastMessage(`${action.label} 실행 기록이 저장되었습니다.`);
  };

  const toggleChecklist = (id: string) => {
    setChecklist((prev) => {
      const next = prev.map((item) => (item.id === id ? { ...item, done: !item.done } : item));
      const changed = next.find((item) => item.id === id);
      if (changed) {
        appendAuditLog(`체크리스트 변경: ${changed.label} (${changed.done ? "완료" : "대기"})`);
      }
      return next;
    });
  };

  const handleSaveMemo = () => {
    if (!memoInput.trim()) return;
    appendMemo(memoInput.trim(), data.header.assignee.name);
    appendAuditLog(`운영 메모 등록: ${memoInput.trim().slice(0, 40)}`);
    setMemoInput("");
    setToastMessage("운영 메모가 저장되었습니다.");
  };

  const handleAuthorize = () => {
    const reason = authorizeReason.trim() || "운영 추적";
    setPiiExpanded(true);
    setAuthorizeModalOpen(false);
    appendAuditLog(`권한자 열람 실행 (${reason})`);
    appendMemo(`권한자 열람 실행 사유: ${reason}`);
    setAuthorizeReason("");
    setToastMessage("권한자 열람 실행 기록이 저장되었습니다.");
  };

  const handleInputCta = () => {
    scrollToTarget("checklist");
    appendAuditLog("2차 2단계 입력 이동 버튼 실행");
    setToastMessage("2차 2단계 입력 위치로 이동했습니다.");
  };

  return (
    <div className="min-h-screen bg-[#f4f7fb] pb-24">
      {toastMessage && (
        <div className="fixed right-4 top-20 z-50 rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-medium text-slate-700 shadow-lg">
          {toastMessage}
        </div>
      )}

      <StickyCaseHeader
        data={data}
        operational={data.operational}
        onBack={onBack}
        onRequestSupport={() => setActionModal(actions.recommendedActions.find((item) => item.key === "REQUEST_SUPPORT") ?? null)}
        onFocusMissing={() => scrollToTarget("checklist")}
      />

      <main className="mx-auto grid w-full max-w-[1320px] grid-cols-1 gap-4 px-4 py-5 md:px-6">
        <ExecutiveSummaryGrid
          data={data}
          actions={actions}
          primaryAction={primaryAction}
          secondaryActions={secondaryActions}
          onOpenAction={setActionModal}
          onFocusCard={scrollToTarget}
          missingDetails={missingDetails}
        />

        <EvidenceGrid
          data={data}
          focusTarget={focusTarget}
          cistRef={cistRef}
          snsbRef={snsbRef}
          checklistWaiting={checklistWaiting}
          onInputCta={handleInputCta}
        />

        <WorkflowTraceGrid
          focusTarget={focusTarget}
          workflowRef={workflowRef}
          checklistRef={checklistRef}
          timeline={timeline}
          checklist={checklist}
          auditLogs={auditLogs}
          memos={memos}
          pii={data.pii}
          piiExpanded={piiExpanded}
          memoExpanded={memoExpanded}
          memoInput={memoInput}
          onToggleChecklist={toggleChecklist}
          onToggleMemoExpanded={() => setMemoExpanded((prev) => !prev)}
          onMemoInputChange={setMemoInput}
          onSaveMemo={handleSaveMemo}
          onOpenAuthorize={() => setAuthorizeModalOpen(true)}
        />

        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900">
          모든 분류/점수/권고는 운영 참고 정보입니다. 의료진 확인 전 / 담당자 검토 필요.
        </p>
      </main>

      {primaryAction && (
        <div className="fixed bottom-4 left-4 right-4 z-40 md:hidden">
          <Button
            className="h-12 w-full rounded-xl bg-[#15386a] text-sm font-bold text-white hover:bg-[#102b4e]"
            onClick={() => setActionModal(primaryAction)}
          >
            <ExternalLink className="h-4 w-4" />
            다음 액션 1순위 실행: {primaryAction.label}
          </Button>
        </div>
      )}

      <Dialog open={Boolean(actionModal)} onOpenChange={(open) => !open && setActionModal(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>다음 액션 실행 전 확인</DialogTitle>
            <DialogDescription>
              아래 근거는 운영 참고 정보입니다. 의료진 확인 전 / 담당자 검토 필요.
            </DialogDescription>
          </DialogHeader>

          {actionModal && (
            <div className="space-y-3">
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <p className="text-sm font-bold text-slate-900">
                  {actionModal.priority}. {actionModal.label}
                </p>
                <p className="mt-1 text-xs text-slate-600">{actionModal.helper}</p>
                <ul className="mt-2 space-y-1 text-xs text-slate-700">
                  {actionModal.rationale.map((item) => (
                    <li key={item} className="flex items-start gap-2">
                      <span className="mt-[6px] h-1 w-1 rounded-full bg-slate-500" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <label htmlFor="action-reason" className="text-xs font-semibold text-slate-600">
                  실행 사유(선택)
                </label>
                <Input
                  id="action-reason"
                  value={actionReason}
                  onChange={(event) => setActionReason(event.target.value)}
                  className="mt-1"
                  placeholder="예: 예약 지연 예방을 위한 우선 처리"
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setActionModal(null)}>
              취소
            </Button>
            <Button
              onClick={() => {
                if (!actionModal) return;
                runAction(actionModal, actionReason);
                setActionModal(null);
                setActionReason("");
              }}
              className="bg-[#15386a] text-white hover:bg-[#102b4e]"
            >
              실행 기록 남기기
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={authorizeModalOpen} onOpenChange={setAuthorizeModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>권한자 열람 실행</DialogTitle>
            <DialogDescription>
              개인정보 열람은 기본 비식별 상태에서 필요한 경우에만 실행하며, 감사 로그에 자동 기록됩니다.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
              운영 참고용 열람입니다. 최종 조치는 담당자와 의료진 확인 절차를 따릅니다.
            </div>

            <div>
              <label htmlFor="authorize-reason" className="text-xs font-semibold text-slate-600">
                열람 사유
              </label>
              <Textarea
                id="authorize-reason"
                value={authorizeReason}
                onChange={(event) => setAuthorizeReason(event.target.value)}
                className="mt-1 min-h-[90px]"
                placeholder="예: 보호자 문의 대응을 위한 연락처 재확인"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAuthorizeModalOpen(false)}>
              닫기
            </Button>
            <Button onClick={handleAuthorize} className="bg-[#15386a] text-white hover:bg-[#102b4e]">
              열람 실행 기록 남기기
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

interface StickyCaseHeaderProps {
  data: Stage2CaseDetailData;
  operational: Stage2OperationalState;
  onBack: () => void;
  onRequestSupport: () => void;
  onFocusMissing: () => void;
}

export function StickyCaseHeader({
  data,
  operational,
  onBack,
  onRequestSupport,
  onFocusMissing,
}: StickyCaseHeaderProps) {
  const chipItems: StatusChipItem[] = [
    {
      id: "risk",
      label: `위험 신호(참고) ${operational.riskSignalLevel}`,
      tone: operational.riskSignalLevel === "즉시 확인 필요" ? "attention" : operational.riskSignalLevel === "주의" ? "warning" : "success",
      ariaLabel: `위험 신호 참고 ${operational.riskSignalLevel}`,
    },
    {
      id: "missing",
      label: `누락 ${operational.dataMissingCount}건`,
      tone: operational.dataMissingCount > 0 ? "warning" : "success",
      ariaLabel: `누락 ${operational.dataMissingCount}건`,
      onClick: onFocusMissing,
    },
    {
      id: "trigger",
      label: `재평가 트리거 ${operational.reevalTrigger}`,
      tone: operational.reevalTrigger === "ON" ? "warning" : "neutral",
      ariaLabel: `재평가 트리거 ${operational.reevalTrigger}`,
    },
  ];

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 shadow-sm backdrop-blur">
      <div className="mx-auto flex w-full max-w-[1320px] flex-wrap items-center justify-between gap-3 px-4 py-3 md:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <Button variant="outline" size="icon" onClick={onBack} aria-label="목록으로 이동">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-base font-bold text-slate-900 md:text-lg">{data.header.caseId}</h1>
              <Badge className="border-blue-200 bg-blue-50 text-blue-800">{data.header.stageLabel}</Badge>
              <Badge className="border-slate-200 bg-slate-100 text-slate-700">{data.header.currentStatus}</Badge>
            </div>
            <p className="truncate text-xs text-slate-600">
              {data.header.assignee.name} · {data.header.assignee.role} · {data.header.centerName}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2">
          <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] text-slate-600">
            최근 업데이트 {data.header.lastUpdatedAt}
          </span>
          <StatusChips items={chipItems} />
          <Button variant="outline" className="h-8 px-3 text-xs font-semibold" onClick={onRequestSupport}>
            <ShieldCheck className="h-3.5 w-3.5" />
            운영 지원 요청
          </Button>
        </div>
      </div>
    </header>
  );
}

interface ExecutiveSummaryGridProps {
  data: Stage2CaseDetailData;
  actions: Stage2ActionState;
  primaryAction: ActionItem;
  secondaryActions: ActionItem[];
  onOpenAction: (item: ActionItem) => void;
  onFocusCard: (target: FocusTarget) => void;
  missingDetails: string[];
}

export function ExecutiveSummaryGrid({
  data,
  actions,
  primaryAction,
  secondaryActions,
  onOpenAction,
  onFocusCard,
  missingDetails,
}: ExecutiveSummaryGridProps) {
  return (
    <section className="grid grid-cols-1 gap-4 xl:grid-cols-12">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:col-span-8">
        <SummaryCard
          title="인지검사 요약(참고)"
          value={`${data.evidence.cist.score}/${data.evidence.cist.maxScore}`}
          description={`CIST · 신뢰도 ${data.evidence.cist.reliability}`}
          caption={`시행일 ${data.evidence.cist.date}`}
          icon={<ClipboardCheck className="h-4 w-4 text-blue-700" />}
          chips={[
            {
              id: "cist-reliability",
              label: `신뢰도 ${data.evidence.cist.reliability}`,
              tone: data.evidence.cist.reliability === "양호" ? "success" : data.evidence.cist.reliability === "보통" ? "warning" : "attention",
              ariaLabel: `CIST 신뢰도 ${data.evidence.cist.reliability}`,
            },
          ]}
          onClick={() => onFocusCard("cist")}
        />

        <SummaryCard
          title="2차 1단계 결과(참고)"
          value={`${data.evidence.snsb.zScore} SD`}
          description={`SNSB · 신뢰도 ${data.evidence.snsb.reliability}`}
          caption={`누락 ${data.evidence.snsb.missingCount}건`}
          icon={<Siren className="h-4 w-4 text-amber-700" />}
          chips={[
            {
              id: "snsb-missing",
              label: `누락 ${data.evidence.snsb.missingCount}건`,
              tone: data.evidence.snsb.missingCount > 0 ? "warning" : "success",
              ariaLabel: `SNSB 누락 ${data.evidence.snsb.missingCount}건`,
            },
            {
              id: "snsb-reliability",
              label: `신뢰도 ${data.evidence.snsb.reliability}`,
              tone: data.evidence.snsb.reliability === "양호" ? "success" : data.evidence.snsb.reliability === "보통" ? "warning" : "attention",
              ariaLabel: `SNSB 신뢰도 ${data.evidence.snsb.reliability}`,
            },
          ]}
          onClick={() => onFocusCard("snsb")}
        />

        <SummaryCard
          title="2차 2단계 상태"
          value={data.evidence.stage2Clinical.status}
          description={`체크 항목 ${data.evidence.stage2Clinical.checklistCount}개 · 평가자 ${data.evidence.stage2Clinical.evaluator}`}
          caption={data.evidence.stage2Clinical.evalDate ? `평가일 ${data.evidence.stage2Clinical.evalDate}` : "평가일 미입력"}
          icon={<ListChecks className="h-4 w-4 text-slate-700" />}
          chips={[
            {
              id: "clinical-status",
              label: data.evidence.stage2Clinical.status,
              tone: data.evidence.stage2Clinical.status === "완료" ? "success" : "warning",
              ariaLabel: `2차 2단계 ${data.evidence.stage2Clinical.status}`,
            },
          ]}
          onClick={() => onFocusCard("checklist")}
        />

        <SummaryCard
          title="예약/의뢰 진행"
          value={`${actions.referralStatus} · ${actions.reservationStatus}`}
          description="의뢰 및 예약 동기화 상태"
          caption={missingDetails.length ? `누락: ${missingDetails.join(", ")}` : "누락 없음"}
          icon={<CalendarClock className="h-4 w-4 text-indigo-700" />}
          chips={[
            {
              id: "referral",
              label: `의뢰 ${actions.referralStatus}`,
              tone: referralTone(actions.referralStatus),
              ariaLabel: `의뢰 상태 ${actions.referralStatus}`,
            },
            {
              id: "reservation",
              label: `예약 ${actions.reservationStatus}`,
              tone: reservationTone(actions.reservationStatus),
              ariaLabel: `예약 상태 ${actions.reservationStatus}`,
            },
          ]}
          onClick={() => onFocusCard("workflow")}
        />
      </div>

      <NextActionPanel
        primaryAction={primaryAction}
        secondaryActions={secondaryActions}
        onOpenAction={onOpenAction}
      />
    </section>
  );
}

interface SummaryCardProps {
  title: string;
  value: string;
  description: string;
  caption: string;
  chips: StatusChipItem[];
  icon: React.ReactNode;
  onClick: () => void;
}

export function SummaryCard({
  title,
  value,
  description,
  caption,
  chips,
  icon,
  onClick,
}: SummaryCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
      aria-label={`${title} 카드 열기`}
    >
      <Card className="h-full min-h-[170px] border-slate-200 bg-white shadow-sm transition hover:border-blue-200 hover:shadow-md">
        <CardHeader className="flex min-h-[64px] flex-row items-start justify-between border-b border-slate-100 px-4 py-3">
          <CardTitle className="text-sm font-semibold text-slate-800">{title}</CardTitle>
          {icon}
        </CardHeader>
        <CardContent className="space-y-2 px-4 py-3">
          <p className="text-xl font-bold text-slate-900">{value}</p>
          <p className="text-xs text-slate-600">{description}</p>
          <StatusChips items={chips} />
          <p className="text-[11px] text-slate-500">{caption}</p>
        </CardContent>
      </Card>
    </button>
  );
}

interface NextActionPanelProps {
  primaryAction: ActionItem;
  secondaryActions: ActionItem[];
  onOpenAction: (item: ActionItem) => void;
}

export function NextActionPanel({
  primaryAction,
  secondaryActions,
  onOpenAction,
}: NextActionPanelProps) {
  const quickMap: Record<ActionKey, string> = {
    CREATE_REFERRAL: "의뢰서 생성",
    SEND_REFERRAL: "의뢰서 전송",
    TRACK_RESERVATION: "예약 현황 추적",
    AUTHORIZE_VIEW: "권한자 열람 실행",
    REQUEST_SUPPORT: "운영 지원 요청",
  };

  return (
    <Card className="border-[#163b6f]/20 bg-[#f7fbff] shadow-sm xl:col-span-4">
      <CardHeader className="border-b border-blue-100 px-4 py-3">
        <CardTitle className="text-sm font-bold text-[#15386a]">Next Action Panel</CardTitle>
        <p className="text-[11px] text-slate-600">운영 권고(참고) · 의료진 확인 전 / 담당자 검토 필요</p>
      </CardHeader>
      <CardContent className="space-y-3 px-4 py-4">
        <div className="rounded-lg border border-blue-200 bg-white p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-bold text-slate-900">
              {primaryAction.priority}. {primaryAction.label}
            </p>
            <Badge className="border-blue-200 bg-blue-50 text-blue-800">{primaryAction.helper}</Badge>
          </div>
          <div className="mt-2 space-y-1 text-xs text-slate-700">
            {primaryAction.rationale.map((reason) => (
              <p key={reason} className="flex items-start gap-2">
                <span className="mt-[6px] h-1 w-1 rounded-full bg-slate-500" />
                <span>{reason}</span>
              </p>
            ))}
          </div>
          <Button
            className="mt-3 h-9 w-full bg-[#15386a] text-xs font-bold text-white hover:bg-[#102b4e]"
            onClick={() => onOpenAction(primaryAction)}
          >
            <ExternalLink className="h-3.5 w-3.5" />
            다음 액션 1순위 실행
          </Button>
        </div>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {secondaryActions.map((action) => (
            <Button
              key={action.key}
              variant="outline"
              className="h-8 justify-start text-xs font-semibold"
              onClick={() => onOpenAction(action)}
            >
              {action.priority}. {quickMap[action.key]}
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

interface EvidenceGridProps {
  data: Stage2CaseDetailData;
  focusTarget: FocusTarget | null;
  cistRef: React.RefObject<HTMLDivElement>;
  snsbRef: React.RefObject<HTMLDivElement>;
  checklistWaiting: boolean;
  onInputCta: () => void;
}

export function EvidenceGrid({
  data,
  focusTarget,
  cistRef,
  snsbRef,
  checklistWaiting,
  onInputCta,
}: EvidenceGridProps) {
  return (
    <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <div ref={cistRef}>
        <CistEvidenceCard
          metric={data.evidence.cist}
          highlight={focusTarget === "cist"}
          checklistWaiting={checklistWaiting}
          onInputCta={onInputCta}
        />
      </div>
      <div ref={snsbRef}>
        <SnsbEvidenceCard
          metric={data.evidence.snsb}
          highlight={focusTarget === "snsb"}
          checklistWaiting={checklistWaiting}
          onInputCta={onInputCta}
        />
      </div>
    </section>
  );
}

interface CistEvidenceCardProps {
  metric: Stage2CaseDetailData["evidence"]["cist"];
  highlight: boolean;
  checklistWaiting: boolean;
  onInputCta: () => void;
}

export function CistEvidenceCard({
  metric,
  highlight,
  checklistWaiting,
  onInputCta,
}: CistEvidenceCardProps) {
  return (
    <Card className={cn("border-slate-200 bg-white shadow-sm transition", highlight && "ring-2 ring-blue-400 ring-offset-2")}>
      <CardHeader className="flex min-h-[72px] flex-row items-start justify-between border-b border-slate-100 px-4 py-3">
        <div>
          <CardTitle className="text-sm font-bold text-slate-900">CIST 결과(참고)</CardTitle>
          <p className="text-xs text-slate-600">의료진 확인 전 / 담당자 검토 필요</p>
        </div>
        <StatusChips
          items={[
            {
              id: "cist-reliability",
              label: `신뢰도 ${metric.reliability}`,
              tone: metric.reliability === "양호" ? "success" : metric.reliability === "보통" ? "warning" : "attention",
              ariaLabel: `CIST 신뢰도 ${metric.reliability}`,
            },
          ]}
        />
      </CardHeader>

      <CardContent className="space-y-3 px-4 py-4">
        <div className="flex items-end justify-between gap-2">
          <p className="text-3xl font-bold text-slate-900">
            {metric.score}
            <span className="ml-1 text-lg text-slate-500">/ {metric.maxScore}</span>
          </p>
          <Badge className="border-slate-200 bg-slate-100 text-slate-700">구간 해석은 운영 참고</Badge>
        </div>

        {checklistWaiting && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            <span className="font-medium">2차 2단계 입력 대기</span>
            <Button size="sm" className="h-7 bg-amber-600 text-[11px] text-white hover:bg-amber-700" onClick={onInputCta}>
              입력하러 가기
            </Button>
          </div>
        )}

        <ScoreGauge
          label={metric.label}
          score={metric.score}
          maxScore={metric.maxScore}
          segments={metric.segments}
          cutLines={metric.cutLines}
        />

        <div className="grid grid-cols-2 gap-2 text-xs text-slate-600">
          <p>시행일: {metric.date}</p>
          <p className="text-right">평가자: {metric.evaluator}</p>
          <p>누락 항목: {metric.missingCount}건</p>
          <p className="text-right">신뢰도: {metric.reliability}</p>
        </div>
      </CardContent>
    </Card>
  );
}

interface SnsbEvidenceCardProps {
  metric: Stage2CaseDetailData["evidence"]["snsb"];
  highlight: boolean;
  checklistWaiting: boolean;
  onInputCta: () => void;
}

export function SnsbEvidenceCard({
  metric,
  highlight,
  checklistWaiting,
  onInputCta,
}: SnsbEvidenceCardProps) {
  return (
    <Card className={cn("border-slate-200 bg-white shadow-sm transition", highlight && "ring-2 ring-blue-400 ring-offset-2")}>
      <CardHeader className="flex min-h-[72px] flex-row items-start justify-between border-b border-slate-100 px-4 py-3">
        <div>
          <CardTitle className="text-sm font-bold text-slate-900">SNSB 결과(참고)</CardTitle>
          <p className="text-xs text-slate-600">이탈 정도는 운영 정렬용 지표입니다.</p>
        </div>
        <StatusChips
          items={[
            {
              id: "snsb-missing",
              label: `누락 ${metric.missingCount}건`,
              tone: metric.missingCount > 0 ? "warning" : "success",
              ariaLabel: `SNSB 누락 ${metric.missingCount}건`,
            },
          ]}
        />
      </CardHeader>

      <CardContent className="space-y-3 px-4 py-4">
        <div className="flex items-end justify-between gap-2">
          <p className="text-3xl font-bold text-slate-900">
            {metric.zScore}
            <span className="ml-1 text-lg text-slate-500">SD</span>
          </p>
          <Badge className="border-slate-200 bg-slate-100 text-slate-700">컷라인은 운영 참고</Badge>
        </div>

        {checklistWaiting && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            <span className="font-medium">2차 2단계 입력 대기</span>
            <Button size="sm" className="h-7 bg-amber-600 text-[11px] text-white hover:bg-amber-700" onClick={onInputCta}>
              입력하러 가기
            </Button>
          </div>
        )}

        <ZScoreBar
          value={metric.zScore}
          min={metric.scaleMin}
          max={metric.scaleMax}
          cutLines={metric.cutLines}
        />

        <div className="grid grid-cols-2 gap-2 text-xs text-slate-600">
          <p>시행일: {metric.date}</p>
          <p className="text-right">평가자: {metric.evaluator}</p>
          <p>누락 항목: {metric.missingCount}건</p>
          <p className="text-right">신뢰도: {metric.reliability}</p>
        </div>
      </CardContent>
    </Card>
  );
}

interface WorkflowTraceGridProps {
  focusTarget: FocusTarget | null;
  workflowRef: React.RefObject<HTMLDivElement>;
  checklistRef: React.RefObject<HTMLDivElement>;
  timeline: TimelineStep[];
  checklist: Stage2ChecklistItem[];
  auditLogs: AuditLogItem[];
  memos: Stage2MemoItem[];
  pii: Stage2CaseDetailData["pii"];
  piiExpanded: boolean;
  memoExpanded: boolean;
  memoInput: string;
  onToggleChecklist: (id: string) => void;
  onToggleMemoExpanded: () => void;
  onMemoInputChange: (value: string) => void;
  onSaveMemo: () => void;
  onOpenAuthorize: () => void;
}

export function WorkflowTraceGrid({
  focusTarget,
  workflowRef,
  checklistRef,
  timeline,
  checklist,
  auditLogs,
  memos,
  pii,
  piiExpanded,
  memoExpanded,
  memoInput,
  onToggleChecklist,
  onToggleMemoExpanded,
  onMemoInputChange,
  onSaveMemo,
  onOpenAuthorize,
}: WorkflowTraceGridProps) {
  return (
    <section className="grid grid-cols-1 gap-4 xl:grid-cols-12">
      <div ref={workflowRef} className="space-y-4 xl:col-span-7">
        <WorkflowTimeline timeline={timeline} highlight={focusTarget === "workflow"} />
        <div ref={checklistRef}>
          <ChecklistPanel checklist={checklist} highlight={focusTarget === "checklist"} onToggle={onToggleChecklist} />
        </div>
      </div>

      <div className="space-y-4 xl:col-span-5">
        <AuditLogTable logs={auditLogs} />
        <OperationalMemoPanel
          pii={pii}
          piiExpanded={piiExpanded}
          memos={memos}
          memoExpanded={memoExpanded}
          memoInput={memoInput}
          onToggleMemoExpanded={onToggleMemoExpanded}
          onMemoInputChange={onMemoInputChange}
          onSaveMemo={onSaveMemo}
          onOpenAuthorize={onOpenAuthorize}
        />
      </div>
    </section>
  );
}

interface WorkflowTimelineProps {
  timeline: TimelineStep[];
  highlight: boolean;
}

export function WorkflowTimeline({ timeline, highlight }: WorkflowTimelineProps) {
  return (
    <Card className={cn("border-slate-200 bg-white shadow-sm transition", highlight && "ring-2 ring-blue-400 ring-offset-2")}>
      <CardHeader className="border-b border-slate-100 px-4 py-3">
        <CardTitle className="flex items-center gap-2 text-sm font-bold text-slate-900">
          <ClockLabelIcon />
          작업 타임라인
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 px-4 py-4">
        {timeline.map((step) => (
          <div key={step.id} className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-semibold text-slate-800">{step.title}</p>
              <Badge className={cn("text-[11px]", stageTone(step.status))}>
                {step.status === "done" ? "완료" : step.status === "waiting" ? "대기" : "미입력"}
              </Badge>
            </div>
            <p className="mt-1 text-[11px] text-slate-600">{step.at ?? "시각 미입력"}</p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

interface ChecklistPanelProps {
  checklist: Stage2ChecklistItem[];
  highlight: boolean;
  onToggle: (id: string) => void;
}

export function ChecklistPanel({ checklist, highlight, onToggle }: ChecklistPanelProps) {
  return (
    <Card className={cn("border-slate-200 bg-white shadow-sm transition", highlight && "ring-2 ring-blue-400 ring-offset-2")}>
      <CardHeader className="border-b border-slate-100 px-4 py-3">
        <CardTitle className="flex items-center gap-2 text-sm font-bold text-slate-900">
          <ListChecks className="h-4 w-4 text-slate-600" />
          체크리스트
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 px-4 py-4">
        {checklist.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onToggle(item.id)}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-left transition hover:bg-slate-50"
            aria-label={`체크리스트 ${item.label} ${item.done ? "완료" : "대기"}`}
          >
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-semibold text-slate-800">{item.label}</p>
              <Badge className={cn("text-[11px]", item.done ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-amber-200 bg-amber-50 text-amber-800")}>
                {item.done ? "완료" : "대기"}
              </Badge>
            </div>
            {item.note && <p className="mt-1 text-[11px] text-slate-600">{item.note}</p>}
          </button>
        ))}
      </CardContent>
    </Card>
  );
}

interface AuditLogTableProps {
  logs: AuditLogItem[];
}

export function AuditLogTable({ logs }: AuditLogTableProps) {
  return (
    <Card className="border-slate-200 bg-white shadow-sm">
      <CardHeader className="border-b border-slate-100 px-4 py-3">
        <CardTitle className="flex items-center gap-2 text-sm font-bold text-slate-900">
          <ShieldAlert className="h-4 w-4 text-slate-600" />
          감사 로그
        </CardTitle>
      </CardHeader>
      <CardContent className="px-0 py-0">
        {logs.length === 0 ? (
          <p className="px-4 py-4 text-xs text-slate-500">감사 로그가 아직 없습니다.</p>
        ) : (
          <div className="max-h-[260px] overflow-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-50 text-[11px] text-slate-500">
                <tr>
                  <th className="px-4 py-2 font-medium">시각</th>
                  <th className="px-4 py-2 font-medium">행위자</th>
                  <th className="px-4 py-2 font-medium">기록</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
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
  );
}

interface OperationalMemoPanelProps {
  pii: Stage2CaseDetailData["pii"];
  piiExpanded: boolean;
  memos: Stage2MemoItem[];
  memoExpanded: boolean;
  memoInput: string;
  onToggleMemoExpanded: () => void;
  onMemoInputChange: (value: string) => void;
  onSaveMemo: () => void;
  onOpenAuthorize: () => void;
}

export function OperationalMemoPanel({
  pii,
  piiExpanded,
  memos,
  memoExpanded,
  memoInput,
  onToggleMemoExpanded,
  onMemoInputChange,
  onSaveMemo,
  onOpenAuthorize,
}: OperationalMemoPanelProps) {
  return (
    <Card className="border-slate-200 bg-white shadow-sm">
      <CardHeader className="border-b border-slate-100 px-4 py-3">
        <CardTitle className="flex items-center gap-2 text-sm font-bold text-slate-900">
          <FileText className="h-4 w-4 text-slate-600" />
          운영 메모/권고
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-3 px-4 py-4">
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
          운영 권고(참고): 분류 결과는 정렬용 정보입니다. 의료진 확인 전 / 담당자 검토 필요.
        </div>

        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-semibold text-slate-700">개인정보 요약(기본 접힘)</p>
            <Button variant="outline" size="sm" className="h-7 text-[11px]" onClick={onOpenAuthorize}>
              <Eye className="h-3.5 w-3.5" />
              권한자 열람 실행
            </Button>
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-slate-600">
            <InfoLine label="이름" value={pii.maskedName} />
            <InfoLine label="연령/성별" value={`${pii.age}세 · ${pii.gender}`} />
            <InfoLine label="연락처" value={pii.maskedPhone} />
            <InfoLine label="보호자" value={pii.guardianMasked ?? "미등록"} />
          </div>
          {piiExpanded ? (
            <div className="mt-2 rounded-md border border-blue-200 bg-blue-50 px-2 py-1 text-[11px] text-blue-900">
              권한자 열람 실행 상태: 상세 확인 가능 · 감사 로그 기록됨
            </div>
          ) : (
            <div className="mt-2 rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] text-slate-600">
              비식별 상태 유지 중입니다.
            </div>
          )}
        </div>

        <div className="rounded-lg border border-slate-200">
          <button
            type="button"
            className="flex w-full items-center justify-between px-3 py-2 text-left text-xs font-semibold text-slate-700"
            onClick={onToggleMemoExpanded}
          >
            <span className="flex items-center gap-2">
              <Lock className="h-3.5 w-3.5 text-slate-500" />
              운영 메모 이력
            </span>
            {memoExpanded ? <ChevronUp className="h-4 w-4 text-slate-500" /> : <ChevronDown className="h-4 w-4 text-slate-500" />}
          </button>

          {memoExpanded && (
            <div className="space-y-2 border-t border-slate-200 px-3 py-3">
              <div className="max-h-[180px] space-y-2 overflow-auto">
                {memos.length === 0 ? (
                  <p className="text-xs text-slate-500">저장된 운영 메모가 없습니다.</p>
                ) : (
                  memos.map((memo) => (
                    <div key={memo.id} className="rounded-md border border-slate-100 bg-slate-50 px-2 py-1.5">
                      <p className="text-[11px] text-slate-500">
                        {memo.timestamp} · {memo.author}
                      </p>
                      <p className="mt-1 text-xs text-slate-700">{memo.content}</p>
                    </div>
                  ))
                )}
              </div>

              <Textarea
                value={memoInput}
                onChange={(event) => onMemoInputChange(event.target.value)}
                className="min-h-[90px]"
                placeholder="운영 참고 메모를 입력하세요."
              />
              <Button className="h-8 w-full bg-[#15386a] text-xs font-semibold text-white hover:bg-[#102b4e]" onClick={onSaveMemo}>
                메모 저장
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

interface ScoreGaugeProps {
  label: string;
  score: number;
  maxScore: number;
  segments: Stage2CaseDetailData["evidence"]["cist"]["segments"];
  cutLines: number[];
}

export function ScoreGauge({ label, score, maxScore, segments, cutLines }: ScoreGaugeProps) {
  const markerLeft = (clampValue(score, 0, maxScore) / maxScore) * 100;
  return (
    <div
      className="space-y-2"
      role="img"
      aria-label={`${label} 점수 ${score}/${maxScore}, 운영 참고용 게이지`}
      title="운영 참고용 구간이며 의료진 확인 전입니다."
    >
      <div className="relative">
        <div className="flex h-4 overflow-hidden rounded-full border border-slate-200">
          {segments.map((segment) => {
            const width = ((segment.max - segment.min) / maxScore) * 100;
            return (
              <div
                key={`${segment.label}-${segment.min}`}
                className={cn(
                  "h-full",
                  segment.tone === "success" && "bg-emerald-200",
                  segment.tone === "warning" && "bg-amber-200",
                  segment.tone === "attention" && "bg-red-200",
                  segment.tone === "neutral" && "bg-slate-200",
                )}
                style={{ width: `${width}%` }}
              />
            );
          })}
        </div>

        {cutLines.map((line) => (
          <span
            key={line}
            className="absolute top-0 h-4 w-[2px] bg-slate-500/60"
            style={{ left: `${(line / maxScore) * 100}%` }}
            aria-hidden="true"
          />
        ))}

        <span
          className="absolute -top-1 h-6 w-[3px] rounded bg-[#15386a]"
          style={{ left: `${markerLeft}%` }}
          aria-hidden="true"
        />
      </div>

      <div className="flex items-center justify-between text-[11px] text-slate-500">
        <span>0</span>
        <span>컷 {cutLines.join(" / ")}</span>
        <span>{maxScore}</span>
      </div>
      <p className="text-[11px] text-slate-600">운영 참고용 구간이며 의료진 확인 전 해석 기준입니다.</p>
    </div>
  );
}

interface ZScoreBarProps {
  value: number;
  min: number;
  max: number;
  cutLines: number[];
}

export function ZScoreBar({ value, min, max, cutLines }: ZScoreBarProps) {
  const toLeft = (number: number) => ((clampValue(number, min, max) - min) / (max - min)) * 100;
  const markerLeft = toLeft(value);
  const zeroLeft = toLeft(0);

  return (
    <div
      className="space-y-2"
      role="img"
      aria-label={`SNSB Z score ${value}, 축 범위 ${min}부터 ${max}까지`}
      title="운영 참고용 구간이며 의료진 확인 전입니다."
    >
      <div className="relative h-5 rounded-full border border-slate-200 bg-gradient-to-r from-red-100 via-amber-100 to-emerald-100">
        <span className="absolute top-0 h-5 w-[2px] bg-slate-500" style={{ left: `${zeroLeft}%` }} aria-hidden="true" />

        {cutLines.map((line) => (
          <span
            key={line}
            className="absolute top-0 h-5 w-[1px] border-r border-dashed border-slate-500/80"
            style={{ left: `${toLeft(line)}%` }}
            aria-hidden="true"
          />
        ))}

        <span className="absolute -top-1 h-7 w-[3px] rounded bg-[#15386a]" style={{ left: `${markerLeft}%` }} aria-hidden="true" />
      </div>
      <div className="flex items-center justify-between text-[11px] text-slate-500">
        <span>{min}</span>
        <span>0</span>
        <span>{max}</span>
      </div>
      <p className="text-[11px] text-slate-600">컷라인 {cutLines.join(", ")} SD는 운영 참고용 기준입니다.</p>
    </div>
  );
}

interface StatusChipsProps {
  items: StatusChipItem[];
}

export function StatusChips({ items }: StatusChipsProps) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {items.map((item) =>
        item.onClick ? (
          <button
            key={item.id}
            type="button"
            onClick={item.onClick}
            aria-label={item.ariaLabel}
            className={cn("rounded-md border px-2 py-0.5 text-[11px] font-semibold transition hover:opacity-80", toneClass(item.tone))}
          >
            {item.label}
          </button>
        ) : (
          <span
            key={item.id}
            aria-label={item.ariaLabel}
            className={cn("rounded-md border px-2 py-0.5 text-[11px] font-semibold", toneClass(item.tone))}
          >
            {item.label}
          </span>
        ),
      )}
    </div>
  );
}

function clampValue(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function ClockLabelIcon() {
  return <CheckCircle2 className="h-4 w-4 text-slate-600" />;
}

function InfoLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-slate-200 bg-white px-2 py-1">
      <p className="text-[11px] text-slate-500">{label}</p>
      <p className="text-xs font-semibold text-slate-700">{value}</p>
    </div>
  );
}
