import { MOCK_GEOJSON, SIDO_OPTIONS, SIGUNGU_OPTIONS } from './mockGeo';
import type {
  CentralKpiKey,
  CentralKpiSummary,
  CentralRegionMetric,
  CentralKpiChartData,
  CentralDashboardData,
} from '../lib/centralKpiTheme';
import { CENTRAL_KPI_KEYS } from '../lib/centralKpiTheme';

export type RegionLevel = 'nation' | 'sido' | 'sigungu';

export type RegionKey = {
  level: RegionLevel;
  sidoCode?: string;
  sigunguCode?: string;
  name: string;
};

export type KPI = {
  throughputNow: number;
  slaViolationRateNow: number;
  dataShortageRateNow: number;
  activeIncidentsNow: number;
  activeIncidentsWoW: number;
};

export type MapMetric = {
  regionId: string;
  loadScore: number;
  riskGrade: 'normal' | 'warn' | 'critical';
};

export type RiskMatrixPoint = {
  regionId: string;
  regionName: string;
  slaRate: number;
  dataRate: number;
  totalCases: number;
};

export type StageByRegion = {
  regionName: string;
  incoming: number;
  inProgress: number;
  needRecontact: number;
  slaBreach: number;
  completed: number;
};

export type WeeklyTrendItem = {
  week: string;
  throughput: number;
  slaRate: number;
  changeRate: number;
};

export type AgeRiskItem = {
  ageGroup: string;
  slaViolation: number;
  recontactNeed: number;
};

export type Charts = {
  pieSla: { name: string; value: number }[];
  pieData: { name: string; value: number }[];
  barKpi: { name: string; value: number }[];
  barLoadByCenter: { name: string; value: number }[];
  weeklyTrend: WeeklyTrendItem[];
  riskMatrix: RiskMatrixPoint[];
  stageByRegion: StageByRegion[];
  ageRisk: AgeRiskItem[];
};

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const hash = (input: string) => {
  let result = 0;
  for (let i = 0; i < input.length; i += 1) {
    result = (result << 5) - result + input.charCodeAt(i);
    result |= 0;
  }
  return Math.abs(result);
};

const seeded = (seed: number) => {
  let value = seed % 2147483647;
  if (value <= 0) value += 2147483646;
  return () => {
    value = (value * 16807) % 2147483647;
    return (value - 1) / 2147483646;
  };
};

const makeBase = (region: RegionKey) => {
  const tick = Math.floor(Date.now() / 5000);
  const seed = hash(`${region.level}-${region.sidoCode ?? ''}-${region.sigunguCode ?? ''}-${tick}`);
  return seeded(seed);
};

const makeKpi = (region: RegionKey): KPI => {
  const rnd = makeBase(region);
  const throughput = clamp(8000 + rnd() * 12000, 3000, 32000);
  const slaViolation = clamp(1 + rnd() * 6, 0.5, 9);
  const dataShortage = clamp(1 + rnd() * 8, 0.5, 12);
  const activeIncidents = Math.round(clamp(3 + rnd() * 25, 2, 40));
  const wow = clamp(-8 + rnd() * 16, -12, 12);
  return {
    throughputNow: Math.round(throughput),
    slaViolationRateNow: Number(slaViolation.toFixed(2)),
    dataShortageRateNow: Number(dataShortage.toFixed(2)),
    activeIncidentsNow: activeIncidents,
    activeIncidentsWoW: Number(wow.toFixed(1))
  };
};

const makeMapMetrics = (region: RegionKey): MapMetric[] => {
  const rnd = makeBase(region);
  const list = region.level === 'nation'
    ? SIDO_OPTIONS.filter((item) => item.code !== 'all')
    : region.level === 'sido'
      ? (SIGUNGU_OPTIONS[region.sidoCode ?? ''] ?? [])
      : (SIGUNGU_OPTIONS[region.sidoCode ?? ''] ?? []);

  return list.map((item) => {
    const load = clamp(30 + rnd() * 70, 10, 100);
    const riskGrade = load >= 85 ? 'critical' : load >= 65 ? 'warn' : 'normal';
    return {
      regionId: item.code,
      loadScore: Number(load.toFixed(1)),
      riskGrade
    };
  });
};

