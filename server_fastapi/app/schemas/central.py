from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field


CentralTimeWindow = Literal['LAST_24H', 'LAST_7D', 'LAST_30D', 'LAST_90D']
CentralKpiId = Literal[
    'SIGNAL_QUALITY',
    'POLICY_IMPACT',
    'BOTTLENECK_RISK',
    'DATA_READINESS',
    'GOVERNANCE_SAFETY',
]


class ProducerInfo(BaseModel):
    org_unit_id: str
    level: str
    system: str
    version: str


class RegionPath(BaseModel):
    nation: str
    region: str
    sigungu: str | None = None
    local: str | None = None


class IngestEventIn(BaseModel):
    event_id: str
    event_ts: datetime
    producer: ProducerInfo
    region_path: RegionPath
    case_key: str
    stage: Literal['S1', 'S2', 'S3']
    event_type: str
    payload: dict[str, Any]
    policy_version: str | None = None
    kpi_version: str | None = None
    model_version: str | None = None
    trace_id: str | None = None


class IngestEventsResponse(BaseModel):
    accepted_count: int
    duplicated_count: int
    rejected_count: int
    rejected_reasons: list[str]


class CentralKpiValueOut(BaseModel):
    kpiId: CentralKpiId
    window: CentralTimeWindow
    numerator: float
    denominator: float
    value: float
    delta7d: float
    auxiliary: dict[str, Any] | None = None
    sparkline: list[float] | None = None


class CentralDashboardKpisResponse(BaseModel):
    window: CentralTimeWindow
    timestamp: str
    kpis: list[CentralKpiValueOut]


class FunnelStageOut(BaseModel):
    stage: str
    label: str
    count: int
    conversionRate: float | None = None


class FunnelResponse(BaseModel):
    window: CentralTimeWindow
    stages: list[FunnelStageOut]


class BottleneckMetricOut(BaseModel):
    key: str
    label: str
    value: float
    unit: str
    threshold: float
    status: Literal['red', 'yellow', 'green']
    category: Literal['consent', 'readiness', 'blocked', 'system']


class BottleneckResponse(BaseModel):
    window: CentralTimeWindow
    metrics: list[BottleneckMetricOut]


class BlockedReasonOut(BaseModel):
    reason: str
    count: int


class LinkageMetricOut(BaseModel):
    stage: Literal['stage2', 'stage3']
    linkageRate: float
    medianLeadTimeDays: float
    blockedCount: int
    blockedReasons: list[BlockedReasonOut]


class LinkageResponse(BaseModel):
    window: CentralTimeWindow
    metrics: list[LinkageMetricOut]


class RegionComparisonRowOut(BaseModel):
    regionCode: str
    regionName: str
    signalQuality: float
    policyImpact: float
    bottleneckRisk: float
    dataReadiness: float
    governanceSafety: float
    blockedPct: float
    consentPct: float
    backlogCount: int


class RegionComparisonResponse(BaseModel):
    window: CentralTimeWindow
    rows: list[RegionComparisonRowOut]


class CentralCaseListItemOut(BaseModel):
    caseId: str
    regionCode: str
    regionName: str
    currentStage: str
    urgency: Literal['low', 'medium', 'high', 'critical']
    createdAt: str
    lastEventAt: str
    blockedReason: str | None = None


class CentralCaseListResponse(BaseModel):
    total: int
    page: int
    pageSize: int
    items: list[CentralCaseListItemOut]


class CentralRegionMetricOut(BaseModel):
    regionCode: str
    regionName: str
    value: float
    extra: dict[str, float] | None = None


class KpiBundleNationalOut(BaseModel):
    value: float
    deltaPP: float
    target: float | None = None
    numerator: float | None = None
    denominator: float | None = None


class KpiBundleSeriesItemOut(BaseModel):
    name: str
    value: float
    color: str | None = None


class KpiBundleTrendOut(BaseModel):
    period: str
    value: float


class KpiBundleOut(BaseModel):
    national: KpiBundleNationalOut
    regions: list[CentralRegionMetricOut]
    breakdown: list[KpiBundleSeriesItemOut]
    breakdownType: Literal['donut', 'stacked', 'bar', 'timeline']
    cause: list[KpiBundleSeriesItemOut]
    causeType: Literal['bar', 'donut', 'lineRank']
    trend: list[KpiBundleTrendOut]
    worstRegions: list[CentralRegionMetricOut]
    bestRegions: list[CentralRegionMetricOut]


