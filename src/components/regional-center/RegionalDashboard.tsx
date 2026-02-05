import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Download,
  AlertTriangle,
  ArrowRight,
  Settings,
  Table2,
  BarChart3,
  TrendingUp,
  TrendingDown,
} from 'lucide-react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/card';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  LineChart,
  Line,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  ComposedChart
} from 'recharts';
import { GeoMapPanel } from '../geomap/GeoMapPanel';
import { RegionalScope } from '../geomap/regions';

interface RegionalDashboardProps {
  region: RegionalScope;
  onNavigateToBottleneck?: () => void;
}

type KPIType = 'completion' | 'referral' | 'dropout' | 'recontact' | 'wait_time' | 'consultation_time';

interface DistrictData {
  id: string;
  name: string;
  completion: number;
  referral: number;
  dropout: number;
  recontact: number;
  waitTime: number;
  consultationTime: number;
  trend: 'up' | 'down' | 'stable';
  staffCount: number;
  monthlyChange: number;
}

interface Alert {
  id: string;
  district: string;
  message: string;
  severity: 'critical' | 'warning';
  change: string;
  action: string;
}

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

const buildDistrictData = (region: RegionalScope): DistrictData[] => {
  const labels = ['권역 1', '권역 2', '권역 3', '권역 4', '권역 5'];
  return labels.map((label, idx) => {
    const key = `${region.id}-${idx}`;
    const completion = Math.round(seededValue(`${key}-completion`, 60, 92));
    const referral = Math.round(seededValue(`${key}-referral`, 30, 65));
    const dropout = Math.round(seededValue(`${key}-dropout`, 6, 28));
    const recontact = Math.round(seededValue(`${key}-recontact`, 35, 78));
    const waitTime = Number(seededValue(`${key}-wait`, 0.8, 5.2).toFixed(1));
    const consultationTime = Number(seededValue(`${key}-consult`, 16, 28).toFixed(1));
    const monthlyChange = Math.round(seededValue(`${key}-change`, -12, 12));
    const trend: DistrictData['trend'] = monthlyChange > 2 ? 'up' : monthlyChange < -2 ? 'down' : 'stable';
    return {
      id: `${region.id}-${idx}`,
      name: `${region.name} ${label}`,
      completion,
      referral,
      dropout,
      recontact,
      waitTime,
      consultationTime,
      trend,
      staffCount: Math.round(seededValue(`${key}-staff`, 8, 22)),
      monthlyChange
    };
  });
};

const buildDistrictDetail = (name: string): DistrictData => {
  const key = `detail-${name}`;
  const completion = Math.round(seededValue(`${key}-completion`, 60, 92));
  const referral = Math.round(seededValue(`${key}-referral`, 30, 65));
  const dropout = Math.round(seededValue(`${key}-dropout`, 6, 28));
  const recontact = Math.round(seededValue(`${key}-recontact`, 35, 78));
  const waitTime = Number(seededValue(`${key}-wait`, 0.8, 5.2).toFixed(1));
  const consultationTime = Number(seededValue(`${key}-consult`, 16, 28).toFixed(1));
  const monthlyChange = Math.round(seededValue(`${key}-change`, -12, 12));
  const trend: DistrictData['trend'] = monthlyChange > 2 ? 'up' : monthlyChange < -2 ? 'down' : 'stable';
  return {
    id: key,
    name,
    completion,
    referral,
    dropout,
    recontact,
    waitTime,
    consultationTime,
    trend,
    staffCount: Math.round(seededValue(`${key}-staff`, 8, 22)),
    monthlyChange
  };
};

const buildAlerts = (region: RegionalScope): Alert[] => ([
  {
    id: 'ALERT-001',
    district: `${region.name} 권역 1`,
    message: '이탈률 2주간 급증',
    severity: 'critical',
    change: '+12%p (전월 대비)',
    action: '상담사 긴급 파견 필요'
  },
  {
    id: 'ALERT-002',
    district: `${region.name} 권역 3`,
    message: '재접촉 성공률 하락',
    severity: 'warning',
    change: '-8%p (3주 연속)',
    action: '재접촉 프로토콜 점검 권고'
  },
  {
    id: 'ALERT-003',
    district: `${region.name} 권역 2`,
    message: '평균 대기시간 증가',
    severity: 'warning',
    change: '+2.1일 (지역 평균 2배)',
    action: '인력 재배치 검토'
  }
]);

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
                className={`rounded border px-2 py-1 ${
                  selectedType === item ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-600'
                }`}
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

