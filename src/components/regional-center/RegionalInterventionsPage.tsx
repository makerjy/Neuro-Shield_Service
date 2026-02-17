import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  InternalRangeKey,
  Intervention,
  InterventionDraft,
  InterventionKpiComparison,
  InterventionLog,
  InterventionLogType,
  InterventionMetricSnapshot,
  InterventionStageKey,
  InterventionStatus,
  InterventionType,
  KpiKey,
} from './opsContracts';
import type { RegionalScope } from '../geomap/regions';
import { safeOpsText } from '../../lib/uiTextGuard';

interface RegionalInterventionsPageProps {
  region: RegionalScope;
  districtOptions: string[];
  selectedKpiKey: KpiKey;
  selectedRegionSgg: string | null;
  selectedRange: InternalRangeKey;
  onSelectedKpiKeyChange: (kpi: KpiKey) => void;
  onSelectedRegionSggChange: (sgg: string | null) => void;
  onSelectedRangeChange: (range: InternalRangeKey) => void;
  pendingDraft?: InterventionDraft | null;
  onPendingDraftConsumed?: () => void;
}

type EffectTag = 'SLA 개선' | '적체 해소' | '감별검사 지연 감소' | 'AD 전환 고위험군 관리 강화';

const DAY_MS = 24 * 60 * 60 * 1000;
const FOLLOWUP_LIMIT_HOURS = 48;
const UNEXECUTED_ALERT_DAYS = 3;

const KPI_LABEL: Record<KpiKey, string> = {
  regionalSla: '처리 SLA',
  regionalQueueRisk: '병목 큐',
  regionalRecontact: '재접촉 필요',
  regionalDataReadiness: '데이터 준비',
  regionalGovernance: '거버넌스/로그 완전성',
  regionalAdTransitionHotspot: 'AD 전환 위험',
  regionalDxDelayHotspot: '감별검사 지연',
  regionalScreenToDxRate: '선별→진단 전환율',
};

const KPI_UNIT: Record<KpiKey, '%' | '건' | '일' | '점'> = {
  regionalSla: '%',
  regionalQueueRisk: '건',
  regionalRecontact: '%',
  regionalDataReadiness: '%',
  regionalGovernance: '%',
  regionalAdTransitionHotspot: '점',
  regionalDxDelayHotspot: '일',
  regionalScreenToDxRate: '%',
};

const KPI_HIGHER_IS_BETTER: Record<KpiKey, boolean> = {
  regionalSla: true,
  regionalQueueRisk: false,
  regionalRecontact: false,
  regionalDataReadiness: true,
  regionalGovernance: true,
  regionalAdTransitionHotspot: false,
  regionalDxDelayHotspot: false,
  regionalScreenToDxRate: true,
};

const TYPE_LABEL: Record<InterventionType, string> = {
  STAFFING: '인력 배치',
  RECONTACT_PUSH: '재접촉 집중',
  DATA_FIX: '데이터 보완',
  PATHWAY_TUNE: '경로 조정',
  GOVERNANCE_FIX: '거버넌스 보완',
};

const STATUS_LABEL: Record<InterventionStatus, string> = {
  TODO: '미조치',
  IN_PROGRESS: '조치중',
  DONE: '완료',
  BLOCKED: '보류',
};

const STATUS_STYLE: Record<InterventionStatus, string> = {
  TODO: 'bg-gray-100 text-gray-700 border-gray-200',
  IN_PROGRESS: 'bg-blue-100 text-blue-700 border-blue-200',
  DONE: 'bg-green-100 text-green-700 border-green-200',
  BLOCKED: 'bg-amber-100 text-amber-700 border-amber-200',
};

const LOG_TYPE_LABEL: Record<InterventionLogType, string> = {
  instruction: '지시',
  adjustment: '조정',
  confirmation: '확인',
  completion: '완료 보고',
};

const STAGE_LABEL: Record<InterventionStageKey, string> = {
  Stage1: 'Stage1',
  Stage2: 'Stage2',
  Stage3: 'Stage3',
};

const STAGE_LABEL_FROM_DRAFT: Record<string, InterventionStageKey> = {
  contact: 'Stage1',
  recontact: 'Stage1',
  L2: 'Stage2',
  '3rd': 'Stage3',
};

const CAUSE_LABEL_BY_KEY: Record<string, string> = {
  staff_shortage: '인력 여유 부족',
  contact_failure: '연락 미성공',
  data_gap: '데이터 결측',
  hospital_slot_delay: '감별검사 슬롯 지연',
  governance_gap: '거버넌스 로그 누락',
  external_dependency: '외부 연계 지연',
};

const OWNER_OPTIONS = ['김운영', '박지원', '이현장', '최기획'] as const;

const AUTO_RULES = [
  { id: 'RULE-SLA-15', label: 'SLA 위험 15% 초과' },
  { id: 'RULE-DX-7D', label: '감별검사 지연 7일 이상' },
  { id: 'RULE-AD-HR-5', label: 'AD 전환 고위험군 미조치 5건 이상' },
] as const;

const ASSIGNMENT_RULES = [
  '강남구 → 강남센터장',
  '서초구 → 서초센터장',
  '병원 지연 신호 → 협약 병원 담당자',
];

const hashSeed = (input: string) => {
  let h = 0;
  for (let i = 0; i < input.length; i += 1) h = (h * 31 + input.charCodeAt(i)) >>> 0;
  return h;
};

const seeded = (seed: string, min: number, max: number) => min + (max - min) * ((hashSeed(seed) % 1000) / 1000);

const formatDateTime = (iso: string) =>
  new Date(iso).toLocaleString('ko-KR', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });

const daysSince = (iso: string) => Math.max(0, Math.floor((Date.now() - Date.parse(iso)) / DAY_MS));

