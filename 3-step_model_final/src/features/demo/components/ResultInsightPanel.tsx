import { useMemo } from "react";
import type { StageKey, StageResult, TrackingSeriesPoint } from "../types";

interface ResultInsightPanelProps {
  stage: StageKey;
  result?: StageResult;
}

function ContributionList({
  title,
  items,
}: {
  title: string;
  items: Array<{ feature: string; impact: number; note: string }>;
}) {
  return (
    <section className="insight-block">
      <h4>{title}</h4>
      <ul className="contrib-list">
        {items.map((item) => (
          <li key={item.feature}>
            <div className="contrib-row">
              <span>{item.feature}</span>
              <strong>{(item.impact * 100).toFixed(0)}%</strong>
            </div>
            <div className="contrib-track">
              <span className="contrib-fill" style={{ width: `${Math.min(100, item.impact * 100)}%` }} />
            </div>
            <p>{item.note}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Stage1ClassDistribution({
  probs,
  interest,
}: {
  probs: { normal: number; impairment: number; mci: number; dm: number };
  interest: string;
}) {
  const impairment = Math.min(1, Math.max(0, probs.impairment));
  const normal = Math.min(1, Math.max(0, probs.normal));
  const mci = Math.min(1, Math.max(0, probs.mci));
  const dm = Math.min(1, Math.max(0, probs.dm));
  const mciShareInImpairment = impairment > 0 ? mci / impairment : 0;
  const dmShareInImpairment = impairment > 0 ? dm / impairment : 0;
  const priorityOrder = ["agent우선", "상담사우선"] as const;

  return (
    <section className="insight-block">
      <h4>정상군/인지장애군 비율</h4>
      <ul className="probability-bars">
        <li className={`probability-row ${normal >= impairment ? "is-predicted" : ""}`}>
          <div className="probability-row-top">
            <span>정상군 비율</span>
            <strong>{(normal * 100).toFixed(1)}%</strong>
          </div>
          <div className="probability-track">
            <span className="probability-fill low" style={{ width: `${Math.min(100, normal * 100)}%` }} />
          </div>
        </li>
        <li className={`probability-row ${impairment > normal ? "is-predicted" : ""}`}>
          <div className="probability-row-top">
            <span>인지장애군 비율</span>
            <strong>{(impairment * 100).toFixed(1)}%</strong>
          </div>
          <div className="probability-track">
            <span className="probability-fill ad" style={{ width: `${Math.min(100, impairment * 100)}%` }} />
          </div>
        </li>
      </ul>

      <div className="prob-grid">
        <p>MCI 확률(전체) {(mci * 100).toFixed(1)}%</p>
        <p>DM 확률(전체) {(dm * 100).toFixed(1)}%</p>
        <p>인지장애군 내 MCI 비율 {(mciShareInImpairment * 100).toFixed(1)}%</p>
        <p>인지장애군 내 DM 비율 {(dmShareInImpairment * 100).toFixed(1)}%</p>
      </div>

      <div className="priority-lane">
        {priorityOrder.map((item) => (
          <span key={item} className={`priority-chip ${item === interest ? "is-active" : ""}`}>
            {item}
          </span>
        ))}
      </div>
    </section>
  );
}

function Stage1PriorityScore({
  scoring,
}: {
  scoring: {
    age: number;
    mciRisk: number;
    dmRisk: number;
    impairmentBoost: number;
    caregiver: number;
    total: number;
    threshold: number;
    caregiverAvailable: boolean;
    guardrailTriggered: boolean;
  };
}) {
  return (
    <section className="insight-block">
      <h4>상담 우선순위 스코어</h4>
      <div className="prob-grid">
        <p>나이 점수 {(scoring.age * 100).toFixed(1)}점</p>
        <p>MCI 위험도 점수 {(scoring.mciRisk * 100).toFixed(1)}점</p>
        <p>DM 위험도 점수 {(scoring.dmRisk * 100).toFixed(1)}점</p>
        <p>인지장애군 가중 보정 {(scoring.impairmentBoost * 100).toFixed(1)}점</p>
        <p>
          보호자 여부 점수 {(scoring.caregiver * 100).toFixed(1)}점 ({scoring.caregiverAvailable ? "보호자 있음" : "보호자 없음"})
        </p>
        <p>
          총점 {(scoring.total * 100).toFixed(1)}점 / 임계값 {(scoring.threshold * 100).toFixed(0)}점
          {scoring.guardrailTriggered ? " · 고위험 가드레일 적용" : ""}
        </p>
      </div>
    </section>
  );
}

function Stage2ProbabilityBars({
  probs,
  predicted,
}: {
  probs: { LOW_MCI: number; HIGH_MCI: number; AD: number };
  predicted: "LOW_MCI" | "HIGH_MCI" | "AD";
}) {
  const rows = [
    { key: "LOW_MCI" as const, label: "LOW_MCI", value: probs.LOW_MCI, tone: "low" },
    { key: "HIGH_MCI" as const, label: "HIGH_MCI", value: probs.HIGH_MCI, tone: "high" },
    { key: "AD" as const, label: "AD", value: probs.AD, tone: "ad" },
  ];

  return (
    <section className="insight-block">
      <h4>3중 분류 확률 분포</h4>
      <ul className="probability-bars">
        {rows.map((row) => (
          <li key={row.key} className={`probability-row ${predicted === row.key ? "is-predicted" : ""}`}>
            <div className="probability-row-top">
              <span>{row.label}</span>
              <strong>{(row.value * 100).toFixed(1)}%</strong>
            </div>
            <div className="probability-track">
              <span className={`probability-fill ${row.tone}`} style={{ width: `${Math.min(100, row.value * 100)}%` }} />
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Stage3RiskBars({ year1, year2 }: { year1: number; year2: number }) {
  return (
    <section className="insight-block">
      <h4>전환위험(1년/2년) 시각화</h4>
      <div className="risk-dual-grid">
        <div className="risk-cell">
          <p>Year1</p>
          <div className="risk-track">
            <span className="risk-fill year1" style={{ width: `${Math.min(100, year1 * 100)}%` }} />
          </div>
          <strong>{(year1 * 100).toFixed(1)}%</strong>
        </div>
        <div className="risk-cell">
          <p>Year2</p>
          <div className="risk-track">
            <span className="risk-fill year2" style={{ width: `${Math.min(100, year2 * 100)}%` }} />
          </div>
          <strong>{(year2 * 100).toFixed(1)}%</strong>
        </div>
      </div>
    </section>
  );
}

function buildPath(points: Array<{ x: number; y: number }>): string {
  if (!points.length) return "";
  return points
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
    .join(" ");
}

function TrackingView({ series }: { series: TrackingSeriesPoint[] }) {
  const chart = useMemo(() => {
    const width = 520;
    const height = 154;
    const xPad = 24;
    const yPad = 14;
    const xSpan = width - xPad * 2;
    const ySpan = height - yPad * 2;
    const scoreMin = 8;
    const scoreMax = 30;

    const points = series.map((point, index) => {
      const ratio = series.length > 1 ? index / (series.length - 1) : 0;
      const normalized = (point.cognitiveScore - scoreMin) / (scoreMax - scoreMin);
      const x = xPad + ratio * xSpan;
      const y = yPad + (1 - Math.min(1, Math.max(0, normalized))) * ySpan;
      return { ...point, x, y };
    });

    const measured = points.filter((point) => point.kind === "실측");
    const predictedOnly = points.filter((point) => point.kind === "예측");
    const measuredLast = measured.length ? measured[measured.length - 1] : undefined;
    const predictedPathPoints = measuredLast && predictedOnly.length ? [measuredLast, ...predictedOnly] : predictedOnly;

    return {
      width,
      height,
      measuredPath: buildPath(measured),
      predictedPath: buildPath(predictedPathPoints),
      points,
      grid: [10, 15, 20, 25, 30].map((score) => {
        const normalized = (score - scoreMin) / (scoreMax - scoreMin);
        const y = yPad + (1 - normalized) * ySpan;
        return { score, y };
      }),
    };
  }, [series]);

  return (
    <section className="insight-block">
      <h4>추적 그래프 (실측 vs 예측)</h4>
      <div className="tracking-legend">
        <span className="chip chip-muted">실측</span>
        <span className="chip chip-primary">예측</span>
      </div>
      <div className="tracking-svg-wrap">
        <svg className="tracking-svg" viewBox={`0 0 ${chart.width} ${chart.height}`} role="img" aria-label="인지점수 추적 그래프">
          {chart.grid.map((line) => (
            <g key={line.score}>
              <line x1={20} x2={500} y1={line.y} y2={line.y} className="tracking-grid-line" />
              <text x={4} y={line.y + 3} className="tracking-grid-text">
                {line.score}
              </text>
            </g>
          ))}
          {chart.measuredPath && <path d={chart.measuredPath} className="tracking-path measured" />}
          {chart.predictedPath && <path d={chart.predictedPath} className="tracking-path predicted" />}
          {chart.points.map((point) => (
            <circle
              key={`${point.date}-${point.kind}`}
              cx={point.x}
              cy={point.y}
              r={point.kind === "예측" ? 4.3 : 3.8}
              className={`tracking-point ${point.kind === "예측" ? "predicted" : "measured"}`}
            />
          ))}
        </svg>
      </div>
      <div className="tracking-point-list">
        {series.map((point) => (
          <div key={`${point.date}-${point.kind}-row`} className="tracking-point-item">
            <span>{point.date}</span>
            <strong>{point.cognitiveScore.toFixed(1)}</strong>
            <span>{point.kind}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

export function ResultInsightPanel({ stage, result }: ResultInsightPanelProps) {
  if (!result) {
    return (
      <section className="result-panel">
        <h3>결과/해석</h3>
        <p className="muted">아직 결과가 없습니다. 자동 시연 시작 또는 Demo Run을 실행해 주세요.</p>
      </section>
    );
  }

  const stage1Distribution =
    stage === "stage1" && result.stage === "stage1"
      ? (() => {
          const mci = Math.min(1, Math.max(0, result.output.MCI_Probability ?? 0));
          const dm = Math.min(1, Math.max(0, result.output.DM_Probability));
          const impairment = Math.min(1, Math.max(0, result.output.Impairment_Probability ?? mci + dm));
          const normal = Math.min(1, Math.max(0, result.output.CN_Probability ?? 1 - impairment));
          const groupLabel = impairment > normal ? "인지장애군" : "정상군";
          return { normal, impairment, mci, dm, groupLabel };
        })()
      : null;

  return (
    <section className="result-panel">
      <h3>결과/해석</h3>

      {stage === "stage1" && result.stage === "stage1" && (
        <>
          <div className="result-card">
            <p className="result-title">1차 선별 결과</p>
            <p className="result-main">
              {stage1Distribution?.groupLabel}
              {` (정상군 ${((stage1Distribution?.normal ?? 0) * 100).toFixed(1)}% · 인지장애군 ${((stage1Distribution?.impairment ?? 0) * 100).toFixed(1)}% · MCI ${((stage1Distribution?.mci ?? 0) * 100).toFixed(1)}% · DM ${((stage1Distribution?.dm ?? 0) * 100).toFixed(1)}%)`}
            </p>
            <div className="result-badges">
              <span className="chip chip-primary">{result.riskBadge}</span>
              <span className="chip chip-muted">{result.output.Interest_Category}</span>
              <span className="chip chip-muted">Priority {(result.priorityScoring.total * 100).toFixed(1)}점</span>
              <span className="chip chip-muted">{result.priorityScoring.caregiverAvailable ? "보호자 있음" : "보호자 없음"}</span>
              <span className="chip chip-muted">판정 {stage1Distribution?.groupLabel ?? "정상군"}</span>
            </div>
          </div>
          <Stage1ClassDistribution
            probs={{
              normal: stage1Distribution?.normal ?? 0,
              impairment: stage1Distribution?.impairment ?? 0,
              mci: stage1Distribution?.mci ?? 0,
              dm: stage1Distribution?.dm ?? 0,
            }}
            interest={result.output.Interest_Category}
          />
          <Stage1PriorityScore scoring={result.priorityScoring} />
          <ContributionList title="왜 이런 결과인가" items={result.topFeatures} />
          <section className="insight-block">
            <h4>권장 액션</h4>
            <p>{result.recommendation}</p>
          </section>
        </>
      )}

      {stage === "stage2" && result.stage === "stage2" && (
        <>
          <div className="result-card">
            <p className="result-title">2차 감별 결과</p>
            <p className="result-main">{result.output.Predicted_Class}</p>
            <div className="prob-grid">
              <p>LOW_MCI {(result.output.Probabilities.LOW_MCI * 100).toFixed(1)}%</p>
              <p>HIGH_MCI {(result.output.Probabilities.HIGH_MCI * 100).toFixed(1)}%</p>
              <p>AD {(result.output.Probabilities.AD * 100).toFixed(1)}%</p>
            </div>
          </div>
          <Stage2ProbabilityBars probs={result.output.Probabilities} predicted={result.output.Predicted_Class} />
          <ContributionList title="왜 이런 결과인가" items={result.topFeatures} />
          <section className="insight-block">
            <h4>권장 액션</h4>
            <p>{result.recommendation}</p>
          </section>
        </>
      )}

      {stage === "stage3" && result.stage === "stage3" && (
        <>
          <div className="result-card">
            <p className="result-title">추적관리 결과</p>
            <div className="prob-grid">
              <p>Year1 전환위험 {(result.output.Year1_ConversionRisk * 100).toFixed(1)}%</p>
              <p>Year2 전환위험 {(result.output.Year2_ConversionRisk * 100).toFixed(1)}%</p>
              {result.output.Conversion_12mo !== undefined && <p>12개월 {(result.output.Conversion_12mo * 100).toFixed(1)}%</p>}
              {result.output.Conversion_24mo !== undefined && <p>24개월 {(result.output.Conversion_24mo * 100).toFixed(1)}%</p>}
              {result.output.Conversion_36mo !== undefined && <p>36개월 {(result.output.Conversion_36mo * 100).toFixed(1)}%</p>}
              {result.output.Conversion_48mo !== undefined && <p>48개월 {(result.output.Conversion_48mo * 100).toFixed(1)}%</p>}
              <p>CNN Biomarker {(result.output.CNN_Biomarker_Score * 100).toFixed(1)}%</p>
              <p>Fusion {(result.output.Fusion_Score * 100).toFixed(1)}%</p>
              {result.output.ANN_AD_Probability !== undefined && (
                <p>ANN AD {(result.output.ANN_AD_Probability * 100).toFixed(1)}%</p>
              )}
              {result.output.Ensemble_AD_Probability !== undefined && (
                <p>Ensemble AD {(result.output.Ensemble_AD_Probability * 100).toFixed(1)}%</p>
              )}
              {result.output.Predicted_Label && <p>Predicted {result.output.Predicted_Label}</p>}
              {result.output.Ensemble_Risk_Grade && <p>앙상블 등급 {result.output.Ensemble_Risk_Grade}</p>}
              {result.output.Survival_Risk_Grade && <p>생존분석 등급 {result.output.Survival_Risk_Grade}</p>}
              {result.output.Model_Source && <p>Model Source {result.output.Model_Source}</p>}
              {result.output.CNN_InferenceSource && <p>CNN Source {result.output.CNN_InferenceSource}</p>}
              {result.output.CNN_Top_Class && result.output.CNN_Confidence !== undefined && (
                <p>
                  CNN Top {result.output.CNN_Top_Class} ({(result.output.CNN_Confidence * 100).toFixed(1)}%)
                </p>
              )}
              {result.output.CNN_ClassProbabilities && (
                <p>
                  CNN Prob CN {(result.output.CNN_ClassProbabilities.CN * 100).toFixed(1)}% · DM{" "}
                  {(result.output.CNN_ClassProbabilities.DM * 100).toFixed(1)}% · MCI{" "}
                  {(result.output.CNN_ClassProbabilities.MCI * 100).toFixed(1)}%
                </p>
              )}
              {result.output.Pipeline_RunId && <p>Pipeline run {result.output.Pipeline_RunId.slice(0, 8)}</p>}
            </div>
          </div>
          <Stage3RiskBars year1={result.output.Year1_ConversionRisk} year2={result.output.Year2_ConversionRisk} />
          <TrackingView series={result.output.TrackingSeries} />
          {result.output.Pipeline_Note && (
            <section className="insight-block">
              <h4>모델 참고 메모</h4>
              <p>{result.output.Pipeline_Note}</p>
            </section>
          )}
          <section className="insight-block">
            <h4>핵심 해석</h4>
            <ul className="plain-list">
              {result.highlights.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>
          <section className="insight-block">
            <h4>권장 액션</h4>
            <p>{result.recommendation}</p>
          </section>
        </>
      )}
    </section>
  );
}
