import React, { useMemo, useState, useCallback, useRef, useEffect, startTransition } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ChevronLeft,
  AlertTriangle,
  BarChart3,
  Shield,
  Database,
  Phone,
  Brain,
  Clock3,
  TrendingUp,
  ChevronDown,
  ChevronUp,
  ChevronRight,
} from 'lucide-react';
import { GeoMapPanel, type MapColorScheme } from '../geomap/GeoMapPanel';
import { COLOR_PALETTES } from '../../lib/choroplethScale';
import type { RegionalScope } from '../geomap/regions';
import { safeOpsText } from '../../lib/uiTextGuard';
import { SIGUNGU_OPTIONS } from '../../mocks/mockGeo';
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
  type ScopeDrillNode,
} from '../../selectors/scopeSelectors';
import { getChildrenScope } from '../../lib/dashboardChildrenScope';
import type { DrillLevel as DashboardDrillLevel } from '../../lib/kpi.types';
import {
  makeRegionId,
  normalizeRegionCode,
  parseRegionIdCode,
  type AdminLevel,
} from '../../lib/regionKey';
import {
  ChartCard,
  ChartSkeleton,
  DeltaScatterOrBar,
  DonutBreakdown,
  KpiTrendLine,
  StageContribution,
  TopNHorizontalBar,
} from '../chart-kit/ChartKit';
import { MetricLabel } from './MetricLabel';
import { getMetricHelp, type MetricActionTab, type MetricHelpKey } from './MetricDictionary';
import { toUserCopy, getCopyTerm } from './copyDictionary';
import type {
  AdTransitionSignal,
  AlertSummary,
  DifferentialDelay,
  MapLayer,
  OpsTodoItem,
  RegionalKpiBlock,
  StageConversionRate,
  TodoStatus,
} from './opsContracts';
import type { RegionalPageId } from './regionalRouting';
import { buildOpsTodos } from './regionalOpsMockApi';
import { fetchRegionalDashboardDistricts } from '../../lib/regionalApi';

type AnalyticsPeriod = 'week' | 'month' | 'quarter';
type RangePreset = '24h' | '7d' | '30d' | '90d';

type NamedValue = { name: string; value: number };
type SparkPoint = { t: string; v: number };
type SparkSeriesKey = 'slaRisk' | 'bottleneck' | 'overdueFollowup';
type SparkSeries = {
  key: SparkSeriesKey;
  label: string;
  unit: '곳' | '일' | '건';
  points: SparkPoint[];
  value: number;
  delta: number;
};
type ActionEngineId = 'STAFFING' | 'EXAM_SLOT' | 'FOLLOWUP_AUTOMATION' | 'HOSPITAL_LINK';

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
type LoadingPhase = 'Initial' | 'RegionChange' | 'PartialData' | 'Empty' | 'Error' | 'Ready';

