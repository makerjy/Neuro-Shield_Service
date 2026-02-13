import type { RegionalKpiKey } from '../../lib/regionalKpiDictionary';
import type { AdminLevel, RegionKey } from '../../lib/regionKey';
import { makeRegionId } from '../../lib/regionKey';

export type KpiKey = RegionalKpiKey;

export type RangeKey = 'weekly' | 'monthly' | 'quarterly';
export type InternalRangeKey = 'week' | 'month' | 'quarter';

export type { AdminLevel, RegionKey };
export { makeRegionId };

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

export type KpiOverlayMode =
  | 'inflow'
  | 'ad_transition_hotspot'
  | 'dx_delay_hotspot'
  | 'screen_to_dx_rate';

export type MapLayer = 'RISK' | 'BOTTLENECK' | 'GAP' | 'LOAD';

export type IssueType =
  | 'SLA'
  | 'EXAM_DELAY'
  | 'QUEUE'
  | 'CONVERSION_GAP'
  | 'LOAD'
  | 'DATA_GAP';

export interface AdTransitionSignal {
  regionId: string;
  regionName: string;
  highRiskCount: number;
  transition30d: number;
  transition90d?: number;
  densityScore: number;
  deltaFromAvg: number;
}

export interface DifferentialDelay {
  regionId: string;
  regionName: string;
  avgWaitDays: number;
  delayedRatio: number;
  backlogCount: number;
  deltaFromAvg: number;
}

export interface StageConversionRate {
  regionId: string;
  regionName: string;
  conversionRate: number;
  bestRate?: number;
  worstRate?: number;
  deltaFromRegional: number;
}

export type CauseItem = {
  id: string;
  label: string;
  value: number;
  unit: '%' | '건' | '점';
  actionHint: string;
};

export interface RegionalKpiBlock {
  id: string;
  title: string;
  value: number;
  unit?: string;
  delta?: { value: number; unit?: string; direction: 'up' | 'down' | 'flat' };
  severity?: 'normal' | 'warn' | 'critical';
  bindLayer: MapLayer;
}

export interface AlertSummary {
  slaAtRiskRegions: number;
  examDelayRegions: number;
  overdueFollowups: number;
  surgeRegions: number;
}

export interface OperationalTopItem {
  regionId: string;
  regionName: string;
  issueType: IssueType;
  severity: number;
  primaryCause: string;
  recommendedAction: string;
  ctaLabel: string;
}

export type InterventionStatus = 'TODO' | 'IN_PROGRESS' | 'DONE' | 'BLOCKED';
export type InterventionType = 'STAFFING' | 'RECONTACT_PUSH' | 'DATA_FIX' | 'PATHWAY_TUNE' | 'GOVERNANCE_FIX';

export type InterventionMetricSnapshot = {
  regionalSla: number;
  regionalQueueRisk: number;
  regionalRecontact: number;
  regionalDataReadiness: number;
  regionalGovernance: number;
  regionalAdTransitionHotspot: number;
  regionalDxDelayHotspot: number;
  regionalScreenToDxRate: number;
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

export type WorkStatus = 'TODO' | 'IN_PROGRESS' | 'DONE' | 'REJECTED';

export interface WorkQueueItem {
  id: string;
  priority: 1 | 2 | 3 | 4 | 5;
  regionName: string;
  taskType: 'FOLLOWUP' | 'EXAM_SLOT' | 'STAFF_SUPPORT' | 'HOSPITAL_LINK' | 'DATA_FIX';
  status: WorkStatus;
  assignee?: string;
  dueAt?: string;
  createdAt: string;
}