const makeCharts = (region: RegionKey, kpi: KPI): Charts => {
  const rnd = makeBase(region);
  const slaNormal = clamp(100 - kpi.slaViolationRateNow, 0, 100);
  const dataOk = clamp(100 - kpi.dataShortageRateNow, 0, 100);

  const barKpi = [
    { name: '처리', value: Math.round(40 + rnd() * 60) },
    { name: '지연', value: Math.round(10 + rnd() * 30) },
    { name: '대기', value: Math.round(15 + rnd() * 35) },
    { name: '오류', value: Math.round(5 + rnd() * 20) },
    { name: '품질', value: Math.round(20 + rnd() * 40) }
  ];

  const centers = region.level === 'nation'
    ? SIDO_OPTIONS.filter((item) => item.code !== 'all').slice(0, 8)
    : region.level === 'sido' && region.sidoCode
      ? (SIGUNGU_OPTIONS[region.sidoCode] ?? []).slice(0, 8)
      : SIDO_OPTIONS.filter((item) => item.code !== 'all').slice(0, 8);
  const barLoadByCenter = centers.map((center) => ({
    name: center.label,
    value: Math.round(30 + rnd() * 70)
  }));

  const weeklyTrend: WeeklyTrendItem[] = Array.from({ length: 12 }).map((_, idx) => {
    const throughput = Math.round(600 + rnd() * 700 + idx * 40);
    const slaRate = clamp(1 + rnd() * 6, 0.5, 9);
    const changeRate = idx === 0 ? 0 : Number(((-15 + rnd() * 30)).toFixed(1));
    return {
      week: `W${idx + 1}`,
      throughput,
      slaRate: Number(slaRate.toFixed(2)),
      changeRate
    };
  });

  // 드릴다운 레벨에 따라 하위 지역 목록 결정
  const regions = region.level === 'nation'
    ? SIDO_OPTIONS.filter((item) => item.code !== 'all')
    : region.level === 'sido' && region.sidoCode
      ? (SIGUNGU_OPTIONS[region.sidoCode] ?? [])
      : SIDO_OPTIONS.filter((item) => item.code !== 'all');
  const riskMatrix: RiskMatrixPoint[] = regions.map((r) => ({
    regionId: r.code,
    regionName: r.label,
    slaRate: Number(clamp(85 + rnd() * 15, 78, 100).toFixed(1)),
    dataRate: Number(clamp(82 + rnd() * 18, 75, 100).toFixed(1)),
    totalCases: Math.round(200 + rnd() * 3000)
  }));

  const stageByRegion: StageByRegion[] = regions.map((r) => {
    const total = Math.round(500 + rnd() * 2500);
    const completed = Math.round(total * (0.4 + rnd() * 0.3));
    const inProgress = Math.round(total * (0.1 + rnd() * 0.15));
    const incoming = Math.round(total * (0.05 + rnd() * 0.1));
    const slaBreach = Math.round(total * (0.01 + rnd() * 0.05));
    const needRecontact = Math.max(0, total - completed - inProgress - incoming - slaBreach);
    return { regionName: r.label, incoming, inProgress, needRecontact, slaBreach, completed };
  });

  const ageGroups = ['10대', '20대', '30대', '40대', '50대', '60대', '70대+'];
  const ageRisk: AgeRiskItem[] = ageGroups.map((ag) => ({
    ageGroup: ag,
    slaViolation: Number(clamp(1 + rnd() * 12, 0.5, 15).toFixed(1)),
    recontactNeed: Number(clamp(2 + rnd() * 18, 1, 22).toFixed(1))
  }));

  return {
    pieSla: [
      { name: '정상', value: Number(slaNormal.toFixed(2)) },
      { name: '위반', value: Number(kpi.slaViolationRateNow.toFixed(2)) }
    ],
    pieData: [
      { name: '충분', value: Number(dataOk.toFixed(2)) },
      { name: '부족', value: Number(kpi.dataShortageRateNow.toFixed(2)) }
    ],
    barKpi,
    barLoadByCenter,
    weeklyTrend,
    riskMatrix,
    stageByRegion,
    ageRisk
  };
};

