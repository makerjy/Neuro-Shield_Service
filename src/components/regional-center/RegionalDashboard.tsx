import React, { useMemo, useState, useCallback, useRef, useEffect } from 'react';
import {
  Download,
  HelpCircle,
  ChevronLeft,
  Home,
  AlertTriangle,
  BarChart3,
  Shield,
  Database,
  Phone,
  ChevronDown,
  ChevronUp,
  ChevronRight,
} from 'lucide-react';
import {
  ResponsiveContainer,
  Treemap,
} from 'recharts';
import { GeoMapPanel, type MapColorScheme } from '../geomap/GeoMapPanel';
import { COLOR_PALETTES } from '../../lib/choroplethScale';
import type { RegionalScope } from '../geomap/regions';
import { safeOpsText } from '../../lib/uiTextGuard';
import {
  OPS_TABLE_COLUMNS,
  loadRegionalSettings,
  OPS_TO_GEO_INDICATOR,
  OPS_COLOR_SCHEME,
  computePriorityScore,
  type RegionalKpiKey,
} from '../../lib/regionalKpiDictionary';
import {
  REGIONAL_DASHBOARD_KPIS,
  REGIONAL_DASHBOARD_KPI_MAP,
  type RegionalDashboardKpiConfig,
} from './RegionalDashboardConfig';
import {
  useDrillNav,
  type DrillViewMode,
} from '../../hooks/useDrillNav';
import {
  ChartCard,
  ChartSkeleton,
  DeltaScatterOrBar,
  DonutBreakdown,
  KpiTrendLine,
  StageContribution,
  TopNHorizontalBar,
} from '../chart-kit/ChartKit';

type AnalyticsPeriod = 'week' | 'month' | 'quarter';
type RangePreset = '24h' | '7d' | '30d' | '90d';

type NamedValue = { name: string; value: number };

type RecontactSlot = {
  slot: string;
  successRate: number;
  attempts: number;
};

type GovernanceStatus = {
  status: '미조치' | '조치중' | '완료';
  value: number;
};

type StageImpact = {
  stage1SignalDelta: number;
  stage1QueueDelta: number;
  stage2SignalDelta: number;
  stage2QueueDelta: number;
  stage3SignalDelta: number;
  stage3QueueDelta: number;
};

type AlertLevel = 'normal' | 'attention' | 'warning';
type RightEvidenceTab = 'drivers' | 'data' | 'trend';

type DistrictOpsData = {
  name: string;
  volume: number;
  kpi: Record<RegionalKpiKey, number>;
  mapMetric: Record<RegionalKpiKey, number>;
  policyImpactLocal: number;
  slaStageContribution: NamedValue[];
  queueTypeBacklog: NamedValue[];
  queueCauseTop: NamedValue[];
  recontactReasons: NamedValue[];
  recontactTrend: { day: string; value: number }[];
  recontactSlots: RecontactSlot[];
  missingFields: NamedValue[];
  collectionLeadtime: NamedValue[];
  governanceMissingTypes: NamedValue[];
  governanceActionStatus: GovernanceStatus[];
  stageImpact: StageImpact;
};

interface RegionalDashboardProps {
  region: RegionalScope;
  selectedKpiKey?: RegionalKpiKey;
  selectedRegionSgg?: string | null;
  selectedRange?: AnalyticsPeriod;
  onSelectedKpiKeyChange?: (kpi: RegionalKpiKey) => void;
  onSelectedRegionSggChange?: (sgg: string | null) => void;
  onSelectedRangeChange?: (range: AnalyticsPeriod) => void;
  onNavigateToCause?: (params: { kpi: RegionalKpiKey; sgg: string | null; range: AnalyticsPeriod }) => void;
  onCreateIntervention?: (params: {
    kpi: RegionalKpiKey;
    sgg: string | null;
    range: AnalyticsPeriod;
    source: 'overview' | 'top5' | 'map';
    primaryDriverStage?: string;
  }) => void;
}

function useResizeObserver<T extends HTMLElement>(): [React.RefObject<T | null>, { width: number; height: number }] {
  const ref = useRef<T | null>(null);
  const [size, setSize] = useState({
    width: typeof window !== 'undefined' ? window.innerWidth : 1920,
    height: typeof window !== 'undefined' ? window.innerHeight : 1080,
  });
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const update = () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => {
        const r = el.getBoundingClientRect();
        setSize((prev) =>
          prev.width === r.width && prev.height === r.height ? prev : { width: r.width, height: r.height },
        );
      });
    };

    const obs = new ResizeObserver(update);
    obs.observe(el);
    window.addEventListener('resize', update, { passive: true });
    update();

    return () => {
      obs.disconnect();
      window.removeEventListener('resize', update);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return [ref, size];
}

const hashSeed = (input: string) => {
  let h = 0;
  for (let i = 0; i < input.length; i += 1) h = (h * 31 + input.charCodeAt(i)) >>> 0;
  return h;
};

const sv = (seed: string, min: number, max: number) => min + (max - min) * ((hashSeed(seed) % 1000) / 1000);

const PERIOD_MUL: Record<AnalyticsPeriod, number> = {
  week: 1,
  month: 1.1,
  quarter: 1.25,
};

const RANGE_PRESET_TO_PERIOD: Record<RangePreset, AnalyticsPeriod> = {
  '24h': 'week',
  '7d': 'week',
  '30d': 'month',
  '90d': 'quarter',
};

const RANGE_PRESET_LABEL: Record<RangePreset, string> = {
  '24h': '24h',
  '7d': '7일',
  '30d': '30일',
  '90d': '90일',
};

const RANGE_COUNT_MUL: Record<RangePreset, number> = {
  '24h': 0.35,
  '7d': 1,
  '30d': 2.8,
  '90d': 6.8,
};

const RANGE_QUEUE_MUL: Record<RangePreset, number> = {
  '24h': 0.85,
  '7d': 1,
  '30d': 1.25,
  '90d': 1.45,
};

const RANGE_RATE_BIAS: Record<RangePreset, number> = {
  '24h': -0.4,
  '7d': 0,
  '30d': 0.5,
  '90d': 0.8,
};

const KPI_RANGE: Record<RegionalKpiKey, [number, number]> = {
  regionalSla: [35, 260],
  regionalQueueRisk: [40, 320],
  regionalRecontact: [3, 21],
  regionalDataReadiness: [4, 24],
  regionalGovernance: [22, 78],
};

const KPI_ICON: Record<RegionalKpiKey, React.ReactNode> = {
  regionalSla: <AlertTriangle className="h-4 w-4" />,
  regionalQueueRisk: <BarChart3 className="h-4 w-4" />,
  regionalRecontact: <Phone className="h-4 w-4" />,
  regionalDataReadiness: <Database className="h-4 w-4" />,
  regionalGovernance: <Shield className="h-4 w-4" />,
};

const DISTRICT_MAP: Record<string, string[]> = {
  seoul: ['강남구', '서초구', '송파구', '강동구', '마포구', '영등포구', '용산구', '종로구', '중구', '성동구', '광진구', '동대문구', '중랑구', '성북구', '강북구', '도봉구', '노원구', '은평구', '서대문구', '양천구', '구로구', '금천구', '동작구', '관악구', '강서구'],
  busan: ['중구', '서구', '동구', '영도구', '부산진구', '동래구', '남구', '북구', '해운대구', '사하구', '금정구', '강서구', '연제구', '수영구', '사상구', '기장군'],
  daegu: ['중구', '동구', '서구', '남구', '북구', '수성구', '달서구', '달성군'],
  incheon: ['중구', '동구', '미추홀구', '연수구', '남동구', '부평구', '계양구', '서구', '강화군', '옹진군'],
  gwangju: ['동구', '서구', '남구', '북구', '광산구'],
  daejeon: ['동구', '중구', '서구', '유성구', '대덕구'],
  ulsan: ['중구', '남구', '동구', '북구', '울주군'],
  sejong: ['세종시'],
  gyeonggi: ['수원시', '성남시', '고양시', '용인시', '부천시', '안산시', '안양시', '남양주시', '화성시', '평택시', '의정부시', '시흥시', '파주시', '김포시', '광명시', '광주시', '군포시', '하남시', '오산시', '이천시'],
  gangwon: ['춘천시', '원주시', '강릉시', '동해시', '태백시', '속초시', '삼척시', '홍천군', '횡성군', '영월군'],
  chungbuk: ['청주시', '충주시', '제천시', '보은군', '옥천군', '영동군', '증평군', '진천군', '괴산군', '음성군'],
  chungnam: ['천안시', '공주시', '보령시', '아산시', '서산시', '논산시', '계룡시', '당진시', '금산군', '부여군'],
  jeonbuk: ['전주시', '군산시', '익산시', '정읍시', '남원시', '김제시', '완주군', '진안군', '무주군', '장수군'],
  jeonnam: ['목포시', '여수시', '순천시', '나주시', '광양시', '담양군', '곡성군', '구례군', '고흥군', '보성군'],
  gyeongbuk: ['포항시', '경주시', '김천시', '안동시', '구미시', '영주시', '영천시', '상주시', '문경시', '경산시'],
  gyeongnam: ['창원시', '진주시', '통영시', '사천시', '김해시', '밀양시', '거제시', '양산시', '의령군', '함안군'],
  jeju: ['제주시', '서귀포시'],
};

const RECONTACT_TIME_SLOTS = ['08-10', '10-12', '12-14', '14-16', '16-18', '18-20'];

function formatKpiValue(key: RegionalKpiKey, value: number): string {
  const cfg = REGIONAL_DASHBOARD_KPI_MAP[key];
  if (cfg.unit === '건') return `${Math.round(value).toLocaleString()}건`;
  if (cfg.unit === '점') return `${Math.round(value)}점`;
  return `${value.toFixed(1)}%`;
}

function mergeNamed(values: NamedValue[][]): NamedValue[] {
  const acc = new Map<string, number>();
  values.forEach((items) => {
    items.forEach((item) => {
      acc.set(item.name, (acc.get(item.name) ?? 0) + item.value);
    });
  });
  return [...acc.entries()]
    .map(([name, value]) => ({ name, value: Number(value.toFixed(1)) }))
    .sort((a, b) => b.value - a.value);
}

