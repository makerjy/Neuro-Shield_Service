import type { DemoDatasetRow } from "../types";

const DEFAULT_STAGE3_FUTURE_API_BASE = "http://localhost:8002";
const STAGE3_FUTURE_API_BASE = (
  import.meta.env.VITE_STAGE3_FUTURE_API_BASE_URL || DEFAULT_STAGE3_FUTURE_API_BASE
).replace(/\/+$/, "");

const REQUEST_TIMEOUT_MS = 9000;

interface Stage3FuturePredictResponse {
  run_id: string;
  subject_id: string;
  image_data_id: string;
  image_path: string;
  predicted_binary: number;
  predicted_label: string;
  ensemble_risk_grade: string;
  survival_risk_grade: string;
  year1_conversion_risk: number;
  year2_conversion_risk: number;
  p_convert_12mo: number;
  p_convert_24mo: number;
  p_convert_36mo: number;
  p_convert_48mo: number;
  p_cnn_ad: number;
  p_ann_ad: number;
  p_ensemble_ad: number;
  cnn_class_probs: Record<string, number>;
  cnn_top_class: string;
  cnn_top_confidence: number;
  source: string;
  note?: string | null;
}

export interface Stage3FutureInferenceResult {
  source: "REAL_PIPELINE" | "REAL_PIPELINE_WITH_HEURISTIC_SURVIVAL";
  runId: string;
  subjectId: string;
  imageDataId: string;
  imagePath: string;
  predictedBinary: 0 | 1;
  predictedLabel: "MCI" | "AD";
  ensembleRiskGrade: string;
  survivalRiskGrade: string;
  year1ConversionRisk: number;
  year2ConversionRisk: number;
  pConvert12mo: number;
  pConvert24mo: number;
  pConvert36mo: number;
  pConvert48mo: number;
  pCnnAd: number;
  pAnnAd: number;
  pEnsembleAd: number;
  cnnClassProbabilities: {
    CN: number;
    AD: number;
    MCI: number;
  };
  cnnTopClass: "CN" | "AD" | "MCI";
  cnnTopConfidence: number;
  note?: string;
}

function toNumber(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function extractImageDataId(scanId?: string): string | undefined {
  if (!scanId) return undefined;
  const matched = scanId.match(/I\d+/i);
  if (!matched) return undefined;
  return matched[0].toUpperCase();
}

function normalizeSource(value: unknown): "REAL_PIPELINE" | "REAL_PIPELINE_WITH_HEURISTIC_SURVIVAL" | null {
  const raw = String(value ?? "").trim().toUpperCase();
  if (raw === "REAL_PIPELINE") return "REAL_PIPELINE";
  if (raw === "REAL_PIPELINE_WITH_HEURISTIC_SURVIVAL") {
    return "REAL_PIPELINE_WITH_HEURISTIC_SURVIVAL";
  }
  return null;
}

function normalizeCnnClass(value: unknown): "CN" | "AD" | "MCI" {
  const raw = String(value ?? "").trim().toUpperCase();
  if (raw === "AD" || raw === "DM") return "AD";
  if (raw === "MCI") return "MCI";
  return "CN";
}

function buildAbortSignal(signal?: AbortSignal): {
  controller: AbortController;
  cleanup: () => void;
} {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  const onAbort = () => controller.abort();
  signal?.addEventListener("abort", onAbort, { once: true });

  return {
    controller,
    cleanup: () => {
      window.clearTimeout(timeoutId);
      signal?.removeEventListener("abort", onAbort);
    },
  };
}

export async function runStage3FutureInference(
  row: DemoDatasetRow,
  signal?: AbortSignal
): Promise<Stage3FutureInferenceResult | null> {
  const subjectId = String(row.ptid ?? "").trim();
  if (!subjectId) return null;

  const scanId = String(row.scan_id ?? "").trim() || undefined;
  const imageDataId = extractImageDataId(scanId);

  const { controller, cleanup } = buildAbortSignal(signal);

  try {
    const response = await fetch(`${STAGE3_FUTURE_API_BASE}/api/predict`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        subject_id: subjectId,
        scan_id: scanId,
        image_data_id: imageDataId,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      return null;
    }

    const payload = (await response.json()) as Stage3FuturePredictResponse;
    const source = normalizeSource(payload.source);
    if (!source) {
      return null;
    }

    const probsRaw = payload.cnn_class_probs || {};

    return {
      source,
      runId: String(payload.run_id ?? ""),
      subjectId: String(payload.subject_id ?? subjectId),
      imageDataId: String(payload.image_data_id ?? imageDataId ?? ""),
      imagePath: String(payload.image_path ?? ""),
      predictedBinary: toNumber(payload.predicted_binary, 0) >= 1 ? 1 : 0,
      predictedLabel: String(payload.predicted_label ?? "").toUpperCase() === "AD" ? "AD" : "MCI",
      ensembleRiskGrade: String(payload.ensemble_risk_grade ?? ""),
      survivalRiskGrade: String(payload.survival_risk_grade ?? ""),
      year1ConversionRisk: toNumber(payload.year1_conversion_risk, 0),
      year2ConversionRisk: toNumber(payload.year2_conversion_risk, 0),
      pConvert12mo: toNumber(payload.p_convert_12mo, 0),
      pConvert24mo: toNumber(payload.p_convert_24mo, 0),
      pConvert36mo: toNumber(payload.p_convert_36mo, 0),
      pConvert48mo: toNumber(payload.p_convert_48mo, 0),
      pCnnAd: toNumber(payload.p_cnn_ad, 0),
      pAnnAd: toNumber(payload.p_ann_ad, 0),
      pEnsembleAd: toNumber(payload.p_ensemble_ad, 0),
      cnnClassProbabilities: {
        CN: toNumber(probsRaw.CN, 0),
        AD: toNumber(probsRaw.AD, probsRaw.DM),
        MCI: toNumber(probsRaw.MCI, 0),
      },
      cnnTopClass: normalizeCnnClass(payload.cnn_top_class),
      cnnTopConfidence: toNumber(payload.cnn_top_confidence, 0),
      note: payload.note ? String(payload.note) : undefined,
    };
  } catch (error) {
    if (signal?.aborted) {
      throw error;
    }
    return null;
  } finally {
    cleanup();
  }
}
