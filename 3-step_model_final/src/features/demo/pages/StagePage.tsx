import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ActiveCaseSummary } from "../components/ActiveCaseSummary";
import { CsvExportButton } from "../components/CsvExportButton";
import { ExportHistoryPanel } from "../components/ExportHistoryPanel";
import { MriPreprocessPanel } from "../components/MriPreprocessPanel";
import { PipelineStepper } from "../components/PipelineStepper";
import { ResultInsightPanel } from "../components/ResultInsightPanel";
import { ServiceFlowRibbon } from "../components/ServiceFlowRibbon";
import { STAGE_CARD_COPY, STAGE_LABELS, STAGE_LOG_TEMPLATES, STAGE_PIPELINE_STEPS } from "../constants";
import { useDemoContext } from "../context/DemoContext";
import type { DemoDatasetRow, PipelineStep, StageKey } from "../types";
import { generateDemoDataset } from "../utils/generateDemoDataset";
import {
  estimateInferenceDurationMs,
  resolveInferenceSeed,
  runMockInference,
} from "../utils/runMockInference";
import { mulberry32 } from "../utils/random";

interface StagePageProps {
  stage: StageKey;
}

const ACTIVE_FEATURE_KEYS: Record<StageKey, string[]> = {
  stage1: [
    "CIST_ORIENT",
    "CIST_ATTENTION",
    "CIST_EXEC",
    "CIST_MEMORY",
    "CIST_LANGUAGE",
    "entry_age",
    "PTEDUCAT",
    "VSBPSYS",
    "BMI",
    "PTGENDER_num",
    "caregiver_available",
  ],
  stage2: [
    "entry_age",
    "PTGENDER",
    "VSBPSYS",
    "CDRSB",
    "MMSCORE",
    "FAQTOTAL",
    "LDELTOTAL",
    "COG_DISORDER",
    "dementia_med",
    "antidepressant_med",
  ],
  stage3: [
    "scan_id",
    "image_quality",
    "ventricle_ratio",
    "hippocampus_index",
    "white_matter_index",
    "baseline_cognitive_score",
  ],
};

function cloneSteps(stage: StageKey): PipelineStep[] {
  return STAGE_PIPELINE_STEPS[stage].map((step) => ({ ...step }));
}

function completeSteps(stage: StageKey): PipelineStep[] {
  return cloneSteps(stage).map((step) => ({ ...step, status: "completed" }));
}

function applyProgressToSteps(stage: StageKey, progress: number): PipelineStep[] {
  if (progress >= 100) return completeSteps(stage);
  const base = cloneSteps(stage);
  const thresholds = [12, 35, 65, 84, 100];
  const currentIndex = thresholds.findIndex((threshold) => progress < threshold);

  const runningIndex = currentIndex === -1 ? base.length - 1 : currentIndex;
  return base.map((step, idx) => {
    if (idx < runningIndex) return { ...step, status: "completed" as const };
    if (idx === runningIndex) return { ...step, status: "running" as const };
    return { ...step, status: "pending" as const };
  });
}

function formatValue(value: string | number | boolean | null | undefined): string {
  if (value === null || value === undefined) return "-";
  if (typeof value === "number") {
    if (Number.isInteger(value)) return String(value);
    return value.toFixed(3);
  }
  if (typeof value === "boolean") return value ? "true" : "false";
  return value;
}

