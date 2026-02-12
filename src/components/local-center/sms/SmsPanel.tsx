/**
 * 통합 SMS 패널 컴포넌트
 * Stage 1/2/3 상세 화면에서 공통 사용
 *
 * 기능:
 * - 접촉/예약안내/리마인더 3종 템플릿 탭
 * - 수신자 선택 (본인/보호자)
 * - 변수 편집 (센터명, 전화, 안내링크, 예약링크)
 * - 즉시/예약 모드
 * - 미리보기 + 글자수
 * - 실제 SMS API 발송 (데모: TEST_SMS_TO)
 * - 발송 이력 타임라인
 */
import React, { useEffect, useMemo, useState } from "react";
import {
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  MessageSquare,
  Phone,
  Send,
  User,
  Users,
  XCircle,
} from "lucide-react";
import { Badge } from "../../ui/badge";
import { Button } from "../../ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../ui/card";
import { Textarea } from "../../ui/textarea";
import { cn } from "../../ui/utils";
import {
  type SmsHistoryItem,
  type SmsSendResult,
  nowFormatted,
  sendSmsApi,
} from "./smsService";

/* ─── 타입 ─── */
export type SmsMessageType = "CONTACT" | "BOOKING" | "REMINDER";

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
}

export interface SmsPanelProps {
  /** 단계 표시 (1차/2차/3차) */
  stageLabel: string;
  /** 사용할 템플릿 목록 */
  templates: SmsTemplate[];
  /** 기본 변수값 */
  defaultVars?: Partial<SmsTemplateVars>;
  /** 케이스 ID */
  caseId: string;
  /** 센터 ID */
  centerId?: string;
  /** 대상자 전화번호 (마스킹된) */
  citizenPhone?: string;
  /** 보호자 전화번호 (마스킹된) */
  guardianPhone?: string;
  /** 발송 완료 콜백 */
  onSmsSent?: (history: SmsHistoryItem) => void;
  /** 상담 기록 콜백 */
  onConsultation?: (note: string, type: SmsMessageType, templateLabel: string) => void;
  /** 컴팩트 모드 (aside에서 사용 시) */
  compact?: boolean;
}

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

const DEFAULT_VARS: SmsTemplateVars = {
  centerName: "강남구 치매안심센터",
  centerPhone: "02-555-0199",
  guideLink: "https://neuro-shield.kr/guide",
  bookingLink: "https://neuro-shield.kr/booking",
};

