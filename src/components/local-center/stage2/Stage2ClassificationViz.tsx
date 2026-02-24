import React, { useMemo } from "react";
import { cn } from "../v2/shared";

type Stage2Probabilities = {
  NORMAL?: number;
  MCI?: number;
  AD?: number;
};

type MciSeverity = "양호" | "적정" | "위험" | undefined;

interface Stage2ClassificationVizProps {
  probs?: Stage2Probabilities;
  predictedLabel?: "정상" | "MCI" | "치매";
  mciSeverity?: MciSeverity;
  mciScore?: number;
}

function toPercent(value?: number): number {
  if (value == null || Number.isNaN(value)) return 0;
  const scaled = value <= 1 ? value * 100 : value;
  return Math.max(0, Math.min(100, Math.round(scaled)));
}

function normalizeProbabilities(probs?: Stage2Probabilities) {
  const raw = {
    NORMAL: toPercent(probs?.NORMAL),
    MCI: toPercent(probs?.MCI),
    AD: toPercent(probs?.AD),
  };
  const sum = raw.NORMAL + raw.MCI + raw.AD;
  if (sum <= 0) {
    return {
      NORMAL: 0,
      MCI: 0,
      AD: 0,
      hasData: false,
    };
  }
  return {
    NORMAL: Math.round((raw.NORMAL / sum) * 100),
    MCI: Math.round((raw.MCI / sum) * 100),
    AD: Math.round((raw.AD / sum) * 100),
    hasData: true,
  };
}

function mciBand(score: number): "양호" | "중간" | "위험" {
  if (score < 40) return "양호";
  if (score < 70) return "중간";
  return "위험";
}

function severityToScore(severity?: MciSeverity): number {
  if (severity === "위험") return 82;
  if (severity === "양호") return 34;
  return 58;
}

function severityToLabel(severity?: MciSeverity): "양호" | "중간" | "위험" {
  if (severity === "위험") return "위험";
  if (severity === "양호") return "양호";
  return "중간";
}

export function Stage2ClassificationViz({ probs, predictedLabel, mciSeverity, mciScore }: Stage2ClassificationVizProps) {
  const normalized = useMemo(() => normalizeProbabilities(probs), [probs]);

  const segments = [
    { key: "NORMAL", label: "NORMAL", value: normalized.NORMAL, fill: "var(--risk-low)", textColor: "var(--risk-low)" },
    { key: "MCI", label: "MCI", value: normalized.MCI, fill: "var(--chart-2)", textColor: "var(--chart-2)" },
    { key: "AD", label: "AD", value: normalized.AD, fill: "var(--risk-high)", textColor: "var(--risk-high)" },
  ] as const;

  const maxSegment = segments.reduce((acc, cur) => (cur.value > acc.value ? cur : acc), segments[0]);
  const predictedKey = predictedLabel === "정상" ? "NORMAL" : predictedLabel === "치매" ? "AD" : predictedLabel === "MCI" ? "MCI" : undefined;

  const resolvedMciScore = Math.max(0, Math.min(100, Math.round(mciScore ?? severityToScore(mciSeverity))));
  const mciLabel = mciBand(resolvedMciScore);
  const mciSeverityLabel = severityToLabel(mciSeverity);
  const showMciGauge = predictedLabel === "MCI";

  return (
    <section className="rounded-xl border border-border bg-card p-4 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-sm font-bold text-foreground">Stage2 분류 확률 시각화</h4>
        <span
          className="rounded-full border border-border bg-card px-2 py-0.5 text-[11px] font-semibold text-muted-foreground"
          title="검사 기반 분류 확률입니다. 운영 참고용입니다."
        >
          모델 분류 결과(운영 참고)
        </span>
      </div>

      {!normalized.hasData ? (
        <p className="mt-3 rounded-md border border-border bg-card px-3 py-2 text-[11px] text-muted-foreground">분류 확률 데이터가 없습니다.</p>
      ) : (
        <>
          <div className="mt-3 overflow-hidden rounded-lg border border-border bg-card">
            <div className="flex h-10 w-full">
              {segments.map((seg) => {
                const width = `${seg.value}%`;
                const isMax = seg.key === maxSegment.key;
                const isPredicted = predictedKey === seg.key;
                return (
                  <div
                    key={seg.key}
                    title={`${seg.label}: ${seg.value}%`}
                    className={cn(
                      "relative flex min-w-0 items-center justify-center px-1 text-[11px] font-bold text-white",
                      isMax && "ring-2 ring-card/80",
                      isPredicted && "outline outline-2 outline-foreground/60 outline-offset-[-2px]",
                    )}
                    style={{ width, backgroundColor: seg.fill }}
                  >
                    {seg.value >= 9 ? `${seg.label} ${seg.value}%` : `${seg.value}%`}
                    {isMax ? (
                      <span className="absolute right-1 top-1 rounded bg-card/85 px-1 py-[1px] text-[9px] font-bold text-foreground">
                        최대 확률
                      </span>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-2 flex flex-wrap gap-2">
            {segments.map((seg) => (
              <span
                key={`legend-${seg.key}`}
                className="rounded border border-border bg-card px-2 py-1 text-[11px] font-semibold"
                style={{ color: seg.textColor }}
              >
                {seg.label} {seg.value}%
              </span>
            ))}
          </div>
        </>
      )}

      {showMciGauge ? (
        <div className="mt-4 rounded-lg border border-border bg-muted p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-semibold text-foreground">MCI 세분화 게이지 (ANN)</p>
            <span
              className="rounded-full border border-border bg-card px-2 py-0.5 text-[10px] font-semibold text-primary"
              title="양호: 추적 중심, 중간: 인지/신체 통합 관리, 위험: 감별검사 권고 + 개입 상향"
            >
              현재 구간: {mciLabel}
            </span>
          </div>

          <div className="mt-2">
            <div
              className="relative h-3 rounded-full"
              style={{ background: "linear-gradient(to right, var(--risk-low), var(--risk-medium), var(--risk-high))" }}
            >
              <span
                className="absolute top-1/2 h-4 w-4 -translate-y-1/2 rounded-full border-2 border-card bg-foreground shadow"
                style={{ left: `calc(${resolvedMciScore}% - 8px)` }}
                aria-label={`MCI 점수 ${resolvedMciScore}`}
              />
            </div>
            <div className="mt-1 flex items-center justify-between text-[10px] text-muted-foreground">
              <span>0 (양호)</span>
              <span>40 (중간)</span>
              <span>70 (위험)</span>
              <span>100</span>
            </div>
            <p className="mt-1 text-[11px] font-semibold text-foreground">
              점수 {resolvedMciScore} · 세분화 {mciSeverityLabel}
            </p>
          </div>
        </div>
      ) : null}
    </section>
  );
}

export default Stage2ClassificationViz;