function buildMetrics(seed: string): InterventionMetricSnapshot {
  return {
    regionalSla: Number(seeded(`${seed}-sla`, 72, 96).toFixed(1)),
    regionalQueueRisk: Math.round(seeded(`${seed}-queue`, 110, 540)),
    regionalRecontact: Number(seeded(`${seed}-recontact`, 7, 26).toFixed(1)),
    regionalDataReadiness: Number(seeded(`${seed}-readiness`, 58, 92).toFixed(1)),
    regionalGovernance: Number(seeded(`${seed}-gov`, 68, 98).toFixed(1)),
    regionalAdTransitionHotspot: Number(seeded(`${seed}-ad-risk`, 22, 81).toFixed(1)),
    regionalDxDelayHotspot: Number(seeded(`${seed}-dx-delay`, 9, 52).toFixed(1)),
    regionalScreenToDxRate: Number(seeded(`${seed}-conv`, 34, 84).toFixed(1)),
  };
}

function metricValue(snapshot: InterventionMetricSnapshot, kpiKey: KpiKey): number {
  return snapshot[kpiKey];
}

function formatMetric(kpiKey: KpiKey, value: number): string {
  const unit = KPI_UNIT[kpiKey];
  if (unit === '건') return `${Math.round(value).toLocaleString()}건`;
  if (unit === '%') return `${value.toFixed(1)}%`;
  if (unit === '일') return `${value.toFixed(1)}일`;
  return `${value.toFixed(1)}점`;
}

function formatByUnit(value: number, unit: '%' | '건' | '일' | '점'): string {
  if (unit === '건') return `${Math.round(value).toLocaleString()}건`;
  if (unit === '점') return `${value.toFixed(1)}점`;
  if (unit === '일') return `${value.toFixed(1)}일`;
  return `${value.toFixed(1)}%`;
}

function inferTypeByKpi(kpiKey: KpiKey): InterventionType {
  if (kpiKey === 'regionalGovernance') return 'GOVERNANCE_FIX';
  if (kpiKey === 'regionalDxDelayHotspot') return 'STAFFING';
  if (kpiKey === 'regionalAdTransitionHotspot' || kpiKey === 'regionalScreenToDxRate') return 'PATHWAY_TUNE';
  if (kpiKey === 'regionalDataReadiness') return 'DATA_FIX';
  if (kpiKey === 'regionalQueueRisk') return 'STAFFING';
  return 'RECONTACT_PUSH';
}

function inferStageByDraft(draft: InterventionDraft): InterventionStageKey {
  if (draft.selectedStage && STAGE_LABEL_FROM_DRAFT[draft.selectedStage]) return STAGE_LABEL_FROM_DRAFT[draft.selectedStage];
  const stageText = draft.primaryDriverStage ?? '';
  if (/3/.test(stageText)) return 'Stage3';
  if (/2|L2/i.test(stageText)) return 'Stage2';
  return 'Stage1';
}

function defaultCauseByKpi(kpiKey: KpiKey): string {
  if (kpiKey === 'regionalDxDelayHotspot') return 'hospital_slot_delay';
  if (kpiKey === 'regionalGovernance') return 'governance_gap';
  if (kpiKey === 'regionalDataReadiness') return 'data_gap';
  if (kpiKey === 'regionalQueueRisk') return 'staff_shortage';
  return 'contact_failure';
}

function effectTagsByKpi(kpiKey: KpiKey): EffectTag[] {
  if (kpiKey === 'regionalSla') return ['SLA 개선', '적체 해소'];
  if (kpiKey === 'regionalQueueRisk') return ['적체 해소', 'SLA 개선'];
  if (kpiKey === 'regionalDxDelayHotspot') return ['감별검사 지연 감소', '적체 해소'];
  if (kpiKey === 'regionalAdTransitionHotspot') return ['AD 전환 고위험군 관리 강화', 'SLA 개선'];
  if (kpiKey === 'regionalScreenToDxRate') return ['AD 전환 고위험군 관리 강화', 'SLA 개선'];
  if (kpiKey === 'regionalDataReadiness') return ['적체 해소', 'SLA 개선'];
  return ['SLA 개선', '적체 해소'];
}

function buildComparison(
  kpiKey: KpiKey,
  beforeMetrics: InterventionMetricSnapshot,
  afterMetrics?: InterventionMetricSnapshot,
): InterventionKpiComparison {
  const beforeValue = metricValue(beforeMetrics, kpiKey);
  const beforeBacklog = beforeMetrics.regionalQueueRisk;
  if (!afterMetrics) {
    return {
      before: { value: beforeValue, backlog: beforeBacklog },
      after: undefined,
      delta: undefined,
    };
  }
  const afterValue = metricValue(afterMetrics, kpiKey);
  const afterBacklog = afterMetrics.regionalQueueRisk;
  return {
    before: { value: beforeValue, backlog: beforeBacklog },
    after: { value: afterValue, backlog: afterBacklog },
    delta: {
      value: Number((afterValue - beforeValue).toFixed(1)),
      backlog: Number((afterBacklog - beforeBacklog).toFixed(1)),
    },
  };
}

