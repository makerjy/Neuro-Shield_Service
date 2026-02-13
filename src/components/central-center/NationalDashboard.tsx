import React, { useMemo, useState, useCallback, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Download, BarChart3, HelpCircle, ChevronLeft, ChevronRight, Home, ChevronDown, ChevronUp } from 'lucide-react';
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
import { Activity, Shield, Database, ExternalLink as ExternalLinkIcon } from 'lucide-react';
import type { TabContext } from '../../lib/useTabContext';
import { MOCK_POLICY_CHANGES, MOCK_QUALITY_ALERTS } from '../../mocks/mockCentralOps';
import type { CentralKpiId, CentralTimeWindow, CentralKpiValue, FunnelStage, BottleneckMetric, LinkageMetric, RegionComparisonRow } from '../../lib/kpi.types';
import { getCentralKpiList, CENTRAL_KPI_COLORS } from '../../lib/centralKpiDictionary';
import { KPI_THEMES, KPI_ID_TO_KEY, type KpiBundle, type CentralKpiKey } from '../../lib/centralKpiTheme';
import { AlertTriangle, Users, Clock, Link2, ClipboardList } from 'lucide-react';
import { WorkflowStrip } from '../workflow/WorkflowStrip';
import type { WorkflowStep } from '../workflow/types';
import { useDashboardData } from '../../hooks/useDashboardData';
import { LoadingOverlay } from '../ui/LoadingOverlay';
import { AnimatedNumber } from '../ui/AnimatedNumber';
import { SIGUNGU_OPTIONS } from '../../mocks/mockGeo';
import { getChildrenScope } from '../../lib/dashboardChildrenScope';
import { assertTop5WithinChildren, selectTop5 } from '../../lib/top5Selector';

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
                 isAnimationActive
                 animationDuration={460}
                 animationEasing="ease-out"
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
              <div className="text-[12px] text-gray-500">{activeItem.name}</div>
              <div className="text-sm font-bold" style={{ color: activeItem.color }}>
                {((activeItem.value / total) * 100).toFixed(2)}%
              </div>
            </>
          ) : (
            <>
              <div className="text-[12px] text-gray-500">총합</div>
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
      <div style={{ height: '220px' }}>
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
              tick={{ fontSize: 14, fill: '#4b5563' }} 
              interval={0} 
              tickLine={false}
              axisLine={{ stroke: '#d1d5db' }}
            />
            <YAxis 
              tick={{ fontSize: 13, fill: '#6b7280' }} 
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
              isAnimationActive
              animationDuration={460}
              animationEasing="ease-out"
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
          <span className="text-[12px] font-semibold text-gray-700 truncate">{kpiDef.name}</span>
        </div>
        <span className={`text-[13px] font-bold flex-shrink-0 ${isMet ? 'text-green-600' : 'text-amber-600'}`}>
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
              tick={{ fontSize: 14, fill: '#374151', fontWeight: 500 }} 
              tickLine={false}
              axisLine={{ stroke: '#d1d5db' }}
              interval={xAxisInterval}
            />
            <YAxis 
              tick={{ fontSize: 13, fill: '#6b7280' }} 
              tickLine={false}
              axisLine={false}
              domain={['auto', 'auto']}
              width={30}
            />
            <Tooltip 
              contentStyle={{ fontSize: '14px', padding: '6px 10px', borderRadius: '6px', boxShadow: '0 2px 8px rgba(0,0,0,0.15)' }}
              formatter={(v: number) => [`${v}${unit}`, kpiDef.name]}
              labelFormatter={(label) => `${label}일`}
            />
            {/* 목표선 */}
            <ReferenceLine y={target} stroke="#ef4444" strokeDasharray="4 2" strokeWidth={1.5} label={{ value: '목표', fontSize: 12, fill: '#ef4444', position: 'right' }} />
            {/* 기준선 */}
            <ReferenceLine y={baseline} stroke="#9ca3af" strokeDasharray="3 3" strokeWidth={1} />
            {/* 영역 */}
            <Area 
              type="monotone" 
              dataKey="value" 
              fill={`url(#kpiGrad-${kpiDef.id})`}
              stroke="none"
              isAnimationActive
              animationDuration={500}
              animationEasing="ease-out"
            />
            {/* 라인 */}
            <Line 
              type="monotone" 
              dataKey="value" 
              stroke={lineColor} 
              strokeWidth={2}
              dot={false}
              isAnimationActive
              animationDuration={500}
              animationEasing="ease-out"
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
          <span className="text-[11px] text-gray-400 bg-gray-50 px-1.5 py-0.5 rounded">{timeRangeLabel}</span>
        </div>
        {/* 모드 토글 */}
        <div className="flex rounded-md border border-gray-200 overflow-hidden">
          <button
            onClick={() => setViewMode('percent')}
            className={`px-2.5 py-1 text-[12px] font-medium transition-colors ${
              viewMode === 'percent'
                ? 'bg-blue-500 text-white'
                : 'bg-white text-gray-600 hover:bg-gray-50'
            }`}
          >
            품질/성과(%)
          </button>
          <button
            onClick={() => setViewMode('days')}
            className={`px-2.5 py-1 text-[12px] font-medium transition-colors border-l border-gray-200 ${
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
                className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-[12px] font-medium transition-all border ${
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
          <span className="text-[12px] font-medium text-gray-700">{daysDef.label}</span>
          {(() => {
            const v = getCurrentValue('tat');
            return v ? <span className="text-xs font-bold" style={{ color: daysDef.color }}>{v}{daysDef.unit}</span> : null;
          })()}
          <span className="text-[11px] text-gray-400 ml-auto">목표: {daysDef.target}{daysDef.unit}</span>
        </div>
      )}

      {/* ── 차트 ── */}
      <div style={{ height: '320px' }}>
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
              tick={{ fontSize: 14, fill: '#6b7280' }}
              tickLine={false}
              axisLine={{ stroke: '#e5e7eb' }}
              interval={0}
            />
            <YAxis
              tick={{ fontSize: 13, fill: '#9ca3af' }}
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
                label={{ value: `목표 ${daysDef.target}${daysDef.unit}`, fontSize: 13, fill: daysDef.color, position: 'right' }}
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
                isAnimationActive
                animationDuration={500}
                animationEasing="ease-out"
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
          <div className="flex items-center gap-1 text-[12px] text-gray-400">
            <span className="w-4" style={{ borderTop: '2px dashed #9ca3af' }} />
            <span>목표선</span>
          </div>
          <div className="text-[12px] text-gray-400">최대 4개 동시 표시 · 칩 클릭으로 전환</div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════════
   AccordionSection — 3차 정보 접기/펼치기 공용 컴포넌트
═══════════════════════════════════════════════════════════════════════════════ */
function AccordionSection({
  title, isOpen, onToggle, summary, children, className = '',
}: {
  title: string;
  isOpen: boolean;
  onToggle: () => void;
  summary?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`bg-white border border-gray-200 rounded-lg overflow-hidden ${className}`}>
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-3 py-2 hover:bg-gray-50 transition-colors"
      >
        <span className="text-[12px] font-semibold text-gray-700">{title}</span>
        <div className="flex items-center gap-2">
          {!isOpen && summary && (
            <span className="text-[11px] text-gray-400 truncate max-w-[120px]">{summary}</span>
          )}
          {isOpen
            ? <ChevronUp className="h-3.5 w-3.5 text-gray-400 shrink-0" />
            : <ChevronDown className="h-3.5 w-3.5 text-gray-400 shrink-0" />}
        </div>
      </button>
      {isOpen && (
        <div className="border-t border-gray-100 px-3 py-2">{children}</div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════════
   FixedHeightCard — 고정 높이 + 내부 스크롤 카드 (우측 패널용)
═══════════════════════════════════════════════════════════════════════════════ */
function FixedHeightCard({
  title, badge, height = 280, children, className = '',
}: {
  title: string;
  badge?: React.ReactNode;
  height?: number;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`bg-white border border-gray-200 rounded-lg overflow-hidden flex flex-col ${className}`}
      style={{ height: `${height}px` }}>
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100 shrink-0">
        <span className="text-[12px] font-semibold text-gray-700">{title}</span>
        {badge}
      </div>
      <div className="flex-1 overflow-y-auto px-3 py-2 min-h-0">{children}</div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════════
   중앙센터 운영감사형 KPI 카드 행 + 드릴다운 서브페이지
═══════════════════════════════════════════════════════════════════════════════ */

const CENTRAL_KPI_ICONS: Record<CentralKpiId, React.ReactNode> = {
  SIGNAL_QUALITY: <AlertTriangle className="h-4 w-4" />,
  POLICY_IMPACT: <ClipboardList className="h-4 w-4" />,
  BOTTLENECK_RISK: <Clock className="h-4 w-4" />,
  DATA_READINESS: <Link2 className="h-4 w-4" />,
  GOVERNANCE_SAFETY: <Users className="h-4 w-4" />,
};

/* ── Sparkline 미니 차트 ── */
function MiniSparkline({ data, color, width = 80, height = 28 }: { data: number[]; color: string; width?: number; height?: number }) {
  if (!data || data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((v - min) / range) * (height - 4) - 2;
    return `${x},${y}`;
  }).join(' ');
  return (
    <svg width={width} height={height} className="flex-shrink-0">
      <polyline points={points} fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* ── KPI Hover Tooltip (Portal 기반, 200ms 딜레이, 키보드 접근 가능) ── */
const WINDOW_LABELS: Record<CentralTimeWindow, string> = {
  LAST_24H: '24h', LAST_7D: '7일', LAST_30D: '30일', LAST_90D: '90일',
};

type DashboardPeriodType = 'weekly' | 'monthly' | 'quarterly' | 'yearly_cum';

const PERIOD_TO_WINDOW: Record<DashboardPeriodType, CentralTimeWindow> = {
  weekly: 'LAST_7D',
  monthly: 'LAST_30D',
  quarterly: 'LAST_90D',
  yearly_cum: 'LAST_90D',
};

const PERIOD_LABELS: Record<DashboardPeriodType, string> = {
  weekly: '주간',
  monthly: '월간',
  quarterly: '분기',
  yearly_cum: '연간(누적)',
};

function KpiTooltip({ lines, color, timeWindow, periodLabel, anchorRef, visible }: {
  lines: [string, string, string];
  color: string;
  timeWindow: CentralTimeWindow;
  periodLabel?: string;
  anchorRef: React.RefObject<HTMLElement | null>;
  visible: boolean;
}) {
  const tipRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  useEffect(() => {
    if (!visible || !anchorRef.current) { setPos(null); return; }
    const rect = anchorRef.current.getBoundingClientRect();
    const tipW = 300;
    const tipH = 90;
    let top = rect.bottom + 6;
    let left = rect.left + rect.width / 2 - tipW / 2;
    // 뷰포트 보정
    if (left < 8) left = 8;
    if (left + tipW > window.innerWidth - 8) left = window.innerWidth - tipW - 8;
    if (top + tipH > window.innerHeight - 8) top = rect.top - tipH - 6;
    setPos({ top, left });
  }, [visible, anchorRef]);

  if (!visible || !pos) return null;
  const resolvedLines: [string, string, string] = [
    lines[0],
    lines[1].replace('{period}', `선택 기간(${periodLabel ?? WINDOW_LABELS[timeWindow]})`),
    lines[2],
  ];
  return createPortal(
    <div
      ref={tipRef}
      role="tooltip"
      className="fixed z-[9999] rounded-lg shadow-lg border border-gray-200 bg-white text-left pointer-events-none"
      style={{ top: pos.top, left: pos.left, maxWidth: 320, minWidth: 260 }}
    >
      {/* 색상 상단 액센트 라인 */}
      <div className="h-[3px] rounded-t-lg" style={{ backgroundColor: color }} />
      <div className="px-3 py-2.5 space-y-1">
        {resolvedLines.map((line, i) => (
          <p key={i} className={`text-[11px] leading-[1.5] ${i === 0 ? 'font-semibold text-gray-800' : i === 1 ? 'text-gray-500' : 'text-gray-600'}`}>
            {line}
          </p>
        ))}
      </div>
    </div>,
    document.body,
  );
}

/* ── Central KPI Card 단일 카드 ── */
function CentralKpiCard({ kpi, def, isActive, onClick, tooltipLines, tooltipColor, timeWindow, periodLabel }: {
  kpi: CentralKpiValue;
  def: ReturnType<typeof getCentralKpiList>[number];
  isActive: boolean;
  onClick: () => void;
  tooltipLines: [string, string, string];
  tooltipColor: string;
  timeWindow: CentralTimeWindow;
  periodLabel?: string;
}) {
  const colors = CENTRAL_KPI_COLORS[def.id];
  const deltaColor = def.higherBetter
    ? kpi.delta7d >= 0 ? 'text-green-600' : 'text-red-600'
    : kpi.delta7d <= 0 ? 'text-green-600' : 'text-red-600';
  const meetsTarget = def.higherBetter ? kpi.value >= def.target : kpi.value <= def.target;

  // Tooltip 200ms 딜레이, 키보드 접근성
  const btnRef = useRef<HTMLButtonElement>(null);
  const [tipOpen, setTipOpen] = useState(false);
  const delayRef = useRef<ReturnType<typeof setTimeout>>();
  const showTip = useCallback(() => { delayRef.current = setTimeout(() => setTipOpen(true), 200); }, []);
  const hideTip = useCallback(() => { clearTimeout(delayRef.current); setTipOpen(false); }, []);
  useEffect(() => () => clearTimeout(delayRef.current), []);

  return (
    <>
    <button
      ref={btnRef}
      onClick={onClick}
      onMouseEnter={showTip}
      onMouseLeave={hideTip}
      onFocus={showTip}
      onBlur={hideTip}
      onKeyDown={e => { if (e.key === 'Escape') hideTip(); }}
      aria-describedby={tipOpen ? `kpi-tip-${def.id}` : undefined}
      className={`relative flex flex-col gap-1.5 px-3 py-2.5 rounded-xl border-2 transition-all min-w-[170px] text-left ${
        isActive
          ? `${colors.border} ${colors.bg} shadow-md ring-2 ring-offset-1 ring-${colors.border.replace('border-', '')}/30`
          : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm'
      }`}
    >
      {/* top row: icon + name + sparkline */}
      <div className="flex items-center gap-2">
        <span className={`p-1 rounded-md ${isActive ? colors.bg : 'bg-gray-100'} ${isActive ? colors.text : 'text-gray-500'}`}>
          {CENTRAL_KPI_ICONS[def.id]}
        </span>
        <span className={`text-[11px] font-semibold truncate ${isActive ? colors.text : 'text-gray-600'}`}>{def.shortName}</span>
        <div className="ml-auto">
          <MiniSparkline data={kpi.sparkline || []} color={isActive ? colors.text.replace('text-', '#').replace('-700', '') : '#9ca3af'} />
        </div>
      </div>
      {/* value row */}
      <div className="flex items-end gap-1.5">
        <span className={`text-lg font-bold tabular-nums ${isActive ? colors.text : 'text-gray-800'}`}>
          <AnimatedNumber value={kpi.value} decimals={def.unit === '%' ? 1 : 0} />
          {def.unit}
        </span>
        <span className={`text-[11px] font-medium ${deltaColor}`}>
          {kpi.delta7d > 0 ? '+' : ''}{kpi.delta7d}pp
        </span>
      </div>
      {/* target bar */}
      <div className="flex items-center gap-1.5">
        <div className="flex-1 h-1.5 rounded-full bg-gray-200 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${meetsTarget ? 'bg-green-500' : 'bg-amber-400'}`}
            style={{ width: `${Math.min(100, (kpi.value / def.target) * 100)}%` }}
          />
        </div>
        <span className="text-[10px] text-gray-400">목표 {def.target}{def.unit}</span>
      </div>
      {/* num/den */}
      <div className="text-[10px] text-gray-400">
        {kpi.numerator.toLocaleString()} / {kpi.denominator.toLocaleString()}
      </div>
    </button>
    <KpiTooltip lines={tooltipLines} color={tooltipColor} timeWindow={timeWindow} periodLabel={periodLabel} anchorRef={btnRef} visible={tipOpen} />
    </>
  );
}

