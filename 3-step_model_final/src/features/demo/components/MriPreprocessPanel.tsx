import { useEffect, useMemo, useState } from "react";
import type { DemoDatasetRow, StageResult } from "../types";
import { hashString } from "../utils/random";
import {
  getStage3RelPathsByPtid,
  getStage3SourceLabel,
  STAGE3_SAMPLE_BASE_PATHS,
} from "../utils/stage3CnnSamples";

interface MriPreprocessPanelProps {
  activeRow?: DemoDatasetRow;
  result?: StageResult;
}

interface TensorStats {
  min: number;
  max: number;
  mean: number;
  std: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function jetColor(t: number): { r: number; g: number; b: number } {
  const v = clamp(t, 0, 1);
  const r = clamp(1.5 - Math.abs(4 * v - 3), 0, 1);
  const g = clamp(1.5 - Math.abs(4 * v - 2), 0, 1);
  const b = clamp(1.5 - Math.abs(4 * v - 1), 0, 1);
  return {
    r: Math.round(r * 255),
    g: Math.round(g * 255),
    b: Math.round(b * 255),
  };
}

function parseSliceIndex(path: string): number {
  const matched = path.match(/_s(\d+)\.png$/i);
  if (!matched) return 0;
  return Number(matched[1]) || 0;
}

function resolveRelPathForBase(relPath: string, baseIndex: number): string {
  if (baseIndex === 1) {
    return relPath.replace(/^DM_or_AD\//, "AD/");
  }
  return relPath;
}

function toNumber(value: unknown, fallback: number): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

export function MriPreprocessPanel({ activeRow, result }: MriPreprocessPanelProps) {
  const ptid = String(activeRow?.ptid ?? "002_S_1155");
  const scanId = String(activeRow?.scan_id ?? "-");
  const imageQuality = toNumber(activeRow?.image_quality, 0.82);
  const ventricleRatio = toNumber(activeRow?.ventricle_ratio, 0.45);
  const hippocampus = toNumber(activeRow?.hippocampus_index, 0.43);
  const seed = hashString(`${ptid}|${scanId}|${imageQuality}|${ventricleRatio}|${hippocampus}`);
  const stage3Result = result?.stage === "stage3" ? result : undefined;
  const [baseIndex, setBaseIndex] = useState(0);
  const [selectedSlice, setSelectedSlice] = useState(0);
  const [preprocessedSrc, setPreprocessedSrc] = useState<string>("");
  const [heatmapSrc, setHeatmapSrc] = useState<string>("");
  const [tensorStats, setTensorStats] = useState<TensorStats | null>(null);

  const relPaths = useMemo(() => {
    return getStage3RelPathsByPtid(ptid);
  }, [ptid]);

  const selectedRelPath = relPaths[Math.min(selectedSlice, Math.max(0, relPaths.length - 1))];
  const activeBasePath = STAGE3_SAMPLE_BASE_PATHS[Math.min(baseIndex, STAGE3_SAMPLE_BASE_PATHS.length - 1)];
  const rawSrc = `${activeBasePath}/${resolveRelPathForBase(selectedRelPath, baseIndex)}`;

  useEffect(() => {
    setSelectedSlice(0);
    setBaseIndex(0);
  }, [ptid]);

  useEffect(() => {
    if (!selectedRelPath) return;

    const img = new Image();
    img.src = rawSrc;

    img.onerror = () => {
      if (baseIndex < STAGE3_SAMPLE_BASE_PATHS.length - 1) {
        setBaseIndex((prev) => Math.min(prev + 1, STAGE3_SAMPLE_BASE_PATHS.length - 1));
      }
    };

    img.onload = () => {
      const size = 224;
      const rawCanvas = document.createElement("canvas");
      rawCanvas.width = size;
      rawCanvas.height = size;
      const rawCtx = rawCanvas.getContext("2d");
      if (!rawCtx) return;

      rawCtx.drawImage(img, 0, 0, size, size);
      const rawImage = rawCtx.getImageData(0, 0, size, size);
      const original = rawImage.data;
      const pixelCount = size * size;

      const gray = new Float32Array(pixelCount);
      let minGray = Infinity;
      let maxGray = -Infinity;
      let sumGray = 0;

      for (let i = 0; i < pixelCount; i += 1) {
        const offset = i * 4;
        const value = 0.299 * original[offset] + 0.587 * original[offset + 1] + 0.114 * original[offset + 2];
        gray[i] = value;
        minGray = Math.min(minGray, value);
        maxGray = Math.max(maxGray, value);
        sumGray += value;
      }

      const range = Math.max(1, maxGray - minGray);
      const meanGray = sumGray / pixelCount;
      let variance = 0;

      const prepCanvas = document.createElement("canvas");
      prepCanvas.width = size;
      prepCanvas.height = size;
      const prepCtx = prepCanvas.getContext("2d");
      if (!prepCtx) return;
      const prepImage = prepCtx.createImageData(size, size);

      const heatCanvas = document.createElement("canvas");
      heatCanvas.width = size;
      heatCanvas.height = size;
      const heatCtx = heatCanvas.getContext("2d");
      if (!heatCtx) return;
      const heatImage = heatCtx.createImageData(size, size);

      const cx = size * (0.45 + ((seed % 17) - 8) * 0.003);
      const cy = size * (0.5 + ((seed % 11) - 5) * 0.004);
      const sx = size * 0.18;
      const sy = size * 0.14;

      for (let i = 0; i < pixelCount; i += 1) {
        const offset = i * 4;
        const x = i % size;
        const y = Math.floor(i / size);

        const normalized = clamp((gray[i] - minGray) / range, 0, 1);
        const scaled = Math.round(normalized * 255);
        variance += (gray[i] - meanGray) ** 2;

        prepImage.data[offset] = scaled;
        prepImage.data[offset + 1] = scaled;
        prepImage.data[offset + 2] = scaled;
        prepImage.data[offset + 3] = 255;

        const dx = x - cx;
        const dy = y - cy;
        const roi = Math.exp(-((dx * dx) / (2 * sx * sx) + (dy * dy) / (2 * sy * sy)));
        const score = clamp(normalized * 0.35 + roi * 0.65, 0, 1);
        const color = jetColor(score);
        const alpha = clamp(0.28 + score * 0.5, 0, 0.78);

        heatImage.data[offset] = Math.round(original[offset] * (1 - alpha) + color.r * alpha);
        heatImage.data[offset + 1] = Math.round(original[offset + 1] * (1 - alpha) + color.g * alpha);
        heatImage.data[offset + 2] = Math.round(original[offset + 2] * (1 - alpha) + color.b * alpha);
        heatImage.data[offset + 3] = 255;

        if (i === pixelCount - 1) {
          const std = Math.sqrt(variance / pixelCount);
          setTensorStats({
            min: -1,
            max: 1,
            mean: Number((((meanGray - minGray) / range) * 2 - 1).toFixed(4)),
            std: Number(((std / range) * 2).toFixed(4)),
          });
        }
      }

      prepCtx.putImageData(prepImage, 0, 0);
      heatCtx.putImageData(heatImage, 0, 0);
      setPreprocessedSrc(prepCanvas.toDataURL("image/png"));
      setHeatmapSrc(heatCanvas.toDataURL("image/png"));
    };
  }, [baseIndex, rawSrc, seed, selectedRelPath]);

  if (!activeRow) {
    return (
      <section className="mri-preprocess-panel">
        <h4>MRI 전처리/시각화</h4>
        <p className="muted">MRI 입력 데이터가 아직 생성되지 않았습니다.</p>
      </section>
    );
  }

  return (
    <section className="mri-preprocess-panel">
      <div className="panel-title-row">
        <h4>MRI 전처리/결과 시각화</h4>
        <span className="chip chip-muted">{scanId}</span>
      </div>

      <ol className="mri-step-list">
        <li>DICOM 메타 정리/익명화</li>
        <li>224x224 리사이즈 + intensity normalize</li>
        <li>EfficientNet 입력 텐서화 + ROI overlay 생성</li>
      </ol>

      <div className="mri-source-row">
        <span className="chip chip-muted">source: {getStage3SourceLabel(activeBasePath)}</span>
        <span className="chip chip-muted">ptid: {ptid}</span>
      </div>

      <div className="mri-image-grid">
        <figure className="mri-image-card">
          <figcaption>원본 MRI</figcaption>
          <img src={rawSrc} alt="원본 MRI 미리보기" />
        </figure>
        <figure className="mri-image-card">
          <figcaption>전처리 결과</figcaption>
          <img src={preprocessedSrc || rawSrc} alt="전처리된 MRI 미리보기" />
        </figure>
        <figure className="mri-image-card">
          <figcaption>ROI/Heatmap</figcaption>
          <img src={heatmapSrc || rawSrc} alt="MRI 히트맵 미리보기" />
        </figure>
      </div>

      <div className="mri-slice-strip">
        {relPaths.map((path, index) => (
          <button
            key={path}
            type="button"
            className={`mri-slice-btn ${selectedSlice === index ? "is-active" : ""}`}
            onClick={() => setSelectedSlice(index)}
            title={path}
          >
            <img
              src={`${activeBasePath}/${resolveRelPathForBase(path, baseIndex)}`}
              alt={`MRI slice ${parseSliceIndex(path)}`}
            />
            <span>s{parseSliceIndex(path)}</span>
          </button>
        ))}
      </div>

      <div className="mri-metric-row">
        <span className="chip chip-muted">Image Quality {(imageQuality * 100).toFixed(1)}%</span>
        <span className="chip chip-muted">Hippocampus Index {hippocampus.toFixed(2)}</span>
        <span className="chip chip-muted">Ventricle Ratio {ventricleRatio.toFixed(2)}</span>
        {tensorStats && (
          <span className="chip chip-muted">
            tensor mean/std {tensorStats.mean.toFixed(3)} / {tensorStats.std.toFixed(3)}
          </span>
        )}
        {stage3Result && (
          <>
            <span className="chip chip-primary">
              CNN {(stage3Result.output.CNN_Biomarker_Score * 100).toFixed(1)}%
            </span>
            <span className="chip chip-primary">
              Fusion {(stage3Result.output.Fusion_Score * 100).toFixed(1)}%
            </span>
            {stage3Result.output.Model_Source && (
              <span className="chip chip-muted">Model Source {stage3Result.output.Model_Source}</span>
            )}
            {stage3Result.output.CNN_InferenceSource && (
              <span className="chip chip-muted">CNN Source {stage3Result.output.CNN_InferenceSource}</span>
            )}
            {stage3Result.output.CNN_RunId && (
              <span className="chip chip-muted">run {stage3Result.output.CNN_RunId.slice(0, 8)}</span>
            )}
          </>
        )}
      </div>

      {!stage3Result && (
        <p className="mri-wait-note">추론 완료 후 CNN/Fusion 점수와 ROI 해석이 결과 패널과 함께 확정됩니다.</p>
      )}
    </section>
  );
}
