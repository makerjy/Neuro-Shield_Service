import React, { useMemo, useState } from "react";
import { ChevronLeft, Activity } from "lucide-react";
import { Stage1OpsDetail, type Stage1HeaderSummary } from "../v2/stage1/Stage1OpsDetail";
import { getCaseRecordById, maskPhone, toAgeBand, type CaseRecord } from "../v2/caseRecords";
import { toCaseDashboardRecord, useCaseEntity } from "../v2/caseSSOT";
import type { StageType } from "../v2/shared";
import { useStage3CaseView } from "../../../stores/caseStore";

interface StageMirrorDetailProps {
  caseId: string;
  stage: Extract<StageType, "Stage 2" | "Stage 3">;
  onBack: () => void;
  forceMode?: "stage2" | "stage3";
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

function stage3LoopStatusLabel(status?: "IN_PROGRESS" | "ON_HOLD" | "EXCLUDED" | "DONE") {
  if (!status) return "-";
  if (status === "IN_PROGRESS") return "추적중";
  if (status === "ON_HOLD") return "보류";
  if (status === "EXCLUDED") return "제외";
  return "종결";
}

function stage3DiffPathLabel(status?: string) {
  if (!status) return "-";
  if (status === "NONE") return "없음";
  if (status === "RECOMMENDED") return "권고";
  if (status === "REFERRED") return "의뢰";
  if (status === "SCHEDULED") return "예약";
  if (status === "COMPLETED") return "완료";
  return status;
}

function stage2OpsStatusLabelFromStage3(status?: string) {
  if (!status) return "-";
  if (status === "TRACKING") return "진행중";
  if (status === "REEVAL_DUE") return "결과수신대기";
  if (status === "REEVAL_PENDING") return "대기";
  if (status === "LINKAGE_PENDING") return "진행중";
  if (status === "PLAN_NEEDS_UPDATE") return "보류";
  if (status === "CHURN_RISK") return "중단(거부)";
  return "판단완료";
}

function stage2DiagnosisStatusLabel(status?: string) {
  if (!status) return "-";
  if (status === "NOT_STARTED") return "대기";
  if (status === "IN_PROGRESS") return "진행중";
  if (status === "COMPLETED") return "완료";
  return status;
}

function summarizeMissingEvidence(missing?: string[]) {
  if (!missing || missing.length === 0) return "검사 입력 필요";
  const listed = missing.slice(0, 3).join(", ");
  if (missing.length <= 3) return listed;
  return `${listed} 외 ${missing.length - 3}건`;
}

export function StageMirrorDetail({ caseId, stage, onBack, forceMode }: StageMirrorDetailProps) {
  const ssotCase = useCaseEntity(caseId);
  const profile = useMemo(() => {
    if (ssotCase) return toCaseDashboardRecord(ssotCase);
    return getCaseRecordById(caseId);
  }, [caseId, ssotCase]);
  const [headerSummary, setHeaderSummary] = useState<Stage1HeaderSummary | null>(null);
  const isStage2 = stage === "Stage 2";
  const effectiveMode = forceMode ?? (isStage2 ? "stage2" : "stage3");
  const isStage3View = effectiveMode === "stage3";
  const isStage2OpsView = isStage2 && isStage3View;
  const stage3View = useStage3CaseView(isStage3View ? caseId : null);
  const stage3OriginResult = stage3View?.source.profile?.originStage2Result ?? headerSummary?.stage3Meta?.originStage2Result;
  const stage3Type =
    stage3View?.source.profile?.stage3Type ??
    headerSummary?.stage3Meta?.stage3Type ??
    (stage3OriginResult === "AD" ? "AD_MANAGEMENT" : "PREVENTIVE_TRACKING");
  const phoneLabel = profile?.profile.phone ?? ssotCase?.patient.phone ?? "-";
  const subjectName = profile?.profile.name ?? ssotCase?.patient.name ?? "이름 미확인";
  const subjectAge = profile?.profile.age ?? ssotCase?.patient.age;
  const subjectTitle = isStage3View ? subjectName : caseId;
  const assigneeName = profile?.manager ?? ssotCase?.assigneeId ?? "박종덕 매니저";
  const identityLine =
    profile
      ? isStage3View
        ? `이름 ${subjectName} · 연령 ${subjectAge ?? "-"}세 · 연락처 ${phoneLabel}`
        : `연령대 ${toAgeBand(profile.profile.age)} · 연락처 ${isStage2 ? phoneLabel : maskPhone(profile.profile.phone)} · 케이스키 ${profile.id}`
      : ssotCase
        ? isStage3View
          ? `이름 ${subjectName} · 연령 ${subjectAge ?? "-"}세 · 연락처 ${phoneLabel}`
          : `연령대 ${toAgeBand(ssotCase.patient.age)} · 연락처 ${isStage2 ? phoneLabel : maskPhone(phoneLabel)} · 케이스키 ${ssotCase.caseId}`
      : isStage3View
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
                <span className="font-bold text-gray-700">담당자: {assigneeName}</span>
                <span className="h-2 w-px bg-gray-200" />
                <span>
                  현재 상태:{" "}
                  <span className="font-bold text-blue-700">
                    {isStage2OpsView
                      ? stage2OpsStatusLabelFromStage3(headerSummary?.stage3Meta?.opsStatus)
                      : isStage3View
                      ? stage3View
                        ? stage3LoopStatusLabel(stage3View.source.loop.status)
                        : headerSummary?.stage3Meta
                        ? stage3StatusLabel(headerSummary.stage3Meta.opsStatus)
                        : resolveStatus(profile)
                      : isStage2
                        ? stage2DiagnosisStatusLabel(headerSummary?.stage2Meta?.diagnosisStatus)
                        : resolveStatus(profile)}
                  </span>
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
          </div>
        </div>

        {headerSummary ? (
          <div className="mt-3 rounded-xl border border-slate-700 bg-gradient-to-r from-slate-900 to-slate-800 px-3 py-2 text-white">
            {isStage2OpsView && headerSummary.stage2Meta ? (
              <>
                <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold">
                  <span className="rounded-md bg-white/15 px-2 py-1" title="정상/MCI/치매 분류 결과 라벨입니다.">
                    분류 결과 {headerSummary.stage2Meta.classificationLabel}
                    {headerSummary.stage2Meta.classificationLabel === "MCI" && headerSummary.stage2Meta.mciStage
                      ? `(${headerSummary.stage2Meta.mciStage === "적정" ? "중등" : headerSummary.stage2Meta.mciStage})`
                      : ""}
                  </span>
                  <span className="rounded-md bg-white/15 px-2 py-1" title="Stage2 진단 진행 상태입니다.">
                    2차 진단 상태 {stage2DiagnosisStatusLabel(headerSummary.stage2Meta.diagnosisStatus)}
                  </span>
                  <span className="rounded-md bg-white/15 px-2 py-1" title="필수 검사 항목 기준 검사 완료 비율입니다.">
                    검사 완료율 {headerSummary.stage2Meta.completionPct}%
                  </span>
                  <span className="rounded-md bg-white/15 px-2 py-1" title="분류 확정 필수 입력 충족도를 나타냅니다.">
                    필수자료 충족도 {headerSummary.stage2Meta.requiredDataPct}%
                  </span>
                  <span className="rounded-md bg-white/15 px-2 py-1" title="다음 진단 일정 또는 결과 수신 목표일입니다.">
                    다음 진단 일정 {formatDateTime(headerSummary.stage2Meta.targetAt)}
                  </span>
                  <span className="rounded-md bg-white/15 px-2 py-1" title="데이터 품질 및 누락 건수 요약입니다.">
                    데이터 품질 {headerSummary.qualityScore}% · 누락 {headerSummary.missingCount}건
                  </span>
                  {headerSummary.stage2Meta.modelAvailable === false ? (
                    <span className="rounded-md bg-amber-100/90 px-2 py-1 text-amber-950" title="검사 결과 입력 후에만 모델 결과를 확인할 수 있습니다.">
                      결과 대기 · {summarizeMissingEvidence(headerSummary.stage2Meta.missingEvidence)}
                    </span>
                  ) : null}
                </div>
                <p className="mt-1 text-[11px] text-slate-200">
                  운영 참고: 진단 진행/지연 신호는 운영 정렬용이며 예약/의뢰/분류 확정은 담당자·의료진 확인 후 진행합니다.
                </p>
                <details className="mt-1 text-[10px] text-slate-300">
                  <summary className="cursor-pointer">더보기</summary>
                  <p className="mt-1">
                    Stage2 진입일 {formatDateTime(headerSummary.stage2Meta.enteredAt)} · 목표 완료일 {formatDateTime(headerSummary.stage2Meta.targetAt)} ·
                    지연 {headerSummary.stage2Meta.delayDays}일 · 다음 작업 {headerSummary.stage2Meta.nextActionLabel} ·
                    최근 업데이트 {formatDateTime(headerSummary.lastUpdatedAt)}
                  </p>
                </details>
              </>
            ) : isStage3View && headerSummary.stage3Meta ? (
              <>
                <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold">
                  <span
                    className="rounded-md bg-white/15 px-2 py-1"
                    title={
                      stage3Type === "AD_MANAGEMENT"
                        ? "현재 위험지수의 운영 참고 지표입니다."
                        : "2년 내 AD 전환 위험의 운영 참고 지표입니다."
                    }
                  >
                    {stage3View?.display.riskBadge.kind === "ready"
                      ? stage3View.display.riskBadge.label
                      : stage3Type === "AD_MANAGEMENT"
                        ? `현재 위험지수 ${headerSummary.stage3Meta.modelAvailable && headerSummary.stage3Meta.risk2yNowPct != null
                            ? `${headerSummary.stage3Meta.risk2yNowPct}% (${headerSummary.stage3Meta.risk2yLabel ?? "-"})`
                            : "결과대기"}`
                        : `2년 전환위험 ${headerSummary.stage3Meta.modelAvailable && headerSummary.stage3Meta.risk2yNowPct != null
                            ? `${headerSummary.stage3Meta.risk2yNowPct}% (${headerSummary.stage3Meta.risk2yLabel ?? "-"})`
                            : "결과대기"}`}
                  </span>
                  <span className="rounded-md bg-white/15 px-2 py-1" title="Stage2 결과 기반 Stage3 운영 유형입니다.">
                    유형 {stage3Type === "AD_MANAGEMENT" ? "AD관리" : "예방추적"}
                  </span>
                  {headerSummary.stage3Meta.originStage2Result ? (
                    <span className="rounded-md bg-white/15 px-2 py-1" title="Stage3 생성 시의 Stage2 분류 결과입니다.">
                      Stage2 결과 {headerSummary.stage3Meta.originStage2Result}
                    </span>
                  ) : null}
                  <span className="rounded-md bg-white/15 px-2 py-1" title="재평가 일정 기준일입니다.">
                    다음 재평가 {formatDateTime(headerSummary.stage3Meta.nextReevalAt)}
                  </span>
                  <span className="rounded-md bg-white/15 px-2 py-1" title="감별검사/뇌영상 진행 상태입니다.">
                    감별경로 {stage3DiffPathLabel(headerSummary.stage3Meta.diffPathStatus)}
                  </span>
                  <span className="rounded-md bg-white/15 px-2 py-1" title="정밀관리 플랜 상태입니다.">
                    플랜 {headerSummary.stage3Meta.planStatus}
                  </span>
                  <span className="rounded-md bg-white/15 px-2 py-1" title="이탈 위험 신호 수준입니다.">
                    이탈 위험 {headerSummary.stage3Meta.churnRisk}
                  </span>
                  <span className="rounded-md bg-white/15 px-2 py-1" title="데이터 품질/누락 요약입니다.">
                    품질 {headerSummary.qualityScore}% · 누락 {headerSummary.missingCount}건
                  </span>
                  {headerSummary.stage3Meta.modelAvailable === false ? (
                    <span className="rounded-md bg-amber-100/90 px-2 py-1 text-amber-950" title="검사 결과 입력 후에만 모델 결과를 확인할 수 있습니다.">
                      결과 대기 · {summarizeMissingEvidence(headerSummary.stage3Meta.missingEvidence)}
                    </span>
                  ) : null}
                </div>
                <p className="mt-1 text-[11px] text-slate-200">
                  운영 참고: {stage3Type === "AD_MANAGEMENT"
                    ? "현재 위험지수는 관리 우선순위 정렬용이며 실행은 담당자 검토 후 진행합니다."
                    : "전환 위험 신호는 정렬용이며 재평가/플랜/연계 실행은 담당자 검토 후 진행합니다."}
                </p>
                <details className="mt-1 text-[10px] text-slate-300">
                  <summary className="cursor-pointer">더보기</summary>
                  {headerSummary.stage3Meta.modelAvailable ? (
                    <p className="mt-1">
                      최근 업데이트 {formatDateTime(headerSummary.lastUpdatedAt)} · 예측 업데이트 {formatDateTime(headerSummary.stage3Meta.riskUpdatedAt)} ·
                      추세 {headerSummary.stage3Meta.trend} · 모델 {headerSummary.stage3Meta.modelVersion} · 추적 주기
                      {headerSummary.stage3Meta.trackingCycleDays}일 · 다음 추적 접촉
                      {formatDateTime(headerSummary.stage3Meta.nextTrackingContactAt)}
                    </p>
                  ) : (
                    <p className="mt-1">
                      최근 업데이트 {formatDateTime(headerSummary.lastUpdatedAt)} · 모델 결과는 검사결과 입력 후 확인 가능합니다.
                    </p>
                  )}
                </details>
              </>
            ) : isStage2 && headerSummary.stage2Meta ? (
              <>
                <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold">
                  <span className="rounded-md bg-white/15 px-2 py-1">
                    Stage2 진단 상태 {stage2DiagnosisStatusLabel(headerSummary.stage2Meta.diagnosisStatus)}
                  </span>
                  <span className="rounded-md bg-white/15 px-2 py-1">
                    검사 완료율 {headerSummary.stage2Meta.completionPct}% (완료 {headerSummary.stage2Meta.completedCount}건)
                  </span>
                  <span className="rounded-md bg-white/15 px-2 py-1">
                    분류 결과 {headerSummary.stage2Meta.classificationLabel}
                    {headerSummary.stage2Meta.classificationLabel === "MCI" && headerSummary.stage2Meta.mciStage
                      ? `(${headerSummary.stage2Meta.mciStage})`
                      : ""}
                  </span>
                  <span className="rounded-md bg-white/15 px-2 py-1">
                    MCI 세분화 {headerSummary.stage2Meta.mciStage ?? "-"}
                  </span>
                  <span className="rounded-md bg-white/15 px-2 py-1">
                    Stage3 진입 필요 {headerSummary.stage2Meta.stage3EntryNeeded ? "TRUE" : "FALSE"}
                  </span>
                  <span className="rounded-md bg-white/15 px-2 py-1">데이터 품질 {headerSummary.qualityScore}%</span>
                  <span className="rounded-md bg-white/15 px-2 py-1">누락 {headerSummary.missingCount}건</span>
                  <span className="rounded-md bg-white/15 px-2 py-1">최근 업데이트 {formatDateTime(headerSummary.lastUpdatedAt)}</span>
                  {headerSummary.stage2Meta.modelAvailable === false ? (
                    <span className="rounded-md bg-amber-100/90 px-2 py-1 text-amber-950" title="검사 결과 입력 후에만 모델 결과를 확인할 수 있습니다.">
                      결과 대기 · {summarizeMissingEvidence(headerSummary.stage2Meta.missingEvidence)}
                    </span>
                  ) : null}
                </div>
                <p className="mt-1 text-[11px] text-slate-200">
                  Stage2 진입일 {formatDateTime(headerSummary.stage2Meta.enteredAt)} · 목표 완료일 {formatDateTime(headerSummary.stage2Meta.targetAt)} · 지연 {headerSummary.stage2Meta.delayDays}일 · 다음 액션 {headerSummary.stage2Meta.nextActionLabel}
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
          caseId={caseId}
          caseRecord={profile}
          onHeaderSummaryChange={setHeaderSummary}
          mode={effectiveMode}
          surfaceStage={stage}
        />
      </div>
    </div>
  );
}