/* ── Funnel Panel ── */
function FunnelPanel({ stages }: { stages: FunnelStage[] }) {
  const total = stages[0]?.count ?? 0;
  const workflowSteps: WorkflowStep[] = stages.map((stage, index) => {
    const percentOfTotal = total > 0 ? Number(((stage.count / total) * 100).toFixed(1)) : 0;
    const conversionFromPrev = index === 0 ? undefined : stage.conversionRate;
    const status =
      conversionFromPrev == null
        ? "neutral"
        : conversionFromPrev >= 80
          ? "good"
          : conversionFromPrev >= 55
            ? "warn"
            : "bad";

    return {
      id: `funnel-${stage.stage}-${index}`,
      title: stage.label,
      value: stage.count,
      subLabel: "전체 대비",
      percentOfTotal,
      conversionFromPrev,
      status,
    };
  });

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-3">
      <div className="text-xs font-semibold text-gray-700 mb-3">전국 파이프라인 퍼널</div>
      <WorkflowStrip
        steps={workflowSteps}
        ariaLabel="전국 파이프라인 퍼널 단계 흐름"
        density="compact"
        layout="scroll"
      />
    </div>
  );
}

/* ── Bottleneck Panel ── */
function BottleneckPanel({ metrics }: { metrics: BottleneckMetric[] }) {
  const categories: { key: string; label: string; color: string }[] = [
    { key: 'consent', label: '동의', color: '#8b5cf6' },
    { key: 'readiness', label: '입력 Readiness', color: '#3b82f6' },
    { key: 'blocked', label: '차단 원인', color: '#ef4444' },
    { key: 'system', label: '시스템 안정성', color: '#06b6d4' },
  ];
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-3">
      <div className="text-xs font-semibold text-gray-700 mb-3">병목 진단</div>
      <div className="space-y-3">
        {categories.map(cat => {
          const items = metrics.filter(m => m.category === cat.key);
          if (items.length === 0) return null;
          return (
            <div key={cat.key}>
              <div className="flex items-center gap-1.5 mb-1.5">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: cat.color }} />
                <span className="text-[11px] font-semibold text-gray-600">{cat.label}</span>
              </div>
              <div className="space-y-1">
                {items.map(m => (
                  <div key={m.key} className="flex items-center gap-2">
                    <span className="flex-1 text-[11px] text-gray-600 truncate">{m.label}</span>
                    <span className={`text-[11px] font-bold ${m.status === 'red' ? 'text-red-600' : m.status === 'yellow' ? 'text-amber-600' : 'text-green-600'}`}>
                      {m.value}{m.unit}
                    </span>
                    <span className={`w-2 h-2 rounded-full ${m.status === 'red' ? 'bg-red-500' : m.status === 'yellow' ? 'bg-amber-400' : 'bg-green-500'}`} />
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── Linkage Panel ── */
function LinkagePanel({ metrics }: { metrics: LinkageMetric[] }) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-3">
      <div className="text-xs font-semibold text-gray-700 mb-3">연결률 & 리드타임</div>
      <div className="space-y-3">
        {metrics.map(m => (
          <div key={m.stage} className="border border-gray-100 rounded-lg p-2.5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[12px] font-semibold text-gray-700">
                {m.stage === 'stage2' ? '2차 연결' : '3차 추적'}
              </span>
              <span className={`text-sm font-bold ${m.linkageRate >= 60 ? 'text-green-600' : m.linkageRate >= 40 ? 'text-amber-600' : 'text-red-600'}`}>
                {m.linkageRate}%
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-[11px] mb-2">
              <div>
                <span className="text-gray-500">median 리드타임</span>
                <div className="font-semibold text-gray-800">{m.medianLeadTimeDays}일</div>
              </div>
              <div>
                <span className="text-gray-500">차단 건수</span>
                <div className="font-semibold text-red-600">{m.blockedCount}건</div>
              </div>
            </div>
            {m.blockedReasons.length > 0 && (
              <div className="space-y-0.5">
                <span className="text-[10px] text-gray-400">차단 원인</span>
                {m.blockedReasons.map(r => (
                  <div key={r.reason} className="flex items-center justify-between text-[11px]">
                    <span className="text-gray-600">{r.reason}</span>
                    <span className="font-medium text-gray-800">{r.count}건</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Regional Comparison Table ── */
function RegionalComparisonPanel({ rows }: { rows: RegionComparisonRow[] }) {
  const kpiDefs = getCentralKpiList();
  const shortRegion = (name: string) => name.replace(/특별자치도|특별자치시|광역시|특별시|도$/g, '').trim() || name.slice(0, 2);
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-3">
      <div className="text-xs font-semibold text-gray-700 mb-2">광역 비교 테이블 <span className="text-[10px] text-gray-400 ml-1">(worst-first)</span></div>
      <div className="overflow-x-auto">
        <table className="w-full text-[11px]">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="px-1.5 py-1 text-left font-medium text-gray-600 sticky left-0 bg-gray-50 z-10">지역</th>
              <th className="px-1.5 py-1 text-right font-medium text-gray-600">신호품질</th>
              <th className="px-1.5 py-1 text-right font-medium text-gray-600">정책영향</th>
              <th className="px-1.5 py-1 text-right font-medium text-gray-600">병목위험</th>
              <th className="px-1.5 py-1 text-right font-medium text-gray-600">데이터준비</th>
              <th className="px-1.5 py-1 text-right font-medium text-gray-600">거버넌스</th>
              <th className="px-1.5 py-1 text-right font-medium text-gray-600">차단%</th>
              <th className="px-1.5 py-1 text-right font-medium text-gray-600">적체건</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.regionCode} className={`border-b border-gray-100 hover:bg-amber-50/30 ${i < 3 ? 'bg-red-50/30' : ''}`}>
                <td className="px-1.5 py-1 font-medium text-gray-800 sticky left-0 bg-inherit z-10">{shortRegion(r.regionName)}</td>
                <td className="px-1.5 py-1 text-right tabular-nums">{r.signalQuality}%</td>
                <td className="px-1.5 py-1 text-right tabular-nums">{r.policyImpact}%</td>
                <td className={`px-1.5 py-1 text-right tabular-nums font-medium ${r.bottleneckRisk > 40 ? 'text-red-600' : ''}`}>{r.bottleneckRisk}%</td>
                <td className="px-1.5 py-1 text-right tabular-nums">{r.dataReadiness}%</td>
                <td className="px-1.5 py-1 text-right tabular-nums">{r.governanceSafety}%</td>
                <td className={`px-1.5 py-1 text-right tabular-nums font-medium ${r.blockedPct > 20 ? 'text-red-600' : r.blockedPct > 15 ? 'text-amber-600' : 'text-green-600'}`}>{r.blockedPct}%</td>
                <td className="px-1.5 py-1 text-right tabular-nums">{r.backlogCount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════════
   메인 컴포넌트
═══════════════════════════════════════════════════════════════════════════════ */
interface NationalDashboardProps {
  onNavigate?: (page: string, ctx?: Partial<TabContext>) => void;
}

export function NationalDashboard({ onNavigate }: NationalDashboardProps) {
  // SSOT: 단일 상태로 통합
  const selectedKpiId = 'total_cases';
  const [periodType, setPeriodType] = useState<DashboardPeriodType>('weekly');
  const centralWindow = useMemo<CentralTimeWindow>(() => PERIOD_TO_WINDOW[periodType], [periodType]);
  const periodLabel = PERIOD_LABELS[periodType];
  // analyticsPeriod를 periodType에서 자동 파생 (기간 통합: 센터 패널 기간 토글이 전체 분석 기간 제어)
  const analyticsPeriod = useMemo<'week' | 'month' | 'quarter' | 'year'>(() => {
    const map = { weekly: 'week', monthly: 'month', quarterly: 'quarter', yearly_cum: 'year' } as const;
    return map[periodType];
  }, [periodType]);
  const [visualizationMode, setVisualizationMode] = useState<'geomap' | 'heatmap'>('geomap');
  const [activeDonutIndex, setActiveDonutIndex] = useState<number | null>(null);
  const [showKpiSummaryTable, setShowKpiSummaryTable] = useState(false);

  // ── 정보 위계 제어 상태 (1차/2차/3차) ──
  const [leftAccordion, setLeftAccordion] = useState<{ opsSummary: boolean; ageRisk: boolean; kpiTable: boolean }>({
    opsSummary: false,
    ageRisk: false,
    kpiTable: false,
  });
  const toggleLeftAccordion = useCallback((key: keyof typeof leftAccordion) => {
    setLeftAccordion(prev => ({ ...prev, [key]: !prev[key] }));
  }, []);
  const [showBreakdownMore, setShowBreakdownMore] = useState(false);
  const [showCauseMore, setShowCauseMore] = useState(false);
  const [rightAccordion, setRightAccordion] = useState<{ slaMatrix: boolean; stageDistribution: boolean }>({
    slaMatrix: false,
    stageDistribution: false,
  });
  const toggleRightAccordion = useCallback((key: keyof typeof rightAccordion) => {
    setRightAccordion(prev => ({ ...prev, [key]: !prev[key] }));
  }, []);

  // 지도/히트맵 KPI는 상단 KPI 선택과 동일하게 사용
  const selectedMapKpiId = selectedKpiId;
  
  // ResizeObserver 훅으로 컨테이너 크기 추적 (반응형)
  const [containerRef, containerSize] = useResizeObserver<HTMLDivElement>();
  // 히트맵 호버 상태
  const [heatmapHover, setHeatmapHover] = useState<{ name: string; size: number; x: number; y: number } | null>(null);
  // GeoMapPanel에서 전달받은 현재 지도에 표시된 하위 지역 목록
  const [mapSubRegions, setMapSubRegions] = useState<{ id: string; name: string }[]>([]);
  const handleSubRegionsChange = useCallback((regions: { code: string; name: string }[]) => {
    setMapSubRegions(regions.map(r => ({ id: r.code, name: r.name })));
  }, []);

  /* ── 중앙센터 운영감사형 KPI 상태 ── */
  const [activeCentralKpi, setActiveCentralKpi] = useState<CentralKpiId>('SIGNAL_QUALITY');
  const [showDrilldown, setShowDrilldown] = useState(false);
  const centralKpiDefs = useMemo(() => getCentralKpiList(), []);

  // 현재 선택된 KPI의 테마 & 번들
  const activeKpiKey = useMemo<CentralKpiKey>(() => KPI_ID_TO_KEY[activeCentralKpi], [activeCentralKpi]);
  const activeTheme = useMemo(() => KPI_THEMES[activeKpiKey], [activeKpiKey]);

  /* ── KPI → MapColorScheme 매핑 ── */
  const kpiColorScheme = useMemo<MapColorScheme>(() => {
    const map: Record<CentralKpiId, MapColorScheme> = {
      SIGNAL_QUALITY: 'blue',
      POLICY_IMPACT: 'purple',
      BOTTLENECK_RISK: 'red',
      DATA_READINESS: 'green',
      GOVERNANCE_SAFETY: 'orange',
    };
    return map[activeCentralKpi];
  }, [activeCentralKpi]);

  // 드릴다운 상태 (Zustand)
  const { drillLevel, drillPath, selectedRegion, drillUp, drillTo, resetDrill, setScope } = useDrillState();
  const [selectedArea, setSelectedArea] = useState<{ code: string; name: string } | null>(null);
  const statsScopeKey = selectedArea?.code ?? selectedRegion?.code ?? 'national';
  
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
     공통: 드릴레벨에 따른 하위 지역 목록 결정 (모든 통계 패널 공유)
  ───────────────────────────────────────────────────────────── */
  const NATION_REGIONS_FULL = [
    { id: '11', name: '서울특별시' }, { id: '21', name: '부산광역시' }, { id: '22', name: '대구광역시' },
    { id: '23', name: '인천광역시' }, { id: '24', name: '광주광역시' }, { id: '25', name: '대전광역시' },
    { id: '26', name: '울산광역시' }, { id: '29', name: '세종특별자치시' }, { id: '31', name: '경기도' },
    { id: '33', name: '충청북도' }, { id: '34', name: '충청남도' }, { id: '35', name: '전라북도' },
    { id: '36', name: '전라남도' }, { id: '37', name: '경상북도' }, { id: '38', name: '경상남도' },
    { id: '39', name: '제주특별자치도' }, { id: '32', name: '강원도' },
  ];

  const candidateSubRegions = useMemo<{ code: string; name: string }[]>(() => {
    if (drillLevel === 'nation') {
      return NATION_REGIONS_FULL.map((region) => ({ code: region.id, name: region.name }));
    }

    // 1순위: 지도 레이어에서 전달된 현재 화면 하위 행정구역 (지오맵과 동일 소스)
    if (mapSubRegions.length > 0) {
      return mapSubRegions.map((region) => ({ code: region.id, name: region.name }));
    }

    // fallback(2순위): 서비스 코드 체계 기반 시군구 목록
    if (drillLevel === 'sido' && selectedRegion?.code) {
      const fallbackSigungu = SIGUNGU_OPTIONS[selectedRegion.code] ?? [];
      if (fallbackSigungu.length > 0) {
        return fallbackSigungu.map((region) => ({ code: region.code, name: region.label }));
      }
    }

    return [];
  }, [drillLevel, mapSubRegions, selectedRegion?.code]);

  const childrenScope = useMemo(
    () =>
      getChildrenScope({
        level: drillLevel,
        parentRegionCode: selectedRegion?.code,
        candidates: candidateSubRegions,
      }),
    [drillLevel, selectedRegion?.code, candidateSubRegions]
  );

  const currentSubRegions = useMemo<{ id: string; name: string }[]>(
    () => childrenScope.children.map((region) => ({ id: region.code, name: region.name })),
    [childrenScope]
  );

  useEffect(() => {
    setSelectedArea(null);
  }, [drillLevel, selectedRegion?.code]);

  useEffect(() => {
    if (!selectedArea) return;
    if (childrenScope.childrenCodes.includes(selectedArea.code)) return;
    setSelectedArea(null);
  }, [selectedArea, childrenScope.childrenCodes]);

  const scope = useMemo(() => ({
    level: drillLevel,
    regionCode: selectedRegion?.code,
    regionName: selectedRegion?.name,
    subRegions: currentSubRegions,
  }), [drillLevel, selectedRegion, currentSubRegions]);

  const {
    centralKpis,
    dashData,
    drilldownData,
    loadingStage,
    isScopeChangeLoading,
    prefetchScope,
  } = useDashboardData(scope, centralWindow, activeCentralKpi, {
    loadDrilldown: showDrilldown,
    periodVariant: periodType,
  });

  const { funnelData, bottleneckData, linkageData, regionData } = drilldownData;
  const currentBundle = useMemo<KpiBundle | null>(() => dashData ? dashData[activeKpiKey] : null, [dashData, activeKpiKey]);
  const top5MetricByCode = useMemo(
    () =>
      (currentBundle?.regions ?? []).reduce<Record<string, number>>((acc, region) => {
        acc[region.regionCode] = region.value;
        return acc;
      }, {}),
    [currentBundle]
  );

  const top5Rows = useMemo(
    () =>
      selectTop5({
        metricByCode: top5MetricByCode,
        childrenCodes: childrenScope.childrenCodes,
        nameMap: childrenScope.childrenNameMap,
        sortOrder: activeTheme.legend.direction === 'higherWorse' ? 'desc' : 'asc',
        excludeCodes: selectedRegion?.code ? [selectedRegion.code] : [],
        onMissingName: (code) => {
          console.warn(`[Top5] missing nameMap for code: ${code}`);
        },
      }),
    [
      top5MetricByCode,
      childrenScope.childrenCodes,
      childrenScope.childrenNameMap,
      activeTheme.legend.direction,
      selectedRegion?.code,
    ]
  );

  const selectedAreaMetric = useMemo(() => {
    if (!selectedArea || !currentBundle) return null;
    return currentBundle.regions.find((region) => region.regionCode === selectedArea.code) ?? null;
  }, [currentBundle, selectedArea]);

  const focusedTrendData = useMemo(() => {
    if (!currentBundle) return [];
    if (!selectedArea?.code) return currentBundle.trend;
    return currentBundle.trend.map((point, index) => ({
      ...point,
      value: Number((point.value + seededValue(`${selectedArea.code}-${activeKpiKey}-trend-${index}`, -2.8, 2.8)).toFixed(1)),
    }));
  }, [currentBundle, selectedArea?.code, activeKpiKey]);

  useEffect(() => {
    if (drillLevel !== 'sido') return;
    console.assert(
      childrenScope.childrenType === 'sigungu',
      '[Top5] expected childrenType=sigungu when level=sido',
      { childrenType: childrenScope.childrenType }
    );
  }, [drillLevel, childrenScope.childrenType]);

  useEffect(() => {
    if (!top5Rows.length) return;
    assertTop5WithinChildren({
      top5: top5Rows,
      childrenCodes: childrenScope.childrenCodes,
      parentRegionCode: selectedRegion?.code,
    });
  }, [top5Rows, childrenScope.childrenCodes, selectedRegion?.code]);

  /* ─────────────────────────────────────────────────────────────
     트리맵 데이터 (지역별 케이스) - 히트맵 스타일 + 시간필터 연동
  ───────────────────────────────────────────────────────────── */
  const treemapData = useMemo(() => {
    // 분석 기간에 따른 배율 (주간 < 월간 < 분기)
    const multiplier = analyticsPeriod === 'week' ? 1 : analyticsPeriod === 'month' ? 4.2 : analyticsPeriod === 'year' ? 52 : 13;
    const filterKey = `${statsScopeKey}-${analyticsPeriod}`; // 기간별 다른 시드
    
    // 드릴레벨에 따른 하위 지역별 데이터 생성
    const rawData = currentSubRegions.map(r => ({
      name: r.name,
      size: Math.round(seededValue(`${filterKey}-tree-${r.id}`, 250, 3500) * multiplier),
    }));
    
    // 최대/최소 값 계산
    const maxSize = Math.max(...rawData.map(d => d.size));
    const minSize = Math.min(...rawData.map(d => d.size));
    
    // KPI 테마 palette(7단계) 사용 → KPI 버튼에 따라 색상 변경
    const pal = activeTheme.palette;
    const getHeatmapColor = (value: number) => {
      const ratio = (value - minSize) / (maxSize - minSize || 1);
      if (ratio < 0.14) return pal[0];
      if (ratio < 0.28) return pal[1];
      if (ratio < 0.42) return pal[2];
      if (ratio < 0.57) return pal[3];
      if (ratio < 0.71) return pal[4];
      if (ratio < 0.85) return pal[5];
      return pal[6];
    };
    
    return rawData.map(item => ({
      ...item,
      fill: getHeatmapColor(item.size),
    }));
  }, [statsScopeKey, analyticsPeriod, activeTheme.palette, currentSubRegions]);

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

    // 드릴레벨에 따른 하위 지역별 히트맵 데이터
    const rawData = currentSubRegions.map(r => ({
      name: r.name,
      value: seededValue(`${seedPrefix}-${r.id}`, range.min, range.max),
    }));

    const maxValue = Math.max(...rawData.map((d) => d.value));
    const minValue = Math.min(...rawData.map((d) => d.value));

    // activeTheme.palette (7단계)를 직접 사용 → KPI 버튼 변경 시 히트맵 색상도 연동
    const pal = activeTheme.palette; // 7색 배열 from centralKpiTheme
    const getKpiHeatmapColor = (value: number) => {
      const ratio = (value - minValue) / (maxValue - minValue || 1);
      if (ratio < 0.14) return pal[0];
      if (ratio < 0.28) return pal[1];
      if (ratio < 0.42) return pal[2];
      if (ratio < 0.57) return pal[3];
      if (ratio < 0.71) return pal[4];
      if (ratio < 0.85) return pal[5];
      return pal[6];
    };

    // 연한 색상(palette 앞 2개)이면 어두운 텍스트, 아니면 흰색 텍스트
    const lightSet = new Set([pal[0], pal[1]]);

    return rawData.map((item) => {
      const fill = getKpiHeatmapColor(item.value);
      return {
        name: item.name,
        size: Math.round(item.value),
        fill,
        textColor: lightSet.has(fill) ? '#1e293b' : '#ffffff',
      };
    });
  }, [statsScopeKey, selectedMapKpiId, activeTheme.palette, currentSubRegions]);

  /* ─────────────────────────────────────────────────────────────
     SLA × 데이터 충족률 2×2 리스크 매트릭스 데이터
  ───────────────────────────────────────────────────────────── */
  const SLA_THRESHOLD = 95;
  const DATA_THRESHOLD = 93;

  // 시도 → 시군구 매핑 (현재 선택 시도의 하위 행정구역)
  const SIDO_SIGUNGU_MAP: Record<string, { id: string; name: string }[]> = {
    '서울': [
      {id:'11010',name:'종로구'},{id:'11020',name:'중구'},{id:'11030',name:'용산구'},{id:'11040',name:'성동구'},
      {id:'11050',name:'광진구'},{id:'11060',name:'동대문구'},{id:'11070',name:'중랑구'},{id:'11080',name:'성북구'},
      {id:'11090',name:'강북구'},{id:'11100',name:'도봉구'},{id:'11110',name:'노원구'},{id:'11120',name:'은평구'},
      {id:'11130',name:'서대문구'},{id:'11140',name:'마포구'},{id:'11150',name:'양천구'},{id:'11160',name:'강서구'},
      {id:'11170',name:'구로구'},{id:'11180',name:'금천구'},{id:'11190',name:'영등포구'},{id:'11200',name:'동작구'},
      {id:'11210',name:'관악구'},{id:'11220',name:'서초구'},{id:'11230',name:'강남구'},{id:'11240',name:'송파구'},{id:'11250',name:'강동구'},
    ],
    '부산': [{id:'21010',name:'중구'},{id:'21020',name:'서구'},{id:'21030',name:'동구'},{id:'21040',name:'영도구'},{id:'21050',name:'부산진구'},{id:'21060',name:'동래구'},{id:'21070',name:'남구'},{id:'21080',name:'북구'},{id:'21090',name:'해운대구'},{id:'21100',name:'사하구'},{id:'21110',name:'금정구'},{id:'21120',name:'강서구'},{id:'21130',name:'연제구'},{id:'21140',name:'수영구'},{id:'21150',name:'사상구'},{id:'21310',name:'기장군'}],
    '대구': [{id:'22010',name:'중구'},{id:'22020',name:'동구'},{id:'22030',name:'서구'},{id:'22040',name:'남구'},{id:'22050',name:'북구'},{id:'22060',name:'수성구'},{id:'22070',name:'달서구'},{id:'22310',name:'달성군'}],
    '인천': [{id:'23010',name:'중구'},{id:'23020',name:'동구'},{id:'23030',name:'미추홀구'},{id:'23040',name:'연수구'},{id:'23050',name:'남동구'},{id:'23060',name:'부평구'},{id:'23070',name:'계양구'},{id:'23080',name:'서구'},{id:'23310',name:'강화군'},{id:'23320',name:'옹진군'}],
    '광주': [{id:'24010',name:'동구'},{id:'24020',name:'서구'},{id:'24030',name:'남구'},{id:'24040',name:'북구'},{id:'24050',name:'광산구'}],
    '대전': [{id:'25010',name:'동구'},{id:'25020',name:'중구'},{id:'25030',name:'서구'},{id:'25040',name:'유성구'},{id:'25050',name:'대덕구'}],
    '울산': [{id:'26010',name:'중구'},{id:'26020',name:'남구'},{id:'26030',name:'동구'},{id:'26040',name:'북구'},{id:'26310',name:'울주군'}],
    '세종': [{id:'29010',name:'세종시'}],
    '경기': [
      {id:'31011',name:'수원시'},{id:'31021',name:'성남시'},{id:'31030',name:'의정부시'},{id:'31041',name:'안양시'},
      {id:'31050',name:'부천시'},{id:'31060',name:'광명시'},{id:'31070',name:'평택시'},{id:'31080',name:'동두천시'},
      {id:'31091',name:'안산시'},{id:'31101',name:'고양시'},{id:'31110',name:'과천시'},{id:'31120',name:'구리시'},
      {id:'31130',name:'남양주시'},{id:'31140',name:'오산시'},{id:'31150',name:'시흥시'},{id:'31160',name:'군포시'},
      {id:'31170',name:'의왕시'},{id:'31180',name:'하남시'},{id:'31191',name:'용인시'},{id:'31200',name:'파주시'},
      {id:'31210',name:'이천시'},{id:'31220',name:'안성시'},{id:'31230',name:'김포시'},{id:'31240',name:'화성시'},
      {id:'31250',name:'광주시'},{id:'31260',name:'양주시'},{id:'31270',name:'포천시'},{id:'31280',name:'여주시'},
      {id:'31350',name:'연천군'},{id:'31370',name:'가평군'},{id:'31380',name:'양평군'},
    ],
    '충북': [{id:'33041',name:'청주시'},{id:'33020',name:'충주시'},{id:'33030',name:'제천시'},{id:'33320',name:'보은군'},{id:'33330',name:'옥천군'},{id:'33340',name:'영동군'},{id:'33390',name:'증평군'},{id:'33350',name:'진천군'},{id:'33360',name:'괴산군'},{id:'33370',name:'음성군'},{id:'33380',name:'단양군'}],
    '충남': [{id:'34011',name:'천안시'},{id:'34020',name:'공주시'},{id:'34030',name:'보령시'},{id:'34040',name:'아산시'},{id:'34050',name:'서산시'},{id:'34060',name:'논산시'},{id:'34070',name:'계룡시'},{id:'34080',name:'당진시'},{id:'34310',name:'금산군'},{id:'34330',name:'부여군'},{id:'34340',name:'서천군'},{id:'34350',name:'청양군'},{id:'34360',name:'홍성군'},{id:'34370',name:'예산군'},{id:'34380',name:'태안군'}],
    '전북': [{id:'35011',name:'전주시'},{id:'35020',name:'군산시'},{id:'35030',name:'익산시'},{id:'35040',name:'정읍시'},{id:'35050',name:'남원시'},{id:'35060',name:'김제시'},{id:'35310',name:'완주군'},{id:'35320',name:'진안군'},{id:'35330',name:'무주군'},{id:'35340',name:'장수군'},{id:'35350',name:'임실군'},{id:'35360',name:'순창군'},{id:'35370',name:'고창군'},{id:'35380',name:'부안군'}],
    '전남': [{id:'36010',name:'목포시'},{id:'36020',name:'여수시'},{id:'36030',name:'순천시'},{id:'36040',name:'나주시'},{id:'36060',name:'광양시'},{id:'36310',name:'담양군'},{id:'36320',name:'곡성군'},{id:'36330',name:'구례군'},{id:'36350',name:'고흥군'},{id:'36360',name:'보성군'},{id:'36370',name:'화순군'},{id:'36380',name:'장흥군'},{id:'36390',name:'강진군'},{id:'36400',name:'해남군'},{id:'36410',name:'영암군'},{id:'36420',name:'무안군'},{id:'36430',name:'함평군'},{id:'36440',name:'영광군'},{id:'36450',name:'장성군'},{id:'36460',name:'완도군'},{id:'36470',name:'진도군'},{id:'36480',name:'신안군'}],
    '경북': [{id:'37011',name:'포항시'},{id:'37020',name:'경주시'},{id:'37030',name:'김천시'},{id:'37040',name:'안동시'},{id:'37050',name:'구미시'},{id:'37060',name:'영주시'},{id:'37070',name:'영천시'},{id:'37080',name:'상주시'},{id:'37090',name:'문경시'},{id:'37100',name:'경산시'},{id:'37310',name:'군위군'},{id:'37320',name:'의성군'},{id:'37330',name:'청송군'},{id:'37340',name:'영양군'},{id:'37350',name:'영덕군'},{id:'37360',name:'청도군'},{id:'37370',name:'고령군'},{id:'37380',name:'성주군'},{id:'37390',name:'칠곡군'},{id:'37400',name:'예천군'},{id:'37410',name:'봉화군'},{id:'37420',name:'울진군'},{id:'37430',name:'울릉군'}],
    '경남': [{id:'38111',name:'창원시'},{id:'38030',name:'진주시'},{id:'38050',name:'통영시'},{id:'38060',name:'사천시'},{id:'38070',name:'김해시'},{id:'38080',name:'밀양시'},{id:'38090',name:'거제시'},{id:'38100',name:'양산시'},{id:'38310',name:'의령군'},{id:'38320',name:'함안군'},{id:'38330',name:'창녕군'},{id:'38340',name:'고성군'},{id:'38350',name:'남해군'},{id:'38360',name:'하동군'},{id:'38370',name:'산청군'},{id:'38380',name:'함양군'},{id:'38390',name:'거창군'},{id:'38400',name:'합천군'}],
    '제주': [{id:'39010',name:'제주시'},{id:'39020',name:'서귀포시'}],
    '강원': [{id:'32010',name:'춘천시'},{id:'32020',name:'원주시'},{id:'32030',name:'강릉시'},{id:'32040',name:'동해시'},{id:'32050',name:'태백시'},{id:'32060',name:'속초시'},{id:'32070',name:'삼척시'},{id:'32310',name:'홍천군'},{id:'32320',name:'횡성군'},{id:'32330',name:'영월군'},{id:'32340',name:'평창군'},{id:'32350',name:'정선군'},{id:'32360',name:'철원군'},{id:'32370',name:'화천군'},{id:'32380',name:'양구군'},{id:'32390',name:'인제군'},{id:'32400',name:'고성군'},{id:'32410',name:'양양군'}],
  };

  // 시군구 → 읍면동 매핑 (코드 기반)
  const SIGUNGU_EMD_MAP: Record<string, { id: string; name: string }[]> = {
    // ── 서울 ──
    '11010': [{id:'1111051',name:'청운효자동'},{id:'1111053',name:'사직동'},{id:'1111055',name:'삼청동'},{id:'1111057',name:'부암동'},{id:'1111060',name:'평창동'},{id:'1111064',name:'혜화동'},{id:'1111068',name:'이화동'},{id:'1111070',name:'창신동'}],
    '11020': [{id:'1114051',name:'소공동'},{id:'1114053',name:'회현동'},{id:'1114055',name:'명동'},{id:'1114057',name:'필동'},{id:'1114060',name:'장충동'},{id:'1114062',name:'광희동'},{id:'1114065',name:'을지로동'},{id:'1114067',name:'신당동'}],
    '11030': [{id:'1117051',name:'후암동'},{id:'1117053',name:'용산2가동'},{id:'1117055',name:'남영동'},{id:'1117057',name:'청파동'},{id:'1117060',name:'원효로1동'},{id:'1117062',name:'원효로2동'},{id:'1117065',name:'이촌1동'},{id:'1117067',name:'이촌2동'},{id:'1117070',name:'한강로동'},{id:'1117072',name:'한남동'}],
    '11040': [{id:'1120051',name:'왕십리2동'},{id:'1120053',name:'왕십리도선동'},{id:'1120055',name:'마장동'},{id:'1120057',name:'사근동'},{id:'1120060',name:'행당1동'},{id:'1120062',name:'행당2동'},{id:'1120065',name:'응봉동'},{id:'1120067',name:'금호1가동'},{id:'1120070',name:'옥수동'},{id:'1120072',name:'성수1가1동'},{id:'1120074',name:'성수1가2동'},{id:'1120076',name:'성수2가1동'},{id:'1120078',name:'성수2가3동'},{id:'1120080',name:'송정동'}],
    '11140': [{id:'1144051',name:'아현동'},{id:'1144053',name:'공덕동'},{id:'1144055',name:'도화동'},{id:'1144057',name:'용강동'},{id:'1144060',name:'대흥동'},{id:'1144062',name:'서교동'},{id:'1144065',name:'합정동'},{id:'1144067',name:'망원1동'},{id:'1144070',name:'망원2동'},{id:'1144072',name:'연남동'},{id:'1144074',name:'성산1동'},{id:'1144076',name:'성산2동'},{id:'1144078',name:'상암동'}],
    '11190': [{id:'1156051',name:'여의동'},{id:'1156053',name:'당산1동'},{id:'1156055',name:'당산2동'},{id:'1156057',name:'도림동'},{id:'1156060',name:'문래동'},{id:'1156062',name:'영등포동'},{id:'1156065',name:'영등포본동'},{id:'1156067',name:'신길1동'},{id:'1156070',name:'신길3동'},{id:'1156072',name:'신길4동'},{id:'1156074',name:'신길5동'},{id:'1156076',name:'대림1동'},{id:'1156078',name:'대림2동'},{id:'1156080',name:'대림3동'}],
    '11220': [{id:'1165051',name:'서초1동'},{id:'1165053',name:'서초2동'},{id:'1165055',name:'서초3동'},{id:'1165057',name:'서초4동'},{id:'1165060',name:'잠원동'},{id:'1165062',name:'반포1동'},{id:'1165065',name:'반포2동'},{id:'1165067',name:'반포3동'},{id:'1165070',name:'반포4동'},{id:'1165072',name:'방배본동'},{id:'1165074',name:'방배1동'},{id:'1165076',name:'방배2동'},{id:'1165078',name:'방배3동'},{id:'1165080',name:'방배4동'},{id:'1165082',name:'내곡동'}],
    '11230': [{id:'1168051',name:'신사동'},{id:'1168053',name:'논현1동'},{id:'1168055',name:'논현2동'},{id:'1168057',name:'압구정동'},{id:'1168060',name:'청담동'},{id:'1168062',name:'삼성1동'},{id:'1168064',name:'삼성2동'},{id:'1168066',name:'대치1동'},{id:'1168068',name:'대치2동'},{id:'1168070',name:'대치4동'},{id:'1168072',name:'역삼1동'},{id:'1168074',name:'역삼2동'},{id:'1168076',name:'도곡1동'},{id:'1168078',name:'도곡2동'},{id:'1168080',name:'개포1동'},{id:'1168082',name:'개포4동'},{id:'1168084',name:'일원본동'},{id:'1168086',name:'일원1동'},{id:'1168088',name:'수서동'},{id:'1168090',name:'세곡동'}],
    '11240': [{id:'1171051',name:'잠실본동'},{id:'1171053',name:'잠실2동'},{id:'1171055',name:'잠실3동'},{id:'1171057',name:'잠실4동'},{id:'1171060',name:'잠실6동'},{id:'1171062',name:'잠실7동'},{id:'1171064',name:'송파1동'},{id:'1171066',name:'송파2동'},{id:'1171068',name:'가락본동'},{id:'1171070',name:'가락1동'},{id:'1171072',name:'가락2동'},{id:'1171074',name:'문정1동'},{id:'1171076',name:'문정2동'},{id:'1171078',name:'거여1동'},{id:'1171080',name:'거여2동'},{id:'1171082',name:'마천1동'},{id:'1171084',name:'마천2동'},{id:'1171086',name:'석촌동'},{id:'1171088',name:'풍납1동'},{id:'1171090',name:'풍납2동'},{id:'1171092',name:'오금동'},{id:'1171094',name:'위례동'}],
    '11250': [{id:'1174051',name:'강일동'},{id:'1174053',name:'상일1동'},{id:'1174055',name:'상일2동'},{id:'1174057',name:'명일1동'},{id:'1174060',name:'명일2동'},{id:'1174062',name:'고덕1동'},{id:'1174064',name:'고덕2동'},{id:'1174066',name:'암사1동'},{id:'1174068',name:'암사2동'},{id:'1174070',name:'암사3동'},{id:'1174072',name:'천호1동'},{id:'1174074',name:'천호2동'},{id:'1174076',name:'천호3동'},{id:'1174078',name:'성내1동'},{id:'1174080',name:'성내2동'},{id:'1174082',name:'성내3동'},{id:'1174084',name:'둔촌1동'},{id:'1174086',name:'둔촌2동'}],
    // ── 부산 ──
    '21010': [{id:'2611051',name:'중앙동'},{id:'2611053',name:'동광동'},{id:'2611055',name:'대청동'},{id:'2611057',name:'보수동'},{id:'2611060',name:'부평동'},{id:'2611062',name:'광복동'},{id:'2611064',name:'남포동'},{id:'2611066',name:'영주동'}],
    '21050': [{id:'2623051',name:'부전1동'},{id:'2623053',name:'부전2동'},{id:'2623055',name:'연지동'},{id:'2623057',name:'초읍동'},{id:'2623060',name:'양정1동'},{id:'2623062',name:'양정2동'},{id:'2623064',name:'전포1동'},{id:'2623066',name:'전포2동'},{id:'2623068',name:'부암1동'},{id:'2623070',name:'부암3동'},{id:'2623072',name:'당감1동'},{id:'2623074',name:'당감4동'},{id:'2623076',name:'가야1동'},{id:'2623078',name:'가야2동'},{id:'2623080',name:'개금1동'},{id:'2623082',name:'개금2동'},{id:'2623084',name:'개금3동'},{id:'2623086',name:'범천1동'},{id:'2623088',name:'범천2동'}],
    '21090': [{id:'2635051',name:'우1동'},{id:'2635053',name:'우2동'},{id:'2635055',name:'우3동'},{id:'2635057',name:'중1동'},{id:'2635060',name:'중2동'},{id:'2635062',name:'좌1동'},{id:'2635064',name:'좌2동'},{id:'2635066',name:'좌3동'},{id:'2635068',name:'좌4동'},{id:'2635070',name:'송정동'},{id:'2635072',name:'반여1동'},{id:'2635074',name:'반여2동'},{id:'2635076',name:'반여3동'},{id:'2635078',name:'반여4동'},{id:'2635080',name:'반송1동'},{id:'2635082',name:'반송2동'},{id:'2635084',name:'재송1동'},{id:'2635086',name:'재송2동'}],
    // ── 대구 ──
    '22010': [{id:'2711051',name:'동인동'},{id:'2711053',name:'삼덕동'},{id:'2711055',name:'성내1동'},{id:'2711057',name:'성내2동'},{id:'2711060',name:'성내3동'},{id:'2711062',name:'대신동'},{id:'2711064',name:'남산1동'},{id:'2711066',name:'남산2동'},{id:'2711068',name:'남산3동'},{id:'2711070',name:'남산4동'},{id:'2711072',name:'대봉1동'},{id:'2711074',name:'대봉2동'}],
    '22060': [{id:'2726051',name:'범어1동'},{id:'2726053',name:'범어2동'},{id:'2726055',name:'범어3동'},{id:'2726057',name:'범어4동'},{id:'2726060',name:'만촌1동'},{id:'2726062',name:'만촌2동'},{id:'2726064',name:'만촌3동'},{id:'2726066',name:'수성1가동'},{id:'2726068',name:'수성2·3가동'},{id:'2726070',name:'수성4가동'},{id:'2726072',name:'황금1동'},{id:'2726074',name:'황금2동'},{id:'2726076',name:'중동'},{id:'2726078',name:'상동'},{id:'2726080',name:'파동'},{id:'2726082',name:'두산동'},{id:'2726084',name:'지산동'},{id:'2726086',name:'범물1동'},{id:'2726088',name:'범물2동'},{id:'2726090',name:'고산1동'},{id:'2726092',name:'고산2동'},{id:'2726094',name:'고산3동'}],
    // ── 인천 ──
    '23040': [{id:'2818551',name:'옥련1동'},{id:'2818553',name:'옥련2동'},{id:'2818555',name:'선학동'},{id:'2818557',name:'연수1동'},{id:'2818560',name:'연수2동'},{id:'2818562',name:'연수3동'},{id:'2818564',name:'청학동'},{id:'2818566',name:'동춘1동'},{id:'2818568',name:'동춘2동'},{id:'2818570',name:'동춘3동'},{id:'2818572',name:'송도1동'},{id:'2818574',name:'송도2동'},{id:'2818576',name:'송도3동'}],
    '23050': [{id:'2820051',name:'구월1동'},{id:'2820053',name:'구월2동'},{id:'2820055',name:'구월3동'},{id:'2820057',name:'구월4동'},{id:'2820060',name:'간석1동'},{id:'2820062',name:'간석2동'},{id:'2820064',name:'간석3동'},{id:'2820066',name:'간석4동'},{id:'2820068',name:'만수1동'},{id:'2820070',name:'만수2동'},{id:'2820072',name:'만수3동'},{id:'2820074',name:'만수4동'},{id:'2820076',name:'만수5동'},{id:'2820078',name:'만수6동'},{id:'2820080',name:'장수서창동'},{id:'2820082',name:'서창2동'},{id:'2820084',name:'남촌도림동'},{id:'2820086',name:'논현1동'},{id:'2820088',name:'논현2동'},{id:'2820090',name:'논현고잔동'},{id:'2820092',name:'고잔1동'}],
    // ── 광주 ──
    '24010': [{id:'2911051',name:'충장동'},{id:'2911053',name:'동명동'},{id:'2911055',name:'계림1동'},{id:'2911057',name:'계림2동'},{id:'2911060',name:'산수1동'},{id:'2911062',name:'산수2동'},{id:'2911064',name:'지산1동'},{id:'2911066',name:'지산2동'},{id:'2911068',name:'서남동'},{id:'2911070',name:'학동'}],
    '24020': [{id:'2914051',name:'양동'},{id:'2914053',name:'농성1동'},{id:'2914055',name:'농성2동'},{id:'2914057',name:'광천동'},{id:'2914060',name:'유덕동'},{id:'2914062',name:'치평동'},{id:'2914064',name:'상무1동'},{id:'2914066',name:'상무2동'},{id:'2914068',name:'화정1동'},{id:'2914070',name:'화정2동'},{id:'2914072',name:'서창동'},{id:'2914074',name:'금호1동'},{id:'2914076',name:'금호2동'},{id:'2914078',name:'풍암동'},{id:'2914080',name:'동천동'}],
    // ── 대전 ──
    '25030': [{id:'3017051',name:'복수동'},{id:'3017053',name:'도마1동'},{id:'3017055',name:'도마2동'},{id:'3017057',name:'정림동'},{id:'3017060',name:'변동'},{id:'3017062',name:'용문동'},{id:'3017064',name:'탄방동'},{id:'3017066',name:'둔산1동'},{id:'3017068',name:'둔산2동'},{id:'3017070',name:'둔산3동'},{id:'3017072',name:'괴정동'},{id:'3017074',name:'갈마1동'},{id:'3017076',name:'갈마2동'},{id:'3017078',name:'월평1동'},{id:'3017080',name:'월평2동'},{id:'3017082',name:'월평3동'},{id:'3017084',name:'만년동'},{id:'3017086',name:'가수원동'},{id:'3017088',name:'도안동'},{id:'3017090',name:'관저1동'},{id:'3017092',name:'관저2동'}],
    '25040': [{id:'3020051',name:'진잠동'},{id:'3020053',name:'원신흥동'},{id:'3020055',name:'온천1동'},{id:'3020057',name:'온천2동'},{id:'3020060',name:'노은1동'},{id:'3020062',name:'노은2동'},{id:'3020064',name:'노은3동'},{id:'3020066',name:'신성동'},{id:'3020068',name:'전민동'},{id:'3020070',name:'구즉동'},{id:'3020072',name:'관평동'},{id:'3020074',name:'학하동'}],
    // ── 울산 ──
    '26010': [{id:'3111051',name:'학성동'},{id:'3111053',name:'복산동'},{id:'3111055',name:'우정동'},{id:'3111057',name:'성안동'},{id:'3111060',name:'반구1동'},{id:'3111062',name:'반구2동'},{id:'3111064',name:'태화동'},{id:'3111066',name:'다운동'},{id:'3111068',name:'야음장생포동'},{id:'3111070',name:'삼산동'},{id:'3111072',name:'신정1동'},{id:'3111074',name:'신정2동'},{id:'3111076',name:'신정3동'},{id:'3111078',name:'신정4동'},{id:'3111080',name:'신정5동'}],
    '26020': [{id:'3114051',name:'삼호동'},{id:'3114053',name:'무거동'},{id:'3114055',name:'옥동'},{id:'3114057',name:'두왕동'},{id:'3114060',name:'신정동'},{id:'3114062',name:'달동'},{id:'3114064',name:'삼산동'},{id:'3114066',name:'야음동'}],
    // ── 세종 ──
    '29010': [{id:'3611051',name:'조치원읍'},{id:'3611053',name:'새롬동'},{id:'3611055',name:'도담동'},{id:'3611057',name:'아름동'},{id:'3611060',name:'종촌동'},{id:'3611062',name:'고운동'},{id:'3611064',name:'보람동'},{id:'3611066',name:'대평동'},{id:'3611068',name:'소정면'},{id:'3611070',name:'금남면'},{id:'3611072',name:'부강면'},{id:'3611074',name:'연기면'},{id:'3611076',name:'연동면'},{id:'3611078',name:'장군면'},{id:'3611080',name:'전의면'},{id:'3611082',name:'전동면'}],
    // ── 경기 ──
    '31011': [{id:'4111051',name:'장안구'},{id:'4111053',name:'권선구'},{id:'4111055',name:'팔달구'},{id:'4111057',name:'영통구'}],
    '31021': [{id:'4113051',name:'수정구'},{id:'4113053',name:'중원구'},{id:'4113055',name:'분당구'}],
    '31101': [{id:'4128051',name:'덕양구'},{id:'4128053',name:'일산동구'},{id:'4128055',name:'일산서구'}],
    '31191': [{id:'4146051',name:'처인구'},{id:'4146053',name:'기흥구'},{id:'4146055',name:'수지구'}],
    // ── 충북 ──
    '33041': [{id:'4311051',name:'상당구'},{id:'4311053',name:'서원구'},{id:'4311055',name:'흥덕구'},{id:'4311057',name:'청원구'}],
    '33020': [{id:'4313051',name:'교현동'},{id:'4313053',name:'성내·충인동'},{id:'4313055',name:'호암·직동'},{id:'4313057',name:'봉방동'},{id:'4313060',name:'칠금·금릉동'},{id:'4313062',name:'연수동'},{id:'4313064',name:'안림동'},{id:'4313066',name:'주덕읍'},{id:'4313068',name:'살미면'},{id:'4313070',name:'수안보면'},{id:'4313072',name:'대소원면'},{id:'4313074',name:'엄정면'},{id:'4313076',name:'소태면'},{id:'4313078',name:'노은면'}],
    '33030': [{id:'4315051',name:'봉양읍'},{id:'4315053',name:'신도·고명동'},{id:'4315055',name:'중앙동'},{id:'4315057',name:'남현동'},{id:'4315060',name:'영서동'},{id:'4315062',name:'동면'},{id:'4315064',name:'송학면'},{id:'4315066',name:'백운면'},{id:'4315068',name:'청풍면'},{id:'4315070',name:'한수면'},{id:'4315072',name:'덕산면'},{id:'4315074',name:'수산면'}],
    // ── 충남 ──
    '34011': [{id:'4413051',name:'동남구'},{id:'4413053',name:'서북구'}],
    '34040': [{id:'4420051',name:'온양1동'},{id:'4420053',name:'온양2동'},{id:'4420055',name:'온양3동'},{id:'4420057',name:'온양4동'},{id:'4420060',name:'온양5동'},{id:'4420062',name:'온양6동'},{id:'4420064',name:'배방읍'},{id:'4420066',name:'탕정면'},{id:'4420068',name:'음봉면'},{id:'4420070',name:'둔포면'},{id:'4420072',name:'영인면'},{id:'4420074',name:'인주면'},{id:'4420076',name:'선장면'},{id:'4420078',name:'도고면'},{id:'4420080',name:'신창면'},{id:'4420082',name:'송악면'}],
    // ── 전북 ──
    '35011': [{id:'4511051',name:'완산구'},{id:'4511053',name:'덕진구'}],
    '35020': [{id:'4513051',name:'중앙동'},{id:'4513053',name:'경암동'},{id:'4513055',name:'월명동'},{id:'4513057',name:'나운1동'},{id:'4513060',name:'나운2동'},{id:'4513062',name:'소룡동'},{id:'4513064',name:'미성동'},{id:'4513066',name:'삼학동'},{id:'4513068',name:'조촌동'},{id:'4513070',name:'개정면'},{id:'4513072',name:'옥구읍'},{id:'4513074',name:'옥산면'},{id:'4513076',name:'회현면'},{id:'4513078',name:'임피면'},{id:'4513080',name:'서수면'},{id:'4513082',name:'대야면'},{id:'4513084',name:'성산면'}],
    // ── 전남 ──
    '36010': [{id:'4611051',name:'용당1동'},{id:'4611053',name:'용당2동'},{id:'4611055',name:'연산동'},{id:'4611057',name:'산정동'},{id:'4611060',name:'동명동'},{id:'4611062',name:'삼학동'},{id:'4611064',name:'만호동'},{id:'4611066',name:'유달동'},{id:'4611068',name:'죽교동'},{id:'4611070',name:'북항동'},{id:'4611072',name:'하당동'},{id:'4611074',name:'신흥동'},{id:'4611076',name:'삼호동'},{id:'4611078',name:'석현동'},{id:'4611080',name:'옥암동'},{id:'4611082',name:'부흥동'}],
    '36020': [{id:'4613051',name:'동문동'},{id:'4613053',name:'중앙동'},{id:'4613055',name:'충무동'},{id:'4613057',name:'광림동'},{id:'4613060',name:'서강동'},{id:'4613062',name:'대교동'},{id:'4613064',name:'국동'},{id:'4613066',name:'월호동'},{id:'4613068',name:'여서동'},{id:'4613070',name:'문수동'},{id:'4613072',name:'미평동'},{id:'4613074',name:'돌산읍'},{id:'4613076',name:'소라면'},{id:'4613078',name:'율촌면'},{id:'4613080',name:'화양면'},{id:'4613082',name:'남면'}],
    // ── 경북 ──
    '37011': [{id:'4711151',name:'상대동'},{id:'4711153',name:'해도동'},{id:'4711155',name:'대잠동'},{id:'4711157',name:'두호동'},{id:'4711160',name:'장량동'},{id:'4711162',name:'흥해읍'},{id:'4711164',name:'청하면'},{id:'4711166',name:'송라면'}],
    '37020': [{id:'4713051',name:'성건동'},{id:'4713053',name:'황남동'},{id:'4713055',name:'동천동'},{id:'4713057',name:'황오·성동동'},{id:'4713060',name:'월성동'},{id:'4713062',name:'보덕동'},{id:'4713064',name:'불국동'},{id:'4713066',name:'양북면'},{id:'4713068',name:'감포읍'},{id:'4713070',name:'안강읍'},{id:'4713072',name:'외동읍'},{id:'4713074',name:'건천읍'},{id:'4713076',name:'산내면'},{id:'4713078',name:'서면'},{id:'4713080',name:'현곡면'}],
    // ── 경남 ──
    '38111': [{id:'4812151',name:'의창구'},{id:'4812153',name:'성산구'},{id:'4812155',name:'마산합포구'},{id:'4812157',name:'마산회원구'},{id:'4812160',name:'진해구'}],
    '38070': [{id:'4825051',name:'동상동'},{id:'4825053',name:'회현동'},{id:'4825055',name:'부원동'},{id:'4825057',name:'내외동'},{id:'4825060',name:'북부동'},{id:'4825062',name:'활천동'},{id:'4825064',name:'삼안동'},{id:'4825066',name:'불암동'},{id:'4825068',name:'장유1동'},{id:'4825070',name:'장유2동'},{id:'4825072',name:'장유3동'},{id:'4825074',name:'진영읍'},{id:'4825076',name:'주촌면'},{id:'4825078',name:'진례면'},{id:'4825080',name:'한림면'},{id:'4825082',name:'생림면'},{id:'4825084',name:'대동면'}],
    // ── 제주 ──
    '39010': [{id:'5011051',name:'일도1동'},{id:'5011053',name:'일도2동'},{id:'5011055',name:'이도1동'},{id:'5011057',name:'이도2동'},{id:'5011060',name:'삼도1동'},{id:'5011062',name:'삼도2동'},{id:'5011064',name:'용담1동'},{id:'5011066',name:'용담2동'},{id:'5011068',name:'건입동'},{id:'5011070',name:'화북동'},{id:'5011072',name:'삼양동'},{id:'5011074',name:'봉개동'},{id:'5011076',name:'아라동'},{id:'5011078',name:'오라동'},{id:'5011080',name:'연동'},{id:'5011082',name:'노형동'},{id:'5011084',name:'외도동'},{id:'5011086',name:'이호동'},{id:'5011088',name:'도두동'},{id:'5011090',name:'조천읍'},{id:'5011092',name:'구좌읍'},{id:'5011094',name:'한림읍'},{id:'5011096',name:'애월읍'},{id:'5011098',name:'한경면'},{id:'5011100',name:'추자면'}],
    '39020': [{id:'5013051',name:'송산동'},{id:'5013053',name:'정방동'},{id:'5013055',name:'중문동'},{id:'5013057',name:'예래동'},{id:'5013060',name:'영천동'},{id:'5013062',name:'동홍동'},{id:'5013064',name:'서홍동'},{id:'5013066',name:'대륜동'},{id:'5013068',name:'대천동'},{id:'5013070',name:'중앙동'},{id:'5013072',name:'효돈동'},{id:'5013074',name:'대정읍'},{id:'5013076',name:'남원읍'},{id:'5013078',name:'성산읍'},{id:'5013080',name:'안덕면'},{id:'5013082',name:'표선면'}],
    // ── 강원 ──
    '32010': [{id:'5111051',name:'교동'},{id:'5111053',name:'조운동'},{id:'5111055',name:'약사명동'},{id:'5111057',name:'근화동'},{id:'5111060',name:'소양동'},{id:'5111062',name:'효자1동'},{id:'5111064',name:'효자2동'},{id:'5111066',name:'효자3동'},{id:'5111068',name:'석사동'},{id:'5111070',name:'퇴계동'},{id:'5111072',name:'강남동'},{id:'5111074',name:'신사우동'},{id:'5111076',name:'동면'},{id:'5111078',name:'동산면'},{id:'5111080',name:'신북읍'},{id:'5111082',name:'남면'},{id:'5111084',name:'서면'},{id:'5111086',name:'사북면'},{id:'5111088',name:'북산면'}],
    '32020': [{id:'5113051',name:'중앙동'},{id:'5113053',name:'원인동'},{id:'5113055',name:'개운동'},{id:'5113057',name:'명륜1동'},{id:'5113060',name:'명륜2동'},{id:'5113062',name:'단구동'},{id:'5113064',name:'일산동'},{id:'5113066',name:'학성동'},{id:'5113068',name:'단계동'},{id:'5113070',name:'우산동'},{id:'5113072',name:'태장1동'},{id:'5113074',name:'태장2동'},{id:'5113076',name:'반곡관설동'},{id:'5113078',name:'행구동'},{id:'5113080',name:'무실동'},{id:'5113082',name:'문막읍'},{id:'5113084',name:'소초면'},{id:'5113086',name:'호저면'},{id:'5113088',name:'지정면'},{id:'5113090',name:'부론면'}],
    '32030': [{id:'5115051',name:'교1동'},{id:'5115053',name:'교2동'},{id:'5115055',name:'포남1동'},{id:'5115057',name:'포남2동'},{id:'5115060',name:'초당동'},{id:'5115062',name:'송정동'},{id:'5115064',name:'내곡동'},{id:'5115066',name:'강남동'},{id:'5115068',name:'홍제동'},{id:'5115070',name:'성산면'},{id:'5115072',name:'왕산면'},{id:'5115074',name:'주문진읍'},{id:'5115076',name:'연곡면'},{id:'5115078',name:'사천면'},{id:'5115080',name:'옥계면'},{id:'5115082',name:'강동면'}],
  };

  const riskMatrixData = useMemo(() => {
    const nationRegions = [
      { id: '11', name: '서울특별시' }, { id: '21', name: '부산광역시' }, { id: '22', name: '대구광역시' },
      { id: '23', name: '인천광역시' }, { id: '24', name: '광주광역시' }, { id: '25', name: '대전광역시' },
      { id: '26', name: '울산광역시' }, { id: '29', name: '세종특별자치시' }, { id: '31', name: '경기도' },
      { id: '33', name: '충청북도' }, { id: '34', name: '충청남도' }, { id: '35', name: '전라북도' },
      { id: '36', name: '전라남도' }, { id: '37', name: '경상북도' }, { id: '38', name: '경상남도' },
      { id: '39', name: '제주특별자치도' }, { id: '32', name: '강원도' },
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
    return currentSubRegions.map(r => {
      const seed = `${statsScopeKey}-${analyticsPeriod}-stage-${r.id}`;
      const shortName = r.name.length > 3 ? r.name.replace(/특별자치도|특별자치시|광역시|특별시|도$/g, '').trim() || r.name.slice(0, 2) : r.name;
      return {
        regionName: shortName.length > 4 ? shortName.slice(0, 4) : shortName,
        incoming: Math.round(seededValue(`${seed}-inc`, 50, 300)),
        inProgress: Math.round(seededValue(`${seed}-inp`, 100, 500)),
        needRecontact: Math.round(seededValue(`${seed}-nrc`, 20, 150)),
        slaBreach: Math.round(seededValue(`${seed}-sla`, 5, 80)),
        completed: Math.round(seededValue(`${seed}-cmp`, 200, 800)),
      };
    });
  }, [statsScopeKey, analyticsPeriod, currentSubRegions]);

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
    const { x, y, width, height, name, fill, textColor } = props;
    if (!name || width < 25 || height < 18) return null;
    
    // 짧은 이름으로 변환 (예: 강원특별자치도 -> 강원특별자치도 또는 짧게)
    const shortName = name.length > 5 ? name.replace(/특별자치도|특별자치시|광역시|특별시/g, '').trim() || name.slice(0, 4) : name;
    
    const labelColor = textColor || '#fff';
    
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
            fill={labelColor} 
            fontSize={width > 70 ? 10 : 8} 
            fontWeight="600"
            style={{ textShadow: labelColor === '#ffffff' ? '0 1px 2px rgba(0,0,0,0.4)' : 'none' }}
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
  const getNextDrillLevel = useCallback((level: DrillLevel): DrillLevel => {
    if (level === 'nation') return 'sido';
    if (level === 'sido') return 'sigungu';
    return 'sigungu';
  }, []);

  const handleRegionSelect = useCallback(({ level, code, name }: { level: string; code: string; name: string }) => {
    // GeoMapPanel에서 이미 다음 레벨(sig/emd)로 변환해서 전달함
    // sig -> sido, emd -> sigungu 드릴레벨로 매핑
    const drillLevelMap: Record<string, DrillLevel> = {
      'sig': 'sido',      // 시군구 레벨로 이동 -> sido 드릴레벨
      'emd': 'sigungu',   // 읍면동 레벨로 이동 -> sigungu 드릴레벨
    };
    const newLevel = drillLevelMap[level];
    if (newLevel) {
      prefetchScope({ level: newLevel, regionCode: code, regionName: name });
      setScope({ code, name, level: newLevel }, { replace: true });
    }
  }, [prefetchScope, setScope]);

  useEffect(() => {
    if (!currentBundle?.worstRegions?.length) return;
    const nextLevel = getNextDrillLevel(drillLevel);
    currentBundle.worstRegions.slice(0, 3).forEach((region) => {
      prefetchScope({
        level: nextLevel,
        regionCode: region.regionCode,
        regionName: region.regionName,
      });
    });
  }, [currentBundle, drillLevel, getNextDrillLevel, prefetchScope]);

  const overlayVisible = loadingStage === 'loadingScopeChange' || loadingStage === 'refreshing';

  return (
    <div ref={containerRef} className="flex flex-col bg-gray-50 h-full min-h-0">
      {/* ═══════════════════════════════════════════════════════════
          고정 2행: KPI 선택 카드 + Breadcrumb + 보조 컨트롤
      ═══════════════════════════════════════════════════════════ */}
      <div className="bg-white border-b border-gray-200 px-4 py-2 shrink-0">
        {/* ── 중앙센터 운영감사형 KPI 카드 바 ── */}
        <div className="flex items-center gap-2">
          {/* 5 Central KPI Cards */}
          <div className="flex items-center gap-2 overflow-x-auto flex-1 min-w-0 pb-0.5">
            {centralKpiDefs.map(def => {
              const kpiVal = centralKpis.find(k => k.kpiId === def.id);
              if (!kpiVal) {
                // skeleton
                return (
                  <div key={def.id} className="min-w-[170px] h-[82px] rounded-xl border border-gray-200 bg-gray-50 animate-pulse" />
                );
              }
              return (
                <CentralKpiCard
                  key={def.id}
                  kpi={kpiVal}
                  def={def}
                  isActive={activeCentralKpi === def.id}
                  onClick={() => {
                    setActiveCentralKpi(def.id);
                  }}
                  tooltipLines={KPI_THEMES[KPI_ID_TO_KEY[def.id]].tooltipLines}
                  tooltipColor={KPI_THEMES[KPI_ID_TO_KEY[def.id]].primaryColor}
                  timeWindow={centralWindow}
                  periodLabel={periodLabel}
                />
              );
            })}
          </div>

          {/* Drilldown 토글 버튼 → 드릴다운 서브페이지 + 3차 정보 섹션 동시 토글 */}
          <div className="w-px h-10 bg-gray-200 shrink-0" />
          <button
            onClick={() => {
              const next = !showDrilldown;
              setShowDrilldown(next);
              // 3차 정보 섹션도 함께 열기/닫기
              setRightAccordion({ slaMatrix: next, stageDistribution: next });
              setLeftAccordion(prev => ({ ...prev, opsSummary: next, ageRisk: next, kpiTable: next }));
            }}
            className={`px-3 py-1.5 text-[11px] font-medium rounded-md transition flex items-center gap-1.5 shrink-0 ${
              showDrilldown ? 'bg-violet-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            <BarChart3 className="h-3.5 w-3.5" />
            {showDrilldown ? '드릴다운 닫기' : '드릴다운'}
          </button>

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
          DRILLDOWN SUBPAGE - 4패널 (Funnel / Bottleneck / Linkage / Regional)
      ═══════════════════════════════════════════════════════════ */}
      {showDrilldown && (
        <div className="bg-gradient-to-b from-slate-50 to-white border-b border-gray-200 px-4 py-3 shrink-0">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-gray-800">운영 드릴다운</span>
              <span className="text-[11px] text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                {periodLabel}
              </span>
              {activeCentralKpi && (
                <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium`}
                  style={{ backgroundColor: `${activeTheme.primaryColor}15`, color: activeTheme.primaryColor }}>
                  {activeTheme.shortLabel} 포커스
                </span>
              )}
            </div>
            <button
              onClick={() => setShowDrilldown(false)}
              className="text-[11px] text-gray-500 hover:text-gray-700 px-2 py-1 rounded hover:bg-gray-100"
            >
              닫기 ✕
            </button>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-3 max-h-[420px] overflow-y-auto">
            <FunnelPanel stages={funnelData} />
            <BottleneckPanel metrics={bottleneckData} />
            <LinkagePanel metrics={linkageData} />
            <RegionalComparisonPanel rows={regionData} />
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════
          SCROLL CONTAINER - 통계/지도/차트 전용 스크롤 영역
      ═══════════════════════════════════════════════════════════ */}
      <div className="relative flex-1 overflow-y-auto min-h-0">
      <div className={`transition-opacity duration-300 ${overlayVisible ? 'opacity-60' : 'opacity-100'}`}>

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
            LEFT COLUMN - 정보 위계: 1차(KPI요약+Top5) → 3차(운영요약, 연령대, KPI테이블)
        ═══════════════════════════════════════════════════════ */}
        <div className={`flex flex-col gap-2 ${
          layoutMode === 'desktop' 
            ? 'min-w-0' 
            : layoutMode === 'tablet'
            ? 'hidden'
            : 'w-full shrink-0'
        }`}>
          
          {/* 현재 드릴 레벨 표시 */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-1.5 text-center">
            <span className="text-[11px] text-blue-700 font-medium">
              {getDrillLevelLabel(drillLevel)} 보기
            </span>
            {selectedRegion && (
              <span className="ml-1.5 text-[11px] text-blue-600">({selectedRegion.name})</span>
            )}
          </div>
          
          {/* ── 1차: 선택 KPI 요약 카드 ── */}
          <div className="bg-white border border-gray-200 rounded-lg p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold text-gray-700">선택 KPI 요약</span>
              <span className="text-[11px] px-1.5 py-0.5 rounded font-medium" 
                style={{ backgroundColor: `${activeTheme.primaryColor}15`, color: activeTheme.primaryColor }}>
                {activeTheme.shortLabel}
              </span>
            </div>
            {currentBundle ? (() => {
              const { national, worstRegions, bestRegions } = currentBundle;
              const summaryValue = selectedAreaMetric?.value ?? national.value;
              const summaryLabel = selectedAreaMetric
                ? `${(selectedArea?.name || selectedAreaMetric.regionName).replace(/특별자치도|특별자치시|광역시|특별시/g, '').trim()} 값`
                : drillLevel === 'nation'
                  ? '전국 값'
                  : `${selectedRegion?.name?.replace(/특별자치도|특별자치시|광역시|특별시/g, '').trim() || '지역'} 값`;
              const deltaColor = activeTheme.higherIsWorse
                ? (national.deltaPP <= 0 ? 'text-green-600' : 'text-red-600')
                : (national.deltaPP >= 0 ? 'text-green-600' : 'text-red-600');
              return (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[12px] text-gray-500">
                      {summaryLabel}
                    </span>
                    <span className="text-sm font-bold" style={{ color: activeTheme.primaryColor }}>
                      <AnimatedNumber value={summaryValue} formatter={(value) => activeTheme.valueFormatter(value)} />
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[12px] text-gray-500">전주 대비</span>
                    <span className={`text-sm font-bold ${deltaColor}`}>
                      {national.deltaPP > 0 ? '+' : ''}{national.deltaPP}pp
                    </span>
                  </div>
                  {national.target != null && (
                    <div className="flex items-center justify-between">
                      <span className="text-[12px] text-gray-500">목표</span>
                      <span className="text-xs font-semibold text-gray-600">{activeTheme.valueFormatter(national.target)}</span>
                    </div>
                  )}
                  {bestRegions[0] && (
                    <div className="flex items-center justify-between">
                      <span className="text-[12px] text-gray-500">
                        최고 ({bestRegions[0].regionName.replace(/특별자치도|특별자치시|광역시|특별시/g, '').trim()})
                      </span>
                      <span className="text-xs font-semibold text-green-600">{activeTheme.valueFormatter(bestRegions[0].value)}</span>
                    </div>
                  )}
                  {worstRegions[0] && (
                    <div className="flex items-center justify-between">
                      <span className="text-[12px] text-gray-500">
                        최저 ({worstRegions[0].regionName.replace(/특별자치도|특별자치시|광역시|특별시/g, '').trim()})
                      </span>
                      <span className="text-xs font-semibold text-red-600">{activeTheme.valueFormatter(worstRegions[0].value)}</span>
                    </div>
                  )}
                </div>
              );
            })() : (
              <div className="h-24 flex items-center justify-center text-xs text-gray-400 animate-pulse">로딩 중…</div>
            )}
          </div>

          {/* ── 1차: 리스크 Top 5 — 방향성 반영 리스트 행 + 미니바 ── */}
          <div className="bg-white border border-gray-200 rounded-lg p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold text-gray-700">
                {activeTheme.legend.direction === 'higherWorse' ? '위험' : '취약'} Top 5
              </span>
              <span className="text-[11px] px-1.5 py-0.5 rounded font-medium"
                style={{ backgroundColor: `${activeTheme.primaryColor}15`, color: activeTheme.primaryColor }}>
                {activeTheme.shortLabel}
              </span>
            </div>
            <div className="space-y-0.5">
              {(() => {
                if (!top5Rows.length) return null;
                const dir = activeTheme.legend.direction;
                const values = top5Rows.map((row) => row.value);
                const minV = Math.min(...values);
                const maxV = Math.max(...values);
                const range = maxV - minV || 1;
                return top5Rows.map((row, idx) => (
                  <div
                    key={row.code}
                    role="button"
                    tabIndex={0}
                    onMouseEnter={() => {
                      prefetchScope({
                        level: getNextDrillLevel(drillLevel),
                        regionCode: row.code,
                        regionName: row.name,
                      });
                    }}
                    onClick={() => {
                      setSelectedArea({ code: row.code, name: row.name });
                    }}
                    onKeyDown={e => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setSelectedArea({ code: row.code, name: row.name });
                      }
                    }}
                    className={`w-full flex items-center gap-2 px-2 py-1.5 rounded transition-colors cursor-pointer select-none ${selectedArea?.code === row.code ? 'bg-blue-50 ring-1 ring-blue-200' : 'hover:bg-gray-50'} ${isScopeChangeLoading ? 'animate-pulse' : ''}`}
                  >
                    {/* 순위 번호 */}
                    <span className="w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold text-white shrink-0"
                      style={{ backgroundColor: idx === 0 ? activeTheme.primaryColor : idx === 1 ? `${activeTheme.primaryColor}cc` : `${activeTheme.primaryColor}88` }}
                    >{row.rank}</span>
                    {/* 지역명 */}
                    <span className="text-[12px] text-gray-800 truncate min-w-[52px] shrink-0">
                      {row.name.replace(/특별자치도|특별자치시|광역시|특별시/g, '').trim()}
                    </span>
                    {/* 미니바 (상대 비율 기반) */}
                    <div className="flex-1 h-[6px] bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all" style={{
                        width: `${Math.max(10, ((dir === 'higherWorse' ? row.value - minV : maxV - row.value) / range) * 100)}%`,
                        backgroundColor: activeTheme.primaryColor,
                        opacity: 0.55 + (0.35 * (1 - idx / 5)),
                      }} />
                    </div>
                    {/* 값 */}
                    <span className="text-[12px] font-bold tabular-nums text-right min-w-[42px] shrink-0" style={{ color: activeTheme.primaryColor }}>
                      {activeTheme.valueFormatter(row.value)}
                    </span>
                  </div>
                ));
              })()}
              {(currentBundle && top5Rows.length === 0) && (
                <div className="text-xs text-gray-400 text-center py-4">
                  하위 행정구역 데이터가 없습니다.
                </div>
              )}
              {!currentBundle && (
                <div className="text-xs text-gray-400 text-center py-4 animate-pulse">로딩 중…</div>
              )}
            </div>
          </div>

          {/* ── 3차: 운영 요약 (AccordionSection) ── */}
          <AccordionSection
            title="운영 요약"
            isOpen={leftAccordion.opsSummary}
            onToggle={() => toggleLeftAccordion('opsSummary')}
            summary={`${MOCK_POLICY_CHANGES.filter(c => c.status === 'deployed').length}건 배포`}
          >
            <div className="space-y-1.5">
              <button
                onClick={() => onNavigate?.('model-governance', {})}
                className="w-full flex items-center gap-2 p-2 rounded-md hover:bg-blue-50 transition-colors text-left"
              >
                <Activity className="h-4 w-4 text-blue-500 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-[12px] font-medium text-gray-900">최근 정책 변경</div>
                  <div className="text-[11px] text-gray-500 truncate">
                    {MOCK_POLICY_CHANGES.filter(c => c.status === 'deployed').length}건 배포 · {MOCK_POLICY_CHANGES.filter(c => c.status === 'pending').length}건 대기
                  </div>
                </div>
                <ExternalLinkIcon className="h-3 w-3 text-gray-400 shrink-0" />
              </button>
              <button
                onClick={() => onNavigate?.('compliance-audit', {})}
                className="w-full flex items-center gap-2 p-2 rounded-md hover:bg-orange-50 transition-colors text-left"
              >
                <Shield className="h-4 w-4 text-orange-500 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-[12px] font-medium text-gray-900">규정 준수 현황</div>
                  <div className="text-[11px] text-gray-500">위반 0건 · 체크리스트 4/4 준수</div>
                </div>
                <ExternalLinkIcon className="h-3 w-3 text-gray-400 shrink-0" />
              </button>
              <button
                onClick={() => onNavigate?.('quality-monitoring', {})}
                className="w-full flex items-center gap-2 p-2 rounded-md hover:bg-purple-50 transition-colors text-left"
              >
                <Database className="h-4 w-4 text-purple-500 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-[12px] font-medium text-gray-900">데이터 & 모델 품질</div>
                  <div className="text-[11px] text-gray-500">
                    경고 {MOCK_QUALITY_ALERTS.filter(a => a.severity !== 'info').length}건
                    {MOCK_QUALITY_ALERTS.filter(a => a.severity === 'critical').length > 0 && (
                      <span className="ml-1 text-red-600 font-medium">· 심각 {MOCK_QUALITY_ALERTS.filter(a => a.severity === 'critical').length}건</span>
                    )}
                  </div>
                </div>
                <ExternalLinkIcon className="h-3 w-3 text-gray-400 shrink-0" />
              </button>
            </div>
          </AccordionSection>

          {/* ── 3차: 연령대별 미처리/지연 리스크 (AccordionSection) ── */}
          <AccordionSection
            title="연령대별 미처리/지연 리스크"
            isOpen={leftAccordion.ageRisk}
            onToggle={() => toggleLeftAccordion('ageRisk')}
            summary="5그룹 × 2지표"
          >
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
                  <YAxis tick={{ fontSize: 13, fill: '#6b7280' }} tickLine={false} axisLine={false} width={32} tickFormatter={(v) => `${v}%`} />
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
                  <Bar dataKey="slaViolation" fill="#ef4444" radius={[3, 3, 0, 0]} isAnimationActive animationDuration={460} animationEasing="ease-out" />
                  <Bar dataKey="recontactNeed" fill="#f59e0b" radius={[3, 3, 0, 0]} isAnimationActive animationDuration={460} animationEasing="ease-out" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </AccordionSection>

          {/* ── 3차: KPI 요약 테이블 (AccordionSection) ── */}
          <AccordionSection
            title="KPI 요약 테이블"
            isOpen={leftAccordion.kpiTable}
            onToggle={() => toggleLeftAccordion('kpiTable')}
            summary={`${bulletKPIs.length}개 지표`}
          >
            <div className="overflow-x-auto">
              <table className="w-full text-[12px]">
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
          </AccordionSection>
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
            {/* ── 중앙 패널 헤더: 1줄 라벨 + 2행 컨트롤 ── */}
            <div className="px-3 py-2 border-b border-gray-200 bg-white rounded-t-lg space-y-1.5">
              {/* 1줄 라벨: 기간 · 연도 · KPI · 범위 */}
              <div className="flex items-center gap-1.5">
                {drillLevel !== 'nation' && (
                  <button onClick={drillUp}
                    className="flex items-center gap-0.5 px-2 py-1 text-xs text-blue-600 bg-blue-50 rounded hover:bg-blue-100 transition-colors font-medium shrink-0">
                    <ChevronLeft className="h-3.5 w-3.5" />뒤로
                  </button>
                )}
                <span className="text-[12px] text-gray-600">
                  {analyticsPeriodLabel} · 2026 · <span className="font-semibold" style={{ color: activeTheme.primaryColor }}>{activeTheme.shortLabel}</span> · {getDrillLevelLabel(drillLevel)}
                  {selectedRegion && <span className="text-gray-500"> ({selectedRegion.name})</span>}
                </span>
              </div>
              {/* 2행 컨트롤 그리드 */}
              <div className="flex items-center gap-2 flex-wrap">
                {/* 지도/히트맵 토글 */}
                <div className="flex rounded-md border border-gray-200 overflow-hidden">
                  <button onClick={() => setVisualizationMode('geomap')}
                    className={`px-2.5 py-1 text-[11px] font-medium transition ${visualizationMode === 'geomap' ? 'bg-blue-600 text-white' : 'bg-white text-gray-500 hover:bg-gray-100'}`}
                  >지오맵</button>
                  <button onClick={() => setVisualizationMode('heatmap')}
                    className={`px-2.5 py-1 text-[11px] font-medium transition border-l border-gray-200 ${visualizationMode === 'heatmap' ? 'bg-blue-600 text-white' : 'bg-white text-gray-500 hover:bg-gray-100'}`}
                  >히트맵</button>
                </div>
                {/* 기간 토글 */}
                <div className="flex items-center gap-0.5">
                  {(['weekly', 'monthly', 'quarterly', 'yearly_cum'] as const).map(p => (
                    <button key={p} onClick={() => setPeriodType(p)}
                      className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition ${periodType === p ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
                    >{p === 'weekly' ? '주간' : p === 'monthly' ? '월간' : p === 'quarterly' ? '분기' : '연간(누적)'}</button>
                  ))}
                </div>
                <button className="h-6 w-6 flex items-center justify-center hover:bg-gray-100 rounded transition-colors ml-auto shrink-0"><Download className="h-3 w-3 text-gray-500" /></button>
              </div>
            </div>

            {/* ── 지도/히트맵 본체 ── */}
            <div className="p-2 min-h-0">
              {visualizationMode === 'geomap' ? (
                <GeoMapPanel
                  indicatorId={selectedKpiId}
                  periodType={periodType}
                  year={2026}
                  scope={{ mode: 'national' }}
                  variant="portal"
                  mapHeight={670}
                  hideBreadcrumb
                  externalLevel={drillLevel === 'nation' ? 'ctprvn' : drillLevel === 'sido' ? 'sig' : 'emd'}
                  externalSelectedCode={selectedArea?.code ?? selectedRegion?.code}
                  onRegionSelect={handleRegionSelect}
                  onGoBack={drillUp}
                  externalColorScheme={kpiColorScheme}
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
                      isAnimationActive
                      animationDuration={520}
                      animationEasing="ease-out"
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
                          <span className="text-[11px] bg-orange-50 text-orange-600 px-1.5 py-0.5 rounded font-medium">{periodType === 'weekly' ? '주간' : periodType === 'monthly' ? '월간' : periodType === 'quarterly' ? '분기' : '연간(누적)'}</span>
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

            {/* ── KPI 색상 범례 (지오맵 바로 아래, KPI 연동) ── */}
            <div className="mx-2 mb-2 px-3 py-2 rounded-lg bg-gradient-to-r from-gray-50 to-gray-100/80 border border-gray-200/60 shrink-0">
              <div className="flex items-center gap-2 mb-1.5">
                <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: activeTheme.primaryColor }} />
                <span className="text-[12px] font-bold text-gray-600 tracking-wide">{activeTheme.shortLabel}</span>
                <span className="text-[11px] text-gray-400 ml-auto">{activeTheme.unit}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[12px] font-semibold text-gray-500 tabular-nums min-w-[36px] text-right">
                  {activeTheme.legend.format(activeTheme.legend.ticks[0])}
                </span>
                <div className="flex-1 h-3 rounded-md overflow-hidden flex shadow-inner">
                  {activeTheme.palette.map((c: string, i: number) => (
                    <div key={i} className="flex-1 transition-colors" style={{ backgroundColor: c }} />
                  ))}
                </div>
                <span className="text-[12px] font-semibold text-gray-500 tabular-nums min-w-[36px]">
                  {activeTheme.legend.format(activeTheme.legend.ticks[activeTheme.legend.ticks.length - 1])}
                </span>
              </div>
              <div className="flex items-center justify-center gap-1 mt-1">
                <span className="text-[10px] text-gray-400">
                  {activeTheme.legend.direction === 'higherBetter' ? '← 낮음 (주의) · 높음 (양호) →' : '← 낮음 (양호) · 높음 (위험) →'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════
            RIGHT COLUMN - 1차: 요약+분해+원인 / 2차: 추이 / 3차: SLA·Stage
        ═══════════════════════════════════════════════════════ */}
        <div className={`flex flex-col gap-2 ${
          layoutMode === 'desktop' 
            ? 'min-w-0' 
            : layoutMode === 'tablet'
            ? 'hidden'
            : 'w-full shrink-0'
        }`}>
          
          {/* ═══ 1차: KPI 분석 요약 (1줄, 말줄임+tooltip) ═══ */}
          <div className="bg-white border border-gray-200 rounded-lg px-3 py-2">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: activeTheme.primaryColor }} />
              <span className="text-[12px] font-semibold text-gray-700 shrink-0">{activeTheme.shortLabel}</span>
              <p className="text-[11px] text-gray-500 truncate flex-1" title={activeTheme.analysisSummary}>{activeTheme.analysisSummary}</p>
            </div>
          </div>

          {/* ═══ 1차: 구성 분해 + 원인 분포 — 동일 높이 FixedHeightCard ═══ */}
          {currentBundle && (
            <div className="grid grid-cols-2 gap-2">
              {/* 구성 분해 */}
              <FixedHeightCard
                title="구성 분해"
                height={300}
                badge={
                  <span className="text-[10px] px-1.5 py-0.5 rounded font-medium"
                    style={{ backgroundColor: `${activeTheme.primaryColor}15`, color: activeTheme.primaryColor }}>
                    {currentBundle.breakdownType === 'donut' ? '도넛' : '바'}
                  </span>
                }
              >
                {currentBundle.breakdownType === 'donut' ? (
                  <div className="relative" style={{ height: '160px' }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={currentBundle.breakdown} cx="50%" cy="50%" innerRadius={35} outerRadius={60}
                          dataKey="value" startAngle={90} endAngle={-270} paddingAngle={2} strokeWidth={0}
                          label={renderDonutLabel} labelLine={false}
                          isAnimationActive
                          animationDuration={460}
                          animationEasing="ease-out">
                          {currentBundle.breakdown.map((entry, idx) => (
                            <Cell key={idx} fill={entry.color || activeTheme.palette[idx % activeTheme.palette.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(v: number) => [v.toLocaleString(), '']}
                          contentStyle={{ fontSize: '11px', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.12)' }} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                      <div className="text-[10px] text-gray-500">총합</div>
                      <div className="text-[12px] font-bold text-gray-800">
                        {currentBundle.breakdown.reduce((s, d) => s + d.value, 0).toLocaleString()}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div style={{ height: '160px' }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={currentBundle.breakdown} margin={{ top: 4, right: 6, left: -14, bottom: 4 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                        <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#4b5563' }} tickLine={false} />
                        <YAxis tick={{ fontSize: 10, fill: '#6b7280' }} tickLine={false} axisLine={false} width={30} />
                        <Tooltip contentStyle={{ fontSize: '11px', borderRadius: '8px' }} />
                        <Bar dataKey="value" radius={[3, 3, 0, 0]} isAnimationActive animationDuration={460} animationEasing="ease-out">
                          {currentBundle.breakdown.map((entry, idx) => (
                            <Cell key={idx} fill={entry.color || activeTheme.palette[idx % activeTheme.palette.length]} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
                {/* 범례: 기본 3개, 더보기 */}
                <div className="space-y-0.5 mt-1 pt-1 border-t border-gray-100">
                  {currentBundle.breakdown.slice(0, showBreakdownMore ? currentBundle.breakdown.length : 3).map((d, i) => (
                    <div key={i} className="flex items-center gap-1 text-[10px] text-gray-600">
                      <span className="w-2 h-2 rounded-sm shrink-0" style={{ backgroundColor: d.color || activeTheme.palette[i % activeTheme.palette.length] }} />
                      <span className="truncate">{d.name}</span>
                      <span className="font-semibold text-gray-800 ml-auto tabular-nums">{d.value.toLocaleString()}</span>
                    </div>
                  ))}
                  {currentBundle.breakdown.length > 3 && (
                    <button onClick={() => setShowBreakdownMore(!showBreakdownMore)}
                      className="text-[10px] text-blue-500 hover:text-blue-700 w-full text-center pt-0.5">
                      {showBreakdownMore ? '접기' : `+${currentBundle.breakdown.length - 3}개 더보기`}
                    </button>
                  )}
                </div>
              </FixedHeightCard>

              {/* 원인 분포 */}
              <FixedHeightCard title="원인 분포" height={300}>
                <div style={{ height: '180px' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={currentBundle.cause.slice(0, showCauseMore ? currentBundle.cause.length : 3)} layout="vertical" margin={{ top: 4, right: 24, left: 4, bottom: 4 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e5e7eb" />
                      <XAxis type="number" tick={{ fontSize: 10, fill: '#6b7280' }} />
                      <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: '#4b5563' }} width={60} />
                      <Tooltip contentStyle={{ fontSize: '11px', borderRadius: '8px' }} />
                      <Bar dataKey="value" radius={[0, 3, 3, 0]} fill={activeTheme.primaryColor}
                        isAnimationActive animationDuration={460} animationEasing="ease-out"
                        label={{ position: 'right', fontSize: 10, fill: '#374151', formatter: (v: number) => v.toLocaleString() }}>
                        {currentBundle.cause.slice(0, showCauseMore ? currentBundle.cause.length : 3).map((_, idx) => (
                          <Cell key={idx} fill={activeTheme.palette[Math.min(idx + 1, activeTheme.palette.length - 2)]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                {currentBundle.cause.length > 3 && (
                  <button onClick={() => setShowCauseMore(!showCauseMore)}
                    className="text-[10px] text-blue-500 hover:text-blue-700 w-full text-center pt-1">
                    {showCauseMore ? '접기' : `+${currentBundle.cause.length - 3}개 더보기`}
                  </button>
                )}
              </FixedHeightCard>
            </div>
          )}

          {/* ═══ 2차: KPI 추이 차트 (고정 높이) ═══ */}
          {currentBundle && (
            <div className="bg-white border border-gray-200 rounded-lg p-3">
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: activeTheme.primaryColor }} />
                  <span className="text-[12px] font-semibold text-gray-700">
                    {activeTheme.shortLabel} 추이
                    {selectedArea?.name ? ` (${selectedArea.name})` : ''}
                  </span>
                </div>
                <span className="text-[10px] text-gray-400">{analyticsPeriodLabel}</span>
              </div>
              <div style={{ height: '160px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={focusedTrendData} margin={{ top: 6, right: 10, left: -10, bottom: 4 }}>
                    <defs>
                      <linearGradient id="kpiTrendGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={activeTheme.primaryColor} stopOpacity={0.25} />
                        <stop offset="100%" stopColor={activeTheme.primaryColor} stopOpacity={0.03} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                    <XAxis dataKey="period" tick={{ fontSize: 10, fill: '#6b7280' }} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} tickLine={false} axisLine={false} width={32}
                      tickFormatter={(v) => activeTheme.valueFormatter(v)} />
                    <Tooltip
                      contentStyle={{ fontSize: '11px', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.12)' }}
                      formatter={(v: number) => [activeTheme.valueFormatter(v), activeTheme.shortLabel]}
                    />
                    {activeTheme.target != null && (
                      <ReferenceLine y={activeTheme.target} stroke="#ef4444" strokeDasharray="4 2" strokeWidth={1.5}
                        label={{ value: `목표 ${activeTheme.valueFormatter(activeTheme.target)}`, fontSize: 10, fill: '#ef4444', position: 'right' }} />
                    )}
                    <Area type="monotone" dataKey="value" fill="url(#kpiTrendGrad)" stroke="none" isAnimationActive animationDuration={500} animationEasing="ease-out" />
                    <Line type="monotone" dataKey="value" stroke={activeTheme.primaryColor} strokeWidth={2}
                      isAnimationActive animationDuration={500} animationEasing="ease-out"
                      dot={false} activeDot={{ r: 4, fill: activeTheme.primaryColor, stroke: '#fff', strokeWidth: 2 }} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* ═══ 3차: SLA × 데이터 충족률 리스크 매트릭스 (AccordionSection) ═══ */}
          <AccordionSection
            title="SLA × 데이터 충족률 매트릭스"
            isOpen={rightAccordion.slaMatrix}
            onToggle={() => toggleRightAccordion('slaMatrix')}
            summary={(() => {
              const danger = riskMatrixData.filter(e => e.slaRate < SLA_THRESHOLD && e.dataRate < DATA_THRESHOLD).length;
              return `위험 ${danger}개 지역`;
            })()}
          >
            <div className="flex items-center justify-end gap-2 text-[10px] text-gray-500 mb-1">
              <span className="flex items-center gap-0.5"><span className="w-2 h-2 rounded-full bg-green-500" />양호</span>
              <span className="flex items-center gap-0.5"><span className="w-2 h-2 rounded-full bg-amber-400" />주의</span>
              <span className="flex items-center gap-0.5"><span className="w-2 h-2 rounded-full bg-red-500" />위험</span>
            </div>
            {riskMatrixData.length > 0 ? (
              <div style={{ height: '220px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <ScatterChart margin={{ top: 8, right: 12, left: -8, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis type="number" dataKey="dataRate" name="데이터 충족률" unit="%"
                      domain={[70, 100]} tick={{ fontSize: 11 }} label={{ value: '데이터 충족률(%)', position: 'insideBottom', offset: -2, fontSize: 11, fill: '#6b7280' }} />
                    <YAxis type="number" dataKey="slaRate" name="SLA 준수율" unit="%"
                      domain={[70, 100]} tick={{ fontSize: 11 }} label={{ value: 'SLA(%)', angle: -90, position: 'insideLeft', offset: 12, fontSize: 11, fill: '#6b7280' }} />
                    <ZAxis type="number" dataKey="totalCases" range={[30, 250]} name="케이스 수" />
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
                    <Scatter data={riskMatrixData} isAnimationActive animationDuration={480} animationEasing="ease-out" onClick={(entry: any) => {
                      if (entry?.regionId) {
                        const nextLevel = getNextDrillLevel(drillLevel);
                        setScope({ code: entry.regionId, name: entry.regionName, level: nextLevel }, { replace: true });
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
              <div className="h-[160px] flex items-center justify-center text-xs text-gray-400">데이터 부족</div>
            )}
          </AccordionSection>

          {/* ═══ 3차: 처리 단계 분포 (AccordionSection) ═══ */}
          <AccordionSection
            title="처리 단계 분포 (지역별)"
            isOpen={rightAccordion.stageDistribution}
            onToggle={() => toggleRightAccordion('stageDistribution')}
            summary={`${stageByRegionData.length}개 지역`}
          >
            {stageByRegionData.length > 0 ? (
              <div style={{ height: '240px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stageByRegionData} margin={{ top: 5, right: 8, left: -12, bottom: 22 }}>
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
                      <Bar key={key} dataKey={key} stackId="stage" fill={STAGE_COLORS_MAP[key]} isAnimationActive animationDuration={460} animationEasing="ease-out" />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-[180px] flex items-center justify-center text-xs text-gray-400">데이터 부족</div>
            )}
          </AccordionSection>

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
                  <div className="text-[11px] text-blue-500 bg-blue-50 px-1.5 py-0.5 rounded">{analyticsPeriodLabel}</div>
                </div>
                <div className="text-2xl font-bold text-blue-600 mb-2">
                  {totalCases.toLocaleString()} <span className="text-sm font-normal text-gray-500">건</span>
                </div>
                <div className="text-[12px] text-gray-500 mb-2">{selectedMapCard.label} (행정구역별)</div>
                <div className="h-[140px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <Treemap data={mapHeatmapData} dataKey="size" aspectRatio={4/3} stroke="#fff" isAnimationActive animationDuration={520} animationEasing="ease-out" content={<CustomTreemapContent />} />
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
      <LoadingOverlay
        visible={overlayVisible}
        stage={loadingStage === 'refreshing' ? 'refreshing' : 'scopeChange'}
      />
      </div>{/* end scroll container */}
    </div>
  );
}
