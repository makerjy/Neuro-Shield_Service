/**
 * 통합 상담·문자 패널 (v2)
 * Stage 1/2/3 케이스 상세화면에서 공통 사용
 *
 * 탭 구성:
 *  📞 전화상담  — 4단계 스크립트, 체크포인트, 통화 결과
 *  💬 문자발송  — 상태 기반 템플릿/미리보기/발송/타임라인
 *  🔗 연계     — 프로그램 연계 / v1 상담·문자 페이지 이동
 */
import React, { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  ArrowRightCircle,
  CalendarClock,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock3,
  Layers,
  MessageSquare,
  Phone,
  PhoneCall,
  Send,
  Timer,
  User,
  Users,
  X,
  XCircle,
} from "lucide-react";
import { toast } from "sonner@2.0.3";
import {
  SMS_RECOMMENDED_ACTIONS,
  SMS_STATUS_META,
  resolveSmsStageFromLabel,
  toPanelTemplates,
  type SmsLifecycleStatus,
  type SmsRecommendedAction,
  type SmsStage,
  type SmsTemplateType,
} from "../../../features/sms/templateRegistry";
import { Badge } from "../../ui/badge";
import { Button } from "../../ui/button";
import { Textarea } from "../../ui/textarea";
import { cn } from "../../ui/utils";
import {
  buildSmsLandingLink,
  createClientSmsToken,
  getDefaultSmsLandingLink,
  type SmsHistoryItem,
  type SmsSendResult,
  nowFormatted,
  resolveSmsLifecycleByResult,
  sendSmsApi,
  toDispatchStatus,
} from "./smsService";

/* ══════════════════════════════════════════════════
   타입
══════════════════════════════════════════════════ */
export type SmsMessageType = SmsTemplateType;

export interface SmsTemplate {
  id: string;
  type: SmsMessageType;
  label: string;
  body: (params: SmsTemplateVars) => string;
}

export interface SmsTemplateVars {
  centerName: string;
  centerPhone: string;
  guideLink: string;
  bookingLink: string;
  caseAlias?: string;
  dueDate?: string;
  optOut?: string;
}

/** 전화상담 스크립트 1단계 */
export interface CallScriptStep {
  step: string;
  title: string;
  content: string;
  tips: string[];
  checkpoints: string[];
}

export interface SmsPanelProps {
  stageLabel: string;
  stageCode?: SmsStage;
  templates: SmsTemplate[];
  defaultVars?: Partial<SmsTemplateVars>;
  caseId: string;
  centerId?: string;
  citizenPhone?: string;
  guardianPhone?: string;
  onSmsSent?: (history: SmsHistoryItem) => void;
  onConsultation?: (note: string, type: SmsMessageType, templateLabel: string) => void;
  /** 전화상담 스크립트 (없으면 기본 4단계 사용) */
  callScripts?: CallScriptStep[];
  /** 연계 탭 진입 콜백 */
  onNavigateLink?: (entry: "call" | "sms" | "program") => void;
  /** 연계 탭 표시 여부 */
  showLinkageTab?: boolean;
  compact?: boolean;
}

type MainTab = "CALL" | "SMS" | "LINK";

type StatusTimelineItem = {
  id: string;
  at: string;
  status: SmsLifecycleStatus;
  note?: string;
};

/* ── 상수 ── */
const TYPE_LABELS: Record<SmsMessageType, string> = {
  CONTACT: "접촉",
  BOOKING: "예약안내",
  REMINDER: "리마인더",
};

const TYPE_COLORS: Record<SmsMessageType, string> = {
  CONTACT: "bg-blue-100 text-blue-800",
  BOOKING: "bg-emerald-100 text-emerald-800",
  REMINDER: "bg-amber-100 text-amber-800",
};

const HISTORY_STATUS_LABEL: Record<SmsHistoryItem["status"], string> = {
  SENT: "발송",
  SCHEDULED: "예약발송",
  FAILED: "실패",
  DELIVERED: "도착",
  CLICKED: "링크 클릭",
  ACTION_COMPLETED: "절차 완료",
  NO_RESPONSE: "무응답",
  OPTOUT: "수신거부",
};

const HISTORY_STATUS_TONE: Record<SmsHistoryItem["status"], string> = {
  SENT: "text-indigo-700 border-indigo-300",
  SCHEDULED: "text-blue-700 border-blue-300",
  FAILED: "text-red-700 border-red-300",
  DELIVERED: "text-emerald-700 border-emerald-300",
  CLICKED: "text-cyan-700 border-cyan-300",
  ACTION_COMPLETED: "text-green-700 border-green-300",
  NO_RESPONSE: "text-amber-700 border-amber-300",
  OPTOUT: "text-zinc-700 border-zinc-400",
};

