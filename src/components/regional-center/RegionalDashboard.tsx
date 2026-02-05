import React, { useEffect, useMemo, useState } from 'react';
import { Download, BarChart3, HelpCircle, TrendingUp, TrendingDown, Bell, AlertTriangle, AlertCircle, Info } from 'lucide-react';
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
  Legend,
  Treemap,
} from 'recharts';
import { GeoMapPanel } from '../geomap/GeoMapPanel';
import { RegionalScope } from '../geomap/regions';

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
   타입 정의
═══════════════════════════════════════════════════════════════════════════════ */
interface RegionalDashboardProps {
  region: RegionalScope;
  onNavigateToBottleneck?: () => void;
}

interface AlertItem {
  id: string;
  severity: 'info' | 'warn' | 'critical';
  region: string;
  message: string;
  time: string;
}

/* ═══════════════════════════════════════════════════════════════════════════════
   메인 컴포넌트
═══════════════════════════════════════════════════════════════════════════════ */
export function RegionalDashboard({ region }: RegionalDashboardProps) {
  const [selectedKPI, setSelectedKPI] = useState<string | null>(null);
  const [selectedDistrictName, setSelectedDistrictName] = useState<string | null>(null);
  const [alertFilter, setAlertFilter] = useState<'all' | 'warn' | 'critical'>('all');

  useEffect(() => {
    setSelectedDistrictName(null);
  }, [region.id]);

  const statsScopeKey = selectedDistrictName ? `${region.id}-${selectedDistrictName}` : region.id;

  /* ─────────────────────────────────────────────────────────────
     KPI 데이터
  ───────────────────────────────────────────────────────────── */
  const kpiData = useMemo(() => ({
    totalCases: Math.round(seededValue(`${statsScopeKey}-total`, 2000, 4000)),
    contactRate: Number(seededValue(`${statsScopeKey}-contact`, 75, 95).toFixed(1)),
    consultRate: Number(seededValue(`${statsScopeKey}-consult`, 80, 95).toFixed(1)),
    dropoutRate: Number(seededValue(`${statsScopeKey}-dropout`, 5, 18).toFixed(1)),
    avgWaitTime: Number(seededValue(`${statsScopeKey}-wait`, 8, 25).toFixed(1)),
    foreigners: Math.round(seededValue(`${statsScopeKey}-foreign`, 20000, 50000)),
    foreignerChange: Number(seededValue(`${statsScopeKey}-foreign-change`, -5, 10).toFixed(2)),
  }), [statsScopeKey]);

  /* ─────────────────────────────────────────────────────────────
     알림 데이터
  ───────────────────────────────────────────────────────────── */
  const alerts: AlertItem[] = useMemo(() => {
    const regions = ['강남구', '서초구', '송파구', '강동구', '마포구', '영등포구', '용산구', '종로구'];
    const messages = ['이탈률 급증 감지', '대기시간 임계치 초과', '상담 완료율 저하', '연계율 비정상 패턴'];
    const items: AlertItem[] = [];
    for (let i = 0; i < 6; i++) {
      const severity: AlertItem['severity'] = i < 2 ? 'critical' : i < 4 ? 'warn' : 'info';
      items.push({
        id: `alert-${i}`,
        severity,
        region: regions[i % regions.length],
        message: messages[i % messages.length],
        time: `${Math.floor(seededValue(`${statsScopeKey}-alert-time-${i}`, 1, 60))}분 전`,
      });
    }
    return items;
  }, [statsScopeKey]);

  const filteredAlerts = useMemo(() => {
    if (alertFilter === 'all') return alerts;
    return alerts.filter(a => alertFilter === 'warn' ? a.severity === 'warn' : a.severity === 'critical');
  }, [alerts, alertFilter]);

  /* ─────────────────────────────────────────────────────────────
     트리맵 데이터
  ───────────────────────────────────────────────────────────── */
  const treemapData = useMemo(() => {
    const districts = ['강남구', '서초구', '송파구', '강동구', '마포구', '영등포구', '용산구', '종로구', '중구', '성동구'];
    return districts.map((name, idx) => ({
      name,
      size: Math.round(seededValue(`${statsScopeKey}-tree-${name}`, 200, 800)),
      fill: ['#3b82f6', '#60a5fa', '#93c5fd', '#bfdbfe', '#dbeafe'][idx % 5],
    }));
  }, [statsScopeKey]);

  /* ─────────────────────────────────────────────────────────────
     파이 차트 데이터
  ───────────────────────────────────────────────────────────── */
  const contactPieData = useMemo(() => [
    { name: '성공', value: kpiData.contactRate, fill: COLORS.green },
    { name: '실패', value: Number((100 - kpiData.contactRate).toFixed(1)), fill: COLORS.red },
  ], [kpiData.contactRate]);

  const consultPieData = useMemo(() => [
    { name: '완료', value: kpiData.consultRate, fill: COLORS.blue },
    { name: '미완료', value: Number((100 - kpiData.consultRate).toFixed(1)), fill: COLORS.gray },
  ], [kpiData.consultRate]);

  /* ─────────────────────────────────────────────────────────────
     케이스 분포 막대 데이터
  ───────────────────────────────────────────────────────────── */
  const caseDistributionData = useMemo(() => {
    const categories = ['0-9', '10-19', '20-29', '30-39', '40-49', '50-59', '60-69', '70+'];
    return categories.map((cat, idx) => ({
      category: cat,
      value: Math.round(seededValue(`${statsScopeKey}-cat-${idx}`, 100, 600)),
      fill: AGE_COLORS[idx % AGE_COLORS.length],
    }));
  }, [statsScopeKey]);

  /* ─────────────────────────────────────────────────────────────
     지역별 이탈률 가로막대
  ───────────────────────────────────────────────────────────── */
  const dropoutByRegionData = useMemo(() => {
    const regions = ['강남구', '서초구', '송파구', '강동구', '마포구'];
    return regions.map((name, idx) => ({
      name,
      value: Number(seededValue(`${statsScopeKey}-dropout-${idx}`, 5, 20).toFixed(1)),
    })).sort((a, b) => b.value - a.value);
  }, [statsScopeKey]);

  /* ─────────────────────────────────────────────────────────────
     시계열 추이 데이터
  ───────────────────────────────────────────────────────────── */
  const timeSeriesData = useMemo(() => {
    const weeks = ['1주', '2주', '3주', '4주', '5주', '6주', '7주', '8주'];
    return weeks.map((week, idx) => ({
      week,
      대기시간: Number(seededValue(`${statsScopeKey}-ts-wait-${idx}`, 8, 25).toFixed(1)),
      이탈률: Number(seededValue(`${statsScopeKey}-ts-dropout-${idx}`, 5, 18).toFixed(1)),
    }));
  }, [statsScopeKey]);

  /* ─────────────────────────────────────────────────────────────
     커스텀 트리맵 컨텐트
  ───────────────────────────────────────────────────────────── */
  const CustomTreemapContent = (props: any) => {
    const { x, y, width, height, name, fill } = props;
    if (width < 25 || height < 18) return null;
    return (
      <g>
        <rect x={x} y={y} width={width} height={height} fill={fill} stroke="#fff" strokeWidth={1} />
        {width > 40 && height > 25 && (
          <text x={x + width / 2} y={y + height / 2} textAnchor="middle" dominantBaseline="middle" fill="#fff" fontSize={9} fontWeight="500">
            {name}
          </text>
        )}
      </g>
    );
  };

  const getSeverityStyle = (severity: AlertItem['severity']) => {
    switch (severity) {
      case 'critical': return { bg: 'bg-red-100', text: 'text-red-700', icon: AlertTriangle };
      case 'warn': return { bg: 'bg-orange-100', text: 'text-orange-700', icon: AlertCircle };
      default: return { bg: 'bg-blue-100', text: 'text-blue-700', icon: Info };
    }
  };

  return (
    <div className="h-full flex flex-col bg-gray-50 overflow-hidden">
      {/* ═══════════════════════════════════════════════════════════
          HEADER
      ═══════════════════════════════════════════════════════════ */}
      <header className="h-10 bg-white border-b border-gray-200 flex items-center px-4 shrink-0">
        <h1 className="text-sm font-bold text-gray-800">{region.label} 광역센터 대시보드</h1>
        <div className="flex items-center gap-1 ml-4">
          <span className="px-2 py-0.5 bg-blue-500 text-white text-[10px] rounded">주간</span>
          <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-[10px] rounded cursor-pointer hover:bg-gray-200">월간</span>
          <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-[10px] rounded cursor-pointer hover:bg-gray-200">분기</span>
        </div>
        <div className="flex-1" />
        <div className="flex items-center gap-2 text-gray-500">
          <button className="p-1.5 hover:bg-gray-100 rounded"><HelpCircle className="h-4 w-4" /></button>
          <button className="p-1.5 hover:bg-gray-100 rounded"><BarChart3 className="h-4 w-4" /></button>
          <button className="p-1.5 hover:bg-gray-100 rounded"><Download className="h-4 w-4" /></button>
        </div>
      </header>

      {/* ═══════════════════════════════════════════════════════════
          MAIN CONTENT - 3열 레이아웃
      ═══════════════════════════════════════════════════════════ */}
      <div className="flex-1 flex overflow-hidden p-3 gap-3">
        
        {/* ═══════════════════════════════════════════════════════
            LEFT COLUMN - flex-[2] (통계 시각화)
        ═══════════════════════════════════════════════════ */}
        <div className="flex-[2] min-w-0 flex flex-col gap-3">
          
          {/* 총 처리건수 + 트리맵 */}
          <div className="bg-white border border-gray-200 rounded-lg p-3 flex-1">
            <div className="text-xs text-gray-500 mb-1">총 처리건수</div>
            <div className="text-2xl font-bold text-blue-600 mb-3">
              {kpiData.totalCases.toLocaleString()} <span className="text-sm font-normal text-gray-500">건</span>
            </div>
            <div style={{ height: '180px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <Treemap
                  data={treemapData}
                  dataKey="size"
                  aspectRatio={4 / 3}
                  stroke="#fff"
                  content={<CustomTreemapContent />}
                />
              </ResponsiveContainer>
            </div>
          </div>

          {/* 접촉 성공률 */}
          <div className="bg-white border border-gray-200 rounded-lg p-3">
            <div className="text-xs text-gray-500 mb-1">접촉 현황</div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-600">접촉 성공률 <HelpCircle className="inline h-3 w-3 text-gray-400" /></span>
            </div>
            <div className="text-2xl font-bold text-center mt-2">{kpiData.contactRate}%</div>
          </div>

          {/* 활성 알림 */}
          <div className="bg-white border border-gray-200 rounded-lg p-3">
            <div className="text-xs text-gray-500 mb-1">관할 케이스 수 <HelpCircle className="inline h-3 w-3 text-gray-400" /></div>
            <div className="text-2xl font-bold text-blue-600">
              {kpiData.foreigners.toLocaleString()} <span className="text-sm font-normal text-gray-500">건</span>
            </div>
            <div className="flex items-center gap-1 mt-1 text-xs">
              <span className="text-gray-500">전월대비</span>
              <span className={`flex items-center ${kpiData.foreignerChange >= 0 ? 'text-red-500' : 'text-blue-500'}`}>
                {kpiData.foreignerChange >= 0 ? '+' : ''}{kpiData.foreignerChange}% 
                {kpiData.foreignerChange >= 0 ? <TrendingUp className="h-3 w-3 ml-0.5" /> : <TrendingDown className="h-3 w-3 ml-0.5" />}
              </span>
            </div>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════
            CENTER COLUMN - GeoMap (flex-[2])
        ═══════════════════════════════════════════════════ */}
        <div className="flex-[2] min-w-0">
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden h-full flex flex-col">
            <div className="px-3 py-2 border-b border-gray-100 flex items-center justify-between bg-gray-50">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-gray-700">지도</span>
                <span className="px-2 py-0.5 bg-blue-500 text-white text-[10px] rounded">{region.label}</span>
              </div>
              <button className="p-1 hover:bg-gray-200 rounded"><Download className="h-3.5 w-3.5 text-gray-500" /></button>
            </div>
            <div className="flex-1 p-2">
              <GeoMapPanel
                key={`${region.id}-${selectedKPI || 'default'}`}
                title=""
                indicatorId={selectedKPI || 'completion'}
                year={2026}
                scope={{ mode: 'regional', ctprvnCodes: [region.ctprvnCode], label: region.label }}
                variant="portal"
                mapHeight={320}
                hideBreadcrumb
                onRegionSelect={({ level, name }) => {
                  if (level === 'ctprvn') setSelectedDistrictName(null);
                  else setSelectedDistrictName(name);
                }}
              />
            </div>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════
            RIGHT COLUMN - 차트들 (flex-[3])
        ═══════════════════════════════════════════════════ */}
        <div className="flex-[3] min-w-0 flex flex-col gap-3">
          
          {/* 파이 차트 2개 나란히 */}
          <div className="bg-white border border-gray-200 rounded-lg p-3">
            <div className="grid grid-cols-2 gap-4">
              {/* 접촉 성공/실패 */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs text-gray-700 font-medium">접촉 현황</span>
                </div>
                <div style={{ height: '120px' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <defs>
                        <linearGradient id="greenGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#22c55e" stopOpacity={1}/>
                          <stop offset="100%" stopColor="#16a34a" stopOpacity={1}/>
                        </linearGradient>
                        <linearGradient id="redGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#ef4444" stopOpacity={1}/>
                          <stop offset="100%" stopColor="#dc2626" stopOpacity={1}/>
                        </linearGradient>
                      </defs>
                      <Pie data={contactPieData} cx="50%" cy="50%" innerRadius={30} outerRadius={48} dataKey="value" startAngle={90} endAngle={-270} strokeWidth={0}>
                        <Cell fill="url(#greenGradient)" />
                        <Cell fill="url(#redGradient)" />
                      </Pie>
                      <Tooltip formatter={(v: number) => `${v}%`} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex justify-center gap-3 mt-1">
                  <div className="flex items-center gap-1 text-[10px]">
                    <span className="w-2 h-2 rounded-full bg-green-500" />
                    <span>성공 {kpiData.contactRate}%</span>
                  </div>
                  <div className="flex items-center gap-1 text-[10px]">
                    <span className="w-2 h-2 rounded-full bg-red-500" />
                    <span>실패 {(100 - kpiData.contactRate).toFixed(1)}%</span>
                  </div>
                </div>
              </div>

              {/* 상담 완료/미완료 */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs text-gray-700 font-medium">상담 현황</span>
                </div>
                <div style={{ height: '120px' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <defs>
                        <linearGradient id="blueGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#3b82f6" stopOpacity={1}/>
                          <stop offset="100%" stopColor="#1d4ed8" stopOpacity={1}/>
                        </linearGradient>
                        <linearGradient id="grayGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#6b7280" stopOpacity={1}/>
                          <stop offset="100%" stopColor="#4b5563" stopOpacity={1}/>
                        </linearGradient>
                      </defs>
                      <Pie data={consultPieData} cx="50%" cy="50%" innerRadius={30} outerRadius={48} dataKey="value" startAngle={90} endAngle={-270} strokeWidth={0}>
                        <Cell fill="url(#blueGradient)" />
                        <Cell fill="url(#grayGradient)" />
                      </Pie>
                      <Tooltip formatter={(v: number) => `${v}%`} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex justify-center gap-3 mt-1">
                  <div className="flex items-center gap-1 text-[10px]">
                    <span className="w-2 h-2 rounded-full bg-blue-500" />
                    <span>완료 {kpiData.consultRate}%</span>
                  </div>
                  <div className="flex items-center gap-1 text-[10px]">
                    <span className="w-2 h-2 rounded-full bg-gray-500" />
                    <span>미완료 {(100 - kpiData.consultRate).toFixed(1)}%</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 케이스 분포 막대 차트 */}
          <div className="bg-white border border-gray-200 rounded-lg p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-gray-700">연령별 케이스 분포</span>
              <div className="flex items-center gap-1">
                <button className="px-2 py-0.5 text-[10px] text-blue-600 bg-blue-50 rounded hover:bg-blue-100">통계표 보기</button>
                <button className="p-1 hover:bg-gray-100 rounded"><Download className="h-3 w-3 text-gray-500" /></button>
              </div>
            </div>
            <div style={{ height: '140px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={caseDistributionData} margin={{ top: 5, right: 5, left: -15, bottom: 5 }}>
                  <defs>
                    <linearGradient id="ageBarGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.9}/>
                      <stop offset="100%" stopColor="#1d4ed8" stopOpacity={0.9}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                  <XAxis dataKey="category" tick={{ fontSize: 9 }} />
                  <YAxis tick={{ fontSize: 9 }} />
                  <Tooltip formatter={(v: number) => v.toLocaleString()} />
                  <Bar dataKey="value" radius={[2, 2, 0, 0]}>
                    {caseDistributionData.map((entry, idx) => <Cell key={idx} fill={entry.fill} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* 지역별 이탈률 가로막대 */}
          <div className="bg-white border border-gray-200 rounded-lg p-3 flex-1">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-gray-700">지역별 이탈률 Top 5</span>
              <div className="flex items-center gap-1">
                <button className="px-2 py-0.5 text-[10px] text-blue-600 bg-blue-50 rounded hover:bg-blue-100">통계표 보기</button>
                <button className="p-1 hover:bg-gray-100 rounded"><Download className="h-3 w-3 text-gray-500" /></button>
              </div>
            </div>
            <div style={{ height: '140px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dropoutByRegionData} layout="vertical" margin={{ top: 5, right: 30, left: 50, bottom: 5 }}>
                  <defs>
                    <linearGradient id="dropoutGradient" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="#ef4444" stopOpacity={0.8}/>
                      <stop offset="100%" stopColor="#f87171" stopOpacity={1}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e5e7eb" />
                  <XAxis type="number" tick={{ fontSize: 9 }} domain={[0, 25]} tickFormatter={(v) => `${v}%`} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={45} />
                  <Tooltip formatter={(v: number) => `${v}%`} />
                  <Bar dataKey="value" fill="url(#dropoutGradient)" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════
          BOTTOM - 시계열 차트 (전체 너비)
      ═══════════════════════════════════════════════════════════ */}
      <div className="shrink-0 px-3 pb-3">
        <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-semibold text-gray-700">주간 대기시간 & 이탈률 추이</span>
            <div className="flex items-center gap-1">
              <button className="px-2 py-0.5 text-[10px] text-blue-600 bg-blue-50 rounded hover:bg-blue-100">통계표 보기</button>
              <button className="p-1 hover:bg-gray-100 rounded"><Download className="h-3 w-3 text-gray-500" /></button>
            </div>
          </div>
          <div style={{ height: '170px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={timeSeriesData} margin={{ top: 10, right: 40, left: 0, bottom: 5 }}>
                <defs>
                  <linearGradient id="waitTimeGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.9}/>
                    <stop offset="100%" stopColor="#1d4ed8" stopOpacity={0.9}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                <XAxis dataKey="week" tick={{ fontSize: 10 }} />
                <YAxis yAxisId="left" tick={{ fontSize: 10 }} tickFormatter={(v) => `${v}분`} domain={[0, 30]} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10 }} tickFormatter={(v) => `${v}%`} domain={[0, 25]} />
                <Tooltip formatter={(value: number, name: string) => [name === '대기시간' ? value + '분' : value + '%', name]} />
                <Legend wrapperStyle={{ fontSize: '11px' }} />
                <Bar yAxisId="left" dataKey="대기시간" fill="url(#waitTimeGradient)" radius={[6, 6, 0, 0]} name="대기시간" />
                <Line yAxisId="right" type="monotone" dataKey="이탈률" stroke="#ef4444" strokeWidth={3} dot={{ fill: '#ef4444', r: 5, strokeWidth: 2, stroke: '#fff' }} name="이탈률" />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
