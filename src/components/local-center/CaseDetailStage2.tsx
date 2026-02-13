import React, { useMemo, useState } from "react";
import { ArrowRightCircle, ChevronLeft, Activity } from "lucide-react";
import { Stage1OpsDetail, type Stage1HeaderSummary } from "./v2/stage1/Stage1OpsDetail";
import { getCaseRecordById, toAgeBand } from "./v2/caseRecords";

interface CaseDetailStage2Props {
  caseId: string;
  onBack: () => void;
}

function formatDateTime(isoLike?: string) {
  if (!isoLike) return "-";
  const d = new Date(isoLike);
  if (Number.isNaN(d.getTime())) return isoLike;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(
    2,
    "0",
  )} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
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

function resolveStatus(status?: string) {
  return status ?? "진행중";
}

export function CaseDetailStage2({ caseId, onBack }: CaseDetailStage2Props) {
  const profile = useMemo(() => getCaseRecordById(caseId), [caseId]);
  const [headerSummary, setHeaderSummary] = useState<Stage1HeaderSummary | null>(null);
  const [primaryActionHandler, setPrimaryActionHandler] = useState<(() => void) | null>(null);

  const phoneLabel = profile?.profile.phone ?? "-";
  const identityLine = profile
    ? `연령대 ${toAgeBand(profile.profile.age)} · 연락처 ${phoneLabel} · 케이스키 ${profile.id}`
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
                <h2 className="text-xl font-bold text-gray-900">{caseId}</h2>
                <span className="rounded border border-blue-200 bg-blue-50 px-3.5 py-1.5 text-sm font-bold text-blue-700">
                  Stage 2
                </span>
              </div>
              <p className="mt-0.5 flex items-center gap-2 text-xs text-gray-500">
                <span className="font-bold text-gray-700">담당자: {profile?.manager ?? "김성실 매니저"}</span>
                <span className="h-2 w-px bg-gray-200" />
                <span>
                  현재 상태: <span className="font-bold text-blue-700">{resolveStatus(profile?.status)}</span>
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
              다음 액션 1순위 실행 <ArrowRightCircle size={14} />
            </button>
          </div>
        </div>

        {headerSummary ? (
          <div className="mt-3 rounded-xl border border-slate-700 bg-gradient-to-r from-slate-900 to-slate-800 px-3 py-2 text-white">
            <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold">
              <span className="rounded-md bg-white/15 px-2 py-1">분기/강도 기준 {strategyLabel(headerSummary)}</span>
              <span className="rounded-md bg-white/15 px-2 py-1">SLA {slaLabel(headerSummary)}</span>
              <span className="rounded-md bg-white/15 px-2 py-1">근거 품질 {headerSummary.qualityScore}%</span>
              <span className="rounded-md bg-white/15 px-2 py-1">누락 {headerSummary.missingCount}건</span>
              <span className="rounded-md bg-white/15 px-2 py-1">보완 필요 {headerSummary.warningCount}건</span>
            </div>
            <p className="mt-1 text-[11px] text-slate-200">
              최근 업데이트 {formatDateTime(headerSummary.lastUpdatedAt)} · 운영 참고: 분기/연계/후속조치는 담당자와 의료진 확인 후 확정합니다.
            </p>
          </div>
        ) : null}
      </div>

      <div className="flex-1 overflow-y-auto space-y-6 p-6">
        <Stage1OpsDetail
          caseRecord={profile}
          onHeaderSummaryChange={setHeaderSummary}
          onPrimaryActionChange={setPrimaryActionHandler}
          mode="stage2"
        />
      </div>
    </div>
  );
}

export function CaseDetailStage2SamplePage({ onBack }: { onBack: () => void }) {
  return <CaseDetailStage2 caseId="CASE-2026-002" onBack={onBack} />;
}
