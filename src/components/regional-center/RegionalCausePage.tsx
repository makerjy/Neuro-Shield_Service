import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  LineChart,
  Line,
  ComposedChart,
  Legend,
  Cell,
  LabelList,
} from 'recharts';
import { AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import type { RegionalScope } from '../geomap/regions';
import type { InternalRangeKey, InterventionDraft, KpiKey } from './opsContracts';
import { safeOpsText } from '../../lib/uiTextGuard';

interface RegionalCausePageProps {
  region: RegionalScope;
  districtOptions: string[];
  selectedKpiKey: KpiKey;
  selectedRegionSgg: string | null;
  selectedRange: InternalRangeKey;
  onSelectedKpiKeyChange: (kpi: KpiKey) => void;
  onSelectedRegionSggChange: (sgg: string | null) => void;
  onSelectedRangeChange: (range: InternalRangeKey) => void;
  onCreateIntervention?: (draft: InterventionDraft) => void;
}

type StageKey = 'contact' | 'recontact' | 'L2' | '3rd';
type CauseOwner = 'center' | 'hospital' | 'system' | 'external';
type RegionalNeed = 'high' | 'medium' | 'low';
type HighlightLevel = 'none' | 'watch' | 'critical';
type TrendAlertType = 'increasing_streak' | 'no_decrease' | 'rebound';
type TrendSeverity = 'watch' | 'critical';

type StageTopCause = { causeKey: string; ratio: number };

type StageBacklogBreakdownItem = {
  stageKey: StageKey;
  stageLabel: string;
  ratio: number;
  count: number;
  avgDwellMinutes: number;
  deltaVsRegionalAvg: number;
  topCauses: StageTopCause[];
};

type CauseTopNItem = {
  causeKey: string;
  causeLabel: string;
  ratio: number;
  count: number;
  meta: {
    owner: CauseOwner;
    actionable: boolean;
    regionalNeed: RegionalNeed;
  };
};

type AreaComparisonItem = {
  areaKey: string;
  areaLabel: string;
  ratio: number;
  count: number;
  deltaVsAvg: number;
  highlightLevel: HighlightLevel;
};

type CauseTrendPoint = {
  dateKey: string;
  count: number;
  ratio: number;
};

type CauseTrendAlert = {
  type: TrendAlertType;
  days: number;
  severity: TrendSeverity;
};

type OperationRecommendation = {
  recId: string;
  evidence: {
    causeKey: string;
    causeLabel: string;
    stageKey: StageKey;
    stageLabel: string;
    areaKey: string | null;
    areaLabel: string;
  };
  action: {
    title: string;
    steps: string[];
    ownerSuggested: CauseOwner;
  };
  expectedEffect: {
    qualitative: string;
  };
  priorityScore: number;
};

const KPI_LABEL: Record<KpiKey, string> = {
  regionalSla: '처리 SLA',
  regionalQueueRisk: '미처리 업무(대기 건수)',
  regionalRecontact: '후속 연락 지연',
  regionalDataReadiness: '운영 데이터 준비',
  regionalGovernance: '거버넌스 로그 완전성',
  regionalAdTransitionHotspot: 'AD 전환 위험',
  regionalDxDelayHotspot: '감별검사 지연',
  regionalScreenToDxRate: '선별→진단 전환율',
};

const STAGE_LABEL: Record<StageKey, string> = {
  contact: '접촉',
  recontact: '재접촉',
  L2: 'L2',
  '3rd': '3차',
};

const STAGE_ORDER: StageKey[] = ['contact', 'recontact', 'L2', '3rd'];
const PERIOD_LABEL: Record<InternalRangeKey, string> = {
  week: '주간',
  month: '월간',
  quarter: '분기',
};

const OWNER_LABEL: Record<CauseOwner, string> = {
  center: '센터',
  hospital: '병원',
  system: '시스템',
  external: '외부',
};

const REGIONAL_NEED_LABEL: Record<RegionalNeed, string> = {
  high: 'High',
  medium: 'Med',
  low: 'Low',
};

const ALERT_STYLE: Record<TrendSeverity, string> = {
  watch: 'bg-amber-50 text-amber-700 border-amber-200',
  critical: 'bg-red-50 text-red-700 border-red-200',
};

const HIGHLIGHT_STYLE: Record<HighlightLevel, string> = {
  none: 'bg-gray-50 text-gray-600 border-gray-200',
  watch: 'bg-amber-50 text-amber-700 border-amber-200',
  critical: 'bg-red-50 text-red-700 border-red-200',
};

const CAUSE_CATALOG: Array<{
  causeKey: string;
  causeLabel: string;
  owner: CauseOwner;
  actionable: boolean;
  regionalNeed: RegionalNeed;
}> = [
  { causeKey: 'staff_shortage', causeLabel: '인력 여유 부족', owner: 'center', actionable: true, regionalNeed: 'high' },
  { causeKey: 'contact_failure', causeLabel: '연락 미성공', owner: 'center', actionable: true, regionalNeed: 'high' },
  { causeKey: 'data_gap', causeLabel: '데이터 부족', owner: 'system', actionable: true, regionalNeed: 'medium' },
  { causeKey: 'hospital_slot_delay', causeLabel: '검사 슬롯 지연', owner: 'hospital', actionable: false, regionalNeed: 'high' },
  { causeKey: 'external_dependency', causeLabel: '외부 연계 지연', owner: 'external', actionable: false, regionalNeed: 'medium' },
];

const STAGE_TOP_CAUSE_MAP: Record<StageKey, string[]> = {
  contact: ['contact_failure', 'staff_shortage', 'data_gap'],
  recontact: ['contact_failure', 'staff_shortage', 'external_dependency'],
  L2: ['data_gap', 'hospital_slot_delay', 'staff_shortage'],
  '3rd': ['hospital_slot_delay', 'external_dependency', 'data_gap'],
};

const CAUSE_STAGE_WEIGHT: Record<string, Record<StageKey, number>> = {
  staff_shortage: { contact: 1.2, recontact: 1.15, L2: 0.95, '3rd': 0.9 },
  contact_failure: { contact: 1.28, recontact: 1.35, L2: 0.8, '3rd': 0.78 },
  data_gap: { contact: 0.84, recontact: 0.88, L2: 1.2, '3rd': 1.16 },
  hospital_slot_delay: { contact: 0.7, recontact: 0.76, L2: 1.22, '3rd': 1.32 },
  external_dependency: { contact: 0.75, recontact: 0.83, L2: 1.06, '3rd': 1.24 },
};

const RECOMMEND_STEP_MAP: Record<string, string[]> = {
  staff_shortage: ['담당 인력 재배치 우선순위 적용', '상위 2개 구역 임시 지원 배치', '48시간 후 처리량 재확인'],
  contact_failure: ['연락 성공 시간대 우선 슬롯 전환', '연락처 정합성 점검 요청', '자동 재접촉 규칙 확대 적용'],
  data_gap: ['필수 누락 필드 보완 요청 발송', '입력 지연 센터 대상 점검 배포', '24시간 내 재수집률 점검'],
  hospital_slot_delay: ['협력 병원 슬롯 증설 요청 발송', '고위험 대상 우선 연계 큐 분리', '연계 지연 알림 루프 활성화'],
  external_dependency: ['외부 연계 지연 티켓 생성', '의존 구간 대체 경로 점검', '지연 구간 주간 보고 플래그 설정'],
};

function hashSeed(input: string): number {
  let h = 0;
  for (let i = 0; i < input.length; i += 1) h = (h * 31 + input.charCodeAt(i)) >>> 0;
  return h;
}

function sv(seed: string, min: number, max: number): number {
  return min + (max - min) * ((hashSeed(seed) % 1000) / 1000);
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function parseStage(value: string | null): StageKey | null {
  if (value === 'contact' || value === 'recontact' || value === 'L2' || value === '3rd') return value;
  return null;
}

function parseRange(value: string | null): InternalRangeKey | null {
  if (value === 'week' || value === 'month' || value === 'quarter') return value;
  return null;
}

function isKpiKey(value: string | null): value is KpiKey {
  if (!value) return false;
  return value in KPI_LABEL;
}

function formatCount(value: number): string {
  return `${Math.round(value).toLocaleString()}건`;
}

function formatRatio(value: number): string {
  return `${value.toFixed(1)}%`;
}

function buildStageBacklogBreakdown(seed: string): StageBacklogBreakdownItem[] {
  const raw = STAGE_ORDER.map((stageKey, idx) => {
    const count = Math.round(sv(`${seed}-${stageKey}-count`, 82 + idx * 12, 360 + idx * 20));
    const avgDwellMinutes = Math.round(sv(`${seed}-${stageKey}-dwell`, 48 + idx * 28, 420 + idx * 35));
    const deltaVsRegionalAvg = Number(sv(`${seed}-${stageKey}-delta`, -18, 22).toFixed(1));
    const topCauses = STAGE_TOP_CAUSE_MAP[stageKey].slice(0, 2).map((causeKey, causeIdx) => ({
      causeKey,
      ratio: Number(sv(`${seed}-${stageKey}-${causeKey}-top-${causeIdx}`, 14, 44 - causeIdx * 6).toFixed(1)),
    }));
    return {
      stageKey,
      stageLabel: STAGE_LABEL[stageKey],
      count,
      avgDwellMinutes,
      deltaVsRegionalAvg,
      topCauses,
    };
  });
  const total = raw.reduce((sum, item) => sum + item.count, 0);
  return raw.map((item) => ({
    ...item,
    ratio: total > 0 ? Number(((item.count / total) * 100).toFixed(1)) : 0,
  }));
}

function buildCauseTopN(seed: string, selectedStage: StageKey | null, selectedArea: string | null): CauseTopNItem[] {
  const rows = CAUSE_CATALOG.map((cause) => {
    const stageWeight = selectedStage ? (CAUSE_STAGE_WEIGHT[cause.causeKey]?.[selectedStage] ?? 1) : 1;
    const areaWeight = selectedArea
      ? 1 + ((hashSeed(`${selectedArea}-${cause.causeKey}`) % 120) - 60) / 700
      : 1;
    const count = Math.max(
      8,
      Math.round(sv(`${seed}-${cause.causeKey}-count`, 42, 260) * stageWeight * areaWeight),
    );
    return {
      ...cause,
      count,
    };
  }).sort((a, b) => b.count - a.count);

  const total = rows.reduce((sum, row) => sum + row.count, 0);
  return rows.map((row) => ({
    causeKey: row.causeKey,
    causeLabel: row.causeLabel,
    ratio: total > 0 ? Number(((row.count / total) * 100).toFixed(1)) : 0,
    count: row.count,
    meta: {
      owner: row.owner,
      actionable: row.actionable,
      regionalNeed: row.regionalNeed,
    },
  }));
}

function buildAreaComparison(
  seed: string,
  districtOptions: string[],
  selectedCauseKey: string | null,
  selectedStage: StageKey | null,
): AreaComparisonItem[] {
  const sample = districtOptions.slice(0, Math.min(10, districtOptions.length));
  if (!sample.length) return [];

  const causeWeight = selectedCauseKey ? 1 + (hashSeed(`${selectedCauseKey}-weight`) % 90) / 200 : 1;
  const stageWeight = selectedStage ? 1 + (hashSeed(`${selectedStage}-weight`) % 70) / 220 : 1;

  const raw = sample.map((district) => {
    const count = Math.round(
      sv(`${seed}-area-${district}-count`, 36, 220) * causeWeight * stageWeight,
    );
    return {
      areaKey: district,
      areaLabel: district,
      count,
    };
  });

  const total = raw.reduce((sum, item) => sum + item.count, 0);
  const withRatio = raw.map((item) => ({
    ...item,
    ratio: total > 0 ? Number(((item.count / total) * 100).toFixed(1)) : 0,
  }));
  const avgRatio = withRatio.reduce((sum, item) => sum + item.ratio, 0) / Math.max(1, withRatio.length);

  return withRatio
    .map((item) => {
      const deltaVsAvg = Number((item.ratio - avgRatio).toFixed(1));
      const abs = Math.abs(deltaVsAvg);
      const highlightLevel: HighlightLevel = abs >= 8 ? 'critical' : abs >= 4 ? 'watch' : 'none';
      return {
        ...item,
        deltaVsAvg,
        highlightLevel,
      };
    })
    .sort((a, b) => b.ratio - a.ratio);
}

function buildTrendPoints(
  seed: string,
  period: InternalRangeKey,
  selectedCauseKey: string | null,
  selectedStage: StageKey | null,
  selectedArea: string | null,
): CauseTrendPoint[] {
  const length = period === 'week' ? 7 : period === 'month' ? 8 : 12;
  const labels = Array.from({ length }, (_, idx) =>
    period === 'week'
      ? `D-${length - 1 - idx}`
      : period === 'month'
        ? `W-${length - 1 - idx}`
        : `M-${length - 1 - idx}`,
  );
  const areaBias = selectedArea ? (hashSeed(`${selectedArea}-trend-bias`) % 90) / 18 : 0;
  const stageBias = selectedStage ? (hashSeed(`${selectedStage}-trend-bias`) % 60) / 20 : 0;
  const causeBias = selectedCauseKey ? (hashSeed(`${selectedCauseKey}-trend-bias`) % 70) / 18 : 0;
  const baseCount = sv(`${seed}-trend-base-count`, 80, 220) + areaBias + stageBias + causeBias;
  const slopeCount = sv(`${seed}-trend-slope-count`, -6, 9);
  const baseRatio = sv(`${seed}-trend-base-ratio`, 10, 36) + causeBias / 3;
  const slopeRatio = sv(`${seed}-trend-slope-ratio`, -1.2, 1.8);

  return labels.map((label, idx) => {
    const countNoise = sv(`${seed}-${label}-count-noise`, -14, 14);
    const ratioNoise = sv(`${seed}-${label}-ratio-noise`, -1.8, 1.8);
    const count = Math.max(1, Math.round(baseCount + slopeCount * idx + countNoise));
    const ratio = Number(clamp(baseRatio + slopeRatio * idx + ratioNoise, 0, 100).toFixed(1));
    return {
      dateKey: label,
      count,
      ratio,
    };
  });
}

function deriveTrendAlerts(points: CauseTrendPoint[]): CauseTrendAlert[] {
  if (points.length < 3) return [];

  const alerts: CauseTrendAlert[] = [];
  let increasingStreak = 1;
  for (let i = points.length - 1; i > 0; i -= 1) {
    if (points[i].ratio > points[i - 1].ratio) increasingStreak += 1;
    else break;
  }
  if (increasingStreak >= 3) {
    alerts.push({
      type: 'increasing_streak',
      days: increasingStreak,
      severity: increasingStreak >= 5 ? 'critical' : 'watch',
    });
  }

  const recent = points.slice(-Math.min(5, points.length));
  const hasDecrease = recent.some((point, idx) => idx > 0 && point.ratio < recent[idx - 1].ratio);
  if (!hasDecrease && recent.length >= 4) {
    alerts.push({
      type: 'no_decrease',
      days: recent.length,
      severity: recent.length >= 5 ? 'critical' : 'watch',
    });
  }

  const pivotIndex = Math.max(1, points.length - 4);
  const pivotWindow = points.slice(pivotIndex - 1);
  const ratioSeries = pivotWindow.map((point) => point.ratio);
  if (
    ratioSeries.length >= 4 &&
    ratioSeries[1] < ratioSeries[0] &&
    ratioSeries[2] > ratioSeries[1] &&
    ratioSeries[3] > ratioSeries[2]
  ) {
    alerts.push({
      type: 'rebound',
      days: 2,
      severity: 'watch',
    });
  }

  return alerts;
}

function buildStageImpactRows(seed: string) {
  return [
    {
      stage: 'Stage1 (ML)',
      signal: Number(sv(`${seed}-stage1-signal`, -16, 20).toFixed(1)),
      queue: Math.round(sv(`${seed}-stage1-queue`, -20, 48)),
      desc: '보조 신호 변화와 접촉 큐 증감이 함께 나타남',
    },
    {
      stage: 'Stage2 (ANN)',
      signal: Number(sv(`${seed}-stage2-signal`, -14, 18).toFixed(1)),
      queue: Math.round(sv(`${seed}-stage2-queue`, -18, 42)),
      desc: '보조 신호 변화와 2차 대기 증감이 함께 나타남',
    },
    {
      stage: 'Stage3 (CNN)',
      signal: Number(sv(`${seed}-stage3-signal`, -12, 16).toFixed(1)),
      queue: Math.round(sv(`${seed}-stage3-queue`, -16, 38)),
      desc: '보조 신호 변화와 3차 경로 큐 증감이 함께 나타남',
    },
  ];
}

function buildOperationRecommendations(
  seed: string,
  causeRows: CauseTopNItem[],
  stageRows: StageBacklogBreakdownItem[],
  areaRows: AreaComparisonItem[],
  selectedStage: StageKey | null,
  selectedCauseKey: string | null,
  selectedArea: string | null,
): OperationRecommendation[] {
  const stageBasis = selectedStage
    ? stageRows.find((row) => row.stageKey === selectedStage) ?? stageRows[0]
    : stageRows[0];
  const areaBasis = selectedArea
    ? areaRows.find((row) => row.areaKey === selectedArea) ?? areaRows[0]
    : areaRows[0];
  const causeBase = selectedCauseKey
    ? causeRows.filter((row) => row.causeKey === selectedCauseKey)
    : causeRows.slice(0, 3);

  const safeCauses = causeBase.filter(
    (cause): cause is CauseTopNItem =>
      Boolean(cause && typeof cause.ratio === 'number' && typeof cause.count === 'number'),
  );

  return safeCauses.slice(0, 3).map((cause, idx) => {
    const priorityScore = Number(
      (
        cause.ratio * 0.62 +
        (stageBasis?.ratio ?? 0) * 0.22 +
        Math.max(0, areaBasis?.deltaVsAvg ?? 0) * 0.16
      ).toFixed(1),
    );
    const ownerSuggested = cause.meta.owner;
    const steps = RECOMMEND_STEP_MAP[cause.causeKey] ?? [
      '병목 영향 구간 우선 점검',
      '담당 운영자에게 조치 요청 전달',
      '다음 배치 주기에 재확인',
    ];
    return {
      recId: `REC-${idx + 1}-${hashSeed(`${seed}-${cause.causeKey}`)}`,
      evidence: {
        causeKey: cause.causeKey,
        causeLabel: cause.causeLabel,
        stageKey: stageBasis?.stageKey ?? 'contact',
        stageLabel: stageBasis?.stageLabel ?? STAGE_LABEL.contact,
        areaKey: areaBasis?.areaKey ?? null,
        areaLabel: areaBasis?.areaLabel ?? '광역 전체',
      },
      action: {
        title: safeOpsText(`${cause.causeLabel} 중심 병목 해소 조치`),
        steps,
        ownerSuggested,
      },
      expectedEffect: {
        qualitative: safeOpsText('기한 초과 대기 감소와 처리 기한 안정화 기대'),
      },
      priorityScore,
    };
  });
}

function metricToneByDelta(deltaVsAvg: number): string {
  if (deltaVsAvg >= 8) return 'text-red-700';
  if (deltaVsAvg >= 4) return 'text-amber-700';
  if (deltaVsAvg <= -6) return 'text-blue-700';
  return 'text-gray-700';
}

function alertLabel(alert: CauseTrendAlert): string {
  if (alert.type === 'increasing_streak') return `${alert.days}일 연속 증가`;
  if (alert.type === 'no_decrease') return `${alert.days}일 감소 없음`;
  return '감소 후 재상승';
}

function SectionSkeleton() {
  return (
    <div className="animate-pulse space-y-2">
      <div className="h-4 w-1/3 rounded bg-gray-200" />
      <div className="h-40 rounded bg-gray-100" />
      <div className="h-4 w-2/3 rounded bg-gray-200" />
    </div>
  );
}

export function RegionalCausePage({
  region,
  districtOptions,
  selectedKpiKey,
  selectedRegionSgg,
  selectedRange,
  onSelectedKpiKeyChange,
  onSelectedRegionSggChange,
  onSelectedRangeChange,
  onCreateIntervention,
}: RegionalCausePageProps) {
  const initialParams = useMemo(() => new URLSearchParams(window.location.search), []);
  const [stageImpactOn, setStageImpactOn] = useState(initialParams.get('stageImpact') !== '0');
  const [selectedStage, setSelectedStage] = useState<StageKey | null>(parseStage(initialParams.get('stage')));
  const [selectedCauseKey, setSelectedCauseKey] = useState<string | null>(
    initialParams.get('cause') || null,
  );
  const [selectedArea, setSelectedArea] = useState<string | null>(
    initialParams.get('area') || null,
  );
  const urlSyncTimerRef = useRef<number | null>(null);
  const trendSectionRef = useRef<HTMLDivElement | null>(null);

  const applyUrlToState = useCallback(() => {
    const params = new URLSearchParams(window.location.search);
    const nextKpi = params.get('kpi');
    const nextSigungu = params.get('sigungu');
    const nextPeriod = parseRange(params.get('period'));
    if (isKpiKey(nextKpi) && nextKpi !== selectedKpiKey) onSelectedKpiKeyChange(nextKpi);
    if (nextSigungu !== null && nextSigungu !== (selectedRegionSgg ?? '')) {
      onSelectedRegionSggChange(nextSigungu || null);
    }
    if (nextPeriod && nextPeriod !== selectedRange) onSelectedRangeChange(nextPeriod);

    const nextStageImpact = params.get('stageImpact') !== '0';
    const nextStage = parseStage(params.get('stage'));
    const nextCause = params.get('cause') || null;
    const nextArea = params.get('area') || null;

    setStageImpactOn((prev) => (prev === nextStageImpact ? prev : nextStageImpact));
    setSelectedStage((prev) => (prev === nextStage ? prev : nextStage));
    setSelectedCauseKey((prev) => (prev === nextCause ? prev : nextCause));
    setSelectedArea((prev) => (prev === nextArea ? prev : nextArea));
  }, [
    onSelectedKpiKeyChange,
    onSelectedRangeChange,
    onSelectedRegionSggChange,
    selectedKpiKey,
    selectedRange,
    selectedRegionSgg,
  ]);

  useEffect(() => {
    applyUrlToState();
  }, [applyUrlToState]);

  useEffect(() => {
    const onPopState = () => applyUrlToState();
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [applyUrlToState]);

  useEffect(() => {
    if (selectedArea && !districtOptions.includes(selectedArea)) {
      setSelectedArea(null);
    }
  }, [districtOptions, selectedArea]);

  useEffect(() => {
    if (urlSyncTimerRef.current) window.clearTimeout(urlSyncTimerRef.current);
    urlSyncTimerRef.current = window.setTimeout(() => {
      const url = new URL(window.location.href);
      const params = url.searchParams;
      params.set('kpi', selectedKpiKey);
      params.set('period', selectedRange);
      if (selectedRegionSgg) params.set('sigungu', selectedRegionSgg);
      else params.delete('sigungu');

      params.set('stageImpact', stageImpactOn ? '1' : '0');
      if (selectedStage) params.set('stage', selectedStage);
      else params.delete('stage');
      if (selectedCauseKey) params.set('cause', selectedCauseKey);
      else params.delete('cause');
      if (selectedArea) params.set('area', selectedArea);
      else params.delete('area');

      const nextSearch = params.toString();
      if (`?${nextSearch}` !== url.search) {
        window.history.replaceState({}, '', `${url.pathname}?${nextSearch}${url.hash}`);
      }
    }, 180);
    return () => {
      if (urlSyncTimerRef.current) window.clearTimeout(urlSyncTimerRef.current);
    };
  }, [
    selectedArea,
    selectedCauseKey,
    selectedKpiKey,
    selectedRange,
    selectedRegionSgg,
    selectedStage,
    stageImpactOn,
  ]);

  const queryState = useMemo(
    () => ({
      kpiKey: selectedKpiKey,
      sigungu: selectedRegionSgg ?? '',
      period: selectedRange,
      stageImpactOn,
      selectedStage,
      selectedCauseKey,
      selectedArea,
    }),
    [
      selectedArea,
      selectedCauseKey,
      selectedKpiKey,
      selectedRange,
      selectedRegionSgg,
      selectedStage,
      stageImpactOn,
    ],
  );

  const baseSeed = useMemo(
    () => `${region.id}-${queryState.sigungu || 'all'}-${queryState.kpiKey}-${queryState.period}`,
    [queryState.kpiKey, queryState.period, queryState.sigungu, region.id],
  );

  const stageBreakdownQuery = useQuery({
    queryKey: ['regional-cause', 'stage-breakdown', queryState.kpiKey, queryState.sigungu, queryState.period],
    queryFn: async () => buildStageBacklogBreakdown(`${baseSeed}-stage`),
    staleTime: 30_000,
    placeholderData: (prev) => prev,
  });

  const causeTopNQuery = useQuery({
    queryKey: [
      'regional-cause',
      'cause-topn',
      queryState.kpiKey,
      queryState.sigungu,
      queryState.period,
      queryState.selectedStage ?? 'all',
      queryState.selectedArea ?? 'all',
    ],
    queryFn: async () =>
      buildCauseTopN(
        `${baseSeed}-cause`,
        queryState.selectedStage,
        queryState.selectedArea,
      ),
    staleTime: 30_000,
    placeholderData: (prev) => prev,
  });

  const areaComparisonQuery = useQuery({
    queryKey: [
      'regional-cause',
      'area-comparison',
      queryState.kpiKey,
      queryState.sigungu,
      queryState.period,
      queryState.selectedStage ?? 'all',
      queryState.selectedCauseKey ?? 'all',
    ],
    queryFn: async () =>
      buildAreaComparison(
        `${baseSeed}-area-${queryState.selectedCauseKey ?? 'all'}`,
        districtOptions,
        queryState.selectedCauseKey,
        queryState.selectedStage,
      ),
    staleTime: 30_000,
    placeholderData: (prev) => prev,
  });

  const trendQuery = useQuery({
    queryKey: [
      'regional-cause',
      'cause-trend',
      queryState.kpiKey,
      queryState.sigungu,
      queryState.period,
      queryState.selectedStage ?? 'all',
      queryState.selectedCauseKey ?? 'all',
      queryState.selectedArea ?? 'all',
    ],
    queryFn: async () =>
      buildTrendPoints(
        `${baseSeed}-trend`,
        queryState.period,
        queryState.selectedCauseKey,
        queryState.selectedStage,
        queryState.selectedArea,
      ),
    staleTime: 30_000,
    placeholderData: (prev) => prev,
  });

  const recommendationQuery = useQuery({
    queryKey: [
      'regional-cause',
      'recommendation',
      queryState.kpiKey,
      queryState.sigungu,
      queryState.period,
      queryState.selectedStage ?? 'all',
      queryState.selectedCauseKey ?? 'all',
      queryState.selectedArea ?? 'all',
    ],
    queryFn: async () =>
      buildOperationRecommendations(
        `${baseSeed}-rec`,
        buildCauseTopN(`${baseSeed}-rec-cause`, queryState.selectedStage, queryState.selectedArea),
        buildStageBacklogBreakdown(`${baseSeed}-rec-stage`),
        buildAreaComparison(
          `${baseSeed}-rec-area`,
          districtOptions,
          queryState.selectedCauseKey,
          queryState.selectedStage,
        ),
        queryState.selectedStage,
        queryState.selectedCauseKey,
        queryState.selectedArea,
      ),
    staleTime: 30_000,
    placeholderData: (prev) => prev,
  });

  const stageImpactRows = useMemo(
    () => buildStageImpactRows(`${baseSeed}-impact`),
    [baseSeed],
  );

  const stageBreakdown = stageBreakdownQuery.data ?? [];
  const causeTopN = causeTopNQuery.data ?? [];
  const areaComparison = areaComparisonQuery.data ?? [];
  const trendPoints = trendQuery.data ?? [];
  const trendAlerts = useMemo(() => deriveTrendAlerts(trendPoints), [trendPoints]);
  const recommendations = recommendationQuery.data ?? [];

  useEffect(() => {
    if (!causeTopN.length) return;
    if (selectedCauseKey && causeTopN.some((item) => item.causeKey === selectedCauseKey)) return;
    setSelectedCauseKey(causeTopN[0].causeKey);
  }, [causeTopN, selectedCauseKey]);

  useEffect(() => {
    if (!areaComparison.length || !selectedArea) return;
    if (areaComparison.some((item) => item.areaKey === selectedArea)) return;
    setSelectedArea(null);
  }, [areaComparison, selectedArea]);

  const selectedCause = useMemo(
    () => causeTopN.find((item) => item.causeKey === selectedCauseKey) ?? null,
    [causeTopN, selectedCauseKey],
  );

  const selectedAreaItem = useMemo(
    () => areaComparison.find((item) => item.areaKey === selectedArea) ?? null,
    [areaComparison, selectedArea],
  );

  const stageValueLabel = useCallback((props: any) => {
    const { x = 0, y = 0, width = 0, payload, index, value } = props ?? {};
    const row: StageBacklogBreakdownItem | undefined =
      payload ?? (typeof index === 'number' ? stageBreakdown[index] : undefined);
    const ratio = row?.ratio;
    const count = row?.count ?? value;

    if (typeof ratio !== 'number' || typeof count !== 'number') return null;

    return (
      <text x={x + width + 8} y={y + 13} fill="#374151" fontSize={11}>
        {formatRatio(ratio)} · {formatCount(count)}
      </text>
    );
  }, [stageBreakdown]);

  const causeValueLabel = useCallback((props: any) => {
    const { x = 0, y = 0, width = 0, payload, index, value } = props ?? {};
    const row: CauseTopNItem | undefined =
      payload ?? (typeof index === 'number' ? causeTopN[index] : undefined);
    const ratio = row?.ratio;
    const count = row?.count ?? value;

    if (typeof ratio !== 'number' || typeof count !== 'number') return null;

    return (
      <text x={x + width + 8} y={y + 13} fill="#1f2937" fontSize={11}>
        {formatRatio(ratio)} · {formatCount(count)}
      </text>
    );
  }, [causeTopN]);

  const trendInsight = useMemo(() => {
    if (!trendPoints.length) return safeOpsText('추이 데이터 수집중');
    const latest = trendPoints[trendPoints.length - 1];
    return safeOpsText(
      `${latest.dateKey} 기준 ${formatCount(latest.count)} · ${formatRatio(latest.ratio)} (선택 원인 기준)`,
    );
  }, [trendPoints]);

  const createIntervention = useCallback(
    (override?: Partial<{ stage: StageKey | null; causeKey: string | null; area: string | null }>) => {
      const stage = override?.stage ?? selectedStage;
      const cause = override?.causeKey ?? selectedCauseKey;
      const area = override?.area ?? selectedArea ?? selectedRegionSgg;
      const stageLabel = stage ? STAGE_LABEL[stage] : null;
      onCreateIntervention?.({
        region: area ?? null,
        kpiKey: selectedKpiKey,
        range: selectedRange,
        source: 'cause',
        primaryDriverStage: stageLabel ?? undefined,
        selectedStage: stage ?? null,
        selectedCauseKey: cause ?? null,
        selectedArea: area ?? null,
      });
    },
    [
      onCreateIntervention,
      selectedCauseKey,
      selectedKpiKey,
      selectedRange,
      selectedRegionSgg,
      selectedStage,
      selectedArea,
    ],
  );

  const focusEvidence = useCallback((rec: OperationRecommendation) => {
    setSelectedStage(rec.evidence.stageKey);
    setSelectedCauseKey(rec.evidence.causeKey);
    setSelectedArea(rec.evidence.areaKey);
    trendSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  return (
    <div className="h-full overflow-auto bg-gray-50 p-4 space-y-3">
      <div className="bg-white border border-gray-200 rounded-lg p-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <div className="text-sm font-semibold text-gray-800">병목·원인 분석</div>
            <div className="text-[12px] text-gray-500">병목(어디) → 원인(왜) → 조치(무엇을)을 2클릭 이내로 연결</div>
          </div>
          <button
            onClick={() => createIntervention()}
            className="px-3 py-1.5 rounded-md bg-blue-600 text-white text-sm font-medium hover:bg-blue-700"
          >
            개입 만들기
          </button>
        </div>

        <div className="mt-3 grid grid-cols-1 md:grid-cols-5 gap-2">
          <select
            value={selectedKpiKey}
            onChange={(event) => onSelectedKpiKeyChange(event.target.value as KpiKey)}
            className="px-2.5 py-1.5 border border-gray-300 rounded text-sm"
          >
            {Object.entries(KPI_LABEL).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>

          <select
            value={selectedRegionSgg ?? ''}
            onChange={(event) => onSelectedRegionSggChange(event.target.value || null)}
            className="px-2.5 py-1.5 border border-gray-300 rounded text-sm"
          >
            <option value="">{region.label} 전체</option>
            {districtOptions.map((district) => (
              <option key={district} value={district}>
                {district}
              </option>
            ))}
          </select>

          <select
            value={selectedRange}
            onChange={(event) => onSelectedRangeChange(event.target.value as InternalRangeKey)}
            className="px-2.5 py-1.5 border border-gray-300 rounded text-sm"
          >
            <option value="week">주간</option>
            <option value="month">월간</option>
            <option value="quarter">분기</option>
          </select>

          <button
            onClick={() => setStageImpactOn((prev) => !prev)}
            className={`px-2.5 py-1.5 border rounded text-sm flex items-center justify-center gap-1 ${
              stageImpactOn
                ? 'border-indigo-300 bg-indigo-50 text-indigo-700'
                : 'border-gray-300 text-gray-700 hover:bg-gray-50'
            }`}
          >
            Stage 영향 {stageImpactOn ? 'ON' : 'OFF'}{' '}
            {stageImpactOn ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>

          <div className="px-2.5 py-1.5 border border-gray-200 rounded text-xs text-gray-600 flex items-center">
            URL sync: {selectedRegionSgg ?? '광역 전체'} · {PERIOD_LABEL[selectedRange]}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
        <div className="bg-white border border-gray-200 rounded-lg p-3 relative">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm font-semibold text-gray-700">단계별 적체 분해</div>
            <div className="text-[11px] text-gray-500">Stage 선택 시 원인/제안 동기 갱신</div>
          </div>
          {!stageBreakdown.length && stageBreakdownQuery.isPending ? (
            <SectionSkeleton />
          ) : (
            <div style={{ height: 260 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stageBreakdown} margin={{ top: 8, right: 112, left: 0, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                  <XAxis dataKey="stageLabel" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip
                    cursor={{ fill: '#eff6ff' }}
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const row = payload[0].payload as StageBacklogBreakdownItem;
                      return (
                        <div className="rounded border border-gray-200 bg-white px-2 py-1.5 text-[11px] shadow-sm">
                          <div className="font-semibold text-gray-800">{row.stageLabel}</div>
                          <div className="text-gray-700">
                            비율 {formatRatio(row.ratio)} · 건수 {formatCount(row.count)}
                          </div>
                          <div className="text-gray-600">평균 체류시간: {Math.round(row.avgDwellMinutes)}분</div>
                          <div className={metricToneByDelta(row.deltaVsRegionalAvg)}>
                            광역 평균 대비 Δ {row.deltaVsRegionalAvg > 0 ? '+' : ''}
                            {row.deltaVsRegionalAvg.toFixed(1)}%p
                          </div>
                          <div className="text-gray-600">
                            원인 Top2:{' '}
                            {row.topCauses
                              .map((cause) => {
                                const label =
                                  CAUSE_CATALOG.find((item) => item.causeKey === cause.causeKey)?.causeLabel ??
                                  cause.causeKey;
                                return `${label} ${formatRatio(cause.ratio)}`;
                              })
                              .join(' · ')}
                          </div>
                        </div>
                      );
                    }}
                  />
                  <Bar dataKey="count" radius={[5, 5, 0, 0]} onClick={(payload: StageBacklogBreakdownItem) => {
                    setSelectedStage((prev) => (prev === payload.stageKey ? null : payload.stageKey));
                  }}>
                    {stageBreakdown.map((item) => (
                      <Cell
                        key={item.stageKey}
                        fill={selectedStage === item.stageKey ? '#dc2626' : '#f97316'}
                      />
                    ))}
                    <LabelList content={stageValueLabel} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
          <div className="mt-2 flex flex-wrap gap-1.5">
            {stageBreakdown.map((item) => (
              <button
                key={item.stageKey}
                onClick={() =>
                  setSelectedStage((prev) => (prev === item.stageKey ? null : item.stageKey))
                }
                className={`px-2 py-1 rounded border text-[11px] ${
                  selectedStage === item.stageKey
                    ? 'border-red-300 bg-red-50 text-red-700'
                    : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                {item.stageLabel} {formatRatio(item.ratio)} · {formatCount(item.count)}
              </button>
            ))}
          </div>
          {stageBreakdownQuery.isFetching && stageBreakdown.length ? (
            <div className="absolute inset-0 rounded-lg bg-white/40 pointer-events-none" />
          ) : null}
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-3 relative">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm font-semibold text-gray-700">병목 원인 TopN</div>
            <div className="text-[11px] text-gray-500">원인 선택 시 지역/추이/제안 동기 갱신</div>
          </div>
          {!causeTopN.length && causeTopNQuery.isPending ? (
            <SectionSkeleton />
          ) : (
            <>
              <div style={{ height: 260 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={causeTopN} layout="vertical" margin={{ top: 8, right: 110, left: 20, bottom: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f3f4f6" />
                    <XAxis type="number" tick={{ fontSize: 12 }} />
                    <YAxis dataKey="causeLabel" type="category" width={110} tick={{ fontSize: 12 }} />
                    <Tooltip
                      cursor={{ fill: '#fff7ed' }}
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null;
                        const row = payload[0].payload as CauseTopNItem;
                        const actionability = row.meta.actionable
                          ? '광역 즉시 개입 가능'
                          : '광역 직접 개입 어려움(센터/병원 협조 필요)';
                        return (
                          <div className="rounded border border-gray-200 bg-white px-2 py-1.5 text-[11px] shadow-sm">
                            <div className="font-semibold text-gray-800">{row.causeLabel}</div>
                            <div className="text-gray-700">
                              비율 {formatRatio(row.ratio)} · 건수 {formatCount(row.count)}
                            </div>
                            <div className="text-gray-600">책임 주체: {OWNER_LABEL[row.meta.owner]}</div>
                            <div className="text-gray-600">광역 개입 필요도: {REGIONAL_NEED_LABEL[row.meta.regionalNeed]}</div>
                            <div className={row.meta.actionable ? 'text-blue-700' : 'text-amber-700'}>{actionability}</div>
                          </div>
                        );
                      }}
                    />
                    <Bar
                      dataKey="count"
                      radius={[0, 5, 5, 0]}
                      onClick={(payload: CauseTopNItem) => setSelectedCauseKey(payload.causeKey)}
                    >
                      {causeTopN.map((item) => (
                        <Cell
                          key={item.causeKey}
                          fill={selectedCauseKey === item.causeKey ? '#ea580c' : '#f59e0b'}
                        />
                      ))}
                      <LabelList content={causeValueLabel} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="mt-2 space-y-1.5">
                {causeTopN.map((item) => (
                  <button
                    key={item.causeKey}
                    onClick={() => setSelectedCauseKey(item.causeKey)}
                    className={`w-full rounded border px-2 py-1.5 text-left ${
                      selectedCauseKey === item.causeKey
                        ? 'border-orange-300 bg-orange-50'
                        : 'border-gray-200 bg-white hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-[12px] font-medium text-gray-800">{item.causeLabel}</div>
                      <div className="text-[11px] text-gray-600">
                        {formatRatio(item.ratio)} · {formatCount(item.count)}
                      </div>
                    </div>
                    <div className="mt-1 flex flex-wrap gap-1">
                      <span className="rounded border border-gray-200 bg-gray-50 px-1.5 py-0.5 text-[10px] text-gray-600">
                        책임: {OWNER_LABEL[item.meta.owner]}
                      </span>
                      <span className={`rounded border px-1.5 py-0.5 text-[10px] ${item.meta.actionable ? 'border-blue-200 bg-blue-50 text-blue-700' : 'border-amber-200 bg-amber-50 text-amber-700'}`}>
                        즉시 개입: {item.meta.actionable ? 'Yes' : 'No'}
                      </span>
                      <span className={`rounded border px-1.5 py-0.5 text-[10px] ${
                        item.meta.regionalNeed === 'high'
                          ? 'border-red-200 bg-red-50 text-red-700'
                          : item.meta.regionalNeed === 'medium'
                            ? 'border-amber-200 bg-amber-50 text-amber-700'
                            : 'border-emerald-200 bg-emerald-50 text-emerald-700'
                      }`}>
                        광역 필요도: {REGIONAL_NEED_LABEL[item.meta.regionalNeed]}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </>
          )}
          {causeTopNQuery.isFetching && causeTopN.length ? (
            <div className="absolute inset-0 rounded-lg bg-white/40 pointer-events-none" />
          ) : null}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
        <div className="bg-white border border-gray-200 rounded-lg p-3 relative">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm font-semibold text-gray-700">지역 비교 (관할 평균 대비 Δ)</div>
            <div className="text-[11px] text-gray-500">지역 선택 시 개입 대상 자동 반영</div>
          </div>
          {!areaComparison.length && areaComparisonQuery.isPending ? (
            <SectionSkeleton />
          ) : (
            <>
              <div style={{ height: 260 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={areaComparison} margin={{ top: 8, right: 12, left: -8, bottom: 52 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                    <XAxis dataKey="areaLabel" tick={{ fontSize: 11 }} interval={0} angle={-30} textAnchor="end" height={62} />
                    <YAxis yAxisId="left" tick={{ fontSize: 12 }} />
                    <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12 }} />
                    <Tooltip
                      formatter={(value: number, key: string) =>
                        key === 'deltaVsAvg'
                          ? `${value > 0 ? '+' : ''}${Number(value).toFixed(1)}%p`
                          : `${Math.round(Number(value)).toLocaleString()}건`
                      }
                    />
                    <Legend
                      wrapperStyle={{ fontSize: '12px' }}
                      formatter={(name) => (name === 'count' ? '건수' : '관할 평균 대비 Δ')}
                    />
                    <Bar
                      yAxisId="left"
                      dataKey="count"
                      radius={[4, 4, 0, 0]}
                      onClick={(payload: AreaComparisonItem) =>
                        setSelectedArea((prev) => (prev === payload.areaKey ? null : payload.areaKey))
                      }
                    >
                      {areaComparison.map((item) => (
                        <Cell
                          key={item.areaKey}
                          fill={
                            selectedArea === item.areaKey
                              ? '#1d4ed8'
                              : item.highlightLevel === 'critical'
                                ? '#ef4444'
                                : item.highlightLevel === 'watch'
                                  ? '#f59e0b'
                                  : '#93c5fd'
                          }
                        />
                      ))}
                      <LabelList
                        dataKey="count"
                        position="top"
                        formatter={(value: number) => `${Math.round(value)}건`}
                      />
                    </Bar>
                    <Line yAxisId="right" dataKey="deltaVsAvg" stroke="#1d4ed8" strokeWidth={2.1} dot={{ r: 3 }}>
                      <LabelList
                        dataKey="deltaVsAvg"
                        position="top"
                        formatter={(value: number) => `${value > 0 ? '+' : ''}${Number(value).toFixed(1)}`}
                      />
                    </Line>
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {areaComparison.slice(0, 8).map((item) => (
                  <button
                    key={item.areaKey}
                    onClick={() => setSelectedArea((prev) => (prev === item.areaKey ? null : item.areaKey))}
                    className={`rounded border px-2 py-1 text-[11px] ${
                      selectedArea === item.areaKey
                        ? 'border-blue-300 bg-blue-50 text-blue-700'
                        : HIGHLIGHT_STYLE[item.highlightLevel]
                    }`}
                  >
                    {item.areaLabel} · Δ {item.deltaVsAvg > 0 ? '+' : ''}
                    {item.deltaVsAvg.toFixed(1)}%p · {formatCount(item.count)}
                  </button>
                ))}
              </div>
              {selectedArea ? (
                <div className="mt-2">
                  <button
                    onClick={() => createIntervention()}
                    className="h-8 rounded-md border border-blue-200 bg-blue-50 px-3 text-[12px] font-medium text-blue-700 hover:bg-blue-100"
                  >
                    개입·조치 관리로 이동
                  </button>
                </div>
              ) : null}
            </>
          )}
          {areaComparisonQuery.isFetching && areaComparison.length ? (
            <div className="absolute inset-0 rounded-lg bg-white/40 pointer-events-none" />
          ) : null}
        </div>

        <div ref={trendSectionRef} className="bg-white border border-gray-200 rounded-lg p-3 relative">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm font-semibold text-gray-700">원인 변화 추이</div>
            <div className="text-[11px] text-gray-500">{trendInsight}</div>
          </div>
          <div className="mb-2 flex flex-wrap gap-1.5">
            {trendAlerts.length ? (
              trendAlerts.map((alert) => (
                <span
                  key={`${alert.type}-${alert.days}`}
                  className={`rounded border px-2 py-0.5 text-[11px] ${ALERT_STYLE[alert.severity]}`}
                >
                  {alertLabel(alert)}
                </span>
              ))
            ) : (
              <span className="rounded border border-gray-200 bg-gray-50 px-2 py-0.5 text-[11px] text-gray-600">
                급격한 악화 경보 없음
              </span>
            )}
          </div>
          {!trendPoints.length && trendQuery.isPending ? (
            <SectionSkeleton />
          ) : (
            <>
              <div style={{ height: 250 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trendPoints} margin={{ top: 8, right: 12, left: 0, bottom: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                    <XAxis dataKey="dateKey" tick={{ fontSize: 12 }} />
                    <YAxis yAxisId="left" tick={{ fontSize: 12 }} />
                    <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12 }} />
                    <Tooltip
                      content={({ active, payload, label }) => {
                        if (!active || !payload?.length) return null;
                        const point = payload[0].payload as CauseTrendPoint;
                        const hasIncreaseAlert = trendAlerts.some((alert) => alert.type === 'increasing_streak');
                        return (
                          <div className="rounded border border-gray-200 bg-white px-2 py-1.5 text-[11px] shadow-sm">
                            <div className="font-semibold text-gray-800">{label}</div>
                            <div className="text-gray-700">건수 {formatCount(point.count)}</div>
                            <div className="text-gray-700">비율 {formatRatio(point.ratio)}</div>
                            {hasIncreaseAlert ? (
                              <>
                                <div className="text-red-700">n일 연속 증가 중</div>
                                <div className="text-red-700">
                                  개입 없을 경우 SLA 위험 확대 가능
                                </div>
                              </>
                            ) : null}
                          </div>
                        );
                      }}
                    />
                    <Legend
                      wrapperStyle={{ fontSize: '12px' }}
                      formatter={(name) => (name === 'count' ? '건수' : '비율')}
                    />
                    <Line yAxisId="left" type="monotone" dataKey="count" stroke="#ef4444" strokeWidth={2.2} dot={{ r: 3 }}>
                      <LabelList dataKey="count" position="top" formatter={(value: number) => `${Math.round(value)}`} />
                    </Line>
                    <Line yAxisId="right" type="monotone" dataKey="ratio" stroke="#f59e0b" strokeWidth={2.2} dot={{ r: 3 }}>
                      <LabelList dataKey="ratio" position="bottom" formatter={(value: number) => `${Number(value).toFixed(1)}%`} />
                    </Line>
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-2 text-[11px] text-gray-600">
                {trendAlerts.some((alert) => alert.type === 'increasing_streak')
                  ? '개입 없을 경우 SLA 위험 확대 가능'
                  : '현재 추이는 단기 변동 범위 내에서 관찰 중'}
              </div>
            </>
          )}
          {trendQuery.isFetching && trendPoints.length ? (
            <div className="absolute inset-0 rounded-lg bg-white/40 pointer-events-none" />
          ) : null}
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-3">
        <div className="flex items-center gap-1.5 mb-2">
          <AlertTriangle className="h-4 w-4 text-orange-500" />
          <span className="text-sm font-semibold text-gray-700">운영 제안</span>
        </div>
        {!recommendations.length && recommendationQuery.isPending ? (
          <SectionSkeleton />
        ) : (
          <div className="space-y-2">
            {recommendations.map((rec) => (
              <div key={rec.recId} className="p-2 rounded border border-orange-100 bg-orange-50">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-[13px] font-medium text-orange-900">{rec.action.title}</div>
                  <div className="text-[11px] text-orange-700">우선순위 {rec.priorityScore}</div>
                </div>
                <div className="mt-1 text-[12px] text-orange-800">
                  근거 원인: {rec.evidence.causeLabel} · 영향 Stage: {rec.evidence.stageLabel} · 대상 지역: {rec.evidence.areaLabel}
                </div>
                <div className="mt-1 text-[12px] text-orange-900">
                  권장 조치: {rec.action.steps.join(' → ')}
                </div>
                <div className="mt-1 text-[12px] text-orange-800">예상 효과: {rec.expectedEffect.qualitative}</div>
                <div className="mt-2 flex items-center gap-2">
                  <button
                    onClick={() =>
                      createIntervention({
                        stage: rec.evidence.stageKey,
                        causeKey: rec.evidence.causeKey,
                        area: rec.evidence.areaKey,
                      })
                    }
                    className="h-8 rounded-md bg-blue-600 px-3 text-[12px] font-medium text-white hover:bg-blue-700"
                  >
                    개입 항목 생성
                  </button>
                  <button
                    onClick={() => focusEvidence(rec)}
                    className="h-8 rounded-md border border-orange-200 bg-white px-3 text-[12px] font-medium text-orange-700 hover:bg-orange-100"
                  >
                    세부 근거 보기
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {stageImpactOn && (
        <div className="bg-white border border-gray-200 rounded-lg p-3">
          <div className="text-sm font-semibold text-gray-700 mb-2">Stage 영향 (기본 접힘)</div>
          <div className="space-y-2">
            {stageImpactRows.map((item) => (
              <div key={item.stage} className="p-2 rounded border border-gray-100 bg-gray-50">
                <div className="text-[13px] font-medium text-gray-800">{item.stage}</div>
                <div className="text-[12px] text-gray-600">
                  보조 신호 {item.signal > 0 ? '증가' : '감소'} ({item.signal > 0 ? '+' : ''}
                  {item.signal}%) · 큐 {item.queue > 0 ? '증가' : '감소'} ({item.queue > 0 ? '+' : ''}
                  {item.queue}건)
                </div>
                <div className="text-[11px] text-gray-500">{item.desc}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="text-[12px] text-gray-500">
        기준: {region.label} · {selectedRegionSgg ?? '광역 전체'} · {KPI_LABEL[selectedKpiKey]} · {PERIOD_LABEL[selectedRange]}
        {selectedCause ? ` · 선택 원인: ${selectedCause.causeLabel}` : ''}
        {selectedAreaItem ? ` · 선택 지역: ${selectedAreaItem.areaLabel}` : ''}
      </div>
    </div>
  );
}