export async function fetchDashboard(regionKey: RegionKey): Promise<{ kpi: KPI; map: MapMetric[]; charts: Charts }> {
  await delay(350);
  const kpi = makeKpi(regionKey);
  const map = makeMapMetrics(regionKey);
  const charts = makeCharts(regionKey, kpi);
  return { kpi, map, charts };
}

export async function fetchGeoJSON(level: RegionLevel, regionKey?: RegionKey) {
  await delay(200);
  if (level === 'nation') return MOCK_GEOJSON.nation;
  if (level === 'sido') return MOCK_GEOJSON.sido;
  if (level === 'sigungu') {
    if (regionKey?.sidoCode) {
      const base = MOCK_GEOJSON.sigungu as any;
      return {
        ...base,
        features: base.features.filter((feature: any) => String(feature.id).startsWith(regionKey.sidoCode as string))
      };
    }
    return MOCK_GEOJSON.sigungu;
  }
  return MOCK_GEOJSON.nation;
}

/* ═══════════════════════════════════════════════════════════════════════════
   중앙 전국운영대시보드 — 5 KPI 전용 Mock
═══════════════════════════════════════════════════════════════════════════ */

const makeCentralKpiSummary = (rnd: () => number): CentralKpiSummary[] => [
  {
    key: "signalQuality",
    value: Number(clamp(86 + rnd() * 10, 80, 98).toFixed(1)),
    delta: Number((-3 + rnd() * 6).toFixed(1)),
    sub1Label: "중복률",
    sub1Value: `${clamp(2 + rnd() * 5, 1, 8).toFixed(1)}%`,
    sub2Label: "철회률",
    sub2Value: `${clamp(0.5 + rnd() * 3, 0.2, 4).toFixed(1)}%`,
  },
  {
    key: "policyImpact",
    value: Number(clamp(15 + rnd() * 50, 5, 85).toFixed(1)),
    delta: Number((-10 + rnd() * 20).toFixed(1)),
    sub1Label: "롤백 횟수",
    sub1Value: `${Math.round(rnd() * 4)}건`,
    sub2Label: "경고 지역",
    sub2Value: `${Math.round(1 + rnd() * 6)}개`,
  },
  {
    key: "bottleneckRisk",
    value: Number(clamp(20 + rnd() * 50, 10, 90).toFixed(1)),
    delta: Number((-8 + rnd() * 16).toFixed(1)),
    sub1Label: "SLA 위반",
    sub1Value: `${clamp(1 + rnd() * 6, 0.5, 9).toFixed(1)}%`,
    sub2Label: "L2 적체",
    sub2Value: `${Math.round(30 + rnd() * 200)}건`,
  },
  {
    key: "dataReadiness",
    value: Number(clamp(85 + rnd() * 12, 78, 99).toFixed(1)),
    delta: Number((-2 + rnd() * 4).toFixed(1)),
    sub1Label: "필수필드 충족",
    sub1Value: `${clamp(88 + rnd() * 10, 82, 99).toFixed(1)}%`,
    sub2Label: "연계 미완료",
    sub2Value: `${clamp(1 + rnd() * 8, 0.5, 10).toFixed(1)}%`,
  },
  {
    key: "governanceSafety",
    value: Number(clamp(88 + rnd() * 10, 82, 99).toFixed(1)),
    delta: Number((-2 + rnd() * 4).toFixed(1)),
    sub1Label: "책임자 누락",
    sub1Value: `${clamp(0.5 + rnd() * 4, 0.2, 5).toFixed(1)}%`,
    sub2Label: "설명근거 미첨부",
    sub2Value: `${clamp(1 + rnd() * 6, 0.5, 8).toFixed(1)}%`,
  },
];

