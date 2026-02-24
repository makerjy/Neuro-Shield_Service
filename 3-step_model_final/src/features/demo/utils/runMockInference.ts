import type {
  ActiveCaseState,
  DemoDatasetRow,
  MockInferenceOptions,
  Stage1Result,
  Stage2Result,
  Stage3Result,
  StageKey,
  StageResult,
  TrackingSeriesPoint,
} from "../types";
import { clamp, hashString, mulberry32 } from "./random";
import { runStage3CnnInference, type Stage3CnnInferenceResult } from "./stage3CnnApi";
import { runStage3FutureInference, type Stage3FutureInferenceResult } from "./stage3FutureApi";

function wait(ms: number, signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => resolve(), ms);

    if (!signal) return;

    const abortHandler = () => {
      clearTimeout(timer);
      reject(new DOMException("사용자 취소", "AbortError"));
    };

    if (signal.aborted) {
      abortHandler();
      return;
    }

    signal.addEventListener("abort", abortHandler, { once: true });
  });
}

function getActiveRow(dataset: DemoDatasetRow[], ptid: string): DemoDatasetRow {
  return (
    dataset.find((row) => row.ptid === ptid) ??
    dataset.find((row) => row.__activeCase === true) ??
    dataset[0] ??
    {}
  );
}

function toNumber(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  return fallback;
}

function toBoolean(value: unknown, fallback = false): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value > 0;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["1", "true", "y", "yes"].includes(normalized)) return true;
    if (["0", "false", "n", "no"].includes(normalized)) return false;
  }
  return fallback;
}

