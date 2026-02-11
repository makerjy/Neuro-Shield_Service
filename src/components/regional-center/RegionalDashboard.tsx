import React, { useMemo, useState, useCallback, useRef, useEffect } from 'react';
import { Download, HelpCircle, ChevronLeft, ChevronRight, Home, Info, AlertTriangle, BarChart3, TrendingUp, ChevronDown, ChevronUp, Activity, Shield, ExternalLink } from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell,
  Line, LineChart, Area,
  Legend, Treemap, ReferenceLine,
  ScatterChart, Scatter, ZAxis, Brush,
} from 'recharts';
import { GeoMapPanel, type MapColorScheme } from '../geomap/GeoMapPanel';
import { COLOR_PALETTES } from '../../lib/choroplethScale';
import type { RegionalScope } from '../geomap/regions';
import {
  REGIONAL_TOP_KPIS, REGIONAL_TREND_KPIS,
  OPS_STAGE_KEYS, OPS_STAGE_META, OPS_TABLE_COLUMNS,
  computeRiskScore, loadRegionalSettings,
  OPS_TO_GEO_INDICATOR, OPS_COLOR_SCHEME,
  type RegionalKpiKey, type OpsStageKey,
} from '../../lib/regionalKpiDictionary';

/* ═══════════════════════════════════════════════════════════════
   ResizeObserver hook (inlined — same as NationalDashboard)
═══════════════════════════════════════════════════════════════ */
function useResizeObserver<T extends HTMLElement>(): [React.RefObject<T | null>, { width: number; height: number }] {
  const ref = useRef<T | null>(null);
  const [size, setSize] = useState({ width: typeof window !== 'undefined' ? window.innerWidth : 1920, height: typeof window !== 'undefined' ? window.innerHeight : 1080 });
  const rafRef = useRef<number | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => {
        const r = el.getBoundingClientRect();
        setSize(prev => prev.width === r.width && prev.height === r.height ? prev : { width: r.width, height: r.height });
      });
    };
    const obs = new ResizeObserver(update);
    obs.observe(el);
    window.addEventListener('resize', update, { passive: true });
    update();
    return () => { obs.disconnect(); window.removeEventListener('resize', update); if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, []);
  return [ref, size];
}

/* ═══════════════════════════════════════════════════════════════
   Utilities (deterministic mock data)
═══════════════════════════════════════════════════════════════ */
const hashSeed = (input: string) => { let h = 0; for (let i = 0; i < input.length; i++) h = (h * 31 + input.charCodeAt(i)) >>> 0; return h; };
const seededValue = (seed: string, min: number, max: number) => min + (max - min) * ((hashSeed(seed) % 1000) / 1000);
const sv = seededValue;

/* ═══════════════════════════════════════════════════════════════
   Top KPI card data (case_id basis, settings-aware)
═══════════════════════════════════════════════════════════════ */
type TopKpiCardData = {
  kpiKey: RegionalKpiKey; label: string; shortLabel: string; tooltip: string;
  unit: string; iconBg: string; color: string; mapColorScheme: string;
  count: number; rate?: number; invertColor?: boolean;
};

function generateTopKpis(scopeKey: string, period: string, longWaitDays: number): TopKpiCardData[] {
  const mul = period === 'week' ? 1 : period === 'month' ? 4.2 : 13;
  return REGIONAL_TOP_KPIS.filter(k => k.defaultVisible).map(kpi => {
    const base = sv(`${scopeKey}-${period}-${kpi.kpiKey}`, 10, 300);
    const count = Math.round(base * mul);
    const totalActive = Math.round(sv(`${scopeKey}-${period}-total-active`, 200, 800) * mul);
    const rate = totalActive > 0 ? Number(((count / totalActive) * 100).toFixed(1)) : 0;
    const tooltipFull = `${kpi.tooltip}\n장기 대기 기준: ${longWaitDays}일`;
    return {
      kpiKey: kpi.kpiKey as RegionalKpiKey, label: kpi.label, shortLabel: kpi.shortLabel,
      tooltip: kpi.kpiKey === 'ops_long_wait' ? tooltipFull : kpi.tooltip,
      unit: kpi.unit, iconBg: kpi.iconBg, color: kpi.color,
      mapColorScheme: OPS_COLOR_SCHEME[kpi.kpiKey] || 'blue',
      count, rate: kpi.unit === '건' ? rate : undefined, invertColor: kpi.invertColor,
    };
  });
}

/* ═══════════════════════════════════════════════════════════════
   KPI Trend Chart (ops KPIs) — internal component
═══════════════════════════════════════════════════════════════ */
type TrendKpiKey = 'ops_sla_rate' | 'ops_not_reached_rate' | 'ops_avg_wait_time' | 'ops_completion_rate';
const TREND_DEFS = REGIONAL_TREND_KPIS.map(k => ({
  key: k.kpiKey as TrendKpiKey, label: k.shortLabel, color: k.color,
  unit: k.unit, target: k.target, invertColor: k.invertColor,
}));

interface KPITrendChartProps { statsScopeKey: string; analyticsPeriod: 'week' | 'month' | 'quarter'; }

