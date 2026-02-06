import { MOCK_GEOJSON, SIDO_OPTIONS, SIGUNGU_OPTIONS } from './mockGeo';

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

export type Charts = {
  pieSla: { name: string; value: number }[];
  pieData: { name: string; value: number }[];
  barKpi: { name: string; value: number }[];
  barLoadByCenter: { name: string; value: number }[];
  weeklyTrend: WeeklyTrendItem[];
  riskMatrix: RiskMatrixPoint[];
  stageByRegion: StageByRegion[];
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

  const centers = SIDO_OPTIONS.filter((item) => item.code !== 'all').slice(0, 8);
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

  const regions = SIDO_OPTIONS.filter((item) => item.code !== 'all');
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
    stageByRegion
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