function buildStage1Result(activeCase: ActiveCaseState, row: DemoDatasetRow, rng: () => number): Stage1Result {
  const orient = toNumber(row.CIST_ORIENT, 3);
  const attention = toNumber(row.CIST_ATTENTION, 2);
  const exec = toNumber(row.CIST_EXEC, 3);
  const memory = toNumber(row.CIST_MEMORY, 5);
  const language = toNumber(row.CIST_LANGUAGE, 2);
  const age = toNumber(row.entry_age, 74);
  const bp = toNumber(row.VSBPSYS, 140);
  const bmi = toNumber(row.BMI, 25);
  const edu = toNumber(row.PTEDUCAT, 11);
  const caregiverAvailable = toBoolean(row.caregiver_available, true);

  const cognitivePenalty =
    ((5 - orient) + (3 - attention) + (6 - exec) + (10 - memory) + (4 - language)) / 25;
  const ageRisk = age >= 80 ? 0.18 : age >= 70 ? 0.12 : 0.06;
  const bpRisk = clamp((bp - 120) / 70, 0, 1) * 0.14;
  const bmiRisk = clamp((bmi - 22) / 12, 0, 1) * 0.07;
  const eduProtect = clamp((edu - 9) / 10, 0, 1) * -0.06;

  const dmProb = clamp(
    0.21 + cognitivePenalty * 0.48 + ageRisk + bpRisk + bmiRisk + eduProtect + (rng() - 0.5) * 0.04,
    0.05,
    0.96
  );

  const mciCore = clamp(
    0.24 + cognitivePenalty * 0.62 + (1 - dmProb) * 0.22 + (rng() - 0.5) * 0.02,
    0.04,
    0.91
  );
  const cnCore = clamp(1.08 - dmProb - mciCore + (rng() - 0.5) * 0.02, 0.04, 0.92);
  const stage1Probs = normalize3(cnCore, mciCore, dmProb);
  const cnProb = Number(stage1Probs.low.toFixed(4));
  const mciProb = Number(stage1Probs.high.toFixed(4));
  const dmClassProb = Number(stage1Probs.ad.toFixed(4));
  const impairmentProb = Number((mciProb + dmClassProb).toFixed(4));

  const diagnosis = dmClassProb >= mciProb && dmClassProb >= cnProb ? "DM" : mciProb >= cnProb ? "MCI" : "CN";
  const target = diagnosis === "CN" ? 0 : diagnosis === "MCI" ? 1 : 2;
  const predicted = impairmentProb > cnProb ? 1 : 0;
  const ageScore = clamp((age - 60) / 30, 0, 1) * 0.27;
  const mciRiskScore = mciProb * 0.28;
  const dmRiskScore = dmClassProb * 0.42;
  const impairmentBoostScore = clamp((impairmentProb - 0.45) / 0.55, 0, 1) * 0.18;
  const weightedImpairmentRisk = clamp(mciRiskScore + dmRiskScore + impairmentBoostScore, 0, 1);
  const caregiverScore = caregiverAvailable ? 0 : 0.15;
  const priorityThreshold = 0.58;
  const priorityScore = clamp(ageScore + mciRiskScore + dmRiskScore + impairmentBoostScore + caregiverScore, 0, 1);
  const guardrailTriggered = impairmentProb >= 0.75 || dmClassProb >= 0.45;
  const interest = guardrailTriggered || priorityScore >= priorityThreshold ? "상담사우선" : "agent우선";
  const riskBadge = impairmentProb >= 0.72 ? "고위험" : impairmentProb >= 0.45 ? "주의" : "저위험";

  return {
    stage: "stage1",
    output: {
      PTID: activeCase.ptid,
      label: diagnosis,
      target,
      DIAGNOSIS_str: diagnosis,
      DM_Probability: dmClassProb,
      MCI_Probability: mciProb,
      CN_Probability: cnProb,
      Impairment_Probability: impairmentProb,
      Predicted_Label: predicted as 0 | 1,
      Interest_Category: interest,
      Caregiver_Available: caregiverAvailable ? 1 : 0,
      Priority_Score: Number(priorityScore.toFixed(4)),
    },
    riskBadge,
    topFeatures: [
      {
        feature: "Impairment_Weighted_Risk",
        impact: Number(weightedImpairmentRisk.toFixed(2)),
        note: "MCI/DM 확률 가중합과 인지장애군 보정값을 결합한 우선접촉 위험 점수입니다.",
      },
      {
        feature: "entry_age",
        impact: Number(ageScore.toFixed(2)),
        note: "연령 구간이 높을수록 우선 배정 점수가 가산됩니다.",
      },
      {
        feature: "caregiver_available",
        impact: Number(caregiverScore.toFixed(2)),
        note: caregiverAvailable
          ? "보호자 동행 가능으로 추가 가산점 없이 agent 우선 분기 가능합니다."
          : "보호자 부재로 상담사 개입 필요도가 높아 가산점이 반영됩니다.",
      },
    ],
    priorityScoring: {
      age: Number(ageScore.toFixed(4)),
      mciRisk: Number(mciRiskScore.toFixed(4)),
      dmRisk: Number(dmRiskScore.toFixed(4)),
      impairmentBoost: Number(impairmentBoostScore.toFixed(4)),
      caregiver: Number(caregiverScore.toFixed(4)),
      total: Number(priorityScore.toFixed(4)),
      threshold: priorityThreshold,
      caregiverAvailable,
      guardrailTriggered,
    },
    recommendation:
      predicted === 0
        ? "정상군 우세로 분류되어 생활습관 모니터링 및 정기 선별을 권장합니다."
        : guardrailTriggered
          ? "인지장애군 확률이 높아 상담사우선 배정 가드레일이 적용되었습니다. 전문진료 연계와 보호자 상담을 우선 진행합니다."
          : dmClassProb >= mciProb
            ? "인지장애군(특히 DM 성분 우세)으로 분류되어 전문진료 연계와 보호자 상담 동시 진행을 권장합니다."
          : interest === "상담사우선"
            ? "인지장애군(MCI 성분 우세)으로 분류되어 상담사우선 배정 후 재평가 일정을 안내합니다."
            : "인지장애군(MCI 성분 우세)으로 분류되어 agent 안내 후 필요 시 상담사로 이관합니다.",
  };
}

function normalize3(a: number, b: number, c: number) {
  const sum = a + b + c;
  if (sum <= 0) {
    return { low: 0.34, high: 0.33, ad: 0.33 };
  }
  return { low: a / sum, high: b / sum, ad: c / sum };
}