class DashboardDataOut(BaseModel):
    signalQuality: KpiBundleOut
    policyImpact: KpiBundleOut
    bottleneckRisk: KpiBundleOut
    dataReadiness: KpiBundleOut
    governanceSafety: KpiBundleOut


class PolicyKpiSnapshot(BaseModel):
    slaRate: float
    responseTimeliness: float
    completionRate: float
    dataFulfillment: float


class PolicyImpactItem(BaseModel):
    kpi: str
    label: str
    changePp: float
    verdict: Literal['improved', 'worsened', 'insignificant']


class PolicyChangeEventOut(BaseModel):
    id: str
    title: str
    type: Literal['rule_threshold', 'model_version', 'ruleset', 'contact_rule']
    version: str
    deployedAt: str
    deployedBy: str
    status: Literal['deployed', 'rollback', 'pending', 'reviewing']
    description: str
    before: PolicyKpiSnapshot
    after: PolicyKpiSnapshot
    impactSummary: list[PolicyImpactItem]
    affectedRegions: list[str]
    riskLevel: Literal['low', 'medium', 'high'] | None = None
    requestedBy: str | None = None
    approvedBy: str | None = None
    currentRule: str | None = None
    proposedRule: str | None = None
    reason: str | None = None


class DriverRegionOut(BaseModel):
    code: str
    name: str
    score: float
    detail: str


class DriverIndicatorOut(BaseModel):
    label: str
    value: float
    unit: str
    threshold: float
    status: Literal['red', 'yellow', 'green']


class DriverAnalysisOut(BaseModel):
    key: Literal['ops_bottleneck', 'data_quality', 'contact_strategy', 'model_fitness']
    label: str
    icon: str
    description: str
    severity: Literal['critical', 'warning', 'good']
    score: float
    contributionPct: float
    topRegions: list[DriverRegionOut]
    indicators: list[DriverIndicatorOut]


class QualityAlertOut(BaseModel):
    id: str
    type: Literal['data_missing', 'update_delay', 'model_drift', 'sla_breach']
    severity: Literal['critical', 'warning', 'info']
    title: str
    description: str
    region: str
    detectedAt: str
    resolved: bool
    relatedDriver: Literal['ops_bottleneck', 'data_quality', 'contact_strategy', 'model_fitness'] | None = None


class UnifiedAuditKpiSnapshot(BaseModel):
    slaRate: float
    riskTop3: list[str]
    regionContext: str


class UnifiedAuditEventOut(BaseModel):
    id: str
    timestamp: str
    type: Literal['violation', 'policy_change', 'model_deploy', 'resolution']
    severity: Literal['high', 'medium', 'low']
    status: Literal['reviewing', 'resolved', 'pending']
    title: str
    actor: str
    actorRole: str
    center: str | None = None
    target: str
    violationType: str | None = None
    violatedRegulation: str | None = None
    cause: str
    relatedChangeId: str | None = None
    requestor: str | None = None
    approver: str | None = None
    executor: str | None = None
    policyRef: str | None = None
    internalStandardId: str | None = None
    approvalComment: str | None = None
    rationale: str
    kpiSnapshot: UnifiedAuditKpiSnapshot


class AuditEventOut(BaseModel):
    id: int
    ts: str
    actor_id: str
    actor_role: str
    action: str
    entity_type: str
    entity_id: str
    severity: str
    status: str
    before_json: dict[str, Any] | None = None
    after_json: dict[str, Any] | None = None
    basis_ref: str | None = None
    description: str | None = None


class InterventionCreateRequest(BaseModel):
    title: str
    description: str | None = None
    priority: Literal['LOW', 'MEDIUM', 'HIGH'] = 'MEDIUM'
    basis_type: Literal['KPI', 'EVENT']
    basis_ref: str = Field(min_length=1)
    due_at: datetime | None = None
    target_org_unit_ids: list[str] = Field(default_factory=list)


class InterventionActionPayload(BaseModel):
    id: str
    action_type: str
    due_at: datetime | None = None


class InterventionCreateResponse(BaseModel):
    id: str
    status: str


class InterventionStatusRequest(BaseModel):
    status: str


class InterventionActionStatusRequest(BaseModel):
    status: str


class InterventionOut(BaseModel):
    id: str
    title: str
    description: str | None
    status: str
    priority: str
    basis_type: str
    basis_ref: str
    due_at: str | None
    created_by: str
    created_at: str


class StreamMessage(BaseModel):
    snapshot_version: str
    scope_level: str
    scope_id: str
    ts: str