function buildLogs(seed: string, owner: string, status: InterventionStatus, createdAt: string): InterventionLog[] {
  const base = Date.parse(createdAt);
  const instructionAt = new Date(base).toISOString();
  const adjustmentAt = new Date(base + 10 * 60 * 60 * 1000).toISOString();
  const confirmationAt = new Date(base + 22 * 60 * 60 * 1000).toISOString();
  const completionAt = new Date(base + 40 * 60 * 60 * 1000).toISOString();

  const logs: InterventionLog[] = [
    {
      id: `${seed}-log-instruction`,
      type: 'instruction',
      actor: owner,
      timestamp: instructionAt,
      referenceLink: '/regional/bottleneck',
      requiresFollowup: true,
      note: safeOpsText('광역센터 지시 전달 및 대상 센터 착수 요청'),
    },
  ];

  if (status !== 'TODO') {
    logs.push({
      id: `${seed}-log-adjustment`,
      type: 'adjustment',
      actor: OWNER_OPTIONS[(hashSeed(seed) + 1) % OWNER_OPTIONS.length],
      timestamp: adjustmentAt,
      referenceLink: '/regional/ops',
      requiresFollowup: true,
      followedUpAt: status === 'BLOCKED' ? undefined : confirmationAt,
      note: safeOpsText('현장 리소스 재조정 및 조치 단계 갱신'),
    });
  }

  if (status === 'IN_PROGRESS' || status === 'DONE') {
    logs.push({
      id: `${seed}-log-confirm`,
      type: 'confirmation',
      actor: OWNER_OPTIONS[(hashSeed(seed) + 2) % OWNER_OPTIONS.length],
      timestamp: confirmationAt,
      referenceLink: 'https://hospital.example.local/sync',
      requiresFollowup: false,
      note: safeOpsText('중간 실행 확인 및 근거 링크 점검'),
    });
  }

  if (status === 'DONE') {
    logs.push({
      id: `${seed}-log-complete`,
      type: 'completion',
      actor: owner,
      timestamp: completionAt,
      referenceLink: '/regional/reports',
      requiresFollowup: false,
      note: safeOpsText('완료 보고 등록 및 후속 모니터링 전환'),
    });
  }

  return logs;
}

function evaluateProgress(item: Intervention) {
  const elapsedDays = daysSince(item.createdAt);
  const delayed = item.status !== 'DONE' && elapsedDays > UNEXECUTED_ALERT_DAYS;
  const comparison = item.kpiComparison;
  const afterExists = Boolean(comparison.after);
  const before = comparison.before.value;
  const after = comparison.after?.value;
  const higherIsBetter = KPI_HIGHER_IS_BETTER[item.kpiKey];

  let improved = false;
  let worsened = false;
  let noImprovement = false;

  if (afterExists && after != null) {
    const diff = after - before;
    if (Math.abs(diff) < 0.01) noImprovement = true;
    else if (higherIsBetter) {
      improved = diff > 0;
      worsened = diff < 0;
    } else {
      improved = diff < 0;
      worsened = diff > 0;
    }
  }

  const missingAfter = !afterExists && item.status !== 'DONE';
  const needsAttention = delayed || noImprovement || worsened || missingAfter;

  return {
    elapsedDays,
    delayed,
    improved,
    worsened,
    noImprovement,
    missingAfter,
    needsAttention,
  };
}

function isFollowupOverdue(log: InterventionLog): boolean {
  if (!log.requiresFollowup || log.followedUpAt) return false;
  return Date.now() - Date.parse(log.timestamp) > FOLLOWUP_LIMIT_HOURS * 60 * 60 * 1000;
}

function buildIntervention(params: {
  id: string;
  regionId: string;
  areaLabel: string;
  kpiKey: KpiKey;
  type: InterventionType;
  status: InterventionStatus;
  owner: string;
  stageKey: InterventionStageKey;
  causeKey: string;
  createdAt: string;
  dueAt?: string;
  ruleId?: string;
  notes?: string;
  includeAfter: boolean;
  seed: string;
}): Intervention {
  const beforeMetrics = buildMetrics(`${params.seed}-before`);
  const afterMetrics = params.includeAfter ? buildMetrics(`${params.seed}-after`) : undefined;
  const comparison = buildComparison(params.kpiKey, beforeMetrics, afterMetrics);
  const causeLabel = CAUSE_LABEL_BY_KEY[params.causeKey] ?? params.causeKey;
  const title = `[${causeLabel}] ${params.areaLabel} ${STAGE_LABEL[params.stageKey]} 개입`;

  return {
    id: params.id,
    title,
    stageKey: params.stageKey,
    areaKey: `${params.regionId}:${params.areaLabel}`,
    areaLabel: params.areaLabel,
    region: params.areaLabel,
    kpiKey: params.kpiKey,
    type: params.type,
    status: params.status,
    owner: params.owner,
    createdAt: params.createdAt,
    dueAt: params.dueAt,
    ruleId: params.ruleId,
    createdFrom: {
      causeKey: params.causeKey,
      kpiKey: params.kpiKey,
      snapshot: {
        kpiValue: comparison.before.value,
        backlogCount: comparison.before.backlog,
        avgDwell: Number(seeded(`${params.seed}-dwell`, 24, 96).toFixed(1)),
        deltaVsRegional: Number(seeded(`${params.seed}-delta`, -12, 24).toFixed(1)),
        unit: KPI_UNIT[params.kpiKey],
      },
    },
    expectedEffectTags: effectTagsByKpi(params.kpiKey),
    logs: buildLogs(params.seed, params.owner, params.status, params.createdAt),
    kpiComparison: comparison,
    notes: params.notes ?? safeOpsText(`${params.areaLabel} 대상 ${TYPE_LABEL[params.type]} 지시 항목`),
    evidenceLinks: ['/regional/bottleneck', 'https://hospital.example.local/sync'],
    beforeMetrics,
    afterMetrics,
    timeline: [
      {
        id: `${params.id}-timeline-created`,
        at: params.createdAt,
        actor: '시스템',
        message: safeOpsText('개입 항목 생성'),
      },
    ],
  };
}

