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

export type Charts = {
  pieSla: { name: string; value: number }[];
  pieData: { name: string; value: number }[];
  barKpi: { name: string; value: number }[];
  barLoadByCenter: { name: string; value: number }[];
  weeklyTrend: { week: string; throughput: number; slaRate: number }[];
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

  const weeklyTrend = Array.from({ length: 12 }).map((_, idx) => {
    const throughput = Math.round(600 + rnd() * 700 + idx * 40);
    const slaRate = clamp(1 + rnd() * 6, 0.5, 9);
    return {
      week: `W${idx + 1}`,
      throughput,
      slaRate: Number(slaRate.toFixed(2))
    };
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
    weeklyTrend
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
