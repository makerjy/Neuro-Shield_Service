import {
  findSigunguByEmd,
  getEmdOptions,
  getSigunguOptions,
  REGIONAL_SCOPE
} from './mockRegionalGeo';

export type RegionLevel = 'regional' | 'sigungu' | 'eupmyeondong';

export type RegionKey = {
  level: RegionLevel;
  regionId: string;
  name: string;
};

export type KPI = {
  contactSuccessRate: number;
  consultCompletionRate: number;
  linkageRate: number;
  dropoutRate: number;
  recontactSuccessRate: number;
  avgWaitTimeSec: number;
  avgConsultTimeSec: number;
  wowDelta: {
    contactSuccessRate: number;
    consultCompletionRate: number;
    linkageRate: number;
    dropoutRate: number;
    recontactSuccessRate: number;
    avgWaitTimeSec: number;
    avgConsultTimeSec: number;
  };
};

export type AlertItem = {
  id: string;
  ts: string;
  regionName: string;
  metric: string;
  severity: 'info' | 'warn' | 'critical';
  message: string;
};

export type MapMetric = {
  regionId: string;
  anomalyScore: number;
  dropoutRate: number;
  avgWaitTimeSec: number;
};

export type Charts = {
  pieContact: { name: string; value: number }[];
  pieConsult: { name: string; value: number }[];
  barMetrics: { name: string; value: number }[];
  barTopRegions: { name: string; value: number }[];
  trend: { t: string; waitMin: number; dropoutRate: number }[];
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

const baseRng = (region: RegionKey) => {
  const tick = Math.floor(Date.now() / 5000);
  const seed = hash(`${region.level}-${region.regionId}-${tick}`);
  return seeded(seed);
};

const makeKpi = (region: RegionKey): KPI => {
  const rnd = baseRng(region);
  const contact = clamp(82 + rnd() * 12, 70, 98);
  const consult = clamp(75 + rnd() * 18, 65, 98);
  const linkage = clamp(55 + rnd() * 30, 40, 90);
  const dropout = clamp(4 + rnd() * 9, 2, 14);
  const recontact = clamp(60 + rnd() * 25, 45, 95);
  const wait = clamp(180 + rnd() * 280, 90, 600);
  const consultTime = clamp(900 + rnd() * 900, 480, 2400);

  return {
    contactSuccessRate: Number(contact.toFixed(1)),
    consultCompletionRate: Number(consult.toFixed(1)),
    linkageRate: Number(linkage.toFixed(1)),
    dropoutRate: Number(dropout.toFixed(1)),
    recontactSuccessRate: Number(recontact.toFixed(1)),
    avgWaitTimeSec: Math.round(wait),
    avgConsultTimeSec: Math.round(consultTime),
    wowDelta: {
      contactSuccessRate: Number((rnd() * 4 - 2).toFixed(1)),
      consultCompletionRate: Number((rnd() * 4 - 2).toFixed(1)),
      linkageRate: Number((rnd() * 4 - 2).toFixed(1)),
      dropoutRate: Number((rnd() * 3 - 1.5).toFixed(1)),
      recontactSuccessRate: Number((rnd() * 4 - 2).toFixed(1)),
      avgWaitTimeSec: Math.round(rnd() * 80 - 40),
      avgConsultTimeSec: Math.round(rnd() * 120 - 60)
    }
  };
};

const resolveRegionList = (region: RegionKey) => {
  if (region.level === 'regional') {
    return getSigunguOptions();
  }
  if (region.level === 'sigungu') {
    return getEmdOptions(region.regionId);
  }
  const parent = findSigunguByEmd(region.regionId);
  return parent ? getEmdOptions(parent) : getSigunguOptions();
};

const makeMapMetrics = (region: RegionKey): MapMetric[] => {
  const rnd = baseRng(region);
  const list = resolveRegionList(region);
  return list.map((item) => {
    const anomalyScore = clamp(30 + rnd() * 70, 10, 98);
    const dropoutRate = clamp(3 + rnd() * 10, 2, 14);
    const wait = clamp(180 + rnd() * 280, 90, 600);
    return {
      regionId: item.code,
      anomalyScore: Number(anomalyScore.toFixed(1)),
      dropoutRate: Number(dropoutRate.toFixed(1)),
      avgWaitTimeSec: Math.round(wait)
    };
  });
};

const makeCharts = (region: RegionKey, kpi: KPI, map: MapMetric[]): Charts => {
  const rnd = baseRng(region);
  const contactFail = clamp(100 - kpi.contactSuccessRate, 0, 100);
  const consultFail = clamp(100 - kpi.consultCompletionRate, 0, 100);

  const barMetrics = [
    { name: '접촉', value: Math.round(kpi.contactSuccessRate) },
    { name: '완료', value: Math.round(kpi.consultCompletionRate) },
    { name: '연계', value: Math.round(kpi.linkageRate) },
    { name: '이탈', value: Math.round(kpi.dropoutRate) },
    { name: '재접촉', value: Math.round(kpi.recontactSuccessRate) }
  ];

  const barTopRegions = [...map]
    .sort((a, b) => b.anomalyScore - a.anomalyScore)
    .slice(0, 6)
    .map((item) => ({ name: item.regionId, value: Math.round(item.anomalyScore) }));

  const trend = Array.from({ length: 12 }).map((_, idx) => {
    const waitMin = clamp(4 + rnd() * 8, 3, 15);
    const dropoutRate = clamp(3 + rnd() * 8, 2, 14);
    return {
      t: `W${idx + 1}`,
      waitMin: Number(waitMin.toFixed(1)),
      dropoutRate: Number(dropoutRate.toFixed(1))
    };
  });

  return {
    pieContact: [
      { name: '성공', value: Number(kpi.contactSuccessRate.toFixed(1)) },
      { name: '실패', value: Number(contactFail.toFixed(1)) }
    ],
    pieConsult: [
      { name: '완료', value: Number(kpi.consultCompletionRate.toFixed(1)) },
      { name: '미완료', value: Number(consultFail.toFixed(1)) }
    ],
    barMetrics,
    barTopRegions,
    trend
  };
};

let alertSeq = 1;
const alertStore: AlertItem[] = [];

const addAlert = (alert: AlertItem) => {
  alertStore.unshift(alert);
  if (alertStore.length > 20) alertStore.pop();
};

const initAlerts = () => {
  if (alertStore.length >= 10) return;
  for (let i = 0; i < 12; i += 1) {
    addAlert({
      id: `seed-${alertSeq++}`,
      ts: new Date(Date.now() - i * 3600 * 1000).toISOString(),
      regionName: REGIONAL_SCOPE.label,
      metric: 'dropoutRate',
      severity: i % 3 === 0 ? 'critical' : i % 2 === 0 ? 'warn' : 'info',
      message: i % 2 === 0 ? '이탈률 상승' : '대기시간 증가'
    });
  }
};

const buildAlertMessage = (metric: string, severity: AlertItem['severity']) => {
  if (metric === 'dropoutRate') return severity === 'critical' ? '이탈률 급증' : '이탈률 상승';
  if (metric === 'avgWaitTimeSec') return severity === 'critical' ? '대기시간 급증' : '대기시간 증가';
  if (metric === 'contactSuccessRate') return '접촉 성공률 하락';
  if (metric === 'consultCompletionRate') return '상담 완료율 하락';
  return '이상 징후 감지';
};

export async function fetchRegionalDashboard(regionKey: RegionKey): Promise<{ kpi: KPI; alerts: AlertItem[]; map: MapMetric[]; charts: Charts }> {
  await delay(350);
  initAlerts();
  const kpi = makeKpi(regionKey);
  const map = makeMapMetrics(regionKey);
  const charts = makeCharts(regionKey, kpi, map);

  const highest = map[0];
  if (highest && highest.anomalyScore >= 70) {
    addAlert({
      id: `auto-${alertSeq++}`,
      ts: new Date().toISOString(),
      regionName: regionKey.name,
      metric: 'anomalyScore',
      severity: 'critical',
      message: '이상 점수 상승'
    });
  }

  if (kpi.dropoutRate >= 8) {
    addAlert({
      id: `auto-${alertSeq++}`,
      ts: new Date().toISOString(),
      regionName: regionKey.name,
      metric: 'dropoutRate',
      severity: 'warn',
      message: buildAlertMessage('dropoutRate', 'warn')
    });
  }

  if (kpi.avgWaitTimeSec >= 300) {
    addAlert({
      id: `auto-${alertSeq++}`,
      ts: new Date().toISOString(),
      regionName: regionKey.name,
      metric: 'avgWaitTimeSec',
      severity: 'warn',
      message: buildAlertMessage('avgWaitTimeSec', 'warn')
    });
  }

  return { kpi, alerts: alertStore.slice(0, 12), map, charts };
}

const makeSquare = (id: string, label: string, x: number, y: number) => ({
  type: 'Feature',
  id,
  properties: { code: id, name: label },
  geometry: {
    type: 'Polygon',
    coordinates: [
      [
        [x, y],
        [x + 1, y],
        [x + 1, y + 1],
        [x, y + 1],
        [x, y]
      ]
    ]
  }
});

export async function fetchGeoJSON(regionKey: RegionKey, level: RegionLevel) {
  await delay(200);
  if (level === 'sigungu') {
    const features = getSigunguOptions().map((item, idx) => makeSquare(item.code, item.label, idx, 0));
    return { type: 'FeatureCollection', features };
  }
  const sigCode = regionKey.level === 'sigungu' ? regionKey.regionId : findSigunguByEmd(regionKey.regionId) ?? getSigunguOptions()[0]?.code;
  const emdList = sigCode ? getEmdOptions(sigCode) : [];
  const features = emdList.map((item, idx) => makeSquare(item.code, item.label, idx, 1));
  return { type: 'FeatureCollection', features };
}
