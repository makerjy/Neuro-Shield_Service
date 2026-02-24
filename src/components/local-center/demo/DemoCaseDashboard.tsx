import React, { useEffect, useMemo, useState } from "react";
import { ArrowRight, BadgeCheck } from "lucide-react";
import type { StageType } from "../v2/shared";
import { DEMO_MODE, HERO_CASE_ID } from "../../../demo/demoConfig";
import { listCases } from "../../../demo/api";
import { useDemoStoreVersion } from "../../../demo/store";
import type { Case } from "../../../demo/seed";
import { DemoPanel } from "../../../demo/demoPanel";

type DemoStage = Case["currentStage"];
type CaseSummary = Awaited<ReturnType<typeof listCases>>[number];

interface DemoCaseDashboardProps {
  onSelectCase: (id: string, stage: StageType) => void;
}

const STAGE_TABS: Array<{ key: DemoStage; label: StageType }> = [
  { key: "STAGE1", label: "Stage 1" },
  { key: "STAGE2", label: "Stage 2" },
  { key: "STAGE3", label: "Stage 3" },
];

function toStageType(stage: DemoStage): StageType {
  if (stage === "STAGE1") return "Stage 1";
  if (stage === "STAGE2") return "Stage 2";
  return "Stage 3";
}

function ageBandFromBirthYear(birthYear: number) {
  const currentYear = new Date().getFullYear();
  const age = currentYear - birthYear;
  const band = Math.floor(age / 10) * 10;
  return `${band}대`;
}