function buildDistrictData(
  name: string,
  scopeKey: string,
  period: AnalyticsPeriod,
  rangePreset: RangePreset,
): DistrictOpsData {
  const seed = `${scopeKey}-${period}-${name}`;
  const periodMul = PERIOD_MUL[period];
  const countMul = RANGE_COUNT_MUL[rangePreset] * periodMul;
  const queueMul = RANGE_QUEUE_MUL[rangePreset] * periodMul;
  const rateBias = RANGE_RATE_BIAS[rangePreset];

  const volume = Math.round(sv(`${seed}-volume`, 120, 1100) * countMul);
  const inflowCount = Math.round(
    sv(`${seed}-inflow`, KPI_RANGE.regionalSla[0], KPI_RANGE.regionalSla[1]) * countMul,
  );
  const queueCount = Math.round(
    sv(`${seed}-queue`, KPI_RANGE.regionalQueueRisk[0], KPI_RANGE.regionalQueueRisk[1]) * queueMul,
  );
  const slaRiskRate = Number(
    Math.max(
      KPI_RANGE.regionalRecontact[0],
      Math.min(
        KPI_RANGE.regionalRecontact[1],
        sv(`${seed}-sla-risk`, KPI_RANGE.regionalRecontact[0], KPI_RANGE.regionalRecontact[1]) + rateBias,
      ),
    ).toFixed(1),
  );
  const recontactNeedRate = Number(
    Math.max(
      KPI_RANGE.regionalDataReadiness[0],
      Math.min(
        KPI_RANGE.regionalDataReadiness[1],
        sv(`${seed}-recontact-need`, KPI_RANGE.regionalDataReadiness[0], KPI_RANGE.regionalDataReadiness[1]) +
          rateBias,
      ),
    ).toFixed(1),
  );
  const centerRiskScore = Number(
    Math.max(
      KPI_RANGE.regionalGovernance[0],
      Math.min(
        KPI_RANGE.regionalGovernance[1],
        sv(`${seed}-center-risk`, KPI_RANGE.regionalGovernance[0], KPI_RANGE.regionalGovernance[1]) +
          rateBias * 4,
      ),
    ).toFixed(1),
  );

  const stageRaw = {
    접촉: sv(`${seed}-sla-contact`, 12, 34),
    재접촉: sv(`${seed}-sla-recontact`, 10, 26),
    L2: sv(`${seed}-sla-l2`, 8, 20),
    '2차': sv(`${seed}-sla-s2`, 10, 24),
    '3차': sv(`${seed}-sla-s3`, 8, 20),
  };
  const stageTotal = Object.values(stageRaw).reduce((sum, value) => sum + value, 0);
  const slaStageContribution = Object.entries(stageRaw).map(([stage, value]) => ({
    name: stage,
    value: Number(((value / stageTotal) * 100).toFixed(1)),
  }));

  const queueTypeBacklog = [
    { name: '재접촉 큐', value: Math.round(sv(`${seed}-qt-recontact`, 18, 165) * queueMul) },
    { name: 'L2 큐', value: Math.round(sv(`${seed}-qt-l2`, 14, 132) * queueMul) },
    { name: '2차 큐', value: Math.round(sv(`${seed}-qt-s2`, 10, 120) * queueMul) },
    { name: '3차 큐', value: Math.round(sv(`${seed}-qt-s3`, 8, 95) * queueMul) },
  ];

  const queueCauseTop = [
    { name: '연락 실패', value: Math.round(sv(`${seed}-cause-contact`, 10, 65) * queueMul) },
    { name: '인력 여유 부족', value: Math.round(sv(`${seed}-cause-staff`, 8, 52) * queueMul) },
    { name: '데이터 부족', value: Math.round(sv(`${seed}-cause-data`, 6, 44) * queueMul) },
    { name: '2차/3차 대기', value: Math.round(sv(`${seed}-cause-stage`, 7, 48) * queueMul) },
    { name: '예약 지연', value: Math.round(sv(`${seed}-cause-booking`, 5, 36) * queueMul) },
  ].sort((a, b) => b.value - a.value);

  const recontactReasons = [
    { name: '연락처 오류', value: Math.round(sv(`${seed}-rr-contact`, 12, 58) * queueMul) },
    { name: '미응답', value: Math.round(sv(`${seed}-rr-noanswer`, 18, 82) * queueMul) },
    { name: '시간대 불일치', value: Math.round(sv(`${seed}-rr-time`, 10, 52) * queueMul) },
  ].sort((a, b) => b.value - a.value);

  const recontactTrend = ['D-6', 'D-5', 'D-4', 'D-3', 'D-2', 'D-1', 'D0'].map((day, idx) => ({
    day,
    value: Number(sv(`${seed}-rt-${idx}`, 6, 40).toFixed(1)),
  }));

  const recontactSlots = RECONTACT_TIME_SLOTS.map((slot, idx) => ({
    slot,
    successRate: Number(sv(`${seed}-slot-rate-${idx}`, 42, 88).toFixed(1)),
    attempts: Math.round(sv(`${seed}-slot-attempt-${idx}`, 18, 120) * queueMul),
  }));

  const missingFields = [
    { name: '연락처 최신화', value: Math.round(sv(`${seed}-mf-phone`, 10, 64) * queueMul) },
    { name: '보호자 정보', value: Math.round(sv(`${seed}-mf-guardian`, 8, 44) * queueMul) },
    { name: '기저질환 코드', value: Math.round(sv(`${seed}-mf-condition`, 7, 40) * queueMul) },
    { name: '이전 접촉 이력', value: Math.round(sv(`${seed}-mf-history`, 6, 36) * queueMul) },
  ].sort((a, b) => b.value - a.value);

  const collectionLeadtime = [
    { name: '0-1일', value: Math.round(sv(`${seed}-lead-0`, 22, 96) * queueMul) },
    { name: '2-3일', value: Math.round(sv(`${seed}-lead-1`, 16, 76) * queueMul) },
    { name: '4-7일', value: Math.round(sv(`${seed}-lead-2`, 10, 58) * queueMul) },
    { name: '8일+', value: Math.round(sv(`${seed}-lead-3`, 6, 42) * queueMul) },
  ];

  const governanceMissingTypes = [
    { name: '책임자 미기록', value: Math.round(sv(`${seed}-gov-owner`, 5, 32) * queueMul) },
    { name: '근거 링크 누락', value: Math.round(sv(`${seed}-gov-proof`, 6, 36) * queueMul) },
    { name: '접촉 로그 누락', value: Math.round(sv(`${seed}-gov-log`, 7, 40) * queueMul) },
  ].sort((a, b) => b.value - a.value);

  const governanceActionStatus: GovernanceStatus[] = [
    { status: '미조치', value: Math.round(sv(`${seed}-gact-open`, 8, 48) * queueMul) },
    { status: '조치중', value: Math.round(sv(`${seed}-gact-progress`, 6, 36) * queueMul) },
    { status: '완료', value: Math.round(sv(`${seed}-gact-done`, 4, 30) * queueMul) },
  ];

  const stageImpact: StageImpact = {
    stage1SignalDelta: Number(sv(`${seed}-s1-signal`, -18, 24).toFixed(1)),
    stage1QueueDelta: Math.round(sv(`${seed}-s1-queue`, -14, 36) * queueMul),
    stage2SignalDelta: Number(sv(`${seed}-s2-signal`, -16, 22).toFixed(1)),
    stage2QueueDelta: Math.round(sv(`${seed}-s2-queue`, -12, 32) * queueMul),
    stage3SignalDelta: Number(sv(`${seed}-s3-signal`, -12, 18).toFixed(1)),
    stage3QueueDelta: Math.round(sv(`${seed}-s3-queue`, -10, 26) * queueMul),
  };

  return {
    name,
    volume,
    kpi: {
      regionalSla: inflowCount,
      regionalQueueRisk: queueCount,
      regionalRecontact: slaRiskRate,
      regionalDataReadiness: recontactNeedRate,
      regionalGovernance: centerRiskScore,
    },
    mapMetric: {
      regionalSla: inflowCount,
      regionalQueueRisk: queueCount,
      regionalRecontact: slaRiskRate,
      regionalDataReadiness: recontactNeedRate,
      regionalGovernance: centerRiskScore,
    },
    policyImpactLocal: Number(sv(`${seed}-policy-impact`, 42, 88).toFixed(1)),
    slaStageContribution,
    queueTypeBacklog,
    queueCauseTop,
    recontactReasons,
    recontactTrend,
    recontactSlots,
    missingFields,
    collectionLeadtime,
    governanceMissingTypes,
    governanceActionStatus,
    stageImpact,
  };
}

function aggregateDistrictData(rows: DistrictOpsData[]): DistrictOpsData {
  if (!rows.length) {
    return buildDistrictData('기준없음', 'empty', 'week', '7d');
  }

  const totalVolume = rows.reduce((sum, row) => sum + row.volume, 0);
  const weightOf = (row: DistrictOpsData) => (totalVolume > 0 ? row.volume / totalVolume : 1 / rows.length);

  const weightedKpi = (key: RegionalKpiKey) =>
    Number(rows.reduce((sum, row) => sum + row.kpi[key] * weightOf(row), 0).toFixed(1));

  const weightedMap = (key: RegionalKpiKey) =>
    Number(rows.reduce((sum, row) => sum + row.mapMetric[key] * weightOf(row), 0).toFixed(1));

  const slotMap = new Map<string, { attempts: number; weightedSuccess: number }>();
  rows.forEach((row) => {
    row.recontactSlots.forEach((slot) => {
      const prev = slotMap.get(slot.slot) ?? { attempts: 0, weightedSuccess: 0 };
      slotMap.set(slot.slot, {
        attempts: prev.attempts + slot.attempts,
        weightedSuccess: prev.weightedSuccess + slot.successRate * slot.attempts,
      });
    });
  });

  const mergedSlots: RecontactSlot[] = [...slotMap.entries()].map(([slot, value]) => ({
    slot,
    attempts: value.attempts,
    successRate: value.attempts > 0 ? Number((value.weightedSuccess / value.attempts).toFixed(1)) : 0,
  }));

  const trendLength = rows[0].recontactTrend.length;
  const mergedTrend = Array.from({ length: trendLength }, (_, idx) => {
    const day = rows[0].recontactTrend[idx].day;
    const value = Number(
      rows.reduce((sum, row) => sum + row.recontactTrend[idx].value * weightOf(row), 0).toFixed(1),
    );
    return { day, value };
  });

  const stageImpact: StageImpact = {
    stage1SignalDelta: Number(rows.reduce((sum, row) => sum + row.stageImpact.stage1SignalDelta * weightOf(row), 0).toFixed(1)),
    stage1QueueDelta: Math.round(rows.reduce((sum, row) => sum + row.stageImpact.stage1QueueDelta * weightOf(row), 0)),
    stage2SignalDelta: Number(rows.reduce((sum, row) => sum + row.stageImpact.stage2SignalDelta * weightOf(row), 0).toFixed(1)),
    stage2QueueDelta: Math.round(rows.reduce((sum, row) => sum + row.stageImpact.stage2QueueDelta * weightOf(row), 0)),
    stage3SignalDelta: Number(rows.reduce((sum, row) => sum + row.stageImpact.stage3SignalDelta * weightOf(row), 0).toFixed(1)),
    stage3QueueDelta: Math.round(rows.reduce((sum, row) => sum + row.stageImpact.stage3QueueDelta * weightOf(row), 0)),
  };

  return {
    name: '광역 평균',
    volume: totalVolume,
    kpi: {
      regionalSla: weightedKpi('regionalSla'),
      regionalQueueRisk: weightedKpi('regionalQueueRisk'),
      regionalRecontact: weightedKpi('regionalRecontact'),
      regionalDataReadiness: weightedKpi('regionalDataReadiness'),
      regionalGovernance: weightedKpi('regionalGovernance'),
    },
    mapMetric: {
      regionalSla: weightedMap('regionalSla'),
      regionalQueueRisk: weightedMap('regionalQueueRisk'),
      regionalRecontact: weightedMap('regionalRecontact'),
      regionalDataReadiness: weightedMap('regionalDataReadiness'),
      regionalGovernance: weightedMap('regionalGovernance'),
    },
    policyImpactLocal: Number(rows.reduce((sum, row) => sum + row.policyImpactLocal * weightOf(row), 0).toFixed(1)),
    slaStageContribution: mergeNamed(rows.map((row) => row.slaStageContribution)),
    queueTypeBacklog: mergeNamed(rows.map((row) => row.queueTypeBacklog)),
    queueCauseTop: mergeNamed(rows.map((row) => row.queueCauseTop)),
    recontactReasons: mergeNamed(rows.map((row) => row.recontactReasons)),
    recontactTrend: mergedTrend,
    recontactSlots: mergedSlots,
    missingFields: mergeNamed(rows.map((row) => row.missingFields)),
    collectionLeadtime: mergeNamed(rows.map((row) => row.collectionLeadtime)),
    governanceMissingTypes: mergeNamed(rows.map((row) => row.governanceMissingTypes)),
    governanceActionStatus: mergeNamed(rows.map((row) => row.governanceActionStatus.map((s) => ({ name: s.status, value: s.value }))))
      .map((item) => ({ status: item.name as GovernanceStatus['status'], value: item.value })),
    stageImpact,
  };
}

function determineDirection(kpiKey: RegionalKpiKey): 'higherWorse' | 'higherBetter' {
  return REGIONAL_DASHBOARD_KPI_MAP[kpiKey]?.direction ?? 'higherWorse';
}

function formatDeltaValue(kpiKey: RegionalKpiKey, delta: number): string {
  const cfg = REGIONAL_DASHBOARD_KPI_MAP[kpiKey];
  if (cfg?.unit === '건') return `${delta > 0 ? '+' : ''}${Math.round(delta)}건`;
  if (cfg?.unit === '점') return `${delta > 0 ? '+' : ''}${Math.round(delta)}점`;
  return `${delta > 0 ? '+' : ''}${delta.toFixed(1)}%p`;
}

function getAlertLevel(kpiKey: RegionalKpiKey, value: number, target?: number): AlertLevel {
  if (!target) return 'normal';
  const direction = determineDirection(kpiKey);
  const gap = direction === 'higherBetter' ? target - value : value - target;
  if (gap >= 8) return 'warning';
  if (gap >= 3) return 'attention';
  return 'normal';
}

