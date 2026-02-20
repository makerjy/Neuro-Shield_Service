export type ViewMode = "ops" | "quality" | "audit";
export type StageId = "stage1" | "stage2" | "stage3";
export type BatchStageTag = "S1" | "S2" | "S3";

export type BatchStatus = "completed" | "running" | "partial" | "delayed" | "failed";
export type SlaStatus = "ok" | "delayed" | "breached";
export type SeverityLevel = "low" | "mid" | "high";
export type RiskBand = "Low" | "Med" | "High";

export interface Stage2Distribution {
  baseDate: string;
  receivedN: number;
  adPct: number;
  mciPct: number;
  normalPct: number;
}

export interface Stage3Enrollment {
  baseDate: string;
  stage2ReceivedN: number;
  mciEnrollPct: number;
  adEnrollPct: number;
}

export interface Stage3CaseResult {
  case_id: string;
  stage: 3;
  model_version: {
    cnn_mri_extractor: string;
    ann_multimodal_conversion: string;
    guardrails: string;
  };
  inputs_summary: {
    stage1_sources: string[];
    stage2_sources: string[];
    mri_cnn_used: boolean;
  };
  upstream_cnn_signal: {
    mri_quality: "OK" | "WARN" | "FAIL";
    cnn_risk_score: number;
    key_rois: string[];
  };
  outputs: {
    conversion_risk_2y: number;
    conversion_risk_band_2y?: RiskBand;
    conversion_reason_codes: string[];
    conversion_top_features?: Array<{ name: string; contribution: number }>;
    followup_priority: "High" | "Med" | "Low";
    recommended_actions: string[];
    guardrail_flags: string[];
  };
}

export interface DispatchLog {
  stage: BatchStageTag;
  destination: "중앙" | "광역" | "치매안심센터";
  sentCount: number;
  failedCount: number;
  retryCount: number;
  lastSentAt: string;
  slaStatus: SlaStatus;
}

export interface BatchMeta {
  baseDate: string;
  receiveDeadline: string;
  modelWindow: string;
  dispatchTime: string;
  status: BatchStatus;
  impactedStages?: BatchStageTag[];
  notes?: string;
  receiveRate?: number;
  missingInstitutionCount?: number;
  expectedRetryAt?: string;
}

export interface HoverMetaBase {
  stage: BatchStageTag;
  title: string;
  baseDate: string;
  definition: string;
  denominator: { label: string; n: number };
  coverage?: { receivedPct?: number; partial?: boolean; notes?: string };
  outputs: string[];
  caution?: string;
  modelChip?: string;
  dispatchChip?: string;
}

export interface KpiHelp {
  title: string;
  body: string;
}

export interface PipelineKpi {
  key: string;
  label: string;
  value: number;
  unit?: string;
  delta?: number;
  baseDate: string;
  scopeLine: string;
  status?: "good" | "warn" | "risk" | "neutral" | string;
  jumpTo?: StageId;
  help?: KpiHelp;
  partialStages?: BatchStageTag[];
  valuePrefix?: string;
  secondaryValueLine?: string;
  modeOverride?: Partial<
    Record<
      ViewMode,
      {
        label?: string;
        value?: number;
        valuePrefix?: string;
        secondaryValueLine?: string;
        unit?: string;
        status?: "good" | "warn" | "risk" | "neutral" | string;
      }
    >
  >;
}

export interface NamedItem {
  name: string;
  desc: string;
  version?: string;
}

export interface StageOverview {
  stageId: StageId;
  examLabel: string;
  title: string;
  purposeLine: string;
  inputs: NamedItem[];
  processing: NamedItem[];
  outputs: NamedItem[];
  transition: Array<{ to: string; ruleLine: string }>;
  metrics: {
    applied: number;
    appliedRate?: number;
    conversionRate?: number;
    avgLatencyDays?: number;
    topIssues?: Array<{ code: string; label: string; count: number }>;
  };
}

export type ModelNodeGroup = "input" | "feature" | "model" | "output" | "dispatch" | "ops";
export type NodeStageTag = StageId | "common";

export interface ModelUseNode {
  id: string;
  group: ModelNodeGroup;
  label: string;
  shortDesc: string;
  stageTag?: NodeStageTag;
  isExternal?: boolean;
}

export interface ModelUseEdge {
  from: string;
  to: string;
  label?: string;
  style?: "dashed" | "solid";
}

export interface InspectorContent {
  id: string;
  definition: {
    what: string;
    why: string;
    whereUsed: string[];
    responsibility: string;
  };
  dataContract: {
    inputs?: Array<{ field: string; type: string; nullable?: boolean; note?: string }>;
    outputs?: Array<{ field: string; type: string; nullable?: boolean; note?: string }>;
    refreshCadence?: string;
  };
  qualityAudit: {
    missingRate?: number;
    driftSignals?: Array<{ name: string; level: SeverityLevel; note: string }>;
    biasAlerts?: Array<{ group: string; level: SeverityLevel; note: string }>;
    changeLog?: Array<{ version: string; date: string; summary: string; impact?: string }>;
  };
  batchSummary?: {
    impactedStages?: BatchStageTag[];
    receiveRate?: number;
    missingInstitutionCount?: number;
    expectedRetryAt?: string;
    impactedMetrics?: string[];
    dispatchLogs?: DispatchLog[];
  };
}

export interface ModelCenterViewModel {
  lastUpdatedAt: string;
  batchMeta: BatchMeta;
  dispatchLogs: DispatchLog[];
  stage2Distribution: Stage2Distribution;
  stage3Enrollment: Stage3Enrollment;
  stage3Cases?: Stage3CaseResult[];
  viewMode: ViewMode;
  kpis: PipelineKpi[];
  stages: StageOverview[];
  useMap: { nodes: ModelUseNode[]; edges: ModelUseEdge[] };
  inspector: Record<string, InspectorContent>;
}
