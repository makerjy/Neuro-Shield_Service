import React, { useMemo, useState, useCallback, useRef, useEffect } from 'react';
import { Download, BarChart3, HelpCircle, TrendingUp, TrendingDown, ChevronLeft, ChevronRight, Home } from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Area,
  Legend,
  Treemap,
  ReferenceLine,
  ScatterChart,
  Scatter,
  ZAxis,
} from 'recharts';
import { GeoMapPanel } from '../geomap/GeoMapPanel';
import { RegionalScope } from '../geomap/regions';

/* ═══════════════════════════════════════════════════════════════════════════════
   ResizeObserver 인라인 훅
═══════════════════════════════════════════════════════════════════════════════ */
function useResizeObserver<T extends HTMLElement>(): [React.RefObject<T | null>, { width: number; height: number }] {
  const ref = useRef<T | null>(null);
  const [size, setSize] = useState({
    width: typeof window !== 'undefined' ? window.innerWidth : 1920,
    height: typeof window !== 'undefined' ? window.innerHeight : 1080,
  });
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const updateSize = () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => {
        const rect = element.getBoundingClientRect();
        setSize((prev: { width: number; height: number }) => {
          if (prev.width === rect.width && prev.height === rect.height) return prev;
          return { width: rect.width, height: rect.height };
        });
      });
    };
    const observer = new ResizeObserver(updateSize);
    observer.observe(element);
    window.addEventListener('resize', updateSize, { passive: true });
    updateSize();
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', updateSize);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return [ref, size];
}

/* ═══════════════════════════════════════════════════════════════════════════════
   색상 상수
═══════════════════════════════════════════════════════════════════════════════ */
const COLORS = {
  blue: '#3b82f6',
  red: '#ef4444',
  green: '#22c55e',
  orange: '#f59e0b',
  purple: '#8b5cf6',
  cyan: '#06b6d4',
};

/* ═══════════════════════════════════════════════════════════════════════════════
   유틸리티 함수
═══════════════════════════════════════════════════════════════════════════════ */
const hashSeed = (input: string) => {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash * 31 + input.charCodeAt(i)) >>> 0;
  }
  return hash;
};

const seededValue = (seed: string, min: number, max: number) => {
  const ratio = (hashSeed(seed) % 1000) / 1000;
  return min + (max - min) * ratio;
};

/* ═══════════════════════════════════════════════════════════════════════════════
   상단 KPI 카드 정의 (지도 연동)
═══════════════════════════════════════════════════════════════════════════════ */
type MapKpiCardDef = {
  id: string;
  label: string;
  unit: string;
  iconBg: string;
  getValue: (seed: string) => number;
};

const MAP_KPI_CARDS: MapKpiCardDef[] = [
  {
    id: 'contact_success',
    label: '접촉 성공률',
    unit: '%',
    iconBg: 'bg-green-100 text-green-600',
    getValue: (seed) => Number(seededValue(`${seed}-contact`, 75, 95).toFixed(1)),
  },
  {
    id: 'completion',
    label: '상담 완료율',
    unit: '%',
    iconBg: 'bg-blue-100 text-blue-600',
    getValue: (seed) => Number(seededValue(`${seed}-consult`, 80, 96).toFixed(1)),
  },
  {
    id: 'linkage_rate',
    label: '연계율',
    unit: '%',
    iconBg: 'bg-cyan-100 text-cyan-600',
    getValue: (seed) => Number(seededValue(`${seed}-linkage`, 60, 85).toFixed(1)),
  },
  {
    id: 'dropout',
    label: '이탈률',
    unit: '%',
    iconBg: 'bg-red-100 text-red-600',
    getValue: (seed) => Number(seededValue(`${seed}-dropout`, 5, 18).toFixed(1)),
  },
  {
    id: 'recontact_success',
    label: '재접촉 성공률',
    unit: '%',
    iconBg: 'bg-purple-100 text-purple-600',
    getValue: (seed) => Number(seededValue(`${seed}-recontact`, 55, 80).toFixed(1)),
  },
  {
    id: 'avg_wait',
    label: '평균 대기시간',
    unit: '분',
    iconBg: 'bg-amber-100 text-amber-600',
    getValue: (seed) => Number(seededValue(`${seed}-wait`, 8, 25).toFixed(1)),
  },
];

/* ═══════════════════════════════════════════════════════════════════════════════
   KPI 통합 추이 차트
═══════════════════════════════════════════════════════════════════════════════ */
type UnifiedKpiKey = 'contact' | 'consult' | 'linkage' | 'dropout' | 'recontact';

const UNIFIED_KPI_DEFS: { key: UnifiedKpiKey; label: string; color: string; unit: string; target?: number }[] = [
  { key: 'contact', label: '접촉 성공률', color: '#22c55e', unit: '%', target: 90 },
  { key: 'consult', label: '상담 완료율', color: '#3b82f6', unit: '%', target: 92 },
  { key: 'linkage', label: '연계율', color: '#06b6d4', unit: '%', target: 75 },
  { key: 'dropout', label: '이탈률', color: '#ef4444', unit: '%', target: 10 },
  { key: 'recontact', label: '재접촉 성공률', color: '#8b5cf6', unit: '%', target: 70 },
];

interface KPIUnifiedChartProps {
  statsScopeKey: string;
  analyticsPeriod: 'week' | 'month' | 'quarter';
}

