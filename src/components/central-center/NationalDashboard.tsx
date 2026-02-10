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
  LineChart,
  Area,
  Legend,
  Treemap,
  Sector,
  ReferenceLine,
  ScatterChart,
  Scatter,
  ZAxis,
} from 'recharts';
import { GeoMapPanel, type MapColorScheme } from '../geomap/GeoMapPanel';
import { COLOR_PALETTES } from '../../lib/choroplethScale';
import { useDrillState, getDrillLevelLabel } from '../../lib/useDrillState';
import { getKPIsByPanel, getKPIsForLevel, fetchKPIData, getChartEnabledKPIs } from '../../lib/kpiDictionary';
import { KPIDefinition, DrillLevel, DonutDataItem, BarDataItem } from '../../lib/kpi.types';

/* ═══════════════════════════════════════════════════════════════════════════════
   ResizeObserver 인라인 훅 (새 파일 생성 금지에 따른 인라인 구현)
   - rAF 디바운스 + StrictMode 안전 처리 + 0 width/height 방어
═══════════════════════════════════════════════════════════════════════════════ */
function useResizeObserver<T extends HTMLElement>(): [React.RefObject<T | null>, { width: number; height: number }] {
  const ref = useRef<T | null>(null);
  // 초기값을 window 크기로 설정하여 초기 로딩 시 desktop 모드 보장
  const [size, setSize] = useState({ 
    width: typeof window !== 'undefined' ? window.innerWidth : 1920, 
    height: typeof window !== 'undefined' ? window.innerHeight : 1080 
  });
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

// 연령대별 색상 (영유아~노년 구분)
const AGE_GROUP_COLORS: Record<string, string> = {
  '영유아': '#93c5fd',      // 연한 파랑 (0-4)
  '어린이': '#60a5fa',      // 파랑 (5-14)
  '청소년': '#3b82f6',      // 진한 파랑 (15-19)
  '청년': '#86efac',        // 연두색 (20-34)
  '장년': '#fcd34d',        // 노란색 (35-64)
  '노년': '#f9a8d4',        // 핑크색 (65+)
};

// 5세 단위 연령대 색상 (life stage 기반)
const getAgeColor = (ageLabel: string): string => {
  const age = parseInt(ageLabel);
  if (isNaN(age)) {
    // 라벨이 숫자가 아닌 경우 (예: '85~')
    if (ageLabel.includes('85') || ageLabel.includes('80')) return '#d946ef'; // 보라
    if (ageLabel.includes('75') || ageLabel.includes('70')) return '#f472b6'; // 핑크
    return '#f9a8d4';
  }
  if (age < 5) return '#bfdbfe';   // 영유아 - 매우 연한 파랑
  if (age < 10) return '#93c5fd';  // 어린이1 - 연한 파랑
  if (age < 15) return '#60a5fa';  // 어린이2 - 파랑
  if (age < 20) return '#3b82f6';  // 청소년 - 진한 파랑
  if (age < 25) return '#86efac';  // 청년1 - 연두
  if (age < 30) return '#4ade80';  // 청년2 - 초록
  if (age < 35) return '#22c55e';  // 청년3 - 진한 초록
  if (age < 40) return '#fef08a';  // 장년1 - 연한 노랑
  if (age < 45) return '#fde047';  // 장년2 - 노랑
  if (age < 50) return '#facc15';  // 장년3 - 진한 노랑
  if (age < 55) return '#eab308';  // 장년4 - 골드
  if (age < 60) return '#ca8a04';  // 장년5 - 진한 골드
  if (age < 65) return '#a16207';  // 장년6 - 브라운
  if (age < 70) return '#fda4af';  // 노년1 - 연한 핑크
  if (age < 75) return '#fb7185';  // 노년2 - 핑크
  if (age < 80) return '#f472b6';  // 노년3 - 진한 핑크
  if (age < 85) return '#e879f9';  // 노년4 - 연한 보라
  return '#d946ef';                 // 노년5 - 보라
};

const AGE_COLORS = ['#3b82f6', '#60a5fa', '#22c55e', '#f59e0b', '#ec4899', '#8b5cf6'];

/* ═══════════════════════════════════════════════════════════════════════════════
   지도 KPI 선택 카드 정의 (상단 통계 카드 → 지도 연동)
   - geoIndicators.ts의 id와 매핑
═══════════════════════════════════════════════════════════════════════════════ */
type MapKpiCardDef = {
  id: string;           // geoIndicators.ts의 indicatorId
  label: string;        // 카드 표시명
  unit: string;         // 단위
  color: string;        // 카드 강조 색상
  iconBg: string;       // 아이콘 배경
  getValue: (seed: string) => number; // Mock 값 생성
};

const MAP_KPI_CARDS: MapKpiCardDef[] = [
  {
    id: 'total_cases',
    label: '신규 유입',
    unit: '건',
    color: 'blue',
    iconBg: 'bg-blue-100 text-blue-600',
    getValue: (seed) => Math.round(seededValue(`${seed}-new`, 1200, 2800)),
  },
  {
    id: 'completion',
    label: '처리 중',
    unit: '건',
    color: 'green',
    iconBg: 'bg-green-100 text-green-600',
    getValue: (seed) => Math.round(seededValue(`${seed}-progress`, 800, 1500)),
  },
  {
    id: 'consultation_time',
    label: 'SLA 위반',
    unit: '%',
    color: 'red',
    iconBg: 'bg-red-100 text-red-600',
    getValue: (seed) => Number(seededValue(`${seed}-sla`, 2.5, 8.5).toFixed(1)),
  },
  {
    id: 'followup_dropout',
    label: '데이터 부족률',
    unit: '%',
    color: 'orange',
    iconBg: 'bg-amber-100 text-amber-600',
    getValue: (seed) => Number(seededValue(`${seed}-data`, 3.0, 12.0).toFixed(1)),
  },
  {
    id: 'dropout',
    label: '재접촉 필요',
    unit: '%',
    color: 'purple',
    iconBg: 'bg-purple-100 text-purple-600',
    getValue: (seed) => Number(seededValue(`${seed}-recontact`, 5.0, 15.0).toFixed(1)),
  },
];

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
    const isAgeDistribution = kpi.id === 'case-distribution';
    
    // 연령대 분포 차트는 특별한 색상 스키마 적용
    const enhancedBarData = isAgeDistribution 
      ? barData.map(item => ({
          ...item,
          fill: getAgeColor(item.label),
        }))
      : barData;
    
    return (
      <div style={{ height: '180px' }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart 
            data={enhancedBarData} 
            margin={{ top: 15, right: 10, left: -10, bottom: 25 }}
            barCategoryGap="8%"
          >
            <defs>
              {enhancedBarData.map((item, idx) => (
                <linearGradient key={idx} id={`barGrad-${kpi.id}-${idx}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={item.fill || item.color || AGE_COLORS[idx % AGE_COLORS.length]} stopOpacity={0.95} />
                  <stop offset="100%" stopColor={item.fill || item.color || AGE_COLORS[idx % AGE_COLORS.length]} stopOpacity={0.75} />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
            <XAxis 
              dataKey="label" 
              tick={{ fontSize: 12, fill: '#4b5563' }} 
              interval={0} 
              tickLine={false}
              axisLine={{ stroke: '#d1d5db' }}
            />
            <YAxis 
              tick={{ fontSize: 11, fill: '#6b7280' }} 
              tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}K` : v}
              axisLine={false}
              tickLine={false}
              width={38}
            />
            <Tooltip 
              formatter={(v: number) => [v.toLocaleString() + '건', '건수']}
              contentStyle={{ 
                backgroundColor: 'rgba(255,255,255,0.95)', 
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
                boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)'
              }}
              cursor={{ fill: 'rgba(59, 130, 246, 0.1)' }}
            />
            <Bar 
              dataKey="value" 
              radius={[6, 6, 0, 0]}
              label={({ x, y, width, value }) => (
                <text 
                  x={x + width / 2} 
                  y={y - 5} 
                  fill="#374151" 
                  textAnchor="middle" 
                  fontSize={11}
                  fontWeight={500}
                >
                  {value >= 1000 ? `${(value / 1000).toFixed(1)}K` : value.toLocaleString()}
                </text>
              )}
            >
              {enhancedBarData.map((entry, idx) => (
                <Cell 
                  key={idx} 
                  fill={`url(#barGrad-${kpi.id}-${idx})`}
                  style={{ filter: 'drop-shadow(0 2px 2px rgba(0,0,0,0.1))' }}
                />
              ))}
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

function KPITimeSeriesChart({ kpiDef, data, colorIndex, analyticsPeriod }: { 
  kpiDef: KPIDefinition; 
  data: TimeSeriesKPIData | null; 
  colorIndex: number;
  analyticsPeriod: 'week' | 'month' | 'quarter' | 'year';
}) {
  if (!data) {
    return (
      <div className="bg-gray-50 rounded-lg p-2 h-[80px] flex items-center justify-center border border-gray-200 shadow-sm">
        <div className="w-full h-10 bg-gray-100 rounded animate-pulse" />
      </div>
    );
  }
  
  const { dailyData, current, baseline, target, unit, higherBetter } = data;
  const lineColor = KPI_LINE_COLORS[colorIndex % KPI_LINE_COLORS.length];
  const isMet = higherBetter ? current >= target : current <= target;
  
  // 시간 필터에 따른 X축 라벨 간격 및 포맷 조정
  // 주간: 7일 모두 표시, 월간: 3개월마다 표시, 분기: 모두 표시
  const xAxisInterval = analyticsPeriod === 'week' ? 0 : analyticsPeriod === 'month' ? 2 : analyticsPeriod === 'year' ? 3 : 0;
  const timeRangeLabel = analyticsPeriod === 'week' ? '주간' : analyticsPeriod === 'month' ? '월간' : analyticsPeriod === 'year' ? '연간(누적)' : '분기';
  
  // 차트별 배경색 그라데이션 (구분용)
  const bgColors = [
    'bg-blue-50/50',
    'bg-green-50/50', 
    'bg-amber-50/50',
    'bg-purple-50/50',
    'bg-pink-50/50',
    'bg-cyan-50/50',
  ];
  const bgColor = bgColors[colorIndex % bgColors.length];
  
  return (
    <div className={`${bgColor} rounded-lg p-2 border border-gray-200 shadow-sm`}>
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-1 pb-1 border-b border-gray-200/60">
        <div className="flex items-center gap-1.5">
          <span 
            className="w-2 h-2 rounded-full flex-shrink-0" 
            style={{ backgroundColor: lineColor }}
          />
          <span className="text-[10px] font-semibold text-gray-700 truncate">{kpiDef.name}</span>
        </div>
        <span className={`text-[11px] font-bold flex-shrink-0 ${isMet ? 'text-green-600' : 'text-amber-600'}`}>
          {current}{unit}
        </span>
      </div>
      
      {/* 라인 차트 - 높이 증가 */}
      <div style={{ height: '90px' }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={dailyData} margin={{ top: 5, right: 5, left: -18, bottom: 2 }}>
            <defs>
              <linearGradient id={`kpiGrad-${kpiDef.id}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={lineColor} stopOpacity={0.35} />
                <stop offset="100%" stopColor={lineColor} stopOpacity={0.05} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
            <XAxis 
              dataKey="date" 
              tick={{ fontSize: 12, fill: '#374151', fontWeight: 500 }} 
              tickLine={false}
              axisLine={{ stroke: '#d1d5db' }}
              interval={xAxisInterval}
            />
            <YAxis 
              tick={{ fontSize: 11, fill: '#6b7280' }} 
              tickLine={false}
              axisLine={false}
              domain={['auto', 'auto']}
              width={30}
            />
            <Tooltip 
              contentStyle={{ fontSize: '12px', padding: '6px 10px', borderRadius: '6px', boxShadow: '0 2px 8px rgba(0,0,0,0.15)' }}
              formatter={(v: number) => [`${v}${unit}`, kpiDef.name]}
              labelFormatter={(label) => `${label}일`}
            />
            {/* 목표선 */}
            <ReferenceLine y={target} stroke="#ef4444" strokeDasharray="4 2" strokeWidth={1.5} label={{ value: '목표', fontSize: 10, fill: '#ef4444', position: 'right' }} />
            {/* 기준선 */}
            <ReferenceLine y={baseline} stroke="#9ca3af" strokeDasharray="3 3" strokeWidth={1} />
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
              activeDot={{ r: 4, fill: lineColor, stroke: '#fff', strokeWidth: 2 }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════════
   KPI 통합 추이 차트 (멀티라인) - 6개 미니차트 → 1개 통합 그래프
═══════════════════════════════════════════════════════════════════════════════ */
const UNIFIED_KPI_DEFS = [
  { key: 'sla',     label: 'SLA 준수율',   unit: '%', mode: 'percent' as const, target: 95,  color: '#3b82f6' },
  { key: 'data',    label: '데이터 충족률', unit: '%', mode: 'percent' as const, target: 90,  color: '#22c55e' },
  { key: 'done',    label: '처리 완료율',   unit: '%', mode: 'percent' as const, target: 90,  color: '#f59e0b' },
  { key: 'ontime',  label: '응답 적시율',   unit: '%', mode: 'percent' as const, target: 85,  color: '#8b5cf6' },
  { key: 'quality', label: '품질 점수',     unit: '점', mode: 'score' as const,  target: 88,  color: '#ec4899' },
  { key: 'tat',     label: '평균 처리시간', unit: '일', mode: 'days' as const,   target: 2.5, color: '#06b6d4' },
] as const;

type UnifiedKpiKey = typeof UNIFIED_KPI_DEFS[number]['key'];

interface KPIUnifiedChartProps {
  bulletKPIs: KPIDefinition[];
  kpiDataMap: Record<string, any>;
  analyticsPeriod: 'week' | 'month' | 'quarter' | 'year';
}

function KPIUnifiedChart({ bulletKPIs, kpiDataMap, analyticsPeriod }: KPIUnifiedChartProps) {
  const [viewMode, setViewMode] = useState<'percent' | 'days'>('percent');
  const [enabledKeys, setEnabledKeys] = useState<UnifiedKpiKey[]>(['sla', 'data', 'done', 'ontime']);

  const toggleKey = useCallback((key: UnifiedKpiKey) => {
    setEnabledKeys(prev => {
      if (prev.includes(key)) return prev.filter(k => k !== key);
      if (prev.length >= 4) return [...prev.slice(1), key]; // 가장 오래된 1개 제거
      return [...prev, key];
    });
  }, []);

  // KPI 사전 ID → UNIFIED_KPI_DEFS key 매핑
  const kpiIdToKey: Record<string, UnifiedKpiKey> = {
    'kpi-sla-rate': 'sla',
    'kpi-data-rate': 'data',
    'kpi-completion-rate': 'done',
    'kpi-response-rate': 'ontime',
    'kpi-quality-score': 'quality',
    'kpi-avg-processing-time': 'tat',
  };

  // 통합 시계열 데이터 생성 (모든 KPI의 dailyData를 date 기준으로 merge)
  const unifiedData = useMemo(() => {
    const dateMap: Record<string, Record<string, number>> = {};
    bulletKPIs.forEach(kpi => {
      const uKey = kpiIdToKey[kpi.id];
      if (!uKey) return;
      const tsData = kpiDataMap[kpi.id] as TimeSeriesKPIData | null;
      if (!tsData?.dailyData) return;
      tsData.dailyData.forEach(d => {
        if (!dateMap[d.date]) dateMap[d.date] = {};
        dateMap[d.date][uKey] = d.value;
      });
    });
    return Object.entries(dateMap).map(([date, values]) => ({ date, ...values }));
  }, [bulletKPIs, kpiDataMap]);

  // 현재 모드의 KPI 정의
  const percentDefs = UNIFIED_KPI_DEFS.filter(d => d.mode === 'percent' || d.mode === 'score');
  const daysDef = UNIFIED_KPI_DEFS.find(d => d.mode === 'days')!;
  const activeDefs = viewMode === 'days' ? [daysDef] : percentDefs;
  const visibleDefs = viewMode === 'days' ? [daysDef] : percentDefs.filter(d => enabledKeys.includes(d.key));

  // Y축 domain
  const yDomain: [number | string, number | string] = viewMode === 'days'
    ? ['dataMin - 0.5', 'dataMax + 0.5']
    : [70, 100];

  const timeRangeLabel = analyticsPeriod === 'week' ? '최근 7일' : analyticsPeriod === 'month' ? '최근 12개월' : analyticsPeriod === 'year' ? '연간 누적' : '분기별';

  // 현재값 조회
  const getCurrentValue = (key: UnifiedKpiKey): string | null => {
    const kpiId = Object.entries(kpiIdToKey).find(([, v]) => v === key)?.[0];
    if (!kpiId) return null;
    const tsData = kpiDataMap[kpiId] as TimeSeriesKPIData | null;
    if (!tsData) return null;
    return `${tsData.current}`;
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-3 shadow-sm">
      {/* ── 헤더 ── */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-gray-800">KPI 통합 추이</span>
          <span className="text-[9px] text-gray-400 bg-gray-50 px-1.5 py-0.5 rounded">{timeRangeLabel}</span>
        </div>
        {/* 모드 토글 */}
        <div className="flex rounded-md border border-gray-200 overflow-hidden">
          <button
            onClick={() => setViewMode('percent')}
            className={`px-2.5 py-1 text-[10px] font-medium transition-colors ${
              viewMode === 'percent'
                ? 'bg-blue-500 text-white'
                : 'bg-white text-gray-600 hover:bg-gray-50'
            }`}
          >
            품질/성과(%)
          </button>
          <button
            onClick={() => setViewMode('days')}
            className={`px-2.5 py-1 text-[10px] font-medium transition-colors border-l border-gray-200 ${
              viewMode === 'days'
                ? 'bg-blue-500 text-white'
                : 'bg-white text-gray-600 hover:bg-gray-50'
            }`}
          >
            처리시간(일)
          </button>
        </div>
      </div>

      {/* ── KPI 토글 칩 (percent/score 모드에서만) ── */}
      {viewMode === 'percent' && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {percentDefs.map(def => {
            const isOn = enabledKeys.includes(def.key);
            const curVal = getCurrentValue(def.key);
            return (
              <button
                key={def.key}
                onClick={() => toggleKey(def.key)}
                className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-medium transition-all border ${
                  isOn
                    ? 'border-transparent shadow-sm'
                    : 'border-gray-200 bg-white text-gray-400 hover:text-gray-600 hover:border-gray-300'
                }`}
                style={isOn ? {
                  backgroundColor: `${def.color}15`,
                  color: def.color,
                  borderColor: `${def.color}40`,
                } : undefined}
              >
                <span
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ backgroundColor: isOn ? def.color : '#d1d5db' }}
                />
                <span>{def.label}</span>
                {isOn && curVal && (
                  <span className="font-bold">{curVal}{def.unit}</span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* ── days 모드 현재값 표시 ── */}
      {viewMode === 'days' && (
        <div className="flex items-center gap-2 mb-3">
          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: daysDef.color }} />
          <span className="text-[10px] font-medium text-gray-700">{daysDef.label}</span>
          {(() => {
            const v = getCurrentValue('tat');
            return v ? <span className="text-xs font-bold" style={{ color: daysDef.color }}>{v}{daysDef.unit}</span> : null;
          })()}
          <span className="text-[9px] text-gray-400 ml-auto">목표: {daysDef.target}{daysDef.unit}</span>
        </div>
      )}

      {/* ── 차트 ── */}
      <div style={{ height: '280px' }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={unifiedData} margin={{ top: 8, right: 12, left: -8, bottom: 4 }}>
            <defs>
              {UNIFIED_KPI_DEFS.map(def => (
                <linearGradient key={def.key} id={`uniGrad-${def.key}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={def.color} stopOpacity={0.12} />
                  <stop offset="100%" stopColor={def.color} stopOpacity={0.02} />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 12, fill: '#6b7280' }}
              tickLine={false}
              axisLine={{ stroke: '#e5e7eb' }}
              interval={0}
            />
            <YAxis
              tick={{ fontSize: 11, fill: '#9ca3af' }}
              tickLine={false}
              axisLine={false}
              domain={yDomain}
              width={32}
              tickFormatter={v => viewMode === 'days' ? `${Number(v).toFixed(1)}` : `${v}`}
            />
            <Tooltip
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null;
                return (
                  <div className="bg-white border border-gray-200 rounded-lg p-2.5 shadow-xl text-xs min-w-[140px]">
                    <div className="font-semibold text-gray-800 mb-1.5 pb-1 border-b border-gray-100">{label}</div>
                    {payload.map((p, i) => {
                      const matched = UNIFIED_KPI_DEFS.find(d => d.key === p.dataKey);
                      const pColor = matched?.color || p.color || '#6b7280';
                      const pLabel = matched?.label || p.name || '';
                      const pUnit = matched?.unit || '';
                      return (
                      <div key={i} className="flex items-center justify-between gap-3 py-0.5">
                        <div className="flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: pColor }} />
                          <span className="text-gray-600">{pLabel}</span>
                        </div>
                        <span className="font-semibold" style={{ color: pColor }}>
                          {Number(p.value).toFixed(1)}{pUnit}
                        </span>
                      </div>
                      );
                    })}
                  </div>
                );
              }}
            />
            {/* 목표선 (percent 모드에서 enabled 된 KPI만) */}
            {viewMode === 'percent' && visibleDefs
              .filter(d => d.target != null)
              .map(d => (
                <ReferenceLine
                  key={`target-${d.key}`}
                  y={d.target}
                  stroke={d.color}
                  strokeDasharray="6 3"
                  strokeWidth={1}
                  strokeOpacity={0.4}
                />
              ))
            }
            {/* days 모드 목표선 */}
            {viewMode === 'days' && daysDef.target != null && (
              <ReferenceLine
                y={daysDef.target}
                stroke={daysDef.color}
                strokeDasharray="6 3"
                strokeWidth={1}
                strokeOpacity={0.5}
                label={{ value: `목표 ${daysDef.target}${daysDef.unit}`, fontSize: 11, fill: daysDef.color, position: 'right' }}
              />
            )}
            {/* 라인 */}
            {visibleDefs.map(def => (
              <Line
                key={def.key}
                type="monotone"
                dataKey={def.key}
                stroke={def.color}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, fill: def.color, stroke: '#fff', strokeWidth: 2 }}
                connectNulls
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* ── 하단 범례 (percent 모드에서 목표선 설명) ── */}
      {viewMode === 'percent' && (
        <div className="flex items-center justify-center gap-4 mt-2 pt-1.5 border-t border-gray-100">
          <div className="flex items-center gap-1 text-[10px] text-gray-400">
            <span className="w-4" style={{ borderTop: '2px dashed #9ca3af' }} />
            <span>목표선</span>
          </div>
          <div className="text-[10px] text-gray-400">최대 4개 동시 표시 · 칩 클릭으로 전환</div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════════
   메인 컴포넌트
═══════════════════════════════════════════════════════════════════════════════ */
export function NationalDashboard() {
  // SSOT: 단일 상태로 통합
  const [selectedKpiId, setSelectedKpiId] = useState<string>('total_cases');
  const [periodType, setPeriodType] = useState<'weekly' | 'monthly' | 'quarterly' | 'yearly_cum'>('weekly');
  // analyticsPeriod를 periodType에서 자동 파생 (기간 통합: 센터 패널 기간 토글이 전체 분석 기간 제어)
  const analyticsPeriod = useMemo<'week' | 'month' | 'quarter' | 'year'>(() => {
    const map = { weekly: 'week', monthly: 'month', quarterly: 'quarter', yearly_cum: 'year' } as const;
    return map[periodType];
  }, [periodType]);
  const [visualizationMode, setVisualizationMode] = useState<'geomap' | 'heatmap'>('geomap');
  const [activeDonutIndex, setActiveDonutIndex] = useState<number | null>(null);
  const [showKpiSummaryTable, setShowKpiSummaryTable] = useState(false);
  // 지도/히트맵 KPI는 상단 KPI 선택과 동일하게 사용
  const selectedMapKpiId = selectedKpiId;
  const mapViewMode = visualizationMode;
  
  // ResizeObserver 훅으로 컨테이너 크기 추적 (반응형)
  const [containerRef, containerSize] = useResizeObserver<HTMLDivElement>();
  // 히트맵 호버 상태
  const [heatmapHover, setHeatmapHover] = useState<{ name: string; size: number; x: number; y: number } | null>(null);
  // GeoMapPanel에서 전달받은 현재 지도에 표시된 하위 지역 목록
  const [mapSubRegions, setMapSubRegions] = useState<{ id: string; name: string }[]>([]);
  const handleSubRegionsChange = useCallback((regions: { code: string; name: string }[]) => {
    setMapSubRegions(regions.map(r => ({ id: r.code, name: r.name })));
  }, []);

  // 드릴다운 상태 (Zustand)
  const { drillLevel, drillPath, selectedRegion, drillDown, drillUp, drillTo, resetDrill } = useDrillState();
  const statsScopeKey = selectedRegion?.name || 'national';
  
  // 반응형 레이아웃 모드 결정
  const layoutMode = useMemo(() => {
    const width = containerSize.width || (typeof window !== 'undefined' ? window.innerWidth : 1920);
    if (width >= 1024) return 'desktop';
    if (width >= 768) return 'tablet';
    return 'mobile';
  }, [containerSize.width]);

  // 패널 비율: desktop 1.35fr 2.35fr 2.3fr
  const columnFlex = useMemo(() => {
    const w = containerSize.width;
    if (w < 768) return { left: 1, center: 1, right: 1 };
    if (w < 1024) return { left: 1, center: 1, right: 1 };
    // desktop
    return { left: 1.35, center: 2.35, right: 2.3 };
  }, [containerSize.width]);


  // KPI 사전에서 패널별 KPI 가져오기
  const leftKPIs = useMemo(() => getKPIsByPanel('left'), []);
  const rightKPIs = useMemo(() => getKPIsForLevel(drillLevel).filter(k => 
    ['donut', 'bar', 'table'].includes(k.visualization.chartType) && 
    k.id !== 'total-cases' &&
    k.id !== 'center-load' &&
    k.id !== 'case-distribution' &&
    k.id !== 'kpi-summary-table'
  ), [drillLevel]);
  const bottomKPIs = useMemo(() => getKPIsByPanel('bottom'), []);
  const bulletKPIs = useMemo(() => getChartEnabledKPIs(drillLevel), [drillLevel]);

  // KPI 데이터 (SSOT 기반)
  const kpiDataMap = useMemo(() => {
    const result: Record<string, any> = {};
    [...leftKPIs, ...rightKPIs, ...bottomKPIs, ...bulletKPIs].forEach(kpi => {
      result[kpi.id] = fetchKPIData(kpi.id, selectedRegion?.code || 'KR', drillLevel, periodType);
    });
    return result;
  }, [leftKPIs, rightKPIs, bottomKPIs, bulletKPIs, selectedRegion, drillLevel, periodType]);

  /* ─────────────────────────────────────────────────────────────
     트리맵 데이터 (지역별 케이스) - 히트맵 스타일 + 시간필터 연동
  ───────────────────────────────────────────────────────────── */
  const treemapData = useMemo(() => {
    // 분석 기간에 따른 배율 (주간 < 월간 < 분기)
    const multiplier = analyticsPeriod === 'week' ? 1 : analyticsPeriod === 'month' ? 4.2 : analyticsPeriod === 'year' ? 52 : 13;
    const filterKey = `${statsScopeKey}-${analyticsPeriod}`; // 기간별 다른 시드
    
    // 지역별 데이터 생성
    const rawData = [
      { name: '경기도', size: Math.round(seededValue(`${filterKey}-tree-경기`, 2500, 3500) * multiplier) },
      { name: '경상남도', size: Math.round(seededValue(`${filterKey}-tree-경남`, 1800, 2500) * multiplier) },
      { name: '부산광역시', size: Math.round(seededValue(`${filterKey}-tree-부산`, 1500, 2200) * multiplier) },
      { name: '인천광역시', size: Math.round(seededValue(`${filterKey}-tree-인천`, 1200, 1800) * multiplier) },
      { name: '충청남도', size: Math.round(seededValue(`${filterKey}-tree-충남`, 1000, 1500) * multiplier) },
      { name: '전라남도', size: Math.round(seededValue(`${filterKey}-tree-전남`, 900, 1400) * multiplier) },
      { name: '경상북도', size: Math.round(seededValue(`${filterKey}-tree-경북`, 800, 1300) * multiplier) },
      { name: '대구광역시', size: Math.round(seededValue(`${filterKey}-tree-대구`, 700, 1100) * multiplier) },
      { name: '서울특별시', size: Math.round(seededValue(`${filterKey}-tree-서울`, 600, 1000) * multiplier) },
      { name: '충청북도', size: Math.round(seededValue(`${filterKey}-tree-충북`, 500, 900) * multiplier) },
      { name: '강원특별자치도', size: Math.round(seededValue(`${filterKey}-tree-강원`, 400, 800) * multiplier) },
      { name: '전북특별자치도', size: Math.round(seededValue(`${filterKey}-tree-전북`, 350, 700) * multiplier) },
      { name: '제주특별자치도', size: Math.round(seededValue(`${filterKey}-tree-제주`, 300, 600) * multiplier) },
      { name: '울산광역시', size: Math.round(seededValue(`${filterKey}-tree-울산`, 400, 700) * multiplier) },
      { name: '광주광역시', size: Math.round(seededValue(`${filterKey}-tree-광주`, 450, 750) * multiplier) },
      { name: '세종특별자치시', size: Math.round(seededValue(`${filterKey}-tree-세종`, 250, 500) * multiplier) },
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
  }, [statsScopeKey, analyticsPeriod]);

  const totalCases = useMemo(() => treemapData.reduce((sum, item) => sum + item.size, 0), [treemapData]);
  
  // 분석 기간 레이블
  const analyticsPeriodLabel = analyticsPeriod === 'week' ? '주간' : analyticsPeriod === 'month' ? '월간' : analyticsPeriod === 'year' ? '연간(누적)' : '분기';

  /* ─────────────────────────────────────────────────────────────
     행정구역 히트맵 (선택 KPI 기준, 푸른 테마)
  ───────────────────────────────────────────────────────────── */
  const selectedMapCard = useMemo(
    () => MAP_KPI_CARDS.find((card) => card.id === selectedMapKpiId) ?? MAP_KPI_CARDS[0],
    [selectedMapKpiId]
  );

  const mapHeatmapData = useMemo(() => {
    const rangeMap: Record<string, { min: number; max: number }> = {
      total_cases: { min: 300, max: 2200 },
      completion: { min: 60, max: 98 },
      consultation_time: { min: 1, max: 15 },
      followup_dropout: { min: 2, max: 20 },
      dropout: { min: 3, max: 25 },
    };

    const range = rangeMap[selectedMapKpiId] ?? { min: 10, max: 100 };
    const seedPrefix = `${statsScopeKey}-${selectedMapKpiId}-heat`;

    const rawData = [
      { name: '경기도', value: seededValue(`${seedPrefix}-경기`, range.min, range.max) },
      { name: '경상남도', value: seededValue(`${seedPrefix}-경남`, range.min, range.max) },
      { name: '부산광역시', value: seededValue(`${seedPrefix}-부산`, range.min, range.max) },
      { name: '인천광역시', value: seededValue(`${seedPrefix}-인천`, range.min, range.max) },
      { name: '충청남도', value: seededValue(`${seedPrefix}-충남`, range.min, range.max) },
      { name: '전라남도', value: seededValue(`${seedPrefix}-전남`, range.min, range.max) },
      { name: '경상북도', value: seededValue(`${seedPrefix}-경북`, range.min, range.max) },
      { name: '대구광역시', value: seededValue(`${seedPrefix}-대구`, range.min, range.max) },
      { name: '서울특별시', value: seededValue(`${seedPrefix}-서울`, range.min, range.max) },
      { name: '충청북도', value: seededValue(`${seedPrefix}-충북`, range.min, range.max) },
      { name: '강원특별자치도', value: seededValue(`${seedPrefix}-강원`, range.min, range.max) },
      { name: '전북특별자치도', value: seededValue(`${seedPrefix}-전북`, range.min, range.max) },
      { name: '제주특별자치도', value: seededValue(`${seedPrefix}-제주`, range.min, range.max) },
      { name: '울산광역시', value: seededValue(`${seedPrefix}-울산`, range.min, range.max) },
      { name: '광주광역시', value: seededValue(`${seedPrefix}-광주`, range.min, range.max) },
      { name: '세종특별자치시', value: seededValue(`${seedPrefix}-세종`, range.min, range.max) },
    ];

    const maxValue = Math.max(...rawData.map((d) => d.value));
    const minValue = Math.min(...rawData.map((d) => d.value));

    const getBlueHeatmapColor = (value: number) => {
      const ratio = (value - minValue) / (maxValue - minValue || 1);
      // KPI 색상에 맞는 컬러 팔레트 매핑
      const kpiColor = selectedMapCard.color;
      const palettes: Record<string, string[]> = {
        blue:   ['#eff6ff', '#bfdbfe', '#60a5fa', '#2563eb', '#1d4ed8', '#1e3a8a'],
        green:  ['#f0fdf4', '#bbf7d0', '#4ade80', '#16a34a', '#15803d', '#14532d'],
        red:    ['#fef2f2', '#fecaca', '#f87171', '#dc2626', '#b91c1c', '#7f1d1d'],
        orange: ['#fffbeb', '#fed7aa', '#fb923c', '#ea580c', '#c2410c', '#7c2d12'],
        purple: ['#faf5ff', '#e9d5ff', '#c084fc', '#9333ea', '#7e22ce', '#581c87'],
      };
      const pal = palettes[kpiColor] || palettes.blue;
      if (ratio < 0.15) return pal[0];
      if (ratio < 0.3) return pal[1];
      if (ratio < 0.5) return pal[2];
      if (ratio < 0.7) return pal[3];
      if (ratio < 0.85) return pal[4];
      return pal[5];
    };

    const isLightColor = (hex: string) => {
      const pal = {
        blue: ['#eff6ff', '#bfdbfe'],
        green: ['#f0fdf4', '#bbf7d0'],
        red: ['#fef2f2', '#fecaca'],
        orange: ['#fffbeb', '#fed7aa'],
        purple: ['#faf5ff', '#e9d5ff'],
      };
      const lightColors = pal[selectedMapCard.color as keyof typeof pal] || pal.blue;
      return lightColors.includes(hex);
    };

    return rawData.map((item) => {
      const fill = getBlueHeatmapColor(item.value);
      return {
        name: item.name,
        size: Math.round(item.value),
        fill,
        textColor: isLightColor(fill) ? '#1e3a8a' : '#ffffff',
      };
    });
  }, [statsScopeKey, selectedMapKpiId]);

  /* ─────────────────────────────────────────────────────────────
     SLA × 데이터 충족률 2×2 리스크 매트릭스 데이터
  ───────────────────────────────────────────────────────────── */
  const SLA_THRESHOLD = 95;
  const DATA_THRESHOLD = 93;

  // 시도 → 시군구 매핑 (현재 선택 시도의 하위 행정구역)
  const SIDO_SIGUNGU_MAP: Record<string, { id: string; name: string }[]> = {
    '서울': [
      {id:'11110',name:'종로구'},{id:'11140',name:'중구'},{id:'11170',name:'용산구'},{id:'11200',name:'성동구'},
      {id:'11215',name:'광진구'},{id:'11230',name:'동대문구'},{id:'11260',name:'중랑구'},{id:'11290',name:'성북구'},
      {id:'11305',name:'강북구'},{id:'11320',name:'도봉구'},{id:'11350',name:'노원구'},{id:'11380',name:'은평구'},
      {id:'11410',name:'서대문구'},{id:'11440',name:'마포구'},{id:'11470',name:'양천구'},{id:'11500',name:'강서구'},
      {id:'11530',name:'구로구'},{id:'11545',name:'금천구'},{id:'11560',name:'영등포구'},{id:'11590',name:'동작구'},
      {id:'11620',name:'관악구'},{id:'11650',name:'서초구'},{id:'11680',name:'강남구'},{id:'11710',name:'송파구'},{id:'11740',name:'강동구'},
    ],
    '부산': [{id:'26110',name:'중구'},{id:'26140',name:'서구'},{id:'26170',name:'동구'},{id:'26200',name:'영도구'},{id:'26230',name:'부산진구'},{id:'26260',name:'동래구'},{id:'26290',name:'남구'},{id:'26320',name:'북구'},{id:'26350',name:'해운대구'},{id:'26380',name:'사하구'},{id:'26410',name:'금정구'},{id:'26440',name:'강서구'},{id:'26470',name:'연제구'},{id:'26500',name:'수영구'},{id:'26530',name:'사상구'},{id:'26710',name:'기장군'}],
    '대구': [{id:'27110',name:'중구'},{id:'27140',name:'동구'},{id:'27170',name:'서구'},{id:'27200',name:'남구'},{id:'27230',name:'북구'},{id:'27260',name:'수성구'},{id:'27290',name:'달서구'},{id:'27710',name:'달성군'}],
    '인천': [{id:'28110',name:'중구'},{id:'28140',name:'동구'},{id:'28177',name:'미추홀구'},{id:'28185',name:'연수구'},{id:'28200',name:'남동구'},{id:'28237',name:'부평구'},{id:'28245',name:'계양구'},{id:'28260',name:'서구'},{id:'28710',name:'강화군'},{id:'28720',name:'옹진군'}],
    '광주': [{id:'29110',name:'동구'},{id:'29140',name:'서구'},{id:'29155',name:'남구'},{id:'29170',name:'북구'},{id:'29200',name:'광산구'}],
    '대전': [{id:'30110',name:'동구'},{id:'30140',name:'중구'},{id:'30170',name:'서구'},{id:'30200',name:'유성구'},{id:'30230',name:'대덕구'}],
    '울산': [{id:'31110',name:'중구'},{id:'31140',name:'남구'},{id:'31170',name:'동구'},{id:'31200',name:'북구'},{id:'31710',name:'울주군'}],
    '세종': [{id:'36110',name:'세종시'}],
    '경기': [
      {id:'41111',name:'수원시'},{id:'41131',name:'성남시'},{id:'41150',name:'의정부시'},{id:'41171',name:'안양시'},
      {id:'41190',name:'부천시'},{id:'41210',name:'광명시'},{id:'41220',name:'평택시'},{id:'41250',name:'동두천시'},
      {id:'41271',name:'안산시'},{id:'41281',name:'고양시'},{id:'41290',name:'과천시'},{id:'41310',name:'구리시'},
      {id:'41360',name:'남양주시'},{id:'41370',name:'오산시'},{id:'41390',name:'시흥시'},{id:'41410',name:'군포시'},
      {id:'41430',name:'의왕시'},{id:'41450',name:'하남시'},{id:'41461',name:'용인시'},{id:'41463',name:'파주시'},
      {id:'41480',name:'이천시'},{id:'41500',name:'안성시'},{id:'41550',name:'김포시'},{id:'41570',name:'화성시'},
      {id:'41590',name:'광주시'},{id:'41610',name:'양주시'},{id:'41630',name:'포천시'},{id:'41670',name:'여주시'},
    ],
    '충북': [{id:'43110',name:'청주시'},{id:'43130',name:'충주시'},{id:'43150',name:'제천시'},{id:'43720',name:'보은군'},{id:'43730',name:'옥천군'},{id:'43740',name:'영동군'},{id:'43750',name:'증평군'},{id:'43760',name:'진천군'},{id:'43770',name:'괴산군'},{id:'43800',name:'음성군'},{id:'43810',name:'단양군'}],
    '충남': [{id:'44130',name:'천안시'},{id:'44150',name:'공주시'},{id:'44180',name:'보령시'},{id:'44200',name:'아산시'},{id:'44210',name:'서산시'},{id:'44230',name:'논산시'},{id:'44250',name:'계룡시'},{id:'44270',name:'당진시'},{id:'44710',name:'금산군'},{id:'44760',name:'부여군'},{id:'44770',name:'서천군'},{id:'44790',name:'청양군'},{id:'44800',name:'홍성군'},{id:'44810',name:'예산군'},{id:'44825',name:'태안군'}],
    '전북': [{id:'45111',name:'전주시'},{id:'45130',name:'군산시'},{id:'45140',name:'익산시'},{id:'45180',name:'정읍시'},{id:'45190',name:'남원시'},{id:'45210',name:'김제시'},{id:'45710',name:'완주군'},{id:'45720',name:'진안군'},{id:'45730',name:'무주군'},{id:'45740',name:'장수군'},{id:'45750',name:'임실군'},{id:'45770',name:'순창군'},{id:'45790',name:'고창군'},{id:'45800',name:'부안군'}],
    '전남': [{id:'46110',name:'목포시'},{id:'46130',name:'여수시'},{id:'46150',name:'순천시'},{id:'46170',name:'나주시'},{id:'46230',name:'광양시'},{id:'46710',name:'담양군'},{id:'46720',name:'곡성군'},{id:'46730',name:'구례군'},{id:'46770',name:'영광군'},{id:'46780',name:'장성군'},{id:'46790',name:'완도군'},{id:'46800',name:'진도군'},{id:'46810',name:'신안군'}],
    '경북': [{id:'47111',name:'포항시'},{id:'47130',name:'경주시'},{id:'47150',name:'김천시'},{id:'47170',name:'안동시'},{id:'47190',name:'구미시'},{id:'47210',name:'영주시'},{id:'47230',name:'영천시'},{id:'47250',name:'상주시'},{id:'47280',name:'문경시'},{id:'47290',name:'경산시'},{id:'47720',name:'군위군'},{id:'47730',name:'의성군'},{id:'47750',name:'청송군'},{id:'47760',name:'영양군'},{id:'47770',name:'영덕군'},{id:'47820',name:'청도군'},{id:'47830',name:'고령군'},{id:'47840',name:'성주군'},{id:'47850',name:'칠곡군'},{id:'47900',name:'예천군'},{id:'47920',name:'봉화군'},{id:'47930',name:'울진군'},{id:'47940',name:'울릉군'}],
    '경남': [{id:'48121',name:'창원시'},{id:'48170',name:'진주시'},{id:'48220',name:'통영시'},{id:'48240',name:'사천시'},{id:'48250',name:'김해시'},{id:'48270',name:'밀양시'},{id:'48310',name:'거제시'},{id:'48330',name:'양산시'},{id:'48720',name:'의령군'},{id:'48730',name:'함안군'},{id:'48740',name:'창녕군'},{id:'48820',name:'고성군'},{id:'48840',name:'남해군'},{id:'48850',name:'하동군'},{id:'48860',name:'산청군'},{id:'48870',name:'함양군'},{id:'48880',name:'거창군'},{id:'48890',name:'합천군'}],
    '제주': [{id:'50110',name:'제주시'},{id:'50130',name:'서귀포시'}],
    '강원': [{id:'51110',name:'춘천시'},{id:'51130',name:'원주시'},{id:'51150',name:'강릉시'},{id:'51170',name:'동해시'},{id:'51190',name:'태백시'},{id:'51210',name:'속초시'},{id:'51230',name:'삼척시'},{id:'51720',name:'홍천군'},{id:'51730',name:'횡성군'},{id:'51750',name:'영월군'},{id:'51760',name:'평창군'},{id:'51770',name:'정선군'},{id:'51780',name:'철원군'},{id:'51790',name:'화천군'},{id:'51800',name:'양구군'},{id:'51810',name:'인제군'},{id:'51820',name:'고성군'},{id:'51830',name:'양양군'}],
  };

  // 시군구 → 읍면동 매핑 (코드 기반)
  const SIGUNGU_EMD_MAP: Record<string, { id: string; name: string }[]> = {
    // ── 서울 ──
    '11110': [{id:'1111051',name:'청운효자동'},{id:'1111053',name:'사직동'},{id:'1111055',name:'삼청동'},{id:'1111057',name:'부암동'},{id:'1111060',name:'평창동'},{id:'1111064',name:'혜화동'},{id:'1111068',name:'이화동'},{id:'1111070',name:'창신동'}],
    '11140': [{id:'1114051',name:'소공동'},{id:'1114053',name:'회현동'},{id:'1114055',name:'명동'},{id:'1114057',name:'필동'},{id:'1114060',name:'장충동'},{id:'1114062',name:'광희동'},{id:'1114065',name:'을지로동'},{id:'1114067',name:'신당동'}],
    '11170': [{id:'1117051',name:'후암동'},{id:'1117053',name:'용산2가동'},{id:'1117055',name:'남영동'},{id:'1117057',name:'청파동'},{id:'1117060',name:'원효로1동'},{id:'1117062',name:'원효로2동'},{id:'1117065',name:'이촌1동'},{id:'1117067',name:'이촌2동'},{id:'1117070',name:'한강로동'},{id:'1117072',name:'한남동'}],
    '11200': [{id:'1120051',name:'왕십리2동'},{id:'1120053',name:'왕십리도선동'},{id:'1120055',name:'마장동'},{id:'1120057',name:'사근동'},{id:'1120060',name:'행당1동'},{id:'1120062',name:'행당2동'},{id:'1120065',name:'응봉동'},{id:'1120067',name:'금호1가동'},{id:'1120070',name:'옥수동'},{id:'1120072',name:'성수1가1동'},{id:'1120074',name:'성수1가2동'},{id:'1120076',name:'성수2가1동'},{id:'1120078',name:'성수2가3동'},{id:'1120080',name:'송정동'}],
    '11440': [{id:'1144051',name:'아현동'},{id:'1144053',name:'공덕동'},{id:'1144055',name:'도화동'},{id:'1144057',name:'용강동'},{id:'1144060',name:'대흥동'},{id:'1144062',name:'서교동'},{id:'1144065',name:'합정동'},{id:'1144067',name:'망원1동'},{id:'1144070',name:'망원2동'},{id:'1144072',name:'연남동'},{id:'1144074',name:'성산1동'},{id:'1144076',name:'성산2동'},{id:'1144078',name:'상암동'}],
    '11560': [{id:'1156051',name:'여의동'},{id:'1156053',name:'당산1동'},{id:'1156055',name:'당산2동'},{id:'1156057',name:'도림동'},{id:'1156060',name:'문래동'},{id:'1156062',name:'영등포동'},{id:'1156065',name:'영등포본동'},{id:'1156067',name:'신길1동'},{id:'1156070',name:'신길3동'},{id:'1156072',name:'신길4동'},{id:'1156074',name:'신길5동'},{id:'1156076',name:'대림1동'},{id:'1156078',name:'대림2동'},{id:'1156080',name:'대림3동'}],
    '11650': [{id:'1165051',name:'서초1동'},{id:'1165053',name:'서초2동'},{id:'1165055',name:'서초3동'},{id:'1165057',name:'서초4동'},{id:'1165060',name:'잠원동'},{id:'1165062',name:'반포1동'},{id:'1165065',name:'반포2동'},{id:'1165067',name:'반포3동'},{id:'1165070',name:'반포4동'},{id:'1165072',name:'방배본동'},{id:'1165074',name:'방배1동'},{id:'1165076',name:'방배2동'},{id:'1165078',name:'방배3동'},{id:'1165080',name:'방배4동'},{id:'1165082',name:'내곡동'}],
    '11680': [{id:'1168051',name:'신사동'},{id:'1168053',name:'논현1동'},{id:'1168055',name:'논현2동'},{id:'1168057',name:'압구정동'},{id:'1168060',name:'청담동'},{id:'1168062',name:'삼성1동'},{id:'1168064',name:'삼성2동'},{id:'1168066',name:'대치1동'},{id:'1168068',name:'대치2동'},{id:'1168070',name:'대치4동'},{id:'1168072',name:'역삼1동'},{id:'1168074',name:'역삼2동'},{id:'1168076',name:'도곡1동'},{id:'1168078',name:'도곡2동'},{id:'1168080',name:'개포1동'},{id:'1168082',name:'개포4동'},{id:'1168084',name:'일원본동'},{id:'1168086',name:'일원1동'},{id:'1168088',name:'수서동'},{id:'1168090',name:'세곡동'}],
    '11710': [{id:'1171051',name:'잠실본동'},{id:'1171053',name:'잠실2동'},{id:'1171055',name:'잠실3동'},{id:'1171057',name:'잠실4동'},{id:'1171060',name:'잠실6동'},{id:'1171062',name:'잠실7동'},{id:'1171064',name:'송파1동'},{id:'1171066',name:'송파2동'},{id:'1171068',name:'가락본동'},{id:'1171070',name:'가락1동'},{id:'1171072',name:'가락2동'},{id:'1171074',name:'문정1동'},{id:'1171076',name:'문정2동'},{id:'1171078',name:'거여1동'},{id:'1171080',name:'거여2동'},{id:'1171082',name:'마천1동'},{id:'1171084',name:'마천2동'},{id:'1171086',name:'석촌동'},{id:'1171088',name:'풍납1동'},{id:'1171090',name:'풍납2동'},{id:'1171092',name:'오금동'},{id:'1171094',name:'위례동'}],
    '11740': [{id:'1174051',name:'강일동'},{id:'1174053',name:'상일1동'},{id:'1174055',name:'상일2동'},{id:'1174057',name:'명일1동'},{id:'1174060',name:'명일2동'},{id:'1174062',name:'고덕1동'},{id:'1174064',name:'고덕2동'},{id:'1174066',name:'암사1동'},{id:'1174068',name:'암사2동'},{id:'1174070',name:'암사3동'},{id:'1174072',name:'천호1동'},{id:'1174074',name:'천호2동'},{id:'1174076',name:'천호3동'},{id:'1174078',name:'성내1동'},{id:'1174080',name:'성내2동'},{id:'1174082',name:'성내3동'},{id:'1174084',name:'둔촌1동'},{id:'1174086',name:'둔촌2동'}],
    // ── 부산 ──
    '26110': [{id:'2611051',name:'중앙동'},{id:'2611053',name:'동광동'},{id:'2611055',name:'대청동'},{id:'2611057',name:'보수동'},{id:'2611060',name:'부평동'},{id:'2611062',name:'광복동'},{id:'2611064',name:'남포동'},{id:'2611066',name:'영주동'}],
    '26230': [{id:'2623051',name:'부전1동'},{id:'2623053',name:'부전2동'},{id:'2623055',name:'연지동'},{id:'2623057',name:'초읍동'},{id:'2623060',name:'양정1동'},{id:'2623062',name:'양정2동'},{id:'2623064',name:'전포1동'},{id:'2623066',name:'전포2동'},{id:'2623068',name:'부암1동'},{id:'2623070',name:'부암3동'},{id:'2623072',name:'당감1동'},{id:'2623074',name:'당감4동'},{id:'2623076',name:'가야1동'},{id:'2623078',name:'가야2동'},{id:'2623080',name:'개금1동'},{id:'2623082',name:'개금2동'},{id:'2623084',name:'개금3동'},{id:'2623086',name:'범천1동'},{id:'2623088',name:'범천2동'}],
    '26350': [{id:'2635051',name:'우1동'},{id:'2635053',name:'우2동'},{id:'2635055',name:'우3동'},{id:'2635057',name:'중1동'},{id:'2635060',name:'중2동'},{id:'2635062',name:'좌1동'},{id:'2635064',name:'좌2동'},{id:'2635066',name:'좌3동'},{id:'2635068',name:'좌4동'},{id:'2635070',name:'송정동'},{id:'2635072',name:'반여1동'},{id:'2635074',name:'반여2동'},{id:'2635076',name:'반여3동'},{id:'2635078',name:'반여4동'},{id:'2635080',name:'반송1동'},{id:'2635082',name:'반송2동'},{id:'2635084',name:'재송1동'},{id:'2635086',name:'재송2동'}],
    // ── 대구 ──
    '27110': [{id:'2711051',name:'동인동'},{id:'2711053',name:'삼덕동'},{id:'2711055',name:'성내1동'},{id:'2711057',name:'성내2동'},{id:'2711060',name:'성내3동'},{id:'2711062',name:'대신동'},{id:'2711064',name:'남산1동'},{id:'2711066',name:'남산2동'},{id:'2711068',name:'남산3동'},{id:'2711070',name:'남산4동'},{id:'2711072',name:'대봉1동'},{id:'2711074',name:'대봉2동'}],
    '27260': [{id:'2726051',name:'범어1동'},{id:'2726053',name:'범어2동'},{id:'2726055',name:'범어3동'},{id:'2726057',name:'범어4동'},{id:'2726060',name:'만촌1동'},{id:'2726062',name:'만촌2동'},{id:'2726064',name:'만촌3동'},{id:'2726066',name:'수성1가동'},{id:'2726068',name:'수성2·3가동'},{id:'2726070',name:'수성4가동'},{id:'2726072',name:'황금1동'},{id:'2726074',name:'황금2동'},{id:'2726076',name:'중동'},{id:'2726078',name:'상동'},{id:'2726080',name:'파동'},{id:'2726082',name:'두산동'},{id:'2726084',name:'지산동'},{id:'2726086',name:'범물1동'},{id:'2726088',name:'범물2동'},{id:'2726090',name:'고산1동'},{id:'2726092',name:'고산2동'},{id:'2726094',name:'고산3동'}],
    // ── 인천 ──
    '28185': [{id:'2818551',name:'옥련1동'},{id:'2818553',name:'옥련2동'},{id:'2818555',name:'선학동'},{id:'2818557',name:'연수1동'},{id:'2818560',name:'연수2동'},{id:'2818562',name:'연수3동'},{id:'2818564',name:'청학동'},{id:'2818566',name:'동춘1동'},{id:'2818568',name:'동춘2동'},{id:'2818570',name:'동춘3동'},{id:'2818572',name:'송도1동'},{id:'2818574',name:'송도2동'},{id:'2818576',name:'송도3동'}],
    '28200': [{id:'2820051',name:'구월1동'},{id:'2820053',name:'구월2동'},{id:'2820055',name:'구월3동'},{id:'2820057',name:'구월4동'},{id:'2820060',name:'간석1동'},{id:'2820062',name:'간석2동'},{id:'2820064',name:'간석3동'},{id:'2820066',name:'간석4동'},{id:'2820068',name:'만수1동'},{id:'2820070',name:'만수2동'},{id:'2820072',name:'만수3동'},{id:'2820074',name:'만수4동'},{id:'2820076',name:'만수5동'},{id:'2820078',name:'만수6동'},{id:'2820080',name:'장수서창동'},{id:'2820082',name:'서창2동'},{id:'2820084',name:'남촌도림동'},{id:'2820086',name:'논현1동'},{id:'2820088',name:'논현2동'},{id:'2820090',name:'논현고잔동'},{id:'2820092',name:'고잔1동'}],
    // ── 광주 ──
    '29110': [{id:'2911051',name:'충장동'},{id:'2911053',name:'동명동'},{id:'2911055',name:'계림1동'},{id:'2911057',name:'계림2동'},{id:'2911060',name:'산수1동'},{id:'2911062',name:'산수2동'},{id:'2911064',name:'지산1동'},{id:'2911066',name:'지산2동'},{id:'2911068',name:'서남동'},{id:'2911070',name:'학동'}],
    '29140': [{id:'2914051',name:'양동'},{id:'2914053',name:'농성1동'},{id:'2914055',name:'농성2동'},{id:'2914057',name:'광천동'},{id:'2914060',name:'유덕동'},{id:'2914062',name:'치평동'},{id:'2914064',name:'상무1동'},{id:'2914066',name:'상무2동'},{id:'2914068',name:'화정1동'},{id:'2914070',name:'화정2동'},{id:'2914072',name:'서창동'},{id:'2914074',name:'금호1동'},{id:'2914076',name:'금호2동'},{id:'2914078',name:'풍암동'},{id:'2914080',name:'동천동'}],
    // ── 대전 ──
    '30170': [{id:'3017051',name:'복수동'},{id:'3017053',name:'도마1동'},{id:'3017055',name:'도마2동'},{id:'3017057',name:'정림동'},{id:'3017060',name:'변동'},{id:'3017062',name:'용문동'},{id:'3017064',name:'탄방동'},{id:'3017066',name:'둔산1동'},{id:'3017068',name:'둔산2동'},{id:'3017070',name:'둔산3동'},{id:'3017072',name:'괴정동'},{id:'3017074',name:'갈마1동'},{id:'3017076',name:'갈마2동'},{id:'3017078',name:'월평1동'},{id:'3017080',name:'월평2동'},{id:'3017082',name:'월평3동'},{id:'3017084',name:'만년동'},{id:'3017086',name:'가수원동'},{id:'3017088',name:'도안동'},{id:'3017090',name:'관저1동'},{id:'3017092',name:'관저2동'}],
    '30200': [{id:'3020051',name:'진잠동'},{id:'3020053',name:'원신흥동'},{id:'3020055',name:'온천1동'},{id:'3020057',name:'온천2동'},{id:'3020060',name:'노은1동'},{id:'3020062',name:'노은2동'},{id:'3020064',name:'노은3동'},{id:'3020066',name:'신성동'},{id:'3020068',name:'전민동'},{id:'3020070',name:'구즉동'},{id:'3020072',name:'관평동'},{id:'3020074',name:'학하동'}],
    // ── 울산 ──
    '31110': [{id:'3111051',name:'학성동'},{id:'3111053',name:'복산동'},{id:'3111055',name:'우정동'},{id:'3111057',name:'성안동'},{id:'3111060',name:'반구1동'},{id:'3111062',name:'반구2동'},{id:'3111064',name:'태화동'},{id:'3111066',name:'다운동'},{id:'3111068',name:'야음장생포동'},{id:'3111070',name:'삼산동'},{id:'3111072',name:'신정1동'},{id:'3111074',name:'신정2동'},{id:'3111076',name:'신정3동'},{id:'3111078',name:'신정4동'},{id:'3111080',name:'신정5동'}],
    '31140': [{id:'3114051',name:'삼호동'},{id:'3114053',name:'무거동'},{id:'3114055',name:'옥동'},{id:'3114057',name:'두왕동'},{id:'3114060',name:'신정동'},{id:'3114062',name:'달동'},{id:'3114064',name:'삼산동'},{id:'3114066',name:'야음동'}],
    // ── 세종 ──
    '36110': [{id:'3611051',name:'조치원읍'},{id:'3611053',name:'새롬동'},{id:'3611055',name:'도담동'},{id:'3611057',name:'아름동'},{id:'3611060',name:'종촌동'},{id:'3611062',name:'고운동'},{id:'3611064',name:'보람동'},{id:'3611066',name:'대평동'},{id:'3611068',name:'소정면'},{id:'3611070',name:'금남면'},{id:'3611072',name:'부강면'},{id:'3611074',name:'연기면'},{id:'3611076',name:'연동면'},{id:'3611078',name:'장군면'},{id:'3611080',name:'전의면'},{id:'3611082',name:'전동면'}],
    // ── 경기 ──
    '41110': [{id:'4111051',name:'장안구'},{id:'4111053',name:'권선구'},{id:'4111055',name:'팔달구'},{id:'4111057',name:'영통구'}],
    '41130': [{id:'4113051',name:'수정구'},{id:'4113053',name:'중원구'},{id:'4113055',name:'분당구'}],
    '41280': [{id:'4128051',name:'덕양구'},{id:'4128053',name:'일산동구'},{id:'4128055',name:'일산서구'}],
    '41460': [{id:'4146051',name:'처인구'},{id:'4146053',name:'기흥구'},{id:'4146055',name:'수지구'}],
    // ── 충북 ──
    '43110': [{id:'4311051',name:'상당구'},{id:'4311053',name:'서원구'},{id:'4311055',name:'흥덕구'},{id:'4311057',name:'청원구'}],
    '43130': [{id:'4313051',name:'교현동'},{id:'4313053',name:'성내·충인동'},{id:'4313055',name:'호암·직동'},{id:'4313057',name:'봉방동'},{id:'4313060',name:'칠금·금릉동'},{id:'4313062',name:'연수동'},{id:'4313064',name:'안림동'},{id:'4313066',name:'주덕읍'},{id:'4313068',name:'살미면'},{id:'4313070',name:'수안보면'},{id:'4313072',name:'대소원면'},{id:'4313074',name:'엄정면'},{id:'4313076',name:'소태면'},{id:'4313078',name:'노은면'}],
    '43150': [{id:'4315051',name:'봉양읍'},{id:'4315053',name:'신도·고명동'},{id:'4315055',name:'중앙동'},{id:'4315057',name:'남현동'},{id:'4315060',name:'영서동'},{id:'4315062',name:'동면'},{id:'4315064',name:'송학면'},{id:'4315066',name:'백운면'},{id:'4315068',name:'청풍면'},{id:'4315070',name:'한수면'},{id:'4315072',name:'덕산면'},{id:'4315074',name:'수산면'}],
    // ── 충남 ──
    '44130': [{id:'4413051',name:'동남구'},{id:'4413053',name:'서북구'}],
    '44200': [{id:'4420051',name:'온양1동'},{id:'4420053',name:'온양2동'},{id:'4420055',name:'온양3동'},{id:'4420057',name:'온양4동'},{id:'4420060',name:'온양5동'},{id:'4420062',name:'온양6동'},{id:'4420064',name:'배방읍'},{id:'4420066',name:'탕정면'},{id:'4420068',name:'음봉면'},{id:'4420070',name:'둔포면'},{id:'4420072',name:'영인면'},{id:'4420074',name:'인주면'},{id:'4420076',name:'선장면'},{id:'4420078',name:'도고면'},{id:'4420080',name:'신창면'},{id:'4420082',name:'송악면'}],
    // ── 전북 ──
    '45110': [{id:'4511051',name:'완산구'},{id:'4511053',name:'덕진구'}],
    '45130': [{id:'4513051',name:'중앙동'},{id:'4513053',name:'경암동'},{id:'4513055',name:'월명동'},{id:'4513057',name:'나운1동'},{id:'4513060',name:'나운2동'},{id:'4513062',name:'소룡동'},{id:'4513064',name:'미성동'},{id:'4513066',name:'삼학동'},{id:'4513068',name:'조촌동'},{id:'4513070',name:'개정면'},{id:'4513072',name:'옥구읍'},{id:'4513074',name:'옥산면'},{id:'4513076',name:'회현면'},{id:'4513078',name:'임피면'},{id:'4513080',name:'서수면'},{id:'4513082',name:'대야면'},{id:'4513084',name:'성산면'}],
    // ── 전남 ──
    '46110': [{id:'4611051',name:'용당1동'},{id:'4611053',name:'용당2동'},{id:'4611055',name:'연산동'},{id:'4611057',name:'산정동'},{id:'4611060',name:'동명동'},{id:'4611062',name:'삼학동'},{id:'4611064',name:'만호동'},{id:'4611066',name:'유달동'},{id:'4611068',name:'죽교동'},{id:'4611070',name:'북항동'},{id:'4611072',name:'하당동'},{id:'4611074',name:'신흥동'},{id:'4611076',name:'삼호동'},{id:'4611078',name:'석현동'},{id:'4611080',name:'옥암동'},{id:'4611082',name:'부흥동'}],
    '46130': [{id:'4613051',name:'동문동'},{id:'4613053',name:'중앙동'},{id:'4613055',name:'충무동'},{id:'4613057',name:'광림동'},{id:'4613060',name:'서강동'},{id:'4613062',name:'대교동'},{id:'4613064',name:'국동'},{id:'4613066',name:'월호동'},{id:'4613068',name:'여서동'},{id:'4613070',name:'문수동'},{id:'4613072',name:'미평동'},{id:'4613074',name:'돌산읍'},{id:'4613076',name:'소라면'},{id:'4613078',name:'율촌면'},{id:'4613080',name:'화양면'},{id:'4613082',name:'남면'}],
    // ── 경북 ──
    '47111': [{id:'4711151',name:'상대동'},{id:'4711153',name:'해도동'},{id:'4711155',name:'대잠동'},{id:'4711157',name:'두호동'},{id:'4711160',name:'장량동'},{id:'4711162',name:'흥해읍'},{id:'4711164',name:'청하면'},{id:'4711166',name:'송라면'}],
    '47130': [{id:'4713051',name:'성건동'},{id:'4713053',name:'황남동'},{id:'4713055',name:'동천동'},{id:'4713057',name:'황오·성동동'},{id:'4713060',name:'월성동'},{id:'4713062',name:'보덕동'},{id:'4713064',name:'불국동'},{id:'4713066',name:'양북면'},{id:'4713068',name:'감포읍'},{id:'4713070',name:'안강읍'},{id:'4713072',name:'외동읍'},{id:'4713074',name:'건천읍'},{id:'4713076',name:'산내면'},{id:'4713078',name:'서면'},{id:'4713080',name:'현곡면'}],
    // ── 경남 ──
    '48121': [{id:'4812151',name:'의창구'},{id:'4812153',name:'성산구'},{id:'4812155',name:'마산합포구'},{id:'4812157',name:'마산회원구'},{id:'4812160',name:'진해구'}],
    '48250': [{id:'4825051',name:'동상동'},{id:'4825053',name:'회현동'},{id:'4825055',name:'부원동'},{id:'4825057',name:'내외동'},{id:'4825060',name:'북부동'},{id:'4825062',name:'활천동'},{id:'4825064',name:'삼안동'},{id:'4825066',name:'불암동'},{id:'4825068',name:'장유1동'},{id:'4825070',name:'장유2동'},{id:'4825072',name:'장유3동'},{id:'4825074',name:'진영읍'},{id:'4825076',name:'주촌면'},{id:'4825078',name:'진례면'},{id:'4825080',name:'한림면'},{id:'4825082',name:'생림면'},{id:'4825084',name:'대동면'}],
    // ── 제주 ──
    '50110': [{id:'5011051',name:'일도1동'},{id:'5011053',name:'일도2동'},{id:'5011055',name:'이도1동'},{id:'5011057',name:'이도2동'},{id:'5011060',name:'삼도1동'},{id:'5011062',name:'삼도2동'},{id:'5011064',name:'용담1동'},{id:'5011066',name:'용담2동'},{id:'5011068',name:'건입동'},{id:'5011070',name:'화북동'},{id:'5011072',name:'삼양동'},{id:'5011074',name:'봉개동'},{id:'5011076',name:'아라동'},{id:'5011078',name:'오라동'},{id:'5011080',name:'연동'},{id:'5011082',name:'노형동'},{id:'5011084',name:'외도동'},{id:'5011086',name:'이호동'},{id:'5011088',name:'도두동'},{id:'5011090',name:'조천읍'},{id:'5011092',name:'구좌읍'},{id:'5011094',name:'한림읍'},{id:'5011096',name:'애월읍'},{id:'5011098',name:'한경면'},{id:'5011100',name:'추자면'}],
    '50130': [{id:'5013051',name:'송산동'},{id:'5013053',name:'정방동'},{id:'5013055',name:'중문동'},{id:'5013057',name:'예래동'},{id:'5013060',name:'영천동'},{id:'5013062',name:'동홍동'},{id:'5013064',name:'서홍동'},{id:'5013066',name:'대륜동'},{id:'5013068',name:'대천동'},{id:'5013070',name:'중앙동'},{id:'5013072',name:'효돈동'},{id:'5013074',name:'대정읍'},{id:'5013076',name:'남원읍'},{id:'5013078',name:'성산읍'},{id:'5013080',name:'안덕면'},{id:'5013082',name:'표선면'}],
    // ── 강원 ──
    '51110': [{id:'5111051',name:'교동'},{id:'5111053',name:'조운동'},{id:'5111055',name:'약사명동'},{id:'5111057',name:'근화동'},{id:'5111060',name:'소양동'},{id:'5111062',name:'효자1동'},{id:'5111064',name:'효자2동'},{id:'5111066',name:'효자3동'},{id:'5111068',name:'석사동'},{id:'5111070',name:'퇴계동'},{id:'5111072',name:'강남동'},{id:'5111074',name:'신사우동'},{id:'5111076',name:'동면'},{id:'5111078',name:'동산면'},{id:'5111080',name:'신북읍'},{id:'5111082',name:'남면'},{id:'5111084',name:'서면'},{id:'5111086',name:'사북면'},{id:'5111088',name:'북산면'}],
    '51130': [{id:'5113051',name:'중앙동'},{id:'5113053',name:'원인동'},{id:'5113055',name:'개운동'},{id:'5113057',name:'명륜1동'},{id:'5113060',name:'명륜2동'},{id:'5113062',name:'단구동'},{id:'5113064',name:'일산동'},{id:'5113066',name:'학성동'},{id:'5113068',name:'단계동'},{id:'5113070',name:'우산동'},{id:'5113072',name:'태장1동'},{id:'5113074',name:'태장2동'},{id:'5113076',name:'반곡관설동'},{id:'5113078',name:'행구동'},{id:'5113080',name:'무실동'},{id:'5113082',name:'문막읍'},{id:'5113084',name:'소초면'},{id:'5113086',name:'호저면'},{id:'5113088',name:'지정면'},{id:'5113090',name:'부론면'}],
    '51150': [{id:'5115051',name:'교1동'},{id:'5115053',name:'교2동'},{id:'5115055',name:'포남1동'},{id:'5115057',name:'포남2동'},{id:'5115060',name:'초당동'},{id:'5115062',name:'송정동'},{id:'5115064',name:'내곡동'},{id:'5115066',name:'강남동'},{id:'5115068',name:'홍제동'},{id:'5115070',name:'성산면'},{id:'5115072',name:'왕산면'},{id:'5115074',name:'주문진읍'},{id:'5115076',name:'연곡면'},{id:'5115078',name:'사천면'},{id:'5115080',name:'옥계면'},{id:'5115082',name:'강동면'}],
  };

  const riskMatrixData = useMemo(() => {
    const nationRegions = [
      { id: '11', name: '서울' }, { id: '26', name: '부산' }, { id: '27', name: '대구' },
      { id: '28', name: '인천' }, { id: '29', name: '광주' }, { id: '30', name: '대전' },
      { id: '31', name: '울산' }, { id: '36', name: '세종' }, { id: '41', name: '경기' },
      { id: '43', name: '충북' }, { id: '44', name: '충남' }, { id: '45', name: '전북' },
      { id: '46', name: '전남' }, { id: '47', name: '경북' }, { id: '48', name: '경남' },
      { id: '50', name: '제주' }, { id: '51', name: '강원' },
    ];
    let regions: { id: string; name: string }[];
    if (drillLevel === 'nation') {
      regions = nationRegions;
    } else if (mapSubRegions.length > 0) {
      // GeoMapPanel에서 전달받은 실제 GeoJSON 기반 하위 지역 사용 (가장 정확)
      regions = mapSubRegions;
    } else if (drillLevel === 'sido') {
      // GeoJSON 미로드 시 정적 매핑 폴백
      const fullToShort: Record<string, string> = {
        '서울특별시':'서울','부산광역시':'부산','대구광역시':'대구','인천광역시':'인천',
        '광주광역시':'광주','대전광역시':'대전','울산광역시':'울산','세종특별자치시':'세종',
        '경기도':'경기','충청북도':'충북','충청남도':'충남','전북특별자치도':'전북','전라북도':'전북',
        '전라남도':'전남','경상북도':'경북','경상남도':'경남','제주특별자치도':'제주',
        '강원특별자치도':'강원','강원도':'강원',
      };
      const rawName = selectedRegion?.name || '';
      const shortName = fullToShort[rawName] || rawName.replace(/특별자치도|특별자치시|광역시|특별시|도$/g, '').trim() || rawName;
      regions = SIDO_SIGUNGU_MAP[shortName] || nationRegions;
    } else {
      // 시군구 → 읍면동 (코드 기반 매핑 폴백)
      const code = selectedRegion?.code || '00';
      const emdFromMap = SIGUNGU_EMD_MAP[code];
      if (emdFromMap) {
        regions = emdFromMap;
      } else {
        const parentName = selectedRegion?.name || '지역';
        if (parentName.endsWith('군')) {
          const gunBase = parentName.slice(0, -1);
          regions = [
            {id:`${code}-E1`, name:`${gunBase}읍`},
            {id:`${code}-E2`, name:'동면'},{id:`${code}-E3`, name:'서면'},
            {id:`${code}-E4`, name:'남면'},{id:`${code}-E5`, name:'북면'},
            {id:`${code}-E6`, name:'근남면'},{id:`${code}-E7`, name:'근북면'},
            {id:`${code}-E8`, name:'원남면'},{id:`${code}-E9`, name:'원서면'},
          ];
        } else {
          regions = [
            {id:`${code}-E1`, name:'중앙동'},{id:`${code}-E2`, name:'역전동'},
            {id:`${code}-E3`, name:'동부동'},{id:`${code}-E4`, name:'서부동'},
            {id:`${code}-E5`, name:'남부동'},{id:`${code}-E6`, name:'북부동'},
            {id:`${code}-E7`, name:'신시가동'},{id:`${code}-E8`, name:'시청동'},
          ];
        }
      }
    }
    return regions.map(r => {
      const seed = `${statsScopeKey}-${analyticsPeriod}-risk-${r.id}`;
      const slaRate = Number(seededValue(`${seed}-sla`, 78, 100).toFixed(1));
      const dataRate = Number(seededValue(`${seed}-data`, 75, 100).toFixed(1));
      const totalCases = Math.round(seededValue(`${seed}-cases`, 200, 3000));
      return { regionId: r.id, regionName: r.name, slaRate, dataRate, totalCases };
    });
  }, [statsScopeKey, analyticsPeriod, drillLevel, selectedRegion, mapSubRegions]);

  /* ─────────────────────────────────────────────────────────────
     처리 단계 분포 스택형 바 데이터
  ───────────────────────────────────────────────────────────── */
  const STAGE_KEYS = ['incoming', 'inProgress', 'needRecontact', 'slaBreach', 'completed'] as const;
  const STAGE_LABELS: Record<string, string> = {
    incoming: '신규', inProgress: '처리중', needRecontact: '재접촉 필요',
    slaBreach: 'SLA 위반', completed: '완료',
  };
  const STAGE_COLORS_MAP: Record<string, string> = {
    incoming: COLORS.blue, inProgress: COLORS.cyan, needRecontact: COLORS.orange,
    slaBreach: COLORS.red, completed: COLORS.green,
  };

  const stageByRegionData = useMemo(() => {
    const regions = ['서울', '부산', '대구', '인천', '광주', '대전', '울산', '세종',
                     '경기', '충북', '충남', '전북', '전남', '경북', '경남', '제주', '강원'];
    return regions.map(name => {
      const seed = `${statsScopeKey}-${analyticsPeriod}-stage-${name}`;
      return {
        regionName: name,
        incoming: Math.round(seededValue(`${seed}-inc`, 50, 300)),
        inProgress: Math.round(seededValue(`${seed}-inp`, 100, 500)),
        needRecontact: Math.round(seededValue(`${seed}-nrc`, 20, 150)),
        slaBreach: Math.round(seededValue(`${seed}-sla`, 5, 80)),
        completed: Math.round(seededValue(`${seed}-cmp`, 200, 800)),
      };
    });
  }, [statsScopeKey, analyticsPeriod]);

  /* ─────────────────────────────────────────────────────────────
     연령 × 상태 분포 (5그룹 × 4상태) - Left Panel용
  ───────────────────────────────────────────────────────────── */
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
        normal:       Math.round(seededValue(`${s}-n`, 120, 450)),
        caution:      Math.round(seededValue(`${s}-c`, 40, 180)),
        highRisk:     Math.round(seededValue(`${s}-h`, 15, 90)),
        slaViolation: Math.round(seededValue(`${s}-s`, 5, 40)),
      };
    });
  }, [statsScopeKey, analyticsPeriod]);

  /* ─────────────────────────────────────────────────────────────
     커스텀 트리맵 컨텐트
  ───────────────────────────────────────────────────────────── */
  const CustomTreemapContent = (props: any) => {
    const { x, y, width, height, name, fill } = props;
    if (!name || width < 25 || height < 18) return null;
    
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
     - GeoMapPanel에서 이미 다음 레벨(sig/emd)로 변환해서 전달함
     - sig 클릭 -> 'sig' 전달 -> sido 드릴레벨로 이동
     - emd 클릭 -> 'emd' 전달 -> sigungu 드릴레벨로 이동
  ───────────────────────────────────────────────────────────── */
  const handleRegionSelect = useCallback(({ level, code, name }: { level: string; code: string; name: string }) => {
    // GeoMapPanel에서 이미 다음 레벨(sig/emd)로 변환해서 전달함
    // sig -> sido, emd -> sigungu 드릴레벨로 매핑
    const drillLevelMap: Record<string, DrillLevel> = {
      'sig': 'sido',      // 시군구 레벨로 이동 -> sido 드릴레벨
      'emd': 'sigungu',   // 읍면동 레벨로 이동 -> sigungu 드릴레벨
    };
    const newLevel = drillLevelMap[level];
    if (newLevel) {
      console.log('[DrillDown] 지역 선택:', { geoLevel: level, code, name, drillLevel: newLevel });
      drillDown({ code, name, level: newLevel });
    }
  }, [drillDown]);

  return (
    <div ref={containerRef} className="flex flex-col bg-gray-50 h-full min-h-0">
      {/* ═══════════════════════════════════════════════════════════
          고정 2행: KPI 선택 카드 + Breadcrumb + 보조 컨트롤
      ═══════════════════════════════════════════════════════════ */}
      <div className="bg-white border-b border-gray-200 px-4 py-2 shrink-0">
        {/* KPI 버튼 + 보조 컨트롤 한 줄 */}
        <div className="flex items-center gap-2">
          {/* KPI 버튼 그룹 (스크롤 허용) */}
          <div className="flex items-center gap-2 overflow-x-auto flex-1 min-w-0">
          {MAP_KPI_CARDS.map((card) => {
            const isActive = selectedKpiId === card.id;
            const value = card.getValue(statsScopeKey);
            const kpiColorStyles: Record<string, { border: string; bg: string; ring: string; text: string; value: string }> = {
              blue:   { border: 'border-blue-500',   bg: 'bg-blue-50',   ring: 'ring-blue-200',   text: 'text-blue-700',   value: 'text-blue-600' },
              green:  { border: 'border-green-500',  bg: 'bg-green-50',  ring: 'ring-green-200',  text: 'text-green-700',  value: 'text-green-600' },
              red:    { border: 'border-red-500',    bg: 'bg-red-50',    ring: 'ring-red-200',    text: 'text-red-700',    value: 'text-red-600' },
              orange: { border: 'border-amber-500',  bg: 'bg-amber-50',  ring: 'ring-amber-200',  text: 'text-amber-700',  value: 'text-amber-600' },
              purple: { border: 'border-purple-500', bg: 'bg-purple-50', ring: 'ring-purple-200', text: 'text-purple-700', value: 'text-purple-600' },
            };
            const cs = kpiColorStyles[card.color] || kpiColorStyles.blue;
            return (
              <button
                key={card.id}
                onClick={() => setSelectedKpiId(card.id)}
                aria-pressed={isActive}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-all min-w-[140px] text-left ${
                  isActive
                    ? `${cs.border} ${cs.bg} ring-2 ${cs.ring} shadow-sm`
                    : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
                }`}
              >
                <div className={`p-1.5 rounded-md ${card.iconBg}`}>
                  {card.id === 'total_cases' && <TrendingUp className="h-4 w-4" />}
                  {card.id === 'completion' && <BarChart3 className="h-4 w-4" />}
                  {card.id === 'consultation_time' && <Download className="h-4 w-4" />}
                  {card.id === 'followup_dropout' && <HelpCircle className="h-4 w-4" />}
                  {card.id === 'dropout' && <ChevronRight className="h-4 w-4" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className={`text-[10px] font-medium truncate ${isActive ? cs.text : 'text-gray-500'}`}>
                    {card.label}
                  </div>
                  <div className={`text-sm font-bold ${isActive ? cs.value : 'text-gray-800'}`}>
                    {value.toLocaleString()}
                    <span className="text-[10px] font-normal ml-0.5">{card.unit}</span>
                  </div>
                </div>
                {isActive && (
                  <div className={`w-1.5 h-1.5 rounded-full shrink-0`} style={{ backgroundColor: COLORS[card.color as keyof typeof COLORS] || COLORS.blue }} />
                )}
              </button>
            );
          })}
          </div>

          {/* ═══ 구분선 ═══ */}
          <div className="w-px h-8 bg-gray-200 shrink-0" />

          {/* ═══ Breadcrumb + Back 버튼 ═══ */}
          <div className="flex items-center gap-1.5 shrink-0">
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

          {/* ═══ 구분선 ═══ */}
          <div className="w-px h-8 bg-gray-200 shrink-0" />

          {/* ═══ 보조 컨트롤 버튼 ═══ */}
          <div className="flex items-center gap-1 text-gray-500 shrink-0">
            <button className="p-1.5 hover:bg-gray-100 rounded" title="도움말"><HelpCircle className="h-4 w-4" /></button>
            <button className="p-1.5 hover:bg-gray-100 rounded" title="분석 차트"><BarChart3 className="h-4 w-4" /></button>
            <button className="p-1.5 hover:bg-gray-100 rounded" title="다운로드"><Download className="h-4 w-4" /></button>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════
          SCROLL CONTAINER - 통계/지도/차트 전용 스크롤 영역
      ═══════════════════════════════════════════════════════════ */}
      <div className="flex-1 overflow-y-auto min-h-0">

      {/* ═══════════════════════════════════════════════════════════
          MAIN CONTENT - CSS Grid 3열 레이아웃
          - Desktop (>=1024px): 1.3fr / 2.5fr / 2.2fr
          - Tablet: 2단, Mobile: 1열 스택
      ═══════════════════════════════════════════════════════════ */}
      <div className={`p-2 gap-2 ${
        layoutMode === 'desktop' 
          ? 'grid' 
          : layoutMode === 'tablet'
          ? 'flex flex-col'
          : 'flex flex-col'
      }`} style={layoutMode === 'desktop' ? { gridTemplateColumns: '1.2fr 2.2fr 2.6fr', minHeight: 'calc(100vh - 140px)', alignItems: 'stretch' } : undefined}>
        
        {/* ═══════════════════════════════════════════════════════
            LEFT COLUMN - KPI 요약 + 리스크 Top + 연령대별 차트
        ═══════════════════════════════════════════════════════ */}
        <div className={`flex flex-col gap-2 ${
          layoutMode === 'desktop' 
            ? 'min-w-0' 
            : layoutMode === 'tablet'
            ? 'hidden'
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
          
          {/* ── 선택 KPI 요약 카드 ── */}
          <div className="bg-white border border-gray-200 rounded-lg p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-gray-700">선택 KPI 요약</span>
              <span className="text-[9px] px-1.5 py-0.5 rounded font-medium" 
                style={{ backgroundColor: `${COLORS[selectedMapCard.color as keyof typeof COLORS] || COLORS.blue}15`, color: COLORS[selectedMapCard.color as keyof typeof COLORS] || COLORS.blue }}>
                {selectedMapCard.label}
              </span>
            </div>
            {(() => {
              const kpiVal = selectedMapCard.getValue(statsScopeKey);
              const avg = mapHeatmapData.length > 0 ? mapHeatmapData.reduce((s, d) => s + d.size, 0) / mapHeatmapData.length : 0;
              const sorted = [...mapHeatmapData].sort((a, b) => b.size - a.size);
              const best = sorted[0];
              const worst = sorted[sorted.length - 1];
              const kpiC = COLORS[selectedMapCard.color as keyof typeof COLORS] || COLORS.blue;
              return (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-gray-500">전국 평균</span>
                    <span className="text-sm font-bold" style={{ color: kpiC }}>{Math.round(avg).toLocaleString()}{selectedMapCard.unit}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-gray-500">현재값</span>
                    <span className="text-sm font-bold text-gray-800">{kpiVal.toLocaleString()}{selectedMapCard.unit}</span>
                  </div>
                  {best && (
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-gray-500">최고 ({best.name.replace(/특별자치도|특별자치시|광역시|특별시/g, '').trim()})</span>
                      <span className="text-xs font-semibold text-green-600">{best.size.toLocaleString()}</span>
                    </div>
                  )}
                  {worst && (
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-gray-500">최저 ({worst.name.replace(/특별자치도|특별자치시|광역시|특별시/g, '').trim()})</span>
                      <span className="text-xs font-semibold text-red-600">{worst.size.toLocaleString()}</span>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>

          {/* ── 리스크 Top 5 ── */}
          <div className="bg-white border border-gray-200 rounded-lg p-3 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-gray-700">리스크 Top 5</span>
              <span className="text-[9px] bg-red-50 text-red-600 px-1.5 py-0.5 rounded font-medium">{selectedRegion?.name || '전국'} 하위</span>
            </div>
            <div className="space-y-1">
              {(() => {
                const riskTop = [...riskMatrixData]
                  .map(r => ({
                    ...r,
                    riskScore: (100 - r.slaRate) + (100 - r.dataRate),
                  }))
                  .sort((a, b) => b.riskScore - a.riskScore)
                  .slice(0, 5);
                return riskTop.map((r, idx) => (
                  <button
                    key={r.regionId}
                    onClick={() => {
                      // drillLevel에 따라 다음 레벨로 drillDown
                      const nextLevel = drillLevel === 'nation' ? 'sido' : drillLevel === 'sido' ? 'sigungu' : 'emd';
                      drillDown({ code: r.regionId, name: r.regionName, level: nextLevel });
                    }}
                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-red-50 transition-colors text-left"
                  >
                    <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white ${
                      idx === 0 ? 'bg-red-500' : idx === 1 ? 'bg-orange-500' : 'bg-amber-400'
                    }`}>{idx + 1}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium text-gray-800 truncate">{r.regionName}</div>
                      <div className="text-[10px] text-gray-500">SLA {r.slaRate}% · 데이터 {r.dataRate}%</div>
                    </div>
                    <span className={`text-[10px] font-bold ${r.riskScore > 15 ? 'text-red-600' : r.riskScore > 8 ? 'text-amber-600' : 'text-green-600'}`}>
                      {r.riskScore.toFixed(1)}
                    </span>
                  </button>
                ));
              })()}
            </div>
          </div>

          {/* 연령대별 미처리/지연 리스크(%) */}
          <div className="bg-white border border-gray-200 rounded-lg p-2">
            <div className="text-[10px] font-semibold text-gray-700 mb-0.5">연령대별 미처리/지연 리스크(%)</div>
            <div style={{ height: '150px' }}>
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
                  <XAxis dataKey="age" tick={{ fontSize: 12, fill: '#4b5563' }} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#6b7280' }} tickLine={false} axisLine={false} width={32} tickFormatter={(v) => `${v}%`} />
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
                  <Legend formatter={(v: string) => v === 'slaViolation' ? 'SLA 위반률' : '재접촉 필요율'} wrapperStyle={{ fontSize: '11px' }} />
                  <Bar dataKey="slaViolation" fill="#ef4444" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="recontactNeed" fill="#f59e0b" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* ── KPI 요약 테이블 - 토글로 숨김 처리 (기본: 숨김) ── */}
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <button
              onClick={() => setShowKpiSummaryTable(!showKpiSummaryTable)}
              className="w-full flex items-center justify-between px-2 py-2 hover:bg-gray-50 transition-colors"
            >
              <span className="text-[10px] font-medium text-gray-700">KPI 요약 테이블</span>
              <div className="flex items-center gap-1.5">
                <button 
                  onClick={(e) => { e.stopPropagation(); /* Excel 다운로드 */ }}
                  className="px-1.5 py-0.5 text-[9px] text-blue-600 bg-blue-50 rounded hover:bg-blue-100"
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
                  <table className="w-full text-[10px]">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200">
                        <th className="px-1.5 py-1 text-left font-medium text-gray-600">KPI</th>
                        <th className="px-1.5 py-1 text-right font-medium text-gray-600">평균</th>
                        <th className="px-1.5 py-1 text-right font-medium text-gray-600">최저</th>
                        <th className="px-1.5 py-1 text-right font-medium text-gray-600">최고</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bulletKPIs.map(kpi => {
                        const data = kpiDataMap[kpi.id] as TimeSeriesKPIData | null;
                        if (!data) return null;
                        return (
                          <tr key={kpi.id} className="border-b border-gray-100 hover:bg-blue-50/30">
                            <td className="px-1.5 py-1 truncate max-w-[80px]">{kpi.name}</td>
                            <td className="px-1.5 py-1 text-right whitespace-nowrap">{data.current}{data.unit}</td>
                            <td className="px-1.5 py-1 text-right text-red-600 whitespace-nowrap">{(data.current * 0.95).toFixed(1)}{data.unit}</td>
                            <td className="px-1.5 py-1 text-right text-blue-600 whitespace-nowrap">{(data.current * 1.03).toFixed(1)}{data.unit}</td>
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
            CENTER COLUMN - GeoMap/Heatmap + 처리단계 범례
        ═══════════════════════════════════════════════════════ */}
        <div className={`${
          layoutMode === 'desktop' 
            ? 'min-w-0 flex flex-col' 
            : 'w-full shrink-0'
        }`}>
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden flex flex-col flex-1">
            {/* ── 중앙 패널 헤더: 뒤로/제목 + 지도/히트맵 토글 + 기간 토글 ── */}
            <div className="px-4 py-3.5 border-b border-gray-200 bg-white rounded-t-lg">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                  {drillLevel !== 'nation' && (
                    <button
                      onClick={drillUp}
                      className="flex items-center gap-1 h-8 px-3 text-sm text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors font-medium"
                    >
                      <ChevronLeft className="h-4 w-4" />
                      <span>뒤로</span>
                    </button>
                  )}
                  <span className="text-sm font-semibold text-gray-800">
                    {mapViewMode === 'geomap' ? '지도' : '히트맵'}
                  </span>
                  <span className="h-6 inline-flex items-center gap-1 px-2 bg-emerald-50 text-emerald-700 text-[10px] rounded font-medium border border-emerald-200">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    {analyticsPeriodLabel} · 기준연도 2026
                  </span>
                  <span className="h-6 inline-flex items-center px-2 text-white text-[10px] rounded font-semibold"
                    style={{ backgroundColor: COLORS[selectedMapCard.color as keyof typeof COLORS] || COLORS.blue }}>
                    {selectedMapCard.label}
                  </span>
                  <span className="h-6 inline-flex items-center px-2 bg-red-500 text-white text-[10px] rounded font-semibold">
                    {getDrillLevelLabel(drillLevel)}
                  </span>
                  {selectedRegion && (
                    <span className="text-xs text-gray-600 font-medium">- {selectedRegion.name}</span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {/* 지도 / 히트맵 토글 */}
                  <div className="flex rounded-md border border-gray-200 overflow-hidden">
                    <button
                      onClick={() => setVisualizationMode('geomap')}
                      className={`px-3 py-1.5 text-xs font-medium transition ${
                        visualizationMode === 'geomap' ? 'bg-blue-600 text-white' : 'bg-white text-gray-500 hover:bg-gray-100'
                      }`}
                    >지오맵</button>
                    <button
                      onClick={() => setVisualizationMode('heatmap')}
                      className={`px-3 py-1.5 text-xs font-medium transition border-l border-gray-200 ${
                        visualizationMode === 'heatmap' ? 'bg-blue-600 text-white' : 'bg-white text-gray-500 hover:bg-gray-100'
                      }`}
                    >히트맵</button>
                  </div>
                  {/* 기간 토글 */}
                  <div className="flex items-center gap-0.5">
                    {(['weekly', 'monthly', 'quarterly', 'yearly_cum'] as const).map(p => (
                      <button
                        key={p}
                        onClick={() => setPeriodType(p)}
                        className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${
                          periodType === p
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                        }`}
                      >
                        {p === 'weekly' ? '주간' : p === 'monthly' ? '월간' : p === 'quarterly' ? '분기' : '연간(누적)'}
                      </button>
                    ))}
                  </div>
                  <button className="h-7 w-7 flex items-center justify-center hover:bg-gray-100 rounded-lg transition-colors"><Download className="h-3.5 w-3.5 text-gray-500" /></button>
                </div>
              </div>
            </div>

            {/* ── 지도/히트맵 본체 ── */}
            <div className="p-2 min-h-0">
              {visualizationMode === 'geomap' ? (
                <GeoMapPanel
                  key={`national-${selectedKpiId}-${drillLevel}-${selectedRegion?.code || 'all'}-${periodType}`}
                  indicatorId={selectedKpiId}
                  periodType={periodType}
                  year={2026}
                  scope={{ mode: 'national' }}
                  variant="portal"
                  mapHeight={670}
                  hideBreadcrumb
                  externalLevel={drillLevel === 'nation' ? 'ctprvn' : drillLevel === 'sido' ? 'sig' : 'emd'}
                  externalSelectedCode={selectedRegion?.code}
                  onRegionSelect={handleRegionSelect}
                  onGoBack={drillUp}
                  externalColorScheme={selectedMapCard.color as MapColorScheme}
                  hideLegendPanel
                  onSubRegionsChange={handleSubRegionsChange}
                />
              ) : (
                <div className="relative w-full" style={{ height: 'clamp(320px, 44vh, 480px)' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <Treemap
                      data={mapHeatmapData}
                      dataKey="size"
                      stroke="#fff"
                      isAnimationActive={false}
                      content={CustomTreemapContent}
                    />
                  </ResponsiveContainer>
                  {/* 히트맵 툴팁 */}
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
                          <span className="text-[9px] bg-orange-50 text-orange-600 px-1.5 py-0.5 rounded font-medium">{periodType === 'weekly' ? '주간' : periodType === 'monthly' ? '월간' : periodType === 'quarterly' ? '분기' : '연간(누적)'}</span>
                        </div>
                        <div className="flex justify-between py-0.5"><span className="text-gray-500">{selectedKpiId}</span><span className="font-bold text-blue-600">{heatmapHover.size.toLocaleString()}</span></div>
                        <div className="flex justify-between py-0.5"><span className="text-gray-500">순위</span><span className="font-bold text-gray-700">{rank}/{mapHeatmapData.length}</span></div>
                        <div className="flex justify-between py-0.5"><span className="text-gray-500">비중</span><span className="font-bold text-gray-700">{share}%</span></div>
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>

            {/* ── KPI 색상 범례 (지오맵 바로 아래, 고도화) ── */}
            <div className="mx-2 mb-2 px-3 py-2 rounded-lg bg-gradient-to-r from-gray-50 to-gray-100/80 border border-gray-200/60 shrink-0">
              <div className="flex items-center gap-2 mb-1.5">
                <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: COLORS[selectedMapCard.color as keyof typeof COLORS] || COLORS.blue }} />
                <span className="text-[10px] font-bold text-gray-600 tracking-wide">{selectedMapCard.label}</span>
                <span className="text-[9px] text-gray-400 ml-auto">{selectedMapCard.unit}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-semibold text-gray-500 tabular-nums min-w-[36px] text-right">
                  {(() => {
                    const values = mapHeatmapData.map(d => d.size);
                    return values.length ? Math.min(...values).toLocaleString() : '-';
                  })()}
                </span>
                <div className="flex-1 h-3 rounded-md overflow-hidden flex shadow-inner">
                  {(COLOR_PALETTES[selectedMapCard.color as keyof typeof COLOR_PALETTES] || COLOR_PALETTES.blue).map((c: string, i: number) => (
                    <div key={i} className="flex-1 transition-colors" style={{ backgroundColor: c }} />
                  ))}
                </div>
                <span className="text-[10px] font-semibold text-gray-500 tabular-nums min-w-[36px]">
                  {(() => {
                    const values = mapHeatmapData.map(d => d.size);
                    return values.length ? Math.max(...values).toLocaleString() : '-';
                  })()}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════
            RIGHT COLUMN - KPI 사전 기반 자동 렌더링
            Desktop: 25% 너비
        ═══════════════════════════════════════════════════════ */}
        <div className={`flex flex-col gap-2 ${
          layoutMode === 'desktop' 
            ? 'min-w-0' 
            : layoutMode === 'tablet'
            ? 'hidden'
            : 'w-full shrink-0'
        }`}>
          
          {/* ═══ SLA × 데이터 충족률 리스크 매트릭스 (ScatterChart) ═══ */}
          <div className="bg-white border border-gray-200 rounded-lg p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-gray-700">SLA × 데이터 충족률 리스크 매트릭스</span>
              <div className="flex items-center gap-2 text-[10px] text-gray-500">
                <span className="flex items-center gap-0.5"><span className="w-2 h-2 rounded-full bg-green-500" />양호</span>
                <span className="flex items-center gap-0.5"><span className="w-2 h-2 rounded-full bg-amber-400" />주의</span>
                <span className="flex items-center gap-0.5"><span className="w-2 h-2 rounded-full bg-red-500" />위험</span>
              </div>
            </div>
            {riskMatrixData.length > 0 ? (
              <div style={{ height: '200px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <ScatterChart margin={{ top: 10, right: 15, left: -5, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis type="number" dataKey="dataRate" name="데이터 충족률" unit="%"
                      domain={[70, 100]} tick={{ fontSize: 12 }} label={{ value: '데이터 충족률(%)', position: 'insideBottom', offset: -2, fontSize: 11, fill: '#6b7280' }} />
                    <YAxis type="number" dataKey="slaRate" name="SLA 준수율" unit="%"
                      domain={[70, 100]} tick={{ fontSize: 12 }} label={{ value: 'SLA(%)', angle: -90, position: 'insideLeft', offset: 15, fontSize: 11, fill: '#6b7280' }} />
                    <ZAxis type="number" dataKey="totalCases" range={[40, 300]} name="케이스 수" />
                    <ReferenceLine x={DATA_THRESHOLD} stroke="#9ca3af" strokeDasharray="4 2" />
                    <ReferenceLine y={SLA_THRESHOLD} stroke="#9ca3af" strokeDasharray="4 2" />
                    <Tooltip content={({ active, payload }) => {
                      if (!active || !payload?.[0]) return null;
                      const d = payload[0].payload;
                      return (
                        <div className="bg-white border border-gray-200 rounded-lg p-2 shadow-lg text-xs">
                          <div className="font-semibold text-gray-800 mb-1">{d.regionName}</div>
                          <div>SLA 준수율: <span className="font-medium">{d.slaRate}%</span></div>
                          <div>데이터 충족률: <span className="font-medium">{d.dataRate}%</span></div>
                          <div>케이스: <span className="font-medium">{d.totalCases.toLocaleString()}건</span></div>
                        </div>
                      );
                    }} />
                    <Scatter data={riskMatrixData} onClick={(entry: any) => {
                      if (entry?.regionId) {
                        drillDown({ code: entry.regionId, name: entry.regionName, level: 'sido' });
                      }
                    }}>
                      {riskMatrixData.map((entry, idx) => {
                        const slaOk = entry.slaRate >= SLA_THRESHOLD;
                        const dataOk = entry.dataRate >= DATA_THRESHOLD;
                        const color = slaOk && dataOk ? '#22c55e' : !slaOk && !dataOk ? '#ef4444' : '#f59e0b';
                        return <Cell key={idx} fill={color} style={{ cursor: 'pointer' }} />;
                      })}
                    </Scatter>
                  </ScatterChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-[200px] flex items-center justify-center text-xs text-gray-400">데이터 부족</div>
            )}
          </div>

          {/* ═══ 처리 단계 분포 스택형 바 ═══ */}
          <div className="bg-white border border-gray-200 rounded-lg p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-gray-700">처리 단계 분포 (지역별)</span>
            </div>
            {stageByRegionData.length > 0 ? (
              <div style={{ height: '220px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stageByRegionData} margin={{ top: 5, right: 10, left: -10, bottom: 25 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                    <XAxis dataKey="regionName" tick={{ fontSize: 11, fill: '#4b5563' }} interval={0} angle={-35} textAnchor="end" />
                    <YAxis tick={{ fontSize: 11, fill: '#6b7280' }} tickFormatter={(v) => v >= 1000 ? `${(v/1000).toFixed(0)}K` : String(v)} />
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
            ) : (
              <div className="h-[220px] flex items-center justify-center text-xs text-gray-400">데이터 부족</div>
            )}
          </div>

          {/* ═══ KPI 통합 추이 차트 (멀티라인) ═══ */}
          <KPIUnifiedChart
            bulletKPIs={bulletKPIs}
            kpiDataMap={kpiDataMap}
            analyticsPeriod={analyticsPeriod}
          />

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
                <div className="flex items-center justify-between mb-1">
                  <div className="text-xs text-gray-500">{analyticsPeriodLabel} 총 처리건수</div>
                  <div className="text-[9px] text-blue-500 bg-blue-50 px-1.5 py-0.5 rounded">{analyticsPeriodLabel}</div>
                </div>
                <div className="text-2xl font-bold text-blue-600 mb-2">
                  {totalCases.toLocaleString()} <span className="text-sm font-normal text-gray-500">건</span>
                </div>
                <div className="text-[10px] text-gray-500 mb-2">{selectedMapCard.label} (행정구역별)</div>
                <div className="h-[140px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <Treemap data={mapHeatmapData} dataKey="size" aspectRatio={4/3} stroke="#fff" content={<CustomTreemapContent />} />
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
                      analyticsPeriod={analyticsPeriod}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      </div>{/* end scroll container */}
    </div>
  );
}