function buildStage2Result(activeCase: ActiveCaseState, row: DemoDatasetRow, rng: () => number): Stage2Result {
  const stage1Prob = activeCase.previous.stage1?.output.DM_Probability ?? 0.44;
  const cdr = toNumber(row.CDRSB, 1.5);
  const faq = toNumber(row.FAQTOTAL, 8);
  const ldel = toNumber(row.LDELTOTAL, 6);
  const mmse = toNumber(row.MMSCORE, 23);

  const faqDelta = faq / (ldel + 1);
  const highCore = clamp(stage1Prob * 0.45 + (cdr / 4.5) * 0.35 + (faqDelta / 3) * 0.22, 0.05, 0.93);
  const adCore = clamp(stage1Prob * 0.62 + (1 - mmse / 30) * 0.38, 0.04, 0.91);
  const lowCore = clamp(1.04 - highCore - adCore + (rng() - 0.5) * 0.04, 0.05, 0.88);

  const probs = normalize3(lowCore, highCore, adCore);
  const low = Number(probs.low.toFixed(4));
  const high = Number(probs.high.toFixed(4));
  const ad = Number(probs.ad.toFixed(4));

  const predicted =
    ad >= high && ad >= low ? "AD" : high >= low ? "HIGH_MCI" : "LOW_MCI";

  return {
    stage: "stage2",
    output: {
      Predicted_Class: predicted,
      Probabilities: {
        LOW_MCI: low,
        HIGH_MCI: high,
        AD: ad,
      },
    },
    topFeatures: [
      {
        feature: "FAQ_LDELTA_ratio",
        impact: Number((clamp(faqDelta / 3, 0, 1) * 0.32).toFixed(2)),
        note: "기능저하 대비 지연회상 비율이 상승해 고위험 MCI 확률을 끌어올렸습니다.",
      },
      {
        feature: "CDRSB",
        impact: Number((clamp(cdr / 4.5, 0, 1) * 0.26).toFixed(2)),
        note: "임상치매척도(CDRSB)가 분류 경계에 직접 반영됩니다.",
      },
      {
        feature: "MMSCORE",
        impact: Number((clamp((1 - mmse / 30) * 1.05, 0, 1) * 0.18).toFixed(2)),
        note: "MMSE 저하가 AD 확률 가중치에 반영됩니다.",
      },
      {
        feature: "Stage1_DM_Probability",
        impact: Number((stage1Prob * 0.24).toFixed(2)),
        note: "1차 선별 결과가 2차 감별 prior로 결합되었습니다.",
      },
    ],
    recommendation:
      predicted === "LOW_MCI"
        ? "저위험 MCI로 분류되어 3~6개월 주기 재평가를 권장합니다."
        : predicted === "HIGH_MCI"
          ? "고위험 MCI로 분류되어 Stage3 추적관리 등록을 권고합니다."
          : "AD 가능성이 높아 전문진료 연계와 보호자 상담 동시 진행이 필요합니다.",
  };
}

function formatMonth(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function buildTrackingSeries(baseScore: number, slope: number, rng: () => number): TrackingSeriesPoint[] {
  const series: TrackingSeriesPoint[] = [];
  const now = new Date();

  for (let i = 5; i >= 0; i -= 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i * 4, 1);
    const noise = (rng() - 0.5) * 0.8;
    const score = clamp(baseScore - (5 - i) * slope + noise, 10, 30);
    series.push({
      date: formatMonth(d),
      cognitiveScore: Number(score.toFixed(1)),
      kind: "실측",
      note: "현재까지 실측 데이터",
    });
  }

  for (let j = 1; j <= 2; j += 1) {
    const d = new Date(now.getFullYear(), now.getMonth() + j * 6, 1);
    const predicted = clamp(baseScore - (5 + j) * slope, 8, 28);
    series.push({
      date: formatMonth(d),
      cognitiveScore: Number(predicted.toFixed(1)),
      kind: "예측",
      note: "모델 추정 구간",
    });
  }

  return series;
}

function mapFutureTopClassToDemo(value: "CN" | "AD" | "MCI"): "CN" | "DM" | "MCI" {
  if (value === "AD") return "DM";
  return value;
}

