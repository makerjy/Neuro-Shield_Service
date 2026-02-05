import React, { useMemo, useState, useCallback, useRef, useEffect } from 'react';
import { Download, BarChart3, HelpCircle, TrendingUp, ChevronLeft, ChevronRight, Home, ChevronDown, ChevronUp } from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  ComposedChart,
  Line,
  Area,
  Legend,
  Treemap,
  Sector,
  ReferenceLine,
} from 'recharts';
import { GeoMapPanel } from '../geomap/GeoMapPanel';
import { useDrillState, getDrillLevelLabel } from '../../lib/useDrillState';
import { getKPIsByPanel, getKPIsForLevel, fetchKPIData, getChartEnabledKPIs } from '../../lib/kpiDictionary';
import { KPIDefinition, DrillLevel, DonutDataItem, BarDataItem } from '../../lib/kpi.types';

/* ═══════════════════════════════════════════════════════════════════════════════
   ResizeObserver 인라인 훅 (새 파일 생성 금지에 따른 인라인 구현)
   - rAF 디바운스 + StrictMode 안전 처리 + 0 width/height 방어
═══════════════════════════════════════════════════════════════════════════════ */
function useResizeObserver<T extends HTMLElement>(): [React.RefObject<T | null>, { width: number; height: number }] {
  const ref = useRef<T | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const rafRef = useRef<number | null>(null);
  
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    
    const updateSize = () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => {
        const rect = element.getBoundingClientRect();
        setSize(prev => {
          if (prev.width === rect.width && prev.height === rect.height) return prev;
          return { width: rect.width, height: rect.height };
        });
      });
    };
    
    // ResizeObserver
    const observer = new ResizeObserver(updateSize);
    observer.observe(element);
    
    // 보조: window resize 이벤트 (passive + rAF)
    const handleWindowResize = () => updateSize();
    window.addEventListener('resize', handleWindowResize, { passive: true });
    
    // 초기 사이즈
    updateSize();
    
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', handleWindowResize);
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
  lightBlue: '#93c5fd',
  red: '#ef4444',
  lightRed: '#fca5a5',
  green: '#22c55e',
  orange: '#f59e0b',
  purple: '#8b5cf6',
  cyan: '#06b6d4',
  pink: '#ec4899',
  gray: '#6b7280',
};

const AGE_COLORS = ['#3b82f6', '#60a5fa', '#22c55e', '#f59e0b', '#ec4899', '#8b5cf6'];

/* ═══════════════════════════════════════════════════════════════════════════════
   도넛 차트 내부 라벨 컴포넌트
═══════════════════════════════════════════════════════════════════════════════ */
const renderDonutLabel = (props: any) => {
  const { cx, cy, midAngle, innerRadius, outerRadius, percent, name } = props;
  if (percent * 100 < 5) return null; // 5% 미만은 라벨 숨김
  
  const RADIAN = Math.PI / 180;
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);
  
  return (
    <text x={x} y={y} fill="#fff" textAnchor="middle" dominantBaseline="central" 
          fontSize={10} fontWeight={600} style={{ textShadow: '0 1px 2px rgba(0,0,0,0.3)' }}>
      {`${(percent * 100).toFixed(1)}%`}
    </text>
  );
};

const renderActiveDonutShape = (props: any) => {
  const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill } = props;
  return (
    <g>
      <Sector cx={cx} cy={cy} innerRadius={innerRadius - 2} outerRadius={outerRadius + 4}
              startAngle={startAngle} endAngle={endAngle} fill={fill}
              style={{ filter: 'drop-shadow(0 2px 4px rgba(0, 0, 0, 0.15))' }} />
    </g>
  );
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
   KPI 위젯 렌더러 (차트 타입별 분기)
═══════════════════════════════════════════════════════════════════════════════ */
interface KPIWidgetProps {
  kpi: KPIDefinition;
  data: any;
  statsScopeKey: string;
  activeDonutIndex: number | null;
  setActiveDonutIndex: (idx: number | null) => void;
}

