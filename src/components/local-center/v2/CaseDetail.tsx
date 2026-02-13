import React, { useMemo, useState } from "react";
import { 
  ChevronLeft, 
  UserCircle, 
  ShieldCheck, 
  Clock, 
  Lock, 
  Eye, 
  ArrowRight,
  FileText,
  Phone,
  Calendar,
  AlertTriangle,
  Activity,
  CheckCircle2,
  AlertCircle,
  BarChart3,
  History,
  ArrowRightCircle,
  ExternalLink,
  MessageSquare
} from "lucide-react";
import { cn, type StageType } from "./shared";
import { toast } from "sonner";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";
import {
  getCaseRecordById,
  getStage1ContactPriority,
  getStage1InterventionGuides,
  getStage1InterventionPlan,
  maskName,
  maskPhone,
  toAgeBand,
  type CaseRecord,
} from "./caseRecords";
import { CaseDetailStage2 } from "../CaseDetailStage2";
import { CaseDetailStage3 } from "../CaseDetailStage3";
import { Stage1OpsDetail, type Stage1HeaderSummary } from "./stage1/Stage1OpsDetail";

interface CaseDetailProps {
  caseId: string;
  stage: StageType;
  onBack: () => void;
}

function formatDateTime(isoLike?: string) {
  if (!isoLike) return "-";
  const d = new Date(isoLike);
  if (Number.isNaN(d.getTime())) return isoLike;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")} ${String(
    d.getHours()
  ).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function stage1StrategyLabel(summary: Stage1HeaderSummary | null) {
  if (!summary) return "-";
  if (summary.contactMode === "MANUAL_OVERRIDE") {
    return `수동 변경 (${summary.effectiveMode === "HUMAN_FIRST" ? "상담사 우선" : "자동안내 우선"})`;
  }
  return summary.effectiveMode === "HUMAN_FIRST" ? "상담사 우선" : "자동안내 우선";
}

function stage1SlaLabel(summary: Stage1HeaderSummary | null) {
  if (!summary) return "-";
  if (summary.slaLevel === "OVERDUE") return "지연";
  if (summary.slaLevel === "DUE_SOON") return "임박";
  return "정상";
}