const makeCentralRegionMetrics = (
  rnd: () => number,
  regionKey: RegionKey
): Record<CentralKpiKey, CentralRegionMetric[]> => {
  // 드릴다운 레벨에 따라 하위 지역 목록 결정
  const regions =
    regionKey.level === 'nation'
      ? SIDO_OPTIONS.filter((s) => s.code !== "all")
      : regionKey.level === 'sido' && regionKey.sidoCode
        ? (SIGUNGU_OPTIONS[regionKey.sidoCode] ?? [])
        : SIDO_OPTIONS.filter((s) => s.code !== "all");

  const result: Record<string, CentralRegionMetric[]> = {};

  const ranges: Record<CentralKpiKey, [number, number]> = {
    signalQuality: [78, 98],
    policyImpact: [5, 85],
    bottleneckRisk: [10, 90],
    dataReadiness: [75, 99],
    governanceSafety: [80, 99],
  };

  for (const key of CENTRAL_KPI_KEYS) {
    const [lo, hi] = ranges[key];
    result[key] = regions.map((r) => ({
      regionCode: r.code,
      regionName: r.label,
      value: Number(clamp(lo + rnd() * (hi - lo), lo, hi).toFixed(1)),
    }));
  }
  return result as Record<CentralKpiKey, CentralRegionMetric[]>;
};

