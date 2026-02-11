import React, { useMemo } from "react";
import {
  ChevronLeft,
  Phone,
  MessageSquare,
  CalendarClock,
  ShieldCheck,
  AlertTriangle,
  Clock3,
  ArrowRight,
  UserRound,
} from "lucide-react";
import { cn, type StageType } from "./shared";
import {
  generateCases,
  SECOND_EXAM_LABELS,
  SECOND_EXAM_COLORS,
  CONTACT_STATUS_LABELS,
  CONSULT_STATUS_LABELS,
  type Case,
  type RiskLevel,
} from "../caseData";

interface CaseDetailViewProps {
  caseId: string;
  stage: StageType;
  onBack: () => void;
  onStartConsultation: (caseId: string) => void;
  onOpenStageWorkflow: () => void;
}

const STAGE_META: Record<StageType, { label: string; tone: string; description: string }> = {
  "Stage 1": {
    label: "초기 선별/접촉",
    tone: "bg-emerald-50 text-emerald-700 border-emerald-200",
    description: "초기 안내, 접촉 성공 여부, 상담 개시 여부를 관리합니다.",
  },
  "Stage 2": {
    label: "정밀평가/연계",
    tone: "bg-blue-50 text-blue-700 border-blue-200",
    description: "검사/연계 예약과 SMS 알림을 운영 정책에 맞게 처리합니다.",
  },
  "Stage 3": {
    label: "추적관리/재평가",
    tone: "bg-violet-50 text-violet-700 border-violet-200",
    description: "재연락, 이탈 방지, 재평가 일정을 지속적으로 추적합니다.",
  },
};

const RISK_TONE: Record<RiskLevel, string> = {
  high: "bg-red-50 text-red-700 border-red-200",
  medium: "bg-amber-50 text-amber-700 border-amber-200",
  low: "bg-emerald-50 text-emerald-700 border-emerald-200",
};

const RISK_LABEL: Record<RiskLevel, string> = {
  high: "고위험",
  medium: "중위험",
  low: "저위험",
};

const CONTACT_PRIORITY_TONE: Record<"즉시" | "높음" | "보통" | "낮음", string> = {
  즉시: "bg-red-50 text-red-700 border-red-200",
  높음: "bg-orange-50 text-orange-700 border-orange-200",
  보통: "bg-blue-50 text-blue-700 border-blue-200",
  낮음: "bg-emerald-50 text-emerald-700 border-emerald-200",
};

function getContactPriority(detail: Case): "즉시" | "높음" | "보통" | "낮음" {
  if (detail.contactStatus === "UNREACHED") return "즉시";
  if (detail.consultStatus === "NOT_STARTED") return "높음";
  if (detail.consultStatus === "IN_PROGRESS") return "보통";
  return "낮음";
}

function getCase(caseId: string): Case | undefined {
  return generateCases().find((c) => c.id === caseId);
}