function buildStage3ResultFromFuture(
  row: DemoDatasetRow,
  rng: () => number,
  future: Stage3FutureInferenceResult
): Stage3Result {
  const year1 = clamp(future.year1ConversionRisk, 0.04, 0.99);
  const year2 = clamp(future.year2ConversionRisk, year1, 0.99);
  const baseCognitive = toNumber(row.baseline_cognitive_score, 23);
  const slope = clamp(0.38 + year2 * 0.72, 0.3, 1.3);

  return {
    stage: "stage3",
    output: {
      Year1_ConversionRisk: Number(year1.toFixed(4)),
      Year2_ConversionRisk: Number(year2.toFixed(4)),
      CNN_Biomarker_Score: Number(clamp(future.pCnnAd, 0, 1).toFixed(4)),
      Fusion_Score: Number(clamp(future.pEnsembleAd, 0, 1).toFixed(4)),
      TrackingSeries: buildTrackingSeries(baseCognitive, slope, rng),
      Model_Source: future.source,
      Pipeline_RunId: future.runId || undefined,
      Pipeline_Note: future.note,
      Predicted_Label: future.predictedLabel,
      Predicted_Binary: future.predictedBinary,
      Ensemble_Risk_Grade: future.ensembleRiskGrade,
      Survival_Risk_Grade: future.survivalRiskGrade,
      ANN_AD_Probability: Number(clamp(future.pAnnAd, 0, 1).toFixed(4)),
      Ensemble_AD_Probability: Number(clamp(future.pEnsembleAd, 0, 1).toFixed(4)),
      Conversion_12mo: Number(clamp(future.pConvert12mo, 0, 1).toFixed(4)),
      Conversion_24mo: Number(clamp(future.pConvert24mo, 0, 1).toFixed(4)),
      Conversion_36mo: Number(clamp(future.pConvert36mo, 0, 1).toFixed(4)),
      Conversion_48mo: Number(clamp(future.pConvert48mo, 0, 1).toFixed(4)),
      CNN_InferenceSource: "REAL_MODEL",
      CNN_Top_Class: mapFutureTopClassToDemo(future.cnnTopClass),
      CNN_Confidence: Number(clamp(future.cnnTopConfidence, 0, 1).toFixed(4)),
      CNN_RunId: future.runId || undefined,
      CNN_SampleId: future.imageDataId || undefined,
      CNN_ClassProbabilities: {
        CN: Number(clamp(future.cnnClassProbabilities.CN, 0, 1).toFixed(4)),
        DM: Number(clamp(future.cnnClassProbabilities.AD, 0, 1).toFixed(4)),
        MCI: Number(clamp(future.cnnClassProbabilities.MCI, 0, 1).toFixed(4)),
      },
    },
    highlights: [
      `실제 Stage3 파이프라인(run_id: ${future.runId.slice(0, 8)})의 ANN+CNN 멀티모달 결과를 사용했습니다.`,
      `생존 분석 기반 전환 확률을 반영했습니다 (12/24/36/48개월).`,
      future.source === "REAL_PIPELINE_WITH_HEURISTIC_SURVIVAL"
        ? "RSF 생존모델 입력이 부족한 케이스는 보수적 휴리스틱 곡선을 사용했습니다."
        : "RSF 생존모델 기반 개별 전환위험을 사용했습니다.",
      "실측 구간과 예측 구간을 분리 표기하여 해석 혼선을 줄였습니다.",
    ],
    recommendation:
      year2 >= 0.65
        ? "6개월 주기 추적검사와 생활중재 플랜(운동/수면/복약)을 즉시 권고합니다."
        : "연 1회 추적검사와 인지저하 예방 프로그램 참여를 권장합니다.",
  };
}