function KPIUnifiedChart({ statsScopeKey, analyticsPeriod }: KPIUnifiedChartProps) {
  const [enabledKeys, setEnabledKeys] = useState<UnifiedKpiKey[]>(['contact', 'consult', 'linkage', 'dropout']);
  const [hoveredKey, setHoveredKey] = useState<UnifiedKpiKey | null>(null);

  const toggleKey = (key: UnifiedKpiKey) => {
    setEnabledKeys(prev => {
      if (prev.includes(key)) return prev.filter(k => k !== key);
      if (prev.length >= 4) return [...prev.slice(1), key];
      return [...prev, key];
    });
  };

  const timeRangeLabel = analyticsPeriod === 'week' ? '최근 7일' : analyticsPeriod === 'month' ? '최근 12개월' : '분기별';

  const unifiedData = useMemo(() => {
    const points = analyticsPeriod === 'week' ? 7 : analyticsPeriod === 'month' ? 12 : 4;
    const labels = analyticsPeriod === 'week'
      ? ['월', '화', '수', '목', '금', '토', '일']
      : analyticsPeriod === 'month'
      ? ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월']
      : ['Q1', 'Q2', 'Q3', 'Q4'];

    return Array.from({ length: points }, (_, i) => {
      const row: Record<string, string | number> = { date: labels[i] };
      UNIFIED_KPI_DEFS.forEach(def => {
        const base = def.key === 'dropout'
          ? seededValue(`${statsScopeKey}-${analyticsPeriod}-uni-${def.key}-${i}`, 5, 18)
          : seededValue(`${statsScopeKey}-${analyticsPeriod}-uni-${def.key}-${i}`, 65, 98);
        row[def.key] = Number(base.toFixed(1));
      });
      return row;
    });
  }, [statsScopeKey, analyticsPeriod]);

  const visibleDefs = UNIFIED_KPI_DEFS.filter(d => enabledKeys.includes(d.key));

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-gray-700">KPI 통합 추이</span>
        <span className="text-[9px] text-gray-400">{timeRangeLabel}</span>
      </div>
      <div className="flex flex-wrap gap-1.5 mb-3">
        {UNIFIED_KPI_DEFS.map(def => {
          const isOn = enabledKeys.includes(def.key);
          const isHovered = hoveredKey === def.key;
          return (
            <button
              key={def.key}
              onClick={() => toggleKey(def.key)}
              onMouseEnter={() => setHoveredKey(def.key)}
              onMouseLeave={() => setHoveredKey(null)}
              className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-medium transition-all border ${
                isOn ? 'border-transparent shadow-sm' : 'border-gray-200 bg-white text-gray-400 hover:text-gray-600 hover:border-gray-300'
              } ${isHovered && isOn ? 'ring-2 ring-offset-1' : ''}`}
              style={isOn ? {
                backgroundColor: `${def.color}15`,
                color: def.color,
                borderColor: `${def.color}40`,
                ...(isHovered ? { ringColor: `${def.color}40` } : {}),
              } : undefined}
            >
              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: isOn ? def.color : '#d1d5db' }} />
              <span>{def.label}</span>
            </button>
          );
        })}
      </div>
      <div style={{ height: '260px' }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={unifiedData} margin={{ top: 8, right: 12, left: -8, bottom: 4 }}>
            <defs>
              {UNIFIED_KPI_DEFS.map(def => (
                <linearGradient key={`area-grad-${def.key}`} id={`areaGrad-${def.key}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={def.color} stopOpacity={0.25} />
                  <stop offset="100%" stopColor={def.color} stopOpacity={0.02} />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
            <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#6b7280' }} tickLine={false} axisLine={{ stroke: '#e5e7eb' }} />
            <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} tickLine={false} axisLine={false} domain={[0, 100]} width={32} />
            <Tooltip content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null;
              return (
                <div className="bg-white border border-gray-200 rounded-lg p-2.5 shadow-xl text-xs min-w-[180px]">
                  <div className="font-semibold text-gray-800 mb-1.5 pb-1 border-b border-gray-100">{label}</div>
                  {payload.filter(p => p.type !== 'none').map((p, i) => {
                    const def = UNIFIED_KPI_DEFS.find(d => d.key === p.dataKey);
                    if (!def) return null;
                    const currentVal = Number(p.value);
                    const dataIndex = unifiedData.findIndex(d => d.date === label);
                    const prevVal = dataIndex > 0 ? Number(unifiedData[dataIndex - 1][def.key]) : null;
                    const diff = prevVal != null ? currentVal - prevVal : null;
                    return (
                      <div key={i} className="flex items-center justify-between gap-3 py-0.5">
                        <div className="flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: def.color }} />
                          <span className="text-gray-600">{def.label}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="font-semibold" style={{ color: def.color }}>{currentVal.toFixed(1)}{def.unit}</span>
                          {diff != null && diff !== 0 && (
                            <span className={`text-[9px] font-medium ${diff > 0 ? (def.key === 'dropout' ? 'text-red-500' : 'text-green-500') : (def.key === 'dropout' ? 'text-green-500' : 'text-red-500')}`}>
                              {diff > 0 ? '▲' : '▼'}{Math.abs(diff).toFixed(1)}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            }} />
            {visibleDefs.filter(d => d.target != null).map(d => (
              <ReferenceLine key={`target-${d.key}`} y={d.target} stroke={d.color} strokeDasharray="6 3" strokeWidth={1.2} strokeOpacity={0.5}>
                <label value={`목표 ${d.target}${d.unit}`} position="right" fill={d.color} fontSize={9} />
              </ReferenceLine>
            ))}
            {visibleDefs.map(def => (
              <Area key={`area-${def.key}`} type="monotone" dataKey={def.key}
                fill={`url(#areaGrad-${def.key})`} stroke="none"
                fillOpacity={hoveredKey === null || hoveredKey === def.key ? 1 : 0.1}
                connectNulls />
            ))}
            {visibleDefs.map(def => {
              const isFocused = hoveredKey === null || hoveredKey === def.key;
              const isLast = true;
              return (
                <Line key={def.key} type="monotone" dataKey={def.key}
                  stroke={def.color}
                  strokeWidth={isFocused ? (hoveredKey === def.key ? 3 : 2) : 1}
                  strokeOpacity={isFocused ? 1 : 0.2}
                  dot={(props: any) => {
                    const { cx, cy, index, dataKey } = props;
                    if (index === unifiedData.length - 1) {
                      return (
                        <g key={`dot-${dataKey}-${index}`}>
                          <circle cx={cx} cy={cy} r={5} fill={def.color} stroke="#fff" strokeWidth={2} />
                          <text x={cx} y={cy - 10} textAnchor="middle" fill={def.color} fontSize={10} fontWeight="700">
                            {Number(unifiedData[index][def.key]).toFixed(1)}
                          </text>
                        </g>
                      );
                    }
                    return <g key={`dot-${dataKey}-${index}`} />;
                  }}
                  activeDot={{ r: 5, fill: def.color, stroke: '#fff', strokeWidth: 2 }}
                  connectNulls />
              );
            })}
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="flex items-center justify-center gap-4 mt-2 pt-1.5 border-t border-gray-100">
        <div className="flex items-center gap-1 text-[10px] text-gray-400">
          <span className="w-4" style={{ borderTop: '2px dashed #9ca3af' }} />
          <span>목표선</span>
        </div>
        <div className="text-[10px] text-gray-400">최대 4개 동시 표시 · 칩 hover 시 하이라이트</div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════════
   메인 컴포넌트
═══════════════════════════════════════════════════════════════════════════════ */
interface RegionalDashboardProps {
  region: RegionalScope;
  onNavigateToBottleneck?: () => void;
}

export function RegionalDashboard({ region }: RegionalDashboardProps) {
  const [analyticsPeriod, setAnalyticsPeriod] = useState<'week' | 'month' | 'quarter'>('week');
  const [selectedMapKpiId, setSelectedMapKpiId] = useState<string>('contact_success');
  const [containerRef, containerSize] = useResizeObserver<HTMLDivElement>();
  const [heatmapHover, setHeatmapHover] = useState<{ name: string; size: number; x: number; y: number } | null>(null);
  const [selectedDistrictName, setSelectedDistrictName] = useState<string | null>(null);
  const [mapResetKey, setMapResetKey] = useState(0);

  useEffect(() => {
    setSelectedDistrictName(null);
    setMapResetKey(k => k + 1);
  }, [region.id]);

  const handleGoBack = useCallback(() => {
    setSelectedDistrictName(null);
    setMapResetKey(k => k + 1);
  }, []);

  const statsScopeKey = selectedDistrictName ? `${region.id}-${selectedDistrictName}` : region.id;
  const analyticsPeriodLabel = analyticsPeriod === 'week' ? '주간' : analyticsPeriod === 'month' ? '월간' : '분기';

  const layoutMode = useMemo(() => {
    const width = containerSize.width || (typeof window !== 'undefined' ? window.innerWidth : 1920);
    if (width >= 1024) return 'desktop';
    if (width >= 768) return 'tablet';
    return 'mobile';
  }, [containerSize.width]);

  const selectedMapCard = useMemo(
    () => MAP_KPI_CARDS.find(c => c.id === selectedMapKpiId) ?? MAP_KPI_CARDS[0],
    [selectedMapKpiId],
  );

  /* ─── 관할 시군구 목록 ─── */
  const DISTRICT_NAMES = useMemo(() => {
    const districtMap: Record<string, string[]> = {
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
    return districtMap[region.id] || districtMap.seoul;
  }, [region.id]);

  /* ─── 트리맵 데이터 (시군구별 케이스) ─── */
  const treemapData = useMemo(() => {
    const multiplier = analyticsPeriod === 'week' ? 1 : analyticsPeriod === 'month' ? 4.2 : 13;
    const filterKey = `${statsScopeKey}-${analyticsPeriod}`;
    const rawData = DISTRICT_NAMES.map(name => ({
      name,
      size: Math.round(seededValue(`${filterKey}-tree-${name}`, 100, 800) * multiplier),
    }));
    const maxSize = Math.max(...rawData.map(d => d.size));
    const minSize = Math.min(...rawData.map(d => d.size));
    const getHeatmapColor = (value: number) => {
      const ratio = maxSize === minSize ? 0.5 : (value - minSize) / (maxSize - minSize);
      if (ratio < 0.25) return '#fcd34d';
      if (ratio < 0.5) return '#fb923c';
      if (ratio < 0.75) return '#f97316';
      return '#dc2626';
    };
    return rawData.map(item => ({ ...item, fill: getHeatmapColor(item.size) }));
  }, [statsScopeKey, analyticsPeriod, DISTRICT_NAMES]);

  const totalCases = useMemo(() => treemapData.reduce((sum, item) => sum + item.size, 0), [treemapData]);

  /* ─── 히트맵 데이터 (선택 KPI 기준, 푸른 테마) ─── */
  const mapHeatmapData = useMemo(() => {
    const rangeMap: Record<string, { min: number; max: number }> = {
      contact_success: { min: 60, max: 98 },
      completion: { min: 65, max: 98 },
      linkage_rate: { min: 45, max: 90 },
      dropout: { min: 3, max: 25 },
      recontact_success: { min: 40, max: 85 },
      avg_wait: { min: 5, max: 30 },
    };
    const range = rangeMap[selectedMapKpiId] ?? { min: 10, max: 100 };
    const seedPrefix = `${statsScopeKey}-${selectedMapKpiId}-heat`;
    const rawData = DISTRICT_NAMES.map(name => ({
      name,
      value: seededValue(`${seedPrefix}-${name}`, range.min, range.max),
    }));
    const maxValue = Math.max(...rawData.map(d => d.value));
    const minValue = Math.min(...rawData.map(d => d.value));
    const getBlueHeatmapColor = (value: number) => {
      const ratio = maxValue === minValue ? 0.5 : (value - minValue) / (maxValue - minValue);
      if (ratio < 0.15) return '#eff6ff';
      if (ratio < 0.3) return '#bfdbfe';
      if (ratio < 0.5) return '#60a5fa';
      if (ratio < 0.7) return '#2563eb';
      if (ratio < 0.85) return '#1d4ed8';
      return '#1e3a8a';
    };
    const isLightColor = (hex: string) => ['#eff6ff', '#bfdbfe'].includes(hex);
    return rawData.map(item => {
      const fill = getBlueHeatmapColor(item.value);
      return { name: item.name, size: Math.round(item.value * 10) / 10, fill, textColor: isLightColor(fill) ? '#1e3a8a' : '#ffffff' };
    });
  }, [statsScopeKey, selectedMapKpiId, DISTRICT_NAMES]);

  /* ─── SLA × 접촉성공률 리스크 매트릭스 ─── */
  const SLA_THRESHOLD = 90;
  const CONTACT_THRESHOLD = 85;

  const riskMatrixData = useMemo(() => {
    return DISTRICT_NAMES.slice(0, 15).map((name, idx) => {
      const seed = `${statsScopeKey}-${analyticsPeriod}-risk-${idx}`;
      return {
        regionId: String(idx),
        regionName: name,
        slaRate: Number(seededValue(`${seed}-sla`, 75, 100).toFixed(1)),
        contactRate: Number(seededValue(`${seed}-contact`, 70, 100).toFixed(1)),
        totalCases: Math.round(seededValue(`${seed}-cases`, 50, 800)),
      };
    });
  }, [statsScopeKey, analyticsPeriod, DISTRICT_NAMES]);

  /* ─── 처리 단계 분포 ─── */
  const STAGE_KEYS = ['incoming', 'inProgress', 'needRecontact', 'slaBreach', 'completed'] as const;
  const STAGE_LABELS: Record<string, string> = {
    incoming: '신규', inProgress: '처리중', needRecontact: '재접촉 필요', slaBreach: 'SLA 위반', completed: '완료',
  };
  const STAGE_COLORS_MAP: Record<string, string> = {
    incoming: COLORS.blue, inProgress: COLORS.cyan, needRecontact: COLORS.orange, slaBreach: COLORS.red, completed: COLORS.green,
  };

  const stageByDistrictData = useMemo(() => {
    return DISTRICT_NAMES.slice(0, 12).map(name => {
      const seed = `${statsScopeKey}-${analyticsPeriod}-stage-${name}`;
      return {
        regionName: name.length > 4 ? name.slice(0, 3) : name,
        incoming: Math.round(seededValue(`${seed}-inc`, 10, 80)),
        inProgress: Math.round(seededValue(`${seed}-inp`, 20, 120)),
        needRecontact: Math.round(seededValue(`${seed}-nrc`, 5, 40)),
        slaBreach: Math.round(seededValue(`${seed}-sla`, 2, 20)),
        completed: Math.round(seededValue(`${seed}-cmp`, 40, 200)),
      };
    });
  }, [statsScopeKey, analyticsPeriod, DISTRICT_NAMES]);

  /* ─── 연령 × 상태 분포 ─── */
  const AGE_STATUS_KEYS = ['normal', 'caution', 'highRisk', 'slaViolation'] as const;
  const AGE_STATUS_LABELS: Record<string, string> = {
    normal: '정상', caution: '주의', highRisk: '고위험', slaViolation: 'SLA 위반',
  };
  const AGE_STATUS_COLORS: Record<string, string> = {
    normal: '#22c55e', caution: '#f59e0b', highRisk: '#ef4444', slaViolation: '#7c3aed',
  };

  const ageStatusData = useMemo(() => {
    const groups = ['20-39', '40-59', '60-69', '70-79', '80+'];
    const filterKey = `${statsScopeKey}-${analyticsPeriod}-agestat`;
    return groups.map(g => {
      const s = `${filterKey}-${g}`;
      return {
        age: g,
        normal: Math.round(seededValue(`${s}-n`, 30, 120)),
        caution: Math.round(seededValue(`${s}-c`, 10, 50)),
        highRisk: Math.round(seededValue(`${s}-h`, 5, 25)),
        slaViolation: Math.round(seededValue(`${s}-s`, 2, 12)),
      };
    });
  }, [statsScopeKey, analyticsPeriod]);

  /* ─── 이탈률 Top 5 데이터 (이전 기간 비교 포함) ─── */
  const dropoutTop5 = useMemo(() => {
    const items = DISTRICT_NAMES.slice(0, 10).map((name, idx) => {
      const value = Number(seededValue(`${statsScopeKey}-${analyticsPeriod}-dropout-${idx}`, 5, 22).toFixed(1));
      const prevValue = Number(seededValue(`${statsScopeKey}-${analyticsPeriod}-dropout-prev-${idx}`, 4, 20).toFixed(1));
      return {
        name: name.length > 4 ? name.slice(0, 3) : name,
        fullName: name,
        value,
        prevValue,
        diff: Number((value - prevValue).toFixed(1)),
      };
    }).sort((a, b) => b.value - a.value).slice(0, 5);
    const avg = Number((items.reduce((s, d) => s + d.value, 0) / items.length).toFixed(1));
    const threshold = Number((avg + 3).toFixed(1));
    return { items, avg, threshold };
  }, [statsScopeKey, analyticsPeriod, DISTRICT_NAMES]);

  /* ─── 지도 클릭 핸들러 ─── */
  const handleRegionSelect = useCallback(({ level, name }: { level: string; code: string; name: string }) => {
    if (level === 'ctprvn') {
      setSelectedDistrictName(null);
    } else {
      setSelectedDistrictName(name);
    }
  }, []);

  return (
    <div ref={containerRef} className="absolute inset-0 flex flex-col bg-gray-50 overflow-hidden">
      {/* ═══ 상단 KPI 선택 카드 ═══ */}
      <div className="bg-white border-b border-gray-200 px-4 py-2 shrink-0">
        <div className="flex items-center gap-2 overflow-x-auto">
          {MAP_KPI_CARDS.map(card => {
            const isActive = selectedMapKpiId === card.id;
            const value = card.getValue(statsScopeKey);
            return (
              <button
                key={card.id}
                onClick={() => setSelectedMapKpiId(card.id)}
                aria-pressed={isActive}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-all min-w-[130px] text-left ${
                  isActive
                    ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200 shadow-sm'
                    : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
                }`}
              >
                <div className={`p-1.5 rounded-md ${card.iconBg}`}>
                  <BarChart3 className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className={`text-[10px] font-medium truncate ${isActive ? 'text-blue-700' : 'text-gray-500'}`}>{card.label}</div>
                  <div className={`text-sm font-bold ${isActive ? 'text-blue-600' : 'text-gray-800'}`}>
                    {typeof value === 'number' ? value.toLocaleString() : value}
                    <span className="text-[10px] font-normal ml-0.5">{card.unit}</span>
                  </div>
                </div>
                {isActive && <div className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />}
              </button>
            );
          })}
        </div>
      </div>

      {/* ═══ HEADER ═══ */}
      <header className="h-12 bg-white border-b border-gray-200 flex items-center px-4 shrink-0">
        <h2 className="text-sm font-bold text-gray-800">{region.label} 광역센터 대시보드</h2>
        <div className="flex-1" />
        <div className="flex items-center gap-2 text-gray-500">
          <button className="p-1.5 hover:bg-gray-100 rounded"><HelpCircle className="h-4 w-4" /></button>
          <button className="p-1.5 hover:bg-gray-100 rounded"><BarChart3 className="h-4 w-4" /></button>
          <button className="p-1.5 hover:bg-gray-100 rounded"><Download className="h-4 w-4" /></button>
        </div>
      </header>

      {/* ═══ MAIN CONTENT — 3열 레이아웃 (Left 15% / Center 35% / Right 49%) ═══ */}
      <div className={`flex-1 p-2 gap-2 min-h-0 ${
        layoutMode === 'desktop' ? 'flex flex-row items-stretch overflow-hidden'
          : layoutMode === 'tablet' ? 'flex flex-col overflow-y-auto'
          : 'flex flex-col overflow-y-auto'
      }`}>

        {/* ═══ LEFT COLUMN — 요약 통계 (15%) ═══ */}
        <div className={`flex flex-col gap-2 overflow-y-auto ${
          layoutMode === 'desktop' ? 'min-w-0 shrink-0 h-full' : layoutMode === 'tablet' ? 'hidden' : 'w-full shrink-0'
        }`} style={{ width: layoutMode === 'desktop' ? '15%' : undefined }}>

          {/* 현재 범위 */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-2 text-center">
            <span className="text-xs text-blue-700 font-medium">{selectedDistrictName ? '시군구 보기' : '광역 보기'}</span>
            {selectedDistrictName && <span className="ml-2 text-xs text-blue-600">({selectedDistrictName})</span>}
          </div>

          {/* 총 처리건수 + 히트맵 */}
          <div className="bg-white border border-gray-200 rounded-lg p-2">
            <div className="flex items-center justify-between mb-0.5">
              <div className="text-xs text-gray-500">{analyticsPeriodLabel} 총 처리건수</div>
              <div className="text-[9px] text-blue-500 bg-blue-50 px-1.5 py-0.5 rounded">{analyticsPeriodLabel}</div>
            </div>
            <div className="text-xl font-bold text-blue-600 mb-1">
              {totalCases.toLocaleString()} <span className="text-sm font-normal text-gray-500">건</span>
            </div>
            <div className="text-[10px] text-gray-500 mb-1">{selectedMapCard.label} (시군구별)</div>
            <div style={{ width: '100%', aspectRatio: '1 / 1', maxHeight: 220, position: 'relative' }}>
              <ResponsiveContainer width="100%" height="100%">
                <Treemap data={mapHeatmapData} dataKey="size" stroke="#fff" isAnimationActive={false}
                  content={({ x, y, width, height, name, fill, textColor, size }: any) => {
                    if (!width || !height || width < 2 || height < 2) return null;
                    const shortName = (name || '').length > 3 ? (name || '').slice(0, 3) : name;
                    const tc = textColor || '#fff';
                    return (
                      <g
                        onMouseEnter={(e) => {
                          const rect = (e.currentTarget.closest('.recharts-responsive-container') as HTMLElement)?.getBoundingClientRect();
                          if (rect) setHeatmapHover({ name: name || '', size: size || 0, x: e.clientX - rect.left, y: e.clientY - rect.top });
                        }}
                        onMouseMove={(e) => {
                          const rect = (e.currentTarget.closest('.recharts-responsive-container') as HTMLElement)?.getBoundingClientRect();
                          if (rect) setHeatmapHover(prev => prev ? ({ ...prev, x: e.clientX - rect.left, y: e.clientY - rect.top }) : null);
                        }}
                        onMouseLeave={() => setHeatmapHover(null)}
                        style={{ cursor: 'pointer' }}
                      >
                        <rect x={x} y={y} width={width} height={height} fill={fill} stroke="#fff" strokeWidth={1.5} rx={2}
                          style={{ transition: 'opacity 0.15s' }} opacity={heatmapHover && heatmapHover.name !== name ? 0.45 : 1} />
                        {width > 24 && height > 16 && (
                          <text x={x + width / 2} y={y + height / 2} textAnchor="middle" dominantBaseline="central"
                            fill={tc} fontSize={Math.min(width / 5, height / 2.5, 11)} fontWeight="700"
                            stroke={tc === '#ffffff' ? 'rgba(0,0,0,0.3)' : 'none'} strokeWidth={tc === '#ffffff' ? 0.3 : 0}
                            paintOrder="stroke" style={{ pointerEvents: 'none' }}>
                            {shortName}
                          </text>
                        )}
                      </g>
                    );
                  }}
                />
              </ResponsiveContainer>
              {/* 히트맵 툴팁 */}
              {heatmapHover && (() => {
                const sorted = [...mapHeatmapData].sort((a, b) => b.size - a.size);
                const rank = sorted.findIndex(d => d.name === heatmapHover.name) + 1;
                const totalAll = mapHeatmapData.reduce((s, d) => s + d.size, 0);
                const avg = totalAll / mapHeatmapData.length;
                const share = totalAll > 0 ? ((heatmapHover.size / totalAll) * 100).toFixed(1) : '0';
                const avgDiff = avg > 0 ? ((heatmapHover.size / avg - 1) * 100).toFixed(0) : '0';
                const aboveAvg = heatmapHover.size > avg;
                return (
                  <div className="absolute z-50 pointer-events-none bg-white border border-gray-200 rounded-lg p-2.5 shadow-xl text-xs min-w-[170px]"
                    style={{ left: Math.min(heatmapHover.x + 12, 120), top: Math.max(heatmapHover.y - 60, 0) }}>
                    <div className="flex items-center justify-between mb-1.5 pb-1.5 border-b border-gray-100">
                      <span className="font-semibold text-gray-800">{heatmapHover.name}</span>
                      <span className="text-[9px] bg-orange-50 text-orange-600 px-1.5 py-0.5 rounded font-medium">{analyticsPeriodLabel}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3 py-0.5">
                      <span className="text-gray-500">{selectedMapCard.label}</span>
                      <span className="font-bold text-blue-600">{heatmapHover.size.toLocaleString()}{selectedMapCard.unit}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3 py-0.5">
                      <span className="text-gray-500">관할 순위</span>
                      <span className="font-bold text-gray-700">{rank} / {mapHeatmapData.length}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3 py-0.5">
                      <span className="text-gray-500">관할 비중</span>
                      <span className="font-bold text-gray-700">{share}%</span>
                    </div>
                    <div className="flex items-center justify-between gap-3 py-0.5">
                      <span className="text-gray-500">평균 대비</span>
                      <span className={`font-bold ${aboveAvg ? 'text-red-500' : 'text-green-500'}`}>{aboveAvg ? '+' : ''}{avgDiff}%</span>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>

          {/* 연령 × 상태 분포 */}
          <div className="bg-white border border-gray-200 rounded-lg p-2">
            <div className="text-[10px] font-semibold text-gray-700 mb-0.5">연령 × 상태 분포</div>
            <div style={{ height: '150px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={ageStatusData} margin={{ top: 8, right: 4, left: -16, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                  <XAxis dataKey="age" tick={{ fontSize: 12, fill: '#4b5563' }} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#6b7280' }} tickLine={false} axisLine={false} width={32} />
                  <Tooltip content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null;
                    const total = payload.reduce((s, p) => s + (Number(p.value) || 0), 0);
                    return (
                      <div className="bg-white border border-gray-200 rounded-lg p-2 shadow-lg text-xs">
                        <div className="font-semibold text-gray-800 mb-1">{label}세</div>
                        {payload.map((p, i) => (
                          <div key={i} className="flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
                            <span>{AGE_STATUS_LABELS[p.dataKey as string]}: {Number(p.value).toLocaleString()}건</span>
                          </div>
                        ))}
                        <div className="mt-1 pt-1 border-t border-gray-100 font-medium">합계: {total.toLocaleString()}건</div>
                      </div>
                    );
                  }} />
                  <Legend formatter={(v: string) => AGE_STATUS_LABELS[v] || v} wrapperStyle={{ fontSize: '11px' }} />
                  {AGE_STATUS_KEYS.map(key => (
                    <Bar key={key} dataKey={key} stackId="ageStatus" fill={AGE_STATUS_COLORS[key]} radius={key === 'slaViolation' ? [3, 3, 0, 0] : undefined} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* 활성 알림 */}
          <div className="bg-white border border-gray-200 rounded-lg p-3">
            <div className="text-xs text-gray-500 mb-1">관할 활성 알림 수</div>
            <div className="text-2xl font-bold text-blue-600">
              {Math.round(seededValue(`${statsScopeKey}-alerts`, 800, 2500)).toLocaleString()} <span className="text-sm font-normal text-gray-500">건</span>
            </div>
            <div className="flex items-center gap-1 mt-1 text-xs">
              <span className="text-gray-500">전월대비</span>
              <span className="text-red-500 flex items-center">
                {seededValue(`${statsScopeKey}-alert-change`, 2, 8).toFixed(2)}% <TrendingUp className="h-3 w-3 ml-0.5" />
              </span>
            </div>
          </div>
        </div>

        {/* ═══ CENTER COLUMN — GeoMap (35%) ═══ */}
        <div className={`${layoutMode === 'desktop' ? 'min-w-0 shrink-0' : 'w-full shrink-0'}`}
          style={{ width: layoutMode === 'desktop' ? '35%' : undefined }}>
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden h-full flex flex-col min-h-[400px]">
            <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between bg-white rounded-t-lg">
              <div className="flex items-center gap-3">
                {/* 뒤로가기 버튼 */}
                {selectedDistrictName && (
                  <button
                    onClick={handleGoBack}
                    className="flex items-center gap-1.5 h-9 px-3 text-sm text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors font-medium"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    <span>뒤로</span>
                  </button>
                )}
                <span className="text-sm font-semibold text-gray-800">지도</span>
                <span className="h-7 inline-flex items-center gap-1 px-2.5 bg-emerald-50 text-emerald-700 text-[10px] rounded-lg font-medium border border-emerald-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  지도 범위: 연간 누적 · 기준연도 2026
                </span>
                <span className="h-8 inline-flex items-center px-3 bg-blue-500 text-white text-xs rounded-lg font-semibold">{selectedMapCard.label}</span>
                <span className="h-8 inline-flex items-center px-3 bg-red-500 text-white text-xs rounded-lg font-semibold">{region.label}</span>
                {selectedDistrictName && <span className="text-sm text-gray-600 font-medium">- {selectedDistrictName}</span>}
              </div>
              <button className="h-9 w-9 flex items-center justify-center hover:bg-gray-100 rounded-lg transition-colors">
                <Download className="h-4 w-4 text-gray-500" />
              </button>
            </div>
            <div className="flex-1 p-2">
              <GeoMapPanel
                key={`regional-${region.id}-${selectedMapKpiId}-${mapResetKey}`}
                title=""
                indicatorId={selectedMapKpiId === 'contact_success' ? 'completion' : selectedMapKpiId}
                year={2026}
                scope={{ mode: 'regional', ctprvnCodes: [region.ctprvnCode], label: region.label }}
                variant="portal"
                mapHeight={1000}
                hideBreadcrumb
                onRegionSelect={handleRegionSelect}
              />
            </div>
          </div>
        </div>

        {/* ═══ RIGHT COLUMN — 분석 패널 (49%) ═══ */}
        <div className={`flex flex-col gap-2 overflow-y-auto ${
          layoutMode === 'desktop' ? 'min-w-0 shrink-0 h-full' : layoutMode === 'tablet' ? 'hidden' : 'w-full shrink-0'
        }`} style={{ width: layoutMode === 'desktop' ? '49%' : undefined }}>

          {/* 분석 기간 선택 */}
          <div className="bg-white border border-gray-200 rounded-lg p-3 flex items-center justify-between">
            <div className="flex flex-col">
              <span className="text-xs font-semibold text-gray-700">분석 기간</span>
              <span className="text-[9px] text-gray-400 mt-0.5">좌측 요약 및 우측 분석 차트에 적용</span>
            </div>
            <div className="flex items-center gap-1">
              {(['week', 'month', 'quarter'] as const).map(period => (
                <button key={period} onClick={() => setAnalyticsPeriod(period)}
                  className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-colors ${
                    analyticsPeriod === period ? 'bg-blue-500 text-white shadow-sm' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}>
                  {period === 'week' ? '주간' : period === 'month' ? '월간' : '분기'}
                </button>
              ))}
            </div>
          </div>

          {/* SLA × 접촉성공률 리스크 매트릭스 */}
          <div className="bg-white border border-gray-200 rounded-lg p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-gray-700">SLA × 접촉성공률 리스크 매트릭스</span>
              <div className="flex items-center gap-2 text-[10px] text-gray-500">
                <span className="flex items-center gap-0.5"><span className="w-2 h-2 rounded-full bg-green-500" />양호</span>
                <span className="flex items-center gap-0.5"><span className="w-2 h-2 rounded-full bg-amber-400" />주의</span>
                <span className="flex items-center gap-0.5"><span className="w-2 h-2 rounded-full bg-red-500" />위험</span>
              </div>
            </div>
            <div style={{ height: '200px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart margin={{ top: 10, right: 15, left: -5, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis type="number" dataKey="contactRate" name="접촉 성공률" unit="%" domain={[60, 100]} tick={{ fontSize: 12 }}
                    label={{ value: '접촉 성공률(%)', position: 'insideBottom', offset: -2, fontSize: 11, fill: '#6b7280' }} />
                  <YAxis type="number" dataKey="slaRate" name="SLA 준수율" unit="%" domain={[70, 100]} tick={{ fontSize: 12 }}
                    label={{ value: 'SLA(%)', angle: -90, position: 'insideLeft', offset: 15, fontSize: 11, fill: '#6b7280' }} />
                  <ZAxis type="number" dataKey="totalCases" range={[40, 300]} name="케이스 수" />
                  <ReferenceLine x={CONTACT_THRESHOLD} stroke="#9ca3af" strokeDasharray="4 2" />
                  <ReferenceLine y={SLA_THRESHOLD} stroke="#9ca3af" strokeDasharray="4 2" />
                  <Tooltip content={({ active, payload }) => {
                    if (!active || !payload?.[0]) return null;
                    const d = payload[0].payload;
                    return (
                      <div className="bg-white border border-gray-200 rounded-lg p-2 shadow-lg text-xs">
                        <div className="font-semibold text-gray-800 mb-1">{d.regionName}</div>
                        <div>SLA 준수율: <span className="font-medium">{d.slaRate}%</span></div>
                        <div>접촉 성공률: <span className="font-medium">{d.contactRate}%</span></div>
                        <div>케이스: <span className="font-medium">{d.totalCases.toLocaleString()}건</span></div>
                      </div>
                    );
                  }} />
                  <Scatter data={riskMatrixData} onClick={(entry: any) => { if (entry?.regionName) setSelectedDistrictName(entry.regionName); }}>
                    {riskMatrixData.map((entry, idx) => {
                      const slaOk = entry.slaRate >= SLA_THRESHOLD;
                      const contactOk = entry.contactRate >= CONTACT_THRESHOLD;
                      const color = slaOk && contactOk ? '#22c55e' : !slaOk && !contactOk ? '#ef4444' : '#f59e0b';
                      return <Cell key={idx} fill={color} style={{ cursor: 'pointer' }} />;
                    })}
                  </Scatter>
                </ScatterChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* 처리 단계 분포 */}
          <div className="bg-white border border-gray-200 rounded-lg p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-gray-700">처리 단계 분포 (시군구별)</span>
            </div>
            <div style={{ height: '220px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stageByDistrictData} margin={{ top: 5, right: 10, left: -10, bottom: 25 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                  <XAxis dataKey="regionName" tick={{ fontSize: 11, fill: '#4b5563' }} interval={0} angle={-35} textAnchor="end" />
                  <YAxis tick={{ fontSize: 11, fill: '#6b7280' }} tickFormatter={(v: number) => v >= 1000 ? `${(v/1000).toFixed(0)}K` : String(v)} />
                  <Tooltip content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null;
                    const total = payload.reduce((s, p) => s + (Number(p.value) || 0), 0);
                    return (
                      <div className="bg-white border border-gray-200 rounded-lg p-2 shadow-lg text-xs">
                        <div className="font-semibold text-gray-800 mb-1">{label}</div>
                        {payload.map((p, i) => (
                          <div key={i} className="flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
                            <span>{STAGE_LABELS[p.dataKey as string] || p.dataKey}: {Number(p.value).toLocaleString()}건 ({total > 0 ? ((Number(p.value) / total) * 100).toFixed(1) : 0}%)</span>
                          </div>
                        ))}
                        <div className="mt-1 pt-1 border-t border-gray-100 font-medium">합계: {total.toLocaleString()}건</div>
                      </div>
                    );
                  }} />
                  <Legend formatter={(value: string) => STAGE_LABELS[value] || value} wrapperStyle={{ fontSize: '11px' }} />
                  {STAGE_KEYS.map(key => (
                    <Bar key={key} dataKey={key} stackId="stage" fill={STAGE_COLORS_MAP[key]} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* KPI 통합 추이 차트 */}
          <KPIUnifiedChart statsScopeKey={statsScopeKey} analyticsPeriod={analyticsPeriod} />

          {/* 이탈률 Top 5 */}
          <div className="bg-white border border-gray-200 rounded-lg p-3">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-gray-700">이탈률 Top 5 (시군구별)</span>
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-red-50 text-red-500 font-medium">
                  평균 {dropoutTop5.avg}%
                </span>
              </div>
              <button className="p-1 hover:bg-gray-100 rounded"><Download className="h-3 w-3 text-gray-500" /></button>
            </div>
            <div style={{ height: '180px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dropoutTop5.items} layout="vertical" margin={{ top: 5, right: 45, left: 45, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e5e7eb" />
                  <XAxis type="number" tick={{ fontSize: 10, fill: '#9ca3af' }} domain={[0, 25]} tickFormatter={(v: number) => `${v}%`} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#374151' }} width={40} />
                  <Tooltip content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const d = payload[0].payload;
                    const deviationFromAvg = Number((d.value - dropoutTop5.avg).toFixed(1));
                    return (
                      <div className="bg-white border border-gray-200 rounded-lg p-2.5 shadow-xl text-xs min-w-[180px]">
                        <div className="font-semibold text-gray-800 mb-1.5 pb-1 border-b border-gray-100">{d.fullName}</div>
                        <div className="space-y-1">
                          <div className="flex justify-between">
                            <span className="text-gray-500">현재 이탈률</span>
                            <span className="font-bold text-red-600">{d.value}%</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-500">이전 기간</span>
                            <span className="font-medium text-gray-600">{d.prevValue}%</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-500">증감</span>
                            <span className={`font-medium ${d.diff > 0 ? 'text-red-500' : d.diff < 0 ? 'text-green-500' : 'text-gray-400'}`}>
                              {d.diff > 0 ? '▲' : d.diff < 0 ? '▼' : '─'}{Math.abs(d.diff)}%p
                            </span>
                          </div>
                          <div className="flex justify-between pt-1 border-t border-gray-100">
                            <span className="text-gray-500">평균 대비 편차</span>
                            <span className={`font-medium ${deviationFromAvg > 0 ? 'text-red-500' : 'text-green-500'}`}>
                              {deviationFromAvg > 0 ? '+' : ''}{deviationFromAvg}%p
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  }} />
                  <ReferenceLine x={dropoutTop5.avg} stroke="#6b7280" strokeDasharray="4 4" strokeWidth={1.5} label={{ value: `평균 ${dropoutTop5.avg}%`, position: 'top', fill: '#6b7280', fontSize: 9 }} />
                  <ReferenceLine x={dropoutTop5.threshold} stroke="#ef4444" strokeDasharray="2 2" strokeWidth={1} strokeOpacity={0.6} label={{ value: `고위험`, position: 'top', fill: '#ef4444', fontSize: 9 }} />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]} label={{ position: 'right', fill: '#6b7280', fontSize: 10, formatter: (v: number) => `${v}%` }}>
                    {dropoutTop5.items.map((entry, index) => (
                      <Cell key={index} fill={entry.value >= dropoutTop5.threshold ? '#ef4444' : entry.value >= dropoutTop5.avg ? '#f97316' : '#86efac'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="flex items-center justify-center gap-3 mt-1.5 pt-1.5 border-t border-gray-100">
              <div className="flex items-center gap-1 text-[9px] text-gray-400">
                <span className="w-2.5 h-2 rounded-sm" style={{ backgroundColor: '#ef4444' }} />고위험
              </div>
              <div className="flex items-center gap-1 text-[9px] text-gray-400">
                <span className="w-2.5 h-2 rounded-sm" style={{ backgroundColor: '#f97316' }} />평균 이상
              </div>
              <div className="flex items-center gap-1 text-[9px] text-gray-400">
                <span className="w-2.5 h-2 rounded-sm" style={{ backgroundColor: '#86efac' }} />평균 이하
              </div>
            </div>
          </div>

          {/* KPI 요약 테이블 */}
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <div className="w-full flex items-center justify-between p-3">
              <span className="text-xs font-medium text-gray-700">KPI 요약 테이블</span>
              <button className="px-2 py-0.5 text-[10px] text-blue-600 bg-blue-50 rounded hover:bg-blue-100">Excel 다운로드</button>
            </div>
            <div className="p-3 pt-0 border-t border-gray-100">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="px-2 py-1.5 text-left font-medium text-gray-600">KPI 구분</th>
                      <th className="px-2 py-1.5 text-right font-medium text-gray-600">관할 평균</th>
                      <th className="px-2 py-1.5 text-right font-medium text-gray-600">최저(지역)</th>
                      <th className="px-2 py-1.5 text-right font-medium text-gray-600">최고(지역)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {MAP_KPI_CARDS.map(card => {
                      const avg = card.getValue(statsScopeKey);
                      return (
                        <tr key={card.id} className="border-b border-gray-100 hover:bg-blue-50/30">
                          <td className="px-2 py-1.5">{card.label}</td>
                          <td className="px-2 py-1.5 text-right">{avg}{card.unit}</td>
                          <td className="px-2 py-1.5 text-right text-red-600">{(avg * 0.92).toFixed(1)}{card.unit}</td>
                          <td className="px-2 py-1.5 text-right text-blue-600">{(avg * 1.05).toFixed(1)}{card.unit}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        {/* ═══ Tablet 전용 하단 2열 ═══ */}
        {layoutMode === 'tablet' && (
          <div className="flex gap-2 flex-1 min-h-0">
            <div className="flex-1 flex flex-col gap-2 overflow-y-auto">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-2 text-center">
                <span className="text-xs text-blue-700 font-medium">{selectedDistrictName ? '시군구 보기' : '광역 보기'}</span>
              </div>
              <div className="bg-white border border-gray-200 rounded-lg p-3 flex-1">
                <div className="flex items-center justify-between mb-1">
                  <div className="text-xs text-gray-500">{analyticsPeriodLabel} 총 처리건수</div>
                  <div className="text-[9px] text-blue-500 bg-blue-50 px-1.5 py-0.5 rounded">{analyticsPeriodLabel}</div>
                </div>
                <div className="text-2xl font-bold text-blue-600 mb-2">
                  {totalCases.toLocaleString()} <span className="text-sm font-normal text-gray-500">건</span>
                </div>
              </div>
            </div>
            <div className="flex-1 flex flex-col gap-2 overflow-y-auto">
              <KPIUnifiedChart statsScopeKey={statsScopeKey} analyticsPeriod={analyticsPeriod} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