function KPIWidget({ kpi, data, statsScopeKey, activeDonutIndex, setActiveDonutIndex }: KPIWidgetProps) {
  const chartType = kpi.visualization.chartType;
  
  if (chartType === 'donut') {
    const donutData = data as DonutDataItem[];
    const total = donutData.reduce((sum, item) => sum + item.value, 0);
    const activeItem = activeDonutIndex !== null ? donutData[activeDonutIndex] : null;
    
    return (
      <div className="relative" style={{ height: '120px' }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <defs>
              {donutData.map((item, idx) => (
                <linearGradient key={idx} id={`donutGrad-${kpi.id}-${idx}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={item.color || COLORS.blue} stopOpacity={1} />
                  <stop offset="100%" stopColor={item.color || COLORS.blue} stopOpacity={0.8} />
                </linearGradient>
              ))}
            </defs>
            <Pie data={donutData} cx="50%" cy="50%" innerRadius={30} outerRadius={48} dataKey="value"
                 startAngle={90} endAngle={-270} strokeWidth={0} paddingAngle={2}
                 activeIndex={activeDonutIndex ?? undefined} activeShape={renderActiveDonutShape}
                 label={renderDonutLabel} labelLine={false}
                 onMouseEnter={(_, idx) => setActiveDonutIndex(idx)}
                 onMouseLeave={() => setActiveDonutIndex(null)}>
              {donutData.map((entry, idx) => (
                <Cell key={idx} fill={`url(#donutGrad-${kpi.id}-${idx})`} style={{ cursor: 'pointer' }} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        {/* 센터 라벨 */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          {activeItem ? (
            <>
              <div className="text-[10px] text-gray-500">{activeItem.name}</div>
              <div className="text-sm font-bold" style={{ color: activeItem.color }}>
                {((activeItem.value / total) * 100).toFixed(2)}%
              </div>
            </>
          ) : (
            <>
              <div className="text-[10px] text-gray-500">총합</div>
              <div className="text-sm font-bold text-gray-800">{total.toLocaleString()}</div>
            </>
          )}
        </div>
      </div>
    );
  }
  
  if (chartType === 'bar') {
    const barData = data as BarDataItem[];
    return (
      <div style={{ height: '150px' }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={barData} margin={{ top: 5, right: 5, left: -15, bottom: 5 }}>
            <defs>
              {AGE_COLORS.map((color, idx) => (
                <linearGradient key={idx} id={`barGrad-${kpi.id}-${idx}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={color} stopOpacity={0.9} />
                  <stop offset="100%" stopColor={color} stopOpacity={0.7} />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
            <XAxis dataKey="label" tick={{ fontSize: 9 }} interval={0} angle={-45} textAnchor="end" height={35} />
            <YAxis tick={{ fontSize: 9 }} tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}K` : v} />
            <Tooltip formatter={(v: number) => v.toLocaleString()} />
            <Bar dataKey="value" radius={[2, 2, 0, 0]}>
              {barData.map((entry, idx) => <Cell key={idx} fill={entry.color || `url(#barGrad-${kpi.id}-${idx % AGE_COLORS.length})`} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    );
  }
  
  // table
  if (chartType === 'table') {
    const tableData = data as { columns: any[]; rows: any[] };
    return (
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              {tableData.columns.map((col) => (
                <th key={col.key} className={`px-2 py-1.5 font-medium text-gray-600 ${col.align === 'right' ? 'text-right' : 'text-left'}`}>
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tableData.rows.map((row, idx) => (
              <tr key={idx} className="border-b border-gray-100 hover:bg-blue-50/30">
                {tableData.columns.map((col) => (
                  <td key={col.key} className={`px-2 py-1.5 ${col.align === 'right' ? 'text-right' : ''}`}>
                    {typeof row[col.key] === 'number' 
                      ? col.format === 'percent' ? `${row[col.key].toFixed(1)}%` : row[col.key].toLocaleString()
                      : row[col.key]
                    }
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }
  
  return <div className="text-xs text-gray-400">지원되지 않는 차트 유형</div>;
}

/* ═══════════════════════════════════════════════════════════════════════════════
   KPI 시계열 차트 컴포넌트 (일별 추이 그래프)
   - KPI 1개 = 1개 미니 라인 차트
═══════════════════════════════════════════════════════════════════════════════ */
interface TimeSeriesKPIData {
  dailyData: { date: string; value: number }[];
  current: number;
  baseline: number;
  target: number;
  unit: string;
  higherBetter: boolean;
}

const KPI_LINE_COLORS = [
  '#3b82f6', // blue
  '#22c55e', // green
  '#f59e0b', // amber
  '#8b5cf6', // purple
  '#ec4899', // pink
  '#06b6d4', // cyan
];

function KPITimeSeriesChart({ kpiDef, data, colorIndex }: { kpiDef: KPIDefinition; data: TimeSeriesKPIData | null; colorIndex: number }) {
  if (!data) {
    return (
      <div className="bg-gray-50 rounded-lg p-2 h-[120px] flex items-center justify-center">
        <div className="w-full h-16 bg-gray-100 rounded animate-pulse" />
      </div>
    );
  }
  
  const { dailyData, current, baseline, target, unit, higherBetter } = data;
  const lineColor = KPI_LINE_COLORS[colorIndex % KPI_LINE_COLORS.length];
  const isMet = higherBetter ? current >= target : current <= target;
  
  return (
    <div className="bg-gray-50 rounded-lg p-2">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] font-medium text-gray-600">{kpiDef.name}</span>
        <span className={`text-xs font-bold ${isMet ? 'text-green-600' : 'text-amber-600'}`}>
          {current}{unit}
        </span>
      </div>
      
      {/* 미니 라인 차트 */}
      <div style={{ height: '80px' }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={dailyData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id={`kpiGrad-${kpiDef.id}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={lineColor} stopOpacity={0.3} />
                <stop offset="100%" stopColor={lineColor} stopOpacity={0.05} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="2 2" vertical={false} stroke="#e5e7eb" />
            <XAxis 
              dataKey="date" 
              tick={{ fontSize: 8 }} 
              tickLine={false}
              axisLine={{ stroke: '#e5e7eb' }}
              interval={Math.floor(dailyData.length / 4)}
            />
            <YAxis 
              tick={{ fontSize: 8 }} 
              tickLine={false}
              axisLine={false}
              domain={['auto', 'auto']}
              width={30}
            />
            <Tooltip 
              contentStyle={{ fontSize: '10px', padding: '4px 8px' }}
              formatter={(v: number) => [`${v}${unit}`, kpiDef.name]}
              labelFormatter={(label) => `${label}일`}
            />
            {/* 목표선 */}
            <ReferenceLine y={target} stroke="#ef4444" strokeDasharray="3 3" strokeWidth={1} />
            {/* 기준선 */}
            <ReferenceLine y={baseline} stroke="#9ca3af" strokeDasharray="2 2" strokeWidth={1} />
            {/* 영역 */}
            <Area 
              type="monotone" 
              dataKey="value" 
              fill={`url(#kpiGrad-${kpiDef.id})`}
              stroke="none"
            />
            {/* 라인 */}
            <Line 
              type="monotone" 
              dataKey="value" 
              stroke={lineColor} 
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 3, fill: lineColor }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════════
   메인 컴포넌트
═══════════════════════════════════════════════════════════════════════════════ */
export function NationalDashboard() {
  const [selectedKPI, setSelectedKPI] = useState<string | null>(null);
  const [activeDonutIndex, setActiveDonutIndex] = useState<number | null>(null);
  const [showKpiSummaryTable, setShowKpiSummaryTable] = useState(false); // KPI 요약 테이블 토글
  const [timeFilter, setTimeFilter] = useState<'week' | 'month' | 'quarter'>('week'); // 시간 필터
  
  // ResizeObserver 훅으로 컨테이너 크기 추적 (반응형)
  const [containerRef, containerSize] = useResizeObserver<HTMLDivElement>();
  
  // 드릴다운 상태 (Zustand)
  const { drillLevel, drillPath, selectedRegion, drillDown, drillUp, drillTo, resetDrill } = useDrillState();
  
  const statsScopeKey = selectedRegion?.name || 'national';
  
  // 반응형 레이아웃 모드 결정
  const layoutMode = useMemo(() => {
    if (containerSize.width >= 1280) return 'desktop'; // 1:3:2
    if (containerSize.width >= 768) return 'tablet';   // 2단
    return 'mobile'; // 1열 스택
  }, [containerSize.width]);

  // KPI 사전에서 패널별 KPI 가져오기
  const leftKPIs = useMemo(() => getKPIsByPanel('left'), []);
  // 케이스 이동 현황(center-load) 제거: bar 타입이고 id가 center-load가 아닌 것만
  const rightKPIs = useMemo(() => getKPIsForLevel(drillLevel).filter(k => 
    ['donut', 'bar', 'table'].includes(k.visualization.chartType) && 
    k.id !== 'total-cases' &&
    k.id !== 'center-load' && // 케이스 이동 현황 제거
    k.id !== 'kpi-summary-table' // KPI 요약 테이블은 별도 토글로 처리
  ), [drillLevel]);
  const bottomKPIs = useMemo(() => getKPIsByPanel('bottom'), []);
  
  // KPI 통계 지표용 KPI 목록 (chartEnabled=true인 것만, 하드코딩 금지)
  const bulletKPIs = useMemo(() => getChartEnabledKPIs(drillLevel), [drillLevel]);

  /* ─────────────────────────────────────────────────────────────
     KPI 데이터 (KPI 사전 기반) - 필터 연동
  ───────────────────────────────────────────────────────────── */
  const kpiDataMap = useMemo(() => {
    const result: Record<string, any> = {};
    [...leftKPIs, ...rightKPIs, ...bottomKPIs, ...bulletKPIs].forEach(kpi => {
      result[kpi.id] = fetchKPIData(kpi.id, selectedRegion?.code || 'KR', drillLevel, timeFilter);
    });
    return result;
  }, [leftKPIs, rightKPIs, bottomKPIs, bulletKPIs, selectedRegion, drillLevel, timeFilter]);

  /* ─────────────────────────────────────────────────────────────
     트리맵 데이터 (지역별 케이스) - 히트맵 스타일
  ───────────────────────────────────────────────────────────── */
  const treemapData = useMemo(() => {
    // 지역별 데이터 생성
    const rawData = [
      { name: '경기도', size: Math.round(seededValue(`${statsScopeKey}-tree-경기`, 2500, 3500)) },
      { name: '경상남도', size: Math.round(seededValue(`${statsScopeKey}-tree-경남`, 1800, 2500)) },
      { name: '부산광역시', size: Math.round(seededValue(`${statsScopeKey}-tree-부산`, 1500, 2200)) },
      { name: '인천광역시', size: Math.round(seededValue(`${statsScopeKey}-tree-인천`, 1200, 1800)) },
      { name: '충청남도', size: Math.round(seededValue(`${statsScopeKey}-tree-충남`, 1000, 1500)) },
      { name: '전라남도', size: Math.round(seededValue(`${statsScopeKey}-tree-전남`, 900, 1400)) },
      { name: '경상북도', size: Math.round(seededValue(`${statsScopeKey}-tree-경북`, 800, 1300)) },
      { name: '대구광역시', size: Math.round(seededValue(`${statsScopeKey}-tree-대구`, 700, 1100)) },
      { name: '서울특별시', size: Math.round(seededValue(`${statsScopeKey}-tree-서울`, 600, 1000)) },
      { name: '충청북도', size: Math.round(seededValue(`${statsScopeKey}-tree-충북`, 500, 900)) },
      { name: '강원특별자치도', size: Math.round(seededValue(`${statsScopeKey}-tree-강원`, 400, 800)) },
      { name: '전북특별자치도', size: Math.round(seededValue(`${statsScopeKey}-tree-전북`, 350, 700)) },
      { name: '제주특별자치도', size: Math.round(seededValue(`${statsScopeKey}-tree-제주`, 300, 600)) },
      { name: '울산광역시', size: Math.round(seededValue(`${statsScopeKey}-tree-울산`, 400, 700)) },
      { name: '광주광역시', size: Math.round(seededValue(`${statsScopeKey}-tree-광주`, 450, 750)) },
      { name: '세종특별자치시', size: Math.round(seededValue(`${statsScopeKey}-tree-세종`, 250, 500)) },
    ];
    
    // 최대/최소 값 계산
    const maxSize = Math.max(...rawData.map(d => d.size));
    const minSize = Math.min(...rawData.map(d => d.size));
    
    // 히트맵 색상 함수 (오렌지 -> 레드)
    const getHeatmapColor = (value: number) => {
      const ratio = (value - minSize) / (maxSize - minSize);
      // 노란 -> 오렌지 -> 빨간색 그라데이션
      if (ratio < 0.25) return '#fcd34d'; // yellow-300
      if (ratio < 0.5) return '#fb923c';  // orange-400
      if (ratio < 0.75) return '#f97316'; // orange-500
      return '#dc2626';                    // red-600
    };
    
    return rawData.map(item => ({
      ...item,
      fill: getHeatmapColor(item.size),
    }));
  }, [statsScopeKey]);

  const totalCases = useMemo(() => treemapData.reduce((sum, item) => sum + item.size, 0), [treemapData]);

  /* ─────────────────────────────────────────────────────────────
     시계열 추이 데이터
  ───────────────────────────────────────────────────────────── */
  const timeSeriesData = useMemo(() => {
    const years = ['2018', '2019', '2020', '2021', '2022', '2023', '2024', '2025', '2026'];
    return years.map((year, idx) => ({
      year,
      처리량: Math.round(seededValue(`${statsScopeKey}-ts-${idx}`, 12000, 18000)),
      증감률: Number(seededValue(`${statsScopeKey}-ts-rate-${idx}`, -5, 10).toFixed(1)),
    }));
  }, [statsScopeKey]);

  /* ─────────────────────────────────────────────────────────────
     커스텀 트리맵 컨텐트
  ───────────────────────────────────────────────────────────── */
  const CustomTreemapContent = (props: any) => {
    const { x, y, width, height, name, fill } = props;
    if (width < 25 || height < 18) return null;
    
    // 짧은 이름으로 변환 (예: 강원특별자치도 -> 강원특별자치도 또는 짧게)
    const shortName = name.length > 5 ? name.replace(/특별자치도|특별자치시|광역시|특별시/g, '').trim() || name.slice(0, 4) : name;
    
    return (
      <g>
        <rect 
          x={x} 
          y={y} 
          width={width} 
          height={height} 
          fill={fill} 
          stroke="#fff" 
          strokeWidth={1.5}
          rx={2}
          style={{ filter: 'brightness(1.0)', transition: 'filter 0.2s' }}
        />
        {width > 35 && height > 25 && (
          <text 
            x={x + width / 2} 
            y={y + height / 2} 
            textAnchor="middle" 
            dominantBaseline="middle" 
            fill="#fff" 
            fontSize={width > 70 ? 10 : 8} 
            fontWeight="600"
            style={{ textShadow: '0 1px 2px rgba(0,0,0,0.4)' }}
          >
            {shortName}
          </text>
        )}
      </g>
    );
  };

  /* ─────────────────────────────────────────────────────────────
     지도 클릭 핸들러 (드릴다운 연동)
  ───────────────────────────────────────────────────────────── */
  const handleRegionSelect = useCallback(({ level, code, name }: { level: string; code: string; name: string }) => {
    const drillLevelMap: Record<string, DrillLevel> = {
      'ctprvn': 'sido',
      'sig': 'sigungu',
      'emd': 'center',
    };
    const newLevel = drillLevelMap[level] || 'nation';
    if (newLevel !== 'nation') {
      drillDown({ code, name, level: newLevel });
    }
  }, [drillDown]);

  return (
    <div ref={containerRef} className="h-[100dvh] min-h-screen flex flex-col bg-gray-50 overflow-hidden">
      {/* ═══════════════════════════════════════════════════════════
          HEADER
      ═══════════════════════════════════════════════════════════ */}
      <header className="h-10 bg-white border-b border-gray-200 flex items-center px-4 shrink-0">
        <h1 className="text-sm font-bold text-gray-800">전국 운영 대시보드</h1>
        {/* 시간 필터 버튼 - 상태 연동 */}
        <div className="flex items-center gap-1 ml-4">
          {(['week', 'month', 'quarter'] as const).map(filter => (
            <button
              key={filter}
              onClick={() => setTimeFilter(filter)}
              className={`px-2 py-0.5 text-[10px] rounded transition-colors ${
                timeFilter === filter 
                  ? 'bg-blue-500 text-white' 
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {filter === 'week' ? '주간' : filter === 'month' ? '월간' : '분기'}
            </button>
          ))}
        </div>
        <div className="flex-1" />
        
        {/* ═══ Breadcrumb + Back 버튼 ═══ */}
        <div className="flex items-center gap-2 mr-4">
          {drillPath.length > 1 && (
            <button
              onClick={drillUp}
              className="flex items-center gap-1 px-2 py-1 text-xs text-blue-600 bg-blue-50 rounded hover:bg-blue-100 transition-colors"
            >
              <ChevronLeft className="h-3 w-3" />
              <span>이전</span>
            </button>
          )}
          <div className="flex items-center gap-1 text-xs text-gray-600">
            {drillPath.map((item, idx) => (
              <React.Fragment key={`${item.level}-${item.code}`}>
                <button
                  onClick={() => drillTo(idx)}
                  className={`px-1.5 py-0.5 rounded transition-colors ${
                    idx === drillPath.length - 1 
                      ? 'bg-blue-500 text-white font-medium' 
                      : 'hover:bg-gray-200 text-gray-600'
                  }`}
                >
                  {item.name}
                </button>
                {idx < drillPath.length - 1 && <ChevronRight className="h-3 w-3 text-gray-400" />}
              </React.Fragment>
            ))}
          </div>
          {drillPath.length > 1 && (
            <button
              onClick={resetDrill}
              className="p-1 text-gray-500 hover:text-blue-600 hover:bg-gray-100 rounded transition-colors"
              title="전국으로 돌아가기"
            >
              <Home className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        
        <div className="flex items-center gap-2 text-gray-500">
          <button className="p-1.5 hover:bg-gray-100 rounded"><HelpCircle className="h-4 w-4" /></button>
          <button className="p-1.5 hover:bg-gray-100 rounded"><BarChart3 className="h-4 w-4" /></button>
          <button className="p-1.5 hover:bg-gray-100 rounded"><Download className="h-4 w-4" /></button>
        </div>
      </header>

      {/* ═══════════════════════════════════════════════════════════
          MAIN CONTENT - 반응형 레이아웃
          - Desktop (>=1280px): 1:3:2 (Left / CenterMap / Right)
          - Tablet (768-1279px): 2단 (상단 Map, 하단 2열)
          - Mobile (<768px): 1열 스택
      ═══════════════════════════════════════════════════════════ */}
      <div className={`flex-1 overflow-hidden p-2 gap-2 min-h-0 ${
        layoutMode === 'desktop' 
          ? 'flex flex-row' 
          : layoutMode === 'tablet'
          ? 'flex flex-col'
          : 'flex flex-col overflow-y-auto'
      }`}>
        
        {/* ═══════════════════════════════════════════════════════
            LEFT COLUMN - 요약 통계
            Desktop: flex-[3], Tablet: 하단 2열 중 1열, Mobile: 전체 폭
        ═══════════════════════════════════════════════════════ */}
        <div className={`flex flex-col gap-2 ${
          layoutMode === 'desktop' 
            ? 'flex-[3] min-w-[280px]' 
            : layoutMode === 'tablet'
            ? 'hidden' // 태블릿에선 하단에 배치
            : 'w-full shrink-0'
        }`}>
          
          {/* 현재 드릴 레벨 표시 */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-2 text-center">
            <span className="text-xs text-blue-700 font-medium">
              {getDrillLevelLabel(drillLevel)} 보기
            </span>
            {selectedRegion && (
              <span className="ml-2 text-xs text-blue-600">({selectedRegion.name})</span>
            )}
          </div>
          
          {/* 총 처리건수 + 트리맵 */}
          <div className="bg-white border border-gray-200 rounded-lg p-3 flex-1 min-h-[200px]">
            <div className="text-xs text-gray-500 mb-1">총 처리건수</div>
            <div className="text-2xl font-bold text-blue-600 mb-3">
              {totalCases.toLocaleString()} <span className="text-sm font-normal text-gray-500">건</span>
            </div>
            <div className="h-[calc(100%-60px)] min-h-[140px]">
              {containerSize.width > 0 && containerSize.height > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <Treemap
                    data={treemapData}
                    dataKey="size"
                    aspectRatio={4 / 3}
                    stroke="#fff"
                    content={<CustomTreemapContent />}
                  />
                </ResponsiveContainer>
              ) : (
                <div className="h-full bg-gray-100 rounded animate-pulse flex items-center justify-center">
                  <span className="text-xs text-gray-400">로딩 중...</span>
                </div>
              )}
            </div>
          </div>

          {/* 활성 알림 */}
          <div className="bg-white border border-gray-200 rounded-lg p-3">
            <div className="text-xs text-gray-500 mb-1">전국 활성 알림 수 <HelpCircle className="inline h-3 w-3 text-gray-400" /></div>
            <div className="text-2xl font-bold text-blue-600">
              {Math.round(seededValue(`${statsScopeKey}-foreign`, 180000, 220000)).toLocaleString()} <span className="text-sm font-normal text-gray-500">건</span>
            </div>
            <div className="flex items-center gap-1 mt-1 text-xs">
              <span className="text-gray-500">전월대비</span>
              <span className="text-red-500 flex items-center">
                {seededValue(`${statsScopeKey}-foreign-change`, 3, 8).toFixed(2)}% <TrendingUp className="h-3 w-3 ml-0.5" />
              </span>
            </div>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════
            CENTER COLUMN - GeoMap
            Desktop: flex-[4], Tablet: 전체 폭, Mobile: 전체 폭
        ═══════════════════════════════════════════════════════ */}
        <div className={`${
          layoutMode === 'desktop' 
            ? 'flex-[4] min-w-0' 
            : 'w-full shrink-0'
        }`}>
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden h-full flex flex-col min-h-[300px]">
            <div className="px-3 py-2 border-b border-gray-100 flex items-center justify-between bg-gray-50">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-gray-700">지도</span>
                <span className="px-2 py-0.5 bg-red-500 text-white text-[10px] rounded">
                  {getDrillLevelLabel(drillLevel)}
                </span>
              </div>
              <button className="p-1 hover:bg-gray-200 rounded"><Download className="h-3.5 w-3.5 text-gray-500" /></button>
            </div>
            <div className="flex-1 p-2">
              <GeoMapPanel
                key={`national-${selectedKPI || 'default'}-${drillLevel}`}
                title=""
                indicatorId={selectedKPI || 'completion'}
                year={2026}
                scope={{ mode: 'national' }}
                variant="portal"
                mapHeight={400}
                hideBreadcrumb
                externalLevel={drillLevel === 'nation' ? 'ctprvn' : drillLevel === 'sido' ? 'sig' : 'emd'}
                onRegionSelect={handleRegionSelect}
                onGoBack={drillUp}
              />
            </div>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════
            RIGHT COLUMN - KPI 사전 기반 자동 렌더링
            Desktop: flex-[3], Tablet: 하단 2열 중 1열, Mobile: 전체 폭
        ═══════════════════════════════════════════════════════ */}
        <div className={`flex flex-col gap-2 overflow-y-auto ${
          layoutMode === 'desktop' 
            ? 'flex-[3] min-w-[280px]' 
            : layoutMode === 'tablet'
            ? 'hidden' // 태블릿에선 하단에 배치
            : 'w-full shrink-0'
        }`}>
          
          {/* 파이 차트들을 같은 선상에 배치 (2열 그리드) */}
          <div className="grid grid-cols-2 gap-3">
            {rightKPIs.filter(kpi => kpi.visualization.chartType === 'donut').map(kpi => {
              const data = kpiDataMap[kpi.id];
              if (!data) return null;
              
              return (
                <div key={kpi.id} className="bg-white border border-gray-200 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-gray-700">{kpi.name}</span>
                      <HelpCircle className="h-3 w-3 text-gray-400" />
                    </div>
                    <div className="flex items-center gap-1">
                      <button className="px-2 py-0.5 text-[10px] text-blue-600 bg-blue-50 rounded hover:bg-blue-100">통계표 보기</button>
                      <button className="p-1 hover:bg-gray-100 rounded"><Download className="h-3 w-3 text-gray-500" /></button>
                    </div>
                  </div>
                  <KPIWidget 
                    kpi={kpi} 
                    data={data} 
                    statsScopeKey={statsScopeKey}
                    activeDonutIndex={activeDonutIndex}
                    setActiveDonutIndex={setActiveDonutIndex}
                  />
                  {/* 도넛 차트 범례 */}
                  {Array.isArray(data) && (
                    <div className="flex flex-wrap justify-center gap-2 mt-2">
                      {(data as DonutDataItem[]).map((item, idx) => (
                        <div key={idx} className="flex items-center gap-1 text-[10px]">
                          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                          <span>{item.name} {((item.value / (data as DonutDataItem[]).reduce((s, i) => s + i.value, 0)) * 100).toFixed(1)}%</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* ═══════════════════════════════════════════════════════
              KPI 통계 지표 (시계열 그래프) - KPI 사전 기반 자동 생성
              - 하드코딩 금지: chartEnabled=true인 KPI만 자동 포함
              - 필터(주간/월간/분기)와 연동되어 일별 데이터 표시
          ═══════════════════════════════════════════════════════ */}
          <div className="bg-white border border-gray-200 rounded-lg p-3 flex-1 min-h-[300px]">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-gray-700">KPI 통계 지표</span>
                <HelpCircle className="h-3 w-3 text-gray-400" title="KPI 사전에 등록된 지표만 자동 표시됩니다" />
              </div>
              <div className="flex items-center gap-1">
                <button className="px-2 py-0.5 text-[10px] text-blue-600 bg-blue-50 rounded hover:bg-blue-100">통계표 보기</button>
                <button className="p-1 hover:bg-gray-100 rounded"><Download className="h-3 w-3 text-gray-500" /></button>
              </div>
            </div>
            
            {/* 시계열 KPI 차트 그리드 - 2열 */}
            <div className="grid grid-cols-2 gap-2">
              {bulletKPIs.length > 0 ? (
                bulletKPIs.map((kpi, idx) => (
                  <KPITimeSeriesChart 
                    key={kpi.id}
                    kpiDef={kpi} 
                    data={kpiDataMap[kpi.id] as TimeSeriesKPIData | null}
                    colorIndex={idx}
                  />
                ))
              ) : (
                <div className="col-span-2 text-xs text-gray-400 text-center py-4">
                  표시할 KPI 지표가 없습니다
                </div>
              )}
            </div>
            
            {/* 범례 */}
            <div className="flex items-center justify-center gap-4 mt-3 text-[10px] text-gray-500 border-t border-gray-100 pt-2">
              <div className="flex items-center gap-1">
                <span className="w-4 h-0.5 bg-gray-400" style={{ borderTop: '1px dashed #9ca3af' }} />
                <span>기준선</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="w-4 h-0.5 bg-red-500" style={{ borderTop: '1px dashed #ef4444' }} />
                <span>목표</span>
              </div>
            </div>
          </div>

          {/* 나머지 KPI 위젯들 (도넛 차트 제외, center-load 제외) */}
          {rightKPIs.filter(kpi => 
            kpi.visualization.chartType !== 'donut' && 
            kpi.visualization.chartType !== 'table'
          ).map(kpi => {
            const data = kpiDataMap[kpi.id];
            if (!data) return null;
            
            return (
              <div key={kpi.id} className="bg-white border border-gray-200 rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-gray-700">{kpi.name}</span>
                    <HelpCircle className="h-3 w-3 text-gray-400" />
                  </div>
                  <div className="flex items-center gap-1">
                    <button className="px-2 py-0.5 text-[10px] text-blue-600 bg-blue-50 rounded hover:bg-blue-100">통계표 보기</button>
                    <button className="p-1 hover:bg-gray-100 rounded"><Download className="h-3 w-3 text-gray-500" /></button>
                  </div>
                </div>
                <KPIWidget 
                  kpi={kpi} 
                  data={data} 
                  statsScopeKey={statsScopeKey}
                  activeDonutIndex={activeDonutIndex}
                  setActiveDonutIndex={setActiveDonutIndex}
                />
              </div>
            );
          })}

          {/* KPI 요약 테이블 - 토글로 숨김 처리 (기본: 숨김) */}
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <button
              onClick={() => setShowKpiSummaryTable(!showKpiSummaryTable)}
              className="w-full flex items-center justify-between p-3 hover:bg-gray-50 transition-colors"
            >
              <span className="text-xs font-medium text-gray-700">KPI 요약 테이블</span>
              <div className="flex items-center gap-2">
                <button 
                  onClick={(e) => { e.stopPropagation(); /* Excel 다운로드 */ }}
                  className="px-2 py-0.5 text-[10px] text-blue-600 bg-blue-50 rounded hover:bg-blue-100"
                >
                  Excel 다운로드
                </button>
                {showKpiSummaryTable ? (
                  <ChevronUp className="h-4 w-4 text-gray-400" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-gray-400" />
                )}
              </div>
            </button>
            
            {showKpiSummaryTable && (
              <div className="p-3 pt-0 border-t border-gray-100">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200">
                        <th className="px-2 py-1.5 text-left font-medium text-gray-600">KPI 구분</th>
                        <th className="px-2 py-1.5 text-right font-medium text-gray-600">평균값</th>
                        <th className="px-2 py-1.5 text-right font-medium text-gray-600">최저(지역)</th>
                        <th className="px-2 py-1.5 text-right font-medium text-gray-600">최고(지역)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {/* KPI 사전 기반 자동 생성 */}
                      {bulletKPIs.map(kpi => {
                        const data = kpiDataMap[kpi.id] as TimeSeriesKPIData | null;
                        if (!data) return null;
                        return (
                          <tr key={kpi.id} className="border-b border-gray-100 hover:bg-blue-50/30">
                            <td className="px-2 py-1.5">{kpi.name}</td>
                            <td className="px-2 py-1.5 text-right">{data.current}{data.unit}</td>
                            <td className="px-2 py-1.5 text-right text-red-600">{(data.current * 0.95).toFixed(1)}{data.unit}</td>
                            <td className="px-2 py-1.5 text-right text-blue-600">{(data.current * 1.03).toFixed(1)}{data.unit}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
        
        {/* ═══════════════════════════════════════════════════════
            Tablet 전용 하단 2열 레이아웃
        ═══════════════════════════════════════════════════════ */}
        {layoutMode === 'tablet' && (
          <div className="flex gap-2 flex-1 min-h-0">
            {/* 왼쪽 요약 통계 */}
            <div className="flex-1 flex flex-col gap-2 overflow-y-auto">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-2 text-center">
                <span className="text-xs text-blue-700 font-medium">
                  {getDrillLevelLabel(drillLevel)} 보기
                </span>
                {selectedRegion && (
                  <span className="ml-2 text-xs text-blue-600">({selectedRegion.name})</span>
                )}
              </div>
              <div className="bg-white border border-gray-200 rounded-lg p-3 flex-1">
                <div className="text-xs text-gray-500 mb-1">총 처리건수</div>
                <div className="text-2xl font-bold text-blue-600 mb-3">
                  {totalCases.toLocaleString()} <span className="text-sm font-normal text-gray-500">건</span>
                </div>
                <div className="h-[140px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <Treemap data={treemapData} dataKey="size" aspectRatio={4/3} stroke="#fff" content={<CustomTreemapContent />} />
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
            
            {/* 오른쪽 KPI */}
            <div className="flex-1 flex flex-col gap-2 overflow-y-auto">
              {/* KPI 통계 지표 - 시계열 */}
              <div className="bg-white border border-gray-200 rounded-lg p-3 flex-1">
                <div className="text-xs font-medium text-gray-700 mb-2">KPI 통계 지표</div>
                <div className="grid grid-cols-2 gap-2">
                  {bulletKPIs.slice(0, 4).map((kpi, idx) => (
                    <KPITimeSeriesChart 
                      key={kpi.id}
                      kpiDef={kpi} 
                      data={kpiDataMap[kpi.id] as TimeSeriesKPIData | null}
                      colorIndex={idx}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ═══════════════════════════════════════════════════════════
          BOTTOM - 시계열 차트 (전체 너비)
      ═══════════════════════════════════════════════════════════ */}
      <div className="shrink-0 px-3 pb-3">
        <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-semibold text-gray-700">연간 처리량 추이</span>
            <div className="flex items-center gap-1">
              <button className="px-2 py-0.5 text-[10px] text-blue-600 bg-blue-50 rounded hover:bg-blue-100">통계표 보기</button>
              <button className="p-1 hover:bg-gray-100 rounded"><Download className="h-3 w-3 text-gray-500" /></button>
            </div>
          </div>
          <div style={{ height: '180px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={timeSeriesData} margin={{ top: 10, right: 40, left: 0, bottom: 5 }}>
                <defs>
                  <linearGradient id="timeBarGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#22c55e" stopOpacity={0.9}/>
                    <stop offset="100%" stopColor="#16a34a" stopOpacity={0.9}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                <XAxis dataKey="year" tick={{ fontSize: 10 }} />
                <YAxis yAxisId="left" tick={{ fontSize: 10 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}K`} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10 }} tickFormatter={(v) => `${v}%`} domain={[-20, 20]} />
                <Tooltip formatter={(value: number, name: string) => [name === '처리량' ? value.toLocaleString() + '건' : value + '%', name]} />
                <Legend wrapperStyle={{ fontSize: '11px' }} />
                <Bar yAxisId="left" dataKey="처리량" fill="url(#timeBarGradient)" radius={[6, 6, 0, 0]} name="처리량" />
                <Line yAxisId="right" type="monotone" dataKey="증감률" stroke="#16a34a" strokeWidth={3} dot={{ fill: '#16a34a', r: 5, strokeWidth: 2, stroke: '#fff' }} name="증감률" />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}