function buildStage3Result(
  activeCase: ActiveCaseState,
  row: DemoDatasetRow,
  rng: () => number,
  realCnn: Stage3CnnInferenceResult | null
): Stage3Result {
  const stage1Prob = activeCase.previous.stage1?.output.DM_Probability ?? 0.44;
  const stage2 = activeCase.previous.stage2?.output.Probabilities;
  const pHigh = stage2?.HIGH_MCI ?? 0.38;
  const pAD = stage2?.AD ?? 0.27;

  const imgQuality = toNumber(row.image_quality, 0.82);
  const hippocampus = toNumber(row.hippocampus_index, 0.45);
  const mockCnnScore = clamp(
    0.28 + pAD * 0.41 + pHigh * 0.19 + (1 - hippocampus) * 0.22 + (1 - imgQuality) * 0.06,
    0.06,
    0.96
  );

  const cnnScore = clamp(realCnn?.dmProbability ?? mockCnnScore, 0.04, 0.98);

  const fusion = clamp(cnnScore * 0.56 + pAD * 0.26 + stage1Prob * 0.18, 0.04, 0.98);
  const year1 = clamp(fusion * 0.74 + 0.07 + (rng() - 0.5) * 0.03, 0.05, 0.96);
  const year2 = clamp(year1 + 0.09 + pAD * 0.11 + (rng() - 0.5) * 0.02, 0.08, 0.99);

  const baseCognitive = toNumber(row.baseline_cognitive_score, 23);
  const slope = clamp(0.46 + fusion * 0.52, 0.3, 1.2);

  return {
    stage: "stage3",
    output: {
      Year1_ConversionRisk: Number(year1.toFixed(4)),
      Year2_ConversionRisk: Number(year2.toFixed(4)),
      CNN_Biomarker_Score: Number(cnnScore.toFixed(4)),
      Fusion_Score: Number(fusion.toFixed(4)),
      TrackingSeries: buildTrackingSeries(baseCognitive, slope, rng),
      Model_Source: realCnn ? "REAL_CNN_PLUS_HEURISTIC" : "MOCK",
      Predicted_Label: fusion >= 0.5 ? "AD" : "MCI",
      Predicted_Binary: fusion >= 0.5 ? 1 : 0,
      ANN_AD_Probability: Number(clamp(pAD, 0, 1).toFixed(4)),
      Ensemble_AD_Probability: Number(fusion.toFixed(4)),
      Conversion_12mo: Number(year1.toFixed(4)),
      Conversion_24mo: Number(year2.toFixed(4)),
      Conversion_36mo: Number(clamp(year2 + 0.07, 0.08, 0.99).toFixed(4)),
      Conversion_48mo: Number(clamp(year2 + 0.13, 0.1, 0.99).toFixed(4)),
      CNN_InferenceSource: realCnn ? "REAL_MODEL" : "MOCK",
      CNN_Top_Class: realCnn?.topClass,
      CNN_Confidence: realCnn ? Number(realCnn.confidence.toFixed(4)) : undefined,
      CNN_RunId: realCnn?.runId,
      CNN_SampleId: realCnn?.sampleId,
      CNN_ClassProbabilities: realCnn
        ? {
            CN: Number(realCnn.probabilities.CN.toFixed(4)),
            DM: Number(realCnn.probabilities.DM.toFixed(4)),
            MCI: Number(realCnn.probabilities.MCI.toFixed(4)),
          }
        : undefined,
    },
    highlights: [
      realCnn
        ? `실제 Stage3 CNN 모델(run_id: ${realCnn.runId.slice(0, 8)})의 DM 확률을 멀티모달 결합점수에 반영했습니다.`
        : "Stage3 CNN API 연결이 없어 데모 계산식의 CNN score를 사용했습니다.",
      "실측 구간과 예측 구간을 분리 표기하여 해석 혼선을 줄였습니다.",
      "Year2 위험도는 Year1 대비 누적 위험을 반영해 상승할 수 있습니다.",
      "CNN score와 Stage1/2 prior를 결합한 Fusion score를 의사결정 기준으로 사용합니다.",
    ],
    recommendation:
      year2 >= 0.65
        ? "6개월 주기 추적검사와 생활중재 플랜(운동/수면/복약)을 즉시 권고합니다."
        : "연 1회 추적검사와 인지저하 예방 프로그램 참여를 권장합니다.",
  };
}

function buildResult(stage: StageKey, activeCase: ActiveCaseState, dataset: DemoDatasetRow[], rng: () => number): StageResult {
  const row = getActiveRow(dataset, activeCase.ptid);

  if (stage === "stage1") return buildStage1Result(activeCase, row, rng);
  if (stage === "stage2") return buildStage2Result(activeCase, row, rng);
  return buildStage3Result(activeCase, row, rng, null);
}

export function resolveInferenceSeed(
  stage: StageKey,
  activeCase: ActiveCaseState,
  dataset: DemoDatasetRow[],
  seed?: number
): number {
  if (typeof seed === "number" && Number.isFinite(seed)) {
    return seed;
  }

  return hashString(
    `${stage}|${activeCase.caseId}|${activeCase.ptid}|${dataset.length}|${activeCase.badges.join("/")}`
  );
}

export function estimateInferenceDurationMs(seed: number): number {
  const rng = mulberry32(seed);
  return 9000 + Math.floor(rng() * 5000);
}

export async function runMockInference(
  stage: StageKey,
  activeCase: ActiveCaseState,
  dataset: DemoDatasetRow[],
  options: MockInferenceOptions = {}
): Promise<StageResult> {
  const seed = resolveInferenceSeed(stage, activeCase, dataset, options.seed);
  const rng = mulberry32(seed);
  const delayMs = estimateInferenceDurationMs(seed);

  if (stage === "stage3") {
    const row = getActiveRow(dataset, activeCase.ptid);
    const stage3InferenceTask = Promise.all([
      runStage3FutureInference(row, options.signal),
      runStage3CnnInference(row, options.signal),
    ]);
    await wait(delayMs, options.signal);
    const [realFuture, realCnn] = await stage3InferenceTask;
    if (realFuture) {
      return buildStage3ResultFromFuture(row, rng, realFuture);
    }
    return buildStage3Result(activeCase, row, rng, realCnn);
  }

  await wait(delayMs, options.signal);
  return buildResult(stage, activeCase, dataset, rng);
}
