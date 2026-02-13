import React, { useMemo, useState } from "react";
import { ArrowRightCircle, ChevronLeft, Activity } from "lucide-react";
import { Stage1OpsDetail, type Stage1HeaderSummary } from "../v2/stage1/Stage1OpsDetail";
import { getCaseRecordById, maskPhone, toAgeBand, type CaseRecord } from "../v2/caseRecords";
import type { StageType } from "../v2/shared";

interface StageMirrorDetailProps {
  caseId: string;
  stage: Extract<StageType, "Stage 2" | "Stage 3">;
  onBack: () => void;
}

function formatDateTime(isoLike?: string) {
  if (!isoLike) return "-";
  const d = new Date(isoLike);
  if (Number.isNaN(d.getTime())) return isoLike;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")} ${String(
    d.getHours(),
  ).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function strategyLabel(summary: Stage1HeaderSummary | null) {
  if (!summary) return "-";
  if (summary.contactMode === "MANUAL_OVERRIDE") {
    return `수동 변경 (${summary.effectiveMode === "HUMAN_FIRST" ? "상담사 우선" : "자동안내 우선"})`;
  }
  return summary.effectiveMode === "HUMAN_FIRST" ? "상담사 우선" : "자동안내 우선";
}

function slaLabel(summary: Stage1HeaderSummary | null) {
  if (!summary) return "-";
  if (summary.slaLevel === "OVERDUE") return "지연";
  if (summary.slaLevel === "DUE_SOON") return "임박";
  return "정상";
}

function resolveStatus(profile: CaseRecord | undefined) {
  return profile?.status ?? "진행중";
}

function stage3StatusLabel(status?: string) {
  if (!status) return "-";
  if (status === "TRACKING") return "추적중";
  if (status === "REEVAL_DUE") return "재평가 임박";
  if (status === "REEVAL_PENDING") return "재평가 대기";
  if (status === "LINKAGE_PENDING") return "연계 대기";
  if (status === "PLAN_NEEDS_UPDATE") return "플랜 업데이트 필요";
  if (status === "CHURN_RISK") return "이탈 위험";
  return "종결";
}