function buildInitialInterventions(regionId: string, districts: string[]): Intervention[] {
  const localDistricts = districts.length ? districts : ['권역 전체'];
  const now = Date.now();
  const templates: Array<{
    kpiKey: KpiKey;
    status: InterventionStatus;
    stageKey: InterventionStageKey;
    causeKey: string;
    type: InterventionType;
    includeAfter: boolean;
  }> = [
    {
      kpiKey: 'regionalQueueRisk',
      status: 'IN_PROGRESS',
      stageKey: 'Stage2',
      causeKey: 'staff_shortage',
      type: 'STAFFING',
      includeAfter: true,
    },
    {
      kpiKey: 'regionalDxDelayHotspot',
      status: 'TODO',
      stageKey: 'Stage2',
      causeKey: 'hospital_slot_delay',
      type: 'PATHWAY_TUNE',
      includeAfter: false,
    },
    {
      kpiKey: 'regionalRecontact',
      status: 'DONE',
      stageKey: 'Stage1',
      causeKey: 'contact_failure',
      type: 'RECONTACT_PUSH',
      includeAfter: true,
    },
    {
      kpiKey: 'regionalDataReadiness',
      status: 'BLOCKED',
      stageKey: 'Stage1',
      causeKey: 'data_gap',
      type: 'DATA_FIX',
      includeAfter: false,
    },
    {
      kpiKey: 'regionalAdTransitionHotspot',
      status: 'IN_PROGRESS',
      stageKey: 'Stage3',
      causeKey: 'external_dependency',
      type: 'PATHWAY_TUNE',
      includeAfter: true,
    },
  ];

  return templates.map((template, index) => {
    const createdAt = new Date(now - DAY_MS * (index + 1.4)).toISOString();
    const dueAt = new Date(Date.parse(createdAt) + DAY_MS * (2 + index % 3)).toISOString();
    const areaLabel = localDistricts[index % localDistricts.length];
    return buildIntervention({
      id: `INT-${index + 1}`,
      regionId,
      areaLabel,
      kpiKey: template.kpiKey,
      type: template.type,
      status: template.status,
      owner: OWNER_OPTIONS[index % OWNER_OPTIONS.length],
      stageKey: template.stageKey,
      causeKey: template.causeKey,
      createdAt,
      dueAt,
      includeAfter: template.includeAfter,
      seed: `${regionId}-${areaLabel}-${template.kpiKey}-${index}`,
    });
  });
}