export function RegionalDashboard({ region, onNavigateToBottleneck }: RegionalDashboardProps) {
  const [selectedKPI, setSelectedKPI] = useState<KPIType>('completion');
  const [selectedDistrictName, setSelectedDistrictName] = useState<string | null>(null);
  const [activeKpiKey, setActiveKpiKey] = useState<string | null>(null);

  useEffect(() => {
    setSelectedDistrictName(null);
  }, [region.id]);

  const districtData = useMemo(() => buildDistrictData(region), [region]);
  const alerts = useMemo(() => buildAlerts(region), [region]);

  const statsScopeKey = selectedDistrictName ? `${region.id}-${selectedDistrictName}` : region.id;
  const statsScopeLabel = selectedDistrictName ? `${selectedDistrictName} 권역` : region.label;

  const kpiOptions = [
    { id: 'completion', label: '케이스 처리율', avg: 82, unit: '%', tooltip: '전체 케이스 중 완료된 비율', warn: 75, risk: 60 },
    { id: 'referral', label: 'SLA 준수율', avg: 94, unit: '%', tooltip: 'SLA 기준 내 처리 비율', warn: 90, risk: 85 },
    { id: 'dropout', label: '추적 이탈 비율', avg: 13, unit: '%', tooltip: '추적 중 이탈한 케이스 비율', warn: 15, risk: 20 },
    { id: 'recontact', label: '데이터 품질', avg: 96, unit: '%', tooltip: '데이터 완전성 점수', warn: 92, risk: 85 },
    { id: 'wait_time', label: '평균 응답시간', avg: 18.4, unit: '분', tooltip: '평균 응답 소요 시간', warn: 25, risk: 35 },
    { id: 'consultation_time', label: 'SLA 위반률', avg: 3.2, unit: '%', tooltip: 'SLA 위반 케이스 비율', warn: 5, risk: 8 },
  ];

  const ageDistribution = useMemo(() => {
    const groups = ['0-14', '15-29', '30-44', '45-64', '65+'];
    return groups.map((label, idx) => ({
      age: label,
      male: Math.round(seededValue(`${statsScopeKey}-age-m-${idx}`, 8, 22)),
      female: Math.round(seededValue(`${statsScopeKey}-age-f-${idx}`, 9, 24))
    }));
  }, [statsScopeKey]);

  const trendData = useMemo(() => {
    return Array.from({ length: 6 }).map((_, idx) => ({
      month: `${idx + 1}월`,
      cases: Math.round(seededValue(`${statsScopeKey}-trend-${idx}`, 280, 620)),
      resolved: Math.round(seededValue(`${statsScopeKey}-resolved-${idx}`, 240, 560))
    }));
  }, [statsScopeKey]);

  const capacityData = useMemo(() => {
    return [
      {
        name: '수요 대비 공급',
        demand: Math.round(seededValue(`${statsScopeKey}-demand`, 70, 120)),
        supply: Math.round(seededValue(`${statsScopeKey}-supply`, 60, 110))
      },
      {
        name: '검사 커버리지',
        demand: Math.round(seededValue(`${statsScopeKey}-coverage`, 60, 100)),
        supply: Math.round(seededValue(`${statsScopeKey}-capacity`, 55, 98))
      }
    ];
  }, [statsScopeKey]);

  const riskComposition = useMemo(() => {
    const high = Math.round(seededValue(`${statsScopeKey}-risk-high`, 18, 32));
    const mid = Math.round(seededValue(`${statsScopeKey}-risk-mid`, 28, 42));
    const low = 100 - high - mid;
    return [
      { name: 'L1', value: low, color: '#10b981' },
      { name: 'L2', value: mid, color: '#f59e0b' },
      { name: 'L3', value: high, color: '#ef4444' }
    ];
  }, [statsScopeKey]);

  const contactData = useMemo(() => {
    const success = Math.round(seededValue(`${statsScopeKey}-contact-success`, 65, 88));
    return [
      { name: '성공', value: success },
      { name: '실패', value: 100 - success }
    ];
  }, [statsScopeKey]);

  const consultationData = useMemo(() => {
    const completed = Math.round(seededValue(`${statsScopeKey}-consult-complete`, 70, 92));
    return [
      { name: '완료', value: completed },
      { name: '미완료', value: 100 - completed }
    ];
  }, [statsScopeKey]);

  const kpiComparisonData = useMemo(() => {
    return districtData.slice(0, 4).map((d) => ({
      name: d.name.split(' ').slice(-1)[0],
      처리율: d.completion,
      이탈률: d.dropout,
      재접촉: d.recontact
    }));
  }, [districtData]);

  const topDropoutData = useMemo(() => {
    return [...districtData]
      .sort((a, b) => b.dropout - a.dropout)
      .slice(0, 5)
      .map((d) => ({ name: d.name.split(' ').slice(-1)[0], value: d.dropout }));
  }, [districtData]);

  const mixedTrendData = useMemo(() => {
    return Array.from({ length: 12 }).map((_, idx) => ({
      period: `W${idx + 1}`,
      waitTime: Number(seededValue(`${statsScopeKey}-wait-${idx}`, 12, 28).toFixed(1)),
      dropout: Number(seededValue(`${statsScopeKey}-dropout-${idx}`, 8, 22).toFixed(1))
    }));
  }, [statsScopeKey]);

  const kpiCards = useMemo(() => {
    return kpiOptions.map((opt) => {
      const currentValue = opt.id === 'completion' ? districtData[0]?.completion || opt.avg :
                          opt.id === 'referral' ? districtData[0]?.referral || opt.avg :
                          opt.id === 'dropout' ? districtData[0]?.dropout || opt.avg :
                          opt.id === 'recontact' ? districtData[0]?.recontact || opt.avg :
                          opt.id === 'wait_time' ? districtData[0]?.waitTime || opt.avg :
                          districtData[0]?.consultationTime || opt.avg;
      const deltaRate = Math.round(seededValue(`${opt.id}-delta-${statsScopeKey}`, -8, 12));
      return { ...opt, value: currentValue, deltaRate };
    });
  }, [kpiOptions, districtData, statsScopeKey]);

  const getKPIValue = (district: DistrictData, kpi: KPIType): number => {
    const map = {
      completion: district.completion,
      referral: district.referral,
      dropout: district.dropout,
      recontact: district.recontact,
      wait_time: district.waitTime,
      consultation_time: district.consultationTime,
    };
    return map[kpi];
  };

  const getKPIColor = (value: number, kpi: KPIType): string => {
    // Inverse for dropout (lower is better)
    if (kpi === 'dropout') {
      if (value <= 10) return '#10b981'; // Green
      if (value <= 18) return '#fbbf24'; // Yellow
      return '#ef4444'; // Red
    }
    // Inverse for wait_time (lower is better)
    if (kpi === 'wait_time') {
      if (value <= 2) return '#10b981';
      if (value <= 3.5) return '#fbbf24';
      return '#ef4444';
    }
    // Normal (higher is better)
    if (value >= 75) return '#10b981';
    if (value >= 60) return '#fbbf24';
    return '#ef4444';
  };

  const handleExportReport = () => {
    console.log('[AUDIT] Dashboard Report Export:', {
      action: 'REPORT_EXPORT',
      kpi: selectedKPI,
      timestamp: new Date().toISOString(),
    });
    alert('보고서가 내보내기 되었습니다.');
  };

  const handleKpiClick = (key: string) => {
    setActiveKpiKey((prev) => (prev === key ? null : key));
  };

  const currentDistrictData = useMemo(
    () => (selectedDistrictName ? buildDistrictDetail(selectedDistrictName) : null),
    [selectedDistrictName]
  );

  // Calculate KPI Summary
  const kpiSummary = kpiOptions.map((option) => {
    const values = districtData.map((d) => getKPIValue(d, option.id as KPIType));
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    const min = Math.min(...values);
    const max = Math.max(...values);
    const minDistrict = districtData.find((d) => getKPIValue(d, option.id as KPIType) === min);
    const maxDistrict = districtData.find((d) => getKPIValue(d, option.id as KPIType) === max);

    return {
      label: option.label,
      avg: avg.toFixed(1),
      min: min.toFixed(1),
      minDistrict: minDistrict?.name || '',
      max: max.toFixed(1),
      maxDistrict: maxDistrict?.name || '',
      unit: option.id === 'wait_time' ? '분' : '%',
    };
  });

  return (
    <div className="h-full overflow-auto bg-gray-50">
      {/* Header - SGIS Style */}
      <div className="border-b border-gray-300 bg-white sticky top-0 z-10 shadow-sm">
        <div className="max-w-[1920px] mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <h1 className="text-lg font-bold text-gray-900">{region.label} 광역대시보드</h1>
              <div className="flex items-center gap-2 text-xs">
                <select className="border border-gray-300 rounded px-2 py-1">
                  <option>2026년</option>
                  <option>2025년</option>
                </select>
                <select className="border border-gray-300 rounded px-2 py-1">
                  <option>주간</option>
                  <option>월간</option>
                  <option>분기</option>
                </select>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button className="text-xs px-3 py-1.5 border border-gray-300 rounded hover:bg-gray-50">
                지역1▼
              </button>
              <button className="text-xs px-3 py-1.5 border border-gray-300 rounded hover:bg-gray-50">
                지역2▼
              </button>
              <button className="text-xs px-3 py-1.5 border border-gray-300 rounded hover:bg-gray-50" onClick={handleExportReport}>
                <Download className="h-3 w-3 inline mr-1" />
                출력
              </button>
              <button className="text-xs px-3 py-1.5 border border-gray-300 rounded hover:bg-gray-50">
                가이드
              </button>
              <button className="text-xs px-3 py-1.5 border border-gray-300 rounded hover:bg-gray-50">
                공유
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-[1920px] mx-auto px-4 py-4">
        {/* SGIS Style Layout: LEFT + CENTER + RIGHT */}
        <section className="mb-4">
          <div className="grid grid-cols-12 gap-4">

            {/* LEFT PANEL - 요약 통계 (SGIS Style) */}
            <div className="col-span-12 lg:col-span-2 space-y-3">
              {/* 총 케이스 수 */}
              <div className="bg-white border border-gray-300 rounded p-4">
                <div className="text-xs text-gray-500 mb-2">총 케이스 수</div>
                <div className="text-3xl font-bold text-blue-600 mb-1">
                  {Math.round(kpiCards[0]?.value || 0).toLocaleString('ko-KR')}
                </div>
                <div className="text-[11px] text-gray-400">건</div>
              </div>

              {/* 전국 단위 */}
              <div className="bg-white border border-gray-300 rounded p-3">
                <div className="text-xs text-gray-700 font-semibold mb-2 pb-2 border-b border-gray-200">전국 단위</div>
                <div className="space-y-2 text-xs">
                  <div className="flex items-center justify-between py-1">
                    <span className="text-gray-600">처리율</span>
                    <span className="font-semibold">{kpiCards[0]?.value.toFixed(1)}%</span>
                  </div>
                  <div className="flex items-center justify-between py-1">
                    <span className="text-gray-600">SLA 준수율</span>
                    <span className="font-semibold">{kpiCards[1]?.value.toFixed(1)}%</span>
                  </div>
                  <div className="flex items-center justify-between py-1">
                    <span className="text-gray-600">이탈률</span>
                    <span className="font-semibold text-red-600">{kpiCards[2]?.value.toFixed(1)}%</span>
                  </div>
                </div>
              </div>

              {/* 전국 관심지역 */}
              <div className="bg-white border border-gray-300 rounded p-3">
                <div className="text-xs text-gray-700 font-semibold mb-2 pb-2 border-b border-gray-200">전국 관심지역</div>
                <div className="space-y-1.5 text-[11px]">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">최대값</span>
                    <span className="font-medium">{Math.max(...districtData.map(d => d.completion)).toFixed(1)}%</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">전년도 대비</span>
                    <span className="font-medium text-green-600">+{Math.abs(kpiCards[0]?.deltaRate || 5)}%</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">센터</span>
                    <span className="font-medium">{districtData[0]?.staffCount || 15}개</span>
                  </div>
                </div>
              </div>

              {/* KPI 선택 */}
              <div className="bg-white border border-gray-300 rounded p-3">
                <div className="text-xs text-gray-700 font-semibold mb-2">KPI 선택</div>
                <div className="space-y-1.5">
                  {kpiCards.slice(0, 4).map((card) => {
                    const isSelected = selectedKPI === card.id;
                    return (
                      <button
                        key={card.id}
                        type="button"
                        onClick={() => {
                          setSelectedKPI(card.id as KPIType);
                          handleKpiClick(card.id);
                        }}
                        className={`w-full text-left px-2 py-1.5 rounded text-[11px] transition-colors ${
                          isSelected
                            ? 'bg-blue-50 text-blue-700 font-semibold border border-blue-300'
                            : 'hover:bg-gray-50 text-gray-700 border border-transparent'
                        }`}
                      >
                        {card.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* CENTER PANEL - GeoMap */}
            <div className="col-span-12 lg:col-span-6">
            <Card>
              <CardHeader>
                <CardTitle>{statsScopeLabel} 통계 요약</CardTitle>
                <p className="text-xs text-gray-500">
                {selectedDistrictName ? '선택 구역 기준' : '광역 평균 기준'} · 케이스 분포 · 처리 추세
                </p>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 gap-4">
                  <div className="rounded-lg border border-gray-200 p-3">
                    <div className="text-sm font-semibold text-gray-900 mb-2">연령 구조 (비율)</div>
                    <ResponsiveContainer width="100%" height={140}>
                      <BarChart data={ageDistribution} barGap={4}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                        <XAxis dataKey="age" stroke="#6b7280" fontSize={10} />
                        <YAxis stroke="#6b7280" fontSize={10} />
                        <Tooltip />
                        <Bar dataKey="male" stackId="a" fill="#60a5fa" name="남" />
                        <Bar dataKey="female" stackId="a" fill="#2563eb" name="여" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="rounded-lg border border-gray-200 p-3">
                    <div className="text-sm font-semibold text-gray-900 mb-2">최근 6개월 상담 추세</div>
                    <ResponsiveContainer width="100%" height={140}>
                      <LineChart data={trendData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                        <XAxis dataKey="month" stroke="#6b7280" fontSize={10} />
                        <YAxis stroke="#6b7280" fontSize={10} />
                        <Tooltip />
                        <Line type="monotone" dataKey="cases" stroke="#3b82f6" strokeWidth={2} name="발생" />
                        <Line type="monotone" dataKey="resolved" stroke="#10b981" strokeWidth={2} name="처리" />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>위험군 구성</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={160}>
                  <PieChart>
                    <Pie data={riskComposition} dataKey="value" innerRadius={45} outerRadius={70} paddingAngle={4}>
                      {riskComposition.map((entry) => (
                        <Cell key={entry.name} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
                <div className="mt-3 space-y-1 text-xs text-gray-600">
                  {riskComposition.map((item) => (
                    <div key={item.name} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: item.color }} />
                        <span>{item.name}</span>
                      </div>
                      <span>{item.value}%</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>수요·공급/커버리지</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={160}>
                  <BarChart data={capacityData} barGap={12}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="name" stroke="#6b7280" fontSize={10} />
                    <YAxis stroke="#6b7280" fontSize={10} />
                    <Tooltip />
                    <Bar dataKey="demand" fill="#f59e0b" name="수요" />
                    <Bar dataKey="supply" fill="#3b82f6" name="공급" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* CENTER PANEL - GeoMap */}
          <div className="col-span-12 lg:col-span-6">
              <GeoMapPanel
                key={`${region.id}-${selectedKPI}`}
                title={`지역별 ${kpiOptions.find((o) => o.id === selectedKPI)?.label || '통계'}`}
                indicatorId={selectedKPI}
                year={2026}
                scope={{ mode: 'regional', ctprvnCodes: [region.ctprvnCode], label: region.label }}
                mapHeight={580}
                onRegionSelect={({ level, name }) => {
                  if (level === 'ctprvn') {
                    setSelectedDistrictName(null);
                    return;
                  }
                  if (level === 'sig' || level === 'emd') {
                    setSelectedDistrictName(name);
                  }
                }}
              />
            </div>

            {/* RIGHT PANEL - 차트 4개 (SGIS Style) */}
            <div className="col-span-12 lg:col-span-4 space-y-3">
              {/* 파이 차트 2개를 나란히 */}
              <div className="grid grid-cols-2 gap-3">
                <ChartCard
                  title="접촉 성공/실패"
                  tableData={contactData.map((item) => ({ label: item.name, value: `${item.value}%` }))}
                  footer="단위: %"
                >
                  <div className="h-32">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={contactData}
                          dataKey="value"
                          nameKey="name"
                          innerRadius={28}
                          outerRadius={50}
                          paddingAngle={2}
                        >
                          <Cell fill="#ef4444" />
                          <Cell fill="#3b82f6" />
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </ChartCard>

                <ChartCard
                  title="상담 완료/미완료"
                  tableData={consultationData.map((item) => ({ label: item.name, value: `${item.value}%` }))}
                  footer="단위: %"
                >
                  <div className="h-32">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={consultationData}
                          dataKey="value"
                          nameKey="name"
                          innerRadius={28}
                          outerRadius={50}
                          paddingAngle={2}
                        >
                          <Cell fill="#ef4444" />
                          <Cell fill="#3b82f6" />
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </ChartCard>
              </div>

              {/* 연령별 막대 그래프 */}
              <ChartCard
                title="연령별 분포"
                tableData={ageDistribution.map((item) => ({ label: item.age, value: `남: ${item.male} / 여: ${item.female}` }))}
                footer="단위: 명"
              >
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={ageDistribution} margin={{ top: 5, right: 10, left: -15, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                      <XAxis dataKey="age" tick={{ fontSize: 9 }} />
                      <YAxis tick={{ fontSize: 9 }} />
                      <Tooltip />
                      <Bar dataKey="male" fill="#60a5fa" name="남" />
                      <Bar dataKey="female" fill="#f472b6" name="여" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </ChartCard>

              {/* 가구원 수별 막대 그래프 */}
              <ChartCard
                title="지역별 케이스 수 (상위 5개)"
                tableData={kpiComparisonData.map((item) => ({ label: item.name, value: `${item.처리율}건` }))}
                footer="단위: 건"
              >
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={kpiComparisonData} margin={{ top: 5, right: 10, left: -15, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                      <XAxis dataKey="name" tick={{ fontSize: 9 }} />
                      <YAxis tick={{ fontSize: 9 }} />
                      <Tooltip />
                      <Bar dataKey="처리율" fill="#3b82f6" radius={[4, 4, 0, 0]} name="처리율" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </ChartCard>
            </div>
          </div>
        </section>

        {/* Full Width Trend Chart - SGIS Style */}
        <section className="mb-4">
          <div className="bg-white border border-gray-300 rounded">
            <div className="border-b border-gray-200 px-4 py-2.5 flex items-center justify-between">
              <div className="text-sm font-semibold text-gray-900">총조사(주간추이)</div>
              <div className="flex items-center gap-2">
                <button className="text-xs px-2 py-1 border border-gray-200 rounded hover:bg-gray-50">
                  <Table2 className="h-3 w-3 inline mr-1" />
                  통계표
                </button>
                <button className="text-xs px-2 py-1 border border-gray-200 rounded hover:bg-gray-50">
                  <BarChart3 className="h-3 w-3 inline mr-1" />
                  유형
                </button>
                <button className="text-xs px-2 py-1 border border-gray-200 rounded hover:bg-gray-50">
                  <Download className="h-3 w-3 inline mr-1" />
                  저장
                </button>
              </div>
            </div>
            <div className="p-4">
              <div className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={mixedTrendData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                    <CartesianGrid stroke="#e5e7eb" strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="period" tick={{ fontSize: 11 }} />
                    <YAxis yAxisId="left" tick={{ fontSize: 11 }} />
                    <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'rgba(255, 255, 255, 0.95)',
                        border: '1px solid #d1d5db',
                        borderRadius: '4px',
                        fontSize: '11px'
                      }}
                    />
                    <Bar yAxisId="left" dataKey="waitTime" fill="#3b82f6" radius={[4, 4, 0, 0]} name="평균 대기시간" />
                    <Line
                      yAxisId="right"
                      type="monotone"
                      dataKey="dropout"
                      stroke="#eab308"
                      strokeWidth={2}
                      dot={{ fill: '#eab308', r: 3 }}
                      name="이탈률"
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </section>

        {/* Alerts Table - Compact */}
        <section className="mb-4">
          <div className="bg-white border border-gray-300 rounded">
            <div className="border-b border-gray-200 px-4 py-2.5">
              <h2 className="text-sm font-semibold text-gray-900">이상징후 알림</h2>
            </div>
            <div className="p-4">
              <div className="space-y-2">
                {alerts.slice(0, 3).map((alert) => (
                  <div
                    key={alert.id}
                    className="flex items-center justify-between p-2.5 rounded border border-gray-200 bg-gray-50 hover:bg-gray-100"
                  >
                    <div className="flex items-center gap-3">
                      <Badge
                        variant="outline"
                        className={
                          alert.severity === 'critical'
                            ? 'bg-red-50 text-red-700 border-red-300 text-xs'
                            : 'bg-yellow-50 text-yellow-700 border-yellow-300 text-xs'
                        }
                      >
                        {alert.severity === 'critical' ? '긴급' : '주의'}
                      </Badge>
                      <div>
                        <div className="text-xs font-medium text-gray-900">{alert.district}</div>
                        <div className="text-[11px] text-gray-600">{alert.message}</div>
                      </div>
                    </div>
                    <div className="text-[11px] text-gray-500">{alert.change}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* District Details - Compact */}
        {currentDistrictData && (
          <section className="mb-4">
            <div className="bg-white border border-gray-300 rounded">
              <div className="border-b border-gray-200 px-4 py-2.5 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-gray-900">
                  지역 상세: {currentDistrictData.name}
                </h2>
                {onNavigateToBottleneck && (
                  <button
                    onClick={onNavigateToBottleneck}
                    className="text-xs px-2 py-1 border border-gray-200 rounded hover:bg-gray-50"
                  >
                    병목 분석
                    <ArrowRight className="h-3 w-3 inline ml-1" />
                  </button>
                )}
              </div>

              <div className="p-4">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-gray-200 text-gray-600">
                      <th className="text-left py-2 font-semibold">지표</th>
                      <th className="text-center py-2 font-semibold">현재값</th>
                      <th className="text-center py-2 font-semibold">변동률</th>
                      <th className="text-center py-2 font-semibold">상태</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-gray-100">
                      <td className="py-2 text-gray-700">상담완료율</td>
                      <td className="py-2 text-center font-semibold text-gray-900">
                        {currentDistrictData.completion}%
                      </td>
                      <td className="py-2 text-center">
                        <span
                          className={
                            currentDistrictData.monthlyChange > 0
                              ? 'text-green-700'
                              : currentDistrictData.monthlyChange < 0
                              ? 'text-red-700'
                              : 'text-gray-700'
                          }
                        >
                          {currentDistrictData.monthlyChange > 0 ? '+' : ''}
                          {currentDistrictData.monthlyChange}%p
                        </span>
                      </td>
                      <td className="py-2 text-center">
                        <Badge
                          variant="outline"
                          className={
                            currentDistrictData.completion >= 80
                              ? 'bg-green-50 text-green-700 border-green-300 text-[10px]'
                              : currentDistrictData.completion >= 70
                              ? 'bg-yellow-50 text-yellow-700 border-yellow-300 text-[10px]'
                              : 'bg-red-50 text-red-700 border-red-300 text-[10px]'
                          }
                        >
                          {currentDistrictData.completion >= 80
                            ? '정상'
                            : currentDistrictData.completion >= 70
                            ? '주의'
                            : '심각'}
                        </Badge>
                      </td>
                    </tr>
                    <tr className="border-b border-gray-100">
                      <td className="py-2 text-gray-700">이탈률</td>
                      <td className="py-2 text-center font-semibold text-gray-900">
                        {currentDistrictData.dropout}%
                      </td>
                      <td className="py-2 text-center">
                        <span className={currentDistrictData.trend === 'down' ? 'text-green-700' : 'text-red-700'}>
                          {currentDistrictData.trend === 'up' ? '상승' : currentDistrictData.trend === 'down' ? '하락' : '유지'}
                        </span>
                      </td>
                      <td className="py-2 text-center">
                        <Badge
                          variant="outline"
                          className={
                            currentDistrictData.dropout <= 10
                              ? 'bg-green-50 text-green-700 border-green-300 text-[10px]'
                              : currentDistrictData.dropout <= 18
                              ? 'bg-yellow-50 text-yellow-700 border-yellow-300 text-[10px]'
                              : 'bg-red-50 text-red-700 border-red-300 text-[10px]'
                          }
                        >
                          {currentDistrictData.dropout <= 10
                            ? '정상'
                            : currentDistrictData.dropout <= 18
                            ? '주의'
                            : '심각'}
                        </Badge>
                      </td>
                    </tr>
                    <tr>
                      <td className="py-2 text-gray-700">인력 현황</td>
                      <td className="py-2 text-center font-semibold text-gray-900">
                        {currentDistrictData.staffCount}명
                      </td>
                      <td className="py-2 text-center text-gray-600">-</td>
                      <td className="py-2 text-center">
                        <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-300 text-[10px]">
                          운영중
                        </Badge>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