const DEFAULT_CALL_SCRIPTS: CallScriptStep[] = [
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
      "최근 일상에서 불편한 점, 연락 가능 시간, 상담/선별검사 참여 가능 여부를 확인하겠습니다.",
    tips: ["개방형 질문 우선", "기록 중심으로 정리", "재접촉 가능 시간 확인"],
    checkpoints: ["현재 상황 확인", "연락 가능 시간대 확인", "추가 지원 필요 여부 확인"],
  },
  {
    step: "scheduling",
    title: "4단계: 다음 실행 정리",
    content:
      "오늘 확인 내용을 기준으로 문자 안내, 상담/선별검사 예약, 재접촉 일정을 정리하겠습니다.",
    tips: ["다음 행동 1개로 요약", "문자 안내 여부 확인", "재접촉 일정 설정"],
    checkpoints: ["다음 행동 합의", "문자 발송 동의 확인", "재접촉 시점 설정"],
  },
];

const DEFAULT_VARS: SmsTemplateVars = {
  centerName: "강남구 치매안심센터",
  centerPhone:
    (
      (import.meta.env.VITE_STAGE1_CENTER_PHONE as string | undefined) ??
      (import.meta.env.VITE_SMS_CENTER_PHONE as string | undefined) ??
      (import.meta.env.VITE_CENTER_PHONE as string | undefined) ??
      "02-555-0199"
    ).trim() || "02-555-0199",
  guideLink: getDefaultSmsLandingLink(),
  bookingLink: "(센터 예약 안내)",
  caseAlias: "대상자",
  dueDate: "일정 확인 필요",
  optOut: "수신거부 080-000-0000",
};

