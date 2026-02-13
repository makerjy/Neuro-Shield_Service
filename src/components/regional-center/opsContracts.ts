import type { RegionalKpiKey } from '../../lib/regionalKpiDictionary';

export type KpiKey = RegionalKpiKey;

export type RangeKey = 'weekly' | 'monthly' | 'quarterly';
export type InternalRangeKey = 'week' | 'month' | 'quarter';

export type Region = {
  code: string;
  name: string;
};

export type TrendPoint = {
  label: string;
  value: number;
  baseline?: number;
  delta?: number;
};

export type QueueStage = 'contact' | 'recontact' | 'secondary' | 'l2' | 'tertiary';

export type QueueBreakdown = {
  stage: QueueStage;
  label: string;
  backlog: number;
  share: number;
};

export type CauseItem = {
  id: string;
  label: string;
  value: number;
  unit: '%' | '건' | '점';
  actionHint: string;
};

export type InterventionStatus = 'TODO' | 'IN_PROGRESS' | 'DONE' | 'BLOCKED';
export type InterventionType = 'STAFFING' | 'RECONTACT_PUSH' | 'DATA_FIX' | 'PATHWAY_TUNE' | 'GOVERNANCE_FIX';

export type InterventionMetricSnapshot = {
  regionalSla: number;
  regionalQueueRisk: number;
  regionalRecontact: number;
  regionalDataReadiness: number;
  regionalGovernance: number;
};

export type InterventionTimelineEvent = {
  id: string;
  at: string;
  actor: string;
  message: string;
};

export interface Intervention {
  id: string;
  region: string;
  kpiKey: KpiKey;
  type: InterventionType;
  status: InterventionStatus;
  owner: string;
  createdAt: string;
  notes: string;
  evidenceLinks: string[];
  beforeMetrics: InterventionMetricSnapshot;
  afterMetrics?: InterventionMetricSnapshot;
  timeline: InterventionTimelineEvent[];
}

export type InterventionDraft = {
  region: string | null;
  kpiKey: KpiKey;
  range: InternalRangeKey;
  type?: InterventionType;
  source?: 'overview' | 'top5' | 'map' | 'cause';
  primaryDriverStage?: string;
};
