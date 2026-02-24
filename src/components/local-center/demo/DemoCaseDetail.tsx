import React, { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ArrowUpRight, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { ModelJobProgressCard } from "../../ModelJobProgressCard";
import {
  getCaseDetail,
  instantCompleteLatestJob,
  promoteToStage2,
  promoteToStage3,
  runStage1Model,
  runStage2Model,
  runStage3Model,
  submitStage2Labs,
} from "../../../demo/api";
import { DemoPanel } from "../../../demo/demoPanel";
import { useDemoStoreVersion } from "../../../demo/store";
import type { Case, ModelJob, TimelineEvent } from "../../../demo/seed";

interface DemoCaseDetailProps {
  caseId: string;
  onBack: () => void;
}

type CaseDetailPayload = Awaited<ReturnType<typeof getCaseDetail>>;

function stageLabel(stage: Case["currentStage"]) {
  if (stage === "STAGE1") return "Stage 1";
  if (stage === "STAGE2") return "Stage 2";
  return "Stage 3";
}

function modelStage(stage: Case["currentStage"]): ModelJob["stage"] {
  if (stage === "STAGE1") return "STAGE1";
  if (stage === "STAGE2") return "STAGE2";
  return "STAGE3";
}

function formatDateTime(iso?: string) {
  if (!iso) return "-";
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return iso;
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")} ${String(
    dt.getHours(),
  ).padStart(2, "0")}:${String(dt.getMinutes()).padStart(2, "0")}`;
}

function toPercent(value: number) {
  return `${Math.round(value * 100)}%`;
}

function ageBandFromBirthYear(birthYear: number) {
  const currentYear = new Date().getFullYear();
  const age = currentYear - birthYear;
  const floor = Math.floor(age / 10) * 10;
  return `${floor}대`;
}

function timelineTone(type: TimelineEvent["type"]) {
  if (type.includes("DONE")) return "text-success bg-success/10 border-success/30";
  if (type.includes("REQUESTED")) return "text-primary bg-accent border-primary/30";
  if (type.includes("PROMOTED")) return "text-primary bg-accent border-primary/30";
  return "text-muted-foreground bg-muted border-border";
}

export function DemoCaseDetail({ caseId, onBack }: DemoCaseDetailProps) {
  const version = useDemoStoreVersion();
  const [payload, setPayload] = useState<CaseDetailPayload>(null);
  const [loading, setLoading] = useState(true);
  const [pendingAction, setPendingAction] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    getCaseDetail(caseId)
      .then((result) => {
        if (!alive) return;
        setPayload(result);
      })
      .finally(() => {
        if (!alive) return;
        setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [caseId, version]);

  const detail = payload;
  const currentCase = detail?.case;
  const person = detail?.person;
  const latestJob = detail?.latestJob ?? null;
  const stage = currentCase?.currentStage;
  const stageJob = stage ? modelStage(stage) : null;
  const runningCurrentStage =
    stageJob && latestJob && latestJob.stage === stageJob && (latestJob.status === "RUNNING" || latestJob.status === "QUEUED");

  const execute = async (key: string, action: () => Promise<unknown>, successMessage?: string) => {
    setPendingAction(key);
    try {
      await action();
      if (successMessage) toast.success(successMessage);
    } catch (error) {
      const message = error instanceof Error ? error.message : "처리에 실패했습니다.";
      toast.error(message);
    } finally {
      setPendingAction(null);
    }
  };

  const canRunStage1 = stage === "STAGE1" && !runningCurrentStage;
  const canPromoteStage2 = stage === "STAGE1" && currentCase.stage1.status === "DONE" && !runningCurrentStage;
  const canReceiveLabs = stage === "STAGE2" && !runningCurrentStage;
  const canRunStage2 = stage === "STAGE2" && Boolean(currentCase.stage2.labs) && !runningCurrentStage;
  const canPromoteStage3 = stage === "STAGE2" && currentCase.stage2.status === "DONE" && !runningCurrentStage;
  const canRunStage3 =
    stage === "STAGE3" &&
    currentCase.stage2.classification?.label === "MCI_HIGH" &&
    !runningCurrentStage;

  const loopStep = useMemo(() => {
    if (!currentCase) return 0;
    if (currentCase.currentStage === "STAGE1") return currentCase.ops.loopStep.stage1Step;
    if (currentCase.currentStage === "STAGE2") return currentCase.ops.loopStep.stage2Step;
    return currentCase.ops.loopStep.stage3Step;
  }, [currentCase]);

  if (loading || !currentCase || !person || !stage || !stageJob) {
    return (
      <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <div className="h-5 w-64 animate-pulse rounded bg-muted" />
        <div className="mt-3 h-20 animate-pulse rounded bg-muted" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <DemoPanel />

      <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <button
              type="button"
              className="rounded-full border border-border p-2 text-muted-foreground hover:bg-muted"
              onClick={onBack}
            >
              <ChevronLeft size={18} />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-foreground">{currentCase.caseId}</h2>
                <span className="rounded-md border border-primary/30 bg-accent px-2 py-1 text-xs font-bold text-primary">
                  {stageLabel(stage)}
                </span>
                {runningCurrentStage ? (
                  <span className="rounded-md border border-warning/30 bg-warning/10 px-2 py-1 text-xs font-semibold text-warning">
                    모델 산출 중
                  </span>
                ) : null}
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {person.name} · {person.sex} · {ageBandFromBirthYear(person.birthYear)} · {person.region.sido} {person.region.sigungu} ·{" "}
                {person.phoneMasked}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                운영 Loop Step {loopStep} · Contact Priority {currentCase.ops.contactPriority}
              </p>
            </div>
          </div>
          <div className="rounded-lg border border-border bg-muted px-3 py-2 text-right">
            <p className="text-[11px] font-semibold text-muted-foreground">마지막 업데이트</p>
            <p className="text-xs font-bold text-foreground">{formatDateTime(currentCase.updatedAt)}</p>
          </div>
        </div>

        <ModelJobProgressCard
          job={latestJob && latestJob.stage === stageJob ? latestJob : null}
          showIdle={false}
          showDevTools
          onInstantComplete={() => instantCompleteLatestJob(currentCase.caseId, stageJob)}
        />
      </div>

      {stage === "STAGE1" ? (
        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-base font-bold text-foreground">Stage1 ML 선별 결과</h3>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="rounded-md border border-primary/30 bg-accent px-3 py-1.5 text-sm font-semibold text-primary disabled:opacity-50"
                disabled={!canRunStage1 || pendingAction !== null}
                onClick={() => execute("run-stage1", () => runStage1Model(currentCase.caseId), "Stage1 모델 실행을 시작했습니다.")}
              >
                {pendingAction === "run-stage1" ? "요청 중..." : "Stage1 모델 실행"}
              </button>
              <button
                type="button"
                className="rounded-md border border-primary/30 bg-accent px-3 py-1.5 text-sm font-semibold text-primary disabled:opacity-50"
                disabled={!canPromoteStage2 || pendingAction !== null}
                onClick={() => execute("promote-2", () => promoteToStage2(currentCase.caseId), "Stage2로 상승했습니다.")}
              >
                Stage2로 상승(추가검사 의뢰)
              </button>
            </div>
          </div>

          <div
            className={`rounded-xl border border-border p-4 transition-all duration-300 ease-out ${
              runningCurrentStage ? "opacity-60 blur-[1px]" : "opacity-100 translate-y-0"
            }`}
          >
            {currentCase.stage1.status === "DONE" ? (
              <>
                <p className="text-sm text-foreground">
                  Risk Score <span className="font-bold">{currentCase.stage1.riskScore}</span> / 밴드{" "}
                  <span className="font-bold">{currentCase.stage1.riskBand}</span>
                </p>
                <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-foreground">
                  {currentCase.stage1.keyFactors?.map((factor) => <li key={factor}>{factor}</li>)}
                </ul>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Stage1 결과가 아직 없습니다. 모델 실행 후 위험 신호가 표시됩니다.</p>
            )}
          </div>
        </div>
      ) : null}

      {stage === "STAGE2" ? (
        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-base font-bold text-foreground">Stage2 추가검사 + 3중 분류(High-MCI)</h3>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="rounded-md border border-border bg-card px-3 py-1.5 text-sm font-semibold text-foreground disabled:opacity-50"
                disabled={!canReceiveLabs || pendingAction !== null}
                onClick={() =>
                  execute("labs", () => submitStage2Labs(currentCase.caseId), "검사결과 수신 처리가 완료되었습니다.")
                }
              >
                검사결과 수신 처리
              </button>
              <button
                type="button"
                className="rounded-md border border-primary/30 bg-accent px-3 py-1.5 text-sm font-semibold text-primary disabled:opacity-50"
                disabled={!canRunStage2 || pendingAction !== null}
                onClick={() => execute("run-stage2", () => runStage2Model(currentCase.caseId), "Stage2 모델 실행을 시작했습니다.")}
              >
                Stage2 모델 실행(3중 분류)
              </button>
              <button
                type="button"
                className="rounded-md border border-primary/30 bg-accent px-3 py-1.5 text-sm font-semibold text-primary disabled:opacity-50"
                disabled={!canPromoteStage3 || pendingAction !== null}
                onClick={() => execute("promote-3", () => promoteToStage3(currentCase.caseId), "Stage3로 상승했습니다.")}
              >
                Stage3로 상승(추가관리)
              </button>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-xl border border-border p-4">
              <p className="text-xs font-semibold text-muted-foreground">검사결과</p>
              {currentCase.stage2.labs ? (
                <div className="mt-2 space-y-2 text-sm text-foreground">
                  <p>인지: MMSE {currentCase.stage2.labs.cognition?.MMSE}, MoCA {currentCase.stage2.labs.cognition?.MoCA}</p>
                  <p>혈액: HbA1c {currentCase.stage2.labs.blood?.HbA1c}, LDL {currentCase.stage2.labs.blood?.LDL}</p>
                  <p>바이오마커: pTau {currentCase.stage2.labs.biomarker?.pTau}</p>
                  <p className="text-xs text-muted-foreground">수신 시각 {formatDateTime(currentCase.stage2.labs.receivedAt)}</p>
                </div>
              ) : (
                <p className="mt-2 text-sm text-warning">검사결과 수신 후 실행 가능</p>
              )}
            </div>

            <div
              className={`rounded-xl border border-border p-4 transition-all duration-300 ease-out ${
                runningCurrentStage ? "opacity-60 blur-[1px]" : "opacity-100 translate-y-0"
              }`}
            >
              <p className="text-xs font-semibold text-muted-foreground">3중 분류 결과</p>
              {currentCase.stage2.classification ? (
                <div className="mt-2 space-y-2 text-sm text-foreground">
                  <p>
                    Label <span className="font-bold text-destructive">{currentCase.stage2.classification.label}</span>
                  </p>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {Object.entries(currentCase.stage2.classification.probs).map(([key, value]) => (
                      <div key={key} className="rounded border border-border bg-muted px-2 py-1">
                        {key}: <span className="font-semibold">{toPercent(value)}</span>
                      </div>
                    ))}
                  </div>
                  <ul className="list-disc space-y-1 pl-5 text-xs">
                    {currentCase.stage2.classification.reasons?.map((reason) => <li key={reason}>{reason}</li>)}
                  </ul>
                </div>
              ) : (
                <p className="mt-2 text-sm text-muted-foreground">검사결과 수신 후 모델 실행 시 분류 결과가 표시됩니다.</p>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {stage === "STAGE3" ? (
        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-base font-bold text-foreground">Stage3 추가관리 + 2년 전환위험</h3>
            <button
              type="button"
              className="rounded-md border border-primary/30 bg-accent px-3 py-1.5 text-sm font-semibold text-primary disabled:opacity-50"
              disabled={!canRunStage3 || pendingAction !== null}
              onClick={() => execute("run-stage3", () => runStage3Model(currentCase.caseId), "Stage3 모델 실행을 시작했습니다.")}
            >
              Stage3 모델 실행(멀티모달)
            </button>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-xl border border-border p-4">
              <p className="text-xs font-semibold text-muted-foreground">입력 신호</p>
              <div className="mt-2 space-y-1 text-sm text-foreground">
                <p>ANN Features: {currentCase.stage3.inputs?.annFeaturesReady ? "READY" : "NOT_READY"}</p>
                <p>MRI CNN Score: {currentCase.stage3.inputs?.cnnMriScore ?? "-"}</p>
              </div>
            </div>

            <div
              className={`rounded-xl border border-border p-4 transition-all duration-300 ease-out ${
                runningCurrentStage ? "opacity-60 blur-[1px]" : "opacity-100 translate-y-0"
              }`}
            >
              <p className="text-xs font-semibold text-muted-foreground">2년 내 AD 전환 위험(1년 단위)</p>
              {currentCase.stage3.conversionRisk ? (
                <div className="mt-2 space-y-2">
                  {currentCase.stage3.conversionRisk.yearly.map((point) => (
                    <div key={point.year}>
                      <div className="mb-1 flex items-center justify-between text-xs">
                        <span>Year {point.year}</span>
                        <span className="font-semibold">{toPercent(point.prob)}</span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                        <div className="h-full rounded-full bg-chart-2" style={{ width: `${Math.round(point.prob * 100)}%` }} />
                      </div>
                    </div>
                  ))}
                  <p className="text-xs text-muted-foreground">
                    업데이트 {formatDateTime(currentCase.stage3.conversionRisk.updatedAt)}
                  </p>
                </div>
              ) : (
                <p className="mt-2 text-sm text-muted-foreground">모델 실행 후 전환 위험(Year 1, Year 2)이 표시됩니다.</p>
              )}
            </div>
          </div>

          <div
            className={`mt-4 rounded-xl border border-border p-4 transition-all duration-300 ease-out ${
              runningCurrentStage ? "opacity-60 blur-[1px]" : "opacity-100 translate-y-0"
            }`}
          >
            <p className="mb-2 text-xs font-semibold text-muted-foreground">조치 계획 (Care Plan)</p>
            {currentCase.stage3.carePlan && currentCase.stage3.carePlan.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] border-collapse text-sm">
                  <thead className="bg-muted text-xs font-semibold text-muted-foreground">
                    <tr>
                      <th className="px-2 py-2 text-left">조치</th>
                      <th className="px-2 py-2 text-left">담당</th>
                      <th className="px-2 py-2 text-left">기한</th>
                      <th className="px-2 py-2 text-left">상태</th>
                    </tr>
                  </thead>
                  <tbody>
                    {currentCase.stage3.carePlan.map((plan, index) => (
                      <tr key={`${plan.title}-${index}`} className="border-t border-border">
                        <td className="px-2 py-2 text-foreground">{plan.title}</td>
                        <td className="px-2 py-2 text-foreground">{plan.owner}</td>
                        <td className="px-2 py-2 text-foreground">{formatDateTime(plan.dueAt)}</td>
                        <td className="px-2 py-2">
                          <span className="rounded border border-border bg-muted px-1.5 py-0.5 text-xs font-semibold text-muted-foreground">
                            {plan.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">모델 완료 후 조치 계획이 자동 생성됩니다.</p>
            )}
          </div>
        </div>
      ) : null}

      <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <h3 className="mb-3 text-base font-bold text-foreground">Case Timeline</h3>
        <div className="space-y-2">
          {detail.timeline.length === 0 ? <p className="text-sm text-muted-foreground">이력 없음</p> : null}
          {detail.timeline.map((event) => (
            <div key={`${event.ts}-${event.type}`} className="flex items-start gap-2 rounded-lg border border-border p-2">
              <span className={`rounded border px-1.5 py-0.5 text-[10px] font-semibold ${timelineTone(event.type)}`}>{event.type}</span>
              <div className="min-w-0 flex-1">
                <p className="text-sm text-foreground">{event.summary}</p>
                <p className="text-[11px] text-muted-foreground">{formatDateTime(event.ts)}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {latestJob?.status === "FAILED" ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          <div className="flex items-center gap-2">
            <AlertCircle size={16} />
            모델 실행 실패가 감지되었습니다. 데모에서는 재실행 버튼으로 복구할 수 있습니다.
          </div>
        </div>
      ) : null}

      <div className="rounded-xl border border-border bg-muted p-3 text-xs text-muted-foreground">
        <div className="flex items-center gap-1">
          <ArrowUpRight size={12} />
          Stage 상승 시 이전 Stage 리스트에서는 즉시 제외되고, 다음 Stage 리스트에서 즉시 조회됩니다.
        </div>
      </div>
    </div>
  );
}
