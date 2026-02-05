import React, { useMemo, useRef, useState } from 'react';
import {
  HelpCircle,
  Share2,
  Printer,
  RefreshCw,
  Table2,
  BarChart3,
  Download
} from 'lucide-react';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ComposedChart,
  Line
} from 'recharts';
import { GeoMapPanel } from '../geomap/GeoMapPanel';
import { GEO_INDICATORS, getGeoIndicator, formatGeoValue } from '../geomap/geoIndicators';
import { REGIONAL_SCOPES } from '../geomap/regions';

type RegionValue = {
  regionCode: string;
  regionName: string;
  value: number;
  unit: string;
  rank: number;
};

type AlertItem = {
  id: string;
  severity: 'low' | 'medium' | 'high';
  kpiKey: string;
  regionName: string;
  reason: string;
  createdAt: string;
};

type ViewLevel = 1 | 2 | 3;

type SelectItem = {
  code: string;
  name: string;
};

type PeriodTab = '주간' | '월간' | '분기';

type KpiPrimary = {
  key: 'total_cases' | 'sla_violation' | 'data_shortage' | 'active_alerts';
  label: string;
  unit: string;
  tooltip: string;
  warn: number;
  risk: number;
  direction: 'high' | 'low';
};

const PERIODS = ['2019', '2020', '2021', '2022', '2023', '2024', '2025'];

const PERIOD_TABS: PeriodTab[] = ['주간', '월간', '분기'];

const MAP_KPIS = [
  'total_cases',
  'referral',
  'wait_time',
  'recontact',
  'waitlist_pressure',
  'accessibility_score'
];

const KPI_PRIMARY: KpiPrimary[] = [
  {
    key: 'total_cases',
    label: '전국 처리건수',
    unit: '건',
    tooltip: '기간 내 처리된 전체 케이스 합계',
    warn: 14000,
    risk: 17000,
    direction: 'high'
  },
  {
    key: 'sla_violation',
    label: 'SLA 위반률',
    unit: '%',
    tooltip: '기준 시간 내 응답 실패 비율',
    warn: 3.0,
    risk: 5.0,
    direction: 'low'
  },
  {
    key: 'data_shortage',
    label: '데이터 부족률',
    unit: '%',
    tooltip: '필수 입력 누락 비율',
    warn: 4.5,
    risk: 7.0,
    direction: 'low'
  },
  {
    key: 'active_alerts',
    label: '활성 알림 수',
    unit: '건',
    tooltip: '미확인 상태의 알림 개수',
    warn: 8,
    risk: 12,
    direction: 'high'
  }
];

const ALERTS: AlertItem[] = [
  {
    id: 'AL-2401',
    severity: 'high',
    kpiKey: 'waitlist_pressure',
    regionName: '경기',
    reason: '대기/병목 지수 급등',
    createdAt: '2026-02-04 08:20'
  },
  {
    id: 'AL-2392',
    severity: 'medium',
    kpiKey: 'followup_dropout',
    regionName: '전북',
    reason: '추적 이탈 비율 상승',
    createdAt: '2026-02-04 07:45'
  },
  {
    id: 'AL-2381',
    severity: 'low',
    kpiKey: 'data_shortage',
    regionName: '강원',
    reason: '데이터 부족률 증가',
    createdAt: '2026-02-03 17:10'
  }
];

const hashSeed = (input: string) => {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash * 31 + input.charCodeAt(i)) >>> 0;
  }
  return hash;
};

const seededValue = (seed: string, min: number, max: number) => {
  const ratio = (hashSeed(seed) % 1000) / 1000;
  return min + (max - min) * ratio;
};

const getStatusStyle = (value: number, def: KpiPrimary) => {
  if (def.direction === 'high') {
    if (value >= def.risk) return 'border-red-500';
    if (value >= def.warn) return 'border-amber-400';
  } else {
    if (value <= def.risk) return 'border-red-500';
    if (value <= def.warn) return 'border-amber-400';
  }
  return 'border-gray-200';
};

