import type { DemoDatasetRow } from "../types";
import { resolveStage3SampleId } from "./stage3CnnSamples";

const DEFAULT_STAGE3_CNN_API_BASE = "http://localhost:8001";
const STAGE3_CNN_API_BASE = (
  import.meta.env.VITE_STAGE3_CNN_API_BASE_URL || DEFAULT_STAGE3_CNN_API_BASE
).replace(/\/+$/, "");

const POLL_INTERVAL_MS = 500;
const POLL_TIMEOUT_MS = 8000;

type Stage3RunStatus = "DATA_MISSING" | "QUEUED" | "VALIDATING" | "RESIZE" | "PREPROCESS" | "INFERENCING" | "EXPLAINING" | "COMPLETED" | "FAILED";

interface Stage3RunCreateResponse {
  run_id: string;
}

interface Stage3RunStatusResponse {
  status: Stage3RunStatus;
  step_artifacts?: Record<string, unknown>;
  error?: string | null;
}

export interface Stage3CnnInferenceResult {
  source: "REAL_MODEL";
  runId: string;
  sampleId: string;
  dmProbability: number;
  topClass: "CN" | "DM" | "MCI";
  confidence: number;
  probabilities: {
    CN: number;
    DM: number;
    MCI: number;
  };
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => resolve(), ms);

    if (!signal) return;

    const abortHandler = () => {
      window.clearTimeout(timer);
      reject(new DOMException("사용자 취소", "AbortError"));
    };

    if (signal.aborted) {
      abortHandler();
      return;
    }

    signal.addEventListener("abort", abortHandler, { once: true });
  });
}

function readNumber(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function normalizeLabel(value: unknown): "CN" | "DM" | "MCI" {
  const raw = String(value ?? "").toLowerCase();
  if (raw.includes("mci")) return "MCI";
  if (raw.includes("dm") || raw.includes("ad")) return "DM";
  return "CN";
}

function parseProbabilities(stepArtifacts: Record<string, unknown> | undefined) {
  const fromUi =
    stepArtifacts?.probs_ui && typeof stepArtifacts.probs_ui === "object"
      ? (stepArtifacts.probs_ui as Record<string, unknown>)
      : undefined;
  const fromRaw =
    stepArtifacts?.probs && typeof stepArtifacts.probs === "object"
      ? (stepArtifacts.probs as Record<string, unknown>)
      : undefined;
  const source = fromUi ?? fromRaw;
  if (!source) return null;

  let cn = 0;
  let dm = 0;
  let mci = 0;

  Object.entries(source).forEach(([label, value]) => {
    const normalized = normalizeLabel(label);
    const probability = readNumber(value, 0);
    if (normalized === "CN") cn = probability;
    if (normalized === "DM") dm = probability;
    if (normalized === "MCI") mci = probability;
  });

  const sum = cn + dm + mci;
  if (sum <= 0) return null;

  return {
    CN: cn / sum,
    DM: dm / sum,
    MCI: mci / sum,
  };
}

function isFinalStatus(status: Stage3RunStatus): boolean {
  return status === "COMPLETED" || status === "FAILED" || status === "DATA_MISSING";
}

async function startRun(sampleId: string, signal?: AbortSignal): Promise<string> {
  const response = await fetch(`${STAGE3_CNN_API_BASE}/api/run`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      sample_id: sampleId,
      options: {
        explain: false,
        occlusion: false,
        allow_cpu_only: true,
      },
    }),
    signal,
  });

  if (!response.ok) {
    throw new Error(`stage3 cnn run start failed (${response.status})`);
  }

  const payload = (await response.json()) as Stage3RunCreateResponse;
  if (!payload.run_id) {
    throw new Error("stage3 cnn run_id is missing");
  }
  return payload.run_id;
}

async function pollRun(runId: string, signal?: AbortSignal): Promise<Stage3RunStatusResponse> {
  const startedAt = Date.now();

  while (true) {
    const response = await fetch(`${STAGE3_CNN_API_BASE}/api/run/${runId}`, {
      signal,
    });
    if (!response.ok) {
      throw new Error(`stage3 cnn poll failed (${response.status})`);
    }

    const payload = (await response.json()) as Stage3RunStatusResponse;
    if (isFinalStatus(payload.status)) {
      return payload;
    }

    if (Date.now() - startedAt > POLL_TIMEOUT_MS) {
      throw new Error("stage3 cnn polling timeout");
    }

    await sleep(POLL_INTERVAL_MS, signal);
  }
}

export async function runStage3CnnInference(
  row: DemoDatasetRow,
  signal?: AbortSignal
): Promise<Stage3CnnInferenceResult | null> {
  const sampleId = resolveStage3SampleId(row);

  try {
    const runId = await startRun(sampleId, signal);
    const final = await pollRun(runId, signal);

    if (final.status !== "COMPLETED") {
      return null;
    }

    const probabilities = parseProbabilities(final.step_artifacts);
    if (!probabilities) {
      return null;
    }

    const topClass = normalizeLabel(final.step_artifacts?.top_class_ui ?? final.step_artifacts?.top_class);
    const confidence = readNumber(final.step_artifacts?.confidence, 0);

    return {
      source: "REAL_MODEL",
      runId,
      sampleId,
      dmProbability: probabilities.DM,
      topClass,
      confidence,
      probabilities,
    };
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw error;
    }
    return null;
  }
}
