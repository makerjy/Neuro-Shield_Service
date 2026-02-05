import React, { useMemo, useState } from 'react';
import { Download, BarChart3, HelpCircle, TrendingUp, TrendingDown } from 'lucide-react';
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
   메인 컴포넌트
═══════════════════════════════════════════════════════════════════════════════ */
export function NationalDashboard() {
  const [selectedKPI, setSelectedKPI] = useState<string | null>(null);
  const [selectedDistrictName, setSelectedDistrictName] = useState<string | null>(null);

  const statsScopeKey = selectedDistrictName || 'national';

  /* ─────────────────────────────────────────────────────────────
     KPI 데이터
  ───────────────────────────────────────────────────────────── */
  const kpiData = useMemo(() => ({
    totalCases: Math.round(seededValue(`${statsScopeKey}-total`, 14000, 18000)),
    slaRate: Number((100 - seededValue(`${statsScopeKey}-sla`, 2, 6)).toFixed(2)),
    dataRate: Number((100 - seededValue(`${statsScopeKey}-data`, 3, 8)).toFixed(2)),
    activeAlerts: Math.round(seededValue(`${statsScopeKey}-alerts`, 5, 25)),
    maleRatio: Number(seededValue(`${statsScopeKey}-male`, 48, 52).toFixed(2)),
    foreigners: Math.round(seededValue(`${statsScopeKey}-foreign`, 180000, 220000)),
    foreignerChange: Number(seededValue(`${statsScopeKey}-foreign-change`, 3, 8).toFixed(2)),
  }), [statsScopeKey]);

  /* ─────────────────────────────────────────────────────────────
     트리맵 데이터 (지역별 케이스)
  ───────────────────────────────────────────────────────────── */
  const treemapData = useMemo(() => [
    { name: '경기도', size: Math.round(seededValue(`${statsScopeKey}-tree-경기`, 2500, 3500)), fill: '#3b82f6' },
    { name: '경상남도', size: Math.round(seededValue(`${statsScopeKey}-tree-경남`, 1800, 2500)), fill: '#60a5fa' },
    { name: '부산광역시', size: Math.round(seededValue(`${statsScopeKey}-tree-부산`, 1500, 2200)), fill: '#93c5fd' },
    { name: '인천광역시', size: Math.round(seededValue(`${statsScopeKey}-tree-인천`, 1200, 1800)), fill: '#bfdbfe' },
    { name: '충청남도', size: Math.round(seededValue(`${statsScopeKey}-tree-충남`, 1000, 1500)), fill: '#dbeafe' },
    { name: '전라남도', size: Math.round(seededValue(`${statsScopeKey}-tree-전남`, 900, 1400)), fill: '#3b82f6' },
    { name: '경상북도', size: Math.round(seededValue(`${statsScopeKey}-tree-경북`, 800, 1300)), fill: '#60a5fa' },
    { name: '대구광역시', size: Math.round(seededValue(`${statsScopeKey}-tree-대구`, 700, 1100)), fill: '#93c5fd' },
    { name: '서울특별시', size: Math.round(seededValue(`${statsScopeKey}-tree-서울`, 600, 1000)), fill: '#bfdbfe' },
    { name: '충청북도', size: Math.round(seededValue(`${statsScopeKey}-tree-충북`, 500, 900)), fill: '#dbeafe' },
    { name: '강원특별자치도', size: Math.round(seededValue(`${statsScopeKey}-tree-강원`, 400, 800)), fill: '#3b82f6' },
    { name: '전북특별자치도', size: Math.round(seededValue(`${statsScopeKey}-tree-전북`, 350, 700)), fill: '#60a5fa' },
  ], [statsScopeKey]);

  /* ─────────────────────────────────────────────────────────────
     파이 차트 데이터 (SLA 정상/위반)
  ───────────────────────────────────────────────────────────── */
  const slaPieData = useMemo(() => [
    { name: '정상', value: kpiData.slaRate, fill: COLORS.blue },
    { name: '위반', value: Number((100 - kpiData.slaRate).toFixed(2)), fill: COLORS.red },
  ], [kpiData.slaRate]);

  const dataPieData = useMemo(() => [
    { name: '충분', value: kpiData.dataRate, fill: COLORS.blue },
    { name: '부족', value: Number((100 - kpiData.dataRate).toFixed(2)), fill: COLORS.orange },
  ], [kpiData.dataRate]);

  /* ─────────────────────────────────────────────────────────────
     연령분포 막대 데이터
  ───────────────────────────────────────────────────────────── */
  const ageDistributionData = useMemo(() => {
    const ages = ['0-4', '5-9', '10-14', '15-19', '20-24', '25-29', '30-34', '35-39', '40-44', '45-49', '50-54', '55-59', '60-64', '65-69'];
    return ages.map((age, idx) => ({
      age,
      value: Math.round(seededValue(`${statsScopeKey}-age-${idx}`, 800, 4500)),
      fill: AGE_COLORS[Math.floor(idx / 3) % AGE_COLORS.length],
    }));
  }, [statsScopeKey]);

  /* ─────────────────────────────────────────────────────────────
     센터별 부하 가로막대 데이터
  ───────────────────────────────────────────────────────────── */
  const centerLoadData = useMemo(() => [
    { name: '비이동자', value: Math.round(seededValue(`${statsScopeKey}-load-1`, 35000, 45000)) },
    { name: '총 이동자', value: Math.round(seededValue(`${statsScopeKey}-load-2`, 4000, 6000)) },
    { name: '시도내 이동', value: Math.round(seededValue(`${statsScopeKey}-load-3`, 1500, 2500)) },
    { name: '시도간 이동', value: Math.round(seededValue(`${statsScopeKey}-load-4`, 1200, 2000)) },
    { name: '광역센터간', value: Math.round(seededValue(`${statsScopeKey}-load-5`, 1000, 1800)) },
  ], [statsScopeKey]);

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
    if (width < 30 || height < 20) return null;
    return (
      <g>
        <rect x={x} y={y} width={width} height={height} fill={fill} stroke="#fff" strokeWidth={2} />
        {width > 50 && height > 30 && (
          <text x={x + width / 2} y={y + height / 2} textAnchor="middle" dominantBaseline="middle" fill="#fff" fontSize={width > 80 ? 11 : 9} fontWeight="500">
            {name}
          </text>
        )}
      </g>
    );
  };

  return (
    <div className="h-full flex flex-col bg-gray-50 overflow-hidden">
      {/* ═══════════════════════════════════════════════════════════
          HEADER
      ═══════════════════════════════════════════════════════════ */}
      <header className="h-10 bg-white border-b border-gray-200 flex items-center px-4 shrink-0">
        <h1 className="text-sm font-bold text-gray-800">전국 운영 대시보드</h1>
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
            <div style={{ height: '200px' }}>
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

          {/* SLA 현황 */}
          <div className="bg-white border border-gray-200 rounded-lg p-3">
            <div className="text-xs text-gray-500 mb-1">SLA 현황</div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-600">전국 SLA 준수율 <HelpCircle className="inline h-3 w-3 text-gray-400" /></span>
            </div>
            <div className="text-2xl font-bold text-center mt-2">{kpiData.slaRate}%</div>
          </div>

          {/* 활성 알림 */}
          <div className="bg-white border border-gray-200 rounded-lg p-3">
            <div className="text-xs text-gray-500 mb-1">전국 활성 알림 수 <HelpCircle className="inline h-3 w-3 text-gray-400" /></div>
            <div className="text-2xl font-bold text-blue-600">
              {kpiData.foreigners.toLocaleString()} <span className="text-sm font-normal text-gray-500">건</span>
            </div>
            <div className="flex items-center gap-1 mt-1 text-xs">
              <span className="text-gray-500">전월대비</span>
              <span className="text-red-500 flex items-center">
                {kpiData.foreignerChange}% <TrendingUp className="h-3 w-3 ml-0.5" />
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
                <span className="px-2 py-0.5 bg-red-500 text-white text-[10px] rounded">전국</span>
              </div>
              <button className="p-1 hover:bg-gray-200 rounded"><Download className="h-3.5 w-3.5 text-gray-500" /></button>
            </div>
            <div className="flex-1 p-2">
              <GeoMapPanel
                key={`national-${selectedKPI || 'default'}`}
                title=""
                indicatorId={selectedKPI || 'completion'}
                year={2026}
                scope={{ mode: 'national' }}
                variant="portal"
                mapHeight={340}
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
              {/* SLA 파이 */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs text-gray-700 font-medium">SLA 현황</span>
                </div>
                <div style={{ height: '120px' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <defs>
                        <linearGradient id="blueGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#3b82f6" stopOpacity={1}/>
                          <stop offset="100%" stopColor="#1d4ed8" stopOpacity={1}/>
                        </linearGradient>
                        <linearGradient id="redGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#ef4444" stopOpacity={1}/>
                          <stop offset="100%" stopColor="#dc2626" stopOpacity={1}/>
                        </linearGradient>
                      </defs>
                      <Pie data={slaPieData} cx="50%" cy="50%" innerRadius={30} outerRadius={48} dataKey="value" startAngle={90} endAngle={-270} strokeWidth={0}>
                        <Cell fill="url(#blueGradient)" />
                        <Cell fill="url(#redGradient)" />
                      </Pie>
                      <Tooltip formatter={(v: number) => `${v}%`} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex justify-center gap-3 mt-1">
                  <div className="flex items-center gap-1 text-[10px]">
                    <span className="w-2 h-2 rounded-full bg-blue-500" />
                    <span>정상 {kpiData.slaRate}%</span>
                  </div>
                  <div className="flex items-center gap-1 text-[10px]">
                    <span className="w-2 h-2 rounded-full bg-red-500" />
                    <span>위반 {(100 - kpiData.slaRate).toFixed(2)}%</span>
                  </div>
                </div>
              </div>

              {/* 데이터 현황 파이 */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs text-gray-700 font-medium">데이터 현황</span>
                </div>
                <div style={{ height: '120px' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <defs>
                        <linearGradient id="blueGradient2" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#3b82f6" stopOpacity={1}/>
                          <stop offset="100%" stopColor="#1d4ed8" stopOpacity={1}/>
                        </linearGradient>
                        <linearGradient id="orangeGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#f59e0b" stopOpacity={1}/>
                          <stop offset="100%" stopColor="#d97706" stopOpacity={1}/>
                        </linearGradient>
                      </defs>
                      <Pie data={dataPieData} cx="50%" cy="50%" innerRadius={30} outerRadius={48} dataKey="value" startAngle={90} endAngle={-270} strokeWidth={0}>
                        <Cell fill="url(#blueGradient2)" />
                        <Cell fill="url(#orangeGradient)" />
                      </Pie>
                      <Tooltip formatter={(v: number) => `${v}%`} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex justify-center gap-3 mt-1">
                  <div className="flex items-center gap-1 text-[10px]">
                    <span className="w-2 h-2 rounded-full bg-blue-500" />
                    <span>충분 {kpiData.dataRate}%</span>
                  </div>
                  <div className="flex items-center gap-1 text-[10px]">
                    <span className="w-2 h-2 rounded-full bg-orange-500" />
                    <span>부족 {(100 - kpiData.dataRate).toFixed(2)}%</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 연령분포 (KPI 분포) 막대 차트 */}
          <div className="bg-white border border-gray-200 rounded-lg p-3">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-gray-700">케이스 분포</span>
                <div className="flex gap-1">
                  {['영유아/어린이', '청소년', '청년', '장년', '노년'].map((label, idx) => (
                    <span key={label} className="flex items-center gap-0.5 text-[9px] text-gray-500">
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: AGE_COLORS[idx] }} />
                      {label}
                    </span>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button className="px-2 py-0.5 text-[10px] text-blue-600 bg-blue-50 rounded hover:bg-blue-100">통계표 보기</button>
                <button className="p-1 hover:bg-gray-100 rounded"><Download className="h-3 w-3 text-gray-500" /></button>
              </div>
            </div>
            <div style={{ height: '150px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={ageDistributionData} margin={{ top: 5, right: 5, left: -15, bottom: 5 }}>
                  <defs>
                    <linearGradient id="barGradient1" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.9}/>
                      <stop offset="100%" stopColor="#1d4ed8" stopOpacity={0.9}/>
                    </linearGradient>
                    <linearGradient id="barGradient2" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#22c55e" stopOpacity={0.9}/>
                      <stop offset="100%" stopColor="#16a34a" stopOpacity={0.9}/>
                    </linearGradient>
                    <linearGradient id="barGradient3" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.9}/>
                      <stop offset="100%" stopColor="#d97706" stopOpacity={0.9}/>
                    </linearGradient>
                    <linearGradient id="barGradient4" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#ec4899" stopOpacity={0.9}/>
                      <stop offset="100%" stopColor="#db2777" stopOpacity={0.9}/>
                    </linearGradient>
                    <linearGradient id="barGradient5" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.9}/>
                      <stop offset="100%" stopColor="#7c3aed" stopOpacity={0.9}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                  <XAxis dataKey="age" tick={{ fontSize: 9 }} interval={0} angle={-45} textAnchor="end" height={35} />
                  <YAxis tick={{ fontSize: 9 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}K`} />
                  <Tooltip formatter={(v: number) => v.toLocaleString()} />
                  <Bar dataKey="value" radius={[2, 2, 0, 0]}>
                    {ageDistributionData.map((entry, idx) => <Cell key={idx} fill={entry.fill} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* 센터별 부하 가로막대 */}
          <div className="bg-white border border-gray-200 rounded-lg p-3 flex-1">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-gray-700">케이스 이동 현황 (광역센터간)</span>
              <div className="flex items-center gap-1">
                <button className="px-2 py-0.5 text-[10px] text-blue-600 bg-blue-50 rounded hover:bg-blue-100">통계표 보기</button>
                <button className="p-1 hover:bg-gray-100 rounded"><Download className="h-3 w-3 text-gray-500" /></button>
              </div>
            </div>
            <div style={{ height: '160px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={centerLoadData} layout="vertical" margin={{ top: 5, right: 30, left: 70, bottom: 5 }}>
                  <defs>
                    <linearGradient id="horizontalBarGradient" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.8}/>
                      <stop offset="100%" stopColor="#60a5fa" stopOpacity={1}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e5e7eb" />
                  <XAxis type="number" tick={{ fontSize: 9 }} tickFormatter={(v) => v.toLocaleString()} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={65} />
                  <Tooltip formatter={(v: number) => v.toLocaleString()} />
                  <Bar dataKey="value" fill="url(#horizontalBarGradient)" radius={[0, 6, 6, 0]} />
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