function formatDateTime(iso: string) {
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return iso;
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")} ${String(
    dt.getHours(),
  ).padStart(2, "0")}:${String(dt.getMinutes()).padStart(2, "0")}`;
}

function stageSummary(item: CaseSummary) {
  if (item.case.currentStage === "STAGE1") {
    if (item.case.stage1.status === "DONE") return `Risk ${item.case.stage1.riskScore} (${item.case.stage1.riskBand})`;
    if (item.case.stage1.status === "IN_PROGRESS") return "Stage1 모델 실행 중";
    return "Stage1 모델 대기";
  }
  if (item.case.currentStage === "STAGE2") {
    if (item.case.stage2.status === "DONE") return `분류 ${item.case.stage2.classification?.label ?? "-"}`;
    if (item.case.stage2.status === "LABS_RECEIVED") return "검사결과 수신 완료";
    if (item.case.stage2.status === "MODEL_RUNNING") return "Stage2 모델 실행 중";
    return "검사결과 수신 대기";
  }
  if (item.case.stage3.status === "DONE") {
    const year2 = item.case.stage3.conversionRisk?.yearly.find((point) => point.year === 2)?.prob ?? 0;
    return `2년 전환위험 ${(year2 * 100).toFixed(0)}%`;
  }
  if (item.case.stage3.status === "MODEL_RUNNING") return "Stage3 모델 실행 중";
  return "Stage3 모델 대기";
}

function runningLabel(item: CaseSummary) {
  const job = item.latestJob;
  if (!job) return null;
  if (job.status !== "QUEUED" && job.status !== "RUNNING") return null;
  return `${job.stage} ${job.status}`;
}

export function DemoCaseDashboard({ onSelectCase }: DemoCaseDashboardProps) {
  const version = useDemoStoreVersion();
  const [activeStage, setActiveStage] = useState<DemoStage>("STAGE1");
  const [rows, setRows] = useState<CaseSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    if (!DEMO_MODE) return;

    setLoading(true);
    listCases(activeStage)
      .then((result) => {
        if (!alive) return;
        setRows(result);
      })
      .finally(() => {
        if (!alive) return;
        setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [activeStage, version]);

  const total = useMemo(() => rows.length, [rows.length]);

  return (
    <div className="space-y-4">
      <DemoPanel />

      <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-muted-foreground">Demo API</p>
            <h3 className="text-lg font-bold text-foreground">단일 MCI 케이스 Stage 연계 대시보드</h3>
          </div>
          <span className="rounded-md border border-border bg-muted px-2 py-1 text-xs font-semibold text-muted-foreground">
            {STAGE_TABS.find((tab) => tab.key === activeStage)?.label} · {total}건
          </span>
        </div>

        <div className="mb-4 flex flex-wrap gap-2">
          {STAGE_TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              className={`rounded-lg border px-3 py-1.5 text-sm font-semibold transition-colors ${
                activeStage === tab.key
                  ? "border-primary/30 bg-accent text-primary"
                  : "border-border bg-card text-muted-foreground hover:bg-muted"
              }`}
              onClick={() => setActiveStage(tab.key)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full min-w-[960px] border-collapse text-sm">
            <thead className="bg-muted text-xs font-semibold text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left">케이스</th>
                <th className="px-3 py-2 text-left">대상자</th>
                <th className="px-3 py-2 text-left">지역</th>
                <th className="px-3 py-2 text-left">상태 요약</th>
                <th className="px-3 py-2 text-left">진행 Step</th>
                <th className="px-3 py-2 text-left">업데이트</th>
                <th className="px-3 py-2 text-right">상세</th>
              </tr>
            </thead>
            <tbody>
              {!loading && rows.length === 0 ? (
                <tr>
                  <td className="px-3 py-4 text-center text-sm text-muted-foreground" colSpan={7}>
                    해당 Stage 케이스가 없습니다.
                  </td>
                </tr>
              ) : null}
              {loading
                ? [...new Array(3)].map((_, index) => (
                    <tr key={`skeleton-${index}`} className="border-t border-border">
                      <td className="px-3 py-3" colSpan={7}>
                        <div className="h-4 animate-pulse rounded bg-muted" />
                      </td>
                    </tr>
                  ))
                : rows.map((item) => {
                    const running = runningLabel(item);
                    const loopStep =
                      item.case.currentStage === "STAGE1"
                        ? item.case.ops.loopStep.stage1Step
                        : item.case.currentStage === "STAGE2"
                          ? item.case.ops.loopStep.stage2Step
                          : item.case.ops.loopStep.stage3Step;

                    return (
                      <tr
                        key={item.case.caseId}
                        className="cursor-pointer border-t border-border hover:bg-muted"
                        onClick={() => onSelectCase(item.case.caseId, toStageType(item.case.currentStage))}
                      >
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-semibold text-foreground">{item.case.caseId}</span>
                            {item.case.caseId === HERO_CASE_ID ? (
                              <span className="inline-flex items-center gap-1 rounded-md border border-primary/30 bg-accent px-1.5 py-0.5 text-[10px] font-bold text-primary">
                                <BadgeCheck size={12} />
                                HERO
                              </span>
                            ) : null}
                          </div>
                        </td>
                        <td className="px-3 py-3 text-foreground">
                          {item.person.name} · {item.person.sex} · {ageBandFromBirthYear(item.person.birthYear)}
                        </td>
                        <td className="px-3 py-3 text-foreground">
                          {item.person.region.sido} {item.person.region.sigungu}
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-foreground">{stageSummary(item)}</span>
                            {running ? (
                              <span className="rounded-md border border-warning/30 bg-warning/10 px-1.5 py-0.5 text-[10px] font-semibold text-warning">
                                {running}
                              </span>
                            ) : null}
                          </div>
                        </td>
                        <td className="px-3 py-3 text-foreground">Step {loopStep}</td>
                        <td className="px-3 py-3 text-muted-foreground">{formatDateTime(item.case.updatedAt)}</td>
                        <td className="px-3 py-3 text-right">
                          <button
                            type="button"
                            className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs font-semibold text-muted-foreground hover:bg-muted"
                            onClick={(event) => {
                              event.stopPropagation();
                              onSelectCase(item.case.caseId, toStageType(item.case.currentStage));
                            }}
                          >
                            보기 <ArrowRight size={12} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