const makeCentralChartData = (
  rnd: () => number
): Record<CentralKpiKey, CentralKpiChartData> => {
  const trend12 = (base: number, scale: number) =>
    Array.from({ length: 12 }, (_, i) => ({
      period: `W${i + 1}`,
      value: Number(clamp(base + rnd() * scale - scale / 3, base - scale / 2, base + scale / 2).toFixed(1)),
      delta: Number((-5 + rnd() * 10).toFixed(1)),
    }));

  return {
    signalQuality: {
      definitionLine: "유효 신호 비율: 행정적으로 활용 가능한 신호의 비율",
      lastUpdated: new Date().toLocaleString("ko-KR"),
      decomposition: [
        { name: "유효", value: Number((75 + rnd() * 15).toFixed(1)), color: "#2563eb" },
        { name: "중복", value: Number((3 + rnd() * 6).toFixed(1)), color: "#f59e0b" },
        { name: "철회", value: Number((1 + rnd() * 4).toFixed(1)), color: "#ef4444" },
        { name: "무효", value: Number((1 + rnd() * 3).toFixed(1)), color: "#94a3b8" },
      ],
      decompositionType: "donut",
      causeDistribution: [
        { name: "중복 접수", value: Math.round(20 + rnd() * 30) },
        { name: "기간 만료", value: Math.round(10 + rnd() * 20) },
        { name: "데이터 오류", value: Math.round(5 + rnd() * 15) },
        { name: "대상자 철회", value: Math.round(3 + rnd() * 12) },
        { name: "기타", value: Math.round(2 + rnd() * 8) },
      ],
      causeType: "bar",
      trend: trend12(91, 8),
    },
    policyImpact: {
      definitionLine: "정책/규칙 변경이 현장 흐름에 미친 변동 수준(정규화 스코어)",
      lastUpdated: new Date().toLocaleString("ko-KR"),
      decomposition: [
        { name: "연령 기준 변경", value: Number((10 + rnd() * 25).toFixed(1)), color: "#7c3aed" },
        { name: "SLA 기준 변경", value: Number((5 + rnd() * 20).toFixed(1)), color: "#a855f7" },
        { name: "데이터 규칙 변경", value: Number((3 + rnd() * 15).toFixed(1)), color: "#c084fc" },
        { name: "우선순위 변경", value: Number((2 + rnd() * 10).toFixed(1)), color: "#d8b4fe" },
      ],
      decompositionType: "stackedBar",
      causeDistribution: [
        { name: "연령 기준", value: Math.round(25 + rnd() * 30) },
        { name: "SLA 임계", value: Math.round(15 + rnd() * 25) },
        { name: "데이터 기준", value: Math.round(10 + rnd() * 20) },
        { name: "경로 규칙", value: Math.round(5 + rnd() * 15) },
      ],
      causeType: "bar",
      trend: trend12(35, 30),
    },
    bottleneckRisk: {
      definitionLine: "SLA 위반·적체·재접촉 필요의 가중합 (0-100 스케일)",
      lastUpdated: new Date().toLocaleString("ko-KR"),
      decomposition: [
        { name: "신규→처리중", value: Number((5 + rnd() * 15).toFixed(1)), color: "#2563eb" },
        { name: "처리중→재접촉", value: Number((8 + rnd() * 20).toFixed(1)), color: "#f59e0b" },
        { name: "재접촉→L2", value: Number((3 + rnd() * 12).toFixed(1)), color: "#ef4444" },
        { name: "L2→완료", value: Number((2 + rnd() * 8).toFixed(1)), color: "#dc2626" },
      ],
      decompositionType: "stackedBar",
      causeDistribution: [
        { name: "60대", value: Number((15 + rnd() * 20).toFixed(1)) },
        { name: "70대+", value: Number((20 + rnd() * 25).toFixed(1)) },
        { name: "50대", value: Number((10 + rnd() * 15).toFixed(1)) },
        { name: "40대", value: Number((5 + rnd() * 12).toFixed(1)) },
        { name: "30대 이하", value: Number((3 + rnd() * 8).toFixed(1)) },
      ],
      causeType: "heatBar",
      trend: trend12(42, 25),
    },
    dataReadiness: {
      definitionLine: "필수 데이터 기준을 충족하는 케이스 비율",
      lastUpdated: new Date().toLocaleString("ko-KR"),
      decomposition: [
        { name: "건강검진", value: Number((90 + rnd() * 8).toFixed(1)), color: "#059669" },
        { name: "문진 응답", value: Number((82 + rnd() * 12).toFixed(1)), color: "#34d399" },
        { name: "행정정보", value: Number((88 + rnd() * 10).toFixed(1)), color: "#6ee7b7" },
        { name: "과거 이력", value: Number((75 + rnd() * 18).toFixed(1)), color: "#a7f3d0" },
        { name: "연계 결과", value: Number((70 + rnd() * 20).toFixed(1)), color: "#d1fae5" },
      ],
      decompositionType: "stackedBar",
      causeDistribution: [
        { name: "미수집", value: Math.round(30 + rnd() * 25) },
        { name: "형식 오류", value: Math.round(15 + rnd() * 15) },
        { name: "연계 지연", value: Math.round(10 + rnd() * 20) },
        { name: "중복 값", value: Math.round(5 + rnd() * 10) },
        { name: "기타", value: Math.round(3 + rnd() * 8) },
      ],
      causeType: "donut",
      trend: trend12(91, 8),
    },
    governanceSafety: {
      definitionLine: "감사·민원 대응 시 필수 근거가 확보된 비율",
      lastUpdated: new Date().toLocaleString("ko-KR"),
      decomposition: [
        { name: "로그 누락", value: Number((2 + rnd() * 5).toFixed(1)), color: "#d97706" },
        { name: "설명근거 미첨부", value: Number((3 + rnd() * 6).toFixed(1)), color: "#f59e0b" },
        { name: "책임자 미지정", value: Number((1 + rnd() * 4).toFixed(1)), color: "#fbbf24" },
        { name: "검토 미완료", value: Number((1 + rnd() * 3).toFixed(1)), color: "#fcd34d" },
      ],
      decompositionType: "donut",
      causeDistribution: [
        { name: "서울", value: Number((0.5 + rnd() * 3).toFixed(1)) },
        { name: "경기", value: Number((1 + rnd() * 4).toFixed(1)) },
        { name: "부산", value: Number((0.8 + rnd() * 3).toFixed(1)) },
        { name: "대구", value: Number((0.5 + rnd() * 3).toFixed(1)) },
        { name: "인천", value: Number((0.3 + rnd() * 2).toFixed(1)) },
      ],
      causeType: "lineRank",
      trend: trend12(93, 6),
    },
  };
};

export async function fetchCentralDashboard(
  regionKey: RegionKey
): Promise<CentralDashboardData> {
  await delay(350);
  const rnd = makeBase(regionKey);
  return {
    kpiSummaries: makeCentralKpiSummary(rnd),
    regionMetrics: makeCentralRegionMetrics(rnd, regionKey),
    chartData: makeCentralChartData(rnd),
  };
}
