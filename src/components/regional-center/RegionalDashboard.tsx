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
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Line,
  LineChart,
  Area,
  PieChart,
  Pie,
  Cell,
  ComposedChart,
  Legend,
  Treemap,
} from 'recharts';
import { GeoMapPanel, type MapColorScheme } from '../geomap/GeoMapPanel';
import { COLOR_PALETTES } from '../../lib/choroplethScale';
import type { RegionalScope } from '../geomap/regions';
import {
  REGIONAL_TOP_KPIS,
  OPS_TABLE_COLUMNS,
  loadRegionalSettings,
  OPS_TO_GEO_INDICATOR,
  OPS_COLOR_SCHEME,
  computePriorityScore,
  type RegionalKpiKey,
} from '../../lib/regionalKpiDictionary';

type AnalyticsPeriod = 'week' | 'month' | 'quarter';

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
  onNavigateToBottleneck?: () => void;
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
  month: 4.2,
  quarter: 13,
};

const PERIOD_LABEL: Record<AnalyticsPeriod, string> = {
  week: '주간',
  month: '월간',
  quarter: '분기',
};

const KPI_RANGE: Record<RegionalKpiKey, [number, number]> = {
  regionalSla: [70, 98],
  regionalQueueRisk: [20, 95],
  regionalRecontact: [5, 40],
  regionalDataReadiness: [65, 99],
  regionalGovernance: [72, 99],
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
  if (key === 'regionalQueueRisk') return `${Math.round(value)}점`;
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

function buildDistrictData(name: string, scopeKey: string, period: AnalyticsPeriod): DistrictOpsData {
  const seed = `${scopeKey}-${period}-${name}`;
  const mul = PERIOD_MUL[period];

  const volume = Math.round(sv(`${seed}-volume`, 70, 560) * mul);
  const slaRate = Number(sv(`${seed}-sla`, KPI_RANGE.regionalSla[0], KPI_RANGE.regionalSla[1]).toFixed(1));
  const queueRisk = Number(sv(`${seed}-queue`, KPI_RANGE.regionalQueueRisk[0], KPI_RANGE.regionalQueueRisk[1]).toFixed(1));
  const recontactRate = Number(sv(`${seed}-recontact`, KPI_RANGE.regionalRecontact[0], KPI_RANGE.regionalRecontact[1]).toFixed(1));
  const dataReady = Number(sv(`${seed}-data`, KPI_RANGE.regionalDataReadiness[0], KPI_RANGE.regionalDataReadiness[1]).toFixed(1));
  const governance = Number(sv(`${seed}-gov`, KPI_RANGE.regionalGovernance[0], KPI_RANGE.regionalGovernance[1]).toFixed(1));

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
    { name: '재접촉 큐', value: Math.round(sv(`${seed}-qt-recontact`, 12, 120) * mul) },
    { name: 'L2 큐', value: Math.round(sv(`${seed}-qt-l2`, 8, 95) * mul) },
    { name: '2차 큐', value: Math.round(sv(`${seed}-qt-s2`, 6, 88) * mul) },
    { name: '3차 큐', value: Math.round(sv(`${seed}-qt-s3`, 4, 72) * mul) },
  ];

  const queueCauseTop = [
    { name: '연락 실패', value: Math.round(sv(`${seed}-cause-contact`, 8, 40) * mul) },
    { name: '인력 여유 부족', value: Math.round(sv(`${seed}-cause-staff`, 6, 34) * mul) },
    { name: '데이터 부족', value: Math.round(sv(`${seed}-cause-data`, 5, 28) * mul) },
    { name: '2차/3차 대기', value: Math.round(sv(`${seed}-cause-stage`, 6, 30) * mul) },
    { name: '예약 지연', value: Math.round(sv(`${seed}-cause-booking`, 4, 24) * mul) },
  ].sort((a, b) => b.value - a.value);

  const recontactReasons = [
    { name: '연락처 오류', value: Math.round(sv(`${seed}-rr-contact`, 10, 40) * mul) },
    { name: '미응답', value: Math.round(sv(`${seed}-rr-noanswer`, 14, 55) * mul) },
    { name: '시간대 불일치', value: Math.round(sv(`${seed}-rr-time`, 8, 34) * mul) },
  ].sort((a, b) => b.value - a.value);

  const recontactTrend = ['D-6', 'D-5', 'D-4', 'D-3', 'D-2', 'D-1', 'D0'].map((day, idx) => ({
    day,
    value: Number(sv(`${seed}-rt-${idx}`, 6, 40).toFixed(1)),
  }));

  const recontactSlots = RECONTACT_TIME_SLOTS.map((slot, idx) => ({
    slot,
    successRate: Number(sv(`${seed}-slot-rate-${idx}`, 42, 88).toFixed(1)),
    attempts: Math.round(sv(`${seed}-slot-attempt-${idx}`, 14, 90) * mul),
  }));

  const missingFields = [
    { name: '연락처 최신화', value: Math.round(sv(`${seed}-mf-phone`, 8, 45) * mul) },
    { name: '보호자 정보', value: Math.round(sv(`${seed}-mf-guardian`, 6, 32) * mul) },
    { name: '기저질환 코드', value: Math.round(sv(`${seed}-mf-condition`, 5, 28) * mul) },
    { name: '이전 접촉 이력', value: Math.round(sv(`${seed}-mf-history`, 5, 24) * mul) },
  ].sort((a, b) => b.value - a.value);

  const collectionLeadtime = [
    { name: '0-1일', value: Math.round(sv(`${seed}-lead-0`, 18, 64) * mul) },
    { name: '2-3일', value: Math.round(sv(`${seed}-lead-1`, 14, 56) * mul) },
    { name: '4-7일', value: Math.round(sv(`${seed}-lead-2`, 10, 42) * mul) },
    { name: '8일+', value: Math.round(sv(`${seed}-lead-3`, 6, 30) * mul) },
  ];

  const governanceMissingTypes = [
    { name: '책임자 미기록', value: Math.round(sv(`${seed}-gov-owner`, 4, 26) * mul) },
    { name: '근거 링크 누락', value: Math.round(sv(`${seed}-gov-proof`, 5, 30) * mul) },
    { name: '접촉 로그 누락', value: Math.round(sv(`${seed}-gov-log`, 6, 34) * mul) },
  ].sort((a, b) => b.value - a.value);

  const governanceActionStatus: GovernanceStatus[] = [
    { status: '미조치', value: Math.round(sv(`${seed}-gact-open`, 8, 40) * mul) },
    { status: '조치중', value: Math.round(sv(`${seed}-gact-progress`, 6, 32) * mul) },
    { status: '완료', value: Math.round(sv(`${seed}-gact-done`, 4, 28) * mul) },
  ];

  const stageImpact: StageImpact = {
    stage1SignalDelta: Number(sv(`${seed}-s1-signal`, -18, 24).toFixed(1)),
    stage1QueueDelta: Math.round(sv(`${seed}-s1-queue`, -14, 36) * mul),
    stage2SignalDelta: Number(sv(`${seed}-s2-signal`, -16, 22).toFixed(1)),
    stage2QueueDelta: Math.round(sv(`${seed}-s2-queue`, -12, 32) * mul),
    stage3SignalDelta: Number(sv(`${seed}-s3-signal`, -12, 18).toFixed(1)),
    stage3QueueDelta: Math.round(sv(`${seed}-s3-queue`, -10, 26) * mul),
  };

  return {
    name,
    volume,
    kpi: {
      regionalSla: slaRate,
      regionalQueueRisk: queueRisk,
      regionalRecontact: recontactRate,
      regionalDataReadiness: dataReady,
      regionalGovernance: governance,
    },
    mapMetric: {
      regionalSla: Number((100 - slaRate).toFixed(1)),
      regionalQueueRisk: queueRisk,
      regionalRecontact: recontactRate,
      regionalDataReadiness: dataReady,
      regionalGovernance: Number((100 - governance).toFixed(1)),
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
    return buildDistrictData('기준없음', 'empty', 'week');
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
  if (kpiKey === 'regionalQueueRisk' || kpiKey === 'regionalRecontact') return 'higherWorse';
  return 'higherBetter';
}

function getKpiTooltipLines(label: string, detail: string): string[] {
  return [
    `${label}: ${detail}`,
    '스코프: 광역 관할',
    '집계: case_id 기준',
  ];
}

export function RegionalDashboard({ region, onNavigateToBottleneck }: RegionalDashboardProps) {
  const [analyticsPeriod, setAnalyticsPeriod] = useState<AnalyticsPeriod>('week');
  const [selectedKpiKey, setSelectedKpiKey] = useState<RegionalKpiKey>('regionalSla');
  const [visualizationMode, setVisualizationMode] = useState<'geomap' | 'heatmap'>('geomap');
  const [containerRef, containerSize] = useResizeObserver<HTMLDivElement>();
  const [selectedDistrictName, setSelectedDistrictName] = useState<string | null>(null);
  const [tooltipTarget, setTooltipTarget] = useState<string | null>(null);
  const [mapDrillLevel, setMapDrillLevel] = useState<'ctprvn' | 'sig' | 'emd' | undefined>(undefined);
  const [mapDrillCode, setMapDrillCode] = useState<string | undefined>(undefined);
  const [sigunguRegions, setSigunguRegions] = useState<Array<{ code: string; name: string }>>([]);
  const [stageImpactOpen, setStageImpactOpen] = useState(false);
  const [showLeftDetails, setShowLeftDetails] = useState(false);
  const [showBottomTable, setShowBottomTable] = useState(false);

  const settings = useMemo(() => loadRegionalSettings(region.id), [region.id]);

  useEffect(() => {
    setSelectedDistrictName(null);
    setMapDrillLevel(undefined);
    setMapDrillCode(undefined);
    setStageImpactOpen(false);
  }, [region.id]);

  const layoutMode = useMemo(() => {
    const w = containerSize.width || (typeof window !== 'undefined' ? window.innerWidth : 1920);
    if (w >= 1024) return 'desktop';
    if (w >= 768) return 'tablet';
    return 'mobile';
  }, [containerSize.width]);

  const districts = useMemo(() => DISTRICT_MAP[region.id] ?? DISTRICT_MAP.seoul, [region.id]);
  const districtNameSet = useMemo(() => new Set(districts), [districts]);

  const districtRows = useMemo(
    () => districts.map((name) => buildDistrictData(name, region.id, analyticsPeriod)),
    [districts, region.id, analyticsPeriod],
  );

  const selectedDistrictData = useMemo(
    () => (selectedDistrictName ? districtRows.find((row) => row.name === selectedDistrictName) ?? null : null),
    [districtRows, selectedDistrictName],
  );

  const aggregated = useMemo(() => aggregateDistrictData(districtRows), [districtRows]);
  const focusData = selectedDistrictData ?? aggregated;

  const selectedKpiDef = useMemo(
    () => REGIONAL_TOP_KPIS.find((kpi) => kpi.kpiKey === selectedKpiKey) ?? REGIONAL_TOP_KPIS[0],
    [selectedKpiKey],
  );

  const topCards = useMemo(() => {
    return REGIONAL_TOP_KPIS.map((kpi) => {
      const key = kpi.kpiKey as RegionalKpiKey;
      return {
        ...kpi,
        key,
        value: aggregated.kpi[key],
        mapColorScheme: (OPS_COLOR_SCHEME[key] ?? 'blue') as MapColorScheme,
        tooltipLines: getKpiTooltipLines(kpi.label, kpi.tooltip),
      };
    });
  }, [aggregated]);

  const mapIndicatorId = OPS_TO_GEO_INDICATOR[selectedKpiKey] ?? 'regional_sla_violation';
  const mapColorScheme = (OPS_COLOR_SCHEME[selectedKpiKey] ?? 'blue') as MapColorScheme;

  const mapHeaderTitle = `${PERIOD_LABEL[analyticsPeriod]} · ${region.label} · ${selectedKpiDef.shortLabel} · 시군구`;

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

  const nationalReference = useMemo(() => {
    const [min, max] = KPI_RANGE[selectedKpiKey];
    return Number(sv(`national-${selectedKpiKey}-${analyticsPeriod}`, min, max).toFixed(1));
  }, [selectedKpiKey, analyticsPeriod]);

  const regionalValue = aggregated.kpi[selectedKpiKey];
  const regionalDelta = Number((regionalValue - nationalReference).toFixed(1));

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
          sv(`national-${selectedKpiKey}-${analyticsPeriod}-${row.name}`, KPI_RANGE[selectedKpiKey][0], KPI_RANGE[selectedKpiKey][1]).toFixed(1),
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
  }, [districtRows, selectedKpiKey, analyticsPeriod]);

  const top5 = useMemo(() => priorityRows.slice(0, 5), [priorityRows]);

  const handleGoBack = useCallback(() => {
    setSelectedDistrictName(null);
    setMapDrillLevel('sig');
    setMapDrillCode(region.ctprvnCode);
    setStageImpactOpen(false);
  }, [region.ctprvnCode]);

  const handleRegionSelect = useCallback(
    ({ level, name }: { level: string; code: string; name: string }) => {
      if (level === 'ctprvn') {
        handleGoBack();
        return;
      }
      if (districtNameSet.has(name)) {
        setSelectedDistrictName(name);
      }
    },
    [districtNameSet, handleGoBack],
  );

  const handleSubRegionsChange = useCallback((regions: Array<{ code: string; name: string }>) => {
    const nextSigungu = regions.filter((regionInfo) => regionInfo.code.length <= 5);
    if (nextSigungu.length) {
      setSigunguRegions(nextSigungu);
    }
  }, []);

  const handleTop5Click = useCallback(
    (districtName: string) => {
      setSelectedDistrictName(districtName);
      const match = sigunguRegions.find(
        (item) => item.name.includes(districtName) || districtName.includes(item.name),
      );
      if (match) {
        setMapDrillLevel('emd');
        setMapDrillCode(match.code);
      }
    },
    [sigunguRegions],
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

    return Array.from({ length: points }, (_, idx) => {
      const regional = Number(sv(`${region.id}-${selectedKpiKey}-${analyticsPeriod}-reg-${idx}`, min, max).toFixed(1));
      const national = Number(sv(`national-${selectedKpiKey}-${analyticsPeriod}-tr-${idx}`, min, max).toFixed(1));
      const district = selectedDistrictName
        ? Number(sv(`${region.id}-${selectedDistrictName}-${selectedKpiKey}-${analyticsPeriod}-dist-${idx}`, min, max).toFixed(1))
        : undefined;

      return {
        label: labels[idx],
        regional,
        national,
        district,
      };
    });
  }, [analyticsPeriod, selectedKpiKey, region.id, selectedDistrictName]);

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

  const renderRightPanel = () => {
    if (selectedKpiKey === 'regionalSla') {
      const slaStack = focusData.slaStageContribution.reduce<Record<string, number>>((acc, cur) => {
        acc[cur.name] = cur.value;
        return acc;
      }, {});

      return (
        <>
          <div className="bg-white border border-gray-200 rounded-lg p-3">
            <div className="text-sm font-semibold text-gray-700 mb-2">단계별 SLA 위반 기여도</div>
            <div style={{ height: '230px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={[{ scope: selectedDistrictData ? selectedDistrictData.name : `${region.label} 전체`, ...slaStack }]} margin={{ top: 8, right: 8, left: 8, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                  <XAxis dataKey="scope" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} unit="%" />
                  <Tooltip formatter={(value: number) => `${Number(value).toFixed(1)}%`} />
                  <Legend wrapperStyle={{ fontSize: '12px' }} />
                  {focusData.slaStageContribution.map((stage, idx) => (
                    <Bar key={stage.name} dataKey={stage.name} stackId="sla" fill={['#ef4444', '#f97316', '#f59e0b', '#fb7185', '#dc2626'][idx % 5]} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-lg p-3">
            <div className="text-sm font-semibold text-gray-700 mb-2">상위 시군구 위반율 · 평균 대비 Δ</div>
            <div style={{ height: '230px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={slaRanking} margin={{ top: 8, right: 8, left: -10, bottom: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={-30} textAnchor="end" height={60} />
                  <YAxis yAxisId="left" tick={{ fontSize: 12 }} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12 }} />
                  <Tooltip formatter={(value: number, name) => `${Number(value).toFixed(1)}${name === 'delta' ? '%p' : '%'}`} />
                  <Legend wrapperStyle={{ fontSize: '12px' }} formatter={(name) => (name === 'value' ? 'SLA 위반율' : '평균 대비 Δ')} />
                  <Bar yAxisId="left" dataKey="value" fill="#ef4444" radius={[4, 4, 0, 0]} />
                  <Line yAxisId="right" dataKey="delta" stroke="#1d4ed8" strokeWidth={2} dot={{ r: 3 }} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      );
    }

    if (selectedKpiKey === 'regionalQueueRisk') {
      return (
        <>
          <div className="bg-white border border-gray-200 rounded-lg p-3">
            <div className="text-sm font-semibold text-gray-700 mb-2">큐 타입별 적체 분해</div>
            <div style={{ height: '230px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={focusData.queueTypeBacklog} margin={{ top: 8, right: 8, left: -8, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip formatter={(value: number) => `${Math.round(value)}건`} />
                  <Bar dataKey="value" fill="#f97316" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-lg p-3">
            <div className="text-sm font-semibold text-gray-700 mb-2">병목 원인 TopN</div>
            <div style={{ height: '230px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={focusData.queueCauseTop.slice(0, 5)} layout="vertical" margin={{ top: 8, right: 16, left: 20, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f3f4f6" />
                  <XAxis type="number" tick={{ fontSize: 12 }} />
                  <YAxis dataKey="name" type="category" tick={{ fontSize: 12 }} width={85} />
                  <Tooltip formatter={(value: number) => `${Math.round(value)}건`} />
                  <Bar dataKey="value" fill="#ea580c" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      );
    }

    if (selectedKpiKey === 'regionalRecontact') {
      return (
        <>
          <div className="bg-white border border-gray-200 rounded-lg p-3">
            <div className="text-sm font-semibold text-gray-700 mb-2">실패 사유 분포 + 최근 7일 추이</div>
            <div className="grid grid-cols-2 gap-2" style={{ height: '240px' }}>
              <div>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={focusData.recontactReasons} dataKey="value" nameKey="name" innerRadius={34} outerRadius={62}>
                      {focusData.recontactReasons.map((_, idx) => (
                        <Cell key={idx} fill={['#f59e0b', '#f97316', '#ef4444'][idx % 3]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: number) => `${Math.round(value)}건`} />
                    <Legend wrapperStyle={{ fontSize: '11px' }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={focusData.recontactTrend} margin={{ top: 8, right: 6, left: -14, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                    <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(value: number) => `${Number(value).toFixed(1)}%`} />
                    <Line type="monotone" dataKey="value" stroke="#f97316" strokeWidth={2.5} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-lg p-3">
            <div className="text-sm font-semibold text-gray-700 mb-2">권장 시간대(연락 성공률)</div>
            <div style={{ height: '230px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={focusData.recontactSlots} margin={{ top: 8, right: 10, left: -12, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                  <XAxis dataKey="slot" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} unit="%" />
                  <Tooltip formatter={(value: number, key, item: any) => {
                    if (key === 'successRate') return `${Number(value).toFixed(1)}%`;
                    return `${item?.payload?.attempts ?? 0}건`;
                  }} />
                  <Bar dataKey="successRate" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      );
    }

    if (selectedKpiKey === 'regionalDataReadiness') {
      return (
        <>
          <div className="bg-white border border-gray-200 rounded-lg p-3">
            <div className="text-sm font-semibold text-gray-700 mb-2">결측 필드 TopN</div>
            <div style={{ height: '230px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={focusData.missingFields.slice(0, 4)} layout="vertical" margin={{ top: 8, right: 16, left: 20, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f3f4f6" />
                  <XAxis type="number" tick={{ fontSize: 12 }} />
                  <YAxis dataKey="name" type="category" tick={{ fontSize: 12 }} width={90} />
                  <Tooltip formatter={(value: number) => `${Math.round(value)}건`} />
                  <Bar dataKey="value" fill="#16a34a" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-lg p-3">
            <div className="text-sm font-semibold text-gray-700 mb-2">데이터 수집 지연 분포</div>
            <div style={{ height: '230px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={focusData.collectionLeadtime} margin={{ top: 8, right: 8, left: -8, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip formatter={(value: number) => `${Math.round(value)}건`} />
                  <Bar dataKey="value" fill="#22c55e" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      );
    }

    return (
      <>
        <div className="bg-white border border-gray-200 rounded-lg p-3">
          <div className="text-sm font-semibold text-gray-700 mb-2">누락 유형 분포</div>
          <div style={{ height: '230px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={focusData.governanceMissingTypes} dataKey="value" nameKey="name" innerRadius={34} outerRadius={64}>
                  {focusData.governanceMissingTypes.map((_, idx) => (
                    <Cell key={idx} fill={['#8b5cf6', '#7c3aed', '#a855f7'][idx % 3]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number) => `${Math.round(value)}건`} />
                <Legend wrapperStyle={{ fontSize: '11px' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-3">
          <div className="text-sm font-semibold text-gray-700 mb-2">누락 상위 지역 + 조치 상태</div>
          <div style={{ height: '230px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={governanceRegionalStatus} margin={{ top: 8, right: 8, left: -6, bottom: 30 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={-30} textAnchor="end" height={58} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip formatter={(value: number) => `${Math.round(value)}건`} />
                <Legend wrapperStyle={{ fontSize: '11px' }} />
                <Bar dataKey="미조치" stackId="a" fill="#ef4444" />
                <Bar dataKey="조치중" stackId="a" fill="#f59e0b" />
                <Bar dataKey="완료" stackId="a" fill="#22c55e" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </>
    );
  };

  return (
    <div ref={containerRef} className="flex flex-col bg-gray-50 h-full min-h-0">
      <div className="bg-white border-b border-gray-200 px-4 py-2 shrink-0">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 overflow-x-auto flex-1 min-w-0">
            {topCards.map((card) => {
              const isActive = selectedKpiKey === card.key;
              return (
                <button
                  key={card.key}
                  onClick={() => setSelectedKpiKey(card.key)}
                  onMouseEnter={() => setTooltipTarget(card.key)}
                  onMouseLeave={() => setTooltipTarget(null)}
                  className={`relative flex items-center gap-2 px-3 py-2 rounded-lg border transition-all min-w-[156px] text-left ${
                    isActive
                      ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200 shadow-sm'
                      : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <div className={`p-1.5 rounded-md ${card.iconBg}`}>{KPI_ICON[card.key]}</div>
                  <div className="flex-1 min-w-0">
                    <div className={`text-[12px] font-medium truncate ${isActive ? 'text-blue-700' : 'text-gray-600'}`}>
                      {card.shortLabel}
                    </div>
                    <div className={`text-sm font-bold ${isActive ? 'text-blue-700' : 'text-gray-800'}`}>
                      {formatKpiValue(card.key, card.value)}
                    </div>
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
            {selectedDistrictName && (
              <button
                onClick={handleGoBack}
                className="flex items-center gap-1 px-2 py-1 text-xs text-blue-600 bg-blue-50 rounded hover:bg-blue-100 transition-colors"
              >
                <ChevronLeft className="h-3 w-3" />
                <span>광역 전체</span>
              </button>
            )}
            {selectedDistrictName && (
              <button
                onClick={handleGoBack}
                className="p-1 text-gray-500 hover:text-blue-600 hover:bg-gray-100 rounded transition-colors"
                title="광역 관할로 이동"
              >
                <Home className="h-3.5 w-3.5" />
              </button>
            )}
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

      <div className="flex-1 overflow-y-auto min-h-0">
        <div
          className={`p-2 gap-2 ${layoutMode === 'desktop' ? 'grid' : 'flex flex-col'}`}
          style={
            layoutMode === 'desktop'
              ? { gridTemplateColumns: '1.2fr 2.2fr 2.6fr', minHeight: 'calc(100vh - 140px)', alignItems: 'stretch' }
              : undefined
          }
        >
          <div className={`${layoutMode === 'desktop' ? 'min-w-0' : layoutMode === 'tablet' ? 'hidden' : 'w-full shrink-0'} flex flex-col gap-2`}>
            <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-2 text-center">
              <span className="text-xs text-indigo-700 font-medium">
                {selectedDistrictName ? `📍 ${selectedDistrictName}` : `🏢 ${region.label}`}
              </span>
              <span className="ml-2 text-[12px] text-indigo-500">스코프: 광역 관할 · {PERIOD_LABEL[analyticsPeriod]}</span>
            </div>

            <div className="bg-white border border-gray-200 rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold text-gray-700">선택 KPI 요약</span>
                <span className="text-[11px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-700">{selectedKpiDef.shortLabel}</span>
              </div>
              <div className="space-y-1.5 text-[13px]">
                <div className="flex items-center justify-between">
                  <span className="text-gray-500">광역 대표값</span>
                  <span className="font-bold text-gray-900">{formatKpiValue(selectedKpiKey, regionalValue)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-500">지도 기준 평균</span>
                  <span className="font-semibold text-gray-700">{formatKpiValue(selectedKpiKey, mapAvg)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-500">전국 참고</span>
                  <span className="font-semibold text-gray-700">{formatKpiValue(selectedKpiKey, nationalReference)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-500">전국 대비 Δ</span>
                  <span className={`font-semibold ${regionalDelta >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                    {regionalDelta > 0 ? '+' : ''}
                    {selectedKpiKey === 'regionalQueueRisk' ? `${Math.round(regionalDelta)}점` : `${regionalDelta.toFixed(1)}%p`}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-500">정책 영향(우리 관할)</span>
                  <span className="font-semibold text-violet-700">{focusData.policyImpactLocal.toFixed(1)}점</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-500">장기 대기 기준</span>
                  <span className="font-semibold text-gray-700">{settings.thresholds.longWaitDays}일</span>
                </div>
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
              <div className="text-[11px] text-gray-400 mb-1.5">score = 0.6 × KPI 정규화 + 0.4 × 규모 정규화</div>
              <div className="space-y-1">
                {top5.map((item, idx) => (
                  <button
                    key={item.name}
                    onClick={() => handleTop5Click(item.name)}
                    className={`w-full text-left p-1.5 rounded-lg border transition-colors ${
                      selectedDistrictName === item.name ? 'border-red-300 bg-red-50' : 'border-gray-100 hover:bg-gray-50'
                    }`}
                  >
                    <div className="grid grid-cols-[1fr_auto_auto] gap-2 items-center">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className={`w-5 h-5 flex items-center justify-center text-[12px] font-bold rounded-full ${idx === 0 ? 'bg-red-500 text-white' : idx < 3 ? 'bg-orange-100 text-orange-700' : 'bg-gray-100 text-gray-600'}`}>
                          {idx + 1}
                        </span>
                        <span className="text-xs font-medium text-gray-800 truncate">{item.name}</span>
                      </div>
                      <span className="text-[11px] font-semibold text-gray-700 min-w-[72px] text-right">{formatKpiValue(selectedKpiKey, item.kpiValue)}</span>
                      <span className="text-[11px] font-semibold text-blue-700 min-w-[64px] text-right">{item.volume.toLocaleString()}건</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
              <button
                onClick={() => setShowLeftDetails((prev) => !prev)}
                className="w-full px-3 py-2 flex items-center justify-between hover:bg-gray-50"
              >
                <span className="text-[12px] font-medium text-gray-700">보조 상세 보기</span>
                {showLeftDetails ? <ChevronUp className="h-3.5 w-3.5 text-gray-400" /> : <ChevronDown className="h-3.5 w-3.5 text-gray-400" />}
              </button>
              {showLeftDetails && (
                <div className="px-3 pb-3 border-t border-gray-100 text-[12px] text-gray-600 space-y-1">
                  <div>현재 선택: {selectedDistrictData ? `${selectedDistrictData.name} 시군구` : `${region.label} 광역 관할`}</div>
                  <div>지도 값 평균: {formatKpiValue(selectedKpiKey, mapAvg)}</div>
                  <div>범례 범위: {selectedKpiKey === 'regionalQueueRisk' ? `${Math.round(mapMin)}점 ~ ${Math.round(mapMax)}점` : `${mapMin.toFixed(1)}% ~ ${mapMax.toFixed(1)}%`}</div>
                </div>
              )}
            </div>
          </div>

          <div className={`${layoutMode === 'desktop' ? 'min-w-0 flex flex-col' : 'w-full shrink-0'}`}>
            <div className="bg-white border border-gray-200 rounded-lg overflow-hidden flex flex-col flex-1">
              <div className="px-4 py-3 border-b border-gray-200 bg-white rounded-t-lg">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    {selectedDistrictName && (
                      <button
                        onClick={handleGoBack}
                        className="flex items-center gap-1 h-8 px-3 text-sm text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors font-medium"
                      >
                        <ChevronLeft className="h-4 w-4" />
                        <span>뒤로</span>
                      </button>
                    )}
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
                      {(['week', 'month', 'quarter'] as const).map((period) => (
                        <button
                          key={period}
                          onClick={() => setAnalyticsPeriod(period)}
                          className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${
                            analyticsPeriod === period
                              ? 'bg-blue-600 text-white'
                              : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                          }`}
                        >
                          {PERIOD_LABEL[period]}
                        </button>
                      ))}
                    </div>
                    <button className="h-7 w-7 flex items-center justify-center hover:bg-gray-100 rounded-lg transition-colors">
                      <Download className="h-3.5 w-3.5 text-gray-500" />
                    </button>
                  </div>
                </div>
              </div>

              <div className="p-2 min-h-0">
                {visualizationMode === 'geomap' ? (
                  <GeoMapPanel
                    key={`regional-${region.id}-${selectedKpiKey}-${analyticsPeriod}`}
                    title=""
                    indicatorId={mapIndicatorId}
                    year={2026}
                    scope={{ mode: 'regional', ctprvnCodes: [region.ctprvnCode], label: region.label }}
                    variant="portal"
                    mapHeight={670}
                    hideBreadcrumb
                    onRegionSelect={handleRegionSelect}
                    externalColorScheme={mapColorScheme}
                    hideLegendPanel
                    externalLevel={mapDrillLevel}
                    externalSelectedCode={mapDrillCode}
                    onSubRegionsChange={handleSubRegionsChange}
                  />
                ) : (
                  <div className="w-full" style={{ height: 'clamp(360px, 48vh, 680px)' }}>
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
                    {selectedKpiKey === 'regionalQueueRisk' ? `${Math.round(mapMin)}점` : `${mapMin.toFixed(1)}%`}
                  </span>
                  <div className="flex-1 h-3 rounded-md overflow-hidden flex shadow-inner">
                    {(COLOR_PALETTES[mapColorScheme as keyof typeof COLOR_PALETTES] || COLOR_PALETTES.blue).map((color, idx) => (
                      <div key={idx} className="flex-1" style={{ backgroundColor: color }} />
                    ))}
                  </div>
                  <span className="text-[12px] font-semibold text-gray-500 tabular-nums min-w-[42px]">
                    {selectedKpiKey === 'regionalQueueRisk' ? `${Math.round(mapMax)}점` : `${mapMax.toFixed(1)}%`}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className={`${layoutMode === 'desktop' ? 'min-w-0' : layoutMode === 'tablet' ? 'hidden' : 'w-full shrink-0'} flex flex-col gap-2`}>
            <div className="bg-white border border-gray-200 rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold text-gray-700">우측 분석 · 조치 중심</span>
                <span className="text-[11px] px-1.5 py-0.5 bg-indigo-50 text-indigo-600 rounded border border-indigo-200">
                  {selectedDistrictData ? `${selectedDistrictData.name} 필터` : `${region.label} 전체`}
                </span>
              </div>
              <div className="text-[12px] text-gray-500">
                선택 KPI: <span className="font-medium text-gray-700">{selectedKpiDef.label}</span> · 스코프: 광역 관할
              </div>
              <div className="text-[12px] text-gray-500">
                보조 스코프: 전국 참고 {formatKpiValue(selectedKpiKey, nationalReference)}
              </div>
            </div>

            {renderRightPanel()}

            <div className="bg-white border border-gray-200 rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold text-gray-700">하단 추이 · 선택 KPI</span>
                <span className="text-[11px] text-gray-500">{PERIOD_LABEL[analyticsPeriod]}</span>
              </div>
              <div style={{ height: '250px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trendData} margin={{ top: 8, right: 8, left: -10, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                    <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip
                      formatter={(value: number, key) => {
                        if (selectedKpiKey === 'regionalQueueRisk') return `${Math.round(Number(value))}점`;
                        return `${Number(value).toFixed(1)}%`;
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: '12px' }} />
                    <Area type="monotone" dataKey="regional" fill={`${selectedKpiDef.color}20`} stroke="none" name="광역" />
                    <Line type="monotone" dataKey="regional" stroke={selectedKpiDef.color} strokeWidth={2.5} dot={{ r: 2.5 }} name="광역" />
                    <Line type="monotone" dataKey="national" stroke="#64748b" strokeDasharray="5 3" strokeWidth={2} dot={{ r: 2 }} name="전국 참고" />
                    {selectedDistrictData && (
                      <Line type="monotone" dataKey="district" stroke="#ef4444" strokeWidth={2.2} dot={{ r: 2 }} name={selectedDistrictData.name} />
                    )}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
              <button
                onClick={() => setShowBottomTable((prev) => !prev)}
                className="w-full px-3 py-2 flex items-center justify-between hover:bg-gray-50"
              >
                <span className="text-sm font-semibold text-gray-700">운영 우선순위 테이블</span>
                {showBottomTable ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
              </button>

              {showBottomTable && (
                <div className="px-3 pb-3 border-t border-gray-100 overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200">
                        {OPS_TABLE_COLUMNS.map((col) => (
                          <th key={col.key} className={`px-2 py-1.5 font-medium text-gray-600 whitespace-nowrap ${col.align === 'right' ? 'text-right' : 'text-left'}`}>
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
                          <td className="px-2 py-1.5 text-right font-medium text-orange-700">{row.priorityScore.toFixed(3)}</td>
                          <td className={`px-2 py-1.5 text-right font-medium ${row.nationalDelta >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                            {row.nationalDelta > 0 ? '+' : ''}
                            {selectedKpiKey === 'regionalQueueRisk'
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

            <button
              onClick={() => onNavigateToBottleneck?.()}
              className="w-full flex items-center gap-2 p-2 rounded-md hover:bg-orange-50 transition-colors text-left border border-orange-200 bg-white"
            >
              <AlertTriangle className="h-4 w-4 text-orange-500 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-medium text-gray-900">병목 분석 바로가기</div>
                <div className="text-[12px] text-gray-500">큐 적체 · 재접촉 · 배치 우선순위 조치</div>
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