export function CaseDetailView({
  caseId,
  stage,
  onBack,
  onStartConsultation,
  onOpenStageWorkflow,
}: CaseDetailViewProps) {
  const detail = useMemo(() => getCase(caseId), [caseId]);
  const stageMeta = STAGE_META[stage];
  const contactPriority = detail ? getContactPriority(detail) : "보통";

  if (!detail) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-8 text-center">
        <p className="text-sm text-gray-500">해당 케이스를 찾을 수 없습니다: {caseId}</p>
      </div>
    );
  }

  const primaryAction =
    stage === "Stage 1"
      ? {
          label: "상담 진행 시작",
          onClick: () => onStartConsultation(caseId),
          className: "bg-blue-600 hover:bg-blue-700",
        }
      : {
          label: stage === "Stage 2" ? "Stage 2 운영 상세 열기" : "Stage 3 운영 상세 열기",
          onClick: onOpenStageWorkflow,
          className: "bg-blue-600 hover:bg-blue-700",
        };

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50"
              title="목록으로"
            >
              <ChevronLeft size={18} />
            </button>
            <div>
              <h2 className="text-lg font-bold text-slate-900">{caseId}</h2>
              <p className="text-xs text-gray-500 mt-0.5">마지막 업데이트: {detail.autoMemo.lastUpdatedAt}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className={cn("rounded-full border px-3.5 py-1.5 text-sm font-semibold", stageMeta.tone)}>
              {stage} · {stageMeta.label}
            </span>
            {stage === "Stage 1" ? (
              <span className={cn("rounded-full border px-3.5 py-1.5 text-sm font-semibold", CONTACT_PRIORITY_TONE[contactPriority])}>
                접촉 우선도 {contactPriority}
              </span>
            ) : (
              <span className={cn("rounded-full border px-3.5 py-1.5 text-sm font-semibold", RISK_TONE[detail.riskLevel])}>
                {RISK_LABEL[detail.riskLevel]} ({detail.riskScore}점)
              </span>
            )}
          </div>
        </div>
        <p className="mt-3 text-xs text-gray-600">{stageMeta.description}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <section className="lg:col-span-4 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h3 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2">
            <UserRound size={16} className="text-slate-500" />
            대상자 기본 정보
          </h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">이름</span>
              <span className="font-medium text-slate-900">{detail.patientName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">연령/성별</span>
              <span className="font-medium text-slate-900">
                {detail.age}세 / {detail.gender}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">담당자</span>
              <span className="font-medium text-slate-900">{detail.counselor}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">접촉 상태</span>
              <span className="font-medium text-slate-900">{CONTACT_STATUS_LABELS[detail.contactStatus]}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">상담 상태</span>
              <span className="font-medium text-slate-900">{CONSULT_STATUS_LABELS[detail.consultStatus]}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">2차 검사</span>
              <span className={cn("rounded px-2 py-0.5 text-xs font-semibold", SECOND_EXAM_COLORS[detail.secondExamStatus])}>
                {SECOND_EXAM_LABELS[detail.secondExamStatus]}
              </span>
            </div>
          </div>
        </section>

        <section className="lg:col-span-5 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h3 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2">
            <Clock3 size={16} className="text-slate-500" />
            단계별 파이프라인 현재 위치
          </h3>
          <div className="space-y-3">
            {[
              { key: "Stage 1", label: "1차 선별/접촉", done: true },
              {
                key: "Stage 2",
                label: "2차 평가/연계",
                done: stage !== "Stage 1",
              },
              {
                key: "Stage 3",
                label: "추적관리/재평가",
                done: stage === "Stage 3",
              },
            ].map((item, idx) => {
              const active = stage === item.key;
              return (
                <div
                  key={item.key}
                  className={cn(
                    "rounded-lg border px-3 py-2 flex items-center justify-between",
                    active ? "border-blue-200 bg-blue-50" : "border-gray-200 bg-gray-50"
                  )}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        "h-6 w-6 rounded-full text-xs font-bold flex items-center justify-center",
                        item.done ? "bg-blue-600 text-white" : "bg-gray-300 text-white"
                      )}
                    >
                      {idx + 1}
                    </span>
                    <span className={cn("text-sm", active ? "font-semibold text-blue-700" : "text-gray-700")}>{item.label}</span>
                  </div>
                  {active && <span className="text-[11px] font-semibold text-blue-700">현재</span>}
                </div>
              );
            })}
          </div>
          <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 flex items-start gap-2">
            <AlertTriangle size={14} className="mt-0.5 shrink-0" />
            민감정보 열람, SMS 발송, 예약 확정 등 주요 행위는 감사 로그에 자동 기록됩니다.
          </div>
        </section>

        <section className="lg:col-span-3 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h3 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2">
            <ShieldCheck size={16} className="text-slate-500" />
            운영 액션
          </h3>
          <div className="space-y-2">
            <button className="w-full inline-flex items-center justify-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50">
              <Phone size={14} />
              전화 시도 기록
            </button>
            <button className="w-full inline-flex items-center justify-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50">
              <MessageSquare size={14} />
              SMS 템플릿 검토
            </button>
            <button className="w-full inline-flex items-center justify-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50">
              <CalendarClock size={14} />
              방문 예약 조정
            </button>
            <button
              onClick={primaryAction.onClick}
              className={cn(
                "mt-2 w-full inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold text-white",
                primaryAction.className
              )}
            >
              {primaryAction.label}
              <ArrowRight size={14} />
            </button>
          </div>
        </section>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h3 className="text-sm font-bold text-slate-900 mb-3">운영 메모 (최근)</h3>
          <ul className="space-y-2 text-xs text-gray-700">
            {detail.autoMemo.lines.slice(0, 8).map((line, idx) => (
              <li key={`${line}-${idx}`} className="rounded-md border border-gray-100 bg-gray-50 px-2.5 py-2">
                {line}
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h3 className="text-sm font-bold text-slate-900 mb-3">SMS 발송 이력</h3>
          {detail.smsHistory.length === 0 ? (
            <p className="text-xs text-gray-500">발송 이력이 없습니다.</p>
          ) : (
            <div className="space-y-2">
              {detail.smsHistory.slice(0, 6).map((sms, idx) => (
                <div key={`${sms.sentAt}-${idx}`} className="rounded-md border border-gray-100 bg-gray-50 px-2.5 py-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-slate-800">{sms.templateId}</p>
                    <span
                      className={cn(
                        "rounded px-1.5 py-0.5 text-[10px] font-semibold",
                        sms.result === "SUCCESS" ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"
                      )}
                    >
                      {sms.result}
                    </span>
                  </div>
                  <p className="text-[11px] text-gray-500 mt-0.5">{sms.sentAt}</p>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