function CountUpValue({
  value,
  unit,
  className,
}: {
  value: number;
  unit: '%' | '건' | '일' | '점';
  className?: string;
}) {
  const [display, setDisplay] = useState(value);

  useEffect(() => {
    const start = display;
    const end = value;
    const startedAt = performance.now();
    const duration = 260;
    let raf = 0;

    const tick = (now: number) => {
      const t = Math.min(1, (now - startedAt) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(start + (end - start) * eased);
      if (t < 1) raf = window.requestAnimationFrame(tick);
    };

    raf = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(raf);
    // display intentionally excluded to avoid perpetual rerender
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return <span className={className}>{formatByUnit(display, unit)}</span>;
}

export function RegionalInterventionsPage({
  region,
  districtOptions,
  selectedKpiKey,
  selectedRegionSgg,
  selectedRange,
  onSelectedKpiKeyChange,
  onSelectedRegionSggChange,
  onSelectedRangeChange,
  pendingDraft,
  onPendingDraftConsumed,
}: RegionalInterventionsPageProps) {
  const [interventions, setInterventions] = useState<Intervention[]>(() => buildInitialInterventions(region.id, districtOptions));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<InterventionStatus | 'ALL'>('ALL');
  const [typeFilter, setTypeFilter] = useState<InterventionType | 'ALL'>('ALL');
  const [ownerFilter, setOwnerFilter] = useState<string>('ALL');
  const [ruleModalOpen, setRuleModalOpen] = useState(false);
  const consumedUrlDraftRef = useRef(false);

  useEffect(() => {
    setInterventions(buildInitialInterventions(region.id, districtOptions));
    setSelectedId(null);
  }, [districtOptions, region.id]);

  const createDraftIntervention = useCallback(
    (draft: InterventionDraft, source: 'manual' | 'url' = 'manual') => {
      const now = new Date().toISOString();
      const areaLabel = draft.region ?? selectedRegionSgg ?? districtOptions[0] ?? `${region.label} 전체`;
      const kpiKey = draft.kpiKey;
      const type = draft.type ?? inferTypeByKpi(kpiKey);
      const stageKey = inferStageByDraft(draft);
      const causeKey = draft.selectedCauseKey ?? defaultCauseByKpi(kpiKey);
      const seed = `${region.id}-${areaLabel}-${kpiKey}-${now}`;
      const notes = source === 'url'
        ? safeOpsText('병목·원인 분석에서 전달된 조건으로 자동 초안 생성')
        : safeOpsText('운영자 수동 생성 초안');

      const created = buildIntervention({
        id: `INT-${Date.now()}`,
        regionId: region.id,
        areaLabel,
        kpiKey,
        type,
        status: 'TODO',
        owner: OWNER_OPTIONS[0],
        stageKey,
        causeKey,
        createdAt: now,
        dueAt: new Date(Date.parse(now) + DAY_MS * 3).toISOString(),
        includeAfter: false,
        seed,
        notes: safeOpsText(
          `${notes}\n[원인] ${CAUSE_LABEL_BY_KEY[causeKey] ?? causeKey}\n[단계] ${STAGE_LABEL[stageKey]}\n[대상] ${draft.selectedArea ?? areaLabel}`,
        ),
      });

      setInterventions((prev) => [created, ...prev]);
      setSelectedId(created.id);
    },
    [districtOptions, region.id, region.label, selectedRegionSgg],
  );

  useEffect(() => {
    if (!pendingDraft) return;
    createDraftIntervention(pendingDraft, 'manual');
    onPendingDraftConsumed?.();
  }, [createDraftIntervention, onPendingDraftConsumed, pendingDraft]);

  useEffect(() => {
    if (pendingDraft || consumedUrlDraftRef.current) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('create') !== '1') return;
    if (params.get('source') !== 'cause') return;
    const kpiParam = params.get('kpi');
    if (!kpiParam) return;

    const rangeParam = params.get('range');
    const range: InternalRangeKey = rangeParam === 'monthly' ? 'month' : rangeParam === 'quarterly' ? 'quarter' : 'week';
    const urlDraft: InterventionDraft = {
      region: params.get('area') ?? selectedRegionSgg ?? null,
      kpiKey: kpiParam as KpiKey,
      range,
      source: 'cause',
      selectedStage: (params.get('stage') as InterventionDraft['selectedStage']) ?? null,
      selectedCauseKey: params.get('cause'),
      selectedArea: params.get('area'),
      primaryDriverStage: params.get('stage') ?? undefined,
    };
    createDraftIntervention(urlDraft, 'url');
    consumedUrlDraftRef.current = true;
  }, [createDraftIntervention, pendingDraft, selectedRegionSgg]);

  const filtered = useMemo(() => {
    return interventions.filter((item) => {
      if (selectedRegionSgg && item.areaLabel !== selectedRegionSgg) return false;
      if (selectedKpiKey && item.kpiKey !== selectedKpiKey) return false;
      if (statusFilter !== 'ALL' && item.status !== statusFilter) return false;
      if (typeFilter !== 'ALL' && item.type !== typeFilter) return false;
      if (ownerFilter !== 'ALL' && item.owner !== ownerFilter) return false;
      return true;
    });
  }, [interventions, ownerFilter, selectedKpiKey, selectedRegionSgg, statusFilter, typeFilter]);

  const selected = useMemo(() => {
    if (!filtered.length) return null;
    if (!selectedId) return filtered[0];
    return filtered.find((item) => item.id === selectedId) ?? filtered[0];
  }, [filtered, selectedId]);

  const attentionCount = useMemo(
    () => filtered.filter((item) => evaluateProgress(item).needsAttention).length,
    [filtered],
  );

  const expectedAutoCreateCount = useMemo(() => {
    if (selectedRegionSgg) return 1;
    return Math.min(4, Math.max(1, districtOptions.length));
  }, [districtOptions.length, selectedRegionSgg]);

  const updateSelectedStatus = (nextStatus: InterventionStatus) => {
    if (!selected) return;
    setInterventions((prev) =>
      prev.map((item) => {
        if (item.id !== selected.id) return item;
        const now = new Date().toISOString();
        const newLog: InterventionLog = {
          id: `${item.id}-status-${Date.now()}`,
          type: nextStatus === 'DONE' ? 'completion' : nextStatus === 'IN_PROGRESS' ? 'adjustment' : 'confirmation',
          actor: '광역 담당자',
          timestamp: now,
          referenceLink: '/regional/actions',
          requiresFollowup: nextStatus !== 'DONE',
          note: safeOpsText(`상태를 ${STATUS_LABEL[nextStatus]}로 변경`),
        };
        return {
          ...item,
          status: nextStatus,
          logs: [...item.logs, newLog],
          timeline: [
            ...item.timeline,
            {
              id: `${item.id}-timeline-${Date.now()}`,
              at: now,
              actor: '광역 담당자',
              message: safeOpsText(`상태 변경: ${STATUS_LABEL[nextStatus]}`),
            },
          ],
        };
      }),
    );
  };

  const handleGenerateAutoInterventions = () => {
    const targets = selectedRegionSgg
      ? [selectedRegionSgg]
      : districtOptions.slice(0, Math.min(4, Math.max(1, districtOptions.length)));
    const now = Date.now();

    const generated = targets.map((target, idx) =>
      buildIntervention({
        id: `INT-AUTO-${now + idx}`,
        regionId: region.id,
        areaLabel: target,
        kpiKey: idx % 2 === 0 ? 'regionalRecontact' : 'regionalDxDelayHotspot',
        type: idx % 2 === 0 ? 'RECONTACT_PUSH' : 'STAFFING',
        status: 'TODO',
        owner: OWNER_OPTIONS[idx % OWNER_OPTIONS.length],
        stageKey: idx % 3 === 0 ? 'Stage1' : idx % 3 === 1 ? 'Stage2' : 'Stage3',
        causeKey: idx % 2 === 0 ? 'contact_failure' : 'hospital_slot_delay',
        createdAt: new Date(now).toISOString(),
        dueAt: new Date(now + DAY_MS * 3).toISOString(),
        includeAfter: false,
        ruleId: AUTO_RULES[idx % AUTO_RULES.length].id,
        seed: `${region.id}-${target}-auto-${idx}`,
        notes: safeOpsText(`자동 개입 생성 규칙 적용: ${AUTO_RULES[idx % AUTO_RULES.length].label}`),
      }),
    );

    setInterventions((prev) => [...generated, ...prev]);
    setSelectedId(generated[0]?.id ?? null);
    setRuleModalOpen(false);
  };

  const selectedProgress = selected ? evaluateProgress(selected) : null;
  const selectedCauseLabel = selected ? (CAUSE_LABEL_BY_KEY[selected.createdFrom.causeKey] ?? selected.createdFrom.causeKey) : '-';

  const timelineRows = useMemo(() => {
    if (!selected) return [];
    const instruction = selected.logs.find((log) => log.type === 'instruction');
    const adjustment = selected.logs.find((log) => log.type === 'adjustment');
    const completion = selected.logs.find((log) => log.type === 'completion');

    return [
      { key: 'created', label: '생성됨', at: selected.createdAt, actor: '시스템', done: true },
      {
        key: 'instruction',
        label: '지시 전달',
        at: instruction?.timestamp,
        actor: instruction?.actor,
        done: Boolean(instruction),
      },
      {
        key: 'progress',
        label: '조치중',
        at: adjustment?.timestamp,
        actor: adjustment?.actor,
        done: selected.status === 'IN_PROGRESS' || selected.status === 'DONE' || selected.status === 'BLOCKED',
      },
      {
        key: 'done',
        label: '완료',
        at: completion?.timestamp,
        actor: completion?.actor,
        done: selected.status === 'DONE',
      },
      {
        key: 'blocked',
        label: '보류/미이행',
        at: selected.status === 'BLOCKED' ? selected.logs[selected.logs.length - 1]?.timestamp : undefined,
        actor: selected.status === 'BLOCKED' ? selected.logs[selected.logs.length - 1]?.actor : undefined,
        done: selected.status === 'BLOCKED' || (selectedProgress?.delayed ?? false),
      },
    ];
  }, [selected, selectedProgress?.delayed]);

  return (
    <div className="h-full overflow-auto bg-gray-50 p-4 space-y-3">
      <div className="bg-white border border-gray-200 rounded-lg p-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <div className="text-sm font-semibold text-gray-800">개입·조치 관리</div>
            <div className="text-[12px] text-gray-500">
              원인 → 지시 → 실행 → 효과를 책임 단위로 추적
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 rounded border border-amber-200 bg-amber-50 text-amber-700 text-xs font-semibold">
              주의 개입 {attentionCount}건
            </span>
            <button
              type="button"
              onClick={() => setRuleModalOpen(true)}
              className="px-3 py-1.5 rounded-md border border-purple-200 bg-purple-50 text-purple-700 text-sm font-medium hover:bg-purple-100"
            >
              거버넌스 누락 자동 개입 생성
            </button>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-1 md:grid-cols-6 gap-2">
          <select
            value={selectedRange}
            onChange={(e) => onSelectedRangeChange(e.target.value as InternalRangeKey)}
            className="px-2 py-1.5 border border-gray-300 rounded text-sm"
          >
            <option value="week">주간</option>
            <option value="month">월간</option>
            <option value="quarter">분기</option>
          </select>

          <select
            value={selectedRegionSgg ?? ''}
            onChange={(e) => onSelectedRegionSggChange(e.target.value || null)}
            className="px-2 py-1.5 border border-gray-300 rounded text-sm"
          >
            <option value="">{region.label} 전체</option>
            {districtOptions.map((district) => (
              <option key={district} value={district}>
                {district}
              </option>
            ))}
          </select>

          <select
            value={selectedKpiKey}
            onChange={(e) => onSelectedKpiKeyChange(e.target.value as KpiKey)}
            className="px-2 py-1.5 border border-gray-300 rounded text-sm"
          >
            {Object.entries(KPI_LABEL).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as InterventionStatus | 'ALL')}
            className="px-2 py-1.5 border border-gray-300 rounded text-sm"
          >
            <option value="ALL">상태 전체</option>
            {Object.entries(STATUS_LABEL).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>

          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as InterventionType | 'ALL')}
            className="px-2 py-1.5 border border-gray-300 rounded text-sm"
          >
            <option value="ALL">유형 전체</option>
            {Object.entries(TYPE_LABEL).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>

          <select
            value={ownerFilter}
            onChange={(e) => setOwnerFilter(e.target.value)}
            className="px-2 py-1.5 border border-gray-300 rounded text-sm"
          >
            <option value="ALL">담당 전체</option>
            {OWNER_OPTIONS.map((owner) => (
              <option key={owner} value={owner}>
                {owner}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[420px_1fr] gap-3 min-h-[700px]">
        <div className="bg-white border border-gray-200 rounded-lg p-3 overflow-y-auto">
          <div className="text-sm font-semibold text-gray-700 mb-2">개입 리스트</div>
          <div className="space-y-2">
            {filtered.map((item) => {
              const progress = evaluateProgress(item);
              const causeLabel = CAUSE_LABEL_BY_KEY[item.createdFrom.causeKey] ?? item.createdFrom.causeKey;
              const dueExceeded = item.dueAt ? Date.now() > Date.parse(item.dueAt) && item.status !== 'DONE' : false;

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSelectedId(item.id)}
                  className={`w-full text-left rounded-lg border p-2.5 transition ${
                    selected?.id === item.id
                      ? 'border-blue-300 bg-blue-50'
                      : progress.needsAttention
                        ? 'border-rose-300 bg-rose-50 hover:bg-rose-100'
                        : 'border-gray-200 bg-white hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-[13px] font-semibold text-gray-900 truncate">{item.title}</div>
                      <div className="mt-0.5 text-[11px] text-gray-600">
                        {item.areaLabel} · {STAGE_LABEL[item.stageKey]} · {TYPE_LABEL[item.type]}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded border ${STATUS_STYLE[item.status]}`}>
                        {STATUS_LABEL[item.status]}
                      </span>
                      {(progress.delayed || dueExceeded) && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded border border-rose-300 bg-rose-100 text-rose-700">
                          지연 위험
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="mt-2 rounded border border-gray-200 bg-white px-2 py-1.5">
                    <div className="text-[10px] text-gray-500">생성 근거</div>
                    <div className="text-[11px] text-gray-700 mt-0.5">
                      {causeLabel} · {KPI_LABEL[item.createdFrom.kpiKey]}
                    </div>
                    <div className="text-[11px] text-gray-700">
                      생성 시 {formatByUnit(item.createdFrom.snapshot.kpiValue, item.createdFrom.snapshot.unit ?? KPI_UNIT[item.kpiKey])}
                    </div>
                  </div>

                  <div className="mt-2 flex flex-wrap gap-1">
                    {item.expectedEffectTags.map((tag) => (
                      <span
                        key={`${item.id}-${tag}`}
                        className="text-[10px] px-1.5 py-0.5 rounded border border-emerald-200 bg-emerald-50 text-emerald-700"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>

                  <div className="mt-2 flex items-center justify-between text-[11px]">
                    <span className="text-gray-500">T+{progress.elapsedDays}일</span>
                    {item.ruleId ? (
                      <span className="text-violet-600 font-medium">{item.ruleId}</span>
                    ) : (
                      <span className="text-gray-500">수동 생성</span>
                    )}
                  </div>
                </button>
              );
            })}

            {!filtered.length && (
              <div className="rounded border border-dashed border-gray-300 bg-gray-50 px-3 py-4 text-sm text-gray-500">
                조건에 맞는 개입 항목이 없습니다.
              </div>
            )}
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-3 overflow-y-auto">
          {!selected && <div className="text-sm text-gray-500">표시할 개입 항목이 없습니다.</div>}
          {selected && (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div>
                  <div className="text-sm font-semibold text-gray-800">{selected.title}</div>
                  <div className="text-[12px] text-gray-500">
                    대상 {selected.areaLabel} · 담당 {selected.owner} · 생성 {formatDate(selected.createdAt)}
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  {(['TODO', 'IN_PROGRESS', 'DONE', 'BLOCKED'] as InterventionStatus[]).map((status) => (
                    <button
                      key={status}
                      type="button"
                      onClick={() => updateSelectedStatus(status)}
                      className={`px-2 py-1 rounded border text-[11px] font-medium ${
                        selected.status === status
                          ? STATUS_STYLE[status]
                          : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      {STATUS_LABEL[status]}
                    </button>
                  ))}
                </div>
              </div>

              <section className="rounded-lg border border-gray-200 p-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-[13px] font-semibold text-gray-800">1) 상태 타임라인</div>
                  {(selectedProgress?.delayed ?? false) && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded border border-rose-300 bg-rose-100 text-rose-700">
                      미이행 3일 이상 경고
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
                  {timelineRows.map((row) => (
                    <div
                      key={row.key}
                      className={`rounded border px-2 py-2 ${row.done ? 'border-blue-200 bg-blue-50' : 'border-gray-200 bg-gray-50'}`}
                    >
                      <div className="text-[11px] font-semibold text-gray-700">{row.label}</div>
                      <div className="text-[10px] text-gray-500 mt-1">{row.at ? formatDateTime(row.at) : '미기록'}</div>
                      <div className="text-[10px] text-gray-500">{row.actor ?? '-'}</div>
                    </div>
                  ))}
                </div>
              </section>

              <section className="rounded-lg border border-gray-200 p-3">
                <div className="text-[13px] font-semibold text-gray-800 mb-2">2) 생성 근거</div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[12px]">
                  <div className="rounded border border-gray-200 bg-gray-50 px-2 py-2">
                    <div className="text-gray-500">병목 원인</div>
                    <div className="mt-1 font-medium text-gray-800">{selectedCauseLabel}</div>
                  </div>
                  <div className="rounded border border-gray-200 bg-gray-50 px-2 py-2">
                    <div className="text-gray-500">영향 Stage</div>
                    <div className="mt-1 font-medium text-gray-800">{STAGE_LABEL[selected.stageKey]}</div>
                  </div>
                  <div className="rounded border border-gray-200 bg-gray-50 px-2 py-2">
                    <div className="text-gray-500">대상 지역</div>
                    <div className="mt-1 font-medium text-gray-800">{selected.areaLabel}</div>
                  </div>
                  <div className="rounded border border-gray-200 bg-gray-50 px-2 py-2">
                    <div className="text-gray-500">생성 당시 KPI Snapshot</div>
                    <div className="mt-1 font-medium text-gray-800">
                      {KPI_LABEL[selected.createdFrom.kpiKey]} {formatByUnit(selected.createdFrom.snapshot.kpiValue, selected.createdFrom.snapshot.unit ?? KPI_UNIT[selected.kpiKey])}
                    </div>
                    <div className="text-gray-600 mt-0.5">
                      적체 {Math.round(selected.createdFrom.snapshot.backlogCount).toLocaleString()}건 · 평균 체류 {selected.createdFrom.snapshot.avgDwell.toFixed(1)}시간
                    </div>
                    <div className="text-gray-600">
                      광역 평균 대비 {selected.createdFrom.snapshot.deltaVsRegional != null ? `${selected.createdFrom.snapshot.deltaVsRegional > 0 ? '+' : ''}${selected.createdFrom.snapshot.deltaVsRegional.toFixed(1)}` : '-'}
                    </div>
                  </div>
                </div>
              </section>

              <section className="rounded-lg border border-gray-200 p-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-[13px] font-semibold text-gray-800">3) KPI Before / After 비교</div>
                  <span className="text-[11px] text-gray-500">{KPI_LABEL[selected.kpiKey]}</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  <div className="rounded border border-gray-200 bg-gray-50 px-2 py-2">
                    <div className="text-[11px] text-gray-500">Before (개입 생성 시점)</div>
                    <div className="mt-1 text-[14px] font-semibold text-gray-900">
                      <CountUpValue value={selected.kpiComparison.before.value} unit={KPI_UNIT[selected.kpiKey]} />
                    </div>
                    <div className="text-[11px] text-gray-600 mt-0.5">
                      적체 {Math.round(selected.kpiComparison.before.backlog).toLocaleString()}건
                    </div>
                  </div>

                  <div className="rounded border border-gray-200 bg-gray-50 px-2 py-2">
                    <div className="text-[11px] text-gray-500">After (최신)</div>
                    {selected.kpiComparison.after ? (
                      <>
                        <div className="mt-1 text-[14px] font-semibold text-gray-900">
                          <CountUpValue value={selected.kpiComparison.after.value} unit={KPI_UNIT[selected.kpiKey]} />
                        </div>
                        <div className="text-[11px] text-gray-600 mt-0.5">
                          적체 {Math.round(selected.kpiComparison.after.backlog).toLocaleString()}건
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="mt-1 text-[13px] font-semibold text-amber-700">데이터 미수집</div>
                        <div className="text-[11px] text-gray-600 mt-0.5">책임 주체: {selected.owner} (센터 보고 지연)</div>
                      </>
                    )}
                  </div>
                </div>

                {selected.kpiComparison.delta && (
                  <div className="mt-2 rounded border border-gray-200 bg-white px-2 py-2 text-[12px]">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">Δ 지표 변화</span>
                      <span
                        className={`font-semibold ${
                          selected.kpiComparison.delta.value === 0
                            ? 'text-gray-700'
                            : selected.kpiComparison.delta.value > 0
                              ? KPI_HIGHER_IS_BETTER[selected.kpiKey]
                                ? 'text-emerald-700'
                                : 'text-rose-700'
                              : KPI_HIGHER_IS_BETTER[selected.kpiKey]
                                ? 'text-rose-700'
                                : 'text-emerald-700'
                        }`}
                      >
                        {selected.kpiComparison.delta.value > 0 ? '+' : ''}
                        {formatByUnit(selected.kpiComparison.delta.value, KPI_UNIT[selected.kpiKey])}
                      </span>
                    </div>
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-gray-600">Δ 적체 건수</span>
                      <span className={`font-semibold ${selected.kpiComparison.delta.backlog > 0 ? 'text-rose-700' : 'text-emerald-700'}`}>
                        {selected.kpiComparison.delta.backlog > 0 ? '+' : ''}
                        {Math.round(selected.kpiComparison.delta.backlog).toLocaleString()}건
                      </span>
                    </div>
                  </div>
                )}
              </section>

              <section className="rounded-lg border border-gray-200 p-3">
                <div className="text-[13px] font-semibold text-gray-800 mb-2">4) 실행 로그 & 책임 추적</div>
                <div className="space-y-2">
                  {selected.logs.map((log) => {
                    const overdue = isFollowupOverdue(log);
                    return (
                      <div key={log.id} className={`rounded border px-2 py-2 ${overdue ? 'border-rose-300 bg-rose-50' : 'border-gray-200 bg-gray-50'}`}>
                        <div className="flex items-center justify-between gap-2">
                          <div className="text-[12px] font-medium text-gray-800">
                            {LOG_TYPE_LABEL[log.type]} · {log.actor}
                          </div>
                          <div className="flex items-center gap-1">
                            {log.requiresFollowup && (
                              <span className={`text-[10px] px-1.5 py-0.5 rounded border ${log.followedUpAt ? 'border-emerald-300 bg-emerald-100 text-emerald-700' : 'border-amber-300 bg-amber-100 text-amber-700'}`}>
                                {log.followedUpAt ? '후속 완료' : '후속 필요'}
                              </span>
                            )}
                            {overdue && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded border border-rose-300 bg-rose-100 text-rose-700">
                                미확인 48시간 초과
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="text-[11px] text-gray-500 mt-0.5">{formatDateTime(log.timestamp)}</div>
                        <div className="text-[12px] text-gray-700 mt-1">{log.note}</div>
                        <div className="mt-1 text-[11px]">
                          {log.referenceLink ? (
                            <a href={log.referenceLink} target="_blank" rel="noreferrer" className="text-blue-700 underline underline-offset-2">
                              근거 링크
                            </a>
                          ) : (
                            <span className="text-gray-500">근거 링크 없음</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            </div>
          )}
        </div>
      </div>

      {ruleModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/35" onClick={() => setRuleModalOpen(false)} />
          <div className="relative w-full max-w-xl rounded-lg border border-gray-200 bg-white p-4 shadow-xl">
            <div className="text-sm font-semibold text-gray-900">거버넌스 누락 자동 개입 생성</div>
            <div className="text-[12px] text-gray-500 mt-1">
              규칙 적용 결과를 미리 확인한 뒤 일괄 생성합니다.
            </div>

            <div className="mt-3 rounded border border-gray-200 bg-gray-50 p-3">
              <div className="text-[12px] font-semibold text-gray-700 mb-1.5">적용 규칙 미리보기</div>
              <div className="space-y-1 text-[12px] text-gray-700">
                {AUTO_RULES.map((rule) => (
                  <div key={rule.id}>- {rule.label}</div>
                ))}
              </div>
            </div>

            <div className="mt-2 rounded border border-violet-200 bg-violet-50 p-3">
              <div className="text-[12px] font-semibold text-violet-800">
                예상 생성 개수: {expectedAutoCreateCount}건
              </div>
            </div>

            <div className="mt-2 rounded border border-gray-200 bg-gray-50 p-3">
              <div className="text-[12px] font-semibold text-gray-700 mb-1.5">담당자 자동 배정 규칙</div>
              <div className="space-y-1 text-[12px] text-gray-700">
                {ASSIGNMENT_RULES.map((rule) => (
                  <div key={rule}>- {rule}</div>
                ))}
              </div>
            </div>

            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setRuleModalOpen(false)}
                className="px-3 py-1.5 rounded border border-gray-300 text-sm text-gray-700 hover:bg-gray-50"
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleGenerateAutoInterventions}
                className="px-3 py-1.5 rounded bg-purple-600 text-sm font-semibold text-white hover:bg-purple-700"
              >
                자동 생성 실행
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

