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
  const timeRangeLabel = analyticsPeriod === 'week' ? '주간' : analyticsPeriod === 'month' ? '월간' : analyticsPeriod === 'year' ? '연간' : '분기';
  
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
                      const def = UNIFIED_KPI_DEFS.find(d => d.key === p.dataKey);
                      if (!def) return null;
                      return (
                        <div key={i} className="flex items-center justify-between gap-3 py-0.5">
                          <div className="flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: def.color }} />
                            <span className="text-gray-600">{def.label}</span>
                          </div>
                          <span className="font-semibold" style={{ color: def.color }}>
                            {Number(p.value).toFixed(1)}{def.unit}
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
  const [selectedKPI, setSelectedKPI] = useState<string | null>(null);
  const [activeDonutIndex, setActiveDonutIndex] = useState<number | null>(null);
  const [showKpiSummaryTable, setShowKpiSummaryTable] = useState(false); // KPI 요약 테이블 토글
  const [analyticsPeriod, setAnalyticsPeriod] = useState<'week' | 'month' | 'quarter' | 'year'>('week'); // 분석 기간 (좌측 요약 + 우측 분석에만 적용)
  
  // ═══ 지오맵 KPI 선택 상태 (상단 카드 클릭 → 지도 히트맵 KPI 변경) ═══
  const [selectedMapKpiId, setSelectedMapKpiId] = useState<string>('total_cases');
  
  // ═══ 지도 뷰 모드: 지오맵 / 히트맵 토글 ═══
  const [mapViewMode, setMapViewMode] = useState<'geomap' | 'heatmap'>('geomap');
  
  // ResizeObserver 훅으로 컨테이너 크기 추적 (반응형)
  const [containerRef, containerSize] = useResizeObserver<HTMLDivElement>();
  
  // ═══ 히트맵 호버 상태 ═══
  const [heatmapHover, setHeatmapHover] = useState<{ name: string; size: number; x: number; y: number } | null>(null);

  // 드릴다운 상태 (Zustand)
  const { drillLevel, drillPath, selectedRegion, drillDown, drillUp, drillTo, resetDrill } = useDrillState();
  
  const statsScopeKey = selectedRegion?.name || 'national';
  
  // 반응형 레이아웃 모드 결정
  const layoutMode = useMemo(() => {
    // containerSize가 아직 측정되지 않았으면 desktop 기본값
    const width = containerSize.width || (typeof window !== 'undefined' ? window.innerWidth : 1920);
    if (width >= 1024) return 'desktop'; // 3열 레이아웃
    if (width >= 768) return 'tablet';   // 2단
    return 'mobile'; // 1열 스택
  }, [containerSize.width]);

  const columnFlex = useMemo(() => {
  const w = containerSize.width;

  // 모바일/태블릿은 기존 로직 유지
  if (w < 768) return { left: 1, center: 1, right: 1 };
  if (w < 1024) return { left: 1, center: 1, right: 1 }; // tablet에서는 아래 별도 레이아웃 쓰니까 의미 없음

  // desktop: 1024~1920 사이에서 연속적으로 보정
  const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
  const t = clamp((w - 1024) / (1920 - 1024), 0, 1); // 0~1

  // t가 커질수록(화면이 넓을수록) center↑ right↓
  const left = 1;
  const center = 6 + 2 * t;  // 6 → 8
  const right = 1.6 - 0.4 * t;   // 1.6 → 1.2

  return { left, center, right };
}, [containerSize.width]);


  // KPI 사전에서 패널별 KPI 가져오기
  const leftKPIs = useMemo(() => getKPIsByPanel('left'), []);
  // 케이스 이동 현황(center-load) 제거: bar 타입이고 id가 center-load가 아닌 것만
  const rightKPIs = useMemo(() => getKPIsForLevel(drillLevel).filter(k => 
    ['donut', 'bar', 'table'].includes(k.visualization.chartType) && 
    k.id !== 'total-cases' &&
    k.id !== 'center-load' && // 케이스 이동 현황 제거
    k.id !== 'case-distribution' && // 연령 분포 → Left 패널로 이동
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
      result[kpi.id] = fetchKPIData(kpi.id, selectedRegion?.code || 'KR', drillLevel, analyticsPeriod);
    });
    return result;
  }, [leftKPIs, rightKPIs, bottomKPIs, bulletKPIs, selectedRegion, drillLevel, analyticsPeriod]);

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

  const riskMatrixData = useMemo(() => {
    const regions = [
      { id: '11', name: '서울' }, { id: '26', name: '부산' }, { id: '27', name: '대구' },
      { id: '28', name: '인천' }, { id: '29', name: '광주' }, { id: '30', name: '대전' },
      { id: '31', name: '울산' }, { id: '36', name: '세종' }, { id: '41', name: '경기' },
      { id: '43', name: '충북' }, { id: '44', name: '충남' }, { id: '45', name: '전북' },
      { id: '46', name: '전남' }, { id: '47', name: '경북' }, { id: '48', name: '경남' },
      { id: '50', name: '제주' }, { id: '51', name: '강원' },
    ];
    return regions.map(r => {
      const seed = `${statsScopeKey}-${analyticsPeriod}-risk-${r.id}`;
      const slaRate = Number(seededValue(`${seed}-sla`, 78, 100).toFixed(1));
      const dataRate = Number(seededValue(`${seed}-data`, 75, 100).toFixed(1));
      const totalCases = Math.round(seededValue(`${seed}-cases`, 200, 3000));
      return { regionId: r.id, regionName: r.name, slaRate, dataRate, totalCases };
    });
  }, [statsScopeKey, analyticsPeriod]);

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
    <div ref={containerRef} className="flex flex-col bg-gray-50 h-full overflow-auto">
      {/* ═══════════════════════════════════════════════════════════
          상단 KPI 선택 카드 (버튼) - 지도 히트맵 KPI 변경
      ═══════════════════════════════════════════════════════════ */}
      <div className="bg-white border-b border-gray-200 px-4 py-2 shrink-0">
        <div className="flex items-center gap-2 overflow-x-auto">
          {MAP_KPI_CARDS.map((card) => {
            const isActive = selectedMapKpiId === card.id;
            const value = card.getValue(statsScopeKey);
            // KPI 색상 스타일
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
                onClick={() => setSelectedMapKpiId(card.id)}
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
      </div>

      {/* ═══════════════════════════════════════════════════════════
          HEADER
      ═══════════════════════════════════════════════════════════ */}
      <header className="h-15 bg-white border-b border-gray-200 flex items-center px-4 shrink-0">
        <h2 className="text-sm font-bold text-gray-800">전국 운영 대시보드</h2>
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
          MAIN CONTENT - CSS Grid 3열 레이아웃
          - Desktop (>=1024px): 1.3fr / 2.5fr / 2.2fr
          - Tablet: 2단, Mobile: 1열 스택
      ═══════════════════════════════════════════════════════════ */}
      <div className={`flex-1 p-2 gap-2 min-h-0 ${
        layoutMode === 'desktop' 
          ? 'grid overflow-hidden' 
          : layoutMode === 'tablet'
          ? 'flex flex-col overflow-y-auto'
          : 'flex flex-col overflow-y-auto'
      }`} style={layoutMode === 'desktop' ? { gridTemplateColumns: '1.3fr 2.5fr 2.2fr' } : undefined}>
        
        {/* ═══════════════════════════════════════════════════════
            LEFT COLUMN - KPI 요약 + 리스크 Top + 연령대별 차트
        ═══════════════════════════════════════════════════════ */}
        <div className={`flex flex-col gap-2 overflow-y-auto ${
          layoutMode === 'desktop' 
            ? 'min-w-0 h-full' 
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
          <div className="bg-white border border-gray-200 rounded-lg p-3">
            <div className="text-xs font-semibold text-gray-700 mb-2">리스크 Top 5 지역</div>
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
                    onClick={() => drillDown({ code: r.regionId, name: r.regionName, level: 'sido' })}
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
        </div>

        {/* ═══════════════════════════════════════════════════════
            CENTER COLUMN - GeoMap/Heatmap + 처리단계 범례
        ═══════════════════════════════════════════════════════ */}
        <div className={`${
          layoutMode === 'desktop' 
            ? 'min-w-0' 
            : 'w-full shrink-0'
        }`}>
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden h-full flex flex-col min-h-[400px]">
            {/* ── 중앙 패널 헤더: 뒤로/제목 + 지도/히트맵 토글 + 기간 토글 ── */}
            <div className="px-4 py-2.5 border-b border-gray-200 bg-white rounded-t-lg">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                  {drillLevel !== 'nation' && (
                    <button
                      onClick={drillUp}
                      className="flex items-center gap-1 h-7 px-2 text-xs text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors font-medium"
                    >
                      <ChevronLeft className="h-3.5 w-3.5" />
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
                      onClick={() => setMapViewMode('geomap')}
                      className={`px-2 py-0.5 text-[10px] font-medium transition ${
                        mapViewMode === 'geomap' ? 'bg-blue-600 text-white' : 'bg-white text-gray-500 hover:bg-gray-100'
                      }`}
                    >지오맵</button>
                    <button
                      onClick={() => setMapViewMode('heatmap')}
                      className={`px-2 py-0.5 text-[10px] font-medium transition border-l border-gray-200 ${
                        mapViewMode === 'heatmap' ? 'bg-blue-600 text-white' : 'bg-white text-gray-500 hover:bg-gray-100'
                      }`}
                    >히트맵</button>
                  </div>
                  {/* 기간 토글 */}
                  <div className="flex items-center gap-0.5">
                    {(['week', 'month', 'quarter', 'year'] as const).map(p => (
                      <button
                        key={p}
                        onClick={() => setAnalyticsPeriod(p)}
                        className={`rounded px-2 py-0.5 text-[10px] font-medium transition ${
                          analyticsPeriod === p
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                        }`}
                      >
                        {p === 'week' ? '주간' : p === 'month' ? '월간' : p === 'quarter' ? '분기' : '연간'}
                      </button>
                    ))}
                  </div>
                  <button className="h-7 w-7 flex items-center justify-center hover:bg-gray-100 rounded-lg transition-colors"><Download className="h-3.5 w-3.5 text-gray-500" /></button>
                </div>
              </div>
            </div>

            {/* ── 지도/히트맵 본체 ── */}
            <div className="flex-1 p-2 min-h-0">
              {mapViewMode === 'geomap' ? (
                <GeoMapPanel
                  key={`national-${selectedMapKpiId}-${drillLevel}-${selectedRegion?.code || 'all'}`}
                  title=""
                  indicatorId={selectedMapKpiId}
                  year={2026}
                  scope={{ mode: 'national' }}
                  variant="portal"
                  mapHeight={480}
                  hideBreadcrumb
                  externalLevel={drillLevel === 'nation' ? 'ctprvn' : drillLevel === 'sido' ? 'sig' : 'emd'}
                  externalSelectedCode={selectedRegion?.code}
                  onRegionSelect={handleRegionSelect}
                  onGoBack={drillUp}
                />
              ) : (
                /* 히트맵 뷰: Treemap */
                <div className="relative w-full" style={{ height: 'clamp(360px, 48vh, 520px)' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <Treemap
                      data={mapHeatmapData}
                      dataKey="size"
                      stroke="#fff"
                      isAnimationActive={false}
                      content={({ x, y, width, height, name, fill, textColor, size }: any) => {
                        if (!width || !height || width < 2 || height < 2) return null;
                        const shortName = (name || '').replace(/특별자치도|특별자치시|광역시|특별시/g, '').trim() || (name || '').slice(0, 3);
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
                              style={{ transition: 'opacity 0.15s' }}
                              opacity={heatmapHover && heatmapHover.name !== name ? 0.45 : 1} />
                            {width > 30 && height > 22 && (
                              <text x={x + width / 2} y={y + height / 2 - 6} textAnchor="middle" dominantBaseline="central" fill={tc}
                                fontSize={Math.min(width / 5, height / 2.5, 12)} fontWeight="700"
                                stroke={tc === '#ffffff' ? 'rgba(0,0,0,0.3)' : 'none'} strokeWidth={tc === '#ffffff' ? 0.3 : 0}
                                paintOrder="stroke" style={{ pointerEvents: 'none' }}>
                                {shortName}
                              </text>
                            )}
                            {width > 40 && height > 35 && (
                              <text x={x + width / 2} y={y + height / 2 + 8} textAnchor="middle" dominantBaseline="central" fill={tc}
                                fontSize={Math.min(width / 6, 10)} fontWeight="500" style={{ pointerEvents: 'none', opacity: 0.8 }}>
                                {(size || 0).toLocaleString()}
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
                    const total = mapHeatmapData.reduce((s, d) => s + d.size, 0);
                    const share = total > 0 ? ((heatmapHover.size / total) * 100).toFixed(1) : '0';
                    return (
                      <div className="absolute z-50 pointer-events-none bg-white border border-gray-200 rounded-lg p-2.5 shadow-xl text-xs min-w-[170px]"
                        style={{ left: Math.min(heatmapHover.x + 12, 200), top: Math.max(heatmapHover.y - 60, 0) }}>
                        <div className="flex items-center justify-between mb-1 pb-1 border-b border-gray-100">
                          <span className="font-semibold text-gray-800">{heatmapHover.name}</span>
                          <span className="text-[9px] bg-orange-50 text-orange-600 px-1.5 py-0.5 rounded font-medium">{analyticsPeriodLabel}</span>
                        </div>
                        <div className="flex justify-between py-0.5"><span className="text-gray-500">{selectedMapCard.label}</span><span className="font-bold text-blue-600">{heatmapHover.size.toLocaleString()}</span></div>
                        <div className="flex justify-between py-0.5"><span className="text-gray-500">순위</span><span className="font-bold text-gray-700">{rank}/{mapHeatmapData.length}</span></div>
                        <div className="flex justify-between py-0.5"><span className="text-gray-500">비중</span><span className="font-bold text-gray-700">{share}%</span></div>
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>

            {/* ── 처리 단계 범례 (항상 표시) ── */}
            <div className="px-3 py-2 border-t border-gray-100 bg-gray-50/50 shrink-0">
              <div className="flex items-center gap-3 flex-wrap">
                <span className="text-[10px] font-medium text-gray-500 mr-1">처리 단계:</span>
                {STAGE_KEYS.map(key => (
                  <span key={key} className="flex items-center gap-1 text-[10px] text-gray-600">
                    <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: STAGE_COLORS_MAP[key] }} />
                    {STAGE_LABELS[key]}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════
            RIGHT COLUMN - KPI 사전 기반 자동 렌더링
            Desktop: 25% 너비
        ═══════════════════════════════════════════════════════ */}
        <div className={`flex flex-col gap-2 overflow-y-auto ${
          layoutMode === 'desktop' 
            ? 'min-w-0 h-full' 
            : layoutMode === 'tablet'
            ? 'hidden'
            : 'w-full shrink-0'
        }`}>
          
          {/* ═══ 분석 기간 선택 (좌측 요약 + 우측 분석에만 적용) ═══ */}
          <div className="bg-white border border-gray-200 rounded-lg p-3 flex items-center justify-between">
            <div className="flex flex-col">
              <span className="text-xs font-semibold text-gray-700">분석 기간</span>
              <span className="text-[9px] text-gray-400 mt-0.5">좌측 요약 및 우측 분석 차트에 적용</span>
            </div>
            <div className="flex items-center gap-1">
              {(['week', 'month', 'quarter', 'year'] as const).map(period => (
                <button
                  key={period}
                  onClick={() => setAnalyticsPeriod(period)}
                  className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-colors ${
                    analyticsPeriod === period
                      ? 'bg-blue-500 text-white shadow-sm'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {period === 'week' ? '주간' : period === 'month' ? '월간' : period === 'quarter' ? '분기' : '연간(누적)'}
                </button>
              ))}
            </div>
          </div>

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


    </div>
  );
}
