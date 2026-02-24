import { useEffect, useRef } from "react";
import type { PipelineStep } from "../types";

interface PipelineStepperProps {
  steps: PipelineStep[];
  progress: number;
  remainingSeconds: number;
  logs: string[];
  running: boolean;
  onCancel: () => void;
}

export function PipelineStepper({
  steps,
  progress,
  remainingSeconds,
  logs,
  running,
  onCancel,
}: PipelineStepperProps) {
  const logBoxRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = logBoxRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [logs]);

  return (
    <section className="pipeline-panel">
      <div className="pipeline-header">
        <h3>모델 파이프라인</h3>
        {running && (
          <button type="button" className="btn btn-danger" onClick={onCancel}>
            실행 취소
          </button>
        )}
      </div>

      <ol className="pipeline-steps">
        {steps.map((step, idx) => (
          <li key={step.key} className={`pipeline-step step-${step.status}`}>
            <span className="step-index">{idx + 1}</span>
            <div>
              <p className="step-label">{step.label}</p>
              <p className="step-status">{step.status === "pending" ? "대기" : step.status === "running" ? "진행중" : "완료"}</p>
            </div>
          </li>
        ))}
      </ol>

      <div className="progress-wrap">
        <div className="progress-topline">
          <span>진행률 {progress}%</span>
          <span>남은 시간 약 00:{String(remainingSeconds).padStart(2, "0")}</span>
        </div>
        <div className="progress-track" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
          <span className="progress-fill" style={{ width: `${progress}%` }} />
        </div>
      </div>

      <div className="log-stream" ref={logBoxRef}>
        {logs.length === 0 && <p className="log-empty">실행을 시작하면 로그가 표시됩니다.</p>}
        {logs.map((line, index) => (
          <p key={`${line}-${index}`}>
            <code>[{String(index + 1).padStart(2, "0")}]</code> {line}
          </p>
        ))}
      </div>
    </section>
  );
}