function getKpiTooltipLines(label: string, detail: string, scopeLine: string, clickAction: string): string[] {
  return [
    `${label}: ${detail}`,
    `집계 범위: ${scopeLine}`,
    clickAction,
  ];
}

export function RegionalDashboard({
  region,
  selectedKpiKey: selectedKpiKeyProp,
  selectedRegionSgg: selectedRegionSggProp,
  selectedRange: selectedRangeProp,
  onSelectedKpiKeyChange,
  onSelectedRegionSggChange,
  onSelectedRangeChange,
  onNavigateToCause,
  onCreateIntervention,
}: RegionalDashboardProps) {
  const [analyticsPeriodState, setAnalyticsPeriodState] = useState<AnalyticsPeriod>('week');
  const [rangePresetState, setRangePresetState] = useState<RangePreset>('7d');
  const [selectedKpiKeyState, setSelectedKpiKeyState] = useState<RegionalKpiKey>('regionalSla');
  const [visualizationMode, setVisualizationMode] = useState<DrillViewMode>('geomap');
  const [containerRef, containerSize] = useResizeObserver<HTMLDivElement>();
  const [selectedDistrictNameState, setSelectedDistrictNameState] = useState<string | null>(null);
  const [tooltipTarget, setTooltipTarget] = useState<string | null>(null);
  const [mapDrillLevel, setMapDrillLevel] = useState<'ctprvn' | 'sig' | 'emd' | undefined>(undefined);
  const [mapDrillCode, setMapDrillCode] = useState<string | undefined>(undefined);
  const [sigunguRegions, setSigunguRegions] = useState<Array<{ code: string; name: string }>>([]);
  const [stageImpactOpen, setStageImpactOpen] = useState(false);
  const [showLeftDetails, setShowLeftDetails] = useState(false);
  const [showBottomTable, setShowBottomTable] = useState(false);
  const [selectedCauseName, setSelectedCauseName] = useState<string | null>(null);
  const [rightEvidenceTab, setRightEvidenceTab] = useState<RightEvidenceTab>('drivers');
  const [isVizLoading, setIsVizLoading] = useState(false);
  const [showExtendedTopN, setShowExtendedTopN] = useState(false);

  const settings = useMemo(() => loadRegionalSettings(region.id), [region.id]);

  const analyticsPeriod = selectedRangeProp ?? analyticsPeriodState;
  const rangePreset =
    analyticsPeriod === 'month' ? '30d' : analyticsPeriod === 'quarter' ? '90d' : rangePresetState;
  const selectedKpiKey = selectedKpiKeyProp ?? selectedKpiKeyState;
  const selectedDistrictName = selectedRegionSggProp ?? selectedDistrictNameState;

  const drillNav = useDrillNav({
    root: {
      level: 'REGION',
      id: region.ctprvnCode,
      label: region.label,
    },
    initialFilters: {
      kpi: selectedKpiKey,
      range: rangePreset,
      view: visualizationMode,
    },
  });
  const {
    stack: drillStack,
    current: drillCurrent,
    canGoBack: drillCanGoBack,
    push: pushDrill,
    back: backDrill,
    jumpTo: jumpDrill,
    reset: resetDrill,
    syncFilters: syncDrillFilters,
  } = drillNav;

  const updateSelectedKpiKey = useCallback(
    (next: RegionalKpiKey) => {
      if (selectedKpiKeyProp == null) setSelectedKpiKeyState(next);
      onSelectedKpiKeyChange?.(next);
    },
    [onSelectedKpiKeyChange, selectedKpiKeyProp],
  );

  const updateSelectedRange = useCallback(
    (next: AnalyticsPeriod) => {
      if (selectedRangeProp == null) setAnalyticsPeriodState(next);
      onSelectedRangeChange?.(next);
    },
    [onSelectedRangeChange, selectedRangeProp],
  );

  const handleRangePresetChange = useCallback(
    (preset: RangePreset) => {
      setRangePresetState(preset);
      updateSelectedRange(RANGE_PRESET_TO_PERIOD[preset]);
    },
    [updateSelectedRange],
  );

  const updateSelectedDistrict = useCallback(
    (next: string | null) => {
      if (selectedRegionSggProp == null) setSelectedDistrictNameState(next);
      onSelectedRegionSggChange?.(next);
    },
    [onSelectedRegionSggChange, selectedRegionSggProp],
  );

  useEffect(() => {
    updateSelectedDistrict(null);
    setMapDrillLevel(undefined);
    setMapDrillCode(undefined);
    setStageImpactOpen(false);
    setRightEvidenceTab('drivers');
  }, [region.id, updateSelectedDistrict]);

  useEffect(() => {
    if (analyticsPeriod === 'month' && rangePresetState !== '30d') setRangePresetState('30d');
    if (analyticsPeriod === 'quarter' && rangePresetState !== '90d') setRangePresetState('90d');
  }, [analyticsPeriod, rangePresetState]);

  useEffect(() => {
    setSelectedCauseName(null);
  }, [selectedKpiKey, selectedDistrictName]);

  useEffect(() => {
    setRightEvidenceTab('drivers');
    setShowExtendedTopN(false);
  }, [selectedDistrictName, selectedKpiKey]);

  useEffect(() => {
    syncDrillFilters(
      {
        kpi: selectedKpiKey,
        range: rangePreset,
        view: visualizationMode,
      },
      'replace',
    );
  }, [rangePreset, selectedKpiKey, syncDrillFilters, visualizationMode]);

  useEffect(() => {
    setIsVizLoading(true);
    const timer = window.setTimeout(() => setIsVizLoading(false), 180);
    return () => window.clearTimeout(timer);
  }, [rangePreset, selectedKpiKey, selectedDistrictName, visualizationMode]);

  useEffect(() => {
    if (drillCurrent.filters.view === visualizationMode) return;
    setVisualizationMode(drillCurrent.filters.view);
  }, [drillCurrent.filters.view, visualizationMode]);

  const layoutMode = useMemo(() => {
    const w = containerSize.width || (typeof window !== 'undefined' ? window.innerWidth : 1920);
    if (w >= 1024) return 'desktop';
    if (w >= 768) return 'tablet';
    return 'mobile';
  }, [containerSize.width]);

  const centerMapHeight = useMemo(() => {
    const viewHeight = containerSize.height || (typeof window !== 'undefined' ? window.innerHeight : 900);
    const reservedHeight = layoutMode === 'desktop' ? 320 : 260;
    return Math.max(360, Math.min(680, Math.round(viewHeight - reservedHeight)));
  }, [containerSize.height, layoutMode]);

  const districts = useMemo(() => DISTRICT_MAP[region.id] ?? DISTRICT_MAP.seoul, [region.id]);
  const districtNameSet = useMemo(() => new Set(districts), [districts]);
  const activeSigunguFromDrill = useMemo(() => {
    for (let idx = drillStack.length - 1; idx >= 0; idx -= 1) {
      const item = drillStack[idx];
      if (item.level !== 'SIGUNGU') continue;
      if (districtNameSet.has(item.label)) return item.label;
    }
    return null;
  }, [districtNameSet, drillStack]);

  // 운영 화면의 단일 컨텍스트는 drill stack이며, 지도/패널 상태를 여기서 동기화한다.
  useEffect(() => {
    if (drillCurrent.level === 'REGION') {
      if (selectedDistrictName !== null) updateSelectedDistrict(null);
      setMapDrillLevel('sig');
      setMapDrillCode(region.ctprvnCode);
      return;
    }

    if (activeSigunguFromDrill && selectedDistrictName !== activeSigunguFromDrill) {
      updateSelectedDistrict(activeSigunguFromDrill);
    }

    if (drillCurrent.level === 'SIGUNGU') {
      setMapDrillLevel('emd');
      setMapDrillCode(drillCurrent.id);
      return;
    }

    setMapDrillLevel('emd');
    setMapDrillCode(drillCurrent.id);
  }, [
    activeSigunguFromDrill,
    drillCurrent.id,
    drillCurrent.level,
    region.ctprvnCode,
    selectedDistrictName,
    updateSelectedDistrict,
  ]);

  useEffect(() => {
    if (!selectedRegionSggProp) return;
    const hasSigungu = drillStack.some(
      (item) => item.level === 'SIGUNGU' && item.label === selectedRegionSggProp,
    );
    if (hasSigungu) return;
    const matched = sigunguRegions.find(
      (item) =>
        item.name.includes(selectedRegionSggProp) || selectedRegionSggProp.includes(item.name),
    );
    pushDrill(
      {
        level: 'SIGUNGU',
        id: matched?.code ?? selectedRegionSggProp,
        label: selectedRegionSggProp,
        filters: {
          kpi: selectedKpiKey,
          range: rangePreset,
          view: visualizationMode,
        },
      },
      'replace',
    );
  }, [
    drillStack,
    pushDrill,
    rangePreset,
    selectedKpiKey,
    selectedRegionSggProp,
    sigunguRegions,
    visualizationMode,
  ]);

  const districtRows = useMemo(
    () => districts.map((name) => buildDistrictData(name, `${region.id}-${rangePreset}`, analyticsPeriod, rangePreset)),
    [districts, region.id, analyticsPeriod, rangePreset],
  );

  const selectedDistrictData = useMemo(
    () => (selectedDistrictName ? districtRows.find((row) => row.name === selectedDistrictName) ?? null : null),
    [districtRows, selectedDistrictName],
  );

  const aggregated = useMemo(() => aggregateDistrictData(districtRows), [districtRows]);
  const focusData = selectedDistrictData ?? aggregated;

  const selectedKpiDef = useMemo<RegionalDashboardKpiConfig>(
    () => REGIONAL_DASHBOARD_KPI_MAP[selectedKpiKey] ?? REGIONAL_DASHBOARD_KPIS[0],
    [selectedKpiKey],
  );

  const topCards = useMemo(() => {
    return REGIONAL_DASHBOARD_KPIS.map((kpi) => {
      const key = kpi.key;
      return {
        ...kpi,
        key,
        value: aggregated.kpi[key],
        mapColorScheme: (OPS_COLOR_SCHEME[key] ?? 'blue') as MapColorScheme,
        tooltipLines: getKpiTooltipLines(kpi.label, kpi.tooltip, kpi.scopeLine, kpi.clickAction),
      };
    });
  }, [aggregated]);

  const mapIndicatorId = OPS_TO_GEO_INDICATOR[selectedKpiKey] ?? 'regional_sla_violation';
  const mapColorScheme = (OPS_COLOR_SCHEME[selectedKpiKey] ?? 'blue') as MapColorScheme;
  const breadcrumbTrail = drillStack;
  const currentDrillLabel =
    drillCurrent.level === 'REGION'
      ? region.label
      : drillCurrent.label;

  const mapHeaderTitle = `${RANGE_PRESET_LABEL[rangePreset]} · ${region.label} · ${selectedKpiDef.shortLabel} · 시군구`;

  const mapValueList = useMemo(
    () => districtRows.map((row) => row.mapMetric[selectedKpiKey]),
    [districtRows, selectedKpiKey],
  );

  const mapMin = useMemo(() => (mapValueList.length ? Math.min(...mapValueList) : 0), [mapValueList]);
  const mapMax = useMemo(() => (mapValueList.length ? Math.max(...mapValueList) : 0), [mapValueList]);
  const mapAvg = useMemo(
    () => (mapValueList.length ? Number((mapValueList.reduce((sum, v) => sum + v, 0) / mapValueList.length).toFixed(1)) : 0),
    [mapValueList],
  );

  const heatmapData = useMemo(() => {
    const palette = COLOR_PALETTES[mapColorScheme as keyof typeof COLOR_PALETTES] ?? COLOR_PALETTES.blue;
    const span = mapMax - mapMin || 1;
    return districtRows.map((row) => {
      const value = row.mapMetric[selectedKpiKey];
      const ratio = (value - mapMin) / span;
      const idx = Math.max(0, Math.min(palette.length - 1, Math.floor(ratio * palette.length)));
      return {
        name: row.name,
        size: Math.max(1, value),
        value,
        fill: palette[idx],
      };
    });
  }, [districtRows, selectedKpiKey, mapMin, mapMax, mapColorScheme]);

  const regionalValue = aggregated.kpi[selectedKpiKey];

  const priorityRows = useMemo(() => {
    const direction = determineDirection(selectedKpiKey);
    const values = districtRows.map((row) => row.kpi[selectedKpiKey]);
    const volumes = districtRows.map((row) => row.volume);
    const valueMin = Math.min(...values);
    const valueMax = Math.max(...values);
    const volumeMin = Math.min(...volumes);
    const volumeMax = Math.max(...volumes);

    return districtRows
      .map((row) => {
        const kpiValue = row.kpi[selectedKpiKey];
        const score = computePriorityScore({
          kpiValue,
          kpiMin: valueMin,
          kpiMax: valueMax,
          volume: row.volume,
          volumeMin,
          volumeMax,
          direction,
        });

        const districtNationalRef = Number(
          sv(`national-${selectedKpiKey}-${rangePreset}-${analyticsPeriod}-${row.name}`, KPI_RANGE[selectedKpiKey][0], KPI_RANGE[selectedKpiKey][1]).toFixed(1),
        );

        return {
          name: row.name,
          kpiValue,
          volume: row.volume,
          priorityScore: score,
          nationalDelta: Number((kpiValue - districtNationalRef).toFixed(1)),
        };
      })
      .sort((a, b) => b.priorityScore - a.priorityScore);
  }, [districtRows, selectedKpiKey, rangePreset, analyticsPeriod]);

  const top5 = useMemo(() => priorityRows.slice(0, 5), [priorityRows]);

  const totalVolume = useMemo(
    () => districtRows.reduce((sum, row) => sum + row.volume, 0),
    [districtRows],
  );

  const top5Concentration = useMemo(() => {
    if (!top5.length || totalVolume <= 0) return null;
    const top5Volume = top5.reduce((sum, row) => sum + row.volume, 0);
    return Number(((top5Volume / totalVolume) * 100).toFixed(1));
  }, [top5, totalVolume]);

  const top5ConcentrationLabel = top5Concentration == null ? '—' : `${top5Concentration.toFixed(1)}%`;

  const selectedDistrictDelta = useMemo(() => {
    if (!selectedDistrictData) return null;
    return Number((selectedDistrictData.kpi[selectedKpiKey] - regionalValue).toFixed(1));
  }, [regionalValue, selectedDistrictData, selectedKpiKey]);

  const districtRowMap = useMemo(() => {
    return new Map(districtRows.map((row) => [row.name, row]));
  }, [districtRows]);

  const geoTooltipExtraLines = useCallback(
    ({ name }: { level: 'ctprvn' | 'sig' | 'emd'; code: string; name: string; value: number }) => {
      const row = districtRowMap.get(name);
      if (!row) return [] as string[];
      const delta7 = Number(sv(`${region.id}-${name}-${selectedKpiKey}-delta7-${rangePreset}-${analyticsPeriod}`, -12, 12).toFixed(1));
      const deltaUnit = selectedKpiDef.unit === '점' ? '점' : selectedKpiDef.unit === '건' ? '건' : '%p';
      return [
        `규모: ${row.volume.toLocaleString()}건`,
        `최근 7일 변화: ${delta7 > 0 ? '+' : ''}${selectedKpiDef.unit === '건' ? Math.round(delta7) : delta7}${deltaUnit}`,
      ];
    },
    [analyticsPeriod, districtRowMap, rangePreset, region.id, selectedKpiDef.unit, selectedKpiKey],
  );

  const handleGoBack = useCallback(() => {
    resetDrill();
    setStageImpactOpen(false);
  }, [resetDrill]);

  const handleDrillBack = useCallback(() => {
    if (!drillCanGoBack) return;
    backDrill();
    setStageImpactOpen(false);
  }, [backDrill, drillCanGoBack]);

  const handleRegionSelect = useCallback(
    ({ level, code, name }: { level: string; code: string; name: string }) => {
      if (level === 'ctprvn') {
        handleGoBack();
        return;
      }
      const matchedDistrict =
        districts.find((district) => district.includes(name) || name.includes(district)) ?? null;
      if (level === 'sig' && (districtNameSet.has(name) || matchedDistrict)) {
        const sigungu = districtNameSet.has(name) ? name : matchedDistrict!;
        updateSelectedDistrict(sigungu);
        setRightEvidenceTab('drivers');
        pushDrill({
          level: 'SIGUNGU',
          id: code,
          label: sigungu,
          filters: {
            kpi: selectedKpiKey,
            range: rangePreset,
            view: visualizationMode,
          },
        });
        return;
      }
      if (level === 'emd') {
        setRightEvidenceTab('drivers');
        pushDrill({
          level: 'EUPMYEONDONG',
          id: code,
          label: name,
          filters: {
            kpi: selectedKpiKey,
            range: rangePreset,
            view: visualizationMode,
          },
        });
      }
    },
    [districtNameSet, districts, handleGoBack, pushDrill, rangePreset, selectedKpiKey, updateSelectedDistrict, visualizationMode],
  );

  const handleSubRegionsChange = useCallback((regions: Array<{ code: string; name: string }>) => {
    const nextSigungu = regions.filter((regionInfo) => regionInfo.code.length <= 5);
    if (nextSigungu.length) {
      setSigunguRegions(nextSigungu);
    }
  }, []);

  const handleTop5Click = useCallback(
    (districtName: string) => {
      const match = sigunguRegions.find(
        (item) => item.name.includes(districtName) || districtName.includes(item.name),
      );
      updateSelectedDistrict(districtName);
      setRightEvidenceTab('drivers');
      pushDrill({
        level: 'SIGUNGU',
        id: match?.code ?? districtName,
        label: districtName,
        filters: {
          kpi: selectedKpiKey,
          range: rangePreset,
          view: visualizationMode,
        },
      });
    },
    [pushDrill, rangePreset, selectedKpiKey, sigunguRegions, updateSelectedDistrict, visualizationMode],
  );

  const trendData = useMemo(() => {
    const points = analyticsPeriod === 'week' ? 7 : 4;
    const labels =
      analyticsPeriod === 'week'
        ? ['월', '화', '수', '목', '금', '토', '일']
        : analyticsPeriod === 'month'
          ? ['1주', '2주', '3주', '4주']
          : ['Q1', 'Q2', 'Q3', 'Q4'];

    const [min, max] = KPI_RANGE[selectedKpiKey];
    const trendCountMul =
      selectedKpiKey === 'regionalSla'
        ? RANGE_COUNT_MUL[rangePreset] * PERIOD_MUL[analyticsPeriod]
        : RANGE_QUEUE_MUL[rangePreset] * PERIOD_MUL[analyticsPeriod];
    const trendRateBias = RANGE_RATE_BIAS[rangePreset];
    const applyTrendScale = (value: number) => {
      if (selectedKpiDef.unit === '건') return Number((value * trendCountMul).toFixed(1));
      if (selectedKpiDef.unit === '점') {
        return Number(
          Math.max(min, Math.min(max, value + trendRateBias * 4)).toFixed(1),
        );
      }
      return Number(
        Math.max(min, Math.min(max, value + trendRateBias)).toFixed(1),
      );
    };

    return Array.from({ length: points }, (_, idx) => {
      const regional = applyTrendScale(
        sv(`${region.id}-${selectedKpiKey}-${analyticsPeriod}-reg-${idx}`, min, max),
      );
      const national = applyTrendScale(
        sv(`national-${selectedKpiKey}-${rangePreset}-${analyticsPeriod}-tr-${idx}`, min, max),
      );
      const district = selectedDistrictName
        ? applyTrendScale(
            sv(
              `${region.id}-${selectedDistrictName}-${selectedKpiKey}-${rangePreset}-${analyticsPeriod}-dist-${idx}`,
              min,
              max,
            ),
          )
        : undefined;

      return {
        label: labels[idx],
        regional,
        national,
        district,
      };
    });
  }, [analyticsPeriod, rangePreset, region.id, selectedDistrictName, selectedKpiDef.unit, selectedKpiKey]);

  const slaRanking = useMemo(() => {
    const avg = Number(
      (districtRows.reduce((sum, row) => sum + row.mapMetric.regionalSla, 0) / Math.max(1, districtRows.length)).toFixed(1),
    );
    return districtRows
      .map((row) => ({
        name: row.name,
        value: row.mapMetric.regionalSla,
        delta: Number((row.mapMetric.regionalSla - avg).toFixed(1)),
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
  }, [districtRows]);

  const governanceRegionalStatus = useMemo(() => {
    const topMissing = districtRows
      .map((row) => ({ name: row.name, missing: row.mapMetric.regionalGovernance, statuses: row.governanceActionStatus }))
      .sort((a, b) => b.missing - a.missing)
      .slice(0, 5);

    return topMissing.map((row) => {
      const open = row.statuses.find((s) => s.status === '미조치')?.value ?? 0;
      const progress = row.statuses.find((s) => s.status === '조치중')?.value ?? 0;
      const done = row.statuses.find((s) => s.status === '완료')?.value ?? 0;
      return {
        name: row.name,
        미조치: open,
        조치중: progress,
        완료: done,
      };
    });
  }, [districtRows]);

  const stageImpactRows = useMemo(() => {
    const s = focusData.stageImpact;
    return [
      {
        stage: 'Stage1 (ML)',
        signal: s.stage1SignalDelta,
        queue: s.stage1QueueDelta,
        desc: '신호 유입 변화가 처리 큐 변화와 함께 나타남',
      },
      {
        stage: 'Stage2 (ANN)',
        signal: s.stage2SignalDelta,
        queue: s.stage2QueueDelta,
        desc: '2차 보조 신호 변화가 2차 검사 큐와 연동됨',
      },
      {
        stage: 'Stage3 (CNN)',
        signal: s.stage3SignalDelta,
        queue: s.stage3QueueDelta,
        desc: '3차 보조 신호 변화가 3차 정밀 경로 큐와 연동됨',
      },
    ];
  }, [focusData.stageImpact]);

  const actionCandidates = useMemo(() => {
    if (selectedKpiKey === 'regionalSla') {
      return [
        safeOpsText('Stage 전환 유입이 큰 구간에 담당 인력 선배치가 필요함'),
        safeOpsText('신규 할당 집중 구역에 첫 접촉 슬롯을 우선 확장할 필요가 있음'),
      ];
    }
    if (selectedKpiKey === 'regionalQueueRisk') {
      return [
        safeOpsText('처리 대기 큐가 큰 구역에 담당 인력 재배치가 필요함'),
        safeOpsText('검사 연계 대기 구간에 예약 슬롯 확장이 필요함'),
      ];
    }
    if (selectedKpiKey === 'regionalRecontact') {
      return [
        safeOpsText('SLA 임박 구역 중심으로 우선순위 재배치가 필요함'),
        safeOpsText('SLA 초과 구간에 즉시 처리 큐 투입이 필요함'),
      ];
    }
    if (selectedKpiKey === 'regionalDataReadiness') {
      return [
        safeOpsText('미응답·반송 비중이 높은 구역에 재접촉 슬롯 확장이 필요함'),
        safeOpsText('번호 오류 누락 구간에 연락처 보정 요청이 필요함'),
      ];
    }
    return [
      safeOpsText('센터 리스크 상위 구역에 지원 티켓 생성이 필요함'),
      safeOpsText('적체·오류 동시 상승 구역에 집중 지원 배치가 필요함'),
    ];
  }, [selectedKpiKey]);

  const causeTopNPreview = useMemo(() => {
    if (selectedKpiKey === 'regionalSla') return focusData.queueTypeBacklog.slice(0, 3);
    if (selectedKpiKey === 'regionalQueueRisk') return focusData.queueCauseTop.slice(0, 3);
    if (selectedKpiKey === 'regionalRecontact') return focusData.slaStageContribution.slice(0, 3);
    if (selectedKpiKey === 'regionalDataReadiness') return focusData.recontactReasons.slice(0, 3);
    return focusData.governanceMissingTypes.slice(0, 3);
  }, [focusData, selectedKpiKey]);

  const normalizedMissingFields = useMemo(
    () => mergeNamed([focusData.missingFields]),
    [focusData.missingFields],
  );

  const primaryDriver = useMemo(() => {
    if (selectedKpiKey === 'regionalSla') {
      const top = [...focusData.queueTypeBacklog].sort((a, b) => b.value - a.value)[0];
      return {
        stage: top?.name ?? '신규 유입',
        valueLabel: top ? `${Math.round(top.value)}건` : '—',
        basis: safeOpsText('유입 물량이 가장 큰 단계'),
      };
    }
    if (selectedKpiKey === 'regionalQueueRisk') {
      const top = focusData.queueCauseTop[0];
      return {
        stage: top?.name ?? '처리 대기',
        valueLabel: top ? `${Math.round(top.value)}건` : '—',
        basis: safeOpsText('처리 중 병목 기여도가 가장 큰 원인'),
      };
    }
    if (selectedKpiKey === 'regionalRecontact') {
      const top = focusData.slaStageContribution[0];
      return {
        stage: top?.name ?? 'SLA 임박',
        valueLabel: top ? `${top.value.toFixed(1)}%` : '—',
        basis: safeOpsText('SLA 위험 기여도가 가장 큰 단계'),
      };
    }
    if (selectedKpiKey === 'regionalDataReadiness') {
      const top = focusData.recontactReasons[0];
      return {
        stage: top?.name ?? '미응답',
        valueLabel: top ? `${Math.round(top.value)}건` : '—',
        basis: safeOpsText('재접촉 필요 사유 비중이 가장 높은 항목'),
      };
    }
    const topRisk = focusData.governanceMissingTypes[0];
    return {
      stage: topRisk?.name ?? '운영 리스크',
      valueLabel: topRisk ? `${Math.round(topRisk.value)}건` : '—',
      basis: safeOpsText('센터 리스크 기여도가 가장 높은 항목'),
    };
  }, [focusData.governanceMissingTypes, focusData.queueCauseTop, focusData.queueTypeBacklog, focusData.recontactReasons, focusData.slaStageContribution, selectedKpiKey]);

  const uiEmphasis = useMemo(() => {
    return {
      primaryDriverStage: primaryDriver.stage,
      alertLevel: getAlertLevel(selectedKpiKey, regionalValue, selectedKpiDef.trendGoal),
    };
  }, [primaryDriver.stage, regionalValue, selectedKpiDef.trendGoal, selectedKpiKey]);

  const activeKpiNarrative = useMemo(() => {
    if (selectedKpiKey === 'regionalSla') {
      return safeOpsText(
        `${uiEmphasis.primaryDriverStage} 구간의 신규 유입 증가로 초기 처리 슬롯 압력이 커지고 있음`,
      );
    }
    if (selectedKpiKey === 'regionalQueueRisk') {
      return safeOpsText(
        `${uiEmphasis.primaryDriverStage} 원인이 처리 대기 증가를 이끌고 있어 우선 개입이 필요함`,
      );
    }
    if (selectedKpiKey === 'regionalRecontact') {
      return safeOpsText('SLA 임박/초과 구간이 커져 우선 처리 순서 재배치가 필요함');
    }
    if (selectedKpiKey === 'regionalDataReadiness') {
      return safeOpsText('미응답·반송 비중이 높아 재접촉 슬롯 확장과 연락 보정이 필요함');
    }
    return safeOpsText('센터 리스크 누적 구역이 늘어 지원 우선순위 재정렬이 필요함');
  }, [selectedKpiKey, uiEmphasis.primaryDriverStage]);

  const topTwoDistrictLabel = useMemo(() => {
    const rows = top5.slice(0, 2).map((row) => row.name);
    return rows.length ? rows.join(', ') : `${region.label} 상위 구역`;
  }, [region.label, top5]);

  const summaryLineCurrent = useMemo(
    () =>
      safeOpsText(
        `${region.label}(광역) ${selectedKpiDef.label} ${formatKpiValue(selectedKpiKey, regionalValue)} (지도 평균 ${formatKpiValue(
          selectedKpiKey,
          mapAvg,
        )}, Δ ${formatDeltaValue(selectedKpiKey, Number((regionalValue - mapAvg).toFixed(1)))})`,
      ),
    [mapAvg, region.label, regionalValue, selectedKpiDef.label, selectedKpiKey],
  );

  const summaryLineRisk = useMemo(
    () =>
      safeOpsText(
        `장기대기 기준 ${settings.thresholds.longWaitDays}일 · 위험 구역 집중도: Top5가 전체의 ${top5ConcentrationLabel}`,
      ),
    [settings.thresholds.longWaitDays, top5ConcentrationLabel],
  );

  const summaryLineAction = useMemo(() => {
    if (selectedKpiKey === 'regionalQueueRisk') {
      return safeOpsText(`이번 주 권장 개입: ${topTwoDistrictLabel}에 담당 인력 재배치와 경로 분산`);
    }
    if (selectedKpiKey === 'regionalRecontact') {
      return safeOpsText(`이번 주 권장 개입: ${topTwoDistrictLabel}에 SLA 임박 큐 우선 배정`);
    }
    if (selectedKpiKey === 'regionalDataReadiness') {
      return safeOpsText(`이번 주 권장 개입: ${topTwoDistrictLabel}에 재접촉 슬롯 확장과 번호 보정`);
    }
    if (selectedKpiKey === 'regionalGovernance') {
      return safeOpsText(`이번 주 권장 개입: ${topTwoDistrictLabel}의 센터 지원 티켓 우선 발행`);
    }
    return safeOpsText(`이번 주 권장 개입: ${topTwoDistrictLabel}에 초기 처리 인력 우선 배치`);
  }, [selectedKpiKey, topTwoDistrictLabel]);

  const selectedPrimaryCause = useMemo(() => {
    if (!selectedDistrictData) return null;
    if (selectedKpiKey === 'regionalSla') return selectedDistrictData.queueTypeBacklog[0]?.name ?? '신규 유입';
    if (selectedKpiKey === 'regionalQueueRisk') return selectedDistrictData.queueCauseTop[0]?.name ?? '연락 실패';
    if (selectedKpiKey === 'regionalRecontact') return selectedDistrictData.slaStageContribution[0]?.name ?? 'SLA 임박';
    if (selectedKpiKey === 'regionalDataReadiness') return selectedDistrictData.recontactReasons[0]?.name ?? '미응답';
    return selectedDistrictData.governanceMissingTypes[0]?.name ?? '책임자 미기록';
  }, [selectedDistrictData, selectedKpiKey]);

  const mapOverlayMessage = useMemo(() => {
    if (selectedDistrictData && selectedDistrictDelta != null) {
      return safeOpsText(
        `${selectedDistrictData.name}: 평균 대비 Δ ${formatDeltaValue(selectedKpiKey, selectedDistrictDelta)} · 원인 1순위: ${selectedPrimaryCause ?? '—'}`,
      );
    }
    return safeOpsText(`Top5 구역이 전체 위험 규모의 ${top5ConcentrationLabel} 차지 (집중 개입 권장)`);
  }, [selectedDistrictData, selectedDistrictDelta, selectedKpiKey, selectedPrimaryCause, top5ConcentrationLabel]);

  const interventionScenarios = useMemo(() => {
    const targetScope = selectedDistrictData ? selectedDistrictData.name : `${region.label} 전체`;
    const backupTarget = top5[0]?.name ?? targetScope;
    const evidence = causeTopNPreview
      .slice(0, 2)
      .map((item) => {
        if (selectedKpiDef.unit === '%') return `${item.name} ${item.value.toFixed(1)}%`;
        if (selectedKpiDef.unit === '점') return `${item.name} ${Math.round(item.value)}점`;
        return `${item.name} ${Math.round(item.value)}건`;
      });

    return [
      {
        id: 'scenario-a',
        target: targetScope,
        action: actionCandidates[0] ?? safeOpsText('운영 슬롯 재배치가 필요함'),
        effect: '효과 추정 준비중',
        risk: safeOpsText('타 구역 처리 지연 가능'),
        evidence: evidence[0] ?? safeOpsText('근거 데이터 수집중'),
      },
      {
        id: 'scenario-b',
        target: backupTarget,
        action: actionCandidates[1] ?? safeOpsText('운영 경로 보완이 필요함'),
        effect: '효과 추정 준비중',
        risk: safeOpsText('단기 적체 변동 가능'),
        evidence: evidence[1] ?? safeOpsText('근거 데이터 수집중'),
      },
    ];
  }, [actionCandidates, causeTopNPreview, region.label, selectedDistrictData, selectedKpiDef.unit, top5]);

  const trendMarkerIndex = useMemo(() => {
    if (trendData.length < 3) return null;
    return Math.max(1, Math.floor(trendData.length / 2));
  }, [trendData]);

  const trendNarrative = useMemo(() => {
    if (!trendData.length) return safeOpsText('추이 데이터 수집중');

    const split = Math.max(1, Math.floor(trendData.length / 2));
    const headAvg = trendData.slice(0, split).reduce((sum, row) => sum + row.regional, 0) / split;
    const tailRows = trendData.slice(split);
    const tailAvg = tailRows.reduce((sum, row) => sum + row.regional, 0) / Math.max(1, tailRows.length);
    const delta = Number((tailAvg - headAvg).toFixed(1));
    const direction = determineDirection(selectedKpiKey);
    const improving = (direction === 'higherBetter' && delta > 0.4) || (direction === 'higherWorse' && delta < -0.4);
    const worsening = (direction === 'higherBetter' && delta < -0.4) || (direction === 'higherWorse' && delta > 0.4);
    const flowText = improving ? '개선 흐름' : worsening ? '정체/악화 압력' : '정체 흐름';
    const periodScope = rangePreset === '24h' ? '최근 24시간' : `${RANGE_PRESET_LABEL[rangePreset]} 구간`;
    return safeOpsText(`${periodScope}: 전반 대비 후반 ${flowText} (개입 마커 기준으로 변화 추적)`);
  }, [rangePreset, selectedKpiKey, trendData]);

  const trendInterventionDeltaLabel = useMemo(() => {
    if (trendMarkerIndex == null || trendMarkerIndex >= trendData.length) return '—';
    const before = trendData.slice(0, trendMarkerIndex).map((row) => row.regional);
    const after = trendData.slice(trendMarkerIndex).map((row) => row.regional);
    if (!before.length || !after.length) return '—';

    const beforeAvg = before.reduce((sum, value) => sum + value, 0) / before.length;
    const afterAvg = after.reduce((sum, value) => sum + value, 0) / after.length;
    const delta = Number((afterAvg - beforeAvg).toFixed(1));
    return formatDeltaValue(selectedKpiKey, delta);
  }, [selectedKpiKey, trendData, trendMarkerIndex]);

  const renderDataEvidencePanel = () => {
    const missingRows = normalizedMissingFields.slice(0, showExtendedTopN ? 7 : 5);
    return (
      <>
        <TopNHorizontalBar
          title="결측 필드 TopN"
          subtitle="라벨 겹침을 줄이기 위해 가로형으로 정렬"
          data={missingRows}
          unit="건"
          color="#16a34a"
          scopeLabel={currentDrillLabel}
          maxItems={showExtendedTopN ? 7 : 5}
          onItemClick={(item) => setSelectedCauseName(item.name)}
        />
        <div className="px-1 -mt-1">
          <button
            onClick={() => setShowExtendedTopN((prev) => !prev)}
            className="text-[11px] px-2 py-1 rounded border border-gray-200 text-gray-600 hover:bg-gray-50"
          >
            {showExtendedTopN ? '접기' : '더보기'}
          </button>
        </div>
        <StageContribution
          title="수집 지연 분포"
          subtitle="리드타임 구간별 건수"
          scopeLabel={currentDrillLabel}
          data={focusData.collectionLeadtime}
          unit="건"
          colorScale={['#22c55e', '#84cc16', '#f59e0b', '#f97316']}
        />
      </>
    );
  };

  const renderTrendEvidencePanel = () => (
    <>
      <KpiTrendLine
        title="추이(전/후)"
        subtitle={trendNarrative}
        data={trendData}
        unit={selectedKpiDef.unit}
        color={selectedKpiDef.color}
        markerIndex={trendMarkerIndex}
        districtLabel={selectedDistrictData?.name}
        scopeLabel={currentDrillLabel}
      />
      <ChartCard title="개입 이후 변화" subtitle={`개입 이후 Δ ${trendInterventionDeltaLabel}`} scopeLabel={currentDrillLabel}>
        <div className="text-[11px] text-blue-700">
          {trendMarkerIndex != null && trendData[trendMarkerIndex]
            ? `개입 마커: ${trendData[trendMarkerIndex].label}`
            : '개입 마커 준비중'}
        </div>
      </ChartCard>
      <ChartCard title="Stage 영향" subtitle="보조 신호와 큐 변화 연동" scopeLabel={currentDrillLabel}>
        <div className="space-y-2">
          {stageImpactRows.map((item) => (
            <div key={item.stage} className="p-2 rounded border border-gray-100 bg-gray-50">
              <div className="text-[12px] font-medium text-gray-800">{item.stage}</div>
              <div className="text-[11px] text-gray-600 mt-0.5">
                보조 신호 {item.signal > 0 ? '증가' : '감소'} ({item.signal > 0 ? '+' : ''}{item.signal}%) · 큐 {item.queue > 0 ? '증가' : '감소'} ({item.queue > 0 ? '+' : ''}{item.queue}건)
              </div>
            </div>
          ))}
        </div>
      </ChartCard>
      <StageContribution
        title="Stage별 큐 변화량"
        subtitle="절대 변화 건수 기준"
        scopeLabel={currentDrillLabel}
        data={stageImpactRows.map((item) => ({ name: item.stage, value: Math.abs(item.queue) }))}
        unit="건"
        colorScale={['#2563eb', '#16a34a', '#7c3aed']}
      />
    </>
  );

  const renderRightPanel = () => {
    if (selectedKpiKey === 'regionalSla') {
      return (
        <>
          <StageContribution
            title="단계별 유입 기여도"
            subtitle="단계 전환 분포를 기준으로 주요 병목을 확인"
            scopeLabel={currentDrillLabel}
            data={focusData.slaStageContribution}
            unit="%"
            colorScale={['#2563eb', '#3b82f6', '#60a5fa', '#93c5fd', '#1d4ed8']}
          />
          <DeltaScatterOrBar
            title="상위 시군구 유입량 · 평균 대비 Δ"
            subtitle="축 단위를 건수/증감으로 분리"
            scopeLabel={currentDrillLabel}
            data={slaRanking.map((row) => ({ name: row.name, value: row.value, delta: row.delta }))}
            valueUnit="건"
            deltaUnit="건"
            barColor="#2563eb"
            lineColor="#dc2626"
          />
        </>
      );
    }

    if (selectedKpiKey === 'regionalQueueRisk') {
      return (
        <>
          <StageContribution
            title="큐 타입별 적체 분해"
            subtitle="재접촉/L2/2차/3차 적체 건수"
            scopeLabel={currentDrillLabel}
            data={focusData.queueTypeBacklog}
            unit="건"
            colorScale={['#f97316', '#fb923c', '#fdba74', '#ea580c']}
          />
          <TopNHorizontalBar
            title="병목 원인 TopN"
            subtitle="원인 클릭 시 권장 조치 근거로 연결"
            scopeLabel={currentDrillLabel}
            data={focusData.queueCauseTop}
            unit="건"
            color="#ea580c"
            onItemClick={(item) => setSelectedCauseName(item.name)}
          />
        </>
      );
    }

    if (selectedKpiKey === 'regionalRecontact') {
      const useDonutForReasons = focusData.recontactReasons.length <= 3;
      return (
        <>
          {useDonutForReasons ? (
            <DonutBreakdown
              title="실패 사유 분포"
              subtitle="항목 수가 3개 이하일 때 도넛으로 표시"
              scopeLabel={currentDrillLabel}
              data={focusData.recontactReasons}
              unit="건"
              colors={['#ef4444', '#f97316', '#fb7185']}
              onSliceClick={(item) => setSelectedCauseName(item.name)}
            />
          ) : (
            <TopNHorizontalBar
              title="실패 사유 TopN"
              subtitle="미응답/번호 오류/시간대 문제 분포"
              scopeLabel={currentDrillLabel}
              data={focusData.recontactReasons}
              unit="건"
              color="#ef4444"
              onItemClick={(item) => setSelectedCauseName(item.name)}
            />
          )}
          <KpiTrendLine
            title="최근 7일 재접촉 필요율"
            subtitle="단기 추세 기준으로 슬롯 재배치 확인"
            scopeLabel={currentDrillLabel}
            data={focusData.recontactTrend.map((row) => ({ label: row.day, regional: row.value }))}
            unit="%"
            color="#ef4444"
          />
          <StageContribution
            title="권장 시간대(연락 성공률)"
            subtitle="시간대별 성공률 기준"
            scopeLabel={currentDrillLabel}
            data={focusData.recontactSlots.map((slot) => ({ name: slot.slot, value: slot.successRate }))}
            unit="%"
            colorScale={['#ef4444', '#f97316', '#fb7185', '#fda4af', '#fca5a5', '#dc2626']}
          />
        </>
      );
    }

    if (selectedKpiKey === 'regionalDataReadiness') {
      return (
        <>
          <TopNHorizontalBar
            title="결측 필드 TopN"
            subtitle="필수 데이터 누락 보완 우선순위"
            scopeLabel={currentDrillLabel}
            data={focusData.missingFields}
            unit="건"
            color="#d97706"
            onItemClick={(item) => setSelectedCauseName(item.name)}
          />
          <StageContribution
            title="데이터 수집 지연 분포"
            subtitle="리드타임 구간별 지연 건수"
            scopeLabel={currentDrillLabel}
            data={focusData.collectionLeadtime}
            unit="건"
            colorScale={['#f59e0b', '#f97316', '#fb923c', '#ea580c']}
          />
        </>
      );
    }

    const governanceStatusTotals = [
      {
        name: '미조치',
        value: governanceRegionalStatus.reduce((sum, row) => sum + row.미조치, 0),
      },
      {
        name: '조치중',
        value: governanceRegionalStatus.reduce((sum, row) => sum + row.조치중, 0),
      },
      {
        name: '완료',
        value: governanceRegionalStatus.reduce((sum, row) => sum + row.완료, 0),
      },
    ];

    return (
      <>
        <TopNHorizontalBar
          title="누락 유형 분포"
          subtitle="거버넌스 누락 사유 상위 항목"
          scopeLabel={currentDrillLabel}
          data={focusData.governanceMissingTypes}
          unit="건"
          color="#7c3aed"
          onItemClick={(item) => setSelectedCauseName(item.name)}
        />
        <StageContribution
          title="조치 상태 분포"
          subtitle="미조치/조치중/완료 상태 비중"
          scopeLabel={currentDrillLabel}
          data={governanceStatusTotals}
          unit="건"
          colorScale={['#ef4444', '#f59e0b', '#22c55e']}
        />
      </>
    );
  };

  return (
    <div ref={containerRef} className="flex h-full min-h-0 flex-col overflow-hidden bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-4 py-2 shrink-0">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 overflow-x-auto flex-1 min-w-0">
            {topCards.map((card) => {
              const isActive = selectedKpiKey === card.key;
              const activeSurfaceColor = `${card.color}14`;
              const activeRingColor = `${card.color}33`;
              const alertTone =
                uiEmphasis.alertLevel === 'warning'
                  ? 'bg-red-100 text-red-700 border-red-200'
                  : uiEmphasis.alertLevel === 'attention'
                    ? 'bg-amber-100 text-amber-700 border-amber-200'
                    : 'bg-emerald-100 text-emerald-700 border-emerald-200';
              const alertLabel =
                uiEmphasis.alertLevel === 'warning'
                  ? '경고'
                  : uiEmphasis.alertLevel === 'attention'
                    ? '주의'
                    : '정상';
              return (
                <button
                  key={card.key}
                  onClick={() => updateSelectedKpiKey(card.key)}
                  onMouseEnter={() => setTooltipTarget(card.key)}
                  onMouseLeave={() => setTooltipTarget(null)}
                  className={`relative flex items-start gap-2 px-3 py-2 rounded-lg border transition-all text-left ${
                    isActive
                      ? 'min-w-[260px] shadow-sm'
                      : 'min-w-[152px] border-gray-200 bg-gray-50/70 hover:border-gray-300 hover:bg-gray-100/80 opacity-75'
                  }`}
                  style={
                    isActive
                      ? {
                          borderColor: card.color,
                          backgroundColor: activeSurfaceColor,
                          boxShadow: `0 0 0 2px ${activeRingColor}`,
                        }
                      : undefined
                  }
                >
                  <div className={`p-1.5 rounded-md ${card.iconBg}`}>{KPI_ICON[card.key]}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <div
                        className={`text-[12px] font-medium truncate ${isActive ? '' : 'text-gray-600'}`}
                        style={isActive ? { color: card.color } : undefined}
                      >
                        {card.shortLabel}
                      </div>
                      {isActive && (
                        <span
                          className="text-[10px] px-1.5 py-0.5 rounded border bg-white"
                          style={{ borderColor: `${card.color}66`, color: card.color }}
                        >
                          이번 주 우선
                        </span>
                      )}
                      {isActive && (
                        <span className={`text-[10px] px-1.5 py-0.5 rounded border ${alertTone}`}>{alertLabel}</span>
                      )}
                    </div>
                    <div
                      className={`text-sm font-bold ${isActive ? '' : 'text-gray-800'}`}
                      style={isActive ? { color: card.color } : undefined}
                    >
                      {formatKpiValue(card.key, card.value)}
                    </div>
                    {isActive && (
                      <div className="text-[11px] mt-1 leading-tight" style={{ color: card.color }}>
                        {activeKpiNarrative}
                      </div>
                    )}
                  </div>
                  {tooltipTarget === card.key && (
                    <div className="absolute z-50 left-0 top-full mt-1 bg-gray-900 text-white text-[12px] rounded-lg p-2.5 shadow-xl max-w-[300px] leading-relaxed whitespace-pre-line">
                      {card.tooltipLines.join('\n')}
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          <div className="w-px h-8 bg-gray-200 shrink-0" />

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={handleDrillBack}
              disabled={!drillCanGoBack}
              className={`flex items-center gap-1 px-2 py-1 text-xs rounded transition-colors ${
                drillCanGoBack
                  ? 'text-blue-600 bg-blue-50 hover:bg-blue-100'
                  : 'text-gray-400 bg-gray-100 cursor-not-allowed'
              }`}
            >
              <ChevronLeft className="h-3 w-3" />
              <span>뒤로</span>
            </button>
            <button
              onClick={handleGoBack}
              className="p-1 text-gray-500 hover:text-blue-600 hover:bg-gray-100 rounded transition-colors"
              title="광역 관할로 이동"
            >
              <Home className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="w-px h-8 bg-gray-200 shrink-0" />

          <div className="flex items-center gap-1 text-gray-500 shrink-0">
            <button className="p-1.5 hover:bg-gray-100 rounded" title="도움말">
              <HelpCircle className="h-4 w-4" />
            </button>
            <button className="p-1.5 hover:bg-gray-100 rounded" title="다운로드">
              <Download className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-hidden min-h-0">
        <div
          className={`p-2 gap-2 h-full min-h-0 ${layoutMode === 'desktop' ? 'grid overflow-hidden' : 'flex flex-col overflow-y-auto'}`}
          style={
            layoutMode === 'desktop'
              ? { gridTemplateColumns: '3fr 6fr 3fr', minHeight: 0, alignItems: 'stretch' }
              : undefined
          }
        >
          <div className={`${layoutMode === 'desktop' ? 'min-w-0 min-h-0 overflow-hidden' : layoutMode === 'tablet' ? 'hidden' : 'w-full shrink-0'} flex flex-col gap-2`}>
            <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-2 text-center">
              <span className="text-xs text-indigo-700 font-medium">
                {selectedDistrictName ? `📍 ${selectedDistrictName}` : `🏢 ${region.label}`}
              </span>
              <span className="ml-2 text-[12px] text-indigo-500">스코프: 광역 관할 · {RANGE_PRESET_LABEL[rangePreset]}</span>
            </div>

            <div className="bg-white border border-gray-200 rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold text-gray-700">선택 KPI 요약</span>
                <span className="text-[11px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-700">{selectedKpiDef.shortLabel}</span>
              </div>
              <div className="space-y-1.5 text-[12px] leading-relaxed">
                <div className="p-2 rounded border border-gray-100 bg-gray-50 text-gray-800">{summaryLineCurrent}</div>
                <div className="p-2 rounded border border-amber-100 bg-amber-50 text-amber-900">{summaryLineRisk}</div>
                <div className="p-2 rounded border border-blue-100 bg-blue-50 text-blue-900">{summaryLineAction}</div>
              </div>
            </div>

            {selectedDistrictData && (
              <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                <button
                  onClick={() => setStageImpactOpen((prev) => !prev)}
                  className="w-full px-3 py-2 flex items-center justify-between hover:bg-gray-50"
                >
                  <span className="text-sm font-semibold text-gray-700">Stage 영향 (운영 큐 연동)</span>
                  {stageImpactOpen ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
                </button>
                {stageImpactOpen && (
                  <div className="px-3 pb-3 border-t border-gray-100 space-y-2">
                    {stageImpactRows.map((item) => (
                      <div key={item.stage} className="p-2 rounded border border-gray-100 bg-gray-50">
                        <div className="text-[13px] font-medium text-gray-800">{item.stage}</div>
                        <div className="text-[12px] text-gray-600 mt-0.5">
                          보조 신호 {item.signal > 0 ? '증가' : '감소'} ({item.signal > 0 ? '+' : ''}{item.signal}%) · 큐 변화 {item.queue > 0 ? '+' : ''}{item.queue}건
                        </div>
                        <div className="text-[11px] text-gray-500 mt-0.5">{item.desc}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="bg-white border border-gray-200 rounded-lg p-3 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5">
                  <AlertTriangle className="h-3.5 w-3.5 text-red-500" />
                  <span className="text-sm font-semibold text-gray-700">관할 우선 처리 Top 5</span>
                </div>
                <span className="text-[11px] bg-red-50 text-red-600 px-1.5 py-0.5 rounded font-medium">값 + 건수</span>
              </div>
              <div
                className="text-[11px] text-gray-400 mb-1.5"
                title="KPI 수준과 물량을 함께 반영한 운영 우선순위 (score = 0.6×KPI 정규화 + 0.4×규모 정규화)"
              >
                KPI 수준과 물량을 함께 반영한 운영 우선순위
              </div>
              <div className="space-y-1">
                {top5.map((item, idx) => (
                  <button
                    key={item.name}
                    onClick={() => handleTop5Click(item.name)}
                    className={`w-full text-left p-1.5 rounded-lg border transition-colors ${
                      selectedDistrictName === item.name ? 'border-red-300 bg-red-50' : 'border-gray-100 hover:bg-gray-50'
                    }`}
                  >
                    <div className="space-y-1">
                      <div className="grid grid-cols-[1fr_auto_auto] gap-2 items-center">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className={`w-5 h-5 flex items-center justify-center text-[12px] font-bold rounded-full ${idx === 0 ? 'bg-red-500 text-white' : idx < 3 ? 'bg-orange-100 text-orange-700' : 'bg-gray-100 text-gray-600'}`}>
                            {idx + 1}
                          </span>
                          <span className="text-xs font-medium text-gray-800 truncate">{item.name}</span>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded border ${idx < 2 ? 'bg-red-100 text-red-700 border-red-200' : idx < 4 ? 'bg-amber-100 text-amber-700 border-amber-200' : 'bg-gray-100 text-gray-700 border-gray-200'}`}>
                            {idx < 2 ? '경고' : idx < 4 ? '주의' : '관찰'}
                          </span>
                        </div>
                        <span className="text-[11px] font-semibold text-gray-700 min-w-[72px] text-right">{formatKpiValue(selectedKpiKey, item.kpiValue)}</span>
                        <span className="text-[11px] font-semibold text-blue-700 min-w-[64px] text-right">{item.volume.toLocaleString()}건</span>
                      </div>
                      <div className="flex items-center justify-between gap-2 pl-6">
                        <div className="text-[11px] text-gray-500">
                          {selectedKpiDef.shortLabel} {formatKpiValue(selectedKpiKey, item.kpiValue)} · {item.volume.toLocaleString()}건 · 평균 대비 Δ {formatDeltaValue(selectedKpiKey, Number((item.kpiValue - regionalValue).toFixed(1)))}
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={(event) => {
                              event.stopPropagation();
                              onCreateIntervention?.({
                                kpi: selectedKpiKey,
                                sgg: item.name,
                                range: analyticsPeriod,
                                source: 'overview',
                                primaryDriverStage: uiEmphasis.primaryDriverStage,
                              });
                            }}
                            className="h-5 w-5 flex items-center justify-center rounded border border-blue-200 text-blue-700 bg-blue-50 hover:bg-blue-100"
                            title="할당/재할당"
                          >
                            <BarChart3 className="h-3 w-3" />
                          </button>
                          <button
                            onClick={(event) => {
                              event.stopPropagation();
                              onCreateIntervention?.({
                                kpi: 'regionalDataReadiness',
                                sgg: item.name,
                                range: analyticsPeriod,
                                source: 'overview',
                                primaryDriverStage: '재접촉',
                              });
                            }}
                            className="h-5 w-5 flex items-center justify-center rounded border border-amber-200 text-amber-700 bg-amber-50 hover:bg-amber-100"
                            title="재접촉 배정"
                          >
                            <Phone className="h-3 w-3" />
                          </button>
                          <button
                            onClick={(event) => {
                              event.stopPropagation();
                              onCreateIntervention?.({
                                kpi: 'regionalGovernance',
                                sgg: item.name,
                                range: analyticsPeriod,
                                source: 'overview',
                                primaryDriverStage: '센터 지원',
                              });
                            }}
                            className="h-5 w-5 flex items-center justify-center rounded border border-violet-200 text-violet-700 bg-violet-50 hover:bg-violet-100"
                            title="센터 지원 요청"
                          >
                            <Shield className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-lg p-3 space-y-2">
              <div className="text-sm font-semibold text-gray-700">운영 액션</div>
              <button
                onClick={() =>
                  onCreateIntervention?.({
                    kpi: selectedKpiKey,
                    sgg: selectedDistrictName,
                    range: analyticsPeriod,
                    source: 'overview',
                    primaryDriverStage: uiEmphasis.primaryDriverStage,
                  })
                }
                className="w-full px-3 py-2 rounded-md text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 transition-colors"
              >
                개입 만들기
              </button>
              <button
                onClick={() =>
                  onNavigateToCause?.({
                    kpi: selectedKpiKey,
                    sgg: selectedDistrictName,
                    range: analyticsPeriod,
                  })
                }
                className="w-full px-3 py-2 rounded-md text-sm font-medium border border-orange-300 text-orange-700 bg-orange-50 hover:bg-orange-100 transition-colors"
              >
                원인 분석으로 이동
              </button>
            </div>

            <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
              <button
                onClick={() => setShowLeftDetails((prev) => !prev)}
                className="w-full px-3 py-2 flex items-center justify-between hover:bg-gray-50"
              >
                <span className="text-[12px] font-medium text-gray-700">개입 현황 보기</span>
                {showLeftDetails ? <ChevronUp className="h-3.5 w-3.5 text-gray-400" /> : <ChevronDown className="h-3.5 w-3.5 text-gray-400" />}
              </button>
              {showLeftDetails && (
                <div className="px-3 pb-3 border-t border-gray-100 text-[12px] text-gray-600 space-y-2">
                  <div>현재 선택: {selectedDistrictData ? `${selectedDistrictData.name} 시군구` : `${region.label} 광역 관할`}</div>
                  <div>지도 값 평균: {formatKpiValue(selectedKpiKey, mapAvg)}</div>
                  <div>
                    범례 범위:{' '}
                    {selectedKpiDef.unit === '건'
                      ? `${Math.round(mapMin)}건 ~ ${Math.round(mapMax)}건`
                      : selectedKpiDef.unit === '점'
                        ? `${Math.round(mapMin)}점 ~ ${Math.round(mapMax)}점`
                        : `${mapMin.toFixed(1)}% ~ ${mapMax.toFixed(1)}%`}
                  </div>
                  <button
                    onClick={() =>
                      onCreateIntervention?.({
                        kpi: selectedKpiKey,
                        sgg: selectedDistrictName,
                        range: analyticsPeriod,
                        source: 'overview',
                        primaryDriverStage: uiEmphasis.primaryDriverStage,
                      })
                    }
                    className="w-full px-2 py-1.5 rounded border border-blue-200 text-blue-700 bg-blue-50 hover:bg-blue-100 transition-colors text-[12px] font-medium"
                  >
                    개입·조치 관리 열기
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className={`${layoutMode === 'desktop' ? 'min-w-0 min-h-0 flex flex-col overflow-hidden' : 'w-full shrink-0'}`}>
            <div className="bg-white border border-gray-200 rounded-lg overflow-hidden flex flex-col flex-1">
              <div className="px-4 py-3 border-b border-gray-200 bg-white rounded-t-lg">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleDrillBack}
                      disabled={!drillCanGoBack}
                      className={`flex items-center gap-1 h-8 px-3 text-sm rounded-lg transition-colors font-medium ${
                        drillCanGoBack
                          ? 'text-blue-600 bg-blue-50 hover:bg-blue-100'
                          : 'text-gray-400 bg-gray-100 cursor-not-allowed'
                      }`}
                    >
                      <ChevronLeft className="h-4 w-4" />
                      <span>뒤로</span>
                    </button>
                    <button
                      onClick={handleGoBack}
                      className="h-8 px-3 text-xs rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50"
                    >
                      상위
                    </button>
                    <span className="text-sm font-semibold text-gray-800">{mapHeaderTitle}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="flex rounded-md border border-gray-200 overflow-hidden">
                      <button
                        onClick={() => setVisualizationMode('geomap')}
                        className={`px-3 py-1.5 text-xs font-medium transition ${
                          visualizationMode === 'geomap' ? 'bg-blue-600 text-white' : 'bg-white text-gray-500 hover:bg-gray-100'
                        }`}
                      >
                        지오맵
                      </button>
                      <button
                        onClick={() => setVisualizationMode('heatmap')}
                        className={`px-3 py-1.5 text-xs font-medium transition border-l border-gray-200 ${
                          visualizationMode === 'heatmap' ? 'bg-blue-600 text-white' : 'bg-white text-gray-500 hover:bg-gray-100'
                        }`}
                      >
                        히트맵
                      </button>
                    </div>
                    <div className="flex items-center gap-0.5">
                      {(['24h', '7d', '30d', '90d'] as const).map((preset) => (
                        <button
                          key={preset}
                          onClick={() => handleRangePresetChange(preset)}
                          className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${
                            rangePreset === preset
                              ? 'bg-blue-600 text-white'
                              : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                          }`}
                        >
                          {RANGE_PRESET_LABEL[preset]}
                        </button>
                      ))}
                    </div>
                    <button className="h-7 w-7 flex items-center justify-center hover:bg-gray-100 rounded-lg transition-colors">
                      <Download className="h-3.5 w-3.5 text-gray-500" />
                    </button>
                  </div>
                </div>
              </div>

              <div className="px-4 py-2 border-b border-gray-100 bg-gray-50">
                <div className="flex items-center gap-1.5 overflow-x-auto">
                  {breadcrumbTrail.map((item, idx) => (
                    <React.Fragment key={`${item.level}-${item.id}-${idx}`}>
                      {idx > 0 && <ChevronRight className="h-3.5 w-3.5 text-gray-400 shrink-0" />}
                      <button
                        onClick={() => jumpDrill(idx)}
                        className={`text-[11px] whitespace-nowrap ${
                          idx === breadcrumbTrail.length - 1
                            ? 'font-semibold text-blue-700'
                            : 'text-gray-600 hover:text-blue-700'
                        }`}
                      >
                        {item.label}
                      </button>
                    </React.Fragment>
                  ))}
                </div>
              </div>

              <div className="relative p-2 min-h-0">
                <div className="absolute left-4 top-4 z-20 w-[min(420px,calc(100%-2rem))] rounded-lg border border-blue-200 bg-white/95 backdrop-blur px-3 py-2 shadow-sm">
                  <div className="text-[12px] font-semibold text-blue-800">상황 오버레이</div>
                  <div className="text-[12px] text-gray-700 mt-1 leading-relaxed">{mapOverlayMessage}</div>
                  <button
                    onClick={() =>
                      onCreateIntervention?.({
                        kpi: selectedKpiKey,
                        sgg: selectedDistrictName,
                        range: analyticsPeriod,
                        source: 'map',
                        primaryDriverStage: uiEmphasis.primaryDriverStage,
                      })
                    }
                    className="mt-2 inline-flex items-center px-2.5 py-1.5 rounded-md text-[12px] font-medium text-white bg-blue-600 hover:bg-blue-700 transition-colors"
                  >
                    개입 만들기
                  </button>
                </div>
                {visualizationMode === 'geomap' ? (
                  <GeoMapPanel
                    key={`regional-${region.id}-${selectedKpiKey}-${rangePreset}-${analyticsPeriod}`}
                    title=""
                    indicatorId={mapIndicatorId}
                    year={2026}
                    scope={{ mode: 'regional', ctprvnCodes: [region.ctprvnCode], label: region.label }}
                    variant="portal"
                    mapHeight={centerMapHeight}
                    hideBreadcrumb
                    onRegionSelect={handleRegionSelect}
                    externalColorScheme={mapColorScheme}
                    hideLegendPanel
                    externalLevel={mapDrillLevel}
                    externalSelectedCode={mapDrillCode}
                    onSubRegionsChange={handleSubRegionsChange}
                    getTooltipExtraLines={geoTooltipExtraLines}
                  />
                ) : (
                  <div className="w-full" style={{ height: centerMapHeight }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <Treemap
                        data={heatmapData}
                        dataKey="size"
                        isAnimationActive={false}
                        content={(props: any) => {
                          const { x, y, width, height, name, fill } = props;
                          if (!name || width < 28 || height < 18) return null;
                          return (
                            <g>
                              <rect x={x} y={y} width={width} height={height} fill={fill} stroke="#fff" strokeWidth={1.2} rx={2} />
                              {width > 40 && height > 22 && (
                                <text
                                  x={x + width / 2}
                                  y={y + height / 2}
                                  textAnchor="middle"
                                  dominantBaseline="middle"
                                  fill="#fff"
                                  fontSize={11}
                                  fontWeight={700}
                                  style={{ textShadow: '0 1px 2px rgba(0,0,0,0.35)' }}
                                >
                                  {String(name).length > 5 ? String(name).slice(0, 4) : name}
                                </text>
                              )}
                            </g>
                          );
                        }}
                        onClick={(node: any) => {
                          if (node?.name && districtNameSet.has(node.name)) {
                            handleTop5Click(node.name);
                          }
                        }}
                      />
                    </ResponsiveContainer>
                  </div>
                )}
              </div>

              <div className="mx-2 mb-2 px-3 py-2 rounded-lg bg-gradient-to-r from-gray-50 to-gray-100/80 border border-gray-200/60 shrink-0">
                <div className="flex items-center gap-2 mb-1.5">
                  <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: selectedKpiDef.color }} />
                  <span className="text-[12px] font-bold text-gray-600 tracking-wide">{selectedKpiDef.shortLabel} 지도 범례</span>
                  <span className="text-[11px] text-gray-400">스코프: 광역 관할</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[12px] font-semibold text-gray-500 tabular-nums min-w-[42px] text-right">
                    {selectedKpiDef.unit === '건'
                      ? `${Math.round(mapMin)}건`
                      : selectedKpiDef.unit === '점'
                        ? `${Math.round(mapMin)}점`
                        : `${mapMin.toFixed(1)}%`}
                  </span>
                  <div className="flex-1 h-3 rounded-md overflow-hidden flex shadow-inner">
                    {(COLOR_PALETTES[mapColorScheme as keyof typeof COLOR_PALETTES] || COLOR_PALETTES.blue).map((color, idx) => (
                      <div key={idx} className="flex-1" style={{ backgroundColor: color }} />
                    ))}
                  </div>
                  <span className="text-[12px] font-semibold text-gray-500 tabular-nums min-w-[42px]">
                    {selectedKpiDef.unit === '건'
                      ? `${Math.round(mapMax)}건`
                      : selectedKpiDef.unit === '점'
                        ? `${Math.round(mapMax)}점`
                        : `${mapMax.toFixed(1)}%`}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className={`${layoutMode === 'desktop' ? 'min-w-0 min-h-0 overflow-hidden' : layoutMode === 'tablet' ? 'hidden' : 'w-full shrink-0'} flex flex-col gap-2`}>
            <div className="bg-white border border-gray-200 rounded-lg p-3 shrink-0">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold text-gray-700">우측 분석 · 조치 중심</span>
                <span className="text-[11px] px-1.5 py-0.5 bg-indigo-50 text-indigo-600 rounded border border-indigo-200">
                  {currentDrillLabel}
                </span>
              </div>
              <div className="text-[12px] text-gray-500">
                선택 KPI: <span className="font-medium text-gray-700">{selectedKpiDef.label}</span> · 스코프: 광역 관할
              </div>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain pr-1 space-y-2">
              <div className="sticky top-0 z-20 bg-gray-50 pt-0.5 pb-2">
                {/* 다음 행동이 항상 먼저 보이도록 우측 상단 Action Stack을 고정한다. */}
                <ChartCard
                  title="이번 주 권장 조치"
                  subtitle={activeKpiNarrative}
                  action={(
                    <div className="flex items-center gap-1">
                      <button
                        onClick={handleDrillBack}
                        disabled={!drillCanGoBack}
                        className={`px-2 py-1 rounded text-[11px] ${
                          drillCanGoBack ? 'text-blue-700 bg-blue-50 hover:bg-blue-100' : 'text-gray-400 bg-gray-100'
                        }`}
                      >
                        뒤로
                      </button>
                      <button
                        onClick={handleGoBack}
                        className="px-2 py-1 rounded text-[11px] text-gray-600 bg-gray-100 hover:bg-gray-200"
                      >
                        상위
                      </button>
                    </div>
                  )}
                >
                  <div className="space-y-2">
                    {interventionScenarios.slice(0, 2).map((scenario, idx) => (
                      <div key={scenario.id} className="rounded-lg border border-blue-100 bg-blue-50/70 p-2.5">
                        <div className="flex items-center justify-between">
                          <div className="text-[12px] font-semibold text-blue-900">
                            {idx === 0 ? 'Primary' : 'Secondary'} · {scenario.target}
                          </div>
                          <div className="text-[11px] text-blue-700">{scenario.effect}</div>
                        </div>
                        <div className="text-[12px] text-gray-800 mt-1">{scenario.action}</div>
                        <div className="text-[11px] text-gray-600 mt-1">리스크: {scenario.risk}</div>
                        <div className="mt-2 flex items-center gap-1.5">
                          <button
                            onClick={() =>
                              onCreateIntervention?.({
                                kpi: selectedKpiKey,
                                sgg: selectedDistrictName,
                                range: analyticsPeriod,
                                source: 'overview',
                                primaryDriverStage: uiEmphasis.primaryDriverStage,
                              })
                            }
                            className="px-2.5 py-1.5 rounded-md text-[12px] font-medium text-white bg-blue-600 hover:bg-blue-700"
                          >
                            개입 만들기
                          </button>
                          <button
                            onClick={() =>
                              onNavigateToCause?.({
                                kpi: selectedKpiKey,
                                sgg: selectedDistrictName,
                                range: analyticsPeriod,
                              })
                            }
                            className="px-2.5 py-1.5 rounded-md text-[12px] font-medium border border-orange-300 text-orange-700 bg-orange-50 hover:bg-orange-100"
                          >
                            원인 분석으로 이동
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </ChartCard>
              </div>

              <div className="bg-white border border-gray-200 rounded-lg p-2">
                <div className="grid grid-cols-3 gap-1">
                  {([
                    { key: 'drivers', label: 'Drivers' },
                    { key: 'data', label: 'Data' },
                    { key: 'trend', label: 'Trend' },
                  ] as const).map((tab) => (
                    <button
                      key={tab.key}
                      onClick={() => setRightEvidenceTab(tab.key)}
                      className={`px-2 py-1.5 rounded text-xs font-medium transition ${
                        rightEvidenceTab === tab.key
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>

              {isVizLoading ? (
                <div className="space-y-2">
                  <ChartSkeleton height={176} />
                  <ChartSkeleton height={176} />
                </div>
              ) : (
                <>
                  {rightEvidenceTab === 'drivers' && (
                    <>
                      <ChartCard title="Primary Driver" subtitle={primaryDriver.basis}>
                        <div className="flex items-center justify-between">
                          <div className="text-[12px] text-gray-700">{uiEmphasis.primaryDriverStage} 단계</div>
                          <div className="text-[12px] font-semibold text-red-700">{primaryDriver.valueLabel}</div>
                        </div>
                      </ChartCard>

                      {renderRightPanel()}

                      <ChartCard title="참고 · 원인 TopN" subtitle="항목 클릭 시 액션 권고 표시">
                        <div className="space-y-1.5">
                          {causeTopNPreview.map((item, idx) => (
                            <button
                              key={`${item.name}-${idx}`}
                              onClick={() => setSelectedCauseName(item.name)}
                              className={`w-full flex items-center justify-between text-[12px] px-1.5 py-1 rounded transition-colors ${
                                selectedCauseName === item.name
                                  ? 'bg-blue-50 border border-blue-200 text-blue-900'
                                  : 'hover:bg-gray-50'
                              }`}
                            >
                              <span className="text-left">
                                {idx + 1}. {item.name}
                              </span>
                              <span className="font-medium">
                                {selectedKpiDef.unit === '건'
                                  ? `${Math.round(item.value)}건`
                                  : selectedKpiDef.unit === '점'
                                    ? `${Math.round(item.value)}점`
                                    : `${item.value.toFixed(1)}%`}
                              </span>
                            </button>
                          ))}
                        </div>
                        {selectedCauseName && (
                          <div className="mt-2 p-2 rounded border border-orange-200 bg-orange-50">
                            <div className="text-[12px] font-semibold text-orange-800">액션 권고</div>
                            <div className="text-[11px] text-orange-900 mt-1 leading-relaxed">
                              {safeOpsText(`${selectedCauseName} 비중이 높아 담당자 확인 후 우선 개입 생성이 필요함`)}
                            </div>
                          </div>
                        )}
                      </ChartCard>
                    </>
                  )}

                  {rightEvidenceTab === 'data' && renderDataEvidencePanel()}
                  {rightEvidenceTab === 'trend' && renderTrendEvidencePanel()}
                </>
              )}

              <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                <button
                  onClick={() => setShowBottomTable((prev) => !prev)}
                  className="w-full px-3 py-2 flex items-center justify-between hover:bg-gray-50"
                >
                  <span className="text-sm font-semibold text-gray-700">운영 우선순위 테이블</span>
                  {showBottomTable ? (
                    <ChevronUp className="h-4 w-4 text-gray-400" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-gray-400" />
                  )}
                </button>

                {showBottomTable && (
                  <div className="px-3 pb-3 border-t border-gray-100 overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-200">
                          {OPS_TABLE_COLUMNS.map((col) => (
                            <th
                              key={col.key}
                              className={`px-2 py-1.5 font-medium text-gray-600 whitespace-nowrap ${
                                col.align === 'right' ? 'text-right' : 'text-left'
                              }`}
                            >
                              {col.label}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {priorityRows.slice(0, 12).map((row) => (
                          <tr
                            key={row.name}
                            onClick={() => handleTop5Click(row.name)}
                            className={`border-b border-gray-100 cursor-pointer transition-colors ${
                              selectedDistrictName === row.name ? 'bg-blue-50' : 'hover:bg-gray-50'
                            }`}
                          >
                            <td className="px-2 py-1.5 font-medium text-gray-800">{row.name}</td>
                            <td className="px-2 py-1.5 text-right">{formatKpiValue(selectedKpiKey, row.kpiValue)}</td>
                            <td className="px-2 py-1.5 text-right">{row.volume.toLocaleString()}건</td>
                            <td className="px-2 py-1.5 text-right font-medium text-orange-700">
                              {row.priorityScore.toFixed(3)}
                            </td>
                            <td
                              className={`px-2 py-1.5 text-right font-medium ${
                                row.nationalDelta >= 0 ? 'text-blue-600' : 'text-red-600'
                              }`}
                            >
                              {row.nationalDelta > 0 ? '+' : ''}
                              {selectedKpiDef.unit === '건'
                                ? `${Math.round(row.nationalDelta)}건`
                                : selectedKpiDef.unit === '점'
                                  ? `${Math.round(row.nationalDelta)}점`
                                  : `${row.nationalDelta.toFixed(1)}%p`}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