function KPITrendChart({ statsScopeKey, analyticsPeriod }: KPITrendChartProps) {
  const [enabledKeys, setEnabledKeys] = useState<TrendKpiKey[]>(['ops_sla_rate', 'ops_not_reached_rate', 'ops_completion_rate']);
  const [hoveredKey, setHoveredKey] = useState<TrendKpiKey | null>(null);
  const [brushRange, setBrushRange] = useState<{ startIndex?: number; endIndex?: number }>({});
  const toggleKey = useCallback((key: TrendKpiKey) => {
    setEnabledKeys(prev => prev.includes(key) ? prev.filter(k => k !== key) : prev.length >= 4 ? [...prev.slice(1), key] : [...prev, key]);
  }, []);
  const timeLabel = analyticsPeriod === 'week' ? '최근 7일' : analyticsPeriod === 'month' ? '최근 4주' : '분기별';
  const rawData = useMemo(() => {
    const pts = analyticsPeriod === 'week' ? 7 : 4;
    const labels = analyticsPeriod === 'week'
      ? ['월', '화', '수', '목', '금', '토', '일']
      : analyticsPeriod === 'month' ? ['1주', '2주', '3주', '4주'] : ['Q1', 'Q2', 'Q3', 'Q4'];
    return Array.from({ length: pts }, (_, i) => {
      const row: Record<string, string | number> = { date: labels[i] };
      TREND_DEFS.forEach(d => {
        const range = d.key === 'ops_avg_wait_time' ? [2, 10] : d.key === 'ops_not_reached_rate' ? [8, 28] : [65, 98];
        row[d.key] = Number(sv(`${statsScopeKey}-${analyticsPeriod}-trend-${d.key}-${i}`, range[0], range[1]).toFixed(1));
      });
      return row;
    });
  }, [statsScopeKey, analyticsPeriod]);
  useEffect(() => { setBrushRange({}); }, [analyticsPeriod, statsScopeKey]);
  const visible = useMemo(() => TREND_DEFS.filter(d => enabledKeys.includes(d.key)), [enabledKeys]);

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-3">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-gray-700">KPI 추이(운영)</span>
          <span className="text-[11px] px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded border border-blue-200">배정 케이스 기준</span>
        </div>
        <div className="flex items-center gap-2">
          {(brushRange.startIndex != null || brushRange.endIndex != null) && (
            <button onClick={() => setBrushRange({})} className="px-2 py-0.5 text-[12px] rounded bg-gray-100 text-gray-500 hover:text-gray-700">구간 리셋</button>
          )}
          <span className="text-[11px] text-gray-400">{timeLabel}</span>
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5 mb-2" role="group">
        {TREND_DEFS.map(def => {
          const isOn = enabledKeys.includes(def.key);
          return (
            <button key={def.key} role="switch" aria-checked={isOn}
              onClick={() => toggleKey(def.key)}
              onMouseEnter={() => setHoveredKey(def.key)} onMouseLeave={() => setHoveredKey(null)}
              className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-[12px] font-medium transition-all border ${isOn ? 'border-transparent shadow-sm' : 'border-gray-200 bg-white text-gray-400 hover:text-gray-600'}`}
              style={isOn ? { backgroundColor: `${def.color}15`, color: def.color, borderColor: `${def.color}40` } : undefined}>
              <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: isOn ? def.color : '#d1d5db' }} />
              <span>{def.label}</span>
              {isOn && <span className="text-[11px] opacity-60">{def.unit}</span>}
            </button>
          );
        })}
      </div>
      {visible.length === 0 && <div className="flex items-center justify-center h-[200px] text-sm text-gray-400">KPI를 1개 이상 선택하세요</div>}
      {visible.length > 0 && (
        <div style={{ height: '320px' }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={rawData} margin={{ top: 8, right: 12, left: -8, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
              <XAxis dataKey="date" tick={{ fontSize: 13, fill: '#6b7280' }} tickLine={false} axisLine={{ stroke: '#e5e7eb' }} />
              <YAxis tick={{ fontSize: 13, fill: '#9ca3af' }} tickLine={false} axisLine={false} width={32} />
              <Tooltip content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null;
                const sorted = [...payload].filter(p => !String(p.dataKey).endsWith('_prev')).sort((a, b) => Number(b.value) - Number(a.value));
                return (
                  <div className="bg-white border border-gray-200 rounded-lg p-2.5 shadow-xl text-xs min-w-[180px]">
                    <div className="font-semibold text-gray-800 mb-1.5 pb-1 border-b border-gray-100">{label}</div>
                    {sorted.map((p, i) => {
                      const d = TREND_DEFS.find(dd => dd.key === p.dataKey);
                      if (!d) return null;
                      return (
                        <div key={i} className="flex items-center justify-between gap-3 py-0.5">
                          <div className="flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: d.color }} />
                            <span className="text-gray-600">{d.label}</span>
                          </div>
                          <span className="font-semibold" style={{ color: d.color }}>{Number(p.value).toFixed(1)}{d.unit}</span>
                        </div>
                      );
                    })}
                    <div className="mt-1 pt-1 border-t border-gray-100 text-[11px] text-gray-400">운영 기준 · case_id 집계</div>
                  </div>
                );
              }} />
              {visible.filter(d => d.target != null).map(d => (
                <ReferenceLine key={`tgt-${d.key}`} y={d.target} stroke={d.color} strokeDasharray="6 3" strokeWidth={1.2} strokeOpacity={0.4} />
              ))}
              {visible.map(d => (
                <Area key={`a-${d.key}`} type="monotone" dataKey={d.key} fill={`${d.color}15`} stroke="none"
                  fillOpacity={hoveredKey === null || hoveredKey === d.key ? 1 : 0.1} connectNulls />
              ))}
              {visible.map(d => {
                const focused = hoveredKey === null || hoveredKey === d.key;
                return (
                  <Line key={d.key} type="monotone" dataKey={d.key} stroke={d.color}
                    strokeWidth={focused ? (hoveredKey === d.key ? 3 : 2) : 1} strokeOpacity={focused ? 1 : 0.15}
                    dot={(props: any) => {
                      const { cx, cy, index, dataKey } = props;
                      if (index === rawData.length - 1) {
                        return (<g key={`dot-${dataKey}-${index}`}><circle cx={cx} cy={cy} r={5} fill={d.color} stroke="#fff" strokeWidth={2} /><text x={cx} y={cy - 10} textAnchor="middle" fill={d.color} fontSize={10} fontWeight="700">{Number(rawData[index][d.key]).toFixed(1)}</text></g>);
                      }
                      return <g key={`dot-${dataKey}-${index}`} />;
                    }}
                    activeDot={{ r: 5, fill: d.color, stroke: '#fff', strokeWidth: 2 }} connectNulls />
                );
              })}
              <Brush dataKey="date" height={18} stroke="#94a3b8" fill="#f8fafc"
                startIndex={brushRange.startIndex} endIndex={brushRange.endIndex}
                onChange={(r: any) => setBrushRange({ startIndex: r?.startIndex, endIndex: r?.endIndex })} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
      <div className="flex items-center justify-center gap-4 mt-1 pt-1 border-t border-gray-100 flex-wrap">
        <div className="flex items-center gap-1 text-[12px] text-gray-400">
          <span className="w-4" style={{ borderTop: '2px dashed #9ca3af' }} /><span>목표선</span>
        </div>
        <span className="text-[12px] text-gray-400">최대 4개 · 칩 클릭으로 시리즈 제어</span>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Heatmap Treemap content renderer
═══════════════════════════════════════════════════════════════ */
const CustomTreemapContent = (props: any) => {
  const { x, y, width, height, name, fill } = props;
  if (!name || width < 25 || height < 18) return null;
  const shortName = name.length > 4 ? name.slice(0, 3) : name;
  return (
    <g>
      <rect x={x} y={y} width={width} height={height} fill={fill} stroke="#fff" strokeWidth={1.5} rx={2}
        style={{ filter: 'brightness(1.0)', transition: 'filter 0.2s' }} />
      {width > 35 && height > 25 && (
        <text x={x + width / 2} y={y + height / 2} textAnchor="middle" dominantBaseline="middle"
          fill="#fff" fontSize={width > 70 ? 10 : 8} fontWeight="600"
          style={{ textShadow: '0 1px 2px rgba(0,0,0,0.4)' }}>{shortName}</text>
      )}
    </g>
  );
};

/* ═══════════════════════════════════════════════════════════════
   Main Component: Regional Ops Dashboard
   Frame: 100% clone of NationalDashboard structure
═══════════════════════════════════════════════════════════════ */
interface RegionalDashboardProps {
  region: RegionalScope;
  onNavigateToBottleneck?: () => void;
}

export function RegionalDashboard({ region, onNavigateToBottleneck }: RegionalDashboardProps) {
  /* ── State ── */
  const [analyticsPeriod, setAnalyticsPeriod] = useState<'week' | 'month' | 'quarter'>('week');
  const [selectedMapKpiId, setSelectedMapKpiId] = useState<string>('ops_sla_breach');
  const [visualizationMode, setVisualizationMode] = useState<'geomap' | 'heatmap'>('geomap');
  const [containerRef, containerSize] = useResizeObserver<HTMLDivElement>();
  const [heatmapHover, setHeatmapHover] = useState<{ name: string; size: number; x: number; y: number } | null>(null);
  const [selectedDistrictName, setSelectedDistrictName] = useState<string | null>(null);
  const [tooltipTarget, setTooltipTarget] = useState<string | null>(null);
  const [showKpiSummaryTable, setShowKpiSummaryTable] = useState(false);
  const [mapSubRegions, setMapSubRegions] = useState<Array<{code: string; name: string; level: string}>>([]);
  const [mapDrillLevel, setMapDrillLevel] = useState<'ctprvn' | 'sig' | 'emd' | undefined>(undefined);
  const [mapDrillCode, setMapDrillCode] = useState<string | undefined>(undefined);

  /* ── Settings from localStorage (실시간 반영) ── */
  const settings = useMemo(() => loadRegionalSettings(region.id), [region.id]);

  /* ── Derived ── */
  useEffect(() => { setSelectedDistrictName(null); setMapDrillLevel(undefined); setMapDrillCode(undefined); }, [region.id]);
  const handleGoBack = useCallback(() => { setSelectedDistrictName(null); setMapDrillLevel('sig'); setMapDrillCode(region.ctprvnCode); }, [region.ctprvnCode]);
  const statsScopeKey = selectedDistrictName ? `${region.id}-${selectedDistrictName}` : region.id;
  const periodLabel = analyticsPeriod === 'week' ? '주간' : analyticsPeriod === 'month' ? '월간' : '분기';
  const layoutMode = useMemo(() => {
    const w = containerSize.width || (typeof window !== 'undefined' ? window.innerWidth : 1920);
    return w >= 1024 ? 'desktop' : w >= 768 ? 'tablet' : 'mobile';
  }, [containerSize.width]);

  /* ── Districts ── */
  const DISTRICTS = useMemo(() => {
    const m: Record<string, string[]> = {
      seoul: ['강남구','서초구','송파구','강동구','마포구','영등포구','용산구','종로구','중구','성동구','광진구','동대문구','중랑구','성북구','강북구','도봉구','노원구','은평구','서대문구','양천구','구로구','금천구','동작구','관악구','강서구'],
      busan: ['중구','서구','동구','영도구','부산진구','동래구','남구','북구','해운대구','사하구','금정구','강서구','연제구','수영구','사상구','기장군'],
      daegu: ['중구','동구','서구','남구','북구','수성구','달서구','달성군'],
      incheon: ['중구','동구','미추홀구','연수구','남동구','부평구','계양구','서구','강화군','옹진군'],
      gwangju: ['동구','서구','남구','북구','광산구'],
      daejeon: ['동구','중구','서구','유성구','대덕구'],
      ulsan: ['중구','남구','동구','북구','울주군'],
      sejong: ['세종시'],
      gyeonggi: ['수원시','성남시','고양시','용인시','부천시','안산시','안양시','남양주시','화성시','평택시','의정부시','시흥시','파주시','김포시','광명시','광주시','군포시','하남시','오산시','이천시'],
      gangwon: ['춘천시','원주시','강릉시','동해시','태백시','속초시','삼척시','홍천군','횡성군','영월군'],
      chungbuk: ['청주시','충주시','제천시','보은군','옥천군','영동군','증평군','진천군','괴산군','음성군'],
      chungnam: ['천안시','공주시','보령시','아산시','서산시','논산시','계룡시','당진시','금산군','부여군'],
      jeonbuk: ['전주시','군산시','익산시','정읍시','남원시','김제시','완주군','진안군','무주군','장수군'],
      jeonnam: ['목포시','여수시','순천시','나주시','광양시','담양군','곡성군','구례군','고흥군','보성군'],
      gyeongbuk: ['포항시','경주시','김천시','안동시','구미시','영주시','영천시','상주시','문경시','경산시'],
      gyeongnam: ['창원시','진주시','통영시','사천시','김해시','밀양시','거제시','양산시','의령군','함안군'],
      jeju: ['제주시','서귀포시'],
    };
    return m[region.id] || m.seoul;
  }, [region.id]);

  /* ── Top KPIs (settings-aware: longWaitDays) ── */
  const topKpis = useMemo(() => generateTopKpis(statsScopeKey, analyticsPeriod, settings.thresholds.longWaitDays), [statsScopeKey, analyticsPeriod, settings.thresholds.longWaitDays]);
  const selectedMapCard = useMemo(() => topKpis.find(k => k.kpiKey === selectedMapKpiId) ?? topKpis[0], [topKpis, selectedMapKpiId]);

  /* ── Map indicator ID (ops→geo mapping) ── */
  const mapIndicatorId = OPS_TO_GEO_INDICATOR[selectedMapKpiId] || 'total_cases';
  const mapColorScheme = (OPS_COLOR_SCHEME[selectedMapKpiId] || 'blue') as MapColorScheme;

  /* ── Risk Top 5 (settings-aware: weights) ── */
  // 드릴다운 시 mapSubRegions에서 하위지역 이름 목록 사용
  const riskNames = useMemo(() => {
    if (selectedDistrictName && mapSubRegions.length > 0) {
      return mapSubRegions.map(r => r.name);
    }
    return DISTRICTS;
  }, [selectedDistrictName, mapSubRegions, DISTRICTS]);

  const riskTop5 = useMemo(() => {
    const items = riskNames.map(name => {
      const s = `${statsScopeKey}-${analyticsPeriod}-risk-${name}`;
      const slaBreachRate = sv(`${s}-sla`, 2, 30);
      const notReachedRate = sv(`${s}-nr`, 5, 35);
      const avgWaitTimeNorm = sv(`${s}-wait`, 5, 40);
      const longWaitRate = sv(`${s}-lw`, 3, 25);
      const score = computeRiskScore({ slaBreachRate, notReachedRate, avgWaitTimeNorm, longWaitRate }, settings.weights);
      return { name, score: Number(score.toFixed(1)), slaBreachRate: Number(slaBreachRate.toFixed(1)), notReachedRate: Number(notReachedRate.toFixed(1)), avgWaitDays: Number(sv(`${s}-avgd`, 2, 12).toFixed(1)), activeCases: Math.round(sv(`${s}-ac`, 50, 500)) };
    });
    return items.sort((a, b) => b.score - a.score).slice(0, 5);
  }, [statsScopeKey, analyticsPeriod, riskNames, settings.weights]);

  /* ── Heatmap / Treemap data ── */
  const mapHeatmapData = useMemo(() => {
    const rangeMap: Record<string, { min: number; max: number }> = {
      ops_new_assigned: { min: 20, max: 300 }, ops_active_cases: { min: 50, max: 500 },
      ops_sla_breach: { min: 2, max: 60 }, ops_not_reached: { min: 5, max: 100 }, ops_long_wait: { min: 3, max: 80 },
    };
    const range = rangeMap[selectedMapKpiId] ?? { min: 10, max: 100 };
    const mul = analyticsPeriod === 'week' ? 1 : analyticsPeriod === 'month' ? 4.2 : 13;
    const seedPrefix = `${statsScopeKey}-${selectedMapKpiId}-heat`;
    const rawItems = riskNames.map(name => ({ name, size: Math.round(sv(`${seedPrefix}-${name}`, range.min, range.max) * mul) }));
    const maxV = Math.max(...rawItems.map(d => d.size));
    const minV = Math.min(...rawItems.map(d => d.size));
    const isInvert = selectedMapCard.invertColor;
    const schemeKey = selectedMapCard.mapColorScheme;
    const palettes: Record<string, string[]> = {
      blue: ['#eff6ff','#bfdbfe','#60a5fa','#2563eb','#1d4ed8','#1e3a8a'],
      green: ['#f0fdf4','#bbf7d0','#4ade80','#16a34a','#15803d','#14532d'],
      red: ['#fef2f2','#fecaca','#f87171','#dc2626','#b91c1c','#7f1d1d'],
      orange: ['#fffbeb','#fed7aa','#fb923c','#ea580c','#c2410c','#7c2d12'],
      purple: ['#faf5ff','#e9d5ff','#c084fc','#9333ea','#7e22ce','#581c87'],
    };
    const pal = isInvert ? palettes.red : (palettes[schemeKey] || palettes.blue);
    const lightColors = [pal[0], pal[1]];
    return rawItems.map(item => {
      const ratio = maxV === minV ? 0.5 : (item.size - minV) / (maxV - minV);
      const idx = ratio < 0.15 ? 0 : ratio < 0.3 ? 1 : ratio < 0.5 ? 2 : ratio < 0.7 ? 3 : ratio < 0.85 ? 4 : 5;
      const fill = pal[idx];
      const textColor = lightColors.includes(fill) ? '#1e3a8a' : '#ffffff';
      return { ...item, fill, textColor };
    });
  }, [statsScopeKey, selectedMapKpiId, analyticsPeriod, riskNames, selectedMapCard.invertColor, selectedMapCard.mapColorScheme]);

  const totalCases = useMemo(() => mapHeatmapData.reduce((s, d) => s + d.size, 0), [mapHeatmapData]);

  /* ── Risk Matrix (SLA x 미접촉률) ── */
  const SLA_THRESHOLD = 90;
  const NR_THRESHOLD = 20;
  const riskMatrixData = useMemo(() => {
    return riskNames.slice(0, 15).map((name, idx) => {
      const s = `${statsScopeKey}-${analyticsPeriod}-matrix-${idx}`;
      return { regionId: String(idx), regionName: name, slaRate: Number(sv(`${s}-sla`, 75, 100).toFixed(1)), notReachedRate: Number(sv(`${s}-nr`, 5, 40).toFixed(1)), activeCases: Math.round(sv(`${s}-cases`, 50, 600)) };
    });
  }, [statsScopeKey, analyticsPeriod, riskNames]);

  /* ── Stage distribution (7 stages) ── */
  const stageData = useMemo(() => {
    return riskNames.slice(0, 12).map(name => {
      const s = `${statsScopeKey}-${analyticsPeriod}-stage-${name}`;
      const row: Record<string, string | number> = { regionName: name.length > 4 ? name.slice(0, 3) : name };
      OPS_STAGE_KEYS.forEach(key => {
        const range = key === 'sla_breach' ? [2, 20] : key === 'sla_imminent' ? [3, 15] : key === 'completed' ? [40, 200] : key === 'dropout' ? [2, 15] : [10, 80];
        row[key] = Math.round(sv(`${s}-${key}`, range[0], range[1]));
      });
      return row;
    });
  }, [statsScopeKey, analyticsPeriod, riskNames]);

  /* ── Table data ── */
  const tableData = useMemo(() => {
    const mul = analyticsPeriod === 'week' ? 1 : analyticsPeriod === 'month' ? 4.2 : 13;
    return riskNames.map(name => {
      const s = `${statsScopeKey}-${analyticsPeriod}-table-${name}`;
      return {
        district: name, assignedCount: Math.round(sv(`${s}-assigned`, 30, 300) * mul),
        activeCount: Math.round(sv(`${s}-active`, 20, 200) * mul),
        slaBreach: Math.round(sv(`${s}-slabr`, 1, 30) * mul),
        slaImminent: Math.round(sv(`${s}-slaimm`, 2, 20) * mul),
        notReached: Math.round(sv(`${s}-nr`, 3, 60) * mul),
        longWait: Math.round(sv(`${s}-lw`, 2, 40) * mul),
        avgWaitDays: Number(sv(`${s}-avgwd`, 1.5, 10).toFixed(1)),
        completionRate: Number(sv(`${s}-cmprate`, 60, 98).toFixed(1)),
      };
    }).sort((a, b) => b.slaBreach - a.slaBreach);
  }, [statsScopeKey, analyticsPeriod, riskNames]);

  /* ── Age × Status data (운영 기준 - NationalDashboard "연령대별 미처리/지연 리스크" 동일 구조) ── */
  const AGE_GROUPS = ['10대', '20대', '30대', '40대', '50대', '60+'];
  const ageStatusData = useMemo(() => {
    return AGE_GROUPS.map(age => {
      const s = `${statsScopeKey}-${analyticsPeriod}-age-${age}`;
      return {
        age,
        normal: Math.round(sv(`${s}-normal`, 30, 150)),
        caution: Math.round(sv(`${s}-caution`, 10, 60)),
        highRisk: Math.round(sv(`${s}-highRisk`, 5, 40)),
        slaViolation: Math.round(sv(`${s}-slaViol`, 2, 25)),
      };
    });
  }, [statsScopeKey, analyticsPeriod]);

  /* ── Bottleneck alerts mock data (운영요약 → 병목 알림) ── */
  const bottleneckAlerts = useMemo(() => {
    const s = `${statsScopeKey}-${analyticsPeriod}-bottleneck`;
    const slaCount = Math.round(sv(`${s}-sla`, 3, 20));
    const capPct = Math.round(sv(`${s}-cap`, 80, 99));
    const nrPct = Number(sv(`${s}-nr`, 18, 35).toFixed(1));
    return [
      { id: 1, type: 'sla_breach' as const, severity: 'critical' as const, message: 'SLA 위반 급증', detail: `상위 지역 SLA 위반 +${slaCount}건 (전주 대비)`, time: '2시간 전' },
      { id: 2, type: 'capacity' as const, severity: 'warning' as const, message: '처리 용량 초과 위험', detail: `처리중 케이스 ${capPct}% 도달`, time: '4시간 전' },
      { id: 3, type: 'not_reached' as const, severity: 'warning' as const, message: '미접촉률 임계 초과', detail: `미접촉률 ${nrPct}% (임계 ${NR_THRESHOLD}%)`, time: '1일 전' },
    ];
  }, [statsScopeKey, analyticsPeriod]);

  /* ── Map region select handler ── */
  const handleRegionSelect = useCallback(({ level, name }: { level: string; code: string; name: string }) => {
    if (level === 'ctprvn') setSelectedDistrictName(null);
    else setSelectedDistrictName(name);
  }, []);

  const handleSubRegionsChange = useCallback((regions: Array<{code: string; name: string; level: string}>) => {
    setMapSubRegions(regions);
  }, []);

  /* ── Top-5 드릴다운 helper — mapSubRegions에서 코드 찾기 ── */
  const findSubRegionCode = useCallback((districtName: string) => {
    if (!districtName || !mapSubRegions.length) return undefined;
    const match = mapSubRegions.find(r => r.name.includes(districtName) || districtName.includes(r.name));
    return match?.code;
  }, [mapSubRegions]);

  /* ═══════════════════════════════════════════════════════════════
     RENDER — Frame 100% clone of NationalDashboard
  ═══════════════════════════════════════════════════════════════ */
  return (
    <div ref={containerRef} className="flex flex-col bg-gray-50 h-full min-h-0">
      {/* ═══════════════════════════════════════════════════════════
          고정 1행: KPI 선택 카드 + Scope 정보 + 보조 컨트롤
          (NationalDashboard와 동일 구조)
      ═══════════════════════════════════════════════════════════ */}
      <div className="bg-white border-b border-gray-200 px-4 py-2 shrink-0">
        <div className="flex items-center gap-2">
          {/* KPI 카드 버튼 그룹 */}
          <div className="flex items-center gap-2 overflow-x-auto flex-1 min-w-0">
            {topKpis.map(card => {
              const isActive = selectedMapKpiId === card.kpiKey;
              const kpiColorMap: Record<string, { border: string; bg: string; ring: string; text: string; value: string }> = {
                blue:   { border: 'border-blue-500',   bg: 'bg-blue-50',   ring: 'ring-blue-200',   text: 'text-blue-700',   value: 'text-blue-600' },
                green:  { border: 'border-green-500',  bg: 'bg-green-50',  ring: 'ring-green-200',  text: 'text-green-700',  value: 'text-green-600' },
                red:    { border: 'border-red-500',    bg: 'bg-red-50',    ring: 'ring-red-200',    text: 'text-red-700',    value: 'text-red-600' },
                orange: { border: 'border-amber-500',  bg: 'bg-amber-50',  ring: 'ring-amber-200',  text: 'text-amber-700',  value: 'text-amber-600' },
                purple: { border: 'border-purple-500', bg: 'bg-purple-50', ring: 'ring-purple-200', text: 'text-purple-700', value: 'text-purple-600' },
              };
              const cs = kpiColorMap[card.mapColorScheme] || kpiColorMap.blue;
              return (
                <button key={card.kpiKey} onClick={() => setSelectedMapKpiId(card.kpiKey)}
                  onMouseEnter={() => setTooltipTarget(card.kpiKey)} onMouseLeave={() => setTooltipTarget(null)}
                  aria-pressed={isActive}
                  className={`relative flex items-center gap-2 px-3 py-2 rounded-lg border transition-all min-w-[140px] text-left ${isActive ? `${cs.border} ${cs.bg} ring-2 ${cs.ring} shadow-sm` : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'}`}>
                  <div className={`p-1.5 rounded-md ${card.iconBg}`}>
                    {card.kpiKey === 'ops_new_assigned' && <TrendingUp className="h-4 w-4" />}
                    {card.kpiKey === 'ops_active_cases' && <BarChart3 className="h-4 w-4" />}
                    {card.kpiKey === 'ops_sla_breach' && <AlertTriangle className="h-4 w-4" />}
                    {card.kpiKey === 'ops_not_reached' && <HelpCircle className="h-4 w-4" />}
                    {card.kpiKey === 'ops_long_wait' && <ChevronRight className="h-4 w-4" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className={`text-[12px] font-medium truncate ${isActive ? cs.text : 'text-gray-500'}`}>{card.shortLabel}</div>
                    <div className={`text-sm font-bold ${card.invertColor && card.count > 0 ? 'text-red-600' : isActive ? cs.value : 'text-gray-800'}`}>
                      {card.count.toLocaleString()}<span className="text-[12px] font-normal ml-0.5">{card.unit}</span>
                      {card.rate !== undefined && <span className={`text-[11px] ml-1 font-medium ${card.invertColor ? 'text-red-500' : 'text-gray-400'}`}>({card.rate}%)</span>}
                    </div>
                  </div>
                  {isActive && <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: card.color }} />}
                  {tooltipTarget === card.kpiKey && (
                    <div className="absolute z-50 left-0 top-full mt-1 bg-gray-900 text-white text-[12px] rounded-lg p-2.5 shadow-xl max-w-[280px] leading-relaxed whitespace-pre-line">{card.tooltip}</div>
                  )}
                </button>
              );
            })}
          </div>

          {/* 구분선 */}
          <div className="w-px h-8 bg-gray-200 shrink-0" />

          {/* Breadcrumb / Scope 정보 */}
          <div className="flex items-center gap-1.5 shrink-0">
            {selectedDistrictName && (
              <button onClick={handleGoBack}
                className="flex items-center gap-1 px-2 py-1 text-xs text-blue-600 bg-blue-50 rounded hover:bg-blue-100 transition-colors">
                <ChevronLeft className="h-3 w-3" /><span>이전</span>
              </button>
            )}

            {selectedDistrictName && (
              <button onClick={handleGoBack}
                className="p-1 text-gray-500 hover:text-blue-600 hover:bg-gray-100 rounded transition-colors" title="광역 전체로">
                <Home className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* 구분선 */}
          <div className="w-px h-8 bg-gray-200 shrink-0" />

          {/* 보조 컨트롤 */}
          <div className="flex items-center gap-1 text-gray-500 shrink-0">
            <button className="p-1.5 hover:bg-gray-100 rounded" title="도움말"><HelpCircle className="h-4 w-4" /></button>
            <button className="p-1.5 hover:bg-gray-100 rounded" title="다운로드"><Download className="h-4 w-4" /></button>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════
          SCROLL CONTAINER (NationalDashboard와 동일)
      ═══════════════════════════════════════════════════════════ */}
      <div className="flex-1 overflow-y-auto min-h-0">

      {/* ═══════════════════════════════════════════════════════════
          MAIN CONTENT — CSS Grid 3열 (NationalDashboard와 동일 비율)
          Desktop: 1.2fr / 2.2fr / 2.6fr
      ═══════════════════════════════════════════════════════════ */}
      <div className={`p-2 gap-2 ${layoutMode === 'desktop' ? 'grid' : 'flex flex-col'}`}
        style={layoutMode === 'desktop' ? { gridTemplateColumns: '1.2fr 2.2fr 2.6fr', minHeight: 'calc(100vh - 140px)', alignItems: 'stretch' } : undefined}>

        {/* ═══════════════════════════════════════════════════════
            LEFT COLUMN — 요약 + Top5 (NationalDashboard 좌측과 동일 구조)
        ═══════════════════════════════════════════════════════ */}
        <div className={`flex flex-col gap-2 ${layoutMode === 'desktop' ? 'min-w-0' : layoutMode === 'tablet' ? 'hidden' : 'w-full shrink-0'}`}>
          {/* Scope badge */}
          <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-2 text-center">
            <span className="text-xs text-indigo-700 font-medium">
              {selectedDistrictName ? `📍 ${selectedDistrictName}` : `🏢 ${region.label} 전체`}
            </span>
            <span className="ml-2 text-[12px] text-indigo-500">운영 기준 · {periodLabel}</span>
          </div>

          {/* 선택 KPI 요약 (NationalDashboard의 "선택 KPI 요약" 동일 구조) */}
          <div className="bg-white border border-gray-200 rounded-lg p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold text-gray-700">선택 KPI 요약(운영)</span>
              <span className="text-[11px] px-1.5 py-0.5 rounded font-medium"
                style={{ backgroundColor: `${selectedMapCard.color}15`, color: selectedMapCard.color }}>
                {selectedMapCard.shortLabel}
              </span>
            </div>
            {(() => {
              const avg = mapHeatmapData.length > 0 ? mapHeatmapData.reduce((s, d) => s + d.size, 0) / mapHeatmapData.length : 0;
              const sorted = [...mapHeatmapData].sort((a, b) => b.size - a.size);
              const best = sorted[0];
              const worst = sorted[sorted.length - 1];
              return (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[12px] text-gray-500">광역 평균(운영)</span>
                    <span className="text-sm font-bold" style={{ color: selectedMapCard.color }}>{Math.round(avg).toLocaleString()}{selectedMapCard.unit}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[12px] text-gray-500">총 건수</span>
                    <span className="text-sm font-bold text-gray-800">{totalCases.toLocaleString()}{selectedMapCard.unit}</span>
                  </div>
                  {best && (
                    <div className="flex items-center justify-between">
                      <span className="text-[12px] text-gray-500">최고 ({best.name})</span>
                      <span className="text-xs font-semibold text-green-600">{best.size.toLocaleString()}</span>
                    </div>
                  )}
                  {worst && (
                    <div className="flex items-center justify-between">
                      <span className="text-[12px] text-gray-500">최저 ({worst.name})</span>
                      <span className="text-xs font-semibold text-red-600">{worst.size.toLocaleString()}</span>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>

          {/* Risk Top 5 (NationalDashboard의 "리스크 Top 5" 동일 구조) */}
          <div className="bg-white border border-gray-200 rounded-lg p-3 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5 text-red-500" />
                <span className="text-sm font-semibold text-gray-700">개입 필요 Top 5(운영)</span>
              </div>
              <span className="text-[11px] bg-red-50 text-red-600 px-1.5 py-0.5 rounded font-medium">
                {selectedDistrictName ? `${selectedDistrictName} 산하` : `${region.label} 산하`}
              </span>
            </div>
            <div className="text-[11px] text-gray-400 mb-1.5">risk = w1·SLA위반 + w2·미접촉 + w3·대기 + w4·장기대기</div>
            <div className="space-y-1">
              {riskTop5.map((item, idx) => (
                <button key={item.name} onClick={() => {
                    if (!selectedDistrictName) {
                      // 시도 레벨 → 시군구로 드릴다운
                      setSelectedDistrictName(item.name);
                      const match = mapSubRegions.find(r => r.name.includes(item.name) || item.name.includes(r.name));
                      if (match) {
                        setMapDrillLevel('emd');
                        setMapDrillCode(match.code);
                      }
                    }
                  }}
                  className={`w-full text-left p-1.5 rounded-lg border transition-colors ${selectedDistrictName === item.name ? 'border-red-300 bg-red-50' : 'border-gray-100 hover:bg-gray-50'}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className={`w-5 h-5 flex items-center justify-center text-[12px] font-bold rounded-full ${idx === 0 ? 'bg-red-500 text-white' : idx < 3 ? 'bg-orange-100 text-orange-700' : 'bg-gray-100 text-gray-600'}`}>{idx + 1}</span>
                      <span className="text-xs font-medium text-gray-800">{item.name}</span>
                    </div>
                    <span className={`text-[12px] font-bold ${item.score >= 20 ? 'text-red-600' : item.score >= 12 ? 'text-orange-600' : 'text-gray-600'}`}>{item.score}점</span>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5 ml-6 text-[11px] text-gray-400">
                    <span>SLA위반 {item.slaBreachRate}%</span><span>미접촉 {item.notReachedRate}%</span><span>대기 {item.avgWaitDays}일</span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* 연령대별 미처리/지연 리스크(%) — NationalDashboard와 동일 구조 */}
          <div className="bg-white border border-gray-200 rounded-lg p-2">
            <div className="text-[12px] font-semibold text-gray-700 mb-0.5">연령대별 미처리/지연 리스크(%)</div>
            <div style={{ height: '190px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={ageStatusData.map(d => {
                  const total = d.normal + d.caution + d.highRisk + d.slaViolation;
                  return {
                    age: d.age,
                    slaViolation: total > 0 ? Number(((d.slaViolation / total) * 100).toFixed(1)) : 0,
                    recontactNeed: total > 0 ? Number((((d.highRisk + d.caution) / total) * 100).toFixed(1)) : 0,
                  };
                })} margin={{ top: 8, right: 4, left: -16, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                  <XAxis dataKey="age" tick={{ fontSize: 14, fill: '#4b5563' }} tickLine={false} />
                  <YAxis tick={{ fontSize: 13, fill: '#6b7280' }} tickLine={false} axisLine={false} width={32} tickFormatter={(v: number) => `${v}%`} />
                  <Tooltip content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null;
                    return (
                      <div className="bg-white border border-gray-200 rounded-lg p-2 shadow-lg text-xs">
                        <div className="font-semibold text-gray-800 mb-1">{label}세</div>
                        {payload.map((p, i) => (
                          <div key={i} className="flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
                            <span>{p.dataKey === 'slaViolation' ? 'SLA 위반률' : '재접촉 필요율'}: {Number(p.value).toFixed(1)}%</span>
                          </div>
                        ))}
                      </div>
                    );
                  }} />
                  <Legend formatter={(v: string) => v === 'slaViolation' ? 'SLA 위반률' : '재접촉 필요율'} wrapperStyle={{ fontSize: '13px' }} />
                  <Bar dataKey="slaViolation" fill="#ef4444" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="recontactNeed" fill="#f59e0b" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* ── KPI 요약 테이블 - 토글로 숨김 처리 (기본: 숨김, NationalDashboard 동일) ── */}
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <button
              onClick={() => setShowKpiSummaryTable(!showKpiSummaryTable)}
              className="w-full flex items-center justify-between px-2 py-2 hover:bg-gray-50 transition-colors"
            >
              <span className="text-[12px] font-medium text-gray-700">KPI 요약 테이블(운영)</span>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={(e) => { e.stopPropagation(); /* Excel 다운로드 */ }}
                  className="px-1.5 py-0.5 text-[11px] text-blue-600 bg-blue-50 rounded hover:bg-blue-100"
                >
                  Excel
                </button>
                {showKpiSummaryTable ? (
                  <ChevronUp className="h-3.5 w-3.5 text-gray-400" />
                ) : (
                  <ChevronDown className="h-3.5 w-3.5 text-gray-400" />
                )}
              </div>
            </button>

            {showKpiSummaryTable && (
              <div className="px-2 pb-2 border-t border-gray-100">
                <div className="overflow-x-auto">
                  <table className="w-full text-[12px]">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200">
                        <th className="px-1.5 py-1 text-left font-medium text-gray-600">KPI(운영)</th>
                        <th className="px-1.5 py-1 text-right font-medium text-gray-600">평균</th>
                        <th className="px-1.5 py-1 text-right font-medium text-gray-600">최저</th>
                        <th className="px-1.5 py-1 text-right font-medium text-gray-600">최고</th>
                      </tr>
                    </thead>
                    <tbody>
                      {topKpis.map(kpi => (
                        <tr key={kpi.kpiKey} className="border-b border-gray-100 hover:bg-blue-50/30">
                          <td className="px-1.5 py-1 truncate max-w-[80px]">{kpi.shortLabel}</td>
                          <td className="px-1.5 py-1 text-right whitespace-nowrap">{kpi.count.toLocaleString()}{kpi.unit}</td>
                          <td className="px-1.5 py-1 text-right text-red-600 whitespace-nowrap">{Math.round(kpi.count * 0.6).toLocaleString()}{kpi.unit}</td>
                          <td className="px-1.5 py-1 text-right text-blue-600 whitespace-nowrap">{Math.round(kpi.count * 1.4).toLocaleString()}{kpi.unit}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          {/* ── 운영 요약 → 병목 알림 + 개입 관리 링크 (NationalDashboard "운영 요약" 동일 구조) ── */}
          <div className="bg-white border border-gray-200 rounded-lg p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-gray-700">병목 알림 · 운영 요약</span>
              <span className="text-[11px] bg-red-50 text-red-600 px-1.5 py-0.5 rounded font-medium">
                {bottleneckAlerts.filter(a => a.severity === 'critical').length}건 심각
              </span>
            </div>

            {/* 병목 알림 목록 */}
            {bottleneckAlerts.map(alert => (
              <div key={alert.id}
                className={`flex items-start gap-2 p-2 rounded-md border ${
                  alert.severity === 'critical' ? 'border-red-200 bg-red-50/50' : 'border-amber-200 bg-amber-50/50'
                }`}>
                <AlertTriangle className={`h-4 w-4 shrink-0 mt-0.5 ${alert.severity === 'critical' ? 'text-red-500' : 'text-amber-500'}`} />
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-medium text-gray-900">{alert.message}</div>
                  <div className="text-[12px] text-gray-500">{alert.detail}</div>
                  <div className="text-[11px] text-gray-400 mt-0.5">{alert.time}</div>
                </div>
              </div>
            ))}

            {/* 병목 분석 바로가기 */}
            <button
              onClick={() => onNavigateToBottleneck?.()}
              className="w-full flex items-center gap-2 p-2 rounded-md hover:bg-orange-50 transition-colors text-left border border-orange-200"
            >
              <Activity className="h-4 w-4 text-orange-500 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-medium text-gray-900">병목 분석 바로가기</div>
                <div className="text-[12px] text-gray-500">SLA 위반 · 미접촉 · 장기대기 원인 분석</div>
              </div>
              <ExternalLink className="h-3 w-3 text-gray-400 shrink-0" />
            </button>

            {/* 개입 관리 바로가기 */}
            <button
              onClick={() => onNavigateToBottleneck?.()}
              className="w-full flex items-center gap-2 p-2 rounded-md hover:bg-blue-50 transition-colors text-left border border-blue-200"
            >
              <Shield className="h-4 w-4 text-blue-500 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-medium text-gray-900">개입 관리 바로가기</div>
                <div className="text-[12px] text-gray-500">센터 지원 배분 · 인력 조정 · 자원 이관</div>
              </div>
              <ExternalLink className="h-3 w-3 text-gray-400 shrink-0" />
            </button>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════
            CENTER COLUMN — 지도 + 범례 (NationalDashboard 중앙과 동일 구조)
        ═══════════════════════════════════════════════════════ */}
        <div className={`${layoutMode === 'desktop' ? 'min-w-0 flex flex-col' : 'w-full shrink-0'}`}>
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden flex flex-col flex-1">
            {/* 중앙 패널 헤더: 뒤로/제목 + 지도·히트맵 토글 + 기간 토글 (SINGLE period filter location) */}
            <div className="px-4 py-3 border-b border-gray-200 bg-white rounded-t-lg">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                  {selectedDistrictName && (
                    <button onClick={handleGoBack}
                      className="flex items-center gap-1 h-8 px-3 text-sm text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors font-medium">
                      <ChevronLeft className="h-4 w-4" /><span>뒤로</span>
                    </button>
                  )}
                  <span className="text-sm font-semibold text-gray-800">
                    {visualizationMode === 'geomap' ? '지도' : '히트맵'}
                  </span>
                  <span className="h-6 inline-flex items-center gap-1 px-2 bg-emerald-50 text-emerald-700 text-[12px] rounded font-medium border border-emerald-200">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    운영 기준 · {periodLabel}
                  </span>
                  <span className="h-6 inline-flex items-center px-2 text-white text-[12px] rounded font-semibold"
                    style={{ backgroundColor: selectedMapCard.color }}>
                    {selectedMapCard.shortLabel}(운영)
                  </span>
                  <span className="h-6 inline-flex items-center px-2 bg-red-500 text-white text-[12px] rounded font-semibold">
                    {region.label}
                  </span>
                  {selectedDistrictName && <span className="text-xs text-gray-600 font-medium">- {selectedDistrictName}</span>}
                </div>
                <div className="flex items-center gap-2">
                  {/* 지도 / 히트맵 토글 */}
                  <div className="flex rounded-md border border-gray-200 overflow-hidden">
                    <button onClick={() => setVisualizationMode('geomap')}
                      className={`px-3 py-1.5 text-xs font-medium transition ${visualizationMode === 'geomap' ? 'bg-blue-600 text-white' : 'bg-white text-gray-500 hover:bg-gray-100'}`}>
                      지오맵
                    </button>
                    <button onClick={() => setVisualizationMode('heatmap')}
                      className={`px-3 py-1.5 text-xs font-medium transition border-l border-gray-200 ${visualizationMode === 'heatmap' ? 'bg-blue-600 text-white' : 'bg-white text-gray-500 hover:bg-gray-100'}`}>
                      히트맵
                    </button>
                  </div>
                  {/* 기간 토글 (SINGLE — 여기서만 존재) */}
                  <div className="flex items-center gap-0.5">
                    {(['week', 'month', 'quarter'] as const).map(p => (
                      <button key={p} onClick={() => setAnalyticsPeriod(p)}
                        className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${analyticsPeriod === p ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
                        {p === 'week' ? '주간' : p === 'month' ? '월간' : '분기'}
                      </button>
                    ))}
                  </div>
                  <button className="h-7 w-7 flex items-center justify-center hover:bg-gray-100 rounded-lg transition-colors">
                    <Download className="h-3.5 w-3.5 text-gray-500" />
                  </button>
                </div>
              </div>
            </div>

            {/* 지도 / 히트맵 본체 */}
            <div className="p-2 min-h-0">
              {visualizationMode === 'geomap' ? (
                <GeoMapPanel
                  key={`regional-${region.id}-${selectedMapKpiId}-${analyticsPeriod}`}
                  title="" indicatorId={mapIndicatorId}
                  year={2026} scope={{ mode: 'regional', ctprvnCodes: [region.ctprvnCode], label: region.label }}
                  variant="portal" mapHeight={670} hideBreadcrumb onRegionSelect={handleRegionSelect}
                  externalColorScheme={mapColorScheme}
                  hideLegendPanel
                  externalLevel={mapDrillLevel}
                  externalSelectedCode={mapDrillCode}
                  onSubRegionsChange={handleSubRegionsChange}
                />
              ) : (
                <div className="relative w-full" style={{ height: 'clamp(320px, 44vh, 480px)' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <Treemap data={mapHeatmapData} dataKey="size" stroke="#fff" isAnimationActive={false} content={CustomTreemapContent} />
                  </ResponsiveContainer>
                  {heatmapHover && (() => {
                    const sorted = [...mapHeatmapData].sort((a, b) => b.size - a.size);
                    const rank = sorted.findIndex(d => d.name === heatmapHover.name) + 1;
                    const total = mapHeatmapData.reduce((s, d) => s + d.size, 0);
                    const share = total > 0 ? ((heatmapHover.size / total) * 100).toFixed(1) : '0';
                    return (
                      <div className="absolute z-50 pointer-events-none bg-white border border-gray-200 rounded-lg p-2.5 shadow-xl text-xs min-w-[170px]"
                        style={{ left: Math.min(heatmapHover.x + 12, 200), top: Math.max(heatmapHover.y - 60, 0) }}>
                        <div className="flex items-center justify-between mb-1 pb-1 border-b border-gray-100">
                          <span className="font-semibold text-gray-800">{heatmapHover.name}</span>
                          <span className="text-[11px] bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded font-medium">{periodLabel}</span>
                        </div>
                        <div className="flex justify-between py-0.5"><span className="text-gray-500">{selectedMapCard.shortLabel}(운영)</span><span className="font-bold text-blue-600">{heatmapHover.size.toLocaleString()}</span></div>
                        <div className="flex justify-between py-0.5"><span className="text-gray-500">순위</span><span className="font-bold text-gray-700">{rank}/{mapHeatmapData.length}</span></div>
                        <div className="flex justify-between py-0.5"><span className="text-gray-500">비중</span><span className="font-bold text-gray-700">{share}%</span></div>
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>

            {/* KPI 색상 범례 (자동 · 범례 설정 버튼 없음) */}
            <div className="mx-2 mb-2 px-3 py-2 rounded-lg bg-gradient-to-r from-gray-50 to-gray-100/80 border border-gray-200/60 shrink-0">
              <div className="flex items-center gap-2 mb-1.5">
                <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: selectedMapCard.color }} />
                <span className="text-[12px] font-bold text-gray-600 tracking-wide">{selectedMapCard.shortLabel}(운영)</span>
                <span className="text-[11px] text-gray-400">배정 케이스 기준</span>
                <span className="text-[11px] text-gray-400 ml-auto">{selectedMapCard.unit}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[12px] font-semibold text-gray-500 tabular-nums min-w-[36px] text-right">
                  {mapHeatmapData.length ? Math.min(...mapHeatmapData.map(d => d.size)).toLocaleString() : '-'}
                </span>
                <div className="flex-1 h-3 rounded-md overflow-hidden flex shadow-inner">
                  {(COLOR_PALETTES[mapColorScheme as keyof typeof COLOR_PALETTES] || COLOR_PALETTES.blue).map((c: string, i: number) => (
                    <div key={i} className="flex-1 transition-colors" style={{ backgroundColor: c }} />
                  ))}
                </div>
                <span className="text-[12px] font-semibold text-gray-500 tabular-nums min-w-[36px]">
                  {mapHeatmapData.length ? Math.max(...mapHeatmapData.map(d => d.size)).toLocaleString() : '-'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════
            RIGHT COLUMN — 분석 패널 (NationalDashboard 우측과 동일 구조)
        ═══════════════════════════════════════════════════════ */}
        <div className={`flex flex-col gap-2 ${layoutMode === 'desktop' ? 'min-w-0' : layoutMode === 'tablet' ? 'hidden' : 'w-full shrink-0'}`}>

          {/* SLA × 미접촉률 리스크 매트릭스(운영) */}
          <div className="bg-white border border-gray-200 rounded-lg p-3">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-gray-700">SLA × 미접촉률 리스크 매트릭스(운영)</span>
                <span className="text-[11px] px-1.5 py-0.5 bg-indigo-50 text-indigo-600 rounded border border-indigo-200">배정 케이스 기준</span>
              </div>
              <div className="flex items-center gap-2 text-[12px] text-gray-500">
                <span className="flex items-center gap-0.5"><span className="w-2 h-2 rounded-full bg-green-500" />양호</span>
                <span className="flex items-center gap-0.5"><span className="w-2 h-2 rounded-full bg-amber-400" />주의</span>
                <span className="flex items-center gap-0.5"><span className="w-2 h-2 rounded-full bg-red-500" />위험</span>
              </div>
            </div>
            <div style={{ height: '250px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart margin={{ top: 10, right: 15, left: -5, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis type="number" dataKey="notReachedRate" name="미접촉률(운영)" unit="%" domain={[0, 50]} tick={{ fontSize: 14 }}
                    label={{ value: '미접촉률(%)', position: 'insideBottom', offset: -2, fontSize: 13, fill: '#6b7280' }} />
                  <YAxis type="number" dataKey="slaRate" name="SLA 준수율(운영)" unit="%" domain={[70, 100]} tick={{ fontSize: 14 }}
                    label={{ value: 'SLA(%)', angle: -90, position: 'insideLeft', offset: 15, fontSize: 13, fill: '#6b7280' }} />
                  <ZAxis type="number" dataKey="activeCases" range={[40, 300]} name="처리중 건수(운영)" />
                  <ReferenceLine x={NR_THRESHOLD} stroke="#9ca3af" strokeDasharray="4 2" />
                  <ReferenceLine y={SLA_THRESHOLD} stroke="#9ca3af" strokeDasharray="4 2" />
                  <Tooltip content={({ active, payload }) => {
                    if (!active || !payload?.[0]) return null;
                    const d = payload[0].payload;
                    return (
                      <div className="bg-white border rounded-lg p-2 shadow-lg text-xs">
                        <div className="font-semibold text-gray-800 mb-1">{d.regionName}</div>
                        <div>SLA 준수율(운영): <span className="font-medium">{d.slaRate}%</span></div>
                        <div>미접촉률(운영): <span className="font-medium">{d.notReachedRate}%</span></div>
                        <div>처리중 케이스(운영): <span className="font-medium">{d.activeCases.toLocaleString()}건</span></div>
                        <div className="mt-1 pt-1 border-t text-[11px] text-gray-400">집계: case_id 기준</div>
                      </div>
                    );
                  }} />
                  <Scatter data={riskMatrixData} onClick={(entry: any) => {
                    if (entry?.regionName) {
                      setSelectedDistrictName(entry.regionName);
                      const match = mapSubRegions.find(r => r.name.includes(entry.regionName) || entry.regionName.includes(r.name));
                      if (match) { setMapDrillLevel('emd'); setMapDrillCode(match.code); }
                    }
                  }}>
                    {riskMatrixData.map((entry, idx) => {
                      const slaOk = entry.slaRate >= SLA_THRESHOLD;
                      const nrOk = entry.notReachedRate <= NR_THRESHOLD;
                      const color = slaOk && nrOk ? '#22c55e' : !slaOk && !nrOk ? '#ef4444' : '#f59e0b';
                      return <Cell key={idx} fill={color} style={{ cursor: 'pointer' }} />;
                    })}
                  </Scatter>
                </ScatterChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* 처리 단계 분포(운영 단계) — 7단계 */}
          <div className="bg-white border border-gray-200 rounded-lg p-3">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-gray-700">처리 단계 분포(운영 단계)</span>
                <span className="text-[11px] px-1.5 py-0.5 bg-orange-50 text-orange-600 rounded border border-orange-200">시군구별</span>
              </div>
            </div>
            <div style={{ height: '270px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stageData} margin={{ top: 5, right: 10, left: -10, bottom: 25 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                  <XAxis dataKey="regionName" tick={{ fontSize: 13, fill: '#4b5563' }} interval={0} angle={-35} textAnchor="end" />
                  <YAxis tick={{ fontSize: 13, fill: '#6b7280' }} tickFormatter={(v: number) => v >= 1000 ? `${(v / 1000).toFixed(0)}K` : String(v)} />
                  <Tooltip content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null;
                    const total = payload.reduce((s, p) => s + (Number(p.value) || 0), 0);
                    return (
                      <div className="bg-white border rounded-lg p-2 shadow-lg text-xs">
                        <div className="font-semibold text-gray-800 mb-1">{label}</div>
                        {payload.map((p, i) => (
                          <div key={i} className="flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
                            <span>{OPS_STAGE_META[p.dataKey as OpsStageKey]?.label || p.dataKey}: {Number(p.value).toLocaleString()}건 ({total > 0 ? ((Number(p.value) / total) * 100).toFixed(1) : 0}%)</span>
                          </div>
                        ))}
                        <div className="mt-1 pt-1 border-t font-medium">합계: {total.toLocaleString()}건</div>
                      </div>
                    );
                  }} />
                  <Legend formatter={(v: string) => OPS_STAGE_META[v as OpsStageKey]?.label || v} wrapperStyle={{ fontSize: '13px' }} />
                  {OPS_STAGE_KEYS.map(key => <Bar key={key} dataKey={key} stackId="stage" fill={OPS_STAGE_META[key].color} />)}
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* KPI 추이(운영) */}
          <KPITrendChart statsScopeKey={statsScopeKey} analyticsPeriod={analyticsPeriod} />

          {/* 운영 KPI 요약 테이블 */}
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <div className="flex items-center justify-between p-3">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-gray-700">운영 KPI 요약 테이블</span>
                <span className="text-[11px] px-1.5 py-0.5 bg-indigo-50 text-indigo-600 rounded border border-indigo-200">배정 케이스 · {periodLabel}</span>
              </div>
              <button className="px-2 py-0.5 text-[12px] text-blue-600 bg-blue-50 rounded hover:bg-blue-100 font-medium">Excel 다운로드</button>
            </div>
            <div className="px-3 pb-3 pt-0 border-t border-gray-100">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      {OPS_TABLE_COLUMNS.map(col => (
                        <th key={col.key} className={`px-2 py-1.5 font-medium text-gray-600 whitespace-nowrap ${col.align === 'right' ? 'text-right' : 'text-left'}`}>{col.label}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {tableData.slice(0, 15).map(row => (
                      <tr key={row.district} onClick={() => {
                        setSelectedDistrictName(row.district);
                        const match = mapSubRegions.find(r => r.name.includes(row.district) || row.district.includes(r.name));
                        if (match) { setMapDrillLevel('emd'); setMapDrillCode(match.code); }
                      }}
                        className={`border-b border-gray-100 cursor-pointer transition-colors ${selectedDistrictName === row.district ? 'bg-blue-50' : 'hover:bg-gray-50'}`}>
                        <td className="px-2 py-1.5 font-medium text-gray-800">{row.district}</td>
                        <td className="px-2 py-1.5 text-right">{row.assignedCount.toLocaleString()}</td>
                        <td className="px-2 py-1.5 text-right">{row.activeCount.toLocaleString()}</td>
                        <td className={`px-2 py-1.5 text-right font-medium ${row.slaBreach > 10 ? 'text-red-600' : 'text-gray-700'}`}>{row.slaBreach.toLocaleString()}</td>
                        <td className={`px-2 py-1.5 text-right ${row.slaImminent > 8 ? 'text-orange-600' : 'text-gray-700'}`}>{row.slaImminent.toLocaleString()}</td>
                        <td className={`px-2 py-1.5 text-right ${row.notReached > 20 ? 'text-orange-600 font-medium' : 'text-gray-700'}`}>{row.notReached.toLocaleString()}</td>
                        <td className={`px-2 py-1.5 text-right ${row.longWait > 15 ? 'text-purple-600 font-medium' : 'text-gray-700'}`}>{row.longWait.toLocaleString()}</td>
                        <td className={`px-2 py-1.5 text-right ${row.avgWaitDays > 7 ? 'text-red-600 font-medium' : 'text-gray-700'}`}>{row.avgWaitDays}일</td>
                        <td className={`px-2 py-1.5 text-right font-medium ${row.completionRate < 75 ? 'text-red-600' : row.completionRate >= 90 ? 'text-green-600' : 'text-gray-700'}`}>{row.completionRate}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        {/* Tablet 전용 하단 2열 */}
        {layoutMode === 'tablet' && (
          <div className="flex gap-2 flex-1 min-h-0">
            <div className="flex-1 flex flex-col gap-2 overflow-y-auto">
              <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-2 text-center">
                <span className="text-xs text-indigo-700 font-medium">{selectedDistrictName ? `📍 ${selectedDistrictName}` : `🏢 ${region.label} 전체`}</span>
              </div>
            </div>
            <div className="flex-1 flex flex-col gap-2 overflow-y-auto">
              <KPITrendChart statsScopeKey={statsScopeKey} analyticsPeriod={analyticsPeriod} />
            </div>
          </div>
        )}
      </div>

      </div>{/* end scroll container */}
    </div>
  );
}