const ChartCard = ({
  title,
  tableData,
  footer,
  children
}: {
  title: string;
  tableData: { label: string; value: string | number }[];
  footer?: string;
  children: React.ReactNode;
}) => {
  const [openTable, setOpenTable] = useState(false);
  const [openType, setOpenType] = useState(false);
  const [selectedType, setSelectedType] = useState('기본');
  const chartRef = useRef<HTMLDivElement>(null);

  const handleDownload = () => {
    if (!chartRef.current) return;
    const svg = chartRef.current.querySelector('svg');
    if (!svg) return;
    const serializer = new XMLSerializer();
    const svgText = serializer.serializeToString(svg);
    const svgBlob = new Blob([svgText], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = svg.clientWidth || 640;
      canvas.height = svg.clientHeight || 360;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);
      const png = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.href = png;
      link.download = `${title}.png`;
      link.click();
      URL.revokeObjectURL(url);
    };
    img.src = url;
  };

  return (
    <div className="relative rounded-lg border border-gray-200 bg-white">
      <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
        <div className="text-sm font-semibold text-gray-900">{title}</div>
        <div className="flex items-center gap-2 text-xs text-gray-600">
          <button type="button" className="inline-flex items-center gap-1 rounded-sm border border-gray-200 px-2 py-1" onClick={() => setOpenTable(true)}>
            <Table2 className="h-3.5 w-3.5" />
            통계표
          </button>
          <button type="button" className="inline-flex items-center gap-1 rounded-sm border border-gray-200 px-2 py-1" onClick={() => setOpenType((prev) => !prev)}>
            <BarChart3 className="h-3.5 w-3.5" />
            유형
          </button>
          <button type="button" className="inline-flex items-center gap-1 rounded-sm border border-gray-200 px-2 py-1" onClick={handleDownload}>
            <Download className="h-3.5 w-3.5" />
            저장
          </button>
        </div>
      </div>
      <div ref={chartRef} className="px-4 py-3">
        {children}
      </div>
      {footer && <div className="px-4 pb-3 text-[11px] text-gray-500">{footer}</div>}

      {openType && (
        <div className="absolute right-4 top-12 z-10 w-40 rounded-md border border-gray-200 bg-white p-2 text-xs shadow">
          <div className="grid grid-cols-2 gap-2">
            {['기본', '막대', '선', '파이'].map((item) => (
              <button
                key={item}
                type="button"
                className={`rounded border px-2 py-1 ${selectedType === item ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-600'}`}
                onClick={() => setSelectedType(item)}
              >
                {item}
              </button>
            ))}
          </div>
        </div>
      )}

      {openTable && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-md border border-gray-200 bg-white p-4">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold text-gray-900">{title} 통계표</div>
              <button
                type="button"
                className="rounded-sm border border-gray-200 px-2 py-1 text-xs"
                onClick={() => setOpenTable(false)}
              >
                닫기
              </button>
            </div>
            <table className="mt-3 w-full text-xs">
              <thead>
                <tr className="border-b border-gray-200 text-left text-gray-500">
                  <th className="py-2">항목</th>
                  <th className="py-2 text-right">값</th>
                </tr>
              </thead>
              <tbody>
                {tableData.map((row) => (
                  <tr key={row.label} className="border-b border-gray-100">
                    <td className="py-2 text-gray-700">{row.label}</td>
                    <td className="py-2 text-right font-semibold text-gray-900">{row.value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export function NationalDashboard() {
  const indicatorOptions = useMemo(
    () => GEO_INDICATORS.filter((item) => MAP_KPIS.includes(item.id)),
    []
  );
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodTab>('주간');
  const [selectedRegionCode, setSelectedRegionCode] = useState(REGIONAL_SCOPES[0]?.ctprvnCode ?? '11');
  const [selectedKpiId, setSelectedKpiId] = useState(indicatorOptions[0]?.id ?? 'total_cases');
  const [viewLevel, setViewLevel] = useState<ViewLevel>(1);
  const [selectedSig, setSelectedSig] = useState<SelectItem | null>(null);
  const [selectedEmd, setSelectedEmd] = useState<SelectItem | null>(null);
  const [activeKpiKey, setActiveKpiKey] = useState<string | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState('2026-02-04 09:15');
  const [isRefreshing, setIsRefreshing] = useState(false);

  const selectedRegion = useMemo(
    () => REGIONAL_SCOPES.find((item) => item.ctprvnCode === selectedRegionCode) ?? REGIONAL_SCOPES[0],
    [selectedRegionCode]
  );

  const sigOptions = useMemo(() => {
    return Array.from({ length: 5 }).map((_, idx) => ({
      code: `${selectedRegion.ctprvnCode}${idx + 1}0`,
      name: `${selectedRegion.name} 권역 ${idx + 1}`
    }));
  }, [selectedRegion]);

  const selectedYear = PERIODS[PERIODS.length - 1];

  const contextKey = selectedEmd?.code ?? selectedSig?.code ?? selectedRegionCode;

  const kpiCards = useMemo(() => {
    return KPI_PRIMARY.map((def) => {
      const baseValue = def.unit === '건'
        ? Math.round(seededValue(`${def.key}-${contextKey}-${selectedPeriod}`, 12000, 22000))
        : Number(seededValue(`${def.key}-${contextKey}-${selectedPeriod}`, 1.5, 8.5).toFixed(1));
      const prevValue = def.unit === '건'
        ? Math.round(baseValue * (0.95 + seededValue(`${def.key}-delta-${contextKey}`, 0.01, 0.06)))
        : Number((baseValue * (0.94 + seededValue(`${def.key}-delta-${contextKey}`, 0.02, 0.08))).toFixed(1));
      const deltaRate = prevValue ? Number((((baseValue - prevValue) / prevValue) * 100).toFixed(1)) : 0;
      const value = def.key === 'active_alerts'
        ? ALERTS.length + Math.round(seededValue(`${def.key}-count-${contextKey}`, -1, 3))
        : baseValue;
      return {
        ...def,
        value,
        deltaRate
      };
    });
  }, [contextKey, selectedPeriod]);

  const kpiMap = useMemo(() => {
    return kpiCards.reduce<Record<string, number>>((acc, item) => {
      acc[item.key] = item.value;
      return acc;
    }, {});
  }, [kpiCards]);

  const selectedIndicator = getGeoIndicator(selectedKpiId);

  const regionValues: RegionValue[] = useMemo(() => {
    return REGIONAL_SCOPES.map((region) => {
      const value = seededValue(`${selectedKpiId}-${region.id}-${selectedYear}`, selectedIndicator.scale[0], selectedIndicator.scale[1]);
      return {
        regionCode: region.ctprvnCode,
        regionName: region.label,
        value,
        unit: selectedIndicator.unit,
        rank: 0
      };
    });
  }, [selectedKpiId, selectedYear, selectedIndicator.scale]);

  const pieSlaData = [
    { name: '정상', value: Number((100 - kpiMap.sla_violation).toFixed(1)) },
    { name: '위반', value: Number(kpiMap.sla_violation.toFixed(1)) }
  ];

  const pieDataQuality = [
    { name: '충분', value: Number((100 - kpiMap.data_shortage).toFixed(1)) },
    { name: '부족', value: Number(kpiMap.data_shortage.toFixed(1)) }
  ];

  const barKpiData = [
    { name: '처리', value: Math.round(seededValue(`${contextKey}-proc`, 65, 95)) },
    { name: '지연', value: Math.round(seededValue(`${contextKey}-delay`, 8, 28)) },
    { name: '오류', value: Math.round(seededValue(`${contextKey}-error`, 3, 18)) },
    { name: '대기열', value: Math.round(seededValue(`${contextKey}-queue`, 12, 35)) }
  ];

  const topLoadData = [...regionValues]
    .sort((a, b) => b.value - a.value)
    .slice(0, 6)
    .map((item) => ({ name: item.regionName, value: Number(item.value.toFixed(1)) }));

  const trendData = useMemo(() => {
    return Array.from({ length: 12 }).map((_, idx) => ({
      period: `W${idx + 1}`,
      throughput: Math.round(seededValue(`${contextKey}-t-${idx}`, 2800, 5200)),
      slaViolation: Number(seededValue(`${contextKey}-s-${idx}`, 1.2, 6.4).toFixed(1))
    }));
  }, [contextKey]);

  const contextPath = useMemo(() => {
    const parts = [selectedRegion.label];
    if (selectedSig?.name) parts.push(selectedSig.name);
    if (selectedEmd?.name) parts.push(selectedEmd.name);
    return parts.join(' > ');
  }, [selectedRegion.label, selectedSig, selectedEmd]);

  const handleRegionChange = (code: string) => {
    setSelectedRegionCode(code);
    setSelectedSig(null);
    setSelectedEmd(null);
    setViewLevel(1);
  };

  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => {
      setLastUpdatedAt('2026-02-04 09:30');
      setIsRefreshing(false);
    }, 700);
  };

  const handleKpiClick = (key: string) => {
    setActiveKpiKey((prev) => (prev === key ? null : key));
  };

  return (
    <div className="bg-white text-gray-900">
      <div className="sticky top-0 z-30 h-14 border-b border-gray-200 bg-white">
        <div className="mx-auto flex h-full max-w-[1800px] items-center justify-between px-6">
          <div className="text-lg font-bold">전국 운영 대시보드</div>
          <div className="flex items-center gap-2">
            {PERIOD_TABS.map((period) => (
              <button
                key={period}
                type="button"
                onClick={() => setSelectedPeriod(period)}
                className={`rounded-sm border px-3 py-1 text-xs ${
                  selectedPeriod === period ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-600'
                }`}
              >
                {period}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 text-xs">
            <select
              value={selectedRegionCode}
              onChange={(event) => {
                handleRegionChange(event.target.value);
              }}
              className="rounded-sm border border-gray-200 bg-white px-2 py-1"
            >
              {REGIONAL_SCOPES.map((region) => (
                <option key={region.id} value={region.ctprvnCode}>
                  {region.label}
                </option>
              ))}
            </select>
            <select
              value={selectedSig?.code ?? ''}
              onChange={(event) => {
                const nextCode = event.target.value;
                if (!nextCode) {
                  setSelectedSig(null);
                  setSelectedEmd(null);
                  setViewLevel(1);
                  return;
                }
                const nextSig = sigOptions.find((sig) => sig.code === nextCode) ?? null;
                setSelectedSig(nextSig);
                setSelectedEmd(null);
                setViewLevel(2);
              }}
              className="rounded-sm border border-gray-200 bg-white px-2 py-1"
            >
              <option value="">시군구</option>
              {sigOptions.map((sig) => (
                <option key={sig.code} value={sig.code}>
                  {sig.name}
                </option>
              ))}
            </select>
            <button className="inline-flex items-center gap-1 rounded-sm border border-gray-200 px-2 py-1">
              <HelpCircle className="h-4 w-4" />
              가이드
            </button>
            <button className="inline-flex items-center gap-1 rounded-sm border border-gray-200 px-2 py-1">
              <Share2 className="h-4 w-4" />
              공유
            </button>
            <button className="inline-flex items-center gap-1 rounded-sm border border-gray-200 px-2 py-1">
              <Printer className="h-4 w-4" />
              출력
            </button>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-[1800px] overflow-x-auto px-6 py-6">
        <div className="mb-4 flex items-center justify-between text-xs text-gray-500">
          <div>마지막 갱신 {lastUpdatedAt}</div>
          <button className="inline-flex items-center gap-1 rounded-sm border border-gray-200 px-2 py-1 text-gray-600" onClick={handleRefresh}>
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            새로고침
          </button>
        </div>

        <div className="grid min-w-[1200px] grid-cols-[20%_50%_30%] gap-4">
          <div className="space-y-3">
            {kpiCards.map((card) => {
              const isActive = activeKpiKey === card.key;
              const deltaColor = card.deltaRate >= 0 ? 'text-emerald-600' : 'text-red-600';
              return (
                <button
                  key={card.key}
                  type="button"
                  onClick={() => handleKpiClick(card.key)}
                  className={`w-full rounded-lg border bg-white p-4 text-left transition-shadow hover:shadow-sm ${getStatusStyle(card.value, card)} ${isActive ? 'ring-2 ring-blue-500' : ''}`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-500" title={card.tooltip}>
                      {card.label}
                    </span>
                    <span className="rounded-sm bg-gray-50 px-2 py-0.5 text-[11px] text-gray-500">{card.unit}</span>
                  </div>
                  <div className="mt-2 text-2xl font-bold text-gray-900">
                    {card.unit === '건' ? Math.round(card.value).toLocaleString('ko-KR') : card.value.toFixed(1)}
                  </div>
                  <div className={`mt-2 text-xs ${deltaColor}`}>
                    {card.deltaRate >= 0 ? '▲' : '▼'} {Math.abs(card.deltaRate).toFixed(1)}%
                  </div>
                </button>
              );
            })}
          </div>

          <div className="space-y-4">
            <GeoMapPanel
              title="전국 GeoMap"
              indicatorId={selectedKpiId}
              year={Number(selectedYear)}
              scope={{ mode: 'national' }}
              variant="portal"
              mapHeight={520}
              hintText="시군구 클릭 시 운영 분석 화면으로 이동"
              onRegionSelect={({ level, code, name }) => {
                if (level === 'ctprvn') {
                  handleRegionChange(code);
                  return;
                }
                if (level === 'sig') {
                  handleRegionChange(code.slice(0, 2));
                  setSelectedSig({ code, name });
                  setSelectedEmd(null);
                  setViewLevel(2);
                }
              }}
            />
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-sm border border-gray-200 bg-white px-3 py-2 text-xs text-gray-500">
              <div className="flex flex-wrap items-center gap-3">
                <span>선택 권역: {contextPath}</span>
                <span>
                  단계: {viewLevel === 1 ? '전국' : viewLevel === 2 ? '시군구' : '읍면동'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span>선택 지표</span>
                <select
                  value={selectedKpiId}
                  onChange={(event) => setSelectedKpiId(event.target.value)}
                  className="rounded-sm border border-gray-200 bg-white px-2 py-1 text-xs text-gray-700"
                >
                  {indicatorOptions.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <ChartCard
              title="SLA 정상/위반"
              tableData={pieSlaData.map((item) => ({ label: item.name, value: `${item.value}%` }))}
              footer="단위: %"
            >
              <div className="h-40">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieSlaData}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={38}
                      outerRadius={60}
                      activeIndex={activeKpiKey === 'sla_violation' ? 1 : undefined}
                    >
                      {pieSlaData.map((_, idx) => (
                        <Cell key={idx} fill={idx === 0 ? '#2563eb' : '#e2e8f0'} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </ChartCard>

            <ChartCard
              title="데이터 충분/부족"
              tableData={pieDataQuality.map((item) => ({ label: item.name, value: `${item.value}%` }))}
              footer="단위: %"
            >
              <div className="h-40">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieDataQuality}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={38}
                      outerRadius={60}
                      activeIndex={activeKpiKey === 'data_shortage' ? 1 : undefined}
                    >
                      {pieDataQuality.map((_, idx) => (
                        <Cell key={idx} fill={idx === 0 ? '#0f766e' : '#e2e8f0'} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </ChartCard>

            <ChartCard
              title="KPI 분포"
              tableData={barKpiData.map((item) => ({ label: item.name, value: item.value }))}
              footer="단위: 점수"
            >
              <div className="h-40">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={barKpiData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                    <CartesianGrid stroke="#e5e7eb" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip />
                    <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                      {barKpiData.map((entry) => {
                        const highlight = activeKpiKey === 'total_cases' && entry.name === '처리';
                        const fill = highlight ? '#2563eb' : '#94a3b8';
                        return <Cell key={entry.name} fill={fill} opacity={highlight || !activeKpiKey ? 1 : 0.5} />;
                      })}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </ChartCard>

            <ChartCard
              title="광역센터 부하 Top N"
              tableData={topLoadData.map((item) => ({ label: item.name, value: formatGeoValue(item.value, selectedIndicator) }))}
              footer={`단위: ${selectedIndicator.unit}`}
            >
              <div className="h-44">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={topLoadData} layout="vertical" margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid stroke="#e5e7eb" vertical={false} />
                    <XAxis type="number" tick={{ fontSize: 10 }} />
                    <YAxis dataKey="name" type="category" width={60} tick={{ fontSize: 10 }} />
                    <Tooltip />
                    <Bar dataKey="value" fill="#2563eb" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </ChartCard>
          </div>
        </div>

        <div className="mt-4 h-[240px] rounded-lg border border-gray-200 bg-white p-4">
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold text-gray-900">주간 처리량 추이</div>
            <div className="text-xs text-gray-500">단위: 건 / %</div>
          </div>
          <div className="mt-4 h-[180px]">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={trendData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                <CartesianGrid stroke="#e5e7eb" vertical={false} />
                <XAxis dataKey="period" tick={{ fontSize: 10 }} />
                <YAxis yAxisId="left" tick={{ fontSize: 10 }} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10 }} />
                <Tooltip />
                <Bar yAxisId="left" dataKey="throughput" fill="#2563eb" radius={[4, 4, 0, 0]} />
                <Line yAxisId="right" type="monotone" dataKey="slaViolation" stroke="#ef4444" strokeWidth={2} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