export function CaseDetail({ caseId, stage, onBack }: CaseDetailProps) {
  const profile = useMemo(() => getCaseRecordById(caseId), [caseId]);
  const [stage1HeaderSummary, setStage1HeaderSummary] = useState<Stage1HeaderSummary | null>(null);
  const stageLikeStage1 = stage === "Stage 1";
  const stage1IdentityLine =
    stageLikeStage1 && profile
      ? `연령대 ${toAgeBand(profile.profile.age)} · 연락처 ${maskPhone(profile.profile.phone)} · 케이스키 ${profile.id}`
      : null;

  if (stage === "Stage 2") {
    return <CaseDetailStage2 caseId={caseId} onBack={onBack} />;
  }
  if (stage === "Stage 3") {
    return <CaseDetailStage3 caseId={caseId} onBack={onBack} />;
  }

  return (
    <div className="flex h-full flex-col bg-[#f4f7fb]">
      {/* 상단 스티키 헤더 */}
      <div className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 px-6 py-4 shadow-sm backdrop-blur">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-4">
            <button
              onClick={onBack}
              className="rounded-full border border-slate-200 bg-white p-2 transition-colors hover:bg-slate-50"
            >
              <ChevronLeft size={20} />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-gray-900">{caseId}</h2>
                <span className="rounded border border-blue-200 bg-blue-50 px-3.5 py-1.5 text-sm font-bold text-blue-700">
                  {stage}
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-2">
                <span className="font-bold text-gray-700">담당자: {profile?.manager ?? "김성실 매니저"}</span>
                <span className="w-px h-2 bg-gray-200"></span>
                <span>
                  현재 상태: <span className="font-bold text-blue-700">{profile?.status ?? "진행중"}</span>
                </span>
                {stage1IdentityLine ? (
                  <>
                    <span className="w-px h-2 bg-gray-200"></span>
                    <span className="text-gray-600">{stage1IdentityLine}</span>
                  </>
                ) : null}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button className="flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50">
              <Activity size={14} /> 운영 지원 요청
            </button>
            <button className="flex items-center gap-2 rounded-lg bg-[#15386a] px-4 py-2 text-xs font-bold text-white shadow-sm transition-all hover:shadow-md">
              다음 액션 1순위 실행 <ArrowRightCircle size={14} />
            </button>
          </div>
        </div>

        {stageLikeStage1 && stage1HeaderSummary ? (
          <div className="mt-3 rounded-xl border border-slate-700 bg-gradient-to-r from-slate-900 to-slate-800 px-3 py-2 text-white">
            <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold">
              <span className="rounded-md bg-white/15 px-2 py-1">접촉 방식 {stage1StrategyLabel(stage1HeaderSummary)}</span>
              <span className="rounded-md bg-white/15 px-2 py-1">SLA {stage1SlaLabel(stage1HeaderSummary)}</span>
              <span className="rounded-md bg-white/15 px-2 py-1">데이터 품질 {stage1HeaderSummary.qualityScore}%</span>
              <span className="rounded-md bg-white/15 px-2 py-1">누락 {stage1HeaderSummary.missingCount}건</span>
              <span className="rounded-md bg-white/15 px-2 py-1">경고 {stage1HeaderSummary.warningCount}건</span>
            </div>
            <p className="mt-1 text-[11px] text-slate-200">
              최근 업데이트 {formatDateTime(stage1HeaderSummary.lastUpdatedAt)} · 운영 참고: 접촉 방식은 사전 기준으로 제안되며 최종 실행은 담당자가 수행합니다.
            </p>
          </div>
        ) : null}
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {stageLikeStage1 ? (
          <>
            <Stage1OpsDetail
              caseRecord={profile}
              onHeaderSummaryChange={setStage1HeaderSummary}
            />
          </>
        ) : (
          <>
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold text-gray-800 flex items-center gap-2">
                  <UserCircle size={16} className="text-gray-500" />
                  개인정보 요약
                </h3>
                <span className="text-[10px] font-semibold text-gray-500 bg-gray-100 px-2 py-1 rounded">
                  {stage === "Stage 1" ? "Stage 1: 케이스ID 기반 식별" : "Stage 2+: 비식별 처리 적용"}
                </span>
              </div>
              {profile ? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                  <div className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
                    <p className="text-[10px] text-gray-400 font-bold uppercase">식별 키</p>
                    <p className="mt-1 font-bold text-gray-800">
                      {stage === "Stage 1" ? profile.id : `${maskName(profile.profile.name)} (${profile.id})`}
                    </p>
                  </div>
                  <div className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
                    <p className="text-[10px] text-gray-400 font-bold uppercase">연령</p>
                    <p className="mt-1 font-bold text-gray-800">
                      {stage === "Stage 1" ? toAgeBand(profile.profile.age) : `${profile.profile.age}세`}
                    </p>
                  </div>
                  <div className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
                    <p className="text-[10px] text-gray-400 font-bold uppercase">연락처</p>
                    <p className="mt-1 font-bold text-gray-800">
                      {maskPhone(profile.profile.phone)}
                    </p>
                    {stage === "Stage 1" && profile.profile.guardianPhone && (
                      <p className="mt-1 text-[11px] text-gray-500">보호자: {maskPhone(profile.profile.guardianPhone)}</p>
                    )}
                  </div>
                </div>
              ) : (
                <p className="text-xs text-gray-500">케이스 프로필 데이터가 없어 기본 식별 정보만 표시합니다.</p>
              )}
            </div>

            {stage === "Stage 2" && <Stage2Detail />}
            {stage === "Stage 3" && <Stage3Detail />}

            {/* 하단 고정 감사 로그/히스토리 */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
              <div className="flex items-center justify-between mb-4 pb-2 border-b border-gray-100">
                <h3 className="font-bold text-gray-800 flex items-center gap-2">
                  <History size={16} className="text-gray-400" />
                  변경 사유 및 감사 로그
                </h3>
                <div className="flex items-center gap-3">
                  <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded flex items-center gap-1">
                    <ShieldCheck size={10} /> 보안 무결성 확인됨
                  </span>
                  <button className="text-[10px] font-bold text-gray-400 hover:text-gray-600">로그 내보내기</button>
                </div>
              </div>
              <div className="space-y-3">
                {[
                  { time: "2026-02-11 11:20", user: "김성실", action: "관리 경로 변경", reason: "재평가 트리거 충족 (점수 하락 15% 초과)", logId: "LOG-9921" },
                  { time: "2026-02-10 14:45", user: "박민지", action: "데이터 품질 승인", reason: "누락된 정보 보완 완료 확인", logId: "LOG-8842" },
                  { time: "2026-02-09 10:00", user: "System", action: "Stage 승급", reason: "2차 평가 데이터 입력 완료에 따른 자동 전환", logId: "LOG-7710" },
                ].map((log, idx) => (
                  <div key={idx} className="flex gap-4 text-xs group">
                    <div className="w-32 shrink-0 font-mono text-gray-400">{log.time}</div>
                    <div className="shrink-0 font-bold text-gray-700 w-20">{log.user}</div>
                    <div className="flex-1">
                      <span className="font-bold text-[#163b6f]">{log.action}: </span>
                      <span className="text-gray-600">{log.reason}</span>
                    </div>
                    <div className="shrink-0 font-mono text-[10px] text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity">#{log.logId}</div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* Stage 1 Case Detail */
function Stage1Detail({ caseRecord }: { caseRecord?: CaseRecord }) {
  const contactPriority = getStage1ContactPriority(caseRecord);
  const interventionPlan = getStage1InterventionPlan(caseRecord);
  const interventionGuides = getStage1InterventionGuides();
  const qualityLabel = caseRecord?.quality ?? "양호";
  const qualityTone =
    qualityLabel === "경고"
      ? "bg-red-50 text-red-700 border-red-100"
      : qualityLabel === "주의"
        ? "bg-orange-50 text-orange-700 border-orange-100"
        : "bg-emerald-50 text-emerald-700 border-emerald-100";
  const qualityScore = qualityLabel === "경고" ? "62%" : qualityLabel === "주의" ? "81%" : "100%";

  return (
    <div className="grid grid-cols-12 gap-6">
      <div className="col-span-12">
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <div className="flex flex-col">
              <span className="text-[10px] font-bold text-gray-400 uppercase">접촉 우선도</span>
              <span className={cn("inline-flex items-center rounded-md border px-2.5 py-1 text-sm font-bold", contactPriority.tone)}>
                {contactPriority.label}
              </span>
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] font-bold text-gray-400 uppercase">개입 레벨</span>
              <div className="mt-1 flex items-center gap-2">
                <span className={cn("inline-flex items-center rounded-md border px-2.5 py-1 text-sm font-bold", interventionPlan.guide.tone)}>
                  {interventionPlan.level} · {interventionPlan.guide.label}
                </span>
                <span className="text-[11px] text-gray-500">{interventionPlan.guide.purpose}</span>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {interventionGuides.map((guide) => (
                  <div key={guide.level} className="relative group">
                    <button
                      type="button"
                      className={cn(
                        "rounded-md border px-2 py-1 text-[10px] font-bold transition-colors",
                        guide.level === interventionPlan.level
                          ? guide.tone
                          : "text-gray-500 bg-white border-gray-200 hover:bg-gray-50"
                      )}
                    >
                      {guide.level}
                    </button>
                    <div className="pointer-events-none absolute left-1/2 top-full z-20 hidden w-72 -translate-x-1/2 pt-2 group-hover:block">
                      <div className="rounded-lg border border-gray-200 bg-white p-3 text-left shadow-xl">
                        <p className="text-xs font-bold text-gray-900">
                          {guide.level} · {guide.label}
                        </p>
                        <p className="mt-1 text-[11px] text-gray-600">{guide.purpose}</p>
                        <p className="mt-1 text-[11px] text-gray-500">적용 시점: {guide.whenToUse}</p>
                        <div className="mt-2 space-y-1">
                          {guide.actions.map((action) => (
                            <p key={action} className="text-[11px] text-gray-600">
                              · {action}
                            </p>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] font-bold text-gray-400 uppercase">연계 상태</span>
              <span className="text-sm font-bold text-orange-600">{caseRecord?.status ?? "검토중"}</span>
            </div>
          </div>
          <div className="flex flex-col items-end gap-2">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold text-gray-400">데이터 품질</span>
              <span className={cn("px-2 py-1 text-[10px] font-bold rounded border", qualityTone)}>
                {qualityLabel} ({qualityScore})
              </span>
            </div>
            {interventionPlan.exceptionState && (
              <div className="flex items-center gap-2">
                <span className={cn(
                  "px-2 py-0.5 rounded border text-[10px] font-bold",
                  interventionPlan.exceptionState === "제외"
                    ? "text-red-700 bg-red-50 border-red-200"
                    : "text-amber-700 bg-amber-50 border-amber-200"
                )}>
                  예외: {interventionPlan.exceptionState}
                </span>
                <span className="text-[10px] text-gray-500">{interventionPlan.exceptionReason}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 좌측 블록: 1차 검사 점수 */}
      <div className="col-span-8 space-y-6">
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-bold text-gray-800">1차 검사 점수</h3>
            <span className="text-[10px] text-gray-400 font-mono">Ver 2.1 (2026-02-10 14:00 산출)</span>
          </div>
          <div className="grid grid-cols-4 gap-4 mb-8">
            {[
              { label: "기억력", score: 42, color: "text-red-600" },
              { label: "지남력", score: 68, color: "text-orange-500" },
              { label: "언어능력", score: 85, color: "text-emerald-600" },
              { label: "수행능력", score: 72, color: "text-gray-900" },
            ].map(item => (
              <div key={item.label} className="p-4 bg-gray-50 rounded-xl border border-gray-100 text-center">
                <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">{item.label}</p>
                <div className="flex items-center justify-center gap-1">
                  <span className={cn("text-2xl font-bold", item.color)}>{item.score}</span>
                  <span className="text-[10px] text-gray-300 font-bold">/100</span>
                </div>
              </div>
            ))}
          </div>
          <div className="space-y-4">
            <h4 className="text-xs font-bold text-gray-500 flex items-center gap-2">
              <BarChart3 size={14} /> 상위 기여 요인 Top3 (범주형)
            </h4>
            <div className="flex gap-2">
              <span className="px-3 py-1.5 bg-blue-50 border border-blue-100 rounded-lg text-xs font-bold text-[#163b6f]">최근 망각 빈도 급증</span>
              <span className="px-3 py-1.5 bg-blue-50 border border-blue-100 rounded-lg text-xs font-bold text-[#163b6f]">길 찾기 어려움 호소</span>
              <span className="px-3 py-1.5 bg-blue-50 border border-blue-100 rounded-lg text-xs font-bold text-[#163b6f]">사회적 고립 징후</span>
            </div>
          </div>
        </div>
      </div>

      {/* 우측 블록: 운영 액션 */}
      <div className="col-span-4 space-y-4">
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <h3 className="font-bold text-gray-800 mb-4">운영 액션</h3>
          <div className="space-y-3">
            {interventionGuides.map((guide) => (
              <div key={guide.level} className="relative">
                <button
                  className={cn(
                    "w-full p-4 rounded-xl text-left transition-all border",
                    guide.level === interventionPlan.level
                      ? "border-2 border-[#163b6f] bg-blue-50/20 hover:bg-blue-50"
                      : "border-gray-100 hover:bg-gray-50"
                  )}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className={cn("text-xs font-bold", guide.level === interventionPlan.level ? "text-[#163b6f]" : "text-gray-500")}>
                      {guide.level}: {guide.label}
                    </span>
                    {guide.level === "L0" && <CheckCircle2 size={16} className="text-gray-300" />}
                    {guide.level === "L1" && <MessageSquare size={16} className="text-gray-300" />}
                    {guide.level === "L2" && <Phone size={16} className="text-gray-300" />}
                    {guide.level === "L3" && <ArrowRight size={16} className="text-gray-300" />}
                  </div>
                  <p className="text-[10px] text-gray-500">{guide.purpose}</p>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {guide.actions.slice(0, 2).map((action) => (
                      <span key={`${guide.level}-${action}`} className="text-[9px] font-bold bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">
                        {action}
                      </span>
                    ))}
                  </div>
                </button>
                {guide.level === "L3" && (
                  <div className="absolute -top-2 -right-2 px-2 py-0.5 bg-red-600 text-white text-[9px] font-bold rounded-full shadow-lg border-2 border-white flex items-center gap-1">
                    <Lock size={8} /> 정책 게이트 확인
                  </div>
                )}
              </div>
            ))}

            {interventionPlan.level === "L3" && (
              <div className="relative">
                <button className="w-full p-4 border-2 border-[#163b6f] bg-blue-50/20 rounded-xl hover:bg-blue-50 text-left transition-all">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold text-[#163b6f]">L3 실행: 2차 연계 요청</span>
                  <ArrowRight size={16} className="text-[#163b6f]" />
                </div>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  <span className="text-[9px] font-bold bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded">동의 完</span>
                  <span className="text-[9px] font-bold bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded">채널 확인 完</span>
                  <span className="text-[9px] font-bold bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded">목적 고지 중</span>
                </div>
                </button>
                <div className="absolute -top-2 -right-2 px-2 py-0.5 bg-red-600 text-white text-[9px] font-bold rounded-full shadow-lg border-2 border-white flex items-center gap-1">
                  <Lock size={8} /> 정책 게이트 미충족
                </div>
              </div>
            )}
          </div>
        </div>
        <div className="bg-gray-900 text-white rounded-xl p-4 shadow-sm">
          <p className="text-[10px] font-bold opacity-50 uppercase mb-2">운영자 주석</p>
          <p className="text-xs leading-relaxed">
            현재 개입 레벨은 {interventionPlan.level}({interventionPlan.guide.label})입니다. {interventionPlan.guide.whenToUse}
          </p>
        </div>
      </div>
      
      {/* 하단 담당자 액션 로그 (Stage 1 특화) */}
      <div className="col-span-12">
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 text-[10px] text-gray-500 italic text-center">
          * 운영자 주석: {interventionPlan.level} 경로 기준으로 액션 큐가 정렬되어 있습니다.
          {interventionPlan.exceptionState
            ? ` 예외 상태(${interventionPlan.exceptionState}) 해제 후 다음 단계를 실행해 주세요.`
            : " 정책 게이트 확인 후 순차 실행해 주세요."}
        </div>
      </div>
    </div>
  );
}

/* Stage 2 Case Detail */
function Stage2Detail() {
  const [showSensitive, setShowSensitive] = useState(false);

  const handleReveal = () => {
    setShowSensitive(true);
    toast.info("민감 정보 열람이 감사 로그에 실시간 기록되었습니다.", {
      description: "열람자: 김성실, 열람 일시: 2026-02-11 11:50",
    });
  };

  return (
    <div className="grid grid-cols-12 gap-6">
      {/* Header Info Block */}
      <div className="col-span-12">
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-6 py-4 flex items-center justify-between border-l-8 border-[#163b6f]">
          <div className="flex items-center gap-12">
            <div className="flex flex-col">
              <span className="text-[10px] font-bold text-gray-400 uppercase">관리 경로</span>
              <span className="text-xl font-bold text-[#163b6f]">의뢰 우선 경로</span>
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] font-bold text-gray-400 uppercase">처리 상태</span>
              <span className="text-sm font-bold text-orange-600">2차 검사 완료 (대기)</span>
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] font-bold text-gray-400 uppercase">다음 액션</span>
              <span className="text-sm font-bold text-gray-900">의뢰서 생성 및 전송</span>
            </div>
          </div>
          <div className="flex gap-2">
            <button className="p-2 border border-gray-200 rounded-lg hover:bg-gray-50"><Phone size={16} /></button>
            <button className="p-2 border border-gray-200 rounded-lg hover:bg-gray-50"><Calendar size={16} /></button>
          </div>
        </div>
      </div>

      <div className="col-span-8 space-y-6">
        {/* 블록1: 검사 점수 요약 */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <h3 className="font-bold text-gray-800 mb-6">검사 점수 요약</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-100">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-white border border-gray-200 flex items-center justify-center font-bold text-[#163b6f] shadow-sm text-lg">1</div>
                <div>
                  <p className="text-sm font-bold text-gray-900">1차 선별 검사 (CIST)</p>
                  <p className="text-[11px] text-gray-500">2026-01-15 시행 | 정규 시점</p>
                </div>
              </div>
              <div className="text-right">
                <span className="text-xl font-bold text-orange-600">18 / 30</span>
                <p className="text-[10px] text-gray-400">신뢰도: 양호</p>
              </div>
            </div>
            <div className="flex items-center justify-between p-4 bg-[#163b6f]/5 rounded-xl border border-[#163b6f]/20 shadow-sm">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-[#163b6f] flex items-center justify-center font-bold text-white shadow-lg text-lg">2</div>
                <div>
                  <p className="text-sm font-bold text-[#163b6f]">2차 신경심리 검사 (SNSB)</p>
                  <p className="text-[11px] text-gray-500">2026-02-10 시행 | 표준화 분석 완료</p>
                </div>
              </div>
              <div className="text-right">
                <span className="text-xl font-bold text-[#163b6f]">-2.1 SD</span>
                <p className="text-[10px] text-red-600 font-bold">누락항목 1건 (시공간 구성)</p>
              </div>
            </div>
          </div>
        </div>

        {/* 블록2: 참고 분류 (의료진 확인 전) */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="bg-gray-100/80 px-6 py-3 border-b border-gray-200 flex items-center justify-between">
            <h3 className="text-xs font-bold text-gray-600 uppercase flex items-center gap-2">
              <Lock size={14} className="text-orange-500" /> 참고 분류 (의료진 확인 전)
            </h3>
            {!showSensitive && (
              <button 
                onClick={handleReveal}
                className="flex items-center gap-1.5 px-3 py-1 bg-white border border-[#163b6f] rounded text-[10px] font-bold text-[#163b6f] hover:bg-blue-50 transition-colors shadow-sm"
              >
                <Eye size={12} /> 권한자 열람 실행
              </button>
            )}
          </div>
          <div className="p-8 min-h-[140px] flex items-center justify-center bg-gray-50/30">
            {showSensitive ? (
              <div className="w-full grid grid-cols-2 gap-6 animate-in fade-in zoom-in duration-300">
                <div className="p-5 border border-red-200 bg-red-50/50 rounded-2xl text-center shadow-sm">
                  <p className="text-[10px] font-bold text-gray-400 mb-1 uppercase">참고 분류 후보</p>
                  <p className="text-2xl font-bold text-red-700">MCI (High)</p>
                </div>
                <div className="p-5 border border-blue-200 bg-blue-50/50 rounded-2xl text-center shadow-sm">
                  <p className="text-[10px] font-bold text-gray-400 mb-1 uppercase">참고 데이터 기반 전환 확률</p>
                  <p className="text-2xl font-bold text-blue-700">82%</p>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <Lock size={24} className="text-gray-300" />
                <p className="text-sm text-gray-400 italic">열람 즉시 관리 시스템에 로그가 기록됩니다.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="col-span-4 space-y-6">
        {/* 블록3: 경로별 액션 */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <h3 className="font-bold text-gray-800 mb-6 flex items-center gap-2">
            <ArrowRightCircle size={18} className="text-[#163b6f]" /> 경로별 운영 액션
          </h3>
          <div className="space-y-6">
            <div className="space-y-2">
              <p className="text-[10px] font-bold text-[#163b6f] uppercase border-l-2 border-[#163b6f] pl-2">의뢰 우선 경로</p>
              <button className="w-full py-3 bg-[#163b6f] text-white text-xs font-bold rounded-xl hover:bg-[#0f2a50] flex items-center justify-center gap-2 shadow-md">
                <FileText size={16} /> 의뢰서 생성 및 전송
              </button>
              <button className="w-full py-2 border border-gray-200 text-gray-700 text-xs font-bold rounded-lg hover:bg-gray-50">병원 예약 현황 추적</button>
            </div>
            <div className="space-y-2 pt-4 border-t border-gray-50">
              <p className="text-[10px] font-bold text-gray-400 uppercase border-l-2 border-gray-200 pl-2">MCI 관리 경로</p>
              <button className="w-full py-2 border border-gray-200 text-gray-700 text-xs font-bold rounded-lg hover:bg-gray-50">정기 추적 등록 (CRF)</button>
              <button className="w-full py-2 border border-gray-200 text-gray-700 text-xs font-bold rounded-lg hover:bg-gray-50">교육/상담 프로그램 연계</button>
            </div>
            <div className="space-y-2 pt-4 border-t border-gray-50">
              <p className="text-[10px] font-bold text-gray-400 uppercase border-l-2 border-gray-200 pl-2">정상 추적 권고</p>
              <button className="w-full py-2 border border-gray-200 text-gray-400 text-xs font-bold rounded-lg cursor-not-allowed" disabled>사례 종결 (기준 미충족)</button>
            </div>
          </div>
        </div>
      </div>

      {/* 하단: 케이스 타임라인 (Stage 2 특화) */}
      <div className="col-span-12">
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 overflow-x-auto">
          <h3 className="font-bold text-gray-800 mb-8 flex items-center gap-2">
            <History size={16} /> 검사-의뢰-예약-종결 타임라인
          </h3>
          <div className="flex items-center min-w-[800px]">
            {[
              { step: "선별검사", date: "01-15", status: "완료", color: "bg-emerald-500" },
              { step: "2차평가", date: "02-10", status: "완료", color: "bg-emerald-500" },
              { step: "의뢰서전송", date: "대기", status: "예정", color: "bg-orange-500" },
              { step: "정밀검사", date: "미정", status: "예정", color: "bg-gray-200" },
              { step: "추적/종결", date: "미정", status: "예정", color: "bg-gray-200" },
            ].map((item, idx, arr) => (
              <React.Fragment key={idx}>
                <div className="flex flex-col items-center relative z-10">
                  <div className={cn("w-10 h-10 rounded-full flex items-center justify-center text-white shadow-lg", item.color)}>
                    {item.status === "완료" ? <CheckCircle2 size={20} /> : <div className="w-2 h-2 bg-white rounded-full"></div>}
                  </div>
                  <p className="text-[11px] font-bold text-gray-900 mt-2">{item.step}</p>
                  <p className="text-[10px] text-gray-400">{item.date}</p>
                </div>
                {idx < arr.length - 1 && (
                  <div className={cn("flex-1 h-1 mx-2", item.status === "완료" && arr[idx+1].status === "완료" ? "bg-emerald-500" : "bg-gray-100")}></div>
                )}
              </React.Fragment>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* Stage 3 Case Detail */
function Stage3Detail() {
  const chartData = [
    { name: "24-Q3", score: 85, trigger: false },
    { name: "24-Q4", score: 82, trigger: false },
    { name: "25-Q1", score: 75, trigger: true },
    { name: "25-Q2", score: 72, trigger: true },
    { name: "26-Q1", score: 68, trigger: true },
  ];

  return (
    <div className="grid grid-cols-12 gap-6">
      <div className="col-span-12">
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-6 py-4 flex items-center justify-between border-l-8 border-red-600">
          <div className="flex items-center gap-12">
            <div className="flex flex-col">
              <span className="text-[10px] font-bold text-gray-400 uppercase">진행 위험 구간</span>
              <span className="text-xl font-bold text-red-600">고위험 구간 (Danger Zone)</span>
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] font-bold text-gray-400 uppercase">추적 강도</span>
              <span className="text-sm font-bold text-[#163b6f]">3개월 주기 (상향됨)</span>
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] font-bold text-gray-400 uppercase">트리거 상태</span>
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 bg-red-600 rounded-full animate-pulse"></div>
                <span className="text-sm font-bold text-red-600">다중 트리거 활성화</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
             <span className="text-[10px] font-bold text-gray-400 bg-gray-100 px-2 py-1 rounded">데이터 품질: 95%</span>
          </div>
        </div>
      </div>

      <div className="col-span-8 space-y-6">
        {/* 블록1: 데이터 요약 */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
            <p className="text-[10px] font-bold text-gray-400 uppercase mb-2">2차 점수 (최근)</p>
            <p className="text-2xl font-bold text-red-600">-2.4 SD</p>
            <p className="text-[10px] text-gray-400 mt-1">직전 대비 15% 하락</p>
          </div>
          <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
            <p className="text-[10px] font-bold text-gray-400 uppercase mb-2">MRI 요약</p>
            <p className="text-sm font-bold text-orange-600">내측 측두엽 위축</p>
            <p className="text-[10px] text-gray-400 mt-1">MTA Scale 3단계</p>
          </div>
          <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
            <p className="text-[10px] font-bold text-gray-400 uppercase mb-2">연락 성공률</p>
            <p className="text-2xl font-bold text-gray-900">33%</p>
            <p className="text-[10px] text-red-600 font-bold mt-1">3회 연속 부재중</p>
          </div>
        </div>

        {/* 블록2: 변화 추이 차트 */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-bold text-gray-800">지표 변화 추이</h3>
            <div className="flex gap-4">
              <div className="flex items-center gap-1.5 text-[9px] font-bold text-gray-500">
                <div className="w-2 h-2 rounded-full bg-red-600"></div> 핵심 지표
              </div>
              <div className="flex items-center gap-1.5 text-[9px] font-bold text-gray-500">
                <div className="w-2 h-2 rounded-full bg-gray-200"></div> 관리 임계치
              </div>
            </div>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" fontSize={10} axisLine={false} tickLine={false} tick={{ fill: '#94a3b8' }} />
                <YAxis fontSize={10} axisLine={false} tickLine={false} tick={{ fill: '#94a3b8' }} />
                <Tooltip />
                <Line type="monotone" dataKey="score" stroke="#dc2626" strokeWidth={3} dot={{ r: 4, fill: "#dc2626" }} />
                <Line type="monotone" dataKey="threshold" stroke="#e2e8f0" strokeDasharray="5 5" dot={false} strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="col-span-4 space-y-6">
        {/* 블록3: 재평가 트리거 규칙 패널 */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <h3 className="font-bold text-gray-800 mb-6 flex items-center gap-2 text-sm">
            <AlertTriangle size={16} className="text-red-600" /> 재평가 트리거 현황
          </h3>
          <div className="space-y-4">
            {[
              { label: "점수 하락 (10% 이상)", value: "15% 하락", status: "충족", color: "text-red-600 bg-red-50" },
              { label: "검사 누락 (2회 이상)", value: "1회 누락", status: "미충족", color: "text-gray-400 bg-gray-50" },
              { label: "연락 실패 (3회 이상)", value: "4회 연속", status: "충족", color: "text-red-600 bg-red-50" },
            ].map((rule, idx) => (
              <div key={idx} className="flex flex-col gap-1.5 border-b border-gray-50 pb-3 last:border-0 last:pb-0">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-gray-700">{rule.label}</span>
                  <span className={cn("text-[9px] font-bold px-1.5 py-0.5 rounded", rule.color)}>{rule.status}</span>
                </div>
                <p className="text-[10px] text-gray-500">현재 상태: {rule.value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* 블록4: 운영 액션 */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <h3 className="font-bold text-gray-800 mb-4">운영 액션</h3>
          <div className="space-y-3">
            <button className="w-full py-3 bg-red-600 text-white text-xs font-bold rounded-xl flex flex-col items-center gap-1 shadow-lg hover:bg-red-700 transition-all">
              <Calendar size={18} />
              <span>재평가 일정 생성</span>
            </button>
            <div className="grid grid-cols-2 gap-2">
              <button className="py-2.5 border border-gray-200 rounded-lg text-[10px] font-bold text-gray-700 hover:bg-gray-50">추적 강도 조정</button>
              <button className="py-2.5 border border-gray-200 rounded-lg text-[10px] font-bold text-gray-700 hover:bg-gray-50">의뢰/연계 강화</button>
            </div>
            <button className="w-full py-2.5 border-2 border-orange-500 text-orange-600 text-[10px] font-bold rounded-lg hover:bg-orange-50">이탈 방지 재연락</button>
          </div>
        </div>
      </div>

      <div className="col-span-12">
        <div className="bg-red-50 border border-red-100 rounded-xl p-3 text-[10px] text-red-700 font-bold italic text-center">
          * 위험 구간 변경 및 강도 상향 사유: 26-Q1 점수 하락 트리거 및 연락 실패 반복으로 인한 추적 고도화 필요 (감사 로그 기록됨)
        </div>
      </div>
    </div>
  );
}
