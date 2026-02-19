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
export type OwnerOrg = 'center' | 'hospital' | 'system' | 'external' | 'regional';
export type TodoStatus = 'open' | 'acknowledged' | 'converted_to_intervention' | 'dismissed';
export type TrendMetricKey = 'count' | 'ratio';

export type RegionalQueryState = {
  regionKey: string;
  period: InternalRangeKey;
  kpiKey: KpiKey;
  areaKey: string | null;
  layer: MapLayer;
  selectedStage?: 'contact' | 'recontact' | 'L2' | '3rd' | null;
  selectedCauseKey?: string | null;
  trendMetric?: TrendMetricKey;
};

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

export type RegionalIssue = {
  issueId: string;
  scope: {
    regionKey: string;
    areaKey?: string | null;
  };
  kpiKey: KpiKey;
  period: InternalRangeKey;
  observedAt: string;
  severity: 'watch' | 'critical';
  summary: {
    value: number;
    delta: number;
    threshold: number;
  };
  linkToBottleneckQueryState: RegionalQueryState;
};

export type SnapshotBefore = {
  snapshotId: string;
  capturedAt: string;
  queryState: RegionalQueryState;
  kpis: {
    kpiValue: number;
    backlogCount: number;
    avgDwellMin: number;
  };
  stageBreakdownTop: Array<{ stageKey: string; ratio: number; count: number }>;
  causeBreakdownTop: Array<{ causeKey: string; ratio: number; count: number }>;
  classificationCoverage: {
    classifiedRatio: number;
    unclassifiedRatio: number;
    unclassifiedOwner: OwnerOrg;
  };
  evidenceSummaryTop: Array<{
    causeKey: string;
    confidence: 'high' | 'med' | 'low';
    evidenceType: string;
    evidenceLink?: string | null;
  }>;
};

export type CausePolicy = {
  causeKey: string;
  ownerOrg: OwnerOrg;
  actionable: boolean;
  regionalNeed: 'high' | 'medium' | 'low';
  escalationPath: Array<{
    toOrgRole: string;
    channel: 'internal' | 'email' | 'sms';
    slaHours: number;
  }>;
  defaultActions: Array<{
    title: string;
    steps: string[];
    expectedEffectTags: string[];
  }>;
};

export type ThresholdPolicy = {
  kpiKey: KpiKey;
  thresholds: {
    watch: number;
    critical: number;
  };
  trendRules: Array<{
    type: 'increasing_streak' | 'no_decrease' | 'rebound';
    metric: TrendMetricKey;
    days: number;
    deltaMin?: number;
  }>;
};

export type AssignmentPolicy = {
  regionKey: string;
  areaKey?: string | null;
  causeKey?: string | null;
  ownerOrg: OwnerOrg;
  assigneeId: string;
  assigneeRole: string;
  defaultDueSlaHours: number;
};

export type OpsTodoItem = {
  id: string;
  title: string;
  reason: string;
  target: string;
  recommendedAction: string;
  dueSlaHours: number;
  status: TodoStatus;
  relatedQueryState: RegionalQueryState;
  dismissReason?: string;
};

export type InterventionStatus = 'TODO' | 'IN_PROGRESS' | 'DONE' | 'BLOCKED';
export type InterventionType = 'STAFFING' | 'RECONTACT_PUSH' | 'DATA_FIX' | 'PATHWAY_TUNE' | 'GOVERNANCE_FIX';
export type InterventionStageKey = 'Stage1' | 'Stage2' | 'Stage3';
export type InterventionLogType = 'instruction' | 'adjustment' | 'confirmation' | 'completion' | 'escalation';

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

export type InterventionCreatedFrom = {
  causeKey: string;
  kpiKey: KpiKey;
  snapshotId?: string | null;
  queryState?: RegionalQueryState;
  snapshot: {
    kpiValue: number;
    backlogCount: number;
    avgDwell: number;
    deltaVsRegional?: number;
    unit?: '%' | '건' | '일' | '점';
  };
};

export type InterventionLog = {
  id: string;
  type: InterventionLogType;
  actor: string;
  actorOrg?: OwnerOrg;
  timestamp: string;
  referenceLink?: string;
  requiresFollowup: boolean;
  followedUpAt?: string;
  followupDueAt?: string;
  note: string;
};

export type InterventionAssignment = {
  ownerOrg: OwnerOrg;
  assigneeId: string;
  assigneeName: string;
  dueAt?: string;
  slaHours: number;
  escalationPolicyId?: string;
};

export type InterventionSuccessMetric = {
  kpiKey: KpiKey;
  metricType: TrendMetricKey;
  targetDelta?: number;
  evaluationWindowDays: number;
};

export type InterventionKpiComparison = {
  before: {
    value: number;
    backlog: number;
  };
  after?: {
    value: number;
    backlog: number;
  };
  delta?: {
    value: number;
    backlog: number;
  };
};

export interface Intervention {
  id: string;
  title: string;
  stageKey: InterventionStageKey;
  areaKey: string;
  areaLabel: string;
  region: string;
  kpiKey: KpiKey;
  type: InterventionType;
  status: InterventionStatus;
  owner: string;
  ownerOrg?: OwnerOrg;
  createdAt: string;
  dueAt?: string;
  ruleId?: string;
  context?: RegionalQueryState;
  assignment?: InterventionAssignment;
  successMetric?: InterventionSuccessMetric;
  createdFrom: InterventionCreatedFrom;
  expectedEffectTags: string[];
  logs: InterventionLog[];
  kpiComparison: InterventionKpiComparison;
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
  selectedStage?: 'contact' | 'recontact' | 'L2' | '3rd' | null;
  selectedCauseKey?: string | null;
  selectedArea?: string | null;
  snapshotId?: string | null;
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