export function StageMirrorDetail({ caseId, stage, onBack }: StageMirrorDetailProps) {
  const profile = useMemo(() => getCaseRecordById(caseId), [caseId]);
  const [headerSummary, setHeaderSummary] = useState<Stage1HeaderSummary | null>(null);
  const [primaryActionHandler, setPrimaryActionHandler] = useState<(() => void) | null>(null);
  const isStage2 = stage === "Stage 2";
  const isStage3 = stage === "Stage 3";
  const phoneLabel = profile?.profile.phone ?? "-";
  const subjectName = profile?.profile.name ?? "이름 미확인";
  const subjectAge = profile?.profile.age;
  const subjectTitle = isStage3 ? subjectName : caseId;
  const identityLine =
    profile
      ? isStage3
        ? `이름 ${subjectName} · 연령 ${subjectAge ?? "-"}세 · 연락처 ${phoneLabel}`
        : `연령대 ${toAgeBand(profile.profile.age)} · 연락처 ${isStage2 ? phoneLabel : maskPhone(profile.profile.phone)} · 케이스키 ${profile.id}`
      : isStage3
        ? "이름/연령 정보 없음"
        : `케이스키 ${caseId}`;

  return (
    <div className="flex h-full flex-col bg-[#f4f7fb]">
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
                <h2 className="text-xl font-bold text-gray-900">{subjectTitle}</h2>
                <span className="rounded border border-blue-200 bg-blue-50 px-3.5 py-1.5 text-sm font-bold text-blue-700">
                  {stage}
                </span>
              </div>
              <p className="mt-0.5 flex items-center gap-2 text-xs text-gray-500">
                <span className="font-bold text-gray-700">담당자: {profile?.manager ?? "김성실 매니저"}</span>
                <span className="h-2 w-px bg-gray-200" />
                <span>
                  현재 상태: <span className="font-bold text-blue-700">{isStage3 ? (headerSummary?.stage3Meta ? stage3StatusLabel(headerSummary.stage3Meta.opsStatus) : resolveStatus(profile)) : resolveStatus(profile)}</span>
                </span>
                <span className="h-2 w-px bg-gray-200" />
                <span className="text-gray-600">{identityLine}</span>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button className="flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50">
              <Activity size={14} /> 운영 지원 요청
            </button>
            <button
              onClick={() => primaryActionHandler?.()}
              className="flex items-center gap-2 rounded-lg bg-[#15386a] px-4 py-2 text-xs font-bold text-white shadow-sm transition-all hover:shadow-md"
            >
              {isStage3 && headerSummary?.nextActionLabel ? headerSummary.nextActionLabel : "다음 액션 1순위 실행"} <ArrowRightCircle size={14} />
            </button>
          </div>
        </div>

        {headerSummary ? (
          <div className="mt-3 rounded-xl border border-slate-700 bg-gradient-to-r from-slate-900 to-slate-800 px-3 py-2 text-white">
            {isStage3 && headerSummary.stage3Meta ? (
              <>
                <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold">
                  <span className="rounded-md bg-white/15 px-2 py-1">운영 상태 {stage3StatusLabel(headerSummary.stage3Meta.opsStatus)}</span>
                  <span className="rounded-md bg-white/15 px-2 py-1">2년 전환위험 {headerSummary.stage3Meta.risk2yNowPct}%</span>
                  <span className="rounded-md bg-white/15 px-2 py-1">신뢰수준 {headerSummary.stage3Meta.risk2yLabel}</span>
                  <span className="rounded-md bg-white/15 px-2 py-1">추세 {headerSummary.stage3Meta.trend}</span>
                  <span className="rounded-md bg-white/15 px-2 py-1">모델 {headerSummary.stage3Meta.modelVersion}</span>
                  <span className="rounded-md bg-white/15 px-2 py-1">다음 재평가 {formatDateTime(headerSummary.stage3Meta.nextReevalAt)}</span>
                  <span className="rounded-md bg-white/15 px-2 py-1">다음 추적 접촉 {formatDateTime(headerSummary.stage3Meta.nextTrackingContactAt)}</span>
                  <span className="rounded-md bg-white/15 px-2 py-1">플랜 {headerSummary.stage3Meta.planStatus}</span>
                  <span className="rounded-md bg-white/15 px-2 py-1">추적 주기 {headerSummary.stage3Meta.trackingCycleDays}일</span>
                  <span className="rounded-md bg-white/15 px-2 py-1">이탈 위험 {headerSummary.stage3Meta.churnRisk}</span>
                  <span className="rounded-md bg-white/15 px-2 py-1">데이터 품질 {headerSummary.qualityScore}%</span>
                  <span className="rounded-md bg-white/15 px-2 py-1">누락 {headerSummary.missingCount}건</span>
                </div>
                <p className="mt-1 text-[11px] text-slate-200">
                  최근 업데이트 {formatDateTime(headerSummary.lastUpdatedAt)} · 예측 업데이트 {formatDateTime(headerSummary.stage3Meta.riskUpdatedAt)} · 운영 참고: 전환 위험 신호는 정렬용이며 재평가/플랜/연계 실행은 담당자 검토 후 진행합니다.
                </p>
              </>
            ) : (
              <>
                <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold">
                  <span className="rounded-md bg-white/15 px-2 py-1">{isStage2 ? "분기/강도 기준" : "접촉 방식"} {strategyLabel(headerSummary)}</span>
                  <span className="rounded-md bg-white/15 px-2 py-1">SLA {slaLabel(headerSummary)}</span>
                  <span className="rounded-md bg-white/15 px-2 py-1">{isStage2 ? "근거 품질" : "데이터 품질"} {headerSummary.qualityScore}%</span>
                  <span className="rounded-md bg-white/15 px-2 py-1">누락 {headerSummary.missingCount}건</span>
                  <span className="rounded-md bg-white/15 px-2 py-1">{isStage2 ? "보완 필요" : "경고"} {headerSummary.warningCount}건</span>
                </div>
                <p className="mt-1 text-[11px] text-slate-200">
                  최근 업데이트 {formatDateTime(headerSummary.lastUpdatedAt)} · 운영 참고: {isStage2
                    ? "분기/연계/후속조치는 담당자와 의료진 확인 후 확정합니다."
                    : "접촉 방식은 사전 기준으로 제안되며 최종 실행은 담당자가 수행합니다."}
                </p>
              </>
            )}
          </div>
        ) : null}
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        <Stage1OpsDetail
          caseRecord={profile}
          onHeaderSummaryChange={setHeaderSummary}
          onPrimaryActionChange={(handler) => {
            setPrimaryActionHandler(() => handler);
          }}
          mode={isStage2 ? "stage2" : "stage3"}
        />
      </div>
    </div>
  );
}
