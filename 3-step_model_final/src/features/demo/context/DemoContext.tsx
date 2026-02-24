import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from "react";
import { DEFAULT_SEED, FIXED_ACTIVE_CASE, STAGE_STAGE_TO_FLOW_INDEX } from "../constants";
import type {
  ActiveCaseState,
  DemoDatasetRow,
  ExportHistoryItem,
  StageKey,
  StageResult,
  StageState,
  StageStatus,
} from "../types";

type StageStore = Record<StageKey, StageState>;

interface DemoContextValue {
  demoMode: boolean;
  setDemoMode: (value: boolean) => void;
  activeCase: ActiveCaseState;
  opsProgress: number;
  flashReflection: boolean;
  runSeed: number;
  stageStore: StageStore;
  exportHistory: ExportHistoryItem[];
  setCurrentStage: (stage: StageKey) => void;
  setStageDataset: (stage: StageKey, dataset: DemoDatasetRow[]) => void;
  setStageStatus: (stage: StageKey, status: StageStatus) => void;
  commitStageResult: (stage: StageKey, result: StageResult) => void;
  addExportHistory: (item: Omit<ExportHistoryItem, "id" | "createdAt">) => void;
}

const initialStageState: StageStore = {
  stage1: { dataset: [], status: "IDLE" },
  stage2: { dataset: [], status: "IDLE" },
  stage3: { dataset: [], status: "IDLE" },
};

const DemoContext = createContext<DemoContextValue | null>(null);

function readDemoMode() {
  const raw = window.localStorage.getItem("demo-mode");
  return raw ? raw === "1" : true;
}

function readHistory(): ExportHistoryItem[] {
  const raw = window.localStorage.getItem("demo-export-history");
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as ExportHistoryItem[];
    if (Array.isArray(parsed)) return parsed.slice(0, 5);
  } catch {
    return [];
  }
  return [];
}

function formatBadge(stage: StageKey, result: StageResult): string {
  if (stage === "stage1" && result.stage === "stage1") {
    const impairment = result.output.Impairment_Probability ?? result.output.DM_Probability;
    return `S1 인지장애 ${(impairment * 100).toFixed(1)}% · MCI ${(result.output.MCI_Probability * 100).toFixed(1)}% · DM ${(result.output.DM_Probability * 100).toFixed(1)}%`;
  }
  if (stage === "stage2" && result.stage === "stage2") {
    return `S2 ${result.output.Predicted_Class} · AD ${(result.output.Probabilities.AD * 100).toFixed(1)}%`;
  }
  if (result.stage === "stage3") {
    return `S3 Y2 ${(result.output.Year2_ConversionRisk * 100).toFixed(1)}%`;
  }
  return `${stage} 완료`;
}

export function DemoProvider({ children }: PropsWithChildren) {
  const [demoMode, setDemoModeState] = useState<boolean>(readDemoMode);
  const [activeCase, setActiveCase] = useState<ActiveCaseState>(FIXED_ACTIVE_CASE);
  const [stageStore, setStageStore] = useState<StageStore>(initialStageState);
  const [exportHistory, setExportHistory] = useState<ExportHistoryItem[]>(readHistory);
  const [opsProgress, setOpsProgress] = useState(0);
  const [flashReflection, setFlashReflection] = useState(false);
  const flashTimer = useRef<number | null>(null);

  useEffect(() => {
    window.localStorage.setItem("demo-mode", demoMode ? "1" : "0");
  }, [demoMode]);

  useEffect(() => {
    window.localStorage.setItem("demo-export-history", JSON.stringify(exportHistory));
  }, [exportHistory]);

  useEffect(
    () => () => {
      if (flashTimer.current) {
        window.clearTimeout(flashTimer.current);
      }
    },
    []
  );

  const setDemoMode = useCallback((value: boolean) => {
    setDemoModeState(value);
  }, []);

  const setCurrentStage = useCallback((stage: StageKey) => {
    setActiveCase((prev) => ({ ...prev, currentStage: stage }));
  }, []);

  const setStageDataset = useCallback((stage: StageKey, dataset: DemoDatasetRow[]) => {
    setStageStore((prev) => ({
      ...prev,
      [stage]: {
        ...prev[stage],
        dataset,
        lastUpdatedAt: new Date().toISOString(),
      },
    }));
  }, []);

  const setStageStatus = useCallback((stage: StageKey, status: StageStatus) => {
    setStageStore((prev) => ({
      ...prev,
      [stage]: {
        ...prev[stage],
        status,
        lastUpdatedAt: new Date().toISOString(),
      },
    }));

    setActiveCase((prev) => ({
      ...prev,
      currentStage: stage,
      stageStatus: status,
    }));
  }, []);

  const commitStageResult = useCallback((stage: StageKey, result: StageResult) => {
    setStageStore((prev) => ({
      ...prev,
      [stage]: {
        ...prev[stage],
        status: "RESULT_READY",
        result,
        lastUpdatedAt: new Date().toISOString(),
      },
    }));

    setActiveCase((prev) => {
      const badge = formatBadge(stage, result);
      const stageIndex = stage.slice(-1);
      const filtered = prev.badges.filter((item) => !item.startsWith(`S${stageIndex} `));
      const badges = [badge, ...filtered].slice(0, 3);

      return {
        ...prev,
        currentStage: stage,
        stageStatus: "RESULT_READY",
        badges,
        previous: {
          ...prev.previous,
          ...(stage === "stage1" && result.stage === "stage1" ? { stage1: result } : {}),
          ...(stage === "stage2" && result.stage === "stage2" ? { stage2: result } : {}),
        },
      };
    });

    setOpsProgress((prev) => Math.max(prev, STAGE_STAGE_TO_FLOW_INDEX[stage] + 1));
    setFlashReflection(true);

    if (flashTimer.current) {
      window.clearTimeout(flashTimer.current);
    }

    flashTimer.current = window.setTimeout(() => {
      setFlashReflection(false);
    }, 1000);
  }, []);

  const addExportHistory = useCallback((item: Omit<ExportHistoryItem, "id" | "createdAt">) => {
    const entry: ExportHistoryItem = {
      ...item,
      id: `${item.stage}-${Date.now()}`,
      createdAt: new Date().toISOString(),
    };

    setExportHistory((prev) => [entry, ...prev].slice(0, 5));
  }, []);

  const value = useMemo<DemoContextValue>(
    () => ({
      demoMode,
      setDemoMode,
      activeCase,
      opsProgress,
      flashReflection,
      runSeed: DEFAULT_SEED,
      stageStore,
      exportHistory,
      setCurrentStage,
      setStageDataset,
      setStageStatus,
      commitStageResult,
      addExportHistory,
    }),
    [
      activeCase,
      addExportHistory,
      commitStageResult,
      demoMode,
      exportHistory,
      flashReflection,
      opsProgress,
      setCurrentStage,
      setDemoMode,
      setStageDataset,
      setStageStatus,
      stageStore,
    ]
  );

  return <DemoContext.Provider value={value}>{children}</DemoContext.Provider>;
}

export function useDemoContext() {
  const value = useContext(DemoContext);
  if (!value) {
    throw new Error("useDemoContext must be used within DemoProvider");
  }
  return value;
}
