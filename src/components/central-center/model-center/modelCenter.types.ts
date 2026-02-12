/* ──────────────────────────────────────────────────────────
   모델 적용 센터 – 데이터 계약 (TypeScript Interfaces)
   ────────────────────────────────────────────────────────── */

/** View Mode: 운영 / 품질 / 감사 */
export type ViewMode = "ops" | "quality" | "audit";

/** 3단계 파이프라인 Stage ID */
export type StageId = "stage1" | "stage2" | "stage3";

/** 2차 진단 분류 라벨 (기관 연계 결과) */
export type DiagnosisClass = "AD" | "MCI" | "NORMAL";

/* ─── KPI Strip ─── */
export interface PipelineKpi {
  key: string;
  label: string;
  value: number;
  unit?: "%" | "명" | "일" | "건";
  delta?: number;             // 전주/전월 대비
  scopeLine: string;          // "전국 집계 / 비식별"
  status?: "good" | "warn" | "risk" | "neutral";
  help?: { title: string; body: string };
  jumpTo?: StageId;
  /** View Mode별로 이 카드가 교체되는지 여부 + 교체 시 대체 값 */
  modeOverride?: Partial<Record<ViewMode, { label: string; value: number; unit?: string; status?: string }>>;
}

/* ─── Stage Overview ─── */
export interface StageOverview {
  stageId: StageId;
  title: string;
  purposeLine: string;
  inputs: { name: string; desc: string }[];
  processing: { name: string; desc: string; version?: string }[];
  outputs: { name: string; desc: string }[];
  transition: { to: StageId | "end"; ruleLine: string }[];
  metrics: {
    applied: number;
    appliedRate?: number;
    conversionRate?: number;
    avgLatencyDays?: number;
    topIssues?: { code: string; label: string; count: number }[];
  };
}

/* ─── Model Use Map ─── */
export interface ModelUseNode {
  id: string;
  group: "input" | "feature" | "model" | "output" | "ops";
  label: string;
  shortDesc: string;
  /** 어느 Stage에 주로 소속되는지 (공통이면 "common") */
  stageTag?: "stage1" | "stage2" | "stage3" | "common";
  /** 기관 결과 등 외부 데이터 표시용 */
  isExternal?: boolean;
}

export interface ModelUseEdge {
  from: string;
  to: string;
  label?: string;
  /** 점선(dashed)은 기관 비교 / 참고 흐름에 사용 */
  style?: "solid" | "dashed";
}

/* ─── Detail Inspector ─── */
export interface InspectorContent {
  id: string;
  definition: {
    what: string;
    why: string;
    whereUsed: string[];
    responsibility: string;       // 항상 "최종 결정 주체: 담당자/기관" 포함
  };
  dataContract: {
    inputs?: { field: string; type: string; nullable: boolean; note?: string }[];
    outputs?: { field: string; type: string; nullable: boolean; note?: string }[];
    refreshCadence?: string;
  };
  qualityAudit: {
    missingRate?: number;
    driftSignals?: { name: string; level: "low" | "mid" | "high"; note: string }[];
    biasAlerts?: { group: string; level: "low" | "mid" | "high"; note: string }[];
    changeLog?: { version: string; date: string; summary: string; impact?: string }[];
  };
}

/* ─── Root View-Model ─── */
export interface ModelCenterViewModel {
  lastUpdatedAt: string;
  viewMode: ViewMode;
  kpis: PipelineKpi[];
  stages: StageOverview[];
  useMap: { nodes: ModelUseNode[]; edges: ModelUseEdge[] };
  inspector: Record<string, InspectorContent>;
}