export function StagePage({ stage }: StagePageProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const {
    activeCase,
    demoMode,
    opsProgress,
    flashReflection,
    stageStore,
    runSeed,
    exportHistory,
    setCurrentStage,
    setStageDataset,
    setStageStatus,
    commitStageResult,
    addExportHistory,
  } = useDemoContext();

  const stageState = stageStore[stage];
  const dataset = stageState.dataset;
  const isRunning = stageState.status === "RUNNING";
  const hasResult = Boolean(stageState.result);

  const [steps, setSteps] = useState<PipelineStep[]>(() =>
    hasResult ? completeSteps(stage) : cloneSteps(stage)
  );
  const [progress, setProgress] = useState(hasResult ? 100 : 0);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [logs, setLogs] = useState<string[]>([]);
  const [showTableModal, setShowTableModal] = useState(false);

  const timersRef = useRef<number[]>([]);
  const abortRef = useRef<AbortController | null>(null);
  const autoRunRef = useRef(false);

  const nextStage: StageKey | null =
    stage === "stage1" ? "stage2" : stage === "stage2" ? "stage3" : null;

  const tableColumns = useMemo(() => {
    if (!dataset.length) return [];
    return Object.keys(dataset[0]).filter((key) => key !== "__activeCase");
  }, [dataset]);

  const previewRows = useMemo(() => dataset.slice(0, 10), [dataset]);

  const activeRow = useMemo<DemoDatasetRow | undefined>(() => {
    if (!dataset.length) return undefined;
    return (
      dataset.find((row) => row.ptid === activeCase.ptid) ??
      dataset.find((row) => row.__activeCase === true) ??
      dataset[0]
    );
  }, [dataset, activeCase.ptid]);

  const activeFeatures = useMemo(
    () =>
      ACTIVE_FEATURE_KEYS[stage].map((key) => ({
        key,
        value: formatValue(activeRow?.[key]),
      })),
    [activeRow, stage]
  );

  const clearTimers = useCallback(() => {
    timersRef.current.forEach((id) => {
      window.clearInterval(id);
      window.clearTimeout(id);
    });
    timersRef.current = [];
  }, []);

  const appendLog = useCallback((message: string) => {
    const timestamp = new Date().toLocaleTimeString("ko-KR", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    setLogs((prev) => [...prev, `${timestamp} ${message}`].slice(-150));
  }, []);

  const createDataset = useCallback(
    (seed: number): DemoDatasetRow[] => {
      const rows = generateDemoDataset(stage, 100, seed);
      setStageDataset(stage, rows);
      appendLog(`데모 데이터 100건 생성 완료 (seed=${seed})`);
      return rows;
    },
    [appendLog, setStageDataset, stage]
  );

  const cancelRun = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
    }
  }, []);

  const startRun = useCallback(
    async (options?: { regenerate?: boolean; seed?: number }) => {
      if (abortRef.current) return;

      const requestedSeed =
        typeof options?.seed === "number" && Number.isFinite(options.seed)
          ? options.seed
          : runSeed;

      const previousResultExists = Boolean(stageStore[stage].result);
      const runDataset =
        options?.regenerate || stageStore[stage].dataset.length === 0
          ? createDataset(requestedSeed)
          : stageStore[stage].dataset;

      const inferenceSeed = resolveInferenceSeed(stage, activeCase, runDataset, requestedSeed);
      const durationMs = estimateInferenceDurationMs(inferenceSeed);

      setCurrentStage(stage);
      setStageStatus(stage, "RUNNING");
      setSteps(applyProgressToSteps(stage, 1));
      setProgress(1);
      setRemainingSeconds(Math.ceil(durationMs / 1000));
      setLogs([]);
      appendLog(`Active Case ${activeCase.caseId}/${activeCase.ptid} 실행 시작`);

      const progressStartAt = Date.now();
      const progressTimer = window.setInterval(() => {
        const elapsed = Date.now() - progressStartAt;
        const ratio = Math.min(1, elapsed / durationMs);
        const progressValue = Math.max(1, Math.floor(ratio * 100));
        setProgress(progressValue);
        setSteps(applyProgressToSteps(stage, progressValue));
        setRemainingSeconds(Math.max(0, Math.ceil((durationMs - elapsed) / 1000)));
      }, 250);
      timersRef.current.push(progressTimer);

      const logTemplates = STAGE_LOG_TEMPLATES[stage];
      const logRng = mulberry32(inferenceSeed + 931);
      const logTimer = window.setInterval(() => {
        const line = logTemplates[Math.floor(logRng() * logTemplates.length)];
        appendLog(line);
      }, 350);
      timersRef.current.push(logTimer);

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const result = await runMockInference(stage, activeCase, runDataset, {
          seed: inferenceSeed,
          signal: controller.signal,
        });

        clearTimers();
        setProgress(100);
        setRemainingSeconds(0);
        setSteps(completeSteps(stage));
        appendLog("결과 패키징 완료, 운영 루프 상태 반영");
        commitStageResult(stage, result);
      } catch (error) {
        clearTimers();

        if (error instanceof DOMException && error.name === "AbortError") {
          appendLog("사용자 취소 요청으로 실행 중단, 상태 롤백");
          setStageStatus(stage, previousResultExists ? "RESULT_READY" : "IDLE");
          setSteps(previousResultExists ? completeSteps(stage) : cloneSteps(stage));
          setProgress(previousResultExists ? 100 : 0);
          setRemainingSeconds(0);
        } else {
          appendLog("실행 중 예기치 않은 오류 발생, 상태 복구");
          setStageStatus(stage, previousResultExists ? "RESULT_READY" : "IDLE");
          setSteps(previousResultExists ? completeSteps(stage) : cloneSteps(stage));
          setProgress(previousResultExists ? 100 : 0);
          setRemainingSeconds(0);
        }
      } finally {
        abortRef.current = null;
      }
    },
    [
      activeCase,
      appendLog,
      clearTimers,
      commitStageResult,
      createDataset,
      runSeed,
      setCurrentStage,
      setStageStatus,
      stage,
      stageStore,
    ]
  );

  const handleAutoRun = useCallback(() => {
    void startRun({ regenerate: true });
  }, [startRun]);

  const handleGenerate = useCallback(() => {
    createDataset(runSeed);
  }, [createDataset, runSeed]);

  const handleNextStage = useCallback(() => {
    if (!nextStage) return;
    setCurrentStage(nextStage);
    navigate(`/demo/${nextStage}`);
  }, [navigate, nextStage, setCurrentStage]);

  const handleExport = useCallback(
    (filename: string, rows: number) => {
      addExportHistory({
        stage,
        caseId: activeCase.caseId,
        filename,
        rows,
      });
      appendLog(`CSV 저장 완료: ${filename}`);
    },
    [activeCase.caseId, addExportHistory, appendLog, stage]
  );

  useEffect(() => {
    setCurrentStage(stage);
  }, [setCurrentStage, stage]);

  useEffect(() => {
    if (stageState.status === "RESULT_READY") {
      setProgress(100);
      setRemainingSeconds(0);
      setSteps(completeSteps(stage));
      return;
    }

    if (stageState.status === "IDLE" && !stageState.result && !abortRef.current) {
      setProgress(0);
      setRemainingSeconds(0);
      setSteps(cloneSteps(stage));
    }
  }, [stage, stageState.result, stageState.status]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const autoRun = params.get("autorun") === "1";
    if (!autoRun || autoRunRef.current) return;

    autoRunRef.current = true;
    const parsed = Number(params.get("seed"));
    const seed = Number.isFinite(parsed) ? parsed : runSeed;

    navigate(`/demo/${stage}`, { replace: true });
    void startRun({ regenerate: true, seed });
  }, [location.search, navigate, runSeed, stage, startRun]);

  useEffect(
    () => () => {
      cancelRun();
      clearTimers();
    },
    [cancelRun, clearTimers]
  );

  return (
    <div className="demo-page stage-shell">
      <header className="stage-header">
        <div className="stage-header-top">
          <div>
            <p className="eyebrow">Model Demo Center</p>
            <h1>{STAGE_CARD_COPY[stage].title}</h1>
            <p className="muted">{STAGE_CARD_COPY[stage].subtitle}</p>
          </div>
          <div className="header-actions">
            <button type="button" className="btn btn-ghost" onClick={() => navigate("/demo")}>
              Stage 선택
            </button>
            <button type="button" className="btn btn-primary" onClick={handleAutoRun} disabled={isRunning}>
              자동 시연 시작
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={handleNextStage}
              disabled={!nextStage || stageState.status !== "RESULT_READY"}
            >
              다음 Stage로
            </button>
            <CsvExportButton stage={stage} activeCase={activeCase} result={stageState.result} onExport={handleExport} />
          </div>
        </div>

        <ServiceFlowRibbon stage={stage} opsProgress={opsProgress} flashReflection={flashReflection} />
        <ActiveCaseSummary activeCase={activeCase} stage={stage} />
      </header>

      <main className="stage-layout">
        <section className="panel panel-input">
          <div className="panel-title-row">
            <h3>입력 데이터</h3>
            <div className="panel-actions-inline">
              <button type="button" className="btn btn-primary" onClick={handleGenerate} disabled={isRunning}>
                데모 생성 (N=100)
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setShowTableModal(true)}
                disabled={dataset.length === 0}
              >
                전체보기
              </button>
            </div>
          </div>

          <p className="muted">
            현재 {STAGE_LABELS[stage]} 데이터셋 {dataset.length}건 · Active Case는 항상 고정 시나리오로 포함됩니다.
          </p>

          <div className="active-feature-grid">
            {activeFeatures.map((item) => (
              <div key={item.key} className="feature-card">
                <p>{item.key}</p>
                <strong>{item.value}</strong>
              </div>
            ))}
          </div>

          {stage === "stage3" && (
            <MriPreprocessPanel activeRow={activeRow} result={stageState.result} />
          )}

          <div className="preview-table-wrap">
            <table>
              <thead>
                <tr>
                  {tableColumns.map((column) => (
                    <th key={column}>{column}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {previewRows.map((row, index) => (
                  <tr key={`${String(row.caseId)}-${index}`}>
                    {tableColumns.map((column) => (
                      <td key={`${column}-${index}`}>{formatValue(row[column])}</td>
                    ))}
                  </tr>
                ))}
                {previewRows.length === 0 && (
                  <tr>
                    <td colSpan={Math.max(1, tableColumns.length)} className="table-empty">
                      아직 생성된 데이터가 없습니다.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="panel panel-pipeline">
          <PipelineStepper
            steps={steps}
            progress={progress}
            remainingSeconds={remainingSeconds}
            logs={logs}
            running={isRunning}
            onCancel={cancelRun}
          />
        </section>

        <section className="panel panel-result">
          <ResultInsightPanel stage={stage} result={stageState.result} />
          <ExportHistoryPanel items={exportHistory} />
          {!demoMode && (
            <section className="debug-panel">
              <h4>Debug Snapshot</h4>
              <pre>
                {JSON.stringify(
                  {
                    stageStatus: stageState.status,
                    datasetSize: dataset.length,
                    progress,
                    remainingSeconds,
                  },
                  null,
                  2
                )}
              </pre>
            </section>
          )}
        </section>
      </main>

      {showTableModal && (
        <div className="table-modal-backdrop" onClick={() => setShowTableModal(false)}>
          <div className="table-modal-card" onClick={(event) => event.stopPropagation()}>
            <div className="panel-title-row">
              <h3>전체 데이터 ({dataset.length}건)</h3>
              <button type="button" className="btn btn-ghost" onClick={() => setShowTableModal(false)}>
                닫기
              </button>
            </div>
            <div className="preview-table-wrap full">
              <table>
                <thead>
                  <tr>
                    {tableColumns.map((column) => (
                      <th key={column}>{column}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {dataset.map((row, index) => (
                    <tr key={`${String(row.caseId)}-full-${index}`}>
                      {tableColumns.map((column) => (
                        <td key={`${column}-full-${index}`}>{formatValue(row[column])}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