type DistrictOpsData = {
  regionId: string;
  name: string;
  volume: number;
  kpi: Record<RegionalKpiKey, number>;
  mapMetric: Record<RegionalKpiKey, number>;
  adTransitionSignal: AdTransitionSignal;
  differentialDelay: DifferentialDelay;
  stageConversionRate: StageConversionRate;
  adTransitionDrivers: NamedValue[];
  dxDelayDrivers: NamedValue[];
  screenToDxDrivers: NamedValue[];
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

type MapChildRegion = {
  code: string;
  name: string;
  regionId: string;
  regionKey: {
    level: AdminLevel;
    code: string;
    name: string;
  };
};

const MAP_LAYER_BY_KPI: Record<RegionalKpiKey, MapLayer> = {
  regionalSla: 'LOAD',
  regionalQueueRisk: 'BOTTLENECK',
  regionalRecontact: 'BOTTLENECK',
  regionalDataReadiness: 'LOAD',
  regionalGovernance: 'LOAD',
  regionalAdTransitionHotspot: 'RISK',
  regionalDxDelayHotspot: 'BOTTLENECK',
  regionalScreenToDxRate: 'GAP',
};

const PRIMARY_KPI_BY_LAYER: Record<MapLayer, RegionalKpiKey> = {
  RISK: 'regionalAdTransitionHotspot',
  BOTTLENECK: 'regionalDxDelayHotspot',
  GAP: 'regionalScreenToDxRate',
  LOAD: 'regionalQueueRisk',
};

const USER_LABEL_BY_KPI: Record<RegionalKpiKey, string> = {
  regionalSla: '기한 준수(처리 기한)',
  regionalQueueRisk: '미처리 업무(대기 건수)',
  regionalRecontact: '후속 연락 지연',
  regionalDataReadiness: '운영 데이터 준비',
  regionalGovernance: '기록 완전성',
  regionalAdTransitionHotspot: '전환 위험 집중',
  regionalDxDelayHotspot: '검사 연결 지연(병목)',
  regionalScreenToDxRate: '지역 간 전환 격차',
};

const HELP_KEY_BY_KPI: Record<RegionalKpiKey, MetricHelpKey> = {
  regionalSla: 'slaRisk',
  regionalQueueRisk: 'unprocessedWork',
  regionalRecontact: 'followupDelay',
  regionalDataReadiness: 'unprocessedWork',
  regionalGovernance: 'unprocessedWork',
  regionalAdTransitionHotspot: 'slaRisk',
  regionalDxDelayHotspot: 'examDelay',
  regionalScreenToDxRate: 'conversionGap',
};

interface RegionalDashboardProps {
  region: RegionalScope;
  selectedKpiKey?: RegionalKpiKey;
  selectedRegionSgg?: string | null;
  selectedRange?: AnalyticsPeriod;
  onSelectedKpiKeyChange?: (kpi: RegionalKpiKey) => void;
  onSelectedRegionSggChange?: (sgg: string | null) => void;
  onSelectedRangeChange?: (range: AnalyticsPeriod) => void;
  onCreateIntervention?: (params: {
    kpi: RegionalKpiKey;
    sgg: string | null;
    range: AnalyticsPeriod;
    source: 'overview' | 'top5' | 'map';
    primaryDriverStage?: string;
  }) => void;
  onNavigateModule?: (target: Exclude<RegionalPageId, 'overview'>) => void;
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
  regionalAdTransitionHotspot: [18, 92],
  regionalDxDelayHotspot: [8, 68],
  regionalScreenToDxRate: [34, 91],
};

const KPI_ICON: Record<RegionalKpiKey, React.ReactNode> = {
  regionalSla: <AlertTriangle className="h-4 w-4" />,
  regionalQueueRisk: <BarChart3 className="h-4 w-4" />,
  regionalRecontact: <Phone className="h-4 w-4" />,
  regionalDataReadiness: <Database className="h-4 w-4" />,
  regionalGovernance: <Shield className="h-4 w-4" />,
  regionalAdTransitionHotspot: <Brain className="h-4 w-4" />,
  regionalDxDelayHotspot: <Clock3 className="h-4 w-4" />,
  regionalScreenToDxRate: <TrendingUp className="h-4 w-4" />,
};

const AD_TOP5_WEIGHTS = { density: 0.45, transition: 0.35, delta: 0.20 } as const;
const DX_DELAY_TOP5_WEIGHTS = { wait: 0.45, delayed: 0.30, backlog: 0.25 } as const;
const SCREEN_TO_DX_TOP5_WEIGHTS = { gapRate: 0.45, deltaGap: 0.35, support: 0.20 } as const;

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

function normalizeRegionLabel(value: string): string {
  return String(value ?? '')
    .trim()
    .replace(/\s+/g, '')
    .replace(/[()]/g, '');
}

function getChildAdminLevel(level: 'REGION' | 'SIGUNGU' | 'EUPMYEONDONG'): AdminLevel {
  if (level === 'REGION') return 'SIGUNGU';
  if (level === 'SIGUNGU') return 'EUPMYEONDONG';
  return 'EUPMYEONDONG';
}

function formatKpiValue(key: RegionalKpiKey, value: number): string {
  const cfg = REGIONAL_DASHBOARD_KPI_MAP[key];
  if (cfg.unit === '건') return `${Math.round(value).toLocaleString()}건`;
  if (cfg.unit === '점') return `${Math.round(value)}점`;
  if (cfg.unit === '일') return `${Math.round(value)}일`;
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

function normalizeValue(value: number, min: number, max: number): number {
  if (!Number.isFinite(value) || !Number.isFinite(min) || !Number.isFinite(max) || max <= min) return 0.5;
  const ratio = (value - min) / (max - min);
  return Math.max(0, Math.min(1, ratio));
}

function buildDistrictData(
  name: string,
  scopeKey: string,
  period: AnalyticsPeriod,
  rangePreset: RangePreset,
  regionId?: string,
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
  const adDensityScore = Number(
    Math.max(
      KPI_RANGE.regionalAdTransitionHotspot[0],
      Math.min(
        KPI_RANGE.regionalAdTransitionHotspot[1],
        sv(
          `${seed}-ad-density`,
          KPI_RANGE.regionalAdTransitionHotspot[0],
          KPI_RANGE.regionalAdTransitionHotspot[1],
        ) + rateBias * 3,
      ),
    ).toFixed(1),
  );
  const adHighRiskCount = Math.round(sv(`${seed}-ad-highrisk`, 28, 240) * countMul);
  const adTransition30d = Math.round(sv(`${seed}-ad-tr30`, 8, 88) * countMul);
  const adTransition90d = Math.round(sv(`${seed}-ad-tr90`, 22, 210) * countMul);

  const dxAvgWaitDays = Number(
    Math.max(
      KPI_RANGE.regionalDxDelayHotspot[0],
      Math.min(
        KPI_RANGE.regionalDxDelayHotspot[1],
        sv(
          `${seed}-dx-wait`,
          KPI_RANGE.regionalDxDelayHotspot[0],
          KPI_RANGE.regionalDxDelayHotspot[1],
        ) + rateBias * 2.5,
      ),
    ).toFixed(1),
  );
  const dxDelayedRatio = Number(Math.max(0.04, Math.min(0.42, sv(`${seed}-dx-delayed-ratio`, 0.08, 0.36) + rateBias * 0.01)).toFixed(3));
  const dxBacklogCount = Math.round(sv(`${seed}-dx-backlog`, 20, 210) * queueMul);

  const screenToDxRate = Number(
    Math.max(
      KPI_RANGE.regionalScreenToDxRate[0],
      Math.min(
        KPI_RANGE.regionalScreenToDxRate[1],
        sv(
          `${seed}-screen-dx-rate`,
          KPI_RANGE.regionalScreenToDxRate[0],
          KPI_RANGE.regionalScreenToDxRate[1],
        ) - rateBias,
      ),
    ).toFixed(1),
  );
  const screenToDxRecontactSupport = Number(sv(`${seed}-screen-dx-recontact`, 6, 24).toFixed(1));
  const screenToDxDelaySupport = Number(sv(`${seed}-screen-dx-delay`, 8, 46).toFixed(1));

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

  const adTransitionDrivers = [
    { name: '고위험 밀집', value: adHighRiskCount },
    { name: '최근 30일 전환 신호', value: adTransition30d },
    { name: '평균 대비 위험 편차', value: Number((adDensityScore - 45).toFixed(1)) },
  ];

  const dxDelayDrivers = [
    { name: '평균 대기일', value: dxAvgWaitDays },
    { name: '지연 비율', value: Number((dxDelayedRatio * 100).toFixed(1)) },
    { name: '대기 인원', value: dxBacklogCount },
  ];

  const screenToDxDrivers = [
    { name: '전환율 역격차', value: Number((100 - screenToDxRate).toFixed(1)) },
    { name: '재접촉 보조율', value: screenToDxRecontactSupport },
    { name: '지연 보조지표', value: screenToDxDelaySupport },
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
    regionId: regionId ?? name,
    name,
    volume,
    kpi: {
      regionalSla: inflowCount,
      regionalQueueRisk: queueCount,
      regionalRecontact: slaRiskRate,
      regionalDataReadiness: recontactNeedRate,
      regionalGovernance: centerRiskScore,
      regionalAdTransitionHotspot: adDensityScore,
      regionalDxDelayHotspot: dxAvgWaitDays,
      regionalScreenToDxRate: screenToDxRate,
    },
    mapMetric: {
      regionalSla: inflowCount,
      regionalQueueRisk: queueCount,
      regionalRecontact: slaRiskRate,
      regionalDataReadiness: recontactNeedRate,
      regionalGovernance: centerRiskScore,
      regionalAdTransitionHotspot: adDensityScore,
      regionalDxDelayHotspot: dxAvgWaitDays,
      regionalScreenToDxRate: screenToDxRate,
    },
    adTransitionSignal: {
      regionId: `${scopeKey}-${name}`,
      regionName: name,
      highRiskCount: adHighRiskCount,
      transition30d: adTransition30d,
      transition90d: adTransition90d,
      densityScore: adDensityScore,
      deltaFromAvg: Number((adDensityScore - 45).toFixed(1)),
    },
    differentialDelay: {
      regionId: `${scopeKey}-${name}`,
      regionName: name,
      avgWaitDays: dxAvgWaitDays,
      delayedRatio: dxDelayedRatio,
      backlogCount: dxBacklogCount,
      deltaFromAvg: Number((dxAvgWaitDays - 24).toFixed(1)),
    },
    stageConversionRate: {
      regionId: `${scopeKey}-${name}`,
      regionName: name,
      conversionRate: Number((screenToDxRate / 100).toFixed(3)),
      deltaFromRegional: Number((screenToDxRate - 64).toFixed(1)),
    },
    adTransitionDrivers,
    dxDelayDrivers,
    screenToDxDrivers,
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
    return buildDistrictData('기준없음', 'empty', 'week', '7d', 'empty');
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

  const adSignalAvg = Number(
    rows.reduce((sum, row) => sum + row.adTransitionSignal.densityScore * weightOf(row), 0).toFixed(1),
  );
  const dxDelayAvg = Number(
    rows.reduce((sum, row) => sum + row.differentialDelay.avgWaitDays * weightOf(row), 0).toFixed(1),
  );
  const screenToDxAvg = Number(
    rows.reduce((sum, row) => sum + row.stageConversionRate.conversionRate * weightOf(row), 0).toFixed(3),
  );

  return {
    regionId: 'regional-avg',
    name: '광역 평균',
    volume: totalVolume,
    kpi: {
      regionalSla: weightedKpi('regionalSla'),
      regionalQueueRisk: weightedKpi('regionalQueueRisk'),
      regionalRecontact: weightedKpi('regionalRecontact'),
      regionalDataReadiness: weightedKpi('regionalDataReadiness'),
      regionalGovernance: weightedKpi('regionalGovernance'),
      regionalAdTransitionHotspot: weightedKpi('regionalAdTransitionHotspot'),
      regionalDxDelayHotspot: weightedKpi('regionalDxDelayHotspot'),
      regionalScreenToDxRate: weightedKpi('regionalScreenToDxRate'),
    },
    mapMetric: {
      regionalSla: weightedMap('regionalSla'),
      regionalQueueRisk: weightedMap('regionalQueueRisk'),
      regionalRecontact: weightedMap('regionalRecontact'),
      regionalDataReadiness: weightedMap('regionalDataReadiness'),
      regionalGovernance: weightedMap('regionalGovernance'),
      regionalAdTransitionHotspot: weightedMap('regionalAdTransitionHotspot'),
      regionalDxDelayHotspot: weightedMap('regionalDxDelayHotspot'),
      regionalScreenToDxRate: weightedMap('regionalScreenToDxRate'),
    },
    adTransitionSignal: {
      regionId: 'regional-avg',
      regionName: '광역 평균',
      highRiskCount: Math.round(rows.reduce((sum, row) => sum + row.adTransitionSignal.highRiskCount, 0)),
      transition30d: Math.round(rows.reduce((sum, row) => sum + row.adTransitionSignal.transition30d, 0)),
      transition90d: Math.round(rows.reduce((sum, row) => sum + (row.adTransitionSignal.transition90d ?? 0), 0)),
      densityScore: adSignalAvg,
      deltaFromAvg: 0,
    },
    differentialDelay: {
      regionId: 'regional-avg',
      regionName: '광역 평균',
      avgWaitDays: dxDelayAvg,
      delayedRatio: Number(rows.reduce((sum, row) => sum + row.differentialDelay.delayedRatio * weightOf(row), 0).toFixed(3)),
      backlogCount: Math.round(rows.reduce((sum, row) => sum + row.differentialDelay.backlogCount, 0)),
      deltaFromAvg: 0,
    },
    stageConversionRate: {
      regionId: 'regional-avg',
      regionName: '광역 평균',
      conversionRate: screenToDxAvg,
      bestRate: Number(Math.max(...rows.map((row) => row.stageConversionRate.conversionRate)).toFixed(3)),
      worstRate: Number(Math.min(...rows.map((row) => row.stageConversionRate.conversionRate)).toFixed(3)),
      deltaFromRegional: 0,
    },
    adTransitionDrivers: mergeNamed(rows.map((row) => row.adTransitionDrivers)),
    dxDelayDrivers: mergeNamed(rows.map((row) => row.dxDelayDrivers)),
    screenToDxDrivers: mergeNamed(rows.map((row) => row.screenToDxDrivers)),
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

function toDashboardDrillLevel(level: ScopeDrillNode['level']): DashboardDrillLevel {
  if (level === 'REGION') return 'sido';
  if (level === 'SIGUNGU') return 'sigungu';
  return 'center';
}

function formatDeltaValue(kpiKey: RegionalKpiKey, delta: number): string {
  const cfg = REGIONAL_DASHBOARD_KPI_MAP[kpiKey];
  if (cfg?.unit === '건') return `${delta > 0 ? '+' : ''}${Math.round(delta)}건`;
  if (cfg?.unit === '점') return `${delta > 0 ? '+' : ''}${Math.round(delta)}점`;
  if (cfg?.unit === '일') return `${delta > 0 ? '+' : ''}${Math.round(delta)}일`;
  return `${delta > 0 ? '+' : ''}${delta.toFixed(1)}%p`;
}

function formatSparkValue(value: number, unit: SparkSeries['unit']): string {
  if (unit === '곳') return `${Math.round(value).toLocaleString()}곳`;
  if (unit === '일') return `${Math.round(value)}일`;
  return `${Math.round(value).toLocaleString()}건`;
}

function formatSparkDelta(value: number, unit: SparkSeries['unit']): string {
  const prefix = value > 0 ? '+' : '';
  if (unit === '곳') return `${prefix}${Math.round(value)}곳`;
  if (unit === '일') return `${prefix}${Math.round(value)}일`;
  return `${prefix}${Math.round(value)}건`;
}

function buildSparkCoords(values: number[], width: number, height: number): Array<{ x: number; y: number }> {
  if (!values.length) return [];
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = Math.max(1, values.length - 1);
  return values.map((value, index) => {
    const x = (index / span) * width;
    const ratio = max === min ? 0.5 : (value - min) / (max - min);
    const y = height - ratio * (height - 6) - 3;
    return { x, y };
  });
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
  onCreateIntervention,
  onNavigateModule,
}: RegionalDashboardProps) {
  const [analyticsPeriodState, setAnalyticsPeriodState] = useState<AnalyticsPeriod>('week');
  const [rangePresetState, setRangePresetState] = useState<RangePreset>('7d');
  const [selectedKpiKeyState, setSelectedKpiKeyState] = useState<RegionalKpiKey>('regionalSla');
  const [visualizationMode, setVisualizationMode] = useState<DrillViewMode>('geomap');
  const [containerRef, containerSize] = useResizeObserver<HTMLDivElement>();
  const [selectedDistrictNameState, setSelectedDistrictNameState] = useState<string | null>(null);
  const [selectedRegionIdState, setSelectedRegionIdState] = useState<string | null>(null);
  const [mapDrillLevel, setMapDrillLevel] = useState<'ctprvn' | 'sig' | 'emd' | undefined>(undefined);
  const [mapDrillCode, setMapDrillCode] = useState<string | undefined>(undefined);
  const [mapSubRegionsByScope, setMapSubRegionsByScope] = useState<Record<string, MapChildRegion[]>>({});
  const [showHeaderMetricsDetail, setShowHeaderMetricsDetail] = useState(false);
  const [stageImpactOpen, setStageImpactOpen] = useState(false);
  const [selectedCauseName, setSelectedCauseName] = useState<string | null>(null);
  const [showCauseDetail, setShowCauseDetail] = useState(false);
  const [selectedActionId, setSelectedActionId] = useState<ActionEngineId>('STAFFING');
  const [showExtendedTopN, setShowExtendedTopN] = useState(false);
  const [todoStateById, setTodoStateById] = useState<
    Record<string, { status: TodoStatus; dismissReason?: string }>
  >({});
  const [loadingPhase, setLoadingPhase] = useState<LoadingPhase>('Initial');
  const lastFilterSignatureRef = useRef<string>('');
  const filterSyncTimerRef = useRef<number | null>(null);
  const lastLoadingTransitionRef = useRef<string>('');
  const prevSelectedRegionSggPropRef = useRef<string | null | undefined>(undefined);
  const selectedRegionSggPropRef = useRef<string | null | undefined>(selectedRegionSggProp);
  const onSelectedRegionSggChangeRef = useRef(onSelectedRegionSggChange);
  const subRegionSignatureByScopeRef = useRef<Record<string, string>>({});
  const isVizLoading = loadingPhase === 'RegionChange';

  useEffect(() => {
    selectedRegionSggPropRef.current = selectedRegionSggProp;
    onSelectedRegionSggChangeRef.current = onSelectedRegionSggChange;
  }, [onSelectedRegionSggChange, selectedRegionSggProp]);

  const settings = useMemo(() => loadRegionalSettings(region.id), [region.id]);

  const analyticsPeriod = selectedRangeProp ?? analyticsPeriodState;
  const rangePreset =
    analyticsPeriod === 'month' ? '30d' : analyticsPeriod === 'quarter' ? '90d' : rangePresetState;
  const selectedKpiKey = selectedKpiKeyProp ?? selectedKpiKeyState;
  const selectedDistrictName = selectedRegionSggProp ?? selectedDistrictNameState;
  const selectedRegionId = selectedRegionIdState;
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
  const scopePathKey = useMemo(
    () => drillStack.map((item) => `${item.level}:${item.id}`).join('>'),
    [drillStack],
  );
  const mapSubRegions = useMemo(() => {
    const direct = mapSubRegionsByScope[scopePathKey];
    const fallback = !direct?.length
      ? Object.entries(mapSubRegionsByScope)
          .filter(([key, regions]) => regions.length > 0 && scopePathKey.startsWith(key))
          .sort((a, b) => b[0].length - a[0].length)[0]?.[1]
      : undefined;
    const source = direct?.length ? direct : fallback ?? [];
    if (!source.length) return [] as MapChildRegion[];

    const deduped = new Map<string, MapChildRegion>();
    source.forEach((item) => {
      const code =
        normalizeRegionCode(item.code) ||
        normalizeRegionCode(parseRegionIdCode(item.regionId));
      const name = String(item.name ?? '').trim();
      if (!code || !name) return;
      if (deduped.has(code)) return;
      deduped.set(code, {
        ...item,
        code,
        name,
        regionKey: {
          ...item.regionKey,
          code,
          name,
        },
        regionId:
          item.regionId ||
          makeRegionId({
            level: item.regionKey.level,
            code,
            name,
          }),
      });
    });

    return [...deduped.values()];
  }, [mapSubRegionsByScope, scopePathKey]);

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

  const updateSelectedDistrict = useCallback((next: string | null) => {
    setSelectedDistrictNameState((prev) => (prev === next ? prev : next));
    const currentExternal = selectedRegionSggPropRef.current ?? null;
    if (currentExternal === next) return;
    onSelectedRegionSggChangeRef.current?.(next);
  }, []);

  const updateSelectedRegionId = useCallback((next: string | null) => {
    setSelectedRegionIdState(next);
  }, []);

  useEffect(() => {
    setSelectedDistrictNameState(null);
    updateSelectedRegionId(null);
    setMapDrillLevel(undefined);
    setMapDrillCode(undefined);
    setMapSubRegionsByScope({});
    subRegionSignatureByScopeRef.current = {};
    setStageImpactOpen(false);
    setShowCauseDetail(false);
    setTodoStateById({});
  }, [region.id, updateSelectedRegionId]);

  useEffect(() => {
    if (analyticsPeriod === 'month' && rangePresetState !== '30d') setRangePresetState('30d');
    if (analyticsPeriod === 'quarter' && rangePresetState !== '90d') setRangePresetState('90d');
  }, [analyticsPeriod, rangePresetState]);

  useEffect(() => {
    setSelectedCauseName(null);
  }, [selectedKpiKey, selectedDistrictName]);

  useEffect(() => {
    setShowExtendedTopN(false);
    setShowCauseDetail(false);
  }, [selectedDistrictName, selectedKpiKey]);

  useEffect(() => {
    const signature = `${selectedKpiKey}|${rangePreset}|${visualizationMode}`;
    if (signature === lastFilterSignatureRef.current) return;

    if (filterSyncTimerRef.current) {
      window.clearTimeout(filterSyncTimerRef.current);
    }
    filterSyncTimerRef.current = window.setTimeout(() => {
      syncDrillFilters(
        {
          kpi: selectedKpiKey,
          range: rangePreset,
          view: visualizationMode,
        },
        'replace',
      );
      lastFilterSignatureRef.current = signature;
    }, 180);

    return () => {
      if (filterSyncTimerRef.current) window.clearTimeout(filterSyncTimerRef.current);
    };
  }, [rangePreset, selectedKpiKey, syncDrillFilters, visualizationMode]);

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
  const normalizedDistrictMap = useMemo(() => {
    const map = new Map<string, string>();
    districts.forEach((name) => map.set(normalizeRegionLabel(name), name));
    return map;
  }, [districts]);
  const sigunguRegions = useMemo(
    () => mapSubRegions.filter((regionInfo) => regionInfo.regionKey.level === 'SIGUNGU'),
    [mapSubRegions],
  );
  const sigunguByNormalizedName = useMemo(() => {
    const map = new Map<string, { code: string; name: string }>();
    sigunguRegions.forEach((item) => map.set(normalizeRegionLabel(item.name), item));
    return map;
  }, [sigunguRegions]);
  const districtRegionEntries = useMemo(
    () =>
      districts.map((name) => {
        const normalized = normalizeRegionLabel(name);
        const mapped = sigunguByNormalizedName.get(normalized);
        return {
          name,
          code: mapped?.code ?? '',
        };
      }).filter((entry) => entry.code),
    [districts, sigunguByNormalizedName],
  );
  const emdRegions = useMemo(
    () => mapSubRegions.filter((regionInfo) => regionInfo.regionKey.level === 'EUPMYEONDONG'),
    [mapSubRegions],
  );
  const sigunguByCode = useMemo(() => {
    const map = new Map<string, string>();
    sigunguRegions.forEach((item) => map.set(String(item.code), item.name));
    return map;
  }, [sigunguRegions]);
  const emdByCode = useMemo(() => {
    const map = new Map<string, { code: string; name: string }>();
    emdRegions.forEach((item) => map.set(String(item.code), { code: String(item.code), name: item.name }));
    return map;
  }, [emdRegions]);
  const activeSigunguFromDrill = useMemo(() => {
    for (let idx = drillStack.length - 1; idx >= 0; idx -= 1) {
      const item = drillStack[idx];
      if (item.level === 'SIGUNGU') {
        return sigunguByCode.get(String(item.id)) ?? item.label;
      }
      if (item.level === 'EUPMYEONDONG') {
        const parentSigCode = String(item.id).slice(0, 5);
        const parentSigName = sigunguByCode.get(parentSigCode);
        if (parentSigName) return parentSigName;
      }
    }
    return null;
  }, [drillStack, sigunguByCode]);

  // 운영 화면의 단일 컨텍스트는 drill stack이며, 지도/패널 상태를 여기서 동기화한다.
  useEffect(() => {
    if (drillCurrent.level === 'REGION') {
      if (selectedDistrictName !== null) updateSelectedDistrict(null);
      if (selectedRegionId !== null) updateSelectedRegionId(null);
      setMapDrillLevel('sig');
      setMapDrillCode(region.ctprvnCode);
      return;
    }

    if (activeSigunguFromDrill && selectedDistrictName !== activeSigunguFromDrill) {
      updateSelectedDistrict(activeSigunguFromDrill);
    }

    if (drillCurrent.level === 'SIGUNGU') {
      const nextRegionId = makeRegionId({
        level: 'SIGUNGU',
        code: String(drillCurrent.id),
        name: drillCurrent.label,
      });
      if (selectedRegionId !== nextRegionId) updateSelectedRegionId(nextRegionId);
      setMapDrillLevel('emd');
      setMapDrillCode(drillCurrent.id);
      return;
    }

    const nextRegionId = makeRegionId({
      level: 'EUPMYEONDONG',
      code: String(drillCurrent.id),
      name: drillCurrent.label,
    });
    if (selectedRegionId !== nextRegionId) updateSelectedRegionId(nextRegionId);
    setMapDrillLevel('emd');
    setMapDrillCode(drillCurrent.id);
  }, [
    activeSigunguFromDrill,
    drillCurrent.id,
    drillCurrent.label,
    drillCurrent.level,
    region.ctprvnCode,
    selectedDistrictName,
    selectedRegionId,
    updateSelectedDistrict,
    updateSelectedRegionId,
  ]);

  useEffect(() => {
    const hasPropChanged = prevSelectedRegionSggPropRef.current !== selectedRegionSggProp;
    prevSelectedRegionSggPropRef.current = selectedRegionSggProp;
    if (!hasPropChanged) return;
    if (!selectedRegionSggProp) return;
    if (drillCurrent.level !== 'REGION') return;
    const hasSigungu = drillStack.some(
      (item) =>
        item.level === 'SIGUNGU' &&
        normalizeRegionLabel(item.label) === normalizeRegionLabel(selectedRegionSggProp),
    );
    if (hasSigungu) return;
    const matched = sigunguByNormalizedName.get(normalizeRegionLabel(selectedRegionSggProp));
    if (!matched?.code) return;
    const resolvedLabel = normalizedDistrictMap.get(normalizeRegionLabel(selectedRegionSggProp)) ?? selectedRegionSggProp;
    updateSelectedRegionId(
      makeRegionId({
        level: 'SIGUNGU',
        code: matched.code,
        name: resolvedLabel,
      }),
    );
    startTransition(() => {
      pushDrill(
        {
          level: 'SIGUNGU',
          id: matched.code,
          label: resolvedLabel,
          filters: {
            kpi: selectedKpiKey,
            range: rangePreset,
            view: visualizationMode,
          },
        },
        'replace',
      );
    });
  }, [
    drillCurrent.level,
    drillStack,
    normalizedDistrictMap,
    pushDrill,
    rangePreset,
    selectedKpiKey,
    selectedRegionSggProp,
    sigunguByNormalizedName,
    updateSelectedRegionId,
    visualizationMode,
  ]);

  const currentScopeNode = useMemo<ScopeDrillNode>(() => {
    const level =
      drillCurrent.level === 'REGION' || drillCurrent.level === 'SIGUNGU' || drillCurrent.level === 'EUPMYEONDONG'
        ? drillCurrent.level
        : 'REGION';
    return {
      level,
      id: String(drillCurrent.id),
      name: drillCurrent.label,
    };
  }, [drillCurrent.id, drillCurrent.label, drillCurrent.level]);
  const expectedChildAdminLevel = useMemo(
    () => getChildAdminLevel(currentScopeNode.level),
    [currentScopeNode.level],
  );
  const scopeMatchedMapSubRegions = useMemo(
    () => mapSubRegions.filter((item) => item.regionKey.level === expectedChildAdminLevel),
    [expectedChildAdminLevel, mapSubRegions],
  );

  const districtSourceRegions = useMemo(
    () => {
      if (sigunguRegions.length >= 3) {
        return sigunguRegions.map((item) => ({ code: String(item.code), name: item.name }));
      }

      const fallbackSigungu = SIGUNGU_OPTIONS[region.ctprvnCode] ?? [];
      if (fallbackSigungu.length) {
        return fallbackSigungu.map((item) => ({ code: String(item.code), name: item.label }));
      }

      return districtRegionEntries.map((entry) => ({ code: String(entry.code), name: entry.name }));
    },
    [districtRegionEntries, region.ctprvnCode, sigunguRegions],
  );

  const districtRowsQuery = useQuery<{ items: DistrictOpsData[] }>({
    queryKey: [
      'regional-dashboard',
      'districts',
      region.id,
      analyticsPeriod,
      rangePreset,
      districtSourceRegions.map((entry) => `${entry.code}:${entry.name}`).join('|'),
    ],
    queryFn: async () => {
      const remote = await fetchRegionalDashboardDistricts({
        regionId: region.id,
        period: analyticsPeriod,
        rangePreset,
        districts: districtSourceRegions,
      });
      return { items: (remote.items || []) as DistrictOpsData[] };
    },
    staleTime: 30_000,
    placeholderData: (prev) => prev,
  });

  const districtRows = useMemo(
    () => {
      const remoteItems = districtRowsQuery.data?.items ?? [];
      if (remoteItems.length) return remoteItems;
      return districtSourceRegions.map((entry) =>
        buildDistrictData(entry.name, `${region.id}-${rangePreset}`, analyticsPeriod, rangePreset, entry.code),
      );
    },
    [analyticsPeriod, districtRowsQuery.data?.items, districtSourceRegions, rangePreset, region.id],
  );

  const emdRows = useMemo(() => {
    if (!emdRegions.length) return [] as DistrictOpsData[];
    return emdRegions.map((regionInfo) =>
      buildDistrictData(
        regionInfo.name,
        `${region.id}-${drillCurrent.level}-${drillCurrent.id}-${rangePreset}`,
        analyticsPeriod,
        rangePreset,
        regionInfo.code,
      ),
    );
  }, [analyticsPeriod, drillCurrent.id, drillCurrent.level, emdRegions, rangePreset, region.id]);

  const sigunguChildRowsFromMap = useMemo(() => {
    if (drillCurrent.level !== 'SIGUNGU') return [] as DistrictOpsData[];
    if (!scopeMatchedMapSubRegions.length) return [] as DistrictOpsData[];
    const strictChildren = scopeMatchedMapSubRegions.filter((regionInfo) => {
      const code = String(regionInfo.code);
      return code.startsWith(String(drillCurrent.id)) && code.length > String(drillCurrent.id).length;
    });
    const candidateRegions =
      strictChildren.length > 0
        ? strictChildren
        : scopeMatchedMapSubRegions.filter((regionInfo) => String(regionInfo.code) !== String(drillCurrent.id));
    return candidateRegions.map((regionInfo) =>
      buildDistrictData(
        regionInfo.name,
        `${region.id}-${drillCurrent.level}-${drillCurrent.id}-${rangePreset}-map-fallback`,
        analyticsPeriod,
        rangePreset,
        regionInfo.code,
      ),
    );
  }, [analyticsPeriod, drillCurrent.id, drillCurrent.level, rangePreset, region.id, scopeMatchedMapSubRegions]);

  const candidateSubRegions = useMemo<{ code: string; name: string }[]>(() => {
    if (currentScopeNode.level === 'REGION') {
      if (scopeMatchedMapSubRegions.length > 0) {
        return scopeMatchedMapSubRegions.map((item) => ({ code: String(item.code), name: item.name }));
      }
      return districtRows.map((row) => ({ code: String(row.regionId), name: row.name }));
    }

    if (currentScopeNode.level === 'SIGUNGU') {
      const strictCandidates = scopeMatchedMapSubRegions
        .filter((item) => {
          const code = String(item.code);
          return code.startsWith(String(currentScopeNode.id)) && code.length > String(currentScopeNode.id).length;
        })
        .map((item) => ({ code: String(item.code), name: item.name }));
      const mapCandidates = (strictCandidates.length > 0 ? strictCandidates : scopeMatchedMapSubRegions
        .filter((item) => String(item.code) !== String(currentScopeNode.id))
        .map((item) => ({ code: String(item.code), name: item.name })));
      if (mapCandidates.length > 0) return mapCandidates;
      return emdRows.map((row) => ({ code: String(row.regionId), name: row.name }));
    }

    return [];
  }, [currentScopeNode.id, currentScopeNode.level, districtRows, emdRows, scopeMatchedMapSubRegions]);

  const childrenScope = useMemo(
    () =>
      getChildrenScope({
        level: toDashboardDrillLevel(currentScopeNode.level),
        parentRegionCode: String(currentScopeNode.id),
        candidates: candidateSubRegions,
      }),
    [candidateSubRegions, currentScopeNode.id, currentScopeNode.level],
  );

  const scopedRowsByCode = useMemo(() => {
    const rowMap = new Map<string, DistrictOpsData>();
    [...districtRows, ...emdRows, ...sigunguChildRowsFromMap].forEach((row) => {
      rowMap.set(String(row.regionId), row);
    });

    return childrenScope.children.map((child) => {
      const existing = rowMap.get(child.code);
      if (existing) return existing;
      return buildDistrictData(
        child.name,
        `${region.id}-${currentScopeNode.level}-${currentScopeNode.id}-${rangePreset}-scope-fill`,
        analyticsPeriod,
        rangePreset,
        child.code,
      );
    });
  }, [
    analyticsPeriod,
    childrenScope.children,
    currentScopeNode.id,
    currentScopeNode.level,
    districtRows,
    emdRows,
    rangePreset,
    region.id,
    sigunguChildRowsFromMap,
  ]);

  const computedRankingRows = useMemo(() => {
    if (currentScopeNode.level === 'EUPMYEONDONG') {
      const leafRow =
        emdRows.find((row) => String(row.regionId) === String(currentScopeNode.id)) ??
        sigunguChildRowsFromMap.find((row) => String(row.regionId) === String(currentScopeNode.id));
      if (leafRow) return [leafRow];
      return [
        buildDistrictData(
          currentScopeNode.name,
          `${region.id}-${currentScopeNode.level}-${currentScopeNode.id}-${rangePreset}-leaf`,
          analyticsPeriod,
          rangePreset,
          currentScopeNode.id,
        ),
      ];
    }

    if (scopedRowsByCode.length > 0) return scopedRowsByCode;
    if (currentScopeNode.level === 'REGION') return districtRows;
    if (currentScopeNode.level === 'SIGUNGU') {
      if (sigunguChildRowsFromMap.length > 0) return sigunguChildRowsFromMap;
      if (emdRows.length > 0) return emdRows;
      return [];
    }
    return [];
  }, [
    analyticsPeriod,
    currentScopeNode.id,
    currentScopeNode.level,
    currentScopeNode.name,
    districtRows,
    emdRows,
    rangePreset,
    region.id,
    scopedRowsByCode,
    sigunguChildRowsFromMap,
  ]);

  const scopeRowsCacheRef = useRef<Record<string, DistrictOpsData[]>>({});
  useEffect(() => {
    if (!computedRankingRows.length) return;
    scopeRowsCacheRef.current[scopePathKey] = computedRankingRows;
  }, [computedRankingRows, scopePathKey]);

  const rankingRowsSource = useMemo(() => {
    if (computedRankingRows.length) return computedRankingRows;
    const cached = scopeRowsCacheRef.current[scopePathKey];
    if (cached?.length) return cached;
    if (currentScopeNode.level === 'REGION') return districtRows;
    if (currentScopeNode.level === 'SIGUNGU' && sigunguChildRowsFromMap.length) return sigunguChildRowsFromMap;
    if (currentScopeNode.level === 'SIGUNGU' && emdRows.length) return emdRows;
    return [];
  }, [computedRankingRows, currentScopeNode.level, districtRows, emdRows, scopePathKey, sigunguChildRowsFromMap]);
  const hasScopedRows = rankingRowsSource.length > 0;
  const loadingTransitionKey = `${scopePathKey}|${selectedKpiKey}|${rangePreset}|${visualizationMode}`;

  useEffect(() => {
    if (loadingTransitionKey === lastLoadingTransitionRef.current) return;
    lastLoadingTransitionRef.current = loadingTransitionKey;
    if (loadingPhase === 'Initial') return;
    setLoadingPhase('RegionChange');
  }, [loadingPhase, loadingTransitionKey]);

  useEffect(() => {
    if (loadingPhase !== 'RegionChange') return;
    const timer = window.setTimeout(() => {
      setLoadingPhase(hasScopedRows ? 'Ready' : 'PartialData');
    }, 140);
    return () => window.clearTimeout(timer);
  }, [hasScopedRows, loadingPhase]);

  useEffect(() => {
    if (loadingPhase !== 'Initial') return;
    setLoadingPhase(hasScopedRows ? 'Ready' : 'Empty');
  }, [hasScopedRows, loadingPhase]);

  useEffect(() => {
    if (!hasScopedRows) return;
    if (loadingPhase === 'Ready' || loadingPhase === 'RegionChange') return;
    setLoadingPhase('Ready');
  }, [hasScopedRows, loadingPhase]);

  const panelFadeClass =
    loadingPhase === 'RegionChange'
      ? 'transition-[opacity,transform] duration-200 ease-out opacity-60 translate-y-[2px] pointer-events-none'
      : 'transition-[opacity,transform] duration-200 ease-out opacity-100 translate-y-0';

  const selectedSigunguCode = useMemo(() => {
    if (drillCurrent.level === 'SIGUNGU') return String(drillCurrent.id);
    if (drillCurrent.level === 'EUPMYEONDONG') return String(drillCurrent.id).slice(0, 5);
    return null;
  }, [drillCurrent.id, drillCurrent.level]);

  const selectedDistrictData = useMemo(() => {
    if (selectedSigunguCode) {
      const byCode = districtRows.find((row) => String(row.regionId) === selectedSigunguCode);
      if (byCode) return byCode;
    }
    if (!selectedDistrictName) return null;
    return (
      districtRows.find((row) => normalizeRegionLabel(row.name) === normalizeRegionLabel(selectedDistrictName)) ?? null
    );
  }, [districtRows, selectedDistrictName, selectedSigunguCode]);

  const aggregated = useMemo(
    () => aggregateDistrictData(rankingRowsSource.length ? rankingRowsSource : districtRows),
    [districtRows, rankingRowsSource],
  );
  const focusData = useMemo(() => {
    if (drillCurrent.level === 'REGION') return selectedDistrictData ?? aggregated;
    if (drillCurrent.level === 'SIGUNGU') return aggregated;
    if (drillCurrent.level === 'EUPMYEONDONG') return rankingRowsSource[0] ?? aggregated;
    return selectedDistrictData ?? aggregated;
  }, [aggregated, drillCurrent.level, rankingRowsSource, selectedDistrictData]);

  const selectedKpiDef = useMemo<RegionalDashboardKpiConfig>(
    () => REGIONAL_DASHBOARD_KPI_MAP[selectedKpiKey] ?? REGIONAL_DASHBOARD_KPIS[0],
    [selectedKpiKey],
  );
  const activeMapLayer = MAP_LAYER_BY_KPI[selectedKpiKey];
  const mapLayerOptions = useMemo(
    () =>
      [
        { key: 'RISK' as const, label: '위험', kpi: PRIMARY_KPI_BY_LAYER.RISK },
        { key: 'BOTTLENECK' as const, label: '병목', kpi: PRIMARY_KPI_BY_LAYER.BOTTLENECK },
        { key: 'GAP' as const, label: '격차', kpi: PRIMARY_KPI_BY_LAYER.GAP },
        { key: 'LOAD' as const, label: '부하', kpi: PRIMARY_KPI_BY_LAYER.LOAD },
      ],
    [],
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
  const activeChartPalette = useMemo(
    () => (COLOR_PALETTES[mapColorScheme as keyof typeof COLOR_PALETTES] ?? COLOR_PALETTES.blue),
    [mapColorScheme],
  );
  const breadcrumbTrail = drillStack;
  const currentDrillLabel =
    drillCurrent.level === 'REGION'
      ? region.label
      : drillCurrent.label;

  const navigateMetricAction = useCallback(
    (tab: MetricActionTab) => {
      if (!onNavigateModule) return;
      if (tab === 'bottleneck') onNavigateModule('cause');
      if (tab === 'actions') onNavigateModule('interventions');
      if (tab === 'reports') onNavigateModule('reports');
      if (tab === 'settings') onNavigateModule('settings');
    },
    [onNavigateModule],
  );

  const renderMetricLabel = useCallback(
    (label: string, key: MetricHelpKey, className?: string) => {
      const help = getMetricHelp(key, {
        scopeLabel: currentDrillLabel,
        rangeLabel: RANGE_PRESET_LABEL[rangePreset],
        longWaitDays: settings.thresholds.longWaitDays,
      });
      return (
        <MetricLabel
          label={label}
          help={help}
          className={className}
          onActionClick={() => navigateMetricAction(help.actionTab)}
        />
      );
    },
    [currentDrillLabel, navigateMetricAction, rangePreset, settings.thresholds.longWaitDays],
  );

  const mapHeaderTitle = `${RANGE_PRESET_LABEL[rangePreset]} · ${region.label} · ${toUserCopy(selectedKpiDef.shortLabel)} · 시군구`;

  const mapValueList = useMemo(
    () => rankingRowsSource.map((row) => row.mapMetric[selectedKpiKey]),
    [rankingRowsSource, selectedKpiKey],
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
    return rankingRowsSource.map((row) => {
      const value = row.mapMetric[selectedKpiKey];
      const ratio = (value - mapMin) / span;
      const idx = Math.max(0, Math.min(palette.length - 1, Math.floor(ratio * palette.length)));
      const code = String(row.regionId);
      return {
        code,
        name: row.name,
        regionId: makeRegionId({
          level: getChildAdminLevel(currentScopeNode.level),
          code,
          name: row.name,
        }),
        size: Math.max(1, value),
        value,
        fill: palette[idx],
      };
    });
  }, [currentScopeNode.level, rankingRowsSource, selectedKpiKey, mapMin, mapMax, mapColorScheme]);

  const regionalValue = aggregated.kpi[selectedKpiKey];

  const priorityRows = useMemo(() => {
    const direction = determineDirection(selectedKpiKey);
    const values = rankingRowsSource.map((row) => row.kpi[selectedKpiKey]);
    const volumes = rankingRowsSource.map((row) => row.volume);
    const valueMin = Math.min(...values);
    const valueMax = Math.max(...values);
    const volumeMin = Math.min(...volumes);
    const volumeMax = Math.max(...volumes);

    const adDensitySeries = rankingRowsSource.map((row) => row.adTransitionSignal.densityScore);
    const adTransitionSeries = rankingRowsSource.map((row) => row.adTransitionSignal.transition30d);
    const adDeltaSeries = rankingRowsSource.map((row) => row.adTransitionSignal.deltaFromAvg);

    const dxWaitSeries = rankingRowsSource.map((row) => row.differentialDelay.avgWaitDays);
    const dxDelayedSeries = rankingRowsSource.map((row) => row.differentialDelay.delayedRatio);
    const dxBacklogSeries = rankingRowsSource.map((row) => row.differentialDelay.backlogCount);

    const conversionGapSeries = rankingRowsSource.map((row) => 1 - row.stageConversionRate.conversionRate);
    const conversionDeltaGapSeries = rankingRowsSource.map((row) => -row.stageConversionRate.deltaFromRegional);
    const conversionSupportSeries = rankingRowsSource.map(
      (row) => row.screenToDxDrivers.reduce((sum, item) => sum + item.value, 0) / Math.max(1, row.screenToDxDrivers.length),
    );

    return rankingRowsSource
      .map((row) => {
        const kpiValue = row.kpi[selectedKpiKey];
        let score = computePriorityScore({
          kpiValue,
          kpiMin: valueMin,
          kpiMax: valueMax,
          volume: row.volume,
          volumeMin,
          volumeMax,
          direction,
        });

        if (selectedKpiKey === 'regionalAdTransitionHotspot') {
          const densityNorm = normalizeValue(
            row.adTransitionSignal.densityScore,
            Math.min(...adDensitySeries),
            Math.max(...adDensitySeries),
          );
          const transitionNorm = normalizeValue(
            row.adTransitionSignal.transition30d,
            Math.min(...adTransitionSeries),
            Math.max(...adTransitionSeries),
          );
          const deltaNorm = normalizeValue(
            row.adTransitionSignal.deltaFromAvg,
            Math.min(...adDeltaSeries),
            Math.max(...adDeltaSeries),
          );
          score = Number(
            (
              densityNorm * AD_TOP5_WEIGHTS.density +
              transitionNorm * AD_TOP5_WEIGHTS.transition +
              deltaNorm * AD_TOP5_WEIGHTS.delta
            ).toFixed(3),
          );
        } else if (selectedKpiKey === 'regionalDxDelayHotspot') {
          const waitNorm = normalizeValue(
            row.differentialDelay.avgWaitDays,
            Math.min(...dxWaitSeries),
            Math.max(...dxWaitSeries),
          );
          const delayedNorm = normalizeValue(
            row.differentialDelay.delayedRatio,
            Math.min(...dxDelayedSeries),
            Math.max(...dxDelayedSeries),
          );
          const backlogNorm = normalizeValue(
            row.differentialDelay.backlogCount,
            Math.min(...dxBacklogSeries),
            Math.max(...dxBacklogSeries),
          );
          score = Number(
            (
              waitNorm * DX_DELAY_TOP5_WEIGHTS.wait +
              delayedNorm * DX_DELAY_TOP5_WEIGHTS.delayed +
              backlogNorm * DX_DELAY_TOP5_WEIGHTS.backlog
            ).toFixed(3),
          );
        } else if (selectedKpiKey === 'regionalScreenToDxRate') {
          const conversionGapNorm = normalizeValue(
            1 - row.stageConversionRate.conversionRate,
            Math.min(...conversionGapSeries),
            Math.max(...conversionGapSeries),
          );
          const deltaGapNorm = normalizeValue(
            -row.stageConversionRate.deltaFromRegional,
            Math.min(...conversionDeltaGapSeries),
            Math.max(...conversionDeltaGapSeries),
          );
          const supportValue =
            row.screenToDxDrivers.reduce((sum, item) => sum + item.value, 0) /
            Math.max(1, row.screenToDxDrivers.length);
          const supportNorm = normalizeValue(
            supportValue,
            Math.min(...conversionSupportSeries),
            Math.max(...conversionSupportSeries),
          );
          score = Number(
            (
              conversionGapNorm * SCREEN_TO_DX_TOP5_WEIGHTS.gapRate +
              deltaGapNorm * SCREEN_TO_DX_TOP5_WEIGHTS.deltaGap +
              supportNorm * SCREEN_TO_DX_TOP5_WEIGHTS.support
            ).toFixed(3),
          );
        }

        const districtNationalRef = Number(
          sv(
            `national-${selectedKpiKey}-${rangePreset}-${analyticsPeriod}-${drillCurrent.level}-${drillCurrent.id}-${row.name}`,
            KPI_RANGE[selectedKpiKey][0],
            KPI_RANGE[selectedKpiKey][1],
          ).toFixed(1),
        );

        const normalizedCode =
          normalizeRegionCode(parseRegionIdCode(row.regionId)) ||
          normalizeRegionCode(row.regionId);
        return {
          code: normalizedCode,
          regionId: makeRegionId({
            level: getChildAdminLevel(currentScopeNode.level),
            code: normalizedCode,
            name: row.name,
          }),
          name: row.name,
          kpiValue,
          volume: row.volume,
          priorityScore: score,
          nationalDelta: Number((kpiValue - districtNationalRef).toFixed(1)),
        };
      })
      .sort((a, b) => {
        if (b.priorityScore !== a.priorityScore) return b.priorityScore - a.priorityScore;
        const nameCompare = a.name.localeCompare(b.name, 'ko-KR');
        if (nameCompare !== 0) return nameCompare;
        return a.code.localeCompare(b.code);
      });
  }, [
    analyticsPeriod,
    currentScopeNode.level,
    drillCurrent.id,
    drillCurrent.level,
    rangePreset,
    rankingRowsSource,
    selectedKpiKey,
  ]);

  const childCodeSet = useMemo(
    () =>
      new Set(
        childrenScope.childrenCodes
          .map((code) => normalizeRegionCode(code))
          .filter(Boolean),
      ),
    [childrenScope.childrenCodes],
  );

  const top5 = useMemo(() => {
    const childLevel = getChildAdminLevel(currentScopeNode.level);
    const scopedRows = priorityRows.filter((row) => {
      const normalizedCode =
        normalizeRegionCode(row.code) ||
        normalizeRegionCode(parseRegionIdCode(row.code));
      if (!normalizedCode) return false;
      if (!childCodeSet.size) return true;
      return childCodeSet.has(normalizedCode);
    });
    const source = (scopedRows.length > 0 ? scopedRows : priorityRows).slice(0, 5);
    const normalizedTopRows: Array<(typeof priorityRows)[number] & { code: string; regionId: string; regionKey: { level: AdminLevel; code: string; name: string } }> = [];

    source.forEach((row) => {
      const code =
        normalizeRegionCode(row.code) ||
        normalizeRegionCode(parseRegionIdCode(row.regionId));
      if (!code) return;
      normalizedTopRows.push({
        ...row,
        code,
        regionKey: {
          level: childLevel,
          code,
          name: row.name,
        },
        regionId: makeRegionId({
          level: childLevel,
          code,
          name: row.name,
        }),
      });
    });

    return normalizedTopRows;
  }, [childCodeSet, currentScopeNode.level, priorityRows]);

  const totalVolume = useMemo(
    () => rankingRowsSource.reduce((sum, row) => sum + row.volume, 0),
    [rankingRowsSource],
  );

  const top5Concentration = useMemo(() => {
    if (!top5.length || totalVolume <= 0) return null;
    const top5Volume = top5.reduce((sum, row) => sum + row.volume, 0);
    return Number(((top5Volume / totalVolume) * 100).toFixed(1));
  }, [top5, totalVolume]);

  const top5ConcentrationLabel = top5Concentration == null ? '—' : `${top5Concentration.toFixed(1)}%`;
  const top2RegionLabel = useMemo(() => {
    const names = top5.slice(0, 2).map((item) => item.name);
    return names.length ? names.join('/') : `${region.label} 상위`;
  }, [region.label, top5]);
  const userKpiLabel = USER_LABEL_BY_KPI[selectedKpiKey] ?? toUserCopy(selectedKpiDef.shortLabel);

  const insightHeadline = useMemo(() => {
    const layerLabel = mapLayerOptions.find((item) => item.key === activeMapLayer)?.label ?? activeMapLayer;
    const statusToken =
      selectedKpiDef.direction === 'higherWorse'
        ? `${userKpiLabel} 압력↑`
        : `${userKpiLabel} 흐름 변동`;
    return safeOpsText(
      `${RANGE_PRESET_LABEL[rangePreset]} 기준 ${layerLabel} · ${statusToken} · 우선 개입: ${top2RegionLabel}`,
    );
  }, [
    activeMapLayer,
    mapLayerOptions,
    rangePreset,
    selectedKpiDef.direction,
    userKpiLabel,
    top2RegionLabel,
  ]);

  const miniSparkSeries = useMemo<SparkSeries[]>(() => {
    const pointLabels = rangePreset === '7d' ? ['D-6', 'D-5', 'D-4', 'D-3', 'D-2', 'D-1', 'D0'] : ['T-7', 'T-6', 'T-5', 'T-4', 'T-3', 'T-2', 'T-1', 'T0'];
    const slaRiskRegions = rankingRowsSource.filter((row) => row.kpi.regionalRecontact >= 10).length;
    const overdueFollowups = rankingRowsSource.reduce(
      (sum, row) => sum + (row.recontactReasons.find((item) => item.name === '미응답')?.value ?? 0),
      0,
    );
    const bottleneckValue =
      rankingRowsSource.length > 0
        ? Number(
            (
              rankingRowsSource.reduce((sum, row) => sum + row.differentialDelay.avgWaitDays, 0) /
              rankingRowsSource.length
            ).toFixed(1),
          )
        : 0;

    const buildSeries = (key: SparkSeriesKey, label: string, unit: SparkSeries['unit'], currentValue: number) => {
      const drift = sv(`${region.id}-${key}-${rangePreset}-drift`, -1.2, 1.2);
      const noiseSpan = unit === '건' ? Math.max(6, currentValue * 0.08) : unit === '곳' ? 1.5 : 1.0;
      const points = pointLabels.map((t, idx) => {
        const offset = idx - (pointLabels.length - 1);
        const raw = currentValue + offset * drift + sv(`${region.id}-${key}-${rangePreset}-${t}`, -noiseSpan, noiseSpan);
        const value = Math.max(0, unit === '일' ? Number(raw.toFixed(1)) : Math.round(raw));
        return { t, v: value };
      });

      if (points.length) {
        points[points.length - 1] = {
          ...points[points.length - 1],
          v: unit === '일' ? Number(currentValue.toFixed(1)) : Math.round(currentValue),
        };
      }
      const last = points[points.length - 1]?.v ?? 0;
      const prev = points[Math.max(0, points.length - 2)]?.v ?? last;

      return {
        key,
        label,
        unit,
        points,
        value: last,
        delta: Number((last - prev).toFixed(1)),
      } satisfies SparkSeries;
    };

    return [
      buildSeries('slaRisk', 'SLA 위험 구역', '곳', slaRiskRegions),
      buildSeries('bottleneck', '병목 지연', '일', bottleneckValue),
      buildSeries('overdueFollowup', '재접촉 지연', '건', overdueFollowups),
    ];
  }, [rangePreset, rankingRowsSource, region.id]);

  const baselineBadges = useMemo(() => {
    const dxDelayThreshold = Math.round(REGIONAL_DASHBOARD_KPI_MAP.regionalDxDelayHotspot.target ?? 24);
    const recontactThreshold = Math.round(REGIONAL_DASHBOARD_KPI_MAP.regionalRecontact.target ?? 12);
    return [
      {
        label: `SLA 위험 기준 ${settings.thresholds.longWaitDays}일 초과`,
        tooltip: `SLA 위험 기준: ${settings.thresholds.longWaitDays}일 초과 케이스를 위험으로 집계`,
      },
      {
        label: `검사 지연 임계 ${dxDelayThreshold}일`,
        tooltip: `감별검사 평균 대기일 임계값: ${dxDelayThreshold}일`,
      },
      {
        label: `재접촉 경고 ${recontactThreshold}%`,
        tooltip: `재접촉 필요율 경고 기준: ${recontactThreshold}%`,
      },
    ];
  }, [settings.thresholds.longWaitDays]);

  const alertSummary = useMemo<AlertSummary>(() => {
    const slaAtRiskRegions = rankingRowsSource.filter((row) => row.kpi.regionalRecontact >= 10).length;
    const examDelayRegions = rankingRowsSource.filter(
      (row) => row.differentialDelay.avgWaitDays >= settings.thresholds.longWaitDays,
    ).length;
    const overdueFollowups = rankingRowsSource.reduce(
      (sum, row) => sum + (row.recontactReasons.find((item) => item.name === '미응답')?.value ?? 0),
      0,
    );
    const surgeRegions = rankingRowsSource.filter((row) => row.stageImpact.stage1QueueDelta >= 12).length;
    return {
      slaAtRiskRegions,
      examDelayRegions,
      overdueFollowups: Math.round(overdueFollowups),
      surgeRegions,
    };
  }, [rankingRowsSource, settings.thresholds.longWaitDays]);

  const opsKpiBlocks = useMemo<RegionalKpiBlock[]>(
    () => {
      const riskHotspots = rankingRowsSource.filter((row) => row.adTransitionSignal.densityScore >= 70).length;
      const highRiskCases = rankingRowsSource.reduce((sum, row) => sum + row.adTransitionSignal.highRiskCount, 0);
      const avgExamDelayDays =
        rankingRowsSource.length > 0
          ? Number(
              (
                rankingRowsSource.reduce((sum, row) => sum + row.differentialDelay.avgWaitDays, 0) /
                rankingRowsSource.length
              ).toFixed(1),
            )
          : 0;
      const stage2Queue = Math.round(
        rankingRowsSource.reduce(
          (sum, row) => sum + (row.queueTypeBacklog.find((item) => item.name === '2차 큐')?.value ?? 0),
          0,
        ),
      );
      const conversionRates = rankingRowsSource.map((row) => row.stageConversionRate.conversionRate * 100);
      const conversionGap =
        conversionRates.length > 1
          ? Number((Math.max(...conversionRates) - Math.min(...conversionRates)).toFixed(1))
          : 0;
      const processingGapDays =
        rankingRowsSource.length > 1
          ? Number(
              (
                Math.max(...rankingRowsSource.map((row) => row.differentialDelay.avgWaitDays)) -
                Math.min(...rankingRowsSource.map((row) => row.differentialDelay.avgWaitDays))
              ).toFixed(1),
            )
          : 0;
      return [
        {
          id: 'risk',
          title: 'Risk',
          value: riskHotspots,
          unit: '곳',
          delta: { value: alertSummary.slaAtRiskRegions, unit: '곳', direction: alertSummary.slaAtRiskRegions > 0 ? 'up' : 'flat' },
          severity: alertSummary.slaAtRiskRegions > 4 ? 'critical' : alertSummary.slaAtRiskRegions > 2 ? 'warn' : 'normal',
          bindLayer: 'RISK',
        },
        {
          id: 'bottleneck',
          title: 'Bottleneck',
          value: avgExamDelayDays,
          unit: '일',
          delta: { value: stage2Queue, unit: '건', direction: stage2Queue > 0 ? 'up' : 'flat' },
          severity: avgExamDelayDays > settings.thresholds.longWaitDays ? 'critical' : avgExamDelayDays > settings.thresholds.longWaitDays - 1 ? 'warn' : 'normal',
          bindLayer: 'BOTTLENECK',
        },
        {
          id: 'gap',
          title: 'Gap',
          value: conversionGap,
          unit: '%p',
          delta: { value: processingGapDays, unit: '일', direction: processingGapDays > 0 ? 'up' : 'flat' },
          severity: conversionGap > 18 ? 'critical' : conversionGap > 10 ? 'warn' : 'normal',
          bindLayer: 'GAP',
        },
        {
          id: 'load',
          title: 'Load',
          value: highRiskCases,
          unit: '건',
          delta: { value: alertSummary.surgeRegions, unit: '곳', direction: alertSummary.surgeRegions > 0 ? 'up' : 'flat' },
          severity: alertSummary.surgeRegions > 3 ? 'warn' : 'normal',
          bindLayer: 'LOAD',
        },
      ];
    },
    [alertSummary, rankingRowsSource, settings.thresholds.longWaitDays],
  );
  const compactHeaderKpis = useMemo(() => {
    const bottleneck = opsKpiBlocks.find((block) => block.id === 'bottleneck');
    const gap = opsKpiBlocks.find((block) => block.id === 'gap');
    return [
      {
        id: 'sla-risk',
        label: `${getCopyTerm('sla').user} 위험 구역`,
        helpKey: 'slaRisk' as const,
        value: `${alertSummary.slaAtRiskRegions.toLocaleString()}곳`,
        tone: alertSummary.slaAtRiskRegions > 3 ? 'text-red-700 bg-red-50 border-red-100' : 'text-emerald-700 bg-emerald-50 border-emerald-100',
      },
      {
        id: 'bottleneck',
        label: getCopyTerm('examDelay').user,
        helpKey: 'examDelay' as const,
        value: `${Math.round(bottleneck?.value ?? 0)}일`,
        tone: (bottleneck?.severity ?? 'normal') === 'critical' ? 'text-red-700 bg-red-50 border-red-100' : 'text-amber-700 bg-amber-50 border-amber-100',
      },
      {
        id: 'gap',
        label: getCopyTerm('conversionGap').user,
        helpKey: 'conversionGap' as const,
        value: `${(gap?.value ?? 0).toFixed(1)}%p`,
        tone: (gap?.severity ?? 'normal') === 'critical' ? 'text-red-700 bg-red-50 border-red-100' : 'text-indigo-700 bg-indigo-50 border-indigo-100',
      },
    ];
  }, [alertSummary.slaAtRiskRegions, opsKpiBlocks]);

  const selectedDistrictDelta = useMemo(() => {
    if (!selectedDistrictData) return null;
    return Number((selectedDistrictData.kpi[selectedKpiKey] - regionalValue).toFixed(1));
  }, [regionalValue, selectedDistrictData, selectedKpiKey]);

  const districtRowMapByCode = useMemo(
    () => {
      const map = new Map<string, DistrictOpsData>();
      rankingRowsSource.forEach((row) => {
        const raw = String(row.regionId);
        const parsed = normalizeRegionCode(parseRegionIdCode(raw));
        map.set(raw, row);
        if (parsed) map.set(parsed, row);
      });
      return map;
    },
    [rankingRowsSource],
  );

  const geoTooltipExtraLines = useCallback(
    ({ code, name }: { level: 'ctprvn' | 'sig' | 'emd'; code: string; name: string; value: number }) => {
      const normalizedCode =
        normalizeRegionCode(code) ||
        normalizeRegionCode(parseRegionIdCode(code));
      const row = (normalizedCode ? districtRowMapByCode.get(normalizedCode) : undefined) ?? districtRowMapByCode.get(String(code));
      if (!row) return [] as string[];
      const delta7 = Number(sv(`${region.id}-${name}-${selectedKpiKey}-delta7-${rangePreset}-${analyticsPeriod}`, -12, 12).toFixed(1));
      const deltaUnit =
        selectedKpiDef.unit === '점'
          ? '점'
          : selectedKpiDef.unit === '건'
            ? '건'
            : selectedKpiDef.unit === '일'
              ? '일'
              : '%p';
      return [
        `규모: ${row.volume.toLocaleString()}건`,
        `최근 7일 변화: ${delta7 > 0 ? '+' : ''}${selectedKpiDef.unit === '건' || selectedKpiDef.unit === '일' ? Math.round(delta7) : delta7}${deltaUnit}`,
      ];
    },
    [analyticsPeriod, districtRowMapByCode, rangePreset, region.id, selectedKpiDef.unit, selectedKpiKey],
  );

  const handleGoBack = useCallback(() => {
    updateSelectedDistrict(null);
    updateSelectedRegionId(null);
    resetDrill();
    setStageImpactOpen(false);
  }, [resetDrill, updateSelectedDistrict, updateSelectedRegionId]);

  const handleDrillBack = useCallback(() => {
    if (!drillCanGoBack) return;
    if (drillStack.length <= 2) {
      updateSelectedDistrict(null);
      updateSelectedRegionId(null);
    }
    backDrill();
    setStageImpactOpen(false);
  }, [backDrill, drillCanGoBack, drillStack.length, updateSelectedDistrict, updateSelectedRegionId]);

  const handleRegionSelect = useCallback(
    ({
      level,
      code,
      name,
      regionId,
    }: {
      level: string;
      code: string;
      name: string;
      regionId?: string;
    }) => {
      if (level === 'ctprvn') {
        handleGoBack();
        return;
      }
      const normalizedCode =
        normalizeRegionCode(code) ||
        normalizeRegionCode(parseRegionIdCode(regionId));
      const isSigunguPayload = level === 'sig' || (level === 'emd' && normalizedCode.length === 5);
      const normalizedName = normalizeRegionLabel(name);
      if (isSigunguPayload && normalizedCode) {
        const sigungu = sigunguByCode.get(normalizedCode) ?? normalizedDistrictMap.get(normalizedName) ?? name;
        const nextRegionId =
          regionId ??
          makeRegionId({
            level: 'SIGUNGU',
            code: normalizedCode,
            name: sigungu,
          });
        updateSelectedRegionId(nextRegionId);
        updateSelectedDistrict(sigungu);
        startTransition(() => {
          pushDrill({
            level: 'SIGUNGU',
            id: normalizedCode,
            label: sigungu,
            filters: {
              kpi: selectedKpiKey,
              range: rangePreset,
              view: visualizationMode,
            },
          });
        });
        return;
      }
      if (level === 'emd') {
        if (!normalizedCode) return;
        const emdLabel = emdByCode.get(normalizedCode)?.name ?? name;
        const nextRegionId =
          regionId ??
          makeRegionId({
            level: 'EUPMYEONDONG',
            code: normalizedCode,
            name: emdLabel,
          });
        updateSelectedRegionId(nextRegionId);
        startTransition(() => {
          pushDrill({
            level: 'EUPMYEONDONG',
            id: normalizedCode,
            label: emdLabel,
            filters: {
              kpi: selectedKpiKey,
              range: rangePreset,
              view: visualizationMode,
            },
          });
        });
      }
    },
    [
      emdByCode,
      handleGoBack,
      normalizedDistrictMap,
      pushDrill,
      rangePreset,
      selectedKpiKey,
      sigunguByCode,
      updateSelectedDistrict,
      updateSelectedRegionId,
      visualizationMode,
    ],
  );

  const handleSubRegionsChange = useCallback((regions: MapChildRegion[]) => {
    const expectedLevel = getChildAdminLevel(currentScopeNode.level);
    const normalizedRows = regions
      .map((item) => {
        const code =
          normalizeRegionCode(item.code) ||
          normalizeRegionCode(parseRegionIdCode(item.regionId));
        const name = String(item.name ?? '').trim();
        if (!code || !name) return null;
        return {
          ...item,
          code,
          name,
          regionKey: {
            ...item.regionKey,
            level: item.regionKey.level,
            code,
            name,
          },
          regionId:
            item.regionId ||
            makeRegionId({
              level: item.regionKey.level,
              code,
              name,
            }),
        } satisfies MapChildRegion;
      })
      .filter((item): item is MapChildRegion => Boolean(item))
      .filter((item, index, arr) => arr.findIndex((other) => other.code === item.code) === index);
    const normalized = normalizedRows
      .filter((item) => item.regionKey.level === expectedLevel)
      .sort((a, b) => a.code.localeCompare(b.code, 'ko-KR'));

    if (!normalized.length) return;

    const nextSignature = `${expectedLevel}|${normalized
      .map((item) => `${item.code}:${item.name}`)
      .join('|')}`;
    const prevSignature = subRegionSignatureByScopeRef.current[scopePathKey];
    if (prevSignature === nextSignature) return;
    subRegionSignatureByScopeRef.current[scopePathKey] = nextSignature;

    setMapSubRegionsByScope((prev) => {
      const current = prev[scopePathKey] ?? [];
      if (
        current.length === normalized.length &&
        current.every(
          (item, idx) =>
            item.code === normalized[idx]?.code &&
            item.name === normalized[idx]?.name &&
            item.regionKey.level === normalized[idx]?.regionKey.level,
        )
      ) {
        return prev;
      }
      return {
        ...prev,
        [scopePathKey]: normalized,
      };
    });
  }, [currentScopeNode.level, scopePathKey]);

  const handleTop5Click = useCallback(
    (areaCode: string, areaName: string, areaRegionId?: string) => {
      const normalizedCode =
        normalizeRegionCode(areaCode) ||
        normalizeRegionCode(parseRegionIdCode(areaRegionId));
      if (!normalizedCode) return;
      const targetLevel =
        areaRegionId?.startsWith('EUPMYEONDONG:')
          ? 'EUPMYEONDONG'
          : areaRegionId?.startsWith('SIGUNGU:')
            ? 'SIGUNGU'
            : drillCurrent.level === 'REGION'
              ? 'SIGUNGU'
              : 'EUPMYEONDONG';
      const nextRegionId = makeRegionId({
        level: targetLevel,
        code: normalizedCode,
        name: areaName,
      });
      updateSelectedRegionId(nextRegionId);
      if (nextRegionId === selectedRegionId) return;

      if (targetLevel === 'SIGUNGU') {
        updateSelectedDistrict(areaName);
        startTransition(() => {
          pushDrill({
            level: 'SIGUNGU',
            id: normalizedCode,
            label: areaName,
            filters: {
              kpi: selectedKpiKey,
              range: rangePreset,
              view: visualizationMode,
            },
          });
        });
        return;
      }

      startTransition(() => {
        pushDrill(
          {
            level: 'EUPMYEONDONG',
            id: normalizedCode,
            label: areaName,
            filters: {
              kpi: selectedKpiKey,
              range: rangePreset,
              view: visualizationMode,
            },
          },
          drillCurrent.level === 'EUPMYEONDONG' ? 'replace' : 'push',
        );
      });
    },
    [
      drillCurrent.level,
      pushDrill,
      rangePreset,
      selectedRegionId,
      selectedKpiKey,
      updateSelectedDistrict,
      updateSelectedRegionId,
      visualizationMode,
    ],
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
      if (selectedKpiDef.unit === '일') {
        return Number(
          Math.max(min, Math.min(max, value + trendRateBias * 2)).toFixed(1),
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
    if (selectedKpiKey === 'regionalAdTransitionHotspot') {
      return [
        safeOpsText('고위험 전환 신호가 큰 구역에 Stage3 경로 담당 인력 선배치가 필요함'),
        safeOpsText('상위 구역 재접촉 슬롯 확장과 집중 관리 캠페인이 필요함'),
      ];
    }
    if (selectedKpiKey === 'regionalDxDelayHotspot') {
      return [
        safeOpsText('평균 대기일이 긴 구역에 검사 슬롯 확보 요청이 필요함'),
        safeOpsText('미방문 누적 구간에 병원 연계 지원 요청이 필요함'),
      ];
    }
    if (selectedKpiKey === 'regionalScreenToDxRate') {
      return [
        safeOpsText('전환율이 낮은 구역에 예약 동선 개선과 현장 배치 보강이 필요함'),
        safeOpsText('지연·재접촉 동시 상승 구역에 우선 개입 생성이 필요함'),
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
    if (selectedKpiKey === 'regionalAdTransitionHotspot') return focusData.adTransitionDrivers.slice(0, 3);
    if (selectedKpiKey === 'regionalDxDelayHotspot') return focusData.dxDelayDrivers.slice(0, 3);
    if (selectedKpiKey === 'regionalScreenToDxRate') return focusData.screenToDxDrivers.slice(0, 3);
    return focusData.governanceMissingTypes.slice(0, 3);
  }, [focusData, selectedKpiKey]);
  const formatCauseMetricValue = useCallback(
    (item: NamedValue): string => {
      if (selectedKpiKey === 'regionalRecontact') return `${item.value.toFixed(1)}%`;
      if (selectedKpiKey === 'regionalAdTransitionHotspot') {
        if (item.name.includes('편차')) return `${item.value.toFixed(1)}점`;
        return `${Math.round(item.value).toLocaleString()}건`;
      }
      if (selectedKpiKey === 'regionalDxDelayHotspot') {
        if (item.name.includes('비율')) return `${item.value.toFixed(1)}%`;
        if (item.name.includes('대기일')) return `${Math.round(item.value)}일`;
        return `${Math.round(item.value).toLocaleString()}건`;
      }
      if (selectedKpiKey === 'regionalScreenToDxRate') {
        if (item.name.includes('격차')) return `${item.value.toFixed(1)}%p`;
        return `${item.value.toFixed(1)}점`;
      }
      return `${Math.round(item.value).toLocaleString()}건`;
    },
    [selectedKpiKey],
  );

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
    if (selectedKpiKey === 'regionalAdTransitionHotspot') {
      return {
        stage: '고위험 밀집',
        valueLabel: `${Math.round(focusData.adTransitionSignal.highRiskCount)}명 · ${Math.round(focusData.adTransitionSignal.densityScore)}점`,
        basis: safeOpsText('고위험 전환 신호 밀집도가 높은 구역'),
      };
    }
    if (selectedKpiKey === 'regionalDxDelayHotspot') {
      return {
        stage: '평균 대기일',
        valueLabel: `${Math.round(focusData.differentialDelay.avgWaitDays)}일 · ${(focusData.differentialDelay.delayedRatio * 100).toFixed(1)}%`,
        basis: safeOpsText('감별검사 지연 비율과 대기일이 함께 높은 구역'),
      };
    }
    if (selectedKpiKey === 'regionalScreenToDxRate') {
      return {
        stage: '전환율 격차',
        valueLabel: `${(focusData.stageConversionRate.conversionRate * 100).toFixed(1)}%`,
        basis: safeOpsText('선별 이후 정밀연계 완료율 격차가 큰 구역'),
      };
    }
    const topRisk = focusData.governanceMissingTypes[0];
    return {
      stage: topRisk?.name ?? '운영 리스크',
      valueLabel: topRisk ? `${Math.round(topRisk.value)}건` : '—',
      basis: safeOpsText('센터 리스크 기여도가 가장 높은 항목'),
    };
  }, [
    focusData.adTransitionSignal.densityScore,
    focusData.adTransitionSignal.highRiskCount,
    focusData.differentialDelay.avgWaitDays,
    focusData.differentialDelay.delayedRatio,
    focusData.governanceMissingTypes,
    focusData.queueCauseTop,
    focusData.queueTypeBacklog,
    focusData.recontactReasons,
    focusData.slaStageContribution,
    focusData.stageConversionRate.conversionRate,
    selectedKpiKey,
  ]);

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
    if (selectedKpiKey === 'regionalAdTransitionHotspot') {
      return safeOpsText('고위험 전환 신호가 집중된 구역이 늘어 선제 개입 우선순위 상향이 필요함');
    }
    if (selectedKpiKey === 'regionalDxDelayHotspot') {
      return safeOpsText('검사 대기일이 증가해 연계 슬롯 확보와 재방문 운영 강화가 필요함');
    }
    if (selectedKpiKey === 'regionalScreenToDxRate') {
      return safeOpsText('선별 이후 연계 전환율 격차가 커져 저전환 구역 집중 개입이 필요함');
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
        `${region.label}(광역) ${userKpiLabel} ${formatKpiValue(selectedKpiKey, regionalValue)} (지도 평균 ${formatKpiValue(
          selectedKpiKey,
          mapAvg,
        )}, Δ ${formatDeltaValue(selectedKpiKey, Number((regionalValue - mapAvg).toFixed(1)))})`,
      ),
    [mapAvg, region.label, regionalValue, selectedKpiKey, userKpiLabel],
  );

  const summaryLineRisk = useMemo(
    () =>
      safeOpsText(
        `기한 초과 대기 기준 ${settings.thresholds.longWaitDays}일 · 위험 구역 모니터링`,
      ),
    [settings.thresholds.longWaitDays],
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
    if (selectedKpiKey === 'regionalAdTransitionHotspot') {
      return safeOpsText(`이번 주 권장 개입: ${topTwoDistrictLabel}에 고위험군 집중 관리 슬롯 우선 배치`);
    }
    if (selectedKpiKey === 'regionalDxDelayHotspot') {
      return safeOpsText(`이번 주 권장 개입: ${topTwoDistrictLabel}의 검사 연계 슬롯과 병원 협력 요청 우선`);
    }
    if (selectedKpiKey === 'regionalScreenToDxRate') {
      return safeOpsText(`이번 주 권장 개입: ${topTwoDistrictLabel} 저전환 구역의 예약 동선과 현장 배치 개선`);
    }
    return safeOpsText(`이번 주 권장 개입: ${topTwoDistrictLabel}에 초기 처리 인력 우선 배치`);
  }, [selectedKpiKey, topTwoDistrictLabel]);

  const baseTodoItems = useMemo<OpsTodoItem[]>(
    () =>
      buildOpsTodos({
        regionKey: region.id,
        regionLabel: region.label,
        selectedRegionSgg: selectedDistrictName,
        selectedRange: analyticsPeriod,
        selectedKpiKey,
        mapLayer: activeMapLayer,
        alertSummary,
        avgExamDelayDays: focusData.differentialDelay.avgWaitDays,
        overdueFollowups: alertSummary.overdueFollowups,
        longWaitDays: settings.thresholds.longWaitDays,
      }),
    [
      activeMapLayer,
      alertSummary,
      analyticsPeriod,
      focusData.differentialDelay.avgWaitDays,
      region.id,
      region.label,
      selectedDistrictName,
      selectedKpiKey,
      settings.thresholds.longWaitDays,
    ],
  );

  const todoItems = useMemo(
    () =>
      baseTodoItems.map((item) => {
        const state = todoStateById[item.id];
        return {
          ...item,
          status: state?.status ?? item.status,
          dismissReason: state?.dismissReason ?? item.dismissReason,
        };
      }),
    [baseTodoItems, todoStateById],
  );

  const todoActiveCount = useMemo(
    () => todoItems.filter((item) => item.status === 'open' || item.status === 'acknowledged').length,
    [todoItems],
  );

  const setTodoStatus = useCallback((id: string, status: TodoStatus, dismissReason?: string) => {
    setTodoStateById((prev) => ({
      ...prev,
      [id]: {
        status,
        dismissReason: dismissReason ?? prev[id]?.dismissReason,
      },
    }));
  }, []);

  const handleTodoAnalyze = useCallback(
    (item: OpsTodoItem) => {
      const kpi = item.relatedQueryState.kpiKey as RegionalKpiKey;
      updateSelectedKpiKey(kpi);
      if (item.relatedQueryState.areaKey) {
        updateSelectedDistrict(item.relatedQueryState.areaKey);
      }
      updateSelectedRange(item.relatedQueryState.period as AnalyticsPeriod);
      setTodoStatus(item.id, 'acknowledged');
      onNavigateModule?.('cause');
    },
    [onNavigateModule, setTodoStatus, updateSelectedDistrict, updateSelectedKpiKey, updateSelectedRange],
  );

  const handleTodoCreate = useCallback(
    (item: OpsTodoItem) => {
      const kpi = item.relatedQueryState.kpiKey as RegionalKpiKey;
      onCreateIntervention?.({
        kpi,
        sgg: item.relatedQueryState.areaKey ?? selectedDistrictName ?? null,
        range: item.relatedQueryState.period as AnalyticsPeriod,
        source: 'overview',
        primaryDriverStage: uiEmphasis.primaryDriverStage,
      });
      setTodoStatus(item.id, 'converted_to_intervention');
    },
    [onCreateIntervention, selectedDistrictName, setTodoStatus, uiEmphasis.primaryDriverStage],
  );

  const handleTodoDismiss = useCallback(
    (item: OpsTodoItem) => {
      const reason = window.prompt('To-Do 제외 사유를 입력하세요.');
      if (reason == null) return;
      const normalized = reason.trim();
      setTodoStatus(item.id, 'dismissed', normalized || '사유 미입력');
    },
    [setTodoStatus],
  );

  const diagnosisMetrics = useMemo(() => {
    const queueBacklog = focusData.queueTypeBacklog.reduce((sum, item) => sum + item.value, 0);
    const totalRecontactFailures = focusData.recontactReasons.reduce((sum, item) => sum + item.value, 0);
    const effectiveThroughput = Math.max(0, Math.round(focusData.volume - queueBacklog));
    return [
      {
        label: 'Stage 적체 구조',
        value: `${primaryDriver.stage} · ${primaryDriver.valueLabel}`,
      },
      {
        label: '검사 지연 분포',
        value: `평균 ${Math.round(focusData.differentialDelay.avgWaitDays)}일 · 지연 ${(focusData.differentialDelay.delayedRatio * 100).toFixed(1)}%`,
      },
      {
        label: '재접촉 실패 규모',
        value: `${Math.round(totalRecontactFailures).toLocaleString()}건`,
      },
      {
        label: '인력 대비 처리량',
        value: `${effectiveThroughput.toLocaleString()}건`,
      },
    ];
  }, [
    focusData.differentialDelay.avgWaitDays,
    focusData.differentialDelay.delayedRatio,
    focusData.queueTypeBacklog,
    focusData.recontactReasons,
    focusData.volume,
    primaryDriver.stage,
    primaryDriver.valueLabel,
  ]);

  const actionEngineItems = useMemo(() => {
    const scopeLabel = selectedDistrictData?.name ?? `${region.label} 관할`;
    const concentration = top5Concentration ?? 20;
    const base = Math.max(0.8, Math.min(5.8, concentration / 8));

    return [
      {
        id: 'STAFFING' as const,
        title: '인력 재배치 제안 생성',
        detail: safeOpsText(`${scopeLabel} 접촉/재접촉 구간에 담당 인력 재배치`),
        expected: `SLA 개선 추정 +${(base * 1.05).toFixed(1)}%p`,
        stage: '접촉',
      },
      {
        id: 'EXAM_SLOT' as const,
        title: '검사 슬롯 증설 요청',
        detail: safeOpsText(`${scopeLabel} 장기대기 구간 검사 연계 슬롯 확대`),
        expected: `SLA 개선 추정 +${(base * 0.85).toFixed(1)}%p`,
        stage: '2차',
      },
      {
        id: 'FOLLOWUP_AUTOMATION' as const,
        title: '재접촉 자동화 확대',
        detail: safeOpsText(`${scopeLabel} 미응답/시간대 불일치 구간 자동화 강화`),
        expected: `SLA 개선 추정 +${(base * 0.72).toFixed(1)}%p`,
        stage: '재접촉',
      },
      {
        id: 'HOSPITAL_LINK' as const,
        title: '병원 연계 요청',
        detail: safeOpsText(`${scopeLabel} 검사 지연 상위 구간 병원 연계 우선 요청`),
        expected: `SLA 개선 추정 +${(base * 0.66).toFixed(1)}%p`,
        stage: '3차',
      },
    ];
  }, [region.label, selectedDistrictData?.name, top5Concentration]);

  const selectedActionEngineItem = useMemo(
    () => actionEngineItems.find((item) => item.id === selectedActionId) ?? actionEngineItems[0] ?? null,
    [actionEngineItems, selectedActionId],
  );

  useEffect(() => {
    if (!selectedActionEngineItem) return;
    if (selectedActionEngineItem.id === selectedActionId) return;
    setSelectedActionId(selectedActionEngineItem.id);
  }, [selectedActionEngineItem, selectedActionId]);

  const selectedPrimaryCause = useMemo(() => {
    if (!selectedDistrictData) return null;
    if (selectedKpiKey === 'regionalSla') return selectedDistrictData.queueTypeBacklog[0]?.name ?? '신규 유입';
    if (selectedKpiKey === 'regionalQueueRisk') return selectedDistrictData.queueCauseTop[0]?.name ?? '연락 실패';
    if (selectedKpiKey === 'regionalRecontact') return selectedDistrictData.slaStageContribution[0]?.name ?? 'SLA 임박';
    if (selectedKpiKey === 'regionalDataReadiness') return selectedDistrictData.recontactReasons[0]?.name ?? '미응답';
    if (selectedKpiKey === 'regionalAdTransitionHotspot') return selectedDistrictData.adTransitionDrivers[0]?.name ?? '고위험 밀집';
    if (selectedKpiKey === 'regionalDxDelayHotspot') return selectedDistrictData.dxDelayDrivers[0]?.name ?? '평균 대기일';
    if (selectedKpiKey === 'regionalScreenToDxRate') return selectedDistrictData.screenToDxDrivers[0]?.name ?? '전환율 역격차';
    return selectedDistrictData.governanceMissingTypes[0]?.name ?? '책임자 미기록';
  }, [selectedDistrictData, selectedKpiKey]);

  const mapOverlayMessage = useMemo(() => {
    if (selectedDistrictData && selectedDistrictDelta != null) {
      return safeOpsText(
        `${selectedDistrictData.name}: 평균 대비 Δ ${formatDeltaValue(selectedKpiKey, selectedDistrictDelta)} · 원인 1순위: ${selectedPrimaryCause ?? '—'}`,
      );
    }
    return safeOpsText('지도에서 문제 구역을 선택해 원인과 조치 대상을 확인');
  }, [selectedDistrictData, selectedDistrictDelta, selectedKpiKey, selectedPrimaryCause]);

  const interventionScenarios = useMemo(() => {
    const targetScope = selectedDistrictData ? selectedDistrictData.name : `${region.label} 전체`;
    const backupTarget = top5[0]?.name ?? targetScope;
    const evidence = causeTopNPreview
      .slice(0, 2)
      .map((item) => {
        if (selectedKpiDef.unit === '%') return `${item.name} ${item.value.toFixed(1)}%`;
        if (selectedKpiDef.unit === '점') return `${item.name} ${Math.round(item.value)}점`;
        if (selectedKpiDef.unit === '일') return `${item.name} ${Math.round(item.value)}일`;
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
    if (selectedKpiKey === 'regionalRecontact') {
      const rows = focusData.recontactReasons
        .slice()
        .sort((a, b) => b.value - a.value)
        .slice(0, showExtendedTopN ? 8 : 5);
      const total = rows.reduce((sum, row) => sum + row.value, 0);
      const useDonutForReasons = rows.length <= 3;

      return (
        <>
          {useDonutForReasons ? (
            <DonutBreakdown
              title="실패 사유 분포"
              subtitle="항목 수가 3개 이하일 때 도넛으로 표시"
              scopeLabel={currentDrillLabel}
              data={rows}
              unit="건"
              colors={activeChartPalette.slice(-3)}
              onSliceClick={(item) => setSelectedCauseName(item.name)}
            />
          ) : (
            <TopNHorizontalBar
              title="실패 사유 TopN"
              subtitle="미응답/연락처 오류/시간대 문제 분포"
              scopeLabel={currentDrillLabel}
              data={rows}
              unit="건"
              color={selectedKpiDef.color}
              maxItems={showExtendedTopN ? 8 : 5}
              onItemClick={(item) => setSelectedCauseName(item.name)}
            />
          )}
          <ChartCard title="실패 사유 데이터" subtitle="사유별 건수/비중">
            <div className="overflow-x-auto">
              <table className="w-full text-[11px]">
                <thead>
                  <tr className="text-left text-gray-500 border-b border-gray-100">
                    <th className="py-1 pr-2">사유</th>
                    <th className="py-1 pr-2 text-right">건수</th>
                    <th className="py-1 text-right">비중</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.name} className="border-b border-gray-50">
                      <td className="py-1 pr-2 text-gray-700">{row.name}</td>
                      <td className="py-1 pr-2 text-right font-medium text-gray-900">{Math.round(row.value).toLocaleString()}건</td>
                      <td className="py-1 text-right text-gray-700">
                        {total > 0 ? `${((row.value / total) * 100).toFixed(1)}%` : '0.0%'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </ChartCard>
        </>
      );
    }

    if (selectedKpiKey === 'regionalAdTransitionHotspot') {
      const rows = rankingRowsSource
        .map((row) => ({
          name: row.name,
          highRiskCount: row.adTransitionSignal.highRiskCount,
          transition30d: row.adTransitionSignal.transition30d,
          deltaFromAvg: row.adTransitionSignal.deltaFromAvg,
        }))
        .sort((a, b) => b.highRiskCount - a.highRiskCount)
        .slice(0, showExtendedTopN ? 8 : 5);

      return (
        <>
          <TopNHorizontalBar
            title="고위험 밀집 TopN"
            subtitle="고위험 인원 기준 우선순위"
            scopeLabel={currentDrillLabel}
            data={rows.map((row) => ({ name: row.name, value: row.highRiskCount }))}
            unit="건"
            color="#dc2626"
            maxItems={showExtendedTopN ? 8 : 5}
            onItemClick={(item) => setSelectedCauseName(item.name)}
          />
          <ChartCard title="전환 신호 데이터" subtitle="지역별 highRiskCount / transition30d / Δ">
            <div className="overflow-x-auto">
              <table className="w-full text-[11px]">
                <thead>
                  <tr className="text-left text-gray-500 border-b border-gray-100">
                    <th className="py-1 pr-2">지역</th>
                    <th className="py-1 pr-2 text-right">고위험</th>
                    <th className="py-1 pr-2 text-right">30일 신호</th>
                    <th className="py-1 text-right">Δ</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.name} className="border-b border-gray-50">
                      <td className="py-1 pr-2 text-gray-700">{row.name}</td>
                      <td className="py-1 pr-2 text-right font-medium text-gray-900">{row.highRiskCount.toLocaleString()}명</td>
                      <td className="py-1 pr-2 text-right text-gray-700">{row.transition30d.toLocaleString()}건</td>
                      <td className={`py-1 text-right font-medium ${row.deltaFromAvg >= 0 ? 'text-red-600' : 'text-blue-600'}`}>
                        {row.deltaFromAvg > 0 ? '+' : ''}
                        {row.deltaFromAvg.toFixed(1)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </ChartCard>
        </>
      );
    }

    if (selectedKpiKey === 'regionalDxDelayHotspot') {
      const rows = rankingRowsSource
        .map((row) => ({
          name: row.name,
          avgWaitDays: row.differentialDelay.avgWaitDays,
          delayedRatio: row.differentialDelay.delayedRatio,
          backlogCount: row.differentialDelay.backlogCount,
          deltaFromAvg: row.differentialDelay.deltaFromAvg,
        }))
        .sort((a, b) => b.avgWaitDays - a.avgWaitDays)
        .slice(0, showExtendedTopN ? 8 : 5);

      return (
        <>
          <TopNHorizontalBar
            title="평균 대기일 TopN"
            subtitle="감별검사 대기일 기준 병목 구역"
            scopeLabel={currentDrillLabel}
            data={rows.map((row) => ({ name: row.name, value: row.avgWaitDays }))}
            unit="일"
            color="#f97316"
            maxItems={showExtendedTopN ? 8 : 5}
            onItemClick={(item) => setSelectedCauseName(item.name)}
          />
          <ChartCard title="지연 데이터" subtitle="avgWaitDays / delayedRatio / backlogCount / Δ">
            <div className="overflow-x-auto">
              <table className="w-full text-[11px]">
                <thead>
                  <tr className="text-left text-gray-500 border-b border-gray-100">
                    <th className="py-1 pr-2">지역</th>
                    <th className="py-1 pr-2 text-right">평균 대기일</th>
                    <th className="py-1 pr-2 text-right">지연 비율</th>
                    <th className="py-1 pr-2 text-right">대기 인원</th>
                    <th className="py-1 text-right">Δ</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.name} className="border-b border-gray-50">
                      <td className="py-1 pr-2 text-gray-700">{row.name}</td>
                      <td className="py-1 pr-2 text-right font-medium text-gray-900">{Math.round(row.avgWaitDays)}일</td>
                      <td className="py-1 pr-2 text-right text-gray-700">{(row.delayedRatio * 100).toFixed(1)}%</td>
                      <td className="py-1 pr-2 text-right text-gray-700">{row.backlogCount.toLocaleString()}건</td>
                      <td className={`py-1 text-right font-medium ${row.deltaFromAvg >= 0 ? 'text-red-600' : 'text-blue-600'}`}>
                        {row.deltaFromAvg > 0 ? '+' : ''}
                        {row.deltaFromAvg.toFixed(1)}일
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </ChartCard>
        </>
      );
    }

    if (selectedKpiKey === 'regionalScreenToDxRate') {
      const rows = rankingRowsSource
        .map((row) => ({
          name: row.name,
          conversionRate: row.stageConversionRate.conversionRate,
          deltaFromRegional: row.stageConversionRate.deltaFromRegional,
          support: row.screenToDxDrivers.reduce((sum, item) => sum + item.value, 0) / Math.max(1, row.screenToDxDrivers.length),
        }))
        .sort((a, b) => a.conversionRate - b.conversionRate)
        .slice(0, showExtendedTopN ? 8 : 5);

      return (
        <>
          <DeltaScatterOrBar
            title="전환율 비교 · 평균 대비 Δ"
            subtitle="선별→정밀연계 전환율 격차"
            scopeLabel={currentDrillLabel}
            data={rows.map((row) => ({
              name: row.name,
              value: Number((row.conversionRate * 100).toFixed(1)),
              delta: row.deltaFromRegional,
            }))}
            valueUnit="%"
            deltaUnit="%p"
            barColor="#0f766e"
            lineColor="#dc2626"
          />
          <ChartCard title="전환율 데이터" subtitle="conversionRate / deltaFromRegional / support">
            <div className="overflow-x-auto">
              <table className="w-full text-[11px]">
                <thead>
                  <tr className="text-left text-gray-500 border-b border-gray-100">
                    <th className="py-1 pr-2">지역</th>
                    <th className="py-1 pr-2 text-right">전환율</th>
                    <th className="py-1 pr-2 text-right">Δ</th>
                    <th className="py-1 text-right">보조지표</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.name} className="border-b border-gray-50">
                      <td className="py-1 pr-2 text-gray-700">{row.name}</td>
                      <td className="py-1 pr-2 text-right font-medium text-gray-900">{(row.conversionRate * 100).toFixed(1)}%</td>
                      <td className={`py-1 pr-2 text-right font-medium ${row.deltaFromRegional >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                        {row.deltaFromRegional > 0 ? '+' : ''}
                        {row.deltaFromRegional.toFixed(1)}%p
                      </td>
                      <td className="py-1 text-right text-gray-700">{row.support.toFixed(1)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </ChartCard>
        </>
      );
    }

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
              colors={activeChartPalette.slice(-3)}
              onSliceClick={(item) => setSelectedCauseName(item.name)}
            />
          ) : (
            <TopNHorizontalBar
              title="실패 사유 TopN"
              subtitle="미응답/번호 오류/시간대 문제 분포"
              scopeLabel={currentDrillLabel}
              data={focusData.recontactReasons}
              unit="건"
              color={selectedKpiDef.color}
              onItemClick={(item) => setSelectedCauseName(item.name)}
            />
          )}
          <KpiTrendLine
            title="최근 7일 재접촉 필요율"
            subtitle="단기 추세 기준으로 슬롯 재배치 확인"
            scopeLabel={currentDrillLabel}
            data={focusData.recontactTrend.map((row) => ({ label: row.day, regional: row.value }))}
            unit="%"
            color={selectedKpiDef.color}
          />
          <StageContribution
            title="권장 시간대(연락 성공률)"
            subtitle="시간대별 성공률 기준"
            scopeLabel={currentDrillLabel}
            data={focusData.recontactSlots.map((slot) => ({ name: slot.slot, value: slot.successRate }))}
            unit="%"
            colorScale={activeChartPalette.slice(-6)}
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

    if (selectedKpiKey === 'regionalAdTransitionHotspot') {
      const rows = rankingRowsSource
        .map((row) => ({
          name: row.name,
          value: row.adTransitionSignal.densityScore,
          delta: row.adTransitionSignal.deltaFromAvg,
          highRiskCount: row.adTransitionSignal.highRiskCount,
        }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 8);

      return (
        <>
          <DeltaScatterOrBar
            title="집중 구역 위험도 · 평균 대비 Δ"
            subtitle="AD 전환 위험 집중도 비교"
            scopeLabel={currentDrillLabel}
            data={rows.map((row) => ({ name: row.name, value: row.value, delta: row.delta }))}
            valueUnit="점"
            deltaUnit="점"
            barColor="#dc2626"
            lineColor="#f97316"
          />
          <TopNHorizontalBar
            title="고위험 인원 TopN"
            subtitle="highRiskCount 기준 우선 개입 대상"
            scopeLabel={currentDrillLabel}
            data={rows.map((row) => ({ name: row.name, value: row.highRiskCount }))}
            unit="건"
            color="#dc2626"
            onItemClick={(item) => setSelectedCauseName(item.name)}
          />
        </>
      );
    }

    if (selectedKpiKey === 'regionalDxDelayHotspot') {
      const rows = rankingRowsSource
        .map((row) => ({
          name: row.name,
          value: row.differentialDelay.avgWaitDays,
          delta: row.differentialDelay.deltaFromAvg,
          delayedRatio: row.differentialDelay.delayedRatio,
          backlogCount: row.differentialDelay.backlogCount,
        }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 8);

      return (
        <>
          <DeltaScatterOrBar
            title="평균 대기일 · 평균 대비 Δ"
            subtitle="지연 병목 구역 비교"
            scopeLabel={currentDrillLabel}
            data={rows.map((row) => ({ name: row.name, value: row.value, delta: row.delta }))}
            valueUnit="일"
            deltaUnit="일"
            barColor="#f97316"
            lineColor="#dc2626"
          />
          <TopNHorizontalBar
            title="지연 비율 TopN"
            subtitle="delayedRatio 기준 우선 조치 대상"
            scopeLabel={currentDrillLabel}
            data={rows.map((row) => ({ name: row.name, value: Number((row.delayedRatio * 100).toFixed(1)) }))}
            unit="%"
            color="#ea580c"
            onItemClick={(item) => setSelectedCauseName(item.name)}
          />
          <StageContribution
            title="검사 대기 인원 분포"
            subtitle="backlogCount 기준"
            scopeLabel={currentDrillLabel}
            data={rows.map((row) => ({ name: row.name, value: row.backlogCount })).slice(0, 6)}
            unit="건"
            colorScale={['#fb923c', '#f97316', '#ea580c', '#c2410c', '#f59e0b', '#fdba74']}
          />
        </>
      );
    }

    if (selectedKpiKey === 'regionalScreenToDxRate') {
      const rows = rankingRowsSource
        .map((row) => ({
          name: row.name,
          conversionRate: row.stageConversionRate.conversionRate,
          delta: row.stageConversionRate.deltaFromRegional,
        }))
        .sort((a, b) => a.conversionRate - b.conversionRate)
        .slice(0, 8);

      return (
        <>
          <DeltaScatterOrBar
            title="전환율 · 평균 대비 Δ"
            subtitle="선별 이후 정밀연계 완료율 격차"
            scopeLabel={currentDrillLabel}
            data={rows.map((row) => ({
              name: row.name,
              value: Number((row.conversionRate * 100).toFixed(1)),
              delta: row.delta,
            }))}
            valueUnit="%"
            deltaUnit="%p"
            barColor="#0f766e"
            lineColor="#dc2626"
          />
          <TopNHorizontalBar
            title="저전환 구역 TopN"
            subtitle="100-전환율 기준"
            scopeLabel={currentDrillLabel}
            data={rows.map((row) => ({ name: row.name, value: Number(((1 - row.conversionRate) * 100).toFixed(1)) }))}
            unit="%"
            color="#0f766e"
            onItemClick={(item) => setSelectedCauseName(item.name)}
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
        <div className="flex items-start justify-between gap-2">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5 flex-1 min-w-0">
            {compactHeaderKpis.map((item) => (
              <div key={item.id} role="status" className={`rounded-md border px-2.5 py-2 ${item.tone}`}>
                {renderMetricLabel(item.label, item.helpKey, 'text-[10px] font-semibold')}
                <div className="text-[14px] font-bold mt-0.5">{item.value}</div>
              </div>
            ))}
          </div>
          <button
            onClick={() => setShowHeaderMetricsDetail((prev) => !prev)}
            className="h-8 px-2.5 rounded-md border border-gray-200 text-xs text-gray-600 hover:bg-gray-50 shrink-0"
          >
            상세 지표 {showHeaderMetricsDetail ? '접기' : '보기'}
          </button>
        </div>
        {showHeaderMetricsDetail && (
          <div className="mt-2 grid grid-cols-2 lg:grid-cols-4 gap-1.5">
            {topCards.map((card) => {
              const isActive = selectedKpiKey === card.key;
              return (
                <div
                  key={card.key}
                  className={`rounded-md border px-2.5 py-2 ${isActive ? 'border-blue-200 bg-blue-50' : 'border-gray-200 bg-gray-50'}`}
                >
                  <div className="flex items-center gap-1.5 text-[10px] font-semibold text-gray-600">
                    <span className={`p-1 rounded ${card.iconBg}`}>{KPI_ICON[card.key]}</span>
                    <span className="truncate">{toUserCopy(card.shortLabel)}</span>
                  </div>
                  <div className="text-[13px] font-bold text-gray-800 mt-1">
                    {formatKpiValue(card.key, card.value)}
                  </div>
                </div>
              );
            })}
          </div>
        )}
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
              <span className="ml-2 text-[12px] text-indigo-500">광역 관할 · {RANGE_PRESET_LABEL[rangePreset]}</span>
            </div>

            <div className="bg-white border border-gray-200 rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold text-gray-700">오늘의 운영 To-Do</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded border border-blue-200 bg-blue-50 text-blue-700">
                  활성 {todoActiveCount}개
                </span>
              </div>
              <div className="space-y-1.5">
                {todoItems.map((item, index) => {
                  const statusTone =
                    item.status === 'converted_to_intervention'
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                      : item.status === 'dismissed'
                        ? 'border-slate-200 bg-slate-100 text-slate-600'
                        : item.status === 'acknowledged'
                          ? 'border-blue-200 bg-blue-50 text-blue-700'
                          : 'border-amber-200 bg-amber-50 text-amber-700';
                  const statusLabel =
                    item.status === 'converted_to_intervention'
                      ? '개입 전환'
                      : item.status === 'dismissed'
                        ? '제외'
                        : item.status === 'acknowledged'
                          ? '확인'
                          : '오픈';

                  return (
                    <div key={item.id} className="rounded border border-gray-200 bg-gray-50 px-2 py-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="text-[11px] font-semibold text-gray-800 truncate">
                            {index + 1}. {item.title}
                          </div>
                          <div className="text-[10px] text-gray-600 mt-0.5">{item.reason}</div>
                          <div className="text-[10px] text-gray-500 mt-0.5">
                            대상 {item.target} · SLA {item.dueSlaHours}h
                          </div>
                        </div>
                        <span className={`shrink-0 rounded border px-1.5 py-0.5 text-[10px] font-semibold ${statusTone}`}>
                          {statusLabel}
                        </span>
                      </div>
                      {item.status === 'dismissed' && item.dismissReason ? (
                        <div className="mt-1 rounded border border-slate-200 bg-white px-1.5 py-1 text-[10px] text-slate-600">
                          제외 사유: {item.dismissReason}
                        </div>
                      ) : null}
                      <div className="mt-1.5 flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleTodoAnalyze(item)}
                          className="rounded border border-blue-200 bg-blue-50 px-1.5 py-1 text-[10px] font-medium text-blue-700 hover:bg-blue-100"
                        >
                          분석 보기
                        </button>
                        <button
                          type="button"
                          onClick={() => handleTodoCreate(item)}
                          className="rounded border border-emerald-200 bg-emerald-50 px-1.5 py-1 text-[10px] font-medium text-emerald-700 hover:bg-emerald-100"
                        >
                          개입 생성
                        </button>
                        <button
                          type="button"
                          onClick={() => setTodoStatus(item.id, 'acknowledged')}
                          className="rounded border border-gray-200 bg-white px-1.5 py-1 text-[10px] text-gray-600 hover:bg-gray-100"
                        >
                          확인
                        </button>
                        <button
                          type="button"
                          onClick={() => handleTodoDismiss(item)}
                          className="rounded border border-gray-200 bg-white px-1.5 py-1 text-[10px] text-gray-500 hover:bg-gray-100"
                        >
                          제외
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold text-gray-700">1. 현황 확인(문제 구역 찾기)</span>
                <span className="text-[11px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-700">
                  {renderMetricLabel(userKpiLabel, HELP_KEY_BY_KPI[selectedKpiKey])}
                </span>
              </div>
              <div className="mb-2 text-[11px] text-gray-500">지도를 클릭해 문제 구역을 선택</div>
              <div className="space-y-1.5 text-[12px] leading-relaxed">
                <div className="p-2 rounded border border-gray-100 bg-gray-50 text-gray-800">{summaryLineCurrent}</div>
                <div className="p-2 rounded border border-amber-100 bg-amber-50 text-amber-900">{summaryLineRisk}</div>
                <div className="p-2 rounded border border-blue-100 bg-blue-50 text-blue-900">{summaryLineAction}</div>
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-lg p-3 min-h-0 overflow-hidden flex flex-col">
              <div className="flex items-center justify-between mb-2">
                {renderMetricLabel('Top 집중 구역', 'top5Share', 'text-sm font-semibold text-gray-700')}
                <span className="text-[11px] px-1.5 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200">
                  후보 5
                </span>
              </div>
              <div className="mb-2 rounded border border-blue-100 bg-blue-50 px-2 py-1.5 text-[11px] text-blue-800">
                {renderMetricLabel(
                  `Top5가 전체 ${userKpiLabel} 규모의 ${top5ConcentrationLabel} 차지`,
                  'top5Share',
                  'text-[11px] text-blue-800',
                )}
              </div>
              <div className="space-y-1.5 overflow-y-auto pr-1">
                {top5.map((item, idx) => (
                  <button
                    key={item.regionId}
                    onClick={() => handleTop5Click(item.code, item.name, item.regionId)}
                    className={`w-full rounded-md border px-2 py-2 text-left ${selectedRegionId === item.regionId ? 'border-blue-300 bg-blue-50' : 'border-gray-200 bg-white hover:bg-gray-50'}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="w-5 h-5 shrink-0 rounded-full bg-gray-100 text-gray-700 text-[11px] font-semibold flex items-center justify-center">
                          {idx + 1}
                        </span>
                        <span className="text-[12px] font-medium text-gray-800 truncate">{item.name}</span>
                      </div>
                      <span className="text-[12px] font-semibold text-gray-900">{formatKpiValue(selectedKpiKey, item.kpiValue)}</span>
                    </div>
                  </button>
                ))}
                {top5.length === 0 && (
                  <div className="rounded border border-dashed border-gray-200 bg-gray-50 px-2 py-3 text-[11px] text-gray-500">
                    현재 단계 하위 행정구역 데이터 준비중
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className={`${layoutMode === 'desktop' ? 'min-w-0 min-h-0 flex flex-col overflow-hidden' : 'w-full shrink-0'} ${panelFadeClass}`}>
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
                    <div className="rounded-md border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700">
                      지오맵
                    </div>
                    <div className="flex rounded-md border border-gray-200 overflow-hidden">
                      {mapLayerOptions.map((layer) => (
                        <button
                          key={layer.key}
                          onClick={() => updateSelectedKpiKey(layer.kpi)}
                          className={`px-2.5 py-1.5 text-[11px] font-medium transition border-l first:border-l-0 ${
                            activeMapLayer === layer.key
                              ? 'bg-slate-700 text-white border-slate-700'
                              : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-100'
                          }`}
                          title={`${layer.label} 레이어로 전환`}
                        >
                          {layer.label}
                        </button>
                      ))}
                    </div>
                    <div className="flex items-center gap-0.5">
                      {(['7d', '30d', '90d'] as const).map((preset) => (
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

              <div className="px-4 py-2 border-b border-gray-100 bg-white">
                <div className="text-[12px] font-medium text-gray-700 truncate">
                  {renderMetricLabel(insightHeadline, 'insightHeadline')}
                </div>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {baselineBadges.map((badge) => (
                    <span
                      key={badge.label}
                      title={badge.tooltip}
                      className="rounded-full border border-gray-200 bg-gray-50 px-2 py-0.5 text-[10px] text-gray-600"
                    >
                      {badge.label}
                    </span>
                  ))}
                </div>
                <div className="mt-2 grid grid-cols-1 md:grid-cols-3 gap-2">
                  {miniSparkSeries.map((series) => {
                    const coords = buildSparkCoords(series.points.map((point) => point.v), 124, 28);
                    const path = coords.map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
                    const last = coords[coords.length - 1];
                    const deltaTone = series.delta > 0 ? 'text-red-600' : series.delta < 0 ? 'text-blue-600' : 'text-gray-500';

                    return (
                      <div key={series.key} className="rounded-md border border-gray-200 bg-gray-50 px-2 py-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[10px] text-gray-500">{series.label}</span>
                          <span className={`text-[10px] font-semibold ${deltaTone}`}>
                            {formatSparkDelta(series.delta, series.unit)}
                          </span>
                        </div>
                        <div className="flex items-end justify-between gap-2 mt-0.5">
                          <span className="text-[12px] font-semibold text-gray-800">
                            {formatSparkValue(series.value, series.unit)}
                          </span>
                          <svg viewBox="0 0 124 28" className="h-7 w-[124px] shrink-0">
                            <path d={path} fill="none" stroke={selectedKpiDef.color} strokeWidth="1.8" strokeLinecap="round" />
                            {last ? (
                              <circle cx={last.x} cy={last.y} r="2.5" fill={selectedKpiDef.color} />
                            ) : null}
                          </svg>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="relative p-2 min-h-0">
                <div className="absolute left-4 top-4 z-20 w-[min(420px,calc(100%-2rem))] rounded-lg border border-blue-200 bg-white/95 backdrop-blur px-3 py-2 shadow-sm">
                  <div className="text-[12px] font-semibold text-blue-800">상황 오버레이</div>
                  <div className="text-[12px] text-gray-700 mt-1 leading-relaxed">{mapOverlayMessage}</div>
                </div>
                <GeoMapPanel
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
              </div>

              <div className="mx-2 mb-2 px-3 py-2 rounded-lg bg-gradient-to-r from-gray-50 to-gray-100/80 border border-gray-200/60 shrink-0">
                <div className="flex items-center gap-2 mb-1.5">
                  <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: selectedKpiDef.color }} />
                  <span className="text-[12px] font-bold text-gray-600 tracking-wide">{userKpiLabel} 지도 범례</span>
                  <span className="text-[11px] text-gray-400">스코프: 광역 관할</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[12px] font-semibold text-gray-500 tabular-nums min-w-[42px] text-right">
                    {selectedKpiDef.unit === '건'
                      ? `${Math.round(mapMin)}건`
                      : selectedKpiDef.unit === '점'
                        ? `${Math.round(mapMin)}점`
                        : selectedKpiDef.unit === '일'
                          ? `${Math.round(mapMin)}일`
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
                        : selectedKpiDef.unit === '일'
                          ? `${Math.round(mapMax)}일`
                        : `${mapMax.toFixed(1)}%`}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className={`${layoutMode === 'desktop' ? 'min-w-0 min-h-0 overflow-hidden' : layoutMode === 'tablet' ? 'hidden' : 'w-full shrink-0'} flex flex-col gap-2 ${panelFadeClass}`}>
            <div className="bg-white border border-gray-200 rounded-lg p-3 shrink-0">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold text-gray-700">2. 원인 파악(왜 막히는지)</span>
                <span className="text-[11px] px-1.5 py-0.5 bg-indigo-50 text-indigo-600 rounded border border-indigo-200">
                  {currentDrillLabel}
                </span>
              </div>
              <div className="text-[11px] text-gray-500 mb-1">선택 구역의 병목/원인 상위 3개 확인</div>
              <div className="text-[12px] text-gray-500">
                선택 지표: <span className="font-medium text-gray-700">{userKpiLabel}</span> · 스코프: 광역 관할
              </div>
              {onNavigateModule ? (
                <button
                  type="button"
                  onClick={() => onNavigateModule('cause')}
                  className="mt-2 text-[11px] text-blue-700 hover:text-blue-800 underline underline-offset-2"
                >
                  병목 원인 분석 탭에서 상세 보기
                </button>
              ) : null}
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain pr-1 space-y-2">
              {isVizLoading ? (
                <div className="space-y-2">
                  <ChartSkeleton height={176} />
                  <ChartSkeleton height={176} />
                </div>
              ) : (
                <>
                  <div className="bg-white border border-gray-200 rounded-lg p-3">
                    <div className="grid grid-cols-1 gap-1.5">
                      {diagnosisMetrics.map((item) => (
                        <div key={item.label} className="rounded border border-gray-100 bg-gray-50 px-2 py-1.5">
                          <div className="text-[10px] text-gray-500">{item.label}</div>
                          <div className="text-[12px] font-medium text-gray-800 mt-0.5">{item.value}</div>
                        </div>
                      ))}
                    </div>
                    <div className="mt-2 rounded border border-gray-100 bg-gray-50 px-2 py-2">
                      <div className="text-[11px] font-semibold text-gray-700 mb-1">원인 Top3</div>
                      <div className="space-y-1">
                        {causeTopNPreview.slice(0, 3).map((item, idx) => (
                          <div key={`${item.name}-${idx}`} className="flex items-center justify-between text-[11px]">
                            <span className="text-gray-700">{idx + 1}. {item.name}</span>
                            <span className="font-semibold text-gray-900">{formatCauseMetricValue(item)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="bg-white border border-gray-200 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-semibold text-gray-700">3. 조치 실행(개입 만들기)</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded border border-emerald-200 bg-emerald-50 text-emerald-700">
                        조치 선택
                      </span>
                    </div>
                    <div className="text-[11px] text-gray-500 mb-1.5">권장 조치를 선택하고 개입을 생성</div>
                    {onNavigateModule ? (
                      <button
                        type="button"
                        onClick={() => onNavigateModule('interventions')}
                        className="mb-2 text-[11px] text-blue-700 hover:text-blue-800 underline underline-offset-2"
                      >
                        개입/조치 관리 탭으로 이동
                      </button>
                    ) : null}
                    <div className="space-y-1.5">
                      {actionEngineItems.map((item) => (
                        <button
                          key={item.id}
                          onClick={() => setSelectedActionId(item.id)}
                          className={`w-full rounded border px-2 py-2 text-left ${selectedActionId === item.id ? 'border-blue-300 bg-blue-50' : 'border-gray-200 bg-white hover:bg-gray-50'}`}
                        >
                          <div className="text-[12px] font-medium text-gray-800">{item.title}</div>
                          <div className="text-[11px] text-gray-600 mt-0.5">{item.detail}</div>
                          <div className="text-[11px] text-blue-700 mt-1">{item.expected}</div>
                        </button>
                      ))}
                    </div>
                    <button
                      onClick={() =>
                        onCreateIntervention?.({
                          kpi: selectedKpiKey,
                          sgg: selectedDistrictName,
                          range: analyticsPeriod,
                          source: 'overview',
                          primaryDriverStage: selectedActionEngineItem?.stage ?? uiEmphasis.primaryDriverStage,
                        })
                      }
                      className="mt-2.5 w-full h-9 rounded-md text-[12px] font-semibold text-white bg-blue-600 hover:bg-blue-700"
                    >
                      개입 만들기
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
