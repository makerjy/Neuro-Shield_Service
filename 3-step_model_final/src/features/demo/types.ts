export type StageKey = "stage1" | "stage2" | "stage3";
export type AgeBand = "60s" | "70s" | "80s";

export type StageStatus = "IDLE" | "RUNNING" | "RESULT_READY";

export interface CommonCase {
  caseId: string;
  ptid: string;
  name: string;
  ageBand: AgeBand;
}

export interface FeatureContribution {
  feature: string;
  impact: number;
  note: string;
}

export interface Stage1CsvRow {
  PTID: string;
  label: string;
  target: number;
  DIAGNOSIS_str: string;
  DM_Probability: number;
  MCI_Probability: number;
  CN_Probability: number;
  Impairment_Probability: number;
  Predicted_Label: 0 | 1;
  Interest_Category: "agent우선" | "상담사우선";
  Caregiver_Available: 0 | 1;
  Priority_Score: number;
}

export interface Stage1PriorityScoring {
  age: number;
  mciRisk: number;
  dmRisk: number;
  impairmentBoost: number;
  caregiver: number;
  total: number;
  threshold: number;
  caregiverAvailable: boolean;
  guardrailTriggered: boolean;
}

export interface Stage1Result {
  stage: "stage1";
  output: Stage1CsvRow;
  riskBadge: "저위험" | "주의" | "고위험";
  topFeatures: FeatureContribution[];
  priorityScoring: Stage1PriorityScoring;
  recommendation: string;
}

export interface Stage2Output {
  Predicted_Class: "LOW_MCI" | "HIGH_MCI" | "AD";
  Probabilities: {
    LOW_MCI: number;
    HIGH_MCI: number;
    AD: number;
  };
}

export interface Stage2Result {
  stage: "stage2";
  output: Stage2Output;
  topFeatures: FeatureContribution[];
  recommendation: string;
}

export interface TrackingSeriesPoint {
  date: string;
  cognitiveScore: number;
  kind: "실측" | "예측";
  note?: string;
}

export interface Stage3Output {
  Year1_ConversionRisk: number;
  Year2_ConversionRisk: number;
  CNN_Biomarker_Score: number;
  Fusion_Score: number;
  TrackingSeries: TrackingSeriesPoint[];
  Model_Source?: "REAL_PIPELINE" | "REAL_PIPELINE_WITH_HEURISTIC_SURVIVAL" | "REAL_CNN_PLUS_HEURISTIC" | "MOCK";
  Pipeline_RunId?: string;
  Pipeline_Note?: string;
  Predicted_Label?: "MCI" | "AD";
  Predicted_Binary?: 0 | 1;
  Ensemble_Risk_Grade?: string;
  Survival_Risk_Grade?: string;
  ANN_AD_Probability?: number;
  Ensemble_AD_Probability?: number;
  Conversion_12mo?: number;
  Conversion_24mo?: number;
  Conversion_36mo?: number;
  Conversion_48mo?: number;
  CNN_InferenceSource?: "REAL_MODEL" | "MOCK";
  CNN_Top_Class?: "CN" | "DM" | "MCI";
  CNN_Confidence?: number;
  CNN_RunId?: string;
  CNN_SampleId?: string;
  CNN_ClassProbabilities?: {
    CN: number;
    DM: number;
    MCI: number;
  };
}

export interface Stage3Result {
  stage: "stage3";
  output: Stage3Output;
  highlights: string[];
  recommendation: string;
}

export type StageResult = Stage1Result | Stage2Result | Stage3Result;

export type DemoDatasetRow = Record<string, string | number | boolean | null>;

export interface StageState {
  dataset: DemoDatasetRow[];
  status: StageStatus;
  result?: StageResult;
  lastUpdatedAt?: string;
}

export interface ActiveCaseState extends CommonCase {
  currentStage: StageKey;
  stageStatus: StageStatus;
  badges: string[];
  previous: {
    stage1?: Stage1Result;
    stage2?: Stage2Result;
  };
}

export interface ExportHistoryItem {
  id: string;
  stage: StageKey;
  caseId: string;
  filename: string;
  createdAt: string;
  rows: number;
}

export interface PipelineStep {
  key: string;
  label: string;
  status: "pending" | "running" | "completed";
}

export interface MockInferenceOptions {
  seed?: number;
  signal?: AbortSignal;
}