export function SmsPanel({
  stageLabel,
  templates,
  defaultVars,
  caseId,
  centerId = "center-001",
  citizenPhone = "010-****-1234",
  guardianPhone,
  onSmsSent,
  onConsultation,
  compact = false,
}: SmsPanelProps) {
  const vars = { ...DEFAULT_VARS, ...defaultVars };

  /* ── state ── */
  const [type, setType] = useState<SmsMessageType>("CONTACT");
  const [templateId, setTemplateId] = useState(templates[0]?.id ?? "");
  const [recipient, setRecipient] = useState<"본인" | "보호자">("본인");
  const [mode, setMode] = useState<"NOW" | "SCHEDULE">("NOW");
  const [scheduledAt, setScheduledAt] = useState("");
  const [note, setNote] = useState("");
  const [editVars, setEditVars] = useState(vars);
  const [showVarEditor, setShowVarEditor] = useState(false);
  const [sending, setSending] = useState(false);
  const [lastResult, setLastResult] = useState<SmsSendResult | null>(null);
  const [history, setHistory] = useState<SmsHistoryItem[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  const templatesByType = useMemo(
    () => templates.filter((t) => t.type === type),
    [templates, type],
  );

  const template = useMemo(
    () => templates.find((t) => t.id === templateId) ?? templates[0],
    [templates, templateId],
  );

  useEffect(() => {
    if (!templatesByType.some((t) => t.id === templateId)) {
      setTemplateId(templatesByType[0]?.id ?? templates[0]?.id ?? "");
    }
  }, [templatesByType, templateId, templates]);

  const preview = useMemo(
    () => template?.body(editVars) ?? "",
    [template, editVars],
  );

  const onChangeType = (t: SmsMessageType) => {
    setType(t);
    const first = templates.find((tpl) => tpl.type === t);
    if (first) setTemplateId(first.id);
  };

  /* ── 실제 SMS 발송 ── */
  const handleSend = async () => {
    if (mode === "SCHEDULE" && !scheduledAt.trim()) {
      setLastResult({ success: false, error: "예약 시간을 입력해 주세요." });
      return;
    }

    setSending(true);
    setLastResult(null);

    const result = await sendSmsApi({
      caseId,
      centerId,
      citizenPhone: recipient === "보호자" && guardianPhone ? guardianPhone : citizenPhone,
      templateId: template.id,
      renderedMessage: preview,
      guardianPhone: recipient === "보호자" ? guardianPhone : undefined,
    });

    setSending(false);
    setLastResult(result);

    const item: SmsHistoryItem = {
      id: `SMS-${Date.now()}`,
      at: mode === "SCHEDULE" ? scheduledAt.replace("T", " ") : nowFormatted(),
      templateLabel: template.label,
      type: template.type,
      mode,
      recipient,
      status: result.success
        ? mode === "SCHEDULE" ? "SCHEDULED" : "SENT"
        : "FAILED",
      preview,
      note: note.trim(),
      providerMessageId: result.providerMessageId,
    };

    setHistory((prev) => [item, ...prev]);
    onSmsSent?.(item);

    if (result.success) {
      setNote("");
    }
  };

  /* ── 상담 기록 ── */
  const handleConsultation = () => {
    onConsultation?.(note.trim(), type, template.label);
    setNote("");
  };

  return (
    <Card className="border-slate-200 bg-white shadow-sm">
      <CardHeader className="border-b border-slate-100 px-4 py-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-sm font-bold text-slate-900">
              상담/문자 실행 ({stageLabel})
            </CardTitle>
            <p className="text-[11px] text-slate-500 mt-0.5">
              접촉 · 예약안내 · 리마인더 | 데모: 환경변수 지정 번호로 발송
            </p>
          </div>
          {history.length > 0 && (
            <Badge variant="outline" className="text-[10px]">
              {history.length}건
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-3 px-4 py-4">
        {/* 가이드 배너 */}
        <div className="rounded-md border border-amber-200 bg-amber-50/80 px-2.5 py-2 text-[11px] text-amber-800">
          <strong>운영 규칙:</strong> 문자에 확진/AI 판단 표현 금지. 안내·확인·연계 톤 사용.
        </div>

        {/* ── 유형 탭 ── */}
        <div className="grid grid-cols-3 gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1">
          {(["CONTACT", "BOOKING", "REMINDER"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => onChangeType(t)}
              className={cn(
                "rounded-md px-2 py-1.5 text-[11px] font-semibold transition-all",
                type === t
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-500 hover:text-slate-700",
              )}
            >
              {TYPE_LABELS[t]}
            </button>
          ))}
        </div>

        {/* ── 템플릿 선택 ── */}
        <select
          value={templateId}
          onChange={(e) => setTemplateId(e.target.value)}
          className="w-full rounded-md border border-slate-200 bg-white px-2.5 py-2 text-xs outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100"
        >
          {templatesByType.map((t) => (
            <option key={t.id} value={t.id}>{t.label}</option>
          ))}
        </select>

        {/* ── 수신자 선택 ── */}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setRecipient("본인")}
            className={cn(
              "flex-1 flex items-center justify-center gap-1.5 rounded-md border px-2 py-1.5 text-[11px] font-medium transition-all",
              recipient === "본인"
                ? "border-blue-300 bg-blue-50 text-blue-800"
                : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50",
            )}
          >
            <User className="h-3 w-3" />
            본인 {citizenPhone && <span className="text-[10px] opacity-70">{citizenPhone}</span>}
          </button>
          <button
            type="button"
            onClick={() => setRecipient("보호자")}
            disabled={!guardianPhone}
            className={cn(
              "flex-1 flex items-center justify-center gap-1.5 rounded-md border px-2 py-1.5 text-[11px] font-medium transition-all",
              recipient === "보호자"
                ? "border-blue-300 bg-blue-50 text-blue-800"
                : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50",
              !guardianPhone && "opacity-40 cursor-not-allowed",
            )}
          >
            <Users className="h-3 w-3" />
            보호자 {guardianPhone ? <span className="text-[10px] opacity-70">{guardianPhone}</span> : <span className="text-[10px]">(미등록)</span>}
          </button>
        </div>

        {/* ── 발송 모드 ── */}
        <div className="grid grid-cols-2 gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1">
          <button
            type="button"
            onClick={() => setMode("NOW")}
            className={cn(
              "flex items-center justify-center gap-1 rounded-md px-2 py-1.5 text-[11px] font-semibold transition-all",
              mode === "NOW"
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-500",
            )}
          >
            <Send className="h-3 w-3" /> 즉시 발송
          </button>
          <button
            type="button"
            onClick={() => setMode("SCHEDULE")}
            className={cn(
              "flex items-center justify-center gap-1 rounded-md px-2 py-1.5 text-[11px] font-semibold transition-all",
              mode === "SCHEDULE"
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-500",
            )}
          >
            <CalendarClock className="h-3 w-3" /> 예약 발송
          </button>
        </div>

        {mode === "SCHEDULE" && (
          <input
            type="datetime-local"
            value={scheduledAt}
            onChange={(e) => setScheduledAt(e.target.value)}
            className="w-full rounded-md border border-slate-200 bg-white px-2.5 py-2 text-xs outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100"
          />
        )}

        {/* ── 변수 편집 토글 ── */}
        <button
          type="button"
          onClick={() => setShowVarEditor(!showVarEditor)}
          className="flex items-center gap-1 text-[11px] text-blue-600 hover:text-blue-800"
        >
          {showVarEditor ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          변수 편집 {showVarEditor ? "접기" : "열기"}
        </button>

        {showVarEditor && (
          <div className="space-y-2 rounded-md border border-slate-200 bg-slate-50/50 p-2.5">
            {([
              ["centerName", "센터명"],
              ["centerPhone", "센터 전화"],
              ["guideLink", "안내 링크"],
              ["bookingLink", "예약 링크"],
            ] as const).map(([key, label]) => (
              <div key={key}>
                <label className="text-[10px] font-medium text-slate-500">{label}</label>
                <input
                  type="text"
                  value={editVars[key]}
                  onChange={(e) => setEditVars((v) => ({ ...v, [key]: e.target.value }))}
                  className="mt-0.5 w-full rounded border border-slate-200 bg-white px-2 py-1 text-[11px] outline-none focus:border-blue-400"
                />
              </div>
            ))}
          </div>
        )}

        {/* ── 미리보기 ── */}
        <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-medium text-slate-500">미리보기</span>
            <Badge variant="outline" className={cn("text-[9px]", TYPE_COLORS[type])}>
              {TYPE_LABELS[type]}
            </Badge>
          </div>
          <p className="mt-1.5 whitespace-pre-wrap text-[11px] leading-relaxed text-slate-700">
            {preview}
          </p>
          <p className="mt-1.5 text-[10px] text-slate-400">
            {preview.length}자 · {preview.length > 90 ? "LMS" : "SMS"} · 수신: {recipient}
          </p>
        </div>

        {/* ── 메모 ── */}
        <Textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="min-h-[60px] text-xs"
          placeholder="상담/문자 메모 (선택)"
        />

        {/* ── 발송 결과 피드백 ── */}
        {lastResult && (
          <div className={cn(
            "rounded-md border px-3 py-2 text-[11px]",
            lastResult.success
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-red-200 bg-red-50 text-red-800",
          )}>
            {lastResult.success ? (
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5" />
                <span>
                  발송 성공 {lastResult.actualTo && `(수신: ${lastResult.actualTo})`}
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5">
                <XCircle className="h-3.5 w-3.5" />
                <span>{lastResult.error ?? "발송 실패"}</span>
              </div>
            )}
          </div>
        )}

        {/* ── 실행 버튼 ── */}
        <div className="grid grid-cols-2 gap-2">
          <Button
            variant="outline"
            className="h-9 text-xs font-semibold"
            onClick={handleConsultation}
          >
            <Phone className="h-3.5 w-3.5" />
            상담 기록
          </Button>
          <Button
            className="h-9 bg-[#15386a] text-xs font-semibold text-white hover:bg-[#102b4e]"
            onClick={handleSend}
            disabled={sending}
          >
            <MessageSquare className="h-3.5 w-3.5" />
            {sending
              ? "발송 중..."
              : mode === "NOW" ? "문자 발송" : "문자 예약"}
          </Button>
        </div>

        {/* ── 발송 이력 ── */}
        {history.length > 0 && (
          <div className="border-t border-slate-100 pt-3">
            <button
              type="button"
              onClick={() => setShowHistory(!showHistory)}
              className="flex items-center gap-1 text-[11px] font-medium text-slate-600"
            >
              {showHistory ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              발송 이력 ({history.length}건)
            </button>

            {showHistory && (
              <div className="mt-2 space-y-2 max-h-[240px] overflow-y-auto">
                {history.map((item) => (
                  <div
                    key={item.id}
                    className={cn(
                      "rounded-md border p-2 text-[11px]",
                      item.status === "SENT" ? "border-emerald-200 bg-emerald-50/50" :
                      item.status === "SCHEDULED" ? "border-blue-200 bg-blue-50/50" :
                      "border-red-200 bg-red-50/50",
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-slate-800">
                        {item.templateLabel}
                      </span>
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-[9px]",
                          item.status === "SENT" ? "text-emerald-700 border-emerald-300" :
                          item.status === "SCHEDULED" ? "text-blue-700 border-blue-300" :
                          "text-red-700 border-red-300",
                        )}
                      >
                        {item.status === "SENT" ? "발송완료" : item.status === "SCHEDULED" ? "예약됨" : "실패"}
                      </Badge>
                    </div>
                    <p className="mt-1 text-[10px] text-slate-500">
                      {item.at} · {item.recipient} · {TYPE_LABELS[item.type]}
                    </p>
                    {item.note && (
                      <p className="mt-1 text-[10px] text-slate-600 italic">메모: {item.note}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