function pushTimelineItem(
  setTimeline: React.Dispatch<React.SetStateAction<StatusTimelineItem[]>>,
  status: SmsLifecycleStatus,
  note?: string,
) {
  setTimeline((prev) => [
    {
      id: `TL-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      at: nowFormatted(),
      status,
      note,
    },
    ...prev,
  ]);
}

function nextTemplateOfType(templates: SmsTemplate[], type: SmsMessageType): SmsTemplate | undefined {
  return templates.find((item) => item.type === type);
}

/* ══════════════════════════════════════════════════
   SmsPanel 메인 컴포넌트
══════════════════════════════════════════════════ */
export function SmsPanel({
  stageLabel,
  stageCode,
  templates,
  defaultVars,
  caseId,
  centerId = "center-001",
  citizenPhone = "010-****-1234",
  guardianPhone,
  onSmsSent,
  onConsultation,
  callScripts,
  onNavigateLink,
  showLinkageTab = false,
  compact = false,
}: SmsPanelProps) {
  const inferredStage = stageCode ?? resolveSmsStageFromLabel(stageLabel);
  const registryTemplates = useMemo(() => toPanelTemplates(inferredStage), [inferredStage]);
  const smsTemplates = useMemo<SmsTemplate[]>(() => {
    if (templates.length > 0) {
      return templates;
    }
    return registryTemplates;
  }, [registryTemplates, templates]);

  const vars = { ...DEFAULT_VARS, ...defaultVars };
  const scripts = callScripts ?? DEFAULT_CALL_SCRIPTS;

  const [mainTab, setMainTab] = useState<MainTab>("CALL");

  /* ═══ 전화상담 state ═══ */
  const [callTarget, setCallTarget] = useState<"citizen" | "guardian">("citizen");
  const [currentScriptIdx, setCurrentScriptIdx] = useState(0);
  const [checkStates, setCheckStates] = useState<Record<string, boolean>>({});
  const [callActive, setCallActive] = useState(false);
  const [callSeconds, setCallSeconds] = useState(0);
  const [callResult, setCallResult] = useState<"SUCCESS" | "NO_ANSWER" | "REJECTED" | "WRONG_NUMBER">("SUCCESS");
  const [callMemo, setCallMemo] = useState("");

  useEffect(() => {
    if (!callActive) return;
    const id = setInterval(() => setCallSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [callActive]);

  const callDuration = `${String(Math.floor(callSeconds / 60)).padStart(2, "0")}:${String(callSeconds % 60).padStart(2, "0")}`;
  const currentScript = scripts[currentScriptIdx] ?? scripts[0];

  const handleSaveCallRecord = () => {
    onConsultation?.(
      `[전화상담] 대상: ${callTarget === "citizen" ? "본인" : "보호자"} / 결과: ${callResult} / 통화시간: ${callDuration}\n${callMemo}`,
      "CONTACT",
      `전화상담 (${stageLabel})`,
    );
    setCallMemo("");
    setCallActive(false);
    setCallSeconds(0);
    setCheckStates({});
    setCurrentScriptIdx(0);
  };

  /* ═══ 문자발송 state ═══ */
  const initialType = smsTemplates[0]?.type ?? "CONTACT";
  const [smsType, setSmsType] = useState<SmsMessageType>(initialType);
  const [templateId, setTemplateId] = useState(smsTemplates[0]?.id ?? "");
  const [recipient, setRecipient] = useState<"본인" | "보호자">("본인");
  const [mode, setMode] = useState<"NOW" | "SCHEDULE">("NOW");
  const [scheduledAt, setScheduledAt] = useState("");
  const [note, setNote] = useState("");
  const [editVars, setEditVars] = useState(vars);
  const [showVarEditor, setShowVarEditor] = useState(false);
  const [autoInjectLink, setAutoInjectLink] = useState(true);
  const [sending, setSending] = useState(false);
  const [lastResult, setLastResult] = useState<SmsSendResult | null>(null);
  const [history, setHistory] = useState<SmsHistoryItem[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [lifecycleStatus, setLifecycleStatus] = useState<SmsLifecycleStatus>("DRAFT");
  const [statusTimeline, setStatusTimeline] = useState<StatusTimelineItem[]>([
    { id: "TL-INIT", at: nowFormatted(), status: "DRAFT", note: "메시지 작성 시작" },
  ]);

  const availableTypes = useMemo(() => {
    const seen = new Set<SmsMessageType>();
    const ordered: SmsMessageType[] = [];
    for (const item of smsTemplates) {
      if (!seen.has(item.type)) {
        seen.add(item.type);
        ordered.push(item.type);
      }
    }
    return ordered;
  }, [smsTemplates]);

  useEffect(() => {
    if (!availableTypes.includes(smsType)) {
      setSmsType(availableTypes[0] ?? "CONTACT");
    }
  }, [availableTypes, smsType]);

  const templatesByType = useMemo(() => smsTemplates.filter((t) => t.type === smsType), [smsTemplates, smsType]);
  const template = useMemo(() => smsTemplates.find((t) => t.id === templateId) ?? templatesByType[0] ?? smsTemplates[0], [smsTemplates, templateId, templatesByType]);

  useEffect(() => {
    if (!templatesByType.some((t) => t.id === templateId)) {
      setTemplateId(templatesByType[0]?.id ?? smsTemplates[0]?.id ?? "");
    }
  }, [templatesByType, templateId, smsTemplates]);

  const preview = useMemo(() => {
    if (!template || typeof template.body !== "function") {
      return "";
    }
    const rendered = template.body(editVars);
    if (!autoInjectLink) {
      return rendered;
    }
    const link = editVars.guideLink?.trim();
    if (!link) {
      return rendered;
    }
    if (rendered.includes(link)) {
      return rendered;
    }
    return `${rendered} ${link}`.trim();
  }, [template, editVars, autoInjectLink]);

  const currentStatusMeta = SMS_STATUS_META[lifecycleStatus];
  const recommendedActions = (SMS_RECOMMENDED_ACTIONS[lifecycleStatus] ?? []).slice(0, 2);

  const onChangeSmsType = (t: SmsMessageType) => {
    setSmsType(t);
    const first = nextTemplateOfType(smsTemplates, t);
    if (first) setTemplateId(first.id);
  };

  const runRecommendedAction = (action: SmsRecommendedAction) => {
    const markStatus = (status: SmsLifecycleStatus, noteText: string) => {
      setLifecycleStatus(status);
      pushTimelineItem(setStatusTimeline, status, noteText);
    };

    if (action.id === "RETRY_WITH_ALT_TEMPLATE") {
      markStatus("DRAFT", "재발송 준비 상태로 전환");
      const fallback = nextTemplateOfType(smsTemplates, "REMINDER") ?? smsTemplates[0];
      if (fallback) {
        setSmsType(fallback.type);
        setTemplateId(fallback.id);
      }
      toast.info("재발송 템플릿을 선택해 다시 발송하세요.");
      return;
    }

    if (action.id === "SWITCH_TO_CALL") {
      markStatus("NO_RESPONSE", "전화 안내 전환 권고");
      setMainTab("CALL");
      onNavigateLink?.("call");
      return;
    }

    if (action.id === "VERIFY_PHONE") {
      setNote((prev) => (prev ? `${prev}\n연락처 재확인 필요` : "연락처 재확인 필요"));
      markStatus("FAILED", "번호 확인 필요 플래그 추가");
      return;
    }

    if (action.id === "CREATE_RECONTACT_TASK") {
      toast.success("재접촉 플랜(업무) 생성 처리됨");
      pushTimelineItem(setStatusTimeline, lifecycleStatus, "재접촉 업무 생성");
      return;
    }

    if (action.id === "SEND_REMINDER") {
      const reminderTemplate = nextTemplateOfType(smsTemplates, "REMINDER");
      if (reminderTemplate) {
        setSmsType("REMINDER");
        setTemplateId(reminderTemplate.id);
      }
      markStatus("CLICKED", "클릭 후 미완료 대상 리마인드 준비");
      return;
    }

    if (action.id === "MARK_NO_RESPONSE") {
      markStatus("NO_RESPONSE", "기한 내 무응답 처리");
      return;
    }

    if (action.id === "MARK_COMPLETED") {
      markStatus("ACTION_COMPLETED", "절차 완료 처리");
      return;
    }

    if (action.id === "MARK_OPTOUT") {
      markStatus("OPTOUT", "수신거부 처리");
    }
  };

  const handleSend = async () => {
    if (!template) {
      setLastResult({ success: false, error: "사용 가능한 템플릿이 없습니다." });
      return;
    }
    if (lifecycleStatus === "OPTOUT") {
      setLastResult({ success: false, error: "수신거부 상태에서는 SMS를 발송할 수 없습니다." });
      return;
    }
    if (mode === "SCHEDULE" && !scheduledAt.trim()) {
      setLastResult({ success: false, error: "예약 시간을 입력해 주세요." });
      return;
    }

    const token = createClientSmsToken(caseId);
    const linkUrl = buildSmsLandingLink(token);
    const varsForSend = {
      ...editVars,
      guideLink: autoInjectLink ? linkUrl : editVars.guideLink,
    };
    const renderedByTemplate = template.body(varsForSend);
    const renderedMessage = autoInjectLink && varsForSend.guideLink && !renderedByTemplate.includes(varsForSend.guideLink)
      ? `${renderedByTemplate} ${varsForSend.guideLink}`.trim()
      : renderedByTemplate;

    setSending(true);
    setLastResult(null);

    const result = await sendSmsApi({
      caseId,
      centerId,
      citizenPhone: recipient === "보호자" && guardianPhone ? guardianPhone : citizenPhone,
      templateId: template.id,
      renderedMessage,
      guardianPhone: recipient === "보호자" ? guardianPhone : undefined,
      stage: inferredStage,
      sendPolicy: mode,
      scheduledAt: mode === "SCHEDULE" ? scheduledAt : undefined,
      channel: "SMS",
      linkToken: token,
      linkUrl,
      statusHint: lifecycleStatus,
      variables: {
        CENTER_NAME: varsForSend.centerName,
        CALLBACK_PHONE: varsForSend.centerPhone,
        CASE_ALIAS: varsForSend.caseAlias || "대상자",
        DUE_DATE: varsForSend.dueDate || "일정 확인 필요",
        OPT_OUT: varsForSend.optOut || "수신거부 080-000-0000",
      },
    });

    setSending(false);
    setLastResult(result);

    const lifecycle = result.lifecycleStatus || resolveSmsLifecycleByResult(result.success, mode);
    const dispatchStatus = toDispatchStatus(lifecycle);
    setLifecycleStatus(lifecycle);
    pushTimelineItem(setStatusTimeline, lifecycle, `${mode === "NOW" ? "즉시" : "예약"} 발송 · ${template.label}`);

    const item: SmsHistoryItem = {
      id: `SMS-${Date.now()}`,
      at: mode === "SCHEDULE" ? scheduledAt.replace("T", " ") : nowFormatted(),
      templateLabel: template.label,
      type: template.type,
      mode,
      recipient,
      status: dispatchStatus,
      preview: renderedMessage,
      note: note.trim(),
      providerMessageId: result.providerMessageId,
      lifecycleStatus: lifecycle,
      token: result.token || token,
      linkUrl: result.linkUrl || linkUrl,
    };

    setHistory((prev) => [item, ...prev]);
    onSmsSent?.(item);

    if (result.success) {
      setNote("");
      setEditVars((prev) => ({ ...prev, guideLink: result.linkUrl || linkUrl }));
    }
  };

  const handleConsultation = () => {
    if (!template) return;
    onConsultation?.(note.trim(), smsType, template.label);
    setNote("");
  };

  /* ══════════════════════════════════════════════════
     렌더
  ══════════════════════════════════════════════════ */
  return (
    <div className="bg-white rounded-xl overflow-hidden">
      {/* ═══ 헤더 ═══ */}
      <div className="bg-gradient-to-r from-slate-800 to-slate-700 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <PhoneCall className="h-4 w-4 text-blue-300" />
              상담·문자 실행
              <Badge className="ml-1 bg-blue-500/20 text-blue-200 border-blue-400/30 text-[10px]">{stageLabel}</Badge>
            </h3>
            <p className="text-[11px] text-slate-300 mt-1">
              전화상담 · 문자발송{showLinkageTab ? " · 연계" : ""}를 한 곳에서 실행합니다
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge className={cn("text-xs px-2.5 py-1 border", currentStatusMeta.tone)}>{currentStatusMeta.label}</Badge>
            {history.length > 0 && (
              <Badge className="bg-white/10 text-white border-white/20 text-xs px-2.5 py-1">{history.length}건 발송</Badge>
            )}
          </div>
        </div>
      </div>

      {/* ═══ 메인 탭 ═══ */}
      <div className="border-b border-slate-200 bg-slate-50">
        <div className="flex">
          {([
            { key: "CALL" as MainTab, icon: PhoneCall, label: "전화상담" },
            { key: "SMS" as MainTab, icon: MessageSquare, label: "문자발송" },
            ...(showLinkageTab ? [{ key: "LINK" as MainTab, icon: Layers, label: "연계" }] : []),
          ]).map(({ key, icon: Icon, label }) => (
            <button
              key={key}
              onClick={() => setMainTab(key)}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-semibold transition-all border-b-2",
                mainTab === key
                  ? "border-blue-600 text-blue-700 bg-white"
                  : "border-transparent text-slate-500 hover:text-slate-700 hover:bg-white/50",
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ═══ 전화상담 탭 ═══ */}
      {mainTab === "CALL" && (
        <div className={cn("space-y-4", compact ? "px-4 py-4" : "px-6 py-5")}>
          <div className="rounded-lg border border-amber-200 bg-amber-50/80 px-4 py-2.5 text-xs text-amber-800 flex items-start gap-2">
            <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            <span>
              <strong>운영 규칙:</strong> 확진/AI 판단 표현 금지. 안내·확인·연계 톤 사용. 목적 고지 필수.
            </span>
          </div>

          {/* 대상자 선택 */}
          <div>
            <label className="text-xs font-semibold text-slate-600 mb-2 block">통화 대상</label>
            <div className="grid grid-cols-2 gap-2">
              {([
                { key: "citizen" as const, label: "대상자 본인", sub: "기본 상담 대상", icon: User },
                { key: "guardian" as const, label: "보호자", sub: guardianPhone ? "보호자 연락 가능" : "등록된 번호 없음", icon: Users },
              ]).map(({ key, label, sub, icon: Icon }) => (
                <button
                  key={key}
                  onClick={() => {
                    setCallTarget(key);
                    setCurrentScriptIdx(0);
                    setCheckStates({});
                  }}
                  disabled={key === "guardian" && !guardianPhone}
                  className={cn(
                    "flex items-center gap-3 rounded-xl border-2 px-4 py-3 text-left transition-all",
                    callTarget === key
                      ? "border-blue-500 bg-blue-50 ring-1 ring-blue-200"
                      : "border-slate-200 bg-white hover:border-slate-300",
                    key === "guardian" && !guardianPhone && "opacity-40 cursor-not-allowed",
                  )}
                >
                  <div
                    className={cn(
                      "h-8 w-8 rounded-full flex items-center justify-center",
                      callTarget === key ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-500",
                    )}
                  >
                    <Icon className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{label}</p>
                    <p className="text-[11px] text-slate-500">{sub}</p>
                  </div>
                  {callTarget === key && <Check className="h-4 w-4 text-blue-600 ml-auto" />}
                </button>
              ))}
            </div>
          </div>

          {/* 스크립트 단계 탭 */}
          <div>
            <label className="text-xs font-semibold text-slate-600 mb-2 block">상담 스크립트</label>
            <div className="grid grid-cols-4 gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1">
              {scripts.map((s, idx) => (
                <button
                  key={s.step}
                  onClick={() => setCurrentScriptIdx(idx)}
                  className={cn(
                    "rounded-lg px-2 py-2 text-xs font-semibold transition-all",
                    currentScriptIdx === idx
                      ? "bg-white text-slate-900 shadow-sm ring-1 ring-slate-200"
                      : "text-slate-500 hover:text-slate-700 hover:bg-white/50",
                  )}
                >
                  {idx + 1}단계
                </button>
              ))}
            </div>
            <div className="mt-3 rounded-xl border border-blue-200 bg-gradient-to-br from-blue-50 to-indigo-50/50 p-4">
              <p className="text-sm font-bold text-blue-900 mb-2">{currentScript.title}</p>
              <p className="text-xs leading-relaxed text-blue-800/90">{currentScript.content}</p>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <div className="rounded-lg border border-slate-100 bg-slate-50/80 p-3">
                <p className="text-[11px] font-bold text-slate-700 mb-2">상담 팁</p>
                <ul className="space-y-1">
                  {currentScript.tips.map((tip) => (
                    <li key={tip} className="text-[11px] text-slate-600 flex items-start gap-1.5">
                      <span className="text-blue-400 mt-0.5">•</span> {tip}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="rounded-lg border border-slate-100 bg-slate-50/80 p-3">
                <p className="text-[11px] font-bold text-slate-700 mb-2">체크포인트</p>
                <div className="space-y-1.5">
                  {currentScript.checkpoints.map((cp) => (
                    <label key={cp} className="flex items-center gap-2 text-[11px] text-slate-600 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={Boolean(checkStates[cp])}
                        onChange={(e) => setCheckStates((prev) => ({ ...prev, [cp]: e.target.checked }))}
                        className="h-3.5 w-3.5 rounded border-slate-300 text-blue-600"
                      />
                      <span className={checkStates[cp] ? "line-through text-slate-400" : ""}>{cp}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* 통화 결과 */}
          <div>
            <label className="text-xs font-semibold text-slate-600 mb-2 block">통화 결과</label>
            <div className="grid grid-cols-4 gap-2">
              {([
                { value: "SUCCESS" as const, label: "성공", icon: CheckCircle2, ac: "border-emerald-500 bg-emerald-50 text-emerald-700" },
                { value: "NO_ANSWER" as const, label: "부재", icon: Clock3, ac: "border-amber-500 bg-amber-50 text-amber-700" },
                { value: "REJECTED" as const, label: "거절", icon: XCircle, ac: "border-red-500 bg-red-50 text-red-700" },
                { value: "WRONG_NUMBER" as const, label: "번호오류", icon: X, ac: "border-slate-500 bg-slate-50 text-slate-700" },
              ]).map(({ value, label, icon: Icon, ac }) => (
                <button
                  key={value}
                  onClick={() => setCallResult(value)}
                  className={cn(
                    "flex flex-col items-center gap-1.5 rounded-xl border-2 px-3 py-3 text-xs font-semibold transition-all",
                    callResult === value ? ac : "border-slate-200 bg-white text-slate-500 hover:border-slate-300",
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* 메모 */}
          <div>
            <label className="text-xs font-semibold text-slate-600 mb-1.5 block">통화 메모</label>
            <Textarea
              value={callMemo}
              onChange={(e) => setCallMemo(e.target.value)}
              className="min-h-[80px] text-xs rounded-lg border-slate-200"
              placeholder="통화 중 확인한 사항을 기록하세요"
            />
          </div>

          {/* 타이머 + 버튼 */}
          <div className="flex items-center justify-between pt-1">
            <div
              className={cn(
                "inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-bold",
                callActive ? "bg-red-50 text-red-700 border border-red-200" : "bg-slate-100 text-slate-600",
              )}
            >
              <Timer className="h-4 w-4" />
              {callActive ? `통화 중 ${callDuration}` : "대기"}
            </div>
            <div className="flex gap-2">
              {!callActive ? (
                <Button
                  onClick={() => {
                    setCallActive(true);
                    setCallSeconds(0);
                  }}
                  className="h-10 bg-blue-600 text-sm font-semibold text-white hover:bg-blue-700 gap-2 px-5 rounded-xl"
                >
                  <Phone className="h-4 w-4" />전화하기
                </Button>
              ) : (
                <Button
                  onClick={() => setCallActive(false)}
                  variant="outline"
                  className="h-10 border-red-300 text-red-700 hover:bg-red-50 text-sm font-semibold gap-2 rounded-xl"
                >
                  <CheckCircle2 className="h-4 w-4" />통화 종료
                </Button>
              )}
              <Button
                onClick={handleSaveCallRecord}
                className="h-10 bg-slate-800 text-sm font-semibold text-white hover:bg-slate-900 gap-2 px-5 rounded-xl"
              >
                <Check className="h-4 w-4" />상담 기록 저장
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ 문자발송 탭 ═══ */}
      {mainTab === "SMS" && (
        <div className={cn("space-y-4", compact ? "px-4 py-4" : "px-6 py-5")}>
          <div className="rounded-lg border border-amber-200 bg-amber-50/80 px-4 py-2.5 text-xs text-amber-800 flex items-start gap-2">
            <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            <span>
              <strong>운영 규칙:</strong> 문자에 확진/AI 판단 표현 금지. 민감정보 최소화. 상세는 링크 내부에서 안내.
            </span>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Badge className="bg-slate-800 text-white border-slate-700 text-[10px]">{inferredStage}</Badge>
                <Badge className={cn("text-[10px] border", currentStatusMeta.tone)}>{currentStatusMeta.label}</Badge>
              </div>
              <span className="text-[11px] text-slate-500">권장 다음 조치 1~2개</span>
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {recommendedActions.map((action) => (
                <Button
                  key={action.id}
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => runRecommendedAction(action)}
                  className="h-8 rounded-lg text-xs"
                >
                  {action.label}
                </Button>
              ))}
            </div>
          </div>

          {/* 유형 탭 */}
          <div className="grid grid-cols-3 gap-1.5 rounded-xl border border-slate-200 bg-slate-50 p-1.5">
            {(["CONTACT", "BOOKING", "REMINDER"] as const).map((t) => {
              const disabled = !availableTypes.includes(t);
              return (
                <button
                  key={t}
                  onClick={() => onChangeSmsType(t)}
                  disabled={disabled}
                  className={cn(
                    "rounded-lg px-3 py-2.5 text-xs font-semibold transition-all",
                    smsType === t
                      ? "bg-white text-slate-900 shadow-sm ring-1 ring-slate-200"
                      : "text-slate-500 hover:text-slate-700 hover:bg-white/50",
                    disabled && "opacity-40 cursor-not-allowed",
                  )}
                >
                  {TYPE_LABELS[t]}
                </button>
              );
            })}
          </div>

          {/* 템플릿 + 링크 자동주입 */}
          <div className="space-y-2">
            <select
              value={templateId}
              onChange={(e) => setTemplateId(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
            >
              {templatesByType.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
            <label className="inline-flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={autoInjectLink}
                onChange={(event) => setAutoInjectLink(event.target.checked)}
                className="h-3.5 w-3.5 rounded border-slate-300"
              />
              링크 자동 주입 사용
            </label>
          </div>

          {/* 수신자 + 발송 모드 */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-slate-600 mb-2 block">수신자</label>
              <div className="flex gap-2">
                {(["본인", "보호자"] as const).map((key) => (
                  <button
                    key={key}
                    onClick={() => setRecipient(key)}
                    disabled={key === "보호자" && !guardianPhone}
                    className={cn(
                      "flex-1 flex items-center justify-center gap-2 rounded-xl border-2 px-3 py-2.5 text-xs font-semibold transition-all",
                      recipient === key
                        ? "border-blue-500 bg-blue-50 text-blue-800 ring-1 ring-blue-200"
                        : "border-slate-200 bg-white text-slate-500 hover:border-slate-300",
                      key === "보호자" && !guardianPhone && "opacity-40 cursor-not-allowed",
                    )}
                  >
                    {key === "본인" ? <User className="h-3.5 w-3.5" /> : <Users className="h-3.5 w-3.5" />}
                    {key}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 mb-2 block">발송 모드</label>
              <div className="grid grid-cols-2 gap-1.5 rounded-xl border border-slate-200 bg-slate-50 p-1.5">
                {([
                  { key: "NOW" as const, icon: Send, label: "즉시" },
                  { key: "SCHEDULE" as const, icon: CalendarClock, label: "예약" },
                ]).map(({ key, icon: Icon, label }) => (
                  <button
                    key={key}
                    onClick={() => setMode(key)}
                    className={cn(
                      "flex items-center justify-center gap-1.5 rounded-lg px-3 py-2.5 text-xs font-semibold transition-all",
                      mode === key ? "bg-white text-slate-900 shadow-sm ring-1 ring-slate-200" : "text-slate-500",
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" /> {label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* 수신자 정보 */}
          <div className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50/50 px-4 py-2.5">
            <span className="text-xs text-slate-500">수신:</span>
            <span className="text-xs font-medium text-slate-700">
              {recipient === "보호자" && guardianPhone ? `보호자 ${guardianPhone}` : `본인 ${citizenPhone}`}
            </span>
            <span className="text-[10px] text-slate-400 ml-auto">(데모: TEST_SMS_TO 번호로 발송)</span>
          </div>

          {mode === "SCHEDULE" && (
            <input
              type="datetime-local"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
            />
          )}

          {/* 변수 편집 */}
          <button
            onClick={() => setShowVarEditor(!showVarEditor)}
            className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 font-medium"
          >
            {showVarEditor ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            변수 편집 {showVarEditor ? "접기" : "열기"}
          </button>
          {showVarEditor && (
            <div className="grid grid-cols-2 gap-3 rounded-xl border border-slate-200 bg-slate-50/50 p-4">
              {([
                ["centerName", "센터명"],
                ["centerPhone", "센터 전화"],
                ["guideLink", "안내 링크"],
                ["bookingLink", "예약 링크"],
                ["caseAlias", "대상자 표기"],
                ["optOut", "수신거부 문구"],
              ] as const).map(([key, label]) => (
                <div key={key}>
                  <label className="text-[11px] font-semibold text-slate-500">{label}</label>
                  <input
                    type="text"
                    value={editVars[key] ?? ""}
                    onChange={(e) => setEditVars((v) => ({ ...v, [key]: e.target.value }))}
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs outline-none focus:border-blue-400"
                  />
                </div>
              ))}
            </div>
          )}

          {/* 미리보기 + 메모 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold text-slate-600">미리보기</span>
                <Badge variant="outline" className={cn("text-[10px]", TYPE_COLORS[smsType])}>
                  {TYPE_LABELS[smsType]}
                </Badge>
              </div>
              <p className="whitespace-pre-wrap text-xs leading-relaxed text-slate-700 min-h-[80px]">{preview}</p>
              <div className="mt-2 flex items-center justify-between text-[10px] text-slate-400 border-t border-slate-200 pt-2">
                <span>
                  {preview.length}자 · {preview.length > 90 ? "LMS" : "SMS"}
                </span>
                <span>수신: {recipient}</span>
              </div>
            </div>
            <div className="flex flex-col">
              <label className="text-[11px] font-bold text-slate-600 mb-1.5">상담/문자 메모</label>
              <Textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="flex-1 min-h-[120px] text-xs rounded-lg border-slate-200"
                placeholder="상담 내용이나 특이사항을 기록하세요 (선택)"
              />
            </div>
          </div>

          {/* 발송 결과 */}
          {lastResult && (
            <div
              className={cn(
                "rounded-xl border px-4 py-3 text-xs flex items-center gap-2",
                lastResult.success
                  ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                  : "border-red-200 bg-red-50 text-red-800",
              )}
            >
              {lastResult.success ? (
                <>
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                  <span>
                    발송 성공 {lastResult.actualTo && `(수신: ${lastResult.actualTo})`}
                    {lastResult.endpoint && ` · ${lastResult.endpoint}`}
                  </span>
                </>
              ) : (
                <>
                  <XCircle className="h-4 w-4 shrink-0" />
                  <span>{lastResult.error ?? "발송 실패"}</span>
                </>
              )}
            </div>
          )}

          {/* 실행 버튼 */}
          <div className="grid grid-cols-2 gap-3 pt-1">
            <Button
              variant="outline"
              className="h-11 text-sm font-semibold gap-2 rounded-xl border-slate-300"
              onClick={handleConsultation}
            >
              <Phone className="h-4 w-4" />상담 기록
            </Button>
            <Button
              className="h-11 bg-blue-600 text-sm font-semibold text-white hover:bg-blue-700 gap-2 rounded-xl"
              onClick={handleSend}
              disabled={sending || lifecycleStatus === "OPTOUT" || !template}
            >
              <MessageSquare className="h-4 w-4" />
              {sending ? "발송 중..." : mode === "NOW" ? "문자 발송" : "문자 예약"}
            </Button>
          </div>

          {lifecycleStatus === "OPTOUT" && (
            <div className="rounded-lg border border-zinc-300 bg-zinc-100 px-3 py-2 text-xs text-zinc-700">
              수신거부 상태입니다. 문자 발송은 비활성화되며, 전화 등 대체 채널만 사용 가능합니다.
            </div>
          )}

          {/* 상태 타임라인 */}
          <div className="rounded-xl border border-slate-200 bg-white p-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-slate-700">상태 타임라인</p>
              {(lifecycleStatus === "FAILED" || lifecycleStatus === "NO_RESPONSE" || lifecycleStatus === "CLICKED") && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-[11px]"
                  onClick={() => runRecommendedAction({ id: "CREATE_RECONTACT_TASK", label: "재접촉 플랜 생성" })}
                >
                  재접촉 플랜 생성
                </Button>
              )}
            </div>
            <div className="mt-2 space-y-1.5 max-h-[180px] overflow-y-auto">
              {statusTimeline.map((item) => {
                const meta = SMS_STATUS_META[item.status];
                return (
                  <div key={item.id} className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
                    <div className="flex items-center justify-between">
                      <span className={cn("inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold", meta.tone)}>
                        {meta.label}
                      </span>
                      <span className="text-[10px] text-slate-500">{item.at}</span>
                    </div>
                    {item.note && <p className="mt-1 text-[11px] text-slate-600">{item.note}</p>}
                  </div>
                );
              })}
            </div>
          </div>

          {/* 발송 이력 */}
          {history.length > 0 && (
            <div className="border-t border-slate-100 pt-4">
              <button
                onClick={() => setShowHistory(!showHistory)}
                className="flex items-center gap-1.5 text-xs font-semibold text-slate-600"
              >
                {showHistory ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                발송 이력 ({history.length}건)
              </button>
              {showHistory && (
                <div className="mt-3 space-y-2 max-h-[240px] overflow-y-auto">
                  {history.map((item) => (
                    <div key={item.id} className="rounded-xl border border-slate-200 p-3 text-xs bg-white">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-slate-800">{item.templateLabel}</span>
                        <Badge variant="outline" className={cn("text-[10px]", HISTORY_STATUS_TONE[item.status])}>
                          {HISTORY_STATUS_LABEL[item.status]}
                        </Badge>
                      </div>
                      <p className="mt-1 text-[11px] text-slate-500">
                        {item.at} · {item.recipient} · {TYPE_LABELS[item.type]}
                      </p>
                      {item.note && <p className="mt-1 text-[11px] text-slate-600 italic">메모: {item.note}</p>}
                      {item.linkUrl && <p className="mt-1 text-[10px] text-slate-500">링크: {item.linkUrl}</p>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ═══ 연계 탭 ═══ */}
      {mainTab === "LINK" && showLinkageTab && (
        <div className={cn("space-y-4", compact ? "px-4 py-4" : "px-6 py-5")}>
          <p className="text-xs text-slate-500">프로그램 연계, 의뢰서 발송, 기관 연결 등 후속 조치를 실행합니다.</p>
          <div className="space-y-2">
            {([
              {
                entry: "program" as const,
                icon: Layers,
                bg: "bg-blue-100 text-blue-700",
                label: "프로그램 연계",
                sub: "대주제→중주제→소분류 프로그램 선택 및 실행",
              },
              {
                entry: "call" as const,
                icon: Phone,
                bg: "bg-emerald-100 text-emerald-700",
                label: "전화 상담 페이지",
                sub: "v1 상담 서비스 화면으로 이동",
              },
              {
                entry: "sms" as const,
                icon: MessageSquare,
                bg: "bg-amber-100 text-amber-700",
                label: "문자/연계 페이지",
                sub: "v1 문자 발송/연계 화면으로 이동",
              },
            ]).map(({ entry, icon: Icon, bg, label, sub }) => (
              <button
                key={entry}
                onClick={() => onNavigateLink?.(entry)}
                className="w-full flex items-center justify-between rounded-xl border-2 border-slate-200 bg-white px-4 py-3.5 text-left hover:border-blue-300 hover:bg-blue-50/30 transition-all"
              >
                <div className="flex items-center gap-3">
                  <div className={cn("h-9 w-9 rounded-lg flex items-center justify-center", bg)}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{label}</p>
                    <p className="text-[11px] text-slate-500">{sub}</p>
                  </div>
                </div>
                <ArrowRightCircle className="h-5 w-5 text-slate-400" />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
